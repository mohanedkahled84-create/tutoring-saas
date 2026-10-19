import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";

/**
 * Centrly Homework Review & Grading Component (DEV-HOMEWORK)
 * Allows teachers to:
 * 1. Select active homework assignments & filter by group
 * 2. Track "مين سلّم" (Submitted) vs "مين لسه" (Missing)
 * 3. Preview student PDF submissions in 1 click
 * 4. One-click Approve (اعتماد الواجب) or Reject with notes
 * 5. Send one-click WhatsApp homework reminders to missing students
 */

function resolveSafeMaterialUrl(rawUrl) {
  if (!rawUrl || typeof rawUrl !== 'string') return '';
  const trimmed = rawUrl.trim();
  if (trimmed.includes('/storage/v1/object/sign/homework-submissions/')) {
    return trimmed
      .replace('/storage/v1/object/sign/homework-submissions/', '/storage/v1/object/public/homework-submissions/')
      .split('?')[0];
  }
  return trimmed;
}

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

          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #ef4444; cursor: pointer; transition: transform 0.15s ease;" 
            onclick="window.centrlyApp && window.centrlyApp.switchHomeworkTab ? window.centrlyApp.switchHomeworkTab('missing') : null"
            title="اضغط للانتقال لقائمة الطلاب المتأخرين وتذكيرهم">
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
            <div style="font-size: 0.75rem; color: #dc2626; margin-top: 0.4rem; font-weight: 700; display: flex; align-items: center; gap: 0.3rem;">
              <span>اضغط لعرض المتأخرين وتذكيرهم</span>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"/></svg>
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
                <a href="${escapeHtml(resolveSafeMaterialUrl(currentHomework.url))}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary" 
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
                                <div style="display: flex; align-items: center; gap: 0.4rem;">
                                  ${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(sub.file_url) ? `
                                    <a href="${escapeHtml(sub.file_url)}" target="_blank" rel="noopener noreferrer" title="اضغط لتكبير صورة الواجب">
                                      <img src="${escapeHtml(sub.file_url)}" alt="صورة الواجب" style="width: 32px; height: 32px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1; box-shadow: 0 1px 2px rgba(0,0,0,0.1);">
                                    </a>
                                  ` : ''}
                                  <a href="${escapeHtml(sub.file_url)}" target="_blank" rel="noopener noreferrer"
                                    style="display: inline-flex; align-items: center; gap: 0.35rem; background: #eff6ff; color: #1d4ed8; padding: 0.25rem 0.65rem; border-radius: 0.4rem; border: 1px solid #bfdbfe; font-size: 0.8rem; font-weight: 700; text-decoration: none;">
                                    ${getIcon('file', 14, '#1d4ed8')}
                                    <span>${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(sub.file_url) ? 'معاينة صورة الواجب ↗' : 'معاينة ملف الواجب ↗'}</span>
                                  </a>
                                </div>
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
                              <div style="display: flex; align-items: center; gap: 0.4rem;">
                                ${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(sub.file_url) ? `
                                  <a href="${escapeHtml(sub.file_url)}" target="_blank" rel="noopener noreferrer" title="اضغط لتكبير صورة الواجب">
                                    <img src="${escapeHtml(sub.file_url)}" alt="صورة الواجب" style="width: 30px; height: 30px; object-fit: cover; border-radius: 4px; border: 1px solid #cbd5e1;">
                                  </a>
                                ` : ''}
                                <a href="${escapeHtml(sub.file_url)}" target="_blank" rel="noopener noreferrer"
                                  style="display: inline-flex; align-items: center; gap: 0.35rem; background: #eff6ff; color: #1d4ed8; padding: 0.25rem 0.65rem; border-radius: 0.4rem; border: 1px solid #bfdbfe; font-size: 0.8rem; font-weight: 700; text-decoration: none;">
                                  ${getIcon('file', 14, '#1d4ed8')}
                                  <span>${/\.(jpg|jpeg|png|webp|heic|bmp)($|\?)/i.test(sub.file_url) ? 'معاينة الصورة ↗' : 'معاينة الملف ↗'}</span>
                                </a>
                              </div>
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
                    <th>هاتف الطالب / ولي الأمر</th>
                    <th>الحالة</th>
                    <th style="text-align: center;">إجراءات التذكير بالواتساب</th>
                  </tr>
                </thead>
                <tbody>
                  ${missing.length > 0 ? missing.map(m => {
                    const grp = groups.find(g => g.id === m.group_id);
                    const groupName = grp ? grp.name : '—';
                    const studentPhone = m.student_phone || m.phone || '';
                    const parentPhone = m.parent_phone || '';

                    return `
                      <tr>
                        <td style="font-family: monospace; font-weight: 700;">${escapeHtml(m.code)}</td>
                        <td style="font-weight: 800; color: #0f172a;">${escapeHtml(m.name)}</td>
                        <td>
                          <span class="badge badge-secondary">${escapeHtml(groupName)}</span>
                        </td>
                        <td style="font-family: monospace; font-size: 0.8rem; color: #475569;" dir="ltr">
                          <div><b style="color: #1e293b;">طالب:</b> ${escapeHtml(studentPhone || '—')}</div>
                          ${parentPhone ? `<div><b style="color: #64748b;">ولي أمر:</b> ${escapeHtml(parentPhone)}</div>` : ''}
                        </td>
                        <td>
                          <span class="badge badge-danger" style="font-weight: 700;">لم يُسلّم</span>
                        </td>
                        <td style="text-align: center;">
                          <div style="display: inline-flex; align-items: center; gap: 0.35rem; flex-wrap: wrap; justify-content: center;">
                            <!-- Student WhatsApp Reminder -->
                            ${studentPhone ? `
                              <button type="button" class="btn btn-sm" 
                                onclick="window.centrlyApp && window.centrlyApp.sendHomeworkReminderWhatsApp ? window.centrlyApp.sendHomeworkReminderWhatsApp('${escapeHtml(m.id)}', '${escapeHtml(m.name)}', '${escapeHtml(studentPhone)}', 'student') : null"
                                title="إرسال تذكير للطالب عبر واتساب"
                                style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 700; color: #059669; background: #ecfdf5; border: 1px solid #a7f3d0; padding: 0.25rem 0.55rem; font-size: 0.75rem;">
                                ${getIcon('whatsapp', 13, '#059669')}
                                <span>تذكير الطالب</span>
                              </button>
                            ` : ''}

                            <!-- Parent WhatsApp Reminder -->
                            ${parentPhone ? `
                              <button type="button" class="btn btn-sm" 
                                onclick="window.centrlyApp && window.centrlyApp.sendHomeworkReminderWhatsApp ? window.centrlyApp.sendHomeworkReminderWhatsApp('${escapeHtml(m.id)}', '${escapeHtml(m.name)}', '${escapeHtml(parentPhone)}', 'parent') : null"
                                title="إرسال تذكير لولي الأمر عبر واتساب"
                                style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 700; color: #2563eb; background: #eff6ff; border: 1px solid #bfdbfe; padding: 0.25rem 0.55rem; font-size: 0.75rem;">
                                ${getIcon('whatsapp', 13, '#2563eb')}
                                <span>تذكير ولي الأمر</span>
                              </button>
                            ` : ''}

                            <!-- Copy Student Link Button -->
                            <button type="button" class="btn btn-sm btn-secondary" 
                              onclick="window.centrlyApp && window.centrlyApp.copyStudentLink ? window.centrlyApp.copyStudentLink('${escapeHtml(m.id)}') : null"
                              title="نسخ رابط الطالب المباشر"
                              style="display: inline-flex; align-items: center; gap: 0.2rem; font-size: 0.75rem; padding: 0.25rem 0.45rem;">
                              ${getIcon('link', 12, 'currentColor')}
                              <span>الرابط</span>
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

export function registerHomeworkActions(app) {
  app.refreshHomeworkReview = async function() {
    await this.loadRouteData('homework');
    this.renderMainContent();
    this.showToast('تم تحديث قائمة تسليمات الواجب بنجاح', 'info');
  };

  app.onSelectHomeworkAssignment = async function(materialId) {
    if (!this.homeworkState) this.homeworkState = {};
    this.homeworkState.selectedMaterialId = materialId;
    await this.loadRouteData('homework');
  };

  app.filterHomeworkSubmissionsByGroup = async function(groupId) {
    if (!this.homeworkState) this.homeworkState = {};
    this.homeworkState.selectedGroupId = groupId;
    await this.loadRouteData('homework');
  };

  app.switchHomeworkTab = function(tabName) {
    if (!this.homeworkState) this.homeworkState = {};
    this.homeworkState.activeTab = tabName;
    this.renderMainContent();
  };

  app.switchHomeworkSubTab = function(subTabName) {
    if (!this.homeworkState) this.homeworkState = {};
    this.homeworkState.subTab = subTabName;
    this.renderMainContent();
  };

  app.approveHomeworkSubmission = async function(submissionId) {
    try {
      await request(`/homework/submissions/${submissionId}/review`, {
        method: 'PUT',
        body: { status: 'approved' },
      });
      this.showToast('تم اعتماد الواجب بنجاح', 'success');
      await this.loadRouteData('homework');
    } catch (err) {
      this.showToast(`فشل اعتماد الواجب: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  };

  app.promptRejectHomework = function(submissionId, studentName) {
    const bodyHtml = `
      <div style="font-family: 'Cairo', sans-serif;">
        <p style="font-size: 0.95rem; color: #1e293b; margin-bottom: 1rem; line-height: 1.6;">
          أنت على وشك طلب إعادة حل الواجب من الطالب <strong style="color: var(--centrly-blue-800);">${escapeHtml(studentName)}</strong>.
          يمكنك كتابة ملاحظات وتوجيهات للمعلم تظهر للطالب في بوابته:
        </p>
        <div class="form-group" style="margin-bottom: 0.5rem;">
          <label class="form-label" style="font-weight: 700; color: #334155;">ملاحظات المعلم وأسباب الإعادة (اختياري):</label>
          <textarea id="rejectHomeworkNotes" class="form-input" rows="3" placeholder="اكتب ملاحظات وتوجيهات الإعادة للطالب..."></textarea>
        </div>
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="button" id="btnConfirmRejectHw" class="btn" style="background: #ea580c; color: #fff; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; border: none; padding: 0.5rem 1.25rem; border-radius: 8px; cursor: pointer;" onclick="window.centrlyApp.confirmRejectHomework('${escapeHtml(submissionId)}', '${escapeHtml(studentName)}')">
        <span>تأكيد طلب الإعادة</span>
      </button>
    `;

    this.showModal(`طلب إعادة الواجب: ${escapeHtml(studentName)}`, bodyHtml, footerHtml);
  };

  app.confirmRejectHomework = async function(submissionId, studentName) {
    const notesInput = document.getElementById('rejectHomeworkNotes');
    const note = notesInput ? notesInput.value.trim() : '';
    const confirmBtn = document.getElementById('btnConfirmRejectHw');

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'جاري الإرسال...';
    }

    try {
      await request(`/homework/submissions/${submissionId}/review`, {
        method: 'PUT',
        body: {
          status: 'rejected',
          teacher_notes: note || 'يرجى مراجعة الحل وإعادة إرسال الواجب مرة أخرى.',
        },
      });
      this.closeModal();
      this.showToast(`تم طلب إعادة الواجب من الطالب (${studentName}) بنجاح`, 'warning');
      await this.loadRouteData('homework');
    } catch (err) {
      this.showToast(`فشل تحديث حالة الواجب: ${err.message || 'حدث خطأ'}`, 'danger');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'تأكيد طلب الإعادة';
      }
    }
  };

  app.sendHomeworkReminderWhatsApp = async function(studentId, studentName, phone, targetType = 'student') {
    if (!phone) {
      this.showToast(`رقم هاتف ${targetType === 'parent' ? 'ولي الأمر' : 'الطالب'} غير متوفر للتذكير عبر واتساب`, 'warning');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.startsWith('2') ? cleanPhone : `2${cleanPhone}`;
    const hwTitle = this.homeworkState?.currentHomework?.title || 'الواجب المنزلي';
    
    // Generate short student portal link
    const canonicalOrigin = 'https://centerly-eg.com';
    const cleanSid = String(studentId || '').replace(/-/g, '').slice(0, 8);
    const studentPortalUrl = cleanSid ? `${canonicalOrigin}/s/s${cleanSid}` : `${canonicalOrigin}/parent-portal?portal=student`;

    const message = targetType === 'parent'
      ? `السلام عليكم ورحمة الله، ولي أمر الطالب (${studentName}) المحترم.\nنود إحاطتكم علماً بأن الطالب لم يقم بتسليم الواجب المطلوب (${hwTitle}) حتى الآن.\nيرجى حث الطالب على رفع حل الواجب عبر بوابته الخاصة:\n${studentPortalUrl}\n\nشاكرين تعاونكم المستمر حرصاً على تفوقه!`
      : `أهلاً بك يا ${studentName}، نود تذكيرك بأن لديك واجب مطلوب تسليمه لمادة المعلم (${hwTitle}). يرجى رفع حل الواجب بصيغة PDF عبر بوابتك الخاصة:\n${studentPortalUrl}\n\nبالتوفيق والنجاح دائماً!`;

    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  };

  app.copyAllMissingStudentsPhones = function() {
    const missing = this.homeworkState?.missing || [];
    const phones = missing.map(m => m.phone).filter(Boolean);
    if (phones.length === 0) {
      this.showToast('لا توجد أرقام هواتف مسجلة للطلاب المتأخرين', 'info');
      return;
    }
    this.copyToClipboard(phones.join(', '), `تم نسخ ${phones.length} رقم هاتف للطلاب المتأخرين!`, 'أرقام هواتف الطلاب المتأخرين');
  };

  app.openAddHomeworkModal = function() {
    this._currentHwMode = 'text';
    this._selectedHwPdfFile = null;

    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const bodyHtml = `
      <form id="modalAddHomeworkForm" onsubmit="window.centrlyApp.handleAddHomeworkSubmit(event)">
        
        <!-- Title -->
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">عنوان الواجب *</label>
          <input type="text" id="modalHwTitle" class="form-input" placeholder="عنوان الواجب المنزلي" required>
        </div>

        <!-- Target Group & Due Date -->
        <div class="modal-form-grid">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">المجموعة المستهدفة</label>
            <select id="modalHwGroupId" class="form-select">
              <option value="">جميع المجموعات (متاح للكل)</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">آخر موعد لتسليم الواجب</label>
            <input type="date" id="modalHwDueDate" class="form-input" value="${nextWeek}">
          </div>
        </div>

        <!-- Mode Selector Pills (3 Modes Requested by User) -->
        <div style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 800; color: #0f172a; margin-bottom: 0.45rem;">اختر طريقة تقديم الواجب للطلاب *</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; background: #f1f5f9; padding: 0.35rem; border-radius: 0.65rem; border: 1px solid #e2e8f0;">
            <button type="button" id="hwTabBtn-text" onclick="window.centrlyApp.switchHwTab('text')" 
              style="display: flex; align-items: center; justify-content: center; padding: 0.55rem 0.4rem; font-size: 0.85rem; font-weight: 800; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; background: #ffffff; color: var(--centrly-blue-800); box-shadow: 0 2px 4px rgba(0,0,0,0.08); text-align: center;">
              نص حر
            </button>
            <button type="button" id="hwTabBtn-pdf" onclick="window.centrlyApp.switchHwTab('pdf')" 
              style="display: flex; align-items: center; justify-content: center; padding: 0.55rem 0.4rem; font-size: 0.85rem; font-weight: 700; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b; text-align: center;">
              رفع ملف PDF
            </button>
            <button type="button" id="hwTabBtn-link" onclick="window.centrlyApp.switchHwTab('link')" 
              style="display: flex; align-items: center; justify-content: center; padding: 0.55rem 0.4rem; font-size: 0.85rem; font-weight: 700; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b; text-align: center;">
              رابط / لينك
            </button>
          </div>
        </div>

        <!-- Mode 1: Free Text Section -->
        <div id="hwSection-text">
          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="font-weight: 800; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 0.35rem;">
                ${getIcon('homework', 16, 'var(--centrly-blue-700)')}
                <span>نص وتفاصيل الواجب المطلوب حله *</span>
              </span>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">(Ctrl + Enter للحفظ السريع)</span>
            </label>
            <textarea id="modalHwDescriptionText" class="form-input" rows="5" 
              placeholder="اكتب هنا تفاصيل الواجب والصفحات والأسئلة المطلوبة..." 
              style="line-height: 1.6; resize: vertical;"></textarea>
          </div>
        </div>

        <!-- Mode 2: Direct PDF Upload Section -->
        <div id="hwSection-pdf" style="display: none;">
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" style="font-weight: 800; color: #0f172a;">رفع ملف الواجب بصيغة PDF من جهازك *</label>
            
            <input type="file" id="modalHwPdfFileInput" accept="application/pdf" style="display: none;" onchange="window.centrlyApp.handleHwPdfSelected(event)">
            
            <div id="hwPdfDropzone" onclick="document.getElementById('modalHwPdfFileInput').click()" 
              style="border: 2px dashed #3b82f6; border-radius: 0.75rem; padding: 1.35rem 1rem; text-align: center; cursor: pointer; background: #eff6ff; transition: all 0.2s;">
              <div style="display: flex; justify-content: center; margin-bottom: 0.4rem;">
                ${getIcon('upload', 32, '#2563eb')}
              </div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #1e40af; margin-bottom: 0.2rem;">
                اضغط هنا لاختيار ملف PDF من اللابتوب أو الموبايل
              </div>
              <div style="font-size: 0.78rem; color: #64748b;">
                ملفات PDF فقط (الحد الأقصى 100 ميجابايت)
              </div>
            </div>

            <div id="hwPdfSelectedPreview" style="display: none; margin-top: 0.6rem; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 0.65rem; padding: 0.75rem 0.9rem; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                <span style="display: flex; align-items: center; color: #15803d;">${getIcon('file', 22, '#15803d')}</span>
                <div style="overflow: hidden;">
                  <div id="hwPdfSelectedName" style="font-weight: 800; font-size: 0.875rem; color: #166534; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
                  <div id="hwPdfSelectedSize" style="font-size: 0.75rem; color: #15803d; font-weight: 600;"></div>
                </div>
              </div>
              <button type="button" onclick="window.centrlyApp.clearHwPdfFile()" class="btn btn-sm" style="background: #ffffff; border: 1px solid #fca5a5; color: #dc2626; font-weight: 700; font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: 0.4rem; cursor: pointer;">
                تغيير الملف
              </button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="font-weight: 700; color: #334155;">تعليمات أو ملاحظات إضافية على الملف (اختياري)</label>
            <textarea id="modalHwDescriptionPdf" class="form-input" rows="2" placeholder="اكتب أي ملاحظات أو تعليمات إضافية للطلاب حول الملف..." style="line-height: 1.5; resize: vertical;"></textarea>
          </div>
        </div>

        <!-- Mode 3: External Link Section -->
        <div id="hwSection-link" style="display: none;">
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" style="font-weight: 800; color: #0f172a;">رابط ملف الواجب (Google Drive / لينك مباشر) *</label>
            <input type="url" id="modalHwUrl" class="form-input" placeholder="https://drive.google.com/... أو أي رابط خارجي" dir="ltr">
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
              تأكد أن الرابط متاح للعرض والمشاركة مع الطلاب
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="font-weight: 700; color: #334155;">تعليمات أو ملاحظات على الرابط (اختياري)</label>
            <textarea id="modalHwDescriptionLink" class="form-input" rows="2" placeholder="اكتب أي ملاحظات أو تعليمات إضافية للطلاب حول الرابط..." style="line-height: 1.5; resize: vertical;"></textarea>
          </div>
        </div>

      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddHomeworkForm" id="btnPublishHomework" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">
        نشر الواجب للطلاب الآن
      </button>
    `;

    this.showModal('نشر وتكليف واجب منزلي جديد (Homework)', bodyHtml, footerHtml);
  };

  app.switchHwTab = function(mode) {
    this._currentHwMode = mode;
    const tabs = ['text', 'pdf', 'link'];
    tabs.forEach(t => {
      const btn = document.getElementById(`hwTabBtn-${t}`);
      const sec = document.getElementById(`hwSection-${t}`);
      if (btn && sec) {
        if (t === mode) {
          btn.style.background = '#ffffff';
          btn.style.color = 'var(--centrly-blue-800)';
          btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
          btn.style.fontWeight = '800';
          sec.style.display = 'block';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = '#64748b';
          btn.style.boxShadow = 'none';
          btn.style.fontWeight = '700';
          sec.style.display = 'none';
        }
      }
    });

    setTimeout(() => {
      if (mode === 'text') document.getElementById('modalHwDescriptionText')?.focus();
      else if (mode === 'link') document.getElementById('modalHwUrl')?.focus();
    }, 50);
  };

  app.handleHwPdfSelected = function(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.showToast('يرجى اختيار ملف PDF صالح فقط', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      this.showToast('حجم الملف كبير جداً (أقصى حد مسموح 100 ميجابايت)', 'error');
      e.target.value = '';
      return;
    }

    this._selectedHwPdfFile = file;

    const preview = document.getElementById('hwPdfSelectedPreview');
    const dropzone = document.getElementById('hwPdfDropzone');
    const nameEl = document.getElementById('hwPdfSelectedName');
    const sizeEl = document.getElementById('hwPdfSelectedSize');

    if (preview && nameEl && sizeEl) {
      nameEl.textContent = file.name;
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      sizeEl.textContent = `${sizeMB} ميجابايت`;
      preview.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
    }
  };

  app.clearHwPdfFile = function() {
    this._selectedHwPdfFile = null;
    const input = document.getElementById('modalHwPdfFileInput');
    if (input) input.value = '';
    const preview = document.getElementById('hwPdfSelectedPreview');
    const dropzone = document.getElementById('hwPdfDropzone');
    if (preview) preview.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
  };

  app.onHomeworkTypeChange = function(mode) {
    // Kept for backward compatibility
  };

  app.handleAddHomeworkSubmit = async function(e) {
    e.preventDefault();
    const mode = this._currentHwMode || 'text';
    const title = document.getElementById('modalHwTitle')?.value.trim();
    const group_id = document.getElementById('modalHwGroupId')?.value || null;
    const due_date = document.getElementById('modalHwDueDate')?.value || null;
    const submitBtn = document.getElementById('btnPublishHomework');

    if (!title) {
      this.showToast('يرجى كتابة عنوان الواجب', 'error');
      return;
    }

    let description = '';
    let url = '';
    let file_data = null;
    let file_name = null;

    if (mode === 'text') {
      description = document.getElementById('modalHwDescriptionText')?.value.trim() || '';
      if (!description) {
        this.showToast('يرجى كتابة نص الواجب وتفاصيل المطلوب حله', 'error');
        return;
      }
    } else if (mode === 'pdf') {
      description = document.getElementById('modalHwDescriptionPdf')?.value.trim() || '';
      if (!this._selectedHwPdfFile) {
        this.showToast('يرجى اختيار ملف PDF لرفعه للطلاب', 'error');
        return;
      }
      file_name = this._selectedHwPdfFile.name;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>جاري قراءة ورفع الملف...</span>`;
      }

      try {
        file_data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('فشل قراءة الملف من الجهاز'));
          reader.readAsDataURL(this._selectedHwPdfFile);
        });
      } catch (readErr) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>نشر الواجب للطلاب الآن</span>`;
        }
        this.showToast('فشل قراءة ملف الـ PDF، يرجى المحاولة مرة أخرى', 'error');
        return;
      }
    } else if (mode === 'link') {
      url = document.getElementById('modalHwUrl')?.value.trim() || '';
      description = document.getElementById('modalHwDescriptionLink')?.value.trim() || '';
      if (!url) {
        this.showToast('يرجى إدخال رابط ملف الواجب (Google Drive أو لينك خارجي)', 'error');
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>جاري نشر وتكليف الواجب...</span>`;
    }

    try {
      await request('/materials', {
        method: 'POST',
        body: {
          title,
          group_id,
          type: 'pdf',
          url,
          file_data,
          file_name,
          description: description || null,
          is_homework: true,
          due_date,
          book_name: null,
          pages: null,
          questions: null,
        },
      });

      this.closeModal();
      this.showToast('تم نشر الواجب بنجاح! سيظهر الآن في بوابات الطلاب وأولياء الأمور', 'success');
      
      if (this.currentRoute === 'homework') {
        await this.loadRouteData('homework');
      } else if (this.currentRoute === 'materials') {
        await this.loadRouteData('materials');
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>نشر الواجب للطلاب الآن</span>`;
      }
      this.showToast(`فشل نشر الواجب: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  };

  app.copyHomeworkAssignmentText = function(homeworkId) {
    const hw = (this.homeworkState?.assignments || this.materials || []).find(h => h.id === homeworkId);
    if (!hw) {
      this.showToast('تعذر العثور على بيانات الواجب للنسخ', 'error');
      return;
    }

    let text = `*واجب منزلي جديد مطلوب تسليمه*\n`;
    text += `• *العنوان:* ${hw.title}\n`;
    if (hw.book_name) text += `• *الكتاب / الملزمة:* ${hw.book_name}\n`;
    if (hw.pages) text += `• *الصفحات المطلوبة:* ${hw.pages}\n`;
    if (hw.questions) text += `• *أرقام الأسئلة:* ${hw.questions}\n`;
    if (hw.description) text += `• *وصف الواجب والمطلوب حله:*\n${hw.description}\n`;
    if (hw.due_date) text += `• *آخر موعد للتسليم:* ${hw.due_date}\n`;
    if (hw.url && hw.url !== '#' && hw.url.trim().length > 0) text += `• *رابط الملف المرفق:* ${hw.url}\n`;
    text += `\n• *طريقة التسليم:* حل المطلوب في كشكولك بخط واضح، وصوّر الصفحات وحوّلها لـ PDF وارفعها مباشرة عبر رابط بوابتك الخاصة في Centrly.\nبالتوفيق والنجاح دائماً.`;

    this.copyToClipboard(text, 'تم نسخ تفاصيل الواجب بنجاح! جاهز للصق في جروب الواتساب', 'تفاصيل الواجب');
  };
}
