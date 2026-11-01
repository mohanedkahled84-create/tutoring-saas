import test from 'node:test';
import assert from 'node:assert/strict';
import {loadAssistantActivity,safeAssistantChanges} from '../dist/features/assistants/activity.js';
import {renderAssistantActivity} from '../../web/src/components/AssistantActivityView.js';
import {renderTeacherAssistantsView,registerTeacherAssistantsActions} from '../../web/src/components/TeacherAssistantsView.js';
import {assistantManagementRouter} from '../dist/features/assistants/access.js';

test('activity responses allow only relevant fields and never credentials or nested payloads',()=>{
 const changes={before:{name:'قبل',portal_password:'private-password',password_hash:'hash',notes:{secret:'nested'}},after:{name:'بعد',parent_phone:'01000000000',portal_password:'private-password',notes:{secret:'nested'}}};
 assert.deepEqual(safeAssistantChanges('students.edit',changes),{before:{name:'قبل'},after:{name:'بعد',parent_phone:'01000000000'}});
 assert.deepEqual(safeAssistantChanges('access_configured',{before:{salary:100},after:{salary:500}}),{before:{},after:{}});
});
test('activity pagination and filters always include the authenticated tenant',async()=>{
 const calls=[];let range;
 const query={select(){return query;},eq(...args){calls.push(args);return query;},order(){return query;},async range(...args){range=args;return {data:Array.from({length:31},(_,i)=>({id:String(i),action:'attendance.edit',changes:{before:{attended:true},after:{attended:false}},actor_name:'مساعد'})),error:null};}};
 const db={from(table){assert.equal(table,'assistant_access_audit');return query;}};
 const result=await loadAssistantActivity(db,'tenant-a',{page:'2',assistant_id:'10000000-0000-4000-8000-000000000001'});
 assert.deepEqual(calls,[['tenant_id','tenant-a'],['assistant_id','10000000-0000-4000-8000-000000000001']]);assert.deepEqual(range,[30,60]);assert.equal(result.entries.length,30);assert.equal(result.has_more,true);
 for(const page of ['bad',0,-1,10001,1.5])await assert.rejects(loadAssistantActivity(db,'tenant-a',{page}));
 await assert.rejects(loadAssistantActivity(db,'tenant-a',{assistant_id:'not-an-id'}));
});
test('legacy assistant roles cannot access the owner activity route',()=>{
 const guard=assistantManagementRouter.stack[0].handle;
 for(const role of ['assistant','assistant_to_teacher','assistant_to_center']){
  let reached=false;const res={status(code){this.code=code;return this;},json(body){this.body=body;}};
  guard({user:{role,tenant_id:'tenant-a'}},res,()=>{reached=true;});assert.equal(res.code,403);assert.equal(reached,false);
 }
});
test('activity rendering escapes actor, target and change text and shows the actual before/after values',()=>{
 const html=renderAssistantActivity([{actor_name:'<img src=x onerror=alert(1)>',actor_type:'assistant',target_name:'<script>bad</script>',created_at:'2026-11-01T00:00:00Z',action:'attendance.edit',changes:{before:{attended:true},after:{attended:false,portal_password:'private-password'}}}]);
 assert.ok(!html.includes('<img'));assert.ok(!html.includes('<script>'));assert.ok(!html.includes('private-password'));assert.match(html,/حاضر/);assert.match(html,/غائب/);assert.match(html,/قبل:/);assert.match(html,/بعد:/);
});
test('PIN lock conceals all pay amounts while team controls, names and activity remain available',()=>{
 const row={id:'10000000-0000-4000-8000-000000000001',name:'مساعد معروف',status:'active',salary:987654.32,salary_model:'monthly',payroll:{amount:987654.32,units:1,month:11,year:2026}};
 const html=renderTeacherAssistantsView([row],[],{hasPin:true,isUnlocked:false,hideNumbers:false});
 assert.match(html,/مساعد معروف/);assert.match(html,/openEditTeacherAssistantModal/);assert.match(html,/openAssistantActivityLog/);assert.match(html,/الأجر محمي/);assert.ok(!html.includes('٩٨٧'));assert.ok(!html.includes('987654'));
});
test('editing permissions with a locked PIN does not render salary fields',()=>{
 let shown;
 const app={hasSecurityPin:true,isFinancialUnlocked:false,teacherAssistants:[{id:'a',name:'مساعد',salary:987654.32,access:{permissions:{'students.view':true},group_ids:[],all_groups:false}}],showModal(title,body){shown=body;}};
 registerTeacherAssistantsActions(app);app.openEditTeacherAssistantModal('a');assert.match(shown,/modalEditTA_Permission/);assert.ok(!shown.includes('modalEditTA_SalaryAmount'));assert.ok(!shown.includes('987654'));
});
