import type {SupabaseClient} from '@supabase/supabase-js';

// Only called after the webhook signature, WABA and phone number have been verified.
export async function processPortalDeliveryWebhook(db:SupabaseClient,value:any){
 for(const item of Array.isArray(value?.statuses)?value.statuses:[]){
  const seconds=typeof item?.timestamp==='string' && /^\d{10}$/.test(item.timestamp)?Number(item.timestamp):NaN;
  const age=Date.now()-seconds*1000;
  if(typeof item?.id!=='string' || !item.id.startsWith('wamid.') || item.id.length>512 || !['sent','delivered','read','failed'].includes(item.status) || !Number.isFinite(age) || age>90*86400000 || age < -86400000)continue;
  const rawCode=item.errors?.[0]?.code;
  const code=typeof rawCode==='number' || typeof rawCode==='string'?String(rawCode).slice(0,40):null;
  const result=await db.rpc('portal_delivery_receipt',{p_message_id:item.id,p_status:item.status,p_event_at:new Date(seconds*1000).toISOString(),p_error_code:code});
  if(result.error)throw result.error;
 }
}
