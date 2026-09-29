-- Migration: 20260930000001_meta_portal_queue_rls_fix.sql
-- Fixes RLS insert permission on meta_portal_dispatch_queue for authenticated teachers

DROP POLICY IF EXISTS meta_queue_tenant_all ON public.meta_portal_dispatch_queue;
DROP POLICY IF EXISTS meta_queue_tenant_insert ON public.meta_portal_dispatch_queue;
DROP POLICY IF EXISTS meta_queue_tenant_update ON public.meta_portal_dispatch_queue;

CREATE POLICY meta_queue_tenant_all ON public.meta_portal_dispatch_queue
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.meta_portal_dispatch_queue TO authenticated;
GRANT ALL ON public.meta_portal_dispatch_queue TO service_role;
