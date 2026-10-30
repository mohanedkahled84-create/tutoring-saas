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
  const materialIds=[]; const privatePaths=[];
  t.after(async()=>{
    if(privatePaths.length) {const removed=await serviceClient.storage.from('homework-private').remove(privatePaths);assert.equal(removed.error,null);}
    if(materialIds.length) {const removed=await serviceClient.from('study_materials').delete().in('id',materialIds);assert.equal(removed.error,null);}
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

  // Exercise the real upload -> database -> teacher read -> student portal
  // contract, including the legacy RPC payload that omits student.tenant_id.
  const {generateParentPortalToken}=await import('../dist/shared/utils/tokens.js');
  const portalToken=generateParentPortalToken(students[0].id,tenantIds[0]);
  const portalProfile=await serviceClient.from('students').update({parent_portal_token:portalToken}).eq('id',students[0].id);assert.equal(portalProfile.error,null);
  const material=await serviceClient.from('study_materials').insert({tenant_id:tenantIds[0],title:'isolated homework',type:'pdf',is_homework:true}).select('id').single();assert.equal(material.error,null);materialIds.push(material.data.id);
  const bytes=Buffer.from('%PDF-1.4\n%isolated-homework\n%%EOF');
  const submitUrl=base.replace('/api/students','/api/public/homework/submit');
  const submit=await fetch(submitUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:portalToken,material_id:material.data.id,file_name:'audit.pdf',file_data:`data:application/pdf;base64,${bytes.toString('base64')}`})});
  const submitted=await submit.json();assert.equal(submit.status,200,JSON.stringify(submitted.error));
  const persisted=await serviceClient.from('homework_submissions').select('id,file_url').eq('material_id',material.data.id).eq('student_id',students[0].id).single();assert.equal(persisted.error,null);privatePaths.push(persisted.data.file_url);
  assert.ok(!persisted.data.file_url.startsWith('http'),'Persist a durable path rather than a public or expiring URL');
  const teacherRead=await fetch(base.replace('/api/students',`/api/homework/submissions?material_id=${material.data.id}`),{headers});
  assert.equal(teacherRead.status,200);const teacherPayload=await teacherRead.json();
  assert.match(teacherPayload.submitted[0].file_url,/\/object\/sign\/homework-private\//);
  const teacherFile=await fetch(teacherPayload.submitted[0].file_url);assert.equal(teacherFile.status,200);assert.deepEqual(Buffer.from(await teacherFile.arrayBuffer()),bytes);
  const portal=await fetch(base.replace('/api/students',`/api/public/parent-portal?token=${encodeURIComponent(portalToken)}`));
  assert.equal(portal.status,200);const payload=await portal.json();
  const portalMaterial=payload.materials.find(item=>item.id===material.data.id);assert.ok(portalMaterial);
  assert.match(portalMaterial.submission_url,/\/object\/sign\/homework-private\//);
  const portalFile=await fetch(portalMaterial.submission_url);assert.equal(portalFile.status,200);assert.deepEqual(Buffer.from(await portalFile.arrayBuffer()),bytes);
  const invalid=await fetch(submitUrl,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:portalToken,material_id:material.data.id,file_name:'bad.pdf',file_data:`data:application/pdf;base64,${Buffer.from('not a PDF').toString('base64')}`})});assert.equal(invalid.status,400);
  const afterInvalid=await serviceClient.from('homework_submissions').select('file_url').eq('id',persisted.data.id).single();assert.equal(afterInvalid.error,null);assert.equal(afterInvalid.data.file_url,persisted.data.file_url);
  const retained=await serviceClient.storage.from('homework-private').download(persisted.data.file_url);assert.equal(retained.error,null);assert.deepEqual(Buffer.from(await retained.data.arrayBuffer()),bytes);
});
