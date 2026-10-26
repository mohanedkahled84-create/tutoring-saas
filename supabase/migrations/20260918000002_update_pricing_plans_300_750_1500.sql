-- Migration: 20260918000002_update_pricing_plans_300_750_1500.sql
-- Description: Standardize subscription plans to 300, 750, 1500 students with 20% annual discount

UPDATE public.tenants
SET subscription_tier = 'growth',
    settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', to_jsonb('plan_750'::text)),
        '{plan_name}', to_jsonb('باقة 750 طالب'::text)
      ),
      '{students_limit}', to_jsonb(750)
    )
WHERE id = '7b8b30e0-c7c3-44c6-ac00-d7fc58bcf609';
