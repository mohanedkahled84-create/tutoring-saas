import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpMetaCloudGateway} from '../dist/features/whatsapp-notifications/meta-cloud.gateway.js';
import {matchesUtilityTemplate} from '../dist/shared/utils/metaTemplatePolicy.js';

test('announcement templates must retain the exact approved body, identifier and parameter mapping',()=>{
 const expected={id:'template-fixture',body:'موعد حصة {{1}} مع {{2}}',parameterCount:2};
 const options={name:'class_fixture',language:'ar',expected};
 const template={id:expected.id,name:options.name,language:'ar',status:'APPROVED',category:'UTILITY',components:[{type:'BODY',text:'موعد حصة {{1}}\nمع {{2}}'}]};
 assert.equal(matchesUtilityTemplate(template,options),true);
 for(const change of [{id:'different'},{category:'MARKETING'},{status:'PENDING'},{components:[{type:'BODY',text:'موعد حصة {{2}} مع {{1}}'}]},{components:[{type:'BODY',text:'موعد حصة {{1}} مع {{2}} إعلان آخر'}]}])assert.equal(matchesUtilityTemplate({...template,...change},options),false);
 assert.equal(matchesUtilityTemplate(template,{...options,expected:{...expected,parameterCount:3}}),false);
});

test('central Meta queue sends only live approved UTILITY templates and never trusts a stale classification',async()=>{
 const original=globalThis.fetch,gateway=new HttpMetaCloudGateway('fixture-phone','fixture-token','fixture-waba',{reserve:async()=>({allowed:true,id:'fixture-budget'}),settle:async()=>{}});
 let template={name:'centerly',language:'en',status:'APPROVED',category:'UTILITY'},posts=0,reads=0;
 try{
  globalThis.fetch=async(url,options)=>{
   if(options.method==='POST'){posts++;return {ok:true,json:async()=>({messages:[{id:'wamid.fixture'}]})};}
   reads++;assert.match(url,/fields=name,status,language,category/);return {ok:true,json:async()=>({data:[template]})};
  };
  const send=()=>gateway.sendTemplate({to:'201012345678',templateName:'centerly',languageCode:'en',bodyParameters:['طالب']});
  assert.equal((await send()).success,true);assert.equal(posts,1);
  for(const change of [{category:'MARKETING'},{category:'AUTHENTICATION'},{category:undefined},{status:'PENDING'},{name:'different'},{language:'ar'}]){
   template={name:'centerly',language:'en',status:'APPROVED',category:'UTILITY',...change};
   assert.equal((await send()).success,false);assert.equal(posts,1);
  }
  assert.equal(reads,7);
  globalThis.fetch=async()=>{throw Error('Metadata unavailable');};assert.equal((await send()).success,false);assert.equal(posts,1);
  assert.equal((await new HttpMetaCloudGateway('fixture-phone','fixture-token').sendTemplate({to:'201012345678',templateName:'centerly',bodyParameters:[]})).success,false);
 }finally{globalThis.fetch=original;}
});

test('Meta dispatch distinguishes a confirmed rejection from an uncertain network or acknowledgement outcome',async()=>{
 const original=globalThis.fetch,gateway=new HttpMetaCloudGateway('fixture-phone','fixture-token','fixture-waba',{reserve:async()=>({allowed:true,id:'fixture-budget'}),settle:async()=>{}});
 const metadata={data:[{name:'fixture',language:'ar',status:'APPROVED',category:'UTILITY'}]};
 const send=()=>gateway.sendTemplate({to:'201000000000',templateName:'fixture',languageCode:'ar',bodyParameters:[]});
 try{
  globalThis.fetch=async(_url,options)=>options.method==='POST'?{ok:false,status:400,json:async()=>({error:{code:100,message:'fixture rejection'}})}:{ok:true,json:async()=>metadata};
  assert.equal((await send()).outcome,'not_sent');
  globalThis.fetch=async(_url,options)=>options.method==='POST'?{ok:true,status:200,json:async()=>({})}:{ok:true,json:async()=>metadata};
  assert.equal((await send()).outcome,'unknown');
  globalThis.fetch=async(_url,options)=>{if(options.method==='POST')throw Error('fixture timeout');return {ok:true,json:async()=>metadata};};
  assert.equal((await send()).outcome,'unknown');
  globalThis.fetch=async(_url,options)=>options.method==='POST'?{ok:true,status:200,json:async()=>({messages:[{id:'wamid.fixture'}]})}:{ok:true,json:async()=>metadata};
  assert.equal((await send()).outcome,'accepted');
 }finally{globalThis.fetch=original;}
});

test('one-EGP official sending cannot silently charge a foreign destination',async()=>{
 let reservations=0;
 const gateway=new HttpMetaCloudGateway('fixture-phone','fixture-token','fixture-waba',{reserve:async()=>{reservations++;throw Error('must not reserve');},settle:async()=>{}});
 const result=await gateway.sendTemplate({to:'14155550123',templateName:'fixture',bodyParameters:[]});
 assert.equal(result.success,false);assert.equal(result.outcome,'not_sent');assert.equal(reservations,0);
});
