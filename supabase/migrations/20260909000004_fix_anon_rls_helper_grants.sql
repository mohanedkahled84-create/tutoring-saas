-- Migration: 20260909000004_fix_anon_rls_helper_grants.sql
-- Description: Grant execute to anon on RLS helper functions so unauthenticated/public queries evaluating table RLS can safely evaluate to null/false rather than throwing 42501 permission denied.

grant execute on function public.get_current_user_tenant_id to anon;
grant execute on function public.is_admin to anon;
grant execute on function public.get_current_user_role to anon;
grant execute on function public.get_current_user_teacher_id to anon;
