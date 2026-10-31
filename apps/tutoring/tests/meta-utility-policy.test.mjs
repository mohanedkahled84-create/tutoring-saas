import test from 'node:test';
import assert from 'node:assert/strict';
import {HttpMetaCloudGateway} from '../dist/features/whatsapp-notifications/meta-cloud.gateway.js';

test('central Meta queue sends only live approved UTILITY templates and never trusts a stale classification',async()=>{
 const original=globalThis.fetch,gateway=new HttpMetaCloudGateway('fixture-phone','fixture-token','fixture-waba');
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
