import { getIcon } from "../utils/icons.js";

/**
 * Centrly Interactive Coachmark Tour (v6.0.0)
 * Ultra-clean, elderly-friendly, compact floating card ("خانة صغيرة")
 * - 0% backdrop blur (Leaves the screen, buttons, and text 100% sharp and visible)
 * - Ultra-light translucent scrim that does not obstruct the page
 * - High-contrast pulsating highlight ring around the EXACT button being explained
 * - Clear pointer arrow pointing directly at the button with directional indicator (👆 / 👇)
 * - Auto-launches immediately upon first login without needing to click "شرح المنصة"
 */

export function renderStudentPortalTourHtml() {
  return `
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
          ${getIcon('close', 11, '#64748b')}
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
  `;
}

export function renderParentPortalTourHtml() {
  return `
    <style>
      @keyframes portalPulseGreen {
        0%, 100% {
          box-shadow: 0 0 0 4px rgba(5, 150, 105, 0.4), 0 4px 16px rgba(5, 150, 105, 0.25) !important;
          outline: 3px solid #059669 !important;
        }
        50% {
          box-shadow: 0 0 0 10px rgba(5, 150, 105, 0.15), 0 8px 24px rgba(5, 150, 105, 0.35) !important;
          outline: 3.5px solid #047857 !important;
        }
      }
      .portal-spotlight-target-emerald {
        position: relative !important;
        z-index: 99995 !important;
        outline: 3.5px solid #059669 !important;
        outline-offset: 3px !important;
        border-radius: 10px !important;
        animation: portalPulseGreen 1.8s infinite !important;
        transition: all 0.2s ease-in-out !important;
      }
    </style>

    <!-- Ultra-light non-blurry backdrop: leaves the entire page, buttons, and text 100% sharp and visible -->
    <div id="parent-spotlight-backdrop" onclick="window.nextParentPortalTourStep()" title="اضغط لمتابعة الشرح"
      style="display: none; position: fixed; inset: 0; z-index: 99990; background: rgba(15, 23, 42, 0.08); cursor: pointer; transition: opacity 0.25s ease;">
    </div>

    <!-- Compact Floating Coachmark Card ("خانة صغيرة") -->
    <div id="parent-spotlight-popover" 
      style="display: none; position: fixed; z-index: 99999; width: min(315px, calc(100vw - 24px)); max-height: calc(100vh - 20px); overflow-y: auto; background: #ffffff; border-radius: 1rem; padding: 1rem; box-shadow: 0 12px 30px rgba(0, 0, 0, 0.2), 0 4px 10px rgba(0, 0, 0, 0.08); border: 2.5px solid #059669; direction: rtl; font-family: system-ui, -apple-system, sans-serif; box-sizing: border-box; transition: top 0.2s ease-out, left 0.2s ease-out;">
      
      <!-- Pointing Arrow (points directly towards target button) -->
      <div id="parent-spotlight-arrow" style="position: absolute; width: 0; height: 0;"></div>

      <!-- Header: Step badge, progress dots, and close button -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.6rem; gap: 0.5rem;">
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <span id="parent-spotlight-badge" style="background: #ecfdf5; color: #059669; font-size: 0.76rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 9999px; border: 1px solid #a7f3d0; white-space: nowrap;">
            الخطوة 1 من 4
          </span>
          <div id="parent-spotlight-dots" style="display: flex; gap: 4px; align-items: center;"></div>
        </div>
        <button type="button" onclick="window.closeParentPortalTour(true)" 
          style="background: #f1f5f9; border: 1px solid #e2e8f0; border-radius: 0.4rem; padding: 0.2rem 0.5rem; font-size: 0.74rem; font-weight: 700; color: #64748b; cursor: pointer; display: flex; align-items: center; gap: 0.25rem;"
          onmouseover="this.style.color='#0f172a'; this.style.borderColor='#cbd5e1'" onmouseout="this.style.color='#64748b'; this.style.borderColor='#e2e8f0'">
          <span>تخطي</span>
          ${getIcon('close', 11, '#64748b')}
        </button>
      </div>

      <!-- Title & Explanation (Clean, elderly-friendly Arabic typography) -->
      <div style="margin-bottom: 0.85rem;">
        <h4 id="parent-spotlight-title" style="font-size: 1.05rem; font-weight: 900; color: #0f172a; margin: 0 0 0.4rem 0; line-height: 1.35; display: flex; align-items: center; gap: 0.4rem;">
          عنوان القسم
        </h4>
        <p id="parent-spotlight-desc" style="font-size: 0.88rem; color: #334155; line-height: 1.6; margin: 0; font-weight: 500;">
          شرح القسم لولي الأمر...
        </p>
      </div>

      <!-- Footer Navigation Buttons -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;">
        <button type="button" id="parent-spotlight-prev-btn" onclick="window.prevParentPortalTourStep()" 
          style="display: none; background: #f8fafc; border: 1px solid #cbd5e1; color: #475569; padding: 0.45rem 0.85rem; border-radius: 0.55rem; font-size: 0.8rem; font-weight: 700; cursor: pointer;">
          السابق
        </button>
        <button type="button" id="parent-spotlight-next-btn" onclick="window.nextParentPortalTourStep()" 
          style="width: 100%; background: linear-gradient(135deg, #059669 0%, #10b981 100%); color: #ffffff; border: none; padding: 0.55rem 1rem; border-radius: 0.65rem; font-size: 0.85rem; font-weight: 800; cursor: pointer; box-shadow: 0 4px 10px rgba(16, 185, 129, 0.25); display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
          <span>التالي</span>
          <span>←</span>
        </button>
      </div>

    </div>
  `;
}

// Client-Side Spotlight Positioning Helper
function calculateSpotlightPosition(targetEl, popover, arrow, color, role = 'student') {
  if (!targetEl || !popover || !arrow) return;

  const vh = window.innerHeight;
  const vw = window.innerWidth;

  // 1. Smoothly scroll target button into center of view
  try {
    targetEl.scrollIntoView({ behavior: 'smooth', block: 'center', inline: 'center' });
  } catch (_) {
    try { targetEl.scrollIntoView(true); } catch (__) {}
  }

  // Measure after smooth scroll starts
  setTimeout(() => {
    const rect = targetEl.getBoundingClientRect();
    const popoverWidth = Math.min(315, vw - 24);

    popover.style.display = 'block';
    popover.style.width = popoverWidth + 'px';
    popover.style.transform = 'none';

    const popoverHeight = popover.offsetHeight || 190;
    const gap = 12;

    const spaceBelow = vh - rect.bottom;
    const spaceAbove = rect.top;

    let topPos = 0;
    let isTargetAbove = true;

    if (spaceBelow >= popoverHeight + gap + 10) {
      // Space is available below target button -> Target is ABOVE popover
      topPos = rect.bottom + gap;
      isTargetAbove = true;
    } else if (spaceAbove >= popoverHeight + gap + 10) {
      // Space is available above target button -> Target is BELOW popover
      topPos = rect.top - popoverHeight - gap;
      isTargetAbove = false;
    } else {
      if (spaceBelow >= spaceAbove) {
        topPos = vh - popoverHeight - 12;
        isTargetAbove = true;
      } else {
        topPos = 12;
        isTargetAbove = false;
      }
    }

    // Strict screen boundary clamping
    const minTop = 10;
    const maxTop = Math.max(minTop, vh - popoverHeight - 10);
    topPos = Math.max(minTop, Math.min(topPos, maxTop));

    // Horizontal position: Center relative to target button and clamp
    let leftPos = rect.left + (rect.width / 2) - (popoverWidth / 2);
    const minLeft = 10;
    const maxLeft = Math.max(minLeft, vw - popoverWidth - 10);
    leftPos = Math.max(minLeft, Math.min(leftPos, maxLeft));

    popover.style.top = topPos + 'px';
    popover.style.left = leftPos + 'px';

    // Arrow calculation pointing directly towards target center
    const targetCenterX = Math.max(16, Math.min(rect.left + (rect.width / 2), vw - 16));
    let arrowOffset = targetCenterX - leftPos - 9;
    arrowOffset = Math.max(16, Math.min(arrowOffset, popoverWidth - 34));

    if (isTargetAbove) {
      // Target is above popover -> Arrow sits on top pointing up
      arrow.style.cssText = `
        position: absolute;
        top: -9px;
        left: ${arrowOffset}px;
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-bottom: 9px solid ${color};
        display: block;
      `;
    } else {
      // Target is below popover -> Arrow sits on bottom pointing down
      arrow.style.cssText = `
        position: absolute;
        bottom: -9px;
        left: ${arrowOffset}px;
        width: 0;
        height: 0;
        border-left: 9px solid transparent;
        border-right: 9px solid transparent;
        border-top: 9px solid ${color};
        display: block;
      `;
    }
  }, 100);
}

// Progress Dots Renderer Helper
function renderDotsHtml(total, current, color = '#2563eb') {
  let dots = '';
  for (let i = 0; i < total; i++) {
    const active = (i === current);
    dots += `<span style="display:inline-block; width:${active ? '12px' : '5px'}; height:5px; border-radius:9999px; background:${active ? color : '#cbd5e1'}; transition:all 0.2s ease;"></span>`;
  }
  return dots;
}

// Client-Side Spotlight Tour Engine
if (typeof window !== 'undefined') {
  window._studentSpotlightIndex = 0;
  window._studentActiveSpotlightEl = null;

  // Student Portal Steps: Targets specific buttons on screen
  const STUDENT_SPOTLIGHT_STEPS = [
    {
      tab: 'materials',
      getTarget: () => document.getElementById('student-tab-btn-materials'),
      badge: 'الخطوة 1 من 5',
      getTitle: () => '📁 زر المذكرات والواجبات',
      getDesc: () => 'ده الزرار الأساسي للمذكرات والواجب؛ اضغط عليه في أي وقت لفتح ملازم الحصص وملخصات الدروس والـ PDF وتحميلها على جهازك ومذاكرتها.',
      nextLabel: 'التالي: زر رفع الواجب ←'
    },
    {
      tab: 'materials',
      getTarget: () => document.querySelector('[id^="hw-upload-btn-"]') || document.getElementById('student-active-homeworks-section') || document.getElementById('student-study-materials-section'),
      badge: 'الخطوة 2 من 5',
      getTitle: () => '📝 زر رفع حل الواجب',
      getDesc: () => 'بعد ما تحل الواجب المطلوب في كشكولك وتصوره بكاميرا الموبايل، اضغط على زرار رفع الواجب هنا لرفع صور أو PDF الحل للمعلم عشان يراجعه ويحطلك درجتك فوراً!',
      nextLabel: 'التالي: زر درجات الامتحانات ←'
    },
    {
      tab: 'quizzes',
      getTarget: () => document.getElementById('student-tab-btn-quizzes'),
      badge: 'الخطوة 3 من 5',
      getTitle: () => '📊 زر درجات الكويزات والامتحانات',
      getDesc: () => 'اضغط على هذا الزر لمتابعة كشف درجاتك في كل كويز وامتحان شهري في السنتر، والنسبة المئوية، وملاحظات وتوجيهات المعلم لمستواك.',
      nextLabel: 'التالي: زر الحضور والغياب ←'
    },
    {
      tab: 'attendance',
      getTarget: () => document.getElementById('student-tab-btn-attendance'),
      badge: 'الخطوة 4 من 5',
      getTitle: () => '📅 زر سجل الحضور والغياب',
      getDesc: () => 'اضغط على هذا الزر لمتابعة سجل كامل بكل الحصص التي حضرتها وتواريخها، ونسبة التزامك بالحصص وتنبيهات الغياب أولاً بأول.',
      nextLabel: 'التالي: زر باركود السنتر ←'
    },
    {
      tab: 'card',
      getTarget: () => document.getElementById('student-tab-btn-card'),
      badge: 'الخطوة 5 من 5',
      getTitle: () => '🎫 زر باركود الحضور عند باب السنتر',
      getDesc: () => 'أول ما توصل باب السنتر، اضغط هنا لفتح كارتك وفيه الباركود الخاص بيك عشان المشرف يمسحه بالاسكانر في ثانية واحدة ويسجل حضورك تلقائياً!',
      nextLabel: '✨ فهمت تماماً، ابدأ الآن!'
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

        const title = typeof step.getTitle === 'function' ? step.getTitle() : step.title;
        const desc = typeof step.getDesc === 'function' ? step.getDesc() : step.desc;

        // Update contents
        document.getElementById('student-spotlight-badge').textContent = step.badge;
        const dotsEl = document.getElementById('student-spotlight-dots');
        if (dotsEl) dotsEl.innerHTML = renderDotsHtml(STUDENT_SPOTLIGHT_STEPS.length, index, '#2563eb');
        
        document.getElementById('student-spotlight-title').innerHTML = title;
        document.getElementById('student-spotlight-desc').innerHTML = desc;

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

          calculateSpotlightPosition(targetEl, popover, arrow, '#2563eb', 'student');
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
      try {
        const seen = localStorage.getItem('centrly_tour_v6_student_completed');
        if (seen === 'true') return;
      } catch (_) {}
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
        localStorage.setItem('centrly_tour_v6_student_completed', 'true');
      } catch (_) {}
    }
  };

  // --- Parent Portal Spotlight Handlers ---
  window._parentSpotlightIndex = 0;
  window._parentActiveSpotlightEl = null;

  // Parent Portal Steps: Targets specific buttons on screen
  const PARENT_SPOTLIGHT_STEPS = [
    {
      tab: 'attendance',
      getTarget: () => document.getElementById('tab-btn-attendance'),
      badge: 'الخطوة 1 من 4',
      getTitle: () => '📅 زر متابعة الحضور والغياب',
      getDesc: () => 'اضغط على هذا الزر لمتابعة حضور ابنكم اللحظي؛ فور مسح الباركود عند باب السنتر يتسجل حضوره هنا بالساعة والتاريخ أو تنبيه الغياب.',
      nextLabel: 'التالي: زر درجات الامتحانات ←'
    },
    {
      tab: 'quizzes',
      getTarget: () => document.getElementById('tab-btn-quizzes'),
      badge: 'الخطوة 2 من 4',
      getTitle: () => '📊 زر درجات الكويزات والامتحانات',
      getDesc: () => 'اضغط على هذا الزر لمتابعة تقرير دوري بدرجات الطالب في كل كويز مع النسبة المئوية وملاحظات وتوجيهات المعلم لمتابعة مستواه الدراسي.',
      nextLabel: 'التالي: زر متابعة الواجبات ←'
    },
    {
      tab: 'homework',
      getTarget: () => document.getElementById('tab-btn-homework'),
      badge: 'الخطوة 3 من 4',
      getTitle: () => '📝 زر متابعة الواجبات المنزلية',
      getDesc: () => 'اضغط على هذا الزر لمعرفة مدى التزام الطالب بتسليم الواجبات في مواعيدها المحددة مع قراءة ملاحظات وتصحيح المعلم على الحل.',
      nextLabel: 'التالي: زر تحديث الصفحة ←'
    },
    {
      tab: 'attendance',
      getTarget: () => document.getElementById('parent-refresh-data-btn'),
      badge: 'الخطوة 4 من 4',
      getTitle: () => '🔄 زر تحديث البيانات اللحظي',
      getDesc: () => 'يمكنكم في أي لحظة الضغط على هذا الزر في الأعلى لتحديث وعرض أي بيانات وتقارير جديدة تلقائياً فوراً دون الحاجة لتسجيل الخروج.',
      nextLabel: '✨ فهمت تماماً، ابدأ الآن!'
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

        const title = typeof step.getTitle === 'function' ? step.getTitle() : step.title;
        const desc = typeof step.getDesc === 'function' ? step.getDesc() : step.desc;

        // Update contents
        document.getElementById('parent-spotlight-badge').textContent = step.badge;
        const dotsEl = document.getElementById('parent-spotlight-dots');
        if (dotsEl) dotsEl.innerHTML = renderDotsHtml(PARENT_SPOTLIGHT_STEPS.length, index, '#059669');

        document.getElementById('parent-spotlight-title').innerHTML = title;
        document.getElementById('parent-spotlight-desc').innerHTML = desc;

        const prevBtn = document.getElementById('parent-spotlight-prev-btn');
        if (prevBtn) prevBtn.style.display = (index > 0) ? 'block' : 'none';

        const nextBtn = document.getElementById('parent-spotlight-next-btn');
        if (nextBtn) {
          nextBtn.innerHTML = `<span>${step.nextLabel}</span>`;
          if (index === PARENT_SPOTLIGHT_STEPS.length - 1) {
            nextBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
            nextBtn.style.boxShadow = '0 4px 12px rgba(16, 185, 129, 0.3)';
          } else {
            nextBtn.style.background = 'linear-gradient(135deg, #059669 0%, #10b981 100%)';
            nextBtn.style.boxShadow = '0 4px 10px rgba(16, 185, 129, 0.25)';
          }
        }

        if (targetEl) {
          targetEl.classList.add('portal-spotlight-target-emerald');
          window._parentActiveSpotlightEl = targetEl;

          calculateSpotlightPosition(targetEl, popover, arrow, '#059669', 'parent');
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
      try {
        const seen = localStorage.getItem('centrly_tour_v6_parent_completed');
        if (seen === 'true') return;
      } catch (_) {}
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
        localStorage.setItem('centrly_tour_v6_parent_completed', 'true');
      } catch (_) {}
    }
  };

  // 4. Global window resize & orientation change listener
  window.addEventListener('resize', () => {
    if (window._studentActiveSpotlightEl && document.getElementById('student-spotlight-popover')?.style.display === 'block') {
      const popover = document.getElementById('student-spotlight-popover');
      const arrow = document.getElementById('student-spotlight-arrow');
      calculateSpotlightPosition(window._studentActiveSpotlightEl, popover, arrow, '#2563eb', 'student');
    }
    if (window._parentActiveSpotlightEl && document.getElementById('parent-spotlight-popover')?.style.display === 'block') {
      const popover = document.getElementById('parent-spotlight-popover');
      const arrow = document.getElementById('parent-spotlight-arrow');
      calculateSpotlightPosition(window._parentActiveSpotlightEl, popover, arrow, '#059669', 'parent');
    }
  });

  // Global window scroll listener to re-align coachmark cleanly
  let _spotlightScrollTimer = null;
  window.addEventListener('scroll', () => {
    if (_spotlightScrollTimer) return;
    _spotlightScrollTimer = setTimeout(() => {
      _spotlightScrollTimer = null;
      if (window._studentActiveSpotlightEl && document.getElementById('student-spotlight-popover')?.style.display === 'block') {
        const popover = document.getElementById('student-spotlight-popover');
        const arrow = document.getElementById('student-spotlight-arrow');
        calculateSpotlightPosition(window._studentActiveSpotlightEl, popover, arrow, '#2563eb', 'student');
      }
      if (window._parentActiveSpotlightEl && document.getElementById('parent-spotlight-popover')?.style.display === 'block') {
        const popover = document.getElementById('parent-spotlight-popover');
        const arrow = document.getElementById('parent-spotlight-arrow');
        calculateSpotlightPosition(window._parentActiveSpotlightEl, popover, arrow, '#059669', 'parent');
      }
    }, 100);
  }, { passive: true });

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
