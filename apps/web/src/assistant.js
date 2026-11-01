import { escapeHtml as e } from './utils/escapeHtml.js';
import { assistantPages } from './components/AssistantAccessFields.js?v=5';
import { API_BASE_URL } from './services/api.js';
import {mountFollowupReports} from './components/FollowupReports.js';
import {mountCollectionLedger} from './components/CollectionLedger.js?v=2';
import {mountPhoneVerification} from './components/PhoneVerification.js?v=2';
import { assistantRequest } from './services/assistantClient.js';

const main=document.getElementById('main'),actions=document.getElementById('account-actions'),dialog=document.getElementById('editor');
const params=new URLSearchParams(location.search),workspace=params.get('workspace') || '';
const fragments=new URLSearchParams(location.hash.slice(1));
let invitation=fragments.get('invite'),registration=fragments.get('registration'),verifiedPhone='',stopVerification;
if(invitation || registration) history.replaceState(null,'',`${location.pathname}?workspace=${encodeURIComponent(workspace)}`);
const key=`centrly:assistant:${workspace}`;
let session;try{session=sessionStorage.getItem(key);}catch{}
let identity,selected,rows=[],activeSession,activeQuiz,gradeChoices=[],teacherName='حساب المدرس';
function notice(text){document.getElementById('notice').textContent=text;}
function api(path,body) { return assistantRequest(API_BASE_URL,path,{body,token:session}); }
function brand(name) { teacherName=name || teacherName;document.getElementById('workspace-name').textContent=teacherName; }
let pageRequest=0,workspaceRequest=0,stopCollections;
function remember(value){session=value;try{if(value)sessionStorage.setItem(key,value);else sessionStorage.removeItem(key);}catch{}}
function can(page,action='view'){return identity?.permissions?.[`${page}.${action}`]===true;}
function groupName(id){return identity.groups.find(g=>g.id===id)?.name || 'مجموعة محددة';}
function auth(error='') {
 stopVerification?.();stopVerification=null;stopCollections?.();stopCollections=null;identity=null;gradeChoices=[];activeQuiz=null;pageRequest++;workspaceRequest++;dialog.close();actions.innerHTML='';notice('');
 const accept=!!invitation;
 main.innerHTML=`<div class="auth-card"><p class="eyebrow">${e(teacherName)}</p><h1>${accept?'استكمل حسابك في الفريق':'دخول المساعد'}</h1><p class="muted">${accept?'رقمك تم تأكيده. اكتب اسمك واختر كلمة مرور خاصة بحسابك لدى هذا المدرس.':'استخدم رقم واتساب وكلمة المرور الخاصة بك لدى هذا المدرس.'}</p><form id="access-form">${accept?`<div class="field"><label for="registered-phone">رقم الموبايل المؤكد</label><input id="registered-phone" type="tel" dir="ltr" value="${e(verifiedPhone)}" readonly required></div>`:''}${accept?'<div class="field"><label for="full-name">اسمك</label><input id="full-name" name="name" autocomplete="name" minlength="2" maxlength="100" required></div>':'<div class="field"><label for="phone">رقم واتساب</label><input id="phone" name="phone" type="tel" dir="ltr" inputmode="tel" autocomplete="username" maxlength="48" required></div>'}<div class="field"><label for="password">كلمة المرور</label><input id="password" name="password" type="password" autocomplete="${accept?'new-password':'current-password'}" ${accept?'minlength="10"':''} maxlength="72" required>${accept?'<p class="helper">١٠ أحرف على الأقل. كلمة المرور مستقلة عن حساباتك لدى أي مدرس آخر.</p>':''}</div><button type="button" id="show-password" aria-controls="password" aria-pressed="false">إظهار كلمة المرور</button><p class="error" id="auth-error" role="alert">${e(error)}</p><button class="primary" type="submit">${accept?'إنشاء حسابي':'دخول مساحة العمل'}</button></form><p class="helper">${accept?'الرابط صالح لمدة ١٥ دقيقة ويستخدم مرة واحدة.':'لإنشاء حساب أو استعادة الدخول، اطلب دعوة واتساب جديدة من المدرس.'}</p></div>`;
 document.getElementById('show-password').onclick=event=>{const input=document.getElementById('password'),show=input.type==='password';input.type=show?'text':'password';event.currentTarget.setAttribute('aria-pressed',String(show));event.currentTarget.textContent=show?'إخفاء كلمة المرور':'إظهار كلمة المرور';};
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
async function beginRegistration() {
 const info=await api('/registration/info',{invitation:registration});
 if(info.tenant_id!==workspace)throw new Error('افتح رابط الدعوة الخاص بالمدرس المقصود');
 brand(info.teacher_name);actions.innerHTML='';
 main.innerHTML=`<section class="auth-card"><p class="eyebrow">${e(teacherName)}</p><h1>${info.recovery?'استعادة حساب المساعد':'إنشاء حساب المساعد'}</h1><p class="muted">أكد رقم موبايلك، ثم اكتب اسمك واختر كلمة مرورك.</p><div id="registration-verification"></div><p class="helper">لديك حساب بالفعل؟ <button id="back-to-login" type="button">تسجيل الدخول</button></p></section>`;
 document.getElementById('back-to-login').onclick=()=>{registration=null;invitation=null;auth();};
 stopVerification=mountPhoneVerification(main.querySelector('#registration-verification'),{info,requestChallenge:()=>api('/registration/challenge',{invitation:registration}),requestCode:(proof={})=>api('/registration/request',{invitation:registration,...proof}),verifyCode:fields=>api('/registration/verify',{invitation:registration,...fields}),onVerified:result=>{invitation=result.ticket;verifiedPhone=result.phone;auth();}});
}
async function openWorkspace(){
 const version=++workspaceRequest;pageRequest++;let current;try{current=await api('/me');}catch(error){if(version!==workspaceRequest)return;throw error;}if(version!==workspaceRequest)return;
 if(current.tenant_id!==workspace){remember(null);throw new Error('هذه الجلسة تخص مدرسًا آخر');}
 identity=current;brand(identity.teacher_name);
 gradeChoices=gradeChoices.filter(q=>identity.groups.some(g=>g.id===q.group_id));if(!gradeChoices.some(q=>q.id===activeQuiz))activeQuiz=null;
 const pages=assistantPages.filter(([key])=>can(key));
 selected=pages.some(([key])=>key===selected)?selected:pages[0]?.[0];
 if(!identity.sessions?.some(s=>s.id===activeSession))activeSession=identity.sessions?.[0]?.id || null;
 actions.innerHTML=`<span>${e(identity.name)}</span><button id="logout">خروج</button>`;
 document.getElementById('logout').onclick=async()=>{
  const result=api('/logout',{});remember(null);auth();
  try{await result;notice('تم تسجيل الخروج');}catch{notice('تم الخروج من هذا الجهاز. تعذر تأكيد إغلاق الجلسة على المنصة.');}
 };
 main.innerHTML=`<div class="welcome"><h1>أهلًا ${e(identity.name)}</h1><p>فريق ${e(identity.teacher_name)} · صفحات العمل المتاحة لك</p></div>${pages.length?`<div class="workspace"><nav aria-label="صفحات العمل">${pages.map(([key,label])=>`<button data-page="${key}" ${key===selected?'aria-current="page"':''}>${label}</button>`).join('')}</nav><section class="panel" id="page-content" aria-live="polite"></section></div>`:'<section class="panel empty"><h2>حسابك جاهز</h2><p>لم يحدد المدرس صفحات عمل لك بعد. تواصل معه لتحديد صلاحياتك ومجموعاتك.</p></section>'}`;
 main.querySelectorAll('[data-page]').forEach(button=>button.onclick=()=>{
  selected=button.dataset.page;main.querySelectorAll('[data-page]').forEach(el=>el.removeAttribute('aria-current'));button.setAttribute('aria-current','page');loadPage();
 });
 if(selected)await loadPage();
}
const fieldLabels={score:'الدرجة',note:'ملاحظة الدرجة',name:'الاسم',subject:'المادة',student_code:'كود الطالب',parent_phone:'رقم ولي الأمر',student_phone:'رقم الطالب',notes:'ملاحظات',session_date:'تاريخ الحصة',session_number:'رقم الحصة',start_time:'البداية',end_time:'النهاية',status:'الحالة',attended:'الحضور',homework_status:'الواجب',comment:'ملاحظة',description:'الوصف',type:'نوع المحتوى',is_homework:'تكليف واجب',due_date:'آخر موعد',teacher_notes:'ملاحظة المراجعة',submitted_at:'التسليم',reviewed_at:'المراجعة',quiz_number:'رقم الاختبار',max_score:'الدرجة النهائية',quiz_date:'تاريخ الاختبار',recorded_sessions:'حصص مسجلة',attended_sessions:'حصص حضرها الطالب'};
const translated={ended:'منتهية',scheduled:'مجدولة',cancelled:'ملغاة',pending:'بانتظار المراجعة',approved:'مقبول',rejected:'يحتاج إعادة تسليم',done:'مكتمل',partial:'جزئي',missing:'لم يسلم',pdf:'ملف PDF',video:'فيديو',link:'رابط'};
function valueText(value){if(value===null || value===undefined || value==='')return '—';if(value===true)return 'نعم';if(value===false)return 'لا';return translated[value] || String(value);}
async function loadPage(){
 const panel=document.getElementById('page-content'),page=selected,request=++pageRequest,sessionId=activeSession,quizId=activeQuiz;
 stopCollections?.();stopCollections=null;
 if(!panel || !identity)return;
 if(['reports','messages'].includes(page)){panel.innerHTML='<div id="assistant-followup"></div>';stopCollections=mountFollowupReports(panel.querySelector('#assistant-followup'),{groups:identity.groups,allowSend:can('messages') && can('messages','send'),request:(suffix,body)=>api(body===undefined?`/data/${page}${suffix}`:'/followup/prepare',body),onFailure:error=>{if([401,403].includes(error.status))handleFailure(error);}});return;}
 if(page==='collections'){panel.innerHTML='<h2>سجل التحصيل</h2><div id="assistant-collection-ledger"></div>';stopCollections=mountCollectionLedger(panel.querySelector('#assistant-collection-ledger'),{groups:identity.groups,allowCreate:can('collections','create'),request:(suffix,body)=>api(`/data/collections${body===undefined?suffix:'/create'}`,body),onFailure:error=>{if(error.status===401)handleFailure(error);}});return;}
 const label=assistantPages.find(([key])=>key===page)?.[1] || '';
 panel.innerHTML=`<div class="panel-top"><h2>${label}</h2><div class="actions"><button id="refresh" aria-label="تحديث بيانات الصفحة">إعادة التحميل</button>${can(page,'create')?'<button id="create" class="primary" disabled>إضافة جديد</button>':''}</div></div>${page==='attendance'?`<div class="session-picker"><label for="attendance-session">اختر الحصة</label><select id="attendance-session">${(identity.sessions || []).map(s=>`<option value="${e(s.id)}" ${s.id===sessionId?'selected':''}>${e(groupName(s.group_id))} · ${e(s.session_date)}</option>`).join('') || '<option value="">لا توجد حصص متاحة</option>'}</select></div>`:''}${page==='grades'?'<div class="session-picker"><label for="grade-quiz">اختر الاختبار</label><select id="grade-quiz"></select></div>':''}<div id="page-rows" aria-busy="true"><div class="opening" role="status">تحميل بيانات الصفحة…</div></div>`;
 panel.querySelector('#refresh').onclick=()=>openWorkspace().catch(handleFailure);
 panel.querySelector('#create')?.addEventListener('click',()=>editRecord());
 panel.querySelector('#attendance-session')?.addEventListener('change',event=>{activeSession=event.target.value;loadPage();});
 const gradePicker=panel.querySelector('#grade-quiz');
 const fillQuizzes=()=>{if(!gradePicker)return;gradePicker.innerHTML=gradeChoices.map(q=>`<option value="${e(q.id)}" ${q.id===activeQuiz?'selected':''}>${e(q.title)} · ${e(groupName(q.group_id))}${q.is_skipped?' · ملغى':''}</option>`).join('') || '<option value="">لا توجد اختبارات متاحة</option>';gradePicker.disabled=!gradeChoices.length;};
 fillQuizzes();gradePicker?.addEventListener('change',event=>{activeQuiz=event.target.value;loadPage();});
 const content=panel.querySelector('#page-rows');
 try {
  const result=page==='attendance' && !sessionId?{rows:[],limit:500}:await api(`/data/${page}${page==='attendance'?`?session_id=${encodeURIComponent(sessionId)}`:page==='grades' && quizId?`?quiz_id=${encodeURIComponent(quizId)}`:''}`);
  if(request!==pageRequest || page!==selected || !identity)return;
  rows=result.rows || [];if(page==='grades'){gradeChoices=result.quizzes || [];activeQuiz=result.quiz_id;fillQuizzes();}
  content.setAttribute('aria-busy','false');
  content.innerHTML=`<div class="rows">${rows.length?rows.map((row,index)=>`<article class="row"><h3>${e(row.name || row.student_name || row.title || groupName(row.group_id))}</h3>${row.group_id?`<small>${e(groupName(row.group_id))}</small>`:''}<dl>${Object.entries(row).filter(([key])=>fieldLabels[key] && !['name'].includes(key)).map(([key,value])=>`<div><dt>${fieldLabels[key]}</dt><dd>${e(key==='score' && value===null?'لم تُرصد بعد':valueText(value))}</dd></div>`).join('')}</dl><div class="actions">${can(page,'edit') && !(page==='grades' && row.is_skipped)?`<button data-edit="${index}">${page==='attendance'?'رصد الحضور':page==='homework'?'مراجعة التسليم':page==='grades'?'رصد الدرجة':'تعديل'}</button>`:''}${page==='homework'?`<button data-file="${e(row.id)}">عرض ملف التسليم</button>`:''}${page==='materials' && /^https:\/\//.test(row.url || '')?`<a href="${e(row.url)}" target="_blank" rel="noopener noreferrer">فتح المحتوى</a>`:''}</div></article>`).join(''):'<div class="empty">لا توجد بيانات متاحة في مجموعاتك لهذه الصفحة.</div>'}</div>${rows.length>=result.limit?`<p class="helper">يعرض هذا الملخص أحدث ${result.limit} سجلًا. يمكنك الرجوع للمدرس للسجلات الأقدم.</p>`:''}`;
  const create=panel.querySelector('#create');if(create)create.disabled=false;
  panel.querySelectorAll('[data-edit]').forEach(button=>button.onclick=()=>editRecord(rows[Number(button.dataset.edit)]));
  panel.querySelectorAll('[data-file]').forEach(button=>button.onclick=async()=>{
   button.disabled=true;
   try{const result=await api(`/files/${button.dataset.file}`);if(request!==pageRequest)return;const a=document.createElement('a');a.href=result.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent='فتح ملف التسليم';button.replaceWith(a);a.focus();}
   catch(error){handleFailure(error);button.disabled=false;}
  });
 }catch(error){if(request!==pageRequest || page!==selected)return;content.setAttribute('aria-busy','false');content.innerHTML=`<p class="error">${e(error.message)}</p><button id="retry-page">حاول مجددًا</button>`;content.querySelector('button').onclick=()=>openWorkspace().catch(handleFailure);if(error.status===401 || error.status===403)handleFailure(error);}
}

function input(key,label,type='text',value='',extra=''){
 return `<div class="field"><label for="edit-${key}">${label}</label><input id="edit-${key}" name="${key}" type="${type}" value="${e(value ?? '')}" ${extra}></div>`;
}
function select(key,label,options,value){return `<div class="field"><label for="edit-${key}">${label}</label><select id="edit-${key}" name="${key}">${options.map(([v,l])=>`<option value="${e(v)}" ${String(v)===String(value)?'selected':''}>${e(l)}</option>`).join('')}</select></div>`;}
function editRecord(row){
 const create=!row,page=selected;row ||= {};
 let html='';const required='required maxlength="100"';
 if(create && page!=='groups')html+=select('group_id','المجموعة',identity.groups.map(g=>[g.id,g.name]),'');
 if(page==='groups')html+=input('name','اسم المجموعة','text',row.name,required)+input('subject','المادة','text',row.subject,'maxlength="100"');
 if(page==='students')html+=input('name','اسم الطالب','text',row.name,required)+input('parent_phone','رقم ولي الأمر','tel',row.parent_phone,'required minlength="8" maxlength="48" dir="ltr"')+input('student_phone','رقم الطالب','tel',row.student_phone,'maxlength="48" dir="ltr"')+input('notes','ملاحظات','text',row.notes,'maxlength="2000"');
 if(page==='attendance')html+=select('attended','الحضور',[['true','حاضر'],['false','غائب']],String(row.attended ?? true))+select('homework_status','حالة الواجب',[['done','مكتمل'],['partial','جزئي'],['missing','لم يسلم']],row.homework_status)+input('comment','ملاحظة','text',row.comment,'maxlength="2000"');
 if(page==='grades')html+=`<p>${e(row.student_name)} · الدرجة النهائية ${e(row.max_score)}</p>`+input('score','درجة الطالب','number',row.score,'required min="0" step="any" max="'+e(row.max_score)+'"')+input('note','ملاحظة الدرجة','text',row.note,'maxlength="2000"');
 if(page==='homework')html+=select('status','نتيجة المراجعة',[['approved','مقبول'],['rejected','يحتاج إعادة تسليم']],row.status)+input('teacher_notes','ملاحظة للمراجعة','text',row.teacher_notes,'maxlength="2000"');
 if(page==='materials')html+=input('title','عنوان المحتوى','text',row.title,required)+input('description','الوصف','text',row.description,'maxlength="4000"')+select('type','نوع المحتوى',[['pdf','ملف PDF'],['video','فيديو'],['link','رابط']],row.type)+input('url','رابط المحتوى','url',row.url,'required dir="ltr" placeholder="https://"')+`<label class="check"><input type="checkbox" name="is_homework" ${row.is_homework?'checked':''}>تكليف واجب</label>`+input('due_date','آخر موعد للتسليم','date',row.due_date);
 if(page==='quizzes')html+=input('title','عنوان الاختبار','text',row.title,required)+(create?input('quiz_number','رقم الاختبار','number',1,'required min="1" max="100000"')+input('max_score','الدرجة النهائية','number',10,'required min="0.01" max="100000" step="0.01"'):'<p class="helper">رقم الاختبار والدرجة النهائية محفوظان للحفاظ على النتائج المسجلة.</p>')+input('quiz_date','تاريخ الاختبار','date',row.quiz_date,'required');
 document.getElementById('editor-title').textContent=create?'إضافة سجل جديد':page==='homework'?'مراجعة التسليم':'تعديل السجل';
 document.getElementById('editor-fields').innerHTML=html;document.getElementById('form-error').textContent='';dialog.showModal();
 const form=document.getElementById('record-form');form.onsubmit=async event=>{
  event.preventDefault();const button=form.querySelector('[type=submit]');if(button.disabled)return;button.disabled=true;button.textContent='جارٍ الحفظ…';
  const data=Object.fromEntries(new FormData(form));
  if(!create && page!=='grades')data.id=row.id;
  if(page==='grades'){data.quiz_id=row.quiz_id;data.student_id=row.student_id;data.score=Number(data.score);}
  if(page==='attendance'){data.attended=data.attended==='true';data.session_id=row.session_id;data.student_id=row.student_id;}
  if(page==='materials')data.is_homework=!!form.querySelector('[name=is_homework]').checked;
  if(page==='quizzes' && create){data.quiz_number=Number(data.quiz_number);data.max_score=Number(data.max_score);}
  try{await api(`/data/${page}/${create?'create':'edit'}`,data);dialog.close();notice('تم حفظ التغييرات');await openWorkspace();}
  catch(error){document.getElementById('form-error').textContent=error.message;if(error.status===401)handleFailure(error);}finally{button.disabled=false;button.textContent='حفظ';}
 };
}
function handleFailure(error){if(error.status===401){remember(null);auth(error.message);}else if(error.status===403){dialog.close();notice('الصلاحيات اتغيرت. حدّث الصفحة لعرض الصفحات المتاحة لك.');}else notice(error.message);}
document.getElementById('cancel-editor').onclick=()=>dialog.close();
async function boot(){
 if(!/^[a-f0-9-]{36}$/i.test(workspace)){main.innerHTML='<section class="auth-card"><h1>افتح رابط المدرس</h1><p>استخدم رابط حساب المساعد المرسل إليك على واتساب أو اطلبه من المدرس.</p></section>';return;}
 try {if(registration){await beginRegistration();return;}if(invitation){const claim=await api('/registration/claim',{ticket:invitation});if(claim.tenant_id!==workspace)throw new Error('افتح رابط المدرس الصحيح');brand(claim.teacher_name);verifiedPhone=claim.phone;auth();return;}if(session && !invitation){await openWorkspace();return;}const school=await api(`/workspace/${workspace}`);brand(school.name);auth();}
 catch(error){if(session && error.status===401){remember(null);try{const school=await api(`/workspace/${workspace}`);brand(school.name);}catch{}auth(error.message);}else{main.innerHTML=`<section class="auth-card"><h1>تعذر فتح مساحة العمل</h1><p class="error">${e(error.message)}</p><button id="retry">حاول مجددًا</button></section>`;document.getElementById('retry').onclick=boot;}}
}
boot();
