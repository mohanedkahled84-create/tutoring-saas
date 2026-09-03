-- DEV-30: Schema Extension — Financial Edge Cases, Academic Tracking & Assistant Role

-- 1. Extend students with financial edge case fields & student serial code
alter table public.students add column if not exists fee_override numeric(10, 2);
alter table public.students add column if not exists exempt boolean not null default false;
alter table public.students add column if not exists student_code text;

create index if not exists idx_students_tenant_student_code 
  on public.students(tenant_id, student_code) 
  where student_code is not null;

-- 2. Extend groups with pricing & billing model
alter table public.groups add column if not exists price numeric(10, 2) not null default 0;
alter table public.groups add column if not exists billing_model text not null default 'percentage' check (billing_model in ('percentage', 'fixed_rent'));
alter table public.groups add column if not exists fixed_rent_amount numeric(10, 2);

-- 3. Extend attendance with make-up session tracking & homework status
alter table public.attendance add column if not exists is_makeup boolean not null default false;
alter table public.attendance add column if not exists home_group_id uuid references public.groups(id) on delete set null;
alter table public.attendance add column if not exists homework_status text check (homework_status in ('done', 'partial', 'missing'));

create index if not exists idx_attendance_student_session 
  on public.attendance(student_id, session_id);

-- 4. Create quiz_scores table for academic tracking
create table if not exists public.quiz_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(5, 2) not null check (score >= 0),
  max_score numeric(5, 2) not null check (max_score > 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score <= max_score)
);

create index if not exists idx_quiz_scores_tenant on public.quiz_scores(tenant_id);
create index if not exists idx_quiz_scores_session on public.quiz_scores(session_id);
create index if not exists idx_quiz_scores_student on public.quiz_scores(student_id);

-- Enable RLS on quiz_scores
alter table public.quiz_scores enable row level security;

-- Drop existing policies if re-applying
drop policy if exists "Admins have full access to quiz_scores" on public.quiz_scores;
drop policy if exists "Tenant users can view quiz_scores" on public.quiz_scores;
drop policy if exists "Tenant users can insert quiz_scores" on public.quiz_scores;
drop policy if exists "Tenant users can update quiz_scores" on public.quiz_scores;
drop policy if exists "Tenant users can delete quiz_scores" on public.quiz_scores;

-- Policies for quiz_scores
create policy "Admins have full access to quiz_scores"
  on public.quiz_scores for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Tenant users can view quiz_scores"
  on public.quiz_scores for select
  using (tenant_id = public.get_current_user_tenant_id());

create policy "Tenant users can insert quiz_scores"
  on public.quiz_scores for insert
  with check (tenant_id = public.get_current_user_tenant_id());

create policy "Tenant users can update quiz_scores"
  on public.quiz_scores for update
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

create policy "Tenant users can delete quiz_scores"
  on public.quiz_scores for delete
  using (tenant_id = public.get_current_user_tenant_id());

-- 5. Extend users.role constraint to include 'assistant'
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('admin', 'owner', 'assistant'));
