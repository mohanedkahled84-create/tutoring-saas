import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';
test('LIVE: student quiz submission cannot fabricate definitions, mark another group or overwrite the first result',{timeout:90000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID();let server;const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}ok(await db.from('homework_submissions').delete().eq('tenant_id',tenant));ok(await db.from('study_materials').delete().eq('tenant_id',tenant));ok(await db.from('tenants').delete().eq('id',tenant));});
 ok(await db.from('tenants').insert({id:tenant,name:'isolated verified quiz'}));const groups=ok(await db.from('groups').insert([{tenant_id:tenant,name:'own group'},{tenant_id:tenant,name:'outside group'}]).select());
 const student=ok(await db.from('students').insert({tenant_id:tenant,group_id:groups[0].id,name:'fixture learner',parent_phone:'201000000000'}).select().single());
 const materials=ok(await db.from('study_materials').insert(groups.map((g,i)=>({tenant_id:tenant,group_id:g.id,title:'trusted quiz '+i,type:'online_quiz',questions:JSON.stringify({quiz_number:i+1,questions:[{id:'q1',type:'mcq',points:3,options:['A','B'],correct_index:1}]})}))).select());
 const {generateParentPortalToken}=await import('../dist/shared/utils/tokens.js'),token=generateParentPortalToken(student.id,tenant),{createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 const submit=body=>fetch(`http://127.0.0.1:${server.address().port}/api/public/quizzes/submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...body})});
 const first=await submit({material_id:materials[0].id,answers:{q1:0},questions:[{id:'q1',correct_index:0,points:100}],group_id:groups[1].id,quiz_number:999});assert.equal(first.status,200,await first.clone().text());assert.equal((await first.json()).score,0);
 const repeated=await Promise.all(Array.from({length:4},()=>submit({material_id:materials[0].id,answers:{q1:1}})));for(const response of repeated){assert.equal(response.status,200,await response.clone().text());const saved=await response.json();assert.equal(saved.already_submitted,true);assert.equal(saved.score,0);}
 assert.equal((await submit({material_id:materials[1].id,answers:{q1:1}})).status,403);assert.equal((await submit({material_id:'quiz-online-client-invented',questions:[{id:'q1',correct_index:0}],answers:{q1:0}})).status,404);
 assert.equal(ok(await db.from('homework_submissions').select('id').eq('tenant_id',tenant)).length,1);assert.equal(ok(await db.from('quiz_scores').select('score').eq('tenant_id',tenant))[0].score,0);
 assert.ok((await anonClient.rpc('submit_portal_quiz_verified',{p_student:student.id,p_tenant:tenant,p_reference:materials[0].id,p_answers:{q1:1}})).error);
});
