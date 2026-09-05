-- 20260905000006_dev_center_system_schema.sql
-- DEV-73: Center System Schema — Centers, Teachers, Assistants, Rooms, Enrollments

-- 1. Account type on tenants table
alter table public.tenants 
  add column if not exists account_type text not null default 'teacher' 
  check (account_type in ('teacher', 'center'));

-- 2. Teachers table (sub-accounts under a Center tenant)
create table if not exists public.teachers (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    name text not null,
    phone text not null,
    subjects text[] not null default '{}'::text[],
    revenue_model text not null default 'percentage' check (revenue_model in ('percentage', 'fixed_per_student', 'fixed_total')),
    revenue_value numeric(10, 2) not null default 0,
    status text not null default 'active' check (status in ('active', 'inactive', 'invited')),
    invite_token text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_teachers_tenant on public.teachers(tenant_id);
create index if not exists idx_teachers_user on public.teachers(user_id);
create index if not exists idx_teachers_phone on public.teachers(tenant_id, phone);

-- 3. Assistants table (linked to a teacher OR to the center)
create table if not exists public.assistants (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    user_id uuid references auth.users(id) on delete set null,
    teacher_id uuid references public.teachers(id) on delete cascade, -- null means assistant to center
    name text not null,
    phone text not null,
    assistant_type text not null default 'assistant_to_center' check (assistant_type in ('assistant_to_center', 'assistant_to_teacher')),
    can_view_financials boolean not null default false,
    status text not null default 'active' check (status in ('active', 'inactive', 'invited')),
    invite_token text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create index if not exists idx_assistants_tenant on public.assistants(tenant_id);
create index if not exists idx_assistants_teacher on public.assistants(teacher_id);
create index if not exists idx_assistants_user on public.assistants(user_id);

-- 4. Rooms table (shared hall / classroom resource)
create table if not exists public.rooms (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    name text not null,
    capacity integer not null default 30 check (capacity > 0),
    created_at timestamptz not null default now()
);

create index if not exists idx_rooms_tenant on public.rooms(tenant_id);

-- 5. Enrollments table (join between student, teacher, group)
create table if not exists public.enrollments (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    teacher_id uuid references public.teachers(id) on delete cascade,
    group_id uuid not null references public.groups(id) on delete cascade,
    status text not null default 'active' check (status in ('active', 'dropped', 'suspended')),
    joined_at timestamptz not null default now(),
    constraint uq_enrollments_student_group unique (tenant_id, student_id, group_id)
);

create index if not exists idx_enrollments_tenant on public.enrollments(tenant_id);
create index if not exists idx_enrollments_student on public.enrollments(student_id);
create index if not exists idx_enrollments_teacher on public.enrollments(teacher_id);
create index if not exists idx_enrollments_group on public.enrollments(group_id);

-- 6. Add nullable center-related FKs to existing tables (zero breakage for solo-teacher accounts)
alter table public.groups 
    add column if not exists teacher_id uuid references public.teachers(id) on delete set null,
    add column if not exists room_id uuid references public.rooms(id) on delete set null;

create index if not exists idx_groups_teacher on public.groups(teacher_id);
create index if not exists idx_groups_room on public.groups(room_id);

alter table public.sessions 
    add column if not exists teacher_id uuid references public.teachers(id) on delete set null,
    add column if not exists room_id uuid references public.rooms(id) on delete set null,
    add column if not exists start_time text,
    add column if not exists end_time text;

create index if not exists idx_sessions_teacher on public.sessions(teacher_id);
create index if not exists idx_sessions_room on public.sessions(room_id);

alter table public.attendance 
    add column if not exists enrollment_id uuid references public.enrollments(id) on delete set null,
    add column if not exists teacher_id uuid references public.teachers(id) on delete set null;

create index if not exists idx_attendance_enrollment on public.attendance(enrollment_id);
create index if not exists idx_attendance_teacher on public.attendance(teacher_id);

alter table public.message_logs 
    add column if not exists teacher_id uuid references public.teachers(id) on delete set null;

create index if not exists idx_message_logs_teacher on public.message_logs(teacher_id);

-- 7. Update users role check constraint & add teacher/assistant links
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check 
    check (role in ('admin', 'owner', 'assistant', 'center_owner', 'teacher', 'assistant_to_teacher', 'assistant_to_center'));

alter table public.users 
    add column if not exists teacher_id uuid references public.teachers(id) on delete set null,
    add column if not exists assistant_id uuid references public.assistants(id) on delete set null;

-- 8. Enable Row Level Security (RLS) on all new tables
alter table public.teachers enable row level security;
alter table public.assistants enable row level security;
alter table public.rooms enable row level security;
alter table public.enrollments enable row level security;

-- Policies for teachers
drop policy if exists "Admins have full access to teachers" on public.teachers;
create policy "Admins have full access to teachers"
    on public.teachers for all
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Tenant users can view teachers" on public.teachers;
create policy "Tenant users can view teachers"
    on public.teachers for select
    using (tenant_id = public.get_current_user_tenant_id());

drop policy if exists "Center owners can manage teachers" on public.teachers;
create policy "Center owners can manage teachers"
    on public.teachers for all
    using (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
    )
    with check (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
    );

-- Policies for assistants
drop policy if exists "Admins have full access to assistants" on public.assistants;
create policy "Admins have full access to assistants"
    on public.assistants for all
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Tenant users can view assistants" on public.assistants;
create policy "Tenant users can view assistants"
    on public.assistants for select
    using (tenant_id = public.get_current_user_tenant_id());

drop policy if exists "Center owners can manage assistants" on public.assistants;
create policy "Center owners can manage assistants"
    on public.assistants for all
    using (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
    )
    with check (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
    );

-- Policies for rooms
drop policy if exists "Admins have full access to rooms" on public.rooms;
create policy "Admins have full access to rooms"
    on public.rooms for all
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Tenant users can view rooms" on public.rooms;
create policy "Tenant users can view rooms"
    on public.rooms for select
    using (tenant_id = public.get_current_user_tenant_id());

drop policy if exists "Center owners can manage rooms" on public.rooms;
create policy "Center owners can manage rooms"
    on public.rooms for all
    using (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
    )
    with check (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
    );

-- Policies for enrollments
drop policy if exists "Admins have full access to enrollments" on public.enrollments;
create policy "Admins have full access to enrollments"
    on public.enrollments for all
    using (public.is_admin())
    with check (public.is_admin());

drop policy if exists "Tenant users can view enrollments" on public.enrollments;
create policy "Tenant users can view enrollments"
    on public.enrollments for select
    using (tenant_id = public.get_current_user_tenant_id());

drop policy if exists "Tenant staff can manage enrollments" on public.enrollments;
create policy "Tenant staff can manage enrollments"
    on public.enrollments for all
    using (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher')
    )
    with check (
        tenant_id = public.get_current_user_tenant_id()
        and public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher')
    );
