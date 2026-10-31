-- Consolidate server-only portal lookups. No browser role can execute these.
create or replace function public.portal_tenant_context(p_tenant_id uuid)
returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('platform',
  (select jsonb_build_object('subdomain',p.subdomain,'is_active',p.is_active,'display_title',p.display_title,
    'theme_preset',p.theme_preset,'custom_primary_color',p.custom_primary_color)
   from public.tenant_platform_settings p where p.tenant_id=t.id),
  'bound_subdomain',(select b.subdomain from public.portal_domain_bindings b where b.tenant_id=t.id),
  'teacher_phone',coalesce(nullif(t.settings->>'contact_phone',''),nullif(t.settings->>'whatsapp_phone',''),
    (select u.phone from public.users u where u.tenant_id=t.id and u.role in ('owner','teacher','center_owner')
      order by u.created_at,u.id limit 1),'')
) from public.tenants t where t.id=p_tenant_id;
$$;

create or replace function public.portal_student_context(p_student_id uuid,p_tenant_id uuid,p_token text default null)
returns jsonb language sql stable security invoker set search_path='' as $$
select jsonb_build_object('id',s.id,'tenant_id',s.tenant_id,'group_ids',
  (select coalesce(jsonb_agg(g.id),'[]'::jsonb) from public.groups g where g.tenant_id=s.tenant_id and
    (g.id=s.group_id or exists(select 1 from public.group_students gs
      where gs.tenant_id=s.tenant_id and gs.student_id=s.id and gs.group_id=g.id))))
  || public.portal_tenant_context(s.tenant_id)
from public.students s where
  (p_student_id is not null and p_tenant_id is not null and s.id=p_student_id and s.tenant_id=p_tenant_id)
  or (p_student_id is null and p_tenant_id is null and p_token is not null and p_token<>'' and s.parent_portal_token=p_token)
limit 1;
$$;

create or replace function public.resolve_portal_entry_context(p_code text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare link public.short_links; pupil public.students; kind text; raw_hex text; context jsonb; credential text;
begin
  if p_code is null or length(p_code)>128 then return null; end if;
  select * into link from public.short_links where code=p_code;
  if found then
    select * into pupil from public.students where id=link.student_id and tenant_id=link.tenant_id;
    if not found then return null; end if;
    kind:=link.portal_type; credential:=link.token;
  else
    kind:=case when lower(left(p_code,1))='s' then 'student' else 'parent' end;
    if p_code ~* '^[ps][0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
      select * into pupil from public.students where id=substring(p_code from 2)::uuid;
    else
      raw_hex:=regexp_replace(lower(p_code),'^[ps]+','');
      if raw_hex !~ '^[0-9a-f]{4,8}$' then return null; end if;
      -- Preserve the existing legacy UUID-prefix capability links.
      select * into pupil from public.students
        where id >= (rpad(raw_hex,8,'0')||'-0000-0000-0000-000000000000')::uuid
          and id <= (rpad(raw_hex,8,'f')||'-ffff-ffff-ffff-ffffffffffff')::uuid order by id limit 1;
    end if;
    if pupil.id is null then return null; end if;
    credential:=pupil.parent_portal_token;
  end if;
  context:=public.portal_student_context(pupil.id,pupil.tenant_id,null);
  return jsonb_build_object('code',p_code,'token',credential,'portal_type',kind,
    'student_id',pupil.id,'tenant_id',pupil.tenant_id,'context',context,
    'legacy_token_match',credential is not null and credential<>'' and credential=pupil.parent_portal_token);
end;
$$;

create or replace function public.consume_portal_entry_handoff(p_ticket_hash text,p_origin text)
returns jsonb language sql volatile security invoker set search_path='' as $$
with consumed as (
  delete from public.portal_handoffs h where h.ticket_hash=p_ticket_hash and h.target_origin=p_origin
    and h.expires_at>now() and h.session_expires_at>extract(epoch from now())
  returning h.student_id,h.tenant_id,h.portal_role,h.session_expires_at
)
select jsonb_build_object('context',public.portal_student_context(c.student_id,c.tenant_id,null),
  'student_id',c.student_id,'tenant_id',c.tenant_id,'portal_role',c.portal_role,'session_expires_at',c.session_expires_at)
from consumed c;
$$;

revoke all on function public.portal_tenant_context(uuid),public.portal_student_context(uuid,uuid,text),
  public.resolve_portal_entry_context(text),public.consume_portal_entry_handoff(text,text) from public,anon,authenticated;
grant execute on function public.portal_tenant_context(uuid),public.portal_student_context(uuid,uuid,text),
  public.resolve_portal_entry_context(text),public.consume_portal_entry_handoff(text,text) to service_role;
