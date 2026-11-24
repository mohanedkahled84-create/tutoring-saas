import test from 'node:test';
import assert from 'node:assert/strict';
import {studentEmailHash,sendStudentEmail} from '../dist/shared/routes/studentEmail.js';
import {createAnnouncementEmailWorker} from '../dist/features/announcements/emailWorker.js';
import {config} from '../dist/shared/config/index.js';

test('student email hashes bind the code to the tenant, student and challenge',t=>{
 const old=config.internalApiSecret;config.internalApiSecret='isolated-test-secret-'.repeat(3);t.after(()=>config.internalApiSecret=old);
 const hash=studentEmailHash('tenant','student','challenge','123456');
 for(const args of [['other','student','challenge','123456'],['tenant','other','challenge','123456'],['tenant','student','other','123456'],['tenant','student','challenge','654321']])assert.notEqual(studentEmailHash(...args),hash);
 assert.match(hash,/^[a-f0-9]{64}$/);
});
test('email delivery needs a real provider acknowledgment, never a missing-key mock',async t=>{
 const oldKey=config.resendApiKey,oldFetch=global.fetch;t.after(()=>{config.resendApiKey=oldKey;global.fetch=oldFetch;});
 config.resendApiKey='';await assert.rejects(sendStudentEmail('fixture@isolated.invalid','Fixture','Body'));
 config.resendApiKey='test-key';let options;
 global.fetch=async(_url,input)=>{options=input;return Response.json({id:'provider-id'});};
 assert.equal(await sendStudentEmail('fixture@isolated.invalid','Fixture','Body','unique-job'),'provider-id');assert.equal(options.headers['Idempotency-Key'],'unique-job');
 global.fetch=async()=>Response.json({error:'failure'},{status:503});await assert.rejects(sendStudentEmail('fixture@isolated.invalid','Fixture','Body'));
});
test('email worker does not repeat a send when settlement fails after provider acceptance',async t=>{
 const oldKey=config.resendApiKey,oldFetch=global.fetch;t.after(()=>{config.resendApiKey=oldKey;global.fetch=oldFetch;});config.resendApiKey='test-key';let sends=0,claimed=false,errors=0;
 global.fetch=async()=>{sends++;return Response.json({id:'provider-id'});};
 const db={rpc:async(name,args)=>{
  if(name==='portal_tenant_context')return {data:{},error:null};
  if(args.p_action==='claim'){if(claimed)return {data:null,error:null};claimed=true;return {data:{id:'job',tenant_id:'tenant',email:'fixture@isolated.invalid',title:'Class update'},error:null};}
  return {data:null,error:new Error('Settlement failed')};
 }};
 const worker=createAnnouncementEmailWorker(db,()=>errors++);await worker.tick();await worker.tick();assert.equal(sends,1);assert.equal(errors,1);worker.stop();
});
