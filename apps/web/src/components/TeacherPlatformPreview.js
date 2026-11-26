import { getIcon } from '../utils/icons.js?v=9.99.8';

/**
 * Side-by-side platform preview for teachers on Starter/Basic/Trial plans.
 * Slide 1 showcases the branded external login page (with teacher portrait cutout),
 * Slide 2 peeks beside it and auto-scrolls smoothly to reveal the student dashboard.
 */
export const PREVIEW_CAROUSEL_CSS = `
      .ppv-showcase{display:grid;gap:12px;width:100%;max-width:1040px;min-width:0}
      .ppv-controls{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .ppv-pills{display:flex;gap:8px;flex-wrap:wrap;min-width:0}
      .ppv-pill{display:inline-flex;align-items:center;gap:6px;min-height:38px;padding:6px 14px;border:1px solid #cbd5e1;border-radius:999px;background:#fff;color:#334155;font:inherit;font-size:.82rem;font-weight:700;cursor:pointer;transition:all .18s ease}
      .ppv-pill:hover{border-color:#0f766e;color:#064e3b}
      .ppv-pill.is-active{background:#064e3b;border-color:#064e3b;color:#fff;box-shadow:0 4px 12px rgba(6,78,59,.18)}
      .ppv-pill:focus-visible,.ppv-arrow:focus-visible{outline:3px solid #2563eb;outline-offset:2px}
      .ppv-arrows{display:flex;align-items:center;gap:6px}
      .ppv-arrow{display:inline-flex;align-items:center;justify-content:center;width:36px;height:36px;border-radius:10px;border:1px solid #cbd5e1;background:#fff;color:#1e293b;cursor:pointer;font:inherit;transition:all .15s ease}
      .ppv-arrow:hover{background:#f1f5f9;border-color:#94a3b8}
      .ppv-track{display:flex;gap:16px;overflow-x:auto;scroll-snap-type:x mandatory;scroll-behavior:smooth;padding:4px 2px 12px;scrollbar-width:thin;scrollbar-color:#cbd5e1 transparent}
      .ppv-track::-webkit-scrollbar{height:6px}
      .ppv-track::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:999px}
      .ppv-slide{flex:0 0 84%;min-width:0;scroll-snap-align:start;border:1px solid #dbe4f1;border-radius:18px;overflow:hidden;background:#fff;box-shadow:0 8px 28px rgba(15,23,42,.06);display:flex;flex-direction:column}
      .ppv-slide-bar{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:10px 14px;background:#f8fafc;border-bottom:1px solid #e2e8f0}
      .ppv-slide-title{font-size:.84rem;font-weight:800;color:#0f172a}
      .ppv-url{font-size:.74rem;font-weight:700;color:#065f46;background:#ecfdf5;border:1px solid #a7f3d0;padding:3px 10px;border-radius:999px;direction:ltr;unicode-bidi:isolate}
      @media(max-width:760px){.ppv-slide{flex:0 0 90%}}
`;

export function renderTeacherPlatformPreview(en = false) {
  const dir = en ? 'ltr' : 'rtl';
  return `
  <div class="ppv-showcase" data-platform-preview data-preview-carousel dir="${dir}">
    <style>
      ${PREVIEW_CAROUSEL_CSS}

      /* Slide 1: Branded External Login + Teacher Pop-Out Cutout */
      .ppv-login-canvas{flex:1;background:linear-gradient(135deg,#064e3b 0%,#022c22 100%);color:#fff;padding:18px 22px 22px;display:flex;flex-direction:column;gap:16px;position:relative;overflow:hidden}
      .ppv-login-nav{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .ppv-login-brand{display:flex;align-items:center;gap:10px}
      .ppv-login-badge{width:36px;height:36px;border-radius:10px;background:#fff;color:#064e3b;display:grid;place-items:center;font-weight:900;font-size:1.05rem;box-shadow:0 4px 12px rgba(0,0,0,.22);flex-shrink:0}
      .ppv-login-brand strong{display:block;font-size:.9rem;line-height:1.3;color:#fff}
      .ppv-login-brand small{display:block;font-size:.7rem;color:rgba(255,255,255,.78);direction:ltr}
      .ppv-login-grid{display:grid;grid-template-columns:0.88fr 1.12fr;gap:20px;align-items:center;flex:1}
      .ppv-portrait-stage{position:relative;display:flex;flex-direction:column;align-items:center;justify-content:flex-end;min-height:255px}
      .ppv-circle{position:relative;width:210px;height:210px;border-radius:50%;background:radial-gradient(circle,#10b981 0%,#022c22 100%);border:3px solid rgba(255,255,255,.28);box-shadow:0 18px 40px rgba(0,0,0,.4),0 0 28px rgba(16,185,129,.32);display:flex;align-items:flex-end;justify-content:center;overflow:visible}
      .ppv-circle::before{content:'';position:absolute;inset:12px;border-radius:50%;border:1.5px dashed rgba(255,255,255,.25);pointer-events:none}
      .ppv-cutout-clip{position:relative;width:210px;height:248px;margin-top:-38px;border-radius:0 0 105px 105px;overflow:hidden;display:flex;align-items:flex-end;justify-content:center;z-index:2}
      .ppv-cutout-clip img{width:92%;height:auto;max-height:242px;object-fit:contain;object-position:bottom center;filter:drop-shadow(0 10px 18px rgba(0,0,0,.38));pointer-events:none}
      .ppv-teacher-chip{margin-top:10px;padding:4px 12px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);font-size:.74rem;font-weight:700;color:#ecfdf5;backdrop-filter:blur(6px)}
      .ppv-login-col{display:grid;gap:10px;min-width:0}
      .ppv-login-col h3{margin:0;font-size:1.15rem;font-weight:900;line-height:1.4;color:#fff}
      .ppv-login-col>p{margin:0;font-size:.78rem;line-height:1.6;color:rgba(255,255,255,.84)}
      .ppv-glass-form{background:rgba(255,255,255,.09);border:1px solid rgba(255,255,255,.18);border-radius:14px;padding:14px;display:grid;gap:9px;backdrop-filter:blur(10px);box-shadow:0 12px 28px rgba(0,0,0,.22)}
      .ppv-glass-form h4{margin:0;font-size:.86rem;font-weight:800;color:#fff}
      .ppv-fake-field{display:grid;gap:4px}
      .ppv-fake-field span{font-size:.7rem;font-weight:700;color:rgba(255,255,255,.82)}
      .ppv-fake-input{height:32px;border-radius:8px;background:rgba(0,0,0,.28);border:1px solid rgba(255,255,255,.16);padding:0 10px;display:flex;align-items:center;font-size:.74rem;color:rgba(255,255,255,.72);direction:ltr}
      .ppv-fake-cta{height:36px;border-radius:8px;background:#fff;color:#064e3b;font-size:.8rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:6px;margin-top:2px;box-shadow:0 4px 12px rgba(0,0,0,.22)}

      /* Slide 2: Crisp Student Portal Dashboard Inside */
      .ppv-dash-canvas{flex:1;background:#f8fafc;display:grid;grid-template-columns:200px 1fr;min-height:330px;color:#0f172a}
      .ppv-dash-side{background:#fff;border-inline-end:1px solid #e2e8f0;padding:14px 12px;display:flex;flex-direction:column;gap:12px}
      .ppv-dash-head{display:flex;align-items:center;gap:8px;padding-bottom:10px;border-bottom:1px solid #f1f5f9}
      .ppv-dash-logo{width:30px;height:30px;border-radius:8px;background:#064e3b;color:#fff;display:grid;place-items:center;font-weight:900;font-size:.85rem;flex-shrink:0}
      .ppv-dash-head strong{display:block;font-size:.78rem;color:#0f172a;line-height:1.25}
      .ppv-dash-head small{display:block;font-size:.66rem;color:#059669;font-weight:700}
      .ppv-dash-menu{display:grid;gap:4px}
      .ppv-dash-item{display:flex;align-items:center;gap:8px;padding:7px 9px;border-radius:8px;font-size:.75rem;font-weight:700;color:#475569}
      .ppv-dash-item.is-on{background:#ecfdf5;color:#065f46;font-weight:800}
      .ppv-dash-student{margin-top:auto;padding-top:10px;border-top:1px solid #f1f5f9;font-size:.72rem;color:#475569;font-weight:700}
      .ppv-dash-main{padding:16px 18px;display:flex;flex-direction:column;gap:12px;min-width:0}
      .ppv-dash-title h3{margin:0;font-size:.96rem;font-weight:900;color:#0f172a}
      .ppv-dash-title p{margin:2px 0 0;font-size:.74rem;color:#64748b}
      .ppv-dash-hero{background:linear-gradient(125deg,#064e3b 0%,#0f766e 100%);color:#fff;border-radius:12px;padding:13px 15px;display:grid;gap:4px}
      .ppv-dash-hero strong{font-size:.88rem;font-weight:800;color:#fff}
      .ppv-dash-hero p{margin:0;font-size:.73rem;line-height:1.55;color:rgba(255,255,255,.88)}
      .ppv-metrics{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .ppv-metric{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:11px 12px;display:grid;gap:4px;min-width:0}
      .ppv-metric-top{display:flex;align-items:center;justify-content:space-between;gap:6px}
      .ppv-metric-top span:first-child{font-size:.73rem;font-weight:700;color:#475569}
      .ppv-tag{font-size:.66rem;font-weight:800;padding:2px 7px;border-radius:999px;background:#ecfdf5;color:#065f46;white-space:nowrap}
      .ppv-tag.warn{background:#fffbeb;color:#b45309}
      .ppv-metric strong{font-size:1.25rem;font-weight:900;color:#0f172a;line-height:1.2}
      .ppv-metric small{font-size:.69rem;color:#64748b;line-height:1.35}

      @media(max-width:760px){
        .ppv-slide{flex:0 0 90%}
        .ppv-login-grid{grid-template-columns:1fr;text-align:center}
        .ppv-portrait-stage{min-height:200px}
        .ppv-circle{width:168px;height:168px}
        .ppv-cutout-clip{width:168px;height:200px;margin-top:-32px}
        .ppv-cutout-clip img{max-height:195px}
        .ppv-dash-canvas{grid-template-columns:1fr}
        .ppv-dash-side{border-inline-end:0;border-bottom:1px solid #e2e8f0}
        .ppv-dash-menu{grid-template-columns:repeat(3,minmax(0,1fr))}
        .ppv-metrics{grid-template-columns:1fr}
      }
    </style>

    <div class="ppv-controls">
      <div class="ppv-pills" role="tablist" aria-label="${en ? 'Platform preview screens' : 'شاشات معاينة المنصة'}">
        <button type="button" role="tab" class="ppv-pill is-active" data-preview-target="0" aria-selected="true">
          <span>${en ? '1 · Public Login & Teacher View' : '١ · الواجهة الخارجية (تسجيل الدخول وصورة المدرس)'}</span>
        </button>
        <button type="button" role="tab" class="ppv-pill" data-preview-target="1" aria-selected="false">
          <span>${en ? '2 · Inside Student Dashboard' : '٢ · بوابة الطالب من الداخل'}</span>
        </button>
      </div>
      <div class="ppv-arrows">
        <button type="button" class="ppv-arrow" data-preview-step="-1" aria-label="${en ? 'Previous screen' : 'الشاشة السابقة'}" title="${en ? 'Previous screen' : 'الشاشة السابقة'}">${en ? '‹' : '›'}</button>
        <button type="button" class="ppv-arrow" data-preview-step="1" aria-label="${en ? 'Next screen' : 'الشاشة التالية'}" title="${en ? 'Next screen' : 'الشاشة التالية'}">${en ? '›' : '‹'}</button>
      </div>
    </div>

    <div class="ppv-track" tabindex="0" aria-label="${en ? 'Horizontal platform preview' : 'معرض شاشات المنصة'}">
      <!-- Slide 1: External Branded Login + Teacher Photo -->
      <article class="ppv-slide" data-preview-slide="0">
        <div class="ppv-slide-bar">
          <span class="ppv-slide-title">${en ? '1 · Public Platform & Student Login (with your photo)' : '١ · شكل المنصة من برا · صفحة دخول الطلاب وصورتك'}</span>
          <span class="ppv-url">karim-physics.centerly-eg.com/login</span>
        </div>
        <div class="ppv-login-canvas" aria-hidden="true">
          <div class="ppv-login-nav">
            <div class="ppv-login-brand">
              <div class="ppv-login-badge">${en ? 'K' : 'ك'}</div>
              <div>
                <strong>${en ? 'Mr. Karim Platform · Physics' : 'منصة مستر كريم · الفيزياء'}</strong>
                <small>karim-physics.centerly-eg.com</small>
              </div>
            </div>
          </div>

          <div class="ppv-login-grid">
            <div class="ppv-portrait-stage">
              <div class="ppv-circle">
                <div class="ppv-cutout-clip">
                  <img src="/teacher_cutout.png" alt="${en ? 'Teacher portrait preview' : 'مثال لصورة المدرس بالواجهة'}">
                </div>
              </div>
              <span class="ppv-teacher-chip">${en ? 'Mr. Karim Mahmoud · Secondary' : 'أ. كريم محمود · الفيزياء للثانوية'}</span>
            </div>

            <div class="ppv-login-col">
              <h3>${en ? 'Your complete learning portal for top grades' : 'بوابتك التعليمية الشاملة للتفوق والدرجة النهائية'}</h3>
              <p>${en ? 'Lessons, interactive homework, and online exams under your own brand.' : 'شروحات منظمة، واجبات تفاعلية، وامتحانات دورية باسمك وهويتك الخاصة.'}</p>

              <div class="ppv-glass-form">
                <h4>${en ? 'Student Sign In' : 'تسجيل دخول الطلاب'}</h4>
                <div class="ppv-fake-field">
                  <span>${en ? 'Student phone or code' : 'رقم هاتف الطالب (أو كود الطالب)'}</span>
                  <div class="ppv-fake-input">010 •••• ••12</div>
                </div>
                <div class="ppv-fake-field">
                  <span>${en ? 'Password' : 'كلمة المرور'}</span>
                  <div class="ppv-fake-input">••••••</div>
                </div>
                <div class="ppv-fake-cta">${en ? 'Enter My Platform →' : 'دخول إلى منصتي ←'}</div>
              </div>
            </div>
          </div>
        </div>
      </article>

      <!-- Slide 2: Clean Native Student Dashboard Inside -->
      <article class="ppv-slide" data-preview-slide="1">
        <div class="ppv-slide-bar">
          <span class="ppv-slide-title">${en ? '2 · Inside Student Portal (sample data)' : '٢ · شكل المنصة من جوه · بوابة الطالب (بيانات توضيحية)'}</span>
          <span class="ppv-url">karim-physics.centerly-eg.com/dashboard</span>
        </div>
        <div class="ppv-dash-canvas" aria-hidden="true">
          <aside class="ppv-dash-side">
            <div class="ppv-dash-head">
              <div class="ppv-dash-logo">${en ? 'K' : 'ك'}</div>
              <div>
                <strong>${en ? 'Mr. Karim Platform' : 'منصة مستر كريم'}</strong>
                <small>${en ? 'Online & Center' : 'بوابة الطالب'}</small>
              </div>
            </div>
            <div class="ppv-dash-menu">
              <div class="ppv-dash-item is-on">${getIcon('dashboard', 14)}<span>${en ? 'Overview' : 'الرئيسية والمتابعة'}</span></div>
              <div class="ppv-dash-item">${getIcon('homework', 14)}<span>${en ? 'Homework' : 'الواجبات والتسليم'}</span></div>
              <div class="ppv-dash-item">${getIcon('clock', 14)}<span>${en ? 'Exams' : 'الامتحانات'}</span></div>
              <div class="ppv-dash-item">${getIcon('video', 14)}<span>${en ? 'Lessons' : 'المحاضرات والشرح'}</span></div>
              <div class="ppv-dash-item">${getIcon('materials', 14)}<span>${en ? 'Materials' : 'المذكرات والملازم'}</span></div>
            </div>
            <div class="ppv-dash-student">${en ? 'Student: Ahmed · #1042' : 'الطالب: أحمد محمد · كود ١٠٤٢'}</div>
          </aside>

          <div class="ppv-dash-main">
            <div class="ppv-dash-title">
              <h3>${en ? 'Overview & Progress' : 'الرئيسية ومتابعة المستوى'}</h3>
              <p>${en ? 'Live summary of attendance, videos, homework, and quizzes' : 'لوحة متابعة الأداء والمهام الدراسية والاختبارات'}</p>
            </div>

            <div class="ppv-dash-hero">
              <strong>${en ? 'Your Study Hub' : 'متابعتك الدراسية'}</strong>
              <p>${en ? 'Watch lessons, upload homework answers, and check online quiz results anytime.' : 'مرحباً بك في منصتك التعليمية المتكاملة. تابع محاضراتك، وأنجز واجباتك، واستعد للكويزات أولاً بأول.'}</p>
            </div>

            <div class="ppv-metrics">
              <div class="ppv-metric">
                <div class="ppv-metric-top"><span>${en ? 'Attendance' : 'نسبة الالتزام بالحضور'}</span><span class="ppv-tag">${en ? 'Great' : 'ممتاز'}</span></div>
                <strong>${en ? '95%' : '٩٥٪'}</strong>
                <small>${en ? 'Scheduled sessions attended' : 'حضور جميع الحصص المجدولة بالسنتر'}</small>
              </div>
              <div class="ppv-metric">
                <div class="ppv-metric-top"><span>${en ? 'Video lessons' : 'المحاضرات والشرح'}</span><span class="ppv-tag">${en ? 'Ready' : 'متاح'}</span></div>
                <strong>${en ? '12' : '١٢'}</strong>
                <small>${en ? 'Recorded lessons available' : 'محاضرة شرح وتدريب متاحة'}</small>
              </div>
              <div class="ppv-metric">
                <div class="ppv-metric-top"><span>${en ? 'Pending homework' : 'الواجبات والتكليفات'}</span><span class="ppv-tag warn">${en ? 'Review' : 'متابعة'}</span></div>
                <strong>${en ? '3' : '٣'}</strong>
                <small>${en ? 'Assignments waiting upload' : 'واجبات قيد التسليم والمراجعة'}</small>
              </div>
              <div class="ppv-metric">
                <div class="ppv-metric-top"><span>${en ? 'Quiz average' : 'متوسط نتائج الكويزات'}</span><span class="ppv-tag">${en ? 'Graded' : 'معتمد'}</span></div>
                <strong>${en ? '88%' : '٨٨٪'}</strong>
                <small>${en ? 'Across recent assessments' : 'متوسط الدرجات في الاختبارات الأخيرة'}</small>
              </div>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>`;
}

/**
 * Attaches smooth auto-scroll & pill navigation to the rendered platform preview showcase.
 */
export function initTeacherPlatformPreviewCarousel() {
  const roots = document.querySelectorAll('[data-preview-carousel], [data-platform-preview]');
  for (const root of roots) initSinglePreviewCarousel(root);
}

function initSinglePreviewCarousel(root) {
  if (!root || root.dataset.carouselBound) return;
  root.dataset.carouselBound = 'true';
  const track = root.querySelector('.ppv-track');
  const slides = [...root.querySelectorAll('[data-preview-slide]')];
  const pills = [...root.querySelectorAll('[data-preview-target]')];
  const arrows = [...root.querySelectorAll('[data-preview-step]')];
  if (!track || slides.length < 2) return;

  let activeIndex = 0;
  let pausedByUser = false;
  let pointerInside = false;
  let resumeTimer = null;
  let loopTimer = null;

  const setActivePill = (index) => {
    activeIndex = index;
    pills.forEach((pill, i) => {
      const active = i === index;
      pill.classList.toggle('is-active', active);
      pill.setAttribute('aria-selected', String(active));
    });
  };

  const scrollToSlide = (index) => {
    const target = slides[index];
    if (!target || !track.isConnected) return;
    setActivePill(index);
    const isRtl = getComputedStyle(track).direction === 'rtl';
    const delta = isRtl
      ? target.getBoundingClientRect().right - track.getBoundingClientRect().right
      : target.getBoundingClientRect().left - track.getBoundingClientRect().left;
    track.scrollTo({ left: track.scrollLeft + delta, behavior: 'smooth' });
  };

  slides.forEach((slide, idx) => {
    slide.style.cursor = 'pointer';
    slide.addEventListener('click', () => {
      if (idx !== activeIndex) {
        pauseTemporarily();
        scrollToSlide(idx);
      }
    });
  });

  const pauseTemporarily = (ms = 9000) => {
    pausedByUser = true;
    clearTimeout(resumeTimer);
    resumeTimer = setTimeout(() => { pausedByUser = false; }, ms);
  };

  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const targetIndex = Number(pill.dataset.previewTarget);
      if (Number.isInteger(targetIndex) && slides[targetIndex]) {
        pauseTemporarily();
        scrollToSlide(targetIndex);
      }
    });
  });

  arrows.forEach((arrow) => {
    arrow.addEventListener('click', () => {
      const step = Number(arrow.dataset.previewStep) || 1;
      const nextIndex = (activeIndex + step + slides.length) % slides.length;
      pauseTemporarily();
      scrollToSlide(nextIndex);
    });
  });

  track.addEventListener('pointerenter', () => { pointerInside = true; });
  track.addEventListener('pointerleave', () => { pointerInside = false; });
  track.addEventListener('touchstart', () => pauseTemporarily(10000), { passive: true });
  track.addEventListener('wheel', () => pauseTemporarily(8000), { passive: true });

  let scrollSyncTimer = null;
  track.addEventListener('scroll', () => {
    clearTimeout(scrollSyncTimer);
    scrollSyncTimer = setTimeout(() => {
      if (!track.isConnected) return;
      const trackCenter = track.getBoundingClientRect().left + track.clientWidth / 2;
      let closestIdx = 0;
      let closestDist = Infinity;
      slides.forEach((slide, i) => {
        const rect = slide.getBoundingClientRect();
        const dist = Math.abs(rect.left + rect.width / 2 - trackCenter);
        if (dist < closestDist) {
          closestDist = dist;
          closestIdx = i;
        }
      });
      setActivePill(closestIdx);
    }, 80);
  }, { passive: true });

  const reducedMotion = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (!reducedMotion) {
    const scheduleNext = (delay) => {
      clearTimeout(loopTimer);
      loopTimer = setTimeout(() => {
        if (!track.isConnected) return;
        if (!pausedByUser && !pointerInside) {
          scrollToSlide((activeIndex + 1) % slides.length);
        }
        scheduleNext(4200);
      }, delay);
    };
    // Initial nudge after 2.4s so the teacher sees the side card smoothly glide into view.
    scheduleNext(2400);
  }
}
