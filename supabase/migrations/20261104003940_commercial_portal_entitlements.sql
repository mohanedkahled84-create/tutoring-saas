create or replace function public.portal_tenant_context(p_tenant_id uuid) returns jsonb
language sql stable set search_path='' as $$
 select jsonb_build_object('platform',
  (select jsonb_build_object('subdomain',p.subdomain,'is_active',p.is_active,'display_title',p.display_title,'theme_preset',p.theme_preset,'custom_primary_color',p.custom_primary_color)
   from public.tenant_platform_settings p where p.tenant_id=t.id and (coalesce((l.value->>'legacy')::boolean,true) or (l.value->>'teaching_platform')::boolean)),
  'bound_subdomain',(select b.subdomain from public.portal_domain_bindings b where b.tenant_id=t.id),
  'teacher_phone',coalesce(nullif(t.settings->>'contact_phone',''),nullif(t.settings->>'whatsapp_phone',''),(select u.phone from public.users u where u.tenant_id=t.id and u.role in ('owner','teacher','center_owner') order by u.created_at,u.id limit 1),''),
  'commercial',case when (l.value->>'legacy')::boolean then null else jsonb_build_object('active',(l.value->>'active')::boolean,'teaching_platform',(l.value->>'teaching_platform')::boolean,'is_trial',(l.value->>'is_trial')::boolean,'readable',not coalesce((l.value->>'suspended')::boolean,false) and ((l.value->>'active')::boolean or now()<(l.value->>'period_end')::timestamptz+interval '7 days')) end
 ) from public.tenants t cross join lateral(select public.commercial_limits(t.id) value) l where t.id=p_tenant_id;
$$;
revoke all on function public.portal_tenant_context(uuid) from public,anon,authenticated;
grant execute on function public.portal_tenant_context(uuid) to service_role;
