-- Count each session/quiz once even when legacy idempotency keys differ.
-- Manual WhatsApp handoff only. No provider send, template or delivery state.
create or replace function public.student_followup_report(p_tenant uuid,p_groups uuid[],p_data jsonb) returns jsonb
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
 from public.sessions se left join lateral (select at.attended from public.attendance at where at.tenant_id=p_tenant and at.session_id=se.id and at.student_id=st.id order by at.created_at desc,at.id desc limit 1) a on true
 where se.tenant_id=p_tenant and se.group_id=g.id and se.status='ended' and se.session_date between v_from and v_to;
 select jsonb_build_object('total',count(*),'recorded',count(sc.score),'unrecorded',count(*) filter(where sc.score is null),'latest',
  (select jsonb_build_object('title',q2.title,'score',sc2.score,'max_score',q2.max_score,'date',q2.quiz_date)
   from public.quizzes q2 join lateral (select sc.score from public.quiz_scores sc where sc.tenant_id=p_tenant and sc.group_id=g.id and sc.student_id=st.id and sc.quiz_number=q2.quiz_number order by coalesce(sc.updated_at,sc.created_at) desc,sc.id desc limit 1) sc2 on true
   where q2.tenant_id=p_tenant and q2.group_id=g.id and not coalesce(q2.is_skipped,false) and q2.quiz_date between v_from and v_to and sc2.score is not null order by q2.quiz_date desc,q2.id desc limit 1)) into v_grades
 from public.quizzes q left join lateral (select qs.score from public.quiz_scores qs where qs.tenant_id=p_tenant and qs.group_id=g.id and qs.student_id=st.id and qs.quiz_number=q.quiz_number order by coalesce(qs.updated_at,qs.created_at) desc,qs.id desc limit 1) sc on true
 where q.tenant_id=p_tenant and q.group_id=g.id and not coalesce(q.is_skipped,false) and q.quiz_date between v_from and v_to;
 select jsonb_build_object('total',count(*),'submitted',count(h.submitted_at),'late',count(*) filter(where m.due_date is not null and (h.submitted_at at time zone 'Africa/Cairo')::date>m.due_date),'on_time',count(*) filter(where m.due_date is not null and (h.submitted_at at time zone 'Africa/Cairo')::date<=m.due_date),'without_deadline',count(*) filter(where h.submitted_at is not null and m.due_date is null),'overdue',count(*) filter(where h.submitted_at is null and m.due_date<(now() at time zone 'Africa/Cairo')::date),'not_submitted',count(*) filter(where h.submitted_at is null)) into v_hw
 from public.study_materials m left join lateral (select hs.submitted_at from public.homework_submissions hs where hs.tenant_id=p_tenant and hs.material_id=m.id and hs.student_id=st.id order by hs.submitted_at desc limit 1) h on true
 where m.tenant_id=p_tenant and m.group_id=g.id and m.is_homework and (m.created_at at time zone 'Africa/Cairo')::date between v_from and v_to;
 return jsonb_build_object('student_id',st.id,'student_name',st.name,'group_id',g.id,'group_name',g.name,'teacher_name',(select name from public.tenants where id=p_tenant),'from',v_from,'to',v_to,'attendance',v_att,'grades',v_grades,'homework',v_hw);
end;$$;
revoke execute on function public.student_followup_report(uuid,uuid[],jsonb) from public,anon,authenticated;
grant execute on function public.student_followup_report(uuid,uuid[],jsonb) to service_role;

