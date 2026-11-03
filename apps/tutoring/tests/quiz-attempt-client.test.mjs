import test from 'node:test';
import assert from 'node:assert/strict';
import {openQuizAttempt} from '../../web/src/utils/quizAttemptClient.js';
test('quiz progress retries an uncertain save unchanged, preserves newer input and uses the server deadline',async()=>{
 const original=Object.getOwnPropertyDescriptor(globalThis,'performance');let clock=0;Object.defineProperty(globalThis,'performance',{value:{now:()=>clock},configurable:true});
 let uncertain=true;const packets=[],statuses=[];
 const transport=async(action,body)=>{
  if(action==='start')return {attempt_id:'attempt',material_id:'canonical',definition:{questions:[{id:'q1',options:['A','B']}]},answers:{},revision:0,server_now:'2000-01-01T00:00:00Z',expires_at:'2000-01-01T00:01:40Z'};
  if(action==='save'){packets.push(structuredClone(body));if(uncertain){uncertain=false;throw Error('lost acknowledgement');}return {revision:body.revision+1};}
  assert.equal(action,'submit');return {success:true,is_graded:true,score:0,max_score:2};
 };
 let attempt;
 try{
  attempt=await openQuizAttempt(transport,'session','reference',s=>statuses.push(s));assert.equal(attempt.remaining(),100);
  attempt.setAnswer('q1',0);await assert.rejects(()=>attempt.flush(),/lost acknowledgement/);
  attempt.setAnswer('q1',1);await attempt.flush();assert.deepEqual(packets[1],packets[0]);assert.equal(packets[2].answers.q1,1);assert.equal(packets[2].revision,1);
  clock=10001;assert.equal(attempt.remaining(),90);clock=100001;assert.equal(attempt.setAnswer('q1',0),false);
  const result=await attempt.submit();assert.equal(result.score,0);assert.ok(statuses.includes('error'));assert.ok(statuses.includes('saved'));
 }finally{attempt?.dispose();Object.defineProperty(globalThis,'performance',original);}
});
test('quiz start fails closed when no authoritative attempt or question model arrives',async()=>{
 await assert.rejects(()=>openQuizAttempt(async()=>({}), 'session','reference'),/تعذر بدء/);
 const submitted=await openQuizAttempt(async()=>({submitted:true,result:{success:true,score:0}}),'session','reference');assert.equal(submitted.submitted.score,0);
});
