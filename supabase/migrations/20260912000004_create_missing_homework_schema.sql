-- These two tables are referenced by later migrations but were missing from
-- the repository's bootstrap chain. They already exist in the deployed schema;
-- IF NOT EXISTS keeps this migration safe to replay there while allowing a
-- fresh Supabase project to apply the full migration history.

-- The pricing migrations below use this column, but the bootstrap history
-- omitted its introduction even though it exists in the deployed schema.
ALTER TABLE public.tenants
  ADD COLUMN IF NOT EXISTS subscription_tier text DEFAULT 'growth';
ALTER TABLE public.students
  ADD COLUMN IF NOT EXISTS student_portal_sent_at timestamptz,
  ADD COLUMN IF NOT EXISTS portal_password text;

CREATE TABLE IF NOT EXISTS public.study_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid,
  teacher_id uuid,
  group_id uuid,
  title text,
  description text,
  type text DEFAULT 'pdf',
  url text DEFAULT '',
  is_homework boolean DEFAULT false,
  due_date date,
  created_at timestamptz DEFAULT now(),
  book_name text,
  pages text,
  questions text
);

CREATE TABLE IF NOT EXISTS public.homework_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES public.tenants(id),
  material_id uuid NOT NULL REFERENCES public.study_materials(id),
  student_id uuid NOT NULL REFERENCES public.students(id),
  file_url text,
  file_name text,
  file_size integer,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected')),
  teacher_notes text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  file_purged boolean DEFAULT false
);

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE UNIQUE INDEX IF NOT EXISTS uq_student_homework
  ON public.homework_submissions (material_id, student_id);

-- These tables are also present in the deployed schema and have subsequent
-- RLS migrations, but their CREATE TABLE statements were absent from history.
CREATE TABLE IF NOT EXISTS public.gift_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  discount_percent numeric,
  discount_amount numeric,
  max_uses integer,
  times_used integer DEFAULT 0,
  is_active boolean DEFAULT true,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.email_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email text NOT NULL,
  code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  verified_at timestamptz,
  attempts integer NOT NULL DEFAULT 0
);

ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;
