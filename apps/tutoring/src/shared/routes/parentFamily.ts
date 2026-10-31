import {Router,Request,Response} from 'express';
import {getServiceSupabaseClient} from '../../supabase.js';
import {authRateLimiter} from '../middleware/rateLimit.js';
import {trustedPortalOrigin,portalDestinationFromContext} from '../utils/portalDestination.js';
import {familyHash,familyToken,validFamilyToken,familyRpc,loginFamily,openFamilyAccount} from '../utils/parentFamily.js';

export const parentFamilyRouter=Router();
let lastMaintenance=0;
parentFamilyRouter.use((req,res,next)=>{
 res.setHeader('Cache-Control','private, no-store');res.setHeader('Referrer-Policy','no-referrer');
 if(!trustedPortalOrigin(req.headers.origin)){res.status(400).json({error:{code:'BAD_ORIGIN',message:'افتح حساب الأسرة من رابط سنترلي'}});return;}
 if(Date.now()-lastMaintenance>60000){
  lastMaintenance=Date.now();const db=getServiceSupabaseClient(),now=new Date().toISOString();
  // Indexed expiry cleanup never delays account rendering. Failed cleanup retries next minute.
  void Promise.all([
   db.from('parent_family_handoffs').delete().lt('expires_at',now),
   db.from('parent_family_sessions').delete().lt('expires_at',now),
   db.from('parent_family_limits').delete().lt('resets_at',new Date(Date.now()-86400000).toISOString()),
  ]).catch(()=>{});
 }
 next();
});
const endpoint=(fn:(req:Request)=>Promise<unknown>)=>async(req:Request,res:Response)=>{
 try{res.json(await fn(req));}catch(error:any){const status=[400,401,403,429,502,503].includes(error?.status)?error.status:503;res.status(status).json({error:{code:status===401?'UNAUTHORIZED':'FAMILY_ERROR',message:status===503?'تعذر الاتصال بحساب الأسرة، حاول مجددًا':error.message}});}
};
// Form bodies carry credentials without URL/query tokens or staff authentication refreshes.
parentFamilyRouter.post('/login',authRateLimiter,endpoint(req=>loginFamily(getServiceSupabaseClient(),req.body?.phone,req.body?.password,req.headers.origin!,req.ip || 'unknown')));
parentFamilyRouter.post('/account',authRateLimiter,endpoint(req=>openFamilyAccount(getServiceSupabaseClient(),req.body?.family_token,req.headers.origin!,req.body?.student_id)));
parentFamilyRouter.post('/handoff',authRateLimiter,endpoint(async req=>{
 if(!validFamilyToken(req.body?.ticket))throw Object.assign(new Error('افتح حساب الأسرة مجددًا'),{status:401});
 const db=getServiceSupabaseClient(),token=familyToken();
 const redeemed=await familyRpc(db,'parent_family_redeem',{p_ticket_hash:familyHash(req.body.ticket),p_origin:req.headers.origin,p_token_hash:familyHash(token)});
 if(!redeemed || portalDestinationFromContext(redeemed.context).origin!==req.headers.origin)throw Object.assign(new Error('انتهت صلاحية الانتقال؛ افتح حساب الأسرة مجددًا'),{status:401});
 return {family_token:token,...await openFamilyAccount(db,token,req.headers.origin!,redeemed.context.id)};
}));
parentFamilyRouter.post('/logout',endpoint(async req=>{
 if(validFamilyToken(req.body?.family_token))await familyRpc(getServiceSupabaseClient(),'parent_family_logout',{p_token_hash:familyHash(req.body.family_token),p_origin:req.headers.origin});
 return {success:true};
}));
