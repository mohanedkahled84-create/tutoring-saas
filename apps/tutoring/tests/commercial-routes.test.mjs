import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {once} from 'node:events';
import {commercialBillingRouter} from '../dist/features/billing/commercialRoutes.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
test('commercial HTTP flow uses authenticated actor and validates quotes, receipts and failures',{timeout:15000},async()=>{
 let user={id:'11111111-1111-4111-8111-111111111111',tenant_id:'tenant',role:'owner'},calls=[],reply={data:{id:'22222222-2222-4222-8222-222222222222',amount_piasters:24900},error:null};
 const db={rpc:async(name,args)=>{calls.push({name,args});return reply;}};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user=user;delegatedClientScope.run(db,next);});app.use('/commercial',commercialBillingRouter);
 const server=app.listen(0,'127.0.0.1');await once(server,'listening');
 const send=(path,body)=>fetch(`http://127.0.0.1:${server.address().port}/commercial${path}`,body===undefined?{}:{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 const id='22222222-2222-4222-8222-222222222222';
 try{
  let res=await send('/orders',{id,kind:'subscribe',plan_id:'basic_v1',amount_piasters:1});assert.equal(res.status,400);assert.equal(calls.length,0);
  res=await send('/orders',{id,kind:'subscribe',plan_id:'basic_v1'});assert.equal(res.status,200);assert.equal((await res.json()).amount_piasters,24900);assert.equal(calls.at(-1).args.p_user,user.id);assert.ok(res.headers.get('cache-control').includes('no-store'));
  res=await send(`/orders/${id}/submit`,{payment_method:'instapay',reference:'fixture-ref',proof_image_url:'https://untrusted.invalid/x.png'});assert.equal(res.status,400);assert.equal(calls.length,1);
  res=await send(`/orders/${id}/submit`,{payment_method:'instapay',reference:'fixture-ref'});assert.equal(res.status,200);assert.equal(calls.at(-1).args.p_action,'submit');
  user={...user,assistant_id:'assistant'};const count=calls.length;res=await send('/');assert.equal(res.status,403);assert.equal(calls.length,count);
  user={...user,assistant_id:null};reply={data:null,error:{code:'23514',message:'SUBSCRIPTION_CHANGED'}};res=await send(`/admin/orders/${id}/approve`,{});assert.equal(res.status,409);assert.equal((await res.json()).error.code,'SUBSCRIPTION_CHANGED');
  reply={data:null,error:{code:'42501',message:'FORBIDDEN'}};res=await send(`/admin/orders/${id}/approve`,{});assert.equal(res.status,403);
 }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});
