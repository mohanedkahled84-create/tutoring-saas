import test from 'node:test';
import assert from 'node:assert/strict';
import {createAnnouncementWorker,processAnnouncementWebhook} from '../dist/features/announcements/worker.js';
import {announcementTemplateSeeds} from '../dist/features/announcements/catalog.js';
const template=announcementTemplateSeeds[0];
const job={attempt_id:'fixture-attempt',to:'201000000000',template,parameters:template.fields.map(()=> 'fixture')};
test('worker sends once during overlapping ticks and settles the exact approved contract without logging private payloads',async()=>{
 const calls=[],sent=[];let waiting;
 const db={rpc:async(name,args)=>{calls.push([name,args]);return {data:args.p_action==='claim' && calls.length===1?job:null};}};
 const gateway={sendTemplate:async value=>{sent.push(value);await new Promise(resolve=>waiting=resolve);return {outcome:'accepted',messageId:'wamid.fixture'};}};
 const worker=createAnnouncementWorker(db,gateway),first=worker.tick();await new Promise(r=>setTimeout(r,0));await worker.tick();assert.equal(sent.length,1);waiting();await first;
 assert.deepEqual(sent[0].expected,{id:template.id,body:template.body,parameterCount:template.fields.length});assert.equal(sent[0].languageCode,'ar');
 const settle=calls.find(([,args])=>args.p_action==='settle')[1];assert.equal(settle.p_data.message_id,'wamid.fixture');assert.equal(settle.p_data.attempt_id,job.attempt_id);
 worker.stop();await worker.tick();assert.equal(sent.length,1);
});
test('transport exceptions and a failed persistence acknowledgement never trigger a second send',async()=>{
 let sends=0,claims=0,errors=0;const settlements=[];
 const worker=createAnnouncementWorker({rpc:async(_name,args)=>{if(args.p_action==='claim')return {data:++claims===1?job:null};settlements.push(args.p_data);return {error:{message:'fixture persistence failure'}};}},{sendTemplate:async()=>{sends++;throw Error('fixture transport timeout');}},()=>errors++);
 await worker.tick();assert.equal(sends,1);assert.equal(errors,1);assert.equal(settlements[0].outcome,'unknown');
});
test('malformed template snapshots are rejected before reaching the provider',async()=>{
 let sends=0,claims=0,settlement;
 await createAnnouncementWorker({rpc:async(_name,args)=>{if(args.p_action==='claim')return {data:++claims===1?{...job,template:{...template,id:null}}:null};settlement=args.p_data;return {data:{}};}},{sendTemplate:async()=>{sends++;}}).tick();
 assert.equal(sends,0);assert.equal(settlement.outcome,'not_sent');
});
test('signed webhook processing matches delivery message IDs and accepts only explicit opt-out or opt-in text',async()=>{
 const calls=[],db={rpc:async(name,args)=>{calls.push([name,args]);return {data:{}};}};
 await processAnnouncementWebhook(db,{statuses:[{id:'wamid.fixture',status:'delivered'},{id:'wrong-id',status:'read'}],messages:[{id:'wamid.stop',from:'201000000000',timestamp:'1793664000',text:{body:'إيقاف التنبيهات'}},{id:'wamid.hello',from:'201000000000',timestamp:'1793664000',text:{body:'مرحبًا'}}]});
 assert.equal(calls.length,2);assert.equal(calls[0][1].p_data.message_id,'wamid.fixture');assert.equal(calls[1][1].p_blocked,true);
});
