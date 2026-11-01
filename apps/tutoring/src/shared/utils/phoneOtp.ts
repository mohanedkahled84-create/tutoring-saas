import {createHmac,randomInt,randomUUID} from 'node:crypto';
import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';
import {config} from '../config/index.js';
import {familyHash,validFamilyToken} from './parentFamily.js';

export const phoneVerificationTemplate='centerly_phone_verification_v1';
export const registrationInput=z.object({invitation:z.string().refine(validFamilyToken)}).strict();
export const otpVerifyFields={challenge_id:z.uuid(),code:z.string().transform(v=>v.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776))).pipe(z.string().regex(/^\d{6}$/))};
export const registrationVerify=registrationInput.extend(otpVerifyFields).strict();
export const teacherOtpVerify=z.object(otpVerifyFields).strict();
const fault=(status:number,message:string)=>Object.assign(new Error(message),{status});
export function phoneOtpHash(purpose:string,challenge:string,code:string,key=config.internalApiSecret){
 if(key.length<32)throw fault(503,'خدمة تأكيد الرقم غير جاهزة حاليًا');
 return createHmac('sha256',key).update(`phone-otp:v1:${purpose}:${challenge}:${code}`).digest('hex');
}
export function checkedOtpResult(result:any){
 if(!result || result.error){
  const code=result?.error;
  const errors:Record<string,[number,string]>={EXPIRED:[410,'رابط الدعوة انتهى أو اتلغى. اطلب رابط تسجيل جديدًا من المدرس.'],WAIT:[429,`انتظر ${Number(result?.retry_after)||60} ثانية قبل طلب كود جديد`],ATTEMPTS:[429,'وصلت للحد الأقصى للمحاولات. اطلب كودًا جديدًا بعد انتهاء الانتظار.'],CODE_EXPIRED:[410,'انتهت صلاحية الكود. اطلب كودًا جديدًا.'],CODE_USED:[410,'تم استخدام الكود. اطلب كودًا جديدًا لو لم يكتمل التسجيل.'],NO_PHONE:[400,'احفظ رقم واتساب صحيحًا في بيانات الحساب أولًا.'],NOT_SENT:[400,'اطلب كود تأكيد على واتساب أولًا.']};
  const [status,message]=errors[code] || [400,'كود التأكيد غير صحيح. راجعه وحاول مرة أخرى.'];throw fault(status,message);
 }
 return result;
}
export async function otpRpc(db:SupabaseClient,name:string,args:Record<string,unknown>){
 const {data,error}=await db.rpc(name,args);if(error)throw fault(error.message.includes('UNAUTHORIZED')?401:error.message.includes('FORBIDDEN')?403:503,error.message.includes('UNAUTHORIZED')?'الحساب غير متاح؛ سجّل الدخول مجددًا':'تعذر تأكيد الرقم الآن. حاول لاحقًا.');return data;
}
export const phoneOtpGateway={
 ready:async()=>{
  if(!config.meta.accessToken || !config.meta.wabaId || !config.meta.phoneNumberId)return false;
  try{const r=await fetch(`https://graph.facebook.com/v22.0/${config.meta.wabaId}/message_templates?name=${phoneVerificationTemplate}&fields=name,status,language,category`,{headers:{Authorization:`Bearer ${config.meta.accessToken}`},signal:AbortSignal.timeout(3000)});const body:any=await r.json();return r.ok && Array.isArray(body?.data) && body.data.some((t:any)=>t.name===phoneVerificationTemplate && t.status==='APPROVED' && t.language==='ar' && t.category==='AUTHENTICATION');}catch{return false;}
 },
 send:async(phone:string,code:string):Promise<'sent'|'failed'|'uncertain'>=>{
  if(!/^[1-9]\d{7,14}$/.test(phone) || !/^\d{6}$/.test(code) || !await phoneOtpGateway.ready())return 'failed';
  try{const r=await fetch(`https://graph.facebook.com/v22.0/${config.meta.phoneNumberId}/messages`,{method:'POST',headers:{Authorization:`Bearer ${config.meta.accessToken}`,'Content-Type':'application/json'},signal:AbortSignal.timeout(8000),body:JSON.stringify({messaging_product:'whatsapp',to:phone,type:'template',template:{name:phoneVerificationTemplate,language:{code:'ar'},components:[{type:'body',parameters:[{type:'text',text:code}]},{type:'button',sub_type:'url',index:'0',parameters:[{type:'text',text:code}]}]}})});const body:any=await r.json().catch(()=>null);if(r.ok && typeof body?.messages?.[0]?.id==='string')return 'sent';return r.status>=400 && r.status<500?'failed':'uncertain';}catch{return 'uncertain';}
 },
};
export async function requestPhoneOtp(db:SupabaseClient,purpose:string,ip:string,operation:(action:string,data?:Record<string,unknown>)=>Promise<any>){
 const info=checkedOtpResult(await operation('info'));
 if(!await phoneOtpGateway.ready())throw fault(503,'إرسال كود واتساب غير متاح حاليًا. حاول لاحقًا أو تواصل مع المسؤول.');
 for(const [key,max] of [[`phone-otp:ip:${ip}`,20],[`phone-otp:phone:${info.phone}`,3]] as const){if(!await otpRpc(db,'parent_family_limit',{p_key:familyHash(key),p_max:max}))throw fault(429,'طلبات تأكيد كثيرة. حاول بعد ١٥ دقيقة.');}
 if(!await otpRpc(db,'phone_otp_reserve',{p_limit:Math.max(1,Math.min(5000,config.meta.dailyLimit))}))throw fault(429,'وصلنا لحد أكواد التحقق اليوم. حاول لاحقًا.');
 const challenge=randomUUID(),code=String(randomInt(1000000)).padStart(6,'0');
 const created=checkedOtpResult(await operation('request',{challenge_id:challenge,code_hash:phoneOtpHash(purpose,challenge,code)}));
 const delivery=await phoneOtpGateway.send(created.phone,code);
 await operation('delivery',{challenge_id:challenge,status:delivery});
 if(delivery==='failed')throw fault(502,'تعذر إرسال كود واتساب. حاول بعد دقيقة.');
 return {challenge_id:challenge,phone:created.phone,expires_in:300,retry_after:60,delivery,message:delivery==='sent'?'تم إرسال كود التأكيد على واتساب.':'لم يصل تأكيد الإرسال. لو وصلك الكود اكتبه هنا، أو اطلب كودًا جديدًا بعد دقيقة.'};
}
