import {teacherPageTitles} from '../utils/teacherPageTitles.js?v=9.99.6';
import { escapeHtml } from '../utils/escapeHtml.js?v=9.99.6';
import { localize as t } from '../utils/language.js?v=9.99.6';
export const assistantPages = [["attendance", "بدء حصة ورصد الحضور", ["view", "create", "edit"]], ["homework", "مراجعة وتصحيح الواجبات", ["view", "edit"]], ["materials", "المذكرات والماتريال", ["view", "create", "edit", "delete"]], ["online-quizzes", "الكويزات الإلكترونية (أونلاين)", ["view", "create", "edit", "delete", "grade"]], ["quizzes", "رصد درجات الكويزات يدوياً", ["view", "create", "edit", "delete", "grade"]], ["platform-builder", "إنشاء منصتك المستقلة", ["view", "edit"]], ["video-lessons", "فيديوهات الشرح والحل", ["view", "create", "edit", "delete"]], ["students", "دليل طلابي", ["view", "create", "edit", "delete", "send", "collect"]], ["groups", "مجاميعي الدراسية", ["view", "create", "edit", "delete"]], ["assistants", "إدارة المساعدين (الأسستنت)", ["view", "create", "edit", "delete"]], ["sessions", "جدول الحصص والتقويم", ["view", "create", "edit", "delete"]], ["student-cards", "طلب كروت الطلاب", ["view", "create"]], ["dashboard", "لوحة المعلم والأرباح", ["view"]], ["reports", "الدرجات ولوحة الشرف", ["view", "send"]], ["risk-watchlist", "مؤشرات الخطر والإنذارات", ["view", "send"]], ["announcements", "الرسائل والإعلانات", ["view", "create", "edit", "send", "delete"]], ["settings", "الإعدادات", ["view", "edit"]]];
const assistantPageLabelsEn = {
 attendance: 'Start session & attendance',
 homework: 'Homework review & grading',
 materials: 'Notes & materials',
 'online-quizzes': 'Online quizzes',
 quizzes: 'Manual quiz grades',
 'platform-builder': 'Build your platform',
 'video-lessons': 'Lesson videos',
 students: 'Student directory',
 groups: 'My study groups',
 assistants: 'Assistants management',
 sessions: 'Class schedule & calendar',
 'student-cards': 'Order student cards',
 dashboard: 'Teacher dashboard & revenue',
 reports: 'Grades & honor board',
 'risk-watchlist': 'Risk alerts',
 announcements: 'Messages & announcements',
 settings: 'Settings',
};
const getPageHints = () => ({
 quizzes: t('إعداد الكويز: العنوان والتاريخ والدرجة النهائية', 'Quiz setup: title, date, and max score'),
 grades: t('درجات الطلاب: عرض النتائج ورصدها', 'Student grades: view and record scores'),
 sessions: t('عرض الحصص المسجلة فقط', 'View recorded sessions only'),
 reports: t('عرض تقرير متابعة الطالب', 'View student follow-up report'),
 messages: t('معاينة الرسالة وفتح واتساب للإرسال اليدوي', 'Preview message and open WhatsApp for manual sending'),
});
const getActionLabels = () => ({
 view: t('عرض', 'View'),
 create: t('إنشاء', 'Create'),
 edit: t('تعديل', 'Edit'),
 delete: t('حذف', 'Delete'),
 grade: t('رصد وتصحيح', 'Grade'),
 send: t('مشاركة الروابط', 'Share links'),
 collect: t('تسجيل تحصيل', 'Record collection'),
});
export function renderAssistantAccessFields(prefix,groups=[],access={}) {
 const p={...(access.permissions || {})};
 if(p['grades.view'])p['quizzes.view']=true;if(p['grades.edit'])p['quizzes.grade']=true;
 if(p['collections.view'])p['students.view']=true;if(p['collections.create'])p['students.collect']=true;
 if(p['messages.view'])p['reports.view']=true;if(p['messages.send'])p['reports.send']=true;
 const pageHints = getPageHints();
 const actionLabels = getActionLabels();
 return `<fieldset data-assistant-permissions style="border:1px solid var(--centrly-border,#e2e8f0);border-radius:12px;padding:1rem;min-width:0;margin:0 0 1rem">
  <legend style="font-weight:800;padding:0 .4rem">${t('الصفحات والصلاحيات', 'Pages & permissions')}</legend>
  <p style="font-size:.875rem;line-height:1.7;margin:0 0 .75rem;color:var(--centrly-text)">${t('فعّل الصفحات المطلوبة فقط، ثم اختر هل يستطيع المساعد العرض أم الإنشاء والتعديل أيضًا. كل صفحة لها صلاحيات مستقلة؛ امنح المساعد ما يحتاجه لشغله فقط.', 'Enable only the required pages, then choose whether the assistant can view or also create and edit. Each page has independent permissions; grant only what is needed for their role.')}</p>
  <label style="display:block;margin-bottom:1rem">${t('ابدأ بصلاحيات جاهزة', 'Start with a permission preset')}
  <select data-assistant-preset aria-label="${t('قالب صلاحيات المساعد', 'Assistant permission preset')}" style="width:100%;min-height:44px;margin-top:.4rem"><option value="">${t('اختيار يدوي', 'Custom selection')}</option><option value="full">${t('صلاحيات كاملة لكل المجموعات', 'Full access for all groups')}</option><option value="attendance">${t('مساعد حضور', 'Attendance assistant')}</option><option value="teaching">${t('مساعد تعليمي', 'Teaching assistant')}</option><option value="finance">${t('مساعد تحصيل', 'Collection assistant')}</option></select></label>
  ${["view","create","edit","delete","grade"].filter(action=>p[`paper-exams.${action}`]===true).map(action=>`<input type="checkbox" hidden name="${prefix}_Permission" value="paper-exams.${action}" checked>`).join('')}
  ${assistantPages.map(([key,label,actions])=>{const pageTitle=t(label, assistantPageLabelsEn[key] || label);return `<div data-permission-page="${key}" style="display:flex;flex-wrap:wrap;gap:.25rem 1rem;justify-content:space-between;align-items:center;padding:.5rem 0;border-bottom:1px solid var(--centrly-border,#e2e8f0)"><div><strong>${escapeHtml(pageTitle)}</strong>${pageHints[key]?`<p style="font-size:.8rem;line-height:1.6;margin:.25rem 0;color:var(--centrly-text)">${pageHints[key]}</p>`:''}</div><div style="display:flex;flex-wrap:wrap;gap:.5rem">${actions.map(action=>`<label style="display:flex;align-items:center;gap:.35rem;min-height:44px"><input type="checkbox" name="${prefix}_Permission" value="${key}.${action}" ${p[`${key}.${action}`]===true?'checked':''}>${key==='collections' && action==='create'?t('تسجيل تحصيل','Record collection'):key==='announcements' && action==='send'?t('إرسال التنبيهات','Send notifications'):actionLabels[action]}</label>`).join('')}</div></div>`;}).join('')}
  <p data-permission-feedback role="status" style="font-size:.8rem;line-height:1.6"></p>
  <p style="font-size:.8rem;line-height:1.6;color:var(--centrly-text)">${t('فتح واتساب يجهّز الرسالة فقط؛ المساعد يرسلها بنفسه. صلاحية إدارة الفريق لا تسمح للمساعد بمنح صلاحيات أو مجموعات أكثر من المسموح له.', 'Opening WhatsApp only prepares the message; the assistant sends it manually. Team management permission does not allow granting more permissions or groups than the assistant already holds.')}</p>
 </fieldset>
 <fieldset data-assistant-group-scope style="border:1px solid var(--centrly-border,#e2e8f0);border-radius:12px;padding:1rem;min-width:0;margin:0 0 1rem">
  <legend style="font-weight:800;padding:0 .4rem">${t('نطاق المجموعات', 'Group scope')}</legend>
  <label style="display:flex;align-items:center;gap:.5rem;min-height:44px"><input id="${prefix}_AllGroups" type="checkbox" ${access.all_groups?'checked':''}>${t('كل المجموعات الحالية والجديدة', 'All current and future groups')}</label>
  <p style="font-size:.8rem;line-height:1.6;color:var(--centrly-text)">${t('أو اختر مجموعات محددة. لو لم تحدد أي مجموعة، لن تظهر بيانات مجموعات للمساعد. إنشاء مجموعة جديدة يحتاج السماح بكل المجموعات.', 'Or select specific groups. If no groups are selected, no group data will be visible to the assistant. Creating a new group requires access to all groups.')}</p>
  <div style="display:flex;flex-wrap:wrap;gap:.5rem">${groups.map(g=>`<label style="display:flex;align-items:center;gap:.5rem;min-height:44px;padding:0 .5rem"><input type="checkbox" name="${prefix}_GroupScope" value="${escapeHtml(g.id)}" ${(access.group_ids || []).includes(g.id)?'checked':''}>${escapeHtml(g.name)}</label>`).join('') || `<p>${t('لا توجد مجموعات بعد.', 'No groups yet.')}</p>`}</div>
 </fieldset>`;
}
export function readAssistantAccessFields(prefix) {
 const permissions=Object.fromEntries([...document.querySelectorAll(`input[name="${prefix}_Permission"]:checked`)].map(el=>[el.value,true]));
 for(const key of Object.keys(permissions)) if(!permissions[`${key.split('.')[0]}.view`]) throw new Error(t('فعّل عرض الصفحة قبل صلاحية الإنشاء أو التعديل', 'Enable View on the page before Create or Edit permissions'));
 const all_groups=document.getElementById(`${prefix}_AllGroups`).checked;
 if(permissions['groups.create'] && !all_groups) throw new Error(t('إنشاء المجموعات يحتاج السماح بكل المجموعات', 'Creating groups requires granting access to all groups'));
 const group_ids=[...document.querySelectorAll(`input[name="${prefix}_GroupScope"]:checked`)].map(el=>el.value);
 return {permissions,all_groups,group_ids};
}

// Delegation also covers fields inserted later into owner dialogs.
if(typeof document!=='undefined' && !document.documentElement.hasAttribute('data-assistant-permission-events')){
 document.documentElement.setAttribute('data-assistant-permission-events','');
 document.addEventListener('change',event=>{
  if(event.target.matches?.('[data-assistant-preset]')){
   const sets={attendance:['attendance.view','attendance.create','attendance.edit','students.view','groups.view'],teaching:['attendance.view','homework.view','homework.edit','materials.view','materials.create','materials.edit','quizzes.view','quizzes.grade','reports.view','reports.send'],finance:['students.view','students.collect','groups.view']};
   const full=event.target.value==='full',chosen=sets[event.target.value];if(!full && !chosen)return;
   const fieldset=event.target.closest('[data-assistant-permissions]');for(const input of fieldset.querySelectorAll('input[type=checkbox]'))input.checked=full || chosen.includes(input.value);
   if(full){const allGroups=fieldset.nextElementSibling?.querySelector('[id$="_AllGroups"]');if(allGroups)allGroups.checked=true;}
   fieldset.querySelector('[data-permission-feedback]').textContent=full?t('تم تحديد كل الصلاحيات وكل المجموعات. راجعها قبل الحفظ.', 'All permissions and groups selected. Review before saving.'):t('تم اختيار صلاحيات القالب. راجعها وحدد نطاق المجموعات قبل الحفظ.', 'Preset permissions selected. Review them and choose group scope before saving.');return;
  }

  const input=event.target;if(!input.matches?.('[data-assistant-permissions] input[type="checkbox"]'))return;
  const row=input.closest('[data-permission-page]'),fieldset=input.closest('[data-assistant-permissions]');if(!row)return;
  const fields=[...row.querySelectorAll('input')],view=fields.find(f=>f.value.endsWith('.view'));let message='';
  if(input===view && !view.checked){for(const f of fields)f.checked=false;message=t('تم إلغاء باقي صلاحيات الصفحة مع العرض.', 'Remaining page permissions cleared with View.');}
  else if(input.checked && !view.checked){view.checked=true;message=t('تم تفعيل عرض الصفحة مع الصلاحية المختارة.', 'Page View enabled with the selected permission.');}
  fieldset.querySelector('[data-permission-feedback]').textContent=message;
 });
}
