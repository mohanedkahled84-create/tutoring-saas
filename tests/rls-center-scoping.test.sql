-- Center Account Assistant & Teacher Permission Scoping Leak Test Suite (DEV-78)
-- Tests that RLS strictly enforces scoping within a Center tenant:
-- 1. teacher cannot see other teachers' data within the same center
-- 2. assistant-to-teacher cannot see another teacher's data
-- 3. assistant-to-teacher cannot see financial data (teacher payouts)
-- 4. assistant-to-center sees operational data across all teachers, but CANNOT see financial data by default
-- 5. assistant-to-center with can_view_financials = true CAN see financial data
-- 6. center_owner sees everything (operational and financial)

do $$
declare
  v_tenant_id uuid := gen_random_uuid();
  
  -- Users
  v_owner_user_id uuid := gen_random_uuid();
  v_teacher1_user_id uuid := gen_random_uuid();
  v_teacher2_user_id uuid := gen_random_uuid();
  v_asst_t1_user_id uuid := gen_random_uuid();
  v_asst_center_user_id uuid := gen_random_uuid();
  v_asst_center_fin_user_id uuid := gen_random_uuid();

  -- Teacher records
  v_teacher1_id uuid := gen_random_uuid();
  v_teacher2_id uuid := gen_random_uuid();

  -- Assistant records
  v_asst_t1_id uuid := gen_random_uuid();
  v_asst_center_id uuid := gen_random_uuid();
  v_asst_center_fin_id uuid := gen_random_uuid();

  -- Operational records
  v_student1_id uuid := gen_random_uuid();
  v_student2_id uuid := gen_random_uuid();
  v_group1_id uuid := gen_random_uuid();
  v_group2_id uuid := gen_random_uuid();
  v_session1_id uuid := gen_random_uuid();
  v_session2_id uuid := gen_random_uuid();
  v_attendance1_id uuid := gen_random_uuid();
  v_attendance2_id uuid := gen_random_uuid();
  v_enrollment1_id uuid := gen_random_uuid();
  v_enrollment2_id uuid := gen_random_uuid();

  -- Financial records
  v_payout1_id uuid := gen_random_uuid();
  v_payout2_id uuid := gen_random_uuid();

  v_count int;
begin
  -- 1. Setup Center Tenant
  insert into public.tenants (id, name, status, account_type)
  values (v_tenant_id, 'Test Center DEV-78', 'active', 'center');

  -- 2. Setup Auth Users
  insert into auth.users (id, email, aud, role) values
    (v_owner_user_id, 'c_owner@test.com', 'authenticated', 'authenticated'),
    (v_teacher1_user_id, 'teacher1@test.com', 'authenticated', 'authenticated'),
    (v_teacher2_user_id, 'teacher2@test.com', 'authenticated', 'authenticated'),
    (v_asst_t1_user_id, 'asst_t1@test.com', 'authenticated', 'authenticated'),
    (v_asst_center_user_id, 'asst_center@test.com', 'authenticated', 'authenticated'),
    (v_asst_center_fin_user_id, 'asst_center_fin@test.com', 'authenticated', 'authenticated');

  -- 3. Setup Teachers
  insert into public.teachers (id, tenant_id, user_id, name, phone, subjects, revenue_model, revenue_value) values
    (v_teacher1_id, v_tenant_id, v_teacher1_user_id, 'Teacher One', '01011111111', '{"Math"}', 'percentage', 80),
    (v_teacher2_id, v_tenant_id, v_teacher2_user_id, 'Teacher Two', '01022222222', '{"Physics"}', 'percentage', 75);

  -- 4. Setup Assistants
  insert into public.assistants (id, tenant_id, user_id, teacher_id, name, phone, assistant_type, can_view_financials) values
    (v_asst_t1_id, v_tenant_id, v_asst_t1_user_id, v_teacher1_id, 'Asst Teacher 1', '01033333333', 'assistant_to_teacher', false),
    (v_asst_center_id, v_tenant_id, v_asst_center_user_id, null, 'Asst Center General', '01044444444', 'assistant_to_center', false),
    (v_asst_center_fin_id, v_tenant_id, v_asst_center_fin_user_id, null, 'Asst Center Fin', '01055555555', 'assistant_to_center', true);

  -- 5. Setup Public Users
  insert into public.users (id, tenant_id, role, email, teacher_id, assistant_id) values
    (v_owner_user_id, v_tenant_id, 'center_owner', 'c_owner@test.com', null, null),
    (v_teacher1_user_id, v_tenant_id, 'teacher', 'teacher1@test.com', v_teacher1_id, null),
    (v_teacher2_user_id, v_tenant_id, 'teacher', 'teacher2@test.com', v_teacher2_id, null),
    (v_asst_t1_user_id, v_tenant_id, 'assistant_to_teacher', 'asst_t1@test.com', v_teacher1_id, v_asst_t1_id),
    (v_asst_center_user_id, v_tenant_id, 'assistant_to_center', 'asst_center@test.com', null, v_asst_center_id),
    (v_asst_center_fin_user_id, v_tenant_id, 'assistant_to_center', 'asst_center_fin@test.com', null, v_asst_center_fin_id);

  -- 6. Setup Students
  insert into public.students (id, tenant_id, name, parent_phone) values
    (v_student1_id, v_tenant_id, 'Student of Teacher 1', '01099999991'),
    (v_student2_id, v_tenant_id, 'Student of Teacher 2', '01099999992');

  -- 7. Setup Groups
  insert into public.groups (id, tenant_id, teacher_id, name, price) values
    (v_group1_id, v_tenant_id, v_teacher1_id, 'Math Group 1', 150),
    (v_group2_id, v_tenant_id, v_teacher2_id, 'Physics Group 2', 200);

  -- 8. Setup Enrollments
  insert into public.enrollments (id, tenant_id, student_id, teacher_id, group_id) values
    (v_enrollment1_id, v_tenant_id, v_student1_id, v_teacher1_id, v_group1_id),
    (v_enrollment2_id, v_tenant_id, v_student2_id, v_teacher2_id, v_group2_id);

  -- 9. Setup Group Students join
  insert into public.group_students (id, tenant_id, group_id, student_id) values
    (gen_random_uuid(), v_tenant_id, v_group1_id, v_student1_id),
    (gen_random_uuid(), v_tenant_id, v_group2_id, v_student2_id);

  -- 10. Setup Sessions
  insert into public.sessions (id, tenant_id, group_id, teacher_id, session_number, session_date) values
    (v_session1_id, v_tenant_id, v_group1_id, v_teacher1_id, 1, current_date),
    (v_session2_id, v_tenant_id, v_group2_id, v_teacher2_id, 1, current_date);

  -- 11. Setup Attendance
  insert into public.attendance (id, tenant_id, session_id, student_id, teacher_id, attended, idempotency_key) values
    (v_attendance1_id, v_tenant_id, v_session1_id, v_student1_id, v_teacher1_id, true, 'idemp-att-1'),
    (v_attendance2_id, v_tenant_id, v_session2_id, v_student2_id, v_teacher2_id, true, 'idemp-att-2');

  -- 12. Setup Teacher Payouts (Financial Data)
  insert into public.teacher_payouts (id, tenant_id, teacher_id, period, total_revenue, teacher_cut, center_cut) values
    (v_payout1_id, v_tenant_id, v_teacher1_id, '2026-09', 1500, 1200, 300),
    (v_payout2_id, v_tenant_id, v_teacher2_id, '2026-09', 2000, 1500, 500);

  -- ==========================================================================
  -- TEST CASE 1: Teacher 1 can see own data, CANNOT see Teacher 2's data
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_teacher1_user_id::text, true);
  perform set_config('role', 'authenticated', true);

  -- Groups
  select count(*) into v_count from public.groups where id = v_group1_id;
  if v_count <> 1 then raise exception 'RLS Failed: Teacher 1 cannot see own group'; end if;

  select count(*) into v_count from public.groups where id = v_group2_id;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Teacher 1 can see Teacher 2 group!'; end if;

  -- Sessions
  select count(*) into v_count from public.sessions where id = v_session1_id;
  if v_count <> 1 then raise exception 'RLS Failed: Teacher 1 cannot see own session'; end if;

  select count(*) into v_count from public.sessions where id = v_session2_id;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Teacher 1 can see Teacher 2 session!'; end if;

  -- Attendance
  select count(*) into v_count from public.attendance where id = v_attendance1_id;
  if v_count <> 1 then raise exception 'RLS Failed: Teacher 1 cannot see own attendance'; end if;

  select count(*) into v_count from public.attendance where id = v_attendance2_id;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Teacher 1 can see Teacher 2 attendance!'; end if;

  -- Students
  select count(*) into v_count from public.students where id = v_student1_id;
  if v_count <> 1 then raise exception 'RLS Failed: Teacher 1 cannot see enrolled student'; end if;

  select count(*) into v_count from public.students where id = v_student2_id;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Teacher 1 can see Teacher 2 student!'; end if;

  -- Financials (teacher sees own payout, NOT other teacher's payout)
  select count(*) into v_count from public.teacher_payouts where id = v_payout1_id;
  if v_count <> 1 then raise exception 'RLS Failed: Teacher 1 cannot see own payout'; end if;

  select count(*) into v_count from public.teacher_payouts where id = v_payout2_id;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Teacher 1 can see Teacher 2 payout!'; end if;

  -- ==========================================================================
  -- TEST CASE 2: Assistant-to-Teacher 1 cannot see Teacher 2's data
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_asst_t1_user_id::text, true);

  -- Groups
  select count(*) into v_count from public.groups where id = v_group1_id;
  if v_count <> 1 then raise exception 'RLS Failed: Assistant cannot see assigned teacher group'; end if;

  select count(*) into v_count from public.groups where id = v_group2_id;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Assistant-to-teacher 1 can see Teacher 2 group!'; end if;

  -- Sessions
  select count(*) into v_count from public.sessions where id = v_session1_id;
  if v_count <> 1 then raise exception 'RLS Failed: Assistant cannot see assigned teacher session'; end if;

  select count(*) into v_count from public.sessions where id = v_session2_id;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Assistant-to-teacher 1 can see Teacher 2 session!'; end if;

  -- Students
  select count(*) into v_count from public.students where id = v_student1_id;
  if v_count <> 1 then raise exception 'RLS Failed: Assistant cannot see assigned teacher student'; end if;

  select count(*) into v_count from public.students where id = v_student2_id;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Assistant-to-teacher 1 can see Teacher 2 student!'; end if;

  -- ==========================================================================
  -- TEST CASE 3: Assistant-to-Teacher 1 CANNOT see Financial Data (Payouts)
  -- ==========================================================================
  select count(*) into v_count from public.teacher_payouts;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Assistant-to-teacher can see financial payouts!'; end if;

  -- ==========================================================================
  -- TEST CASE 4: Assistant-to-Center (Default) sees operational data, NOT financials
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_asst_center_user_id::text, true);

  -- Can see all operational groups
  select count(*) into v_count from public.groups where id in (v_group1_id, v_group2_id);
  if v_count <> 2 then raise exception 'RLS Failed: Assistant-to-center cannot see operational groups'; end if;

  -- Can see all operational sessions
  select count(*) into v_count from public.sessions where id in (v_session1_id, v_session2_id);
  if v_count <> 2 then raise exception 'RLS Failed: Assistant-to-center cannot see operational sessions'; end if;

  -- CANNOT see any teacher payouts (Financial leak check)
  select count(*) into v_count from public.teacher_payouts;
  if v_count <> 0 then raise exception 'RLS Leak Detected: Assistant-to-center can see financial payouts!'; end if;

  -- ==========================================================================
  -- TEST CASE 5: Assistant-to-Center with can_view_financials = true CAN see financials
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_asst_center_fin_user_id::text, true);

  select count(*) into v_count from public.teacher_payouts where id in (v_payout1_id, v_payout2_id);
  if v_count <> 2 then raise exception 'RLS Failed: Financial assistant could not view teacher payouts!'; end if;

  -- ==========================================================================
  -- TEST CASE 6: Center Owner sees everything
  -- ==========================================================================
  perform set_config('request.jwt.claim.sub', v_owner_user_id::text, true);

  select count(*) into v_count from public.groups where id in (v_group1_id, v_group2_id);
  if v_count <> 2 then raise exception 'RLS Failed: Center owner cannot see all groups'; end if;

  select count(*) into v_count from public.teacher_payouts where id in (v_payout1_id, v_payout2_id);
  if v_count <> 2 then raise exception 'RLS Failed: Center owner cannot see all teacher payouts'; end if;

  -- ==========================================================================
  -- CLEANUP
  -- ==========================================================================
  perform set_config('role', 'postgres', true);
  delete from public.teacher_payouts where id in (v_payout1_id, v_payout2_id);
  delete from public.attendance where id in (v_attendance1_id, v_attendance2_id);
  delete from public.sessions where id in (v_session1_id, v_session2_id);
  delete from public.group_students where group_id in (v_group1_id, v_group2_id);
  delete from public.enrollments where id in (v_enrollment1_id, v_enrollment2_id);
  delete from public.groups where id in (v_group1_id, v_group2_id);
  delete from public.students where id in (v_student1_id, v_student2_id);
  delete from public.users where id in (v_owner_user_id, v_teacher1_user_id, v_teacher2_user_id, v_asst_t1_user_id, v_asst_center_user_id, v_asst_center_fin_user_id);
  delete from public.assistants where id in (v_asst_t1_id, v_asst_center_id, v_asst_center_fin_id);
  delete from public.teachers where id in (v_teacher1_id, v_teacher2_id);
  delete from auth.users where id in (v_owner_user_id, v_teacher1_user_id, v_teacher2_user_id, v_asst_t1_user_id, v_asst_center_user_id, v_asst_center_fin_user_id);
  delete from public.tenants where id = v_tenant_id;

  raise notice 'DEV-78: All Center assistant and teacher RLS scoping leak tests passed successfully!';
end $$;
