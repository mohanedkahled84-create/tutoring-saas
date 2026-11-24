import {localize} from '../utils/language.js?v=9.94.1';
import {renderCommercialWallet} from './CommercialBillingView.js?v=9.94.1';
import {escapeHtml as e} from '../utils/escapeHtml.js?v=9.94.1';
import {request} from '../services/api.js?v=9.94.1';
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
export function renderAnnouncementMessagePreview(rows=[],selectedPhones=[]) {
 const chosen=new Set(selectedPhones), selected=rows.filter(row=>chosen.has(row.phone));
 const examples=selected.length?selected:rows.slice(0,1), variants=new Map();
 for(const row of examples){
  const body=row.rendered_body || row.manual_body || '';
  if(!body)continue;
  if(!variants.has(body))variants.set(body,new Set());
  for(const name of row.group_names || [])if(name)variants.get(body).add(name);
 }
 const items=[...variants.entries()];
 if(!items.length)return `<p>${localize('لا توجد أرقام متاحة للمعاينة','No recipients available to preview')}</p>`;
 const show=([body,groups])=>`<div>${groups.size?`<small>${e([...groups].join('، '))}</small>`:''}<p style="white-space:pre-wrap;overflow-wrap:anywhere">${e(body)}</p></div>`;
 const note=selected.length?'':`<p>${localize('مثال للرسالة؛ اختر المجموعات لمراجعة الرسائل الموجهة لها.','Example message; choose groups to review the messages they will receive.')}</p>`;
 const more=items.length>1?`<details><summary>${localize('صيغ أخرى للمجموعات المختارة','Other messages for the selected groups')} (${items.length-1})</summary>${items.slice(1).map(show).join('')}</details>`:'';
 return note+show(items[0])+more;
}
export function cairoAnnouncementExpiry(value){
 const date=new Date(value+'T23:59:59Z');
 for(let i=0;i<3;i++){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-GB',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}).formatToParts(date).filter(p=>p.type!=='literal').map(p=>[p.type,p.value]));const shown=Date.UTC(Number(parts.year),Number(parts.month)-1,Number(parts.day),Number(parts.hour),Number(parts.minute),Number(parts.second));date.setTime(date.getTime()+Date.parse(value+'T23:59:59Z')-shown);}
 return date.toISOString();
}
const money=value=>Number(value).toLocaleString(localize('ar-EG','en-EG'),{maximumFractionDigits:4})+localize(' ج.م',' EGP');
export function announcementListPage(data={},state={}){
 const all=Array.isArray(data.announcements)?data.announcements:[],term=String(state.query || '').trim().toLocaleLowerCase(),filter=state.status || 'all';
 const matches=all.filter(row=>{
  const kind=(data.catalog || []).find(item=>item.key===row.type_key)?.title || '';
  return (filter==='all' || row.status===filter) && (!term || [row.title,kind].some(value=>String(value || '').toLocaleLowerCase().includes(term)));
 });
 const pages=Math.max(1,Math.ceil(matches.length/8)),page=Math.min(pages,Math.max(1,Number(state.page)||1));
 return {rows:matches.slice((page-1)*8,page*8),total:matches.length,page,pages,available:all.length};
}
export function renderAnnouncementList(data={},state={},app={}){
 const result=announcementListPage(data,state);
 const cards=result.rows.map(row=>{
  const type=(data.catalog || []).find(item=>item.key===row.type_key)?.title || localize('إعلان مخصص','Custom announcement');
  const counts=Object.entries(row.delivery || {}).filter(([,count])=>Number(count)>0).map(([key,count])=>`${e(statuses()[key] || key)} ${Number(count)}`).join(' · ');
  const delivery=counts?localize('واتساب: ','WhatsApp: ')+counts:localize('واتساب: لم يبدأ الإرسال الرسمي','WhatsApp: No official send started');
  const date=row.updated_at?new Intl.DateTimeFormat(localize('ar-EG','en-GB'),{timeZone:'Africa/Cairo',dateStyle:'medium'}).format(new Date(row.updated_at)):'';
  return `<article class="announcement-list-row"><div class="announcement-list-copy"><div class="announcement-list-title"><strong>${e(row.title)}</strong><span class="announcement-list-status">${e(statuses()[row.status] || row.status)}</span></div><p>${e(catalogText(type))} · ${Number(row.group_ids?.length || 0)} ${localize('مجموعة','groups')}${date?' · '+e(date):''}</p>${row.status==='published'?`<p>${delivery}</p>`:''}</div><button class="btn btn-secondary" type="button" style="min-height:44px" onclick="window.centrlyApp.openAnnouncement('${e(row.id)}')">${localize('فتح','Open')}</button></article>`;
 }).join('');
 const empty=localize('لا توجد إعلانات مطابقة. جرّب كلمة بحث أو حالة أخرى.','No matching announcements. Try another search or status.');
 return `<p role="status" aria-live="polite" style="color:var(--centrly-muted,#64748b);font-size:.85rem">${result.total} ${localize('إعلان','announcements')} · ${localize('آخر ١٠٠ إعلان','Latest 100 announcements')}</p><div style="display:grid;gap:.5rem">${cards || `<p>${empty}</p>`}</div>${result.pages>1?`<nav aria-label="${localize('صفحات الإعلانات','Announcement pages')}" style="display:flex;align-items:center;justify-content:center;gap:.75rem;flex-wrap:wrap;margin-top:1rem"><button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.changeAnnouncementPage(-1)" ${result.page===1?'disabled':''}>${localize('السابق','Previous')}</button><span>${localize('صفحة','Page')} ${result.page} / ${result.pages}</span><button type="button" class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.changeAnnouncementPage(1)" ${result.page===result.pages?'disabled':''}>${localize('التالي','Next')}</button></nav>`:''}`;
}
export function renderAnnouncementsView(data={},app={}){
 const owner=actor(app),state=app._announcementListState?.owner===owner?app._announcementListState:{owner,query:'',status:'all',page:1};
 app._announcementListState=state;state.page=announcementListPage(data,state).page;
 return `<style>.announcement-list-row{display:flex;align-items:center;justify-content:space-between;gap:.75rem;flex-wrap:wrap;border:1px solid var(--centrly-line,#e2e8f0);border-radius:12px;padding:.75rem 1rem;min-width:0}.announcement-list-copy{min-width:0;flex:1 1 230px;overflow-wrap:anywhere}.announcement-list-copy p{font-size:.84rem;color:var(--centrly-muted,#64748b);margin:.25rem 0 0}.announcement-list-title{display:flex;align-items:center;gap:.5rem;flex-wrap:wrap}.announcement-list-status{font-size:.75rem;font-weight:700;background:#eff6ff;color:#1e40af;border-radius:8px;padding:.2rem .5rem}.announcement-filters{display:flex;gap:.6rem;flex-wrap:wrap;margin:1rem 0}.announcement-filters label{display:grid;gap:.35rem;flex:1 1 180px}</style><div style="display:grid;gap:1rem;min-width:0"><section class="card announcements-intro" style="margin:0"><p style="font-size:.85rem">${localize("تواصل واضح مع طلابك وأولياء الأمور", "Stay in touch with students and parents")}</p><div class="announcements-heading"><h1 style="font-size:1.6rem">${localize("الرسائل والإعلانات", "Messages and announcements")}</h1>${renderCommercialWallet(data.wallet)}</div><p>${localize("غيّر موعد حصة، انشر محتوى جديدًا، أو ذكّر مجموعاتك بموعد مهم.", "Share class changes, new materials, and reminders with your groups.")}</p><div style="display:flex;gap:.6rem;flex-wrap:wrap">${can(app,'create')?button(localize("إعلان جديد", "New announcement"),'openAnnouncement()',true)+button(localize('إعلان عن حصة','Announce a class'),'openAnnouncementSessionPicker()')+button(localize("طلب نوع رسالة جديد", "Request a message type"),'openAnnouncementTypeRequest()'):''}${button(localize("تحديث القائمة", "Refresh"),"loadRouteData('announcements')")}</div></section><section class="card" style="margin:0"><h2 style="font-size:1.15rem">${localize("إعلاناتي", "My announcements")}</h2><div class="announcement-filters"><label>${localize('ابحث في الإعلانات','Search announcements')}<input type="search" id="announcementSearch" class="form-input" value="${e(state.query || '')}" oninput="window.centrlyApp.filterAnnouncementList()"></label><label>${localize('حالة الإعلان','Announcement status')}<select id="announcementStatusFilter" class="form-select" onchange="window.centrlyApp.filterAnnouncementList()">${[['all',localize('كل الحالات','All statuses')],['draft',statuses().draft],['published',statuses().published],['archived',statuses().archived]].map(([key,label])=>`<option value="${key}" ${state.status===key?'selected':''}>${e(label)}</option>`).join('')}</select></label></div><div id="announcementListResults">${renderAnnouncementList(data,state,app)}</div></section>${data.requests?.length?`<section class="card" style="margin:0"><h2 style="font-size:1.15rem">${localize('طلبات أنواع الرسائل','Message type requests')}</h2>${data.requests.map(row=>`<article style="border-top:1px solid var(--centrly-line);padding:.75rem 0;overflow-wrap:anywhere"><strong>${e(row.title)}</strong><p>${e(requestStates()[row.status])}</p>${row.admin_notes?`<p>${e(row.admin_notes)}</p>`:''}</article>`).join('')}</section>`:''}</div>`;
}
function fields(type,values={},locked={}){
 return (type?.fields || []).filter(field=>!automatic.has(field.type)).map(field=>`<label style="display:grid;gap:.4rem">${e(catalogText(field.label))}${field.type==='choice'?`<select class="form-select" style="min-height:44px" data-ann-field="${e(field.key)}" ${Object.hasOwn(locked,field.key)?'disabled':''} required><option value="">${localize('اختر','Select')}</option>${field.options.map(v=>`<option value="${e(v)}" ${values[field.key]===v?'selected':''}>${e(catalogText(v))}</option>`).join('')}</select>`:`<input class="form-input" style="min-height:44px" data-ann-field="${e(field.key)}" type="${field.type==='date'?'date':field.type==='datetime'?'datetime-local':'text'}" maxlength="160" value="${e(values[field.key] || '')}" ${Object.hasOwn(locked,field.key)?'readonly':''} required>`}</label>`).join('');
}
export function announcementChannels(portal, whatsapp) {
 return {publish_on_portal:Boolean(portal), review_whatsapp:Boolean(whatsapp), selected:Boolean(portal || whatsapp)};
}
export function registerAnnouncementsActions(app){
 app.filterAnnouncementList=function(){
  this._announcementListState={owner:actor(this),query:document.getElementById('announcementSearch')?.value || '',status:document.getElementById('announcementStatusFilter')?.value || 'all',page:1};
  const results=document.getElementById('announcementListResults');if(results)results.innerHTML=renderAnnouncementList(this.announcementsData || {},this._announcementListState,this);
 };
 app.changeAnnouncementPage=function(delta){
  const state=this._announcementListState || {query:'',status:'all',page:1};state.page=Math.max(1,(Number(state.page)||1)+delta);state.page=announcementListPage(this.announcementsData || {},state).page;this._announcementListState=state;
  const results=document.getElementById('announcementListResults');if(results){results.innerHTML=renderAnnouncementList(this.announcementsData || {},state,this);results.querySelector('nav button:not([disabled])')?.focus({preventScroll:true});results.querySelector('article')?.scrollIntoView({block:'nearest'});}
 };

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
   const data=id?await request('/announcements/'+encodeURIComponent(id)):{announcement:{id:crypto.randomUUID(),title:'',type_key:this.announcementsData?.catalog?.[0]?.key || null,group_ids:[],recipient_roles:['student','parent'],values:{},publish_on_portal:false,status:'draft',...(seed || {})},deliveries:[]};
   if(actor(this)!==identity || window.centrlyApp!==this)return;
   this._announcement=data.announcement;const ann=data.announcement,types=this.announcementsData?.catalog || [],editable=can(this,id?'edit':'create'),type=types.find(t=>t.key===ann.type_key);
   this.showModal(id?localize("إعلان مجموعاتك","Group announcement"):localize("إعلان جديد","New announcement"),`<div style="display:grid;gap:1rem">${ann.source_event_id?'<p>'+ localize("هذه المسودة مرتبطة بحصة أو محتوى محفوظ. التفاصيل المرتبطة تُعدّل من المصدر أولًا، ولا تُرسل أي رسالة بمجرد الحفظ.","This draft is linked to a saved class or material. Edit linked details at the source. Saving does not send any messages.") +'</p>':''}<form id="announcementForm" novalidate onsubmit="window.centrlyApp.saveAnnouncement(event)" style="display:grid;gap:1rem;min-width:0"><style>#announcementForm [aria-invalid=true]{outline:2px solid var(--centrly-danger,#b91c1c);outline-offset:2px}</style><fieldset ${editable?'':'disabled'} style="display:grid;gap:1rem;min-width:0;border:0;padding:0"><label>${localize("عنوان الإعلان","Announcement title")}<input id="annTitle" class="form-input" maxlength="160" value="${e(ann.title)}" required></label><label>${localize("نوع الرسالة","Message type")}<select ${ann.source_event_id?'disabled':''} id="annType" class="form-select" style="min-height:44px" onchange="window.centrlyApp.changeAnnouncementType(this.value)">${!ann.type_key?`<option value="" selected disabled>${localize('إعلان مخصص سابق','Existing custom announcement')}</option>`:''}${types.map(t=>`<option value="${e(t.key)}" ${ann.type_key===t.key?'selected':''}>${e(catalogText(t.title))}</option>`).join('')}</select></label><div id="annClassPicker"></div><div id="annFields" style="display:grid;gap:1rem">${fields(type,ann.values,ann.source_values || {})}</div><fieldset style="border:1px solid var(--centrly-line);border-radius:12px;min-width:0"><legend>${localize("المجموعات","Groups")}</legend><div style="max-height:200px;overflow:auto">${(this.groups || []).filter(g=>(!g.archived_at || ann.group_ids.includes(g.id)) && (!ann.source_event_id || !Array.isArray(ann.source_group_ids) || ann.source_group_ids.includes(g.id))).map(g=>`<label style="display:flex;gap:.5rem;align-items:center;min-height:44px"><input name="annGroup" type="checkbox" value="${e(g.id)}" ${ann.group_ids.includes(g.id)?'checked':''}>${e(g.name)}</label>`).join('') || '<p>'+ localize("أضف مجموعة أولًا من مجاميعي الدراسية.","Add a group first.") +'</p>'}</div></fieldset><fieldset style="border:0;padding:0"><legend>${localize("من سيشاهد الإعلان؟","Who can see this announcement?")}</legend>${[['student',localize("الطلاب","Students")],['parent',localize("أولياء الأمور","Parents")]].map(([role,label])=>`<label style="display:inline-flex;gap:.5rem;align-items:center;min-height:44px;margin-inline-end:1rem"><input name="annRole" type="checkbox" value="${role}" ${ann.recipient_roles.includes(role)?'checked':''}>${label}</label>`).join('')}</fieldset><fieldset style="border:0;padding:0"><legend>${localize('قنوات النشر','Delivery channels')}</legend><label style="display:flex;gap:.5rem;align-items:center;min-height:44px"><input id="annPortal" type="checkbox" ${ann.publish_on_portal?'checked':''}>${localize('المنصة','Portal')}</label>${can(this,'send') && !this.delegation?'<label style="display:flex;gap:.5rem;align-items:center;min-height:44px"><input id="annEmail" type="checkbox">'+localize('البريد الإلكتروني · للطلاب أصحاب البريد المؤكد والمفعّل فقط','Email · students with a verified, enabled address only')+'</label>':''}${can(this,'send')?'<label style="display:flex;gap:.5rem;align-items:center;min-height:44px"><input id="annWhatsApp" type="checkbox">'+localize('واتساب','WhatsApp')+'</label>':''}</fieldset><label>${localize('ينتهي ظهوره في المنصة يوم','Hide from the portal on')} <input id="annExpiry" type="date" class="form-input" value="${e(ann.expires_at?new Date(ann.expires_at).toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'}):'')}"></label></fieldset><div style="position:sticky;bottom:0;z-index:1;background:var(--centrly-surface,#fff);display:flex;flex-wrap:wrap;gap:.5rem;padding:.5rem 0">${editable&&ann.status==='draft'?'<button type="submit" value="publish" class="btn btn-primary" style="min-height:44px">'+localize('نشر','Publish')+'</button><button type="submit" value="draft" class="btn btn-secondary" style="min-height:44px">'+ localize("حفظ المسودة","Save draft") +'</button>':editable?'<button type="submit" class="btn btn-primary" style="min-height:44px">'+ localize("حفظ التعديلات","Save changes") +'</button>':''}</div></form>${id?`<section style="display:flex;flex-wrap:wrap;gap:.5rem">${ann.status==='published' && can(this,'send')?button(localize("معاينة المستلمين والإرسال","Review recipients and send"),'previewAnnouncement()',true):''}${can(this,'send')?button(localize("إلغاء الرسائل المنتظرة","Cancel queued messages"),"announcementAction('cancel')") :''}${ann.status!=='archived' && can(this,'delete')?button(localize("أرشفة الإعلان","Archive announcement"),"announcementAction('archive')") :''}</section><section><h3 style="font-size:1rem">${localize("متابعة الإرسال","Delivery status")}</h3><p>${localize("الحالة غير المؤكدة لا يعاد إرسالها تلقائيًا. الرسائل المرسلة تظل في السجل عند إلغاء المنتظر.","Messages with an unconfirmed status are not retried automatically. Sent messages remain in the history when queued messages are cancelled.")}</p><div style="max-height:260px;overflow:auto">${Object.entries(data.email_delivery || {}).length?'<p>'+localize('البريد الإلكتروني: ','Email: ')+Object.entries(data.email_delivery).map(([state,count])=>e(statuses()[state] || state)+': '+Number(count)).join(' · ')+'</p>':''}${data.deliveries.map(row=>`<p><bdi>${e(row.phone)}</bdi> · ${e(statuses()[row.status])} · ${row.attempts} ${localize('محاولة','attempts')}</p>`).join('') || '<p>'+ localize("لا توجد رسائل رسمية لهذا الإعلان بعد.","There are no official messages for this announcement yet.") +'</p>'}</div></section>`:''}</div>`);
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
  const audienceGroups=form.querySelector('[name=annGroup]')?.closest('fieldset');if(audienceGroups)audienceGroups.hidden=false;
  const generation=this._announcementClassGeneration=(this._announcementClassGeneration || 0)+1;
  const timeField=classTime[form.querySelector('#annType').value],ann=this._announcement;
  if(!timeField || ann.source_event_id || ann.status!=='draft')return;
  const topic=form.querySelector('[data-ann-field="topic"]');
  const time=form.querySelector('[data-ann-field="'+timeField+'"]');
  for(const input of [topic,time])if(input)input.closest('label').style.display='none';
  holder.innerHTML=`<div role="status" aria-label="${localize('جار تحميل الحصص','Loading classes')}" class="skeleton-box" style="height:56px"></div>`;
  const identity=actor(this);
  try{
   const today=new Date().toLocaleDateString('en-CA',{timeZone:'Africa/Cairo'});
   const range=days=>new Date(Date.parse(today+'T12:00:00Z')+days*86400000).toISOString().slice(0,10);
   const [{sessions},groupData]=await Promise.all([request('/sessions?from='+range(-90)+'&to='+range(90)),request('/groups')]);
   if(actor(this)!==identity || !holder.isConnected || this._announcementClassGeneration!==generation)return;
   const groups=Array.isArray(groupData)?groupData:groupData.groups || [];
   const rows=announcementClasses(sessions || [],groups,today);
   if(audienceGroups)audienceGroups.hidden=true;
   const saved=rows.find(row=>row.topic===topic?.value && row.datetime===time?.value);
   if(!rows.length){holder.innerHTML=`<p role="status">${localize('لا توجد حصص بموعد واضح. راجع أيام ومواعيد الحصص في جدول المجموعة.','No classes have a scheduled time. Check the group timetable.')}</p><input id="annClass" type="hidden"><button type="button" id="annClassGroup" class="btn btn-secondary">${localize('إعادة المحاولة','Retry')}</button>`;holder.querySelector('#annClassGroup').addEventListener('click',()=>void this.setupAnnouncementClasses());return;}
   const available=groups.filter(group=>rows.some(row=>row.groupId===group.id));
   holder.innerHTML=`<fieldset style="border:1px solid var(--centrly-line);border-radius:12px;min-width:0;padding:1rem"><legend>${localize('اختر الحصة','Choose a class')}</legend><label style="display:grid;gap:.4rem">${localize('المجموعة','Group')}<select id="annClassGroup" class="form-select"><option value="">${localize('اختر المجموعة','Select a group')}</option>${available.map(group=>`<option value="${e(group.id)}">${e(group.name)}</option>`).join('')}</select></label><label style="display:grid;gap:.4rem;margin-top:.75rem">${localize('تاريخ الحصة','Class date')}<input id="annClassDate" type="date" class="form-input"></label><input id="annClass" type="hidden"><div id="annClassChoices" style="display:grid;gap:.5rem;margin-top:.75rem" aria-live="polite"></div></fieldset>`;
   const group=holder.querySelector('#annClassGroup'),date=holder.querySelector('#annClassDate'),selectedInput=holder.querySelector('#annClass'),choices=holder.querySelector('#annClassChoices');
   if(saved){group.value=saved.groupId;date.value=saved.datetime.slice(0,10);selectedInput.value=saved.id;}
   const render=()=>{
    const matching=rows.filter(row=>row.groupId===group.value && row.datetime.slice(0,10)===date.value);
    choices.innerHTML=group.value && date.value?(matching.map(row=>`<label style="display:flex;gap:.6rem;align-items:center;min-height:44px;padding:.6rem;border:1px solid var(--centrly-line);border-radius:8px"><input type="radio" name="annClassChoice" value="${e(row.id)}" ${selectedInput.value===row.id?'checked':''}><span>${e(row.topic)} · <bdi>${e(row.datetime.replace('T',' '))}</bdi></span></label>`).join('') || `<p>${localize('لا توجد حصة في هذا اليوم للمجموعة.','No class for this group on that date.')}</p>`):`<p>${localize('اختر المجموعة والتاريخ لعرض الحصص.','Choose a group and date to see classes.')}</p>`;
    choices.querySelectorAll('[name=annClassChoice]').forEach(input=>input.addEventListener('change',()=>{
     const selected=rows.find(row=>row.id===input.value);if(!selected)return;
     selectedInput.value=selected.id;if(topic)topic.value=selected.topic;if(time)time.value=selected.datetime;
     for(const checkbox of form.querySelectorAll('[name=annGroup]'))checkbox.checked=checkbox.value===selected.groupId;
     const title=form.querySelector('#annTitle');if(!title.value.trim())title.value=localize('حصة','Class')+' · '+selected.topic;
     group.removeAttribute('aria-invalid');date.removeAttribute('aria-invalid');
    }));
   };
   const reset=()=>{selectedInput.value='';if(topic)topic.value='';if(time)time.value='';for(const checkbox of form.querySelectorAll('[name=annGroup]'))checkbox.checked=checkbox.value===group.value;render();};
   group.addEventListener('change',reset);date.addEventListener('change',reset);render();
  }catch{
   if(!holder.isConnected || this._announcementClassGeneration!==generation)return;
   holder.innerHTML=`<p role="alert">${localize('تعذر تحميل الحصص','Could not load classes')}</p><input id="annClass" type="hidden"><button type="button" id="annClassGroup" class="btn btn-secondary" data-retry>${localize('إعادة المحاولة','Retry')}</button>`;
   holder.querySelector('[data-retry]').addEventListener('click',()=>void this.setupAnnouncementClasses());
  }
 };
 app.saveAnnouncement=async function(event){
  event.preventDefault();const ann=this._announcement,control=event.submitter,identity=actor(this),form=event.currentTarget;
  if(this._announcementBusy)return;
  const publish=control?.value==='publish' && ann.status==='draft';
  const channels=announcementChannels(form.querySelector('#annPortal').checked,form.querySelector('#annWhatsApp')?.checked);
  const sendEmail=publish && form.querySelector('#annEmail')?.checked;
  const reviewWhatsApp=publish && channels.review_whatsapp;
  this._announcementBusy=true;
  const controls=[...form.querySelectorAll('button[type=submit]')];
  controls.forEach(button=>button.disabled=true);
  const originalLabel=control.innerHTML;
  control.setAttribute('aria-busy','true');
  control.innerHTML=localize('جارٍ الحفظ…','Saving…')+'<progress aria-label="'+localize('جارٍ الحفظ','Saving')+'" style="display:block;width:100%;height:4px"></progress>';
  try{
   const groups=[...document.querySelectorAll('[name=annGroup]:checked')].map(el=>el.value),roles=[...document.querySelectorAll('[name=annRole]:checked')].map(el=>el.value),expiry=document.getElementById('annExpiry').value;
   form.querySelectorAll('[aria-invalid]').forEach(field=>field.removeAttribute('aria-invalid'));
   const title=form.querySelector('#annTitle');
   const invalid=[];
   if(!title.value.trim())invalid.push(title);
   if(publish && !channels.selected && !sendEmail){
    invalid.push(form.querySelector('#annPortal'));
   }
   const lesson=form.querySelector('#annClass');
   if(publish && lesson && !lesson.value)invalid.push(form.querySelector('#annClassGroup') || lesson);
   if(publish)invalid.push(...[...form.querySelectorAll('[data-ann-field]:required:not(:disabled)')].filter(field=>field.closest('label').style.display!=='none' && !field.value.trim()));
   if(!groups.length)invalid.push(...form.querySelectorAll('[name=annGroup]'));
   if(sendEmail && !roles.includes('student'))throw new Error(localize('رسائل البريد متاحة للطلاب أصحاب البريد المؤكد فقط. اختَر الطلاب.','Email is available for verified student addresses only. Select students.'));
   if(!roles.length)invalid.push(...form.querySelectorAll('[name=annRole]'));
   if(invalid.length || !groups.length || !roles.length){
    invalid.forEach(field=>field.setAttribute('aria-invalid','true'));
    const first=form.querySelector('[aria-invalid=true]');
    first?.focus();
    first?.scrollIntoView({block:'center'});
    throw new Error(localize("راجع الحقول المحددة واختر مجموعة ومستلمين للإعلان","Check the highlighted fields and select a group and recipients."));
   }
   const body={id:ann.id,...(ann.source_event_id?{source_event_id:ann.source_event_id}:{}),title:document.getElementById('annTitle').value.trim(),type_key:document.getElementById('annType').value || null,group_ids:groups,recipient_roles:roles,values:Object.fromEntries([...document.querySelectorAll('[data-ann-field]')].map(el=>[el.dataset.annField,el.value.trim()])),manual_body:document.getElementById('annType').value ? null : (ann.manual_body || null),publish_on_portal:channels.publish_on_portal,expires_at:expiry?cairoAnnouncementExpiry(expiry):null,...(ann.revision?{expected_revision:ann.revision}:{})};
   await request('/announcements'+(ann.revision?'/'+ann.id:''),{method:ann.revision?'PUT':'POST',body});
   if(actor(this)!==identity)return;
   const saved=await request('/announcements/'+encodeURIComponent(ann.id));
   this._announcement=saved.announcement;
   if(publish)await request('/announcements/'+encodeURIComponent(ann.id)+'/publish',{method:'POST',body:{expected_revision:saved.announcement.revision}});
   if(sendEmail){const current=await request('/announcements/'+encodeURIComponent(ann.id));const emailed=await request('/announcements/'+encodeURIComponent(ann.id)+'/email',{method:'POST',body:{expected_revision:current.announcement.revision}});this.showToast(localize('رسائل البريد في الانتظار: ','Emails queued: ')+Number(emailed.queued),'info');}
   await this.loadRouteData('announcements');
   if(reviewWhatsApp){await this.previewAnnouncement(ann.id);return;}
   if(publish)this.closeModal();else await this.openAnnouncement(ann.id);
   this.showToast(publish?localize('تم نشر الإعلان وحفظ القنوات المختارة.','Announcement published with the selected channels.'):localize("تم حفظ التعديلات","Changes saved"),'success');
  }catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}finally{this._announcementBusy=false;controls.forEach(button=>button.disabled=false);control.removeAttribute('aria-busy');control.innerHTML=originalLabel;}
 };
 app.announcementAction=async function(action,body={}){const id=this._announcement?.id,identity=actor(this);if(this._announcementBusy)return;this._announcementBusy=true;try{await request('/announcements/'+id+'/'+action,{method:'POST',body});if(actor(this)!==identity)return;await this.loadRouteData('announcements');await this.openAnnouncement(id);this.showToast(action==='publish'?localize('تم نشر الإعلان','Announcement published'):(['enqueue','retry'].includes(action)?localize("الرسائل في انتظار الإرسال. تابع حالة التسليم من الإعلان.","Messages queued. Check the announcement for delivery status."):localize("تم حفظ الإجراء","Action saved")),'success');}catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}finally{this._announcementBusy=false;}};
 app.previewAnnouncement=async function(id=this._announcement?.id){
  if(!id)return;
  const identity=actor(this);try{
   const preview=await request('/announcements/'+id+'/preview',{method:'POST',body:{}});if(actor(this)!==identity || window.centrlyApp!==this)return;this._announcementPreview=preview;this._announcement=preview.announcement;
   const type=this.announcementsData.catalog.find(t=>t.key===preview.announcement.type_key),enabled=type?.official_enabled && type?.provider_status==='APPROVED' && type?.provider_category==='UTILITY' && preview.allowance?.unit_cost_egp!=null && Boolean(preview.preview_id);
   this.showModal(localize("معاينة الرسالة والمستلمين","Review message and recipients"),`<div style="display:grid;gap:1rem;min-width:0"><p>${preview.rows.length} ${localize('رقم بعد دمج الأرقام المتكررة.','unique numbers across the selected groups.')}</p><p>${enabled?`${localize('المتاح','Available')}: ${Number(preview.allowance.remaining)} ${localize('رسالة','messages')} · ${money(preview.allowance.unit_cost_egp)} ${localize('للرسالة','per message')}`:localize("الإرسال الرسمي غير متاح بعد؛ يمكنك فتح واتساب يدويًا لكل رقم.","Official sending is not available yet; you can open WhatsApp manually for each number.")}</p><section class="card" style="margin:0"><h3>${localize('معاينة الرسالة','Message preview')}</h3><div id="annPreviewBody" aria-live="polite">${renderAnnouncementMessagePreview(preview.rows)}</div></section>
   <fieldset style="display:grid;gap:.5rem;border:1px solid var(--centrly-line);border-radius:12px;padding:.75rem"><legend>${localize('اختر المجموعات','Choose groups')}</legend>${[...new Map(preview.rows.flatMap(row=>(row.group_ids || []).map((id,i)=>[id,row.group_names?.[i] || this.groups?.find(group=>group.id===id)?.name || localize('مجموعة','Group')]))).entries()].map(([id,name])=>`<label><input type="checkbox" data-ann-group value="${e(id)}" onchange="window.centrlyApp.selectAnnouncementGroups()"> ${e(name)}</label>`).join('')}</fieldset>
   <details><summary>${localize('تفاصيل المستلمين والموافقة','Recipient and consent details')}</summary><div style="display:grid;gap:.5rem;max-height:220px;overflow:auto">${preview.rows.map((row,i)=>`<div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center"><label><input type="checkbox" data-ann-recipient="${i}" ${row.opted_out?'disabled':''} onchange="window.centrlyApp.updateAnnouncementTotal()"> <bdi>${e(row.phone)}</bdi> · ${row.recipient_role==='parent'?localize('ولي أمر','Parent'):localize('طالب','Student')}</label><small>${row.opted_out?localize('أوقف التنبيهات','Opted out'):row.consented?localize('الموافقة مسجلة','Consent recorded'):localize('الموافقة مطلوبة','Consent required')}</small>${!row.opted_out?`<a href="https://wa.me/${e(row.phone)}?text=${encodeURIComponent(row.manual_body || '')}" target="_blank" rel="noopener noreferrer">${localize('فتح واتساب يدويًا','Open WhatsApp manually')}</a>`:''}</div>`).join('')}</div></details><p id="annSendTotal" data-send-enabled="${Boolean(enabled)}" role="status" aria-live="polite"></p><label style="display:flex;align-items:center;gap:.5rem;min-height:44px"><input id="annSendConfirmed" type="checkbox">${localize("أؤكد موافقة المستلمين وراجعت الرسالة والتكلفة قبل الإرسال","I confirm recipient consent and have reviewed the message and cost")}</label><div style="display:flex;gap:.5rem;flex-wrap:wrap"><button class="btn btn-primary" style="min-height:44px" ${enabled?'':'disabled'} data-ann-confirm-send onclick="window.centrlyApp.sendAnnouncement('enqueue')">${localize("تأكيد الإرسال الرسمي","Confirm official send")}</button><button class="btn btn-secondary" style="min-height:44px" ${enabled?'':'disabled'} data-ann-confirm-send onclick="window.centrlyApp.sendAnnouncement('retry')">${localize("إعادة محاولة ما فشل فقط","Retry failed messages")}</button></div></div>`);this.updateAnnouncementTotal();
  }catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}
 };
 app.selectAnnouncementGroups=function(){
  const groups=new Set([...document.querySelectorAll('[data-ann-group]:checked')].map(input=>input.value));
  for(const input of document.querySelectorAll('[data-ann-recipient]')){
   const row=this._announcementPreview.rows[Number(input.dataset.annRecipient)];
   input.checked=!input.disabled && row.group_ids?.some(id=>groups.has(id));
  }
  this.updateAnnouncementTotal();
 };
 app.updateAnnouncementTotal=function(){
  const total=document.getElementById('annSendTotal');
  const count=document.querySelectorAll('[data-ann-recipient]:checked').length;
  const messagePreview=document.getElementById('annPreviewBody');
  if(messagePreview)messagePreview.innerHTML=renderAnnouncementMessagePreview(this._announcementPreview?.rows || [],this.selectedAnnouncementPhones());
  const allowance=this._announcementPreview?.allowance;
  const cost=allowance?.unit_cost_egp;
  const insufficient=cost!=null && count>Number(allowance.remaining);
  total.textContent=localize('المحدد','Selected')+': '+count+(cost==null?'':' · '+localize('التكلفة قبل الإرسال','Cost before sending')+': '+money(count*Number(cost)));
  if(insufficient)total.textContent+=' · '+localize('الرصيد لا يكفي. قلّل العدد أو اشحن المحفظة.','Insufficient balance. Select fewer recipients or top up the wallet.');
  for(const button of document.querySelectorAll('[data-ann-confirm-send]'))button.disabled=total.dataset.sendEnabled!=='true' || !count || insufficient;
 };
 app.selectedAnnouncementPhones=function(){return [...document.querySelectorAll('[data-ann-recipient]:checked')].map(el=>this._announcementPreview.rows[Number(el.dataset.annRecipient)].phone);};
 app.sendAnnouncement=async function(action){
  if(this._announcementBusy)return;
  if(!document.getElementById('annSendConfirmed')?.checked){this.showToast(localize('أكد موافقة المستلمين ومراجعة الرسالة والتكلفة قبل الإرسال','Confirm recipient consent and review the message and cost before sending.'),'error');return;}
  const preview=this._announcementPreview,phones=this.selectedAnnouncementPhones(),identity=actor(this);
  if(!phones.length || phones.length>Number(preview?.allowance?.remaining) || !preview?.preview_id){this.showToast(localize('راجع المستلمين والرصيد المتاح قبل الإرسال','Check recipients and available balance before sending.'),'error');return;}
  this._announcementBusy=true;const controls=[...document.querySelectorAll('[data-ann-confirm-send]')];controls.forEach(button=>button.disabled=true);
  try{
   await request('/announcements/'+this._announcement.id+'/consent',{method:'POST',body:{confirmed:true,phones}});
   if(actor(this)!==identity)return;
   await request('/announcements/'+this._announcement.id+'/'+action,{method:'POST',body:{preview_id:preview.preview_id,expected_revision:preview.announcement.revision,phones,unit_cost_egp:Number(preview.allowance.unit_cost_egp)}});
   if(actor(this)!==identity)return;
   await this.loadRouteData('announcements');await this.openAnnouncement(this._announcement.id);
   this.showToast(localize('الرسائل في انتظار الإرسال. تابع حالة التسليم من الإعلان.','Messages queued. Check the announcement for delivery status.'),'success');
  }catch(error){if(actor(this)===identity)this.showToast(error.message,'error');}
  finally{this._announcementBusy=false;controls.forEach(button=>{if(button.isConnected)button.disabled=false;});}
 };
 app.openAnnouncementTypeRequest=function(){this._announcementTypeRequestId=crypto.randomUUID();this.showModal(localize("طلب نوع رسالة جديد","Request a message type"),'<form id="annTypeRequestForm" onsubmit="window.centrlyApp.saveAnnouncementTypeRequest(event)" style="display:grid;gap:1rem"><p>'+ localize("اكتب التنبيه الدراسي المطلوب ومثالًا عليه. نراجع الطلب ونقدمه لاعتماد واتساب قبل إتاحته للإرسال من المنصة.","Describe the study notification and give an example. We will review it and submit it for WhatsApp approval before enabling platform sending.") +'</p><label>'+ localize("اسم النوع","Type name") +'<input class="form-input" id="annRequestTitle" maxlength="100" required></label><label>'+ localize("متى تحتاج هذه الرسالة؟","When do you need this message?") +'<textarea class="form-input" id="annRequestDescription" maxlength="2000" required></textarea></label><fieldset><legend>'+ localize("الرسالة موجهة لمين؟","Who is the message for?") +'</legend><label style="display:block;padding:.5rem"><input type="checkbox" name="annRequestRole" value="parent" checked> ' + localize('ولي الأمر','Parent') + '</label><label style="display:block;padding:.5rem"><input type="checkbox" name="annRequestRole" value="student" checked> ' + localize('الطالب','Student') + '</label></fieldset><label>'+ localize("مثال للرسالة","Message example") +'<textarea class="form-input" id="annRequestSample" maxlength="1024" required></textarea></label></form>','<button class="btn btn-primary" style="min-height:44px" form="annTypeRequestForm" type="submit">'+ localize("تسجيل الطلب","Submit request") +'</button>');};
 app.saveAnnouncementTypeRequest=async function(event){event.preventDefault();const control=event.submitter,identity=actor(this);control.disabled=true;try{const result=await request('/announcements/type-requests',{method:'POST',body:{id:this._announcementTypeRequestId,title:document.getElementById('annRequestTitle').value.trim(),description:document.getElementById('annRequestDescription').value.trim(),sample_body:document.getElementById('annRequestSample').value.trim(),recipient_roles:[...document.querySelectorAll('[name=annRequestRole]:checked')].map(el=>el.value)}});if(actor(this)!==identity)return;this.closeModal();await this.loadRouteData('announcements');this.showToast(result.existing_type?localize("نوع الرسالة موجود بالفعل: ","This message type already exists: ")+result.title:result.already_requested?localize("طلبك موجود بالفعل وتحت المراجعة","Your request already exists and is under review."):localize("وصل طلبك للمراجعة","Your request was submitted for review."),'success');}catch(error){if(actor(this)===identity)this.showToast(error.message,'error');if(control.isConnected)control.disabled=false;}};
}
