-- Online results belong to a saved material, never to the display quiz number.
-- Leave ambiguous historical records untouched.
alter table public.quiz_scores add column material_id uuid references public.study_materials(id) on delete cascade;
create unique index quiz_scores_online_result on public.quiz_scores(tenant_id,student_id,material_id) where material_id is not null;
create index quiz_scores_material_idx on public.quiz_scores(material_id) where material_id is not null;
create or replace function public.portal_quiz_finalize_attempt(p_attempt uuid,p_withdrawn boolean default false,p_reason text default null) returns jsonb
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
   insert into public.quiz_scores(tenant_id,group_id,quiz_number,student_id,score,max_score,note,idempotency_key,updated_at,material_id)
    values(attempt.tenant_id,attempt.group_id,quiz_number,attempt.student_id,(mark->>'score')::numeric,(mark->>'max_score')::numeric,'تصحيح إلكتروني من نموذج المدرس',attempt.tenant_id::text||':'||attempt.student_id::text||':material:'||attempt.material_id::text,now(),attempt.material_id)
    on conflict(idempotency_key) do update set score=excluded.score,max_score=excluded.max_score,note=excluded.note,updated_at=now() where public.quiz_scores.tenant_id=excluded.tenant_id and public.quiz_scores.student_id=excluded.student_id and public.quiz_scores.group_id=excluded.group_id and public.quiz_scores.material_id=excluded.material_id;
   get diagnostics saved_count=row_count;if saved_count<>1 then raise exception 'FORBIDDEN' using errcode='42501';end if;
  end if;
  v_result:=mark||jsonb_build_object('success',true,'is_withdrawn',p_withdrawn,'expired',now()>attempt.expires_at,'message',case when (mark->>'has_essay')::boolean then 'تم تسليم إجاباتك وبانتظار مراجعة المدرس للأسئلة المقالية' else 'تم تسليم الامتحان وتصحيحه بنجاح' end);
 end if;
 update public.portal_quiz_attempts set finalized_at=now(),result=v_result,retry_after=null,last_error=null where id=attempt.id;
 return v_result;
end;$$;
create or replace function public.assistant_grades(p_token_hash text,p_origin text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 a public.assistant_accounts;s public.assistants;q public.quizzes;ids uuid[];
 choices jsonb;rows jsonb;v_quiz uuid;v_student uuid;v_id uuid;v_score numeric;v_key text;
begin
 select ac.* into a from public.assistant_accounts ac join public.assistant_sessions ss on ss.assistant_id=ac.assistant_id
 where ss.token_hash=p_token_hash and ss.origin=p_origin and ss.expires_at>now() and ss.credential_version=ac.credential_version for share of ac;
 if not found then raise exception 'UNAUTHORIZED';end if;
 select * into s from public.assistants where id=a.assistant_id and tenant_id=a.tenant_id and status='active' for share;
 if not found or not exists(select 1 from public.tenants t where t.id=a.tenant_id and t.status='active' and t.deleted_at is null) then raise exception 'UNAUTHORIZED';end if;
 if p_action not in ('view','edit') or coalesce(a.permissions->>'grades.view','false')<>'true'
  or coalesce(a.permissions->>('grades.'||p_action),'false')<>'true' then raise exception 'FORBIDDEN';end if;
 select coalesce(array_agg(g.id),'{}') into ids from public.groups g where g.tenant_id=a.tenant_id
  and (a.all_groups or g.id=any(a.group_ids)) and (s.teacher_id is null or g.teacher_id is null or g.teacher_id=s.teacher_id);
 v_quiz:=nullif(p_data->>'quiz_id','')::uuid;
 if p_action='view' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into choices from
   (select id,group_id,title,quiz_number,max_score,is_skipped from public.quizzes where tenant_id=a.tenant_id and group_id=any(ids) order by quiz_date desc nulls last,id limit 500) x;
  if v_quiz is null then v_quiz:=(choices->0->>'id')::uuid;end if;
  if v_quiz is null then return jsonb_build_object('rows','[]'::jsonb,'quizzes',choices,'quiz_id',null,'limit',500);end if;
 end if;
 select * into q from public.quizzes where id=v_quiz and tenant_id=a.tenant_id and group_id=any(ids) for share;
 if not found then raise exception 'FORBIDDEN';end if;
 if p_action='view' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select st.id as student_id,st.name as student_name,q.id as quiz_id,q.group_id,q.quiz_number,q.max_score,q.is_skipped,
    sc.id,sc.score,sc.note
   from public.students st left join public.quiz_scores sc on sc.tenant_id=a.tenant_id and sc.student_id=st.id
    and sc.group_id=q.group_id and sc.quiz_number=q.quiz_number and sc.material_id is null
   where st.tenant_id=a.tenant_id and (st.group_id=q.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=a.tenant_id and gs.student_id=st.id and gs.group_id=q.group_id))
   order by st.name,st.id limit 500
  ) x;
  return jsonb_build_object('rows',rows,'quizzes',choices,'quiz_id',q.id,'limit',500);
 end if;
 if q.is_skipped then raise exception 'INVALID_INPUT';end if;
 v_student:=(p_data->>'student_id')::uuid;v_score:=(p_data->>'score')::numeric;
 if v_score is null or v_score<0 or v_score>q.max_score or v_score::text in ('NaN','Infinity','-Infinity') or length(coalesce(p_data->>'note',''))>2000 then raise exception 'INVALID_INPUT';end if;
 perform 1 from public.students st where st.id=v_student and st.tenant_id=a.tenant_id
  and (st.group_id=q.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=a.tenant_id and gs.student_id=st.id and gs.group_id=q.group_id)) for share;
 if not found then raise exception 'FORBIDDEN';end if;
 perform set_config('app.centerly_assistant_session',p_token_hash,true);
 perform set_config('app.centerly_assistant_origin',p_origin,true);
 v_key:=a.tenant_id::text||':'||q.group_id::text||':'||v_student::text||':quiz-'||q.quiz_number::text;
 insert into public.quiz_scores as sc(tenant_id,student_id,quiz_id,group_id,quiz_number,score,max_score,note,idempotency_key)
 values(a.tenant_id,v_student,q.id,q.group_id,q.quiz_number,v_score,q.max_score,coalesce(p_data->>'note',''),v_key)
 on conflict(idempotency_key) do update set score=excluded.score,max_score=excluded.max_score,note=excluded.note,
  quiz_id=excluded.quiz_id,updated_at=now(),delivery_status=case when sc.score is distinct from excluded.score or sc.note is distinct from excluded.note then 'pending' else sc.delivery_status end
 where sc.tenant_id=a.tenant_id and sc.group_id=q.group_id and sc.student_id=v_student and sc.quiz_number=q.quiz_number
 returning id into v_id;
 if v_id is null then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('id',v_id);
end;$$;
CREATE OR REPLACE FUNCTION public.student_followup_report(p_tenant uuid, p_groups uuid[], p_data jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
 g public.groups;st public.students;v_group uuid:=nullif(p_data->>'group_id','')::uuid;
 v_student uuid:=nullif(p_data->>'student_id','')::uuid;
 v_from date:=coalesce(nullif(p_data->>'from','')::date,date_trunc('month',now() at time zone 'Africa/Cairo')::date);
 v_to date:=coalesce(nullif(p_data->>'to','')::date,(now() at time zone 'Africa/Cairo')::date);
 v_page integer:=coalesce((p_data->>'page')::integer,1);v_rows jsonb;v_count integer;v_att jsonb;v_grades jsonb;v_hw jsonb;
begin
 if not exists(select 1 from public.tenants where id=p_tenant and status='active' and deleted_at is null) then raise exception 'UNAUTHORIZED';end if;
 if v_from>v_to or v_to-v_from>366 or v_page<1 or v_page>10000 then raise exception 'INVALID_INPUT';end if;
 if v_group is not null and not exists(select 1 from public.groups where id=v_group and tenant_id=p_tenant and id=any(p_groups)) then raise exception 'FORBIDDEN';end if;
 if v_student is null then
  select count(*) into v_count from public.students s join public.groups gr on gr.tenant_id=p_tenant and gr.id=any(p_groups)
   and (s.group_id=gr.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.group_id=gr.id and gs.student_id=s.id))
   where s.tenant_id=p_tenant and (v_group is null or gr.id=v_group) and (coalesce(p_data->>'q','')='' or position(lower(p_data->>'q') in lower(s.name||' '||coalesce(s.student_code,'')))>0);
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_rows from (
   select s.id as student_id,s.name as student_name,s.student_code,gr.id as group_id,gr.name as group_name
   from public.students s join public.groups gr on gr.tenant_id=p_tenant and gr.id=any(p_groups)
    and (s.group_id=gr.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.group_id=gr.id and gs.student_id=s.id))
   where s.tenant_id=p_tenant and (v_group is null or gr.id=v_group) and (coalesce(p_data->>'q','')='' or position(lower(p_data->>'q') in lower(s.name||' '||coalesce(s.student_code,'')))>0)
   order by s.name,s.id,gr.id limit 30 offset (v_page-1)*30
  ) x;
  return jsonb_build_object('rows',v_rows,'page',v_page,'has_more',v_count>v_page*30,'total',v_count,'from',v_from,'to',v_to);
 end if;
 select * into g from public.groups where id=v_group and tenant_id=p_tenant and id=any(p_groups);
 if not found then raise exception 'FORBIDDEN';end if;
 select * into st from public.students s where s.id=v_student and s.tenant_id=p_tenant and (s.group_id=g.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=s.id and gs.group_id=g.id));
 if not found then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object('total',count(*),'present',count(*) filter(where a.attended is true),'absent',count(*) filter(where a.attended is false),'unrecorded',count(*) filter(where a.attended is null)) into v_att
 from public.sessions se left join lateral (select at.attended from public.attendance at where at.tenant_id=p_tenant and at.session_id=se.id and at.student_id=st.id order by at.created_at desc,at.id desc limit 1) a on true
 where se.tenant_id=p_tenant and se.group_id=g.id and se.status='ended' and se.session_date between v_from and v_to;
 select jsonb_build_object('total',count(*),'recorded',count(sc.score),'unrecorded',count(*) filter(where sc.score is null),'latest',
  (select jsonb_build_object('title',q2.title,'score',sc2.score,'max_score',q2.max_score,'date',q2.quiz_date)
   from public.quizzes q2 join lateral (select sc.score from public.quiz_scores sc where sc.tenant_id=p_tenant and sc.group_id=g.id and sc.student_id=st.id and sc.quiz_number=q2.quiz_number and sc.material_id is null order by coalesce(sc.updated_at,sc.created_at) desc,sc.id desc limit 1) sc2 on true
   where q2.tenant_id=p_tenant and q2.group_id=g.id and not coalesce(q2.is_skipped,false) and q2.quiz_date between v_from and v_to and sc2.score is not null order by q2.quiz_date desc,q2.id desc limit 1)) into v_grades
 from public.quizzes q left join lateral (select qs.score from public.quiz_scores qs where qs.tenant_id=p_tenant and qs.group_id=g.id and qs.student_id=st.id and qs.quiz_number=q.quiz_number and qs.material_id is null order by coalesce(qs.updated_at,qs.created_at) desc,qs.id desc limit 1) sc on true
 where q.tenant_id=p_tenant and q.group_id=g.id and not coalesce(q.is_skipped,false) and q.quiz_date between v_from and v_to;
 select jsonb_build_object('total',count(*),'submitted',count(h.submitted_at),'late',count(*) filter(where m.due_date is not null and (h.submitted_at at time zone 'Africa/Cairo')::date>m.due_date),'on_time',count(*) filter(where m.due_date is not null and (h.submitted_at at time zone 'Africa/Cairo')::date<=m.due_date),'without_deadline',count(*) filter(where h.submitted_at is not null and m.due_date is null),'overdue',count(*) filter(where h.submitted_at is null and m.due_date<(now() at time zone 'Africa/Cairo')::date),'not_submitted',count(*) filter(where h.submitted_at is null)) into v_hw
 from public.study_materials m left join lateral (select hs.submitted_at from public.homework_submissions hs where hs.tenant_id=p_tenant and hs.material_id=m.id and hs.student_id=st.id order by hs.submitted_at desc limit 1) h on true
 where m.tenant_id=p_tenant and (case when m.group_ids is not null then g.id=any(m.group_ids) else m.group_id is null or m.group_id=g.id end) and m.is_homework and (m.created_at at time zone 'Africa/Cairo')::date between v_from and v_to;
 return jsonb_build_object('student_id',st.id,'student_name',st.name,'group_id',g.id,'group_name',g.name,'teacher_name',(select name from public.tenants where id=p_tenant),'from',v_from,'to',v_to,'attendance',v_att,'grades',v_grades,'homework',v_hw);
end;$function$;
CREATE OR REPLACE FUNCTION public.get_parent_portal_payload(p_token text, p_student_id uuid DEFAULT NULL::uuid, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  v_student record;
  v_group_name text;
  v_subject_name text;
  v_center_name text;
  v_teacher_id uuid;
  v_teacher_name text;
  v_tenant_name text;
  v_attendance json;
  v_quizzes json;
  v_materials json;
  v_attendance_stats record;
  v_quiz_stats record;
  v_result json;
BEGIN
  -- 1. Locate student either by (id, tenant_id) if verified by HMAC, or by parent_portal_token
  IF p_student_id IS NOT NULL AND p_tenant_id IS NOT NULL THEN
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, public.portal_active_group(s.id,s.tenant_id) AS group_id
    INTO v_student
    FROM students s
    WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Update parent_portal_token if needed
    IF FOUND AND p_token IS NOT NULL AND length(p_token) > 0 THEN
      UPDATE students
      SET parent_portal_token = p_token
      WHERE id = v_student.id AND (parent_portal_token IS NULL OR parent_portal_token = '');
    END IF;
  ELSE
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, public.portal_active_group(s.id,s.tenant_id) AS group_id
    INTO v_student
    FROM students s
    WHERE s.parent_portal_token = p_token
    LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch group, center name, and teacher
  IF v_student.group_id IS NOT NULL THEN
    SELECT g.name, g.center_name, g.teacher_id, g.subject INTO v_group_name, v_center_name, v_teacher_id, v_subject_name
    FROM groups g
    WHERE g.id = v_student.group_id;
  ELSE
    SELECT g.name, g.center_name, g.teacher_id, g.subject INTO v_group_name, v_center_name, v_teacher_id, v_subject_name
    FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE gs.student_id = v_student.id
    LIMIT 1;
  END IF;

  -- Resolve teacher name:
  -- Priority 1: linked teacher row
  IF v_teacher_id IS NOT NULL THEN
    SELECT t.name INTO v_teacher_name FROM teachers t WHERE t.id = v_teacher_id;
  END IF;

  -- Priority 2: first teacher in teachers table
  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT t.name INTO v_teacher_name FROM teachers t WHERE t.tenant_id = v_student.tenant_id LIMIT 1;
  END IF;

  -- Priority 3: user with role owner/teacher in public.users (clean personal name)
  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT u.full_name INTO v_teacher_name
    FROM public.users u
    WHERE u.tenant_id = v_student.tenant_id
      AND u.role IN ('owner', 'teacher')
      AND u.full_name IS NOT NULL
      AND u.full_name != ''
    ORDER BY u.created_at ASC
    LIMIT 1;
  END IF;

  -- Priority 4: tenant name with corporate/system suffixes stripped
  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT tn.name INTO v_tenant_name FROM tenants tn WHERE tn.id = v_student.tenant_id LIMIT 1;
    v_teacher_name := REGEXP_REPLACE(COALESCE(v_tenant_name, 'أستاذ المادة'), '\s*[-–—]\s*(منظومة|سنترلي|أكاديمية|سنتر).*$', '', 'i');
  END IF;

  -- Resolve subject name fallback if group had none
  IF v_subject_name IS NULL OR v_subject_name = '' THEN
    SELECT u.subject INTO v_subject_name
    FROM public.users u
    WHERE u.tenant_id = v_student.tenant_id
      AND u.subject IS NOT NULL
      AND u.subject != ''
    LIMIT 1;
  END IF;

  IF v_subject_name IS NULL OR v_subject_name = '' THEN
    SELECT tn.settings->>'subject' INTO v_subject_name
    FROM tenants tn
    WHERE tn.id = v_student.tenant_id;
  END IF;

  -- 3. Fetch attendance history
  SELECT json_agg(t) INTO v_attendance
  FROM (
    SELECT
      a.id,
      a.attended,
      a.comment,
      CASE
        WHEN a.attended = false THEN NULL
        ELSE a.homework_status
      END AS homework_status,
      a.created_at,
      COALESCE(s.session_number, 1) AS session_number,
      COALESCE(s.session_date::text, (a.created_at::date)::text) AS session_date
    FROM attendance a
    LEFT JOIN sessions s ON a.session_id = s.id
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id AND public.portal_group_in_current_year((select sx.group_id from public.sessions sx where sx.id=a.session_id and sx.tenant_id=a.tenant_id),v_student.tenant_id,(a.created_at at time zone 'Africa/Cairo')::date)
    ORDER BY a.created_at DESC
    LIMIT 25
  ) t;

  -- Attendance stats
  SELECT
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.attended = true)::int AS attended_count,
    COUNT(*) FILTER (WHERE a.attended = false)::int AS absent_count,
    COUNT(*) FILTER (WHERE a.attended = true AND a.homework_status IS NOT NULL)::int AS hw_total_count,
    COUNT(*) FILTER (WHERE a.attended = true AND a.homework_status IN ('done', 'completed', 'delivered'))::int AS hw_done_count
  INTO v_attendance_stats
  FROM attendance a
  WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id AND public.portal_group_in_current_year((select sx.group_id from public.sessions sx where sx.id=a.session_id and sx.tenant_id=a.tenant_id),v_student.tenant_id,(a.created_at at time zone 'Africa/Cairo')::date);

  -- 4. Fetch Quizzes & scores
  SELECT json_agg(q_row) INTO v_quizzes
  FROM (
    SELECT
      qs.id,
      qs.quiz_id,
      COALESCE(score_material.title,q.title, CASE WHEN qs.quiz_number IS NOT NULL THEN CONCAT('كويز ', qs.quiz_number::text) ELSE 'امتحان' END) AS title,
      COALESCE(q.quiz_date::text, (qs.created_at::date)::text) AS date,
      qs.score,
      COALESCE(qs.max_score, q.max_score, 20) AS max_score,
      qs.note,
      qs.note AS notes,
      ROUND((qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS percentage,
      CASE
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 85 THEN 'ممتاز'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 75 THEN 'جيد جداً'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 60 THEN 'جيد'
        ELSE 'يحتاج متابعة'
      END AS tier
    FROM quiz_scores qs
    LEFT JOIN quizzes q ON qs.quiz_id = q.id LEFT JOIN public.study_materials score_material ON score_material.id=qs.material_id AND score_material.tenant_id=qs.tenant_id
    WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id AND public.portal_group_in_current_year(coalesce(qs.group_id,q.group_id,(select sx.group_id from public.sessions sx where sx.id=qs.session_id and sx.tenant_id=qs.tenant_id)),v_student.tenant_id,(qs.created_at at time zone 'Africa/Cairo')::date)
    ORDER BY COALESCE(q.quiz_date::text, (qs.created_at::date)::text) DESC, qs.created_at DESC
    LIMIT 25
  ) q_row;

  -- Quiz stats
  SELECT
    COUNT(*)::int AS total_quizzes,
    ROUND(AVG(qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS avg_score
  INTO v_quiz_stats
  FROM quiz_scores qs
  LEFT JOIN quizzes q ON qs.quiz_id = q.id LEFT JOIN public.study_materials score_material ON score_material.id=qs.material_id AND score_material.tenant_id=qs.tenant_id
  WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id AND public.portal_group_in_current_year(coalesce(qs.group_id,q.group_id,(select sx.group_id from public.sessions sx where sx.id=qs.session_id and sx.tenant_id=qs.tenant_id)),v_student.tenant_id,(qs.created_at at time zone 'Africa/Cairo')::date);

  -- 5. Fetch Study Materials & Homework with student's submission status + book details
  SELECT json_agg(m_row) INTO v_materials
  FROM (
    SELECT
      m.id,
      m.title,
      m.description,
      m.type,
      m.url,
      m.is_homework,
      m.group_id, m.group_ids,
      public.material_targets_student(m,v_student.id,v_student.tenant_id) AS is_current_assignment,
      case when m.is_homework then public.homework_target_allowed(v_student.id,v_student.tenant_id,m.id) and public.homework_accepts_submission(m.id,v_student.tenant_id) else false end AS can_submit,
      COALESCE(m.due_date::text, '') AS due_date,
      COALESCE(m.created_at::date::text, '') AS created_date,
      COALESCE(hs.status, 'unsubmitted') AS submission_status,
      hs.file_url AS submission_url,
      hs.submitted_at::text AS submitted_at,
      hs.teacher_notes AS teacher_feedback,
      m.book_name,
      m.pages,
      m.questions
    FROM study_materials m
    LEFT JOIN homework_submissions hs ON hs.material_id = m.id AND hs.student_id = v_student.id
    WHERE m.tenant_id = v_student.tenant_id
      AND public.portal_material_in_current_year(m,v_student.tenant_id) AND (public.material_targets_student(m,v_student.id,v_student.tenant_id) OR EXISTS(select 1 from public.homework_submissions prior where prior.material_id=m.id and prior.student_id=v_student.id and prior.tenant_id=v_student.tenant_id))
    ORDER BY m.created_at DESC
    LIMIT 30
  ) m_row;

  -- 6. Build final JSON matching frontend exact contract
  v_result := json_build_object(
    'student', json_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'student_code', COALESCE(v_student.code, '—'),
      'group_name', COALESCE(v_group_name, 'مجموعة عامة'),
      'subject_name', COALESCE(v_subject_name, ''),
      'center_name', COALESCE(v_center_name, ''),
      'teacher_name', COALESCE(v_teacher_name, 'أستاذ المادة')
    ),
    'summary', json_build_object(
      'total_sessions', COALESCE(v_attendance_stats.total, 0),
      'attended_count', COALESCE(v_attendance_stats.attended_count, 0),
      'absent_count', COALESCE(v_attendance_stats.absent_count, 0),
      'attendance_rate', CASE WHEN COALESCE(v_attendance_stats.total, 0) > 0
        THEN CONCAT(ROUND((v_attendance_stats.attended_count::numeric / v_attendance_stats.total::numeric) * 100)::text, '%')
        ELSE '100%' END,
      'homework_done_count', COALESCE((
        SELECT COUNT(*)::int FROM homework_submissions hs2
        WHERE hs2.student_id = v_student.id AND hs2.tenant_id=v_student.tenant_id AND hs2.status = 'approved' AND EXISTS(select 1 from public.study_materials hm where hm.id=hs2.material_id and hm.tenant_id=v_student.tenant_id and public.material_targets_student(hm,v_student.id,v_student.tenant_id) and public.portal_material_in_current_year(hm,v_student.tenant_id))
      ), COALESCE(v_attendance_stats.hw_done_count, 0)),
      'homework_total_count', COALESCE((
        SELECT COUNT(*)::int FROM study_materials sm2
        WHERE sm2.tenant_id = v_student.tenant_id AND sm2.is_homework = true
          AND public.material_targets_student(sm2,v_student.id,v_student.tenant_id) AND public.portal_material_in_current_year(sm2,v_student.tenant_id)
      ), 0),
      'total_quizzes', COALESCE(v_quiz_stats.total_quizzes, 0),
      'quiz_average_percentage', CASE WHEN COALESCE(v_quiz_stats.total_quizzes, 0) > 0
        THEN CONCAT(ROUND(v_quiz_stats.avg_score)::text, '%')
        ELSE '—' END
    ),
    'sessions', COALESCE(v_attendance, '[]'::json),
    'quizzes', COALESCE(v_quizzes, '[]'::json),
    'materials', COALESCE(v_materials, '[]'::json),
    'last_updated', now()
  );

  RETURN (v_result::jsonb || jsonb_build_object('preferences',public.portal_preferences(v_student.tenant_id),'upcoming_sessions',public.portal_upcoming_sessions(v_student.id,v_student.tenant_id)))::json;
END;
$function$;
create or replace function public.assistant_delegated_rpc(p_name text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();k text;v jsonb;v_id text;p record;v_call text;v_result jsonb;v_groups uuid[];
begin
 if p_name not in ('grade_portal_quiz_essay','session_schedule_change','archive_quiz_definition','announcement_operation','announcement_queue','classroom_operation','portal_tenant_context','assistant_invite','assistant_configure','assistant_registration_link','student_followup_report','student_collection_operation','portal_onboarding_claim_queue','portal_onboarding_claim_queue_limited','parent_family_limit') then raise exception 'FORBIDDEN';end if;
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

-- One transaction validates the saved model, grades the actual submission, and
-- updates its matching online result. Request student/group/quiz numbers are ignored.
create function public.grade_portal_quiz_essay(p_tenant uuid,p_user uuid,p_assistant uuid,p_submission uuid,p_scores jsonb,p_note text default '',p_final numeric default null,p_max numeric default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor public.users;submission public.homework_submissions;material public.study_materials;attempt public.portal_quiz_attempts;context jsonb;payload jsonb;notes jsonb;mark jsonb;question jsonb;answer_key text;valid_keys text[]:='{}';position integer:=0;essay_total numeric:=0;points numeric;earned numeric;final_points numeric;maximum numeric;v_quiz_number integer;v_group_id uuid;v_teacher_id uuid;written integer;
begin
 if jsonb_typeof(p_scores) is distinct from 'object' or pg_column_size(p_scores)>30000 or length(coalesce(p_note,''))>2000 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 select u.* into actor from public.users u join public.tenants t on t.id=u.tenant_id and t.status='active' and t.deleted_at is null where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner');
 if actor.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into submission from public.homework_submissions where id=p_submission and tenant_id=p_tenant;
 if submission.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 -- Match the finalizer's attempt-before-submission lock order.
 select * into attempt from public.portal_quiz_attempts where tenant_id=p_tenant and student_id=submission.student_id and material_id=submission.material_id for update;
 select * into submission from public.homework_submissions where id=p_submission and tenant_id=p_tenant for update;
 select * into material from public.study_materials where id=submission.material_id and tenant_id=p_tenant for share;
 if material.id is null or material.type<>'online_quiz' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 payload:=coalesce(attempt.definition,public.portal_parse_legacy_json(material.questions));
 notes:=coalesce(public.portal_parse_legacy_json(submission.teacher_notes),'{}'::jsonb);
 v_group_id:=coalesce(attempt.group_id,nullif(notes->>'group_id','')::uuid,material.group_id,(select st.group_id from public.students st where st.id=submission.student_id and st.tenant_id=p_tenant));
 if v_group_id is null or not exists(select 1 from public.groups g where g.id=v_group_id and g.tenant_id=p_tenant) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if actor.role='teacher' then
  v_teacher_id:=actor.teacher_id;if v_teacher_id is null then select id into v_teacher_id from public.teachers where user_id=p_user and tenant_id=p_tenant limit 1;end if;
  if v_teacher_id is not null and exists(select 1 from public.groups g where g.id=v_group_id and g.teacher_id is not null and g.teacher_id<>v_teacher_id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
 if p_assistant is not null then
  context:=public.assistant_delegated_context();
  if context->>'tenant_id' is distinct from p_tenant::text or context->>'owner_id' is distinct from p_user::text or context->>'assistant_id' is distinct from p_assistant::text or context->>'resource' is distinct from 'online-quizzes' or context->>'action' is distinct from 'grade' or not public.assistant_delegated_group(v_group_id) or not public.assistant_delegated_student(submission.student_id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 end if;
 if attempt.id is not null and attempt.finalized_at is null then raise exception 'QUIZ_NOT_SUBMITTED' using errcode='23514';end if;
 mark:=public.portal_quiz_mark_model(payload,coalesce(attempt.answers,notes->'answers','{}'::jsonb));
 if not (mark->>'has_essay')::boolean then raise exception 'QUIZ_NO_ESSAY' using errcode='23514';end if;
 maximum:=(mark->>'max_score')::numeric;
 for question in select value from jsonb_array_elements(payload->'questions') loop
  if question->>'type'='essay' then
   answer_key:=coalesce(nullif(question->>'id',''),position::text);valid_keys:=array_append(valid_keys,answer_key);
   points:=coalesce(nullif(question->>'points','')::numeric,1);
   if jsonb_typeof(p_scores->answer_key) is distinct from 'number' then raise exception 'ESSAY_SCORE_REQUIRED' using errcode='23514';end if;
   earned:=(p_scores->>answer_key)::numeric;
   if earned<0 or earned>points or earned::text in ('NaN','Infinity','-Infinity') then raise exception 'INVALID_GRADE' using errcode='23514';end if;
   essay_total:=essay_total+earned;
  end if;
  position:=position+1;
 end loop;
 if exists(select 1 from jsonb_object_keys(p_scores) k where not(k=any(valid_keys))) then raise exception 'UNKNOWN_ESSAY' using errcode='23514';end if;
 final_points:=coalesce(p_final,(mark->>'mcq_score')::numeric+essay_total);
 if final_points<0 or final_points>maximum or final_points::text in ('NaN','Infinity','-Infinity') or p_max is not null and p_max<>maximum then raise exception 'INVALID_GRADE' using errcode='23514';end if;
 v_quiz_number:=coalesce(nullif(payload->>'quiz_number','')::integer,1);
 insert into public.quiz_scores(tenant_id,student_id,group_id,material_id,quiz_number,score,max_score,note,idempotency_key,updated_at)
 values(p_tenant,submission.student_id,v_group_id,material.id,v_quiz_number,final_points,maximum,coalesce(p_note,''),p_tenant::text||':'||submission.student_id::text||':material:'||material.id::text,now())
 on conflict(idempotency_key) do update set score=excluded.score,max_score=excluded.max_score,note=excluded.note,updated_at=now() where public.quiz_scores.tenant_id=excluded.tenant_id and public.quiz_scores.student_id=excluded.student_id and public.quiz_scores.material_id=excluded.material_id;
 get diagnostics written=row_count;if written<>1 then raise exception 'FORBIDDEN' using errcode='42501';end if;
 notes:=notes||mark||jsonb_build_object('essay_scores',p_scores,'essay_score',essay_total,'final_score',final_points,'score',final_points,'is_graded',true,'teacher_comment',coalesce(p_note,''),'graded_at',now());
 update public.homework_submissions set status='approved',teacher_notes=notes::text where id=submission.id and tenant_id=p_tenant;
 if attempt.id is not null then update public.portal_quiz_attempts set result=result||jsonb_build_object('score',final_points,'max_score',maximum,'is_graded',true,'essay_score',essay_total,'message','تم اعتماد نتيجة الامتحان') where id=attempt.id;end if;
 return jsonb_build_object('success',true,'final_score',final_points,'max_score',maximum,'mcq_score',mark->'mcq_score','essay_score',essay_total,'message','تم اعتماد وتثبيت درجة الطالب بنجاح');
end;$$;
revoke all on function public.grade_portal_quiz_essay(uuid,uuid,uuid,uuid,jsonb,text,numeric,numeric) from public,anon,authenticated;
grant execute on function public.grade_portal_quiz_essay(uuid,uuid,uuid,uuid,jsonb,text,numeric,numeric) to service_role;
