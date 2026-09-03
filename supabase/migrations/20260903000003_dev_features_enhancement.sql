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
