import {createHmac,timingSafeEqual} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {config} from '../config/index.js';
import {familyError,familyPhone,familyHash,familyRpc,deliverFamilyAccess,familyNamesAtTeacher,familyNamesText} from './parentFamily.js';
import {approvedUtilityTemplate} from './metaTemplatePolicy.js';
import {metaTemplateParameters} from './metaTemplateParameters.js';

export interface MetaFamilyGateway {
 notify(phone:string,parameters:string[],payload:string):Promise<boolean>;
 reply(phone:string,text:string):Promise<boolean>;
}
export function metaFamilyReady(){return Boolean(config.meta.accessToken && config.meta.phoneNumberId && config.meta.wabaId && config.meta.appSecret.length>=16);}
export function verifyMetaSignature(raw:unknown,signature:unknown,secret=config.meta.appSecret):boolean {
 if(secret.length<16 || !Buffer.isBuffer(raw) || typeof signature!=='string' || !/^sha256=[a-f0-9]{64}$/i.test(signature))return false;
 const received=Buffer.from(signature.slice(7),'hex'),expected=createHmac('sha256',secret).update(raw).digest();
 return received.length===expected.length && timingSafeEqual(received,expected);
}
export function configuredMetaFamilyGateway():MetaFamilyGateway {
 const approved=(name:string,language:string)=>approvedUtilityTemplate({baseUrl:'https://graph.facebook.com/v22.0',accessToken:config.meta.accessToken,wabaId:config.meta.wabaId,name,language});
 const send=async(phone:string,message:Record<string,unknown>)=>{
  if(!config.meta.accessToken || !config.meta.phoneNumberId)return false;
  try{
   const response=await fetch(`https://graph.facebook.com/v22.0/${config.meta.phoneNumberId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${config.meta.accessToken}`,'Content-Type':'application/json'},body:JSON.stringify({messaging_product:'whatsapp',recipient_type:'individual',to:phone,...message}),signal:AbortSignal.timeout(8000)});
   const result:any=await response.json().catch(()=>null);
   return response.ok && typeof result?.messages?.[0]?.id==='string';
  }catch{return false;}
 };
 return {
  notify:async(phone,parameters,payload)=>{
   // Never send a pending, marketing, authentication or unverified template.
   if(!await approved('centerly_student','en'))return false;
   return send(phone,{type:'template',template:{name:'centerly_student',language:{code:'en'},components:[{type:'body',parameters:metaTemplateParameters('centerly_student',parameters).map(text=>({type:'text',text}))},{type:'button',sub_type:'quick_reply',index:'0',parameters:[{type:'payload',payload}]}]}});
  },
  reply:(phone,text)=>send(phone,{type:'text',text:{preview_url:false,body:text}}),
 };
}
// Staff can send the existing approved notification, never retrieve a family password.
// The password is provisioned only after a signed inbound request from that phone.
export async function notifyMetaFamily(db:SupabaseClient,tenantId:string,studentId:string,teacherName:string,gateway:MetaFamilyGateway,ready=metaFamilyReady()){
 const {data:student,error}=await db.from('students').select('id,name,parent_phone').eq('id',studentId).eq('tenant_id',tenantId).maybeSingle();
 if(error)throw familyError(503,'تعذر قراءة بيانات ولي الأمر');
 const phone=familyPhone(student?.parent_phone);if(!student || !phone)throw familyError(400,'راجع رقم ولي الأمر المسجل للطالب');
 if(!ready)throw familyError(503,'الإرسال عبر Meta متصل؛ يلزم تفعيل META_APP_SECRET لاستقبال طلب كلمة مرور الأسرة بأمان');
 if(!await familyRpc(db,'parent_family_limit',{p_key:familyHash('meta-notice:'+phone),p_max:3}))throw familyError(429,'تم إرسال طلب بيانات الأسرة مؤخرًا؛ حاول لاحقًا');
 const [names,platform]=await Promise.all([
  familyNamesAtTeacher(db,tenantId,phone),
  db.from('tenant_platform_settings').select('subject_title').eq('tenant_id',tenantId).maybeSingle(),
 ]);
 if(platform.error)throw familyError(503,'تعذر تجهيز رسالة ولي الأمر');
 const sent=await gateway.notify(phone,[familyNamesText(names),platform.data?.subject_title || 'المادة الدراسية',teacherName || 'المعلم'],`CENTRLY_FAMILY:${student.id}:${tenantId}`);
 if(!sent)throw familyError(502,'لم تؤكد Meta إرسال الرسالة؛ حاول مجددًا لاحقًا');
 return {success:true,message:'تم إرسال رسالة المتابعة لولي الأمر؛ يضغط زر الرسالة لاستلام بيانات حساب الأسرة'};
}
export function credentialAction(message:any):boolean {
 const text=String(message?.button?.text || message?.interactive?.button_reply?.title || message?.text?.body || '').trim();
 const payload=String(message?.button?.payload || message?.interactive?.button_reply?.id || '');
 return /^(?:CENTRLY_FAMILY:|GET_CREDENTIALS)/.test(payload) || /المستخدم|كلم[ةه]\s*(?:السر|المرور)|باسورد|بيانات\s*الدخول/.test(text);
}
export async function processMetaPortalMessage(db:SupabaseClient,message:any,gateway:MetaFamilyGateway,now=Date.now()){
 const phone=familyPhone(message?.from),timestamp=Number(message?.timestamp)*1000;
 if(!phone || typeof message?.id!=='string' || !message.id || message.id.length>256)return;
 const credential=credentialAction(message);
 if(credential && (!Number.isFinite(timestamp) || timestamp>now+60000 || timestamp<now-15*60000))return;
 const key=familyHash('meta-message:'+message.id);
 const claimed=await familyRpc(db,'parent_family_limit',{p_key:key,p_max:1});if(!claimed)return;
 try{
  const records=await familyRpc(db,'meta_portal_phone_records',{p_phone:phone});
  const payload=String(message?.button?.payload || message?.interactive?.button_reply?.id || '');
  const parts=payload.startsWith('CENTRLY_FAMILY:')?payload.split(':'):null;
  const parents=(records || []).filter((s:any)=>s.parent_match);
  const parent=parts?parents.find((s:any)=>s.id===parts[1] && s.tenant_id===parts[2]):parents[0];
  // A button for a removed/reassigned child must not fall back to another family.
  if(parts && !parent)return;
  const students=(records || []).filter((s:any)=>s.student_match);
  const selected=parent || (students.length===1?students[0]:null);
  if(!credential){
   // Do not assign an ambiguous inbound conversation to a random teacher.
   const record=(records || []).length===1?records[0]:null;
   await db.from('whatsapp_inbox').insert({tenant_id:record?.tenant_id || null,student_id:record?.id || null,phone,student_name:record?.name || 'رسالة واتساب',direction:'inbound',message_body:String(message?.text?.body || '[رسالة واتساب]').slice(0,4000),status:'unread',has_replied:true});
   return;
  }
  if(parent){
   await deliverFamilyAccess(db,parent.tenant_id,parent.id,{ready:async()=>true,send:async(to,password,url,names)=>{
    if(to!==phone)throw familyError(403,'تغيّر رقم ولي الأمر أثناء الطلب');
    return gateway.reply(phone,`مرحبًا بولي أمر: ${familyNamesText(names)}\nحساب الأسرة\nرقم الدخول: ${phone}\nكلمة مرور الأسرة: ${password}\nرابط المتابعة المباشر:\n${url}\n\nكل متابعات أبنائك المسجلة برقمك متاحة من نفس الحساب. احتفظ بكلمة المرور لنفسك ولا تشاركها مع الطلاب.`);
   }});
  }else if(students.length===1){
   const s=students[0];
   const {data:current,error}=await db.from('students').select('name,portal_password,student_phone').eq('id',s.id).eq('tenant_id',s.tenant_id).maybeSingle();
   if(error)throw familyError(503,'تعذر قراءة بيانات الطالب');
   if(!current?.portal_password || familyPhone(current.student_phone)!==phone)return;
   if(!await gateway.reply(phone,`بيانات بوابة الطالب (${current.name})\nاسم المستخدم: ${phone}\nكلمة المرور: ${current.portal_password}\nhttps://centerly-eg.com/portal?role=student`))throw familyError(502,'تعذر إرسال الرد');
  }else if(students.length>1){
   if(!await gateway.reply(phone,'رقمك مرتبط بأكثر من متابعة طالب. استخدم كود الطالب وكلمة المرور المرسلين من معلمك للدخول إلى المتابعة المطلوبة.'))throw familyError(502,'تعذر إرسال الرد');
  }else return;
  // Never store outgoing passwords or raw credential queries in the staff inbox/logs.
  if(selected)await db.from('whatsapp_inbox').insert({tenant_id:selected.tenant_id,student_id:selected.id,phone,student_name:selected.name,direction:'outbound',message_body:'[رد آلي على طلب بيانات الدخول عبر Meta]',status:'sent',has_replied:true});
 }catch(error){
  // Allow Meta to retry transient failures; do not make a failed dispatch look completed.
  await db.from('parent_family_limits').delete().eq('key_hash',key);
  throw error;
 }
}
