-- Migration: 20260909000005_dev89_groups_flexible_billing_and_schedule.sql
-- Supports DEV-89: 3 distinct center billing models & dedicated schedule pickers

ALTER TABLE public.groups 
  ADD COLUMN IF NOT EXISTS fixed_per_student_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS day_of_week text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_time text DEFAULT NULL;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_billing_model_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_billing_model_check 
  CHECK (billing_model = ANY (ARRAY['percentage'::text, 'fixed_per_student'::text, 'fixed_rent'::text]));
