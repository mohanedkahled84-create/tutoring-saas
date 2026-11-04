create function public.commercial_trial_before() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.subscription_status='trial' then
  new.trial_ends_at:=coalesce(new.created_at,now())+interval '7 days';
  new.subscription_tier:='pro_v1';
  new.settings:=coalesce(new.settings,'{}')||jsonb_build_object('commercial_plan_id','pro_v1','students_limit',300,'plan_name','Pro');
 end if;
 return new;
end$$;
create function public.commercial_trial_after() returns trigger
language plpgsql security definer set search_path='' as $$
begin
 if new.subscription_status='trial' then
  insert into public.commercial_subscriptions(tenant_id,plan_id,period_start,period_end) values(new.id,'pro_v1',coalesce(new.created_at,now()),new.trial_ends_at);
  insert into public.commercial_subscription_periods(tenant_id,plan_id,starts_at,ends_at) values(new.id,'pro_v1',coalesce(new.created_at,now()),new.trial_ends_at);
 end if;
 return new;
end$$;
revoke all on function public.commercial_trial_before(),public.commercial_trial_after() from public,anon,authenticated;
create trigger commercial_trial_before before insert on public.tenants for each row execute function public.commercial_trial_before();
create trigger commercial_trial_after after insert on public.tenants for each row execute function public.commercial_trial_after();

create function public.commercial_business_write_guard() returns trigger
language plpgsql security definer set search_path='' as $$
declare row_data jsonb;tenant uuid;lim jsonb;v_mode text;
begin
 row_data:=case when tg_op='DELETE' then to_jsonb(old) else to_jsonb(new) end;
 tenant:=nullif(row_data->>'tenant_id','')::uuid;
 if tenant is not null and exists(select 1 from public.commercial_subscriptions where tenant_id=tenant) then
  -- Owner-confirmed account deletion has its own drain-and-cleanup workflow.
  if exists(select 1 from public.tenants where id=tenant and deleted_at is not null) then
   if tg_op='DELETE' then return old;end if;return new;
  end if;
  lim:=public.commercial_limits(tenant);
  if not (lim->>'active')::boolean then raise exception 'SUBSCRIPTION_EXPIRED' using errcode='23514';end if;
  if tg_table_name='study_materials' and tg_op<>'DELETE' and not(lim->>'teaching_platform')::boolean then
   begin v_mode:=(row_data->>'questions')::jsonb->>'exam_mode';exception when invalid_text_representation then v_mode:=null;end;
   if row_data->>'type'='video' or row_data->>'type'='online_quiz' and coalesce(v_mode,'online')<>'paper' then raise exception 'PLAN_FEATURE_REQUIRED' using errcode='23514';end if;
  end if;
  if tg_table_name='tenant_platform_settings' and tg_op<>'DELETE' and not(lim->>'teaching_platform')::boolean then raise exception 'PLAN_FEATURE_REQUIRED' using errcode='23514';end if;
 end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;
revoke all on function public.commercial_business_write_guard() from public,anon,authenticated;
do $$declare v_table text;begin
 foreach v_table in array array['students','groups','group_students','sessions','attendance','quiz_scores','quizzes','study_materials','homework_submissions','assistants','tenant_platform_settings','student_collections','teachers','rooms'] loop
  if exists(select 1 from information_schema.columns where table_schema='public' and table_name=v_table and column_name='tenant_id') then
   execute format('create trigger commercial_business_write_guard before insert or update or delete on public.%I for each row execute function public.commercial_business_write_guard()',v_table);
  end if;
 end loop;
end$$;
