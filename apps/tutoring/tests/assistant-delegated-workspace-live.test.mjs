import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: actual teacher controllers with opaque assistant session enforce tenant/group/action boundaries',{timeout:180000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID(),foreign=randomUUID();let owner,server;
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(owner)await db.auth.admin.deleteUser(owner.id);for(const id of [tenant,foreign]){ok(await db.from('homework_submissions').delete().eq('tenant_id',id));ok(await db.from('study_materials').delete().eq('tenant_id',id));ok(await db.from('tenants').delete().eq('id',id));}});
 ok(await db.from('tenants').insert([{id:tenant,name:'isolated shared teacher'},{id:foreign,name:'isolated other teacher'}]));
 owner=ok(await db.auth.admin.createUser({email:`delegated-${randomUUID()}@isolated.invalid`,password:'isolated-fixture-password-2026',email_confirm:true})).user;
 ok(await db.from('users').upsert({id:owner.id,email:owner.email,role:'owner',tenant_id:tenant,full_name:'isolated teacher'}));
 const groups=ok(await db.from('groups').insert([{tenant_id:tenant,name:'allowed'},{tenant_id:tenant,name:'unassigned'},{tenant_id:foreign,name:'foreign'}]).select());
 const students=ok(await db.from('students').insert(groups.map((g,i)=>({tenant_id:g.tenant_id,group_id:g.id,name:`isolated student ${i}`,parent_phone:'201012345678',student_phone:'201011111111',portal_password:'private-student-password'}))).select());
 const shared=ok(await db.from('students').insert({tenant_id:tenant,group_id:groups[1].id,name:'shared student with hidden primary group',parent_phone:'201012345678'}).select().single());
 ok(await db.from('group_students').insert({tenant_id:tenant,group_id:groups[0].id,student_id:shared.id}));
 const staff=ok(await db.from('assistants').insert({tenant_id:tenant,name:'isolated assistant',phone:'201055555555',status:'active'}).select().single());
 const permissions={'students.view':true,'students.edit':true,'students.collect':true,'groups.view':true,'attendance.view':true,'attendance.create':true,'attendance.edit':true,'materials.view':true,'materials.create':true,'materials.edit':true,'video-lessons.view':true,'video-lessons.create':true,'online-quizzes.view':true,'online-quizzes.create':true};
 ok(await db.from('assistant_accounts').insert({assistant_id:staff.id,tenant_id:tenant,phone:staff.phone,password_hash:'isolated-no-login-hash',permissions,group_ids:[groups[0].id]}));
 const {familyToken,familyHash}=await import('../dist/shared/utils/parentFamily.js');const token=familyToken(),origin='https://centerly-eg.com';
 ok(await db.from('assistant_sessions').insert({token_hash:familyHash(token),assistant_id:staff.id,origin,credential_version:1}));
 const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/assistant-access/workspace-api`;
 const request=(path,method='GET',body,page='students',session=token)=>fetch(base+path,{method,headers:{Origin:origin,Authorization:`Bearer ${session}`,'X-Assistant-Page':page,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const context=await request('/context');assert.equal(context.status,200,await context.clone().text());assert.equal((await context.json()).user.id,owner.id);
 const roster=await request('/students');assert.equal(roster.status,200,await roster.clone().text());const text=await roster.text();assert.ok(text.includes(students[0].name));assert.ok(!text.includes(students[1].name));assert.ok(!text.includes(students[2].name));assert.ok(!text.includes('private-student-password'));
 const visible=JSON.parse(text).students;assert.equal(visible.find(s=>s.id===students[0].id).group_id,groups[0].id);assert.equal(visible.find(s=>s.id===shared.id).group_id,groups[0].id);assert.ok(!text.includes(groups[1].id),'a shared student must not disclose its inaccessible primary group');
 const grouped=await request('/groups');assert.equal(grouped.status,200,await grouped.clone().text());const groupText=await grouped.text();assert.ok(groupText.includes(groups[0].id));assert.ok(!groupText.includes(groups[1].id));assert.ok(!groupText.includes(groups[2].id));
 const edit=await request('/students/'+students[0].id,'PUT',{notes:'delegated write verified'});assert.equal(edit.status,200,await edit.clone().text());assert.equal(ok(await db.from('students').select('notes').eq('id',students[0].id).single()).notes,'delegated write verified');
 await request('/students/'+students[1].id,'PUT',{notes:'must not change'});assert.notEqual(ok(await db.from('students').select('notes').eq('id',students[1].id).single()).notes,'must not change');
 for(const path of ['/admin/overview','/auth/refresh','/whatsapp/test','/settings/security-pin','/assistants/invitations']){
  const response=await request(path,path==='/admin/overview'?'GET':'POST',path==='/admin/overview'?undefined:{});assert.equal(response.status,403,path+' '+await response.text());
 }
 const newSession=await request('/sessions','POST',{group_id:groups[0].id,session_number:1,session_date:'2026-11-02'},'sessions');assert.equal(newSession.status,201,await newSession.clone().text());
 const unauthorizedSession=await request('/sessions','POST',{group_id:groups[1].id,session_number:1,session_date:'2026-11-02'},'sessions');assert.notEqual(unauthorizedSession.status,201);assert.equal(ok(await db.from('sessions').select('id').eq('group_id',groups[1].id)).length,0);
 const materials=ok(await db.from('study_materials').insert([{tenant_id:tenant,group_id:groups[0].id,title:'own PDF',type:'pdf',url:'https://example.com/own.pdf'},{tenant_id:tenant,group_id:groups[1].id,title:'unassigned PDF',type:'pdf',url:'https://example.com/private.pdf'},{tenant_id:foreign,group_id:groups[2].id,title:'foreign PDF',type:'pdf',url:'https://example.com/foreign.pdf'}]).select());
 const content=await request('/materials','GET',undefined,'materials');assert.equal(content.status,200,await content.clone().text());const contentText=await content.text();assert.ok(contentText.includes('own PDF'));assert.ok(!contentText.includes('unassigned PDF'));assert.ok(!contentText.includes('foreign PDF'));
 const createMaterial=await request('/materials','POST',{title:'assistant homework',type:'pdf',group_id:groups[0].id,is_homework:true},'materials');assert.equal(createMaterial.status,201,await createMaterial.clone().text());
 const hiddenEdit=await request('/materials/'+materials[1].id,'PATCH',{title:'must not edit'},'materials');assert.notEqual(hiddenEdit.status,200);assert.equal(ok(await db.from('study_materials').select('title').eq('id',materials[1].id).single()).title,'unassigned PDF');
 const quiz=await request('/quizzes/rich','POST',{group_id:groups[0].id,quiz_number:8,title:'delegated online quiz',exam_mode:'online',questions:[{id:'q1',type:'mcq',question:'isolated',options:['A','B'],correct_answer:'A',points:1}]},'online-quizzes');assert.equal(quiz.status,200,await quiz.clone().text());
 const spoof=await request('/materials','POST',{title:'mode spoof',type:'paper_exam',group_id:groups[0].id,url:'https://example.com/paper'},'materials');assert.equal(spoof.status,403);
 const receiptRequest=randomUUID();const receipt=await request('/assistants/collections','POST',{group_id:groups[0].id,student_id:students[0].id,request_id:receiptRequest,amount:1,payment_method:'cash',note:'isolated synthetic receipt'},'students');assert.equal(receipt.status,201,await receipt.clone().text());
 const savedReceipt=ok(await db.from('student_collections').select('assistant_id,actor_user_id,actor_name').eq('tenant_id',tenant).eq('request_id',receiptRequest).single());assert.equal(savedReceipt.assistant_id,staff.id);assert.equal(savedReceipt.actor_user_id,null);assert.equal(savedReceipt.actor_name,staff.name);
 ok(await db.from('assistant_accounts').update({permissions:{'students.view':true}}).eq('assistant_id',staff.id));
 assert.equal((await request('/students/'+students[0].id,'PUT',{notes:'revoked'})).status,403);
 ok(await db.from('assistants').update({status:'inactive'}).eq('id',staff.id));assert.equal((await request('/context')).status,401);
 for(const table of ['assistant_delegated_students','portal_onboarding_deliveries']){const result=await anonClient.from(table).select('*').limit(1);assert.ok(result.error,table+' must remain private');}
});
