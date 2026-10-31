import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const cacheSource = await readFile(new URL('../../web/src/utils/portalCache.js', import.meta.url), 'utf8');
const cacheUrl = 'data:text/javascript;base64,' + Buffer.from(cacheSource).toString('base64');
const source = (await readFile(new URL('../../web/src/utils/portalSession.js', import.meta.url), 'utf8')).replaceAll("'./portalCache.js'", JSON.stringify(cacheUrl));
const session = await import('data:text/javascript;base64,' + Buffer.from(source).toString('base64'));

test('valid portal requests survive the former five-second cutoff', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  let complete, signal;
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    signal = options.signal;
    return new Promise(resolve => { complete = () => resolve({ok:true,json:async()=>({student:{id:'verified'}})}); });
  });
  const pending = session.portalRequest('/public/parent-portal?token=test');
  t.mock.timers.tick(6000);
  assert.equal(signal.aborted, false);
  complete();
  assert.equal((await pending).student.id, 'verified');
});

test('unresponsive requests terminate and permit a fresh retry', async t => {
  t.mock.timers.enable({apis:['setTimeout']});
  t.mock.method(globalThis, 'fetch', async (_url, options) => new Promise((_resolve,reject) => {
    options.signal.addEventListener('abort', () => reject(new DOMException('Timeout','AbortError')));
  }));
  const pending = assert.rejects(session.portalRequest('/public/parent-portal'), /الاتصال استغرق/);
  t.mock.timers.tick(30000);
  await pending;
  globalThis.fetch.mock.mockImplementation(async () => ({ok:true,json:async()=>({student:{id:'retry-success'}})}));
  assert.equal((await session.portalRequest('/public/parent-portal')).student.id, 'retry-success');
});

test('invalid credentials remain errors with status, and public requests never send staff authorization', async t => {
  t.mock.method(globalThis, 'fetch', async (_url, options) => {
    assert.equal(options.headers?.Authorization, undefined);
    assert.equal(options.cache, 'no-store');
    return {ok:false,status:401,json:async()=>({error:{message:'رابط غير صالح'}})};
  });
  await assert.rejects(session.portalRequest('/public/parent-portal'), error => error.status === 401);
});

test('published students land directly on the dashboard using a one-time transfer', async () => {
  const destinationSource = await readFile(new URL('../../web/src/utils/portalDestination.js', import.meta.url), 'utf8');
  const {preparePortalDestination} = await import('data:text/javascript;base64,' + Buffer.from(destinationSource).toString('base64'));
  const moves=[], ticket='b'.repeat(43);
  await preparePortalDestination({},'private-session','student',async()=>({origin:'https://mr-omar.centerly-eg.com',presentation:{subdomain:'mr-omar'},ticket}),{hostname:'centerly-eg.com',origin:'https://centerly-eg.com',replace:url=>moves.push(url)});
  assert.deepEqual(moves,['https://mr-omar.centerly-eg.com/dashboard#handoff='+ticket]);
  assert.ok(!moves[0].includes('private-session'));
});

test('server-verified renewal retains only the same identity snapshot and preserves its original age', async t => {
  const previousStorage=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),previousSession=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
  const records=new Map();const storage={getItem:k=>records.get(k)??null,setItem:(k,v)=>records.set(k,v),removeItem:k=>records.delete(k)};
  Object.defineProperty(globalThis,'localStorage',{configurable:true,value:storage});Object.defineProperty(globalThis,'sessionStorage',{configurable:true,value:storage});
  t.after(()=>{if(previousStorage)Object.defineProperty(globalThis,'localStorage',previousStorage);else delete globalThis.localStorage;if(previousSession)Object.defineProperty(globalThis,'sessionStorage',previousSession);else delete globalThis.sessionStorage;});
  const expiry=Math.floor(Date.now()/1000)+3600;
  const token=(id,extra=0)=>Buffer.from(`tenant-a:${id}:${expiry+extra}:`+'a'.repeat(64)).toString('base64url');
  const first=token('student-a'),next=token('student-a',10),other=token('student-b',20);
  session.savePortalSession(first,'student');
  await session.portalCache.write(first,{student:{id:'student-a',tenant_id:'tenant-a',name:'محفوظ'},materials:[]});
  const key='centrly_portal_snapshot_v1:student',record=JSON.parse(records.get(key));record.savedAt=Date.now()-180000;records.set(key,JSON.stringify(record));
  await session.adoptVerifiedPortalSession(next,'student');
  const retained=await session.portalCache.read(next);assert.equal(retained.data.student.name,'محفوظ');assert.equal(retained.savedAt,record.savedAt);assert.equal(retained.fresh,false);
  await session.adoptVerifiedPortalSession(other,'student');assert.equal(await session.portalCache.read(other),null);assert.equal(records.has(key),false);
});
