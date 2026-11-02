import test from 'node:test';
import assert from 'node:assert/strict';
import {funnelPayload} from '../../web/src/services/productFunnel.js';
import {renderProductWalkthrough} from '../../web/src/components/ProductWalkthrough.js';
test('product demo follows the same attendance state across teacher and parent and explains locked assistant rights',()=>{
 assert.match(renderProductWalkthrough({role:'teacher'}),/تسجيل حضور تجريبي/);
 assert.match(renderProductWalkthrough({role:'parent',attended:false}),/لم يُسجّل الحضور بعد/);
 assert.match(renderProductWalkthrough({role:'parent',attended:true}),/<dd>حاضر<\/dd>/);
 assert.match(renderProductWalkthrough({role:'assistant'}),/الأرباح · مقفولة/);
 assert.doesNotMatch(renderProductWalkthrough({role:'<script>bad</script>'}),/<script>/);
});
test('conversion events accept only known steps and contain no arbitrary properties, queries or personal fields',()=>{
 assert.equal(funnelPayload('student_phone','session'),null);
 assert.deepEqual(funnelPayload('signup_complete','session'),{events:[{event_name:'product.signup_complete',page_path:'/signup',session_id:'session'}]});
 const payload=JSON.stringify(funnelPayload('session_started','session'));assert.ok(!/phone|email|student_id|properties|workspace=/.test(payload));
});
