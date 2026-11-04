-- Isolated-project fixture only. No provider request is made; all rows roll back.
begin;
do $$
declare tenant uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();ann uuid:=gen_random_uuid();recipient uuid:=gen_random_uuid();attempt uuid:=gen_random_uuid();r jsonb;msg text:='wamid.fixture.'||gen_random_uuid();
begin
 insert into public.tenants(id,name) values(tenant,'wallet delivery rollback fixture');
 insert into auth.users(id,email) values(owner_id,owner_id||'@fixture.invalid');
 insert into public.users(id,tenant_id,role,email) values(owner_id,tenant,'owner',owner_id||'@fixture.invalid');
 insert into public.wallet_lots(tenant_id,source_key,kind,original_piasters,remaining_piasters) values(tenant,'fixture:'||tenant,'paid',1000,1000);
 insert into public.teacher_announcements(id,tenant_id,created_by,title,group_ids,recipient_roles,manual_body) values(ann,tenant,owner_id,'fixture',array[gen_random_uuid()],array['parent'],'fixture');
 insert into public.announcement_allowances(tenant_id,period,message_limit,reserved,sent,unit_cost_egp) values(tenant,date_trunc('month',now() at time zone 'Africa/Cairo')::date,10,3,0,1);
 insert into public.announcement_recipients(id,tenant_id,announcement_id,revision,queued_by_user_id,queued_actor_name,phone,recipient_role,group_ids,group_names,parameters,rendered_body,status) values(recipient,tenant,ann,1,owner_id,'fixture','201000001111','parent','{}','{}','[]','fixture','sending');
 insert into public.announcement_delivery_attempts(id,tenant_id,recipient_id,period,unit_cost_egp,actor_user_id,actor_name,status) values(attempt,tenant,recipient,date_trunc('month',now() at time zone 'Africa/Cairo')::date,1,owner_id,'fixture','sending');
 update public.announcement_recipients set current_attempt_id=attempt where id=recipient;
 r:=public.commercial_wallet(tenant,'balance',null);
 if(r->>'held_piasters')::integer<>100 or (r->>'paid_piasters')::integer<>900 then raise exception 'QUEUE_HOLD_NOT_CREATED';end if;
 -- A signed delivery callback can precede recording the transport acknowledgement.
 perform public.announcement_worker('delivery',jsonb_build_object('message_id',msg,'status','delivered'));
 perform public.announcement_worker('settle',jsonb_build_object('attempt_id',attempt,'outcome','accepted','message_id',msg));
 r:=public.commercial_wallet(tenant,'balance',null);
 if(r->>'held_piasters')::integer<>0 or (r->>'paid_piasters')::integer<>900 then raise exception 'EARLY_DELIVERY_NOT_RECONCILED';end if;
 if(select status from public.announcement_delivery_attempts where id=attempt)<>'delivered' then raise exception 'DELIVERY_STATUS_LOST';end if;
 perform public.announcement_worker('delivery',jsonb_build_object('message_id',msg,'status','delivered'));
 perform public.announcement_worker('delivery',jsonb_build_object('message_id',msg,'status','read'));
 if(select count(*) from public.wallet_ledger where tenant_id=tenant and kind='debit')<>1 then raise exception 'DUPLICATE_DELIVERY_CHARGE';end if;
 -- A definite failed send releases its reservation.
 recipient:=gen_random_uuid();attempt:=gen_random_uuid();
 insert into public.announcement_recipients(id,tenant_id,announcement_id,revision,queued_by_user_id,queued_actor_name,phone,recipient_role,group_ids,group_names,parameters,rendered_body,status) values(recipient,tenant,ann,1,owner_id,'fixture','201000002222','parent','{}','{}','[]','fixture','sending');
 insert into public.announcement_delivery_attempts(id,tenant_id,recipient_id,period,unit_cost_egp,actor_user_id,actor_name,status) values(attempt,tenant,recipient,date_trunc('month',now() at time zone 'Africa/Cairo')::date,1,owner_id,'fixture','sending');
 update public.announcement_recipients set current_attempt_id=attempt where id=recipient;
 perform public.announcement_worker('settle',jsonb_build_object('attempt_id',attempt,'outcome','not_sent'));
 r:=public.commercial_wallet(tenant,'balance',null);
 if(r->>'held_piasters')::integer<>0 or (r->>'paid_piasters')::integer<>900 then raise exception 'FAILED_SEND_NOT_REFUNDED';end if;
 -- An uncertain outcome is held, never automatically resent or charged twice.
 recipient:=gen_random_uuid();attempt:=gen_random_uuid();
 insert into public.announcement_recipients(id,tenant_id,announcement_id,revision,queued_by_user_id,queued_actor_name,phone,recipient_role,group_ids,group_names,parameters,rendered_body,status) values(recipient,tenant,ann,1,owner_id,'fixture','201000003333','parent','{}','{}','[]','fixture','sending');
 insert into public.announcement_delivery_attempts(id,tenant_id,recipient_id,period,unit_cost_egp,actor_user_id,actor_name,status) values(attempt,tenant,recipient,date_trunc('month',now() at time zone 'Africa/Cairo')::date,1,owner_id,'fixture','sending');
 update public.announcement_recipients set current_attempt_id=attempt where id=recipient;
 perform public.announcement_worker('settle',jsonb_build_object('attempt_id',attempt,'outcome','unknown'));
 r:=public.commercial_wallet(tenant,'balance',null);
 if(r->>'held_piasters')::integer<>100 or (r->>'paid_piasters')::integer<>800 then raise exception 'UNCERTAIN_SEND_RELEASED';end if;
end$$;
rollback;
