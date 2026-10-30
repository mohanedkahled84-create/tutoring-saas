import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {createClient} from '@supabase/supabase-js';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: profile permissions, self-only helpers and current admin/assistant/portal roles', {timeout:180000}, async t=>{
  if(!requireIsolatedSupabaseProject(t))return;
  const {serviceClient:admin,anonClient}=createIsolatedSupabaseClients();
  const tenant=randomUUID(),otherTenant=randomUUID(),users=[];let server;
  const ok=r=>{assert.equal(r.error,null);return r.data;};
  t.after(async()=>{
    try {
      for(const id of [tenant,otherTenant])ok(await admin.from('students').delete().eq('tenant_id',id));
      for(const id of users){ok(await admin.from('users').delete().eq('id',id));ok(await admin.auth.admin.deleteUser(id));}
      ok(await admin.from('tenants').delete().in('id',[tenant,otherTenant]));
    } finally {if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}
  });
  ok(await admin.from('tenants').insert([{id:tenant,name:'isolated-profile-permissions',subscription_status:'active'},
    {id:otherTenant,name:'isolated-profile-other',subscription_status:'active'}]));
  const clients=[];const tokens=[];
  for(const role of ['owner','admin','assistant']) {
    const email=`profile-audit-${randomUUID()}@example.invalid`,password=`Audit!${randomUUID()}aA9`;
    const created=ok(await admin.auth.admin.createUser({email,password,email_confirm:true,user_metadata:{role:'admin',is_superadmin:true}}));
    users.push(created.user.id);
    ok(await admin.from('users').upsert({id:created.user.id,email,tenant_id:tenant,role,financial_pin_hash:role==='admin'?'test-only-opaque-hash':null}));
    const client=createClient(process.env.SUPABASE_TEST_URL,process.env.SUPABASE_TEST_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
    const session=ok(await client.auth.signInWithPassword({email,password})).session;
    clients.push(client);tokens.push(session.access_token);
  }
  const owner=clients[0];
  for(const change of [{role:'admin'},{tenant_id:otherTenant},{teacher_id:randomUUID()},
    {assistant_id:randomUUID()},{financial_pin_hash:'forged'},{failed_pin_attempts:0},{pin_locked_until:null}]) {
    const denied=await owner.from('users').update(change).eq('id',users[0]);
    assert.equal(denied.error?.code,'42501',`Restricted profile field: ${Object.keys(change)[0]}`);
  }
  assert.equal(ok(await admin.from('users').select('role,tenant_id').eq('id',users[0]).single()).role,'owner');
  const updated=ok(await owner.from('users').update({full_name:'Allowed profile edit',phone:'01000000000',subject:'Math'}).eq('id',users[0]).select('id,full_name').single());
  assert.equal(updated.full_name,'Allowed profile edit');
  assert.equal((await owner.from('users').select('financial_pin_hash').eq('id',users[1])).error?.code,'42501');
  const own=ok(await owner.rpc('get_user_profile',{p_user_id:users[0]}));assert.equal(own.has_security_pin,false);assert.ok(!('financial_pin_hash' in own));
  assert.equal((await owner.rpc('get_user_profile',{p_user_id:users[1]})).error?.code,'42501');
  const adminProfile=ok(await clients[1].rpc('get_user_profile',{p_user_id:users[1]}));assert.equal(adminProfile.has_security_pin,true);assert.ok(!('financial_pin_hash' in adminProfile));
  assert.equal(ok(await owner.rpc('get_current_user_tenant_id')),tenant);
  assert.equal(ok(await owner.rpc('get_current_user_role')),'owner');
  assert.equal(ok(await owner.rpc('get_current_user_teacher_id')),null);
  assert.equal((await anonClient.rpc('is_admin')).error?.code,'42501');
  assert.equal((await anonClient.rpc('get_user_profile',{p_user_id:users[0]})).error?.code,'42501');
  assert.equal(ok(await owner.rpc('is_admin')),false);
  assert.equal(ok(await clients[1].rpc('is_admin')),true);
  assert.equal(ok(await clients[2].rpc('can_current_user_view_financials')),false);
  // The default/global queue must not become visible to arbitrary tenants.
  const queueId=randomUUID();
  const portalCode=String(Date.now()),portalPassword='839162';
  const parentPhone='010'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'),studentPhone='011'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');
  const student=ok(await admin.from('students').insert({tenant_id:otherTenant,name:'isolated-profile-queue-student',parent_phone:parentPhone,student_phone:studentPhone,code:portalCode,student_code:portalCode,portal_password:portalPassword}).select('id').single());
  ok(await admin.from('meta_portal_dispatch_queue').insert({id:queueId,tenant_id:'default',student_id:student.id,recipient_type:'parent',recipient_phone:'201000000000',template_name:'audit-test',language_code:'ar',parameters:[],scheduled_date:new Date().toISOString().slice(0,10),status:'pending'}));
  try {assert.equal(ok(await owner.from('meta_portal_dispatch_queue').select('id').eq('id',queueId)).length,0);}
  finally {ok(await admin.from('meta_portal_dispatch_queue').delete().eq('id',queueId));}
  const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
  const base=`http://127.0.0.1:${server.address().port}`;
  for(const [i,role] of ['owner','admin','assistant'].entries()) {
    const response=await fetch(base+'/api/admin/tenants',{headers:{Authorization:`Bearer ${tokens[i]}`}});
    assert.equal(response.status,role==='admin'?200:403);
    const profile=await fetch(base+'/api/auth/me',{headers:{Authorization:`Bearer ${tokens[i]}`}});assert.equal(profile.status,200);
    assert.equal((await profile.json()).user.role,role);
  }
  const deniedFinancial=await fetch(base+'/api/sessions/actual-earnings',{headers:{Authorization:`Bearer ${tokens[2]}`}});assert.equal(deniedFinancial.status,403);
  let portalToken;
  for(const [role,identifier] of [['student',studentPhone],['parent',parentPhone]]) {
    const login=await fetch(base+'/api/public/portal/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({role,identifier,password:portalPassword})});
    assert.equal(login.status,200);const data=await login.json();assert.equal(data.role,role);assert.equal(data.student.id,student.id);portalToken=data.token;
    const portal=await fetch(base+`/api/public/parent-portal?token=${encodeURIComponent(portalToken)}`);assert.equal(portal.status,200);assert.equal((await portal.json()).student.id,student.id);
  }
  const wrong=await fetch(base+'/api/public/portal/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:portalCode,password:'000000',role:'student'})});assert.equal(wrong.status,401);
  const changed=await fetch(base+'/api/public/portal/change-password',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({student_id:student.id,token:portalToken,old_password:portalPassword,new_password:'945273'})});assert.equal(changed.status,200);
  const relogin=await fetch(base+'/api/public/portal/login',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({identifier:portalCode,password:'945273',role:'student'})});assert.equal(relogin.status,200);
});
