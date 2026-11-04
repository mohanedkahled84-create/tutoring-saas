-- Keep signed delivery events that arrive before the HTTP send acknowledgement.
create table public.announcement_delivery_inbox (
 message_id text primary key check(message_id like 'wamid.%'),status text not null check(status in ('sent','failed','delivered','read')),
 payload jsonb not null,received_at timestamptz not null default now()
);
alter table public.announcement_delivery_inbox enable row level security;
revoke all on public.announcement_delivery_inbox from public,anon,authenticated;
grant all on public.announcement_delivery_inbox to service_role;

do $$declare source text;anchor text;begin
 select pg_get_functiondef('public.announcement_worker(text,jsonb)'::regprocedure) into source;
 anchor:='for tenant in select distinct tenant_id from public.announcement_recipients where status in (''queued'',''sending'') and not exists(select 1 from public.account_deletion_jobs j where j.tenant_id=announcement_recipients.tenant_id and j.state<>''done'') limit 20 loop';
 if strpos(source,anchor)=0 then raise exception 'FAIR_WORKER_CONTRACT_CHANGED';end if;
 source:=replace(source,anchor,$patch$
 for tenant in select queued.tenant_id from (select distinct r.tenant_id from public.announcement_recipients r where r.status in ('queued','sending') and not exists(select 1 from public.account_deletion_jobs j where j.tenant_id=r.tenant_id and j.state<>'done')) queued
 left join public.meta_dispatch_turns turns on turns.tenant_id=queued.tenant_id order by turns.last_granted nulls first,queued.tenant_id limit 20 loop
 $patch$);
 anchor:='if not coalesce((public.meta_budget_try(attempt.id,tenant,rec.phone)->>''allowed'')::boolean,false) then continue;end if;';
 if strpos(source,anchor)=0 then raise exception 'WALLET_WORKER_CONTRACT_CHANGED';end if;
 source:=replace(source,anchor,$patch$
 if not coalesce((public.commercial_limits(tenant)->>'active')::boolean,false) then continue;end if;
 if not exists(select 1 from public.wallet_holds where id=attempt.id) then
  begin perform public.commercial_wallet(tenant,'reserve',attempt.id,100);
  exception when check_violation then continue;end;
 end if;
 if not coalesce((public.meta_budget_try(attempt.id,tenant,rec.phone)->>'allowed')::boolean,false) then continue;end if;
 $patch$);
 execute source;
end$$;
alter function public.announcement_worker(text,jsonb) rename to announcement_worker_core;
create function public.announcement_worker(p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare result jsonb;event jsonb;
begin
 if p_action='delivery' and p_data->>'message_id' like 'wamid.%' and p_data->>'status' in ('sent','failed','delivered','read') then
  insert into public.announcement_delivery_inbox(message_id,status,payload) values(p_data->>'message_id',p_data->>'status',p_data)
   on conflict(message_id) do update set status=excluded.status,payload=excluded.payload,received_at=now()
   where array_position(array['sent','failed','delivered','read'],excluded.status)>array_position(array['sent','failed','delivered','read'],public.announcement_delivery_inbox.status);
  select payload into event from public.announcement_delivery_inbox where message_id=p_data->>'message_id';
  return public.announcement_worker_core('delivery',event);
 end if;
 result:=public.announcement_worker_core(p_action,p_data);
 if p_action='settle' and p_data->>'outcome'='accepted' then
  select payload into event from public.announcement_delivery_inbox where message_id=p_data->>'message_id';
  if event is not null then perform public.announcement_worker_core('delivery',event);end if;
 end if;
 return result;
end$$;
revoke all on function public.announcement_worker(text,jsonb),public.announcement_worker_core(text,jsonb) from public,anon,authenticated;
grant execute on function public.announcement_worker(text,jsonb),public.announcement_worker_core(text,jsonb) to service_role;

create function public.commercial_admin_summary() returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('tenant_id',tenant_id,'limits',public.commercial_limits(tenant_id))),'[]') from public.commercial_subscriptions;
$$;
revoke all on function public.commercial_admin_summary() from public,anon,authenticated;
grant execute on function public.commercial_admin_summary() to service_role;
