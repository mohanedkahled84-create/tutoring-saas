-- Published quiz removal is an archive. Submissions and recorded grades survive.
create function public.archive_quiz_definition(p_tenant uuid,p_user uuid,p_assistant uuid,p_reference text,p_delete boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare material public.study_materials;payload jsonb;legacy record;c jsonb;resource text;reference text;targets uuid[];
begin
 if length(coalesce(p_reference,'')) not between 1 and 120 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':academic_year',0));
 if not exists(select 1 from public.users u join public.tenants t on t.id=u.tenant_id where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner') and t.status='active' and t.deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into material from public.study_materials m where m.tenant_id=p_tenant and m.type in ('online_quiz','paper_quiz','paper_exam') and (m.id::text=p_reference or public.portal_parse_legacy_json(m.questions)->>'legacy_quiz_ref'=p_reference) order by (m.id::text=p_reference) desc limit 1 for update;
 if material.id is null then
  select i.*,public.portal_parse_legacy_json(i.message_body) definition into legacy from public.whatsapp_inbox i
   where (i.tenant_id=p_tenant or i.tenant_id is null) and i.phone like 'QUIZ_DEF_%' and upper(i.phone) not like '%DRAFT%'
    and public.portal_parse_legacy_json(i.message_body)->>'id'=p_reference
    and exists(select 1 from public.groups g where g.tenant_id=p_tenant and g.id::text=public.portal_parse_legacy_json(i.message_body)->>'group_id')
   order by (i.tenant_id=p_tenant) desc nulls last,i.created_at desc limit 1 for update of i;
  if legacy.id is null then raise exception 'QUIZ_NOT_FOUND' using errcode='P0002';end if;
  payload:=legacy.definition;targets:=array[(payload->>'group_id')::uuid];
 else payload:=public.portal_parse_legacy_json(material.questions);targets:=coalesce(material.group_ids,array[material.group_id]);end if;
 if jsonb_typeof(payload) is distinct from 'object' then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 resource:=case when material.type in ('paper_quiz','paper_exam') or payload->>'exam_mode'='paper' then 'paper-exams' else 'online-quizzes' end;
 if p_assistant is not null then
  c:=public.assistant_delegated_context();
  if c->>'tenant_id' is distinct from p_tenant::text or c->>'owner_id' is distinct from p_user::text or c->>'assistant_id' is distinct from p_assistant::text or c->>'resource' is distinct from resource or c->>'action' is distinct from (case when p_delete then 'delete' else 'edit' end) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if targets is null or array_position(targets,null) is not null then
   if not coalesce((c->>'all_groups')::boolean,false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  elsif exists(select 1 from unnest(targets) g where not public.assistant_delegated_group(g)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
 reference:=coalesce(payload->>'legacy_quiz_ref',p_reference);
 payload:=payload||jsonb_build_object('is_archived',true,'is_draft',true,'archived_at',coalesce(payload->>'archived_at',now()::text));
 if material.id is not null then update public.study_materials set questions=payload::text where id=material.id and tenant_id=p_tenant;end if;
 -- Retire matching legacy definitions too, otherwise the fallback could revive
 -- the same exam after its canonical material was archived.
 update public.whatsapp_inbox i set message_body=(public.portal_parse_legacy_json(i.message_body)||jsonb_build_object('is_archived',true,'is_draft',true))::text,status='draft',updated_at=now()
  where (i.tenant_id=p_tenant or i.tenant_id is null) and i.phone like 'QUIZ_DEF_%'
   and public.portal_parse_legacy_json(i.message_body)->>'id' in (reference,p_reference)
   and exists(select 1 from public.groups g where g.tenant_id=p_tenant and g.id::text=public.portal_parse_legacy_json(i.message_body)->>'group_id');
 return jsonb_build_object('success',true,'archived',true,'history_preserved',true,'id',coalesce(material.id::text,p_reference));
end;$$;
revoke all on function public.archive_quiz_definition(uuid,uuid,uuid,text,boolean) from public,anon,authenticated;
grant execute on function public.archive_quiz_definition(uuid,uuid,uuid,text,boolean) to service_role;

create or replace function public.assistant_delegated_rpc(p_name text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();k text;v jsonb;v_id text;p record;v_call text;v_result jsonb;v_groups uuid[];
begin
 if p_name not in ('archive_quiz_definition','announcement_operation','announcement_queue','classroom_operation','portal_tenant_context','assistant_invite','assistant_configure','assistant_registration_link','student_followup_report','student_collection_operation','portal_onboarding_claim_queue','portal_onboarding_claim_queue_limited','parent_family_limit') then raise exception 'FORBIDDEN';end if;
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
