import {test} from 'node:test';
import assert from 'node:assert/strict';
import {renderCommercialBillingView,registerCommercialBillingActions} from '../../web/src/components/CommercialBillingView.js';
const plan={id:'pro_v1',name:'Pro',rank:2,price_piasters:79900,student_piasters:150,students:300,storage_bytes:15000000000,assistants:4,teaching_platform:true,initial_gift_piasters:10000,renewal_gift_piasters:0};
const commercial={limits:{plan_id:'pro_v1',is_trial:false,active:true,period_end:'2027-01-01T00:00:00Z',recurring_piasters:79900,students:300,storage_bytes:15000000000,assistants:4},catalog:[plan],students_used:25,storage_bytes_used:1000000000,assistants_used:1,orders:[{kind:'renew',amount_piasters:79900,state:'submitted',created_at:'2026-11-01'}],addons:[]};
test('billing preserves values and payment status in both locales',()=>{
 const previous=globalThis.localStorage;let locale='en';globalThis.localStorage={getItem:()=>locale};
 try{const en=renderCommercialBillingView({commercial});assert.match(en,/dir="ltr"/);assert.match(en,/799 EGP/);assert.match(en,/Payment under review/);assert.doesNotMatch(en,/[\u0600-\u06ff]/);locale='ar';const ar=renderCommercialBillingView({commercial});assert.match(ar,/dir="rtl"/);assert.match(ar,/قيد مراجعة الدفع/);assert.match(ar,/٧٩٩/);}finally{globalThis.localStorage=previous;}
});
test('payment and quantity forms follow the selected locale',()=>{
 const previous=globalThis.localStorage;let locale='en';globalThis.localStorage={getItem:()=>locale};let modal;
 try{const app={user:{id:'u'},billingState:{commercial},showModal:(...args)=>modal=args};registerCommercialBillingActions(app);app.commercialAdd('students');assert.match(modal[1],/additional student seats/);app._commercialOrder={id:'x',kind:'renew',amount_piasters:79900,snapshot:{plan,addons:{students:0,assistants:0,storage:0}}};app.commercialOpenOrder('x');assert.match(modal[1],/799 EGP/);assert.match(modal[1],/Submit payment for review/);assert.doesNotMatch(modal[1],/[\u0600-\u06ff]/);locale='ar';app.commercialOpenOrder('x');assert.match(modal[1],/تسجيل الدفع للمراجعة/);}finally{globalThis.localStorage=previous;}
});
