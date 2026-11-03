import test from 'node:test';
import assert from 'node:assert/strict';
import {resolveStudentSession} from '../../web/src/utils/portalSession.js';
import {createPortalCache} from '../../web/src/utils/portalCache.js';
test('a session-only student can reopen and cache the portal without promoting the token to persistent storage',async t=>{
 const previous={localStorage:globalThis.localStorage,sessionStorage:globalThis.sessionStorage,location:globalThis.location};
 const storage=()=>{const rows=new Map();return {getItem:key=>rows.get(key) || null,setItem:(key,value)=>rows.set(key,String(value)),removeItem:key=>rows.delete(key)};};
 globalThis.localStorage=storage();globalThis.sessionStorage=storage();globalThis.location={hash:'',search:'',origin:'https://centerly-eg.com'};
 t.after(()=>Object.assign(globalThis,previous));sessionStorage.setItem('centrly_portal_token','session-fixture');sessionStorage.setItem('centrly_portal_role','student');
 assert.equal(await resolveStudentSession(),'session-fixture');const cache=createPortalCache({hash:async()=> 'fixture-hash'});
 await cache.write('session-fixture',{student:{id:'student',tenant_id:'tenant'},summary:{}},'student');assert.equal((await cache.read('session-fixture','student')).data.student.id,'student');assert.equal(localStorage.getItem('centrly_portal_token'),null);assert.equal(localStorage.getItem('centrly_portal_snapshot_v1:student'),null);
 localStorage.setItem('centrly_portal_token','another-parent-session');localStorage.setItem('centrly_portal_role','parent');assert.equal(await resolveStudentSession(),null);assert.equal(await cache.read('session-fixture','student'),null);
});
