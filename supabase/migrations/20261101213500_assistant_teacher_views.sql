-- Delegated teacher controllers use private, automatically updatable views.
-- Every query rechecks the opaque session, current permissions and group scope.
-- No owner JWT or service credential is ever returned to the assistant.
create function public.assistant_delegated_context() returns jsonb
language plpgsql stable security invoker set search_path='' as $$
declare h jsonb:=coalesce(nullif(current_setting('request.headers',true),''),'{}')::jsonb;
 a public.assistant_accounts;s public.assistants;v_cap text;v_resource text;v_action text;v_allowed boolean;
begin
 select ac.* into a from public.assistant_accounts ac join public.assistant_sessions ss on ss.assistant_id=ac.assistant_id
 where ss.token_hash=h->>'x-assistant-token-hash' and ss.origin=h->>'x-assistant-origin' and ss.expires_at>now() and ss.credential_version=ac.credential_version;
 if not found then raise exception 'UNAUTHORIZED';end if;
 -- Compatibility for permissions assigned before the page catalog expanded.
 a.permissions:=a.permissions || jsonb_strip_nulls(jsonb_build_object(
  'quizzes.view',coalesce(a.permissions->'quizzes.view',a.permissions->'grades.view'),
  'quizzes.grade',coalesce(a.permissions->'quizzes.grade',a.permissions->'grades.edit'),
  'students.view',coalesce(a.permissions->'students.view',a.permissions->'collections.view'),
  'students.collect',coalesce(a.permissions->'students.collect',a.permissions->'collections.create'),
  'reports.view',coalesce(a.permissions->'reports.view',a.permissions->'messages.view'),
  'reports.send',coalesce(a.permissions->'reports.send',a.permissions->'messages.send')));
 select * into s from public.assistants where id=a.assistant_id and tenant_id=a.tenant_id and status='active';
 if not found or not exists(select 1 from public.tenants where id=a.tenant_id and status='active' and deleted_at is null) then raise exception 'UNAUTHORIZED';end if;
 v_cap:=h->>'x-assistant-capability';v_resource:=split_part(v_cap,'.',1);v_action:=split_part(v_cap,'.',2);
 v_allowed:=coalesce((a.permissions->>(v_resource||'.view'))::boolean,false) and coalesce((a.permissions->>v_cap)::boolean,false);
 if v_resource='grades' then v_allowed:=v_allowed or (coalesce(a.permissions->>'quizzes.view','false')='true' and coalesce(a.permissions->>case when v_action='edit' then 'quizzes.grade' else 'quizzes.view' end,'false')='true');end if;
 if v_resource='collections' then v_allowed:=v_allowed or (coalesce(a.permissions->>'students.view','false')='true' and coalesce(a.permissions->>'students.collect','false')='true');end if;
 if v_resource='messages' then v_allowed:=v_allowed or (coalesce(a.permissions->>'reports.view','false')='true' and coalesce(a.permissions->>case when v_action='send' then 'reports.send' else 'reports.view' end,'false')='true');end if;
 if not coalesce(v_allowed,false) then raise exception 'FORBIDDEN';end if;
 if not exists(select 1 from public.users u where u.id::text=h->>'x-assistant-owner-id' and u.tenant_id=a.tenant_id and u.role in ('owner','teacher','center_owner') and (s.teacher_id is null or exists(select 1 from public.teachers t where t.id=s.teacher_id and t.tenant_id=a.tenant_id and t.user_id=u.id))) then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('tenant_id',a.tenant_id,'assistant_id',a.assistant_id,'all_groups',a.all_groups,'group_ids',to_jsonb(a.group_ids),'teacher_id',s.teacher_id,'permissions',a.permissions,'resource',v_resource,'action',v_action,'owner_id',h->>'x-assistant-owner-id');
end;$$;

create function public.assistant_delegated_group(p_group uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.groups g cross join lateral (select public.assistant_delegated_context() as c) x
 where g.id=p_group and g.tenant_id::text=c->>'tenant_id'
 and ((c->>'all_groups')::boolean or (c->'group_ids')?g.id::text)
 and (c->>'teacher_id' is null or g.teacher_id is null or g.teacher_id::text=c->>'teacher_id'))
$$;
create function public.assistant_delegated_student(p_student uuid) returns boolean
language sql stable security invoker set search_path='' as $$
 select exists(select 1 from public.students s where s.id=p_student and s.tenant_id::text=public.assistant_delegated_context()->>'tenant_id'
 and (public.assistant_delegated_group(s.group_id) or exists(select 1 from public.group_students gs where gs.student_id=s.id and gs.tenant_id=s.tenant_id and public.assistant_delegated_group(gs.group_id))))
$$;
create function public.assistant_delegated_inbox(p_row jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();b jsonb;v_group text;v_student text;v_id text;
begin
 if p_row->>'student_id' is not null then return public.assistant_delegated_student((p_row->>'student_id')::uuid);end if;
 begin b:=(p_row->>'message_body')::jsonb;exception when others then b:='{}';end;
 v_student:=coalesce(b->>'student_id',b->'student'->>'id');
 if v_student~'^[0-9a-fA-F-]{36}$' then return public.assistant_delegated_student(v_student::uuid);end if;
 v_group:=coalesce(b->>'group_id',b->'quiz'->>'group_id');
 if v_group~'^[0-9a-fA-F-]{36}$' then return public.assistant_delegated_group(v_group::uuid);end if;
 if jsonb_typeof(b->'group_ids')='array' then
  for v_id in select jsonb_array_elements_text(b->'group_ids') loop
   if v_id~'^[0-9a-fA-F-]{36}$' and public.assistant_delegated_group(v_id::uuid) then
    if current_setting('request.method',true) in ('GET','HEAD') then return true;end if;
   elsif current_setting('request.method',true) not in ('GET','HEAD') then return false;end if;
  end loop;
  return jsonb_array_length(b->'group_ids')>0;
 end if;
 -- Shared definitions without a student/group are tenant-wide operations.
 return (c->>'all_groups')::boolean;
exception when invalid_text_representation then return false;
end;$$;

create function public.assistant_delegated_row(p_table text,r jsonb) returns boolean
language plpgsql stable security invoker set search_path='' as $$
declare c jsonb:=public.assistant_delegated_context();v_resource text:=c->>'resource';v_action text:=c->>'action';v_write boolean:=coalesce(current_setting('request.method',true),'GET') not in ('GET','HEAD');v_allowed boolean:=false;
begin
 if (case when p_table='tenants' then r->>'id' else r->>'tenant_id' end) is distinct from c->>'tenant_id' then return false;end if;
 if v_write then
  case p_table
   when 'groups' then v_allowed:=v_resource='groups' and v_action in ('create','edit','delete');
   when 'students' then v_allowed:=v_resource='students' and v_action in ('create','edit','delete','send');
   when 'group_students','enrollments' then v_allowed:=v_resource in ('groups','students') and v_action in ('create','edit','delete');
   when 'sessions' then v_allowed:=v_resource in ('attendance','sessions') and v_action in ('create','edit','delete');
   when 'attendance' then v_allowed:=v_resource='attendance' and v_action in ('create','edit');
   when 'quizzes' then v_allowed:=v_resource='quizzes' and v_action in ('create','edit','delete');
   when 'quiz_scores' then v_allowed:=(v_resource='grades' and v_action='edit') or (v_resource='quizzes' and v_action='grade');
   when 'study_materials' then v_allowed:=v_resource in ('materials','video-lessons','online-quizzes','paper-exams') and v_action in ('create','edit','delete');
   when 'homework_submissions' then v_allowed:=v_resource='homework' and v_action='edit';
   when 'whatsapp_inbox' then v_allowed:=v_resource in ('online-quizzes','paper-exams','video-lessons') and v_action in ('create','edit','delete','grade');
   when 'tenant_platform_settings' then v_allowed:=v_resource='platform-builder' and v_action='edit';
   when 'tenants','users','message_templates','whatsapp_connections','payment_proofs' then v_allowed:=v_resource='settings' and v_action='edit';
   when 'teachers' then v_allowed:=v_resource='settings' and v_action='edit' and r->>'user_id'=c->>'owner_id';
   when 'assistants','assistant_accounts','assistant_invitations' then v_allowed:=v_resource='assistants' and v_action in ('create','edit','delete');
   when 'meta_portal_dispatch_queue' then v_allowed:=v_resource='students' and v_action='send';
   when 'student_collections' then v_allowed:=(v_resource='collections' and v_action='create') or (v_resource='students' and v_action='collect');
   when 'activity_logs','assistant_access_audit','message_logs' then v_allowed:=v_action not in ('view','');
   else v_allowed:=false;
  end case;
  if not v_allowed then return false;end if;
 elsif p_table in ('assistants','assistant_accounts','assistant_invitations') and v_resource not in ('assistants','dashboard','reports') then return false;
 elsif p_table in ('payment_proofs','whatsapp_connections','message_templates') and v_resource<>'settings' then return false;
 end if;
 if p_table='study_materials' then
  if r->>'type'='online_quiz' and not coalesce((c->'permissions'->>'online-quizzes.view')::boolean,false) then return false;end if;
  if r->>'type' in ('paper_quiz','paper_exam') and not coalesce((c->'permissions'->>'paper-exams.view')::boolean,false) then return false;end if;
  if v_write and ((v_resource='online-quizzes' and r->>'type'<>'online_quiz') or (v_resource='paper-exams' and r->>'type' not in ('paper_quiz','paper_exam')) or (v_resource='video-lessons' and r->>'type'<>'video')) then return false;end if;
 end if;
 case p_table
  when 'groups' then return ((c->>'all_groups')::boolean or (c->'group_ids')?(r->>'id')) and (c->>'teacher_id' is null or r->>'teacher_id' is null or r->>'teacher_id'=c->>'teacher_id');
  when 'students' then return public.assistant_delegated_group((r->>'group_id')::uuid) or (not v_write and public.assistant_delegated_student((r->>'id')::uuid));
  when 'group_students','enrollments','sessions','quizzes','study_materials','student_collections' then return public.assistant_delegated_group((r->>'group_id')::uuid) or (p_table='study_materials' and r->>'group_id' is null and (c->>'all_groups')::boolean);
  when 'attendance' then return public.assistant_delegated_student((r->>'student_id')::uuid) and exists(select 1 from public.sessions s where s.id=(r->>'session_id')::uuid and s.tenant_id::text=c->>'tenant_id' and public.assistant_delegated_group(s.group_id));
  when 'quiz_scores' then return public.assistant_delegated_student((r->>'student_id')::uuid) and (public.assistant_delegated_group((r->>'group_id')::uuid) or exists(select 1 from public.quizzes q where q.id=(r->>'quiz_id')::uuid and public.assistant_delegated_group(q.group_id)) or exists(select 1 from public.sessions s where s.id=(r->>'session_id')::uuid and public.assistant_delegated_group(s.group_id)));
  when 'homework_submissions' then return public.assistant_delegated_student((r->>'student_id')::uuid) and exists(select 1 from public.study_materials m where m.id=(r->>'material_id')::uuid and m.tenant_id::text=c->>'tenant_id' and public.assistant_delegated_group(m.group_id));
  when 'message_logs' then return public.assistant_delegated_group((r->>'group_id')::uuid) or public.assistant_delegated_student((r->>'student_id')::uuid) or ((c->>'all_groups')::boolean and r->>'group_id' is null and r->>'student_id' is null);
  when 'whatsapp_inbox' then return public.assistant_delegated_inbox(r);
  when 'meta_portal_dispatch_queue' then return public.assistant_delegated_student((r->>'student_id')::uuid);
  when 'users' then return r->>'id'=c->>'owner_id' and r->>'role'<>'admin';
  when 'teachers' then return c->>'teacher_id' is null or r->>'id'=c->>'teacher_id';
  when 'assistants' then return c->>'teacher_id' is null or r->>'teacher_id' is null or r->>'teacher_id'=c->>'teacher_id';
  when 'assistant_accounts','assistant_invitations' then return exists(select 1 from public.assistants a where a.id=(r->>'assistant_id')::uuid and a.tenant_id::text=c->>'tenant_id' and (c->>'teacher_id' is null or a.teacher_id is null or a.teacher_id::text=c->>'teacher_id'));
  else return true;
 end case;
exception when invalid_text_representation then return false;
end;$$;

do $$declare t text;begin
 foreach t in array array['groups','students','group_students','enrollments','sessions','attendance','quizzes','quiz_scores','study_materials','homework_submissions','message_logs','whatsapp_inbox','tenant_platform_settings','tenants','users','teachers','assistants','assistant_accounts','assistant_invitations','activity_logs','assistant_access_audit','payment_proofs','message_templates','whatsapp_connections','meta_portal_dispatch_queue','student_collections','rooms','teacher_payouts'] loop
  execute format('create view public.%I with (security_invoker=true,security_barrier=true) as select source.* from public.%I source where public.assistant_delegated_row(%L,to_jsonb(source)) with local check option','assistant_delegated_'||t,t,t);
  execute format('revoke all on public.%I from public,anon,authenticated','assistant_delegated_'||t);
  execute format('grant all on public.%I to service_role','assistant_delegated_'||t);
 end loop;
end;$$;
revoke execute on function public.assistant_delegated_context(),public.assistant_delegated_group(uuid),public.assistant_delegated_student(uuid),public.assistant_delegated_inbox(jsonb),public.assistant_delegated_row(text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_delegated_context(),public.assistant_delegated_group(uuid),public.assistant_delegated_student(uuid),public.assistant_delegated_inbox(jsonb),public.assistant_delegated_row(text,jsonb) to service_role;
notify pgrst,'reload schema';
