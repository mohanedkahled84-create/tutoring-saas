import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import bcrypt from 'bcryptjs';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: assistant invitations, independent teacher passwords, group permissions and immediate revocation',{timeout:180000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients();
 const tenants=[randomUUID(),randomUUID()],origin='https://centerly-eg.com';let server;
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  for(const id of tenants){
   // These legacy content FKs deliberately do not cascade from a tenant.
   ok(await db.from('homework_submissions').delete().eq('tenant_id',id));
   ok(await db.from('study_materials').delete().eq('tenant_id',id));
   ok(await db.from('tenants').delete().eq('id',id));
  }
 });
 const {familyHash,familyToken}=await import('../dist/shared/utils/parentFamily.js');
 const {confirmAssistantMessage}=await import('../dist/features/assistants/access.js');
 const phone='2010'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');
 ok(await db.from('tenants').insert(tenants.map((id,i)=>({id,name:`isolated assistant teacher ${i}`}))));
 const groups=ok(await db.from('groups').insert([{tenant_id:tenants[0],name:'allowed group'},{tenant_id:tenants[0],name:'unassigned group'},{tenant_id:tenants[1],name:'other teacher group'}]).select('id,tenant_id'));
 const pay={salary_model:'per_day',salary:100,work_weekdays:[0,2,4],pay_start_date:'2026-11-01'};
 const permissions={'grades.view':true,'grades.edit':true,'students.view':true,'students.create':true,'students.edit':true,'groups.view':true,'attendance.view':true,'attendance.edit':true,'materials.view':true,'materials.create':true,'materials.edit':true,'quizzes.view':true,'quizzes.create':true,'quizzes.edit':true,'homework.view':true,'homework.edit':true,'reports.view':true};
 const invites=[];
 for(let i=0;i<2;i++){
  const nonce=familyToken();
  const row=ok(await db.rpc('assistant_invite',{p_tenant:tenants[i],p_assistant:null,p_teacher:null,p_phone:phone,p_nonce_hash:familyHash(nonce),p_permissions:permissions,p_all_groups:false,p_group_ids:[groups[i===0?0:2].id],p_pay:pay}));
  invites.push({...row,nonce});
 }
 const legacy=ok(await db.from('assistants').insert({tenant_id:tenants[0],name:'legacy assistant preserved',phone:'201155555555',salary:1250,salary_model:'monthly',status:'active'}).select('id,salary').single());
 await confirmAssistantMessage(db,'201100000001',`CENTRLY_ASSISTANT:${invites[0].nonce}`,async()=>{throw new Error('must never send a claim link to the wrong phone');});
 assert.equal(ok(await db.from('assistant_invitations').select('verified_at').eq('id',invites[0].invitation_id).single()).verified_at,null);
 const replies=[];
 for(const invite of invites)await confirmAssistantMessage(db,phone,`CENTRLY_ASSISTANT:${invite.nonce}`,async(to,text)=>{assert.equal(to,phone);replies.push(text);return true;});
 const tickets=replies.map(text=>text.match(/#invite=([\w-]{43})/)[1]);
 const passwordA='isolated-assistant-A-2026',passwordB='isolated-assistant-B-2026';
 const hashA=await bcrypt.hash(passwordA,12),hashB=await bcrypt.hash(passwordB,12);
 const accepted=await Promise.all([db.rpc('assistant_accept_invitation',{p_claim_hash:familyHash(tickets[0]),p_name:'مساعد أ',p_password_hash:hashA}),db.rpc('assistant_accept_invitation',{p_claim_hash:familyHash(tickets[0]),p_name:'إعادة استخدام',p_password_hash:hashA})]);
 accepted.forEach(ok);assert.equal(accepted.filter(r=>r.data===invites[0].assistant_id).length,1,'a claim can be consumed once, even concurrently');
 assert.equal(ok(await db.rpc('assistant_accept_invitation',{p_claim_hash:familyHash(tickets[1]),p_name:'مساعد ب',p_password_hash:hashB})),invites[1].assistant_id);
 assert.equal(ok(await db.from('assistants').select('salary').eq('id',legacy.id).single()).salary,1250);
 const {app}=await import('../dist/app.js');server=app.listen(0);await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/assistant-access`;
 const request=(path,body,token,requestOrigin=origin)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:body===undefined?undefined:JSON.stringify(body)});
 const login=async(tenant,password)=>{const r=await request('/login',{workspace:tenant,phone,password});assert.equal(r.status,200,await r.clone().text());return (await r.json()).token;};
 assert.equal((await request('/login',{workspace:tenants[1],phone,password:passwordA})).status,401,'same phone at teacher B cannot use teacher A password');
 const session=await login(tenants[0],passwordA),second=await login(tenants[1],passwordB);
 ok(await db.from('tenants').update({status:'paused'}).eq('id',tenants[0]));
 assert.equal((await request('/me',undefined,session)).status,401,'inactive tenant cannot use a previously issued assistant session');
 assert.equal((await request('/login',{workspace:tenants[0],phone,password:passwordA})).status,401);
 ok(await db.from('tenants').update({status:'active'}).eq('id',tenants[0]));
 assert.equal((await request('/me',undefined,session,'https://other.centerly-eg.com')).status,401,'session is bound to its origin');
 const me=await (await request('/me',undefined,session)).json();assert.equal(me.tenant_id,tenants[0]);assert.deepEqual(me.groups.map(g=>g.id),[groups[0].id]);assert.ok(!JSON.stringify(me).includes('password_hash'));
 assert.equal((await request('/data/students/create',{name:'not allowed',parent_phone:phone,group_id:groups[1].id},session)).status,403);
 assert.equal((await request('/data/students/create',{name:'another teacher',parent_phone:phone,group_id:groups[2].id},session)).status,403);
 assert.equal((await request('/data/students/create',{name:'permission escalation',parent_phone:phone,group_id:groups[0].id,tenant_id:tenants[1]},session)).status,400);
 const created=await request('/data/students/create',{name:'allowed student',parent_phone:phone,group_id:groups[0].id},session);assert.equal(created.status,200,await created.clone().text());const student=(await created.json()).id;
 const studentRows=(await (await request('/data/students',undefined,session)).json()).rows;assert.equal(studentRows.length,1);assert.equal(studentRows[0].id,student);assert.ok(!JSON.stringify(studentRows).includes('portal_password'));
 const outsider=ok(await db.from('students').insert({tenant_id:tenants[0],group_id:groups[1].id,name:'out of scope',parent_phone:phone}).select('id').single());
 assert.equal((await request('/data/students/edit',{id:outsider.id,name:'forbidden edit',parent_phone:phone,student_phone:'',notes:''},session)).status,403);
 assert.equal(ok(await db.from('students').select('name').eq('id',outsider.id).single()).name,'out of scope');
 const privateMaterial=ok(await db.from('study_materials').insert({tenant_id:tenants[0],group_id:groups[1].id,title:'private homework',type:'pdf',url:'https://example.com/file',is_homework:true}).select('id').single());
 const privateSubmission=ok(await db.from('homework_submissions').insert({tenant_id:tenants[0],material_id:privateMaterial.id,student_id:outsider.id,file_url:'https://example.com/private',file_name:'test.pdf',file_size:100}).select('id').single());
 assert.equal((await request(`/files/${privateSubmission.id}`,undefined,session)).status,403);
 assert.equal((await request('/data/homework/edit',{id:privateSubmission.id,status:'approved',teacher_notes:''},session)).status,403);
 assert.equal((await request('/data/students',undefined,second)).status,200);assert.deepEqual((await (await request('/data/students',undefined,second)).json()).rows,[]);
 const quiz=await request('/data/quizzes/create',{group_id:groups[0].id,title:'test quiz',quiz_number:1,max_score:10,quiz_date:'2026-11-01'},session);assert.equal(quiz.status,200,await quiz.clone().text());
 const quizId=(await quiz.json()).id;
 const gradeRequest={quiz_id:quizId,student_id:student,score:0,note:'initial zero'};
 const gradeList=await request(`/data/grades?quiz_id=${quizId}`,undefined,session);assert.equal(gradeList.status,200);const unrecorded=await gradeList.json();assert.equal(unrecorded.rows.length,1);assert.equal(unrecorded.rows[0].score,null,'unrecorded grades are not zero');assert.equal(unrecorded.quizzes.length,1);
 assert.equal((await request('/data/grades/edit',gradeRequest,session)).status,200);
 assert.equal((await request('/data/grades/edit',{...gradeRequest,score:7.5,note:'corrected'},session)).status,200);
 assert.equal((await request('/data/grades/edit',{...gradeRequest,score:7.5,note:'corrected'},session)).status,200,'unchanged score saves remain idempotent');
 const scoreRows=ok(await db.from('quiz_scores').select('id,score,max_score,note').eq('quiz_id',quizId));assert.equal(scoreRows.length,1);assert.equal(scoreRows[0].score,7.5);assert.equal(scoreRows[0].max_score,10);
 for(const payload of [{...gradeRequest,score:11},{...gradeRequest,score:-1},{...gradeRequest,score:'8'},{...gradeRequest,max_score:100}])assert.equal((await request('/data/grades/edit',payload,session)).status,400);
 assert.equal((await request('/data/grades/create',gradeRequest,session)).status,403);
 assert.equal((await request('/data/grades/edit',{...gradeRequest,student_id:outsider.id},session)).status,403);
 assert.equal((await request(`/data/grades?quiz_id=${quizId}`,undefined,second)).status,403);
 const privateQuiz=ok(await db.from('quizzes').insert({tenant_id:tenants[0],group_id:groups[1].id,title:'out of scope quiz',quiz_number:1,max_score:10}).select('id').single());
 assert.equal((await request(`/data/grades?quiz_id=${privateQuiz.id}`,undefined,session)).status,403);
 assert.equal((await request('/data/grades/edit',{...gradeRequest,quiz_id:privateQuiz.id},session)).status,403);
 const {error:anonGrade}=await anonClient.rpc('assistant_grades',{p_token_hash:familyHash(session),p_origin:origin,p_action:'view',p_data:{quiz_id:quizId}});assert.equal(anonGrade?.code,'42501');
 ok(await db.from('quizzes').update({is_skipped:true}).eq('id',quizId));assert.equal((await request('/data/grades/edit',gradeRequest,session)).status,400);ok(await db.from('quizzes').update({is_skipped:false}).eq('id',quizId));
 const gradeAudit=ok(await db.from('assistant_access_audit').select('action,actor_name,changes').eq('tenant_id',tenants[0]).eq('action','grades.edit'));assert.equal(gradeAudit.length,2);assert.ok(gradeAudit.some(h=>h.changes.before.score===0 && h.changes.after.score===7.5));assert.equal(gradeAudit[0].actor_name,me.name);
 ok(await db.rpc('assistant_configure',{p_tenant:tenants[0],p_assistant:invites[0].assistant_id,p_permissions:{...permissions,'grades.edit':false},p_all_groups:false,p_group_ids:[groups[0].id],p_status:'active',p_pay:pay}));
 assert.equal((await request(`/data/grades?quiz_id=${quizId}`,undefined,session)).status,200);assert.equal((await request('/data/grades/edit',gradeRequest,session)).status,403,'view-only grade access does not permit changing a result');
 ok(await db.rpc('assistant_configure',{p_tenant:tenants[0],p_assistant:invites[0].assistant_id,p_permissions:{...permissions,'grades.view':false,'grades.edit':false},p_all_groups:false,p_group_ids:[groups[0].id],p_status:'active',p_pay:pay}));
 assert.equal((await request('/data/grades',undefined,session)).status,403,'quiz setup access alone does not grant student grades');
 ok(await db.rpc('assistant_configure',{p_tenant:tenants[0],p_assistant:invites[0].assistant_id,p_permissions:permissions,p_all_groups:false,p_group_ids:[groups[0].id],p_status:'active',p_pay:pay}));
 const material=await request('/data/materials/create',{group_id:groups[0].id,title:'test material',description:'',type:'link',url:'https://example.com/content',is_homework:true,due_date:'2026-11-01'},session);assert.equal(material.status,200,await material.clone().text());
 const sessionRow=ok(await db.from('sessions').insert({tenant_id:tenants[0],group_id:groups[0].id,session_number:1,session_date:'2026-11-01',status:'scheduled'}).select('id').single());
 const roster=(await (await request(`/data/attendance?session_id=${sessionRow.id}`,undefined,session)).json()).rows;assert.equal(roster[0].student_id,student);
 const attendance={session_id:sessionRow.id,student_id:student,attended:true,homework_status:'done',comment:'recorded by assistant'};
 assert.equal((await request('/data/attendance/edit',attendance,session)).status,200);
 assert.equal((await request('/data/attendance/edit',{...attendance,attended:false},session)).status,200);
 assert.equal(ok(await db.from('attendance').select('id').eq('session_id',sessionRow.id)).length,1,'attendance updates remain idempotent');
 ok(await db.from('students').update({notes:'owner change outside assistant session'}).eq('id',student));
 const edit={id:student,name:'allowed student',parent_phone:phone,student_phone:'',notes:'assistant follow-up'};
 assert.equal((await request('/data/students/edit',edit,session)).status,200);
 assert.equal((await request('/data/students/edit',edit,session)).status,200,'saving an unchanged record remains idempotent');
 const history=ok(await db.from('assistant_access_audit').select('action,actor_name,target_id,changes').eq('tenant_id',tenants[0]));
 const attendanceHistory=history.filter(h=>h.action==='attendance.edit');assert.equal(attendanceHistory.length,2,'one audit entry per real attendance change');
 assert.ok(attendanceHistory.some(h=>h.changes.before.attended===true && h.changes.after.attended===false));
 const createdHistory=history.filter(h=>h.action==='students.create' && h.target_id===student);assert.equal(createdHistory.length,1);assert.equal(createdHistory[0].actor_name,me.name);
 const edits=history.filter(h=>h.action==='students.edit' && h.target_id===student);assert.equal(edits.length,1,'owner writes and unchanged saves must not acquire assistant audit events');assert.equal(edits[0].changes.before.notes,'owner change outside assistant session');assert.equal(edits[0].changes.after.notes,'assistant follow-up');
 assert.ok(!JSON.stringify(history).includes('portal_password'));assert.ok(!history.some(h=>h.target_id===outsider.id),'forbidden writes leave no change or audit record');
 const noPermission=await request('/data/groups/create',{name:'blocked group',subject:''},session);assert.equal(noPermission.status,403);
 const {error:anonRpc}=await anonClient.rpc('assistant_workspace',{p_token_hash:familyHash(session),p_origin:origin,p_resource:'identity',p_action:'view'});assert.equal(anonRpc?.code,'42501');
 for(const table of ['assistant_accounts','assistant_invitations','assistant_sessions','assistant_access_audit'])assert.equal((await anonClient.from(table).select('*')).error?.code,'42501');
 // A public assistant bearer never authenticates as a Supabase staff JWT.
 assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/settings`,{headers:{Authorization:`Bearer ${session}`}})).status,401);
 assert.equal((await fetch(`http://127.0.0.1:${server.address().port}/api/assistants/activity`,{headers:{Authorization:`Bearer ${session}`}})).status,401);
 ok(await db.rpc('assistant_configure',{p_tenant:tenants[0],p_assistant:invites[0].assistant_id,p_permissions:{'students.view':true},p_all_groups:false,p_group_ids:[groups[0].id],p_status:'active',p_pay:pay}));
 assert.equal((await request('/data/students/edit',{id:student,name:'blocked edit',parent_phone:phone,student_phone:'',notes:''},session)).status,403,'permission changes apply to an already-issued session');
 const {error:foreignConfigure}=await db.rpc('assistant_configure',{p_tenant:tenants[1],p_assistant:invites[0].assistant_id,p_permissions:{},p_all_groups:true,p_group_ids:[],p_status:'inactive',p_pay:pay});assert.equal(foreignConfigure,null);
 const {assistantManagementRouter}=await import('../dist/features/assistants/access.js');
 const updateAccess=assistantManagementRouter.stack.find(layer=>layer.route?.path==='/:id/access').route.stack.at(-1).handle;
 const managementResponse={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 await updateAccess({user:{tenant_id:tenants[0]},params:{id:invites[0].assistant_id},body:{permissions:{'students.view':true},all_groups:false,group_ids:[groups[0].id],status:'active'}},managementResponse);
 assert.equal(managementResponse.body.success,true);const retainedPay=ok(await db.from('assistants').select('salary,salary_model,work_weekdays,pay_start_date').eq('id',invites[0].assistant_id).single());assert.deepEqual(retainedPay,{salary:100,salary_model:'per_day',work_weekdays:[0,2,4],pay_start_date:'2026-11-01'},'non-financial access saves retain the configured pay');
 // Reinvitation must work without sending a cached salary, even for daily pay.
 // Explicitly disable Meta here: live fixtures must never send real messages.
 const {config}=await import('../dist/shared/config/index.js');
 const previousAppSecret=config.meta.appSecret;config.meta.appSecret='';
 const reinviteResponse={status(code){this.code=code;return this;},json(body){this.body=body;return this;}};
 try {
  const reinvite=assistantManagementRouter.stack.find(layer=>layer.route?.path==='/invitations').route.stack.at(-1).handle;
  await reinvite({user:{tenant_id:tenants[0],id:randomUUID()},ip:'127.0.0.1',body:{assistant_id:invites[0].assistant_id,phone,permissions:{'students.view':true},all_groups:false,group_ids:[groups[0].id]}},reinviteResponse);
 } finally {config.meta.appSecret=previousAppSecret;}
 assert.equal(reinviteResponse.code,201,JSON.stringify(reinviteResponse.body));assert.equal(reinviteResponse.body.delivery_status,'blocked');
 assert.deepEqual(ok(await db.from('assistants').select('salary,salary_model,work_weekdays,pay_start_date').eq('id',invites[0].assistant_id).single()),retainedPay,'recovering access never resets daily pay or schedule');
 assert.equal((await request('/me',undefined,session)).status,200,'another tenant cannot reconfigure this assistant');
 ok(await db.rpc('assistant_configure',{p_tenant:tenants[0],p_assistant:invites[0].assistant_id,p_permissions:{},p_all_groups:false,p_group_ids:[],p_status:'inactive',p_pay:pay}));
 assert.equal((await request('/me',undefined,session)).status,401);
 assert.equal((await request('/login',{workspace:tenants[0],phone,password:passwordA})).status,401);
 assert.equal((await request('/me',undefined,second)).status,200,'revocation at A does not affect B');
 assert.equal((await request('/logout',{},second)).status,200);assert.equal((await request('/me',undefined,second)).status,401);
 const {loadAssistantActivity}=await import('../dist/features/assistants/activity.js');
 assert.equal((await loadAssistantActivity(db,tenants[1],{assistant_id:invites[0].assistant_id})).entries.length,0,'owner audit filters cannot cross tenants');
 ok(await db.from('assistants').delete().eq('id',invites[0].assistant_id));
 const retained=await loadAssistantActivity(db,tenants[0],{});assert.ok(retained.entries.some(h=>h.action==='students.create' && h.assistant_id===null && h.actor_name===me.name),'actor snapshots survive assistant deletion');
 // Expiry and explicit cancellation revoke the capability before account creation.
 const nonce=familyToken();
 const pending=ok(await db.rpc('assistant_invite',{p_tenant:tenants[0],p_assistant:null,p_teacher:null,p_phone:'2011'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'),p_nonce_hash:familyHash(nonce),p_permissions:{},p_all_groups:false,p_group_ids:[],p_pay:pay}));
 const invitedPhone=ok(await db.from('assistant_invitations').select('phone').eq('id',pending.invitation_id).single()).phone;
 ok(await db.from('assistant_invitations').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('id',pending.invitation_id));
 assert.equal(ok(await db.rpc('assistant_confirm_invitation',{p_nonce_hash:familyHash(nonce),p_phone:invitedPhone,p_claim_hash:familyHash(familyToken())})),null);
 ok(await db.from('assistant_invitations').update({expires_at:new Date(Date.now()+60000).toISOString()}).eq('id',pending.invitation_id));
 const claim=familyToken();ok(await db.rpc('assistant_confirm_invitation',{p_nonce_hash:familyHash(nonce),p_phone:invitedPhone,p_claim_hash:familyHash(claim)}));
 ok(await db.rpc('assistant_configure',{p_tenant:tenants[0],p_assistant:pending.assistant_id,p_permissions:{},p_all_groups:false,p_group_ids:[],p_status:'inactive',p_pay:pay}));
 assert.equal(ok(await db.rpc('assistant_accept_invitation',{p_claim_hash:familyHash(claim),p_name:'دعوة ملغاة',p_password_hash:hashA})),null);
});
