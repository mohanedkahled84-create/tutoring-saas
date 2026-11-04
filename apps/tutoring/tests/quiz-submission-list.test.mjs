import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {quizzesRouter} from '../dist/features/quizzes/routes.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';

test('quiz lists retain pending essays, isolate legacy groups and respect status filters',async t=>{
 const quiz={id:'exam',type:'online_quiz',title:'Quiz 4',group_id:'own',questions:JSON.stringify({quiz_number:4,questions:[{id:'essay',type:'essay',points:5}]})};
 const rows={homework_submissions:[
  {id:'waiting',tenant_id:'teacher',student_id:'s',material_id:'exam',file_name:'online_quiz_4.json',status:'pending',teacher_notes:JSON.stringify({has_essay:true,is_graded:false,answers:{essay:'saved'}})},
  {id:'old-waiting',tenant_id:'teacher',student_id:'s',material_id:'exam',file_name:'online_quiz_4.json',status:'needs_grading',teacher_notes:JSON.stringify({has_essay:true,is_graded:false})},
  {id:'marked',tenant_id:'teacher',student_id:'s',material_id:'exam',file_name:'online_quiz_4.json',status:'approved',teacher_notes:JSON.stringify({has_essay:false,is_graded:true,final_score:3})},
  {id:'homework',tenant_id:'teacher',student_id:'s',material_id:'homework',file_name:'homework.pdf',status:'pending',teacher_notes:null}],
  students:[{id:'s',student_code:'1002',name:'fixture',group_id:'own'}],study_materials:[quiz,{id:'homework',type:'pdf',group_id:'own'}],groups:[{id:'own',tenant_id:'teacher'}],quiz_scores:[],
  whatsapp_inbox:[{id:'leak',tenant_id:null,status:'approved',phone:'QUIZ_SUB_foreign',message_body:JSON.stringify({quiz_id:'foreign-exam',group_id:'foreign',student_code:'1002',total_score:4})}]};
 const db={from(table){let data=[...(rows[table]||[])];const query={select(){return query;},eq(k,v){data=data.filter(r=>r[k]===v);return query;},in(k,values){data=data.filter(r=>values.includes(r[k]));return query;},or(){return query;},like(){return query;},limit(){return query;},order(){return query;},then(resolve,reject){return Promise.resolve({data,error:null}).then(resolve,reject);}};return query;}};
 const app=express();app.use((req,_res,next)=>{req.user={id:'owner',tenant_id:'teacher',role:'owner'};req.supabase=db;delegatedClientScope.run(db,next);});app.use('/quizzes',quizzesRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const read=async suffix=>{const response=await fetch(`http://127.0.0.1:${server.address().port}/quizzes/submissions${suffix}`);assert.equal(response.status,200);return (await response.json()).submissions;};
 assert.deepEqual((await read('?status=pending')).map(r=>r.id).sort(),['old-waiting','waiting']);
 assert.deepEqual((await read('?status=graded')).map(r=>r.id),['marked']);
 assert.deepEqual((await read('')).map(r=>r.id).sort(),['marked','old-waiting','waiting']);
 assert.deepEqual((await read('/pending')).map(r=>r.id).sort(),['old-waiting','waiting']);
});
