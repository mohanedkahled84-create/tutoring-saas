/** Financial views consume the same server calculation, including its selected month. */
export function assistantPay(assistant, period) {
  const model = assistant.salary_model || 'monthly';
  const modelLabel = model === 'per_day' ? 'باليوم — تلقائي' : model === 'per_session' ? 'بالحصة' : 'مرتب شهري';
  const payroll = assistant.payroll;
  const matchesPeriod = !period || (Number(period.month) === payroll?.month && Number(period.year) === payroll?.year);
  if (payroll && matchesPeriod && Number.isFinite(payroll.amount) && payroll.amount >= 0) {
    const units = Number(payroll.units) || 0;
    const basis = model === 'per_day' ? `${units.toLocaleString('ar-EG')} يوم عمل مجدول — حساب تلقائي للشهر` : model === 'per_session' ? `${units.toLocaleString('ar-EG')} حصة منتهية خلال الشهر` : 'مرتب شهري ثابت';
    return { amount: payroll.amount, basis, modelLabel, available: true };
  }
  // Old cached rows have no payroll. Never invent session or weekday counts.
  return { amount: 0, basis: 'أعد تحميل البيانات لحساب مستحقات الشهر', modelLabel, available: false };
}
