import test from 'node:test';
import assert from 'node:assert/strict';
import {renderStartupChecklist} from '../../web/src/components/StartupChecklist.js';
import {renderSupportView} from '../../web/src/components/SupportView.js';
test('optional startup steps show actual completion without executable routes or customer text',()=>{
 const html=renderStartupChecklist([{title:'<img src=x>',done:true,route:'groups'},{title:'unfinished',done:false,route:'javascript:alert(1)'}]);
 assert.ok(html.includes('أنجزت 1 من 2'));assert.ok(html.includes('قائمة اختيارية'));assert.ok(html.includes('&lt;img'));assert.ok(!html.includes('javascript:'));assert.ok(!html.includes('<img'));
});
test('support requests escape teacher details and only use a configured valid WhatsApp contact',()=>{
 const data={contact_phone:'201123671177',tickets:[{id:'test',title:'<script>bad</script>',category:'account',status:'open',teacher_name:'<b>teacher</b>',teacher_phone:'201000000000',updated_at:'2026-11-03T00:00:00Z'}]};
 const owner=renderSupportView(data,{role:'owner',name:'fixture',phone:'201000000000'});assert.ok(owner.includes('https://wa.me/201123671177?text='));assert.ok(!owner.includes('<script>'));assert.ok(owner.includes('طلب مساعدة جديد'));
 const admin=renderSupportView(data,{role:'admin'});assert.ok(admin.includes('201000000000'));assert.ok(!admin.includes('<b>teacher</b>'));assert.ok(!admin.includes('طلب مساعدة جديد'));
 assert.ok(!renderSupportView({contact_phone:'javascript:alert(1)'},{role:'owner'}).includes('wa.me/'));
});
