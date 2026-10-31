// Operator command. Uses the existing Vercel CLI session; never copies it into the backend.
import {createRequire} from 'node:module';
import {spawnSync} from 'node:child_process';
import https from 'node:https';
const require=createRequire(new URL('../apps/tutoring/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const slug=process.argv[2];
if(typeof slug !== 'string'||slug !== slug.trim()||!/^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(slug||'')||['www','api','app','admin','mail','dev','portal','login'].includes(slug))throw Error('Provide a valid teacher subdomain');
if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Operator database environment is required');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const {data:platform,error}=await db.from('tenant_platform_settings').select('tenant_id,subdomain').eq('subdomain',slug).single();
if(error||!platform)throw Error('The platform must exist before provisioning');
const domain=slug+'.centerly-eg.com';
const args=['domains','add',domain,'centrly-platform','--scope','mohaned-khaled1'];
const command=process.platform==='win32'?spawnSync('powershell',['-NoProfile','-NonInteractive','-Command','vercel '+args.join(' ')],{encoding:'utf8'}):spawnSync('vercel',args,{encoding:'utf8'});
if(command.status!==0)throw Error('Domain registration failed; inspect the existing Vercel project configuration');
const content=await new Promise((resolve,reject)=>{
 const request=https.get('https://'+domain+'/portal-entry',{timeout:15000,headers:{'accept-encoding':'identity'}},response=>{
  const chunks=[];response.on('data',c=>chunks.push(c));response.on('error',reject);response.on('end',()=>response.statusCode===200?resolve(Buffer.concat(chunks).toString('utf8')):reject(Error('HTTPS arrival is not ready')));
 });request.on('error',reject);request.on('timeout',()=>request.destroy(Error('HTTPS readiness timeout')));
});
if(!content.includes('/apps/web/src/portalBootstrap.js')&&!content.includes('/apps/web/src/app.js'))throw Error('The HTTPS host is not serving the portal entry');
// Recheck assignment after the network operation so a concurrent rename cannot register a stale binding.
const latest=await db.from('tenant_platform_settings').select('subdomain').eq('tenant_id',platform.tenant_id).single();
if(latest.error||latest.data.subdomain!==slug)throw Error('Platform changed while provisioning; run again for its current subdomain');
const saved=await db.from('portal_domain_bindings').upsert({tenant_id:platform.tenant_id,subdomain:slug,verified_at:new Date().toISOString()},{onConflict:'tenant_id'});
if(saved.error)throw Error(saved.error.message);
console.log('HTTPS domain verified and bound: '+domain);
