import test from 'node:test';
import assert from 'node:assert/strict';
import {createPortalHandoff,consumePortalHandoff,verifiedPortalStudent} from '../dist/shared/utils/portalDestination.js';
import {generateParentPortalToken} from '../dist/shared/utils/tokens.js';

test('verified student identity and current destination use one context read',async()=>{
  const calls=[],token=generateParentPortalToken('student-a','tenant-a');
  const db={rpc:async(name,args)=>{calls.push({name,args});return{data:{id:'student-a',tenant_id:'tenant-a',group_ids:[]},error:null};}};
  assert.equal((await verifiedPortalStudent(db,token)).id,'student-a');
  assert.equal(calls.length,1);assert.equal(calls[0].name,'portal_student_context');
  assert.equal(calls[0].args.p_token,null);assert.equal(calls[0].args.p_tenant_id,'tenant-a');
});

test('an unresolved expired-ticket cleanup cannot delay issuing a handoff',{timeout:1000},async()=>{
  let inserted=false,cleaning=false;
  const db={from:()=>({insert:async()=>{inserted=true;return{error:null};},delete:()=>({lt:()=>{cleaning=true;return new Promise(()=>{});}})})};
  const ticket=await createPortalHandoff(db,{id:'student-a',tenant_id:'tenant-a',expires_at:Math.floor(Date.now()/1000)+300},'student','https://mr-omar.centerly-eg.com');
  assert.equal(inserted,true);assert.equal(cleaning,true);assert.match(ticket,/^[A-Za-z0-9_-]{43}$/);
});

test('handoff redemption needs one atomic call and still rejects changed publication',async()=>{
  const calls=[],origin='https://mr-omar.centerly-eg.com';
  const context={id:'student-a',tenant_id:'tenant-a',bound_subdomain:'mr-omar',platform:{is_active:true,subdomain:'mr-omar'}};
  const db={rpc:async(name,args)=>{calls.push({name,args});return{data:{context,student_id:'student-a',tenant_id:'tenant-a',portal_role:'student',session_expires_at:Math.floor(Date.now()/1000)+300},error:null};}};
  assert.equal((await consumePortalHandoff(db,'a'.repeat(43),origin)).role,'student');
  assert.equal(calls.length,1);assert.equal(calls[0].name,'consume_portal_entry_handoff');
  context.platform.is_active=false;
  assert.equal(await consumePortalHandoff(db,'b'.repeat(43),origin),null);
  const before=calls.length;assert.equal(await consumePortalHandoff(db,'c'.repeat(43),'https://evil.invalid'),null);assert.equal(calls.length,before);
});
