alter table public.study_materials add column allow_late_submission boolean;

create function public.portal_preferences(p_tenant uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 with value as (select coalesce(settings->'portal_preferences','{}'::jsonb) cfg from public.tenants where id=p_tenant)
 select jsonb_build_object(
  'show_student_rank',coalesce(cfg->'show_student_rank'='true'::jsonb,true),
  'show_parent_rank',coalesce(cfg->'show_parent_rank'='true'::jsonb,false),
  'show_student_leaderboard',coalesce(cfg->'show_student_leaderboard'='true'::jsonb,false),
  'show_upcoming_sessions',coalesce(cfg->'show_upcoming_sessions'='true'::jsonb,true),
  'show_announcements',coalesce(cfg->'show_announcements'='true'::jsonb,true),
  'show_teacher_contact',coalesce(cfg->'show_teacher_contact'='true'::jsonb,true),
  'accept_late_homework',coalesce(cfg->'accept_late_homework'='true'::jsonb,true),
  'welcome_message',case when jsonb_typeof(cfg->'welcome_message')='string' then left(cfg->>'welcome_message',500) else '' end
 ) from value
$$;
revoke all on function public.portal_preferences(uuid) from public,anon,authenticated;
grant execute on function public.portal_preferences(uuid) to service_role;

create function public.homework_accepts_submission(p_material uuid,p_tenant uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.study_materials m where m.id=p_material and m.tenant_id=p_tenant and m.is_homework
  and (m.due_date is null or (now() at time zone 'Africa/Cairo')::date<=m.due_date
   or coalesce(m.allow_late_submission,(public.portal_preferences(p_tenant)->>'accept_late_homework')::boolean,true)))
$$;
revoke all on function public.homework_accepts_submission(uuid,uuid) from public,anon,authenticated;
grant execute on function public.homework_accepts_submission(uuid,uuid) to service_role;

create or replace function public.submit_homework_portal(p_portal_token text,p_material_id uuid,p_file_url text,p_file_name text)
returns jsonb language sql security invoker set search_path='' as $$
 select public.submit_homework_portal(p_portal_token,p_material_id,p_file_url,p_file_name,null::uuid)
$$;
revoke all on function public.submit_homework_portal(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.submit_homework_portal(text,uuid,text,text) to service_role;



create function public.portal_upcoming_sessions(p_student uuid,p_tenant uuid) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.session_date,x.start_time),'[]'::jsonb) from (
 select se.session_date,se.start_time,se.end_time,g.name as group_name
 from public.sessions se join public.groups g on g.id=se.group_id and g.tenant_id=p_tenant
 join public.students st on st.id=p_student and st.tenant_id=p_tenant and st.archived_at is null
 where se.tenant_id=p_tenant and se.session_date>=(now() at time zone 'Africa/Cairo')::date
 and coalesce(se.status,'scheduled') not in ('ended','cancelled','canceled')
 and public.portal_group_in_current_year(g.id,p_tenant)
 and (st.group_id=g.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and gs.group_id=g.id))
 and (public.portal_preferences(p_tenant)->>'show_upcoming_sessions')::boolean
 order by se.session_date,se.start_time limit 5
 ) x
$$;
revoke all on function public.portal_upcoming_sessions(uuid,uuid) from public,anon,authenticated;
grant execute on function public.portal_upcoming_sessions(uuid,uuid) to service_role;

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
      COALESCE(q.title, CASE WHEN qs.quiz_number IS NOT NULL THEN CONCAT('كويز ', qs.quiz_number::text) ELSE 'امتحان' END) AS title,
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
    LEFT JOIN quizzes q ON qs.quiz_id = q.id
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
  LEFT JOIN quizzes q ON qs.quiz_id = q.id
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

CREATE OR REPLACE FUNCTION public.submit_verified_homework(p_student uuid, p_tenant uuid, p_material uuid, p_file_url text, p_file_name text, p_file_size bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare m public.study_materials;result public.homework_submissions;
begin
 perform 1 from public.students where id=p_student and tenant_id=p_tenant and archived_at is null for share;
 if not found then raise exception 'HOMEWORK_TARGET_FORBIDDEN' using errcode='42501';end if;
 select * into m from public.study_materials where id=p_material and tenant_id=p_tenant for share;
 if m.id is null or not m.is_homework or not public.homework_target_allowed(p_student,p_tenant,p_material) then raise exception 'HOMEWORK_TARGET_FORBIDDEN' using errcode='42501';end if;
 perform 1 from public.tenants where id=p_tenant for share;
 if not public.homework_accepts_submission(p_material,p_tenant) then raise exception 'HOMEWORK_CLOSED' using errcode='23514';end if;
 if p_file_url not like p_tenant::text||'/'||p_material::text||'/'||p_student::text||'_%' or p_file_url like '%..%' then raise exception 'INVALID_FILE' using errcode='22023';end if;
 insert into public.homework_submissions(tenant_id,material_id,student_id,file_url,file_name,file_size,status,submitted_at)
 values(p_tenant,p_material,p_student,p_file_url,p_file_name,p_file_size,'pending',now())
 on conflict(material_id,student_id) do update set file_url=excluded.file_url,file_name=excluded.file_name,file_size=excluded.file_size,status='pending',submitted_at=now(),teacher_notes=null,reviewed_at=null returning * into result;
 return to_jsonb(result);
end;$function$;

CREATE OR REPLACE FUNCTION public.submit_homework_portal(p_portal_token text, p_material_id uuid, p_file_url text, p_file_name text, p_student_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_student public.students%ROWTYPE;
  v_submission public.homework_submissions%ROWTYPE;
BEGIN
  IF p_student_id IS NULL THEN
    SELECT * INTO v_student FROM public.students
    WHERE parent_portal_token = p_portal_token LIMIT 1;
  ELSE
    SELECT * INTO v_student FROM public.students
    WHERE id = p_student_id AND parent_portal_token = p_portal_token LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Student portal token not found or invalid' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.study_materials m
    WHERE m.id = p_material_id AND m.tenant_id = v_student.tenant_id AND m.is_homework = true AND public.homework_target_allowed(v_student.id,v_student.tenant_id,p_material_id)
  ) THEN
    RAISE EXCEPTION 'Homework material not found or not assigned to teacher' USING ERRCODE = '42501';
  END IF;

  PERFORM 1 FROM public.study_materials WHERE id=p_material_id AND tenant_id=v_student.tenant_id FOR SHARE;
  PERFORM 1 FROM public.tenants WHERE id=v_student.tenant_id FOR SHARE;
  IF NOT public.homework_accepts_submission(p_material_id,v_student.tenant_id) THEN RAISE EXCEPTION 'HOMEWORK_CLOSED' USING ERRCODE='23514';END IF;
  INSERT INTO public.homework_submissions (
    tenant_id, material_id, student_id, file_url, file_name, status, submitted_at
  ) VALUES (
    v_student.tenant_id, p_material_id, v_student.id, p_file_url, p_file_name, 'pending', now()
  )
  ON CONFLICT (material_id, student_id) DO UPDATE SET
    file_url = EXCLUDED.file_url,
    file_name = coalesce(EXCLUDED.file_name, public.homework_submissions.file_name),
    status = 'pending', submitted_at = now()
  RETURNING * INTO v_submission;
  RETURN to_jsonb(v_submission);
END;
$function$;
create or replace view public.assistant_delegated_study_materials with (security_invoker=true,security_barrier=true) as select source.* from public.study_materials source where public.assistant_delegated_row('study_materials',to_jsonb(source)) with local check option;
notify pgrst,'reload schema';

CREATE OR REPLACE FUNCTION public.get_portal_group_leaderboard(p_student_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with owner as (
  select s.id, coalesce(
    (select g.id from public.groups g where g.id=s.group_id and g.tenant_id=p_tenant_id and public.portal_group_in_current_year(g.id,p_tenant_id)),
    (select g.id from public.group_students gs join public.groups g on g.id=gs.group_id and g.tenant_id=gs.tenant_id
      where gs.student_id=s.id and gs.tenant_id=p_tenant_id and public.portal_group_in_current_year(g.id,p_tenant_id) order by g.id limit 1)
  ) as group_id
  from public.students s where s.id=p_student_id and s.tenant_id=p_tenant_id and s.archived_at is null
), period as (
  select date_trunc('month', now() at time zone 'Africa/Cairo')::date as first_day
), peers as (
  select s.id from public.students s cross join owner o
  where s.tenant_id=p_tenant_id and s.archived_at is null and o.group_id is not null and
    (s.group_id=o.group_id or exists(select 1 from public.group_students gs
      where gs.tenant_id=p_tenant_id and gs.student_id=s.id and gs.group_id=o.group_id))
), month_sessions as (
  select s.id from public.sessions s cross join owner o cross join period p
  where s.tenant_id=p_tenant_id and s.group_id=o.group_id
    and s.session_date>=p.first_day and s.session_date<(p.first_day+interval '1 month')
), marks as (
  select a.student_id, a.session_id, a.quiz_score as score, a.quiz_max_score as maximum
  from public.attendance a join month_sessions ms on ms.id=a.session_id join peers p on p.id=a.student_id
  where a.tenant_id=p_tenant_id and a.quiz_score is not null and a.quiz_max_score>0
  union all
  select q.student_id, q.session_id, q.score, q.max_score from public.quiz_scores q
  join peers p on p.id=q.student_id cross join owner o cross join period period
  where q.tenant_id=p_tenant_id and q.group_id=o.group_id and q.max_score>0 and q.score is not null
    and q.created_at >= (period.first_day::timestamp at time zone 'Africa/Cairo')
    and q.created_at < ((period.first_day+interval '1 month') at time zone 'Africa/Cairo')
    and not exists(select 1 from public.attendance a join month_sessions ms on ms.id=a.session_id
      where a.tenant_id=p_tenant_id and a.student_id=q.student_id and a.session_id=q.session_id
      and a.quiz_score is not null and a.quiz_max_score>0)
), attendance_stats as (
  select a.student_id, count(*) as sessions, round(100.0*count(*) filter(where a.attended)/count(*)) as attendance
  from public.attendance a join month_sessions ms on ms.id=a.session_id join peers p on p.id=a.student_id
  where a.tenant_id=p_tenant_id group by a.student_id
), grade_stats as (
  select student_id, count(*) as quizzes, round(avg(greatest(0,least(100,100.0*score/maximum))),1) as average
  from marks where score::text not in ('NaN','Infinity','-Infinity') and maximum::text not in ('NaN','Infinity','-Infinity')
  group by student_id
), stats as (
  select p.id, coalesce(a.sessions,0) as sessions, coalesce(a.attendance,0) as attendance,
    coalesce(g.quizzes,0) as quizzes, coalesce(g.average,0) as average,
    round((coalesce(g.average,0)*0.7+coalesce(a.attendance,0)*0.3)/
      nullif((case when g.quizzes>0 then 0.7 else 0 end)+(case when a.sessions>0 then 0.3 else 0 end),0),1) as overall
  from peers p left join attendance_stats a on a.student_id=p.id left join grade_stats g on g.student_id=p.id
), ranked as (
  select *, rank() over(order by (quizzes>0) desc, overall desc nulls last, average desc, attendance desc) as position,
    count(*) over() as size from stats
)
select case when (public.portal_preferences(p_tenant_id)->>'show_student_leaderboard')::boolean then
 jsonb_build_object('entries',coalesce((select jsonb_agg(jsonb_build_object('name',name,'position',position) order by position,name) from (
 select s.name,r.position from ranked r join public.students s on s.id=r.id and s.tenant_id=p_tenant_id
 where r.sessions>0 or r.quizzes>0 order by r.position,s.name,s.id limit 10
 ) entries),'[]'::jsonb),'period',(select to_char(first_day,'YYYY-MM') from period)) else null end;
$function$;
revoke all on function public.get_portal_group_leaderboard(uuid,uuid) from public,anon,authenticated;
grant execute on function public.get_portal_group_leaderboard(uuid,uuid) to service_role;
