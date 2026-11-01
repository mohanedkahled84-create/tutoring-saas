-- Manual WhatsApp handoff only. No provider send, template or delivery state.
create function public.student_followup_report(p_tenant uuid,p_groups uuid[],p_data jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 g public.groups;st public.students;v_group uuid:=nullif(p_data->>'group_id','')::uuid;
 v_student uuid:=nullif(p_data->>'student_id','')::uuid;
 v_from date:=coalesce(nullif(p_data->>'from','')::date,date_trunc('month',now() at time zone 'Africa/Cairo')::date);
 v_to date:=coalesce(nullif(p_data->>'to','')::date,(now() at time zone 'Africa/Cairo')::date);
 v_page integer:=coalesce((p_data->>'page')::integer,1);v_rows jsonb;v_count integer;v_att jsonb;v_grades jsonb;v_hw jsonb;
begin
 if not exists(select 1 from public.tenants where id=p_tenant and status='active' and deleted_at is null) then raise exception 'UNAUTHORIZED';end if;
 if v_from>v_to or v_to-v_from>366 or v_page<1 or v_page>10000 then raise exception 'INVALID_INPUT';end if;
 if v_group is not null and not exists(select 1 from public.groups where id=v_group and tenant_id=p_tenant and id=any(p_groups)) then raise exception 'FORBIDDEN';end if;
 if v_student is null then
  select count(*) into v_count from public.students s join public.groups gr on gr.tenant_id=p_tenant and gr.id=any(p_groups)
   and (s.group_id=gr.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.group_id=gr.id and gs.student_id=s.id))
   where s.tenant_id=p_tenant and (v_group is null or gr.id=v_group) and (coalesce(p_data->>'q','')='' or position(lower(p_data->>'q') in lower(s.name||' '||coalesce(s.student_code,'')))>0);
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_rows from (
   select s.id as student_id,s.name as student_name,s.student_code,gr.id as group_id,gr.name as group_name
   from public.students s join public.groups gr on gr.tenant_id=p_tenant and gr.id=any(p_groups)
    and (s.group_id=gr.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.group_id=gr.id and gs.student_id=s.id))
   where s.tenant_id=p_tenant and (v_group is null or gr.id=v_group) and (coalesce(p_data->>'q','')='' or position(lower(p_data->>'q') in lower(s.name||' '||coalesce(s.student_code,'')))>0)
   order by s.name,s.id,gr.id limit 30 offset (v_page-1)*30
  ) x;
  return jsonb_build_object('rows',v_rows,'page',v_page,'has_more',v_count>v_page*30,'total',v_count,'from',v_from,'to',v_to);
 end if;
 select * into g from public.groups where id=v_group and tenant_id=p_tenant and id=any(p_groups);
 if not found then raise exception 'FORBIDDEN';end if;
 select * into st from public.students s where s.id=v_student and s.tenant_id=p_tenant and (s.group_id=g.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=s.id and gs.group_id=g.id));
 if not found then raise exception 'FORBIDDEN';end if;
 select jsonb_build_object('total',count(*),'present',count(*) filter(where a.attended is true),'absent',count(*) filter(where a.attended is false),'unrecorded',count(*) filter(where a.attended is null)) into v_att
 from public.sessions se left join public.attendance a on a.tenant_id=p_tenant and a.session_id=se.id and a.student_id=st.id
 where se.tenant_id=p_tenant and se.group_id=g.id and se.status='ended' and se.session_date between v_from and v_to;
 select jsonb_build_object('total',count(*),'recorded',count(sc.score),'unrecorded',count(*) filter(where sc.score is null),'latest',
  (select jsonb_build_object('title',q2.title,'score',sc2.score,'max_score',q2.max_score,'date',q2.quiz_date)
   from public.quizzes q2 join public.quiz_scores sc2 on sc2.tenant_id=p_tenant and sc2.group_id=g.id and sc2.student_id=st.id and sc2.quiz_number=q2.quiz_number
   where q2.tenant_id=p_tenant and q2.group_id=g.id and not coalesce(q2.is_skipped,false) and q2.quiz_date between v_from and v_to and sc2.score is not null order by q2.quiz_date desc,q2.id desc limit 1)) into v_grades
 from public.quizzes q left join public.quiz_scores sc on sc.tenant_id=p_tenant and sc.group_id=g.id and sc.student_id=st.id and sc.quiz_number=q.quiz_number
 where q.tenant_id=p_tenant and q.group_id=g.id and not coalesce(q.is_skipped,false) and q.quiz_date between v_from and v_to;
 select jsonb_build_object('total',count(*),'submitted',count(h.submitted_at),'late',count(*) filter(where m.due_date is not null and (h.submitted_at at time zone 'Africa/Cairo')::date>m.due_date),'on_time',count(*) filter(where m.due_date is not null and (h.submitted_at at time zone 'Africa/Cairo')::date<=m.due_date),'without_deadline',count(*) filter(where h.submitted_at is not null and m.due_date is null),'overdue',count(*) filter(where h.submitted_at is null and m.due_date<(now() at time zone 'Africa/Cairo')::date),'not_submitted',count(*) filter(where h.submitted_at is null)) into v_hw
 from public.study_materials m left join lateral (select hs.submitted_at from public.homework_submissions hs where hs.tenant_id=p_tenant and hs.material_id=m.id and hs.student_id=st.id order by hs.submitted_at desc limit 1) h on true
 where m.tenant_id=p_tenant and m.group_id=g.id and m.is_homework and (m.created_at at time zone 'Africa/Cairo')::date between v_from and v_to;
 return jsonb_build_object('student_id',st.id,'student_name',st.name,'group_id',g.id,'group_name',g.name,'teacher_name',(select name from public.tenants where id=p_tenant),'from',v_from,'to',v_to,'attendance',v_att,'grades',v_grades,'homework',v_hw);
end;$$;
revoke execute on function public.student_followup_report(uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.student_followup_report(uuid,uuid[],jsonb) to service_role;

create function public.assistant_followup(p_token_hash text,p_origin text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.assistant_accounts;s public.assistants;ids uuid[];r jsonb;v_phone text;
begin
 select ac.* into a from public.assistant_accounts ac join public.assistant_sessions ss on ss.assistant_id=ac.assistant_id where ss.token_hash=p_token_hash and ss.origin=p_origin and ss.expires_at>now() and ss.credential_version=ac.credential_version for share of ac;
 if not found then raise exception 'UNAUTHORIZED';end if;
 select * into s from public.assistants where id=a.assistant_id and tenant_id=a.tenant_id and status='active' for share;
 if not found then raise exception 'UNAUTHORIZED';end if;
 if p_action not in ('view','prepare') then raise exception 'FORBIDDEN';end if;
 if p_action='view' and coalesce(a.permissions->>'reports.view','false')<>'true' and coalesce(a.permissions->>'messages.view','false')<>'true' then raise exception 'FORBIDDEN';end if;
 if p_action='prepare' and (coalesce(a.permissions->>'messages.view','false')<>'true' or coalesce(a.permissions->>'messages.send','false')<>'true' or nullif(p_data->>'student_id','') is null) then raise exception 'FORBIDDEN';end if;
 select coalesce(array_agg(g.id),'{}') into ids from public.groups g where g.tenant_id=a.tenant_id and (a.all_groups or g.id=any(a.group_ids)) and (s.teacher_id is null or g.teacher_id is null or g.teacher_id=s.teacher_id);
 r:=public.student_followup_report(a.tenant_id,ids,p_data);
 if p_action='prepare' then
  if coalesce(p_data->>'recipient','') not in ('parent','student') then raise exception 'INVALID_INPUT';end if;
  select case when p_data->>'recipient'='parent' then parent_phone else student_phone end into v_phone from public.students where id=(r->>'student_id')::uuid and tenant_id=a.tenant_id;
  r:=r||jsonb_build_object('phone',v_phone);
  insert into public.assistant_access_audit(tenant_id,assistant_id,action,target_id,actor_name,target_name,changes)
   values(a.tenant_id,a.assistant_id,'messages.prepare',(r->>'student_id')::uuid,s.name,r->>'student_name',jsonb_build_object('after',jsonb_build_object('recipient',p_data->>'recipient','from',r->>'from','to',r->>'to')));
 end if;
 return r;
end;$$;
revoke execute on function public.assistant_followup(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_followup(text,text,text,jsonb) to service_role;
