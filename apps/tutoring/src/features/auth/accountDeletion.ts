import {Router,type Response} from 'express';
import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import {getServiceSupabaseClient} from '../../supabase.js';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {authenticateUser} from '../../shared/middleware/auth.js';
import {authRateLimiter} from '../../shared/middleware/rateLimit.js';
import {trustedPortalOrigin} from '../../shared/utils/portalDestination.js';
import {familyHash,familyToken,validFamilyToken} from '../../shared/utils/parentFamily.js';
import {checkedOtpResult,otpRpc,phoneOtpInfo,preparePhoneOtp,requestPhoneOtp,verifyPhoneOtp,teacherOtpRequest,teacherOtpVerify} from '../../shared/utils/phoneOtp.js';

export const accountDeletionRouter=Router();
const token=z.string().refine(validFamilyToken),uuid=z.string().uuid();
function origin(req:AuthenticatedRequest){const value=req.get('Origin');if(!trustedPortalOrigin(value) && !(process.env.NODE_ENV!=='production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(value || '')))throw Object.assign(new Error('افتح إدارة الحساب من موقع سنترلي'),{status:403});return value!;}
async function operation(req:AuthenticatedRequest,action:string,data:Record<string,unknown>={}){
 if(req.user?.assistant_id || !req.user?.id || !req.user.tenant_id || !['owner','teacher','center_owner'].includes(req.user.role))throw Object.assign(new Error('FORBIDDEN'),{code:'42501'});
 const result=await getServiceSupabaseClient().rpc('account_deletion_operation',{p_user:req.user.id,p_origin:origin(req),p_action:action,p_data:data});if(result.error)throw result.error;return result.data;
}
const errors:Record<string,string>={DELETION_INTENT_EXPIRED:'انتهت خطوات التأكيد؛ افتح حذف الحساب من جديد',DELETION_CHALLENGE_REQUIRED:'أكد رقمك بكود جديد من خطوة حذف الحساب',DELETION_CONFIRMATION_REQUIRED:'راجع تأكيد الحذف وحفظ البيانات أولًا',PHONE_REQUIRED:'احفظ رقم موبايل صحيحًا في بياناتك قبل حذف الحساب',WORKSPACE_OWNER_REQUIRED:'حذف مساحة العمل متاح لصاحبها فقط؛ تواصل مع الدعم لو محتاج مساعدة'};
async function handle(res:Response,work:()=>Promise<unknown>){res.set('Cache-Control','private,no-store');try{res.json(await work());}catch(error:any){res.status(error instanceof z.ZodError?400:error.status || (error.code==='42501'?403:error.code==='23514'?409:error.code==='P0002'?404:503)).json({error:{message:error instanceof z.ZodError?'راجع بيانات تأكيد الحذف':errors[error.message] || (error.status?error.message:error.code==='42501'?'هذه العملية متاحة لصاحب حساب المدرس فقط':'تعذر إتمام الخطوة؛ حاول مجددًا. لم نؤكد اكتمال الحذف.')}});}}

// The receipt reveals status only and contains no account identifier or data.
accountDeletionRouter.post('/status',authRateLimiter,async(req,res)=>handle(res,async()=>{const input=z.object({receipt_token:token}).strict().parse(req.body),result=await getServiceSupabaseClient().rpc('account_deletion_worker',{p_action:'status',p_data:{receipt_hash:familyHash(input.receipt_token)}});if(result.error)throw result.error;return result.data;}));
accountDeletionRouter.use(authenticateUser);
accountDeletionRouter.post('/start',authRateLimiter,async(req:AuthenticatedRequest,res)=>handle(res,async()=>{z.object({}).strict().parse(req.body);const info=await operation(req,'start',{id:randomUUID()});return {...info,...await phoneOtpInfo(),verified:false};}));
accountDeletionRouter.get('/export',async(req:AuthenticatedRequest,res)=>handle(res,async()=>{if(req.user?.assistant_id)throw Object.assign(new Error('FORBIDDEN'),{code:'42501'});const result=await getServiceSupabaseClient().rpc('account_data_export',{p_user:req.user!.id});if(result.error)throw result.error;res.set('Content-Disposition','attachment; filename="centerly-account-data.json"');return result.data;}));

function phoneOperation(req:AuthenticatedRequest,id:string){
 const db=getServiceSupabaseClient(),p_origin=origin(req);
 return async(action:string,data:Record<string,unknown>={})=>{
  await operation(req,'info',{id});
  const result=await otpRpc(db,'teacher_phone_verification',{p_user:req.user!.id,p_tenant:req.user!.tenant_id,p_origin,p_action:action,p_data:data});
  if(action==='request' && !result?.error)await operation(req,'bind',{id,challenge_id:data.challenge_id});return result;
 };
}
accountDeletionRouter.post('/:id/challenge',authRateLimiter,async(req:AuthenticatedRequest,res)=>handle(res,async()=>{const id=uuid.parse(req.params.id);z.object({}).strict().parse(req.body);return preparePhoneOtp(getServiceSupabaseClient(),'teacher',req.ip || '',phoneOperation(req,id),{subject:req.user!.id,origin:origin(req)});}));
accountDeletionRouter.post('/:id/request',authRateLimiter,async(req:AuthenticatedRequest,res)=>handle(res,async()=>{const id=uuid.parse(req.params.id),input=teacherOtpRequest.parse(req.body);return requestPhoneOtp(getServiceSupabaseClient(),'teacher',req.ip || '',phoneOperation(req,id),{subject:req.user!.id,origin:origin(req)},input.proof);}));
accountDeletionRouter.post('/:id/verify',authRateLimiter,async(req:AuthenticatedRequest,res)=>handle(res,async()=>{
 const id=uuid.parse(req.params.id),input=teacherOtpVerify.parse(req.body);
 checkedOtpResult(await verifyPhoneOtp(getServiceSupabaseClient(),'teacher',phoneOperation(req,id),{subject:req.user!.id,origin:origin(req)},input.challenge_id,input.code));
 const deletion_token=familyToken();await operation(req,'authorize',{id,challenge_id:input.challenge_id,authorization_hash:familyHash(deletion_token)});return {deletion_token};
}));
accountDeletionRouter.post('/:id/confirm',authRateLimiter,async(req:AuthenticatedRequest,res)=>handle(res,async()=>{
 const id=uuid.parse(req.params.id),input=z.object({deletion_token:token,receipt_token:token,confirmation:z.literal('حذف الحساب'),data_saved_ack:z.literal(true)}).strict().parse(req.body),receipt_token=input.receipt_token;
 const result=await operation(req,'confirm',{id,authorization_hash:familyHash(input.deletion_token),confirmation:input.confirmation,data_saved_ack:true,receipt_hash:familyHash(receipt_token)});
 return {...result,receipt_token};
}));
