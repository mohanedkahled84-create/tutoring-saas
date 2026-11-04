var L=typeof window<"u"&&window.location.hostname||"",He=L==="localhost"||L==="127.0.0.1"||L.startsWith("192.168.")||L.startsWith("10.")||/^172\.(1[6-9]|2\d|3[01])\./.test(L)||L.endsWith(".local"),N=typeof window<"u"&&window.__CENTRLY_API_URL__||(He?L&&L!=="localhost"&&L!=="127.0.0.1"?`http://${L}:3000/api`:"http://localhost:3000/api":"https://tutoring-backend-production-c8dd.up.railway.app/api"),U=null;function $e(e,r=30){if(!e)return!0;try{let o=e.split(".");if(o.length!==3)return!1;let t=o[1].replace(/-/g,"+").replace(/_/g,"/"),n=decodeURIComponent(atob(t).split("").map(d=>"%"+("00"+d.charCodeAt(0).toString(16)).slice(-2)).join("")),i=JSON.parse(n);return i.exp?Date.now()>=i.exp*1e3-r*1e3:!1}catch{return!1}}async function ae(e=!1){try{let r=typeof localStorage<"u"?localStorage.getItem("centrly_token"):null;if(!e&&r&&!$e(r,60)){let n=typeof localStorage<"u"?localStorage.getItem("centrly_refresh_token"):null,i=typeof localStorage<"u"?localStorage.getItem("centrly_user"):null,d=null;try{d=i?JSON.parse(i):null}catch{}return{token:r,refresh_token:n,user:d}}let o=typeof localStorage<"u"&&localStorage.getItem("centrly_refresh_token")||typeof sessionStorage<"u"&&sessionStorage.getItem("centrly_refresh_token");if(!o)return null;let s=await fetch(`${N}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refresh_token:o})}),t=await s.json().catch(()=>({}));if(s.ok&&t.token){try{if(typeof localStorage<"u"&&(localStorage.setItem("centrly_token",t.token),t.refresh_token&&localStorage.setItem("centrly_refresh_token",t.refresh_token),localStorage.setItem("centrly_logged_in","1"),t.user)){let n=localStorage.getItem("centrly_user"),i=n?JSON.parse(n):{};localStorage.setItem("centrly_user",JSON.stringify({...i,...t.user}))}if(typeof sessionStorage<"u"&&(sessionStorage.setItem("centrly_token",t.token),t.refresh_token&&sessionStorage.setItem("centrly_refresh_token",t.refresh_token),sessionStorage.setItem("centrly_logged_in","1"),t.user)){let n=sessionStorage.getItem("centrly_user"),i=n?JSON.parse(n):{};sessionStorage.setItem("centrly_user",JSON.stringify({...i,...t.user}))}}catch{}return t}if(s.status===401){let n=String(t?.error?.message||t?.message||t?.error||"").toLowerCase();if(n.includes("invalid_refresh_token")||n.includes("already used")||n.includes("token not found")||n.includes("refresh token revoked"))try{typeof localStorage<"u"&&(localStorage.removeItem("centrly_token"),localStorage.removeItem("centrly_refresh_token")),typeof sessionStorage<"u"&&(sessionStorage.removeItem("centrly_token"),sessionStorage.removeItem("centrly_refresh_token"))}catch{}}return null}catch(r){return console.warn("Silent refresh network exception:",r),null}}async function _e(e=!1){return U&&!e||(U=(async()=>{try{return typeof navigator<"u"&&navigator.locks&&navigator.locks.request?await navigator.locks.request("centrly_auth_refresh_lock",{timeout:1e4},async()=>await ae(e)).catch(r=>(console.warn("[performSilentRefresh] Web Lock fallback:",r),ae(e))):await ae(e)}finally{U=null}})()),U}async function O(e,r={}){if(typeof window<"u"&&window.__CENTRLY_DELEGATED_REQUEST__)return window.__CENTRLY_DELEGATED_REQUEST__(e,r);let o=r.body;o&&typeof o=="object"&&!(o instanceof FormData)&&!(o instanceof Blob)&&(o=JSON.stringify(o));let s={"Content-Type":"application/json",...r.headers};try{if(!(e.includes("/auth/login")||e.includes("/auth/signup")||e.includes("/auth/verify-email")||e.includes("/auth/forgot-password")||e.includes("/auth/reset-password")||e.startsWith("/public/"))){let n=typeof localStorage<"u"&&localStorage.getItem("centrly_token")||typeof sessionStorage<"u"&&sessionStorage.getItem("centrly_token");if((!n||$e(n,15))&&!r._retry){let i=await _e();i&&i.token&&(n=i.token)}n&&!s.Authorization&&!s.authorization&&(s.Authorization=`Bearer ${n}`)}}catch{}try{let t=await fetch(`${N}${e}`,{credentials:"include",...r,headers:s,body:o}),n=await t.json().catch(()=>({}));if(!t.ok&&(e.startsWith("/quizzes")||e.startsWith("/platform"))&&!r._fallbackAttempted)try{let i=await fetch("/api"+e,{credentials:"same-origin",...r,headers:s,body:o,_fallbackAttempted:!0});if(i.ok){let d=await i.json().catch(()=>null);if(d&&d.success)return d}}catch{}if(!t.ok){if(t.status===401&&!(e.includes("/auth/login")||e.includes("/auth/refresh")||e.includes("/auth/signup")||e.startsWith("/public/"))&&!r._retry){let l=await _e(!0);if(l&&l.token){let c={...s,Authorization:`Bearer ${l.token}`};return await O(e,{...r,headers:c,_retry:!0})}}let i=`Request failed with status ${t.status}`;typeof n.error=="string"?i=n.error:n.error&&typeof n.error=="object"?Array.isArray(n.error.details)&&n.error.details.length>0?i=n.error.details.map(p=>p.message||p.field||JSON.stringify(p)).join(" • "):n.error.message&&(i=n.error.message):n.message&&(i=n.message),t.status===401&&(i.includes("token")||i.includes("UNAUTHORIZED")||i.includes("status 401"))&&(i="انتهت صلاحية الجلسة لأسباب أمنية. يرجى تسجيل الدخول مجدداً.");let d=new Error(i);throw n.error&&typeof n.error=="object"&&(n.error.code&&(d.code=n.error.code),n.error.email&&(d.email=n.error.email)),d.status=t.status,d.data=n,d}return n}catch(t){throw console.error(`API Error [${e}]:`,t),t}}function m(e){return e==null?"":String(e).replace(/[&<>"']/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[r])}function Z(e={},r="student",{showRank:o=!0,showContact:s=!1}={}){let t=e.preferences||{},n=e.summary||{},i=[],d=(p,l)=>`<section style="border:1px solid var(--centrly-line,#e2e8f0);border-radius:16px;background:var(--centrly-surface,#fff);padding:18px;color:var(--centrly-ink,#0f172a);min-width:0;overflow-wrap:anywhere"><h3 style="font-size:1rem;margin:0 0 .6rem">${p}</h3>${l}</section>`;if(t.welcome_message&&i.push(d("رسالة المعلم",`<p style="white-space:pre-wrap;line-height:1.8;margin:0">${m(t.welcome_message)}</p>`)),o&&(r==="parent"?t.show_parent_rank===!0:t.show_student_rank!==!1)&&Object.hasOwn(n,"student_rank")&&i.push(d(r==="parent"?"ترتيب ابنك في المجموعة":"ترتيبك في المجموعة",`<p style="margin:0">${Number.isInteger(n.student_rank)&&n.student_rank>0?`المركز ${Number(n.student_rank)} من ${Number(n.group_size)} طالبًا`:"يظهر الترتيب بعد رصد الحضور والدرجات"} · هذا الشهر</p>`)),r==="student"&&t.show_student_leaderboard===!0&&Array.isArray(e.leaderboard?.entries)&&e.leaderboard.entries.length&&i.push(d("أوائل المجموعة هذا الشهر",`<ol style="list-style:none;padding:0;margin:0;display:grid;gap:.6rem">${e.leaderboard.entries.map(p=>`<li style="display:flex;gap:.75rem;align-items:center"><strong style="min-width:32px">${Number(p.position)}</strong><span>${m(p.name)}</span></li>`).join("")}</ol>`)),t.show_upcoming_sessions!==!1&&e.upcoming_sessions?.length&&i.push(d("الحصص القادمة",e.upcoming_sessions.map(p=>`<p style="margin:.5rem 0">${m(p.group_name)} · ${m(p.session_date)} ${p.start_time?"· "+m(String(p.start_time).slice(0,5)):""}</p>`).join(""))),t.show_announcements!==!1&&e.announcements?.length&&i.push(d("تنبيهات المعلم",e.announcements.map(p=>`<article style="margin:.75rem 0"><strong>${m(p.title)}</strong><p style="white-space:pre-wrap;margin:.25rem 0;line-height:1.8">${m(p.body)}</p></article>`).join(""))),s&&t.show_teacher_contact!==!1){let p=String(e.teacher_phone||e.student?.teacher_phone||"").replace(/\D/g,"");/^01\d{9}$/.test(p)&&(p="2"+p),/^\d{10,15}$/.test(p)&&i.push(d("التواصل مع المعلم",`<a href="https://wa.me/${p}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;min-height:44px">تواصل عبر واتساب</a>`))}return i.length?`<div data-portal-home-summary style="display:grid;gap:14px;margin:16px 0">${i.join("")}</div>`:""}function w(e,r=18,o="currentColor",s=""){let t=r,n=o,i=s?`class="${s}"`:"";return{sessions:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,calendar:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,dashboard:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,center:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 10h2"/><path d="M9 14h2"/><path d="M9 18h2"/><path d="M15 10h2"/><path d="M15 14h2"/><path d="M15 18h2"/></svg>`,groups:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,students:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,cards:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>`,reports:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,risk:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,whatsapp:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,billing:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,activity:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,assistants:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-1.5-1.5"/></svg>`,teachers:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,homework:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,book:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,file:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,add:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,edit:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,delete:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,print:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,printer:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,download:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,search:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,check:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="20 6 9 17 4 12"/></svg>`,close:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,refresh:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,send:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,clock:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,note:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,menu:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,camera:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,barcode:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M3 5v14M6 5v14M9 5v14M12 5v14M15 5v14M18 5v14M21 5v14"/></svg>`,info:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,gear:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,eye:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="13" r="3"/></svg>`,eyeOff:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,lock:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,unlock:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,materials:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/></svg>`,video:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,link:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,upload:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,plus:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,copy:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,lightbulb:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`,gradCap:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg>`,alertTriangle:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,inbox:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,chart:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,sun:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,moon:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,chevronDown:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="6 9 12 15 18 9"/></svg>`,chevronUp:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="18 15 12 9 6 15"/></svg>`,crown:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"/></svg>`,globe:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,archive:`<svg width="${t}" height="${t}" viewBox="0 0 24 24" fill="none" stroke="${n}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${i}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,dotSuccess:'<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#10b981"/></svg>',dotWarning:'<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#f59e0b"/></svg>',dotDanger:'<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#ef4444"/></svg>',dotNeutral:'<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#64748b"/></svg>'}[e]||""}function ee(e){let r=(s,t)=>Object.fromEntries(t.filter(n=>s?.[n]!==void 0).map(n=>[n,s[n]])),o=(s,t)=>(Array.isArray(s)?s:[]).filter(Boolean).map(n=>r(n,t));return{student:r(e.student,["id","tenant_id","name","student_code","group_name","teacher_name","subject_name","teacher_phone","contact_phone"]),summary:r(e.summary,["total_sessions","attended_count","absent_count","attendance_rate","quiz_average_percentage"]),teacher_phone:e.teacher_phone,contact_phone:e.contact_phone,preferences:e.preferences,announcements:o(e.announcements,["id","title","body","published_at","expires_at"]),upcoming_sessions:o(e.upcoming_sessions,["session_date","start_time","end_time","group_name"]),sessions:o(e.sessions,["session_number","session_date","attended","homework_status","comment"]),quizzes:o(e.quizzes,["title","score","max_score","date","tier","note"]),materials:o((e.materials||[]).filter(s=>s&&(s.is_homework||s.type==="homework")),["title","type","is_homework","submission_status","submitted_at","due_date"])}}function Ne(e){if(!e.submitted_at||!e.due_date)return"";let r=new Date(e.submitted_at);if(!Number.isFinite(r.getTime()))return"";let o=String(e.due_date);if(/^\d{4}-\d{2}-\d{2}$/.test(o)){let t=new Date(o+"T00:00:00Z");return!Number.isFinite(t.getTime())||t.toISOString().slice(0,10)!==o?"":new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit"}).format(r)>o?"متأخر":"في الموعد"}if(!/(Z|[+-]\d{2}:?\d{2})$/i.test(o))return"";let s=new Date(o);return Number.isFinite(s.getTime())?r>s?"متأخر":"في الموعد":""}var X=e=>{if(!e)return"";if(/^\d{4}-\d{2}-\d{2}$/.test(String(e)))return e;let r=new Date(e);return Number.isFinite(r.getTime())?r.toLocaleString("ar-EG",{timeZone:"Africa/Cairo",dateStyle:"medium",timeStyle:"short"}):""},ke=e=>!!(e.submitted_at||["approved","pending","rejected","submitted"].includes(e.submission_status)),se=e=>`<p class="pp-empty">${m(e)}</p>`,Y=(e,r="")=>`<span class="pp-pill ${r}">${m(e)}</span>`,K=(e,r,o="")=>`<div class="pp-metric"><span>${m(e)}</span><strong>${m(r??"—")}</strong>${o?`<small>${m(o)}</small>`:""}</div>`;function te(e={},r="attendance"){if(e.error||!e.student)return`<main dir="rtl" style="max-width:440px;margin:12vh auto;padding:24px;font:16px/1.8 system-ui;color:#0f172a"><h1 style="font-size:22px">${!e.error||/غير صالح|منتهي/.test(e.error)?"رابط غير صالح أو منتهي الصلاحية":"تعذر فتح المتابعة"}</h1><p>${m(e.error||"تأكد من رابط المتابعة الخاص بك.")}</p><button style="min-height:48px;padding:8px 20px" onclick="location.reload()">إعادة المحاولة</button></main>`;let o=e.student,s=e.summary||{},t=e.portal_presentation,n=Array.isArray(e.sessions)?e.sessions:[],i=Array.isArray(e.quizzes)?e.quizzes:[],d=(Array.isArray(e.materials)?e.materials:[]).filter(g=>g.is_homework||g.type==="homework"),p=d.filter(ke).length,l={navy:"#0f172a",slate:"#0f172a",emerald:"#065f46",red:"#991b1b",purple:"#581c87"},c=/^#[0-9a-f]{6}$/i.test(t?.custom_primary_color||"")?t.custom_primary_color:l[t?.theme_preset]||"#0f172a",f=String(o.teacher_phone||e.teacher_phone||o.contact_phone||e.contact_phone||"").replace(/\D/g,""),x=/^01\d{9}$/.test(f)?"2"+f:f,a=["attendance","quizzes","homework"].includes(r)?r:r==="materials"?"homework":"attendance",y=[["attendance","الحضور"],["quizzes","الدرجات"],["homework","الواجبات"]];return`<style>
    .pp{--ink:#0f172a;--muted:#475569;--line:#e2e8f0;box-sizing:border-box;min-height:100dvh;background:#f6f8fb;color:var(--ink);font-family:inherit;font-size:16px;line-height:1.7;padding:16px 16px max(24px,env(safe-area-inset-bottom));direction:rtl}
    .pp *{box-sizing:border-box}.pp-wrap{max-width:780px;margin:auto;display:grid;gap:20px}.pp h1,.pp h2,.pp h3,.pp p{margin:0}.pp h1{font-size:26px;line-height:1.5}.pp h2{font-size:19px}.pp h3{font-size:16px}.pp small{font-size:13px;color:var(--muted)}.pp p,.pp h1,.pp h2,.pp h3,.pp span{overflow-wrap:anywhere}
    .pp-top,.pp-row{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}.pp-brand{font-size:15px;font-weight:800}.pp-mark{color:#1d4ed8}.pp-actions{display:flex;gap:8px}.pp button,.pp a{font:inherit;touch-action:manipulation}.pp-button{display:inline-flex;align-items:center;justify-content:center;gap:8px;min-height:48px;min-width:48px;padding:10px 14px;border:1px solid var(--line);border-radius:14px;background:white;color:var(--ink);text-decoration:none;cursor:pointer}.pp button:disabled{opacity:.6;cursor:wait}.pp button:focus-visible,.pp a:focus-visible{outline:3px solid #2563eb;outline-offset:3px}.pp button:active,.pp a:active{background:#e2e8f0}
    .pp-hero{position:relative;background:white;border:1px solid var(--line);border-top:4px solid ${c};border-radius:22px;padding:24px;display:grid;gap:10px;box-shadow:0 4px 20px #0f172a04}.pp-eyebrow{color:var(--muted);font-size:14px}.pp-subtitle{color:var(--muted);font-size:15px}.pp-code{direction:ltr;unicode-bidi:isolate}.pp-sync{font-size:14px;color:var(--muted)}.pp-sync:empty{display:none}
    .pp-summary{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px}.pp-metric{border:1px solid var(--line);border-radius:18px;background:white;padding:18px;display:grid;gap:5px;min-width:0}.pp-metric>span{font-size:14px;color:var(--muted)}.pp-metric strong{font-size:26px;line-height:1.4;font-variant-numeric:tabular-nums}.pp-nav{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;background:#e9eef5;padding:6px;border-radius:18px;scroll-margin:16px}.pp-nav button{border:0;min-height:48px;padding:10px 4px;background:transparent;border-radius:13px;color:#475569;font-weight:700;cursor:pointer}.pp-nav button[aria-selected=true]{background:white;color:#0f172a;box-shadow:0 2px 6px #0f172a0a}
    .pp-panel{display:flex;flex-direction:column;gap:14px;min-width:0}.pp-panel[hidden]{display:none}.pp-card{padding:20px;background:white;border:1px solid var(--line);border-radius:18px;display:grid;gap:10px;min-width:0}.pp-pill{display:inline-block;width:fit-content;font-size:13px;font-weight:700;border-radius:9px;padding:4px 10px;background:#f1f5f9;color:#334155}.pp-pill.good{background:#edf7f1;color:#166534}.pp-pill.attention{background:#fff7ed;color:#9a3412}.pp-note{font-size:15px;color:var(--muted);padding-top:8px;border-top:1px solid #f1f5f9}.pp-empty{padding:32px 20px;border:1px dashed #cbd5e1;border-radius:18px;color:var(--muted);text-align:center;background:white}.pp-footer{display:grid;gap:12px;padding:8px 0;text-align:center;color:var(--muted);font-size:13px}.pp-contact{width:100%}
    @media(min-width:700px){.pp{padding:28px}.pp-summary{grid-template-columns:repeat(4,minmax(0,1fr))}.pp-hero{padding:28px}}@media(prefers-reduced-motion:reduce){.pp *{scroll-behavior:auto}}
  </style><main class="pp" aria-label="متابعة ولي الأمر"><div class="pp-wrap">
    <header class="pp-top"><span class="pp-brand"><span class="pp-mark">سـ</span> ${m(t?.display_title||"سنترلي")}<br><small>متابعة ولي الأمر</small></span><div class="pp-actions"><button class="pp-button" id="parent-refresh-data-btn" type="button" aria-label="تحديث بيانات المتابعة" title="تحديث بيانات المتابعة" onclick="window.centrlyApp.reloadParentPortal()">${w("refresh",20,"currentColor")}</button><button class="pp-button" type="button" onclick="window.centrlyApp.handlePortalLogout()">خروج</button></div></header>
    <section class="pp-hero" aria-labelledby="pp-student"><p class="pp-eyebrow">متابعة ابنك، في مكان واحد</p><h1 id="pp-student">${m(o.name)}</h1><p class="pp-subtitle">${m(o.teacher_name||t?.display_title||"متابعة الطالب")}${o.subject_name?` · ${m(o.subject_name)}`:""}</p><div class="pp-row"><span class="pp-subtitle">${m(o.group_name||"")}</span>${o.student_code?`<small>كود الطالب <b class="pp-code">${m(o.student_code)}</b></small>`:""}</div><p id="parent-sync-status" class="pp-sync" role="status" aria-live="polite"></p></section>
    ${Z(e,"parent")}
    <section class="pp-summary" aria-label="ملخص المتابعة">${K("الحضور",s.total_sessions?s.attendance_rate:"—",s.total_sessions?`${s.attended_count??0} من ${s.total_sessions} حصص`:"لا توجد حصص مسجلة")}${K("الغياب",s.total_sessions?s.absent_count??0:"—")}${K("واجبات تم تسليمها",`${p} / ${d.length}`)}${K("متوسط الدرجات",i.length?s.quiz_average_percentage??"—":"—")}</section>
    <nav class="pp-nav" role="tablist" aria-label="أقسام المتابعة" onkeydown="window.parentPortalTabKey(event)">${y.map(([g,b])=>`<button type="button" role="tab" id="tab-btn-${g}" aria-controls="tab-content-${g}" aria-selected="${g===a}" tabindex="${g===a?"0":"-1"}" onclick="window.switchParentPortalTab('${g}')">${b}</button>`).join("")}</nav>
    <section class="pp-panel" id="tab-content-attendance" role="tabpanel" aria-labelledby="tab-btn-attendance" ${a==="attendance"?"":"hidden"}><h2>سجل الحضور</h2>${n.length?n.map(g=>`<article class="pp-card"><div class="pp-row"><h3>حصة ${m(g.session_number??"")}</h3>${Y(g.attended?"حاضر":"غائب",g.attended?"good":"attention")}</div><small>${m(X(g.session_date))}</small>${g.attended&&["done","partial","missing"].includes(g.homework_status)?`<p class="pp-subtitle">الواجب: ${g.homework_status==="done"?"تم التسليم بالكامل":g.homework_status==="partial"?"تسليم جزئي":"لم يُسلّم"}</p>`:""}${g.comment?`<p class="pp-note">ملاحظة المعلم: ${m(g.comment)}</p>`:""}</article>`).join(""):se("لا توجد حصص مسجلة حتى الآن.")}</section>
    <section class="pp-panel" id="tab-content-quizzes" role="tabpanel" aria-labelledby="tab-btn-quizzes" ${a==="quizzes"?"":"hidden"}><h2>الدرجات والنتائج</h2>${i.length?i.map(g=>`<article class="pp-card"><div class="pp-row"><h3>${m(g.title)}</h3>${Y(`${g.score??"—"} / ${g.max_score??"—"}`)}</div>${g.date?`<small>${m(X(g.date))}</small>`:""}${g.tier?`<p class="pp-subtitle">${m(g.tier)}</p>`:""}${g.note?`<p class="pp-note">ملاحظة المعلم: ${m(g.note)}</p>`:""}</article>`).join(""):se("لم تُرصد درجات بعد. ستظهر هنا بعد رصدها من المعلم.")}</section>
    <section class="pp-panel" id="tab-content-homework" role="tabpanel" aria-labelledby="tab-btn-homework" ${a==="homework"?"":"hidden"}><h2>متابعة تسليم الواجبات</h2><p class="pp-subtitle">حالة التسليم وموعده، بخطوة بسيطة.</p>${d.length?d.map(g=>{let b=ke(g),h=b?Ne(g):"";return`<article class="pp-card"><h3>${m(g.title)}</h3><div class="pp-row">${Y(b?"تم التسليم":"لم يُسلّم بعد",b?"good":"attention")}${h?Y(h,h==="متأخر"?"attention":""):""}</div>${g.due_date?`<p class="pp-subtitle">آخر موعد: ${m(X(g.due_date))}</p>`:""}${g.submitted_at?`<p class="pp-subtitle">وقت التسليم: ${m(X(g.submitted_at))}</p>`:""}${g.submission_status==="rejected"?'<p class="pp-note">طلب المعلم إعادة التسليم.</p>':""}</article>`}).join(""):se("لا توجد واجبات مطلوبة حتى الآن.")}</section>
    <footer class="pp-footer">${/^\d{10,15}$/.test(x)?`<a class="pp-button pp-contact" href="https://wa.me/${x}" target="_blank" rel="noopener noreferrer">التواصل مع المعلم ${w("chevronLeft",18,"currentColor")}</a>`:""}<span>متابعة أبسط، وخطوة أقرب لابنك · سنترلي</span></footer>
  </div></main>`}typeof window<"u"&&(window.switchParentPortalTab=function(e){let r=e==="materials"?"homework":e;if(["attendance","quizzes","homework"].includes(r)){try{localStorage.setItem("centrly_portal_parent_tab",r),sessionStorage.setItem("centrly_portal_parent_tab",r)}catch{}for(let o of["attendance","quizzes","homework"]){let s=document.getElementById("tab-content-"+o),t=document.getElementById("tab-btn-"+o);s&&(s.hidden=o!==r),t&&(t.setAttribute("aria-selected",String(o===r)),t.tabIndex=o===r?0:-1)}}},window.parentPortalTabKey=function(e){if(!["ArrowLeft","ArrowRight","Home","End"].includes(e.key))return;let r=["attendance","quizzes","homework"],o=r.findIndex(t=>e.target.id==="tab-btn-"+t);if(o<0)return;e.preventDefault();let s=e.key==="Home"?0:e.key==="End"?2:(o+(e.key==="ArrowLeft"?1:2))%3;window.switchParentPortalTab(r[s]),document.getElementById("tab-btn-"+r[s])?.focus()});var Se="centrly_parent_public_brand_v1";function le(){try{let e=JSON.parse(localStorage.getItem(Se));return e?.origin===location.origin?e.presentation:null}catch{return null}}function W(e){try{localStorage.setItem("centrly_portal_entry_role","parent");let r=e?Object.fromEntries(["display_title","theme_preset","custom_primary_color","subdomain"].filter(o=>typeof e[o]=="string").map(o=>[o,e[o]])):null;localStorage.setItem(Se,JSON.stringify({origin:location.origin,presentation:r}))}catch{}}function de(e="",r=null,o=!1){let s={emerald:"#065f46",red:"#991b1b",purple:"#581c87"};return`<style>
  .parent-login{box-sizing:border-box;min-height:100dvh;background:#f6f8fb;padding:32px 16px max(24px,env(safe-area-inset-bottom));font-family:inherit;font-size:16px;line-height:1.8;color:#0f172a;direction:rtl;display:grid;align-content:center}.parent-login *{box-sizing:border-box}.parent-login-card{width:100%;max-width:440px;margin:auto;padding:28px 24px;border:1px solid #e2e8f0;border-top:4px solid ${/^#[0-9a-f]{6}$/i.test(r?.custom_primary_color||"")?r.custom_primary_color:s[r?.theme_preset]||"#0f172a"};border-radius:24px;background:#fff;box-shadow:0 12px 40px #0f172a05}.parent-login h1{font-size:25px;line-height:1.5;margin:8px 0}.parent-login p{color:#475569;margin:8px 0 24px;font-size:15px}.parent-login label{display:block;margin:20px 0 8px;font-weight:700}.parent-login input{font:inherit;font-size:16px;min-height:52px;padding:12px 14px;width:100%;border:1px solid #cbd5e1;border-radius:14px;min-width:0;color:#0f172a;background:#fff}.parent-login button{font:inherit;min-height:48px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:10px;cursor:pointer;touch-action:manipulation}.parent-login input:focus-visible,.parent-login button:focus-visible{outline:3px solid #2563eb;outline-offset:3px}.parent-login-password{display:flex;gap:8px}.parent-login-password input{flex:1;width:0}.parent-login #portalSubmitBtn{width:100%;margin-top:24px;background:#0f172a;color:#fff;border-color:#0f172a;font-weight:700}.parent-login button:disabled{opacity:.6;cursor:wait}.parent-login-alert{padding:12px;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:15px}.parent-login-alert[hidden]{display:none}.parent-login small{display:block;color:#475569;font-size:13px;line-height:1.8}.parent-login footer{text-align:center;margin-top:24px;font-size:13px;color:#475569}.parent-login h1,.parent-login small{overflow-wrap:anywhere}
  </style><main class="parent-login"><section class="parent-login-card" aria-labelledby="parent-login-title"><small>بوابة ولي الأمر</small><h1 id="parent-login-title"><span id="parent-login-brand">${m(r?.display_title||"سنترلي")}</span></h1><p>اطمّن على الحضور والدرجات وتسليم الواجبات.</p>
  <div id="portalLoginAlert" class="parent-login-alert" role="alert" tabindex="-1" ${e?"":"hidden"}>${m(e)}</div>
  <form id="portalLoginForm" onsubmit="window.centrlyApp.handlePortalLogin(event)"><input type="hidden" id="portalRole" name="role" value="parent"><label for="portalIdentifier">${o?"رقم تليفون ولي الأمر":"رقم ولي الأمر أو كود الطالب"}</label><input id="portalIdentifier" name="identifier" type="text" inputmode="${o?"tel":"numeric"}" autocomplete="username" dir="ltr" maxlength="48" required><label for="portalPassword">${o?"كلمة مرور الأسرة":"كلمة المرور"}</label><div class="parent-login-password"><input id="portalPassword" name="password" type="password" inputmode="numeric" autocomplete="current-password" dir="ltr" maxlength="72" required><button type="button" aria-label="إظهار أو إخفاء كلمة المرور" aria-controls="portalPassword" aria-pressed="false" onclick="window.centrlyApp.toggleParentPassword ? window.centrlyApp.toggleParentPassword(this) : window.centrlyApp.togglePortalPasswordVisibility(this,event)">إظهار</button></div><button id="portalSubmitBtn" type="submit">${o?"دخول حساب الأسرة":"دخول المتابعة"}</button></form><p style="margin:20px 0 0"><small>${o?"استخدم كلمة مرور الأسرة المرسلة لرقمك. أبناؤك المسجلون على نفس الرقم يظهرون تلقائيًا. لإعادة إرسالها، تواصل مع المعلم.":"استخدم كلمة المرور المرسلة مع رابط المتابعة. لو فقدتها، تواصل مع المعلم."}</small></p><button type="button" style="width:100%" onclick="window.centrlyApp.setParentFamilyMode(${o?"false":"true"})">${o?"عندي بيانات متابعة طالب واحد":"عندي حساب للأسرة"}</button><footer>متابعة ولي الأمر · بواسطة سنترلي</footer></section></main>`}var ce="centrly_portal_snapshot_v2:";async function Oe(e,r){let o=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(r+":"+e));return Array.from(new Uint8Array(o),s=>s.toString(16).padStart(2,"0")).join("")}function pe(e,r){try{let o=atob(e.replace(/-/g,"+").replace(/_/g,"/")).split(":");return o.length===4&&/^\d+$/.test(o[2])&&Number(o[2])*1e3<=r}catch{return!1}}var ne=e=>JSON.parse(JSON.stringify(e));function me(e,r){try{let o=atob(e.replace(/-/g,"+").replace(/_/g,"/")).split(":");if(o.length===4&&/^\d+$/.test(o[2])&&/^[a-f0-9]{64}$/i.test(o[3]))return r?.student?.id===o[1]&&r.student.tenant_id===o[0]}catch{}return!0}function qe({storage:e,clock:r=Date.now,hash:o=Oe}={}){try{for(let a of e?[e]:[globalThis.localStorage,globalThis.sessionStorage])for(let y of["student","parent"])a?.removeItem("centrly_portal_snapshot_v1:"+y)}catch{}let s=new Map,t=new Map,n=a=>t.get(a)||0,i=()=>Object.assign(new Error("تغيرت البيانات أثناء التحديث"),{code:"PORTAL_CACHE_INVALIDATED"}),d=()=>{if(e)return e;try{if(!globalThis.localStorage.getItem("centrly_portal_token")&&globalThis.sessionStorage?.getItem("centrly_portal_token"))return globalThis.sessionStorage}catch{}return globalThis.localStorage};function p(a,y){try{let g=d().getItem("centrly_portal_token"),b=d().getItem("centrly_portal_role");return d().getItem("centrly_explicit_logout")!=="1"&&g===a&&(!b||b===y)}catch{return!0}}function l(a="student"){t.set(a,n(a)+1);try{d().removeItem(ce+a)}catch{}}async function c(a,y="student"){let g=n(y);if(!a||!p(a,y)||pe(a,r()))return null;try{let b=JSON.parse(d().getItem(ce+y)||"null");if(!b||b.version!==2||b.role!==y||!Number.isFinite(b.savedAt)||b.session!==await o(a,y))return null;let h=r()-b.savedAt;if(g!==n(y)||!p(a,y)||h<0||h>864e5||!b.data?.student?.id||!b.data.student.tenant_id||!me(a,b.data))return null;let v=ne(b.data),k=v.announcements?.length>0||v.preferences?.show_student_rank===!0||v.preferences?.show_parent_rank===!0||v.preferences?.show_student_leaderboard===!0;if(delete v.leaderboard,delete v.announcements,v.summary)for(let _ of["student_rank","group_size","rank_period"])delete v.summary[_];if(v.preferences&&(v.preferences={...v.preferences,show_student_rank:!1,show_parent_rank:!1,show_student_leaderboard:!1}),h>1800*1e3)for(let _ of v.materials||[])String(_.submission_url||"").includes("/object/sign/")&&(_.submission_url=null);return{data:v,savedAt:b.savedAt,fresh:h<12e4&&!k}}catch{return null}}async function f(a,y,g="student",{savedAt:b=r(),generation:h=n(g)}={}){if(!(!y?.student?.id||!y.student.tenant_id||!me(a,y)||!p(a,g)||pe(a,r()))&&!(!Number.isFinite(b)||b>r()||r()-b>864e5))try{let v=ne(y);for(let A of v.materials||[])if(["online_quiz","paper_quiz","paper_exam"].includes(A.type)){let S=A.questions;try{typeof S=="string"&&(S=JSON.parse(S))}catch{S={}}let I={};for(let u of["id","subject","quiz_number","legacy_quiz_ref","exam_mode","available_date","available_time","available_until","start_time","end_time","duration_minutes","time_limit_minutes","is_draft","is_archived","status","question_count","max_score"])S?.[u]!==void 0&&(I[u]=S[u]);I.questions=[],A.questions=I}let k={version:2,role:g,session:await o(a,g),savedAt:b,data:v};if(h!==n(g)||!p(a,g))return;let _=JSON.stringify(k);_.length<=15e5&&d().setItem(ce+g,_)}catch{}}async function x(a,{role:y="student",request:g,onData:b=()=>{},force:h=!1}={}){let v=n(y);if(!p(a,y))throw Object.assign(new Error("تغير الحساب، افتح الصفحة مجددًا"),{code:"PORTAL_SESSION_CHANGED"});if(pe(a,r()))throw l(y),Object.assign(new Error("انتهت صلاحية الجلسة، سجّل الدخول مجددًا"),{status:401});let k=await c(a,y);if(v!==n(y))throw i();if(k&&b(ne(k.data),{cached:!0,savedAt:k.savedAt}),k?.fresh&&!h)return{data:k.data,cached:!0,savedAt:k.savedAt};let _;try{_=await o(a,y)}catch{_="memory-only:"+y+":"+a}_+=":"+v;let A=s.get(_);A||(A=(async()=>{let S=await g("/public/parent-portal?token="+encodeURIComponent(a));if(v!==n(y))throw i();if(!p(a,y))throw Object.assign(new Error("تغير الحساب، افتح الصفحة مجددًا"),{code:"PORTAL_SESSION_CHANGED"});if(!S?.student?.id||!me(a,S))throw new Error("تعذر التحقق من بيانات الحساب");return await f(a,S,y,{generation:v}),S})(),s.set(_,A),A.finally(()=>{s.get(_)===A&&s.delete(_)}).catch(()=>{}));try{let S=await A;if(v!==n(y))throw i();if(!p(a,y))throw Object.assign(new Error("تغير الحساب، افتح الصفحة مجددًا"),{code:"PORTAL_SESSION_CHANGED"});return b(ne(S),{cached:!1,savedAt:r()}),{data:S,cached:!1,savedAt:r()}}catch(S){if(!p(a,y))throw Object.assign(new Error("تغير الحساب، افتح الصفحة مجددًا"),{code:"PORTAL_SESSION_CHANGED"});if(S.status===401||S.status===403)throw p(a,y)&&l(y),S;if(S.code==="PORTAL_SESSION_CHANGED"||S.code==="PORTAL_CACHE_INVALIDATED")throw S;if(k&&p(a,y))return{data:k.data,cached:!0,stale:!0,savedAt:k.savedAt,error:S};throw S}}return{read:c,write:f,load:x,clear:l}}var E=qe();var Fe="https://tutoring-backend-production-c8dd.up.railway.app/api";async function R(e,r={}){let o=new AbortController,s=setTimeout(()=>o.abort(),3e4),t=r.body&&(e.startsWith("/public/family/")||["/public/portal/destination","/public/portal/handoff"].includes(e));try{let n=await fetch(Fe+e,{method:r.method||"GET",signal:o.signal,cache:"no-store",...r.body?{headers:{"Content-Type":t?"application/x-www-form-urlencoded;charset=UTF-8":"application/json"},body:t?new URLSearchParams(r.body).toString():JSON.stringify(r.body)}:{}}),i=await n.json();if(!n.ok){let d=new Error(i.error?.message||"تعذر تحميل البيانات، حاول مجددًا");throw d.status=n.status,d}return i}catch(n){throw n.name==="AbortError"?new Error("الاتصال استغرق وقتًا طويلًا. تحقق من الإنترنت وحاول مجددًا."):n instanceof TypeError?new Error("تعذر الاتصال. تحقق من الإنترنت وحاول مجددًا."):n}finally{clearTimeout(s)}}function fe(){let e=localStorage.getItem("centrly_family_token_v1");for(let r of[localStorage,sessionStorage])for(let o of["centrly_family_token_v1","centrly_family_snapshot_v1","centrly_family_selected_v1"])r.removeItem(o);e&&R("/public/family/logout",{method:"POST",body:{family_token:e}}).catch(()=>{})}function Ae(e){return/^(?:[a-z0-9-]+\.)?centerly-eg\.com$/.test(e)||/^(?:[a-z0-9-]+\.)?centrly\.app$/.test(e)}function Ve(e){try{let r=new URL(e);return r.origin===e&&r.protocol==="https:"&&!r.port&&Ae(r.hostname)}catch{return!1}}async function re(e,r,o,s,t=window.location,n=null){if(!Ae(t.hostname))return!1;let i=typeof window<"u"?window.__centrlyPortalArrival:null,d=n||(i?.token===r&&i.role===o&&i.origin===t.origin?i:await s("/public/portal/destination",{method:"POST",body:{token:r,role:o}}));if(i===d&&(window.__centrlyPortalArrival=null),!Ve(d?.origin))throw new Error("تعذر تحديد وجهة المتابعة");if(e._portalPresentation=d.presentation||null,d.origin!==t.origin){if(!/^[A-Za-z0-9_-]{43}$/.test(d.ticket||""))throw new Error("تعذر تجهيز الانتقال الآمن");let p=o==="student"&&d.presentation?"/dashboard":"/portal-entry";return t.replace(`${d.origin}${p}#handoff=${encodeURIComponent(d.ticket)}`),!0}return o==="student"&&d.presentation?(t.replace("/dashboard"),!0):!1}function oe(e){return!e&&e!==0?"":String(e).replace(/[٠-٩]/g,r=>String(r.charCodeAt(0)-1632)).replace(/[۰-۹]/g,r=>String(r.charCodeAt(0)-1776)).trim()}var Ue="centrly_family_token_v1";function Pe(){try{return localStorage.getItem(Ue)}catch{return null}}function We(e){let r=e.getAppEl();r&&window.renderPortalOpening(r)}function Ee(e){e.setParentFamilyMode=function(r){if(r&&!this.loginFamily){location.assign("/portal-entry?role=parent&family=1");return}this._familyMode=!!r,this.renderPortalLogin(),document.getElementById("portalIdentifier")?.focus()},e.loadParentPortal=async function(o,s={}){window.__centrlyLoaded=!0,this._parentPortalToken=o;try{typeof localStorage<"u"&&o&&(localStorage.setItem("centrly_portal_token",o),localStorage.setItem("centrly_portal_role","parent")),typeof sessionStorage<"u"&&o&&(sessionStorage.setItem("centrly_portal_token",o),sessionStorage.setItem("centrly_portal_role","parent")),window.history&&window.history.replaceState&&(window.location.pathname!=="/portal"||window.location.search||window.location.hash)&&window.history.replaceState(null,"",window.location.pathname==="/portal-entry"?"/portal-entry":"/portal")}catch{}let t=i=>{let d=this.getAppEl();if(!d)return;let p="attendance";try{p=localStorage.getItem("centrly_portal_parent_tab")||"attendance"}catch{}let l=d.contains(document.activeElement)?document.activeElement.id:"";d.innerHTML=te({...i,portal_presentation:this._portalPresentation||i.portal_presentation},p),l&&document.getElementById(l)?.focus({preventScroll:!0}),this._parentPortalRenderedToken=o,W(this._portalPresentation||i.portal_presentation);let c=d.querySelector("#parent-refresh-data-btn");c&&this._parentPortalRefreshing&&(c.disabled=!0,c.setAttribute("aria-busy","true"))},n=i=>{let d=this.getAppEl()?.querySelector("#parent-sync-status");d&&(d.textContent=i?"تعذر الاتصال؛ نعرض آخر بيانات محفوظة. جرّب التحديث.":"")};try{let i=window.__centrlyPortalArrival;!s.force&&i?.token===o&&i.role==="parent"&&i.origin===location.origin&&i.initial_data?.student?.id&&await E.write(o,{...ee(i.initial_data),portal_presentation:i.presentation},"parent");let d=await E.read(o,"parent");if(d&&(this._parentPortalRenderedToken!==o||!this.getAppEl()?.querySelector("#pp-student"))?t(d.data):this._parentPortalRenderedToken!==o&&We(this),(!d?.fresh||s.force||window.__centrlyPortalArrival)&&await re(this,o,"parent",R))return!1;let p=await E.load(o,{role:"parent",request:async l=>{let c=await R(l+"&view=parent");return{...ee(c),portal_presentation:this._portalPresentation}},force:s.force===!0,onData:(l,c)=>{(!c.cached||!d)&&t(l)}});return n(!!p.error),!p.error}catch(i){if(i?.code==="PORTAL_CACHE_INVALIDATED"||i?.code==="PORTAL_SESSION_CHANGED")return!1;if(i?.status===401||i?.status===403){E.clear("parent");try{localStorage.removeItem("centrly_portal_token"),localStorage.removeItem("centrly_portal_role"),sessionStorage.removeItem("centrly_portal_token"),sessionStorage.removeItem("centrly_portal_role")}catch{}return this._parentPortalRenderedToken=null,this.renderPortalLogin("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً"),!1}let d=await E.read(o,"parent");if(d)return t(d.data),n(!0),!1;let p=this.getAppEl();return p&&(p.innerHTML=te({error:i?.message||"تعذر تحميل المتابعة. تحقق من الاتصال وأعد المحاولة."})),!1}},e.reloadParentPortal=async function(){if(this._parentPortalRefreshing)return!1;let o=this.getAppEl()?.querySelector("#parent-refresh-data-btn");o&&(o.disabled=!0,o.setAttribute("aria-busy","true")),this._parentPortalRefreshing=!0;try{return Pe()?await this.loadFamilyPortal({force:!0}):this._parentPortalToken?await this.loadParentPortal(this._parentPortalToken,{force:!0}):(window.location.reload(),!1)}finally{this._parentPortalRefreshing=!1;let s=this.getAppEl()?.querySelector("#parent-refresh-data-btn");s&&(s.disabled=!1,s.removeAttribute("aria-busy"))}}}async function ze(e,r,o,s=()=>{}){let t=await e("start",{token:r,material_id:o});if(t.submitted)return{submitted:t.result,definition:t.definition,answers:t.answers||{},materialId:t.material_id};if(!t.attempt_id||!t.definition?.questions?.length||!Number.isFinite(Date.parse(t.expires_at))||!Number.isFinite(Date.parse(t.server_now)))throw new Error("تعذر بدء الامتحان؛ حدّث الصفحة وحاول مجددًا");let n=()=>globalThis.performance.now(),i=n()+Math.max(0,Date.parse(t.expires_at)-Date.parse(t.server_now)),d=t.revision,p=!1,l=null,c=null,f=null,x=!1,a=!1,y=0,g={...t.answers},b={id:t.attempt_id,materialId:t.material_id,definition:{...t.definition,questions:t.definition.questions.map((h,v)=>({...h,id:String(h.id??v)}))},answers:g,remaining:()=>Math.max(0,Math.ceil((i-n())/1e3)),setAnswer(h,v){return x||a||b.remaining()<=0?!1:(g[h]=v,p=!0,s("saving"),clearTimeout(f),f=setTimeout(()=>{b.flush().catch(()=>{})},700),!0)},flush(){return x?Promise.reject(new Error("انتهت جلسة الامتحان")):c||(clearTimeout(f),c=(async()=>{for(;(p||l)&&b.remaining()>0;){l||(l={token:r,attempt_id:b.id,answers:JSON.parse(JSON.stringify(g)),revision:d},p=!1);try{let h=await e("save",l);if(h.submitted){b.submitted=h.result,l=null,p=!1,a=!0,s("submitted");return}d=h.revision,l=null,y=0,s(p?"saving":"saved")}catch(h){throw s("error",h.message),!x&&!a&&(!h.status||h.status>=500)&&(clearTimeout(f),f=setTimeout(()=>{b.flush().catch(()=>{})},Math.min(3e4,2e3*2**y++))),h}}})().finally(()=>{c=null}),c)},async submit(h={}){if(a=!0,clearTimeout(f),await b.flush(),b.submitted)return b.submitted;let v=await e("submit",{token:r,material_id:b.materialId,answers:{...g},...h});if(v.success!==!0)throw new Error("تعذر تأكيد التسليم؛ حاول مجددًا");return b.submitted=v,b.dispose(),v},dispose(){x=!0,a=!0,clearTimeout(f)}};return b}function Ie(e=new Date){let r=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(e).filter(o=>o.type!=="literal").map(o=>[o.type,o.value]));return{date:`${r.year}-${r.month}-${r.day}`,time:`${r.hour}:${r.minute}`}}var Ge=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];function Te(e){let r=String(e||"").trim();r||(r="0000");let o=[104],s=104;for(let n=0;n<r.length;n++){let i=r.charCodeAt(n)-32,d=i>=0&&i<=94?i:0;o.push(d),s+=d*(n+1)}o.push(s%103),o.push(106);let t="";for(let n of o)t+=Ge[n];return{codes:o,patternStr:t,cleanText:r}}function Be(e,r={}){let o=r.height||80,s=r.quietZone!==void 0?r.quietZone:10,t=r.unitWidth||2.5,{patternStr:n}=Te(e),i=[],d=s;for(let l=0;l<n.length;l++){let c=parseInt(n[l],10);l%2===0&&i.push('<rect x="'+(d*t).toFixed(1)+'" y="0" width="'+(c*t).toFixed(1)+'" height="'+o+'" fill="#000000"/>'),d+=c}d+=s;let p=(d*t).toFixed(1);return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+p+" "+o+'" style="width: 100%; max-width: 100%; height: '+o+'px; display: block; shape-rendering: crispEdges;"><rect width="'+p+'" height="'+o+'" fill="#ffffff"/>'+i.join("")+"</svg>"}function ue(e){let r=String(e||"").trim();return!r||r==="معلم المادة"||r==="أستاذ المادة"?"معلم المادة":(r=r.replace(/\s*[-–—|]\s*(منظومة|منظر|سنترلي|أكاديمية|سنتر|منصه|منصة).*/i,"").replace(/\s*[-–—|]\s*.*منظومة.*/i,"").trim(),r||e||"معلم المادة")}function ge(e={},r={}){let o=e.student_code||e.code||"—",s=e.name||"طالب",t=(e.group_name||e.group||"").trim(),n=(e.subject_name||e.subject||"").trim();(n.includes("مجموع")||n===t)&&(n="");let i=e.teacher_name||r.teacherName||e.center_name||"معلم المادة",d=ue(i),p=Be(o,{height:50,unitWidth:2.2}),l=JSON.stringify(e).replace(/"/g,"&quot;");return`
    <div class="student-attendance-pass" style="direction: rtl; font-family: 'Cairo', system-ui, -apple-system, sans-serif; width: 100%; max-width: 420px; margin: 0 auto; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 1.25rem 1.25rem 1rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); box-sizing: border-box;">
      
      <!-- Top Screenshot Banner Note -->
      <div style="background: #fef3c7; border: 1.5px dashed #f59e0b; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-align: center;">
        <span style="font-size: 1.25rem; flex-shrink: 0;">📸</span>
        <div style="font-size: 0.84rem; font-weight: 800; color: #92400e; line-height: 1.45;">
          احفظ هذه الشاشة (سكرين شوت) للدخول بها إلى الدرس
        </div>
      </div>

      <!-- Student Name -->
      <div style="text-align: center; margin-bottom: 0.75rem;">
        <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.2rem;">اسم الطالب</div>
        <div style="font-family: 'Cairo', 'Changa', sans-serif; font-size: 1.45rem; font-weight: 900; color: #0f172a; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${m(s)}
        </div>
      </div>

      <!-- Student Code Badge -->
      <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
        <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 0.35rem 1.25rem; display: inline-flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 0.82rem; font-weight: 700; color: #475569;">كود الطالب:</span>
          <span style="font-family: monospace; font-size: 1.4rem; font-weight: 900; color: #1e3a8a; letter-spacing: 1px;">${m(o)}</span>
        </div>
      </div>

      <!-- High-Contrast Clean Barcode Box -->
      <div style="background: #ffffff; border: 2px solid #0f172a; border-radius: 12px; padding: 0.85rem 0.6rem 0.65rem; margin-bottom: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden;">
        <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; margin-bottom: 0.45rem;">امسح الباركود لتسجيل الحضور</div>
        <div style="width: 100%; display: flex; justify-content: center; overflow: hidden;">
          ${p}
        </div>
      </div>

      <!-- Teacher & Group Info Strip -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.6rem 0.85rem; margin-bottom: 1rem; display: flex; justify-content: space-around; align-items: center; font-size: 0.8rem; color: #334155; flex-wrap: wrap; gap: 0.5rem; text-align: center;">
        <div>
          <span style="color: #64748b;">المدرّس:</span>
          <strong style="color: #0f172a; margin-right: 0.25rem;">${m(d)}</strong>
        </div>
        ${n?`
          <div>
            <span style="color: #64748b;">المادة:</span>
            <strong style="color: #0f172a; margin-right: 0.25rem;">${m(n)}</strong>
          </div>
        `:""}
        <div>
          <span style="color: #64748b;">المجموعة:</span>
          <strong style="color: #0f172a; margin-right: 0.25rem;">${m(t||"عامة")}</strong>
        </div>
      </div>

      <!-- Action Buttons (Fullscreen / Download) -->
      <div style="display: flex; gap: 0.5rem; justify-content: center;">
        <button type="button" 
          onclick="window.centrlyBarcodeCard && window.centrlyBarcodeCard.openFullscreen ? window.centrlyBarcodeCard.openFullscreen(${l}) : null" 
          class="btn btn-secondary btn-sm"
          style="flex: 1; font-weight: 700; font-size: 0.78rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.55rem 0.75rem; border-radius: 8px;">
          ${w("expand",14)}
          <span>تكبير للشاشة</span>
        </button>

        <button type="button" 
          onclick="window.centrlyBarcodeCard && window.centrlyBarcodeCard.downloadCardPng ? window.centrlyBarcodeCard.downloadCardPng(${l}) : null" 
          class="btn btn-sm"
          style="flex: 1; background-color: #2563eb; color: #ffffff; font-weight: 800; font-size: 0.78rem; border: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.55rem 0.75rem; border-radius: 8px; cursor: pointer;">
          ${w("download",14,"#ffffff")}
          <span>حفظ الباركود (صورة)</span>
        </button>
      </div>

    </div>
  `}function he(e={},r={}){let o=e.student_code||e.code||"0000",s=e.name||"طالب",t=(e.group_name||e.group||"").trim(),n=(e.subject_name||e.subject||"").trim(),i=e.teacher_name||r.teacherName||e.center_name||"معلم المادة",d=ue(i),p="المجموعة",l=t||"المجموعة الدراسية";n&&t&&n!==t?l=`${t} • المادة: ${n}`:n&&!t&&(p="المادة",l=n);let c=document.createElement("canvas"),f=1200,x=757;c.width=f,c.height=x;let a=c.getContext("2d");if(!a)return;a.fillStyle="#172D70",a.fillRect(0,0,f,x),a.strokeStyle="#2949BA",a.lineWidth=8,a.roundRect?(a.beginPath(),a.roundRect(4,4,f-8,x-8,30),a.stroke()):a.strokeRect(4,4,f-8,x-8),a.fillStyle="#2949BA",a.fillRect(0,0,f,140),a.fillStyle="#E7A330",a.fillRect(0,140,f,8),a.direction="rtl",a.textAlign="right",a.font="bold 50px Cairo, Tahoma, sans-serif",a.fillStyle="#ffffff",a.fillText("سنتر",f-60,90);let y=a.measureText("سنتر").width;a.fillStyle="#E7A330",a.fillText("لـ",f-60-y+4,90);let g=a.measureText("لـ").width;a.fillStyle="#ffffff",a.fillText("ي",f-60-y-g+8,90),a.fillStyle="#E7A330",a.fillRect(f-60-80,106,80,5),a.direction="ltr",a.textAlign="left",a.fillStyle="#ffffff",a.font="bold 26px Cairo, Tahoma, sans-serif",a.fillText("بطاقة حضور الطالب",60,75),a.fillStyle="#E8EDFF",a.font="bold 15px monospace",a.fillText("STUDENT ID",60,105),a.direction="rtl",a.textAlign="right",a.fillStyle="#E8EDFF",a.font="bold 20px Cairo, Tahoma, sans-serif",a.fillText("اسم الطالب",f-60,195),a.fillStyle="#ffffff",a.font="bold 42px Cairo, Tahoma, sans-serif",a.fillText(s,f-60,248);let b=60,h=275,v=f-120,k=92;a.fillStyle="#1f3688",a.roundRect?(a.beginPath(),a.roundRect(b,h,v,k,12),a.fill(),a.strokeStyle="#2e4ebd",a.lineWidth=2,a.stroke()):a.fillRect(b,h,v,k),a.direction="rtl",a.textAlign="right",a.font="bold 21px Cairo, Tahoma, sans-serif",a.fillStyle="#E7A330",a.fillText("المدرّس: ",f-90,h+35);let _=a.measureText("المدرّس: ").width;a.fillStyle="#ffffff",a.fillText(d,f-90-_,h+35),a.fillStyle="#E7A330",a.fillText(`${p}: `,f-90,h+72);let A=a.measureText(`${p}: `).width;a.fillStyle="#ffffff",a.fillText(l,f-90-A,h+72);let S=60,I=385,u=f-120,$=265;a.fillStyle="#ffffff",a.roundRect?(a.beginPath(),a.roundRect(S,I,u,$,16),a.fill()):a.fillRect(S,I,u,$),a.direction="rtl",a.textAlign="center",a.fillStyle="#475569",a.font="bold 18px Cairo, Tahoma, sans-serif";let z=S+(u-250)/2;a.fillText("امسح الباركود لتسجيل الحضور",z,I+38);let{patternStr:T}=Te(o),H=150,M=I+55,P=20;for(let B=0;B<T.length;B++)P+=parseInt(T[B],10);let j=u-320,C=Math.min(8,Math.max(3.5,j/P)),G=P*C,F=S+40+(j-G)/2+10*C;a.fillStyle="#000000";let we=F;for(let B=0;B<T.length;B++){let D=parseInt(T[B],10)*C;B%2===0&&a.fillRect(Math.round(we),M,Math.round(D),H),we+=D}let V=200,xe=$-30,J=S+u-V-15,Q=I+15;a.fillStyle="#E7A330",a.roundRect?(a.beginPath(),a.roundRect(J,Q,V,xe,12),a.fill()):a.fillRect(J,Q,V,xe),a.direction="rtl",a.textAlign="center",a.fillStyle="#0f172a",a.font="bold 20px Cairo, Tahoma, sans-serif",a.fillText("رقم الطالب",J+V/2,Q+55),a.direction="ltr",a.fillStyle="#020617",a.font="bold 44px Changa, monospace",a.fillText(o,J+V/2,Q+130),a.fillStyle="#122359",a.fillRect(0,x-52,f,52),a.direction="rtl",a.textAlign="center",a.fillStyle="#cbd5e1",a.font="bold 18px Cairo, Tahoma, sans-serif",a.fillText("مخصصة للحضور — استخدمها في بداية كل حصة",f/2,x-20);try{let B=c.toDataURL("image/png"),D=document.createElement("a");D.href=B;let ve=s.replace(/[\s\/\\?%*:|"<>]/g,"_");D.download="كارت_حضور_"+ve+"_"+o+".png",document.body.appendChild(D),D.click(),document.body.removeChild(D)}catch(B){console.error("Failed to export student card canvas:",B)}}function ye(e={}){let r=e.student_code||e.code||"0000",o=e.name||"طالب",s=(e.group_name||e.group||"").trim(),t=(e.subject_name||e.subject||"").trim(),n=e.teacher_name||e.center_name||"معلم المادة",i=ue(n),d="المجموعة",p=s||"المجموعة الدراسية";t&&s&&t!==s?p=`${s} • المادة: ${t}`:t&&!s&&(d="المادة",p=t);let l="centrly-barcode-fullscreen-modal",c=document.getElementById(l);c&&c.remove();let f=Be(r,{height:110,unitWidth:3.2}),x=JSON.stringify(e).replace(/"/g,"&quot;"),a=document.createElement("div");a.id=l,a.style.cssText=`
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.96);
    backdrop-filter: blur(8px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    direction: rtl;
    font-family: 'Cairo', system-ui, sans-serif;
  `,a.innerHTML=`
    <div style="
      background: #172D70;
      border: 2px solid #2949BA;
      border-radius: 1.25rem;
      max-width: 520px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      position: relative;
    ">
      <!-- Header Bar -->
      <div style="background-color: #2949BA; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #E7A330;">
        <div style="font-family: 'Changa', 'Cairo', sans-serif; font-size: 1.5rem; font-weight: 900; color: #ffffff;">
          <span>سنتر</span><span style="color: #E7A330;">لـ</span><span>ي</span>
        </div>
        <button onclick="document.getElementById('${l}').remove()" style="
          background: rgba(255, 255, 255, 0.15);
          border: none;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #ffffff;
        ">
          ${w("close",18,"#ffffff")}
        </button>
      </div>

      <div style="padding: 1.25rem 1.5rem; text-align: center;">
        <h3 style="font-size: 1.4rem; font-weight: 900; color: #ffffff; margin: 0 0 0.35rem 0;">
          ${m(o)}
        </h3>

        <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #E8EDFF; margin-bottom: 1.25rem;">
          <div>المعلم: <b style="color: #E7A330;">${m(i)}</b></div>
          <div>${m(d)}: <b style="color: #E7A330;">${m(p)}</b></div>
        </div>

        <!-- High-Contrast Barcode White Panel -->
        <div style="
          background: #ffffff;
          border-radius: 1rem;
          padding: 1.5rem 1rem;
          margin-bottom: 1rem;
        ">
          <div style="width: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
            ${f}
          </div>
          <div style="font-family: 'Changa', monospace; font-size: 1.6rem; font-weight: 900; letter-spacing: 4px; color: #172D70; margin-top: 0.75rem; direction: ltr;">
            ${m(r)}
          </div>
        </div>

        <div style="font-size: 0.82rem; font-weight: 700; color: #4ade80; margin-bottom: 1.25rem;">
          ارفع سطوع شاشة الهاتف لتسهيل المسح الضوئي عند مدخل القاعة
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button onclick="window.centrlyBarcodeCard.downloadCardPng(${x})" style="
            background-color: #E7A330;
            color: #0f172a;
            border: none;
            padding: 0.65rem 1.25rem;
            border-radius: 0.65rem;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
          ">
            ${w("download",16,"#0f172a")}
            <span>حفظ الصورة في الهاتف</span>
          </button>

          <button onclick="document.getElementById('${l}').remove()" style="
            background: rgba(255, 255, 255, 0.15);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 0.65rem 1.25rem;
            border-radius: 0.65rem;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
          ">
            إغلاق
          </button>
        </div>
      </div>

      <!-- Footer strip -->
      <div style="background-color: #122359; color: #cbd5e1; font-size: 0.65rem; font-weight: 700; text-align: center; padding: 0.35rem;">
        مخصصة للحضور — استخدمها في بداية كل حصة
      </div>
    </div>
  `,document.body.appendChild(a)}typeof window<"u"&&(window.centrlyBarcodeCard={downloadCardPng:he,openFullscreen:ye,renderAttendancePass:ge});function je(){return`
    <style>
      @keyframes portalPulseBlue {
        0%, 100% {
          box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.4), 0 4px 16px rgba(37, 99, 235, 0.25) !important;
          outline: 3px solid #2563eb !important;
        }
        50% {
          box-shadow: 0 0 0 10px rgba(37, 99, 235, 0.15), 0 8px 24px rgba(37, 99, 235, 0.35) !important;
          outline: 3.5px solid #1d4ed8 !important;
        }
      }
      .portal-spotlight-target {
        position: relative !important;
        z-index: 99995 !important;
        outline: 3.5px solid #2563eb !important;
        outline-offset: 3px !important;
        border-radius: 10px !important;
        animation: portalPulseBlue 1.8s infinite !important;
        transition: all 0.2s ease-in-out !important;
      }
    </style>

    <!-- Ultra-light non-blurry backdrop: leaves the entire page, buttons, and text 100% sharp and visible -->
    <div id="student-spotlight-backdrop" onclick="window.nextStudentPortalTourStep()" title="اضغط لمتابعة الشرح"
      style="display: none; position: fixed; inset: 0; z-index: 99990; background: rgba(15, 23, 42, 0.08); cursor: pointer; transition: opacity 0.25s ease;">
    </div>

    <!-- Compact Floating Coachmark Card ("خانة صغيرة") -->
    <div id="student-spotlight-popover" 
      style="display: none; position: fixed; z-index: 99999; width: min(315px, calc(100vw - 24px)); max-height: calc(100vh - 20px); overflow-y: auto; background: #ffffff; border-radius: 1rem; padding: 1rem; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2), 0 4px 10px rgba(0, 0, 0, 0.08); border: 2.5px solid #2563eb; direction: rtl; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box; transition: top 0.2s ease-out, left 0.2s ease-out;">
      
      <!-- Pointing Arrow (points directly towards target button) -->
      <div id="student-spotlight-arrow" style="position: absolute; width: 0; height: 0;"></div>

      <!-- Header: Step badge, progress dots, and close button -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span id="student-spotlight-badge" style="background: #eff6ff; color: #1d4ed8; font-size: 0.76rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 9999px; border: 1px solid #bfdbfe; white-space: nowrap;">
            الخطوة 1 من 5
          </span>
          <div id="student-spotlight-dots" style="display: flex; gap: 4px; align-items: center;"></div>
        </div>
        <button type="button" onclick="window.closeStudentPortalTour(true)" 
          style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 0.4rem; padding: 0.2rem 0.5rem; font-size: 0.74rem; font-weight: 700; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;"
          onmouseover="this.style.color='#0f172a'; this.style.borderColor='#cbd5e1'" onmouseout="this.style.color='#64748b'; this.style.borderColor='#e2e8f0'">
          <span>تخطي</span>
          ${w("close",11,"#64748b")}
        </button>
      </div>

      <!-- Title & Explanation (Clean, elderly-friendly Arabic typography) -->
      <div style="margin-bottom: 0.85rem;">
        <h4 id="student-spotlight-title" style="font-size: 1.05rem; font-weight: 900; color: #0f172a; margin: 0 0 0.4rem 0; line-height: 1.35; display: flex; align-items: center; gap: 0.4rem;">
          عنوان الزر
        </h4>
        <p id="student-spotlight-desc" style="font-size: 0.88rem; color: #334155; line-height: 1.6; margin: 0; font-weight: 500;">
          شرح الزر وكيفية استخدامه...
        </p>
      </div>

      <!-- Footer Navigation Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;">
        <button type="button" id="student-spotlight-prev-btn" onclick="window.prevStudentPortalTourStep()" 
          style="display: none; background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; padding: 0.45rem 0.85rem; border-radius: 0.55rem; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
          السابق
        </button>
        <button type="button" id="student-spotlight-next-btn" onclick="window.nextStudentPortalTourStep()" 
          style="width: 100%; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; border: none; padding: 0.55rem 1rem; border-radius: 0.65rem; font-size: 0.85rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
          <span>التالي</span>
          <span>←</span>
        </button>
      </div>

    </div>
  `}function q(e,r,o,s,t="student"){if(!e||!r||!o)return;let n=window.innerHeight,i=window.innerWidth;try{e.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})}catch{try{e.scrollIntoView(!0)}catch{}}setTimeout(()=>{let d=e.getBoundingClientRect(),p=Math.min(315,i-24);r.style.display="block",r.style.width=p+"px",r.style.transform="none";let l=r.offsetHeight||190,c=12,f=n-d.bottom,x=d.top,a=0,y=!0;f>=l+c+10?(a=d.bottom+c,y=!0):x>=l+c+10?(a=d.top-l-c,y=!1):f>=x?(a=n-l-12,y=!0):(a=12,y=!1);let g=10,b=Math.max(g,n-l-10);a=Math.max(g,Math.min(a,b));let h=d.left+d.width/2-p/2,v=10,k=Math.max(v,i-p-10);h=Math.max(v,Math.min(h,k)),r.style.top=a+"px",r.style.left=h+"px";let A=Math.max(16,Math.min(d.left+d.width/2,i-16))-h-9;A=Math.max(16,Math.min(A,p-34)),y?o.style.cssText=`
        position: absolute;
        top: -9px;
        left: ${A}px;
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-bottom: 9px solid ${s};
        display: block;
      `:o.style.cssText=`
        position: absolute;
        bottom: -9px;
        left: ${A}px;
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-top: 9px solid ${s};
        display: block;
      `},100)}function Ce(e,r,o="#2563eb"){let s="";for(let t=0;t<e;t++){let n=t===r;s+=`<span style="display:inline-block; width:${n?"12px":"5px"}; height:5px; border-radius:9999px; background:${n?o:"#cbd5e1"}; transition:all 0.2s ease;"></span>`}return s}if(typeof window<"u"){let r=function(l){let c=[];l&&c.push(String(l).trim().toLowerCase()),typeof window<"u"&&window._centrlyCurrentStudentId&&c.push(String(window._centrlyCurrentStudentId).trim().toLowerCase()),typeof window<"u"&&window._centrlyCurrentParentId&&c.push(String(window._centrlyCurrentParentId).trim().toLowerCase());try{if(typeof localStorage<"u"){let f=localStorage.getItem("centrly_portal_last_id");f&&c.push(String(f).trim().toLowerCase())}}catch{}return Array.from(new Set(c.filter(Boolean)))},o=function(l){try{if(typeof localStorage>"u")return!1;if(localStorage.getItem("centrly_tour_v6_student_completed")==="true")return!0;for(let c of l)if(localStorage.getItem(`centrly_tour_seen_student_${c}`)==="true")return!0}catch{}return!1},s=function(l){try{if(typeof localStorage>"u")return;localStorage.setItem("centrly_tour_v6_student_completed","true");for(let c of l)localStorage.setItem(`centrly_tour_seen_student_${c}`,"true")}catch{}},n=function(l){let c=[];l&&c.push(String(l).trim().toLowerCase()),typeof window<"u"&&window._centrlyCurrentParentId&&c.push(String(window._centrlyCurrentParentId).trim().toLowerCase()),typeof window<"u"&&window._centrlyCurrentStudentId&&c.push(String(window._centrlyCurrentStudentId).trim().toLowerCase());try{if(typeof localStorage<"u"){let f=localStorage.getItem("centrly_portal_last_id");f&&c.push(String(f).trim().toLowerCase())}}catch{}return Array.from(new Set(c.filter(Boolean)))},i=function(l){try{if(typeof localStorage>"u")return!1;if(localStorage.getItem("centrly_tour_v6_parent_completed")==="true")return!0;for(let c of l)if(localStorage.getItem(`centrly_tour_seen_parent_${c}`)==="true")return!0}catch{}return!1},d=function(l){try{if(typeof localStorage>"u")return;localStorage.setItem("centrly_tour_v6_parent_completed","true");for(let c of l)localStorage.setItem(`centrly_tour_seen_parent_${c}`,"true")}catch{}};window._studentSpotlightIndex=0,window._studentActiveSpotlightEl=null;let e=[{tab:"materials",getTarget:()=>document.getElementById("student-tab-btn-materials"),badge:"الخطوة 1 من 5",getTitle:()=>"📁 زر المذكرات والواجبات",getDesc:()=>"ده الزرار الأساسي للمذكرات والواجب؛ اضغط عليه في أي وقت لفتح ملازم الحصص وملخصات الدروس والـ PDF وتحميلها على جهازك ومذاكرتها.",nextLabel:"التالي: زر رفع الواجب ←"},{tab:"materials",getTarget:()=>document.querySelector('[id^="hw-upload-btn-"]')||document.getElementById("student-active-homeworks-section")||document.getElementById("student-study-materials-section"),badge:"الخطوة 2 من 5",getTitle:()=>"📝 زر رفع حل الواجب",getDesc:()=>"بعد ما تحل الواجب المطلوب في كشكولك وتصوره بكاميرا الموبايل، اضغط على زرار رفع الواجب هنا لرفع صور أو PDF الحل للمعلم عشان يراجعه ويحطلك درجتك فوراً!",nextLabel:"التالي: زر درجات الامتحانات ←"},{tab:"quizzes",getTarget:()=>document.getElementById("student-tab-btn-quizzes"),badge:"الخطوة 3 من 5",getTitle:()=>"📊 زر درجات الكويزات والامتحانات",getDesc:()=>"اضغط على هذا الزر لمتابعة كشف درجاتك في كل كويز وامتحان شهري في السنتر، والنسبة المئوية، وملاحظات وتوجيهات المعلم لمستواك.",nextLabel:"التالي: زر الحضور والغياب ←"},{tab:"attendance",getTarget:()=>document.getElementById("student-tab-btn-attendance"),badge:"الخطوة 4 من 5",getTitle:()=>"📅 زر سجل الحضور والغياب",getDesc:()=>"اضغط على هذا الزر لمتابعة سجل كامل بكل الحصص التي حضرتها وتواريخها، ونسبة التزامك بالحصص وتنبيهات الغياب أولاً بأول.",nextLabel:"التالي: زر باركود السنتر ←"},{tab:"card",getTarget:()=>document.getElementById("student-tab-btn-card"),badge:"الخطوة 5 من 5",getTitle:()=>"🎫 زر باركود الحضور عند باب السنتر",getDesc:()=>"أول ما توصل باب السنتر، اضغط هنا لفتح كارتك وفيه الباركود الخاص بيك عشان المشرف يمسحه بالاسكانر في ثانية واحدة ويسجل حضورك تلقائياً!",nextLabel:"✨ فهمت تماماً، ابدأ الآن!"}];window.renderStudentSpotlightStep=function(l){if(l<0&&(l=0),l>=e.length){window.closeStudentPortalTour(!0);return}window._studentSpotlightIndex=l;let c=e[l];c.tab&&window.switchStudentPortalTab&&window.switchStudentPortalTab(c.tab),window._studentActiveSpotlightEl&&(window._studentActiveSpotlightEl.classList.remove("portal-spotlight-target"),window._studentActiveSpotlightEl=null),setTimeout(()=>{requestAnimationFrame(()=>{let f=c.getTarget(),x=document.getElementById("student-spotlight-backdrop"),a=document.getElementById("student-spotlight-popover"),y=document.getElementById("student-spotlight-arrow");if(!x||!a||!y)return;x.style.display="block",a.style.display="block";let g=typeof c.getTitle=="function"?c.getTitle():c.title,b=typeof c.getDesc=="function"?c.getDesc():c.desc;document.getElementById("student-spotlight-badge").textContent=c.badge;let h=document.getElementById("student-spotlight-dots");h&&(h.innerHTML=Ce(e.length,l,"#2563eb")),document.getElementById("student-spotlight-title").innerHTML=g,document.getElementById("student-spotlight-desc").innerHTML=b;let v=document.getElementById("student-spotlight-prev-btn");v&&(v.style.display=l>0?"block":"none");let k=document.getElementById("student-spotlight-next-btn");k&&(k.innerHTML=`<span>${c.nextLabel}</span>`,l===e.length-1?(k.style.background="linear-gradient(135deg, #059669 0%, #10b981 100%)",k.style.boxShadow="0 4px 12px rgba(16, 185, 129, 0.3)"):(k.style.background="linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",k.style.boxShadow="0 4px 10px rgba(37, 99, 235, 0.25)")),f?(f.classList.add("portal-spotlight-target"),window._studentActiveSpotlightEl=f,q(f,a,y,"#2563eb","student")):(a.style.top="50%",a.style.left="50%",a.style.transform="translate(-50%, -50%)",y.style.display="none")})},120)},window.openStudentPortalTour=function(l=!1,c=null){let f=r(c);!l&&o(f)||(s(f),window.renderStudentSpotlightStep(0))},window.nextStudentPortalTourStep=function(){window._studentSpotlightIndex<e.length-1?window.renderStudentSpotlightStep(window._studentSpotlightIndex+1):window.closeStudentPortalTour(!0)},window.prevStudentPortalTourStep=function(){window._studentSpotlightIndex>0&&window.renderStudentSpotlightStep(window._studentSpotlightIndex-1)},window.closeStudentPortalTour=function(l=!0){window._studentActiveSpotlightEl&&(window._studentActiveSpotlightEl.classList.remove("portal-spotlight-target"),window._studentActiveSpotlightEl=null);let c=document.getElementById("student-spotlight-backdrop"),f=document.getElementById("student-spotlight-popover");if(c&&(c.style.display="none"),f&&(f.style.display="none"),l){let x=r();s(x)}},window._parentSpotlightIndex=0,window._parentActiveSpotlightEl=null;let t=[{tab:"attendance",getTarget:()=>document.getElementById("tab-btn-attendance"),badge:"الخطوة 1 من 4",getTitle:()=>"📅 زر متابعة الحضور والغياب",getDesc:()=>"اضغط على هذا الزر لمتابعة حضور ابنكم اللحظي؛ فور مسح الباركود عند باب السنتر يتسجل حضوره هنا بالساعة والتاريخ أو تنبيه الغياب.",nextLabel:"التالي: زر درجات الامتحانات ←"},{tab:"quizzes",getTarget:()=>document.getElementById("tab-btn-quizzes"),badge:"الخطوة 2 من 4",getTitle:()=>"📊 زر درجات الكويزات والامتحانات",getDesc:()=>"اضغط على هذا الزر لمتابعة تقرير دوري بدرجات الطالب في كل كويز مع النسبة المئوية وملاحظات وتوجيهات المعلم لمتابعة مستواه الدراسي.",nextLabel:"التالي: زر متابعة الواجبات ←"},{tab:"homework",getTarget:()=>document.getElementById("tab-btn-homework"),badge:"الخطوة 3 من 4",getTitle:()=>"📝 زر متابعة الواجبات المنزلية",getDesc:()=>"اضغط على هذا الزر لمعرفة مدى التزام الطالب بتسليم الواجبات في مواعيدها المحددة مع قراءة ملاحظات وتصحيح المعلم على الحل.",nextLabel:"التالي: زر تحديث الصفحة ←"},{tab:"attendance",getTarget:()=>document.getElementById("parent-refresh-data-btn"),badge:"الخطوة 4 من 4",getTitle:()=>"🔄 زر تحديث البيانات اللحظي",getDesc:()=>"يمكنكم في أي لحظة الضغط على هذا الزر في الأعلى لتحديث وعرض أي بيانات وتقارير جديدة تلقائياً فوراً دون الحاجة لتسجيل الخروج.",nextLabel:"✨ فهمت تماماً، ابدأ الآن!"}];window.renderParentSpotlightStep=function(l){if(l<0&&(l=0),l>=t.length){window.closeParentPortalTour(!0);return}window._parentSpotlightIndex=l;let c=t[l];c.tab&&window.switchParentPortalTab&&window.switchParentPortalTab(c.tab),window._parentActiveSpotlightEl&&(window._parentActiveSpotlightEl.classList.remove("portal-spotlight-target-emerald"),window._parentActiveSpotlightEl=null),setTimeout(()=>{requestAnimationFrame(()=>{let f=c.getTarget(),x=document.getElementById("parent-spotlight-backdrop"),a=document.getElementById("parent-spotlight-popover"),y=document.getElementById("parent-spotlight-arrow");if(!x||!a||!y)return;x.style.display="block",a.style.display="block";let g=typeof c.getTitle=="function"?c.getTitle():c.title,b=typeof c.getDesc=="function"?c.getDesc():c.desc;document.getElementById("parent-spotlight-badge").textContent=c.badge;let h=document.getElementById("parent-spotlight-dots");h&&(h.innerHTML=Ce(t.length,l,"#059669")),document.getElementById("parent-spotlight-title").innerHTML=g,document.getElementById("parent-spotlight-desc").innerHTML=b;let v=document.getElementById("parent-spotlight-prev-btn");v&&(v.style.display=l>0?"block":"none");let k=document.getElementById("parent-spotlight-next-btn");k&&(k.innerHTML=`<span>${c.nextLabel}</span>`,l===t.length-1?(k.style.background="linear-gradient(135deg, #059669 0%, #10b981 100%)",k.style.boxShadow="0 4px 12px rgba(16, 185, 129, 0.3)"):(k.style.background="linear-gradient(135deg, #059669 0%, #10b981 100%)",k.style.boxShadow="0 4px 10px rgba(16, 185, 129, 0.25)")),f?(f.classList.add("portal-spotlight-target-emerald"),window._parentActiveSpotlightEl=f,q(f,a,y,"#059669","parent")):(a.style.top="50%",a.style.left="50%",a.style.transform="translate(-50%, -50%)",y.style.display="none")})},120)},window.openParentPortalTour=function(l=!1,c=null){let f=n(c);!l&&i(f)||(d(f),window.renderParentSpotlightStep(0))},window.nextParentPortalTourStep=function(){window._parentSpotlightIndex<t.length-1?window.renderParentSpotlightStep(window._parentSpotlightIndex+1):window.closeParentPortalTour(!0)},window.prevParentPortalTourStep=function(){window._parentSpotlightIndex>0&&window.renderParentSpotlightStep(window._parentSpotlightIndex-1)},window.closeParentPortalTour=function(l=!0){window._parentActiveSpotlightEl&&(window._parentActiveSpotlightEl.classList.remove("portal-spotlight-target-emerald"),window._parentActiveSpotlightEl=null);let c=document.getElementById("parent-spotlight-backdrop"),f=document.getElementById("parent-spotlight-popover");if(c&&(c.style.display="none"),f&&(f.style.display="none"),l){let x=n();d(x)}},window.addEventListener("resize",()=>{if(window._studentActiveSpotlightEl&&document.getElementById("student-spotlight-popover")?.style.display==="block"){let l=document.getElementById("student-spotlight-popover"),c=document.getElementById("student-spotlight-arrow");q(window._studentActiveSpotlightEl,l,c,"#2563eb","student")}if(window._parentActiveSpotlightEl&&document.getElementById("parent-spotlight-popover")?.style.display==="block"){let l=document.getElementById("parent-spotlight-popover"),c=document.getElementById("parent-spotlight-arrow");q(window._parentActiveSpotlightEl,l,c,"#059669","parent")}});let p=null;window.addEventListener("scroll",()=>{p||(p=setTimeout(()=>{if(p=null,window._studentActiveSpotlightEl&&document.getElementById("student-spotlight-popover")?.style.display==="block"){let l=document.getElementById("student-spotlight-popover"),c=document.getElementById("student-spotlight-arrow");q(window._studentActiveSpotlightEl,l,c,"#2563eb","student")}if(window._parentActiveSpotlightEl&&document.getElementById("parent-spotlight-popover")?.style.display==="block"){let l=document.getElementById("parent-spotlight-popover"),c=document.getElementById("parent-spotlight-arrow");q(window._parentActiveSpotlightEl,l,c,"#059669","parent")}},100))},{passive:!0}),window.addEventListener("keydown",function(l){let c=document.getElementById("student-spotlight-popover")?.style.display==="block",f=document.getElementById("parent-spotlight-popover")?.style.display==="block";!c&&!f||(l.key==="Escape"?(c&&window.closeStudentPortalTour(!0),f&&window.closeParentPortalTour(!0)):l.key==="ArrowRight"||l.key==="Enter"?(c&&window.nextStudentPortalTourStep(),f&&window.nextParentPortalTourStep()):l.key==="ArrowLeft"&&(c&&window.prevStudentPortalTourStep(),f&&window.prevParentPortalTourStep()))})}function Je(e=""){if(!e||typeof e!="string")return null;let r=/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,o=e.trim().match(r);return o&&o[2]&&o[2].length===11?o[2]:null}function Qe(e,r,o=""){let s=Je(e);if(!s){alert("رابط الفيديو غير صالح أو ليس رابط يوتيوب");return}let t=document.getElementById("centrlyVideoPlayerModal");t&&t.remove();let n=document.createElement("div");n.id="centrlyVideoPlayerModal",n.style.cssText=`
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(10, 15, 30, 0.92);
    backdrop-filter: blur(8px);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 1rem;
    direction: rtl;
    font-family: system-ui, -apple-system, sans-serif;
  `;let i=o||"منصة سنترلي التعليمية • مشاهدة مؤمنة",d=null,p="طالب";if(o){let b=o.match(/كود:\s*([a-zA-Z0-9_-]+)/);b&&(d=b[1].trim());let h=o.split("•")[0]?.trim();h&&(p=h)}if(!d&&typeof window<"u"&&window._centrlyCurrentStudent&&(d=window._centrlyCurrentStudent.student_code||window._centrlyCurrentStudent.code||null,p=window._centrlyCurrentStudent.name||p),!d)try{let b=JSON.parse(localStorage.getItem("centrly_current_student")||"{}");d=b.student_code||b.code||null,b.name&&(p=b.name)}catch{}let l=typeof window<"u"&&window.__teacherSubdomain||"mr-omar",c=(b="watching")=>{if(!d)return;let h={student_code:String(d).trim(),student_name:p||"طالب",material_title:r||"فيديو حل واجب الباب الرابع",status:b,watched_at:new Date().toISOString()};try{let v=JSON.parse(localStorage.getItem("centrly_video_tracking_map")||"{}");v[d]?.status==="watched"&&b==="watching"?h.status="watched":(v[d]={status:b,studentName:p,updatedAt:h.watched_at},localStorage.setItem("centrly_video_tracking_map",JSON.stringify(v)),window.dispatchEvent(new CustomEvent("centrly_tracking_updated",{detail:v})))}catch{}try{fetch(`${N}/platform/public/${encodeURIComponent(l)}/video-view`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({student_code:h.student_code,student_name:h.student_name,material_title:h.material_title,progress_percent:h.status==="watched"?100:0,status:h.status==="watched"?"completed":"watching"}),keepalive:!0}).catch(()=>{})}catch{}};d&&c("watching"),n.innerHTML=`
    <div style="width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 0.75rem;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; color: #fff;">
        <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
          <span style="display: flex; align-items: center; color: #38bdf8;">${w("video",20,"#38bdf8")}</span>
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${m(r||"مشاهدة الفيديو")}
          </h3>
        </div>
        <button id="closeCentrlyVideoModal" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: background 0.2s;">
          ${w("close",18,"#ffffff")}
        </button>
      </div>

      <!-- Video Container with Watermark -->
      <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);">
        <iframe 
          id="centrlyVideoIframe" src="https://www.youtube.com/embed/${encodeURIComponent(s)}?enablejsapi=1&autoplay=1&rel=0&modestbranding=1" 
          title="${m(r||"Video")}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen 
          style="width: 100%; height: 100%; border: none;">
        </iframe>

        <!-- Anti-piracy Floating / Drifting Watermark -->
        <div id="centrlyFloatingWatermark" style="position: absolute; pointer-events: none; user-select: none; z-index: 10; color: rgba(255, 255, 255, 0.45); font-size: 0.85rem; font-weight: 800; background: rgba(0, 0, 0, 0.35); padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); transition: top 3s ease-in-out, left 3s ease-in-out;">
          ${m(i)}
        </div>
      </div>

      <!-- Video Actions & Watermark Security Note Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; font-size: 0.75rem; color: #94a3b8; padding: 0.25rem 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button id="markCentrlyVideoCompletedBtn" type="button" 
            style="background: #059669; color: #ffffff; border: none; padding: 0.45rem 1rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 2px 4px rgba(5,150,105,0.3); transition: all 0.2s;">
            ${w("check",14,"#ffffff")}
            <span id="markCentrlyVideoCompletedText">تمت المشاهدة</span>
          </button>
          <span id="centrlyWatchLiveStatus" style="font-size: 0.75rem; color: #38bdf8; font-weight: 700;">
            تم توثيق المشاهدة في قاعدة بيانات المعلم
          </span>
        </div>
        <span>هذا المحتوى محمي بحقوق النشر ومسجل باسم الطالب لمنع التداول غير المصرح به.</span>
      </div>
    </div>
  `,document.body.appendChild(n);let f=n.querySelector("#markCentrlyVideoCompletedBtn");f&&(f.onclick=()=>{c("watched"),f.style.background="#10b981";let b=n.querySelector("#markCentrlyVideoCompletedText");b&&(b.textContent="تمت المشاهدة بنجاح");let h=n.querySelector("#centrlyWatchLiveStatus");h&&(h.textContent="تم توثيق إتمام المشاهدة بنجاح (شاهد ✔)",h.style.color="#34d399")});let x=b=>{try{let h=typeof b.data=="string"?JSON.parse(b.data):b.data;if(h&&h.event==="onStateChange"){if(h.info===1)c("watching");else if(h.info===0){c("watched"),f&&(f.style.background="#10b981");let v=n.querySelector("#markCentrlyVideoCompletedText");v&&(v.textContent="تمت المشاهدة واكتملت");let k=n.querySelector("#centrlyWatchLiveStatus");k&&(k.textContent="عاش يا بطل! تم إنهاء مشاهدة الفيديو بنجاح (شاهد ✔)",k.style.color="#34d399")}}}catch{}};window.addEventListener("message",x);let a=()=>{window.removeEventListener("message",x),n.remove()},y=n.querySelector("#closeCentrlyVideoModal");y&&(y.onclick=a),n.onclick=b=>{b.target===n&&a()};let g=n.querySelector("#centrlyFloatingWatermark");if(g){let b=()=>{if(!document.body.contains(n))return;let v=Math.floor(Math.random()*70+10),k=Math.floor(Math.random()*60+10);g.style.top=v+"%",g.style.left=k+"%"};b();let h=setInterval(()=>{document.body.contains(n)?b():clearInterval(h)},4500)}}typeof window<"u"&&(window.centrlyPlayVideoWithWatermark=Qe);function Re(e){if(!e||typeof e!="string")return"";let r=e.trim();return r.includes("/storage/v1/object/sign/homework-submissions/")?r.replace("/storage/v1/object/sign/homework-submissions/","/storage/v1/object/public/homework-submissions/").split("?")[0]:r}function Le(e,r={},o=[],s=[]){let t=e.type==="pdf",n=e.type==="video",i=Re(e.url),d=n&&e.book_name==="approved_homework",p=!0,l="واجب مطلوب",c=!1;if(d){let a=[];try{if(e.questions){let _=JSON.parse(e.questions);Array.isArray(_.allowed_student_ids)&&(a=_.allowed_student_ids),_.homework_title&&(l=_.homework_title)}}catch{}let y=r.id||"",g=r.student_code||"",b=!!(y&&a.includes(y)||g&&a.includes(g)),h=e.pages;if(h&&l==="واجب مطلوب"){let _=o.find(A=>A.id===h);_&&(l=_.title)}let v=s.some(_=>_.id===h);c=!!o.find(_=>_.id===h&&_.submission_status==="pending"),p=b||v}let f=`${r.name||"طالب"} • كود: ${r.student_code||r.code||"-"} • ${r.student_phone||r.phone||r.parent_phone||""}`;if(d&&!p)return`
      <div style="padding: 1rem; border-radius: 0.75rem; background: #fffbeb; border: 1.5px dashed #f59e0b; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 180px;">
          <div style="margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.4rem;">
            <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 0.3rem; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">
              ${w("lock",12,"#b45309")}
              <span>فيديو مقفل (مشروط باعتماد واجب)</span>
            </span>
          </div>
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0 0 0.3rem 0;">
            ${m(e.title)}
          </h4>
          <div style="font-size: 0.8rem; color: #92400e; display: flex; align-items: center; gap: 0.35rem; line-height: 1.4;">
            ${w("info",14,"#b45309")}
            <span>
              ${c?`تم تسليم الواجب (<strong>${m(l)}</strong>) وهو قيد مراجعة واعتماد المعلم لفتح الفيديو تلقائياً فور الاعتماد.`:`يتطلب فتح ومشاهدة الفيديو <strong>اعتماد تسليم واجب: "${m(l)}"</strong> أولاً من المعلم.`}
            </span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
          <button type="button" onclick="window.centrlyPlayVideoWithWatermark ? window.centrlyPlayVideoWithWatermark('${m(i)}', '${m(e.title)}', '${m(f)}') : window.open('${m(i)}', '_blank')"
            style="display: inline-flex; align-items: center; gap: 0.35rem; background: #2563eb; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; border: none; font-size: 0.8rem; font-weight: 800; cursor: pointer; box-shadow: 0 1px 3px rgba(37,99,235,0.25);">
            ${w("video",13,"#ffffff")}
            <span>مشاهدة الفيديو</span>
          </button>
          ${c?`
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #fef3c7; color: #b45309; padding: 0.45rem 0.75rem; border-radius: 0.5rem; font-size: 0.76rem; font-weight: 800; border: 1px solid #fde68a;">
              ${w("clock",13,"#b45309")}
              <span>الواجب قيد الاعتماد</span>
            </span>
          `:`
            <button type="button" onclick="window.scrollToHomework && window.scrollToHomework('${m(e.pages||"")}')"
              style="display: inline-flex; align-items: center; gap: 0.35rem; background: #f59e0b; color: #ffffff; padding: 0.45rem 0.75rem; border-radius: 0.5rem; border: none; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
              ${w("homework",13,"#ffffff")}
              <span>تسليم الواجب</span>
            </button>
          `}
        </div>
      </div>
    `;let x=t?`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("file",12,"#1d4ed8")} PDF</span>`:n?`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("video",12,"#1d4ed8")} فيديو شرح</span>`:`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("link",12,"#1d4ed8")} رابط</span>`;return`
    <div style="padding: 0.9rem 1rem; border-radius: 0.75rem; background: ${d?"#f0fdf4":"#f8fafc"}; border: 1px solid ${d?"#bbf7d0":"#e2e8f0"}; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 180px;">
        <div style="margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
          <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 0.3rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
            ${x}
          </span>
          ${d?`
            <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 0.3rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 0.2rem;">
              ${w("check",11,"#047857")}
              <span>تم فتح الفيديو (الواجب معتمد)</span>
            </span>
          `:""}
        </div>
        <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0;">
          ${m(e.title)}
        </h4>
        ${e.description?`
          <p style="font-size: 0.78rem; color: #64748b; margin: 0.25rem 0 0 0; line-height: 1.4;">
            ${m(e.description)}
          </p>
        `:""}
      </div>

      ${!i||i==="#"?"":n?`
            <div>
              <button type="button" onclick="window.centrlyPlayVideoWithWatermark ? window.centrlyPlayVideoWithWatermark('${m(i)}', '${m(e.title)}', '${m(f)}') : window.open('${m(i)}', '_blank')"
                style="display: inline-flex; align-items: center; gap: 0.35rem; background: #2563eb; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; border: none; font-size: 0.8rem; font-weight: 800; cursor: pointer; box-shadow: 0 1px 3px rgba(37,99,235,0.25);">
                ${w("video",13,"#ffffff")}
                <span>مشاهدة الفيديو</span>
              </button>
            </div>
          `:`
          <div>
            <a href="${m(i)}" target="_blank" rel="noopener noreferrer"
              style="display: inline-flex; align-items: center; gap: 0.35rem; background: #1d4ed8; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; text-decoration: none; font-size: 0.8rem; font-weight: 800; box-shadow: 0 1px 3px rgba(29,78,216,0.2);">
              ${w(t?"download":"link",13,"#ffffff")}
              <span>${t?"تحميل / فتح المذكرة":"فتح الرابط"}</span>
            </a>
          </div>
        `}
    </div>
  `}function be(e={},r="dashboard"){if(e.error||!e.student)return`
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; padding: 1.5rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
        <div style="max-width: 480px; width: 100%; background: #fff; border-radius: 1rem; padding: 2.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 0.75rem;">${w("lock",48,"#ef4444")}</div>
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #ef4444; margin: 0 0 0.5rem 0;">رابط الطالب غير صالح أو منتهي الصلاحية</h2>
          <p style="font-size: 0.9rem; color: #64748b; margin: 0 0 1.5rem 0; line-height: 1.6;">
            ${m(e.error||"تعذر تحميل بيانات الطالب. يرجى التأكد من فتح الرابط الصحيح المرسل لك أو مراجعة معلمك.")}
          </p>
          <div style="font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
            منظومة سنترلي التعليمية | Centrly Student Portal
          </div>
        </div>
      </div>
    `;let o=e.student,s=(o.id||o.student_code||o.code||o.student_phone||"").toString().trim();if(typeof window<"u"&&(window._centrlyCurrentStudent=o,s)){window._centrlyCurrentStudentId=s;try{localStorage.setItem("centrly_current_student",JSON.stringify({id:o.id,student_code:o.student_code||o.code||s,name:o.name}))}catch{}}let t=e.summary||{total_sessions:0,attended_count:0,absent_count:0,attendance_rate:"0%",homework_done_count:0,homework_total_count:0,total_quizzes:0,quiz_average_percentage:"—"},n=e.sessions||[],i=e.quizzes||[],d=e.materials||[],p=d.filter(u=>u.type==="online_quiz"||u.questions&&!u.is_homework),l=d.filter(u=>u.is_homework),c=d.filter(u=>u.type==="video"),f=d.filter(u=>!u.is_homework&&u.type!=="online_quiz"&&u.type!=="video"),x=l.filter(u=>u.submission_status==="approved");if(typeof window<"u"){window.__portalMaterials=d;let u="";try{let $=localStorage.getItem("centrly_portal_token")?localStorage:sessionStorage,z=$.getItem("centrly_portal_role");(!z||z==="student")&&(u=$.getItem("centrly_portal_token")||"")}catch{}window.__portalToken=e.token||(typeof location<"u"?new URLSearchParams(location.search).get("token"):"")||u}let a=o.teacher_phone||e.teacher_phone||o.contact_phone||e.contact_phone||"",y=a?a.replace(/[^\d+]/g,""):"";y.startsWith("+")?y=y.substring(1):y.startsWith("01")&&(y="2"+y);let g=o.teacher_name||"المعلم",b=encodeURIComponent(`السلام عليكم يا ${g}، أنا الطالب ${o.name}${o.student_code?` (كود: ${o.student_code})`:""}${o.group_name?` - مجموعة ${o.group_name}`:""}، وعندي استفسار بخصوص المادة.`),h=y?`https://wa.me/${y}?text=${b}`:null,v=new Date,k=u=>{if(u.can_submit===!1||u.submission_status==="approved")return!0;if(u.can_submit===!0||u.submission_status==="rejected"||u.submission_status==="pending")return!1;if(u.due_date)try{let $=new Date(u.due_date);if(!isNaN($.getTime())&&($.setHours(23,59,59,999),$.getTime()<v.getTime()))return!0}catch{}return!1},_=l.filter(u=>!k(u)),A=l.filter(u=>k(u)),S=[..._].sort((u,$)=>{let z=u.submission_status==="rejected",T=$.submission_status==="rejected";return z&&!T?-1:!z&&T?1:u.due_date&&$.due_date?new Date(u.due_date)-new Date($.due_date):0}),I=[...A].sort((u,$)=>{let z=u.submitted_at||u.due_date||u.created_at||"";return($.submitted_at||$.due_date||$.created_at||"").localeCompare(z)});return`
    <div style="min-height: 100vh; background-color: #f8fafc; padding: 1rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Student Portal Header (Teacher White-Labeled) -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); border-radius: 1.25rem; padding: 1.5rem; box-shadow: 0 4px 20px rgba(37, 99, 235, 0.15); color: #fff; text-align: center; position: relative; overflow: hidden;">
          <!-- Subtle decorative circle -->
          <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; position: relative; z-index: 2;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #10b981; font-weight: 700; background: rgba(255,255,255,0.95); padding: 0.25rem 0.6rem; border-radius: 9999px;">
              <span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%;"></span>
              بوابة الطالب — ${m(g)}
            </span>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <button onclick="window.openStudentPortalTour ? window.openStudentPortalTour(true) : null" 
                style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.35); border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" title="شرح أقسام المنصة">
                ${w("lightbulb",13,"#fde047")}
                <span>شرح المنصة</span>
              </button>
              <button onclick="window.centrlyApp && window.centrlyApp.reloadStudentPortal ? window.centrlyApp.reloadStudentPortal() : window.location.reload()" 
                style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;">
                ${w("refresh",13,"#ffffff")}
                <span>تحديث</span>
              </button>
              <button onclick="window.centrlyApp && window.centrlyApp.handlePortalLogout ? window.centrlyApp.handlePortalLogout() : (window.location.href='/portal')" 
                style="background: rgba(239,68,68,0.25); border: 1px solid rgba(239,68,68,0.4); border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" title="تسجيل الخروج">
                ${w("logout",13,"#ffffff")}
                <span>خروج</span>
              </button>
            </div>
          </div>

          <div style="margin: 0 auto 0.5rem; width: 48px; height: 48px; background: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #1e3a8a; font-weight: 900; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            ${w("gradCap",24,"#1e3a8a")}
          </div>
          <h1 style="font-size: 1.35rem; font-weight: 900; margin: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
            أهلاً بك يا ${m(o.name)}
          </h1>
          
          <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap;">
            <span style="background: rgba(255,255,255,0.2); padding: 0.2rem 0.6rem; border-radius: 0.4rem; font-family: monospace; font-size: 0.8rem; font-weight: 700;">كود: ${m(o.student_code)}</span>
            ${o.group_name?`<span style="background: rgba(245,158,11,0.3); border: 1px solid rgba(245,158,11,0.5); padding: 0.2rem 0.6rem; border-radius: 0.4rem; font-size: 0.8rem; font-weight: 700;">${m(o.group_name)}</span>`:""}
          </div>
          
          <p style="font-size: 0.8rem; opacity: 0.9; margin: 0.5rem 0 0 0;">
            الواجبات، الامتحانات الدورية، وفيديوهات الشرح والمتابعة
          </p>
        </div>

        ${Z(e)}
        <!-- Teacher Direct WhatsApp Contact Card -->
        ${h?`
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1.5px solid #86efac; border-radius: 1rem; padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);">
                ${w("whatsapp",22,"#ffffff")}
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 0.9rem; color: #065f46;">
                  تواصل مباشر مع ${m(g)}
                </div>
                <div style="font-size: 0.76rem; color: #047857; margin-top: 1px;">
                  ${o.subject_name?`${m(o.subject_name)} • `:""}لأي استفسار في المنهج أو بخصوص الواجب والامتحانات
                </div>
              </div>
            </div>
            <a href="${h}" target="_blank" rel="noopener noreferrer"
              style="background: #10b981; color: #ffffff; text-decoration: none; padding: 0.55rem 0.95rem; border-radius: 0.65rem; font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3); transition: transform 0.15s ease;"
              onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
              ${w("whatsapp",15,"#ffffff")}
              <span>مراسلة واتساب</span>
            </a>
          </div>
        `:""}

        <!-- Navigation Bar (Dashboard, Materials, Exams, Videos, Attendance, Barcode) -->
        <div style="display: flex; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 0.85rem; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('dashboard') : null" id="student-tab-btn-dashboard"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${r==="dashboard"?"#ffffff":"transparent"}; color: ${r==="dashboard"?"#1e3a8a":"#64748b"}; box-shadow: ${r==="dashboard"?"0 2px 6px rgba(0,0,0,0.08)":"none"};">
            ${w("dashboard",14,r==="dashboard"?"#1e3a8a":"#64748b")}
            <span>الرئيسية والمهام</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('materials') : null" id="student-tab-btn-materials"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${r==="materials"?"#ffffff":"transparent"}; color: ${r==="materials"?"#1e3a8a":"#64748b"}; box-shadow: ${r==="materials"?"0 2px 6px rgba(0,0,0,0.08)":"none"};">
            ${w("homework",14,r==="materials"?"#1e3a8a":"#64748b")}
            <span>الواجبات والمذكرات ${_.length>0?`(${_.length})`:""}</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('exams') : null" id="student-tab-btn-exams"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${r==="exams"?"#ffffff":"transparent"}; color: ${r==="exams"?"#1e3a8a":"#64748b"}; box-shadow: ${r==="exams"?"0 2px 6px rgba(0,0,0,0.08)":"none"};">
            ${w("chart",14,r==="exams"?"#1e3a8a":"#64748b")}
            <span>الامتحانات ${p.length>0?`(${p.length})`:""}</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('videos') : null" id="student-tab-btn-videos"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${r==="videos"?"#ffffff":"transparent"}; color: ${r==="videos"?"#1e3a8a":"#64748b"}; box-shadow: ${r==="videos"?"0 2px 6px rgba(0,0,0,0.08)":"none"};">
            ${w("video",14,r==="videos"?"#1e3a8a":"#64748b")}
            <span>فيديوهات الشرح ${c.length>0?`(${c.length})`:""}</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('attendance') : null" id="student-tab-btn-attendance"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${r==="attendance"?"#ffffff":"transparent"}; color: ${r==="attendance"?"#1e3a8a":"#64748b"}; box-shadow: ${r==="attendance"?"0 2px 6px rgba(0,0,0,0.08)":"none"};">
            ${w("calendar",14,r==="attendance"?"#1e3a8a":"#64748b")}
            <span>الحضور والغياب</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('card') : null" id="student-tab-btn-card"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${r==="card"?"#ffffff":"transparent"}; color: ${r==="card"?"#1e3a8a":"#64748b"}; box-shadow: ${r==="card"?"0 2px 6px rgba(0,0,0,0.08)":"none"};">
            ${w("barcode",14,r==="card"?"#1e3a8a":"#64748b")}
            <span>باركود الحضور</span>
          </button>
        </div>

        <!-- ================= TAB 1: DASHBOARD (الرئيسية والمهام) ================= -->
        <div id="student-tab-content-dashboard" style="display: ${r==="dashboard"?"flex":"none"}; flex-direction: column; gap: 1rem;">
          
          <!-- 3 Golden KPIs -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #ffffff; padding: 1rem 0.75rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">نسبة الحضور</div>
              <div style="font-size: 1.55rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">
                ${m(t.attendance_rate??"لا توجد بيانات")}
              </div>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
                ${m(t.attended_count||0)} حاضر / ${m(t.total_sessions||0)} حصة
              </div>
            </div>

            <div style="background: #ffffff; padding: 1rem 0.75rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">متوسط الكويزات</div>
              <div style="font-size: 1.55rem; font-weight: 900; color: #2563eb; margin-top: 0.2rem;">
                ${m(t.quiz_average_percentage||"—")}
              </div>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
                ${i.length>0?`${i.length} كويز مرصود`:"لا توجد كويزات"}
              </div>
            </div>

            <div style="background: #ffffff; padding: 1rem 0.75rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الواجبات المسلّمة</div>
              <div style="font-size: 1.55rem; font-weight: 900; color: ${_.length>0?"#b45309":"#059669"}; margin-top: 0.2rem;">
                ${x.length} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">/ ${l.length}</span>
              </div>
              <div style="font-size: 0.72rem; color: ${_.length>0?"#b45309":"#059669"}; margin-top: 0.2rem; font-weight: 700;">
                ${_.length>0?`${_.length} مطلوب للتسليم`:"كافة الواجبات معتمدة"}
              </div>
            </div>
          </div>

          <!-- To-Do Action Items Section -->
          <div style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.65rem;">
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${w("homework",18,"#1e3a8a")}
                <span>المهام المطلوب متابعتها وإنجازها</span>
              </h2>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">
                ${_.length+p.length} مهام معلقة
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${_.length>0?`
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #fffbeb; border: 1px solid #fef3c7; border-right: 4px solid #f59e0b; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #b45309; background: #fef3c7; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">واجب مطلوب للتسليم</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${m(_[0].title)}</h4>
                    ${_[0].due_date?`<div style="font-size: 0.75rem; color: #92400e; margin-top: 0.15rem;">ينتهي: ${m(_[0].due_date)}</div>`:""}
                  </div>
                  <button type="button" onclick="window.switchStudentPortalTab('materials')" class="btn btn-sm btn-primary" style="font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.9rem; border-radius: 0.5rem;">
                    تسليم الواجب الآن
                  </button>
                </div>
              `:""}

              ${p.length>0?`
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #eff6ff; border: 1px solid #dbeafe; border-right: 4px solid #2563eb; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #1d4ed8; background: #dbeafe; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">امتحان أونلاين متاح</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${m(p[0].title)}</h4>
                    <div style="font-size: 0.75rem; color: #1e40af; margin-top: 0.15rem;">بيئة مؤمنة • تصحيح واعتماد مباشر</div>
                  </div>
                  <button type="button" onclick="window.switchStudentPortalTab('exams')" class="btn btn-sm" style="background: #1e3a8a; color: #fff; font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.9rem; border-radius: 0.5rem; border: none; cursor: pointer;">
                    دخول الامتحان
                  </button>
                </div>
              `:""}

              ${c.length>0?`
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #f5f3ff; border: 1px solid #ede9fe; border-right: 4px solid #7c3aed; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #6d28d9; background: #ede9fe; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">فيديو شرح متاح</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${m(c[0].title)}</h4>
                    <div style="font-size: 0.75rem; color: #5b21b6; margin-top: 0.15rem;">شرح أفكار المنهج وحلول التمارين</div>
                  </div>
                  <button type="button" onclick="window.switchStudentPortalTab('videos')" class="btn btn-sm" style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.9rem; border-radius: 0.5rem; border: none; cursor: pointer;">
                    مشاهدة الفيديو
                  </button>
                </div>
              `:""}

              <!-- Class schedule card -->
              <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">
                    ${m(o.group_name||"مجموعة السنتر")}
                  </div>
                  <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.15rem;">
                    احرص على إحضار كشكول الواجب والملزمة وإظهار باركود الحضور عند بوابة السنتر.
                  </div>
                </div>
                <button type="button" onclick="window.switchStudentPortalTab('card')" style="background: #ffffff; border: 1px solid #cbd5e1; color: #1e293b; padding: 0.45rem 0.85rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 800; cursor: pointer;">
                  عرض الباركود
                </button>
              </div>

            </div>
          </div>

        </div>

        <!-- ================= TAB 1: MATERIALS & HOMEWORK (TOP OF PAGE) ================= -->
        <div id="student-tab-content-materials" style="display: ${r==="materials"?"flex":"none"}; flex-direction: column; gap: 1rem;">
          
          <!-- Homework & Materials KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الواجبات المطلوبة</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: ${_.length>0?"#b45309":"#059669"}; margin-top: 0.2rem;">
                ${_.length}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${_.length>0?"واجب بحاجة لحلك وتسليمه":"لا توجد واجبات مطلوبة حالياً"}
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #059669; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
                ${w("check",13,"#059669")}
                <span>الواجبات المسلّمة</span>
              </div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">
                ${x.length} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">/ ${l.length}</span>
              </div>
              <div style="font-size: 0.725rem; color: #059669; font-weight: 700; margin-top: 0.2rem;">
                ${l.length>0&&x.length===l.length?"تم تسليم كافة الواجبات بنجاح":`تم تسليم ${x.length} واجب بنجاح`}
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">المذكرات والشروحات</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #8b5cf6; margin-top: 0.2rem;">
                ${f.length}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ملف متاح للتحميل
              </div>
            </div>
          </div>

          <!-- Free PDF Helper & Conversion Guide Accordion (Collapsible) -->
          <div id="student-pdf-helper-card" style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.85rem; overflow: hidden; box-shadow: 0 1px 4px rgba(16, 185, 129, 0.05);">
            <button type="button" onclick="window.togglePdfHelper ? window.togglePdfHelper() : null" 
              style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.1rem; background: #f0fdf4; border: none; cursor: pointer; text-align: right; transition: background 0.2s;"
              onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                <div style="color: #166534; display: flex; align-items: center;">${w("lightbulb",20,"#166534")}</div>
                <div>
                  <span style="font-size: 0.88rem; font-weight: 800; color: #166534; display: block;">
                    مش عارف تحوّل صور حل الكشكول إلى ملف PDF؟
                  </span>
                  <span style="font-size: 0.73rem; color: #15803d; font-weight: 600;">
                    (اضغط هنا لمعرفة طريقة التحويل المجانية في ثوانٍ)
                  </span>
                </div>
              </div>
              <div id="pdf-helper-arrow" style="color: #166534; transition: transform 0.25s ease; display: flex; align-items: center;">
                ${w("chevronDown",18,"#166534")}
              </div>
            </button>

            <!-- Collapsible Content (Closed by default) -->
            <div id="pdf-helper-content" style="display: none; padding: 0.75rem 1.1rem 1rem 1.1rem; border-top: 1px dashed #bbf7d0; background: #ffffff;">
              <p style="font-size: 0.8rem; color: #15803d; margin: 0 0 0.5rem 0; line-height: 1.5; font-weight: 600;">
                إذا قمت بتصوير صفحات حلك بكاميرا الهاتف، يمكنك دمجها في ملف PDF واحد مجاناً وبدون أي برامج مدفوعة:
              </p>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 0.6rem; padding: 0.65rem 0.85rem; font-size: 0.8rem; color: #1e293b; line-height: 1.8;">
                <b>1.</b> افتح أداة: 
                <a href="https://www.ilovepdf.com/jpg_to_pdf" target="_blank" rel="noopener noreferrer"
                  style="color: #1d4ed8; font-weight: 800; text-decoration: underline; margin: 0 0.25rem;">
                  موقع iLovePDF المجاني (تحويل صور JPG إلى PDF)
                </a>
                أو استخدم خيار "طباعة كـ PDF" من هاتفك.<br>
                <b>2.</b> اختر صور صفحات حل الواجب بالترتيب من ألبوم الصور.<br>
                <b>3.</b> اضغط <b>"تحويل إلى PDF"</b> ثم حمّل الملف الناتج على جهازك.<br>
                <b>4.</b> ارجع هنا واضغط زر <b>"رفع حل الواجب (PDF أو صورة)"</b> أدناه لإرساله لمعلمك مباشرة!
              </div>
            </div>
          </div>

          <!-- Active Homeworks Section (Required & In Progress) -->
          <div id="student-active-homeworks-section" style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h2 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                  ${w("homework",18,"var(--centrly-blue-700)")}
                  <span>الواجبات المطلوبة حالياً</span>
                </h2>
                <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  قم بحل الأسئلة وارفع إجابتك قبل انتهاء الموعد
                </p>
              </div>
              <span class="badge ${S.length>0?"badge-amber":"badge-green"}" style="font-weight: 700; font-size: 0.8rem; padding: 0.3rem 0.65rem;">
                ${S.length>0?`${S.length} واجب مطلوب`:"لا توجد واجبات متأخرة"}
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${S.length>0?S.map(u=>{let $=u.type==="pdf",z=u.type==="video",T=$?`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("file",12,"#1d4ed8")} PDF</span>`:z?`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("video",12,"#1d4ed8")} فيديو</span>`:`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("link",12,"#1d4ed8")} رابط</span>`,H=u.submission_status||"unsubmitted",M=H==="pending",P=H==="rejected",j=P?"#fffafa":"#f8fafc",C=P?"#fca5a5":"#e2e8f0",G=P?`<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; display: inline-flex; align-items: center; gap: 0.25rem;">${w("alertTriangle",12,"#dc2626")} <span>مطلوب إعادة التسليم</span></span>`:M?`<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fffbeb; color: #d97706; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">${w("clock",12,"#d97706")} <span>تم الرفع (قيد مراجعة المعلم)</span></span>`:`<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">${w("homework",12,"#b45309")} <span>واجب منزلي مطلوب</span></span>`;return`
                  <div id="hw-card-${m(u.id)}" style="padding: 1.1rem; border-radius: 0.85rem; background: ${j}; border: 1px solid ${C}; display: flex; flex-direction: column; gap: 0.65rem;">
                    
                    <!-- Top row: Title and Tags -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
                          <span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 0.35rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                            ${T}
                          </span>
                          ${G}
                        </div>
                        <h3 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0;">
                          ${m(u.title)}
                        </h3>

                        ${u.book_name||u.pages||u.questions?`
                          <!-- Prominent Textbook Questions Box -->
                          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 0.65rem; padding: 0.75rem 0.85rem; margin-top: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.35rem; font-weight: 800; color: #1e40af; font-size: 0.85rem; margin-bottom: 0.45rem;">
                              ${w("book",15,"#1e40af")}
                              <span>المطلوب حله من الكتاب / الملزمة:</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; font-size: 0.825rem;">
                              <div style="background: #ffffff; padding: 0.45rem 0.65rem; border-radius: 0.45rem; border: 1px solid #dbeafe;">
                                <span style="color: #64748b; font-size: 0.72rem; display: block; font-weight: 600;">الكتاب / الملزمة:</span>
                                <span style="font-weight: 800; color: #1e3a8a;">${m(u.book_name||"الكتاب المدرسي")}</span>
                              </div>
                              <div style="background: #ffffff; padding: 0.45rem 0.65rem; border-radius: 0.45rem; border: 1px solid #dbeafe;">
                                <span style="color: #64748b; font-size: 0.72rem; display: block; font-weight: 600;">الصفحات المطلوبة:</span>
                                <span style="font-weight: 800; color: #1e3a8a;">${m(u.pages||"—")}</span>
                              </div>
                              <div style="background: #ffffff; padding: 0.45rem 0.65rem; border-radius: 0.45rem; border: 1px solid #dbeafe;">
                                <span style="color: #64748b; font-size: 0.72rem; display: block; font-weight: 600;">أرقام الأسئلة:</span>
                                <span style="font-weight: 800; color: #b45309;">${m(u.questions||"—")}</span>
                              </div>
                            </div>
                          </div>
                        `:""}

                        ${u.description?`
                          <div style="font-size: 0.85rem; color: #1e293b; margin: 0.5rem 0 0 0; line-height: 1.6; background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; border-right: 3px solid #2563eb;">
                            <div style="font-weight: 800; color: #1e40af; font-size: 0.825rem; margin-bottom: 0.25rem;">وصف الواجب والمطلوب حله:</div>
                            <div style="white-space: pre-wrap; color: #334155;">${m(u.description)}</div>
                          </div>
                        `:""}

                        ${(()=>{let F=Re(u.url);return F&&F!=="#"?`
                            <div style="margin-top: 0.6rem;">
                              <a href="${m(F)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm"
                                style="display: inline-flex; align-items: center; gap: 0.4rem; background: #2563eb; color: #ffffff; font-weight: 800; text-decoration: none; padding: 0.45rem 0.85rem; border-radius: 0.5rem; font-size: 0.825rem; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                                ${w($?"file":z?"video":"link",14,"#ffffff")}
                                <span>فتح / تحميل ملف الواجب المرفق (PDF / الرابط)</span>
                              </a>
                            </div>
                          `:""})()}
                      </div>
                    </div>

                    <!-- Due date if homework -->
                    ${u.due_date?`
                      <div style="font-size: 0.775rem; color: #b45309; background: #fffbeb; padding: 0.4rem 0.7rem; border-radius: 0.4rem; border: 1px solid #fef3c7; display: flex; align-items: center; gap: 0.4rem;">
                        ${w("clock",13,"#b45309")}
                        <span>آخر موعد لتسليم الواجب: <b>${m(u.due_date)}</b></span>
                      </div>
                    `:""}

                    <!-- Homework Submission Box with Upload Button & Teacher Notes -->
                    <div style="background: #ffffff; border: 1px solid ${P?"#fca5a5":"#e2e8f0"}; border-radius: 0.65rem; padding: 0.85rem; margin-top: 0.2rem;">
                      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <div style="font-size: 0.825rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                          ${w("upload",14,"#0f172a")}
                          <span>حالة تسليمك للواجب:</span>
                        </div>
                        
                        <div>
                          ${M?`
                            <span style="font-size: 0.75rem; font-weight: 800; background: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${w("clock",13,"#d97706")}
                              <span>تم الرفع (قيد مراجعة المعلم)</span>
                            </span>
                          `:P?`
                            <span style="font-size: 0.75rem; font-weight: 800; background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${w("alertTriangle",13,"#dc2626")}
                              <span>المعلم طلب إعادة التسليم</span>
                            </span>
                          `:`
                            <span style="font-size: 0.75rem; font-weight: 800; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                              <span>لم يُسلّم بعد</span>
                            </span>
                          `}
                        </div>
                      </div>

                      ${P?`
                        <div style="font-size: 0.825rem; background: #fff7ed; border-right: 3px solid #ea580c; border: 1px solid #fed7aa; padding: 0.55rem 0.75rem; border-radius: 0.4rem; color: #9a3412; margin-bottom: 0.65rem;">
                          <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
                            ${w("alertTriangle",14,"#ea580c")}
                            <span>توجيه وملاحظة المعلم لإعادة الحل:</span>
                          </div>
                          <div>${m(u.teacher_feedback||"يرجى إعادة حل الواجب وتصحيحه ورفع الحل من جديد.")}</div>
                        </div>
                      `:u.teacher_feedback?`
                        <div style="font-size: 0.8rem; background: #fff7ed; border-right: 3px solid #ea580c; padding: 0.45rem 0.65rem; border-radius: 0.35rem; color: #9a3412; margin-bottom: 0.6rem;">
                          <b>ملاحظة المعلم:</b> ${m(u.teacher_feedback)}
                        </div>
                      `:""}

                      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem;">
                        ${u.submission_url?`
                          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            ${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(u.submission_url)?`
                              <a href="${m(u.submission_url)}" target="_blank" rel="noopener noreferrer" title="اضغط لتكبير صورة الواجب">
                                <img src="${m(u.submission_url)}" alt="صورة الواجب" style="width: 38px; height: 38px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                              </a>
                            `:""}
                            <a href="${m(u.submission_url)}" target="_blank" rel="noopener noreferrer"
                              style="font-size: 0.8rem; color: #2563eb; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${w("file",14,"#2563eb")}
                              <span>${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(u.submission_url)?"معاينة صورة الواجب":"معاينة ملفك المرفوع"} (${m(u.submitted_at?u.submitted_at.slice(0,10):"مرفوع")}) ↗</span>
                            </a>
                          </div>
                        `:`
                          <span style="font-size: 0.75rem; color: #94a3b8;">ارفع الحل بصيغة PDF أو صورة واضحة (الحد الأقصى 25MB)</span>
                        `}

                        <!-- File Upload Trigger (PDF or Images) -->
                        ${u.can_submit===!1?'<p role="status">هذا التكليف لا يستقبل رفع ملفات جديدة. تسليمك السابق محفوظ.</p>':`<div>
                          <input type="file" id="hw-file-input-${m(u.id)}" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.heic" style="display: none;"
                            onchange="window.centrlyApp && window.centrlyApp.handleStudentHomeworkUpload ? window.centrlyApp.handleStudentHomeworkUpload('${m(u.id)}', this.files[0]) : null">
                          
                          <button type="button" onclick="document.getElementById('hw-file-input-${m(u.id)}').click()" id="hw-upload-btn-${m(u.id)}"
                            style="background: ${P?"#dc2626":"#059669"}; color: #ffffff; border: 1px solid ${P?"#b91c1c":"#059669"}; padding: 0.45rem 0.95rem; border-radius: 0.5rem; font-size: 0.825rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.2s; box-shadow: 0 2px 6px ${P?"rgba(220,38,38,0.3)":"rgba(5,150,105,0.25)"};">
                            ${w("upload",14,"#ffffff")}
                            <span>${P?"رفع حل الواجب الجديد (إعادة التسليم)":M?"تعديل / رفع نسخة أحدث":"رفع حل الواجب (PDF أو صورة)"}</span>
                          </button>
                        </div>`}
                      </div>

                    </div>

                    <!-- Notebook Instructions -->
                    <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: #1e40af; background: #eff6ff; padding: 0.45rem 0.75rem; border-radius: 0.45rem; border: 1px solid #bfdbfe; margin-top: 0.25rem;">
                      ${w("edit",14,"#1e40af")}
                      <span><b>طريقة التسليم:</b> قم بحل الأسئلة في كشكولك بخط واضح، ثم صوّر الصفحات بكاميرا الموبايل وارفع الصورة أو ملف الـ PDF عبر زر الرفع أعلاه مباشرة.</span>
                    </div>

                  </div>
                `}).join(""):`
                <div style="text-align: center; padding: 1.75rem 1rem; color: #166534; font-size: 0.88rem; background: #f0fdf4; border-radius: 0.75rem; border: 1px dashed #86efac;">
                  <div style="display: flex; justify-content: center; margin-bottom: 0.4rem; color: #166534;">${w("check",32,"#166534")}</div>
                  <b>رائع جداً! لا توجد واجبات مطلوبة منك حالياً.</b><br>
                  <span style="font-size: 0.78rem; color: #15803d;">كافة واجباتك منجزة، أو لم يقم المعلم بنشر واجبات جديدة بعد.</span>
                </div>
              `}
            </div>
          </div>

          ${f.length>0?`
            <!-- Study Materials & Lecture Notes Section -->
            <div id="student-study-materials-section" style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <h2 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                    ${w("materials",18,"#8b5cf6")}
                    <span>المذكرات والملازم الدراسية</span>
                  </h2>
                  <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                    تحميل المذكرات والشروحات الخاصة بمجموعتك
                  </p>
                </div>
                <span class="badge badge-blue" style="font-weight: 700;">${f.length} ملف متاح</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${f.map(u=>Le(u,o,l,x)).join("")}
              </div>
            </div>
          `:""}

          <!-- Finished Homeworks (Bottom Archive - Compact Single Row as requested) -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 800; color: #334155; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                  ${w("check",16,"#059669")}
                  <span>سجل الواجبات السابقة والمنتهية</span>
                </h3>
                <p style="font-size: 0.73rem; color: #64748b; margin: 0.15rem 0 0 0;">
                  أرشيف الواجبات المكتملة أو التي انتهى موعد تسليمها
                </p>
              </div>
              <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 0.2rem 0.55rem; border-radius: 0.4rem; border: 1px solid #cbd5e1;">
                ${I.length} واجب منتهي
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${I.length>0?I.map(u=>{let $=u.submission_status==="approved";return`
                  <div style="background: ${$?"#fbfdfc":"#fefefe"}; border: 1px solid ${$?"#bbf7d0":"#fecaca"}; border-radius: 0.6rem; padding: 0.55rem 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    
                    <!-- Homework Title & Date (Single Row) -->
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 170px;">
                      <span style="color: ${$?"#10b981":"#ef4444"}; display: flex; align-items: center;">
                        ${w($?"check":"close",15,$?"#10b981":"#ef4444")}
                      </span>
                      <span style="font-size: 0.85rem; font-weight: 800; color: #1e293b;">
                        ${m(u.title)}
                      </span>
                      ${u.due_date?`
                        <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 500;">
                          (${m(u.due_date)})
                        </span>
                      `:""}
                    </div>

                    <!-- Compact Status Badge: تم تسليمه / لم يتم تسليمه -->
                    <div style="display: flex; align-items: center; gap: 0.45rem;">
                      ${$?`
                        <span style="font-size: 0.75rem; font-weight: 800; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 0.2rem 0.55rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                          ${w("check",12,"#059669")}
                          <span>تم تسليمه</span>
                        </span>
                        ${u.submission_url?`
                          <a href="${m(u.submission_url)}" target="_blank" rel="noopener noreferrer"
                            style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.15rem 0.35rem;">
                            ${w("file",12,"#2563eb")}
                            <span>معاينة حلك</span>
                          </a>
                        `:""}
                      `:`
                        <span style="font-size: 0.75rem; font-weight: 800; color: #dc2626; background: #fef2f2; border: 1px solid #fca5a5; padding: 0.2rem 0.55rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                          ${w("close",12,"#dc2626")}
                          <span>لم يتم تسليمه</span>
                        </span>
                      `}
                    </div>

                  </div>
                `}).join(""):`
                <div style="text-align: center; padding: 1rem; color: #94a3b8; font-size: 0.8rem; background: #f8fafc; border-radius: 0.5rem; border: 1px dashed #e2e8f0;">
                  لا توجد واجبات سابقة مسجلة حتى الآن.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- ================= TAB 3: EXAMS (الامتحانات) ================= -->
        <div id="student-tab-content-exams" style="display: ${r==="exams"?"flex":"none"}; flex-direction: column; gap: 1rem;">
          
          <!-- Quiz KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">معدل درجاتك</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #1d4ed8; margin-top: 0.2rem;">
                ${m(t.quiz_average_percentage||"—")}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                متوسط أدائك في الكويزات
              </div>
            </div>

            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الكويزات المرصودة</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">
                ${m(t.total_quizzes||i.length)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                اختبار تم تصحيحه
              </div>
            </div>
          </div>

          <!-- Active Online Quizzes Section -->
          ${p.length>0?`
            <div style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 2px solid #3b82f6;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.65rem;">
                <div>
                  <h2 style="font-size: 1.05rem; font-weight: 800; color: #1e3a8a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                    ${w("edit",18,"#2563eb")}
                    <span>امتحانات تفاعلية أونلاين متاحة لك الآن</span>
                  </h2>
                  <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                    اختبر مستواك، الأسئلة تظهر سؤالاً بسؤال مع تايمر للوقت
                  </p>
                </div>
                <span class="badge badge-blue" style="font-weight: 800;">${p.length} امتحان متاح</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${p.map(u=>{let $={};try{$=typeof u.questions=="string"?JSON.parse(u.questions):u.questions||{}}catch{}let z=$.question_count||$.questions?.length||0,T=$.time_limit_minutes||20,H=Ie(),M=H.date,P=H.time,j=!0,C="";return $.available_date&&$.available_date!==M?$.available_date>M?(j=!1,C=`متاح بتاريخ ${$.available_date}`):(j=!1,C="انتهت فترة الامتحان"):$.start_time&&P<$.start_time?(j=!1,C=`يبدأ الساعة ${$.start_time}`):$.end_time&&P>$.end_time&&(j=!1,C="انتهى وقت الامتحان"),`
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.75rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                      <div>
                        <div style="font-weight: 900; font-size: 0.95rem; color: #0f172a;">${m(u.title)}</div>
                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                          <span>${m($.subject||"الفيزياء")}</span>
                          <span>•</span>
                          <span>${z} أسئلة</span>
                          <span>•</span>
                          <span>المدة: ${T} دقيقة</span>
                          ${$.start_time&&$.end_time?`<span>• (من ${$.start_time} إلى ${$.end_time})</span>`:""}
                        </div>
                      </div>

                      <div>
                        ${u.submission_status==="approved"?`
                          <span style="background: #ecfdf5; color: #059669; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${w("check",14,"#059669")}
                            <span>تم الحل والتصحيح بنجاح</span>
                          </span>
                        `:u.submission_status==="needs_grading"?`
                          <span style="background: #fffbeb; color: #d97706; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${w("clock",14,"#d97706")}
                            <span>تم التسليم (قيد تصحيح المقالي بالعين)</span>
                          </span>
                        `:j?`
                          <button 
                            type="button" 
                            class="btn btn-primary" 
                            style="font-weight: 800; font-size: 0.85rem; padding: 0.5rem 1.1rem; border-radius: 0.6rem; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 2px 8px rgba(37,99,235,0.25);"
                            onclick="window.startStudentOnlineExam('${m(u.id)}')"
                          >
                            <span>بدء الامتحان الآن</span>
                            <span>←</span>
                          </button>
                        `:`
                          <span style="background: #fef2f2; color: #b91c1c; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #fecaca; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${w("clock",14,"#b91c1c")}
                            <span>${m(C)}</span>
                          </span>
                        `}
                      </div>
                    </div>
                  `}).join("")}
              </div>
            </div>
          `:""}

          <!-- Quizzes List -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${w("chart",18,"var(--centrly-blue-700)")}
                <span>سجل درجات الكويزات الدورية</span>
              </h2>
              <span class="badge badge-blue" style="font-weight: 700;">${i.length} كويز</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${i.length>0?i.map(u=>{let $=u.percentage>=85?"#059669":u.percentage>=65?"#d97706":"#dc2626",z=u.percentage>=85?"#ecfdf5":u.percentage>=65?"#fffbeb":"#fef2f2";return`
                  <div style="padding: 1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                      <div>
                        <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">${m(u.title)}</div>
                        ${u.date?`<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;">تاريخ الكويز: ${m(u.date)}</div>`:""}
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: ${$}; background: ${z}; padding: 0.2rem 0.55rem; border-radius: 0.4rem;">
                          ${m(u.tier)}
                        </span>
                        <span style="font-size: 1.1rem; font-weight: 900; color: #1d4ed8; font-family: monospace; background: #eff6ff; padding: 0.25rem 0.65rem; border-radius: 0.4rem; border: 1px solid #bfdbfe;">
                          ${m(u.score)} / ${m(u.max_score)}
                        </span>
                      </div>
                    </div>

                    <!-- Visual Progress Bar -->
                    <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin-top: 0.25rem;">
                      <div style="width: ${Math.min(100,Math.max(0,u.percentage))}%; height: 100%; background: ${$}; border-radius: 9999px;"></div>
                    </div>

                    ${u.note?`
                      <div style="font-size: 0.8rem; background: #fff; padding: 0.4rem 0.65rem; border-radius: 0.4rem; border-right: 3px solid #1d4ed8; color: #334155; margin-top: 0.25rem;">
                        <b>ملاحظة المعلم:</b> ${m(u.note)}
                      </div>
                    `:""}
                  </div>
                `}).join(""):`
                <div style="text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  لم يتم رصد درجات كويزات حتى الآن. ستظهر نتائجك هنا فور تصحيح المعلم للكويز مباشرة.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- ================= TAB 4: VIDEOS (فيديوهات الشرح) ================= -->
        <div id="student-tab-content-videos" style="display: ${r==="videos"?"flex":"none"}; flex-direction: column; gap: 1rem;">
          
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h2 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                  ${w("video",18,"#7c3aed")}
                  <span>فيديوهات الشرح والمراجعة</span>
                </h2>
                <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  شروحات مسجلة وحلول التمارين مؤمنة بعلامة مائية لبياناتك الشخصية
                </p>
              </div>
              <span class="badge" style="background: #f5f3ff; color: #7c3aed; border: 1px solid #ede9fe; font-weight: 800;">
                ${c.length} فيديو متاح
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${c.length>0?c.map(u=>Le(u,o,l,x)).join(""):`
                <div style="text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  لا توجد فيديوهات شرح منشورة لمجموعتك حالياً.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- ================= TAB 5: ATTENDANCE HISTORY (الحضور والغياب) ================= -->
        <div id="student-tab-content-attendance" style="display: ${r==="attendance"?"flex":"none"}; flex-direction: column; gap: 1rem;">
          
          <!-- Attendance KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">نسبة التزامك</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">
                ${m(t.attendance_rate)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${m(t.attended_count)} حاضر / ${m(t.total_sessions)} حصة
              </div>
            </div>

            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">مرات الغياب</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: ${t.absent_count>1?"#ef4444":"#64748b"}; margin-top: 0.2rem;">
                ${m(t.absent_count)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${t.absent_count===0?"التزام ممتاز بالحضور":"تنبيه: احرص على عدم تفويت الحصص"}
              </div>
            </div>
          </div>

          <!-- Attendance Records -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${w("calendar",18,"var(--centrly-blue-700)")}
                <span>سجل حضور الحصص</span>
              </h2>
              <span class="badge badge-blue" style="font-weight: 700;">${n.length} حصة</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${n.length>0?n.map(u=>`
                <div style="padding: 0.85rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.4rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">
                      حصة رقم ${m(u.session_number)} • ${m(u.session_date)}
                    </div>
                    <span class="badge ${u.attended?"badge-success":"badge-danger"}">
                      ${u.attended?"حاضر":"غائب"}
                    </span>
                  </div>

                  ${u.comment?`
                    <div style="font-size: 0.8rem; background: #fff; padding: 0.4rem 0.65rem; border-radius: 0.4rem; border-right: 3px solid #1d4ed8; color: #0f172a; margin-top: 0.25rem;">
                      <span><b>ملاحظة المعلم:</b> ${m(u.comment)}</span>
                    </div>
                  `:""}
                </div>
              `).join(""):`
                <div style="text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  لا توجد حصص مسجلة حتى الآن.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- ================= TAB 6: STUDENT ATTENDANCE BARCODE PASS ================= -->
        <div id="student-tab-content-card" style="display: ${r==="card"?"flex":"none"}; flex-direction: column; gap: 0.85rem; align-items: center; width: 100%;">
          <div style="width: 100%; max-width: 420px;">
            ${ge(o)}
          </div>
        </div>

        <!-- Student Portal Security & Integrity Note -->
        <div style="text-align: center; padding: 1rem 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.6;">
          رابطك الشخصي لمتابعة دراستك • تتحدث البيانات والدرجات تلقائياً<br>
          بوابة الطالب الرسمية — ${m(g)}
        </div>

        <!-- Walkthrough Onboarding Tour Modal -->
        ${je()}

      </div>
    </div>
  `}typeof window<"u"&&(window.switchStudentPortalTab=function(e){try{typeof localStorage<"u"&&localStorage.setItem("centrly_portal_student_tab",e),typeof sessionStorage<"u"&&sessionStorage.setItem("centrly_portal_student_tab",e)}catch{}["dashboard","materials","exams","videos","attendance","card"].forEach(o=>{let s=document.getElementById("student-tab-content-"+o),t=document.getElementById("student-tab-btn-"+o);s&&(s.style.display=o===e?"flex":"none"),t&&(t.style.background=o===e?"#ffffff":"transparent",t.style.color=o===e?"#1e3a8a":"#64748b",t.style.boxShadow=o===e?"0 2px 6px rgba(0,0,0,0.08)":"none")})},window.scrollToHomework=function(e){window.switchStudentPortalTab&&window.switchStudentPortalTab("materials");let r=e?document.getElementById("hw-card-"+e):null;if(r)r.scrollIntoView({behavior:"smooth",block:"center"}),r.style.outline="2px solid #f59e0b",setTimeout(()=>{r.style.outline="none"},2500);else{let o=document.getElementById("student-tab-content-materials");o&&o.scrollIntoView({behavior:"smooth"})}},window.togglePdfHelper=function(){let e=document.getElementById("pdf-helper-content"),r=document.getElementById("pdf-helper-arrow");if(!e)return;e.style.display==="none"||!e.style.display?(e.style.display="block",r&&(r.style.transform="rotate(180deg)")):(e.style.display="none",r&&(r.style.transform="rotate(0deg)"))},window.startStudentOnlineExam=async function(e){if(window.__examOpening)return;window.__examOpening=!0;let o=(window.__portalMaterials||[]).find(d=>d.id===e);if(!o){window.__examOpening=!1;return}let s;try{let d=window.__portalToken||new URLSearchParams(location.search).get("token");s=await ze((p,l)=>O("/public/quizzes/"+p,{method:"POST",body:l}),d,e,(p,l)=>{if(window.__currentExam?.attempt!==s)return;let c=document.getElementById("examSaveStatus");c&&(c.textContent=p==="saved"?"إجاباتك محفوظة":p==="saving"?"جار حفظ إجاباتك…":p==="submitted"?"تم تسليم المحاولة":l||"تعذر الحفظ؛ حافظ على اتصال الإنترنت")})}catch(d){alert(d.message);return}finally{window.__examOpening=!1}if(s.submitted){alert(s.submitted.message||"هذا الامتحان مسلّم بالفعل");return}window.__currentExam?.attempt?.dispose(),window.__currentExam?.timerInterval&&clearInterval(window.__currentExam.timerInterval);let t=s.definition,n=t.questions;window.__currentExam={materialId:s.materialId,title:o.title,subject:t.subject||"",timeLimitMinutes:t.time_limit_minutes||20,questions:n,currentIndex:0,answers:s.answers,timeRemaining:s.remaining(),timerInterval:null,attempt:s};let i=document.getElementById("studentExamModalOverlay");i||(i=document.createElement("div"),i.id="studentExamModalOverlay",i.style.cssText=`
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 1rem; overflow-y: auto; font-family: 'Cairo', sans-serif;
      `,document.body.appendChild(i)),window.__currentExam.timerInterval&&clearInterval(window.__currentExam.timerInterval),window.__currentExam.timerInterval=setInterval(()=>{window.__currentExam.timeRemaining=window.__currentExam.attempt.remaining();let d=document.getElementById("examTimerCountdown");if(d){let p=Math.max(0,Math.floor(window.__currentExam.timeRemaining/60)),l=Math.max(0,window.__currentExam.timeRemaining%60);d.textContent=`${p.toString().padStart(2,"0")}:${l.toString().padStart(2,"0")}`,window.__currentExam.timeRemaining<120&&(d.style.color="#ef4444",d.style.fontWeight="900")}window.__currentExam.timeRemaining<=0&&(clearInterval(window.__currentExam.timerInterval),alert("انتهى وقت الامتحان المخصص! سيتم تسليم إجاباتك تلقائياً الآن."),window.submitStudentOnlineExam(!0))},1e3),window.renderStudentExamRunner()},window.renderStudentExamRunner=function(){let e=window.__currentExam,r=document.getElementById("studentExamModalOverlay");if(!e||!r)return;let o=e.questions[e.currentIndex],s=e.questions.length,t=o.type!=="essay",n=e.answers[o.id],i=Math.floor(e.timeRemaining/60),d=e.timeRemaining%60,p=`${i.toString().padStart(2,"0")}:${d.toString().padStart(2,"0")}`;r.innerHTML=`
      <div style="display:grid;gap:.75rem;width:100%;max-width:680px;margin:auto">
      ${e.submissionFailed?'<div dir="rtl" role="alert" style="background:#fff7ed;color:#9a3412;padding:1rem;border-radius:12px">لم يتأكد التسليم. إجاباتك باقية ومثبتة هنا.<button class="btn btn-primary" style="min-height:44px;margin:.5rem" onclick="window.submitStudentOnlineExam(true)">إعادة محاولة التسليم</button></div>':""}
      <div dir="rtl" style="background: #ffffff; border-radius: 16px; max-width: 680px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.3); overflow: hidden; border: 1px solid #e2e8f0; margin: auto; display: flex; flex-direction: column;">
        
        <!-- Header Strip -->
        <div style="background: #1e3a8a; color: #ffffff; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <div style="font-weight: 900; font-size: 1.1rem;">${m(e.title)}</div>
            <div style="font-size: 0.78rem; color: #93c5fd; margin-top: 0.15rem;">مادة ${m(e.subject)} • سؤال ${e.currentIndex+1} من ${s}</div>
          </div>

          <!-- Timer Clock Badge -->
          <div style="background: #0f172a; padding: 0.4rem 0.85rem; border-radius: 30px; display: flex; align-items: center; gap: 0.45rem; border: 1.5px solid #3b82f6;">
            <span style="font-size: 0.8rem; color: #94a3b8;">الوقت المتبقي:</span>
            <span id="examTimerCountdown" style="font-family: monospace; font-size: 1.15rem; font-weight: 900; color: #38bdf8;">
              ${p}
            </span>
          </div>
        </div>

        <p id="examSaveStatus" role="status" style="margin:.5rem 1.25rem;font-size:.8rem">إجاباتك تتحفظ أثناء الحل. حافظ على اتصال الإنترنت.</p>
        <!-- Question Body Card -->
        <div style="padding: 1.5rem; flex: 1;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem; gap: 0.5rem;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; line-height: 1.6;">
              <span style="color: #2563eb; font-weight: 900;">(${e.currentIndex+1})</span> 
              ${m(o.text||"")}
            </div>
            <span style="background: #eff6ff; color: #1e40af; font-size: 0.78rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
              [${o.points||1} درجات]
            </span>
          </div>

          ${o.image_url?`
            <div style="text-align: center; margin: 1rem 0;">
              <img src="${m(o.image_url)}" alt="صورة المسألة" style="max-height: 220px; max-width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.08);" />
            </div>
          `:""}

          <!-- MCQ Options or Essay Area -->
          ${t?`
            <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1.25rem;">
              ${["أ","ب","ج","د"].map((l,c)=>{let f=Number(n)===c,x=o.choices?.[c]||"";return`
                  <div 
                    onclick="window.selectExamChoice(${c})"
                    style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 10px; border: 2px solid ${f?"#2563eb":"#e2e8f0"}; background: ${f?"#eff6ff":"#ffffff"}; cursor: pointer; transition: all 0.15s ease;"
                  >
                    <span style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${f?"#2563eb":"#94a3b8"}; background: ${f?"#2563eb":"#fff"}; color: ${f?"#fff":"#64748b"}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.85rem;">
                      ${l}
                    </span>
                    <span style="font-weight: 700; font-size: 0.95rem; color: ${f?"#1e40af":"#1e293b"}; flex: 1;">
                      ${m(x)}
                    </span>
                  </div>
                `}).join("")}
            </div>
          `:`
            <div style="margin-top: 1rem;">
              <label style="font-weight: 800; font-size: 0.85rem; color: #1e293b; margin-bottom: 0.35rem; display: block;">
                اكتب إجابتك المقالية بالتفصيل هنا:
              </label>
              <textarea 
                rows="4" 
                class="form-input" 
                placeholder="اكتب خطوات الحل أو الإجابة النموذجية الخاصة بك..."
                style="width: 100%; font-size: 0.95rem; line-height: 1.6; border: 2px solid #cbd5e1; border-radius: 8px; padding: 0.75rem;"
                oninput="window.setExamEssayAnswer(this.value)"
              >${m(n||"")}</textarea>
            </div>
          `}

        </div>

        <!-- Question Navigation Dots Strip -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 0.75rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${e.questions.map((l,c)=>{let f=c===e.currentIndex,x=e.answers[l.id]!==void 0&&e.answers[l.id]!=="";return`
                <button 
                  type="button" 
                  onclick="window.goToExamQuestion(${c})"
                  style="width: 28px; height: 28px; border-radius: 6px; font-weight: 800; font-size: 0.78rem; border: 1.5px solid ${f?"#1e3a8a":x?"#10b981":"#cbd5e1"}; background: ${f?"#1e3a8a":x?"#dcfce7":"#ffffff"}; color: ${f?"#ffffff":x?"#15803d":"#64748b"}; cursor: pointer;"
                >
                  ${c+1}
                </button>
              `}).join("")}
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button 
              type="button" 
              class="btn btn-secondary" 
              style="padding: 0.45rem 0.85rem; font-size: 0.85rem; font-weight: 700;"
              onclick="window.prevExamQuestion()"
              ${e.currentIndex===0?'disabled style="opacity: 0.5;"':""}
            >
              السابق
            </button>

            ${e.currentIndex<s-1?`
              <button 
                type="button" 
                class="btn btn-primary" 
                style="padding: 0.45rem 1rem; font-size: 0.85rem; font-weight: 800;"
                onclick="window.nextExamQuestion()"
              >
                التالي
              </button>
            `:`
              <button 
                type="button" 
                class="btn" 
                style="background: #059669; color: #fff; border: none; padding: 0.45rem 1.25rem; font-size: 0.88rem; font-weight: 900; border-radius: 8px; cursor: pointer; box-shadow: 0 2px 8px rgba(5,150,105,0.3);"
                onclick="window.submitStudentOnlineExam(false)"
              >
                تسليم الامتحان
              </button>
            `}
          </div>

        </div>

      </div></div>
    `,e.submissionFailed&&(r.querySelectorAll("textarea").forEach(l=>l.readOnly=!0),r.querySelectorAll("[onclick*=selectExamChoice]").forEach(l=>l.style.pointerEvents="none"))},window.selectExamChoice=function(e){let r=window.__currentExam;if(!r)return;let o=r.questions[r.currentIndex];r.attempt.setAnswer(o.id,e)&&window.renderStudentExamRunner()},window.setExamEssayAnswer=function(e){let r=window.__currentExam;if(!r)return;let o=r.questions[r.currentIndex];r.attempt.setAnswer(o.id,e)},window.nextExamQuestion=function(){let e=window.__currentExam;!e||e.currentIndex>=e.questions.length-1||(e.currentIndex++,window.renderStudentExamRunner())},window.prevExamQuestion=function(){let e=window.__currentExam;!e||e.currentIndex<=0||(e.currentIndex--,window.renderStudentExamRunner())},window.goToExamQuestion=function(e){let r=window.__currentExam;!r||e<0||e>=r.questions.length||(r.currentIndex=e,window.renderStudentExamRunner())},window.submitStudentOnlineExam=async function(e){let r=window.__currentExam;if(!r||r.submitting)return;if(!e){let s=Object.keys(r.answers).filter(n=>r.answers[n]!==void 0&&r.answers[n]!=="").length,t=r.questions.length;if(s<t){if(!confirm(`لقد قمت بالإجابة على (${s}) من أصل (${t}) أسئلة. هل أنت متأكد من رغبتك في تسليم الامتحان الآن؟`))return}else if(!confirm("هل أنت متأكد من تسليم إجاباتك وإنهاء الامتحان؟"))return}r.submitting=!0,r.timerInterval&&clearInterval(r.timerInterval);let o=window.__portalToken||(typeof location<"u"?new URLSearchParams(location.search).get("token"):"");try{let s=await r.attempt.submit(),t=document.getElementById("studentExamModalOverlay");s?.success?t&&(t.innerHTML=`
            <div dir="rtl" style="background: #ffffff; border-radius: 16px; max-width: 480px; width: 100%; padding: 2rem; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border: 1px solid #e2e8f0; margin: auto;">
              <div style="display: flex; justify-content: center; margin-bottom: 0.75rem; color: #059669;">
                <div style="background: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                  ${w("check",36,"#059669")}
                </div>
              </div>
              <h2 style="font-size: 1.3rem; font-weight: 900; color: #1e3a8a; margin: 0 0 0.5rem 0;">
                ${s.is_graded?"تم تصحيح امتحانك بنجاح!":"تم تسليم الامتحان بنجاح!"}
              </h2>
              <p style="font-size: 0.9rem; color: #475569; line-height: 1.6; margin-bottom: 1.25rem;">
                ${m(s.message||"أحسنت صنعاً")}
              </p>
              ${s.is_graded?`
                <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem;">
                  <span style="font-size: 0.85rem; font-weight: 800; color: #166534; display: block;">درجتك المحققة</span>
                  <span style="font-size: 2rem; font-weight: 900; color: #166534;">${s.score} / ${s.max_score}</span>
                </div>
              `:""}
              <button 
                type="button" 
                class="btn btn-primary" 
                style="font-weight: 800; padding: 0.6rem 1.8rem; border-radius: 8px;"
                onclick="window.location.reload()"
              >
                العودة لبوابة المتابعة
              </button>
            </div>
          `):alert(s?.error?.message||"حدث خطأ أثناء تسليم الامتحان")}catch(s){r.submissionFailed=!0,window.renderStudentExamRunner(),alert(s?.message||"تعذر إرسال الإجابات، يرجى التحقق من اتصال الإنترنت")}finally{r.submitting=!1}});function Me(e){let r=e.getAppEl();r&&window.renderPortalOpening(r)}function ie(e,r,o){let s=e.getAppEl();if(!s)return;let t=s.querySelector("#portalCacheStatus");t||(t=document.createElement("div"),t.id="portalCacheStatus",t.setAttribute("role","status"),t.className="portal-sync",t.style.cssText="justify-content:flex-end;padding:8px 20px",t.innerHTML='<span aria-live="polite"></span><button type="button" aria-label="تحديث بياناتك"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 19.6 10M4.4 14A8 8 0 0 0 17.9 17.9"/></svg></button>',t.querySelector("button").addEventListener("click",async i=>{i.currentTarget.disabled=!0;try{await e.reloadStudentPortal()}finally{t.isConnected&&(t.querySelector("button").disabled=!1)}}),s.prepend(t));let n=new Date(r).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});t.querySelector("button").title="تحديث بياناتك • البيانات المحفوظة "+n,t.querySelector("span").textContent=o?"تعذر التحديث؛ بياناتك المحفوظة متاحة":""}function Ze(e="",r=""){let o=r,s="parent";if(typeof window<"u"){s=localStorage.getItem("centrly_portal_entry_role")==="student"?"student":"parent";let i=new URLSearchParams(window.location.search);o||(o=i.get("phone")||i.get("user")||i.get("identifier")||"");let d=i.get("role");d==="parent"?s="parent":(d==="student"||window.__teacherSubdomain)&&(s="student")}let t=s==="student",n=e?`<div id="portalLoginAlert" style="padding: 0.75rem 1rem; border-radius: 0.65rem; margin-bottom: 1.25rem; font-size: 0.85rem; font-weight: 600; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; display: flex; align-items: center; gap: 0.5rem;">
        ${w("alert",18,"#b91c1c")}
        <span>${m(e)}</span>
       </div>`:'<div id="portalLoginAlert" style="display: none; padding: 0.75rem 1rem; border-radius: 0.65rem; margin-bottom: 1.25rem; font-size: 0.85rem; font-weight: 600; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;"></div>';return`
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; padding: 1.5rem; font-family: 'Cairo', system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="max-width: 440px; width: 100%; background: #ffffff; border-radius: 1.25rem; padding: 2.25rem 2rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; position: relative;">
        
        <!-- Back Link -->
        <div style="margin-bottom: 1.25rem; text-align: right;">
          <button type="button" onclick="window.centrlyApp && window.centrlyApp.renderLanding ? window.centrlyApp.renderLanding() : (window.location.href='/')" 
            style="background: none; border: none; color: #1d4ed8; cursor: pointer; font-size: 0.825rem; font-weight: 700; font-family: inherit; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.5rem; border-radius: 6px;" 
            onmouseover="this.style.backgroundColor='#eff6ff'" 
            onmouseout="this.style.backgroundColor='transparent'">
            <span>← العودة للصفحة الرئيسية</span>
          </button>
        </div>

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="margin: 0 auto 0.75rem; width: 56px; height: 56px; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); border-radius: 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25); color: #fff; font-size: 1.5rem; font-weight: 900;">
            سـ
          </div>
          <h1 id="portalHeadingText" style="font-size: 1.35rem; font-weight: 800; margin: 0 0 0.35rem 0; color: #0f172a;">
            ${typeof window<"u"&&window.__teacherSubdomain==="mr-omar"?"منصة مستر عمر المحمدي — بوابة الطالب":t?"بوابة الطالب":"بوابة ولي الأمر"}
          </h1>
          <p id="portalSubheadingText" style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.5;">
            ${t?"سجّل دخولك لتحميل المذكرات، تسليم الواجبات، ومتابعة درجاتك":"سجّل دخولك لمتابعة الحضور والغياب، الدرجات، والواجبات"}
          </p>
        </div>

        <!-- Account Type Switcher Tabs -->
        <div style="display: flex; background: #f1f5f9; padding: 4px; border-radius: 0.75rem; margin-bottom: 1.5rem; gap: 4px; border: 1px solid #e2e8f0;">
          <button 
            type="button" 
            id="portalTabParent" 
            onclick="window.switchPortalLoginRole ? window.switchPortalLoginRole('parent') : (window.centrlyApp && window.centrlyApp.switchPortalLoginRole ? window.centrlyApp.switchPortalLoginRole('parent') : null)"
            style="flex: 1; padding: 0.65rem 0.5rem; border: none; border-radius: 0.55rem; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; background: ${t?"transparent":"#ffffff"}; color: ${t?"#64748b":"#1e3a8a"}; box-shadow: ${t?"none":"0 2px 6px rgba(0,0,0,0.08)"};"
          >
            <span>ولي أمر</span>
          </button>
          <button 
            type="button" 
            id="portalTabStudent" 
            onclick="window.switchPortalLoginRole ? window.switchPortalLoginRole('student') : (window.centrlyApp && window.centrlyApp.switchPortalLoginRole ? window.centrlyApp.switchPortalLoginRole('student') : null)"
            style="flex: 1; padding: 0.65rem 0.5rem; border: none; border-radius: 0.55rem; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; background: ${t?"#ffffff":"transparent"}; color: ${t?"#1d4ed8":"#64748b"}; box-shadow: ${t?"0 2px 6px rgba(0,0,0,0.08)":"none"};"
          >
            <span>طالب</span>
          </button>
        </div>

        ${n}

        <!-- Login Form -->
        <form id="portalLoginForm" onsubmit="window.centrlyApp && window.centrlyApp.handlePortalLogin ? window.centrlyApp.handlePortalLogin(event) : event.preventDefault()">
          
          <input type="hidden" id="portalRole" name="role" value="${t?"student":"parent"}">

          <div style="margin-bottom: 1.15rem;">
            <label id="portalIdentifierLabel" for="portalIdentifier" style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem;">
              ${t?"رقم هاتف الطالب أو كود الطالب":"رقم هاتف ولي الأمر أو كود الطالب"}
            </label>
            <div style="position: relative;">
              <input 
                type="text" 
                id="portalIdentifier" 
                name="identifier"
                class="form-input" 
                value="${m(o)}"
                placeholder="010xxxxxxxx أو كود الطالب" 
                required 
                dir="ltr" 
                autocapitalize="none" 
                autocorrect="off" 
                spellcheck="false" 
                autocomplete="username"
                style="width: 100%; box-sizing: border-box; padding: 0.75rem 0.9rem; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; font-size: 0.95rem; font-family: inherit; outline: none; transition: border-color 0.2s;"
                onfocus="this.style.borderColor='#2563eb'"
                onblur="this.style.borderColor='#cbd5e1'"
              >
            </div>
            <span id="portalIdentifierHelp" style="display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 0.3rem;">
              ${t?"اكتب رقم هاتفك المسجل لدى المعلم أو كودك الشخصي":"اكتب رقم هاتف ولي الأمر أو كود الطالب"}
            </span>
          </div>

          <div style="margin-bottom: 1.15rem;">
            <label for="portalPassword" style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem;">
              كلمة المرور
            </label>
            <div style="position: relative; display: flex; align-items: center;">
              <input 
                type="password" 
                id="portalPassword" 
                name="password"
                class="form-input" 
                placeholder="••••••" 
                required 
                dir="ltr" 
                style="width: 100%; display: block; box-sizing: border-box; padding-top: 0.75rem; padding-bottom: 0.75rem; padding-right: 0.9rem; padding-left: 2.85rem !important; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; font-size: 0.95rem; font-family: inherit; letter-spacing: 2px; outline: none; transition: border-color 0.2s;"
                onfocus="this.style.borderColor='#2563eb'"
                onblur="this.style.borderColor='#cbd5e1'"
                autocapitalize="none" 
                autocorrect="off" 
                spellcheck="false" 
                autocomplete="current-password"
              >
              <button 
                type="button" 
                class="password-toggle-btn"
                onclick="window.centrlyApp ? (window.centrlyApp.togglePasswordVisibility ? window.centrlyApp.togglePasswordVisibility('portalPassword', this, event) : window.centrlyApp.togglePortalPasswordVisibility(this, event)) : null" 
                onmousedown="event.preventDefault()"
                title="إظهار/إخفاء كلمة المرور" 
                aria-label="إظهار/إخفاء كلمة المرور"
                style="position: absolute !important; left: 8px !important; top: 0 !important; bottom: 0 !important; margin: auto 0 !important; width: 32px !important; height: 32px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; z-index: 10 !important; transform: none !important; padding: 0 !important;"
              >
                ${w("eye",18)}
              </button>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
            <label style="display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; font-size: 0.825rem; color: #475569; font-weight: 600; user-select: none;">
              <input type="checkbox" id="portalRememberMe" checked style="width: 16px; height: 16px; accent-color: #2563eb; cursor: pointer;">
              <span>تذكر بيانات الدخول على هذا الجهاز</span>
            </label>
          </div>

          <button 
            type="submit" 
            id="portalSubmitBtn" 
            onclick="window.centrlyApp && window.centrlyApp.handlePortalLogin ? window.centrlyApp.handlePortalLogin(event) : null"
            style="width: 100%; padding: 0.85rem; border: none; border-radius: 0.75rem; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; font-size: 0.95rem; font-weight: 800; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); transition: opacity 0.2s;"
            onmouseover="this.style.opacity='0.95'"
            onmouseout="this.style.opacity='1'"
          >
            <span id="portalSubmitBtnText">${t?"دخول بوابة الطالب":"دخول بوابة ولي الأمر"}</span>
            <span id="portalSubmitSpinner" class="centrly-spinner" style="display: none; width: 14px; height: 14px; border-width: 2px; border-color: rgba(255,255,255,0.4); border-top-color: #fff;"></span>
          </button>
        </form>

        <!-- Informational Callout -->
        <div style="margin-top: 1.5rem; background: #f1f5f9; border-radius: 0.75rem; padding: 0.9rem; border: 1px dashed #cbd5e1; font-size: 0.775rem; color: #475569; line-height: 1.6;">
          <div style="display: flex; align-items: flex-start; gap: 0.4rem; margin-bottom: 0.35rem;">
            ${w("info",16,"#2563eb")}
            <span style="font-weight: 700; color: #1e293b;">أين تجد كلمة المرور؟</span>
          </div>
          <div>
            تم إرسال كلمة المرور المكونة من 6 أرقام مع رابط البوابة في رسالة الواتساب الترحيبية. في حال فقدانها، يمكنك مراجعة المعلم أو إدارة السنتر لتزويدك بها.
          </div>
        </div>

        <div style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin-top: 1.5rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
          منظومة سنترلي التعليمية | Centrly Platform
        </div>
      </div>
    </div>
  `}function De(e){Ee(e),e.loadStudentPortal=async function(o,s={}){window.__centrlyLoaded=!0,this._studentPortalToken=o;try{typeof localStorage<"u"&&o&&(localStorage.setItem("centrly_portal_token",o),localStorage.setItem("centrly_portal_role","student")),typeof sessionStorage<"u"&&o&&(sessionStorage.setItem("centrly_portal_token",o),sessionStorage.setItem("centrly_portal_role","student")),window.history&&window.history.replaceState&&(window.location.pathname!=="/portal"||window.location.search||window.location.hash)&&window.history.replaceState(null,"",window.location.pathname==="/portal-entry"?"/portal-entry":"/portal")}catch{}let t=n=>{Array.isArray(n.materials)||(n.materials=[]),Array.isArray(n.quizzes)||(n.quizzes=[]),n.materials.filter(d=>d.type==="online_quiz").forEach(d=>{let p={};try{p=typeof d.questions=="string"?JSON.parse(d.questions):d.questions||{}}catch{}let l=Array.isArray(p.questions)?p.questions:[],c=Number(p.quiz_number)||1,f=l.reduce((a,y)=>a+Number(y.points||1),0)||10;n.quizzes.some(a=>a.id===d.id||Number(a.quiz_number)===c)||n.quizzes.push({id:d.id,title:d.title||`كويز ${c}`,quiz_number:c,max_score:f,quiz_date:p.available_date||d.created_date||"",questions:l})});let i=this.getAppEl();if(i){let d=typeof localStorage<"u"&&localStorage.getItem("centrly_portal_student_tab")||typeof sessionStorage<"u"&&sessionStorage.getItem("centrly_portal_student_tab")||"dashboard";i.innerHTML=be(n,d);let p=n&&n.student&&(n.student.id||n.student.student_code||n.student.code||n.student.student_phone)?String(n.student.id||n.student.student_code||n.student.code||n.student.student_phone).trim():"";if(typeof window<"u"&&p){if(window._centrlyCurrentStudentId=p,n&&n.student){window._centrlyCurrentStudent=n.student;try{localStorage.setItem("centrly_current_student",JSON.stringify({id:n.student.id,student_code:n.student.student_code||n.student.code||p,name:n.student.name,student_phone:n.student.student_phone||n.student.phone}))}catch{}}try{localStorage.setItem("centrly_portal_last_id",p)}catch{}}setTimeout(()=>{typeof window<"u"&&window.openStudentPortalTour&&window.openStudentPortalTour(!1,p)},500)}};try{let n=await E.read(o,"student");if(n?(t(n.data),ie(this,n.savedAt,!1)):Me(this),(!n?.fresh||s.force||window.__centrlyPortalArrival)&&await re(this,o,"student",R))return;let i=await E.load(o,{request:R,force:s.force===!0,onData:(d,p)=>{(!p.cached||!n)&&t(d),ie(this,p.savedAt,!1)}});return ie(this,i.savedAt,!!i.error),!i.error}catch(n){if(n?.code==="PORTAL_CACHE_INVALIDATED")return!1;if(n?.code==="PORTAL_SESSION_CHANGED")return Me(this),window.location.reload(),!1;let i=n?.message||"";if((n?.status===401||n?.status===403||i.includes("غير صالح")||i.includes("منتهي")||i.includes("UNAUTHORIZED"))&&!i.includes("Failed to fetch")&&!i.includes("NetworkError")&&!i.includes("Failed to execute")){E.clear("student");try{localStorage.removeItem("centrly_portal_token"),localStorage.removeItem("centrly_portal_role"),sessionStorage.removeItem("centrly_portal_token"),sessionStorage.removeItem("centrly_portal_role")}catch{}this.renderPortalLogin("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً");return}let p=await E.read(o,"student");if(p)return t(p.data),ie(this,p.savedAt,!0),!1;let l=this.getAppEl();l&&(l.innerHTML=be({error:i||"تعذر تحميل بيانات بوابة الطالب. يرجى التحقق من صحة الرابط."}))}},e.reloadStudentPortal=async function(){this._studentPortalToken?await this.loadStudentPortal(this._studentPortalToken,{force:!0})&&this.showToast("تم تحديث بيانات الطالب بنجاح!","success"):window.location.reload()},e.renderPortalLogin=function(o=""){window.__centrlyLoaded=!0,this.currentRoute="portal";let s=this.getAppEl();if(s){let t=this._portalPresentation||le(),i=!(new URLSearchParams(window.location.search).get("role")==="student")&&(this._parentPortalToken||localStorage.getItem("centrly_portal_entry_role")==="parent");s.innerHTML=i?de(o,t):Ze(o)}window.history?.replaceState&&(window.location.pathname!=="/portal"||window.location.search||window.location.hash)&&window.history.replaceState(null,"",window.location.search?`/portal${window.location.search}`:"/portal")},e.switchPortalLoginRole=function(o){let s=o==="student",t=document.getElementById("portalTabParent"),n=document.getElementById("portalTabStudent"),i=document.getElementById("portalHeadingText"),d=document.getElementById("portalSubheadingText"),p=document.getElementById("portalRole"),l=document.getElementById("portalIdentifierLabel"),c=document.getElementById("portalIdentifierHelp"),f=document.getElementById("portalSubmitBtnText");if(p&&(p.value=s?"student":"parent"),t&&n&&(s?(n.style.background="#ffffff",n.style.color="#1d4ed8",n.style.boxShadow="0 2px 6px rgba(0,0,0,0.08)",t.style.background="transparent",t.style.color="#64748b",t.style.boxShadow="none"):(t.style.background="#ffffff",t.style.color="#1e3a8a",t.style.boxShadow="0 2px 6px rgba(0,0,0,0.08)",n.style.background="transparent",n.style.color="#64748b",n.style.boxShadow="none")),i&&(i.textContent=s?"بوابة الطالب":"بوابة ولي الأمر"),d&&(d.textContent=s?"سجّل دخولك لتحميل المذكرات، تسليم الواجبات، ومتابعة درجاتك":"سجّل دخولك لمتابعة الحضور والغياب، الدرجات، والواجبات"),l&&(l.textContent=s?"رقم هاتف الطالب أو كود الطالب":"رقم هاتف ولي الأمر أو كود الطالب"),c&&(c.textContent=s?"اكتب رقم هاتفك المسجل لدى المعلم أو كودك الشخصي":"اكتب رقم هاتف ولي الأمر أو كود الطالب"),f&&(f.textContent=s?"دخول بوابة الطالب":"دخول بوابة ولي الأمر"),window.history?.replaceState){let x=new URL(window.location.href);x.searchParams.set("role",s?"student":"parent"),window.history.replaceState(null,"",x.pathname+x.search)}},e.togglePortalPasswordVisibility=function(o,s){this.togglePasswordVisibility("portalPassword",o,s)},e.handlePortalLogin=async function(o){o&&o.preventDefault&&o.preventDefault();let s=document.getElementById("portalIdentifier"),t=document.getElementById("portalPassword"),n=document.getElementById("portalRememberMe"),i=document.getElementById("portalSubmitBtn"),d=document.getElementById("portalSubmitSpinner"),p=document.getElementById("portalLoginAlert"),l=document.getElementById("portalRole");try{let c=s?oe(s.value).trim():"",f=t?oe(t.value).trim():"",x=l?l.value:"parent",a=n?n.checked:!0;if(!c||!f){p&&(p.hidden=!1,p.style.display="block",p.textContent="يرجى كتابة رقم الهاتف أو كود الطالب وكلمة المرور");return}i&&(i.disabled=!0),d&&(d.style.display="inline"),p&&(p.style.display="none");let y=await R("/public/portal/login",{method:"POST",body:{identifier:c,password:f,role:x}});if(y&&y.success&&y.token){fe();let g=x==="student"||x==="parent"?x:y.role||"parent";try{localStorage.removeItem("centrly_explicit_logout"),(localStorage.getItem("centrly_portal_token")!==y.token||localStorage.getItem("centrly_portal_role")!==g)&&(E.clear("student"),E.clear("parent")),localStorage.setItem("centrly_portal_token",y.token),localStorage.setItem("centrly_portal_role",g),sessionStorage.setItem("centrly_portal_token",y.token),sessionStorage.setItem("centrly_portal_role",g)}catch{}this.showToast("مرحباً بك! تم تسجيل الدخول بنجاح","success");try{window.history&&window.history.replaceState&&window.history.replaceState(null,"","/portal")}catch{}g==="student"?await this.loadStudentPortal(y.token):await this.loadParentPortal(y.token)}else throw new Error(y?.error?.message||"تعذر تسجيل الدخول. يرجى التأكد من البيانات.")}catch(c){console.error("Portal login error:",c);let f=c?.message||"تعذر تسجيل الدخول. يرجى التأكد من البيانات.";p?(p.hidden=!1,p.style.display="block",p.textContent=f):this.renderPortalLogin(f)}finally{i&&(i.disabled=!1),d&&(d.style.display="none")}},e.handlePortalLogout=function(){fe();let o=localStorage.getItem("centrly_portal_role");o==="parent"&&W(this._portalPresentation),localStorage.setItem("centrly_portal_entry_role",o||"parent"),E.clear("student"),E.clear("parent");try{localStorage.removeItem("centrly_portal_token"),localStorage.removeItem("centrly_portal_role"),sessionStorage.removeItem("centrly_portal_token"),sessionStorage.removeItem("centrly_portal_role"),sessionStorage.removeItem("centrly_student_portal_token")}catch{}this._parentPortalToken=null,this._parentPortalRenderedToken=null,this._studentPortalToken=null,this.showToast("تم تسجيل الخروج بنجاح","info"),this.renderPortalLogin()},e.downloadStudentCardPng=function(o){he(o)},e.openFullscreenBarcode=function(o){ye(o)},e.compressImageFile=async function(o,s=1600,t=.72){return new Promise(n=>{if(!(o&&o.type&&o.type.startsWith("image/")||o&&o.name&&/\.(jpg|jpeg|png|webp|bmp|heic)$/i.test(o.name))){n(null);return}let d=new FileReader;d.onerror=()=>n(null),d.onload=p=>{let l=new Image;l.onerror=()=>n(null),l.onload=()=>{try{let{width:c,height:f}=l;(c>s||f>s)&&(c>f?(f=Math.round(f*s/c),c=s):(c=Math.round(c*s/f),f=s));let x=document.createElement("canvas");x.width=c,x.height=f;let a=x.getContext("2d");if(!a){n(null);return}a.drawImage(l,0,0,c,f);let y=x.toDataURL("image/jpeg",t),g=Math.round(y.length*3/4);g>800*1024&&(y=x.toDataURL("image/jpeg",.55),g=Math.round(y.length*3/4)),n({data:y,size:g,name:(o.name||"homework").replace(/\.[^/.]+$/,"")+".jpg"})}catch{n(null)}},l.src=p.target.result},d.readAsDataURL(o)})},e.handleStudentHomeworkUpload=async function(o,s){if(!s)return;let t=document.getElementById(`hw-file-input-${o}`),n=()=>{t&&(t.value="")},i=s.type&&s.type.includes("pdf")||s.name&&s.name.toLowerCase().endsWith(".pdf"),d=s.type&&s.type.startsWith("image/")||s.name&&/\.(jpg|jpeg|png|webp|heic|bmp)$/i.test(s.name);if(!i&&!d){n(),this.showToast("يرجى رفع ملف الواجب بصيغة PDF أو صورة واضحة (JPG / PNG / WEBP).","warning");return}if(s.size>25*1024*1024){n(),this.showToast("حجم الملف يتجاوز الحد الأقصى المسموح به (25 ميجابايت). يرجى ضغط الملف أو تقليل دقة الصور.","warning");return}let p=this._studentPortalToken||this._parentPortalToken||(typeof localStorage<"u"?localStorage.getItem("centrly_portal_token"):null)||(typeof sessionStorage<"u"?sessionStorage.getItem("centrly_portal_token"):null)||new URLSearchParams(window.location.search).get("token")||(typeof sessionStorage<"u"?sessionStorage.getItem("centrly_student_portal_token"):null)||"";if(!p){n(),this.showToast("تعذر التحقق من رمز الطالب أو ولي الأمر. يرجى إعادة فتح الرابط والمحاولة مرة أخرى.","danger");return}let l=document.getElementById(`hw-upload-btn-${o}`),c=l?l.innerHTML:"";l&&(l.disabled=!0,l.innerHTML="<span>جارٍ معالجة الملف...</span>");try{let f=null,x=s.name,a=s.size;if(d){l&&(l.innerHTML="<span>جارٍ تجهيز وضغط الصورة للرفع السريع...</span>");let g=await this.compressImageFile(s,1280,.68);g&&g.data&&(f=g.data,x=g.name,a=g.size)}f||(l&&(l.innerHTML="<span>جارٍ قراءة الملف...</span>"),f=await new Promise((g,b)=>{let h=new FileReader;h.onload=v=>g(v.target.result),h.onerror=()=>b(new Error("تعذر قراءة الملف من جهازك")),h.readAsDataURL(s)})),l&&(l.innerHTML="<span>جارٍ بدء الرفع (0%)...</span>"),await new Promise((g,b)=>{let h=new XMLHttpRequest;h.open("POST",`${N}/public/homework/submit`),h.setRequestHeader("Content-Type","application/json");let v=(a/(1024*1024)).toFixed(1);h.upload.onprogress=_=>{if(_.lengthComputable&&l){let A=Math.min(99,Math.round(_.loaded/_.total*100)),S=(_.loaded/(1024*1024)).toFixed(1);l.innerHTML=`<span>جارٍ الرفع (${A}% • ${S}/${v} ميجا)...</span>`}},h.upload.onload=()=>{l&&(l.innerHTML="<span>تم الرفع 100%! جارٍ حفظ وتأكيد الواجب في السحابة...</span>")},h.onload=()=>{l&&(l.innerHTML="<span>جارٍ معالجة وحفظ الواجب في السحابة...</span>");let _={};try{_=JSON.parse(h.responseText)}catch{}if(h.status>=200&&h.status<300)g(_);else{let A=_?.error?.message||`فشل حفظ الواجب (${h.status})`;b(new Error(A))}},h.onerror=()=>b(new Error("انقطع الاتصال بالإنترنت أثناء الرفع. يرجى التأكد من استقرار الشبكة والمحاولة مجدداً")),h.ontimeout=()=>b(new Error(`استغرق رفع الملف (${v} ميجا) وقتاً طويلاً بسبب بطء سرعة الرفع لديك. يرجى الاتصال بشبكة أسرع أو تقليل حجم الملف والمحاولة مرة أخرى`));let k=Math.min(9e5,Math.max(36e4,Math.round(a/(25*1024)*1e3)+12e4));h.timeout=k,h.send(JSON.stringify({token:p,material_id:o,file_data:f,file_name:x,file_size:a}))}),this.showToast("تم رفع حل الواجب بنجاح وإرساله لمعلمك للمراجعة.","success"),n(),((typeof localStorage<"u"?localStorage.getItem("centrly_portal_role"):null)||(this._parentPortalToken?"parent":"student"))==="parent"&&this.loadParentPortal?await this.loadParentPortal(p):await this.loadStudentPortal(p)}catch(f){console.error("Homework upload error:",f),this.showToast(`فشل رفع الواجب: ${f.message||"حدث خطأ في الاتصال"}`,"danger"),n(),l&&(l.disabled=!1,l.innerHTML=c)}}}async function Sn(){let e={getAppEl:()=>document.getElementById("app"),renderLanding:()=>location.assign("/"),showToast(n){document.getElementById("student-portal-toast")?.remove();let i=document.createElement("div");i.id="student-portal-toast",i.setAttribute("role","status"),i.textContent=n,i.style.cssText="position:fixed;bottom:20px;inset-inline:20px;margin:auto;max-width:440px;padding:12px 16px;background:#172d70;color:#fff;border-radius:12px;z-index:10000;text-align:center",document.body.append(i),setTimeout(()=>i.remove(),4e3)},togglePasswordVisibility(n,i,d){d?.preventDefault();let p=document.getElementById(n);if(!p)return;let l=p.type==="password";p.type=l?"text":"password",i?.setAttribute("aria-pressed",String(l)),i?.setAttribute("aria-label",l?"إخفاء كلمة المرور":"إظهار كلمة المرور")}};De(e),window.centrlyApp=e,window.switchPortalLoginRole=n=>e.switchPortalLoginRole(n),window.togglePasswordVisibility=(...n)=>e.togglePasswordVisibility(...n);let r=new URLSearchParams(location.search),o=window.__centrlyPortalArrival,s=localStorage.getItem("centrly_portal_role")||sessionStorage.getItem("centrly_portal_role");if((r.get("role")==="student"||r.get("portal")==="student"||o?.role==="student"||s==="student")&&localStorage.setItem("centrly_portal_entry_role","student"),o?.role==="student"&&o.origin===location.origin)return await e.loadStudentPortal(o.token),e;let t=r.get("token")||s==="student"&&(localStorage.getItem("centrly_portal_token")||sessionStorage.getItem("centrly_portal_token"));return r.has("token")&&r.get("portal")!=="student"&&r.get("role")!=="student"?await e.loadParentPortal(t):t?await e.loadStudentPortal(t):e.renderPortalLogin(),e}export{Sn as mountStudentPortal};
