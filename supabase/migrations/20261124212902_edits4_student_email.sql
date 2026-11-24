-- Reuse the existing contact model on hosted environments and support fresh databases.
create table if not exists public.student_notification_emails(tenant_id uuid not null references public.tenants(id) on delete cascade,student_id uuid primary key references public.students(id) on delete cascade,email text not null check(length(email) between 3 and 254),enabled boolean not null default true,verified_at timestamptz not null default now(),updated_at timestamptz not null default now());
create table if not exists public.student_email_challenges(student_id uuid primary key references public.students(id) on delete cascade,tenant_id uuid not null references public.tenants(id) on delete cascade,challenge_id uuid not null unique,email text not null check(length(email) between 3 and 254),code_hash text not null check(length(code_hash)=64),attempts integer not null default 0,created_at timestamptz not null default now(),expires_at timestamptz not null);
alter table public.student_notification_emails enable row level security;
alter table public.student_email_challenges enable row level security;
revoke all on public.student_notification_emails,public.student_email_challenges from public,anon,authenticated;
grant all on public.student_notification_emails,public.student_email_challenges to service_role;
create or replace function public.student_email_contact(p_action text,p_tenant uuid,p_student uuid,p_data jsonb default '{}') returns jsonb language plpgsql security invoker set search_path='' as $$
declare challenge public.student_email_challenges;contact public.student_notification_emails;
begin
 perform 1 from public.students where id=p_student and tenant_id=p_tenant and archived_at is null for update;
 if not found then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select * into contact from public.student_notification_emails where student_id=p_student and tenant_id=p_tenant;
 select * into challenge from public.student_email_challenges where student_id=p_student and tenant_id=p_tenant for update;
 if p_action='info' then
  return jsonb_build_object('email',contact.email,'verified',contact.student_id is not null,'enabled',coalesce(contact.enabled,false),'challenge_id',case when challenge.expires_at>now() and challenge.attempts<5 then challenge.challenge_id else null end,'pending_email',case when challenge.expires_at>now() then challenge.email else null end);
 elsif p_action='disable' then
  update public.student_notification_emails set enabled=false,updated_at=now() where student_id=p_student and tenant_id=p_tenant;
  delete from public.student_email_challenges where student_id=p_student and tenant_id=p_tenant;
  return jsonb_build_object('status','disabled');
 elsif p_action='start' then
  if challenge.created_at>now()-interval '60 seconds' then return jsonb_build_object('status','cooldown');end if;
  if length(coalesce(p_data->>'email','')) not between 3 and 254 or p_data->>'code_hash' !~ '^[a-f0-9]{64}$' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  insert into public.student_email_challenges(student_id,tenant_id,challenge_id,email,code_hash,expires_at) values(p_student,p_tenant,(p_data->>'challenge_id')::uuid,p_data->>'email',p_data->>'code_hash',now()+interval '15 minutes') on conflict(student_id) do update set challenge_id=excluded.challenge_id,email=excluded.email,code_hash=excluded.code_hash,attempts=0,created_at=now(),expires_at=excluded.expires_at;
  return jsonb_build_object('status','created');
 elsif p_action='verify' then
  if challenge.student_id is null or challenge.expires_at<=now() or challenge.attempts>=5 then return jsonb_build_object('status','expired');end if;
  if challenge.challenge_id<>(p_data->>'challenge_id')::uuid or challenge.code_hash is distinct from p_data->>'code_hash' then
   update public.student_email_challenges set attempts=attempts+1 where student_id=p_student and tenant_id=p_tenant;
   return jsonb_build_object('status','invalid');
  end if;
  insert into public.student_notification_emails(tenant_id,student_id,email,enabled) values(p_tenant,p_student,challenge.email,true) on conflict(student_id) do update set email=excluded.email,enabled=true,verified_at=now(),updated_at=now();
  delete from public.student_email_challenges where student_id=p_student and tenant_id=p_tenant;
  return jsonb_build_object('status','verified');
 end if;
 raise exception 'INVALID_ACTION' using errcode='22023';
end$$;
revoke all on function public.student_email_contact(text,uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.student_email_contact(text,uuid,uuid,jsonb) to service_role;
