import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: Akedly OTP maps private transactions to current invitation, limits attempts and gates account creation',{timeout:180000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID(),origin='https://centerly-eg.com';
 const {config}=await import('../dist/shared/config/index.js'),{akedlyGateway}=await import('../dist/shared/utils/akedlyOtp.js'),{familyHash,familyToken}=await import('../dist/shared/utils/parentFamily.js');
 const before={...config.phoneOtp},gateway={...akedlyGateway};Object.assign(config.phoneOtp,{provider:'akedly',apiKey:'isolated-fake',pipelineId:'a'.repeat(24),dailyLimit:50});let server;
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{Object.assign(config.phoneOtp,before);Object.assign(akedlyGateway,gateway);if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}ok(await db.from('tenants').delete().eq('id',tenant));});
 ok(await db.from('tenants').insert({id:tenant,name:'isolated Akedly teacher'}));
 const nonce=familyToken(),phone='2010'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');
 const invite=ok(await db.rpc('assistant_invite',{p_tenant:tenant,p_assistant:null,p_teacher:null,p_phone:phone,p_nonce_hash:familyHash(nonce),p_permissions:{},p_all_groups:false,p_group_ids:[],p_pay:{salary_model:'monthly',salary:100,pay_start_date:'2026-11-01'}}));
 let code,transaction,verifies=0,sends=0;
 akedlyGateway.challenge=async()=>({challengeRequired:false,turnstile:{required:false}});
 akedlyGateway.send=async(p,c)=>{assert.equal(p,phone);code=c;sends++;transaction='isolated-tx-'+randomUUID();return {transactionReqID:'isolated-request-'+sends,transactionID:transaction,channels:['sms'],expiresAt:new Date(Date.now()+180000).toISOString()};};
 akedlyGateway.verify=async(request,c)=>{verifies++;assert.equal(request,'isolated-request-'+sends);if(c!==code)throw Object.assign(new Error('wrong'),{status:400});return {verified:true,transactionID:transaction};};
 const {app}=await import('../dist/app.js');server=app.listen(0);await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/assistant-access`;
 // Persistent IP buckets survive CI runs; each fixture needs its own client IP.
 // trust proxy=1 makes this the client identity while transport remains localhost.
 const clientIp=`198.${18+randomBytes(1)[0]%2}.${randomBytes(1)[0]}.${randomBytes(1)[0]}`;
 const request=(path,body,requestOrigin=origin)=>fetch(base+path,{method:'POST',headers:{Origin:requestOrigin,'Content-Type':'application/json','X-Forwarded-For':clientIp},body:JSON.stringify(body)});
 const info=await (await request('/registration/info',{invitation:nonce})).json();assert.equal(info.otp_channel,'sms');assert.equal(info.phone,phone);
 const proof=await (await request('/registration/challenge',{invitation:nonce})).json();
 assert.equal((await request('/registration/request',{invitation:nonce,phone:'201122222222',proof:{context:proof.context}})).status,400);
 assert.equal((await request('/registration/request',{invitation:nonce,proof:{context:proof.context}},'https://other.centerly-eg.com')).status,400);assert.equal(sends,0);
 const sent=await request('/registration/request',{invitation:nonce,proof:{context:proof.context}});assert.equal(sent.status,200,await sent.clone().text());const local=await sent.json();assert.equal(sends,1);assert.equal(local.delivery,'accepted');assert.ok(!JSON.stringify(local).includes('isolated-request'));assert.ok(!JSON.stringify(local).includes(code));
 assert.equal((await request('/registration/request',{invitation:nonce,proof:{context:proof.context}})).status,429);assert.equal(sends,1,'concurrent/resend guard runs before provider');
 for(let i=0;i<5;i++)assert.equal((await request('/registration/verify',{invitation:nonce,challenge_id:local.challenge_id,code:code==='000000'?'111111':'000000'})).status,i===4?429:400);
 assert.equal((await request('/registration/verify',{invitation:nonce,challenge_id:local.challenge_id,code})).status,429);assert.equal(verifies,5,'local cap prevents extra provider verifications');
 ok(await db.from('assistant_phone_verifications').update({requested_at:new Date(Date.now()-61000).toISOString()}).eq('invitation_id',invite.invitation_id));
 const freshProof=await (await request('/registration/challenge',{invitation:nonce})).json();const resend=await request('/registration/request',{invitation:nonce,proof:{context:freshProof.context}});assert.equal(resend.status,200,await resend.clone().text());const fresh=await resend.json();
 assert.equal((await request('/registration/verify',{invitation:nonce,challenge_id:local.challenge_id,code})).status,410);assert.equal(verifies,5,'old challenge cannot call provider after resend');
 const verify=await request('/registration/verify',{invitation:nonce,challenge_id:fresh.challenge_id,code});assert.equal(verify.status,200,await verify.clone().text());const claim=await verify.json();assert.equal(claim.phone,phone);
 const accepted=await request('/accept',{ticket:claim.ticket,name:'isolated SMS assistant',password:'isolated-sms-password-2026'});assert.equal(accepted.status,200,await accepted.clone().text());assert.equal((await accepted.json()).workspace,tenant);
 assert.equal((await request('/registration/verify',{invitation:nonce,challenge_id:fresh.challenge_id,code})).status,410);
 assert.equal((await anonClient.from('phone_otp_provider_attempts').select('*')).error?.code,'42501');
 assert.equal((await anonClient.rpc('phone_otp_provider_attempt',{p_challenge:fresh.challenge_id,p_purpose:'assistant',p_subject:familyHash(nonce),p_origin:origin,p_phone:phone,p_action:'check',p_data:{}})).error?.code,'42501');
});
