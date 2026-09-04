/**
 * Centrly Students Directory Component (DEV-16)
 * Student search, registration, barcode quick-print, and CSV import.
 */

export function renderStudentsView(students = [], groups = []) {
  const defaultStudents = students.length > 0 ? students : [
    { id: 's1', code: '1001', name: 'أحمد محمود', groupName: 'تانية ثانوي - أ', phone: '01011111111', parentPhone: '01012345678', exempt: false },
    { id: 's2', code: '1002', name: 'سارة خالد', groupName: 'تانية ثانوي - أ', phone: '01022222222', parentPhone: '01123456789', exempt: false },
    { id: 's3', code: '1003', name: 'عمر إبراهيم', groupName: 'أولى ثانوي - ب', phone: '01033333333', parentPhone: '01234567890', exempt: true },
    { id: 's4', code: '1004', name: 'مريم علي', groupName: 'تالتة ثانوي - عام', phone: '01044444444', parentPhone: '01512345678', feeOverride: 70 },
  ];

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

        <!-- Search & Filter Controls -->
        <div style="display: flex; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap;">
          <input type="text" id="studentSearchInput" class="form-input" placeholder="🔍 ابحث بالاسم، كود الطالب، أو رقم ولي الأمر..." style="flex: 2; min-width: 240px;" oninput="window.centrlyApp.filterStudentsTable()">
          <select id="studentGroupFilter" class="form-select" style="flex: 1; min-width: 180px;" onchange="window.centrlyApp.filterStudentsTable()">
            <option value="">جميع المجاميع</option>
            <option value="تانية ثانوي - أ">تانية ثانوي - أ</option>
            <option value="أولى ثانوي - ب">أولى ثانوي - ب</option>
            <option value="تالتة ثانوي - عام">تالتة ثانوي - عام</option>
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
              ${defaultStudents.map(s => `
                <tr>
                  <td style="font-family: monospace; font-weight: 700;">${s.code}</td>
                  <td style="font-weight: 700;">${s.name}</td>
                  <td>${s.groupName}</td>
                  <td dir="ltr" style="text-align: right; font-family: monospace;">${s.parentPhone}</td>
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
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
