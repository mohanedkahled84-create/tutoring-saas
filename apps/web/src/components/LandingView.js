import {trackProductEvent} from '../services/productFunnel.js?v=9.99.9';
import {renderApprovedLandingView as renderLandingView} from './ApprovedLandingView.js?v=9.99.9';
import {mountApprovedLandingView} from './ApprovedLandingActions.js?v=9.99.9';
export {renderLandingView};

export function registerLandingActions(app) {
  app.loadProductWalkthrough=async function(){
    const target=document.getElementById('product-walkthrough');if(!target)return;
    try{const module=await import('./ProductWalkthrough.js?v=9.99.9');if(!target.isConnected)return;module.registerWalkthroughActions(this);target.innerHTML=module.renderProductWalkthrough(this.landingDemoState);}
    catch{if(target.isConnected)target.innerHTML='<p style="padding:1rem">تعذر تحميل المثال. <button class="btn btn-secondary" onclick="window.centrlyApp.loadProductWalkthrough()">إعادة المحاولة</button></p>';}
  };
  // Official Landing / Welcome Page
  app.renderLanding = function renderLanding() {
    window.__centrlyLoaded = true;
    window.scrollTo(0, 0);
    document.title = 'سنترلي | منصتك بهويتك ومتابعة تطمّن وليّ الأمر';
    this._landingCleanup?.();
    const homeUrl=new URL(location.href);if(homeUrl.searchParams.has('view')){homeUrl.searchParams.delete('view');history.replaceState(null,'',homeUrl.pathname+homeUrl.search+homeUrl.hash);}
    const appEl = this.getAppEl();
    if (appEl) {
      appEl.innerHTML = renderLandingView();
      this._landingCleanup=mountApprovedLandingView(this,appEl.querySelector('#centrly-real'));
    }
    this.initCookieConsent();
    const policy=new URLSearchParams(location.search).get('policy');
    if(['terms','privacy'].includes(policy))this.openPolicyModal(policy);
    trackProductEvent('landing_view');
  }

  // Kashier Compliance & Legal Policies Modal Flow
  app.openPolicyModal = function openPolicyModal(type) {
    // Auth screens can replace the landing markup; their legal links still need a dialog.
    if(!document.getElementById('policyModalOverlay')){
      document.body.insertAdjacentHTML('beforeend',`<div id="policyModalOverlay" role="dialog" aria-modal="true" aria-labelledby="policyModalTitle" style="display:none;position:fixed;inset:0;background:#172d70b3;z-index:2000;align-items:center;justify-content:center;padding:20px"><section style="background:#fff;width:100%;max-width:680px;max-height:85vh;border-radius:16px;display:flex;flex-direction:column;overflow:hidden"><header style="display:flex;align-items:center;justify-content:space-between;gap:12px;padding:16px 20px;border-bottom:1px solid #e5e9f2"><h2 id="policyModalTitle" style="font-size:1.1rem;margin:0"></h2><button type="button" class="btn btn-secondary" style="min-width:44px;min-height:44px" onclick="window.centrlyApp.closePolicyModal()" aria-label="إغلاق المستند">×</button></header><div id="policyModalBody" style="overflow:auto;padding:20px;font-size:.9rem;line-height:1.9"></div></section></div>`);
    }
    const overlay = document.getElementById('policyModalOverlay');
    const titleEl = document.getElementById('policyModalTitle');
    const bodyEl = document.getElementById('policyModalBody');
    if (!overlay || !titleEl || !bodyEl) return;

    if (type === 'terms') {
      titleEl.innerText = 'شروط وأحكام الاستخدام (Terms of Service)';
      bodyEl.innerHTML = `
        <h4 style="color: #1e3a8a; margin-top: 0; font-weight: 800;">1. مقدمة وقبول الشروط</h4>
        <p>مرحباً بك في منصة <b>سنترلي (Centrly)</b>. باستخدامك لخدماتنا عبر هذا الموقع أو الاشتراك في باقاتنا، فإنك توافق على الالتزام الكامل بهذه الشروط والأحكام. إذا كنت لا توافق على أي بند، يرجى التوقف عن استخدام المنصة.</p>
        
        <h4 style="color: #1e3a8a; font-weight: 800;">2. وصف الخدمة</h4>
        <p>سنترلي هي منصة برمجية مصممة لإدارة وتطوير شؤون المعلمين المستقلين والمراكز التعليمية، وتشمل تسجيل حضور الطلاب عبر الباركود، وإصدار كروت الطلاب، وأتمتة إشعارات أولياء الأمور عبر الواتساب، ورصد الكويزات وبوابة المتابعة التفاعلية لولي الأمر.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">3. حسابات المستخدمين والمسؤولية</h4>
        <p>أنت مسؤول مسؤولية كاملة عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة بحسابك، وعن أي نشاط يصدر من خلاله. يتعهد المعلم أو إدارة السنتر بعدم استخدام الخدمة في أي غرض مخالف للقوانين المعمول بها في جمهورية مصر العربية.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">4. الاشتراكات والدفع</h4>
        <p>يتم تحصيل رسوم الاشتراك بالجنيه المصري (EGP) شهرياً وفقاً للباقة المختارة. تحتفظ المنصة بالحق في تعديل الأسعار مستقبلاً مع إخطار المشتركين مسبقاً قبل موعد التجديد بوقت كافٍ.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">5. الملكية الفكرية والبيانات</h4>
        <p>جميع حقوق الملكية الفكرية، التصاميم، العلامات التجارية، والبرمجيات الخاصة بـ سنترلي هي ملكية حصرية للمنصة، في حين تظل جميع بيانات الطلاب وأولياء الأمور ملكية حصرية للمدرس أو السنتر المشترك.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">6. خدمة رسائل الواتساب</h4>
        <p style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.85rem 1rem; color: #166534; font-size: 0.875rem; line-height: 1.8;">
          تتيح المنصة للمعلم والسنتر إرسال تقارير الحضور ودرجات الاختبارات وروابط المتابعة لأولياء الأمور بكفاءة وسلاسة، وتخضع الخدمة لسياسات الاستخدام العادل والتنظيم الذاتي للمراسلات التعليمية.
        </p>
      `;
    } else if (type === 'privacy') {
      titleEl.innerText = 'سياسة الخصوصية وحماية البيانات (Privacy Policy)';
      bodyEl.innerHTML = `
        <h4 style="color: #1e3a8a; margin-top: 0; font-weight: 800;">1. جمع واستخدام البيانات</h4>
        <p>نحن نحترم خصوصيتك وخصوصية بيانات طلابك بأعلى المعايير. نجمع فقط البيانات الضرورية لتشغيل الخدمة بكفاءة (مثل: اسم المعلم، أرقام هواتف الطلاب وأولياء الأمور، وسجلات الحضور والدرجات).</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">2. سرية وأمان البيانات المشفرة</h4>
        <p>تُخزّن جميع البيانات في قواعد بيانات مشفرة ومؤمنة بأحدث بروتوكولات الحماية (RLS Encryption). نحن نلتزم التزاماً قاطعاً بعدم بيع أو تأجير أو مشاركة أي بيانات تخص طلابك أو أرقام هواتفهم مع أي طرف ثالث أو استخدامها لأي أغراض إعلانية.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">3. إشعارات الواتساب</h4>
        <p>يتم إرسال الرسائل بناءً على طلب وتوجيه المعلم أو السنتر لإخطار أولياء الأمور فقط بمواعيد الحصص وحالة الحضور والدرجات، مع الالتزام التام بسياسات الاستخدام العادل.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">4. حقوق المستخدم</h4>
        <p>يحق للمشترك في أي وقت طلب تصدير كامل بياناته أو حذف حسابه وبيانات طلابه بالكامل من خوادمنا بمجرد تقديم طلب للدعم الفني.</p>
      `;
    } else if (type === 'refund') {
      titleEl.innerText = 'سياسة الاسترجاع واسترداد الأموال (Refund & Cancellation Policy)';
      bodyEl.innerHTML = `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; color: #065f46; font-weight: 700;">
          ضمان استرداد الأموال بنسبة 100% وفقاً لأحكام الاسترجاع (Money-Back Guarantee)
        </div>
        <p>في سنترلي، رضاك التام ونجاح منظومتك هو أساس عملنا. لذلك نوفر سياسة استرجاع مرنة وعادلة تماماً:</p>
        
        <h4 style="color: #1e3a8a; font-weight: 800;">1. شروط ومهلة تقديم طلب استرداد قيمة الاشتراك</h4>
        <ul style="padding-right: 1.25rem; line-height: 1.9;">
          <li>يحق لأي مشترك جديد في باقات المنصة تقديم طلب استرداد كامل قيمة الاشتراك خلال <b>14 يوماً</b> من تاريخ الدفع الأول، في حال عدم رضاه عن الخدمة أو وجود أي عائق تقني لم نتمكن من حله.</li>
          <li><b>مدة معالجة وتحويل المبلغ المسترد:</b> نظراً للدورات المصرفية المعتمدة لدى البنوك وشبكات الدفع الإلكتروني والمحافظ في جمهورية مصر العربية، فإن تنفيذ وتحويل المبلغ المسترد إلى حساب العميل البنكي أو محفظته الإلكترونية <b>يستغرق من 14 إلى 30 يوم عمل</b> لتأكيد التسوية المصرفية.</li>
        </ul>

        <h4 style="color: #1e3a8a; font-weight: 800;">2. إلغاء الاشتراك الشهري</h4>
        <p>يمكنك إلغاء تجديد اشتراكك في أي وقت من لوحة التحكم أو بالتواصل مع الدعم الفني، وسيظل حسابك نشطاً حتى نهاية الفترة المدفوعة بالفعل دون أي رسوم أو غرامات إلغاء إضافية.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">3. طلبات كروت الطلاب المطبوعة</h4>
        <p>المبالغ المدفوعة لطباعة كروت الطلاب البلاستيكية (PVC) التي تم تنفيذها وطباعتها وشحنها بالفعل للمدرس لا تخضع لسياسة الاسترجاع نظراً لتخصيصها وطباعة بيانات المدرس عليها.</p>
      `;
    } else if (type === 'contact') {
      titleEl.innerText = 'بيانات التواصل الرسمية والدعم الفني المباشر';
      bodyEl.innerHTML = `
        <h4 style="color: #1e3a8a; margin-top: 0; font-weight: 800;">بيانات التواصل المعتمدة لدى سنترلي:</h4>
        <p>يسعدنا تقديم الدعم الفني والإجابة على أي استفسارات للمعلمين وأصحاب السناتر في مصر:</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; line-height: 2.3; margin-top: 1rem;">
          <b>• الاسم التجاري الرسمي:</b> سنترلي للحلول التعليمية والبرمجيات (Centrly)<br>
          <b>• المقر والعنوان:</b> جمهورية مصر العربية — القاهرة<br>
          <b>• البريد الإلكتروني الرسمي:</b> <a href="mailto:mohanedabdulhalim@gmail.com" style="color: #2563eb; font-weight: 700; text-decoration: none;">mohanedabdulhalim@gmail.com</a><br>
          <b>• الهاتف والواتساب المباشر:</b> <a href="https://wa.me/201123671177?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%85%D9%86%D8%B5%D8%A9%20%D8%B3%D9%86%D8%AA%D8%B1%D9%84%D9%8A%20%D9%84%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AD%D8%B5%D8%B5%20%D9%88%D8%A7%D9%84%D8%B7%D9%84%D8%A7%D8%A8" target="_blank" rel="noopener noreferrer" dir="ltr" style="font-weight: 800; color: #16a34a; text-decoration: none;">01123671177 (+20 112 367 1177)</a><br>
          <b>• أوقات خدمة العملاء:</b> يومياً من 9:00 صباحاً حتى 10:00 مساءً بتوقيت القاهرة<br>
          <b>• العملة الرسمية لجميع المعاملات:</b> الجنيه المصري (EGP - ج.م)
        </div>

        <div style="margin-top: 1.5rem; text-align: center;">
          <a href="https://wa.me/201123671177?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%85%D9%86%D8%B5%D8%A9%20%D8%B3%D9%86%D8%AA%D8%B1%D9%84%D9%8A%20%D9%84%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AD%D8%B5%D8%B5%20%D9%88%D8%A7%D9%84%D8%B7%D9%84%D8%A7%D8%A8" 
             target="_blank" 
             rel="noopener noreferrer" 
             style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: #16a34a; color: #ffffff; text-decoration: none; font-family: 'Cairo', sans-serif; font-size: 1rem; font-weight: 800; padding: 0.85rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.3); transition: all 0.2s;"
             onmouseover="this.style.backgroundColor='#15803d'; this.style.transform='translateY(-1px)';"
             onmouseout="this.style.backgroundColor='#16a34a'; this.style.transform='none';">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span>محادثة مباشرة عبر واتساب الآن</span>
          </a>
        </div>
      `;
    }

    this._policyReturnFocus=document.activeElement;
    overlay.setAttribute('role','dialog');overlay.setAttribute('aria-modal','true');overlay.setAttribute('aria-labelledby','policyModalTitle');
    overlay.style.display = 'flex';
    const focusables=()=>[...overlay.querySelectorAll('button,a[href]')].filter(node=>node.offsetParent!==null);
    overlay.onkeydown=event=>{
      if(event.key==='Escape'){event.preventDefault();this.closePolicyModal();}
      if(event.key==='Tab'){const nodes=focusables(),first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&document.activeElement===first){event.preventDefault();last?.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first?.focus();}}
    };
    focusables()[0]?.focus();
  }

  app.closePolicyModal = function closePolicyModal() {
    const overlay = document.getElementById('policyModalOverlay');
    if (overlay) overlay.style.display = 'none';
    if(this._policyReturnFocus?.isConnected)this._policyReturnFocus.focus();
  }

  app.toggleFaq = function toggleFaq(index) {
    const item = document.getElementById(`faqItem${index}`);
    const answer = document.getElementById(`faqAnswer${index}`);
    const icon = document.getElementById(`faqIcon${index}`);
    if (!item || !answer || !icon) return;

    const isOpen = answer.style.display === 'block';

    // Reset all FAQs
    for (let i = 1; i <= 6; i++) {
      const a = document.getElementById(`faqAnswer${i}`);
      const ic = document.getElementById(`faqIcon${i}`);
      const it = document.getElementById(`faqItem${i}`);
      if (a) a.style.display = 'none';
      if (ic) ic.style.transform = 'rotate(0deg)';
      if (it) it.style.borderColor = 'var(--brand-line, #E5E9F2)';
    }

    if (!isOpen) {
      answer.style.display = 'block';
      icon.style.transform = 'rotate(180deg)';
      item.style.borderColor = 'var(--brand-blue, #2949BA)';
    }
  }

  app.acceptCookies = function acceptCookies() {
    try {
      localStorage.setItem('centrly_cookie_consent', 'accepted');
      trackProductEvent('landing_view');
    } catch (e) {}
    const banner = document.getElementById('centrlyCookieConsent');
    if (banner) banner.style.display = 'none';
  }

  app.initCookieConsent = function initCookieConsent() {
    try {
      const consent = localStorage.getItem('centrly_cookie_consent');
      if (!consent) {
        const banner = document.getElementById('centrlyCookieConsent');
        if (banner) banner.style.display = 'flex';
      }
    } catch (e) {}
  }


}
