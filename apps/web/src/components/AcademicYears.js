import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.43.0';
import {request} from '../services/api.js?v=9.43.0';

const dateLabel=value=>value?new Date(value+'T12:00:00').toLocaleDateString('ar-EG'):'';
const button=(text,action)=>`<button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.${action}">${text}</button>`;
export function registerAcademicYears(app){
 app.openAcademicYears=async function(){
  const actor=this.user?.id;
  if(this.delegation){this.showToast('إدارة السنة متاحة لصاحب حساب المدرس','info');return;}
  this.showModal('السنة الدراسية','<p role="status">جار تحميل السنوات…</p>');
  try{
   const {result}=await request('/settings/academic-years');if(this.user?.id!==actor || window.centrlyApp!==this)return;this._academicYears=result;this._academicYearDraft=null;
   const active=result.active;
   this.showModal('السنة الدراسية',`<div style="display:grid;gap:1rem"><section><h3>${active?e(active.name):'ابدأ تنظيم السنة الحالية'}</h3><p>${active?`${dateLabel(active.starts_on)} — ${dateLabel(active.ends_on)}`:'سجّل اسم السنة وتواريخها لربط مجموعاتك ومحتواك الحالي بها.'}</p><p>إنهاء السنة يحفظ سجل المجموعات والحضور والدرجات والتسليمات. الأرصدة والتحصيل لا يتغيران، ولا يتم تصفير أي مستحقات.</p>${active?`<p>${Number(result.groups.length)} مجموعة نشطة · ${Number(result.students.length)} طالبًا</p>${result.ongoing_sessions?'<p role="status">أنه الحصص الجارية أولًا قبل الانتقال لسنة جديدة.</p>':''}`:''}${button(active?'إنهاء السنة وبدء سنة جديدة':'تسجيل السنة الحالية',"editAcademicYear()")}</section><section><h3>أرشيف السنوات</h3>${result.years.filter(y=>y.status==='closed').map(y=>`<div style="display:flex;flex-wrap:wrap;justify-content:space-between;align-items:center;gap:.75rem;padding:.75rem 0;border-top:1px solid var(--centrly-line)"><strong>${e(y.name)}</strong>${button('فتح الأرشيف',`openAcademicYearArchive('${e(y.id)}')`)}</div>`).join('') || '<p>لا توجد سنوات منتهية بعد.</p>'}</section></div>`);
  }catch(error){this.showModal('تعذر تحميل السنوات',`<p role="alert">${e(error.message)}</p>`,button('حاول مجددًا','openAcademicYears()'));}
 };
 app.editAcademicYear=function(){
  const state=this._academicYears;if(!state)return;
  if(state.active && state.ongoing_sessions){this.showToast('أنه الحصص الجارية أولًا','info');return;}
  this.showModal(state.active?'تجهيز السنة الجديدة':'تسجيل السنة الحالية',`<form id="academicYearForm" onsubmit="window.centrlyApp.reviewAcademicYear(event)" style="display:grid;gap:1rem"><label>اسم السنة<input id="yearName" class="form-input" maxlength="100" required placeholder="مثال: ٢٠٢٦ / ٢٠٢٧"></label><label>تاريخ البداية<input id="yearStart" type="date" class="form-input" required ${state.active?`min="${e(nextDate(state.active.starts_on))}"`:''}></label><label>تاريخ النهاية<input id="yearEnd" type="date" class="form-input" required></label>${state.active?`<p>المجموعات المحددة تُنشأ بنسخة جديدة بنفس جدولها. اختَر الطلاب المستمرين فقط؛ لن تتغير بيانات حساباتهم وروابطهم. المحتوى السابق يمكن إعادة استخدامه بتكليف جديد.</p><fieldset style="min-width:0"><legend>المجموعات المستمرة</legend><div style="max-height:220px;overflow:auto">${state.groups.map(g=>`<label style="display:flex;align-items:center;gap:.6rem;min-height:44px"><input type="checkbox" data-year-group value="${e(g.id)}" onchange="window.centrlyApp.updateAcademicYearStudents()">${e(g.name)}</label>`).join('') || '<p>لا توجد مجموعات نشطة.</p>'}</div></fieldset><fieldset style="min-width:0"><legend>الطلاب المستمرون</legend><p id="yearStudentHint" aria-live="polite">اختَر المجموعات لعرض طلابها.</p><label>بحث عن طالب<input type="search" id="yearStudentSearch" class="form-input" oninput="window.centrlyApp.filterAcademicYearStudents()"></label><div id="yearStudentChoices" style="max-height:260px;overflow:auto"></div></fieldset>`:'<p>سيتم ربط المجموعات والمحتوى الحالي بهذه السنة. لن يتم نقل أو أرشفة أي طالب.</p>'}</form>`,`${button('رجوع','openAcademicYears()')}<button class="btn btn-primary" type="submit" form="academicYearForm" style="min-height:44px">مراجعة الاختيارات</button>`);
  const draft=this._academicYearDraft?.data;
  if(draft){
   document.getElementById('yearName').value=draft.name;document.getElementById('yearStart').value=draft.starts_on;document.getElementById('yearEnd').value=draft.ends_on;
   for(const input of document.querySelectorAll('[data-year-group]'))input.checked=(draft.group_ids || []).includes(input.value);
   if(state.active){this.updateAcademicYearStudents();for(const input of document.querySelectorAll('[data-year-student]'))input.checked=(draft.student_ids || []).includes(input.value);}
  }
 };
 app.updateAcademicYearStudents=function(){
  const selected=new Set([...document.querySelectorAll('[data-year-group]:checked')].map(x=>x.value));
  const checked=new Set([...document.querySelectorAll('[data-year-student]:checked')].map(x=>x.value));
  const eligible=this._academicYears.students.filter(s=>(s.group_ids || []).some(g=>selected.has(g)));
  document.getElementById('yearStudentChoices').innerHTML=eligible.map(s=>`<label data-year-student-row style="display:flex;align-items:center;gap:.6rem;min-height:44px;overflow-wrap:anywhere"><input type="checkbox" data-year-student value="${e(s.id)}" ${checked.has(s.id)?'checked':''}>${e(s.name)} · ${e(s.student_code || '')}</label>`).join('');
  document.getElementById('yearStudentHint').textContent=`${selected.size} مجموعة محددة · ${eligible.length} طالبًا متاحًا للاختيار. اترك غير المستمرين بدون تحديد.`;
  this.filterAcademicYearStudents();
 };
 app.filterAcademicYearStudents=function(){const search=document.getElementById('yearStudentSearch')?.value.trim().toLocaleLowerCase('ar') || '';for(const row of document.querySelectorAll('[data-year-student-row]'))row.style.display=row.textContent.toLocaleLowerCase('ar').includes(search)?'flex':'none';};
 app.reviewAcademicYear=function(event){
  event.preventDefault();const state=this._academicYears;if(!state)return;
  const data={name:document.getElementById('yearName').value.trim(),starts_on:document.getElementById('yearStart').value,ends_on:document.getElementById('yearEnd').value};
  if(!data.name || !data.starts_on || !data.ends_on || data.ends_on<data.starts_on || state.active && data.starts_on<=state.active.starts_on){this.showToast('راجع اسم السنة وتواريخ البداية والنهاية','error');return;}
  if(state.active)Object.assign(data,{expected_year_id:state.active.id,group_ids:[...document.querySelectorAll('[data-year-group]:checked')].map(x=>x.value),student_ids:[...document.querySelectorAll('[data-year-student]:checked')].map(x=>x.value),confirmed:true});
  this._academicYearDraft={data,action:state.active?'rollover':'start'};
  const groups=state.groups.filter(g=>data.group_ids?.includes(g.id));
  const students=state.students.filter(s=>data.student_ids?.includes(s.id));
  this.showModal('راجع قبل التأكيد',`<h3>${e(data.name)}</h3><p>${dateLabel(data.starts_on)} — ${dateLabel(data.ends_on)}</p>${state.active?`<p>ستصبح <strong>${e(data.name)}</strong> السنة النشطة فور التأكيد، وتُغلق <strong>${e(state.active.name)}</strong>. لا يمكن التراجع عن إنهاء السنة من هذه الشاشة.</p><h4>المجموعات المستمرة (${groups.length})</h4><p>${groups.map(g=>e(g.name)).join('، ') || 'بدون مجموعات؛ ستبدأ السنة الجديدة فارغة.'}</p><h4>الطلاب المستمرون (${students.length})</h4><div style="max-height:180px;overflow:auto">${students.map(s=>`<p>${e(s.name)} · ${e(s.student_code || '')}</p>`).join('') || '<p>لم تحدد طلابًا؛ سيُؤرشف الطلاب المرتبطون بمجموعات السنة القديمة.</p>'}</div><p>تظل صلاحيات المساعدين مرتبطة بمجموعاتهم القديمة؛ راجع إسناد المجموعات الجديدة لهم بعد الانتهاء. الحضور والدرجات والتسليمات والتحصيل القديم محفوظ، ولا تُصفّر الأرصدة.</p><label style="display:flex;align-items:center;gap:.6rem;min-height:44px"><input type="checkbox" id="yearConfirm">راجعت الاختيارات وأوافق على إنهاء السنة الحالية</label>`:'<p>سيتم ربط البيانات الحالية بالسنة المسجلة دون أرشفة أو تغيير المستحقات.</p>'}`,`${button('تعديل الاختيارات','editAcademicYear()')}<button type="button" class="btn btn-primary" style="min-height:44px" onclick="window.centrlyApp.confirmAcademicYear(this)">${state.active?'تأكيد إنهاء السنة وبدء الجديدة':'تسجيل السنة'}</button>`);
 };
 app.confirmAcademicYear=async function(control){
  const draft=this._academicYearDraft;if(!draft)return;
  if(draft.action==='rollover' && !document.getElementById('yearConfirm')?.checked){this.showToast('أكد مراجعة اختيارات السنة أولًا','error');return;}
  control.disabled=true;
  try{await request('/settings/academic-years/'+draft.action,{method:'POST',body:draft.data});this._academicYearDraft=null;this.students=[];this.groups=[];this.materials=[];this.showToast('تم تسجيل السنة وحفظ السجل السابق','success');await this.loadRouteData('groups');await this.loadRouteData('students');await this.openAcademicYears();}
  catch(error){this.showToast(error.message || 'تعذر إتمام السنة؛ راجع الحالة قبل المحاولة مجددًا','error');if(control.isConnected)control.disabled=false;}
 };
 app.openAcademicYearArchive=async function(id){
  this.showModal('أرشيف السنة','<p role="status">جار تحميل الأرشيف…</p>');
  try{const {result}=await request('/settings/academic-years/'+encodeURIComponent(id)+'/archive');this.showModal(e(result.year.name),`<p>${Number(result.session_count)} حصة · ${Number(result.attendance_count)} سجل حضور محفوظ</p><p>هذه قائمة الطلاب والمجموعات وقت إغلاق السنة. تفاصيل الحضور والدرجات والتحصيل تظل محفوظة في تقاريرها بالمجموعات الأصلية.</p><div style="display:grid;gap:1rem">${result.groups.map(g=>`<section><h3>${e(g.name)}</h3>${result.students.filter(s=>s.group_id===g.id).map(s=>`<p>${e(s.student_name)} · ${e(s.student_code || '')}</p>`).join('') || '<p>لا يوجد طلاب مسجلون في أرشيف هذه المجموعة.</p>'}</section>`).join('')}</div>`,button('رجوع للسنوات','openAcademicYears()'));}catch(error){this.showModal('تعذر تحميل أرشيف السنة',`<p role="alert">${e(error.message)}</p>`,button('رجوع','openAcademicYears()'));}
 };
}
function nextDate(date){const d=new Date(date+'T12:00:00Z');d.setUTCDate(d.getUTCDate()+1);return d.toISOString().slice(0,10);}
