import test from 'node:test';
import assert from 'node:assert/strict';
import {renderParentPortalLogin,saveParentBranding,getParentBranding} from '../../web/src/components/ParentPortalLoginView.js';
test('dedicated parent login preserves public teacher identity without role tabs or remembered credentials',()=>{
 const html=renderParentPortalLogin('',{display_title:'منصة <مدرس>',theme_preset:'emerald'});
 assert.ok(html.includes('منصة &lt;مدرس&gt;'));
 assert.ok(html.includes('value="parent"'));
 for(const forbidden of ['portalTabStudent','portalTabParent','portalRememberMe','العودة للصفحة الرئيسية','value="123456"'])assert.ok(!html.includes(forbidden));
 assert.ok(html.includes('autocomplete="current-password"'));
 assert.ok(html.includes('min-height:52px'));
});
test('logout branding persistence stores only public fields and is origin-bound',()=>{
 const previousStorage=globalThis.localStorage,previousLocation=globalThis.location,rows=new Map();
 globalThis.localStorage={setItem:(k,v)=>rows.set(k,v),getItem:k=>rows.get(k)||null};globalThis.location={origin:'https://teacher.centerly-eg.com'};
 try {
  saveParentBranding({display_title:'مدرس',subdomain:'teacher',token:'SECRET',student:{name:'SECRET'},teacher_phone:'SECRET'});
  assert.equal(getParentBranding().display_title,'مدرس');
  assert.ok(!JSON.stringify([...rows.values()]).includes('SECRET'));
  globalThis.location.origin='https://other.centerly-eg.com';assert.equal(getParentBranding(),null);
 }finally{globalThis.localStorage=previousStorage;globalThis.location=previousLocation;}
});
