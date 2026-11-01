-- Grade access is separate from quiz setup. Existing assistants gain no access.
create function public.assistant_grades(p_token_hash text,p_origin text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 a public.assistant_accounts;s public.assistants;q public.quizzes;ids uuid[];
 choices jsonb;rows jsonb;v_quiz uuid;v_student uuid;v_id uuid;v_score numeric;v_key text;
begin
 select ac.* into a from public.assistant_accounts ac join public.assistant_sessions ss on ss.assistant_id=ac.assistant_id
 where ss.token_hash=p_token_hash and ss.origin=p_origin and ss.expires_at>now() and ss.credential_version=ac.credential_version for share of ac;
 if not found then raise exception 'UNAUTHORIZED';end if;
 select * into s from public.assistants where id=a.assistant_id and tenant_id=a.tenant_id and status='active' for share;
 if not found or not exists(select 1 from public.tenants t where t.id=a.tenant_id and t.status='active' and t.deleted_at is null) then raise exception 'UNAUTHORIZED';end if;
 if p_action not in ('view','edit') or coalesce(a.permissions->>'grades.view','false')<>'true'
  or coalesce(a.permissions->>('grades.'||p_action),'false')<>'true' then raise exception 'FORBIDDEN';end if;
 select coalesce(array_agg(g.id),'{}') into ids from public.groups g where g.tenant_id=a.tenant_id
  and (a.all_groups or g.id=any(a.group_ids)) and (s.teacher_id is null or g.teacher_id is null or g.teacher_id=s.teacher_id);
 v_quiz:=nullif(p_data->>'quiz_id','')::uuid;
 if p_action='view' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into choices from
   (select id,group_id,title,quiz_number,max_score,is_skipped from public.quizzes where tenant_id=a.tenant_id and group_id=any(ids) order by quiz_date desc nulls last,id limit 500) x;
  if v_quiz is null then v_quiz:=(choices->0->>'id')::uuid;end if;
  if v_quiz is null then return jsonb_build_object('rows','[]'::jsonb,'quizzes',choices,'quiz_id',null,'limit',500);end if;
 end if;
 select * into q from public.quizzes where id=v_quiz and tenant_id=a.tenant_id and group_id=any(ids) for share;
 if not found then raise exception 'FORBIDDEN';end if;
 if p_action='view' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into rows from (
   select st.id as student_id,st.name as student_name,q.id as quiz_id,q.group_id,q.quiz_number,q.max_score,q.is_skipped,
    sc.id,sc.score,sc.note
   from public.students st left join public.quiz_scores sc on sc.tenant_id=a.tenant_id and sc.student_id=st.id
    and sc.group_id=q.group_id and sc.quiz_number=q.quiz_number
   where st.tenant_id=a.tenant_id and (st.group_id=q.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=a.tenant_id and gs.student_id=st.id and gs.group_id=q.group_id))
   order by st.name,st.id limit 500
  ) x;
  return jsonb_build_object('rows',rows,'quizzes',choices,'quiz_id',q.id,'limit',500);
 end if;
 if q.is_skipped then raise exception 'INVALID_INPUT';end if;
 v_student:=(p_data->>'student_id')::uuid;v_score:=(p_data->>'score')::numeric;
 if v_score is null or v_score<0 or v_score>q.max_score or v_score::text in ('NaN','Infinity','-Infinity') or length(coalesce(p_data->>'note',''))>2000 then raise exception 'INVALID_INPUT';end if;
 perform 1 from public.students st where st.id=v_student and st.tenant_id=a.tenant_id
  and (st.group_id=q.group_id or exists(select 1 from public.group_students gs where gs.tenant_id=a.tenant_id and gs.student_id=st.id and gs.group_id=q.group_id)) for share;
 if not found then raise exception 'FORBIDDEN';end if;
 perform set_config('app.centerly_assistant_session',p_token_hash,true);
 perform set_config('app.centerly_assistant_origin',p_origin,true);
 v_key:=a.tenant_id::text||':'||q.group_id::text||':'||v_student::text||':quiz-'||q.quiz_number::text;
 insert into public.quiz_scores as sc(tenant_id,student_id,quiz_id,group_id,quiz_number,score,max_score,note,idempotency_key)
 values(a.tenant_id,v_student,q.id,q.group_id,q.quiz_number,v_score,q.max_score,coalesce(p_data->>'note',''),v_key)
 on conflict(idempotency_key) do update set score=excluded.score,max_score=excluded.max_score,note=excluded.note,
  quiz_id=excluded.quiz_id,updated_at=now(),delivery_status=case when sc.score is distinct from excluded.score or sc.note is distinct from excluded.note then 'pending' else sc.delivery_status end
 where sc.tenant_id=a.tenant_id and sc.group_id=q.group_id and sc.student_id=v_student and sc.quiz_number=q.quiz_number
 returning id into v_id;
 if v_id is null then raise exception 'FORBIDDEN';end if;
 return jsonb_build_object('id',v_id);
end;$$;
revoke execute on function public.assistant_grades(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_grades(text,text,text,jsonb) to service_role;

create or replace function public.capture_assistant_change() returns trigger
language plpgsql security invoker set search_path='' as $$
declare
 v_hash text:=current_setting('app.centerly_assistant_session',true);
 v_origin text:=current_setting('app.centerly_assistant_origin',true);
 v_tenant uuid;v_assistant uuid;v_actor text;v_label text;v_resource text;
 v_old jsonb;v_new jsonb:=to_jsonb(new);v_before jsonb:='{}';v_after jsonb:='{}';
 v_keys text[];v_key text;v_action text;
begin
 if current_user<>'service_role' or v_hash is null or v_hash='' then return new; end if;
 v_tenant:=(v_new->>'tenant_id')::uuid;
 select a.assistant_id,s.name into v_assistant,v_actor
 from public.assistant_sessions ss join public.assistant_accounts a on a.assistant_id=ss.assistant_id
 join public.assistants s on s.id=a.assistant_id and s.tenant_id=a.tenant_id
 where ss.token_hash=v_hash and ss.origin=v_origin and ss.expires_at>now()
 and ss.credential_version=a.credential_version and a.tenant_id=v_tenant and s.status='active';
 if not found then raise exception 'UNAUTHORIZED'; end if;
 case tg_table_name
  when 'groups' then v_resource:='groups';v_keys:=array['name','subject'];
  when 'students' then v_resource:='students';v_keys:=array['name','parent_phone','student_phone','notes','group_id'];
  when 'attendance' then v_resource:='attendance';v_keys:=array['attended','homework_status','comment'];
  when 'study_materials' then v_resource:='materials';v_keys:=array['title','description','type','url','is_homework','due_date'];
  when 'homework_submissions' then v_resource:='homework';v_keys:=array['status','teacher_notes'];
  when 'quiz_scores' then v_resource:='grades';v_keys:=array['score','max_score','note'];
  when 'quizzes' then v_resource:='quizzes';v_keys:=array['title','quiz_number','max_score','quiz_date'];
  else return new;
 end case;
 if tg_op='UPDATE' then v_old:=to_jsonb(old); else v_old:='{}'::jsonb; end if;
 foreach v_key in array v_keys loop
  if tg_op='INSERT' or v_old->v_key is distinct from v_new->v_key then
   v_before:=v_before||jsonb_build_object(v_key,v_old->v_key);
   v_after:=v_after||jsonb_build_object(v_key,v_new->v_key);
  end if;
 end loop;
 if v_after='{}'::jsonb then return new; end if;
 v_label:=coalesce(v_new->>'name',v_new->>'title');
 if v_label is null and v_resource in ('attendance','homework','grades') then
  select st.name into v_label from public.students st where st.id=(v_new->>'student_id')::uuid and st.tenant_id=v_tenant;
 end if;
 v_action:=case when tg_op='INSERT' and v_resource not in ('attendance','grades') then 'create' else 'edit' end;
 insert into public.assistant_access_audit(tenant_id,assistant_id,actor_name,action,target_id,target_name,changes)
 values(v_tenant,v_assistant,v_actor,v_resource||'.'||v_action,(v_new->>'id')::uuid,v_label,jsonb_build_object('before',v_before,'after',v_after));
 return new;
end; $$;

create trigger assistant_grades_change after insert or update on public.quiz_scores for each row execute function public.capture_assistant_change();
