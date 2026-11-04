import {API_BASE_URL} from './api.js?v=9.42.0';
import {escapeHtml} from '../utils/escapeHtml.js?v=9.42.0';

const PKCE='centrly_google_pkce_v1',PENDING='centrly_google_pending_v1',MAX_AGE=15*60*1000;
const stages=[['primary','ابتدائي'],['preparatory','إعدادي'],['secondary','ثانوي'],['other','غير ذلك']];
const base64url=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replace(/\+/g,'-').replace(/\//g,'_').replace(/=+$/,'');
async function googleRequest(path,body,token){
 const response=await fetch(API_BASE_URL+'/auth/google/'+path,{method:body?'POST':'GET',cache:'no-store',headers:{...(body?{'Content-Type':'application/json'}:{}),...(token?{Authorization:'Bearer '+token}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:AbortSignal.timeout(20000)});
 const data=await response.json();if(!response.ok)throw Object.assign(new Error(data.error?.message || 'تعذر إكمال تسجيل جوجل الآن.'),{status:response.status});return data;
}
export async function enableGoogleButton(button){
 try{const {enabled}=await googleRequest('options');if(button?.isConnected){button.hidden=!enabled;button.style.display=enabled?'flex':'none';}}catch{/* Email/password entry stays usable when the provider is unavailable. */}
}
export async function startGoogleAuth(){
 const verifier=base64url(crypto.getRandomValues(new Uint8Array(64))),challenge=base64url(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(verifier)));
 const {url}=await googleRequest('start',{challenge});
 if(new URL(url).protocol!=='https:')throw Error('تعذر بدء تسجيل جوجل بأمان.');
 sessionStorage.setItem(PKCE,JSON.stringify({verifier,createdAt:Date.now(),origin:location.origin}));
 sessionStorage.removeItem(PENDING);location.assign(url);
}
export function renderGoogleProfile(profile={}){
 const selected=Array.isArray(profile.education_stages)?profile.education_stages:[];
 return `<header class="google-auth-heading"><img src="/apps/web/favicon-96x96.png" width="48" height="48" alt=""><h1>خلّينا نكمّل بياناتك</h1><p>خطوة بسيطة ونجهّز حسابك على سنترلي.</p></header>
 <div class="google-verified-email" dir="ltr">${escapeHtml(profile.email || '')}</div>
 <div id="googleProfileError" role="alert" tabindex="-1" hidden></div>
 <form id="googleProfileForm">
  <div class="form-group"><label class="form-label" for="googleFullName">اسمك</label><input class="form-input" id="googleFullName" name="full_name" autocomplete="name" required minlength="2" maxlength="120" value="${escapeHtml(profile.full_name || '')}"></div>
  <div class="form-group"><label class="form-label" for="googleSubject">المادة اللي بتدرّسها</label><input class="form-input" id="googleSubject" name="subject" required maxlength="100" value="${escapeHtml(profile.subject || '')}"></div>
  <fieldset class="google-stage-group"><legend>المراحل الدراسية <span>ممكن تختار أكتر من مرحلة</span></legend><div class="google-stage-options">${stages.map(([value,label],index)=>`<label><input type="checkbox" name="education_stages" value="${value}" ${selected.includes(value)?'checked':''} ${index===0 && !selected.length?'required':''}>${label}</label>`).join('')}</div></fieldset>
  <div class="form-group" id="googleOtherStageField" ${selected.includes('other')?'':'hidden'}><label class="form-label" for="googleOtherStage">وضّح المرحلة الأخرى</label><input class="form-input" id="googleOtherStage" name="other_stage" maxlength="100" value="${escapeHtml(profile.other_stage || '')}" ${selected.includes('other')?'required':''}></div>
  <div class="form-group"><label class="form-label" for="googlePhone">رقم واتساب</label><input class="form-input" id="googlePhone" name="phone" type="tel" dir="ltr" autocomplete="tel" required maxlength="20" placeholder="010xxxxxxxx" value="${escapeHtml(profile.phone || '')}"><p class="google-field-help">رقمك للتواصل وإدارة حسابك.</p></div>
  <label class="google-terms"><input name="terms_accepted" type="checkbox" required><span>أوافق على <a href="/?policy=terms" target="_blank" rel="noopener">شروط الاستخدام</a> و<a href="/?policy=privacy" target="_blank" rel="noopener">سياسة الخصوصية</a>.</span></label>
  <button class="btn btn-primary google-complete" type="submit">كمّل وادخل حسابك</button>
 </form><a class="google-back" href="/?view=login">العودة لتسجيل الدخول</a>`;
}
function readSaved(key){try{const value=JSON.parse(sessionStorage.getItem(key) || 'null');if(value && value.createdAt<=Date.now() && Date.now()-value.createdAt<MAX_AGE)return value;}catch{}sessionStorage.removeItem(key);return null;}
async function finish(pending){
 if(pending.profile?.requires_profile || !pending.profile?.user?.id)throw Error('كمّل بيانات حسابك أولًا.');
 const {authService}=await import('./auth.js?v=9.42.0');
 // Changing teacher identities must clear the previous teacher/portal snapshots.
 authService.clearSession();authService.setSession(pending.profile.user,pending.session.access_token,pending.session.refresh_token);
 sessionStorage.removeItem(PKCE);sessionStorage.removeItem(PENDING);location.replace('/');
}
export async function mountGoogleCallback(root=document.getElementById('googleAuthRoot')){
 const failure=message=>{root.innerHTML=`<header class="google-auth-heading"><h1>نرجع نجرّب تاني؟</h1><p>${escapeHtml(message)}</p></header><a class="btn btn-primary google-complete" href="/?view=login">العودة لتسجيل الدخول</a>`;};
 try{
  const incoming=window.__centrlyGoogleCallback || {},saved=readSaved(PKCE);
  let pending;
  if(incoming.error){sessionStorage.removeItem(PKCE);sessionStorage.removeItem(PENDING);throw Error('تسجيل جوجل ما اكتملش. تقدر ترجع وتختار حسابك من جديد.');}
  if(incoming.code){
   window.__centrlyGoogleCallback=null;
   if(!saved || saved.origin!==location.origin || !/^[A-Za-z0-9_-]{86}$/.test(saved.verifier))throw Error('افتح تسجيل جوجل من نفس الجهاز وابدأ من جديد.');
   sessionStorage.removeItem(PKCE);
   pending={...await googleRequest('exchange',{code:incoming.code,verifier:saved.verifier}),createdAt:Date.now()};
   sessionStorage.setItem(PENDING,JSON.stringify(pending));
  }else pending=readSaved(PENDING);
  if(!pending?.session?.access_token || !pending.profile)throw Error('انتهت مهلة تسجيل الدخول. ابدأ من جديد.');
  if(!pending.profile.requires_profile){await finish(pending);return;}
  root.innerHTML=renderGoogleProfile(pending.profile);
  const form=root.querySelector('form'),errorBox=root.querySelector('#googleProfileError'),button=form.querySelector('button[type=submit]');
  form.addEventListener('change',()=>{
   const selected=[...form.querySelectorAll('[name=education_stages]:checked')].map(input=>input.value);
   form.querySelector('[name=education_stages]').required=!selected.length;
   form.querySelector('#googleOtherStageField').hidden=!selected.includes('other');form.elements.other_stage.required=selected.includes('other');
  });
  form.addEventListener('submit',async event=>{
   event.preventDefault();if(button.disabled || !form.reportValidity())return;
   button.disabled=true;button.setAttribute('aria-busy','true');errorBox.hidden=true;
   try{
    const selected=[...form.querySelectorAll('[name=education_stages]:checked')].map(input=>input.value);
    const {profile}=await googleRequest('complete',{full_name:form.elements.full_name.value,subject:form.elements.subject.value,phone:form.elements.phone.value,education_stages:selected,other_stage:selected.includes('other')?form.elements.other_stage.value:'',terms_accepted:form.elements.terms_accepted.checked},pending.session.access_token);
    await finish({...pending,profile});
   }catch(error){
    if(error.status===401){sessionStorage.removeItem(PENDING);failure('انتهت جلسة جوجل. سجّل الدخول من جديد.');return;}
    errorBox.textContent=error.message;errorBox.hidden=false;errorBox.focus();
   }finally{if(button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');}}
  });
 }catch(error){failure(error.message || 'تعذر إكمال الدخول. حاول من جديد.');}
}
