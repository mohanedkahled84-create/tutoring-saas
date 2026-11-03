import test from 'node:test';
import assert from 'node:assert/strict';
import {createQuizAttemptWorker} from '../dist/shared/routes/quizAttemptWorker.js';
test('expired quiz worker avoids overlapping batches, reports failure and stops cleanly',async()=>{
 let calls=0,release,errors=0;const worker=createQuizAttemptWorker({rpc:async(name,args)=>{assert.equal(name,'portal_quiz_finalize_expired');assert.deepEqual(args,{p_limit:50});calls++;return new Promise(resolve=>release=resolve);}},()=>errors++);
 const flight=worker.tick();await worker.tick();assert.equal(calls,1);release({error:{code:'unavailable'}});await flight;assert.equal(errors,1);worker.stop();await worker.tick();assert.equal(calls,1);
});
