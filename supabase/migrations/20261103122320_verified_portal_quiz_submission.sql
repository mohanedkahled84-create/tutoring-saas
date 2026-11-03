-- Definitions and marking keys come exclusively from the teacher's saved data.
-- Public callers cannot fabricate a quiz, choose a group or replace a result.
create function public.submit_portal_quiz_verified(p_student uuid,p_tenant uuid,p_reference text,p_answers jsonb,p_withdrawn boolean default false,p_reason text default null,p_elapsed integer default 0)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare student public.students;material public.study_materials;legacy record;payload jsonb;questions jsonb;question jsonb;answer jsonb;
 submission public.homework_submissions;result jsonb;notes jsonb;material_id uuid;group_id uuid;reference_id uuid;
 score numeric:=0;max_points numeric:=0;mcq_points numeric:=0;points numeric;correct_index integer;position integer:=0;essay boolean:=false;quiz_number integer;key text;saved_count integer;
 cairo_now timestamp:=now() at time zone 'Africa/Cairo';
begin
 if length(coalesce(p_reference,'')) not between 1 and 120 or jsonb_typeof(p_answers) is distinct from 'object' or pg_column_size(p_answers)>200000 or length(coalesce(p_reason,''))>500 or p_elapsed not between 0 and 86400 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':academic_year',0));
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
 select h.* into submission from public.homework_submissions h where h.material_id=material.id and h.student_id=p_student and h.tenant_id=p_tenant for update;
 if submission.id is not null then
  notes:=public.portal_parse_legacy_json(submission.teacher_notes);
  return jsonb_build_object('success',true,'already_submitted',true,'is_graded',submission.status='approved','has_essay',coalesce((notes->>'has_essay')::boolean,false),'score',coalesce(notes->'final_score',notes->'score'),'max_score',notes->'max_score','mcq_score',notes->'mcq_score','total_mcq_points',notes->'total_mcq_points','is_withdrawn',coalesce((notes->>'is_withdrawn')::boolean,false),'message','إجاباتك مسجلة بالفعل؛ لن يتم استبدال تسليمك السابق');
 end if;
 payload:=public.portal_parse_legacy_json(material.questions);
 questions:=payload->'questions';
 if payload is null or lower(coalesce(payload->>'exam_mode','online'))<>'online' or coalesce(payload->'is_draft','false'::jsonb) not in ('false'::jsonb,'null'::jsonb,'0'::jsonb,'""'::jsonb) or coalesce(payload->'is_archived','false'::jsonb) not in ('false'::jsonb,'null'::jsonb,'0'::jsonb,'""'::jsonb) or jsonb_typeof(questions) is distinct from 'array' or jsonb_array_length(questions) not between 1 and 500 then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 if (select count(distinct coalesce(nullif(q.value->>'id',''),(q.n-1)::text)) from jsonb_array_elements(questions) with ordinality q(value,n))<>jsonb_array_length(questions) then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 if nullif(payload->>'available_date','') is not null and ((payload->>'available_date')::date<>cairo_now::date)
  or nullif(payload->>'start_time','') is not null and cairo_now::time<(payload->>'start_time')::time
  or nullif(payload->>'end_time','') is not null and cairo_now::time>(payload->>'end_time')::time then raise exception 'QUIZ_OUTSIDE_SCHEDULE' using errcode='23514';end if;
 quiz_number:=coalesce(nullif(payload->>'quiz_number','')::integer,1);
 if quiz_number not between 1 and 10000 then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 if exists(select 1 from jsonb_each(p_answers) a where jsonb_typeof(a.value) not in ('string','number','null') or length(a.key)>100 or length(a.value::text)>10002 or not exists(select 1 from jsonb_array_elements(questions) with ordinality q(value,n) where a.key=coalesce(nullif(q.value->>'id',''),(q.n-1)::text))) then raise exception 'INVALID_ANSWERS' using errcode='22023';end if;
 for question in select value from jsonb_array_elements(questions) loop
  points:=coalesce(nullif(question->>'points','')::numeric,1);
  if points<0 or points>10000 or points='NaN'::numeric then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
  max_points:=max_points+points;key:=coalesce(nullif(question->>'id',''),position::text);answer:=p_answers->key;
  if question->>'type'='essay' then essay:=true;
  else
   correct_index:=coalesce(question->>'correct_index',question->>'correct')::integer;
   if correct_index is null or correct_index<0 or jsonb_typeof(question->'options') is distinct from 'array' or correct_index>=jsonb_array_length(question->'options') then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
   mcq_points:=mcq_points+points;
   if answer is not null and answer<>'null'::jsonb and coalesce(answer#>>'{}','')<>'' then
    if (answer#>>'{}') !~ '^[0-9]{1,2}$' or (answer#>>'{}')::integer>=jsonb_array_length(question->'options') then raise exception 'INVALID_ANSWERS' using errcode='22023';end if;
    if (answer#>>'{}')::integer=correct_index then score:=score+points;end if;
   end if;
  end if;
  position:=position+1;
 end loop;
 if max_points<=0 then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
 notes:=jsonb_build_object('material_id',material.id,'source_material_id',p_reference,'quiz_number',quiz_number,'group_id',group_id,'student_code',student.student_code,'student_name',student.name,'answers',p_answers,'mcq_score',score,'total_mcq_points',mcq_points,'max_score',max_points,'elapsed_seconds',p_elapsed,'is_withdrawn',p_withdrawn,'withdrawal_reason',p_reason,'has_essay',essay,'is_graded',not essay,'final_score',case when not essay then score else null end);
 insert into public.homework_submissions(tenant_id,material_id,student_id,file_name,status,teacher_notes,submitted_at) values(p_tenant,material.id,p_student,'online_quiz_'||quiz_number||'.json',case when essay then 'pending' else 'approved' end,notes::text,now());
 if not essay then
  insert into public.quiz_scores(tenant_id,group_id,quiz_number,student_id,score,max_score,note,idempotency_key,updated_at)
   values(p_tenant,group_id,quiz_number,p_student,score,max_points,'تصحيح إلكتروني من نموذج المدرس',p_tenant::text||':'||group_id::text||':'||p_student::text||':quiz-'||quiz_number,now())
   on conflict(idempotency_key) do update set score=excluded.score,max_score=excluded.max_score,note=excluded.note,updated_at=now() where public.quiz_scores.tenant_id=excluded.tenant_id and public.quiz_scores.student_id=excluded.student_id and public.quiz_scores.group_id=excluded.group_id;
  get diagnostics saved_count=row_count;
  if saved_count<>1 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
 return jsonb_build_object('success',true,'is_graded',not essay,'has_essay',essay,'is_withdrawn',p_withdrawn,'score',case when not essay then score else null end,'max_score',max_points,'mcq_score',score,'total_mcq_points',mcq_points,'message',case when essay then 'تم تسليم إجاباتك وبانتظار مراجعة المدرس للأسئلة المقالية' else 'تم تسليم الامتحان وتصحيحه بنجاح' end);
end;$$;
revoke all on function public.submit_portal_quiz_verified(uuid,uuid,text,jsonb,boolean,text,integer) from public,anon,authenticated;
grant execute on function public.submit_portal_quiz_verified(uuid,uuid,text,jsonb,boolean,text,integer) to service_role;

-- The canonical identity survives a normal teacher edit so an inbox-backed
-- virtual quiz does not reappear as a second, unsubmitted exam afterwards.
create function public.preserve_legacy_quiz_reference() returns trigger
language plpgsql security invoker set search_path='' as $$
declare original text:=public.portal_parse_legacy_json(old.questions)->>'legacy_quiz_ref';payload jsonb;
begin
 if original is not null then
  payload:=public.portal_parse_legacy_json(new.questions);
  if jsonb_typeof(payload) is distinct from 'object' then raise exception 'QUIZ_INVALID_DEFINITION' using errcode='23514';end if;
  new.questions:=(payload||jsonb_build_object('legacy_quiz_ref',original))::text;
 end if;
 return new;
end;$$;
revoke all on function public.preserve_legacy_quiz_reference() from public,anon,authenticated;
grant execute on function public.preserve_legacy_quiz_reference() to service_role;
create trigger preserve_legacy_quiz_reference before update of questions on public.study_materials for each row execute function public.preserve_legacy_quiz_reference();
