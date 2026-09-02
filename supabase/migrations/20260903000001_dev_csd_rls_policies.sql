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
