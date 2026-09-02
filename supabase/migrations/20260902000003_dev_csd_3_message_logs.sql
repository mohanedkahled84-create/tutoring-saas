-- DEV-CSD.3: Message Logs
-- Acceptance Criteria: matches the field list exactly

-- 8. message_logs
create table if not exists public.message_logs (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    student_id uuid references public.students(id) on delete set null,
    group_id uuid references public.groups(id) on delete set null,
    session_id uuid references public.sessions(id) on delete set null,
    message_type text not null check (message_type in ('attendance_absent', 'attendance_present_comment')),
    recipient_type text not null check (recipient_type in ('parent', 'student', 'system')),
    recipient_phone text not null,
    status text not null check (status in ('sent', 'failed', 'rejected', 'needs_review')),
    error_detail text,
    idempotency_key text not null,
    created_at timestamptz not null default now()
);

comment on table public.message_logs is 'Audit trail of outgoing WhatsApp messages sent via the automation engine';

-- Indexes for querying and filtering
create index if not exists idx_message_logs_tenant_id on public.message_logs(tenant_id);
create index if not exists idx_message_logs_student_id on public.message_logs(student_id);
create index if not exists idx_message_logs_session_id on public.message_logs(session_id);
create index if not exists idx_message_logs_idempotency_key on public.message_logs(idempotency_key);
create index if not exists idx_message_logs_created_at on public.message_logs(created_at);

-- Enable Row Level Security (RLS)
alter table public.message_logs enable row level security;
