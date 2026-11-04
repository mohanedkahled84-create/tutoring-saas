-- Private billing state remains authoritative even with a direct Data API call.
create function public.commercial_tenant_fields_guard() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if current_setting('role',true) in ('authenticated','anon') and exists(select 1 from public.commercial_subscriptions where tenant_id=old.id) then
  if (new.subscription_tier,new.subscription_status,new.subscription_ends_at,new.trial_ends_at) is distinct from (old.subscription_tier,old.subscription_status,old.subscription_ends_at,old.trial_ends_at) then
   raise exception 'BILLING_FIELDS_READ_ONLY' using errcode='42501';
  end if;
  new.settings:=coalesce(new.settings,'{}')||jsonb_build_object('commercial_plan_id',old.settings->'commercial_plan_id','students_limit',old.settings->'students_limit','plan_name',old.settings->'plan_name');
 end if;
 return new;
end$$;
revoke all on function public.commercial_tenant_fields_guard() from public,anon,authenticated;
create trigger commercial_tenant_fields_guard before update on public.tenants for each row execute function public.commercial_tenant_fields_guard();

create schema if not exists commercial_private;
revoke all on schema commercial_private from public,anon;
grant usage on schema commercial_private to authenticated,service_role;
create function commercial_private.commercial_row_readable(p_tenant uuid) returns boolean
language plpgsql stable security definer set search_path='' as $$
declare lim jsonb;
begin
 -- This only narrows existing ownership policies; it never grants row access.
 if not exists(select 1 from public.users where id=(select auth.uid()) and (tenant_id=p_tenant or role='admin')) then return false;end if;
 lim:=public.commercial_limits(p_tenant);
 if (lim->>'legacy')::boolean then return true;end if;
 return not coalesce((lim->>'suspended')::boolean,false) and ((lim->>'active')::boolean or now()<(lim->>'period_end')::timestamptz+interval '7 days');
end$$;
revoke all on function commercial_private.commercial_row_readable(uuid) from public,anon;
grant execute on function commercial_private.commercial_row_readable(uuid) to authenticated,service_role;
do $$declare n text;begin
 foreach n in array array['students','groups','group_students','sessions','attendance','quiz_scores','quizzes','study_materials','homework_submissions','assistants','tenant_platform_settings','student_collections','teachers','rooms'] loop
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name=n and column_name='tenant_id') then
   execute format('create policy commercial_read_window on public.%I as restrictive for select to authenticated using (commercial_private.commercial_row_readable(tenant_id))',n);
  end if;
 end loop;
end$$;

-- Both quiz upload endpoints are billed as stored files, including the older bucket.
create or replace function public.commercial_storage_tenant(p_bucket text,p_name text) returns uuid
language plpgsql immutable set search_path='' as $$
declare part text;
begin
 if p_bucket not in ('homework-private','homework-submissions','platform-assets','quiz-images') then return null;end if;
 part:=case when split_part(p_name,'/',1) in ('materials','quizzes','platform') then split_part(p_name,'/',2) else split_part(p_name,'/',1) end;
 if part ~ '^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$' then return part::uuid;end if;
 return null;
end$$;

create function public.commercial_storage_check(p_tenant uuid,p_bytes bigint) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare lim jsonb;used bigint;
begin
 if p_bytes<0 then raise exception 'INVALID_FILE_SIZE' using errcode='22023';end if;
 lim:=public.commercial_limits(p_tenant);
 used:=public.commercial_storage_usage(p_tenant);
 if not coalesce((lim->>'legacy')::boolean,true) then
  if not (lim->>'active')::boolean then raise exception 'SUBSCRIPTION_REQUIRED' using errcode='23514';end if;
  if used+p_bytes>(lim->>'storage_bytes')::bigint then raise exception 'STORAGE_LIMIT_REACHED' using errcode='23514';end if;
 end if;
 return jsonb_build_object('used',used,'limit',lim->'storage_bytes');
end$$;
revoke all on function public.commercial_storage_check(uuid,bigint) from public,anon,authenticated;
grant execute on function public.commercial_storage_check(uuid,bigint) to service_role;

-- UI compatibility field now counts unique recipients in the real rolling window.
create function public.meta_budget_usage() returns integer
language sql stable security invoker set search_path='' as $$
 select count(distinct phone)::integer from public.meta_dispatch_reservations where state<>'not_sent' and created_at>now()-interval '24 hours';
$$;
revoke all on function public.meta_budget_usage() from public,anon,authenticated;
grant execute on function public.meta_budget_usage() to service_role;
