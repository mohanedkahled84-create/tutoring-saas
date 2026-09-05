-- DEV-CSD.1: Core Entities (Tenants, Users, Students, Groups, Group_Students)
-- Multi-Tenant from Day 1: Every tenant-scoped table enforces tenant_id NOT NULL FK

-- 1. tenants
create table if not exists public.tenants (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    status text not null check (status in ('active', 'paused', 'cancelled')) default 'active',
    created_at timestamptz not null default now()
);

comment on table public.tenants is 'Tenants representing teachers or tutoring centers';

-- 2. users (maps 1-to-1 with auth.users)
create table if not exists public.users (
    id uuid primary key references auth.users(id) on delete cascade,
    tenant_id uuid references public.tenants(id) on delete cascade, -- NULL for platform admins only
    role text not null check (role in ('admin', 'owner')),
    email text not null,
    created_at timestamptz not null default now()
);

comment on table public.users is 'Application users mapped to Supabase auth.users with tenant association and roles';

-- 3. students
create table if not exists public.students (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    parent_phone text not null,
    student_phone text,
    notes text,
    created_at timestamptz not null default now()
);

comment on table public.students is 'Students belonging to a tenant';

-- 4. groups
create table if not exists public.groups (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    created_at timestamptz not null default now()
);

comment on table public.groups is 'Student groups or study classes';

-- 5. group_students
create table if not exists public.group_students (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    group_id uuid not null references public.groups(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    constraint group_students_unique_student_group unique (group_id, student_id)
);

comment on table public.group_students is 'Many-to-many relationship linking students to groups within a tenant';

-- Foreign key indexes for multi-tenant query performance
create index if not exists idx_users_tenant_id on public.users(tenant_id);
create index if not exists idx_students_tenant_id on public.students(tenant_id);
create index if not exists idx_groups_tenant_id on public.groups(tenant_id);
create index if not exists idx_group_students_tenant_id on public.group_students(tenant_id);
create index if not exists idx_group_students_student_id on public.group_students(student_id);
create index if not exists idx_group_students_group_id on public.group_students(group_id);

-- Enable Row Level Security (RLS) on all tables
alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.students enable row level security;
alter table public.groups enable row level security;
alter table public.group_students enable row level security;
