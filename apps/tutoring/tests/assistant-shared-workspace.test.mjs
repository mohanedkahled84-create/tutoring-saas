import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantCan,assistantCanNavigate,assistantResourceRoute} from '../../web/src/utils/assistantWorkspacePolicy.js';
import {renderSidebar} from '../../web/src/components/Sidebar.js';
import {renderNavbar} from '../../web/src/components/Navbar.js';
import {enrichAssistantPage} from '../dist/features/assistants/pageDetails.js';

test('assistant routes require explicit page view and never unlock teacher finances/settings/team',()=>{
 const permissions={'students.view':true,'groups.edit':true,'grades.view':true,'collections.view':true};
 assert.equal(assistantCanNavigate(permissions,'students'),true);assert.equal(assistantCanNavigate(permissions,'quizzes'),true);
 for(const route of ['groups','dashboard','settings','assistants','billing','online-quizzes','platform-builder','activity-logs','unknown'])assert.equal(assistantCanNavigate(permissions,route),false,route);
 assert.equal(assistantCan(permissions,'groups','edit'),false);assert.equal(assistantCan(permissions,'students','create'),false);
 assert.equal(assistantResourceRoute('attendance'),'sessions');assert.equal(assistantResourceRoute('sessions'),'calendar');
});
test('shared teacher sidebar keeps locked routes visible with native disabled buttons and no handler',()=>{
 const html=renderSidebar('students',{role:'assistant'},undefined,{canNavigate:route=>route==='students'});
 const locked=html.match(/<button[^>]*data-route="settings"[^>]*>/)?.[0];
 assert.ok(locked.includes('disabled'));assert.ok(locked.includes('aria-disabled="true"'));assert.ok(!locked.includes('onclick'));
 assert.match(html,/>الإعدادات والاشتراك</);assert.match(html,/data-route="students"[^>]*onclick=/);assert.match(html,/aria-current="page"/);
 const owner=renderSidebar('students',{role:'teacher'});assert.ok(!owner.includes('nav-locked'));assert.ok(!owner.includes('غير متاح ضمن صلاحياتك'));
});
test('shared navbar escapes assistant names instead of treating them as HTML',()=>{
 const html=renderNavbar({role:'assistant',name:'<img src=x onerror=alert(1)>'});assert.ok(!html.includes('<img'));assert.ok(html.includes('&lt;img'));assert.ok(html.includes('مساعد'));
});
test('homework metadata uses only authorized result IDs and never returns storage paths',async()=>{
 let table,ids;const db={from:name=>{table=name;return {select:()=>({in:async(_key,values)=>{ids=values;return {data:[{id:'allowed',material_id:'assignment',file_url:'secret/storage/path',file_purged:false},{id:'purged',material_id:'other',file_url:'purged/path',file_purged:true}],error:null};}})}}};
 const result=await enrichAssistantPage(db,'homework',{rows:[{id:'allowed',student_name:'طالب'},{id:'purged'}]});
 assert.equal(table,'homework_submissions');assert.deepEqual(ids,['allowed','purged']);assert.equal(result.rows[0].has_file,true);assert.equal(result.rows[1].has_file,false);assert.equal(result.rows[0].material_id,'assignment');assert.ok(!JSON.stringify(result).includes('/path'));
});
test('no authorized rows or unrelated page means no metadata query',async()=>{
 const db={from:()=>assert.fail('metadata must not be queried')};for(const resource of ['homework','attendance','students'])await enrichAssistantPage(db,resource,{rows:[]});await enrichAssistantPage(db,'students',{rows:[{id:'allowed'}]});
});
test('large authorized rosters use bounded metadata queries without dropping records',async()=>{
 const sizes=[],ids=Array.from({length:201},(_,n)=>'authorized-'+n),db={from:()=>({select:()=>({in:async(_key,values)=>{sizes.push(values.length);return {data:values.map(id=>({id,material_id:'assignment',file_url:null})),error:null};}})})};
 const result=await enrichAssistantPage(db,'homework',{rows:ids.map(id=>({id}))});assert.deepEqual(sizes,[100,100,1]);assert.equal(result.rows.length,201);assert.ok(result.rows.every(row=>row.material_id==='assignment' && row.has_file===false));
});
test('session status is read from the authorized roster, never invented by the UI',async()=>{
 let id,ids;const db={from:name=>({select:()=>name==='sessions'?{eq:(_key,value)=>{id=value;return {single:async()=>({data:{id:value,status:'ended'},error:null})};}}:{in:async(_key,values)=>{ids=values;return {data:[{id:'allowed-student',student_code:'1002'}],error:null};}}})};
 const result=await enrichAssistantPage(db,'attendance',{rows:[{session_id:'authorized-session',student_id:'allowed-student'}]});assert.equal(id,'authorized-session');assert.equal(result.session.status,'ended');assert.deepEqual(ids,['allowed-student']);assert.equal(result.rows[0].student_code,'1002');
});
test('metadata failures stop the page without exposing database errors',async()=>{
 const db={from:()=>({select:()=>({in:async()=>({data:null,error:{message:'private SQL details'}})})})};await assert.rejects(()=>enrichAssistantPage(db,'homework',{rows:[{id:'allowed'}]}),error=>error.status===503 && !error.message.includes('private'));
});
