-- Migration: 20260920000008_update_pricing_plans_499_899_1399.sql
-- Description: Update pricing tiers and standard limits:
--   - Starter: 300 students @ 499 EGP/mo (4,790 EGP/yr)
--   - Growth: 750 students @ 899 EGP/mo (8,630 EGP/yr)
--   - Pro: 1500 students @ 1,399 EGP/mo (13,430 EGP/yr)

-- Ensure all tenants on 'growth' have 750 students limit and standard plan name
UPDATE public.tenants
SET settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', '"plan_750"'::jsonb),
        '{plan_name}', '"باقة 750 طالب"'::jsonb
      ),
      '{students_limit}', '750'::jsonb
    )
WHERE subscription_tier = 'growth'
  AND (settings->>'students_limit' IS NULL OR (settings->>'students_limit')::int = 250);

-- Ensure all tenants on 'starter' have 300 students limit and standard plan name
UPDATE public.tenants
SET settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', '"plan_300"'::jsonb),
        '{plan_name}', '"باقة 300 طالب"'::jsonb
      ),
      '{students_limit}', '300'::jsonb
    )
WHERE subscription_tier = 'starter'
  AND (settings->>'students_limit' IS NULL OR (settings->>'students_limit')::int = 100);

-- Ensure all tenants on 'pro' have 1500 students limit and standard plan name
UPDATE public.tenants
SET settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', '"plan_1500"'::jsonb),
        '{plan_name}', '"باقة 1500 طالب"'::jsonb
      ),
      '{students_limit}', '1500'::jsonb
    )
WHERE subscription_tier = 'pro'
  AND (settings->>'students_limit' IS NULL OR (settings->>'students_limit')::int = 500);

COMMENT ON TABLE public.tenants IS 'Tenants representing teachers or tutoring centers. Standard tiers: starter (300 students @ 499 EGP), growth (750 students @ 899 EGP), pro (1500 students @ 1399 EGP).';
