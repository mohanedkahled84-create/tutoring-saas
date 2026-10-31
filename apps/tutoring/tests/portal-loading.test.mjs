import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const source = await readFile(new URL('../../web/src/utils/portalSession.js', import.meta.url), 'utf8');
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
