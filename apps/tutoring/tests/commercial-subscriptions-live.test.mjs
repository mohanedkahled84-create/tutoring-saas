import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: server-priced checkout, gifts, independent quotas and concurrent Storage writes',{timeout:150000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID(),fixturePlan='fixture_capacity_'+randomUUID(),users=[],files=[0,1,2].map(n=>tenant+'/commercial-quota-'+n+'.pdf');let server;
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}ok(await db.storage.from('homework-private').remove(files));ok(await db.from('tenants').delete().eq('id',tenant));ok(await db.from('subscription_plans').delete().eq('id',fixturePlan));for(const user of users)ok(await db.auth.admin.deleteUser(user.id));});
 ok(await db.from('tenants').insert({id:tenant,name:'isolated commercial integration'}));
 const tokens=[];
 for(let i=0;i<2;i++){
  const email=`commercial-${randomUUID()}@isolated.invalid`,password='isolated-fixture-password-2026';
  const user=ok(await db.auth.admin.createUser({email,password,email_confirm:true})).user;users.push(user);
  ok(await db.from('users').upsert({id:user.id,email,tenant_id:i===0?tenant:null,role:i===0?'owner':'admin',full_name:'isolated billing fixture'}));
  tokens.push(ok(await anonClient.auth.signInWithPassword({email,password})).session.access_token);
 }
 const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/billing/commercial`,request=(path,body,admin=false)=>fetch(base+path,{method:body===undefined?'GET':'POST',headers:{Authorization:'Bearer '+tokens[admin?1:0],'Content-Type':'application/json'},body:body===undefined?undefined:JSON.stringify(body)});
 let id=randomUUID();assert.equal((await request('/orders',{id,kind:'subscribe',plan_id:'pro_v1',amount_piasters:1})).status,400);
 let response=await request('/orders',{id,kind:'subscribe',plan_id:'pro_v1'});assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).amount_piasters,79900);
 response=await request(`/orders/${id}/submit`,{payment_method:'instapay',reference:'isolated-no-real-transfer'});assert.equal(response.status,200,await response.clone().text());
 assert.equal((await request(`/admin/orders/${id}/approve`,{})).status,403);
 for(let i=0;i<2;i++){response=await request(`/admin/orders/${id}/approve`,{},true);assert.equal(response.status,200,await response.clone().text());}
 let overview=await (await request('/')).json();assert.equal(overview.wallet.gift_piasters,10000);assert.equal(overview.limits.students,300);
 id=randomUUID();response=await request('/orders',{id,kind:'upgrade',plan_id:'max_v1'});assert.equal(response.status,200,await response.clone().text());
 assert.equal((await request(`/orders/${id}/submit`,{payment_method:'vodafone_cash',reference:'isolated-upgrade-no-transfer'})).status,200);
 response=await request(`/admin/orders/${id}/approve`,{},true);assert.equal(response.status,200,await response.clone().text());
 overview=await (await request('/')).json();assert.equal(overview.wallet.gift_piasters,15000);assert.equal(overview.limits.students,500);
 // A disabled fixture-only plan makes quota edges testable without large uploads.
 ok(await db.from('subscription_plans').insert({id:fixturePlan,name:'Isolated capacity boundary',price_piasters:24900,reference_piasters:50000,students:2,storage_bytes:1000,assistants:1,student_piasters:60,teaching_platform:false,rank:1,enabled:false}));
 ok(await db.from('commercial_subscriptions').update({plan_id:fixturePlan}).eq('tenant_id',tenant));
 ok(await db.from('commercial_subscription_periods').update({plan_id:fixturePlan,addons:{}}).eq('tenant_id',tenant));
 const additions=await Promise.all([0,1,2].map(n=>db.from('students').insert({tenant_id:tenant,name:'isolated concurrent '+n,student_code:'quota-'+n,student_phone:'20101111111'+n,parent_phone:'201022222222'}).select()));
 assert.equal(additions.filter(r=>!r.error).length,2);assert.equal(additions.filter(r=>r.error?.message.includes('STUDENT_LIMIT_REACHED')).length,1);
 const student=additions.find(r=>!r.error).data[0];
 const duplicate=await db.from('students').insert({tenant_id:tenant,name:'duplicate normalized phone',student_code:'duplicate',student_phone:'+'+student.student_phone,parent_phone:'201022222222'});
 assert.equal(duplicate.error?.code,'23505');assert.match(duplicate.error.message,/DUPLICATE_STUDENT_PHONE/);
 const assistants=await Promise.all([0,1].map(n=>db.from('assistants').insert({tenant_id:tenant,name:'isolated staff '+n,phone:'20105555555'+n,status:'active'})));
 assert.equal(assistants.filter(r=>!r.error).length,1);assert.equal(assistants.filter(r=>r.error?.message.includes('ASSISTANT_LIMIT_REACHED')).length,1);
 const pdf=Buffer.from('%PDF-1.4\n'+'.'.repeat(380)+'\n%%EOF');
 const uploads=await Promise.all(files.map(file=>db.storage.from('homework-private').upload(file,pdf,{contentType:'application/pdf'})));
 assert.equal(uploads.filter(r=>!r.error).length,2);assert.equal(uploads.filter(r=>r.error).length,1);
 const usage=ok(await db.rpc('commercial_storage_usage',{p_tenant:tenant}));assert.equal(Number(usage),pdf.length*2);assert.ok(Number(usage)<=1000);
 const rows=ok(await db.from('students').select('id').eq('tenant_id',tenant));assert.equal(rows.length,2);
 // No template, provider, real receipt, or external recipient is contacted.
});
