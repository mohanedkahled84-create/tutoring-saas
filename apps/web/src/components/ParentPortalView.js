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
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🔒</div>
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
            <button onclick="window.centrlyApp && window.centrlyApp.reloadParentPortal ? window.centrlyApp.reloadParentPortal() : window.location.reload()" 
              style="background: #f1f5f9; border: 1px solid #cbd5e1; border-radius: 0.5rem; padding: 0.25rem 0.6rem; font-size: 0.75rem; font-weight: 700; color: #334155; cursor: pointer; display: inline-flex; align-items: center; gap: 0.3rem;">
              <span>🔄</span>
              <span>تحديث البيانات</span>
            </button>
          </div>

          <div class="brand-logo-badge" style="margin: 0 auto 0.5rem; width: 44px; height: 44px; font-size: 1.25rem;">سـ</div>
          <h1 style="font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0;">بوابة متابعة ولي الأمر | سنترلي</h1>
          
          <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.6rem; flex-wrap: wrap;">
            <span style="font-size: 1.2rem; font-weight: 900; color: #1d4ed8;">${escapeHtml(student.name)}</span>
            <span class="badge badge-secondary" style="font-family: monospace; font-size: 0.8rem;">كود: ${escapeHtml(student.student_code)}</span>
            ${student.group_name ? `<span class="badge badge-blue" style="font-size: 0.8rem;">${escapeHtml(student.group_name)}</span>` : ''}
          </div>
          
          <p style="font-size: 0.8rem; color: #64748b; margin: 0.4rem 0 0 0;">
            تقرير الحضور، درجات الكويزات، والواجبات والمذكرات الدراسية
          </p>
        </div>

        <!-- 3-Tab Navigation Bar -->
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); background: #e2e8f0; padding: 4px; border-radius: 0.85rem; gap: 4px;">
          <button type="button" onclick="window.switchParentPortalTab ? window.switchParentPortalTab('attendance') : null" id="tab-btn-attendance"
            style="padding: 0.7rem 0.5rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: ${activeTab === 'attendance' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'attendance' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'attendance' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            <span>📅</span>
            <span>الحضور والغياب</span>
          </button>
          
          <button type="button" onclick="window.switchParentPortalTab ? window.switchParentPortalTab('quizzes') : null" id="tab-btn-quizzes"
            style="padding: 0.7rem 0.5rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: ${activeTab === 'quizzes' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'quizzes' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'quizzes' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            <span>📊</span>
            <span>الكويزات (${quizzes.length})</span>
          </button>

          <button type="button" onclick="window.switchParentPortalTab ? window.switchParentPortalTab('materials') : null" id="tab-btn-materials"
            style="padding: 0.7rem 0.5rem; border: none; border-radius: 0.65rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.35rem; background: ${activeTab === 'materials' ? '#ffffff' : 'transparent'}; color: ${activeTab === 'materials' ? '#1e3a8a' : '#64748b'}; box-shadow: ${activeTab === 'materials' ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};">
            <span>📚</span>
            <span>المذكرات (${materials.length})</span>
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
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: gap: 0.4rem;">
                <span>📅</span>
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
                      ${s.attended ? 'حاضر ✅' : 'غائب ❌'}
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
              <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                <span>📝</span>
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

        <!-- ================= TAB 3: STUDY MATERIALS & HOMEWORK ================= -->
        <div id="tab-content-materials" style="display: ${activeTab === 'materials' ? 'flex' : 'none'}; flex-direction: column; gap: 1rem;">
          <div style="background: #fff; border-radius: 1rem; padding: 1.25rem; box-shadow: 0 2px 8px rgba(0,0,0,0.04); border: 1px solid #e2e8f0;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid #f1f5f9; padding-bottom: 0.75rem;">
              <div>
                <h2 style="font-size: 1rem; font-weight: 800; color: #0f172a; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                  <span>📚</span>
                  <span>المذكرات الدراسية والواجبات</span>
                </h2>
                <p style="font-size: 0.75rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  جميع المذكرات والشروحات الخاصة بمجموعة الطالب
                </p>
              </div>
              <span class="badge badge-blue" style="font-weight: 700;">${materials.length} ملف</span>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.85rem;">
              ${materials.length > 0 ? materials.map(m => {
                const isPdf = m.type === 'pdf';
                const isVideo = m.type === 'video';
                const typeIcon = isPdf ? '📄 PDF' : (isVideo ? '🎥 فيديو' : '🔗 رابط');
                const actionText = isPdf ? 'تحميل / فتح المذكرة' : (isVideo ? 'مشاهدة الفيديو' : 'فتح الرابط الخارجي');

                return `
                  <div style="padding: 1rem; border-radius: 0.75rem; background: #f8fafc; border: 1px solid #e2e8f0; display: flex; flex-direction: column; gap: 0.6rem;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <div style="flex: 1;">
                        <div style="display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.25rem;">
                          <span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 0.35rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe;">
                            ${typeIcon}
                          </span>
                          ${m.is_homework ? `
                            <span style="font-size: 0.72rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 0.35rem; background: #fef3c7; color: #b45309; border: 1px solid #fde68a;">
                              📝 واجب منزلي
                            </span>
                          ` : ''}
                        </div>
                        <h3 style="font-size: 0.95rem; font-weight: 800; color: #0f172a; margin: 0;">
                          ${escapeHtml(m.title)}
                        </h3>
                        ${m.description ? `
                          <p style="font-size: 0.8rem; color: #475569; margin: 0.35rem 0 0 0; line-height: 1.5;">
                            ${escapeHtml(m.description)}
                          </p>
                        ` : ''}
                      </div>
                    </div>

                    ${m.is_homework && m.due_date ? `
                      <div style="font-size: 0.75rem; color: #b45309; background: #fffbeb; padding: 0.4rem 0.65rem; border-radius: 0.4rem; border: 1px solid #fef3c7; display: flex; align-items: center; gap: 0.3rem;">
                        <span>⏰</span>
                        <span>آخر موعد للتسليم: <b>${escapeHtml(m.due_date)}</b></span>
                      </div>
                    ` : ''}

                    <div style="display: flex; justify-content: flex-end; margin-top: 0.25rem;">
                      <a href="${escapeHtml(m.url)}" target="_blank" rel="noopener noreferrer"
                        style="display: inline-flex; align-items: center; gap: 0.4rem; background: #1d4ed8; color: #ffffff; padding: 0.5rem 1rem; border-radius: 0.5rem; text-decoration: none; font-size: 0.825rem; font-weight: 700; box-shadow: 0 1px 3px rgba(29,78,216,0.2);">
                        <span>📥</span>
                        <span>${actionText}</span>
                      </a>
                    </div>
                  </div>
                `;
              }).join('') : `
                <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b; font-size: 0.85rem; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1;">
                  <div style="font-size: 2rem; margin-bottom: 0.5rem;">📚</div>
                  لم يتم إضافة مذكرات أو واجبات دراسية لهذه المجموعة بعد.<br>
                  ستظهر الملفات هنا فور إضافتها من قِبل المعلم مباشرة.
                </div>
              `}
            </div>
          </div>
        </div>

        <!-- Portal Security & Integrity Note -->
        <div style="text-align: center; padding: 1rem 0; font-size: 0.75rem; color: #94a3b8; line-height: 1.6;">
          🔒 رابط مشفر وخاص بولي الأمر فقط • تتحدث البيانات تلقائياً مع كل كويز أو حصة<br>
          مدعوم بواسطة <b>منظومة سنترلي (Centrly)</b>
        </div>

      </div>
    </div>
  `;
}

// Global helper for switching tabs
if (typeof window !== 'undefined') {
  window.switchParentPortalTab = function(tabName) {
    const tabs = ['attendance', 'quizzes', 'materials'];
    tabs.forEach(t => {
      const content = document.getElementById('tab-content-' + t);
      const btn = document.getElementById('tab-btn-' + t);
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

