import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.95.0';
import {portalRequest} from '../utils/portalSession.js?v=9.95.0';
const styles=`<style>
student-email-settings{display:block;min-width:0;margin-block:0 18px;font:inherit}
student-email-settings .se-banner{display:flex;align-items:center;justify-content:space-between;gap:20px;padding:20px 24px;border:1px solid #dbe5f5;border-radius:18px;background:linear-gradient(120deg,#f8fbff,#edf4ff);color:#152b55;box-sizing:border-box}
student-email-settings .se-copy{min-width:0}student-email-settings .se-copy strong{display:block;font-size:1rem;line-height:1.7}student-email-settings .se-copy p{margin:4px 0 0;line-height:1.8;color:#52627b;font-size:.9rem}
student-email-settings .se-btn{font:inherit;font-weight:700;display:inline-flex;align-items:center;justify-content:center;gap:9px;min-height:46px;padding:11px 20px;border:1px solid #213d6f;border-radius:12px;background:linear-gradient(135deg,#203e70,#112649);color:#fff;box-shadow:0 4px 10px #11264918;cursor:pointer;white-space:nowrap}
student-email-settings .se-btn:disabled{opacity:.6;cursor:wait}student-email-settings :is(button,input):focus-visible{outline:3px solid #3973db;outline-offset:3px}
student-email-settings .se-secondary{background:#fff;color:#203e70;border-color:#cbd5e1;box-shadow:none}
student-email-settings .se-verified{display:flex;align-items:center;gap:12px;justify-content:space-between;font-size:.85rem;color:#28513b;padding:10px 16px;background:#f0f8f3;border:1px solid #d8eadd;border-radius:12px}
student-email-settings .se-dialog{font:inherit;direction:rtl;color:#0f172a;background:#fff;border:1px solid #dbe3ef;border-radius:22px;box-shadow:0 24px 80px #0f172a30;padding:24px;width:min(460px,calc(100vw - 32px));max-height:85dvh;overflow:auto;box-sizing:border-box}
student-email-settings .se-dialog::backdrop{background:#0f172a80}student-email-settings .se-header{display:flex;gap:16px;align-items:center;justify-content:space-between;margin-bottom:18px}student-email-settings .se-header h2{font-size:1.2rem;margin:0}student-email-settings .se-close{font:inherit;width:44px;min-height:44px;border:1px solid #e2e8f0;border-radius:50%;background:#fff;cursor:pointer}
student-email-settings form{display:grid;gap:14px}student-email-settings input{font:inherit;display:block;width:100%;box-sizing:border-box;min-height:50px;padding:12px;margin-top:8px;border:1px solid #cbd5e1;border-radius:10px;background:#fff;color:#0f172a}student-email-settings [data-result]{line-height:1.8;overflow-wrap:anywhere}
@media(max-width:600px){student-email-settings .se-banner{align-items:stretch;flex-direction:column;gap:14px;padding:18px}student-email-settings .se-banner .se-btn{width:100%}}
</style>`;
if(globalThis.customElements && !customElements.get('student-email-settings'))customElements.define('student-email-settings',class extends HTMLElement{
 connectedCallback(){this.load();}
 async call(action,body={}){if(window.__centrlyStudentSession)await window.__centrlyStudentSession;const token=localStorage.getItem('centrly_portal_token') || sessionStorage.getItem('centrly_portal_token');return portalRequest('/public/student-email/'+action,{method:'POST',body:{token,...body}});}
 async load(){
  this.innerHTML=styles+'<div role="status" aria-label="جار تحميل إعدادات البريد" aria-busy="true" style="height:96px;border-radius:18px;background:#e8eef6"></div>';
  try{this.data=await this.call('status');if(this.isConnected)this.render();}catch{this.innerHTML=styles+'<p role="alert">تعذر قراءة إعدادات البريد.</p><button class="se-btn se-secondary" type="button">إعادة المحاولة</button>';this.querySelector('button').onclick=()=>this.load();}
 }
 render(){
  const data=this.data || {};this.challenge=data.challenge_id;
  if(this.hasAttribute('prompt')){
   this.innerHTML=styles+(data.verified?'<div class="se-verified"><span>✓ البريد الإلكتروني مؤكد</span><button type="button" class="se-btn se-secondary" data-open>إعدادات البريد</button></div>':'<aside class="se-banner"><div class="se-copy"><strong>أضف بريدك الإلكتروني لتصلك رسائل المدرس المهمة</strong><p>خطوة اختيارية، وتقدر توقف الرسائل في أي وقت.</p></div><button type="button" class="se-btn" data-open><svg aria-hidden="true" width="19" height="19" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="m4 7 8 6 8-6"/></svg>إضافة وتأكيد البريد</button></aside>');
   this.querySelector('[data-open]').onclick=()=>this.openDialog();return;
  }
  this.innerHTML=styles+'<div data-email-content></div>';this.form(this.querySelector('[data-email-content]'));
 }
 openDialog(){
  const dialog=document.createElement('dialog');dialog.className='se-dialog';dialog.setAttribute('aria-labelledby','student-email-dialog-title');dialog.innerHTML='<header class="se-header"><h2 id="student-email-dialog-title">البريد الإلكتروني</h2><button type="button" class="se-close" aria-label="إغلاق">×</button></header><div data-email-content></div>';this.append(dialog);this.form(dialog.querySelector('[data-email-content]'));
  dialog.querySelector('.se-close').onclick=()=>dialog.close();dialog.addEventListener('close',()=>{dialog.remove();this.querySelector('[data-open]')?.focus();});dialog.showModal();
 }
 form(target){
  const data=this.data || {};target.innerHTML=`<p style="line-height:1.8;margin-top:0">اختياري لاستقبال الرسائل المهمة من المدرس. يمكنك إيقاف الرسائل في أي وقت.</p>${data.verified?`<p>✓ بريد مؤكد: <bdi>${e(data.email)}</bdi> · ${data.enabled?'الرسائل مفعّلة':'الرسائل متوقفة'}</p>`:''}<form data-email-form><label>البريد الإلكتروني<input name="email" type="email" autocomplete="email" required maxlength="254" dir="ltr" value="${e(data.pending_email || data.email || '')}"></label><button class="se-btn" type="submit">${this.challenge?'إرسال كود جديد':'تأكيد'}</button></form><form data-code-form style="display:${this.challenge?'grid':'none'};margin-top:16px"><label>كود التأكيد<input name="code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" required dir="ltr"></label><button class="se-btn" type="submit">تأكيد البريد</button></form>${data.verified && data.enabled?'<button type="button" data-disable class="se-btn se-secondary" style="margin-top:16px">إيقاف رسائل البريد</button>':''}<p data-result role="status" aria-live="polite"></p>`;
  const status=target.querySelector('[data-result]');
  const run=async(button,work)=>{if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='جار تنفيذ الطلب…';try{await work();}catch(error){status.textContent=error.message;}finally{button.disabled=false;button.removeAttribute('aria-busy');}};
  target.querySelector('[data-email-form]').onsubmit=event=>{event.preventDefault();const email=event.currentTarget.elements.email.value.trim();run(event.submitter,async()=>{const result=await this.call('request',{email});this.challenge=result.challenge_id;target.querySelector('[data-email-form]').style.display='none';const form=target.querySelector('[data-code-form]');form.style.display='grid';form.elements.code.focus();status.textContent=result.message;});};
  target.querySelector('[data-code-form]').onsubmit=event=>{event.preventDefault();const code=event.currentTarget.elements.code.value;run(event.submitter,async()=>{await this.call('verify',{challenge_id:this.challenge,code});this.querySelector('dialog')?.close();for(const view of document.querySelectorAll('student-email-settings'))view.load();});};
  target.querySelector('[data-disable]')?.addEventListener('click',event=>run(event.currentTarget,async()=>{await this.call('disable');this.querySelector('dialog')?.close();await this.load();}));
 }
});
