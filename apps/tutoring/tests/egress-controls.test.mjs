import test from 'node:test';
import assert from 'node:assert/strict';
import {publicCatalogCache} from '../dist/shared/utils/publicCatalogCache.js';

test('public catalog coalesces concurrent reads, expires, and never caches failures',async()=>{
 let now=0,calls=0,release;
 const read=publicCatalogCache(async()=>{calls++;return new Promise(r=>{release=r;});},60,()=>now);
 const batch=Array.from({length:100},()=>read());await Promise.resolve();assert.equal(calls,1);
 release(['basic']);await Promise.all(batch);assert.deepEqual(await read(),['basic']);assert.equal(calls,1);
 now=61;const next=read();await Promise.resolve();assert.equal(calls,2);release(['pro']);assert.deepEqual(await next,['pro']);
 let attempts=0;const retry=publicCatalogCache(async()=>{if(++attempts===1)throw Error('offline');return [];});
 await assert.rejects(retry(),/offline/);assert.deepEqual(await retry(),[]);assert.equal(attempts,2);
});

