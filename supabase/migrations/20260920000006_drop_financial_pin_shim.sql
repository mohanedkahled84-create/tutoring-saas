-- ============================================================================
-- Migration: 20260920000006_drop_financial_pin_shim.sql
-- Description: Drops the temporary compatibility shim column public.users.financial_pin
--              after backend code and RPCs have been fully migrated to financial_pin_hash.
-- ============================================================================

ALTER TABLE public.users DROP COLUMN IF EXISTS financial_pin;
