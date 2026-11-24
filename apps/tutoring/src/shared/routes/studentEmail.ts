import {Router} from 'express';
import {z} from 'zod';
import {createHmac,randomInt,randomUUID} from 'node:crypto';
import {config} from '../config/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
import {verifiedPortalStudent} from '../utils/portalDestination.js';
import {familyHash} from '../utils/parentFamily.js';

export const studentEmailRouter=Router();
const token=z.string().min(1).max(2048);
const schemas={status:z.object({token}).strict(),disable:z.object({token}).strict(),request:z.object({token,email:z.email().max(254).transform(v=>v.toLowerCase())}).strict(),verify:z.object({token,challenge_id:z.uuid(),code:z.string().transform(v=>v.replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).trim()).pipe(z.string().regex(/^\d{6}$/))}).strict()};
export function studentEmailHash(tenant:string,student:string,challenge:string,code:string){
 if(config.internalApiSecret.length<32)throw new Error('Email verification unavailable');
 return createHmac('sha256',config.internalApiSecret).update(['student-email:v1',tenant,student,challenge,code].join(':')).digest('hex');
}
export async function sendStudentEmail(to:string,subject:string,text:string,key?:string){
 if(!config.resendApiKey)throw new Error('Email provider unavailable');
 const response=await fetch('https://api.resend.com/emails',{method:'POST',headers:{Authorization:'Bearer '+config.resendApiKey,'Content-Type':'application/json',...(key?{'Idempotency-Key':key}:{})},body:JSON.stringify({from:config.resendFromEmail,to,subject,text}),signal:AbortSignal.timeout(10000)});
 const result:any=await response.json().catch(()=>null);
 if(!response.ok || typeof result?.id!=='string')throw new Error('Email delivery unconfirmed');
 return result.id as string;
}
for(const action of ['status','request','verify','disable'] as const)studentEmailRouter.post('/'+action,async(req,res)=>{
 res.set('Cache-Control','private,no-store');
 const parsed=schemas[action].safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:{message:'راجع البريد الإلكتروني وكود التأكيد'}});return;}
 try{
  const db=getServiceSupabaseClient(),student=await verifiedPortalStudent(db,parsed.data.token);
  if(!student){res.status(401).json({error:{message:'سجّل دخولك مجددًا'}});return;}
  const rpc=async(command:string,data:Record<string,unknown>={})=>{const result=await db.rpc('student_email_contact',{p_action:command,p_tenant:student.tenant_id,p_student:student.id,p_data:data});if(result.error)throw result.error;return result.data;};
  if(action==='status'){res.json(await rpc('info'));return;}
  if(action==='disable'){res.json(await rpc('disable'));return;}
  const limit=await db.rpc('parent_family_limit',{p_key:familyHash(`student-email:${action}:${req.ip}:${student.id}`),p_max:action==='request'?5:20});
  if(limit.error || !limit.data){res.status(429).json({error:{message:'انتظر قليلًا قبل المحاولة مجددًا'}});return;}
  if(action==='request'){
   if(!config.resendApiKey)throw new Error('Email provider unavailable');
   const email=(parsed.data as z.infer<typeof schemas.request>).email,challenge=randomUUID(),code=String(randomInt(1000000)).padStart(6,'0');
   const result=await rpc('start',{email,challenge_id:challenge,code_hash:studentEmailHash(student.tenant_id,student.id,challenge,code)});
   if(result.status==='cooldown'){res.status(429).json({error:{message:'انتظر دقيقة قبل طلب كود جديد'}});return;}
   await sendStudentEmail(email,'تأكيد بريدك الإلكتروني في سنترلي',`رمز التأكيد: ${code}\nصالح لمدة ١٥ دقيقة. لا تشاركه مع أحد.\nبعد التأكيد يمكنك استقبال الرسائل المهمة من المدرس وإيقافها من قسم البريد الإلكتروني.`, 'student-email-'+challenge);
   res.json({challenge_id:challenge,message:'أرسلنا كود التأكيد إلى بريدك. راجع الرسائل غير المرغوب فيها أيضًا.'});return;
  }
  const fields=parsed.data as z.infer<typeof schemas.verify>;
  const result=await rpc('verify',{challenge_id:fields.challenge_id,code_hash:studentEmailHash(student.tenant_id,student.id,fields.challenge_id,fields.code)});
  if(result.status!=='verified'){res.status(400).json({error:{message:result.status==='expired'?'انتهى الكود. اطلب كودًا جديدًا.':'الكود غير صحيح. راجعه وحاول مجددًا.'}});return;}
  res.json({verified:true});
 }catch{res.status(503).json({error:{message:'تعذر تأكيد البريد الآن؛ حاول مجددًا بعد دقيقة. يمكنك استخدام المنصة بدون بريد.'}});}
});
