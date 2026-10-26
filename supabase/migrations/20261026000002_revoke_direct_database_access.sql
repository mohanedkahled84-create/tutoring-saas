-- The browser application uses the backend API; it does not connect to
-- Supabase tables directly. Revoke the broad grants from the legacy migration
-- that granted every table, sequence and routine to anon/authenticated.
-- The backend uses service_role. Auth middleware retains only the user-scoped
-- get_user_profile RPC for signed-in requests.

DROP POLICY IF EXISTS "study_materials_anon_select_homework" ON public.study_materials;
DROP POLICY IF EXISTS "students_anon_portal_select" ON public.students;
DROP POLICY IF EXISTS "homework_submissions_anon_insert" ON public.homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_anon_update" ON public.homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_anon_select" ON public.homework_submissions;
DROP POLICY IF EXISTS "Deny anon access on gift_codes" ON public.gift_codes;

REVOKE ALL ON ALL TABLES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM PUBLIC, anon, authenticated;
REVOKE ALL ON ALL ROUTINES IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- Backend requests use the caller's JWT and rely on tenant-scoped RLS. Restore
-- authenticated table/sequence privileges so those policies can run; anon and
-- PUBLIC remain denied.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- Keep secrets and service-managed records inaccessible to JWT-scoped clients.
REVOKE ALL ON TABLE public.email_verifications, public.whatsapp_inbox, public.short_links FROM authenticated;
GRANT SELECT ON TABLE public.meta_portal_dispatch_queue TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.meta_portal_dispatch_queue FROM authenticated;

GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
GRANT EXECUTE ON ALL ROUTINES IN SCHEMA public TO service_role, postgres;
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_current_user_view_financials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON TABLES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE ALL ON SEQUENCES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE EXECUTE ON ROUTINES FROM PUBLIC, anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON SEQUENCES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT EXECUTE ON ROUTINES TO service_role;

REVOKE ALL ON FUNCTION public.prevent_tenant_billing_tampering() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.assign_student_code() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_updated_at_tenant_platform_settings() FROM PUBLIC, anon, authenticated;

ALTER FUNCTION public.assign_student_code() SET search_path = pg_catalog, pg_temp;
ALTER FUNCTION public.handle_updated_at_tenant_platform_settings() SET search_path = pg_catalog;
