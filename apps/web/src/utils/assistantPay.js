import { localize as t } from './language.js?v=9.99.8';

/** Financial views consume the same server calculation, including its selected month. */
export function assistantPay(assistant, period) {
  const model = assistant.salary_model || 'monthly';
  const modelLabel = model === 'per_day'
    ? t('باليوم — تلقائي', 'Per day — Auto')
    : model === 'per_session'
      ? t('بالحصة', 'Per session')
      : t('مرتب شهري', 'Monthly salary');
  const payroll = assistant.payroll;
  const matchesPeriod = !period || (Number(period.month) === payroll?.month && Number(period.year) === payroll?.year);
  if (payroll && matchesPeriod && Number.isFinite(payroll.amount) && payroll.amount >= 0) {
    const units = Number(payroll.units) || 0;
    const unitText = units.toLocaleString(t('ar-EG', 'en-EG'));
    const basis = model === 'per_day'
      ? t(`${unitText} يوم عمل مجدول — حساب تلقائي للشهر`, `${unitText} scheduled work days — auto-calculated for month`)
      : model === 'per_session'
        ? t(`${unitText} حصة منتهية خلال الشهر`, `${unitText} completed sessions this month`)
        : t('مرتب شهري ثابت', 'Fixed monthly salary');
    return { amount: payroll.amount, basis, modelLabel, available: true };
  }
  // Old cached rows have no payroll. Never invent session or weekday counts.
  return { amount: 0, basis: t('أعد تحميل البيانات لحساب مستحقات الشهر', 'Reload data to calculate monthly pay'), modelLabel, available: false };
}
