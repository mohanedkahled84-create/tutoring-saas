-- An expired trial or a previously claimed welcome cannot block other teachers' turns.
create function public.meta_tenant_dispatchable(p_tenant uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select coalesce((public.commercial_limits(p_tenant)->>'active')::boolean,false)
 and exists(select 1 from public.tenants where id=p_tenant and status='active' and deleted_at is null and subscription_status='active');
$$;
revoke all on function public.meta_tenant_dispatchable(uuid) from public,anon,authenticated;
grant execute on function public.meta_tenant_dispatchable(uuid) to service_role;
create or replace function public.meta_budget_try(p_id uuid,p_tenant uuid,p_phone text,p_fair boolean default true) returns jsonb
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
   select distinct r.tenant_id from public.announcement_recipients r where r.status='queued' and public.meta_tenant_dispatchable(r.tenant_id)
   union select distinct q.tenant_id::uuid from public.meta_portal_dispatch_queue q where q.status in ('pending','queued') and q.scheduled_date<=current_date and public.meta_tenant_dispatchable(q.tenant_id::uuid) and exists(select 1 from public.portal_onboarding_deliveries d where d.queue_id=q.id and d.send_started_at is null)
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
create or replace function public.meta_pending_fair(p_limit integer default 100) returns setof public.meta_portal_dispatch_queue
language sql security invoker set search_path='' as $$
 select q from public.meta_portal_dispatch_queue q join (
  select id,row_number() over(partition by tenant_id order by created_at,id) turn from public.meta_portal_dispatch_queue
  where status in ('pending','queued') and scheduled_date<=(now() at time zone 'UTC')::date and public.meta_tenant_dispatchable(tenant_id::uuid) and exists(select 1 from public.portal_onboarding_deliveries d where d.queue_id=meta_portal_dispatch_queue.id and d.send_started_at is null)
 ) ranked on ranked.id=q.id left join public.meta_dispatch_turns t on t.tenant_id=q.tenant_id::uuid
 order by ranked.turn,t.last_granted nulls first,q.created_at,q.id limit least(greatest(p_limit,1),1000);
$$;

do $$declare source text;anchor text;begin
 select pg_get_functiondef('public.announcement_queue(uuid,uuid,uuid,text,jsonb)'::regprocedure) into source;
 anchor:='for row_data in select r from jsonb_array_elements(preview.rows) r where r->>''phone''=any(selected) loop';
 if strpos(source,anchor)=0 then raise exception 'COUNTRY_QUEUE_CONTRACT_CHANGED';end if;
 source:=replace(source,anchor,anchor||$patch$
  if coalesce(row_data->>'phone','') !~ '^201[0125][0-9]{8}$' then raise exception 'UNSUPPORTED_MESSAGE_COUNTRY' using errcode='23514';end if;
 $patch$);
 execute source;
end$$;
