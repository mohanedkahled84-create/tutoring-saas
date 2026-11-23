// Live Vercel/HTTPS check using a temporary hostname, never customer database rows.
import {randomBytes} from 'node:crypto';
import {provisionPortalDomain} from '../apps/tutoring/dist/shared/utils/provisionPortalDomain.js';
const config={token:process.env.PORTAL_VERCEL_TOKEN,project:process.env.PORTAL_VERCEL_PROJECT_ID,team:process.env.PORTAL_VERCEL_TEAM_ID};
if(!config.token || !config.project || !config.team)throw Error('Provisioning configuration missing');
const subdomain='centrly-check-'+randomBytes(6).toString('hex'),host=subdomain+'.centerly-eg.com';
const endpoint=`https://api.vercel.com/v9/projects/${encodeURIComponent(config.project)}/domains/${host}?teamId=${encodeURIComponent(config.team)}`;
const headers={Authorization:`Bearer ${config.token}`};
const before=await fetch(endpoint,{headers,signal:AbortSignal.timeout(15000)});
if(before.status!==404)throw Error('Test hostname is not confirmed unused');
let created=false,binding=null;
const db={rpc:async()=>({data:{}}),from(table){
 if(table==='portal_domain_bindings')return {upsert:async value=>{binding=value;return {error:null};}};
 const query={select(){return this;},eq(){return this;},async maybeSingle(){return {data:{subdomain,is_active:true}};}};return query;
}};
const send=async(url,options)=>{
 const response=await fetch(url,options);
 if(url.startsWith('https://api.vercel.com') && options?.method==='POST' && response.ok)created=true;
 return response;
};
try{
 let passed=false;
 for(let attempt=1;attempt<=6;attempt++){
  try{passed=await provisionPortalDomain(db,'fixture-tenant',config,send);}catch{passed=false;}
  console.log(JSON.stringify({attempt,temporaryHostname:host,created,httpsPortalReady:passed}));
  if(passed)break;
  if(attempt<6)await new Promise(resolve=>setTimeout(resolve,15000));
 }
 if(!passed || binding?.subdomain!==subdomain)process.exitCode=1;
}finally{
 if(created){
  const removed=await fetch(endpoint,{method:'DELETE',headers,signal:AbortSignal.timeout(15000)});
  console.log(JSON.stringify({temporaryHostname:host,removed:removed.ok}));
  if(!removed.ok)process.exitCode=1;
 }
}
