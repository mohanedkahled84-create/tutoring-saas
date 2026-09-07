-- ============================================================================
-- SEC-HOTFIX Phase B (M-02): Restrict Telemetry Events Direct Ingestion to service_role
--
-- Closes security gap where any client could directly write unvalidated rows
-- into public.telemetry_events with spoofed tenant_id via Supabase Data API.
-- All telemetry ingestion is now strictly routed through the backend endpoint.
-- ============================================================================

-- 1. Drop the wide-open insert policy
drop policy if exists telemetry_events_insert_all on public.telemetry_events;

-- 2. Strictly restrict direct table inserts to service_role (used by backend ingestion endpoint)
drop policy if exists telemetry_events_service_role_insert on public.telemetry_events;
create policy telemetry_events_service_role_insert on public.telemetry_events
    for insert to service_role with check (true);

-- Ensure RLS remains enabled
alter table public.telemetry_events enable row level security;

comment on table public.telemetry_events is
  'Client and product telemetry events. Direct inserts via Data API are restricted to service_role; clients must ingest via backend API.';
