-- ============================================================================
-- Migration: 20260921000003_secure_assistant_rpcs_and_rls.sql
-- Description: Adds SECURITY DEFINER RPCs for assistants management and updates
--              RLS policies to support teachers, center owners, and assistants.
-- ============================================================================

-- 1. Update RLS policy to include all teacher and assistant roles
DROP POLICY IF EXISTS "Center owners can manage assistants" ON public.assistants;
DROP POLICY IF EXISTS "Tenant staff can manage assistants" ON public.assistants;

CREATE POLICY "Tenant staff can manage assistants"
  ON public.assistants
  FOR ALL
  TO public
  USING (
    tenant_id = public.get_current_user_tenant_id()
    AND public.get_current_user_role() IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher')
  )
  WITH CHECK (
    tenant_id = public.get_current_user_tenant_id()
    AND public.get_current_user_role() IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher')
  );

-- 2. Drop existing create_assistant_secure signatures
DROP FUNCTION IF EXISTS public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text, text, uuid, text);

-- 3. Create or replace secure RPC functions
CREATE OR REPLACE FUNCTION public.create_assistant_secure(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_assistant_type text DEFAULT 'assistant_to_teacher',
  p_teacher_id uuid DEFAULT NULL,
  p_can_view_financials boolean DEFAULT false,
  p_status text DEFAULT 'active',
  p_salary numeric DEFAULT 0,
  p_user_id uuid DEFAULT NULL,
  p_invite_token text DEFAULT NULL,
  p_role_type text DEFAULT 'both',
  p_group_id uuid DEFAULT NULL,
  p_salary_model text DEFAULT 'monthly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
  v_row record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant creation is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create assistant' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.assistants (
    tenant_id,
    teacher_id,
    name,
    phone,
    role_type,
    assistant_type,
    can_view_financials,
    group_id,
    salary_model,
    salary,
    status,
    user_id,
    invite_token
  ) VALUES (
    p_tenant_id,
    p_teacher_id,
    p_name,
    p_phone,
    COALESCE(p_role_type, 'both'),
    COALESCE(p_assistant_type, 'assistant_to_teacher'),
    COALESCE(p_can_view_financials, false),
    p_group_id,
    COALESCE(p_salary_model, 'monthly'),
    COALESCE(p_salary, 0),
    COALESCE(p_status, 'active'),
    p_user_id,
    p_invite_token
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_assistant_secure(
  p_id uuid,
  p_tenant_id uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_role_type text DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_clear_group boolean DEFAULT false,
  p_salary_model text DEFAULT NULL,
  p_salary numeric DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
  v_row record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant update is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to update assistant' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.assistants
  SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    role_type = COALESCE(p_role_type, role_type),
    group_id = CASE WHEN p_clear_group THEN NULL ELSE COALESCE(p_group_id, group_id) END,
    salary_model = COALESCE(p_salary_model, salary_model),
    salary = COALESCE(p_salary, salary),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assistant not found or does not belong to tenant' USING ERRCODE = 'P0002';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_assistant_secure(
  p_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant deletion is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to delete assistant' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.assistants
  WHERE id = p_id AND tenant_id = p_tenant_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_assistants_secure(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT *
    FROM public.assistants
    WHERE tenant_id = p_tenant_id
    ORDER BY created_at DESC
  ) a;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_assistant_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_assistant_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_assistant_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_assistants_secure TO anon, authenticated, service_role;
