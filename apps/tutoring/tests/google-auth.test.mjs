import test from 'node:test';
import assert from 'node:assert/strict';
import {once} from 'node:events';
import express from 'express';
import {googleAuthGateway,googleAuthRouter,googleOrigin,googleProfileInput} from '../dist/features/auth/google.js';
import {supabasePublic} from '../dist/supabase.js';
import {renderGoogleProfile} from '../../web/src/services/googleAuth.js';
import {readFile} from 'node:fs/promises';

test('Google profile requires basic teaching fields, consent and a valid normalized phone; clients cannot choose roles or tenants',()=>{
 const body={full_name:' مدرس الاختبار ',phone:'+20 1012345678',subject:' الفيزياء ',education_stages:['preparatory','secondary'],terms_accepted:true};
 assert.equal(googleProfileInput.parse(body).phone,'01012345678');assert.equal(googleProfileInput.parse(body).subject,'الفيزياء');
 for(const change of [{role:'admin'},{tenant_id:'other'},{terms_accepted:false},{education_stages:[]},{education_stages:['other']},{subject:''},{phone:'123'}])assert.equal(googleProfileInput.safeParse({...body,...change}).success,false);
 assert.equal(googleProfileInput.parse({...body,education_stages:['other'],other_stage:'جامعي'}).other_stage,'جامعي');
 for(const origin of ['https://evil.example','https://centerly-eg.com.evil.example','https://teacher.centerly-eg.com',undefined])assert.throws(()=>googleOrigin(origin));
 assert.equal(googleOrigin('https://centerly-eg.com'),'https://centerly-eg.com');
});

test('Google identity checks use verified Auth user/identities, never user metadata',async t=>{
 const user={id:'user',email:'fixture@isolated.invalid',email_confirmed_at:new Date().toISOString(),user_metadata:{provider:'google',email_verified:true,role:'admin'},identities:[{provider:'email'}]};
 const mock=t.mock.method(supabasePublic.auth,'getUser',async()=>({data:{user},error:null}));
 await assert.rejects(googleAuthGateway.user('fixture-token'),e=>e.status===401);
 user.identities=[{provider:'google'}];assert.equal((await googleAuthGateway.user('fixture-token')).id,'user');
 user.email_confirmed_at=null;await assert.rejects(googleAuthGateway.user('fixture-token'),e=>e.status===401);
 mock.mock.restore();
});

test('Google HTTP exchange binds PKCE/origin and uses the verified identity; no provider tokens or client role claims escape',async t=>{
 const before={...googleAuthGateway},calls=[];let enabled=true;
 Object.assign(googleAuthGateway,{settings:async()=>enabled,exchange:async(code,verifier)=>{calls.push({code,verifier});return {access_token:'fixture-access-token-google',refresh_token:'fixture-refresh-token-google',expires_in:3600,provider_token:'must-never-escape'};},user:async token=>{assert.equal(token,'fixture-access-token-google');return {id:'verified-user'};},profile:async(id,input)=>{calls.push({id,input});return {requires_profile:!input,user:input?{id,role:'owner'}:null};}});
 const app=express();app.use(express.json());app.use('/google',googleAuthRouter);const server=app.listen(0);await once(server,'listening');
 t.after(async()=>{Object.assign(googleAuthGateway,before);server.closeAllConnections();await new Promise(r=>server.close(r));});
 const base=`http://127.0.0.1:${server.address().port}/google`,request=(path,body,origin='https://centerly-eg.com',token)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body)});
 const challenge='c'.repeat(43),verifier='v'.repeat(86);
 const start=await request('/start',{challenge});assert.equal(start.status,200);assert.match(start.headers.get('cache-control'),/no-store/);const url=new URL((await start.json()).url);
 assert.equal(url.searchParams.get('provider'),'google');assert.equal(url.searchParams.get('code_challenge'),challenge);assert.equal(url.searchParams.get('code_challenge_method'),'s256');assert.equal(url.searchParams.get('redirect_to'),'https://centerly-eg.com/auth/google/callback');
 assert.equal((await request('/start',{challenge},'https://evil.example')).status,403);
 assert.equal((await request('/start',{challenge,redirect_to:'https://evil.example'})).status,400);
 enabled=false;assert.equal((await request('/start',{challenge})).status,503);enabled=true;
 assert.equal((await request('/exchange',{code:'auth-code-fixture',verifier:'wrong'})).status,400);
 const exchange=await request('/exchange',{code:'auth-code-fixture',verifier});assert.equal(exchange.status,200);const result=await exchange.json();assert.equal(JSON.stringify(result).includes('must-never-escape'),false);assert.equal(result.profile.requires_profile,true);assert.equal(calls.at(-1).id,'verified-user');
 const profile={full_name:'مدرس الاختبار',phone:'01012345678',subject:'الفيزياء',education_stages:['secondary'],terms_accepted:true};
 assert.equal((await request('/complete',profile)).status,401);
 assert.equal((await request('/complete',{...profile,tenant_id:'foreign'},undefined,'fixture-access-token-google')).status,400);
 const completed=await request('/complete',profile,undefined,'fixture-access-token-google');assert.equal(completed.status,200);assert.equal((await completed.json()).profile.user.id,'verified-user');assert.equal(calls.at(-1).id,'verified-user');assert.equal(calls.at(-1).input.phone,'01012345678');
});

test('Google completion form escapes profile data and keeps OAuth codes away from analytics/referrers',async()=>{
 const html=renderGoogleProfile({email:'teacher@isolated.invalid',full_name:'<script>bad()</script>',education_stages:['secondary']});
 assert.ok(html.includes('&lt;script&gt;'));assert.ok(!html.includes('<script>'));assert.ok(html.includes('name="phone"'));assert.ok(html.includes('name="subject"'));assert.ok(html.includes('name="terms_accepted"'));assert.ok(!html.includes('name="password"'));
 const callback=await readFile(new URL('../../web/google-callback.html',import.meta.url),'utf8');
 assert.ok(callback.includes('content="no-referrer"'));assert.ok(callback.indexOf('history.replaceState')<callback.indexOf('<link'));
 assert.ok(!/googletagmanager|gtag\(/.test(callback));
});
