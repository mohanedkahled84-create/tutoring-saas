import {localize} from '../utils/language.js?v=9.92.0';
import {renderCommercialWallet} from './CommercialBillingView.js?v=9.92.2';
import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.46.0';
import {request} from '../services/api.js?v=9.46.0';
const statuses=()=>({draft:localize("مسودة", "Draft"),published:localize("منشور", "Published"),archived:localize("مؤرشف", "Archived"),queued:localize("في الانتظار", "Queued"),sending:localize("جار الإرسال", "Sending"),sent:localize("تم الإرسال", "Sent"),delivered:localize("تم التسليم", "Delivered"),read:localize("تمت القراءة", "Read"),failed:localize("لم يصل", "Failed"),unknown:localize("نتيجة غير مؤكدة", "Unconfirmed"),skipped:localize("لم يُرسل", "Not sent")});
const requestStates=()=>({submitted:localize("وصل طلبك", "Request received"),reviewing:localize("قيد المراجعة", "Under review"),meta_pending:localize("بانتظار اعتماد واتساب", "Awaiting WhatsApp approval"),available:localize("متاح", "Available"),rejected:localize("يحتاج تعديلًا", "Changes needed")});
// Translate only the system's known catalog labels; preserve administrator-authored text.
const catalogEnglish={
 'تغيير موعد حصة':'Reschedule a class','إلغاء حصة':'Cancel a class','تغيير مكان الحصة':'Change class location',
 'محتوى دراسي جديد':'New study material','واجب جديد':'New homework','تغيير موعد تسليم واجب':'Change a homework deadline',
 'موعد اختبار':'Exam schedule','رصد نتائج اختبار':'Exam results','تذكير بموعد حصة':'Class reminder',
 'حصة إضافية أو تعويضية':'Additional or make-up class','تذكير بموعد واجب':'Homework reminder','توقف الحصص واستئنافها':'Class break and resumption',
 'اسم الحصة':'Class name','الموعد السابق':'Previous time','الموعد الجديد':'New time','موعد الحصة الملغاة':'Cancelled class time',
 'موعد الحصة أو الاختبار':'Class or exam time','المكان السابق':'Previous location','المكان أو رابط الحضور':'Location or attendance link',
 'نوع المحتوى':'Content type','اسم المحتوى':'Content title','عنوان الواجب':'Homework title','موعد التسليم':'Due date',
 'موعد التسليم السابق':'Previous due date','موعد التسليم الجديد':'New due date','عنوان الاختبار':'Exam title','تاريخ الاختبار':'Exam date',
 'نوع الحصة':'Class type','بداية توقف الحصص':'Break starts','استئناف الدراسة':'Classes resume',
 'فيديو شرح':'Lesson video','مذكرة':'Study material','ملف تدريبي':'Practice file','إضافية':'Additional','تعويضية':'Make-up'
};
const catalogText=value=>localize(value,catalogEnglish[value] || value);
const weekdays=['الأحد','الإثنين','الثلاثاء','الأربعاء','الخميس','الجمعة','السبت'];
const normalizeDay=day=>day?.trim().replace(/[أإآ]/g,'ا');
const groupDaysFor=group=>String(group?.day_of_week || '').split(/[،,]/).map(normalizeDay);
function savedSessionTime(row,groups){
 const group=groups.find(g=>g.id===row.group_id);
 // Multiple weekly times cannot be safely guessed from a date alone.
 const date=row.rescheduled_to_date || row.session_date;
 const day=weekdays[new Date(date+'T12:00:00Z').getUTCDay()];
 const groupDays=groupDaysFor(group);
 const groupTimes=String(group?.session_time || '').split('/').map(value=>value.trim());
 const groupTime=groupTimes.length===1?groupTimes[0]:groupTimes[groupDays.indexOf(normalizeDay(day))];
 const candidates=[row.rescheduled_to_time,row.session_time,row.start_time,groupTime];
 for(const candidate of candidates){
  const text=String(candidate || '').trim().replace(/[٠-٩]/g,c=>String(c.charCodeAt(0)-1632)).replace(/[۰-۹]/g,c=>String(c.charCodeAt(0)-1776)).toLowerCase();
  const match=text.match(/^(\d{1,2}):(\d{2})(?::\d{2})?\s*(ص|م|am|pm)?$/);if(!match)continue;
  let hour=Number(match[1]);const minute=Number(match[2]);if(minute>59)continue;
  if(match[3]){if(hour<1 || hour>12)continue;hour=hour%12+(['م','pm'].includes(match[3])?12:0);}else if(hour>23)continue;
  return `${String(hour).padStart(2,'0')}:${String(minute).padStart(2,'0')}`;
 }
 return null;
}
const classTime={class_cancelled:'cancelled_time',class_rescheduled:'old_time',class_reminder:'event_time'};
export function announcementClasses(rows,groups,today){
 const saved=rows.flatMap(row=>{
  const group=groups.find(group=>group.id===row.group_id && !group.archived_at);
  const date=row.rescheduled_to_date || row.session_date;
  const time=savedSessionTime(row,groups);
  if(!row.id || !group || !time || !/^\d{4}-\d{2}-\d{2}$/.test(date || ''))return [];
  return [{id:row.id,groupId:group.id,topic:row.extra_topic || group.name,datetime:date+'T'+time}];
 });
 if(!today)return saved;
 const start=Date.parse(today+'T12:00:00Z');
 const occupied=new Set(rows.filter(row=>!row.is_extra).flatMap(row=>[
  row.group_id+'|'+row.session_date,
  row.group_id+'|'+row.rescheduled_to_date,
 ]));
 const scheduled=[];
 for(const group of groups.filter(group=>!group.archived_at)){
  const days=groupDaysFor(group);
  for(let offset=0;offset<28;offset++){
   const slot=new Date(start+offset*86400000);
   if(!days.includes(normalizeDay(weekdays[slot.getUTCDay()])))continue;
   const date=slot.toISOString().slice(0,10);
   const key=group.id+'|'+date;
   if(occupied.has(key))continue;
   const time=savedSessionTime({group_id:group.id,session_date:date},[group]);
   if(time)scheduled.push({id:'schedule:'+key,groupId:group.id,topic:group.name,datetime:date+'T'+time});
  }
 }
 return [...saved,...scheduled].sort((a,b)=>a.datetime.localeCompare(b.datetime));
}
const automatic=new Set(['teacher','group','portal','contact']);
const actor=app=>[app.user?.id,app.delegation?.actor?.id || app.delegation?.assistant_id || '',app.user?.tenant_id].join(':');
const can=(app,action)=>!app.delegation || app.delegation.permissions?.['announcements.'+action]===true;
const button=(label,method,primary=false)=>`<button type="button" class="btn ${primary?'btn-primary':'btn-secondary'}" style="min-height:44px" onclick="window.centrlyApp.${method}">${label}</button>`;
export function renderSourceAnnouncementButton(kind,id,app=globalThis.window?.centrlyApp){
 if(!['material','session'].includes(kind) || !/^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i.test(id || '') || !can(app || {},'create'))return '';
 return `<button type="button" class="btn btn-secondary" style="min-height:44px;max-width:100%;white-space:normal" onclick="window.centrlyApp.openSourceAnnouncement('${kind}','${e(id)}')">${localize('إبلاغ الطلاب وأولياء الأمور','Notify students and parents')}</button>`;
}
export function cairoAnnouncementExpiry(value){
 const date=new Date(value+'T23:59:59Z');
 for(let i=0;i<3;i++){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));const shown=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));date.setTime(date.getTime()+Date.parse(value+'T23:59:59Z')-shown);}
 return date.toISOString();
}
const money=value=>Number(value).toLocaleString(localize('ar-EG','en-EG'),{maximumFractionDigits:4})+localize(' ج.م',' EGP');
export function renderAnnouncementsView(data={},app={}){
 return `<div style="display:grid;gap:1rem;min-width:0"><section class="card announcements-intro" style="margin:0"><p style="font-size:.85rem">${localize("تواصل واضح مع طلابك وأولياء الأمور", "Stay in touch with students and parents")}</p><div class="announcements-heading"><h1 style="font-size:1.6rem">${localize("الرسائل والإعلانات", "Messages and announcements")}</h1>${renderCommercialWallet(data.wallet)}</div><p>${localize("غيّر موعد حصة، انشر محتوى جديدًا، أو ذكّر مجموعاتك بموعد مهم.", "Share class changes, new materials, and reminders with your groups.")}</p><div style="display:flex;gap:.6rem;flex-wrap:wrap">${can(app,'create')?button(localize("إعلان جديد", "New announcement"),'openAnnouncement()',true)+button(localize('إعلان عن حصة','Announce a class'),'openAnnouncementSessionPicker()')+button(localize("طلب نوع رسالة جديد", "Request a message type"),'openAnnouncementTypeRequest()'):''}${button(localize("تحديث القائمة", "Refresh"),"loadRouteData('announcements')")}</div></section><section class="card" style="margin:0"><h2 style="font-size:1.15rem">${localize("إعلاناتي", "My announcements")}</h2><div style="display:grid;gap:.75rem">${(data.announcements || []).map(row=>`<article style="border:1px solid var(--centrly-line);border-radius:14px;padding:1rem;min-width:0;overflow-wrap:anywhere"><div style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;gap:.5rem"><strong>${e(row.title)}</strong><p>${localize('المستلمون','Recipients')}: ${e((row.recipient_roles || ['parent','student']).map(role=>role==='parent'?localize('ولي الأمر','Parent'):localize('الطالب','Student')).join(localize('، ', ', ')))}</p><span>${e(statuses()[row.status])}</span></div><p>${e(catalogText((data.catalog || []).find(t=>t.key===row.type_key)?.title || localize('إعلان مخصص','Custom announcement')))} · ${row.group_ids.length} ${localize('مجموعة','groups')}</p><p>${Object.entries(row.delivery || {}).map(([s,n])=>e(statuses()[s] || s)+': '+Number(n)).join(' · ')}</p>${button(localize('فتح الإعلان','Open announcement'),`openAnnouncement('${e(row.id)}')`)}</article>`).join('') || `<p>${localize('ابدأ بإعلان لمجموعاتك، وراجع نصه قبل النشر أو الإرسال.','Create an announcement for your groups, and review it before publishing or sending.')}</p>`}</div></section>${data.requests?.length?`<section class="card" style="margin:0"><h2 style="font-size:1.15rem">${localize('طلبات أنواع الرسائل','Message type requests')}</h2>${data.requests.map(row=>`<article style="border-top:1px solid var(--centrly-line);padding:.75rem 0;overflow-wrap:anywhere"><strong>${e(row.title)}</strong><p>${e(requestStates()[row.status])}</p>${row.admin_notes?`<p>${e(row.admin_notes)}</p>`:''}</article>`).join('')}</section>`:''}</div>`;
}
function fields(type,values={},locked={}){
 return (type?.fields || []).filter(field=>!automatic.has(field.type)).map(field=>`<label style="display:grid;gap:.4rem">${e(catalogText(field.label))}${field.type==='choice'?`<select class="form-select" style="min-height:44px" data-ann-field="${e(field.key)}" ${Object.hasOwn(locked,field.key)?'disabled':''} required><option value="">${localize('اختر','Select')}</option>${field.options.map(v=>`<option value="${e(v)}" ${values[field.key]===v?'selected':''}>${e(catalogText(v))}</option>`).join('')}</select>`:`<input class="form-input" style="min-height:44px" data-ann-field="${e(field.key)}" type="${field.type==='date'?'date':field.type==='datetime'?'datetime-local':'text'}" maxlength="160" value="${e(values[field.key] || '')}" ${Object.hasOwn(locked,field.key)?'readonly':''} required>`}</label>`).join('');
}
export function registerAnnouncementsActions(app){
 app.openAnnouncementSessionPicker=async function(){
  if(!can(this,'create'))return;
  this.showModal(localize("اختر الحصة","Choose a class"),'<div class="skeleton" style="height:3rem" role="status" aria-label="'+ localize("جار تحميل الحصص","Loading classes") +'"></div>');
  const identity=actor(this);
  try{
   const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
   const range=days=>new Date(Date.parse(today+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
   const {sessions}=await request('/sessions?from='+range(-30)+'&to='+range(90));
   if(actor(this)!==identity || window.centrlyApp!==this)return;
   const options=(sessions || []).filter(session=>session.id && !session.is_virtual).map(session=>{
    const group=session.group_name || this.groups?.find(group=>group.id===session.group_id)?.name || localize("حصة","Class");
    const label=[group,session.extra_topic,session.rescheduled_to_date || session.session_date,session.rescheduled_to_time || session.session_time].filter(Boolean).join(' · ');
    return `<option value="${e(session.id)}">${e(label)}</option>`;
   }).join('');
   this.showModal(localize("اختر الحصة","Choose a class"),options
    ?'<form onsubmit="event.preventDefault();window.centrlyApp.openSourceAnnouncement(\'session\',this.elements.session.value)" style="display:grid;gap:.75rem"><label>${localize("الحصة","Class")}<select name="session" class="form-select" required><option value="">${localize("اختر من الحصص المحفوظة","Select a saved class")}</option>'+options+'</select></label><button class="btn btn-primary" type="submit">${localize("اختيار الحصة","Use this class")}</button></form>'
    :'<p>'+ localize("مفيش حصص محفوظة متاحة في الفترة الحالية.","No saved classes are available in this period.") +'</p>');
  }catch(error){if(actor(this)===identity)this.showModal(localize("تعذر تحميل الحصص","Could not load classes"),`<p role="alert">${e(error.message)}</p>`);}
 };
 app.openSourceAnnouncement=async function(kind,id){
  if(!can(this,'create'))return;
  const identity=actor(this);this.showModal(localize("مسودة الإبلاغ","Notification draft"),'<p role="status">' + localize('جار قراءة التفاصيل المحفوظة…','Loading saved details…') + '</p>');
  try{
   const [seed,catalog,groupData]=await Promise.all([request('/announcements/source',{method:'POST',body:{kind,id}}),request('/announcements'),request('/groups')]);
   if(actor(this)!==identity)return;this.announcementsData=catalog;this.groups=Array.isArray(groupData)?groupData:groupData.groups || [];
   await this.openAnnouncement(null,{...seed,source_values:seed.values,source_group_ids:seed.group_ids});
  }catch(error){if(actor(this)===identity)this.showModal(localize("تعذر تجهيز الإبلاغ","Could not prepare the notification"),`<p role="alert">${e(error.message)}</p>`);}
 };
 app.openAnnouncement=async function(id,seed=null){
  const identity=actor(this);this._announcementPreview=null;
  try{
   const data=id?await request('/announcements/'+encodeURIComponent(id)):{announcement:{id:crypto.randomUUID(),title:'',type_key:this.announcementsData?.catalog?.[0]?.key || null,group_ids:[],recipient_roles:['student','parent'],values:{},publish_on_portal:true,status:'draft',...(seed || {})},deliveries:[]};
   if(actor(this)!==identity || window.centrlyApp!==this)return;
   this._announcement=data.announcement;const ann=data.announcement,types=this.announcementsData?.catalog || [],editable=can(this,id?'edit':'create'),type=types.find(t=>t.key===ann.type_key);
   this.showModal(id?localize("إعلان مجموعاتك","Group announcement"):localize("إعلان جديد","New announcement"),`<div style="display:grid;gap:1rem">${ann.source_event_id?'<p>'+ localize("هذه المسودة مرتبطة بحصة أو محتوى محفوظ. التفاصيل المرتبطة تُعدّل من المصدر أولًا، ولا تُرسل أي رسالة بمجرد الحفظ.","This draft is linked to a saved class or material. Edit linked details at the source. Saving does not send any messages.") +'</p>':''}<form id="announcementForm" novalidate onsubmit="window.centrlyApp.saveAnnouncement(event)" style="display:grid;gap:1rem;min-width:0"><style>#announcementForm [aria-invalid=true]{outline:2px solid var(--centrly-danger,#b91c1c);outline-offset:2px}</style><fieldset ${editable?'':'disabled'} style="display:grid;gap:1rem;min-width:0;border:0;padding:0"><label>${localize("عنوان الإعلان","Announcement title")}<input id="annTitle" class="form-input" maxlength="160" value="${e(ann.title)}" required></label><label>${localize("نوع الرسالة","Message type")}<select ${ann.source_event_id?'disabled':''} id="annType" class="form-select" style="min-height:44px" onchange="window.centrlyApp.changeAnnouncementType(this.value)"><option value="">${localize('إعلان مخصص داخل المنصة وواتساب اليدوي','Custom announcement for the portal and manual WhatsApp')}</option>${types.map(t=>`<option value="${e(t.key)}" ${ann.type_key===t.key?'selected':''}>${e(catalogText(t.title))}</option>`).join('')}</select></label><div id="annClassPicker"></div><div id="annFields" style="display:grid;gap:1rem">${fields(type,ann.values,ann.source_values || {})}</div><label>${localize('نص مخصص للنشر وواتساب اليدوي فقط','Custom text for the portal and manual WhatsApp')}<textarea id="annManual" class="form-input" rows="3" maxlength="4000">${e(ann.manual_body || '')}</textarea></label><p style="font-size:.85rem;line-height:1.8">${localize('الإرسال الرسمي يستخدم نص النوع المعتمد والحقول المحددة. النص المخصص يُستخدم داخل المنصة وواتساب اليدوي.','Official sending uses the approved template. Custom text is used in the portal and for manual WhatsApp.')}</p><fieldset style="border:1px solid var(--centrly-line);border-radius:12px;min-width:0"><legend>${localize("المجموعات","Groups")}</legend><div style="max-height:200px;overflow:auto">${(this.groups || []).filter(g=>(!g.archived_at || ann.group_ids.includes(g.id)) && (!ann.source_event_id || !Array.isArray(ann.source_group_ids) || ann.source_group_ids.includes(g.id))).map(g=>`<label style="display:flex;gap:.5rem;align-items:center;min-height:44px"><input name="annGroup" type="checkbox" value="${e(g.id)}" ${ann.group_ids.includes(g.id)?'checked':''}>${e(g.name)}</label>`).join('') || '<p>'+ localize("أضف مجموعة أولًا من مجاميعي الدراسية.","Add a group first.") +'</p>'}</div></fieldset><fieldset style="border:0;padding:0"><legend>${localize("من سيشاهد الإعلان؟","Who can see this announcement?")}</legend>${[['student',localize("الطلاب","Students")],['parent',localize("أولياء الأمور","Parents")]].map(([role,label])=>`<label style="display:inline-flex;gap:.5rem;align-items:center;min-height:44px;margin-inline-end:1rem"><input name="annRole" type="checkbox" value="${role}" ${ann.recipient_roles.includes(role)?'checked':''}>${label}</label>`).join('')}</fieldset><label style="display:flex;gap:.5rem;align-items:center;min-height:44px"><input id="annPortal" type="checkbox" ${ann.publish_on_portal?'checked':''}>${localize("يظهر في بوابة الطالب وولي الأمر بعد النشر","Show in student and parent portals after publication")}</label><label>${localize('ينتهي ظهوره في المنصة يوم','Hide from the portal on')} <input id="annExpiry" type="date" class="form-input" value="${e(ann.expires_at?new Date(ann.expires_at).toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'}):'')}"></label></fieldset><div style="position:sticky;bottom:0;z-index:1;background:var(--centrly-surface,#fff);display:flex;flex-wrap:wrap;gap:.5rem;padding:.5rem 0">${editable&&ann.status==='draft'?'<button type="submit" value="publish" class="btn btn-primary" style="min-height:44px">'+ localize("نشر","Publish") +'</button><button type="submit" value="draft" class="btn btn-secondary" style="min-height:44px">'+ localize("حفظ المسودة","Save draft") +'</button>':editable?'<button type="submit" class="btn btn-primary" style="min-height:44px">'+ localize("حفظ التعديلات","Save changes") +'</button>':''}</div></form>${id?`<section style="display:flex;flex-wrap:wrap;gap:.5rem">${ann.status==='published' && can(this,'send')?button(localize("معاينة المستلمين والإرسال","Review recipients and send"),'previewAnnouncement()',true):''}${can(this,'send')?button(localize("إلغاء الرسائل المنتظرة","Cancel queued messages"),"announcementAction('cancel')") :''}${ann.status!=='archived' && can(this,'delete')?button(localize("أرشفة الإعلان","Archive announcement"),"announcementAction('archive')") :''}</section><section><h3 style="font-size:1rem">${localize("متابعة الإرسال","Delivery status")}</h3><p>${localize("الحالة غير المؤكدة لا يعاد إرسالها تلقائيًا. الرسائل المرسلة تظل في السجل عند إلغاء المنتظر.","Messages with an unconfirmed status are not retried automatically. Sent messages remain in the history when queued messages are cancelled.")}</p><div style="max-height:260px;overflow:auto">${data.deliveries.map(row=>`<p><bdi>${e(row.phone)}</bdi> · ${e(statuses()[row.status])} · ${row.attempts} ${localize('محاولة','attempts')}</p>`).join('') || '<p>'+ localize("لا توجد رسائل رسمية لهذا الإعلان بعد.","There are no official messages for this announcement yet.") +'</p>'}</div></section>`:''}</div>`);
   if(typeof document!=='undefined')void this.setupAnnouncementClasses();
  }catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}
 };
 app.changeAnnouncementType=function(key){
  document.getElementById('annFields').innerHTML=fields(this.announcementsData?.catalog?.find(t=>t.key===key));
  void this.setupAnnouncementClasses();
 };
 app.setupAnnouncementClasses=async function(){
  const holder=document.getElementById('annClassPicker'),form=holder?.closest('form');
  if(!form)return;
  holder.replaceChildren();
  const timeField=classTime[form.querySelector('#annType').value],ann=this._announcement;
  if(!timeField || ann.source_event_id || ann.status!=='draft')return;
  const topic=form.querySelector('[data-ann-field="topic"]');
  const time=form.querySelector('[data-ann-field="'+timeField+'"]');
  for(const input of [topic,time])if(input)input.closest('label').style.display='none';
  holder.innerHTML=`<label style="display:grid;gap:.4rem">${localize('اختر الحصة','Choose a class')}<select id="annClass" class="form-select" required><option value="">${localize('جار تحميل الحصص','Loading classes')}</option></select></label><p role="status"></p>`;
  const select=holder.querySelector('select'),status=holder.querySelector('p');
  const identity=actor(this);
  try{
   const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
   const range=days=>new Date(Date.parse(today+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
   const [{sessions},groupData]=await Promise.all([request('/sessions?from='+range(-90)+'&to='+range(90)),request('/groups')]);
   if(actor(this)!==identity || !select.isConnected)return;
   const rows=announcementClasses(sessions || [],Array.isArray(groupData)?groupData:groupData.groups || [],today);
   select.options[0].textContent=localize('اختر حصة من الجدول','Select a scheduled class');
   for(const row of rows)select.add(new Option(row.topic+' · '+row.datetime.replace('T',' '),row.id));
   const saved=rows.find(row=>row.topic===topic?.value && row.datetime===time?.value);
   if(saved)select.value=saved.id;
   if(!rows.length)status.textContent=localize('لا توجد حصص بموعد واضح. راجع أيام ومواعيد الحصص في جدول المجموعة.','No classes have a scheduled time. Check the days and times in the group timetable.');
   select.addEventListener('change',()=>{
    const selected=rows.find(row=>row.id===select.value);
    if(topic)topic.value=selected?.topic || '';
    if(time)time.value=selected?.datetime || '';
    if(selected){
     for(const checkbox of form.querySelectorAll('[name=annGroup]'))checkbox.checked=checkbox.value===selected.groupId;
     const title=form.querySelector('#annTitle');
     if(!title.value.trim())title.value=localize('حصة','Class')+' · '+selected.topic;
    }
    select.removeAttribute('aria-invalid');
   });
  }catch{
   if(!select.isConnected)return;
   select.options[0].textContent=localize('تعذر تحميل الحصص','Could not load classes');
   const retry=document.createElement('button');
   retry.type='button';
   retry.className='btn btn-secondary';
   retry.textContent=localize('إعادة المحاولة','Retry');
   retry.onclick=()=>void this.setupAnnouncementClasses();
   status.replaceChildren(retry);
  }
 };
 app.saveAnnouncement=async function(event){
  event.preventDefault();const ann=this._announcement,control=event.submitter,identity=actor(this),form=event.currentTarget;
  if(this._announcementBusy)return;
  const publish=control?.value==='publish' && ann.status==='draft';
  this._announcementBusy=true;
  const controls=[...form.querySelectorAll('button[type=submit]')];
  controls.forEach(button=>button.disabled=true);
  try{
   const groups=[...document.querySelectorAll('[name=annGroup]:checked')].map(el=>el.value),roles=[...document.querySelectorAll('[name=annRole]:checked')].map(el=>el.value),expiry=document.getElementById('annExpiry').value;
   form.querySelectorAll('[aria-invalid]').forEach(field=>field.removeAttribute('aria-invalid'));
   const title=form.querySelector('#annTitle');
   const invalid=[];
   if(!title.value.trim())invalid.push(title);
   const lesson=form.querySelector('#annClass');
   if(publish && lesson && !lesson.value)invalid.push(lesson);
   if(publish)invalid.push(...[...form.querySelectorAll('[data-ann-field]:required:not(:disabled)')].filter(field=>field.closest('label').style.display!=='none' && !field.value.trim()));
   if(!groups.length)invalid.push(...form.querySelectorAll('[name=annGroup]'));
   if(!roles.length)invalid.push(...form.querySelectorAll('[name=annRole]'));
   if(invalid.length || !groups.length || !roles.length){
    invalid.forEach(field=>field.setAttribute('aria-invalid','true'));
    const first=form.querySelector('[aria-invalid=true]');
    first?.focus();
    first?.scrollIntoView({block:'center'});
    throw new Error(localize("راجع الحقول المحددة واختر مجموعة ومستلمين للإعلان","Check the highlighted fields and select a group and recipients."));
   }
   const body={id:ann.id,...(ann.source_event_id?{source_event_id:ann.source_event_id}:{}),title:document.getElementById('annTitle').value.trim(),type_key:document.getElementById('annType').value || null,group_ids:groups,recipient_roles:roles,values:Object.fromEntries([...document.querySelectorAll('[data-ann-field]')].map(el=>[el.dataset.annField,el.value.trim()])),manual_body:document.getElementById('annManual').value.trim() || null,publish_on_portal:document.getElementById('annPortal').checked,expires_at:expiry?cairoAnnouncementExpiry(expiry):null,...(ann.revision?{expected_revision:ann.revision}:{})};
   await request('/announcements'+(ann.revision?'/'+ann.id:''),{method:ann.revision?'PUT':'POST',body});
   if(actor(this)!==identity)return;
   const saved=await request('/announcements/'+encodeURIComponent(ann.id));
   this._announcement=saved.announcement;
   if(publish)await request('/announcements/'+encodeURIComponent(ann.id)+'/publish',{method:'POST',body:{expected_revision:saved.announcement.revision}});
   await this.loadRouteData('announcements');
   await this.openAnnouncement(ann.id);
   this.showToast(publish?localize('تم نشر الإعلان','Announcement published'):localize("تم حفظ التعديلات","Changes saved"),'success');
  }catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}finally{this._announcementBusy=false;controls.forEach(button=>button.disabled=false);}
 };
 app.announcementAction=async function(action,body={}){const id=this._announcement?.id,identity=actor(this);if(this._announcementBusy)return;this._announcementBusy=true;try{await request('/announcements/'+id+'/'+action,{method:'POST',body});if(actor(this)!==identity)return;await this.loadRouteData('announcements');await this.openAnnouncement(id);this.showToast(action==='publish'?localize('تم نشر الإعلان','Announcement published'):localize("تم حفظ الإجراء","Action saved"),'success');}catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}finally{this._announcementBusy=false;}};
 app.previewAnnouncement=async function(){
  const id=this._announcement.id,identity=actor(this);try{
   const preview=await request('/announcements/'+id+'/preview',{method:'POST',body:{}});if(actor(this)!==identity || window.centrlyApp!==this)return;this._announcementPreview=preview;
   const type=this.announcementsData.catalog.find(t=>t.key===preview.announcement.type_key),enabled=type?.official_enabled && type?.provider_status==='APPROVED' && type?.provider_category==='UTILITY' && preview.allowance?.unit_cost_egp!=null;
   this.showModal(localize("معاينة الرسالة والمستلمين","Review message and recipients"),`<div style="display:grid;gap:1rem;min-width:0"><p>${preview.rows.length} ${localize('رقم بعد دمج الأرقام المتكررة. راجع كل رسالة قبل الإرسال.','unique numbers. Review each message before sending.')}</p><p>${enabled?`${localize('المتاح','Available')}: ${Number(preview.allowance.remaining)} ${localize('رسالة','messages')} · ${money(preview.allowance.unit_cost_egp)} ${localize('للرسالة','per message')}`:localize("الإرسال الرسمي غير متاح بعد؛ يمكنك فتح واتساب يدويًا لكل رقم.","Official sending is not available yet; you can open WhatsApp manually for each number.")}</p><div style="max-height:420px;overflow:auto;display:grid;gap:.75rem">${preview.rows.map((row,i)=>`<article style="border:1px solid var(--centrly-line);border-radius:12px;padding:.75rem;min-width:0;overflow-wrap:anywhere"><label style="display:flex;gap:.5rem;align-items:center;min-height:44px"><input type="checkbox" data-ann-recipient="${i}" ${row.consented && !row.opted_out?'checked':''} ${row.opted_out?'disabled':''} onchange="window.centrlyApp.updateAnnouncementTotal()"><bdi>${e(row.phone)}</bdi> · ${row.recipient_role==='parent'?localize("ولي أمر","Parent"):localize("طالب","Student")}</label><p>${e(row.group_names.join(localize("، ",", ")))}</p><p style="white-space:pre-wrap;line-height:1.8">${e(row.manual_body)}</p>${row.manual_body!==row.rendered_body?`<details><summary style="min-height:44px">${localize("نص الإرسال الرسمي","Official message")}</summary><p>${e(row.rendered_body)}</p></details>`:''}<p>${row.opted_out?localize("أوقف التنبيهات","Opted out"):row.consented?localize("موافقته على التنبيهات مسجلة","Notification consent recorded"):localize("تحتاج تسجيل موافقته قبل الإرسال الرسمي","Consent must be recorded before official sending")}</p>${!row.opted_out?`<a class="btn btn-secondary" style="min-height:44px" href="https://wa.me/${e(row.phone)}?text=${encodeURIComponent(row.manual_body || '')}" target="_blank" rel="noopener noreferrer">${localize("فتح واتساب يدويًا","Open WhatsApp")}</a>`:''}</article>`).join('') || '<p>'+ localize("لا توجد أرقام صالحة في المجموعات المحددة.","There are no valid numbers in the selected groups.") +'</p>'}</div><p id="annSendTotal" role="status" aria-live="polite"></p><label style="display:flex;align-items:center;gap:.5rem;min-height:44px"><input id="annConsentConfirmed" type="checkbox">${localize("أؤكد أن أصحاب الأرقام المحددة وافقوا على استقبال تنبيهات الدراسة","I confirm that the selected recipients agreed to receive study notifications")}</label>${button(localize("تسجيل موافقة الأرقام المحددة","Record consent for selected numbers"),'recordAnnouncementConsent()')}<label style="display:flex;align-items:center;gap:.5rem;min-height:44px"><input id="annSendConfirmed" type="checkbox">${localize("راجعت الأرقام ونص الرسالة والتكلفة وأؤكد الإرسال الرسمي","I reviewed the recipients, message and cost and confirm the official send")}</label><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-primary" style="min-height:44px" ${enabled?'':'disabled'} onclick="window.centrlyApp.sendAnnouncement('enqueue')">${localize("تأكيد الإرسال الرسمي","Confirm official send")}</button><button class="btn btn-secondary" style="min-height:44px" ${enabled?'':'disabled'} onclick="window.centrlyApp.sendAnnouncement('retry')">${localize("إعادة محاولة ما فشل فقط","Retry failed messages")}</button></div></div>`);this.updateAnnouncementTotal();
  }catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}
 };
 app.updateAnnouncementTotal=function(){const count=document.querySelectorAll('[data-ann-recipient]:checked').length,cost=this._announcementPreview?.allowance?.unit_cost_egp;document.getElementById('annSendTotal').textContent=`${localize('المحدد','Selected')}: ${count}${cost!=null?' · '+localize('التكلفة','Cost')+': '+money(count*Number(cost)):''}`;};
 app.selectedAnnouncementPhones=function(){return [...document.querySelectorAll('[data-ann-recipient]:checked')].map(el=>this._announcementPreview.rows[Number(el.dataset.annRecipient)].phone);};
 app.recordAnnouncementConsent=async function(){if(!document.getElementById('annConsentConfirmed').checked){this.showToast(localize("أكد الحصول على موافقة أصحاب الأرقام أولًا","First confirm that the recipients have consented."),'error');return;}const phones=this.selectedAnnouncementPhones();if(!phones.length){this.showToast(localize("اختر أرقامًا أولًا","Select recipients first."),'error');return;}const identity=actor(this);try{await request('/announcements/'+this._announcement.id+'/consent',{method:'POST',body:{confirmed:true,phones}});if(actor(this)===identity)await this.previewAnnouncement();}catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}};
 app.sendAnnouncement=async function(action){if(!document.getElementById('annSendConfirmed').checked){this.showToast(localize("أكد مراجعة الأرقام والتكلفة قبل الإرسال","Confirm that you reviewed the recipients and cost before sending."),'error');return;}const preview=this._announcementPreview,phones=this.selectedAnnouncementPhones();if(!phones.length){this.showToast(localize("اختر أرقامًا أولًا","Select recipients first."),'error');return;}await this.announcementAction(action,{preview_id:preview.preview_id,expected_revision:preview.announcement.revision,phones,unit_cost_egp:Number(preview.allowance.unit_cost_egp)});};
 app.openAnnouncementTypeRequest=function(){this._announcementTypeRequestId=crypto.randomUUID();this.showModal(localize("طلب نوع رسالة جديد","Request a message type"),'<form id="annTypeRequestForm" onsubmit="window.centrlyApp.saveAnnouncementTypeRequest(event)" style="display:grid;gap:1rem"><p>'+ localize("اكتب التنبيه الدراسي المطلوب ومثالًا عليه. نراجع الطلب ونقدمه لاعتماد واتساب قبل إتاحته للإرسال من المنصة.","Describe the study notification and give an example. We will review it and submit it for WhatsApp approval before enabling platform sending.") +'</p><label>'+ localize("اسم النوع","Type name") +'<input class="form-input" id="annRequestTitle" maxlength="100" required></label><label>'+ localize("متى تحتاج هذه الرسالة؟","When do you need this message?") +'<textarea class="form-input" id="annRequestDescription" maxlength="2000" required></textarea></label><fieldset><legend>'+ localize("الرسالة موجهة لمين؟","Who is the message for?") +'</legend><label style="display:block;padding:.5rem"><input type="checkbox" name="annRequestRole" value="parent" checked> ' + localize('ولي الأمر','Parent') + '</label><label style="display:block;padding:.5rem"><input type="checkbox" name="annRequestRole" value="student" checked> ' + localize('الطالب','Student') + '</label></fieldset><label>'+ localize("مثال للرسالة","Message example") +'<textarea class="form-input" id="annRequestSample" maxlength="1024" required></textarea></label></form>','<button class="btn btn-primary" style="min-height:44px" form="annTypeRequestForm" type="submit">'+ localize("تسجيل الطلب","Submit request") +'</button>');};
 app.saveAnnouncementTypeRequest=async function(event){event.preventDefault();const control=event.submitter,identity=actor(this);control.disabled=true;try{const result=await request('/announcements/type-requests',{method:'POST',body:{id:this._announcementTypeRequestId,title:document.getElementById('annRequestTitle').value.trim(),description:document.getElementById('annRequestDescription').value.trim(),sample_body:document.getElementById('annRequestSample').value.trim(),recipient_roles:[...document.querySelectorAll('[name=annRequestRole]:checked')].map(el=>el.value)}});if(actor(this)!==identity)return;this.closeModal();await this.loadRouteData('announcements');this.showToast(result.existing_type?localize("نوع الرسالة موجود بالفعل: ","This message type already exists: ")+result.title:result.already_requested?localize("طلبك موجود بالفعل وتحت المراجعة","Your request already exists and is under review."):localize("وصل طلبك للمراجعة","Your request was submitted for review."),'success');}catch(error){if(actor(this)===identity)this.showToast(error.message,'error');if(control.isConnected)control.disabled=false;}};
}
