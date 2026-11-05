import { request } from '../services/api.js?v=9.44.0';
import { escapeHtml as e } from '../utils/escapeHtml.js?v=9.44.0';

const money = p => (Number(p || 0) / 100).toLocaleString('ar-EG', { maximumFractionDigits: 2 }) + ' ج.م';
const number = n => Number(n || 0).toLocaleString('ar-EG',Number(n)>0 && Number(n)<1?{maximumSignificantDigits:3}:{maximumFractionDigits:2});
const date = value => value ? new Date(value).toLocaleDateString('ar-EG', { timeZone: 'Africa/Cairo' }) : '—';
const action = (label, call, primary = false) => `<button type="button" class="btn ${primary ? 'btn-primary' : 'btn-secondary'}" style="min-height:44px" onclick="window.centrlyApp.${call}">${label}</button>`;
const names = { subscribe: 'اشتراك', renew: 'تجديد', upgrade: 'ترقية', students: 'مقاعد طلاب', assistants: 'مساعدون', storage: 'مساحة ملفات', wallet: 'شحن محفظة' };
const states = { quoted: 'في انتظار بيانات الدفع', submitted: 'قيد مراجعة الدفع', approved: 'تم الاعتماد', rejected: 'مرفوض', cancelled: 'ملغي' };
function meter(label, used, limit, suffix = '') {
  if (used == null || limit == null || !Number.isFinite(Number(used)) || !Number.isFinite(Number(limit))) return `<article class="card commercial-meter"><h3>${label}</h3><p>تعذر قراءة الاستخدام حاليًا؛ أعد التحديث.</p></article>`;
  const raw = Number(limit)>0 ? Number(used)/Number(limit)*100 : Number(used)>0?100:0;
  const pct = Math.min(100, Math.max(0, raw)), status=raw>=95?'قرب الامتلاء':raw>=80?'استهلاك مرتفع':'استهلاك طبيعي';
  return `<article class="card commercial-meter" data-level="${raw>=95?'danger':raw>=80?'warning':'normal'}"><div><h3>${label}</h3><strong>${number(used)} <small>من ${number(limit)} ${suffix}</small></strong><p>المتبقي: ${number(Math.max(0, Number(limit)-Number(used)))} ${suffix}</p><span class="usage-status">${status}</span></div><div class="usage-ring" role="progressbar" aria-label="${label}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(pct)}" aria-valuetext="${number(raw)}٪، ${status}" style="--usage:${pct}%"><span>${number(Math.round(raw))}٪</span></div></article>`;
}
export function renderCommercialWallet(wallet) {
  if (!wallet) return '';
  return `<button type="button" class="btn btn-secondary commercial-wallet" onclick="window.centrlyApp.commercialOpenWallet()" aria-haspopup="dialog"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" aria-hidden="true"><path d="M20 8V5H5a2 2 0 0 0 0 4h16v11H5a2 2 0 0 1-2-2V7"/><path d="M21 12h-5v5h5"/></svg><span>المحفظة</span><strong>${money(Number(wallet.paid_piasters)+Number(wallet.gift_piasters))}</strong></button>`;
}

export function renderCommercialBillingView(data = {}) {
  const c = data.commercial;
  if (!c) return `<section class="card" dir="rtl"><h1>اشتراكك واستخدامك</h1><p role="status">جار قراءة الباقات والاستخدام…</p>${action('إعادة المحاولة', "loadRouteData('billing')")}</section>`;
  const l = c.limits, catalog = c.catalog || [], current = !l.is_trial && catalog.find(p => p.id === l.plan_id), usedGB = c.storage_bytes_used == null ? null : c.storage_bytes_used / 1e9;
  return `<div class="commercial-billing" dir="rtl"><style>
    .commercial-billing{display:grid;gap:1rem;min-width:0}.commercial-grid{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:1rem}.commercial-billing .card{margin:0;min-width:0}.commercial-meter h3{font-size:1rem}.commercial-meter strong{font-size:1.6rem}.commercial-meter small{font-size:.85rem;font-weight:400}.commercial-order{padding:.9rem 0;border-bottom:1px solid var(--centrly-line);overflow-wrap:anywhere}.commercial-plan{display:flex;flex-direction:column;gap:.7rem}.commercial-plan ul{padding-inline-start:1.2rem;line-height:2}.commercial-plan button{margin-top:auto}.commercial-billing p{line-height:1.8}.commercial-billing input,.commercial-billing select{min-height:44px}@media(max-width:800px){.commercial-grid{grid-template-columns:1fr}}@media(prefers-reduced-motion:reduce){.commercial-billing *{scroll-behavior:auto}}
  </style><section class="card" style="background:var(--centrly-ink);color:white"><div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;flex-wrap:wrap"><div><p>مساحة واضحة لنمو شغلك</p><h1 style="font-size:1.8rem;color:inherit">${l.is_trial ? 'تجربة مجانية ٧ أيام' : current ? e(current.name) : 'اشتراكك في سنترلي'}</h1><p>${l.is_trial ? 'تجربة سارية' : l.active ? 'مفعّلة الآن' : 'راجع الاشتراك للتفعيل'} · نهاية الدورة ${date(l.period_end)}</p>${l.legacy ? '<p>حسابك على خطة سابقة. سعتها محفوظة حتى تختار خطة جديدة وتراجع استخدامها.</p>' : `<p>التكلفة الدورية الحالية ${money(l.recurring_piasters)}</p>`}</div>${action('تحديث الاستخدام', "loadRouteData('billing')")}</div></section>
  ${(c.periods || []).some(p=>Date.parse(p.starts_at)>Date.now()) ? `<section class="card"><h2 style="font-size:1.15rem">دورات مدفوعة مقدمًا</h2><p>إضافات السعة والترقية تخص الدورة الحالية. الدورات المدفوعة مقدمًا تحتفظ بالباقة والسعة المسجلة لها، وإلغاء الإضافة يسري من أول تجديد لم يتم دفعه بعد.</p>${c.periods.filter(p=>Date.parse(p.starts_at)>Date.now()).map(p=>`<p>${e(catalog.find(plan=>plan.id===p.plan_id)?.name || p.plan_id)} · من ${date(p.starts_at)} إلى ${date(p.ends_at)}</p>`).join('')}</section>`:''}
  <section class="commercial-grid" aria-label="استخدام الباقة">${meter('الطلاب النشطون', c.students_used, l.students)}${meter('مساحة الملفات', usedGB, l.storage_bytes / 1e9, 'جيجا')}${meter('المساعدون', c.assistants_used, l.assistants)}</section>
  <section class="card"><h2 style="font-size:1.2rem">زود السعة وقت ما تحتاج</h2><p>الإضافات شهرية. تدفع نسبة المدة المتبقية الآن، والقيمة الكاملة مع التجديد. المقعد الإضافي في أول دورة حدّه الأدنى ٦٠ قرشًا.</p><div class="commercial-addon-grid"><article><h3>مقاعد طلاب</h3><p>حسب سعر الطالب الإضافي في باقتك</p>${action('إضافة مقاعد طلاب', "commercialAdd('students')")}</article><article><h3>مساعد إضافي</h3><p>٥٠ ج / شهر لكل مساعد</p>${action('إضافة مساعد', "commercialAdd('assistants')")}</article><article><h3>مساحة ملفات</h3><p>٥ جيجا إضافية · ٥٠ ج / شهر</p>${action('إضافة مساحة', "commercialAdd('storage')")}</article></div>${(c.addons || []).filter(a => a.quantity > 0).map(a => `<div class="commercial-order">${e(names[a.kind])}: ${number(a.quantity)} ${a.cancel_on_renew ? `· تتوقف من أول تجديد غير مدفوع ${action('الإبقاء مع التجديد', `commercialResumeAddon('${e(a.kind)}')`)}` : action('إلغاء من أول تجديد غير مدفوع', `commercialCancelAddon('${e(a.kind)}')`)}</div>`).join('')}</section>
  <section id="pricingPlansSection"><h2 style="font-size:1.25rem">اختار المساحة المناسبة لك</h2><div class="commercial-grid">${catalog.map(p => `<article class="card commercial-plan" style="border:${p.id === l.plan_id ? '2px solid var(--centrly-blue-700)' : '1px solid var(--centrly-line)'}"><div style="display:flex;justify-content:space-between;gap:.5rem"><h3>${e(p.name)}</h3><span>${p.id === l.plan_id && !l.is_trial && l.active ? 'باقتك الحالية' : ''}</span></div><strong style="font-size:2rem">${money(p.price_piasters)} <small style="font-size:.8rem">/ ٣٠ يومًا</small></strong><span>اشتراك شهري · سعة تناسب شغلك</span><ul><li>${number(p.students)} طالب نشط</li><li>${number(p.storage_bytes / 1e9)} جيجا ملفات</li><li>${number(p.assistants)} مساعدين بصلاحيات محددة</li><li>كل أدوات الإدارة ومتابعة الأسرة</li>${p.teaching_platform ? '<li>منصة بهوية المدرس ورابط فرعي</li><li>مذكرات وروابط فيديو وتسليم واجبات</li><li>اختبارات أونلاين</li>' : '<li>بوابة متابعة سنترلي للطالب والأسرة</li>'}${p.initial_gift_piasters ? `<li>هدية أول اشتراك ${money(p.initial_gift_piasters)}</li>` : ''}${p.renewal_gift_piasters ? `<li>رصيد ${money(p.renewal_gift_piasters)} مع كل تجديد بعد الأول</li>` : ''}</ul><p>الطالب الإضافي ${money(p.student_piasters)} شهريًا</p>${action(p.id === l.plan_id && !l.is_trial ? 'تجديد الاشتراك' : current && l.active && p.rank < current.rank ? 'اختيار للتجديد التالي' : current && l.active ? 'ترقية الباقة' : 'اختيار الباقة', `commercialPlan('${e(p.id)}')`, p.rank === 3)}</article>`).join('')}</div></section>

  <section class="card"><h2 style="font-size:1.2rem">طلبات الدفع</h2>${(c.orders || []).filter(o=>o.kind!=='wallet').map(o => `<article class="commercial-order"><strong>${e(names[o.kind])} · ${money(o.amount_piasters)}</strong><p>${e(states[o.state])} · ${date(o.created_at)}</p>${o.state === 'quoted' && Date.parse(o.quoted_until) > Date.now() ? action('استكمال بيانات الدفع', `commercialOpenOrder('${e(o.id)}')`) : ''}</article>`).join('') || '<p>لا توجد طلبات دفع بعد.</p>'}</section>
  </div>`;
}
export function registerCommercialBillingActions(app) {
  const actor = () => app.user?.id;
  const fail = error => app.showToast(error.message || 'تعذر إتمام الطلب', 'error');
  app.commercialOpenWallet = function() {
    if(this.delegation)return;
    const wallet=this.announcementsData?.wallet;
    if(!wallet)return;
    this.showModal('محفظة الرسائل',`<div class="wallet-details"><h2>محفظة الرسائل</h2><dl><div><dt>الرصيد المشحون</dt><dd>${money(wallet.paid_piasters)}</dd></div><div><dt>الهدية المتاحة</dt><dd>${money(wallet.gift_piasters)}</dd></div><div><dt>محجوز للإرسال</dt><dd>${money(wallet.held_piasters)}</dd></div></dl><p>الرسالة ${money(wallet.message_piasters)} لكل رقم مصري. فتح واتساب يدويًا لا يخصم رصيدًا. الهدية لا تترحل، والرصيد المشحون يظل محفوظًا.</p>${action('شحن المحفظة',"commercialAdd('wallet')",true)} ${action('الحركات وطلبات الشحن', 'commercialWalletHistory()')}</div>`);
  };
  app.commercialWalletHistory = async function() {
    if(this.delegation)return;
    const identity=actor();
    this.showModal('حركات المحفظة وطلبات الشحن','<p role="status">جار قراءة التفاصيل…</p>');
    try {
      const c=await request('/billing/commercial');
      if(actor()!==identity || this.currentRoute && this.currentRoute!=='announcements')return;
      this.billingState={...this.billingState,commercial:{...this.billingState?.commercial,...c}};
      this.showModal('حركات المحفظة وطلبات الشحن',`<div class="wallet-history"><h3>طلبات الشحن</h3>${(c.orders || []).filter(o=>o.kind==='wallet').map(o=>`<article class="commercial-order"><strong>${money(o.amount_piasters)}</strong><p>${e(states[o.state])} · ${date(o.created_at)}</p>${o.state==='quoted' && Date.parse(o.quoted_until)>Date.now()?action('استكمال بيانات الدفع',`commercialOpenOrder('${e(o.id)}')`):''}</article>`).join('') || '<p>لا توجد طلبات شحن بعد.</p>'}<h3>آخر الحركات</h3>${(c.ledger || []).slice(0,20).map(row=>`<p>${e(({topup:'شحن',gift:'هدية',reserve:'حجز إرسال',release:'تحرير حجز',debit:'خصم إرسال'})[row.kind] || row.kind)} · ${money(row.amount_piasters)} · ${date(row.created_at)}</p>`).join('') || '<p>لا توجد حركات بعد.</p>'}</div>`);
    }catch(error){if(actor()===identity)this.showModal('تعذر قراءة المحفظة',`<p role="alert">${e(error.message)}</p>`);}
  };
  app.commercialPlan = async function (planId) {
    const c = this.billingState?.commercial, current = c?.catalog.find(p => p.id === c.limits.plan_id), target = c?.catalog.find(p => p.id === planId);
    if (!target) return;
    try {
      if (current && !c.limits.is_trial && c.limits.active && target.rank < current.rank) {
        await request('/billing/commercial/schedule-plan', { method: 'POST', body: { plan_id: planId } });
        this.showToast('تم تحديد الباقة المطلوبة للتجديد التالي؛ راجع السعة قبل الدفع', 'success');
        await this.loadRouteData('billing'); return;
      }
      await this.commercialQuote({ kind: c?.limits.is_trial ? 'subscribe' : current ? target.id === current.id ? 'renew' : c.limits.active ? 'upgrade' : 'subscribe' : 'subscribe', plan_id: planId });
    } catch (error) { fail(error); }
  };
  app.commercialAdd = function (kind) {
    if (!['students', 'assistants', 'storage', 'wallet'].includes(kind)) return;
    this.showModal(names[kind], `<form onsubmit="window.centrlyApp.commercialQuantity(event,'${kind}')" style="display:grid;gap:1rem"><label>${kind === 'wallet' ? 'مبلغ الشحن بالجنيه' : kind === 'storage' ? 'عدد إضافات المساحة؛ كل إضافة ٥ جيجا' : kind === 'assistants' ? 'عدد المساعدين الإضافيين' : 'عدد مقاعد الطلاب الإضافية'}<input id="commercialQuantity" class="form-input" type="number" min="${kind === 'wallet' ? 50 : 1}" max="${kind === 'wallet' ? 100000 : 10000}" step="1" value="${kind === 'wallet' ? 50 : 1}" required></label><p>لن يتفعل رصيد أو سعة قبل اعتماد الدفع. ستراجع السعر المحسوب قبل التحويل.</p><button class="btn btn-primary" type="submit" style="min-height:44px">حساب التكلفة</button></form>`);
  };
  app.commercialQuantity = async function (event, kind) {
    event.preventDefault(); const value = Number(document.getElementById('commercialQuantity')?.value);
    if (!Number.isSafeInteger(value) || value < (kind === 'wallet' ? 50 : 1)) return;
    await this.commercialQuote({ kind, quantity: kind === 'wallet' ? value * 100 : value, plan_id: this.billingState?.commercial?.limits.plan_id || 'basic_v1' });
  };
  app.commercialQuote = async function (input) {
    if (this._commercialQuoting) return;
    this._commercialQuoting = true;
    const identity = actor();
    try {
      const order = await request('/billing/commercial/orders', { method: 'POST', body: { id: crypto.randomUUID(), ...input } });
      if (actor() !== identity) return;
      this._commercialOrder = order; this._commercialReceipt = null; this.commercialOpenOrder(order.id);
    } catch (error) { if (actor() === identity) fail(error); } finally { this._commercialQuoting = false; }
  };
  app.commercialOpenOrder = function (id) {
    const order = this._commercialOrder?.id === id ? this._commercialOrder : this.billingState?.commercial?.orders.find(o => o.id === id);
    if (!order) return;
    this._commercialOrder = order; this._commercialReceipt = null; this._commercialReceiptRead = null;
    const p = order.snapshot.plan, a = order.snapshot.addons;
    const recurring = p.price_piasters + Number(a.students || 0) * p.student_piasters + Number(a.assistants || 0) * 5000 + Number(a.storage || 0) * 5000;
    this.showModal('راجع طلبك قبل الدفع', `<form id="commercialProofForm" onsubmit="window.centrlyApp.commercialSubmit(event)" style="display:grid;gap:1rem"><strong>${e(names[order.kind])} · ${e(p.name)}</strong><p>المطلوب الآن <strong>${money(order.amount_piasters)}</strong></p>${order.kind !== 'wallet' ? `<p>التجديد الدوري بعد اعتماد الطلب ${money(recurring)}. تغيير السعة أو الباقة يعيد حساب الطلب.</p>${Object.entries(a).filter(([,quantity])=>Number(quantity)>0).map(([kind,quantity])=>`<p>${e(names[kind])}: ${number(quantity)} إضافة شهرية${kind==='storage'?'، كل إضافة ٥ جيجا':''}</p>`).join('')}<p>الإضافات المحسوبة تحافظ على سعتك واستخدامك الحالي. راجع الإجمالي قبل التحويل.</p>` : '<p>الشحن مخصص للرسائل والإعلانات؛ الرسالة جنيه واحد لكل رقم مصري.</p>'}<p>صلاحية حساب السعر حتى ${new Date(order.quoted_until).toLocaleTimeString('ar-EG', { timeZone: 'Africa/Cairo' })}. بعد تسجيل الدفع يظل الطلب محفوظًا للمراجعة.</p><div class="card" style="margin:0"><p>بيانات التحويل الحالية لإنستاباي وفودافون كاش</p><strong dir="ltr">01010979708</strong></div><label>طريقة الدفع<select id="commercialMethod" class="form-select" style="min-height:44px"><option value="instapay">إنستاباي</option><option value="vodafone_cash">فودافون كاش</option></select></label><label>رقم عملية التحويل<input id="commercialReference" class="form-input" required minlength="3" maxlength="100" autocomplete="off"></label><label>صورة الإيصال، إن توفرت<input type="file" accept="image/png,image/jpeg,image/webp" onchange="window.centrlyApp.commercialReceipt(this)"></label><p id="commercialReceiptState" role="status"></p><p id="commercialProofError" role="alert"></p><button class="btn btn-primary" type="submit" style="min-height:44px">تسجيل الدفع للمراجعة</button></form>`);
  };
  app.commercialReceipt = async function (input) {
    this._commercialReceipt = null; this._commercialReceiptRead = null; const file = input.files?.[0], label = document.getElementById('commercialReceiptState');
    if (!file) return;
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type) || file.size > 2 * 1024 * 1024) { input.value = ''; if (label) label.textContent = 'اختر صورة PNG أو JPEG أو WebP حتى ٢ ميجابايت'; return; }
    const readId = {}; this._commercialReceiptRead = readId;
    if (label) label.textContent = 'جار تجهيز الإيصال…';
    const id = this._commercialOrder?.id, identity = actor();
    try { const value = await new Promise((resolve, reject) => { const reader = new FileReader(); reader.onload = () => resolve(reader.result); reader.onerror = reject; reader.readAsDataURL(file); }); if (actor() === identity && this._commercialOrder?.id === id && this._commercialReceiptRead === readId) { this._commercialReceipt = value; if (label) label.textContent = 'الإيصال جاهز للإرفاق'; } } catch { if (this._commercialReceiptRead === readId && label) label.textContent = 'تعذر قراءة الصورة'; } finally { if (this._commercialReceiptRead === readId) this._commercialReceiptRead = null; }
  };
  app.commercialSubmit = async function (event) {
    event.preventDefault(); const form = event.currentTarget, button = form.querySelector('button[type=submit]'), order = this._commercialOrder, identity = actor();
    if (!order || button.disabled) return;
    if (this._commercialReceiptRead) { const label = document.getElementById('commercialProofError'); if (label) { label.textContent = 'انتظر انتهاء تجهيز الإيصال'; label.tabIndex = -1; label.focus(); } return; }
    button.disabled = true;
    try {
      await request('/billing/commercial/orders/' + order.id + '/submit', { method: 'POST', body: { payment_method: document.getElementById('commercialMethod').value, reference: document.getElementById('commercialReference').value.trim(), ...(this._commercialReceipt ? { proof_image_url: this._commercialReceipt } : {}) } });
      if (actor() !== identity) return;
      this.closeModal(); this.showToast('تم تسجيل الدفع للمراجعة؛ لم يتغير رصيدك أو باقتك بعد', 'success'); this._commercialOrder = null; this._commercialReceipt = null; await this.loadRouteData(this.currentRoute==='announcements'?'announcements':'billing');
    } catch (error) { if (actor() === identity) { const label = document.getElementById('commercialProofError'); if (label) { label.textContent = error.message; label.tabIndex = -1; label.focus(); } button.disabled = false; } }
  };
  app.commercialResumeAddon = async function(kind) {try{await request('/billing/commercial/resume-addon',{method:'POST',body:{kind}});await this.loadRouteData('billing');}catch(error){fail(error);}};
  app.commercialCancelAddon = async function (kind) { try { await request('/billing/commercial/cancel-addon', { method: 'POST', body: { kind } }); await this.loadRouteData('billing'); } catch (error) { fail(error); } };
}
