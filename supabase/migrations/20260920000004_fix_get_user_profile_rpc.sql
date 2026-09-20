-- Migration: Add secure get_user_profile RPC for robust tenant/profile resolution
-- Eliminates RLS recursion/failures during token authentication middleware

CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, tenant_id, role, email, teacher_id, assistant_id, full_name, financial_pin_hash
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
    'financial_pin_hash', v_user.financial_pin_hash
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO anon, authenticated, service_role;
