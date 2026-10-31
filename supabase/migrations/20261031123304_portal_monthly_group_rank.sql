-- Server-only scalar result. The public route supplies an already verified identity.
-- No peer names, phone numbers, scores or credentials leave the database.
create or replace function public.get_portal_monthly_group_rank(p_student_id uuid, p_tenant_id uuid)
returns jsonb language sql stable security invoker set search_path = '' as $$
with owner as (
  select s.id, coalesce(
    (select g.id from public.groups g where g.id=s.group_id and g.tenant_id=p_tenant_id),
    (select g.id from public.group_students gs join public.groups g on g.id=gs.group_id and g.tenant_id=gs.tenant_id
      where gs.student_id=s.id and gs.tenant_id=p_tenant_id order by g.id limit 1)
  ) as group_id
  from public.students s where s.id=p_student_id and s.tenant_id=p_tenant_id
), period as (
  select date_trunc('month', now() at time zone 'Africa/Cairo')::date as first_day
), peers as (
  select s.id from public.students s cross join owner o
  where s.tenant_id=p_tenant_id and o.group_id is not null and
    (s.group_id=o.group_id or exists(select 1 from public.group_students gs
      where gs.tenant_id=p_tenant_id and gs.student_id=s.id and gs.group_id=o.group_id))
), month_sessions as (
  select s.id from public.sessions s cross join owner o cross join period p
  where s.tenant_id=p_tenant_id and s.group_id=o.group_id
    and s.session_date>=p.first_day and s.session_date<(p.first_day+interval '1 month')
), marks as (
  select a.student_id, a.session_id, a.quiz_score as score, a.quiz_max_score as maximum
  from public.attendance a join month_sessions ms on ms.id=a.session_id join peers p on p.id=a.student_id
  where a.tenant_id=p_tenant_id and a.quiz_score is not null and a.quiz_max_score>0
  union all
  select q.student_id, q.session_id, q.score, q.max_score from public.quiz_scores q
  join peers p on p.id=q.student_id cross join owner o cross join period period
  where q.tenant_id=p_tenant_id and q.group_id=o.group_id and q.max_score>0 and q.score is not null
    and q.created_at >= (period.first_day::timestamp at time zone 'Africa/Cairo')
    and q.created_at < ((period.first_day+interval '1 month') at time zone 'Africa/Cairo')
    and not exists(select 1 from public.attendance a join month_sessions ms on ms.id=a.session_id
      where a.tenant_id=p_tenant_id and a.student_id=q.student_id and a.session_id=q.session_id
      and a.quiz_score is not null and a.quiz_max_score>0)
), attendance_stats as (
  select a.student_id, count(*) as sessions, round(100.0*count(*) filter(where a.attended)/count(*)) as attendance
  from public.attendance a join month_sessions ms on ms.id=a.session_id join peers p on p.id=a.student_id
  where a.tenant_id=p_tenant_id group by a.student_id
), grade_stats as (
  select student_id, count(*) as quizzes, round(avg(greatest(0,least(100,100.0*score/maximum))),1) as average
  from marks where score::text not in ('NaN','Infinity','-Infinity') and maximum::text not in ('NaN','Infinity','-Infinity')
  group by student_id
), stats as (
  select p.id, coalesce(a.sessions,0) as sessions, coalesce(a.attendance,0) as attendance,
    coalesce(g.quizzes,0) as quizzes, coalesce(g.average,0) as average,
    round((coalesce(g.average,0)*0.7+coalesce(a.attendance,0)*0.3)/
      nullif((case when g.quizzes>0 then 0.7 else 0 end)+(case when a.sessions>0 then 0.3 else 0 end),0),1) as overall
  from peers p left join attendance_stats a on a.student_id=p.id left join grade_stats g on g.student_id=p.id
), ranked as (
  select *, rank() over(order by (quizzes>0) desc, overall desc nulls last, average desc, attendance desc) as position,
    count(*) over() as size from stats
)
select jsonb_build_object('student_rank',case when sessions>0 or quizzes>0 then position else null end,
  'group_size',size,'rank_period',(select to_char(first_day,'YYYY-MM') from period))
from ranked where id=p_student_id;
$$;
revoke all on function public.get_portal_monthly_group_rank(uuid,uuid) from public, anon, authenticated;
grant execute on function public.get_portal_monthly_group_rank(uuid,uuid) to service_role;
