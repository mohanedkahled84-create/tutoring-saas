import {test} from 'node:test';
import assert from 'node:assert/strict';
import {provisionPortalDomain} from '../dist/shared/utils/provisionPortalDomain.js';
const config={token:'fixture-only-token',project:'fixture-project',team:'fixture-team'};
function fixture({verified=true,badPage=false,rename=false,registered=false}={}){
 let reads=0,saved=null;const calls=[];
 const db={rpc:async()=>({data:{}}),from(table){
  if(table==='portal_domain_bindings')return {upsert:async value=>{saved=value;return {error:null};}};
  const query={select(){return this;},eq(){return this;},async maybeSingle(){reads++;return {data:{subdomain:rename && reads>1?'changed':'teacher',is_active:true}};}};
  return query;
 }};
 const send=async(url,options)=>{
  calls.push({url,options});
  if(url.startsWith('https://api.vercel.com')){
   if(!options.method && !registered)return new Response('{}',{status:404});
   return Response.json({name:'teacher.centerly-eg.com',verified});
  }
  assert.equal(options.headers,undefined,'Vercel token must never reach a portal host');
  return new Response(badPage?'wrong page':url.endsWith('/login')?'id="formLogin"':url.endsWith('/dashboard')?'sidebarStudentName':'parentPortalEntry.js');
 };
 return {db,send,calls,get saved(){return saved;}};
}
test('domain provisioning creates only a project domain and binds after HTTPS page checks',async()=>{
 const f=fixture();assert.equal(await provisionPortalDomain(f.db,'tenant',config,f.send),true);
 assert.equal(f.saved.subdomain,'teacher');assert.equal(f.calls.filter(c=>c.options.method==='POST').length,1);
 assert.match(f.calls[0].url,/\/v9\/projects\/fixture-project\/domains\//);
});
test('existing project domains are checked without adding again',async()=>{
 const f=fixture({registered:true});assert.equal(await provisionPortalDomain(f.db,'tenant',config,f.send),true);
 assert.equal(f.calls.some(c=>c.options.method==='POST'),false);
});
test('unverified domains, wrong pages and concurrent renames never become live bindings',async()=>{
 for(const options of [{verified:false},{badPage:true},{rename:true}]){
  const f=fixture(options);assert.equal(await provisionPortalDomain(f.db,'tenant',config,f.send),false);assert.equal(f.saved,null);
 }
});
