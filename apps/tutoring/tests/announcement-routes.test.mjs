import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {announcementsRouter} from '../dist/features/announcements/routes.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
import {announcementTemplateSeeds} from '../dist/features/announcements/catalog.js';
const id='10000000-0000-4000-8000-000000000001',group='20000000-0000-4000-8000-000000000001';
test('HTTP previews generate parameters, identity and links on the server; client-forged send bodies are rejected',async t=>{
 const calls=[],type=announcementTemplateSeeds.find(t=>t.key==='class_reminder');let failure=null;
 const db={rpc:async(name,args)=>{
  calls.push([name,args]);if(failure)return {error:failure};
  if(name==='portal_tenant_context')return {data:{}};
  if(args.p_action==='catalog')return {data:[{...type,meta_name:type.name,meta_id:type.id}]};
  if(args.p_action==='list' || args.p_action==='requests')return {data:[]};
  if(args.p_action==='candidates')return {data:{announcement:{id,revision:1,type_key:type.key,values:{topic:'الفيزياء',event_time:'2026-11-04T18:00',location:'القاعة'},manual_body:null},contacts:[{phone:'201000000001',recipient_role:'parent',group_ids:[group],group_names:['الأحد'],consented:true,opted_out:false}],allowance:null}};
  return {data:{preview_id:id}};
 }};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:'verified-owner',tenant_id:'verified-tenant',role:'owner',full_name:'أحمد حسن',phone:'01000000000',assistant_id:'verified-helper'};delegatedClientScope.run(db,next);});app.use('/announcements',announcementsRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const base=`http://127.0.0.1:${server.address().port}/announcements`,post=(path,body)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const list=await (await fetch(base)).json();assert.ok(Array.isArray(list.catalog));assert.deepEqual(list.announcements,[]);
 const response=await post('/'+id+'/preview',{});assert.equal(response.status,200);const result=await response.json();assert.equal(result.rows[0].parameters.length,type.fields.length);assert.ok(result.rows[0].rendered_body.includes('أحمد حسن'));
 const preview=calls.find(([name,args])=>name==='announcement_queue' && args.p_action==='preview')[1];assert.equal(preview.p_user,'verified-owner');assert.equal(preview.p_assistant,'verified-helper');assert.equal(preview.p_data.rows[0].parameters.at(-1),'201000000000');
 const before=calls.length;assert.equal((await post('/'+id+'/enqueue',{phones:['201000000002'],parameters:['forged'],p_user:'forged'})).status,400);assert.equal(calls.length,before);
 failure={code:'42501',message:'FORBIDDEN'};assert.equal((await fetch(base)).status,403);
 failure={code:'23514',message:'TEMPLATE_NOT_ENABLED'};assert.equal((await post('/'+id+'/enqueue',{preview_id:id,expected_revision:1,phones:['201000000001'],unit_cost_egp:0.5})).status,409);
});
