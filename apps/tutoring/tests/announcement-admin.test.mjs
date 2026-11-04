import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {announcementAdminRouter} from '../dist/features/announcements/adminRoutes.js';
import {announcementTemplateSeeds} from '../dist/features/announcements/catalog.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
import {config} from '../dist/shared/config/index.js';
test('administrator template submission is Utility only, repeat-safe and requires exact live approval before a separate activation',async t=>{
 const nativeFetch=globalThis.fetch,old={...config.meta};config.meta.accessToken='fixture-only';config.meta.wabaId='fixture-waba';
 let role='owner',kind=null,live=null,posts=0,operations=[];
 globalThis.fetch=async(input,options)=>{
  assert.match(String(input),/^https:\/\/graph.facebook.com\/v21.0\/fixture-waba\/message_templates/);
  if(options?.method==='POST'){posts++;const payload=JSON.parse(options.body);assert.equal(payload.category,'UTILITY');assert.equal(payload.language,'ar');assert.equal(payload.components[0].example.body_text[0].length,payload.components[0].text.match(/\{\{\d+\}\}/g).length);live={id:'123456789',name:payload.name,status:'PENDING',category:'UTILITY',language:'ar',components:payload.components};return Response.json({id:live.id,status:'PENDING',category:'UTILITY'});}
  return Response.json({data:live?[live]:[]});
 };
 const db={rpc:async(name,args)=>{assert.equal(name,'announcement_admin');operations.push(args.p_action);const data=args.p_data;if(args.p_action==='list')return {data:{catalog:kind?[kind]:[],requests:[]}};if(args.p_action==='prepare'){const submit=!kind;kind ||= {...data,meta_name:data.name,meta_id:null,official_enabled:false};return {data:{type:kind,submit}};}if(args.p_action==='provider'){kind={...kind,meta_id:data.meta_id,provider_status:data.status,provider_category:data.category,official_enabled:kind.official_enabled && data.matched};return {data:{type:kind}};}if(args.p_action==='enable')kind.official_enabled=true;return {data:{type:kind}};}};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:'fixture-admin',role};delegatedClientScope.run(db,next);});app.use('/admin',announcementAdminRouter);const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{globalThis.fetch=nativeFetch;Object.assign(config.meta,old);server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}/admin`,post=(path,body)=>nativeFetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await nativeFetch(base)).status,403);assert.equal(operations.length,0);role='admin';
 const {id,...definition}=announcementTemplateSeeds[0],body={definition,examples:definition.fields.map(()=> 'مثال للمراجعة'),confirm_utility:true};
 assert.equal((await post('/types',{...body,confirm_utility:false})).status,400);assert.equal(posts,0);
 assert.equal((await post('/types',body)).status,200);assert.equal(posts,1);assert.equal(kind.official_enabled,false);
 assert.equal((await post('/types',body)).status,200);assert.equal(posts,1);
 assert.equal((await post('/types/'+definition.key+'/enable',{})).status,409);
 live.status='APPROVED';live.category='MARKETING';assert.equal((await post('/types/'+definition.key+'/enable',{})).status,409);assert.equal(kind.official_enabled,false);
 live.category='UTILITY';assert.equal((await post('/types/'+definition.key+'/refresh',{})).status,200);assert.equal(kind.official_enabled,false);
 assert.equal((await post('/types/'+definition.key+'/enable',{})).status,200);assert.equal(kind.official_enabled,true);assert.equal(posts,1);
 live.components[0].text+=' نص مختلف';assert.equal((await post('/types/'+definition.key+'/refresh',{})).status,200);assert.equal(kind.official_enabled,false);
});
