import test from 'node:test';
import assert from 'node:assert/strict';
import {notifyAssistantInvitation,assistantInvitationTemplate} from '../dist/features/assistants/invitationDelivery.js';
import {assistantRequest} from '../../web/src/services/assistantClient.js';
import {assistantInvitationStatus} from '../../web/src/utils/assistantInvitation.js';

const meta={appSecret:'test-only',accessToken:'test-token',wabaId:'test-waba',phoneNumberId:'test-phone'};
test('assistant invitation sends only the requested approved Utility copy with one teacher variable',async t=>{
 const calls=[];const previous=globalThis.fetch;t.after(()=>{globalThis.fetch=previous;});
 globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(calls.length===1?{data:[{name:assistantInvitationTemplate,status:'APPROVED',category:'UTILITY',language:'ar'}]}:{messages:[{id:'test-id'}]});};
 assert.equal(await notifyAssistantInvitation(meta,'201011111111','عمر المحمدي','x'.repeat(43)),'sent');
 assert.equal(calls.length,2);const message=JSON.parse(calls[1].options.body);
 assert.equal(message.template.name,'centerly_assistant_account_added_v1');assert.equal(message.to,'201011111111');
 assert.deepEqual(message.template.components[0].parameters,[{type:'text',text:'عمر المحمدي'}]);
 assert.equal(message.template.components[1].parameters[0].payload,'CENTRLY_ASSISTANT:'+'x'.repeat(43));
 assert.ok(!calls[1].options.body.includes('AST-'));
});

test('pending, rejected, Marketing, wrong language and failed metadata checks never send invitations',async t=>{
 const previous=globalThis.fetch;t.after(()=>{globalThis.fetch=previous;});
 for(const template of [
  {status:'PENDING',category:'UTILITY',language:'ar'},
  {status:'REJECTED',category:'UTILITY',language:'ar'},
  {status:'APPROVED',category:'MARKETING',language:'ar'},
  {status:'APPROVED',category:'UTILITY',language:'en'},
 ]){
  let calls=0;globalThis.fetch=async()=>{calls++;return Response.json({data:[{name:assistantInvitationTemplate,...template}]});};
  assert.equal(await notifyAssistantInvitation(meta,'201011111111','teacher','x'.repeat(43)),'blocked');assert.equal(calls,1);
 }
 globalThis.fetch=async()=>{throw new Error('offline');};assert.equal(await notifyAssistantInvitation(meta,'201011111111','teacher','x'.repeat(43)),'blocked');
 globalThis.fetch=async()=>{throw new Error('must not query without signed webhook configuration');};assert.equal(await notifyAssistantInvitation({...meta,appSecret:''},'201011111111','teacher','x'.repeat(43)),'blocked');
});

test('Meta message failures never report a sent invitation',async t=>{
 const previous=globalThis.fetch;t.after(()=>{globalThis.fetch=previous;});
 for(const reply of [Response.json({error:{message:'test failure'}},{status:400}),Response.json({})]){
  let calls=0;globalThis.fetch=async()=>++calls===1?Response.json({data:[{name:assistantInvitationTemplate,status:'APPROVED',category:'UTILITY',language:'ar'}]}):reply;
  assert.equal(await notifyAssistantInvitation(meta,'201011111111','teacher','x'.repeat(43)),'failed');
 }
});

test('assistant requests use only their supplied session and preserve actionable authorization errors',async()=>{
 let seen;
 await assert.rejects(assistantRequest('https://test.invalid/api','/data/students',{token:'opaque-test',fetcher:async(url,options)=>{seen={url,options};return Response.json({error:{message:'صلاحياتك اتغيرت'}},{status:403});}}),e=>e.status===403 && e.message==='صلاحياتك اتغيرت');
 assert.equal(seen.options.headers.Authorization,'Bearer opaque-test');assert.equal(seen.options.cache,'no-store');assert.equal(seen.options.method,'GET');
});

test('timed-out writes are never automatically repeated and do not claim the save failed',async()=>{
 let calls=0;
 const fetcher=async(_url,options)=>{calls++;return new Promise((_,reject)=>options.signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError')),{once:true}));};
 await assert.rejects(assistantRequest('https://test.invalid/api','/data/students/create',{body:{name:'test'},timeoutMs:10,fetcher}),/راجع البيانات قبل المحاولة/);
 assert.equal(calls,1);
 await assert.rejects(assistantRequest('https://test.invalid/api','/me',{timeoutMs:10,fetcher}),/حاول مجددًا/);
});

test('offline assistant requests provide a retry instruction',async()=>{
 await assert.rejects(assistantRequest('https://test.invalid/api','/me',{fetcher:async()=>{throw new TypeError('Failed to fetch');}}),/تأكد من الإنترنت/);
});

test('team invitation status distinguishes active recovery, expiration, cancellation and blocked delivery',()=>{
 const now=Date.parse('2026-11-01T12:00:00Z');
 const assistant={access:{},status:'active',invitation:{delivery_status:'sent',expires_at:'2026-11-02T12:00:00Z'}};
 assert.match(assistantInvitationStatus(assistant,now),/حساب نشط.*دعوة استعادة مرسلة/);
 assert.match(assistantInvitationStatus({...assistant,invitation:{...assistant.invitation,expires_at:'2026-10-31T12:00:00Z'}},now),/الدعوة انتهت/);
 assert.match(assistantInvitationStatus({...assistant,invitation:{...assistant.invitation,revoked_at:'2026-11-01T10:00:00Z'}},now),/الدعوة السابقة ملغاة/);
 assert.match(assistantInvitationStatus({...assistant,status:'invited',invitation:{...assistant.invitation,delivery_status:'blocked'}},now),/بانتظار اعتماد رسالة واتساب/);
 assert.equal(assistantInvitationStatus({...assistant,invitation:{...assistant.invitation,accepted_at:'2026-11-01T10:00:00Z'}},now),'حساب مستقل');
 assert.equal(assistantInvitationStatus({...assistant,status:'inactive'},now),'الوصول متوقف');
});
