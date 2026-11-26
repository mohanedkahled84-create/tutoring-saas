import {test} from 'node:test';
import assert from 'node:assert/strict';
import {provisionPortalDomain,ensurePortalDomainReady,schedulePortalDomain} from '../dist/shared/utils/provisionPortalDomain.js';
const config={token:'fixture-only-token',project:'fixture-project',team:'fixture-team'};
function fixture({verified=true,badPage=false,rename=false,registered=false,isActive=true,tlsFailCount=0}={}){
 let reads=0,saved=null,pageRequests=0;const calls=[];
 const db={rpc:async()=>({data:{}}),from(table){
  if(table==='portal_domain_bindings')return {upsert:async value=>{saved=value;return {error:null};}};
  const query={select(){return this;},eq(){return this;},async maybeSingle(){reads++;return {data:{subdomain:rename && reads>1?'changed':'teacher',is_active:isActive}};}};
  return query;
 }};
 const send=async(url,options)=>{
  calls.push({url,options});
  if(url.startsWith('https://api.vercel.com')){
   if(!options.method && !registered)return new Response('{}',{status:404});
   return Response.json({name:'teacher.centerly-eg.com',verified});
  }
  assert.equal(options.headers,undefined,'Vercel token must never reach a portal host');
  pageRequests++;
  if(pageRequests<=tlsFailCount*3)throw Object.assign(new TypeError('fetch failed'),{cause:{code:'ECONNRESET'}});
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
test('ensurePortalDomainReady polls past transient TLS warm-up errors and binds once HTTPS succeeds',async()=>{
 const f=fixture({tlsFailCount:2});
 const ok=await ensurePortalDomainReady(f.db,'tenant-wait',{config,send:f.send,maxWaitMs:1000,intervalMs:15,pageTimeoutMs:500,retryOnPending:false});
 assert.equal(ok,true);
 assert.equal(f.saved?.subdomain,'teacher');
});
test('ensurePortalDomainReady exits immediately when platform is inactive without wasting wait budget',async()=>{
 const f=fixture({isActive:false});
 const t0=Date.now();
 const ok=await ensurePortalDomainReady(f.db,'tenant-inactive',{config,send:f.send,maxWaitMs:5000,intervalMs:20,retryOnPending:false});
 assert.equal(ok,false);
 assert.ok(Date.now()-t0<300);
 assert.equal(f.calls.length,0);
});
test('schedulePortalDomain retries automatically in background after initial TLS handshake failure',async()=>{
 const f=fixture({registered:true,tlsFailCount:2});
 await new Promise((resolve,reject)=>{
  const start=Date.now();
  schedulePortalDomain(f.db,'tenant-bg',{config,send:f.send,retryDelaysMs:[15,15,15]});
  const timer=setInterval(()=>{
   if(f.saved?.subdomain==='teacher'){clearInterval(timer);resolve();}
   else if(Date.now()-start>1500){clearInterval(timer);reject(new Error('Background retry did not bind domain in time'));}
  },15);
 });
});
