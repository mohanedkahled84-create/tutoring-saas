-- Service-only, short-lived cross-origin portal handoffs. No reusable portal tokens.
create table public.portal_handoffs (
  ticket_hash text primary key check (ticket_hash ~ '^[a-f0-9]{64}$'),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  portal_role text not null check (portal_role in ('student', 'parent')),
  target_origin text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index portal_handoffs_expiry_idx on public.portal_handoffs(expires_at);
alter table public.portal_handoffs enable row level security;
revoke all on public.portal_handoffs from public, anon, authenticated;
grant select, insert, delete on public.portal_handoffs to service_role;
create policy portal_handoffs_service on public.portal_handoffs
  for all to service_role using (true) with check (true);
