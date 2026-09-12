-- 20260912000003_dev_parent_portal_rpc.sql
-- RPC function to bypass RLS securely and return comprehensive live parent portal payload

CREATE OR REPLACE FUNCTION public.get_parent_portal_payload(
  p_token text,
  p_student_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_group_name text;
  v_center_name text;
  v_attendance json;
  v_quizzes json;
  v_attendance_stats record;
  v_quiz_stats record;
  v_result json;
BEGIN
  -- 1. Locate student either by (id, tenant_id) if verified by HMAC, or by parent_portal_token
  IF p_student_id IS NOT NULL AND p_tenant_id IS NOT NULL THEN
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
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
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.parent_portal_token = p_token
    LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch group and center name
  IF v_student.group_id IS NOT NULL THEN
    SELECT g.name, g.center_name INTO v_group_name, v_center_name
    FROM groups g
    WHERE g.id = v_student.group_id;
  ELSE
    SELECT g.name, g.center_name INTO v_group_name, v_center_name
    FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE gs.student_id = v_student.id
    LIMIT 1;
  END IF;

  -- 3. Fetch attendance history
  SELECT json_agg(t) INTO v_attendance
  FROM (
    SELECT 
      a.id,
      a.attended,
      a.comment,
      COALESCE(a.homework_status, 'done') AS homework_status,
      a.created_at,
      COALESCE(s.session_number, 1) AS session_number,
      COALESCE(s.session_date::text, (a.created_at::date)::text) AS session_date
    FROM attendance a
    LEFT JOIN sessions s ON a.session_id = s.id
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id
    ORDER BY a.created_at DESC
    LIMIT 25
  ) t;

  -- Attendance stats
  SELECT 
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.attended = true)::int AS attended_count,
    COUNT(*) FILTER (WHERE a.attended = false)::int AS absent_count,
    COUNT(*) FILTER (WHERE a.homework_status IN ('done', 'completed', 'delivered'))::int AS hw_done_count
  INTO v_attendance_stats
  FROM attendance a
  WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id;

  -- 4. Fetch Quizzes & scores
  SELECT json_agg(q_row) INTO v_quizzes
  FROM (
    SELECT 
      qs.id,
      qs.quiz_id,
      COALESCE(q.title, CASE WHEN qs.quiz_number IS NOT NULL THEN CONCAT('كويز ', qs.quiz_number::text) ELSE 'اختبار' END) AS title,
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
    WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id
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
  WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id;

  -- 5. Build final JSON matching frontend exact contract
  v_result := json_build_object(
    'student', json_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'student_code', COALESCE(v_student.code, '—'),
      'group_name', COALESCE(v_group_name, 'المجموعة العامة'),
      'center_name', COALESCE(v_center_name, '')
    ),
    'summary', json_build_object(
      'total_sessions', COALESCE(v_attendance_stats.total, 0),
      'attended_count', COALESCE(v_attendance_stats.attended_count, 0),
      'absent_count', COALESCE(v_attendance_stats.absent_count, 0),
      'attendance_rate', CASE WHEN COALESCE(v_attendance_stats.total, 0) > 0 
        THEN CONCAT(ROUND((v_attendance_stats.attended_count::numeric / v_attendance_stats.total::numeric) * 100)::text, '%')
        ELSE '100%' END,
      'homework_done_count', COALESCE(v_attendance_stats.hw_done_count, 0),
      'total_quizzes', COALESCE(v_quiz_stats.total_quizzes, 0),
      'quiz_average_percentage', CASE WHEN COALESCE(v_quiz_stats.total_quizzes, 0) > 0
        THEN CONCAT(ROUND(v_quiz_stats.avg_score)::text, '%')
        ELSE '—' END
    ),
    'sessions', COALESCE(v_attendance, '[]'::json),
    'quizzes', COALESCE(v_quizzes, '[]'::json),
    'last_updated', now()
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_portal_payload(text, uuid, uuid) TO anon, authenticated;
