import test from 'node:test';
import assert from 'node:assert/strict';
import {cyclePrice} from '../../web/src/utils/subscriptionPricing.js';
import {transparentPixels,validateCutoutFile,renderCutoutHelpBox,renderCutoutErrorHtml,CUTOUT_SUPPORT_WHATSAPP_URL} from '../../web/src/utils/teacherCutout.js';
test('approved period prices use the current monthly rate and reject other periods',()=>{
 assert.deepEqual(cyclePrice(79900,6),{before:479400,total:407490,months:6,discount:15});
 assert.deepEqual(cyclePrice(79900,12),{before:958800,total:719100,months:12,discount:25});
 assert.equal(cyclePrice(79900).before,100000);assert.equal(cyclePrice(79900).total,79900);
 assert.equal(cyclePrice(24900,1,'basic_v1').before,35000);assert.equal(cyclePrice(99900,1,'max_v1').before,125000);
 assert.throws(()=>cyclePrice(79900,3));
});
test('opaque PNG and fully empty images cannot masquerade as a teacher cutout',()=>{
 assert.equal(transparentPixels(new Uint8ClampedArray([0,0,0,255,0,0,0,255])),false);
 assert.equal(transparentPixels(new Uint8ClampedArray([0,0,0,0,0,0,0,0])),false);
 assert.equal(transparentPixels(new Uint8ClampedArray([0,0,0,0,0,0,0,255])),true);
});
test('teacher cutout file check rejects non-PNG with clear reason and help card includes WhatsApp support link',()=>{
 assert.throws(()=>validateCutoutFile({type:'image/jpeg',name:'photo.jpg',size:1024}),/PNG/);
 assert.throws(()=>validateCutoutFile({type:'image/png',name:'huge.png',size:6*1024*1024}),/5 MB|٥ ميجابايت/);
 assert.doesNotThrow(()=>validateCutoutFile({type:'image/png',name:'cutout.png',size:500000}));
 assert.match(CUTOUT_SUPPORT_WHATSAPP_URL,/^https:\/\/wa\.me\/201123671177\?text=/);
 const help=renderCutoutHelpBox(),err=renderCutoutErrorHtml('ليست PNG');
 assert.match(help,/remove\.bg/);assert.match(help,/wa\.me\/201123671177/);
 assert.match(err,/ليست PNG/);assert.match(err,/remove\.bg/);assert.match(err,/wa\.me\/201123671177/);
});
