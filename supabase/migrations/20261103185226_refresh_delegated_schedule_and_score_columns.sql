-- Rebuild the existing guarded views after additive table columns. Keep the
-- same tenant/group/action predicates and do not grant client roles access.
create or replace view public.assistant_delegated_sessions with (security_invoker=true,security_barrier=true) as select source.* from public.sessions source where public.assistant_delegated_row('sessions',to_jsonb(source)) with local check option;
create or replace view public.assistant_delegated_quiz_scores with (security_invoker=true,security_barrier=true) as select source.* from public.quiz_scores source where public.assistant_delegated_row('quiz_scores',to_jsonb(source)) with local check option;
revoke all on public.assistant_delegated_sessions,public.assistant_delegated_quiz_scores from public,anon,authenticated;
grant all on public.assistant_delegated_sessions,public.assistant_delegated_quiz_scores to service_role;
notify pgrst,'reload schema';
