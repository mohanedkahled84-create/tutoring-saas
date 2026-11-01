import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import {registrationInput,registrationVerify,registrationRequest,checkedOtpResult,phoneOtpInfo,preparePhoneOtp,requestPhoneOtp,verifyPhoneOtp} from '../../shared/utils/phoneOtp.js';
import bcrypt from 'bcryptjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getServiceSupabaseClient } from '../../supabase.js';
import { config } from '../../shared/config/index.js';
import type { AuthenticatedRequest } from '../../shared/types/index.js';
import { familyHash, familyToken, familyPhone, validFamilyToken } from '../../shared/utils/parentFamily.js';
import { portalOrigin, trustedPortalOrigin } from '../../shared/utils/portalDestination.js';
import { notifyAssistantInvitation } from './invitationDelivery.js';
import { validatePay, isPayDate } from './payroll.js';
import { signHomeworkFile } from '../homework/files.js';
import {followupQuery,followupPrepare,whatsappFollowup} from './followup.js';
import {collectionInput,collectionQuery,voidCollectionInput} from './collectionSchemas.js';
import {loadAssistantActivity} from './activity.js';
import {enrichAssistantPage} from './pageDetails.js';

export const assistantCatalog = [
 { key:'groups', label:'مجاميعي الدراسية', actions:['view','create','edit'] },
 { key:'students', label:'دليل طلابي', actions:['view','create','edit'] },
 { key:'sessions', label:'جدول الحصص والتقويم', actions:['view'] },
 { key:'attendance', label:'بدء حصة ورصد الحضور', actions:['view','edit'] },
 { key:'homework', label:'مراجعة وتصحيح الواجبات', actions:['view','edit'] },
 { key:'materials', label:'المذكرات والماتريال', actions:['view','create','edit'] },
 { key:'quizzes', label:'رصد درجات الكويزات يدوياً', actions:['view','create','edit'] },
 { key:'grades', label:'رصد درجات الكويزات يدوياً', actions:['view','edit'] },
 { key:'collections', label:'سجل التحصيل', actions:['view','create'] },
 { key:'reports', label:'الدرجات ولوحة الشرف', actions:['view'] },
 { key:'messages', label:'متابعة الطلاب وواتساب', actions:['view','send'] },
] as const;
const allowed = new Set(assistantCatalog.flatMap(p => p.actions.map(action => `${p.key}.${action}`)));
const fault = (status:number,message:string) => Object.assign(new Error(message), {status});
export function validateAssistantAccess(input:any) {
 const permissions = z.record(z.string(),z.boolean()).parse(input.permissions ?? {});
 for (const [key,value] of Object.entries(permissions)) {
  if (!allowed.has(key)) throw fault(400,'صلاحية غير معروفة');
  if (value && !permissions[`${key.split('.')[0]}.view`]) throw fault(400,'فعّل عرض الصفحة قبل صلاحيات الإنشاء أو التعديل');
 }
 const group_ids=z.array(z.uuid()).max(500).parse(input.group_ids ?? []);
 const all_groups=z.boolean().parse(input.all_groups ?? false);
 if (permissions['groups.create'] && !all_groups) throw fault(400,'إنشاء المجموعات يتطلب السماح بجميع المجموعات');
 return {permissions,group_ids:[...new Set(group_ids)],all_groups};
}
export async function assistantRpc(db:SupabaseClient,name:string,args:Record<string,unknown>) {
 const {data,error}=await db.rpc(name,args);
 if (error) {
  if (error.message.includes('UNAUTHORIZED')) throw fault(401,'انتهت الجلسة أو تم إيقاف الحساب؛ سجّل الدخول مجددًا');
  if (error.message.includes('FORBIDDEN')) throw fault(403,'هذه العملية خارج صلاحياتك أو مجموعاتك');
  if (error.message.includes('NOT_FOUND')) throw fault(404,'الحساب غير موجود');
  if (error.message.includes('LEGACY_STAFF_LOGIN')) throw fault(409,'هذا السجل مرتبط بدخول مساعد قديم؛ يلزم نقل الدخول القديم قبل تفعيل الصلاحيات الجديدة');
  if (error.message.includes('IDEMPOTENCY_CONFLICT')) throw fault(409,'هذه المحاولة مسجلة ببيانات مختلفة؛ حدّث السجل قبل إنشاء عملية جديدة');
  if (error.message.includes('INVALID_INPUT')) throw fault(400,'راجع البيانات المدخلة');
  if (error.code==='23505') throw fault(409,'الرقم أو السجل مسجل بالفعل لدى هذا المدرس');
  throw fault(503,'تعذر إتمام العملية الآن، حاول مجددًا');
 }
 return data;
}
function sendError(res:Response,error:unknown) {
 const e=error as Error & {status?:number};
 const status=error instanceof z.ZodError ? 400 : e.status || 503;
 res.status(status).json({error:{code:status===403?'FORBIDDEN':status===401?'UNAUTHORIZED':'ASSISTANT_ACCESS_ERROR',message:error instanceof z.ZodError?'راجع البيانات المطلوبة':e.status?e.message:'تعذر إتمام العملية الآن'}});
}
function origin(req:Request):string {
 const value=req.get('Origin');
 if (trustedPortalOrigin(value)) return value;
 if (config.nodeEnv!=='production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(value || '')) return value!;
 throw fault(403,'افتح رابط المساعد من موقع المنصة');
}
const token=(req:Request)=>{
 const value=req.get('Authorization')?.replace(/^Bearer /,'');
 if (!validFamilyToken(value)) throw fault(401,'سجّل دخول حساب المساعد');
 return value;
};
async function limit(db:SupabaseClient,key:string,max:number) {
 if (!await assistantRpc(db,'parent_family_limit',{p_key:familyHash(`assistant:${key}`),p_max:max})) throw fault(429,'محاولات كثيرة؛ حاول بعد ربع ساعة');
}
const text=(max:number)=>z.string().trim().max(max);
const name=text(100).min(2);
const phone=text(48);
const date=z.string().refine(isPayDate);
const base={id:z.uuid().optional(),group_id:z.uuid().optional()};
const resourceSchemas:Record<string,z.ZodType>={
 groups:z.object({...base,name,subject:text(100).default('')}).strict(),
 students:z.object({...base,name,parent_phone:phone.refine(v=>!!familyPhone(v)),student_phone:phone.refine(v=>!v || !!familyPhone(v)).default(''),notes:text(2000).default('')}).strict(),
 attendance:z.object({id:z.uuid().nullable().optional(),student_id:z.uuid(),session_id:z.uuid(),attended:z.boolean(),homework_status:z.enum(['done','partial','missing']),comment:text(2000).default('')}).strict(),
 homework:z.object({id:z.uuid(),status:z.enum(['approved','rejected']),teacher_notes:text(2000).default('')}).strict(),
 materials:z.object({...base,title:name,description:text(4000).default(''),type:z.enum(['pdf','video','link']),url:z.url().refine(u=>new URL(u).protocol==='https:'),is_homework:z.boolean(),due_date:date.or(z.literal('')).default('')}).strict(),
 collections:collectionInput,
 grades:z.object({quiz_id:z.uuid(),student_id:z.uuid(),score:z.number().finite().min(0).max(100000),note:text(2000).default('')}).strict(),
 quizzes:z.object({...base,title:name,quiz_number:z.number().int().min(1).max(100000),max_score:z.number().positive().max(100000),quiz_date:date}).strict(),
};

export const assistantAccessRouter=Router();
assistantAccessRouter.use((_req,res,next)=>{res.set('Cache-Control','no-store');next();});
assistantAccessRouter.get('/workspace/:tenant',async(req,res)=>{
 try {
  const tenant=z.uuid().parse(req.params.tenant);
  const {data,error}=await getServiceSupabaseClient().from('tenants').select('name').eq('id',tenant).eq('status','active').is('deleted_at',null).maybeSingle();
  if(error || !data) throw fault(404,'رابط حساب المدرس غير متاح');
  res.json({name:data.name});
 } catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/login',async(req,res)=>{
 try {
  const db=getServiceSupabaseClient(),pageOrigin=origin(req);
  const tenant=z.uuid().parse(req.body.workspace),normalized=familyPhone(req.body.phone);
  await Promise.all([limit(db,`login:phone:${tenant}:${normalized || 'invalid'}`,10),limit(db,`login:ip:${req.ip}`,50)]);
  const password=typeof req.body.password==='string' && Buffer.byteLength(req.body.password,'utf8')<=72?req.body.password:'';
  const {data:account,error}=await db.from('assistant_accounts').select('assistant_id,password_hash,credential_version').eq('tenant_id',tenant).eq('phone',normalized || 'invalid').maybeSingle();
  if(error) throw fault(503,'تعذر تسجيل الدخول');
  const ok=await bcrypt.compare(password,account?.password_hash || '$2b$12$LQv3c1yqBWVHxkd0LHAkCOYz6TtxqqF0OWxLj6MZfNJ6Ia8su4jqu');
  if(!normalized || !ok || !account?.password_hash) throw fault(401,'راجع رقم واتساب وكلمة المرور الخاصة بهذا المدرس');
  const session=familyToken();
  if(!await assistantRpc(db,'assistant_start_session',{p_assistant:account.assistant_id,p_hash:account.password_hash,p_version:account.credential_version,p_token_hash:familyHash(session),p_origin:pageOrigin})) throw fault(401,'الحساب غير متاح؛ راجع المدرس');
  res.json({token:session});
 }catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/registration/info',async(req,res)=>{
 try{const input=registrationInput.parse(req.body),db=getServiceSupabaseClient(),pageOrigin=origin(req);await limit(db,`registration-info:${req.ip}`,30);const info=checkedOtpResult(await assistantRpc(db,'assistant_registration',{p_nonce_hash:familyHash(input.invitation),p_origin:pageOrigin,p_action:'info',p_data:{}}));res.json({...info,...await phoneOtpInfo()});}catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/registration/challenge',async(req,res)=>{
 try{const input=registrationInput.parse(req.body),db=getServiceSupabaseClient(),pageOrigin=origin(req);res.json(await preparePhoneOtp(db,'assistant',req.ip || '',(action,data={})=>assistantRpc(db,'assistant_registration',{p_nonce_hash:familyHash(input.invitation),p_origin:pageOrigin,p_action:action,p_data:data}),{subject:familyHash(input.invitation),origin:pageOrigin}));}catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/registration/request',async(req,res)=>{
 try{const input=registrationRequest.parse(req.body),db=getServiceSupabaseClient(),pageOrigin=origin(req);res.json(await requestPhoneOtp(db,'assistant',req.ip || '',(action,data={})=>assistantRpc(db,'assistant_registration',{p_nonce_hash:familyHash(input.invitation),p_origin:pageOrigin,p_action:action,p_data:data}),{subject:familyHash(input.invitation),origin:pageOrigin},input.proof));}catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/registration/verify',async(req,res)=>{
 try{const input=registrationVerify.parse(req.body),db=getServiceSupabaseClient(),pageOrigin=origin(req);await limit(db,`registration-verify:${req.ip}`,30);const ticket=familyToken();const result=await verifyPhoneOtp(db,'assistant',(action,data={})=>assistantRpc(db,'assistant_registration',{p_nonce_hash:familyHash(input.invitation),p_origin:pageOrigin,p_action:action,p_data:data}),{subject:familyHash(input.invitation),origin:pageOrigin},input.challenge_id,input.code,familyHash(ticket));res.json({...result,ticket});}catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/registration/claim',async(req,res)=>{
 try{const input=z.object({ticket:z.string().refine(validFamilyToken)}).strict().parse(req.body),info=await assistantRpc(getServiceSupabaseClient(),'assistant_registration_claim',{p_claim_hash:familyHash(input.ticket),p_origin:origin(req)});if(!info)throw fault(410,'أكد رقم الدعوة بالكود قبل إنشاء الحساب.');res.json(info);}catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/accept',async(req,res)=>{
 try {
  const db=getServiceSupabaseClient(),pageOrigin=origin(req);
  await limit(db,`accept:${req.ip}`,10);
  if(!validFamilyToken(req.body.ticket)) throw fault(400,'رابط الدعوة غير صالح');
  const input=z.object({ticket:z.string().refine(validFamilyToken),name,password:z.string().min(10).max(72)}).strict().parse(req.body);
  if(!await assistantRpc(db,'assistant_registration_claim',{p_claim_hash:familyHash(input.ticket),p_origin:pageOrigin}))throw fault(410,'أكد رقم الدعوة بالكود قبل إنشاء الحساب.');
  const fullName=input.name,password=input.password;
  if(Buffer.byteLength(password,'utf8')>72) throw fault(400,'كلمة المرور طويلة جدًا');
  const hash=await bcrypt.hash(password,12);
  const id=await assistantRpc(db,'assistant_accept_invitation',{p_claim_hash:familyHash(req.body.ticket),p_name:fullName,p_password_hash:hash});
  if(!id) throw fault(410,'الدعوة انتهت أو استخدمت؛ اطلب دعوة جديدة من المدرس');
  const {data:account,error}=await db.from('assistant_accounts').select('credential_version,tenant_id').eq('assistant_id',id).single();
  if(error || !account) throw fault(503,'تم حفظ حسابك؛ سجّل الدخول برقمك وكلمة المرور');
  const session=familyToken();
  if(!await assistantRpc(db,'assistant_start_session',{p_assistant:id,p_hash:hash,p_version:account.credential_version,p_token_hash:familyHash(session),p_origin:pageOrigin})) throw fault(401,'سجّل الدخول مجددًا');
  res.json({token:session,workspace:account.tenant_id});
 }catch(error){sendError(res,error);}
});
assistantAccessRouter.get('/me',async(req,res)=>{
 try {res.json(await assistantRpc(getServiceSupabaseClient(),'assistant_workspace',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_resource:'identity',p_action:'view'}));}
 catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/logout',async(req,res)=>{
 try {await assistantRpc(getServiceSupabaseClient(),'assistant_workspace',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_resource:'logout',p_action:'view'});res.json({success:true});}
 catch(error){sendError(res,error);}
});
assistantAccessRouter.get('/data/:resource',async(req,res)=>{
 try {
  if(!assistantCatalog.some(p=>p.key===req.params.resource)) throw fault(403,'صفحة غير مسموحة');
  if(req.params.resource==='collections'){res.json(await assistantRpc(getServiceSupabaseClient(),'assistant_collections',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_action:'view',p_data:collectionQuery.parse(req.query)}));return;}
  if(['reports','messages'].includes(req.params.resource)){res.json(await assistantRpc(getServiceSupabaseClient(),'assistant_followup',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_action:'view',p_data:followupQuery.parse(req.query)}));return;}
  const data=req.params.resource==='grades' ? (req.query.quiz_id?{quiz_id:z.uuid().parse(req.query.quiz_id)}:{}) : req.query.session_id?{session_id:z.uuid().parse(req.query.session_id)}:{};
  if(req.params.resource==='grades'){res.json(await assistantRpc(getServiceSupabaseClient(),'assistant_grades',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_action:'view',p_data:data}));return;}
  const db=getServiceSupabaseClient();
  const result=await assistantRpc(db,'assistant_workspace',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_resource:req.params.resource,p_action:'view',p_data:data});
  res.json(await enrichAssistantPage(db,req.params.resource,result));
 }catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/data/:resource/:action',async(req,res)=>{
 try {
  const schema=resourceSchemas[req.params.resource];
  if(!schema || !['create','edit'].includes(req.params.action)) throw fault(403,'عملية غير مسموحة');
  const selectedSchema=req.params.resource==='quizzes' && req.params.action==='edit' ? z.object({id:z.uuid(),title:name,quiz_date:date}).strict() : schema;
  const data=selectedSchema.parse(req.body) as Record<string,unknown>;
  if(req.params.resource==='collections'){if(req.params.action!=='create')throw fault(403,'تعديل أو إلغاء التحصيل متاح للمدرس فقط');res.json(await assistantRpc(getServiceSupabaseClient(),'assistant_collections',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_action:'create',p_data:data}));return;}
  if(req.params.resource==='grades'){if(req.params.action!=='edit')throw fault(403,'عملية غير مسموحة');res.json(await assistantRpc(getServiceSupabaseClient(),'assistant_grades',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_action:'edit',p_data:data}));return;}
  if(req.params.action==='edit' && req.params.resource!=='attendance' && !data.id) throw fault(400,'السجل مطلوب');
  if(req.params.action==='create' && req.params.resource!=='groups' && !data.group_id) throw fault(400,'اختر المجموعة');
  res.json(await assistantRpc(getServiceSupabaseClient(),'assistant_workspace',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_resource:req.params.resource,p_action:req.params.action,p_data:data}));
 }catch(error){sendError(res,error);}
});
assistantAccessRouter.post('/followup/prepare',async(req,res)=>{
 try{const data=followupPrepare.parse(req.body);const report=await assistantRpc(getServiceSupabaseClient(),'assistant_followup',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_action:'prepare',p_data:data});res.json(whatsappFollowup(report,data.recipient));}catch(error){sendError(res,error);}
});
assistantAccessRouter.get('/files/:id',async(req,res)=>{
 try {
  const db=getServiceSupabaseClient();
  const record=await assistantRpc(db,'assistant_workspace',{p_token_hash:familyHash(token(req)),p_origin:origin(req),p_resource:'homework_file',p_action:'view',p_data:{id:z.uuid().parse(req.params.id)}});
  const url=await signHomeworkFile(db,record.file_url,record.tenant_id,record.material_id,record.student_id);
  if(!url) throw fault(404,'الملف غير متاح');
  res.json({url});
 } catch(error){sendError(res,error);}
});

export const assistantManagementRouter=Router();
assistantManagementRouter.use((req:AuthenticatedRequest,res,next)=>{
 if(!['teacher','owner','center_owner','admin'].includes(req.user?.role || '') || !req.user?.tenant_id){res.status(403).json({error:{code:'FORBIDDEN',message:'غير مسموح بإدارة الفريق'}});return;}
 res.set('Cache-Control','no-store');next();
});
assistantManagementRouter.get('/access-catalog',(_req,res)=>{res.json({pages:assistantCatalog});});
async function ownerGroups(req:AuthenticatedRequest) {
 const db=getServiceSupabaseClient(),tenant=req.user!.tenant_id!;
 const groups:string[]=[];
 for(let offset=0;;offset+=500){
  let query=db.from('groups').select('id').eq('tenant_id',tenant).order('id').range(offset,offset+499);
  if(req.user!.role==='teacher' && req.user!.teacher_id){const teacher=z.uuid().parse(req.user!.teacher_id);query=query.or(`teacher_id.eq.${teacher},teacher_id.is.null`);}
  const {data:batch,error}=await query;if(error)throw error;groups.push(...(batch || []).map(g=>g.id));if(!batch || batch.length<500)break;
 }
 return groups;
}
async function ownerCollection(req:AuthenticatedRequest,action:string,data:Record<string,unknown>) {
 const db=getServiceSupabaseClient(),tenant=req.user!.tenant_id!,groups=await ownerGroups(req);
 return assistantRpc(db,'student_collection_operation',{p_tenant:tenant,p_assistant:null,p_user:req.user!.id,p_actor:(req.user!.full_name || req.user!.name || '').trim() || 'المدرس',p_groups:groups,p_action:action,p_data:data});
}
assistantManagementRouter.get('/followup',async(req:AuthenticatedRequest,res)=>{
 try{res.json(await assistantRpc(getServiceSupabaseClient(),'student_followup_report',{p_tenant:req.user!.tenant_id,p_groups:await ownerGroups(req),p_data:followupQuery.parse(req.query)}));}catch(error){sendError(res,error);}
});
assistantManagementRouter.post('/followup/prepare',async(req:AuthenticatedRequest,res)=>{
 try{const data=followupPrepare.parse(req.body),db=getServiceSupabaseClient(),report=await assistantRpc(db,'student_followup_report',{p_tenant:req.user!.tenant_id,p_groups:await ownerGroups(req),p_data:data});
 const {data:student,error}=await db.from('students').select('parent_phone,student_phone').eq('id',data.student_id).eq('tenant_id',req.user!.tenant_id!).single();if(error)throw error;
 res.json(whatsappFollowup({...report,phone:data.recipient==='parent'?student.parent_phone:student.student_phone},data.recipient));}catch(error){sendError(res,error);}
});
assistantManagementRouter.get('/collections',async(req:AuthenticatedRequest,res)=>{
 try{res.json(await ownerCollection(req,'view',collectionQuery.parse(req.query)));}catch(error){sendError(res,error);}
});
assistantManagementRouter.post('/collections',async(req:AuthenticatedRequest,res)=>{
 try{res.status(201).json(await ownerCollection(req,'create',collectionInput.parse(req.body)));}catch(error){sendError(res,error);}
});
assistantManagementRouter.post('/collections/:id/void',async(req:AuthenticatedRequest,res)=>{
 try{res.json(await ownerCollection(req,'void',{id:z.uuid().parse(req.params.id),...voidCollectionInput.parse(req.body)}));}catch(error){sendError(res,error);}
});
function registrationLinks(tenant:string,phone:string,nonce:string){
 const url=`${portalOrigin()}/assistant?workspace=${tenant}#registration=${nonce}`;
 const message=`استكمل حسابك في فريق المدرس من الرابط:\n${url}\nرقم واتساب المسجل ثابت؛ أكّده بالكود ثم اكتب اسمك واختر كلمة مرور.`;
 return {registration_url:url,registration_whatsapp_url:`https://wa.me/${phone}?text=${encodeURIComponent(message)}`};
}
assistantManagementRouter.post('/:id/registration-link',async(req:AuthenticatedRequest,res)=>{
 try{const db=getServiceSupabaseClient(),id=z.uuid().parse(req.params.id),nonce=familyToken();await limit(db,`registration-link:${req.user!.tenant_id}:${id}`,5);const result=await assistantRpc(db,'assistant_registration_link',{p_tenant:req.user!.tenant_id,p_assistant:id,p_nonce_hash:familyHash(nonce)});res.json({...result,...registrationLinks(result.tenant_id,result.phone,nonce)});}catch(error){sendError(res,error);}
});
assistantManagementRouter.get('/activity',async(req:AuthenticatedRequest,res)=>{
 try {res.json(await loadAssistantActivity(getServiceSupabaseClient(),req.user!.tenant_id!,req.query));}
 catch(error){sendError(res,error);}
});
assistantManagementRouter.post('/invitations',async(req:AuthenticatedRequest,res)=>{
 try {
  const db=getServiceSupabaseClient(),tenant=req.user!.tenant_id,access=validateAssistantAccess(req.body);
  const phone=familyPhone(req.body.phone);if(!phone) throw fault(400,'أدخل رقم واتساب صحيحًا');
  const id=req.body.assistant_id?z.uuid().parse(req.body.assistant_id):null;
  await limit(db,`invite:${tenant}:${phone}`,3);
  // Existing records retain pay inside assistant_invite's transaction. Do not
  // validate or resend a possibly stale salary snapshot just to recover access.
  let pay:Record<string,unknown>={};
  if(!id)try {pay=validatePay(req.body);}catch(error){throw fault(400,(error as Error).message);}
  let teacher=req.user?.teacher_id || null;
  if(!teacher) {
   const {data,error}=await db.from('teachers').select('id').eq('tenant_id',tenant).eq('user_id',req.user!.id).maybeSingle();
   if(error) throw error;teacher=data?.id || null;
  }
  const nonce=familyToken();
  const invitation=await assistantRpc(db,'assistant_invite',{p_tenant:tenant,p_assistant:id,p_teacher:teacher,p_phone:phone,p_nonce_hash:familyHash(nonce),p_permissions:access.permissions,p_all_groups:access.all_groups,p_group_ids:access.group_ids,p_pay:pay});
  const {data:tenantInfo}=await db.from('tenants').select('name').eq('id',tenant).single();
  const delivery=await notifyAssistantInvitation(config.meta,phone,tenantInfo?.name || 'المعلم',nonce);
  const {error}=await db.from('assistant_invitations').update({delivery_status:delivery}).eq('id',invitation.invitation_id).eq('tenant_id',tenant);
  if(error) throw error;
  res.status(201).json({...invitation,phone,...registrationLinks(tenant!,phone,nonce),delivery_status:delivery,message:delivery==='sent'?'تم إرسال الدعوة إلى واتساب':delivery==='blocked'?'تم حفظ الدعوة. إرسال واتساب متوقف لحين اعتماد قالب Utility':'تم حفظ الدعوة، لكن Meta لم تؤكد الإرسال'});
 }catch(error){sendError(res,error);}
});
assistantManagementRouter.put('/:id/access',async(req:AuthenticatedRequest,res)=>{
 try {
  const db=getServiceSupabaseClient(),tenant=req.user!.tenant_id,id=z.uuid().parse(req.params.id),access=validateAssistantAccess(req.body);
  const {data:previous,error}=await db.from('assistants').select('salary_model,salary,work_weekdays,pay_start_date,status').eq('tenant_id',tenant).eq('id',id).maybeSingle();
  if(error || !previous) throw fault(404,'المساعد غير موجود');
  const status=z.enum(['active','inactive','invited']).parse(req.body.status ?? previous.status);
  let pay;try{pay=validatePay(req.body,previous);}catch(error){throw fault(400,(error as Error).message);}
  const saved=await assistantRpc(db,'assistant_configure',{p_tenant:tenant,p_assistant:id,p_permissions:access.permissions,p_all_groups:access.all_groups,p_group_ids:access.group_ids,p_status:status,p_pay:pay});
  if(!saved) throw fault(404,'حساب المساعد غير موجود');
  res.json({success:true});
 }catch(error){sendError(res,error);}
});

export async function confirmAssistantMessage(db:SupabaseClient,phone:string,payload:string,reply:(phone:string,text:string)=>Promise<boolean>) {
 const nonce=payload.slice('CENTRLY_ASSISTANT:'.length);if(!validFamilyToken(nonce)) return;
 const ticket=familyToken();
 const record=await assistantRpc(db,'assistant_confirm_invitation',{p_nonce_hash:familyHash(nonce),p_phone:phone,p_claim_hash:familyHash(ticket)});
 if(!record) return;
 const url=`${portalOrigin()}/assistant?workspace=${record.tenant_id}#registration=${nonce}`;
 if(!await reply(phone,`حسابك في فريق ${record.teacher_name}\n\nأكد رقمك بكود واتساب، ثم كمّل اسمك واختار كلمة مرور من هنا:\n${url}\n\nاستخدم رابطك الخاص ولا تشاركه مع أي شخص.`)) throw fault(502,'تعذر إرسال رابط استكمال الحساب');
}
