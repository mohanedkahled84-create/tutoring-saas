import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../../web/index.html',import.meta.url),'utf8');
const opening=await readFile(new URL('../../web/src/portalOpening.js',import.meta.url),'utf8');
test('cold HTML installs the opening renderer before the independent portal entry',()=>{
 const scripts=[...html.matchAll(/<script\b([^>]*)src=["']([^"']+)["']([^>]*)>/g)].map(m=>({attrs:m[1]+m[3],src:m[2]}));
 const renderer=scripts.findIndex(s=>/\/portalOpening\.js\?v=/.test(s.src));
 const entry=scripts.findIndex(s=>/\/parentPortalEntry\.js\?v=/.test(s.src));
 assert.ok(renderer>=0 && entry>renderer);
 assert.doesNotMatch(scripts[renderer].attrs,/async|defer|module/);
 assert.match(scripts[entry].attrs,/type="module"/);
 assert.ok(!scripts.some(s=>/\/app\.js/.test(s.src)),'public entries must not eagerly initialize the teacher SPA');
 const root={innerHTML:''},window={};
 vm.runInNewContext(opening,{window,document:{getElementById:id=>id==='app'?root:null}});
 assert.equal(typeof window.renderPortalOpening,'function');assert.match(root.innerHTML,/role="status"/);assert.match(root.innerHTML,/prefers-reduced-motion/);
 root.innerHTML='';window.renderPortalOpening(root);assert.match(root.innerHTML,/portal-opening-mark/);
 assert.doesNotThrow(()=>window.renderPortalOpening(null));
});

test('cold family route mounts the family-aware parent entry without teacher or student startup',async()=>{
 const code=await readFile(new URL('../../web/src/portalBootstrap.js',import.meta.url),'utf8');
 const mounts=[],loads=[];
 // Run the real route selection with module transports replaced; no browser
 // session, provider request or staff application is initialized by this test.
 const executable=code.replace(/^import .*;\r?\n/gm,'').replace(/import\(['"]([^'"]+)['"]\)/g,(_m,url)=>`load(${JSON.stringify(url)})`);
 const empty={getItem:()=>null};
 const context={URLSearchParams,location:{pathname:'/family',search:'',hash:'',hostname:'mr-omar.centerly-eg.com'},localStorage:empty,sessionStorage:empty,load:async url=>{loads.push(url);return {mountParentPortal:async()=>mounts.push('parent'),mountStudentPortal:async()=>mounts.push('student')};}};
 await vm.runInNewContext(executable,context);
 assert.deepEqual(mounts,['parent']);assert.equal(loads.length,1);assert.match(loads[0],/\/parentPortal\.js/);
});
