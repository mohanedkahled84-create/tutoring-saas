import {Router,type Response} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
import {currentPortalDestination} from '../../shared/utils/portalDestination.js';
import {announcementTypeSchema,renderAnnouncement} from './catalog.js';

export const announcementsRouter=Router();
const uuid=z.string().uuid();
const draft=z.object({id:uuid,title:z.string().trim().min(1).max(160),type_key:z.string().regex(/^[a-z][a-z0-9_]{2,49}$/).nullable(),group_ids:z.array(uuid).min(1).max(200),recipient_roles:z.array(z.enum(['parent','student'])).min(1).max(2),values:z.record(z.string().max(40),z.string().max(160)),manual_body:z.string().trim().max(4000).nullable(),publish_on_portal:z.boolean(),expires_at:z.string().datetime({offset:true}).nullable(),expected_revision:z.number().int().positive().optional()}).strict();
const messages:Record<string,string>={REVISION_CHANGED:'الإعلان اتغير؛ افتحه وراجع النسخة الحالية',PREVIEW_EXPIRED:'انتهت المعاينة؛ اعرض المستلمين من جديد',TEMPLATE_NOT_ENABLED:'القالب غير مفعّل للإرسال الرسمي بعد؛ يمكنك النشر أو فتح واتساب يدويًا',ALLOWANCE_NOT_CONFIGURED:'الإرسال الرسمي غير مهيأ على حسابك حاليًا',ALLOWANCE_EXCEEDED:'عدد الرسائل يتجاوز الرصيد المتاح',PRICE_CHANGED:'تكلفة الرسالة اتغيرت؛ راجع المعاينة مجددًا',AUDIENCE_OR_CONSENT_CHANGED:'قائمة المستلمين أو موافقتهم اتغيرت؛ راجع المعاينة',AUDIENCE_CHANGED:'قائمة المستلمين اتغيرت؛ راجع المعاينة',RECIPIENT_OPTED_OUT:'هذا الرقم أوقف التنبيهات؛ لا يمكن إضافته للإرسال',CANCEL_QUEUE_FIRST:'ألغِ الرسائل المنتظرة قبل تعديل الإعلان',GROUP_NOT_ACTIVE:'بعض المجموعات لم تعد نشطة',ANNOUNCEMENT_BUSY:'انتظر انتهاء محاولة الإرسال الحالية',EXPIRY_PASSED:'موعد انتهاء الإعلان فات بالفعل'};
const inputError=()=>Object.assign(new Error('راجع بيانات الإعلان والحقول المطلوبة'),{code:'22023'});
async function rpc(req:AuthenticatedRequest,name:string,action:string,data:Record<string,unknown>={}){
 const user=req.user;
 if(!user?.id || !user.tenant_id || !['owner','teacher','center_owner'].includes(user.role))throw Object.assign(new Error('FORBIDDEN'),{code:'42501'});
 const result=await getServiceSupabaseClient().rpc(name,{p_tenant:user.tenant_id,p_user:user.id,p_assistant:user.assistant_id || null,p_action:action,p_data:data});
 if(result.error)throw result.error;return result.data;
}
async function reviewed(req:AuthenticatedRequest,id:string){
 const db=getServiceSupabaseClient(),data=await rpc(req,'announcement_operation','candidates',{id});
 const catalog=await rpc(req,'announcement_operation','catalog');
 const row=catalog.find((entry:any)=>entry.key===data.announcement.type_key);
 const template=row?announcementTypeSchema.parse({key:row.key,name:row.meta_name,id:row.meta_id,title:row.title,body:row.body,fields:row.fields}):null;
 const destination=await currentPortalDestination(db,req.user!.tenant_id!);
 const teacher=String(req.user!.full_name || req.user!.name || '').trim(),contact=String(req.user!.phone || '').replace(/\D/g,'').replace(/^01(?=\d{9}$)/,'201');
 // Empty groups may be published before enrollment; required semantic fields
 // still need validation even when there is no contact to render yet.
 if(template && !data.contacts.length){try{renderAnnouncement(template,data.announcement.values,{teacher,contact,portal:destination.origin+'/portal?role=student',group:'المجموعة المحددة'});}catch{throw inputError();}}
 const rows=data.contacts.map((c:any)=>{
  const portal=destination.origin+'/portal?role='+c.recipient_role;
  let rendered;try{rendered=template?renderAnnouncement(template,data.announcement.values,{teacher,contact,portal,group:c.group_names.join('، ')}):null;}catch{throw inputError();}
  return {...c,parameters:rendered?.parameters || [],rendered_body:rendered?.text || data.announcement.manual_body,manual_body:data.announcement.manual_body || rendered?.text};
 });
 return {...data,rows,template};
}
async function handle(req:AuthenticatedRequest,res:Response,work:()=>Promise<unknown>){
 res.set('Cache-Control','private,no-store');
 try{res.json(await work());}catch(error:any){
  const code=error?.code==='42501'?'FORBIDDEN':error?.code==='P0002'?'NOT_FOUND':messages[error?.message]?error.message:error?.code==='22023' || error instanceof z.ZodError?'INVALID_INPUT':'ANNOUNCEMENTS_UNAVAILABLE';
  res.status(code==='FORBIDDEN'?403:code==='NOT_FOUND'?404:code==='INVALID_INPUT'?400:messages[code]?409:503).json({error:{code,message:messages[code] || ({FORBIDDEN:'هذه العملية خارج صلاحياتك أو مجموعاتك',NOT_FOUND:'الإعلان غير موجود',INVALID_INPUT:'راجع بيانات الإعلان والحقول المطلوبة',ANNOUNCEMENTS_UNAVAILABLE:'تعذر إتمام العملية؛ حاول مجددًا'} as Record<string,string>)[code]}});
 }
}
announcementsRouter.get('/',async(req:AuthenticatedRequest,res)=>handle(req,res,async()=>({catalog:await rpc(req,'announcement_operation','catalog'),announcements:await rpc(req,'announcement_operation','list'),requests:await rpc(req,'announcement_operation','requests')})));
announcementsRouter.post('/',async(req:AuthenticatedRequest,res)=>handle(req,res,async()=>{const data=draft.safeParse(req.body);if(!data.success)throw inputError();return rpc(req,'announcement_operation','create',data.data);}));
announcementsRouter.post('/type-requests',async(req:AuthenticatedRequest,res)=>handle(req,res,async()=>{const data=z.object({id:uuid,title:z.string().trim().min(1).max(100),description:z.string().trim().min(1).max(2000),sample_body:z.string().trim().min(1).max(1024)}).strict().safeParse(req.body);if(!data.success)throw inputError();return rpc(req,'announcement_operation','request_type',data.data);}));
announcementsRouter.use('/:id',async(req,res,next)=>{if(!uuid.safeParse(req.params.id).success){res.status(400).json({error:{message:'الإعلان غير صالح'}});return;}next();});
announcementsRouter.get('/:id',async(req:AuthenticatedRequest,res)=>handle(req,res,()=>rpc(req,'announcement_operation','view',{id:req.params.id})));
announcementsRouter.put('/:id',async(req:AuthenticatedRequest,res)=>handle(req,res,async()=>{const data=draft.safeParse({...req.body,id:req.params.id});if(!data.success || !data.data.expected_revision)throw inputError();return rpc(req,'announcement_operation','update',data.data);}));
for(const action of ['publish','archive','consent'] as const)announcementsRouter.post('/:id/'+action,async(req:AuthenticatedRequest,res)=>handle(req,res,async()=>{
 const schema=action==='consent'?z.object({confirmed:z.literal(true),phones:z.array(z.string().regex(/^[1-9]\d{9,14}$/)).min(1).max(10000)}).strict():action==='publish'?z.object({expected_revision:z.number().int().positive()}).strict():z.object({}).strict();
 const data=schema.safeParse(req.body);if(!data.success)throw inputError();
 if(action==='publish')await reviewed(req,req.params.id);
 return rpc(req,'announcement_operation',action,{id:req.params.id,...data.data});
}));
announcementsRouter.post('/:id/preview',async(req:AuthenticatedRequest,res)=>handle(req,res,async()=>{
 const result=await reviewed(req,req.params.id),preview_id=randomUUID();
 if(!result.rows.length)return {...result,preview_id:null};
 const saved=await rpc(req,'announcement_queue','preview',{id:req.params.id,expected_revision:result.announcement.revision,preview_id,rows:result.rows});
 return {...result,...saved};
}));
for(const action of ['enqueue','retry','cancel'] as const)announcementsRouter.post('/:id/'+action,async(req:AuthenticatedRequest,res)=>handle(req,res,async()=>{
 const schema=action==='cancel'?z.object({}).strict():z.object({preview_id:uuid,expected_revision:z.number().int().positive(),phones:z.array(z.string().regex(/^[1-9]\d{9,14}$/)).min(1).max(10000),unit_cost_egp:z.number().nonnegative()}).strict();
 const data=schema.safeParse(req.body);if(!data.success)throw inputError();return rpc(req,'announcement_queue',action,{id:req.params.id,...data.data});
}));
