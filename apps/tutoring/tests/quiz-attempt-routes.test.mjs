import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerPortalQuizSubmission} from '../dist/shared/routes/portalQuizSubmit.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
test('quiz start releases only student question fields; progress uses verified identity and rejects malformed revisions',async t=>{
 const calls=[];const attempt='10000000-0000-4000-8000-000000000001';
 const db={rpc:async(name,args)=>{calls.push([name,args]);if(name==='portal_student_context')return {data:{id:'verified-student',tenant_id:'verified-tenant'}};if(name==='portal_quiz_start')return {data:{attempt_id:attempt,definition:{quiz_number:1,stealth_models:{secret:'MARKING_KEY'},questions:[{id:'q',text:'A?',options:['A','B'],correct_index:1,model_answer:'MARKING_KEY',explanation:'MARKING_KEY',private:'MARKING_KEY'}]}}};return {data:{revision:1}};}};
 const app=express();app.use(express.json());app.use((_req,_res,next)=>delegatedClientScope.run(db,next));registerPortalQuizSubmission(app);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const post=(path,body)=>fetch(`http://127.0.0.1:${server.address().port}/quizzes/`+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const start=await post('start',{token:'verified-session-fixture',material_id:'saved-model'});assert.equal(start.status,200);const body=await start.json();assert.equal(body.definition.questions[0].text,'A?');assert.ok(!JSON.stringify(body).includes('MARKING_KEY'));assert.equal(body.definition.questions[0].correct_index,undefined);
 const save=await post('save',{token:'verified-session-fixture',attempt_id:attempt,answers:{q:0},revision:0});assert.equal(save.status,200);assert.deepEqual(calls.at(-1),['portal_quiz_save',{p_student:'verified-student',p_tenant:'verified-tenant',p_attempt:attempt,p_answers:{q:0},p_revision:0}]);
 const before=calls.length;assert.equal((await post('save',{token:'verified-session-fixture',attempt_id:attempt,answers:{q:0},revision:-1})).status,400);assert.equal(calls.length,before);
 assert.equal((await post('start',{token:'verified-session-fixture',material_id:'saved-model',questions:[{correct_index:0}]})).status,400);
});
