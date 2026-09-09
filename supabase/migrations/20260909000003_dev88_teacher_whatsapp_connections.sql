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
