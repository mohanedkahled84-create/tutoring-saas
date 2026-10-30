-- Match production's existing read-only queue access for authenticated users.
-- RLS resolves the current profile's tenant; dispatch writes stay service-only.
revoke all on public.meta_portal_dispatch_queue from anon;
revoke insert, update, delete, truncate, references, trigger
  on public.meta_portal_dispatch_queue from authenticated;
grant select on public.meta_portal_dispatch_queue to authenticated;
