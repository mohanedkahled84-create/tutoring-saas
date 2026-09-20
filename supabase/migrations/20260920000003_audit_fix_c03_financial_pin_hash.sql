-- ============================================================================
-- Migration: 20260920000003_audit_fix_c03_financial_pin_hash.sql
-- Description: Fixes Security Audit C-03 & C-04 by migrating plaintext financial
--              PINs to bcrypt hashes, removing plaintext columns and settings,
--              and adding persistent failed-attempt tracking and lockout columns.
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 1. Add hash and lockout columns to users table
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS financial_pin_hash text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS failed_pin_attempts int DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS pin_locked_until timestamptz DEFAULT NULL;

-- 2. Migrate any existing plaintext financial_pin to bcrypt hash
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'financial_pin'
  ) THEN
    UPDATE public.users 
    SET financial_pin_hash = crypt(financial_pin, gen_salt('bf', 10))
    WHERE financial_pin IS NOT NULL AND financial_pin <> '' AND (financial_pin_hash IS NULL OR financial_pin_hash = '');

    -- Safely drop the plaintext column
    ALTER TABLE public.users DROP COLUMN IF EXISTS financial_pin;
  END IF;
END $$;

-- 3. Purge plaintext financial_pin from tenants.settings
UPDATE public.tenants 
SET settings = settings - 'financial_pin' 
WHERE settings ? 'financial_pin';
