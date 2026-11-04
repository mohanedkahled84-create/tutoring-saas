import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomInt} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

// One account crosses the feature boundaries. Provider transport is deliberately
// replaced: this verifies persisted application behavior, not SMS/email delivery.
test('LIVE: new teacher -> paid plans -> targeted work -> student result -> assistant and family', {timeout:240000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients();
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 const email=`release-journey-${randomUUID()}@isolated.invalid`,password='Isolated-Journey-2026!';
 const phone='010'+String(randomInt(10000000,99999999)),parentPhone='2011'+String(randomInt(10000000,99999999));
 const origin='https://centerly-eg.com',users=[];
 let server,tenant,foreignTenant,ownerToken,adminToken,verificationCode;
 const {defaultEmailVerificationService}=await import('../dist/features/auth/emailService.js');
 const {config}=await import('../dist/shared/config/index.js');
 const originalMail=defaultEmailVerificationService.sendVerificationEmail,originalWebhook=config.n8nAdminAlertWebhookUrl;
 defaultEmailVerificationService.sendVerificationEmail=async options=>{assert.equal(options.email,email);verificationCode=options.code;return {success:true,id:'isolated-transport'};};
 config.n8nAdminAlertWebhookUrl='';
 t.after(async()=>{
  defaultEmailVerificationService.sendVerificationEmail=originalMail;config.n8nAdminAlertWebhookUrl=originalWebhook;
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  // A failed response can still have created the atomic registration. Recover
  // only this run's unique email before cleaning its disposable fixture.
  const account=ok(await db.from('users').select('id,tenant_id').eq('email',email).maybeSingle());
  if(account){tenant??=account.tenant_id;if(!users.includes(account.id))users.push(account.id);}
  ok(await db.from('parent_family_accounts').delete().eq('phone',parentPhone));
  if(tenant){
   for(const table of ['homework_submissions','portal_quiz_attempts','study_materials'])ok(await db.from(table).delete().eq('tenant_id',tenant));
   ok(await db.from('tenants').delete().eq('id',tenant));
  }
  if(foreignTenant)ok(await db.from('tenants').delete().eq('id',foreignTenant));
  ok(await db.from('email_verifications').delete().eq('email',email));
  ok(await db.from('message_logs').delete().eq('idempotency_key','founder_alert:'+email));
  for(const id of users)ok(await db.auth.admin.deleteUser(id));
 });
 const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api`;
 const request=(path,body,token=ownerToken)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:origin,'Content-Type':'application/json',...(path.startsWith('/assistant-access/workspace-api')?{'X-Assistant-Page':'students'}:{}),...(token?{Authorization:'Bearer '+token}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const json=async(response,status=200)=>{const body=await response.text();assert.equal(response.status,status,body);return JSON.parse(body);};

 await t.test('registration requires teaching basics and verification before login',async()=>{
  const registration={email,password,full_name:'مدرس تجربة معزولة',tenant_name:'منصة تجربة معزولة',phone,subject:'الفيزياء',registration_version:2,education_stages:['secondary']};
  assert.equal((await request('/auth/signup',{...registration,education_stages:[]})).status,400);
  const created=await json(await request('/auth/signup',registration),201);
  tenant=created.tenant.id;users.push(created.user.id);assert.equal(created.requires_verification,true);assert.equal(created.token,undefined);assert.equal(created.otp_code,undefined);
  assert.match(verificationCode,/^\d{6}$/);
  assert.notEqual((await request('/auth/login',{email,password})).status,200);
  const verified=await json(await request('/auth/verify-email',{email,code:verificationCode,password}));
  ownerToken=verified.token;assert.ok(ownerToken);assert.equal(verified.verified,true);
  const profile=ok(await db.from('tenants').select('settings,subscription_status').eq('id',tenant).single());assert.equal(profile.subscription_status,'trial');
 });

 const admin=ok(await db.auth.admin.createUser({email:`journey-admin-${randomUUID()}@isolated.invalid`,password,email_confirm:true})).user;users.push(admin.id);
 ok(await db.from('users').upsert({id:admin.id,email:admin.email,role:'admin',tenant_id:null,full_name:'Isolated approval fixture'}));
 adminToken=ok(await anonClient.auth.signInWithPassword({email:admin.email,password})).session.access_token;
 const checkout=async(kind,plan)=>{
  const id=randomUUID();const order=await json(await request('/billing/commercial/orders',{id,kind,plan_id:plan}));
  await json(await request(`/billing/commercial/orders/${id}/submit`,{payment_method:'instapay',reference:'isolated-no-money-moved'}));
  assert.equal((await request(`/billing/commercial/admin/orders/${id}/approve`,{})).status,403);
  await json(await request(`/billing/commercial/admin/orders/${id}/approve`,{},adminToken));return order;
 };
 await t.test('Basic approval and Pro/Max upgrades use server prices and one gift',async()=>{
  assert.equal((await checkout('subscribe','basic_v1')).amount_piasters,24900);
  let overview=await json(await request('/billing/commercial/'));assert.equal(overview.limits.students,100);assert.equal(overview.wallet.gift_piasters,0);
  const denied=await request('/quizzes/rich',{title:'Basic cannot create online exams',quiz_number:1,exam_mode:'online',questions:[{id:'q',type:'mcq',question:'اختبار',options:['A','B'],correct_answer:'B',points:3}]});assert.equal(denied.status,402,await denied.text());
  await checkout('upgrade','pro_v1');overview=await json(await request('/billing/commercial/'));assert.equal(overview.limits.students,300);assert.equal(overview.wallet.gift_piasters,10000);
  await checkout('upgrade','max_v1');overview=await json(await request('/billing/commercial/'));assert.equal(overview.limits.students,500);assert.equal(overview.wallet.gift_piasters,15000);
 });

 const groups=[],students=[];let homework,quiz;
 await t.test('teacher creates groups/students, duplicate phone offers no second record',async()=>{
  for(const name of ['المجموعة الأولى','المجموعة الثانية','مجموعة خارج الواجب'])groups.push((await json(await request('/groups',{name}),201)).group);
  for(let i=0;i<3;i++){
   const student=(await json(await request('/students',{name:'طالب تجربة '+i,parent_phone:parentPhone,student_phone:'012'+String(randomInt(10000000,99999999))}),201)).student;students.push(student);
   await json(await request(`/groups/${groups[i].id}/students`,{student_id:student.id}),201);
  }
  assert.equal((await request('/students',{name:'تكرار غير مسموح',parent_phone:parentPhone,student_phone:students[0].student_phone})).status,409);
  assert.equal(ok(await db.from('students').select('id').eq('tenant_id',tenant)).length,3);
  foreignTenant=randomUUID();ok(await db.from('tenants').insert({id:foreignTenant,name:'isolated outside account'}));
  const hidden=ok(await db.from('groups').insert({tenant_id:foreignTenant,name:'must stay hidden'}).select().single());
  assert.equal((await request('/groups/'+hidden.id)).status,404);
  const visible=await json(await request('/groups'));assert.equal(visible.groups.length,3);assert.ok(!visible.groups.some(g=>g.id===hidden.id));
 });
 await t.test('one homework targets two groups and preserves student submission',async()=>{
  homework=(await json(await request('/materials',{title:'واجب للمجموعتين',type:'pdf',is_homework:true,group_ids:groups.slice(0,2).map(g=>g.id)}),201)).material;
  assert.ok(homework?.id);
  for(let i=0;i<3;i++)assert.equal(ok(await db.rpc('homework_target_allowed',{p_student:students[i].id,p_tenant:tenant,p_material:homework.id})),i<2);
  const args={p_student:students[0].id,p_tenant:tenant,p_material:homework.id,p_file_url:`${tenant}/${homework.id}/${students[0].id}_fixture.pdf`,p_file_name:'fixture.pdf',p_file_size:1};
  const saved=ok(await db.rpc('submit_verified_homework',args));assert.equal(ok(await db.rpc('submit_verified_homework',args)).id,saved.id);
  assert.ok((await db.rpc('submit_verified_homework',{...args,p_student:students[2].id})).error);
 });
 await t.test('online exam keeps trusted answer key and its result reaches teacher',async()=>{
  await json(await request('/quizzes/rich',{group_id:groups[0].id,quiz_number:1,title:'اختبار رحلة التجربة',exam_mode:'online',questions:[{id:'q1',type:'mcq',question:'اختر B',options:['A','B'],correct_answer:'B',correct_index:1,points:3}]}));
  quiz=ok(await db.from('study_materials').select('id').eq('tenant_id',tenant).eq('type','online_quiz').single());
  const {generateParentPortalToken}=await import('../dist/shared/utils/tokens.js');const token=generateParentPortalToken(students[0].id,tenant);
  const started=await json(await request('/public/quizzes/start',{token,material_id:quiz.id}));assert.equal(started.definition.questions[0].correct_index,undefined);
  const answer=await json(await request('/public/quizzes/submit',{token,material_id:quiz.id,answers:{q1:1}}));assert.equal(answer.score,3);
  const retry=await json(await request('/public/quizzes/submit',{token,material_id:quiz.id,answers:{q1:0}}));assert.equal(retry.already_submitted,true);assert.equal(retry.score,3);
  const listed=await json(await request('/quizzes/submissions?status=graded'));assert.ok(listed.submissions.some(row=>row.student_id===students[0].id));
 });
 await t.test('assistant uses teacher controllers with view permission and cannot write',async()=>{
  const staff=ok(await db.from('assistants').insert({tenant_id:tenant,name:'مساعد التجربة',phone:'2015'+String(randomInt(10000000,99999999)),status:'active'}).select().single());
  const {familyHash,familyToken}=await import('../dist/shared/utils/parentFamily.js');const token=familyToken();
  ok(await db.from('assistant_accounts').insert({assistant_id:staff.id,tenant_id:tenant,phone:staff.phone,password_hash:'isolated-no-login',permissions:{'students.view':true},group_ids:[groups[0].id]}));
  ok(await db.from('assistant_sessions').insert({token_hash:familyHash(token),assistant_id:staff.id,origin,credential_version:1}));
  const visible=await json(await request('/assistant-access/workspace-api/students',undefined,token));assert.ok(visible.students.some(row=>row.id===students[0].id));assert.ok(!visible.students.some(row=>row.id===students[1].id));
  const edit=await fetch(base+'/assistant-access/workspace-api/students/'+students[0].id,{method:'PUT',headers:{Origin:origin,Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({notes:'must not write'})});assert.equal(edit.status,403);
 });
 await t.test('one family login finds all siblings without exposing their passwords',async()=>{
  const {deliverFamilyAccess}=await import('../dist/shared/utils/parentFamily.js');let secret;
  await deliverFamilyAccess(db,tenant,students[0].id,{ready:async()=>true,send:async(p,password)=>{assert.equal(p,parentPhone);secret=password;return true;}});
  assert.ok(secret);
  const login=await json(await request('/public/family/login',{phone:parentPhone,password:secret}));
  const account=await json(await request('/public/family/account',{family_token:login.family_token,student_id:students[0].id}));
  assert.equal(account.students.length,3);assert.equal(account.initial_data.student.id,students[0].id);assert.ok(!JSON.stringify(account).includes('portal_password'));
 });
});
