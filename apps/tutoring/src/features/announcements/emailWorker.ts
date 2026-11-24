import type {SupabaseClient} from '@supabase/supabase-js';
import {sendStudentEmail} from '../../shared/routes/studentEmail.js';
import {currentPortalDestination} from '../../shared/utils/portalDestination.js';

export function createAnnouncementEmailWorker(db:SupabaseClient,onError:()=>void=()=>{}){
 let busy=false,stopped=false;
 const rpc=async(action:string,id?:string,provider?:string)=>{const result=await db.rpc('announcement_email_worker',{p_action:action,p_id:id || null,p_provider:provider || null});if(result.error)throw result.error;return result.data;};
 return {stop(){stopped=true;},async tick(){
  if(busy || stopped)return;busy=true;
  try{for(let i=0;i<10 && !stopped;i++){
   const job=await rpc('claim');if(!job)break;if(job.skipped)continue;
   let provider;
   try{const destination=await currentPortalDestination(db,job.tenant_id);provider=await sendStudentEmail(job.email,'رسالة من مدرسك: '+job.title,`لديك إعلان جديد من مدرسك:\n${job.title}\n\nافتح منصتك لقراءة التفاصيل:\n${destination.origin}/login\n\nيمكنك إيقاف رسائل البريد من قسم البريد الإلكتروني في حسابك.`,'announcement-email-'+job.id);}
   catch{await rpc('unknown',job.id);continue;}
   // Never send again after a transport success followed by a failed database write.
   await rpc('sent',job.id,provider);
  }}catch{onError();}finally{busy=false;}
 }};
}
