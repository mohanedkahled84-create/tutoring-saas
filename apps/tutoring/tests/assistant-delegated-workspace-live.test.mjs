import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: actual teacher controllers with opaque assistant session enforce tenant/group/action boundaries',{timeout:180000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID(),foreign=randomUUID();let owner,server;
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}if(owner)await db.auth.admin.deleteUser(owner.id);for(const id of [tenant,foreign])ok(await db.from('tenants').delete().eq('id',id));});
 ok(await db.from('tenants').insert([{id:tenant,name:'isolated shared teacher'},{id:foreign,name:'isolated other teacher'}]));
 owner=ok(await db.auth.admin.createUser({email:`delegated-${randomUUID()}@isolated.invalid`,password:'isolated-fixture-password-2026',email_confirm:true})).user;
 ok(await db.from('users').upsert({id:owner.id,email:owner.email,role:'owner',tenant_id:tenant,full_name:'isolated teacher'}));
 const groups=ok(await db.from('groups').insert([{tenant_id:tenant,name:'allowed'},{tenant_id:tenant,name:'unassigned'},{tenant_id:foreign,name:'foreign'}]).select());
 const students=ok(await db.from('students').insert(groups.map((g,i)=>({tenant_id:g.tenant_id,group_id:g.id,name:`isolated student ${i}`,parent_phone:'201012345678',student_phone:'201011111111',portal_password:'private-student-password'}))).select());
 const staff=ok(await db.from('assistants').insert({tenant_id:tenant,name:'isolated assistant',phone:'201055555555',status:'active'}).select().single());
 const permissions={'students.view':true,'students.edit':true,'groups.view':true,'attendance.view':true,'attendance.create':true,'attendance.edit':true};
 ok(await db.from('assistant_accounts').insert({assistant_id:staff.id,tenant_id:tenant,phone:staff.phone,password_hash:'isolated-no-login-hash',permissions,group_ids:[groups[0].id]}));
 const {familyToken,familyHash}=await import('../dist/shared/utils/parentFamily.js');const token=familyToken(),origin='https://centerly-eg.com';
 ok(await db.from('assistant_sessions').insert({token_hash:familyHash(token),assistant_id:staff.id,origin,credential_version:1}));
 const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/assistant-access/workspace-api`;
 const request=(path,method='GET',body,page='students',session=token)=>fetch(base+path,{method,headers:{Origin:origin,Authorization:`Bearer ${session}`,'X-Assistant-Page':page,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 const context=await request('/context');assert.equal(context.status,200,await context.clone().text());assert.equal((await context.json()).user.id,owner.id);
 const roster=await request('/students');assert.equal(roster.status,200,await roster.clone().text());const text=await roster.text();assert.ok(text.includes(students[0].name));assert.ok(!text.includes(students[1].name));assert.ok(!text.includes(students[2].name));assert.ok(!text.includes('private-student-password'));
 const grouped=await request('/groups');assert.equal(grouped.status,200,await grouped.clone().text());const groupText=await grouped.text();assert.ok(groupText.includes(groups[0].id));assert.ok(!groupText.includes(groups[1].id));assert.ok(!groupText.includes(groups[2].id));
 const edit=await request('/students/'+students[0].id,'PUT',{notes:'delegated write verified'});assert.equal(edit.status,200,await edit.clone().text());assert.equal(ok(await db.from('students').select('notes').eq('id',students[0].id).single()).notes,'delegated write verified');
 await request('/students/'+students[1].id,'PUT',{notes:'must not change'});assert.notEqual(ok(await db.from('students').select('notes').eq('id',students[1].id).single()).notes,'must not change');
 for(const path of ['/admin/overview','/auth/refresh','/whatsapp/test','/settings/security-pin','/assistants/invitations']){
  const response=await request(path,path==='/admin/overview'?'GET':'POST',path==='/admin/overview'?undefined:{});assert.equal(response.status,403,path+' '+await response.text());
 }
 const newSession=await request('/sessions','POST',{group_id:groups[0].id,session_number:1,session_date:'2026-11-02'},'sessions');assert.equal(newSession.status,201,await newSession.clone().text());
 const unauthorizedSession=await request('/sessions','POST',{group_id:groups[1].id,session_number:1,session_date:'2026-11-02'},'sessions');assert.notEqual(unauthorizedSession.status,201);assert.equal(ok(await db.from('sessions').select('id').eq('group_id',groups[1].id)).length,0);
 ok(await db.from('assistant_accounts').update({permissions:{'students.view':true}}).eq('assistant_id',staff.id));
 assert.equal((await request('/students/'+students[0].id,'PUT',{notes:'revoked'})).status,403);
 ok(await db.from('assistants').update({status:'inactive'}).eq('id',staff.id));assert.equal((await request('/context')).status,401);
 for(const table of ['assistant_delegated_students','portal_onboarding_deliveries']){const result=await anonClient.from(table).select('*').limit(1);assert.ok(result.error,table+' must remain private');}
});
