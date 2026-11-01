import {escapeHtml as e} from '../utils/escapeHtml.js';
import {getIcon} from '../utils/icons.js';

// Use the teacher's actual renderers with scoped data. Never register the
// teacher action handlers: those use owner endpoints and owner credentials.
const loaders={
 groups:()=>import('./GroupsView.js'), students:()=>import('./StudentsView.js'),
 attendance:()=>import('./SessionsView.js?v=2.0.0'), sessions:()=>import('./TeacherCalendar.js'),
 materials:()=>import('./MaterialsView.js'), homework:()=>import('./HomeworkReviewView.js?v=4.0.3'),
 quizzes:()=>import('./TeacherQuizzesView.js?v=9.12.0'), grades:()=>import('./TeacherQuizzesView.js?v=9.12.0'),
};
export async function teacherPageHtml(resource,rows,identity,options={}) {
 const module=await loaders[resource]?.();
 const user={role:'assistant',name:identity.name},groups=identity.groups || [];
 if(resource==='groups')return module.renderGroupsView(rows,user);
 if(resource==='students')return module.renderStudentsView(rows,groups,false,{},true);
 if(resource==='materials')return module.renderMaterialsView(rows,groups,options.group || 'all');
 if(resource==='sessions')return module.renderTeacherCalendar({sessions:rows.map(s=>({...s,date:s.session_date,time:s.start_time || groups.find(g=>g.id===s.group_id)?.session_time || '—',day_name:new Date(s.session_date+'T12:00:00').toLocaleDateString('ar-EG',{weekday:'long'}),group_name:groups.find(g=>g.id===s.group_id)?.name || 'المجموعة'})),groups,view:options.calendarView || 'week',weekOffset:options.weekOffset || 0,selectedDayName:options.selectedDay,selectedGroup:options.group || 'all',dateLabel:new Date().toLocaleDateString('ar-EG',{month:'long',year:'numeric'})});
 if(resource==='attendance')return module.renderSessionsView(options.session?{
  ...options.session,
  group:groups.find(g=>g.id===rows[0]?.group_id) || groups.find(g=>g.id===identity.sessions.find(s=>s.id===options.sessionId)?.group_id),
  attendanceList:rows.map(r=>({...r,id:r.student_id,name:r.student_name,code:r.student_code,homework:r.homework_status})),
 }: {},user,groups);
 if(resource==='homework'){
  const assignments=[...new Map(rows.map(r=>[r.material_id,{id:r.material_id,title:r.title || 'واجب دراسي',group_id:r.group_id}])).values()];
  const assignment=assignments.find(a=>a.id===options.assignment) || assignments[0];
  return module.renderHomeworkReviewView({assignments,currentHomework:assignment,groups,activeTab:'submitted',subTab:options.subTab || 'all',selectedGroupId:options.group || 'all',submitted:rows.filter(r=>r.material_id===assignment?.id && (!options.group || options.group==='all' || r.group_id===options.group)).map(r=>({...r,file_action:r.has_file?r.id:null,students:{name:r.student_name}})),missing:[],missingAvailable:false});
 }
 if(resource==='quizzes' || resource==='grades'){
  const choices=resource==='quizzes'?rows:(options.quizzes || []),current=choices.find(q=>q.id===options.quizId) || choices[0];
  const quizzes=choices.map(q=>({...q,number:q.quiz_number,maxScore:q.max_score,date:q.quiz_date,skipped:q.is_skipped}));
  const scores=Object.fromEntries(rows.map(r=>[r.student_id,r.score])),notes=Object.fromEntries(rows.map(r=>[r.student_id,r.note]));
  return module.renderTeacherQuizzesView({activeSubTab:'roster',selectedGroupId:current?.group_id || groups[0]?.id,currentQuizNumber:current?.quiz_number,quizzes,allowEmptyQuizzes:true,scoresMap:{[current?.quiz_number]:scores},notesMap:{[current?.quiz_number]:notes}},groups,resource==='grades'?rows.map(r=>({id:r.student_id,name:r.student_name,group_id:r.group_id})):[],false,true,user,'quizzes');
 }
 return '';
}

// Convert trusted component event hooks to explicit assistant callbacks before
// insertion. No eval, teacher handlers, or accidental owner API fallbacks.
export function mountTeacherPage(panel,html,handlers) {
 const template=document.createElement('template');template.innerHTML=html;
 for(const form of template.content.querySelectorAll('form')){form.addEventListener('submit',event=>event.preventDefault());form.querySelectorAll('button[type=submit],input[type=submit]').forEach(button=>button.disabled=true);}
 for(const element of template.content.querySelectorAll('*')){
  for(const attribute of [...element.attributes]){
   if(!attribute.name.startsWith('on'))continue;
   element.removeAttribute(attribute.name);
   if(!['onclick','onchange','oninput'].includes(attribute.name))continue;
   const method=attribute.value.match(/(?:window\.)?centrlyApp\.([A-Za-z0-9_]+)\(/)?.[1];
   const handler=method && handlers[method];
   if(!handler){lockControl(element);continue;}
   const args=[...attribute.value.matchAll(/'([^']*)'/g)].map(match=>match[1]);
   if(method==='navigate' && handlers.canNavigate && !handlers.canNavigate(args[0])){lockControl(element);continue;}
   if(!args.length){const number=attribute.value.match(/\((\d+)\)/)?.[1];if(number)args.push(number);}
   element.addEventListener(attribute.name.slice(2),event=>{event.preventDefault();handler(args,element,event);});
  }
  if(element.matches('a')){
   const href=element.getAttribute('href') || '';
   if(!/^https:\/\//i.test(href))lockControl(element);
   else{element.target='_blank';element.rel='noopener noreferrer';}
  }
 }
 panel.replaceChildren(template.content);
}
export function lockControl(element){
 element.removeAttribute('onclick');element.removeAttribute('onchange');element.removeAttribute('oninput');
 element.setAttribute('aria-disabled','true');element.title='غير متاح ضمن صلاحياتك';
 if(element.matches('a')){element.removeAttribute('href');element.tabIndex=-1;}
 else element.disabled=true;
}
export function teacherPageToolbar(title,extras=''){
 return `<div class="assistant-page-heading"><div><span class="assistant-context">حساب المدرس</span><h1>${e(title)}</h1></div><div class="actions">${extras}<button id="refresh" class="btn btn-secondary" type="button" aria-label="تحديث بيانات الصفحة">${getIcon('refresh',18)}</button></div></div>`;
}
