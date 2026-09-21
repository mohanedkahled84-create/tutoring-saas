import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { renderStudentBarcodeCardHtml, renderStudentAttendancePassHtml } from "../utils/studentBarcodeCard.js";

/**
 * Centrly Student Web Portal Component
 * Student-centric view prioritized for learners:
 * 1. Study Materials & Homework Upload (Top priority)
 * 2. Instant PDF uploader with direct Supabase Cloud storage
 * 3. Step-by-step JPG to PDF guide with iLovePDF link
 * 4. Quizzes & Exam Grades
 * 5. Attendance History & Teachers Notes
 */

export function renderStudentPortalView(portalData = {}, activeTab = 'materials') {
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
  const homeworkMaterials = materials.filter(m => m.is_homework);
  const studyMaterials = materials.filter(m => !m.is_homework);
  const approvedHomeworks = homeworkMaterials.filter(m => m.submission_status === 'approved');

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
            return true; // Deadline passed -> Finished (لم يتم تسليمه)
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
      <div style="max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Student Portal Header -->
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); border-radius: 1.25rem; padding: 1.5rem; box-shadow: 0 4px 20px rgba(37, 99, 235, 0.15); color: #fff; text-align: center; position: relative; overflow: hidden;">
          <!-- Subtle decorative circle -->
          <div style="position: absolute; top: -20px; right: -20px; width: 100px; height: 100px; background: rgba(255,255,255,0.08); border-radius: 50%;"></div>
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; position: relative; z-index: 2;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #10b981; font-weight: 700; background: rgba(255,255,255,0.95); padding: 0.25rem 0.6rem; border-radius: 9999px;">
              <span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%;"></span>
              بوابة الطالب الرسمية
            </span>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
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
            المذكرات الدراسية، رفع الواجبات، ومتابعة الدرجات والغياب أولاً بأول
          </p>
        </div>

        <!-- 4-Tab Navigation Bar (Materials, Quizzes, Attendance, Barcode ID Card) -->
        <div style="display: grid; grid-template-columns: repeat(4, 1fr); background: #e2e8f0; padding: 4px; border-radius: 0.85rem; gap: 4px;">
          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('materials') : null" id="student-tab-btn-materials"
            style="padding: 0.65rem 0.35rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.3rem; background: ${activeTab === 'materials' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'materials' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'materials' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('materials', 15, activeTab === 'materials' ? '#1e3a8a' : '#64748b')}
            <span>المذكرات والواجب ${homeworkMaterials.length > 0 ? `(${approvedHomeworks.length}/${homeworkMaterials.length})` : `(${materials.length})`}</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('quizzes') : null" id="student-tab-btn-quizzes"
            style="padding: 0.65rem 0.35rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.3rem; background: ${activeTab === 'quizzes' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'quizzes' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'quizzes' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('chart', 15, activeTab === 'quizzes' ? '#1e3a8a' : '#64748b')}
            <span>الكويزات (${quizzes.length})</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('attendance') : null" id="student-tab-btn-attendance"
            style="padding: 0.65rem 0.35rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.3rem; background: ${activeTab === 'attendance' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'attendance' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'attendance' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('calendar', 15, activeTab === 'attendance' ? '#1e3a8a' : '#64748b')}
            <span>الحضور والغياب</span>
          </button>

          <button type="button" onclick="window.switchStudentPortalTab ? window.switchStudentPortalTab('card') : null" id="student-tab-btn-card"
            style="padding: 0.65rem 0.35rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.82rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.3rem; background: ${activeTab === 'card' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'card' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'card' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('barcode', 15, activeTab === 'card' ? '#1e3a8a' : '#64748b')}
            <span>باركود الحضور</span>
          </button>
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
                ${homeworkMaterials.length > 0 && approvedHomeworks.length === homeworkMaterials.length ? 'تم تسليم كافة الواجبات ★' : `تم تسليم ${approvedHomeworks.length} واجب بنجاح`}
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
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.85rem; overflow: hidden; box-shadow: 0 1px 4px rgba(16, 185, 129, 0.05);">
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
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
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
                ${sortedActiveHomeworks.length > 0 ? `${sortedActiveHomeworks.length} واجب مطلوب` : 'لا توجد واجبات متأخرة ✓'}
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
                  <div style="padding: 1.1rem; border-radius: 0.85rem; background: ${cardBg}; border: 1px solid ${cardBorder}; display: flex; flex-direction: column; gap: 0.65rem;">
                    
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

                        ${(m.url && m.url !== '#') ? `
                          <div style="margin-top: 0.6rem;">
                            <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" 
                              style="display: inline-flex; align-items: center; gap: 0.4rem; background: #2563eb; color: #ffffff; font-weight: 800; text-decoration: none; padding: 0.45rem 0.85rem; border-radius: 0.5rem; font-size: 0.825rem; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                              ${getIcon(isPdf ? 'file' : (isVideo ? 'video' : 'link'), 14, '#ffffff')}
                              <span>فتح / تحميل ملف الواجب المرفق (PDF / الرابط)</span>
                            </a>
                          </div>
                        ` : ''}
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
                          <a href="${escapeHtml(m.submission_url)}" target="_blank" rel="noopener noreferrer"
                            style="font-size: 0.8rem; color: #2563eb; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${getIcon('file', 14, '#2563eb')}
                            <span>معاينة ملفك المرفوع (${escapeHtml(m.submitted_at ? m.submitted_at.slice(0, 10) : 'مرفوع')})</span>
                          </a>
                        ` : `
                          <span style="font-size: 0.75rem; color: #94a3b8;">ارفع الحل بصيغة PDF أو صورة واضحة (الحد الأقصى 25MB)</span>
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
            <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
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
                ${studyMaterials.map(m => {
                  const isPdf = m.type === 'pdf';
                  const isVideo = m.type === 'video';
                  const typeBadge = isPdf 
                    ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('file', 12, '#1d4ed8')} PDF</span>` 
                    : (isVideo ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('video', 12, '#1d4ed8')} فيديو</span>` : `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('link', 12, '#1d4ed8')} رابط</span>`);
                  const actionText = isPdf ? 'تحميل / فتح المذكرة' : (isVideo ? 'مشاهدة الفيديو' : 'فتح الرابط');

                  return `
                    <div style="padding: 0.9rem 1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; justify-content: space-between; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
                      <div style="flex: 1; min-width: 180px;">
                        <div style="margin-bottom: 0.25rem;">
                          <span style="font-size: 0.7rem; font-weight: 800; padding: 0.15rem 0.45rem; border-radius: 0.3rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                            ${typeBadge}
                          </span>
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

                      ${(m.url && m.url !== '#') ? `
                        <div>
                          <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer" 
                            style="display: inline-flex; align-items: center; gap: 0.35rem; background: #1d4ed8; color: #ffffff; padding: 0.45rem 0.85rem; border-radius: 0.5rem; text-decoration: none; font-size: 0.8rem; font-weight: 800; box-shadow: 0 1px 3px rgba(29,78,216,0.2);">
                            ${getIcon(isPdf ? 'download' : (isVideo ? 'video' : 'link'), 13, '#ffffff')}
                            <span>${actionText}</span>
                          </a>
                        </div>
                      ` : ''}
                    </div>
                  `;
                }).join('')}
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

        <!-- ================= TAB 2: QUIZZES & GRADES ================= -->
        <div id="student-tab-content-quizzes" style="display: ${activeTab === 'quizzes' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          
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

        <!-- ================= TAB 3: ATTENDANCE HISTORY ================= -->
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

        <!-- ================= TAB 4: STUDENT ATTENDANCE BARCODE PASS ================= -->
        <div id="student-tab-content-card" style="display: ${activeTab === 'card' ? 'flex' : 'none'}; flex-direction: column; gap: 0.85rem; align-items: center; width: 100%;">
          <div style="width: 100%; max-width: 420px;">
            ${renderStudentAttendancePassHtml(student)}
          </div>
        </div>

        <!-- Student Portal Security & Integrity Note -->
        <div style="text-align: center; padding: 1rem 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.6;">
          رابطك الشخصي لمتابعة دراستك • تتحدث البيانات والدرجات تلقائياً<br>
          مدعوم بواسطة <b>منظومة سنترلي (Centrly Student Portal)</b>
        </div>

      </div>
    </div>
  `;
}

// Global helper for switching tabs in student portal
if (typeof window !== 'undefined') {
  window.switchStudentPortalTab = function(tabName) {
    const tabs = ['materials', 'quizzes', 'attendance', 'card'];
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
}
