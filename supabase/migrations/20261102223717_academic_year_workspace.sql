create table public.academic_years(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
 name text not null check(length(btrim(name)) between 1 and 100),starts_on date not null,ends_on date not null,
 status text not null default 'active' check(status in ('active','closed')),closed_at timestamptz,created_at timestamptz not null default now(),
 check(ends_on>=starts_on),unique(id,tenant_id)
);
create unique index academic_year_one_active on public.academic_years(tenant_id) where status='active';
alter table public.academic_years enable row level security;
revoke all on public.academic_years from public,anon,authenticated;
grant all on public.academic_years to service_role;
grant select on public.academic_years to authenticated;
create policy academic_year_owner_read on public.academic_years for select to authenticated using(exists(select 1 from public.users u where u.id=(select auth.uid()) and u.tenant_id=academic_years.tenant_id));
alter table public.groups add column academic_year_id uuid references public.academic_years(id) on delete restrict;
alter table public.groups add column source_group_id uuid references public.groups(id) on delete set null;
alter table public.study_materials add column academic_year_id uuid references public.academic_years(id) on delete restrict;
alter table public.study_materials add column source_material_id uuid references public.study_materials(id) on delete set null;
create index groups_year_tenant on public.groups(tenant_id,academic_year_id);
create index materials_year_tenant on public.study_materials(tenant_id,academic_year_id);
create table public.academic_year_students(
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 year_id uuid not null references public.academic_years(id) on delete cascade,
 group_id uuid not null references public.groups(id) on delete cascade,
 student_id uuid not null references public.students(id) on delete cascade,
 student_name text not null,student_code text,group_name text not null,
 primary key(year_id,group_id,student_id)
);
alter table public.academic_year_students enable row level security;
revoke all on public.academic_year_students from public,anon,authenticated;
grant all on public.academic_year_students to service_role;

create function public.academic_year_operation(p_tenant uuid,p_user uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare current_year public.academic_years;next_year public.academic_years;old_group public.groups;new_group public.groups;
 g uuid;student uuid;groups_to_copy uuid[];students_to_move uuid[];group_map jsonb:='{}';years jsonb;roster jsonb;group_list jsonb;
begin
 if not exists(select 1 from public.users u join public.tenants t on t.id=u.tenant_id where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher') and t.status='active' and t.deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':academic_year',0));
 select * into current_year from public.academic_years where tenant_id=p_tenant and status='active' for update;
 if p_action='view' then
  select coalesce(jsonb_agg(to_jsonb(y) order by y.created_at desc),'[]') into years from public.academic_years y where y.tenant_id=p_tenant;
  select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name)),'[]') into group_list from public.groups g where g.tenant_id=p_tenant and g.archived_at is null and (current_year.id is null or g.academic_year_id=current_year.id);
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'name',s.name,'student_code',s.student_code,'group_ids',(select coalesce(jsonb_agg(g.id),'[]') from public.groups g where g.tenant_id=p_tenant and g.archived_at is null and (g.id=s.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=s.id and gs.group_id=g.id))))),'[]') into roster from public.students s where s.tenant_id=p_tenant and s.archived_at is null;
  return jsonb_build_object('active',to_jsonb(current_year),'years',years,'groups',group_list,'students',roster,'ongoing_sessions',(select count(*) from public.sessions where tenant_id=p_tenant and status='in_progress'));
 elsif p_action='archive' then
  if not exists(select 1 from public.academic_years where id=(p_data->>'year_id')::uuid and tenant_id=p_tenant and status='closed') then raise exception 'NOT_FOUND' using errcode='P0002';end if;
  return jsonb_build_object('year',(select to_jsonb(y) from public.academic_years y where y.id=(p_data->>'year_id')::uuid and y.tenant_id=p_tenant),'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name)),'[]') from public.groups g where g.academic_year_id=(p_data->>'year_id')::uuid and g.tenant_id=p_tenant),'students',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.academic_year_students x where x.year_id=(p_data->>'year_id')::uuid and x.tenant_id=p_tenant),'session_count',(select count(*) from public.sessions s join public.groups g on g.id=s.group_id and g.tenant_id=p_tenant where s.tenant_id=p_tenant and g.academic_year_id=(p_data->>'year_id')::uuid),'attendance_count',(select count(*) from public.attendance a join public.sessions s on s.id=a.session_id and s.tenant_id=p_tenant join public.groups g on g.id=s.group_id and g.tenant_id=p_tenant where a.tenant_id=p_tenant and g.academic_year_id=(p_data->>'year_id')::uuid));
 end if;
 if p_action not in ('start','rollover') or length(btrim(coalesce(p_data->>'name',''))) not between 1 and 100 or nullif(p_data->>'starts_on','')::date is null or nullif(p_data->>'ends_on','')::date is null or (p_data->>'ends_on')::date<(p_data->>'starts_on')::date then raise exception 'INVALID_YEAR' using errcode='22023';end if;
 if p_action='start' and current_year.id is not null then raise exception 'YEAR_ALREADY_ACTIVE' using errcode='23514';end if;
 if p_action='rollover' then
  if current_year.id is null or (p_data->>'expected_year_id')::uuid is distinct from current_year.id then raise exception 'YEAR_CHANGED' using errcode='23514';end if;
  if p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'CONFIRM_REQUIRED' using errcode='22023';end if;
  if (p_data->>'starts_on')::date<=current_year.starts_on then raise exception 'INVALID_YEAR' using errcode='22023';end if;
  if exists(select 1 from public.sessions where tenant_id=p_tenant and status='in_progress') then raise exception 'ACTIVE_SESSION' using errcode='23514';end if;
  groups_to_copy:=array(select distinct jsonb_array_elements_text(coalesce(p_data->'group_ids','[]'))::uuid);
  students_to_move:=array(select distinct jsonb_array_elements_text(coalesce(p_data->'student_ids','[]'))::uuid);
  if cardinality(groups_to_copy)>1000 or cardinality(students_to_move)>10000 or exists(select 1 from unnest(groups_to_copy) selected(id) where not exists(select 1 from public.groups g where g.id=selected.id and g.tenant_id=p_tenant and g.academic_year_id=current_year.id and g.archived_at is null)) then raise exception 'INVALID_GROUPS' using errcode='22023';end if;
  if exists(select 1 from unnest(students_to_move) selected(id) where not exists(select 1 from public.students s where s.id=selected.id and s.tenant_id=p_tenant and s.archived_at is null and (s.group_id=any(groups_to_copy) or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=s.id and gs.group_id=any(groups_to_copy))))) then raise exception 'INVALID_STUDENTS' using errcode='22023';end if;
  insert into public.academic_year_students(tenant_id,year_id,group_id,student_id,student_name,student_code,group_name)
  select p_tenant,current_year.id,g.id,s.id,s.name,s.student_code,g.name from public.groups g join public.students s on s.tenant_id=p_tenant and (s.group_id=g.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.group_id=g.id and gs.student_id=s.id)) where g.tenant_id=p_tenant and g.academic_year_id=current_year.id on conflict(year_id,group_id,student_id) do update set student_name=excluded.student_name,student_code=excluded.student_code,group_name=excluded.group_name;
  update public.academic_years set status='closed',closed_at=now(),ends_on=least(ends_on,(p_data->>'starts_on')::date-1) where id=current_year.id;
 end if;
 insert into public.academic_years(tenant_id,name,starts_on,ends_on) values(p_tenant,btrim(p_data->>'name'),(p_data->>'starts_on')::date,(p_data->>'ends_on')::date) returning * into next_year;
 if p_action='start' then
  update public.groups set academic_year_id=next_year.id where tenant_id=p_tenant and academic_year_id is null and archived_at is null;
  update public.study_materials set academic_year_id=next_year.id where tenant_id=p_tenant and academic_year_id is null and (is_homework or type in ('online_quiz','paper_quiz','paper_exam') or group_id is not null or group_ids is not null);
 else
  foreach g in array groups_to_copy loop
   select * into old_group from public.groups where id=g and tenant_id=p_tenant;
   new_group:=old_group;new_group.id:=gen_random_uuid();new_group.created_at:=now();new_group.academic_year_id:=next_year.id;new_group.source_group_id:=old_group.id;new_group.parent_group_id:=null;new_group.is_section:=false;new_group.archived_at:=null;
   insert into public.groups select (new_group).*;
   group_map:=group_map||jsonb_build_object(old_group.id::text,new_group.id);
  end loop;
  foreach g in array groups_to_copy loop
   select * into old_group from public.groups where id=g;
   if old_group.parent_group_id is not null and group_map?old_group.parent_group_id::text then update public.groups set parent_group_id=(group_map->>old_group.parent_group_id::text)::uuid,is_section=old_group.is_section where id=(group_map->>g::text)::uuid;end if;
  end loop;
  foreach student in array students_to_move loop
   for g in select gr.id from public.groups gr join public.students st on st.id=student and st.tenant_id=p_tenant where gr.id=any(groups_to_copy) and (st.group_id=gr.id or exists(select 1 from public.group_students gs where gs.student_id=student and gs.tenant_id=p_tenant and gs.group_id=gr.id)) loop
    insert into public.group_students(tenant_id,student_id,group_id) values(p_tenant,student,(group_map->>g::text)::uuid) on conflict(group_id,student_id) do nothing;
   end loop;
   update public.students st set group_id=coalesce((group_map->>st.group_id::text)::uuid,(select gs.group_id from public.group_students gs join public.groups gr on gr.id=gs.group_id and gr.academic_year_id=next_year.id where gs.tenant_id=p_tenant and gs.student_id=student order by gs.group_id limit 1)),archived_at=null where st.id=student and st.tenant_id=p_tenant;
  end loop;
  update public.groups set archived_at=coalesce(archived_at,now()) where tenant_id=p_tenant and academic_year_id=current_year.id;
  update public.students st set archived_at=coalesce(st.archived_at,now()) where st.tenant_id=p_tenant and not(st.id=any(students_to_move)) and st.group_id in(select gr.id from public.groups gr where gr.tenant_id=p_tenant and gr.academic_year_id=current_year.id) and not exists(select 1 from public.group_students gs join public.groups gr on gr.id=gs.group_id and gr.tenant_id=p_tenant where gs.student_id=st.id and gs.tenant_id=p_tenant and gr.archived_at is null);
 end if;
 insert into public.classroom_history(tenant_id,actor_user_id,action,detail) values(p_tenant,p_user,case when p_action='rollover' then 'year_closed' else 'year_started' end,jsonb_build_object('previous_year',current_year.id,'new_year',next_year.id,'group_map',group_map,'carried_students',coalesce(cardinality(students_to_move),0),'financial_records_preserved',true));
 return jsonb_build_object('year',to_jsonb(next_year),'group_map',group_map,'carried_students',coalesce(cardinality(students_to_move),0));
end;$$;
revoke all on function public.academic_year_operation(uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.academic_year_operation(uuid,uuid,text,jsonb) to service_role;

create function public.guard_group_academic_year() returns trigger
language plpgsql security invoker set search_path='' as $$
begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':academic_year',0));
 if new.academic_year_id is null and tg_op='INSERT' then select id into new.academic_year_id from public.academic_years where tenant_id=new.tenant_id and status='active';end if;
 if new.academic_year_id is not null and not exists(select 1 from public.academic_years y where y.id=new.academic_year_id and y.tenant_id=new.tenant_id and (new.archived_at is not null or y.status='active')) then raise exception 'YEAR_CLOSED' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function public.guard_group_academic_year() from public,anon,authenticated;
grant execute on function public.guard_group_academic_year() to service_role;
create trigger group_academic_year_guard before insert or update on public.groups for each row execute function public.guard_group_academic_year();

create function public.portal_group_in_current_year(p_group uuid,p_tenant uuid,p_date date default null)
returns boolean language sql stable security invoker set search_path='' as $$
 select case when p_group is null then
  not exists(select 1 from public.academic_years y where y.tenant_id=p_tenant and y.status='active') or exists(select 1 from public.academic_years y where y.tenant_id=p_tenant and y.status='active' and p_date between y.starts_on and y.ends_on)
 else exists(select 1 from public.groups g where g.id=p_group and g.tenant_id=p_tenant and g.archived_at is null and (not exists(select 1 from public.academic_years y where y.tenant_id=p_tenant and y.status='active') or g.academic_year_id=(select y.id from public.academic_years y where y.tenant_id=p_tenant and y.status='active'))) end
$$;
create function public.portal_active_group(p_student uuid,p_tenant uuid)
returns uuid language sql stable security invoker set search_path='' as $$
 select g.id from public.students st join public.groups g on g.tenant_id=p_tenant and (g.id=st.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and gs.group_id=g.id)) where st.id=p_student and st.tenant_id=p_tenant and public.portal_group_in_current_year(g.id,p_tenant) order by (g.id=st.group_id) desc,g.id limit 1
$$;
create function public.portal_material_in_current_year(m public.study_materials,p_tenant uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select m.tenant_id=p_tenant and (m.academic_year_id is null or not exists(select 1 from public.academic_years y where y.tenant_id=p_tenant and y.status='active') or m.academic_year_id=(select y.id from public.academic_years y where y.tenant_id=p_tenant and y.status='active'))
$$;
revoke all on function public.portal_group_in_current_year(uuid,uuid,date),public.portal_active_group(uuid,uuid),public.portal_material_in_current_year(public.study_materials,uuid) from public,anon,authenticated;
grant execute on function public.portal_group_in_current_year(uuid,uuid,date),public.portal_active_group(uuid,uuid),public.portal_material_in_current_year(public.study_materials,uuid) to service_role;

create function public.guard_material_academic_year() returns trigger
language plpgsql security invoker set search_path='' as $$
declare year_id uuid;groups_selected uuid[];targets_changed boolean;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':academic_year',0));
 targets_changed:=tg_op='INSERT';
 if tg_op='UPDATE' then targets_changed:=new.group_id is distinct from old.group_id or new.group_ids is distinct from old.group_ids;end if;
 if new.academic_year_id is null and (tg_op='INSERT' or targets_changed) and (new.is_homework or new.type in ('online_quiz','paper_quiz','paper_exam') or new.group_id is not null or new.group_ids is not null) then
  select id into new.academic_year_id from public.academic_years where tenant_id=new.tenant_id and status='active';
 end if;
 if new.academic_year_id is not null and not exists(select 1 from public.academic_years y where y.id=new.academic_year_id and y.tenant_id=new.tenant_id) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if targets_changed then
  groups_selected:=coalesce(new.group_ids,case when new.group_id is null then '{}'::uuid[] else array[new.group_id] end);
  if exists(select 1 from unnest(groups_selected) selected(id) join public.groups g on g.id=selected.id where g.tenant_id=new.tenant_id and (g.archived_at is not null or new.academic_year_id is not null and g.academic_year_id is distinct from new.academic_year_id)) then raise exception 'COPY_TO_NEW_YEAR' using errcode='23514';end if;
 end if;
 return new;
end;$$;
revoke all on function public.guard_material_academic_year() from public,anon,authenticated;
grant execute on function public.guard_material_academic_year() to service_role;
create trigger material_academic_year_guard before insert or update on public.study_materials for each row execute function public.guard_material_academic_year();
CREATE OR REPLACE FUNCTION public.get_parent_portal_payload(p_token text, p_student_id uuid DEFAULT NULL::uuid, p_tenant_id uuid DEFAULT NULL::uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, public.portal_active_group(s.id,s.tenant_id) AS group_id
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
    SELECT s.id, s.tenant_id, s.name, COALESCE(s.code, s.student_code, '') AS code, public.portal_active_group(s.id,s.tenant_id) AS group_id
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
    WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id AND public.portal_group_in_current_year((select sx.group_id from public.sessions sx where sx.id=a.session_id and sx.tenant_id=a.tenant_id),v_student.tenant_id,(a.created_at at time zone 'Africa/Cairo')::date)
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
  WHERE a.student_id = v_student.id AND a.tenant_id = v_student.tenant_id AND public.portal_group_in_current_year((select sx.group_id from public.sessions sx where sx.id=a.session_id and sx.tenant_id=a.tenant_id),v_student.tenant_id,(a.created_at at time zone 'Africa/Cairo')::date);

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
    WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id AND public.portal_group_in_current_year(coalesce(qs.group_id,q.group_id,(select sx.group_id from public.sessions sx where sx.id=qs.session_id and sx.tenant_id=qs.tenant_id)),v_student.tenant_id,(qs.created_at at time zone 'Africa/Cairo')::date)
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
  WHERE qs.student_id = v_student.id AND qs.tenant_id = v_student.tenant_id AND public.portal_group_in_current_year(coalesce(qs.group_id,q.group_id,(select sx.group_id from public.sessions sx where sx.id=qs.session_id and sx.tenant_id=qs.tenant_id)),v_student.tenant_id,(qs.created_at at time zone 'Africa/Cairo')::date);

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
      m.group_id, m.group_ids,
      public.material_targets_student(m,v_student.id,v_student.tenant_id) AS is_current_assignment,
      case when m.is_homework then public.homework_target_allowed(v_student.id,v_student.tenant_id,m.id) else false end AS can_submit,
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
      AND public.portal_material_in_current_year(m,v_student.tenant_id) AND (public.material_targets_student(m,v_student.id,v_student.tenant_id) OR EXISTS(select 1 from public.homework_submissions prior where prior.material_id=m.id and prior.student_id=v_student.id and prior.tenant_id=v_student.tenant_id))
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
        WHERE hs2.student_id = v_student.id AND hs2.tenant_id=v_student.tenant_id AND hs2.status = 'approved' AND EXISTS(select 1 from public.study_materials hm where hm.id=hs2.material_id and hm.tenant_id=v_student.tenant_id and public.material_targets_student(hm,v_student.id,v_student.tenant_id) and public.portal_material_in_current_year(hm,v_student.tenant_id))
      ), COALESCE(v_attendance_stats.hw_done_count, 0)),
      'homework_total_count', COALESCE((
        SELECT COUNT(*)::int FROM study_materials sm2
        WHERE sm2.tenant_id = v_student.tenant_id AND sm2.is_homework = true
          AND public.material_targets_student(sm2,v_student.id,v_student.tenant_id) AND public.portal_material_in_current_year(sm2,v_student.tenant_id)
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
$function$;


CREATE OR REPLACE FUNCTION public.portal_student_context(p_student_id uuid, p_tenant_id uuid, p_token text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
select jsonb_build_object('id',s.id,'tenant_id',s.tenant_id,'group_ids',
  (select coalesce(jsonb_agg(g.id),'[]'::jsonb) from public.groups g where g.tenant_id=s.tenant_id and public.portal_group_in_current_year(g.id,s.tenant_id) and
    (g.id=s.group_id or exists(select 1 from public.group_students gs
      where gs.tenant_id=s.tenant_id and gs.student_id=s.id and gs.group_id=g.id))))
  || public.portal_tenant_context(s.tenant_id)
from public.students s where
  (p_student_id is not null and p_tenant_id is not null and s.id=p_student_id and s.tenant_id=p_tenant_id)
  or (p_student_id is null and p_tenant_id is null and p_token is not null and p_token<>'' and s.parent_portal_token=p_token)
limit 1;
$function$;


CREATE OR REPLACE FUNCTION public.get_portal_monthly_group_rank(p_student_id uuid, p_tenant_id uuid)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with owner as (
  select s.id, coalesce(
    (select g.id from public.groups g where g.id=s.group_id and g.tenant_id=p_tenant_id and public.portal_group_in_current_year(g.id,p_tenant_id)),
    (select g.id from public.group_students gs join public.groups g on g.id=gs.group_id and g.tenant_id=gs.tenant_id
      where gs.student_id=s.id and gs.tenant_id=p_tenant_id and public.portal_group_in_current_year(g.id,p_tenant_id) order by g.id limit 1)
  ) as group_id
  from public.students s where s.id=p_student_id and s.tenant_id=p_tenant_id and s.archived_at is null
), period as (
  select date_trunc('month', now() at time zone 'Africa/Cairo')::date as first_day
), peers as (
  select s.id from public.students s cross join owner o
  where s.tenant_id=p_tenant_id and s.archived_at is null and o.group_id is not null and
    (s.group_id=o.group_id or exists(select 1 from public.group_students gs
      where gs.tenant_id=p_tenant_id and gs.student_id=s.id and gs.group_id=o.group_id))
), month_sessions as (
  select s.id from public.sessions s cross join owner o cross join period p
  where s.tenant_id=p_tenant_id and s.group_id=o.group_id
    and s.session_date>=p.first_day and s.session_date<(p.first_day+interval '1 month')
), marks as (
  select a.student_id, a.session_id, a.quiz_score as score, a.quiz_max_score as maximum
  from public.attendance a join month_sessions ms on ms.id=a.session_id join peers p on p.id=a.student_id
  where a.tenant_id=p_tenant_id and a.quiz_score is not null and a.quiz_max_score>0
  union all
  select q.student_id, q.session_id, q.score, q.max_score from public.quiz_scores q
  join peers p on p.id=q.student_id cross join owner o cross join period period
  where q.tenant_id=p_tenant_id and q.group_id=o.group_id and q.max_score>0 and q.score is not null
    and q.created_at >= (period.first_day::timestamp at time zone 'Africa/Cairo')
    and q.created_at < ((period.first_day+interval '1 month') at time zone 'Africa/Cairo')
    and not exists(select 1 from public.attendance a join month_sessions ms on ms.id=a.session_id
      where a.tenant_id=p_tenant_id and a.student_id=q.student_id and a.session_id=q.session_id
      and a.quiz_score is not null and a.quiz_max_score>0)
), attendance_stats as (
  select a.student_id, count(*) as sessions, round(100.0*count(*) filter(where a.attended)/count(*)) as attendance
  from public.attendance a join month_sessions ms on ms.id=a.session_id join peers p on p.id=a.student_id
  where a.tenant_id=p_tenant_id group by a.student_id
), grade_stats as (
  select student_id, count(*) as quizzes, round(avg(greatest(0,least(100,100.0*score/maximum))),1) as average
  from marks where score::text not in ('NaN','Infinity','-Infinity') and maximum::text not in ('NaN','Infinity','-Infinity')
  group by student_id
), stats as (
  select p.id, coalesce(a.sessions,0) as sessions, coalesce(a.attendance,0) as attendance,
    coalesce(g.quizzes,0) as quizzes, coalesce(g.average,0) as average,
    round((coalesce(g.average,0)*0.7+coalesce(a.attendance,0)*0.3)/
      nullif((case when g.quizzes>0 then 0.7 else 0 end)+(case when a.sessions>0 then 0.3 else 0 end),0),1) as overall
  from peers p left join attendance_stats a on a.student_id=p.id left join grade_stats g on g.student_id=p.id
), ranked as (
  select *, rank() over(order by (quizzes>0) desc, overall desc nulls last, average desc, attendance desc) as position,
    count(*) over() as size from stats
)
select jsonb_build_object('student_rank',case when sessions>0 or quizzes>0 then position else null end,
  'group_size',size,'rank_period',(select to_char(first_day,'YYYY-MM') from period))
from ranked where id=p_student_id;
$function$;


CREATE OR REPLACE FUNCTION public.portal_legacy_quiz_payload(p_student_id uuid, p_tenant_id uuid, p_student_code text)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO ''
AS $function$
with owner as (
  select id,tenant_id,group_id from public.students where id=p_student_id and tenant_id=p_tenant_id
), allowed_groups as (
  select g.id::text as id from public.groups g cross join owner o where g.tenant_id=o.tenant_id and public.portal_group_in_current_year(g.id,o.tenant_id)
    and (g.id=o.group_id or exists(select 1 from public.group_students gs
      where gs.tenant_id=o.tenant_id and gs.student_id=o.id and gs.group_id=g.id))
), recent_definitions as materialized (
  select message_body,phone,status,created_at from public.whatsapp_inbox where tenant_id is null
    and phone like 'QUIZ_DEF_%' order by created_at desc limit 1000
), parsed_definitions as materialized (
  select *,public.portal_parse_legacy_json(message_body) as quiz from recent_definitions
), definitions as materialized (
  select * from parsed_definitions where quiz->>'group_id' in(select id from allowed_groups)
    and coalesce(quiz->'is_draft','null'::jsonb) in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb)
    and coalesce(quiz->'is_archived','null'::jsonb) in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb)
    and lower(coalesce(quiz->>'exam_mode','online'))<>'paper' and jsonb_typeof(quiz->'questions')='array'
    and status is distinct from 'draft' and upper(phone) not like '%DRAFT%'
), recent_submissions as materialized (
  select message_body,status,created_at from public.whatsapp_inbox where tenant_id is null
    and phone like 'QUIZ_SUB_%' order by created_at desc limit 2000
), parsed_submissions as materialized (
  select *,public.portal_parse_legacy_json(message_body) as submission from recent_submissions
), own_submissions as (
  select * from parsed_submissions where nullif(btrim(p_student_code),'') is not null
    and btrim(submission->>'student_code')=btrim(p_student_code)
    and coalesce(nullif(submission->>'material_id',''),submission->>'quiz_id') in(select quiz->>'id' from definitions)
    and (coalesce(submission->>'group_id','')='' or submission->>'group_id' in(select id from allowed_groups))
), mapped_submissions as (
  select jsonb_build_object('material_id',h.material_id,'status',h.status,'file_url',h.file_url,
    'teacher_notes',h.teacher_notes,'submitted_at',h.submitted_at) as item,0 as source,h.submitted_at as sort_at
  from public.homework_submissions h where h.student_id=p_student_id and h.tenant_id=p_tenant_id
    and h.material_id::text in(select quiz->>'id' from definitions)
  union all
  select jsonb_build_object('material_id',coalesce(nullif(submission->>'material_id',''),submission->>'quiz_id'),
    'quiz_id',coalesce(nullif(submission->>'material_id',''),submission->>'quiz_id'),
    'status',coalesce(nullif(submission->>'status',''),nullif(status,''),'pending'),
    'file_url',coalesce(nullif(submission->>'file_url',''),submission->>'submission_url'),
    'teacher_notes',submission::text,
    'submitted_at',coalesce(submission->>'submitted_at',submission->>'created_at',created_at::text)),1,created_at
  from own_submissions
)
select jsonb_build_object('definitions',coalesce((select jsonb_agg(jsonb_build_object('message_body',message_body,
  'phone',phone,'status',status,'created_at',created_at) order by created_at desc) from definitions),'[]'::jsonb),
  'submissions',coalesce((select jsonb_agg(item order by source,sort_at desc) from mapped_submissions),'[]'::jsonb));
$function$;


CREATE OR REPLACE FUNCTION public.submit_verified_homework(p_student uuid, p_tenant uuid, p_material uuid, p_file_url text, p_file_name text, p_file_size bigint DEFAULT NULL::bigint)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare m public.study_materials;result public.homework_submissions;
begin
 perform 1 from public.students where id=p_student and tenant_id=p_tenant and archived_at is null for share;
 if not found then raise exception 'HOMEWORK_TARGET_FORBIDDEN' using errcode='42501';end if;
 select * into m from public.study_materials where id=p_material and tenant_id=p_tenant for share;
 if m.id is null or not m.is_homework or not public.homework_target_allowed(p_student,p_tenant,p_material) then raise exception 'HOMEWORK_TARGET_FORBIDDEN' using errcode='42501';end if;
 if p_file_url not like p_tenant::text||'/'||p_material::text||'/'||p_student::text||'_%' or p_file_url like '%..%' then raise exception 'INVALID_FILE' using errcode='22023';end if;
 insert into public.homework_submissions(tenant_id,material_id,student_id,file_url,file_name,file_size,status,submitted_at)
 values(p_tenant,p_material,p_student,p_file_url,p_file_name,p_file_size,'pending',now())
 on conflict(material_id,student_id) do update set file_url=excluded.file_url,file_name=excluded.file_name,file_size=excluded.file_size,status='pending',submitted_at=now(),teacher_notes=null,reviewed_at=null returning * into result;
 return to_jsonb(result);
end;$function$;


CREATE OR REPLACE FUNCTION public.submit_homework_portal(p_portal_token text, p_material_id uuid, p_file_url text, p_file_name text, p_student_id uuid DEFAULT NULL)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'pg_catalog', 'public', 'pg_temp'
AS $function$
DECLARE
  v_student public.students%ROWTYPE;
  v_submission public.homework_submissions%ROWTYPE;
BEGIN
  IF p_student_id IS NULL THEN
    SELECT * INTO v_student FROM public.students
    WHERE parent_portal_token = p_portal_token LIMIT 1;
  ELSE
    SELECT * INTO v_student FROM public.students
    WHERE id = p_student_id AND parent_portal_token = p_portal_token LIMIT 1;
  END IF;

  IF v_student.id IS NULL THEN
    RAISE EXCEPTION 'Student portal token not found or invalid' USING ERRCODE = '42501';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM public.study_materials m
    WHERE m.id = p_material_id AND m.tenant_id = v_student.tenant_id AND m.is_homework = true AND public.homework_target_allowed(v_student.id,v_student.tenant_id,p_material_id)
  ) THEN
    RAISE EXCEPTION 'Homework material not found or not assigned to teacher' USING ERRCODE = '42501';
  END IF;

  INSERT INTO public.homework_submissions (
    tenant_id, material_id, student_id, file_url, file_name, status, submitted_at
  ) VALUES (
    v_student.tenant_id, p_material_id, v_student.id, p_file_url, p_file_name, 'pending', now()
  )
  ON CONFLICT (material_id, student_id) DO UPDATE SET
    file_url = EXCLUDED.file_url,
    file_name = coalesce(EXCLUDED.file_name, public.homework_submissions.file_name),
    status = 'pending', submitted_at = now()
  RETURNING * INTO v_submission;
  RETURN to_jsonb(v_submission);
END;
$function$;


create or replace view public.assistant_delegated_groups with (security_invoker=true,security_barrier=true) as select source.* from public.groups source where public.assistant_delegated_row('groups',to_jsonb(source)) with local check option;
create or replace view public.assistant_delegated_study_materials with (security_invoker=true,security_barrier=true) as select source.* from public.study_materials source where public.assistant_delegated_row('study_materials',to_jsonb(source)) with local check option;
notify pgrst,'reload schema';

create or replace function public.homework_target_allowed(p_student uuid,p_tenant uuid,p_material uuid)
returns boolean language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.study_materials m join public.students st on st.id=p_student and st.tenant_id=p_tenant where m.id=p_material and m.tenant_id=p_tenant and m.is_homework and st.archived_at is null and public.portal_material_in_current_year(m,p_tenant) and public.material_targets_student(m,p_student,p_tenant) and ((m.group_ids is null and m.group_id is null) or exists(select 1 from public.groups g where g.tenant_id=p_tenant and public.portal_group_in_current_year(g.id,p_tenant) and (g.id=st.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and gs.group_id=g.id)) and (case when m.group_ids is not null then g.id=any(m.group_ids) else m.group_id=g.id end))))
$$;
notify pgrst,'reload schema';
notify pgrst,'reload schema';
