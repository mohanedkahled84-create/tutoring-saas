-- Some isolated databases applied the original lockdown before its JWT/RLS
-- correction. An amended historical file does not run again. Repair only the
-- core tables needed by the authenticated group repository; keep all existing
-- tenant and commercial policies, and leave anon/service-only tables closed.
do $$
declare name text;
begin
 foreach name in array array['groups','group_students','students','enrollments'] loop
  if not exists (select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relname=name and c.relrowsecurity)
    or not exists (select 1 from pg_policies where schemaname='public' and tablename=name) then
   raise exception 'JWT access requires existing RLS policies on %',name;
  end if;
 end loop;
end $$;

grant select,insert,update,delete on public.groups,public.group_students to authenticated;
grant select,update on public.students to authenticated;
-- The students RLS expression references enrollments even for an owner.
grant select on public.enrollments to authenticated;
