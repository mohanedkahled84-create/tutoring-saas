import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Homework Review & Grading Component (DEV-HOMEWORK)
 * Allows teachers to:
 * 1. Select active homework assignments & filter by group
 * 2. Track "مين سلّم" (Submitted) vs "مين لسه" (Missing)
 * 3. Preview student PDF submissions in 1 click
 * 4. One-click Approve (اعتماد الواجب) or Reject with notes
 * 5. Send one-click WhatsApp homework reminders to missing students
 */

export function renderHomeworkReviewView(homeworkState = {}) {
  const assignments = homeworkState.assignments || [];
  const currentHomework = homeworkState.currentHomework || assignments[0] || null;
  const groups = homeworkState.groups || [];
  const selectedGroupId = homeworkState.selectedGroupId || 'all';
  const activeTab = homeworkState.activeTab || 'submitted'; // 'submitted' or 'missing'
  const submitted = homeworkState.submitted || [];
  const missing = homeworkState.missing || [];

  const totalEligible = submitted.length + missing.length;
  const submissionRate = totalEligible > 0 ? Math.round((submitted.length / totalEligible) * 100) : 0;
  const pendingSubmissions = submitted.filter(s => s.status !== 'approved');
  const approvedSubmissions = submitted.filter(s => s.status === 'approved');
  const subTab = homeworkState.subTab || (pendingSubmissions.length > 0 ? 'pending' : (approvedSubmissions.length > 0 ? 'approved' : 'pending'));
  const approvedCount = approvedSubmissions.length;
  const pendingCount = pendingSubmissions.length;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Header & Filter Bar -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('materials', 22, 'var(--centrly-blue-700)')}</span>
              <span>مراجعة وتصحيح الواجبات الدراسية (Homework Review)</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              متابعة تسليمات الطلاب للواجبات، مراجعة ملفات الـ PDF، واعتماد الواجبات بضغطة زر.
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem; flex-wrap: wrap;">
            <!-- New Homework Button -->
            <button type="button" class="btn btn-primary" 
              onclick="window.centrlyApp && window.centrlyApp.openAddHomeworkModal ? window.centrlyApp.openAddHomeworkModal() : null" 
              style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800; font-size: 0.85rem; padding: 0.45rem 0.95rem; box-shadow: 0 2px 6px rgba(37,99,235,0.25);">
              ${getIcon('plus', 16, '#ffffff')}
              <span>نشر واجب جديد (من كتاب أو ملف)</span>
            </button>

            <!-- Refresh Submissions Button -->
            <button type="button" class="btn btn-secondary" 
              onclick="window.centrlyApp && window.centrlyApp.refreshHomeworkReview ? window.centrlyApp.refreshHomeworkReview() : null" 
              style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; font-size: 0.85rem; padding: 0.45rem 0.85rem;">
              ${getIcon('refresh', 14)}
              <span>تحديث التسليمات</span>
            </button>

            <!-- Assignment Selector Dropdown -->
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <label style="font-size: 0.825rem; font-weight: 700; color: #475569;">الواجب النشط:</label>
              <select class="form-control" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; border-radius: 0.5rem; min-width: 190px; font-weight: 700;"
                onchange="window.centrlyApp && window.centrlyApp.onSelectHomeworkAssignment ? window.centrlyApp.onSelectHomeworkAssignment(this.value) : null">
                ${assignments.length > 0 ? assignments.map(a => `
                  <option value="${a.id}" ${currentHomework && currentHomework.id === a.id ? 'selected' : ''}>
                    ${escapeHtml(a.title)} ${a.due_date ? `(موعد: ${escapeHtml(a.due_date)})` : ''}
                  </option>
                `).join('') : '<option value="">لا توجد واجبات منشورة بعد</option>'}
              </select>
            </div>

            <!-- Group Selector Dropdown -->
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <label style="font-size: 0.825rem; font-weight: 700; color: #475569;">المجموعة:</label>
              <select class="form-control" style="padding: 0.4rem 0.75rem; font-size: 0.85rem; border-radius: 0.5rem; min-width: 140px;"
                onchange="window.centrlyApp && window.centrlyApp.filterHomeworkSubmissionsByGroup ? window.centrlyApp.filterHomeworkSubmissionsByGroup(this.value) : null">
                <option value="all" ${selectedGroupId === 'all' ? 'selected' : ''}>جميع المجموعات</option>
                ${groups.map(g => `
                  <option value="${g.id}" ${selectedGroupId === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>
                `).join('')}
              </select>
            </div>
          </div>
        </div>
      </div>

      ${!currentHomework ? `
        <!-- No Assignments Empty State -->
        <div class="card" style="margin: 0; text-align: center; padding: 3rem 1.5rem;">
          <div style="display: flex; justify-content: center; margin-bottom: 0.75rem;">${getIcon('homework', 48, '#94a3b8')}</div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">لا توجد واجبات منزلية منشورة حتى الآن</h3>
          <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 1.5rem 0;">
            يمكنك نشر وتكليف واجب منزلي جديد وكتابة وصف المطلوب حله وموعد التسليم للطلاب بسهولة.
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddHomeworkModal()" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800;">
              ${getIcon('plus', 16, '#ffffff')}
              <span>نشر واجب منزلي جديد الآن</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.navigate('materials')" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('materials', 16, 'currentColor')}
              <span>الانتقال إلى المذكرات</span>
            </button>
          </div>
        </div>
      ` : `
        <!-- KPI Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #10b981;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
                  ${getIcon('check', 14, '#059669')}
                  <span>الطلاب المسلّمون للواجب</span>
                </div>
                <div style="font-size: 1.8rem; font-weight: 900; color: #059669; margin-top: 0.35rem;">
                  ${submitted.length} <span style="font-size: 0.85rem; font-weight: 600; color: #64748b;">طالب</span>
                </div>
              </div>
              <span class="badge badge-success" style="font-size: 0.8rem; font-weight: 800;">${approvedCount} معتمد</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.4rem;">
              ${pendingCount > 0 ? `<b style="color: #d97706;">${pendingCount} بانتظار المراجعة</b>` : 'تمت مراجعة جميع التسليمات'}
            </div>
          </div>

          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #ef4444;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
                  ${getIcon('clock', 14, '#dc2626')}
                  <span>الطلاب المتأخرون عن التسليم</span>
                </div>
                <div style="font-size: 1.8rem; font-weight: 900; color: #dc2626; margin-top: 0.35rem;">
                  ${missing.length} <span style="font-size: 0.85rem; font-weight: 600; color: #64748b;">طالب</span>
                </div>
              </div>
              <span class="badge badge-danger" style="font-size: 0.8rem; font-weight: 800;">متأخر</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.4rem;">
              متاح تذكيرهم برسالة واتساب بضغطة زر
            </div>
          </div>

          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
            <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نسبة الالتزام بالتسليم</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-blue-700); margin-top: 0.35rem;">
              ${submissionRate}%
            </div>
            <!-- Visual Progress Bar -->
            <div style="width: 100%; height: 6px; background: #e2e8f0; border-radius: 9999px; overflow: hidden; margin-top: 0.4rem;">
              <div style="width: ${submissionRate}%; height: 100%; background: #2563eb; border-radius: 9999px;"></div>
            </div>
          </div>

        </div>

        <!-- Active Homework Details Card -->
        <div class="card" style="margin: 0; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1.1rem; border-radius: 0.85rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 0.85rem;">
            <div style="flex: 1; min-width: 250px;">
              <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 0.35rem;">
                <span style="font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.6rem; border-radius: 0.4rem; background: #eff6ff; color: #1d4ed8; border: 1px solid #bfdbfe; display: inline-flex; align-items: center; gap: 0.3rem;">
                  ${currentHomework.book_name ? `${getIcon('book', 14, '#1d4ed8')} واجب من الكتاب` : (currentHomework.url && currentHomework.url !== '#' ? `${getIcon('file', 14, '#1d4ed8')} ملف / مذكرة PDF` : `${getIcon('edit', 14, '#1d4ed8')} واجب كتابي`)}
                </span>
                <h3 style="font-size: 1.05rem; font-weight: 800; color: #0f172a; margin: 0;">
                  ${escapeHtml(currentHomework.title)}
                </h3>
                ${currentHomework.due_date ? `
                  <span style="font-size: 0.75rem; color: #b45309; background: #fffbeb; padding: 0.2rem 0.55rem; border-radius: 0.35rem; border: 1px solid #fde68a; font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem;">
                    ${getIcon('clock', 13, '#b45309')}
                    <span>آخر موعد: ${escapeHtml(currentHomework.due_date)}</span>
                  </span>
                ` : ''}
              </div>

              ${(currentHomework.book_name || currentHomework.pages || currentHomework.questions) ? `
                <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; font-size: 0.825rem; color: #1e3a8a; margin-top: 0.5rem; background: #eff6ff; padding: 0.45rem 0.85rem; border-radius: 0.45rem; border: 1px solid #bfdbfe;">
                  ${currentHomework.book_name ? `<span style="display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('book', 14, '#1e3a8a')} <b>الكتاب:</b> ${escapeHtml(currentHomework.book_name)}</span>` : ''}
                  ${currentHomework.pages ? `<span style="display: inline-flex; align-items: center; gap: 0.3rem;">• ${getIcon('file', 14, '#1e3a8a')} <b>الصفحات:</b> ${escapeHtml(currentHomework.pages)}</span>` : ''}
                  ${currentHomework.questions ? `<span style="display: inline-flex; align-items: center; gap: 0.3rem;">• <b>الأسئلة:</b> <b style="color: #b45309;">${escapeHtml(currentHomework.questions)}</b></span>` : ''}
                </div>
              ` : ''}

              ${currentHomework.description ? `
                <div style="font-size: 0.85rem; color: #1e293b; margin-top: 0.5rem; line-height: 1.6; background: #f8fafc; padding: 0.65rem 0.85rem; border-radius: 0.5rem; border: 1px solid #e2e8f0; border-right: 3px solid var(--centrly-blue-700);">
                  <div style="font-weight: 800; color: var(--centrly-blue-800); font-size: 0.825rem; margin-bottom: 0.25rem;">وصف الواجب والمطلوب حله:</div>
                  <div style="white-space: pre-wrap; color: #334155;">${escapeHtml(currentHomework.description)}</div>
                </div>
              ` : ''}
            </div>

            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              ${currentHomework.url && currentHomework.url !== '#' ? `
                <a href="${escapeHtml(currentHomework.url)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" 
                  style="font-size: 0.8rem; padding: 0.4rem 0.8rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                  ${getIcon('file', 14, 'currentColor')}
                  <span>معاينة الملف</span>
                </a>
              ` : ''}
              <button type="button" class="btn btn-secondary" 
                style="font-size: 0.8rem; padding: 0.4rem 0.85rem; display: inline-flex; align-items: center; gap: 0.35rem; background: #ecfdf5; color: #047857; border-color: #a7f3d0; font-weight: 800;"
                onclick="window.centrlyApp && window.centrlyApp.copyHomeworkAssignmentText ? window.centrlyApp.copyHomeworkAssignmentText('${escapeHtml(currentHomework.id)}') : null">
                ${getIcon('copy', 14, '#047857')}
                <span>نسخ نص الواجب للواتساب</span>
              </button>
            </div>
          </div>
        </div>

        <!-- 2-Tab Navigation (Submitted vs Missing) -->
        <div class="card" style="margin: 0; padding: 0.5rem; background: #fff;">
          <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">
            <button type="button" class="btn ${activeTab === 'submitted' ? 'btn-primary' : 'btn-secondary'}" 
              onclick="window.centrlyApp && window.centrlyApp.switchHomeworkTab ? window.centrlyApp.switchHomeworkTab('submitted') : null"
              style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800; padding: 0.5rem 1.25rem;">
              ${getIcon('check', 16, activeTab === 'submitted' ? '#ffffff' : '#059669')}
              <span>الطلاب المسلّمون (${submitted.length})</span>
            </button>

            <button type="button" class="btn ${activeTab === 'missing' ? 'btn-primary' : 'btn-secondary'}" 
              onclick="window.centrlyApp && window.centrlyApp.switchHomeworkTab ? window.centrlyApp.switchHomeworkTab('missing') : null"
              style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800; padding: 0.5rem 1.25rem;">
              ${getIcon('clock', 16, activeTab === 'missing' ? '#ffffff' : '#dc2626')}
              <span>الطلاب المتأخرون (${missing.length})</span>
            </button>
          </div>
        </div>

        <!-- ================= TAB 1: SUBMITTED STUDENTS (مين سلّم) ================= -->
        ${activeTab === 'submitted' ? `
          <div class="card" style="margin: 0;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
              <div>
                <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
                  ${getIcon('inbox', 18, 'var(--centrly-blue-700)')}
                  <span>تسليمات الطلاب للواجب (${submitted.length})</span>
                </h3>
                <p style="font-size: 0.78rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  فحص حلول الطلاب واعتمادها أو طلب إعادتها بسهولة بضغطة زر، مع رصد مباشر لحالة كل طالب.
                </p>
              </div>

              <!-- Sub-tab Filter Pill Buttons -->
              <div style="display: inline-flex; background: #f1f5f9; padding: 3px; border-radius: 0.6rem; gap: 3px;">
                <button type="button" class="btn btn-sm ${subTab === 'pending' ? 'btn-primary' : 'btn-secondary'}"
                  onclick="window.centrlyApp && window.centrlyApp.switchHomeworkSubTab ? window.centrlyApp.switchHomeworkSubTab('pending') : null"
                  style="border: none; border-radius: 0.45rem; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem; ${subTab === 'pending' ? 'box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : 'background: transparent; color: #475569;'}">
                  ${getIcon('clock', 13, subTab === 'pending' ? '#ffffff' : '#d97706')}
                  <span>بانتظار الاعتماد (${pendingSubmissions.length})</span>
                </button>

                <button type="button" class="btn btn-sm ${subTab === 'approved' ? 'btn-primary' : 'btn-secondary'}"
                  onclick="window.centrlyApp && window.centrlyApp.switchHomeworkSubTab ? window.centrlyApp.switchHomeworkSubTab('approved') : null"
                  style="border: none; border-radius: 0.45rem; font-weight: 800; font-size: 0.8rem; padding: 0.35rem 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem; ${subTab === 'approved' ? 'box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : 'background: transparent; color: #475569;'}">
                  ${getIcon('check', 13, subTab === 'approved' ? '#ffffff' : '#059669')}
                  <span>سجل المعتمدين (${approvedSubmissions.length})</span>
                </button>

                <button type="button" class="btn btn-sm ${subTab === 'all' ? 'btn-primary' : 'btn-secondary'}"
                  onclick="window.centrlyApp && window.centrlyApp.switchHomeworkSubTab ? window.centrlyApp.switchHomeworkSubTab('all') : null"
                  style="border: none; border-radius: 0.45rem; font-weight: 700; font-size: 0.8rem; padding: 0.35rem 0.75rem; display: inline-flex; align-items: center; gap: 0.35rem; ${subTab === 'all' ? 'box-shadow: 0 1px 3px rgba(0,0,0,0.1);' : 'background: transparent; color: #475569;'}">
                  <span>الكل (${submitted.length})</span>
                </button>
              </div>
            </div>

            <!-- ================= SUB-TAB 1: PENDING REVIEW ================= -->
            ${subTab === 'pending' ? `
              ${pendingSubmissions.length === 0 ? `
                <div style="text-align: center; padding: 3rem 1rem; color: #64748b; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1; margin-top: 1rem;">
                  <div style="display: flex; justify-content: center; margin-bottom: 0.75rem;">${getIcon('check', 42, '#10b981')}</div>
                  <h4 style="font-size: 1.1rem; font-weight: 800; color: #0f172a; margin: 0 0 0.35rem 0;">رائع! تمت مراجعة واعتماد جميع الواجبات</h4>
                  <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 1.25rem 0;">لا توجد أي تسليمات معلقة تنتظر الفحص حالياً.</p>
                  ${approvedSubmissions.length > 0 ? `
                    <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp && window.centrlyApp.switchHomeworkSubTab ? window.centrlyApp.switchHomeworkSubTab('approved') : null" style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;">
                      ${getIcon('check', 14, '#059669')}
                      <span>عرض سجل الواجبات المعتمدة (${approvedSubmissions.length} طالب)</span>
                    </button>
                  ` : ''}
                </div>
              ` : `
                <div style="overflow-x: auto; margin-top: 0.75rem;">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th>كود الطالب</th>
                        <th>اسم الطالب</th>
                        <th>تاريخ ووقت التسليم</th>
                        <th>ملف الواجب (PDF)</th>
                        <th>حالة المراجعة</th>
                        <th>ملاحظات المعلم</th>
                        <th style="text-align: center;">الإجراءات والاعتماد</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${pendingSubmissions.map(sub => {
                        const isRejected = sub.status === 'rejected';
                        const statusBadge = isRejected 
                          ? '<span class="badge badge-danger" style="font-weight: 800;">يحتاج إعادة</span>'
                          : '<span class="badge badge-warning" style="font-weight: 800;">بانتظار الاعتماد</span>';

                        const formattedDate = sub.submitted_at 
                          ? new Date(sub.submitted_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) 
                          : '—';

                        return `
                          <tr>
                            <td style="font-family: monospace; font-weight: 700;">${escapeHtml(sub.student_code)}</td>
                            <td style="font-weight: 800; color: #0f172a;">${escapeHtml(sub.student_name)}</td>
                            <td style="font-size: 0.8rem; color: #64748b; font-family: monospace;">${escapeHtml(formattedDate)}</td>
                            <td>
                              ${sub.file_url ? `
                                <a href="${escapeHtml(sub.file_url)}" target="_blank" rel="noopener noreferrer"
                                  style="display: inline-flex; align-items: center; gap: 0.35rem; background: #eff6ff; color: #1d4ed8; padding: 0.25rem 0.65rem; border-radius: 0.4rem; border: 1px solid #bfdbfe; font-size: 0.8rem; font-weight: 700; text-decoration: none;">
                                  ${getIcon('file', 14, '#1d4ed8')}
                                  <span>معاينة ملف الواجب</span>
                                </a>
                              ` : `
                                <span style="font-size: 0.78rem; color: #94a3b8;">لا يوجد ملف مرفق</span>
                              `}
                            </td>
                            <td>${statusBadge}</td>
                            <td style="font-size: 0.8rem; color: #475569; max-width: 200px;">
                              ${sub.teacher_notes ? escapeHtml(sub.teacher_notes) : '<span style="color: #94a3b8;">—</span>'}
                            </td>
                            <td style="text-align: center;">
                              <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                                <!-- Approve Button (Solid Vibrant Green with active click feedback) -->
                                <button type="button" class="btn btn-sm btn-success" 
                                  onclick="window.centrlyApp && window.centrlyApp.approveHomeworkSubmission ? window.centrlyApp.approveHomeworkSubmission('${escapeHtml(sub.id)}') : null"
                                  title="اعتماد الواجب"
                                  style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; padding: 0.35rem 0.75rem; font-size: 0.825rem; background: #16a34a !important; color: #ffffff !important; border: 1px solid #15803d !important; border-radius: 0.5rem; cursor: pointer; box-shadow: 0 2px 5px rgba(22, 163, 74, 0.3);">
                                  ${getIcon('check', 15, '#ffffff')}
                                  <span>موافق / اعتماد</span>
                                </button>

                                <!-- Request Redo / Revision Button (Distinct Amber/Orange with active click feedback) -->
                                <button type="button" class="btn btn-sm btn-warning" 
                                  onclick="window.centrlyApp && window.centrlyApp.promptRejectHomework ? window.centrlyApp.promptRejectHomework('${escapeHtml(sub.id)}', '${escapeHtml(sub.student_name)}') : null"
                                  title="طلب إعادة حل الواجب من الطالب"
                                  style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; padding: 0.35rem 0.75rem; font-size: 0.825rem; background: #fff7ed !important; color: #c2410c !important; border: 1px solid #fdba74 !important; border-radius: 0.5rem; cursor: pointer;">
                                  ${getIcon('refresh', 14, '#c2410c')}
                                  <span>طلب إعادة الواجب</span>
                                </button>
                              </div>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            ` : ''}

            <!-- ================= SUB-TAB 2: APPROVED ARCHIVE (سجل المعتمدين) ================= -->
            ${subTab === 'approved' ? `
              ${approvedSubmissions.length === 0 ? `
                <div style="text-align: center; padding: 2.5rem 1rem; color: #64748b; background: #f8fafc; border-radius: 0.75rem; border: 1px dashed #cbd5e1; margin-top: 1rem;">
                  <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('inbox', 36, '#94a3b8')}</div>
                  لم يتم اعتماد أي واجب بعد لهذا التكليف.<br>
                  ستظهر هنا أسماء الطلاب فور اعتماد تسليماتهم بنجاح.
                </div>
              ` : `
                <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 0.6rem; padding: 0.6rem 0.85rem; margin-top: 0.75rem; margin-bottom: 0.75rem; font-size: 0.825rem; color: #166534; display: flex; align-items: center; gap: 0.45rem;">
                  ${getIcon('check', 16, '#166534')}
                  <span>سجل بأسماء الطلاب الذين تم اعتماد واجباتهم بنجاح. يمكنك الضغط على "طلب إعادة" إذا رغبت في إعادة تكليف الطالب بحل الواجب مجدداً.</span>
                </div>
                <div style="overflow-x: auto;">
                  <table class="data-table">
                    <thead>
                      <tr>
                        <th style="width: 40px; text-align: center;">#</th>
                        <th>كود الطالب</th>
                        <th>اسم الطالب</th>
                        <th>تاريخ ووقت التسليم</th>
                        <th>تاريخ الاعتماد</th>
                        <th>حالة الواجب</th>
                        <th>ملاحظات المعلم</th>
                        <th style="text-align: center;">الإجراء</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${approvedSubmissions.map((sub, idx) => {
                        const formattedDate = sub.submitted_at 
                          ? new Date(sub.submitted_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) 
                          : '—';
                        const reviewedDate = sub.reviewed_at 
                          ? new Date(sub.reviewed_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) 
                          : '—';
                        return `
                          <tr>
                            <td style="text-align: center; color: #94a3b8; font-weight: 700; font-size: 0.8rem;">${idx + 1}</td>
                            <td style="font-family: monospace; font-weight: 700; color: #1e293b;">${escapeHtml(sub.student_code)}</td>
                            <td style="font-weight: 800; color: #0f172a; font-size: 0.95rem;">${escapeHtml(sub.student_name)}</td>
                            <td style="font-size: 0.8rem; color: #64748b; font-family: monospace;">${escapeHtml(formattedDate)}</td>
                            <td style="font-size: 0.8rem; color: #059669; font-family: monospace; font-weight: 700;">${escapeHtml(reviewedDate)}</td>
                            <td>
                              <span class="badge badge-success" style="font-weight: 800; font-size: 0.78rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                                ${getIcon('check', 13, '#ffffff')}
                                <span>معتمد بنجاح ★</span>
                              </span>
                            </td>
                            <td style="font-size: 0.8rem; color: #475569; max-width: 220px;">
                              ${sub.teacher_notes ? escapeHtml(sub.teacher_notes) : '<span style="color: #94a3b8;">—</span>'}
                            </td>
                            <td style="text-align: center;">
                              <button type="button" class="btn btn-sm btn-warning" 
                                onclick="window.centrlyApp && window.centrlyApp.promptRejectHomework ? window.centrlyApp.promptRejectHomework('${escapeHtml(sub.id)}', '${escapeHtml(sub.student_name)}') : null"
                                title="طلب إعادة حل الواجب من الطالب"
                                style="display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 800; padding: 0.25rem 0.6rem; font-size: 0.75rem; background: #fff7ed !important; color: #c2410c !important; border: 1px solid #fdba74 !important; border-radius: 0.45rem; cursor: pointer;">
                                ${getIcon('refresh', 13, '#c2410c')}
                                <span>طلب إعادة</span>
                              </button>
                            </td>
                          </tr>
                        `;
                      }).join('')}
                    </tbody>
                  </table>
                </div>
              `}
            ` : ''}

            <!-- ================= SUB-TAB 3: ALL SUBMISSIONS ================= -->
            ${subTab === 'all' ? `
              <div style="overflow-x: auto; margin-top: 0.75rem;">
                <table class="data-table">
                  <thead>
                    <tr>
                      <th>كود الطالب</th>
                      <th>اسم الطالب</th>
                      <th>تاريخ ووقت التسليم</th>
                      <th>ملف الواجب</th>
                      <th>حالة المراجعة</th>
                      <th>ملاحظات المعلم</th>
                      <th style="text-align: center;">الإجراء</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${submitted.length > 0 ? submitted.map(sub => {
                      const isApproved = sub.status === 'approved';
                      const isPending = sub.status === 'pending';

                      const statusBadge = isApproved 
                        ? '<span class="badge badge-success" style="font-weight: 800;">معتمد</span>' 
                        : (isPending 
                          ? '<span class="badge badge-warning" style="font-weight: 800;">بانتظار الاعتماد</span>' 
                          : '<span class="badge badge-danger" style="font-weight: 800;">يحتاج إعادة</span>');

                      const formattedDate = sub.submitted_at 
                        ? new Date(sub.submitted_at).toLocaleString('ar-EG', { dateStyle: 'short', timeStyle: 'short' }) 
                        : '—';

                      return `
                        <tr>
                          <td style="font-family: monospace; font-weight: 700;">${escapeHtml(sub.student_code)}</td>
                          <td style="font-weight: 800; color: #0f172a;">${escapeHtml(sub.student_name)}</td>
                          <td style="font-size: 0.8rem; color: #64748b; font-family: monospace;">${escapeHtml(formattedDate)}</td>
                          <td>
                            ${sub.file_url ? `
                              <a href="${escapeHtml(sub.file_url)}" target="_blank" rel="noopener noreferrer"
                                style="display: inline-flex; align-items: center; gap: 0.35rem; background: #eff6ff; color: #1d4ed8; padding: 0.25rem 0.65rem; border-radius: 0.4rem; border: 1px solid #bfdbfe; font-size: 0.8rem; font-weight: 700; text-decoration: none;">
                                ${getIcon('file', 14, '#1d4ed8')}
                                <span>معاينة الملف</span>
                              </a>
                            ` : (isApproved ? `
                              <span style="font-size: 0.78rem; color: #059669; font-weight: 700;">تم الاعتماد</span>
                            ` : '<span style="font-size: 0.78rem; color: #94a3b8;">—</span>')}
                          </td>
                          <td>${statusBadge}</td>
                          <td style="font-size: 0.8rem; color: #475569; max-width: 200px;">
                            ${sub.teacher_notes ? escapeHtml(sub.teacher_notes) : '<span style="color: #94a3b8;">—</span>'}
                          </td>
                          <td style="text-align: center;">
                            <div style="display: inline-flex; align-items: center; gap: 0.35rem;">
                              ${isApproved ? `
                                <button type="button" class="btn btn-sm btn-warning" 
                                  onclick="window.centrlyApp && window.centrlyApp.promptRejectHomework ? window.centrlyApp.promptRejectHomework('${escapeHtml(sub.id)}', '${escapeHtml(sub.student_name)}') : null"
                                  style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 700; padding: 0.25rem 0.55rem; font-size: 0.75rem; background: #fff7ed !important; color: #c2410c !important; border: 1px solid #fdba74 !important; border-radius: 0.45rem;">
                                  ${getIcon('refresh', 12, '#c2410c')}
                                  <span>طلب إعادة</span>
                                </button>
                              ` : `
                                <button type="button" class="btn btn-sm btn-success" 
                                  onclick="window.centrlyApp && window.centrlyApp.approveHomeworkSubmission ? window.centrlyApp.approveHomeworkSubmission('${escapeHtml(sub.id)}') : null"
                                  style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 800; padding: 0.25rem 0.65rem; background: #16a34a !important; color: #ffffff !important; border: 1px solid #15803d !important; border-radius: 0.45rem;">
                                  ${getIcon('check', 13, '#ffffff')}
                                  <span>اعتماد</span>
                                </button>
                                <button type="button" class="btn btn-sm btn-warning" 
                                  onclick="window.centrlyApp && window.centrlyApp.promptRejectHomework ? window.centrlyApp.promptRejectHomework('${escapeHtml(sub.id)}', '${escapeHtml(sub.student_name)}') : null"
                                  style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 700; padding: 0.25rem 0.6rem; font-size: 0.78rem; background: #fff7ed !important; color: #c2410c !important; border: 1px solid #fdba74 !important; border-radius: 0.45rem;">
                                  ${getIcon('refresh', 12, '#c2410c')}
                                  <span>طلب إعادة</span>
                                </button>
                              `}
                            </div>
                          </td>
                        </tr>
                      `;
                    }).join('') : `
                      <tr>
                        <td colspan="7" style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
                          لم يقم أي طالب بتسليم هذا الواجب بعد.
                        </td>
                      </tr>
                    `}
                  </tbody>
                </table>
              </div>
            ` : ''}

          </div>
        ` : `
          <!-- ================= TAB 2: MISSING STUDENTS (مين لسه) ================= -->
          <div class="card" style="margin: 0;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
                  ${getIcon('clock', 18, '#dc2626')}
                  <span>قائمة الطلاب الذين لم يقوموا برفع الواجب بعد (${missing.length})</span>
                </h3>
                <p style="font-size: 0.775rem; color: #64748b; margin: 0.2rem 0 0 0;">
                  يمكنك إرسال رسالة تذكير مباشرة بضغطة زر لكل طالب أو ولي أمره
                </p>
              </div>

              ${missing.length > 0 ? `
                <button type="button" class="btn btn-secondary btn-sm" 
                  onclick="window.centrlyApp && window.centrlyApp.copyAllMissingStudentsPhones ? window.centrlyApp.copyAllMissingStudentsPhones() : null"
                  style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
                  ${getIcon('copy', 14, 'currentColor')}
                  <span>نسخ أرقام جميع المتأخرين</span>
                </button>
              ` : ''}
            </div>

            <div style="overflow-x: auto; margin-top: 0.75rem;">
              <table class="data-table">
                <thead>
                  <tr>
                    <th>كود الطالب</th>
                    <th>اسم الطالب</th>
                    <th>المجموعة</th>
                    <th>رقم الهاتف</th>
                    <th>الحالة</th>
                    <th style="text-align: center;">إجراءات التذكير</th>
                  </tr>
                </thead>
                <tbody>
                  ${missing.length > 0 ? missing.map(m => {
                    const grp = groups.find(g => g.id === m.group_id);
                    const groupName = grp ? grp.name : '—';
                    const studentPhone = m.phone || '';

                    return `
                      <tr>
                        <td style="font-family: monospace; font-weight: 700;">${escapeHtml(m.code)}</td>
                        <td style="font-weight: 800; color: #0f172a;">${escapeHtml(m.name)}</td>
                        <td>
                          <span class="badge badge-secondary">${escapeHtml(groupName)}</span>
                        </td>
                        <td style="font-family: monospace; font-size: 0.85rem; color: #475569;" dir="ltr">
                          ${escapeHtml(studentPhone || '—')}
                        </td>
                        <td>
                          <span class="badge badge-danger" style="font-weight: 700;">لم يُسلّم</span>
                        </td>
                        <td style="text-align: center;">
                          <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                            <!-- Direct WhatsApp Reminder Button -->
                            <button type="button" class="btn btn-sm btn-secondary" 
                              onclick="window.centrlyApp && window.centrlyApp.sendHomeworkReminderWhatsApp ? window.centrlyApp.sendHomeworkReminderWhatsApp('${escapeHtml(m.id)}', '${escapeHtml(m.name)}', '${escapeHtml(studentPhone)}') : null"
                              title="إرسال تذكير عبر واتساب"
                              style="display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 700; color: #059669; border-color: #a7f3d0; padding: 0.25rem 0.65rem;">
                              ${getIcon('whatsapp', 14, '#059669')}
                              <span>تذكير واتساب</span>
                            </button>

                            <!-- Copy Student Link Button -->
                            <button type="button" class="btn btn-sm btn-secondary" 
                              onclick="window.centrlyApp && window.centrlyApp.copyStudentLink ? window.centrlyApp.copyStudentLink('${escapeHtml(m.id)}') : null"
                              title="نسخ رابط الطالب لإرساله له"
                              style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                              ${getIcon('link', 13, 'currentColor')}
                              <span>رابط الطالب</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr>
                      <td colspan="6" style="text-align: center; padding: 2.5rem 1rem; color: #059669; font-weight: 700;">
                        <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('check', 36, '#059669')}</div>
                        رائع! جميع طلاب المجموعة قاموا بتسليم الواجب بنجاح بنسبة 100%.
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        `}
      `}

    </div>
  `;
}
