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
  const approvedCount = submitted.filter(s => s.status === 'approved').length;
  const pendingCount = submitted.filter(s => s.status === 'pending').length;

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
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">📝</div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0 0 0.5rem 0;">لا توجد واجبات منزلية منشورة حتى الآن</h3>
          <p style="font-size: 0.85rem; color: #64748b; margin: 0 0 1.5rem 0;">
            يمكنك نشر واجب منزلي جديد مع رابط المذكرة وموعد التسليم من صفحة "المذكرات والماتريال".
          </p>
          <div>
            <button class="btn btn-primary" onclick="window.centrlyApp.navigate('materials')" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              <span>📚 الانتقال إلى المذكرات وإضافة واجب</span>
            </button>
          </div>
        </div>
      ` : `
        <!-- KPI Summary Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #10b981;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
              <div>
                <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">📥 مين سلّم الواجب</div>
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
                <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">⏳ مين لسه ما سلّمش</div>
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

        <!-- 2-Tab Navigation (Submitted vs Missing) -->
        <div class="card" style="margin: 0; padding: 0.5rem; background: #fff;">
          <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid #e2e8f0; padding-bottom: 0.5rem;">
            <button type="button" class="btn ${activeTab === 'submitted' ? 'btn-primary' : 'btn-secondary'}" 
              onclick="window.centrlyApp && window.centrlyApp.switchHomeworkTab ? window.centrlyApp.switchHomeworkTab('submitted') : null"
              style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800; padding: 0.5rem 1.25rem;">
              <span>📥</span>
              <span>الطلاب المسلّمون (مين سلّم - ${submitted.length})</span>
            </button>

            <button type="button" class="btn ${activeTab === 'missing' ? 'btn-primary' : 'btn-secondary'}" 
              onclick="window.centrlyApp && window.centrlyApp.switchHomeworkTab ? window.centrlyApp.switchHomeworkTab('missing') : null"
              style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 800; padding: 0.5rem 1.25rem;">
              <span>⏳</span>
              <span>الطلاب المتأخرون (مين لسه - ${missing.length})</span>
            </button>
          </div>
        </div>

        <!-- ================= TAB 1: SUBMITTED STUDENTS (مين سلّم) ================= -->
        ${activeTab === 'submitted' ? `
          <div class="card" style="margin: 0;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center;">
              <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
                <span>📥</span>
                <span>قائمة الطلاب الذين قاموا برفع الواجب (${submitted.length})</span>
              </h3>
            </div>

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
                  ${submitted.length > 0 ? submitted.map(sub => {
                    const isApproved = sub.status === 'approved';
                    const isPending = sub.status === 'pending';
                    const isRejected = sub.status === 'rejected';

                    const statusBadge = isApproved 
                      ? '<span class="badge badge-success" style="font-weight: 800;">معتمد ✅</span>' 
                      : (isPending 
                        ? '<span class="badge badge-warning" style="font-weight: 800;">قيد المراجعة ⏳</span>' 
                        : '<span class="badge badge-danger" style="font-weight: 800;">يحتاج إعادة ⚠️</span>');

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
                              <span>📄</span>
                              <span>فتح ملف الـ PDF</span>
                            </a>
                          ` : (isApproved ? `
                            <span style="display: inline-flex; align-items: center; gap: 0.3rem; background: #f0fdf4; color: #15803d; padding: 0.25rem 0.6rem; border-radius: 0.4rem; border: 1px solid #bbf7d0; font-size: 0.78rem; font-weight: 700;" title="تم فحص الواجب وتفريغ الملف من السيرفر بنجاح لتخفيف الحمل وتوفير التخزين">
                              <span>⚡</span>
                              <span>تم الاعتماد وتفريغ المساحة</span>
                            </span>
                          ` : `
                            <span style="font-size: 0.78rem; color: #94a3b8;">لا يوجد ملف مرفق</span>
                          `)}
                        </td>
                        <td>${statusBadge}</td>
                        <td style="font-size: 0.8rem; color: #475569; max-width: 200px;">
                          ${sub.teacher_notes ? escapeHtml(sub.teacher_notes) : '<span style="color: #94a3b8;">—</span>'}
                        </td>
                        <td style="text-align: center;">
                          <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                            <!-- Approve Button -->
                            <button type="button" class="btn btn-sm ${isApproved ? 'btn-secondary' : 'btn-success'}" 
                              onclick="${isApproved ? 'return false;' : `window.centrlyApp && window.centrlyApp.approveHomeworkSubmission ? window.centrlyApp.approveHomeworkSubmission('${escapeHtml(sub.id)}') : null`}"
                              ${isApproved ? 'disabled' : ''}
                              title="${isApproved ? 'تم اعتماد الواجب وحذف الملف من الذاكرة لتخفيف الحمل' : 'اعتماد الواجب وتسجيله وحذف الملف لتوفير التخزين'}"
                              style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 700; padding: 0.25rem 0.6rem; ${isApproved ? 'opacity: 0.7; cursor: default;' : ''}">
                              <span>✅</span>
                              <span>${isApproved ? 'معتمد ومُفرّغ' : 'موافق / اعتماد'}</span>
                            </button>

                            <!-- Reject / Revision Request Button -->
                            <button type="button" class="btn btn-sm btn-secondary" 
                              onclick="window.centrlyApp && window.centrlyApp.promptRejectHomework ? window.centrlyApp.promptRejectHomework('${escapeHtml(sub.id)}', '${escapeHtml(sub.student_name)}') : null"
                              title="طلب إعادة التسليم مع ملاحظة"
                              style="display: inline-flex; align-items: center; gap: 0.25rem; font-weight: 700; padding: 0.25rem 0.5rem; color: #dc2626;">
                              <span>✏️</span>
                              <span>ملاحظة / رفض</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr>
                      <td colspan="7" style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">📥</div>
                        لم يقم أي طالب بتسليم هذا الواجب بعد.<br>
                        يمكنك الاطلاع على قائمة الطلاب المتأخرين من التبويب المجاور وتذكيرهم عبر الواتساب.
                      </td>
                    </tr>
                  `}
                </tbody>
              </table>
            </div>
          </div>
        ` : `
          <!-- ================= TAB 2: MISSING STUDENTS (مين لسه) ================= -->
          <div class="card" style="margin: 0;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem; margin: 0;">
                  <span>⏳</span>
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
                  <span>📋</span>
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
                          <span class="badge badge-danger" style="font-weight: 700;">لم يُسلّم ❌</span>
                        </td>
                        <td style="text-align: center;">
                          <div style="display: inline-flex; align-items: center; gap: 0.4rem;">
                            <!-- Direct WhatsApp Reminder Button -->
                            <button type="button" class="btn btn-sm btn-secondary" 
                              onclick="window.centrlyApp && window.centrlyApp.sendHomeworkReminderWhatsApp ? window.centrlyApp.sendHomeworkReminderWhatsApp('${escapeHtml(m.id)}', '${escapeHtml(m.name)}', '${escapeHtml(studentPhone)}') : null"
                              title="إرسال تذكير عبر واتساب"
                              style="display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 700; color: #059669; border-color: #a7f3d0; padding: 0.25rem 0.65rem;">
                              <span>💬</span>
                              <span>تذكير واتساب</span>
                            </button>

                            <!-- Copy Student Link Button -->
                            <button type="button" class="btn btn-sm btn-secondary" 
                              onclick="window.centrlyApp && window.centrlyApp.copyStudentLink ? window.centrlyApp.copyStudentLink('${escapeHtml(m.id)}') : null"
                              title="نسخ رابط الطالب لإرساله له"
                              style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; padding: 0.25rem 0.5rem;">
                              <span>🔗</span>
                              <span>رابط الطالب</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr>
                      <td colspan="6" style="text-align: center; padding: 2.5rem 1rem; color: #059669; font-weight: 700;">
                        <div style="font-size: 2rem; margin-bottom: 0.5rem;">🎉</div>
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
