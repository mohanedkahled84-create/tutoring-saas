import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {trustedPortalOrigin,hashPortalTicket} from '../dist/shared/utils/portalDestination.js';

test('portal targets accept only canonical HTTPS application origins',()=>{
  for(const origin of ['https://centerly-eg.com','https://mr-omar.centerly-eg.com'])assert.equal(trustedPortalOrigin(origin),true);
  for(const origin of ['http://centerly-eg.com','https://mr-omar.centerly-eg.com.evil.test','https://a.b.centerly-eg.com','https://api.centerly-eg.com','https://centerly-eg.com/','https://centerly-eg.com:444','https://evil.test','null',undefined])assert.equal(trustedPortalOrigin(origin),false,String(origin));
  assert.equal(hashPortalTicket('one').length,64);assert.notEqual(hashPortalTicket('one'),hashPortalTicket('two'));
});
test('frontend routes only to a verified target and never puts the reusable credential in the URL',async()=>{
  const source=await readFile(new URL('../../web/src/utils/portalDestination.js',import.meta.url),'utf8');
  const {preparePortalDestination,validPortalTarget}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const app={},moves=[],location={hostname:'centerly-eg.com',origin:'https://centerly-eg.com',replace:url=>moves.push(url)};
  const ticket='a'.repeat(43),token='private-portal-credential';
  const request=async(path,options)=>{assert.equal(path,'/public/portal/destination');assert.equal(options.body.token,token);assert.equal(options.body.role,'parent');return{origin:'https://mr-omar.centerly-eg.com',ticket,presentation:{display_title:'منصة المدرس'}};};
  assert.equal(await preparePortalDestination(app,token,'parent',request,location),true);
  assert.deepEqual(moves,[`https://mr-omar.centerly-eg.com/portal-entry#handoff=${ticket}`]);assert.ok(!moves[0].includes(token));
  assert.equal(validPortalTarget('https://centerly-eg.com.evil.test'),false);
  await assert.rejects(()=>preparePortalDestination({},token,'parent',async()=>({origin:'https://evil.test',ticket}),location));
  moves.length=0;assert.equal(await preparePortalDestination(app,token,'parent',async()=>({origin:location.origin,presentation:null}),location),false);assert.equal(moves.length,0);
  assert.equal(await preparePortalDestination(app,token,'student',async()=>{throw Error('must not call production');},{hostname:'localhost'}),false);
});

