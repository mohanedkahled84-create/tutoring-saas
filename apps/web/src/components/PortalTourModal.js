import { getIcon } from "../utils/icons.js";

/**
 * Centrly Interactive Spotlight & Arrow Coachmark Tour (v5.3.0)
 * Creates an element spotlight with dark blurred background scrim (Backdrop Blur)
 * and a floating popover card with a pointing arrow pointing directly at
 * the target element (Upload button, materials, quizzes, attendance barcode).
 */

export function renderStudentPortalTourHtml() {
  return `
    <style>
      .portal-spotlight-target {
        position: relative !important;
        z-index: 99995 !important;
        box-shadow: 0 0 0 4px #2563eb, 0 12px 35px rgba(37, 99, 235, 0.45) !important;
        border-radius: 0.85rem !important;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
    </style>

    <!-- Dark Blurred Backdrop Overlay -->
    <div id="student-spotlight-backdrop" onclick="window.nextStudentPortalTourStep()" title="اضغط لمتابعة الشرح"
      style="display: none; position: fixed; inset: 0; z-index: 99990; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); cursor: pointer; transition: opacity 0.3s ease;">
    </div>

    <!-- Floating Popover Tooltip with Pointer Arrow -->
    <div id="student-spotlight-popover" 
      style="display: none; position: fixed; z-index: 99999; width: min(340px, calc(100vw - 32px)); max-height: calc(100vh - 24px); overflow-y: auto; background: #ffffff; border-radius: 1.15rem; padding: 1.1rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.35), 0 10px 10px -5px rgba(0, 0, 0, 0.15); border: 2px solid #3b82f6; direction: rtl; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
      
      <!-- Pointing Arrow (Top or Bottom) -->
      <div id="student-spotlight-arrow" style="position: absolute; width: 0; height: 0;"></div>

      <!-- Header with Step Badge and Close -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
        <span id="student-spotlight-badge" style="background: #eff6ff; color: #1d4ed8; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.65rem; border-radius: 9999px; border: 1px solid #bfdbfe;">
          الخطوة 1 من 6
        </span>
        <button type="button" onclick="window.closeStudentPortalTour(true)" 
          style="background: transparent; border: none; font-size: 0.78rem; font-weight: 700; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;"
          onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='#64748b'">
          <span>تخطي الشرح</span>
          ${getIcon('close', 13, '#64748b')}
        </button>
      </div>

      <!-- Title & Explanation -->
      <div style="margin-bottom: 0.75rem;">
        <h4 id="student-spotlight-title" style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin: 0 0 0.35rem 0; display: flex; align-items: center; gap: 0.4rem;">
          عنوان الخانة
        </h4>
        <p id="student-spotlight-desc" style="font-size: 0.825rem; color: #475569; line-height: 1.6; margin: 0;">
          شرح الخانة وكيفية استخدامها...
        </p>
      </div>

      <!-- Footer Buttons -->
      <div style="display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
          <button type="button" id="student-spotlight-prev-btn" onclick="window.prevStudentPortalTourStep()" 
            style="display: none; background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; padding: 0.45rem 0.85rem; border-radius: 0.55rem; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
            السابق
          </button>
          <button type="button" id="student-spotlight-next-btn" onclick="window.nextStudentPortalTourStep()" 
            style="width: 100%; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; border: none; padding: 0.55rem 1rem; border-radius: 0.65rem; font-size: 0.825rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(37, 99, 235, 0.25); display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
            <span>التالي</span>
            <span>←</span>
          </button>
        </div>
        <div style="text-align: center; font-size: 0.68rem; color: #94a3b8;">
          (يمكنك أيضاً النقر على الشاشة للمتابعة)
        </div>
      </div>

    </div>
  `;
}

export function renderParentPortalTourHtml() {
  return `
    <style>
      .portal-spotlight-target-emerald {
        position: relative !important;
        z-index: 99995 !important;
        box-shadow: 0 0 0 4px #059669, 0 12px 35px rgba(5, 150, 105, 0.45) !important;
        border-radius: 0.85rem !important;
        transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1) !important;
      }
    </style>

    <!-- Dark Blurred Backdrop Overlay -->
    <div id="parent-spotlight-backdrop" onclick="window.nextParentPortalTourStep()" title="اضغط لمتابعة الشرح"
      style="display: none; position: fixed; inset: 0; z-index: 99990; background: rgba(15, 23, 42, 0.75); backdrop-filter: blur(4px); -webkit-backdrop-filter: blur(4px); cursor: pointer; transition: opacity 0.3s ease;">
    </div>

    <!-- Floating Popover Tooltip with Pointer Arrow -->
    <div id="parent-spotlight-popover" 
      style="display: none; position: fixed; z-index: 99999; width: min(340px, calc(100vw - 32px)); max-height: calc(100vh - 24px); overflow-y: auto; background: #ffffff; border-radius: 1.15rem; padding: 1.1rem; box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.35), 0 10px 10px -5px rgba(0, 0, 0, 0.15); border: 2px solid #059669; direction: rtl; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box; transition: all 0.25s cubic-bezier(0.16, 1, 0.3, 1);">
      
      <!-- Pointing Arrow (Top or Bottom) -->
      <div id="parent-spotlight-arrow" style="position: absolute; width: 0; height: 0;"></div>

      <!-- Header with Step Badge and Close -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem;">
        <span id="parent-spotlight-badge" style="background: #ecfdf5; color: #059669; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.65rem; border-radius: 9999px; border: 1px solid #a7f3d0;">
          الخطوة 1 من 4
        </span>
        <button type="button" onclick="window.closeParentPortalTour(true)" 
          style="background: transparent; border: none; font-size: 0.78rem; font-weight: 700; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;"
          onmouseover="this.style.color='#0f172a'" onmouseout="this.style.color='#64748b'">
          <span>تخطي الشرح</span>
          ${getIcon('close', 13, '#64748b')}
        </button>
      </div>

      <!-- Title & Explanation -->
      <div style="margin-bottom: 0.75rem;">
        <h4 id="parent-spotlight-title" style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin: 0 0 0.35rem 0; display: flex; align-items: center; gap: 0.4rem;">
          عنوان القسم
        </h4>
        <p id="parent-spotlight-desc" style="font-size: 0.825rem; color: #475569; line-height: 1.6; margin: 0;">
          شرح القسم لولي الأمر...
        </p>
      </div>

      <!-- Footer Buttons -->
      <div style="display: flex; flex-direction: column; gap: 0.4rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;">
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
          <button type="button" id="parent-spotlight-prev-btn" onclick="window.prevParentPortalTourStep()" 
            style="display: none; background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; padding: 0.45rem 0.85rem; border-radius: 0.55rem; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
            السابق
          </button>
          <button type="button" id="parent-spotlight-next-btn" onclick="window.nextParentPortalTourStep()" 
            style="width: 100%; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; border: none; padding: 0.55rem 1rem; border-radius: 0.65rem; font-size: 0.825rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
            <span>التالي</span>
            <span>←</span>
          </button>
        </div>
        <div style="text-align: center; font-size: 0.68rem; color: #94a3b8;">
          (يمكنك أيضاً النقر على الشاشة للمتابعة)
        </div>
      </div>

    </div>
  `;
}

// Client-Side Spotlight Positioning Helper
function calculateSpotlightPosition(targetEl, popover, arrow, color) {
  if (!targetEl || !popover || !arrow) return;

  const vh = window.innerHeight;
  const vw = window.innerWidth;
  const targetElHeight = targetEl.offsetHeight || 100;

  // 1. Intelligent scroll: if target is tall (>40% of viewport), align to start so room remains below
  if (targetElHeight > vh * 0.4) {
    targetEl.scrollIntoView({ behavior: 'auto', block: 'start' });
  } else {
    targetEl.scrollIntoView({ behavior: 'auto', block: 'center' });
  }

  // 2. Measure target and popover dimensions
  const rect = targetEl.getBoundingClientRect();
  const popoverWidth = Math.min(340, vw - 32);

  popover.style.display = 'block';
  popover.style.width = popoverWidth + 'px';
  popover.style.transform = 'none';

  const popoverHeight = popover.offsetHeight || 190;
  const gap = 12;

  const spaceBelow = vh - rect.bottom;
  const spaceAbove = rect.top;

  let topPos = 0;
  let isBelow = true;

  if (spaceBelow >= popoverHeight + gap + 8) {
    // Fits comfortably below
    topPos = rect.bottom + gap;
    isBelow = true;
  } else if (spaceAbove >= popoverHeight + gap + 8) {
    // Fits comfortably above
    topPos = rect.top - popoverHeight - gap;
    isBelow = false;
  } else {
    // Limited clearance on both sides:
    // Anchor to whichever edge has more space
    if (spaceBelow >= spaceAbove) {
      topPos = vh - popoverHeight - 12;
      isBelow = true;
    } else {
      topPos = 12;
      isBelow = false;
    }
  }

  // 3. Strict screen boundary clamping: Popover is 100% GUARANTEED inside viewport!
  const minTop = 10;
  const maxTop = Math.max(minTop, vh - popoverHeight - 10);
  topPos = Math.max(minTop, Math.min(topPos, maxTop));

  // 4. Horizontal position: center with target and clamp within screen edges
  let leftPos = rect.left + (rect.width / 2) - (popoverWidth / 2);
  const minLeft = 10;
  const maxLeft = Math.max(minLeft, vw - popoverWidth - 10);
  leftPos = Math.max(minLeft, Math.min(leftPos, maxLeft));

  popover.style.top = topPos + 'px';
  popover.style.left = leftPos + 'px';

  // 5. Arrow calculation pointing directly towards target center
  const targetCenterY = rect.top + (rect.height / 2);
  const popoverCenterY = topPos + (popoverHeight / 2);
  const isTargetAbove = targetCenterY < popoverCenterY;

  const targetCenterX = Math.max(16, Math.min(rect.left + (rect.width / 2), vw - 16));
  let arrowOffset = targetCenterX - leftPos - 10;
  arrowOffset = Math.max(16, Math.min(arrowOffset, popoverWidth - 36));

  if (isTargetAbove) {
    // Target is above popover -> Arrow sits on top pointing up
    arrow.style.cssText = `
      position: absolute;
      top: -10px;
      left: ${arrowOffset}px;
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-bottom: 10px solid ${color};
      display: block;
    `;
  } else {
    // Target is below popover -> Arrow sits on bottom pointing down
    arrow.style.cssText = `
      position: absolute;
      bottom: -10px;
      left: ${arrowOffset}px;
      width: 0;
      height: 0;
      border-left: 10px solid transparent;
      border-right: 10px solid transparent;
      border-top: 10px solid ${color};
      display: block;
    `;
  }
}

// Client-Side Spotlight Tour Engine
if (typeof window !== 'undefined') {
  window._studentSpotlightIndex = 0;
  window._studentActiveSpotlightEl = null;

  const STUDENT_SPOTLIGHT_STEPS = [
    {
      tab: 'materials',
      getTarget: () => document.getElementById('student-study-materials-section') || document.getElementById('student-tab-btn-materials'),
      badge: 'الخطوة 1 من 6: المذكرات',
      title: '📚 ملازم الشرح وملفات الـ PDF',
      desc: 'هنا بتنزل كل ملازم الحصص وملخصات الدروس والـ PDF اللي المعلم بيرفعها لمجموعتك. اضغط "تحميل / فتح المذكرة" لتنزيلها على تليفونك ومذاكرتها في أي وقت.',
      nextLabel: 'التالي: زر رفع الواجب ←'
    },
    {
      tab: 'materials',
      getTarget: () => document.querySelector('[id^="hw-upload-btn-"]') || document.getElementById('student-active-homeworks-section') || document.getElementById('student-tab-btn-materials'),
      badge: 'الخطوة 2 من 6: رفع الواجب',
      title: '📝 زر رفع حل الواجب المطلوب',
      desc: 'بعد ما تحل الواجب المطلوب في كشكولك وتصوّره بكاميرا الموبايل، اضغط على هذا الزر مباشرة لرفع صور أو PDF الحل للمعلم عشان يراجعه ويكتبلك التصحيح ويعتمده فوراً!',
      nextLabel: 'التالي: تحويل الصور لـ PDF ←'
    },
    {
      tab: 'materials',
      getTarget: () => document.getElementById('student-pdf-helper-card') || document.getElementById('student-tab-btn-materials'),
      badge: 'الخطوة 3 من 6: تحويل الصور',
      title: '💡 تحويل صور الكشكول إلى PDF مجاناً',
      desc: 'لو حليت الواجب في عدة صفحات بكشكولك، اضغط هنا لمعرفة طريقة دمج كل الصور في ملف PDF واحد مجاناً وسريع من موبايلك قبل رفعه.',
      nextLabel: 'التالي: درجات الكويزات ←'
    },
    {
      tab: 'quizzes',
      getTarget: () => document.getElementById('student-tab-content-quizzes') || document.getElementById('student-tab-btn-quizzes'),
      badge: 'الخطوة 4 من 6: الكويزات',
      title: '🎯 درجات الكويزات والامتحانات',
      desc: 'كشف حساب شامل ومحدث لحظياً بكل كويز أو امتحان شهري في السنتر؛ هتشوف درجتك والدرجة العظمى والنسبة المئوية وملاحظات وتوجيهات المعلم لمستواك.',
      nextLabel: 'التالي: سجل الحضور ←'
    },
    {
      tab: 'attendance',
      getTarget: () => document.getElementById('student-tab-content-attendance') || document.getElementById('student-tab-btn-attendance'),
      badge: 'الخطوة 5 من 6: الحضور',
      title: '📅 سجل الحضور والغياب',
      desc: 'سجل كامل بكل الحصص التي حضرتها وتواريخها، ونسبة التزامك بالحضور وتنبيهات الغياب لمتابعة مستواك والتزامك أولاً بأول.',
      nextLabel: 'التالي: باركود الحضور عند الباب ←'
    },
    {
      tab: 'card',
      getTarget: () => document.getElementById('student-tab-content-card') || document.getElementById('student-tab-btn-card'),
      badge: 'الخطوة 6 من 6: باركود الحضور',
      title: '🎫 باركود الحضور عند باب السنتر',
      desc: 'كارتك الشخصي الحصري وفيه باركودك المعتمد؛ أول ما توصل للسنتر افتحه من موبايلك عشان المشرف يمسحه بالاسكانر في ثانية واحدة ويسجل حضورك تلقائياً!',
      nextLabel: '✨ فهمت تماماً، ابدأ استخدام المنصة!'
    }
  ];

  window.renderStudentSpotlightStep = function(index) {
    if (index < 0) index = 0;
    if (index >= STUDENT_SPOTLIGHT_STEPS.length) {
      window.closeStudentPortalTour(true);
      return;
    }
    window._studentSpotlightIndex = index;
    const step = STUDENT_SPOTLIGHT_STEPS[index];

    // 1. Switch to required tab
    if (step.tab && window.switchStudentPortalTab) {
      window.switchStudentPortalTab(step.tab);
    }

    // 2. Remove highlight from previous element
    if (window._studentActiveSpotlightEl) {
      window._studentActiveSpotlightEl.classList.remove('portal-spotlight-target');
      window._studentActiveSpotlightEl = null;
    }

    // 3. Highlight target element after tab DOM render
    setTimeout(() => {
      requestAnimationFrame(() => {
        const targetEl = step.getTarget();
        const backdrop = document.getElementById('student-spotlight-backdrop');
        const popover = document.getElementById('student-spotlight-popover');
        const arrow = document.getElementById('student-spotlight-arrow');
        if (!backdrop || !popover || !arrow) return;

        backdrop.style.display = 'block';
        popover.style.display = 'block';

        // Update contents FIRST so true offsetHeight can be measured accurately
        document.getElementById('student-spotlight-badge').textContent = step.badge;
        document.getElementById('student-spotlight-title').textContent = step.title;
        document.getElementById('student-spotlight-desc').textContent = step.desc;

        const prevBtn = document.getElementById('student-spotlight-prev-btn');
        if (prevBtn) prevBtn.style.display = (index > 0) ? 'block' : 'none';

        const nextBtn = document.getElementById('student-spotlight-next-btn');
        if (nextBtn) {
          nextBtn.innerHTML = `<span>${step.nextLabel}</span>`;
          if (index === STUDENT_SPOTLIGHT_STEPS.length - 1) {
            nextBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
            nextBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          } else {
            nextBtn.style.background = 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)';
            nextBtn.style.boxShadow = '0 4px 10px rgba(37, 99, 235, 0.25)';
          }
        }

        if (targetEl) {
          targetEl.classList.add('portal-spotlight-target');
          window._studentActiveSpotlightEl = targetEl;

          calculateSpotlightPosition(targetEl, popover, arrow, '#3b82f6');
        } else {
          popover.style.top = '50%';
          popover.style.left = '50%';
          popover.style.transform = 'translate(-50%, -50%)';
          arrow.style.display = 'none';
        }
      });
    }, 120);
  };

  window.openStudentPortalTour = function(force = true) {
    if (!force) {
      const seen = localStorage.getItem('centrly_portal_spotlight_v3_completed');
      if (seen === 'true') return;
    }
    window.renderStudentSpotlightStep(0);
  };

  window.nextStudentPortalTourStep = function() {
    if (window._studentSpotlightIndex < STUDENT_SPOTLIGHT_STEPS.length - 1) {
      window.renderStudentSpotlightStep(window._studentSpotlightIndex + 1);
    } else {
      window.closeStudentPortalTour(true);
    }
  };

  window.prevStudentPortalTourStep = function() {
    if (window._studentSpotlightIndex > 0) {
      window.renderStudentSpotlightStep(window._studentSpotlightIndex - 1);
    }
  };

  window.closeStudentPortalTour = function(markSeen = true) {
    if (window._studentActiveSpotlightEl) {
      window._studentActiveSpotlightEl.classList.remove('portal-spotlight-target');
      window._studentActiveSpotlightEl = null;
    }
    const backdrop = document.getElementById('student-spotlight-backdrop');
    const popover = document.getElementById('student-spotlight-popover');
    if (backdrop) backdrop.style.display = 'none';
    if (popover) popover.style.display = 'none';

    if (markSeen) {
      try {
        localStorage.setItem('centrly_portal_spotlight_v3_completed', 'true');
      } catch (_) {}
    }
  };

  // --- Parent Portal Spotlight Handlers ---
  window._parentSpotlightIndex = 0;
  window._parentActiveSpotlightEl = null;

  const PARENT_SPOTLIGHT_STEPS = [
    {
      tab: 'attendance',
      getTarget: () => document.getElementById('parent-kpi-summary-section') || document.getElementById('tab-btn-attendance'),
      badge: 'الخطوة 1 من 4: الحضور',
      title: '📅 متابعة الحضور والغياب اللحظي',
      desc: 'بمجرد وصول الطالب باب السنتر ومسح باركوده، يتحدث تقرير حضوره هنا بالساعة والتاريخ، أو تسجيل غيابه في حال عدم الحضور.',
      nextLabel: 'التالي: درجات الكويزات ←'
    },
    {
      tab: 'quizzes',
      getTarget: () => document.getElementById('tab-content-quizzes') || document.getElementById('tab-btn-quizzes'),
      badge: 'الخطوة 2 من 4: الكويزات',
      title: '📊 كشف درجات الكويزات والامتحانات',
      desc: 'تقرير دوري يوضح درجات الطالب في كل كويز مع النسبة المئوية وملاحظات وتوجيهات المعلم لمتابعة مستوى ابنكم أولاً بأول.',
      nextLabel: 'التالي: متابعة الواجبات ←'
    },
    {
      tab: 'homework',
      getTarget: () => document.getElementById('tab-content-homework') || document.getElementById('tab-btn-homework'),
      badge: 'الخطوة 3 من 4: الواجبات',
      title: '📝 متابعة الواجبات المنزلية',
      desc: 'معرفة مدى التزام الطالب بتسليم الواجبات في مواعيدها المحددة مع قراءة ملاحظات وتصحيح المعلم على الحل.',
      nextLabel: 'التالي: تحديث البيانات ←'
    },
    {
      tab: 'attendance',
      getTarget: () => document.getElementById('parent-refresh-data-btn'),
      badge: 'الخطوة 4 من 4: التحديث',
      title: '🔄 زر تحديث البيانات اللحظي',
      desc: 'يمكنكم في أي لحظة الضغط على هذا الزر لتحديث وعرض أي بيانات وتقارير جديدة تلقائياً دون الحاجة لتسجيل الخروج.',
      nextLabel: '✨ فهمت تماماً، ابدأ استخدام المنصة!'
    }
  ];

  window.renderParentSpotlightStep = function(index) {
    if (index < 0) index = 0;
    if (index >= PARENT_SPOTLIGHT_STEPS.length) {
      window.closeParentPortalTour(true);
      return;
    }
    window._parentSpotlightIndex = index;
    const step = PARENT_SPOTLIGHT_STEPS[index];

    if (step.tab && window.switchParentPortalTab) {
      window.switchParentPortalTab(step.tab);
    }

    if (window._parentActiveSpotlightEl) {
      window._parentActiveSpotlightEl.classList.remove('portal-spotlight-target-emerald');
      window._parentActiveSpotlightEl = null;
    }

    setTimeout(() => {
      requestAnimationFrame(() => {
        const targetEl = step.getTarget();
        const backdrop = document.getElementById('parent-spotlight-backdrop');
        const popover = document.getElementById('parent-spotlight-popover');
        const arrow = document.getElementById('parent-spotlight-arrow');
        if (!backdrop || !popover || !arrow) return;

        backdrop.style.display = 'block';
        popover.style.display = 'block';

        // Update contents FIRST
        document.getElementById('parent-spotlight-badge').textContent = step.badge;
        document.getElementById('parent-spotlight-title').textContent = step.title;
        document.getElementById('parent-spotlight-desc').textContent = step.desc;

        const prevBtn = document.getElementById('parent-spotlight-prev-btn');
        if (prevBtn) prevBtn.style.display = (index > 0) ? 'block' : 'none';

        const nextBtn = document.getElementById('parent-spotlight-next-btn');
        if (nextBtn) {
          nextBtn.innerHTML = `<span>${step.nextLabel}</span>`;
          if (index === PARENT_SPOTLIGHT_STEPS.length - 1) {
            nextBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
          }
        }

        if (targetEl) {
          targetEl.classList.add('portal-spotlight-target-emerald');
          window._parentActiveSpotlightEl = targetEl;

          calculateSpotlightPosition(targetEl, popover, arrow, '#059669');
        } else {
          popover.style.top = '50%';
          popover.style.left = '50%';
          popover.style.transform = 'translate(-50%, -50%)';
          arrow.style.display = 'none';
        }
      });
    }, 120);
  };

  window.openParentPortalTour = function(force = true) {
    if (!force) {
      const seen = localStorage.getItem('centrly_portal_spotlight_v3_completed');
      if (seen === 'true') return;
    }
    window.renderParentSpotlightStep(0);
  };

  window.nextParentPortalTourStep = function() {
    if (window._parentSpotlightIndex < PARENT_SPOTLIGHT_STEPS.length - 1) {
      window.renderParentSpotlightStep(window._parentSpotlightIndex + 1);
    } else {
      window.closeParentPortalTour(true);
    }
  };

  window.prevParentPortalTourStep = function() {
    if (window._parentSpotlightIndex > 0) {
      window.renderParentSpotlightStep(window._parentSpotlightIndex - 1);
    }
  };

  window.closeParentPortalTour = function(markSeen = true) {
    if (window._parentActiveSpotlightEl) {
      window._parentActiveSpotlightEl.classList.remove('portal-spotlight-target-emerald');
      window._parentActiveSpotlightEl = null;
    }
    const backdrop = document.getElementById('parent-spotlight-backdrop');
    const popover = document.getElementById('parent-spotlight-popover');
    if (backdrop) backdrop.style.display = 'none';
    if (popover) popover.style.display = 'none';

    if (markSeen) {
      try {
        localStorage.setItem('centrly_portal_spotlight_v3_completed', 'true');
      } catch (_) {}
    }
  };

  // 4. Global window resize & orientation change listener
  window.addEventListener('resize', () => {
    if (window._studentActiveSpotlightEl && document.getElementById('student-spotlight-popover')?.style.display === 'block') {
      const popover = document.getElementById('student-spotlight-popover');
      const arrow = document.getElementById('student-spotlight-arrow');
      calculateSpotlightPosition(window._studentActiveSpotlightEl, popover, arrow, '#3b82f6');
    }
    if (window._parentActiveSpotlightEl && document.getElementById('parent-spotlight-popover')?.style.display === 'block') {
      const popover = document.getElementById('parent-spotlight-popover');
      const arrow = document.getElementById('parent-spotlight-arrow');
      calculateSpotlightPosition(window._parentActiveSpotlightEl, popover, arrow, '#059669');
    }
  });

  // 5. Global keyboard navigation (Esc, Arrow keys, Enter)
  window.addEventListener('keydown', function(e) {
    const studentTourOpen = document.getElementById('student-spotlight-popover')?.style.display === 'block';
    const parentTourOpen = document.getElementById('parent-spotlight-popover')?.style.display === 'block';
    if (!studentTourOpen && !parentTourOpen) return;

    if (e.key === 'Escape') {
      if (studentTourOpen) window.closeStudentPortalTour(true);
      if (parentTourOpen) window.closeParentPortalTour(true);
    } else if (e.key === 'ArrowRight' || e.key === 'Enter') {
      if (studentTourOpen) window.nextStudentPortalTourStep();
      if (parentTourOpen) window.nextParentPortalTourStep();
    } else if (e.key === 'ArrowLeft') {
      if (studentTourOpen) window.prevStudentPortalTourStep();
      if (parentTourOpen) window.prevParentPortalTourStep();
    }
  });
}
