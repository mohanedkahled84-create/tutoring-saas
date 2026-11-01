import {escapeHtml as e} from '../utils/escapeHtml.js';
import {request as ownerRequest} from '../services/api.js';

export const collectionMethods=[['cash','نقدي'],['instapay','إنستاباي'],['vodafone_cash','فودافون كاش'],['bank_transfer','تحويل بنكي'],['other','أخرى']];
const money=v=>`${Number(v).toLocaleString('ar-EG',{maximumFractionDigits:2})} ج.م`;
const time=v=>{try{return new Intl.DateTimeFormat('ar-EG',{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'}).format(new Date(v));}catch{return '—';}};
const style='min-height:44px;max-width:100%;padding:.65rem;border:1px solid #cbd5e1;border-radius:10px;font:inherit';
export function renderCollectionRows(rows=[],allowVoid=false){
 return rows.map(r=>`<article style="border:1px solid #dce3ec;border-radius:12px;padding:1rem;margin-bottom:.75rem;overflow-wrap:anywhere"><div style="display:flex;justify-content:space-between;gap:.5rem;flex-wrap:wrap"><strong>${e(r.student_name)}</strong><strong>${e(money(r.amount))}</strong></div><p style="margin:.4rem 0">${e(r.group_name || '')} · ${e(collectionMethods.find(([key])=>key===r.payment_method)?.[1] || 'أخرى')}</p><small>${e(time(r.collected_at))} · سجّلها ${e(r.actor_name)}</small>${r.note?`<p>${e(r.note)}</p>`:''}${r.status==='void'?`<p style="color:#a82532">ملغاة · ${e(r.void_reason)}<br><small>${e(r.voided_by_name || 'المدرس')} · ${e(time(r.voided_at))}</small></p>`:allowVoid?`<div style="margin-top:.75rem"><button style="${style}" data-void="${e(r.id)}">إلغاء التحصيل</button></div>`:''}<small style="display:block;color:#5b6b81">رقم العملية: <bdi>${e(r.id)}</bdi></small></article>`).join('') || '<p style="padding:1rem">لا توجد عمليات تحصيل في الفترة المحددة.</p>';
}

// Shared mobile-first ledger; API and authority are supplied by the owning surface.
export function mountCollectionLedger(host,{request,groups=[],allowCreate=false,allowVoid=false,onFailure=()=>{}}){
 let generation=0,state={page:1},data={},editor;
 const params=()=>new URLSearchParams(Object.entries(state).filter(([,v])=>v!=='' && v!==undefined));
 const fail=(error,target)=>{if(target?.isConnected)target.textContent=error.message || 'تعذر إتمام العملية';onFailure(error);};
 async function load(){
  const version=++generation;
  host.innerHTML='<p role="status">تحميل سجل التحصيل…</p>';
  try{const next=await request(`?${params()}`);if(version!==generation || !host.isConnected)return;data=next;state.from=next.from;state.to=next.to;render();}
  catch(error){if(version!==generation || !host.isConnected)return;host.innerHTML='<p role="alert" data-error></p><button data-retry>حاول مجددًا</button>';fail(error,host.querySelector('[data-error]'));host.querySelector('[data-retry]').onclick=load;}
 }
 function render(){
  host.innerHTML=`<p>المبالغ المسجلة هنا تحصيل فعلي. قيمة الحضور وحدها لا تُسجل كدفع.</p><div style="display:flex;justify-content:space-between;gap:.75rem;flex-wrap:wrap;align-items:center;margin-bottom:1rem"><strong>صافي التحصيل في الفترة: ${e(money(data.total_amount || 0))}</strong>${allowCreate?`<button data-add style="${style}">تسجيل تحصيل</button>`:''}</div><form data-filters style="display:flex;align-items:end;flex-wrap:wrap;gap:.65rem;margin-bottom:1rem"><label>المجموعة<select name="group_id" style="${style};display:block;width:100%"><option value="">كل المجموعات المسموحة</option>${groups.map(g=>`<option value="${e(g.id)}" ${g.id===state.group_id?'selected':''}>${e(g.name)}</option>`).join('')}</select></label><label>من<input name="from" type="date" value="${e(state.from)}" required style="${style};display:block"></label><label>إلى<input name="to" type="date" value="${e(state.to)}" required style="${style};display:block"></label><button style="${style}" type="submit">عرض</button></form><div data-records>${renderCollectionRows(data.rows,allowVoid)}</div><div style="display:flex;justify-content:space-between;align-items:center;gap:.6rem"><button data-previous style="${style}" ${state.page<=1?'disabled':''}>الأحدث</button><span>صفحة ${state.page.toLocaleString('ar-EG')}</span><button data-next style="${style}" ${!data.has_more?'disabled':''}>الأقدم</button></div><p data-error role="alert"></p>`;
  host.querySelector('[data-filters]').onsubmit=event=>{event.preventDefault();state={...Object.fromEntries(new FormData(event.currentTarget)),page:1};load();};
  host.querySelector('[data-previous]').onclick=()=>{state.page--;load();};host.querySelector('[data-next]').onclick=()=>{state.page++;load();};
  host.querySelector('[data-add]')?.addEventListener('click',openCreate);
  host.querySelectorAll('[data-void]').forEach(button=>button.onclick=()=>openVoid(data.rows.find(r=>r.id===button.dataset.void)));
 }
 function openEditor(title,body){
  editor?.remove();editor=document.createElement('dialog');editor.setAttribute('aria-label',title);editor.style.cssText='max-width:min(560px,calc(100vw - 24px));width:560px;max-height:90dvh;overflow-y:auto;border:1px solid #dce3ec;border-radius:16px;padding:1.25rem;color:#152a50';
  editor.innerHTML=`<form><h2>${e(title)}</h2>${body}<p data-error role="alert" style="color:#a82532"></p><div data-review></div><div style="display:flex;gap:.65rem;flex-wrap:wrap;margin-top:1rem"><button type="submit" style="${style}" data-save>مراجعة العملية</button><button type="button" data-cancel style="${style}">رجوع</button></div></form>`;
  host.append(editor);editor.querySelector('[data-cancel]').onclick=()=>{editor.close();editor.remove();};editor.addEventListener('close',()=>editor.remove(),{once:true});editor.showModal();return editor;
 }
 function confirmForm(modal,prepare,summary,save){
  const form=modal.querySelector('form'),button=form.querySelector('[data-save]');let prepared,busy=false;
  form.onsubmit=async event=>{
   event.preventDefault();if(busy)return;
   if(!prepared){try{prepared=prepare(new FormData(form));form.querySelector('[data-review]').innerHTML=`<p style="padding:1rem;background:#f1f5f9;border-radius:10px">${e(summary(prepared))}</p><button type="button" data-correct style="${style}">تعديل البيانات</button>`;form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=true);button.textContent='تأكيد العملية';form.querySelector('[data-correct]').onclick=()=>{prepared=null;form.querySelectorAll('input,select,textarea').forEach(el=>el.disabled=false);form.querySelector('[data-review]').innerHTML='';button.textContent='مراجعة العملية';};}catch(error){fail(error,form.querySelector('[data-error]'));}return;}
   busy=true;button.disabled=true;button.textContent='جارٍ الحفظ…';form.querySelector('[data-cancel]').disabled=true;form.querySelector('[data-correct]').disabled=true;
   const cancel=event=>event.preventDefault();modal.addEventListener('cancel',cancel);
   try{await save(prepared);modal.close();await load();}catch(error){fail(error,form.querySelector('[data-error]'));}
   finally{busy=false;button.disabled=false;button.textContent='تأكيد العملية';form.querySelector('[data-cancel]').disabled=false;form.querySelector('[data-correct]').disabled=false;modal.removeEventListener('cancel',cancel);}
  };
 }
 function openCreate(){
  const id=crypto.randomUUID();let choices=[],seq=0;
  const modal=openEditor('تسجيل تحصيل',`<label>المجموعة<select name="group_id" required style="${style};display:block;width:100%"><option value="">اختر المجموعة</option>${groups.map(g=>`<option value="${e(g.id)}">${e(g.name)}</option>`).join('')}</select></label><label style="display:block;margin-top:.7rem">بحث عن الطالب<input name="q" type="search" maxlength="100" style="${style};width:100%"></label><button type="button" data-search style="${style};margin:.5rem 0">بحث</button><label style="display:block">الطالب<select name="student_id" required style="${style};display:block;width:100%" disabled><option value="">اختر المجموعة أولًا</option></select></label><small>القائمة تعرض حتى ٥٠٠ نتيجة. ابحث بالاسم أو الكود للوصول للطالب.</small><label style="display:block;margin-top:.7rem">المبلغ المستلم (ج.م)<input name="amount" type="number" min="0.01" max="100000000" step="0.01" required inputmode="decimal" style="${style};display:block;width:100%"></label><label style="display:block;margin-top:.7rem">طريقة الدفع<select name="payment_method" style="${style};display:block;width:100%">${collectionMethods.map(([key,label])=>`<option value="${key}">${label}</option>`).join('')}</select></label><label style="display:block;margin-top:.7rem">ملاحظة<input name="note" maxlength="1000" style="${style};display:block;width:100%"></label>`);
  const form=modal.querySelector('form'),student=form.elements.student_id;
  const roster=async()=>{const group=form.elements.group_id.value;if(!group){student.innerHTML='<option value="">اختر المجموعة أولًا</option>';student.disabled=true;return;}const version=++seq;student.disabled=true;student.innerHTML='<option value="">تحميل الطلاب…</option>';try{const next=await request(`?${new URLSearchParams({group_id:group,q:form.elements.q.value})}`);if(version!==seq || !modal.isConnected)return;choices=next.students || [];student.innerHTML='<option value="">اختر الطالب</option>'+choices.map(s=>`<option value="${e(s.id)}">${e(s.name)}</option>`).join('');student.disabled=false;}catch(error){fail(error,form.querySelector('[data-error]'));}};
  form.elements.group_id.onchange=roster;form.querySelector('[data-search]').onclick=roster;
  confirmForm(modal,values=>{if(student.disabled || !values.get('student_id'))throw new Error('اختر طالبًا من المجموعة');return {group_id:values.get('group_id'),student_id:values.get('student_id'),amount:Number(values.get('amount')),payment_method:values.get('payment_method'),note:values.get('note'),request_id:id};},body=>`تسجيل ${money(body.amount)} للطالب ${choices.find(s=>s.id===body.student_id)?.name || ''} · ${groups.find(g=>g.id===body.group_id)?.name || ''} · ${collectionMethods.find(([k])=>k===body.payment_method)?.[1] || ''}`,body=>request('',body));
 }
 function openVoid(row){
  const modal=openEditor('إلغاء التحصيل',`<p>${e(row.student_name)} · ${e(money(row.amount))}</p><p>تظل العملية ظاهرة كملغاة، ويُستبعد مبلغها من صافي التحصيل. لتصحيح المبلغ سجّل عملية جديدة بعد الإلغاء.</p><label>سبب الإلغاء<textarea name="reason" minlength="3" maxlength="1000" required style="${style};display:block;width:100%"></textarea></label>`);
  confirmForm(modal,values=>({reason:values.get('reason')}),()=>`تأكيد إلغاء ${money(row.amount)} للطالب ${row.student_name}`,body=>request(`/${row.id}/void`,body));
 }
 load();return ()=>{generation++;editor?.close();editor?.remove();};
}

export function registerCollectionOwnerActions(app){
 app.openCollectionLedger=function(){
  if(this.hasSecurityPin && !this.isFinancialUnlocked){this.promptUnlockFinancials();return;}
  if(this.hideFinancialNumbers){this.showToast('أظهر الأرقام المالية لفتح سجل التحصيل','info');return;}
  this.showModal('سجل التحصيل الفعلي','<div data-assistant-pay id="collection-ledger"></div>','<button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>');
  mountCollectionLedger(document.getElementById('collection-ledger'),{groups:this.groups || [],allowCreate:true,allowVoid:true,request:(suffix,body)=>ownerRequest(`/assistants/collections${suffix}`,body===undefined?{}:{method:'POST',body,signal:AbortSignal.timeout(15000)})});
 };
}
