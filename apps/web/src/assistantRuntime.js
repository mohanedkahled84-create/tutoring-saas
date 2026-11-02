import {API_BASE_URL} from './services/api.js';
import {assistantCan,assistantCanNavigate,routeResources} from './utils/assistantWorkspacePolicy.js';

// Reuse the teacher application and its actions; only authentication,
// navigation rights and storage lifetime differ for delegated accounts.
export async function mountAssistantWorkspace({root,token,onLogout,onExpired}){
 const nativeFetch=window.fetch.bind(window);
 const base=API_BASE_URL.replace(/\/$/,'');
 const call=async(endpoint,options={},page='sessions')=>{
  let body=options.body;
  if(body && typeof body==='object' && !(body instanceof FormData) && !(body instanceof Blob))body=JSON.stringify(body);
  const headers=new Headers(options.headers);headers.set('Authorization',`Bearer ${token}`);headers.set('X-Assistant-Page',page);
  if(body && !(body instanceof FormData) && !headers.has('Content-Type'))headers.set('Content-Type','application/json');
  return nativeFetch(`${base}/assistant-access/workspace-api${endpoint}`,{...options,headers,body,credentials:'omit'});
 };
 const contextResponse=await call('/context');
 const context=await contextResponse.json();
 if(!contextResponse.ok)throw Object.assign(new Error(context.error?.message || 'تعذر فتح مساحة العمل'),{status:contextResponse.status});
 let app,observer,disposed=false;
 const permissions=context.permissions || {};
 const dispose=()=>{
  if(disposed)return;disposed=true;observer?.disconnect();app?.stopLiveSessionSync?.();app?.stopWhatsAppStatusPolling?.();app?.stopOmrCamera?.(true);
  if(app)app.sessionState=null;
  window.fetch=nativeFetch;delete window.__CENTRLY_DELEGATED_REQUEST__;
  if(window.__CENTRLY_ASSISTANT_RUNTIME__)window.__CENTRLY_ASSISTANT_RUNTIME__.user=null;
  window.centrlyApp=null;
 };
 const runtime={user:context.user,onExpired:()=>{dispose();onExpired?.();},permissions};
 window.__CENTRLY_ASSISTANT_RUNTIME__=runtime;
 const request=async(endpoint,options={})=>{
  if(disposed)throw new Error('انتهت جلسة المساعد');
  // Owner credentials are never refreshed or read by the delegated API client.
  if(endpoint==='/auth/me')return {user:runtime.user};
  if(endpoint==='/assistants' || endpoint.startsWith('/assistants?')){
   if(!assistantCan(permissions,'assistants') && app?.currentRoute==='reports')return {assistants:[],financials_unavailable:true};
  }
  const res=await call(endpoint,options,app?.currentRoute || 'sessions'),data=await res.json().catch(()=>({}));
  if(!res.ok){if(res.status===401)runtime.onExpired();throw Object.assign(new Error(data.error?.message || 'تعذر إتمام العملية'),{status:res.status,code:data.error?.code});}
  return data;
 };
 window.__CENTRLY_DELEGATED_REQUEST__=request;
 // A few existing teacher flows use fetch directly (uploads, quizzes and
 // platform settings). Keep them inside the same server permission boundary.
 window.fetch=async(input,init={})=>{
  const url=new URL(typeof input==='string'?input:input.url,location.origin),api=new URL(base);
  if((url.origin===api.origin || url.origin===location.origin) && url.pathname.startsWith('/api/')){
   const endpoint=url.pathname.slice(4)+url.search;
   if(endpoint.startsWith('/assistant-access/'))return nativeFetch(input,init);
   if(endpoint==='/auth/me')return Response.json({user:runtime.user});
   return call(endpoint,init,app?.currentRoute || 'sessions');
  }
  return nativeFetch(input,init);
 };
 try{
  const {CentrlyApp}=await import('./app.js?v=9.35.0');
  const delegation={user:context.user,actor:context.actor,permissions,isActive:()=>!disposed,canNavigate:route=>!disposed && assistantCanNavigate(permissions,route)};
  app=new CentrlyApp(delegation);window.centrlyApp=app;
  app.user.delegated_actor=context.actor;
  await app.ensureWorkspaceModules();
  // Assistant work is memory-only. A shared browser must not hydrate or
  // overwrite the teacher's cached roster or active attendance session.
  app.saveCache=()=>{};app.loadCache=(_key,fallback=null)=>fallback;
  app.getStorageKey=key=>`centrly:assistant:${context.user.tenant_id}:${context.actor.id}:${key}`;
  app.restoreSessionState=()=>{};
  app.logout=app.promptLogout=onLogout;
  root.innerHTML='<div id="app"></div>';
  const wanted=new URLSearchParams(location.search).get('route');
  const initial=wanted && delegation.canNavigate(wanted)?wanted:context.pages.find(page=>delegation.canNavigate(page.route))?.route;
  const lockControls=()=>{
   if(disposed)return;
   const resources=routeResources[app.currentRoute] || [];
   for(const el of root.querySelectorAll('button[onclick],input[onchange],select[onchange]')){
    if(el.closest('.app-sidebar') || el.closest('.app-topbar'))continue;
    const code=el.getAttribute('onclick') || el.getAttribute('onchange') || '';
    const action=delegatedUiAction(code);
    if(action && !resources.some(resource=>assistantCan(permissions,resource,action))){el.disabled=true;el.setAttribute('aria-disabled','true');el.title='غير متاح ضمن صلاحياتك';}
   }
  };
  observer=new MutationObserver(lockControls);observer.observe(root,{childList:true,subtree:true});
  if(initial)await app.navigate(initial);else{app.currentRoute='sessions';app.renderApp(true);}
  lockControls();
  return dispose;
 }catch(error){dispose();throw error;}
}

export function delegatedUiAction(code){
 if(/(?:delete|Delete|Purge)/.test(code))return 'delete';
 if(/(?:dispatch|Dispatch|sendParent|SendParent|sendStudent|SendStudent|prepareFollowup|SendIndividualReport|BulkSendReports)/.test(code))return 'send';
 if(/(?:grade|Grade|Score|score|OmrScanReview)/.test(code) && !/(?:load|Load|filter|Filter|select|Select|open.*Breakdown)/.test(code))return 'grade';
 if(/(?:create|Create|addNew|AddNew|openAdd|openNew|startSession|StartSession|startGroup|StartGroup|AddMaterial|AddHomework|AddVideo|AddTeacherAssistant|ImportStudents)/.test(code))return 'create';
 if(/(?:save|Save|edit|Edit|approve|Approve|reject|Reject|endActive|EndSession|reschedule|Reschedule|cancelSession|CancelSession|markAttendance|scanStudent|StudentScan)/.test(code))return 'edit';
 return null;
}
