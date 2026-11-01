import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {config} from '../dist/shared/config/index.js';
import {signSmsContext,readSmsContext,smsProof,akedlyGateway} from '../dist/shared/utils/akedlyOtp.js';
import {preparePhoneOtp,requestPhoneOtp,verifyPhoneOtp,phoneOtpHash} from '../dist/shared/utils/phoneOtp.js';
import {redactPhoneAuthTelemetry} from '../dist/shared/utils/phoneAuthRedaction.js';

const scope={subject:'private-invitation-hash',origin:'https://centerly-eg.com'},phone='201123671177',purpose='assistant';
function setup(t){const old={...config.phoneOtp},key=config.internalApiSecret;Object.assign(config.phoneOtp,{provider:'akedly',apiKey:'test-only-credential',pipelineId:'a'.repeat(24),dailyLimit:3});config.internalApiSecret='test-only-context-key-'.repeat(3);t.after(()=>{Object.assign(config.phoneOtp,old);config.internalApiSecret=key;});}
test('signed bot proof is bound to phone, invitation, role, origin, pipeline and expiry',t=>{
 setup(t);const value={...scope,phone,purpose,pipeline:config.phoneOtp.pipelineId,expires:Date.now()+60000},token=signSmsContext(value);
 assert.equal(readSmsContext(token,{...scope,phone,purpose}).phone,phone);
 for(const change of [{phone:'201000000000'},{purpose:'teacher'},{subject:'other-invite'},{origin:'https://other.centerly-eg.com'}])assert.throws(()=>readSmsContext(token,{...scope,phone,purpose,...change}));
 assert.throws(()=>readSmsContext(token+'.extra',{...scope,phone,purpose}));assert.throws(()=>readSmsContext(signSmsContext({...value,expires:Date.now()-1}),{...scope,phone,purpose}));
 assert.throws(()=>smsProof.parse({context:token,nonce:1,phone}));
});
test('provider requests keep keys server-side, use stored phone/custom six-digit OTP, and forward client IP',async t=>{
 setup(t);const original=global.fetch;t.after(()=>global.fetch=original);const calls=[];
 global.fetch=async(url,options)=>{calls.push({url,options});return Response.json({status:'success',data:{verified:true,transactionID:'tx'}});};
 await akedlyGateway.send(phone,'012345',{challengeRequired:true,challengeToken:'proof-token',nonce:123},'203.0.113.1');
 const body=JSON.parse(calls[0].options.body);assert.equal(body.APIKey,'test-only-credential');assert.equal(body.verificationAddress.phoneNumber,'+'+phone);assert.equal(body.otp,'012345');assert.equal(body.digits,6);assert.equal(body.otpLanguage,'en');assert.equal(body.verificationAddress.email,undefined);assert.equal(body.channel,'sms');assert.equal(calls[0].options.headers['x-end-user-ip'],'203.0.113.1');
 await akedlyGateway.verify('server-stored-request','012345');assert.deepEqual(JSON.parse(calls[1].options.body),{transactionReqID:'server-stored-request',otp:'012345'});
});
test('provider errors, redirects/timeouts, dev-mode challenges and unverified success never imply phone proof',async t=>{
 setup(t);const original=global.fetch;t.after(()=>global.fetch=original);let calls=0;
 for(const data of [{status:'error',code:'INVALID_OTP'},{status:'success',data:{devMode:true}},{status:'success',data:{isTest:true}},{status:'success'}]){global.fetch=async()=>{calls++;return Response.json(data);};await assert.rejects(akedlyGateway.challenge());}
 global.fetch=async()=>{calls++;throw new Error('timeout contains test-only-credential');};await assert.rejects(akedlyGateway.challenge(),e=>e.status===503 && !e.message.includes('credential'));assert.equal(calls,5,'no automatic retry');
});
test('challenge returns only public proof; send requires a valid bound context and persists provider identity privately',async t=>{
 setup(t);const before={...akedlyGateway};t.after(()=>Object.assign(akedlyGateway,before));akedlyGateway.challenge=async()=>({challengeRequired:false,turnstile:{required:false}});
 const rpcCalls=[],db={rpc:async(name,args)=>{rpcCalls.push({name,args});return {data:true,error:null};}};let current,code;
 const operation=async(action,data)=>{if(action==='request')current=data;return {phone};};
 const prepared=await preparePhoneOtp(db,purpose,'ip',operation,scope);assert.ok(prepared.context);assert.ok(!JSON.stringify(prepared).includes('test-only-credential'));
 await assert.rejects(requestPhoneOtp(db,purpose,'ip',operation,scope,{context:prepared.context.replace(/.$/,'!')}));
 akedlyGateway.send=async(p,c)=>{assert.equal(p,phone);code=c;return {transactionReqID:'provider-request',transactionID:'provider-tx',channels:['sms'],expiresAt:new Date(Date.now()+180000).toISOString()};};
 const result=await requestPhoneOtp(db,purpose,'ip',operation,scope,{context:prepared.context});assert.match(code,/^\d{6}$/);assert.equal(current.code_hash,phoneOtpHash(purpose,result.challenge_id,code));assert.equal(result.delivery,'accepted');assert.ok(result.expires_in<=180);assert.equal(result.code,undefined);assert.equal(result.transactionReqID,undefined);assert.equal(result.request_id,undefined);
 assert.ok(rpcCalls.some(c=>c.name==='phone_otp_provider_attempt' && c.args.p_action==='sent' && c.args.p_data.request_id==='provider-request'));
});
test('local verification needs successful provider verification of the stored transaction; false response cannot activate',async t=>{
 setup(t);const old=akedlyGateway.verify;t.after(()=>akedlyGateway.verify=old);const challenge=randomUUID(),code='123456';let activated=0;
 const db={rpc:async()=>({data:{request_id:'stored-request',transaction_id:'stored-tx'},error:null})};
 const operation=async(action,data)=>{if(action==='info')return {phone};if(action==='verify'){activated++;return {success:true};}throw Error('unexpected');};
 for(const result of [{verified:false,transactionID:'stored-tx'},{verified:true,transactionID:'other-tx'},{}]){akedlyGateway.verify=async()=>result;await assert.rejects(verifyPhoneOtp(db,purpose,operation,scope,challenge,code));assert.equal(activated,0);}
 akedlyGateway.verify=async(request,c)=>{assert.equal(request,'stored-request');assert.equal(c,code);return {verified:true,transactionID:'stored-tx'};};
 assert.equal((await verifyPhoneOtp(db,purpose,operation,scope,challenge,code)).success,true);assert.equal(activated,1);
});
test('provider rejection never supplies the entered valid local hash to the acceptance RPC',async t=>{
 setup(t);const old=akedlyGateway.verify;t.after(()=>akedlyGateway.verify=old);const id=randomUUID(),code='123456';akedlyGateway.verify=async()=>{throw Object.assign(new Error('wrong'),{status:400});};
 const db={rpc:async()=>({data:{request_id:'request',transaction_id:'tx'},error:null})};let rejectedHash;
 await assert.rejects(verifyPhoneOtp(db,purpose,async(action,data)=>{if(action==='info')return {phone};rejectedHash=data.code_hash;return {error:'INVALID_CODE'};},scope,id,code));assert.notEqual(rejectedHash,phoneOtpHash(purpose,id,code));
});
test('OTP telemetry strips credentials in URLs, codes and account setup tokens',()=>{
 const result=redactPhoneAuthTelemetry({breadcrumbs:[{data:{url:'https://api.akedly.io/challenge?APIKey=my-secret&pipelineID=public'}}],request:{data:{code:'123456',otp:'123456',password:'private',invitation:'private-nonce',proof:{context:'private-context'}}}});
 const raw=JSON.stringify(result);for(const value of ['my-secret','123456','private-nonce','private-context'])assert.ok(!raw.includes(value));assert.ok(raw.includes('pipelineID=public'));
 const body=JSON.stringify({code:'123456',proof:{context:'signed-private-context'},APIKey:'secret'});
 const encoded=redactPhoneAuthTelemetry({request:{data:body}});assert.ok(!JSON.stringify(encoded).includes('123456'));assert.ok(!JSON.stringify(encoded).includes('signed-private-context'));assert.ok(!JSON.stringify(encoded).includes('secret'));
});
