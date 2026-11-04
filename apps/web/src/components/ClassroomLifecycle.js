import {escapeHtml as e} from '../utils/escapeHtml.js';
import {request} from '../services/api.js';

const names={students:'الطلاب',groups:'المجموعات'};
export function registerClassroomLifecycle(app){
 app.openClassroomArchive=async function(kind){
  if(!names[kind])return;
  this.showModal('أرشيف '+names[kind],'<p role="status">جار تحميل الأرشيف…</p>');
  try{
   const result=await request('/'+kind+'/archived');
   const body=`<p>السجلات المؤرشفة محفوظة ويمكن استعادتها. الأرشفة لا تمسح الحضور أو الدرجات أو التحصيل.</p><div style="display:grid;gap:.75rem">${(result.result || []).map(row=>`<article style="border:1px solid var(--centrly-border,#dce3ec);border-radius:12px;padding:.75rem;display:flex;flex-wrap:wrap;gap:.75rem;align-items:center;justify-content:space-between"><div><strong>${e(row.name)}</strong><small style="display:block">${e(row.student_code || '')} · ${e(new Date(row.archived_at).toLocaleDateString('ar-EG'))}</small></div><button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.restoreClassroomRecord('${kind}','${e(row.id)}')">استعادة</button></article>`).join('') || '<p>لا توجد سجلات مؤرشفة.</p>'}</div>`;
   this.showModal('أرشيف '+names[kind],body);
  }catch(error){this.showModal('تعذر تحميل الأرشيف',`<p role="alert">${e(error.message)}</p>`,`<button class="btn btn-secondary" onclick="window.centrlyApp.openClassroomArchive('${kind}')">حاول مجددًا</button>`);}
 };
 app.archiveClassroomRecord=function(kind,id){
  if(!names[kind])return;
  const row=(this[kind] || []).find(row=>row.id===id);if(!row)return;
  this._classroomArchive={kind,id};
  this.showModal('أرشفة '+(kind==='students'?'الطالب':'المجموعة'),`<p><strong>${e(row.name)}</strong></p><p>سيختفي السجل من القوائم اليومية، وتظل بيانات الحضور والدرجات والتسليمات والتحصيل محفوظة. يمكنك استعادته من الأرشيف.</p>`,`<button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button><button class="btn btn-primary" style="min-height:44px" onclick="window.centrlyApp.confirmClassroomArchive(this)">تأكيد الأرشفة</button>`);
 };
 app.confirmClassroomArchive=async function(button){
  const saved=this._classroomArchive;if(!saved)return;button.disabled=true;
  try{await request('/'+saved.kind+'/'+encodeURIComponent(saved.id)+'/archive',{method:'POST',body:{}});this._classroomArchive=null;this.closeModal();this.showToast('تمت الأرشفة مع حفظ السجل السابق','success');await this.loadRouteData(saved.kind);}
  catch(error){this.showToast(error.message || 'تعذرت الأرشفة','error');if(button.isConnected)button.disabled=false;}
 };
 app.restoreClassroomRecord=async function(kind,id){
  if(!names[kind])return;
  try{await request('/'+kind+'/'+encodeURIComponent(id)+'/restore',{method:'POST',body:{}});this.showToast('تمت استعادة السجل','success');await this.loadRouteData(kind);await this.openClassroomArchive(kind);}
  catch(error){
   if(kind==='students' && error.code==='ACTIVE_GROUP_REQUIRED'){
    this._restoreStudentId=id;
    this.showModal('استعادة الطالب للمجموعة الحالية',`<p>مجموعة الطالب السابقة مؤرشفة. اختر مجموعته الحالية مع الاحتفاظ بتاريخه القديم.</p><label for="restoreStudentGroup">المجموعة</label><select class="form-select" id="restoreStudentGroup" style="min-height:44px"><option value="">اختر مجموعة</option>${(this.groups || []).map(g=>`<option value="${e(g.id)}">${e(g.name)}</option>`).join('')}</select>`,`<button class="btn btn-primary" onclick="window.centrlyApp.confirmStudentRestore(this)">استعادة للمجموعة</button>`);
   }else this.showToast(error.message || 'تعذرت الاستعادة','error');
  }
 };
 app.confirmStudentRestore=async function(button){
  const group_id=document.getElementById('restoreStudentGroup')?.value;if(!group_id){this.showToast('اختر المجموعة الحالية','error');return;}
  button.disabled=true;try{await request('/students/'+encodeURIComponent(this._restoreStudentId)+'/restore',{method:'POST',body:{group_id}});this._restoreStudentId=null;this.showToast('تمت استعادة الطالب مع حفظ سجله','success');await this.loadRouteData('students');await this.openClassroomArchive('students');}catch(error){this.showToast(error.message,'error');if(button.isConnected)button.disabled=false;}
 };
 app.openStudentTransfer=function(id){
  const student=(this.students || []).find(row=>row.id===id);if(!student)return;
  const sourceIds=[...new Set([student.group_id,...(student.group_ids || [])].filter(Boolean))],groups=this.groups || [];
  if(!sourceIds.length){this.showToast('أضف الطالب لمجموعة أولًا','info');return;}
  this._studentTransfer=id;
  this.showModal('نقل الطالب مع حفظ تاريخه',`<form id="studentTransferForm" onsubmit="window.centrlyApp.saveStudentTransfer(event)"><p><strong>${e(student.name)}</strong></p><p>الحضور والدرجات والتحصيل السابق تفضل مسجلة عند مجموعتها الأصلية. مجموعات الطالب الأخرى لن تتغير.</p><label for="transferFrom">من المجموعة</label><select id="transferFrom" class="form-select" style="min-height:44px" required>${sourceIds.map(group=>`<option value="${e(group)}">${e(groups.find(g=>g.id===group)?.name || 'المجموعة الحالية')}</option>`).join('')}</select><label for="transferTo" style="display:block;margin-top:.75rem">إلى المجموعة</label><select id="transferTo" class="form-select" style="min-height:44px" required><option value="">اختر المجموعة الجديدة</option>${groups.map(g=>`<option value="${e(g.id)}">${e(g.name)}</option>`).join('')}</select></form>`,`<button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button><button type="submit" form="studentTransferForm" class="btn btn-primary">تأكيد النقل</button>`);
 };
 app.saveStudentTransfer=async function(event){
  event.preventDefault();const id=this._studentTransfer,from=document.getElementById('transferFrom')?.value,to=document.getElementById('transferTo')?.value;
  if(!id || !from || !to || from===to){this.showToast('اختر مجموعتين مختلفتين','error');return;}
  const button=event.submitter;if(button)button.disabled=true;
  try{await request('/students/'+encodeURIComponent(id)+'/transfer',{method:'POST',body:{from_group_id:from,group_id:to}});this._studentTransfer=null;this.closeModal();this.showToast('تم نقل الطالب مع حفظ تاريخه','success');await this.loadRouteData('students');}
  catch(error){this.showToast(error.message || 'تعذر نقل الطالب','error');if(button?.isConnected)button.disabled=false;}
 };
 app.openStudentClassroomHistory=async function(id){
  this.showModal('سجل الطالب','<p role="status">جار تحميل السجل…</p>');
  try{const result=await request('/students/'+encodeURIComponent(id)+'/history');this.showModal('سجل الأرشفة والنقل',`<div style="display:grid;gap:.75rem">${(result.result || []).map(row=>`<article style="border-bottom:1px solid var(--centrly-border,#dce3ec);padding:.75rem"><strong>${e(({archive_student:'أرشفة الطالب',restore_student:'استعادة الطالب',transfer_student:'تغيير المجموعة'})[row.action] || 'تحديث السجل')}</strong><p>${e(row.detail?.after?.from_group_name || row.detail?.before?.group_name || '')} ${row.detail?.after?.group_name?'← '+e(row.detail.after.group_name):''}</p><small>${e(new Date(row.created_at).toLocaleString('ar-EG'))}</small></article>`).join('') || '<p>لا توجد عمليات أرشفة أو نقل مسجلة بعد.</p>'}</div>`);}catch(error){this.showModal('تعذر تحميل السجل',`<p role="alert">${e(error.message)}</p>`);}
 };
}
