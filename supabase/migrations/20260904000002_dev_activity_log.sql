-- DEV-44: Audit Trail / Activity Log Table & Append-Only RLS

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid references public.users(id),
  action_type text not null check (action_type in ('attendance_record', 'attendance_edit', 'session_open', 'session_close', 'quiz_score_record')),
  entity_type text not null check (entity_type in ('attendance', 'session', 'quiz_score')),
  entity_id uuid not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_tenant on public.activity_logs(tenant_id);
create index if not exists idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);
create index if not exists idx_activity_logs_created on public.activity_logs(created_at desc);

-- Enable RLS
alter table public.activity_logs enable row level security;

-- Policies: Strictly append-only (Insert and Select only; NO UPDATE OR DELETE)
drop policy if exists "Admins have full read access to activity_logs" on public.activity_logs;
drop policy if exists "Tenant owners can read their activity logs" on public.activity_logs;
drop policy if exists "Authenticated users can insert activity logs for their tenant" on public.activity_logs;

create policy "Admins have full read access to activity_logs"
  on public.activity_logs for select
  using (public.is_admin());

create policy "Tenant owners can read their activity logs"
  on public.activity_logs for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and public.get_current_user_role() in ('admin', 'owner')
  );

create policy "Authenticated users can insert activity logs for their tenant"
  on public.activity_logs for insert
  with check (tenant_id = public.get_current_user_tenant_id());
