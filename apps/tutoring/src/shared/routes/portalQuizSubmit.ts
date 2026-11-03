import type {Router,Request,Response} from 'express';
import {z} from 'zod';
import {getServiceSupabaseClient} from '../../supabase.js';
import {verifiedPortalStudent} from '../utils/portalDestination.js';
import {authRateLimiter} from '../middleware/rateLimit.js';
const input=z.object({token:z.string().min(16).max(2048),material_id:z.string().min(1).max(120),answers:z.record(z.string().max(100),z.union([z.string().max(10000),z.number().int(),z.null()])).default({}),essay_answers:z.record(z.string().max(100),z.string().max(10000)).default({}),elapsed_seconds:z.number().int().min(0).max(86400).default(0),is_withdrawn:z.boolean().default(false),withdrawal_reason:z.string().max(500).nullable().default(null)});
export function registerPortalQuizSubmission(router:Router){
 router.post('/quizzes/submit',authRateLimiter,async(req:Request,res:Response)=>{
  res.set('Cache-Control','private,no-store');const parsed=input.safeParse(req.body);if(!parsed.success){res.status(400).json({error:{code:'INVALID_INPUT',message:'راجع إجابات الامتحان ثم حاول مجددًا'}});return;}
  try{
   const db=getServiceSupabaseClient(),student=await verifiedPortalStudent(db,parsed.data.token);
   if(!student){res.status(401).json({error:{code:'UNAUTHORIZED',message:'سجّل الدخول مجددًا لتسليم الامتحان'}});return;}
   const result=await db.rpc('submit_portal_quiz_verified',{p_student:student.id,p_tenant:student.tenant_id,p_reference:parsed.data.material_id,p_answers:{...parsed.data.answers,...parsed.data.essay_answers},p_elapsed:parsed.data.elapsed_seconds,p_withdrawn:parsed.data.is_withdrawn,p_reason:parsed.data.withdrawal_reason});
   if(result.error)throw result.error;res.json(result.data);
  }catch(error:any){
   const status=error.code==='42501'?403:error.code==='P0002'?404:error.code==='23514'?409:String(error.code || '').startsWith('22')?400:503;
   res.status(status).json({error:{code:status===403?'FORBIDDEN':status===404?'QUIZ_NOT_FOUND':status===409?'QUIZ_UNAVAILABLE':'QUIZ_SUBMISSION_UNAVAILABLE',message:status===403?'الامتحان غير متاح لحسابك أو مجموعتك':status===404?'الامتحان غير موجود؛ حدّث صفحة الاختبارات':error.message==='QUIZ_OUTSIDE_SCHEDULE'?'الامتحان خارج موعد الإتاحة الذي حدده المدرس':status===409?'الامتحان غير جاهز للتسليم؛ راجع المدرس':status===400?'راجع إجابات الامتحان ثم حاول مجددًا':'تعذر تأكيد التسليم؛ احتفظ بإجاباتك وحاول مجددًا'}});
  }
 });
}
