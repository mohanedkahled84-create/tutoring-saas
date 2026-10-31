-- Exact canonical matching is essential: a matching phone suffix is not proof of identity.
create index if not exists students_meta_student_phone_idx on public.students(public.parent_family_phone(student_phone));
create function public.meta_portal_phone_records(p_phone text) returns jsonb
language sql stable security invoker set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'tenant_id',s.tenant_id,'name',s.name,
 'parent_match',public.parent_family_phone(s.parent_phone)=p_phone,
 'student_match',public.parent_family_phone(s.student_phone)=p_phone) order by s.id),'[]'::jsonb)
 from public.students s where p_phone=public.parent_family_phone(p_phone) and
 (public.parent_family_phone(s.parent_phone)=p_phone or public.parent_family_phone(s.student_phone)=p_phone);
$$;
revoke execute on function public.meta_portal_phone_records(text) from public,anon,authenticated;
grant execute on function public.meta_portal_phone_records(text) to service_role;
