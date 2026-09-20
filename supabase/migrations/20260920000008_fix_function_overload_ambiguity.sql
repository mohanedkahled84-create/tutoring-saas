-- Fix function overload ambiguity for register_tenant_owner and register_tenant_owner_direct
-- Drops the redundant 7-argument wrapper overloads because the 8-argument functions have `p_subject text DEFAULT ''`
-- This allows both 7-argument and 8-argument invocations to resolve unambiguously.

DROP FUNCTION IF EXISTS public.register_tenant_owner_direct(text, text, text, text, text, text, timestamp with time zone);
DROP FUNCTION IF EXISTS public.register_tenant_owner(uuid, text, text, text, text, text, timestamp with time zone);

GRANT EXECUTE ON FUNCTION public.register_tenant_owner_direct(text, text, text, text, text, text, timestamp with time zone, text) TO anon, authenticated, service_role, postgres;
GRANT EXECUTE ON FUNCTION public.register_tenant_owner(uuid, text, text, text, text, text, timestamp with time zone, text) TO anon, authenticated, service_role, postgres;
