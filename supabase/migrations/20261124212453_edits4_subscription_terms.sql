-- Approved periods: 30 days, six calendar months (-15%), twelve calendar months (-25%).
alter table public.commercial_subscription_periods add column if not exists cycle_months integer not null default 1 check(cycle_months in (1,6,12));
alter table public.commercial_subscription_periods add column if not exists discount_pct integer not null default 0 check(discount_pct in (0,15,25));
create or replace function public.subscription_operation(p_user uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor public.users;t public.tenants;s public.commercial_subscriptions;p public.subscription_plans;old_plan public.subscription_plans;
 o public.subscription_orders;proof public.payment_proofs;v_tenant uuid;v_id uuid;v_kind text;v_quantity integer;v_amount integer;v_unit integer;
 v_months integer;v_discount integer;v_monthly integer;v_cycle public.commercial_subscription_periods;v_ratio numeric;v_gift integer;v_start timestamptz;v_end timestamptz;v_addons jsonb;v_limits jsonb;v_key text;v_lot uuid;v_result jsonb;
begin
 select * into actor from public.users where id=p_user;
 if actor.id is null or actor.assistant_id is not null or actor.role not in ('owner','teacher','center_owner','admin') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 v_tenant:=case when actor.role='admin' then nullif(p_data->>'tenant_id','')::uuid else actor.tenant_id end;
 if p_action='catalog' then return (select jsonb_agg(to_jsonb(x) order by rank) from public.subscription_plans x where enabled);end if;
 if p_action='admin_orders' then
  if actor.role<>'admin' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  return coalesce((select jsonb_agg(to_jsonb(x)) from (select o.*,t.name tenant_name from public.subscription_orders o join public.tenants t on t.id=o.tenant_id order by o.created_at desc limit 200) x),'[]');
 end if;
 if actor.role='admin' and p_action in ('approve','reject') then select tenant_id into v_tenant from public.subscription_orders where id=nullif(p_data->>'id','')::uuid;end if;
 if v_tenant is null then raise exception 'FORBIDDEN' using errcode='42501';end if;
 perform pg_advisory_xact_lock(hashtextextended(v_tenant::text||':commercial',0));
 select * into t from public.tenants where id=v_tenant for update;
 if t.id is null or t.deleted_at is not null or t.status='deactivated' then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into s from public.commercial_subscriptions where tenant_id=v_tenant for update;
 v_limits:=public.commercial_limits(v_tenant);
 select * into v_cycle from public.commercial_subscription_periods where tenant_id=v_tenant and starts_at<=now() and ends_at>now() order by starts_at desc limit 1;
 if p_action='overview' then
  return jsonb_build_object('limits',v_limits||jsonb_build_object('cycle_months',coalesce(v_cycle.cycle_months,1),'discount_pct',coalesce(v_cycle.discount_pct,0)),'students_used',(select count(*) from public.students where tenant_id=v_tenant and archived_at is null),
   'assistants_used',(select count(*) from public.assistants where tenant_id=v_tenant and coalesce(status,'active') not in ('inactive','revoked','deleted')),
   'storage_bytes_used',public.commercial_storage_usage(v_tenant),
   'wallet',public.commercial_wallet(v_tenant,'balance',null),
   'periods',coalesce((select jsonb_agg(to_jsonb(x)) from (select plan_id,starts_at,ends_at,addons from public.commercial_subscription_periods where tenant_id=v_tenant and ends_at>now() order by starts_at)x),'[]'),
   'addons',coalesce((select jsonb_agg(to_jsonb(a)) from public.subscription_addons a where tenant_id=v_tenant),'[]'),
   'orders',coalesce((select jsonb_agg(to_jsonb(x)) from (select * from public.subscription_orders where tenant_id=v_tenant and state in ('submitted','approved','rejected') order by created_at desc limit 50)x),'[]'),
   'ledger',coalesce((select jsonb_agg(to_jsonb(x)) from (select kind,amount_piasters,details,created_at from public.wallet_ledger where tenant_id=v_tenant order by created_at desc limit 100)x),'[]'));
 end if;
 if p_action='schedule_plan' then
  select * into p from public.subscription_plans where id=p_data->>'plan_id' and enabled;
  if p.id is null or s.tenant_id is null then raise exception 'INVALID_PLAN' using errcode='22023';end if;
  update public.commercial_subscriptions set next_plan_id=p.id,updated_at=now() where tenant_id=v_tenant;
  return jsonb_build_object('scheduled_plan_id',p.id,'effective_after',s.period_end);
 elsif p_action in ('cancel_addon','resume_addon') then
  if coalesce(p_data->>'kind','') not in ('students','assistants','storage') then raise exception 'INVALID_ADDON' using errcode='22023';end if;
  update public.subscription_addons set cancel_on_renew=(p_action='cancel_addon') where tenant_id=v_tenant and kind=p_data->>'kind';
  update public.commercial_subscriptions set updated_at=clock_timestamp() where tenant_id=v_tenant;
  return jsonb_build_object('effective_after',s.period_end);
 end if;
 v_id:=nullif(p_data->>'id','')::uuid;
 if v_id is null then raise exception 'INVALID_ID' using errcode='22023';end if;
 select * into o from public.subscription_orders where id=v_id for update;
 if o.id is not null and o.tenant_id<>v_tenant then raise exception 'ORDER_CONFLICT' using errcode='23514';end if;
 if p_action='quote' then
  if o.id is not null then return to_jsonb(o);end if;
  if (select count(*) from public.subscription_orders where tenant_id=v_tenant and created_at>now()-interval '10 minutes')>=30 then raise exception 'RATE_LIMIT' using errcode='23514';end if;
  v_months:=coalesce((p_data->>'cycle_months')::integer,1);
  if v_months not in (1,6,12) or (coalesce(p_data->>'kind','') not in ('subscribe','renew') and v_months<>1) then raise exception 'INVALID_CYCLE' using errcode='22023';end if;
  v_discount:=case v_months when 6 then 15 when 12 then 25 else 0 end;
  v_kind:=p_data->>'kind';v_quantity:=coalesce((p_data->>'quantity')::integer,1);
  if v_quantity<1 or v_quantity>(case when v_kind='wallet' then 10000000 else 10000 end) or v_kind not in ('subscribe','renew','upgrade','students','assistants','storage','wallet') then raise exception 'INVALID_ORDER' using errcode='22023';end if;
  select * into p from public.subscription_plans where id=case when v_kind in ('subscribe','upgrade') then p_data->>'plan_id' when v_kind='renew' then coalesce(s.next_plan_id,s.plan_id,p_data->>'plan_id') else coalesce(v_limits->>'plan_id',s.plan_id,p_data->>'plan_id') end and enabled;
  if p.id is null then raise exception 'INVALID_PLAN' using errcode='22023';end if;
  select coalesce(jsonb_object_agg(kind,quantity),'{}') into v_addons from public.subscription_addons where tenant_id=v_tenant and (v_kind not in ('subscribe','renew') or not cancel_on_renew);
  if v_kind in ('students','assistants','storage','upgrade') then v_addons:=coalesce(v_limits->'addons','{}');end if;
  if v_kind='subscribe' then
   -- A trial/legacy teacher may already exceed a new base tier. Quote the
   -- minimum required capacity explicitly instead of forcing data removal.
   v_addons:=v_addons||jsonb_build_object(
    'students',greatest(coalesce((v_addons->>'students')::integer,0),(select count(*)::integer from public.students where tenant_id=v_tenant and archived_at is null)-p.students,0),
    'assistants',greatest(coalesce((v_addons->>'assistants')::integer,0),(select count(*)::integer from public.assistants where tenant_id=v_tenant and coalesce(status,'active') not in ('inactive','revoked','deleted'))-p.assistants,0),
    'storage',greatest(coalesce((v_addons->>'storage')::integer,0),ceil(greatest(0,public.commercial_storage_usage(v_tenant)-p.storage_bytes)::numeric/5000000000)::integer)
   );
  end if;
  if v_kind='wallet' then
   v_amount:=v_quantity;
   if v_amount not between 5000 and 10000000 then raise exception 'MINIMUM_TOPUP_50' using errcode='22023';end if;
  elsif v_kind in ('students','assistants','storage') then
   if s.tenant_id is null or not (v_limits->>'active')::boolean or t.subscription_status<>'active' then raise exception 'SUBSCRIPTION_REQUIRED' using errcode='23514';end if;
   v_unit:=case when v_kind='students' then p.student_piasters else 5000 end;
   v_ratio:=greatest(0,extract(epoch from((v_limits->>'period_end')::timestamptz-now()))/2592000.0);
   v_amount:=greatest(case when v_kind='students' then 60*v_quantity else 1 end,round(v_quantity*v_unit*v_ratio)::integer);
   v_addons:=jsonb_set(v_addons,array[v_kind],to_jsonb(coalesce((v_addons->>v_kind)::integer,0)+v_quantity));
  elsif v_kind='upgrade' then
   if s.tenant_id is null or not (v_limits->>'active')::boolean or t.subscription_status<>'active' then raise exception 'SUBSCRIPTION_REQUIRED' using errcode='23514';end if;
   select * into old_plan from public.subscription_plans where id=v_limits->>'plan_id';
   if p.rank<=old_plan.rank then raise exception 'USE_SCHEDULED_DOWNGRADE' using errcode='23514';end if;
   v_ratio:=greatest(0,extract(epoch from((v_limits->>'period_end')::timestamptz-now()))/2592000.0);
   v_amount:=round(((p.price_piasters-old_plan.price_piasters)*(100-coalesce(v_cycle.discount_pct,0))/100.0+coalesce((v_addons->>'students')::integer,0)*(p.student_piasters-old_plan.student_piasters))*v_ratio)::integer;
   -- Upgrades cannot silently turn an old prepaid addon into a negative bill.
   v_amount:=greatest(0,v_amount);
  else
   if v_kind='subscribe' and s.tenant_id is not null and s.period_end>now() and t.subscription_status<>'trial' then raise exception 'USE_RENEW_OR_UPGRADE' using errcode='23514';end if;
   v_amount:=p.price_piasters+coalesce((v_addons->>'students')::integer,0)*p.student_piasters+coalesce((v_addons->>'assistants')::integer,0)*5000+coalesce((v_addons->>'storage')::integer,0)*5000;
  end if;
  if v_kind in ('subscribe','renew') then
   v_monthly:=v_amount;
   v_amount:=round((v_monthly-p.price_piasters)*v_months+p.price_piasters*v_months*(100-v_discount)/100.0)::integer;
  end if;
  if v_kind<>'wallet' and (
   (select count(*) from public.students where tenant_id=v_tenant and archived_at is null)>p.students+coalesce((v_addons->>'students')::integer,0)
   or (select count(*) from public.assistants where tenant_id=v_tenant and coalesce(status,'active') not in ('inactive','revoked','deleted'))>p.assistants+coalesce((v_addons->>'assistants')::integer,0)
   or public.commercial_storage_usage(v_tenant)>p.storage_bytes+coalesce((v_addons->>'storage')::bigint,0)*5000000000
  ) then raise exception 'USAGE_EXCEEDS_PLAN' using errcode='23514';end if;
  insert into public.subscription_orders(id,tenant_id,created_by,kind,plan_id,quantity,amount_piasters,snapshot,quoted_until)
   values(v_id,v_tenant,p_user,v_kind,p.id,v_quantity,v_amount,jsonb_build_object('plan',to_jsonb(p),'addons',v_addons,'period_end',s.period_end,'subscription_updated_at',s.updated_at,'minimum_first_student_piasters',60,'billing',jsonb_build_object('cycle_months',v_months,'discount_pct',v_discount,'monthly_piasters',v_monthly,'before_discount_piasters',v_monthly*v_months)),now()+interval '15 minutes') returning * into o;
  return to_jsonb(o);
 elsif p_action='submit' then
  if o.id is null then raise exception 'ORDER_NOT_FOUND' using errcode='P0002';end if;
  if o.state in ('submitted','approved') then return to_jsonb(o);end if;
  if o.state<>'quoted' or o.quoted_until<now() then raise exception 'QUOTE_EXPIRED' using errcode='23514';end if;
  if coalesce(p_data->>'payment_method','') not in ('instapay','vodafone_cash') or length(btrim(coalesce(p_data->>'reference','')))<3 then raise exception 'PAYMENT_REFERENCE_REQUIRED' using errcode='22023';end if;
  insert into public.payment_proofs(tenant_id,submitted_by,amount,payment_method,reference_number,proof_image_url,admin_notes,status)
   values(v_tenant,p_user,o.amount_piasters/100.0,p_data->>'payment_method',left(p_data->>'reference',100),p_data->>'proof_image_url','[order:'||o.id||'] '||o.kind||' / '||o.plan_id,'pending') returning * into proof;
  update public.subscription_orders set proof_id=proof.id,state='submitted' where id=o.id returning * into o;
  return to_jsonb(o);
 elsif p_action in ('approve','reject') then
  if actor.role<>'admin' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if o.id is null or o.state not in ('submitted','approved','rejected') then raise exception 'ORDER_NOT_SUBMITTED' using errcode='23514';end if;
  if o.state in ('approved','rejected') then return to_jsonb(o);end if;
  if p_action='reject' then
   update public.payment_proofs set status='rejected',reviewed_by=p_user,reviewed_at=now() where id=o.proof_id;
   update public.subscription_orders set state='rejected',approved_by=p_user,approved_at=now() where id=o.id returning * into o;
   return to_jsonb(o);
  end if;
  select * into p from public.subscription_plans where id=o.plan_id;
  if to_jsonb(p) is distinct from o.snapshot->'plan' then raise exception 'PRICE_CHANGED' using errcode='23514';end if;
  if o.kind<>'wallet' and s.updated_at is distinct from nullif(o.snapshot->>'subscription_updated_at','')::timestamptz then raise exception 'SUBSCRIPTION_CHANGED' using errcode='23514';end if;
  v_addons:=o.snapshot->'addons';
  if o.kind='wallet' then
   v_key:='topup:'||o.id;
   insert into public.wallet_lots(tenant_id,source_key,kind,original_piasters,remaining_piasters) values(v_tenant,v_key,'paid',o.amount_piasters,o.amount_piasters) returning id into v_lot;
   insert into public.wallet_ledger(tenant_id,lot_id,event_key,kind,amount_piasters) values(v_tenant,v_lot,v_key,'topup',o.amount_piasters);
  else
   if o.kind in ('students','assistants','storage','upgrade') and (s.period_end<=now() or s.tenant_id is null) then raise exception 'SUBSCRIPTION_CHANGED' using errcode='23514';end if;
   if (select count(*) from public.students where tenant_id=v_tenant and archived_at is null)>p.students+coalesce((v_addons->>'students')::integer,0)
    or (select count(*) from public.assistants where tenant_id=v_tenant and coalesce(status,'active') not in ('inactive','revoked','deleted'))>p.assistants+coalesce((v_addons->>'assistants')::integer,0)
    or public.commercial_storage_usage(v_tenant)>p.storage_bytes+coalesce((v_addons->>'storage')::bigint,0)*5000000000 then raise exception 'USAGE_EXCEEDS_PLAN' using errcode='23514';end if;
   v_start:=case when o.kind='subscribe' and t.subscription_status='trial' then now() when o.kind in ('subscribe','renew') then greatest(now(),coalesce(s.period_end,now())) else (v_limits->>'period_start')::timestamptz end;
   v_months:=coalesce((o.snapshot#>>'{billing,cycle_months}')::integer,1);v_discount:=coalesce((o.snapshot#>>'{billing,discount_pct}')::integer,0);
   if v_months not in (1,6,12) or v_discount<>(case v_months when 6 then 15 when 12 then 25 else 0 end) then raise exception 'INVALID_CYCLE' using errcode='22023';end if;
   v_end:=case when o.kind in ('subscribe','renew') then case when v_months=1 then v_start+interval '30 days' else v_start+make_interval(months=>v_months) end else (v_limits->>'period_end')::timestamptz end;
   v_gift:=greatest(0,p.initial_gift_piasters-coalesce(s.initial_gift_awarded,0));
   if v_gift=0 and o.kind in ('subscribe','renew') then v_gift:=p.renewal_gift_piasters;end if;
   -- Existing gift is already valid for an early-paid period; a new period's
   -- gift becomes spendable at its start, tracked through created_at below.
   insert into public.commercial_subscriptions(tenant_id,plan_id,period_start,period_end,initial_gift_awarded,updated_at)
    values(v_tenant,case when o.kind in ('students','assistants','storage','upgrade') and s.period_end>v_end then s.plan_id else p.id end,coalesce(s.period_start,v_start),greatest(coalesce(s.period_end,v_end),v_end),greatest(p.initial_gift_piasters,coalesce(s.initial_gift_awarded,0)),clock_timestamp())
    on conflict(tenant_id) do update set plan_id=excluded.plan_id,period_start=excluded.period_start,period_end=excluded.period_end,initial_gift_awarded=excluded.initial_gift_awarded,next_plan_id=case when o.kind in ('subscribe','renew') then null else public.commercial_subscriptions.next_plan_id end,updated_at=excluded.updated_at;
   insert into public.commercial_subscription_periods(tenant_id,plan_id,starts_at,ends_at,addons,cycle_months,discount_pct) values(v_tenant,p.id,v_start,v_end,v_addons,case when o.kind in ('subscribe','renew') then v_months else coalesce(v_cycle.cycle_months,1) end,case when o.kind in ('subscribe','renew') then v_discount else coalesce(v_cycle.discount_pct,0) end)
    on conflict(tenant_id,starts_at) do update set plan_id=excluded.plan_id,addons=excluded.addons;
   for v_kind,v_quantity in select key,value::integer from jsonb_each_text(v_addons) loop
    insert into public.subscription_addons(tenant_id,kind,quantity,cancel_on_renew) values(v_tenant,v_kind,v_quantity,false)
     on conflict(tenant_id,kind) do update set quantity=excluded.quantity,cancel_on_renew=case when o.kind in ('subscribe','renew') then false else public.subscription_addons.cancel_on_renew end;
   end loop;
   delete from public.subscription_addons where tenant_id=v_tenant and not (v_addons ? kind);
   update public.tenants set subscription_status='active',subscription_tier=case when v_start>now() then subscription_tier else p.id end,subscription_ends_at=greatest(coalesce(s.period_end,v_end),v_end),settings=case when v_start>now() then settings else coalesce(settings,'{}')||jsonb_build_object('commercial_plan_id',p.id,'students_limit',p.students+coalesce((v_addons->>'students')::integer,0),'plan_name',p.name) end where id=v_tenant;
   if v_gift>0 then
    v_key:='gift:'||o.id;
    insert into public.wallet_lots(tenant_id,source_key,kind,original_piasters,remaining_piasters,created_at,expires_at) values(v_tenant,v_key,'gift',v_gift,v_gift,v_start,v_end) returning id into v_lot;
    insert into public.wallet_ledger(tenant_id,lot_id,event_key,kind,amount_piasters,details) values(v_tenant,v_lot,v_key,'gift',v_gift,jsonb_build_object('order_id',o.id,'expires_at',v_end));
   end if;
  end if;
  update public.payment_proofs set status='approved',reviewed_by=p_user,reviewed_at=now() where id=o.proof_id;
  update public.subscription_orders set state='approved',approved_by=p_user,approved_at=now() where id=o.id returning * into o;
  return to_jsonb(o);
 end if;
 raise exception 'INVALID_ACTION' using errcode='22023';
end$$;
revoke all on function public.subscription_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.subscription_operation(uuid,text,jsonb) to service_role;
