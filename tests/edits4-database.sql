begin;
set local request.jwt.claim.role='service_role';
do $test$
declare tenant uuid:=gen_random_uuid();other_tenant uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();student_id uuid:=gen_random_uuid();r jsonb;oid uuid;cid uuid:=gen_random_uuid();period_start timestamptz;period_end timestamptz;fixture_group uuid:=gen_random_uuid();ann_id uuid:=gen_random_uuid();ticket_id uuid:=gen_random_uuid();
begin
 insert into public.tenants(id,name) values(tenant,'edits4 isolated fixture'),(other_tenant,'edits4 isolated other');
 insert into auth.users(id,email) values(owner_id,'edits4-'||owner_id||'@isolated.invalid'),(admin_id,'edits4-'||admin_id||'@isolated.invalid');
 insert into public.users(id,tenant_id,role,email) values(owner_id,tenant,'owner','edits4-'||owner_id||'@isolated.invalid'),(admin_id,null,'admin','edits4-'||admin_id||'@isolated.invalid');
 insert into public.students(id,tenant_id,name,student_code,student_phone) values(student_id,tenant,'Isolated student','edits4','201099999999');
 r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',gen_random_uuid(),'kind','subscribe','plan_id','pro_v1','cycle_months',6));
 if (r->>'amount_piasters')::integer<>407490 then raise exception 'Term pricing mismatch: %',r->>'amount_piasters';end if;
 if (r#>>'{snapshot,billing,discount_pct}')::integer<>15 then raise exception 'Term discount mismatch';end if;
 oid:=(r->>'id')::uuid;
 if jsonb_array_length(public.subscription_operation(owner_id,'overview')->'orders')<>0 then raise exception 'Unsubmitted order leaked';end if;
 perform public.subscription_operation(owner_id,'submit',jsonb_build_object('id',oid,'payment_method','instapay','reference','isolated-no-transfer','proof_image_url','fixture'));
 perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',oid));
 select starts_at,ends_at into period_start,period_end from public.commercial_subscription_periods where tenant_id=tenant and cycle_months=6;
 if period_end is distinct from period_start+interval '6 months' then raise exception 'Term length mismatch';end if;
 r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',gen_random_uuid(),'kind','renew','plan_id','pro_v1','cycle_months',12));
 if (r->>'amount_piasters')::integer<>719100 then raise exception 'Annual pricing mismatch: %',r->>'amount_piasters';end if;
 begin
  perform public.subscription_operation(owner_id,'quote',jsonb_build_object('id',gen_random_uuid(),'kind','renew','cycle_months',3));
  raise exception 'Invalid cycle accepted';
 exception when invalid_parameter_value then null;
 end;
 r:=public.student_email_contact('start',tenant,student_id,jsonb_build_object('challenge_id',cid,'email','fixture@isolated.invalid','code_hash',repeat('a',64)));
 if r->>'status'<>'created' then raise exception 'Email challenge not created';end if;
 begin
  perform public.student_email_contact('info',other_tenant,student_id);
  raise exception 'Cross tenant email accepted';
 exception when insufficient_privilege then null;
 end;
 r:=public.student_email_contact('verify',tenant,student_id,jsonb_build_object('challenge_id',cid,'code_hash',repeat('b',64)));
 if r->>'status'<>'invalid' then raise exception 'Wrong OTP accepted';end if;
 r:=public.student_email_contact('verify',tenant,student_id,jsonb_build_object('challenge_id',cid,'code_hash',repeat('a',64)));
 if r->>'status'<>'verified' then raise exception 'Correct OTP rejected';end if;

 insert into public.groups(id,tenant_id,name) values(fixture_group,tenant,'Edits4 isolated group');
 update public.students s set group_id=fixture_group where s.id=student_id;
 insert into public.teacher_announcements(id,tenant_id,created_by,title,group_ids,recipient_roles,status,published_at)
 values(ann_id,tenant,owner_id,'Isolated announcement',array[fixture_group],array['student'],'published',now());
 r:=public.announcement_email_enqueue(tenant,owner_id,null,ann_id,1);
 if (r->>'queued')::integer<>1 then raise exception 'Verified email not queued: %',r;end if;
 r:=public.announcement_email_enqueue(tenant,owner_id,null,ann_id,1);
 if (r->>'queued')::integer<>0 then raise exception 'Duplicate email queued';end if;
 perform public.student_email_contact('disable',tenant,student_id);
 r:=public.announcement_email_worker('claim');
 if r->>'skipped' is distinct from 'true' then raise exception 'Opt out did not cancel queued email';end if;
 r:=public.support_operation(owner_id,'create',jsonb_build_object('id',ticket_id,'title','Isolated support','category','account','body','Fixture'));
 perform public.support_operation(admin_id,'reply',jsonb_build_object('id',ticket_id,'request_id',gen_random_uuid(),'body','Fixture admin answer'));
 r:=public.support_operation(owner_id,'view',jsonb_build_object('id',ticket_id));
 if jsonb_array_length(r->'replies')<>1 or r#>>'{replies,0,author_role}'<>'admin' then raise exception 'Admin reply not visible to teacher';end if;

 if (public.student_email_contact('info',tenant,student_id)->>'enabled')::boolean then raise exception 'Email opt-out ignored';end if;
end $test$;
rollback;
