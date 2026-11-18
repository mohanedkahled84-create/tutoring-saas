-- Convert only the active trial period. Paid and scheduled periods keep their plan.
do $$
declare
  trial_tenant uuid;
begin
  for trial_tenant in
    select t.id from public.tenants t
    where t.subscription_status = 'trial' and t.trial_ends_at > now()
      and t.subscription_tier = 'pro_v1' and t.deleted_at is null
    order by t.id
  loop
    perform pg_advisory_xact_lock(hashtextextended(trial_tenant::text || ':commercial', 0));

    update public.commercial_subscription_periods p
    set plan_id = 'basic_v1'
    from public.tenants t
    where t.id = trial_tenant and t.subscription_status = 'trial' and t.deleted_at is null
      and p.tenant_id = t.id and p.plan_id = 'pro_v1'
      and p.starts_at <= now() and p.ends_at > now() and p.ends_at = t.trial_ends_at;

    if found then
      update public.commercial_subscriptions s
      set plan_id = 'basic_v1', updated_at = now()
      from public.tenants t
      where s.tenant_id = trial_tenant and t.id = s.tenant_id
        and s.plan_id = 'pro_v1' and s.period_end = t.trial_ends_at;

      update public.tenants t
      set subscription_tier = 'basic_v1',
          settings = coalesce(t.settings, '{}'::jsonb) ||
            jsonb_build_object('commercial_plan_id', 'basic_v1', 'students_limit', 100, 'plan_name', 'Basic')
      where t.id = trial_tenant;
    end if;
  end loop;
end $$;
