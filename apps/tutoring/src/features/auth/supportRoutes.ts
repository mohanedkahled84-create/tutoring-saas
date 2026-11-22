import {Router,type Response} from 'express';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
import {validateFileUpload} from '../../shared/utils/fileUploadValidator.js';
export const supportRouter=Router();
const uuid=z.string().uuid(),body=z.string().trim().min(1).max(4000);
const create=z.object({id:uuid,title:z.string().trim().min(1).max(160),category:z.enum(['account','attendance','homework','messages','subscription','other']),body,image:z.string().max(2800000).optional()}).strict();
const reply=z.object({request_id:uuid,body}).strict();
const status=z.object({status:z.enum(['open','in_progress','waiting_user','resolved'])}).strict();
const contact=()=>{const value=String(process.env.SUPPORT_WHATSAPP_PHONE || '201123671177').replace(/\D/g,'');return /^\d{10,15}$/.test(value)?value:null;};
async function operation(req:AuthenticatedRequest,res:Response,action:string,data:Record<string,unknown>={}){
 res.set('Cache-Control','private,no-store');
 if(!req.user?.id || req.user.assistant_id){res.status(403).json({error:{code:'FORBIDDEN',message:'سجّل دخول حساب المدرس للتواصل مع الدعم'}});return;}
 try{
  const db=getServiceSupabaseClient();
  const result=await db.rpc('support_operation',{p_user:req.user.id,p_action:action,p_data:data});if(result.error)throw result.error;
  if(action==='list'){
   // The RPC first establishes which ticket IDs the caller may access.
   const tickets=Array.isArray(result.data)?result.data:[];
   const ids=tickets.map((ticket:any)=>ticket.id);
   if(ids.length){
    const replies=await db.from('support_replies').select('ticket_id,body,created_at').in('ticket_id',ids).eq('author_role','admin').order('created_at',{ascending:false}).limit(1000);
    if(replies.error)throw replies.error;
    const latest=new Map<string,{body:string;created_at:string}>();
    for(const reply of replies.data || [])if(!latest.has(reply.ticket_id))latest.set(reply.ticket_id,{body:reply.body,created_at:reply.created_at});
    // A busy ticket must not hide another ticket's older reply past the page limit.
    if((replies.data || []).length===1000){
     for(const id of ids.filter((id:string)=>!latest.has(id))){
      const older=await db.from('support_replies').select('body,created_at').eq('ticket_id',id).eq('author_role','admin').order('created_at',{ascending:false}).limit(1);
      if(older.error)throw older.error;
      if(older.data?.[0])latest.set(id,older.data[0]);
     }
    }
    for(const ticket of tickets)if(latest.has(ticket.id))ticket.latest_admin_reply=latest.get(ticket.id);
   }
   res.json({tickets,contact_phone:contact()});return;
  }
  res.json(result.data);
 }catch(error:any){const code=error?.message==='RATE_LIMIT'?'RATE_LIMIT':error?.code==='42501'?'FORBIDDEN':error?.code==='P0002'?'NOT_FOUND':error?.code==='23514' || error?.code==='23505'?'REQUEST_CONFLICT':'SUPPORT_UNAVAILABLE';res.status(({RATE_LIMIT:429,FORBIDDEN:403,NOT_FOUND:404,REQUEST_CONFLICT:409,SUPPORT_UNAVAILABLE:503})[code]).json({error:{code,message:({RATE_LIMIT:'انتظر قليلًا قبل إرسال طلب جديد',FORBIDDEN:'هذا الطلب غير متاح لحسابك',NOT_FOUND:'طلب الدعم غير موجود',REQUEST_CONFLICT:'الطلب محفوظ بالفعل؛ أعد تحميل القائمة',SUPPORT_UNAVAILABLE:'تعذر إتمام طلب الدعم؛ حاول مجددًا'})[code]}});}
}
supportRouter.get('/',async(req:AuthenticatedRequest,res)=>{await operation(req,res,'list');});
supportRouter.post('/',async(req:AuthenticatedRequest,res)=>{const parsed=create.safeParse(req.body);if(!parsed.success){res.status(400).json({error:{message:'راجع عنوان الطلب والتصنيف والتفاصيل'}});return;}const image=parsed.data.image;
 if(image!==undefined){
  const match=/^data:(image\/(png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/.exec(image);
  const valid=match && validateFileUpload({buffer:Buffer.from(match[3],'base64'),originalFilename:'support.'+match[2],declaredMimeType:match[1],maxSizeBytes:2*1024*1024}).isValid;
  if(!valid){res.status(400).json({error:{message:'اختر صورة PNG أو JPEG أو WebP بحجم يصل إلى ٢ ميجابايت'}});return;}
 }
 await operation(req,res,'create',parsed.data);});
supportRouter.get('/:id',async(req:AuthenticatedRequest,res)=>{if(!uuid.safeParse(req.params.id).success){res.status(400).json({error:{message:'الطلب غير صالح'}});return;}await operation(req,res,'view',{id:req.params.id});});
for(const action of ['reply','status'] as const)supportRouter.post('/:id/'+action,async(req:AuthenticatedRequest,res)=>{const parsed=(action==='reply'?reply:status).safeParse(req.body);if(!uuid.safeParse(req.params.id).success || !parsed.success){res.status(400).json({error:{message:'راجع بيانات طلب الدعم'}});return;}await operation(req,res,action,{id:req.params.id,...parsed.data});});
