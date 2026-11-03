import type {Router,Request,Response} from 'express';
import rateLimit from 'express-rate-limit';
import {z} from 'zod';
import {getServiceSupabaseClient} from '../../supabase.js';
import {verifiedPortalStudent} from '../utils/portalDestination.js';
import {quizStartedDefinition} from '../utils/legacyPortalQuizzes.js';
// School networks share an IP. Progress is primarily limited per verified
// learner, rather than consuming the staff login-attempt allowance.
const ingress=rateLimit({windowMs:60000,max:2000,standardHeaders:true,legacyHeaders:false});
const progress=rateLimit({windowMs:60000,max:120,standardHeaders:true,legacyHeaders:false,keyGenerator:req=>{const student=(req as any).quizContext.student;return student.tenant_id+':'+student.id;}});
const token=z.string().min(16).max(2048),reference=z.string().min(1).max(120);
const answers=z.record(z.string().max(100),z.union([z.string().max(10000),z.number().int(),z.null()]));
const input=z.object({token,material_id:reference,answers:answers.default({}),essay_answers:z.record(z.string().max(100),z.string().max(10000)).default({}),elapsed_seconds:z.number().int().min(0).max(86400).default(0),is_withdrawn:z.boolean().default(false),withdrawal_reason:z.string().max(500).nullable().default(null)});
const start=z.object({token,material_id:reference}).strict();
const save=z.object({token,attempt_id:z.string().uuid(),answers,revision:z.number().int().nonnegative()}).strict();
function failure(res:Response,error:any){
 const messages:Record<string,string>={QUIZ_OUTSIDE_SCHEDULE:'الامتحان خارج موعد الإتاحة الذي حدده المدرس',QUIZ_NOT_STARTED:'افتح الامتحان لبدء محاولتك قبل التسليم',QUIZ_REVISION_CHANGED:'اتحفظت إجابات من صفحة أخرى؛ أعد فتح الامتحان لاستكمال النسخة المحفوظة'};
 const status=error.code==='42501'?403:error.code==='P0002'?404:error.code==='23514'?409:String(error.code || '').startsWith('22')?400:503;
 res.status(status).json({error:{code:status===403?'FORBIDDEN':status===404?'QUIZ_NOT_FOUND':messages[error.message]?error.message:status===409?'QUIZ_UNAVAILABLE':'QUIZ_SUBMISSION_UNAVAILABLE',message:messages[error.message] || (status===403?'الامتحان غير متاح لحسابك أو مجموعتك':status===404?'الامتحان غير موجود؛ حدّث صفحة الاختبارات':status===409?'الامتحان غير جاهز؛ راجع المدرس':status===400?'راجع إجابات الامتحان ثم حاول مجددًا':'تعذر تأكيد الحفظ أو التسليم؛ احتفظ بإجاباتك وحاول مجددًا')}});
}
export function registerPortalQuizSubmission(router:Router){
 const register=(path:string,schema:z.ZodType,work:(db:any,student:any,data:any)=>Promise<any>)=>router.post(path,(_req,res,next)=>{res.set('Cache-Control','private,no-store');next();},ingress,async(req:Request,res:Response,next)=>{
  const parsed=schema.safeParse(req.body);if(!parsed.success){res.status(400).json({error:{code:'INVALID_INPUT',message:'راجع بيانات الامتحان ثم حاول مجددًا'}});return;}
  try{
   const db=getServiceSupabaseClient(),student=await verifiedPortalStudent(db,(parsed.data as any).token);
   if(!student){res.status(401).json({error:{code:'UNAUTHORIZED',message:'سجّل الدخول مجددًا لاستكمال الامتحان'}});return;}
   (req as any).quizContext={db,student,data:parsed.data};next();
  }catch(error){failure(res,error);}
 },progress,async(req:Request,res:Response)=>{
  try{const {db,student,data}=(req as any).quizContext;const result=await work(db,student,data);if(result.error)throw result.error;res.json(result.data);}catch(error){failure(res,error);}
 });
 register('/quizzes/start',start,async(db,student,data)=>{
  const result=await db.rpc('portal_quiz_start',{p_student:student.id,p_tenant:student.tenant_id,p_reference:data.material_id});
  if(!result.error && result.data?.definition)result.data={...result.data,definition:quizStartedDefinition(result.data.definition)};
  return result;
 });
 register('/quizzes/save',save,(db,student,data)=>db.rpc('portal_quiz_save',{p_student:student.id,p_tenant:student.tenant_id,p_attempt:data.attempt_id,p_answers:data.answers,p_revision:data.revision}));
 register('/quizzes/submit',input,(db,student,data)=>db.rpc('submit_portal_quiz_verified',{p_student:student.id,p_tenant:student.tenant_id,p_reference:data.material_id,p_answers:{...data.answers,...data.essay_answers},p_elapsed:data.elapsed_seconds,p_withdrawn:data.is_withdrawn,p_reason:data.withdrawal_reason}));
}
