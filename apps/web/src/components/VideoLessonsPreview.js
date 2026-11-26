import { getIcon } from '../utils/icons.js?v=9.99.8';
import { PREVIEW_CAROUSEL_CSS } from './TeacherPlatformPreview.js?v=9.99.8';

/**
 * Side-by-side YouTube & Video Lessons preview for teachers on Basic/Trial plans.
 * Slide 1 showcases the protected YouTube player with drifting student watermark,
 * Slide 2 peeks beside it showing homework gating, manual exceptions, and watch tracking.
 */
export function renderVideoLessonsPreview(en = false) {
  const dir = en ? 'ltr' : 'rtl';
  return `
  <div class="ppv-showcase" data-video-preview data-preview-carousel dir="${dir}">
    <style>
      ${PREVIEW_CAROUSEL_CSS}
      .vlp-pill-accent .ppv-pill.is-active{background:#0f172a;border-color:#0f172a;box-shadow:0 4px 12px rgba(15,23,42,.2)}
      .vlp-player-canvas{flex:1;background:linear-gradient(145deg,#0b1220 0%,#151f36 100%);color:#f8fafc;padding:18px 20px;display:flex;flex-direction:column;gap:12px}
      .vlp-player-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
      .vlp-player-title{display:flex;align-items:center;gap:8px;min-width:0;font-size:.86rem;font-weight:800;color:#fff}
      .vlp-yt-tag{display:inline-flex;align-items:center;gap:5px;padding:3px 10px;border-radius:999px;background:rgba(239,68,68,.18);border:1px solid rgba(248,113,113,.38);color:#fecaca;font-size:.7rem;font-weight:800;white-space:nowrap}
      .vlp-stage{position:relative;width:100%;aspect-ratio:16/8.6;border-radius:14px;overflow:hidden;background:radial-gradient(circle at 30% 25%,#1e3a8a 0%,#0f172a 60%,#020617 100%);border:1px solid rgba(148,163,184,.22);display:flex;align-items:center;justify-content:center;box-shadow:0 16px 32px rgba(0,0,0,.45)}
      .vlp-board-grid{position:absolute;inset:0;opacity:.22;background-image:linear-gradient(rgba(148,163,184,.35) 1px,transparent 1px),linear-gradient(90deg,rgba(148,163,184,.35) 1px,transparent 1px);background-size:28px 28px}
      .vlp-lesson-badge{position:relative;z-index:2;text-align:center;display:grid;gap:8px;place-items:center;padding:12px 18px}
      .vlp-play-circle{width:54px;height:54px;border-radius:50%;background:linear-gradient(135deg,#ef4444,#dc2626);color:#fff;display:grid;place-items:center;box-shadow:0 8px 24px rgba(239,68,68,.45);border:2px solid rgba(255,255,255,.35)}
      .vlp-lesson-badge strong{font-size:.94rem;font-weight:900;color:#fff}
      .vlp-lesson-badge span{font-size:.73rem;color:#cbd5e1}
      .vlp-watermark{position:absolute;z-index:4;padding:5px 11px;border-radius:7px;background:rgba(15,23,42,.52);border:1px solid rgba(255,255,255,.22);color:rgba(255,255,255,.82);font-size:.74rem;font-weight:800;letter-spacing:.4px;pointer-events:none;animation:vlpDrift 7s ease-in-out infinite;backdrop-filter:blur(3px)}
      @keyframes vlpDrift{
        0%{top:14%;left:12%}
        33%{top:62%;left:56%}
        66%{top:22%;left:60%}
        100%{top:14%;left:12%}
      }
      @media(prefers-reduced-motion:reduce){.vlp-watermark{animation:none;top:16%;left:14%}}
      .vlp-scrubber{position:absolute;left:12px;right:12px;bottom:10px;z-index:3;display:grid;gap:6px}
      .vlp-bar{height:4px;border-radius:999px;background:rgba(255,255,255,.22);overflow:hidden}
      .vlp-bar>i{display:block;width:42%;height:100%;background:#ef4444;border-radius:999px}
      .vlp-time{display:flex;justify-content:space-between;font-size:.68rem;color:#cbd5e1;font-weight:700;direction:ltr}
      .vlp-player-foot{display:flex;align-items:center;justify-content:space-between;gap:8px;flex-wrap:wrap;font-size:.72rem;color:#94a3b8}
      .vlp-done-pill{display:inline-flex;align-items:center;gap:5px;padding:5px 11px;border-radius:8px;background:#059669;color:#fff;font-weight:800;font-size:.74rem}
      .vlp-track-live{color:#38bdf8;font-weight:700}

      /* Slide 2: Teacher Control + Homework Gating + Live Watch Tracking */
      .vlp-manage-canvas{flex:1;background:#f8fafc;padding:16px 18px;display:flex;flex-direction:column;gap:12px;color:#0f172a}
      .vlp-chips{display:flex;flex-wrap:wrap;gap:6px}
      .vlp-chip{font-size:.71rem;font-weight:700;padding:4px 9px;border-radius:999px;background:#fff;border:1px solid #cbd5e1;color:#334155}
      .vlp-cards{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:10px}
      .vlp-card{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:11px 12px;display:grid;gap:7px;min-width:0}
      .vlp-badge-lock{display:inline-flex;align-items:center;gap:4px;width:fit-content;padding:2px 8px;border-radius:999px;background:#fffbeb;border:1px solid #fde68a;color:#b45309;font-size:.68rem;font-weight:800}
      .vlp-badge-open{display:inline-flex;align-items:center;gap:4px;width:fit-content;padding:2px 8px;border-radius:999px;background:#ecfdf5;border:1px solid #a7f3d0;color:#047857;font-size:.68rem;font-weight:800}
      .vlp-card strong{font-size:.82rem;font-weight:800;color:#0f172a;line-height:1.4}
      .vlp-exception{display:flex;align-items:center;justify-content:space-between;gap:6px;background:#f8fafc;border:1px solid #e2e8f0;border-radius:8px;padding:5px 8px;font-size:.7rem;color:#475569;font-weight:700}
      .vlp-watch-box{background:#fff;border:1px solid #e2e8f0;border-radius:12px;padding:10px 12px;display:grid;gap:6px}
      .vlp-watch-box h4{margin:0;font-size:.78rem;font-weight:800;color:#0f172a;display:flex;align-items:center;justify-content:space-between}
      .vlp-watch-row{display:flex;align-items:center;justify-content:space-between;gap:8px;padding-top:6px;border-top:1px solid #f1f5f9;font-size:.73rem}
      .vlp-status-ok{color:#059669;font-weight:800}
      .vlp-status-live{color:#2563eb;font-weight:800}
      .vlp-status-locked{color:#b45309;font-weight:800}
      @media(max-width:760px){.vlp-cards{grid-template-columns:1fr}}
    </style>

    <div class="ppv-controls vlp-pill-accent">
      <div class="ppv-pills" role="tablist" aria-label="${en ? 'Video lessons preview screens' : 'شاشات استعراض ميزة الفيديوهات'}">
        <button type="button" role="tab" class="ppv-pill is-active" data-preview-target="0" aria-selected="true">
          <span>${en ? '1 · Protected YouTube Player & Watermark' : '١ · مشغل يوتيوب محمي بعلامة مائية باسم الطالب'}</span>
        </button>
        <button type="button" role="tab" class="ppv-pill" data-preview-target="1" aria-selected="false">
          <span>${en ? '2 · Homework Gating & Watch Tracking' : '٢ · قفل بالواجب ومتابعة المشاهدة'}</span>
        </button>
      </div>
      <div class="ppv-arrows">
        <button type="button" class="ppv-arrow" data-preview-step="-1" aria-label="${en ? 'Previous screen' : 'الشاشة السابقة'}" title="${en ? 'Previous screen' : 'الشاشة السابقة'}">${en ? '‹' : '›'}</button>
        <button type="button" class="ppv-arrow" data-preview-step="1" aria-label="${en ? 'Next screen' : 'الشاشة التالية'}" title="${en ? 'Next screen' : 'الشاشة التالية'}">${en ? '›' : '‹'}</button>
      </div>
    </div>

    <div class="ppv-track" tabindex="0" aria-label="${en ? 'Horizontal video lessons preview' : 'معرض استعراض فيديوهات اليوتيوب'}">
      <!-- Slide 1: Protected Unlisted YouTube Player with Moving Student Watermark -->
      <article class="ppv-slide" data-preview-slide="0">
        <div class="ppv-slide-bar">
          <span class="ppv-slide-title">${en ? '1 · Unlisted YouTube inside Student Portal' : '١ · عرض فيديوهات يوتيوب (غير مدرج) داخل بوابة الطالب'}</span>
          <span class="ppv-url">YouTube Unlisted · Protected</span>
        </div>
        <div class="vlp-player-canvas" aria-hidden="true">
          <div class="vlp-player-head">
            <div class="vlp-player-title">
              ${getIcon('video', 18, '#38bdf8')}
              <span>${en ? 'Ch.1 Revision — Solving Circuit Problems' : 'مراجعة الفصل الأول — شرح وحل مسائل الدائرة الكهربية'}</span>
            </div>
            <span class="vlp-yt-tag">${en ? 'Unlisted YouTube' : 'فيديو يوتيوب غير مدرج'}</span>
          </div>

          <div class="vlp-stage">
            <div class="vlp-board-grid"></div>
            <div class="vlp-watermark">${en ? 'Ahmed Mohamed · #1042' : 'أحمد محمد · كود: ١٠٤٢'}</div>
            <div class="vlp-lesson-badge">
              <div class="vlp-play-circle">${getIcon('sessions', 22, '#ffffff')}</div>
              <strong>${en ? 'Play directly inside your platform' : 'تشغيل مباشر داخل منصتك بدون خروج الطالب'}</strong>
              <span>${en ? 'Live drifting student watermark discourages screen recording' : 'علامة مائية متحركة باسم وكود الطالب لمنع التسريب والتصوير'}</span>
            </div>
            <div class="vlp-scrubber">
              <div class="vlp-bar"><i></i></div>
              <div class="vlp-time"><span>18:24</span><span>42:10 · HD</span></div>
            </div>
          </div>

          <div class="vlp-player-foot">
            <div style="display:flex;align-items:center;gap:8px;flex-wrap:wrap">
              <span class="vlp-done-pill">${getIcon('check', 13, '#ffffff')} ${en ? 'Completed' : 'تمت المشاهدة'}</span>
              <span class="vlp-track-live">${en ? 'Watch status synced to teacher log' : 'توثيق المشاهدة تلقائياً في سجل المعلم ✔'}</span>
            </div>
            <span>${en ? 'Sample student preview' : 'نموذج توضيحي'}</span>
          </div>
        </div>
      </article>

      <!-- Slide 2: Teacher Control — Homework Gating, Manual Exceptions & Watch Log -->
      <article class="ppv-slide" data-preview-slide="1">
        <div class="ppv-slide-bar">
          <span class="ppv-slide-title">${en ? '2 · Control Access & Track Who Watched' : '٢ · التحكم في الفتح بالواجب ومتابعة المشاهدة'}</span>
          <span class="ppv-url">video-lessons · Pro</span>
        </div>
        <div class="vlp-manage-canvas" aria-hidden="true">
          <div class="vlp-chips">
            <span class="vlp-chip">${en ? 'Unlisted YouTube links' : 'روابط يوتيوب غير مدرجة'}</span>
            <span class="vlp-chip">${en ? 'Per-group targeting' : 'تخصيص حسب المجموعة'}</span>
            <span class="vlp-chip">${en ? 'Homework-approved lock' : 'ربط باعتماد الواجب'}</span>
            <span class="vlp-chip">${en ? 'Manual student exceptions' : 'استثناءات فتح يدوي'}</span>
          </div>

          <div class="vlp-cards">
            <div class="vlp-card">
              <span class="vlp-badge-lock">${getIcon('lock', 11, '#b45309')} ${en ? 'Requires: Lecture 3 HW approval' : 'مشروط باعتماد: واجب المحاضرة ٣'}</span>
              <strong>${en ? 'Lecture 3 Homework Walkthrough' : 'فيديو حل واجب المحاضرة الثالثة كاملاً'}</strong>
              <div class="vlp-exception">
                <span>${en ? 'Manual exceptions: 2 students' : 'استثناءات فتح يدوي: ٢ طلاب'}</span>
                <span style="color:#1d4ed8">${en ? 'Edit' : 'تعديل'}</span>
              </div>
            </div>

            <div class="vlp-card">
              <span class="vlp-badge-open">${getIcon('check', 11, '#047857')} ${en ? 'Open to Grade 3 Group' : 'متاح مباشرة لطلاب المجموعة'}</span>
              <strong>${en ? 'Core Concepts — Intro Lesson' : 'تأسيس المفاهيم الأساسية — الحصة الأولى'}</strong>
              <div class="vlp-exception">
                <span>${en ? 'Instant YouTube playback' : 'مشاهدة فورية داخل بوابة الطالب'}</span>
                <span style="color:#047857">${en ? 'Preview' : 'معاينة'}</span>
              </div>
            </div>
          </div>

          <div class="vlp-watch-box">
            <h4>
              <span>${en ? 'Live Watch Tracker (sample)' : 'متابعة مشاهدة الطلاب (بيانات توضيحية)'}</span>
              <span style="color:#64748b;font-weight:600">${en ? '3 students' : '٣ طلاب'}</span>
            </h4>
            <div class="vlp-watch-row">
              <span><strong>${en ? 'Ahmed Mohamed' : 'أحمد محمد'}</strong> · #1042</span>
              <span class="vlp-status-ok">${en ? 'Watched ✔ 100%' : 'شاهد الفيديو ✔'}</span>
            </div>
            <div class="vlp-watch-row">
              <span><strong>${en ? 'Sara Ali' : 'سارة علي'}</strong> · #1085</span>
              <span class="vlp-status-live">${en ? 'Watching now…' : 'يشاهد الآن…'}</span>
            </div>
            <div class="vlp-watch-row">
              <span><strong>${en ? 'Youssef Adel' : 'يوسف عادل'}</strong> · #1103</span>
              <span class="vlp-status-locked">${en ? 'Locked until HW approved' : 'مقفل لحين تسليم واعتماد الواجب'}</span>
            </div>
          </div>
        </div>
      </article>
    </div>
  </div>`;
}
