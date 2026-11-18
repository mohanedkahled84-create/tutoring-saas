import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.92.0';
import {request} from '../services/api.js?v=9.92.0';
import {getLocale,startupMessages,startupStepEnglish} from '../utils/locale.js?v=9.92.0';
const routes=new Set(['settings','groups','students','materials','sessions','platform-builder','support']);
export function renderStartupChecklist(steps=[], locale=getLocale()){
 const done=steps.filter(step=>step.done).length, msg=startupMessages[locale] || startupMessages.ar;
 const progress=msg.progress.replace('{done}',String(done)).replace('{total}',String(steps.length));
 return `<p>${e(msg.intro)}</p><p role="status">${e(progress)}</p><progress value="${done}" max="${steps.length || 1}" style="width:100%" aria-label="${e(msg.progressLabel)}"></progress><div style="display:grid;gap:.75rem;margin-top:1rem">${steps.map(step=>`<section style="display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;justify-content:space-between;border:1px solid var(--centrly-line);border-radius:12px;padding:.75rem"><span style="overflow-wrap:anywhere">${step.done?e(msg.done):''}${e(locale==='en' ? (startupStepEnglish[step.id] || step.title) : step.title)}</span>${routes.has(step.route)?`<button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.openStartupStep('${step.route}')">${e(step.done?msg.open:msg.start)}</button>`:''}</section>`).join('')}<section style="display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;justify-content:space-between;border:1px solid var(--centrly-line);border-radius:12px;padding:.75rem"><span>${e(msg.help)}</span><button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.openStartupStep('support')">${e(msg.contact)}</button></section></div>`;
}
export function registerStartupChecklist(app){
 app.openStartupChecklist=async function(){
  if(this.delegation)return;
  const owner=[this.user?.id,this.user?.tenant_id].join(':'),locale=getLocale(),msg=startupMessages[locale] || startupMessages.ar;
  this.showModal(msg.title,`<div role="status" aria-label="${e(msg.loading)}" style="display:grid;gap:.85rem;min-height:150px;align-content:center"><div class="modal-skeleton-lines" aria-hidden="true"><span class="skeleton-box" style="width:44%;height:18px"></span><span class="skeleton-box" style="width:100%;height:54px"></span><span class="skeleton-box" style="width:100%;height:54px"></span><span class="skeleton-box" style="width:72%;height:54px"></span></div></div>`);
  const loadingModal=document.getElementById('centrlyCustomModal');
  const stillCurrent=()=>loadingModal?.isConnected && document.getElementById('centrlyCustomModal')===loadingModal && !this.delegation && [this.user?.id,this.user?.tenant_id].join(':')===owner;
  try{const {steps}=await request('/settings/startup-progress');if(!stillCurrent())return;if(!Array.isArray(steps))throw new Error('تعذر قراءة التقدم');this.showModal(msg.title,renderStartupChecklist(steps,locale));}catch(error){if(!stillCurrent())return;this.showModal(msg.error,`<p role="alert">${e(msg.error)}</p>`,`<button class="btn btn-secondary" onclick="window.centrlyApp.openStartupChecklist()">${e(msg.retry)}</button>`);}
 };
 app.openStartupStep=function(route){if(!routes.has(route))return;this.closeModal();this.navigate(route);};
}

if (globalThis.customElements && !customElements.get('centrly-startup-progress')) {
 customElements.define('centrly-startup-progress', class extends HTMLElement {
  async connectedCallback() {
   const app=window.centrlyApp;
   if (!app?.user?.id || app.delegation) return;
   const owner=[app.user.id,app.user.tenant_id].join(':'),en=getLocale()==='en';
   const key='centrly_startup_hidden:'+owner;
   if (localStorage.getItem(key)==='1') return;
   this.innerHTML='<div class="skeleton" style="height:2rem;border-radius:8px" role="status" aria-label="جار قراءة تقدمك"></div>';
   try {
    const {steps}=await request('/settings/startup-progress');
    if (!this.isConnected || window.centrlyApp!==app || app.delegation || [app.user?.id,app.user?.tenant_id].join(':')!==owner) return;
    this.innerHTML='<button type="button" class="btn btn-secondary" style="min-height:44px" data-dismiss-startup>إخفاء الخطوات</button>'.replace('إخفاء الخطوات',en?'Hide checklist':'إخفاء الخطوات')+renderStartupChecklist(steps);
    this.querySelector('[data-dismiss-startup]').addEventListener('click',()=>{
     localStorage.setItem(key,'1');
     this.replaceChildren();
     this.previousElementSibling?.focus();
    });
   } catch {
    if (this.isConnected) this.textContent='تعذر عرض التقدم. افتح قائمة البداية للمحاولة مجددًا.';
   }
  }
 });
}
