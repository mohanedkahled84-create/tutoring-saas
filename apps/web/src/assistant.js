import { escapeHtml as e } from './utils/escapeHtml.js';
import { API_BASE_URL } from './services/api.js';
import {mountPhoneVerification} from './components/PhoneVerification.js?v=2';
import { assistantRequest } from './services/assistantClient.js';
import {getIcon} from './utils/icons.js';

const main=document.getElementById('main'),actions=document.getElementById('account-actions'),dialog=document.getElementById('editor');
const params=new URLSearchParams(location.search),workspace=params.get('workspace') || '';
const fragments=new URLSearchParams(location.hash.slice(1));
let invitation=fragments.get('invite'),registration=fragments.get('registration'),verifiedPhone='',stopVerification;
if(invitation || registration) history.replaceState(null,'',`${location.pathname}?workspace=${encodeURIComponent(workspace)}`);
const key=`centrly:assistant:${workspace}`;
let session;try{session=sessionStorage.getItem(key);}catch{}
let identity,rows=[],activeSession,activeQuiz,gradeChoices=[],teacherName='حساب المدرس';
let teacherView={};
function notice(text){document.getElementById('notice').textContent=text;}
function api(path,body) { return assistantRequest(API_BASE_URL,path,{body,token:session}); }
function brand(name) { teacherName=name || teacherName;document.getElementById('workspace-name').textContent=teacherName; }
let pageRequest=0,workspaceRequest=0,stopCollections;
function remember(value){session=value;try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key);}catch{}}
function can(page,action='view'){return identity?.permissions?.[`${page}.${action}`]===true;}
function groupName(id){return identity.groups.find(g=>g.id===id)?.name || 'مجموعة محددة';}
function auth(error='') {
 document.body.className='assistant-auth';
 window.centrlyApp=null;rows=[];teacherView={};activeSession=null;
 stopVerification?.();stopVerification=null;stopCollections?.();stopCollections=null;identity=null;gradeChoices=[];activeQuiz=null;pageRequest++;workspaceRequest++;dialog.close();actions.innerHTML='';notice('');
 const accept=!!invitation;
 main.innerHTML=authFrame(`<span class="auth-kicker">${accept?'الخطوة الأخيرة':'مرحبًا بعودتك'}</span><h1>${accept?'حسابك جاهز للانطلاق':'دخول فريق العمل'}</h1><p class="muted">${accept?'أضف اسمك واختر كلمة مرور لحسابك.':'كل شغلك مع المدرس، في مكان واحد.'}</p><form id="access-form">${accept?`<div class="verified-phone">${getIcon('check',16)}<span>تم تأكيد رقمك</span><bdi>${e(verifiedPhone)}</bdi><input id="registered-phone" type="hidden" value="${e(verifiedPhone)}" readonly></div>`:''}${accept?'<div class="field"><label for="full-name">الاسم بالكامل</label><input id="full-name" name="name" autocomplete="name" minlength="2" maxlength="100" placeholder="اكتب اسمك" required></div>':'<div class="field"><label for="phone">رقم الموبايل</label><input id="phone" name="phone" type="tel" dir="ltr" inputmode="tel" autocomplete="username" maxlength="48" placeholder="01xxxxxxxxx" required></div>'}<div class="field"><label for="password">كلمة المرور</label><div class="password-field"><input id="password" name="password" type="password" autocomplete="${accept?'new-password':'current-password'}" ${accept?'minlength="10"':''} maxlength="72" placeholder="${accept?'اختر كلمة مرور قوية':'أدخل كلمة المرور'}" required><button type="button" id="show-password" aria-label="إظهار كلمة المرور" aria-controls="password" aria-pressed="false">${getIcon('eye',18)}</button></div>${accept?'<p class="helper">١٠ أحرف على الأقل.</p>':''}</div><p class="error" id="auth-error" role="alert">${e(error)}</p><button class="primary auth-submit" type="submit">${accept?'إنشاء الحساب والدخول':'دخول حساب المدرس'} ${getIcon('arrowLeft',18)}</button></form><p class="auth-footnote">${getIcon('lock',14)}${accept?'حسابك خاص بك، والدخول حسب صلاحيات المدرس.':'أول مرة أو نسيت كلمة المرور؟ اطلب رابطًا جديدًا من المدرس.'}</p>`);
 document.getElementById('show-password').onclick=event=>{const input=document.getElementById('password'),show=input.type==='password';input.type=show?'text':'password';event.currentTarget.setAttribute('aria-pressed',String(show));event.currentTarget.setAttribute('aria-label',show?'إخفاء كلمة المرور':'إظهار كلمة المرور');event.currentTarget.innerHTML=getIcon(show?'eyeOff':'eye',18);};
 document.getElementById('access-form').onsubmit=async event=>{
  event.preventDefault();const form=event.currentTarget,button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;const label=button.textContent;button.textContent=accept?'جارٍ حفظ حسابك…':'جارٍ الدخول…';
  try {
   const values=new FormData(form);
   const result=await api(accept?'/accept':'/login',accept?{ticket:invitation,name:values.get('name'),password:values.get('password')}:{workspace,phone:values.get('phone'),password:values.get('password')});
   if(result.workspace && result.workspace!==workspace)throw new Error('افتح رابط الدعوة الخاص بالمدرس المقصود');
   invitation=null;registration=null;verifiedPhone='';remember(result.token);await openWorkspace();
  }catch(error){const target=document.getElementById('auth-error');if(target)target.textContent=error.message;if(accept && error.status===410){const retry=document.createElement('button');retry.type='button';retry.textContent='الرجوع لتسجيل الدخول';retry.onclick=()=>{invitation=null;auth();};target?.append(document.createElement('br'),retry);}button.disabled=false;button.textContent=label;}
 };
}
function authFrame(content){return `<div class="auth-layout"><aside class="auth-story"><div class="auth-brand"><img src="/favicon.png" alt="" width="42" height="42"><span>سنترلي <small>Centrly</small></span></div><div><span class="auth-story-label">مساحة المدرس</span><h2>${e(teacherName)}</h2><p>نفس المكان.<br>فريق واحد، وشغل منظم.</p></div><div class="auth-story-footer">${getIcon('shield',18)} دخول آمن لفريق العمل</div></aside><section class="auth-card">${content}</section></div>`;}
async function beginRegistration() {
 const info=await api('/registration/info',{invitation:registration});
 if(info.tenant_id!==workspace)throw new Error('افتح رابط الدعوة الخاص بالمدرس المقصود');
 brand(info.teacher_name);actions.innerHTML='';
 document.body.className='assistant-auth';
 main.innerHTML=authFrame(`<span class="auth-kicker">دعوتك لفريق العمل</span><h1>${info.recovery?'نرجّع لك حسابك':'أهلًا بك في الفريق'}</h1><p class="muted">أكد رقمك، وبعدها أكمل حسابك وابدأ شغلك.</p><div class="auth-steps" aria-label="خطوات التسجيل"><span class="current">١ تأكيد الرقم</span><span>٢ بياناتك</span></div><div id="registration-verification"></div><p class="helper">لديك حساب بالفعل؟ <button id="back-to-login" type="button" class="text-button">تسجيل الدخول</button></p>`);
 document.getElementById('back-to-login').onclick=()=>{registration=null;invitation=null;auth();};
 stopVerification=mountPhoneVerification(main.querySelector('#registration-verification'),{info,requestChallenge:()=>api('/registration/challenge',{invitation:registration}),requestCode:(proof={})=>api('/registration/request',{invitation:registration,...proof}),verifyCode:fields=>api('/registration/verify',{invitation:registration,...fields}),onVerified:result=>{invitation=result.ticket;verifiedPhone=result.phone;auth();}});
}
let stopTeacherWorkspace;
async function openWorkspace(){
 const version=++workspaceRequest;
 const {mountAssistantWorkspace}=await import('./assistantRuntime.js?v=1');
 if(version!==workspaceRequest)return;
 document.body.className='assistant-workspace';
 actions.innerHTML='';
 const logout=async()=>{
  const closing=api('/logout',{});stopTeacherWorkspace?.();stopTeacherWorkspace=null;
  remember(null);auth();try{await closing;}catch{notice('تم الخروج من هذا الجهاز.');}
 };
 try{stopTeacherWorkspace=await mountAssistantWorkspace({root:main,token:session,onLogout:logout,onExpired:()=>{stopTeacherWorkspace?.();stopTeacherWorkspace=null;remember(null);auth('انتهت الجلسة؛ سجّل الدخول مجددًا');}});}
 catch(error){document.body.className='assistant-auth';throw error;}
}
async function boot(){
 if(!/^[a-f0-9-]{36}$/i.test(workspace)){main.innerHTML='<section class="auth-card"><h1>افتح رابط المدرس</h1><p>استخدم رابط حساب المساعد المرسل إليك على واتساب أو اطلبه من المدرس.</p></section>';return;}
 try {if(registration){await beginRegistration();return;}if(invitation){const claim=await api('/registration/claim',{ticket:invitation});if(claim.tenant_id!==workspace)throw new Error('افتح رابط المدرس الصحيح');brand(claim.teacher_name);verifiedPhone=claim.phone;auth();return;}if(session && !invitation){await openWorkspace();return;}const school=await api(`/workspace/${workspace}`);brand(school.name);auth();}
 catch(error){if(session && error.status===401){remember(null);try{const school=await api(`/workspace/${workspace}`);brand(school.name);}catch{}auth(error.message);}else{main.innerHTML=`<section class="auth-card"><h1>تعذر فتح مساحة العمل</h1><p class="error">${e(error.message)}</p><button id="retry">حاول مجددًا</button></section>`;document.getElementById('retry').onclick=boot;}}
}
boot();
