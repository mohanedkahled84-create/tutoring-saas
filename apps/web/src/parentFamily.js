import {renderParentPortalView,parentPortalSnapshot} from './components/ParentPortalView.js';
import {saveParentBranding} from './components/ParentPortalLoginView.js';
import {portalRequest,portalCache} from './utils/portalSession.js';
import {escapeHtml as esc} from './utils/escapeHtml.js';

const TOKEN='centrly_family_token_v1',CACHE='centrly_family_snapshot_v1',SELECTED='centrly_family_selected_v1';
const request=(path,body)=>portalRequest('/public/family/'+path,{method:'POST',body});
const digest=async token=>Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token)))).map(n=>n.toString(16).padStart(2,'0')).join('');
export function savedFamilyToken(){try{return localStorage.getItem(TOKEN);}catch{return null;}}
export function clearFamilyDevice(){for(const storage of [localStorage,sessionStorage])for(const key of [TOKEN,CACHE,SELECTED])storage.removeItem(key);}
export function adoptFamilySession(token){
 if(!/^[A-Za-z0-9_-]{43}$/.test(token || ''))throw Error('تعذر التحقق من جلسة الأسرة');
 clearFamilyDevice();portalCache.clear('parent');portalCache.clear('student');
 for(const storage of [localStorage,sessionStorage]){
  for(const key of ['centrly_portal_token','centrly_student_portal_token','centrly_portal_last_id'])storage.removeItem(key);
  storage.setItem('centrly_portal_role','parent');storage.setItem('centrly_portal_entry_role','parent');
 }
 localStorage.setItem(TOKEN,token);
}
// Grouping is presentation only, inside an already authorized family directory.
// Each teacher/student record keeps its own immutable ID and server access check.
export function familyGroups(students=[]){
 const groups=new Map();
 for(const student of students){const name=String(student.name || 'الطالب').trim().replace(/\s+/g,' ');const key=name.normalize('NFC');
  if(!groups.has(key))groups.set(key,{key,name,records:[]});groups.get(key).records.push(student);}
 return [...groups.values()];
}
export function renderFamilySelectors(students,selectedId){
 const groups=familyGroups(students),selected=groups.find(g=>g.records.some(s=>s.id===selectedId));
 if(!selected)return '';
 return `<section class="pp-card pp-family" aria-label="اختيار المتابعة"><style>.pp-family{gap:16px}.pp-family label{display:grid;gap:8px;font-weight:700}.pp-family select{width:100%;min-width:0;min-height:52px;padding:10px 12px;border:1px solid #cbd5e1;border-radius:12px;background:#fff;color:#0f172a;font:inherit}.pp-family select:focus-visible{outline:3px solid #2563eb;outline-offset:3px}</style>${groups.length>1?`<label for="family-child">متابعة مين؟<select id="family-child" onchange="window.centrlyApp.selectFamilyStudent(this.value)">${groups.map(g=>`<option value="${esc(g.records[0].id)}" ${g===selected?'selected':''}>${esc(g.name)}</option>`).join('')}</select></label>`:''}${selected.records.length>1?`<label for="family-teacher">عند أي معلم؟<select id="family-teacher" onchange="window.centrlyApp.selectFamilyStudent(this.value)">${selected.records.map(s=>`<option value="${esc(s.id)}" ${s.id===selectedId?'selected':''}>${esc(s.teacher_name || 'المعلم')}${s.student_code?' · '+esc(s.student_code):''}</option>`).join('')}</select></label>`:''}${groups.length===1 && selected.records.length===1?'<p class="pp-subtitle">متابعة الأسرة</p>':''}</section>`;
}
function snapshot(data){return {students:(data.students || []).map(s=>({id:s.id,tenant_id:s.tenant_id,name:s.name,teacher_name:s.teacher_name,student_code:s.student_code})),selected_id:data.selected_id,initial_data:data.initial_data?parentPortalSnapshot(data.initial_data):null,presentation:data.presentation,expires_at:data.expires_at};}
export function registerFamilyActions(app){
 let revision=0;
 const active=(token,version)=>savedFamilyToken()===token && revision===version;
 const paint=data=>{
  if(!data.initial_data?.student){
   app.getAppEl().innerHTML='<main dir="rtl" style="min-height:100dvh;padding:32px 16px;background:#f6f8fb;color:#0f172a;font:16px/1.8 system-ui"><section style="max-width:440px;margin:10vh auto;padding:24px;border:1px solid #e2e8f0;border-radius:24px;background:white"><h1>حساب الأسرة</h1><p>لا توجد متابعات مرتبطة برقمك حاليًا. تواصل مع المعلم لمراجعة الرقم المسجل.</p><button type="button" style="min-height:48px;min-width:80px;font:inherit;border:1px solid #cbd5e1;border-radius:12px;background:white" onclick="window.centrlyApp.handlePortalLogout()">خروج</button></section></main>';return;
  }
  app._portalPresentation=data.presentation;saveParentBranding(data.presentation);app._familyData=data;
  const focused=document.activeElement?.id;
  app.getAppEl().innerHTML=renderParentPortalView({...data.initial_data,portal_presentation:data.presentation},localStorage.getItem('centrly_portal_parent_tab') || 'attendance');
  const hero=app.getAppEl().querySelector('.pp-hero');hero.insertAdjacentHTML('beforebegin',renderFamilySelectors(data.students,data.selected_id));
  if(focused)document.getElementById(focused)?.focus({preventScroll:true});
 };
 app.loadFamilyPortal=async function({force=false,studentId=null,arrival=null,retry=true}={}){
  const token=savedFamilyToken(),version=++revision;if(!token)return false;
  this._familyMode=true;window.__centrlyLoaded=true;
  let cached=null;
  try{
   const hash=await digest(token);if(!active(token,version))return false;
   const stored=JSON.parse(localStorage.getItem(CACHE) || 'null'),selectedId=studentId || localStorage.getItem(SELECTED);
   if(stored?.session===hash && Date.now()-stored.savedAt>=0 && Date.now()-stored.savedAt<86400000 && new Date(stored.data.expires_at).getTime()>Date.now() && (!selectedId || stored.data.selected_id===selectedId)){
    cached=stored.data;paint(cached);
   }else window.renderPortalOpening(this.getAppEl());
   // Paint saved data first, then validate membership and refresh quietly.
   const data=arrival || await request('account',{family_token:token,...(selectedId?{student_id:selectedId}:{})});
   if(!active(token,version))return false;
   if(data.destination){
    const url=new URL(data.destination.origin),base='centerly-eg.com';
    if(url.origin!==data.destination.origin || url.protocol!=='https:' || url.port || !(url.hostname===base || /^[a-z0-9-]+\.centerly-eg\.com$/.test(url.hostname)) || !/^[A-Za-z0-9_-]{43}$/.test(data.destination.ticket))throw Error('تعذر التحقق من وجهة المعلم');
    location.replace(url.origin+'/portal-entry#family='+encodeURIComponent(data.destination.ticket));return true;
   }
   const safe=snapshot(data);
   if(safe.initial_data && (safe.initial_data.student.id!==safe.selected_id || !safe.students.some(s=>s.id===safe.selected_id && s.tenant_id===safe.initial_data.student.tenant_id)))throw Error('تعذر التحقق من المتابعة');
   paint(safe);localStorage.setItem(SELECTED,safe.selected_id || '');
   try{const encoded=JSON.stringify({session:hash,savedAt:Date.now(),data:safe});if(encoded.length<1500000)localStorage.setItem(CACHE,encoded);}catch{}
   history.replaceState(null,'',location.pathname==='/family'?'/family':location.pathname==='/portal-entry'?'/portal-entry':'/portal?role=parent&family=1');return true;
  }catch(error){
   if(!active(token,version))return false;
   if(error.status===401){clearFamilyDevice();this._familyData=null;this.renderPortalLogin(error.message);return false;}
   if(error.status===403){localStorage.removeItem(CACHE);localStorage.removeItem(SELECTED);this._familyData=null;
    if(retry)return this.loadFamilyPortal({force:true,retry:false});
    this.renderPortalLogin(error.message);return false;
   }
   if(cached){const status=document.getElementById('parent-sync-status');if(status)status.textContent='تعذر الاتصال؛ نعرض آخر بيانات محفوظة. جرّب التحديث.';}
   else this.renderPortalLogin(error.message || 'تعذر فتح حساب الأسرة، حاول مجددًا');return false;
  }
 };
 app.selectFamilyStudent=async function(id){
  if(!this._familyData?.students.some(s=>s.id===id))return false;
  return this.loadFamilyPortal({force:true,studentId:id});
 };
 app.loginFamily=async function(phone,password){
  const response=await request('login',{phone,password}),previous=savedFamilyToken();
  if(previous)await request('logout',{family_token:previous});
  adoptFamilySession(response.family_token);return this.loadFamilyPortal();
 };
 app.logoutFamily=function(){
  const token=savedFamilyToken();++revision;clearFamilyDevice();this._familyData=null;
  if(token)void request('logout',{family_token:token}).catch(()=>{
   // Local logout remains immediate; do not silently claim remote revocation offline.
   const alert=document.getElementById('portalLoginAlert');if(alert){alert.hidden=false;alert.textContent='تم الخروج من هذا الجهاز. تعذر إنهاء الجلسة على باقي روابط المعلمين بسبب الاتصال.';}
  });
 };
 window.addEventListener('storage',event=>{
  if(event.key===TOKEN && app._familyData){++revision;localStorage.removeItem(CACHE);app._familyData=null;app.renderPortalLogin('تغيّر حساب الأسرة في نافذة أخرى، سجّل الدخول مجددًا');}
 });
}
export async function redeemFamilyEntry(ticket){
 const arrival=await request('handoff',{ticket});adoptFamilySession(arrival.family_token);return arrival;
}
