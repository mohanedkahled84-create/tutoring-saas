-- Cross-Tenant Leak Test Suite (DEV-RLS.3)
-- Tests that RLS strictly enforces isolation between Tenant A and Tenant B.

do $$
declare
  v_tenant_a_id uuid := gen_random_uuid();
  v_tenant_b_id uuid := gen_random_uuid();
  v_user_a_id uuid := gen_random_uuid();
  v_user_b_id uuid := gen_random_uuid();
  v_admin_id uuid := gen_random_uuid();
  v_student_a_id uuid := gen_random_uuid();
  v_student_b_id uuid := gen_random_uuid();
  v_count int;
  v_leak_detected boolean := false;
begin
  -- 1. Setup Test Tenants
  insert into public.tenants (id, name, status) values
    (v_tenant_a_id, 'Test Center Alpha', 'active'),
    (v_tenant_b_id, 'Test Center Beta', 'active');

  -- 2. Setup Test Auth Users
  insert into auth.users (id, email, aud, role) values
    (v_user_a_id, 'owner_a@test.com', 'authenticated', 'authenticated'),
    (v_user_b_id, 'owner_b@test.com', 'authenticated', 'authenticated'),
    (v_admin_id, 'admin@test.com', 'authenticated', 'authenticated');

  -- 3. Setup Test Public Users
  insert into public.users (id, tenant_id, role, email) values
    (v_user_a_id, v_tenant_a_id, 'owner', 'owner_a@test.com'),
    (v_user_b_id, v_tenant_b_id, 'owner', 'owner_b@test.com'),
    (v_admin_id, null, 'admin', 'admin@test.com');

  -- 4. Seed Students for Tenant A and Tenant B
  insert into public.students (id, tenant_id, name, parent_phone) values
    (v_student_a_id, v_tenant_a_id, 'Student A', '01000000001'),
    (v_student_b_id, v_tenant_b_id, 'Student B', '01000000002');

  -- ==========================================================
  -- TEST CASE 1: Tenant A User reads data
  -- ==========================================================
  perform set_config('request.jwt.claim.sub', v_user_a_id::text, true);
  perform set_config('role', 'authenticated', true);

  -- Assert User A can see Student A
  select count(*) into v_count from public.students where id = v_student_a_id;
  if v_count <> 1 then
    raise exception 'RLS Test Failed: User A cannot see own student!';
  end if;

  -- Assert User A CANNOT see Student B
  select count(*) into v_count from public.students where id = v_student_b_id;
  if v_count <> 0 then
    raise exception 'RLS Test Failed: Cross-tenant data leak! User A can see Student B!';
  end if;

  -- ==========================================================
  -- TEST CASE 2: Tenant A User attempts to update Tenant B data
  -- ==========================================================
  update public.students set name = 'Hacked Student' where id = v_student_b_id;
  select count(*) into v_count from public.students where id = v_student_b_id and name = 'Hacked Student';
  if v_count <> 0 then
    raise exception 'RLS Test Failed: User A was able to update Student B!';
  end if;

  -- ==========================================================
  -- TEST CASE 3: Tenant A User attempts to insert row for Tenant B
  -- ==========================================================
  begin
    insert into public.students (tenant_id, name, parent_phone)
    values (v_tenant_b_id, 'Illegal Student', '01000000003');
    v_leak_detected := true;
  exception
    when check_violation or insufficient_privilege then
      v_leak_detected := false;
  end;

  if v_leak_detected then
    raise exception 'RLS Test Failed: User A was able to insert a row into Tenant B!';
  end if;

  -- ==========================================================
  -- TEST CASE 4: Admin sees all tenants
  -- ==========================================================
  perform set_config('request.jwt.claim.sub', v_admin_id::text, true);
  select count(*) into v_count from public.students where id in (v_student_a_id, v_student_b_id);
  if v_count <> 2 then
    raise exception 'RLS Test Failed: Admin could not see all tenants students!';
  end if;

  -- Cleanup test data
  perform set_config('role', 'postgres', true);
  delete from public.students where id in (v_student_a_id, v_student_b_id);
  delete from public.users where id in (v_user_a_id, v_user_b_id, v_admin_id);
  delete from auth.users where id in (v_user_a_id, v_user_b_id, v_admin_id);
  delete from public.tenants where id in (v_tenant_a_id, v_tenant_b_id);

  raise notice 'All cross-tenant leak tests passed successfully!';
end $$;
