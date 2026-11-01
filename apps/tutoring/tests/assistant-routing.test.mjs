import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

test('the web-root Vercel configuration serves assistant links before the staff SPA fallback',()=>{
 const {routes}=JSON.parse(readFileSync(new URL('../../web/vercel.json',import.meta.url),'utf8'));
 const destination=path=>routes.find(r=>r.dest && !r.has && new RegExp(`^${r.src}$`).test(path))?.dest;
 for(const path of ['/assistant','/assistant/','/assistant/login'])assert.equal(destination(path),'/assistant.html');
 assert.equal(destination('/portal'),'/index.html');assert.equal(destination('/portal-entry'),'/index.html');
 assert.ok(routes.findIndex(r=>r.dest==='/assistant.html')<routes.findIndex(r=>r.handle==='filesystem'));
});
