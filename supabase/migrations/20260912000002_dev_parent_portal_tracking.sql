-- 20260912000002_dev_parent_portal_tracking.sql
-- Adds parent portal permanent token and dispatch tracking columns to students table

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS parent_portal_token text,
ADD COLUMN IF NOT EXISTS parent_portal_sent_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_students_parent_portal_sent_at ON public.students(tenant_id, parent_portal_sent_at);
