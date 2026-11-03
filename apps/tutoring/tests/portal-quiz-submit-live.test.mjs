import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';
test('LIVE: student quiz submission cannot fabricate definitions, mark another group or overwrite the first result',{timeout:90000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID();let server;const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}ok(await db.from('homework_submissions').delete().eq('tenant_id',tenant));ok(await db.from('portal_quiz_attempts').delete().eq('tenant_id',tenant));ok(await db.from('study_materials').delete().eq('tenant_id',tenant));ok(await db.from('tenants').delete().eq('id',tenant));});
 ok(await db.from('tenants').insert({id:tenant,name:'isolated verified quiz'}));const groups=ok(await db.from('groups').insert([{tenant_id:tenant,name:'own group'},{tenant_id:tenant,name:'outside group'}]).select());
 const student=ok(await db.from('students').insert({tenant_id:tenant,group_id:groups[0].id,name:'fixture learner',parent_phone:'201000000000'}).select().single());
 const materials=ok(await db.from('study_materials').insert(groups.map((g,i)=>({tenant_id:tenant,group_id:g.id,title:'trusted quiz '+i,type:'online_quiz',questions:JSON.stringify({quiz_number:i+1,questions:[{id:'q1',type:'mcq',points:3,options:['A','B'],correct_index:1}]})}))).select());
 const {generateParentPortalToken}=await import('../dist/shared/utils/tokens.js'),token=generateParentPortalToken(student.id,tenant),{createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 const submit=body=>fetch(`http://127.0.0.1:${server.address().port}/api/public/quizzes/submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,...body})});
 const start=await fetch(`http://127.0.0.1:${server.address().port}/api/public/quizzes/start`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token,material_id:materials[0].id})});assert.equal(start.status,200,await start.clone().text());const attempt=await start.json();assert.equal(attempt.definition.questions[0].correct_index,undefined);assert.equal(attempt.definition.questions[0].id,'q1');
 const progressBody={token,attempt_id:attempt.attempt_id,answers:{q1:0},revision:0};
 const save=()=>fetch(`http://127.0.0.1:${server.address().port}/api/public/quizzes/save`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(progressBody)});
 for(let i=0;i<2;i++){const saved=await save();assert.equal(saved.status,200,await saved.clone().text());assert.equal((await saved.json()).revision,1);}
 const resumed=ok(await db.rpc('portal_quiz_start',{p_student:student.id,p_tenant:tenant,p_reference:materials[0].id}));assert.equal(resumed.expires_at,attempt.expires_at);assert.deepEqual(resumed.answers,{q1:0});
 const first=await submit({material_id:materials[0].id,answers:{q1:0},questions:[{id:'q1',correct_index:0,points:100}],group_id:groups[1].id,quiz_number:999});assert.equal(first.status,200,await first.clone().text());assert.equal((await first.json()).score,0);
 const repeated=await Promise.all(Array.from({length:4},()=>submit({material_id:materials[0].id,answers:{q1:1}})));for(const response of repeated){assert.equal(response.status,200,await response.clone().text());const saved=await response.json();assert.equal(saved.already_submitted,true);assert.equal(saved.score,0);}
 assert.equal((await submit({material_id:materials[1].id,answers:{q1:1}})).status,409);assert.equal((await submit({material_id:'quiz-online-client-invented',questions:[{id:'q1',correct_index:0}],answers:{q1:0}})).status,409);
 assert.equal(ok(await db.from('homework_submissions').select('id').eq('tenant_id',tenant)).length,1);assert.equal(ok(await db.from('quiz_scores').select('score').eq('tenant_id',tenant))[0].score,0);
 const second=ok(await db.from('students').insert({tenant_id:tenant,group_id:groups[0].id,name:'closed browser learner',parent_phone:'201000000003'}).select().single());
 const closed=ok(await db.rpc('portal_quiz_start',{p_student:second.id,p_tenant:tenant,p_reference:materials[0].id}));
 ok(await db.rpc('portal_quiz_save',{p_student:second.id,p_tenant:tenant,p_attempt:closed.attempt_id,p_answers:{q1:1},p_revision:0}));
 const edited=await db.from('study_materials').update({questions:JSON.stringify({quiz_number:1,questions:[{id:'q1',points:999,options:['A','B'],correct_index:0}]})}).eq('id',materials[0].id);assert.equal(edited.error?.code,'23514');
 ok(await db.from('portal_quiz_attempts').update({started_at:new Date(Date.now()-120000).toISOString(),expires_at:new Date(Date.now()-60000).toISOString()}).eq('id',closed.attempt_id));
 ok(await db.from('groups').update({archived_at:new Date().toISOString()}).eq('id',groups[0].id));
 assert.ok(ok(await db.rpc('portal_quiz_finalize_expired',{p_limit:50}))>=1);
 assert.equal(ok(await db.from('quiz_scores').select('score').eq('tenant_id',tenant).eq('student_id',second.id))[0].score,3);
 assert.ok((await anonClient.from('portal_quiz_attempts').select('*')).error);
 assert.ok((await anonClient.rpc('submit_portal_quiz_verified',{p_student:student.id,p_tenant:tenant,p_reference:materials[0].id,p_answers:{q1:1}})).error);
});
