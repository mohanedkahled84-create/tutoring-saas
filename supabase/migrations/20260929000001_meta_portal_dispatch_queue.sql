-- 20260929000001_meta_portal_dispatch_queue.sql
-- Queue and tracking table for official Meta WhatsApp Cloud API portal links dispatch

CREATE TABLE IF NOT EXISTS public.meta_portal_dispatch_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    teacher_id UUID,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    recipient_type VARCHAR(16) NOT NULL, -- 'student' or 'parent'
    recipient_phone VARCHAR(32) NOT NULL,
    template_name VARCHAR(64) NOT NULL, -- 'centerly' or 'centerly_student'
    language_code VARCHAR(16) NOT NULL DEFAULT 'en',
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['Student Name', 'Subject', 'Teacher Name']
    status VARCHAR(16) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'queued'
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meta_message_id VARCHAR(128),
    error_message TEXT,
    attempts INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_queue_status_date ON public.meta_portal_dispatch_queue(status, scheduled_date, created_at);
CREATE INDEX IF NOT EXISTS idx_meta_queue_tenant ON public.meta_portal_dispatch_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_queue_student ON public.meta_portal_dispatch_queue(student_id);

ALTER TABLE public.meta_portal_dispatch_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'meta_portal_dispatch_queue' 
        AND policyname = 'meta_queue_service_role'
    ) THEN
        CREATE POLICY meta_queue_service_role ON public.meta_portal_dispatch_queue
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'meta_portal_dispatch_queue' 
        AND policyname = 'meta_queue_tenant_select'
    ) THEN
        CREATE POLICY meta_queue_tenant_select ON public.meta_portal_dispatch_queue
            FOR SELECT TO authenticated
            USING (tenant_id = (auth.jwt() ->> 'tenant_id') OR tenant_id = 'default');
    END IF;
END $$;
