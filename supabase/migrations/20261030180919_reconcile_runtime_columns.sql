-- Additive reconciliation of runtime columns already present in production.
-- Historical migrations alone did not reproduce these fields in the test DB.
-- IF NOT EXISTS preserves all existing production values and constraints.
alter table public.assistants add column if not exists salary numeric default 0;
alter table public.assistants add column if not exists group_id uuid;
alter table public.assistants add column if not exists role_type text default 'both';
alter table public.assistants add column if not exists salary_model text default 'monthly';
alter table public.groups add column if not exists subject text;
alter table public.groups add column if not exists schedule text;
alter table public.groups add column if not exists sessions_per_week integer default 1;
alter table public.rooms add column if not exists hourly_rate numeric default 0;
alter table public.students add column if not exists group_id uuid;
