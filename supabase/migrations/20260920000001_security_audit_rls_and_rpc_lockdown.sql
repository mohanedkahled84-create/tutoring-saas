-- Security audit remediation: tenant data is never public.
do $$
declare target text;
begin
  foreach target in array array['study_materials','message_templates','quizzes','homework_submissions','teachers','assistants','rooms'] loop
    execute format('alter table public.%I enable row level security', target);
    execute format('revoke all on table public.%I from anon', target);
    execute format('revoke insert, update, delete on table public.%I from authenticated', target);
    execute format('drop policy if exists "audit tenant read" on public.%I', target);
    execute format('create policy "audit tenant read" on public.%I for select to authenticated using (tenant_id = (select public.get_current_user_tenant_id()))', target);
  end loop;
end $$;

drop policy if exists "Public full access to study_materials" on public.study_materials;
drop policy if exists "Public full access to message_templates" on public.message_templates;
drop policy if exists "Tenant users full access to quizzes" on public.quizzes;
drop policy if exists "Allow authenticated or backend insert on teachers" on public.teachers;
drop policy if exists "Allow authenticated or backend update on teachers" on public.teachers;
drop policy if exists "Allow authenticated or backend delete on teachers" on public.teachers;
drop policy if exists "Allow authenticated or backend insert on assistants" on public.assistants;
drop policy if exists "Allow authenticated or backend update on assistants" on public.assistants;
drop policy if exists "Allow authenticated or backend delete on assistants" on public.assistants;
drop policy if exists "Allow authenticated or backend insert on rooms" on public.rooms;
drop policy if exists "Allow authenticated or backend update on rooms" on public.rooms;
drop policy if exists "Allow authenticated or backend delete on rooms" on public.rooms;

revoke execute on function public.create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text) from public, anon, authenticated;
revoke execute on function public.create_room_secure(uuid, text, integer, numeric) from public, anon, authenticated;
grant execute on function public.create_teacher_secure(uuid, text, text, text[], text, numeric, text, uuid, text) to service_role, postgres;
grant execute on function public.create_assistant_secure(uuid, text, text, text, uuid, boolean, text, numeric, uuid, text) to service_role, postgres;
grant execute on function public.create_room_secure(uuid, text, integer, numeric) to service_role, postgres;
