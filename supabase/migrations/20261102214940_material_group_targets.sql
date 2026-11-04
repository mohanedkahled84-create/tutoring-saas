-- Additive material targeting. NULL preserves the existing tenant-wide/single-group contract.
alter table public.study_materials add column group_ids uuid[];
alter table public.study_materials add constraint material_group_targets_count check(group_ids is null or cardinality(group_ids) between 1 and 200);
create index study_materials_group_targets on public.study_materials using gin(group_ids);

create function public.material_targets_student(m public.study_materials,p_student uuid,p_tenant uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select m.tenant_id=p_tenant and exists(
 select 1 from public.students st where st.id=p_student and st.tenant_id=p_tenant and
 (case when m.group_ids is not null then st.group_id=any(m.group_ids) or exists(select 1 from public.group_students gs join public.groups g on g.id=gs.group_id and g.tenant_id=p_tenant where gs.student_id=st.id and gs.tenant_id=p_tenant and gs.group_id=any(m.group_ids))
 else m.group_id is null or st.group_id=m.group_id or exists(select 1 from public.group_students gs join public.groups g on g.id=gs.group_id and g.tenant_id=p_tenant where gs.student_id=st.id and gs.tenant_id=p_tenant and gs.group_id=m.group_id) end))
$$;
revoke all on function public.material_targets_student(public.study_materials,uuid,uuid) from public,anon;
grant execute on function public.material_targets_student(public.study_materials,uuid,uuid) to authenticated,service_role;

create function public.guard_material_targets() returns trigger
language plpgsql security invoker set search_path='' as $$
declare ids uuid[];
begin
 if tg_op='UPDATE' and new.group_id is distinct from old.group_id and new.group_ids is not distinct from old.group_ids then
  new.group_ids:=case when new.group_id is null then null else array[new.group_id] end;
 end if;
 if new.group_ids is not null then
  select array_agg(x order by x) into ids from (select distinct unnest(new.group_ids) as x) d;
  if coalesce(cardinality(ids),0)=0 or cardinality(ids)>200 or array_position(ids,null) is not null then raise exception 'INVALID_GROUP_TARGETS';end if;
  if exists(select 1 from unnest(ids) as target(group_id) where not exists(select 1 from public.groups g where g.id=target.group_id and g.tenant_id=new.tenant_id)) then raise exception 'GROUP_TARGET_FORBIDDEN' using errcode='42501';end if;
  new.group_ids:=ids;new.group_id:=ids[1];
 elsif new.group_id is not null and not exists(select 1 from public.groups g where g.id=new.group_id and g.tenant_id=new.tenant_id) then
  raise exception 'GROUP_TARGET_FORBIDDEN' using errcode='42501';
 end if;
 -- Updating an assignment cannot silently revoke a student's submitted work.
 if tg_op='UPDATE' and (new.group_ids is distinct from old.group_ids or new.group_id is distinct from old.group_id) and exists(
  select 1 from public.homework_submissions h where h.material_id=old.id and h.tenant_id=old.tenant_id
  and public.material_targets_student(old,h.student_id,old.tenant_id)
  and not public.material_targets_student(new,h.student_id,new.tenant_id)) then
  raise exception 'GROUP_HAS_SUBMISSIONS' using errcode='23514';
 end if;
 return new;
end;$$;
revoke all on function public.guard_material_targets() from public,anon,authenticated;
grant execute on function public.guard_material_targets() to service_role;
create trigger material_targets_guard before insert or update on public.study_materials for each row execute function public.guard_material_targets();

create function public.assistant_delegated_material(p_id uuid,p_write boolean default false) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.study_materials m where m.id=p_id and m.tenant_id::text=public.assistant_delegated_context()->>'tenant_id' and
 case when m.group_ids is not null then
  case when p_write then not exists(select 1 from unnest(m.group_ids) g where not public.assistant_delegated_group(g))
  else exists(select 1 from unnest(m.group_ids) g where public.assistant_delegated_group(g)) end
 else public.assistant_delegated_group(m.group_id) or (m.group_id is null and (public.assistant_delegated_context()->>'all_groups')::boolean) end)
$$;
revoke all on function public.assistant_delegated_material(uuid,boolean) from public,anon,authenticated;
grant execute on function public.assistant_delegated_material(uuid,boolean) to service_role;

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
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id
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
  WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id;

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
      AND public.material_targets_student(m,v_student.id,v_student.tenant_id)
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
        WHERE hs2.student_id = v_student.id AND hs2.status = 'approved'
      ), COALESCE(v_attendance_stats.hw_done_count, 0)),
      'homework_total_count', COALESCE((
        SELECT COUNT(*)::int FROM study_materials sm2
        WHERE sm2.tenant_id = v_student.tenant_id AND sm2.is_homework = true
          AND public.material_targets_student(sm2,v_student.id,v_student.tenant_id)
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

  RETURN v_result;
END;
$function$;


CREATE OR REPLACE FUNCTION public.assistant_delegated_row(p_table text, r jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare c jsonb:=public.assistant_delegated_context();v_resource text:=c->>'resource';v_action text:=c->>'action';v_write boolean:=coalesce(current_setting('request.method',true),'GET') not in ('GET','HEAD');v_allowed boolean:=false;v_material_kind text;
begin
 if (case when p_table='tenants' then r->>'id' else r->>'tenant_id' end) is distinct from c->>'tenant_id' then return false;end if;
 if v_write then
  case p_table
   when 'groups' then v_allowed:=v_resource='groups' and v_action in ('create','edit','delete');
   when 'students' then v_allowed:=v_resource='students' and v_action in ('create','edit','delete','send');
   when 'group_students','enrollments' then v_allowed:=v_resource in ('groups','students') and v_action in ('create','edit','delete');
   when 'sessions' then v_allowed:=v_resource in ('attendance','sessions') and v_action in ('create','edit','delete');
   when 'attendance' then v_allowed:=v_resource='attendance' and v_action in ('create','edit');
   when 'quizzes' then v_allowed:=v_resource in ('quizzes','online-quizzes','paper-exams') and v_action in ('create','edit','delete');
   when 'quiz_scores' then v_allowed:=(v_resource='grades' and v_action='edit') or (v_resource in ('quizzes','online-quizzes','paper-exams') and v_action='grade');
   when 'study_materials' then v_allowed:=v_resource in ('materials','video-lessons','online-quizzes','paper-exams') and v_action in ('create','edit','delete');
   when 'homework_submissions' then v_allowed:=v_resource='homework' and v_action='edit';
   when 'whatsapp_inbox' then v_allowed:=v_resource in ('online-quizzes','paper-exams','video-lessons') and v_action in ('create','edit','delete','grade');
   when 'tenant_platform_settings' then v_allowed:=v_resource='platform-builder' and v_action='edit';
   when 'tenants','users','message_templates','whatsapp_connections','payment_proofs' then v_allowed:=v_resource='settings' and v_action='edit';
   when 'teachers' then v_allowed:=v_resource='settings' and v_action='edit' and r->>'user_id'=c->>'owner_id';
   when 'assistants','assistant_accounts','assistant_invitations' then v_allowed:=v_resource='assistants' and v_action in ('create','edit','delete');
   when 'meta_portal_dispatch_queue' then v_allowed:=v_resource='students' and v_action='send';
   when 'student_collections' then v_allowed:=(v_resource='collections' and v_action='create') or (v_resource='students' and v_action='collect');
   when 'activity_logs','assistant_access_audit','message_logs' then v_allowed:=v_action not in ('view','');
   else v_allowed:=false;
  end case;
  if not v_allowed then return false;end if;
 elsif p_table in ('assistants','assistant_accounts','assistant_invitations') and v_resource not in ('assistants','dashboard','reports') then return false;
 elsif p_table in ('payment_proofs','whatsapp_connections','message_templates') and v_resource<>'settings' then return false;
 end if;
 if p_table='study_materials' then
  if r->'group_ids' is not null and jsonb_typeof(r->'group_ids')='array' then
   if v_write and exists(select 1 from jsonb_array_elements_text(r->'group_ids') g where not public.assistant_delegated_group(g::uuid)) then return false;end if;
   if not v_write and not exists(select 1 from jsonb_array_elements_text(r->'group_ids') g where public.assistant_delegated_group(g::uuid)) then return false;end if;
  end if;
  if v_write and v_resource='materials' and r->>'type' not in ('pdf','link') then return false;end if;
  if not v_write and ((v_resource='video-lessons' and r->>'type'<>'video') or (v_resource='materials' and r->>'type' not in ('pdf','link'))) then return false;end if;
  v_material_kind:=public.assistant_delegated_material_kind(r);
  if v_material_kind in ('online-quizzes','paper-exams') and not coalesce((c->'permissions'->>(v_material_kind||'.view'))::boolean,false) then return false;end if;
  if v_write and v_resource<>v_material_kind then return false;end if;
 end if;
 case p_table
  when 'groups' then return ((c->>'all_groups')::boolean or (c->'group_ids')?(r->>'id')) and (c->>'teacher_id' is null or r->>'teacher_id' is null or r->>'teacher_id'=c->>'teacher_id');
  when 'students' then return public.assistant_delegated_group((r->>'group_id')::uuid) or (not v_write and public.assistant_delegated_student((r->>'id')::uuid));
  when 'study_materials' then
   if jsonb_typeof(r->'group_ids')='array' then return (v_write or exists(select 1 from jsonb_array_elements_text(r->'group_ids') g where public.assistant_delegated_group(g::uuid)));end if;
   return public.assistant_delegated_group((r->>'group_id')::uuid) or (r->>'group_id' is null and (c->>'all_groups')::boolean);
  when 'group_students','enrollments','sessions','quizzes','student_collections' then return public.assistant_delegated_group((r->>'group_id')::uuid) or (p_table='study_materials' and r->>'group_id' is null and (c->>'all_groups')::boolean);
  when 'attendance' then return public.assistant_delegated_student((r->>'student_id')::uuid) and exists(select 1 from public.sessions s where s.id=(r->>'session_id')::uuid and s.tenant_id::text=c->>'tenant_id' and public.assistant_delegated_group(s.group_id));
  when 'quiz_scores' then return public.assistant_delegated_student((r->>'student_id')::uuid) and (public.assistant_delegated_group((r->>'group_id')::uuid) or exists(select 1 from public.quizzes q where q.id=(r->>'quiz_id')::uuid and public.assistant_delegated_group(q.group_id)) or exists(select 1 from public.sessions s where s.id=(r->>'session_id')::uuid and public.assistant_delegated_group(s.group_id)));
  when 'homework_submissions' then return public.assistant_delegated_student((r->>'student_id')::uuid) and public.assistant_delegated_material((r->>'material_id')::uuid,false);
  when 'message_logs' then return public.assistant_delegated_group((r->>'group_id')::uuid) or public.assistant_delegated_student((r->>'student_id')::uuid) or ((c->>'all_groups')::boolean and r->>'group_id' is null and r->>'student_id' is null);
  when 'whatsapp_inbox' then return public.assistant_delegated_inbox(r);
  when 'meta_portal_dispatch_queue' then return public.assistant_delegated_student((r->>'student_id')::uuid);
  when 'users' then return r->>'id'=c->>'owner_id' and r->>'role'<>'admin';
  when 'teachers' then return c->>'teacher_id' is null or r->>'id'=c->>'teacher_id';
  when 'assistants' then return c->>'teacher_id' is null or r->>'teacher_id' is null or r->>'teacher_id'=c->>'teacher_id';
  when 'assistant_accounts','assistant_invitations' then return exists(select 1 from public.assistants a where a.id=(r->>'assistant_id')::uuid and a.tenant_id::text=c->>'tenant_id' and (c->>'teacher_id' is null or a.teacher_id is null or a.teacher_id::text=c->>'teacher_id'));
  else return true;
 end case;
exception when invalid_text_representation then return false;
end;$function$;


CREATE OR REPLACE FUNCTION public.assistant_delegated_inbox(p_row jsonb)
 RETURNS boolean
 LANGUAGE plpgsql
 STABLE
 SET search_path TO ''
AS $function$
declare c jsonb:=public.assistant_delegated_context();b jsonb;v_group text;v_student text;v_id text;v_material text;
begin
 begin b:=(p_row->>'message_body')::jsonb;exception when others then b:='{}';end;
 v_student:=coalesce(p_row->>'student_id',b->>'student_id',b->'student'->>'id');
 if v_student~'^[0-9a-fA-F-]{36}$' and not public.assistant_delegated_student(v_student::uuid) then return false;end if;
 v_material:=coalesce(b->>'material_id',b->>'quiz_id');
 if v_material~'^[0-9a-fA-F-]{36}$' and not public.assistant_delegated_material(v_material::uuid,coalesce(current_setting('request.method',true),'GET') not in ('GET','HEAD')) and not exists(select 1 from public.quizzes q where q.id=v_material::uuid and q.tenant_id::text=c->>'tenant_id' and public.assistant_delegated_group(q.group_id)) then return false;end if;
 if (p_row->>'phone') like 'QUIZ_DEF_%' and c->>'resource' in ('online-quizzes','paper-exams') and (case when b->>'exam_mode'='paper' then 'paper-exams' else 'online-quizzes' end)<>c->>'resource' then return false;end if;
 v_group:=coalesce(b->>'group_id',b->'quiz'->>'group_id');
 if v_group~'^[0-9a-fA-F-]{36}$' then return public.assistant_delegated_group(v_group::uuid);end if;
 if jsonb_typeof(b->'group_ids')='array' then
  for v_id in select jsonb_array_elements_text(b->'group_ids') loop
   if v_id~'^[0-9a-fA-F-]{36}$' and public.assistant_delegated_group(v_id::uuid) then
    if current_setting('request.method',true) in ('GET','HEAD') then return true;end if;
   elsif current_setting('request.method',true) not in ('GET','HEAD') then return false;end if;
  end loop;
  return current_setting('request.method',true) not in ('GET','HEAD') and jsonb_array_length(b->'group_ids')>0;
 end if;
 if v_student~'^[0-9a-fA-F-]{36}$' then return true;end if;
 -- Shared definitions without a student/group are tenant-wide operations.
 return (c->>'all_groups')::boolean;
exception when invalid_text_representation then return false;
end;$function$;


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
   from public.quizzes q2 join lateral (select sc.score from public.quiz_scores sc where sc.tenant_id=p_tenant and sc.group_id=g.id and sc.student_id=st.id and sc.quiz_number=q2.quiz_number order by coalesce(sc.updated_at,sc.created_at) desc,sc.id desc limit 1) sc2 on true
   where q2.tenant_id=p_tenant and q2.group_id=g.id and not coalesce(q2.is_skipped,false) and q2.quiz_date between v_from and v_to and sc2.score is not null order by q2.quiz_date desc,q2.id desc limit 1)) into v_grades
 from public.quizzes q left join lateral (select qs.score from public.quiz_scores qs where qs.tenant_id=p_tenant and qs.group_id=g.id and qs.student_id=st.id and qs.quiz_number=q.quiz_number order by coalesce(qs.updated_at,qs.created_at) desc,qs.id desc limit 1) sc on true
 where q.tenant_id=p_tenant and q.group_id=g.id and not coalesce(q.is_skipped,false) and q.quiz_date between v_from and v_to;
 select jsonb_build_object('total',count(*),'submitted',count(h.submitted_at),'late',count(*) filter(where m.due_date is not null and (h.submitted_at at time zone 'Africa/Cairo')::date>m.due_date),'on_time',count(*) filter(where m.due_date is not null and (h.submitted_at at time zone 'Africa/Cairo')::date<=m.due_date),'without_deadline',count(*) filter(where h.submitted_at is not null and m.due_date is null),'overdue',count(*) filter(where h.submitted_at is null and m.due_date<(now() at time zone 'Africa/Cairo')::date),'not_submitted',count(*) filter(where h.submitted_at is null)) into v_hw
 from public.study_materials m left join lateral (select hs.submitted_at from public.homework_submissions hs where hs.tenant_id=p_tenant and hs.material_id=m.id and hs.student_id=st.id order by hs.submitted_at desc limit 1) h on true
 where m.tenant_id=p_tenant and (case when m.group_ids is not null then g.id=any(m.group_ids) else m.group_id is null or m.group_id=g.id end) and m.is_homework and (m.created_at at time zone 'Africa/Cairo')::date between v_from and v_to;
 return jsonb_build_object('student_id',st.id,'student_name',st.name,'group_id',g.id,'group_name',g.name,'teacher_name',(select name from public.tenants where id=p_tenant),'from',v_from,'to',v_to,'attendance',v_att,'grades',v_grades,'homework',v_hw);
end;$function$;


CREATE OR REPLACE FUNCTION public.submit_homework_portal(p_portal_token text, p_material_id uuid, p_file_url text, p_file_name text, p_student_id uuid DEFAULT NULL)
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
    WHERE m.id = p_material_id AND m.tenant_id = v_student.tenant_id AND m.is_homework = true AND public.material_targets_student(m,v_student.id,v_student.tenant_id)
  ) THEN
    RAISE EXCEPTION 'Homework material not found or not assigned to teacher' USING ERRCODE = '42501';
  END IF;

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


create or replace view public.assistant_delegated_study_materials with (security_invoker=true,security_barrier=true) as
 select source.* from public.study_materials source where public.assistant_delegated_row('study_materials',to_jsonb(source)) with local check option;
revoke all on public.assistant_delegated_study_materials from public,anon,authenticated;
grant all on public.assistant_delegated_study_materials to service_role;
-- Verified portal identities are supplied only by the API, after its token check.
-- No fallback may bypass the material/group checks when the database rejects.
create function public.homework_target_allowed(p_student uuid,p_tenant uuid,p_material uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.study_materials m where m.id=p_material and m.tenant_id=p_tenant and m.is_homework and public.material_targets_student(m,p_student,p_tenant))
$$;
revoke all on function public.homework_target_allowed(uuid,uuid,uuid) from public,anon,authenticated;
grant execute on function public.homework_target_allowed(uuid,uuid,uuid) to service_role;

create function public.submit_verified_homework(p_student uuid,p_tenant uuid,p_material uuid,p_file_url text,p_file_name text,p_file_size bigint default null)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare m public.study_materials;result public.homework_submissions;
begin
 select * into m from public.study_materials where id=p_material and tenant_id=p_tenant for share;
 if m.id is null or not m.is_homework or not public.material_targets_student(m,p_student,p_tenant) then raise exception 'HOMEWORK_TARGET_FORBIDDEN' using errcode='42501';end if;
 if p_file_url not like p_tenant::text||'/'||p_material::text||'/'||p_student::text||'_%' or p_file_url like '%..%' then raise exception 'INVALID_FILE' using errcode='22023';end if;
 insert into public.homework_submissions(tenant_id,material_id,student_id,file_url,file_name,file_size,status,submitted_at)
 values(p_tenant,p_material,p_student,p_file_url,p_file_name,p_file_size,'pending',now())
 on conflict(material_id,student_id) do update set file_url=excluded.file_url,file_name=excluded.file_name,file_size=excluded.file_size,status='pending',submitted_at=now(),teacher_notes=null,reviewed_at=null returning * into result;
 return to_jsonb(result);
end;$$;
revoke all on function public.submit_verified_homework(uuid,uuid,uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.submit_verified_homework(uuid,uuid,uuid,text,text,bigint) to service_role;
notify pgrst,'reload schema';
