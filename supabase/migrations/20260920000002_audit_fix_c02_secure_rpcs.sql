-- ============================================================================
-- Migration: 20260920000002_audit_fix_c02_secure_rpcs.sql
-- Description: Fixes Security Audit C-02 by revoking public/anon/authenticated
--              EXECUTE permissions on sensitive entity-creation RPCs.
--              Sets search_path = public, pg_temp and adds defense-in-depth
--              caller validation against privilege escalation and cross-tenant attacks.
-- ============================================================================

-- 1. Secure RPC: create_teacher_secure
CREATE OR REPLACE FUNCTION public.create_teacher_secure(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_subjects text[],
  p_revenue_model text,
  p_revenue_value numeric,
  p_status text DEFAULT 'active',
  p_user_id uuid DEFAULT NULL,
  p_invite_token text DEFAULT NULL
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

    IF v_caller_tenant IS NULL OR v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant creation is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role NOT IN ('admin', 'owner', 'center_owner') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create teacher' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.teachers (
    tenant_id,
    name,
    phone,
    subjects,
    revenue_model,
    revenue_value,
    status,
    user_id,
    invite_token
  ) VALUES (
    p_tenant_id,
    p_name,
    p_phone,
    COALESCE(p_subjects, ARRAY['عام'::text]),
    COALESCE(p_revenue_model, 'percentage'),
    COALESCE(p_revenue_value, 20),
    COALESCE(p_status, 'active'),
    p_user_id,
    p_invite_token
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;


-- 2. Secure RPC: create_assistant_secure
CREATE OR REPLACE FUNCTION public.create_assistant_secure(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_assistant_type text DEFAULT 'assistant_to_center',
  p_teacher_id uuid DEFAULT NULL,
  p_can_view_financials boolean DEFAULT false,
  p_status text DEFAULT 'active',
  p_salary numeric DEFAULT 0,
  p_user_id uuid DEFAULT NULL,
  p_invite_token text DEFAULT NULL
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

    IF v_caller_tenant IS NULL OR v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant creation is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role NOT IN ('admin', 'owner', 'center_owner') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create assistant' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.assistants (
    tenant_id,
    name,
    phone,
    assistant_type,
    teacher_id,
    can_view_financials,
    status,
    salary,
    user_id,
    invite_token
  ) VALUES (
    p_tenant_id,
    p_name,
    p_phone,
    COALESCE(p_assistant_type, 'assistant_to_center'),
    p_teacher_id,
    COALESCE(p_can_view_financials, false),
    COALESCE(p_status, 'active'),
    COALESCE(p_salary, 0),
    p_user_id,
    p_invite_token
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;


-- 3. Secure RPC: create_room_secure
CREATE OR REPLACE FUNCTION public.create_room_secure(
  p_tenant_id uuid,
  p_name text,
  p_capacity integer,
  p_hourly_rate numeric DEFAULT 0
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

    IF v_caller_tenant IS NULL OR v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant creation is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role NOT IN ('admin', 'owner', 'center_owner') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create room' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.rooms (
    tenant_id,
    name,
    capacity,
    hourly_rate
  ) VALUES (
    p_tenant_id,
    p_name,
    COALESCE(p_capacity, 30),
    COALESCE(p_hourly_rate, 0)
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;


-- 4. Revoke EXECUTE from PUBLIC, anon, and authenticated
REVOKE EXECUTE ON FUNCTION public.create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_room_secure(uuid, text, integer, numeric) FROM PUBLIC, anon, authenticated;

-- 5. Grant EXECUTE strictly to service_role
GRANT EXECUTE ON FUNCTION public.create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_room_secure(uuid, text, integer, numeric) TO service_role;
