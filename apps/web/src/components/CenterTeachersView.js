import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Center Teachers Management Component
 * Lists center teachers, subjects, billing models (percentage/fixed rent), active groups, students count,
 * and allows adding new teachers via invite link or direct creation.
 */

export function renderCenterTeachersView(teachers = [], groups = []) {
  const teacherList = teachers || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title & Action -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('students', 22, 'var(--centrly-blue-700)')}</span>
              <span>سجل معلمي ومدرسي السنتر</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              إدارة مدرسي السنتر، نسب السنتر ونظام المحاسبة، ومتابعة مجاميع وطلاب كل مدرس.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddTeacherModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('add', 16)}
              <span>إضافة مدرس جديد</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Teachers KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي مدرسي السنتر</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${teacherList.length} <span style="font-size: 0.85rem; font-weight: 500;">معلم</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            يعملون بمختلف المواد الدراسية
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">المدرسين النشطين</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
            ${teacherList.filter(t => t.status === 'active' || !t.status).length} <span style="font-size: 0.85rem; font-weight: 500;">نشط</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            لديهم مجاميع وحصص جارية
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي المجاميع التابعة</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${groups.length} <span style="font-size: 0.85rem; font-weight: 500;">مجموعة</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            موزعة على قاعات السنتر
          </div>
        </div>
      </div>

      <!-- Teachers Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('students', 18, 'var(--centrly-blue-700)')}
            <span>قائمة مدرسي السنتر (${teacherList.length})</span>
          </h3>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم المعلم</th>
                <th>المادة الدراسية</th>
                <th>رقم الهاتف</th>
                <th>نظام المحاسبة الافتراضي</th>
                <th>المجاميع التابعة</th>
                <th>الحالة</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${teacherList.length > 0 ? teacherList.map(t => {
                const teacherGroups = (groups || []).filter(g => g.teacher_id === t.id);
                let billingText = 'نسبة سنتر (20%)';
                if (t.default_billing_model === 'fixed_per_student') {
                  billingText = `أجر ثابت (${t.default_fixed_cut || 20} ج.م/طالب)`;
                } else if (t.default_billing_model === 'fixed_rent') {
                  billingText = `إيجار قاعة (${t.default_fixed_cut || 250} ج.م/حصة)`;
                } else if (t.default_percentage) {
                  billingText = `نسبة سنتر (${t.default_percentage}%)`;
                }

                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(t.name)}</td>
                    <td><span class="badge badge-blue">${escapeHtml(t.subject || 'عامة')}</span></td>
                    <td dir="ltr" style="text-align: right; font-family: monospace; font-size: 0.85rem;">${escapeHtml(t.phone || '—')}</td>
                    <td style="font-size: 0.85rem; color: var(--centrly-text); font-weight: 600;">${escapeHtml(billingText)}</td>
                    <td style="font-weight: 700; color: var(--centrly-blue-800);">${teacherGroups.length} مجاميع</td>
                    <td>
                      <span class="badge ${t.status === 'active' || !t.status ? 'badge-success' : 'badge-warning'}">
                        ${t.status === 'active' || !t.status ? 'نشط' : 'في انتظار التفعيل'}
                      </span>
                    </td>
                    <td>
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.viewTeacherGroups('${escapeHtml(t.id)}')" style="display: inline-flex; align-items: center; gap: 0.3rem;">
                        ${getIcon('groups', 14)}
                        <span>المجاميع</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا يوجد مدرسون مضافون بعد. اضغط على "إضافة مدرس جديد" لإضافة أول معلم في السنتر.
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
