-- Parent family credentials are delivered only to the registered phone, never to staff.
-- These tables/functions are backend-only: student credentials cannot grant family access.
create function public.parent_family_phone(p_phone text) returns text
language sql immutable strict security invoker set search_path = '' as $$
 with digits as (select regexp_replace(translate(btrim(p_phone), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[[:space:]()+.\-]', '', 'g') n),
 normalized as (select case when n like '00%' then substr(n,3) else n end n from digits)
 select case when n ~ '^01[0125][0-9]{8}$' then '2'||n
             when n ~ '^[1-9][0-9]{7,14}$' and n not like '0%' then n else null end from normalized;
$$;
create index students_parent_family_phone_idx on public.students(public.parent_family_phone(parent_phone));

create table public.parent_family_accounts (
 id uuid primary key default gen_random_uuid(), phone text not null unique,
 password_hash text not null, password_cipher text not null, credential_version integer not null default 1,
 last_requested_at timestamptz, created_at timestamptz not null default now()
);
create table public.parent_family_sessions (
 id uuid primary key default gen_random_uuid(), family_id uuid not null references public.parent_family_accounts on delete cascade,
 token_hash text not null unique, root_id uuid not null, origin text not null,
 credential_version integer not null, expires_at timestamptz not null,
 created_at timestamptz not null default now()
);
create index parent_family_sessions_root_idx on public.parent_family_sessions(root_id);
create index parent_family_sessions_family_idx on public.parent_family_sessions(family_id);
create index parent_family_sessions_expiry_idx on public.parent_family_sessions(expires_at);
create table public.parent_family_handoffs (
 ticket_hash text primary key, session_id uuid not null references public.parent_family_sessions on delete cascade,
 student_id uuid not null references public.students on delete cascade, target_origin text not null,
 expires_at timestamptz not null default now() + interval '90 seconds'
);
create index parent_family_handoffs_session_idx on public.parent_family_handoffs(session_id);
create index parent_family_handoffs_student_idx on public.parent_family_handoffs(student_id);
create index parent_family_handoffs_expiry_idx on public.parent_family_handoffs(expires_at);
create table public.parent_family_limits (
 key_hash text primary key, attempts integer not null, resets_at timestamptz not null
);
create index parent_family_limits_expiry_idx on public.parent_family_limits(resets_at);
alter table public.parent_family_accounts enable row level security;
alter table public.parent_family_sessions enable row level security;
alter table public.parent_family_handoffs enable row level security;
alter table public.parent_family_limits enable row level security;
revoke all on public.parent_family_accounts, public.parent_family_sessions, public.parent_family_handoffs, public.parent_family_limits from public, anon, authenticated;
grant all on public.parent_family_accounts, public.parent_family_sessions, public.parent_family_handoffs, public.parent_family_limits to service_role;

create function public.parent_family_limit(p_key text, p_max integer) returns boolean
language plpgsql security invoker set search_path = '' as $$
declare v_attempts integer;
begin
 insert into public.parent_family_limits(key_hash,attempts,resets_at) values(p_key,1,now()+interval '15 minutes')
 on conflict(key_hash) do update set attempts=case when parent_family_limits.resets_at<=now() then 1 else parent_family_limits.attempts+1 end,
 resets_at=case when parent_family_limits.resets_at<=now() then now()+interval '15 minutes' else parent_family_limits.resets_at end
 returning attempts into v_attempts;
 return v_attempts <= p_max;
end; $$;

create function public.parent_family_delivery(p_tenant_id uuid,p_student_id uuid,p_hash text,p_cipher text,p_phone text)
returns jsonb language plpgsql security invoker set search_path = '' as $$
declare v_phone text; v_account public.parent_family_accounts;
begin
 select public.parent_family_phone(parent_phone) into v_phone from public.students where id=p_student_id and tenant_id=p_tenant_id;
 if v_phone is null or v_phone is distinct from p_phone then return null; end if;
 insert into public.parent_family_accounts(phone,password_hash,password_cipher) values(v_phone,p_hash,p_cipher)
 on conflict(phone) do nothing;
 select * into v_account from public.parent_family_accounts where phone=v_phone for update;
 if v_account.last_requested_at > now()-interval '60 seconds' then return jsonb_build_object('limited',true); end if;
 update public.parent_family_accounts set last_requested_at=now() where id=v_account.id;
 return jsonb_build_object('phone',v_phone,'password_cipher',v_account.password_cipher);
end; $$;

create function public.parent_family_identity(p_token_hash text,p_origin text) returns jsonb
language sql stable security invoker set search_path = '' as $$
 select jsonb_build_object('id',s.id,'family_id',a.id,'phone',a.phone,'root_id',s.root_id,'credential_version',a.credential_version,'expires_at',s.expires_at)
 from public.parent_family_sessions s join public.parent_family_accounts a on a.id=s.family_id
 where s.token_hash=p_token_hash and s.origin=p_origin and s.expires_at>now() and s.credential_version=a.credential_version;
$$;

create function public.parent_family_directory(p_token_hash text,p_origin text) returns jsonb
language sql stable security invoker set search_path = '' as $$
 with identity as(select public.parent_family_identity(p_token_hash,p_origin) i)
 select case when i is null then null else jsonb_build_object('expires_at',i->>'expires_at','students',coalesce((
 select jsonb_agg(jsonb_build_object('id',s.id,'tenant_id',s.tenant_id,'name',s.name,'student_code',s.student_code,
 'teacher_name',coalesce(nullif(c->'platform'->>'display_title',''),
   (select nullif(u.full_name,'') from public.users u where u.tenant_id=s.tenant_id and u.role in ('owner','teacher','center_owner') order by u.created_at,u.id limit 1),
   (select t.name from public.tenants t where t.id=s.tenant_id),'المعلم'),
 'presentation',c->'platform') order by s.name,s.tenant_id,s.id)
 from public.students s cross join lateral (select public.portal_tenant_context(s.tenant_id) c) ctx
 where public.parent_family_phone(s.parent_phone)=i->>'phone'), '[]'::jsonb)) end from identity;
$$;

create function public.parent_family_context(p_token_hash text,p_origin text,p_student_id uuid) returns jsonb
language sql stable security invoker set search_path = '' as $$
 with identity as(select public.parent_family_identity(p_token_hash,p_origin) i)
 select public.portal_student_context(s.id,s.tenant_id,null) from public.students s, identity
 where i is not null and s.id=p_student_id and public.parent_family_phone(s.parent_phone)=i->>'phone';
$$;

create function public.parent_family_redeem(p_ticket_hash text,p_origin text,p_token_hash text) returns jsonb
language plpgsql security invoker set search_path = '' as $$
declare v_ticket public.parent_family_handoffs; v_source public.parent_family_sessions; v_account public.parent_family_accounts; v_context jsonb;
begin
 -- Inspect without a ticket lock, then acquire the account lock FIRST, as logout does.
 -- Deleting the ticket first could deadlock against logout's cascading handoff deletion.
 select * into v_ticket from public.parent_family_handoffs where ticket_hash=p_ticket_hash and target_origin=p_origin and expires_at>now();
 if not found then return null; end if;
 select * into v_source from public.parent_family_sessions where id=v_ticket.session_id and expires_at>now();
 if not found then return null; end if;
 select * into v_account from public.parent_family_accounts where id=v_source.family_id and credential_version=v_source.credential_version for update;
 if not found then return null; end if;
 -- Same account lock as logout: a concurrent transfer cannot survive revocation.
 perform 1 from public.parent_family_sessions where id=v_source.id and expires_at>now();
 if not found then return null; end if;
 delete from public.parent_family_handoffs where ticket_hash=p_ticket_hash and target_origin=p_origin and expires_at>now() returning * into v_ticket;
 if not found then return null; end if;
 select public.portal_student_context(s.id,s.tenant_id,null) into v_context from public.students s
 where s.id=v_ticket.student_id and public.parent_family_phone(s.parent_phone)=v_account.phone;
 if v_context is null then return null; end if;
 insert into public.parent_family_sessions(family_id,token_hash,root_id,origin,credential_version,expires_at)
 values(v_source.family_id,p_token_hash,v_source.root_id,p_origin,v_source.credential_version,v_source.expires_at);
 return jsonb_build_object('context',v_context,'expires_at',v_source.expires_at);
end; $$;

create function public.parent_family_logout(p_token_hash text,p_origin text) returns void
language plpgsql security invoker set search_path = '' as $$
declare v_family uuid; v_root uuid;
begin
 select family_id,root_id into v_family,v_root from public.parent_family_sessions where token_hash=p_token_hash and origin=p_origin;
 if not found then return; end if;
 perform 1 from public.parent_family_accounts where id=v_family for update;
 delete from public.parent_family_sessions where root_id=v_root;
end; $$;

revoke execute on function public.parent_family_phone(text),public.parent_family_limit(text,integer),public.parent_family_delivery(uuid,uuid,text,text,text),public.parent_family_identity(text,text),public.parent_family_directory(text,text),public.parent_family_context(text,text,uuid),public.parent_family_redeem(text,text,text),public.parent_family_logout(text,text) from public,anon,authenticated;
grant execute on function public.parent_family_phone(text),public.parent_family_limit(text,integer),public.parent_family_delivery(uuid,uuid,text,text,text),public.parent_family_identity(text,text),public.parent_family_directory(text,text),public.parent_family_context(text,text,uuid),public.parent_family_redeem(text,text,text),public.parent_family_logout(text,text) to service_role;
-- Pure normalization reads no tables; staff student edits also maintain this expression index.
grant execute on function public.parent_family_phone(text) to authenticated;
