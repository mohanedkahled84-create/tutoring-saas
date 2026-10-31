import type {Request,Response} from 'express';
import {config} from '../config/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
import {verifyMetaSignature,processMetaPortalMessage,configuredMetaFamilyGateway} from '../utils/metaFamily.js';
// Injectable transport for isolated live security tests; production always uses Meta.
export const metaWebhookRuntime={gateway:configuredMetaFamilyGateway};

export async function metaPortalWebhook(req:Request,res:Response):Promise<void>{
 res.setHeader('Cache-Control','private, no-store');
 if(config.meta.appSecret.length<16){res.status(503).json({error:'Meta webhook verification is not configured'});return;}
 if(!verifyMetaSignature((req as Request & {rawMetaBody?:Buffer}).rawMetaBody,req.headers['x-hub-signature-256'])){res.status(401).json({error:'Invalid Meta signature'});return;}
 if(req.body?.object!=='whatsapp_business_account' || !Array.isArray(req.body.entry)){res.status(400).json({error:'Invalid Meta event'});return;}
 try{
  const messages=[];
  for(const entry of req.body.entry){
   if(String(entry?.id)!==config.meta.wabaId)continue;
   for(const change of Array.isArray(entry?.changes)?entry.changes:[]){
    const value=change?.value;
    if(change?.field!=='messages' || value?.messaging_product!=='whatsapp' || String(value?.metadata?.phone_number_id)!==config.meta.phoneNumberId)continue;
    if(Array.isArray(value.messages))messages.push(...value.messages);
   }
  }
  const db=getServiceSupabaseClient(),gateway=metaWebhookRuntime.gateway();
  await Promise.all(messages.map(message=>processMetaPortalMessage(db,message,gateway)));
  res.status(200).send('EVENT_RECEIVED');
 }catch{
  // No webhook payloads, phone numbers, credentials or provider responses in logs.
  res.status(503).json({error:'Meta event processing temporarily unavailable'});
 }
}
