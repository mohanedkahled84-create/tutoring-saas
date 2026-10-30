-- These nullable profile columns already exist in production, but were absent
-- after replaying the historical migrations into the isolated test project.
-- Do not hide the resulting auth failure or relax get_user_profile permissions.
alter table public.users add column if not exists full_name text;
alter table public.users add column if not exists phone text;
