import {createHash, createCipheriv, createDecipheriv, randomBytes, randomInt, randomUUID} from 'node:crypto';
import bcrypt from 'bcryptjs';
import type {SupabaseClient} from '@supabase/supabase-js';
import {config} from '../config/index.js';
import {portalDestinationFromContext, portalOrigin} from './portalDestination.js';
import {generateParentPortalTokenUntil} from './tokens.js';
import {loadPortalAccount} from './portalAccount.js';

export const familyHash=(value:string)=>createHash('sha256').update(value).digest('hex');
export const familyToken=()=>randomBytes(32).toString('base64url');
export const validFamilyToken=(value:unknown):value is string=>typeof value==='string' && /^[A-Za-z0-9_-]{43}$/.test(value);
export const familyError=(status:number,message:string)=>Object.assign(new Error(message),{status});
export function familyPhone(value:unknown):string|null {
 if(typeof value!=='string' || value.length>48)return null;
 let phone=value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\s()+.\-]/g,'');
 if(phone.startsWith('00'))phone=phone.slice(2);
 if(/^01[0125]\d{8}$/.test(phone))phone='2'+phone;
 return /^[1-9]\d{7,14}$/.test(phone)?phone:null;
}
function cipherKey() {
 if(!config.internalApiSecret || config.internalApiSecret.length<32)throw familyError(503,'خدمة حساب الأسرة غير مهيأة بعد');
 return createHash('sha256').update('parent-family-password:v1:'+config.internalApiSecret).digest();
}
export function sealFamilyPassword(password:string,phone:string):string {
 const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',cipherKey(),iv);cipher.setAAD(Buffer.from(phone));
 const encrypted=Buffer.concat([cipher.update(password,'utf8'),cipher.final()]);
 return Buffer.concat([iv,cipher.getAuthTag(),encrypted]).toString('base64url');
}
export function openFamilyPassword(value:string,phone:string):string {
 const bytes=Buffer.from(value,'base64url'),cipher=createDecipheriv('aes-256-gcm',cipherKey(),bytes.subarray(0,12));
 cipher.setAAD(Buffer.from(phone));cipher.setAuthTag(bytes.subarray(12,28));
 return Buffer.concat([cipher.update(bytes.subarray(28)),cipher.final()]).toString('utf8');
}
export async function familyRpc(db:SupabaseClient,name:string,args:Record<string,unknown>) {
 const {data,error}=await db.rpc(name,args);if(error)throw familyError(503,'تعذر الاتصال بحساب الأسرة، حاول مجددًا');return data;
}
export async function familyIdentity(db:SupabaseClient,token:unknown,origin:string) {
 if(!validFamilyToken(token))throw familyError(401,'سجّل دخول حساب الأسرة مجددًا');
 const identity=await familyRpc(db,'parent_family_identity',{p_token_hash:familyHash(token),p_origin:origin});
 if(!identity)throw familyError(401,'انتهت جلسة حساب الأسرة، سجّل الدخول مجددًا');return identity;
}
export async function loginFamily(db:SupabaseClient,phone:unknown,password:unknown,origin:string,ip:string) {
 const normalized=familyPhone(phone);
 // Limits are persistent across replicas and apply even to unknown phone numbers.
 const limits=await Promise.all([
  familyRpc(db,'parent_family_limit',{p_key:familyHash('phone:'+String(normalized || phone).slice(0,48)),p_max:10}),
  familyRpc(db,'parent_family_limit',{p_key:familyHash('ip:'+ip),p_max:50}),
 ]);
 if(limits.some(ok=>!ok))throw familyError(429,'محاولات دخول كثيرة؛ جرّب مرة أخرى بعد ربع ساعة');
 const {data:account,error}=await db.from('parent_family_accounts').select('id,password_hash,credential_version').eq('phone',normalized || 'invalid').maybeSingle();
 if(error)throw familyError(503,'تعذر تسجيل الدخول الآن');
 // A real bcrypt hash keeps unknown-account and wrong-password work equivalent.
 const candidate=typeof password==='string' && password.length<=72 ? password.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).trim() : '';
 const verified=await bcrypt.compare(candidate,account?.password_hash || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxqqF0OWxLj6MZfNJ6Ia8su4jqu');
 if(!normalized || !account || !verified)throw familyError(401,'راجع رقم ولي الأمر وكلمة مرور الأسرة');
 const token=familyToken(),id=randomUUID(),expires=new Date(Date.now()+30*86400000).toISOString();
 const {error:insertError}=await db.from('parent_family_sessions').insert({id,root_id:id,family_id:account.id,token_hash:familyHash(token),origin,credential_version:account.credential_version,expires_at:expires});
 if(insertError)throw familyError(503,'تعذر بدء الجلسة، حاول مجددًا');
 return {family_token:token,expires_at:expires};
}

export async function openFamilyAccount(db:SupabaseClient,token:unknown,origin:string,studentId?:unknown) {
 if(!validFamilyToken(token))throw familyError(401,'سجّل دخول حساب الأسرة مجددًا');
 const hash=familyHash(token);
 const directory=await familyRpc(db,'parent_family_directory',{p_token_hash:hash,p_origin:origin});
 if(!directory)throw familyError(401,'انتهت جلسة حساب الأسرة، سجّل الدخول مجددًا');
 // No guessed sibling identities and no client-provided tenant IDs.
 const selected=studentId ? directory.students.find((s:any)=>s.id===studentId) : directory.students[0];
 if(studentId && !selected)throw familyError(403,'هذه المتابعة غير مرتبطة بحساب الأسرة');
 const students=directory.students.map((s:any)=>({id:s.id,tenant_id:s.tenant_id,name:s.name,student_code:s.student_code,teacher_name:s.teacher_name}));
 if(!selected)return {students,selected_id:null,expires_at:directory.expires_at};
 const context=await familyRpc(db,'parent_family_context',{p_token_hash:hash,p_origin:origin,p_student_id:selected.id});
 if(!context)throw familyError(403,'تغيّر ارتباط المتابعة بحساب الأسرة؛ حدّث الصفحة');
 const destination=portalDestinationFromContext(context);
 if(destination.origin!==origin) {
  const identity=await familyIdentity(db,token,origin),ticket=familyToken();
  const {error}=await db.from('parent_family_handoffs').insert({ticket_hash:familyHash(ticket),session_id:identity.id,student_id:selected.id,target_origin:destination.origin});
  if(error)throw familyError(503,'تعذر تجهيز الانتقال للمعلم');
  return {students,selected_id:selected.id,expires_at:directory.expires_at,destination:{...destination,ticket}};
 }
 const expires=Math.floor(new Date(directory.expires_at).getTime()/1000);
 const initial_data=await loadPortalAccount(db,generateParentPortalTokenUntil(selected.id,selected.tenant_id,expires),true,context);
 return {students,selected_id:selected.id,expires_at:directory.expires_at,initial_data,presentation:destination.presentation};
}

export interface FamilyPasswordDelivery {ready():Promise<boolean>;send(phone:string,password:string,url:string):Promise<boolean>}
export async function deliverFamilyAccess(db:SupabaseClient,tenantId:string,studentId:string,delivery:FamilyPasswordDelivery) {
 const {data:student,error}=await db.from('students').select('parent_phone').eq('id',studentId).eq('tenant_id',tenantId).maybeSingle();
 if(error)throw familyError(503,'تعذر قراءة بيانات ولي الأمر');
 const phone=familyPhone(student?.parent_phone);if(!phone)throw familyError(400,'راجع رقم ولي الأمر المسجل للطالب');
 // Do not provision a credential or pretend to send while the sender is disconnected.
 if(!await delivery.ready())throw familyError(503,'إرسال بيانات الأسرة غير متاح حاليًا؛ راجع إعداد استقبال ردود Meta');
 const password=String(randomInt(100000000000,1000000000000)),hash=await bcrypt.hash(password,12),cipher=sealFamilyPassword(password,phone);
 const result=await familyRpc(db,'parent_family_delivery',{p_tenant_id:tenantId,p_student_id:studentId,p_hash:hash,p_cipher:cipher,p_phone:phone});
 if(!result)throw familyError(400,'راجع رقم ولي الأمر المسجل للطالب');
 if(result.limited)throw familyError(429,'انتظر دقيقة قبل إعادة إرسال بيانات الأسرة');
 // Existing credentials are resent, never reset by a teacher. No password in a staff response/log.
 const success=await delivery.send(result.phone,openFamilyPassword(result.password_cipher,result.phone),portalOrigin()+'/portal?role=parent&family=1');
 if(!success)throw familyError(502,'تعذر إرسال بيانات الأسرة، حاول مرة أخرى لاحقًا');
 return {success:true,message:'تم إرسال بيانات حساب الأسرة إلى رقم ولي الأمر المسجل'};
}
