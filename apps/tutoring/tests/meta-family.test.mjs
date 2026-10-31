import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
import {once} from 'node:events';
import {config} from '../dist/shared/config/index.js';
import {verifyMetaSignature,configuredMetaFamilyGateway,notifyMetaFamily,processMetaPortalMessage} from '../dist/shared/utils/metaFamily.js';

const secret='isolated-meta-signature-test-not-real',phone='201012345678';
const signature=raw=>'sha256='+createHmac('sha256',secret).update(raw).digest('hex');
const message=(extra={})=>({id:'wamid.fixture',from:phone,timestamp:String(Math.floor(Date.now()/1000)),type:'button',button:{text:'الحصول على اسم المستخدم وكلمه السر',payload:'CENTRLY_FAMILY:own:tenant'},...extra});
function fixture(records=[{id:'own',tenant_id:'tenant',name:'ابن',parent_match:true}]){
 const buckets=new Map(),calls=[],inbox=[];let saved;
 const db={rpc:async(name,args)=>{
  calls.push({name,args});
  if(name==='parent_family_limit'){const n=(buckets.get(args.p_key)||0)+1;buckets.set(args.p_key,n);return {data:n<=args.p_max,error:null};}
  if(name==='meta_portal_phone_records')return {data:records,error:null};
  if(name==='parent_family_delivery'){saved ||= {phone:args.p_phone,password_cipher:args.p_cipher};return {data:saved,error:null};}
  throw Error('Unexpected RPC '+name);
 },from:table=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'own',name:'ابن',parent_phone:phone,student_phone:phone,portal_password:'123456'},error:null})}),maybeSingle:async()=>({data:{subject_title:'الفيزياء'},error:null})})}),insert:async row=>{inbox.push(row);return {error:null};},delete:()=>({eq:async(_key,value)=>{buckets.delete(value);return {error:null};}})})};
 const replies=[],notices=[],gateway={notify:async(...args)=>{notices.push(args);return true;},reply:async(...args)=>{replies.push(args);return true;}};
 return {db,calls,inbox,gateway,replies,notices};
}
test('Meta signature verifies exact raw bytes and rejects forgery, mutation and missing secret',()=>{
 const raw=Buffer.from('{"object":"whatsapp_business_account"}');assert.equal(verifyMetaSignature(raw,signature(raw),secret),true);
 for(const [body,header,key] of [[Buffer.from('{}'),signature(raw),secret],[raw,'sha256='+'0'.repeat(64),secret],[raw,signature(raw),''],[undefined,signature(raw),secret],[raw,'invalid',secret]])assert.equal(verifyMetaSignature(body,header,key),false);
});
test('family notification uses the approved parent template and never provisions or exposes a password',async()=>{
 const f=fixture();const result=await notifyMetaFamily(f.db,'tenant','own','معلم',f.gateway,true);
 assert.equal(result.success,true);assert.equal(f.notices.length,1);assert.equal(f.notices[0][0],phone);assert.deepEqual(f.notices[0][1],['ابن','الفيزياء','معلم']);assert.equal(f.notices[0][2],'CENTRLY_FAMILY:own:tenant');
 assert.deepEqual(f.calls.map(c=>c.name),['parent_family_limit']);assert.equal(f.replies.length,0);assert.ok(!JSON.stringify(result).includes('password'));
 await assert.rejects(()=>notifyMetaFamily(f.db,'tenant','own','معلم',f.gateway,false),e=>e.status===503);
});
test('verified parent reply receives a separate family secret only on the same phone, without inbox secrets',async()=>{
 const f=fixture();await processMetaPortalMessage(f.db,message(),f.gateway);
 assert.equal(f.replies.length,1);assert.equal(f.replies[0][0],phone);assert.match(f.replies[0][1],/كلمة مرور الأسرة: \d{12}/);assert.ok(!f.replies[0][1].includes('123456\n'));
 assert.match(f.replies[0][1],/role=parent&family=1/);assert.ok(!JSON.stringify(f.inbox).includes('كلمة مرور الأسرة:'));
 await processMetaPortalMessage(f.db,message(),f.gateway);assert.equal(f.replies.length,1,'A duplicate webhook must not resend');
});
test('stale events, wrong recipients and reassigned teacher/student buttons cannot provision a family',async()=>{
 for(const msg of [message({timestamp:String(Math.floor(Date.now()/1000)-1000)}),message({from:'123'}),message({button:{payload:'CENTRLY_FAMILY:foreign:other',text:'كلمة السر'}})]){
  const f=fixture();await processMetaPortalMessage(f.db,msg,f.gateway);assert.equal(f.replies.length,0);assert.ok(!f.calls.some(c=>c.name==='parent_family_delivery'));
 }
});
test('student-only replies remain student-scoped and ambiguous student records reveal no PIN',async()=>{
 for(const count of [1,2]){
  const f=fixture(Array.from({length:count},(_,i)=>({id:'student'+i,tenant_id:'tenant'+i,name:'طالب',student_match:true,parent_match:false})));
  await processMetaPortalMessage(f.db,message({button:{text:'الحصول على اسم المستخدم وكلمه السر',payload:'GET_CREDENTIALS'}}),f.gateway);
  assert.equal(f.replies.length,1);assert.ok(!f.calls.some(c=>c.name==='parent_family_delivery'));
  assert.equal(f.replies[0][1].includes('123456'),count===1);assert.ok(!f.replies[0][1].includes('family=1'));
 }
});
test('Meta transport sends a quick reply payload; provider failures cannot report sent',async()=>{
 const original=globalThis.fetch,token=config.meta.accessToken;config.meta.accessToken='isolated-token';const captured=[];
 try{globalThis.fetch=async(url,options)=>{captured.push(JSON.parse(options.body));return {ok:true,json:async()=>({messages:[{id:'wamid.fixture'}]})};};
  const gateway=configuredMetaFamilyGateway();assert.equal(await gateway.notify(phone,['ابن','مادة','معلم'],'CENTRLY_FAMILY:id:tenant'),true);
  assert.equal(captured[0].template.name,'centerly_student');assert.equal(captured[0].template.components[1].parameters[0].payload,'CENTRLY_FAMILY:id:tenant');
  globalThis.fetch=async()=>({ok:false,json:async()=>({error:{message:'private provider detail'}})});assert.equal(await gateway.reply(phone,'fixture response'),false);
 }finally{globalThis.fetch=original;config.meta.accessToken=token;}
});
test('all webhook aliases reject forged requests before processing and accept signed status events',{timeout:20000},async()=>{
 const original=config.meta.appSecret;config.meta.appSecret=secret;
 const {createApp}=await import('../dist/app.js');const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 try{const base=`http://127.0.0.1:${server.address().port}`;
  const body=JSON.stringify({object:'whatsapp_business_account',entry:[{id:config.meta.wabaId,changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:config.meta.phoneNumberId},statuses:[]}}]}]});
  for(const route of ['/meta/webhook','/api/meta/webhook','/api/public/meta/webhook']){
   const send=header=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':header},body});
   assert.equal((await send('sha256='+'0'.repeat(64))).status,401);assert.equal((await send(signature(Buffer.from(body)))).status,200);
  }
  config.meta.appSecret='';assert.equal((await fetch(base+'/meta/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
 }finally{config.meta.appSecret=original;server.closeAllConnections();await new Promise(r=>server.close(r));}
});
