import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createClient } from '@supabase/supabase-js';
import { requireIsolatedSupabaseProject, createIsolatedSupabaseClients, assertServiceRoleReady } from './helpers/live-supabase.mjs';

test('LIVE: actual authenticated HTTP requests preserve tenant isolation with service-role enabled', async t => {
  if (!requireIsolatedSupabaseProject(t)) return;
  assert.equal(process.env.SUPABASE_URL,process.env.SUPABASE_TEST_URL,'Backend must target the test project');
  assert.equal(process.env.SUPABASE_SERVICE_ROLE_KEY,process.env.SUPABASE_TEST_SERVICE_ROLE_KEY,'Exercise the real privileged-client configuration');
  const {serviceClient} = createIsolatedSupabaseClients();
  await assertServiceRoleReady(serviceClient);
  const tenantIds=[randomUUID(),randomUUID()]; const students=[]; const authIds=[];
  t.after(async()=>{
    for (const tenantId of tenantIds) {
      const removed=await serviceClient.from('students').delete().eq('tenant_id',tenantId); assert.equal(removed.error,null);
      const users=await serviceClient.from('users').delete().eq('tenant_id',tenantId); assert.equal(users.error,null);
    }
    for(const id of authIds) {const removed=await serviceClient.auth.admin.deleteUser(id);assert.equal(removed.error,null);}
    const tenants=await serviceClient.from('tenants').delete().in('id',tenantIds);assert.equal(tenants.error,null);
  });
  const tenants=await serviceClient.from('tenants').insert(tenantIds.map((id,i)=>({id,name:`isolated-audit-${i}`,subscription_status:'active'})));
  assert.equal(tenants.error,null);
  let tokenA;
  for(const [i,tenantId] of tenantIds.entries()) {
    const email=`audit-${randomUUID()}@example.invalid`;const password=`Audit!${randomUUID()}aA9`;
    const created=await serviceClient.auth.admin.createUser({email,password,email_confirm:true});
    assert.equal(created.error,null);const id=created.data.user.id;authIds.push(id);
    const profile=await serviceClient.from('users').upsert({id,email,role:'owner',tenant_id:tenantId});assert.equal(profile.error,null);
    const student=await serviceClient.from('students').insert({tenant_id:tenantId,name:`isolated-student-${i}`,parent_phone:'01000000000',code:'1001',student_code:'1001'}).select('id,name').single();
    assert.equal(student.error,null);students.push(student.data);
    if(i===0) {
      const auth=createClient(process.env.SUPABASE_TEST_URL,process.env.SUPABASE_TEST_ANON_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
      const login=await auth.auth.signInWithPassword({email,password});assert.equal(login.error,null);tokenA=login.data.session.access_token;
    }
  }
  const {createApp}=await import('../dist/app.js');
  const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const base=`http://127.0.0.1:${server.address().port}/api/students`;
  const headers={Authorization:`Bearer ${tokenA}`,'Content-Type':'application/json'};
  const own=await fetch(`${base}/${students[0].id}`,{headers});assert.equal(own.status,200);
  assert.equal((await own.json()).student.tenant_id,tenantIds[0]);
  for(const suffix of ['', '/parent-link']) {
    const denied=await fetch(`${base}/${students[1].id}${suffix}`,{headers});assert.equal(denied.status,404);
  }
  const update=await fetch(`${base}/${students[1].id}`,{method:'PUT',headers,body:JSON.stringify({name:'must-not-change'})});assert.equal(update.status,404);
  const notify=await fetch(`${base}/${students[1].id}/notify-score`,{method:'POST',headers,body:JSON.stringify({score:1,max_score:10})});assert.equal(notify.status,404);
  const remove=await fetch(`${base}/${students[1].id}`,{method:'DELETE',headers});assert.equal(remove.status,404);
  const untouched=await serviceClient.from('students').select('name,tenant_id').eq('id',students[1].id).single();assert.equal(untouched.error,null);assert.equal(untouched.data.name,students[1].name);
  const allowed=await fetch(`${base}/${students[0].id}`,{method:'PUT',headers,body:JSON.stringify({name:'authorized-update'})});assert.equal(allowed.status,200);assert.equal((await allowed.json()).student.name,'authorized-update');
});
