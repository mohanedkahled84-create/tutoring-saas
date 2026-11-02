import test from 'node:test';
import assert from 'node:assert/strict';
import {createMetaPortalWorker} from '../dist/features/whatsapp-notifications/meta-portal-worker.js';
test('portal worker does not overlap runs, can recover after a failure and stops without sending again',async()=>{
 let release,calls=0,errors=0;
 const worker=createMetaPortalWorker({processScheduledQueue:async()=>{calls++;await new Promise(resolve=>release=resolve);if(calls===1)throw Error('private provider detail');}},()=>errors++);
 const first=worker.tick();assert.equal(await worker.tick(),false);assert.equal(calls,1);release();assert.equal(await first,false);assert.equal(errors,1);
 const second=worker.tick();assert.equal(calls,2);release();assert.equal(await second,true);worker.stop();assert.equal(await worker.tick(),false);assert.equal(calls,2);
});
