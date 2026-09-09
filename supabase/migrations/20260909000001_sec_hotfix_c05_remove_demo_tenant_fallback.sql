-- SEC-HOTFIX: Remove dangerous demo-tenant fallback from get_current_user_tenant_id()
-- (fix applied live on Supabase 2026-09-09 by Claude — this just syncs the repo)

CREATE OR REPLACE FUNCTION public.get_current_user_tenant_id()
 RETURNS uuid
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
  select coalesce(
    (select tenant_id from public.users where id = auth.uid()),
    nullif(current_setting('request.jwt.claim.tenant_id', true), '')::uuid
  );
$function$;
