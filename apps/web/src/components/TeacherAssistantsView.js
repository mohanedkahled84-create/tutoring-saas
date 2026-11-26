import { escapeHtml } from "../utils/escapeHtml.js?v=9.99.7";
import { getIcon } from "../utils/icons.js?v=9.99.7";
import { request } from "../services/api.js?v=9.99.7";
import { renderAssistantPayFields, updateAssistantPayFields, readAssistantPayFields } from "./AssistantPayFields.js?v=9.99.7";
import { renderAssistantAccessFields, readAssistantAccessFields } from "./AssistantAccessFields.js?v=9.99.7";
import { registerAssistantActivityActions } from "./AssistantActivityView.js?v=9.99.7";
import { assistantInvitationStatus } from "../utils/assistantInvitation.js?v=9.99.7";
import {registerFollowupOwnerActions} from './FollowupReports.js?v=9.99.7';
import {registerCollectionOwnerActions} from "./CollectionLedger.js?v=9.99.7";
import { assistantPay } from "../utils/assistantPay.js?v=9.99.7";
import { localize as t } from "../utils/language.js?v=9.99.7";

/**
 * Centrly Teacher Assistants Management Component
 * Allows teachers to manage their assistants, specify:
 * - Assigned Group (or all groups)
 * - Nature of work (إداري / تعليمي / شامل)
 * - Salary model (بالحصة / بالشهر)
 * - Optional visual number masking; access is controlled by account permissions
 */

export function renderTeacherAssistantsView(
  assistants = [],
  groups = [],
  securityState = { hasPin: false, isUnlocked: true, hideNumbers: false }
) {
  const assistantList = assistants || [];
  const { hideNumbers } = securityState;
  const concealPay = !!hideNumbers;
  const numLocale = t('ar-EG', 'en-EG');
  const currency = t('ج.م', 'EGP');

  // Compute stats
  const totalAssistants = assistantList.length;
  const perSessionCount = assistantList.filter(a => a.salary_model === 'per_session').length;
  const dailyCount = assistantList.filter(a => a.salary_model === 'per_day').length;
  const monthlyCount = assistantList.filter(a => a.salary_model === 'monthly' || !a.salary_model).length;

  const paySummary = assistantList.filter(a => a.status !== 'inactive').map(a => assistantPay(a));
  const totalMonthlySalaries = paySummary.reduce((sum, p) => sum + p.amount, 0);
  const displayMonthly = concealPay
    ? '••••••'
    : paySummary.some(p => !p.available)
      ? t('غير متاح حاليًا', 'Currently unavailable')
      : `${totalMonthlySalaries.toLocaleString(numLocale)} ${currency}`;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="${t('rtl', 'ltr')}">
      
        <!-- Team controls stay available while pay is concealed -->
        
        <!-- Top Title & Action (Swiss Minimalist) -->
        <div class="card" style="margin: 0; padding: 0.85rem 1.15rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                <h2 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a;">
                  ${t('إدارة المساعدين والأسستنت', 'Assistants Management')}
                </h2>
                <span style="font-size: 0.72rem; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                  ${totalAssistants} ${t('مساعد', totalAssistants === 1 ? 'assistant' : 'assistants')}
                </span>
              </div>
              <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #64748b;">
                ${t('تنظيم فريق المساعدين وتحديد المجموعات المسندة إليهم ونظام المحاسبة', 'Organize your assistant team, assigned groups, and pay models')}
              </p>
            </div>

            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
              <button class="btn btn-secondary" onclick="window.centrlyApp.openAddTeacherAssistantModal(true)" style="min-height:44px">${t('إضافة سجل بدون دعوة', 'Add record only')}</button>
              <button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.toggleHideFinancialNumbers()">${hideNumbers ? t('إظهار الأرقام', 'Show numbers') : t('إخفاء الأرقام', 'Hide numbers')}</button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openFollowupReports()" style="min-height:44px">${t('متابعة الطلاب وواتساب', 'Student follow-up & WhatsApp')}</button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openCollectionLedger()" style="min-height:44px">${t('سجل التحصيل', 'Collection ledger')}</button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openAssistantActivityLog()" style="min-height:44px">${t('نشاط الفريق', 'Team activity')}</button>
              <button class="btn btn-primary" onclick="window.centrlyApp.openAddTeacherAssistantModal()" style="min-height: 44px; font-size: 0.85rem; font-weight: 700;">
                ${getIcon('add', 14, '#ffffff')}
                <span>${t('دعوة مساعد', 'Invite assistant')}</span>
              </button>
            </div>
          </div>
        </div>

        <!-- KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
            <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">${t('إجمالي فريق العمل', 'Total team size')}</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
              ${totalAssistants} <span style="font-size: 0.85rem; font-weight: 500;">${t('مساعد', totalAssistants === 1 ? 'assistant' : 'assistants')}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
              ${t('مساعدون إداريون وتعليميون', 'Administrative and teaching assistants')}
            </div>
          </div>

          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
            <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">${t('المستحقات المتوقعة لهذا الشهر', 'Expected pay this month')}</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
              ${displayMonthly}
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
              ${t(`${monthlyCount} شهري · ${dailyCount} يومي تلقائي · ${perSessionCount} بالحصة`, `${monthlyCount} monthly · ${dailyCount} auto-daily · ${perSessionCount} per-session`)}
            </div>
          </div>

          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
            <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">${t('نظام المحاسبة بالحصة', 'Per-session pay model')}</div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-amber-700); margin-top: 0.35rem;">
              ${perSessionCount} <span style="font-size: 0.85rem; font-weight: 500;">${t('مساعد', perSessionCount === 1 ? 'assistant' : 'assistants')}</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
              ${t('يُحاسبون حسب عدد الحصص المنفذة', 'Paid per completed session')}
            </div>
          </div>
        </div>

        <!-- Assistants Table -->
        <div class="card" style="margin: 0;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('assistants', 18, 'var(--centrly-blue-700)')}
              <span>${t('سجل المساعدين', 'Assistants directory')} (${assistantList.length})</span>
            </h3>
          </div>

          <div style="overflow-x: auto; margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${t('اسم المساعد', 'Assistant name')}</th>
                  <th>${t('رقم الهاتف', 'Phone number')}</th>
                  <th>${t('المجموعة المسندة', 'Assigned group')}</th>
                  <th>${t('طبيعة العمل', 'Role')}</th>
                  <th>${t('نظام المحاسبة', 'Pay model')}</th>
                  <th>${t('قيمة الاستحقاق', 'Pay details')}</th>
                  <th>${t('الإجراءات', 'Actions')}</th>
                </tr>
              </thead>
              <tbody>
                ${assistantList.length > 0 ? assistantList.map(a => {
                  const assignedGroup = groups.find(g => g.id === a.group_id);
                  const groupLabel = a.access
                    ? (a.access.all_groups
                        ? t('كل المجموعات', 'All groups')
                        : t(`${a.access.group_ids.length} مجموعة محددة`, `${a.access.group_ids.length} selected group(s)`))
                    : assignedGroup
                      ? assignedGroup.name
                      : t('جميع المجموعات (عام)', 'All groups (general)');
                  
                  let roleBadge = `<span class="badge badge-blue">${t('إداري وتعليمي شامل', 'Admin & teaching')}</span>`;
                  if (a.role_type === 'admin') {
                    roleBadge = `<span class="badge badge-secondary">${t('إداري وتنظيمي فقط', 'Admin only')}</span>`;
                  } else if (a.role_type === 'educational') {
                    roleBadge = `<span class="badge badge-warning">${t('تعليمي وشرح فقط', 'Teaching only')}</span>`;
                  }
                  if (a.access) roleBadge = `<span class="badge badge-secondary">${t('صلاحيات محددة', 'Custom permissions')}</span>`;

                  const isPerSession = a.salary_model === 'per_session';
                  const payInfo = assistantPay(a);
                  const modelBadge = `<span class="badge badge-secondary">${payInfo.modelLabel}</span>`;

                  const salaryVal = Number(a.salary ?? a.salary_amount) || 0;
                  const salaryDisplay = concealPay
                    ? '••••••' 
                    : `${salaryVal.toLocaleString(numLocale)} ${currency} ${a.salary_model === 'per_day' ? t('/ يوم', '/ day') : isPerSession ? t('/ حصة', '/ session') : t('/ شهر', '/ month')}`;

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
                          <span dir="ltr">${escapeHtml(a.phone || '—')}</span>
                          ${waUrl ? `
                            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" title="${t('مراسلة واتساب', 'Message on WhatsApp')}"
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
                      <td style="font-weight:800;color:#1d4ed8;min-width:175px;line-height:1.7;">
                        ${salaryDisplay}
                        ${concealPay ? '' : `<div style="font-size:.8rem;line-height:1.7;font-weight:400;color:var(--centrly-text);margin-top:.35rem">${escapeHtml(payInfo.basis)}</div>`}
                        <div style="font-size:.85rem;margin-top:.25rem;white-space:nowrap">${concealPay ? t('الأجر محمي', 'Pay protected') : payInfo.available ? `${payInfo.amount.toLocaleString(numLocale)} ${t('ج.م للشهر', 'EGP / month')}` : t('غير متاح حاليًا', 'Currently unavailable')}</div>
                      </td>
                      <td>
                        <div style="display: flex; align-items: center; gap: 0.35rem;">
                          <button class="btn btn-sm btn-secondary" onclick="window.centrlyApp.openEditTeacherAssistantModal('${a.id}')" title="${t('تعديل', 'Edit')}" style="min-width:44px;min-height:44px">
                            ${getIcon('edit', 14)}
                          </button>
                          <button class="btn btn-sm btn-secondary" onclick="window.centrlyApp.prepareAssistantInvitation('${a.id}')" style="min-height:44px" title="${a.access ? t('إعادة دعوة', 'Re-invite') : t('ربط بحساب مستقل', 'Link independent account')}">${a.access ? t('إعادة دعوة', 'Re-invite') : t('دعوة', 'Invite')}</button>
                          ${a.access && a.status!=='inactive' ? `<button class="btn btn-sm btn-secondary" style="min-height:44px" onclick="window.centrlyApp.getAssistantRegistrationLink('${a.id}')">${a.status==='invited' ? t('رابط إنشاء الحساب', 'Setup link') : t('رابط استعادة الحساب', 'Recovery link')}</button>` : ''}
                          ${a.access && a.assistant_login_url ? `<a class="btn btn-sm btn-secondary" href="${escapeHtml(a.assistant_login_url)}" target="_blank" rel="noopener noreferrer" style="min-height:44px">${t('رابط الدخول', 'Login link')}</a>` : ''}
                          <button class="btn btn-sm btn-danger" onclick="window.centrlyApp.deleteTeacherAssistant('${a.id}')" title="${t('حذف', 'Delete')}" style="min-width:44px;min-height:44px">
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
                      ${t('لم يتم إضافة مساعدين بعد.<br>اضغط على <b>"دعوة مساعد"</b> وحدد رقم واتساب وصلاحياته. سيكمل اسمه وكلمة مروره بنفسه.', 'No assistants added yet.<br>Click <b>"Invite assistant"</b> and set their WhatsApp number and permissions. They will complete their name and password on their own.')}
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
  registerFollowupOwnerActions(app);
  app.showAssistantRegistrationLink = function(result) {
    if(!result.registration_url)return;
    const channelText = result.otp_channel==='sms'
      ? t('يصل في رسالة SMS', 'sent via SMS')
      : result.otp_channel==='whatsapp'
        ? t('يصل على واتساب', 'sent via WhatsApp')
        : t('يصل على رقمه', 'sent to their number');
    this.showModal(
      t('رابط حساب المساعد', 'Assistant account link'),
      `<div dir="${t('rtl', 'ltr')}"><p>${t(`الرابط خاص بالرقم <span dir="ltr">${escapeHtml(result.phone || '')}</span>. يؤكد المساعد رقمه بكود ${channelText}، ثم يكمل اسمه وكلمة مروره. أي رابط تسجيل سابق لم يعد صالحًا.`, `This link is tied to <span dir="ltr">${escapeHtml(result.phone || '')}</span>. The assistant verifies their phone with a code ${channelText}, then sets their name and password. Any previous registration link is now invalid.`)}</p><label for="assistant-registration-link">${t('رابط التسجيل', 'Registration link')}</label><input id="assistant-registration-link" class="form-input" dir="ltr" readonly value="${escapeHtml(result.registration_url)}" style="width:100%;min-height:48px"><p style="margin-top:1rem"><a class="btn btn-primary" style="min-height:44px" href="${escapeHtml(result.registration_whatsapp_url)}" target="_blank" rel="noopener noreferrer">${t('فتح واتساب لإرسال الرابط', 'Open WhatsApp to send link')}</a></p></div>`,
      ''
    );
    const input=document.getElementById('assistant-registration-link');if(input)input.onclick=()=>input.select();
  };
  app.getAssistantRegistrationLink = async function(id) {
    try{const result=await request(`/assistants/${id}/registration-link`,{method:'POST',body:{}});this.showAssistantRegistrationLink(result);}catch(error){this.showToast(error.message || t('تعذر تجهيز الرابط', 'Failed to prepare registration link'),'danger');}
  };
  const payVisible=()=> !app.hideFinancialNumbers;
  app.updateTeacherAssistantPayFields = updateAssistantPayFields;
  const beginSave=event=>{const form=event.currentTarget;if(form.dataset.saving)return null;form.dataset.saving='true';const buttons=[...form.elements].filter(el=>el.type==='submit');for(const button of buttons){button.disabled=true;button.dataset.label=button.textContent;button.textContent=t('جارٍ الحفظ…', 'Saving…');}return ()=>{delete form.dataset.saving;for(const button of buttons){button.disabled=false;button.textContent=button.dataset.label;delete button.dataset.label;}};};
  app.prepareAssistantInvitation = function(id) {
    const assistant=(this.teacherAssistants || []).find(a=>a.id===id);
    if(!assistant) return;
    const body=`<div dir="${t('rtl', 'ltr')}"><p style="line-height:1.7">${t(`إرسال دعوة إلى ${escapeHtml(assistant.name)} على <span dir="ltr">${escapeHtml(assistant.phone || '')}</span>. سيسجل المساعد اسمه وكلمة مرور خاصة بهذا المدرس. الدعوة الجديدة تلغي روابط الدعوات السابقة وتحافظ على الأجر المسجل. عند قبولها، تنتهي جلسات الدخول القديمة.`, `Send an invitation to ${escapeHtml(assistant.name)} at <span dir="ltr">${escapeHtml(assistant.phone || '')}</span>. The assistant will set their name and a password for this teacher workspace. A new invitation revokes previous invitation links and keeps the configured pay. Once accepted, previous sessions end.`)}</p><form id="assistantReinviteForm" onsubmit="window.centrlyApp.sendAssistantReinvitation(event,'${id}')">${renderAssistantAccessFields('reinvite',this.groups || [],assistant.access || {})}</form></div>`;
    this.showModal(t('دعوة المساعد', 'Invite assistant'),body,`<button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">${t('إلغاء', 'Cancel')}</button><button class="btn btn-primary" type="submit" form="assistantReinviteForm">${t('حفظ الدعوة وإرسالها', 'Save & send invitation')}</button>`);
  };
  app.sendAssistantReinvitation = async function(event,id) {
    event.preventDefault();
    const a=(this.teacherAssistants || []).find(a=>a.id===id);if(!a)return;
    const finish=beginSave(event);if(!finish)return;
    try {
      const access=readAssistantAccessFields('reinvite');
      const result=await request('/assistants/invitations',{method:'POST',body:{assistant_id:id,phone:a.phone,...access}});
      this.closeModal();this.showToast(result.message || t('تم حفظ الدعوة', 'Invitation saved'),result.delivery_status==='sent'?'success':'warning');await this.loadRouteData('assistants');this.showAssistantRegistrationLink(result);
    } catch(error){this.showToast(error.message || t('تعذر حفظ الدعوة', 'Failed to save invitation'),'danger');}finally{finish();}
  };
  app.openAddTeacherAssistantModal = function(recordOnly = false) {
    if (!payVisible()) {
      this.showToast(t('أظهر الأرقام لإعداد أجر المساعد الجديد.', 'Show financial numbers to configure the new assistant\'s pay.'), 'info');
      return;
    }
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddTeacherAssistantForm" data-record-only="${recordOnly}" dir="${t('rtl', 'ltr')}" onsubmit="window.centrlyApp.handleAddTeacherAssistantSubmit(event)">
        ${recordOnly ? `<p>${t('احفظ بيانات المساعد وأجره الآن. هذا السجل لا ينشئ حساب دخول ولا يرسل واتساب؛ تقدر تبعت دعوة من السجل لاحقًا.', 'Save the assistant\'s details and pay now. This record does not create a login account or send a WhatsApp invite; you can send an invite later from their record.')}</p><label class="form-label" for="modalTA_Name">${t('اسم المساعد', 'Assistant name')}</label><input id="modalTA_Name" class="form-input" maxlength="100" required style="margin-bottom:1rem"><label class="form-label" for="modalTA_GroupId">${t('المجموعة المسندة', 'Assigned group')}</label><select id="modalTA_GroupId" class="form-select" style="margin-bottom:1rem"><option value="">${t('جميع المجموعات', 'All groups')}</option>${groupOptions}</select>` : ''}
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">${t('رقم الهاتف (للتواصل والواتساب) *', 'Phone number (WhatsApp & contact) *')}</label>
          <input type="tel" id="modalTA_Phone" class="form-input" placeholder="010..." dir="ltr" required>
        </div>

        ${recordOnly ? '' : renderAssistantAccessFields("modalTA", this.groups || [])}
        ${renderAssistantPayFields("modalTA")}
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">${t('إلغاء', 'Cancel')}</button>
      <button type="submit" form="modalAddTeacherAssistantForm" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1rem;min-height:44px">${recordOnly ? t('حفظ السجل', 'Save record') : t('حفظ وإرسال الدعوة', 'Save & send invite')}</button>
    `;
    this.showModal(recordOnly ? t('إضافة سجل مساعد', 'Add assistant record') : t('دعوة مساعد إلى فريقك', 'Invite an assistant to your team'), bodyHtml, footerHtml);
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
      this.showToast(t('يرجى كتابة رقم واتساب المساعد', 'Please enter the assistant\'s WhatsApp number'), 'error');
      return;
    }

    const finish=beginSave(e);if(!finish)return;
    try {
      const pay = readAssistantPayFields('modalTA');
      if(recordOnly && !name)throw new Error(t('اكتب اسم المساعد', 'Enter the assistant\'s name'));
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
      this.showToast(recordOnly ? t('تم حفظ سجل المساعد بدون إرسال دعوة', 'Assistant record saved without sending an invite') : result.message, recordOnly || result.delivery_status === 'sent' ? 'success' : 'warning');
      await this.loadRouteData('assistants');
      if(!recordOnly)this.showAssistantRegistrationLink(result);
    } catch (err) {
      this.showToast(`${t('فشل إضافة المساعد:', 'Failed to add assistant:')} ${err.message || t('حدث خطأ', 'An error occurred')}`, 'danger');
    }finally{finish();}
  };

  app.openEditTeacherAssistantModal = function(assistantId) {
    const assistant = (this.teacherAssistants || []).find(a => a.id === assistantId);
    if (!assistant) return;

    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}" ${assistant.group_id === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalEditTeacherAssistantForm" dir="${t('rtl', 'ltr')}" onsubmit="window.centrlyApp.handleEditTeacherAssistantSubmit(event, '${assistantId}')">
        ${assistant.access ? `
          <p style="line-height:1.7">${escapeHtml(assistant.name)} · <span dir="ltr">${escapeHtml(assistant.phone || '')}</span><br>${t('المساعد يحدد اسمه وكلمة مروره عند قبول الدعوة.', 'The assistant sets their name and password when accepting the invitation.')}</p>
          <label for="modalEditTA_Status" class="form-label">${t('حالة الوصول', 'Access status')}</label>
          <select id="modalEditTA_Status" class="form-select" style="min-height:44px;margin-bottom:1rem">
            <option value="active" ${assistant.status==='active'?'selected':''}>${t('نشط', 'Active')}</option>
            ${assistant.status==='invited'?`<option value="invited" selected>${t('بانتظار قبول الدعوة', 'Pending invite acceptance')}</option>`:''}
            <option value="inactive" ${assistant.status==='inactive'?'selected':''}>${t('إيقاف الوصول', 'Suspend access')}</option>
          </select>
          ${renderAssistantAccessFields('modalEditTA', this.groups || [], assistant.access)}
        ` : `
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">${t('اسم المساعد (الأسستنت) *', 'Assistant name *')}</label>
          <input type="text" id="modalEditTA_Name" class="form-input" value="${escapeHtml(assistant.name)}" required>
        </div>

        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">${t('رقم الهاتف *', 'Phone number *')}</label>
          <input type="tel" id="modalEditTA_Phone" class="form-input" value="${escapeHtml(assistant.phone || '')}" dir="ltr" required>
        </div>

        <div class="modal-form-grid">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">${t('المجموعة المسندة', 'Assigned group')}</label>
            <select id="modalEditTA_GroupId" class="form-select">
              <option value="" ${!assistant.group_id ? 'selected' : ''}>${t('جميع المجموعات (مسؤول عام)', 'All groups (general)')}</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">${t('طبيعة الدور والعمل *', 'Role & responsibilities *')}</label>
            <select id="modalEditTA_RoleType" class="form-select">
              <option value="both" ${assistant.role_type === 'both' ? 'selected' : ''}>${t('إداري وتعليمي شامل', 'Admin & teaching')}</option>
              <option value="admin" ${assistant.role_type === 'admin' ? 'selected' : ''}>${t('إداري وتنظيمي فقط', 'Admin only')}</option>
              <option value="educational" ${assistant.role_type === 'educational' ? 'selected' : ''}>${t('تعليمي وتدريسي فقط', 'Teaching only')}</option>
            </select>
          </div>
        </div>

        `}
        ${payVisible() ? renderAssistantPayFields("modalEditTA", assistant) : `<p style="padding:1rem;border:1px solid var(--centrly-line);border-radius:10px">${t('الأجر محمي حاليًا. حفظ الصلاحيات والبيانات هنا لا يغيّر الأجر المسجل.', 'Pay is currently hidden. Saving permissions and details here will not change the configured pay.')}</p>`}
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">${t('إلغاء', 'Cancel')}</button>
      <button type="submit" form="modalEditTeacherAssistantForm" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">${t('حفظ التعديلات', 'Save changes')}</button>
    `;
    this.showModal(`${t('تعديل بيانات المساعد:', 'Edit assistant:')} ${escapeHtml(assistant.name)}`, bodyHtml, footerHtml);
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
      this.showToast(t('تم حفظ تعديلات المساعد بنجاح!', 'Assistant details updated successfully!'), 'success');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`${t('فشل تعديل بيانات المساعد:', 'Failed to update assistant:')} ${err.message || t('حدث خطأ', 'An error occurred')}`, 'danger');
    }finally{finish();}
  };

  app.deleteTeacherAssistant = function(id, name) {
    name = (this.teacherAssistants || []).find(a=>a.id===id)?.name || t('المساعد', 'the assistant');
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;" dir="${t('rtl', 'ltr')}">
        <div style="margin-bottom: 0.75rem;">${getIcon('trash', 40, '#ef4444')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">${t('تأكيد حذف المساعد', 'Confirm assistant removal')}</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          ${t(`هل أنت متأكد من حذف المساعد <strong>"${escapeHtml(name)}"</strong> من قائمة فريقك؟`, `Are you sure you want to remove <strong>"${escapeHtml(name)}"</strong> from your team?`)}
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">${t('إلغاء', 'Cancel')}</button>
          <button type="button" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;" onclick="window.centrlyApp.confirmDeleteTeacherAssistant('${id}')">
            ${t('حذف نهائي', 'Delete permanently')}
          </button>
        </div>
      </div>
    `;
    this.showModal(t('حذف مساعد', 'Remove assistant'), bodyHtml);
  };

  app.confirmDeleteTeacherAssistant = async function(id, name) {
    name = (this.teacherAssistants || []).find(a=>a.id===id)?.name || t('المساعد', 'the assistant');
    this.closeModal();
    try {
      await request(`/assistants/${id}`, { method: 'DELETE' });
      this.showToast(t(`تم حذف المساعد (${name}) بنجاح`, `Assistant (${name}) removed successfully`), 'success');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`${t('فشل حذف المساعد:', 'Failed to remove assistant:')} ${err.message || t('حدث خطأ', 'An error occurred')}`, 'danger');
    }
  };
}
