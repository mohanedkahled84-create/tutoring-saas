-- 20260905000005_dev_telemetry_events.sql
-- DEV-55: Website/Product Behavior Tracking Integration

create table if not exists public.telemetry_events (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete set null,
    event_name text not null,
    properties jsonb not null default '{}'::jsonb,
    session_id text,
    page_path text,
    created_at timestamptz not null default now()
);

create index if not exists idx_telemetry_events_name on public.telemetry_events(event_name);
create index if not exists idx_telemetry_events_created_at on public.telemetry_events(created_at);
create index if not exists idx_telemetry_events_tenant on public.telemetry_events(tenant_id);

-- RLS: Platform admins can query telemetry; public can insert via secured endpoint
alter table public.telemetry_events enable row level security;

create policy telemetry_events_insert_all on public.telemetry_events
    for insert with check (true);

create policy telemetry_events_admin_select on public.telemetry_events
    for select using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() and users.role = 'admin'
        )
    );
