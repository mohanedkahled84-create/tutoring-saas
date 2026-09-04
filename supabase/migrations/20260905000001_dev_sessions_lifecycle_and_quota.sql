-- 20260905000001_dev_sessions_lifecycle_and_quota.sql
-- DEV-13 & DEV-36: Session Lifecycle (in_progress, ended, cancelled) & WhatsApp Send Tracking

-- 1. Extend sessions table with lifecycle status and ended_at timestamp
alter table public.sessions add column if not exists status text not null default 'in_progress' check (status in ('in_progress', 'ended', 'cancelled'));
alter table public.sessions add column if not exists ended_at timestamptz;

create index if not exists idx_sessions_tenant_status on public.sessions(tenant_id, status);

-- 2. Extend whatsapp_connections table with daily send tracking
alter table public.whatsapp_connections add column if not exists sent_today int not null default 0;
alter table public.whatsapp_connections add column if not exists last_sent_date date default current_date;
alter table public.whatsapp_connections add column if not exists daily_limit int not null default 500;
