import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {renderBasicStudentPortal} from '../../web/src/components/BasicStudentPortalView.js';
import {loadPortalAccount} from '../dist/shared/utils/portalAccount.js';
import {generateParentPortalToken} from '../dist/shared/utils/tokens.js';

test('basic portal presents student monitoring, safe links and no pro learning actions',()=>{
 const html=renderBasicStudentPortal({student:{name:'<student>',student_code:'1001',teacher_name:'Teacher'},summary:{total_sessions:1,attended_count:1,attendance_rate:'100%',absent_count:0},sessions:[{session_number:1,attended:true}],quizzes:[{title:'Quiz',score:0,max_score:10}],materials:[{title:'Homework',is_homework:true,submission_status:'pending'},{title:'Bad link',url:'javascript:alert(1)'},{title:'Video',type:'video'},{title:'Online',type:'online_quiz'}],features:{teaching_platform:false}});
 assert.ok(html.includes('&lt;student&gt;'));assert.ok(html.includes('الحضور'));assert.ok(html.includes('الدرجات'));assert.ok(html.includes('بطاقة الحضور'));assert.ok(html.includes('قيد المراجعة'));assert.ok(html.includes('0 / 10'));
 for(const forbidden of ['javascript:alert','Video','Online','رفع حل الواجب','بدء الامتحان'])assert.ok(!html.includes(forbidden),forbidden);
 assert.ok(!renderBasicStudentPortal({student:{name:'No code'}}).includes('student-attendance-pass'));
});

test('basic server payload filters both current and legacy online content but retains grades',async()=>{
 const id=randomUUID(),tenant=randomUUID(),group=randomUUID();
 const db={rpc:(name)=>{
  if(name==='get_parent_portal_payload')return Promise.resolve({data:{student:{id,name:'Fixture'},preferences:{show_student_rank:false,show_student_leaderboard:false},summary:{total_sessions:0},sessions:[],quizzes:[],materials:[{type:'video',title:'video'},{type:'online_quiz',title:'online'},{type:'pdf',title:'notes'}]},error:null});
  if(name==='portal_announcements')return {abortSignal:()=>Promise.resolve({data:[],error:null})};
  if(name==='portal_legacy_quiz_payload')return Promise.resolve({data:{definitions:[{message_body:{id:'old',group_id:group,questions:[{text:'Question',points:5}]} }],submissions:[{material_id:'old',status:'approved',teacher_notes:{score:3}}]},error:null});
  throw new Error('Unexpected query '+name);
 }};
 const data=await loadPortalAccount(db,generateParentPortalToken(id,tenant),false,{id,tenant_id:tenant,group_ids:[group],commercial:{readable:true,teaching_platform:false}});
 assert.equal(data.features.teaching_platform,false);assert.deepEqual(data.materials.map(m=>m.type),['pdf']);assert.equal(data.quizzes[0].score,3);
});

test('pro and legacy accounts retain their learning material entitlement',async()=>{
 const id=randomUUID(),tenant=randomUUID();
 const db={rpc:name=>{
  if(name==='get_parent_portal_payload')return Promise.resolve({data:{student:{id},preferences:{show_student_rank:false,show_student_leaderboard:false,show_announcements:false},summary:{total_sessions:0},sessions:[],quizzes:[],materials:[{type:'video',title:'lesson'}]},error:null});
  throw Error('Unexpected query '+name);
 }};
 for(const commercial of [{readable:true,teaching_platform:true},null]){
  const data=await loadPortalAccount(db,generateParentPortalToken(id,tenant),false,{id,tenant_id:tenant,group_ids:[],commercial});
  assert.equal(data.features.teaching_platform,true);assert.equal(data.materials[0].type,'video');
 }
});
