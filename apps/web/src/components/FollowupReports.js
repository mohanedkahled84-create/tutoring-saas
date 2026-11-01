import {escapeHtml as e} from '../utils/escapeHtml.js';
import {request as ownerRequest} from '../services/api.js';

// Prepared text is transient: no local storage, delivery state or provider call.
export function mountFollowupReports(host,{groups=[],allowSend=false,request,onFailure=()=>{},initial={}}){
 let generation=0,disposed=false,page=1,detail=null,prepared=null;
 const now=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
 let filter={from:initial.from || now.slice(0,8)+'01',to:initial.to || now,group_id:initial.group_id || '',q:initial.q || ''};
 host.innerHTML=`<style>
 .followup{font-size:1rem;line-height:1.7;color:var(--centrly-text,#334155);min-width:0}.followup *{box-sizing:border-box}.followup .fu-filters{display:flex;flex-wrap:wrap;gap:.75rem;align-items:end}.followup label{display:grid;gap:.3rem;flex:1 1 140px;min-width:0}.followup input,.followup select,.followup textarea{width:100%;min-width:0;font:inherit;min-height:44px;padding:.55rem;border:1px solid var(--centrly-border,#cbd5e1);border-radius:10px;background:var(--centrly-surface,#fff);color:inherit}.followup button,.followup a.fu-open{min-height:44px;padding:.55rem 1rem;border-radius:10px;font:inherit;cursor:pointer;border:1px solid var(--centrly-border,#cbd5e1);background:var(--centrly-surface,#fff);color:inherit;display:inline-flex;align-items:center;justify-content:center;text-decoration:none}.followup .fu-primary{background:var(--centrly-blue-700,#1d4ed8)!important;color:white!important;border-color:transparent!important}.followup button:disabled{opacity:.55;cursor:wait}.followup :focus-visible{outline:3px solid var(--centrly-blue-600,#2563eb);outline-offset:3px}.followup .fu-list{display:grid;gap:.75rem;margin-block:1rem}.followup .fu-card{padding:1rem;border:1px solid var(--centrly-border,#e2e8f0);border-radius:14px;overflow-wrap:anywhere;background:var(--centrly-surface,#fff)}.followup h3,.followup p{margin:.3rem 0 .75rem}.followup .fu-actions{display:flex;flex-wrap:wrap;gap:.5rem;align-items:center}.followup .fu-muted{font-size:.875rem;color:var(--centrly-text,#475569)}.followup .fu-metrics{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,210px),1fr));gap:.75rem}.followup .fu-error{color:var(--centrly-danger,#b91c1c)}.followup textarea{min-height:240px;resize:vertical}.followup [hidden]{display:none!important}
 </style><div class="followup"><h2>متابعة الطلاب</h2><p class="fu-muted">اختَر الطالب والفترة لمراجعة الحضور والدرجات وحالة تسليم الواجبات.</p>
 <form class="fu-filters"><label>المجموعة<select name="group_id"><option value="">كل مجموعاتي</option>${groups.map(g=>`<option value="${e(g.id)}" ${g.id===filter.group_id?'selected':''}>${e(g.name)}</option>`).join('')}</select></label><label>من<input name="from" type="date" value="${e(filter.from)}" required></label><label>إلى<input name="to" type="date" value="${e(filter.to)}" required></label><label>اسم الطالب أو الكود<input name="q" value="${e(filter.q)}" maxlength="100" type="search"></label><button type="submit">عرض الطلاب</button></form><p class="fu-error" role="alert" data-error></p><div data-content aria-live="polite"></div></div>`;
 const form=host.querySelector('form'),content=host.querySelector('[data-content]'),errorHost=host.querySelector('[data-error]');
 const alive=n=>!disposed && host.isConnected && n===generation;
 const fail=error=>{errorHost.textContent=error.message;onFailure(error);};
 const params=(extra={})=>new URLSearchParams(Object.entries({...filter,...extra}).filter(([,v])=>v!=='' && v!==undefined)).toString();
 form.onsubmit=event=>{event.preventDefault();const data=Object.fromEntries(new FormData(form));if(data.from>data.to){errorHost.textContent='تاريخ البداية يجب أن يسبق النهاية';return;}filter=data;page=1;load();};
 // Any changed input removes a previous recipient/message immediately.
 form.oninput=()=>{generation++;detail=null;prepared=null;content.innerHTML='<p>اضغط «عرض الطلاب» لتطبيق الاختيار الجديد.</p>';};
 async function load(){
  const n=++generation;detail=null;prepared=null;errorHost.textContent='';content.innerHTML='<p role="status">تحميل الطلاب…</p>';
  try{const result=await request('?'+params({page}));if(!alive(n))return;
   content.innerHTML=`<p class="fu-muted">${e(result.total)} متابعة ضمن مجموعاتك</p><div class="fu-list">${result.rows.map((r,i)=>`<article class="fu-card"><h3>${e(r.student_name)}</h3><p class="fu-muted">${e(r.group_name)}${r.student_code?' · '+e(r.student_code):''}</p><button type="button" data-student="${i}">عرض تقرير الطالب</button></article>`).join('') || '<p>لا يوجد طلاب مطابقون لهذا الاختيار.</p>'}</div><div class="fu-actions">${page>1?'<button type="button" data-prev>السابق</button>':''}<span>صفحة ${page}</span>${result.has_more?'<button type="button" data-next>التالي</button>':''}</div>`;
   content.querySelectorAll('[data-student]').forEach(b=>b.onclick=()=>show(result.rows[Number(b.dataset.student)]));
   content.querySelector('[data-prev]')?.addEventListener('click',()=>{page--;load();});content.querySelector('[data-next]')?.addEventListener('click',()=>{page++;load();});
  }catch(error){if(!alive(n))return;content.innerHTML='<button type="button" data-retry>حاول مجددًا</button>';content.querySelector('button').onclick=load;fail(error);}
 }
 function metrics(r){const a=r.attendance,g=r.grades,h=r.homework;return `<div class="fu-metrics"><article class="fu-card"><h3>الحضور</h3><p>${a.total?`${e(a.present)} حاضر · ${e(a.absent)} غائب`:'لا توجد حصص منتهية'}</p>${a.total?`<p class="fu-muted">${e(a.unrecorded)} لم يُرصد بعد، من ${e(a.total)} حصة منتهية</p>`:''}</article><article class="fu-card"><h3>الدرجات</h3><p>${g.total?`${e(g.recorded)} مسجلة · ${e(g.unrecorded)} لم تُرصد بعد`:'لا توجد اختبارات'}</p>${g.latest?`<p class="fu-muted">آخر نتيجة: ${e(g.latest.title)} · ${e(g.latest.score)} / ${e(g.latest.max_score)}</p>`:''}</article><article class="fu-card"><h3>تسليم الواجبات</h3><p>${h.total?`${e(h.submitted)} سُلّم · ${e(h.not_submitted)} لم يُسلّم`:'لا توجد واجبات منشورة في الفترة'}</p>${h.total?`<p class="fu-muted">${e(h.on_time)} في الموعد · ${e(h.late)} متأخر · ${e(h.without_deadline)} بدون موعد محدد<br>${e(h.overdue)} لم يُسلّم وفات موعده</p>`:''}</article></div>`;}
 async function show(row){
  const n=++generation;prepared=null;errorHost.textContent='';content.innerHTML='<p role="status">تحميل تقرير الطالب…</p>';
  try{const r=await request('?'+params({student_id:row.student_id,group_id:row.group_id}));if(!alive(n))return;detail=r;
   content.innerHTML=`<div class="fu-actions"><button type="button" data-back>العودة للطلاب</button></div><h3 style="margin-top:1rem">${e(r.student_name)}</h3><p class="fu-muted">${e(r.group_name)} · ${e(r.from)} إلى ${e(r.to)}</p>${metrics(r)}<p class="fu-muted">الحضور للحصص المنتهية فقط؛ الاختبارات الملغاة مستبعدة. الواجبات حسب تاريخ نشرها في الفترة. عدم الرصد لا يعني الغياب أو درجة صفر.</p>${allowSend?'<section class="fu-card"><h3>تجهيز رسالة واتساب</h3><label>المستلم<select data-recipient><option value="parent">ولي الأمر</option><option value="student">الطالب</option></select></label><p class="fu-muted">راجع الرسالة ثم افتح واتساب وأرسلها بنفسك.</p><button type="button" class="fu-primary" data-prepare>معاينة الرسالة</button><div data-preview></div></section>':'<p class="fu-muted">هذه الصلاحية للعرض فقط. فتح واتساب يحتاج سماح المدرس.</p>'}`;
   content.querySelector('[data-back]').onclick=load;
   const recipient=content.querySelector('[data-recipient]');if(recipient)recipient.onchange=()=>{generation++;prepared=null;content.querySelector('[data-preview]').innerHTML='';const b=content.querySelector('[data-prepare]');b.disabled=false;};
   content.querySelector('[data-prepare]')?.addEventListener('click',prepare);
  }catch(error){if(!alive(n))return;content.innerHTML='<button type="button">العودة للطلاب</button>';content.querySelector('button').onclick=load;fail(error);}
 }
 async function prepare(){
  const button=content.querySelector('[data-prepare]');if(button.disabled || !detail)return;const n=++generation;button.disabled=true;errorHost.textContent='';prepared=null;const preview=content.querySelector('[data-preview]');preview.innerHTML='';
  try{const r=await request('/prepare',{student_id:detail.student_id,group_id:detail.group_id,from:detail.from,to:detail.to,recipient:content.querySelector('[data-recipient]').value});if(!alive(n))return;
   // Only the server-generated fixed WhatsApp URL can become a link.
   const url=new URL(r.whatsapp_url);if(url.origin!=='https://wa.me' || !/^\/[1-9][0-9]{7,14}$/.test(url.pathname))throw new Error('تعذر تجهيز رابط واتساب');
   prepared={expires:Date.now()+120000};preview.innerHTML=`<p>المستلم: <b dir="ltr">${e(r.recipient_phone)}</b></p><label>نص الرسالة<textarea readonly>${e(r.message)}</textarea></label><div class="fu-actions" style="margin-top:.75rem"><a class="fu-open fu-primary" href="${e(url.href)}" target="_blank" rel="noopener noreferrer">فتح واتساب</a><button type="button" data-copy>نسخ الرسالة</button></div><p class="fu-muted" data-handoff>فتح واتساب لا يؤكد إرسال الرسالة أو تسليمها. إن لم يفتح، انسخ الرسالة وافتح واتساب بنفسك.</p>`;
   preview.querySelector('a').onclick=event=>{if(!prepared || Date.now()>prepared.expires){event.preventDefault();preview.innerHTML='<p>مرّ وقت على المعاينة. اضغط «معاينة الرسالة» لمراجعة أحدث البيانات.</p>';prepared=null;return;}preview.querySelector('[data-handoff]').textContent='أكمل الإرسال داخل واتساب. المنصة لا تؤكد الإرسال أو التسليم.';};
   preview.querySelector('[data-copy]').onclick=async()=>{try{await navigator.clipboard.writeText(r.message);preview.querySelector('[data-handoff]').textContent='تم نسخ الرسالة؛ أرسلها من واتساب بنفسك.';}catch{preview.querySelector('textarea').focus();preview.querySelector('textarea').select();preview.querySelector('[data-handoff]').textContent='حددنا الرسالة؛ انسخها من جهازك.';}};
  }catch(error){if(alive(n))fail(error);}finally{if(alive(n))button.disabled=false;}
 }
 if(initial.student_id && initial.group_id)show(initial);else load();return ()=>{disposed=true;generation++;prepared=null;detail=null;};
}
export function registerFollowupOwnerActions(app){
 app.openFollowupReports=function(initial={}){
  this._stopFollowupReports?.();
  this.showModal('متابعة الطلاب','<div id="owner-followup-reports"></div>','<button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>');
  this._stopFollowupReports=mountFollowupReports(document.getElementById('owner-followup-reports'),{groups:this.groups || [],allowSend:true,initial,request:(suffix,body)=>ownerRequest(`/assistants/followup${suffix}`,body===undefined?{signal:AbortSignal.timeout(15000)}:{method:'POST',body,signal:AbortSignal.timeout(15000)})});
 };
}
