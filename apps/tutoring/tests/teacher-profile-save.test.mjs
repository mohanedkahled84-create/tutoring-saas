import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {settingsRouter} from '../dist/features/auth/settingsRoutes.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
test('teacher profile saves use a trusted atomic operation; a legacy phone edit stops before partial settings writes',async t=>{
 const calls=[];let failure=null,assistant=false;const db={rpc:async(name,args)=>{calls.push([name,args]);return failure?{error:failure}:{data:{success:true,user:{id:args.p_user}}};},from(){throw Error('No direct partial identity writes');}};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.supabase=db;req.user={id:'trusted-user',tenant_id:'trusted-tenant',role:'owner',phone:'201000000001',...(assistant?{assistant_id:'helper'}:{})};delegatedClientScope.run(db,next);});app.use('/settings',settingsRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const send=(method,path,body)=>fetch(`http://127.0.0.1:${server.address().port}/settings`+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify(body)}),body={teacher_name:'fixture',subject:'math',phone:'01000000001',contact_phone:'01000000001'};
 assert.equal((await send('POST','/profile',body)).status,200);assert.equal(calls[0][0],'save_teacher_profile');assert.equal(calls[0][1].p_user,'trusted-user');assert.equal(calls[0][1].p_tenant,'trusted-tenant');
 assert.equal((await send('PUT','',{phone:'01000000002',teacher_name:'not saved'})).status,409);assert.equal(calls.length,1);
 assert.equal((await send('POST','/profile',{...body,user_id:'spoof'})).status,400);assert.equal(calls.length,1);
 assistant=true;assert.equal((await send('POST','/profile',body)).status,403);assistant=false;
 failure={code:'23514',message:'PHONE_CHANGE_REQUIRES_VERIFICATION'};assert.equal((await send('POST','/profile',body)).status,409);
});
