-- ============================================================================
-- Migration: 20260920000005_sec_lockdown_production_drift.sql
-- Description: Records and consolidates security lockdowns:
--              1. Revoke EXECUTE on security definer auth RPCs from public/anon/authenticated
--              2. Billing tampering trigger on public.tenants
--              3. Prevent user tenant re-pointing in register_tenant_owner
--              4. Restrict user INSERT policy to prevent role escalation to admin
--              5. Lockdown is_email_confirmed and drop unreferenced update_portal_password
-- ============================================================================

-- 1. Restrict Security Definer RPCs to service_role and postgres
REVOKE ALL ON FUNCTION public.confirm_user_email_direct(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_user_email_direct(uuid) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.get_email_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.get_emails_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_emails_by_phone(text) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.register_tenant_owner_direct(text, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_tenant_owner_direct(text, text, text, text, text, text, timestamptz) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.is_email_confirmed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_confirmed(text) TO service_role, postgres;

-- Drop unreferenced, vulnerable procedure
DROP FUNCTION IF EXISTS public.update_portal_password(uuid, text, text);

-- Ensure whatsapp_connections has is_legacy_exempt for pacing delay
ALTER TABLE public.whatsapp_connections ADD COLUMN IF NOT EXISTS is_legacy_exempt boolean DEFAULT false;

-- 2. Prevent billing / tier tampering on public.tenants
CREATE OR REPLACE FUNCTION public.prevent_tenant_billing_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF coalesce(auth.role(), 'service_role') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.account_type IS DISTINCT FROM OLD.account_type
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Changing billing or account fields is not permitted' USING errcode = '42501';
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     AND NEW.subscription_status <> 'pending_verification' THEN
    RAISE EXCEPTION 'Changing subscription status is not permitted' USING errcode = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_billing_tampering ON public.tenants;
CREATE TRIGGER trg_prevent_tenant_billing_tampering
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION prevent_tenant_billing_tampering();

-- Ensure anon cannot write to tenants
REVOKE INSERT, UPDATE, DELETE ON public.tenants FROM anon;

-- 3. Prevent tenant hijacking / re-pointing in register_tenant_owner
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
DECLARE
  v_tenant_id uuid;
  v_user_role text;
  v_normalized_account_type text;
  v_tenant_row RECORD;
BEGIN
  -- Prevent tenant hijacking / re-pointing: fail if user already has a profile
  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'USER_ALREADY_EXISTS: User % already has an associated tenant profile', p_user_id;
  END IF;

  v_normalized_account_type := CASE WHEN p_account_type = 'center' THEN 'center' ELSE 'teacher' END;
  v_user_role := CASE WHEN v_normalized_account_type = 'center' THEN 'center_owner' ELSE 'owner' END;

  -- 1. Create Tenant
  INSERT INTO public.tenants (name, status, subscription_status, trial_ends_at, account_type, settings)
  VALUES (p_tenant_name, 'active', 'trial', p_trial_ends_at, v_normalized_account_type, '{}'::jsonb)
  RETURNING id, name, subscription_status, trial_ends_at, account_type INTO v_tenant_row;

  v_tenant_id := v_tenant_row.id;

  -- 2. Create public.users profile (no re-pointing)
  INSERT INTO public.users (id, tenant_id, email, role, phone, full_name)
  VALUES (p_user_id, v_tenant_id, p_email, v_user_role, p_phone, p_full_name);

  -- 3. Confirm email in auth.users so login works instantly
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_user_meta_data = jsonb_build_object(
      'full_name', p_full_name,
      'phone', p_phone,
      'tenant_id', v_tenant_id,
      'role', v_user_role
    )
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id', p_user_id,
    'role', v_user_role,
    'tenant_name', v_tenant_row.name,
    'trial_ends_at', v_tenant_row.trial_ends_at,
    'subscription_status', v_tenant_row.subscription_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_tenant_owner(uuid, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_tenant_owner(uuid, text, text, text, text, text, timestamptz) TO service_role, postgres;

-- 4. Restrict users INSERT policy to prevent role elevation to admin
DROP POLICY IF EXISTS "Center owners can insert users in own tenant" ON public.users;
CREATE POLICY "Center owners can insert users in own tenant"
ON public.users
FOR INSERT
WITH CHECK (
  tenant_id = get_current_user_tenant_id()
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text])
  AND (role NOT IN ('admin') OR is_admin())
);
