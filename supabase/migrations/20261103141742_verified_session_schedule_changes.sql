alter table public.sessions add column if not exists original_session_date date;
alter table public.sessions add column if not exists actual_started_at timestamptz;
-- Persist schedule changes before offering notification drafts. No sending here.
create function public.session_schedule_change(p_tenant uuid,p_user uuid,p_assistant uuid,p_action text,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.users;gr public.groups;session public.sessions;context jsonb;item uuid;target uuid;day date;clock text;next_number integer;source_id uuid;requested_id uuid;scoped_teacher uuid;is_group boolean:=coalesce((p_data->>'is_group')::boolean,false);
begin
 if p_action not in ('cancel','reschedule','extra','start') or length(coalesce(p_data->>'reason',''))>300 or length(coalesce(p_data->>'topic',''))>200 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 select u.* into actor from public.users u join public.tenants t on t.id=u.tenant_id and t.status='active' and t.deleted_at is null where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner');
 if actor.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if actor.role='teacher' then scoped_teacher:=actor.teacher_id;if scoped_teacher is null then select id into scoped_teacher from public.teachers where user_id=p_user and tenant_id=p_tenant limit 1;end if;end if;
 if p_assistant is not null then
  context:=public.assistant_delegated_context();
  if context->>'tenant_id' is distinct from p_tenant::text or context->>'owner_id' is distinct from p_user::text or context->>'assistant_id' is distinct from p_assistant::text or (p_action='start' and context->>'resource' not in ('sessions','attendance') or p_action<>'start' and context->>'resource' is distinct from 'sessions') or context->>'action' is distinct from (case when p_action in ('extra','start') then 'create' else 'edit' end) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
 perform pg_advisory_xact_lock_shared(hashtextextended(p_tenant::text||':academic_year',0));
 if p_action in ('extra','start') then target:=(p_data->>'group_id')::uuid;
 elsif is_group then target:=(p_data->>'id')::uuid;
 else
  select * into session from public.sessions where id=(p_data->>'id')::uuid and tenant_id=p_tenant;
  if session.id is null then raise exception 'SESSION_NOT_FOUND' using errcode='P0002';end if;target:=session.group_id;
 end if;
 select * into gr from public.groups where id=target and tenant_id=p_tenant;
 if gr.id is null or not public.portal_group_in_current_year(gr.id,p_tenant) or scoped_teacher is not null and gr.teacher_id is not null and scoped_teacher<>gr.teacher_id or p_assistant is not null and not public.assistant_delegated_group(gr.id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':schedule:'||gr.id::text,0));
 if p_action='start' then
  day:=(now() at time zone 'Africa/Cairo')::date;
  select * into session from public.sessions where group_id=gr.id and tenant_id=p_tenant and session_date=day and status='in_progress' order by created_at limit 1 for update;
  if session.id is not null and nullif(p_data->>'session_id','') is not null and session.id<>(p_data->>'session_id')::uuid then raise exception 'SESSION_IN_PROGRESS' using errcode='23514';end if;
  if session.id is null then
   if nullif(p_data->>'session_id','') is not null then
    select * into session from public.sessions where id=(p_data->>'session_id')::uuid and tenant_id=p_tenant and group_id=gr.id for update;
    if session.id is null or coalesce(session.rescheduled_to_date,session.session_date)<>day then raise exception 'SESSION_NOT_TODAY' using errcode='23514';end if;
   else
    if (select count(*) from public.sessions where tenant_id=p_tenant and group_id=gr.id and is_extra is not true and session_date=day and status not in ('ended'))>1 then raise exception 'SESSION_SELECTION_REQUIRED' using errcode='23514';end if;
    select * into session from public.sessions where tenant_id=p_tenant and group_id=gr.id and is_extra is not true and session_date=day and status not in ('ended') order by created_at desc limit 1 for update;
   end if;
   if session.id is not null then
    if session.status='cancelled' or session.status='ended' then raise exception 'SESSION_CANCELLED' using errcode='23514';end if;
    if coalesce(session.rescheduled_to_date,session.session_date)<>day then raise exception 'SESSION_NOT_TODAY' using errcode='23514';end if;
    update public.sessions set status='in_progress',original_session_date=case when rescheduled_to_date is not null then coalesce(original_session_date,session_date) else original_session_date end,session_date=day,actual_started_at=coalesce(actual_started_at,now()) where id=session.id and tenant_id=p_tenant returning * into session;
   else
    select coalesce(max(session_number),0)+1 into next_number from public.sessions where group_id=gr.id and tenant_id=p_tenant;
    insert into public.sessions(tenant_id,group_id,session_number,session_date,session_time,start_time,status,actual_started_at) values(p_tenant,gr.id,next_number,day,public.announcement_clock_time(gr.session_time),public.announcement_clock_time(gr.session_time)::time,'in_progress',now()) returning * into session;
   end if;
  end if;
 elsif p_action='extra' then
  day:=(p_data->>'session_date')::date;clock:=public.announcement_clock_time(coalesce(nullif(p_data->>'session_time',''),gr.session_time));
  if day is null or clock is null then raise exception 'INVALID_SESSION_TIME' using errcode='22023';end if;
  requested_id:=coalesce(nullif(p_data->>'request_id','')::uuid,gen_random_uuid());
  select * into session from public.sessions where id=requested_id for update;
  if session.id is not null then
   if session.tenant_id<>p_tenant or session.group_id<>gr.id or session.session_date<>day or session.session_time is distinct from clock or session.extra_topic is distinct from nullif(p_data->>'topic','') or session.is_extra is not true then raise exception 'FORBIDDEN' using errcode='42501';end if;
  else
   select coalesce(max(session_number),0)+1 into next_number from public.sessions where group_id=gr.id and tenant_id=p_tenant;
   insert into public.sessions(id,tenant_id,group_id,session_number,session_date,session_time,start_time,is_extra,extra_topic,status) values(requested_id,p_tenant,gr.id,next_number,day,clock,clock::time,true,nullif(p_data->>'topic',''),'scheduled') returning * into session;
  end if;
 else
  if is_group then
   day:=coalesce(nullif(p_data->>'session_date','')::date,(now() at time zone 'Africa/Cairo')::date);
   if (select count(*) from public.sessions where group_id=gr.id and tenant_id=p_tenant and session_date=day and is_extra is not true)>1 then raise exception 'SESSION_SELECTION_REQUIRED' using errcode='23514';end if;
   select * into session from public.sessions where group_id=gr.id and tenant_id=p_tenant and session_date=day and is_extra is not true for update;
   if session.id is null then
    select coalesce(max(session_number),0)+1 into next_number from public.sessions where group_id=gr.id and tenant_id=p_tenant;
    insert into public.sessions(tenant_id,group_id,session_number,session_date,session_time,start_time,status) values(p_tenant,gr.id,next_number,day,public.announcement_clock_time(gr.session_time),public.announcement_clock_time(gr.session_time)::time,'scheduled') returning * into session;
   end if;
  else
   select * into session from public.sessions where id=session.id and tenant_id=p_tenant for update;
   if session.group_id<>gr.id then raise exception 'FORBIDDEN' using errcode='42501';end if;
  end if;
  if session.status='ended' or exists(select 1 from public.attendance where session_id=session.id and tenant_id=p_tenant) then raise exception 'SESSION_HAS_RECORDS' using errcode='23514';end if;
  if p_action='cancel' then
   update public.sessions set status='cancelled',cancellation_reason=nullif(p_data->>'reason','') where id=session.id and tenant_id=p_tenant returning * into session;
  else
   day:=(p_data->>'new_date')::date;clock:=public.announcement_clock_time(coalesce(nullif(p_data->>'new_time',''),session.rescheduled_to_time,session.session_time,gr.session_time));
   if day is null or clock is null then raise exception 'INVALID_SESSION_TIME' using errcode='22023';end if;
   update public.sessions set status='rescheduled',rescheduled_to_date=day,rescheduled_to_time=clock,cancellation_reason=nullif(p_data->>'reason','') where id=session.id and tenant_id=p_tenant returning * into session;
  end if;
 end if;
 source_id:=public.capture_announcement_source(p_tenant,'session',session.id);
 return jsonb_build_object('session',to_jsonb(session),'action',case when p_action='cancel' then 'cancelled' when p_action='reschedule' then 'rescheduled' when p_action='start' then 'started' else 'extra' end,'notifications_dispatched',0,'source_event_id',source_id,'message','تم حفظ الحصة. يمكنك الآن مراجعة مسودة الإبلاغ واختيار المستلمين.');
end;$$;
revoke all on function public.session_schedule_change(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.session_schedule_change(uuid,uuid,uuid,text,jsonb) to service_role;

create or replace function public.assistant_delegated_rpc(p_name text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();k text;v jsonb;v_id text;p record;v_call text;v_result jsonb;v_groups uuid[];
begin
 if p_name not in ('session_schedule_change','archive_quiz_definition','announcement_operation','announcement_queue','classroom_operation','portal_tenant_context','assistant_invite','assistant_configure','assistant_registration_link','student_followup_report','student_collection_operation','portal_onboarding_claim_queue','portal_onboarding_claim_queue_limited','parent_family_limit') then raise exception 'FORBIDDEN';end if;
 if p_name in ('announcement_operation','announcement_queue') then
  if c->>'resource'<>'announcements' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  p_args:=p_args||jsonb_build_object('p_tenant',c->>'tenant_id','p_user',c->>'owner_id','p_assistant',c->>'assistant_id');
 end if;
 for k,v in select * from jsonb_each(p_args) loop
  if k in ('p_tenant','p_tenant_id') and v<>'null'::jsonb and v#>>'{}'<>c->>'tenant_id' then raise exception 'FORBIDDEN';end if;
  if k in ('p_user','p_user_id') and v<>'null'::jsonb and v#>>'{}'<>c->>'owner_id' then raise exception 'FORBIDDEN';end if;
  if k in ('p_student','p_student_id') and not public.assistant_delegated_student((v#>>'{}')::uuid) then raise exception 'FORBIDDEN';end if;
  if k in ('p_assistant','p_assistant_id') and v<>'null'::jsonb and not exists(select 1 from public.assistants a where a.id=(v#>>'{}')::uuid and a.tenant_id::text=c->>'tenant_id' and (c->>'teacher_id' is null or a.teacher_id::text=c->>'teacher_id')) then raise exception 'FORBIDDEN';end if;
  if k='p_teacher' and v<>'null'::jsonb and not exists(select 1 from public.teachers t where t.id=(v#>>'{}')::uuid and t.tenant_id::text=c->>'tenant_id' and (c->>'teacher_id' is null or t.id::text=c->>'teacher_id')) then raise exception 'FORBIDDEN';end if;
  if k in ('p_groups','p_group_ids') then for v_id in select jsonb_array_elements_text(v) loop if not public.assistant_delegated_group(v_id::uuid) then raise exception 'FORBIDDEN';end if;end loop;end if;
  if k='p_all_groups' and v='true'::jsonb and not (c->>'all_groups')::boolean then raise exception 'FORBIDDEN';end if;
  if k='p_permissions' and exists(select 1 from jsonb_each(v) new_permission where new_permission.value='true'::jsonb and c->'permissions'->new_permission.key is distinct from 'true'::jsonb) then raise exception 'FORBIDDEN';end if;
 end loop;
 if p_name in ('assistant_invite','assistant_configure','assistant_registration_link','create_assistant_secure','update_assistant_secure','delete_assistant_secure') and (c->>'resource'<>'assistants' or c->>'action' not in ('create','edit','delete')) then raise exception 'FORBIDDEN';end if;
 if p_name in ('portal_onboarding_claim_queue','portal_onboarding_claim_queue_limited') and (c->>'resource'<>'students' or c->>'action'<>'send' or not exists(select 1 from public.meta_portal_dispatch_queue q where q.id=(p_args->>'p_queue_id')::uuid and q.tenant_id=c->>'tenant_id' and public.assistant_delegated_student(q.student_id))) then raise exception 'FORBIDDEN';end if;
 if p_name='assistant_invite' and c->>'teacher_id' is not null and p_args->>'p_teacher' is distinct from c->>'teacher_id' then raise exception 'FORBIDDEN';end if;
 if p_name='student_followup_report' and c->>'resource' not in ('reports','messages','risk-watchlist') then raise exception 'FORBIDDEN';end if;
 if p_name='student_collection_operation' then
  if p_args->>'p_action'='void' or (p_args->>'p_action'<>'view' and c->>'action' not in ('collect','create')) then raise exception 'FORBIDDEN';end if;
  p_args:=p_args||jsonb_build_object('p_assistant',c->>'assistant_id','p_user',null,'p_actor',(select name from public.assistants where id=(c->>'assistant_id')::uuid and tenant_id=(c->>'tenant_id')::uuid));
  if c->>'resource' not in ('students','collections') then raise exception 'FORBIDDEN';end if;
  if p_args->>'p_action'='void' and not coalesce((c->'permissions'->>'students.collect')::boolean,false) then raise exception 'FORBIDDEN';end if;
 end if;
 if p_args ? 'p_data' then
  v:=p_args->'p_data';
  if nullif(v->>'group_id','') is not null and not public.assistant_delegated_group((v->>'group_id')::uuid) then raise exception 'FORBIDDEN';end if;
  if nullif(v->>'student_id','') is not null and not public.assistant_delegated_student((v->>'student_id')::uuid) then raise exception 'FORBIDDEN';end if;
  if nullif(v->>'id','') is not null and p_name='student_collection_operation' and not exists(select 1 from public.student_collections sc where sc.id=(v->>'id')::uuid and sc.tenant_id::text=c->>'tenant_id' and public.assistant_delegated_group(sc.group_id)) then raise exception 'FORBIDDEN';end if;
 end if;
 select pr.oid,pr.proargnames,pr.proargtypes,pr.proretset into p from pg_catalog.pg_proc pr join pg_catalog.pg_namespace n on n.oid=pr.pronamespace where n.nspname='public' and pr.proname=p_name and pr.prokind='f' and (select array_agg(key order by key) from jsonb_object_keys(p_args) key)<@pr.proargnames order by pr.pronargs limit 1;
 if p.oid is null then raise exception 'INVALID_INPUT';end if;
 -- JSON scalar arguments need their text representation, JSON objects remain JSON.
 select string_agg(case when p.proargtypes[i] in (114,3802) then format('%I := ($1->%L)::%s',p.proargnames[i+1],p.proargnames[i+1],pg_catalog.format_type(p.proargtypes[i],null))
  when pg_catalog.format_type(p.proargtypes[i],null)='uuid[]' then format('%I := array(select jsonb_array_elements_text($1->%L))::uuid[]',p.proargnames[i+1],p.proargnames[i+1])
  else format('%I := ($1->>%L)::%s',p.proargnames[i+1],p.proargnames[i+1],pg_catalog.format_type(p.proargtypes[i],null)) end,',') into v_call
 from generate_series(0,array_length(p.proargnames,1)-1) i where p_args?p.proargnames[i+1];
 if p.proretset then execute format('select coalesce(jsonb_agg(to_jsonb(value)),''[]''::jsonb) from public.%I(%s) value',p_name,v_call) into v_result using p_args;
 else execute format('select to_jsonb(public.%I(%s))',p_name,v_call) into v_result using p_args;end if;
 return v_result;
end;$$;

-- Student/parent calendars show the actual replacement date/time, not the
-- canceled original slot. No material or peer information is returned.
create or replace function public.portal_upcoming_sessions(p_student uuid,p_tenant uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.session_date,x.start_time),'[]'::jsonb) from (
 select coalesce(se.rescheduled_to_date,se.session_date) as session_date,
  coalesce(public.announcement_clock_time(se.rescheduled_to_time),public.announcement_clock_time(se.session_time),se.start_time::text,public.announcement_clock_time(g.session_time)) as start_time,se.end_time,g.name as group_name
 from public.sessions se join public.groups g on g.id=se.group_id and g.tenant_id=p_tenant
 join public.students st on st.id=p_student and st.tenant_id=p_tenant and st.archived_at is null
 where se.tenant_id=p_tenant and coalesce(se.rescheduled_to_date,se.session_date)>=(now() at time zone 'Africa/Cairo')::date
 and coalesce(se.status,'scheduled') not in ('ended','cancelled','canceled') and public.portal_group_in_current_year(g.id,p_tenant)
 and (st.group_id=g.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and gs.group_id=g.id))
 and (public.portal_preferences(p_tenant)->>'show_upcoming_sessions')::boolean
 order by coalesce(se.rescheduled_to_date,se.session_date),start_time limit 5
 ) x
$$;
