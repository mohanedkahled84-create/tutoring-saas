alter table public.phone_otp_provider_attempts add column if not exists delivery_channel text not null default 'sms' check(delivery_channel in ('sms','whatsapp'));
do $patch$
declare definition text;
begin
 definition:=pg_get_functiondef('public.phone_otp_provider_attempt(uuid,text,text,text,text,text,jsonb)'::regprocedure);
 if position('if v.request_id is null then' in definition)=0 then raise exception 'Unexpected phone OTP function definition';end if;
 definition:=replace(definition,'if v.request_id is null then', $code$
 if p_action='whatsapp_fallback' then
  update public.phone_otp_provider_attempts set delivery_channel='whatsapp',request_id=null,transaction_id=null,verified_code_hash=null where challenge_id=p_challenge;
  return jsonb_build_object('success',true);
 end if;
 if p_action='check' and v.delivery_channel='whatsapp' then
  if v.attempts>=5 then return jsonb_build_object('error','ATTEMPTS');end if;
  update public.phone_otp_provider_attempts set attempts=attempts+1 where challenge_id=p_challenge;
  return jsonb_build_object('delivery_channel','whatsapp');
 end if;
 if v.request_id is null then$code$);
 execute definition;
end $patch$;
