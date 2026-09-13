-- 20260913000001_dev_homework_file_purge_on_approval.sql
-- Allow file_url to be nullable when homework is approved and file is purged from storage
ALTER TABLE public.homework_submissions ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS file_purged boolean DEFAULT false;
