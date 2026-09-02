-- DEV-CSD.2: Sessions and Attendance
-- Acceptance Criteria: attendance.idempotency_key is unique-constrained; attendance.sent defaults false

-- 6. sessions
create table if not exists public.sessions (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    group_id uuid not null references public.groups(id) on delete cascade,
    session_number int not null,
    session_date date not null,
    created_at timestamptz not null default now()
);

comment on table public.sessions is 'Class sessions conducted for a student group';

-- 7. attendance
create table if not exists public.attendance (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    session_id uuid not null references public.sessions(id) on delete cascade,
    student_id uuid not null references public.students(id) on delete cascade,
    attended boolean not null,
    comment text,
    sent boolean not null default false,
    idempotency_key text not null unique,
    created_at timestamptz not null default now()
);

comment on table public.attendance is 'Student attendance records per session with idempotency tracking';

-- Indexes for performance
create index if not exists idx_sessions_tenant_id on public.sessions(tenant_id);
create index if not exists idx_sessions_group_id on public.sessions(group_id);
create index if not exists idx_attendance_tenant_id on public.attendance(tenant_id);
create index if not exists idx_attendance_session_id on public.attendance(session_id);
create index if not exists idx_attendance_student_id on public.attendance(student_id);

-- Enable Row Level Security (RLS)
alter table public.sessions enable row level security;
alter table public.attendance enable row level security;
