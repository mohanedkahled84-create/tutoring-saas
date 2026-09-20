-- Migration: 20260920000007_add_subject_and_profile_phone
-- Adds 'subject' column to public.users and updates registration & profile RPCs to track subject and phone

-- 1. Add subject column to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subject text;

-- 2. Backfill existing subjects
UPDATE public.users u
SET subject = COALESCE(
  NULLIF(t.settings->>'subject', ''),
  (
    SELECT tch.subjects[1] 
    FROM public.teachers tch 
    WHERE tch.tenant_id = u.tenant_id 
      AND tch.subjects IS NOT NULL 
      AND array_length(tch.subjects, 1) > 0 
    LIMIT 1
  ),
  ''
)
FROM public.tenants t
WHERE u.tenant_id = t.id AND (u.subject IS NULL OR u.subject = '');

-- 3. Update get_user_profile to include phone and subject
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, tenant_id, role, email, teacher_id, assistant_id, full_name, phone, subject, financial_pin_hash
  INTO v_user
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_user.id,
    'tenant_id', v_user.tenant_id,
    'role', v_user.role,
    'email', v_user.email,
    'teacher_id', v_user.teacher_id,
    'assistant_id', v_user.assistant_id,
    'full_name', v_user.full_name,
    'phone', v_user.phone,
    'subject', v_user.subject,
    'financial_pin_hash', v_user.financial_pin_hash
  );
END;
$function$;

-- 4. Overload / Update register_tenant_owner_direct
CREATE OR REPLACE FUNCTION public.register_tenant_owner_direct(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone,
  p_subject text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_identity_id uuid := gen_random_uuid();
  v_tenant_id uuid;
  v_user_role text;
  v_normalized_account_type text;
  v_encrypted_pwd text;
  v_tenant_row RECORD;
  v_clean_email text := lower(trim(p_email));
  v_clean_phone text := trim(p_phone);
  v_clean_subject text := trim(COALESCE(p_subject, ''));
  r_old RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(trim(email)) = v_clean_email AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'USER_ALREADY_EXISTS: هذا البريد الإلكتروني مسجل بالفعل';
  END IF;

  IF v_clean_phone <> '' AND EXISTS (
    SELECT 1 FROM public.users pu
    JOIN auth.users au ON au.id = pu.id
    WHERE pu.phone = v_clean_phone AND au.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'PHONE_ALREADY_EXISTS: رقم الهاتف هذا مسجل بالفعل بحساب آخر';
  END IF;

  IF v_clean_phone <> '' THEN
    FOR r_old IN (
      SELECT au.id, pu.tenant_id
      FROM auth.users au
      JOIN public.users pu ON pu.id = au.id
      WHERE pu.phone = v_clean_phone
        AND au.email_confirmed_at IS NULL
    ) LOOP
      DELETE FROM auth.users WHERE id = r_old.id;
      IF r_old.tenant_id IS NOT NULL THEN
        DELETE FROM public.tenants WHERE id = r_old.tenant_id;
      END IF;
    END LOOP;
  END IF;

  FOR r_old IN (
    SELECT au.id, pu.tenant_id
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE lower(trim(au.email)) = v_clean_email
      AND au.email_confirmed_at IS NULL
  ) LOOP
    DELETE FROM auth.users WHERE id = r_old.id;
    IF r_old.tenant_id IS NOT NULL THEN
      DELETE FROM public.tenants WHERE id = r_old.tenant_id;
    END IF;
  END LOOP;

  v_normalized_account_type := CASE WHEN p_account_type = 'center' THEN 'center' ELSE 'teacher' END;
  v_user_role := CASE WHEN v_normalized_account_type = 'center' THEN 'center_owner' ELSE 'owner' END;
  v_encrypted_pwd := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO public.tenants (name, status, subscription_status, trial_ends_at, account_type, settings)
  VALUES (p_tenant_name, 'active', 'trial', p_trial_ends_at, v_normalized_account_type, jsonb_build_object('subject', v_clean_subject))
  RETURNING id, name, subscription_status, trial_ends_at, account_type INTO v_tenant_row;

  v_tenant_id := v_tenant_row.id;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    reauthentication_token,
    phone_change,
    phone_change_token,
    is_super_admin,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_encrypted_pwd,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'phone', v_clean_phone, 'subject', v_clean_subject, 'tenant_id', v_tenant_id, 'role', v_user_role),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    null,
    false,
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_identity_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', false, 'phone_verified', false),
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.users (id, tenant_id, email, role, full_name, phone, subject)
  VALUES (v_user_id, v_tenant_id, v_clean_email, v_user_role, p_full_name, v_clean_phone, v_clean_subject);

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id', v_user_id,
    'role', v_user_role,
    'full_name', p_full_name,
    'phone', v_clean_phone,
    'subject', v_clean_subject,
    'tenant_name', v_tenant_row.name,
    'trial_ends_at', v_tenant_row.trial_ends_at,
    'subscription_status', v_tenant_row.subscription_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_tenant_owner_direct(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN public.register_tenant_owner_direct(
    p_email, p_password, p_full_name, p_phone, p_tenant_name, p_account_type, p_trial_ends_at, ''
  );
END;
$function$;

-- 5. Overload / Update register_tenant_owner
CREATE OR REPLACE FUNCTION public.register_tenant_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone,
  p_subject text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_user_role text;
  v_normalized_account_type text;
  v_tenant_row RECORD;
  v_clean_subject text := trim(COALESCE(p_subject, ''));
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'USER_ALREADY_EXISTS: User % already has an associated tenant profile', p_user_id;
  END IF;

  v_normalized_account_type := CASE WHEN p_account_type = 'center' THEN 'center' ELSE 'teacher' END;
  v_user_role := CASE WHEN v_normalized_account_type = 'center' THEN 'center_owner' ELSE 'owner' END;

  INSERT INTO public.tenants (name, status, subscription_status, trial_ends_at, account_type, settings)
  VALUES (p_tenant_name, 'active', 'trial', p_trial_ends_at, v_normalized_account_type, jsonb_build_object('subject', v_clean_subject))
  RETURNING id, name, subscription_status, trial_ends_at, account_type INTO v_tenant_row;

  v_tenant_id := v_tenant_row.id;

  INSERT INTO public.users (id, tenant_id, email, role, phone, full_name, subject)
  VALUES (p_user_id, v_tenant_id, p_email, v_user_role, p_phone, p_full_name, v_clean_subject);

  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_user_meta_data = jsonb_build_object(
      'full_name', p_full_name,
      'phone', p_phone,
      'subject', v_clean_subject,
      'tenant_id', v_tenant_id,
      'role', v_user_role
    )
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id', p_user_id,
    'role', v_user_role,
    'full_name', p_full_name,
    'phone', p_phone,
    'subject', v_clean_subject,
    'tenant_name', v_tenant_row.name,
    'trial_ends_at', v_tenant_row.trial_ends_at,
    'subscription_status', v_tenant_row.subscription_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_tenant_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  RETURN public.register_tenant_owner(
    p_user_id, p_email, p_full_name, p_phone, p_tenant_name, p_account_type, p_trial_ends_at, ''
  );
END;
$function$;
