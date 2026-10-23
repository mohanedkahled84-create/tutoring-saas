import { isUserPro } from "../utils/proGating.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";

/**
 * Centrly Video Lessons Management View
 * Exclusively for Mr. Omar El-Mohammadi's tenant (Canary rollout)
 * Allows teachers to upload unlisted YouTube videos with homework-approval gating
 * and manual individual student exceptions.
 */

export function extractYouTubeId(url = "") {
  if (!url || typeof url !== "string") return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|&v=)([^#&?]*).*/;
  const match = url.trim().match(regExp);
  return (match && match[2] && match[2].length === 11) ? match[2] : null;
}

export function openVideoPlayerModal(url, title, watermarkText = "") {
  const ytId = extractYouTubeId(url);
  if (!ytId) {
    alert("رابط الفيديو غير صالح أو ليس رابط يوتيوب");
    return;
  }

  // Remove existing modal if any
  const existing = document.getElementById("centrlyVideoPlayerModal");
  if (existing) existing.remove();

  const modal = document.createElement("div");
  modal.id = "centrlyVideoPlayerModal";
  modal.style.cssText = `
    position: fixed; inset: 0; z-index: 999999;
    background: rgba(10, 15, 30, 0.92);
    backdrop-filter: blur(8px);
    display: flex; flex-direction: column;
    align-items: center; justify-content: center;
    padding: 1rem;
    direction: rtl;
    font-family: system-ui, -apple-system, sans-serif;
  `;

  const displayWatermark = watermarkText || "منصة سنترلي التعليمية • مشاهدة مؤمنة";

  modal.innerHTML = `
    <div style="width: 100%; max-width: 900px; display: flex; flex-direction: column; gap: 0.75rem;">
      <!-- Header -->
      <div style="display: flex; justify-content: space-between; align-items: center; color: #fff;">
        <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
          <span style="display: flex; align-items: center; color: #38bdf8;">${getIcon('video', 20, '#38bdf8')}</span>
          <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: #f8fafc; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${escapeHtml(title || "مشاهدة الفيديو")}
          </h3>
        </div>
        <button id="closeCentrlyVideoModal" style="background: rgba(255,255,255,0.15); border: none; color: #fff; width: 34px; height: 34px; border-radius: 50%; cursor: pointer; display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: background 0.2s;">
          ${getIcon('close', 18, '#ffffff')}
        </button>
      </div>

      <!-- Video Container with Watermark -->
      <div style="position: relative; width: 100%; aspect-ratio: 16/9; background: #000; border-radius: 0.75rem; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.6); border: 1px solid rgba(255,255,255,0.1);">
        <iframe 
          id="centrlyVideoIframe" src="https://www.youtube.com/embed/${encodeURIComponent(ytId)}?enablejsapi=1&autoplay=1&rel=0&modestbranding=1" 
          title="${escapeHtml(title || "Video")}"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
          allowfullscreen 
          style="width: 100%; height: 100%; border: none;">
        </iframe>

        <!-- Anti-piracy Floating / Drifting Watermark -->
        <div id="centrlyFloatingWatermark" style="position: absolute; pointer-events: none; user-select: none; z-index: 10; color: rgba(255, 255, 255, 0.45); font-size: 0.85rem; font-weight: 800; background: rgba(0, 0, 0, 0.35); padding: 4px 10px; border-radius: 6px; letter-spacing: 0.5px; text-shadow: 0 1px 2px rgba(0,0,0,0.8); transition: top 3s ease-in-out, left 3s ease-in-out;">
          ${escapeHtml(displayWatermark)}
        </div>
      </div>

      <!-- Watermark Security Note Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #94a3b8; padding: 0 0.5rem;">
        <span>هذا المحتوى محمي بحقوق النشر ومسجل باسم الطالب لمنع التداول غير المصرح به.</span>
        <span>بث مباشر مشفر</span>
      </div>
    </div>
  `;

  document.body.appendChild(modal);

  // Close handlers
  const closeBtn = modal.querySelector("#closeCentrlyVideoModal");
  if (closeBtn) {
    closeBtn.onclick = () => modal.remove();
  }
  modal.onclick = (e) => {
    if (e.target === modal) modal.remove();
  };

  // Drifting watermark animation
  const watermarkEl = modal.querySelector("#centrlyFloatingWatermark");
  if (watermarkEl) {
    const moveWatermark = () => {
      if (!document.body.contains(modal)) return;
      const top = Math.floor(Math.random() * 70 + 10);
      const left = Math.floor(Math.random() * 60 + 10);
      watermarkEl.style.top = top + "%";
      watermarkEl.style.left = left + "%";
    };
    moveWatermark();
    const interval = setInterval(() => {
      if (!document.body.contains(modal)) {
        clearInterval(interval);
      } else {
        moveWatermark();
      }
    }, 4500);
  }
}

// Global hook for student portal or external callers
if (typeof window !== "undefined") {
  window.centrlyPlayVideoWithWatermark = openVideoPlayerModal;
}

export function renderVideoLessonsView(
  materials = [],
  groups = [],
  students = [],
  selectedGroupId = "all",
  user = {}
) {
  const allMaterials = Array.isArray(materials) ? materials : [];
  const allGroups = Array.isArray(groups) ? groups : [];
  const allStudents = Array.isArray(students) ? students : [];

  // Filter video materials
  const videoMaterials = allMaterials.filter(m => m.type === "video");
  const homeworkList = allMaterials.filter(m => Boolean(m.is_homework));

  const filteredVideos = selectedGroupId === "all"
    ? videoMaterials
    : videoMaterials.filter(v => !v.group_id || v.group_id === selectedGroupId);

  const totalVideos = videoMaterials.length;
  const homeworkGatedCount = videoMaterials.filter(v => v.book_name === "approved_homework").length;
  const openCount = totalVideos - homeworkGatedCount;

  const isPro = isUserPro(user);

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      ${!isPro ? `
        <div style="background: #fffbeb; border: 1px solid #fde68a; color: #92400e; padding: 14px 18px; border-radius: 10px; display: flex; align-items: center; justify-content: space-between; gap: 14px; flex-wrap: wrap;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <div style="width: 32px; height: 32px; border-radius: 8px; background: #fef3c7; color: #b45309; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
              ${getIcon('info', 18, '#b45309')}
            </div>
            <div>
              <div style="font-weight: 800; font-size: 0.88rem;">أنت الآن في وضع المعاينة والاستعراض لميزات باقة PRO</div>
              <div style="font-size: 0.8rem; color: #b45309; margin-top: 2px;">يمكنك استعراض فيديوهات الشرح ونظام القفل التلقائي بالواجب، ولإضافة ونشر فيديوهات جديدة لطلابك يلزم الترقية لباقة PRO.</div>
            </div>
          </div>
          <button type="button" onclick="window.centrlyApp && window.centrlyApp.navigateTo('settings')" style="background: #b45309; color: #ffffff; border: none; padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; font-weight: 800; cursor: pointer; white-space: nowrap;">
            ترقية الحساب لباقة PRO
          </button>
        </div>
      ` : ''}

      <!-- Top Title & Action Header -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem; color: var(--centrly-blue-900);">
                <span>${getIcon('video', 24, 'var(--centrly-blue-700)')}</span>
                <span>فيديوهات الشرح والحل (منظومة يوتيوب المشروطة)</span>
              </h2>
              <span style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-size: 0.68rem; font-weight: 900; padding: 2px 8px; border-radius: 4px; letter-spacing: 0.5px;">PRO</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin-top: 0.25rem;">
              مشاركة فيديوهات يوتيوب غير مدرجة مع تقييد الفتح فقط للطلاب الذين <strong>تم اعتماد واجبهم</strong> أو تم منحهم <strong>استثناء يدوي</strong>.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddVideoLessonModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800;">
              ${getIcon('add', 16, '#ffffff')}
              <span>إضافة فيديو شرح جديد</span>
            </button>
          </div>
        </div>

        <!-- Filter & Metrics Row -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink);">المجموعة:</span>
            <select class="form-select" style="width: auto; height: 38px; padding: 0.4rem 2.25rem 0.4rem 0.85rem; font-size: 0.85rem; border-radius: 8px; font-weight: 700; border: 1.5px solid var(--centrly-line, #cbd5e1); background-color: #ffffff; cursor: pointer;" onchange="window.centrlyApp.handleVideoLessonGroupFilter(this.value)">
              <option value="all" ${selectedGroupId === 'all' ? 'selected' : ''}>كافة المجاميع الدراسية (${totalVideos} فيديو)</option>
              ${allGroups.map(g => `
                <option value="${escapeHtml(g.id)}" ${selectedGroupId === g.id ? 'selected' : ''}>
                  ${escapeHtml(g.name)}
                </option>
              `).join('')}
            </select>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <span class="badge badge-blue" style="font-size: 0.8rem; padding: 0.35rem 0.65rem;">
              إجمالي الفيديوهات: <strong>${filteredVideos.length}</strong>
            </span>
            <span class="badge badge-warning" style="font-size: 0.8rem; padding: 0.35rem 0.65rem;">
              مشروط باعتماد واجب: <strong>${homeworkGatedCount}</strong>
            </span>
            <span class="badge badge-success" style="font-size: 0.8rem; padding: 0.35rem 0.65rem;">
              متاح للجميع: <strong>${openCount}</strong>
            </span>
          </div>
        </div>
      </div>

      <!-- Videos Grid -->
      ${filteredVideos.length > 0 ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 1.25rem;">
          ${filteredVideos.map(video => {
            const ytId = extractYouTubeId(video.url);
            const thumbUrl = ytId ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg` : '';
            const matchedGroup = allGroups.find(g => g.id === video.group_id);
            const groupName = matchedGroup ? matchedGroup.name : 'جميع المجاميع';

            // Decode Gating Rules
            const isGatedByHw = video.book_name === 'approved_homework';
            let reqHwTitle = 'واجب مطلوب';
            let allowedStudents = [];

            try {
              if (video.questions) {
                const meta = JSON.parse(video.questions);
                if (meta.homework_title) reqHwTitle = meta.homework_title;
                if (Array.isArray(meta.allowed_student_ids)) allowedStudents = meta.allowed_student_ids;
              }
            } catch (_) {}

            if (isGatedByHw && reqHwTitle === 'واجب مطلوب' && video.pages) {
              const matchedHw = homeworkList.find(h => h.id === video.pages);
              if (matchedHw) reqHwTitle = matchedHw.title;
            }

            return `
              <div class="card" style="margin: 0; padding: 0; overflow: hidden; display: flex; flex-direction: column; border: 1px solid var(--centrly-line); box-shadow: var(--shadow-sm);">
                
                <!-- Video Thumbnail / Header -->
                <div style="position: relative; height: 180px; background: #0f172a; display: flex; align-items: center; justify-content: center; overflow: hidden;">
                  ${thumbUrl ? `
                    <img src="${escapeHtml(thumbUrl)}" alt="${escapeHtml(video.title)}" style="width: 100%; height: 100%; object-fit: cover; opacity: 0.85;">
                  ` : `
                    <div style="color: #94a3b8; display: flex; flex-direction: column; align-items: center; gap: 0.5rem;">
                      ${getIcon('video', 40, '#64748b')}
                      <span style="font-size: 0.8rem;">فيديو يوتيوب</span>
                    </div>
                  `}

                  <button onclick="window.centrlyApp.playVideoWithWatermark('${escapeHtml(video.url)}', '${escapeHtml(video.title)}')" 
                    style="position: absolute; width: 48px; height: 48px; border-radius: 50%; background: rgba(37,99,235,0.95); border: none; color: #fff; display: flex; align-items: center; justify-content: center; cursor: pointer; box-shadow: 0 4px 15px rgba(0,0,0,0.5); transition: transform 0.15s ease;"
                    title="مشاهدة وتجربة مشغل الفيديو بالعلامة المائية">
                    ${getIcon('sessions', 20, '#ffffff')}
                  </button>

                  <div style="position: absolute; bottom: 8px; right: 8px; background: rgba(0,0,0,0.75); color: #fff; font-size: 0.72rem; padding: 2px 6px; border-radius: 4px; font-weight: 700;">
                    ${escapeHtml(groupName)}
                  </div>
                </div>

                <!-- Video Details -->
                <div style="padding: 1rem; flex: 1; display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;">
                  <div>
                    <!-- Gating Status Tag -->
                    <div style="margin-bottom: 0.4rem;">
                      ${isGatedByHw ? `
                        <span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                          ${getIcon('lock', 12, '#b45309')}
                          <span>مشروط باعتماد: <strong>${escapeHtml(reqHwTitle)}</strong></span>
                        </span>
                      ` : `
                        <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                          ${getIcon('check', 12, '#15803d')}
                          <span>متاح لجميع طلاب المجموعة مباشرة</span>
                        </span>
                      `}
                    </div>

                    <h3 style="font-size: 1rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.35rem 0; line-height: 1.4;">
                      ${escapeHtml(video.title)}
                    </h3>

                    ${video.description && !video.description.startsWith('{') ? `
                      <p style="font-size: 0.8rem; color: var(--centrly-text); margin: 0; line-height: 1.4;">
                        ${escapeHtml(video.description)}
                      </p>
                    ` : ''}
                  </div>

                  <!-- Manual Exceptions Pill -->
                  ${isGatedByHw ? `
                    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem 0.75rem; display: flex; justify-content: space-between; align-items: center; font-size: 0.8rem;">
                      <span style="color: #64748b;">
                        استثناءات فتح يدوي: <strong style="color: var(--centrly-blue-800);">${allowedStudents.length} طلاب</strong>
                      </span>
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openVideoExceptionsModal('${escapeHtml(video.id)}')" style="padding: 0.2rem 0.5rem; font-size: 0.75rem; font-weight: 700;">
                        <span>تعديل الاستثناءات</span>
                      </button>
                    </div>
                  ` : ''}

                  <!-- Actions Footer -->
                  <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 0.75rem; border-top: 1px solid var(--centrly-line); margin-top: 0.25rem;">
                    <a href="${escapeHtml(video.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.8rem; color: var(--centrly-blue-700); font-weight: 700; text-decoration: none; display: flex; align-items: center; gap: 0.3rem;">
                      ${getIcon('link', 14)}
                      <span>فتح في YouTube</span>
                    </a>

                    <div style="display: flex; gap: 0.4rem;">
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.playVideoWithWatermark('${escapeHtml(video.url)}', '${escapeHtml(video.title)}')" title="مشاهدة الفيديو مع العلامة المائية">
                        ${getIcon('eye', 14)}
                        <span>معاينة</span>
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.deleteVideoLesson('${escapeHtml(video.id)}')" style="color: #dc2626;" title="حذف الفيديو">
                        ${getIcon('delete', 14, '#dc2626')}
                      </button>
                    </div>
                  </div>

                </div>

              </div>
            `;
          }).join('')}
        </div>
      ` : `
        <div class="card" style="text-align: center; padding: 3rem 1.5rem; margin: 0; color: #64748b;">
          <div style="display: flex; justify-content: center; margin-bottom: 0.75rem;">
            ${getIcon('video', 48, '#94a3b8')}
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.5rem 0;">
            لا توجد فيديوهات شرح مرفوعة بعد
          </h3>
          <p style="font-size: 0.85rem; max-width: 480px; margin: 0 auto 1.25rem auto; line-height: 1.5;">
            يمكنك رفع فيديوهات حل الواجبات أو شروحات الدروس وربطها بشرط اعتماد الواجب للطالب أو فتحها مباشرة.
          </p>
          <button class="btn btn-primary" onclick="window.centrlyApp.openAddVideoLessonModal()" style="font-weight: 700;">
            ${getIcon('add', 16, '#ffffff')}
            <span>إضافة أول فيديو شرح الآن</span>
          </button>
        </div>
      `}

    </div>
  `;
}

export function registerVideoLessonsActions(app) {
  // 1. Group filter handler
  app.handleVideoLessonGroupFilter = function(groupId) {
    this.videoLessonsGroupId = groupId;
    this.renderMainContent();
  };

  // 2. Open Add Video Lesson Modal
  app.openAddVideoLessonModal = function() {
    if (!isUserPro(this.user)) {
      alert('ميزة إضافة فيديوهات الشرح وربطها باعتماد الواجب متاحة فقط لمشتركي باقة PRO. اضغط حسناً للانتقال لصفحة الاشتراك والترقية.');
      if (this.navigateTo) this.navigateTo('settings');
      return;
    }
    const homeworkList = (this.materials || []).filter(m => Boolean(m.is_homework));
    const groupsList = this.groups || [];

    const bodyHtml = `
      <form id="modalAddVideoLessonForm" onsubmit="window.centrlyApp.handleAddVideoLessonSubmit(event)" style="display: flex; flex-direction: column; gap: 1rem; text-align: right;" dir="rtl">
        
        <div class="form-group">
          <label class="form-label" style="font-weight: 700; color: var(--centrly-ink);">عنوان الفيديو أو الدرس *</label>
          <input type="text" id="modalVideoTitle" class="form-input" placeholder="مثال: فيديو حل واجب المحاضرة الرابعة - الباب الأول" required>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700; color: var(--centrly-ink);">المجموعة الدراسية المستهدفة</label>
          <select id="modalVideoGroupId" class="form-select" style="width: 100%; height: 42px; border: 1.5px solid var(--centrly-line, #cbd5e1); border-radius: 8px; padding: 0.6rem 2.25rem 0.6rem 0.85rem; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--centrly-ink, #0f172a); background-color: #ffffff; cursor: pointer;">
            <option value="">جميع المجاميع</option>
            ${groupsList.map(g => `
              <option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>
            `).join('')}
          </select>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
            اختر مجموعة محددة أو اتركها لجميع المجاميع.
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700; color: var(--centrly-ink);">رابط فيديو يوتيوب (غير مدرج / Unlisted) *</label>
          <input type="url" id="modalVideoUrl" class="form-input" placeholder="https://www.youtube.com/watch?v=... أو https://youtu.be/..." dir="ltr" required>
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
            يفضل رفع الفيديو كـ (غير مدرج - Unlisted) على يوتيوب لضمان خصوصية المحتوى لطلابك.
          </div>
        </div>

        <!-- Gating Rules Option -->
        <div class="form-group" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.85rem;">
          <label class="form-label" style="font-weight: 800; color: var(--centrly-blue-900); margin-bottom: 0.5rem; display: block;">
            شروط فتح ومشاهدة الفيديو للطلاب:
          </label>

          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; font-size: 0.875rem;">
              <input type="radio" name="videoGatingChoice" value="open" onchange="window.centrlyApp.toggleVideoGatingFields('open')" checked style="margin-top: 3px;">
              <div>
                <strong style="color: #1e293b;">متاح للجميع مباشرة</strong>
                <div style="font-size: 0.75rem; color: #64748b;">يستطيع أي طالب في المجموعة فتح ومشاهدة الفيديو في أي وقت.</div>
              </div>
            </label>

            <label style="display: flex; align-items: flex-start; gap: 0.5rem; cursor: pointer; font-size: 0.875rem;">
              <input type="radio" name="videoGatingChoice" value="approved_homework" onchange="window.centrlyApp.toggleVideoGatingFields('approved_homework')" style="margin-top: 3px;">
              <div>
                <strong style="color: #1e293b;">مشروط باعتماد واجب محدد (Gated by Approved Homework)</strong>
                <div style="font-size: 0.75rem; color: #64748b;">لا يفتح الفيديو إلا للطالب الذي قمت أنت باعتماد واجبه (Approved)، مع إمكانية منح استثناء يدوي لأي طالب.</div>
              </div>
            </label>
          </div>

          <!-- Homework Selection Dropdown (Hidden by default) -->
          <div id="videoHomeworkSelectContainer" style="display: none; margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px dashed #cbd5e1;">
            <label class="form-label" style="font-weight: 700; color: #1e293b;">اختر الواجب المشروط اعتماده:</label>
            ${homeworkList.length > 0 ? `
              <select id="modalVideoRequiredHwId" class="form-select" style="width: 100%; height: 42px; border: 1.5px solid var(--centrly-line, #cbd5e1); border-radius: 8px; padding: 0.6rem 2.25rem 0.6rem 0.85rem; font-family: inherit; font-size: 0.875rem; font-weight: 600; color: var(--centrly-ink, #0f172a); background-color: #ffffff; cursor: pointer;">
                ${homeworkList.map(hw => `
                  <option value="${escapeHtml(hw.id)}">${escapeHtml(hw.title)}</option>
                `).join('')}
              </select>
              <div style="font-size: 0.75rem; color: #0284c7; margin-top: 0.35rem; display: flex; align-items: center; gap: 0.3rem;">
                ${getIcon('info', 14, '#0284c7')}
                <span>الطالب الذي لم يتم اعتماد واجبه بعد سيظهر له إشعار بأن المحتوى مغلق حتى اعتماد الواجب.</span>
              </div>
            ` : `
              <div style="background: #fef2f2; border: 1px solid #fecaca; border-radius: 6px; padding: 0.6rem; font-size: 0.8rem; color: #991b1b;">
                تنبيه: لا يوجد لديك واجبات مضافة حالياً. يمكنك إضافة واجب أولاً من قسم الواجبات أو اختيار "متاح للجميع".
              </div>
            `}
          </div>
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700; color: var(--centrly-ink);">وصف أو تعليمات إضافية (اختياري)</label>
          <textarea id="modalVideoDescription" class="form-input" rows="2" placeholder="اكتب أي ملاحظات أو نقاط هامة للطلاب قبل المشاهدة..."></textarea>
        </div>

      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddVideoLessonForm" id="btnSubmitVideoLesson" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">
        حفظ ونشر الفيديو الآن
      </button>
    `;

    this.showModal("إضافة فيديو شرح / حل واجب جديد", bodyHtml, footerHtml);
  };

  // 3. Toggle Gating Fields
  app.toggleVideoGatingFields = function(mode) {
    const container = document.getElementById("videoHomeworkSelectContainer");
    if (container) {
      container.style.display = (mode === "approved_homework") ? "block" : "none";
    }
  };

  // 4. Handle Add Video Lesson Submit
  app.handleAddVideoLessonSubmit = async function(e) {
    e.preventDefault();
    const title = document.getElementById("modalVideoTitle")?.value.trim();
    const group_id = document.getElementById("modalVideoGroupId")?.value || null;
    const url = document.getElementById("modalVideoUrl")?.value.trim();
    const description = document.getElementById("modalVideoDescription")?.value.trim();
    const gatingChoice = document.querySelector('input[name="videoGatingChoice"]:checked')?.value || "open";
    const reqHwSelect = document.getElementById("modalVideoRequiredHwId");
    const requiredHwId = reqHwSelect ? reqHwSelect.value : null;

    if (!title) {
      this.showToast("يرجى إدخال عنوان الفيديو", "error");
      return;
    }

    const ytId = extractYouTubeId(url);
    if (!ytId) {
      this.showToast("يرجى إدخال رابط يوتيوب صحيح (مثال: https://youtu.be/...)", "error");
      return;
    }

    if (gatingChoice === "approved_homework" && !requiredHwId) {
      this.showToast("يرجى اختيار الواجب المشروط اعتماده أو جعل الفيديو متاح للجميع", "error");
      return;
    }

    const homeworkList = (this.materials || []).filter(m => Boolean(m.is_homework));
    const matchedHw = homeworkList.find(h => h.id === requiredHwId);
    const homeworkTitle = matchedHw ? matchedHw.title : "الواجب المقرر";

    const questionsMeta = JSON.stringify({
      gating_type: gatingChoice,
      homework_id: requiredHwId,
      homework_title: homeworkTitle,
      allowed_student_ids: [],
    });

    const submitBtn = document.getElementById("btnSubmitVideoLesson");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "جاري الحفظ...";
    }

    try {
      const res = await request("/materials", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: description || null,
          type: "video",
          url,
          group_id,
          is_homework: false,
          book_name: gatingChoice, // 'approved_homework' or 'open'
          pages: (gatingChoice === "approved_homework") ? requiredHwId : null,
          questions: questionsMeta,
        }),
      });

      if (res && res.material) {
        if (!Array.isArray(this.materials)) this.materials = [];
        this.materials.unshift(res.material);
        this.saveCache("materials", this.materials);
        try {
          localStorage.setItem('centrly_materials', JSON.stringify(this.materials));
          localStorage.setItem('centrly_platform_content', JSON.stringify(this.materials));
        } catch (_) {}
        this.closeModal();
        this.showToast("تم نشر فيديو الشرح بنجاح", "success");
        this.renderMainContent();
      } else {
        throw new Error(res?.error?.message || "فشل حفظ الفيديو");
      }
    } catch (err) {
      console.error("Error creating video lesson:", err);
      this.showToast(err.message || "حدث خطأ أثناء حفظ الفيديو", "error");
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "حفظ ونشر الفيديو الآن";
      }
    }
  };

  // 5. Open Exceptions Modal for a Video
  app.openVideoExceptionsModal = function(videoId) {
    const video = (this.materials || []).find(m => m.id === videoId);
    if (!video) return;

    let allowedStudentIds = [];
    let reqHwTitle = "الواجب المطلوب";
    try {
      if (video.questions) {
        const meta = JSON.parse(video.questions);
        if (Array.isArray(meta.allowed_student_ids)) allowedStudentIds = meta.allowed_student_ids;
        if (meta.homework_title) reqHwTitle = meta.homework_title;
      }
    } catch (_) {}

    // Filter students by video group if group_id is present
    const allStudents = this.students || [];
    const eligibleStudents = video.group_id 
      ? allStudents.filter(s => s.group_id === video.group_id)
      : allStudents;

    this._currentExceptionsVideoId = videoId;
    this._currentAllowedStudentIds = new Set(allowedStudentIds);

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 0.85rem; text-align: right;" dir="rtl">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.75rem; font-size: 0.85rem; color: #166534;">
          <strong>منح استثناءات يدوية للطلاب:</strong>
          <div style="font-size: 0.78rem; color: #15803d; margin-top: 0.2rem;">
            الطلاب المحددة أسماؤهم هنا سيتمكنون من مشاهدة الفيديو <strong>حتى لو لم يتم اعتماد واجبهم</strong> (${escapeHtml(reqHwTitle)}).
          </div>
        </div>

        <!-- Quick Search -->
        <div style="position: relative;">
          <input type="text" id="exceptionsSearchInput" class="form-input" placeholder="بحث باسم الطالب أو كود الطالب..." oninput="window.centrlyApp.filterExceptionsStudentList(this.value)">
        </div>

        <!-- Students List with Checkboxes -->
        <div id="exceptionsStudentListContainer" style="max-height: 280px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem;">
          ${eligibleStudents.length > 0 ? eligibleStudents.map(st => {
            const isChecked = this._currentAllowedStudentIds.has(st.id) || this._currentAllowedStudentIds.has(st.student_code);
            return `
              <label class="student-exception-row" data-name="${escapeHtml((st.name || '').toLowerCase())}" data-code="${escapeHtml((st.student_code || '').toLowerCase())}" style="display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.65rem; border-radius: 6px; background: ${isChecked ? '#eff6ff' : '#ffffff'}; border: 1px solid ${isChecked ? '#bfdbfe' : '#f1f5f9'}; cursor: pointer;">
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <input type="checkbox" value="${escapeHtml(st.id)}" ${isChecked ? 'checked' : ''} onchange="window.centrlyApp.toggleStudentException('${escapeHtml(st.id)}', this.checked)">
                  <div>
                    <div style="font-size: 0.85rem; font-weight: 700; color: #1e293b;">${escapeHtml(st.name || 'طالب')}</div>
                    <div style="font-size: 0.72rem; color: #64748b;">كود: ${escapeHtml(st.student_code || '-')} • هاتف: ${escapeHtml(st.student_phone || st.parent_phone || '-')}</div>
                  </div>
                </div>
                ${isChecked ? `
                  <span class="badge badge-blue" style="font-size: 0.7rem; padding: 2px 6px;">مستثنى ومفتوح</span>
                ` : ''}
              </label>
            `;
          }).join('') : `
            <div style="text-align: center; color: #94a3b8; padding: 1.5rem; font-size: 0.85rem;">
              لا يوجد طلاب مسجلين في هذه المجموعة بعد
            </div>
          `}
        </div>

        <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: #64748b;">
          <span id="exceptionsSelectedCount">تم تحديد ${this._currentAllowedStudentIds.size} طالب</span>
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.clearAllStudentExceptions()" style="font-size: 0.75rem; padding: 0.2rem 0.5rem;">إلغاء تحديد الكل</button>
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="button" class="btn btn-primary" onclick="window.centrlyApp.saveVideoLessonExceptions('${escapeHtml(videoId)}')" style="font-weight: 800; padding: 0.55rem 1.4rem;">
        حفظ الاستثناءات
      </button>
    `;

    this.showModal(`استثناءات فتح: ${video.title}`, bodyHtml, footerHtml);
  };

  // Toggle single exception
  app.toggleStudentException = function(studentId, isChecked) {
    if (!this._currentAllowedStudentIds) this._currentAllowedStudentIds = new Set();
    if (isChecked) {
      this._currentAllowedStudentIds.add(studentId);
    } else {
      this._currentAllowedStudentIds.delete(studentId);
    }
    const countEl = document.getElementById("exceptionsSelectedCount");
    if (countEl) countEl.textContent = `تم تحديد ${this._currentAllowedStudentIds.size} طالب`;
  };

  // Clear all exceptions
  app.clearAllStudentExceptions = function() {
    if (this._currentAllowedStudentIds) this._currentAllowedStudentIds.clear();
    const checkboxes = document.querySelectorAll("#exceptionsStudentListContainer input[type='checkbox']");
    checkboxes.forEach(cb => { cb.checked = false; });
    const countEl = document.getElementById("exceptionsSelectedCount");
    if (countEl) countEl.textContent = "تم تحديد 0 طالب";
  };

  // Filter students in exceptions modal
  app.filterExceptionsStudentList = function(query = "") {
    const q = query.trim().toLowerCase();
    const rows = document.querySelectorAll(".student-exception-row");
    rows.forEach(row => {
      const name = row.getAttribute("data-name") || "";
      const code = row.getAttribute("data-code") || "";
      if (!q || name.includes(q) || code.includes(q)) {
        row.style.display = "flex";
      } else {
        row.style.display = "none";
      }
    });
  };

  // Save video exceptions
  app.saveVideoLessonExceptions = async function(videoId) {
    const video = (this.materials || []).find(m => m.id === videoId);
    if (!video) return;

    let meta = {};
    try {
      if (video.questions) meta = JSON.parse(video.questions);
    } catch (_) {}

    meta.allowed_student_ids = Array.from(this._currentAllowedStudentIds || []);

    try {
      const res = await request(`/materials/${videoId}`, {
        method: "PATCH",
        body: JSON.stringify({
          questions: JSON.stringify(meta),
        }),
      });

      if (res && res.success) {
        video.questions = JSON.stringify(meta);
        this.saveCache("materials", this.materials);
        this.closeModal();
        this.showToast("تم حفظ استثناءات فتح الفيديو بنجاح", "success");
        this.renderMainContent();
      } else {
        throw new Error(res?.error?.message || "تعذر حفظ الاستثناءات");
      }
    } catch (err) {
      console.error("Error saving video exceptions:", err);
      this.showToast(err.message || "حدث خطأ أثناء حفظ الاستثناءات", "error");
    }
  };

  // 6. Delete Video Lesson
  app.deleteVideoLesson = async function(videoId) {
    if (!confirm("هل أنت متأكد من حذف هذا الفيديو؟ لن يتمكن الطلاب من مشاهدته بعد الآن.")) {
      return;
    }

    try {
      const res = await request(`/materials/${videoId}`, { method: "DELETE" });
      if (res && res.success) {
        if (Array.isArray(this.materials)) {
          this.materials = this.materials.filter(m => m.id !== videoId);
          this.saveCache("materials", this.materials);
          try {
            localStorage.setItem('centrly_materials', JSON.stringify(this.materials));
            localStorage.setItem('centrly_platform_content', JSON.stringify(this.materials));
          } catch (_) {}
        }
        this.showToast("تم حذف الفيديو بنجاح", "success");
        this.renderMainContent();
      } else {
        throw new Error(res?.error?.message || "تعذر حذف الفيديو");
      }
    } catch (err) {
      console.error("Error deleting video:", err);
      this.showToast(err.message || "حدث خطأ أثناء حذف الفيديو", "error");
    }
  };

  // 7. Play Video with Watermark
  app.playVideoWithWatermark = function(url, title, watermarkText = "") {
    const teacherName = this.user?.name || "الأستاذ عمر المحمدي";
    const defaultText = `${teacherName} • منصة سنترلي التعليمية • ${new Date().toLocaleDateString('ar-EG')}`;
    openVideoPlayerModal(url, title, watermarkText || defaultText);
  };
}
