import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {phoneOtpHash,registrationInput,registrationVerify,teacherOtpVerify,phoneOtpGateway,phoneVerificationTemplate,requestPhoneOtp} from '../dist/shared/utils/phoneOtp.js';
import {config} from '../dist/shared/config/index.js';

test('OTP hash binds purpose and challenge; schemas reject replacement phone and normalize Arabic digits',()=>{
 const id=randomUUID(),key='local-test-key-'.repeat(4),hash=phoneOtpHash('assistant',id,'012345',key);
 assert.equal(hash.length,64);assert.notEqual(hash,phoneOtpHash('teacher',id,'012345',key));assert.notEqual(hash,phoneOtpHash('assistant',randomUUID(),'012345',key));assert.throws(()=>phoneOtpHash('assistant',id,'012345','short'));
 assert.equal(registrationVerify.parse({invitation:'x'.repeat(43),challenge_id:id,code:'٠١٢٣٤٥'}).code,'012345');
 assert.throws(()=>registrationInput.parse({invitation:'x'.repeat(43),phone:'201000000000'}));
 assert.throws(()=>teacherOtpVerify.parse({challenge_id:id,code:'012345',user_id:randomUUID()}));
});

test('only approved Arabic Authentication template can send; same OTP in body and copy button; no retries',async t=>{
 const originalFetch=global.fetch,originalMeta={...config.meta};Object.assign(config.meta,{accessToken:'test',wabaId:'fake-waba',phoneNumberId:'fake-phone'});
 t.after(()=>{global.fetch=originalFetch;Object.assign(config.meta,originalMeta);});
 let template={name:phoneVerificationTemplate,status:'APPROVED',language:'ar',category:'AUTHENTICATION'},sends=0,lastPayload,status=200;
 global.fetch=async(url,options)=>{if(String(url).includes('/message_templates'))return new Response(JSON.stringify({data:[template]}),{status:200});sends++;lastPayload=JSON.parse(options.body);return new Response(JSON.stringify(status===200?{messages:[{id:'fake'}]}:{error:{message:'failure'}}),{status});};
 for(const override of [{status:'PENDING'},{category:'UTILITY'},{category:'MARKETING'},{language:'en'},{name:'other'}]){const saved=template;template={...saved,...override};assert.equal(await phoneOtpGateway.send('201011111111','012345'),'failed');template=saved;}
 assert.equal(sends,0);assert.equal(await phoneOtpGateway.send('201011111111','012345'),'sent');assert.equal(sends,1);
 assert.equal(lastPayload.template.components[0].parameters[0].text,'012345');assert.equal(lastPayload.template.components[1].parameters[0].text,'012345');assert.equal(lastPayload.to,'201011111111');
 status=500;assert.equal(await phoneOtpGateway.send('201011111111','012345'),'uncertain');assert.equal(sends,2);
 status=400;assert.equal(await phoneOtpGateway.send('201011111111','012345'),'failed');assert.equal(sends,3);
});

test('template unavailable does not reserve budget or create codes and cannot claim a send',async t=>{
 const ready=phoneOtpGateway.ready;phoneOtpGateway.ready=async()=>false;t.after(()=>phoneOtpGateway.ready=ready);
 let calls=[];
 await assert.rejects(requestPhoneOtp({rpc:async()=>{throw new Error('must not reserve');}},'assistant','ip',async action=>{calls.push(action);return {phone:'201011111111'};}),e=>e.status===503);
 assert.deepEqual(calls,['info']);
});

test('request stores hash only, sends to stored phone and returns no code; uncertain delivery is explicit',async t=>{
 const ready=phoneOtpGateway.ready,send=phoneOtpGateway.send,key=config.internalApiSecret;config.internalApiSecret='local-only-otp-key-'.repeat(3);
 phoneOtpGateway.ready=async()=>true;let captured,stored;
 phoneOtpGateway.send=async(phone,code)=>{captured={phone,code};return 'uncertain';};
 t.after(()=>{phoneOtpGateway.ready=ready;phoneOtpGateway.send=send;config.internalApiSecret=key;});
 const result=await requestPhoneOtp({rpc:async()=>({data:true,error:null})},'assistant','ip',async(action,data)=>{if(action==='request')stored=data;return action==='delivery'?{success:true}:{phone:'201011111111'};});
 assert.equal(captured.phone,'201011111111');assert.match(captured.code,/^\d{6}$/);assert.equal(stored.code_hash,phoneOtpHash('assistant',result.challenge_id,captured.code));assert.equal(stored.code,undefined);assert.equal(result.code,undefined);assert.equal(result.code_hash,undefined);assert.equal(result.delivery,'uncertain');assert.equal(result.expires_in,300);
});
