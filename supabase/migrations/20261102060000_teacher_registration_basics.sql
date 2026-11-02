-- Save teaching basics in the same transaction as account creation. A failed
-- profile write cannot leave a half-created teacher or a duplicate workspace.
create function public.register_teacher_with_basics(p_data jsonb,p_trial_ends_at timestamptz)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare result jsonb;stages text[];
begin
 if jsonb_typeof(p_data->'education_stages')<>'array' or nullif(trim(p_data->>'subject'),'') is null or length(p_data->>'subject')>100 then raise exception 'INVALID_REGISTRATION_BASICS';end if;
 select array_agg(distinct value) into stages from jsonb_array_elements_text(p_data->'education_stages');
 if coalesce(array_length(stages,1),0)<1 or not stages<@array['primary','preparatory','secondary','other']::text[] then raise exception 'INVALID_REGISTRATION_BASICS';end if;
 if 'other'=any(stages) and (nullif(trim(p_data->>'other_stage'),'') is null or length(p_data->>'other_stage')>100) then raise exception 'INVALID_REGISTRATION_BASICS';end if;
 result:=public.register_tenant_owner_direct(p_email:=p_data->>'email',p_password:=p_data->>'password',p_full_name:=p_data->>'full_name',p_phone:=p_data->>'phone',p_tenant_name:=p_data->>'tenant_name',p_account_type:='teacher',p_trial_ends_at:=p_trial_ends_at,p_subject:=trim(p_data->>'subject'));
 if result->>'tenant_id' is null then raise exception 'REGISTRATION_UNAVAILABLE';end if;
 update public.tenants set settings=coalesce(settings,'{}'::jsonb)||jsonb_build_object('education_stages',to_jsonb(stages),'other_stage',case when 'other'=any(stages) then trim(p_data->>'other_stage') else '' end)
 where id=(result->>'tenant_id')::uuid;
 return result;
end;$$;
revoke execute on function public.register_teacher_with_basics(jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.register_teacher_with_basics(jsonb,timestamptz) to service_role;
notify pgrst,'reload schema';
