import {escapeHtml as e} from '../utils/escapeHtml.js';
import {request} from '../services/api.js';

const actions={
 'groups.create':'أنشأ مجموعة','groups.edit':'عدّل مجموعة','students.create':'أضاف طالبًا','students.edit':'عدّل بيانات طالب',
 'attendance.edit':'رصد أو صحح الحضور','materials.create':'أضاف محتوى','materials.edit':'عدّل محتوى',
 'homework.edit':'راجع تسليم واجب','quizzes.create':'أنشأ اختبارًا','quizzes.edit':'عدّل اختبارًا',
 invitation_created:'إنشاء دعوة',invitation_accepted:'استكمال الحساب',access_configured:'تعديل الصلاحيات أو إعدادات الحساب',
};
const labels={name:'الاسم',subject:'المادة',parent_phone:'رقم ولي الأمر',student_phone:'رقم الطالب',notes:'ملاحظات',group_id:'المجموعة',attended:'الحضور',homework_status:'حالة الواجب',comment:'ملاحظة الحضور',title:'العنوان',description:'الوصف',type:'نوع المحتوى',url:'رابط المحتوى',is_homework:'تكليف واجب',due_date:'موعد التسليم',status:'حالة التسليم',teacher_notes:'ملاحظة المراجعة',quiz_number:'رقم الاختبار',max_score:'الدرجة النهائية',quiz_date:'تاريخ الاختبار'};
function value(key,v,groups){
 if(v===null || v===undefined || v==='')return '—';
 if(key==='group_id')return groups.find(g=>g.id===v)?.name || 'مجموعة';
 if(key==='attended')return v?'حاضر':'غائب';
 if(typeof v==='boolean')return v?'نعم':'لا';
 return ({done:'مكتمل',partial:'جزئي',missing:'لم يسلم',approved:'مقبول',rejected:'يحتاج إعادة تسليم',pending:'بانتظار المراجعة',pdf:'ملف PDF',video:'فيديو',link:'رابط'})[v] || String(v);
}
export function renderAssistantActivity(entries=[],assistants=[],groups=[]) {
 if(!entries.length)return '<p style="padding:1.5rem .5rem;text-align:center;color:var(--centrly-text)">لا يوجد نشاط مسجل لهذا الاختيار حتى الآن.</p>';
 return entries.map(row=>{
  const actor=row.actor_type==='owner'?'المدرس':row.actor_name || assistants.find(a=>a.id===row.assistant_id)?.name || 'مساعد سابق';
  let time='وقت غير متاح';try{time=new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date(row.created_at));}catch{}
  const before=row.changes?.before || {},after=row.changes?.after || {};
  const keys=Object.keys(after).filter(k=>Object.hasOwn(labels,k));
  return `<article style="border:1px solid var(--centrly-line,#e2e8f0);border-radius:12px;padding:1rem;margin-bottom:.75rem;overflow-wrap:anywhere">
   <div style="display:flex;justify-content:space-between;flex-wrap:wrap;gap:.5rem"><strong>${e(actor)}</strong><time datetime="${e(row.created_at || '')}" style="font-size:.8rem;color:var(--centrly-text)">${e(time)}</time></div>
   <p style="margin:.5rem 0">${e(actions[row.action] || 'إجراء على الحساب')}${row.target_name?` · <strong>${e(row.target_name)}</strong>`:''}</p>
   ${keys.length?`<details><summary style="cursor:pointer;min-height:44px;display:flex;align-items:center;color:var(--centrly-blue-700)">عرض التغييرات</summary><dl style="margin:.5rem 0 0">${keys.map(key=>`<div style="padding:.55rem 0;border-top:1px solid var(--centrly-line,#e2e8f0)"><dt style="font-weight:700">${labels[key]}</dt><dd style="margin:.25rem 0;font-size:.85rem"><span style="color:var(--centrly-text)">قبل:</span> ${e(value(key,before[key],groups))}<br><span style="color:var(--centrly-text)">بعد:</span> ${e(value(key,after[key],groups))}</dd></div>`).join('')}</dl></details>`:''}
  </article>`;
 }).join('');
}

export function registerAssistantActivityActions(app) {
 app.openAssistantActivityLog=function(){
  this._assistantActivityFilter='';
  const options=(this.teacherAssistants || []).map(a=>`<option value="${e(a.id)}">${e(a.name)}</option>`).join('');
  this.showModal('نشاط فريقك',`<p style="margin-top:0;color:var(--centrly-text)">راجع من غيّر بيانات الطلاب والحضور والواجبات، وما الذي تغيّر.</p><div style="display:flex;align-items:end;flex-wrap:wrap;gap:.75rem;margin-bottom:1rem"><div style="flex:1;min-width:0"><label class="form-label" for="assistantActivityFilter">المساعد</label><select id="assistantActivityFilter" class="form-select" style="min-height:44px" onchange="window.centrlyApp.setAssistantActivityFilter(this.value)"><option value="">كل الفريق</option>${options}</select></div><button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.loadAssistantActivity(1)">إعادة التحميل</button></div><div id="assistantActivityList" aria-live="polite"></div>`,`<button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.closeModal()">إغلاق</button>`);
  this.loadAssistantActivity(1);
 };
 app.setAssistantActivityFilter=function(id){this._assistantActivityFilter=id;this.loadAssistantActivity(1);};
 app.loadAssistantActivity=async function(page=1){
  const host=document.getElementById('assistantActivityList');if(!host)return;
  const seq=this._assistantActivitySeq=(this._assistantActivitySeq || 0)+1;
  host.innerHTML='<p role="status">تحميل نشاط الفريق…</p>';
  const params=new URLSearchParams({page:String(page)});if(this._assistantActivityFilter)params.set('assistant_id',this._assistantActivityFilter);
  try{
   const result=await request(`/assistants/activity?${params}`);
   if(this._assistantActivitySeq!==seq || !host.isConnected)return;
   host.innerHTML=renderAssistantActivity(result.entries,this.teacherAssistants || [],this.groups || [])+`<div style="display:flex;justify-content:space-between;align-items:center;gap:.5rem;flex-wrap:wrap"><button class="btn btn-secondary" style="min-height:44px" ${page===1?'disabled':''} onclick="window.centrlyApp.loadAssistantActivity(${page-1})">الأحدث</button><span style="font-size:.85rem">صفحة ${page.toLocaleString('ar-EG')}</span><button class="btn btn-secondary" style="min-height:44px" ${result.has_more?'':'disabled'} onclick="window.centrlyApp.loadAssistantActivity(${page+1})">الأقدم</button></div>`;
  }catch(error){
   if(this._assistantActivitySeq!==seq || !host.isConnected)return;
   host.innerHTML=`<p role="alert" style="color:var(--centrly-danger,#b91c1c)">${e(error.message || 'تعذر تحميل النشاط')}</p><button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.loadAssistantActivity(${page})">حاول مجددًا</button>`;
  }
 };
}
