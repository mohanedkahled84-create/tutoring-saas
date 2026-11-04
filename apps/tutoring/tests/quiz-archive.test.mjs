import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {quizzesRouter} from '../dist/features/quizzes/routes.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';

test('published quiz removal uses saved server definition and preserves submission history',async t=>{
 const calls=[];let failure=null;
 const db={rpc:async(name,args)=>{calls.push([name,args]);return failure?{error:failure}:{data:{success:true,archived:true,history_preserved:true}};},from(){throw new Error('Published quiz must not be deleted through a table query');}};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:'verified-owner',tenant_id:'verified-tenant',role:'owner',assistant_id:'verified-helper'};delegatedClientScope.run(db,next);});app.use('/quizzes',quizzesRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const post=body=>fetch(`http://127.0.0.1:${server.address().port}/quizzes/rich`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 for(const action of ['archive_quiz','delete_quiz']){
  const response=await post({action,id:'saved-reference',quiz:{id:'forged-reference',questions:[{correct_index:0}],group_id:'forged-group'}});
  assert.equal(response.status,200);assert.equal((await response.json()).history_preserved,true);
  assert.deepEqual(calls.at(-1),['archive_quiz_definition',{p_tenant:'verified-tenant',p_user:'verified-owner',p_assistant:'verified-helper',p_reference:'saved-reference',p_delete:action==='delete_quiz'}]);
 }
 failure={code:'42501'};assert.equal((await post({action:'archive_quiz',id:'foreign-reference'})).status,403);
});
