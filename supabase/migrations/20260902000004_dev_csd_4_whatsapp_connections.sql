-- DEV-CSD.4: WhatsApp Connections (with secret encryption via Supabase Vault)
-- Acceptance Criteria: any API key field uses Supabase Vault or pgsodium encryption, never plain text

-- 9. whatsapp_connections
create table if not exists public.whatsapp_connections (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null unique references public.tenants(id) on delete cascade,
    provider text not null check (provider in ('evolution', 'cloud_api')),
    instance_url text not null,
    instance_status text not null check (instance_status in ('connected', 'disconnected', 'pending')),
    api_key_secret_id uuid references vault.secrets(id) on delete set null,
    connected_at timestamptz,
    created_at timestamptz not null default now()
);

comment on table public.whatsapp_connections is 'WhatsApp instance connectivity configurations per tenant; API keys are encrypted at rest in Supabase Vault';

-- Index for tenant lookup
create index if not exists idx_whatsapp_connections_tenant_id on public.whatsapp_connections(tenant_id);

-- Enable Row Level Security (RLS)
alter table public.whatsapp_connections enable row level security;
