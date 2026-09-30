-- Migration: 20260930000003_fix_email_verifications_rls.sql
-- Fixes RLS on email_verifications so backend (anon/service_role) can manage verification codes for public signups.

DROP POLICY IF EXISTS "Service role only on email_verifications" ON public.email_verifications;
DROP POLICY IF EXISTS "Allow backend OTP management on email_verifications" ON public.email_verifications;

CREATE POLICY "Allow backend OTP management on email_verifications"
ON public.email_verifications
FOR ALL
TO anon, authenticated, service_role
USING (true)
WITH CHECK (true);

-- Provide SECURITY DEFINER RPC helper for recording OTP
CREATE OR REPLACE FUNCTION record_email_otp(p_email text, p_code text, p_expires_at timestamptz)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  DELETE FROM public.email_verifications WHERE email = lower(trim(p_email));
  INSERT INTO public.email_verifications (email, code, expires_at, attempts)
  VALUES (lower(trim(p_email)), trim(p_code), p_expires_at, 0);
END;
$$;

GRANT EXECUTE ON FUNCTION record_email_otp(text, text, timestamptz) TO anon, authenticated, service_role;
