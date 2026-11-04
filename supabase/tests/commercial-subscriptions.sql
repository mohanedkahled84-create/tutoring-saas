-- Run only against an isolated Supabase test project. Every fixture rolls back.
begin;
do $$
declare tenant uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();other_id uuid:=gen_random_uuid();order_id uuid:=gen_random_uuid();hold_id uuid:=gen_random_uuid();student_id uuid:=gen_random_uuid();r jsonb;v integer;
begin
 insert into public.tenants(id,name) values(tenant,'isolated commercial rollback fixture');
 insert into auth.users(id,email) values(owner_id,owner_id||'@fixture.invalid'),(admin_id,admin_id||'@fixture.invalid'),(other_id,other_id||'@fixture.invalid');
 insert into public.users(id,tenant_id,role,email) values(owner_id,tenant,'owner',owner_id||'@fixture.invalid'),(admin_id,null,'admin',admin_id||'@fixture.invalid'),(other_id,null,'owner',other_id||'@fixture.invalid');
 r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',order_id,'kind','subscribe','plan_id','max_v1'));
 if (r->>'amount_piasters')::integer<>99900 then raise exception 'WRONG_PRICE';end if;
 begin perform public.subscription_operation(other_id,'submit',jsonb_build_object('id',order_id,'payment_method','instapay','reference','fixture'));raise exception 'CROSS_TENANT_ACCEPTED';exception when insufficient_privilege then null;end;
 perform public.subscription_operation(owner_id,'submit',jsonb_build_object('id',order_id,'payment_method','instapay','reference','fixture-reference'));
 begin perform public.subscription_operation(owner_id,'approve',jsonb_build_object('id',order_id));raise exception 'SELF_APPROVE';exception when insufficient_privilege then null;end;
 perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',order_id));
 perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',order_id));
 select count(*) into v from public.wallet_lots where tenant_id=tenant;
 if v<>1 then raise exception 'DUPLICATE_GIFT';end if;
 r:=public.commercial_wallet(tenant,'balance',null);
 if (r->>'gift_piasters')::integer<>15000 then raise exception 'WRONG_GIFT';end if;
 perform public.commercial_wallet(tenant,'reserve',hold_id,100);
 perform public.commercial_wallet(tenant,'reserve',hold_id,100);
 r:=public.commercial_wallet(tenant,'balance',null);
 if (r->>'held_piasters')::integer<>100 then raise exception 'DOUBLE_RESERVE';end if;
 perform public.commercial_wallet(tenant,'debit',hold_id);
 perform public.commercial_wallet(tenant,'debit',hold_id);
 r:=public.commercial_wallet(tenant,'balance',null);
 if (r->>'gift_piasters')::integer<>14900 then raise exception 'DOUBLE_DEBIT';end if;
 r:=public.commercial_limits(tenant);
 if (r->>'students')::integer<>500 or not(r->>'teaching_platform')::boolean then raise exception 'WRONG_LIMITS';end if;
 insert into public.students(id,tenant_id,name,student_code,student_phone,parent_phone) values(student_id,tenant,'fixture student','a','01012345678','01000000001');
 begin insert into public.students(tenant_id,name,student_code,student_phone,parent_phone) values(tenant,'duplicate fixture','b','+20 101 234 5678','01000000001');raise exception 'PHONE_DUPLICATE_ACCEPTED';exception when unique_violation then null;end;
 insert into public.students(tenant_id,name,student_code,student_phone,parent_phone) values(tenant,'same parent allowed','c','01012345679','01000000001');
 order_id:=gen_random_uuid();
 r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',order_id,'kind','renew'));
 if(r->>'amount_piasters')::integer<>99900 then raise exception 'WRONG_RENEWAL';end if;
 perform public.subscription_operation(owner_id,'submit',jsonb_build_object('id',order_id,'payment_method','vodafone_cash','reference','renew-fixture'));
 perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',order_id));
 r:=public.commercial_wallet(tenant,'balance',null);
 if (r->>'gift_piasters')::integer<>14900 then raise exception 'FUTURE_GIFT_UNLOCKED';end if;
 if(select count(*) from public.commercial_subscription_periods where tenant_id=tenant)<>2 then raise exception 'PERIODS_NOT_SAVED';end if;
 -- Expiring gift holds remain settled exactly once, without restoring expired spendable credit.
 hold_id:=gen_random_uuid();perform public.commercial_wallet(tenant,'reserve',hold_id,100);
 update public.wallet_lots set expires_at=now()-interval '1 second' where tenant_id=tenant and kind='gift' and created_at<=now();
 perform public.commercial_wallet(tenant,'release',hold_id);
 r:=public.commercial_wallet(tenant,'balance',null);
 if (r->>'gift_piasters')::integer<>0 then raise exception 'EXPIRED_GIFT_RESTORED';end if;
 -- The order locks its period: paying once cannot extend twice.
 perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',order_id));
 if(select count(*) from public.commercial_subscription_periods where tenant_id=tenant)<>2 then raise exception 'DUPLICATE_RENEWAL';end if;
end$$;

do $$
declare tenant uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();admin_id uuid:=gen_random_uuid();order_id uuid;hold_id uuid:=gen_random_uuid();r jsonb;v integer;plan text;expected integer;v_phone text;
begin
 insert into auth.users(id,email) values(owner_id,owner_id||'@fixture.invalid'),(admin_id,admin_id||'@fixture.invalid');
 insert into public.tenants(id,name) values(tenant,'commercial edge cases');
 insert into public.users(id,tenant_id,role,email) values(owner_id,tenant,'owner',owner_id||'@fixture.invalid'),(admin_id,null,'admin',admin_id||'@fixture.invalid');
 if public.canonical_student_phone('٠١٠١٢٣٤٥٦٧٨')<>'201012345678' or public.canonical_student_phone('00201012345678')<>'201012345678' then raise exception 'PHONE_NORMALIZATION';end if;
 if not(public.commercial_limits(tenant)->>'is_trial')::boolean then raise exception 'NO_TRIAL';end if;
 if (select trial_ends_at-created_at from public.tenants where id=tenant)<>interval '7 days' then raise exception 'WRONG_TRIAL_DURATION';end if;
 if exists(select 1 from public.wallet_lots where tenant_id=tenant) then raise exception 'TRIAL_GIFT';end if;
 foreach plan in array array['basic_v1','pro_v1','max_v1'] loop
  order_id:=gen_random_uuid();r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',order_id,'kind','subscribe','plan_id',plan));
  expected:=case plan when 'basic_v1' then 24900 when 'pro_v1' then 79900 else 99900 end;
  if(r->>'amount_piasters')::integer<>expected then raise exception 'WRONG_CATALOG_PRICE';end if;
 end loop;
 order_id:=gen_random_uuid();r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',order_id,'kind','subscribe','plan_id','basic_v1'));
 perform public.subscription_operation(owner_id,'submit',jsonb_build_object('id',order_id,'payment_method','instapay','reference','fixture-payment'));
 perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',order_id));
 if(public.commercial_limits(tenant)->>'teaching_platform')::boolean then raise exception 'BASIC_TEACHING_ACCESS';end if;
 if(public.portal_tenant_context(tenant)->'commercial'->>'teaching_platform')::boolean then raise exception 'BASIC_PORTAL_TEACHING_ACCESS';end if;
 -- Paper definitions remain a management feature even in the legacy online_quiz storage representation.
 insert into public.study_materials(tenant_id,title,type,questions) values(tenant,'paper fixture','online_quiz','{"exam_mode":"paper","questions":[]}');
 begin insert into public.study_materials(tenant_id,title,type,questions) values(tenant,'online fixture','online_quiz','{"exam_mode":"online","questions":[]}');raise exception 'BASIC_ONLINE_WRITE_ALLOWED';exception when check_violation then null;end;
 begin insert into public.study_materials(tenant_id,title,type,url) values(tenant,'video fixture','video','https://youtu.be/fixture');raise exception 'BASIC_VIDEO_WRITE_ALLOWED';exception when check_violation then null;end;
 -- Last hour of a 30-day cycle: each extra seat is at least 60 piasters.
 update public.commercial_subscription_periods set starts_at=now()-interval '30 days'+interval '1 hour',ends_at=now()+interval '1 hour' where tenant_id=tenant;
 update public.commercial_subscriptions set period_start=now()-interval '30 days'+interval '1 hour',period_end=now()+interval '1 hour' where tenant_id=tenant;
 order_id:=gen_random_uuid();r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',order_id,'kind','students','quantity',3));
 if(r->>'amount_piasters')::integer<>180 then raise exception 'FIRST_SEAT_MINIMUM';end if;
 perform public.subscription_operation(owner_id,'submit',jsonb_build_object('id',order_id,'payment_method','vodafone_cash','reference','fixture-seats'));
 perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',order_id));
 if(public.commercial_limits(tenant)->>'students')::integer<>103 then raise exception 'ADDON_CAPACITY';end if;
 r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',gen_random_uuid(),'kind','renew'));
 if(r->>'amount_piasters')::integer<>25500 then raise exception 'RENEW_FULL_SEAT_PRICE';end if;
 perform public.subscription_operation(owner_id,'cancel_addon',jsonb_build_object('kind','students'));
 if(public.commercial_limits(tenant)->>'students')::integer<>103 then raise exception 'CANCEL_REMOVED_CURRENT_SEATS';end if;
 r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',gen_random_uuid(),'kind','renew'));
 if(r->>'amount_piasters')::integer<>24900 then raise exception 'CANCEL_NOT_APPLIED_RENEW';end if;
 -- Buying a different addon cannot silently reactivate a cancelled student addon.
 order_id:=gen_random_uuid();perform public.subscription_operation(owner_id,'quote',jsonb_build_object('id',order_id,'kind','assistants','quantity',1));
 perform public.subscription_operation(owner_id,'submit',jsonb_build_object('id',order_id,'payment_method','instapay','reference','fixture-assistant'));
 perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',order_id));
 if not(select cancel_on_renew from public.subscription_addons where tenant_id=tenant and kind='students') then raise exception 'CANCELLATION_LOST';end if;
 perform public.subscription_operation(owner_id,'resume_addon',jsonb_build_object('kind','students'));
 if(select cancel_on_renew from public.subscription_addons where tenant_id=tenant and kind='students') then raise exception 'CANCELLATION_NOT_REVERSIBLE';end if;
 -- Upgrade gifts: Pro 100 EGP, then only 50 EGP difference to Max.
 foreach plan in array array['pro_v1','max_v1'] loop
  order_id:=gen_random_uuid();r:=public.subscription_operation(owner_id,'quote',jsonb_build_object('id',order_id,'kind','upgrade','plan_id',plan));
  perform public.subscription_operation(owner_id,'submit',jsonb_build_object('id',order_id,'payment_method','instapay','reference','fixture-upgrade'));
  perform public.subscription_operation(admin_id,'approve',jsonb_build_object('id',order_id));
 end loop;
 r:=public.commercial_wallet(tenant,'balance',null);
 if(r->>'gift_piasters')::integer<>15000 then raise exception 'UPGRADE_GIFTS_DUPLICATED';end if;
 -- Real metadata bytes across both storage path formats count together.
 if public.commercial_storage_tenant('quiz-images',tenant||'/quizzes/x.png')<>tenant then raise exception 'QUIZ_STORAGE_UNMETERED';end if;
 begin perform public.commercial_storage_check(tenant,31000000000);raise exception 'OVERSIZE_UPLOAD_ACCEPTED';exception when check_violation then null;end;
 -- Wallet proof rejection must leave the active subscription alone.
 order_id:=gen_random_uuid();perform public.subscription_operation(owner_id,'quote',jsonb_build_object('id',order_id,'kind','wallet','quantity',5000));
 perform public.subscription_operation(owner_id,'submit',jsonb_build_object('id',order_id,'payment_method','instapay','reference','fixture-topup'));
 perform public.subscription_operation(admin_id,'reject',jsonb_build_object('id',order_id));
 if not(public.commercial_limits(tenant)->>'active')::boolean then raise exception 'TOPUP_REJECTION_DEACTIVATED_PLAN';end if;
 -- Suspensions close public portal reads immediately, even inside the paid period.
 update public.tenants set status='paused' where id=tenant;
 if(public.portal_tenant_context(tenant)->'commercial'->>'readable')::boolean then raise exception 'SUSPENDED_PORTAL_READABLE';end if;
 -- Global rolling recipient budget: repeated recipient, uncertainty and a full window.
 select count(distinct phone) into v from public.meta_dispatch_reservations where state<>'not_sent' and created_at>now()-interval '24 hours';
 update public.meta_dispatch_budget set recipient_limit=v+1 where singleton;
 v_phone:='201'||lpad((floor(random()*1000000000)::bigint)::text,9,'0');
 r:=public.meta_budget_try(hold_id,null,v_phone,false);
 if not(r->>'allowed')::boolean then raise exception 'BUDGET_FIRST_DENIED';end if;
 perform public.meta_budget_settle(hold_id,'unknown');
 r:=public.meta_budget_try(gen_random_uuid(),null,v_phone,false);
 if not(r->>'allowed')::boolean then raise exception 'REPEATED_RECIPIENT_CHARGED_TWICE';end if;
 r:=public.meta_budget_try(gen_random_uuid(),null,'201'||lpad((floor(random()*1000000000)::bigint)::text,9,'0'),false);
 if(r->>'allowed')::boolean then raise exception 'GLOBAL_BUDGET_EXCEEDED';end if;
 if r->>'next_at' is null then raise exception 'NO_CAPACITY_ESTIMATE';end if;
end$$;
-- Parent deletion must not be blocked by a child trigger looking up a vanished tenant.
do $$declare tenant uuid:=gen_random_uuid();begin
 insert into public.tenants(id,name) values(tenant,'isolated cascade regression');
 insert into public.students(tenant_id,name,student_code,parent_phone) values(tenant,'fixture','cascade-fixture','01099999444');
 delete from public.tenants where id=tenant;
 if exists(select 1 from public.students where tenant_id=tenant) then raise exception 'CASCADE_INCOMPLETE';end if;
end$$;

-- Exercise actual authenticated SQL privileges, rather than only calling as postgres.
do $$declare tenant uuid:=gen_random_uuid();owner_id uuid:=gen_random_uuid();begin
 insert into public.tenants(id,name) values(tenant,'commercial RLS fixture');
 insert into auth.users(id,email) values(owner_id,owner_id||'@fixture.invalid');
 insert into public.users(id,tenant_id,role,email) values(owner_id,tenant,'owner',owner_id||'@fixture.invalid');
 insert into public.students(tenant_id,name,student_code,student_phone,parent_phone) values(tenant,'private fixture','rls','01099999001','01099999002');
 update public.commercial_subscription_periods set starts_at=now()-interval '40 days',ends_at=now()-interval '8 days' where tenant_id=tenant;
 update public.commercial_subscriptions set period_start=now()-interval '40 days',period_end=now()-interval '8 days' where tenant_id=tenant;
 perform set_config('test.commercial_tenant',tenant::text,true);
 perform set_config('request.jwt.claim.sub',owner_id::text,true);
end$$;
set local role authenticated;
do $$declare n integer;begin
 if has_function_privilege(current_user,'public.subscription_operation(uuid,text,jsonb)','execute') then raise exception 'BILLING_RPC_PUBLIC';end if;
 if has_function_privilege(current_user,'public.commercial_wallet(uuid,text,uuid,integer)','execute') then raise exception 'WALLET_RPC_PUBLIC';end if;
 if commercial_private.commercial_row_readable(current_setting('test.commercial_tenant')::uuid) then raise exception 'EXPIRED_READ_WINDOW_OPEN';end if;
 begin select count(*) into n from public.students where tenant_id=current_setting('test.commercial_tenant')::uuid;exception when insufficient_privilege then n:=0;end;
 if n<>0 then raise exception 'EXPIRED_ROWS_READABLE';end if;
 begin
  update public.tenants set subscription_status='active',subscription_ends_at=now()+interval '1 year' where id=current_setting('test.commercial_tenant')::uuid;
  if found then raise exception 'BILLING_FIELDS_FORGED';end if;
 exception when insufficient_privilege then null;end;
end$$;
reset role;
rollback;
