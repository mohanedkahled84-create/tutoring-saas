-- Preserve the already-published platform before removing name/email overrides.
-- The owner account and published legacy key were checked read-only in production.
-- No generated tenant/user IDs are embedded; no existing canonical record is replaced.
do $$
declare
  owner_tenant uuid;
  legacy jsonb;
begin
  select tenant_id into owner_tenant from public.users
    where lower(email) = 'mohanedabdulhalim@gmail.com' and role = 'owner';
  if owner_tenant is null then return; end if;
  select message_body::jsonb into legacy from public.whatsapp_inbox
    where phone = 'PLATFORM_SETTINGS_mr-omar' and status = 'published'
    order by updated_at desc limit 1;
  if legacy is null or legacy->>'subdomain' <> 'mr-omar' then return; end if;

  insert into public.tenant_platform_settings
    (tenant_id, subdomain, display_title, subject_title, headline_text, subtitle_text,
     cutout_avatar_url, theme_preset, custom_primary_color, is_active,
     allow_public_signup, require_approval)
  values
    (owner_tenant, legacy->>'subdomain', legacy->>'display_title', legacy->>'subject_title',
     legacy->>'headline_text', legacy->>'subtitle_text', legacy->>'cutout_avatar_url',
     coalesce(legacy->>'theme_preset','navy'), legacy->>'custom_primary_color',
     coalesce((legacy->>'is_active')::boolean,true),
     coalesce((legacy->>'allow_public_signup')::boolean,true),
     coalesce((legacy->>'require_approval')::boolean,false))
  on conflict (tenant_id) do nothing;

  -- Preserve access already granted by the retired owner exception. This does
  -- not change the billing tier, price, student allowance or lifecycle status.
  update public.tenants set settings = jsonb_set(coalesce(settings,'{}'::jsonb),'{is_pro}','true'::jsonb)
    where id = owner_tenant and exists (
      select 1 from public.tenant_platform_settings p where p.tenant_id = owner_tenant and p.subdomain = 'mr-omar'
    );
end $$;
