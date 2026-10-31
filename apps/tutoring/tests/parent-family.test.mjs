import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {familyPhone,sealFamilyPassword,openFamilyPassword,deliverFamilyAccess,loginFamily,openFamilyAccount,familyHash} from '../dist/shared/utils/parentFamily.js';
import {config} from '../dist/shared/config/index.js';

test('family phones normalize local, international, Arabic and Persian digits without matching suffixes',()=>{
 for(const p of ['01012345678','+20 101-234-5678','00201012345678','٠١٠١٢٣٤٥٦٧٨','۰۱۰۱۲۳۴۵۶۷۸'])assert.equal(familyPhone(p),'201012345678');
 for(const p of ['',null,'student1001','123','01012%','01012,other'])assert.equal(familyPhone(p),null);
 assert.notEqual(familyPhone('201012345678'),familyPhone('971012345678'));
});
test('family passwords are authenticated encrypted at rest and bound to their phone',()=>{
 const original=config.internalApiSecret;config.internalApiSecret='isolated-family-key-not-a-real-secret-00000000';
 try{const a=sealFamilyPassword('unique-test-password','201012345678'),b=sealFamilyPassword('unique-test-password','201012345678');
 assert.notEqual(a,b);assert.ok(!a.includes('unique-test-password'));assert.equal(openFamilyPassword(a,'201012345678'),'unique-test-password');
 assert.throws(()=>openFamilyPassword(a,'201012345679'));assert.throws(()=>openFamilyPassword(a.slice(0,-4)+'AAAA','201012345678'));
 config.internalApiSecret='';assert.throws(()=>sealFamilyPassword('test','201012345678'),e=>e.status===503);
 }finally{config.internalApiSecret=original;}
});
test('disconnected sender cannot create a family or disclose credentials; staff input cannot choose recipient',async()=>{
 const calls=[],db={from:()=>({select:()=>({eq:(key,value)=>{calls.push([key,value]);return {eq:(key,value)=>{calls.push([key,value]);return {maybeSingle:async()=>({data:{parent_phone:'01012345678'},error:null})};}};}})}),rpc:async()=>{throw Error('must not provision');}};
 await assert.rejects(()=>deliverFamilyAccess(db,'own-tenant','own-student',{ready:async()=>false,send:async()=>{throw Error('must not send');}}),e=>e.status===503);
 assert.deepEqual(calls,[['id','own-student'],['tenant_id','own-tenant']]);
});
test('family delivery returns only status, resends the existing secret and never a child capability',async()=>{
 const original=config.internalApiSecret;config.internalApiSecret='isolated-family-key-not-a-real-secret-00000000';
 try{
 const existing=sealFamilyPassword('555444333222','201012345678'),out=[];
 const db={from:()=>({select:()=>({eq:()=>({eq:()=>({maybeSingle:async()=>({data:{parent_phone:'01012345678'},error:null})})})})}),rpc:async(name,args)=>{
 assert.equal(name,'parent_family_delivery');assert.equal(args.p_tenant_id,'tenant');assert.notEqual(args.p_hash,'555444333222');
 return {data:{phone:'201012345678',password_cipher:existing},error:null};}};
 const result=await deliverFamilyAccess(db,'tenant','student',{ready:async()=>true,send:async(...args)=>{out.push(args);return true;}});
 assert.deepEqual(Object.keys(result).sort(),['message','success']);assert.equal(result.success,true);
 assert.equal(out[0][0],'201012345678');assert.equal(out[0][1],'555444333222');assert.ok(out[0][2].endsWith('/portal?role=parent&family=1'));
 assert.ok(!JSON.stringify(result).includes('555444333222'));
 }finally{config.internalApiSecret=original;}
});
test('family login uses persistent phone/IP limits before password lookup',async()=>{
 const calls=[],db={rpc:async(name,args)=>{calls.push({name,args});return {data:false,error:null};},from:()=>{throw Error('no password work after rate limit');}};
 await assert.rejects(()=>loginFamily(db,'01012345678','child-password','https://centerly-eg.com','127.0.0.1'),e=>e.status===429);
 assert.equal(calls.length,2);assert.equal(calls[0].args.p_key,familyHash('phone:201012345678'));assert.ok(!JSON.stringify(calls).includes('01012345678'));
});
test('family authorization never accepts arbitrary child IDs or a student token',async()=>{
 const token='a'.repeat(43),calls=[],db={rpc:async(name)=>{calls.push(name);return {data:{students:[{id:'own',tenant_id:'tenant',name:'ابن'}]},error:null};}};
 await assert.rejects(()=>openFamilyAccount(db,'student-token','https://centerly-eg.com','other'),e=>e.status===401);
 await assert.rejects(()=>openFamilyAccount(db,token,'https://centerly-eg.com','other'),e=>e.status===403);
 assert.deepEqual(calls,['parent_family_directory']);
});
test('family selectors are conditional and escape identities; they do not offer manual child linking',async()=>{
 const source=await readFile(new URL('../../web/src/parentFamily.js',import.meta.url),'utf8');
 const pure=source.slice(source.indexOf('export function familyGroups'),source.indexOf('function snapshot'));
 const {familyGroups,renderFamilySelectors}=new Function('esc',pure.replaceAll('export function','function')+';return {familyGroups,renderFamilySelectors};')(s=>String(s).replaceAll('<','&lt;').replaceAll('"','&quot;'));
 const one={id:'one',name:'أحمد',teacher_name:'معلم ١'},second={id:'two',name:'أحمد',teacher_name:'معلم ٢'},sibling={id:'three',name:'منى <script>',teacher_name:'معلم ١'};
 assert.equal(familyGroups([one,second,sibling]).length,2);
 assert.ok(!renderFamilySelectors([one],'one').includes('<select'));
 const teachers=renderFamilySelectors([one,second],'two');assert.ok(!teachers.includes('id="family-child"'));assert.ok(teachers.includes('id="family-teacher"'));
 const siblings=renderFamilySelectors([one,sibling],'one');assert.ok(siblings.includes('id="family-child"'));assert.ok(!siblings.includes('id="family-teacher"'));assert.ok(!siblings.includes('<script>'));
 assert.ok(!source.includes('إضافة ابن'));
});
