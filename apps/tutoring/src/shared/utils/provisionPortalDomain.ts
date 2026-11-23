import type {SupabaseClient} from '@supabase/supabase-js';
import {portalOrigin,trustedPortalOrigin,currentPortalDestination} from './portalDestination.js';

type Config={token:string;project:string;team:string};
/** Bind only after Vercel ownership verification and HTTPS portal readiness. */
export async function provisionPortalDomain(db:SupabaseClient,tenantId:string,config:Config,send:typeof fetch=fetch):Promise<boolean>{
 const read=()=>db.from('tenant_platform_settings').select('subdomain,is_active').eq('tenant_id',tenantId).maybeSingle();
 const initial=await read();if(initial.error)throw initial.error;
 const sub=initial.data?.subdomain;
 if(initial.data?.is_active!==true || typeof sub!=='string')return false;
 const origin=`https://${sub}.${new URL(portalOrigin()).hostname}`;
 if(!trustedPortalOrigin(origin))return false;
 if((await currentPortalDestination(db,tenantId)).origin===origin)return true;
 const base=`https://api.vercel.com/v10/projects/${encodeURIComponent(config.project)}/domains`;
 const query=`?teamId=${encodeURIComponent(config.team)}`;
 const headers={Authorization:`Bearer ${config.token}`,'Content-Type':'application/json'};
 let response=await send(`${base.replace('/v10/','/v9/')}/${encodeURIComponent(new URL(origin).hostname)}${query}`,{headers,redirect:'error',signal:AbortSignal.timeout(10000)});
 if(response.status===404)response=await send(base+query,{method:'POST',headers,body:JSON.stringify({name:new URL(origin).hostname}),redirect:'error',signal:AbortSignal.timeout(10000)});
 if(!response.ok)return false;
 const domain=await response.json() as {name?:string;verified?:boolean};
 if(domain.name!==new URL(origin).hostname || domain.verified!==true)return false;
 const pages=[['/portal-entry','parentPortalEntry.js'],['/login','id="formLogin"'],['/dashboard','sidebarStudentName']];
 const ready=await Promise.all(pages.map(async([path,marker])=>{
  const page=await send(origin+path,{redirect:'error',signal:AbortSignal.timeout(10000)});
  return page.ok && (await page.text()).includes(marker);
 }));
 if(!ready.every(Boolean))return false;
 // Never publish a binding for a setting that changed during network work.
 const latest=await read();if(latest.error)throw latest.error;
 if(latest.data?.subdomain!==sub || latest.data?.is_active!==true)return false;
 const saved=await db.from('portal_domain_bindings').upsert({tenant_id:tenantId,subdomain:sub,verified_at:new Date().toISOString()},{onConflict:'tenant_id'});
 if(saved.error)throw saved.error;
 return true;
}

const attempts=new Set<string>();
/** Recheck on settings read/save; no CLI credentials are copied into the server. */
export function schedulePortalDomain(db:SupabaseClient,tenantId:string):void{
 const token=process.env.PORTAL_VERCEL_TOKEN,project=process.env.PORTAL_VERCEL_PROJECT_ID,team=process.env.PORTAL_VERCEL_TEAM_ID;
 if(!token || !project || !team || attempts.has(tenantId) || attempts.size>=200)return;
 attempts.add(tenantId);
 void provisionPortalDomain(db,tenantId,{token,project,team}).catch(()=>{
  console.warn('Portal domain verification is pending');
 }).finally(()=>{setTimeout(()=>attempts.delete(tenantId),60000).unref();});
}
