-- OTP proof is bound to one invitation, its stored phone and browser origin.
create table public.assistant_phone_verifications (
 invitation_id uuid primary key references public.assistant_invitations(id) on delete cascade,
 challenge_id uuid not null unique,
 code_hash text not null check(code_hash ~ '^[a-f0-9]{64}$'),
 origin text not null,
 expires_at timestamptz not null,
 requested_at timestamptz not null default now(),
 attempts integer not null default 0 check(attempts between 0 and 5),
 delivery_status text not null default 'pending' check(delivery_status in ('pending','sent','failed','uncertain')),
 consumed_at timestamptz,
 verification_claim_hash text check(verification_claim_hash is null or verification_claim_hash ~ '^[a-f0-9]{64}$')
);
alter table public.assistant_phone_verifications enable row level security;
revoke all on public.assistant_phone_verifications from public,anon,authenticated;
grant all on public.assistant_phone_verifications to service_role;

create function public.assistant_registration(p_nonce_hash text,p_origin text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v public.assistant_invitations;a public.assistant_accounts;ch public.assistant_phone_verifications;teacher text;
begin
 select * into v from public.assistant_invitations where nonce_hash=p_nonce_hash;
 if not found then return jsonb_build_object('error','EXPIRED');end if;
 -- Same lock order as acceptance, configuration and password recovery.
 select * into a from public.assistant_accounts where assistant_id=v.assistant_id for update;
 if not found then return jsonb_build_object('error','EXPIRED');end if;
 perform 1 from public.assistants where id=a.assistant_id and tenant_id=a.tenant_id and status in ('active','invited') for update;
 if not found then return jsonb_build_object('error','EXPIRED');end if;
 select * into v from public.assistant_invitations where id=v.id and nonce_hash=p_nonce_hash and expires_at>now() and accepted_at is null and revoked_at is null for update;
 if not found or v.phone<>a.phone or v.tenant_id<>a.tenant_id then return jsonb_build_object('error','EXPIRED');end if;
 select name into teacher from public.tenants where id=a.tenant_id and status='active' and deleted_at is null;
 if not found then return jsonb_build_object('error','EXPIRED');end if;
 if p_action='info' then return jsonb_build_object('tenant_id',a.tenant_id,'teacher_name',teacher,'phone',a.phone,'recovery',a.password_hash is not null);end if;
 if p_action='request' then
  if p_data->>'code_hash' is null or p_data->>'code_hash' !~ '^[a-f0-9]{64}$' or nullif(p_data->>'challenge_id','') is null or coalesce(p_origin,'')='' then raise exception 'INVALID_INPUT';end if;
  select * into ch from public.assistant_phone_verifications where invitation_id=v.id for update;
  if found and ch.requested_at>now()-interval '60 seconds' then return jsonb_build_object('error','WAIT','retry_after',ceil(extract(epoch from ch.requested_at+interval '60 seconds'-now())));end if;
  insert into public.assistant_phone_verifications as existing(invitation_id,challenge_id,code_hash,origin,expires_at)
   values(v.id,(p_data->>'challenge_id')::uuid,p_data->>'code_hash',p_origin,now()+interval '5 minutes')
   on conflict(invitation_id) do update set challenge_id=excluded.challenge_id,code_hash=excluded.code_hash,origin=excluded.origin,expires_at=excluded.expires_at,requested_at=now(),attempts=0,delivery_status='pending',consumed_at=null,verification_claim_hash=null;
  update public.assistant_invitations set claim_hash=null,claim_expires_at=null,verified_at=null where id=v.id;
  return jsonb_build_object('challenge_id',p_data->>'challenge_id','phone',a.phone,'expires_in',300,'retry_after',60);
 end if;
 select * into ch from public.assistant_phone_verifications where invitation_id=v.id and challenge_id=(p_data->>'challenge_id')::uuid and origin=p_origin for update;
 if not found then return jsonb_build_object('error','INVALID_CODE');end if;
 if p_action='delivery' then
  if p_data->>'status' not in ('sent','failed','uncertain') then raise exception 'INVALID_INPUT';end if;
  update public.assistant_phone_verifications set delivery_status=p_data->>'status' where invitation_id=v.id and delivery_status='pending' and consumed_at is null;
  return jsonb_build_object('success',true);
 end if;
 if p_action<>'verify' then raise exception 'FORBIDDEN';end if;
 if ch.expires_at<=now() then return jsonb_build_object('error','CODE_EXPIRED');end if;
 if ch.consumed_at is not null then return jsonb_build_object('error','CODE_USED');end if;
 if ch.attempts>=5 then return jsonb_build_object('error','ATTEMPTS');end if;
 if ch.delivery_status not in ('sent','uncertain') then return jsonb_build_object('error','NOT_SENT');end if;
 if p_data->>'code_hash' is null or ch.code_hash<>p_data->>'code_hash' then
  update public.assistant_phone_verifications set attempts=attempts+1 where invitation_id=v.id;
  return jsonb_build_object('error',case when ch.attempts+1>=5 then 'ATTEMPTS' else 'INVALID_CODE' end,'attempts_left',greatest(0,4-ch.attempts));
 end if;
 if p_data->>'claim_hash' is null or p_data->>'claim_hash' !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT';end if;
 update public.assistant_phone_verifications set consumed_at=now(),verification_claim_hash=p_data->>'claim_hash' where invitation_id=v.id;
 update public.assistant_invitations set claim_hash=p_data->>'claim_hash',verified_at=now(),claim_expires_at=now()+interval '15 minutes' where id=v.id;
 return jsonb_build_object('success',true,'phone',a.phone,'tenant_id',a.tenant_id,'teacher_name',teacher);
end;$$;
revoke execute on function public.assistant_registration(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_registration(text,text,text,jsonb) to service_role;

create function public.assistant_registration_claim(p_claim_hash text,p_origin text) returns jsonb
language sql security invoker set search_path='' as $$
 select jsonb_build_object('phone',v.phone,'tenant_id',v.tenant_id,'teacher_name',t.name)
 from public.assistant_invitations v join public.assistant_phone_verifications ch on ch.invitation_id=v.id
 join public.assistant_accounts a on a.assistant_id=v.assistant_id and a.tenant_id=v.tenant_id and a.phone=v.phone
 join public.assistants s on s.id=a.assistant_id and s.tenant_id=a.tenant_id and s.status in ('active','invited')
 join public.tenants t on t.id=v.tenant_id and t.status='active' and t.deleted_at is null
 where v.claim_hash=p_claim_hash and v.claim_expires_at>now() and v.expires_at>now() and v.revoked_at is null and v.accepted_at is null
 and ch.consumed_at>now()-interval '15 minutes' and ch.origin=p_origin and ch.verification_claim_hash=v.claim_hash;
$$;
revoke execute on function public.assistant_registration_claim(text,text) from public,anon,authenticated;
grant execute on function public.assistant_registration_claim(text,text) to service_role;

create function public.assistant_registration_link(p_tenant uuid,p_assistant uuid,p_nonce_hash text) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.assistant_accounts;v_id uuid;
begin
 select * into a from public.assistant_accounts where assistant_id=p_assistant and tenant_id=p_tenant for update;
 if not found then raise exception 'NOT_FOUND';end if;
 perform 1 from public.assistants where id=a.assistant_id and tenant_id=a.tenant_id and status in ('active','invited') for update;
 if not found then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.tenants where id=p_tenant and status='active' and deleted_at is null) then raise exception 'UNAUTHORIZED';end if;
 if p_nonce_hash is null or p_nonce_hash !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT';end if;
 update public.assistant_invitations set revoked_at=now(),claim_hash=null,claim_expires_at=null where assistant_id=a.assistant_id and accepted_at is null and revoked_at is null;
 insert into public.assistant_invitations(assistant_id,tenant_id,phone,nonce_hash,delivery_status) values(a.assistant_id,a.tenant_id,a.phone,p_nonce_hash,'pending') returning id into v_id;
 return jsonb_build_object('invitation_id',v_id,'tenant_id',a.tenant_id,'phone',a.phone);
end;$$;
revoke execute on function public.assistant_registration_link(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.assistant_registration_link(uuid,uuid,text) to service_role;

create table public.teacher_phone_verifications (
 user_id uuid primary key references public.users(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 phone text not null check(phone ~ '^[1-9][0-9]{7,14}$'),
 challenge_id uuid not null unique,code_hash text not null check(code_hash ~ '^[a-f0-9]{64}$'),origin text not null,
 expires_at timestamptz not null,requested_at timestamptz not null default now(),
 attempts integer not null default 0 check(attempts between 0 and 5),
 delivery_status text not null default 'pending' check(delivery_status in ('pending','sent','failed','uncertain')),
 confirmed_at timestamptz
);
alter table public.teacher_phone_verifications enable row level security;
revoke all on public.teacher_phone_verifications from public,anon,authenticated;
grant all on public.teacher_phone_verifications to service_role;

create function public.teacher_phone_verification(p_user uuid,p_tenant uuid,p_origin text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_phone text;ch public.teacher_phone_verifications;
begin
 select public.parent_family_phone(u.phone) into v_phone from public.users u join public.tenants t on t.id=u.tenant_id and t.status='active' and t.deleted_at is null
 where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner','admin') for update of u;
 if not found then raise exception 'UNAUTHORIZED';end if;
 if v_phone is null then return jsonb_build_object('error','NO_PHONE');end if;
 select * into ch from public.teacher_phone_verifications where user_id=p_user for update;
 if p_action='info' then return jsonb_build_object('phone',v_phone,'verified',coalesce(ch.phone=v_phone and ch.confirmed_at is not null,false));end if;
 if p_action='request' then
  if p_data->>'code_hash' is null or p_data->>'code_hash' !~ '^[a-f0-9]{64}$' or nullif(p_data->>'challenge_id','') is null or coalesce(p_origin,'')='' then raise exception 'INVALID_INPUT';end if;
  if ch.user_id is not null and ch.requested_at>now()-interval '60 seconds' then return jsonb_build_object('error','WAIT','retry_after',ceil(extract(epoch from ch.requested_at+interval '60 seconds'-now())));end if;
  insert into public.teacher_phone_verifications(user_id,tenant_id,phone,challenge_id,code_hash,origin,expires_at)
   values(p_user,p_tenant,v_phone,(p_data->>'challenge_id')::uuid,p_data->>'code_hash',p_origin,now()+interval '5 minutes')
   on conflict(user_id) do update set tenant_id=excluded.tenant_id,phone=excluded.phone,challenge_id=excluded.challenge_id,code_hash=excluded.code_hash,origin=excluded.origin,expires_at=excluded.expires_at,requested_at=now(),attempts=0,delivery_status='pending',confirmed_at=null;
  return jsonb_build_object('challenge_id',p_data->>'challenge_id','phone',v_phone,'expires_in',300,'retry_after',60);
 end if;
 if ch.user_id is null or ch.challenge_id is distinct from (p_data->>'challenge_id')::uuid or ch.origin is distinct from p_origin or ch.phone is distinct from v_phone then return jsonb_build_object('error','INVALID_CODE');end if;
 if p_action='delivery' then
  if p_data->>'status' not in ('sent','failed','uncertain') then raise exception 'INVALID_INPUT';end if;
  update public.teacher_phone_verifications set delivery_status=p_data->>'status' where user_id=p_user and delivery_status='pending' and confirmed_at is null;
  return jsonb_build_object('success',true);
 end if;
 if p_action<>'verify' then raise exception 'FORBIDDEN';end if;
 if ch.expires_at<=now() then return jsonb_build_object('error','CODE_EXPIRED');end if;
 if ch.confirmed_at is not null then return jsonb_build_object('error','CODE_USED');end if;
 if ch.attempts>=5 then return jsonb_build_object('error','ATTEMPTS');end if;
 if ch.delivery_status not in ('sent','uncertain') then return jsonb_build_object('error','NOT_SENT');end if;
 if p_data->>'code_hash' is null or ch.code_hash<>p_data->>'code_hash' then
  update public.teacher_phone_verifications set attempts=attempts+1 where user_id=p_user;
  return jsonb_build_object('error',case when ch.attempts+1>=5 then 'ATTEMPTS' else 'INVALID_CODE' end,'attempts_left',greatest(0,4-ch.attempts));
 end if;
 update public.teacher_phone_verifications set confirmed_at=now() where user_id=p_user;
 return jsonb_build_object('verified',true,'phone',v_phone);
end;$$;
revoke execute on function public.teacher_phone_verification(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.teacher_phone_verification(uuid,uuid,text,text,jsonb) to service_role;

create table public.phone_otp_daily_budget(day date primary key,used integer not null check(used>0));
alter table public.phone_otp_daily_budget enable row level security;
revoke all on public.phone_otp_daily_budget from public,anon,authenticated;
grant all on public.phone_otp_daily_budget to service_role;
create function public.phone_otp_reserve(p_limit integer) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_used integer;
begin
 if p_limit<1 or p_limit>5000 or p_limit is null then return false;end if;
 insert into public.phone_otp_daily_budget as b(day,used) values((now() at time zone 'UTC')::date,1)
 on conflict(day) do update set used=b.used+1 where b.used<p_limit returning used into v_used;
 return v_used is not null;
end;$$;
revoke execute on function public.phone_otp_reserve(integer) from public,anon,authenticated;
grant execute on function public.phone_otp_reserve(integer) to service_role;
