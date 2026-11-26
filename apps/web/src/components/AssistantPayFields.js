import { escapeHtml } from '../utils/escapeHtml.js?v=9.99.10';
import { localize as t } from '../utils/language.js?v=9.99.10';

const getDays = () => [
  [6, t('السبت', 'Saturday')],
  [0, t('الأحد', 'Sunday')],
  [1, t('الاثنين', 'Monday')],
  [2, t('الثلاثاء', 'Tuesday')],
  [3, t('الأربعاء', 'Wednesday')],
  [4, t('الخميس', 'Thursday')],
  [5, t('الجمعة', 'Friday')],
];

const getLabels = () => ({
  monthly: t('المرتب الشهري الثابت (ج.م)', 'Fixed monthly salary (EGP)'),
  per_session: t('أجر الحصة الواحدة (ج.م)', 'Pay per session (EGP)'),
  per_day: t('أجر اليوم الواحد (ج.م)', 'Daily rate (EGP)'),
});

export function renderAssistantPayFields(prefix, assistant = {}) {
  const model = assistant.salary_model || 'monthly';
  const weekdaySet = new Set(assistant.work_weekdays || []);
  const labels = getLabels();
  const days = getDays();
  return `
    <div class="modal-form-grid" data-assistant-pay style="margin-bottom:1rem">
      <div class="form-group">
        <label for="${prefix}_SalaryModel" class="form-label">${t('نظام المحاسبة', 'Pay model')}</label>
        <select id="${prefix}_SalaryModel" class="form-select" style="min-height:44px" onchange="window.centrlyApp.updateTeacherAssistantPayFields('${prefix}')">
          ${[
            ['monthly', t('مرتب شهري ثابت', 'Fixed monthly salary')],
            ['per_session', t('أجر بالحصة الواحدة', 'Per session')],
            ['per_day', t('أجر باليوم — حساب تلقائي', 'Per day — Auto calculation')],
          ].map(([value, label]) => `<option value="${value}" ${model === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label for="${prefix}_SalaryAmount" id="${prefix}_SalaryLabel" class="form-label">${labels[model] || labels.monthly}</label>
        <input type="number" id="${prefix}_SalaryAmount" class="form-input" style="min-height:44px" min="0" max="100000000" step="0.01" required value="${Number(assistant.salary ?? assistant.salary_amount) || 0}">
      </div>
    </div>
    <fieldset id="${prefix}_DailySchedule" ${model === 'per_day' ? '' : 'hidden'} style="border:1px solid var(--centrly-border, #e2e8f0);border-radius:12px;padding:1rem;margin:0 0 1rem;min-width:0">
      <legend style="font-weight:700;padding:0 .4rem">${t('جدول العمل الأسبوعي', 'Weekly work schedule')}</legend>
      <p style="margin:0 0 .75rem;color:var(--centrly-text);font-size:.875rem;line-height:1.7">${t('المستحق المتوقع للشهر = أجر اليوم × عدد أيام العمل المحددة، بدايةً من تاريخ العمل. الحساب تلقائي ولا يحتاج تسجيل حضور.', 'Expected monthly earnings = daily rate × selected work days starting from the start date. Calculated automatically without attendance check-in.')}</p>
      <div style="display:flex;flex-wrap:wrap;gap:.5rem;margin-bottom:1rem">
        ${days.map(([value, label]) => `<label style="display:flex;align-items:center;gap:.5rem;min-height:44px;padding:0 .75rem;border:1px solid var(--centrly-border, #e2e8f0);border-radius:8px;cursor:pointer"><input type="checkbox" name="${prefix}_WorkDay" value="${value}" ${weekdaySet.has(value) ? 'checked' : ''}>${label}</label>`).join('')}
      </div>
      <label class="form-label" for="${prefix}_PayStartDate">${t('تاريخ بداية العمل', 'Work start date')}</label>
      <input type="date" class="form-input" id="${prefix}_PayStartDate" style="min-height:44px;max-width:100%;box-sizing:border-box" min="2000-01-01" value="${escapeHtml(assistant.pay_start_date || '')}" ${model === 'per_day' ? 'required' : ''}>
    </fieldset>`;
}

export function updateAssistantPayFields(prefix) {
  const model = document.getElementById(`${prefix}_SalaryModel`)?.value || 'monthly';
  const labels = getLabels();
  document.getElementById(`${prefix}_SalaryLabel`).textContent = labels[model];
  document.getElementById(`${prefix}_DailySchedule`).hidden = model !== 'per_day';
  document.getElementById(`${prefix}_PayStartDate`).required = model === 'per_day';
}

export function readAssistantPayFields(prefix) {
  const salary_model = document.getElementById(`${prefix}_SalaryModel`).value;
  const salary = Number(document.getElementById(`${prefix}_SalaryAmount`).value);
  const work_weekdays = [...document.querySelectorAll(`input[name="${prefix}_WorkDay"]:checked`)].map(input => Number(input.value));
  const pay_start_date = document.getElementById(`${prefix}_PayStartDate`).value || null;
  if (salary_model === 'per_day' && (!pay_start_date || !work_weekdays.length)) throw new Error(t('اختر أيام العمل وتاريخ بدايته', 'Select work days and a start date'));
  return { salary_model, salary, work_weekdays, pay_start_date };
}
