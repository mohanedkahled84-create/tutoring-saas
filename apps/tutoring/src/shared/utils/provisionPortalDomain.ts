import type {SupabaseClient} from '@supabase/supabase-js';
import {portalOrigin,trustedPortalOrigin,currentPortalDestination} from './portalDestination.js';

type Config={token:string;project:string;team:string};
export type ProvisionStatus='bound'|'pending'|'ineligible';
export type EnsureDomainOptions={
 maxWaitMs?:number;
 intervalMs?:number;
 pageTimeoutMs?:number;
 config?:Config;
 send?:typeof fetch;
 retryOnPending?:boolean;
};

const RETRY_DELAYS_MS=[3000,5000,8000,12000,18000,25000,35000,45000];
const MAX_PENDING_TENANTS=200;

function readProvisionConfig():Config|null{
 const token=process.env.PORTAL_VERCEL_TOKEN,project=process.env.PORTAL_VERCEL_PROJECT_ID,team=process.env.PORTAL_VERCEL_TEAM_ID;
 return token && project && team?{token,project,team}:null;
}

function waitMs(ms:number):Promise<void>{
 return new Promise(resolve=>{
  const timer=setTimeout(resolve,ms);
  timer.unref?.();
 });
}

async function attemptProvision(
 db:SupabaseClient,
 tenantId:string,
 config:Config,
 send:typeof fetch=fetch,
 pageTimeoutMs:number=10000
):Promise<ProvisionStatus>{
 const read=()=>db.from('tenant_platform_settings').select('subdomain,is_active').eq('tenant_id',tenantId).maybeSingle();
 const initial=await read();if(initial.error)throw initial.error;
 const sub=initial.data?.subdomain;
 if(initial.data?.is_active!==true || typeof sub!=='string')return 'ineligible';
 const origin=`https://${sub}.${new URL(portalOrigin()).hostname}`;
 if(!trustedPortalOrigin(origin))return 'ineligible';
 if((await currentPortalDestination(db,tenantId)).origin===origin)return 'bound';
 const hostname=new URL(origin).hostname;
 const base=`https://api.vercel.com/v10/projects/${encodeURIComponent(config.project)}/domains`;
 const query=`?teamId=${encodeURIComponent(config.team)}`;
 const headers={Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'};
 let response:Response;
 try{
  response=await send(`${base.replace('/v10/','/v9/')}/${encodeURIComponent(hostname)}${query}`,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
  if(response.status===404)response=await send(base+query,{method:'POST',headers,body:JSON.stringify({name:hostname}),redirect:'error',signal:AbortSignal.timeout(10000)});
 }catch{
  return 'pending';
 }
 if(!response.ok){
  return response.status===429 || response.status>=500?'pending':'ineligible';
 }
 const domain=await response.json() as {name?:string;verified?:boolean};
 if(domain.name!==hostname)return 'ineligible';
 if(domain.verified!==true)return 'pending';
 const pages=[['/portal-entry','parentPortalEntry.js'],['/login','id="formLogin"'],['/dashboard','sidebarStudentName']];
 const ready=await Promise.all(pages.map(async([path,marker])=>{
  try{
   const page=await send(origin+path,{redirect:'error',signal:AbortSignal.timeout(pageTimeoutMs)});
   return page.ok && (await page.text()).includes(marker);
  }catch{
   return false;
  }
 }));
 if(!ready.every(Boolean))return 'pending';
 // Never publish a binding for a setting that changed during network work.
 const latest=await read();if(latest.error)throw latest.error;
 if(latest.data?.subdomain!==sub || latest.data?.is_active!==true)return 'ineligible';
 const saved=await db.from('portal_domain_bindings').upsert({tenant_id:tenantId,subdomain:sub,verified_at:new Date().toISOString()},{onConflict:'tenant_id'});
 if(saved.error)throw saved.error;
 return 'bound';
}

/** Bind only after Vercel ownership verification and HTTPS portal readiness. */
export async function provisionPortalDomain(db:SupabaseClient,tenantId:string,config:Config,send:typeof fetch=fetch):Promise<boolean>{
 return (await attemptProvision(db,tenantId,config,send))==='bound';
}

type RetryState={timer?:ReturnType<typeof setTimeout>};
const pendingRetries=new Map<string,RetryState>();
const activeWaiters=new Map<string,Promise<ProvisionStatus>>();

function stopRetryLoop(tenantId:string):void{
 const current=pendingRetries.get(tenantId);
 if(current?.timer)clearTimeout(current.timer);
 pendingRetries.delete(tenantId);
}

/** Wait up to maxWaitMs for HTTPS readiness before falling back to background retries. */
export async function ensurePortalDomainReady(
 db:SupabaseClient,
 tenantId:string,
 options:EnsureDomainOptions={}
):Promise<boolean>{
 const config=options.config ?? readProvisionConfig();
 if(!config)return false;
 const maxWaitMs=Math.max(0,options.maxWaitMs ?? 20000);
 const intervalMs=Math.max(10,options.intervalMs ?? 1500);
 const pageTimeoutMs=Math.max(100,options.pageTimeoutMs ?? 5000);
 const send=options.send ?? fetch;
 const canDedupe=!options.config && !options.send;

 if(canDedupe && activeWaiters.has(tenantId)){
  const existing=activeWaiters.get(tenantId)!;
  const status=maxWaitMs>0
   ? await Promise.race([existing,waitMs(maxWaitMs).then(()=>'pending' as const)])
   : await existing;
  return status==='bound';
 }

 stopRetryLoop(tenantId);
 const runWaitLoop=async():Promise<ProvisionStatus>=>{
  const deadline=Date.now()+maxWaitMs;
  let status=await attemptProvision(db,tenantId,config,send,pageTimeoutMs);
  while(status==='pending' && Date.now()<deadline){
   await waitMs(Math.min(intervalMs,Math.max(1,deadline-Date.now())));
   status=await attemptProvision(db,tenantId,config,send,pageTimeoutMs);
  }
  return status;
 };

 const waiter=runWaitLoop();
 if(canDedupe)activeWaiters.set(tenantId,waiter);
 try{
  const status=await waiter;
  if(status==='pending' && options.retryOnPending!==false){
   schedulePortalDomain(db,tenantId,{config:options.config,send:options.send,initialDelayMs:RETRY_DELAYS_MS[0]});
  }
  return status==='bound';
 }finally{
  if(canDedupe && activeWaiters.get(tenantId)===waiter)activeWaiters.delete(tenantId);
 }
}

/** Recheck on settings read/save with bounded backoff retries; no CLI credentials are copied into the server. */
export function schedulePortalDomain(
 db:SupabaseClient,
 tenantId:string,
 options:{config?:Config;send?:typeof fetch;initialDelayMs?:number;retryDelaysMs?:number[]}={}
):void{
 const config=options.config ?? readProvisionConfig();
 if(!config || pendingRetries.has(tenantId) || pendingRetries.size>=MAX_PENDING_TENANTS)return;
 const state:RetryState={};
 pendingRetries.set(tenantId,state);
 const send=options.send ?? fetch;
 const delays=options.retryDelaysMs ?? RETRY_DELAYS_MS;

 const scheduleStep=(step:number,delay:number)=>{
  state.timer=setTimeout(async()=>{
   if(pendingRetries.get(tenantId)!==state)return;
   let status:ProvisionStatus='pending';
   try{
    status=await attemptProvision(db,tenantId,config,send,5000);
   }catch{
    status='pending';
   }
   if(pendingRetries.get(tenantId)!==state)return;
   if(status==='bound' || status==='ineligible'){
    stopRetryLoop(tenantId);
    return;
   }
   if(step<delays.length){
    scheduleStep(step+1,delays[step]);
   }else{
    stopRetryLoop(tenantId);
    console.warn('Portal domain verification is pending');
   }
  },delay);
  state.timer.unref?.();
 };

 scheduleStep(options.initialDelayMs!==undefined?1:0,options.initialDelayMs ?? 0);
}
