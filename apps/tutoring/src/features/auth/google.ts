import {Router,Request,Response} from 'express';
import {z} from 'zod';
import {config} from '../../shared/config/index.js';
import {supabasePublic,getServiceSupabaseClient} from '../../supabase.js';
import {authRateLimiter} from '../../shared/middleware/rateLimit.js';

const fail=(status:number,message:string)=>Object.assign(new Error(message),{status});
const sessionSchema=z.object({access_token:z.string().min(16),refresh_token:z.string().min(8),expires_in:z.number().positive()});
async function authFetch(path:string,body?:unknown){
 const response=await fetch(config.supabaseUrl+'/auth/v1/'+path,{method:body?'POST':'GET',headers:{apikey:config.supabaseAnonKey,'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(10000),redirect:'error'});
 if(!response.ok)throw fail(body?401:503,body?'تعذر إكمال الدخول بجوجل. ابدأ تسجيل الدخول من جديد.':'تعذر التحقق من تسجيل جوجل الآن.');
 return response.json();
}
// Explicit token verification only; no shared mutable auth session or provider tokens.
export const googleAuthGateway={
 settings:async()=>Boolean(z.object({external:z.object({google:z.boolean().optional()}).optional()}).parse(await authFetch('settings')).external?.google),
 profile:googleProfile,
 exchange:async(code:string,verifier:string)=>sessionSchema.parse(await authFetch('token?grant_type=pkce',{auth_code:code,code_verifier:verifier})),
 user:async(token:string)=>{
  const {data,error}=await supabasePublic.auth.getUser(token);
  if(error || !data.user?.email_confirmed_at || !data.user.email || data.user.is_anonymous || !data.user.identities?.some(identity=>identity.provider==='google'))throw fail(401,'سجّل الدخول بحساب جوجل المؤكد أولًا.');
  return data.user;
 }
};
export function googleOrigin(origin:string|undefined){
 if(origin==='https://centerly-eg.com' || origin==='https://www.centerly-eg.com')return origin;
 if(config.nodeEnv!=='production' && /^http:\/\/(?:localhost|127\.0\.0\.1):\d+$/.test(origin || ''))return origin!;
 throw fail(403,'افتح تسجيل جوجل من موقع سنترلي الرئيسي.');
}
export const googleProfileInput=z.object({
 full_name:z.string().trim().min(2,'اكتب اسمك').max(120),
 phone:z.string().transform(value=>value.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).replace(/[\s()-]/g,'').replace(/^\+?20/,'0')).pipe(z.string().regex(/^01[0125]\d{8}$/,'اكتب رقم واتساب مصري صحيح')),
 subject:z.string().trim().min(1).max(100),education_stages:z.array(z.enum(['primary','preparatory','secondary','other'])).min(1).max(4),other_stage:z.string().trim().max(100).default(''),terms_accepted:z.literal(true)
}).strict().superRefine((value,ctx)=>{
 if(value.education_stages.includes('other') && !value.other_stage)ctx.addIssue({code:'custom',path:['other_stage'],message:'وضّح المرحلة الدراسية الأخرى'});
}).transform(value=>({...value,education_stages:[...new Set(value.education_stages)],other_stage:value.education_stages.includes('other')?value.other_stage:''}));
export async function googleProfile(userId:string,input:unknown=null){
 const {data,error}=await getServiceSupabaseClient().rpc('google_teacher_profile',{p_user:userId,p_data:input});
 if(error){
  const message=error.message || '';
  if(message.includes('GOOGLE_ACCOUNT_DISABLED'))throw fail(403,'هذا الحساب غير متاح حاليًا. تواصل مع الدعم.');
  if(message.includes('GOOGLE_ROLE_NOT_SUPPORTED'))throw fail(403,'ادخل من رابط الدعوة الخاص بفريق المدرس.');
  if(message.includes('PHONE_ALREADY_EXISTS'))throw fail(409,'رقم واتساب مرتبط بحساب آخر. ادخل بالحساب الموجود أو استخدم رقمك الصحيح.');
  if(message.includes('GOOGLE_ACCOUNT_CONFLICT'))throw fail(409,'يوجد حساب يحتاج ربطًا آمنًا. ادخل بالبريد وكلمة المرور وتواصل مع الدعم.');
  if(message.includes('INVALID_GOOGLE_PROFILE'))throw fail(400,'راجع بياناتك والمادة والمراحل الدراسية.');
  if(message.includes('GOOGLE_IDENTITY_REQUIRED'))throw fail(401,'ابدأ تسجيل الدخول بجوجل من جديد.');
  throw fail(503,'تعذر تحميل بيانات الحساب الآن. حاول مجددًا.');
 }
 if(!data)throw fail(503,'تعذر تحميل بيانات الحساب الآن.');
 return data;
}
function failure(res:Response,error:unknown){
 const e=error as Error & {status?:number};
 res.status(error instanceof z.ZodError?400:e.status || 503).json({error:{code:'GOOGLE_AUTH_ERROR',message:error instanceof z.ZodError?'راجع البيانات المطلوبة ورقم واتساب.':e.status?e.message:'تعذر إكمال تسجيل جوجل الآن. حاول مجددًا.'}});
}
export const googleAuthRouter=Router();
googleAuthRouter.use((_req,res,next)=>{res.set('Cache-Control','private, no-store');next();});
googleAuthRouter.get('/options',async(_req,res)=>{try{res.json({enabled:await googleAuthGateway.settings()});}catch(error){failure(res,error);}});
googleAuthRouter.post('/start',authRateLimiter,async(req:Request,res:Response)=>{
 try{
  const origin=googleOrigin(req.get('Origin')),{challenge}=z.object({challenge:z.string().regex(/^[A-Za-z0-9_-]{43}$/)}).strict().parse(req.body);
  if(!await googleAuthGateway.settings())throw fail(503,'تسجيل جوجل غير متاح حاليًا. استخدم البريد وكلمة المرور.');
  const url=new URL(config.supabaseUrl+'/auth/v1/authorize');
  url.search=new URLSearchParams({provider:'google',redirect_to:origin+'/auth/google/callback',code_challenge:challenge,code_challenge_method:'s256',scopes:'openid email profile',prompt:'select_account'}).toString();
  res.json({url:url.toString()});
 }catch(error){failure(res,error);}
});
googleAuthRouter.post('/exchange',authRateLimiter,async(req:Request,res:Response)=>{
 try{
  googleOrigin(req.get('Origin'));
  const input=z.object({code:z.string().min(8).max(2048),verifier:z.string().regex(/^[A-Za-z0-9._~-]{43,128}$/)}).strict().parse(req.body);
  const session=sessionSchema.parse(await googleAuthGateway.exchange(input.code,input.verifier)),user=await googleAuthGateway.user(session.access_token);
  res.json({session,profile:await googleAuthGateway.profile(user.id)});
 }catch(error){failure(res,error);}
});
googleAuthRouter.post('/complete',authRateLimiter,async(req:Request,res:Response)=>{
 try{
  googleOrigin(req.get('Origin'));
  const token=req.get('Authorization')?.match(/^Bearer (\S+)$/)?.[1];if(!token)throw fail(401,'ابدأ تسجيل الدخول بجوجل أولًا.');
  const input=googleProfileInput.parse(req.body),user=await googleAuthGateway.user(token);
  res.json({profile:await googleAuthGateway.profile(user.id,input)});
 }catch(error){failure(res,error);}
});
