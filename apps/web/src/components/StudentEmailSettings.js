import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.93.0';
import {portalRequest} from '../utils/portalSession.js?v=9.93.0';
if(globalThis.customElements && !customElements.get('student-email-settings'))customElements.define('student-email-settings',class extends HTMLElement{
 connectedCallback(){this.load();}
 async call(action,body={}){
  if(window.__centrlyStudentSession)await window.__centrlyStudentSession;
  const token=localStorage.getItem('centrly_portal_token') || sessionStorage.getItem('centrly_portal_token');
  return portalRequest('/public/student-email/'+action,{method:'POST',body:{token,...body}});
 }
 async load(){
  this.innerHTML='<div role="status" aria-label="جار تحميل إعدادات البريد" aria-busy="true" style="height:96px;border-radius:12px;background:#e2e8f0"></div>';
  try{this.data=await this.call('status');if(this.isConnected)this.render();}
  catch{this.innerHTML='<p role="alert">تعذر قراءة إعدادات البريد.</p><button type="button" style="min-height:44px">إعادة المحاولة</button>';this.querySelector('button').onclick=()=>this.load();}
 }
 render(){
  const data=this.data || {};this.challenge=data.challenge_id;
  if(this.hasAttribute('prompt')){
   this.innerHTML=data.verified?'':'<aside style="padding:16px;border:1px solid #bfdbfe;border-radius:14px;background:#eff6ff;color:#1e3a8a"><strong>أضف بريدك الإلكتروني لتصلك رسائل المدرس المهمة</strong><p>اختياري، وتقدر تؤكده أو تغيّره من قسم البريد الإلكتروني.</p><button type="button" style="min-height:44px">إضافة وتأكيد البريد</button></aside>';
   this.querySelector('button')?.addEventListener('click',()=>{if(window.switchPanel)window.switchPanel('email',document.querySelector('[data-email-nav]'));else window.switchBasicStudentPortalTab?.('email');document.querySelector('student-email-settings:not([prompt]) input')?.focus();});return;
  }
  this.innerHTML=`<section style="display:grid;gap:16px;padding:20px;border:1px solid #e2e8f0;border-radius:16px;background:white;color:#0f172a"><h2>البريد الإلكتروني</h2><p>اختياري لاستقبال الرسائل المهمة من المدرس. يمكنك إيقاف الرسائل في أي وقت.</p>${data.verified?`<p>✓ بريد مؤكد: <bdi>${e(data.email)}</bdi> · ${data.enabled?'الرسائل مفعّلة':'الرسائل متوقفة'}</p>`:''}<form data-email-form style="display:grid;gap:12px"><label>البريد الإلكتروني<input name="email" type="email" autocomplete="email" required maxlength="254" dir="ltr" value="${e(data.pending_email || data.email || '')}" style="display:block;width:100%;box-sizing:border-box;min-height:48px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></label><button type="submit" style="min-height:44px">${this.challenge?'إرسال كود جديد':'إرسال كود التأكيد'}</button></form><form data-code-form style="display:${this.challenge?'grid':'none'};gap:12px"><label>كود التأكيد<input name="code" autocomplete="one-time-code" inputmode="numeric" maxlength="6" required dir="ltr" style="display:block;width:100%;box-sizing:border-box;min-height:48px;padding:10px;border:1px solid #cbd5e1;border-radius:8px"></label><button type="submit" style="min-height:44px">تأكيد البريد</button></form>${data.verified && data.enabled?'<button type="button" data-disable style="min-height:44px">إيقاف رسائل البريد</button>':''}<p data-result role="status" aria-live="polite"></p></section>`;
  const status=this.querySelector('[data-result]');
  const run=async(button,work)=>{if(button.disabled)return;button.disabled=true;button.setAttribute('aria-busy','true');status.textContent='جار تنفيذ الطلب…';try{await work();}catch(error){status.textContent=error.message;}finally{button.disabled=false;button.removeAttribute('aria-busy');}};
  this.querySelector('[data-email-form]').onsubmit=event=>{event.preventDefault();run(event.submitter,async()=>{const result=await this.call('request',{email:event.currentTarget.elements.email.value.trim()});this.challenge=result.challenge_id;const form=this.querySelector('[data-code-form]');form.style.display='grid';form.elements.code.focus();status.textContent=result.message;});};
  this.querySelector('[data-code-form]').onsubmit=event=>{event.preventDefault();run(event.submitter,async()=>{await this.call('verify',{challenge_id:this.challenge,code:event.currentTarget.elements.code.value});for(const view of document.querySelectorAll('student-email-settings'))view.load();});};
  this.querySelector('[data-disable]')?.addEventListener('click',event=>run(event.currentTarget,async()=>{await this.call('disable');await this.load();}));
 }
});
