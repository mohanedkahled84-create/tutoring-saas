import {request} from '../services/api.js?v=9.46.0';
import {authService} from '../services/auth.js?v=9.46.0';
import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.46.0';
import {mountPhoneVerification} from './PhoneVerification.js?v=9.46.0';
const receiptToken=()=>btoa(String.fromCharCode(...crypto.getRandomValues(new Uint8Array(32)))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
const identity=app=>app.user?.id+':'+app.user?.tenant_id;
export function renderAccountDeletion(user={}){
 if(window.centrlyApp?.delegation || user.assistant_id || !['owner','teacher','center_owner'].includes(user.role))return '';
 return `<section class="card account-danger-zone"><h2 style="font-size:1.15rem">بيانات الحساب وحذفه</h2><p style="line-height:1.8">حمّل نسخة من بياناتك، أو احذف حسابك ومساحة العمل نهائيًا. حذف الحساب يمسح بيانات الطلاب والمجموعات والمحتوى ويفصل حسابات فريقك.</p><div style="display:flex;gap:.75rem;flex-wrap:wrap"><button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.exportAccountData(this)">تنزيل نسخة من بياناتي</button><button type="button" class="btn btn-secondary" style="min-height:44px;background:#b42332;color:white;border-color:#b42332" onclick="window.centrlyApp.openAccountDeletion()">حذف الحساب</button></div></section>`;
}
export function registerAccountDeletion(app){
 app.exportAccountData=async function(button){if(button)button.disabled=true;const owner=identity(this);try{const data=await request('/account-deletion/export');if(identity(this)!==owner)return;const url=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json;charset=utf-8'})),a=document.createElement('a');a.href=url;a.download='centerly-account-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);this.showToast('تم تجهيز نسخة بياناتك للتنزيل','success');}catch(error){if(identity(this)===owner)this.showToast(error.message,'error');}finally{if(button?.isConnected)button.disabled=false;}};
 app.openAccountDeletion=async function(){
  const owner=identity(this);if(this.delegation)return;this._stopDeletionVerification?.();this._deletionIntent=null;
  this.showModal('حذف الحساب نهائيًا','<p role="status">جار تجهيز تأكيد صاحب الحساب…</p>');
  try{
   const info=await request('/account-deletion/start',{method:'POST',body:{}});if(identity(this)!==owner || window.centrlyApp!==this)return;
   this._deletionIntent={id:info.id};
   this.showModal('تأكيد صاحب الحساب',`<div style="display:grid;gap:1rem"><p>أنت بصدد حذف حساب <strong>${e(info.name)}</strong> وكل بيانات مساحة العمل. لا يمكن التراجع بعد التأكيد النهائي.</p><p>النسخة القابلة للتنزيل تشمل السجلات والبيانات. حمّل أيضًا أي ملفات دراسية تحتاجها من صفحات المحتوى قبل الاستمرار.</p><button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.exportAccountData(this)">تنزيل نسخة من بياناتي</button><div id="accountDeletionPhone"></div></div>`);
   this._stopDeletionVerification=mountPhoneVerification(document.getElementById('accountDeletionPhone'),{info,requestCode:body=>request('/account-deletion/'+info.id+'/request',{method:'POST',body}),requestChallenge:()=>request('/account-deletion/'+info.id+'/challenge',{method:'POST',body:{}}),verifyCode:body=>request('/account-deletion/'+info.id+'/verify',{method:'POST',body}),onVerified:result=>{if(identity(this)!==owner || window.centrlyApp!==this)return;this._stopDeletionVerification?.();this._stopDeletionVerification=null;this._deletionIntent={id:info.id,token:result.deletion_token};this.showModal('آخر خطوة قبل حذف الحساب',`<form id="accountDeletionConfirmForm" onsubmit="window.centrlyApp.confirmAccountDeletion(event)" style="display:grid;gap:1rem"><p>تم تأكيد رقمك. تأكيد الحذف يوقف حسابك وحسابات فريقك، ثم يحذف بيانات الطلاب والمجموعات والتسليمات والمحتوى والملفات المحفوظة في سنترلي.</p><p>لن تستطيع استرجاع البيانات بعد تأكيد هذه الخطوة.</p><label style="display:flex;gap:.6rem;align-items:center;min-height:44px"><input id="accountDeletionDataSaved" type="checkbox" required>احتفظت بالبيانات والملفات التي أحتاجها، أو لا أحتاج نسخة</label><label>اكتب «حذف الحساب» للتأكيد<input class="form-input" id="accountDeletionPhrase" type="text" autocomplete="off" required style="min-height:44px"></label><p id="accountDeletionError" role="alert" style="color:#b42332"></p></form>`,'<button type="submit" form="accountDeletionConfirmForm" class="btn btn-primary" style="min-height:44px;background:#b42332">تأكيد الحذف النهائي</button>');}});
  }catch(error){if(identity(this)===owner)this.showModal('تعذر بدء حذف الحساب',`<p role="alert">${e(error.message)}</p>`);}
 };
 app.confirmAccountDeletion=async function(event){
  event.preventDefault();const control=event.submitter,intent=this._deletionIntent,owner=identity(this),errorNode=document.getElementById('accountDeletionError');errorNode.textContent='';
  if(document.getElementById('accountDeletionPhrase').value.trim()!=='حذف الحساب'){errorNode.textContent='اكتب حذف الحساب كما هي لتأكيد قرارك';return;}
  if(!document.getElementById('accountDeletionDataSaved').checked)return;intent.receipt ||= receiptToken();control.disabled=true;
  try{
   const result=await request('/account-deletion/'+intent.id+'/confirm',{method:'POST',body:{deletion_token:intent.token,receipt_token:intent.receipt,confirmation:'حذف الحساب',data_saved_ack:true}});if(identity(this)!==owner || window.centrlyApp!==this)return;
   this.showAccountDeletionReceipt(result.receipt_token);
  }catch(error){
   // The server may have committed before the response was lost. The stable
   // receipt lets us check that outcome without repeating a destructive action.
   try{const status=await request('/account-deletion/status',{method:'POST',body:{receipt_token:intent.receipt}});if(['processing','done'].includes(status.status) && (identity(this)===owner || !this.user) && window.centrlyApp===this){this.showAccountDeletionReceipt(intent.receipt);return;}}catch{}
   if(identity(this)===owner && errorNode.isConnected)errorNode.textContent=error.message;if(control.isConnected)control.disabled=false;
  }
 };
 app.showAccountDeletionReceipt=function(receipt){
   this.closeModal();this.stopWhatsAppStatusPolling?.();this._stopDeletionVerification?.();this.resetTenantState();authService.clearSession();this.user=null;this._deletionIntent=null;this._deletionReceipt=receipt;this.currentRoute='account-deleted';
   const host=this.getAppEl?.() || document.getElementById('app');host.innerHTML='<main dir="rtl" style="max-width:560px;margin:8vh auto;padding:1.5rem"><section class="card" style="display:grid;gap:1rem"><h1 style="font-size:1.5rem">تم تأكيد طلب حذف الحساب</h1><p>تم إيقاف الوصول للحساب. حذف البيانات والملفات قيد التنفيذ، ويمكنك إغلاق هذه الصفحة.</p><p id="accountDeletionReceiptStatus" role="status"></p><button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.checkAccountDeletionStatus()">التحقق من اكتمال الحذف</button><a class="btn btn-secondary" style="min-height:44px" href="/">العودة للرئيسية</a></section></main>';
 };
 app.checkAccountDeletionStatus=async function(){const host=document.getElementById('accountDeletionReceiptStatus');if(!host || !this._deletionReceipt)return;try{const data=await request('/account-deletion/status',{method:'POST',body:{receipt_token:this._deletionReceipt}});if(host.isConnected)host.textContent=data.status==='done'?'اكتمل حذف الحساب والبيانات والملفات.':'طلب الحذف قيد التنفيذ. يمكنك إغلاق الصفحة.';}catch(error){if(host.isConnected)host.textContent=error.message;}};
}
