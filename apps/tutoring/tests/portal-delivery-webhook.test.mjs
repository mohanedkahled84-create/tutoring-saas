import test from 'node:test';
import assert from 'node:assert/strict';
import {processPortalDeliveryWebhook} from '../dist/features/whatsapp-notifications/portal-delivery-webhook.js';

test('records only valid provider receipts and propagates persistence failure for webhook retry',async()=>{
 const calls=[];const now=String(Math.floor(Date.now()/1000));
 const db={rpc:async(name,args)=>{calls.push({name,args});return {error:null};}};
 await processPortalDeliveryWebhook(db,{statuses:[{id:'wamid.fixture',status:'delivered',timestamp:now},{id:'not-a-meta-id',status:'read',timestamp:now},{id:'wamid.fixture',status:'bogus',timestamp:now},{id:'wamid.fixture',status:'read',timestamp:'invalid'}]});
 assert.equal(calls.length,1);assert.equal(calls[0].name,'portal_delivery_receipt');assert.equal(calls[0].args.p_status,'delivered');
 await assert.rejects(processPortalDeliveryWebhook({rpc:async()=>({error:new Error('db unavailable')})},{statuses:[{id:'wamid.fixture',status:'failed',timestamp:now}]}));
});
