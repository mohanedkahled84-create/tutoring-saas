-- Restore runtime RPCs that exist in production but were missing from the
-- repository's migration history. All sensitive RPCs are backend-only.

CREATE OR REPLACE FUNCTION public.normalize_arabic_digits(p_text text)
RETURNS text
LANGUAGE sql
IMMUTABLE
SET search_path = pg_catalog
AS $$
  SELECT translate(translate(p_text, '٠١٢٣٤٥٦٧٨٩', '0123456789'), '۰۱۲۳۴۵۶۷۸۹', '0123456789');
$$;

CREATE OR REPLACE FUNCTION public.get_emails_by_phone(p_phone text)
RETURNS TABLE(email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
DECLARE
  v_clean text;
  v_std text;
BEGIN
  IF p_phone IS NULL OR trim(p_phone) = '' THEN RETURN; END IF;
  v_clean := regexp_replace(public.normalize_arabic_digits(trim(p_phone)), '[^0-9]', '', 'g');
  IF v_clean = '' THEN RETURN; END IF;

  IF v_clean LIKE '20%' AND length(v_clean) = 12 THEN
    v_std := '0' || substring(v_clean from 3);
  ELSIF v_clean LIKE '0020%' AND length(v_clean) = 14 THEN
    v_std := '0' || substring(v_clean from 5);
  ELSIF length(v_clean) = 10 AND v_clean LIKE '1%' THEN
    v_std := '0' || v_clean;
  ELSE
    v_std := v_clean;
  END IF;

  RETURN QUERY
  WITH matches AS (
    SELECT lower(trim(u.email)) AS email, u.created_at AS created_at
    FROM public.users u
    WHERE coalesce(u.email, '') <> '' AND (
      regexp_replace(public.normalize_arabic_digits(coalesce(u.phone, '')), '[^0-9]', '', 'g') IN (v_clean, v_std)
      OR regexp_replace(public.normalize_arabic_digits(coalesce(u.phone, '')), '[^0-9]', '', 'g') LIKE '%' || substring(v_std from 2)
    )
    UNION
    SELECT lower(trim(au.email)), au.created_at
    FROM auth.users au
    WHERE coalesce(au.email, '') <> '' AND (
      regexp_replace(public.normalize_arabic_digits(coalesce(au.phone, '')), '[^0-9]', '', 'g') IN (v_clean, v_std)
      OR regexp_replace(public.normalize_arabic_digits(coalesce(au.raw_user_meta_data->>'phone', '')), '[^0-9]', '', 'g') IN (v_clean, v_std)
    )
  )
  SELECT m.email FROM matches m GROUP BY m.email ORDER BY max(m.created_at) DESC;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_email_by_phone(p_phone text)
RETURNS text
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public
AS $$
  SELECT e.email FROM public.get_emails_by_phone(p_phone) e LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.is_email_confirmed(p_email text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, auth
AS $$
  SELECT coalesce((SELECT u.email_confirmed_at IS NOT NULL
                   FROM auth.users u
                   WHERE lower(u.email) = lower(trim(p_email))
                   LIMIT 1), false);
$$;

CREATE OR REPLACE FUNCTION public.confirm_user_email_direct(p_email text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
DECLARE
  v_clean_email text := lower(trim(p_email));
  v_user_id uuid;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.email_verifications
    WHERE email = v_clean_email
      AND verified_at IS NOT NULL
      AND verified_at >= now() - interval '15 minutes'
  ) THEN
    RAISE EXCEPTION 'UNAUTHORIZED: Valid OTP verification record required' USING ERRCODE = '42501';
  END IF;

  SELECT id INTO v_user_id FROM auth.users WHERE lower(email) = v_clean_email LIMIT 1;
  IF v_user_id IS NULL THEN RETURN false; END IF;

  UPDATE auth.users
  SET email_confirmed_at = coalesce(email_confirmed_at, now()), updated_at = now()
  WHERE id = v_user_id;
  UPDATE auth.identities
  SET identity_data = jsonb_set(identity_data, '{email_verified}', 'true'::jsonb), updated_at = now()
  WHERE user_id = v_user_id;
  RETURN true;
END;
$function$;

CREATE OR REPLACE FUNCTION public.get_student_for_portal(
  p_identifier text,
  p_password text
)
RETURNS TABLE(
  id uuid, tenant_id uuid, code text, student_code text, name text,
  parent_phone text, student_phone text, fee_override numeric, exempt boolean,
  notes text, parent_portal_sent_at timestamptz, student_portal_sent_at timestamptz,
  parent_portal_token text, portal_password text, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT s.id, s.tenant_id, s.code, s.student_code, s.name, s.parent_phone,
         s.student_phone, s.fee_override, s.exempt, s.notes,
         s.parent_portal_sent_at, s.student_portal_sent_at,
         s.parent_portal_token, s.portal_password, s.created_at
  FROM public.students s
  WHERE nullif(trim(p_password), '') IS NOT NULL
    AND (
      s.code = public.normalize_arabic_digits(trim(p_identifier))
      OR s.student_code = public.normalize_arabic_digits(trim(p_identifier))
      OR regexp_replace(coalesce(s.parent_phone, ''), '[[:space:]().-]', '', 'g') = regexp_replace(public.normalize_arabic_digits(trim(p_identifier)), '[[:space:]().-]', '', 'g')
      OR regexp_replace(coalesce(s.student_phone, ''), '[[:space:]().-]', '', 'g') = regexp_replace(public.normalize_arabic_digits(trim(p_identifier)), '[[:space:]().-]', '', 'g')
    )
    AND public.normalize_arabic_digits(coalesce(s.portal_password, '')) = public.normalize_arabic_digits(trim(p_password))
  ORDER BY s.created_at DESC
  LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_student_for_portal(p_identifier text)
RETURNS TABLE(
  id uuid, tenant_id uuid, code text, student_code text, name text,
  parent_phone text, student_phone text, fee_override numeric, exempt boolean,
  notes text, parent_portal_sent_at timestamptz, student_portal_sent_at timestamptz,
  parent_portal_token text, portal_password text, created_at timestamptz
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT * FROM public.get_student_for_portal(p_identifier, NULL::text);
$$;

CREATE OR REPLACE FUNCTION public.resolve_portal_short_code(p_code text)
RETURNS json
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $function$
DECLARE
  v_link record;
  v_student record;
  v_type text;
  v_student_id uuid;
BEGIN
  SELECT * INTO v_link FROM public.short_links WHERE code = p_code LIMIT 1;
  IF FOUND THEN
    RETURN json_build_object(
      'code', v_link.code, 'token', v_link.token, 'portal_type', v_link.portal_type,
      'student_id', v_link.student_id, 'tenant_id', v_link.tenant_id
    );
  END IF;

  -- Preserve old full-UUID links without allowing short-prefix enumeration.
  IF p_code ~* '^[sp][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN
    v_type := CASE WHEN lower(left(p_code, 1)) = 's' THEN 'student' ELSE 'parent' END;
    v_student_id := substring(p_code from 2)::uuid;
    SELECT id, tenant_id, name, parent_portal_token
    INTO v_student FROM public.students WHERE id = v_student_id;
    IF FOUND THEN
      RETURN json_build_object(
        'code', p_code, 'token', v_student.parent_portal_token,
        'portal_type', v_type, 'student_id', v_student.id,
        'tenant_id', v_student.tenant_id, 'student_name', v_student.name
      );
    END IF;
  END IF;
  RETURN NULL;
END;
$function$;

CREATE OR REPLACE FUNCTION public.submit_homework_portal(
  p_portal_token text,
  p_material_id uuid,
  p_file_url text,
  p_file_name text,
  p_student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
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
    WHERE m.id = p_material_id AND m.tenant_id = v_student.tenant_id AND m.is_homework = true
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

CREATE OR REPLACE FUNCTION public.verify_homework_target(p_material_id uuid, p_tenant_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.study_materials
    WHERE id = p_material_id AND tenant_id = p_tenant_id AND is_homework = true
  );
$$;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_homework
  ON public.homework_submissions (material_id, student_id);

CREATE OR REPLACE FUNCTION public.submit_homework_portal(
  p_portal_token text,
  p_material_id uuid,
  p_file_url text,
  p_file_name text
)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = pg_catalog, public, pg_temp
AS $$
  SELECT public.submit_homework_portal(
    p_portal_token, p_material_id, p_file_url, p_file_name, NULL::uuid
  );
$$;

CREATE OR REPLACE FUNCTION public.prevent_self_privilege_escalation()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = pg_catalog, public, auth, pg_temp
AS $function$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' OR public.is_admin() THEN RETURN NEW; END IF;
  IF NEW.role IS DISTINCT FROM OLD.role
     OR NEW.tenant_id IS DISTINCT FROM OLD.tenant_id
     OR NEW.teacher_id IS DISTINCT FROM OLD.teacher_id
     OR NEW.assistant_id IS DISTINCT FROM OLD.assistant_id THEN
    RAISE EXCEPTION 'Changing role, tenant_id, teacher_id, or assistant_id is not permitted for this user'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_self_privilege_escalation ON public.users;
CREATE TRIGGER trg_prevent_self_privilege_escalation
BEFORE UPDATE ON public.users
FOR EACH ROW EXECUTE FUNCTION public.prevent_self_privilege_escalation();

REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;
