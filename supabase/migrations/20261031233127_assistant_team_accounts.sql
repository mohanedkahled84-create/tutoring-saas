-- Dedicated teacher-scoped credentials. No fake emails, global phone identity or staff JWTs.
create table public.assistant_accounts (
 assistant_id uuid primary key references public.assistants(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 phone text not null check (phone ~ '^[1-9][0-9]{7,14}$'),
 password_hash text,
 credential_version integer not null default 1,
 permissions jsonb not null default '{}'::jsonb check (jsonb_typeof(permissions)='object'),
 all_groups boolean not null default false,
 group_ids uuid[] not null default '{}',
 created_at timestamptz not null default now(),
 unique(tenant_id,phone)
);
create table public.assistant_invitations (
 id uuid primary key default gen_random_uuid(),
 assistant_id uuid not null references public.assistant_accounts(assistant_id) on delete cascade,
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 phone text not null,
 nonce_hash text not null unique,
 claim_hash text unique,
 claim_expires_at timestamptz,
 verified_at timestamptz,
 expires_at timestamptz not null default now()+interval '7 days',
 accepted_at timestamptz,
 revoked_at timestamptz,
 delivery_status text not null default 'pending' check (delivery_status in ('pending','sent','failed','blocked')),
 created_at timestamptz not null default now()
);
create index assistant_invitations_account_idx on public.assistant_invitations(assistant_id,created_at desc);
create table public.assistant_sessions (
 token_hash text primary key,
 assistant_id uuid not null references public.assistant_accounts(assistant_id) on delete cascade,
 origin text not null,
 credential_version integer not null,
 expires_at timestamptz not null default now()+interval '12 hours',
 created_at timestamptz not null default now()
);
create index assistant_sessions_account_idx on public.assistant_sessions(assistant_id);
create table public.assistant_access_audit (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 assistant_id uuid references public.assistants(id) on delete set null,
 action text not null,
 target_id uuid,
 created_at timestamptz not null default now()
);
create index assistant_access_audit_tenant_idx on public.assistant_access_audit(tenant_id,created_at desc);
alter table public.assistant_accounts enable row level security;
alter table public.assistant_invitations enable row level security;
alter table public.assistant_sessions enable row level security;
alter table public.assistant_access_audit enable row level security;
revoke all on public.assistant_accounts,public.assistant_invitations,public.assistant_sessions,public.assistant_access_audit from anon,authenticated;
grant all on public.assistant_accounts,public.assistant_invitations,public.assistant_sessions,public.assistant_access_audit to service_role;

create function public.assistant_invite(p_tenant uuid,p_assistant uuid,p_teacher uuid,p_phone text,p_nonce_hash text,p_permissions jsonb,p_all_groups boolean,p_group_ids uuid[],p_pay jsonb)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_id uuid; v_invite uuid; v_row public.assistants; v_account public.assistant_accounts;
begin
 if p_phone !~ '^[1-9][0-9]{7,14}$' or jsonb_typeof(p_permissions)<>'object' then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from unnest(p_group_ids) x where not exists(select 1 from public.groups g where g.id=x and g.tenant_id=p_tenant)) then raise exception 'FORBIDDEN'; end if;
 if p_teacher is not null and not exists(select 1 from public.teachers t where t.id=p_teacher and t.tenant_id=p_tenant) then raise exception 'FORBIDDEN'; end if;
 if p_assistant is null then
  insert into public.assistants(tenant_id,teacher_id,name,phone,assistant_type,status,salary_model,salary,work_weekdays,pay_start_date)
  values(p_tenant,p_teacher,'بانتظار قبول الدعوة',p_phone,'assistant_to_teacher','invited',p_pay->>'salary_model',(p_pay->>'salary')::numeric,
   array(select jsonb_array_elements_text(p_pay->'work_weekdays')::integer),(p_pay->>'pay_start_date')::date) returning id into v_id;
 else
  perform 1 from public.assistant_accounts where assistant_id=p_assistant and tenant_id=p_tenant for update;
  select * into v_row from public.assistants where id=p_assistant and tenant_id=p_tenant for update;
  if not found then raise exception 'NOT_FOUND'; end if;
  v_id:=v_row.id;
  -- Reinviting is explicit credential recovery; outstanding links are revoked below.
 end if;
 insert into public.assistant_accounts(assistant_id,tenant_id,phone,permissions,all_groups,group_ids)
 values(v_id,p_tenant,p_phone,p_permissions,p_all_groups,p_group_ids)
 on conflict(assistant_id) do update set phone=excluded.phone,permissions=excluded.permissions,all_groups=excluded.all_groups,group_ids=excluded.group_ids,
 password_hash=case when assistant_accounts.phone=excluded.phone then assistant_accounts.password_hash else null end,
 credential_version=assistant_accounts.credential_version+case when assistant_accounts.phone=excluded.phone then 0 else 1 end;
 update public.assistant_invitations set revoked_at=now() where assistant_id=v_id and accepted_at is null and revoked_at is null;
 insert into public.assistant_invitations(assistant_id,tenant_id,phone,nonce_hash) values(v_id,p_tenant,p_phone,p_nonce_hash) returning id into v_invite;
 insert into public.assistant_access_audit(tenant_id,assistant_id,action) values(p_tenant,v_id,'invitation_created');
 return jsonb_build_object('assistant_id',v_id,'invitation_id',v_invite);
end; $$;

create function public.assistant_confirm_invitation(p_nonce_hash text,p_phone text,p_claim_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.assistant_invitations; v_name text;
begin
 select * into v from public.assistant_invitations where nonce_hash=p_nonce_hash and phone=p_phone
  and expires_at>now() and accepted_at is null and revoked_at is null for update;
 if not found then return null; end if;
 if not exists(select 1 from public.assistant_accounts where assistant_id=v.assistant_id and phone=p_phone) then return null; end if;
 update public.assistant_invitations set claim_hash=p_claim_hash,verified_at=now(),claim_expires_at=now()+interval '15 minutes' where id=v.id;
 select coalesce(t.name,'المعلم') into v_name from public.tenants t where t.id=v.tenant_id;
 return jsonb_build_object('tenant_id',v.tenant_id,'teacher_name',v_name);
end; $$;

create function public.assistant_configure(p_tenant uuid,p_assistant uuid,p_permissions jsonb,p_all_groups boolean,p_group_ids uuid[],p_status text,p_pay jsonb) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.assistant_accounts where assistant_id=p_assistant and tenant_id=p_tenant for update;
 if not found then return false; end if;
 perform 1 from public.assistants where id=p_assistant and tenant_id=p_tenant for update;
 if not found then return false; end if;
 if p_status not in ('active','inactive','invited') or jsonb_typeof(p_permissions)<>'object' then raise exception 'INVALID_INPUT'; end if;
 if exists(select 1 from unnest(p_group_ids) x where not exists(select 1 from public.groups g where g.id=x and g.tenant_id=p_tenant)) then raise exception 'FORBIDDEN'; end if;
 update public.assistant_accounts set permissions=p_permissions,all_groups=p_all_groups,group_ids=p_group_ids where assistant_id=p_assistant;
 update public.assistants set status=p_status,salary_model=p_pay->>'salary_model',salary=(p_pay->>'salary')::numeric,
 work_weekdays=array(select jsonb_array_elements_text(p_pay->'work_weekdays')::integer),pay_start_date=(p_pay->>'pay_start_date')::date where id=p_assistant;
 if p_status<>'active' then
  delete from public.assistant_sessions where assistant_id=p_assistant;
  update public.assistant_invitations set revoked_at=now() where assistant_id=p_assistant and accepted_at is null and revoked_at is null;
 end if;
 insert into public.assistant_access_audit(tenant_id,assistant_id,action) values(p_tenant,p_assistant,'access_configured');
 return true;
end; $$;

create function public.assistant_accept_invitation(p_claim_hash text,p_name text,p_password_hash text) returns uuid
language plpgsql security invoker set search_path='' as $$
declare v public.assistant_invitations;
begin
 -- All account/session changes use account -> assistant -> invitation lock order.
 select * into v from public.assistant_invitations where claim_hash=p_claim_hash;
 if not found then return null; end if;
 perform 1 from public.assistant_accounts where assistant_id=v.assistant_id for update;
 perform 1 from public.assistants where id=v.assistant_id for update;
 select * into v from public.assistant_invitations where id=v.id and claim_hash=p_claim_hash
  and verified_at is not null and claim_expires_at>now() and expires_at>now() and revoked_at is null and accepted_at is null for update;
 if not found or length(trim(p_name))<2 or length(p_name)>100 or p_password_hash !~ '^\$2[aby]\$12\$' then return null; end if;
 update public.assistant_accounts set password_hash=p_password_hash,credential_version=credential_version+1 where assistant_id=v.assistant_id and phone=v.phone;
 if not found then return null; end if;
 update public.assistants set name=trim(p_name),phone=v.phone,status='active' where id=v.assistant_id;
 delete from public.assistant_sessions where assistant_id=v.assistant_id;
 update public.assistant_invitations set accepted_at=now(),claim_hash=null where id=v.id;
 insert into public.assistant_access_audit(tenant_id,assistant_id,action) values(v.tenant_id,v.assistant_id,'invitation_accepted');
 return v.assistant_id;
end; $$;

create function public.assistant_start_session(p_assistant uuid,p_hash text,p_version integer,p_token_hash text,p_origin text) returns boolean
language plpgsql security invoker set search_path='' as $$
begin
 perform 1 from public.assistant_accounts a join public.assistants s on s.id=a.assistant_id
 where a.assistant_id=p_assistant and a.password_hash=p_hash and a.credential_version=p_version and s.status='active' for share of a,s;
 if not found then return false; end if;
 insert into public.assistant_sessions(assistant_id,token_hash,origin,credential_version) values(p_assistant,p_token_hash,p_origin,p_version);
 return true;
end; $$;

-- This function is the only assistant data surface. Auth, permission and group checks
-- stay inside the same transaction as every operation; staff JWT routes are separate.
create function public.assistant_workspace(p_token_hash text,p_origin text,p_resource text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.assistant_accounts; s public.assistants; ids uuid[]; result jsonb; v_id uuid; v_group uuid; v_student uuid; v_session uuid; v_count integer;
begin
 select ac.* into a from public.assistant_accounts ac join public.assistant_sessions ss on ss.assistant_id=ac.assistant_id
 where ss.token_hash=p_token_hash and ss.origin=p_origin and ss.expires_at>now() and ss.credential_version=ac.credential_version for share of ac;
 if not found then raise exception 'UNAUTHORIZED'; end if;
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
 insert into public.assistant_access_audit(tenant_id,assistant_id,action,target_id) values(a.tenant_id,a.assistant_id,p_resource||'.'||p_action,v_id);
 return jsonb_build_object('id',v_id);
end; $$;

revoke execute on function public.assistant_invite(uuid,uuid,uuid,text,text,jsonb,boolean,uuid[],jsonb),public.assistant_confirm_invitation(text,text,text),public.assistant_accept_invitation(text,text,text),public.assistant_start_session(uuid,text,integer,text,text),public.assistant_workspace(text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_invite(uuid,uuid,uuid,text,text,jsonb,boolean,uuid[],jsonb),public.assistant_confirm_invitation(text,text,text),public.assistant_accept_invitation(text,text,text),public.assistant_start_session(uuid,text,integer,text,text),public.assistant_workspace(text,text,text,text,jsonb) to service_role;
revoke execute on function public.assistant_configure(uuid,uuid,jsonb,boolean,uuid[],text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_configure(uuid,uuid,jsonb,boolean,uuid[],text,jsonb) to service_role;
