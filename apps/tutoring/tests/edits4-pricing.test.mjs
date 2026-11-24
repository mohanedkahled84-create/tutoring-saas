import test from 'node:test';
import assert from 'node:assert/strict';
import {cyclePrice} from '../../web/src/utils/subscriptionPricing.js';
import {transparentPixels} from '../../web/src/utils/teacherCutout.js';
test('approved period prices use the current monthly rate and reject other periods',()=>{
 assert.deepEqual(cyclePrice(79900,6),{before:479400,total:407490,months:6,discount:15});
 assert.deepEqual(cyclePrice(79900,12),{before:958800,total:719100,months:12,discount:25});
 assert.equal(cyclePrice(79900).before,95880);assert.equal(cyclePrice(79900).total,79900);
 assert.throws(()=>cyclePrice(79900,3));
});
test('opaque PNG and fully empty images cannot masquerade as a teacher cutout',()=>{
 assert.equal(transparentPixels(new Uint8ClampedArray([0,0,0,255,0,0,0,255])),false);
 assert.equal(transparentPixels(new Uint8ClampedArray([0,0,0,0,0,0,0,0])),false);
 assert.equal(transparentPixels(new Uint8ClampedArray([0,0,0,0,0,0,0,255])),true);
});
