-- PostgREST cannot ON CONFLICT on an updatable view. Preserve the teacher
-- repository contract while doing both branches through the checked view.
create function public.assistant_delegated_upsert(p_table text,p_rows jsonb,p_conflict text default 'id',p_ignore boolean default false)
returns jsonb language plpgsql security invoker set search_path='' as $$
declare v_view text:='assistant_delegated_'||p_table;r jsonb;v_existing jsonb;v_visible jsonb;v_result jsonb;v_output jsonb:='[]';v_columns text;v_values text;v_set text;v_where text;v_key text;v_conflict text[]:=string_to_array(p_conflict,',');c jsonb:=public.assistant_delegated_context();
begin
 if not exists(select 1 from pg_catalog.pg_class cl join pg_catalog.pg_namespace n on n.oid=cl.relnamespace where n.nspname='public' and cl.relname=v_view and cl.relkind='v') then raise exception 'FORBIDDEN';end if;
 if jsonb_typeof(p_rows)<>'array' or jsonb_array_length(p_rows)>1000 then raise exception 'INVALID_INPUT';end if;
 foreach v_key in array v_conflict loop
  if not exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=to_regclass(format('public.%I',p_table)) and a.attname=v_key and a.attnum>0 and not a.attisdropped) then raise exception 'INVALID_INPUT';end if;
 end loop;
 for r in select value from jsonb_array_elements(p_rows) loop
  if jsonb_typeof(r)<>'object' or not exists(select 1 from jsonb_object_keys(r)) then raise exception 'INVALID_INPUT';end if;
  if exists(select 1 from jsonb_object_keys(r) k where not exists(select 1 from pg_catalog.pg_attribute a where a.attrelid=to_regclass(format('public.%I',p_table)) and a.attname=k and a.attnum>0 and not a.attisdropped)) then raise exception 'INVALID_INPUT';end if;
  select string_agg(format('%1$I is not distinct from (jsonb_populate_record(null::public.%2$I,$1)).%1$I',k,p_table),' and ') into v_where from unnest(v_conflict) k;
  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended((c->>'tenant_id')||':'||p_table||':'||(select jsonb_object_agg(k,r->k)::text from unnest(v_conflict) k),0));
  execute format('select to_jsonb(source) from public.%I source where %s limit 1 for update',p_table,v_where) into v_existing using r;
  if v_existing is not null then
   execute format('select to_jsonb(source) from public.%I source where %s limit 1',v_view,v_where) into v_visible using r;
   if v_visible is null then raise exception 'FORBIDDEN';end if;
   if p_ignore then v_output:=v_output||jsonb_build_array(v_visible);continue;end if;
   select string_agg(format('%1$I=(jsonb_populate_record(null::public.%2$I,$1)).%1$I',k,p_table),',') into v_set from jsonb_object_keys(r) k where k not in ('id','assistant_id');
   if v_set is null then v_result:=v_visible;else
    execute format('update public.%I source set %s where %s returning to_jsonb(source)',v_view,v_set,v_where) into v_result using r;
   end if;
  else
   select string_agg(format('%I',k),','),string_agg(format('(jsonb_populate_record(null::public.%I,$1)).%I',p_table,k),',') into v_columns,v_values from jsonb_object_keys(r) k;
   execute format('insert into public.%I as source (%s) values (%s) returning to_jsonb(source)',v_view,v_columns,v_values) into v_result using r;
  end if;
  if v_result is null then raise exception 'FORBIDDEN';end if;
  v_output:=v_output||jsonb_build_array(v_result);
 end loop;
 return v_output;
end;$$;
revoke execute on function public.assistant_delegated_upsert(text,jsonb,text,boolean) from public,anon,authenticated;
grant execute on function public.assistant_delegated_upsert(text,jsonb,text,boolean) to service_role;
notify pgrst,'reload schema';
