import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { renderStudentBarcodeCardHtml } from "../utils/studentBarcodeCard.js";

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
            <button onclick="window.centrlyApp && window.centrlyApp.reloadStudentPortal ? window.centrlyApp.reloadStudentPortal() : window.location.reload()" 
              style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;">
              ${getIcon('refresh', 13, '#ffffff')}
              <span>تحديث</span>
            </button>
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
            <span>المذكرات والواجب</span>
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
            <span>كارت الحضور</span>
          </button>
        </div>

        <!-- ================= TAB 1: MATERIALS & HOMEWORK (TOP OF PAGE) ================= -->
        <div id="student-tab-content-materials" style="display: ${activeTab === 'materials' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          
          <!-- Homework & Materials KPI Summary -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">إجمالي الواجبات</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #1d4ed8; margin-top: 0.2rem;">
                ${homeworkMaterials.length}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                مطلوبة لمجموعتك
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
                ${getIcon('check', 13, '#10b981')}
                <span>تم الاعتماد</span>
              </div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">
                ${escapeHtml(summary.homework_done_count || 0)}
              </div>
              <div style="font-size: 0.725rem; color: #10b981; font-weight: 700; margin-top: 0.2rem;">
                واجبات معتمدة
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">المذكرات والشروحات</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #8b5cf6; margin-top: 0.2rem;">
                ${materials.length}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ملف متاح للتحميل
              </div>
            </div>
          </div>

          <!-- Free PDF Helper & Conversion Guide Accordion -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 1rem; padding: 1rem 1.25rem; box-shadow: 0 2px 6px rgba(16, 185, 129, 0.05);">
            <div style="display: flex; align-items: flex-start; gap: 0.75rem;">
              <div style="color: #166534; margin-top: 2px;">${getIcon('lightbulb', 22, '#166534')}</div>
              <div style="flex: 1;">
                <h3 style="font-size: 0.95rem; font-weight: 800; color: #166534; margin: 0 0 0.35rem 0;">
                  كيف تحول صور حل الكشكول إلى ملف PDF واحد مجاناً في ثوانٍ؟
                </h3>
                <p style="font-size: 0.825rem; color: #15803d; margin: 0 0 0.6rem 0; line-height: 1.5;">
                  إذا قمت بتصوير صفحات حلك بكاميرا الهاتف، يمكنك دمجها في ملف PDF واحد مجاناً وبدون أي برامج مدفوعة:
                </p>
                <div style="background: #ffffff; border: 1px solid #86efac; border-radius: 0.6rem; padding: 0.6rem 0.85rem; font-size: 0.8rem; color: #1e293b; line-height: 1.7;">
                  <b>1.</b> افتح أداة: 
                  <a href="https://www.ilovepdf.com/jpg_to_pdf" target="_blank" rel="noopener noreferrer" 
                    style="color: #1d4ed8; font-weight: 800; text-decoration: underline; margin: 0 0.25rem;">
                    موقع iLovePDF المجاني (تحويل صور JPG إلى PDF)
                  </a>
                  أو استخدم خيار "طباعة كـ PDF" من هاتفك.<br>
                  <b>2.</b> اختر صور صفحات حل الواجب بالترتيب.<br>
                  <b>3.</b> اضغط <b>"تحويل إلى PDF"</b> ثم حمّل الملف على جهازك.<br>
                  <b>4.</b> ارجع هنا واضغط زر <b>"رفع حل الواجب (PDF)"</b> أدناه لإرساله لمعلمك مباشرة!
                </div>
              </div>
            </div>
          </div>

          <!-- Materials & Homework Cards List -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <div>
                <h2 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                  ${getIcon('homework', 18, 'var(--centrly-blue-700)')}
                  <span>الواجبات والمذكرات الدراسية</span>
                </h2>
                <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  تأكد من تسليم واجباتك قبل الموعد النهائي لتسجيل درجاتك
                </p>
              </div>
              <span class="badge badge-blue" style="font-weight: 700;">${materials.length} ملف</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 1rem;">
              ${materials.length > 0 ? materials.map(m => {
                const isPdf = m.type === 'pdf';
                const isVideo = m.type === 'video';
                const typeBadge = isPdf 
                  ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('file', 12, '#1d4ed8')} PDF</span>` 
                  : (isVideo ? `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('video', 12, '#1d4ed8')} فيديو</span>` : `<span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('link', 12, '#1d4ed8')} رابط</span>`);
                const actionText = isPdf ? 'تحميل / فتح المذكرة' : (isVideo ? 'مشاهدة الفيديو' : 'فتح الرابط');
                
                // Submission status badge & styling
                const status = m.submission_status || 'unsubmitted';
                const isApproved = status === 'approved';
                const isPending = status === 'pending';
                const isRejected = status === 'rejected';
                const isUnsubmitted = status === 'unsubmitted' || status === 'missing';

                return `
                  <div style="padding: 1.1rem; border-radius: 0.85rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.75rem;">
                    
                    <!-- Top row: Title and Tags -->
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
                          <span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 0.35rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                            ${typeBadge}
                          </span>
                          ${m.is_homework ? `
                            <span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 0.35rem; background: #fef3c7; color: #b45309; border: 1px solid #fde68a; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${getIcon('homework', 12, '#b45309')}
                              <span>واجب منزلي مطلوب</span>
                            </span>
                          ` : ''}
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
                            <div style="font-weight: 800; color: #1e40af; font-size: 0.825rem; margin-bottom: 0.25rem;">${m.is_homework ? 'وصف الواجب والمطلوب حله:' : 'توجيهات أو وصف المذكرة:'}</div>
                            <div style="white-space: pre-wrap; color: #334155;">${escapeHtml(m.description)}</div>
                          </div>
                        ` : ''}

                        ${(m.url && m.url !== '#') ? `
                          <div style="margin-top: 0.6rem;">
                            <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" 
                              style="display: inline-flex; align-items: center; gap: 0.4rem; background: #2563eb; color: #ffffff; font-weight: 800; text-decoration: none; padding: 0.45rem 0.85rem; border-radius: 0.5rem; font-size: 0.825rem; box-shadow: 0 2px 4px rgba(37,99,235,0.2);">
                              ${getIcon(isPdf ? 'file' : (isVideo ? 'video' : 'link'), 14, '#ffffff')}
                              <span>${m.is_homework ? 'فتح / تحميل ملف الواجب المرفق (PDF / الرابط)' : actionText}</span>
                            </a>
                          </div>
                        ` : ''}
                      </div>
                    </div>

                    <!-- Due date if homework -->
                    ${m.is_homework && m.due_date ? `
                      <div style="font-size: 0.775rem; color: #b45309; background: #fffbeb; padding: 0.4rem 0.7rem; border-radius: 0.4rem; border: 1px solid #fef3c7; display: flex; align-items: center; gap: 0.4rem;">
                        ${getIcon('clock', 13, '#b45309')}
                        <span>آخر موعد لتسليم الواجب: <b>${escapeHtml(m.due_date)}</b></span>
                      </div>
                    ` : ''}

                    <!-- Homework Submission Box (Only if is_homework) -->
                    ${m.is_homework ? `
                      <div style="background: #ffffff; border: 1px solid #e2e8f0; border-radius: 0.65rem; padding: 0.85rem; margin-top: 0.2rem;">
                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 0.5rem;">
                          <div style="font-size: 0.825rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                            ${getIcon('upload', 14, '#0f172a')}
                            <span>حالة تسليمك للواجب:</span>
                          </div>
                          
                          <div>
                            ${isApproved ? `
                              <span style="font-size: 0.75rem; font-weight: 800; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                                ${getIcon('check', 13, '#059669')}
                                <span>معتمد من المعلم</span>
                              </span>
                            ` : (isPending ? `
                              <span style="font-size: 0.75rem; font-weight: 800; background: #fffbeb; color: #d97706; border: 1px solid #fde68a; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                                ${getIcon('clock', 13, '#d97706')}
                                <span>تم الرفع (قيد المراجعة)</span>
                              </span>
                            ` : (isRejected ? `
                              <span style="font-size: 0.75rem; font-weight: 800; background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                                ${getIcon('alertTriangle', 13, '#dc2626')}
                                <span>يحتاج إعادة تسليم</span>
                              </span>
                            ` : `
                              <span style="font-size: 0.75rem; font-weight: 800; background: #f1f5f9; color: #64748b; border: 1px solid #cbd5e1; padding: 0.25rem 0.65rem; border-radius: 0.4rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                                <span>لم يُسلّم بعد</span>
                              </span>
                            `))}
                          </div>
                        </div>

                        ${m.teacher_feedback ? `
                          <div style="font-size: 0.8rem; background: #fff7ed; border-right: 3px solid #ea580c; padding: 0.45rem 0.65rem; border-radius: 0.35rem; color: #9a3412; margin-bottom: 0.6rem;">
                            <b>ملاحظة المعلم:</b> ${escapeHtml(m.teacher_feedback)}
                          </div>
                        ` : ''}

                        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.4rem;">
                          ${m.submission_url ? `
                            <a href="${escapeHtml(m.submission_url)}" target="_blank" rel="noopener noreferrer"
                              style="font-size: 0.8rem; color: #2563eb; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${getIcon('file', 14, '#2563eb')}
                              <span>معاينة ملفك المرفوع (${escapeHtml(m.submitted_at ? m.submitted_at.slice(0, 10) : 'مرفوع')})</span>
                            </a>
                          ` : (isApproved ? `
                            <span style="font-size: 0.78rem; color: #059669; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                              ${getIcon('check', 13, '#059669')}
                              <span>تم اعتماد الواجب بنجاح وحذف الملف لتوفير المساحة</span>
                            </span>
                          ` : `
                            <span style="font-size: 0.75rem; color: #94a3b8;">ارفع الحل بصيغة PDF أو صورة واضحة (الحد الأقصى 25MB)</span>
                          `)}

                          <!-- File Upload Trigger (PDF or Images) -->
                          <div>
                            <input type="file" id="hw-file-input-${escapeHtml(m.id)}" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.heic" style="display: none;" 
                              onchange="window.centrlyApp && window.centrlyApp.handleStudentHomeworkUpload ? window.centrlyApp.handleStudentHomeworkUpload('${escapeHtml(m.id)}', this.files[0]) : null">
                            
                            ${isApproved ? `
                              <button type="button" disabled
                                style="background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0; padding: 0.45rem 0.9rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem; cursor: default;">
                                ${getIcon('check', 14, '#059669')}
                                <span>الواجب معتمد ومكتمل</span>
                              </button>
                            ` : `
                              <button type="button" onclick="document.getElementById('hw-file-input-${escapeHtml(m.id)}').click()" id="hw-upload-btn-${escapeHtml(m.id)}"
                                style="background: #059669; color: #ffffff; border: 1px solid #059669; padding: 0.45rem 0.9rem; border-radius: 0.5rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.2s; box-shadow: 0 2px 6px rgba(5,150,105,0.2);">
                                ${getIcon('upload', 14, '#ffffff')}
                                <span>${isPending ? 'تعديل / رفع نسخة أحدث' : 'رفع حل الواجب (PDF أو صورة)'}</span>
                              </button>
                            `}
                          </div>
                        </div>

                      </div>
                    ` : ''}

                    <!-- Download study material button or notebook instructions -->
                    ${m.url && m.url !== '#' && m.url.trim().length > 0 ? `
                      <div style="display: flex; justify-content: flex-end; margin-top: 0.25rem;">
                        <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer"
                          style="display: inline-flex; align-items: center; gap: 0.4rem; background: #1d4ed8; color: #ffffff; padding: 0.5rem 1rem; border-radius: 0.5rem; text-decoration: none; font-size: 0.825rem; font-weight: 700; box-shadow: 0 1px 3px rgba(29,78,216,0.2);">
                          ${getIcon('download', 14, '#ffffff')}
                          <span>${actionText}</span>
                        </a>
                      </div>
                    ` : (m.is_homework ? `
                      <div style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.78rem; color: #1e40af; background: #eff6ff; padding: 0.45rem 0.75rem; border-radius: 0.45rem; border: 1px solid #bfdbfe; margin-top: 0.25rem;">
                        ${getIcon('edit', 14, '#1e40af')}
                        <span><b>طريقة التسليم:</b> قم بحل الأسئلة في كشكولك بخط واضح، ثم صوّر الصفحات بكاميرا الموبايل وارفع الصورة أو ملف الـ PDF عبر زر الرفع أعلاه مباشرة.</span>
                      </div>
                    ` : '')}

                  </div>
                `;
              }).join('') : `
                <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('materials', 36, '#94a3b8')}</div>
                  لا توجد مذكرات أو واجبات دراسية مضافة لمجموعتك حتى الآن.<br>
                  ستظهر الملفات هنا فور نشرها من قِبل معلمك مباشرة.
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

        <!-- ================= TAB 4: STUDENT BARCODE CARD ================= -->
        <div id="student-tab-content-card" style="display: ${activeTab === 'card' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem; align-items: center; width: 100%;">
          <div style="width: 100%; max-width: 480px;">
            ${renderStudentBarcodeCardHtml(student)}
          </div>

          <!-- Usage Instructions -->
          <div style="max-width: 480px; width: 100%; background: #ffffff; border-radius: 0.85rem; padding: 1rem 1.25rem; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.03);">
            <div style="font-weight: 800; font-size: 0.88rem; color: #0f172a; margin-bottom: 0.45rem; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('lightbulb', 16, '#f59e0b')}
              <span>طريقة استخدام كارت الحضور الذكي</span>
            </div>
            <ul style="margin: 0; padding-right: 1.2rem; font-size: 0.82rem; color: #475569; line-height: 1.7;">
              <li>اضغط على <b>تكبير للشاشة</b> لفتح الباركود بحجم كامل وإضاءة عالية لتسهيل مسحه بسكانر السنتر.</li>
              <li>اضغط على <b>حفظ الكارت (PNG)</b> لتنزيل صورة الكارت بجودة عالية على هاتفك واستخدامه دون اتصال بالإنترنت.</li>
              <li>يُمسح الكود ضوئياً عند دخولك الحصة ليتم تسجيل حضورك تلقائياً وإشعار ولي أمرك.</li>
            </ul>
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
}
