create table public.meta_dispatch_budget (
 singleton boolean primary key default true check(singleton),recipient_limit integer not null default 250 check(recipient_limit between 1 and 1000000),
 updated_at timestamptz not null default now(),source text not null default 'WhatsApp Manager verified 2026-11-04'
);
insert into public.meta_dispatch_budget(singleton) values(true);
create table public.meta_dispatch_reservations (
 id uuid primary key,tenant_id uuid references public.tenants(id) on delete set null,phone text not null,
 state text not null default 'reserved' check(state in ('reserved','accepted','unknown','not_sent')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index meta_dispatch_window on public.meta_dispatch_reservations(created_at,phone) where state<>'not_sent';
create table public.meta_dispatch_turns(tenant_id uuid primary key references public.tenants(id) on delete cascade,last_granted timestamptz not null default now());
alter table public.meta_dispatch_budget enable row level security;
alter table public.meta_dispatch_reservations enable row level security;
alter table public.meta_dispatch_turns enable row level security;
revoke all on public.meta_dispatch_budget,public.meta_dispatch_reservations,public.meta_dispatch_turns from public,anon,authenticated;
grant all on public.meta_dispatch_budget,public.meta_dispatch_reservations,public.meta_dispatch_turns to service_role;

create function public.meta_budget_try(p_id uuid,p_tenant uuid,p_phone text,p_fair boolean default true) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare v_phone text:=public.canonical_student_phone(p_phone);cap integer;old_row public.meta_dispatch_reservations;next_at timestamptz;chosen uuid;
begin
 if p_id is null or v_phone is null or v_phone !~ '^[1-9][0-9]{9,14}$' then raise exception 'INVALID_RECIPIENT' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended('centrly-meta-global-rolling-budget',0));
 select * into old_row from public.meta_dispatch_reservations where id=p_id;
 if old_row.id is not null then
  if old_row.tenant_id is distinct from p_tenant or old_row.phone<>v_phone then raise exception 'DISPATCH_CONFLICT' using errcode='23514';end if;
  return jsonb_build_object('allowed',old_row.state<>'not_sent','already_reserved',true);
 end if;
 select recipient_limit into cap from public.meta_dispatch_budget where singleton;
 if cap is null then raise exception 'BUDGET_NOT_CONFIGURED' using errcode='23514';end if;
 if p_fair and p_tenant is not null then
  select queued.tenant_id into chosen from (
   select distinct tenant_id from public.announcement_recipients where status='queued'
   union select distinct tenant_id::uuid from public.meta_portal_dispatch_queue where status in ('pending','queued') and scheduled_date<=current_date
  ) queued left join public.meta_dispatch_turns turns on turns.tenant_id=queued.tenant_id order by turns.last_granted nulls first,queued.tenant_id limit 1;
  if chosen is not null and chosen<>p_tenant then return jsonb_build_object('allowed',false,'next_at',now()+interval '30 seconds','reason','FAIR_TURN');end if;
 end if;
 if not exists(select 1 from public.meta_dispatch_reservations where state<>'not_sent' and created_at>now()-interval '24 hours' and meta_dispatch_reservations.phone=v_phone)
  and (select count(distinct meta_dispatch_reservations.phone) from public.meta_dispatch_reservations where state<>'not_sent' and created_at>now()-interval '24 hours')>=cap then
  select min(created_at)+interval '24 hours' into next_at from public.meta_dispatch_reservations where state<>'not_sent' and created_at>now()-interval '24 hours';
  return jsonb_build_object('allowed',false,'next_at',next_at,'reason','CAPACITY');
 end if;
 insert into public.meta_dispatch_reservations(id,tenant_id,phone) values(p_id,p_tenant,v_phone);
 if p_tenant is not null then insert into public.meta_dispatch_turns(tenant_id,last_granted) values(p_tenant,clock_timestamp()) on conflict(tenant_id) do update set last_granted=excluded.last_granted;end if;
 return jsonb_build_object('allowed',true);
end$$;
create function public.meta_budget_settle(p_id uuid,p_state text) returns void
language plpgsql security invoker set search_path='' as $$
begin
 if p_state not in ('accepted','unknown','not_sent') then raise exception 'INVALID_OUTCOME' using errcode='22023';end if;
 update public.meta_dispatch_reservations set state=p_state,updated_at=now() where id=p_id and state in ('reserved','unknown');
end$$;
revoke all on function public.meta_budget_try(uuid,uuid,text,boolean),public.meta_budget_settle(uuid,text) from public,anon,authenticated;
grant execute on function public.meta_budget_try(uuid,uuid,text,boolean),public.meta_budget_settle(uuid,text) to service_role;

create function public.announcement_wallet_settle() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if tg_op='INSERT' then
  perform public.commercial_wallet(new.tenant_id,'reserve',new.id,100);
 elsif new.status in ('delivered','read') and new.status is distinct from old.status then
  if exists(select 1 from public.wallet_holds where id=new.id and state='held') then perform public.commercial_wallet(new.tenant_id,'debit',new.id);end if;
 elsif new.status in ('failed','skipped') and new.status is distinct from old.status then
  if exists(select 1 from public.wallet_holds where id=new.id and state='held') then perform public.commercial_wallet(new.tenant_id,'release',new.id);end if;
 end if;
 return new;
end$$;
revoke all on function public.announcement_wallet_settle() from public,anon,authenticated;
create trigger announcement_wallet_settle after insert or update on public.announcement_delivery_attempts for each row execute function public.announcement_wallet_settle();

-- Preserve the reviewed audience/template/source checks and lease semantics.
-- Fail migration rather than silently patching a changed function contract.
do $$declare source text;anchor text;begin
 select pg_get_functiondef('public.announcement_queue(uuid,uuid,uuid,text,jsonb)'::regprocedure) into source;
 anchor:='select * into allowance from public.announcement_allowances where tenant_id=p_tenant and period=month_start for update;';
 if strpos(source,anchor)=0 then raise exception 'QUEUE_CONTRACT_CHANGED';end if;
 source:=replace(source,anchor,$patch$
 if not exists(select 1 from public.tenants where id=p_tenant and subscription_status='active' and subscription_ends_at>now()) then raise exception 'SUBSCRIPTION_REQUIRED' using errcode='23514';end if;
 insert into public.announcement_allowances(tenant_id,period,message_limit,unit_cost_egp) values(p_tenant,month_start,1000000,1)
 on conflict(tenant_id,period) do update set message_limit=1000000,unit_cost_egp=1;
 select * into allowance from public.announcement_allowances where tenant_id=p_tenant and period=month_start for update;
 $patch$);
 execute source;
 select pg_get_functiondef('public.announcement_worker(text,jsonb)'::regprocedure) into source;
 anchor:='if reason is null and attempt.period<>month_start then reason:=''BILLING_PERIOD_CHANGED'';end if;';
 if strpos(source,anchor)=0 then raise exception 'WORKER_CONTRACT_CHANGED';end if;
 source:=replace(source,anchor,'-- Monetary holds survive calendar-month boundaries.');
 anchor:='update public.announcement_delivery_attempts set status=''sending'',lease_until=now()+interval ''2 minutes'',updated_at=now() where id=attempt.id;';
 if strpos(source,anchor)=0 then raise exception 'WORKER_CLAIM_CHANGED';end if;
 source:=replace(source,anchor,$patch$
 if not coalesce((public.meta_budget_try(attempt.id,tenant,rec.phone)->>'allowed')::boolean,false) then continue;end if;
 update public.announcement_delivery_attempts set status='sending',lease_until=now()+interval '2 minutes',updated_at=now() where id=attempt.id;
 $patch$);
 source:=replace(source,'jsonb_build_object(''attempt_id'',attempt.id,''to'',rec.phone','jsonb_build_object(''attempt_id'',attempt.id,''tenant_id'',tenant,''to'',rec.phone');
 execute source;
end$$;

create or replace function public.portal_onboarding_claim_queue_limited(p_queue_id uuid,p_daily_limit integer default 250) returns boolean
language plpgsql set search_path='' as $$
declare item public.meta_portal_dispatch_queue;v_key text;lim jsonb;
begin
 select * into item from public.meta_portal_dispatch_queue where id=p_queue_id for update;
 if item.id is null or item.status not in ('pending','queued') or not exists(select 1 from public.portal_onboarding_deliveries where queue_id=item.id and send_started_at is null) then return false;end if;
 lim:=public.commercial_limits(item.tenant_id::uuid);
 if not coalesce((lim->>'legacy')::boolean,true) and ((lim->>'is_trial')::boolean or not(lim->>'active')::boolean) then return false;end if;
 if not coalesce((public.meta_budget_try(item.id,item.tenant_id::uuid,item.recipient_phone)->>'allowed')::boolean,false) then return false;end if;
 update public.portal_onboarding_deliveries d set send_started_at=now()
 where d.queue_id=p_queue_id and d.send_started_at is null
 and exists(select 1 from public.meta_portal_dispatch_queue q join public.students s on s.id=q.student_id and s.tenant_id::text=q.tenant_id
  join public.tenants t on t.id=s.tenant_id and t.status='active' and t.deleted_at is null
  where q.id=p_queue_id and q.status in ('pending','queued') and q.tenant_id=d.tenant_id::text
  and public.parent_family_phone(q.recipient_phone)=public.parent_family_phone(case when q.recipient_type='parent' then s.parent_phone else s.student_phone end))
 returning recipient_key into v_key;
 if v_key is null then perform public.meta_budget_settle(item.id,'not_sent');end if;
 return v_key is not null;
end$$;

create function public.meta_pending_fair(p_limit integer default 100) returns setof public.meta_portal_dispatch_queue
language sql security invoker set search_path='' as $$
 select q from public.meta_portal_dispatch_queue q join (
  select id,row_number() over(partition by tenant_id order by created_at,id) turn from public.meta_portal_dispatch_queue
  where status in ('pending','queued') and scheduled_date<=(now() at time zone 'UTC')::date
 ) ranked on ranked.id=q.id left join public.meta_dispatch_turns t on t.tenant_id=q.tenant_id::uuid
 order by ranked.turn,t.last_granted nulls first,q.created_at,q.id limit least(greatest(p_limit,1),1000);
$$;
revoke all on function public.meta_pending_fair(integer) from public,anon,authenticated;
grant execute on function public.meta_pending_fair(integer) to service_role;
