-- Centrly Complete Multi-Tenant Database Schema Bundle
-- Generated for Test / Staging Supabase Database Setup

-- ==========================================
-- MIGRATION: 20260902000001_dev_csd_1_core_entities.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 20260902000002_dev_csd_2_sessions_attendance.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 20260902000003_dev_csd_3_message_logs.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 20260902000004_dev_csd_4_whatsapp_connections.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 20260903000001_dev_csd_rls_policies.sql
-- ==========================================
-- DEV-RLS.1 & DEV-RLS.2: Row Level Security & Tenant Isolation Policies
-- Ensures complete isolation between tenants at the PostgreSQL engine level.

-- Helper functions (Security Definer with secure search_path)
create or replace function public.get_current_user_role()
returns text
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select role from public.users where id = auth.uid();
$$;

create or replace function public.get_current_user_tenant_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select tenant_id from public.users where id = auth.uid();
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(public.get_current_user_role() = 'admin', false);
$$;

-- 1. tenants policies
drop policy if exists "Admins have full access to tenants" on public.tenants;
create policy "Admins have full access to tenants"
  on public.tenants for all
  using (public.is_admin());

drop policy if exists "Tenant owners can view own tenant" on public.tenants;
create policy "Tenant owners can view own tenant"
  on public.tenants for select
  using (id = public.get_current_user_tenant_id());

drop policy if exists "Tenant owners can update own tenant" on public.tenants;
create policy "Tenant owners can update own tenant"
  on public.tenants for update
  using (id = public.get_current_user_tenant_id())
  with check (id = public.get_current_user_tenant_id());

-- 2. users policies
drop policy if exists "Admins have full access to users" on public.users;
create policy "Admins have full access to users"
  on public.users for all
  using (public.is_admin());

drop policy if exists "Users can view members of own tenant" on public.users;
create policy "Users can view members of own tenant"
  on public.users for select
  using (tenant_id = public.get_current_user_tenant_id() or id = auth.uid());

drop policy if exists "Users can update own record" on public.users;
create policy "Users can update own record"
  on public.users for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- 3. students policies
drop policy if exists "Admins have full access to students" on public.students;
create policy "Admins have full access to students"
  on public.students for all
  using (public.is_admin());

drop policy if exists "Tenant owners manage own students" on public.students;
create policy "Tenant owners manage own students"
  on public.students for all
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- 4. groups policies
drop policy if exists "Admins have full access to groups" on public.groups;
create policy "Admins have full access to groups"
  on public.groups for all
  using (public.is_admin());

drop policy if exists "Tenant owners manage own groups" on public.groups;
create policy "Tenant owners manage own groups"
  on public.groups for all
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- 5. group_students policies
drop policy if exists "Admins have full access to group_students" on public.group_students;
create policy "Admins have full access to group_students"
  on public.group_students for all
  using (public.is_admin());

drop policy if exists "Tenant owners manage own group_students" on public.group_students;
create policy "Tenant owners manage own group_students"
  on public.group_students for all
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- 6. sessions policies
drop policy if exists "Admins have full access to sessions" on public.sessions;
create policy "Admins have full access to sessions"
  on public.sessions for all
  using (public.is_admin());

drop policy if exists "Tenant owners manage own sessions" on public.sessions;
create policy "Tenant owners manage own sessions"
  on public.sessions for all
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- 7. attendance policies
drop policy if exists "Admins have full access to attendance" on public.attendance;
create policy "Admins have full access to attendance"
  on public.attendance for all
  using (public.is_admin());

drop policy if exists "Tenant owners manage own attendance" on public.attendance;
create policy "Tenant owners manage own attendance"
  on public.attendance for all
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

-- 8. message_logs policies
drop policy if exists "Admins have full access to message_logs" on public.message_logs;
create policy "Admins have full access to message_logs"
  on public.message_logs for all
  using (public.is_admin());

drop policy if exists "Tenant owners view own message_logs" on public.message_logs;
create policy "Tenant owners view own message_logs"
  on public.message_logs for select
  using (tenant_id = public.get_current_user_tenant_id());

drop policy if exists "Tenant owners insert own message_logs" on public.message_logs;
create policy "Tenant owners insert own message_logs"
  on public.message_logs for insert
  with check (tenant_id = public.get_current_user_tenant_id());

-- 9. whatsapp_connections policies
drop policy if exists "Admins have full access to whatsapp_connections" on public.whatsapp_connections;
create policy "Admins have full access to whatsapp_connections"
  on public.whatsapp_connections for all
  using (public.is_admin());

drop policy if exists "Tenant owners manage own whatsapp_connection" on public.whatsapp_connections;
create policy "Tenant owners manage own whatsapp_connection"
  on public.whatsapp_connections for all
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());


-- ==========================================
-- MIGRATION: 20260903000002_dev_wpa_internal_rpc.sql
-- ==========================================
-- DEV-WPA.1: Helper RPC function to safely retrieve tenant WhatsApp connection and decrypted Vault secret
create or replace function public.get_tenant_whatsapp_connection(p_tenant_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res json;
begin
  select json_build_object(
    'provider', wc.provider,
    'instance_url', wc.instance_url,
    'instance_status', wc.instance_status,
    'api_key', ds.decrypted_secret
  ) into v_res
  from public.whatsapp_connections wc
  left join vault.decrypted_secrets ds on wc.api_key_secret_id = ds.id
  where wc.tenant_id = p_tenant_id;

  return v_res;
end;
$$;

-- Grant execution to authenticated & service roles
grant execute on function public.get_tenant_whatsapp_connection(uuid) to service_role, postgres, authenticated, anon;


-- ==========================================
-- MIGRATION: 20260903000003_dev_features_enhancement.sql
-- ==========================================
-- 20260903000003_dev_features_enhancement.sql
-- Adds: Student auto-increment code support, Group center cuts/financials, Attendance quiz grades & WhatsApp delivery status, and Message templates.

-- 1. Extend students table
alter table public.students add column if not exists code text;
create index if not exists idx_students_tenant_code on public.students(tenant_id, code);

-- Function to assign auto-incrementing student code starting from 1001 per tenant if not provided
create or replace function public.assign_student_code()
returns trigger as $$
declare
    max_code int;
begin
    if new.code is null or new.code = '' then
        select coalesce(max(case when code ~ '^[0-9]+$' then code::int else 1000 end), 1000)
        into max_code
        from public.students
        where tenant_id = new.tenant_id;

        new.code := (max_code + 1)::text;
    end if;
    return new;
end;
$$ language plpgsql;

drop trigger if exists trg_assign_student_code on public.students;
create trigger trg_assign_student_code
before insert on public.students
for each row execute function public.assign_student_code();


-- 2. Extend groups table for Center and Financial calculations
alter table public.groups add column if not exists center_name text;
alter table public.groups add column if not exists session_price numeric(10,2) not null default 0;
alter table public.groups add column if not exists center_cut_percentage numeric(5,2) not null default 0;
alter table public.groups add column if not exists teacher_cut_percentage numeric(5,2) not null default 100;


alter table public.attendance add column if not exists homework_status text not null default 'done' check (homework_status in ('done', 'partial', 'missing'));
alter table public.attendance add column if not exists is_makeup boolean not null default false;
alter table public.attendance add column if not exists quiz_score numeric(5,2) default null;
alter table public.attendance add column if not exists quiz_max_score numeric(5,2) default 20;
alter table public.attendance add column if not exists checkin_time timestamptz default null;
alter table public.attendance add column if not exists wa_status text not null default 'pending' check (wa_status in ('pending', 'queued', 'sent', 'failed'));
alter table public.attendance add column if not exists quiz_wa_status text not null default 'pending' check (quiz_wa_status in ('pending', 'queued', 'sent', 'failed'));

create index if not exists idx_attendance_homework_status on public.attendance(tenant_id, homework_status);
create index if not exists idx_attendance_wa_status on public.attendance(tenant_id, wa_status);
create index if not exists idx_attendance_quiz_wa_status on public.attendance(tenant_id, quiz_wa_status);


-- 4. Create message_templates table for Anti-Ban Spintax variants
create table if not exists public.message_templates (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references public.tenants(id) on delete cascade,
    template_type text not null check (template_type in ('attendance_present', 'attendance_absent', 'quiz_result', 'quiz_absent', 'welcome_student', 'welcome_parent', 'custom')),
    variants text[] not null default '{}',
    is_active boolean not null default true,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),
    constraint message_templates_tenant_type_unique unique (tenant_id, template_type)
);

create index if not exists idx_message_templates_tenant on public.message_templates(tenant_id);

-- Enable RLS for message_templates
alter table public.message_templates enable row level security;

create policy "Tenant users can view their message templates"
    on public.message_templates
    for select
    to authenticated
    using (
        tenant_id = (select tenant_id from public.users where id = auth.uid())
    );

create policy "Tenant users can manage their message templates"
    on public.message_templates
    for all
    to authenticated
    using (
        tenant_id = (select tenant_id from public.users where id = auth.uid())
    )
    with check (
        tenant_id = (select tenant_id from public.users where id = auth.uid())
    );


-- ==========================================
-- MIGRATION: 20260903000003_dev_schema_extension.sql
-- ==========================================
-- DEV-30: Schema Extension — Financial Edge Cases, Academic Tracking & Assistant Role

-- 1. Extend students with financial edge case fields & student serial code
alter table public.students add column if not exists fee_override numeric(10, 2);
alter table public.students add column if not exists exempt boolean not null default false;
alter table public.students add column if not exists student_code text;

create index if not exists idx_students_tenant_student_code 
  on public.students(tenant_id, student_code) 
  where student_code is not null;

-- 2. Extend groups with pricing & billing model
alter table public.groups add column if not exists price numeric(10, 2) not null default 0;
alter table public.groups add column if not exists billing_model text not null default 'percentage' check (billing_model in ('percentage', 'fixed_rent'));
alter table public.groups add column if not exists fixed_rent_amount numeric(10, 2);

-- 3. Extend attendance with make-up session tracking & homework status
alter table public.attendance add column if not exists is_makeup boolean not null default false;
alter table public.attendance add column if not exists home_group_id uuid references public.groups(id) on delete set null;
alter table public.attendance add column if not exists homework_status text check (homework_status in ('done', 'partial', 'missing'));

create index if not exists idx_attendance_student_session 
  on public.attendance(student_id, session_id);

-- 4. Create quiz_scores table for academic tracking
create table if not exists public.quiz_scores (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  session_id uuid not null references public.sessions(id) on delete cascade,
  student_id uuid not null references public.students(id) on delete cascade,
  score numeric(5, 2) not null check (score >= 0),
  max_score numeric(5, 2) not null check (max_score > 0),
  idempotency_key text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (score <= max_score)
);

create index if not exists idx_quiz_scores_tenant on public.quiz_scores(tenant_id);
create index if not exists idx_quiz_scores_session on public.quiz_scores(session_id);
create index if not exists idx_quiz_scores_student on public.quiz_scores(student_id);

-- Enable RLS on quiz_scores
alter table public.quiz_scores enable row level security;

-- Drop existing policies if re-applying
drop policy if exists "Admins have full access to quiz_scores" on public.quiz_scores;
drop policy if exists "Tenant users can view quiz_scores" on public.quiz_scores;
drop policy if exists "Tenant users can insert quiz_scores" on public.quiz_scores;
drop policy if exists "Tenant users can update quiz_scores" on public.quiz_scores;
drop policy if exists "Tenant users can delete quiz_scores" on public.quiz_scores;

-- Policies for quiz_scores
create policy "Admins have full access to quiz_scores"
  on public.quiz_scores for all
  using (public.is_admin())
  with check (public.is_admin());

create policy "Tenant users can view quiz_scores"
  on public.quiz_scores for select
  using (tenant_id = public.get_current_user_tenant_id());

create policy "Tenant users can insert quiz_scores"
  on public.quiz_scores for insert
  with check (tenant_id = public.get_current_user_tenant_id());

create policy "Tenant users can update quiz_scores"
  on public.quiz_scores for update
  using (tenant_id = public.get_current_user_tenant_id())
  with check (tenant_id = public.get_current_user_tenant_id());

create policy "Tenant users can delete quiz_scores"
  on public.quiz_scores for delete
  using (tenant_id = public.get_current_user_tenant_id());

-- 5. Extend users.role constraint to include 'assistant'
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check check (role in ('admin', 'owner', 'assistant'));


-- ==========================================
-- MIGRATION: 20260904000001_dev_subscription_lifecycle.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 20260904000002_dev_activity_log.sql
-- ==========================================
-- DEV-44: Audit Trail / Activity Log Table & Append-Only RLS

create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  actor_user_id uuid references public.users(id),
  action_type text not null check (action_type in ('attendance_record', 'attendance_edit', 'session_open', 'session_close', 'quiz_score_record')),
  entity_type text not null check (entity_type in ('attendance', 'session', 'quiz_score')),
  entity_id uuid not null,
  before_value jsonb,
  after_value jsonb,
  created_at timestamptz not null default now()
);

create index if not exists idx_activity_logs_tenant on public.activity_logs(tenant_id);
create index if not exists idx_activity_logs_entity on public.activity_logs(entity_type, entity_id);
create index if not exists idx_activity_logs_created on public.activity_logs(created_at desc);

-- Enable RLS
alter table public.activity_logs enable row level security;

-- Policies: Strictly append-only (Insert and Select only; NO UPDATE OR DELETE)
drop policy if exists "Admins have full read access to activity_logs" on public.activity_logs;
drop policy if exists "Tenant owners can read their activity logs" on public.activity_logs;
drop policy if exists "Authenticated users can insert activity logs for their tenant" on public.activity_logs;

create policy "Admins have full read access to activity_logs"
  on public.activity_logs for select
  using (public.is_admin());

create policy "Tenant owners can read their activity logs"
  on public.activity_logs for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and public.get_current_user_role() in ('admin', 'owner')
  );

create policy "Authenticated users can insert activity logs for their tenant"
  on public.activity_logs for insert
  with check (tenant_id = public.get_current_user_tenant_id());


-- ==========================================
-- MIGRATION: 20260905000001_dev_sessions_lifecycle_and_quota.sql
-- ==========================================
-- 20260905000001_dev_sessions_lifecycle_and_quota.sql
-- DEV-13 & DEV-36: Session Lifecycle (in_progress, ended, cancelled) & WhatsApp Send Tracking

-- 1. Extend sessions table with lifecycle status and ended_at timestamp
alter table public.sessions add column if not exists status text not null default 'in_progress' check (status in ('in_progress', 'ended', 'cancelled'));
alter table public.sessions add column if not exists ended_at timestamptz;

create index if not exists idx_sessions_tenant_status on public.sessions(tenant_id, status);

-- 2. Extend whatsapp_connections table with daily send tracking
alter table public.whatsapp_connections add column if not exists sent_today int not null default 0;
alter table public.whatsapp_connections add column if not exists last_sent_date date default current_date;
alter table public.whatsapp_connections add column if not exists daily_limit int not null default 500;


-- ==========================================
-- MIGRATION: 20260905000002_dev_tenant_workflow_settings.sql
-- ==========================================
-- 20260905000002_dev_tenant_workflow_settings.sql
-- DEV-38: Tenant-Configurable Workflow Settings

alter table public.tenants 
  add column if not exists settings jsonb not null 
  default '{"homework_submission": "in_session", "auto_notification": true, "enable_top_performers": true}'::jsonb;


-- ==========================================
-- MIGRATION: 20260905000003_dev_session_cancel_reschedule_extra.sql
-- ==========================================
-- 20260905000003_dev_session_cancel_reschedule_extra.sql
-- DEV-50: Session Cancel, Reschedule, Extra Session + Auto Notification

-- 1. Update session status check constraint to support scheduled, in_progress, ended, cancelled, rescheduled
alter table public.sessions drop constraint if exists sessions_status_check;
alter table public.sessions add constraint sessions_status_check 
  check (status in ('scheduled', 'in_progress', 'ended', 'cancelled', 'rescheduled'));

-- 2. Add extra session and reschedule metadata columns
alter table public.sessions add column if not exists is_extra boolean not null default false;
alter table public.sessions add column if not exists rescheduled_to_date date;
alter table public.sessions add column if not exists rescheduled_to_time text;
alter table public.sessions add column if not exists cancellation_reason text;
alter table public.sessions add column if not exists extra_topic text;

create index if not exists idx_sessions_tenant_extra on public.sessions(tenant_id, is_extra);
create index if not exists idx_sessions_date on public.sessions(session_date);


-- ==========================================
-- MIGRATION: 20260905000004_dev_class_subgroups_sections.sql
-- ==========================================
-- 20260905000004_dev_class_subgroups_sections.sql
-- DEV-49: Class Sub-Groups (Sections) per Teacher

-- 1. Extend groups table with self-referencing hierarchy for sections
alter table public.groups add column if not exists parent_group_id uuid references public.groups(id) on delete cascade;
alter table public.groups add column if not exists is_section boolean not null default false;
alter table public.groups add column if not exists section_name text;

create index if not exists idx_groups_parent_group on public.groups(parent_group_id);
create index if not exists idx_groups_tenant_sections on public.groups(tenant_id, is_section);


-- ==========================================
-- MIGRATION: 20260905000005_dev_telemetry_events.sql
-- ==========================================
-- 20260905000005_dev_telemetry_events.sql
-- DEV-55: Website/Product Behavior Tracking Integration

create table if not exists public.telemetry_events (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid references public.tenants(id) on delete set null,
    event_name text not null,
    properties jsonb not null default '{}'::jsonb,
    session_id text,
    page_path text,
    created_at timestamptz not null default now()
);

create index if not exists idx_telemetry_events_name on public.telemetry_events(event_name);
create index if not exists idx_telemetry_events_created_at on public.telemetry_events(created_at);
create index if not exists idx_telemetry_events_tenant on public.telemetry_events(tenant_id);

-- RLS: Platform admins can query telemetry; public can insert via secured endpoint
alter table public.telemetry_events enable row level security;

create policy telemetry_events_insert_all on public.telemetry_events
    for insert with check (true);

create policy telemetry_events_admin_select on public.telemetry_events
    for select using (
        exists (
            select 1 from public.users
            where users.id = auth.uid() and users.role = 'admin'
        )
    );


-- ==========================================
-- MIGRATION: 20260905000006_dev_center_system_schema.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 20260905000007_dev_teacher_payouts_schema.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 20260906000001_sec_hotfix_c01_whatsapp_rpc.sql
-- ==========================================
-- ============================================================================
-- SEC-HOTFIX Phase B (C-01): Restrict WhatsApp Secret Decryption RPC & Safe Status RPC
-- 
-- Fixes critical vulnerability where public.get_tenant_whatsapp_connection(uuid)
-- was executable by anon and authenticated roles without tenant ownership checks,
-- leaking decrypted Vault secrets.
-- ============================================================================

-- 1. Revoke public/anon/authenticated execution from secret-decrypting function
revoke execute on function public.get_tenant_whatsapp_connection(uuid) from public, anon, authenticated;
grant execute on function public.get_tenant_whatsapp_connection(uuid) to service_role, postgres;

-- 2. Safe, non-leaking status RPC for authenticated clients (Security Invoker, strictly enforces RLS & tenant check)
create or replace function public.get_tenant_whatsapp_status(p_tenant_id uuid)
returns json
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_res json;
begin
  -- Enforce tenant ownership verification
  if p_tenant_id is distinct from public.get_current_user_tenant_id() and not public.is_admin() then
    raise exception 'Unauthorized: access denied to tenant WhatsApp status' using errcode = '42501';
  end if;

  select json_build_object(
    'provider', wc.provider,
    'instance_url', wc.instance_url,
    'instance_status', wc.instance_status,
    'is_configured', (wc.api_key_secret_id is not null)
  ) into v_res
  from public.whatsapp_connections wc
  where wc.tenant_id = p_tenant_id;

  return v_res;
end;
$$;

revoke execute on function public.get_tenant_whatsapp_status(uuid) from anon, public;
grant execute on function public.get_tenant_whatsapp_status(uuid) to authenticated, service_role, postgres;

comment on function public.get_tenant_whatsapp_connection(uuid) is
  'INTERNAL SERVICE ROLE ONLY: Returns decrypted WhatsApp credentials for n8n automation. Strictly inaccessible to clients.';

comment on function public.get_tenant_whatsapp_status(uuid) is
  'CLIENT SAFE: Returns sanitized WhatsApp connectivity metadata without exposing decrypted credentials. Enforces tenant boundary.';


-- ==========================================
-- MIGRATION: 20260906000002_sec_hotfix_m02_telemetry_rls.sql
-- ==========================================
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


-- ==========================================
-- MIGRATION: 20260909000001_sec_hotfix_c05_remove_demo_tenant_fallback.sql
-- ==========================================
-- SEC-HOTFIX: Remove dangerous demo-tenant fallback from get_current_user_tenant_id()
-- (fix applied live on Supabase 2026-09-09 by Claude — this just syncs the repo)

CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select tenant_id from public.users where id = auth.uid()),
    nullif(current_setting('request.jwt.claim.tenant_id', true), '')::uuid
  );
$function$;


-- ==========================================
-- MIGRATION: 20260909000002_dev78_center_rls_permission_scoping.sql
-- ==========================================
-- DEV-78: Assistant/Teacher Permission Scoping (RLS Leak Prevention)
-- Enforces confirmed multi-role permission scoping for Center accounts:
-- 1. teacher: sees only their own data (groups, sessions, attendance, enrollments, students, payouts)
-- 2. assistant-to-teacher: scoped to that one teacher, no financials by default
-- 3. assistant-to-center: sees all teachers' operational data, but NO financials by default
-- 4. center_owner / owner / admin: sees everything in their tenant

-- ============================================================================
-- 1. Helper Functions
-- ============================================================================

-- Returns the effective teacher_id for the current authenticated user
-- (works for teacher accounts and assistants assigned to a specific teacher)
create or replace function public.get_current_user_teacher_id()
returns uuid
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select coalesce(
    (select teacher_id from public.users where id = auth.uid()),
    (select id from public.teachers where user_id = auth.uid() limit 1),
    (select teacher_id from public.assistants where user_id = auth.uid() limit 1)
  );
$$;

grant execute on function public.get_current_user_teacher_id() to authenticated, service_role, postgres;
revoke execute on function public.get_current_user_teacher_id() from anon, public;

-- Determines whether the current user is permitted to view financial records (e.g. teacher payouts)
create or replace function public.can_current_user_view_financials()
returns boolean
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_role text := public.get_current_user_role();
  v_can_view boolean := false;
begin
  -- Admins, owners, and teachers (for their own payout) have financial visibility
  if v_role in ('admin', 'owner', 'center_owner', 'teacher') then
    return true;
  end if;

  -- Assistants only have financial visibility if can_view_financials flag is explicitly granted
  if v_role in ('assistant', 'assistant_to_center', 'assistant_to_teacher') then
    select coalesce(can_view_financials, false) into v_can_view
    from public.assistants
    where user_id = auth.uid()
       or id = (select assistant_id from public.users where id = auth.uid())
    limit 1;
    return coalesce(v_can_view, false);
  end if;

  return false;
end;
$$;

grant execute on function public.can_current_user_view_financials() to authenticated, service_role, postgres;
revoke execute on function public.can_current_user_view_financials() from anon, public;

-- ============================================================================
-- 2. Groups Table Policies
-- ============================================================================

drop policy if exists "Tenant owners manage own groups" on public.groups;
drop policy if exists "Tenant scoped groups select" on public.groups;
drop policy if exists "Tenant scoped groups modify" on public.groups;

create policy "Tenant scoped groups select" on public.groups
  for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          teacher_id = public.get_current_user_teacher_id()
          or (public.get_current_user_role() = 'assistant' and teacher_id is null)
        )
      )
    )
  );

create policy "Tenant scoped groups modify" on public.groups
  for all
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          teacher_id = public.get_current_user_teacher_id()
          or (public.get_current_user_role() = 'assistant' and teacher_id is null)
        )
      )
    )
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          teacher_id = public.get_current_user_teacher_id()
          or (public.get_current_user_role() = 'assistant' and teacher_id is null)
        )
      )
    )
  );

-- ============================================================================
-- 3. Sessions Table Policies
-- ============================================================================

drop policy if exists "Tenant owners manage own sessions" on public.sessions;
drop policy if exists "Tenant scoped sessions select" on public.sessions;
drop policy if exists "Tenant scoped sessions modify" on public.sessions;

create policy "Tenant scoped sessions select" on public.sessions
  for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (
          teacher_id is null
          or teacher_id = public.get_current_user_teacher_id()
          or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
        )
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          (public.get_current_user_role() = 'assistant' and teacher_id is null)
          or teacher_id = public.get_current_user_teacher_id()
          or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
        )
      )
    )
  );

create policy "Tenant scoped sessions modify" on public.sessions
  for all
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (
          teacher_id is null
          or teacher_id = public.get_current_user_teacher_id()
          or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
        )
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          (public.get_current_user_role() = 'assistant' and teacher_id is null)
          or teacher_id = public.get_current_user_teacher_id()
          or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
        )
      )
    )
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (
          teacher_id is null
          or teacher_id = public.get_current_user_teacher_id()
          or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
        )
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          (public.get_current_user_role() = 'assistant' and teacher_id is null)
          or teacher_id = public.get_current_user_teacher_id()
          or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
        )
      )
    )
  );

-- ============================================================================
-- 4. Attendance Table Policies
-- ============================================================================

drop policy if exists "Tenant owners manage own attendance" on public.attendance;
drop policy if exists "Tenant scoped attendance select" on public.attendance;
drop policy if exists "Tenant scoped attendance modify" on public.attendance;

create policy "Tenant scoped attendance select" on public.attendance
  for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (
          teacher_id is null
          or teacher_id = public.get_current_user_teacher_id()
          or session_id in (
            select id from public.sessions
            where teacher_id = public.get_current_user_teacher_id()
               or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
          )
        )
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          (public.get_current_user_role() = 'assistant' and teacher_id is null)
          or teacher_id = public.get_current_user_teacher_id()
          or session_id in (
            select id from public.sessions
            where teacher_id = public.get_current_user_teacher_id()
               or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
          )
        )
      )
    )
  );

create policy "Tenant scoped attendance modify" on public.attendance
  for all
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (
          teacher_id is null
          or teacher_id = public.get_current_user_teacher_id()
          or session_id in (
            select id from public.sessions
            where teacher_id = public.get_current_user_teacher_id()
               or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
          )
        )
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          (public.get_current_user_role() = 'assistant' and teacher_id is null)
          or teacher_id = public.get_current_user_teacher_id()
          or session_id in (
            select id from public.sessions
            where teacher_id = public.get_current_user_teacher_id()
               or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
          )
        )
      )
    )
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (
          teacher_id is null
          or teacher_id = public.get_current_user_teacher_id()
          or session_id in (
            select id from public.sessions
            where teacher_id = public.get_current_user_teacher_id()
               or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
          )
        )
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (
          (public.get_current_user_role() = 'assistant' and teacher_id is null)
          or teacher_id = public.get_current_user_teacher_id()
          or session_id in (
            select id from public.sessions
            where teacher_id = public.get_current_user_teacher_id()
               or group_id in (select id from public.groups where teacher_id = public.get_current_user_teacher_id())
          )
        )
      )
    )
  );

-- ============================================================================
-- 5. Enrollments Table Policies
-- ============================================================================

drop policy if exists "Tenant users can view enrollments" on public.enrollments;
drop policy if exists "Tenant staff can manage enrollments" on public.enrollments;
drop policy if exists "Tenant scoped enrollments select" on public.enrollments;
drop policy if exists "Tenant scoped enrollments modify" on public.enrollments;

create policy "Tenant scoped enrollments select" on public.enrollments
  for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() in ('teacher', 'assistant', 'assistant_to_teacher')
        and teacher_id = public.get_current_user_teacher_id()
      )
    )
  );

create policy "Tenant scoped enrollments modify" on public.enrollments
  for all
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() in ('teacher', 'assistant', 'assistant_to_teacher')
        and teacher_id = public.get_current_user_teacher_id()
      )
    )
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() in ('teacher', 'assistant', 'assistant_to_teacher')
        and teacher_id = public.get_current_user_teacher_id()
      )
    )
  );

-- ============================================================================
-- 6. Students Table Policies
-- ============================================================================

drop policy if exists "Tenant owners manage own students" on public.students;
drop policy if exists "Tenant scoped students select" on public.students;
drop policy if exists "Tenant scoped students modify" on public.students;

create policy "Tenant scoped students select" on public.students
  for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center', 'assistant')
      or (
        public.get_current_user_role() in ('teacher', 'assistant_to_teacher')
        and (
          id in (select student_id from public.enrollments where teacher_id = public.get_current_user_teacher_id())
          or id in (
            select gs.student_id from public.group_students gs
            join public.groups g on gs.group_id = g.id
            where g.teacher_id = public.get_current_user_teacher_id()
          )
        )
      )
    )
  );

create policy "Tenant scoped students modify" on public.students
  for all
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center', 'assistant')
      or (
        public.get_current_user_role() in ('teacher', 'assistant_to_teacher')
        and (
          id in (select student_id from public.enrollments where teacher_id = public.get_current_user_teacher_id())
          or id in (
            select gs.student_id from public.group_students gs
            join public.groups g on gs.group_id = g.id
            where g.teacher_id = public.get_current_user_teacher_id()
          )
        )
      )
    )
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center', 'assistant')
      or (
        public.get_current_user_role() in ('teacher', 'assistant_to_teacher')
        and (
          id in (select student_id from public.enrollments where teacher_id = public.get_current_user_teacher_id())
          or id in (
            select gs.student_id from public.group_students gs
            join public.groups g on gs.group_id = g.id
            where g.teacher_id = public.get_current_user_teacher_id()
          )
        )
      )
    )
  );

-- ============================================================================
-- 7. Group_Students Table Policies
-- ============================================================================

drop policy if exists "Tenant owners manage own group_students" on public.group_students;
drop policy if exists "Tenant scoped group_students select" on public.group_students;
drop policy if exists "Tenant scoped group_students modify" on public.group_students;

create policy "Tenant scoped group_students select" on public.group_students
  for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() in ('teacher', 'assistant', 'assistant_to_teacher')
        and group_id in (
          select id from public.groups
          where teacher_id is null or teacher_id = public.get_current_user_teacher_id()
        )
      )
    )
  );

create policy "Tenant scoped group_students modify" on public.group_students
  for all
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() in ('teacher', 'assistant', 'assistant_to_teacher')
        and group_id in (
          select id from public.groups
          where teacher_id is null or teacher_id = public.get_current_user_teacher_id()
        )
      )
    )
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() in ('teacher', 'assistant', 'assistant_to_teacher')
        and group_id in (
          select id from public.groups
          where teacher_id is null or teacher_id = public.get_current_user_teacher_id()
        )
      )
    )
  );

-- ============================================================================
-- 8. Teacher Payouts (Financial Data) Policies
-- ============================================================================

drop policy if exists "Teachers can view own payouts" on public.teacher_payouts;
drop policy if exists "Center owners can manage teacher payouts" on public.teacher_payouts;
drop policy if exists "Tenant scoped teacher payouts select" on public.teacher_payouts;
drop policy if exists "Tenant scoped teacher payouts manage" on public.teacher_payouts;

-- Management strictly reserved for center owners and admins
create policy "Tenant scoped teacher payouts manage" on public.teacher_payouts
  for all
  using (
    tenant_id = public.get_current_user_tenant_id()
    and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and public.get_current_user_role() in ('admin', 'owner', 'center_owner')
  );

-- Viewing strictly scoped:
-- - center owners/admins see all
-- - teachers see ONLY their own payouts
-- - assistants see payouts ONLY if can_current_user_view_financials() is true
create policy "Tenant scoped teacher payouts select" on public.teacher_payouts
  for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner')
      or (
        public.get_current_user_role() = 'teacher'
        and teacher_id = public.get_current_user_teacher_id()
      )
      or (
        public.get_current_user_role() = 'assistant_to_center'
        and public.can_current_user_view_financials()
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and public.can_current_user_view_financials()
        and teacher_id = public.get_current_user_teacher_id()
      )
    )
  );


-- ==========================================
-- MIGRATION: 20260909000003_dev88_teacher_whatsapp_connections.sql
-- ==========================================
-- DEV-88: Teacher-Scoped WhatsApp Connections & RLS
-- Allows each teacher under an educational center to have their own dedicated WhatsApp connection
-- with composite uniqueness on (tenant_id, teacher_id) and strict role-based RLS scoping.

-- 1. Alter whatsapp_connections schema
-- Drop legacy single-tenant unique constraint
alter table public.whatsapp_connections 
  drop constraint if exists whatsapp_connections_tenant_id_key;

-- Add teacher_id column
alter table public.whatsapp_connections 
  add column if not exists teacher_id uuid references public.teachers(id) on delete cascade;

-- Composite unique constraint (tenant_id, teacher_id)
alter table public.whatsapp_connections 
  drop constraint if exists unique_tenant_teacher;

alter table public.whatsapp_connections 
  add constraint unique_tenant_teacher unique (tenant_id, teacher_id);

-- Deterministic partial/coalesced unique index to prevent duplicate null teacher entries per tenant
drop index if exists public.idx_whatsapp_connections_tenant_teacher;
create unique index if not exists idx_whatsapp_connections_tenant_teacher
  on public.whatsapp_connections(tenant_id, coalesce(teacher_id, '00000000-0000-0000-0000-000000000000'::uuid));

-- Index on teacher_id for fast lookup
create index if not exists idx_whatsapp_connections_teacher_id 
  on public.whatsapp_connections(teacher_id);

-- 2. Drop legacy RLS policies
drop policy if exists "Admins have full access to whatsapp_connections" on public.whatsapp_connections;
drop policy if exists "Tenant owners manage own whatsapp_connection" on public.whatsapp_connections;
drop policy if exists "whatsapp_connections_select" on public.whatsapp_connections;
drop policy if exists "whatsapp_connections_insert" on public.whatsapp_connections;
drop policy if exists "whatsapp_connections_update" on public.whatsapp_connections;
drop policy if exists "whatsapp_connections_delete" on public.whatsapp_connections;

-- 3. RLS Policies

-- Admins full access
create policy "Admins have full access to whatsapp_connections"
  on public.whatsapp_connections for all
  using (public.is_admin())
  with check (public.is_admin());

-- SELECT: Center owners, owners, admins, and assistants (read-only for assigned/center scope).
-- Teachers can view their own connection or tenant-wide fallback.
create policy "whatsapp_connections_select"
  on public.whatsapp_connections for select
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner', 'assistant_to_center')
      or (
        public.get_current_user_role() = 'teacher'
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
      or (
        public.get_current_user_role() in ('assistant', 'assistant_to_teacher')
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
    )
  );

-- INSERT: Center owners, owners, admins can create for any teacher in tenant.
-- Teachers can create only for themselves. Assistants CANNOT insert.
create policy "whatsapp_connections_insert"
  on public.whatsapp_connections for insert
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner')
      or (
        public.get_current_user_role() = 'teacher'
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
    )
  );

-- UPDATE: Center owners, owners, admins can update any connection in tenant.
-- Teachers can update only their own connection. Assistants CANNOT update.
create policy "whatsapp_connections_update"
  on public.whatsapp_connections for update
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner')
      or (
        public.get_current_user_role() = 'teacher'
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
    )
  )
  with check (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner')
      or (
        public.get_current_user_role() = 'teacher'
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
    )
  );

-- DELETE: Center owners, owners, admins can delete any connection in tenant.
-- Teachers can delete only their own connection. Assistants CANNOT delete.
create policy "whatsapp_connections_delete"
  on public.whatsapp_connections for delete
  using (
    tenant_id = public.get_current_user_tenant_id()
    and (
      public.get_current_user_role() in ('admin', 'owner', 'center_owner')
      or (
        public.get_current_user_role() = 'teacher'
        and (teacher_id is null or teacher_id = public.get_current_user_teacher_id())
      )
    )
  );


-- ==========================================
-- MIGRATION: 20260909000004_fix_anon_rls_helper_grants.sql
-- ==========================================
-- Migration: 20260909000004_fix_anon_rls_helper_grants.sql
-- Description: Grant execute to anon on RLS helper functions so unauthenticated/public queries evaluating table RLS can safely evaluate to null/false rather than throwing 42501 permission denied.

grant execute on function public.get_current_user_tenant_id to anon;
grant execute on function public.is_admin to anon;
grant execute on function public.get_current_user_role to anon;
grant execute on function public.get_current_user_teacher_id to anon;


-- ==========================================
-- MIGRATION: 20260909000005_dev89_groups_flexible_billing_and_schedule.sql
-- ==========================================
-- Migration: 20260909000005_dev89_groups_flexible_billing_and_schedule.sql
-- Supports DEV-89: 3 distinct center billing models & dedicated schedule pickers

ALTER TABLE public.groups 
  ADD COLUMN IF NOT EXISTS fixed_per_student_amount numeric DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS day_of_week text DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS session_time text DEFAULT NULL;

ALTER TABLE public.groups DROP CONSTRAINT IF EXISTS groups_billing_model_check;
ALTER TABLE public.groups ADD CONSTRAINT groups_billing_model_check 
  CHECK (billing_model = ANY (ARRAY['percentage'::text, 'fixed_per_student'::text, 'fixed_rent'::text]));


-- ==========================================
-- MIGRATION: 20260910000001_dev91_center_entities_secure_rpcs_and_rls.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260910000001_dev91_center_entities_secure_rpcs_and_rls.sql
-- Description: Adds secure RPC functions and resilient RLS policies for
--              teachers, assistants, and rooms in multi-tenant center system.
-- ============================================================================

-- 1. Secure RPC: create_teacher_secure
CREATE OR REPLACE FUNCTION public.create_teacher_secure(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_subjects text[],
  p_revenue_model text,
  p_revenue_value numeric,
  p_status text DEFAULT 'active',
  p_user_id uuid DEFAULT NULL,
  p_invite_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  INSERT INTO public.teachers (
    tenant_id,
    name,
    phone,
    subjects,
    revenue_model,
    revenue_value,
    status,
    user_id,
    invite_token
  ) VALUES (
    p_tenant_id,
    p_name,
    p_phone,
    COALESCE(p_subjects, ARRAY['عام'::text]),
    COALESCE(p_revenue_model, 'percentage'),
    COALESCE(p_revenue_value, 20),
    COALESCE(p_status, 'active'),
    p_user_id,
    p_invite_token
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

-- 2. Secure RPC: create_assistant_secure
CREATE OR REPLACE FUNCTION public.create_assistant_secure(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_assistant_type text DEFAULT 'assistant_to_center',
  p_teacher_id uuid DEFAULT NULL,
  p_can_view_financials boolean DEFAULT false,
  p_status text DEFAULT 'active',
  p_salary numeric DEFAULT 0,
  p_user_id uuid DEFAULT NULL,
  p_invite_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  INSERT INTO public.assistants (
    tenant_id,
    name,
    phone,
    assistant_type,
    teacher_id,
    can_view_financials,
    status,
    salary,
    user_id,
    invite_token
  ) VALUES (
    p_tenant_id,
    p_name,
    p_phone,
    COALESCE(p_assistant_type, 'assistant_to_center'),
    p_teacher_id,
    COALESCE(p_can_view_financials, false),
    COALESCE(p_status, 'active'),
    COALESCE(p_salary, 0),
    p_user_id,
    p_invite_token
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

-- 3. Secure RPC: create_room_secure
CREATE OR REPLACE FUNCTION public.create_room_secure(
  p_tenant_id uuid,
  p_name text,
  p_capacity integer,
  p_hourly_rate numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_row record;
BEGIN
  INSERT INTO public.rooms (
    tenant_id,
    name,
    capacity,
    hourly_rate
  ) VALUES (
    p_tenant_id,
    p_name,
    COALESCE(p_capacity, 30),
    COALESCE(p_hourly_rate, 0)
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

-- 4. Grant EXECUTE permissions
GRANT EXECUTE ON FUNCTION public.create_teacher_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_assistant_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.create_room_secure TO anon, authenticated, service_role;

-- 5. Add direct permissive RLS policies for teachers, assistants, and rooms
DROP POLICY IF EXISTS "Allow authenticated or backend insert on teachers" ON public.teachers;
CREATE POLICY "Allow authenticated or backend insert on teachers" ON public.teachers FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated or backend update on teachers" ON public.teachers;
CREATE POLICY "Allow authenticated or backend update on teachers" ON public.teachers FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated or backend delete on teachers" ON public.teachers;
CREATE POLICY "Allow authenticated or backend delete on teachers" ON public.teachers FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow authenticated or backend insert on assistants" ON public.assistants;
CREATE POLICY "Allow authenticated or backend insert on assistants" ON public.assistants FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated or backend update on assistants" ON public.assistants;
CREATE POLICY "Allow authenticated or backend update on assistants" ON public.assistants FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated or backend delete on assistants" ON public.assistants;
CREATE POLICY "Allow authenticated or backend delete on assistants" ON public.assistants FOR DELETE USING (true);

DROP POLICY IF EXISTS "Allow authenticated or backend insert on rooms" ON public.rooms;
CREATE POLICY "Allow authenticated or backend insert on rooms" ON public.rooms FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated or backend update on rooms" ON public.rooms;
CREATE POLICY "Allow authenticated or backend update on rooms" ON public.rooms FOR UPDATE USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow authenticated or backend delete on rooms" ON public.rooms;
CREATE POLICY "Allow authenticated or backend delete on rooms" ON public.rooms FOR DELETE USING (true);


-- ==========================================
-- MIGRATION: 20260912000001_dev_quizzes_management_and_persistence.sql
-- ==========================================
-- Migration: 20260912000001_dev_quizzes_management_and_persistence.sql
-- Description: Create quizzes table and extend quiz_scores to persist standalone group quizzes, scores, notes, and delivery status.

-- 1. Create quizzes table
create table if not exists public.quizzes (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants(id) on delete cascade,
  group_id uuid not null references public.groups(id) on delete cascade,
  quiz_number integer not null,
  title text not null,
  max_score numeric(5, 2) not null default 10,
  quiz_date date default current_date,
  is_skipped boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (tenant_id, group_id, quiz_number)
);

create index if not exists idx_quizzes_tenant_group on public.quizzes(tenant_id, group_id);

alter table public.quizzes enable row level security;

drop policy if exists "Tenant users full access to quizzes" on public.quizzes;
create policy "Tenant users full access to quizzes"
  on public.quizzes for all
  using (true)
  with check (true);

-- 2. Alter quiz_scores table to support group-level standalone quizzes
alter table public.quiz_scores alter column session_id drop not null;
alter table public.quiz_scores add column if not exists quiz_id uuid references public.quizzes(id) on delete cascade;
alter table public.quiz_scores add column if not exists group_id uuid references public.groups(id) on delete cascade;
alter table public.quiz_scores add column if not exists quiz_number integer;
alter table public.quiz_scores add column if not exists note text;
alter table public.quiz_scores add column if not exists delivery_status text default 'pending';

create index if not exists idx_quiz_scores_group on public.quiz_scores(group_id);
create index if not exists idx_quiz_scores_quiz on public.quiz_scores(quiz_id);


-- ==========================================
-- MIGRATION: 20260912000002_dev_parent_portal_tracking.sql
-- ==========================================
-- 20260912000002_dev_parent_portal_tracking.sql
-- Adds parent portal permanent token and dispatch tracking columns to students table

ALTER TABLE public.students 
ADD COLUMN IF NOT EXISTS parent_portal_token text,
ADD COLUMN IF NOT EXISTS parent_portal_sent_at timestamptz DEFAULT NULL;

CREATE INDEX IF NOT EXISTS idx_students_parent_portal_sent_at ON public.students(tenant_id, parent_portal_sent_at);


-- ==========================================
-- MIGRATION: 20260912000003_dev_parent_portal_rpc.sql
-- ==========================================
-- 20260912000003_dev_parent_portal_rpc.sql
-- RPC function to bypass RLS securely and return comprehensive live parent portal payload

CREATE OR REPLACE FUNCTION public.get_parent_portal_payload(
  p_token text,
  p_student_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_group_name text;
  v_center_name text;
  v_attendance json;
  v_quizzes json;
  v_attendance_stats record;
  v_quiz_stats record;
  v_result json;
BEGIN
  -- 1. Locate student either by (id, tenant_id) if verified by HMAC, or by parent_portal_token
  IF p_student_id IS NOT NULL AND p_tenant_id IS NOT NULL THEN
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Update parent_portal_token if needed
    IF FOUND AND p_token IS NOT NULL AND length(p_token) > 0 THEN
      UPDATE students 
      SET parent_portal_token = p_token 
      WHERE id = v_student.id AND (parent_portal_token IS NULL OR parent_portal_token = '');
    END IF;
  ELSE
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.parent_portal_token = p_token
    LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch group and center name
  IF v_student.group_id IS NOT NULL THEN
    SELECT g.name, g.center_name INTO v_group_name, v_center_name
    FROM groups g
    WHERE g.id = v_student.group_id;
  ELSE
    SELECT g.name, g.center_name INTO v_group_name, v_center_name
    FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE gs.student_id = v_student.id
    LIMIT 1;
  END IF;

  -- 3. Fetch attendance history
  SELECT json_agg(t) INTO v_attendance
  FROM (
    SELECT 
      a.id,
      a.attended,
      a.comment,
      COALESCE(a.homework_status, 'done') AS homework_status,
      a.created_at,
      COALESCE(s.session_number, 1) AS session_number,
      COALESCE(s.session_date::text, (a.created_at::date)::text) AS session_date
    FROM attendance a
    LEFT JOIN sessions s ON a.session_id = s.id
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id
    ORDER BY a.created_at DESC
    LIMIT 25
  ) t;

  -- Attendance stats
  SELECT 
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.attended = true)::int AS attended_count,
    COUNT(*) FILTER (WHERE a.attended = false)::int AS absent_count,
    COUNT(*) FILTER (WHERE a.homework_status IN ('done', 'completed', 'delivered'))::int AS hw_done_count
  INTO v_attendance_stats
  FROM attendance a
  WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id;

  -- 4. Fetch Quizzes & scores
  SELECT json_agg(q_row) INTO v_quizzes
  FROM (
    SELECT 
      qs.id,
      qs.quiz_id,
      COALESCE(q.title, CASE WHEN qs.quiz_number IS NOT NULL THEN CONCAT('كويز ', qs.quiz_number::text) ELSE 'اختبار' END) AS title,
      COALESCE(q.quiz_date::text, (qs.created_at::date)::text) AS date,
      qs.score,
      COALESCE(qs.max_score, q.max_score, 20) AS max_score,
      qs.note,
      qs.note AS notes,
      ROUND((qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS percentage,
      CASE 
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 85 THEN 'ممتاز'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 75 THEN 'جيد جداً'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 60 THEN 'جيد'
        ELSE 'يحتاج متابعة'
      END AS tier
    FROM quiz_scores qs
    LEFT JOIN quizzes q ON qs.quiz_id = q.id
    WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id
    ORDER BY COALESCE(q.quiz_date::text, (qs.created_at::date)::text) DESC, qs.created_at DESC
    LIMIT 25
  ) q_row;

  -- Quiz stats
  SELECT 
    COUNT(*)::int AS total_quizzes,
    ROUND(AVG(qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS avg_score
  INTO v_quiz_stats
  FROM quiz_scores qs
  LEFT JOIN quizzes q ON qs.quiz_id = q.id
  WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id;

  -- 5. Build final JSON matching frontend exact contract
  v_result := json_build_object(
    'student', json_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'student_code', COALESCE(v_student.code, '—'),
      'group_name', COALESCE(v_group_name, 'المجموعة العامة'),
      'center_name', COALESCE(v_center_name, '')
    ),
    'summary', json_build_object(
      'total_sessions', COALESCE(v_attendance_stats.total, 0),
      'attended_count', COALESCE(v_attendance_stats.attended_count, 0),
      'absent_count', COALESCE(v_attendance_stats.absent_count, 0),
      'attendance_rate', CASE WHEN COALESCE(v_attendance_stats.total, 0) > 0 
        THEN CONCAT(ROUND((v_attendance_stats.attended_count::numeric / v_attendance_stats.total::numeric) * 100)::text, '%')
        ELSE '100%' END,
      'homework_done_count', COALESCE(v_attendance_stats.hw_done_count, 0),
      'total_quizzes', COALESCE(v_quiz_stats.total_quizzes, 0),
      'quiz_average_percentage', CASE WHEN COALESCE(v_quiz_stats.total_quizzes, 0) > 0
        THEN CONCAT(ROUND(v_quiz_stats.avg_score)::text, '%')
        ELSE '—' END
    ),
    'sessions', COALESCE(v_attendance, '[]'::json),
    'quizzes', COALESCE(v_quizzes, '[]'::json),
    'last_updated', now()
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_portal_payload(text, uuid, uuid) TO anon, authenticated;


-- ==========================================
-- MIGRATION: 20260913000001_dev_homework_file_purge_on_approval.sql
-- ==========================================
-- 20260913000001_dev_homework_file_purge_on_approval.sql
-- Allow file_url to be nullable when homework is approved and file is purged from storage
ALTER TABLE public.homework_submissions ALTER COLUMN file_url DROP NOT NULL;
ALTER TABLE public.homework_submissions ADD COLUMN IF NOT EXISTS file_purged boolean DEFAULT false;


-- ==========================================
-- MIGRATION: 20260914000001_fix_study_materials_and_templates_rls.sql
-- ==========================================
-- Fix Row Level Security policies for study_materials and message_templates
-- Ensures backend operations (which authenticate with anon or service keys) can create and manage study materials and message templates.

DO $$
BEGIN
  -- 1. study_materials
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'study_materials' AND policyname = 'Public full access to study_materials'
  ) THEN
    CREATE POLICY "Public full access to study_materials" ON study_materials
      FOR ALL TO public
      USING (true)
      WITH CHECK (true);
  END IF;

  -- 2. message_templates
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'message_templates' AND policyname = 'Public full access to message_templates'
  ) THEN
    CREATE POLICY "Public full access to message_templates" ON message_templates
      FOR ALL TO public
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;


-- ==========================================
-- MIGRATION: 20260914000002_dev_parent_portal_rpc_teacher_name.sql
-- ==========================================
-- 20260914000002_dev_parent_portal_rpc_teacher_name.sql
-- Update get_parent_portal_payload to return teacher_name in student object

CREATE OR REPLACE FUNCTION public.get_parent_portal_payload(
  p_token text,
  p_student_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_group_name text;
  v_center_name text;
  v_teacher_id uuid;
  v_teacher_name text;
  v_tenant_name text;
  v_attendance json;
  v_quizzes json;
  v_materials json;
  v_attendance_stats record;
  v_quiz_stats record;
  v_result json;
BEGIN
  -- 1. Locate student either by (id, tenant_id) if verified by HMAC, or by parent_portal_token
  IF p_student_id IS NOT NULL AND p_tenant_id IS NOT NULL THEN
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Update parent_portal_token if needed
    IF FOUND AND p_token IS NOT NULL AND length(p_token) > 0 THEN
      UPDATE students 
      SET parent_portal_token = p_token 
      WHERE id = v_student.id AND (parent_portal_token IS NULL OR parent_portal_token = '');
    END IF;
  ELSE
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.parent_portal_token = p_token
    LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch group, center name, and teacher
  IF v_student.group_id IS NOT NULL THEN
    SELECT g.name, g.center_name, g.teacher_id INTO v_group_name, v_center_name, v_teacher_id
    FROM groups g
    WHERE g.id = v_student.group_id;
  ELSE
    SELECT g.name, g.center_name, g.teacher_id INTO v_group_name, v_center_name, v_teacher_id
    FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE gs.student_id = v_student.id
    LIMIT 1;
  END IF;

  -- Resolve teacher name
  IF v_teacher_id IS NOT NULL THEN
    SELECT t.name INTO v_teacher_name FROM teachers t WHERE t.id = v_teacher_id;
  END IF;

  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT t.name INTO v_teacher_name FROM teachers t WHERE t.tenant_id = v_student.tenant_id LIMIT 1;
  END IF;

  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT tn.name INTO v_tenant_name FROM tenants tn WHERE tn.id = v_student.tenant_id LIMIT 1;
    v_teacher_name := v_tenant_name;
  END IF;

  -- 3. Fetch attendance history
  SELECT json_agg(t) INTO v_attendance
  FROM (
    SELECT 
      a.id,
      a.attended,
      a.comment,
      CASE 
        WHEN a.attended = false THEN NULL 
        ELSE a.homework_status 
      END AS homework_status,
      a.created_at,
      COALESCE(s.session_number, 1) AS session_number,
      COALESCE(s.session_date::text, (a.created_at::date)::text) AS session_date
    FROM attendance a
    LEFT JOIN sessions s ON a.session_id = s.id
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id
    ORDER BY a.created_at DESC
    LIMIT 25
  ) t;

  -- Attendance stats
  SELECT 
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.attended = true)::int AS attended_count,
    COUNT(*) FILTER (WHERE a.attended = false)::int AS absent_count,
    COUNT(*) FILTER (WHERE a.attended = true AND a.homework_status IS NOT NULL)::int AS hw_total_count,
    COUNT(*) FILTER (WHERE a.attended = true AND a.homework_status IN ('done', 'completed', 'delivered'))::int AS hw_done_count
  INTO v_attendance_stats
  FROM attendance a
  WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id;

  -- 4. Fetch Quizzes & scores
  SELECT json_agg(q_row) INTO v_quizzes
  FROM (
    SELECT 
      qs.id,
      qs.quiz_id,
      COALESCE(q.title, CASE WHEN qs.quiz_number IS NOT NULL THEN CONCAT('كويز ', qs.quiz_number::text) ELSE 'امتحان' END) AS title,
      COALESCE(q.quiz_date::text, (qs.created_at::date)::text) AS date,
      qs.score,
      COALESCE(qs.max_score, q.max_score, 20) AS max_score,
      qs.note,
      qs.note AS notes,
      ROUND((qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS percentage,
      CASE 
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 85 THEN 'ممتاز'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 75 THEN 'جيد جداً'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 60 THEN 'جيد'
        ELSE 'يحتاج متابعة'
      END AS tier
    FROM quiz_scores qs
    LEFT JOIN quizzes q ON qs.quiz_id = q.id
    WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id
    ORDER BY COALESCE(q.quiz_date::text, (qs.created_at::date)::text) DESC, qs.created_at DESC
    LIMIT 25
  ) q_row;

  -- Quiz stats
  SELECT 
    COUNT(*)::int AS total_quizzes,
    ROUND(AVG(qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS avg_score
  INTO v_quiz_stats
  FROM quiz_scores qs
  LEFT JOIN quizzes q ON qs.quiz_id = q.id
  WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id;

  -- 5. Fetch Study Materials & Homework with student's submission status + book details
  SELECT json_agg(m_row) INTO v_materials
  FROM (
    SELECT 
      m.id,
      m.title,
      m.description,
      m.type,
      m.url,
      m.is_homework,
      COALESCE(m.due_date::text, '') AS due_date,
      COALESCE(m.created_at::date::text, '') AS created_date,
      COALESCE(hs.status, 'unsubmitted') AS submission_status,
      hs.file_url AS submission_url,
      hs.submitted_at::text AS submitted_at,
      hs.teacher_notes AS teacher_feedback,
      m.book_name,
      m.pages,
      m.questions
    FROM study_materials m
    LEFT JOIN homework_submissions hs ON hs.material_id = m.id AND hs.student_id = v_student.id
    WHERE m.tenant_id = v_student.tenant_id
      AND (m.group_id IS NULL OR m.group_id = v_student.group_id)
    ORDER BY m.created_at DESC
    LIMIT 30
  ) m_row;

  -- 6. Build final JSON matching frontend exact contract
  v_result := json_build_object(
    'student', json_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'student_code', COALESCE(v_student.code, '—'),
      'group_name', COALESCE(v_group_name, 'مجموعة عامة'),
      'center_name', COALESCE(v_center_name, ''),
      'teacher_name', COALESCE(v_teacher_name, 'أستاذ المادة')
    ),
    'summary', json_build_object(
      'total_sessions', COALESCE(v_attendance_stats.total, 0),
      'attended_count', COALESCE(v_attendance_stats.attended_count, 0),
      'absent_count', COALESCE(v_attendance_stats.absent_count, 0),
      'attendance_rate', CASE WHEN COALESCE(v_attendance_stats.total, 0) > 0 
        THEN CONCAT(ROUND((v_attendance_stats.attended_count::numeric / v_attendance_stats.total::numeric) * 100)::text, '%')
        ELSE '100%' END,
      'homework_done_count', COALESCE((
        SELECT COUNT(*)::int FROM homework_submissions hs2
        WHERE hs2.student_id = v_student.id AND hs2.status = 'approved'
      ), COALESCE(v_attendance_stats.hw_done_count, 0)),
      'homework_total_count', COALESCE((
        SELECT COUNT(*)::int FROM study_materials sm2
        WHERE sm2.tenant_id = v_student.tenant_id AND sm2.is_homework = true
          AND (sm2.group_id IS NULL OR sm2.group_id = v_student.group_id)
      ), 0),
      'total_quizzes', COALESCE(v_quiz_stats.total_quizzes, 0),
      'quiz_average_percentage', CASE WHEN COALESCE(v_quiz_stats.total_quizzes, 0) > 0
        THEN CONCAT(ROUND(v_quiz_stats.avg_score)::text, '%')
        ELSE '—' END
    ),
    'sessions', COALESCE(v_attendance, '[]'::json),
    'quizzes', COALESCE(v_quizzes, '[]'::json),
    'materials', COALESCE(v_materials, '[]'::json),
    'last_updated', now()
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_portal_payload(text, uuid, uuid) TO anon, authenticated;


-- ==========================================
-- MIGRATION: 20260916000001_fix_rpc_arabic_encoding.sql
-- ==========================================
-- 20260916000001_fix_rpc_arabic_encoding.sql
-- Fix corrupted Arabic text encoding in get_parent_portal_payload RPC

CREATE OR REPLACE FUNCTION public.get_parent_portal_payload(
  p_token text,
  p_student_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_group_name text;
  v_center_name text;
  v_teacher_id uuid;
  v_teacher_name text;
  v_tenant_name text;
  v_attendance json;
  v_quizzes json;
  v_materials json;
  v_attendance_stats record;
  v_quiz_stats record;
  v_result json;
BEGIN
  -- 1. Locate student either by (id, tenant_id) if verified by HMAC, or by parent_portal_token
  IF p_student_id IS NOT NULL AND p_tenant_id IS NOT NULL THEN
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Update parent_portal_token if needed
    IF FOUND AND p_token IS NOT NULL AND length(p_token) > 0 THEN
      UPDATE students 
      SET parent_portal_token = p_token 
      WHERE id = v_student.id AND (parent_portal_token IS NULL OR parent_portal_token = '');
    END IF;
  ELSE
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.parent_portal_token = p_token
    LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch group, center name, and teacher
  IF v_student.group_id IS NOT NULL THEN
    SELECT g.name, g.center_name, g.teacher_id INTO v_group_name, v_center_name, v_teacher_id
    FROM groups g
    WHERE g.id = v_student.group_id;
  ELSE
    SELECT g.name, g.center_name, g.teacher_id INTO v_group_name, v_center_name, v_teacher_id
    FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE gs.student_id = v_student.id
    LIMIT 1;
  END IF;

  -- Resolve teacher name
  IF v_teacher_id IS NOT NULL THEN
    SELECT t.name INTO v_teacher_name FROM teachers t WHERE t.id = v_teacher_id;
  END IF;

  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT t.name INTO v_teacher_name FROM teachers t WHERE t.tenant_id = v_student.tenant_id LIMIT 1;
  END IF;

  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT tn.name INTO v_tenant_name FROM tenants tn WHERE tn.id = v_student.tenant_id LIMIT 1;
    v_teacher_name := v_tenant_name;
  END IF;

  -- 3. Fetch attendance history
  SELECT json_agg(t) INTO v_attendance
  FROM (
    SELECT 
      a.id,
      a.attended,
      a.comment,
      CASE 
        WHEN a.attended = false THEN NULL 
        ELSE a.homework_status 
      END AS homework_status,
      a.created_at,
      COALESCE(s.session_number, 1) AS session_number,
      COALESCE(s.session_date::text, (a.created_at::date)::text) AS session_date
    FROM attendance a
    LEFT JOIN sessions s ON a.session_id = s.id
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id
    ORDER BY a.created_at DESC
    LIMIT 25
  ) t;

  -- Attendance stats
  SELECT 
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.attended = true)::int AS attended_count,
    COUNT(*) FILTER (WHERE a.attended = false)::int AS absent_count,
    COUNT(*) FILTER (WHERE a.attended = true AND a.homework_status IS NOT NULL)::int AS hw_total_count,
    COUNT(*) FILTER (WHERE a.attended = true AND a.homework_status IN ('done', 'completed', 'delivered'))::int AS hw_done_count
  INTO v_attendance_stats
  FROM attendance a
  WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id;

  -- 4. Fetch Quizzes & scores
  SELECT json_agg(q_row) INTO v_quizzes
  FROM (
    SELECT 
      qs.id,
      qs.quiz_id,
      COALESCE(q.title, CASE WHEN qs.quiz_number IS NOT NULL THEN CONCAT('كويز ', qs.quiz_number::text) ELSE 'امتحان' END) AS title,
      COALESCE(q.quiz_date::text, (qs.created_at::date)::text) AS date,
      qs.score,
      COALESCE(qs.max_score, q.max_score, 20) AS max_score,
      qs.note,
      qs.note AS notes,
      ROUND((qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS percentage,
      CASE 
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 85 THEN 'ممتاز'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 75 THEN 'جيد جداً'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 60 THEN 'جيد'
        ELSE 'يحتاج متابعة'
      END AS tier
    FROM quiz_scores qs
    LEFT JOIN quizzes q ON qs.quiz_id = q.id
    WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id
    ORDER BY COALESCE(q.quiz_date::text, (qs.created_at::date)::text) DESC, qs.created_at DESC
    LIMIT 25
  ) q_row;

  -- Quiz stats
  SELECT 
    COUNT(*)::int AS total_quizzes,
    ROUND(AVG(qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS avg_score
  INTO v_quiz_stats
  FROM quiz_scores qs
  LEFT JOIN quizzes q ON qs.quiz_id = q.id
  WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id;

  -- 5. Fetch Study Materials & Homework with student's submission status + book details
  SELECT json_agg(m_row) INTO v_materials
  FROM (
    SELECT 
      m.id,
      m.title,
      m.description,
      m.type,
      m.url,
      m.is_homework,
      COALESCE(m.due_date::text, '') AS due_date,
      COALESCE(m.created_at::date::text, '') AS created_date,
      COALESCE(hs.status, 'unsubmitted') AS submission_status,
      hs.file_url AS submission_url,
      hs.submitted_at::text AS submitted_at,
      hs.teacher_notes AS teacher_feedback,
      m.book_name,
      m.pages,
      m.questions
    FROM study_materials m
    LEFT JOIN homework_submissions hs ON hs.material_id = m.id AND hs.student_id = v_student.id
    WHERE m.tenant_id = v_student.tenant_id
      AND (m.group_id IS NULL OR m.group_id = v_student.group_id)
    ORDER BY m.created_at DESC
    LIMIT 30
  ) m_row;

  -- 6. Build final JSON matching frontend exact contract
  v_result := json_build_object(
    'student', json_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'student_code', COALESCE(v_student.code, '—'),
      'group_name', COALESCE(v_group_name, 'مجموعة عامة'),
      'center_name', COALESCE(v_center_name, ''),
      'teacher_name', COALESCE(v_teacher_name, 'أستاذ المادة')
    ),
    'summary', json_build_object(
      'total_sessions', COALESCE(v_attendance_stats.total, 0),
      'attended_count', COALESCE(v_attendance_stats.attended_count, 0),
      'absent_count', COALESCE(v_attendance_stats.absent_count, 0),
      'attendance_rate', CASE WHEN COALESCE(v_attendance_stats.total, 0) > 0 
        THEN CONCAT(ROUND((v_attendance_stats.attended_count::numeric / v_attendance_stats.total::numeric) * 100)::text, '%')
        ELSE '100%' END,
      'homework_done_count', COALESCE((
        SELECT COUNT(*)::int FROM homework_submissions hs2
        WHERE hs2.student_id = v_student.id AND hs2.status = 'approved'
      ), COALESCE(v_attendance_stats.hw_done_count, 0)),
      'homework_total_count', COALESCE((
        SELECT COUNT(*)::int FROM study_materials sm2
        WHERE sm2.tenant_id = v_student.tenant_id AND sm2.is_homework = true
          AND (sm2.group_id IS NULL OR sm2.group_id = v_student.group_id)
      ), 0),
      'total_quizzes', COALESCE(v_quiz_stats.total_quizzes, 0),
      'quiz_average_percentage', CASE WHEN COALESCE(v_quiz_stats.total_quizzes, 0) > 0
        THEN CONCAT(ROUND(v_quiz_stats.avg_score)::text, '%')
        ELSE '—' END
    ),
    'sessions', COALESCE(v_attendance, '[]'::json),
    'quizzes', COALESCE(v_quizzes, '[]'::json),
    'materials', COALESCE(v_materials, '[]'::json),
    'last_updated', now()
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_portal_payload(text, uuid, uuid) TO anon, authenticated;


-- ==========================================
-- MIGRATION: 20260916000002_dev_short_links_portal.sql
-- ==========================================
-- 20260916000002_dev_short_links_portal.sql
-- DEV-SHORT-LINKS: Ultra-short portal URLs for Parent and Student portals

CREATE TABLE IF NOT EXISTS public.short_links (
    code text PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    student_id uuid REFERENCES public.students(id) ON DELETE CASCADE,
    portal_type text NOT NULL DEFAULT 'parent',
    token text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_short_links_student ON public.short_links(student_id, portal_type);
ALTER TABLE public.short_links ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Public can resolve short links" ON public.short_links;
CREATE POLICY "Public can resolve short links" ON public.short_links
    FOR SELECT USING (true);

DROP POLICY IF EXISTS "Service role manages short links" ON public.short_links;
CREATE POLICY "Service role manages short links" ON public.short_links
    FOR ALL USING (true);


-- ==========================================
-- MIGRATION: 20260918000001_dev_user_financial_pin.sql
-- ==========================================
-- 20260918000001_dev_user_financial_pin.sql
-- Tie financial security PIN directly to user accounts for cross-device cloud persistence

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS financial_pin text;

-- Sync existing PINs from tenant settings to user records
UPDATE public.users u
SET financial_pin = t.settings->>'financial_pin'
FROM public.tenants t
WHERE u.tenant_id = t.id
  AND t.settings->>'financial_pin' IS NOT NULL
  AND (u.financial_pin IS NULL OR u.financial_pin = '');


-- ==========================================
-- MIGRATION: 20260918000002_update_pricing_plans_300_750_1500.sql
-- ==========================================
-- Migration: 20260918000002_update_pricing_plans_300_750_1500.sql
-- Description: Standardize subscription plans to 300, 750, 1500 students with 20% annual discount

UPDATE public.tenants 
SET subscription_tier = 'growth',
    settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', '" plan_750\'::jsonb),
 '{plan_name}', '\باقة 750 طالب\'::jsonb
 ),
 '{students_limit}', '750'::jsonb
 )
WHERE id = '7b8b30e0-c7c3-44c6-ac00-d7fc58bcf609';


-- ==========================================
-- MIGRATION: 20260919000001_fix_register_tenant_owner_confirmed_at.sql
-- ==========================================
-- Fix register_tenant_owner: remove explicit confirmed_at update
-- In Postgres 17 / modern Supabase, auth.users.confirmed_at is GENERATED ALWAYS AS (LEAST(email_confirmed_at, phone_confirmed_at)) STORED.
-- Attempting to update confirmed_at throws "column confirmed_at can only be updated to DEFAULT".
-- Updating email_confirmed_at automatically updates confirmed_at.

CREATE OR REPLACE FUNCTION public.register_tenant_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamptz
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_tenant_id uuid;
  v_user_role text;
  v_normalized_account_type text;
  v_tenant_row RECORD;
BEGIN
  v_normalized_account_type := CASE WHEN p_account_type = 'center' THEN 'center' ELSE 'teacher' END;
  v_user_role := CASE WHEN v_normalized_account_type = 'center' THEN 'center_owner' ELSE 'owner' END;

  -- 1. Create Tenant
  INSERT INTO public.tenants (name, status, subscription_status, trial_ends_at, account_type, settings)
  VALUES (p_tenant_name, 'active', 'trial', p_trial_ends_at, v_normalized_account_type, '{}'::jsonb)
  RETURNING id, name, subscription_status, trial_ends_at, account_type INTO v_tenant_row;

  v_tenant_id := v_tenant_row.id;

  -- 2. Create or Update public.users
  INSERT INTO public.users (id, tenant_id, email, role, phone, full_name)
  VALUES (p_user_id, v_tenant_id, p_email, v_user_role, p_phone, p_full_name)
  ON CONFLICT (id) DO UPDATE SET
    tenant_id = v_tenant_id,
    role = v_user_role,
    phone = COALESCE(EXCLUDED.phone, public.users.phone),
    full_name = COALESCE(EXCLUDED.full_name, public.users.full_name);

  -- 3. Confirm email in auth.users so login works instantly
  -- Note: in Postgres 17, confirmed_at is ALWAYS GENERATED from LEAST(email_confirmed_at, phone_confirmed_at)
  -- so setting email_confirmed_at automatically updates confirmed_at!
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_user_meta_data = jsonb_build_object(
      'full_name', p_full_name,
      'phone', p_phone,
      'tenant_id', v_tenant_id,
      'role', v_user_role
    )
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id', p_user_id,
    'role', v_user_role,
    'tenant_name', v_tenant_row.name,
    'trial_ends_at', v_tenant_row.trial_ends_at,
    'subscription_status', v_tenant_row.subscription_status
  );
END;
$$;


-- ==========================================
-- MIGRATION: 20260920000001_audit_fix_c01_rls_tenant_isolation.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260920000001_audit_fix_c01_rls_tenant_isolation.sql
-- Description: Fixes Security Audit C-01 by removing all permissive USING (true)
--              and WITH CHECK (true) policies on tenant-scoped tables.
--              Enforces strict tenant isolation for authenticated users and
--              restricts service_role access strictly to backend workers.
-- ============================================================================

-- 1. study_materials
DROP POLICY IF EXISTS "Public full access to study_materials" ON public.study_materials;
DROP POLICY IF EXISTS "study_materials_tenant_isolation" ON public.study_materials;
DROP POLICY IF EXISTS "study_materials_service_role" ON public.study_materials;
DROP POLICY IF EXISTS "study_materials_tenant_select" ON public.study_materials;
DROP POLICY IF EXISTS "study_materials_tenant_modify" ON public.study_materials;

ALTER TABLE public.study_materials ENABLE ROW LEVEL SECURITY;

CREATE POLICY "study_materials_tenant_select"
  ON public.study_materials
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY "study_materials_tenant_modify"
  ON public.study_materials
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  )
  WITH CHECK (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  );

CREATE POLICY "study_materials_service_role"
  ON public.study_materials
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.study_materials FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.study_materials TO authenticated;
GRANT ALL ON public.study_materials TO service_role;


-- 2. message_templates
DROP POLICY IF EXISTS "Public full access to message_templates" ON public.message_templates;
DROP POLICY IF EXISTS "Tenant users can view their message templates" ON public.message_templates;
DROP POLICY IF EXISTS "Tenant users can manage their message templates" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_tenant_select" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_tenant_modify" ON public.message_templates;
DROP POLICY IF EXISTS "message_templates_service_role" ON public.message_templates;

ALTER TABLE public.message_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "message_templates_tenant_select"
  ON public.message_templates
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY "message_templates_tenant_modify"
  ON public.message_templates
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  )
  WITH CHECK (
    tenant_id = get_current_user_tenant_id()
  );

CREATE POLICY "message_templates_service_role"
  ON public.message_templates
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.message_templates FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_templates TO authenticated;
GRANT ALL ON public.message_templates TO service_role;


-- 3. quizzes
DROP POLICY IF EXISTS "Tenant users full access to quizzes" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_tenant_select" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_tenant_modify" ON public.quizzes;
DROP POLICY IF EXISTS "quizzes_service_role" ON public.quizzes;

ALTER TABLE public.quizzes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "quizzes_tenant_select"
  ON public.quizzes
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY "quizzes_tenant_modify"
  ON public.quizzes
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  )
  WITH CHECK (
    tenant_id = get_current_user_tenant_id()
  );

CREATE POLICY "quizzes_service_role"
  ON public.quizzes
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.quizzes FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.quizzes TO authenticated;
GRANT ALL ON public.quizzes TO service_role;


-- 4. teachers
DROP POLICY IF EXISTS "Allow authenticated or backend insert on teachers" ON public.teachers;
DROP POLICY IF EXISTS "Allow authenticated or backend update on teachers" ON public.teachers;
DROP POLICY IF EXISTS "Allow authenticated or backend delete on teachers" ON public.teachers;
DROP POLICY IF EXISTS "teachers_service_role" ON public.teachers;

CREATE POLICY "teachers_service_role"
  ON public.teachers
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.teachers FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.teachers TO authenticated;
GRANT ALL ON public.teachers TO service_role;


-- 5. assistants
DROP POLICY IF EXISTS "Allow authenticated or backend insert on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend update on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend delete on assistants" ON public.assistants;
DROP POLICY IF EXISTS "Allow authenticated or backend select on assistants" ON public.assistants;
DROP POLICY IF EXISTS "assistants_service_role" ON public.assistants;

CREATE POLICY "assistants_service_role"
  ON public.assistants
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.assistants FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.assistants TO authenticated;
GRANT ALL ON public.assistants TO service_role;


-- 6. rooms
DROP POLICY IF EXISTS "Allow authenticated or backend insert on rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow authenticated or backend update on rooms" ON public.rooms;
DROP POLICY IF EXISTS "Allow authenticated or backend delete on rooms" ON public.rooms;
DROP POLICY IF EXISTS "rooms_service_role" ON public.rooms;

CREATE POLICY "rooms_service_role"
  ON public.rooms
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.rooms FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.rooms TO authenticated;
GRANT ALL ON public.rooms TO service_role;


-- 7. homework_submissions
DROP POLICY IF EXISTS "Public select homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Public update homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "Public insert homework submissions" ON public.homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_tenant_select" ON public.homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_tenant_modify" ON public.homework_submissions;
DROP POLICY IF EXISTS "homework_submissions_service_role" ON public.homework_submissions;

ALTER TABLE public.homework_submissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "homework_submissions_tenant_select"
  ON public.homework_submissions
  FOR SELECT
  TO authenticated
  USING (tenant_id = get_current_user_tenant_id());

CREATE POLICY "homework_submissions_tenant_modify"
  ON public.homework_submissions
  FOR ALL
  TO authenticated
  USING (
    tenant_id = get_current_user_tenant_id() AND
    get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text, 'teacher'::text])
  )
  WITH CHECK (
    tenant_id = get_current_user_tenant_id()
  );

CREATE POLICY "homework_submissions_service_role"
  ON public.homework_submissions
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

REVOKE ALL ON public.homework_submissions FROM anon, public;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.homework_submissions TO authenticated;
GRANT ALL ON public.homework_submissions TO service_role;


-- 8. Storage bucket protection
-- Ensure homework-submissions bucket is strictly private
UPDATE storage.buckets SET public = false WHERE id = 'homework-submissions';


-- ==========================================
-- MIGRATION: 20260920000001_security_audit_rls_and_rpc_lockdown.sql
-- ==========================================
-- Security audit remediation: tenant data is never public.
do $$
declare target text;
begin
  foreach target in array array['study_materials','message_templates','quizzes','homework_submissions','teachers','assistants','rooms'] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on table public.%I from anon', target);
    execute format('revoke insert, update, delete on table public.%I from authenticated', target);
    execute format('drop policy if exists "audit tenant read" on public.%I', target);
    execute format('create policy "audit tenant read" on public.%I for select to authenticated using (tenant_id = (select public.get_current_user_tenant_id()))', target);
  end loop;
end $$;

drop policy if exists "Public full access to study_materials" on public.study_materials;
drop policy if exists "Public full access to message_templates" on public.message_templates;
drop policy if exists "Tenant users full access to quizzes" on public.quizzes;
drop policy if exists "Allow authenticated or backend insert on teachers" on public.teachers;
drop policy if exists "Allow authenticated or backend update on teachers" on public.teachers;
drop policy if exists "Allow authenticated or backend delete on teachers" on public.teachers;
drop policy if exists "Allow authenticated or backend insert on assistants" on public.assistants;
drop policy if exists "Allow authenticated or backend update on assistants" on public.assistants;
drop policy if exists "Allow authenticated or backend delete on assistants" on public.assistants;
drop policy if exists "Allow authenticated or backend insert on rooms" on public.rooms;
drop policy if exists "Allow authenticated or backend update on rooms" on public.rooms;
drop policy if exists "Allow authenticated or backend delete on rooms" on public.rooms;

revoke execute on function public.create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_room_secure(uuid, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text) to service_role, postgres;
grant execute on function public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text) to service_role, postgres;
grant execute on function public.create_room_secure(uuid, text, integer, numeric) to service_role, postgres;


-- ==========================================
-- MIGRATION: 20260920000002_audit_fix_c02_secure_rpcs.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260920000002_audit_fix_c02_secure_rpcs.sql
-- Description: Fixes Security Audit C-02 by revoking public/anon/authenticated
--              EXECUTE permissions on sensitive entity-creation RPCs.
--              Sets search_path = public, pg_temp and adds defense-in-depth
--              caller validation against privilege escalation and cross-tenant attacks.
-- ============================================================================

-- 1. Secure RPC: create_teacher_secure
CREATE OR REPLACE FUNCTION public.create_teacher_secure(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_subjects text[],
  p_revenue_model text,
  p_revenue_value numeric,
  p_status text DEFAULT 'active',
  p_user_id uuid DEFAULT NULL,
  p_invite_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
  v_row record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NULL OR v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant creation is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role NOT IN ('admin', 'owner', 'center_owner') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create teacher' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.teachers (
    tenant_id,
    name,
    phone,
    subjects,
    revenue_model,
    revenue_value,
    status,
    user_id,
    invite_token
  ) VALUES (
    p_tenant_id,
    p_name,
    p_phone,
    COALESCE(p_subjects, ARRAY['عام'::text]),
    COALESCE(p_revenue_model, 'percentage'),
    COALESCE(p_revenue_value, 20),
    COALESCE(p_status, 'active'),
    p_user_id,
    p_invite_token
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;


-- 2. Secure RPC: create_assistant_secure
CREATE OR REPLACE FUNCTION public.create_assistant_secure(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_assistant_type text DEFAULT 'assistant_to_center',
  p_teacher_id uuid DEFAULT NULL,
  p_can_view_financials boolean DEFAULT false,
  p_status text DEFAULT 'active',
  p_salary numeric DEFAULT 0,
  p_user_id uuid DEFAULT NULL,
  p_invite_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
  v_row record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NULL OR v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant creation is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role NOT IN ('admin', 'owner', 'center_owner') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create assistant' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.assistants (
    tenant_id,
    name,
    phone,
    assistant_type,
    teacher_id,
    can_view_financials,
    status,
    salary,
    user_id,
    invite_token
  ) VALUES (
    p_tenant_id,
    p_name,
    p_phone,
    COALESCE(p_assistant_type, 'assistant_to_center'),
    p_teacher_id,
    COALESCE(p_can_view_financials, false),
    COALESCE(p_status, 'active'),
    COALESCE(p_salary, 0),
    p_user_id,
    p_invite_token
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;


-- 3. Secure RPC: create_room_secure
CREATE OR REPLACE FUNCTION public.create_room_secure(
  p_tenant_id uuid,
  p_name text,
  p_capacity integer,
  p_hourly_rate numeric DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
  v_row record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NULL OR v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant creation is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role NOT IN ('admin', 'owner', 'center_owner') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create room' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.rooms (
    tenant_id,
    name,
    capacity,
    hourly_rate
  ) VALUES (
    p_tenant_id,
    p_name,
    COALESCE(p_capacity, 30),
    COALESCE(p_hourly_rate, 0)
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;


-- 4. Revoke EXECUTE from PUBLIC, anon, and authenticated
REVOKE EXECUTE ON FUNCTION public.create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.create_room_secure(uuid, text, integer, numeric) FROM PUBLIC, anon, authenticated;

-- 5. Grant EXECUTE strictly to service_role
GRANT EXECUTE ON FUNCTION public.create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_room_secure(uuid, text, integer, numeric) TO service_role;


-- ==========================================
-- MIGRATION: 20260920000003_audit_fix_c03_financial_pin_hash.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260920000003_audit_fix_c03_financial_pin_hash.sql
-- Description: Fixes Security Audit C-03 & C-04 by migrating plaintext financial
--              PINs to bcrypt hashes, removing plaintext columns and settings,
--              and adding persistent failed-attempt tracking and lockout columns.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add hash and lockout columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS financial_pin_hash text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_pin_attempts int DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz DEFAULT NULL;

-- 2. Migrate any existing plaintext financial_pin to bcrypt hash
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'financial_pin'
  ) THEN
    UPDATE public.users 
    SET financial_pin_hash = crypt(financial_pin, gen_salt('bf', 10))
    WHERE financial_pin IS NOT NULL AND financial_pin <> '' AND (financial_pin_hash IS NULL OR financial_pin_hash = '');

    -- Safely drop the plaintext column
    ALTER TABLE public.users DROP COLUMN IF EXISTS financial_pin;
  END IF;
END $$;

-- 3. Purge plaintext financial_pin from tenants.settings
UPDATE public.tenants 
SET settings = settings - 'financial_pin' 
WHERE settings ? 'financial_pin';


-- ==========================================
-- MIGRATION: 20260920000004_fix_get_user_profile_rpc.sql
-- ==========================================
-- Migration: Add secure get_user_profile RPC for robust tenant/profile resolution
-- Eliminates RLS recursion/failures during token authentication middleware

CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, tenant_id, role, email, teacher_id, assistant_id, full_name, financial_pin_hash
  INTO v_user
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_user.id,
    'tenant_id', v_user.tenant_id,
    'role', v_user.role,
    'email', v_user.email,
    'teacher_id', v_user.teacher_id,
    'assistant_id', v_user.assistant_id,
    'full_name', v_user.full_name,
    'financial_pin_hash', v_user.financial_pin_hash
  );
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_user_profile(uuid) TO anon, authenticated, service_role;


-- ==========================================
-- MIGRATION: 20260920000005_sec_lockdown_production_drift.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260920000005_sec_lockdown_production_drift.sql
-- Description: Records and consolidates security lockdowns:
--              1. Revoke EXECUTE on security definer auth RPCs from public/anon/authenticated
--              2. Billing tampering trigger on public.tenants
--              3. Prevent user tenant re-pointing in register_tenant_owner
--              4. Restrict user INSERT policy to prevent role escalation to admin
--              5. Lockdown is_email_confirmed and drop unreferenced update_portal_password
-- ============================================================================

-- 1. Restrict Security Definer RPCs to service_role and postgres
REVOKE ALL ON FUNCTION public.confirm_user_email_direct(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.confirm_user_email_direct(uuid) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.get_email_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_email_by_phone(text) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.get_emails_by_phone(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_emails_by_phone(text) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.register_tenant_owner_direct(text, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_tenant_owner_direct(text, text, text, text, text, text, timestamptz) TO service_role, postgres;

REVOKE ALL ON FUNCTION public.is_email_confirmed(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_email_confirmed(text) TO service_role, postgres;

-- Drop unreferenced, vulnerable procedure
DROP FUNCTION IF EXISTS public.update_portal_password(uuid, text, text);

-- Ensure whatsapp_connections has is_legacy_exempt for pacing delay
ALTER TABLE public.whatsapp_connections ADD COLUMN IF NOT EXISTS is_legacy_exempt boolean DEFAULT false;

-- 2. Prevent billing / tier tampering on public.tenants
CREATE OR REPLACE FUNCTION public.prevent_tenant_billing_tampering()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF coalesce(auth.role(), 'service_role') = 'service_role' OR public.is_admin() THEN
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.account_type IS DISTINCT FROM OLD.account_type
     OR NEW.status IS DISTINCT FROM OLD.status
     OR NEW.deleted_at IS DISTINCT FROM OLD.deleted_at
     OR NEW.subscription_tier IS DISTINCT FROM OLD.subscription_tier
     OR NEW.subscription_ends_at IS DISTINCT FROM OLD.subscription_ends_at
     OR NEW.trial_ends_at IS DISTINCT FROM OLD.trial_ends_at THEN
    RAISE EXCEPTION 'Changing billing or account fields is not permitted' USING errcode = '42501';
  END IF;

  IF NEW.subscription_status IS DISTINCT FROM OLD.subscription_status
     AND NEW.subscription_status <> 'pending_verification' THEN
    RAISE EXCEPTION 'Changing subscription status is not permitted' USING errcode = '42501';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS trg_prevent_tenant_billing_tampering ON public.tenants;
CREATE TRIGGER trg_prevent_tenant_billing_tampering
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION prevent_tenant_billing_tampering();

-- Ensure anon cannot write to tenants
REVOKE INSERT, UPDATE, DELETE ON public.tenants FROM anon;

-- 3. Prevent tenant hijacking / re-pointing in register_tenant_owner
CREATE OR REPLACE FUNCTION public.register_tenant_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_user_role text;
  v_normalized_account_type text;
  v_tenant_row RECORD;
BEGIN
  -- Prevent tenant hijacking / re-pointing: fail if user already has a profile
  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'USER_ALREADY_EXISTS: User % already has an associated tenant profile', p_user_id;
  END IF;

  v_normalized_account_type := CASE WHEN p_account_type = 'center' THEN 'center' ELSE 'teacher' END;
  v_user_role := CASE WHEN v_normalized_account_type = 'center' THEN 'center_owner' ELSE 'owner' END;

  -- 1. Create Tenant
  INSERT INTO public.tenants (name, status, subscription_status, trial_ends_at, account_type, settings)
  VALUES (p_tenant_name, 'active', 'trial', p_trial_ends_at, v_normalized_account_type, '{}'::jsonb)
  RETURNING id, name, subscription_status, trial_ends_at, account_type INTO v_tenant_row;

  v_tenant_id := v_tenant_row.id;

  -- 2. Create public.users profile (no re-pointing)
  INSERT INTO public.users (id, tenant_id, email, role, phone, full_name)
  VALUES (p_user_id, v_tenant_id, p_email, v_user_role, p_phone, p_full_name);

  -- 3. Confirm email in auth.users so login works instantly
  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_user_meta_data = jsonb_build_object(
      'full_name', p_full_name,
      'phone', p_phone,
      'tenant_id', v_tenant_id,
      'role', v_user_role
    )
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id', p_user_id,
    'role', v_user_role,
    'tenant_name', v_tenant_row.name,
    'trial_ends_at', v_tenant_row.trial_ends_at,
    'subscription_status', v_tenant_row.subscription_status
  );
END;
$function$;

REVOKE ALL ON FUNCTION public.register_tenant_owner(uuid, text, text, text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.register_tenant_owner(uuid, text, text, text, text, text, timestamptz) TO service_role, postgres;

-- 4. Restrict users INSERT policy to prevent role elevation to admin
DROP POLICY IF EXISTS "Center owners can insert users in own tenant" ON public.users;
CREATE POLICY "Center owners can insert users in own tenant"
ON public.users
FOR INSERT
WITH CHECK (
  tenant_id = get_current_user_tenant_id()
  AND get_current_user_role() = ANY (ARRAY['admin'::text, 'owner'::text, 'center_owner'::text])
  AND (role NOT IN ('admin') OR is_admin())
);


-- ==========================================
-- MIGRATION: 20260920000006_drop_financial_pin_shim.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260920000006_drop_financial_pin_shim.sql
-- Description: Drops the temporary compatibility shim column public.users.financial_pin
--              after backend code and RPCs have been fully migrated to financial_pin_hash.
-- ============================================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS financial_pin;


-- ==========================================
-- MIGRATION: 20260920000007_add_subject_and_profile_phone.sql
-- ==========================================
-- Migration: 20260920000007_add_subject_and_profile_phone
-- Adds 'subject' column to public.users and updates registration & profile RPCs to track subject and phone

-- 1. Add subject column to public.users
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS subject text;

-- 2. Backfill existing subjects
UPDATE public.users u
SET subject = COALESCE(
  NULLIF(t.settings->>'subject', ''),
  (
    SELECT tch.subjects[1] 
    FROM public.teachers tch 
    WHERE tch.tenant_id = u.tenant_id 
      AND tch.subjects IS NOT NULL 
      AND array_length(tch.subjects, 1) > 0 
    LIMIT 1
  ),
  ''
)
FROM public.tenants t
WHERE u.tenant_id = t.id AND (u.subject IS NULL OR u.subject = '');

-- 3. Update get_user_profile to include phone and subject
CREATE OR REPLACE FUNCTION public.get_user_profile(p_user_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_user RECORD;
BEGIN
  SELECT id, tenant_id, role, email, teacher_id, assistant_id, full_name, phone, subject, financial_pin_hash
  INTO v_user
  FROM public.users
  WHERE id = p_user_id;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  RETURN jsonb_build_object(
    'id', v_user.id,
    'tenant_id', v_user.tenant_id,
    'role', v_user.role,
    'email', v_user.email,
    'teacher_id', v_user.teacher_id,
    'assistant_id', v_user.assistant_id,
    'full_name', v_user.full_name,
    'phone', v_user.phone,
    'subject', v_user.subject,
    'financial_pin_hash', v_user.financial_pin_hash
  );
END;
$function$;

-- 4. Overload / Update register_tenant_owner_direct
CREATE OR REPLACE FUNCTION public.register_tenant_owner_direct(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone,
  p_subject text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
DECLARE
  v_user_id uuid := gen_random_uuid();
  v_identity_id uuid := gen_random_uuid();
  v_tenant_id uuid;
  v_user_role text;
  v_normalized_account_type text;
  v_encrypted_pwd text;
  v_tenant_row RECORD;
  v_clean_email text := lower(trim(p_email));
  v_clean_phone text := trim(p_phone);
  v_clean_subject text := trim(COALESCE(p_subject, ''));
  r_old RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM auth.users WHERE lower(trim(email)) = v_clean_email AND email_confirmed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'USER_ALREADY_EXISTS: هذا البريد الإلكتروني مسجل بالفعل';
  END IF;

  IF v_clean_phone <> '' AND EXISTS (
    SELECT 1 FROM public.users pu
    JOIN auth.users au ON au.id = pu.id
    WHERE pu.phone = v_clean_phone AND au.email_confirmed_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'PHONE_ALREADY_EXISTS: رقم الهاتف هذا مسجل بالفعل بحساب آخر';
  END IF;

  IF v_clean_phone <> '' THEN
    FOR r_old IN (
      SELECT au.id, pu.tenant_id
      FROM auth.users au
      JOIN public.users pu ON pu.id = au.id
      WHERE pu.phone = v_clean_phone
        AND au.email_confirmed_at IS NULL
    ) LOOP
      DELETE FROM auth.users WHERE id = r_old.id;
      IF r_old.tenant_id IS NOT NULL THEN
        DELETE FROM public.tenants WHERE id = r_old.tenant_id;
      END IF;
    END LOOP;
  END IF;

  FOR r_old IN (
    SELECT au.id, pu.tenant_id
    FROM auth.users au
    LEFT JOIN public.users pu ON pu.id = au.id
    WHERE lower(trim(au.email)) = v_clean_email
      AND au.email_confirmed_at IS NULL
  ) LOOP
    DELETE FROM auth.users WHERE id = r_old.id;
    IF r_old.tenant_id IS NOT NULL THEN
      DELETE FROM public.tenants WHERE id = r_old.tenant_id;
    END IF;
  END LOOP;

  v_normalized_account_type := CASE WHEN p_account_type = 'center' THEN 'center' ELSE 'teacher' END;
  v_user_role := CASE WHEN v_normalized_account_type = 'center' THEN 'center_owner' ELSE 'owner' END;
  v_encrypted_pwd := extensions.crypt(p_password, extensions.gen_salt('bf'));

  INSERT INTO public.tenants (name, status, subscription_status, trial_ends_at, account_type, settings)
  VALUES (p_tenant_name, 'active', 'trial', p_trial_ends_at, v_normalized_account_type, jsonb_build_object('subject', v_clean_subject))
  RETURNING id, name, subscription_status, trial_ends_at, account_type INTO v_tenant_row;

  v_tenant_id := v_tenant_row.id;

  INSERT INTO auth.users (
    instance_id,
    id,
    aud,
    role,
    email,
    encrypted_password,
    email_confirmed_at,
    raw_app_meta_data,
    raw_user_meta_data,
    created_at,
    updated_at,
    confirmation_token,
    recovery_token,
    email_change_token_new,
    email_change,
    email_change_token_current,
    reauthentication_token,
    phone_change,
    phone_change_token,
    is_super_admin,
    is_sso_user,
    is_anonymous
  ) VALUES (
    '00000000-0000-0000-0000-000000000000',
    v_user_id,
    'authenticated',
    'authenticated',
    v_clean_email,
    v_encrypted_pwd,
    NULL,
    '{"provider":"email","providers":["email"]}'::jsonb,
    jsonb_build_object('full_name', p_full_name, 'phone', v_clean_phone, 'subject', v_clean_subject, 'tenant_id', v_tenant_id, 'role', v_user_role),
    NOW(),
    NOW(),
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    '',
    null,
    false,
    false
  );

  INSERT INTO auth.identities (
    id,
    user_id,
    identity_data,
    provider,
    provider_id,
    last_sign_in_at,
    created_at,
    updated_at
  ) VALUES (
    v_identity_id,
    v_user_id,
    jsonb_build_object('sub', v_user_id::text, 'email', v_clean_email, 'email_verified', false, 'phone_verified', false),
    'email',
    v_user_id::text,
    NOW(),
    NOW(),
    NOW()
  );

  INSERT INTO public.users (id, tenant_id, email, role, full_name, phone, subject)
  VALUES (v_user_id, v_tenant_id, v_clean_email, v_user_role, p_full_name, v_clean_phone, v_clean_subject);

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id', v_user_id,
    'role', v_user_role,
    'full_name', p_full_name,
    'phone', v_clean_phone,
    'subject', v_clean_subject,
    'tenant_name', v_tenant_row.name,
    'trial_ends_at', v_tenant_row.trial_ends_at,
    'subscription_status', v_tenant_row.subscription_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_tenant_owner_direct(
  p_email text,
  p_password text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'extensions', 'pg_temp'
AS $function$
BEGIN
  RETURN public.register_tenant_owner_direct(
    p_email, p_password, p_full_name, p_phone, p_tenant_name, p_account_type, p_trial_ends_at, ''
  );
END;
$function$;

-- 5. Overload / Update register_tenant_owner
CREATE OR REPLACE FUNCTION public.register_tenant_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone,
  p_subject text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
DECLARE
  v_tenant_id uuid;
  v_user_role text;
  v_normalized_account_type text;
  v_tenant_row RECORD;
  v_clean_subject text := trim(COALESCE(p_subject, ''));
BEGIN
  IF EXISTS (SELECT 1 FROM public.users WHERE id = p_user_id) THEN
    RAISE EXCEPTION 'USER_ALREADY_EXISTS: User % already has an associated tenant profile', p_user_id;
  END IF;

  v_normalized_account_type := CASE WHEN p_account_type = 'center' THEN 'center' ELSE 'teacher' END;
  v_user_role := CASE WHEN v_normalized_account_type = 'center' THEN 'center_owner' ELSE 'owner' END;

  INSERT INTO public.tenants (name, status, subscription_status, trial_ends_at, account_type, settings)
  VALUES (p_tenant_name, 'active', 'trial', p_trial_ends_at, v_normalized_account_type, jsonb_build_object('subject', v_clean_subject))
  RETURNING id, name, subscription_status, trial_ends_at, account_type INTO v_tenant_row;

  v_tenant_id := v_tenant_row.id;

  INSERT INTO public.users (id, tenant_id, email, role, phone, full_name, subject)
  VALUES (p_user_id, v_tenant_id, p_email, v_user_role, p_phone, p_full_name, v_clean_subject);

  UPDATE auth.users
  SET 
    email_confirmed_at = COALESCE(email_confirmed_at, NOW()),
    raw_user_meta_data = jsonb_build_object(
      'full_name', p_full_name,
      'phone', p_phone,
      'subject', v_clean_subject,
      'tenant_id', v_tenant_id,
      'role', v_user_role
    )
  WHERE id = p_user_id;

  RETURN jsonb_build_object(
    'tenant_id', v_tenant_id,
    'user_id', p_user_id,
    'role', v_user_role,
    'full_name', p_full_name,
    'phone', p_phone,
    'subject', v_clean_subject,
    'tenant_name', v_tenant_row.name,
    'trial_ends_at', v_tenant_row.trial_ends_at,
    'subscription_status', v_tenant_row.subscription_status
  );
END;
$function$;

CREATE OR REPLACE FUNCTION public.register_tenant_owner(
  p_user_id uuid,
  p_email text,
  p_full_name text,
  p_phone text,
  p_tenant_name text,
  p_account_type text,
  p_trial_ends_at timestamp with time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'auth', 'pg_temp'
AS $function$
BEGIN
  RETURN public.register_tenant_owner(
    p_user_id, p_email, p_full_name, p_phone, p_tenant_name, p_account_type, p_trial_ends_at, ''
  );
END;
$function$;


-- ==========================================
-- MIGRATION: 20260920000008_fix_function_overload_ambiguity.sql
-- ==========================================
-- Fix function overload ambiguity for register_tenant_owner and register_tenant_owner_direct
-- Drops the redundant 7-argument wrapper overloads because the 8-argument functions have `p_subject text DEFAULT ''`
-- This allows both 7-argument and 8-argument invocations to resolve unambiguously.

DROP FUNCTION IF EXISTS public.register_tenant_owner_direct(text, text, text, text, text, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.register_tenant_owner(uuid, text, text, text, text, text, timestamp with time zone);

GRANT EXECUTE ON FUNCTION public.register_tenant_owner_direct(text, text, text, text, text, text, timestamp with time zone, text) TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.register_tenant_owner(uuid, text, text, text, text, text, timestamp with time zone, text) TO anon, authenticated, service_role, postgres;


-- ==========================================
-- MIGRATION: 20260920000008_update_pricing_plans_499_899_1399.sql
-- ==========================================
-- Migration: 20260920000008_update_pricing_plans_499_899_1399.sql
-- Description: Update pricing tiers and standard limits:
--   - Starter: 300 students @ 499 EGP/mo (4,790 EGP/yr)
--   - Growth: 750 students @ 899 EGP/mo (8,630 EGP/yr)
--   - Pro: 1500 students @ 1,399 EGP/mo (13,430 EGP/yr)

-- Ensure all tenants on 'growth' have 750 students limit and standard plan name
UPDATE public.tenants
SET settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', '"plan_750"'::jsonb),
        '{plan_name}', '"باقة 750 طالب"'::jsonb
      ),
      '{students_limit}', '750'::jsonb
    )
WHERE subscription_tier = 'growth'
  AND (settings->>'students_limit' IS NULL OR (settings->>'students_limit')::int = 250);

-- Ensure all tenants on 'starter' have 300 students limit and standard plan name
UPDATE public.tenants
SET settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', '"plan_300"'::jsonb),
        '{plan_name}', '"باقة 300 طالب"'::jsonb
      ),
      '{students_limit}', '300'::jsonb
    )
WHERE subscription_tier = 'starter'
  AND (settings->>'students_limit' IS NULL OR (settings->>'students_limit')::int = 100);

-- Ensure all tenants on 'pro' have 1500 students limit and standard plan name
UPDATE public.tenants
SET settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', '"plan_1500"'::jsonb),
        '{plan_name}', '"باقة 1500 طالب"'::jsonb
      ),
      '{students_limit}', '1500'::jsonb
    )
WHERE subscription_tier = 'pro'
  AND (settings->>'students_limit' IS NULL OR (settings->>'students_limit')::int = 500);

COMMENT ON TABLE public.tenants IS 'Tenants representing teachers or tutoring centers. Standard tiers: starter (300 students @ 499 EGP), growth (750 students @ 899 EGP), pro (1500 students @ 1399 EGP).';


-- ==========================================
-- MIGRATION: 20260921000001_restore_table_grants_for_anon_and_authenticated.sql
-- ==========================================
-- Restore table-level permissions to anon, authenticated, and service_role.
-- Row Level Security (RLS) remains active on all tables to enforce strict tenant isolation.
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON TABLES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON SEQUENCES TO anon, authenticated, service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON ROUTINES TO anon, authenticated, service_role;


-- ==========================================
-- MIGRATION: 20260921000002_allow_portal_homework_submission.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260921000002_allow_portal_homework_submission.sql
-- Description: Allows public student/parent portal homework queries and submissions
--              under RLS by granting select on homework materials, select on students
--              with active portal tokens, and insert/update on homework_submissions.
-- ============================================================================

-- 1. study_materials: allow anon to read homework materials
DROP POLICY IF EXISTS "study_materials_anon_select_homework" ON public.study_materials;
CREATE POLICY "study_materials_anon_select_homework"
  ON public.study_materials
  FOR SELECT
  TO anon
  USING (is_homework = true);

-- 2. students: allow anon to read students with portal token for validation
DROP POLICY IF EXISTS "students_anon_portal_select" ON public.students;
CREATE POLICY "students_anon_portal_select"
  ON public.students
  FOR SELECT
  TO anon
  USING (parent_portal_token IS NOT NULL);

-- 3. homework_submissions: allow anon to submit (insert/update) and select
DROP POLICY IF EXISTS "homework_submissions_anon_insert" ON public.homework_submissions;
CREATE POLICY "homework_submissions_anon_insert"
  ON public.homework_submissions
  FOR INSERT
  TO anon
  WITH CHECK (true);

DROP POLICY IF EXISTS "homework_submissions_anon_update" ON public.homework_submissions;
CREATE POLICY "homework_submissions_anon_update"
  ON public.homework_submissions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

DROP POLICY IF EXISTS "homework_submissions_anon_select" ON public.homework_submissions;
CREATE POLICY "homework_submissions_anon_select"
  ON public.homework_submissions
  FOR SELECT
  TO anon
  USING (true);


-- ==========================================
-- MIGRATION: 20260921000003_secure_assistant_rpcs_and_rls.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260921000003_secure_assistant_rpcs_and_rls.sql
-- Description: Adds SECURITY DEFINER RPCs for assistants management and updates
--              RLS policies to support teachers, center owners, and assistants.
-- ============================================================================

-- 1. Update RLS policy to include all teacher and assistant roles
DROP POLICY IF EXISTS "Center owners can manage assistants" ON public.assistants;
DROP POLICY IF EXISTS "Tenant staff can manage assistants" ON public.assistants;

CREATE POLICY "Tenant staff can manage assistants"
  ON public.assistants
  FOR ALL
  TO public
  USING (
    tenant_id = public.get_current_user_tenant_id()
    AND public.get_current_user_role() IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher')
  )
  WITH CHECK (
    tenant_id = public.get_current_user_tenant_id()
    AND public.get_current_user_role() IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher')
  );

-- 2. Drop existing create_assistant_secure signatures
DROP FUNCTION IF EXISTS public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text);
DROP FUNCTION IF EXISTS public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text, text, uuid, text);

-- 3. Create or replace secure RPC functions
CREATE OR REPLACE FUNCTION public.create_assistant_secure(
  p_tenant_id uuid,
  p_name text,
  p_phone text,
  p_assistant_type text DEFAULT 'assistant_to_teacher',
  p_teacher_id uuid DEFAULT NULL,
  p_can_view_financials boolean DEFAULT false,
  p_status text DEFAULT 'active',
  p_salary numeric DEFAULT 0,
  p_user_id uuid DEFAULT NULL,
  p_invite_token text DEFAULT NULL,
  p_role_type text DEFAULT 'both',
  p_group_id uuid DEFAULT NULL,
  p_salary_model text DEFAULT 'monthly'
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
  v_row record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant creation is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to create assistant' USING ERRCODE = '42501';
    END IF;
  END IF;

  INSERT INTO public.assistants (
    tenant_id,
    teacher_id,
    name,
    phone,
    role_type,
    assistant_type,
    can_view_financials,
    group_id,
    salary_model,
    salary,
    status,
    user_id,
    invite_token
  ) VALUES (
    p_tenant_id,
    p_teacher_id,
    p_name,
    p_phone,
    COALESCE(p_role_type, 'both'),
    COALESCE(p_assistant_type, 'assistant_to_teacher'),
    COALESCE(p_can_view_financials, false),
    p_group_id,
    COALESCE(p_salary_model, 'monthly'),
    COALESCE(p_salary, 0),
    COALESCE(p_status, 'active'),
    p_user_id,
    p_invite_token
  )
  RETURNING * INTO v_row;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.update_assistant_secure(
  p_id uuid,
  p_tenant_id uuid,
  p_name text DEFAULT NULL,
  p_phone text DEFAULT NULL,
  p_role_type text DEFAULT NULL,
  p_group_id uuid DEFAULT NULL,
  p_clear_group boolean DEFAULT false,
  p_salary_model text DEFAULT NULL,
  p_salary numeric DEFAULT NULL,
  p_status text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
  v_row record;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant update is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to update assistant' USING ERRCODE = '42501';
    END IF;
  END IF;

  UPDATE public.assistants
  SET
    name = COALESCE(p_name, name),
    phone = COALESCE(p_phone, phone),
    role_type = COALESCE(p_role_type, role_type),
    group_id = CASE WHEN p_clear_group THEN NULL ELSE COALESCE(p_group_id, group_id) END,
    salary_model = COALESCE(p_salary_model, salary_model),
    salary = COALESCE(p_salary, salary),
    status = COALESCE(p_status, status),
    updated_at = now()
  WHERE id = p_id AND tenant_id = p_tenant_id
  RETURNING * INTO v_row;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assistant not found or does not belong to tenant' USING ERRCODE = 'P0002';
  END IF;

  RETURN to_jsonb(v_row);
END;
$$;

CREATE OR REPLACE FUNCTION public.delete_assistant_secure(
  p_id uuid,
  p_tenant_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_uid uuid;
  v_caller_tenant uuid;
  v_caller_role text;
BEGIN
  v_caller_uid := auth.uid();
  IF v_caller_uid IS NOT NULL THEN
    SELECT tenant_id, role INTO v_caller_tenant, v_caller_role
    FROM public.users
    WHERE id = v_caller_uid;

    IF v_caller_tenant IS NOT NULL AND v_caller_tenant <> p_tenant_id THEN
      RAISE EXCEPTION 'UNAUTHORIZED: Cross-tenant deletion is forbidden' USING ERRCODE = '42501';
    END IF;

    IF v_caller_role IS NOT NULL AND v_caller_role NOT IN ('admin', 'owner', 'center_owner', 'teacher', 'assistant', 'assistant_to_center', 'assistant_to_teacher') THEN
      RAISE EXCEPTION 'FORBIDDEN: Insufficient permissions to delete assistant' USING ERRCODE = '42501';
    END IF;
  END IF;

  DELETE FROM public.assistants
  WHERE id = p_id AND tenant_id = p_tenant_id;

  RETURN FOUND;
END;
$$;

CREATE OR REPLACE FUNCTION public.list_assistants_secure(
  p_tenant_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  SELECT COALESCE(jsonb_agg(to_jsonb(a)), '[]'::jsonb)
  INTO v_result
  FROM (
    SELECT *
    FROM public.assistants
    WHERE tenant_id = p_tenant_id
    ORDER BY created_at DESC
  ) a;

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.create_assistant_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.update_assistant_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.delete_assistant_secure TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.list_assistants_secure TO anon, authenticated, service_role;


-- ==========================================
-- MIGRATION: 20260921000004_make_homework_bucket_public.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260921000004_make_homework_bucket_public.sql
-- Description: Ensures the homework-submissions storage bucket is set to public
--              so preview links (/storage/v1/object/public/...) can be viewed
--              by teachers and students without 404 NoSuchBucket errors.
-- ============================================================================

UPDATE storage.buckets
SET public = true
WHERE id = 'homework-submissions';


-- ==========================================
-- MIGRATION: 20260921000005_fix_parent_portal_teacher_subject_name.sql
-- ==========================================
-- 20260921000005_fix_parent_portal_teacher_subject_name.sql
-- Clean teacher name resolution and expose subject_name in get_parent_portal_payload RPC

CREATE OR REPLACE FUNCTION public.get_parent_portal_payload(
  p_token text,
  p_student_id uuid DEFAULT NULL,
  p_tenant_id uuid DEFAULT NULL
)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_student record;
  v_group_name text;
  v_subject_name text;
  v_center_name text;
  v_teacher_id uuid;
  v_teacher_name text;
  v_tenant_name text;
  v_attendance json;
  v_quizzes json;
  v_materials json;
  v_attendance_stats record;
  v_quiz_stats record;
  v_result json;
BEGIN
  -- 1. Locate student either by (id, tenant_id) if verified by HMAC, or by parent_portal_token
  IF p_student_id IS NOT NULL AND p_tenant_id IS NOT NULL THEN
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.id = p_student_id AND s.tenant_id = p_tenant_id
    LIMIT 1;

    -- Update parent_portal_token if needed
    IF FOUND AND p_token IS NOT NULL AND length(p_token) > 0 THEN
      UPDATE students 
      SET parent_portal_token = p_token 
      WHERE id = v_student.id AND (parent_portal_token IS NULL OR parent_portal_token = '');
    END IF;
  ELSE
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, s.group_id
    INTO v_student
    FROM students s
    WHERE s.parent_portal_token = p_token
    LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RETURN NULL;
  END IF;

  -- 2. Fetch group, center name, and teacher
  IF v_student.group_id IS NOT NULL THEN
    SELECT g.name, g.center_name, g.teacher_id, g.subject INTO v_group_name, v_center_name, v_teacher_id, v_subject_name
    FROM groups g
    WHERE g.id = v_student.group_id;
  ELSE
    SELECT g.name, g.center_name, g.teacher_id, g.subject INTO v_group_name, v_center_name, v_teacher_id, v_subject_name
    FROM group_students gs
    JOIN groups g ON gs.group_id = g.id
    WHERE gs.student_id = v_student.id
    LIMIT 1;
  END IF;

  -- Resolve teacher name:
  -- Priority 1: linked teacher row
  IF v_teacher_id IS NOT NULL THEN
    SELECT t.name INTO v_teacher_name FROM teachers t WHERE t.id = v_teacher_id;
  END IF;

  -- Priority 2: first teacher in teachers table
  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT t.name INTO v_teacher_name FROM teachers t WHERE t.tenant_id = v_student.tenant_id LIMIT 1;
  END IF;

  -- Priority 3: user with role owner/teacher in public.users (clean personal name)
  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT u.full_name INTO v_teacher_name 
    FROM public.users u 
    WHERE u.tenant_id = v_student.tenant_id 
      AND u.role IN ('owner', 'teacher') 
      AND u.full_name IS NOT NULL 
      AND u.full_name != ''
    ORDER BY u.created_at ASC 
    LIMIT 1;
  END IF;

  -- Priority 4: tenant name with corporate/system suffixes stripped
  IF v_teacher_name IS NULL OR v_teacher_name = '' THEN
    SELECT tn.name INTO v_tenant_name FROM tenants tn WHERE tn.id = v_student.tenant_id LIMIT 1;
    v_teacher_name := REGEXP_REPLACE(COALESCE(v_tenant_name, 'أستاذ المادة'), '\s*[-–—]\s*(منظومة|سنترلي|أكاديمية|سنتر).*$', '', 'i');
  END IF;

  -- Resolve subject name fallback if group had none
  IF v_subject_name IS NULL OR v_subject_name = '' THEN
    SELECT u.subject INTO v_subject_name 
    FROM public.users u 
    WHERE u.tenant_id = v_student.tenant_id 
      AND u.subject IS NOT NULL 
      AND u.subject != ''
    LIMIT 1;
  END IF;

  IF v_subject_name IS NULL OR v_subject_name = '' THEN
    SELECT tn.settings->>'subject' INTO v_subject_name 
    FROM tenants tn 
    WHERE tn.id = v_student.tenant_id;
  END IF;

  -- 3. Fetch attendance history
  SELECT json_agg(t) INTO v_attendance
  FROM (
    SELECT 
      a.id,
      a.attended,
      a.comment,
      CASE 
        WHEN a.attended = false THEN NULL 
        ELSE a.homework_status 
      END AS homework_status,
      a.created_at,
      COALESCE(s.session_number, 1) AS session_number,
      COALESCE(s.session_date::text, (a.created_at::date)::text) AS session_date
    FROM attendance a
    LEFT JOIN sessions s ON a.session_id = s.id
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id
    ORDER BY a.created_at DESC
    LIMIT 25
  ) t;

  -- Attendance stats
  SELECT 
    COUNT(*)::int AS total,
    COUNT(*) FILTER (WHERE a.attended = true)::int AS attended_count,
    COUNT(*) FILTER (WHERE a.attended = false)::int AS absent_count,
    COUNT(*) FILTER (WHERE a.attended = true AND a.homework_status IS NOT NULL)::int AS hw_total_count,
    COUNT(*) FILTER (WHERE a.attended = true AND a.homework_status IN ('done', 'completed', 'delivered'))::int AS hw_done_count
  INTO v_attendance_stats
  FROM attendance a
  WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id;

  -- 4. Fetch Quizzes & scores
  SELECT json_agg(q_row) INTO v_quizzes
  FROM (
    SELECT 
      qs.id,
      qs.quiz_id,
      COALESCE(q.title, CASE WHEN qs.quiz_number IS NOT NULL THEN CONCAT('كويز ', qs.quiz_number::text) ELSE 'امتحان' END) AS title,
      COALESCE(q.quiz_date::text, (qs.created_at::date)::text) AS date,
      qs.score,
      COALESCE(qs.max_score, q.max_score, 20) AS max_score,
      qs.note,
      qs.note AS notes,
      ROUND((qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS percentage,
      CASE 
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 85 THEN 'ممتاز'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 75 THEN 'جيد جداً'
        WHEN (qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100) >= 60 THEN 'جيد'
        ELSE 'يحتاج متابعة'
      END AS tier
    FROM quiz_scores qs
    LEFT JOIN quizzes q ON qs.quiz_id = q.id
    WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id
    ORDER BY COALESCE(q.quiz_date::text, (qs.created_at::date)::text) DESC, qs.created_at DESC
    LIMIT 25
  ) q_row;

  -- Quiz stats
  SELECT 
    COUNT(*)::int AS total_quizzes,
    ROUND(AVG(qs.score / NULLIF(COALESCE(qs.max_score, q.max_score, 20), 0) * 100)::numeric, 1) AS avg_score
  INTO v_quiz_stats
  FROM quiz_scores qs
  LEFT JOIN quizzes q ON qs.quiz_id = q.id
  WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id;

  -- 5. Fetch Study Materials & Homework with student's submission status + book details
  SELECT json_agg(m_row) INTO v_materials
  FROM (
    SELECT 
      m.id,
      m.title,
      m.description,
      m.type,
      m.url,
      m.is_homework,
      COALESCE(m.due_date::text, '') AS due_date,
      COALESCE(m.created_at::date::text, '') AS created_date,
      COALESCE(hs.status, 'unsubmitted') AS submission_status,
      hs.file_url AS submission_url,
      hs.submitted_at::text AS submitted_at,
      hs.teacher_notes AS teacher_feedback,
      m.book_name,
      m.pages,
      m.questions
    FROM study_materials m
    LEFT JOIN homework_submissions hs ON hs.material_id = m.id AND hs.student_id = v_student.id
    WHERE m.tenant_id = v_student.tenant_id
      AND (m.group_id IS NULL OR m.group_id = v_student.group_id)
    ORDER BY m.created_at DESC
    LIMIT 30
  ) m_row;

  -- 6. Build final JSON matching frontend exact contract
  v_result := json_build_object(
    'student', json_build_object(
      'id', v_student.id,
      'name', v_student.name,
      'student_code', COALESCE(v_student.code, '—'),
      'group_name', COALESCE(v_group_name, 'مجموعة عامة'),
      'subject_name', COALESCE(v_subject_name, ''),
      'center_name', COALESCE(v_center_name, ''),
      'teacher_name', COALESCE(v_teacher_name, 'أستاذ المادة')
    ),
    'summary', json_build_object(
      'total_sessions', COALESCE(v_attendance_stats.total, 0),
      'attended_count', COALESCE(v_attendance_stats.attended_count, 0),
      'absent_count', COALESCE(v_attendance_stats.absent_count, 0),
      'attendance_rate', CASE WHEN COALESCE(v_attendance_stats.total, 0) > 0 
        THEN CONCAT(ROUND((v_attendance_stats.attended_count::numeric / v_attendance_stats.total::numeric) * 100)::text, '%')
        ELSE '100%' END,
      'homework_done_count', COALESCE((
        SELECT COUNT(*)::int FROM homework_submissions hs2
        WHERE hs2.student_id = v_student.id AND hs2.status = 'approved'
      ), COALESCE(v_attendance_stats.hw_done_count, 0)),
      'homework_total_count', COALESCE((
        SELECT COUNT(*)::int FROM study_materials sm2
        WHERE sm2.tenant_id = v_student.tenant_id AND sm2.is_homework = true
          AND (sm2.group_id IS NULL OR sm2.group_id = v_student.group_id)
      ), 0),
      'total_quizzes', COALESCE(v_quiz_stats.total_quizzes, 0),
      'quiz_average_percentage', CASE WHEN COALESCE(v_quiz_stats.total_quizzes, 0) > 0
        THEN CONCAT(ROUND(v_quiz_stats.avg_score)::text, '%')
        ELSE '—' END
    ),
    'sessions', COALESCE(v_attendance, '[]'::json),
    'quizzes', COALESCE(v_quizzes, '[]'::json),
    'materials', COALESCE(v_materials, '[]'::json),
    'last_updated', now()
  );

  RETURN v_result;
END;
$$;

GRANT EXECUTE ON FUNCTION public.get_parent_portal_payload(text, uuid, uuid) TO anon, authenticated;


-- ==========================================
-- MIGRATION: 20260922000001_allow_zero_amount_and_coupon_payment_proof.sql
-- ==========================================
-- Migration: Allow zero amount and coupon payment method in payment_proofs for 100% discount coupons

ALTER TABLE public.payment_proofs 
  DROP CONSTRAINT IF EXISTS payment_proofs_amount_check;

ALTER TABLE public.payment_proofs 
  ADD CONSTRAINT payment_proofs_amount_check CHECK (amount >= 0);

ALTER TABLE public.payment_proofs 
  DROP CONSTRAINT IF EXISTS payment_proofs_payment_method_check;

ALTER TABLE public.payment_proofs 
  ADD CONSTRAINT payment_proofs_payment_method_check 
  CHECK (payment_method = ANY (ARRAY['instapay'::text, 'vodafone_cash'::text, 'bank_transfer'::text, 'cash'::text, 'coupon'::text, 'other'::text]));


-- ==========================================
-- MIGRATION: 20260924000001_fix_study_materials_permanent_public_urls.sql
-- ==========================================
-- ============================================================================
-- Migration: 20260924000001_fix_study_materials_permanent_public_urls.sql
-- Description: Converts any legacy signed temporary URLs (/object/sign/...)
--              in study_materials table to permanent public URLs (/object/public/...)
--              to prevent JWT expiration ("exp" claim timestamp check failed).
-- ============================================================================

UPDATE study_materials
SET url = split_part(replace(url, '/storage/v1/object/sign/homework-submissions/', '/storage/v1/object/public/homework-submissions/'), '?', 1)
WHERE url LIKE '%/storage/v1/object/sign/homework-submissions/%';


-- ==========================================
-- MIGRATION: 20260929000001_meta_portal_dispatch_queue.sql
-- ==========================================
-- 20260929000001_meta_portal_dispatch_queue.sql
-- Queue and tracking table for official Meta WhatsApp Cloud API portal links dispatch

CREATE TABLE IF NOT EXISTS public.meta_portal_dispatch_queue (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id TEXT NOT NULL,
    teacher_id UUID,
    student_id UUID NOT NULL REFERENCES public.students(id) ON DELETE CASCADE,
    recipient_type VARCHAR(16) NOT NULL, -- 'student' or 'parent'
    recipient_phone VARCHAR(32) NOT NULL,
    template_name VARCHAR(64) NOT NULL, -- 'centerly' or 'centerly_student'
    language_code VARCHAR(16) NOT NULL DEFAULT 'en',
    parameters JSONB NOT NULL DEFAULT '[]'::jsonb, -- ['Student Name', 'Subject', 'Teacher Name']
    status VARCHAR(16) NOT NULL DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'queued'
    scheduled_date DATE NOT NULL DEFAULT CURRENT_DATE,
    meta_message_id VARCHAR(128),
    error_message TEXT,
    attempts INT NOT NULL DEFAULT 0,
    sent_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_meta_queue_status_date ON public.meta_portal_dispatch_queue(status, scheduled_date, created_at);
CREATE INDEX IF NOT EXISTS idx_meta_queue_tenant ON public.meta_portal_dispatch_queue(tenant_id);
CREATE INDEX IF NOT EXISTS idx_meta_queue_student ON public.meta_portal_dispatch_queue(student_id);

ALTER TABLE public.meta_portal_dispatch_queue ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'meta_portal_dispatch_queue' 
        AND policyname = 'meta_queue_service_role'
    ) THEN
        CREATE POLICY meta_queue_service_role ON public.meta_portal_dispatch_queue
            FOR ALL TO service_role USING (true) WITH CHECK (true);
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE tablename = 'meta_portal_dispatch_queue' 
        AND policyname = 'meta_queue_tenant_select'
    ) THEN
        CREATE POLICY meta_queue_tenant_select ON public.meta_portal_dispatch_queue
            FOR SELECT TO authenticated
            USING (tenant_id = (auth.jwt() ->> 'tenant_id') OR tenant_id = 'default');
    END IF;
END $$;


-- ==========================================
-- MIGRATION: 20260929000002_fix_rls_disabled_in_public.sql
-- ==========================================
-- Migration: 20260929000002_fix_rls_disabled_in_public.sql
-- Fixes Supabase Security Advisor critical issue: rls_disabled_in_public on gift_codes & email_verifications

ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny anon access on gift_codes" ON public.gift_codes;
CREATE POLICY "Deny anon access on gift_codes" ON public.gift_codes
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role only on email_verifications" ON public.email_verifications;
CREATE POLICY "Service role only on email_verifications" ON public.email_verifications
  FOR ALL TO service_role USING (true);


-- ==========================================
-- MIGRATION: 20260930000001_meta_portal_queue_rls_fix.sql
-- ==========================================
-- Migration: 20260930000001_meta_portal_queue_rls_fix.sql
-- Fixes RLS insert permission on meta_portal_dispatch_queue for authenticated teachers

DROP POLICY IF EXISTS meta_queue_tenant_all ON public.meta_portal_dispatch_queue;
DROP POLICY IF EXISTS meta_queue_tenant_insert ON public.meta_portal_dispatch_queue;
DROP POLICY IF EXISTS meta_queue_tenant_update ON public.meta_portal_dispatch_queue;

CREATE POLICY meta_queue_tenant_all ON public.meta_portal_dispatch_queue
    FOR ALL TO authenticated
    USING (true)
    WITH CHECK (true);

GRANT ALL ON public.meta_portal_dispatch_queue TO authenticated;
GRANT ALL ON public.meta_portal_dispatch_queue TO service_role;


-- ==========================================
-- MIGRATION: 20260930000002_students_unique_code_per_tenant.sql
-- ==========================================
-- Migration: 20260930000002_students_unique_code_per_tenant.sql
-- Enforce unique student codes per tenant to prevent duplicate codes across students

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_tenant_code_unique 
ON public.students (tenant_id, code) 
WHERE code IS NOT NULL AND code <> '';

CREATE UNIQUE INDEX IF NOT EXISTS idx_students_tenant_student_code_unique 
ON public.students (tenant_id, student_code) 
WHERE student_code IS NOT NULL AND student_code <> '';


-- ==========================================
-- MIGRATION: 20260930000003_fix_email_verifications_rls.sql
-- ==========================================
-- Migration: 20260930000003_fix_email_verifications_rls.sql
-- Fixes RLS on email_verifications so backend (anon/service_role) can manage verification codes for public signups.

DROP POLICY IF EXISTS "Service role only on email_verifications" ON public.email_verifications;
DROP POLICY IF EXISTS "Allow backend OTP management on email_verifications" ON public.email_verifications;

CREATE POLICY "Allow backend OTP management on email_verifications"
ON public.email_verifications
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Provide SECURITY DEFINER RPC helper for recording OTP
CREATE OR REPLACE FUNCTION record_email_otp(p_email text, p_code text, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verifications WHERE email = lower(trim(p_email));
  INSERT INTO public.email_verifications (email, code, expires_at, attempts)
  VALUES (lower(trim(p_email)), trim(p_code), p_expires_at, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION record_email_otp(text, text, timestamptz) TO anon, authenticated, service_role;


-- ==========================================
-- MIGRATION: 20260930000004_create_whatsapp_inbox.sql
-- ==========================================
-- Migration: 20260930000004_create_whatsapp_inbox.sql
-- Creates public.whatsapp_inbox table for tracking incoming and outgoing WhatsApp messages, replies, and status.

CREATE TABLE IF NOT EXISTS public.whatsapp_inbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE,
  student_id UUID REFERENCES public.students(id) ON DELETE SET NULL,
  phone TEXT NOT NULL,
  student_name TEXT,
  direction TEXT NOT NULL CHECK (direction IN ('inbound', 'outbound')),
  message_body TEXT NOT NULL,
  meta_message_id TEXT,
  status TEXT DEFAULT 'unread',
  has_replied BOOLEAN DEFAULT false,
  reply_body TEXT,
  replied_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_tenant ON public.whatsapp_inbox(tenant_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_whatsapp_inbox_phone ON public.whatsapp_inbox(phone);

ALTER TABLE public.whatsapp_inbox ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Allow all access on whatsapp_inbox" ON public.whatsapp_inbox;
CREATE POLICY "Allow all access on whatsapp_inbox"
ON public.whatsapp_inbox
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);


-- ==========================================
-- MIGRATION: 20261022000001_create_tenant_platform_settings.sql
-- ==========================================
-- Migration: 20261022000001_create_tenant_platform_settings.sql
-- Description: Create tenant_platform_settings table for white-label teacher portals with subdomains and branding

CREATE TABLE IF NOT EXISTS public.tenant_platform_settings (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID REFERENCES public.tenants(id) ON DELETE CASCADE UNIQUE NOT NULL,
    subdomain VARCHAR(60) UNIQUE NOT NULL,
    display_title VARCHAR(150) NOT NULL,
    subject_title VARCHAR(150) NOT NULL,
    headline_text TEXT,
    subtitle_text TEXT,
    cutout_avatar_url TEXT,
    theme_preset VARCHAR(30) DEFAULT 'navy' NOT NULL,
    custom_primary_color VARCHAR(10),
    is_active BOOLEAN DEFAULT true NOT NULL,
    allow_public_signup BOOLEAN DEFAULT true NOT NULL,
    require_approval BOOLEAN DEFAULT false NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Index for instant lookup by subdomain on public visitor hits
CREATE INDEX IF NOT EXISTS idx_tenant_platform_settings_subdomain ON public.tenant_platform_settings (LOWER(subdomain));
CREATE INDEX IF NOT EXISTS idx_tenant_platform_settings_tenant_id ON public.tenant_platform_settings (tenant_id);

-- Enable RLS
ALTER TABLE public.tenant_platform_settings ENABLE ROW LEVEL SECURITY;

-- 1. Public Read Policy: Anyone (anon or authenticated) can view active platform settings by subdomain
-- This allows students and visitors to see the teacher's branded landing page and login form
DROP POLICY IF EXISTS "Public read platform settings by subdomain" ON public.tenant_platform_settings;
CREATE POLICY "Public read platform settings by subdomain"
ON public.tenant_platform_settings
FOR SELECT
TO anon, authenticated
USING (is_active = true);

-- 2. Teacher Management Policy: Teachers can only view, insert, update or delete their own tenant's settings
DROP POLICY IF EXISTS "Tenant owners manage platform settings" ON public.tenant_platform_settings;
CREATE POLICY "Tenant owners manage platform settings"
ON public.tenant_platform_settings
FOR ALL
TO authenticated
USING (
    tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
)
WITH CHECK (
    tenant_id IN (
        SELECT p.tenant_id FROM public.profiles p WHERE p.id = auth.uid()
    )
);

-- Trigger to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at_tenant_platform_settings()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_timestamp_tenant_platform_settings ON public.tenant_platform_settings;
CREATE TRIGGER set_timestamp_tenant_platform_settings
BEFORE UPDATE ON public.tenant_platform_settings
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at_tenant_platform_settings();


