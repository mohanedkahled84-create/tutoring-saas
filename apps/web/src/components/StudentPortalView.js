import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { renderStudentBarcodeCardHtml, renderStudentAttendancePassHtml } from "../utils/studentBarcodeCard.js";
import { renderStudentPortalTourHtml } from "./PortalTourModal.js?v=6.5.0";
import { openVideoPlayerModal } from "./VideoLessonsView.js";
import { isMohanedKhaledStudent } from "../utils/proGating.js";

/**
 * Centrly Student Web Portal Component
 * Student-centric view prioritized for learners:
 * 1. Study Materials & Homework Upload (Top priority)
 * 2. Instant PDF uploader with direct Supabase Cloud storage
 * 3. Step-by-step JPG to PDF guide with iLovePDF link
 * 4. Quizzes & Exam Grades
 * 5. Attendance History & Teachers Notes
 */

export function resolveSafeMaterialUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (trimmed.includes('/storage/v1/object/sign/homework-submissions/')) {
    return trimmed
      .replace('/storage/v1/object/sign/homework-submissions/', '/storage/v1/object/public/homework-submissions/')
      .split('?')[0];
  }
  return trimmed;
}

export function renderStudentStudyMaterialCard(m, student = {}, homeworkMaterials = [], approvedHomeworks = []) {
  const isPdf = m.type === 'pdf';
  const isVideo = m.type === 'video';
  const resolvedMatUrl = resolveSafeMaterialUrl(m.url);
  const isGatedByHw = isVideo && m.book_name === 'approved_homework';

  let isUnlocked = true;
  let reqHwTitle = 'واجب مطلوب';
  let isSubmittedPending = false;

  if (isGatedByHw) {
    let allowedStudents = [];
    try {
      if (m.questions) {
        const meta = JSON.parse(m.questions);
        if (Array.isArray(meta.allowed_student_ids)) allowedStudents = meta.allowed_student_ids;
        if (meta.homework_title) reqHwTitle = meta.homework_title;
      }
    } catch (_) {}

    const studentId = student.id || '';
    const studentCode = student.student_code || '';
    const isBypassed = Boolean(
      (studentId && allowedStudents.includes(studentId)) ||
      (studentCode && allowedStudents.includes(studentCode))
    );

    const reqHwId = m.pages;
    if (reqHwId && reqHwTitle === 'واجب مطلوب') {
      const matchedHw = homeworkMaterials.find(h => h.id === reqHwId);
      if (matchedHw) reqHwTitle = matchedHw.title;
    }

    const isApproved = approvedHomeworks.some(h => h.id === reqHwId);
    const pendingHw = homeworkMaterials.find(h => h.id === reqHwId && h.submission_status === 'pending');
    isSubmittedPending = Boolean(pendingHw);

    isUnlocked = isBypassed || isApproved;
  }

  // 1. Gated and Locked State
  if (isGatedByHw && !isUnlocked) {
    return `
      <div style="padding: 1rem; border-radius: 0.75rem; background: #fffbeb; border: 1.5px dashed #f59e0b; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
        <div style="flex: 1; min-width: 180px;">
          <div style="margin-bottom: 0.3rem; display: flex; align-items: center; gap: 0.4rem;">
            <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.5rem; border-radius: 0.3rem; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">
              ${getIcon('lock', 12, '#b45309')}
              <span>فيديو مقفل (مشروط باعتماد واجب)</span>
            </span>
          </div>
          <h4 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0 0 0.3rem 0;">
            ${escapeHtml(m.title)}
          </h4>
          <div style="font-size: 0.8rem; color: #92400e; display: flex; align-items: center; gap: 0.35rem; line-height: 1.4;">
            ${getIcon('info', 14, '#b45309')}
            <span>
              ${isSubmittedPending 
                ? `تم تسليم الواجب (<strong>${escapeHtml(reqHwTitle)}</strong>) وهو قيد مراجعة واعتماد المعلم لفتح الفيديو تلقائياً فور الاعتماد.` 
                : `يتطلب فتح ومشاهدة الفيديو <strong>اعتماد تسليم واجب: "${escapeHtml(reqHwTitle)}"</strong> أولاً من المعلم.`}
            </span>
          </div>
        </div>

        <div>
          ${isSubmittedPending ? `
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; background: #fef3c7; color: #b45309; padding: 0.5rem 0.9rem; border-radius: 0.5rem; font-size: 0.82rem; font-weight: 800; border: 1px solid #fde68a;">
              ${getIcon('clock', 14, '#b45309')}
              <span>قيد اعتماد المعلم</span>
            </span>
          ` : `
            <button type="button" onclick="window.scrollToHomework && window.scrollToHomework('${escapeHtml(m.pages || '')}')"
              style="display: inline-flex; align-items: center; gap: 0.35rem; background: #f59e0b; color: #ffffff; padding: 0.5rem 0.9rem; border-radius: 0.5rem; border: none; font-size: 0.82rem; font-weight: 800; cursor: pointer; box-shadow: 0 2px 4px rgba(245,158,11,0.25);">
              ${getIcon('homework', 14, '#ffffff')}
              <span>تسليم الواجب المطلوب لفتح الفيديو</span>
            </button>
          `}
        </div>
      </div>
    `;
  }

  // 2. Unlocked State (either open or requirements met)
  const typeBadge = isPdf 
    ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('file', 12, '#1d4ed8')} PDF</span>` 
    : (isVideo ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('video', 12, '#1d4ed8')} فيديو شرح</span>` : `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('link', 12, '#1d4ed8')} رابط</span>`);
  
  const studentWatermark = `${student.name || 'طالب'} • كود: ${student.student_code || '-'} • ${student.student_phone || student.parent_phone || ''}`;

  return `
    <div style="padding: 0.9rem 1rem; border-radius: 0.75rem; background: ${isGatedByHw ? '#f0fdf4' : '#f8fafc'}; border: 1px solid ${isGatedByHw ? '#bbf7d0' : '#e2e8f0'}; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
      <div style="flex: 1; min-width: 180px;">
        <div style="margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap;">
          <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 0.3rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
            ${typeBadge}
          </span>
          ${isGatedByHw ? `
            <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 0.3rem; background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 0.2rem;">
              ${getIcon('check', 11, '#047857')}
              <span>تم فتح الفيديو (الواجب معتمد)</span>
            </span>
          ` : ''}
        </div>
        <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0;">
          ${escapeHtml(m.title)}
        </h4>
        ${m.description ? `
          <p style="font-size: 0.78rem; color: #64748b; margin: 0.25rem 0 0 0; line-height: 1.4;">
            ${escapeHtml(m.description)}
          </p>
        ` : ''}
      </div>

      ${(() => {
        if (!resolvedMatUrl || resolvedMatUrl === '#') return '';
        if (isVideo) {
          return `
            <div>
              <button type="button" onclick="window.centrlyPlayVideoWithWatermark ? window.centrlyPlayVideoWithWatermark('${escapeHtml(resolvedMatUrl)}', '${escapeHtml(m.title)}', '${escapeHtml(studentWatermark)}') : window.open('${escapeHtml(resolvedMatUrl)}', '_blank')"
                style="display: inline-flex; align-items: center; gap: 0.35rem; background: #2563eb; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; border: none; font-size: 0.8rem; font-weight: 800; cursor: pointer; box-shadow: 0 1px 3px rgba(37,99,235,0.25);">
                ${getIcon('video', 13, '#ffffff')}
                <span>مشاهدة الفيديو</span>
              </button>
            </div>
          `;
        }
        return `
          <div>
            <a href="${escapeHtml(resolvedMatUrl)}" target="_blank" rel="noopener noreferrer" 
              style="display: inline-flex; align-items: center; gap: 0.35rem; background: #1d4ed8; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; text-decoration: none; font-size: 0.8rem; font-weight: 800; box-shadow: 0 1px 3px rgba(29,78,216,0.2);">
              ${getIcon(isPdf ? 'download' : 'link', 13, '#ffffff')}
              <span>${isPdf ? 'تحميل / فتح المذكرة' : 'فتح الرابط'}</span>
            </a>
          </div>
        `;
      })()}
    </div>
  `;
}

export function renderStudentPortalView(portalData = {}, activeTab = 'dashboard') {
  if (portalData.error || !portalData.student) {
    return `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; padding: 1.5rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
        <div style="max-width: 480px; width: 100%; background: #fff; border-radius: 1rem; padding: 2.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 0.75rem;">${getIcon('lock', 48, '#ef4444')}</div>
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #ef4444; margin: 0 0 0.5rem 0;">رابط الطالب غير صالح أو منتهي الصلاحية</h2>
          <p style="font-size: 0.9rem; color: #64748b; margin: 0 0 1.5rem 0; line-height: 1.6;">
            ${escapeHtml(portalData.error || 'تعذر تحميل بيانات الطالب. يرجى التأكد من فتح الرابط الصحيح المرسل لك أو مراجعة معلمك.')}
          </p>
          <div style="font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
            منظومة سنترلي التعليمية | Centrly Student Portal
          </div>
        </div>
      </div>
    `;
  }

  const student = portalData.student;
  const isMohaned = isMohanedKhaledStudent(student);
  if (!isMohaned && (activeTab === 'dashboard' || activeTab === 'exams' || activeTab === 'videos')) {
    activeTab = 'materials';
  }
  const studentKey = (student.id || student.student_code || student.code || student.student_phone || '').toString().trim();
  if (typeof window !== 'undefined' && studentKey) {
    window._centrlyCurrentStudentId = studentKey;
  }
  const summary = portalData.summary || {
    total_sessions: 0,
    attended_count: 0,
    absent_count: 0,
    attendance_rate: '0%',
    homework_done_count: 0,
    homework_total_count: 0,
    total_quizzes: 0,
    quiz_average_percentage: '—',
  };
  const sessions = portalData.sessions || [];
  const quizzes = portalData.quizzes || [];
  const materials = portalData.materials || [];
  const onlineQuizzes = materials.filter(m => m.type === 'online_quiz' || (m.questions && !m.is_homework));
  const homeworkMaterials = materials.filter(m => m.is_homework);
  const videoMaterials = materials.filter(m => m.type === 'video');
  const studyMaterials = materials.filter(m => !m.is_homework && m.type !== 'online_quiz' && m.type !== 'video');
  const approvedHomeworks = homeworkMaterials.filter(m => m.submission_status === 'approved');

  if (typeof window !== 'undefined') {
    window.__portalMaterials = materials;
    window.__portalToken = portalData.token || (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('token') : '');
  }

  const teacherPhone = student.teacher_phone || portalData.teacher_phone || student.contact_phone || portalData.contact_phone || '01010979708';
  let cleanTeacherPhone = teacherPhone ? teacherPhone.replace(/[^\d+]/g, '') : '';
  if (cleanTeacherPhone.startsWith('+')) {
    cleanTeacherPhone = cleanTeacherPhone.substring(1);
  } else if (cleanTeacherPhone.startsWith('01')) {
    cleanTeacherPhone = '2' + cleanTeacherPhone;
  }
  const teacherNameStr = student.teacher_name || 'المعلم';
  const teacherContactMsg = encodeURIComponent(
    `السلام عليكم يا ${teacherNameStr}، أنا الطالب ${student.name}${student.student_code ? ` (كود: ${student.student_code})` : ''}${student.group_name ? ` - مجموعة ${student.group_name}` : ''}، وعندي استفسار بخصوص المادة.`
  );
  const teacherWaUrl = cleanTeacherPhone ? `https://wa.me/${cleanTeacherPhone}?text=${teacherContactMsg}` : null;

  const now = new Date();
  const isHomeworkFinished = (m) => {
    // 1. Approved homeworks are finished and approved
    if (m.submission_status === 'approved') return true;
    // 2. Rejected/Revision requested needs student action -> Active
    if (m.submission_status === 'rejected') return false;
    // 3. Pending review -> submitted, awaiting teacher feedback -> Active
    if (m.submission_status === 'pending') return false;
    // 4. Unsubmitted / Missing: check if deadline has passed
    if (m.due_date) {
      try {
        const d = new Date(m.due_date);
        if (!isNaN(d.getTime())) {
          d.setHours(23, 59, 59, 999);
          if (d.getTime() < now.getTime()) {
            return true; // Deadline passed -> Finished
          }
        }
      } catch (_) {}
    }
    return false;
  };

  const activeHomeworks = homeworkMaterials.filter(m => !isHomeworkFinished(m));
  const finishedHomeworks = homeworkMaterials.filter(m => isHomeworkFinished(m));

  // Sort active homeworks: Redo requested first, then closest due date
  const sortedActiveHomeworks = [...activeHomeworks].sort((a, b) => {
    const aIsRejected = a.submission_status === 'rejected';
    const bIsRejected = b.submission_status === 'rejected';
    if (aIsRejected && !bIsRejected) return -1;
    if (!aIsRejected && bIsRejected) return 1;

    if (a.due_date && b.due_date) {
      return new Date(a.due_date) - new Date(b.due_date);
    }
    return 0;
  });

  // Sort finished homeworks: Most recent date first
  const sortedFinishedHomeworks = [...finishedHomeworks].sort((a, b) => {
    const dateA = a.submitted_at || a.due_date || a.created_at || '';
    const dateB = b.submitted_at || b.due_date || b.created_at || '';
    return dateB.localeCompare(dateA);
  });

  return `
    <div style="min-height: 100vh; background-color: #f8fafc; padding: 1rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="max-width: 680px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Student Portal Header (Teacher White-Labeled) -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); border-radius: 1.25rem; padding: 1.5rem; box-shadow: 0 4px 20px rgba(37, 99, 235, 0.15); color: #fff; text-align: center; position: relative; overflow: hidden;">
          <!-- Subtle decorative circle -->
          <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; position: relative; z-index: 2;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #10b981; font-weight: 700; background: rgba(255,255,255,0.95); padding: 0.25rem 0.6rem; border-radius: 9999px;">
              <span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%;"></span>
              بوابة الطالب — ${escapeHtml(teacherNameStr)}
            </span>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <button onclick="window.openStudentPortalTour ? window.openStudentPortalTour(true) : null" 
                style="background: rgba(255,255,255,0.2); border: 1px solid rgba(255,255,255,0.35); border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" title="شرح أقسام المنصة">
                ${getIcon('lightbulb', 13, '#fde047')}
                <span>شرح المنصة</span>
              </button>
              <button onclick="window.centrlyApp && window.centrlyApp.reloadStudentPortal ? window.centrlyApp.reloadStudentPortal() : window.location.reload()" 
                style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;">
                ${getIcon('refresh', 13, '#ffffff')}
                <span>تحديث</span>
              </button>
              <button onclick="window.centrlyApp && window.centrlyApp.handlePortalLogout ? window.centrlyApp.handlePortalLogout() : (window.location.href='/portal')" 
                style="background: rgba(239,68,68,0.25); border: 1px solid rgba(239,68,68,0.4); border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" title="تسجيل الخروج">
                ${getIcon('logout', 13, '#ffffff')}
                <span>خروج</span>
              </button>
            </div>
          </div>

          <div style="margin: 0 auto 0.5rem; width: 48px; height: 48px; background: #fff; border-radius: 12px; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; color: #1e3a8a; font-weight: 900; box-shadow: 0 4px 10px rgba(0,0,0,0.1);">
            ${getIcon('gradCap', 24, '#1e3a8a')}
          </div>
          <h1 style="font-size: 1.35rem; font-weight: 900; margin: 0; text-shadow: 0 1px 2px rgba(0,0,0,0.1);">
            أهلاً بك يا ${escapeHtml(student.name)}
          </h1>
          
          <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap;">
            <span style="background: rgba(255,255,255,0.2); padding: 0.2rem 0.6rem; border-radius: 0.4rem; font-family: monospace; font-size: 0.8rem; font-weight: 700;">كود: ${escapeHtml(student.student_code)}</span>
            ${student.group_name ? `<span style="background: rgba(245,158,11,0.3); border: 1px solid rgba(245,158,11,0.5); padding: 0.2rem 0.6rem; border-radius: 0.4rem; font-size: 0.8rem; font-weight: 700;">${escapeHtml(student.group_name)}</span>` : ''}
          </div>
          
          <p style="font-size: 0.8rem; opacity: 0.9; margin: 0.5rem 0 0 0;">
            الواجبات، الامتحانات الدورية، وفيديوهات الشرح والمتابعة
          </p>
        </div>

        <!-- Teacher Direct WhatsApp Contact Card -->
        ${teacherWaUrl ? `
          <div style="background: linear-gradient(135deg, #f0fdf4 0%, #dcfce7 100%); border: 1.5px solid #86efac; border-radius: 1rem; padding: 0.85rem 1.15rem; display: flex; align-items: center; justify-content: space-between; gap: 0.75rem; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.08);">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <div style="width: 40px; height: 40px; border-radius: 50%; background: #10b981; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; box-shadow: 0 2px 8px rgba(16, 185, 129, 0.25);">
                ${getIcon('whatsapp', 22, '#ffffff')}
              </div>
              <div style="text-align: right;">
                <div style="font-weight: 800; font-size: 0.9rem; color: #065f46;">
                  تواصل مباشر مع ${escapeHtml(teacherNameStr)}
                </div>
                <div style="font-size: 0.76rem; color: #047857; margin-top: 1px;">
                  ${student.subject_name ? `${escapeHtml(student.subject_name)} • ` : ''}لأي استفسار في المنهج أو بخصوص الواجب والامتحانات
                </div>
              </div>
            </div>
            <a href="${teacherWaUrl}" target="_blank" rel="noopener noreferrer" 
              style="background: #10b981; color: #ffffff; text-decoration: none; padding: 0.55rem 0.95rem; border-radius: 0.65rem; font-size: 0.82rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; flex-shrink: 0; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.3); transition: transform 0.15s ease;"
              onmouseover="this.style.transform='scale(1.03)'" onmouseout="this.style.transform='scale(1)'">
              ${getIcon('whatsapp', 15, '#ffffff')}
              <span>مراسلة واتساب</span>
            </a>
          </div>
        ` : ''}

        <!-- Navigation Bar (Dashboard, Materials, Exams, Videos, Attendance, Barcode) -->
        <div style="display: flex; gap: 4px; background: #e2e8f0; padding: 4px; border-radius: 0.85rem; overflow-x: auto; -webkit-overflow-scrolling: touch; scrollbar-width: none;">
          ${isMohaned ? `
            <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('dashboard') : null" id="student-tab-btn-dashboard"
              style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${activeTab === 'dashboard' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'dashboard' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'dashboard' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
              ${getIcon('dashboard', 14, activeTab === 'dashboard' ? '#1e3a8a' : '#64748b')}
              <span>الرئيسية والمهام</span>
            </button>
          ` : ''}

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('materials') : null" id="student-tab-btn-materials"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${activeTab === 'materials' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'materials' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'materials' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('homework', 14, activeTab === 'materials' ? '#1e3a8a' : '#64748b')}
            <span>الواجبات والمذكرات ${activeHomeworks.length > 0 ? `(${activeHomeworks.length})` : ''}</span>
          </button>

          ${isMohaned ? `
            <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('exams') : null" id="student-tab-btn-exams"
              style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${activeTab === 'exams' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'exams' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'exams' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
              ${getIcon('chart', 14, activeTab === 'exams' ? '#1e3a8a' : '#64748b')}
              <span>الامتحانات ${onlineQuizzes.length > 0 ? `(${onlineQuizzes.length})` : ''}</span>
            </button>

            <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('videos') : null" id="student-tab-btn-videos"
              style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${activeTab === 'videos' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'videos' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'videos' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
              ${getIcon('video', 14, activeTab === 'videos' ? '#1e3a8a' : '#64748b')}
              <span>فيديوهات الشرح ${videoMaterials.length > 0 ? `(${videoMaterials.length})` : ''}</span>
            </button>
          ` : ''}

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('attendance') : null" id="student-tab-btn-attendance"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${activeTab === 'attendance' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'attendance' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'attendance' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('calendar', 14, activeTab === 'attendance' ? '#1e3a8a' : '#64748b')}
            <span>الحضور والغياب</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('card') : null" id="student-tab-btn-card"
            style="padding: 0.65rem 0.65rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.8rem; cursor: pointer; transition: all 0.2s; display: inline-flex; align-items: center; justify-content: center; gap: 0.3rem; white-space: nowrap; flex: 1; min-width: 90px; background: ${activeTab === 'card' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'card' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'card' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('barcode', 14, activeTab === 'card' ? '#1e3a8a' : '#64748b')}
            <span>باركود الحضور</span>
          </button>
        </div>

        <!-- ================= TAB 1: DASHBOARD (الرئيسية والمهام) ================= -->
        <div id="student-tab-content-dashboard" style="display: ${activeTab === 'dashboard' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          
          <!-- 3 Golden KPIs -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #ffffff; padding: 1rem 0.75rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">نسبة الحضور</div>
              <div style="font-size: 1.55rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">
                ${escapeHtml(summary.attendance_rate || '100%')}
              </div>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
                ${escapeHtml(summary.attended_count || 0)} حاضر / ${escapeHtml(summary.total_sessions || 0)} حصة
              </div>
            </div>

            <div style="background: #ffffff; padding: 1rem 0.75rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">متوسط الكويزات</div>
              <div style="font-size: 1.55rem; font-weight: 900; color: #2563eb; margin-top: 0.2rem;">
                ${escapeHtml(summary.quiz_average_percentage || '—')}
              </div>
              <div style="font-size: 0.72rem; color: #64748b; margin-top: 0.2rem;">
                ${quizzes.length > 0 ? `${quizzes.length} كويز مرصود` : 'لا توجد كويزات'}
              </div>
            </div>

            <div style="background: #ffffff; padding: 1rem 0.75rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الواجبات المسلّمة</div>
              <div style="font-size: 1.55rem; font-weight: 900; color: ${activeHomeworks.length > 0 ? '#b45309' : '#059669'}; margin-top: 0.2rem;">
                ${approvedHomeworks.length} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">/ ${homeworkMaterials.length}</span>
              </div>
              <div style="font-size: 0.72rem; color: ${activeHomeworks.length > 0 ? '#b45309' : '#059669'}; margin-top: 0.2rem; font-weight: 700;">
                ${activeHomeworks.length > 0 ? `${activeHomeworks.length} مطلوب للتسليم` : 'كافة الواجبات معتمدة'}
              </div>
            </div>
          </div>

          <!-- To-Do Action Items Section -->
          <div style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.65rem;">
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('homework', 18, '#1e3a8a')}
                <span>المهام المطلوب متابعتها وإنجازها</span>
              </h2>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 700;">
                ${activeHomeworks.length + onlineQuizzes.length} مهام معلقة
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${activeHomeworks.length > 0 ? `
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #fffbeb; border: 1px solid #fef3c7; border-right: 4px solid #f59e0b; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #b45309; background: #fef3c7; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">واجب مطلوب للتسليم</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${escapeHtml(activeHomeworks[0].title)}</h4>
                    ${activeHomeworks[0].due_date ? `<div style="font-size: 0.75rem; color: #92400e; margin-top: 0.15rem;">ينتهي: ${escapeHtml(activeHomeworks[0].due_date)}</div>` : ''}
                  </div>
                  <button type="button" onclick="window.switchStudentPortalTab('materials')" class="btn btn-sm btn-primary" style="font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.9rem; border-radius: 0.5rem;">
                    تسليم الواجب الآن
                  </button>
                </div>
              ` : ''}

              ${onlineQuizzes.length > 0 ? `
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #eff6ff; border: 1px solid #dbeafe; border-right: 4px solid #2563eb; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #1d4ed8; background: #dbeafe; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">امتحان أونلاين متاح</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${escapeHtml(onlineQuizzes[0].title)}</h4>
                    <div style="font-size: 0.75rem; color: #1e40af; margin-top: 0.15rem;">بيئة مؤمنة • تصحيح واعتماد مباشر</div>
                  </div>
                  <button type="button" onclick="window.switchStudentPortalTab('exams')" class="btn btn-sm" style="background: #1e3a8a; color: #fff; font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.9rem; border-radius: 0.5rem; border: none; cursor: pointer;">
                    دخول الامتحان
                  </button>
                </div>
              ` : ''}

              ${videoMaterials.length > 0 ? `
                <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #f5f3ff; border: 1px solid #ede9fe; border-right: 4px solid #7c3aed; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                  <div>
                    <span style="font-size: 0.7rem; font-weight: 800; color: #6d28d9; background: #ede9fe; padding: 0.15rem 0.45rem; border-radius: 0.3rem;">فيديو شرح متاح</span>
                    <h4 style="font-size: 0.92rem; font-weight: 800; color: #0f172a; margin: 0.25rem 0 0 0;">${escapeHtml(videoMaterials[0].title)}</h4>
                    <div style="font-size: 0.75rem; color: #5b21b6; margin-top: 0.15rem;">شرح أفكار المنهج وحلول التمارين</div>
                  </div>
                  <button type="button" onclick="window.switchStudentPortalTab('videos')" class="btn btn-sm" style="background: #7c3aed; color: #fff; font-weight: 800; font-size: 0.8rem; padding: 0.45rem 0.9rem; border-radius: 0.5rem; border: none; cursor: pointer;">
                    مشاهدة الفيديو
                  </button>
                </div>
              ` : ''}

              <!-- Class schedule card -->
              <div style="padding: 0.85rem 1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                <div>
                  <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">
                    ${escapeHtml(student.group_name || 'مجموعة السنتر')}
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
        <div id="student-tab-content-materials" style="display: ${activeTab === 'materials' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          
          <!-- Homework & Materials KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الواجبات المطلوبة</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: ${activeHomeworks.length > 0 ? '#b45309' : '#059669'}; margin-top: 0.2rem;">
                ${activeHomeworks.length}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${activeHomeworks.length > 0 ? 'واجب بحاجة لحلك وتسليمه' : 'لا توجد واجبات مطلوبة حالياً'}
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #059669; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
                ${getIcon('check', 13, '#059669')}
                <span>الواجبات المسلّمة</span>
              </div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">
                ${approvedHomeworks.length} <span style="font-size: 0.85rem; font-weight: 700; color: #64748b;">/ ${homeworkMaterials.length}</span>
              </div>
              <div style="font-size: 0.725rem; color: #059669; font-weight: 700; margin-top: 0.2rem;">
                ${homeworkMaterials.length > 0 && approvedHomeworks.length === homeworkMaterials.length ? 'تم تسليم كافة الواجبات بنجاح' : `تم تسليم ${approvedHomeworks.length} واجب بنجاح`}
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">المذكرات والشروحات</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #8b5cf6; margin-top: 0.2rem;">
                ${studyMaterials.length}
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
                <div style="color: #166534; display: flex; align-items: center;">${getIcon('lightbulb', 20, '#166534')}</div>
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
                ${getIcon('chevronDown', 18, '#166534')}
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
                  ${getIcon('homework', 18, 'var(--centrly-blue-700)')}
                  <span>الواجبات المطلوبة حالياً</span>
                </h2>
                <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  قم بحل الأسئلة وارفع إجابتك قبل انتهاء الموعد
                </p>
              </div>
              <span class="badge ${sortedActiveHomeworks.length > 0 ? 'badge-amber' : 'badge-green'}" style="font-weight: 700; font-size: 0.8rem; padding: 0.3rem 0.65rem;">
                ${sortedActiveHomeworks.length > 0 ? `${sortedActiveHomeworks.length} واجب مطلوب` : 'لا توجد واجبات متأخرة'}
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${sortedActiveHomeworks.length > 0 ? sortedActiveHomeworks.map(m => {
                const isPdf = m.type === 'pdf';
                const isVideo = m.type === 'video';
                const typeBadge = isPdf 
                  ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('file', 12, '#1d4ed8')} PDF</span>` 
                  : (isVideo ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('video', 12, '#1d4ed8')} فيديو</span>` : `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('link', 12, '#1d4ed8')} رابط</span>`);
                
                const status = m.submission_status || 'unsubmitted';
                const isPending = status === 'pending';
                const isRejected = status === 'rejected';

                const cardBg = isRejected ? '#fffafa' : '#f8fafc';
                const cardBorder = isRejected ? '#fca5a5' : '#e2e8f0';

                const hwTag = isRejected 
                  ? `<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('alertTriangle', 12, '#dc2626')} <span>مطلوب إعادة التسليم</span></span>`
                  : (isPending 
                    ? `<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fffbeb; color: #d97706; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('clock', 12, '#d97706')} <span>تم الرفع (قيد مراجعة المعلم)</span></span>`
                    : `<span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 0.35rem; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('homework', 12, '#b45309')} <span>واجب منزلي مطلوب</span></span>`);

                return `
                  <div id="hw-card-${escapeHtml(m.id)}" style="padding: 1.1rem; border-radius: 0.85rem; background: ${cardBg}; border: 1px solid ${cardBorder}; display: flex; flex-direction: column; gap: 0.65rem;">
                    
                    <!-- Top row: Title and Tags -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
                          <span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 0.35rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                            ${typeBadge}
                          </span>
                          ${hwTag}
                        </div>
                        <h3 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0;">
                          ${escapeHtml(m.title)}
                        </h3>

                        ${(m.book_name || m.pages || m.questions) ? `
                          <!-- Prominent Textbook Questions Box -->
                          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 0.65rem; padding: 0.75rem 0.85rem; margin-top: 0.5rem;">
                            <div style="display: flex; align-items: center; gap: 0.35rem; font-weight: 800; color: #1e40af; font-size: 0.85rem; margin-bottom: 0.45rem;">
                              ${getIcon('book', 15, '#1e40af')}
                              <span>المطلوب حله من الكتاب / الملزمة:</span>
                            </div>
                            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.5rem; font-size: 0.825rem;">
                              <div style="background: #ffffff; padding: 0.45rem 0.65rem; border-radius: 0.45rem; border: 1px solid #dbeafe;">
                                <span style="color: #64748b; font-size: 0.72rem; display: block; font-weight: 600;">الكتاب / الملزمة:</span>
                                <span style="font-weight: 800; color: #1e3a8a;">${escapeHtml(m.book_name || 'الكتاب المدرسي')}</span>
                              </div>
                              <div style="background: #ffffff; padding: 0.45rem 0.65rem; border-radius: 0.45rem; border: 1px solid #dbeafe;">
                                <span style="color: #64748b; font-size: 0.72rem; display: block; font-weight: 600;">الصفحات المطلوبة:</span>
                                <span style="font-weight: 800; color: #1e3a8a;">${escapeHtml(m.pages || '—')}</span>
                              </div>
                              <div style="background: #ffffff; padding: 0.45rem 0.65rem; border-radius: 0.45rem; border: 1px solid #dbeafe;">
                                <span style="color: #64748b; font-size: 0.72rem; display: block; font-weight: 600;">أرقام الأسئلة:</span>
                                <span style="font-weight: 800; color: #b45309;">${escapeHtml(m.questions || '—')}</span>
                              </div>
                            </div>
                          </div>
                        ` : ''}

                        ${m.description ? `
                          <div style="font-size: 0.85rem; color: #1e293b; margin: 0.5rem 0 0 0; line-height: 1.6; background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; border-right: 3px solid #2563eb;">
                            <div style="font-weight: 800; color: #1e40af; font-size: 0.825rem; margin-bottom: 0.25rem;">وصف الواجب والمطلوب حله:</div>
                            <div style="white-space: pre-wrap; color: #334155;">${escapeHtml(m.description)}</div>
                          </div>
                        ` : ''}

                        ${(() => {
                          const resolvedHwUrl = resolveSafeMaterialUrl(m.url);
                          return (resolvedHwUrl && resolvedHwUrl !== '#') ? `
                            <div style="margin-top: 0.6rem;">
                              <a href="${escapeHtml(resolvedHwUrl)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" 
                                style="display: inline-flex; align-items: center; gap: 0.4rem; background: #2563eb; color: #ffffff; font-weight: 800; text-decoration: none; padding: 0.45rem 0.85rem; border-radius: 0.5rem; font-size: 0.825rem; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                                ${getIcon(isPdf ? 'file' : (isVideo ? 'video' : 'link'), 14, '#ffffff')}
                                <span>فتح / تحميل ملف الواجب المرفق (PDF / الرابط)</span>
                              </a>
                            </div>
                          ` : '';
                        })()}
                      </div>
                    </div>

                    <!-- Due date if homework -->
                    ${m.due_date ? `
                      <div style="font-size: 0.775rem; color: #b45309; background: #fffbeb; padding: 0.4rem 0.7rem; border-radius: 0.4rem; border: 1px solid #fef3c7; display: flex; align-items: center; gap: 0.4rem;">
                        ${getIcon('clock', 13, '#b45309')}
                        <span>آخر موعد لتسليم الواجب: <b>${escapeHtml(m.due_date)}</b></span>
                      </div>
                    ` : ''}

                    <!-- Homework Submission Box with Upload Button & Teacher Notes -->
                    <div style="background: #ffffff; border: 1px solid ${isRejected ? '#fca5a5' : '#e2e8f0'}; border-radius: 0.65rem; padding: 0.85rem; margin-top: 0.2rem;">
                      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                        <div style="font-size: 0.825rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                          ${getIcon('upload', 14, '#0f172a')}
                          <span>حالة تسليمك للواجب:</span>
                        </div>
                        
                        <div>
                          ${isPending ? `
                            <span style="font-size: 0.75rem; font-weight: 800; background: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${getIcon('clock', 13, '#d97706')}
                              <span>تم الرفع (قيد مراجعة المعلم)</span>
                            </span>
                          ` : (isRejected ? `
                            <span style="font-size: 0.75rem; font-weight: 800; background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${getIcon('alertTriangle', 13, '#dc2626')}
                              <span>المعلم طلب إعادة التسليم</span>
                            </span>
                          ` : `
                            <span style="font-size: 0.75rem; font-weight: 800; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                              <span>لم يُسلّم بعد</span>
                            </span>
                          `)}
                        </div>
                      </div>

                      ${isRejected ? `
                        <div style="font-size: 0.825rem; background: #fff7ed; border-right: 3px solid #ea580c; border: 1px solid #fed7aa; padding: 0.55rem 0.75rem; border-radius: 0.4rem; color: #9a3412; margin-bottom: 0.65rem;">
                          <div style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem; margin-bottom: 0.2rem;">
                            ${getIcon('alertTriangle', 14, '#ea580c')}
                            <span>توجيه وملاحظة المعلم لإعادة الحل:</span>
                          </div>
                          <div>${escapeHtml(m.teacher_feedback || 'يرجى إعادة حل الواجب وتصحيحه ورفع الحل من جديد.')}</div>
                        </div>
                      ` : (m.teacher_feedback ? `
                        <div style="font-size: 0.8rem; background: #fff7ed; border-right: 3px solid #ea580c; padding: 0.45rem 0.65rem; border-radius: 0.35rem; color: #9a3412; margin-bottom: 0.6rem;">
                          <b>ملاحظة المعلم:</b> ${escapeHtml(m.teacher_feedback)}
                        </div>
                      ` : '')}

                      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem;">
                        ${m.submission_url ? `
                          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                            ${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(m.submission_url) ? `
                              <a href="${escapeHtml(m.submission_url)}" target="_blank" rel="noopener noreferrer" title="اضغط لتكبير صورة الواجب">
                                <img src="${escapeHtml(m.submission_url)}" alt="صورة الواجب" style="width: 38px; height: 38px; object-fit: cover; border-radius: 6px; border: 1px solid #cbd5e1; box-shadow: 0 1px 3px rgba(0,0,0,0.1);">
                              </a>
                            ` : ''}
                            <a href="${escapeHtml(m.submission_url)}" target="_blank" rel="noopener noreferrer"
                              style="font-size: 0.8rem; color: #2563eb; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${getIcon('file', 14, '#2563eb')}
                              <span>${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(m.submission_url) ? 'معاينة صورة الواجب' : 'معاينة ملفك المرفوع'} (${escapeHtml(m.submitted_at ? m.submitted_at.slice(0, 10) : 'مرفوع')}) ↗</span>
                            </a>
                          </div>
                        ` : `
                          <span style="font-size: 0.75rem; color: #94a3b8;">ارفع الحل بصيغة PDF أو صورة واضحة (الحد الأقصى 100MB)</span>
                        `}

                        <!-- File Upload Trigger (PDF or Images) -->
                        <div>
                          <input type="file" id="hw-file-input-${escapeHtml(m.id)}" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.heic" style="display: none;" 
                            onchange="window.centrlyApp && window.centrlyApp.handleStudentHomeworkUpload ? window.centrlyApp.handleStudentHomeworkUpload('${escapeHtml(m.id)}', this.files[0]) : null">
                          
                          <button type="button" onclick="document.getElementById('hw-file-input-${escapeHtml(m.id)}').click()" id="hw-upload-btn-${escapeHtml(m.id)}"
                            style="background: ${isRejected ? '#dc2626' : '#059669'}; color: #ffffff; border: 1px solid ${isRejected ? '#b91c1c' : '#059669'}; padding: 0.45rem 0.95rem; border-radius: 0.5rem; font-size: 0.825rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.2s; box-shadow: 0 2px 6px ${isRejected ? 'rgba(220,38,38,0.3)' : 'rgba(5,150,105,0.25)'};">
                            ${getIcon('upload', 14, '#ffffff')}
                            <span>${isRejected ? 'رفع حل الواجب الجديد (إعادة التسليم)' : (isPending ? 'تعديل / رفع نسخة أحدث' : 'رفع حل الواجب (PDF أو صورة)')}</span>
                          </button>
                        </div>
                      </div>

                    </div>

                    <!-- Notebook Instructions -->
                    <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: #1e40af; background: #eff6ff; padding: 0.45rem 0.75rem; border-radius: 0.45rem; border: 1px solid #bfdbfe; margin-top: 0.25rem;">
                      ${getIcon('edit', 14, '#1e40af')}
                      <span><b>طريقة التسليم:</b> قم بحل الأسئلة في كشكولك بخط واضح، ثم صوّر الصفحات بكاميرا الموبايل وارفع الصورة أو ملف الـ PDF عبر زر الرفع أعلاه مباشرة.</span>
                    </div>

                  </div>
                `;
              }).join('') : `
                <div style="text-align: center; padding: 1.75rem 1rem; color: #166534; font-size: 0.88rem; background: #f0fdf4; border-radius: 0.75rem; border: 1px dashed #86efac;">
                  <div style="display: flex; justify-content: center; margin-bottom: 0.4rem; color: #166534;">${getIcon('check', 32, '#166534')}</div>
                  <b>رائع جداً! لا توجد واجبات مطلوبة منك حالياً.</b><br>
                  <span style="font-size: 0.78rem; color: #15803d;">كافة واجباتك منجزة، أو لم يقم المعلم بنشر واجبات جديدة بعد.</span>
                </div>
              `}
            </div>
          </div>

          ${studyMaterials.length > 0 ? `
            <!-- Study Materials & Lecture Notes Section -->
            <div id="student-study-materials-section" style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <h2 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                    ${getIcon('materials', 18, '#8b5cf6')}
                    <span>المذكرات والملازم الدراسية</span>
                  </h2>
                  <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                    تحميل المذكرات والشروحات الخاصة بمجموعتك
                  </p>
                </div>
                <span class="badge badge-blue" style="font-weight: 700;">${studyMaterials.length} ملف متاح</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${studyMaterials.map(m => renderStudentStudyMaterialCard(m, student, homeworkMaterials, approvedHomeworks)).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Finished Homeworks (Bottom Archive - Compact Single Row as requested) -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.65rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h3 style="font-size: 0.95rem; font-weight: 800; color: #334155; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                  ${getIcon('check', 16, '#059669')}
                  <span>سجل الواجبات السابقة والمنتهية</span>
                </h3>
                <p style="font-size: 0.73rem; color: #64748b; margin: 0.15rem 0 0 0;">
                  أرشيف الواجبات المكتملة أو التي انتهى موعد تسليمها
                </p>
              </div>
              <span style="font-size: 0.75rem; font-weight: 700; color: #64748b; background: #f1f5f9; padding: 0.2rem 0.55rem; border-radius: 0.4rem; border: 1px solid #cbd5e1;">
                ${sortedFinishedHomeworks.length} واجب منتهي
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.5rem;">
              ${sortedFinishedHomeworks.length > 0 ? sortedFinishedHomeworks.map(m => {
                const isApproved = m.submission_status === 'approved';
                return `
                  <div style="background: ${isApproved ? '#fbfdfc' : '#fefefe'}; border: 1px solid ${isApproved ? '#bbf7d0' : '#fecaca'}; border-radius: 0.6rem; padding: 0.55rem 0.85rem; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                    
                    <!-- Homework Title & Date (Single Row) -->
                    <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1; min-width: 170px;">
                      <span style="color: ${isApproved ? '#10b981' : '#ef4444'}; display: flex; align-items: center;">
                        ${getIcon(isApproved ? 'check' : 'close', 15, isApproved ? '#10b981' : '#ef4444')}
                      </span>
                      <span style="font-size: 0.85rem; font-weight: 800; color: #1e293b;">
                        ${escapeHtml(m.title)}
                      </span>
                      ${m.due_date ? `
                        <span style="font-size: 0.72rem; color: #94a3b8; font-weight: 500;">
                          (${escapeHtml(m.due_date)})
                        </span>
                      ` : ''}
                    </div>

                    <!-- Compact Status Badge: تم تسليمه / لم يتم تسليمه -->
                    <div style="display: flex; align-items: center; gap: 0.45rem;">
                      ${isApproved ? `
                        <span style="font-size: 0.75rem; font-weight: 800; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 0.2rem 0.55rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                          ${getIcon('check', 12, '#059669')}
                          <span>تم تسليمه</span>
                        </span>
                        ${m.submission_url ? `
                          <a href="${escapeHtml(m.submission_url)}" target="_blank" rel="noopener noreferrer"
                            style="font-size: 0.75rem; color: #2563eb; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 0.2rem; padding: 0.15rem 0.35rem;">
                            ${getIcon('file', 12, '#2563eb')}
                            <span>معاينة حلك</span>
                          </a>
                        ` : ''}
                      ` : `
                        <span style="font-size: 0.75rem; font-weight: 800; color: #dc2626; background: #fef2f2; border: 1px solid #fca5a5; padding: 0.2rem 0.55rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                          ${getIcon('close', 12, '#dc2626')}
                          <span>لم يتم تسليمه</span>
                        </span>
                      `}
                    </div>

                  </div>
                `;
              }).join('') : `
                <div style="text-align: center; padding: 1rem; color: #94a3b8; font-size: 0.8rem; background: #f8fafc; border-radius: 0.5rem; border: 1px dashed #e2e8f0;">
                  لا توجد واجبات سابقة مسجلة حتى الآن.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- ================= TAB 3: EXAMS (الامتحانات) ================= -->
        <div id="student-tab-content-exams" style="display: ${activeTab === 'exams' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          
          <!-- Quiz KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">معدل درجاتك</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #1d4ed8; margin-top: 0.2rem;">
                ${escapeHtml(summary.quiz_average_percentage || '—')}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                متوسط أدائك في الكويزات
              </div>
            </div>

            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الكويزات المرصودة</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">
                ${escapeHtml(summary.total_quizzes || quizzes.length)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                اختبار تم تصحيحه
              </div>
            </div>
          </div>

          <!-- Active Online Quizzes Section -->
          ${onlineQuizzes.length > 0 ? `
            <div style="background: #ffffff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 2px solid #3b82f6;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.65rem;">
                <div>
                  <h2 style="font-size: 1.05rem; font-weight: 800; color: #1e3a8a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                    ${getIcon('edit', 18, '#2563eb')}
                    <span>امتحانات تفاعلية أونلاين متاحة لك الآن</span>
                  </h2>
                  <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                    اختبر مستواك، الأسئلة تظهر سؤالاً بسؤال مع تايمر للوقت
                  </p>
                </div>
                <span class="badge badge-blue" style="font-weight: 800;">${onlineQuizzes.length} امتحان متاح</span>
              </div>

              <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                ${onlineQuizzes.map(oq => {
                  let parsedQ = {};
                  try {
                    parsedQ = typeof oq.questions === 'string' ? JSON.parse(oq.questions) : (oq.questions || {});
                  } catch (_) {}
                  const qCount = parsedQ.questions?.length || 0;
                  const timeLimit = parsedQ.time_limit_minutes || 20;

                  const todayStr = new Date().toISOString().slice(0, 10);
                  const nowTimeStr = new Date().toTimeString().slice(0, 5);

                  let isAvailable = true;
                  let availabilityMsg = '';

                  if (parsedQ.available_date && parsedQ.available_date !== todayStr) {
                    if (parsedQ.available_date > todayStr) {
                      isAvailable = false;
                      availabilityMsg = `متاح بتاريخ ${parsedQ.available_date}`;
                    } else {
                      isAvailable = false;
                      availabilityMsg = 'انتهت فترة الامتحان';
                    }
                  } else if (parsedQ.start_time && nowTimeStr < parsedQ.start_time) {
                    isAvailable = false;
                    availabilityMsg = `يبدأ الساعة ${parsedQ.start_time}`;
                  } else if (parsedQ.end_time && nowTimeStr > parsedQ.end_time) {
                    isAvailable = false;
                    availabilityMsg = 'انتهى وقت الامتحان';
                  }

                  return `
                    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.75rem; padding: 1rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
                      <div>
                        <div style="font-weight: 900; font-size: 0.95rem; color: #0f172a;">${escapeHtml(oq.title)}</div>
                        <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.25rem; display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
                          <span>${escapeHtml(parsedQ.subject || 'الفيزياء')}</span>
                          <span>•</span>
                          <span>${qCount} أسئلة</span>
                          <span>•</span>
                          <span>المدة: ${timeLimit} دقيقة</span>
                          ${parsedQ.start_time && parsedQ.end_time ? `<span>• (من ${parsedQ.start_time} إلى ${parsedQ.end_time})</span>` : ''}
                        </div>
                      </div>

                      <div>
                        ${oq.submission_status === 'approved' ? `
                          <span style="background: #ecfdf5; color: #059669; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #a7f3d0; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${getIcon('check', 14, '#059669')}
                            <span>تم الحل والتصحيح بنجاح</span>
                          </span>
                        ` : (oq.submission_status === 'needs_grading' ? `
                          <span style="background: #fffbeb; color: #d97706; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${getIcon('clock', 14, '#d97706')}
                            <span>تم التسليم (قيد تصحيح المقالي بالعين)</span>
                          </span>
                        ` : (!isAvailable ? `
                          <span style="background: #fef2f2; color: #b91c1c; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; border-radius: 0.5rem; border: 1px solid #fecaca; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${getIcon('clock', 14, '#b91c1c')}
                            <span>${escapeHtml(availabilityMsg)}</span>
                          </span>
                        ` : `
                          <button 
                            type="button" 
                            class="btn btn-primary" 
                            style="font-weight: 800; font-size: 0.85rem; padding: 0.5rem 1.1rem; border-radius: 0.6rem; display: inline-flex; align-items: center; gap: 0.4rem; box-shadow: 0 2px 8px rgba(37,99,235,0.25);"
                            onclick="window.startStudentOnlineExam('${escapeHtml(oq.id)}')"
                          >
                            <span>بدء الامتحان الآن</span>
                            <span>←</span>
                          </button>
                        `))}
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Quizzes List -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('chart', 18, 'var(--centrly-blue-700)')}
                <span>سجل درجات الكويزات الدورية</span>
              </h2>
              <span class="badge badge-blue" style="font-weight: 700;">${quizzes.length} كويز</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${quizzes.length > 0 ? quizzes.map(q => {
                const tierColor = q.percentage >= 85 ? '#059669' : (q.percentage >= 65 ? '#d97706' : '#dc2626');
                const tierBg = q.percentage >= 85 ? '#ecfdf5' : (q.percentage >= 65 ? '#fffbeb' : '#fef2f2');
                return `
                  <div style="padding: 1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.5rem;">
                    <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                      <div>
                        <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">${escapeHtml(q.title)}</div>
                        ${q.date ? `<div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem;">تاريخ الكويز: ${escapeHtml(q.date)}</div>` : ''}
                      </div>
                      
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-size: 0.75rem; font-weight: 800; color: ${tierColor}; background: ${tierBg}; padding: 0.2rem 0.55rem; border-radius: 0.4rem;">
                          ${escapeHtml(q.tier)}
                        </span>
                        <span style="font-size: 1.1rem; font-weight: 900; color: #1d4ed8; font-family: monospace; background: #eff6ff; padding: 0.25rem 0.65rem; border-radius: 0.4rem; border: 1px solid #bfdbfe;">
                          ${escapeHtml(q.score)} / ${escapeHtml(q.max_score)}
                        </span>
                      </div>
                    </div>

                    <!-- Visual Progress Bar -->
                    <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin-top: 0.25rem;">
                      <div style="width: ${Math.min(100, Math.max(0, q.percentage))}%; height: 100%; background: ${tierColor}; border-radius: 9999px;"></div>
                    </div>

                    ${q.note ? `
                      <div style="font-size: 0.8rem; background: #fff; padding: 0.4rem 0.65rem; border-radius: 0.4rem; border-right: 3px solid #1d4ed8; color: #334155; margin-top: 0.25rem;">
                        <b>ملاحظة المعلم:</b> ${escapeHtml(q.note)}
                      </div>
                    ` : ''}
                  </div>
                `;
              }).join('') : `
                <div style="text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  لم يتم رصد درجات كويزات حتى الآن. ستظهر نتائجك هنا فور تصحيح المعلم للكويز مباشرة.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- ================= TAB 4: VIDEOS (فيديوهات الشرح) ================= -->
        <div id="student-tab-content-videos" style="display: ${activeTab === 'videos' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h2 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                  ${getIcon('video', 18, '#7c3aed')}
                  <span>فيديوهات الشرح والمراجعة</span>
                </h2>
                <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  شروحات مسجلة وحلول التمارين مؤمنة بعلامة مائية لبياناتك الشخصية
                </p>
              </div>
              <span class="badge" style="background: #f5f3ff; color: #7c3aed; border: 1px solid #ede9fe; font-weight: 800;">
                ${videoMaterials.length} فيديو متاح
              </span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${videoMaterials.length > 0 ? videoMaterials.map(m => renderStudentStudyMaterialCard(m, student, homeworkMaterials, approvedHomeworks)).join('') : `
                <div style="text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  لا توجد فيديوهات شرح منشورة لمجموعتك حالياً.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- ================= TAB 5: ATTENDANCE HISTORY (الحضور والغياب) ================= -->
        <div id="student-tab-content-attendance" style="display: ${activeTab === 'attendance' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          
          <!-- Attendance KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">نسبة التزامك</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">
                ${escapeHtml(summary.attendance_rate)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${escapeHtml(summary.attended_count)} حاضر / ${escapeHtml(summary.total_sessions)} حصة
              </div>
            </div>

            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">مرات الغياب</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: ${summary.absent_count > 1 ? '#ef4444' : '#64748b'}; margin-top: 0.2rem;">
                ${escapeHtml(summary.absent_count)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${summary.absent_count === 0 ? 'التزام ممتاز بالحضور' : 'تنبيه: احرص على عدم تفويت الحصص'}
              </div>
            </div>
          </div>

          <!-- Attendance Records -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('calendar', 18, 'var(--centrly-blue-700)')}
                <span>سجل حضور الحصص</span>
              </h2>
              <span class="badge badge-blue" style="font-weight: 700;">${sessions.length} حصة</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${sessions.length > 0 ? sessions.map(s => `
                <div style="padding: 0.85rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.4rem;">
                  <div style="display: flex; justify-content: space-between; align-items: center;">
                    <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a;">
                      حصة رقم ${escapeHtml(s.session_number)} • ${escapeHtml(s.session_date)}
                    </div>
                    <span class="badge ${s.attended ? 'badge-success' : 'badge-danger'}">
                      ${s.attended ? 'حاضر' : 'غائب'}
                    </span>
                  </div>

                  ${s.comment ? `
                    <div style="font-size: 0.8rem; background: #fff; padding: 0.4rem 0.65rem; border-radius: 0.4rem; border-right: 3px solid #1d4ed8; color: #0f172a; margin-top: 0.25rem;">
                      <span><b>ملاحظة المعلم:</b> ${escapeHtml(s.comment)}</span>
                    </div>
                  ` : ''}
                </div>
              `).join('') : `
                <div style="text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  لا توجد حصص مسجلة حتى الآن.
                </div>
              `}
            </div>
          </div>

        </div>

        <!-- ================= TAB 6: STUDENT ATTENDANCE BARCODE PASS ================= -->
        <div id="student-tab-content-card" style="display: ${activeTab === 'card' ? 'flex' : 'none'}; flex-direction: column; gap: 0.85rem; align-items: center; width: 100%;">
          <div style="width: 100%; max-width: 420px;">
            ${renderStudentAttendancePassHtml(student)}
          </div>
        </div>

        <!-- Student Portal Security & Integrity Note -->
        <div style="text-align: center; padding: 1rem 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.6;">
          رابطك الشخصي لمتابعة دراستك • تتحدث البيانات والدرجات تلقائياً<br>
          بوابة الطالب الرسمية — ${escapeHtml(teacherNameStr)}
        </div>

        <!-- Walkthrough Onboarding Tour Modal -->
        ${renderStudentPortalTourHtml()}

      </div>
    </div>
  `;
}

// Global helper for switching tabs in student portal
if (typeof window !== 'undefined') {
  window.switchStudentPortalTab = function(tabName) {
    try {
      if (typeof localStorage !== 'undefined') localStorage.setItem('centrly_portal_student_tab', tabName);
      if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('centrly_portal_student_tab', tabName);
    } catch (_) {}
    const tabs = ['dashboard', 'materials', 'exams', 'videos', 'attendance', 'card'];
    tabs.forEach(t => {
      const content = document.getElementById('student-tab-content-' + t);
      const btn = document.getElementById('student-tab-btn-' + t);
      if (content) {
        content.style.display = (t === tabName) ? 'flex' : 'none';
      }
      if (btn) {
        btn.style.background = (t === tabName) ? '#ffffff' : 'transparent';
        btn.style.color = (t === tabName) ? '#1e3a8a' : '#64748b';
        btn.style.boxShadow = (t === tabName) ? '0 2px 6px rgba(0,0,0,0.08)' : 'none';
      }
    });
  };

  window.scrollToHomework = function(hwId) {
    if (window.switchStudentPortalTab) window.switchStudentPortalTab('materials');
    const targetCard = hwId ? document.getElementById('hw-card-' + hwId) : null;
    if (targetCard) {
      targetCard.scrollIntoView({ behavior: 'smooth', block: 'center' });
      targetCard.style.outline = '2px solid #f59e0b';
      setTimeout(() => { targetCard.style.outline = 'none'; }, 2500);
    } else {
      const activeHw = document.getElementById('student-tab-content-materials');
      if (activeHw) activeHw.scrollIntoView({ behavior: 'smooth' });
    }
  };

  window.togglePdfHelper = function() {
    const content = document.getElementById('pdf-helper-content');
    const arrow = document.getElementById('pdf-helper-arrow');
    if (!content) return;
    const isHidden = content.style.display === 'none' || !content.style.display;
    if (isHidden) {
      content.style.display = 'block';
      if (arrow) arrow.style.transform = 'rotate(180deg)';
    } else {
      content.style.display = 'none';
      if (arrow) arrow.style.transform = 'rotate(0deg)';
    }
  };

  // ========================================================================
  // INTERACTIVE STUDENT ONLINE EXAM RUNNER
  // ========================================================================
  window.startStudentOnlineExam = function(materialId) {
    const materials = window.__portalMaterials || [];
    const mat = materials.find(m => m.id === materialId);
    if (!mat) return;

    let parsed = {};
    try {
      parsed = typeof mat.questions === 'string' ? JSON.parse(mat.questions) : (mat.questions || {});
    } catch (_) {}

    const questions = parsed.questions || [];
    if (questions.length === 0) {
      alert('هذا الامتحان لا يحتوي على أسئلة بعد');
      return;
    }

    window.__currentExam = {
      materialId: mat.id,
      title: mat.title,
      subject: parsed.subject || 'الفيزياء',
      timeLimitMinutes: parsed.time_limit_minutes || 20,
      questions: questions,
      currentIndex: 0,
      answers: {},
      timeRemaining: (parsed.time_limit_minutes || 20) * 60,
      timerInterval: null
    };

    let modalEl = document.getElementById('studentExamModalOverlay');
    if (!modalEl) {
      modalEl = document.createElement('div');
      modalEl.id = 'studentExamModalOverlay';
      modalEl.style.cssText = `
        position: fixed; inset: 0; z-index: 999999;
        background: rgba(15, 23, 42, 0.8);
        backdrop-filter: blur(6px);
        display: flex; align-items: center; justify-content: center;
        padding: 1rem; overflow-y: auto; font-family: 'Cairo', sans-serif;
      `;
      document.body.appendChild(modalEl);
    }

    if (window.__currentExam.timerInterval) clearInterval(window.__currentExam.timerInterval);
    window.__currentExam.timerInterval = setInterval(() => {
      window.__currentExam.timeRemaining--;
      const timerDisplay = document.getElementById('examTimerCountdown');
      if (timerDisplay) {
        const mins = Math.max(0, Math.floor(window.__currentExam.timeRemaining / 60));
        const secs = Math.max(0, window.__currentExam.timeRemaining % 60);
        timerDisplay.textContent = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
        if (window.__currentExam.timeRemaining < 120) {
          timerDisplay.style.color = '#ef4444';
          timerDisplay.style.fontWeight = '900';
        }
      }
      if (window.__currentExam.timeRemaining <= 0) {
        clearInterval(window.__currentExam.timerInterval);
        alert('انتهى وقت الامتحان المخصص! سيتم تسليم إجاباتك تلقائياً الآن.');
        window.submitStudentOnlineExam(true);
      }
    }, 1000);

    window.renderStudentExamRunner();
  };

  window.renderStudentExamRunner = function() {
    const exam = window.__currentExam;
    const modalEl = document.getElementById('studentExamModalOverlay');
    if (!exam || !modalEl) return;

    const q = exam.questions[exam.currentIndex];
    const totalQ = exam.questions.length;
    const isMcq = q.type !== 'essay';
    const selectedAns = exam.answers[q.id];

    const mins = Math.floor(exam.timeRemaining / 60);
    const secs = exam.timeRemaining % 60;
    const formattedTimer = `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;

    modalEl.innerHTML = `
      <div dir="rtl" style="background: #ffffff; border-radius: 16px; max-width: 680px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.3); overflow: hidden; border: 1px solid #e2e8f0; margin: auto; display: flex; flex-direction: column;">
        
        <!-- Header Strip -->
        <div style="background: #1e3a8a; color: #ffffff; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <div style="font-weight: 900; font-size: 1.1rem;">${escapeHtml(exam.title)}</div>
            <div style="font-size: 0.78rem; color: #93c5fd; margin-top: 0.15rem;">مادة ${escapeHtml(exam.subject)} • سؤال ${exam.currentIndex + 1} من ${totalQ}</div>
          </div>

          <!-- Timer Clock Badge -->
          <div style="background: #0f172a; padding: 0.4rem 0.85rem; border-radius: 30px; display: flex; align-items: center; gap: 0.45rem; border: 1.5px solid #3b82f6;">
            <span style="font-size: 0.8rem; color: #94a3b8;">الوقت المتبقي:</span>
            <span id="examTimerCountdown" style="font-family: monospace; font-size: 1.15rem; font-weight: 900; color: #38bdf8;">
              ${formattedTimer}
            </span>
          </div>
        </div>

        <!-- Question Body Card -->
        <div style="padding: 1.5rem; flex: 1;">
          
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.85rem; gap: 0.5rem;">
            <div style="font-size: 1.1rem; font-weight: 800; color: #0f172a; line-height: 1.6;">
              <span style="color: #2563eb; font-weight: 900;">(${exam.currentIndex + 1})</span> 
              ${escapeHtml(q.text || '')}
            </div>
            <span style="background: #eff6ff; color: #1e40af; font-size: 0.78rem; font-weight: 800; padding: 3px 8px; border-radius: 6px; white-space: nowrap;">
              [${q.points || 1} درجات]
            </span>
          </div>

          ${q.image_url ? `
            <div style="text-align: center; margin: 1rem 0;">
              <img src="${escapeHtml(q.image_url)}" alt="صورة المسألة" style="max-height: 220px; max-width: 100%; border-radius: 8px; border: 1px solid #cbd5e1; box-shadow: 0 2px 6px rgba(0,0,0,0.08);" />
            </div>
          ` : ''}

          <!-- MCQ Options or Essay Area -->
          ${isMcq ? `
            <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1.25rem;">
              ${['أ', 'ب', 'ج', 'د'].map((letter, optIdx) => {
                const isSelected = Number(selectedAns) === optIdx;
                const optText = q.choices?.[optIdx] || '';
                return `
                  <div 
                    onclick="window.selectExamChoice(${optIdx})"
                    style="display: flex; align-items: center; gap: 0.75rem; padding: 0.85rem 1rem; border-radius: 10px; border: 2px solid ${isSelected ? '#2563eb' : '#e2e8f0'}; background: ${isSelected ? '#eff6ff' : '#ffffff'}; cursor: pointer; transition: all 0.15s ease;"
                  >
                    <span style="width: 28px; height: 28px; border-radius: 50%; border: 2px solid ${isSelected ? '#2563eb' : '#94a3b8'}; background: ${isSelected ? '#2563eb' : '#fff'}; color: ${isSelected ? '#fff' : '#64748b'}; display: flex; align-items: center; justify-content: center; font-weight: 900; font-size: 0.85rem;">
                      ${letter}
                    </span>
                    <span style="font-weight: 700; font-size: 0.95rem; color: ${isSelected ? '#1e40af' : '#1e293b'}; flex: 1;">
                      ${escapeHtml(optText)}
                    </span>
                  </div>
                `;
              }).join('')}
            </div>
          ` : `
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
              >${escapeHtml(selectedAns || '')}</textarea>
            </div>
          `}

        </div>

        <!-- Question Navigation Dots Strip -->
        <div style="background: #f8fafc; border-top: 1px solid #e2e8f0; padding: 0.75rem 1.25rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
          
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            ${exam.questions.map((item, idx) => {
              const isCurrent = idx === exam.currentIndex;
              const hasAnswered = exam.answers[item.id] !== undefined && exam.answers[item.id] !== '';
              return `
                <button 
                  type="button" 
                  onclick="window.goToExamQuestion(${idx})"
                  style="width: 28px; height: 28px; border-radius: 6px; font-weight: 800; font-size: 0.78rem; border: 1.5px solid ${isCurrent ? '#1e3a8a' : (hasAnswered ? '#10b981' : '#cbd5e1')}; background: ${isCurrent ? '#1e3a8a' : (hasAnswered ? '#dcfce7' : '#ffffff')}; color: ${isCurrent ? '#ffffff' : (hasAnswered ? '#15803d' : '#64748b')}; cursor: pointer;"
                >
                  ${idx + 1}
                </button>
              `;
            }).join('')}
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <button 
              type="button" 
              class="btn btn-secondary" 
              style="padding: 0.45rem 0.85rem; font-size: 0.85rem; font-weight: 700;"
              onclick="window.prevExamQuestion()"
              ${exam.currentIndex === 0 ? 'disabled style="opacity: 0.5;"' : ''}
            >
              السابق
            </button>

            ${exam.currentIndex < totalQ - 1 ? `
              <button 
                type="button" 
                class="btn btn-primary" 
                style="padding: 0.45rem 1rem; font-size: 0.85rem; font-weight: 800;"
                onclick="window.nextExamQuestion()"
              >
                التالي
              </button>
            ` : `
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

      </div>
    `;
  };

  window.selectExamChoice = function(choiceIdx) {
    const exam = window.__currentExam;
    if (!exam) return;
    const q = exam.questions[exam.currentIndex];
    exam.answers[q.id] = choiceIdx;
    window.renderStudentExamRunner();
  };

  window.setExamEssayAnswer = function(text) {
    const exam = window.__currentExam;
    if (!exam) return;
    const q = exam.questions[exam.currentIndex];
    exam.answers[q.id] = text;
  };

  window.nextExamQuestion = function() {
    const exam = window.__currentExam;
    if (!exam || exam.currentIndex >= exam.questions.length - 1) return;
    exam.currentIndex++;
    window.renderStudentExamRunner();
  };

  window.prevExamQuestion = function() {
    const exam = window.__currentExam;
    if (!exam || exam.currentIndex <= 0) return;
    exam.currentIndex--;
    window.renderStudentExamRunner();
  };

  window.goToExamQuestion = function(idx) {
    const exam = window.__currentExam;
    if (!exam || idx < 0 || idx >= exam.questions.length) return;
    exam.currentIndex = idx;
    window.renderStudentExamRunner();
  };

  window.submitStudentOnlineExam = async function(isAuto) {
    const exam = window.__currentExam;
    if (!exam) return;

    if (!isAuto) {
      const answeredCount = Object.keys(exam.answers).filter(k => exam.answers[k] !== undefined && exam.answers[k] !== '').length;
      const totalCount = exam.questions.length;
      if (answeredCount < totalCount) {
        if (!confirm(`لقد قمت بالإجابة على (${answeredCount}) من أصل (${totalCount}) أسئلة. هل أنت متأكد من رغبتك في تسليم الامتحان الآن؟`)) {
          return;
        }
      } else {
        if (!confirm('هل أنت متأكد من تسليم إجاباتك وإنهاء الامتحان؟')) {
          return;
        }
      }
    }

    if (exam.timerInterval) clearInterval(exam.timerInterval);

    const token = window.__portalToken || (typeof location !== 'undefined' ? new URLSearchParams(location.search).get('token') : '');

    try {
      const res = await fetch('/api/public/quizzes/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: token,
          material_id: exam.materialId,
          answers: exam.answers,
          elapsed_seconds: (exam.timeLimitMinutes * 60) - exam.timeRemaining
        })
      });

      const data = await res.json();
      const modalEl = document.getElementById('studentExamModalOverlay');

      if (data?.success) {
        if (modalEl) {
          modalEl.innerHTML = `
            <div dir="rtl" style="background: #ffffff; border-radius: 16px; max-width: 480px; width: 100%; padding: 2rem; text-align: center; box-shadow: 0 25px 50px rgba(0,0,0,0.3); border: 1px solid #e2e8f0; margin: auto;">
              <div style="display: flex; justify-content: center; margin-bottom: 0.75rem; color: #059669;">
                <div style="background: #ecfdf5; border: 2px solid #a7f3d0; border-radius: 50%; width: 64px; height: 64px; display: flex; align-items: center; justify-content: center;">
                  ${getIcon('check', 36, '#059669')}
                </div>
              </div>
              <h2 style="font-size: 1.3rem; font-weight: 900; color: #1e3a8a; margin: 0 0 0.5rem 0;">
                ${data.is_graded ? 'تم تصحيح امتحانك بنجاح!' : 'تم تسليم الامتحان بنجاح!'}
              </h2>
              <p style="font-size: 0.9rem; color: #475569; line-height: 1.6; margin-bottom: 1.25rem;">
                ${escapeHtml(data.message || 'أحسنت صنعاً')}
              </p>
              ${data.is_graded ? `
                <div style="background: #f0fdf4; border: 2px solid #86efac; border-radius: 10px; padding: 1rem; margin-bottom: 1.25rem;">
                  <span style="font-size: 0.85rem; font-weight: 800; color: #166534; display: block;">درجتك المحققة</span>
                  <span style="font-size: 2rem; font-weight: 900; color: #166534;">${data.score} / ${data.max_score}</span>
                </div>
              ` : ''}
              <button 
                type="button" 
                class="btn btn-primary" 
                style="font-weight: 800; padding: 0.6rem 1.8rem; border-radius: 8px;"
                onclick="window.location.reload()"
              >
                العودة لبوابة المتابعة
              </button>
            </div>
          `;
        }
      } else {
        alert(data?.error?.message || 'حدث خطأ أثناء تسليم الامتحان');
      }
    } catch (err) {
      alert('تعذر إرسال الإجابات، يرجى التحقق من اتصال الإنترنت');
    }
  };
}

