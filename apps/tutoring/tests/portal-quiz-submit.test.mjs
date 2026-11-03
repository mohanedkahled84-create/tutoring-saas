import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {registerPortalQuizSubmission} from '../dist/shared/routes/portalQuizSubmit.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
test('public quiz HTTP trusts verified student identity and the marking RPC, ignoring fabricated client questions, groups and scores',async t=>{
 const calls=[];let failure=null;
 const db={rpc:async(name,args)=>{calls.push([name,args]);if(name==='portal_student_context')return {data:{id:'verified-student',tenant_id:'verified-tenant'}};assert.equal(name,'submit_portal_quiz_verified');return failure?{error:failure}:{data:{success:true,is_graded:true,score:0,max_score:3}};}};
 const app=express();app.use(express.json());app.use((_req,_res,next)=>delegatedClientScope.run(db,next));registerPortalQuizSubmission(app);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const submit=body=>fetch(`http://127.0.0.1:${server.address().port}/quizzes/submit`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const response=await submit({token:'legacy-fixture-session-token',material_id:'saved-reference',answers:{q1:0},questions:[{id:'q1',correct_index:0,points:999}],group_id:'forged-group',student_id:'forged-student',tenant_id:'forged-tenant',score:999,quiz_number:999});
 assert.equal(response.status,200);assert.equal((await response.json()).score,0);
 const args=calls.find(([name])=>name==='submit_portal_quiz_verified')[1];assert.equal(args.p_student,'verified-student');assert.equal(args.p_tenant,'verified-tenant');assert.deepEqual(Object.keys(args).sort(),['p_student','p_tenant','p_reference','p_answers','p_elapsed','p_withdrawn','p_reason'].sort());
 const before=calls.length;assert.equal((await submit({token:'legacy-fixture-session-token',material_id:'saved',answers:{q1:{correct:0}}})).status,400);assert.equal(calls.length,before);
 failure={code:'P0002',message:'QUIZ_NOT_FOUND'};assert.equal((await submit({token:'legacy-fixture-session-token',material_id:'fabricated',answers:{q1:0}})).status,404);
});
