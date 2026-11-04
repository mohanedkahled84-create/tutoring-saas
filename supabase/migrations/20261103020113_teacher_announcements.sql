create table public.announcement_types(
 key text primary key check(key ~ '^[a-z][a-z0-9_]{2,49}$'),
 meta_name text not null unique,meta_id text unique,title text not null,body text not null check(length(body) between 80 and 1024),fields jsonb not null check(jsonb_typeof(fields)='array' and jsonb_array_length(fields) between 3 and 10),
 category text not null default 'UTILITY' check(category='UTILITY'),language text not null default 'ar' check(language='ar'),
 available boolean not null default true,official_enabled boolean not null default false,
 provider_status text not null default 'PENDING',provider_category text,checked_at timestamptz,created_at timestamptz not null default now()
);
create table public.teacher_announcements(
 id uuid primary key,tenant_id uuid not null references public.tenants(id) on delete cascade,
 created_by uuid not null references public.users(id),assistant_id uuid references public.assistants(id) on delete set null,
 title text not null check(length(btrim(title)) between 1 and 160),type_key text references public.announcement_types(key),
 group_ids uuid[] not null check(cardinality(group_ids) between 1 and 200),recipient_roles text[] not null check(cardinality(recipient_roles) between 1 and 2 and recipient_roles<@array['student','parent']::text[]),
 values jsonb not null default '{}' check(jsonb_typeof(values)='object'),manual_body text check(manual_body is null or length(manual_body)<=4000),
 template_snapshot jsonb,status text not null default 'draft' check(status in ('draft','published','archived')),
 publish_on_portal boolean not null default true,published_at timestamptz,expires_at timestamptz,
 revision integer not null default 1 check(revision>0),created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index teacher_announcements_tenant_date on public.teacher_announcements(tenant_id,updated_at desc);
create index teacher_announcements_groups on public.teacher_announcements using gin(group_ids);
create table public.announcement_consents(
 tenant_id uuid not null references public.tenants(id) on delete cascade,phone text not null check(phone ~ '^[0-9]{10,15}$'),
 granted boolean not null,source text not null check(source in ('teacher_recorded','recipient_request')),
 actor_user_id uuid references public.users(id) on delete set null,assistant_id uuid references public.assistants(id) on delete set null,
 recorded_at timestamptz not null default now(),primary key(tenant_id,phone)
);
create table public.announcement_optouts(
 phone text primary key check(phone ~ '^[0-9]{10,15}$'),source_message_id text unique not null,blocked boolean not null default true,last_event_at timestamptz not null,blocked_at timestamptz not null default now()
);
create table public.announcement_allowances(
 tenant_id uuid not null references public.tenants(id) on delete cascade,period date not null check(extract(day from period)=1),
 message_limit integer not null default 0 check(message_limit between 0 and 1000000),unit_cost_egp numeric(12,4) check(unit_cost_egp>=0),
 reserved integer not null default 0 check(reserved>=0),sent integer not null default 0 check(sent>=0),primary key(tenant_id,period),
 check(reserved+sent<=message_limit)
);
create table public.announcement_recipients(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,
 announcement_id uuid not null references public.teacher_announcements(id) on delete cascade,revision integer not null,
 queued_by_user_id uuid not null references public.users(id),queued_by_assistant_id uuid,queued_actor_name text not null,
 phone text not null check(phone ~ '^[0-9]{10,15}$'),recipient_role text not null check(recipient_role in ('student','parent')),
 group_ids uuid[] not null,group_names text[] not null,parameters jsonb not null check(jsonb_typeof(parameters)='array'),rendered_body text not null,
 status text not null default 'queued' check(status in ('queued','sending','sent','delivered','read','failed','unknown','skipped')),
 provider_message_id text,provider_error_code text,skip_reason text,period date,lease_until timestamptz,attempts integer not null default 0,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),sent_at timestamptz,
 unique(announcement_id,revision,phone)
);
create unique index announcement_provider_message_unique on public.announcement_recipients(provider_message_id) where provider_message_id is not null;
create index announcement_recipients_claim on public.announcement_recipients(status,created_at) where status='queued';
create index announcement_recipients_tenant on public.announcement_recipients(tenant_id,announcement_id,revision);
create table public.announcement_delivery_attempts(
 id uuid primary key default gen_random_uuid(),recipient_id uuid not null references public.announcement_recipients(id) on delete cascade,
 tenant_id uuid not null references public.tenants(id) on delete cascade,period date not null,unit_cost_egp numeric(12,4) not null check(unit_cost_egp>=0),
 actor_user_id uuid not null references public.users(id),actor_assistant_id uuid,actor_name text not null,
 status text not null default 'queued' check(status in ('queued','sending','sent','delivered','read','failed','unknown','skipped')),
 accepted boolean not null default false,provider_message_id text unique,error_code text,lease_until timestamptz,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
alter table public.announcement_recipients add column current_attempt_id uuid references public.announcement_delivery_attempts(id) on delete set null;
create index announcement_attempts_pending on public.announcement_delivery_attempts(status,created_at) where status in ('queued','sending');
create table public.announcement_previews(
 id uuid primary key,tenant_id uuid not null references public.tenants(id) on delete cascade,
 announcement_id uuid not null references public.teacher_announcements(id) on delete cascade,revision integer not null,
 created_by uuid not null references public.users(id),assistant_id uuid references public.assistants(id) on delete set null,
 rows jsonb not null check(jsonb_typeof(rows)='array' and jsonb_array_length(rows)<=10000),
 expires_at timestamptz not null default now()+interval '10 minutes',created_at timestamptz not null default now()
);
create table public.announcement_type_requests(
 id uuid primary key,tenant_id uuid not null references public.tenants(id) on delete cascade,created_by uuid not null references public.users(id),
 assistant_id uuid references public.assistants(id) on delete set null,title text not null check(length(btrim(title)) between 1 and 100),
 description text not null check(length(btrim(description)) between 1 and 2000),sample_body text not null check(length(btrim(sample_body)) between 1 and 1024),
 status text not null default 'submitted' check(status in ('submitted','reviewing','meta_pending','available','rejected')),
 type_key text references public.announcement_types(key),admin_notes text,created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index announcement_type_requests_tenant on public.announcement_type_requests(tenant_id,created_at desc);

alter table public.announcement_types enable row level security;
alter table public.teacher_announcements enable row level security;
alter table public.announcement_consents enable row level security;
alter table public.announcement_optouts enable row level security;
alter table public.announcement_allowances enable row level security;
alter table public.announcement_recipients enable row level security;
alter table public.announcement_delivery_attempts enable row level security;
alter table public.announcement_previews enable row level security;
alter table public.announcement_type_requests enable row level security;
revoke all on public.announcement_types,public.teacher_announcements,public.announcement_consents,public.announcement_optouts,public.announcement_allowances,public.announcement_recipients,public.announcement_delivery_attempts,public.announcement_previews,public.announcement_type_requests from public,anon,authenticated;
grant all on public.announcement_types,public.teacher_announcements,public.announcement_consents,public.announcement_optouts,public.announcement_allowances,public.announcement_recipients,public.announcement_delivery_attempts,public.announcement_previews,public.announcement_type_requests to service_role;

-- Only the authenticated server / signed worker can call these functions.
-- Assistant identity is injected by the delegated RPC boundary; scope and current
-- capabilities are also checked from private account records on every operation.
create function public.announcement_actor(p_tenant uuid,p_user uuid,p_assistant uuid,p_action text)
returns jsonb language plpgsql stable security invoker set search_path='' as $$
declare staff public.assistants;account public.assistant_accounts;
begin
 if p_action not in ('view','create','edit','send','delete') or not exists(select 1 from public.users u join public.tenants t on t.id=u.tenant_id where u.id=p_user and u.tenant_id=p_tenant and u.role in ('owner','teacher','center_owner') and t.status='active' and t.deleted_at is null) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_assistant is null then return jsonb_build_object('all_groups',true,'group_ids','[]'::jsonb,'teacher_id',(select teacher_id from public.users where id=p_user and role='teacher'));end if;
 select * into staff from public.assistants where id=p_assistant and tenant_id=p_tenant and status='active';
 select * into account from public.assistant_accounts where assistant_id=p_assistant and tenant_id=p_tenant;
 if staff.id is null or account.assistant_id is null or account.permissions->'announcements.view' is distinct from 'true'::jsonb or account.permissions->('announcements.'||p_action) is distinct from 'true'::jsonb then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if staff.teacher_id is not null and not exists(select 1 from public.teachers t where t.id=staff.teacher_id and t.tenant_id=p_tenant and t.user_id=p_user) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 return jsonb_build_object('all_groups',account.all_groups,'group_ids',account.group_ids,'teacher_id',staff.teacher_id);
end;$$;
create function public.announcement_groups_allowed(p_tenant uuid,p_actor jsonb,p_groups uuid[],p_active boolean default true)
returns boolean language sql stable security invoker set search_path='' as $$
 select cardinality(p_groups) between 1 and 200 and array_position(p_groups,null) is null and not exists(
 select 1 from unnest(p_groups) selected(id) where not exists(select 1 from public.groups g where g.id=selected.id and g.tenant_id=p_tenant
  and (not p_active or public.portal_group_in_current_year(g.id,p_tenant))
  and ((p_actor->>'all_groups')::boolean or p_actor->'group_ids'?g.id::text)
  and (p_actor->>'teacher_id' is null or g.teacher_id is null or g.teacher_id=(p_actor->>'teacher_id')::uuid)))
$$;
create function public.announcement_phone(p_raw text) returns text
language sql immutable security invoker set search_path='' as $$
 with cleaned as (select regexp_replace(translate(coalesce(p_raw,''),'٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹','01234567890123456789'),'[^0-9]','','g') phone),normalized as(
 select case when phone ~ '^01[0-9]{9}$' then '2'||phone when phone like '00%' then substr(phone,3) else phone end phone from cleaned)
 select case when phone ~ '^[1-9][0-9]{9,14}$' then phone else null end from normalized
$$;
revoke all on function public.announcement_actor(uuid,uuid,uuid,text),public.announcement_groups_allowed(uuid,jsonb,uuid[],boolean),public.announcement_phone(text) from public,anon,authenticated;
grant execute on function public.announcement_actor(uuid,uuid,uuid,text),public.announcement_groups_allowed(uuid,jsonb,uuid[],boolean),public.announcement_phone(text) to service_role;

insert into public.announcement_types(key,meta_name,meta_id,title,body,fields,provider_status,provider_category)
select key,name,id,title,body,fields,'PENDING','UTILITY' from jsonb_to_recordset($catalog$[{"key": "class_rescheduled", "name": "centerly_class_rescheduled_v1", "id": "1663107042276982", "body": "تم تعديل موعد حصة {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} الموعد السابق: {{4}} الموعد الجديد: {{5}} التغيير يخص هذه الحصة فقط، وباقي الجدول كما هو. رقم المدرس للاستفسار: {{6}} يرجى اعتماد الموعد الجديد لهذه الحصة.", "title": "تغيير موعد حصة", "fields": [{"key": "topic", "label": "اسم الحصة", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "old_time", "label": "الموعد السابق", "type": "datetime"}, {"key": "new_time", "label": "الموعد الجديد", "type": "datetime"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "class_cancelled", "name": "centerly_class_cancelled_v1", "id": "2133950004161317", "body": "تم إلغاء حصة {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} موعد الحصة الملغاة: {{4}} هذه الحصة لن تعقد في الموعد المذكور. سيظهر أي موعد تعويضي بعد تحديده في جدول مجموعتك. رقم المدرس للاستفسار: {{5}} يرجى مراجعة جدول الدراسة لمعرفة مواعيدك الحالية.", "title": "إلغاء حصة", "fields": [{"key": "topic", "label": "اسم الحصة", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "cancelled_time", "label": "موعد الحصة الملغاة", "type": "datetime"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "class_location", "name": "centerly_class_location_v1", "id": "29425294190428157", "body": "تم تعديل مكان حصة {{1}} المسجلة مع {{2}} لمجموعة {{3}}. تاريخ وموعد الحصة: {{4}} المكان السابق: {{5}} المكان الجديد أو رابط الحضور: {{6}} رقم المدرس للاستفسار: {{7}} يرجى استخدام المكان الجديد لهذه الحصة فقط.", "title": "تغيير مكان الحصة", "fields": [{"key": "topic", "label": "اسم الحصة", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "event_time", "label": "موعد الحصة أو الاختبار", "type": "datetime"}, {"key": "old_location", "label": "المكان السابق", "type": "text"}, {"key": "location", "label": "المكان أو رابط الحضور", "type": "text"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "study_content", "name": "centerly_study_content_v1", "id": "1879333159920353", "body": "أصبح محتوى {{1}} متاحًا ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} اسم المحتوى: {{4}} رابط فتحه في حسابك: {{5}} رقم المدرس للاستفسار: {{6}} هذا المحتوى مخصص للمجموعة المسجلة، ويخضع لصلاحيات حسابك.", "title": "محتوى دراسي جديد", "fields": [{"key": "content_type", "label": "نوع المحتوى", "type": "choice", "options": ["فيديو شرح", "مذكرة", "ملف تدريبي"]}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "content_title", "label": "اسم المحتوى", "type": "text"}, {"key": "portal", "label": "رابط الدراسة", "type": "portal"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "homework_assigned", "name": "centerly_homework_assigned_v1", "id": "2298159074058540", "body": "تم إسناد واجب {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} آخر موعد للتسليم: {{4}} رابط الواجب في حسابك: {{5}} رقم المدرس للاستفسار: {{6}} يرجى مراجعة تعليمات الواجب وسياسة التسليم الموضحة في حسابك.", "title": "واجب جديد", "fields": [{"key": "homework_title", "label": "عنوان الواجب", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "due", "label": "موعد التسليم", "type": "date"}, {"key": "portal", "label": "رابط الدراسة", "type": "portal"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "homework_deadline", "name": "centerly_homework_deadline_v1", "id": "1128524159554873", "body": "تم تعديل آخر موعد لتسليم واجب {{1}} المسند لمجموعتك لدى {{2}}. المجموعة: {{3}} الموعد السابق: {{4}} الموعد الجديد: {{5}} رابط مراجعة الواجب: {{6}} رقم المدرس للاستفسار: {{7}} يسري الموعد الجديد على هذا الواجب فقط.", "title": "تغيير موعد تسليم واجب", "fields": [{"key": "homework_title", "label": "عنوان الواجب", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "old_due", "label": "موعد التسليم السابق", "type": "date"}, {"key": "new_due", "label": "موعد التسليم الجديد", "type": "date"}, {"key": "portal", "label": "رابط الدراسة", "type": "portal"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "exam_schedule", "name": "centerly_exam_schedule_v1", "id": "1647625423688941", "body": "تم تحديد موعد اختبار {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} التاريخ والوقت المعتمدان: {{4}} المكان أو رابط الاختبار: {{5}} رقم المدرس للاستفسار: {{6}} هذا إشعار بموعد الاختبار الحالي؛ يرجى مراجعة تعليماته في حسابك.", "title": "موعد اختبار", "fields": [{"key": "exam_title", "label": "عنوان الاختبار", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "event_time", "label": "موعد الحصة أو الاختبار", "type": "datetime"}, {"key": "location", "label": "المكان أو رابط الحضور", "type": "text"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "exam_results", "name": "centerly_exam_results_v1", "id": "1294236969504465", "body": "تم رصد نتيجة اختبار {{1}} ضمن الدراسة المسجلة لدى {{2}}. المجموعة: {{3}} تاريخ الاختبار: {{4}} رابط مراجعة الدرجة وملاحظات التصحيح: {{5}} رقم المدرس للاستفسار: {{6}} هذا إشعار بتحديث سجل الدرجات الدراسي لهذا الاختبار.", "title": "رصد نتائج اختبار", "fields": [{"key": "exam_title", "label": "عنوان الاختبار", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "exam_date", "label": "تاريخ الاختبار", "type": "date"}, {"key": "portal", "label": "رابط الدراسة", "type": "portal"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "class_reminder", "name": "centerly_class_reminder_v1", "id": "2363014131126382", "body": "تذكير بموعد حصة {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} التاريخ والوقت: {{4}} المكان أو رابط الحضور: {{5}} رقم المدرس للاستفسار: {{6}} يمكنك مراجعة جدول مجموعتك من بوابة الدراسة الخاصة بك.", "title": "تذكير بموعد حصة", "fields": [{"key": "topic", "label": "اسم الحصة", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "event_time", "label": "موعد الحصة أو الاختبار", "type": "datetime"}, {"key": "location", "label": "المكان أو رابط الحضور", "type": "text"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "class_added", "name": "centerly_class_added_v1", "id": "1798796771372099", "body": "أُضيفت حصة {{1}} إلى جدول دراستك المسجلة مع {{2}}. المجموعة: {{3}} نوع الحصة: {{4}} الموعد: {{5}} المكان أو رابط الحضور: {{6}} رقم المدرس للاستفسار: {{7}} هذه الحصة تخص المجموعة المسجلة بالفعل، ويمكن مراجعتها في جدول الدراسة.", "title": "حصة إضافية أو تعويضية", "fields": [{"key": "topic", "label": "اسم الحصة", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "class_kind", "label": "نوع الحصة", "type": "choice", "options": ["إضافية", "تعويضية"]}, {"key": "event_time", "label": "موعد الحصة أو الاختبار", "type": "datetime"}, {"key": "location", "label": "المكان أو رابط الحضور", "type": "text"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "homework_reminder", "name": "centerly_homework_reminder_v1", "id": "1879336746562144", "body": "تذكير بآخر موعد لتسليم واجب {{1}} ضمن دراستك المسجلة مع {{2}}. المجموعة: {{3}} موعد التسليم: {{4}} رابط الواجب وتعليماته: {{5}} رقم المدرس للاستفسار: {{6}} هذا تذكير بالواجب المسند لمجموعتك، ولا يغيّر حالة أي تسليم سابق.", "title": "تذكير بموعد واجب", "fields": [{"key": "homework_title", "label": "عنوان الواجب", "type": "text"}, {"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "due", "label": "موعد التسليم", "type": "date"}, {"key": "portal", "label": "رابط الدراسة", "type": "portal"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}, {"key": "study_break", "name": "centerly_study_break_v1", "id": "1051468604575035", "body": "تم تسجيل فترة توقف للحصص ضمن دراستك مع {{1}}. المجموعة: {{2}} بداية توقف الحصص: {{3}} موعد استئناف الدراسة: {{4}} رقم المدرس للاستفسار: {{5}} التحديث يخص جدول المجموعة المسجلة فقط؛ يرجى مراجعة مواعيدها عند استئناف الدراسة.", "title": "توقف الحصص واستئنافها", "fields": [{"key": "teacher", "label": "اسم المدرس", "type": "teacher"}, {"key": "group", "label": "المجموعة", "type": "group"}, {"key": "break_start", "label": "بداية توقف الحصص", "type": "date"}, {"key": "break_end", "label": "استئناف الدراسة", "type": "date"}, {"key": "contact", "label": "رقم المدرس", "type": "contact"}]}]$catalog$::jsonb) as seed(key text,name text,id text,title text,body text,fields jsonb);


create function public.announcement_recipient_candidates(p_tenant uuid,p_groups uuid[],p_roles text[])
returns table(phone text,recipient_role text,group_ids uuid[],group_names text[],student_names text[],source_count integer,consented boolean,opted_out boolean)
language sql stable security invoker set search_path='' as $$
 with members as (
  select distinct s.id,s.name,g.id group_id,g.name group_name,r.role,
   public.announcement_phone(case when r.role='parent' then s.parent_phone else s.student_phone end) phone
  from public.students s join public.groups g on g.tenant_id=p_tenant and g.id=any(p_groups)
   and (s.group_id=g.id or exists(select 1 from public.group_students gs where gs.student_id=s.id and gs.tenant_id=p_tenant and gs.group_id=g.id))
  cross join lateral unnest(p_roles) r(role)
  where s.tenant_id=p_tenant and s.archived_at is null and public.portal_group_in_current_year(g.id,p_tenant) and r.role in ('student','parent')
 ), contacts as (
  select m.phone,case when bool_or(m.role='parent') then 'parent' else 'student' end recipient_role,
   array_agg(distinct m.group_id order by m.group_id) group_ids,
   array_agg(distinct m.group_name order by m.group_name) group_names,array_agg(distinct m.name order by m.name) student_names,
   count(distinct (m.id,m.role))::integer source_count
  from members m where m.phone is not null group by m.phone
 )
 select c.phone,c.recipient_role,c.group_ids,c.group_names,c.student_names,c.source_count,
  exists(select 1 from public.announcement_consents consent where consent.tenant_id=p_tenant and consent.phone=c.phone and consent.granted),
  exists(select 1 from public.announcement_optouts o where o.phone=c.phone and o.blocked)
 from contacts c order by c.phone
$$;
revoke all on function public.announcement_recipient_candidates(uuid,uuid[],text[]) from public,anon,authenticated;
grant execute on function public.announcement_recipient_candidates(uuid,uuid[],text[]) to service_role;

create function public.announcement_operation(p_tenant uuid,p_user uuid,p_assistant uuid,p_action text,p_data jsonb default '{}')
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
  return coalesce((select jsonb_agg(to_jsonb(x) order by x.created_at desc) from (select r.id,r.title,r.description,r.sample_body,r.status,r.admin_notes,r.type_key,r.created_at,r.updated_at from public.announcement_type_requests r where r.tenant_id=p_tenant and (p_assistant is null or r.assistant_id=p_assistant) order by r.created_at desc limit 100) x),'[]'::jsonb);
 elsif p_action='request_type' then
  item:=nullif(p_data->>'id','')::uuid;
  if item is null or length(btrim(coalesce(p_data->>'title',''))) not between 1 and 100 or length(btrim(coalesce(p_data->>'description',''))) not between 1 and 2000 or length(btrim(coalesce(p_data->>'sample_body',''))) not between 1 and 1024 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  perform pg_advisory_xact_lock(hashtextextended(p_tenant::text||':announcement_requests',0));
  if exists(select 1 from public.announcement_type_requests where id=item and (tenant_id<>p_tenant or created_by<>p_user or assistant_id is distinct from p_assistant)) then raise exception 'FORBIDDEN' using errcode='42501';end if;
  if not exists(select 1 from public.announcement_type_requests where id=item) and (select count(*) from public.announcement_type_requests where tenant_id=p_tenant and created_at>now()-interval '1 day')>=10 then raise exception 'RATE_LIMIT' using errcode='P0001';end if;
  insert into public.announcement_type_requests(id,tenant_id,created_by,assistant_id,title,description,sample_body) values(item,p_tenant,p_user,p_assistant,btrim(p_data->>'title'),btrim(p_data->>'description'),btrim(p_data->>'sample_body')) on conflict(id) do nothing;
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
revoke all on function public.announcement_operation(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.announcement_operation(uuid,uuid,uuid,text,jsonb) to service_role;

-- Preview rows are rendered by the server, never accepted from the browser.
-- Every state-changing queue operation locks tenant first, then announcement.
create function public.announcement_queue(p_tenant uuid,p_user uuid,p_assistant uuid,p_action text,p_data jsonb default '{}')
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
revoke all on function public.announcement_queue(uuid,uuid,uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.announcement_queue(uuid,uuid,uuid,text,jsonb) to service_role;

-- Internal worker only. Unknown outcomes retain their reservation and are never
-- reclaimed or retried automatically. A lease is not proof a send failed.
create function public.announcement_worker(p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare tenant uuid; rec public.announcement_recipients; attempt public.announcement_delivery_attempts;
 ann public.teacher_announcements; kind public.announcement_types; actor jsonb; reason text; result_status text;
 month_start date:=date_trunc('month',now() at time zone 'Africa/Cairo')::date;
begin
 if p_action='claim' then
  for tenant in select distinct tenant_id from public.announcement_recipients where status in ('queued','sending') limit 20 loop
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
  if tenant is null then return jsonb_build_object('ignored',true);end if;
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
  if tenant is null then return jsonb_build_object('ignored',true);end if;
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
revoke all on function public.announcement_worker(text,jsonb) from public,anon,authenticated;
grant execute on function public.announcement_worker(text,jsonb) to service_role;

-- Called only after the Meta webhook signature has been verified. Event order
-- and message ID prevent a delayed/replayed STOP from overriding a newer START.
create function public.announcement_recipient_preference(p_phone text,p_message_id text,p_at timestamptz,p_blocked boolean)
returns void language plpgsql security invoker set search_path='' as $$
declare phone_normal text:=public.announcement_phone(p_phone);
begin
 if phone_normal is null or length(p_message_id) not between 6 and 250 or p_at>now()+interval '5 minutes' then raise exception 'INVALID_INPUT' using errcode='22023';end if;
 insert into public.announcement_optouts(phone,source_message_id,blocked,last_event_at) values(phone_normal,p_message_id,p_blocked,p_at)
 on conflict(phone) do update set source_message_id=p_message_id,blocked=p_blocked,last_event_at=p_at,blocked_at=now() where excluded.last_event_at>public.announcement_optouts.last_event_at;
end;$$;
revoke all on function public.announcement_recipient_preference(text,text,timestamptz,boolean) from public,anon,authenticated;
grant execute on function public.announcement_recipient_preference(text,text,timestamptz,boolean) to service_role;

create function public.portal_announcements(p_student uuid,p_tenant uuid,p_role text)
returns jsonb language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(to_jsonb(x) order by x.published_at desc),'[]'::jsonb) from (
  select a.id,a.title,a.published_at,a.expires_at,
   coalesce(a.manual_body,(select string_agg((f->>'label')||': '||(a.values->>(f->>'key')),E'\n' order by position)
    from jsonb_array_elements(a.template_snapshot->'fields') with ordinality fields(f,position)
    where f->>'type' in ('text','choice','date','datetime'))) body
  from public.teacher_announcements a join public.students s on s.id=p_student and s.tenant_id=a.tenant_id and s.archived_at is null
  where a.tenant_id=p_tenant and p_role in ('parent','student') and p_role=any(a.recipient_roles)
   and (public.portal_preferences(p_tenant)->>'show_announcements')::boolean
   and a.status='published' and a.publish_on_portal and a.published_at<=now() and (a.expires_at is null or a.expires_at>now())
   and exists(select 1 from public.groups g where g.tenant_id=p_tenant and g.id=any(a.group_ids) and public.portal_group_in_current_year(g.id,p_tenant)
     and (s.group_id=g.id or exists(select 1 from public.group_students gs where gs.student_id=s.id and gs.tenant_id=p_tenant and gs.group_id=g.id)))
  order by a.published_at desc limit 20
 ) x
$$;
revoke all on function public.portal_announcements(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_announcements(uuid,uuid,text) to service_role;

create table public.announcement_admin_events(
 id uuid primary key default gen_random_uuid(),actor_id uuid not null references public.users(id),action text not null,
 type_key text,request_id uuid,details jsonb not null default '{}',created_at timestamptz not null default now()
);
alter table public.announcement_admin_events enable row level security;
revoke all on public.announcement_admin_events from public,anon,authenticated;
grant all on public.announcement_admin_events to service_role;
create function public.announcement_admin(p_user uuid,p_action text,p_data jsonb default '{}')
returns jsonb language plpgsql security invoker set search_path='' as $$
declare kind public.announcement_types; item uuid; fresh boolean:=false;
begin
 if not exists(select 1 from public.users where id=p_user and role='admin') then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if p_action='list' then
  return jsonb_build_object('catalog',(select coalesce(jsonb_agg(to_jsonb(t) order by title),'[]'::jsonb) from public.announcement_types t),
   'requests',(select coalesce(jsonb_agg(to_jsonb(x) order by x.updated_at desc),'[]'::jsonb) from (select r.*,u.full_name teacher_name,u.phone teacher_phone from public.announcement_type_requests r join public.users u on u.id=r.created_by order by r.updated_at desc limit 200) x));
 elsif p_action='request' then
  item:=(p_data->>'id')::uuid;
  if p_data->>'status' not in ('reviewing','meta_pending','available','rejected') or length(coalesce(p_data->>'admin_notes',''))>2000 then raise exception 'INVALID_INPUT' using errcode='22023';end if;
  if p_data->>'status'='available' and not exists(select 1 from public.announcement_types where key=p_data->>'type_key' and official_enabled and provider_status='APPROVED' and provider_category='UTILITY') then raise exception 'TEMPLATE_NOT_ENABLED' using errcode='23514';end if;
  update public.announcement_type_requests set status=p_data->>'status',admin_notes=nullif(p_data->>'admin_notes',''),type_key=nullif(p_data->>'type_key',''),updated_at=now() where id=item;
  if not found then raise exception 'NOT_FOUND' using errcode='P0002';end if;
 elsif p_action in ('prepare','provider','enable','disable') then
  perform pg_advisory_xact_lock(hashtextextended(p_data->>'key'||':announcement-type',0));
  select * into kind from public.announcement_types where key=p_data->>'key' for update;
  if p_action='prepare' then
   if kind.key is null then
    insert into public.announcement_types(key,meta_name,title,body,fields,provider_status,available) values(p_data->>'key',p_data->>'name',p_data->>'title',p_data->>'body',p_data->'fields','SUBMITTING',false) returning * into kind;fresh:=true;
   elsif kind.meta_name is distinct from p_data->>'name' or kind.body is distinct from p_data->>'body' or kind.fields is distinct from p_data->'fields' then raise exception 'TYPE_IMMUTABLE' using errcode='23514';end if;
  elsif kind.key is null then raise exception 'NOT_FOUND' using errcode='P0002';
  elsif p_action='provider' then
   if kind.meta_id is not null and kind.meta_id is distinct from p_data->>'meta_id' then raise exception 'TYPE_IMMUTABLE' using errcode='23514';end if;
   update public.announcement_types set meta_id=coalesce(nullif(p_data->>'meta_id',''),meta_id),provider_status=p_data->>'status',provider_category=p_data->>'category',checked_at=now(),available=coalesce(nullif(p_data->>'meta_id',''),meta_id) is not null and p_data->>'category'='UTILITY',official_enabled=official_enabled and p_data->'matched'='true'::jsonb where key=kind.key returning * into kind;
  elsif p_action='enable' then
   if kind.meta_id is null or kind.provider_status<>'APPROVED' or kind.provider_category is distinct from 'UTILITY' or p_data->'matched' is distinct from 'true'::jsonb or kind.checked_at<now()-interval '1 minute' then raise exception 'TEMPLATE_NOT_ENABLED' using errcode='23514';end if;
   update public.announcement_types set official_enabled=true where key=kind.key returning * into kind;
  elsif p_action='disable' then update public.announcement_types set official_enabled=false where key=kind.key returning * into kind;
  end if;
 else raise exception 'INVALID_INPUT' using errcode='22023';end if;
 insert into public.announcement_admin_events(actor_id,action,type_key,request_id,details) values(p_user,p_action,kind.key,item,case when p_action='request' then jsonb_build_object('status',p_data->>'status') else jsonb_build_object('provider_status',kind.provider_status,'official_enabled',kind.official_enabled) end);
 return jsonb_build_object('type',to_jsonb(kind),'submit',fresh);
end;$$;
revoke all on function public.announcement_admin(uuid,text,jsonb) from public,anon,authenticated;
grant execute on function public.announcement_admin(uuid,text,jsonb) to service_role;

-- Explicit RPC whitelist; internal worker and administrator functions stay private.
create or replace function public.assistant_delegated_rpc(p_name text,p_args jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();k text;v jsonb;v_id text;p record;v_call text;v_result jsonb;v_groups uuid[];
begin
 if p_name not in ('announcement_operation','announcement_queue','classroom_operation','portal_tenant_context','assistant_invite','assistant_configure','assistant_registration_link','student_followup_report','student_collection_operation','portal_onboarding_claim_queue','portal_onboarding_claim_queue_limited','parent_family_limit') then raise exception 'FORBIDDEN';end if;
 if p_name in ('announcement_operation','announcement_queue') then
  if c->>'resource'<>'announcements' then raise exception 'FORBIDDEN' using errcode='42501';end if;
  p_args:=p_args||jsonb_build_object('p_tenant',c->>'tenant_id','p_user',c->>'owner_id','p_assistant',c->>'assistant_id');
 end if;
 for k,v in select * from jsonb_each(p_args) loop
  if k in ('p_tenant','p_tenant_id') and v<>'null'::jsonb and v#>>'{}'<>c->>'tenant_id' then raise exception 'FORBIDDEN';end if;
  if k in ('p_user','p_user_id') and v<>'null'::jsonb and v#>>'{}'<>c->>'owner_id' then raise exception 'FORBIDDEN';end if;
  if k in ('p_student','p_student_id') and not public.assistant_delegated_student((v#>>'{}')::uuid) then raise exception 'FORBIDDEN';end if;
  if k in ('p_assistant','p_assistant_id') and v<>'null'::jsonb and not exists(select 1 from public.assistants a where a.id=(v#>>'{}')::uuid and a.tenant_id::text=c->>'tenant_id' and (c->>'teacher_id' is null or a.teacher_id::text=c->>'teacher_id')) then raise exception 'FORBIDDEN';end if;
  if k='p_teacher' and v<>'null'::jsonb and not exists(select 1 from public.teachers t where t.id=(v#>>'{}')::uuid and t.tenant_id::text=c->>'tenant_id' and (c->>'teacher_id' is null or t.id::text=c->>'teacher_id')) then raise exception 'FORBIDDEN';end if;
  if k in ('p_groups','p_group_ids') then for v_id in select jsonb_array_elements_text(v) loop if not public.assistant_delegated_group(v_id::uuid) then raise exception 'FORBIDDEN';end if;end loop;end if;
  if k='p_all_groups' and v='true'::jsonb and not (c->>'all_groups')::boolean then raise exception 'FORBIDDEN';end if;
  if k='p_permissions' and exists(select 1 from jsonb_each(v) new_permission where new_permission.value='true'::jsonb and c->'permissions'->new_permission.key is distinct from 'true'::jsonb) then raise exception 'FORBIDDEN';end if;
 end loop;
 if p_name in ('assistant_invite','assistant_configure','assistant_registration_link','create_assistant_secure','update_assistant_secure','delete_assistant_secure') and (c->>'resource'<>'assistants' or c->>'action' not in ('create','edit','delete')) then raise exception 'FORBIDDEN';end if;
 if p_name in ('portal_onboarding_claim_queue','portal_onboarding_claim_queue_limited') and (c->>'resource'<>'students' or c->>'action'<>'send' or not exists(select 1 from public.meta_portal_dispatch_queue q where q.id=(p_args->>'p_queue_id')::uuid and q.tenant_id=c->>'tenant_id' and public.assistant_delegated_student(q.student_id))) then raise exception 'FORBIDDEN';end if;
 if p_name='assistant_invite' and c->>'teacher_id' is not null and p_args->>'p_teacher' is distinct from c->>'teacher_id' then raise exception 'FORBIDDEN';end if;
 if p_name='student_followup_report' and c->>'resource' not in ('reports','messages','risk-watchlist') then raise exception 'FORBIDDEN';end if;
 if p_name='student_collection_operation' then
  if p_args->>'p_action'='void' or (p_args->>'p_action'<>'view' and c->>'action' not in ('collect','create')) then raise exception 'FORBIDDEN';end if;
  p_args:=p_args||jsonb_build_object('p_assistant',c->>'assistant_id','p_user',null,'p_actor',(select name from public.assistants where id=(c->>'assistant_id')::uuid and tenant_id=(c->>'tenant_id')::uuid));
  if c->>'resource' not in ('students','collections') then raise exception 'FORBIDDEN';end if;
  if p_args->>'p_action'='void' and not coalesce((c->'permissions'->>'students.collect')::boolean,false) then raise exception 'FORBIDDEN';end if;
 end if;
 if p_args ? 'p_data' then
  v:=p_args->'p_data';
  if nullif(v->>'group_id','') is not null and not public.assistant_delegated_group((v->>'group_id')::uuid) then raise exception 'FORBIDDEN';end if;
  if nullif(v->>'student_id','') is not null and not public.assistant_delegated_student((v->>'student_id')::uuid) then raise exception 'FORBIDDEN';end if;
  if nullif(v->>'id','') is not null and p_name='student_collection_operation' and not exists(select 1 from public.student_collections sc where sc.id=(v->>'id')::uuid and sc.tenant_id::text=c->>'tenant_id' and public.assistant_delegated_group(sc.group_id)) then raise exception 'FORBIDDEN';end if;
 end if;
 select pr.oid,pr.proargnames,pr.proargtypes,pr.proretset into p from pg_catalog.pg_proc pr join pg_catalog.pg_namespace n on n.oid=pr.pronamespace where n.nspname='public' and pr.proname=p_name and pr.prokind='f' and (select array_agg(key order by key) from jsonb_object_keys(p_args) key)<@pr.proargnames order by pr.pronargs limit 1;
 if p.oid is null then raise exception 'INVALID_INPUT';end if;
 -- JSON scalar arguments need their text representation, JSON objects remain JSON.
 select string_agg(case when p.proargtypes[i] in (114,3802) then format('%I := ($1->%L)::%s',p.proargnames[i+1],p.proargnames[i+1],pg_catalog.format_type(p.proargtypes[i],null))
  when pg_catalog.format_type(p.proargtypes[i],null)='uuid[]' then format('%I := array(select jsonb_array_elements_text($1->%L))::uuid[]',p.proargnames[i+1],p.proargnames[i+1])
  else format('%I := ($1->>%L)::%s',p.proargnames[i+1],p.proargnames[i+1],pg_catalog.format_type(p.proargtypes[i],null)) end,',') into v_call
 from generate_series(0,array_length(p.proargnames,1)-1) i where p_args?p.proargnames[i+1];
 if p.proretset then execute format('select coalesce(jsonb_agg(to_jsonb(value)),''[]''::jsonb) from public.%I(%s) value',p_name,v_call) into v_result using p_args;
 else execute format('select to_jsonb(public.%I(%s))',p_name,v_call) into v_result using p_args;end if;
 return v_result;
end;$$;
revoke execute on function public.assistant_delegated_rpc(text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_delegated_rpc(text,jsonb) to service_role;
notify pgrst,'reload schema';
