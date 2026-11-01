import { escapeHtml as e } from './utils/escapeHtml.js';
import { assistantPages } from './components/AssistantAccessFields.js?v=5';
import { API_BASE_URL } from './services/api.js';
import {mountFollowupReports} from './components/FollowupReports.js';
import {mountCollectionLedger} from './components/CollectionLedger.js?v=2';
import {mountPhoneVerification} from './components/PhoneVerification.js?v=2';
import { assistantRequest } from './services/assistantClient.js';
import {renderSidebar} from './components/Sidebar.js?v=5.4.0';
import {renderNavbar} from './components/Navbar.js?v=5.2.0';
import {getIcon} from './utils/icons.js';
import {assistantCanNavigate,assistantResourceRoute} from './utils/assistantWorkspacePolicy.js';
import {teacherPageHtml,mountTeacherPage,teacherPageToolbar} from './components/AssistantTeacherPages.js';

const main=document.getElementById('main'),actions=document.getElementById('account-actions'),dialog=document.getElementById('editor');
const params=new URLSearchParams(location.search),workspace=params.get('workspace') || '';
const fragments=new URLSearchParams(location.hash.slice(1));
let invitation=fragments.get('invite'),registration=fragments.get('registration'),verifiedPhone='',stopVerification;
if(invitation || registration) history.replaceState(null,'',`${location.pathname}?workspace=${encodeURIComponent(workspace)}`);
const key=`centrly:assistant:${workspace}`;
let session;try{session=sessionStorage.getItem(key);}catch{}
let identity,selected,rows=[],activeSession,activeQuiz,gradeChoices=[],teacherName='حساب المدرس';
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
async function openWorkspace(){
 const version=++workspaceRequest;pageRequest++;let current;try{current=await api('/me');}catch(error){if(version!==workspaceRequest)return;throw error;}if(version!==workspaceRequest)return;
 if(current.tenant_id!==workspace){remember(null);throw new Error('هذه الجلسة تخص مدرسًا آخر');}
 identity=current;brand(identity.teacher_name);
 document.body.className='assistant-workspace';
 gradeChoices=gradeChoices.filter(q=>identity.groups.some(g=>g.id===q.group_id));if(!gradeChoices.some(q=>q.id===activeQuiz))activeQuiz=null;
 const pages=assistantPages.filter(([key])=>can(key));
 selected=pages.some(([key])=>key===selected)?selected:pages[0]?.[0];
 if(!identity.sessions?.some(s=>s.id===activeSession))activeSession=identity.sessions?.[0]?.id || null;
 const logout=async()=>{
  const result=api('/logout',{});remember(null);auth();
  try{await result;notice('تم تسجيل الخروج');}catch{notice('تم الخروج من هذا الجهاز. تعذر تأكيد إغلاق الجلسة على المنصة.');}
 };
 actions.innerHTML='';
 const navigate=route=>{
  if(!identity || !assistantCanNavigate(identity.permissions,route)){notice('هذه الصفحة غير متاحة ضمن صلاحياتك');return;}
  const resource=route==='sessions'?'attendance':route==='calendar'?'sessions':route==='quizzes'?(can('grades')?'grades':'quizzes'):route==='reports'?(can('reports')?'reports':'messages'):route;
  selected=resource;teacherView={};window.centrlyApp.currentRoute=route;
  main.querySelectorAll('.nav-link').forEach(button=>{const active=button.dataset.route===route;button.classList.toggle('active',active);if(active)button.setAttribute('aria-current','page');else button.removeAttribute('aria-current');});
  toggleSidebar(true);loadPage();
 };
 window.centrlyApp={user:{role:'assistant',name:identity.name,tenant_name:identity.teacher_name},students:[],studentsGroupFilter:'',studentsSearchQuery:'',navigate,toggleSidebar,promptLogout:logout,currentRoute:assistantResourceRoute(selected),isUserSubscribed:()=>false};
 main.innerHTML=`<div class="app-container">${renderSidebar(assistantResourceRoute(selected),window.centrlyApp.user,undefined,{canNavigate:route=>assistantCanNavigate(identity.permissions,route),supplementalRoutes:[{id:'collections',title:'سجل التحصيل',icon:'billing'},{id:'messages',title:'متابعة الطلاب وواتساب',icon:'whatsapp'}]})}<div class="app-main">${renderNavbar(window.centrlyApp.user)}<div class="assistant-teacher-context"><span>${e(identity.teacher_name)}</span><small>${getIcon('shield',14)} حساب مساعد</small></div><div class="content-body" id="page-content" aria-live="polite"></div></div></div><button class="assistant-sidebar-overlay" aria-label="إغلاق القائمة" hidden></button>`;
 main.querySelector('.assistant-sidebar-overlay').onclick=()=>toggleSidebar(true);
 main.querySelector('.mobile-close-btn')?.setAttribute('aria-label','إغلاق القائمة');
 if(!selected)main.querySelector('#page-content').innerHTML='<section class="card empty"><h1>حسابك جاهز</h1><p>تواصل مع المدرس لتحديد صلاحياتك ومجموعاتك.</p></section>';
 if(selected)await loadPage();
}
function toggleSidebar(close=false){const sidebar=main.querySelector('#appSidebar'),overlay=main.querySelector('.assistant-sidebar-overlay');if(!sidebar || !overlay)return;const open=!close && !sidebar.classList.contains('open');sidebar.classList.toggle('open',open);overlay.hidden=!open;document.body.classList.toggle('sidebar-open',open);main.querySelector('#sidebarToggle')?.setAttribute('aria-expanded',String(open));if(close)main.querySelector('#sidebarToggle')?.focus({preventScroll:true});}
const fieldLabels={score:'الدرجة',note:'ملاحظة الدرجة',name:'الاسم',subject:'المادة',student_code:'كود الطالب',parent_phone:'رقم ولي الأمر',student_phone:'رقم الطالب',notes:'ملاحظات',session_date:'تاريخ الحصة',session_number:'رقم الحصة',start_time:'البداية',end_time:'النهاية',status:'الحالة',attended:'الحضور',homework_status:'الواجب',comment:'ملاحظة',description:'الوصف',type:'نوع المحتوى',is_homework:'تكليف واجب',due_date:'آخر موعد',teacher_notes:'ملاحظة المراجعة',submitted_at:'التسليم',reviewed_at:'المراجعة',quiz_number:'رقم الاختبار',max_score:'الدرجة النهائية',quiz_date:'تاريخ الاختبار',recorded_sessions:'حصص مسجلة',attended_sessions:'حصص حضرها الطالب'};
const translated={ended:'منتهية',scheduled:'مجدولة',cancelled:'ملغاة',pending:'بانتظار المراجعة',approved:'مقبول',rejected:'يحتاج إعادة تسليم',done:'مكتمل',partial:'جزئي',missing:'لم يسلم',pdf:'ملف PDF',video:'فيديو',link:'رابط'};
function valueText(value){if(value===null || value===undefined || value==='')return '—';if(value===true)return 'نعم';if(value===false)return 'لا';return translated[value] || String(value);}
async function loadPage(){
 const panel=document.getElementById('page-content'),page=selected,request=++pageRequest,sessionId=activeSession,quizId=activeQuiz;
 stopCollections?.();stopCollections=null;
 if(!panel || !identity)return;
 if(!can(page)){panel.innerHTML='<section class="card empty"><h1>الصفحة مقفولة</h1><p>هذه الصفحة غير متاحة ضمن صلاحياتك.</p></section>';return;}
 if(['reports','messages'].includes(page)){panel.innerHTML=teacherPageToolbar(page==='reports'?'الدرجات ولوحة الشرف':'متابعة الطلاب وواتساب')+'<section class="card"><div id="assistant-followup"></div></section>';panel.querySelector('#refresh').onclick=()=>openWorkspace().catch(handleFailure);stopCollections=mountFollowupReports(panel.querySelector('#assistant-followup'),{groups:identity.groups,allowSend:can('messages') && can('messages','send'),request:(suffix,body)=>api(body===undefined?`/data/${page}${suffix}`:'/followup/prepare',body),onFailure:error=>{if([401,403].includes(error.status))handleFailure(error);}});return;}
 if(page==='collections'){panel.innerHTML=teacherPageToolbar('سجل التحصيل')+'<section class="card"><div id="assistant-collection-ledger"></div></section>';panel.querySelector('#refresh').onclick=()=>openWorkspace().catch(handleFailure);stopCollections=mountCollectionLedger(panel.querySelector('#assistant-collection-ledger'),{groups:identity.groups,allowCreate:can('collections','create'),request:(suffix,body)=>api(`/data/collections${body===undefined?suffix:'/create'}`,body),onFailure:error=>{if(error.status===401)handleFailure(error);}});return;}
 const label=assistantPages.find(([key])=>key===page)?.[1] || '';
 panel.innerHTML=teacherPageToolbar(label)+'<div id="page-rows" class="card opening" role="status" aria-busy="true"><span class="loader" aria-hidden="true"></span><p>نجهّز بيانات الصفحة</p></div>';
 const content=panel.querySelector('#page-rows');
 try {
  const result=page==='attendance' && !sessionId?{rows:[],limit:500}:await api(`/data/${page}${page==='attendance'?`?session_id=${encodeURIComponent(sessionId)}`:page==='grades' && quizId?`?quiz_id=${encodeURIComponent(quizId)}`:''}`);
  if(request!==pageRequest || page!==selected || !identity)return;
  rows=result.rows || [];if(page==='grades'){gradeChoices=result.quizzes || [];activeQuiz=result.quiz_id;}
  content.setAttribute('aria-busy','false');
  if(['groups','students','sessions','attendance','materials','homework','grades','quizzes'].includes(page)){
   await renderTeacherContent(panel,page,result,()=>request===pageRequest && page===selected && !!identity);return;
  }
 }catch(error){if(request!==pageRequest || page!==selected)return;content.setAttribute('aria-busy','false');content.innerHTML=`<p class="error">${e(error.message)}</p><button id="retry-page">حاول مجددًا</button>`;content.querySelector('button').onclick=()=>openWorkspace().catch(handleFailure);if(error.status===401 || error.status===403)handleFailure(error);}
}

async function renderTeacherContent(panel,page,result,isCurrent){
 const pageRows=result.rows || [],title=assistantPages.find(([key])=>key===page)?.[1] || '';
 const html=await teacherPageHtml(page,pageRows,identity,{...teacherView,sessionId:activeSession,session:result.session,quizzes:gradeChoices,quizId:activeQuiz,canGrade:can('grades','edit')});
 if(!isCurrent())return;
 let extras='';
 if(page==='students' && can('collections'))extras+='<button id="open-collections" type="button" class="btn btn-secondary">سجل التحصيل</button>';
 if(['reports','students'].includes(page) && can('messages'))extras+='<button id="open-messages" type="button" class="btn btn-secondary">متابعة الطلاب وواتساب</button>';
 if(['grades','quizzes'].includes(page) && can('quizzes','create'))extras+='<button id="new-quiz" type="button" class="btn btn-primary">إضافة كويز</button>';
 if(['grades','quizzes'].includes(page)){const choices=page==='quizzes'?pageRows:gradeChoices;extras+=`<select id="assistant-quiz-select" aria-label="اختر الكويز">${choices.map(q=>`<option value="${e(q.id)}" ${q.id===activeQuiz?'selected':''}>${e(q.title)} · ${e(groupName(q.group_id))}</option>`).join('') || '<option value="">لا توجد كويزات</option>'}</select>`;}
 if(page==='grades' && can('quizzes'))extras+='<button id="quiz-settings" type="button" class="btn btn-secondary">إعداد الكويزات</button>';
 if(page==='quizzes' && can('grades'))extras+='<button id="quiz-grades" type="button" class="btn btn-secondary">رصد الدرجات</button>';
 panel.innerHTML=teacherPageToolbar(title,extras)+(page==='attendance'?`<div class="card session-picker"><label for="attendance-session">اختر الحصة</label><select id="attendance-session">${(identity.sessions || []).map(s=>`<option value="${e(s.id)}" ${s.id===activeSession?'selected':''}>${e(groupName(s.group_id))} · ${e(s.session_date)}</option>`).join('') || '<option value="">لا توجد حصص متاحة</option>'}</select></div>`:'')+'<div id="teacher-resource-content"></div>';
 panel.querySelector('#refresh').onclick=()=>openWorkspace().catch(handleFailure);
 const openResource=resource=>{if(!can(resource))return;selected=resource;teacherView={};loadPage();};
 for(const [id,resource] of [['open-collections','collections'],['open-messages','messages'],['quiz-settings','quizzes'],['quiz-grades','grades']])panel.querySelector('#'+id)?.addEventListener('click',()=>openResource(resource));
 panel.querySelector('#new-quiz')?.addEventListener('click',()=>editRecord(undefined,'quizzes'));
 panel.querySelector('#assistant-quiz-select')?.addEventListener('change',event=>{activeQuiz=event.target.value;loadPage();});
 panel.querySelector('#attendance-session')?.addEventListener('change',event=>{activeSession=event.target.value;teacherView={};loadPage();});
 const target=panel.querySelector('#teacher-resource-content');
 const redraw=()=>{if(isCurrent())renderTeacherContent(panel,page,result,isCurrent);};
 const find=id=>pageRows.find(r=>r.id===id || r.student_id===id);
 const edit=id=>{const row=find(id);if(row && can(page,'edit'))editRecord(row);};
 const handlers={canNavigate:route=>assistantCanNavigate(identity.permissions,route),navigate:([route])=>window.centrlyApp.navigate(route),refreshHomeworkReview:()=>openWorkspace().catch(handleFailure),
  filterMaterialsByGroup:(_args,element)=>{teacherView.group=element.value;redraw();},
  filterHomeworkSubmissionsByGroup:(_args,element)=>{teacherView.group=element.value;redraw();},
  onSelectHomeworkAssignment:(_args,element)=>{teacherView.assignment=element.value;redraw();},
  switchHomeworkSubTab:([tab])=>{teacherView.subTab=tab;redraw();},
  filterCalendarByGroup:(_args,element)=>{teacherView.group=element.value;redraw();},
  switchCalendarView:([view])=>{teacherView.calendarView=view;redraw();},
  selectCalendarDay:([day])=>{teacherView.selectedDay=day;redraw();},
  calendarNext:()=>{teacherView.weekOffset=(teacherView.weekOffset || 0)+1;redraw();},
  calendarPrev:()=>{teacherView.weekOffset=(teacherView.weekOffset || 0)-1;redraw();},
  calendarToday:()=>{teacherView.weekOffset=0;redraw();},
  filterStudentsTable:()=>{const group=target.querySelector('#studentGroupFilter')?.value || '',search=target.querySelector('input[type=search],#studentSearchInput')?.value?.trim().toLocaleLowerCase() || '';for(const row of target.querySelectorAll('tbody tr'))row.hidden=!!((group && !row.textContent.includes(group)) || (search && !row.textContent.toLocaleLowerCase().includes(search)));},
  viewGroupDetails:([id])=>{const row=find(id);if(!row)return;document.getElementById('editor-title').textContent=row.name;document.getElementById('editor-fields').innerHTML=`<p>${e(row.subject || '')}</p><p>${e(row.day_of_week || '')} ${e(row.session_time || '')}</p>`;document.getElementById('record-form').querySelector('[type=submit]').hidden=true;document.getElementById('record-form').onsubmit=event=>event.preventDefault();dialog.showModal();},
  startSessionForGroup:([id])=>{if(!can('attendance'))return;const session=identity.sessions?.find(s=>s.group_id===id);if(session){activeSession=session.id;window.centrlyApp.navigate('sessions');}else notice('لا توجد حصة مسجلة لهذه المجموعة؛ تواصل مع المدرس.');},
  resetActiveSession:()=>{activeSession=null;loadPage();},
  selectQuizNumber:([number])=>{const choices=page==='quizzes'?pageRows:gradeChoices,current=choices.find(q=>q.id===activeQuiz) || choices[0],quiz=choices.find(q=>q.quiz_number===Number(number) && q.group_id===current?.group_id);if(quiz){activeQuiz=quiz.id;loadPage();}},
  switchQuizGroup:(_args,element)=>{const quiz=(page==='quizzes'?pageRows:gradeChoices).find(q=>q.group_id===element.value);if(quiz){activeQuiz=quiz.id;loadPage();}},
 };
 if(page==='groups' && can('groups','create'))handlers.openCreateGroupModal=()=>editRecord();
 if(page==='groups' && can('groups','edit'))handlers.openEditGroupModal=([id])=>edit(id);
 if(page==='students' && can('students','create'))handlers.openAddStudentModal=()=>editRecord();
 if(page==='students' && can('students','edit')){handlers.editStudent=([id])=>edit(id);handlers.openParentNoteModal=([id])=>edit(id);}
 if(page==='materials' && can('materials','create')){handlers.openAddMaterialModal=()=>editRecord();handlers.openAddHomeworkModal=()=>editRecord();}
 if(page==='homework' && can('homework','edit')){handlers.approveHomeworkSubmission=([id])=>edit(id);handlers.promptRejectHomework=([id])=>edit(id);}
 if(page==='attendance' && can('attendance','edit')){handlers.toggleStudentAttendance=([id],element)=>{const row=find(id);if(row)saveAttendance(row,!row.attended,element);};handlers.openStudentNoteModal=([id])=>edit(id);handlers.onStudentScanInput=()=>{};}
 if(page==='grades' && can('grades','edit')){handlers.updateStudentQuizScore=([id],element)=>{const row=find(id);if(row)saveInline(row,{score:element.value===''?NaN:Number(element.value)});};handlers.updateStudentQuizNote=([id],element)=>{const row=find(id);if(row)saveInline(row,{note:element.value});};}
 if(!can('attendance'))delete handlers.startSessionForGroup;
 if(page==='students')window.centrlyApp.students=pageRows;
 mountTeacherPage(target,html,handlers);
 if(page==='attendance' && can('attendance','edit')){
  const scan=target.querySelector('#scanStudentCode'),form=scan?.closest('form');
  form?.querySelectorAll('button[type=submit]').forEach(button=>button.disabled=false);
  if(form)form.onsubmit=event=>{event.preventDefault();const value=scan.value.trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)),row=pageRows.find(r=>String(r.student_code)===value || r.student_name===value);if(!row){notice('الطالب غير موجود في كشف هذه الحصة');return;}saveAttendance(row,true,form.querySelector('button[type=submit]')).then(()=>{if(scan.isConnected)scan.value='';});};
 }
 target.querySelectorAll('[data-assistant-file]').forEach(button=>button.onclick=()=>openHomeworkFile(button,button.dataset.assistantFile));
 if(page==='homework')target.querySelectorAll('[aria-disabled=true]').forEach(element=>{if(element.textContent.includes('لم يسلم') || element.textContent.includes('المتأخرون'))element.title='متابعة غير المسلّمين متاحة من تقرير متابعة الطالب';});
 if(page==='materials' && can('materials','edit'))target.insertAdjacentHTML('beforeend',`<div class="assistant-record-actions">${pageRows.map(row=>`<button type="button" class="btn btn-secondary" data-edit-material="${e(row.id)}">تعديل ${e(row.title)}</button>`).join('')}</div>`);
 target.querySelectorAll('[data-edit-material]').forEach(button=>button.onclick=()=>edit(button.dataset.editMaterial));
 if(page==='quizzes' && can('quizzes','edit'))target.insertAdjacentHTML('beforeend',`<div class="assistant-record-actions">${pageRows.map(row=>`<button type="button" class="btn btn-secondary" data-edit-quiz="${e(row.id)}">تعديل ${e(row.title)}</button>`).join('')}</div>`);
 target.querySelectorAll('[data-edit-quiz]').forEach(button=>button.onclick=()=>edit(button.dataset.editQuiz));
}
async function saveAttendance(row,attended,button){if(!can('attendance','edit'))return;if(button)button.disabled=true;try{await api('/data/attendance/edit',{student_id:row.student_id,session_id:row.session_id,attended,homework_status:row.homework_status || 'missing',comment:row.comment || ''});notice('تم حفظ الحضور');await loadPage();}catch(error){handleFailure(error);}finally{if(button?.isConnected)button.disabled=false;}}
async function saveInline(row,changes){if(selected!=='grades' || !can('grades','edit'))return;const data={quiz_id:row.quiz_id,student_id:row.student_id,score:row.score,note:row.note || '',...changes};if(!Number.isFinite(data.score) || data.score<0 || data.score>row.max_score){notice('اكتب درجة صحيحة بين صفر والدرجة النهائية');return;}try{await api('/data/grades/edit',data);notice('تم حفظ الدرجة');await loadPage();}catch(error){handleFailure(error);}}
async function openHomeworkFile(button,id){button.disabled=true;try{const result=await api(`/files/${id}`);if(!button.isConnected || !identity)return;const link=document.createElement('a');link.href=result.url;link.target='_blank';link.rel='noopener noreferrer';link.textContent='فتح ملف الواجب';link.className='btn btn-secondary';button.replaceWith(link);link.focus();}catch(error){handleFailure(error);button.disabled=false;}}

function input(key,label,type='text',value='',extra=''){
 return `<div class="field"><label for="edit-${key}">${label}</label><input id="edit-${key}" name="${key}" type="${type}" value="${e(value ?? '')}" ${extra}></div>`;
}
function select(key,label,options,value){return `<div class="field"><label for="edit-${key}">${label}</label><select id="edit-${key}" name="${key}">${options.map(([v,l])=>`<option value="${e(v)}" ${String(v)===String(value)?'selected':''}>${e(l)}</option>`).join('')}</select></div>`;}
function editRecord(row,page=selected){
 const create=!row;if(!can(page,create?'create':'edit')){notice('هذه العملية غير متاحة ضمن صلاحياتك');return;}row ||= {};
 document.getElementById('record-form').querySelector('[type=submit]').hidden=false;
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
