-- Actual receipts are distinct from attendance-based revenue estimates.
create table public.student_collections (
 id uuid primary key default gen_random_uuid(),
 tenant_id uuid not null references public.tenants(id) on delete cascade,
 group_id uuid references public.groups(id) on delete set null,
 student_id uuid references public.students(id) on delete set null,
 student_name_snapshot text not null,group_name_snapshot text not null,
 amount numeric(12,2) not null check(amount>0 and amount<=100000000),
 payment_method text not null check(payment_method in ('cash','instapay','vodafone_cash','bank_transfer','other')),
 note text not null default '' check(length(note)<=1000),
 collected_at timestamptz not null default now(),
 assistant_id uuid references public.assistants(id) on delete set null,
 actor_user_id uuid,actor_name text not null,
 request_id uuid not null,
 status text not null default 'active' check(status in ('active','void')),
 voided_at timestamptz,voided_by uuid,voided_by_name text,void_reason text,
 unique(tenant_id,request_id),
 check((status='active' and voided_at is null) or (status='void' and voided_at is not null and length(void_reason)>=3))
);
create index student_collections_tenant_time on public.student_collections(tenant_id,collected_at desc,id desc);
create index student_collections_group_time on public.student_collections(tenant_id,group_id,collected_at desc);
alter table public.student_collections enable row level security;
revoke all on public.student_collections from public,anon,authenticated;
grant all on public.student_collections to service_role;

-- Server-only implementation; callers supply a verified owner or assistant scope.
create function public.student_collection_operation(p_tenant uuid,p_assistant uuid,p_user uuid,p_actor text,p_groups uuid[],p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 v_group uuid:=nullif(p_data->>'group_id','')::uuid;
 v_student uuid:=nullif(p_data->>'student_id','')::uuid;
 v_from date:=coalesce(nullif(p_data->>'from','')::date,date_trunc('month',now() at time zone 'Africa/Cairo')::date);
 v_to date:=coalesce(nullif(p_data->>'to','')::date,(now() at time zone 'Africa/Cairo')::date);
 v_page integer:=coalesce((p_data->>'page')::integer,1);v_rows jsonb;v_students jsonb;v_total numeric;v_count bigint;
 v_amount numeric;v_method text;v_note text;v_name text;v_group_name text;r public.student_collections;
begin
 if p_actor is null or length(trim(p_actor))=0 or not exists(select 1 from public.tenants where id=p_tenant and status='active' and deleted_at is null) then raise exception 'UNAUTHORIZED';end if;
 if v_group is not null and (not v_group=any(p_groups) or not exists(select 1 from public.groups where id=v_group and tenant_id=p_tenant)) then raise exception 'FORBIDDEN';end if;
 if v_from>v_to or v_to-v_from>3660 or v_page<1 or v_page>10000 then raise exception 'INVALID_INPUT';end if;
 if p_action='view' then
  if v_student is not null and not exists(select 1 from public.students st where st.id=v_student and st.tenant_id=p_tenant and (st.group_id=any(p_groups) or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and gs.group_id=any(p_groups)))) then raise exception 'FORBIDDEN';end if;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_students from (
   select distinct st.id,st.name,g.id as group_id from public.students st join public.groups g on g.tenant_id=p_tenant and g.id=any(p_groups)
   and (st.group_id=g.id or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and gs.group_id=g.id))
   where st.tenant_id=p_tenant and (v_group is null or g.id=v_group)
   and (coalesce(p_data->>'q','')='' or st.name ilike '%'||(p_data->>'q')||'%' or st.student_code ilike '%'||(p_data->>'q')||'%')
   order by st.name,st.id,g.id limit 500
  ) x;
  select count(*),coalesce(sum(amount) filter(where status='active'),0) into v_count,v_total from public.student_collections
   where tenant_id=p_tenant and (group_id=any(p_groups) or (group_id is null and p_user is not null)) and (v_group is null or group_id=v_group) and (v_student is null or student_id=v_student)
   and (collected_at at time zone 'Africa/Cairo')::date between v_from and v_to;
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into v_rows from (
   select c.id,c.group_id,c.student_id,coalesce(st.name,c.student_name_snapshot) as student_name,c.group_name_snapshot as group_name,c.amount,c.payment_method,c.note,c.collected_at,c.actor_name,c.status,c.void_reason,c.voided_at,c.voided_by_name
   from public.student_collections c left join public.students st on st.id=c.student_id and st.tenant_id=p_tenant
   where c.tenant_id=p_tenant and (c.group_id=any(p_groups) or (c.group_id is null and p_user is not null)) and (v_group is null or c.group_id=v_group) and (v_student is null or c.student_id=v_student)
   and (c.collected_at at time zone 'Africa/Cairo')::date between v_from and v_to
   order by c.collected_at desc,c.id desc offset (v_page-1)*30 limit 30
  ) x;
  return jsonb_build_object('rows',v_rows,'students',v_students,'page',v_page,'has_more',v_count>v_page*30,'total_amount',v_total,'from',v_from,'to',v_to);
 elsif p_action='create' then
  if v_group is null or v_student is null then raise exception 'INVALID_INPUT';end if;
  select name into v_group_name from public.groups where id=v_group and tenant_id=p_tenant for share;
  if not found then raise exception 'FORBIDDEN';end if;
  select st.name into v_name from public.students st where st.id=v_student and st.tenant_id=p_tenant
   and (st.group_id=v_group or exists(select 1 from public.group_students gs where gs.tenant_id=p_tenant and gs.student_id=st.id and gs.group_id=v_group)) for share;
  if not found then raise exception 'FORBIDDEN';end if;
  v_amount:=(p_data->>'amount')::numeric;v_method:=p_data->>'payment_method';v_note:=coalesce(p_data->>'note','');
  if v_amount is null or v_amount<=0 or v_amount>100000000 or v_amount<>round(v_amount,2) or v_amount::text in ('NaN','Infinity','-Infinity') or v_method is null or v_method not in ('cash','instapay','vodafone_cash','bank_transfer','other') or length(v_note)>1000 or p_data->>'request_id' is null then raise exception 'INVALID_INPUT';end if;
  insert into public.student_collections(tenant_id,group_id,student_id,student_name_snapshot,group_name_snapshot,amount,payment_method,note,assistant_id,actor_user_id,actor_name,request_id)
   values(p_tenant,v_group,v_student,v_name,v_group_name,v_amount,v_method,v_note,p_assistant,p_user,p_actor,(p_data->>'request_id')::uuid)
   on conflict(tenant_id,request_id) do nothing returning * into r;
  if not found then
   select * into r from public.student_collections where tenant_id=p_tenant and request_id=(p_data->>'request_id')::uuid;
   if r.group_id is distinct from v_group or r.student_id is distinct from v_student or r.amount is distinct from v_amount or r.payment_method is distinct from v_method or r.note is distinct from v_note or r.assistant_id is distinct from p_assistant or r.actor_user_id is distinct from p_user then raise exception 'IDEMPOTENCY_CONFLICT';end if;
   return jsonb_build_object('id',r.id,'replayed',true,'status',r.status);
  end if;
  if p_assistant is not null then
   insert into public.assistant_access_audit(tenant_id,assistant_id,actor_name,action,target_id,target_name,changes)
    values(p_tenant,p_assistant,p_actor,'collections.create',r.id,v_name,jsonb_build_object('before','{}'::jsonb,'after',jsonb_build_object('amount',r.amount,'payment_method',r.payment_method,'note',r.note,'status',r.status)));
  end if;
  return jsonb_build_object('id',r.id,'replayed',false,'status',r.status);
 elsif p_action='void' then
  if p_assistant is not null or p_user is null then raise exception 'FORBIDDEN';end if;
  if length(trim(coalesce(p_data->>'reason','')))<3 or length(p_data->>'reason')>1000 then raise exception 'INVALID_INPUT';end if;
  select * into r from public.student_collections where id=(p_data->>'id')::uuid and tenant_id=p_tenant and (group_id=any(p_groups) or (group_id is null and p_user is not null)) for update;
  if not found then raise exception 'FORBIDDEN';end if;
  if r.status='void' then return jsonb_build_object('id',r.id,'status','void','replayed',true);end if;
  update public.student_collections set status='void',voided_at=now(),voided_by=p_user,voided_by_name=p_actor,void_reason=trim(p_data->>'reason') where id=r.id;
  if r.assistant_id is not null then
   select name into v_name from public.students where id=r.student_id and tenant_id=p_tenant;
   insert into public.assistant_access_audit(tenant_id,assistant_id,actor_name,action,target_id,target_name,changes)
    values(p_tenant,r.assistant_id,p_actor,'collections.void',r.id,coalesce(v_name,r.student_name_snapshot),jsonb_build_object('before',jsonb_build_object('status','active'),'after',jsonb_build_object('status','void','void_reason',trim(p_data->>'reason'))));
  end if;
  return jsonb_build_object('id',r.id,'status','void','replayed',false);
 end if;
 raise exception 'FORBIDDEN';
end;$$;
revoke execute on function public.student_collection_operation(uuid,uuid,uuid,text,uuid[],text,jsonb) from public,anon,authenticated;
grant execute on function public.student_collection_operation(uuid,uuid,uuid,text,uuid[],text,jsonb) to service_role;

create function public.assistant_collections(p_token_hash text,p_origin text,p_action text,p_data jsonb default '{}') returns jsonb
language plpgsql security invoker set search_path='' as $$
declare a public.assistant_accounts;s public.assistants;ids uuid[];
begin
 select ac.* into a from public.assistant_accounts ac join public.assistant_sessions ss on ss.assistant_id=ac.assistant_id
 where ss.token_hash=p_token_hash and ss.origin=p_origin and ss.expires_at>now() and ss.credential_version=ac.credential_version for share of ac;
 if not found then raise exception 'UNAUTHORIZED';end if;
 select * into s from public.assistants where id=a.assistant_id and tenant_id=a.tenant_id and status='active' for share;
 if not found then raise exception 'UNAUTHORIZED';end if;
 if p_action not in ('view','create') or coalesce(a.permissions->>'collections.view','false')<>'true' or coalesce(a.permissions->>('collections.'||p_action),'false')<>'true' then raise exception 'FORBIDDEN';end if;
 select coalesce(array_agg(g.id),'{}') into ids from public.groups g where g.tenant_id=a.tenant_id
  and (a.all_groups or g.id=any(a.group_ids)) and (s.teacher_id is null or g.teacher_id is null or g.teacher_id=s.teacher_id);
 return public.student_collection_operation(a.tenant_id,a.assistant_id,null,s.name,ids,p_action,p_data);
end;$$;
revoke execute on function public.assistant_collections(text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.assistant_collections(text,text,text,jsonb) to service_role;
