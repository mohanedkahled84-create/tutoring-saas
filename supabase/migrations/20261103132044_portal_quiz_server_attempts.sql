-- Server-owned attempts: one clock, immutable marking model, resumable answers.
create table public.portal_quiz_attempts(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,material_id uuid not null references public.study_materials(id) on delete cascade,
 group_id uuid not null references public.groups(id),source_reference text not null,
 definition jsonb not null,answers jsonb not null default '{}',revision integer not null default 0,
 started_at timestamptz not null default now(),expires_at timestamptz not null,saved_at timestamptz,
 finalized_at timestamptz,result jsonb,retry_after timestamptz,last_error text,
 unique(tenant_id,student_id,material_id),check(jsonb_typeof(answers)='object'),check(expires_at>started_at)
);
create index portal_quiz_attempts_expiry on public.portal_quiz_attempts(expires_at) where finalized_at is null;
alter table public.portal_quiz_attempts enable row level security;
revoke all on public.portal_quiz_attempts from public,anon,authenticated;
grant all on public.portal_quiz_attempts to service_role;

create function public.portal_quiz_saved_definition(p_student uuid,p_tenant uuid,p_reference text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare student public.students;material public.study_materials;legacy record;payload jsonb;material_id uuid;group_id uuid;reference_id uuid;
begin
 if length(coalesce(p_reference,'')) not between 1 and 120 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 perform pg_advisory_xact_lock_shared(hashtextextended(p_tenant::text||':academic_year',0));
 select s.* into student from public.students s join public.tenants t on t.id=s.tenant_id and t.status='active' and t.deleted_at is null where s.id=p_student and s.tenant_id=p_tenant and s.archived_at is null for share of s;
 if student.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_student::text||':quiz:'||p_reference,0));
 if p_reference ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
  reference_id:=p_reference::uuid;
  select * into material from public.study_materials where id=reference_id and tenant_id=p_tenant for share;
 end if;
 if material.id is null then
  -- An old virtual ID is valid only when its exact saved definition belongs
  -- to one of this student's active groups. Never infer it from a quiz number.
  select i.*,public.portal_parse_legacy_json(i.message_body) definition into legacy
   from public.whatsapp_inbox i where (i.tenant_id=p_tenant or i.tenant_id is null) and i.phone like 'QUIZ_DEF_%'
   and i.status is distinct from 'draft' and upper(i.phone) not like '%DRAFT%'
   and public.portal_parse_legacy_json(i.message_body)->>'id'=p_reference
   and exists(select 1 from public.groups g where g.tenant_id=p_tenant and g.id::text=public.portal_parse_legacy_json(i.message_body)->>'group_id'
    and public.portal_group_in_current_year(g.id,p_tenant) and (g.id=student.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=student.id and gs.group_id=g.id)))
   order by (i.tenant_id=p_tenant) desc nulls last,i.created_at desc limit 1 for share of i;
  if legacy.id is null then raise exception 'QUIZ_NOT_FOUND' using errcode='P0002';end if;
  payload:=legacy.definition;
  if coalesce(payload->'is_draft','false'::jsonb) not in ('false'::jsonb,'null'::jsonb,'0'::jsonb,'""'::jsonb) or coalesce(payload->'is_archived','false'::jsonb) not in ('false'::jsonb,'null'::jsonb,'0'::jsonb,'""'::jsonb) or lower(coalesce(payload->>'exam_mode','online'))<>'online' then raise exception 'QUIZ_UNAVAILABLE' using errcode='23514';end if;
  material_id:=coalesce(reference_id,md5(p_tenant::text||':legacy-quiz:'||p_reference)::uuid);
  insert into public.study_materials(id,tenant_id,group_id,title,type,is_homework,questions)
   values(material_id,p_tenant,(payload->>'group_id')::uuid,left(coalesce(nullif(payload->>'title',''),'كويز أونلاين'),200),'online_quiz',false,(payload||jsonb_build_object('legacy_quiz_ref',p_reference))::text) on conflict(id) do nothing;
  select * into material from public.study_materials where id=material_id and tenant_id=p_tenant for share;
  if material.id is null or public.portal_parse_legacy_json(material.questions)->>'legacy_quiz_ref' is distinct from p_reference then raise exception 'QUIZ_REFERENCE_CONFLICT' using errcode='23514';end if;
 end if;
 if material.type<>'online_quiz' or not public.portal_material_in_current_year(material,p_tenant) or not public.material_targets_student(material,p_student,p_tenant) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select g.id into group_id from public.groups g where g.tenant_id=p_tenant and public.portal_group_in_current_year(g.id,p_tenant)
  and (g.id=student.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=p_student and gs.group_id=g.id))
  and (material.group_ids is null and material.group_id is null or case when material.group_ids is not null then g.id=any(material.group_ids) else g.id=material.group_id end)
  order by (g.id=student.group_id) desc,g.id limit 1;
 if group_id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_student::text||':quiz:'||material.id::text,0));

 return jsonb_build_object('material',to_jsonb(material),'group_id',group_id);
end;$$;

create function public.portal_quiz_mark_model(payload jsonb,p_answers jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare questions jsonb:=payload->'questions';question jsonb;answer jsonb;options jsonb;position integer:=0;key text;points numeric;correct_index integer;score numeric:=0;max_points numeric:=0;mcq_points numeric:=0;essay boolean:=false;
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
   correct_index:=coalesce(question->>'correct_index',question->>'correct',question->>'correct_answer')::integer;
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

create function public.portal_quiz_existing_result(p_student uuid,p_tenant uuid,p_material uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare submission public.homework_submissions;notes jsonb;
begin
 select * into submission from public.homework_submissions where material_id=p_material and student_id=p_student and tenant_id=p_tenant;
 if submission.id is null then return null;end if;
 notes:=public.portal_parse_legacy_json(submission.teacher_notes);
 return jsonb_build_object('success',true,'already_submitted',true,'is_graded',submission.status='approved','has_essay',coalesce((notes->>'has_essay')::boolean,false),'score',coalesce(notes->'final_score',notes->'score'),'max_score',notes->'max_score','mcq_score',notes->'mcq_score','total_mcq_points',notes->'total_mcq_points','is_withdrawn',coalesce((notes->>'is_withdrawn')::boolean,false),'message','إجاباتك مسجلة بالفعل؛ لن يتم استبدال تسليمك السابق');
end;$$;

create function public.portal_quiz_finalize_attempt(p_attempt uuid,p_withdrawn boolean default false,p_reason text default null) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare attempt public.portal_quiz_attempts;student public.students;mark jsonb;notes jsonb;quiz_number integer;v_result jsonb;saved_count integer;
begin
 select * into attempt from public.portal_quiz_attempts where id=p_attempt for update;
 if attempt.id is null then raise exception 'QUIZ_NOT_STARTED' using errcode='23514';end if;
 if not exists(select 1 from public.tenants where id=attempt.tenant_id and status='active' and deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if attempt.finalized_at is not null then return attempt.result||jsonb_build_object('already_submitted',true);end if;
 perform pg_advisory_xact_lock(hashtextextended(attempt.tenant_id::text||':'||attempt.student_id::text||':quiz:'||attempt.material_id::text,0));
 v_result:=public.portal_quiz_existing_result(attempt.student_id,attempt.tenant_id,attempt.material_id);
 if v_result is null then
  select * into student from public.students where id=attempt.student_id and tenant_id=attempt.tenant_id;
  if student.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
  mark:=public.portal_quiz_mark_model(attempt.definition,attempt.answers);
  quiz_number:=coalesce(nullif(attempt.definition->>'quiz_number','')::integer,1);
  if quiz_number not between 1 and 10000 then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
  notes:=mark||jsonb_build_object('material_id',attempt.material_id,'source_material_id',attempt.source_reference,'quiz_number',quiz_number,'group_id',attempt.group_id,'student_code',student.student_code,'student_name',student.name,'answers',attempt.answers,'elapsed_seconds',greatest(0,extract(epoch from least(now(),attempt.expires_at)-attempt.started_at)::integer),'is_withdrawn',p_withdrawn,'withdrawal_reason',p_reason,'final_score',mark->'score','attempt_id',attempt.id);
  insert into public.homework_submissions(tenant_id,material_id,student_id,file_name,status,teacher_notes,submitted_at) values(attempt.tenant_id,attempt.material_id,attempt.student_id,'online_quiz_'||quiz_number||'.json',case when (mark->>'is_graded')::boolean then 'approved' else 'pending' end,notes::text,now());
  if (mark->>'is_graded')::boolean then
   insert into public.quiz_scores(tenant_id,group_id,quiz_number,student_id,score,max_score,note,idempotency_key,updated_at)
    values(attempt.tenant_id,attempt.group_id,quiz_number,attempt.student_id,(mark->>'score')::numeric,(mark->>'max_score')::numeric,'تصحيح إلكتروني من نموذج المدرس',attempt.tenant_id::text||':'||attempt.group_id::text||':'||attempt.student_id::text||':quiz-'||quiz_number,now())
    on conflict(idempotency_key) do update set score=excluded.score,max_score=excluded.max_score,note=excluded.note,updated_at=now() where public.quiz_scores.tenant_id=excluded.tenant_id and public.quiz_scores.student_id=excluded.student_id and public.quiz_scores.group_id=excluded.group_id;
   get diagnostics saved_count=row_count;if saved_count<>1 then raise exception 'FORBIDDEN' using errcode='42501';end if;
  end if;
  v_result:=mark||jsonb_build_object('success',true,'is_withdrawn',p_withdrawn,'expired',now()>attempt.expires_at,'message',case when (mark->>'has_essay')::boolean then 'تم تسليم إجاباتك وبانتظار مراجعة المدرس للأسئلة المقالية' else 'تم تسليم الامتحان وتصحيحه بنجاح' end);
 end if;
 update public.portal_quiz_attempts set finalized_at=now(),result=v_result,retry_after=null,last_error=null where id=attempt.id;
 return v_result;
end;$$;

create function public.portal_quiz_start(p_student uuid,p_tenant uuid,p_reference text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare saved jsonb;payload jsonb;material public.study_materials;attempt public.portal_quiz_attempts;result jsonb;deadline timestamptz;minutes numeric;closing timestamptz;
begin
 if length(coalesce(p_reference,'')) not between 1 and 120 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 if not exists(select 1 from public.students s join public.tenants t on t.id=s.tenant_id and t.status='active' and t.deleted_at is null where s.id=p_student and s.tenant_id=p_tenant and s.archived_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock_shared(hashtextextended(p_tenant::text||':academic_year',0));
 select * into attempt from public.portal_quiz_attempts where student_id=p_student and tenant_id=p_tenant and (source_reference=p_reference or material_id::text=p_reference or definition->>'legacy_quiz_ref'=p_reference) order by started_at limit 1 for update;
 if attempt.id is null then
  saved:=public.portal_quiz_saved_definition(p_student,p_tenant,p_reference);
  material:=jsonb_populate_record(null::public.study_materials,saved->'material');payload:=public.portal_parse_legacy_json(material.questions);
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':'||p_student::text||':quiz:'||material.id::text,0));
  select * into attempt from public.portal_quiz_attempts where student_id=p_student and tenant_id=p_tenant and material_id=material.id for update;
  if attempt.id is null then
   result:=public.portal_quiz_existing_result(p_student,p_tenant,material.id);
   if result is not null then return jsonb_build_object('submitted',true,'result',result,'server_now',now());end if;
   if payload is null or lower(coalesce(payload->>'exam_mode','online'))<>'online' or coalesce(payload->'is_draft','false'::jsonb) not in ('false'::jsonb,'null'::jsonb,'0'::jsonb,'""'::jsonb) or coalesce(payload->'is_archived','false'::jsonb) not in ('false'::jsonb,'null'::jsonb,'0'::jsonb,'""'::jsonb) then raise exception 'QUIZ_UNAVAILABLE' using errcode='23514';end if;
   if nullif(payload->>'available_date','') is not null and (payload->>'available_date')::date<>(now() at time zone 'Africa/Cairo')::date
    or nullif(payload->>'start_time','') is not null and (now() at time zone 'Africa/Cairo')::time<(payload->>'start_time')::time
    or nullif(payload->>'end_time','') is not null and (now() at time zone 'Africa/Cairo')::time>(payload->>'end_time')::time then raise exception 'QUIZ_OUTSIDE_SCHEDULE' using errcode='23514';end if;
   perform public.portal_quiz_mark_model(payload,'{}');
   minutes:=coalesce(nullif(payload->>'time_limit_minutes','')::numeric,20);
   if minutes<1 or minutes>1440 or minutes='NaN'::numeric then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
   deadline:=now()+make_interval(secs=>(minutes*60)::double precision);
   if nullif(payload->>'end_time','') is not null then closing:=(((now() at time zone 'Africa/Cairo')::date+(payload->>'end_time')::time) at time zone 'Africa/Cairo');deadline:=least(deadline,closing);end if;
   insert into public.portal_quiz_attempts(tenant_id,student_id,material_id,group_id,source_reference,definition,expires_at)
    values(p_tenant,p_student,material.id,(saved->>'group_id')::uuid,p_reference,payload,deadline) returning * into attempt;
  end if;
 end if;
 if attempt.finalized_at is not null then return jsonb_build_object('submitted',true,'result',attempt.result,'definition',attempt.definition,'answers',attempt.answers,'material_id',attempt.material_id,'server_now',now());end if;
 if now()>=attempt.expires_at then result:=public.portal_quiz_finalize_attempt(attempt.id);return jsonb_build_object('submitted',true,'result',result,'definition',attempt.definition,'answers',attempt.answers,'material_id',attempt.material_id,'server_now',now());end if;
 return jsonb_build_object('attempt_id',attempt.id,'material_id',attempt.material_id,'definition',attempt.definition,'answers',attempt.answers,'revision',attempt.revision,'started_at',attempt.started_at,'expires_at',attempt.expires_at,'server_now',now());
end;$$;

create function public.portal_quiz_save(p_student uuid,p_tenant uuid,p_attempt uuid,p_answers jsonb,p_revision integer) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare attempt public.portal_quiz_attempts;result jsonb;
begin
 if not exists(select 1 from public.students s join public.tenants t on t.id=s.tenant_id and t.status='active' and t.deleted_at is null where s.id=p_student and s.tenant_id=p_tenant and s.archived_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into attempt from public.portal_quiz_attempts where id=p_attempt and student_id=p_student and tenant_id=p_tenant for update;
 if attempt.id is null then raise exception 'QUIZ_NOT_STARTED' using errcode='23514';end if;
 if attempt.finalized_at is not null then return jsonb_build_object('submitted',true,'result',attempt.result,'server_now',now());end if;
 if now()>=attempt.expires_at then result:=public.portal_quiz_finalize_attempt(attempt.id);return jsonb_build_object('submitted',true,'result',result,'server_now',now());end if;
 if attempt.revision=p_revision+1 and attempt.answers=p_answers then return jsonb_build_object('revision',attempt.revision,'saved_at',attempt.saved_at,'expires_at',attempt.expires_at,'server_now',now());end if;
 if attempt.revision<>p_revision then raise exception 'QUIZ_REVISION_CHANGED' using errcode='23514';end if;
 perform public.portal_quiz_mark_model(attempt.definition,p_answers);
 update public.portal_quiz_attempts set answers=p_answers,revision=revision+1,saved_at=now() where id=attempt.id returning revision into p_revision;
 return jsonb_build_object('revision',p_revision,'saved_at',now(),'expires_at',attempt.expires_at,'server_now',now());
end;$$;

create or replace function public.submit_portal_quiz_verified(p_student uuid,p_tenant uuid,p_reference text,p_answers jsonb,p_withdrawn boolean default false,p_reason text default null,p_elapsed integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare attempt public.portal_quiz_attempts;result jsonb;material_id uuid;
begin
 if length(coalesce(p_reference,'')) not between 1 and 120 or length(coalesce(p_reason,''))>500 or p_elapsed not between 0 and 86400 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 if not exists(select 1 from public.students s join public.tenants t on t.id=s.tenant_id and t.status='active' and t.deleted_at is null where s.id=p_student and s.tenant_id=p_tenant and s.archived_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into attempt from public.portal_quiz_attempts where student_id=p_student and tenant_id=p_tenant and (source_reference=p_reference or public.portal_quiz_attempts.material_id::text=p_reference or definition->>'legacy_quiz_ref'=p_reference) order by started_at limit 1 for update;
 if attempt.id is null then
  select id into material_id from public.study_materials where tenant_id=p_tenant and (id::text=p_reference or public.portal_parse_legacy_json(questions)->>'legacy_quiz_ref'=p_reference) limit 1;
  result:=public.portal_quiz_existing_result(p_student,p_tenant,material_id);
  if result is not null then return result;end if;
  raise exception 'QUIZ_NOT_STARTED' using errcode='23514';
 end if;
 if attempt.finalized_at is not null then return attempt.result||jsonb_build_object('already_submitted',true);end if;
 if now()<attempt.expires_at then
  perform public.portal_quiz_mark_model(attempt.definition,p_answers);
  update public.portal_quiz_attempts set answers=p_answers,revision=revision+1,saved_at=now() where id=attempt.id;
 end if;
 return public.portal_quiz_finalize_attempt(attempt.id,p_withdrawn,p_reason);
end;$$;

create function public.portal_quiz_finalize_expired(p_limit integer default 50) returns integer
language plpgsql security invoker set search_path='' as $$
declare attempt record;total integer:=0;
begin
 for attempt in select a.id from public.portal_quiz_attempts a join public.tenants t on t.id=a.tenant_id and t.status='active' and t.deleted_at is null where a.finalized_at is null and a.expires_at<now()-interval '10 seconds' and (a.retry_after is null or a.retry_after<now()) order by a.expires_at limit least(greatest(p_limit,1),100) for update of a skip locked loop
  begin perform public.portal_quiz_finalize_attempt(attempt.id);total:=total+1;
  exception when others then update public.portal_quiz_attempts set last_error=sqlstate,retry_after=now()+interval '5 minutes' where id=attempt.id;end;
 end loop;
 return total;
end;$$;

-- A live/saved attempt must keep the questions and marking rules it started
-- with. Scheduling/archiving remains editable; use a new quiz to change questions.
create function public.preserve_attempted_quiz_model() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.portal_quiz_attempts where material_id=old.id and tenant_id=old.tenant_id) then
  if tg_op='DELETE' then
   if exists(select 1 from public.tenants where id=old.tenant_id and status='active' and deleted_at is null) then raise exception 'QUIZ_HAS_ATTEMPTS_ARCHIVE_INSTEAD' using errcode='23514';end if;
   return old;
  end if;
  if public.portal_parse_legacy_json(new.questions)->'questions' is distinct from public.portal_parse_legacy_json(old.questions)->'questions'
   or public.portal_parse_legacy_json(new.questions)->'quiz_number' is distinct from public.portal_parse_legacy_json(old.questions)->'quiz_number' then raise exception 'QUIZ_HAS_ATTEMPTS_COPY_INSTEAD' using errcode='23514';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end;$$;
create trigger preserve_attempted_quiz_model before update of questions or delete on public.study_materials for each row execute function public.preserve_attempted_quiz_model();

revoke all on function public.portal_quiz_saved_definition(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_quiz_saved_definition(uuid,uuid,text) to service_role;

revoke all on function public.portal_quiz_mark_model(jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.portal_quiz_mark_model(jsonb,jsonb) to service_role;

revoke all on function public.portal_quiz_existing_result(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.portal_quiz_existing_result(uuid,uuid,uuid) to service_role;

revoke all on function public.portal_quiz_finalize_attempt(uuid,boolean,text) from public,anon,authenticated;
grant execute on function public.portal_quiz_finalize_attempt(uuid,boolean,text) to service_role;

revoke all on function public.portal_quiz_start(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_quiz_start(uuid,uuid,text) to service_role;

revoke all on function public.portal_quiz_save(uuid,uuid,uuid,jsonb,integer) from public,anon,authenticated;
grant execute on function public.portal_quiz_save(uuid,uuid,uuid,jsonb,integer) to service_role;

revoke all on function public.submit_portal_quiz_verified(uuid,uuid,text,jsonb,boolean,text,integer) from public,anon,authenticated;
grant execute on function public.submit_portal_quiz_verified(uuid,uuid,text,jsonb,boolean,text,integer) to service_role;

revoke all on function public.portal_quiz_finalize_expired(integer) from public,anon,authenticated;
grant execute on function public.portal_quiz_finalize_expired(integer) to service_role;

revoke all on function public.preserve_attempted_quiz_model() from public,anon,authenticated;
grant execute on function public.preserve_attempted_quiz_model() to service_role;
