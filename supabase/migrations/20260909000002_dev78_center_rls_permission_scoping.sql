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
