import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";

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
    .reduce((sum, a) => sum + (Number(a.salary ?? a.salary_amount) || 0), 0);

  const displayMonthly = hideNumbers ? '••••••' : `${totalMonthlySalaries.toLocaleString('ar-EG')} ج.م`;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Security PIN Banner / Status Bar -->
      <div class="card" style="margin: 0; background: ${!hasPin ? '#fffbeb' : '#f8fafc'}; border: 1px solid ${!hasPin ? '#fde68a' : '#e2e8f0'}; padding: 1rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="display: flex; align-items: center;">${!hasPin ? getIcon('alertTriangle', 22, '#d97706') : (isUnlocked ? getIcon('lock', 22, '#10b981') : getIcon('lock', 22, '#64748b'))}</div>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                ${!hasPin 
                  ? 'حماية المرتبات برمز الأمان (PIN) غير مفعلة' 
                  : (isUnlocked ? 'حماية الصفحة: مفتوحة حالياً' : 'الصفحة مقفلة برمز الأمان')}
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.15rem;">
                ${!hasPin 
                  ? 'قم بتعيين رمز PIN مكون من 4 إلى 6 أرقام لمنع أي شخص بجانبك من الاطلاع على مرتبات المساعدين والأرباح.' 
                  : (isUnlocked ? 'تُقفل الصفحة تلقائياً بمجرد الانتقال لأي صفحة أخرى، ويمكنك إخفاء الأرقام أو قفلها بضغطة زر.' : 'البيانات المالية محمية برمز الأمان.')}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            ${!hasPin ? `
              <button class="btn btn-warning" onclick="window.centrlyApp.openSetPinModal()" style="font-weight: 800; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('lock', 16)}
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

              <button class="btn btn-secondary" onclick="window.centrlyApp.openSetPinModal()" style="font-size: 0.85rem; font-weight: 700; display: flex; align-items: center; gap: 0.35rem;" title="تغيير رمز PIN">
                ${getIcon('edit', 14)}
                <span>تغيير PIN</span>
              </button>
            `}
          </div>
        </div>
      </div>

      ${hasPin && !isUnlocked ? `
        <!-- Locked Gate Screen -->
        <div class="card" style="margin: 0; padding: 3rem 1.5rem; text-align: center; background: #fff;">
          <div style="max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 1rem;">
            <div style="width: 64px; height: 64px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1d4ed8;">
              ${getIcon('lock', 32, '#1d4ed8')}
            </div>
            <h3 style="font-size: 1.25rem; font-weight: 800; color: #0f172a; margin: 0;">بيانات المساعدين والمرتبات مقفلة</h3>
            <p style="font-size: 0.875rem; color: #64748b; margin: 0; line-height: 1.6;">
              لأسباب الأمان والخصوصية، يرجى إدخال رمز الأمان (PIN) لفتح تفاصيل المساعدين ومستحقاتهم المالية.
            </p>
            <button class="btn btn-primary" onclick="window.centrlyApp.promptUnlockFinancials()" style="padding: 0.75rem 2rem; font-size: 0.95rem; font-weight: 800; display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
              ${getIcon('lock', 16)}
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

                  const salaryVal = Number(a.salary ?? a.salary_amount) || 0;
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
                      <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('assistants', 32, '#94a3b8')}</div>
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

export function registerTeacherAssistantsActions(app) {
  app.openAddTeacherAssistantModal = function() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddTeacherAssistantForm" onsubmit="window.centrlyApp.handleAddTeacherAssistantSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المساعد (الأسستنت) *</label>
          <input type="text" id="modalTA_Name" class="form-input" placeholder="اسم المساعد" required>
        </div>

        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم الهاتف (للتواصل والواتساب) *</label>
          <input type="tel" id="modalTA_Phone" class="form-input" placeholder="010..." dir="ltr" required>
        </div>

        <div class="modal-form-grid">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">المجموعة المسندة</label>
            <select id="modalTA_GroupId" class="form-select">
              <option value="">جميع المجموعات (مسؤول عام)</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">طبيعة الدور والعمل *</label>
            <select id="modalTA_RoleType" class="form-select">
              <option value="both">إداري وتعليمي شامل</option>
              <option value="admin">إداري وتنظيمي فقط (حضور وكروت)</option>
              <option value="educational">تعليمي وتدريسي فقط (شرح ومتابعة)</option>
            </select>
          </div>
        </div>

        <div class="modal-form-grid" style="margin-bottom: 1.25rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">نظام المحاسبة *</label>
            <select id="modalTA_SalaryModel" class="form-select" onchange="document.getElementById('modalTA_SalaryLabel').innerText = (this.value === 'per_session' ? 'أجر الحصة الواحدة (ج.م)' : 'المرتب الشهري الثابت (ج.م)')">
              <option value="monthly">مرتب شهري ثابت</option>
              <option value="per_session">أجر بالحصة الواحدة</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" id="modalTA_SalaryLabel" style="font-weight: 700;">المرتب الشهري الثابت (ج.م)</label>
            <input type="number" id="modalTA_SalaryAmount" class="form-input" placeholder="0" min="0" value="0">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddTeacherAssistantForm" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">إضافة المساعد الآن</button>
    `;
    this.showModal('إضافة مساعد (أسستنت) جديد للمعلم', bodyHtml, footerHtml);
  };

  app.handleAddTeacherAssistantSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('modalTA_Name')?.value.trim();
    const phone = document.getElementById('modalTA_Phone')?.value.trim();
    const group_id = document.getElementById('modalTA_GroupId')?.value || null;
    const role_type = document.getElementById('modalTA_RoleType')?.value || 'both';
    const salary_model = document.getElementById('modalTA_SalaryModel')?.value || 'monthly';
    const salary_amount = parseFloat(document.getElementById('modalTA_SalaryAmount')?.value) || 0;

    if (!name || !phone) {
      this.showToast('يرجى كتابة اسم المساعد ورقم هاتفه', 'error');
      return;
    }

    try {
      await request('/assistants', {
        method: 'POST',
        body: {
          name,
          phone,
          group_id: group_id || null,
          role_type,
          salary_model,
          salary: salary_amount,
          salary_amount,
        },
      });
      this.closeModal();
      this.showToast(`تمت إضافة المساعد (${name}) بنجاح!`, 'success');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  };

  app.openEditTeacherAssistantModal = function(assistantId) {
    const assistant = (this.teacherAssistants || []).find(a => a.id === assistantId);
    if (!assistant) return;

    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}" ${assistant.group_id === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalEditTeacherAssistantForm" onsubmit="window.centrlyApp.handleEditTeacherAssistantSubmit(event, '${assistantId}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المساعد (الأسستنت) *</label>
          <input type="text" id="modalEditTA_Name" class="form-input" value="${escapeHtml(assistant.name)}" required>
        </div>

        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم الهاتف *</label>
          <input type="tel" id="modalEditTA_Phone" class="form-input" value="${escapeHtml(assistant.phone || '')}" dir="ltr" required>
        </div>

        <div class="modal-form-grid">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">المجموعة المسندة</label>
            <select id="modalEditTA_GroupId" class="form-select">
              <option value="" ${!assistant.group_id ? 'selected' : ''}>جميع المجموعات (مسؤول عام)</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">طبيعة الدور والعمل *</label>
            <select id="modalEditTA_RoleType" class="form-select">
              <option value="both" ${assistant.role_type === 'both' ? 'selected' : ''}>إداري وتعليمي شامل</option>
              <option value="admin" ${assistant.role_type === 'admin' ? 'selected' : ''}>إداري وتنظيمي فقط</option>
              <option value="educational" ${assistant.role_type === 'educational' ? 'selected' : ''}>تعليمي وتدريسي فقط</option>
            </select>
          </div>
        </div>

        <div class="modal-form-grid" style="margin-bottom: 1.25rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">نظام المحاسبة *</label>
            <select id="modalEditTA_SalaryModel" class="form-select" onchange="document.getElementById('modalEditTA_SalaryLabel').innerText = (this.value === 'per_session' ? 'أجر الحصة الواحدة (ج.م)' : 'المرتب الشهري الثابت (ج.م)')">
              <option value="monthly" ${assistant.salary_model === 'monthly' ? 'selected' : ''}>مرتب شهري ثابت</option>
              <option value="per_session" ${assistant.salary_model === 'per_session' ? 'selected' : ''}>أجر بالحصة الواحدة</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" id="modalEditTA_SalaryLabel" style="font-weight: 700;">
              ${assistant.salary_model === 'per_session' ? 'أجر الحصة الواحدة (ج.م)' : 'المرتب الشهري الثابت (ج.م)'}
            </label>
            <input type="number" id="modalEditTA_SalaryAmount" class="form-input" value="${Number(assistant.salary ?? assistant.salary_amount) || 0}" min="0">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalEditTeacherAssistantForm" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">حفظ التعديلات</button>
    `;
    this.showModal(`تعديل بيانات المساعد: ${escapeHtml(assistant.name)}`, bodyHtml, footerHtml);
  };

  app.handleEditTeacherAssistantSubmit = async function(e, assistantId) {
    e.preventDefault();
    const name = document.getElementById('modalEditTA_Name')?.value.trim();
    const phone = document.getElementById('modalEditTA_Phone')?.value.trim();
    const group_id = document.getElementById('modalEditTA_GroupId')?.value || null;
    const role_type = document.getElementById('modalEditTA_RoleType')?.value || 'both';
    const salary_model = document.getElementById('modalEditTA_SalaryModel')?.value || 'monthly';
    const salary_amount = parseFloat(document.getElementById('modalEditTA_SalaryAmount')?.value) || 0;

    try {
      await request(`/assistants/${assistantId}`, {
        method: 'PUT',
        body: {
          name,
          phone,
          group_id: group_id || null,
          role_type,
          salary_model,
          salary: salary_amount,
          salary_amount,
        },
      });
      this.closeModal();
      this.showToast('تم حفظ تعديلات المساعد بنجاح!', 'success');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`فشل تعديل بيانات المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  };

  app.deleteTeacherAssistant = function(id, name) {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('trash', 40, '#ef4444')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">تأكيد حذف المساعد</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          هل أنت متأكد من حذف المساعد <strong>"${escapeHtml(name)}"</strong> من قائمة فريقك؟
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;" onclick="window.centrlyApp.confirmDeleteTeacherAssistant('${id}', '${escapeHtml(name)}')">
            حذف نهائي
          </button>
        </div>
      </div>
    `;
    this.showModal('حذف مساعد', bodyHtml);
  };

  app.confirmDeleteTeacherAssistant = async function(id, name) {
    this.closeModal();
    try {
      await request(`/assistants/${id}`, { method: 'DELETE' });
      this.showToast(`تم حذف المساعد (${name}) بنجاح`, 'success');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`فشل حذف المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  };
}
