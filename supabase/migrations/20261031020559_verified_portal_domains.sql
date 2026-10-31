-- Publication is not proof that an external DNS provider has issued HTTPS.
-- Only an operator that verifies the exact project domain can register a binding.
create table public.portal_domain_bindings (
  tenant_id uuid primary key references public.tenants(id) on delete cascade,
  subdomain text not null unique check (subdomain ~ '^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?$'),
  verified_at timestamptz not null default now()
);
alter table public.portal_domain_bindings enable row level security;
revoke all on public.portal_domain_bindings from public, anon, authenticated;
grant select, insert, update, delete on public.portal_domain_bindings to service_role;
create policy portal_domain_bindings_service on public.portal_domain_bindings
  for all to service_role using (true) with check (true);
