create table public.support_tickets(
 id uuid primary key,tenant_id uuid not null references public.tenants(id) on delete cascade,
 created_by uuid references public.users(id) on delete set null,teacher_name text not null,teacher_phone text,
 title text not null check(length(btrim(title)) between 1 and 160),
 category text not null check(category in ('account','attendance','homework','messages','subscription','other')),
 body text not null check(length(btrim(body)) between 1 and 4000),
 status text not null default 'open' check(status in ('open','in_progress','waiting_user','resolved')),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index support_tickets_tenant_updated on public.support_tickets(tenant_id,updated_at desc);
create index support_tickets_status_updated on public.support_tickets(status,updated_at desc);
create table public.support_replies(
 id uuid primary key,ticket_id uuid not null references public.support_tickets(id) on delete cascade,
 author_id uuid references public.users(id) on delete set null,author_role text not null check(author_role in ('customer','admin')),
 body text not null check(length(btrim(body)) between 1 and 4000),created_at timestamptz not null default now()
);
create index support_replies_ticket_date on public.support_replies(ticket_id,created_at);
alter table public.support_tickets enable row level security;
alter table public.support_replies enable row level security;
revoke all on public.support_tickets,public.support_replies from public,anon,authenticated;
grant all on public.support_tickets,public.support_replies to service_role;

create function public.support_operation(p_user uuid,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor public.users;ticket public.support_tickets;item uuid;reply public.support_replies;
begin
 select * into actor from public.users where id=p_user;
 if actor.id is null or actor.assistant_id is not null or actor.role not in ('admin','owner','teacher','center_owner') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if actor.role<>'admin' and not exists(select 1 from public.tenants t where t.id=actor.tenant_id and t.status='active' and t.deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (select id,title,category,status,teacher_name,teacher_phone,created_at,updated_at from public.support_tickets where actor.role='admin' or tenant_id=actor.tenant_id order by updated_at desc limit 100) x),'[]'::jsonb);
 end if;
 item:=nullif(p_data->>'id','')::uuid;
 if p_action='create' then
  if actor.role='admin' or item is null or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 160 or length(btrim(coalesce(p_data->>'body',''))) not between 1 and 4000 or coalesce(p_data->>'category','') not in ('account','attendance','homework','messages','subscription','other') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text||':support',0));
  select * into ticket from public.support_tickets where id=item;
  if ticket.id is not null then
   if ticket.tenant_id<>actor.tenant_id or ticket.created_by is distinct from actor.id then raise exception 'REQUEST_CONFLICT' using errcode='23514';end if;
   return jsonb_build_object('ticket',to_jsonb(ticket),'unchanged',true);
  end if;
  if (select count(*) from public.support_tickets where created_by=actor.id and created_at>now()-interval '10 minutes')>=5 then raise exception 'RATE_LIMIT' using errcode='P0001';end if;
  insert into public.support_tickets(id,tenant_id,created_by,teacher_name,teacher_phone,title,category,body) values(item,actor.tenant_id,actor.id,coalesce(actor.full_name,'المعلم'),actor.phone,btrim(p_data->>'title'),p_data->>'category',btrim(p_data->>'body')) returning * into ticket;
  return jsonb_build_object('ticket',to_jsonb(ticket));
 end if;
 select * into ticket from public.support_tickets where id=item and (actor.role='admin' or tenant_id=actor.tenant_id) for update;
 if ticket.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 if p_action='view' then
  return jsonb_build_object('ticket',to_jsonb(ticket),'replies',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at) from (select id,author_role,body,created_at from public.support_replies where ticket_id=ticket.id order by created_at desc limit 100) x),'[]'::jsonb));
 elsif p_action='reply' then
  if length(btrim(coalesce(p_data->>'body',''))) not between 1 and 4000 or nullif(p_data->>'request_id','')::uuid is null then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  select * into reply from public.support_replies where id=(p_data->>'request_id')::uuid;
  if reply.id is not null then
   if reply.ticket_id<>ticket.id or reply.author_id is distinct from actor.id then raise exception 'REQUEST_CONFLICT' using errcode='23514';end if;
   return jsonb_build_object('id',reply.id,'unchanged',true);
  end if;
  perform pg_advisory_xact_lock(hashtextextended(actor.id::text||':support',0));
  if (select count(*) from public.support_replies where author_id=actor.id and created_at>now()-interval '1 minute')>=10 then raise exception 'RATE_LIMIT' using errcode='P0001';end if;
  insert into public.support_replies(id,ticket_id,author_id,author_role,body) values((p_data->>'request_id')::uuid,ticket.id,actor.id,case when actor.role='admin' then 'admin' else 'customer' end,btrim(p_data->>'body')) returning * into reply;
  update public.support_tickets set updated_at=now(),status=case when actor.role='admin' then 'waiting_user' else 'open' end where id=ticket.id;
  return jsonb_build_object('id',reply.id);
 elsif p_action='status' then
  if actor.role<>'admin' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if coalesce(p_data->>'status','') not in ('open','in_progress','waiting_user','resolved') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  update public.support_tickets set status=p_data->>'status',updated_at=now() where id=ticket.id;
  return jsonb_build_object('id',ticket.id,'status',p_data->>'status');
 end if;
 raise exception 'INVALID_INPUT' using errcode='22023';
end;$$;
revoke all on function public.support_operation(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.support_operation(uuid,text,jsonb) to service_role;
