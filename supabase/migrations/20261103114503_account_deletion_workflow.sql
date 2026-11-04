-- Deletion is a separate, fresh phone-confirmed intent. Existing phone/profile
-- verification and a borrowed assistant session never authorize deletion.
create table public.account_deletion_intents(
 id uuid primary key,tenant_id uuid not null unique references public.tenants(id) on delete cascade,
 user_id uuid not null references public.users(id) on delete cascade,origin text not null,phone text not null,
 challenge_id uuid,authorization_hash text check(authorization_hash ~ '^[a-f0-9]{64}$'),
 state text not null default 'draft' check(state in ('draft','authorized','queued')),
 created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '15 minutes',verified_at timestamptz
);
-- Kept outside the tenant cascade so a stopped process can resume storage/Auth
-- cleanup. No names, phone numbers, passwords or customer content are stored.
create table public.account_deletion_jobs(
 id uuid primary key,tenant_id uuid not null unique,owner_id uuid,user_ids uuid[] not null,
 receipt_hash text not null unique check(receipt_hash ~ '^[a-f0-9]{64}$'),
 phase text not null default 'storage' check(phase in ('storage','data','auth','done')),
 state text not null default 'queued' check(state in ('queued','processing','retry','done')),
 execute_after timestamptz not null default now()+interval '16 minutes',next_attempt_at timestamptz not null default now(),
 lease_id uuid,lease_until timestamptz,attempts integer not null default 0,last_error text,
 created_at timestamptz not null default now(),completed_at timestamptz
);
create index account_deletion_jobs_pending on public.account_deletion_jobs(next_attempt_at) where state<>'done';
alter table public.account_deletion_intents enable row level security;
alter table public.account_deletion_jobs enable row level security;
revoke all on public.account_deletion_intents,public.account_deletion_jobs from public,anon,authenticated;
grant all on public.account_deletion_intents,public.account_deletion_jobs to service_role;

create function public.account_deletion_actor(p_user uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare actor public.users;t public.tenants;
begin
 select * into actor from public.users where id=p_user;
 select * into t from public.tenants where id=actor.tenant_id and status='active' and deleted_at is null;
 if actor.id is null or actor.role not in ('owner','teacher','center_owner') or actor.assistant_id is not null or t.id is null or exists(select 1 from public.account_deletion_jobs where tenant_id=t.id and state<>'done') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 -- A teacher attached to another owner's center cannot delete that center.
 if exists(select 1 from public.users where tenant_id=t.id and (role='admin' or role in ('owner','center_owner') and id<>p_user))
  or actor.role='teacher' and exists(select 1 from public.users where tenant_id=t.id and id<>p_user and role in ('owner','teacher','center_owner')) then raise exception 'WORKSPACE_OWNER_REQUIRED' using errcode='42501';end if;
 return jsonb_build_object('tenant_id',t.id,'name',t.name,'phone',public.parent_family_phone(actor.phone));
end;$$;
revoke all on function public.account_deletion_actor(uuid) from public,anon,authenticated;
grant execute on function public.account_deletion_actor(uuid) to service_role;

create function public.account_deletion_operation(p_user uuid,p_origin text,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor jsonb:=public.account_deletion_actor(p_user);tenant uuid:=(actor->>'tenant_id')::uuid;
 intent public.account_deletion_intents;ch public.teacher_phone_verifications;job public.account_deletion_jobs;
begin
 if nullif(p_origin,'') is null or actor->>'phone' is null then raise exception 'PHONE_REQUIRED' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':account-deletion',0));
 if p_action='start' then
  insert into public.account_deletion_intents(id,tenant_id,user_id,origin,phone) values((p_data->>'id')::uuid,tenant,p_user,p_origin,actor->>'phone')
  on conflict(tenant_id) do update set id=excluded.id,user_id=p_user,origin=p_origin,phone=excluded.phone,challenge_id=null,authorization_hash=null,state='draft',created_at=now(),expires_at=now()+interval '15 minutes',verified_at=null returning * into intent;
  return jsonb_build_object('id',intent.id,'phone',intent.phone,'name',actor->>'name','expires_at',intent.expires_at);
 end if;
 select * into intent from public.account_deletion_intents where id=(p_data->>'id')::uuid and tenant_id=tenant and user_id=p_user and origin=p_origin and phone=actor->>'phone' and expires_at>now() for update;
 if intent.id is null then raise exception 'DELETION_INTENT_EXPIRED' using errcode='23514';end if;
 if p_action='info' then return jsonb_build_object('phone',intent.phone,'verified',false);end if;
 select * into ch from public.teacher_phone_verifications where user_id=p_user and tenant_id=tenant and origin=p_origin and phone=intent.phone and challenge_id=(p_data->>'challenge_id')::uuid and requested_at>=intent.created_at;
 if p_action='bind' then
  if ch.user_id is null or ch.confirmed_at is not null or ch.expires_at<=now() then raise exception 'DELETION_CHALLENGE_REQUIRED' using errcode='23514';end if;
  update public.account_deletion_intents set challenge_id=ch.challenge_id,authorization_hash=null,state='draft',verified_at=null where id=intent.id;
  return jsonb_build_object('bound',true);
 elsif p_action='authorize' then
  if ch.user_id is null or intent.challenge_id is distinct from ch.challenge_id or ch.confirmed_at is null or ch.confirmed_at<now()-interval '5 minutes' or ch.expires_at<=now() or coalesce(p_data->>'authorization_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'DELETION_CHALLENGE_REQUIRED' using errcode='23514';end if;
  update public.account_deletion_intents set state='authorized',verified_at=now(),authorization_hash=p_data->>'authorization_hash' where id=intent.id;
  return jsonb_build_object('authorized',true);
 elsif p_action='confirm' then
  if intent.state<>'authorized' or intent.verified_at<now()-interval '5 minutes' or intent.authorization_hash is null or intent.authorization_hash is distinct from p_data->>'authorization_hash'
   or p_data->>'confirmation' is distinct from 'حذف الحساب' or p_data->'data_saved_ack' is distinct from 'true'::jsonb or coalesce(p_data->>'receipt_hash','') !~ '^[a-f0-9]{64}$' then raise exception 'DELETION_CONFIRMATION_REQUIRED' using errcode='23514';end if;
  -- Freeze access immediately, then drain pre-existing upload requests before
  -- object cleanup. This exceeds the application's maximum upload lifetime.
  insert into public.account_deletion_jobs(id,tenant_id,owner_id,user_ids,receipt_hash)
   select intent.id,tenant,p_user,array_agg(id order by id),p_data->>'receipt_hash' from public.users where tenant_id=tenant returning * into job;
  update public.tenants set status='cancelled',deleted_at=now(),subscription_status='deactivated' where id=tenant;
  delete from public.assistant_sessions where assistant_id in(select id from public.assistants where tenant_id=tenant);
  delete from public.portal_handoffs where tenant_id=tenant;
  delete from public.parent_family_handoffs where student_id in(select id from public.students where tenant_id=tenant);
  update public.account_deletion_intents set state='queued',authorization_hash=null where id=intent.id;
  return jsonb_build_object('id',job.id,'status','queued');
 end if;
 raise exception 'INVALID_INPUT' using errcode='22023';
end;$$;


-- Legacy quiz rows may predate tenant_id. Only explicit UUID ownership is
-- sufficient; student codes and names are reused by other teachers.
create function public.account_legacy_owned(p_body text,p_tenant uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 with parsed as(select public.portal_parse_legacy_json(p_body) v)
 select coalesce((v->>'tenant_id' is null or v->>'tenant_id'=p_tenant::text) and (
  v->>'tenant_id'=p_tenant::text or exists(select 1 from public.groups where tenant_id=p_tenant and id::text=v->>'group_id')
  or exists(select 1 from public.students where tenant_id=p_tenant and id::text=coalesce(v->>'student_id',v->'student'->>'id'))
  or exists(select 1 from public.teachers where tenant_id=p_tenant and id::text=v->>'teacher_id')
 ),false) from parsed
$$;
revoke all on function public.account_legacy_owned(text,uuid) from public,anon,authenticated;
grant execute on function public.account_legacy_owned(text,uuid) to service_role;

create function public.account_export_redact(p_value jsonb) returns jsonb
language plpgsql immutable security invoker set search_path='' as $$
declare result jsonb;pair record;
begin
 if jsonb_typeof(p_value)='array' then select coalesce(jsonb_agg(public.account_export_redact(value)),'[]'::jsonb) into result from jsonb_array_elements(p_value);return result;end if;
 if jsonb_typeof(p_value)<>'object' then return p_value;end if;
 result:='{}';
 for pair in select * from jsonb_each(p_value) loop
  if pair.key !~* '(password|secret|token|nonce|credential|api_key|otp|(^|_)hash($|_)|financial_pin)' then result:=result||jsonb_build_object(pair.key,public.account_export_redact(pair.value));end if;
 end loop;return result;
end;$$;
create function public.account_data_export(p_user uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor jsonb:=public.account_deletion_actor(p_user);tenant uuid:=(actor->>'tenant_id')::uuid;
 item text;rows jsonb;result jsonb:='{}';
begin
 foreach item in array array['students','groups','group_students','enrollments','sessions','attendance','quizzes','quiz_scores','study_materials','homework_submissions','teachers','assistants','student_collections','teacher_payouts','academic_years','academic_year_students','classroom_history','teacher_announcements','announcement_type_requests','support_tickets','tenant_platform_settings','rooms'] loop
  execute format('select coalesce(jsonb_agg(public.account_export_redact(to_jsonb(source))),''[]''::jsonb) from public.%I source where tenant_id=$1',item) into rows using tenant;
  result:=result||jsonb_build_object(item,rows);
 end loop;
 select public.account_export_redact(to_jsonb(t)) into rows from public.tenants t where id=tenant;
 result:=result||jsonb_build_object('account',rows,'exported_at',now(),'format_version',1,
  'legacy_quizzes',(select coalesce(jsonb_agg(public.account_export_redact(public.portal_parse_legacy_json(message_body))),'[]'::jsonb) from public.whatsapp_inbox where tenant_id is null and public.account_legacy_owned(message_body,tenant)),
  'assistant_access',(select coalesce(jsonb_agg(jsonb_build_object('assistant_id',assistant_id,'permissions',permissions,'group_ids',group_ids,'all_groups',all_groups)),'[]'::jsonb) from public.assistant_accounts where tenant_id=tenant),
  'support_replies',(select coalesce(jsonb_agg(public.account_export_redact(to_jsonb(r))),'[]'::jsonb) from public.support_replies r join public.support_tickets t on t.id=r.ticket_id where t.tenant_id=tenant));
 return result;
end;$$;
revoke all on function public.account_export_redact(jsonb),public.account_data_export(uuid) from public,anon,authenticated;
grant execute on function public.account_export_redact(jsonb),public.account_data_export(uuid) to service_role;

create function public.account_deletion_worker(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare job public.account_deletion_jobs;tenant uuid;remaining integer;
begin
 if p_action='status' then
  select * into job from public.account_deletion_jobs where receipt_hash=p_data->>'receipt_hash' and created_at>now()-interval '7 days';
  if job.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
  return jsonb_build_object('status',case when job.state='done' then 'done' else 'processing' end);
 elsif p_action='claim' then
  delete from public.account_deletion_jobs where state='done' and completed_at<now()-interval '7 days';
  select * into job from public.account_deletion_jobs where state<>'done' and execute_after<=now() and next_attempt_at<=now() and (lease_until is null or lease_until<now()) order by created_at for update skip locked limit 1;
  if job.id is null then return null;end if;
  update public.account_deletion_jobs set state='processing',lease_id=gen_random_uuid(),lease_until=now()+interval '2 minutes',attempts=attempts+1 where id=job.id returning * into job;
  return jsonb_build_object('id',job.id,'lease_id',job.lease_id,'phase',job.phase,'user_ids',job.user_ids);
 end if;
 select tenant_id into tenant from public.account_deletion_jobs where id=(p_data->>'id')::uuid;
 if tenant is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':account-deletion',0));
 select * into job from public.account_deletion_jobs where id=(p_data->>'id')::uuid and lease_id=(p_data->>'lease_id')::uuid and state='processing' and lease_until>now() for update;
 if job.id is null then raise exception 'LEASE_EXPIRED' using errcode='23514';end if;
 if p_action='files' and job.phase in ('storage','data') then
  return coalesce((select jsonb_agg(jsonb_build_object('bucket',bucket_id,'path',name)) from
   (select bucket_id,name from storage.objects where tenant::text=any(string_to_array(name,'/')) or owner_id=any(job.user_ids::text[]) order by bucket_id,name limit 100) objects),'[]'::jsonb);
 elsif p_action='storage_done' and job.phase='storage' then
  if exists(select 1 from storage.objects where tenant::text=any(string_to_array(name,'/')) or owner_id=any(job.user_ids::text[])) then raise exception 'FILES_REMAIN' using errcode='23514';end if;
  update public.account_deletion_jobs set phase='data',lease_until=now()+interval '2 minutes' where id=job.id;
 elsif p_action='data' and job.phase='data' then
  if exists(select 1 from storage.objects where tenant::text=any(string_to_array(name,'/')) or owner_id=any(job.user_ids::text[])) then
   update public.account_deletion_jobs set phase='storage' where id=job.id;return jsonb_build_object('phase','storage');
  end if;
  perform set_config('centrly.account_deletion_worker',job.id::text,true);
  perform set_config('centrly.classroom_recorded','1',true);
  delete from public.email_verifications where lower(email) in(select lower(email) from public.users where tenant_id=tenant);
  delete from public.whatsapp_inbox where tenant_id is null and (student_id in(select id from public.students where tenant_id=tenant) or public.account_legacy_owned(message_body,tenant));
  delete from public.message_logs where tenant_id is null and student_id in(select id from public.students where tenant_id=tenant);
  delete from public.activity_logs where tenant_id is null and actor_user_id=any(job.user_ids);
  delete from public.payment_proofs where tenant_id is null and submitted_by=any(job.user_ids);
  delete from public.homework_submissions where tenant_id=tenant;
  delete from public.study_materials where tenant_id=tenant or tenant_id is null and group_id in(select id from public.groups where tenant_id=tenant);
  delete from public.telemetry_events where tenant_id=tenant;
  delete from public.meta_portal_dispatch_queue where tenant_id=tenant::text;
  delete from public.tenants where id=tenant;
  update public.account_deletion_jobs set phase='auth',lease_until=now()+interval '2 minutes' where id=job.id;
 elsif p_action='auth_deleted' and job.phase='auth' then
  if nullif(p_data->>'user_id','') is null or not (p_data->>'user_id')::uuid=any(job.user_ids) then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  update public.account_deletion_jobs set user_ids=array_remove(user_ids,(p_data->>'user_id')::uuid),lease_until=now()+interval '2 minutes' where id=job.id;
 elsif p_action='done' and job.phase='auth' then
  if cardinality(job.user_ids)<>0 then raise exception 'AUTH_USERS_REMAIN' using errcode='23514';end if;
  update public.account_deletion_jobs set phase='done',state='done',owner_id=null,user_ids='{}',completed_at=now(),lease_id=null,lease_until=null,last_error=null where id=job.id;
 elsif p_action in ('release','failed') then
  update public.account_deletion_jobs set state=case when p_action='failed' then 'retry' else 'queued' end,next_attempt_at=now()+case when p_action='failed' then interval '5 minutes' else interval '15 seconds' end,lease_id=null,lease_until=null,last_error=case when p_action='failed' then left(p_data->>'error_code',80) else null end where id=job.id;
 else raise exception 'INVALID_INPUT' using errcode='22023';end if;
 return jsonb_build_object('updated',true);
end;$$;
revoke all on function public.account_deletion_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.account_deletion_worker(text,jsonb) to service_role;
revoke all on function public.account_deletion_operation(uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.account_deletion_operation(uuid,text,text,jsonb) to service_role;

-- Freeze late writes as well as new HTTP sessions. Service workers may perform
-- their scoped cleanup, but no teacher/assistant RPC can set this private flag.
create function public.guard_deleting_account() returns trigger
language plpgsql security definer set search_path='' as $$
declare tenant text:=to_jsonb(new)->>'tenant_id';job_id uuid;
begin
 if tenant is null then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant||':account-deletion',0));
 select id into job_id from public.account_deletion_jobs where tenant_id::text=tenant and state<>'done';
 if job_id is not null and coalesce(current_setting('centrly.account_deletion_worker',true),'')<>job_id::text then raise exception 'ACCOUNT_DELETION_PENDING' using errcode='42501';end if;
 return new;
end;$$;
revoke all on function public.guard_deleting_account() from public,anon,authenticated;
grant execute on function public.guard_deleting_account() to service_role;
do $$declare item record;begin
 for item in select c.table_name from information_schema.columns c join information_schema.tables t using(table_schema,table_name)
 where c.table_schema='public' and c.column_name='tenant_id' and t.table_type='BASE TABLE' and c.table_name not in ('account_deletion_intents','account_deletion_jobs','tenants') loop
  execute format('create trigger account_deletion_freeze before insert or update on public.%I for each row execute function public.guard_deleting_account()',item.table_name);
 end loop;
end;$$;

-- The normal RLS helpers also deny bearer JWTs issued before deactivation.
create or replace function public.get_current_user_tenant_id() returns uuid
language sql stable security definer set search_path='' as $$
 select u.tenant_id from public.users u join public.tenants t on t.id=u.tenant_id where u.id=auth.uid() and t.status='active' and t.deleted_at is null and not exists(select 1 from public.account_deletion_jobs j where j.tenant_id=t.id and j.state<>'done')
$$;
create or replace function public.get_user_profile(p_user_id uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare actor public.users;
begin
 if auth.role() is distinct from 'service_role' and auth.uid() is distinct from p_user_id then raise exception 'Not authorized to read this profile' using errcode='42501';end if;
 select * into actor from public.users u where u.id=p_user_id and (u.role='admin' or exists(select 1 from public.tenants t where t.id=u.tenant_id and t.status='active' and t.deleted_at is null and not exists(select 1 from public.account_deletion_jobs j where j.tenant_id=t.id and j.state<>'done')));
 if not found then return null;end if;
 return jsonb_build_object('id',actor.id,'tenant_id',actor.tenant_id,'role',actor.role,'email',actor.email,'teacher_id',actor.teacher_id,'assistant_id',actor.assistant_id,'full_name',actor.full_name,'phone',actor.phone,'subject',actor.subject,'has_security_pin',false);
end;$$;

-- A pending Auth cleanup must not let Google recreate the deleted workspace.
-- This service-only function needs to read auth.users/identities, which are not
-- readable by service_role directly. It never inserts/deletes Auth identities or
-- accepts a role/tenant from the client. The API verifies the Google token first.
create or replace function public.google_teacher_profile(p_user uuid,p_data jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 a auth.users;u public.users;t public.tenants;v_tenant uuid;v_email text;
 v_exists boolean;v_needed boolean;v_stages text[];v_name text;v_phone text;v_subject text;v_other text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('google-profile:'||p_user::text,0));
 if exists(select 1 from public.account_deletion_jobs where p_user=any(user_ids) and state<>'done') then raise exception 'GOOGLE_ACCOUNT_DISABLED';end if;
 select * into a from auth.users where id=p_user;
 if not found or a.email_confirmed_at is null or nullif(a.email,'') is null or coalesce(a.is_anonymous,false)
  or not exists(select 1 from auth.identities where user_id=p_user and provider='google') then raise exception 'GOOGLE_IDENTITY_REQUIRED';end if;
 v_email:=lower(trim(a.email));
 select * into u from public.users where id=p_user;v_exists:=found;
 if v_exists then
  if u.role not in ('owner','teacher','admin','center_owner') then raise exception 'GOOGLE_ROLE_NOT_SUPPORTED';end if;
  if u.role<>'admin' then
   select * into t from public.tenants where id=u.tenant_id;
   if not found or t.status<>'active' or t.deleted_at is not null then raise exception 'GOOGLE_ACCOUNT_DISABLED';end if;
  end if;
 else
  if exists(select 1 from public.users where lower(trim(email))=v_email and id<>p_user) then raise exception 'GOOGLE_ACCOUNT_CONFLICT';end if;
 end if;
 v_needed:=not v_exists or (u.role in ('owner','teacher') and (
  nullif(trim(u.full_name),'') is null or nullif(trim(u.phone),'') is null or nullif(trim(u.subject),'') is null
  or case when jsonb_typeof(t.settings->'education_stages')='array' then jsonb_array_length(t.settings->'education_stages')=0 else true end));
 if p_data is not null then
  if v_exists and u.role not in ('owner','teacher') then raise exception 'GOOGLE_ROLE_NOT_SUPPORTED';end if;
  if jsonb_typeof(p_data)<>'object' or (p_data->'terms_accepted') is distinct from 'true'::jsonb
   or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('full_name','phone','subject','education_stages','other_stage','terms_accepted')) then raise exception 'INVALID_GOOGLE_PROFILE';end if;
  v_name:=trim(p_data->>'full_name');v_phone:=trim(p_data->>'phone');v_subject:=trim(p_data->>'subject');v_other:=trim(coalesce(p_data->>'other_stage',''));
  if v_name is null or length(v_name)<2 or length(v_name)>120 or v_phone is null or v_phone!~'^01[0125][0-9]{8}$'
   or nullif(v_subject,'') is null or length(v_subject)>100 or length(v_other)>100 or jsonb_typeof(p_data->'education_stages') is distinct from 'array' then raise exception 'INVALID_GOOGLE_PROFILE';end if;
  select array_agg(distinct value) into v_stages from jsonb_array_elements_text(p_data->'education_stages');
  if coalesce(array_length(v_stages,1),0)<1 or not v_stages<@array['primary','preparatory','secondary','other']::text[]
   or ('other'=any(v_stages) and v_other='') then raise exception 'INVALID_GOOGLE_PROFILE';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('teacher-phone:'||public.parent_family_phone(v_phone),0));
  if exists(select 1 from public.users where id<>p_user and public.parent_family_phone(phone)=public.parent_family_phone(v_phone)) then raise exception 'PHONE_ALREADY_EXISTS';end if;
  if v_exists then
   v_tenant:=u.tenant_id;
   update public.users set full_name=v_name,phone=v_phone,subject=v_subject,email=v_email where id=p_user returning * into u;
  else
   insert into public.tenants(name,status,subscription_status,trial_ends_at,account_type,settings)
   values(v_name,'active','trial',now()+interval '14 days','teacher',jsonb_build_object('signup_source','google')) returning id into v_tenant;
   insert into public.users(id,tenant_id,role,email,full_name,phone,subject)
   values(p_user,v_tenant,'owner',v_email,v_name,v_phone,v_subject) returning * into u;
  end if;
  update public.tenants set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object('subject',v_subject,'education_stages',to_jsonb(v_stages),'other_stage',case when 'other'=any(v_stages) then v_other else '' end,'terms_accepted_at',now(),'google_onboarding_completed_at',now())
  where id=v_tenant returning * into t;
  v_needed:=false;
 end if;
 return jsonb_build_object('requires_profile',v_needed,'email',v_email,
  'full_name',coalesce(u.full_name,a.raw_user_meta_data->>'full_name',a.raw_user_meta_data->>'name',''),
  'phone',coalesce(u.phone,''),'subject',coalesce(u.subject,''),
  'education_stages',case when jsonb_typeof(t.settings->'education_stages')='array' then t.settings->'education_stages' else '[]'::jsonb end,
  'other_stage',coalesce(t.settings->>'other_stage',''),
  'user',case when not v_needed then jsonb_build_object('id',u.id,'tenant_id',u.tenant_id,'role',u.role,'email',v_email,'name',u.full_name,'full_name',u.full_name,'phone',u.phone,'subject',u.subject,'teacher_id',u.teacher_id,'assistant_id',u.assistant_id,'account_type',t.account_type,'has_security_pin',false) else null end);
end;$$;

revoke all on function public.google_teacher_profile(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.google_teacher_profile(uuid,jsonb) to service_role;

create or replace function public.announcement_worker(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tenant uuid; rec public.announcement_recipients; attempt public.announcement_delivery_attempts;
 ann public.teacher_announcements; kind public.announcement_types; actor jsonb; reason text; result_status text;
 month_start date:=date_trunc('month',now() at time zone 'Africa/Cairo')::date;
begin
 if p_action='claim' then
  for tenant in select distinct tenant_id from public.announcement_recipients where status in ('queued','sending') and not exists(select 1 from public.account_deletion_jobs j where j.tenant_id=announcement_recipients.tenant_id and j.state<>'done') limit 20 loop
   if not pg_try_advisory_xact_lock(hashtextextended(tenant::text||':announcement-queue',0)) then continue;end if;
   for rec in select * from public.announcement_recipients where tenant_id=tenant and (status='queued' or status='sending' and lease_until<now()) order by created_at for update skip locked limit 30 loop
    select * into attempt from public.announcement_delivery_attempts where id=rec.current_attempt_id for update;
    if rec.status='sending' then
     update public.announcement_delivery_attempts set status='unknown',error_code='LEASE_EXPIRED',lease_until=null,updated_at=now() where id=attempt.id;
     update public.announcement_recipients set status='unknown',provider_error_code='LEASE_EXPIRED',lease_until=null,updated_at=now() where id=rec.id;
     continue;
    end if;
    reason:=null;
    begin actor:=public.announcement_actor(tenant,attempt.actor_user_id,attempt.actor_assistant_id,'send');
    exception when insufficient_privilege then reason:='ACTOR_ACCESS_CHANGED';end;
    select * into ann from public.teacher_announcements where id=rec.announcement_id and tenant_id=tenant;
    select * into kind from public.announcement_types where key=ann.type_key;
    if reason is null and (ann.id is null or ann.status<>'published' or ann.revision<>rec.revision or ann.expires_at<=now()) then reason:='ANNOUNCEMENT_CHANGED';end if;
    if reason is null and not public.announcement_groups_allowed(tenant,actor,ann.group_ids) then reason:='GROUP_ACCESS_CHANGED';end if;
    if reason is null and (kind.key is null or not kind.available or not kind.official_enabled or kind.category<>'UTILITY' or kind.provider_category is distinct from 'UTILITY' or kind.provider_status<>'APPROVED' or ann.template_snapshot->>'body' is distinct from kind.body or ann.template_snapshot->>'id' is distinct from kind.meta_id or ann.template_snapshot->>'name' is distinct from kind.meta_name or ann.template_snapshot->'fields' is distinct from kind.fields) then reason:='TEMPLATE_NOT_ENABLED';end if;
    if reason is null and attempt.period<>month_start then reason:='BILLING_PERIOD_CHANGED';end if;
    if reason is null and not exists(select 1 from public.announcement_recipient_candidates(tenant,ann.group_ids,ann.recipient_roles) c where c.phone=rec.phone and c.recipient_role=rec.recipient_role and c.group_ids=rec.group_ids and c.group_names=rec.group_names and c.consented and not c.opted_out) then reason:='AUDIENCE_OR_CONSENT_CHANGED';end if;
    if reason is not null then
     update public.announcement_allowances set reserved=reserved-1 where tenant_id=tenant and period=attempt.period;
     update public.announcement_delivery_attempts set status='skipped',error_code=reason,updated_at=now() where id=attempt.id;
     update public.announcement_recipients set status='skipped',skip_reason=reason,updated_at=now() where id=rec.id;
     continue;
    end if;
    update public.announcement_delivery_attempts set status='sending',lease_until=now()+interval '2 minutes',updated_at=now() where id=attempt.id;
    update public.announcement_recipients set status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes',updated_at=now() where id=rec.id;
    return jsonb_build_object('attempt_id',attempt.id,'to',rec.phone,'template',ann.template_snapshot,'parameters',rec.parameters);
   end loop;
  end loop;
  return null;
 elsif p_action='settle' then
  select tenant_id into tenant from public.announcement_delivery_attempts where id=(p_data->>'attempt_id')::uuid;
  if tenant is null or exists(select 1 from public.account_deletion_jobs where tenant_id=tenant and state<>'done') then return jsonb_build_object('ignored',true);end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text||':announcement-queue',0));
  select * into attempt from public.announcement_delivery_attempts where id=(p_data->>'attempt_id')::uuid for update;
  if attempt.status not in ('sending','unknown') or attempt.accepted then return jsonb_build_object('unchanged',true);end if;
  if p_data->>'outcome'='accepted' and coalesce(p_data->>'message_id','') ~ '^wamid\.' then
   result_status:='sent';
   update public.announcement_allowances set reserved=reserved-1,sent=sent+1 where tenant_id=tenant and period=attempt.period;
   update public.announcement_delivery_attempts set accepted=true,provider_message_id=p_data->>'message_id' where id=attempt.id;
  elsif p_data->>'outcome'='not_sent' and attempt.status='sending' then
   result_status:='failed';
   update public.announcement_allowances set reserved=reserved-1 where tenant_id=tenant and period=attempt.period;
  else result_status:='unknown';end if;
  update public.announcement_delivery_attempts set status=result_status,error_code=left(p_data->>'error_code',100),lease_until=null,updated_at=now() where id=attempt.id;
  update public.announcement_recipients set status=result_status,provider_message_id=case when result_status='sent' then p_data->>'message_id' else provider_message_id end,provider_error_code=left(p_data->>'error_code',100),lease_until=null,sent_at=case when result_status='sent' then now() else sent_at end,updated_at=now() where id=attempt.recipient_id and current_attempt_id=attempt.id;
  return jsonb_build_object('status',result_status);
 elsif p_action='delivery' then
  select tenant_id into tenant from public.announcement_delivery_attempts where provider_message_id=p_data->>'message_id';
  if tenant is null or exists(select 1 from public.account_deletion_jobs where tenant_id=tenant and state<>'done') then return jsonb_build_object('ignored',true);end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text||':announcement-queue',0));
  select * into attempt from public.announcement_delivery_attempts where provider_message_id=p_data->>'message_id' for update;
  result_status:=p_data->>'status';
  if result_status not in ('sent','delivered','read','failed') or not attempt.accepted or attempt.status='read' or attempt.status='delivered' and result_status<>'read' or attempt.status='failed' then return jsonb_build_object('unchanged',true);end if;
  update public.announcement_delivery_attempts set status=result_status,error_code=case when result_status='failed' then left(p_data->>'error_code',100) else null end,updated_at=now() where id=attempt.id;
  update public.announcement_recipients set status=result_status,provider_error_code=case when result_status='failed' then left(p_data->>'error_code',100) else null end,updated_at=now() where id=attempt.recipient_id and current_attempt_id=attempt.id;
  return jsonb_build_object('status',result_status);
 end if;
 raise exception 'INVALID_INPUT' using errcode='22023';
end;$$;
revoke all on function public.announcement_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.announcement_worker(text,jsonb) to service_role;


notify pgrst,'reload schema';

-- An irreversible, confirmed deletion must not be undone by an old billing or
-- administrator "restore" action while cleanup is still in progress.
create function public.guard_deleting_tenant() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if exists(select 1 from public.account_deletion_jobs where tenant_id=new.id and state<>'done') and (new.status='active' or new.deleted_at is null) then raise exception 'ACCOUNT_DELETION_PENDING' using errcode='42501';end if;
 return new;
end;$$;
revoke all on function public.guard_deleting_tenant() from public,anon,authenticated;
grant execute on function public.guard_deleting_tenant() to service_role;
create trigger account_deletion_no_restore before update on public.tenants for each row execute function public.guard_deleting_tenant();
