-- DEV-78: Teacher Payouts & Settlement Schema
create table if not exists public.teacher_payouts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    teacher_id uuid not null references public.teachers(id) on delete cascade,
    period text not null,
    total_revenue numeric(12, 2) not null default 0,
    teacher_cut numeric(12, 2) not null default 0,
    center_cut numeric(12, 2) not null default 0,
    status text not null default 'unpaid' check (status in ('unpaid', 'paid')),
    paid_at timestamptz,
    paid_by uuid references public.users(id) on delete set null,
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint uq_teacher_payout_period unique (tenant_id, teacher_id, period)
);

create index if not exists idx_teacher_payouts_tenant on public.teacher_payouts(tenant_id);
create index if not exists idx_teacher_payouts_teacher on public.teacher_payouts(teacher_id);

alter table public.teacher_payouts enable row level security;

drop policy if exists "Admins have full access to teacher payouts" on public.teacher_payouts;
create policy "Admins have full access to teacher payouts"
    on public.teacher_payouts for all
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Center owners can manage teacher payouts" on public.teacher_payouts;
create policy "Center owners can manage teacher payouts"
    on public.teacher_payouts for all
    using (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
    )
    with check (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
    );

drop policy if exists "Teachers can view own payouts" on public.teacher_payouts;
create policy "Teachers can view own payouts"
    on public.teacher_payouts for select
    using (
        tenant_id = public.get_current_user_tenant_id()
        and (
            teacher_id in (select id from public.teachers where user_id = auth.uid())
            or public.get_current_user_role() in ('admin', 'owner', 'center_owner')
        )
    );
