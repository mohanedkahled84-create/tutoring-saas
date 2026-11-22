-- Store provider receipts independently so an early webhook cannot race the
-- queue row's message-id update. No recipient or message content is stored.
create table public.portal_delivery_receipts (
 message_id text primary key check (message_id like 'wamid.%' and length(message_id) <= 512),
 delivery_status text not null check (delivery_status in ('sent','delivered','read','failed')),
 event_at timestamptz not null,
 error_code text check (error_code is null or length(error_code) <= 40),
 updated_at timestamptz not null default now()
);
alter table public.portal_delivery_receipts enable row level security;
revoke all on public.portal_delivery_receipts from public,anon,authenticated;
grant select,insert,update on public.portal_delivery_receipts to service_role;

create function public.portal_delivery_receipt(p_message_id text,p_status text,p_event_at timestamptz,p_error_code text default null)
returns void language plpgsql security invoker set search_path='' as $$
begin
 if p_message_id is null or p_message_id not like 'wamid.%' or length(p_message_id)>512 or p_status not in ('sent','delivered','read','failed') or p_event_at is null or p_event_at>now()+interval '1 day' or p_event_at<now()-interval '90 days' then
  raise exception 'INVALID_RECEIPT' using errcode='22023';
 end if;
 insert into public.portal_delivery_receipts(message_id,delivery_status,event_at,error_code)
 values(p_message_id,p_status,p_event_at,left(p_error_code,40))
 on conflict(message_id) do update set delivery_status=excluded.delivery_status,event_at=excluded.event_at,error_code=excluded.error_code,updated_at=now()
 where excluded.event_at>portal_delivery_receipts.event_at
    or (excluded.event_at=portal_delivery_receipts.event_at and
        (case excluded.delivery_status when 'read' then 4 when 'delivered' then 3 when 'failed' then 2 else 1 end) >
        (case portal_delivery_receipts.delivery_status when 'read' then 4 when 'delivered' then 3 when 'failed' then 2 else 1 end));
end;
$$;
revoke all on function public.portal_delivery_receipt(text,text,timestamptz,text) from public,anon,authenticated;
grant execute on function public.portal_delivery_receipt(text,text,timestamptz,text) to service_role;
