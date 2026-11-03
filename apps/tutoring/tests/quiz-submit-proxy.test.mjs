import test from 'node:test';
import assert from 'node:assert/strict';
import handler from '../../../api/quizzes/submit.js';
import rich from '../../../api/quizzes/rich.js';
import submissions from '../../../api/quizzes/submissions.js';
test('legacy quiz serverless endpoint forwards to verified grading and never invents a successful fallback',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);
 const response=()=>({headers:{},setHeader(k,v){this.headers[k]=v;},status(code){this.statusCode=code;return this;},json(value){this.body=value;return this;},end(){return this;}});
 const body={token:'fixture-session',material_id:'fixture-quiz',answers:{q1:0}};let calls=0;
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(url,'https://tutoring-backend-production-c8dd.up.railway.app/api/public/quizzes/submit');assert.deepEqual(JSON.parse(options.body),body);return Response.json({error:{message:'غير متاح للمجموعة'}},{status:403});};
 let res=response();await handler({method:'POST',body},res);assert.equal(res.statusCode,403);assert.equal(res.body.success,undefined);assert.equal(calls,1);
 globalThis.fetch=async()=>{throw Error('fixture offline');};res=response();await handler({method:'POST',body},res);assert.equal(res.statusCode,503);assert.equal(res.body.success,undefined);
 globalThis.fetch=async()=>Response.json({success:true,score:0,max_score:3});res=response();await handler({method:'POST',body},res);assert.equal(res.statusCode,200);assert.equal(res.body.score,0);
});
test('legacy teacher endpoints require Bearer authentication and forward permissions and failures to the backend',async t=>{
 const original=globalThis.fetch;t.after(()=>globalThis.fetch=original);let calls=0;
 const response=()=>({setHeader(){},status(code){this.statusCode=code;return this;},json(data){this.body=data;return this;},end(){return this;}});
 globalThis.fetch=async(url,options)=>{calls++;assert.equal(options.headers.Authorization,'Bearer fixture-owner');assert.equal(options.redirect,'error');assert.ok(url.includes('/api/quizzes/'));return Response.json({error:{message:'outside scope'}},{status:403});};
 for(const handler of [rich,submissions]){
  let res=response();await handler({method:'GET',url:'/?group_id=fixture',headers:{}},res);assert.equal(res.statusCode,401);assert.equal(calls,0);
 }
 let res=response();await rich({method:'GET',url:'/?group_id=fixture',headers:{authorization:'Bearer fixture-owner'}},res);assert.equal(res.statusCode,403);assert.equal(calls,1);
 res=response();await submissions({method:'POST',url:'/',headers:{authorization:'Bearer fixture-owner'},body:{submission_id:'fixture',essay_score:2}},res);assert.equal(res.statusCode,403);assert.equal(calls,2);
 globalThis.fetch=async()=>{throw Error('offline');};res=response();await rich({method:'POST',url:'/',headers:{authorization:'Bearer fixture-owner'},body:{title:'fixture'}},res);assert.equal(res.statusCode,503);assert.equal(res.body.success,undefined);
});
