import { assistantPay } from "../utils/assistantPay.js?v=9.99.0";
import { escapeHtml } from "../utils/escapeHtml.js?v=9.99.0";
import { getIcon } from "../utils/icons.js?v=9.99.0";
import {renderTeacherActions} from './TeacherActionsPanel.js?v=9.99.0';
import {getLocale} from '../utils/locale.js?v=9.99.0';

/**
 * Centrly Teacher Dashboard
 * Clean vector icons, dynamic teacher greeting, 3 billing models display,
 * KPI Rollup & Active Groups Breakdown
 */

export function renderTeacherDashboard(
  data = {},
  user = {},
  securityState = { hasPin: false, isUnlocked: true, hideNumbers: false }
) {
  const en=getLocale()==='en';
  const stats = data.stats || {
    totalStudents: 0,
    activeGroups: 0,
    todayAttendanceRate: '0%',
    monthlyRevenue: 0,
    teacherProfit: 0,
    collectedToday: 0,
  };

  const { hideNumbers } = securityState;
  const groups = data.groups || [];
  const displayName = user?.name || data.userName || (user?.email ? user.email.split('@')[0] : (en?'Teacher':'المعلم'));

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
    let billingModelName = en?'Center share (20%)':'نسبة سنتر (20%)';

    if (g.billing_model === 'no_center' || (g.billing_model === 'percentage' && Number(g.center_cut_percentage) === 0)) {
      netProfit = monthlyRev;
      billingModelName = en?'No center (100% teacher)':'بدون سنتر (100% للمعلم)';
    } else if (g.billing_model === 'fixed_per_student') {
      const cut = Number(g.fixed_per_student_amount || 0);
      netProfit = Math.max(0, (price - cut) * studentCount * monthlySessions);
      billingModelName = en?`Fixed fee (${cut} EGP/student)`:`أجر ثابت (${cut} ج.م/طالب)`;
    } else if (g.billing_model === 'fixed_rent') {
      const rent = Number(g.fixed_rent_amount || 0);
      netProfit = Math.max(0, monthlyRev - (rent * monthlySessions));
      billingModelName = en?`Room rent (${rent} EGP/class)`:`إيجار قاعة (${rent} ج.م/حصة)`;
    } else if (g.center_cut_percentage !== undefined && g.center_cut_percentage !== null) {
      const pct = Number(g.center_cut_percentage);
      billingModelName = en?`Center share (${pct}%)`:`نسبة سنتر (${pct}%)`;
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

  const reportMonth = Number(data.actualEarnings?.month) || new Date().getMonth() + 1;
  const reportYear = Number(data.actualEarnings?.year) || new Date().getFullYear();
  const processedAssistants = activeAssistants.map(a => {
    const isPerSession = a.salary_model === 'per_session';
    const rate = Number(a.salary ?? a.salary_amount ?? 0);
    const pay = assistantPay(a,{month:reportMonth,year:reportYear},en?'en':'ar');
    const monthlyDeduction = pay.amount;
    const calculationBasis = pay.basis;

    calculatedAssistantSalaries += monthlyDeduction;

    const matchedGroup = groups.find(g => g.id === a.group_id);
    let roleText = en?'Administrative and educational':'إداري وتعليمي شامل';
    if (a.role_type === 'admin') roleText = en?'Administrative':'إداري وتنظيمي فقط';
    else if (a.role_type === 'educational') roleText = en?'Educational':'تعليمي وتدريسي فقط';
    if (a.access) roleText = en?'Custom permissions':'صلاحيات محددة';

    return {
      ...a,
      rate,
      isPerSession,
      monthlyDeduction,
      payrollAvailable: pay.available,
      calculationBasis,
      roleText,
      assignedGroupName: matchedGroup ? matchedGroup.name : (en?'All groups':'جميع المجاميع (إشراف عام)'),
    };
  });

  const payrollAvailable = processedAssistants.every(a => a.payrollAvailable);
  const finalMonthlyRevenue = calculatedMonthlyRev;
  const grossTeacherProfit = calculatedTeacherProfit; // after center cut
  const totalCenterCut = Math.max(0, finalMonthlyRevenue - grossTeacherProfit);
  const totalAssistantSalaries = calculatedAssistantSalaries;
  const finalTeacherProfit = Math.max(0, grossTeacherProfit - totalAssistantSalaries);
  const finalTotalStudents = (Number(stats.totalStudents) > 0) ? stats.totalStudents : totalEnrolledStudents;

  // Actual realized earnings data from completed sessions
  const actualEarnings = data.actualEarnings || null;
  const hasActualEarnings = Boolean(actualEarnings && Array.isArray(actualEarnings.sessions) && ['actual_revenue','actual_center_cut','actual_teacher_net','completed_sessions_count','total_attended_students'].every(key => typeof actualEarnings[key] === 'number' && Number.isFinite(actualEarnings[key])));
  const actualRevenue = Number(actualEarnings?.actual_revenue || 0);
  const actualCenterCut = Number(actualEarnings?.actual_center_cut || 0);
  const actualTeacherNet = Number(actualEarnings?.actual_teacher_net || 0);
  const completedSessionsCount = Number(actualEarnings?.completed_sessions_count || 0);
  const totalAttendedStudents = Number(actualEarnings?.total_attended_students || 0);
  const completedSessions = hasActualEarnings ? actualEarnings.sessions : [];

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'إبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const currentMonthIdx = actualEarnings?.month ? actualEarnings.month - 1 : new Date().getMonth();
  const currentMonthName = en?new Intl.DateTimeFormat('en',{month:'long',timeZone:'UTC'}).format(new Date(Date.UTC(2020,currentMonthIdx,1))):(monthNames[currentMonthIdx] || 'الحالي');
  const currentYearNum = actualEarnings?.year || new Date().getFullYear();

  const isFinancialHidden = !!hideNumbers;
  const displayRev = isFinancialHidden ? '••••••' : `${finalMonthlyRevenue.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;
  const displayCenterCut = isFinancialHidden ? '••••••' : `${totalCenterCut.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;
  const displayAssistants = isFinancialHidden ? '••••••' : !payrollAvailable ? (en?'Unavailable':'غير متاح') : `${totalAssistantSalaries.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;
  const displayProfit = isFinancialHidden ? '••••••' : !payrollAvailable ? (en?'Unavailable':'غير متاح') : `${finalTeacherProfit.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;

  // Actual financial displays
  const displayActualRev = isFinancialHidden ? '••••••' : !hasActualEarnings ? '—' : `${actualRevenue.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;
  const displayActualCenterCut = isFinancialHidden ? '••••••' : !hasActualEarnings ? '—' : `${actualCenterCut.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;
  const displayActualTeacherNet = isFinancialHidden ? '••••••' : !hasActualEarnings ? '—' : `${actualTeacherNet.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="${en?'ltr':'rtl'}">
      
      <div style="display:flex;justify-content:flex-end"><button class="btn btn-secondary" style="min-height:44px" onclick="window.centrlyApp.toggleHideFinancialNumbers()">${hideNumbers?(en?'Show amounts':'إظهار الأرقام'):(en?'Hide amounts':'إخفاء الأرقام')}</button></div>
      <!-- Welcome & Quick Start Banner (Swiss Minimalist) -->
      <div class="card" style="margin: 0; background: #0f172a; color: #ffffff; border: 1px solid #1e293b; border-radius: 8px; padding: 1rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.85rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <span style="font-size: 0.78rem; color: #94a3b8; font-weight: 700;">${en?'Teacher overview and earnings':'لوحة المتابعة والأرباح العامة للمدرس'}</span>
            </div>
            <h2 style="font-size: 1.15rem; font-weight: 800; margin: 0.25rem 0 0 0; color: #ffffff;">${en?'Welcome,':'مرحباً بك،'} ${escapeHtml(displayName)}</h2>
            <p style="font-size: 0.78rem; color: #94a3b8; margin: 0.2rem 0 0 0; line-height: 1.5;">
              ${en?'Attendance value is estimated using current prices; changing prices can change estimates for past classes. Check the collection ledger for payments received.':'تقدير قيمة الحصص من واقع الحضور بالأسعار الحالية؛ تغيير الأسعار قد يغيّر تقدير الحصص السابقة. راجع سجل التحصيل للمبالغ المستلمة فعلًا.'}
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn" style="background:#fff;color:#0f172a;min-height:44px" onclick="window.centrlyApp.openCollectionLedger()">${en?'Collection ledger':'سجل التحصيل الفعلي'}</button>
            <button class="btn" style="background: rgba(255,255,255,0.08); color: #ffffff; font-weight: 600; border: 1px solid rgba(255,255,255,0.18); border-radius: 6px; height: 30px; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 0.35rem;" onclick="window.centrlyApp.navigate('calendar')">
              ${getIcon('calendar', 14, '#ffffff')}
              <span>${en?'Class calendar':'جدول الحصص'}</span>
            </button>
            <button class="btn" style="background: #ffffff; color: #0f172a; font-weight: 700; border: 1px solid #ffffff; border-radius: 6px; height: 30px; font-size: 0.76rem; display: inline-flex; align-items: center; gap: 0.35rem;" onclick="window.centrlyApp.navigate('sessions')">
              ${getIcon('sessions', 14, '#0f172a')}
              <span>${en?'Classes':'لوحة الحصص'}</span>
            </button>
          </div>
        </div>
      </div>

      ${renderTeacherActions(data)}
      <!-- Hero Financial Highlights: Actual Realized vs Estimated Projected -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
        
        <!-- 1. Actual Realized Profit Hero Card -->
        <div class="card" style="margin: 0; background: linear-gradient(135deg, #064e3b 0%, #047857 100%); color: #fff; border: 1px solid #059669; box-shadow: 0 4px 14px rgba(4, 120, 87, 0.25); border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="badge" style="background: rgba(255,255,255,0.22); color: #ecfdf5; font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem; border-radius: 6px;">
                ${en?'Attendance value ·':'قيمة الحضور • شهر'} ${escapeHtml(currentMonthName)} ${currentYearNum}
              </span>
              <div style="font-size: 1.05rem; font-weight: 800; color: #a7f3d0; margin-top: 0.6rem;">
                ${en?'Estimated teacher earnings':'صافي الاستحقاق التقديري للمدرس'}
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
              ${hasActualEarnings?`${en?'Based on':'محسوب من'} <strong>${completedSessionsCount}</strong> ${en?'completed classes (':'حصة منتهية ('}<strong>${totalAttendedStudents}</strong> ${en?'attendances)':'حضور فعلي)'}`:(en?'Attendance estimates unavailable':'تعذر تحميل تقديرات الحضور')}
            </div>
            <div style="background: rgba(0,0,0,0.15); padding: 0.2rem 0.5rem; border-radius: 4px;">
              ${en?'Attendance value:':'قيمة الحضور:'} <strong>${displayActualRev}</strong>
            </div>
          </div>
        </div>

        <!-- 2. Estimated Projected Revenue Hero Card -->
        <div class="card" style="margin: 0; background: #ffffff; border: 1px solid #e2e8f0; border-top: 4px solid var(--centrly-blue-700); box-shadow: var(--shadow-sm); border-radius: 12px; padding: 1.25rem;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <span class="badge badge-blue" style="font-size: 0.75rem; font-weight: 800; padding: 0.25rem 0.6rem;">
                ${en?'Monthly estimate (assuming 100% attendance)':'تقديري شهري (بافتراض حضور 100%)'}
              </span>
              <div style="font-size: 1.05rem; font-weight: 800; color: #1e3a8a; margin-top: 0.6rem;">
                ${en?'Estimated monthly net earnings':'صافي الأرباح التقديرية المتوقعة'}
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
              ${en?'For all enrolled students':'لكافة الطلاب المقيدين'} (<strong>${finalTotalStudents}</strong> ${en?'students':'طالب'})
            </div>
            <div style="background: #f8fafc; padding: 0.2rem 0.5rem; border-radius: 4px;">
              ${en?'Estimated total:':'إجمالي المتوقع:'} <strong style="color: var(--centrly-success);">${displayRev}</strong>
            </div>
          </div>
        </div>

      </div>

      <!-- Financial Breakdown & Operations Secondary KPIs -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        
        <!-- Center Cut Actual vs Projected -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #f59e0b;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">${en?'Center deductions':'استقطاعات وحصة السنتر'}</span>
            <span style="color: #f59e0b;">${getIcon('rooms', 20)}</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #b45309; margin-top: 0.4rem; font-family: monospace;">
            ${displayActualCenterCut}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            ${en?'Estimated center share (monthly estimate:':'حصة السنتر المقدرة (المتوقع شهرياً:'} ${displayCenterCut})
          </div>
        </div>

        <!-- Assistant Salaries -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #e11d48;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">${en?'Assistant compensation':'مرتبات ومستحقات المساعدين'}</span>
            <span style="color: #e11d48;">${getIcon('assistants', 20)}</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #be123c; margin-top: 0.4rem; font-family: monospace;">
            ${displayAssistants}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            ${payrollAvailable ? (en?'Deducted':'مخصومة') : (en?'Reload payroll data':'أعد تحميل بيانات المرتبات')} (${processedAssistants.length} ${en?'active assistants':'مساعد نشط'})
          </div>
        </div>

        <!-- Active Students -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #6366f1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">${en?'Enrolled students':'الطلاب المقيدين'}</span>
            <span style="color: #6366f1;">${getIcon('students', 20)}</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.4rem;">
            ${finalTotalStudents} <span style="font-size: 0.85rem; font-weight: 500;">${en?'students':'طالب'}</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            ${en?'Across':'في'} ${stats.activeGroups || groups.length} ${en?'active groups':'مجاميع نشطة'}
          </div>
        </div>

        <!-- Attendance Rate -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-warning);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">${en?'Daily attendance rate':'نسبة الحضور اليومي'}</span>
            <span style="color: var(--centrly-warning);">${getIcon('activity', 20)}</span>
          </div>
          <div style="font-size: 1.6rem; font-weight: 900; color: #d97706; margin-top: 0.4rem;">
            ${stats.todayAttendanceRate}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            ${en?'Based on today’s active classes':'من واقع حصص اليوم الجارية'}
          </div>
        </div>

      </div>

      <!-- Completed Sessions Financial Statement Table (التحصيل الفعلي من واقع الحضور) -->
      <div class="card" style="margin: 0; border-top: 3px solid #059669;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem; color: #065f46;">
              ${getIcon('billing', 18, '#059669')}
              <span>${en?'Attendance value for classes completed this month':'كشف قيمة الحضور للحصص المنتهية هذا الشهر'}</span>
            </h3>
            <p style="font-size: 0.78rem; color: var(--centrly-text); margin-top: 0.2rem;">
              ${en?'These estimates use attendance, exemptions and the center billing model.':'يتم احتساب هذه الأرقام تلقائياً من واقع حضور الطلاب الفعلي في كل حصة بعد انتهاء الحصة، مع مراعاة الطلاب المعفيين ونظام محاسبة السنتر.'}
            </p>
          </div>
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span class="badge" style="background: #ecfdf5; color: #065f46; font-weight: 800; font-size: 0.8rem; border: 1px solid #a7f3d0;">
              ${en?'':'شهر'} ${escapeHtml(currentMonthName)} ${currentYearNum}
            </span>
          </div>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>${en?'Class and date':'الحصة والتاريخ'}</th>
                <th>${en?'Group':'المجموعة'}</th>
                <th>${en?'Center / room':'السنتر / القاعة'}</th>
                <th>${en?'Billing model':'نظام المحاسبة'}</th>
                <th>${en?'Attendance':'الحضور الفعلي'}</th>
                <th>${en?'Attendance value':'قيمة الحضور'}</th>
                <th>${en?'Center share':'حصة السنتر'}</th>
                <th>${en?'Teacher net':'صافي ربح المدرس'}</th>
              </tr>
            </thead>
            <tbody>
              ${completedSessions.length > 0 ? completedSessions.map(cs => {
                const pRev = isFinancialHidden ? '••••••' : typeof cs.total_revenue === 'number' && Number.isFinite(cs.total_revenue) ? `${cs.total_revenue.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}` : '—';
                const pCenter = isFinancialHidden ? '••••••' : typeof cs.center_share === 'number' && Number.isFinite(cs.center_share) ? `${cs.center_share.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}` : '—';
                const pTeacher = isFinancialHidden ? '••••••' : typeof cs.teacher_share === 'number' && Number.isFinite(cs.teacher_share) ? `${cs.teacher_share.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}` : '—';

                let modelBadge = en?'Center share':'نسبة سنتر';
                if (cs.billing_model === 'no_center') modelBadge = en?'No center (100% teacher)':'بدون سنتر (100% للمدرس)';
                else if (cs.billing_model === 'fixed_rent') modelBadge = en?'Room rent':'إيجار قاعة';
                else if (cs.billing_model === 'fixed_per_student') modelBadge = en?'Fixed fee per student':'أجر ثابت/طالب';

                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--centrly-ink);">
                      ${en?'Class':'حصة'} ${escapeHtml(cs.session_number ? String(cs.session_number) : '—')}
                      <div style="font-size: 0.75rem; color: #64748b; font-weight: normal; font-family: monospace;">
                        ${escapeHtml(cs.session_date)}
                      </div>
                    </td>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">
                      ${escapeHtml(cs.group_name)}
                    </td>
                    <td>
                      <span class="badge badge-blue">${escapeHtml(cs.center_name || (en?'Center':'سنتر تعليمي'))}</span>
                    </td>
                    <td style="font-size: 0.8rem; color: var(--centrly-text);">
                      ${escapeHtml(modelBadge)}<div>${cs.pricing_basis === "captured_at_close" ? (en ? "Prices at close" : "الأسعار المثبتة عند الإنهاء") : (en ? "Estimate at current prices" : "تقدير بالأسعار الحالية")}</div>
                    </td>
                    <td>
                      <span class="badge badge-success" style="font-weight: 700;">
                        ${cs.present_count} ${en?'present':'حاضر'}
                      </span>
                      ${cs.absent_count > 0 ? `
                        <span class="badge" style="background: #f1f5f9; color: #64748b; margin-right: 0.2rem;">
                          ${cs.absent_count} ${en?'absent':'غائب'}
                        </span>
                      ` : ''}
                      ${cs.exempt_count > 0 ? `
                        <span class="badge" style="background: #eff6ff; color: #1d4ed8; margin-right: 0.2rem;">
                          ${cs.exempt_count} ${en?'exempt':'معفي'}
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
                      ${hasActualEarnings?(en?'No completed classes recorded in':'لم تُسجل أي حصص منتهية بعد خلال شهر'):(en?'Could not load attendance estimates for':'تعذر تحميل تقديرات الحضور لشهر')} ${escapeHtml(currentMonthName)} ${currentYearNum}
                    </div>
                    <div style="font-size: 0.85rem; max-width: 520px; margin: 0 auto; line-height: 1.6; color: #64748b;">
                      ${en?'Estimates use recorded attendance and current prices. Use the collection ledger for payments received.':'تُحسب التقديرات من الحضور المسجل والأسعار الحالية. راجع سجل التحصيل للمبالغ المستلمة.'}
                    </div>
                    <div style="margin-top: 1rem;">
                      <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('sessions')" style="font-weight: 700;">
                        ${en?'Open classes and record attendance':'الانتقال إلى لوحة الحصص وتسجيل الحضور'}
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
                    ${en?'Total attendance value for completed classes':'إجمالي قيمة الحضور للحصص المنتهية'} (${escapeHtml(currentMonthName)} ${currentYearNum}):
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
              <span>${en?'Active groups and estimated earnings':'بيان المجاميع النشطة والعائد المالي المقدر'}</span>
            </h3>
            <span style="font-size: 0.78rem; color: var(--centrly-text);">
              ${en?'Financial information is available to the teacher and owner only':'البيانات المالية خاصة بحساب المعلم والمالك فقط'}
            </span>
          </div>

          <div style="overflow-x: auto; margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${en?'Group':'المجموعة'}</th>
                  <th>${en?'Center / room':'السنتر / القاعة'}</th>
                  <th>${en?'Class fee':'سعر الحصة'}</th>
                  <th>${en?'Class frequency':'تكرار الحصص'}</th>
                  <th>${en?'Billing model':'نظام المحاسبة'}</th>
                  <th>${en?'Students':'عدد الطلاب'}</th>
                  <th>${en?'Estimated monthly revenue':'الدخل الشهري المقدر'}</th>
                  <th>${en?'Teacher net share':'صافي حصة المدرس'}</th>
                </tr>
              </thead>
              <tbody>
                ${processedGroups.length > 0 ? processedGroups.map(g => {
                  const pRev = isFinancialHidden ? '••••••' : `${g.monthlyRev.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;
                  const pProfit = isFinancialHidden ? '••••••' : `${g.netProfit.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;
                  const pPrice = `${escapeHtml(g.price)} ${en?'EGP':'ج.م'}`;

                  return `
                    <tr>
                      <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(g.name)}</td>
                      <td><span class="badge badge-blue">${escapeHtml(g.center_name || (en?'Center':'سنتر تعليمي'))}</span></td>
                      <td style="font-weight: 700; font-family: monospace;">${pPrice}</td>
                      <td style="font-size: 0.825rem; font-weight: 700; color: #1e3a8a;">
                        ${en?`${g.sessionsPerWeek} classes/week`:`${g.sessionsPerWeek} ${g.sessionsPerWeek === 2 ? 'حصتان' : (g.sessionsPerWeek > 2 ? 'حصص' : 'حصة')}/أسبوع`}
                        <div style="font-size: 0.72rem; color: #64748b; font-weight: 500;">(${g.monthlySessions} ${en?'classes per month':'حصص شهرياً'})</div>
                      </td>
                      <td style="font-size: 0.825rem; color: var(--centrly-text);">
                        ${escapeHtml(g.billingModelName)}
                      </td>
                      <td style="font-weight: 700;">${escapeHtml(g.studentCount)} ${en?'students':'طلاب'}</td>
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
                      ${en?'No active groups yet. Create your first group to track earnings.':'لا توجد مجاميع نشطة بعد. أنشئ مجموعتك الأولى للبدء في تتبع الأرباح.'}
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
                <span>${en?'Assistant compensation deductions':'بيان استقطاعات مرتبات المساعدين من الأرباح'}</span>
              </h3>
              <p style="font-size: 0.78rem; color: var(--centrly-text); margin-top: 0.2rem;">
                ${en?'Assistant compensation is deducted according to the selected billing model.':'يتم خصم مستحقات المساعدين تلقائياً من أرباح المدرس الصافية وفقاً لنظام المحاسبة المحدد (شهري أو بالحصة).'}
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('assistants')" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
              ${getIcon('edit', 14)}
              <span>${en?'Manage assistants':'إدارة وتعديل المساعدين'}</span>
            </button>
          </div>

          <div style="overflow-x: auto; margin-top: 1rem;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>${en?'Assistant name':'اسم المساعد'}</th>
                  <th>${en?'Phone':'رقم الهاتف'}</th>
                  <th>${en?'Role':'طبيعة الدور'}</th>
                  <th>${en?'Assigned group':'المجموعة المسندة'}</th>
                  <th>${en?'Billing model':'نظام المحاسبة'}</th>
                  <th>${en?'Monthly calculation':'أساس الحساب الشهري'}</th>
                  <th>${en?'Deduction':'القيمة المخصومة'}</th>
                </tr>
              </thead>
              <tbody>
                ${processedAssistants.length > 0 ? processedAssistants.map(a => {
                  const pRate = isFinancialHidden ? '••••••' : `${a.rate.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;
                  const pDeduction = isFinancialHidden ? '••••••' : !a.payrollAvailable ? (en?'Unavailable':'غير متاح') : `${a.monthlyDeduction.toLocaleString(en?'en':'ar-EG')} ${en?'EGP':'ج.م'}`;

                  return `
                    <tr>
                      <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(a.name)}</td>
                      <td dir="ltr" style="text-align: right; font-family: monospace;">${escapeHtml(a.phone || '—')}</td>
                      <td><span class="badge badge-secondary">${escapeHtml(a.roleText)}</span></td>
                      <td><span class="badge badge-blue">${escapeHtml(a.assignedGroupName)}</span></td>
                      <td>
                        <span class="badge ${a.isPerSession ? 'badge-amber' : 'badge-success'}">
                          ${escapeHtml(assistantPay(a,{month:reportMonth,year:reportYear},en?'en':'ar').modelLabel)}
                        </span>
                      </td>
                      <td style="font-size: 0.825rem; color: var(--centrly-text);">
                        ${escapeHtml(a.calculationBasis)}
                      </td>
                      <td style="font-weight: 800; color: #be123c; font-family: monospace; font-size: 1rem;">
                        ${a.payrollAvailable || isFinancialHidden ? '-' : ''}${pDeduction}
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="7" style="text-align: center; padding: 2rem; color: var(--centrly-text);">
                      <div style="color: #64748b; margin-bottom: 0.5rem;">
                        ${en?'No assistant compensation has been recorded yet.':'لا توجد مرتبات مساعدين مسجلة حتى الآن.'}
                      </div>
                      <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('assistants')" style="font-weight: 700;">
                        ${en?'Add an assistant and compensation':'إضافة مساعد وتسجيل مرتبه'}
                      </button>
                    </td>
                  </tr>
                `}
              </tbody>
              ${processedAssistants.length > 0 ? `
                <tfoot>
                  <tr style="background: #fff1f2; font-weight: 800;">
                    <td colspan="6" style="text-align: left; color: #9f1239; font-size: 0.95rem;">
                      ${en?'Total assistant deductions this month:':'إجمالي مستقطعات مرتبات المساعدين لهذا الشهر:'}
                    </td>
                    <td style="color: #be123c; font-family: monospace; font-size: 1.1rem;">
                      ${payrollAvailable || isFinancialHidden ? '-' : ''}${displayAssistants}
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
