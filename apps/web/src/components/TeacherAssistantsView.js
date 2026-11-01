import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";
import { renderAssistantPayFields, updateAssistantPayFields, readAssistantPayFields } from "./AssistantPayFields.js";
import { renderAssistantAccessFields, readAssistantAccessFields } from "./AssistantAccessFields.js?v=3";
import { registerAssistantActivityActions } from "./AssistantActivityView.js?v=3";
import { assistantInvitationStatus } from "../utils/assistantInvitation.js";
import {registerCollectionOwnerActions} from "./CollectionLedger.js";
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
  const salaryLocked = hasPin && !isUnlocked;
  const concealPay = salaryLocked || hideNumbers;

  // Compute stats
  const totalAssistants = assistantList.length;
  const perSessionCount = assistantList.filter(a => a.salary_model === 'per_session').length;
  const dailyCount = assistantList.filter(a => a.salary_model === 'per_day').length;
  const monthlyCount = assistantList.filter(a => a.salary_model === 'monthly' || !a.salary_model).length;

  const paySummary = assistantList.filter(a => a.status === 'active').map(a => assistantPay(a));
  const totalMonthlySalaries = paySummary.reduce((sum, p) => sum + p.amount, 0);
  const displayMonthly = concealPay ? '••••••' : paySummary.some(p => !p.available) ? 'غير متاح حاليًا' : `${totalMonthlySalaries.toLocaleString('ar-EG')} ج.م`;

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
                  : (isUnlocked ? 'المرتبات مفتوحة حاليًا' : 'المرتبات مقفلة برمز الأمان')}
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.15rem;">
                ${!hasPin 
                  ? 'قم بتعيين رمز PIN مكون من 4 إلى 6 أرقام لمنع أي شخص بجانبك من الاطلاع على مرتبات المساعدين والأرباح.' 
                  : (isUnlocked ? 'تُقفل المرتبات تلقائيًا عند الانتقال لصفحة أخرى. إدارة الفريق والصلاحيات تظل متاحة.' : 'البيانات المالية محمية برمز الأمان.')}
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

      ${salaryLocked ? `<div class="card" style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:.75rem;padding:1rem"><p style="margin:0">المرتبات محمية. تقدر تدير الصلاحيات وتراجع نشاط الفريق.</p><button class="btn btn-primary" style="min-height:44px" onclick="window.centrlyApp.promptUnlockFinancials()">فتح المرتبات</button></div>` : ''}
        <!-- Team controls stay available while pay is concealed -->
        
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
              <button class="btn btn-secondary" onclick="window.centrlyApp.openAddTeacherAssistantModal(true)" style="min-height:44px">إضافة سجل بدون دعوة</button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openCollectionLedger()" style="min-height:44px">سجل التحصيل</button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openAssistantActivityLog()" style="min-height:44px">نشاط الفريق</button>
              <button class="btn btn-primary" onclick="window.centrlyApp.openAddTeacherAssistantModal()" style="min-height: 44px; font-size: 0.85rem; font-weight: 700;">
                ${getIcon('add', 14, '#ffffff')}
                <span>دعوة مساعد</span>
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
                  if (a.access) roleBadge = '<span class="badge badge-secondary">صلاحيات محددة</span>';

                  const isPerSession = a.salary_model === 'per_session';
                  const payInfo = assistantPay(a);
                  const modelBadge = `<span class="badge badge-secondary">${payInfo.modelLabel}</span>`;

                  const salaryVal = Number(a.salary ?? a.salary_amount) || 0;
                  const salaryDisplay = concealPay
                    ? '••••••' 
                    : `${salaryVal.toLocaleString('ar-EG')} ج.م ${a.salary_model === 'per_day' ? '/ يوم' : isPerSession ? '/ حصة' : '/ شهر'}`;

                  const phoneClean = (a.phone || '').replace(/[^0-9]/g, '');
                  const waUrl = phoneClean ? `https://wa.me/${phoneClean.startsWith('0') ? '2' + phoneClean : phoneClean}` : null;

                  return `
                    <tr>
                      <td style="font-weight: 800; color: #0f172a;">
                        ${escapeHtml(a.name)}
                        <div style="font-weight:400;font-size:.8rem;margin-top:.35rem;color:var(--centrly-text)">${escapeHtml(assistantInvitationStatus(a))}</div>
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
                        ${concealPay ? '' : `<div style="font-size:.8rem;line-height:1.7;font-weight:400;color:var(--centrly-text);margin-top:.35rem">${escapeHtml(payInfo.basis)}</div>`}
                        <div style="font-size:.85rem;margin-top:.25rem">${concealPay ? 'الأجر محمي' : payInfo.available ? `${payInfo.amount.toLocaleString('ar-EG')} ج.م للشهر` : 'غير متاح حاليًا'}</div>
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
                      اضغط على <b>"دعوة مساعد"</b> وحدد رقم واتساب وصلاحياته. سيكمل اسمه وكلمة مروره بنفسه.
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

export function registerTeacherAssistantsActions(app) {
  registerAssistantActivityActions(app);
  registerCollectionOwnerActions(app);
  const payVisible=()=> (!app.hasSecurityPin || app.isFinancialUnlocked) && !app.hideFinancialNumbers;
  app.updateTeacherAssistantPayFields = updateAssistantPayFields;
  const beginSave=event=>{const form=event.currentTarget;if(form.dataset.saving)return null;form.dataset.saving='true';const buttons=[...form.elements].filter(el=>el.type==='submit');for(const button of buttons){button.disabled=true;button.dataset.label=button.textContent;button.textContent='جارٍ الحفظ…';}return ()=>{delete form.dataset.saving;for(const button of buttons){button.disabled=false;button.textContent=button.dataset.label;delete button.dataset.label;}};};
  app.prepareAssistantInvitation = function(id) {
    const assistant=(this.teacherAssistants || []).find(a=>a.id===id);
    if(!assistant) return;
    const body=`<p style="line-height:1.7">إرسال دعوة إلى ${escapeHtml(assistant.name)} على <span dir="ltr">${escapeHtml(assistant.phone || '')}</span>. سيسجل المساعد اسمه وكلمة مرور خاصة بهذا المدرس. الدعوة الجديدة تلغي روابط الدعوات السابقة وتحافظ على الأجر المسجل. عند قبولها، تنتهي جلسات الدخول القديمة.</p><form id="assistantReinviteForm" onsubmit="window.centrlyApp.sendAssistantReinvitation(event,'${id}')">${renderAssistantAccessFields('reinvite',this.groups || [],assistant.access || {})}</form>`;
    this.showModal('دعوة المساعد',body,`<button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button><button class="btn btn-primary" type="submit" form="assistantReinviteForm">حفظ الدعوة وإرسالها</button>`);
  };
  app.sendAssistantReinvitation = async function(event,id) {
    event.preventDefault();
    const a=(this.teacherAssistants || []).find(a=>a.id===id);if(!a)return;
    const finish=beginSave(event);if(!finish)return;
    try {
      const access=readAssistantAccessFields('reinvite');
      const result=await request('/assistants/invitations',{method:'POST',body:{assistant_id:id,phone:a.phone,...access}});
      this.closeModal();this.showToast(result.message,result.delivery_status==='sent'?'success':'warning');await this.loadRouteData('assistants');
    } catch(error){this.showToast(error.message || 'تعذر حفظ الدعوة','danger');}finally{finish();}
  };
  app.openAddTeacherAssistantModal = function(recordOnly = false) {
    if (!payVisible()) {
      this.showToast('افتح المرتبات لإعداد أجر المساعد الجديد. إدارة الصلاحيات والنشاط متاحة من الصفحة.', 'info');
      if (this.hasSecurityPin && !this.isFinancialUnlocked) this.promptUnlockFinancials();
      return;
    }
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddTeacherAssistantForm" data-record-only="${recordOnly}" onsubmit="window.centrlyApp.handleAddTeacherAssistantSubmit(event)">
        ${recordOnly ? `<p>احفظ بيانات المساعد وأجره الآن. هذا السجل لا ينشئ حساب دخول ولا يرسل واتساب؛ تقدر تبعت دعوة من السجل لاحقًا.</p><label class="form-label" for="modalTA_Name">اسم المساعد</label><input id="modalTA_Name" class="form-input" maxlength="100" required style="margin-bottom:1rem"><label class="form-label" for="modalTA_GroupId">المجموعة المسندة</label><select id="modalTA_GroupId" class="form-select" style="margin-bottom:1rem"><option value="">جميع المجموعات</option>${groupOptions}</select>` : ''}
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم الهاتف (للتواصل والواتساب) *</label>
          <input type="tel" id="modalTA_Phone" class="form-input" placeholder="010..." dir="ltr" required>
        </div>

        ${recordOnly ? '' : renderAssistantAccessFields("modalTA", this.groups || [])}
        ${renderAssistantPayFields("modalTA")}
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddTeacherAssistantForm" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1rem;min-height:44px">${recordOnly ? 'حفظ السجل' : 'حفظ وإرسال الدعوة'}</button>
    `;
    this.showModal(recordOnly ? 'إضافة سجل مساعد' : 'دعوة مساعد إلى فريقك', bodyHtml, footerHtml);
  };

  app.handleAddTeacherAssistantSubmit = async function(e) {
    e.preventDefault();
    const recordOnly=e.currentTarget.dataset.recordOnly==='true';
    const name=recordOnly?document.getElementById('modalTA_Name')?.value.trim():undefined;
    const phone = document.getElementById('modalTA_Phone')?.value.trim();
    const group_id = document.getElementById('modalTA_GroupId')?.value || null;
    const role_type = document.getElementById('modalTA_RoleType')?.value || 'both';
    const salary_model = document.getElementById('modalTA_SalaryModel')?.value || 'monthly';
    const salary_amount = parseFloat(document.getElementById('modalTA_SalaryAmount')?.value) || 0;

    if (!phone) {
      this.showToast('يرجى كتابة رقم واتساب المساعد', 'error');
      return;
    }

    const finish=beginSave(e);if(!finish)return;
    try {
      const pay = readAssistantPayFields('modalTA');
      if(recordOnly && !name)throw new Error('اكتب اسم المساعد');
      const access = recordOnly ? {} : readAssistantAccessFields('modalTA');
      const result = await request(recordOnly ? '/assistants' : '/assistants/invitations', {
        method: 'POST',
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
        },
      });
      this.closeModal();
      this.showToast(recordOnly ? 'تم حفظ سجل المساعد بدون إرسال دعوة' : result.message, recordOnly || result.delivery_status === 'sent' ? 'success' : 'warning');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }finally{finish();}
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
        ${payVisible() ? renderAssistantPayFields("modalEditTA", assistant) : '<p style="padding:1rem;border:1px solid var(--centrly-line);border-radius:10px">الأجر محمي حاليًا. حفظ الصلاحيات والبيانات هنا لا يغيّر الأجر المسجل.</p>'}
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

    const finish=beginSave(e);if(!finish)return;
    try {
      const pay = payVisible() && document.getElementById('modalEditTA_SalaryModel') ? readAssistantPayFields('modalEditTA') : {};
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
    }finally{finish();}
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
