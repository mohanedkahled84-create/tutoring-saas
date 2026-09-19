-- Fix register_tenant_owner: remove explicit confirmed_at update
-- In Postgres 17 / modern Supabase, auth.users.confirmed_at is GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED.
-- Attempting to update confirmed_at throws "column confirmed_at can only be updated to DEFAULT".
-- Updating email_confirmed_at automatically updates confirmed_at.

CREATE OR REPLACE FUNCTION public.register_tenant_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_role text;
  v_normalized_account_type text;
  v_tenant_row RECORD;
BEGIN
  v_normalized_account_type := CASE WHEN p_account_type = 'center' THEN 'center' ELSE 'teacher' END;
  v_user_role := CASE WHEN v_normalized_account_type = 'center' THEN 'center_owner' ELSE 'owner' END;

  -- 1. Create Tenant
  INSERT INTO public.tenants (name, status, subscription_status, trial_ends_at, account_type, settings)
  VALUES (p_tenant_name, 'active', 'trial', p_trial_ends_at, v_normalized_account_type, '{}'::jsonb)
  RETURNING id, name, subscription_status, trial_ends_at, account_type INTO v_tenant_row;

  v_tenant_id := v_tenant_row.id;

  -- 2. Create or Update public.users
  INSERT INTO public.users (id, tenant_id, email, role, phone, full_name)
  VALUES (p_user_id, v_tenant_id, p_email, v_user_role, p_phone, p_full_name)
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = v_tenant_id,
    role = v_user_role,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name);

  -- 3. Confirm email in auth.users so login works instantly
  -- Note: in Postgres 17, confirmed_at is ALWAYS GENERATED from LEAST(email_confirmed_at, phone_confirmed_at)
  -- so setting email_confirmed_at automatically updates confirmed_at!
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
$$;
