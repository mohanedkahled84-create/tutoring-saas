import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {gradeQuizEssay} from '../dist/features/quizzes/essayGrade.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
test('essay grading uses verified actor and one private transaction, ignoring client student/group aliases',async t=>{
 const calls=[];let failure=null;
 const db={rpc:async(name,args)=>{calls.push([name,args]);return failure?{error:failure}:{data:{success:true,final_score:4}};},from(){throw Error('No partial grade writes');}};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:'trusted-owner',tenant_id:'trusted-tenant',role:'owner',assistant_id:'trusted-assistant'};delegatedClientScope.run(db,next);});app.post('/grade',gradeQuizEssay);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const post=body=>fetch(`http://127.0.0.1:${server.address().port}/grade`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const body={submission_id:'10000000-0000-4000-8000-000000000001',essay_scores:{q:2},student_id:'forged-student',group_id:'forged-group',quiz_number:999};
 const response=await post(body);assert.equal(response.status,200);assert.match(response.headers.get('Cache-Control'),/no-store/);
 assert.equal(calls[0][0],'grade_portal_quiz_essay');assert.deepEqual(calls[0][1],{p_tenant:'trusted-tenant',p_user:'trusted-owner',p_assistant:'trusted-assistant',p_submission:body.submission_id,p_scores:{q:2},p_note:'',p_final:null,p_max:null});
 assert.equal((await post({...body,essay_scores:{q:-1}})).status,400);assert.equal(calls.length,1);
 failure={code:'23514',message:'INVALID_GRADE'};assert.equal((await post(body)).status,409);
 failure={code:'42501',message:'FORBIDDEN'};assert.equal((await post(body)).status,403);
 failure={code:'08006',message:'connection lost'};assert.equal((await post(body)).status,503);
});
