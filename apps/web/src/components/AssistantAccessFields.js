import { escapeHtml } from '../utils/escapeHtml.js';
export const assistantPages = [
 ['groups','المجموعات',['view','create','edit']], ['students','الطلاب',['view','create','edit']],
 ['sessions','الحصص والجدول',['view']], ['attendance','الحضور والمتابعة',['view','edit']],
 ['homework','مراجعة الواجبات',['view','edit']], ['materials','المحاضرات والمذكرات',['view','create','edit']],
 ['quizzes','الاختبارات',['view','create','edit']], ['reports','تقارير متابعة الطلاب',['view']],
];
const actionLabels={view:'عرض',create:'إنشاء',edit:'تعديل'};
export function renderAssistantAccessFields(prefix,groups=[],access={}) {
 const p=access.permissions || {};
 return `<fieldset style="border:1px solid var(--centrly-border,#e2e8f0);border-radius:12px;padding:1rem;min-width:0;margin:0 0 1rem">
  <legend style="font-weight:800;padding:0 .4rem">الصفحات والصلاحيات</legend>
  <p style="font-size:.875rem;line-height:1.7;margin:0 0 .75rem;color:var(--centrly-text)">فعّل الصفحات المطلوبة فقط، ثم اختر هل يستطيع المساعد العرض أم الإنشاء والتعديل أيضًا. بيانات الاشتراك والأرباح وإدارة الفريق خاصة بك.</p>
  ${assistantPages.map(([key,label,actions])=>`<div style="display:flex;flex-wrap:wrap;gap:.25rem 1rem;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--centrly-border,#e2e8f0)"><strong>${label}</strong><div style="display:flex;flex-wrap:wrap;gap:.5rem">${actions.map(action=>`<label style="display:flex;align-items:center;gap:.35rem;min-height:44px"><input type="checkbox" name="${prefix}_Permission" value="${key}.${action}" ${p[`${key}.${action}`]===true?'checked':''}>${actionLabels[action]}</label>`).join('')}</div></div>`).join('')}
  <p style="font-size:.8rem;line-height:1.6;color:var(--centrly-text)">الحذف النهائي وتغيير عضوية الطالب بالمجموعات يظلان من حساب المدرس.</p>
 </fieldset>
 <fieldset style="border:1px solid var(--centrly-border,#e2e8f0);border-radius:12px;padding:1rem;min-width:0;margin:0 0 1rem">
  <legend style="font-weight:800;padding:0 .4rem">نطاق المجموعات</legend>
  <label style="display:flex;align-items:center;gap:.5rem;min-height:44px"><input id="${prefix}_AllGroups" type="checkbox" ${access.all_groups?'checked':''}>كل المجموعات الحالية والجديدة</label>
  <p style="font-size:.8rem;line-height:1.6;color:var(--centrly-text)">أو اختر مجموعات محددة. لو لم تحدد أي مجموعة، لن تظهر بيانات مجموعات للمساعد. إنشاء مجموعة جديدة يحتاج السماح بكل المجموعات.</p>
  <div style="display:flex;flex-wrap:wrap;gap:.5rem">${groups.map(g=>`<label style="display:flex;align-items:center;gap:.5rem;min-height:44px;padding:0 .5rem"><input type="checkbox" name="${prefix}_GroupScope" value="${escapeHtml(g.id)}" ${(access.group_ids || []).includes(g.id)?'checked':''}>${escapeHtml(g.name)}</label>`).join('') || '<p>لا توجد مجموعات بعد.</p>'}</div>
 </fieldset>`;
}
export function readAssistantAccessFields(prefix) {
 const permissions=Object.fromEntries([...document.querySelectorAll(`input[name="${prefix}_Permission"]:checked`)].map(el=>[el.value,true]));
 for(const key of Object.keys(permissions)) if(!permissions[`${key.split('.')[0]}.view`]) throw new Error('فعّل عرض الصفحة قبل صلاحية الإنشاء أو التعديل');
 const all_groups=document.getElementById(`${prefix}_AllGroups`).checked;
 if(permissions['groups.create'] && !all_groups) throw new Error('إنشاء المجموعات يحتاج السماح بكل المجموعات');
 const group_ids=[...document.querySelectorAll(`input[name="${prefix}_GroupScope"]:checked`)].map(el=>el.value);
 return {permissions,all_groups,group_ids};
}
