import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Teacher Assistants Management Component
 * Allows teachers to manage their assistants, specify:
 * - Assigned Group (or all groups)
 * - Nature of work (إداري / تعليمي / شامل)
 * - Salary model (بالحصة / بالشهر)
 * - Security PIN protection & mask numbers toggle
 */

export function renderTeacherAssistantsView(
  assistants = [],
  groups = [],
  securityState = { hasPin: false, isUnlocked: true, hideNumbers: false }
) {
  const assistantList = assistants || [];
  const { hasPin, isUnlocked, hideNumbers } = securityState;

  // Compute stats
  const totalAssistants = assistantList.length;
  const perSessionCount = assistantList.filter(a => a.salary_model === 'per_session').length;
  const monthlyCount = assistantList.filter(a => a.salary_model === 'monthly' || !a.salary_model).length;

  const totalMonthlySalaries = assistantList
    .filter(a => a.salary_model === 'monthly' || !a.salary_model)
    .reduce((sum, a) => sum + (Number(a.salary_amount) || 0), 0);

  const displayMonthly = hideNumbers ? '••••••' : `${totalMonthlySalaries.toLocaleString('ar-EG')} ج.م`;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Security PIN Banner / Status Bar -->
      <div class="card" style="margin: 0; background: ${!hasPin ? '#fffbeb' : '#f8fafc'}; border: 1px solid ${!hasPin ? '#fde68a' : '#e2e8f0'}; padding: 1rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="font-size: 1.5rem;">${!hasPin ? '⚠️' : (isUnlocked ? '🔓' : '🔒')}</div>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                ${!hasPin 
                  ? 'حماية المرتبات برمز الأمان (PIN) غير مفعلة' 
                  : (isUnlocked ? 'حماية الصفحة: مفتوحة حالياً' : 'الصفحة مقفلة برمز الأمان')}
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.15rem;">
                ${!hasPin 
                  ? 'قم بتعيين رمز PIN مكون من 4 إلى 6 أرقام لمنع أي شخص بجانبك من الاطلاع على مرتبات المساعدين والأرباح.' 
                  : (isUnlocked ? 'يمكنك إخفاء الأرقام بسرعة أو إعادة قفل الصفحة بضغطة زر.' : 'البيانات المالية محمية.')}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            ${!hasPin ? `
              <button class="btn btn-warning" onclick="window.centrlyApp.openSetPinModal()" style="font-weight: 800; display: flex; align-items: center; gap: 0.4rem;">
                <span>🔐</span>
                <span>تعيين رمز PIN الآن</span>
              </button>
            ` : `
              <button class="btn btn-secondary" onclick="window.centrlyApp.toggleHideFinancialNumbers()" style="font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
                <span>${hideNumbers ? getIcon('eye', 16) : getIcon('eyeOff', 16)}</span>
                <span>${hideNumbers ? 'إظهار الأرقام' : 'إخفاء الأرقام'}</span>
              </button>

              <button class="btn btn-secondary" onclick="window.centrlyApp.lockFinancials()" style="font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
                <span>${getIcon('lock', 16)}</span>
                <span>قفل البيانات</span>
              </button>

              <button class="btn btn-secondary" onclick="window.centrlyApp.openSetPinModal()" style="font-size: 0.85rem; font-weight: 700;" title="تغيير رمز PIN">
                <span>⚙️ تغيير PIN</span>
              </button>
            `}
          </div>
        </div>
      </div>

      ${hasPin && !isUnlocked ? `
        <!-- Locked Gate Screen -->
        <div class="card" style="margin: 0; padding: 3rem 1.5rem; text-align: center; background: #fff;">
          <div style="max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
            <div style="width: 64px; height: 64px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 2rem; color: #1d4ed8;">
              🔒
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">بيانات المساعدين والمرتبات مقفلة</h3>
            <p style="font-size: 0.875rem; color: #64748b; margin: 0; line-height: 1.6;">
              لأسباب الأمان والخصوصية، يرجى إدخال رمز الأمان (PIN) لفتح تفاصيل المساعدين ومستحقاتهم المالية.
            </p>
            <button class="btn btn-primary" onclick="window.centrlyApp.promptUnlockFinancials()" style="padding: 0.75rem 2rem; font-size: 0.95rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
              <span>🔑</span>
              <span>إدخال رمز PIN لفتح الصفحة</span>
            </button>
          </div>
        </div>
      ` : `
        <!-- Main Unlocked View -->
        
        <!-- Top Title & Action -->
        <div class="card" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>${getIcon('assistants', 22, 'var(--centrly-blue-700)')}</span>
                <span>إدارة المساعدين والأسستنت (Assistants)</span>
              </h2>
              <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
                تنظيم فريق المساعدين وتحديد المجموعات المسندة إليهم، طبيعة العمل (إداري/تعليمي)، ونظام المحاسبة (بالحصة أم بالشهر).
              </p>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="window.centrlyApp.openAddTeacherAssistantModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
                ${getIcon('add', 16)}
                <span>إضافة مساعد جديد</span>
              </button>
            </div>
          </div>
        </div>

        <!-- KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
            <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي فريق العمل</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
              ${totalAssistants} <span style="font-size: 0.85rem; font-weight: 500;">مساعد</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
              مساعدون إداريون وتعليميون
            </div>
          </div>

          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
            <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي المرتبات الشهرية</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
              ${displayMonthly}
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
              ${monthlyCount} مساعد بنظام المرتب الثابت
            </div>
          </div>

          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
            <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نظام المحاسبة بالحصة</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-amber-700); margin-top: 0.35rem;">
              ${perSessionCount} <span style="font-size: 0.85rem; font-weight: 500;">مساعد</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
              يُحاسبون حسب عدد الحصص المنفذة
            </div>
          </div>
        </div>

        <!-- Assistants Table -->
        <div class="card" style="margin: 0;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('assistants', 18, 'var(--centrly-blue-700)')}
              <span>سجل المساعدين (${assistantList.length})</span>
            </h3>
          </div>

          <div style="overflow-x: auto; margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>اسم المساعد</th>
                  <th>رقم الهاتف</th>
                  <th>المجموعة المسندة</th>
                  <th>طبيعة العمل</th>
                  <th>نظام المحاسبة</th>
                  <th>قيمة الاستحقاق</th>
                  <th>الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${assistantList.length > 0 ? assistantList.map(a => {
                  const assignedGroup = groups.find(g => g.id === a.group_id);
                  const groupLabel = assignedGroup ? assignedGroup.name : 'جميع المجموعات (عام)';
                  
                  let roleBadge = '<span class="badge badge-blue">إداري وتعليمي شامل</span>';
                  if (a.role_type === 'admin') {
                    roleBadge = '<span class="badge badge-secondary">إداري وتنظيمي فقط</span>';
                  } else if (a.role_type === 'educational') {
                    roleBadge = '<span class="badge badge-warning">تعليمي وشرح فقط</span>';
                  }

                  const isPerSession = a.salary_model === 'per_session';
                  const modelBadge = isPerSession 
                    ? '<span class="badge badge-amber">بالحصة</span>' 
                    : '<span class="badge badge-success">بالشهر</span>';

                  const salaryVal = Number(a.salary_amount) || 0;
                  const salaryDisplay = hideNumbers 
                    ? '••••••' 
                    : `${salaryVal.toLocaleString('ar-EG')} ج.م ${isPerSession ? '/ حصة' : '/ شهر'}`;

                  const phoneClean = (a.phone || '').replace(/[^0-9]/g, '');
                  const waUrl = phoneClean ? `https://wa.me/2${phoneClean}` : null;

                  return `
                    <tr>
                      <td style="font-weight: 800; color: #0f172a;">
                        ${escapeHtml(a.name)}
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 0.4rem;">
                          <span>${escapeHtml(a.phone || '—')}</span>
                          ${waUrl ? `
                            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" title="مراسلة واتساب"
                              style="color: #25d366; display: inline-flex; align-items: center;">
                              ${getIcon('whatsapp', 16)}
                            </a>
                          ` : ''}
                        </div>
                      </td>
                      <td>
                        <span class="badge ${assignedGroup ? 'badge-blue' : 'badge-secondary'}">
                          ${escapeHtml(groupLabel)}
                        </span>
                      </td>
                      <td>
                        ${roleBadge}
                      </td>
                      <td>
                        ${modelBadge}
                      </td>
                      <td style="font-weight: 800; color: #1d4ed8; font-family: monospace;">
                        ${salaryDisplay}
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                          <button class="btn btn-sm btn-secondary" onclick="window.centrlyApp.openEditTeacherAssistantModal('${a.id}')" title="تعديل">
                            ${getIcon('edit', 14)}
                          </button>
                          <button class="btn btn-sm btn-danger" onclick="window.centrlyApp.deleteTeacherAssistant('${a.id}', '${escapeHtml(a.name)}')" title="حذف">
                            ${getIcon('delete', 14)}
                          </button>
                        </div>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
                      <div style="font-size: 2rem; margin-bottom: 0.5rem;">👥</div>
                      لم يتم إضافة مساعدين بعد.<br>
                      اضغط على زر <b>"إضافة مساعد جديد"</b> لتسجيل أفراد فريقك وتحديد أدوارهم.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      `}
    </div>
  `;
}
