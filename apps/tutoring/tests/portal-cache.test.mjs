import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../../web/src/utils/portalCache.js', import.meta.url), 'utf8');
const {createPortalCache, PORTAL_CACHE_PREFIX, PORTAL_FRESH_MS, PORTAL_MAX_AGE_MS} = await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
const payload = name => ({student:{id:'student-a',tenant_id:'tenant-a',name},summary:{attendance_rate:'80%'},materials:[{id:'hw',title:'واجب قديم',submission_url:'https://files.test/storage/v1/object/sign/homework-submissions/file?token=private'}]});
function setup() {
  const records = new Map([['centrly_portal_token','session-a'],['centrly_portal_role','student']]);
  const storage = {getItem:key=>records.get(key)??null,setItem:(key,value)=>records.set(key,value),removeItem:key=>records.delete(key)};
  let now=1000000000;
  const cache=createPortalCache({storage,clock:()=>now});
  return {records,storage,cache,advance:ms=>{now+=ms;}};
}
test('fresh verified snapshots render without any new API request and do not store the reusable token',async()=>{
  const {cache,records}=setup();await cache.write('session-a',payload('الطالب أ'));
  let calls=0,shown;
  await cache.load('session-a',{request:async()=>{calls++;throw Error('must not fetch');},onData:data=>{shown=data;}});
  assert.equal(calls,0);assert.equal(shown.student.name,'الطالب أ');
  const saved=records.get(PORTAL_CACHE_PREFIX+'student');assert.ok(!saved.includes('session-a'));assert.equal(JSON.parse(saved).session.length,64);
});
test('stale snapshots render before the network settles, then apply authoritative updates and deletions',async()=>{
  const {cache,advance}=setup();await cache.write('session-a',payload('قديم'));advance(PORTAL_FRESH_MS+1);
  let resolve,started;const began=new Promise(r=>{started=r;}),shown=[];
  const pending=cache.load('session-a',{request:()=>{started();return new Promise(r=>{resolve=r;});},onData:data=>shown.push(data)});
  await began;assert.equal(shown[0].student.name,'قديم');
  resolve({...payload('حديث'),materials:[]});await pending;
  assert.equal(shown.at(-1).student.name,'حديث');assert.deepEqual(shown.at(-1).materials,[]);
});
test('an unavailable server preserves the last snapshot with an explicit stale result',async()=>{
  const {cache,advance}=setup();await cache.write('session-a',payload('محفوظ'));advance(PORTAL_FRESH_MS+1);
  const result=await cache.load('session-a',{request:async()=>{throw Object.assign(Error('offline'),{status:503});}});
  assert.equal(result.stale,true);assert.equal(result.data.student.name,'محفوظ');assert.equal(result.error.status,503);
});
test('manual refresh bypasses the freshness window',async()=>{
  const {cache}=setup();await cache.write('session-a',payload('قديم'));
  const result=await cache.load('session-a',{force:true,request:async()=>payload('حديث')});
  assert.equal(result.cached,false);assert.equal((await cache.read('session-a')).data.student.name,'حديث');
});
test('another token, parent role and explicit logout cannot hydrate a student snapshot',async()=>{
  const {cache,records}=setup();await cache.write('session-a',payload('خاص'));
  records.set('centrly_portal_token','session-b');assert.equal(await cache.read('session-b'),null);assert.equal(await cache.read('session-a'),null);
  records.set('centrly_portal_token','session-a');records.set('centrly_portal_role','parent');assert.equal(await cache.read('session-a'),null);
  records.set('centrly_portal_role','student');records.set('centrly_explicit_logout','1');assert.equal(await cache.read('session-a'),null);
});
test('a request from the previous account cannot overwrite or render into a new session',async()=>{
  const {cache,records}=setup();let resolve,started;const began=new Promise(r=>{started=r;}),shown=[];
  const pending=cache.load('session-a',{request:()=>{started();return new Promise(r=>{resolve=r;});},onData:data=>shown.push(data)});
  await began;records.set('centrly_portal_token','session-b');resolve(payload('الحساب السابق'));
  await assert.rejects(pending,error=>error.code==='PORTAL_SESSION_CHANGED');assert.deepEqual(shown,[]);assert.equal(records.has(PORTAL_CACHE_PREFIX+'student'),false);
});
test('an unauthorized refresh discards the saved private payload and throws',async()=>{
  const {cache,records,advance}=setup();await cache.write('session-a',payload('خاص'));advance(PORTAL_FRESH_MS+1);
  await assert.rejects(cache.load('session-a',{request:async()=>{throw Object.assign(Error('expired'),{status:401});}}),e=>e.status===401);
  assert.equal(records.has(PORTAL_CACHE_PREFIX+'student'),false);
});
test('concurrent refreshes share one API request',async()=>{
  const {cache}=setup();let calls=0,resolve,started;const began=new Promise(r=>{started=r;});
  const request=()=>{calls++;started();return new Promise(r=>{resolve=r;});};
  const a=cache.load('session-a',{request}),b=cache.load('session-a',{request});
  await began;await new Promise(r=>setImmediate(r));resolve(payload('متزامن'));await Promise.all([a,b]);assert.equal(calls,1);
});
test('malformed, over-age and future-dated snapshots are ignored',async()=>{
  const {cache,records,advance}=setup();records.set(PORTAL_CACHE_PREFIX+'student','{broken');assert.equal(await cache.read('session-a'),null);
  await cache.write('session-a',payload('قديم'));advance(PORTAL_MAX_AGE_MS+1);assert.equal(await cache.read('session-a'),null);
  await cache.write('session-a',payload('المستقبل'));advance(-1);assert.equal(await cache.read('session-a'),null);
});
test('expired signed sessions and mismatched signed student/tenant identities never render a cache',async()=>{
  const {cache,records}=setup();
  const signed=Buffer.from('tenant-a:student-a:2000000:'+ 'a'.repeat(64)).toString('base64url');records.set('centrly_portal_token',signed);
  await cache.write(signed,{...payload('آخر'),student:{id:'other',tenant_id:'tenant-a'}});assert.equal(await cache.read(signed),null);
  await assert.rejects(cache.load(signed,{request:async()=>({...payload('آخر'),student:{id:'other',tenant_id:'tenant-a'}})}),/التحقق/);
  const expired=Buffer.from('tenant-a:student-a:1:'+ 'a'.repeat(64)).toString('base64url');records.set('centrly_portal_token',expired);
  await assert.rejects(cache.load(expired,{request:()=>{throw Error('must not fetch');}}),e=>e.status===401);
});
test('storage quota failures leave the live page working, and old signed links are omitted from stale snapshots',async()=>{
  const {cache,advance,storage}=setup();await cache.write('session-a',payload('محفوظ'));advance(31*60*1000);
  assert.equal((await cache.read('session-a')).data.materials[0].submission_url,null);
  storage.setItem=()=>{throw Error('QuotaExceeded');};
  const result=await cache.load('session-a',{force:true,request:async()=>payload('حديث')});assert.equal(result.data.student.name,'حديث');
});
test('unavailable device cryptography disables persistent caching without blocking live data',async()=>{
  const {storage}=setup();const cache=createPortalCache({storage,hash:async()=>{throw Error('unavailable');}});
  const result=await cache.load('session-a',{request:async()=>payload('مباشر')});assert.equal(result.data.student.name,'مباشر');
  assert.equal(storage.getItem(PORTAL_CACHE_PREFIX+'student'),null);
});
test('invalidating after a mutation prevents an older in-flight read from restoring stale homework',async()=>{
  const {cache,records}=setup();let resolve,started;const began=new Promise(r=>{started=r;}),shown=[];
  const pending=cache.load('session-a',{request:()=>{started();return new Promise(r=>{resolve=r;});},onData:data=>shown.push(data)});
  await began;cache.clear('student');resolve(payload('قبل التسليم'));
  await assert.rejects(pending,e=>e.code==='PORTAL_CACHE_INVALIDATED');assert.deepEqual(shown,[]);assert.equal(records.has(PORTAL_CACHE_PREFIX+'student'),false);
  await cache.load('session-a',{request:async()=>({...payload('بعد التسليم'),materials:[]})});assert.deepEqual((await cache.read('session-a')).data.materials,[]);
});
