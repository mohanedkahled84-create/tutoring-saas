import test from 'node:test';
import assert from 'node:assert/strict';
import {cairoToday,teacherActionSummary} from '../dist/features/reports/actionSummary.js';
import {pendingAttendance,todayGroups,renderTeacherActions} from '../../web/src/components/TeacherActionsPanel.js';

test('daily actions use the Egyptian calendar across UTC midnight and daylight saving',()=>{
 assert.equal(cairoToday(new Date('2026-11-01T22:30:00Z')),'2026-11-02');
 assert.equal(cairoToday(new Date('2026-06-01T21:30:00Z')),'2026-06-02');
 assert.equal(todayGroups([{id:1,day_of_week:'الأحد والأربعاء'},{id:2,day_of_week:'الاثنين'}],new Date('2026-11-01T22:30:00Z'))[0].id,2);
});
test('attendance actions distinguish an unrecorded student from a recorded absence and deduplicate membership',()=>{
 const students=[{id:'a',group_id:'g',group_ids:['g']},{id:'b',group_ids:['g']},{id:'other',group_id:'foreign'}];
 assert.equal(pendingAttendance(null,students),null);
 assert.equal(pendingAttendance({sessions:[{group_id:'g',recorded_student_ids:['a','a']}]},students),1);
 assert.equal(pendingAttendance({sessions:[]},students),0);
 assert.ok(renderTeacherActions({actionSummaryError:true}).includes('إعادة المحاولة'));
});
test('summary queries stay tenant-scoped, deduplicate records, and fail visibly rather than returning false zeros',async()=>{
 const calls=[];let failure=false;
 const db={from:table=>{
  const q={select:(...args)=>{calls.push([table,'select',...args]);return q;},eq:(...args)=>{calls.push([table,'eq',...args]);return q;},in:()=>q,order:()=>q,
   then:resolve=>resolve(table==='homework_submissions'?{count:2,error:null}:{data:[{id:'session',group_id:'g',status:'in_progress'}],error:null}),
   limit:()=>q,range:async()=>failure?{error:{message:'private database details'}}:{data:[{session_id:'session',student_id:'student'},{session_id:'session',student_id:'student'}],error:null}};return q;
 }};
 const summary=await teacherActionSummary(db,'tenant',new Date('2026-11-02T10:00:00Z'));
 assert.equal(summary.pending_homework,2);assert.deepEqual(summary.sessions[0].recorded_student_ids,['student']);
 for(const table of ['homework_submissions','sessions','attendance'])assert.ok(calls.some(c=>c[0]===table && c[1]==='eq' && c[2]==='tenant_id' && c[3]==='tenant'));
 failure=true;await assert.rejects(teacherActionSummary(db,'tenant'),e=>!e.message.includes('private') && e.message.includes('تعذر'));
});
