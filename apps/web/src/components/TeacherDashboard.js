import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Teacher Dashboard
 * Clean vector icons, dynamic teacher greeting, 3 billing models display,
 * KPI Rollup & Active Groups Breakdown + Security PIN integration
 */

export function renderTeacherDashboard(
  data = {},
  user = {},
  securityState = { hasPin: false, isUnlocked: true, hideNumbers: false }
) {
  const stats = data.stats || {
    totalStudents: 0,
    activeGroups: 0,
    todayAttendanceRate: '0%',
    monthlyRevenue: 0,
    teacherProfit: 0,
    collectedToday: 0,
  };

  const { hasPin, isUnlocked, hideNumbers } = securityState;
  const groups = data.groups || [];
  const displayName = user?.name || data.userName || (user?.email ? user.email.split('@')[0] : 'المعلم');

  // Calculate total monthly revenue and net teacher profit directly from groups
  let calculatedMonthlyRev = 0;
  let calculatedTeacherProfit = 0;
  let totalEnrolledStudents = 0;

  const processedGroups = groups.map(g => {
    const studentCount = Number(g.student_count ?? g.students_count ?? 0);
    totalEnrolledStudents += studentCount;
    const price = Number(g.price ?? g.session_price ?? 0);
    const monthlyRev = price * studentCount * 4;
    let netProfit = Math.round(monthlyRev * 0.8);
    let billingModelName = 'نسبة سنتر (20%)';

    if (g.billing_model === 'fixed_per_student') {
      const cut = Number(g.fixed_per_student_amount || 0);
      netProfit = Math.max(0, (price - cut) * studentCount * 4);
      billingModelName = `أجر ثابت (${cut} ج.م/طالب)`;
    } else if (g.billing_model === 'fixed_rent') {
      const rent = Number(g.fixed_rent_amount || 0);
      netProfit = Math.max(0, monthlyRev - (rent * 4));
      billingModelName = `إيجار قاعة (${rent} ج.م/حصة)`;
    } else if (g.center_cut_percentage !== undefined && g.center_cut_percentage !== null) {
      const pct = Number(g.center_cut_percentage);
      billingModelName = `نسبة سنتر (${pct}%)`;
      netProfit = Math.round(monthlyRev * ((100 - pct) / 100));
    }

    calculatedMonthlyRev += monthlyRev;
    calculatedTeacherProfit += netProfit;

    return {
      ...g,
      studentCount,
      price,
      monthlyRev,
      netProfit,
      billingModelName,
    };
  });

  const finalMonthlyRevenue = calculatedMonthlyRev;
  const finalTeacherProfit = calculatedTeacherProfit;
  const finalTotalStudents = (Number(stats.totalStudents) > 0) ? stats.totalStudents : totalEnrolledStudents;

  const displayRev = hideNumbers ? '••••••' : `${finalMonthlyRevenue.toLocaleString('ar-EG')} ج.م`;
  const displayProfit = hideNumbers ? '••••••' : `${finalTeacherProfit.toLocaleString('ar-EG')} ج.م`;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Security PIN Banner -->
      <div class="card" style="margin: 0; background: ${!hasPin ? '#fffbeb' : '#f8fafc'}; border: 1px solid ${!hasPin ? '#fde68a' : '#e2e8f0'}; padding: 0.85rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="font-size: 1.3rem;">${!hasPin ? '⚠️' : (isUnlocked ? '🔓' : '🔒')}</div>
            <div>
              <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">
                ${!hasPin 
                  ? 'حماية الأرباح برمز الأمان (PIN) غير مفعلة' 
                  : (isUnlocked ? 'الأرباح المالية: معروضة حالياً' : 'الأرباح المالية مقفلة برمز الأمان')}
              </div>
              <div style="font-size: 0.75rem; color: #64748b;">
                ${!hasPin 
                  ? 'قم بتعيين رمز PIN مكون من 4 إلى 6 أرقام لإخفاء الأرباح وحمايتها من المتطفلين.' 
                  : (isUnlocked ? 'يمكنك إخفاء الأرقام سريعاً أو إعادة القفل بضغطة واحدة.' : 'أدخل الـ PIN لعرض أرباحك وتفاصيل التحصيل.')}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            ${!hasPin ? `
              <button class="btn btn-warning btn-sm" onclick="window.centrlyApp.openSetPinModal()" style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem;">
                <span>🔐</span>
                <span>تعيين رمز PIN للأرباح</span>
              </button>
            ` : `
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleHideFinancialNumbers()" style="font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
                <span>${hideNumbers ? getIcon('eye', 14) : getIcon('eyeOff', 14)}</span>
                <span>${hideNumbers ? 'إظهار الأرقام' : 'إخفاء الأرقام'}</span>
              </button>

              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.lockFinancials()" style="font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
                <span>${getIcon('lock', 14)}</span>
                <span>قفل الأرباح</span>
              </button>

              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openSetPinModal()" style="font-weight: 700;" title="تغيير رمز PIN">
                <span>⚙️</span>
              </button>
            `}
          </div>
        </div>
      </div>

      <!-- Welcome & Quick Start Banner -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, var(--centrly-blue-900), var(--centrly-blue-700)); color: #fff; border: none; box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          <div>
            <div style="font-size: 0.85rem; color: #93c5fd; font-weight: 700; margin-bottom: 0.25rem;">لوحة المتابعة والأرباح العامة للمدرس</div>
            <h2 style="font-size: 1.5rem; font-weight: 900; margin: 0; color: #fff;">مرحباً بك، ${escapeHtml(displayName)}</h2>
            <p style="font-size: 0.875rem; color: #e2e8f0; margin-top: 0.35rem; max-width: 600px; line-height: 1.5;">
              إليك ملخص أرباحك الصافية، تفاصيل تحصيل المجاميع، وجدول الحصص اليومية.
            </p>
          </div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn" style="background: rgba(255,255,255,0.15); color: #fff; font-weight: 700; border: 1px solid rgba(255,255,255,0.3); display: flex; align-items: center; gap: 0.4rem;" onclick="window.centrlyApp.navigate('calendar')">
              ${getIcon('calendar', 16, '#ffffff')}
              <span>جدول الحصص</span>
            </button>
            <button class="btn btn-primary" style="font-weight: 800; display: flex; align-items: center; gap: 0.4rem;" onclick="window.centrlyApp.navigate('sessions')">
              ${getIcon('sessions', 16)}
              <span>لوحة الحصص</span>
            </button>
          </div>
        </div>
      </div>

      ${hasPin && !isUnlocked ? `
        <!-- Locked Financials Box -->
        <div class="card" style="margin: 0; padding: 2.5rem 1.5rem; text-align: center; background: #fff;">
          <div style="max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
            <div style="width: 56px; height: 56px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.8rem; color: #1d4ed8;">
              🔒
            </div>
            <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">الأرباح المالية مقفلة</h3>
            <p style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.6;">
              أدخل رمز الأمان (PIN) للاطلاع على إجمالي الدخل وصافي أرباحك ومستحقات السنتر.
            </p>
            <button class="btn btn-primary" onclick="window.centrlyApp.promptUnlockFinancials()" style="padding: 0.65rem 1.75rem; font-size: 0.9rem; font-weight: 800; display: flex; align-items: center; gap: 0.4rem; margin-top: 0.35rem;">
              <span>🔑</span>
              <span>إدخال رمز PIN لفتح الأرباح</span>
            </button>
          </div>
        </div>
      ` : `
        <!-- Financial & Operations KPI Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
          
          <!-- 1. Total Estimated Revenue -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الدخل المقدر (شهري)</span>
              <span style="color: var(--centrly-success);">${getIcon('billing', 20)}</span>
            </div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.4rem;">
              ${displayRev}
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
              محسوب بناءً على اشتراكات الطلاب
            </div>
          </div>

          <!-- 2. Teacher Net Profit -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">صافي أرباح المدرس المقدرة</span>
              <span style="color: var(--centrly-blue-700);">${getIcon('dashboard', 20)}</span>
            </div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-blue-800); margin-top: 0.4rem;">
              ${displayProfit}
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
              بعد تسوية أجر ونسبة السنتر
            </div>
          </div>

          <!-- 3. Active Enrolled Students -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #6366f1;">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الطلاب المقيدين</span>
              <span style="color: #6366f1;">${getIcon('students', 20)}</span>
            </div>
            <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.4rem;">
              ${finalTotalStudents} <span style="font-size: 0.85rem; font-weight: 500;">طالب</span>
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
              موزعين على ${stats.activeGroups || groups.length} مجاميع نشطة
            </div>
          </div>

          <!-- 4. Today Attendance Rate -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-warning);">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نسبة الحضور اليومي</span>
              <span style="color: var(--centrly-warning);">${getIcon('activity', 20)}</span>
            </div>
            <div style="font-size: 1.8rem; font-weight: 900; color: #d97706; margin-top: 0.4rem;">
              ${stats.todayAttendanceRate}
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
              من واقع حصص اليوم الجارية
            </div>
          </div>

        </div>

        <!-- Active Groups Breakdown Table -->
        <div class="card" style="margin: 0;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('groups', 18, 'var(--centrly-blue-700)')}
              <span>بيان المجاميع النشطة والعائد المالي المقدر</span>
            </h3>
            <span style="font-size: 0.78rem; color: var(--centrly-text);">
              البيانات المالية خاصة بحساب المعلم والمالك فقط
            </span>
          </div>

          <div style="overflow-x: auto; margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>المجموعة</th>
                  <th>السنتر / القاعة</th>
                  <th>سعر الحصة</th>
                  <th>نظام المحاسبة</th>
                  <th>عدد الطلاب</th>
                  <th>الدخل الشهري المقدر</th>
                  <th>صافي المدرس</th>
                </tr>
              </thead>
              <tbody>
                ${processedGroups.length > 0 ? processedGroups.map(g => {
                  const pRev = hideNumbers ? '••••••' : `${g.monthlyRev.toLocaleString('ar-EG')} ج.م`;
                  const pProfit = hideNumbers ? '••••••' : `${g.netProfit.toLocaleString('ar-EG')} ج.م`;
                  const pPrice = hideNumbers ? '••••••' : `${escapeHtml(g.price)} ج.م`;

                  return `
                    <tr>
                      <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(g.name)}</td>
                      <td><span class="badge badge-blue">${escapeHtml(g.center_name || 'سنتر تعليمي')}</span></td>
                      <td style="font-weight: 700; font-family: monospace;">${pPrice}</td>
                      <td style="font-size: 0.825rem; color: var(--centrly-text);">
                        ${escapeHtml(g.billingModelName)}
                      </td>
                      <td style="font-weight: 700;">${escapeHtml(g.studentCount)} طلاب</td>
                      <td style="font-weight: 800; color: var(--centrly-success); font-family: monospace;">
                        ${pRev}
                      </td>
                      <td style="font-weight: 800; color: var(--centrly-blue-800); font-family: monospace;">
                        ${pProfit}
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--centrly-text);">
                      لا توجد مجاميع نشطة بعد. أنشئ مجموعتك الأولى للبدء في تتبع الأرباح.
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
