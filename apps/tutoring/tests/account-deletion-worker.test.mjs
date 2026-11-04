import test from 'node:test';
import assert from 'node:assert/strict';
import {createAccountDeletionWorker} from '../dist/features/auth/accountDeletionWorker.js';
import {redactPhoneAuthTelemetry} from '../dist/shared/utils/phoneAuthRedaction.js';
test('deletion cleans stored objects through the Storage API before database and Auth cleanup, then checkpoints completion',async()=>{
 const actions=[],job={id:'fixture-job',lease_id:'fixture-lease',phase:'storage',user_ids:['fixture-owner']};let files=true;
 const db={rpc:async(_name,args)=>{actions.push(args.p_action);return {data:args.p_action==='claim'?job:args.p_action==='files'?files?[{bucket:'homework-private',path:'fixture-tenant/material/file.pdf'}]:[]:{updated:true}};},storage:{from:bucket=>({remove:async paths=>{assert.equal(bucket,'homework-private');assert.deepEqual(paths,['fixture-tenant/material/file.pdf']);actions.push('remove-storage');files=false;return {};}})},auth:{admin:{deleteUser:async id=>{assert.equal(id,'fixture-owner');actions.push('delete-auth');return {};}}}};
 await createAccountDeletionWorker(db).tick();assert.deepEqual(actions,['claim','files','remove-storage','files','storage_done','data','delete-auth','auth_deleted','done']);
});
test('storage failure leaves business data and Auth intact for a scoped retry',async()=>{
 const actions=[];let errors=0;
 const db={rpc:async(_name,args)=>{actions.push(args.p_action);return {data:args.p_action==='claim'?{id:'fixture-job',lease_id:'fixture-lease',phase:'storage',user_ids:['fixture-owner']}:[{bucket:'homework-private',path:'fixture-tenant/file.pdf'}]};},storage:{from:()=>({remove:async()=>({error:{message:'fixture unavailable'}})})},auth:{admin:{deleteUser:async()=>{throw Error('must not delete Auth');}}}};
 await createAccountDeletionWorker(db,()=>errors++).tick();assert.deepEqual(actions,['claim','files','failed']);assert.equal(errors,1);
});
test('a retry after Auth deletion accepts only not-found as an already-completed operation',async()=>{
 for(const error of [{status:404,code:'user_not_found'},{status:503,code:'service_unavailable'}]){
  const actions=[];const db={rpc:async(_name,args)=>{actions.push(args.p_action);return {data:args.p_action==='claim'?{id:'fixture-job',lease_id:'fixture-lease',phase:'auth',user_ids:['fixture-owner']}:null};},auth:{admin:{deleteUser:async()=>({error})}}};
  await createAccountDeletionWorker(db).tick();assert.deepEqual(actions,error.status===404?['claim','auth_deleted','done']:['claim','failed']);
 }
});
test('deletion authorization and receipt tokens are filtered from structured and encoded telemetry',()=>{
 const result=redactPhoneAuthTelemetry({request:{data:JSON.stringify({deletion_token:'private-deletion-ticket',receipt_token:'private-receipt',authorization_hash:'private-hash',receipt_hash:'private-receipt-hash'})}});
 assert.ok(!JSON.stringify(result).includes('private-'));
});
