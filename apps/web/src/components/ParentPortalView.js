import { escapeHtml as esc } from '../utils/escapeHtml.js';
import { getIcon } from '../utils/icons.js';

// Keep only the fields needed by a read-only parent dashboard in the device cache.
export function parentPortalSnapshot(data) {
  const pick = (value, fields) => Object.fromEntries(fields.filter(key => value?.[key] !== undefined).map(key => [key,value[key]]));
  const list = (value, fields) => (Array.isArray(value) ? value : []).filter(Boolean).map(row => pick(row,fields));
  return {
    student:pick(data.student,['id','tenant_id','name','student_code','group_name','teacher_name','subject_name','teacher_phone','contact_phone']),
    summary:pick(data.summary,['total_sessions','attended_count','absent_count','attendance_rate','quiz_average_percentage']),
    teacher_phone:data.teacher_phone, contact_phone:data.contact_phone,
    sessions:list(data.sessions,['session_number','session_date','attended','homework_status','comment']),
    quizzes:list(data.quizzes,['title','score','max_score','date','tier','note']),
    materials:list((data.materials || []).filter(h => h && (h.is_homework || h.type === 'homework')),['title','type','is_homework','submission_status','submitted_at','due_date']),
  };
}

// Date-only deadlines mean the end of that Cairo calendar day, not UTC midnight.
export function parentHomeworkTiming(homework) {
  if (!homework.submitted_at || !homework.due_date) return '';
  const submitted = new Date(homework.submitted_at);
  if (!Number.isFinite(submitted.getTime())) return '';
  const due = String(homework.due_date);
  if (/^\d{4}-\d{2}-\d{2}$/.test(due)) {
    const parsed = new Date(due + 'T00:00:00Z');
    if (!Number.isFinite(parsed.getTime()) || parsed.toISOString().slice(0,10) !== due) return '';
    const day = new Intl.DateTimeFormat('en-CA', {timeZone:'Africa/Cairo', year:'numeric', month:'2-digit', day:'2-digit'}).format(submitted);
    return day > due ? 'متأخر' : 'في الموعد';
  }
  // A timestamp without a timezone cannot support a reliable lateness judgement.
  if (!/(Z|[+-]\d{2}:?\d{2})$/i.test(due)) return '';
  const deadline = new Date(due);
  return Number.isFinite(deadline.getTime()) ? (submitted > deadline ? 'متأخر' : 'في الموعد') : '';
}
const dateLabel = value => {
  if (!value) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return value;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toLocaleString('ar-EG', {timeZone:'Africa/Cairo', dateStyle:'medium', timeStyle:'short'}) : '';
};
const submitted = h => Boolean(h.submitted_at || ['approved','pending','rejected','submitted'].includes(h.submission_status));
const empty = text => `<p class="pp-empty">${esc(text)}</p>`;
const pill = (text, tone='') => `<span class="pp-pill ${tone}">${esc(text)}</span>`;
const metric = (label, value, detail='') => `<div class="pp-metric"><span>${esc(label)}</span><strong>${esc(value ?? '—')}</strong>${detail ? `<small>${esc(detail)}</small>` : ''}</div>`;

export function renderParentPortalView(data = {}, activeTab = 'attendance') {
  if (data.error || !data.student) return `<main dir="rtl" style="max-width:440px;margin:12vh auto;padding:24px;font:16px/1.8 system-ui;color:#0f172a"><h1 style="font-size:22px">${!data.error || /غير صالح|منتهي/.test(data.error) ? 'رابط غير صالح أو منتهي الصلاحية' : 'تعذر فتح المتابعة'}</h1><p>${esc(data.error || 'تأكد من رابط المتابعة الخاص بك.')}</p><button style="min-height:48px;padding:8px 20px" onclick="location.reload()">إعادة المحاولة</button></main>`;
  const s = data.student, summary = data.summary || {}, presentation = data.portal_presentation;
  const sessions = Array.isArray(data.sessions) ? data.sessions : [];
  const quizzes = Array.isArray(data.quizzes) ? data.quizzes : [];
  const homework = (Array.isArray(data.materials) ? data.materials : []).filter(h => h.is_homework || h.type === 'homework');
  const completed = homework.filter(submitted).length;
  const palettes = {navy:'#0f172a',slate:'#0f172a',emerald:'#065f46',red:'#991b1b',purple:'#581c87'};
  const color = /^#[0-9a-f]{6}$/i.test(presentation?.custom_primary_color || '') ? presentation.custom_primary_color : palettes[presentation?.theme_preset] || '#0f172a';
  // Color is decorative; foreground contrast never depends on an arbitrary teacher color.
  const phone = String(s.teacher_phone || data.teacher_phone || s.contact_phone || data.contact_phone || '').replace(/\D/g,'');
  const contact = /^01\d{9}$/.test(phone) ? '2'+phone : phone;
  const tab = ['attendance','quizzes','homework'].includes(activeTab) ? activeTab : activeTab === 'materials' ? 'homework' : 'attendance';
  const tabs = [['attendance','الحضور'],['quizzes','الدرجات'],['homework','الواجبات']];
  return `<style>
    .pp{--ink:#0f172a;--muted:#475569;--line:#e2e8f0;box-sizing:border-box;min-height:100dvh;background:#f6f8fb;color:var(--ink);font-family:inherit;font-size:16px;line-height:1.7;padding:16px 16px max(24px,env(safe-area-inset-bottom));direction:rtl}
    .pp *{box-sizing:border-box}.pp-wrap{max-width:780px;margin:auto;display:grid;gap:20px}.pp h1,.pp h2,.pp h3,.pp p{margin:0}.pp h1{font-size:26px;line-height:1.5}.pp h2{font-size:19px}.pp h3{font-size:16px}.pp small{font-size:13px;color:var(--muted)}.pp p,.pp h1,.pp h2,.pp h3,.pp span{overflow-wrap:anywhere}
    .pp-top,.pp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.pp-brand{font-size:15px;font-weight:800}.pp-mark{color:#1d4ed8}.pp-actions{display:flex;gap:8px}.pp button,.pp a{font:inherit;touch-action:manipulation}.pp-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;min-width:48px;padding:10px 14px;border:1px solid var(--line);border-radius:14px;background:white;color:var(--ink);text-decoration:none;cursor:pointer}.pp button:disabled{opacity:.6;cursor:wait}.pp button:focus-visible,.pp a:focus-visible{outline:3px solid #2563eb;outline-offset:3px}.pp button:active,.pp a:active{background:#e2e8f0}
    .pp-hero{position:relative;background:white;border:1px solid var(--line);border-top:4px solid ${color};border-radius:22px;padding:24px;display:grid;gap:10px;box-shadow:0 4px 20px #0f172a04}.pp-eyebrow{color:var(--muted);font-size:14px}.pp-subtitle{color:var(--muted);font-size:15px}.pp-code{direction:ltr;unicode-bidi:isolate}.pp-sync{font-size:14px;color:var(--muted)}.pp-sync:empty{display:none}
    .pp-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pp-metric{border:1px solid var(--line);border-radius:18px;background:white;padding:18px;display:grid;gap:5px;min-width:0}.pp-metric>span{font-size:14px;color:var(--muted)}.pp-metric strong{font-size:26px;line-height:1.4;font-variant-numeric:tabular-nums}.pp-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;background:#e9eef5;padding:6px;border-radius:18px;scroll-margin:16px}.pp-nav button{border:0;min-height:48px;padding:10px 4px;background:transparent;border-radius:13px;color:#475569;font-weight:700;cursor:pointer}.pp-nav button[aria-selected=true]{background:white;color:#0f172a;box-shadow:0 2px 6px #0f172a0a}
    .pp-panel{display:flex;flex-direction:column;gap:14px;min-width:0}.pp-panel[hidden]{display:none}.pp-card{padding:20px;background:white;border:1px solid var(--line);border-radius:18px;display:grid;gap:10px;min-width:0}.pp-pill{display:inline-block;width:fit-content;font-size:13px;font-weight:700;border-radius:9px;padding:4px 10px;background:#f1f5f9;color:#334155}.pp-pill.good{background:#edf7f1;color:#166534}.pp-pill.attention{background:#fff7ed;color:#9a3412}.pp-note{font-size:15px;color:var(--muted);padding-top:8px;border-top:1px solid #f1f5f9}.pp-empty{padding:32px 20px;border:1px dashed #cbd5e1;border-radius:18px;color:var(--muted);text-align:center;background:white}.pp-footer{display:grid;gap:12px;padding:8px 0;text-align:center;color:var(--muted);font-size:13px}.pp-contact{width:100%}
    @media(min-width:700px){.pp{padding:28px}.pp-summary{grid-template-columns:repeat(4,minmax(0,1fr))}.pp-hero{padding:28px}}@media(prefers-reduced-motion:reduce){.pp *{scroll-behavior:auto}}
  </style><main class="pp" aria-label="متابعة ولي الأمر"><div class="pp-wrap">
    <header class="pp-top"><span class="pp-brand"><span class="pp-mark">سـ</span> ${esc(presentation?.display_title || 'سنترلي')}<br><small>متابعة ولي الأمر</small></span><div class="pp-actions"><button class="pp-button" id="parent-refresh-data-btn" type="button" aria-label="تحديث بيانات المتابعة" title="تحديث بيانات المتابعة" onclick="window.centrlyApp.reloadParentPortal()">${getIcon('refresh',20,'currentColor')}</button><button class="pp-button" type="button" onclick="window.centrlyApp.handlePortalLogout()">خروج</button></div></header>
    <section class="pp-hero" aria-labelledby="pp-student"><p class="pp-eyebrow">متابعة ابنك، في مكان واحد</p><h1 id="pp-student">${esc(s.name)}</h1><p class="pp-subtitle">${esc(s.teacher_name || presentation?.display_title || 'متابعة الطالب')}${s.subject_name ? ` · ${esc(s.subject_name)}` : ''}</p><div class="pp-row"><span class="pp-subtitle">${esc(s.group_name || '')}</span>${s.student_code ? `<small>كود الطالب <b class="pp-code">${esc(s.student_code)}</b></small>` : ''}</div><p id="parent-sync-status" class="pp-sync" role="status" aria-live="polite"></p></section>
    <section class="pp-summary" aria-label="ملخص المتابعة">${metric('الحضور',summary.total_sessions ? summary.attendance_rate : '—',summary.total_sessions ? `${summary.attended_count ?? 0} من ${summary.total_sessions} حصص` : 'لا توجد حصص مسجلة')}${metric('الغياب',summary.total_sessions ? summary.absent_count ?? 0 : '—')}${metric('واجبات تم تسليمها',`${completed} / ${homework.length}`)}${metric('متوسط الدرجات',quizzes.length ? summary.quiz_average_percentage ?? '—' : '—')}</section>
    <nav class="pp-nav" role="tablist" aria-label="أقسام المتابعة" onkeydown="window.parentPortalTabKey(event)">${tabs.map(([id,label])=>`<button type="button" role="tab" id="tab-btn-${id}" aria-controls="tab-content-${id}" aria-selected="${id===tab}" tabindex="${id===tab?'0':'-1'}" onclick="window.switchParentPortalTab('${id}')">${label}</button>`).join('')}</nav>
    <section class="pp-panel" id="tab-content-attendance" role="tabpanel" aria-labelledby="tab-btn-attendance" ${tab==='attendance'?'':'hidden'}><h2>سجل الحضور</h2>${sessions.length ? sessions.map(s=>`<article class="pp-card"><div class="pp-row"><h3>حصة ${esc(s.session_number ?? '')}</h3>${pill(s.attended?'حاضر':'غائب',s.attended?'good':'attention')}</div><small>${esc(dateLabel(s.session_date))}</small>${s.attended && ['done','partial','missing'].includes(s.homework_status)?`<p class="pp-subtitle">الواجب: ${s.homework_status==='done'?'تم التسليم بالكامل':s.homework_status==='partial'?'تسليم جزئي':'لم يُسلّم'}</p>`:''}${s.comment?`<p class="pp-note">ملاحظة المعلم: ${esc(s.comment)}</p>`:''}</article>`).join(''):empty('لا توجد حصص مسجلة حتى الآن.')}</section>
    <section class="pp-panel" id="tab-content-quizzes" role="tabpanel" aria-labelledby="tab-btn-quizzes" ${tab==='quizzes'?'':'hidden'}><h2>الدرجات والنتائج</h2>${quizzes.length?quizzes.map(q=>`<article class="pp-card"><div class="pp-row"><h3>${esc(q.title)}</h3>${pill(`${q.score ?? '—'} / ${q.max_score ?? '—'}`)}</div>${q.date?`<small>${esc(dateLabel(q.date))}</small>`:''}${q.tier?`<p class="pp-subtitle">${esc(q.tier)}</p>`:''}${q.note?`<p class="pp-note">ملاحظة المعلم: ${esc(q.note)}</p>`:''}</article>`).join(''):empty('لم تُرصد درجات بعد. ستظهر هنا بعد رصدها من المعلم.')}</section>
    <section class="pp-panel" id="tab-content-homework" role="tabpanel" aria-labelledby="tab-btn-homework" ${tab==='homework'?'':'hidden'}><h2>متابعة تسليم الواجبات</h2><p class="pp-subtitle">حالة التسليم وموعده، بخطوة بسيطة.</p>${homework.length?homework.map(h=>{const done=submitted(h),timing=done?parentHomeworkTiming(h):'';return `<article class="pp-card"><h3>${esc(h.title)}</h3><div class="pp-row">${pill(done?'تم التسليم':'لم يُسلّم بعد',done?'good':'attention')}${timing?pill(timing,timing==='متأخر'?'attention':''):''}</div>${h.due_date?`<p class="pp-subtitle">آخر موعد: ${esc(dateLabel(h.due_date))}</p>`:''}${h.submitted_at?`<p class="pp-subtitle">وقت التسليم: ${esc(dateLabel(h.submitted_at))}</p>`:''}${h.submission_status==='rejected'?'<p class="pp-note">طلب المعلم إعادة التسليم.</p>':''}</article>`;}).join(''):empty('لا توجد واجبات مطلوبة حتى الآن.')}</section>
    <footer class="pp-footer">${/^\d{10,15}$/.test(contact)?`<a class="pp-button pp-contact" href="https://wa.me/${contact}" target="_blank" rel="noopener noreferrer">التواصل مع المعلم ${getIcon('chevronLeft',18,'currentColor')}</a>`:''}<span>متابعة أبسط، وخطوة أقرب لابنك · سنترلي</span></footer>
  </div></main>`;
}

if (typeof window !== 'undefined') {
  window.switchParentPortalTab = function(name) {
    const target = name === 'materials' ? 'homework' : name;
    if (!['attendance','quizzes','homework'].includes(target)) return;
    try { localStorage.setItem('centrly_portal_parent_tab',target); sessionStorage.setItem('centrly_portal_parent_tab',target); } catch {}
    for (const tab of ['attendance','quizzes','homework']) {
      const panel = document.getElementById('tab-content-'+tab), button = document.getElementById('tab-btn-'+tab);
      if (panel) panel.hidden = tab !== target;
      if (button) { button.setAttribute('aria-selected',String(tab===target)); button.tabIndex=tab===target?0:-1; }
    }
  };
  window.parentPortalTabKey = function(event) {
    if (!['ArrowLeft','ArrowRight','Home','End'].includes(event.key)) return;
    const tabs = ['attendance','quizzes','homework'], index = tabs.findIndex(id=>event.target.id==='tab-btn-'+id);
    if (index<0) return;
    event.preventDefault();
    const next = event.key==='Home'?0:event.key==='End'?2:(index+(event.key==='ArrowLeft'?1:2))%3;
    window.switchParentPortalTab(tabs[next]); document.getElementById('tab-btn-'+tabs[next])?.focus();
  };
}
