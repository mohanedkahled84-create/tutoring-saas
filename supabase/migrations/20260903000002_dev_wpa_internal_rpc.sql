-- DEV-WPA.1: Helper RPC function to safely retrieve tenant WhatsApp connection and decrypted Vault secret
create or replace function public.get_tenant_whatsapp_connection(p_tenant_id uuid)
returns json
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_res json;
begin
  select json_build_object(
    'provider', wc.provider,
    'instance_url', wc.instance_url,
    'instance_status', wc.instance_status,
    'api_key', ds.decrypted_secret
  ) into v_res
  from public.whatsapp_connections wc
  left join vault.decrypted_secrets ds on wc.api_key_secret_id = ds.id
  where wc.tenant_id = p_tenant_id;

  return v_res;
end;
$$;

-- Grant execution to authenticated & service roles
grant execute on function public.get_tenant_whatsapp_connection(uuid) to service_role, postgres, authenticated, anon;
