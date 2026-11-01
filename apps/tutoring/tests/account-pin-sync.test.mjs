import test from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import {settingsRouter} from '../dist/features/auth/settingsRoutes.js';
import {profileHasSecurityPin} from '../dist/shared/middleware/auth.js';
test('retired financial PIN is reported off across cached devices and cannot be configured or reset',async t=>{
 let calls=0;const app=express();app.use(express.json());app.use((req,res,next)=>{req.user={id:'owner',tenant_id:'tenant',role:'owner',has_security_pin:true};req.services=new Proxy({},{get(){calls++;throw new Error('retired PIN must not access account or email storage');}});next();});app.use('/api/settings',settingsRouter);
 const server=app.listen(0);await new Promise(r=>server.once('listening',r));t.after(()=>{server.closeAllConnections();server.close();});const base=`http://127.0.0.1:${server.address().port}/api/settings`;
 for(let device=0;device<2;device++){const response=await fetch(base+'/security-pin');assert.equal(response.status,200);const data=await response.json();assert.deepEqual(data,{has_pin:false,retired:true});assert.ok(!JSON.stringify(data).includes('hash'));}
 for(const [method,path] of [['POST','/security-pin'],['DELETE','/security-pin'],['POST','/verify-pin'],['POST','/security-pin/request-reset']]){const response=await fetch(base+path,{method,headers:{'Content-Type':'application/json'},body:JSON.stringify({pin:'1234',email_code:'private-code'})});assert.equal(response.status,410);const data=await response.json();assert.equal(data.error.code,'FINANCIAL_PIN_RETIRED');assert.ok(!JSON.stringify(data).includes('private-code'));}
 assert.equal(calls,0);assert.equal(profileHasSecurityPin({has_security_pin:true,financial_pin_hash:'old-hash'}),false);
});
