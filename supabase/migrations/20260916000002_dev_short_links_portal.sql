-- 20260916000002_dev_short_links_portal.sql
-- DEV-SHORT-LINKS: Ultra-short portal URLs for Parent and Student portals

CREATE TABLE IF NOT EXISTS public.short_links (
    code text PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    portal_type text NOT NULL DEFAULT 'parent',
    token text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_student ON public.short_links(student_id, portal_type);
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can resolve short links" ON public.short_links;
CREATE POLICY "Public can resolve short links" ON public.short_links
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages short links" ON public.short_links;
CREATE POLICY "Service role manages short links" ON public.short_links
    FOR ALL USING (true);
