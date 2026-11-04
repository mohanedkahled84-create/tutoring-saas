import {escapeHtml} from '../utils/escapeHtml.js?v=9.43.0';
import {getIcon} from '../utils/icons.js?v=9.43.0';

export function pendingAttendance(summary,students=[]){
 if(!summary)return null;
 return (summary.sessions || []).reduce((total,session)=>{
  const recorded=new Set(session.recorded_student_ids || []);
  const expected=new Set(students.filter(student=>student.group_id===session.group_id || student.group_ids?.includes(session.group_id)).map(student=>student.id));
  return total+[...expected].filter(id=>!recorded.has(id)).length;
 },0);
}
export function todayGroups(groups=[],now=new Date()){
 const day=new Intl.DateTimeFormat('ar-EG',{weekday:'long',timeZone:'Africa/Cairo'}).format(now);
 const normalize=value=>String(value || '').replace(/[أإآ]/g,'ا').replace(/\s+/g,'');
 return groups.filter(group=>normalize(group.day_of_week || group.schedule).includes(normalize(day)));
}
export function renderTeacherActions(data={}){
 const app=typeof window!=='undefined'?window.centrlyApp:null;
 const summary=data.actionSummary,missing=pendingAttendance(summary,data.students || []);
 const available=route=>!app?.delegation || app.delegation.canNavigate(route);
 const actions=[
  {label:'مجموعات اليوم',count:todayGroups(data.groups).length,description:'افتح لوحة الحصص وابدأ المجموعة المطلوبة',route:'sessions',icon:'sessions'},
  {label:'واجبات تنتظر المراجعة',count:summary?.pending_homework,description:'راجع التسليمات واعتمدها أو أعدها للطالب',route:'homework',icon:'homework'},
  {label:'حضور يحتاج رصدًا',count:missing,description:'سجلات لم تُرصد في حصص اليوم المفتوحة',route:'sessions',icon:'students'},
  {label:'طلاب يحتاجون متابعة',count:(data.atRiskStudents || []).length,description:'راجع مؤشرات الغياب والدرجات والواجبات',route:'risk-watchlist',icon:'alertTriangle'},
 ];
 return `<section class="teacher-actions" aria-labelledby="teacher-actions-title"><div class="teacher-actions-heading"><div><span>شغلك اليوم</span><h2 id="teacher-actions-title">محتاج إجراء</h2></div>${data.actionSummaryError?'<button class="btn btn-secondary" onclick="window.centrlyApp.retryDashboardActions()">إعادة المحاولة</button>':''}</div>${data.actionSummaryError?'<p role="status" class="teacher-actions-error">تعذر تحميل حالة الواجبات والحضور. باقي بيانات اللوحة متاحة.</p>':''}<div class="teacher-actions-grid">${actions.map(action=>`<button class="teacher-action" onclick="window.centrlyApp.navigate('${action.route}')" ${available(action.route)?'':'disabled aria-disabled="true" title="غير متاح ضمن صلاحياتك"'}><span class="teacher-action-icon" aria-hidden="true">${getIcon(action.icon,20)}</span><span class="teacher-action-copy"><strong>${escapeHtml(action.label)}</strong><small>${escapeHtml(action.description)}</small></span><span class="teacher-action-count">${action.count===undefined || action.count===null?'—':Number(action.count).toLocaleString('ar-EG')}</span></button>`).join('')}</div></section>`;
}
