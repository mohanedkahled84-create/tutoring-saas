create or replace function public.portal_quiz_mark_model(payload jsonb,p_answers jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare questions jsonb:=payload->'questions';question jsonb;answer jsonb;options jsonb;position integer:=0;key text;points numeric;correct_index integer;raw_correct text;score numeric:=0;max_points numeric:=0;mcq_points numeric:=0;essay boolean:=false;
begin
 if jsonb_typeof(p_answers) is distinct from 'object' or pg_column_size(p_answers)>200000 then raise exception 'INVALID_ANSWERS' using errcode='22023';end if;
 if jsonb_typeof(questions) is distinct from 'array' or jsonb_array_length(questions) not between 1 and 500 then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 if (select count(distinct coalesce(nullif(q.value->>'id',''),(q.n-1)::text)) from jsonb_array_elements(questions) with ordinality q(value,n))<>jsonb_array_length(questions) then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 if exists(select 1 from jsonb_each(p_answers) a where jsonb_typeof(a.value) not in ('string','number','null') or length(a.key)>100 or length(a.value::text)>10002 or not exists(select 1 from jsonb_array_elements(questions) with ordinality q(value,n) where a.key=coalesce(nullif(q.value->>'id',''),(q.n-1)::text) or a.key=(q.n-1)::text)) then raise exception 'INVALID_ANSWERS' using errcode='22023';end if;
 for question in select value from jsonb_array_elements(questions) loop
  points:=coalesce(nullif(question->>'points','')::numeric,1);
  if points<0 or points>10000 or points='NaN'::numeric then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
  max_points:=max_points+points;key:=coalesce(nullif(question->>'id',''),position::text);answer:=coalesce(p_answers->key,p_answers->position::text);
  if question->>'type'='essay' then essay:=true;
  else
   options:=coalesce(question->'options',question->'choices');
   if jsonb_typeof(options) is distinct from 'array' or jsonb_array_length(options) not between 2 and 100 or exists(select 1 from jsonb_array_elements(options) o where jsonb_typeof(o)<>'string' or length(btrim(o#>>'{}')) not between 1 and 10000) then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
   raw_correct:=coalesce(question->>'correct_index',question->>'correct',question->>'correct_answer');correct_index:=null;
   if raw_correct ~ '^[0-9]{1,2}$' then correct_index:=raw_correct::integer;
   elsif raw_correct is not null then
    if (select count(*) from jsonb_array_elements_text(options) o where o=raw_correct)=1 then
     select ordinality::integer-1 into correct_index from jsonb_array_elements_text(options) with ordinality where value=raw_correct;
    elsif raw_correct ~ '^[A-Za-z]$' then correct_index:=ascii(upper(raw_correct))-ascii('A');
    elsif raw_correct=any(array['أ','ا','ب','ج','د','هـ','و']) then correct_index:=case when raw_correct='ا' then 0 else array_position(array['أ','ب','ج','د','هـ','و'],raw_correct)-1 end;
    end if;
   end if;
   if correct_index is null or correct_index<0 or jsonb_typeof(options) is distinct from 'array' or correct_index>=jsonb_array_length(options) then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
   mcq_points:=mcq_points+points;
   if answer is not null and answer<>'null'::jsonb and coalesce(answer#>>'{}','')<>'' then
    if (answer#>>'{}') !~ '^[0-9]{1,2}$' or (answer#>>'{}')::integer>=jsonb_array_length(options) then raise exception 'INVALID_ANSWERS' using errcode='22023';end if;
    if (answer#>>'{}')::integer=correct_index then score:=score+points;end if;
   end if;
  end if;
  position:=position+1;
 end loop;
 if max_points<=0 then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;

 return jsonb_build_object('score',case when not essay then score else null end,'mcq_score',score,'max_score',max_points,'total_mcq_points',mcq_points,'has_essay',essay,'is_graded',not essay);
end;$$;

-- Publish selected groups atomically, independently of manual quiz numbering.
create function public.publish_online_quiz(p_tenant uuid,p_user uuid,p_assistant uuid,p_data jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.users;context jsonb;definition jsonb:=p_data->'definition';targets jsonb:=p_data->'targets';target jsonb;gr public.groups;material public.study_materials;payload jsonb;mark jsonb;result jsonb:='[]';scope_teacher uuid;duration integer;number integer;target_id uuid;target_group uuid;v_title text;v_subject text;existing boolean;unchanged boolean;capability text;
begin
 select u.* into actor from public.users u join public.tenants t on t.id=u.tenant_id and t.status='active' and t.deleted_at is null where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner');
 if actor.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if actor.role='teacher' then scope_teacher:=actor.teacher_id;if scope_teacher is null then select id into scope_teacher from public.teachers where user_id=p_user and tenant_id=p_tenant limit 1;end if;end if;
 if p_assistant is not null then
  context:=public.assistant_delegated_context();
  if context->>'tenant_id' is distinct from p_tenant::text or context->>'owner_id' is distinct from p_user::text or context->>'assistant_id' is distinct from p_assistant::text or context->>'resource' is distinct from 'online-quizzes' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
 if jsonb_typeof(definition) is distinct from 'object' or jsonb_typeof(targets) is distinct from 'array' or jsonb_array_length(targets) not between 1 and 200 or pg_column_size(p_data)>5000000 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 if (select count(distinct value->>'id') from jsonb_array_elements(targets))<>jsonb_array_length(targets) or (select count(distinct value->>'group_id') from jsonb_array_elements(targets))<>jsonb_array_length(targets) then raise exception 'INVALID_GROUP_TARGETS' using errcode='22023';end if;
 v_title:=btrim(definition->>'title');v_subject:=btrim(coalesce(definition->>'subject',''));
 duration:=coalesce(nullif(definition->>'time_limit_minutes','')::integer,20);number:=(definition->>'quiz_number')::integer;
 if v_title is null or length(v_title) not between 1 and 200 or length(v_subject)>100 or duration not between 1 and 240 or number is null or number not between 1 and 10000 then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 if nullif(definition->>'available_date','') is not null then perform (definition->>'available_date')::date;end if;
 if exists(select 1 from jsonb_each(definition) x where x.key in ('start_time','end_time') and nullif(x.value#>>'{}','') is not null and (x.value#>>'{}')!~'^([01][0-9]|2[0-3]):[0-5][0-9]$') then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 payload:=jsonb_build_object('quiz_number',number,'subject',v_subject,'time_limit_minutes',duration,'available_date',nullif(definition->>'available_date',''),'start_time',nullif(definition->>'start_time',''),'end_time',nullif(definition->>'end_time',''),'exam_mode','online','questions',definition->'questions');
 mark:=public.portal_quiz_mark_model(payload,'{}');
 if (mark->>'max_score')::numeric<=0 or (mark->>'max_score')::numeric>10000 then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 perform pg_advisory_xact_lock_shared(hashtextextended(p_tenant::text||':academic_year',0));
 -- Consistent group lock order prevents overlapping batches deadlocking.
 for target in select value from jsonb_array_elements(targets) order by value->>'group_id' loop
  target_id:=(target->>'id')::uuid;target_group:=(target->>'group_id')::uuid;
  if target_id is null or target_group is null then raise exception 'INVALID_GROUP_TARGETS' using errcode='22023';end if;
  select * into gr from public.groups where id=target_group and tenant_id=p_tenant for share;
  if gr.id is null or not public.portal_group_in_current_year(gr.id,p_tenant) or scope_teacher is not null and gr.teacher_id is not null and scope_teacher<>gr.teacher_id or p_assistant is not null and not public.assistant_delegated_group(gr.id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':quiz_publish:'||gr.id::text,0));
  select * into material from public.study_materials where id=target_id for update;existing:=found;
  if existing and (material.tenant_id<>p_tenant or material.group_id<>gr.id or material.type<>'online_quiz' or public.portal_parse_legacy_json(material.questions)->>'exam_mode'='paper' or material.group_ids is not null and material.group_ids<>array[gr.id]) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if existing and (public.portal_parse_legacy_json(material.questions)->>'is_archived'='true' or public.portal_parse_legacy_json(material.questions)->>'is_draft'='true') then raise exception 'QUIZ_ARCHIVED_COPY_INSTEAD' using errcode='23514';end if;
  unchanged:=existing and material.title=v_title and coalesce(material.description,'')=v_subject and (public.portal_parse_legacy_json(material.questions)-'legacy_quiz_ref')=payload;
  capability:=case when unchanged then 'online-quizzes.view' when existing then 'online-quizzes.edit' else 'online-quizzes.create' end;
  if p_assistant is not null and context->'permissions'->>capability is distinct from 'true' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if existing and not unchanged then
   update public.study_materials set title=v_title,description=v_subject,questions=payload::text where id=target_id and tenant_id=p_tenant returning * into material;
  elsif not existing then
   insert into public.study_materials(id,tenant_id,group_id,title,description,type,is_homework,questions) values(target_id,p_tenant,gr.id,v_title,v_subject,'online_quiz',false,payload::text) returning * into material;
  end if;
  result:=result||jsonb_build_array(payload||jsonb_build_object('id',material.id,'group_id',gr.id,'title',material.title,'created_at',material.created_at,'max_score',mark->'max_score'));
 end loop;
 return jsonb_build_object('success',true,'quizzes',result,'quiz',result->0,'notifications_dispatched',0);
end;$$;
revoke all on function public.publish_online_quiz(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.publish_online_quiz(uuid,uuid,uuid,jsonb) to service_role;

create or replace function public.assistant_delegated_rpc(p_name text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();k text;v jsonb;v_id text;p record;v_call text;v_result jsonb;v_groups uuid[];
begin
 if p_name not in ('publish_online_quiz','grade_portal_quiz_essay','session_schedule_change','archive_quiz_definition','announcement_operation','announcement_queue','classroom_operation','portal_tenant_context','assistant_invite','assistant_configure','assistant_registration_link','student_followup_report','student_collection_operation','portal_onboarding_claim_queue','portal_onboarding_claim_queue_limited','parent_family_limit') then raise exception 'FORBIDDEN';end if;
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
