import {teacherPageTitles} from '../utils/teacherPageTitles.js';
import { escapeHtml } from '../utils/escapeHtml.js';
export const assistantPages = [["attendance", "بدء حصة ورصد الحضور", ["view", "create", "edit"]], ["homework", "مراجعة وتصحيح الواجبات", ["view", "edit"]], ["materials", "المذكرات والماتريال", ["view", "create", "edit", "delete"]], ["online-quizzes", "الكويزات الإلكترونية (أونلاين)", ["view", "create", "edit", "delete", "grade"]], ["paper-exams", "الامتحانات الورقية وبابل شيت", ["view", "create", "edit", "delete", "grade"]], ["quizzes", "رصد درجات الكويزات يدوياً", ["view", "create", "edit", "delete", "grade"]], ["platform-builder", "إنشاء منصتك المستقلة", ["view", "edit"]], ["video-lessons", "فيديوهات الشرح والحل", ["view", "create", "edit", "delete"]], ["students", "دليل طلابي", ["view", "create", "edit", "delete", "send", "collect"]], ["groups", "مجاميعي الدراسية", ["view", "create", "edit", "delete"]], ["assistants", "إدارة المساعدين (الأسستنت)", ["view", "create", "edit", "delete"]], ["sessions", "جدول الحصص والتقويم", ["view", "create", "edit", "delete"]], ["student-cards", "طلب كروت الطلاب", ["view", "create"]], ["dashboard", "لوحة المعلم والأرباح", ["view"]], ["reports", "الدرجات ولوحة الشرف", ["view", "send"]], ["risk-watchlist", "مؤشرات الخطر والإنذارات", ["view", "send"]], ["settings", "الإعدادات والاشتراك", ["view", "edit"]]];
const pageHints={quizzes:'إعداد الكويز: العنوان والتاريخ والدرجة النهائية',grades:'درجات الطلاب: عرض النتائج ورصدها',sessions:'عرض الحصص المسجلة فقط',reports:'عرض تقرير متابعة الطالب',messages:'معاينة الرسالة وفتح واتساب للإرسال اليدوي'};
const actionLabels={view:'عرض',create:'إنشاء',edit:'تعديل',delete:'حذف',grade:'رصد وتصحيح',send:'مشاركة الروابط',collect:'تسجيل تحصيل'};
export function renderAssistantAccessFields(prefix,groups=[],access={}) {
 const p={...(access.permissions || {})};
 if(p['grades.view'])p['quizzes.view']=true;if(p['grades.edit'])p['quizzes.grade']=true;
 if(p['collections.view'])p['students.view']=true;if(p['collections.create'])p['students.collect']=true;
 if(p['messages.view'])p['reports.view']=true;if(p['messages.send'])p['reports.send']=true;
 return `<fieldset data-assistant-permissions style="border:1px solid var(--centrly-border,#e2e8f0);border-radius:12px;padding:1rem;min-width:0;margin:0 0 1rem">
  <legend style="font-weight:800;padding:0 .4rem">الصفحات والصلاحيات</legend>
  <p style="font-size:.875rem;line-height:1.7;margin:0 0 .75rem;color:var(--centrly-text)">فعّل الصفحات المطلوبة فقط، ثم اختر هل يستطيع المساعد العرض أم الإنشاء والتعديل أيضًا. كل صفحة لها صلاحيات مستقلة؛ امنح المساعد ما يحتاجه لشغله فقط.</p>
  <label style="display:block;margin-bottom:1rem">ابدأ بصلاحيات جاهزة
  <select data-assistant-preset aria-label="قالب صلاحيات المساعد" style="width:100%;min-height:44px;margin-top:.4rem"><option value="">اختيار يدوي</option value="attendance">مساعد حضور</option><option value="teaching">مساعد تعليمي</option><option value="finance">مساعد تحصيل</option></select></label>
  ${assistantPages.map(([key,label,actions])=>`<div data-permission-page="${key}" style="display:flex;flex-wrap:wrap;gap:.25rem 1rem;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--centrly-border,#e2e8f0)"><div><strong>${label}</strong>${pageHints[key]?`<p style="font-size:.8rem;line-height:1.6;margin:.25rem 0;color:var(--centrly-text)">${pageHints[key]}</p>`:''}</div><div style="display:flex;flex-wrap:wrap;gap:.5rem">${actions.map(action=>`<label style="display:flex;align-items:center;gap:.35rem;min-height:44px"><input type="checkbox" name="${prefix}_Permission" value="${key}.${action}" ${p[`${key}.${action}`]===true?'checked':''}>${key==='collections' && action==='create'?'تسجيل تحصيل':actionLabels[action]}</label>`).join('')}</div></div>`).join('')}
  <p data-permission-feedback role="status" style="font-size:.8rem;line-height:1.6"></p>
  <p style="font-size:.8rem;line-height:1.6;color:var(--centrly-text)">فتح واتساب يجهّز الرسالة فقط؛ المساعد يرسلها بنفسه. صلاحية إدارة الفريق لا تسمح للمساعد بمنح صلاحيات أو مجموعات أكثر من المسموح له.</p>
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
  if(event.target.matches?.('[data-assistant-preset]')){
   const sets={attendance:['attendance.view','attendance.create','attendance.edit','students.view','groups.view'],teaching:['attendance.view','homework.view','homework.edit','materials.view','materials.create','materials.edit','quizzes.view','quizzes.grade','reports.view','reports.send'],finance:['students.view','students.collect','groups.view']};
   const chosen=sets[event.target.value];if(!chosen)return;
   const fieldset=event.target.closest('[data-assistant-permissions]');for(const input of fieldset.querySelectorAll('input[type=checkbox]'))input.checked=chosen.includes(input.value);
   fieldset.querySelector('[data-permission-feedback]').textContent='تم اختيار صلاحيات القالب. راجعها وحدد نطاق المجموعات قبل الحفظ.';return;
  }

  const input=event.target;if(!input.matches?.('[data-assistant-permissions] input[type="checkbox"]'))return;
  const row=input.closest('[data-permission-page]'),fieldset=input.closest('[data-assistant-permissions]');if(!row)return;
  const fields=[...row.querySelectorAll('input')],view=fields.find(f=>f.value.endsWith('.view'));let message='';
  if(input===view && !view.checked){for(const f of fields)f.checked=false;message='تم إلغاء باقي صلاحيات الصفحة مع العرض.';}
  else if(input.checked && !view.checked){view.checked=true;message='تم تفعيل عرض الصفحة مع الصلاحية المختارة.';}
  fieldset.querySelector('[data-permission-feedback]').textContent=message;
 });
}
