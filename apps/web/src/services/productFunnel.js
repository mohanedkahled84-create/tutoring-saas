import {API_BASE_URL} from './api.js?v=9.45.0';
import {authService} from './auth.js?v=9.45.0';

const paths={landing_view:'/',signup_open:'/signup',signup_complete:'/signup',group_created:'/workspace',student_added:'/workspace',session_started:'/workspace'};
export function funnelPayload(event,session){
 if(!Object.hasOwn(paths,event))return null;
 // No arbitrary properties, URL queries, names, phones, emails or student IDs.
 return {events:[{event_name:'product.'+event,page_path:paths[event],session_id:session}]};
}
export function trackProductEvent(event){
 try{
  if(typeof window==='undefined' || window.__CENTRLY_ASSISTANT_RUNTIME__ || localStorage.getItem('centrly_cookie_consent')!=='accepted' || !Object.hasOwn(paths,event))return false;
  const key=`centrly_product_${event}:${authService.getUser()?.tenant_id || 'visitor'}`;
  if(sessionStorage.getItem(key))return false;
  let session=sessionStorage.getItem('centrly_product_session');if(!session){session=crypto.randomUUID();sessionStorage.setItem('centrly_product_session',session);}
  const token=authService.getToken();
  void fetch(`${API_BASE_URL}/telemetry/events`,{method:'POST',credentials:'omit',headers:{'Content-Type':'application/json',...(token?{Authorization:`Bearer ${token}`}:{})},body:JSON.stringify(funnelPayload(event,session)),keepalive:true}).then(response=>{if(response.ok)sessionStorage.setItem(key,'1');}).catch(()=>{});
  return true;
 }catch{return false;}
}
