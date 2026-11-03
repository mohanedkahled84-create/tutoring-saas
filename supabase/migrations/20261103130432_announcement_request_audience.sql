-- Existing requests retain their original broad audience. New requests must
-- identify who receives the requested educational notification.
alter table public.announcement_type_requests add column recipient_roles text[] not null default array['parent','student']::text[]
 check(cardinality(recipient_roles) between 1 and 2 and recipient_roles <@ array['parent','student']::text[]);
create or replace function public.announcement_operation(p_tenant uuid,p_user uuid,p_assistant uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor jsonb;announcement public.teacher_announcements;kind public.announcement_types;item uuid;
 groups_selected uuid[];roles_selected text[];phones_selected text[];capability text;result jsonb;
begin
 capability:=case when p_action in ('catalog','list','view','candidates','requests') then 'view' when p_action in ('create','request_type') then 'create' when p_action='consent' then 'send' when p_action='archive' then 'delete' when p_action in ('update','publish') then 'edit' else null end;
 if capability is null then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 actor:=public.announcement_actor(p_tenant,p_user,p_assistant,capability);
 if p_action='catalog' then
  return coalesce((select jsonb_agg(to_jsonb(t) order by t.title) from public.announcement_types t where t.available),'[]'::jsonb);
 elsif p_action='list' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.updated_at desc) from (
   select a.id,a.title,a.type_key,a.group_ids,a.recipient_roles,a.status,a.revision,a.published_at,a.expires_at,a.created_at,a.updated_at,
    (select coalesce(jsonb_object_agg(s.status,s.total),'{}'::jsonb) from (select r.status,count(*) total from public.announcement_recipients r where r.announcement_id=a.id and r.tenant_id=p_tenant and r.revision=a.revision group by r.status) s) delivery
   from public.teacher_announcements a where a.tenant_id=p_tenant and public.announcement_groups_allowed(p_tenant,actor,a.group_ids,false)
   order by a.updated_at desc limit 100
  ) x),'[]'::jsonb);
 elsif p_action='requests' then
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select r.id,r.title,r.description,r.sample_body,r.recipient_roles,r.status,r.admin_notes,r.type_key,r.created_at,r.updated_at from public.announcement_type_requests r where r.tenant_id=p_tenant and (p_assistant is null or r.assistant_id=p_assistant) order by r.created_at desc limit 100) x),'[]'::jsonb);
 elsif p_action='request_type' then
  item:=nullif(p_data->>'id','')::uuid;
  if item is null or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 100 or length(btrim(coalesce(p_data->>'description',''))) not between 1 and 2000 or length(btrim(coalesce(p_data->>'sample_body',''))) not between 1 and 1024 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if jsonb_typeof(p_data->'recipient_roles') is distinct from 'array' or jsonb_array_length(p_data->'recipient_roles') not between 1 and 2 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  select array_agg(distinct value order by value) into roles_selected from jsonb_array_elements_text(p_data->'recipient_roles');
  if not roles_selected <@ array['student','parent']::text[] then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':announcement_requests',0));
  if exists(select 1 from public.announcement_type_requests where id=item and (tenant_id<>p_tenant or created_by<>p_user or assistant_id is distinct from p_assistant)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if not exists(select 1 from public.announcement_type_requests where id=item) and (select count(*) from public.announcement_type_requests where tenant_id=p_tenant and created_at>now()-interval '1 day')>=10 then raise exception 'RATE_LIMIT' using errcode='P0001';end if;
  -- Only exact normalized names match: do not guess whether two different
  -- educational events mean the same thing.
  select * into kind from public.announcement_types where available and lower(regexp_replace(btrim(title),'\s+',' ','g'))=lower(regexp_replace(btrim(p_data->>'title'),'\s+',' ','g')) order by key limit 1;
  if kind.key is not null then return jsonb_build_object('existing_type',kind.key,'title',kind.title);end if;
  select jsonb_build_object('id',r.id,'already_requested',true) into result from public.announcement_type_requests r
   where r.tenant_id=p_tenant and r.created_by=p_user and r.assistant_id is not distinct from p_assistant
    and r.title=btrim(p_data->>'title') and r.description=btrim(p_data->>'description') and r.sample_body=btrim(p_data->>'sample_body')
    and r.recipient_roles=roles_selected and r.status in ('submitted','reviewing','meta_pending') order by r.created_at desc limit 1;
  if result is not null then return result;end if;
  insert into public.announcement_type_requests(id,tenant_id,created_by,assistant_id,title,description,sample_body,recipient_roles) values(item,p_tenant,p_user,p_assistant,btrim(p_data->>'title'),btrim(p_data->>'description'),btrim(p_data->>'sample_body'),roles_selected) on conflict(id) do nothing;
  return jsonb_build_object('id',item);
 end if;
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':announcement-queue',0));
 item:=nullif(p_data->>'id','')::uuid;
 if item is null then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 perform pg_advisory_xact_lock(hashtextextended(item::text||':announcement',0));
 select * into announcement from public.teacher_announcements where id=item and tenant_id=p_tenant for update;
 if announcement.id is not null and not public.announcement_groups_allowed(p_tenant,actor,announcement.group_ids,false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action in ('create','update') then
  if p_action='update' and announcement.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
  if p_action='create' and announcement.id is not null then return jsonb_build_object('announcement',to_jsonb(announcement),'unchanged',true);end if;
  if p_action='create' and exists(select 1 from public.teacher_announcements where id=item) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if p_action='update' and (p_data->>'expected_revision')::integer is distinct from announcement.revision then raise exception 'REVISION_CHANGED' using errcode='23514';end if;
  if p_action='update' and exists(select 1 from public.announcement_recipients where announcement_id=item and status='sending') then raise exception 'ANNOUNCEMENT_BUSY' using errcode='23514';end if;
  groups_selected:=array(select distinct jsonb_array_elements_text(coalesce(p_data->'group_ids','[]'))::uuid order by 1);
  roles_selected:=array(select distinct jsonb_array_elements_text(coalesce(p_data->'recipient_roles','[]')) order by 1);
  if not public.announcement_groups_allowed(p_tenant,actor,groups_selected) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if cardinality(roles_selected) not between 1 and 2 or not roles_selected<@array['parent','student']::text[] or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 160 or length(coalesce(p_data->>'manual_body',''))>4000 or jsonb_typeof(coalesce(p_data->'values','{}'))<>'object' or pg_column_size(coalesce(p_data->'values','{}'))>8000 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if nullif(p_data->>'type_key','') is not null then
   select * into kind from public.announcement_types where key=p_data->>'type_key' and available;
   if kind.key is null then raise exception 'TYPE_UNAVAILABLE' using errcode='23514';end if;
  elsif nullif(btrim(p_data->>'manual_body'),'') is null then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if p_action='create' then
   insert into public.teacher_announcements(id,tenant_id,created_by,assistant_id,title,type_key,group_ids,recipient_roles,values,manual_body,publish_on_portal,expires_at)
   values(item,p_tenant,p_user,p_assistant,btrim(p_data->>'title'),kind.key,groups_selected,roles_selected,coalesce(p_data->'values','{}'),nullif(btrim(p_data->>'manual_body'),''),coalesce((p_data->>'publish_on_portal')::boolean,true),nullif(p_data->>'expires_at','')::timestamptz) returning * into announcement;
  else
   -- Queue cancellation and allowance release are handled by the dedicated
   -- cancellation operation before revising a message that has queued sends.
   if exists(select 1 from public.announcement_recipients where announcement_id=item and status='queued') then raise exception 'CANCEL_QUEUE_FIRST' using errcode='23514';end if;
   update public.teacher_announcements set title=btrim(p_data->>'title'),type_key=kind.key,group_ids=groups_selected,recipient_roles=roles_selected,values=coalesce(p_data->'values','{}'),manual_body=nullif(btrim(p_data->>'manual_body'),''),publish_on_portal=coalesce((p_data->>'publish_on_portal')::boolean,true),expires_at=nullif(p_data->>'expires_at','')::timestamptz,revision=revision+1,status='draft',published_at=null,template_snapshot=null,updated_at=now() where id=item returning * into announcement;
  end if;
  return jsonb_build_object('announcement',to_jsonb(announcement));
 end if;
 if announcement.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 if p_action='view' then
  return jsonb_build_object('announcement',to_jsonb(announcement),'deliveries',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select r.id,r.phone,r.recipient_role,r.status,r.attempts,r.provider_error_code,r.skip_reason,r.created_at,r.sent_at from public.announcement_recipients r where r.announcement_id=item and r.tenant_id=p_tenant and r.revision=announcement.revision order by r.created_at desc limit 1000) x),'[]'::jsonb));
 end if;
 if p_action='archive' then
  if exists(select 1 from public.announcement_recipients where announcement_id=item and status='sending') then raise exception 'ANNOUNCEMENT_BUSY' using errcode='23514';end if;
  if exists(select 1 from public.announcement_recipients where announcement_id=item and status='queued') then raise exception 'CANCEL_QUEUE_FIRST' using errcode='23514';end if;
  update public.teacher_announcements set status='archived',updated_at=now() where id=item;
  return jsonb_build_object('id',item,'status','archived');
 end if;
 if not public.announcement_groups_allowed(p_tenant,actor,announcement.group_ids) then raise exception 'GROUP_NOT_ACTIVE' using errcode='23514';end if;
 if p_action='candidates' then
  return jsonb_build_object('announcement',to_jsonb(announcement),'contacts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.announcement_recipient_candidates(p_tenant,announcement.group_ids,announcement.recipient_roles) c),'allowance',(select jsonb_build_object('remaining',message_limit-reserved-sent,'unit_cost_egp',unit_cost_egp,'period',period) from public.announcement_allowances where tenant_id=p_tenant and period=date_trunc('month',now() at time zone 'Africa/Cairo')::date));
 elsif p_action='consent' then
  if p_data->'confirmed' is distinct from 'true'::jsonb then raise exception 'CONSENT_REQUIRED' using errcode='22023';end if;
  phones_selected:=array(select distinct jsonb_array_elements_text(coalesce(p_data->'phones','[]')) order by 1);
  if cardinality(phones_selected) not between 1 and 10000 or exists(select 1 from unnest(phones_selected) selected(phone) where not exists(select 1 from public.announcement_recipient_candidates(p_tenant,announcement.group_ids,announcement.recipient_roles) c where c.phone=selected.phone)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if exists(select 1 from public.announcement_optouts o where o.phone=any(phones_selected) and o.blocked) then raise exception 'RECIPIENT_OPTED_OUT' using errcode='23514';end if;
  insert into public.announcement_consents(tenant_id,phone,granted,source,actor_user_id,assistant_id) select p_tenant,selected.phone,true,'teacher_recorded',p_user,p_assistant from unnest(phones_selected) selected(phone) on conflict(tenant_id,phone) do update set granted=true,source='teacher_recorded',actor_user_id=p_user,assistant_id=p_assistant,recorded_at=now();
  return jsonb_build_object('recorded',cardinality(phones_selected));
 elsif p_action='publish' then
  if (p_data->>'expected_revision')::integer is distinct from announcement.revision then raise exception 'REVISION_CHANGED' using errcode='23514';end if;
  if announcement.expires_at is not null and announcement.expires_at<=now() then raise exception 'EXPIRY_PASSED' using errcode='23514';end if;
  if announcement.status='archived' then raise exception 'ANNOUNCEMENT_ARCHIVED' using errcode='23514';end if;
  if announcement.status='published' then return jsonb_build_object('announcement',to_jsonb(announcement),'unchanged',true);end if;
  if announcement.type_key is not null then select * into kind from public.announcement_types where key=announcement.type_key and available;if kind.key is null then raise exception 'TYPE_UNAVAILABLE' using errcode='23514';end if;end if;
  update public.teacher_announcements set status='published',published_at=now(),updated_at=now(),template_snapshot=case when kind.key is null then null else jsonb_build_object('key',kind.key,'name',kind.meta_name,'id',kind.meta_id,'title',kind.title,'body',kind.body,'fields',kind.fields) end where id=item returning * into announcement;
  return jsonb_build_object('announcement',to_jsonb(announcement));
 end if;
 raise exception 'INVALID_INPUT' using errcode='22023';
end;$$;
