import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.99.7';
import {request} from '../services/api.js?v=9.99.7';
import {localize as t} from '../utils/language.js?v=9.99.7';

const getActions = () => ({
 'messages.prepare': t('طلب معاينة رسالة واتساب (لا يؤكد الإرسال)', 'WhatsApp message preview requested (does not confirm delivery)'),
 'groups.create': t('أنشأ مجموعة', 'Created a group'),
 'groups.edit': t('عدّل مجموعة', 'Edited a group'),
 'students.create': t('أضاف طالبًا', 'Added a student'),
 'students.edit': t('عدّل بيانات طالب', 'Edited student details'),
 'attendance.edit': t('رصد أو صحح الحضور', 'Recorded or updated attendance'),
 'materials.create': t('أضاف محتوى', 'Added content'),
 'materials.edit': t('عدّل محتوى', 'Edited content'),
 'collections.create': t('سجّل تحصيلًا', 'Recorded a collection'),
 'collections.void': t('ألغى تحصيلًا', 'Voided a collection'),
 'grades.edit': t('رصد أو صحح درجة', 'Recorded or updated a grade'),
 'homework.edit': t('راجع تسليم واجب', 'Reviewed homework submission'),
 'quizzes.create': t('أنشأ اختبارًا', 'Created a quiz'),
 'quizzes.edit': t('عدّل اختبارًا', 'Edited a quiz'),
 invitation_created: t('إنشاء دعوة', 'Created invitation'),
 invitation_accepted: t('استكمال الحساب', 'Completed account setup'),
 access_configured: t('تعديل الصلاحيات أو إعدادات الحساب', 'Updated permissions or account settings'),
});
const getLabels = () => ({
 recipient: t('المستلم', 'Recipient'),
 from: t('من', 'From'),
 to: t('إلى', 'To'),
 amount: t('المبلغ', 'Amount'),
 payment_method: t('طريقة الدفع', 'Payment method'),
 void_reason: t('سبب الإلغاء', 'Void reason'),
 score: t('الدرجة', 'Score'),
 note: t('ملاحظة الدرجة', 'Grade note'),
 name: t('الاسم', 'Name'),
 subject: t('المادة', 'Subject'),
 parent_phone: t('رقم ولي الأمر', 'Parent phone'),
 student_phone: t('رقم الطالب', 'Student phone'),
 notes: t('ملاحظات', 'Notes'),
 group_id: t('المجموعة', 'Group'),
 attended: t('الحضور', 'Attendance'),
 homework_status: t('حالة الواجب', 'Homework status'),
 comment: t('ملاحظة الحضور', 'Attendance note'),
 title: t('العنوان', 'Title'),
 description: t('الوصف', 'Description'),
 type: t('نوع المحتوى', 'Content type'),
 url: t('رابط المحتوى', 'Content URL'),
 is_homework: t('تكليف واجب', 'Homework assignment'),
 due_date: t('موعد التسليم', 'Due date'),
 status: t('حالة التسليم', 'Submission status'),
 teacher_notes: t('ملاحظة المراجعة', 'Review note'),
 quiz_number: t('رقم الاختبار', 'Quiz number'),
 max_score: t('الدرجة النهائية', 'Max score'),
 quiz_date: t('تاريخ الاختبار', 'Quiz date'),
});
function value(key,v,groups){
 if(v===null || v===undefined || v==='')return '—';
 if(key==='group_id')return groups.find(g=>g.id===v)?.name || t('مجموعة', 'Group');
 if(key==='attended')return v?t('حاضر', 'Present'):t('غائب', 'Absent');
 if(typeof v==='boolean')return v?t('نعم', 'Yes'):t('لا', 'No');
 return ({
  parent: t('ولي الأمر', 'Parent'),
  student: t('الطالب', 'Student'),
  done: t('مكتمل', 'Done'),
  partial: t('جزئي', 'Partial'),
  missing: t('لم يسلم', 'Missing'),
  approved: t('مقبول', 'Approved'),
  rejected: t('يحتاج إعادة تسليم', 'Needs resubmission'),
  cash: t('نقدي', 'Cash'),
  instapay: t('إنستاباي', 'InstaPay'),
  vodafone_cash: t('فودافون كاش', 'Vodafone Cash'),
  bank_transfer: t('تحويل بنكي', 'Bank transfer'),
  other: t('أخرى', 'Other'),
  active: t('مسجل', 'Active'),
  void: t('ملغى', 'Voided'),
  pending: t('بانتظار المراجعة', 'Pending review'),
  pdf: t('ملف PDF', 'PDF file'),
  video: t('فيديو', 'Video'),
  link: t('رابط', 'Link'),
 })[v] || String(v);
}
export function renderAssistantActivity(entries=[],assistants=[],groups=[]) {
 if(!entries.length)return `<p style="padding:1.5rem .5rem;text-align:center;color:var(--centrly-text)">${t('لا يوجد نشاط مسجل لهذا الاختيار حتى الآن.', 'No recorded activity for this selection yet.')}</p>`;
 const actions=getActions(), labels=getLabels();
 return entries.map(row=>{
  const actor=row.actor_type==='owner'?t('المدرس', 'Teacher'):row.actor_name || assistants.find(a=>a.id===row.assistant_id)?.name || t('مساعد سابق', 'Former assistant');
  let time=t('وقت غير متاح', 'Time unavailable');try{time=new Intl.DateTimeFormat(t('ar-EG','en-EG'),{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at));}catch{}
  const before=row.changes?.before || {},after=row.changes?.after || {};
  const keys=Object.keys(after).filter(k=>Object.hasOwn(labels,k));
  return `<article style="border:1px solid var(--centrly-line,#e2e8f0);border-radius:12px;padding:1rem;margin-bottom:.75rem;overflow-wrap:anywhere">
   <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem"><strong>${e(actor)}</strong><time datetime="${e(row.created_at || '')}" style="font-size:.8rem;color:var(--centrly-text)">${e(time)}</time></div>
   <p style="margin:.5rem 0">${e(actions[row.action] || t('إجراء على الحساب', 'Account action'))}${row.target_name?` · <strong>${e(row.target_name)}</strong>`:''}</p>
   ${keys.length?`<details><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--centrly-blue-700)">${t('عرض التغييرات', 'View changes')}</summary><dl style="margin:.5rem 0 0">${keys.map(key=>`<div style="padding:.55rem 0;border-top:1px solid var(--centrly-line,#e2e8f0)"><dt style="font-weight:700">${labels[key]}</dt><dd style="margin:.25rem 0;font-size:.85rem"><span style="color:var(--centrly-text)">${t('قبل:', 'Before:')}</span> ${e(value(key,before[key],groups))}<br><span style="color:var(--centrly-text)">${t('بعد:', 'After:')}</span> ${e(value(key,after[key],groups))}</dd></div>`).join('')}</dl></details>`:''}
  </article>`;
 }).join('');
}

export function registerAssistantActivityActions(app) {
 app.openAssistantActivityLog=function(){
  this._assistantActivityFilter='';
  const options=(this.teacherAssistants || []).map(a=>`<option value="${e(a.id)}">${e(a.name)}</option>`).join('');
  this.showModal(t('نشاط فريقك', 'Team activity'),`<div dir="${t('rtl','ltr')}"><p style="margin-top:0;color:var(--centrly-text)">${t('راجع من غيّر بيانات الطلاب والحضور والواجبات، وما الذي تغيّر.', 'Review who changed student records, attendance, and homework, and what changed.')}</p><div style="display:flex;align-items:end;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem"><div style="flex:1;min-width:0"><label class="form-label" for="assistantActivityFilter">${t('المساعد', 'Assistant')}</label><select id="assistantActivityFilter" class="form-select" style="min-height:44px" onchange="window.centrlyApp.setAssistantActivityFilter(this.value)"><option value="">${t('كل الفريق', 'All team members')}</option>${options}</select></div><button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.loadAssistantActivity(1)">${t('إعادة التحميل', 'Reload')}</button></div><div id="assistantActivityList" aria-live="polite"></div></div>`,`<button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.closeModal()">${t('إغلاق', 'Close')}</button>`);
  this.loadAssistantActivity(1);
 };
 app.setAssistantActivityFilter=function(id){this._assistantActivityFilter=id;this.loadAssistantActivity(1);};
 app.loadAssistantActivity=async function(page=1){
  const host=document.getElementById('assistantActivityList');if(!host)return;
  const seq=this._assistantActivitySeq=(this._assistantActivitySeq || 0)+1;
  host.innerHTML=`<p role="status">${t('تحميل نشاط الفريق…', 'Loading team activity…')}</p>`;
  const params=new URLSearchParams({page:String(page)});if(this._assistantActivityFilter)params.set('assistant_id',this._assistantActivityFilter);
  try{
   const result=await request(`/assistants/activity?${params}`);
   if(this._assistantActivitySeq!==seq || !host.isConnected)return;
   host.innerHTML=renderAssistantActivity(result.entries,this.teacherAssistants || [],this.groups || [])+`<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><button class="btn btn-secondary" style="min-height:44px" ${page===1?'disabled':''} onclick="window.centrlyApp.loadAssistantActivity(${page-1})">${t('الأحدث', 'Newer')}</button><span style="font-size:.85rem">${t('صفحة', 'Page')} ${page.toLocaleString(t('ar-EG','en-EG'))}</span><button class="btn btn-secondary" style="min-height:44px" ${result.has_more?'':'disabled'} onclick="window.centrlyApp.loadAssistantActivity(${page+1})">${t('الأقدم', 'Older')}</button></div>`;
  }catch(error){
   if(this._assistantActivitySeq!==seq || !host.isConnected)return;
   host.innerHTML=`<p role="alert" style="color:var(--centrly-danger,#b91c1c)">${e(error.message || t('تعذر تحميل النشاط', 'Failed to load activity'))}</p><button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.loadAssistantActivity(${page})">${t('حاول مجددًا', 'Try again')}</button>`;
  }
 };
}
