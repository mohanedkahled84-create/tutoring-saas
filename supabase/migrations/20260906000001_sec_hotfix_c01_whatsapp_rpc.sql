-- ============================================================================
-- SEC-HOTFIX Phase B (C-01): Restrict WhatsApp Secret Decryption RPC & Safe Status RPC
-- 
-- Fixes critical vulnerability where public.get_tenant_whatsapp_connection(uuid)
-- was executable by anon and authenticated roles without tenant ownership checks,
-- leaking decrypted Vault secrets.
-- ============================================================================

-- 1. Revoke public/anon/authenticated execution from secret-decrypting function
revoke execute on function public.get_tenant_whatsapp_connection(uuid) from public, anon, authenticated;
grant execute on function public.get_tenant_whatsapp_connection(uuid) to service_role, postgres;

-- 2. Safe, non-leaking status RPC for authenticated clients (Security Invoker, strictly enforces RLS & tenant check)
create or replace function public.get_tenant_whatsapp_status(p_tenant_id uuid)
returns json
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  v_res json;
begin
  -- Enforce tenant ownership verification
  if p_tenant_id is distinct from public.get_current_user_tenant_id() and not public.is_admin() then
    raise exception 'Unauthorized: access denied to tenant WhatsApp status' using errcode = '42501';
  end if;

  select json_build_object(
    'provider', wc.provider,
    'instance_url', wc.instance_url,
    'instance_status', wc.instance_status,
    'is_configured', (wc.api_key_secret_id is not null)
  ) into v_res
  from public.whatsapp_connections wc
  where wc.tenant_id = p_tenant_id;

  return v_res;
end;
$$;

revoke execute on function public.get_tenant_whatsapp_status(uuid) from anon, public;
grant execute on function public.get_tenant_whatsapp_status(uuid) to authenticated, service_role, postgres;

comment on function public.get_tenant_whatsapp_connection(uuid) is
  'INTERNAL SERVICE ROLE ONLY: Returns decrypted WhatsApp credentials for n8n automation. Strictly inaccessible to clients.';

comment on function public.get_tenant_whatsapp_status(uuid) is
  'CLIENT SAFE: Returns sanitized WhatsApp connectivity metadata without exposing decrypted credentials. Enforces tenant boundary.';
