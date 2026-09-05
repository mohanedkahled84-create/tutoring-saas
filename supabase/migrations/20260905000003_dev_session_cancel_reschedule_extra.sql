-- 20260905000003_dev_session_cancel_reschedule_extra.sql
-- DEV-50: Session Cancel, Reschedule, Extra Session + Auto Notification

-- 1. Update session status check constraint to support scheduled, in_progress, ended, cancelled, rescheduled
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check 
  check (status in ('scheduled', 'in_progress', 'ended', 'cancelled', 'rescheduled'));

-- 2. Add extra session and reschedule metadata columns
alter table public.sessions add column if not exists is_extra boolean not null default false;
alter table public.sessions add column if not exists rescheduled_to_date date;
alter table public.sessions add column if not exists rescheduled_to_time text;
alter table public.sessions add column if not exists cancellation_reason text;
alter table public.sessions add column if not exists extra_topic text;

create index if not exists idx_sessions_tenant_extra on public.sessions(tenant_id, is_extra);
create index if not exists idx_sessions_date on public.sessions(session_date);
