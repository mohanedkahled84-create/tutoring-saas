import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {sessionsRouter} from '../dist/features/sessions/routes.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';

test('default active-session listing uses a valid yearly range rather than a rejected ten-year query',async t=>{
 let dates;
 const app=express();app.use((req,_res,next)=>{req.user={id:'owner',tenant_id:'tenant',role:'owner'};req.services={sessions:{getCalendarSessions:async(_tenant,from,to)=>{assert.ok(Date.parse(to)-Date.parse(from)<=366*86400000);dates=[from,to];return [{id:'active',status:'in_progress'}];}}};next();});app.use('/sessions',sessionsRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});
 const response=await fetch(`http://127.0.0.1:${server.address().port}/sessions?status=in_progress`);assert.equal(response.status,200);assert.equal((await response.json()).sessions[0].id,'active');assert.match(dates[0],/-01-01$/);assert.match(dates[1],/-12-31$/);
});
test('schedule routes save with trusted actor, never dispatch implicitly, and refuse the retired bulk-send path',async t=>{
 const calls=[];let failure=null;const id='10000000-0000-4000-8000-000000000001';
 const db={rpc:async(name,args)=>{calls.push([name,args]);return failure?{error:failure}:{data:{session:{id,status:'scheduled'},notifications_dispatched:0}};},from(){throw Error('Schedule writes must use the atomic private operation');}};
 const app=express();app.use(express.json());app.use((req,_res,next)=>{req.user={id:'verified-owner',tenant_id:'verified-tenant',assistant_id:'verified-helper',role:'owner'};delegatedClientScope.run(db,next);});app.use('/sessions',sessionsRouter);
 const server=app.listen(0,'127.0.0.1');await new Promise(resolve=>server.once('listening',resolve));t.after(()=>{server.closeAllConnections();server.close();});
 const post=(path,body)=>fetch(`http://127.0.0.1:${server.address().port}/sessions/`+path,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});
 assert.equal((await post('schedule-change',{action:'reschedule',id,is_group:true,session_date:'2026-11-03',new_date:'2026-11-04',new_time:'18:30'})).status,200);
 assert.equal(calls[0][0],'session_schedule_change');assert.equal(calls[0][1].p_user,'verified-owner');assert.equal(calls[0][1].p_assistant,'verified-helper');assert.equal(calls[0][1].p_tenant,'verified-tenant');
 assert.equal((await post(id+'/cancel',{notify_parents:true,reason:'fixture'})).status,200);assert.equal(calls.at(-1)[1].p_action,'cancel');
 const before=calls.length;assert.equal((await post(id+'/notify-students',{group_id:id})).status,410);assert.equal((await post(id+'/send-messages',{})).status,410);assert.equal((await post(id+'/resend/student',{})).status,410);assert.equal(calls.length,before);
 assert.equal((await post('schedule-change',{action:'reschedule',id,tenant_id:'forged'})).status,400);assert.equal(calls.length,before);
 assert.equal((await post('start',{group_id:id,session_id:id})).status,200);assert.equal(calls.at(-1)[1].p_action,'start');
 failure={code:'23514',message:'SESSION_HAS_RECORDS'};assert.equal((await post(id+'/cancel',{})).status,409);
});
