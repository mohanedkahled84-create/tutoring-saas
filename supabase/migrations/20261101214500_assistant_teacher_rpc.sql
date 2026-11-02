create function public.assistant_delegated_rpc(p_name text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();k text;v jsonb;v_id text;p record;v_call text;v_result jsonb;v_groups uuid[];
begin
 if p_name not in ('portal_tenant_context','assistant_invite','assistant_configure','assistant_registration_link','student_followup_report','student_collection_operation','portal_onboarding_claim_queue','parent_family_limit') then raise exception 'FORBIDDEN';end if;
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
 if p_name='portal_onboarding_claim_queue' and (c->>'resource'<>'students' or c->>'action'<>'send' or not exists(select 1 from public.meta_portal_dispatch_queue q where q.id=(p_args->>'p_queue_id')::uuid and q.tenant_id=c->>'tenant_id' and public.assistant_delegated_student(q.student_id))) then raise exception 'FORBIDDEN';end if;
 if p_name='assistant_invite' and c->>'teacher_id' is not null and p_args->>'p_teacher' is distinct from c->>'teacher_id' then raise exception 'FORBIDDEN';end if;
 if p_name='student_followup_report' and c->>'resource' not in ('reports','messages') then raise exception 'FORBIDDEN';end if;
 if p_name='student_collection_operation' then
  if p_args->>'p_action'='void' or (p_args->>'p_action'<>'view' and c->>'action' not in ('collect','create')) then raise exception 'FORBIDDEN';end if;
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
