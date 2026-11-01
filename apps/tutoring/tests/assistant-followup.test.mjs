import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {followupQuery,followupPrepare,whatsappFollowup} from '../dist/features/assistants/followup.js';
import {validateAssistantAccess,assistantAccessRouter} from '../dist/features/assistants/access.js';
import {safeAssistantChanges} from '../dist/features/assistants/activity.js';
import {renderAssistantActivity} from '../../web/src/components/AssistantActivityView.js';
const selection={student_id:randomUUID(),group_id:randomUUID(),from:'2026-10-01',to:'2026-11-01',recipient:'parent'};
test('manual messaging requires explicit permissions and never inherits sending from report access',()=>{
 assert.equal(validateAssistantAccess({permissions:{'reports.view':true}}).permissions['messages.send'],undefined);
 assert.throws(()=>validateAssistantAccess({permissions:{'messages.send':true}}));
 assert.equal(validateAssistantAccess({permissions:{'messages.view':true,'messages.send':true}}).permissions['messages.send'],true);
});
test('followup inputs reject forged recipients, content, tenant and invalid calendar dates',()=>{
 for(const extra of [{phone:'201011111111'},{message:'forged'},{tenant_id:randomUUID()},{recipient:'any'},{from:'2026-02-30'}])assert.equal(followupPrepare.safeParse({...selection,...extra}).success,false);
 assert.equal(followupQuery.safeParse({page:0}).success,false);assert.equal(followupQuery.safeParse({student_id:'bad'}).success,false);assert.equal(followupQuery.safeParse({from:'2026-02-30'}).success,false);
});
test('prepared link uses server report, encodes Arabic and preserves real zero and unrecorded counts',()=>{
 const r=whatsappFollowup({phone:'01011111111',student_name:'طالب\nاسم',teacher_name:'المعلم',group_name:'مجموعة & 1',from:selection.from,to:selection.to,attendance:{total:3,present:1,absent:1,unrecorded:1},grades:{total:2,recorded:1,unrecorded:1,latest:{title:'اختبار',score:0,max_score:10}},homework:{total:4,submitted:3,on_time:1,late:1,without_deadline:1,not_submitted:1,overdue:1}},'parent');
 const url=new URL(r.whatsapp_url);assert.equal(url.origin,'https://wa.me');assert.equal(url.pathname,'/201011111111');assert.equal(url.searchParams.get('text'),r.message);assert.match(r.message,/0 \/ 10/);assert.match(r.message,/1 لم يُرصد بعد/);assert.match(r.message,/طالب اسم/);assert.equal(r.phone,undefined);assert.equal(r.delivery_status,undefined);
 assert.throws(()=>whatsappFollowup({...r,phone:'bad'},'parent'),e=>e.status===400);
});
test('prepare endpoint rejects client supplied message before any database operation',async()=>{
 const route=assistantAccessRouter.stack.find(l=>l.route?.path==='/followup/prepare').route.stack[0].handle;
 const res={status(code){this.code=code;return this;},json(){}};
 await route({body:{...selection,message:'client forged'}},res);assert.equal(res.code,400);
});
test('message audit says preview request, never claims delivery and removes phone or message bodies',()=>{
 const changes=safeAssistantChanges('messages.prepare',{after:{recipient:'parent',from:selection.from,to:selection.to,phone:'secret',message:'private'}});
 assert.equal(changes.after.phone,undefined);assert.equal(changes.after.message,undefined);
 const html=renderAssistantActivity([{action:'messages.prepare',changes}]);assert.match(html,/لا يؤكد الإرسال/);assert.ok(!html.includes('private'));
});

test('legacy report send routes cannot enqueue or claim delivery for old clients',async()=>{
 const {reportsRouter}=await import('../dist/features/reports/routes.js');
 for(const path of ['/bulk-send','/:student_id/send']){
  const route=reportsRouter.stack.find(l=>l.route?.path===path).route.stack[0].handle;
  const res={status(code){this.code=code;return this;},json(data){this.data=data;}};
  await route({user:{tenant_id:randomUUID()},body:{}},res);assert.equal(res.code,410);assert.equal(res.data.error.code,'MANUAL_WHATSAPP_REQUIRED');
 }
});
test('teacher report actions open manual preview with the selected period instead of auto dispatch',async()=>{
 const {registerStudentReportsActions}=await import('../../web/src/components/StudentReportsView.js');
 let selection;const student=randomUUID(),group=randomUUID(),app={reportsState:{period:{month:10,year:2026},selectedGroupId:group},students:[{id:student,group_id:group}],openFollowupReports(v){selection=v;}};
 registerStudentReportsActions(app);app.handleSendIndividualReport(student);assert.equal(selection.student_id,student);assert.equal(selection.from,'2026-10-01');assert.equal(selection.to,'2026-10-31');app.handleBulkSendReports();assert.equal(selection.student_id,undefined);assert.equal(selection.group_id,group);
});
