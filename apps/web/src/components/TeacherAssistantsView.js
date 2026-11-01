import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";
import { renderAssistantPayFields, updateAssistantPayFields, readAssistantPayFields } from "./AssistantPayFields.js";
import { renderAssistantAccessFields, readAssistantAccessFields } from "./AssistantAccessFields.js";
import { assistantPay } from "../utils/assistantPay.js";

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
  const dailyCount = assistantList.filter(a => a.salary_model === 'per_day').length;
  const monthlyCount = assistantList.filter(a => a.salary_model === 'monthly' || !a.salary_model).length;

  const paySummary = assistantList.filter(a => a.status === 'active').map(a => assistantPay(a));
  const totalMonthlySalaries = paySummary.reduce((sum, p) => sum + p.amount, 0);
  const displayMonthly = hideNumbers ? '••••••' : paySummary.some(p => !p.available) ? 'غير متاح حاليًا' : `${totalMonthlySalaries.toLocaleString('ar-EG')} ج.م`;

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
        
        <!-- Top Title & Action (Swiss Minimalist) -->
        <div class="card" style="margin: 0; padding: 0.85rem 1.15rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                <h2 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a;">
                  إدارة المساعدين والأسستنت
                </h2>
                <span style="font-size: 0.72rem; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                  ${totalAssistants} مساعد
                </span>
              </div>
              <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #64748b;">
                تنظيم فريق المساعدين وتحديد المجموعات المسندة إليهم ونظام المحاسبة
              </p>
            </div>

            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="window.centrlyApp.openAddTeacherAssistantModal()" style="min-height: 44px; font-size: 0.85rem; font-weight: 700;">
                ${getIcon('add', 14, '#ffffff')}
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
            <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">المستحقات المتوقعة لهذا الشهر</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
              ${displayMonthly}
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
              ${monthlyCount} شهري · ${dailyCount} يومي تلقائي · ${perSessionCount} بالحصة
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
                  const groupLabel = a.access ? a.access.all_groups ? 'كل المجموعات' : `${a.access.group_ids.length} مجموعة محددة` : assignedGroup ? assignedGroup.name : 'جميع المجموعات (عام)';
                  
                  let roleBadge = '<span class="badge badge-blue">إداري وتعليمي شامل</span>';
                  if (a.role_type === 'admin') {
                    roleBadge = '<span class="badge badge-secondary">إداري وتنظيمي فقط</span>';
                  } else if (a.role_type === 'educational') {
                    roleBadge = '<span class="badge badge-warning">تعليمي وشرح فقط</span>';
                  }

                  const isPerSession = a.salary_model === 'per_session';
                  const payInfo = assistantPay(a);
                  const modelBadge = `<span class="badge badge-secondary">${payInfo.modelLabel}</span>`;

                  const salaryVal = Number(a.salary ?? a.salary_amount) || 0;
                  const salaryDisplay = hideNumbers 
                    ? '••••••' 
                    : `${salaryVal.toLocaleString('ar-EG')} ج.م ${a.salary_model === 'per_day' ? '/ يوم' : isPerSession ? '/ حصة' : '/ شهر'}`;

                  const phoneClean = (a.phone || '').replace(/[^0-9]/g, '');
                  const waUrl = phoneClean ? `https://wa.me/2${phoneClean}` : null;

                  return `
                    <tr>
                      <td style="font-weight: 800; color: #0f172a;">
                        ${escapeHtml(a.name)}
                        <div style="font-weight:400;font-size:.8rem;margin-top:.35rem;color:var(--centrly-text)">${a.access ? a.status === 'inactive' ? 'الوصول متوقف' : a.status === 'active' ? 'حساب مستقل' : a.invitation?.delivery_status === 'sent' ? 'دعوة مرسلة — بانتظار القبول' : a.invitation?.delivery_status === 'blocked' ? 'الدعوة محفوظة — واتساب متوقف' : 'دعوة محفوظة لم يكتمل إرسالها' : 'سجل قديم — لم يُربط بحساب مستقل'}</div>
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
                        <div style="font:normal .8rem/1.7 inherit;color:var(--centrly-text);margin-top:.35rem">${escapeHtml(payInfo.basis)}</div>
                        <div style="font-size:.85rem;margin-top:.25rem">${hideNumbers ? '••••••' : payInfo.available ? `${payInfo.amount.toLocaleString('ar-EG')} ج.م للشهر` : 'غير متاح حاليًا'}</div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                          <button class="btn btn-sm btn-secondary" onclick="window.centrlyApp.openEditTeacherAssistantModal('${a.id}')" title="تعديل" style="min-width:44px;min-height:44px">
                            ${getIcon('edit', 14)}
                          </button>
                          <button class="btn btn-sm btn-secondary" onclick="window.centrlyApp.prepareAssistantInvitation('${a.id}')" style="min-height:44px" title="${a.access ? 'إعادة دعوة' : 'ربط بحساب مستقل'}">${a.access ? 'إعادة دعوة' : 'دعوة'}</button>
                          ${a.access && a.assistant_login_url ? `<a class="btn btn-sm btn-secondary" href="${escapeHtml(a.assistant_login_url)}" target="_blank" rel="noopener noreferrer" style="min-height:44px">رابط الدخول</a>` : ''}
                          <button class="btn btn-sm btn-danger" onclick="window.centrlyApp.deleteTeacherAssistant('${a.id}')" title="حذف" style="min-width:44px;min-height:44px">
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
  app.updateTeacherAssistantPayFields = updateAssistantPayFields;
  app.prepareAssistantInvitation = function(id) {
    const assistant=(this.teacherAssistants || []).find(a=>a.id===id);
    if(!assistant) return;
    const body=`<p style="line-height:1.7">إرسال دعوة إلى ${escapeHtml(assistant.name)} على <span dir="ltr">${escapeHtml(assistant.phone || '')}</span>. سيسجل المساعد اسمه وكلمة مرور خاصة بهذا المدرس. الدعوة الجديدة تلغي روابط الدعوات السابقة وتحافظ على الأجر المسجل. عند قبولها، تنتهي جلسات الدخول القديمة.</p><form id="assistantReinviteForm" onsubmit="window.centrlyApp.sendAssistantReinvitation(event,'${id}')">${renderAssistantAccessFields('reinvite',this.groups || [],assistant.access || {})}</form>`;
    this.showModal('دعوة المساعد',body,`<button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button><button class="btn btn-primary" type="submit" form="assistantReinviteForm">حفظ الدعوة وإرسالها</button>`);
  };
  app.sendAssistantReinvitation = async function(event,id) {
    event.preventDefault();
    const a=(this.teacherAssistants || []).find(a=>a.id===id);if(!a)return;
    try {
      const access=readAssistantAccessFields('reinvite');
      const result=await request('/assistants/invitations',{method:'POST',body:{assistant_id:id,phone:a.phone,...access,salary_model:a.salary_model || 'monthly',salary:a.salary || 0,work_weekdays:a.work_weekdays || [],pay_start_date:a.pay_start_date || null}});
      this.closeModal();this.showToast(result.message,result.delivery_status==='sent'?'success':'warning');await this.loadRouteData('assistants');
    } catch(error){this.showToast(error.message || 'تعذر حفظ الدعوة','danger');}
  };
  app.openAddTeacherAssistantModal = function() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddTeacherAssistantForm" onsubmit="window.centrlyApp.handleAddTeacherAssistantSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم الهاتف (للتواصل والواتساب) *</label>
          <input type="tel" id="modalTA_Phone" class="form-input" placeholder="010..." dir="ltr" required>
        </div>

        ${renderAssistantAccessFields("modalTA", this.groups || [])}
        ${renderAssistantPayFields("modalTA")}
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddTeacherAssistantForm" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">حفظ الدعوة وإرسالها على واتساب</button>
    `;
    this.showModal('دعوة مساعد إلى فريقك', bodyHtml, footerHtml);
  };

  app.handleAddTeacherAssistantSubmit = async function(e) {
    e.preventDefault();
    const phone = document.getElementById('modalTA_Phone')?.value.trim();
    const group_id = document.getElementById('modalTA_GroupId')?.value || null;
    const role_type = document.getElementById('modalTA_RoleType')?.value || 'both';
    const salary_model = document.getElementById('modalTA_SalaryModel')?.value || 'monthly';
    const salary_amount = parseFloat(document.getElementById('modalTA_SalaryAmount')?.value) || 0;

    if (!phone) {
      this.showToast('يرجى كتابة رقم واتساب المساعد', 'error');
      return;
    }

    try {
      const pay = readAssistantPayFields('modalTA');
      const access = readAssistantAccessFields('modalTA');
      const result = await request('/assistants/invitations', {
        method: 'POST',
        body: {
          phone,
          group_id: group_id || null,
          role_type,
          salary_model,
          salary: salary_amount,
          salary_amount,
          ...pay,
          ...access,
        },
      });
      this.closeModal();
      this.showToast(result.message, result.delivery_status === 'sent' ? 'success' : 'warning');
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
        ${assistant.access ? `
          <p style="line-height:1.7">${escapeHtml(assistant.name)} · <span dir="ltr">${escapeHtml(assistant.phone || '')}</span><br>المساعد يحدد اسمه وكلمة مروره عند قبول الدعوة.</p>
          <label for="modalEditTA_Status" class="form-label">حالة الوصول</label>
          <select id="modalEditTA_Status" class="form-select" style="min-height:44px;margin-bottom:1rem">
            <option value="active" ${assistant.status==='active'?'selected':''}>نشط</option>
            <option value="invited" ${assistant.status==='invited'?'selected':''}>بانتظار قبول الدعوة</option>
            <option value="inactive" ${assistant.status==='inactive'?'selected':''}>إيقاف الوصول</option>
          </select>
          ${renderAssistantAccessFields('modalEditTA', this.groups || [], assistant.access)}
        ` : `
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

        `}
        ${renderAssistantPayFields("modalEditTA", assistant)}
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
      const pay = readAssistantPayFields('modalEditTA');
      const assistant = (this.teacherAssistants || []).find(a => a.id === assistantId);
      const access = assistant?.access ? readAssistantAccessFields('modalEditTA') : {};
      const status = assistant?.access ? document.getElementById('modalEditTA_Status').value : undefined;
      await request(assistant?.access ? `/assistants/${assistantId}/access` : `/assistants/${assistantId}`, {
        method: 'PUT',
        body: {
          name,
          phone,
          group_id: group_id || null,
          role_type,
          salary_model,
          salary: salary_amount,
          salary_amount,
          ...pay,
          ...access,
          status,
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
    name = (this.teacherAssistants || []).find(a=>a.id===id)?.name || 'المساعد';
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('trash', 40, '#ef4444')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">تأكيد حذف المساعد</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          هل أنت متأكد من حذف المساعد <strong>"${escapeHtml(name)}"</strong> من قائمة فريقك؟
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;" onclick="window.centrlyApp.confirmDeleteTeacherAssistant('${id}')">
            حذف نهائي
          </button>
        </div>
      </div>
    `;
    this.showModal('حذف مساعد', bodyHtml);
  };

  app.confirmDeleteTeacherAssistant = async function(id, name) {
    name = (this.teacherAssistants || []).find(a=>a.id===id)?.name || 'المساعد';
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
