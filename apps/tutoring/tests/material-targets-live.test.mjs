import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: multiple material groups enforce portal visibility, cross-tenant rejection and one submission per student',{timeout:120000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID(),foreign=randomUUID();
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{for(const id of [tenant,foreign]){ok(await db.from('homework_submissions').delete().eq('tenant_id',id));ok(await db.from('study_materials').delete().eq('tenant_id',id));ok(await db.from('tenants').delete().eq('id',id));}});
 ok(await db.from('tenants').insert([{id:tenant,name:'isolated target teacher'},{id:foreign,name:'isolated foreign teacher'}]));
 const groups=ok(await db.from('groups').insert([{tenant_id:tenant,name:'A'},{tenant_id:tenant,name:'B'},{tenant_id:tenant,name:'C'},{tenant_id:foreign,name:'foreign'}]).select());
 const students=ok(await db.from('students').insert(groups.map(g=>({tenant_id:g.tenant_id,name:'isolated '+g.name,parent_phone:'201000000000',group_id:g.id,parent_portal_token:randomUUID()}))).select());
 ok(await db.from('group_students').insert({tenant_id:tenant,student_id:students[0].id,group_id:groups[1].id}));
 const material=ok(await db.from('study_materials').insert({tenant_id:tenant,title:'shared assignment',type:'pdf',is_homework:true,group_ids:[groups[0].id,groups[1].id]}).select().single());
 for(const student of students){
  const allowed=ok(await db.rpc('homework_target_allowed',{p_student:student.id,p_tenant:student.tenant_id,p_material:material.id}));
  assert.equal(allowed,[students[0].id,students[1].id].includes(student.id));
  const portal=ok(await db.rpc('get_parent_portal_payload',{p_token:student.parent_portal_token}));
  assert.equal(portal.materials.filter(m=>m.id===material.id).length,allowed?1:0);
 }
 for(const ids of [[],[groups[3].id]])assert.ok((await db.from('study_materials').insert({tenant_id:tenant,title:'invalid scope',type:'pdf',is_homework:true,group_ids:ids})).error);
 const args={p_student:students[0].id,p_tenant:tenant,p_material:material.id,p_file_url:`${tenant}/${material.id}/${students[0].id}_fixture.pdf`,p_file_name:'fixture.pdf',p_file_size:1};
 const first=ok(await db.rpc('submit_verified_homework',args)),again=ok(await db.rpc('submit_verified_homework',args));
 assert.equal(first.id,again.id);assert.equal(ok(await db.from('homework_submissions').select('id').eq('material_id',material.id)).length,1);
 assert.ok((await db.rpc('submit_verified_homework',{...args,p_student:students[2].id,p_file_url:`${tenant}/${material.id}/${students[2].id}_fixture.pdf`})).error);
 assert.ok((await db.from('study_materials').update({group_ids:[groups[2].id]}).eq('id',material.id)).error,'assignment removal must not revoke submitted work');
 assert.ok((await anonClient.rpc('homework_target_allowed',{p_student:students[0].id,p_tenant:tenant,p_material:material.id})).error);
 assert.ok((await anonClient.rpc('submit_verified_homework',args)).error);
});
