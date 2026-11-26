import {localize as t} from '../utils/language.js?v=9.99.6';
import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.99.6';
import {request} from '../services/api.js?v=9.99.6';
const states=()=>({open:t('مفتوح','Open'),in_progress:t('قيد المتابعة','In progress'),waiting_user:t('بانتظار ردك','Waiting for your reply'),resolved:t('تم الحل','Resolved')});
const categories=()=>({account:t('الحساب والدخول','Account and sign-in'),attendance:t('الحضور والحصص','Attendance and classes'),homework:t('الواجبات والمحتوى','Homework and materials'),messages:t('الرسائل والإعلانات','Messages and announcements'),subscription:t('الاشتراك','Subscription'),other:t('استفسار آخر','Other question')});
const stamp=value=>new Date(value).toLocaleString(t('ar-EG','en-GB'),{timeZone:'Africa/Cairo',dateStyle:'medium',timeStyle:'short'});
export function renderSupportView(data={},user={}){
 if(data.error)return `<section class="card"><p role="alert">${e(data.error)}</p><button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.loadRouteData(window.centrlyApp.currentRoute)">${t('إعادة تحميل الطلبات','Reload requests')}</button></section>`;
 if(!Array.isArray(data.tickets))return `<section class="card" role="status" aria-label="${t('جار تحميل طلبات الدعم','Loading support requests')}" aria-busy="true"><div class="skeleton-box" style="height:30px;width:40%;margin-bottom:1rem"></div><div class="skeleton-box" style="height:120px"></div></section>`;
 const admin=user.role==='admin',phone=/^\d{10,15}$/.test(data.contact_phone || '')?data.contact_phone:null;
 const text=encodeURIComponent(`مرحبًا، أحتاج مساعدة في سنترلي. اسم الحساب: ${user.full_name || user.name || ''}، رقم التواصل: ${user.phone || ''}`);
 return `<div dir="${t('rtl','ltr')}" style="display:grid;gap:1rem"><section class="card" style="margin:0"><h1 style="font-size:1.5rem">${admin?t('طلبات دعم المشتركين','Subscriber support requests'):t('تواصل مع دعم سنترلي','Contact Centerly support')}</h1><p>${admin?t('راجع الطلب والردود ورقم المدرس من مكان واحد.','Review requests, replies, and contact details in one place.'):t('اختَر واتساب للتواصل المباشر، أو اكتب طلبًا هنا وتابع رد فريق الدعم.','Contact us on WhatsApp or submit a request and follow the support team’s reply.')}</p><div style="display:flex;gap:.75rem;flex-wrap:wrap">${!admin && phone?`<a class="btn btn-secondary" style="min-height:44px" href="https://wa.me/${phone}?text=${text}" target="_blank" rel="noopener noreferrer">${t('التواصل عبر واتساب','Contact via WhatsApp')}</a>`:''}${!admin?`<button class="btn btn-primary" style="min-height:44px" onclick="window.centrlyApp.openSupportRequest()">${t('طلب مساعدة جديد','New support request')}</button>`:''}<button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.loadRouteData(window.centrlyApp.currentRoute)">${t('تحديث الطلبات','Refresh requests')}</button></div></section><section class="card" style="margin:0"><h2 style="font-size:1.15rem">${admin?t('آخر طلبات المشتركين','Recent subscriber requests'):t('طلباتي','My requests')}</h2><p>${t('آخر ١٠٠ طلب، حسب أحدث متابعة.','Latest 100 requests, ordered by most recent update.')}</p><div style="display:grid;gap:.75rem">${(data.tickets || []).map(row=>`<article style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;border-top:1px solid var(--centrly-line);padding:.75rem 0;min-width:0"><div style="min-width:0;overflow-wrap:anywhere"><h3 style="font-size:1rem">${e(row.title)}</h3><p>${e(states()[row.status] || row.status)} · ${e(categories()[row.category] || '')}</p>${admin?`<p>${e(row.teacher_name)} · <bdi>${e(row.teacher_phone || t('رقم التواصل غير مسجل','No contact number'))}</bdi></p>`:''}<small>${e(stamp(row.updated_at))}</small>${row.latest_admin_reply?`<div role="status" style="margin-top:.6rem;padding:.65rem;border-radius:8px;background:#eff6ff;color:#1e3a8a;white-space:pre-wrap;overflow-wrap:anywhere"><strong>${t('رد فريق الدعم:','Support reply:')}</strong> ${e(row.latest_admin_reply.body)}</div>`:''}</div><button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.openSupportTicket('${e(row.id)}')">${t('فتح الطلب','Open request')}</button></article>`).join('') || `<p>${t('لا توجد طلبات دعم بعد.','No support requests yet.')}</p>`}</div></section></div>`;
}
export function registerSupportActions(app){
 app.supportPickImage=function(input){
  const file=input?.files?.[0],box=document.getElementById('supportImageBox'),preview=document.getElementById('supportImagePreview'),thumb=document.getElementById('supportImageThumb'),nameEl=document.getElementById('supportImageName'),state=document.getElementById('supportImageState');
  if(!file){this.supportClearImage();return;}
  if(nameEl)nameEl.textContent=file.name;
  if(box)box.hidden=true;
  if(preview)preview.hidden=false;
  if(state)state.textContent='';
  if(thumb && typeof FileReader==='function'){const reader=new FileReader();reader.onload=()=>{if(input.files?.[0]===file)thumb.src=reader.result;};reader.readAsDataURL(file);}
 };
 app.supportClearImage=function(){
  const input=document.getElementById('supportImage'),box=document.getElementById('supportImageBox'),preview=document.getElementById('supportImagePreview'),thumb=document.getElementById('supportImageThumb'),nameEl=document.getElementById('supportImageName'),state=document.getElementById('supportImageState');
  if(input)input.value='';
  if(thumb)thumb.removeAttribute('src');
  if(nameEl)nameEl.textContent='';
  if(preview)preview.hidden=true;
  if(box)box.hidden=false;
  if(state)state.textContent='';
 };
 app.openSupportRequest=function(){
  this._supportRequestId=crypto.randomUUID();
  this.showModal(t('طلب مساعدة جديد','New support request'),`<form id="supportRequestForm" onsubmit="window.centrlyApp.saveSupportRequest(event)" style="display:grid;gap:1rem"><label>${t('عنوان مختصر','Short title')}<input id="supportTitle" class="form-input" required maxlength="160"></label><label>${t('التصنيف','Category')}<select class="form-select" id="supportCategory" style="min-height:44px">${Object.entries(categories()).map(([key,title])=>`<option value="${key}">${title}</option>`).join('')}</select></label><label>${t('تفاصيل الطلب','Request details')}<textarea class="form-input" id="supportBody" rows="5" required maxlength="4000" placeholder="${t('اشرح ما حدث والجزء الذي تحتاج مساعدة فيه','Describe what happened and where you need help')}"></textarea></label><div><p>${t('صورة المشكلة (اختياري)','Screenshot (optional)')}</p><label id="supportImageBox" class="receipt-upload"><input id="supportImage" type="file" accept="image/png,image/jpeg,image/webp" aria-describedby="supportImageState" onchange="window.centrlyApp.supportPickImage(this)"><span aria-hidden="true">＋</span><strong>${t('اختيار صورة','Choose an image')}</strong></label><div id="supportImagePreview" class="receipt-preview" hidden><div class="receipt-preview-meta"><img id="supportImageThumb" class="receipt-preview-thumb" alt="${t('معاينة الصورة','Image preview')}"><span id="supportImageName" class="receipt-preview-name"></span></div><button type="button" class="receipt-remove" aria-label="${t('إزالة الصورة','Remove image')}" title="${t('إزالة الصورة','Remove image')}" onclick="window.centrlyApp.supportClearImage()">✕</button></div><p id="supportImageState" role="status"></p></div><p>${t('لا تكتب كلمات مرور أو أكواد تحقق. سيرى فريق الدعم اسم حسابك ورقم التواصل المسجل للرد عليك.','Do not include passwords or verification codes. Support can see your account name and registered contact number to reply.')}</p></form>`,`<button type="submit" form="supportRequestForm" class="btn btn-primary" style="min-height:44px">${t('تسجيل الطلب','Submit request')}</button>`);

 };
 app.saveSupportRequest=async function(event){
  event.preventDefault();const control=event.submitter;control.disabled=true;
  try{
   const form=event.currentTarget;
   const file=form.querySelector('#supportImage').files[0];
   const image=file && await new Promise((resolve,reject)=>{
    if(file.size>2*1024*1024){reject(new Error(t('حجم الصورة لازم يكون ٢ ميجابايت أو أقل','Image must be 2 MB or smaller')));return;}
    const reader=new FileReader();
    reader.onload=()=>resolve(reader.result);
    reader.onerror=()=>reject(new Error(t('تعذر قراءة الصورة','Could not read the image')));
    reader.readAsDataURL(file);
   });
   if(window.centrlyApp!==this)return;
   const result=await request('/support',{method:'POST',body:{id:this._supportRequestId,title:document.getElementById('supportTitle').value.trim(),category:document.getElementById('supportCategory').value,body:form.querySelector('#supportBody').value.trim(),...(image?{image}:{})}});this._supportRequestId=null;await this.loadRouteData(this.currentRoute);await this.openSupportTicket(result.ticket.id);this.showToast(t('تم تسجيل طلبك','Request submitted'),'success');}catch(error){this.showToast(error.message,'error');if(control.isConnected)control.disabled=false;}
 };
 app.openSupportTicket=async function(id){
  const actor=this.user?.id;
  this.showModal(t('طلب الدعم','Support request'),`<div role="status" aria-busy="true" aria-label="${t('جار تحميل الطلب','Loading request')}" class="skeleton-box" style="height:150px"></div>`);
  try{
   const data=await request('/support/'+encodeURIComponent(id));if(this.user?.id!==actor || window.centrlyApp!==this)return;const ticket=data.ticket,admin=this.user?.role==='admin';this._supportTicketId=id;this._supportReplyId=crypto.randomUUID();
   this.showModal(e(ticket.title),`<div style="display:grid;gap:1rem"><p>${e(states()[ticket.status])} · ${e(categories()[ticket.category])}</p>${admin?`<p>${t('المدرس:','Teacher:')} ${e(ticket.teacher_name)} · <bdi>${e(ticket.teacher_phone || t('غير مسجل','Not recorded'))}</bdi></p><label>${t('حالة الطلب','Request status')}<select class="form-select" style="min-height:44px" onchange="window.centrlyApp.changeSupportStatus(this.value)">${Object.entries(states()).map(([key,label])=>`<option value="${key}" ${ticket.status===key?'selected':''}>${label}</option>`).join('')}</select></label>`:''}<article style="white-space:pre-wrap;overflow-wrap:anywhere;border:1px solid var(--centrly-line);border-radius:12px;padding:1rem"><strong>${t('تفاصيل الطلب','Request details')}</strong><p>${e(ticket.body)}</p> ${typeof ticket.image==='string' && /^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(ticket.image)?`<img alt="${t('صورة مشكلة الدعم المرفقة','Attached screenshot')}" style="display:block;max-width:100%;height:auto;border-radius:8px" src="${e(ticket.image)}">`:''}<small>${e(stamp(ticket.created_at))}</small></article><section aria-label="${t('ردود الطلب','Request replies')}" style="display:grid;gap:.75rem">${data.replies.map(row=>`<article style="border:1px solid var(--centrly-line);border-radius:12px;padding:.75rem;overflow-wrap:anywhere"><strong>${row.author_role==='admin'?t('فريق دعم سنترلي','Centerly support'):t('رد المدرس','Teacher reply')}</strong><p style="white-space:pre-wrap;line-height:1.8">${e(row.body)}</p><small>${e(stamp(row.created_at))}</small></article>`).join('') || `<p>${t('سيظهر رد فريق الدعم هنا.','The support reply will appear here.')}</p>`}</section><form id="supportReplyForm" onsubmit="window.centrlyApp.replySupportTicket(event)"><label for="supportReplyBody">${t('أضف ردًا','Add a reply')}</label><textarea id="supportReplyBody" class="form-input" maxlength="4000" rows="3" required></textarea><button class="btn btn-primary" style="min-height:44px;margin-top:.75rem" type="submit">${t('حفظ الرد','Save reply')}</button></form></div>`);
  }catch(error){this.showModal(t('تعذر تحميل طلب الدعم','Could not load support request'),`<p role="alert">${e(error.message)}</p>`);}
 };
 app.replySupportTicket=async function(event){
  event.preventDefault();const id=this._supportTicketId,button=event.submitter;button.disabled=true;
  try{await request('/support/'+encodeURIComponent(id)+'/reply',{method:'POST',body:{request_id:this._supportReplyId,body:document.getElementById('supportReplyBody').value.trim()}});await this.loadRouteData(this.currentRoute);await this.openSupportTicket(id);}catch(error){this.showToast(error.message,'error');if(button.isConnected)button.disabled=false;}
 };
 app.changeSupportStatus=async function(status){const id=this._supportTicketId;try{await request('/support/'+encodeURIComponent(id)+'/status',{method:'POST',body:{status}});await this.loadRouteData(this.currentRoute);this.showToast(t('تم تحديث حالة الطلب','Request status updated'),'success');}catch(error){this.showToast(error.message,'error');await this.openSupportTicket(id);}};
}
