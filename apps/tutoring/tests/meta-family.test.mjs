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
  if(name==='portal_tenant_context')return {data:{platform:{subdomain:'teacher',is_active:true},bound_subdomain:'teacher'},error:null};
  if(name==='parent_family_delivery'){saved ||= {phone:args.p_phone,password_cipher:args.p_cipher};return {data:saved,error:null};}
  throw Error('Unexpected RPC '+name);
 },from:table=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'own',name:'ابن',parent_phone:phone,student_phone:phone,portal_password:'123456'},error:null})}),maybeSingle:async()=>({data:{subject_title:'الفيزياء'},error:null})})}),insert:async row=>{inbox.push(row);return {error:null};},delete:()=>({eq:async(_key,value)=>{buckets.delete(value);return {error:null};}})})};
 const replies=[],notices=[],gateway={notify:async(...args)=>{notices.push(args);return true;},reply:async(...args)=>{replies.push(args);return true;}};
 return {db,calls,inbox,gateway,replies,notices};
}
test('Meta signature verifies exact raw bytes and rejects forgery, mutation and missing secret',()=>{
 const raw=Buffer.from('{"object":"whatsapp_business_account"}');assert.equal(verifyMetaSignature(raw,signature(raw),secret),true);
 for(const [body,header,key] of [[Buffer.from('{}'),signature(raw),secret],[raw,'sha256='+'0'.repeat(64),secret],[raw,signature(raw),''],[raw,signature(raw),'short'],[undefined,signature(raw),secret],[raw,'invalid',secret]])assert.equal(verifyMetaSignature(body,header,key),false);
});
test('family notification uses the approved parent template and never provisions or exposes a password',async()=>{
 const f=fixture();const result=await notifyMetaFamily(f.db,'tenant','own','معلم',f.gateway,true);
 assert.equal(result.success,true);assert.equal(f.notices.length,1);assert.equal(f.notices[0][0],phone);assert.deepEqual(f.notices[0][1],['ابن','معلم','https://teacher.centerly-eg.com/family']);assert.equal(f.notices[0][2],'CENTRLY_FAMILY:own:tenant');
 assert.ok(!f.calls.some(c=>c.name==='parent_family_delivery'));assert.equal(f.replies.length,0);assert.ok(!JSON.stringify(result).includes('password'));
 await assert.rejects(()=>notifyMetaFamily(f.db,'tenant','own','معلم',f.gateway,false),e=>e.status===503);
});
test('verified parent reply receives a separate family secret only on the same phone, without inbox secrets',async()=>{
 const f=fixture();await processMetaPortalMessage(f.db,message(),f.gateway);
 assert.equal(f.replies.length,1);assert.equal(f.replies[0][0],phone);assert.match(f.replies[0][1],/كلمة مرور الأسرة: \d{12}/);assert.ok(!f.replies[0][1].includes('123456\n'));
 assert.match(f.replies[0][1],/https:\/\/teacher.centerly-eg.com\/family/);assert.ok(!JSON.stringify(f.inbox).includes('كلمة مرور الأسرة:'));
 await processMetaPortalMessage(f.db,message(),f.gateway);assert.equal(f.replies.length,1,'A duplicate webhook must not resend');
});
test('family notices list siblings only at the sending teacher and resolve current publication on each send',async()=>{
 const f=fixture([{id:'own',tenant_id:'tenant',name:'أحمد',parent_match:true},{id:'sibling',tenant_id:'tenant',name:'منى',parent_match:true},{id:'other',tenant_id:'foreign',name:'اسم خاص بمعلم آخر',parent_match:true},{id:'student',tenant_id:'tenant',name:'طالب فقط',parent_match:false}]);
 await notifyMetaFamily(f.db,'tenant','own','معلم',f.gateway,true);
 assert.deepEqual(f.notices[0][1],['أحمد، منى','معلم','https://teacher.centerly-eg.com/family']);
 const rpc=f.db.rpc;f.db.rpc=async(name,args)=>name==='portal_tenant_context'?{data:{platform:{subdomain:'renamed',is_active:true},bound_subdomain:'renamed'},error:null}:rpc(name,args);
 await notifyMetaFamily(f.db,'tenant','own','معلم',f.gateway,true);assert.equal(f.notices[1][1][2],'https://renamed.centerly-eg.com/family');
 f.db.rpc=async(name,args)=>name==='portal_tenant_context'?{data:{platform:{subdomain:'renamed',is_active:true},bound_subdomain:'foreign'},error:null}:rpc(name,args);
 await notifyMetaFamily(f.db,'tenant','own','معلم',f.gateway,true);assert.equal(f.notices[2][1][2],'https://centerly-eg.com/family');
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
test('delayed ordinary messages remain in the inbox without assigning an ambiguous family to a random teacher',async()=>{
 const f=fixture([{id:'one',tenant_id:'teacher-one',parent_match:true},{id:'two',tenant_id:'teacher-two',parent_match:true}]);
 await processMetaPortalMessage(f.db,message({type:'text',button:undefined,text:{body:'السلام عليكم'},timestamp:String(Math.floor(Date.now()/1000)-3600)}),f.gateway);
 assert.equal(f.replies.length,0);assert.equal(f.inbox.length,1);assert.equal(f.inbox[0].message_body,'السلام عليكم');assert.equal(f.inbox[0].tenant_id,null);assert.equal(f.inbox[0].student_id,null);
 assert.ok(!f.calls.some(c=>c.name==='parent_family_delivery'));
});
test('Meta transport sends a quick reply payload; provider failures cannot report sent',async()=>{
 const original=globalThis.fetch,token=config.meta.accessToken;config.meta.accessToken='isolated-token';const captured=[];
 try{globalThis.fetch=async(url,options)=>{if(!options.body)return {ok:true,json:async()=>({data:[{name:'centerly_family_followup_v1',status:'APPROVED',language:'ar'}]})};captured.push(JSON.parse(options.body));return {ok:true,json:async()=>({messages:[{id:'wamid.fixture'}]})};};
  const gateway=configuredMetaFamilyGateway();assert.equal(await gateway.notify(phone,['ابن','مادة','معلم'],'CENTRLY_FAMILY:id:tenant'),true);
  assert.equal(captured[0].template.name,'centerly_family_followup_v1');assert.equal(captured[0].template.language.code,'ar');assert.equal(captured[0].template.components[1].parameters[0].payload,'CENTRLY_FAMILY:id:tenant');
  globalThis.fetch=async()=>({ok:false,json:async()=>({error:{message:'private provider detail'}})});assert.equal(await gateway.reply(phone,'fixture response'),false);
 }finally{globalThis.fetch=original;config.meta.accessToken=token;}
});
test('Meta review never causes an unapproved template to be sent; the approved fallback still lists siblings',async()=>{
 const original=globalThis.fetch,token=config.meta.accessToken;config.meta.accessToken='isolated-token';let sent;
 try{
  globalThis.fetch=async(_url,options)=>options.body?(sent=JSON.parse(options.body),{ok:true,json:async()=>({messages:[{id:'wamid.fixture'}]})}):{ok:true,json:async()=>({data:[{name:'centerly_family_followup_v1',language:'ar',status:'PENDING'}]})};
  assert.equal(await configuredMetaFamilyGateway().notify(phone,['أحمد، منى','معلم','https://teacher.centerly-eg.com/family'],'CENTRLY_FAMILY:id:tenant'),true);
  assert.equal(sent.template.name,'centerly_student');assert.deepEqual(sent.template.components[0].parameters.map(p=>p.text),['أحمد، منى','متابعة الأبناء','معلم']);
 }finally{globalThis.fetch=original;config.meta.accessToken=token;}
});
test('all webhook aliases reject forged requests before processing and accept signed status events',{timeout:20000},async()=>{
 const original=config.meta.appSecret;config.meta.appSecret=secret;
 const {createApp}=await import('../dist/app.js');const server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 try{const base=`http://127.0.0.1:${server.address().port}`;
  const body=JSON.stringify({object:'whatsapp_business_account',entry:[{id:config.meta.wabaId,changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:config.meta.phoneNumberId},statuses:[]}}]}]});
  for(const route of ['/meta/webhook','/api/meta/webhook','/api/public/meta/webhook','/meta/webhook/']){
   const send=header=>fetch(base+route,{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':header},body});
   assert.equal((await send('sha256='+'0'.repeat(64))).status,401);assert.equal((await send(signature(Buffer.from(body)))).status,200);
  }
  config.meta.appSecret='';assert.equal((await fetch(base+'/meta/webhook',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}'})).status,503);
 }finally{config.meta.appSecret=original;server.closeAllConnections();await new Promise(r=>server.close(r));}
});
