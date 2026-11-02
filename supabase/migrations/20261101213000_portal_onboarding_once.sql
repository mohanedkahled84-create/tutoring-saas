-- First welcome only: one parent per teacher/phone, one student per account.
-- Reservations survive timeouts; an ambiguous send is never retried automatically.
create table public.portal_onboarding_deliveries (
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 recipient_type text not null check(recipient_type in ('parent','student')),
 recipient_key text not null,
 queue_id uuid,
 send_started_at timestamptz,
 created_at timestamptz not null default now(),
 primary key(tenant_id,recipient_type,recipient_key)
);
create unique index portal_onboarding_queue_idx on public.portal_onboarding_deliveries(queue_id) where queue_id is not null;
alter table public.portal_onboarding_deliveries enable row level security;
revoke all on public.portal_onboarding_deliveries from public,anon,authenticated;
grant all on public.portal_onboarding_deliveries to service_role;

-- Preserve historical sends and pending first welcomes, without deleting history.
insert into public.portal_onboarding_deliveries(tenant_id,recipient_type,recipient_key,queue_id,send_started_at,created_at)
select distinct on (t.id,q.recipient_type,case when q.recipient_type='parent' then public.parent_family_phone(q.recipient_phone) else q.student_id::text end)
 t.id,q.recipient_type,case when q.recipient_type='parent' then public.parent_family_phone(q.recipient_phone) else q.student_id::text end,q.id,
 case when q.status in ('sent','failed') or coalesce(q.attempts,0)>0 then coalesce(q.sent_at,q.created_at,now()) else null end,coalesce(q.created_at,now())
from public.meta_portal_dispatch_queue q join public.tenants t on t.id::text=q.tenant_id
where q.recipient_type in ('parent','student') and (q.recipient_type='student' or public.parent_family_phone(q.recipient_phone) is not null)
order by t.id,q.recipient_type,case when q.recipient_type='parent' then public.parent_family_phone(q.recipient_phone) else q.student_id::text end,
 case when q.status='sent' then 0 when q.status='failed' or coalesce(q.attempts,0)>0 then 1 else 2 end,q.created_at,q.id
on conflict do nothing;
insert into public.portal_onboarding_deliveries(tenant_id,recipient_type,recipient_key,send_started_at)
select distinct tenant_id,'parent',public.parent_family_phone(parent_phone),parent_portal_sent_at from public.students
where parent_portal_sent_at is not null and public.parent_family_phone(parent_phone) is not null on conflict do nothing;
insert into public.portal_onboarding_deliveries(tenant_id,recipient_type,recipient_key,send_started_at)
select tenant_id,'student',id::text,student_portal_sent_at from public.students where student_portal_sent_at is not null on conflict do nothing;
insert into public.portal_onboarding_deliveries(tenant_id,recipient_type,recipient_key,send_started_at)
select distinct s.tenant_id,'parent',public.parent_family_phone(s.parent_phone),i.created_at
from public.students s join public.whatsapp_inbox i on i.student_id=s.id and i.tenant_id=s.tenant_id
where i.direction='outbound' and i.message_body='[رد آلي على طلب بيانات الدخول عبر Meta]'
 and public.parent_family_phone(i.phone)=public.parent_family_phone(s.parent_phone) on conflict do nothing;

create function public.portal_onboarding_enqueue_once() returns trigger
language plpgsql security invoker set search_path='' as $$
declare v_student public.students;v_key text;v_reserved text;
begin
 select * into v_student from public.students where id=new.student_id and tenant_id::text=new.tenant_id;
 if not found then raise exception 'ONBOARDING_STUDENT_NOT_FOUND';end if;
 if new.recipient_type='parent' then
  v_key:=public.parent_family_phone(new.recipient_phone);
  if v_key is null or v_key is distinct from public.parent_family_phone(v_student.parent_phone) then raise exception 'ONBOARDING_PHONE_MISMATCH';end if;
 elsif new.recipient_type='student' then
  if public.parent_family_phone(new.recipient_phone) is null or public.parent_family_phone(new.recipient_phone) is distinct from public.parent_family_phone(v_student.student_phone) then raise exception 'ONBOARDING_PHONE_MISMATCH';end if;
  v_key:=new.student_id::text;
 else raise exception 'INVALID_RECIPIENT';end if;
 insert into public.portal_onboarding_deliveries(tenant_id,recipient_type,recipient_key,queue_id)
 values(v_student.tenant_id,new.recipient_type,v_key,new.id) on conflict do nothing returning recipient_key into v_reserved;
 if v_reserved is null then return null;end if;
 return new;
end;$$;
revoke execute on function public.portal_onboarding_enqueue_once() from public,anon,authenticated;
grant execute on function public.portal_onboarding_enqueue_once() to service_role;
create trigger portal_onboarding_first_only before insert on public.meta_portal_dispatch_queue for each row execute function public.portal_onboarding_enqueue_once();

create function public.portal_onboarding_claim_queue(p_queue_id uuid) returns boolean
language plpgsql security invoker set search_path='' as $$
declare v_key text;
begin
 update public.portal_onboarding_deliveries d set send_started_at=now()
 where d.queue_id=p_queue_id and d.send_started_at is null
 and exists(select 1 from public.meta_portal_dispatch_queue q join public.students s on s.id=q.student_id and s.tenant_id::text=q.tenant_id
  where q.id=p_queue_id and q.status in ('pending','queued') and q.tenant_id=d.tenant_id::text
  and public.parent_family_phone(q.recipient_phone)=public.parent_family_phone(case when q.recipient_type='parent' then s.parent_phone else s.student_phone end))
 returning recipient_key into v_key;
 return v_key is not null;
end;$$;
revoke execute on function public.portal_onboarding_claim_queue(uuid) from public,anon,authenticated;
grant execute on function public.portal_onboarding_claim_queue(uuid) to service_role;

create function public.portal_onboarding_pending(p_date date,p_limit integer default 100)
returns setof public.meta_portal_dispatch_queue language sql security invoker set search_path='' as $$
 select q.* from public.meta_portal_dispatch_queue q join public.portal_onboarding_deliveries d on d.queue_id=q.id
 where q.status in ('pending','queued') and q.scheduled_date<=p_date and d.send_started_at is null
 order by q.scheduled_date,q.created_at limit least(greatest(p_limit,1),250)
$$;
revoke execute on function public.portal_onboarding_pending(date,integer) from public,anon,authenticated;
grant execute on function public.portal_onboarding_pending(date,integer) to service_role;

-- Guard the old teacher notification endpoint too; inbound credential replies
-- keep their existing independent authentication and cooldown.
create function public.portal_onboarding_claim_parent(p_tenant_id uuid,p_student_id uuid,p_phone text)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_phone text;v_key text;
begin
 select public.parent_family_phone(parent_phone) into v_phone from public.students where id=p_student_id and tenant_id=p_tenant_id;
 if v_phone is null or v_phone is distinct from p_phone then return false;end if;
 insert into public.portal_onboarding_deliveries(tenant_id,recipient_type,recipient_key,send_started_at)
 values(p_tenant_id,'parent',v_phone,now()) on conflict do nothing returning recipient_key into v_key;
 return v_key is not null;
end;$$;
revoke execute on function public.portal_onboarding_claim_parent(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_onboarding_claim_parent(uuid,uuid,text) to service_role;
notify pgrst,'reload schema';
