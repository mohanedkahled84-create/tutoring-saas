import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {assistantCatalog,validateAssistantAccess,confirmAssistantMessage,assistantRpc} from '../dist/features/assistants/access.js';
import {assistantPages,renderAssistantAccessFields} from '../../web/src/components/AssistantAccessFields.js';
import {familyHash} from '../dist/shared/utils/parentFamily.js';
import {registerTeacherAssistantsActions,renderTeacherAssistantsView} from '../../web/src/components/TeacherAssistantsView.js';

test('new assistants default to no pages and no group data; catalog only exposes implemented actions',()=>{
 assert.deepEqual(validateAssistantAccess({}),{permissions:{},all_groups:false,group_ids:[]});
 assert.deepEqual(assistantPages.map(([key,label,actions])=>[key,label,actions]),assistantCatalog.filter(p=>p.key!=='paper-exams').map(p=>[p.key,p.label,[...p.actions]]));
 assert.equal(assistantPages.some(([key])=>key==='paper-exams'),false);
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

test('assistants page, fields, utilities and modals render in English with dir="ltr" when locale is en',async(t)=>{
 const {assistantPay}=await import('../../web/src/utils/assistantPay.js');
 const {assistantInvitationStatus}=await import('../../web/src/utils/assistantInvitation.js');
 const {renderAssistantPayFields}=await import('../../web/src/components/AssistantPayFields.js');
 const {renderAssistantActivity}=await import('../../web/src/components/AssistantActivityView.js');
 const {renderCollectionRows}=await import('../../web/src/components/CollectionLedger.js');
 const {renderCenterAssistantsView}=await import('../../web/src/components/CenterAssistantsView.js');
 const prevStorage=globalThis.localStorage;
 t.after(()=>{if(prevStorage===undefined)delete globalThis.localStorage;else globalThis.localStorage=prevStorage;});
 globalThis.localStorage={getItem:k=>k==='centrly_locale'?'en':null};

 const row={id:'10000000-0000-4000-8000-000000000001',name:'Mona',phone:'01011111111',status:'active',salary_model:'per_day',salary:200,pay_start_date:'2026-11-01',work_weekdays:[6,1],access:{permissions:{'students.view':true},all_groups:true,group_ids:[]},payroll:{month:11,year:2026,amount:1600,units:8}};
 const html=renderTeacherAssistantsView([row],[]);
 assert.match(html,/dir="ltr"/);
 assert.match(html,/Assistants Management/);
 assert.match(html,/Assistants directory \(1\)/);
 assert.match(html,/Invite assistant/);
 assert.match(html,/Per day — Auto/);
 assert.match(html,/8 scheduled work days — auto-calculated for month/);
 assert.match(html,/Independent account/);

 assert.match(assistantPay(row).basis,/scheduled work days/);
 assert.match(assistantInvitationStatus({access:{},status:'inactive'}),/Access suspended/);
 assert.match(renderAssistantAccessFields('enTest',[]),/Pages & permissions/);
 assert.match(renderAssistantPayFields('enPay',row),/Weekly work schedule/);
 assert.match(renderAssistantActivity([{actor_type:'owner',action:'attendance.edit',created_at:'2026-11-01T00:00:00Z',changes:{before:{attended:true},after:{attended:false}}}]),/Before:.*Present/);
 assert.match(renderCollectionRows([{id:'rc-1',student_name:'Ali',actor_name:'Mona',amount:100,payment_method:'cash',collected_at:'2026-11-01T00:00:00Z',status:'active'}],true),/Void receipt/);
 assert.match(renderCenterAssistantsView([row],[]),/Assistants & Staff Directory/);

 let shown;
 const app={groups:[],showModal:(title,body,footer)=>{shown={title,body,footer};},teacherAssistants:[row]};
 registerTeacherAssistantsActions(app);
 app.openAddTeacherAssistantModal();
 assert.equal(shown.title,'Invite an assistant to your team');
 assert.match(shown.body,/dir="ltr"/);
 assert.match(shown.footer,/Save & send invite/);
});
