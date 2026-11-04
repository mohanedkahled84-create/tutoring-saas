import type {SupabaseClient} from '@supabase/supabase-js';
import type {IMetaCloudGateway} from '../whatsapp-notifications/meta-cloud.gateway.js';
import {announcementTypeSchema} from './catalog.js';

export function createAnnouncementWorker(db:SupabaseClient,gateway:IMetaCloudGateway,onError:()=>void=()=>{}){
 let busy=false,stopped=false;
 const operation=async(action:string,data:Record<string,unknown>={})=>{const result=await db.rpc('announcement_worker',{p_action:action,p_data:data});if(result.error)throw result.error;return result.data;};
 return {
  stop(){stopped=true;},
  async tick(){
   if(busy || stopped)return;busy=true;
   try{
    // Bound each run; another process can safely claim its own work through SQL.
    for(let index=0;index<10 && !stopped;index++){
     const job=await operation('claim');if(!job)break;
     let result;
     const type=announcementTypeSchema.safeParse(job.template);
     if(!type.success || !Array.isArray(job.parameters) || job.parameters.length!==type.data.fields.length || job.parameters.some((p:unknown)=>typeof p!=='string'))result={outcome:'not_sent',errorCode:'INVALID_TEMPLATE_CONTRACT'};
     else{
      try{result=await gateway.sendTemplate({to:job.to,templateName:type.data.name,languageCode:'ar',bodyParameters:job.parameters,budget:{tenantId:job.tenant_id,dispatchId:job.attempt_id,reserved:true},expected:{id:type.data.id,body:type.data.body,parameterCount:type.data.fields.length}});}
      catch{result={outcome:'unknown',errorCode:'TRANSPORT_UNKNOWN'};}
     }
     // A database failure after transport is intentionally left for the lease
     // to become unknown. Calling transport a second time could duplicate SMS.
     await operation('settle',{attempt_id:job.attempt_id,outcome:result.outcome || 'unknown',message_id:'messageId' in result?result.messageId:null,error_code:result.errorCode==null?null:String(result.errorCode)});
    }
   }catch{onError();}finally{busy=false;}
  },
 };
}

export async function processAnnouncementWebhook(db:SupabaseClient,value:any){
 for(const status of Array.isArray(value?.statuses)?value.statuses:[]){
  if(typeof status?.id!=='string' || !status.id.startsWith('wamid.') || !['sent','delivered','read','failed'].includes(status.status))continue;
  const result=await db.rpc('announcement_worker',{p_action:'delivery',p_data:{message_id:status.id,status:status.status,error_code:status.errors?.[0]?.code==null?null:String(status.errors[0].code)}});if(result.error)throw result.error;
 }
 for(const message of Array.isArray(value?.messages)?value.messages:[]){
  const text=String(message?.text?.body || '').trim().toLowerCase();
  const blocked=['stop','إيقاف','ايقاف','إيقاف التنبيهات','ايقاف التنبيهات'].includes(text),start=['start','تشغيل التنبيهات','استئناف التنبيهات'].includes(text);
  if(!blocked && !start || typeof message.id!=='string' || typeof message.from!=='string' || !/^\d{10}$/.test(String(message.timestamp)))continue;
  const result=await db.rpc('announcement_recipient_preference',{p_phone:message.from,p_message_id:message.id,p_at:new Date(Number(message.timestamp)*1000).toISOString(),p_blocked:blocked});if(result.error)throw result.error;
 }
}
