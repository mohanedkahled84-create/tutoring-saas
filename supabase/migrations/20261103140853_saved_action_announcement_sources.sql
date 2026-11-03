-- Saved classroom changes can prepare a draft, but never send a message.
alter table public.sessions add column if not exists session_time text;
create table public.announcement_sources(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
 kind text not null check(kind in ('material','session')),source_id uuid not null,
 after_state jsonb not null,type_key text references public.announcement_types(key),values jsonb not null default '{}',
 title text not null,manual_body text,created_at timestamptz not null default clock_timestamp()
);
create index announcement_sources_lookup on public.announcement_sources(tenant_id,kind,source_id,created_at desc);
alter table public.announcement_sources enable row level security;
revoke all on public.announcement_sources from public,anon,authenticated;
grant all on public.announcement_sources to service_role;
alter table public.teacher_announcements add column source_event_id uuid references public.announcement_sources(id) on delete set null;

create function public.announcement_clock_time(p_time text) returns text
language plpgsql immutable security invoker set search_path='' as $$
declare value text:=lower(translate(coalesce(p_time,''),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'));parts text[];hour integer;minute integer;
begin
 value:=split_part(regexp_replace(value,'[–—−]','-','g'),'-',1);
 parts:=regexp_match(value,'([0-9]{1,2}):([0-9]{2})');if parts is null then return null;end if;
 hour:=parts[1]::integer;minute:=parts[2]::integer;
 if value ~ '(م|pm)' then if hour not between 1 and 12 then return null;end if;hour:=hour%12+12;
 elsif value ~ '(ص|am)' then if hour not between 1 and 12 then return null;end if;hour:=hour%12;end if;
 if hour not between 0 and 23 or minute not between 0 and 59 then return null;end if;
 return lpad(hour::text,2,'0')||':'||lpad(minute::text,2,'0');
end;$$;

create function public.announcement_source_state(p_tenant uuid,p_kind text,p_id uuid) returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare material public.study_materials;session public.sessions;gr public.groups;quiz jsonb;
begin
 if p_kind='material' then
  select * into material from public.study_materials where id=p_id and tenant_id=p_tenant;
  if material.id is null or not public.portal_material_in_current_year(material,p_tenant) then return null;end if;
  quiz:=public.portal_parse_legacy_json(material.questions);
  if material.type in ('online_quiz','paper_quiz','paper_exam') and (coalesce(quiz->>'is_archived','false') in ('true','1') or coalesce(quiz->>'is_draft','false') in ('true','1')) then return null;end if;
  return jsonb_build_object('title',material.title,'type',material.type,'group_ids',case when material.group_ids is not null then to_jsonb(material.group_ids) when material.group_id is not null then jsonb_build_array(material.group_id) else 'null'::jsonb end,'is_homework',material.is_homework,'due_date',material.due_date,'url',material.url,'available_date',quiz->>'available_date','start_time',quiz->>'start_time','end_time',quiz->>'end_time','exam_mode',quiz->>'exam_mode');
 elsif p_kind='session' then
  select * into session from public.sessions where id=p_id and tenant_id=p_tenant;
  select * into gr from public.groups where id=session.group_id and tenant_id=p_tenant;
  if session.id is null or gr.id is null or session.status='ended' or not public.portal_group_in_current_year(gr.id,p_tenant) then return null;end if;
  return jsonb_build_object('group_ids',jsonb_build_array(gr.id),'title',coalesce(nullif(session.extra_topic,''),'رقم '||session.session_number::text),'status',case when session.status='in_progress' then case when session.rescheduled_to_date is not null then 'rescheduled' else 'scheduled' end else session.status end,'session_date',coalesce(to_jsonb(session)->>'original_session_date',session.session_date::text),'session_time',public.announcement_clock_time(coalesce(nullif(session.session_time,''),session.start_time::text,gr.session_time)),'rescheduled_to_date',session.rescheduled_to_date,'rescheduled_to_time',public.announcement_clock_time(session.rescheduled_to_time),'is_extra',session.is_extra,'location',gr.center_name);
 end if;
 return null;
end;$$;

create function public.capture_announcement_source(p_tenant uuid,p_kind text,p_id uuid,p_old jsonb default '{}') returns uuid
language plpgsql security invoker set search_path='' as $$
declare state jsonb:=public.announcement_source_state(p_tenant,p_kind,p_id);source public.announcement_sources;kind text;fields jsonb:='{}';manual text;old_time text;new_time text;topic text;
begin
 if state is null then return null;end if;
 select * into source from public.announcement_sources s where s.tenant_id=p_tenant and s.kind=p_kind and s.source_id=p_id order by created_at desc,id desc limit 1;
 if source.id is not null and source.after_state=state then return source.id;end if;
 topic:=left(regexp_replace(coalesce(state->>'title','تنبيه دراسي'),'[\n\r\t]',' ','g'),160);
 if p_kind='material' then
  if coalesce((state->>'is_homework')::boolean,false) or state->>'type'='homework' then
   if nullif(state->>'due_date','') is not null then
    if nullif(p_old->>'due_date','') is not null and p_old->>'due_date' is distinct from state->>'due_date' then
     kind:='homework_deadline';fields:=jsonb_build_object('homework_title',topic,'old_due',left(p_old->>'due_date',10),'new_due',left(state->>'due_date',10));
    else kind:='homework_assigned';fields:=jsonb_build_object('homework_title',topic,'due',left(state->>'due_date',10));end if;
   end if;
   manual:='الواجب متاح الآن: '||topic||case when state->>'due_date' is not null then E'\nموعد التسليم: '||(state->>'due_date') else '' end||E'\nيمكنك مراجعته من بوابة الطالب.';
  elsif state->>'type' in ('online_quiz','paper_quiz','paper_exam') then
   if state->>'available_date' is not null and public.announcement_clock_time(state->>'start_time') is not null then
    kind:='exam_schedule';fields:=jsonb_strip_nulls(jsonb_build_object('exam_title',topic,'event_time',(state->>'available_date')||'T'||public.announcement_clock_time(state->>'start_time')));
   end if;
   manual:='الاختبار متاح ضمن اختبارات المجموعة: '||topic||E'\nراجع الموعد والتفاصيل من بوابة الطالب.';
  else
   kind:='study_content';fields:=jsonb_build_object('content_title',topic)||case when state->>'type'='video' then jsonb_build_object('content_type','فيديو شرح') when state->>'type'='pdf' then jsonb_build_object('content_type','مذكرة') else '{}'::jsonb end;
   manual:='محتوى دراسي متاح للمجموعة: '||topic||E'\nافتح بوابة الطالب للاطلاع عليه.';
  end if;
 elsif p_kind='session' then
  topic:=regexp_replace(topic,'^حصة\s+','','i');
  old_time:=case when p_old->>'status'='rescheduled' then nullif(p_old->>'rescheduled_to_date','')||'T'||public.announcement_clock_time(p_old->>'rescheduled_to_time') else nullif(p_old->>'session_date','')||'T'||coalesce(public.announcement_clock_time(p_old->>'session_time'),state->>'session_time') end;
  if state->>'status'='cancelled' then
   new_time:=coalesce(nullif(state->>'rescheduled_to_date',''),nullif(state->>'session_date',''))||'T'||coalesce(nullif(state->>'rescheduled_to_time',''),nullif(state->>'session_time',''));
   if new_time is not null then kind:='class_cancelled';fields:=jsonb_build_object('topic',topic,'cancelled_time',new_time);end if;
   manual:='تم إلغاء '||topic||' بتاريخ '||(state->>'session_date')||'.';
  elsif state->>'status'='rescheduled' then
   new_time:=nullif(state->>'rescheduled_to_date','')||'T'||coalesce(nullif(state->>'rescheduled_to_time',''),state->>'session_time');
   if old_time is not null and new_time is not null and old_time<>new_time then kind:='class_rescheduled';fields:=jsonb_build_object('topic',topic,'old_time',old_time,'new_time',new_time);end if;
   manual:='الموعد الجديد لـ'||topic||': '||coalesce(new_time,state->>'rescheduled_to_date','راجع المدرس')||'.';
  elsif coalesce((state->>'is_extra')::boolean,false) then
   new_time:=nullif(state->>'session_date','')||'T'||nullif(state->>'session_time','');
   if new_time is not null then kind:='class_added';fields:=jsonb_strip_nulls(jsonb_build_object('topic',topic,'class_kind','إضافية','event_time',new_time,'location',nullif(state->>'location','')));end if;
   manual:='تمت إضافة '||topic||' بتاريخ '||(state->>'session_date')||'.';
  else
   new_time:=nullif(state->>'session_date','')||'T'||nullif(state->>'session_time','');
   if new_time is not null then kind:='class_reminder';fields:=jsonb_strip_nulls(jsonb_build_object('topic',topic,'event_time',new_time,'location',nullif(state->>'location','')));end if;
   manual:='موعد '||topic||': '||coalesce(new_time,state->>'session_date')||'.';
  end if;
 end if;
 insert into public.announcement_sources(tenant_id,kind,source_id,after_state,type_key,values,title,manual_body) values(p_tenant,p_kind,p_id,state,kind,fields,left('تنبيه: '||topic,160),case when kind is null then manual else null end) returning id into source.id;
 return source.id;
end;$$;

create function public.record_announcement_source_change() returns trigger
language plpgsql security definer set search_path='' as $$
declare previous jsonb:='{}';kind text:=case when tg_table_name='sessions' then 'session' else 'material' end;
begin
 if tg_op='UPDATE' then
  previous:=case when kind='material' then jsonb_build_object('due_date',to_jsonb(old)->>'due_date') else jsonb_build_object('status',to_jsonb(old)->>'status','session_date',to_jsonb(old)->>'session_date','session_time',to_jsonb(old)->>'session_time','rescheduled_to_date',to_jsonb(old)->>'rescheduled_to_date','rescheduled_to_time',to_jsonb(old)->>'rescheduled_to_time') end;
 end if;
 perform public.capture_announcement_source(new.tenant_id,kind,new.id,previous);return new;
end;$$;
create trigger record_announcement_source_change after insert or update of title,type,url,group_id,group_ids,is_homework,due_date,questions,academic_year_id on public.study_materials for each row execute function public.record_announcement_source_change();
create trigger record_announcement_source_change after insert or update of group_id,session_date,session_time,start_time,status,rescheduled_to_date,rescheduled_to_time,is_extra,extra_topic on public.sessions for each row execute function public.record_announcement_source_change();

create function public.announcement_source_current(p_source uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select p_source is null or exists(select 1 from public.announcement_sources s where s.id=p_source and s.after_state=public.announcement_source_state(s.tenant_id,s.kind,s.source_id))
$$;

create function public.announcement_source_context(p_tenant uuid,p_user uuid,p_assistant uuid,p_source uuid,p_capability text default 'create') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare source public.announcement_sources;actor jsonb:=public.announcement_actor(p_tenant,p_user,p_assistant,p_capability);groups_selected uuid[];resource text;
begin
 select * into source from public.announcement_sources where id=p_source and tenant_id=p_tenant;
 if source.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 if not public.announcement_source_current(source.id) then raise exception 'SOURCE_CHANGED' using errcode='23514';end if;
 resource:=case when source.kind='session' then 'sessions' when source.after_state->>'type'='video' then 'video-lessons' when source.after_state->>'type' in ('online_quiz','paper_quiz','paper_exam') then case when source.after_state->>'exam_mode'='paper' or source.after_state->>'type' in ('paper_quiz','paper_exam') then 'paper-exams' else 'online-quizzes' end else 'materials' end;
 if p_assistant is not null and not exists(select 1 from public.assistant_accounts where assistant_id=p_assistant and tenant_id=p_tenant and (permissions->(resource||'.view')='true'::jsonb or source.kind='session' and permissions->'attendance.view'='true'::jsonb or source.after_state->>'is_homework'='true' and permissions->'homework.view'='true'::jsonb)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 select array_agg(g.id order by g.id) into groups_selected from public.groups g where g.tenant_id=p_tenant and public.portal_group_in_current_year(g.id,p_tenant) and (source.after_state->'group_ids'='null'::jsonb or source.after_state->'group_ids'?g.id::text) and public.announcement_groups_allowed(p_tenant,actor,array[g.id]);
 if coalesce(cardinality(groups_selected),0)=0 then if p_assistant is not null then raise exception 'FORBIDDEN' using errcode='42501';end if;raise exception 'SOURCE_NO_GROUPS' using errcode='23514';end if;
 return jsonb_build_object('source_event_id',source.id,'title',source.title,'type_key',source.type_key,'values',source.values,'manual_body',source.manual_body,'group_ids',to_jsonb(groups_selected),'recipient_roles',jsonb_build_array('parent','student'),'publish_on_portal',true);
end;$$;

create or replace function public.announcement_operation(p_tenant uuid,p_user uuid,p_assistant uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor jsonb;announcement public.teacher_announcements;kind public.announcement_types;item uuid;
 source_id uuid;source_context jsonb;groups_selected uuid[];roles_selected text[];phones_selected text[];capability text;result jsonb;
begin
 capability:=case when p_action in ('catalog','list','view','candidates','requests') then 'view' when p_action in ('create','request_type','source') then 'create' when p_action='consent' then 'send' when p_action='archive' then 'delete' when p_action in ('update','publish') then 'edit' else null end;
 if capability is null then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 actor:=public.announcement_actor(p_tenant,p_user,p_assistant,capability);
 if p_action='source' then
  if p_data->>'kind' not in ('material','session') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  source_id:=public.capture_announcement_source(p_tenant,p_data->>'kind',(p_data->>'id')::uuid);
  return public.announcement_source_context(p_tenant,p_user,p_assistant,source_id);
 elsif p_action='catalog' then
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
  if p_action='create' and announcement.id is not null then return jsonb_build_object('announcement',to_jsonb(announcement)||jsonb_build_object('source_values',(select src.values from public.announcement_sources src where src.id=announcement.source_event_id),'source_group_ids',(select src.after_state->'group_ids' from public.announcement_sources src where src.id=announcement.source_event_id)),'unchanged',true);end if;
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
  source_id:=coalesce(announcement.source_event_id,nullif(p_data->>'source_event_id','')::uuid);
  if announcement.source_event_id is not null and nullif(p_data->>'source_event_id','')::uuid is not null and announcement.source_event_id<>nullif(p_data->>'source_event_id','')::uuid then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if source_id is not null then
   source_context:=public.announcement_source_context(p_tenant,p_user,p_assistant,source_id,case when p_action='create' then 'create' else 'edit' end);
   if kind.key is distinct from source_context->>'type_key' or not groups_selected <@ array(select jsonb_array_elements_text(source_context->'group_ids')::uuid) or exists(select 1 from jsonb_each(source_context->'values') v where p_data->'values'->v.key is distinct from v.value) then raise exception 'SOURCE_VALUES_CHANGED' using errcode='23514';end if;
  end if;
  if p_action='create' then
   insert into public.teacher_announcements(id,tenant_id,created_by,assistant_id,title,type_key,group_ids,recipient_roles,values,manual_body,publish_on_portal,expires_at,source_event_id)
   values(item,p_tenant,p_user,p_assistant,btrim(p_data->>'title'),kind.key,groups_selected,roles_selected,coalesce(p_data->'values','{}'),nullif(btrim(p_data->>'manual_body'),''),coalesce((p_data->>'publish_on_portal')::boolean,true),nullif(p_data->>'expires_at','')::timestamptz,source_id) returning * into announcement;
  else
   -- Queue cancellation and allowance release are handled by the dedicated
   -- cancellation operation before revising a message that has queued sends.
   if exists(select 1 from public.announcement_recipients where announcement_id=item and status='queued') then raise exception 'CANCEL_QUEUE_FIRST' using errcode='23514';end if;
   update public.teacher_announcements set source_event_id=source_id,title=btrim(p_data->>'title'),type_key=kind.key,group_ids=groups_selected,recipient_roles=roles_selected,values=coalesce(p_data->'values','{}'),manual_body=nullif(btrim(p_data->>'manual_body'),''),publish_on_portal=coalesce((p_data->>'publish_on_portal')::boolean,true),expires_at=nullif(p_data->>'expires_at','')::timestamptz,revision=revision+1,status='draft',published_at=null,template_snapshot=null,updated_at=now() where id=item returning * into announcement;
  end if;
  return jsonb_build_object('announcement',to_jsonb(announcement)||jsonb_build_object('source_values',(select src.values from public.announcement_sources src where src.id=announcement.source_event_id),'source_group_ids',(select src.after_state->'group_ids' from public.announcement_sources src where src.id=announcement.source_event_id)));
 end if;
 if announcement.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 if p_action in ('publish','candidates') and not public.announcement_source_current(announcement.source_event_id) then raise exception 'SOURCE_CHANGED' using errcode='23514';end if;
 if p_action='view' then
  return jsonb_build_object('announcement',to_jsonb(announcement)||jsonb_build_object('source_values',(select src.values from public.announcement_sources src where src.id=announcement.source_event_id),'source_group_ids',(select src.after_state->'group_ids' from public.announcement_sources src where src.id=announcement.source_event_id)),'deliveries',coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select r.id,r.phone,r.recipient_role,r.status,r.attempts,r.provider_error_code,r.skip_reason,r.created_at,r.sent_at from public.announcement_recipients r where r.announcement_id=item and r.tenant_id=p_tenant and r.revision=announcement.revision order by r.created_at desc limit 1000) x),'[]'::jsonb));
 end if;
 if p_action='archive' then
  if exists(select 1 from public.announcement_recipients where announcement_id=item and status='sending') then raise exception 'ANNOUNCEMENT_BUSY' using errcode='23514';end if;
  if exists(select 1 from public.announcement_recipients where announcement_id=item and status='queued') then raise exception 'CANCEL_QUEUE_FIRST' using errcode='23514';end if;
  update public.teacher_announcements set status='archived',updated_at=now() where id=item;
  return jsonb_build_object('id',item,'status','archived');
 end if;
 if not public.announcement_groups_allowed(p_tenant,actor,announcement.group_ids) then raise exception 'GROUP_NOT_ACTIVE' using errcode='23514';end if;
 if p_action='candidates' then
  return jsonb_build_object('announcement',to_jsonb(announcement)||jsonb_build_object('source_values',(select src.values from public.announcement_sources src where src.id=announcement.source_event_id),'source_group_ids',(select src.after_state->'group_ids' from public.announcement_sources src where src.id=announcement.source_event_id)),'contacts',(select coalesce(jsonb_agg(to_jsonb(c)),'[]'::jsonb) from public.announcement_recipient_candidates(p_tenant,announcement.group_ids,announcement.recipient_roles) c),'allowance',(select jsonb_build_object('remaining',message_limit-reserved-sent,'unit_cost_egp',unit_cost_egp,'period',period) from public.announcement_allowances where tenant_id=p_tenant and period=date_trunc('month',now() at time zone 'Africa/Cairo')::date));
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
  if announcement.status='published' then return jsonb_build_object('announcement',to_jsonb(announcement)||jsonb_build_object('source_values',(select src.values from public.announcement_sources src where src.id=announcement.source_event_id),'source_group_ids',(select src.after_state->'group_ids' from public.announcement_sources src where src.id=announcement.source_event_id)),'unchanged',true);end if;
  if announcement.type_key is not null then select * into kind from public.announcement_types where key=announcement.type_key and available;if kind.key is null then raise exception 'TYPE_UNAVAILABLE' using errcode='23514';end if;end if;
  update public.teacher_announcements set status='published',published_at=now(),updated_at=now(),template_snapshot=case when kind.key is null then null else jsonb_build_object('key',kind.key,'name',kind.meta_name,'id',kind.meta_id,'title',kind.title,'body',kind.body,'fields',kind.fields) end where id=item returning * into announcement;
  return jsonb_build_object('announcement',to_jsonb(announcement)||jsonb_build_object('source_values',(select src.values from public.announcement_sources src where src.id=announcement.source_event_id),'source_group_ids',(select src.after_state->'group_ids' from public.announcement_sources src where src.id=announcement.source_event_id)));
 end if;
 raise exception 'INVALID_INPUT' using errcode='22023';
end;$$;

create or replace function public.announcement_queue(p_tenant uuid,p_user uuid,p_assistant uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor jsonb; ann public.teacher_announcements; preview public.announcement_previews;
 allowance public.announcement_allowances; kind public.announcement_types; row_data jsonb;
 rec public.announcement_recipients; attempt_id uuid; preview_id uuid; selected text[]; count_new integer:=0; item uuid;
 month_start date:=date_trunc('month',now() at time zone 'Africa/Cairo')::date; actor_name text;
begin
 if p_action not in ('preview','enqueue','cancel','retry') then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 actor:=public.announcement_actor(p_tenant,p_user,p_assistant,'send');
 perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':announcement-queue',0));
 item:=(p_data->>'id')::uuid;
 perform pg_advisory_xact_lock(hashtextextended(item::text||':announcement',0));
 select * into ann from public.teacher_announcements where id=item and tenant_id=p_tenant for update;
 if ann.id is null then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 if not public.announcement_groups_allowed(p_tenant,actor,ann.group_ids,false) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action='cancel' then
  for rec in select * from public.announcement_recipients where announcement_id=item and tenant_id=p_tenant and status='queued' for update loop
   update public.announcement_allowances set reserved=reserved-1 where tenant_id=p_tenant and period=rec.period;
   update public.announcement_delivery_attempts set status='skipped',error_code='CANCELLED',updated_at=now() where id=rec.current_attempt_id and status='queued';
   update public.announcement_recipients set status='skipped',skip_reason='CANCELLED',updated_at=now() where id=rec.id;
   count_new:=count_new+1;
  end loop;
  return jsonb_build_object('cancelled',count_new);
 end if;
 if not public.announcement_source_current(ann.source_event_id) then raise exception 'SOURCE_CHANGED' using errcode='23514';end if;
 if not public.announcement_groups_allowed(p_tenant,actor,ann.group_ids) then raise exception 'GROUP_NOT_ACTIVE' using errcode='23514';end if;
 if ann.status<>'published' or ann.expires_at<=now() or (p_data->>'expected_revision')::int is distinct from ann.revision then raise exception 'REVISION_CHANGED' using errcode='23514';end if;
 if p_action='preview' then
  preview_id:=(p_data->>'preview_id')::uuid;
  if preview_id is null or jsonb_typeof(p_data->'rows')<>'array' or jsonb_array_length(p_data->'rows') not between 1 and 10000 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if exists(select 1 from jsonb_array_elements(p_data->'rows') r where jsonb_typeof(r->'parameters')<>'array' or length(coalesce(r->>'rendered_body','')) not between 1 and 4096 or not exists(select 1 from public.announcement_recipient_candidates(p_tenant,ann.group_ids,ann.recipient_roles) c where c.phone=r->>'phone' and c.recipient_role=r->>'recipient_role' and to_jsonb(c.group_ids)=r->'group_ids')) or (select count(distinct r->>'phone') from jsonb_array_elements(p_data->'rows') r)<>jsonb_array_length(p_data->'rows') then raise exception 'AUDIENCE_CHANGED' using errcode='23514';end if;
  delete from public.announcement_previews where tenant_id=p_tenant and expires_at<now();
  insert into public.announcement_previews(id,tenant_id,announcement_id,revision,created_by,assistant_id,rows) values(preview_id,p_tenant,item,ann.revision,p_user,p_assistant,p_data->'rows');
  return jsonb_build_object('preview_id',preview_id,'expires_at',now()+interval '10 minutes');
 end if;
 select * into preview from public.announcement_previews where id=(p_data->>'preview_id')::uuid and tenant_id=p_tenant and announcement_id=item and created_by=p_user and assistant_id is not distinct from p_assistant and revision=ann.revision and expires_at>now();
 if preview.id is null then raise exception 'PREVIEW_EXPIRED' using errcode='23514';end if;
 selected:=array(select distinct jsonb_array_elements_text(coalesce(p_data->'phones','[]')) order by 1);
 if cardinality(selected) not between 1 and 10000 or exists(select 1 from unnest(selected) s(phone) where not exists(select 1 from jsonb_array_elements(preview.rows) r where r->>'phone'=s.phone)) then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 select * into kind from public.announcement_types where key=ann.type_key and available and official_enabled and category='UTILITY' and provider_category='UTILITY' and provider_status='APPROVED';
 if kind.key is null or ann.template_snapshot->>'id' is distinct from kind.meta_id or ann.template_snapshot->>'body' is distinct from kind.body or ann.template_snapshot->>'name' is distinct from kind.meta_name or ann.template_snapshot->'fields' is distinct from kind.fields then raise exception 'TEMPLATE_NOT_ENABLED' using errcode='23514';end if;
 select * into allowance from public.announcement_allowances where tenant_id=p_tenant and period=month_start for update;
 if allowance.tenant_id is null or allowance.unit_cost_egp is null then raise exception 'ALLOWANCE_NOT_CONFIGURED' using errcode='23514';end if;
 if (p_data->>'unit_cost_egp')::numeric is distinct from allowance.unit_cost_egp then raise exception 'PRICE_CHANGED' using errcode='23514';end if;
 select case when p_assistant is null then coalesce(full_name,'المدرس') else (select name from public.assistants where id=p_assistant) end into actor_name from public.users where id=p_user;
 if exists(with audience as materialized(select * from public.announcement_recipient_candidates(p_tenant,ann.group_ids,ann.recipient_roles))
  select 1 from jsonb_array_elements(preview.rows) r left join audience c on c.phone=r->>'phone' and c.recipient_role=r->>'recipient_role' and to_jsonb(c.group_ids)=r->'group_ids' and to_jsonb(c.group_names)=r->'group_names'
  where r->>'phone'=any(selected) and (c.phone is null or not c.consented or c.opted_out)) then raise exception 'AUDIENCE_OR_CONSENT_CHANGED' using errcode='23514';end if;
 for row_data in select r from jsonb_array_elements(preview.rows) r where r->>'phone'=any(selected) loop
  select * into rec from public.announcement_recipients where announcement_id=item and revision=ann.revision and phone=row_data->>'phone' for update;
  if rec.id is not null then
   -- A normal repeated click never retries. Retry is explicit and failed only.
   if p_action<>'retry' or rec.status<>'failed' then continue;end if;
  elsif p_action='retry' then continue;
  else
   insert into public.announcement_recipients(tenant_id,announcement_id,revision,queued_by_user_id,queued_by_assistant_id,queued_actor_name,phone,recipient_role,group_ids,group_names,parameters,rendered_body,period)
   values(p_tenant,item,ann.revision,p_user,p_assistant,actor_name,row_data->>'phone',row_data->>'recipient_role',array(select jsonb_array_elements_text(row_data->'group_ids')::uuid),array(select jsonb_array_elements_text(row_data->'group_names')),row_data->'parameters',row_data->>'rendered_body',month_start) returning * into rec;
  end if;
  count_new:=count_new+1;
  insert into public.announcement_delivery_attempts(recipient_id,tenant_id,period,unit_cost_egp,actor_user_id,actor_assistant_id,actor_name) values(rec.id,p_tenant,month_start,allowance.unit_cost_egp,p_user,p_assistant,actor_name) returning id into attempt_id;
  update public.announcement_recipients set current_attempt_id=attempt_id,status='queued',period=month_start,queued_by_user_id=p_user,queued_by_assistant_id=p_assistant,queued_actor_name=actor_name,parameters=row_data->'parameters',rendered_body=row_data->>'rendered_body',provider_message_id=null,provider_error_code=null,skip_reason=null,lease_until=null,updated_at=now() where id=rec.id;
 end loop;
 if count_new+allowance.reserved+allowance.sent>allowance.message_limit then raise exception 'ALLOWANCE_EXCEEDED' using errcode='23514';end if;
 update public.announcement_allowances set reserved=reserved+count_new where tenant_id=p_tenant and period=month_start;
 return jsonb_build_object('queued',count_new,'unit_cost_egp',allowance.unit_cost_egp,'total_egp',count_new*allowance.unit_cost_egp);
end;$$;

create or replace function public.announcement_worker(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tenant uuid; rec public.announcement_recipients; attempt public.announcement_delivery_attempts;
 ann public.teacher_announcements; kind public.announcement_types; actor jsonb; reason text; result_status text;
 month_start date:=date_trunc('month',now() at time zone 'Africa/Cairo')::date;
begin
 if p_action='claim' then
  for tenant in select distinct tenant_id from public.announcement_recipients where status in ('queued','sending') and not exists(select 1 from public.account_deletion_jobs j where j.tenant_id=announcement_recipients.tenant_id and j.state<>'done') limit 20 loop
   if not pg_try_advisory_xact_lock(hashtextextended(tenant::text||':announcement-queue',0)) then continue;end if;
   for rec in select * from public.announcement_recipients where tenant_id=tenant and (status='queued' or status='sending' and lease_until<now()) order by created_at for update skip locked limit 30 loop
    select * into attempt from public.announcement_delivery_attempts where id=rec.current_attempt_id for update;
    if rec.status='sending' then
     update public.announcement_delivery_attempts set status='unknown',error_code='LEASE_EXPIRED',lease_until=null,updated_at=now() where id=attempt.id;
     update public.announcement_recipients set status='unknown',provider_error_code='LEASE_EXPIRED',lease_until=null,updated_at=now() where id=rec.id;
     continue;
    end if;
    reason:=null;
    begin actor:=public.announcement_actor(tenant,attempt.actor_user_id,attempt.actor_assistant_id,'send');
    exception when insufficient_privilege then reason:='ACTOR_ACCESS_CHANGED';end;
    select * into ann from public.teacher_announcements where id=rec.announcement_id and tenant_id=tenant;
    select * into kind from public.announcement_types where key=ann.type_key;
    if reason is null and (ann.id is null or ann.status<>'published' or ann.revision<>rec.revision or ann.expires_at<=now()) then reason:='ANNOUNCEMENT_CHANGED';end if;
    if reason is null and not public.announcement_source_current(ann.source_event_id) then reason:='SOURCE_CHANGED';end if;
    if reason is null and not public.announcement_groups_allowed(tenant,actor,ann.group_ids) then reason:='GROUP_ACCESS_CHANGED';end if;
    if reason is null and (kind.key is null or not kind.available or not kind.official_enabled or kind.category<>'UTILITY' or kind.provider_category is distinct from 'UTILITY' or kind.provider_status<>'APPROVED' or ann.template_snapshot->>'body' is distinct from kind.body or ann.template_snapshot->>'id' is distinct from kind.meta_id or ann.template_snapshot->>'name' is distinct from kind.meta_name or ann.template_snapshot->'fields' is distinct from kind.fields) then reason:='TEMPLATE_NOT_ENABLED';end if;
    if reason is null and attempt.period<>month_start then reason:='BILLING_PERIOD_CHANGED';end if;
    if reason is null and not exists(select 1 from public.announcement_recipient_candidates(tenant,ann.group_ids,ann.recipient_roles) c where c.phone=rec.phone and c.recipient_role=rec.recipient_role and c.group_ids=rec.group_ids and c.group_names=rec.group_names and c.consented and not c.opted_out) then reason:='AUDIENCE_OR_CONSENT_CHANGED';end if;
    if reason is not null then
     update public.announcement_allowances set reserved=reserved-1 where tenant_id=tenant and period=attempt.period;
     update public.announcement_delivery_attempts set status='skipped',error_code=reason,updated_at=now() where id=attempt.id;
     update public.announcement_recipients set status='skipped',skip_reason=reason,updated_at=now() where id=rec.id;
     continue;
    end if;
    update public.announcement_delivery_attempts set status='sending',lease_until=now()+interval '2 minutes',updated_at=now() where id=attempt.id;
    update public.announcement_recipients set status='sending',attempts=attempts+1,lease_until=now()+interval '2 minutes',updated_at=now() where id=rec.id;
    return jsonb_build_object('attempt_id',attempt.id,'to',rec.phone,'template',ann.template_snapshot,'parameters',rec.parameters);
   end loop;
  end loop;
  return null;
 elsif p_action='settle' then
  select tenant_id into tenant from public.announcement_delivery_attempts where id=(p_data->>'attempt_id')::uuid;
  if tenant is null or exists(select 1 from public.account_deletion_jobs where tenant_id=tenant and state<>'done') then return jsonb_build_object('ignored',true);end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text||':announcement-queue',0));
  select * into attempt from public.announcement_delivery_attempts where id=(p_data->>'attempt_id')::uuid for update;
  if attempt.status not in ('sending','unknown') or attempt.accepted then return jsonb_build_object('unchanged',true);end if;
  if p_data->>'outcome'='accepted' and coalesce(p_data->>'message_id','') ~ '^wamid\.' then
   result_status:='sent';
   update public.announcement_allowances set reserved=reserved-1,sent=sent+1 where tenant_id=tenant and period=attempt.period;
   update public.announcement_delivery_attempts set accepted=true,provider_message_id=p_data->>'message_id' where id=attempt.id;
  elsif p_data->>'outcome'='not_sent' and attempt.status='sending' then
   result_status:='failed';
   update public.announcement_allowances set reserved=reserved-1 where tenant_id=tenant and period=attempt.period;
  else result_status:='unknown';end if;
  update public.announcement_delivery_attempts set status=result_status,error_code=left(p_data->>'error_code',100),lease_until=null,updated_at=now() where id=attempt.id;
  update public.announcement_recipients set status=result_status,provider_message_id=case when result_status='sent' then p_data->>'message_id' else provider_message_id end,provider_error_code=left(p_data->>'error_code',100),lease_until=null,sent_at=case when result_status='sent' then now() else sent_at end,updated_at=now() where id=attempt.recipient_id and current_attempt_id=attempt.id;
  return jsonb_build_object('status',result_status);
 elsif p_action='delivery' then
  select tenant_id into tenant from public.announcement_delivery_attempts where provider_message_id=p_data->>'message_id';
  if tenant is null or exists(select 1 from public.account_deletion_jobs where tenant_id=tenant and state<>'done') then return jsonb_build_object('ignored',true);end if;
  perform pg_advisory_xact_lock(hashtextextended(tenant::text||':announcement-queue',0));
  select * into attempt from public.announcement_delivery_attempts where provider_message_id=p_data->>'message_id' for update;
  result_status:=p_data->>'status';
  if result_status not in ('sent','delivered','read','failed') or not attempt.accepted or attempt.status='read' or attempt.status='delivered' and result_status<>'read' or attempt.status='failed' then return jsonb_build_object('unchanged',true);end if;
  update public.announcement_delivery_attempts set status=result_status,error_code=case when result_status='failed' then left(p_data->>'error_code',100) else null end,updated_at=now() where id=attempt.id;
  update public.announcement_recipients set status=result_status,provider_error_code=case when result_status='failed' then left(p_data->>'error_code',100) else null end,updated_at=now() where id=attempt.recipient_id and current_attempt_id=attempt.id;
  return jsonb_build_object('status',result_status);
 end if;
 raise exception 'INVALID_INPUT' using errcode='22023';
end;$$;

create or replace function public.portal_announcements(p_student uuid,p_tenant uuid,p_role text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.published_at desc),'[]'::jsonb) from (
  select a.id,a.title,a.published_at,a.expires_at,
   coalesce(a.manual_body,(select string_agg((f->>'label')||': '||(a.values->>(f->>'key')),E'\n' order by position)
    from jsonb_array_elements(a.template_snapshot->'fields') with ordinality fields(f,position)
    where f->>'type' in ('text','choice','date','datetime'))) body
  from public.teacher_announcements a join public.students s on s.id=p_student and s.tenant_id=a.tenant_id and s.archived_at is null
  where a.tenant_id=p_tenant and p_role in ('parent','student') and p_role=any(a.recipient_roles)
   and (public.portal_preferences(p_tenant)->>'show_announcements')::boolean
   and public.announcement_source_current(a.source_event_id)
   and a.status='published' and a.publish_on_portal and a.published_at<=now() and (a.expires_at is null or a.expires_at>now())
   and exists(select 1 from public.groups g where g.tenant_id=p_tenant and g.id=any(a.group_ids) and public.portal_group_in_current_year(g.id,p_tenant)
     and (s.group_id=g.id or exists(select 1 from public.group_students gs where gs.student_id=s.id and gs.tenant_id=p_tenant and gs.group_id=g.id)))
  order by a.published_at desc limit 20
 ) x
$$;

revoke all on function public.announcement_clock_time(text) from public,anon,authenticated;
grant execute on function public.announcement_clock_time(text) to service_role;

revoke all on function public.announcement_source_state(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.announcement_source_state(uuid,text,uuid) to service_role;

revoke all on function public.capture_announcement_source(uuid,text,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.capture_announcement_source(uuid,text,uuid,jsonb) to service_role;

revoke all on function public.record_announcement_source_change() from public,anon,authenticated;
grant execute on function public.record_announcement_source_change() to service_role;

revoke all on function public.announcement_source_current(uuid) from public,anon,authenticated;
grant execute on function public.announcement_source_current(uuid) to service_role;

revoke all on function public.announcement_source_context(uuid,uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.announcement_source_context(uuid,uuid,uuid,uuid,text) to service_role;

create trigger account_deletion_freeze before insert or update on public.announcement_sources for each row execute function public.guard_deleting_account();
create trigger account_deletion_freeze before insert or update on public.portal_quiz_attempts for each row execute function public.guard_deleting_account();

create or replace function public.account_data_export(p_user uuid) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare actor jsonb:=public.account_deletion_actor(p_user);tenant uuid:=(actor->>'tenant_id')::uuid;
 item text;rows jsonb;result jsonb:='{}';
begin
 foreach item in array array['students','groups','group_students','enrollments','sessions','attendance','quizzes','quiz_scores','study_materials','homework_submissions','portal_quiz_attempts','announcement_sources','teachers','assistants','student_collections','teacher_payouts','academic_years','academic_year_students','classroom_history','teacher_announcements','announcement_type_requests','support_tickets','tenant_platform_settings','rooms'] loop
  execute format('select coalesce(jsonb_agg(public.account_export_redact(to_jsonb(source))),''[]''::jsonb) from public.%I source where tenant_id=$1',item) into rows using tenant;
  result:=result||jsonb_build_object(item,rows);
 end loop;
 select public.account_export_redact(to_jsonb(t)) into rows from public.tenants t where id=tenant;
 result:=result||jsonb_build_object('account',rows,'exported_at',now(),'format_version',1,
  'legacy_quizzes',(select coalesce(jsonb_agg(public.account_export_redact(public.portal_parse_legacy_json(message_body))),'[]'::jsonb) from public.whatsapp_inbox where tenant_id is null and public.account_legacy_owned(message_body,tenant)),
  'assistant_access',(select coalesce(jsonb_agg(jsonb_build_object('assistant_id',assistant_id,'permissions',permissions,'group_ids',group_ids,'all_groups',all_groups)),'[]'::jsonb) from public.assistant_accounts where tenant_id=tenant),
  'support_replies',(select coalesce(jsonb_agg(public.account_export_redact(to_jsonb(r))),'[]'::jsonb) from public.support_replies r join public.support_tickets t on t.id=r.ticket_id where t.tenant_id=tenant));
 return result;
end;$$;
