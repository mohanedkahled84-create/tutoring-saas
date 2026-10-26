-- Tighten RPC access after the production privilege audit.
-- SECURITY DEFINER functions bypass table RLS, so their EXECUTE grants must be narrow.

-- Profile resolution is used by the authenticated API middleware. Scope it to the
-- current user; service_role remains available for trusted backend maintenance.
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $function$
DECLARE
  v_user record;
BEGIN
  IF auth.role() IS DISTINCT FROM 'service_role'
     AND auth.uid() IS DISTINCT FROM p_user_id THEN
    RAISE EXCEPTION 'Not authorized to read this profile' USING ERRCODE = '42501';
  END IF;

  SELECT id, tenant_id, role, email, teacher_id, assistant_id,
         full_name, phone, subject, financial_pin_hash
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

REVOKE ALL ON FUNCTION public.get_user_profile(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated, service_role;

-- Sensitive lookup and secret-bearing functions are backend-only.
REVOKE ALL ON FUNCTION public.get_tenant_whatsapp_connection(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_tenant_whatsapp_connection(uuid) TO service_role, postgres;

-- These privileged functions are reached only from authenticated API handlers.
-- Handler-level authorization runs before their service_role RPC calls. Apply
-- the restriction to every deployed overload and tolerate absent legacy RPCs
-- in a clean installation.
DO $block$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'get_email_by_phone', 'get_emails_by_phone',
        'create_teacher_secure', 'create_room_secure', 'create_assistant_secure',
        'update_assistant_secure', 'delete_assistant_secure', 'list_assistants_secure'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role, postgres', fn.signature);
  END LOOP;
END;
$block$;

-- The production audit found a permissive assistants policy and table grants
-- that let anon select, insert, update, and delete every assistant row.
-- Remove legacy permissive policies and limit direct access to tenant staff.
DROP POLICY IF EXISTS "Allow all operations on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend insert on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend update on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend delete on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Tenant staff can manage assistants" ON public.assistants;

CREATE POLICY "Tenant staff can manage assistants"
  ON public.assistants
  FOR ALL
  TO authenticated
  USING (
    tenant_id = (SELECT public.get_current_user_tenant_id())
    AND (SELECT public.get_current_user_role()) IN
      ('admin', 'owner', 'center_owner', 'teacher')
  )
  WITH CHECK (
    tenant_id = (SELECT public.get_current_user_tenant_id())
    AND (SELECT public.get_current_user_role()) IN
      ('admin', 'owner', 'center_owner', 'teacher')
  );

REVOKE ALL ON TABLE public.assistants FROM PUBLIC, anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public.assistants TO authenticated;
GRANT ALL ON TABLE public.assistants TO service_role;

-- Close other live permissive policies found during the production review.
-- OTP records, WhatsApp inbox entries, and short-link tokens are backend data.
DROP POLICY IF EXISTS "Allow backend OTP management on email_verifications" ON public.email_verifications;
REVOKE ALL ON TABLE public.email_verifications FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.email_verifications TO service_role;

DROP POLICY IF EXISTS "Allow all access on whatsapp_inbox" ON public.whatsapp_inbox;
REVOKE ALL ON TABLE public.whatsapp_inbox FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.whatsapp_inbox TO service_role;

DROP POLICY IF EXISTS "Public can resolve short links" ON public.short_links;
DROP POLICY IF EXISTS "Service role manages short links" ON public.short_links;
REVOKE ALL ON TABLE public.short_links FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.short_links TO service_role;

-- The old ALL policy let any authenticated tenant operate on every queue row.
-- Keep the existing tenant-filtered SELECT policy; queue writes stay backend-only.
DROP POLICY IF EXISTS "meta_queue_tenant_all" ON public.meta_portal_dispatch_queue;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.meta_portal_dispatch_queue FROM PUBLIC, anon, authenticated;
GRANT ALL ON TABLE public.meta_portal_dispatch_queue TO service_role;

-- Prior lockdowns targeted older function signatures. Reapply them to every
-- overload currently deployed, including newer registration and OTP signatures.
DO $block$
DECLARE
  fn record;
BEGIN
  FOR fn IN
    SELECT p.oid::regprocedure AS signature, p.proname
    FROM pg_proc p
    JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.proname = ANY (ARRAY[
        'confirm_user_email_direct', 'is_email_confirmed', 'record_email_otp',
        'register_tenant_owner', 'register_tenant_owner_direct',
        'get_student_for_portal', 'get_parent_portal_payload',
        'resolve_portal_short_code', 'submit_homework_portal',
        'verify_homework_target'
      ])
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', fn.signature);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role, postgres', fn.signature);
  END LOOP;
END;
$block$;

-- New SECURITY DEFINER functions must opt in to execution explicitly.
ALTER DEFAULT PRIVILEGES REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
ALTER DEFAULT PRIVILEGES IN SCHEMA public REVOKE EXECUTE ON FUNCTIONS FROM anon, authenticated;
