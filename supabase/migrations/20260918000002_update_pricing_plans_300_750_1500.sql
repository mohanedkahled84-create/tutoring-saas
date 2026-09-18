-- Migration: 20260918000002_update_pricing_plans_300_750_1500.sql
-- Description: Standardize subscription plans to 300, 750, 1500 students with 20% annual discount

UPDATE public.tenants 
SET subscription_tier = 'growth',
    settings = jsonb_set(
      jsonb_set(
        jsonb_set(COALESCE(settings, '{}'::jsonb), '{plan_id}', '" plan_750\'::jsonb),
 '{plan_name}', '\باقة 750 طالب\'::jsonb
 ),
 '{students_limit}', '750'::jsonb
 )
WHERE id = '7b8b30e0-c7c3-44c6-ac00-d7fc58bcf609';
