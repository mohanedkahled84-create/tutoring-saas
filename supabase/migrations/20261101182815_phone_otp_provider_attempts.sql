create table public.phone_otp_provider_attempts (
 challenge_id uuid primary key,
 purpose text not null check(purpose in ('assistant','teacher')),
 subject text not null,
 invitation_id uuid references public.assistant_invitations(id) on delete cascade,
 user_id uuid references public.users(id) on delete cascade,
 origin text not null,
 phone text not null check(phone ~ '^[1-9][0-9]{7,14}$'),
 request_id text unique,
 transaction_id text,
 expires_at timestamptz not null,
 attempts integer not null default 0 check(attempts between 0 and 5),
 verified_code_hash text check(verified_code_hash is null or verified_code_hash ~ '^[a-f0-9]{64}$'),
 check((purpose='assistant' and invitation_id is not null and user_id is null) or (purpose='teacher' and user_id is not null and invitation_id is null))
);
alter table public.phone_otp_provider_attempts enable row level security;
revoke all on public.phone_otp_provider_attempts from public,anon,authenticated;
grant all on public.phone_otp_provider_attempts to service_role;
create index phone_otp_provider_invitation_idx on public.phone_otp_provider_attempts(invitation_id) where invitation_id is not null;
create index phone_otp_provider_user_idx on public.phone_otp_provider_attempts(user_id) where user_id is not null;

create function public.phone_otp_provider_attempt(p_challenge uuid,p_purpose text,p_subject text,p_origin text,p_phone text,p_action text,p_data jsonb default '{}') returns jsonb
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
revoke execute on function public.phone_otp_provider_attempt(uuid,text,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.phone_otp_provider_attempt(uuid,text,text,text,text,text,jsonb) to service_role;
