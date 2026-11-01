import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';

test('the web-root Vercel configuration serves assistant links before the staff SPA fallback',()=>{
 const {routes}=JSON.parse(readFileSync(new URL('../../web/vercel.json',import.meta.url),'utf8'));
 const destination=path=>routes.find(r=>r.dest && !r.has && new RegExp(`^${r.src}$`).test(path))?.dest;
 for(const path of ['/assistant','/assistant/','/assistant/login'])assert.equal(destination(path),'/assistant.html');
 assert.equal(destination('/portal'),'/index.html');assert.equal(destination('/portal-entry'),'/index.html');
 assert.ok(routes.findIndex(r=>r.dest==='/assistant.html')<routes.findIndex(r=>r.handle==='filesystem'));
});


test('repository-root assistant rewrites point to an existing standalone entry file',()=>{
 const root=new URL('../../../',import.meta.url);
 const {rewrites}=JSON.parse(readFileSync(new URL('vercel.json',root),'utf8'));
 for(const source of ['/assistant','/assistant/:path*']){
  const rule=rewrites.find(r=>r.source===source);
  assert.equal(rule.destination,'/apps/web/assistant.html');
  assert.ok(existsSync(new URL(rule.destination.slice(1),root)),'rewrite destination must exist in the deployment artifact');
 }
});
