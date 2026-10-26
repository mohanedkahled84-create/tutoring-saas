-- Repair installations that applied the initial broad lockdown migration.
-- Authenticated API requests use tenant-scoped RLS; anon remains denied.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- These records are handled only by trusted backend code.
REVOKE ALL ON TABLE public.email_verifications, public.whatsapp_inbox, public.short_links FROM authenticated;
GRANT SELECT ON TABLE public.meta_portal_dispatch_queue TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON TABLE public.meta_portal_dispatch_queue FROM authenticated;

-- Functions referenced by tenant RLS policies must remain callable by a
-- signed-in user. They derive scope only from that user's verified JWT.
GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.can_current_user_view_financials() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_role() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_teacher_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_user_tenant_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
