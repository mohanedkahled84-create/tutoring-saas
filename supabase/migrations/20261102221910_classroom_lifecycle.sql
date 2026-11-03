alter table public.students add column archived_at timestamptz;
alter table public.groups add column archived_at timestamptz;
create index students_active_tenant on public.students(tenant_id) where archived_at is null;
create index groups_active_tenant on public.groups(tenant_id) where archived_at is null;

create table public.classroom_history(
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 student_id uuid references public.students(id) on delete set null,
 group_id uuid references public.groups(id) on delete set null,
 actor_user_id uuid references public.users(id) on delete set null,
 assistant_id uuid references public.assistants(id) on delete set null,
 action text not null check(action in ('archive_student','restore_student','archive_group','restore_group','transfer_student','year_started','year_closed')),
 detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create index classroom_history_tenant_date on public.classroom_history(tenant_id,created_at desc);
alter table public.classroom_history enable row level security;
revoke all on public.classroom_history from public,anon,authenticated;
grant all on public.classroom_history to service_role;

create function public.classroom_operation(p_tenant uuid,p_user uuid,p_assistant uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare c jsonb;st public.students;gr public.groups;source public.groups;target public.groups;
 item uuid:=nullif(p_data->>'id','')::uuid;v_result jsonb;before_row jsonb;resource text;
begin
 if not exists(select 1 from public.users u join public.tenants t on t.id=u.tenant_id where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner') and t.status='active' and t.deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action not in ('archive_student','restore_student','archive_group','restore_group','transfer_student','list_archived_students','list_archived_groups','student_history') then raise exception 'INVALID_ACTION' using errcode='22023';end if;
 resource:=case when p_action like '%group%' then 'groups' else 'students' end;
 if p_assistant is not null then
  c:=public.assistant_delegated_context();
  if c->>'tenant_id'<>p_tenant::text or c->>'owner_id'<>p_user::text or c->>'assistant_id'<>p_assistant::text or c->>'resource'<>resource or c->>'action'<>(case when p_action like 'list_%' or p_action='student_history' then 'view' else 'edit' end) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
 if p_action='list_archived_students' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (select s.id,s.name,s.student_code,s.group_id,s.archived_at from public.students s where s.tenant_id=p_tenant and s.archived_at is not null and (p_assistant is null or public.assistant_delegated_student(s.id)) order by s.archived_at desc limit 1000) x;return v_result;
 elsif p_action='list_archived_groups' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (select g.id,g.name,g.archived_at from public.groups g where g.tenant_id=p_tenant and g.archived_at is not null and (p_assistant is null or public.assistant_delegated_group(g.id)) order by g.archived_at desc limit 1000) x;return v_result;
 end if;
 if resource='students' then
  select * into st from public.students where id=item and tenant_id=p_tenant for update;
  if st.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
  if p_assistant is not null and not public.assistant_delegated_student(st.id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if p_action='student_history' then
   select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_result from (select h.action,h.detail,h.created_at from public.classroom_history h where h.tenant_id=p_tenant and h.student_id=st.id order by h.created_at desc limit 100) x;return v_result;
  end if;
  before_row:=jsonb_build_object('name',st.name,'group_id',st.group_id,'archived_at',st.archived_at);
  if p_action in ('archive_student','restore_student') then
   if p_assistant is not null and ((st.group_id is not null and not public.assistant_delegated_group(st.group_id)) or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and not public.assistant_delegated_group(gs.group_id))) then raise exception 'FORBIDDEN' using errcode='42501';end if;
   if (p_action='archive_student')=(st.archived_at is not null) then return jsonb_build_object('id',st.id,'unchanged',true);end if;
   if p_action='restore_student' then
    select * into target from public.groups g where g.tenant_id=p_tenant and g.archived_at is null and (case when nullif(p_data->>'group_id','') is not null then g.id=(p_data->>'group_id')::uuid else g.id=st.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and gs.group_id=g.id) end) order by (g.id=st.group_id) desc,g.id limit 1;
    if target.id is null then raise exception 'ACTIVE_GROUP_REQUIRED' using errcode='23514';end if;
    if p_assistant is not null and not public.assistant_delegated_group(target.id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
   end if;
   update public.students set archived_at=case when p_action='archive_student' then now() else null end,group_id=case when p_action='restore_student' then target.id else group_id end where id=st.id returning jsonb_build_object('id',id,'archived_at',archived_at,'group_id',group_id) into v_result;
  else
   select * into source from public.groups where id=nullif(p_data->>'from_group_id','')::uuid and tenant_id=p_tenant for share;
   select * into target from public.groups where id=nullif(p_data->>'group_id','')::uuid and tenant_id=p_tenant and archived_at is null for share;
   if source.id is null or target.id is null or source.id=target.id or st.archived_at is not null then raise exception 'INVALID_TRANSFER' using errcode='22023';end if;
   if st.group_id is distinct from source.id and not exists(select 1 from public.group_students where tenant_id=p_tenant and student_id=st.id and group_id=source.id) then raise exception 'NOT_ENROLLED' using errcode='22023';end if;
   if p_assistant is not null and (not public.assistant_delegated_group(source.id) or not public.assistant_delegated_group(target.id)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
   delete from public.group_students where tenant_id=p_tenant and student_id=st.id and group_id=source.id;
   insert into public.group_students(tenant_id,student_id,group_id) select p_tenant,st.id,target.id where not exists(select 1 from public.group_students where tenant_id=p_tenant and student_id=st.id and group_id=target.id);
   perform set_config('centrly.classroom_recorded','1',true);
   if st.group_id=source.id or st.group_id is null then update public.students set group_id=target.id where id=st.id;end if;
   perform set_config('centrly.classroom_recorded','',true);
   v_result:=jsonb_build_object('id',st.id,'from_group_id',source.id,'from_group_name',source.name,'group_id',target.id,'group_name',target.name,'history_preserved',true);
  end if;
 else
  select * into gr from public.groups where id=item and tenant_id=p_tenant for update;
  if gr.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
  if p_assistant is not null and not public.assistant_delegated_group(gr.id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if p_action='archive_group' and exists(select 1 from public.sessions where tenant_id=p_tenant and group_id=gr.id and status='in_progress') then raise exception 'ACTIVE_SESSION' using errcode='23514';end if;
  if (p_action='archive_group')=(gr.archived_at is not null) then return jsonb_build_object('id',gr.id,'unchanged',true);end if;
  before_row:=jsonb_build_object('name',gr.name,'archived_at',gr.archived_at);
  update public.groups set archived_at=case when p_action='archive_group' then now() else null end where id=gr.id returning jsonb_build_object('id',id,'archived_at',archived_at) into v_result;
 end if;
 insert into public.classroom_history(tenant_id,student_id,group_id,actor_user_id,assistant_id,action,detail) values(p_tenant,st.id,coalesce(gr.id,target.id,st.group_id),case when p_assistant is null then p_user else null end,p_assistant,p_action,jsonb_build_object('before',before_row,'after',v_result));
 return v_result;
end;$$;
revoke all on function public.classroom_operation(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.classroom_operation(uuid,uuid,uuid,text,jsonb) to service_role;

-- All existing update/enrollment paths preserve other memberships and write a
-- snapshot. The private history table is not directly writable by a user.
create function public.record_primary_group_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare old_name text;new_name text;
begin
 if new.tenant_id is distinct from old.tenant_id then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if new.group_id is not null then
  select name into new_name from public.groups where id=new.group_id and tenant_id=new.tenant_id and archived_at is null for share;
  if not found then raise exception 'GROUP_NOT_ACTIVE' using errcode='42501';end if;
 end if;
 select name into old_name from public.groups where id=old.group_id and tenant_id=old.tenant_id;
 delete from public.group_students where tenant_id=new.tenant_id and student_id=new.id and group_id=old.group_id;
 if new.group_id is not null then
  insert into public.group_students(tenant_id,student_id,group_id) select new.tenant_id,new.id,new.group_id where not exists(select 1 from public.group_students where tenant_id=new.tenant_id and student_id=new.id and group_id=new.group_id);
 end if;
 if coalesce(current_setting('centrly.classroom_recorded',true),'')<>'1' then
  insert into public.classroom_history(tenant_id,student_id,group_id,action,detail) values(new.tenant_id,new.id,new.group_id,'transfer_student',jsonb_build_object('before',jsonb_build_object('name',old.name,'group_id',old.group_id,'group_name',old_name),'after',jsonb_build_object('group_id',new.group_id,'group_name',new_name),'source','primary_group_update'));
 end if;
 return new;
end;$$;
revoke all on function public.record_primary_group_change() from public,anon,authenticated;
grant execute on function public.record_primary_group_change() to service_role;
create trigger student_primary_group_history after update of group_id on public.students for each row when(old.group_id is distinct from new.group_id) execute function public.record_primary_group_change();

create function public.guard_active_classroom_group() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':academic_year',0));
 if new.group_id is not null then
  perform 1 from public.groups where id=new.group_id and tenant_id=new.tenant_id and archived_at is null for share;
  if not found then raise exception 'GROUP_NOT_ACTIVE' using errcode='42501';end if;
 end if;
 if tg_table_name='group_students' then
  perform 1 from public.students where id=new.student_id and tenant_id=new.tenant_id and archived_at is null for share;
  if not found then raise exception 'STUDENT_NOT_ACTIVE' using errcode='42501';end if;
 end if;
 return new;
end;$$;
revoke all on function public.guard_active_classroom_group() from public,anon,authenticated;
grant execute on function public.guard_active_classroom_group() to service_role;
create trigger active_group_enrollment before insert or update on public.group_students for each row execute function public.guard_active_classroom_group();
create trigger active_group_session before insert on public.sessions for each row execute function public.guard_active_classroom_group();

-- Keep the checked assistant views in sync with the additive columns.
create or replace view public.assistant_delegated_students with (security_invoker=true,security_barrier=true) as select source.* from public.students source where public.assistant_delegated_row('students',to_jsonb(source)) with local check option;
create or replace view public.assistant_delegated_groups with (security_invoker=true,security_barrier=true) as select source.* from public.groups source where public.assistant_delegated_row('groups',to_jsonb(source)) with local check option;
revoke all on public.assistant_delegated_students,public.assistant_delegated_groups from public,anon,authenticated;
grant all on public.assistant_delegated_students,public.assistant_delegated_groups to service_role;
notify pgrst,'reload schema';
create or replace function public.assistant_delegated_rpc(p_name text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();k text;v jsonb;v_id text;p record;v_call text;v_result jsonb;v_groups uuid[];
begin
 if p_name not in ('classroom_operation','portal_tenant_context','assistant_invite','assistant_configure','assistant_registration_link','student_followup_report','student_collection_operation','portal_onboarding_claim_queue','portal_onboarding_claim_queue_limited','parent_family_limit') then raise exception 'FORBIDDEN';end if;
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
revoke execute on function public.assistant_delegated_rpc(text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_delegated_rpc(text,jsonb) to service_role;
notify pgrst,'reload schema';
