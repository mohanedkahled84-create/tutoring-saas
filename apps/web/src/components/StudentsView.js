import { renderStudentSearchBar } from "./StudentSearchBar.js";

/**
 * Centrly Students Directory Component (DEV-16)
 * Student search, registration, barcode quick-print, and CSV import.
 */

export function renderStudentsView(students = [], groups = []) {
  const studentList = students || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Top Action Bar -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">دليل الطلاب وقاعدة البيانات</h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              إدارة بيانات الطلاب، أرقام أولياء الأمور، كروت الباركود والاستثناءات المالية
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddStudentModal()">
              ➕ طالب جديد
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.downloadBarcodeSheet()">
              🏷️ طباعة كروت الباركود A4
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.openImportModal()">
              📥 استيراد من Excel / CSV
            </button>
          </div>
        </div>

        <!-- Search & Filter Controls with Universal StudentSearchBar -->
        <div style="display: flex; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap; align-items: center;">
          <div style="flex: 2; min-width: 240px;">
            ${renderStudentSearchBar({
              id: "studentSearchInput",
              placeholder: "🔍 ابحث بالاسم، كود الطالب، أو رقم ولي الأمر...",
              onInputHandler: "window.centrlyApp.filterStudentsTable()",
            })}
          </div>
          <select id="studentGroupFilter" class="form-select" style="flex: 1; min-width: 180px;" onchange="window.centrlyApp.filterStudentsTable()">
            <option value="">جميع المجاميع</option>
            ${(groups || []).map(g => `<option value="${g.name || g.id}">${g.name}</option>`).join('')}
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
                <th>رقم ولي الأمر</th>
                <th>الرسوم والخصم</th>
                <th>رابط ولي الأمر</th>
                <th>إجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${studentList.length > 0 ? studentList.map(s => `
                <tr>
                  <td style="font-family: monospace; font-weight: 700;">${s.code || s.student_code || '—'}</td>
                  <td style="font-weight: 700;">${s.name || s.full_name || '—'}</td>
                  <td>${s.groupName || s.group_name || '—'}</td>
                  <td dir="ltr" style="text-align: right; font-family: monospace;">${s.parentPhone || s.parent_phone || '—'}</td>
                  <td>
                    ${s.exempt ? '<span class="badge badge-success">منحة / معفي</span>' : (s.feeOverride ? `<span class="badge badge-blue">خصم: ${s.feeOverride} ج.م</span>` : 'أساسي')}
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.copyParentLink('${s.id}')" title="نسخ رابط ولي الأمر بدون تسجيل دخول">
                      🔗 نسخ الرابط
                    </button>
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.editStudent('${s.id}')">
                      ✏️ تعديل
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا يوجد طلاب مسجلون حتى الآن. اضغط على "➕ طالب جديد" أو "استيراد من Excel" لإضافة طلابك.
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
