import {teacherPageTitles} from '../utils/teacherPageTitles.js';
import { escapeHtml } from '../utils/escapeHtml.js';
export const assistantPages = [
 ['groups',teacherPageTitles.groups,['view','create','edit']], ['students',teacherPageTitles.students,['view','create','edit']],
 ['sessions',teacherPageTitles.sessions,['view']], ['attendance',teacherPageTitles.attendance,['view','edit']],
 ['homework',teacherPageTitles.homework,['view','edit']], ['materials',teacherPageTitles.materials,['view','create','edit']],
 ['quizzes',teacherPageTitles.quizzes,['view','create','edit']], ['grades',teacherPageTitles.grades,['view','edit']], ['collections',teacherPageTitles.collections,['view','create']], ['reports',teacherPageTitles.reports,['view']], ['messages',teacherPageTitles.messages,['view','send']],
];
const pageHints={quizzes:'إعداد الكويز: العنوان والتاريخ والدرجة النهائية',grades:'درجات الطلاب: عرض النتائج ورصدها',sessions:'عرض الحصص المسجلة فقط',reports:'عرض تقرير متابعة الطالب',messages:'معاينة الرسالة وفتح واتساب للإرسال اليدوي'};
const actionLabels={view:'عرض',create:'إنشاء',edit:'تعديل',send:'فتح واتساب'};
export function renderAssistantAccessFields(prefix,groups=[],access={}) {
 const p=access.permissions || {};
 return `<fieldset data-assistant-permissions style="border:1px solid var(--centrly-border,#e2e8f0);border-radius:12px;padding:1rem;min-width:0;margin:0 0 1rem">
  <legend style="font-weight:800;padding:0 .4rem">الصفحات والصلاحيات</legend>
  <p style="font-size:.875rem;line-height:1.7;margin:0 0 .75rem;color:var(--centrly-text)">فعّل الصفحات المطلوبة فقط، ثم اختر هل يستطيع المساعد العرض أم الإنشاء والتعديل أيضًا. بيانات الاشتراك والأرباح وإدارة الفريق خاصة بك.</p>
  ${assistantPages.map(([key,label,actions])=>`<div data-permission-page="${key}" style="display:flex;flex-wrap:wrap;gap:.25rem 1rem;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--centrly-border,#e2e8f0)"><div><strong>${label}</strong>${pageHints[key]?`<p style="font-size:.8rem;line-height:1.6;margin:.25rem 0;color:var(--centrly-text)">${pageHints[key]}</p>`:''}</div><div style="display:flex;flex-wrap:wrap;gap:.5rem">${actions.map(action=>`<label style="display:flex;align-items:center;gap:.35rem;min-height:44px"><input type="checkbox" name="${prefix}_Permission" value="${key}.${action}" ${p[`${key}.${action}`]===true?'checked':''}>${key==='collections' && action==='create'?'تسجيل تحصيل':actionLabels[action]}</label>`).join('')}</div></div>`).join('')}
  <p data-permission-feedback role="status" style="font-size:.8rem;line-height:1.6"></p>
  <p style="font-size:.8rem;line-height:1.6;color:var(--centrly-text)">فتح واتساب يجهّز الرسالة فقط؛ المساعد يرسلها بنفسه. الحذف النهائي وتغيير عضوية الطالب بالمجموعات يظلان من حساب المدرس.</p>
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

// Delegation also covers fields inserted later into owner dialogs.
if(typeof document!=='undefined' && !document.documentElement.hasAttribute('data-assistant-permission-events')){
 document.documentElement.setAttribute('data-assistant-permission-events','');
 document.addEventListener('change',event=>{
  const input=event.target;if(!input.matches?.('[data-assistant-permissions] input[type="checkbox"]'))return;
  const row=input.closest('[data-permission-page]'),fieldset=input.closest('[data-assistant-permissions]');if(!row)return;
  const fields=[...row.querySelectorAll('input')],view=fields.find(f=>f.value.endsWith('.view'));let message='';
  if(input===view && !view.checked){for(const f of fields)f.checked=false;message='تم إلغاء باقي صلاحيات الصفحة مع العرض.';}
  else if(input.checked && !view.checked){view.checked=true;message='تم تفعيل عرض الصفحة مع الصلاحية المختارة.';}
  fieldset.querySelector('[data-permission-feedback]').textContent=message;
 });
}
