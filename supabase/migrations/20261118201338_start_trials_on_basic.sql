create or replace function public.commercial_trial_before() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.subscription_status='trial' then
  new.trial_ends_at:=coalesce(new.created_at,now())+interval '7 days';
  new.subscription_tier:='basic_v1';
  new.settings:=coalesce(new.settings,'{}')||jsonb_build_object('commercial_plan_id','basic_v1','students_limit',100,'plan_name','Basic');
 end if;
 return new;
end$$;
create or replace function public.commercial_trial_after() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.subscription_status='trial' then
  insert into public.commercial_subscriptions(tenant_id,plan_id,period_start,period_end) values(new.id,'basic_v1',coalesce(new.created_at,now()),new.trial_ends_at);
  insert into public.commercial_subscription_periods(tenant_id,plan_id,starts_at,ends_at) values(new.id,'basic_v1',coalesce(new.created_at,now()),new.trial_ends_at);
 end if;
 return new;
end$$;
revoke all on function public.commercial_trial_before(),public.commercial_trial_after() from public,anon,authenticated;
