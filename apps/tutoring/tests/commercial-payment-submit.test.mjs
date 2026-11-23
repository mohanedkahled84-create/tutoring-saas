import {test} from 'node:test';
import assert from 'node:assert/strict';
import {registerCommercialBillingActions} from '../../web/src/components/CommercialBillingView.js';

test('payment submission shows progress, blocks repeat clicks and preserves the receipt after rejection',async()=>{
 const saved=Object.fromEntries(['document','localStorage','sessionStorage','window','fetch'].map(k=>[k,globalThis[k]]));
 let rejectRequest,calls=0;
 const button={disabled:false,innerHTML:'Submit',setAttribute(){},removeAttribute(){}};
 const error={textContent:'',focus(){}};
 const fields={commercialProofError:error,commercialMethod:{value:'instapay'},commercialReference:{value:'test-reference'}};
 globalThis.localStorage={getItem:k=>k==='centrly_locale'?'en':k==='centrly_token'?'fixture-token':null};
 globalThis.sessionStorage={getItem:()=>null};globalThis.window={location:{hostname:'localhost'}};
 globalThis.document={getElementById:id=>fields[id]};
 globalThis.fetch=async()=>{calls++;return await new Promise((_,reject)=>rejectRequest=reject);};
 const app={user:{id:'fixture-user'},_commercialOrder:{id:'fixture-order'},_commercialReceipt:'data:image/png;base64,fixture'};
 try{
  registerCommercialBillingActions(app);
  const event={preventDefault(){},currentTarget:{querySelector:()=>button}};
  const pending=app.commercialSubmit(event);
  assert.equal(button.disabled,true);assert.match(button.innerHTML,/<progress/);
  await app.commercialSubmit(event);assert.equal(calls,1);
  rejectRequest(new Error('Test payment rejection'));await pending;
  assert.equal(button.disabled,false);assert.equal(button.innerHTML,'Submit');
  assert.equal(app._commercialReceipt,'data:image/png;base64,fixture');assert.ok(error.textContent);
 }finally{for(const [key,value] of Object.entries(saved))globalThis[key]=value;}
});
