create table public.announcement_email_jobs(
 id uuid primary key default gen_random_uuid(),tenant_id uuid not null references public.tenants(id) on delete cascade,announcement_id uuid not null references public.teacher_announcements(id) on delete cascade,revision integer not null,student_id uuid not null references public.students(id) on delete cascade,email text not null,status text not null default 'queued' check(status in ('queued','sending','sent','failed','unknown','cancelled')),created_at timestamptz not null default now(),claimed_at timestamptz,provider_id text,unique(announcement_id,revision,email));
alter table public.announcement_email_jobs enable row level security;
revoke all on public.announcement_email_jobs from public,anon,authenticated;
grant all on public.announcement_email_jobs to service_role;
create index announcement_email_jobs_queued on public.announcement_email_jobs(created_at) where status='queued';
create function public.announcement_email_enqueue(p_tenant uuid,p_user uuid,p_assistant uuid,p_id uuid,p_revision integer) returns jsonb language plpgsql security invoker set search_path='' as $$
declare actor jsonb;a public.teacher_announcements;n integer;
begin
 actor:=public.announcement_actor(p_tenant,p_user,p_assistant,'send');
 select * into a from public.teacher_announcements where id=p_id and tenant_id=p_tenant for update;
 if a.id is null or not public.announcement_groups_allowed(p_tenant,actor,a.group_ids) then raise exception 'FORBIDDEN' using errcode='42501';end if;
 if a.status<>'published' or a.revision<>p_revision or a.expires_at<=now() then raise exception 'REVISION_CHANGED';end if;
 if not ('student'=any(a.recipient_roles)) then raise exception 'STUDENT_EMAIL_ONLY' using errcode='22023';end if;
 insert into public.announcement_email_jobs(tenant_id,announcement_id,revision,student_id,email)
 select distinct on (e.email) p_tenant,a.id,a.revision,s.id,e.email from public.student_notification_emails e join public.students s on s.id=e.student_id and s.tenant_id=e.tenant_id
 where e.tenant_id=p_tenant and e.enabled and s.archived_at is null and exists(select 1 from unnest(a.group_ids) g(id) where public.portal_group_in_current_year(g.id,p_tenant) and (s.group_id=g.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=s.id and gs.group_id=g.id)))
 order by e.email,s.id on conflict(announcement_id,revision,email) do nothing;
 get diagnostics n=row_count;
 return jsonb_build_object('queued',n);
end$$;
create function public.announcement_email_worker(p_action text,p_id uuid default null,p_provider text default null) returns jsonb language plpgsql security invoker set search_path='' as $$
declare job public.announcement_email_jobs;a public.teacher_announcements;
begin
 if p_action='claim' then
  update public.announcement_email_jobs set status='unknown' where status='sending' and claimed_at<now()-interval '2 minutes';
  select * into job from public.announcement_email_jobs where status='queued' order by created_at for update skip locked limit 1;
  if job.id is null then return null;end if;
  select * into a from public.teacher_announcements where id=job.announcement_id and tenant_id=job.tenant_id;
  if a.id is null or a.status<>'published' or a.revision<>job.revision or a.expires_at<=now() or not exists(select 1 from public.student_notification_emails e join public.students s on s.id=e.student_id and s.tenant_id=e.tenant_id where e.tenant_id=job.tenant_id and e.student_id=job.student_id and e.email=job.email and e.enabled and s.archived_at is null and exists(select 1 from unnest(a.group_ids) g(id) where public.portal_group_in_current_year(g.id,job.tenant_id) and (s.group_id=g.id or exists(select 1 from public.group_students gs where gs.tenant_id=job.tenant_id and gs.student_id=s.id and gs.group_id=g.id)))) then
   update public.announcement_email_jobs set status='cancelled' where id=job.id;return jsonb_build_object('skipped',true);
  end if;
  update public.announcement_email_jobs set status='sending',claimed_at=now() where id=job.id;
  return jsonb_build_object('id',job.id,'tenant_id',job.tenant_id,'email',job.email,'title',a.title);
 elsif p_action in ('sent','unknown') then
  update public.announcement_email_jobs set status=p_action,provider_id=left(p_provider,200) where id=p_id and status='sending';return jsonb_build_object('ok',true);
 end if;
 raise exception 'INVALID_INPUT';
end$$;
revoke all on function public.announcement_email_enqueue(uuid,uuid,uuid,uuid,integer),public.announcement_email_worker(text,uuid,text) from public,anon,authenticated;
grant execute on function public.announcement_email_enqueue(uuid,uuid,uuid,uuid,integer),public.announcement_email_worker(text,uuid,text) to service_role;
