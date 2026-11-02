-- Concurrent HTTP batches and background workers share a single reservation
-- budget. A failed/ambiguous send still consumes its first-welcome reservation.
create index portal_onboarding_started_idx on public.portal_onboarding_deliveries(send_started_at) where send_started_at is not null;
create index meta_portal_sent_at_idx on public.meta_portal_dispatch_queue((coalesce(sent_at,created_at))) where status='sent';
create function public.portal_onboarding_claim_queue_limited(p_queue_id uuid,p_daily_limit integer default 250) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_key text;v_count integer;v_today timestamptz:=date_trunc('day',now() at time zone 'UTC') at time zone 'UTC';
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('portal-onboarding-daily-budget',0));
 select count(*) into v_count from (
  select q.id::text as key from public.meta_portal_dispatch_queue q where q.status='sent' and coalesce(q.sent_at,q.created_at)>=v_today
  union
  select coalesce(d.queue_id::text,d.tenant_id::text||':'||d.recipient_type||':'||d.recipient_key) from public.portal_onboarding_deliveries d where d.send_started_at>=v_today
 ) claimed;
 if v_count>=least(greatest(coalesce(p_daily_limit,250),1),250) then return false;end if;
 update public.portal_onboarding_deliveries d set send_started_at=now()
 where d.queue_id=p_queue_id and d.send_started_at is null
 and exists(select 1 from public.meta_portal_dispatch_queue q join public.students s on s.id=q.student_id and s.tenant_id::text=q.tenant_id
  join public.tenants t on t.id=s.tenant_id and t.status='active' and t.deleted_at is null
  where q.id=p_queue_id and q.status in ('pending','queued') and q.tenant_id=d.tenant_id::text
  and public.parent_family_phone(q.recipient_phone)=public.parent_family_phone(case when q.recipient_type='parent' then s.parent_phone else s.student_phone end))
 returning recipient_key into v_key;
 return v_key is not null;
end;$$;
create or replace function public.portal_onboarding_claim_queue(p_queue_id uuid) returns boolean
language sql security invoker set search_path='' as $$select public.portal_onboarding_claim_queue_limited(p_queue_id,250)$$;
revoke execute on function public.portal_onboarding_claim_queue_limited(uuid,integer) from public,anon,authenticated;
grant execute on function public.portal_onboarding_claim_queue_limited(uuid,integer) to service_role;
notify pgrst,'reload schema';
