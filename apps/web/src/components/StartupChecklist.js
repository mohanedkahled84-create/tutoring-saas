import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.99.3';
import {request} from '../services/api.js?v=9.99.3';
import {getLocale,startupMessages,startupStepEnglish} from '../utils/locale.js?v=9.99.3';
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
 app.restoreStartupChecklist=function(){
  const owner=[this.user?.id,this.user?.tenant_id].join(':');
  try{localStorage.removeItem('centrly_startup_hidden:'+owner);}catch{}
  const current=document.querySelector('centrly-startup-progress');
  if(current)current.replaceWith(document.createElement('centrly-startup-progress'));
 };
 app.openStartupStep=function(route){if(!routes.has(route))return;this.closeModal();this.navigate(route);};
}


if (globalThis.customElements && !customElements.get('centrly-startup-progress')) {
 customElements.define('centrly-startup-progress', class extends HTMLElement {
  connectedCallback() { this.refresh(); }
  async refresh() {
   const generation=this._generation=(this._generation || 0)+1;
   const app=window.centrlyApp;
   if(!app?.user?.id || app.delegation || app.user.role==='admin')return;
   const owner=[app.user.id,app.user.tenant_id].join(':');
   const key='centrly_startup_hidden:'+owner, collapsedKey='centrly_startup_collapsed:'+owner;
   try{if(localStorage.getItem(key)==='1')return;}catch{}
   const en=getLocale()==='en';
   if(!this.firstElementChild)this.innerHTML='<aside class="startup-float" aria-label="'+(en?'Getting started':'خطوات البداية')+'"><div role="status" class="skeleton-box" style="height:48px"></div></aside>';
   try{
    const {steps}=await request('/settings/startup-progress');
    if(!Array.isArray(steps))throw new Error('Invalid steps');
    if(!this.isConnected || this._generation!==generation || window.centrlyApp!==app || [app.user?.id,app.user?.tenant_id].join(':')!==owner)return;
    const done=steps.filter(step=>step.done).length;
    const previous=app._startupStepSnapshot?.owner===owner?app._startupStepSnapshot.done:null;
    const newlyDone=new Set(steps.filter(step=>step.done && previous?.get(step.id)===false).map(step=>step.id));
    app._startupStepSnapshot={owner,done:new Map(steps.map(step=>[step.id,Boolean(step.done)]))};
    this.innerHTML=`<aside class="startup-float"><header><strong>${en?'Getting started':'خطوات البداية'} · ${done}/${steps.length}</strong><div><button type="button" data-collapse aria-expanded="true">${en?'Minimize':'تصغير'}</button><button type="button" data-dismiss aria-label="${en?'Hide checklist':'إخفاء الخطوات'}">×</button></div></header><div class="startup-float-body"><progress max="${steps.length || 1}" value="${done}" aria-label="${en?'Getting started progress':'تقدم خطوات البداية'}"></progress><ul>${steps.map(step=>`<li ${step.done?(newlyDone.has(step.id)?'class="startup-step-completing" inert':'hidden'):''}><button type="button" data-route="${e(routes.has(step.route)?step.route:'')}" ${routes.has(step.route)?'':'disabled'}><span aria-hidden="true">${step.done?'✓':'○'}</span><span ${step.done?'class="is-done"':''}>${e(en?(startupStepEnglish[step.id] || step.title):step.title)}</span></button></li>`).join('')}</ul></div></aside>`;
    const body=this.querySelector('.startup-float-body'),toggle=this.querySelector('[data-collapse]');
    const collapse=value=>{body.hidden=value;toggle.setAttribute('aria-expanded',String(!value));toggle.innerHTML='<svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="'+(value?'m6 9 6 6 6-6':'m6 15 6-6 6 6')+'"/></svg>';toggle.setAttribute('aria-label',value?(en?'Expand getting started':'عرض خطوات البداية'):(en?'Collapse getting started':'تصغير خطوات البداية'));toggle.style.minHeight='44px';toggle.style.minWidth='44px';};
    try{collapse(localStorage.getItem(collapsedKey)==='1');}catch{collapse(false);}
    toggle.addEventListener('click',()=>{const value=!body.hidden;collapse(value);try{localStorage.setItem(collapsedKey,value?'1':'0');}catch{}});
    this.querySelector('[data-dismiss]').addEventListener('click',()=>{this._generation++;try{localStorage.setItem(key,'1');}catch{}this.replaceChildren();});
    this.querySelectorAll('[data-route]').forEach(button=>button.addEventListener('click',()=>{if(routes.has(button.dataset.route))app.navigate(button.dataset.route);}));
   }catch{if(this.isConnected && this._generation===generation && this.querySelector('.skeleton-box'))this.replaceChildren();}
  }
 });
}
