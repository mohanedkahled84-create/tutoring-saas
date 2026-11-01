alter table public.assistant_access_audit
 add column actor_name text,
 add column target_name text,
 add column changes jsonb not null default '{}'::jsonb;
create index assistant_access_audit_member_time_idx
 on public.assistant_access_audit(tenant_id,assistant_id,created_at desc,id desc);

-- Capture the real OLD/NEW row inside the write transaction. Only the dedicated
-- workspace RPC sets this transaction-local session context; ordinary teacher
-- writes do not acquire a fictitious assistant actor.
create function public.capture_assistant_change() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 v_hash text:=current_setting('app.centerly_assistant_session',true);
 v_origin text:=current_setting('app.centerly_assistant_origin',true);
 v_tenant uuid;v_assistant uuid;v_actor text;v_label text;v_resource text;
 v_old jsonb;v_new jsonb:=to_jsonb(new);v_before jsonb:='{}';v_after jsonb:='{}';
 v_keys text[];v_key text;v_action text;
begin
 if current_user<>'service_role' or v_hash is null or v_hash='' then return new; end if;
 v_tenant:=(v_new->>'tenant_id')::uuid;
 select a.assistant_id,s.name into v_assistant,v_actor
 from public.assistant_sessions ss join public.assistant_accounts a on a.assistant_id=ss.assistant_id
 join public.assistants s on s.id=a.assistant_id and s.tenant_id=a.tenant_id
 where ss.token_hash=v_hash and ss.origin=v_origin and ss.expires_at>now()
 and ss.credential_version=a.credential_version and a.tenant_id=v_tenant and s.status='active';
 if not found then raise exception 'UNAUTHORIZED'; end if;
 case tg_table_name
  when 'groups' then v_resource:='groups';v_keys:=array['name','subject'];
  when 'students' then v_resource:='students';v_keys:=array['name','parent_phone','student_phone','notes','group_id'];
  when 'attendance' then v_resource:='attendance';v_keys:=array['attended','homework_status','comment'];
  when 'study_materials' then v_resource:='materials';v_keys:=array['title','description','type','url','is_homework','due_date'];
  when 'homework_submissions' then v_resource:='homework';v_keys:=array['status','teacher_notes'];
  when 'quizzes' then v_resource:='quizzes';v_keys:=array['title','quiz_number','max_score','quiz_date'];
  else return new;
 end case;
 if tg_op='UPDATE' then v_old:=to_jsonb(old); else v_old:='{}'::jsonb; end if;
 foreach v_key in array v_keys loop
  if tg_op='INSERT' or v_old->v_key is distinct from v_new->v_key then
   v_before:=v_before||jsonb_build_object(v_key,v_old->v_key);
   v_after:=v_after||jsonb_build_object(v_key,v_new->v_key);
  end if;
 end loop;
 if v_after='{}'::jsonb then return new; end if;
 v_label:=coalesce(v_new->>'name',v_new->>'title');
 if v_label is null and v_resource in ('attendance','homework') then
  select st.name into v_label from public.students st where st.id=(v_new->>'student_id')::uuid and st.tenant_id=v_tenant;
 end if;
 v_action:=case when tg_op='INSERT' and v_resource<>'attendance' then 'create' else 'edit' end;
 insert into public.assistant_access_audit(tenant_id,assistant_id,actor_name,action,target_id,target_name,changes)
 values(v_tenant,v_assistant,v_actor,v_resource||'.'||v_action,(v_new->>'id')::uuid,v_label,jsonb_build_object('before',v_before,'after',v_after));
 return new;
end; $$;
revoke execute on function public.capture_assistant_change() from public,anon,authenticated;
grant execute on function public.capture_assistant_change() to service_role;

create trigger assistant_groups_change after insert or update on public.groups for each row execute function public.capture_assistant_change();
create trigger assistant_students_change after insert or update on public.students for each row execute function public.capture_assistant_change();
create trigger assistant_attendance_change after insert or update on public.attendance for each row execute function public.capture_assistant_change();
create trigger assistant_materials_change after insert or update on public.study_materials for each row execute function public.capture_assistant_change();
create trigger assistant_homework_change after insert or update on public.homework_submissions for each row execute function public.capture_assistant_change();
create trigger assistant_quizzes_change after insert or update on public.quizzes for each row execute function public.capture_assistant_change();

create or replace function public.assistant_workspace(p_token_hash text,p_origin text,p_resource text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.assistant_accounts; s public.assistants; ids uuid[]; result jsonb; v_id uuid; v_group uuid; v_student uuid; v_session uuid; v_count integer;
begin
 select ac.* into a from public.assistant_accounts ac join public.assistant_sessions ss on ss.assistant_id=ac.assistant_id
 where ss.token_hash=p_token_hash and ss.origin=p_origin and ss.expires_at>now() and ss.credential_version=ac.credential_version for share of ac;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 if not exists(select 1 from public.tenants t where t.id=a.tenant_id and t.status='active' and t.deleted_at is null) then raise exception 'UNAUTHORIZED'; end if;
 select * into s from public.assistants where id=a.assistant_id and tenant_id=a.tenant_id and status='active' for share;
 if not found then raise exception 'UNAUTHORIZED'; end if;
 select coalesce(array_agg(g.id),'{}') into ids from public.groups g where g.tenant_id=a.tenant_id
  and (a.all_groups or g.id=any(a.group_ids)) and (s.teacher_id is null or g.teacher_id is null or g.teacher_id=s.teacher_id);
 if p_resource='identity' then
  return jsonb_build_object('id',s.id,'name',s.name,'phone',a.phone,'tenant_id',a.tenant_id,'permissions',a.permissions,
   'groups',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.name)),'[]') from public.groups g where g.id=any(ids)),
   'teacher_name',(select t.name from public.tenants t where t.id=a.tenant_id),
   'sessions',case when coalesce(a.permissions->>'attendance.view','false')='true' then (select coalesce(jsonb_agg(to_jsonb(x)),'[]') from (select se.id,se.group_id,se.session_date from public.sessions se where se.tenant_id=a.tenant_id and se.group_id=any(ids) order by se.session_date desc limit 100) x) else '[]'::jsonb end);
 end if;
 if p_resource='logout' then delete from public.assistant_sessions where token_hash=p_token_hash; return '{}'::jsonb; end if;
 if p_resource='homework_file' then
  if coalesce(a.permissions->>'homework.view','false')<>'true' then raise exception 'FORBIDDEN'; end if;
  select jsonb_build_object('file_url',h.file_url,'tenant_id',a.tenant_id,'material_id',h.material_id,'student_id',h.student_id) into result
   from public.homework_submissions h join public.study_materials m on m.id=h.material_id and m.tenant_id=a.tenant_id
   where h.id=(p_data->>'id')::uuid and h.tenant_id=a.tenant_id and not coalesce(h.file_purged,false) and m.group_id=any(ids);
  if result is null then raise exception 'FORBIDDEN'; end if;
  return result;
 end if;
 if coalesce(a.permissions->>(p_resource||'.view'),'false')<>'true'
  or coalesce(a.permissions->>(p_resource||'.'||p_action),'false')<>'true' then raise exception 'FORBIDDEN'; end if;
 if p_action='view' then
  case p_resource
   when 'groups' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select id,name,subject,day_of_week,session_time from public.groups where tenant_id=a.tenant_id and id=any(ids) order by name limit 500) x;
   when 'students' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select st.id,st.name,st.student_code,st.parent_phone,st.student_phone,st.group_id,st.notes from public.students st where st.tenant_id=a.tenant_id and (st.group_id=any(ids) or exists(select 1 from public.group_students gs where gs.tenant_id=a.tenant_id and gs.student_id=st.id and gs.group_id=any(ids))) order by st.name limit 500) x;
   when 'sessions' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select id,group_id,session_date,session_number,status,start_time,end_time from public.sessions where tenant_id=a.tenant_id and group_id=any(ids) order by session_date desc limit 500) x;
   when 'attendance' then
    select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
     select at.id,st.id as student_id,st.name as student_name,se.id as session_id,se.session_date,se.group_id,at.attended,coalesce(at.homework_status,'missing') as homework_status,at.comment
     from public.sessions se join public.students st on st.tenant_id=a.tenant_id and (st.group_id=se.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=a.tenant_id and gs.group_id=se.group_id and gs.student_id=st.id))
     left join public.attendance at on at.student_id=st.id and at.session_id=se.id and at.tenant_id=a.tenant_id
     where se.tenant_id=a.tenant_id and se.group_id=any(ids) and se.id=(p_data->>'session_id')::uuid order by st.name limit 500) x;
   when 'materials' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select id,group_id,title,description,type,url,is_homework,due_date from public.study_materials where tenant_id=a.tenant_id and group_id=any(ids) order by created_at desc limit 500) x;
   when 'homework' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select h.id,h.student_id,st.name as student_name,m.title,m.group_id,h.status,h.teacher_notes,h.submitted_at,h.reviewed_at from public.homework_submissions h join public.study_materials m on m.id=h.material_id and m.tenant_id=a.tenant_id join public.students st on st.id=h.student_id and st.tenant_id=a.tenant_id where h.tenant_id=a.tenant_id and m.group_id=any(ids) order by h.submitted_at desc limit 500) x;
   when 'quizzes' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select id,group_id,title,quiz_number,max_score,quiz_date,is_skipped from public.quizzes where tenant_id=a.tenant_id and group_id=any(ids) order by quiz_date desc limit 500) x;
   when 'reports' then select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (select st.id,st.name,st.group_id,count(at.id) as recorded_sessions,count(at.id) filter(where at.attended) as attended_sessions from public.students st left join public.attendance at on at.student_id=st.id and at.tenant_id=a.tenant_id and exists(select 1 from public.sessions se where se.id=at.session_id and se.tenant_id=a.tenant_id and se.group_id=any(ids)) where st.tenant_id=a.tenant_id and st.group_id=any(ids) group by st.id,st.name,st.group_id order by st.name limit 500) x;
   else raise exception 'FORBIDDEN';
  end case;
  return jsonb_build_object('rows',result,'limit',500);
 end if;
 perform set_config('app.centerly_assistant_session',p_token_hash,true);
 perform set_config('app.centerly_assistant_origin',p_origin,true);
 v_id:=nullif(p_data->>'id','')::uuid;
 v_group:=nullif(p_data->>'group_id','')::uuid;
 if v_group is not null and not v_group=any(ids) then raise exception 'FORBIDDEN'; end if;
 case p_resource
  when 'groups' then
   if p_action='create' and a.all_groups then
    insert into public.groups(tenant_id,teacher_id,name,subject) values(a.tenant_id,s.teacher_id,p_data->>'name',p_data->>'subject') returning id into v_id;
   elsif p_action='edit' then
    update public.groups set name=p_data->>'name',subject=p_data->>'subject' where id=v_id and tenant_id=a.tenant_id and id=any(ids) returning id into v_id;
    if not found then raise exception 'FORBIDDEN'; end if;
   else raise exception 'FORBIDDEN'; end if;
  when 'students' then
   if p_action='create' and v_group is not null then
    insert into public.students(tenant_id,name,parent_phone,student_phone,group_id,notes,portal_password) values(a.tenant_id,p_data->>'name',p_data->>'parent_phone',p_data->>'student_phone',v_group,p_data->>'notes',substr(replace(gen_random_uuid()::text,'-',''),1,12)) returning id into v_id;
    insert into public.group_students(tenant_id,student_id,group_id) values(a.tenant_id,v_id,v_group);
   elsif p_action='edit' then
    -- Edit identity/contact only; moving membership is a separate owner operation.
    update public.students st set name=p_data->>'name',parent_phone=p_data->>'parent_phone',student_phone=p_data->>'student_phone',notes=p_data->>'notes'
     where st.id=v_id and st.tenant_id=a.tenant_id and (st.group_id=any(ids) or exists(select 1 from public.group_students gs where gs.student_id=st.id and gs.tenant_id=a.tenant_id and gs.group_id=any(ids))) returning id into v_id;
    if not found then raise exception 'FORBIDDEN'; end if;
   else raise exception 'FORBIDDEN'; end if;
  when 'attendance' then
   if p_action<>'edit' then raise exception 'FORBIDDEN'; end if;
   v_session:=(p_data->>'session_id')::uuid;v_student:=(p_data->>'student_id')::uuid;
   select group_id into v_group from public.sessions where id=v_session and tenant_id=a.tenant_id and group_id=any(ids) and status is distinct from 'cancelled' for update;
   if not found then raise exception 'FORBIDDEN'; end if;
   perform 1 from public.students st where st.id=v_student and st.tenant_id=a.tenant_id and (st.group_id=v_group or exists(select 1 from public.group_students gs where gs.tenant_id=a.tenant_id and gs.student_id=st.id and gs.group_id=v_group));
   if not found then raise exception 'FORBIDDEN'; end if;
   insert into public.attendance(tenant_id,session_id,student_id,attended,homework_status,comment,idempotency_key)
   values(a.tenant_id,v_session,v_student,(p_data->>'attended')::boolean,p_data->>'homework_status',p_data->>'comment',a.tenant_id::text||':'||v_student::text||':'||v_session::text)
   on conflict(idempotency_key) do update set attended=excluded.attended,homework_status=excluded.homework_status,comment=excluded.comment returning id into v_id;
  when 'homework' then
   if p_action<>'edit' then raise exception 'FORBIDDEN'; end if;
   update public.homework_submissions h set status=p_data->>'status',teacher_notes=p_data->>'teacher_notes',reviewed_at=now()
    where h.id=v_id and h.tenant_id=a.tenant_id and exists(select 1 from public.study_materials m where m.id=h.material_id and m.tenant_id=a.tenant_id and m.group_id=any(ids)) returning id into v_id;
   if not found then raise exception 'FORBIDDEN'; end if;
  when 'materials' then
   if p_action='create' and v_group is not null then
    insert into public.study_materials(tenant_id,teacher_id,group_id,title,description,type,url,is_homework,due_date)
     values(a.tenant_id,s.teacher_id,v_group,p_data->>'title',p_data->>'description',p_data->>'type',p_data->>'url',(p_data->>'is_homework')::boolean,nullif(p_data->>'due_date','')::date) returning id into v_id;
   elsif p_action='edit' then
    update public.study_materials set title=p_data->>'title',description=p_data->>'description',type=p_data->>'type',url=p_data->>'url',is_homework=(p_data->>'is_homework')::boolean,due_date=nullif(p_data->>'due_date','')::date
     where id=v_id and tenant_id=a.tenant_id and group_id=any(ids) returning id into v_id;
    if not found then raise exception 'FORBIDDEN'; end if;
   else raise exception 'FORBIDDEN'; end if;
  when 'quizzes' then
   if p_action='create' and v_group is not null then
    insert into public.quizzes(tenant_id,group_id,title,quiz_number,max_score,quiz_date) values(a.tenant_id,v_group,p_data->>'title',(p_data->>'quiz_number')::integer,(p_data->>'max_score')::numeric,(p_data->>'quiz_date')::date) returning id into v_id;
   elsif p_action='edit' then
    update public.quizzes set title=p_data->>'title',quiz_date=(p_data->>'quiz_date')::date where id=v_id and tenant_id=a.tenant_id and group_id=any(ids) returning id into v_id;
    if not found then raise exception 'FORBIDDEN'; end if;
   else raise exception 'FORBIDDEN'; end if;
  else raise exception 'FORBIDDEN';
 end case;
 return jsonb_build_object('id',v_id);
end; $$;
