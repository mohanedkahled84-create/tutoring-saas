import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Parent Web Portal Component (DEV-34 & DEV-PORTAL)
 * Lightweight, mobile-first, no-app, no-login portal for Egyptian parents
 * to track student attendance, quiz grades, homework status, and teacher notes.
 */

export function renderParentPortalView(portalData = {}, activeTab = 'attendance') {
  if (portalData.error || !portalData.student) {
    return `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; padding: 1.5rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
        <div style="max-width: 480px; width: 100%; background: #fff; border-radius: 1rem; padding: 2.5rem; box-shadow: 0 4px 15px rgba(0,0,0,0.05); border: 1px solid #e2e8f0; text-align: center;">
          <div style="display: flex; justify-content: center; margin-bottom: 0.75rem;">${getIcon('lock', 48, '#ef4444')}</div>
          <h2 style="font-size: 1.3rem; font-weight: 800; color: #ef4444; margin: 0 0 0.5rem 0;">رابط غير صالح أو منتهي الصلاحية</h2>
          <p style="font-size: 0.9rem; color: #64748b; margin: 0 0 1.5rem 0; line-height: 1.6;">
            ${escapeHtml(portalData.error || 'تعذر تحميل بيانات متابعة الطالب. يرجى التأكد من فتح الرابط الصحيح المرسل عبر الواتساب أو مراجعة إدارة السنتر.')}
          </p>
          <div style="font-size: 0.75rem; color: #94a3b8; border-top: 1px solid #e2e8f0; padding-top: 1rem;">
            منظومة سنترلي التعليمية | Centrly
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
    total_quizzes: 0,
    quiz_average_percentage: '—',
  };
  const sessions = portalData.sessions || [];
  const quizzes = portalData.quizzes || [];
  const materials = portalData.materials || [];
  const homeworkList = materials.filter(m => m.is_homework);
  const studyMaterials = materials.filter(m => !m.is_homework);

  return `
    <div style="min-height: 100vh; background-color: #f8fafc; padding: 1rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="max-width: 640px; margin: 0 auto; display: flex; flex-direction: column; gap: 1rem;">
        
        <!-- Portal Header -->
        <div style="background: #fff; border-radius: 1rem; padding: 1.25rem 1.5rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0; text-align: center; position: relative;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <span style="display: inline-flex; align-items: center; gap: 0.35rem; font-size: 0.75rem; color: #10b981; font-weight: 700; background: #ecfdf5; padding: 0.25rem 0.6rem; border-radius: 9999px;">
              <span style="display:inline-block; width:6px; height:6px; background:#10b981; border-radius:50%;"></span>
              محدّث لحظياً
            </span>
            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <button onclick="window.centrlyApp && window.centrlyApp.reloadParentPortal ? window.centrlyApp.reloadParentPortal() : window.location.reload()" 
                style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #334155; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;">
                ${getIcon('refresh', 13, '#334155')}
                <span>تحديث البيانات</span>
              </button>
              <button onclick="window.centrlyApp && window.centrlyApp.handlePortalLogout ? window.centrlyApp.handlePortalLogout() : (window.location.href='/portal')" 
                style="background: #fee2e2; border: 1px solid #fca5a5; border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #b91c1c; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;" title="تسجيل الخروج">
                ${getIcon('logout', 13, '#b91c1c')}
                <span>خروج</span>
              </button>
            </div>
          </div>

          <div class="brand-logo-badge" style="margin: 0 auto 0.5rem; width: 44px; height: 44px; font-size: 1.25rem;">سـ</div>
          <h1 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0;">بوابة متابعة ولي الأمر | سنترلي</h1>
          
          <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap;">
            <span style="font-size: 1.2rem; font-weight: 900; color: #1d4ed8;">${escapeHtml(student.name)}</span>
            <span class="badge badge-secondary" style="font-family: monospace; font-size: 0.8rem;">كود: ${escapeHtml(student.student_code)}</span>
            ${student.group_name ? `<span class="badge badge-blue" style="font-size: 0.8rem;">${escapeHtml(student.group_name)}</span>` : ''}
          </div>
          
          <p style="font-size: 0.8rem; color: #64748b; margin: 0.4rem 0 0 0;">
            تقرير الحضور والغياب، درجات الكويزات، والواجبات والمذكرات الدراسية
          </p>
        </div>

        <!-- 3-Tab Navigation Bar: Attendance, Quizzes, Homework & Materials Tracking -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); background: #e2e8f0; padding: 4px; border-radius: 0.85rem; gap: 4px;">
          <button type="button" onclick="window.switchParentPortalTab ? window.switchParentPortalTab('attendance') : null" id="tab-btn-attendance"
            style="padding: 0.7rem 0.5rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: ${activeTab === 'attendance' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'attendance' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'attendance' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('calendar', 16, activeTab === 'attendance' ? '#1e3a8a' : '#64748b')}
            <span>الحضور والغياب</span>
          </button>
          
          <button type="button" onclick="window.switchParentPortalTab ? window.switchParentPortalTab('quizzes') : null" id="tab-btn-quizzes"
            style="padding: 0.7rem 0.5rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: ${activeTab === 'quizzes' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'quizzes' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'quizzes' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('chart', 16, activeTab === 'quizzes' ? '#1e3a8a' : '#64748b')}
            <span>الكويزات (${quizzes.length})</span>
          </button>

          <button type="button" onclick="window.switchParentPortalTab ? window.switchParentPortalTab('homework') : null" id="tab-btn-homework"
            style="padding: 0.7rem 0.5rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: ${activeTab === 'homework' || activeTab === 'materials' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'homework' || activeTab === 'materials' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'homework' || activeTab === 'materials' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            ${getIcon('homework', 16, activeTab === 'homework' || activeTab === 'materials' ? '#1e3a8a' : '#64748b')}
            <span>الواجبات والمذكرات (${materials.length})</span>
          </button>
        </div>

        <!-- ================= TAB 1: ATTENDANCE & TIMELINE ================= -->
        <div id="tab-content-attendance" style="display: ${activeTab === 'attendance' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          <!-- KPI Summary Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">نسبة الحضور</div>
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
                ${summary.absent_count === 0 ? 'التزام تام بالحضور' : (summary.absent_count > 1 ? 'تنبيه: تكرار غياب' : 'غياب مرة واحدة')}
              </div>
            </div>

            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">إنجاز الواجبات</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #8b5cf6; margin-top: 0.2rem;">
                ${summary.homework_done_count > 0 ? `${summary.homework_done_count}` : '—'}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                ${summary.homework_done_count > 0 ? `تم تسليم ${summary.homework_done_count} واجب` : 'لا توجد واجبات مسجلة'}
              </div>
            </div>
          </div>

          <!-- Attendance Records -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('calendar', 18, 'var(--centrly-blue-700)')}
                <span>سجل الحصص والالتزام</span>
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

                  ${s.attended && s.homework_status && s.homework_status !== 'none' ? `
                    <div style="display: flex; gap: 0.75rem; font-size: 0.8rem; color: #64748b; align-items: center;">
                      <span>الواجب: 
                        <b style="color: ${s.homework_status === 'done' ? '#059669' : (s.homework_status === 'partial' ? '#d97706' : '#dc2626')};">
                          ${s.homework_status === 'done' ? 'تم التسليم بالكامل' : (s.homework_status === 'partial' ? 'تسليم جزئي' : 'لم يُسلم')}
                        </b>
                      </span>
                    </div>
                  ` : ''}

                  ${s.comment ? `
                    <div style="font-size: 0.8rem; background: #fff; padding: 0.4rem 0.65rem; border-radius: 0.4rem; border-right: 3px solid #1d4ed8; color: #0f172a; margin-top: 0.25rem;">
                      <span><b>ملاحظة المعلم:</b> ${escapeHtml(s.comment)}</span>
                    </div>
                  ` : ''}
                </div>
              `).join('') : `
                <div style="text-align: center; padding: 2rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  لا توجد حصص مسجلة حتى الآن لهذا الطالب.
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- ================= TAB 2: QUIZZES & EXAMS ================= -->
        <div id="tab-content-quizzes" style="display: ${activeTab === 'quizzes' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          <!-- Quiz KPI -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">معدل الدرجات</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #1d4ed8; margin-top: 0.2rem;">
                ${escapeHtml(summary.quiz_average_percentage || '—')}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                متوسط الأداء العام
              </div>
            </div>

            <div style="background: #fff; padding: 1.1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">الكويزات المرصودة</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #059669; margin-top: 0.2rem;">
                ${escapeHtml(summary.total_quizzes || quizzes.length)}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                اختبار دوري
              </div>
            </div>
          </div>

          <!-- Quizzes List -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                ${getIcon('chart', 18, 'var(--centrly-blue-700)')}
                <span>درجات الكويزات والامتحانات الدورية</span>
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
                  لم يتم رصد أي كويزات لهذا الطالب حتى الآن. ستظهر النتائج فور رصدها من قِبل المعلم مباشرة.
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- ================= TAB 3: HOMEWORK STATUS (الواجب اتسلم ولا لأ فقط) ================= -->
        <div id="tab-content-homework" style="display: ${activeTab === 'homework' || activeTab === 'materials' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          
          <!-- Homework & Materials KPI Stats for Parent -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(130px, 1fr)); gap: 0.75rem;">
            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b;">إجمالي الواجبات</div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #1d4ed8; margin-top: 0.2rem;">
                ${homeworkList.length}
              </div>
              <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                مطلوبة لمجموعة الطالب
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                ${getIcon('check', 14, '#10b981')}
                <span>تم تسليمه واعتُمِد</span>
              </div>
              <div style="font-size: 1.6rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">
                ${homeworkList.filter(h => h.submission_status === 'approved').length}
              </div>
              <div style="font-size: 0.725rem; color: #10b981; font-weight: 700; margin-top: 0.2rem;">
                واجبات محلولة ومعتمدة
              </div>
            </div>

            <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
              <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                ${getIcon('close', 14, '#ef4444')}
                <span>لم يُسلّم بعد</span>
              </div>
              <div style="font-size: 1.6rem; font-weight: 900; color: ${homeworkList.filter(h => !h.submission_status || h.submission_status === 'unsubmitted' || h.submission_status === 'missing').length > 0 ? '#ef4444' : '#64748b'}; margin-top: 0.2rem;">
                ${homeworkList.filter(h => !h.submission_status || h.submission_status === 'unsubmitted' || h.submission_status === 'missing').length}
              </div>
              <div style="font-size: 0.725rem; color: ${homeworkList.filter(h => !h.submission_status || h.submission_status === 'unsubmitted' || h.submission_status === 'missing').length > 0 ? '#dc2626' : '#64748b'}; font-weight: 700; margin-top: 0.2rem;">
                ${homeworkList.filter(h => !h.submission_status || h.submission_status === 'unsubmitted' || h.submission_status === 'missing').length > 0 ? 'بحاجة لمتابعة ولي الأمر' : 'لا توجد واجبات متأخرة'}
              </div>
            </div>

            ${studyMaterials.length > 0 ? `
              <div style="background: #fff; padding: 1rem 0.85rem; border-radius: 0.85rem; border: 1px solid #e2e8f0; text-align: center; box-shadow: 0 1px 4px rgba(0,0,0,0.02);">
                <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
                  ${getIcon('file', 14, '#8b5cf6')}
                  <span>مذكرات وملازم PDF</span>
                </div>
                <div style="font-size: 1.6rem; font-weight: 900; color: #8b5cf6; margin-top: 0.2rem;">
                  ${studyMaterials.length}
                </div>
                <div style="font-size: 0.725rem; color: #64748b; margin-top: 0.2rem;">
                  جاهزة للعرض والتحميل
                </div>
              </div>
            ` : ''}
          </div>

          <!-- Free PDF Helper & Conversion Guide Accordion (Collapsible) -->
          <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.85rem; overflow: hidden; box-shadow: 0 1px 4px rgba(16, 185, 129, 0.05); margin-bottom: 0.85rem;">
            <button type="button" onclick="window.togglePdfHelper ? window.togglePdfHelper() : null" 
              style="width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.1rem; background: #f0fdf4; border: none; cursor: pointer; text-align: right; transition: background 0.2s;"
              onmouseover="this.style.background='#dcfce7'" onmouseout="this.style.background='#f0fdf4'">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex: 1;">
                <div style="color: #166534; display: flex; align-items: center;">${getIcon('lightbulb', 20, '#166534')}</div>
                <div>
                  <span style="font-size: 0.88rem; font-weight: 800; color: #166534; display: block;">
                    مش عارف تحوّل صور حل الكشكول إلى ملف PDF لرفعها؟
                  </span>
                  <span style="font-size: 0.73rem; color: #15803d; font-weight: 600;">
                    (اضغط هنا لمعرفة طريقة دمج وتصوير الواجب في ثوانٍ)
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
                إذا قمت بتصوير صفحات حل الواجب بكاميرا الهاتف، يمكنك دمجها في ملف PDF واحد مجاناً:
              </p>
              <div style="background: #f8fafc; border: 1px solid #cbd5e1; border-radius: 0.6rem; padding: 0.65rem 0.85rem; font-size: 0.8rem; color: #1e293b; line-height: 1.8;">
                <b>1.</b> افتح أداة: 
                <a href="https://www.ilovepdf.com/jpg_to_pdf" target="_blank" rel="noopener noreferrer" 
                  style="color: #1d4ed8; font-weight: 800; text-decoration: underline; margin: 0 0.25rem;">
                  موقع iLovePDF المجاني (تحويل صور JPG إلى PDF)
                </a>
                أو استخدم خيار "طباعة كـ PDF" من هاتفك.<br>
                <b>2.</b> اختر صور صفحات حل الواجب بالترتيب من ألبوم الصور.<br>
                <b>3.</b> اضغط <b>"تحويل إلى PDF"</b> ثم حمّل الملف الناتج.<br>
                <b>4.</b> اضغط زر <b>"رفع حل الواجب (PDF أو صورة)"</b> عند الواجب المطلوب أدناه لإرساله للمعلم مباشرة!
              </div>
            </div>
          </div>

          <!-- Homework List Section -->
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <div>
                <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                  ${getIcon('homework', 18, 'var(--centrly-blue-700)')}
                  <span>متابعة تسليم الواجبات المنزلية</span>
                </h2>
                <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  توضيح فوري لما تم تسليمه وما لم يقم الطالب بحله بعد، مع إمكانية رفع الحل مباشرة
                </p>
              </div>
              <span class="badge badge-blue" style="font-weight: 700;">${homeworkList.length} واجب</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${homeworkList.length > 0 ? homeworkList.map(h => {
                const isApproved = h.submission_status === 'approved';
                const isPending = h.submission_status === 'pending';
                const isRejected = h.submission_status === 'rejected';
                const isMissing = !h.submission_status || h.submission_status === 'unsubmitted' || h.submission_status === 'missing';

                return `
                  <div style="padding: 1.1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid ${isApproved ? '#bbf7d0' : (isMissing ? '#fecaca' : '#e2e8f0')}; display: flex; flex-direction: column; gap: 0.6rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
                      <div style="flex: 1; min-width: 200px;">
                        <div style="font-size: 0.72rem; font-weight: 800; color: #b45309; background: #fef3c7; border: 1px solid #fde68a; display: inline-block; padding: 0.2rem 0.5rem; border-radius: 0.35rem; margin-bottom: 0.35rem;">
                          واجب منزلي
                        </div>
                        <h3 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0;">
                          ${escapeHtml(h.title)}
                        </h3>

                        ${(h.book_name || h.pages || h.questions) ? `
                          <div style="font-size: 0.8rem; color: #1e40af; background: #eff6ff; border: 1px solid #bfdbfe; padding: 0.35rem 0.65rem; border-radius: 0.4rem; margin-top: 0.4rem; display: inline-flex; align-items: center; gap: 0.35rem; flex-wrap: wrap;">
                            <span style="display: inline-flex; align-items: center; gap: 0.25rem;">${getIcon('book', 14, '#1e40af')} <b>الكتاب:</b> ${escapeHtml(h.book_name || 'الكتاب المدرسي')}</span>
                            ${h.pages ? `<span>• <b>ص:</b> ${escapeHtml(h.pages)}</span>` : ''}
                            ${h.questions ? `<span style="color: #b45309; font-weight: 700;">• <b>الأسئلة:</b> ${escapeHtml(h.questions)}</span>` : ''}
                          </div>
                        ` : ''}

                        ${h.description ? `
                          <div style="font-size: 0.8rem; color: #334155; margin-top: 0.45rem; line-height: 1.5; background: #f8fafc; padding: 0.5rem 0.75rem; border-radius: 0.4rem; border: 1px solid #e2e8f0;">
                            <b style="color: #1e40af;">وصف الواجب:</b> <span style="white-space: pre-wrap;">${escapeHtml(h.description)}</span>
                          </div>
                        ` : ''}

                        ${h.due_date ? `
                          <div style="font-size: 0.775rem; color: #64748b; margin-top: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
                            ${getIcon('clock', 13, '#64748b')}
                            <span>آخر موعد للتسليم: <b>${escapeHtml(h.due_date)}</b></span>
                          </div>
                        ` : ''}

                        ${(h.url && h.url !== '#') ? `
                          <div style="margin-top: 0.4rem;">
                            <a href="${escapeHtml(h.url)}" target="_blank" rel="noopener noreferrer" style="font-size: 0.8rem; color: #2563eb; font-weight: 700; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;">
                              ${getIcon('file', 13, '#2563eb')}
                              <span>معاينة ملف الواجب المرفق (PDF / الرابط)</span>
                            </a>
                          </div>
                        ` : ''}
                      </div>

                      <!-- Big Status Badge for Parent -->
                      <div>
                        ${isApproved ? `
                          <span style="display: inline-flex; align-items: center; gap: 0.4rem; color: #15803d; background: #f0fdf4; border: 1px solid #86efac; padding: 0.4rem 0.85rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem;">
                            ${getIcon('check', 14, '#15803d')}
                            <span>تم التسليم والاعتماد</span>
                          </span>
                        ` : (isPending ? `
                          <span style="display: inline-flex; align-items: center; gap: 0.4rem; color: #b45309; background: #fffbeb; border: 1px solid #fde68a; padding: 0.4rem 0.85rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem;">
                            ${getIcon('clock', 14, '#b45309')}
                            <span>تم التسليم • قيد التصحيح</span>
                          </span>
                        ` : (isRejected ? `
                          <span style="display: inline-flex; align-items: center; gap: 0.4rem; color: #b91c1c; background: #fef2f2; border: 1px solid #fca5a5; padding: 0.4rem 0.85rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem;">
                            ${getIcon('alertTriangle', 14, '#b91c1c')}
                            <span>يحتاج إعادة حل وتصحيح</span>
                          </span>
                        ` : `
                          <span style="display: inline-flex; align-items: center; gap: 0.4rem; color: #dc2626; background: #fff1f2; border: 1px solid #fecdd3; padding: 0.4rem 0.85rem; border-radius: 0.5rem; font-weight: 800; font-size: 0.85rem;">
                            ${getIcon('close', 14, '#dc2626')}
                            <span>لم يتم تسليم الواجب بعد</span>
                          </span>
                        `))}
                      </div>
                    </div>

                    ${h.teacher_feedback ? `
                      <div style="font-size: 0.825rem; background: #fff7ed; border-right: 3px solid #ea580c; padding: 0.5rem 0.75rem; border-radius: 0.35rem; color: #9a3412; margin-top: 0.2rem;">
                        <b>ملاحظة المعلم لولي الأمر:</b> ${escapeHtml(h.teacher_feedback)}
                      </div>
                    ` : ''}

                    <!-- Homework Submission Box with Direct Upload Trigger -->
                    <div style="background: #ffffff; border: 1px solid ${isRejected ? '#fca5a5' : '#e2e8f0'}; border-radius: 0.65rem; padding: 0.85rem; margin-top: 0.35rem;">
                      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
                        <div style="font-size: 0.825rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 0.35rem;">
                          ${getIcon('upload', 14, '#0f172a')}
                          <span>رفع حل الواجب:</span>
                        </div>

                        <div>
                          <input type="file" id="hw-file-input-${escapeHtml(h.id)}" accept="application/pdf,image/*,.pdf,.jpg,.jpeg,.png,.webp,.heic" style="display: none;" 
                            onchange="window.centrlyApp && window.centrlyApp.handleStudentHomeworkUpload ? window.centrlyApp.handleStudentHomeworkUpload('${escapeHtml(h.id)}', this.files[0]) : null">
                          
                          <button type="button" onclick="document.getElementById('hw-file-input-${escapeHtml(h.id)}').click()" id="hw-upload-btn-${escapeHtml(h.id)}"
                            style="background: ${isApproved ? '#15803d' : (isRejected ? '#dc2626' : '#2563eb')}; color: #ffffff; border: none; padding: 0.45rem 0.95rem; border-radius: 0.5rem; font-size: 0.825rem; font-weight: 800; cursor: pointer; display: inline-flex; align-items: center; gap: 0.35rem; transition: all 0.2s; box-shadow: 0 2px 6px ${isApproved ? 'rgba(21,128,61,0.25)' : (isRejected ? 'rgba(220,38,38,0.25)' : 'rgba(37,99,235,0.25)')};">
                            ${getIcon('upload', 14, '#ffffff')}
                            <span>${isApproved ? 'رفع نسخة أخرى (اختياري)' : (isRejected ? 'إعادة رفع حل الواجب' : (isPending ? 'تعديل / رفع نسخة أحدث' : 'رفع حل الواجب (PDF أو صورة)'))}</span>
                          </button>
                        </div>
                      </div>

                      ${h.submission_url ? `
                        <div style="margin-top: 0.5rem; border-top: 1px solid #f1f5f9; padding-top: 0.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.4rem;">
                          <a href="${escapeHtml(h.submission_url)}" target="_blank" rel="noopener noreferrer"
                            style="font-size: 0.8rem; color: #2563eb; font-weight: 700; text-decoration: underline; display: inline-flex; align-items: center; gap: 0.25rem;">
                            ${getIcon('file', 14, '#2563eb')}
                            <span>معاينة الملف الذي تم رفعه (${escapeHtml(h.submitted_at ? h.submitted_at.slice(0, 10) : 'مرفوع')})</span>
                          </a>
                        </div>
                      ` : `
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem;">
                          ارفع كشكول أو ورقة إجابة الطالب كملف PDF أو صورة واضحة (الحد الأقصى 25MB)
                        </div>
                      `}
                    </div>
                  </div>
                `;
              }).join('') : `
                <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('homework', 36, '#94a3b8')}</div>
                  لا توجد واجبات مطلوبة مسجلة لهذه المجموعة حتى الآن.
                </div>
              `}
            </div>
          </div>

          ${studyMaterials.length > 0 ? `
            <!-- Study Materials & PDF Booklets Section for Parents -->
            <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem; flex-wrap: wrap; gap: 0.5rem;">
                <div>
                  <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.5rem;">
                    ${getIcon('materials', 18, '#8b5cf6')}
                    <span>المذكرات وملازم الشرح المتاحة (${studyMaterials.length})</span>
                  </h2>
                  <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                    تحميل المذكرات والشروحات وملفات الـ PDF لمتابعة الطالب
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
        </div>

        <!-- Portal Security & Integrity Note -->
        <div style="text-align: center; padding: 1rem 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.6; display: flex; flex-direction: column; align-items: center; gap: 0.25rem;">
          <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
            ${getIcon('lock', 13, '#94a3b8')}
            <span>رابط مشفر وخاص بولي الأمر فقط • تتحدث البيانات تلقائياً مع كل كويز أو حصة</span>
          </div>
          <div>مدعوم بواسطة <b>منظومة سنترلي (Centrly)</b></div>
        </div>

      </div>
    </div>
  `;
}

// Global helper for switching tabs
if (typeof window !== 'undefined') {
  window.switchParentPortalTab = function(tabName) {
    const target = (tabName === 'materials') ? 'homework' : tabName;
    const tabs = ['attendance', 'quizzes', 'homework'];
    tabs.forEach(t => {
      const content = document.getElementById('tab-content-' + t);
      const btn = document.getElementById('tab-btn-' + t);
      if (content) {
        content.style.display = (t === target) ? 'flex' : 'none';
      }
      if (btn) {
        btn.style.background = (t === target) ? '#ffffff' : 'transparent';
        btn.style.color = (t === target) ? '#1e3a8a' : '#64748b';
        btn.style.boxShadow = (t === target) ? '0 2px 6px rgba(0,0,0,0.08)' : 'none';
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

