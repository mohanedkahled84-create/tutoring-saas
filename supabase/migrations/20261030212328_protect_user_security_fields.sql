-- Keep normal profile editing while reserving identity, role, membership and
-- PIN state writes for the authenticated backend service. RLS still applies.
revoke update on public.users from authenticated;
revoke update (id, tenant_id, role, email, teacher_id, assistant_id, created_at,
  financial_pin_hash, failed_pin_attempts, pin_locked_until) on public.users from authenticated;
grant update (full_name, phone, subject) on public.users to authenticated;

-- A tenant colleague must never receive another user's PIN hash/lock state.
revoke select on public.users from authenticated;
revoke select (financial_pin_hash, failed_pin_attempts, pin_locked_until) on public.users from authenticated;
grant select (id, tenant_id, role, email, teacher_id, assistant_id, created_at,
  full_name, phone, subject) on public.users to authenticated;

-- Self-only RPC retains the profile contract but returns PIN existence, not
-- its credential hash. Deploy the compatible backend before this migration.
create or replace function public.get_user_profile(p_user_id uuid)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare v_user record;
begin
  if auth.role() is distinct from 'service_role' and auth.uid() is distinct from p_user_id then
    raise exception 'Not authorized to read this profile' using errcode = '42501';
  end if;
  select id, tenant_id, role, email, teacher_id, assistant_id,
    full_name, phone, subject, financial_pin_hash into v_user
    from public.users where id = p_user_id;
  if not found then return null; end if;
  return jsonb_build_object('id',v_user.id,'tenant_id',v_user.tenant_id,
    'role',v_user.role,'email',v_user.email,'teacher_id',v_user.teacher_id,
    'assistant_id',v_user.assistant_id,'full_name',v_user.full_name,
    'phone',v_user.phone,'subject',v_user.subject,
    'has_security_pin',v_user.financial_pin_hash is not null);
end;
$$;

-- Resolve tenant identity from the server-owned profile, never an old claim
-- after its profile is removed. This helper is intentionally SECURITY DEFINER
-- to avoid recursion through users' own RLS policies.
create or replace function public.get_current_user_tenant_id()
returns uuid language sql stable security definer set search_path = '' as $$
  select tenant_id from public.users where id = auth.uid();
$$;

alter policy "Users can update own record" on public.users
  using (id = (select auth.uid())) with check (id = (select auth.uid()));
alter policy "Users can view members of own tenant" on public.users
  using (tenant_id = (select public.get_current_user_tenant_id()) or id = (select auth.uid()));
alter policy "Admins have full access to users" on public.users
  using ((select public.is_admin())) with check ((select public.is_admin()));
alter policy "telemetry_events_admin_select" on public.telemetry_events
  using ((select public.is_admin()));
-- Queue rows are tenant data. Shared/default dispatches remain service-only.
alter policy "meta_queue_tenant_select" on public.meta_portal_dispatch_queue
  using (tenant_id = (select public.get_current_user_tenant_id())::text or (select public.is_admin()));
