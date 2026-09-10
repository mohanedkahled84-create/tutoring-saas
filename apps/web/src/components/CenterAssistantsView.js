import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Center Assistants Management Component
 * Lists center and teacher assistants, displaying:
 * - Affiliation: Assistant to Center vs Assistant to Teacher (with teacher name)
 * - Salary amount (المرتب الشهري)
 * - Financial permission status
 * - Add assistant modal with all inputs
 */

export function renderCenterAssistantsView(assistants = [], teachers = []) {
  const assistantList = assistants || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title & Action -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('assistants', 22, 'var(--centrly-blue-700)')}</span>
              <span>سجل المساعدين والإداريين (Assistants)</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              إدارة مساعدي السنتر ومساعدي المدرسين، تحديد التبعية، رصد المرتبات الشهرية، وضبط صلاحيات الاطلاع المالي.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddAssistantModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('add', 16)}
              <span>إضافة مساعد جديد</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Assistants Summary KPIs -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي المساعدين</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${assistantList.length} <span style="font-size: 0.85rem; font-weight: 500;">مساعد</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            مساعدو السنتر ومساعدو المدرسين
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">مساعدو إدارة السنتر</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
            ${assistantList.filter(a => a.assistant_type === 'assistant_to_center' || a.assistant_type === 'center').length} <span style="font-size: 0.85rem; font-weight: 500;">مساعد سنتر</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            يشرفون على الاستقبال ورصد الحصص
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">مساعدو المعلمين المباشرين</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-amber-700); margin-top: 0.35rem;">
            ${assistantList.filter(a => a.assistant_type === 'assistant_to_teacher' || a.assistant_type === 'teacher').length} <span style="font-size: 0.85rem; font-weight: 500;">مساعد معلم</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            يتبعون معلمين محددين بالسنتر
          </div>
        </div>
      </div>

      <!-- Assistants Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('assistants', 18, 'var(--centrly-blue-700)')}
            <span>قائمة المساعدين (${assistantList.length})</span>
          </h3>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم المساعد</th>
                <th>التبعية (سنتر أم معلم)</th>
                <th>المعلم التابع له (إن وجد)</th>
                <th>رقم الهاتف</th>
                <th>المرتب الشهري</th>
                <th>صلاحية المالية</th>
                <th>الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${assistantList.length > 0 ? assistantList.map(a => {
                const isCenter = a.assistant_type === 'assistant_to_center' || a.assistant_type === 'center';
                const teacher = teachers.find(t => t.id === a.teacher_id);
                const teacherName = teacher ? teacher.name : (a.teacher_name || '—');
                const salaryVal = Number(a.salary || 0);

                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(a.name)}</td>
                    <td>
                      <span class="badge ${isCenter ? 'badge-blue' : 'badge-warning'}">
                        ${isCenter ? 'إدارة السنتر' : 'معلم خاص'}
                      </span>
                    </td>
                    <td style="font-weight: 600; color: var(--centrly-blue-800);">
                      ${escapeHtml(teacherName)}
                    </td>
                    <td dir="ltr" style="text-align: right; font-family: monospace; font-size: 0.85rem;">${escapeHtml(a.phone || '—')}</td>
                    <td style="font-family: monospace; font-weight: 800; color: var(--centrly-ink);">
                      ${salaryVal > 0 ? `${salaryVal.toLocaleString('ar-EG')} ج.م` : 'غير محدد'}
                    </td>
                    <td>
                      <span class="badge ${a.can_view_financials ? 'badge-success' : 'badge-secondary'}">
                        ${a.can_view_financials ? 'مفعلة' : 'محجوبة'}
                      </span>
                    </td>
                    <td>
                      <span class="badge ${a.status === 'active' || !a.status ? 'badge-success' : 'badge-warning'}">
                        ${a.status === 'active' || !a.status ? 'نشط' : 'معلق'}
                      </span>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا يوجد مساعدون مسجلون حالياً. اضغط على "إضافة مساعد جديد" لإضافة مساعد وتعيين تبعيته ومرتبه.
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
