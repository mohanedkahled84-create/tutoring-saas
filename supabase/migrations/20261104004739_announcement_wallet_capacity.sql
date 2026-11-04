create function public.wallet_message_capacity(p_tenant uuid) returns integer
language plpgsql security invoker set search_path='' as $$
declare b jsonb;
begin
 b:=public.commercial_wallet(p_tenant,'balance',null);
 return floor(((b->>'paid_piasters')::numeric+(b->>'gift_piasters')::numeric)/100)::integer;
end$$;
revoke all on function public.wallet_message_capacity(uuid) from public,anon,authenticated;
grant execute on function public.wallet_message_capacity(uuid) to service_role;
do $$declare source text;anchor text;begin
 select pg_get_functiondef('public.announcement_operation(uuid,uuid,uuid,text,jsonb)'::regprocedure) into source;
 anchor:='(select jsonb_build_object(''remaining'',message_limit-reserved-sent,''unit_cost_egp'',unit_cost_egp,''period'',period) from public.announcement_allowances where tenant_id=p_tenant and period=date_trunc(''month'',now() at time zone ''Africa/Cairo'')::date)';
 if strpos(source,anchor)=0 then raise exception 'CANDIDATE_CONTRACT_CHANGED';end if;
 source:=replace(source,anchor,'jsonb_build_object(''remaining'',public.wallet_message_capacity(p_tenant),''unit_cost_egp'',1,''period'',date_trunc(''month'',now() at time zone ''Africa/Cairo'')::date)');
 execute source;
end$$;
