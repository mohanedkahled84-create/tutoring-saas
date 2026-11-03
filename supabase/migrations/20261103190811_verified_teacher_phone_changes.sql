-- Changing a teacher's account number keeps the old identity until a new OTP succeeds.
create table public.teacher_phone_changes(
 user_id uuid primary key references public.users(id) on delete cascade,tenant_id uuid not null references public.tenants(id) on delete cascade,
 previous_phone text,new_phone text not null check(new_phone ~ '^201[0125][0-9]{8}$'),origin text not null,
 pending_until timestamptz not null,challenge_id uuid unique,code_hash text check(code_hash is null or code_hash ~ '^[a-f0-9]{64}$'),expires_at timestamptz,
 requested_at timestamptz,attempts integer not null default 0 check(attempts between 0 and 5),delivery_status text not null default 'pending' check(delivery_status in ('pending','sent','failed','uncertain')),confirmed_at timestamptz
);
alter table public.teacher_phone_changes enable row level security;
revoke all on public.teacher_phone_changes from public,anon,authenticated;
grant all on public.teacher_phone_changes to service_role;
create trigger account_deletion_freeze_teacher_phone_changes before insert or update on public.teacher_phone_changes for each row execute function public.guard_deleting_account();

create function public.teacher_phone_change(p_user uuid,p_tenant uuid,p_origin text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor public.users;ch public.teacher_phone_changes;v_phone text;candidate text;confirmation public.teacher_phone_verifications;
begin
 select u.* into actor from public.users u join public.tenants t on t.id=u.tenant_id and t.status='active' and t.deleted_at is null where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner') for update of u;
 if actor.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if coalesce(p_origin,'')='' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 v_phone:=public.parent_family_phone(actor.phone);
 select * into ch from public.teacher_phone_changes where user_id=p_user for update;
 if p_action='begin' then
  candidate:=public.parent_family_phone(p_data->>'phone');
  if candidate is null or candidate!~'^201[0125][0-9]{8}$' or candidate is not distinct from v_phone then raise exception 'INVALID_PHONE_CHANGE' using errcode='22023';end if;
  if ch.user_id is null or ch.previous_phone is distinct from v_phone or ch.new_phone<>candidate or ch.origin<>p_origin or ch.pending_until<=now() or ch.confirmed_at is not null then
   insert into public.teacher_phone_changes(user_id,tenant_id,previous_phone,new_phone,origin,pending_until) values(p_user,p_tenant,v_phone,candidate,p_origin,now()+interval '20 minutes')
   on conflict(user_id) do update set tenant_id=excluded.tenant_id,previous_phone=excluded.previous_phone,new_phone=excluded.new_phone,origin=excluded.origin,pending_until=excluded.pending_until,challenge_id=null,code_hash=null,expires_at=null,requested_at=null,attempts=0,delivery_status='pending',confirmed_at=null returning * into ch;
  end if;
  return jsonb_build_object('phone',ch.new_phone,'verified',false);
 end if;
 if ch.user_id is not null and ch.origin=p_origin and ch.pending_until>now() and ch.confirmed_at is not null and ch.new_phone=v_phone and (p_action='info' or p_action='verify' and ch.challenge_id=(p_data->>'challenge_id')::uuid) then return jsonb_build_object('verified',true,'phone',ch.new_phone,'challenge_id',ch.challenge_id);end if;
 if ch.user_id is null or ch.origin<>p_origin or ch.pending_until<=now() or ch.previous_phone is distinct from v_phone or ch.confirmed_at is not null then return jsonb_build_object('error','PHONE_CHANGE_EXPIRED');end if;
 if p_action='info' then return jsonb_build_object('phone',ch.new_phone,'verified',false);end if;
 if p_action='request' then
  if coalesce(p_data->>'code_hash','')!~'^[a-f0-9]{64}$' or nullif(p_data->>'challenge_id','') is null then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if ch.requested_at>now()-interval '60 seconds' then return jsonb_build_object('error','WAIT','retry_after',ceil(extract(epoch from ch.requested_at+interval '60 seconds'-now())));end if;
  update public.teacher_phone_changes set challenge_id=(p_data->>'challenge_id')::uuid,code_hash=p_data->>'code_hash',expires_at=least(pending_until,now()+interval '5 minutes'),requested_at=now(),attempts=0,delivery_status='pending' where user_id=p_user returning * into ch;
  return jsonb_build_object('challenge_id',ch.challenge_id,'phone',ch.new_phone,'expires_in',greatest(1,extract(epoch from ch.expires_at-now())::integer),'retry_after',60);
 end if;
 if ch.challenge_id is null or ch.challenge_id is distinct from (p_data->>'challenge_id')::uuid then return jsonb_build_object('error','INVALID_CODE');end if;
 if p_action='delivery' then
  if p_data->>'status' not in ('sent','failed','uncertain') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  update public.teacher_phone_changes set delivery_status=p_data->>'status' where user_id=p_user and delivery_status='pending';return jsonb_build_object('success',true);
 end if;
 if p_action<>'verify' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if ch.expires_at<=now() then return jsonb_build_object('error','CODE_EXPIRED');end if;
 if ch.attempts>=5 then return jsonb_build_object('error','ATTEMPTS');end if;
 if ch.delivery_status not in ('sent','uncertain') then return jsonb_build_object('error','NOT_SENT');end if;
 if p_data->>'code_hash' is null or ch.code_hash<>p_data->>'code_hash' then
  update public.teacher_phone_changes set attempts=attempts+1 where user_id=p_user;
  return jsonb_build_object('error',case when ch.attempts+1>=5 then 'ATTEMPTS' else 'INVALID_CODE' end);
 end if;
 perform pg_advisory_xact_lock(hashtextextended('teacher-phone:'||ch.new_phone,0));
 if exists(select 1 from public.users where id<>p_user and public.parent_family_phone(phone)=ch.new_phone) then return jsonb_build_object('error','PHONE_ALREADY_EXISTS');end if;
 update public.teacher_phone_changes set confirmed_at=now() where user_id=p_user;
 perform set_config('app.centerly_verified_phone_change',p_user::text||':'||ch.new_phone,true);
 update public.users set phone=ch.new_phone where id=p_user and tenant_id=p_tenant;
 update public.teachers set phone=ch.new_phone where user_id=p_user and tenant_id=p_tenant;
 -- Existing verification UI now recognises the newly proved number. Deletion
 -- still requires a challenge requested after its own intent was created.
 insert into public.teacher_phone_verifications(user_id,tenant_id,phone,challenge_id,code_hash,origin,expires_at,requested_at,delivery_status,confirmed_at)
 values(p_user,p_tenant,ch.new_phone,ch.challenge_id,ch.code_hash,p_origin,ch.expires_at,ch.requested_at,'sent',now())
 on conflict(user_id) do update set tenant_id=excluded.tenant_id,phone=excluded.phone,challenge_id=excluded.challenge_id,code_hash=excluded.code_hash,origin=excluded.origin,expires_at=excluded.expires_at,requested_at=excluded.requested_at,attempts=0,delivery_status='sent',confirmed_at=now();
 return jsonb_build_object('verified',true,'phone',ch.new_phone);
end;$$;
revoke all on function public.teacher_phone_change(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.teacher_phone_change(uuid,uuid,text,text,jsonb) to service_role;

create function public.guard_verified_teacher_phone_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare candidate text:=public.parent_family_phone(new.phone);
begin
 if old.role in ('owner','teacher','center_owner') and exists(select 1 from public.teacher_phone_verifications v where v.user_id=old.id and v.phone=public.parent_family_phone(old.phone) and v.confirmed_at is not null) and candidate is distinct from public.parent_family_phone(old.phone) and coalesce(current_setting('app.centerly_verified_phone_change',true),'')<>old.id::text||':'||coalesce(candidate,'') then raise exception 'PHONE_CHANGE_REQUIRES_VERIFICATION' using errcode='23514';end if;
 return new;
end;$$;
revoke all on function public.guard_verified_teacher_phone_change() from public,anon,authenticated;
grant execute on function public.guard_verified_teacher_phone_change() to service_role;
create trigger users_verified_phone_change before update of phone on public.users for each row execute function public.guard_verified_teacher_phone_change();

create function public.save_teacher_profile(p_user uuid,p_tenant uuid,p_assistant uuid,p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor public.users;v_name text:=btrim(p_data->>'teacher_name');v_subject text:=btrim(p_data->>'subject');v_phone text:=public.parent_family_phone(p_data->>'phone');v_contact text:=public.parent_family_phone(p_data->>'contact_phone');
begin
 if p_assistant is not null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select u.* into actor from public.users u join public.tenants t on t.id=u.tenant_id and t.status='active' and t.deleted_at is null where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner') for update of u;
 if actor.id is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if v_name is null or length(v_name) not between 2 and 120 or v_subject is null or length(v_subject) not between 1 and 100 or v_phone is null or v_contact is null then raise exception 'INVALID_PROFILE' using errcode='22023';end if;
 if v_phone is distinct from public.parent_family_phone(actor.phone) then raise exception 'PHONE_CHANGE_REQUIRES_VERIFICATION' using errcode='23514';end if;
 update public.users set full_name=v_name,subject=v_subject where id=p_user and tenant_id=p_tenant;
 update public.teachers set name=v_name,subjects=array[v_subject] where user_id=p_user and tenant_id=p_tenant;
 update public.tenants set settings=coalesce(settings,'{}')||jsonb_build_object('contact_phone',v_contact,'teacher_name',v_name,'subject',v_subject) where id=p_tenant;
 return jsonb_build_object('success',true,'user',jsonb_build_object('id',p_user,'name',v_name,'full_name',v_name,'subject',v_subject,'phone',actor.phone,'contact_phone',v_contact));
end;$$;
revoke all on function public.save_teacher_profile(uuid,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_teacher_profile(uuid,uuid,uuid,jsonb) to service_role;

alter table public.phone_otp_provider_attempts drop constraint phone_otp_provider_attempts_purpose_check;
alter table public.phone_otp_provider_attempts add constraint phone_otp_provider_attempts_purpose_check check(purpose in ('assistant','teacher','teacher-change'));
alter table public.phone_otp_provider_attempts drop constraint phone_otp_provider_attempts_check;
alter table public.phone_otp_provider_attempts add constraint phone_otp_provider_attempts_check check((purpose='assistant' and invitation_id is not null and user_id is null) or (purpose in ('teacher','teacher-change') and user_id is not null and invitation_id is null));
create or replace function public.phone_otp_provider_attempt(p_challenge uuid,p_purpose text,p_subject text,p_origin text,p_phone text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.phone_otp_provider_attempts;v_invite uuid;v_user uuid;v_expiry timestamptz;
begin
 -- Every operation is tied to the currently valid local OTP, not a caller's provider transaction ID.
 if p_purpose='assistant' then
  select i.id,c.expires_at into v_invite,v_expiry from public.assistant_phone_verifications c
   join public.assistant_invitations i on i.id=c.invitation_id
   where c.challenge_id=p_challenge and c.origin=p_origin and c.consumed_at is null and c.expires_at>now()
   and i.nonce_hash=p_subject and i.phone=p_phone and i.revoked_at is null and i.accepted_at is null and i.expires_at>now();
 elsif p_purpose='teacher' then
  select c.user_id,c.expires_at into v_user,v_expiry from public.teacher_phone_verifications c
   where c.challenge_id=p_challenge and c.user_id::text=p_subject and c.origin=p_origin and c.phone=p_phone and c.confirmed_at is null and c.expires_at>now();
 elsif p_purpose='teacher-change' then
  select c.user_id,c.expires_at into v_user,v_expiry from public.teacher_phone_changes c join public.users u on u.id=c.user_id and u.tenant_id=c.tenant_id
   where c.challenge_id=p_challenge and c.user_id::text=p_subject and c.origin=p_origin and c.new_phone=p_phone and c.previous_phone is not distinct from public.parent_family_phone(u.phone) and c.confirmed_at is null and c.pending_until>now() and c.expires_at>now();
 else raise exception 'INVALID_INPUT';end if;
 if v_expiry is null then return jsonb_build_object('error','CODE_EXPIRED');end if;
 if p_action='start' then
  insert into public.phone_otp_provider_attempts(challenge_id,purpose,subject,invitation_id,user_id,origin,phone,expires_at)
   values(p_challenge,p_purpose,p_subject,v_invite,v_user,p_origin,p_phone,v_expiry);
  return jsonb_build_object('success',true);
 end if;
 select * into v from public.phone_otp_provider_attempts where challenge_id=p_challenge and purpose=p_purpose and subject=p_subject and origin=p_origin and phone=p_phone for update;
 if not found or v.expires_at<=now() then return jsonb_build_object('error','CODE_EXPIRED');end if;
 if p_action='sent' then
  if v.request_id is not null or nullif(p_data->>'request_id','') is null or length(p_data->>'request_id')>256 or nullif(p_data->>'transaction_id','') is null or length(p_data->>'transaction_id')>256 then raise exception 'INVALID_INPUT';end if;
  update public.phone_otp_provider_attempts set request_id=p_data->>'request_id',transaction_id=p_data->>'transaction_id',expires_at=least(expires_at,(p_data->>'expires_at')::timestamptz) where challenge_id=p_challenge;
  return jsonb_build_object('success',true);
 end if;
 if v.request_id is null then return jsonb_build_object('error','NOT_SENT');end if;
 if p_action='check' then
  if v.attempts>=5 then return jsonb_build_object('error','ATTEMPTS');end if;
  update public.phone_otp_provider_attempts set attempts=attempts+1 where challenge_id=p_challenge;
  return jsonb_build_object('request_id',v.request_id,'transaction_id',v.transaction_id,'verified_code_hash',v.verified_code_hash);
 end if;
 if p_action='confirmed' then
  if p_data->>'code_hash' is null or p_data->>'code_hash' !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT';end if;
  update public.phone_otp_provider_attempts set verified_code_hash=p_data->>'code_hash' where challenge_id=p_challenge;
  return jsonb_build_object('success',true);
 end if;
 raise exception 'FORBIDDEN';
end;$$;
