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
    const fallbackFromStudents = typeof window !== 'undefined' && Array.isArray(window.centrlyApp?.students)
      ? window.centrlyApp.students.filter(s => s.group_id === g.id || (Array.isArray(s.group_ids) && s.group_ids.includes(g.id))).length
      : 0;
    const studentCount = Number(g.studentCount ?? g.students_count ?? g.student_count ?? fallbackFromStudents ?? 0);
    totalEnrolledStudents += studentCount;
    const price = Number(g.price ?? g.session_price ?? 0);
    const sessionsPerWeek = Math.max(1, Number(g.sessions_per_week || 1));
    const monthlySessions = sessionsPerWeek * 4;
    const monthlyRev = price * studentCount * monthlySessions;
    let netProfit = Math.round(monthlyRev * 0.8);
    let billingModelName = 'نسبة سنتر (20%)';

    if (g.billing_model === 'no_center' || (g.billing_model === 'percentage' && Number(g.center_cut_percentage) === 0)) {
      netProfit = monthlyRev;
      billingModelName = 'بدون سنتر (100% للمعلم)';
    } else if (g.billing_model === 'fixed_per_student') {
      const cut = Number(g.fixed_per_student_amount || 0);
      netProfit = Math.max(0, (price - cut) * studentCount * monthlySessions);
      billingModelName = `أجر ثابت (${cut} ج.م/طالب)`;
    } else if (g.billing_model === 'fixed_rent') {
      const rent = Number(g.fixed_rent_amount || 0);
      netProfit = Math.max(0, monthlyRev - (rent * monthlySessions));
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
      sessionsPerWeek,
      monthlySessions,
      monthlyRev,
      netProfit,
      billingModelName,
    };
  });

  // Calculate assistant salaries and deductions
  const rawAssistants = Array.isArray(data.assistants) ? data.assistants : [];
  const activeAssistants = rawAssistants.filter(a => a.status !== 'inactive');
  let calculatedAssistantSalaries = 0;

  const processedAssistants = activeAssistants.map(a => {
    const isPerSession = a.salary_model === 'per_session';
    const rate = Number(a.salary ?? a.salary_amount ?? 0);
    let monthlyDeduction = 0;
    let calculationBasis = '';

    if (isPerSession) {
      if (a.group_id) {
        const matched = groups.find(g => g.id === a.group_id);
        const grpName = matched ? matched.name : 'مجموعة مخصصة';
        const sessions = matched ? Math.max(1, Number(matched.sessions_per_week || 1)) * 4 : 4;
        monthlyDeduction = rate * sessions;
        calculationBasis = `${sessions} حصص شهرياً في ${grpName} (${rate.toLocaleString('ar-EG')} ج.م/حصة)`;
      } else {
        const totalSessions = groups.reduce((acc, g) => acc + (Math.max(1, Number(g.sessions_per_week || 1)) * 4), 0) || 4;
        monthlyDeduction = rate * totalSessions;
        calculationBasis = `${totalSessions} حصة شهرياً لكافة المجاميع (${rate.toLocaleString('ar-EG')} ج.م/حصة)`;
      }
    } else {
      monthlyDeduction = rate;
      calculationBasis = 'مرتب شهري ثابت';
    }

    calculatedAssistantSalaries += monthlyDeduction;

    const matchedGroup = groups.find(g => g.id === a.group_id);
    let roleText = 'إداري وتعليمي شامل';
    if (a.role_type === 'admin') roleText = 'إداري وتنظيمي فقط';
    else if (a.role_type === 'educational') roleText = 'تعليمي وتدريسي فقط';

    return {
      ...a,
      rate,
      isPerSession,
      monthlyDeduction,
      calculationBasis,
      roleText,
      assignedGroupName: matchedGroup ? matchedGroup.name : 'جميع المجاميع (إشراف عام)',
    };
  });

  const finalMonthlyRevenue = calculatedMonthlyRev;
  const grossTeacherProfit = calculatedTeacherProfit; // after center cut
  const totalCenterCut = Math.max(0, finalMonthlyRevenue - grossTeacherProfit);
  const totalAssistantSalaries = calculatedAssistantSalaries;
  const finalTeacherProfit = Math.max(0, grossTeacherProfit - totalAssistantSalaries);
  const finalTotalStudents = (Number(stats.totalStudents) > 0) ? stats.totalStudents : totalEnrolledStudents;

  // Actual realized earnings data from completed sessions
  const actualEarnings = data.actualEarnings || null;
  const actualRevenue = Number(actualEarnings?.actual_revenue || 0);
  const actualCenterCut = Number(actualEarnings?.actual_center_cut || 0);
  const actualTeacherNet = Number(actualEarnings?.actual_teacher_net || 0);
  const completedSessionsCount = Number(actualEarnings?.completed_sessions_count || 0);
  const totalAttendedStudents = Number(actualEarnings?.total_attended_students || 0);
  const completedSessions = Array.isArray(actualEarnings?.sessions) ? actualEarnings.sessions : [];

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const currentMonthIdx = actualEarnings?.month ? actualEarnings.month - 1 : new Date().getMonth();
  const currentMonthName = monthNames[currentMonthIdx] || 'الحالي';
  const currentYearNum = actualEarnings?.year || new Date().getFullYear();

  const isFinancialHidden = hideNumbers || (hasPin && !isUnlocked);
  const displayRev = isFinancialHidden ? '••••••' : `${finalMonthlyRevenue.toLocaleString('ar-EG')} ج.م`;
  const displayCenterCut = isFinancialHidden ? '••••••' : `${totalCenterCut.toLocaleString('ar-EG')} ج.م`;
  const displayAssistants = isFinancialHidden ? '••••••' : `${totalAssistantSalaries.toLocaleString('ar-EG')} ج.م`;
  const displayProfit = isFinancialHidden ? '••••••' : `${finalTeacherProfit.toLocaleString('ar-EG')} ج.م`;

  // Actual financial displays
  const displayActualRev = isFinancialHidden ? '••••••' : `${actualRevenue.toLocaleString('ar-EG')} ج.م`;
  const displayActualCenterCut = isFinancialHidden ? '••••••' : `${actualCenterCut.toLocaleString('ar-EG')} ج.م`;
  const displayActualTeacherNet = isFinancialHidden ? '••••••' : `${actualTeacherNet.toLocaleString('ar-EG')} ج.م`;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Security PIN Banner -->
      <div class="card" style="margin: 0; background: ${!hasPin ? '#fffbeb' : '#f8fafc'}; border: 1px solid ${!hasPin ? '#fde68a' : '#e2e8f0'}; padding: 0.85rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.65rem;">
            <div style="display: flex; align-items: center;">${!hasPin ? getIcon('alertTriangle', 20, '#d97706') : (isUnlocked ? getIcon('lock', 20, '#10b981') : getIcon('lock', 20, '#64748b'))}</div>
            <div>
              <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">
                ${!hasPin 
                  ? 'حماية الأرباح برمز الأمان (PIN) غير مفعلة' 
                  : (isUnlocked ? 'الأرباح المالية: معروضة حالياً' : 'الأرباح المالية مقفلة برمز الأمان')}
              </div>
              <div style="font-size: 0.75rem; color: #64748b;">
                ${!hasPin 
                  ? 'قم بتعيين رمز PIN مكون من 4 إلى 6 أرقام لإخفاء الأرباح وحمايتها من المتطفلين.' 
                  : (isUnlocked ? 'تُقفل الأرباح تلقائياً بمجرد الانتقال لأي صفحة أخرى، ويمكنك إخفاء الأرقام سريعاً أو إعادة القفل.' : 'أدخل الـ PIN لعرض أرباحك وتفاصيل التحصيل.')}
              </div>
            </div>
          </div>

          <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            ${!hasPin ? `
              <button class="btn btn-warning btn-sm" onclick="window.centrlyApp.openSetPinModal()" style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem;">
                ${getIcon('lock', 14)}
                <span>تعيين رمز PIN للأرباح</span>
              </button>
            ` : `
              ${!isUnlocked ? `
                <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.promptUnlockFinancials()" style="font-weight: 800; display: flex; align-items: center; gap: 0.35rem;">
                  ${getIcon('lock', 14)}
                  <span>إدخال رمز PIN لفتح الأرباح</span>
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
              `}

              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openSetPinModal()" style="font-weight: 700; display: flex; align-items: center; justify-content: center;" title="تغيير رمز PIN">
                ${getIcon('edit', 14)}
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
              إليك ملخص أرباحك الفعلية المحصلة من واقع الحضور، تقديرات الدخل، وجدول الحصص.
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

      <!-- Hero Financial Highlights: Actual Realized vs Estimated Projected -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
        
        <!-- 1. Actual Realized Profit Hero Card -->
        <div class="card" style="margin: 0; background: linear-gradient(135deg, #064e3b 0%, #047857 100%); color: #fff; border: 1px solid #059669; box-shadow: 0 4px 14px rgba(4, 120, 87, 0.25); border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="badge" style="background: rgba(255,255,255,0.22); color: #ecfdf5; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px;">
                التحصيل الفعلي • شهر ${escapeHtml(currentMonthName)} ${currentYearNum}
              </span>
              <div style="font-size: 1.05rem; font-weight: 800; color: #a7f3d0; margin-top: 0.6rem;">
                صافي الأرباح الفعلية المحصلة (للمدرس)
              </div>
            </div>
            <div style="background: rgba(255,255,255,0.18); padding: 0.6rem; border-radius: 10px; display: flex; align-items: center;">
              ${getIcon('billing', 26, '#ffffff')}
            </div>
          </div>

          <div style="font-size: 2.3rem; font-weight: 900; color: #ffffff; margin-top: 0.75rem; letter-spacing: -0.5px; font-family: monospace;">
            ${displayActualTeacherNet}
          </div>

          <div style="margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px solid rgba(255,255,255,0.2); display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; color: #d1fae5; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              محسوب من <strong>${completedSessionsCount}</strong> حصة منتهية (<strong>${totalAttendedStudents}</strong> حضور فعلي)
            </div>
            <div style="background: rgba(0,0,0,0.15); padding: 0.2rem 0.5rem; border-radius: 4px;">
              إجمالي المحصل: <strong>${displayActualRev}</strong>
            </div>
          </div>
        </div>

        <!-- 2. Estimated Projected Revenue Hero Card -->
        <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid var(--centrly-blue-700); box-shadow: var(--shadow-sm); border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="badge badge-blue" style="font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem;">
                تقديري شهري (بافتراض حضور 100%)
              </span>
              <div style="font-size: 1.05rem; font-weight: 800; color: #1e3a8a; margin-top: 0.6rem;">
                صافي الأرباح التقديرية المتوقعة
              </div>
            </div>
            <div style="background: #eff6ff; color: var(--centrly-blue-700); padding: 0.6rem; border-radius: 10px; display: flex; align-items: center;">
              ${getIcon('dashboard', 26, 'var(--centrly-blue-700)')}
            </div>
          </div>

          <div style="font-size: 2.3rem; font-weight: 900; color: var(--centrly-blue-800); margin-top: 0.75rem; letter-spacing: -0.5px; font-family: monospace;">
            ${displayProfit}
          </div>

          <div style="margin-top: 0.85rem; padding-top: 0.75rem; border-top: 1px solid #f1f5f9; display: flex; justify-content: space-between; align-items: center; font-size: 0.82rem; color: #64748b; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              لكافة الطلاب المقيدين (<strong>${finalTotalStudents}</strong> طالب)
            </div>
            <div style="background: #f8fafc; padding: 0.2rem 0.5rem; border-radius: 4px;">
              إجمالي المتوقع: <strong style="color: var(--centrly-success);">${displayRev}</strong>
            </div>
          </div>
        </div>

      </div>

      <!-- Financial Breakdown & Operations Secondary KPIs -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        
        <!-- Center Cut Actual vs Projected -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #f59e0b;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">استقطاعات وحصة السنتر</span>
            <span style="color: #f59e0b;">${getIcon('rooms', 20)}</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #b45309; margin-top: 0.4rem; font-family: monospace;">
            ${displayActualCenterCut}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            المستقطعة فعلياً (المتوقع شهرياً: ${displayCenterCut})
          </div>
        </div>

        <!-- Assistant Salaries -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #e11d48;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">مرتبات ومستحقات المساعدين</span>
            <span style="color: #e11d48;">${getIcon('assistants', 20)}</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #be123c; margin-top: 0.4rem; font-family: monospace;">
            ${displayAssistants}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            مخصومة (${processedAssistants.length} مساعد نشط)
          </div>
        </div>

        <!-- Active Students -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #6366f1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">الطلاب المقيدين</span>
            <span style="color: #6366f1;">${getIcon('students', 20)}</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.4rem;">
            ${finalTotalStudents} <span style="font-size: 0.85rem; font-weight: 500;">طالب</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            في ${stats.activeGroups || groups.length} مجاميع نشطة
          </div>
        </div>

        <!-- Attendance Rate -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-warning);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نسبة الحضور اليومي</span>
            <span style="color: var(--centrly-warning);">${getIcon('activity', 20)}</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #d97706; margin-top: 0.4rem;">
            ${stats.todayAttendanceRate}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            من واقع حصص اليوم الجارية
          </div>
        </div>

      </div>

      <!-- Completed Sessions Financial Statement Table (التحصيل الفعلي من واقع الحضور) -->
      <div class="card" style="margin: 0; border-top: 3px solid #059669;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem; color: #065f46;">
              ${getIcon('billing', 18, '#059669')}
              <span>كشف أرباح وتحصيل الحصص المنتهية هذا الشهر (التحصيل الفعلي)</span>
            </h3>
            <p style="font-size: 0.78rem; color: var(--centrly-text); margin-top: 0.2rem;">
              يتم احتساب هذه الأرقام تلقائياً من واقع حضور الطلاب الفعلي في كل حصة بعد انتهاء الحصة، مع مراعاة الطلاب المعفيين ونظام محاسبة السنتر.
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="badge" style="background: #ecfdf5; color: #065f46; font-weight: 800; font-size: 0.8rem; border: 1px solid #a7f3d0;">
              شهر ${escapeHtml(currentMonthName)} ${currentYearNum}
            </span>
          </div>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>الحصة والتاريخ</th>
                <th>المجموعة</th>
                <th>السنتر / القاعة</th>
                <th>نظام المحاسبة</th>
                <th>الحضور الفعلي</th>
                <th>إجمالي التحصيل</th>
                <th>حصة السنتر</th>
                <th>صافي ربح المدرس</th>
              </tr>
            </thead>
            <tbody>
              ${completedSessions.length > 0 ? completedSessions.map(cs => {
                const pRev = isFinancialHidden ? '••••••' : `${cs.total_revenue.toLocaleString('ar-EG')} ج.م`;
                const pCenter = isFinancialHidden ? '••••••' : `${cs.center_share.toLocaleString('ar-EG')} ج.م`;
                const pTeacher = isFinancialHidden ? '••••••' : `${cs.teacher_share.toLocaleString('ar-EG')} ج.م`;

                let modelBadge = 'نسبة سنتر';
                if (cs.billing_model === 'no_center') modelBadge = 'بدون سنتر (100% للمدرس)';
                else if (cs.billing_model === 'fixed_rent') modelBadge = 'إيجار قاعة';
                else if (cs.billing_model === 'fixed_per_student') modelBadge = 'أجر ثابت/طالب';

                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--centrly-ink);">
                      حصة ${escapeHtml(cs.session_number ? String(cs.session_number) : '—')}
                      <div style="font-size: 0.75rem; color: #64748b; font-weight: normal; font-family: monospace;">
                        ${escapeHtml(cs.session_date)}
                      </div>
                    </td>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">
                      ${escapeHtml(cs.group_name)}
                    </td>
                    <td>
                      <span class="badge badge-blue">${escapeHtml(cs.center_name || 'سنتر تعليمي')}</span>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--centrly-text);">
                      ${escapeHtml(modelBadge)}
                    </td>
                    <td>
                      <span class="badge badge-success" style="font-weight: 700;">
                        ${cs.present_count} حاضر
                      </span>
                      ${cs.absent_count > 0 ? `
                        <span class="badge" style="background: #f1f5f9; color: #64748b; margin-right: 0.2rem;">
                          ${cs.absent_count} غائب
                        </span>
                      ` : ''}
                      ${cs.exempt_count > 0 ? `
                        <span class="badge" style="background: #eff6ff; color: #1d4ed8; margin-right: 0.2rem;">
                          ${cs.exempt_count} معفي
                        </span>
                      ` : ''}
                    </td>
                    <td style="font-weight: 800; color: var(--centrly-success); font-family: monospace;">
                      ${pRev}
                    </td>
                    <td style="font-weight: 700; color: #b45309; font-family: monospace;">
                      ${pCenter}
                    </td>
                    <td style="font-weight: 900; color: #065f46; font-family: monospace; font-size: 1rem; background: #f0fdf4;">
                      ${pTeacher}
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 2.5rem 1rem; color: #64748b;">
                    <div style="margin-bottom: 0.5rem; font-size: 1.05rem; font-weight: 700; color: #1e293b;">
                      لم تُسجل أي حصص منتهية بعد خلال شهر ${escapeHtml(currentMonthName)} ${currentYearNum}
                    </div>
                    <div style="font-size: 0.85rem; max-width: 520px; margin: 0 auto; line-height: 1.6; color: #64748b;">
                      يتم احتساب الأرباح الفعلية بدقة فور إنهاء الحصة وتسجيل حضور الطلاب الفعلي، مع خصم حصة السنتر ومراعاة الطلاب المعفيين تلقائياً.
                    </div>
                    <div style="margin-top: 1rem;">
                      <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('sessions')" style="font-weight: 700;">
                        الانتقال إلى لوحة الحصص وتسجيل الحضور
                      </button>
                    </div>
                  </td>
                </tr>
              `}
            </tbody>
            ${completedSessions.length > 0 ? `
              <tfoot>
                <tr style="background: #f0fdf4; font-weight: 800; border-top: 2px solid #a7f3d0;">
                  <td colspan="5" style="text-align: left; color: #065f46; font-size: 0.95rem;">
                    إجمالي التحصيل الفعلي للحصص المنتهية (${escapeHtml(currentMonthName)} ${currentYearNum}):
                  </td>
                  <td style="color: var(--centrly-success); font-family: monospace; font-size: 1.05rem;">
                    ${displayActualRev}
                  </td>
                  <td style="color: #b45309; font-family: monospace; font-size: 1.05rem;">
                    ${displayActualCenterCut}
                  </td>
                  <td style="color: #065f46; font-family: monospace; font-size: 1.15rem; font-weight: 900; background: #dcfce7;">
                    ${displayActualTeacherNet}
                  </td>
                </tr>
              </tfoot>
            ` : ''}
          </table>
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
                  <th>تكرار الحصص</th>
                  <th>نظام المحاسبة</th>
                  <th>عدد الطلاب</th>
                  <th>الدخل الشهري المقدر</th>
                  <th>صافي حصة المدرس</th>
                </tr>
              </thead>
              <tbody>
                ${processedGroups.length > 0 ? processedGroups.map(g => {
                  const pRev = isFinancialHidden ? '••••••' : `${g.monthlyRev.toLocaleString('ar-EG')} ج.م`;
                  const pProfit = isFinancialHidden ? '••••••' : `${g.netProfit.toLocaleString('ar-EG')} ج.م`;
                  const pPrice = `${escapeHtml(g.price)} ج.م`;

                  return `
                    <tr>
                      <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(g.name)}</td>
                      <td><span class="badge badge-blue">${escapeHtml(g.center_name || 'سنتر تعليمي')}</span></td>
                      <td style="font-weight: 700; font-family: monospace;">${pPrice}</td>
                      <td style="font-size: 0.825rem; font-weight: 700; color: #1e3a8a;">
                        ${g.sessionsPerWeek} ${g.sessionsPerWeek === 2 ? 'حصتان' : (g.sessionsPerWeek > 2 ? `${g.sessionsPerWeek} حصص` : 'حصة')}/أسبوع
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 500;">(${g.monthlySessions} حصص شهرياً)</div>
                      </td>
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
                    <td colspan="8" style="text-align: center; padding: 2rem; color: var(--centrly-text);">
                      لا توجد مجاميع نشطة بعد. أنشئ مجموعتك الأولى للبدء في تتبع الأرباح.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>

        <!-- Assistants Payroll & Deductions Section -->
        <div class="card" style="margin: 0;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <div>
              <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('assistants', 18, '#e11d48')}
                <span>بيان استقطاعات مرتبات المساعدين من الأرباح</span>
              </h3>
              <p style="font-size: 0.78rem; color: var(--centrly-text); margin-top: 0.2rem;">
                يتم خصم مستحقات المساعدين تلقائياً من أرباح المدرس الصافية وفقاً لنظام المحاسبة المحدد (شهري أو بالحصة).
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('assistants')" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
              ${getIcon('edit', 14)}
              <span>إدارة وتعديل المساعدين</span>
            </button>
          </div>

          <div style="overflow-x: auto; margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>اسم المساعد</th>
                  <th>رقم الهاتف</th>
                  <th>طبيعة الدور</th>
                  <th>المجموعة المسندة</th>
                  <th>نظام المحاسبة</th>
                  <th>أساس الحساب الشهري</th>
                  <th>القيمة المخصومة</th>
                </tr>
              </thead>
              <tbody>
                ${processedAssistants.length > 0 ? processedAssistants.map(a => {
                  const pRate = isFinancialHidden ? '••••••' : `${a.rate.toLocaleString('ar-EG')} ج.م`;
                  const pDeduction = isFinancialHidden ? '••••••' : `${a.monthlyDeduction.toLocaleString('ar-EG')} ج.م`;

                  return `
                    <tr>
                      <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(a.name)}</td>
                      <td dir="ltr" style="text-align: right; font-family: monospace;">${escapeHtml(a.phone || '—')}</td>
                      <td><span class="badge badge-secondary">${escapeHtml(a.roleText)}</span></td>
                      <td><span class="badge badge-blue">${escapeHtml(a.assignedGroupName)}</span></td>
                      <td>
                        <span class="badge ${a.isPerSession ? 'badge-amber' : 'badge-success'}">
                          ${a.isPerSession ? 'بالحصة' : 'مرتب شهري'}
                        </span>
                      </td>
                      <td style="font-size: 0.825rem; color: var(--centrly-text);">
                        ${escapeHtml(a.calculationBasis)}
                      </td>
                      <td style="font-weight: 800; color: #be123c; font-family: monospace; font-size: 1rem;">
                        -${pDeduction}
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--centrly-text);">
                      <div style="color: #64748b; margin-bottom: 0.5rem;">
                        لا توجد مرتبات مساعدين مسجلة حتى الآن.
                      </div>
                      <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('assistants')" style="font-weight: 700;">
                        إضافة مساعد وتسجيل مرتبه
                      </button>
                    </td>
                  </tr>
                `}
              </tbody>
              ${processedAssistants.length > 0 ? `
                <tfoot>
                  <tr style="background: #fff1f2; font-weight: 800;">
                    <td colspan="6" style="text-align: left; color: #9f1239; font-size: 0.95rem;">
                      إجمالي مستقطعات مرتبات المساعدين لهذا الشهر:
                    </td>
                    <td style="color: #be123c; font-family: monospace; font-size: 1.1rem;">
                      -${displayAssistants}
                    </td>
                  </tr>
                </tfoot>
              ` : ''}
            </table>
          </div>
        </div>

    </div>
  `;
}
