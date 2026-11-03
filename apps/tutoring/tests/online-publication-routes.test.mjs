import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {quizzesRouter} from '../dist/features/quizzes/routes.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
test('online publication is one private transaction and cannot fall back into manual quiz tables',async t=>{
 const calls=[];let failure=null;const id='10000000-0000-4000-8000-000000000001';
 const db={rpc:async(name,args)=>{calls.push([name,args]);return failure?{error:failure}:{data:{success:true,quizzes:args.p_data.targets}};},from(){throw Error('Online publication cannot write manual quiz tables');}};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:'trusted-owner',tenant_id:'trusted-tenant',assistant_id:'trusted-helper',role:'owner'};delegatedClientScope.run(db,next);});app.use('/quizzes',quizzesRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const post=(path,body)=>fetch(`http://127.0.0.1:${server.address().port}/quizzes/`+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const definition={title:'saved exam',quiz_number:1,questions:[{id:'q',choices:['A','B'],correct_index:0}]},targets=[{id,group_id:id}];
 assert.equal((await post('publish-online',{definition,targets})).status,200);assert.equal(calls[0][0],'publish_online_quiz');assert.equal(calls[0][1].p_tenant,'trusted-tenant');assert.equal(calls[0][1].p_user,'trusted-owner');assert.equal(calls[0][1].p_assistant,'trusted-helper');
 assert.equal((await post('rich',{...definition,id,group_id:id,exam_mode:'online'})).status,200);assert.deepEqual(calls[1][1].p_data,{definition,targets});
 assert.equal((await post('publish-online',{definition,targets:[],tenant_id:'forged'})).status,400);assert.equal(calls.length,2);
 failure={code:'23514',message:'QUIZ_HAS_ATTEMPTS_COPY_INSTEAD'};assert.equal((await post('publish-online',{definition,targets})).status,409);
});
