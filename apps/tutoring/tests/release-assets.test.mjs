import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createRequire} from 'node:module';
const {stampModules}=createRequire(import.meta.url)('../../../scripts/stamp-web-assets.cjs');
test('release keys invalidate both direct and nested module dependencies consistently',()=>{
 const source=`import {x} from './old.js?v=1';\nexport {y} from '../shared.js';\nconst z=import('./lazy.js?v=2');\nimport 'https://cdn.invalid/lib.js';`;
 const stamped=stampModules(source,'9.40.0');
 for(const file of ['old','shared','lazy'])assert.ok(stamped.includes(file+'.js?v=9.40.0'));
 assert.ok(stamped.includes("import 'https://cdn.invalid/lib.js'"));
 assert.equal(stampModules(stamped,'9.40.0'),stamped);
});
test('deployed workspace and homework editor use the same release as the app shell',()=>{
 const root=new URL('../../web/',import.meta.url),version=readFileSync(new URL('index.html',root),'utf8').match(/app\.js\?v=([^"']+)/)[1];
 for(const file of ['src/app.js','src/workspace.js','src/components/HomeworkReviewView.js','src/components/MaterialsView.js']){
  const source=readFileSync(new URL(file,root),'utf8');
  for(const match of source.matchAll(/(?:from\s*|import\(\s*)['"](\.{1,2}\/[^'"?]+\.js)(?:\?v=([^'"]+))?['"]/g))assert.equal(match[2],version,`${file}: ${match[1]} must invalidate with the release`);
 }
});
