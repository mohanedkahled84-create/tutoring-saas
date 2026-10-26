-- Pin the remaining production SECURITY DEFINER function search paths.
-- The parent portal RPC uses unqualified public table names, so keep public
-- after pg_catalog while preventing a caller-controlled search_path.
ALTER FUNCTION public.get_parent_portal_payload(text, uuid, uuid)
  SET search_path = pg_catalog, public;

-- This diagnostic function references auth/public objects by schema and does
-- not need public in its search path.
ALTER FUNCTION public.test_whoami()
  SET search_path = pg_catalog;
