import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assistantCatalog,validateAssistantAccess,confirmAssistantMessage,assistantRpc} from '../dist/features/assistants/access.js';
import {assistantPages,renderAssistantAccessFields} from '../../web/src/components/AssistantAccessFields.js';
import {familyHash} from '../dist/shared/utils/parentFamily.js';
import {registerTeacherAssistantsActions,renderTeacherAssistantsView} from '../../web/src/components/TeacherAssistantsView.js';

test('new assistants default to no pages and no group data; catalog only exposes implemented actions',()=>{
 assert.deepEqual(validateAssistantAccess({}),{permissions:{},all_groups:false,group_ids:[]});
 assert.deepEqual(assistantPages.map(([key,label,actions])=>[key,label,actions]),assistantCatalog.map(p=>[p.key,p.label,[...p.actions]]));
 const html=renderAssistantAccessFields('test',[]);
 assert.doesNotMatch(html,/checked/);
 assert.match(html,/كل صفحة لها صلاحيات مستقلة/);
});
test('permission names, booleans, parent view and group creation scope are enforced',()=>{
 for(const permissions of [{'admin.view':true},{'students.view':'true'},{'students.edit':true},{'groups.view':true,'groups.create':true}])assert.throws(()=>validateAssistantAccess({permissions}));
 assert.throws(()=>validateAssistantAccess({group_ids:['bad']}));
 const id=randomUUID();assert.deepEqual(validateAssistantAccess({permissions:{'students.view':true,'students.edit':true},group_ids:[id,id]}).group_ids,[id]);
});
test('verified assistant claim link is delivered only to the signed sender, with no password exposed',async()=>{
 let args;const tenant=randomUUID(),replies=[];
 const db={rpc:async(name,input)=>{assert.equal(name,'assistant_confirm_invitation');args=input;return {data:{tenant_id:tenant,teacher_name:'المعلم'},error:null};}};
 await confirmAssistantMessage(db,'201011111111','CENTRLY_ASSISTANT:'+'x'.repeat(43),async(...values)=>{replies.push(values);return true;});
 assert.equal(args.p_phone,'201011111111');assert.equal(args.p_nonce_hash,familyHash('x'.repeat(43)));
 assert.equal(replies[0][0],'201011111111');assert.match(replies[0][1],new RegExp(`/assistant\\?workspace=${tenant}#registration=[\\w-]{43}`));
 assert.equal(args.p_claim_hash.length,64);assert.ok(!replies[0][1].includes(args.p_claim_hash));
 let sent=false;await confirmAssistantMessage({rpc:async()=>({data:null,error:null})},'201011111111','CENTRLY_ASSISTANT:'+'x'.repeat(43),async()=>{sent=true;return true;});assert.equal(sent,false);
});
test('failed claim delivery surfaces failure so signed webhook retries can recover',async()=>{
 await assert.rejects(confirmAssistantMessage({rpc:async()=>({data:{tenant_id:randomUUID(),teacher_name:'test'},error:null})},'201011111111','CENTRLY_ASSISTANT:'+'x'.repeat(43),async()=>false),e=>e.status===502);
});
test('assistant SQL boundary errors do not leak table details or credentials',async()=>{
 for(const [message,status] of [['UNAUTHORIZED',401],['FORBIDDEN',403],['NOT_FOUND',404],['database error with internal details',503]]){
  await assert.rejects(assistantRpc({rpc:async()=>({error:{message}})},'test',{}),e=>e.status===status && !e.message.includes('internal details'));
 }
});
test('teacher creates invitations without providing assistant name, and edit restores schedule and scope',()=>{
 let shown;const group=randomUUID(),assistant=randomUUID();
 const app={groups:[{id:group,name:'مجموعة أولى'}],showModal:(title,body,footer)=>{shown={title,body,footer};},teacherAssistants:[{id:assistant,name:'مساعد',phone:'201011111111',status:'active',salary_model:'per_day',salary:100,pay_start_date:'2026-11-01',work_weekdays:[1,3],access:{permissions:{'students.view':true},group_ids:[group],all_groups:false}}]};
 registerTeacherAssistantsActions(app);app.openAddTeacherAssistantModal();assert.ok(!shown.body.includes('modalTA_Name'));assert.match(shown.body,/modalTA_Phone/);assert.match(shown.body,/modalTA_Permission/);
 app.openEditTeacherAssistantModal(assistant);assert.match(shown.body,/value="2026-11-01"/);assert.match(shown.body,/value="1" checked/);assert.match(shown.body,/value="students.view" checked/);assert.match(shown.body,/modalEditTA_Status/);
});
test('assistant names are displayed as text and never inserted into inline handler code',()=>{
 const html=renderTeacherAssistantsView([{id:'10000000-0000-4000-8000-000000000001',name:"x');window.injected=true;//<img src=x>",phone:'01000000000',status:'active',salary_model:'monthly',salary:100,payroll:{month:11,year:2026,amount:100,units:1}}]);
 assert.ok(!html.includes('<img src=x>'));
 assert.ok(!/onclick="[^"]*injected/.test(html));
});

test('manual assistant records remain available without enabling WhatsApp account invitations',()=>{
 let modal;
 const app={groups:[],showModal(title,body,footer){modal={title,body,footer};}};
 registerTeacherAssistantsActions(app);app.openAddTeacherAssistantModal(true);
 assert.equal(modal.title,'إضافة سجل مساعد');assert.match(modal.body,/data-record-only="true"/);assert.match(modal.body,/id="modalTA_Name"/);assert.match(modal.body,/لا ينشئ حساب دخول/);assert.ok(!modal.body.includes('modalTA_Permission'));assert.match(modal.footer,/حفظ السجل/);
 app.openAddTeacherAssistantModal();assert.match(modal.body,/data-record-only="false"/);assert.ok(!modal.body.includes('id="modalTA_Name"'));assert.match(modal.body,/modalTA_Permission/);
});
