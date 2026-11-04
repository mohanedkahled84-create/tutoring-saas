create function public.canonical_student_phone(p_phone text) returns text
language plpgsql immutable set search_path='' as $$
declare p text;
begin
 p:=regexp_replace(translate(coalesce(p_phone,''),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[^0-9]','','g');
 if p='' then return null;end if;
 if p like '00%' then p:=substr(p,3);end if;
 if p ~ '^01[0125][0-9]{8}$' then p:='2'||p;end if;
 if p ~ '^1[0125][0-9]{8}$' then p:='20'||p;end if;
 return p;
end$$;
alter table public.students add column student_phone_canonical text generated always as(public.canonical_student_phone(student_phone)) stored;
create index students_tenant_canonical_phone on public.students(tenant_id,student_phone_canonical) where student_phone_canonical is not null;
-- Registry enforces new uniqueness without deleting or rewriting legacy
-- duplicate students. Those existing conflicts remain explicit review items.
create table public.student_phone_claims (
 tenant_id uuid not null references public.tenants(id) on delete cascade,phone text not null,
 student_id uuid not null references public.students(id) on delete cascade,
 primary key(tenant_id,phone)
);
insert into public.student_phone_claims(tenant_id,phone,student_id)
 select distinct on(tenant_id,student_phone_canonical) tenant_id,student_phone_canonical,id from public.students
 where student_phone_canonical is not null order by tenant_id,student_phone_canonical,created_at,id;
alter table public.student_phone_claims enable row level security;
revoke all on public.student_phone_claims from public,anon,authenticated;
grant all on public.student_phone_claims to service_role;

create function public.commercial_student_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare p text;prior text;claim uuid;existing uuid;lim jsonb;
begin
 if new.tenant_id is null then raise exception 'NO_TENANT_CONTEXT' using errcode='23514';end if;
 if tg_op='UPDATE' and new.tenant_id is distinct from old.tenant_id then raise exception 'TENANT_IMMUTABLE' using errcode='23514';end if;
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':commercial',0));
 p:=public.canonical_student_phone(new.student_phone);
 if tg_op='UPDATE' then prior:=public.canonical_student_phone(old.student_phone);end if;
 if p is not null and (tg_op='INSERT' or p is distinct from prior) then
  if p !~ '^[1-9][0-9]{9,14}$' then raise exception 'INVALID_STUDENT_PHONE' using errcode='23514';end if;
  select id into existing from public.students where tenant_id=new.tenant_id and student_phone_canonical=p and id<>new.id order by created_at,id limit 1;
  if existing is not null then raise exception 'DUPLICATE_STUDENT_PHONE' using errcode='23505',detail=existing::text;end if;
  insert into public.student_phone_claims(tenant_id,phone,student_id) values(new.tenant_id,p,new.id)
   on conflict(tenant_id,phone) do update set student_id=public.student_phone_claims.student_id returning student_id into claim;
  if claim<>new.id then raise exception 'DUPLICATE_STUDENT_PHONE' using errcode='23505';end if;
 end if;
 if tg_op='UPDATE' and prior is distinct from p then delete from public.student_phone_claims where tenant_id=new.tenant_id and phone=prior and student_id=new.id;end if;
 if new.archived_at is null and (tg_op='INSERT' or old.archived_at is not null) then
  lim:=public.commercial_limits(new.tenant_id);
  if not coalesce((lim->>'legacy')::boolean,true) then
   if not (lim->>'active')::boolean then raise exception 'SUBSCRIPTION_REQUIRED' using errcode='23514';end if;
   if (select count(*) from public.students where tenant_id=new.tenant_id and archived_at is null and id<>new.id)>=(lim->>'students')::integer then raise exception 'STUDENT_LIMIT_REACHED' using errcode='23514';end if;
  end if;
 end if;
 return new;
end$$;
-- The registry FK is deferred so a BEFORE INSERT claim can reference NEW.id.
alter table public.student_phone_claims drop constraint student_phone_claims_student_id_fkey;
alter table public.student_phone_claims add constraint student_phone_claims_student_id_fkey foreign key(student_id) references public.students(id) on delete cascade deferrable initially deferred;
revoke all on function public.commercial_student_guard() from public,anon,authenticated;
create trigger commercial_student_guard before insert or update on public.students for each row execute function public.commercial_student_guard();

create function public.commercial_assistant_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare lim jsonb;
begin
 perform pg_advisory_xact_lock(hashtextextended(new.tenant_id::text||':commercial',0));
 if coalesce(new.status,'active') not in ('inactive','revoked','deleted') and (tg_op='INSERT' or coalesce(old.status,'active') in ('inactive','revoked','deleted')) then
  lim:=public.commercial_limits(new.tenant_id);
  if not coalesce((lim->>'legacy')::boolean,true) then
   if not (lim->>'active')::boolean then raise exception 'SUBSCRIPTION_REQUIRED' using errcode='23514';end if;
   if (select count(*) from public.assistants where tenant_id=new.tenant_id and coalesce(status,'active') not in ('inactive','revoked','deleted') and id<>new.id)>=(lim->>'assistants')::integer then raise exception 'ASSISTANT_LIMIT_REACHED' using errcode='23514';end if;
  end if;
 end if;
 return new;
end$$;
revoke all on function public.commercial_assistant_guard() from public,anon,authenticated;
create trigger commercial_assistant_guard before insert or update on public.assistants for each row execute function public.commercial_assistant_guard();

create function public.commercial_storage_tenant(p_bucket text,p_name text) returns uuid
language plpgsql immutable set search_path='' as $$
declare part text;
begin
 if p_bucket not in ('homework-private','homework-submissions','platform-assets') then return null;end if;
 part:=case when split_part(p_name,'/',1) in ('materials','quizzes','platform') then split_part(p_name,'/',2) else split_part(p_name,'/',1) end;
 if part ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return part::uuid;end if;
 return null;
end$$;
create function public.commercial_storage_usage(p_tenant uuid) returns bigint
language sql stable security invoker set search_path='' as $$
 select coalesce(sum(case when metadata->>'size' ~ '^[0-9]+$' then (metadata->>'size')::bigint else 0 end),0)::bigint from storage.objects where public.commercial_storage_tenant(bucket_id,name)=p_tenant;
$$;
revoke all on function public.commercial_storage_usage(uuid) from public,anon,authenticated;
grant execute on function public.commercial_storage_usage(uuid) to service_role;
create function public.commercial_storage_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare tenant uuid;lim jsonb;bytes bigint;old_bytes bigint:=0;
begin
 tenant:=public.commercial_storage_tenant(new.bucket_id,new.name);
 if tenant is null or not exists(select 1 from public.commercial_subscriptions where tenant_id=tenant) then return new;end if;
 perform pg_advisory_xact_lock(hashtextextended(tenant::text||':commercial',0));
 lim:=public.commercial_limits(tenant);
 if not (lim->>'active')::boolean then raise exception 'SUBSCRIPTION_REQUIRED' using errcode='23514';end if;
 if new.metadata->>'size' is null then return new;end if;
 if new.metadata->>'size' !~ '^[0-9]+$' then raise exception 'INVALID_FILE_SIZE' using errcode='23514';end if;
 bytes:=(new.metadata->>'size')::bigint;
 if tg_op='UPDATE' and public.commercial_storage_tenant(old.bucket_id,old.name)=tenant and old.metadata->>'size' ~ '^[0-9]+$' then old_bytes:=(old.metadata->>'size')::bigint;end if;
 if public.commercial_storage_usage(tenant)-old_bytes+bytes>(lim->>'storage_bytes')::bigint then raise exception 'STORAGE_LIMIT_REACHED' using errcode='23514';end if;
 return new;
end$$;
revoke all on function public.commercial_storage_guard() from public,anon,authenticated;
create trigger commercial_storage_guard before insert or update on storage.objects for each row execute function public.commercial_storage_guard();
create or replace view public.assistant_delegated_students with (security_invoker=true,security_barrier=true) as select source.* from public.students source where public.assistant_delegated_row('students',to_jsonb(source)) with local check option;
revoke all on public.assistant_delegated_students from public,anon,authenticated;
grant all on public.assistant_delegated_students to service_role;
notify pgrst,'reload schema';
