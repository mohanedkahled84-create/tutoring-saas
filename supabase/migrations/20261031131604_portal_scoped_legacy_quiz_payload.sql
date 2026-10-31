-- Parse legacy inbox JSON without making malformed historical messages fail account loading.
create or replace function public.portal_parse_legacy_json(p_body text)
returns jsonb language plpgsql immutable security invoker set search_path='' as $$
begin return p_body::jsonb; exception when invalid_text_representation then return null; end;
$$;

-- Filter large legacy definitions/submissions in Postgres before transporting them to the API.
create or replace function public.portal_legacy_quiz_payload(p_student_id uuid,p_tenant_id uuid,p_student_code text)
returns jsonb language sql stable security invoker set search_path='' as $$
with owner as (
  select id,tenant_id,group_id from public.students where id=p_student_id and tenant_id=p_tenant_id
), allowed_groups as (
  select g.id::text as id from public.groups g cross join owner o where g.tenant_id=o.tenant_id
    and (g.id=o.group_id or exists(select 1 from public.group_students gs
      where gs.tenant_id=o.tenant_id and gs.student_id=o.id and gs.group_id=g.id))
), recent_definitions as materialized (
  select message_body,phone,status,created_at from public.whatsapp_inbox where tenant_id is null
    and phone like 'QUIZ_DEF_%' order by created_at desc limit 1000
), parsed_definitions as materialized (
  select *,public.portal_parse_legacy_json(message_body) as quiz from recent_definitions
), definitions as materialized (
  select * from parsed_definitions where quiz->>'group_id' in(select id from allowed_groups)
    and coalesce(quiz->'is_draft','null'::jsonb) in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb)
    and coalesce(quiz->'is_archived','null'::jsonb) in ('null'::jsonb,'false'::jsonb,'0'::jsonb,'""'::jsonb)
    and lower(coalesce(quiz->>'exam_mode','online'))<>'paper' and jsonb_typeof(quiz->'questions')='array'
    and status is distinct from 'draft' and upper(phone) not like '%DRAFT%'
), recent_submissions as materialized (
  select message_body,status,created_at from public.whatsapp_inbox where tenant_id is null
    and phone like 'QUIZ_SUB_%' order by created_at desc limit 2000
), parsed_submissions as materialized (
  select *,public.portal_parse_legacy_json(message_body) as submission from recent_submissions
), own_submissions as (
  select * from parsed_submissions where nullif(btrim(p_student_code),'') is not null
    and btrim(submission->>'student_code')=btrim(p_student_code)
    and coalesce(nullif(submission->>'material_id',''),submission->>'quiz_id') in(select quiz->>'id' from definitions)
    and (coalesce(submission->>'group_id','')='' or submission->>'group_id' in(select id from allowed_groups))
), mapped_submissions as (
  select jsonb_build_object('material_id',h.material_id,'status',h.status,'file_url',h.file_url,
    'teacher_notes',h.teacher_notes,'submitted_at',h.submitted_at) as item,0 as source,h.submitted_at as sort_at
  from public.homework_submissions h where h.student_id=p_student_id and h.tenant_id=p_tenant_id
    and h.material_id::text in(select quiz->>'id' from definitions)
  union all
  select jsonb_build_object('material_id',coalesce(nullif(submission->>'material_id',''),submission->>'quiz_id'),
    'quiz_id',coalesce(nullif(submission->>'material_id',''),submission->>'quiz_id'),
    'status',coalesce(nullif(submission->>'status',''),nullif(status,''),'pending'),
    'file_url',coalesce(nullif(submission->>'file_url',''),submission->>'submission_url'),
    'teacher_notes',submission::text,
    'submitted_at',coalesce(submission->>'submitted_at',submission->>'created_at',created_at::text)),1,created_at
  from own_submissions
)
select jsonb_build_object('definitions',coalesce((select jsonb_agg(jsonb_build_object('message_body',message_body,
  'phone',phone,'status',status,'created_at',created_at) order by created_at desc) from definitions),'[]'::jsonb),
  'submissions',coalesce((select jsonb_agg(item order by source,sort_at desc) from mapped_submissions),'[]'::jsonb));
$$;
revoke all on function public.portal_parse_legacy_json(text),public.portal_legacy_quiz_payload(uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.portal_parse_legacy_json(text),public.portal_legacy_quiz_payload(uuid,uuid,text) to service_role;
