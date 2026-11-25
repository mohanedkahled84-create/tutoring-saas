import{renderBasicStudentPortal as Ze}from"/src/components/BasicStudentPortalView.js?v=9.96.0";var R=typeof window<"u"&&window.location.hostname||"",Ne=R==="localhost"||R==="127.0.0.1"||R.startsWith("192.168.")||R.startsWith("10.")||/^172\.(1[6-9]|2\d|3[01])\./.test(R)||R.endsWith(".local"),D=typeof window<"u"&&window.__CENTRLY_API_URL__||(Ne?R&&R!=="localhost"&&R!=="127.0.0.1"?`http://${R}:3000/api`:"http://localhost:3000/api":"https://tutoring-backend-production-c8dd.up.railway.app/api"),V=null;function fe(t,r=30){if(!t)return!0;try{let i=t.split(".");if(i.length!==3)return!1;let n=i[1].replace(/-/g,"+").replace(/_/g,"/"),e=decodeURIComponent(atob(n).split("").map(c=>"%"+("00"+c.charCodeAt(0).toString(16)).slice(-2)).join("")),o=JSON.parse(e);return o.exp?Date.now()>=o.exp*1e3-r*1e3:!1}catch{return!1}}async function K(t=!1){try{let r=typeof localStorage<"u"?localStorage.getItem("centrly_token"):null;if(!t&&r&&!fe(r,60)){let e=typeof localStorage<"u"?localStorage.getItem("centrly_refresh_token"):null,o=typeof localStorage<"u"?localStorage.getItem("centrly_user"):null,c=null;try{c=o?JSON.parse(o):null}catch{}return{token:r,refresh_token:e,user:c}}let i=typeof localStorage<"u"&&localStorage.getItem("centrly_refresh_token")||typeof sessionStorage<"u"&&sessionStorage.getItem("centrly_refresh_token");if(!i)return null;let s=await fetch(`${D}/auth/refresh`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({refresh_token:i})}),n=await s.json().catch(()=>({}));if(s.ok&&n.token){try{if(typeof localStorage<"u"&&(localStorage.setItem("centrly_token",n.token),n.refresh_token&&localStorage.setItem("centrly_refresh_token",n.refresh_token),localStorage.setItem("centrly_logged_in","1"),n.user)){let e=localStorage.getItem("centrly_user"),o=e?JSON.parse(e):{};localStorage.setItem("centrly_user",JSON.stringify({...o,...n.user}))}if(typeof sessionStorage<"u"&&(sessionStorage.setItem("centrly_token",n.token),n.refresh_token&&sessionStorage.setItem("centrly_refresh_token",n.refresh_token),sessionStorage.setItem("centrly_logged_in","1"),n.user)){let e=sessionStorage.getItem("centrly_user"),o=e?JSON.parse(e):{};sessionStorage.setItem("centrly_user",JSON.stringify({...o,...n.user}))}}catch{}return n}if(s.status===401){let e=String(n?.error?.message||n?.message||n?.error||"").toLowerCase();if(e.includes("invalid_refresh_token")||e.includes("already used")||e.includes("token not found")||e.includes("refresh token revoked"))try{typeof localStorage<"u"&&(localStorage.removeItem("centrly_token"),localStorage.removeItem("centrly_refresh_token")),typeof sessionStorage<"u"&&(sessionStorage.removeItem("centrly_token"),sessionStorage.removeItem("centrly_refresh_token"))}catch{}}return null}catch(r){return console.warn("Silent refresh network exception:",r),null}}async function ue(t=!1){return V&&!t||(V=(async()=>{try{return typeof navigator<"u"&&navigator.locks&&navigator.locks.request?await navigator.locks.request("centrly_auth_refresh_lock",{timeout:1e4},async()=>await K(t)).catch(r=>(console.warn("[performSilentRefresh] Web Lock fallback:",r),K(t))):await K(t)}finally{V=null}})()),V}async function H(t,r={}){if(typeof window<"u"&&window.__CENTRLY_DELEGATED_REQUEST__)return window.__CENTRLY_DELEGATED_REQUEST__(t,r);let i=r.body;i&&typeof i=="object"&&!(i instanceof FormData)&&!(i instanceof Blob)&&(i=JSON.stringify(i));let s={"Content-Type":"application/json",...r.headers};try{if(!(t.includes("/auth/login")||t.includes("/auth/signup")||t.includes("/auth/verify-email")||t.includes("/auth/forgot-password")||t.includes("/auth/reset-password")||t.startsWith("/public/"))){let e=typeof localStorage<"u"&&localStorage.getItem("centrly_token")||typeof sessionStorage<"u"&&sessionStorage.getItem("centrly_token");if((!e||fe(e,15))&&!r._retry){let o=await ue();o&&o.token&&(e=o.token)}e&&!s.Authorization&&!s.authorization&&(s.Authorization=`Bearer ${e}`)}}catch{}try{let n=await fetch(`${D}${t}`,{credentials:"include",...r,headers:s,body:i}),e=await n.json().catch(()=>({}));if(!n.ok&&(t.startsWith("/quizzes")||t.startsWith("/platform"))&&!r._fallbackAttempted)try{let o=await fetch("/api"+t,{credentials:"same-origin",...r,headers:s,body:i,_fallbackAttempted:!0});if(o.ok){let c=await o.json().catch(()=>null);if(c&&c.success)return c}}catch{}if(!n.ok){if(n.status===401&&!(t.includes("/auth/login")||t.includes("/auth/refresh")||t.includes("/auth/signup")||t.startsWith("/public/"))&&!r._retry){let l=await ue(!0);if(l&&l.token){let d={...s,Authorization:`Bearer ${l.token}`};return await H(t,{...r,headers:d,_retry:!0})}}let o=`Request failed with status ${n.status}`;typeof e.error=="string"?o=e.error:e.error&&typeof e.error=="object"?Array.isArray(e.error.details)&&e.error.details.length>0?o=e.error.details.map(m=>m.message||m.field||JSON.stringify(m)).join(" • "):e.error.message&&(o=e.error.message):e.message&&(o=e.message),n.status===401&&(o.includes("token")||o.includes("UNAUTHORIZED")||o.includes("status 401"))&&(o="انتهت صلاحية الجلسة لأسباب أمنية. يرجى تسجيل الدخول مجدداً.");let c=new Error(o);throw e.error&&typeof e.error=="object"&&(e.error.code&&(c.code=e.error.code),e.error.email&&(c.email=e.error.email)),c.status=n.status,c.data=e,c}return e}catch(n){throw console.error(`API Error [${t}]:`,n),n}}import{registerParentPortalActions as Ye}from"/src/parentPortal.js?v=9.96.0";var ee="centrly_portal_snapshot_v2:";async function De(t,r){let i=await crypto.subtle.digest("SHA-256",new TextEncoder().encode(r+":"+t));return Array.from(new Uint8Array(i),s=>s.toString(16).padStart(2,"0")).join("")}function te(t,r){try{let i=atob(t.replace(/-/g,"+").replace(/_/g,"/")).split(":");return i.length===4&&/^\d+$/.test(i[2])&&Number(i[2])*1e3<=r}catch{return!1}}var Z=t=>JSON.parse(JSON.stringify(t));function ne(t,r){try{let i=atob(t.replace(/-/g,"+").replace(/_/g,"/")).split(":");if(i.length===4&&/^\d+$/.test(i[2])&&/^[a-f0-9]{64}$/i.test(i[3]))return r?.student?.id===i[1]&&r.student.tenant_id===i[0]}catch{}return!0}function He({storage:t,clock:r=Date.now,hash:i=De}={}){try{for(let a of t?[t]:[globalThis.localStorage,globalThis.sessionStorage])for(let g of["student","parent"])a?.removeItem("centrly_portal_snapshot_v1:"+g)}catch{}let s=new Map,n=new Map,e=a=>n.get(a)||0,o=()=>Object.assign(new Error("تغيرت البيانات أثناء التحديث"),{code:"PORTAL_CACHE_INVALIDATED"}),c=()=>{if(t)return t;try{if(!globalThis.localStorage.getItem("centrly_portal_token")&&globalThis.sessionStorage?.getItem("centrly_portal_token"))return globalThis.sessionStorage}catch{}return globalThis.localStorage};function m(a,g){try{let v=c().getItem("centrly_portal_token"),b=c().getItem("centrly_portal_role");return c().getItem("centrly_explicit_logout")!=="1"&&v===a&&(!b||b===g)}catch{return!0}}function l(a="student"){n.set(a,e(a)+1);try{c().removeItem(ee+a)}catch{}}async function d(a,g="student"){let v=e(g);if(!a||!m(a,g)||te(a,r()))return null;try{let b=JSON.parse(c().getItem(ee+g)||"null");if(!b||b.version!==2||b.role!==g||!Number.isFinite(b.savedAt)||b.session!==await i(a,g))return null;let y=r()-b.savedAt;if(v!==e(g)||!m(a,g)||y<0||y>864e5||!b.data?.student?.id||!b.data.student.tenant_id||!ne(a,b.data))return null;let x=Z(b.data),k=g==="student"&&typeof x.features?.teaching_platform!="boolean"||x.announcements?.length>0||x.preferences?.show_student_rank===!0||x.preferences?.show_parent_rank===!0||x.preferences?.show_student_leaderboard===!0;if(delete x.leaderboard,delete x.announcements,x.summary)for(let _ of["student_rank","group_size","rank_period"])delete x.summary[_];if(x.preferences&&(x.preferences={...x.preferences,show_student_rank:!1,show_parent_rank:!1,show_student_leaderboard:!1}),y>1800*1e3)for(let _ of x.materials||[])String(_.submission_url||"").includes("/object/sign/")&&(_.submission_url=null);return{data:x,savedAt:b.savedAt,fresh:y<12e4&&!k}}catch{return null}}async function p(a,g,v="student",{savedAt:b=r(),generation:y=e(v)}={}){if(!(!g?.student?.id||!g.student.tenant_id||!ne(a,g)||!m(a,v)||te(a,r()))&&!(!Number.isFinite(b)||b>r()||r()-b>864e5))try{let x=Z(g);for(let A of x.materials||[])if(["online_quiz","paper_quiz","paper_exam"].includes(A.type)){let S=A.questions;try{typeof S=="string"&&(S=JSON.parse(S))}catch{S={}}let T={};for(let u of["id","subject","quiz_number","legacy_quiz_ref","exam_mode","available_date","available_time","available_until","start_time","end_time","duration_minutes","time_limit_minutes","is_draft","is_archived","status","question_count","max_score"])S?.[u]!==void 0&&(T[u]=S[u]);T.questions=[],A.questions=T}let k={version:2,role:v,session:await i(a,v),savedAt:b,data:x};if(y!==e(v)||!m(a,v))return;let _=JSON.stringify(k);_.length<=15e5&&c().setItem(ee+v,_)}catch{}}async function h(a,{role:g="student",request:v,onData:b=()=>{},force:y=!1}={}){let x=e(g);if(!m(a,g))throw Object.assign(new Error("تغير الحساب، افتح الصفحة مجددًا"),{code:"PORTAL_SESSION_CHANGED"});if(te(a,r()))throw l(g),Object.assign(new Error("انتهت صلاحية الجلسة، سجّل الدخول مجددًا"),{status:401});let k=await d(a,g);if(x!==e(g))throw o();if(k&&b(Z(k.data),{cached:!0,savedAt:k.savedAt}),k?.fresh&&!y)return{data:k.data,cached:!0,savedAt:k.savedAt};let _;try{_=await i(a,g)}catch{_="memory-only:"+g+":"+a}_+=":"+x;let A=s.get(_);A||(A=(async()=>{let S=await v("/public/parent-portal?token="+encodeURIComponent(a));if(x!==e(g))throw o();if(!m(a,g))throw Object.assign(new Error("تغير الحساب، افتح الصفحة مجددًا"),{code:"PORTAL_SESSION_CHANGED"});if(!S?.student?.id||!ne(a,S))throw new Error("تعذر التحقق من بيانات الحساب");return await p(a,S,g,{generation:x}),S})(),s.set(_,A),A.finally(()=>{s.get(_)===A&&s.delete(_)}).catch(()=>{}));try{let S=await A;if(x!==e(g))throw o();if(!m(a,g))throw Object.assign(new Error("تغير الحساب، افتح الصفحة مجددًا"),{code:"PORTAL_SESSION_CHANGED"});return b(Z(S),{cached:!1,savedAt:r()}),{data:S,cached:!1,savedAt:r()}}catch(S){if(!m(a,g))throw Object.assign(new Error("تغير الحساب، افتح الصفحة مجددًا"),{code:"PORTAL_SESSION_CHANGED"});if(S.status===401||S.status===403)throw m(a,g)&&l(g),S;if(S.code==="PORTAL_SESSION_CHANGED"||S.code==="PORTAL_CACHE_INVALIDATED")throw S;if(k&&m(a,g))return{data:k.data,cached:!0,stale:!0,savedAt:k.savedAt,error:S};throw S}}return{read:d,write:p,load:h,clear:l}}var L=He();var Oe="https://tutoring-backend-production-c8dd.up.railway.app/api";async function W(t,r={}){let i=new AbortController,s=setTimeout(()=>i.abort(),3e4),n=r.body&&(t.startsWith("/public/family/")||["/public/portal/destination","/public/portal/handoff"].includes(t));try{let e=await fetch(Oe+t,{method:r.method||"GET",signal:i.signal,cache:"no-store",...r.body?{headers:{"Content-Type":n?"application/x-www-form-urlencoded;charset=UTF-8":"application/json"},body:n?new URLSearchParams(r.body).toString():JSON.stringify(r.body)}:{}}),o=await e.json();if(!e.ok){let c=new Error(o.error?.message||"تعذر تحميل البيانات، حاول مجددًا");throw c.status=e.status,c}return o}catch(e){throw e.name==="AbortError"?new Error("الاتصال استغرق وقتًا طويلًا. تحقق من الإنترنت وحاول مجددًا."):e instanceof TypeError?new Error("تعذر الاتصال. تحقق من الإنترنت وحاول مجددًا."):e}finally{clearTimeout(s)}}function re(){let t=localStorage.getItem("centrly_family_token_v1");for(let r of[localStorage,sessionStorage])for(let i of["centrly_family_token_v1","centrly_family_snapshot_v1","centrly_family_selected_v1"])r.removeItem(i);t&&W("/public/family/logout",{method:"POST",body:{family_token:t}}).catch(()=>{})}function f(t){return t==null?"":String(t).replace(/[&<>"']/g,r=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"})[r])}var ge="centrly_parent_public_brand_v1";function he(){try{let t=JSON.parse(localStorage.getItem(ge));return t?.origin===location.origin?t.presentation:null}catch{return null}}function ye(t){try{localStorage.setItem("centrly_portal_entry_role","parent");let r=t?Object.fromEntries(["display_title","theme_preset","custom_primary_color","subdomain"].filter(i=>typeof t[i]=="string").map(i=>[i,t[i]])):null;localStorage.setItem(ge,JSON.stringify({origin:location.origin,presentation:r}))}catch{}}function be(t="",r=null,i=!1){let s={emerald:"#065f46",red:"#991b1b",purple:"#581c87"};return`<style>
  .parent-login{box-sizing:border-box;min-height:100dvh;background:#f6f8fb;padding:32px 16px max(24px,env(safe-area-inset-bottom));font-family:inherit;font-size:16px;line-height:1.8;color:#0f172a;direction:rtl;display:grid;align-content:center}.parent-login *{box-sizing:border-box}.parent-login-card{width:100%;max-width:440px;margin:auto;padding:28px 24px;border:1px solid #e2e8f0;border-top:4px solid ${/^#[0-9a-f]{6}$/i.test(r?.custom_primary_color||"")?r.custom_primary_color:s[r?.theme_preset]||"#0f172a"};border-radius:24px;background:#fff;box-shadow:0 12px 40px #0f172a05}.parent-login h1{font-size:25px;line-height:1.5;margin:8px 0}.parent-login p{color:#475569;margin:8px 0 24px;font-size:15px}.parent-login label{display:block;margin:20px 0 8px;font-weight:700}.parent-login input{font:inherit;font-size:16px;min-height:52px;padding:12px 14px;width:100%;border:1px solid #cbd5e1;border-radius:14px;min-width:0;color:#0f172a;background:#fff}.parent-login button{font:inherit;min-height:48px;border:1px solid #cbd5e1;background:#fff;border-radius:12px;padding:10px;cursor:pointer;touch-action:manipulation}.parent-login input:focus-visible,.parent-login button:focus-visible{outline:3px solid #2563eb;outline-offset:3px}.parent-login-password{display:flex;gap:8px}.parent-login-password input{flex:1;width:0}.parent-login #portalSubmitBtn{width:100%;margin-top:24px;background:#0f172a;color:#fff;border-color:#0f172a;font-weight:700}.parent-login button:disabled{opacity:.6;cursor:wait}.parent-login-alert{padding:12px;border-radius:12px;background:#fff7ed;color:#9a3412;font-size:15px}.parent-login-alert[hidden]{display:none}.parent-login small{display:block;color:#475569;font-size:13px;line-height:1.8}.parent-login footer{text-align:center;margin-top:24px;font-size:13px;color:#475569}.parent-login h1,.parent-login small{overflow-wrap:anywhere}
  </style><main class="parent-login"><section class="parent-login-card" aria-labelledby="parent-login-title"><small>بوابة ولي الأمر</small><h1 id="parent-login-title"><span id="parent-login-brand">${f(r?.display_title||"سنترلي")}</span></h1><p>اطمّن على الحضور والدرجات وتسليم الواجبات.</p>
  <div id="portalLoginAlert" class="parent-login-alert" role="alert" tabindex="-1" ${t?"":"hidden"}>${f(t)}</div>
  <form id="portalLoginForm" onsubmit="window.centrlyApp.handlePortalLogin(event)"><input type="hidden" id="portalRole" name="role" value="parent"><label for="portalIdentifier">${i?"رقم تليفون ولي الأمر":"رقم ولي الأمر أو كود الطالب"}</label><input id="portalIdentifier" name="identifier" type="text" inputmode="${i?"tel":"numeric"}" autocomplete="username" dir="ltr" maxlength="48" required><label for="portalPassword">${i?"كلمة مرور الأسرة":"كلمة المرور"}</label><div class="parent-login-password"><input id="portalPassword" name="password" type="password" inputmode="numeric" autocomplete="current-password" dir="ltr" maxlength="72" required><button type="button" aria-label="إظهار أو إخفاء كلمة المرور" aria-controls="portalPassword" aria-pressed="false" onclick="window.centrlyApp.toggleParentPassword ? window.centrlyApp.toggleParentPassword(this) : window.centrlyApp.togglePortalPasswordVisibility(this,event)">إظهار</button></div><button id="portalSubmitBtn" type="submit">${i?"دخول حساب الأسرة":"دخول المتابعة"}</button></form><p style="margin:20px 0 0"><small>${i?"استخدم كلمة مرور الأسرة المرسلة لرقمك. أبناؤك المسجلون على نفس الرقم يظهرون تلقائيًا. لإعادة إرسالها، تواصل مع المعلم.":"استخدم كلمة المرور المرسلة مع رابط المتابعة. لو فقدتها، تواصل مع المعلم."}</small></p><button type="button" style="width:100%" onclick="window.centrlyApp.setParentFamilyMode(${i?"false":"true"})">${i?"عندي بيانات متابعة طالب واحد":"عندي حساب للأسرة"}</button><footer>متابعة ولي الأمر · بواسطة سنترلي</footer></section></main>`}async function we(t,r,i,s=()=>{}){let n=await t("start",{token:r,material_id:i});if(n.submitted)return{submitted:n.result,definition:n.definition,answers:n.answers||{},materialId:n.material_id};if(!n.attempt_id||!n.definition?.questions?.length||!Number.isFinite(Date.parse(n.expires_at))||!Number.isFinite(Date.parse(n.server_now)))throw new Error("تعذر بدء الامتحان؛ حدّث الصفحة وحاول مجددًا");let e=()=>globalThis.performance.now(),o=e()+Math.max(0,Date.parse(n.expires_at)-Date.parse(n.server_now)),c=n.revision,m=!1,l=null,d=null,p=null,h=!1,a=!1,g=0,v={...n.answers},b={id:n.attempt_id,materialId:n.material_id,definition:{...n.definition,questions:n.definition.questions.map((y,x)=>({...y,id:String(y.id??x)}))},answers:v,remaining:()=>Math.max(0,Math.ceil((o-e())/1e3)),setAnswer(y,x){return h||a||b.remaining()<=0?!1:(v[y]=x,m=!0,s("saving"),clearTimeout(p),p=setTimeout(()=>{b.flush().catch(()=>{})},700),!0)},flush(){return h?Promise.reject(new Error("انتهت جلسة الامتحان")):d||(clearTimeout(p),d=(async()=>{for(;(m||l)&&b.remaining()>0;){l||(l={token:r,attempt_id:b.id,answers:JSON.parse(JSON.stringify(v)),revision:c},m=!1);try{let y=await t("save",l);if(y.submitted){b.submitted=y.result,l=null,m=!1,a=!0,s("submitted");return}c=y.revision,l=null,g=0,s(m?"saving":"saved")}catch(y){throw s("error",y.message),!h&&!a&&(!y.status||y.status>=500)&&(clearTimeout(p),p=setTimeout(()=>{b.flush().catch(()=>{})},Math.min(3e4,2e3*2**g++))),y}}})().finally(()=>{d=null}),d)},async submit(y={}){if(a=!0,clearTimeout(p),await b.flush(),b.submitted)return b.submitted;let x=await t("submit",{token:r,material_id:b.materialId,answers:{...v},...y});if(x.success!==!0)throw new Error("تعذر تأكيد التسليم؛ حاول مجددًا");return b.submitted=x,b.dispose(),x},dispose(){h=!0,a=!0,clearTimeout(p)}};return b}function xe(t={},r="student",{showRank:i=!0,showContact:s=!1,showWelcome:n=!0}={}){let e=t.preferences||{},o=t.summary||{},c=[];n&&e.welcome_message&&c.push(`<section style="white-space:pre-wrap;line-height:1.8;padding:18px">${f(e.welcome_message)}</section>`);let m=(l,d)=>`<section style="border:1px solid var(--centrly-line,#e2e8f0);border-radius:16px;background:var(--centrly-surface,#fff);padding:18px;color:var(--centrly-ink,#0f172a);min-width:0;overflow-wrap:anywhere"><h3 style="font-size:1rem;margin:0 0 .6rem">${l}</h3>${d}</section>`;if(i&&(r==="parent"?e.show_parent_rank===!0:e.show_student_rank!==!1)&&Object.hasOwn(o,"student_rank")&&c.push(m(r==="parent"?"ترتيب ابنك في المجموعة":"ترتيبك في المجموعة",`<p style="margin:0">${Number.isInteger(o.student_rank)&&o.student_rank>0?`المركز ${Number(o.student_rank)} من ${Number(o.group_size)} طالبًا`:"يظهر الترتيب بعد رصد الحضور والدرجات"} · هذا الشهر</p>`)),r==="student"&&e.show_student_leaderboard===!0&&Array.isArray(t.leaderboard?.entries)&&t.leaderboard.entries.length&&c.push(m("أوائل المجموعة هذا الشهر",`<ol style="list-style:none;padding:0;margin:0;display:grid;gap:.6rem">${t.leaderboard.entries.map(l=>`<li style="display:flex;gap:.75rem;align-items:center"><strong style="min-width:32px">${Number(l.position)}</strong><span>${f(l.name)}</span></li>`).join("")}</ol>`)),e.show_upcoming_sessions!==!1&&t.upcoming_sessions?.length&&c.push(m("الحصص القادمة",t.upcoming_sessions.map(l=>`<p style="margin:.5rem 0">${f(l.group_name)} · ${f(l.session_date)} ${l.start_time?"· "+f(String(l.start_time).slice(0,5)):""}</p>`).join(""))),e.show_announcements!==!1&&t.announcements?.length&&c.push(m("تنبيهات المعلم",t.announcements.map(l=>`<article style="margin:.75rem 0"><strong>${f(l.title)}</strong><p style="white-space:pre-wrap;margin:.25rem 0;line-height:1.8">${f(l.body)}</p></article>`).join(""))),s&&e.show_teacher_contact!==!1){let l=String(t.teacher_phone||t.student?.teacher_phone||"").replace(/\D/g,"");/^01\d{9}$/.test(l)&&(l="2"+l),/^\d{10,15}$/.test(l)&&c.push(m("التواصل مع المعلم",`<a href="https://wa.me/${l}" target="_blank" rel="noopener noreferrer" style="display:inline-flex;align-items:center;min-height:44px">تواصل عبر واتساب</a>`))}return c.length?`<div data-portal-home-summary style="display:grid;gap:14px;margin:16px 0">${c.join("")}</div>`:""}function ve(t=new Date){let r=Object.fromEntries(new Intl.DateTimeFormat("en-GB",{timeZone:"Africa/Cairo",year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(t).filter(i=>i.type!=="literal").map(i=>[i.type,i.value]));return{date:`${r.year}-${r.month}-${r.day}`,time:`${r.hour}:${r.minute}`}}function w(t,r=18,i="currentColor",s=""){let n=r,e=i,o=s?`class="${s}"`:"";return{sessions:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/></svg>`,calendar:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>`,dashboard:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><rect x="3" y="3" width="7" height="9"/><rect x="14" y="3" width="7" height="5"/><rect x="14" y="12" width="7" height="9"/><rect x="3" y="16" width="7" height="5"/></svg>`,center:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M3 21h18"/><path d="M5 21V7l8-4 8 4v14"/><path d="M9 10h2"/><path d="M9 14h2"/><path d="M9 18h2"/><path d="M15 10h2"/><path d="M15 14h2"/><path d="M15 18h2"/></svg>`,groups:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>`,students:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,cards:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><rect x="2" y="4" width="20" height="16" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/><line x1="6" y1="15" x2="10" y2="15"/></svg>`,reports:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,risk:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,whatsapp:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>`,billing:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>`,activity:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>`,assistants:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 11l-3 3-1.5-1.5"/></svg>`,teachers:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`,homework:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>`,book:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>`,file:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>`,add:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,edit:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>`,delete:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>`,print:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,printer:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></svg>`,download:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,search:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>`,check:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="20 6 9 17 4 12"/></svg>`,close:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>`,refresh:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="23 4 23 10 17 10"/><polyline points="1 20 1 14 7 14"/><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/></svg>`,send:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>`,clock:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>`,note:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>`,menu:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></svg>`,camera:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>`,barcode:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M3 5v14M6 5v14M9 5v14M12 5v14M15 5v14M18 5v14M21 5v14"/></svg>`,info:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>`,gear:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>`,eye:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="13" r="3"/></svg>`,eyeOff:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>`,lock:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>`,unlock:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/></svg>`,materials:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/><line x1="9" y1="7" x2="16" y2="7"/><line x1="9" y1="11" x2="14" y2="11"/></svg>`,video:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polygon points="23 7 16 12 23 17 23 7"/><rect x="1" y="5" width="15" height="14" rx="2" ry="2"/></svg>`,link:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>`,upload:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>`,plus:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>`,copy:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>`,lightbulb:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><line x1="9" y1="18" x2="15" y2="18"/><line x1="10" y1="22" x2="14" y2="22"/><path d="M15.09 14c.18-.98.65-1.74 1.41-2.5A4.65 4.65 0 0 0 18 8 6 6 0 0 0 6 8c0 1 .23 2.23 1.5 3.5A4.61 4.61 0 0 1 8.91 14"/></svg>`,gradCap:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M22 10v6M2 10l10-5 10 5-10 5z"/><path d="M6 12v5c0 2 3 3 6 3s6-1 6-3v-5"/></svg>`,alertTriangle:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>`,inbox:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="22 12 16 12 14 15 10 15 8 12 2 12"/><path d="M5.45 5.11L2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"/></svg>`,chart:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>`,sun:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>`,moon:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>`,chevronDown:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="6 9 12 15 18 9"/></svg>`,chevronUp:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="18 15 12 9 6 15"/></svg>`,crown:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><path d="M2 4l3 12h14l3-12-6 7-4-7-4 7-6-7zm3 16h14v2H5v-2z"/></svg>`,globe:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>`,archive:`<svg width="${n}" height="${n}" viewBox="0 0 24 24" fill="none" stroke="${e}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${o}><polyline points="21 8 21 21 3 21 3 8"/><rect x="1" y="3" width="22" height="5"/><line x1="10" y1="12" x2="14" y2="12"/></svg>`,dotSuccess:'<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#10b981"/></svg>',dotWarning:'<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#f59e0b"/></svg>',dotDanger:'<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#ef4444"/></svg>',dotNeutral:'<svg width="8" height="8" viewBox="0 0 8 8"><circle cx="4" cy="4" r="4" fill="#64748b"/></svg>'}[t]||""}var Fe=["212222","222122","222221","121223","121322","131222","122213","122312","132212","221213","221312","231212","112232","122132","122231","113222","123122","123221","223211","221132","221231","213212","223112","312131","311222","321122","321221","312212","322112","322211","212123","212321","232121","111323","131123","131321","112313","132113","132311","211313","231113","231311","112133","112331","132131","113123","113321","133121","313121","211331","231131","213113","213311","213131","311123","311321","331121","312113","312311","332111","314111","221411","431111","111224","111422","121124","121421","141122","141221","112214","112412","122114","122411","142112","142211","241211","221114","413111","241112","134111","111242","121142","121241","114212","124112","124211","411212","421112","421211","212141","214121","412121","111143","111341","131141","114113","114311","411113","411311","113141","114131","311141","411131","211412","211214","211232","2331112"];function _e(t){let r=String(t||"").trim();r||(r="0000");let i=[104],s=104;for(let e=0;e<r.length;e++){let o=r.charCodeAt(e)-32,c=o>=0&&o<=94?o:0;i.push(c),s+=c*(e+1)}i.push(s%103),i.push(106);let n="";for(let e of i)n+=Fe[e];return{codes:i,patternStr:n,cleanText:r}}function $e(t,r={}){let i=r.height||80,s=r.quietZone!==void 0?r.quietZone:10,n=r.unitWidth||2.5,{patternStr:e}=_e(t),o=[],c=s;for(let l=0;l<e.length;l++){let d=parseInt(e[l],10);l%2===0&&o.push('<rect x="'+(c*n).toFixed(1)+'" y="0" width="'+(d*n).toFixed(1)+'" height="'+i+'" fill="#000000"/>'),c+=d}c+=s;let m=(c*n).toFixed(1);return'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 '+m+" "+i+'" style="width: 100%; max-width: 100%; height: '+i+'px; display: block; shape-rendering: crispEdges;"><rect width="'+m+'" height="'+i+'" fill="#ffffff"/>'+o.join("")+"</svg>"}function ie(t){let r=String(t||"").trim();return!r||r==="معلم المادة"||r==="أستاذ المادة"?"معلم المادة":(r=r.replace(/\s*[-–—|]\s*(منظومة|منظر|سنترلي|أكاديمية|سنتر|منصه|منصة).*/i,"").replace(/\s*[-–—|]\s*.*منظومة.*/i,"").trim(),r||t||"معلم المادة")}function oe(t={},r={}){let i=t.student_code||t.code||"—",s=t.name||"طالب",n=(t.group_name||t.group||"").trim(),e=(t.subject_name||t.subject||"").trim();(e.includes("مجموع")||e===n)&&(e="");let o=t.teacher_name||r.teacherName||t.center_name||"معلم المادة",c=ie(o),m=$e(i,{height:50,unitWidth:2.2}),l=f(JSON.stringify(t));return`
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
          ${f(s)}
        </div>
      </div>

      <!-- Student Code Badge -->
      <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
        <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 0.35rem 1.25rem; display: inline-flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 0.82rem; font-weight: 700; color: #475569;">كود الطالب:</span>
          <span style="font-family: monospace; font-size: 1.4rem; font-weight: 900; color: #1e3a8a; letter-spacing: 1px;">${f(i)}</span>
        </div>
      </div>

      <!-- High-Contrast Clean Barcode Box -->
      <div style="background: #ffffff; border: 2px solid #0f172a; border-radius: 12px; padding: 0.85rem 0.6rem 0.65rem; margin-bottom: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden;">
        <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; margin-bottom: 0.45rem;">امسح الباركود لتسجيل الحضور</div>
        <div style="width: 100%; display: flex; justify-content: center; overflow: hidden;">
          ${m}
        </div>
      </div>

      <!-- Teacher & Group Info Strip -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.6rem 0.85rem; margin-bottom: 1rem; display: flex; justify-content: space-around; align-items: center; font-size: 0.8rem; color: #334155; flex-wrap: wrap; gap: 0.5rem; text-align: center;">
        <div>
          <span style="color: #64748b;">المدرّس:</span>
          <strong style="color: #0f172a; margin-right: 0.25rem;">${f(c)}</strong>
        </div>
        ${e?`
          <div>
            <span style="color: #64748b;">المادة:</span>
            <strong style="color: #0f172a; margin-right: 0.25rem;">${f(e)}</strong>
          </div>
        `:""}
        <div>
          <span style="color: #64748b;">المجموعة:</span>
          <strong style="color: #0f172a; margin-right: 0.25rem;">${f(n||"عامة")}</strong>
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
  `}function ae(t={},r={}){let i=t.student_code||t.code||"0000",s=t.name||"طالب",n=(t.group_name||t.group||"").trim(),e=(t.subject_name||t.subject||"").trim(),o=t.teacher_name||r.teacherName||t.center_name||"معلم المادة",c=ie(o),m="المجموعة",l=n||"المجموعة الدراسية";e&&n&&e!==n?l=`${n} • المادة: ${e}`:e&&!n&&(m="المادة",l=e);let d=document.createElement("canvas"),p=1200,h=757;d.width=p,d.height=h;let a=d.getContext("2d");if(!a)return;a.fillStyle="#172D70",a.fillRect(0,0,p,h),a.strokeStyle="#2949BA",a.lineWidth=8,a.roundRect?(a.beginPath(),a.roundRect(4,4,p-8,h-8,30),a.stroke()):a.strokeRect(4,4,p-8,h-8),a.fillStyle="#2949BA",a.fillRect(0,0,p,140),a.fillStyle="#E7A330",a.fillRect(0,140,p,8),a.direction="rtl",a.textAlign="right",a.font="bold 50px Cairo, Tahoma, sans-serif",a.fillStyle="#ffffff",a.fillText("سنتر",p-60,90);let g=a.measureText("سنتر").width;a.fillStyle="#E7A330",a.fillText("لـ",p-60-g+4,90);let v=a.measureText("لـ").width;a.fillStyle="#ffffff",a.fillText("ي",p-60-g-v+8,90),a.fillStyle="#E7A330",a.fillRect(p-60-80,106,80,5),a.direction="ltr",a.textAlign="left",a.fillStyle="#ffffff",a.font="bold 26px Cairo, Tahoma, sans-serif",a.fillText("بطاقة حضور الطالب",60,75),a.fillStyle="#E8EDFF",a.font="bold 15px monospace",a.fillText("STUDENT ID",60,105),a.direction="rtl",a.textAlign="right",a.fillStyle="#E8EDFF",a.font="bold 20px Cairo, Tahoma, sans-serif",a.fillText("اسم الطالب",p-60,195),a.fillStyle="#ffffff",a.font="bold 42px Cairo, Tahoma, sans-serif",a.fillText(s,p-60,248);let b=60,y=275,x=p-120,k=92;a.fillStyle="#1f3688",a.roundRect?(a.beginPath(),a.roundRect(b,y,x,k,12),a.fill(),a.strokeStyle="#2e4ebd",a.lineWidth=2,a.stroke()):a.fillRect(b,y,x,k),a.direction="rtl",a.textAlign="right",a.font="bold 21px Cairo, Tahoma, sans-serif",a.fillStyle="#E7A330",a.fillText("المدرّس: ",p-90,y+35);let _=a.measureText("المدرّس: ").width;a.fillStyle="#ffffff",a.fillText(c,p-90-_,y+35),a.fillStyle="#E7A330",a.fillText(`${m}: `,p-90,y+72);let A=a.measureText(`${m}: `).width;a.fillStyle="#ffffff",a.fillText(l,p-90-A,y+72);let S=60,T=385,u=p-120,$=265;a.fillStyle="#ffffff",a.roundRect?(a.beginPath(),a.roundRect(S,T,u,$,16),a.fill()):a.fillRect(S,T,u,$),a.direction="rtl",a.textAlign="center",a.fillStyle="#475569",a.font="bold 18px Cairo, Tahoma, sans-serif";let P=S+(u-250)/2;a.fillText("امسح الباركود لتسجيل الحضور",P,T+38);let{patternStr:C}=_e(i),N=150,M=T+55,E=20;for(let I=0;I<C.length;I++)E+=parseInt(C[I],10);let j=u-320,z=Math.min(8,Math.max(3.5,j/E)),U=E*z,F=S+40+(j-U)/2+10*z;a.fillStyle="#000000";let ce=F;for(let I=0;I<C.length;I++){let q=parseInt(C[I],10)*z;I%2===0&&a.fillRect(Math.round(ce),M,Math.round(q),N),ce+=q}let G=200,pe=$-30,J=S+u-G-15,Q=T+15;a.fillStyle="#E7A330",a.roundRect?(a.beginPath(),a.roundRect(J,Q,G,pe,12),a.fill()):a.fillRect(J,Q,G,pe),a.direction="rtl",a.textAlign="center",a.fillStyle="#0f172a",a.font="bold 20px Cairo, Tahoma, sans-serif",a.fillText("رقم الطالب",J+G/2,Q+55),a.direction="ltr",a.fillStyle="#020617",a.font="bold 44px Changa, monospace",a.fillText(i,J+G/2,Q+130),a.fillStyle="#122359",a.fillRect(0,h-52,p,52),a.direction="rtl",a.textAlign="center",a.fillStyle="#cbd5e1",a.font="bold 18px Cairo, Tahoma, sans-serif",a.fillText("مخصصة للحضور — استخدمها في بداية كل حصة",p/2,h-20);try{let I=d.toDataURL("image/png"),q=document.createElement("a");q.href=I;let me=s.replace(/[\s\/\\?%*:|"<>]/g,"_");q.download="كارت_حضور_"+me+"_"+i+".png",document.body.appendChild(q),q.click(),document.body.removeChild(q)}catch(I){console.error("Failed to export student card canvas:",I)}}function se(t={}){let r=t.student_code||t.code||"0000",i=t.name||"طالب",s=(t.group_name||t.group||"").trim(),n=(t.subject_name||t.subject||"").trim(),e=t.teacher_name||t.center_name||"معلم المادة",o=ie(e),c="المجموعة",m=s||"المجموعة الدراسية";n&&s&&n!==s?m=`${s} • المادة: ${n}`:n&&!s&&(c="المادة",m=n);let l="centrly-barcode-fullscreen-modal",d=document.getElementById(l);d&&d.remove();let p=$e(r,{height:110,unitWidth:3.2}),h=f(JSON.stringify(t)),a=document.createElement("div");a.id=l,a.style.cssText=`
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
          ${f(i)}
        </h3>

        <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #E8EDFF; margin-bottom: 1.25rem;">
          <div>المعلم: <b style="color: #E7A330;">${f(o)}</b></div>
          <div>${f(c)}: <b style="color: #E7A330;">${f(m)}</b></div>
        </div>

        <!-- High-Contrast Barcode White Panel -->
        <div style="
          background: #ffffff;
          border-radius: 1rem;
          padding: 1.5rem 1rem;
          margin-bottom: 1rem;
        ">
          <div style="width: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
            ${p}
          </div>
          <div style="font-family: 'Changa', monospace; font-size: 1.6rem; font-weight: 900; letter-spacing: 4px; color: #172D70; margin-top: 0.75rem; direction: ltr;">
            ${f(r)}
          </div>
        </div>

        <div style="font-size: 0.82rem; font-weight: 700; color: #4ade80; margin-bottom: 1.25rem;">
          ارفع سطوع شاشة الهاتف لتسهيل المسح الضوئي عند مدخل القاعة
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button onclick="window.centrlyBarcodeCard.downloadCardPng(${h})" style="
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
  `,document.body.appendChild(a)}typeof window<"u"&&(window.centrlyBarcodeCard={downloadCardPng:ae,openFullscreen:se,renderAttendancePass:oe});function Se(){return`
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
  `}function O(t,r,i,s,n="student"){if(!t||!r||!i)return;let e=window.innerHeight,o=window.innerWidth;try{t.scrollIntoView({behavior:"smooth",block:"center",inline:"center"})}catch{try{t.scrollIntoView(!0)}catch{}}setTimeout(()=>{let c=t.getBoundingClientRect(),m=Math.min(315,o-24);r.style.display="block",r.style.width=m+"px",r.style.transform="none";let l=r.offsetHeight||190,d=12,p=e-c.bottom,h=c.top,a=0,g=!0;p>=l+d+10?(a=c.bottom+d,g=!0):h>=l+d+10?(a=c.top-l-d,g=!1):p>=h?(a=e-l-12,g=!0):(a=12,g=!1);let v=10,b=Math.max(v,e-l-10);a=Math.max(v,Math.min(a,b));let y=c.left+c.width/2-m/2,x=10,k=Math.max(x,o-m-10);y=Math.max(x,Math.min(y,k)),r.style.top=a+"px",r.style.left=y+"px";let A=Math.max(16,Math.min(c.left+c.width/2,o-16))-y-9;A=Math.max(16,Math.min(A,m-34)),g?i.style.cssText=`
        position: absolute;
        top: -9px;
        left: ${A}px;
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-bottom: 9px solid ${s};
        display: block;
      `:i.style.cssText=`
        position: absolute;
        bottom: -9px;
        left: ${A}px;
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-top: 9px solid ${s};
        display: block;
      `},100)}function ke(t,r,i="#2563eb"){let s="";for(let n=0;n<t;n++){let e=n===r;s+=`<span style="display:inline-block; width:${e?"12px":"5px"}; height:5px; border-radius:9999px; background:${e?i:"#cbd5e1"}; transition:all 0.2s ease;"></span>`}return s}if(typeof window<"u"){let r=function(l){let d=[];l&&d.push(String(l).trim().toLowerCase()),typeof window<"u"&&window._centrlyCurrentStudentId&&d.push(String(window._centrlyCurrentStudentId).trim().toLowerCase()),typeof window<"u"&&window._centrlyCurrentParentId&&d.push(String(window._centrlyCurrentParentId).trim().toLowerCase());try{if(typeof localStorage<"u"){let p=localStorage.getItem("centrly_portal_last_id");p&&d.push(String(p).trim().toLowerCase())}}catch{}return Array.from(new Set(d.filter(Boolean)))},i=function(l){try{if(typeof localStorage>"u")return!1;if(localStorage.getItem("centrly_tour_v6_student_completed")==="true")return!0;for(let d of l)if(localStorage.getItem(`centrly_tour_seen_student_${d}`)==="true")return!0}catch{}return!1},s=function(l){try{if(typeof localStorage>"u")return;localStorage.setItem("centrly_tour_v6_student_completed","true");for(let d of l)localStorage.setItem(`centrly_tour_seen_student_${d}`,"true")}catch{}},e=function(l){let d=[];l&&d.push(String(l).trim().toLowerCase()),typeof window<"u"&&window._centrlyCurrentParentId&&d.push(String(window._centrlyCurrentParentId).trim().toLowerCase()),typeof window<"u"&&window._centrlyCurrentStudentId&&d.push(String(window._centrlyCurrentStudentId).trim().toLowerCase());try{if(typeof localStorage<"u"){let p=localStorage.getItem("centrly_portal_last_id");p&&d.push(String(p).trim().toLowerCase())}}catch{}return Array.from(new Set(d.filter(Boolean)))},o=function(l){try{if(typeof localStorage>"u")return!1;if(localStorage.getItem("centrly_tour_v6_parent_completed")==="true")return!0;for(let d of l)if(localStorage.getItem(`centrly_tour_seen_parent_${d}`)==="true")return!0}catch{}return!1},c=function(l){try{if(typeof localStorage>"u")return;localStorage.setItem("centrly_tour_v6_parent_completed","true");for(let d of l)localStorage.setItem(`centrly_tour_seen_parent_${d}`,"true")}catch{}};window._studentSpotlightIndex=0,window._studentActiveSpotlightEl=null;let t=[{tab:"materials",getTarget:()=>document.getElementById("student-tab-btn-materials"),badge:"الخطوة 1 من 5",getTitle:()=>"📁 زر المذكرات والواجبات",getDesc:()=>"ده الزرار الأساسي للمذكرات والواجب؛ اضغط عليه في أي وقت لفتح ملازم الحصص وملخصات الدروس والـ PDF وتحميلها على جهازك ومذاكرتها.",nextLabel:"التالي: زر رفع الواجب ←"},{tab:"materials",getTarget:()=>document.querySelector('[id^="hw-upload-btn-"]')||document.getElementById("student-active-homeworks-section")||document.getElementById("student-study-materials-section"),badge:"الخطوة 2 من 5",getTitle:()=>"📝 زر رفع حل الواجب",getDesc:()=>"بعد ما تحل الواجب المطلوب في كشكولك وتصوره بكاميرا الموبايل، اضغط على زرار رفع الواجب هنا لرفع صور أو PDF الحل للمعلم عشان يراجعه ويحطلك درجتك فوراً!",nextLabel:"التالي: زر درجات الامتحانات ←"},{tab:"quizzes",getTarget:()=>document.getElementById("student-tab-btn-quizzes"),badge:"الخطوة 3 من 5",getTitle:()=>"📊 زر درجات الكويزات والامتحانات",getDesc:()=>"اضغط على هذا الزر لمتابعة كشف درجاتك في كل كويز وامتحان شهري في السنتر، والنسبة المئوية، وملاحظات وتوجيهات المعلم لمستواك.",nextLabel:"التالي: زر الحضور والغياب ←"},{tab:"attendance",getTarget:()=>document.getElementById("student-tab-btn-attendance"),badge:"الخطوة 4 من 5",getTitle:()=>"📅 زر سجل الحضور والغياب",getDesc:()=>"اضغط على هذا الزر لمتابعة سجل كامل بكل الحصص التي حضرتها وتواريخها، ونسبة التزامك بالحصص وتنبيهات الغياب أولاً بأول.",nextLabel:"التالي: زر باركود السنتر ←"},{tab:"card",getTarget:()=>document.getElementById("student-tab-btn-card"),badge:"الخطوة 5 من 5",getTitle:()=>"🎫 زر باركود الحضور عند باب السنتر",getDesc:()=>"أول ما توصل باب السنتر، اضغط هنا لفتح كارتك وفيه الباركود الخاص بيك عشان المشرف يمسحه بالاسكانر في ثانية واحدة ويسجل حضورك تلقائياً!",nextLabel:"✨ فهمت تماماً، ابدأ الآن!"}];window.renderStudentSpotlightStep=function(l){if(l<0&&(l=0),l>=t.length){window.closeStudentPortalTour(!0);return}window._studentSpotlightIndex=l;let d=t[l];d.tab&&window.switchStudentPortalTab&&window.switchStudentPortalTab(d.tab),window._studentActiveSpotlightEl&&(window._studentActiveSpotlightEl.classList.remove("portal-spotlight-target"),window._studentActiveSpotlightEl=null),setTimeout(()=>{requestAnimationFrame(()=>{let p=d.getTarget(),h=document.getElementById("student-spotlight-backdrop"),a=document.getElementById("student-spotlight-popover"),g=document.getElementById("student-spotlight-arrow");if(!h||!a||!g)return;h.style.display="block",a.style.display="block";let v=typeof d.getTitle=="function"?d.getTitle():d.title,b=typeof d.getDesc=="function"?d.getDesc():d.desc;document.getElementById("student-spotlight-badge").textContent=d.badge;let y=document.getElementById("student-spotlight-dots");y&&(y.innerHTML=ke(t.length,l,"#2563eb")),document.getElementById("student-spotlight-title").innerHTML=v,document.getElementById("student-spotlight-desc").innerHTML=b;let x=document.getElementById("student-spotlight-prev-btn");x&&(x.style.display=l>0?"block":"none");let k=document.getElementById("student-spotlight-next-btn");k&&(k.innerHTML=`<span>${d.nextLabel}</span>`,l===t.length-1?(k.style.background="linear-gradient(135deg, #059669 0%, #10b981 100%)",k.style.boxShadow="0 4px 12px rgba(16, 185, 129, 0.3)"):(k.style.background="linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)",k.style.boxShadow="0 4px 10px rgba(37, 99, 235, 0.25)")),p?(p.classList.add("portal-spotlight-target"),window._studentActiveSpotlightEl=p,O(p,a,g,"#2563eb","student")):(a.style.top="50%",a.style.left="50%",a.style.transform="translate(-50%, -50%)",g.style.display="none")})},120)},window.openStudentPortalTour=function(l=!1,d=null){let p=r(d);!l&&i(p)||(s(p),window.renderStudentSpotlightStep(0))},window.nextStudentPortalTourStep=function(){window._studentSpotlightIndex<t.length-1?window.renderStudentSpotlightStep(window._studentSpotlightIndex+1):window.closeStudentPortalTour(!0)},window.prevStudentPortalTourStep=function(){window._studentSpotlightIndex>0&&window.renderStudentSpotlightStep(window._studentSpotlightIndex-1)},window.closeStudentPortalTour=function(l=!0){window._studentActiveSpotlightEl&&(window._studentActiveSpotlightEl.classList.remove("portal-spotlight-target"),window._studentActiveSpotlightEl=null);let d=document.getElementById("student-spotlight-backdrop"),p=document.getElementById("student-spotlight-popover");if(d&&(d.style.display="none"),p&&(p.style.display="none"),l){let h=r();s(h)}},window._parentSpotlightIndex=0,window._parentActiveSpotlightEl=null;let n=[{tab:"attendance",getTarget:()=>document.getElementById("tab-btn-attendance"),badge:"الخطوة 1 من 4",getTitle:()=>"📅 زر متابعة الحضور والغياب",getDesc:()=>"اضغط على هذا الزر لمتابعة حضور ابنكم اللحظي؛ فور مسح الباركود عند باب السنتر يتسجل حضوره هنا بالساعة والتاريخ أو تنبيه الغياب.",nextLabel:"التالي: زر درجات الامتحانات ←"},{tab:"quizzes",getTarget:()=>document.getElementById("tab-btn-quizzes"),badge:"الخطوة 2 من 4",getTitle:()=>"📊 زر درجات الكويزات والامتحانات",getDesc:()=>"اضغط على هذا الزر لمتابعة تقرير دوري بدرجات الطالب في كل كويز مع النسبة المئوية وملاحظات وتوجيهات المعلم لمتابعة مستواه الدراسي.",nextLabel:"التالي: زر متابعة الواجبات ←"},{tab:"homework",getTarget:()=>document.getElementById("tab-btn-homework"),badge:"الخطوة 3 من 4",getTitle:()=>"📝 زر متابعة الواجبات المنزلية",getDesc:()=>"اضغط على هذا الزر لمعرفة مدى التزام الطالب بتسليم الواجبات في مواعيدها المحددة مع قراءة ملاحظات وتصحيح المعلم على الحل.",nextLabel:"التالي: زر تحديث الصفحة ←"},{tab:"attendance",getTarget:()=>document.getElementById("parent-refresh-data-btn"),badge:"الخطوة 4 من 4",getTitle:()=>"🔄 زر تحديث البيانات اللحظي",getDesc:()=>"يمكنكم في أي لحظة الضغط على هذا الزر في الأعلى لتحديث وعرض أي بيانات وتقارير جديدة تلقائياً فوراً دون الحاجة لتسجيل الخروج.",nextLabel:"✨ فهمت تماماً، ابدأ الآن!"}];window.renderParentSpotlightStep=function(l){if(l<0&&(l=0),l>=n.length){window.closeParentPortalTour(!0);return}window._parentSpotlightIndex=l;let d=n[l];d.tab&&window.switchParentPortalTab&&window.switchParentPortalTab(d.tab),window._parentActiveSpotlightEl&&(window._parentActiveSpotlightEl.classList.remove("portal-spotlight-target-emerald"),window._parentActiveSpotlightEl=null),setTimeout(()=>{requestAnimationFrame(()=>{let p=d.getTarget(),h=document.getElementById("parent-spotlight-backdrop"),a=document.getElementById("parent-spotlight-popover"),g=document.getElementById("parent-spotlight-arrow");if(!h||!a||!g)return;h.style.display="block",a.style.display="block";let v=typeof d.getTitle=="function"?d.getTitle():d.title,b=typeof d.getDesc=="function"?d.getDesc():d.desc;document.getElementById("parent-spotlight-badge").textContent=d.badge;let y=document.getElementById("parent-spotlight-dots");y&&(y.innerHTML=ke(n.length,l,"#059669")),document.getElementById("parent-spotlight-title").innerHTML=v,document.getElementById("parent-spotlight-desc").innerHTML=b;let x=document.getElementById("parent-spotlight-prev-btn");x&&(x.style.display=l>0?"block":"none");let k=document.getElementById("parent-spotlight-next-btn");k&&(k.innerHTML=`<span>${d.nextLabel}</span>`,l===n.length-1?(k.style.background="linear-gradient(135deg, #059669 0%, #10b981 100%)",k.style.boxShadow="0 4px 12px rgba(16, 185, 129, 0.3)"):(k.style.background="linear-gradient(135deg, #059669 0%, #10b981 100%)",k.style.boxShadow="0 4px 10px rgba(16, 185, 129, 0.25)")),p?(p.classList.add("portal-spotlight-target-emerald"),window._parentActiveSpotlightEl=p,O(p,a,g,"#059669","parent")):(a.style.top="50%",a.style.left="50%",a.style.transform="translate(-50%, -50%)",g.style.display="none")})},120)},window.openParentPortalTour=function(l=!1,d=null){let p=e(d);!l&&o(p)||(c(p),window.renderParentSpotlightStep(0))},window.nextParentPortalTourStep=function(){window._parentSpotlightIndex<n.length-1?window.renderParentSpotlightStep(window._parentSpotlightIndex+1):window.closeParentPortalTour(!0)},window.prevParentPortalTourStep=function(){window._parentSpotlightIndex>0&&window.renderParentSpotlightStep(window._parentSpotlightIndex-1)},window.closeParentPortalTour=function(l=!0){window._parentActiveSpotlightEl&&(window._parentActiveSpotlightEl.classList.remove("portal-spotlight-target-emerald"),window._parentActiveSpotlightEl=null);let d=document.getElementById("parent-spotlight-backdrop"),p=document.getElementById("parent-spotlight-popover");if(d&&(d.style.display="none"),p&&(p.style.display="none"),l){let h=e();c(h)}},window.addEventListener("resize",()=>{if(window._studentActiveSpotlightEl&&document.getElementById("student-spotlight-popover")?.style.display==="block"){let l=document.getElementById("student-spotlight-popover"),d=document.getElementById("student-spotlight-arrow");O(window._studentActiveSpotlightEl,l,d,"#2563eb","student")}if(window._parentActiveSpotlightEl&&document.getElementById("parent-spotlight-popover")?.style.display==="block"){let l=document.getElementById("parent-spotlight-popover"),d=document.getElementById("parent-spotlight-arrow");O(window._parentActiveSpotlightEl,l,d,"#059669","parent")}});let m=null;window.addEventListener("scroll",()=>{m||(m=setTimeout(()=>{if(m=null,window._studentActiveSpotlightEl&&document.getElementById("student-spotlight-popover")?.style.display==="block"){let l=document.getElementById("student-spotlight-popover"),d=document.getElementById("student-spotlight-arrow");O(window._studentActiveSpotlightEl,l,d,"#2563eb","student")}if(window._parentActiveSpotlightEl&&document.getElementById("parent-spotlight-popover")?.style.display==="block"){let l=document.getElementById("parent-spotlight-popover"),d=document.getElementById("parent-spotlight-arrow");O(window._parentActiveSpotlightEl,l,d,"#059669","parent")}},100))},{passive:!0}),window.addEventListener("keydown",function(l){let d=document.getElementById("student-spotlight-popover")?.style.display==="block",p=document.getElementById("parent-spotlight-popover")?.style.display==="block";!d&&!p||(l.key==="Escape"?(d&&window.closeStudentPortalTour(!0),p&&window.closeParentPortalTour(!0)):l.key==="ArrowRight"||l.key==="Enter"?(d&&window.nextStudentPortalTourStep(),p&&window.nextParentPortalTourStep()):l.key==="ArrowLeft"&&(d&&window.prevStudentPortalTourStep(),p&&window.prevParentPortalTourStep()))})}var Ee="centrly_locale";function Y(){try{return localStorage.getItem(Ee)==="en"?"en":"ar"}catch{return"ar"}}function Pe(t=Y(),r=globalThis.document){let i=t==="en"?"en":"ar";return r?.documentElement&&(r.documentElement.lang=i,r.documentElement.dir=i==="en"?"ltr":"rtl"),i}function Ge(t,r=globalThis.document){let i=t==="en"?"en":"ar";return localStorage.setItem(Ee,i),Pe(i,r),i}function B(t,r){return Y()==="en"?r:t}function Te(){let t=Y()==="en";return`<button type="button" class="locale-button" data-centrly-language="${t?"ar":"en"}" aria-label="${t?"Switch to Arabic":"التبديل إلى الإنجليزية"}"><span class="locale-button-label ${t?"":"is-active"}" lang="${t?"en":"ar"}">${t?"AR":"عربي"}</span><span class="locale-button-label ${t?"is-active":""}" lang="en">EN</span></button>`}var Ae=typeof document<"u"?document.__centrlyStaticCopies||(document.__centrlyStaticCopies=new WeakMap):new WeakMap;function Ve(t=document){let r=Y()==="en";for(let[i,s,n]of[["[data-copy-en]","textContent","copyEn"],["[data-placeholder-en]","placeholder","placeholderEn"],["[data-alt-en]","alt","altEn"]])for(let e of t.querySelectorAll(i)){let o=Ae.get(e);o||(o={},Ae.set(e,o)),s in o||(o[s]=e[s]);let c=e.dataset[n];(e[s]===o[s]||e[s]===c)&&(e[s]=r?c:o[s])}for(let i of t.querySelectorAll("[data-language-control]"))i.innerHTML=Te()}typeof document<"u"&&Pe();typeof document<"u"&&!document.__centrlyLanguageListener&&(document.__centrlyLanguageListener=!0,document.addEventListener("click",t=>{let r=t.target.closest?.("[data-centrly-language]");if(!r)return;let i=r.dataset.centrlyLanguage;if(i!=="en"&&i!=="ar")return;try{Ge(i)}catch{return}let s=window.centrlyApp;if(document.querySelector(".app-container")&&typeof s?.renderApp=="function"){let n=[...document.querySelectorAll("#mainContent input, #mainContent textarea, #mainContent select")],e=n.map(p=>({node:p,id:p.id,name:p.name,tag:p.tagName,type:p.type,value:p.value,checked:p.checked,selected:p.tagName==="SELECT"&&p.multiple?[...p.options].filter(h=>h.selected).map(h=>h.value):null})),o=document.activeElement,c=n.indexOf(o),m=null;try{c>=0&&typeof o.selectionStart=="number"&&(m=[o.selectionStart,o.selectionEnd,o.selectionDirection])}catch{}s.renderApp(!0);let l=[...document.querySelectorAll("#mainContent input, #mainContent textarea, #mainContent select")];for(let p=0;p<e.length;p++){let h=e[p],a=h.id?document.getElementById(h.id):l[p];if(!(!a||a.tagName!==h.tag||a.type!==h.type||a.name!==h.name)){if(h.type==="file"){h.node.files?.length&&a.replaceWith(h.node);continue}if(a.value=h.value,(h.type==="checkbox"||h.type==="radio")&&(a.checked=h.checked),h.selected)for(let g of a.options)g.selected=h.selected.includes(g.value)}}if(c>=0){let p=e[c],h=p.id?document.getElementById(p.id):document.querySelectorAll("#mainContent input, #mainContent textarea, #mainContent select")[c];if(h&&h.tagName===p.tag&&h.type===p.type&&h.name===p.name&&(h.focus?.({preventScroll:!0}),m))try{h.setSelectionRange(...m)}catch{}}let d=document.querySelector("#centrlyCustomModal .modal-dialog");if(d){d.dir=i==="en"?"ltr":"rtl";let p=d.querySelector(".modal-header button");p&&p.setAttribute("aria-label",i==="en"?"Close":"إغلاق")}document.dispatchEvent(new CustomEvent("centrly:localechange",{detail:{locale:i}}))}else if(document.querySelector("[data-language-control]"))Ve(document),document.dispatchEvent(new CustomEvent("centrly:localechange",{detail:{locale:i}}));else if(typeof s?._renderLocale=="function"||typeof s?.renderPortalLogin=="function"){let n=s.getAppEl?.()||document.getElementById("app");if(n?.querySelector("input[type=file]")&&[...n.querySelectorAll("input[type=file]")].some(o=>o.files?.length)){r.outerHTML=Te();return}let e=[...n?.querySelectorAll("input[id],textarea[id],select[id]")||[]].map(o=>({id:o.id,type:o.type,value:o.value,checked:o.checked}));typeof s._renderLocale=="function"?s._renderLocale():s.renderPortalLogin();for(let o of e){let c=document.getElementById(o.id);!c||c.type!==o.type||c.type==="file"||(c.value=o.value,(c.type==="checkbox"||c.type==="radio")&&(c.checked=o.checked))}}else location.reload()}));var Ie=[{months:1,discount:0},{months:6,discount:15},{months:12,discount:25}],Ce=t=>(t/100).toLocaleString(B("ar-EG","en-EG"),{maximumFractionDigits:2})+B(" ج.م"," EGP");function ze(t,r){return{basic_v1:35e3,pro_v1:1e5,max_v1:125e3}[r]||{24900:35e3,79900:1e5,99900:125e3}[t]||Math.round(t*1.2)}function We(t,r=1,i){let s=Ie.find(e=>e.months===Number(r));if(!s)throw new Error("Invalid billing cycle");let n=t*s.months;return{before:Number(r)===1?ze(t,i):n,total:Math.round(n*(100-s.discount)/100),...s}}function Be(t,r=1,i){let s=We(Number(t),Number(r),i);return`<s aria-label="${B("السعر القياسي","Standard price")}" style="font-size:1rem;color:var(--centrly-muted,#64748b)">${Ce(s.before)}</s><strong style="font-size:2rem">${Ce(s.total)} <small style="font-size:.8rem">${s.months===1?B("/ ٣٠ يومًا","/ 30 days"):s.months===6?B("/ ٦ شهور","/ 6 months"):B("/ سنة","/ year")}</small></strong>${s.discount?`<span>${B("خصم","Save")} ${s.discount}% ${B("من إجمالي السعر الشهري الحالي","on the current monthly total")}</span>`:""}`}typeof window<"u"&&(window.selectBillingCycle=function(t,r){let i=t.closest("section");if(Ie.some(s=>s.months===r)){i.dataset.billingCycle=String(r);for(let s of i.querySelectorAll("[data-cycle]"))s.setAttribute("aria-pressed",String(Number(s.dataset.cycle)===r));for(let s of i.querySelectorAll("[data-monthly-price]"))s.innerHTML=Be(s.dataset.monthlyPrice,r,s.dataset.planId)}});function Ue(t=""){if(!t||typeof t!="string")return null;let r=/^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/,i=t.trim().match(r);return i&&i[2]&&i[2].length===11?i[2]:null}function Je(t,r,i=""){let s=Ue(t);if(!s){alert("رابط الفيديو غير صالح أو ليس رابط يوتيوب");return}let n=document.getElementById("centrlyVideoPlayerModal");n&&n.remove();let e=document.createElement("div");e.id="centrlyVideoPlayerModal",e.style.cssText=`
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(10, 15, 30, 0.92);
    backdrop-filter: blur(8px);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 1rem;
    direction: rtl;
    font-family: system-ui, -apple-system, sans-serif;
  `;let o=i||"منصة سنترلي التعليمية • مشاهدة مؤمنة",c=null,m="طالب";if(i){let b=i.match(/كود:\s*([a-zA-Z0-9_-]+)/);b&&(c=b[1].trim());let y=i.split("•")[0]?.trim();y&&(m=y)}if(!c&&typeof window<"u"&&window._centrlyCurrentStudent&&(c=window._centrlyCurrentStudent.student_code||window._centrlyCurrentStudent.code||null,m=window._centrlyCurrentStudent.name||m),!c)try{let b=JSON.parse(localStorage.getItem("centrly_current_student")||"{}");c=b.student_code||b.code||null,b.name&&(m=b.name)}catch{}let l=typeof window<"u"&&window.__teacherSubdomain||"mr-omar",d=(b="watching")=>{if(!c)return;let y={student_code:String(c).trim(),student_name:m||"طالب",material_title:r||"فيديو حل واجب الباب الرابع",status:b,watched_at:new Date().toISOString()};try{let x=JSON.parse(localStorage.getItem("centrly_video_tracking_map")||"{}");x[c]?.status==="watched"&&b==="watching"?y.status="watched":(x[c]={status:b,studentName:m,updatedAt:y.watched_at},localStorage.setItem("centrly_video_tracking_map",JSON.stringify(x)),window.dispatchEvent(new CustomEvent("centrly_tracking_updated",{detail:x})))}catch{}try{fetch(`${D}/platform/public/${encodeURIComponent(l)}/video-view`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({student_code:y.student_code,student_name:y.student_name,material_title:y.material_title,progress_percent:y.status==="watched"?100:0,status:y.status==="watched"?"completed":"watching"}),keepalive:!0}).catch(()=>{})}catch{}};c&&d("watching"),e.innerHTML=`
    <div style="width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 0.75rem;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; color: #fff;">
        <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
          <span style="display: flex; align-items: center; color: #38bdf8;">${w("video",20,"#38bdf8")}</span>
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${f(r||"مشاهدة الفيديو")}
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
          title="${f(r||"Video")}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen 
          style="width: 100%; height: 100%; border: none;">
        </iframe>

        <!-- Anti-piracy Floating / Drifting Watermark -->
        <div id="centrlyFloatingWatermark" style="position: absolute; pointer-events: none; user-select: none; z-index: 10; color: rgba(255, 255, 255, 0.45); font-size: 0.85rem; font-weight: 800; background: rgba(0, 0, 0, 0.35); padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); transition: top 3s ease-in-out, left 3s ease-in-out;">
          ${f(o)}
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
  `,document.body.appendChild(e);let p=e.querySelector("#markCentrlyVideoCompletedBtn");p&&(p.onclick=()=>{d("watched"),p.style.background="#10b981";let b=e.querySelector("#markCentrlyVideoCompletedText");b&&(b.textContent="تمت المشاهدة بنجاح");let y=e.querySelector("#centrlyWatchLiveStatus");y&&(y.textContent="تم توثيق إتمام المشاهدة بنجاح (شاهد ✔)",y.style.color="#34d399")});let h=b=>{try{let y=typeof b.data=="string"?JSON.parse(b.data):b.data;if(y&&y.event==="onStateChange"){if(y.info===1)d("watching");else if(y.info===0){d("watched"),p&&(p.style.background="#10b981");let x=e.querySelector("#markCentrlyVideoCompletedText");x&&(x.textContent="تمت المشاهدة واكتملت");let k=e.querySelector("#centrlyWatchLiveStatus");k&&(k.textContent="عاش يا بطل! تم إنهاء مشاهدة الفيديو بنجاح (شاهد ✔)",k.style.color="#34d399")}}}catch{}};window.addEventListener("message",h);let a=()=>{window.removeEventListener("message",h),e.remove()},g=e.querySelector("#closeCentrlyVideoModal");g&&(g.onclick=a),e.onclick=b=>{b.target===e&&a()};let v=e.querySelector("#centrlyFloatingWatermark");if(v){let b=()=>{if(!document.body.contains(e))return;let x=Math.floor(Math.random()*70+10),k=Math.floor(Math.random()*60+10);v.style.top=x+"%",v.style.left=k+"%"};b();let y=setInterval(()=>{document.body.contains(e)?b():clearInterval(y)},4500)}}typeof window<"u"&&(window.centrlyPlayVideoWithWatermark=Je);function Re(t){if(!t||typeof t!="string")return"";let r=t.trim();return r.includes("/storage/v1/object/sign/homework-submissions/")?r.replace("/storage/v1/object/sign/homework-submissions/","/storage/v1/object/public/homework-submissions/").split("?")[0]:r}function je(t,r={},i=[],s=[]){let n=t.type==="pdf",e=t.type==="video",o=Re(t.url),c=e&&t.book_name==="approved_homework",m=!0,l="واجب مطلوب",d=!1;if(c){let a=[];try{if(t.questions){let _=JSON.parse(t.questions);Array.isArray(_.allowed_student_ids)&&(a=_.allowed_student_ids),_.homework_title&&(l=_.homework_title)}}catch{}let g=r.id||"",v=r.student_code||"",b=!!(g&&a.includes(g)||v&&a.includes(v)),y=t.pages;if(y&&l==="واجب مطلوب"){let _=i.find(A=>A.id===y);_&&(l=_.title)}let x=s.some(_=>_.id===y);d=!!i.find(_=>_.id===y&&_.submission_status==="pending"),m=b||x}let p=`${r.name||"طالب"} • كود: ${r.student_code||r.code||"-"} • ${r.student_phone||r.phone||r.parent_phone||""}`;if(c&&!m)return`
      <div style="padding: 1rem; border-radius: 0.75rem; background: #fffbeb; border: 1.5px dashed #f59e0b; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 180px;">
          <div style="margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.4rem;">
            <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 0.3rem; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">
              ${w("lock",12,"#b45309")}
              <span>فيديو مقفل (مشروط باعتماد واجب)</span>
            </span>
          </div>
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0 0 0.3rem 0;">
            ${f(t.title)}
          </h4>
          <div style="font-size: 0.8rem; color: #92400e; display: flex; align-items: center; gap: 0.35rem; line-height: 1.4;">
            ${w("info",14,"#b45309")}
            <span>
              ${d?`تم تسليم الواجب (<strong>${f(l)}</strong>) وهو قيد مراجعة واعتماد المعلم لفتح الفيديو تلقائياً فور الاعتماد.`:`يتطلب فتح ومشاهدة الفيديو <strong>اعتماد تسليم واجب: "${f(l)}"</strong> أولاً من المعلم.`}
            </span>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
          <button type="button" onclick="window.centrlyPlayVideoWithWatermark ? window.centrlyPlayVideoWithWatermark('${f(o)}', '${f(t.title)}', '${f(p)}') : window.open('${f(o)}', '_blank')"
            style="display: inline-flex; align-items: center; gap: 0.35rem; background: #2563eb; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; border: none; font-size: 0.8rem; font-weight: 800; cursor: pointer; box-shadow: 0 1px 3px rgba(37,99,235,0.25);">
            ${w("video",13,"#ffffff")}
            <span>مشاهدة الفيديو</span>
          </button>
          ${d?`
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #fef3c7; color: #b45309; padding: 0.45rem 0.75rem; border-radius: 0.5rem; font-size: 0.76rem; font-weight: 800; border: 1px solid #fde68a;">
              ${w("clock",13,"#b45309")}
              <span>الواجب قيد الاعتماد</span>
            </span>
          `:`
            <button type="button" onclick="window.scrollToHomework && window.scrollToHomework('${f(t.pages||"")}')"
              style="display: inline-flex; align-items: center; gap: 0.35rem; background: #f59e0b; color: #ffffff; padding: 0.45rem 0.75rem; border-radius: 0.5rem; border: none; font-size: 0.76rem; font-weight: 800; cursor: pointer;">
              ${w("homework",13,"#ffffff")}
              <span>تسليم الواجب</span>
            </button>
          `}
        </div>
      </div>
    `;let h=n?`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("file",12,"#1d4ed8")} PDF</span>`:e?`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("video",12,"#1d4ed8")} فيديو شرح</span>`:`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("link",12,"#1d4ed8")} رابط</span>`;return`
    <div style="padding: 0.9rem 1rem; border-radius: 0.75rem; background: ${c?"#f0fdf4":"#f8fafc"}; border: 1px solid ${c?"#bbf7d0":"#e2e8f0"}; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 180px;">
        <div style="margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
          <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 0.3rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
            ${h}
          </span>
          ${c?`
            <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 0.3rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 0.2rem;">
              ${w("check",11,"#047857")}
              <span>تم فتح الفيديو (الواجب معتمد)</span>
            </span>
          `:""}
        </div>
        <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0;">
          ${f(t.title)}
        </h4>
        ${t.description?`
          <p style="font-size: 0.78rem; color: #64748b; margin: 0.25rem 0 0 0; line-height: 1.4;">
            ${f(t.description)}
          </p>
        `:""}
      </div>

      ${!o||o==="#"?"":e?`
            <div>
              <button type="button" onclick="window.centrlyPlayVideoWithWatermark ? window.centrlyPlayVideoWithWatermark('${f(o)}', '${f(t.title)}', '${f(p)}') : window.open('${f(o)}', '_blank')"
                style="display: inline-flex; align-items: center; gap: 0.35rem; background: #2563eb; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; border: none; font-size: 0.8rem; font-weight: 800; cursor: pointer; box-shadow: 0 1px 3px rgba(37,99,235,0.25);">
                ${w("video",13,"#ffffff")}
                <span>مشاهدة الفيديو</span>
              </button>
            </div>
          `:`
          <div>
            <a href="${f(o)}" target="_blank" rel="noopener noreferrer"
              style="display: inline-flex; align-items: center; gap: 0.35rem; background: #1d4ed8; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; text-decoration: none; font-size: 0.8rem; font-weight: 800; box-shadow: 0 1px 3px rgba(29,78,216,0.2);">
              ${w(n?"download":"link",13,"#ffffff")}
              <span>${n?"تحميل / فتح المذكرة":"فتح الرابط"}</span>
            </a>
          </div>
        `}
    </div>
  `}function le(t={},r="dashboard"){if(t.error||!t.student)return`
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; padding: 1.5rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
        <div style="max-width: 480px; width: 100%; background: #fff; border-radius: 1rem; padding: 2.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 0.75rem;">${w("lock",48,"#ef4444")}</div>
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #ef4444; margin: 0 0 0.5rem 0;">رابط الطالب غير صالح أو منتهي الصلاحية</h2>
          <p style="font-size: 0.9rem; color: #64748b; margin: 0 0 1.5rem 0; line-height: 1.6;">
            ${f(t.error||"تعذر تحميل بيانات الطالب. يرجى التأكد من فتح الرابط الصحيح المرسل لك أو مراجعة معلمك.")}
          </p>
          <div style="font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
            منظومة سنترلي التعليمية | Centrly Student Portal
          </div>
        </div>
      </div>
    `;let i=t.student,s=(i.id||i.student_code||i.code||i.student_phone||"").toString().trim();if(typeof window<"u"&&(window._centrlyCurrentStudent=i,s)){window._centrlyCurrentStudentId=s;try{localStorage.setItem("centrly_current_student",JSON.stringify({id:i.id,student_code:i.student_code||i.code||s,name:i.name}))}catch{}}let n=t.summary||{total_sessions:0,attended_count:0,absent_count:0,attendance_rate:"0%",homework_done_count:0,homework_total_count:0,total_quizzes:0,quiz_average_percentage:"—"},e=t.sessions||[],o=t.quizzes||[],c=t.materials||[],m=c.filter(u=>u.type==="online_quiz"||u.questions&&!u.is_homework),l=c.filter(u=>u.is_homework),d=c.filter(u=>u.type==="video"),p=c.filter(u=>!u.is_homework&&u.type!=="online_quiz"&&u.type!=="video"),h=l.filter(u=>u.submission_status==="approved");if(typeof window<"u"){window.__portalMaterials=c;let u="";try{let $=localStorage.getItem("centrly_portal_token")?localStorage:sessionStorage,P=$.getItem("centrly_portal_role");(!P||P==="student")&&(u=$.getItem("centrly_portal_token")||"")}catch{}window.__portalToken=t.token||(typeof location<"u"?new URLSearchParams(location.search).get("token"):"")||u}let a=i.teacher_phone||t.teacher_phone||i.contact_phone||t.contact_phone||"",g=a?a.replace(/[^\d+]/g,""):"";g.startsWith("+")?g=g.substring(1):g.startsWith("01")&&(g="2"+g);let v=i.teacher_name||"المعلم",b=encodeURIComponent(`السلام عليكم يا ${v}، أنا الطالب ${i.name}${i.student_code?` (كود: ${i.student_code})`:""}${i.group_name?` - مجموعة ${i.group_name}`:""}، وعندي استفسار بخصوص المادة.`),y=g?`https://wa.me/${g}?text=${b}`:null,x=new Date,k=u=>{if(u.can_submit===!1||u.submission_status==="approved")return!0;if(u.can_submit===!0||u.submission_status==="rejected"||u.submission_status==="pending")return!1;if(u.due_date)try{let $=new Date(u.due_date);if(!isNaN($.getTime())&&($.setHours(23,59,59,999),$.getTime()<x.getTime()))return!0}catch{}return!1},_=l.filter(u=>!k(u)),A=l.filter(u=>k(u)),S=[..._].sort((u,$)=>{let P=u.submission_status==="rejected",C=$.submission_status==="rejected";return P&&!C?-1:!P&&C?1:u.due_date&&$.due_date?new Date(u.due_date)-new Date($.due_date):0}),T=[...A].sort((u,$)=>{let P=u.submitted_at||u.due_date||u.created_at||"";return($.submitted_at||$.due_date||$.created_at||"").localeCompare(P)});return`
    <div style="min-height: 100vh; background-color: #f8fafc; padding: 1rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Student Portal Header (Teacher White-Labeled) -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); border-radius: 1.25rem; padding: 1.5rem; box-shadow: 0 4px 20px rgba(37, 99, 235, 0.15); color: #fff; text-align: center; position: relative; overflow: hidden;">
          <!-- Subtle decorative circle -->
          <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; position: relative; z-index: 2;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #10b981; font-weight: 700; background: rgba(255,255,255,0.95); padding: 0.25rem 0.6rem; border-radius: 9999px;">
              <span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%;"></span>
              بوابة الطالب — ${f(v)}
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
            أهلاً بك يا ${f(i.name)}
          </h1>
          
          <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap;">
            <span style="background: rgba(255,255,255,0.2); padding: 0.2rem 0.6rem; border-radius: 0.4rem; font-family: monospace; font-size: 0.8rem; font-weight: 700;">كود: ${f(i.student_code)}</span>
            ${i.group_name?`<span style="background: rgba(245,158,11,0.3); border: 1px solid rgba(245,158,11,0.5); padding: 0.2rem 0.6rem; border-radius: 0.4rem; font-size: 0.8rem; font-weight: 700;">${f(i.group_name)}</span>`:""}
          </div>
          
          <p style="font-size: 0.8rem; opacity: 0.9; margin: 0.5rem 0 0 0;">
            الواجبات، الامتحانات الدورية، وفيديوهات الشرح والمتابعة
          </p>
        </div>

        ${xe(t)}
        <!-- Teacher Direct WhatsApp Contact Card -->
        ${y?`
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1.5px solid #86efac; border-radius: 1rem; padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);">
                ${w("whatsapp",22,"#ffffff")}
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 0.9rem; color: #065f46;">
                  تواصل مباشر مع ${f(v)}
                </div>
                <div style="font-size: 0.76rem; color: #047857; margin-top: 1px;">
                  ${i.subject_name?`${f(i.subject_name)} • `:""}لأي استفسار في المنهج أو بخصوص الواجب والامتحانات
                </div>
              </div>
            </div>
            <a href="${y}" target="_blank" rel="noopener noreferrer"
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
            <span>الامتحانات ${m.length>0?`(${m.length})`:""}</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('videos') : null" id="student-tab-btn-videos"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${r==="videos"?"#ffffff":"transparent"}; color: ${r==="videos"?"#1e3a8a":"#64748b"}; box-shadow: ${r==="videos"?"0 2px 6px rgba(0,0,0,0.08)":"none"};">
            ${w("video",14,r==="videos"?"#1e3a8a":"#64748b")}
            <span>فيديوهات الشرح ${d.length>0?`(${d.length})`:""}</span>
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
                ${f(n.attendance_rate??"لا توجد بيانات")}
              </div>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
                ${f(n.attended_count||0)} حاضر / ${f(n.total_sessions||0)} حصة
              </div>
            </div>

            <div style="background: #ffffff; padding: 1rem 0.75rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">متوسط الكويزات</div>
              <div style="font-size: 1.55rem; font-weight: 900; color: #2563eb; margin-top: 0.2rem;">
                ${f(n.quiz_average_percentage||"—")}
              </div>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
                ${o.length>0?`${o.length} كويز مرصود`:"لا توجد كويزات"}
              </div>
            </div>

            <div style="background: #ffffff; padding: 1rem 0.75rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الواجبات المسلّمة</div>
              <div style="font-size: 1.55rem; font-weight: 900; color: ${_.length>0?"#b45309":"#059669"}; margin-top: 0.2rem;">
                ${h.length} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">/ ${l.length}</span>
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
                ${_.length+m.length} مهام معلقة
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${_.length>0?`
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #fffbeb; border: 1px solid #fef3c7; border-right: 4px solid #f59e0b; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #b45309; background: #fef3c7; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">واجب مطلوب للتسليم</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${f(_[0].title)}</h4>
                    ${_[0].due_date?`<div style="font-size: 0.75rem; color: #92400e; margin-top: 0.15rem;">ينتهي: ${f(_[0].due_date)}</div>`:""}
                  </div>
                  <button type="button" onclick="window.switchStudentPortalTab('materials')" class="btn btn-sm btn-primary" style="font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.9rem; border-radius: 0.5rem;">
                    تسليم الواجب الآن
                  </button>
                </div>
              `:""}

              ${m.length>0?`
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #eff6ff; border: 1px solid #dbeafe; border-right: 4px solid #2563eb; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #1d4ed8; background: #dbeafe; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">امتحان أونلاين متاح</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${f(m[0].title)}</h4>
                    <div style="font-size: 0.75rem; color: #1e40af; margin-top: 0.15rem;">بيئة مؤمنة • تصحيح واعتماد مباشر</div>
                  </div>
                  <button type="button" onclick="window.switchStudentPortalTab('exams')" class="btn btn-sm" style="background: #1e3a8a; color: #fff; font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.9rem; border-radius: 0.5rem; border: none; cursor: pointer;">
                    دخول الامتحان
                  </button>
                </div>
              `:""}

              ${d.length>0?`
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #f5f3ff; border: 1px solid #ede9fe; border-right: 4px solid #7c3aed; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #6d28d9; background: #ede9fe; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">فيديو شرح متاح</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${f(d[0].title)}</h4>
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
                    ${f(i.group_name||"مجموعة السنتر")}
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
                ${h.length} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">/ ${l.length}</span>
              </div>
              <div style="font-size: 0.725rem; color: #059669; font-weight: 700; margin-top: 0.2rem;">
                ${l.length>0&&h.length===l.length?"تم تسليم كافة الواجبات بنجاح":`تم تسليم ${h.length} واجب بنجاح`}
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">المذكرات والشروحات</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #8b5cf6; margin-top: 0.2rem;">
                ${p.length}
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
              ${S.length>0?S.map(u=>{let $=u.type==="pdf",P=u.type==="video",C=$?`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("file",12,"#1d4ed8")} PDF</span>`:P?`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("video",12,"#1d4ed8")} فيديو</span>`:`<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${w("link",12,"#1d4ed8")} رابط</span>`,N=u.submission_status||"unsubmitted",M=N==="pending",E=N==="rejected",j=E?"#fffafa":"#f8fafc",z=E?"#fca5a5":"#e2e8f0",U=E?`<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; display: inline-flex; align-items: center; gap: 0.25rem;">${w("alertTriangle",12,"#dc2626")} <span>مطلوب إعادة التسليم</span></span>`:M?`<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fffbeb; color: #d97706; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">${w("clock",12,"#d97706")} <span>تم الرفع (قيد مراجعة المعلم)</span></span>`:`<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">${w("homework",12,"#b45309")} <span>واجب منزلي مطلوب</span></span>`;return`
                  <div id="hw-card-${f(u.id)}" style="padding: 1.1rem; border-radius: 0.85rem; background: ${j}; border: 1px solid ${z}; display: flex; flex-direction: column; gap: 0.65rem;">
                    
                    <!-- Top row: Title and Tags -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
                          <span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 0.35rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                            ${C}
                          </span>
                          ${U}
                        </div>
                        <h3 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0;">
                          ${f(u.title)}
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
                                <span style="font-weight: 800; color: #1e3a8a;">${f(u.book_name||"الكتاب المدرسي")}</span>
                              </div>
                              <div style="background: #ffffff; padding: 0.45rem 0.65rem; border-radius: 0.45rem; border: 1px solid #dbeafe;">
                                <span style="color: #64748b; font-size: 0.72rem; display: block; font-weight: 600;">الصفحات المطلوبة:</span>
                                <span style="font-weight: 800; color: #1e3a8a;">${f(u.pages||"—")}</span>
                              </div>
                              <div style="background: #ffffff; padding: 0.45rem 0.65rem; border-radius: 0.45rem; border: 1px solid #dbeafe;">
                                <span style="color: #64748b; font-size: 0.72rem; display: block; font-weight: 600;">أرقام الأسئلة:</span>
                                <span style="font-weight: 800; color: #b45309;">${f(u.questions||"—")}</span>
                              </div>
                            </div>
                          </div>
                        `:""}

                        ${u.description?`
                          <div style="font-size: 0.85rem; color: #1e293b; margin: 0.5rem 0 0 0; line-height: 1.6; background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; border-right: 3px solid #2563eb;">
                            <div style="font-weight: 800; color: #1e40af; font-size: 0.825rem; margin-bottom: 0.25rem;">وصف الواجب والمطلوب حله:</div>
                            <div style="white-space: pre-wrap; color: #334155;">${f(u.description)}</div>
                          </div>
                        `:""}

                        ${(()=>{let F=Re(u.url);return F&&F!=="#"?`
                            <div style="margin-top: 0.6rem;">
                              <a href="${f(F)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm"
                                style="display: inline-flex; align-items: center; gap: 0.4rem; background: #2563eb; color: #ffffff; font-weight: 800; text-decoration: none; padding: 0.45rem 0.85rem; border-radius: 0.5rem; font-size: 0.825rem; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                                ${w($?"file":P?"video":"link",14,"#ffffff")}
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
                        <span>آخر موعد لتسليم الواجب: <b>${f(u.due_date)}</b></span>
                      </div>
                    `:""}

                    <!-- Homework Submission Box with Upload Button & Teacher Notes -->
                    <div style="background: #ffffff; border: 1px solid ${E?"#fca5a5":"#e2e8f0"}; border-radius: 0.65rem; padding: 0.85rem; margin-top: 0.2rem;">
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
                          `:E?`
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

                      ${E?`
                        <div style="font-size: 0.825rem; background: #fff7ed; border-right: 3px solid #ea580c; border: 1px solid #fed7aa; padding: 0.55rem 0.75rem; border-radius: 0.4rem; color: #9a3412; margin-bottom: 0.65rem;">
                          <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
                            ${w("alertTriangle",14,"#ea580c")}
                            <span>توجيه وملاحظة المعلم لإعادة الحل:</span>
                          </div>
                          <div>${f(u.teacher_feedback||"يرجى إعادة حل الواجب وتصحيحه ورفع الحل من جديد.")}</div>
                        </div>
                      `:u.teacher_feedback?`
                        <div style="font-size: 0.8rem; background: #fff7ed; border-right: 3px solid #ea580c; padding: 0.45rem 0.65rem; border-radius: 0.35rem; color: #9a3412; margin-bottom: 0.6rem;">
                          <b>ملاحظة المعلم:</b> ${f(u.teacher_feedback)}
                        </div>
                      `:""}

                      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem;">
                        ${u.submission_url?`
                          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            ${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(u.submission_url)?`
                              <a href="${f(u.submission_url)}" target="_blank" rel="noopener noreferrer" title="اضغط لتكبير صورة الواجب">
                                <img src="${f(u.submission_url)}" alt="صورة الواجب" style="width: 38px; height: 38px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                              </a>
                            `:""}
                            <a href="${f(u.submission_url)}" target="_blank" rel="noopener noreferrer"
                              style="font-size: 0.8rem; color: #2563eb; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${w("file",14,"#2563eb")}
                              <span>${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(u.submission_url)?"معاينة صورة الواجب":"معاينة ملفك المرفوع"} (${f(u.submitted_at?u.submitted_at.slice(0,10):"مرفوع")}) ↗</span>
                            </a>
                          </div>
                        `:`
                          <span style="font-size: 0.75rem; color: #94a3b8;">ارفع الحل بصيغة PDF أو صورة واضحة (الحد الأقصى 25MB)</span>
                        `}

                        <!-- File Upload Trigger (PDF or Images) -->
                        ${u.can_submit===!1?'<p role="status">هذا التكليف لا يستقبل رفع ملفات جديدة. تسليمك السابق محفوظ.</p>':`<div>
                          <input type="file" id="hw-file-input-${f(u.id)}" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.heic" style="display: none;"
                            onchange="window.centrlyApp && window.centrlyApp.handleStudentHomeworkUpload ? window.centrlyApp.handleStudentHomeworkUpload('${f(u.id)}', this.files[0]) : null">
                          
                          <button type="button" onclick="document.getElementById('hw-file-input-${f(u.id)}').click()" id="hw-upload-btn-${f(u.id)}"
                            style="background: ${E?"#dc2626":"#059669"}; color: #ffffff; border: 1px solid ${E?"#b91c1c":"#059669"}; padding: 0.45rem 0.95rem; border-radius: 0.5rem; font-size: 0.825rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.2s; box-shadow: 0 2px 6px ${E?"rgba(220,38,38,0.3)":"rgba(5,150,105,0.25)"};">
                            ${w("upload",14,"#ffffff")}
                            <span>${E?"رفع حل الواجب الجديد (إعادة التسليم)":M?"تعديل / رفع نسخة أحدث":"رفع حل الواجب (PDF أو صورة)"}</span>
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

          ${p.length>0?`
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
                <span class="badge badge-blue" style="font-weight: 700;">${p.length} ملف متاح</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${p.map(u=>je(u,i,l,h)).join("")}
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
                ${T.length} واجب منتهي
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${T.length>0?T.map(u=>{let $=u.submission_status==="approved";return`
                  <div style="background: ${$?"#fbfdfc":"#fefefe"}; border: 1px solid ${$?"#bbf7d0":"#fecaca"}; border-radius: 0.6rem; padding: 0.55rem 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    
                    <!-- Homework Title & Date (Single Row) -->
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 170px;">
                      <span style="color: ${$?"#10b981":"#ef4444"}; display: flex; align-items: center;">
                        ${w($?"check":"close",15,$?"#10b981":"#ef4444")}
                      </span>
                      <span style="font-size: 0.85rem; font-weight: 800; color: #1e293b;">
                        ${f(u.title)}
                      </span>
                      ${u.due_date?`
                        <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 500;">
                          (${f(u.due_date)})
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
                          <a href="${f(u.submission_url)}" target="_blank" rel="noopener noreferrer"
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
                ${f(n.quiz_average_percentage||"—")}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                متوسط أدائك في الكويزات
              </div>
            </div>

            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الكويزات المرصودة</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">
                ${f(n.total_quizzes||o.length)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                اختبار تم تصحيحه
              </div>
            </div>
          </div>

          <!-- Active Online Quizzes Section -->
          ${m.length>0?`
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
                <span class="badge badge-blue" style="font-weight: 800;">${m.length} امتحان متاح</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${m.map(u=>{let $={};try{$=typeof u.questions=="string"?JSON.parse(u.questions):u.questions||{}}catch{}let P=$.question_count||$.questions?.length||0,C=$.time_limit_minutes||20,N=ve(),M=N.date,E=N.time,j=!0,z="";return $.available_date&&$.available_date!==M?$.available_date>M?(j=!1,z=`متاح بتاريخ ${$.available_date}`):(j=!1,z="انتهت فترة الامتحان"):$.start_time&&E<$.start_time?(j=!1,z=`يبدأ الساعة ${$.start_time}`):$.end_time&&E>$.end_time&&(j=!1,z="انتهى وقت الامتحان"),`
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.75rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                      <div>
                        <div style="font-weight: 900; font-size: 0.95rem; color: #0f172a;">${f(u.title)}</div>
                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                          <span>${f($.subject||"الفيزياء")}</span>
                          <span>•</span>
                          <span>${P} أسئلة</span>
                          <span>•</span>
                          <span>المدة: ${C} دقيقة</span>
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
                            onclick="window.startStudentOnlineExam('${f(u.id)}')"
                          >
                            <span>بدء الامتحان الآن</span>
                            <span>←</span>
                          </button>
                        `:`
                          <span style="background: #fef2f2; color: #b91c1c; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #fecaca; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${w("clock",14,"#b91c1c")}
                            <span>${f(z)}</span>
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
              <span class="badge badge-blue" style="font-weight: 700;">${o.length} كويز</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${o.length>0?o.map(u=>{let $=u.percentage>=85?"#059669":u.percentage>=65?"#d97706":"#dc2626",P=u.percentage>=85?"#ecfdf5":u.percentage>=65?"#fffbeb":"#fef2f2";return`
                  <div style="padding: 1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                      <div>
                        <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">${f(u.title)}</div>
                        ${u.date?`<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;">تاريخ الكويز: ${f(u.date)}</div>`:""}
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: ${$}; background: ${P}; padding: 0.2rem 0.55rem; border-radius: 0.4rem;">
                          ${f(u.tier)}
                        </span>
                        <span style="font-size: 1.1rem; font-weight: 900; color: #1d4ed8; font-family: monospace; background: #eff6ff; padding: 0.25rem 0.65rem; border-radius: 0.4rem; border: 1px solid #bfdbfe;">
                          ${f(u.score)} / ${f(u.max_score)}
                        </span>
                      </div>
                    </div>

                    <!-- Visual Progress Bar -->
                    <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin-top: 0.25rem;">
                      <div style="width: ${Math.min(100,Math.max(0,u.percentage))}%; height: 100%; background: ${$}; border-radius: 9999px;"></div>
                    </div>

                    ${u.note?`
                      <div style="font-size: 0.8rem; background: #fff; padding: 0.4rem 0.65rem; border-radius: 0.4rem; border-right: 3px solid #1d4ed8; color: #334155; margin-top: 0.25rem;">
                        <b>ملاحظة المعلم:</b> ${f(u.note)}
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
                ${d.length} فيديو متاح
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${d.length>0?d.map(u=>je(u,i,l,h)).join(""):`
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
                ${f(n.attendance_rate)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${f(n.attended_count)} حاضر / ${f(n.total_sessions)} حصة
              </div>
            </div>

            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">مرات الغياب</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: ${n.absent_count>1?"#ef4444":"#64748b"}; margin-top: 0.2rem;">
                ${f(n.absent_count)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${n.absent_count===0?"التزام ممتاز بالحضور":"تنبيه: احرص على عدم تفويت الحصص"}
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
              <span class="badge badge-blue" style="font-weight: 700;">${e.length} حصة</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${e.length>0?e.map(u=>`
                <div style="padding: 0.85rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.4rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">
                      حصة رقم ${f(u.session_number)} • ${f(u.session_date)}
                    </div>
                    <span class="badge ${u.attended?"badge-success":"badge-danger"}">
                      ${u.attended?"حاضر":"غائب"}
                    </span>
                  </div>

                  ${u.comment?`
                    <div style="font-size: 0.8rem; background: #fff; padding: 0.4rem 0.65rem; border-radius: 0.4rem; border-right: 3px solid #1d4ed8; color: #0f172a; margin-top: 0.25rem;">
                      <span><b>ملاحظة المعلم:</b> ${f(u.comment)}</span>
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
            ${oe(i)}
          </div>
        </div>

        <!-- Student Portal Security & Integrity Note -->
        <div style="text-align: center; padding: 1rem 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.6;">
          رابطك الشخصي لمتابعة دراستك • تتحدث البيانات والدرجات تلقائياً<br>
          بوابة الطالب الرسمية — ${f(v)}
        </div>

        <!-- Walkthrough Onboarding Tour Modal -->
        ${Se()}

      </div>
    </div>
  `}typeof window<"u"&&(window.switchStudentPortalTab=function(t){try{typeof localStorage<"u"&&localStorage.setItem("centrly_portal_student_tab",t),typeof sessionStorage<"u"&&sessionStorage.setItem("centrly_portal_student_tab",t)}catch{}["dashboard","materials","exams","videos","attendance","card"].forEach(i=>{let s=document.getElementById("student-tab-content-"+i),n=document.getElementById("student-tab-btn-"+i);s&&(s.style.display=i===t?"flex":"none"),n&&(n.style.background=i===t?"#ffffff":"transparent",n.style.color=i===t?"#1e3a8a":"#64748b",n.style.boxShadow=i===t?"0 2px 6px rgba(0,0,0,0.08)":"none")})},window.scrollToHomework=function(t){window.switchStudentPortalTab&&window.switchStudentPortalTab("materials");let r=t?document.getElementById("hw-card-"+t):null;if(r)r.scrollIntoView({behavior:"smooth",block:"center"}),r.style.outline="2px solid #f59e0b",setTimeout(()=>{r.style.outline="none"},2500);else{let i=document.getElementById("student-tab-content-materials");i&&i.scrollIntoView({behavior:"smooth"})}},window.togglePdfHelper=function(){let t=document.getElementById("pdf-helper-content"),r=document.getElementById("pdf-helper-arrow");if(!t)return;t.style.display==="none"||!t.style.display?(t.style.display="block",r&&(r.style.transform="rotate(180deg)")):(t.style.display="none",r&&(r.style.transform="rotate(0deg)"))},window.startStudentOnlineExam=async function(t){if(window.__examOpening)return;window.__examOpening=!0;let i=(window.__portalMaterials||[]).find(c=>c.id===t);if(!i){window.__examOpening=!1;return}let s;try{let c=window.__portalToken||new URLSearchParams(location.search).get("token");s=await we((m,l)=>H("/public/quizzes/"+m,{method:"POST",body:l}),c,t,(m,l)=>{if(window.__currentExam?.attempt!==s)return;let d=document.getElementById("examSaveStatus");d&&(d.textContent=m==="saved"?"إجاباتك محفوظة":m==="saving"?"جار حفظ إجاباتك…":m==="submitted"?"تم تسليم المحاولة":l||"تعذر الحفظ؛ حافظ على اتصال الإنترنت")})}catch(c){alert(c.message);return}finally{window.__examOpening=!1}if(s.submitted){alert(s.submitted.message||"هذا الامتحان مسلّم بالفعل");return}window.__currentExam?.attempt?.dispose(),window.__currentExam?.timerInterval&&clearInterval(window.__currentExam.timerInterval);let n=s.definition,e=n.questions;window.__currentExam={materialId:s.materialId,title:i.title,subject:n.subject||"",timeLimitMinutes:n.time_limit_minutes||20,questions:e,currentIndex:0,answers:s.answers,timeRemaining:s.remaining(),timerInterval:null,attempt:s};let o=document.getElementById("studentExamModalOverlay");o||(o=document.createElement("div"),o.id="studentExamModalOverlay",o.style.cssText=`
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 1rem; overflow-y: auto; font-family: 'Cairo', sans-serif;
      `,document.body.appendChild(o)),window.__currentExam.timerInterval&&clearInterval(window.__currentExam.timerInterval),window.__currentExam.timerInterval=setInterval(()=>{window.__currentExam.timeRemaining=window.__currentExam.attempt.remaining();let c=document.getElementById("examTimerCountdown");if(c){let m=Math.max(0,Math.floor(window.__currentExam.timeRemaining/60)),l=Math.max(0,window.__currentExam.timeRemaining%60);c.textContent=`${m.toString().padStart(2,"0")}:${l.toString().padStart(2,"0")}`,window.__currentExam.timeRemaining<120&&(c.style.color="#ef4444",c.style.fontWeight="900")}window.__currentExam.timeRemaining<=0&&(clearInterval(window.__currentExam.timerInterval),alert("انتهى وقت الامتحان المخصص! سيتم تسليم إجاباتك تلقائياً الآن."),window.submitStudentOnlineExam(!0))},1e3),window.renderStudentExamRunner()},window.renderStudentExamRunner=function(){let t=window.__currentExam,r=document.getElementById("studentExamModalOverlay");if(!t||!r)return;let i=t.questions[t.currentIndex],s=t.questions.length,n=i.type!=="essay",e=t.answers[i.id],o=Math.floor(t.timeRemaining/60),c=t.timeRemaining%60,m=`${o.toString().padStart(2,"0")}:${c.toString().padStart(2,"0")}`;r.innerHTML=`
      <div style="display:grid;gap:.75rem;width:100%;max-width:680px;margin:auto">
      ${t.submissionFailed?'<div dir="rtl" role="alert" style="background:#fff7ed;color:#9a3412;padding:1rem;border-radius:12px">لم يتأكد التسليم. إجاباتك باقية ومثبتة هنا.<button class="btn btn-primary" style="min-height:44px;margin:.5rem" onclick="window.submitStudentOnlineExam(true)">إعادة محاولة التسليم</button></div>':""}
      <div dir="rtl" style="background: #ffffff; border-radius: 16px; max-width: 680px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.3); overflow: hidden; border: 1px solid #e2e8f0; margin: auto; display: flex; flex-direction: column;">
        
        <!-- Header Strip -->
        <div style="background: #1e3a8a; color: #ffffff; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <div style="font-weight: 900; font-size: 1.1rem;">${f(t.title)}</div>
            <div style="font-size: 0.78rem; color: #93c5fd; margin-top: 0.15rem;">مادة ${f(t.subject)} • سؤال ${t.currentIndex+1} من ${s}</div>
          </div>

          <!-- Timer Clock Badge -->
          <div style="background: #0f172a; padding: 0.4rem 0.85rem; border-radius: 30px; display: flex; align-items: center; gap: 0.45rem; border: 1.5px solid #3b82f6;">
            <span style="font-size: 0.8rem; color: #94a3b8;">الوقت المتبقي:</span>
            <span id="examTimerCountdown" style="font-family: monospace; font-size: 1.15rem; font-weight: 900; color: #38bdf8;">
              ${m}
            </span>
          </div>
        </div>

        <p id="examSaveStatus" role="status" style="margin:.5rem 1.25rem;font-size:.8rem">إجاباتك تتحفظ أثناء الحل. حافظ على اتصال الإنترنت.</p>
        <!-- Question Body Card -->
        <div style="padding: 1.5rem; flex: 1;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem; gap: 0.5rem;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; line-height: 1.6;">
              <span style="color: #2563eb; font-weight: 900;">(${t.currentIndex+1})</span>
              ${f(i.text||"")}
            </div>
            <span style="background: #eff6ff; color: #1e40af; font-size: 0.78rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
              [${i.points||1} درجات]
            </span>
          </div>

          ${i.image_url?`
            <div style="text-align: center; margin: 1rem 0;">
              <img src="${f(i.image_url)}" alt="صورة المسألة" style="max-height: 220px; max-width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.08);" />
            </div>
          `:""}

          <!-- MCQ Options or Essay Area -->
          ${n?`
            <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1.25rem;">
              ${["أ","ب","ج","د"].map((l,d)=>{let p=Number(e)===d,h=i.choices?.[d]||"";return`
                  <div 
                    onclick="window.selectExamChoice(${d})"
                    style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 10px; border: 2px solid ${p?"#2563eb":"#e2e8f0"}; background: ${p?"#eff6ff":"#ffffff"}; cursor: pointer; transition: all 0.15s ease;"
                  >
                    <span style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${p?"#2563eb":"#94a3b8"}; background: ${p?"#2563eb":"#fff"}; color: ${p?"#fff":"#64748b"}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.85rem;">
                      ${l}
                    </span>
                    <span style="font-weight: 700; font-size: 0.95rem; color: ${p?"#1e40af":"#1e293b"}; flex: 1;">
                      ${f(h)}
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
              >${f(e||"")}</textarea>
            </div>
          `}

        </div>

        <!-- Question Navigation Dots Strip -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 0.75rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${t.questions.map((l,d)=>{let p=d===t.currentIndex,h=t.answers[l.id]!==void 0&&t.answers[l.id]!=="";return`
                <button 
                  type="button" 
                  onclick="window.goToExamQuestion(${d})"
                  style="width: 28px; height: 28px; border-radius: 6px; font-weight: 800; font-size: 0.78rem; border: 1.5px solid ${p?"#1e3a8a":h?"#10b981":"#cbd5e1"}; background: ${p?"#1e3a8a":h?"#dcfce7":"#ffffff"}; color: ${p?"#ffffff":h?"#15803d":"#64748b"}; cursor: pointer;"
                >
                  ${d+1}
                </button>
              `}).join("")}
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button 
              type="button" 
              class="btn btn-secondary" 
              style="padding: 0.45rem 0.85rem; font-size: 0.85rem; font-weight: 700;"
              onclick="window.prevExamQuestion()"
              ${t.currentIndex===0?'disabled style="opacity: 0.5;"':""}
            >
              السابق
            </button>

            ${t.currentIndex<s-1?`
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
    `,t.submissionFailed&&(r.querySelectorAll("textarea").forEach(l=>l.readOnly=!0),r.querySelectorAll("[onclick*=selectExamChoice]").forEach(l=>l.style.pointerEvents="none"))},window.selectExamChoice=function(t){let r=window.__currentExam;if(!r)return;let i=r.questions[r.currentIndex];r.attempt.setAnswer(i.id,t)&&window.renderStudentExamRunner()},window.setExamEssayAnswer=function(t){let r=window.__currentExam;if(!r)return;let i=r.questions[r.currentIndex];r.attempt.setAnswer(i.id,t)},window.nextExamQuestion=function(){let t=window.__currentExam;!t||t.currentIndex>=t.questions.length-1||(t.currentIndex++,window.renderStudentExamRunner())},window.prevExamQuestion=function(){let t=window.__currentExam;!t||t.currentIndex<=0||(t.currentIndex--,window.renderStudentExamRunner())},window.goToExamQuestion=function(t){let r=window.__currentExam;!r||t<0||t>=r.questions.length||(r.currentIndex=t,window.renderStudentExamRunner())},window.submitStudentOnlineExam=async function(t){let r=window.__currentExam;if(!r||r.submitting)return;if(!t){let s=Object.keys(r.answers).filter(e=>r.answers[e]!==void 0&&r.answers[e]!=="").length,n=r.questions.length;if(s<n){if(!confirm(`لقد قمت بالإجابة على (${s}) من أصل (${n}) أسئلة. هل أنت متأكد من رغبتك في تسليم الامتحان الآن؟`))return}else if(!confirm("هل أنت متأكد من تسليم إجاباتك وإنهاء الامتحان؟"))return}r.submitting=!0,r.timerInterval&&clearInterval(r.timerInterval);let i=window.__portalToken||(typeof location<"u"?new URLSearchParams(location.search).get("token"):"");try{let s=await r.attempt.submit(),n=document.getElementById("studentExamModalOverlay");s?.success?n&&(n.innerHTML=`
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
                ${f(s.message||"أحسنت صنعاً")}
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
          `):alert(s?.error?.message||"حدث خطأ أثناء تسليم الامتحان")}catch(s){r.submissionFailed=!0,window.renderStudentExamRunner(),alert(s?.message||"تعذر إرسال الإجابات، يرجى التحقق من اتصال الإنترنت")}finally{r.submitting=!1}});function de(t){return!t&&t!==0?"":String(t).replace(/[٠-٩]/g,r=>String(r.charCodeAt(0)-1632)).replace(/[۰-۹]/g,r=>String(r.charCodeAt(0)-1776)).trim()}function Le(t){return/^(?:[a-z0-9-]+\.)?centerly-eg\.com$/.test(t)||/^(?:[a-z0-9-]+\.)?centrly\.app$/.test(t)}function Qe(t){try{let r=new URL(t);return r.origin===t&&r.protocol==="https:"&&!r.port&&Le(r.hostname)}catch{return!1}}async function Me(t,r,i,s,n=window.location,e=null){if(!Le(n.hostname))return!1;let o=typeof window<"u"?window.__centrlyPortalArrival:null,c=e||(o?.token===r&&o.role===i&&o.origin===n.origin?o:await s("/public/portal/destination",{method:"POST",body:{token:r,role:i}}));if(o===c&&(window.__centrlyPortalArrival=null),!Qe(c?.origin))throw new Error("تعذر تحديد وجهة المتابعة");if(t._portalPresentation=c.presentation||null,c.origin!==n.origin){if(!/^[A-Za-z0-9_-]{43}$/.test(c.ticket||""))throw new Error("تعذر تجهيز الانتقال الآمن");let m=i==="student"&&c.presentation?"/dashboard":"/portal-entry";return n.replace(`${c.origin}${m}#handoff=${encodeURIComponent(c.ticket)}`),!0}return i==="student"&&c.presentation?(n.replace("/dashboard"),!0):!1}function Xe(t){let r=t.getAppEl();r&&window.renderPortalOpening(r)}function X(t,r,i){let s=t.getAppEl();if(!s)return;let n=s.querySelector("#basic-sync-status");if(n){n.textContent=i?"تعذر التحديث؛ بياناتك المحفوظة متاحة":"";return}let e=s.querySelector("#portalCacheStatus");e||(e=document.createElement("div"),e.id="portalCacheStatus",e.setAttribute("role","status"),e.className="portal-sync",e.style.cssText="justify-content:flex-end;padding:8px 20px",e.innerHTML='<span aria-live="polite"></span><button type="button" aria-label="تحديث بياناتك"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M20 7v5h-5M4 17v-5h5"/><path d="M6.1 6.1A8 8 0 0 1 19.6 10M4.4 14A8 8 0 0 0 17.9 17.9"/></svg></button>',e.querySelector("button").addEventListener("click",async c=>{c.currentTarget.disabled=!0;try{await t.reloadStudentPortal()}finally{e.isConnected&&(e.querySelector("button").disabled=!1)}}),s.prepend(e));let o=new Date(r).toLocaleTimeString("ar-EG",{hour:"2-digit",minute:"2-digit"});e.querySelector("button").title="تحديث بياناتك • البيانات المحفوظة "+o,e.querySelector("span").textContent=i?"تعذر التحديث؛ بياناتك المحفوظة متاحة":""}function Ke(t="",r=""){let i=r,s="parent";if(typeof window<"u"){s=localStorage.getItem("centrly_portal_entry_role")==="student"?"student":"parent";let o=new URLSearchParams(window.location.search);i||(i=o.get("phone")||o.get("user")||o.get("identifier")||"");let c=o.get("role");c==="parent"?s="parent":(c==="student"||window.__teacherSubdomain)&&(s="student")}let n=s==="student",e=t?`<div id="portalLoginAlert" style="padding: 0.75rem 1rem; border-radius: 0.65rem; margin-bottom: 1.25rem; font-size: 0.85rem; font-weight: 600; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; display: flex; align-items: center; gap: 0.5rem;">
        ${w("alert",18,"#b91c1c")}
        <span>${f(t)}</span>
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
            ${typeof window<"u"&&window.__teacherSubdomain==="mr-omar"?"منصة مستر عمر المحمدي — بوابة الطالب":n?"بوابة الطالب":"بوابة ولي الأمر"}
          </h1>
          <p id="portalSubheadingText" style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.5;">
            ${n?"سجّل دخولك لتحميل المذكرات، تسليم الواجبات، ومتابعة درجاتك":"سجّل دخولك لمتابعة الحضور والغياب، الدرجات، والواجبات"}
          </p>
        </div>

        <!-- Account Type Switcher Tabs -->
        <div style="display: flex; background: #f1f5f9; padding: 4px; border-radius: 0.75rem; margin-bottom: 1.5rem; gap: 4px; border: 1px solid #e2e8f0;">
          <button 
            type="button" 
            id="portalTabParent" 
            onclick="window.switchPortalLoginRole ? window.switchPortalLoginRole('parent') : (window.centrlyApp && window.centrlyApp.switchPortalLoginRole ? window.centrlyApp.switchPortalLoginRole('parent') : null)"
            style="flex: 1; padding: 0.65rem 0.5rem; border: none; border-radius: 0.55rem; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; background: ${n?"transparent":"#ffffff"}; color: ${n?"#64748b":"#1e3a8a"}; box-shadow: ${n?"none":"0 2px 6px rgba(0,0,0,0.08)"};"
          >
            <span>ولي أمر</span>
          </button>
          <button 
            type="button" 
            id="portalTabStudent" 
            onclick="window.switchPortalLoginRole ? window.switchPortalLoginRole('student') : (window.centrlyApp && window.centrlyApp.switchPortalLoginRole ? window.centrlyApp.switchPortalLoginRole('student') : null)"
            style="flex: 1; padding: 0.65rem 0.5rem; border: none; border-radius: 0.55rem; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; background: ${n?"#ffffff":"transparent"}; color: ${n?"#1d4ed8":"#64748b"}; box-shadow: ${n?"0 2px 6px rgba(0,0,0,0.08)":"none"};"
          >
            <span>طالب</span>
          </button>
        </div>

        ${e}

        <!-- Login Form -->
        <form id="portalLoginForm" onsubmit="window.centrlyApp && window.centrlyApp.handlePortalLogin ? window.centrlyApp.handlePortalLogin(event) : event.preventDefault()">
          
          <input type="hidden" id="portalRole" name="role" value="${n?"student":"parent"}">

          <div style="margin-bottom: 1.15rem;">
            <label id="portalIdentifierLabel" for="portalIdentifier" style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem;">
              ${n?"رقم هاتف الطالب أو كود الطالب":"رقم هاتف ولي الأمر أو كود الطالب"}
            </label>
            <div style="position: relative;">
              <input 
                type="text" 
                id="portalIdentifier" 
                name="identifier"
                class="form-input" 
                value="${f(i)}"
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
              ${n?"اكتب رقم هاتفك المسجل لدى المعلم أو كودك الشخصي":"اكتب رقم هاتف ولي الأمر أو كود الطالب"}
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
            <span id="portalSubmitBtnText">${n?"دخول بوابة الطالب":"دخول بوابة ولي الأمر"}</span>
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
  `}function qe(t){Ye(t),t.loadStudentPortal=async function(i,s={}){window.__centrlyLoaded=!0,this._studentPortalToken=i;try{typeof localStorage<"u"&&i&&(localStorage.setItem("centrly_portal_token",i),localStorage.setItem("centrly_portal_role","student")),typeof sessionStorage<"u"&&i&&(sessionStorage.setItem("centrly_portal_token",i),sessionStorage.setItem("centrly_portal_role","student")),window.history&&window.history.replaceState&&(window.location.pathname!=="/portal"||window.location.search||window.location.hash)&&window.history.replaceState(null,"",window.location.pathname==="/portal-entry"?"/portal-entry":"/portal?role=student")}catch{}let n=e=>{let o=e.features?.teaching_platform!==!0;Array.isArray(e.materials)||(e.materials=[]),Array.isArray(e.quizzes)||(e.quizzes=[]),e.materials.filter(m=>!o&&m.type==="online_quiz").forEach(m=>{let l={};try{l=typeof m.questions=="string"?JSON.parse(m.questions):m.questions||{}}catch{}let d=Array.isArray(l.questions)?l.questions:[],p=Number(l.quiz_number)||1,h=d.reduce((g,v)=>g+Number(v.points||1),0)||10;e.quizzes.some(g=>g.id===m.id||Number(g.quiz_number)===p)||e.quizzes.push({id:m.id,title:m.title||`كويز ${p}`,quiz_number:p,max_score:h,quiz_date:l.available_date||m.created_date||"",questions:d})});let c=this.getAppEl();if(c){let m=typeof localStorage<"u"&&localStorage.getItem("centrly_portal_student_tab")||typeof sessionStorage<"u"&&sessionStorage.getItem("centrly_portal_student_tab")||"dashboard";c.innerHTML=o?Ze(e,m):le(e,m);let l=e&&e.student&&(e.student.id||e.student.student_code||e.student.code||e.student.student_phone)?String(e.student.id||e.student.student_code||e.student.code||e.student.student_phone).trim():"";if(typeof window<"u"&&l){if(window._centrlyCurrentStudentId=l,e&&e.student){window._centrlyCurrentStudent=e.student;try{localStorage.setItem("centrly_current_student",JSON.stringify({id:e.student.id,student_code:e.student.student_code||e.student.code||l,name:e.student.name,student_phone:e.student.student_phone||e.student.phone}))}catch{}}try{localStorage.setItem("centrly_portal_last_id",l)}catch{}}setTimeout(()=>{!o&&typeof window<"u"&&window.openStudentPortalTour&&window.openStudentPortalTour(!1,l)},500)}};try{let e=await L.read(i,"student");if(e?(n(e.data),X(this,e.savedAt,!1)):Xe(this),(!e?.fresh||s.force||window.__centrlyPortalArrival)&&await Me(this,i,"student",W))return;let o=await L.load(i,{request:W,force:s.force===!0,onData:(c,m)=>{(!m.cached||!e)&&n(c),X(this,m.savedAt,!1)}});return X(this,o.savedAt,!!o.error),!o.error}catch(e){if(e?.code==="PORTAL_CACHE_INVALIDATED")return!1;if(e?.code==="PORTAL_SESSION_CHANGED")return this.renderPortalLogin("تغيّرت جلسة المتابعة. سجّل الدخول مجددًا."),!1;let o=e?.message||"";if((e?.status===401||e?.status===403||o.includes("غير صالح")||o.includes("منتهي")||o.includes("UNAUTHORIZED"))&&!o.includes("Failed to fetch")&&!o.includes("NetworkError")&&!o.includes("Failed to execute")){L.clear("student");try{localStorage.removeItem("centrly_portal_token"),localStorage.removeItem("centrly_portal_role"),sessionStorage.removeItem("centrly_portal_token"),sessionStorage.removeItem("centrly_portal_role")}catch{}this.renderPortalLogin("انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً");return}let m=await L.read(i,"student");if(m)return n(m.data),X(this,m.savedAt,!0),!1;let l=this.getAppEl();l&&(l.innerHTML=le({error:o||"تعذر تحميل بيانات بوابة الطالب. يرجى التحقق من صحة الرابط."}))}},t.reloadStudentPortal=async function(){this._studentPortalToken?await this.loadStudentPortal(this._studentPortalToken,{force:!0})&&this.showToast("تم تحديث بيانات الطالب بنجاح!","success"):window.location.reload()},t.renderPortalLogin=function(i=""){window.__centrlyLoaded=!0,this.currentRoute="portal";let s=this.getAppEl();if(s){let n=this._portalPresentation||he(),o=!(new URLSearchParams(window.location.search).get("role")==="student")&&(this._parentPortalToken||localStorage.getItem("centrly_portal_entry_role")==="parent");s.innerHTML=o?be(i,n):Ke(i)}window.history?.replaceState&&(window.location.pathname!=="/portal"||window.location.search||window.location.hash)&&window.history.replaceState(null,"",window.location.search?`/portal${window.location.search}`:"/portal")},t.switchPortalLoginRole=function(i){let s=i==="student",n=document.getElementById("portalTabParent"),e=document.getElementById("portalTabStudent"),o=document.getElementById("portalHeadingText"),c=document.getElementById("portalSubheadingText"),m=document.getElementById("portalRole"),l=document.getElementById("portalIdentifierLabel"),d=document.getElementById("portalIdentifierHelp"),p=document.getElementById("portalSubmitBtnText");if(m&&(m.value=s?"student":"parent"),n&&e&&(s?(e.style.background="#ffffff",e.style.color="#1d4ed8",e.style.boxShadow="0 2px 6px rgba(0,0,0,0.08)",n.style.background="transparent",n.style.color="#64748b",n.style.boxShadow="none"):(n.style.background="#ffffff",n.style.color="#1e3a8a",n.style.boxShadow="0 2px 6px rgba(0,0,0,0.08)",e.style.background="transparent",e.style.color="#64748b",e.style.boxShadow="none")),o&&(o.textContent=s?"بوابة الطالب":"بوابة ولي الأمر"),c&&(c.textContent=s?"سجّل دخولك لتحميل المذكرات، تسليم الواجبات، ومتابعة درجاتك":"سجّل دخولك لمتابعة الحضور والغياب، الدرجات، والواجبات"),l&&(l.textContent=s?"رقم هاتف الطالب أو كود الطالب":"رقم هاتف ولي الأمر أو كود الطالب"),d&&(d.textContent=s?"اكتب رقم هاتفك المسجل لدى المعلم أو كودك الشخصي":"اكتب رقم هاتف ولي الأمر أو كود الطالب"),p&&(p.textContent=s?"دخول بوابة الطالب":"دخول بوابة ولي الأمر"),window.history?.replaceState){let h=new URL(window.location.href);h.searchParams.set("role",s?"student":"parent"),window.history.replaceState(null,"",h.pathname+h.search)}},t.togglePortalPasswordVisibility=function(i,s){this.togglePasswordVisibility("portalPassword",i,s)},t.handlePortalLogin=async function(i){i&&i.preventDefault&&i.preventDefault();let s=document.getElementById("portalIdentifier"),n=document.getElementById("portalPassword"),e=document.getElementById("portalRememberMe"),o=document.getElementById("portalSubmitBtn"),c=document.getElementById("portalSubmitSpinner"),m=document.getElementById("portalLoginAlert"),l=document.getElementById("portalRole");try{let d=s?de(s.value).trim():"",p=n?de(n.value).trim():"",h=l?l.value:"parent",a=e?e.checked:!0;if(!d||!p){m&&(m.hidden=!1,m.style.display="block",m.textContent="يرجى كتابة رقم الهاتف أو كود الطالب وكلمة المرور");return}o&&(o.disabled=!0),c&&(c.style.display="inline"),m&&(m.style.display="none");let g=await W("/public/portal/login",{method:"POST",body:{identifier:d,password:p,role:h}});if(g&&g.success&&g.token){re();let v=h==="student"||h==="parent"?h:g.role||"parent";try{localStorage.removeItem("centrly_explicit_logout"),(localStorage.getItem("centrly_portal_token")!==g.token||localStorage.getItem("centrly_portal_role")!==v)&&(L.clear("student"),L.clear("parent")),localStorage.setItem("centrly_portal_token",g.token),localStorage.setItem("centrly_portal_role",v),sessionStorage.setItem("centrly_portal_token",g.token),sessionStorage.setItem("centrly_portal_role",v),v==="parent"&&g.students&&g.students.length>1?(localStorage.setItem("centrly_parent_students",JSON.stringify(g.students)),sessionStorage.setItem("centrly_parent_students",JSON.stringify(g.students))):v==="student"&&(localStorage.removeItem("centrly_parent_students"),sessionStorage.removeItem("centrly_parent_students"))}catch{}this.showToast("مرحباً بك! تم تسجيل الدخول بنجاح","success");try{window.history&&window.history.replaceState&&window.history.replaceState(null,"","/portal?role="+v)}catch{}v==="student"?await this.loadStudentPortal(g.token):await this.loadParentPortal(g.token)}else throw new Error(g?.error?.message||"تعذر تسجيل الدخول. يرجى التأكد من البيانات.")}catch(d){console.error("Portal login error:",d);let p=d?.message||"تعذر تسجيل الدخول. يرجى التأكد من البيانات.";m?(m.hidden=!1,m.style.display="block",m.textContent=p):this.renderPortalLogin(p)}finally{o&&(o.disabled=!1),c&&(c.style.display="none")}},t.handlePortalLogout=function(){re();let i=localStorage.getItem("centrly_portal_role");i==="parent"&&ye(this._portalPresentation),localStorage.setItem("centrly_portal_entry_role",i||"parent"),L.clear("student"),L.clear("parent");try{localStorage.removeItem("centrly_portal_token"),localStorage.removeItem("centrly_portal_role"),localStorage.removeItem("centrly_parent_students"),sessionStorage.removeItem("centrly_portal_token"),sessionStorage.removeItem("centrly_portal_role"),sessionStorage.removeItem("centrly_student_portal_token"),sessionStorage.removeItem("centrly_parent_students")}catch{}this._parentPortalToken=null,this._parentPortalRenderedToken=null,this._studentPortalToken=null,this.showToast("تم تسجيل الخروج بنجاح","info"),this.renderPortalLogin()},t.switchParentChild=async function(i){try{let s=localStorage.getItem("centrly_parent_students");if(!s)return;let e=JSON.parse(s).find(o=>o.id===i);e&&e.token&&await this.loadParentPortal(e.token,{force:!0})}catch(s){console.error("switchParentChild error:",s)}},t.downloadStudentCardPng=function(i){ae(i)},t.openFullscreenBarcode=function(i){se(i)},t.compressImageFile=async function(i,s=1600,n=.72){return new Promise(e=>{if(!(i&&i.type&&i.type.startsWith("image/")||i&&i.name&&/\.(jpg|jpeg|png|webp|bmp|heic)$/i.test(i.name))){e(null);return}let c=new FileReader;c.onerror=()=>e(null),c.onload=m=>{let l=new Image;l.onerror=()=>e(null),l.onload=()=>{try{let{width:d,height:p}=l;(d>s||p>s)&&(d>p?(p=Math.round(p*s/d),d=s):(d=Math.round(d*s/p),p=s));let h=document.createElement("canvas");h.width=d,h.height=p;let a=h.getContext("2d");if(!a){e(null);return}a.drawImage(l,0,0,d,p);let g=h.toDataURL("image/jpeg",n),v=Math.round(g.length*3/4);v>800*1024&&(g=h.toDataURL("image/jpeg",.55),v=Math.round(g.length*3/4)),e({data:g,size:v,name:(i.name||"homework").replace(/\.[^/.]+$/,"")+".jpg"})}catch{e(null)}},l.src=m.target.result},c.readAsDataURL(i)})},t.handleStudentHomeworkUpload=async function(i,s){if(!s)return;let n=document.getElementById(`hw-file-input-${i}`),e=()=>{n&&(n.value="")},o=s.type&&s.type.includes("pdf")||s.name&&s.name.toLowerCase().endsWith(".pdf"),c=s.type&&s.type.startsWith("image/")||s.name&&/\.(jpg|jpeg|png|webp|heic|bmp)$/i.test(s.name);if(!o&&!c){e(),this.showToast("يرجى رفع ملف الواجب بصيغة PDF أو صورة واضحة (JPG / PNG / WEBP).","warning");return}if(s.size>25*1024*1024){e(),this.showToast("حجم الملف يتجاوز الحد الأقصى المسموح به (25 ميجابايت). يرجى ضغط الملف أو تقليل دقة الصور.","warning");return}let m=this._studentPortalToken||this._parentPortalToken||(typeof localStorage<"u"?localStorage.getItem("centrly_portal_token"):null)||(typeof sessionStorage<"u"?sessionStorage.getItem("centrly_portal_token"):null)||new URLSearchParams(window.location.search).get("token")||(typeof sessionStorage<"u"?sessionStorage.getItem("centrly_student_portal_token"):null)||"";if(!m){e(),this.showToast("تعذر التحقق من رمز الطالب أو ولي الأمر. يرجى إعادة فتح الرابط والمحاولة مرة أخرى.","danger");return}let l=document.getElementById(`hw-upload-btn-${i}`),d=l?l.innerHTML:"";l&&(l.disabled=!0,l.innerHTML="<span>جارٍ معالجة الملف...</span>");try{let p=null,h=s.name,a=s.size;if(c){l&&(l.innerHTML="<span>جارٍ تجهيز وضغط الصورة للرفع السريع...</span>");let v=await this.compressImageFile(s,1280,.68);v&&v.data&&(p=v.data,h=v.name,a=v.size)}p||(l&&(l.innerHTML="<span>جارٍ قراءة الملف...</span>"),p=await new Promise((v,b)=>{let y=new FileReader;y.onload=x=>v(x.target.result),y.onerror=()=>b(new Error("تعذر قراءة الملف من جهازك")),y.readAsDataURL(s)})),l&&(l.innerHTML="<span>جارٍ بدء الرفع (0%)...</span>"),await new Promise((v,b)=>{let y=new XMLHttpRequest;y.open("POST",`${D}/public/homework/submit`),y.setRequestHeader("Content-Type","application/json");let x=(a/(1024*1024)).toFixed(1);y.upload.onprogress=_=>{if(_.lengthComputable&&l){let A=Math.min(99,Math.round(_.loaded/_.total*100)),S=(_.loaded/(1024*1024)).toFixed(1);l.innerHTML=`<span>جارٍ الرفع (${A}% • ${S}/${x} ميجا)...</span>`}},y.upload.onload=()=>{l&&(l.innerHTML="<span>تم الرفع 100%! جارٍ حفظ وتأكيد الواجب في السحابة...</span>")},y.onload=()=>{l&&(l.innerHTML="<span>جارٍ معالجة وحفظ الواجب في السحابة...</span>");let _={};try{_=JSON.parse(y.responseText)}catch{}if(y.status>=200&&y.status<300)v(_);else{let A=_?.error?.message||`فشل حفظ الواجب (${y.status})`;b(new Error(A))}},y.onerror=()=>b(new Error("انقطع الاتصال بالإنترنت أثناء الرفع. يرجى التأكد من استقرار الشبكة والمحاولة مجدداً")),y.ontimeout=()=>b(new Error(`استغرق رفع الملف (${x} ميجا) وقتاً طويلاً بسبب بطء سرعة الرفع لديك. يرجى الاتصال بشبكة أسرع أو تقليل حجم الملف والمحاولة مرة أخرى`));let k=Math.min(9e5,Math.max(36e4,Math.round(a/(25*1024)*1e3)+12e4));y.timeout=k,y.send(JSON.stringify({token:m,material_id:i,file_data:p,file_name:h,file_size:a}))}),this.showToast("تم رفع حل الواجب بنجاح وإرساله لمعلمك للمراجعة.","success"),e(),((typeof localStorage<"u"?localStorage.getItem("centrly_portal_role"):null)||(this._parentPortalToken?"parent":"student"))==="parent"&&this.loadParentPortal?await this.loadParentPortal(m):await this.loadStudentPortal(m)}catch(p){console.error("Homework upload error:",p),this.showToast(`فشل رفع الواجب: ${p.message||"حدث خطأ في الاتصال"}`,"danger"),e(),l&&(l.disabled=!1,l.innerHTML=d)}}}async function xn(){let t={getAppEl:()=>document.getElementById("app"),renderLanding:()=>location.assign("/"),showToast(e){document.getElementById("student-portal-toast")?.remove();let o=document.createElement("div");o.id="student-portal-toast",o.setAttribute("role","status"),o.textContent=e,o.style.cssText="position:fixed;bottom:20px;inset-inline:20px;margin:auto;max-width:440px;padding:12px 16px;background:#172d70;color:#fff;border-radius:12px;z-index:10000;text-align:center",document.body.append(o),setTimeout(()=>o.remove(),4e3)},togglePasswordVisibility(e,o,c){c?.preventDefault();let m=document.getElementById(e);if(!m)return;let l=m.type==="password";m.type=l?"text":"password",o?.setAttribute("aria-pressed",String(l)),o?.setAttribute("aria-label",l?"إخفاء كلمة المرور":"إظهار كلمة المرور")}};qe(t),window.centrlyApp=t,window.switchPortalLoginRole=e=>t.switchPortalLoginRole(e),window.togglePasswordVisibility=(...e)=>t.togglePasswordVisibility(...e);let r=new URLSearchParams(location.search),i=window.__centrlyPortalArrival,s=localStorage.getItem("centrly_portal_role")||sessionStorage.getItem("centrly_portal_role");if((r.get("role")==="student"||r.get("portal")==="student"||i?.role==="student"||s==="student")&&localStorage.setItem("centrly_portal_entry_role","student"),i?.role==="student"&&i.origin===location.origin)return await t.loadStudentPortal(i.token),t;let n=r.get("token")||s==="student"&&(localStorage.getItem("centrly_portal_token")||sessionStorage.getItem("centrly_portal_token"));return r.has("token")&&r.get("portal")!=="student"&&r.get("role")!=="student"?await t.loadParentPortal(n):n?await t.loadStudentPortal(n):t.renderPortalLogin(),t}export{xn as mountStudentPortal};
