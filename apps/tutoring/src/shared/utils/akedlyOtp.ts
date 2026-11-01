import {createHmac,timingSafeEqual} from 'node:crypto';
import {z} from 'zod';
import {config} from '../config/index.js';

const fault=(status:number,message:string)=>Object.assign(new Error(message),{status});
export const smsProof=z.object({context:z.string().min(10).max(24000),nonce:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional(),turnstileToken:z.string().max(8192).optional()}).strict();
export type SmsProof=z.infer<typeof smsProof>;
export type OtpContext={subject:string,purpose:string,origin:string,phone:string};
export const usesAkedly=()=>config.phoneOtp.provider==='akedly';
export const akedlyConfigured=()=>!!config.phoneOtp.apiKey && /^[a-f0-9]{24}$/i.test(config.phoneOtp.pipelineId);
const signature=(value:string)=>{
 if(config.internalApiSecret.length<32)throw fault(503,'خدمة تأكيد الرقم غير جاهزة');
 return createHmac('sha256',config.internalApiSecret).update('akedly-context:v1:'+value).digest();
};
export function signSmsContext(value:Record<string,unknown>){const raw=Buffer.from(JSON.stringify(value)).toString('base64url');return raw+'.'+signature(raw).toString('base64url');}
export function readSmsContext(token:string,expected:OtpContext){
 try{const parts=token.split('.');if(parts.length!==2)throw Error();const expectedSig=signature(parts[0]),given=Buffer.from(parts[1],'base64url');if(given.length!==expectedSig.length || !timingSafeEqual(given,expectedSig))throw Error();const value=JSON.parse(Buffer.from(parts[0],'base64url').toString());if(!Number.isFinite(value.expires) || value.expires<=Date.now() || value.pipeline!==config.phoneOtp.pipelineId)throw Error();for(const key of ['subject','purpose','origin','phone'] as const)if(value[key]!==expected[key])throw Error();return value;}catch{throw fault(400,'انتهى فحص الإرسال أو لا يخص هذا الرقم. اطلب الكود مجددًا.');}
}
async function providerCall(path:string,body?:Record<string,unknown>,ip?:string){
 if(!akedlyConfigured())throw fault(503,'إرسال SMS غير جاهز حاليًا');
 try{
  const url=path==='challenge'?`https://api.akedly.io/api/v1.2/transactions/challenge?${new URLSearchParams({APIKey:config.phoneOtp.apiKey,pipelineID:config.phoneOtp.pipelineId})}`:`https://api.akedly.io/api/v1.2/transactions/${path}`;
  const r=await fetch(url,{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(ip?{'x-end-user-ip':ip}:{})},body:body?JSON.stringify(body):undefined,signal:AbortSignal.timeout(path==='send'?12000:8000),redirect:'error'});
  const result:any=await r.json().catch(()=>null);
  if(!r.ok || result?.status!=='success'){
   const code=result?.code;
   if(code==='INVALID_OTP')throw fault(400,'كود التأكيد غير صحيح');
   if(code==='TRANSACTION_EXPIRED')throw fault(410,'انتهت صلاحية الكود. اطلب كودًا جديدًا.');
   if(code==='ALREADY_VERIFIED')throw fault(410,'تم استخدام الكود. اطلب كودًا جديدًا لو لم يكتمل التسجيل.');
   if(r.status===429)throw fault(429,'طلبات كثيرة؛ انتظر قبل المحاولة مجددًا.');
   throw fault(503,'تعذر إتمام طلب SMS من مزود الإرسال. حاول لاحقًا.');
  }
  if(!result.data || result.data.devMode===true || result.data.isTest===true)throw fault(503,'المسار في وضع المحاكاة؛ يلزم تفعيل الإرسال الحقيقي لتأكيد الرقم.');
  return result.data;
 }catch(error){if((error as any)?.status)throw error;throw fault(503,'لم يتأكد طلب مزود SMS. لا تعِد الإرسال فورًا؛ انتظر دقيقة.');}
}
export const akedlyGateway={
 challenge:()=>providerCall('challenge'),
 send:(phone:string,code:string,proof:any,ip:string)=>providerCall('send',{APIKey:config.phoneOtp.apiKey,pipelineID:config.phoneOtp.pipelineId,verificationAddress:{phoneNumber:'+'+phone},otp:code,digits:6,otpLanguage:'en',channel:'sms',...(proof.challengeRequired?{powSolution:{challengeToken:proof.challengeToken,nonce:proof.nonce}}:{}),...(proof.turnstileToken?{turnstileToken:proof.turnstileToken}:{})},ip),
 verify:(requestId:string,code:string)=>providerCall('verify',{transactionReqID:requestId,otp:code}),
};
