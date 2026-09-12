-- Migration: 20260912000001_dev_quizzes_management_and_persistence.sql
-- Description: Create quizzes table and extend quiz_scores to persist standalone group quizzes, scores, notes, and delivery status.

-- 1. Create quizzes table
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  quiz_number integer not null,
  title text not null,
  max_score numeric(5, 2) not null default 10,
  quiz_date date default current_date,
  is_skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, group_id, quiz_number)
);

create index if not exists idx_quizzes_tenant_group on public.quizzes(tenant_id, group_id);

alter table public.quizzes enable row level security;

drop policy if exists "Tenant users full access to quizzes" on public.quizzes;
create policy "Tenant users full access to quizzes"
  on public.quizzes for all
  using (true)
  with check (true);

-- 2. Alter quiz_scores table to support group-level standalone quizzes
alter table public.quiz_scores alter column session_id drop not null;
alter table public.quiz_scores add column if not exists quiz_id uuid references public.quizzes(id) on delete cascade;
alter table public.quiz_scores add column if not exists group_id uuid references public.groups(id) on delete cascade;
alter table public.quiz_scores add column if not exists quiz_number integer;
alter table public.quiz_scores add column if not exists note text;
alter table public.quiz_scores add column if not exists delivery_status text default 'pending';

create index if not exists idx_quiz_scores_group on public.quiz_scores(group_id);
create index if not exists idx_quiz_scores_quiz on public.quiz_scores(quiz_id);
