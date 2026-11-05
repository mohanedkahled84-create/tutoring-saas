import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.44.0';
import {request} from '../services/api.js?v=9.44.0';

export const materialTargets = row => Array.isArray(row.group_ids) ? row.group_ids : row.group_id ? [row.group_id] : null;
export const materialInGroup = (row,id) => materialTargets(row)===null || materialTargets(row).includes(id);
export function materialGroupLabel(row,groups=[]) {
  const ids=materialTargets(row);
  return ids===null ? 'جميع المجموعات' : ids.map(id=>groups.find(g=>g.id===id)?.name || 'مجموعة').join('، ');
}

export function renderMaterialGroupPicker(prefix,groups=[],selected=null) {
  const restricted=typeof window!=='undefined' && window.centrlyApp?.delegation && !window.centrlyApp.delegation.all_groups;
  if(restricted && selected===null)selected=groups.map(g=>g.id);
  const all=selected===null,ids=new Set(selected || []);
  return `<fieldset id="${prefix}" class="material-group-picker">
    <legend>المجموعات المستهدفة</legend>
    <details onkeydown="if(event.key==='Escape'){this.open=false;this.querySelector('summary').focus()}">
      <summary><span data-target-summary aria-live="polite">${all?'كل المجموعات':`تم اختيار ${ids.size} مجموعة`}</span><span aria-hidden="true">⌄</span></summary>
      <div class="material-group-panel">
        <label for="${prefix}Search">ابحث عن مجموعة</label>
        <input id="${prefix}Search" type="search" class="form-input" placeholder="اسم المجموعة" oninput="window.centrlyApp.updateMaterialGroupPicker('${prefix}')">
        <div class="material-group-options" data-target-list>
        ${groups.map(g=>`<label data-target-row><input type="checkbox" data-target-group value="${e(g.id)}" ${ids.has(g.id)?'checked':''} onchange="window.centrlyApp.updateMaterialGroupPicker('${prefix}',this)"><span>${e(g.name)}</span></label>`).join('') || '<p>أضف مجموعة من صفحة مجاميعي الدراسية أولًا.</p>'}
        <p data-target-empty hidden>مفيش مجموعات مطابقة للبحث.</p></div>
        <label class="material-group-all" ${restricted?'hidden':''}><input type="checkbox" data-target-all ${all?'checked':''} ${restricted?'disabled':''} onchange="window.centrlyApp.updateMaterialGroupPicker('${prefix}',this)"><span>كل المجموعات<small>يشمل مجموعات السنة الحالية والمضافة لاحقًا</small></span></label>
      </div>
    </details>
  </fieldset>`;
}

export function readMaterialGroupPicker(prefix) {
  const root=document.getElementById(prefix);
  if(!root)throw new Error('تعذر قراءة المجموعات، افتح النموذج مجددًا');
  if(root.querySelector('[data-target-all]').checked)return {group_id:null,group_ids:null};
  const ids=[...root.querySelectorAll('[data-target-group]:checked')].map(node=>node.value);
  if(!ids.length)throw new Error('اختر مجموعة واحدة على الأقل أو فعّل كل المجموعات');
  return {group_id:ids[0],group_ids:ids};
}

export function registerMaterialGroupPicker(app) {
  app.openHomeworkDeadline=function(id){
    const row=[...(this.materials || []),...(this.homeworkState?.assignments || [])].find(m=>m.id===id);if(!row)return;this._homeworkDeadlineId=id;
    this.showModal('موعد وسياسة التسليم',`<form id="homeworkDeadlineForm" onsubmit="window.centrlyApp.saveHomeworkDeadline(event)" style="display:grid;gap:1rem"><p>${e(row.title)}</p><label>آخر موعد<input id="homeworkDeadlineDate" type="date" class="form-input" value="${e(row.due_date || '')}"></label><label>التسليم بعد الموعد<select class="form-select" id="homeworkDeadlineLate" style="min-height:44px"><option value="default" ${row.allow_late_submission==null?'selected':''}>حسب إعدادات الحساب</option><option value="allow" ${row.allow_late_submission===true?'selected':''}>قبول التسليم المتأخر</option><option value="close" ${row.allow_late_submission===false?'selected':''}>إغلاق التسليم بعد الموعد</option></select></label><p>وقت الإغلاق هو نهاية اليوم بتوقيت القاهرة. التسليمات السابقة تظل محفوظة.</p></form>`,`<button type="submit" form="homeworkDeadlineForm" class="btn btn-primary" style="min-height:44px">حفظ موعد وسياسة التسليم</button>`);
  };
  app.saveHomeworkDeadline=async function(event){
    event.preventDefault();const id=this._homeworkDeadlineId;if(!id)return;const button=event.submitter;button.disabled=true;const late=document.getElementById('homeworkDeadlineLate').value;
    try{await request('/materials/'+encodeURIComponent(id),{method:'PATCH',body:{due_date:document.getElementById('homeworkDeadlineDate').value || null,allow_late_submission:late==='default'?null:late==='allow'}});this._homeworkDeadlineId=null;this.closeModal();await this.loadRouteData('homework');this.showToast('تم حفظ الموعد وسياسة التسليم','success');}catch(error){this.showToast(error.message,'error');if(button.isConnected)button.disabled=false;}
  };
  app.openMaterialCopy=function(id){
    const row=[...(this.materials || []),...(this.homeworkState?.assignments || [])].find(m=>m.id===id);
    if(!row)return;
    this._materialCopyId=id;
    this._materialCopyRequestId=crypto.randomUUID();
    this.showModal('إعادة استخدام المحتوى',`<form id="materialCopyForm" onsubmit="window.centrlyApp.saveMaterialCopy(event)" style="display:grid;gap:1rem"><p>نسخة بتكليف مستقل للمجموعات الحالية، بدون رفع الملف ثانية. التسليمات والدرجات السابقة تظل مرتبطة بالأصل.</p><label>عنوان النسخة<input id="materialCopyTitle" class="form-input" value="${e(row.title)}" maxlength="250" required></label>${row.is_homework?'<label>موعد تسليم النسخة الجديدة<input id="materialCopyDue" type="date" class="form-input"></label>':''}${renderMaterialGroupPicker('materialCopyGroups',this.groups || [],[])}</form>`,`<button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button><button type="submit" form="materialCopyForm" class="btn btn-primary" style="min-height:44px">إنشاء النسخة</button>`);
  };
  app.saveMaterialCopy=async function(event){
    event.preventDefault();const id=this._materialCopyId;if(!id)return;
    let target;try{target=readMaterialGroupPicker('materialCopyGroups');}catch(error){this.showToast(error.message,'error');return;}
    const control=event.submitter;if(control)control.disabled=true;
    try{await request('/materials/'+encodeURIComponent(id)+'/copy',{method:'POST',body:{request_id:this._materialCopyRequestId,title:document.getElementById('materialCopyTitle').value.trim(),due_date:document.getElementById('materialCopyDue')?.value || null,...target}});this._materialCopyId=null;this.closeModal();this.showToast('تم إنشاء نسخة مستقلة بدون تكرار رفع الملف','success');await this.loadRouteData(this.currentRoute==='homework'?'homework':'materials');}
    catch(error){this.showToast(error.message || 'راجع قائمة المحتوى قبل إعادة المحاولة','error');if(control?.isConnected)control.disabled=false;}
  };
  app.openMaterialGroupAssignment=function(id){
    const row=[...(this.materials || []),...(this.homeworkState?.assignments || [])].find(m=>m.id===id);
    if(!row){this.showToast('أعد تحميل قائمة المحتوى ثم حاول مجددًا','error');return;}
    const current=materialTargets(row);
    if(current===null){this.showToast('المحتوى متاح بالفعل لجميع المجموعات الحالية والجديدة','info');return;}
    this._groupAssignmentMaterial={id:row.id,current:[...current]};
    const body=`<form id="materialGroupAssignmentForm" onsubmit="window.centrlyApp.saveMaterialGroupAssignment(event)"><p>${e(row.title)}</p><p>أضف مجموعات لنفس المحتوى بدون رفعه مرة ثانية. المجموعات الحالية وتسليمات الطلاب تفضل محفوظة، وموعد التسليم الحالي يسري على المجموعات المضافة.</p>${renderMaterialGroupPicker('materialReuseGroups',this.groups || [],current)}</form>`;
    this.showModal('إسناد المحتوى لمجموعات أخرى',body,`<button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button><button type="submit" form="materialGroupAssignmentForm" class="btn btn-primary">حفظ المجموعات</button>`);
  };
  app.saveMaterialGroupAssignment=async function(event){
    event.preventDefault();const saved=this._groupAssignmentMaterial;if(!saved)return;
    let target;try{target=readMaterialGroupPicker('materialReuseGroups');}catch(error){this.showToast(error.message,'error');return;}
    if(target.group_ids){target.group_ids=[...new Set([...saved.current,...target.group_ids])];target.group_id=target.group_ids[0];}
    const button=event.submitter;if(button)button.disabled=true;
    try{await request('/materials/'+encodeURIComponent(saved.id),{method:'PATCH',body:target});this._groupAssignmentMaterial=null;this.closeModal();this.showToast('تم إسناد المحتوى للمجموعات مع حفظ التسليمات السابقة','success');await this.loadRouteData(this.currentRoute==='homework'?'homework':'materials');}
    catch(error){this.showToast(error.message || 'تعذر حفظ المجموعات','error');if(button?.isConnected)button.disabled=false;}
  };
  app.updateMaterialGroupPicker=(prefix,changed)=>{
    const root=document.getElementById(prefix);if(!root)return;
    const allControl=root.querySelector('[data-target-all]');
    if(changed?.matches('[data-target-group]'))allControl.checked=false;
    if(changed===allControl && allControl.checked)for(const input of root.querySelectorAll('[data-target-group]'))input.checked=false;
    const all=allControl.checked,search=root.querySelector('input[type=search]').value.trim().toLocaleLowerCase('ar');
    let visible=0;
    for(const row of root.querySelectorAll('[data-target-row]')){
      row.hidden=!row.textContent.toLocaleLowerCase('ar').includes(search);
      if(!row.hidden)visible++;
    }
    root.querySelector('[data-target-empty]').hidden=visible>0;
    const chosen=[...root.querySelectorAll('[data-target-group]:checked')];
    root.querySelector('[data-target-summary]').textContent=all?'كل المجموعات':chosen.length?chosen.length===1?chosen[0].closest('label').textContent.trim():`تم اختيار ${chosen.length} مجموعات`:'اختار المجموعات';
  };
}
