-- Identity helpers are intentionally callable only by signed-in sessions and
-- the service. They take no arbitrary target IDs (except the self-checked
-- get_user_profile RPC), use fixed search paths, and are dependencies of RLS.
-- Production already grants these calls; historical test replay had lost five.
revoke execute on function public.can_current_user_view_financials(),
  public.get_current_user_role(), public.get_current_user_teacher_id(),
  public.get_current_user_tenant_id(), public.get_user_profile(uuid),
  public.is_admin() from public, anon;
grant execute on function public.can_current_user_view_financials(),
  public.get_current_user_role(), public.get_current_user_teacher_id(),
  public.get_current_user_tenant_id(), public.get_user_profile(uuid),
  public.is_admin() to authenticated, service_role;
