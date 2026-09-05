-- DEV-39: Subscription Lifecycle — Trial, Manual Payment Verification, Renewal & Auto-Deactivation

-- 1. Extend tenants table with subscription status and lifecycle timestamps
alter table public.tenants add column if not exists subscription_status text not null default 'trial' 
  check (subscription_status in ('trial', 'active', 'pending_verification', 'past_due', 'deactivated'));

alter table public.tenants add column if not exists trial_ends_at timestamptz not null default (now() + interval '14 days');
alter table public.tenants add column if not exists subscription_ends_at timestamptz;
alter table public.tenants add column if not exists deleted_at timestamptz;

create index if not exists idx_tenants_subscription_status on public.tenants(subscription_status);

-- 2. Create payment_proofs table
create table if not exists public.payment_proofs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  submitted_by uuid not null references public.users(id),
  amount numeric(10, 2) not null check (amount > 0),
  payment_method text not null check (payment_method in ('instapay', 'vodafone_cash', 'bank_transfer', 'cash', 'other')),
  reference_number text,
  proof_image_url text,
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  admin_notes text,
  reviewed_by uuid references public.users(id),
  reviewed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_payment_proofs_tenant on public.payment_proofs(tenant_id);
create index if not exists idx_payment_proofs_status on public.payment_proofs(status);

-- Enable RLS on payment_proofs
alter table public.payment_proofs enable row level security;

-- Policies for payment_proofs
drop policy if exists "Admins have full access to payment_proofs" on public.payment_proofs;
drop policy if exists "Tenant owners can view their payment proofs" on public.payment_proofs;
drop policy if exists "Tenant owners can submit payment proofs" on public.payment_proofs;

create policy "Admins have full access to payment_proofs"
  on public.payment_proofs for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Tenant owners can view their payment proofs"
  on public.payment_proofs for select
  using (tenant_id = public.get_current_user_tenant_id());

create policy "Tenant owners can submit payment proofs"
  on public.payment_proofs for insert
  with check (
    tenant_id = public.get_current_user_tenant_id() 
    and public.get_current_user_role() = 'owner'
  );
