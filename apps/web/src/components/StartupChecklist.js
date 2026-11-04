import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.42.0';
import {request} from '../services/api.js?v=9.42.0';
const routes=new Set(['settings','groups','students','materials','sessions','platform-builder']);
export function renderStartupChecklist(steps=[]){
 const done=steps.filter(step=>step.done).length;
 return `<p>قائمة اختيارية تساعدك تبدأ بالترتيب اللي يناسبك. تقدر تستخدم المنصة وتسيب أي خطوة لوقت لاحق.</p><p role="status">أنجزت ${done} من ${steps.length}</p><progress value="${done}" max="${steps.length || 1}" style="width:100%" aria-label="تقدم خطوات البداية"></progress><div style="display:grid;gap:.75rem;margin-top:1rem">${steps.map(step=>`<section style="display:flex;flex-wrap:wrap;align-items:center;gap:.75rem;justify-content:space-between;border:1px solid var(--centrly-line);border-radius:12px;padding:.75rem"><span style="overflow-wrap:anywhere">${step.done?'تم · ':''}${e(step.title)}</span>${routes.has(step.route)?`<button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.openStartupStep('${step.route}')">${step.done?'فتح الصفحة':'ابدأ الخطوة'}</button>`:''}</section>`).join('')}</div>`;
}
export function registerStartupChecklist(app){
 app.openStartupChecklist=async function(){
  if(this.delegation)return;
  const owner=[this.user?.id,this.user?.tenant_id].join(':');
  this.showModal('قائمة البداية الاختيارية','<p role="status">جار قراءة تقدمك…</p>');
  try{const {steps}=await request('/settings/startup-progress');if(this.delegation || [this.user?.id,this.user?.tenant_id].join(':')!==owner)return;this.showModal('خطواتك الأولى في سنترلي',renderStartupChecklist(steps));}catch(error){if(this.delegation || [this.user?.id,this.user?.tenant_id].join(':')!==owner)return;this.showModal('تعذر تحميل قائمة البداية',`<p role="alert">${e(error.message)}</p>`,'<button class="btn btn-secondary" onclick="window.centrlyApp.openStartupChecklist()">حاول مجددًا</button>');}
 };
 app.openStartupStep=function(route){if(!routes.has(route))return;this.closeModal();this.navigate(route);};
}
