import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {parentMonitorPayload,loadPortalAccount} from '../dist/shared/utils/portalAccount.js';
import {generateParentPortalToken} from '../dist/shared/utils/tokens.js';
test('parent account is an allowlisted monitoring response with no learning content or private files',()=>{
 const result=parentMonitorPayload({student:{id:'own',tenant_id:'tenant',name:'طفل',private:'SECRET'},summary:{attendance_rate:'80%',student_rank:3},sessions:[],quizzes:[{title:'اختبار',score:0,max_score:10,quiz_date:'2026-10-31',questions:'SECRET'}],materials:[{type:'homework',title:'واجب',submission_status:'pending',submitted_at:'2026-10-31',description:'SECRET',submission_url:'SECRET'},{type:'online_quiz',questions:'SECRET'}]});
 assert.ok(!JSON.stringify(result).includes('SECRET'));assert.equal(result.materials.length,1);assert.equal(result.quizzes[0].score,0);assert.equal(result.quizzes[0].date,'2026-10-31');assert.equal(result.summary.student_rank,undefined);
});
test('redeemed parent context avoids another verification, rank and file-signing trip, preserving actual legacy grades',async()=>{
 const id=randomUUID(),tenant=randomUUID(),group=randomUUID(),calls=[];
 const db={rpc:async(name,args)=>{calls.push(name);if(name==='get_parent_portal_payload')return {data:{student:{id,student_code:'1'},summary:{total_sessions:0},sessions:[],quizzes:[],materials:[{type:'homework',title:'واجب',submission_url:'private-homework/t/secret',submission_status:'pending'}]},error:null};if(name==='portal_legacy_quiz_payload')return {data:{definitions:[{message_body:{id:'quiz',group_id:group,questions:[{text:'PRIVATE',points:5,correct_index:1}]}}],submissions:[{material_id:'quiz',status:'approved',teacher_notes:{score:0},submitted_at:'2026-10-31'}]},error:null};throw Error('Unexpected extra trip '+name);}};
 const result=await loadPortalAccount(db,generateParentPortalToken(id,tenant),true,{id,tenant_id:tenant,group_ids:[group]});
 assert.deepEqual(calls,['get_parent_portal_payload','portal_legacy_quiz_payload']);assert.equal(result.student.tenant_id,tenant);assert.equal(result.quizzes[0].score,0);assert.equal(result.quizzes[0].max_score,5);assert.equal(result.materials.length,1);assert.ok(!JSON.stringify(result).includes('PRIVATE'));assert.equal(result.materials[0].submission_url,undefined);
 await assert.rejects(()=>loadPortalAccount(db,generateParentPortalToken(id,tenant),true,{id:randomUUID(),tenant_id:tenant,group_ids:[]}),e=>e.status===401);
});
