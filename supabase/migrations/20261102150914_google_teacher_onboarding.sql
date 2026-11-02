-- This service-only function needs to read auth.users/identities, which are not
-- readable by service_role directly. It never inserts/deletes Auth identities or
-- accepts a role/tenant from the client. The API verifies the Google token first.
create function public.google_teacher_profile(p_user uuid,p_data jsonb default null)
returns jsonb language plpgsql security definer set search_path='' as $$
declare
 a auth.users;u public.users;t public.tenants;v_tenant uuid;v_email text;
 v_exists boolean;v_needed boolean;v_stages text[];v_name text;v_phone text;v_subject text;v_other text;
begin
 perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('google-profile:'||p_user::text,0));
 select * into a from auth.users where id=p_user;
 if not found or a.email_confirmed_at is null or nullif(a.email,'') is null or coalesce(a.is_anonymous,false)
  or not exists(select 1 from auth.identities where user_id=p_user and provider='google') then raise exception 'GOOGLE_IDENTITY_REQUIRED';end if;
 v_email:=lower(trim(a.email));
 select * into u from public.users where id=p_user;v_exists:=found;
 if v_exists then
  if u.role not in ('owner','teacher','admin','center_owner') then raise exception 'GOOGLE_ROLE_NOT_SUPPORTED';end if;
  if u.role<>'admin' then
   select * into t from public.tenants where id=u.tenant_id;
   if not found or t.status<>'active' or t.deleted_at is not null then raise exception 'GOOGLE_ACCOUNT_DISABLED';end if;
  end if;
 else
  if exists(select 1 from public.users where lower(trim(email))=v_email and id<>p_user) then raise exception 'GOOGLE_ACCOUNT_CONFLICT';end if;
 end if;
 v_needed:=not v_exists or (u.role in ('owner','teacher') and (
  nullif(trim(u.full_name),'') is null or nullif(trim(u.phone),'') is null or nullif(trim(u.subject),'') is null
  or case when jsonb_typeof(t.settings->'education_stages')='array' then jsonb_array_length(t.settings->'education_stages')=0 else true end));
 if p_data is not null then
  if v_exists and u.role not in ('owner','teacher') then raise exception 'GOOGLE_ROLE_NOT_SUPPORTED';end if;
  if jsonb_typeof(p_data)<>'object' or (p_data->'terms_accepted') is distinct from 'true'::jsonb
   or exists(select 1 from jsonb_object_keys(p_data) k where k not in ('full_name','phone','subject','education_stages','other_stage','terms_accepted')) then raise exception 'INVALID_GOOGLE_PROFILE';end if;
  v_name:=trim(p_data->>'full_name');v_phone:=trim(p_data->>'phone');v_subject:=trim(p_data->>'subject');v_other:=trim(coalesce(p_data->>'other_stage',''));
  if v_name is null or length(v_name)<2 or length(v_name)>120 or v_phone is null or v_phone!~'^01[0125][0-9]{8}$'
   or nullif(v_subject,'') is null or length(v_subject)>100 or length(v_other)>100 or jsonb_typeof(p_data->'education_stages') is distinct from 'array' then raise exception 'INVALID_GOOGLE_PROFILE';end if;
  select array_agg(distinct value) into v_stages from jsonb_array_elements_text(p_data->'education_stages');
  if coalesce(array_length(v_stages,1),0)<1 or not v_stages<@array['primary','preparatory','secondary','other']::text[]
   or ('other'=any(v_stages) and v_other='') then raise exception 'INVALID_GOOGLE_PROFILE';end if;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended('teacher-phone:'||public.parent_family_phone(v_phone),0));
  if exists(select 1 from public.users where id<>p_user and public.parent_family_phone(phone)=public.parent_family_phone(v_phone)) then raise exception 'PHONE_ALREADY_EXISTS';end if;
  if v_exists then
   v_tenant:=u.tenant_id;
   update public.users set full_name=v_name,phone=v_phone,subject=v_subject,email=v_email where id=p_user returning * into u;
  else
   insert into public.tenants(name,status,subscription_status,trial_ends_at,account_type,settings)
   values(v_name,'active','trial',now()+interval '14 days','teacher',jsonb_build_object('signup_source','google')) returning id into v_tenant;
   insert into public.users(id,tenant_id,role,email,full_name,phone,subject)
   values(p_user,v_tenant,'owner',v_email,v_name,v_phone,v_subject) returning * into u;
  end if;
  update public.tenants set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object('subject',v_subject,'education_stages',to_jsonb(v_stages),'other_stage',case when 'other'=any(v_stages) then v_other else '' end,'terms_accepted_at',now(),'google_onboarding_completed_at',now())
  where id=v_tenant returning * into t;
  v_needed:=false;
 end if;
 return jsonb_build_object('requires_profile',v_needed,'email',v_email,
  'full_name',coalesce(u.full_name,a.raw_user_meta_data->>'full_name',a.raw_user_meta_data->>'name',''),
  'phone',coalesce(u.phone,''),'subject',coalesce(u.subject,''),
  'education_stages',case when jsonb_typeof(t.settings->'education_stages')='array' then t.settings->'education_stages' else '[]'::jsonb end,
  'other_stage',coalesce(t.settings->>'other_stage',''),
  'user',case when not v_needed then jsonb_build_object('id',u.id,'tenant_id',u.tenant_id,'role',u.role,'email',v_email,'name',u.full_name,'full_name',u.full_name,'phone',u.phone,'subject',u.subject,'teacher_id',u.teacher_id,'assistant_id',u.assistant_id,'account_type',t.account_type,'has_security_pin',false) else null end);
end;$$;
revoke all on function public.google_teacher_profile(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.google_teacher_profile(uuid,jsonb) to service_role;
notify pgrst,'reload schema';
