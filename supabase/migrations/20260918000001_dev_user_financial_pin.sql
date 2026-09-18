-- 20260918000001_dev_user_financial_pin.sql
-- Tie financial security PIN directly to user accounts for cross-device cloud persistence

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS financial_pin text;

-- Sync existing PINs from tenant settings to user records
UPDATE public.users u
SET financial_pin = t.settings->>'financial_pin'
FROM public.tenants t
WHERE u.tenant_id = t.id
  AND t.settings->>'financial_pin' IS NOT NULL
  AND (u.financial_pin IS NULL OR u.financial_pin = '');
