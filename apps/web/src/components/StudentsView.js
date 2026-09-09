import { renderStudentSearchBar } from "./StudentSearchBar.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Students Directory Component (DEV-89)
 * Clean vector icons, mandatory student phone, cards navigation, and direct parent notes.
 */

export function renderStudentsView(students = [], groups = []) {
  const studentList = students || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Top Action Bar -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('students', 22, 'var(--centrly-blue-700)')}</span>
              <span>دليل الطلاب وقاعدة البيانات</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              إدارة بيانات الطلاب، أرقام الهواتف الإلزامية، إرسال الملاحظات، والاستثناءات المالية
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddStudentModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('add', 18)}
              <span>طالب جديد</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.navigate('student-cards')" style="display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('cards', 18)}
              <span>طباعة كروت الطلاب</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.openImportModal()" style="display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('download', 18)}
              <span>استيراد Excel / CSV</span>
            </button>
          </div>
        </div>

        <!-- Search & Filter Controls -->
        <div style="display: flex; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap; align-items: center;">
          <div style="flex: 2; min-width: 240px;">
            ${renderStudentSearchBar({
              id: "studentSearchInput",
              placeholder: "ابحث بالاسم، كود الطالب، أو رقم الهاتف...",
              onInputHandler: "window.centrlyApp.filterStudentsTable()",
            })}
          </div>
          <select id="studentGroupFilter" class="form-select" style="flex: 1; min-width: 180px;" onchange="window.centrlyApp.filterStudentsTable()">
            <option value="">جميع المجاميع</option>
            ${(groups || []).map(g => `<option value="${escapeHtml(g.name || g.id)}">${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
      </div>

      <!-- Students Table -->
      <div class="card" style="margin: 0;">
        <div style="overflow-x: auto;">
          <table class="data-table" id="studentsTable">
            <thead>
              <tr>
                <th>كود الطالب</th>
                <th>اسم الطالب</th>
                <th>المجموعة</th>
                <th>هاتف الطالب *</th>
                <th>هاتف ولي الأمر *</th>
                <th>الرسوم والخصم</th>
                <th>رابط المتابعة</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${studentList.length > 0 ? studentList.map(s => {
                const matchedGroup = (groups || []).find(g => g.id === s.group_id || g.id === s.groupId);
                const displayGroupName = s.groupName || s.group_name || matchedGroup?.name || 'مجموعة عامة';
                const studentPhone = s.studentPhone || s.student_phone;
                const parentPhone = s.parentPhone || s.parent_phone;
                return `
                <tr>
                  <td style="font-family: monospace; font-weight: 700; color: var(--centrly-blue-800);">${escapeHtml(s.code || s.student_code || '—')}</td>
                  <td style="font-weight: 700; font-size: 0.95rem;">${escapeHtml(s.name || s.full_name || '—')}</td>
                  <td><span class="badge badge-blue" style="font-weight: 600;">${escapeHtml(displayGroupName)}</span></td>
                  <td dir="ltr" style="text-align: right; font-family: monospace; font-size: 0.85rem; font-weight: 600;">
                    ${escapeHtml(studentPhone || '—')}
                  </td>
                  <td dir="ltr" style="text-align: right; font-family: monospace; font-size: 0.85rem; color: var(--centrly-text);">
                    ${escapeHtml(parentPhone || '—')}
                  </td>
                  <td>
                    ${s.exempt ? '<span class="badge badge-success">منحة / معفي</span>' : (s.feeOverride || s.fee_override ? `<span class="badge badge-warning">خصم: ${escapeHtml(s.feeOverride || s.fee_override)} ج.م</span>` : '<span style="color:var(--centrly-text); font-size:0.85rem;">أساسي</span>')}
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.copyParentLink('${escapeHtml(s.id)}')" title="نسخ رابط ولي الأمر بدون تسجيل دخول" style="display: flex; align-items: center; gap: 0.3rem;">
                      ${getIcon('whatsapp', 14)}
                      <span>رابط المتابعة</span>
                    </button>
                  </td>
                  <td>
                    <div style="display: flex; gap: 0.35rem;">
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openParentNoteModal('${escapeHtml(s.id)}', '${escapeHtml(s.name)}')" title="إرسال ملاحظة خاصة لولي الأمر عبر الواتساب" style="display: flex; align-items: center; gap: 0.3rem;">
                        ${getIcon('note', 14)}
                        <span>ملاحظة</span>
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.editStudent('${escapeHtml(s.id)}')" title="تعديل بيانات الطالب">
                        ${getIcon('edit', 14)}
                      </button>
                    </div>
                  </td>
                </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا يوجد طلاب مسجلون حتى الآن. اضغط على "طالب جديد" لبدء الإضافة.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
