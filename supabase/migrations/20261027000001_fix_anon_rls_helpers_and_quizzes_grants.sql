-- Migration: 20261027000001_fix_anon_rls_helpers_and_quizzes_grants.sql
-- Description:
-- 1. Grant execute on RLS helper functions to anon and authenticated so unauthenticated queries
--    can safely evaluate RLS policies to false/null rather than throwing 42501 permission denied.
-- 2. Grant SELECT on whatsapp_inbox to authenticated so legacy quiz definitions and paper exam
--    bubble sheet submissions can be read and merged by the application.

GRANT EXECUTE ON FUNCTION public.get_current_user_tenant_id() TO anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin() TO anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO anon, authenticated, PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_current_user_teacher_id() TO anon, authenticated, PUBLIC;

GRANT SELECT ON TABLE public.whatsapp_inbox TO authenticated;
