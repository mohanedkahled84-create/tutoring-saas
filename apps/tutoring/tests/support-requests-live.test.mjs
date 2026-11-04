import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: support requests belong to their teacher, admins can reply, retries deduplicate and startup progress uses actual records',{timeout:120000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenants=[randomUUID(),randomUUID()],users=[],tokens=[];let server;
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}for(const tenant of tenants)ok(await db.from('tenants').delete().eq('id',tenant));for(const user of users)ok(await db.auth.admin.deleteUser(user.id));});
 ok(await db.from('tenants').insert(tenants.map(id=>({id,name:'isolated support fixture',subscription_status:'active',subscription_tier:'starter'}))));
 for(let i=0;i<3;i++){
  const email=`support-${randomUUID()}@isolated.invalid`,password='isolated-fixture-password-2026';
  const user=ok(await db.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user);
  ok(await db.from('users').upsert({id:user.id,email,tenant_id:i<2?tenants[i]:null,role:i===2?'admin':'owner',full_name:'fixture teacher '+i,subject:'الفيزياء',phone:'201000000000'}));
  tokens.push(ok(await anonClient.auth.signInWithPassword({email,password})).session.access_token);
 }
 const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api`;
 const request=(path,who=0,method='GET',body)=>fetch(base+path,{method,headers:{Authorization:`Bearer ${tokens[who]}`,'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 assert.equal((await fetch(base+'/support')).status,401);
 const id=randomUUID(),body={id,title:'fixture request',category:'account',body:'fixture details'};
 let result=await request('/support',0,'POST',body);assert.equal(result.status,200,await result.clone().text());
 result=await request('/support',0,'POST',body);assert.equal(result.status,200);assert.equal((await result.json()).unchanged,true);
 assert.equal((await (await request('/support')).json()).tickets.length,1);assert.equal((await (await request('/support',1)).json()).tickets.length,0);assert.equal((await request('/support/'+id,1)).status,404);
 assert.equal((await request('/support',0,'POST',{...body,id:randomUUID(),tenant_id:tenants[1]})).status,400);
 const adminList=await (await request('/support',2)).json();assert.ok(adminList.tickets.some(row=>row.id===id && row.teacher_phone==='201000000000'));
 const reply={request_id:randomUUID(),body:'fixture admin answer'};
 assert.equal((await request('/support/'+id+'/reply',2,'POST',reply)).status,200);assert.equal((await request('/support/'+id+'/reply',2,'POST',reply)).status,200);
 const thread=await (await request('/support/'+id)).json();assert.equal(thread.replies.length,1);assert.equal(thread.replies[0].body,reply.body);assert.equal(thread.replies[0].author_role,'admin');assert.equal(thread.ticket.status,'waiting_user');
 assert.equal((await request('/support/'+id+'/status',0,'POST',{status:'resolved'})).status,403);assert.equal((await request('/support/'+id+'/status',2,'POST',{status:'resolved'})).status,200);
 const progress=await (await request('/settings/startup-progress')).json();assert.equal(progress.steps.find(s=>s.id==='group').done,false);
 ok(await db.from('groups').insert({tenant_id:tenants[0],name:'fixture group'}));
 assert.equal((await (await request('/settings/startup-progress')).json()).steps.find(s=>s.id==='group').done,true);
 assert.equal((await (await request('/settings/startup-progress',1)).json()).steps.find(s=>s.id==='group').done,false);
 assert.equal(progress.steps.find(s=>s.id==='links').done,false);assert.equal(progress.steps.some(s=>s.id==='platform'),false);
 const group=ok(await db.from('groups').select('id').eq('tenant_id',tenants[0]).single());
 ok(await db.from('students').insert({tenant_id:tenants[0],group_id:group.id,name:'fixture credentials',student_code:randomUUID().slice(0,8),parent_phone:'201000000001',portal_password:'isolated-fixture-only'}));
 assert.equal((await (await request('/settings/startup-progress')).json()).steps.find(s=>s.id==='links').done,true);
 ok(await db.from('tenants').update({subscription_tier:'pro',subscription_status:'active'}).eq('id',tenants[0]));
 const entitled=await (await request('/settings/startup-progress')).json();assert.equal(entitled.steps.find(s=>s.id==='platform').done,false);

 assert.ok((await anonClient.rpc('support_operation',{p_user:users[0].id,p_action:'list',p_data:{}})).error);
});
