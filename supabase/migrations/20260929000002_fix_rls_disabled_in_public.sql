-- Migration: 20260929000002_fix_rls_disabled_in_public.sql
-- Fixes Supabase Security Advisor critical issue: rls_disabled_in_public on gift_codes & email_verifications

ALTER TABLE public.gift_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.email_verifications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Deny anon access on gift_codes" ON public.gift_codes;
CREATE POLICY "Deny anon access on gift_codes" ON public.gift_codes
  FOR ALL TO authenticated USING (true);

DROP POLICY IF EXISTS "Service role only on email_verifications" ON public.email_verifications;
CREATE POLICY "Service role only on email_verifications" ON public.email_verifications
  FOR ALL TO service_role USING (true);
