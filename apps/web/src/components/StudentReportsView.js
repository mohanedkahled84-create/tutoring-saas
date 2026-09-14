import { renderStudentSearchBar } from "./StudentSearchBar.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Teacher Reports & Monthly Performance View (DEV-89 & DEV-72)
 * Dual-Mode View:
 * 1. Academic Performance & Honor Roll Leaderboard
 * 2. Teacher Financial Report with Assistant Salary Deductions and Center Cut Breakdown
 */
export function renderStudentReportsView(
  state = {},
  securityState = { hasPin: false, isUnlocked: true, hideNumbers: false }
) {
  const {
    activeTab = "academic",
    period = { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    leaderboard = [],
    groups = [],
    assistants = [],
    students: allStudents = [],
    selectedGroupId = "",
    searchQuery = "",
    total_students = 0,
    average_attendance_rate = 0,
    average_score = 0,
    isSubmittingBulk = false,
    dispatchedMonths = {},
  } = state;

  const { hasPin, isUnlocked, hideNumbers } = securityState;
  const currentMonth = period.month || (new Date().getMonth() + 1);
  const currentYear = period.year || new Date().getFullYear();
  const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const dispatchedInfo = dispatchedMonths[monthKey];
  const isMonthDispatched = Boolean(dispatchedInfo);

  const monthNames = [
    "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
    "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"
  ];

  const students = leaderboard || [];

  // ----------------------------------------------------
  // Financial computations for Teacher Monthly Report
  // ----------------------------------------------------
  let totalGrossRevenue = 0;
  let totalGrossTeacherProfit = 0;

  const processedGroups = groups.map(g => {
    const enrolledCount = (allStudents || []).filter(s => s.group_id === g.id || (Array.isArray(s.group_ids) && s.group_ids.includes(g.id))).length;
    const count = enrolledCount || Number(g.students_count || g.student_count || 0);
    const price = Number(g.price ?? g.session_price ?? 0);
    const monthlyGross = price * count * 4;
    let netProfit = Math.round(monthlyGross * 0.8);
    let billingModelName = 'نسبة سنتر (20%)';
    let centerCut = Math.round(monthlyGross * 0.2);

    if (g.billing_model === 'fixed_per_student') {
      const cut = Number(g.fixed_per_student_amount || 0);
      netProfit = Math.max(0, (price - cut) * count * 4);
      centerCut = cut * count * 4;
      billingModelName = `أجر ثابت (${cut} ج.م/طالب)`;
    } else if (g.billing_model === 'fixed_rent') {
      const rent = Number(g.fixed_rent_amount || 0);
      netProfit = Math.max(0, monthlyGross - (rent * 4));
      centerCut = rent * 4;
      billingModelName = `إيجار قاعة (${rent} ج.م/حصة)`;
    } else if (g.center_cut_percentage !== undefined && g.center_cut_percentage !== null) {
      const pct = Number(g.center_cut_percentage);
      centerCut = Math.round(monthlyGross * (pct / 100));
      netProfit = monthlyGross - centerCut;
      billingModelName = `نسبة سنتر (${pct}%)`;
    }

    totalGrossRevenue += monthlyGross;
    totalGrossTeacherProfit += netProfit;

    return {
      ...g,
      studentCount: count,
      price,
      monthlyGross,
      centerCut,
      netProfit,
      billingModelName,
    };
  });

  const totalCenterCut = Math.max(0, totalGrossRevenue - totalGrossTeacherProfit);

  // Assistant Deductions calculation
  const rawAssistants = Array.isArray(assistants) ? assistants : [];
  const activeAssistants = rawAssistants.filter(a => a.status !== 'inactive');
  let totalAssistantSalaries = 0;

  const processedAssistants = activeAssistants.map(a => {
    const isPerSession = a.salary_model === 'per_session';
    const rate = Number(a.salary ?? a.salary_amount ?? 0);
    let monthlyDeduction = 0;
    let calculationBasis = '';

    if (isPerSession) {
      if (a.group_id) {
        const matched = groups.find(g => g.id === a.group_id);
        const grpName = matched ? matched.name : 'مجموعة مخصصة';
        monthlyDeduction = rate * 4;
        calculationBasis = `4 حصص شهرياً في ${grpName} (${rate.toLocaleString('ar-EG')} ج.م/حصة)`;
      } else {
        const totalGroups = groups.length > 0 ? groups.length : 1;
        const totalSessions = totalGroups * 4;
        monthlyDeduction = rate * totalSessions;
        calculationBasis = `${totalSessions} حصة شهرياً لكافة المجاميع (${rate.toLocaleString('ar-EG')} ج.م/حصة)`;
      }
    } else {
      monthlyDeduction = rate;
      calculationBasis = 'مرتب شهري ثابت';
    }

    totalAssistantSalaries += monthlyDeduction;

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

  const finalNetProfit = Math.max(0, totalGrossTeacherProfit - totalAssistantSalaries);

  const displayRev = hideNumbers ? '••••••' : `${totalGrossRevenue.toLocaleString('ar-EG')} ج.م`;
  const displayCenter = hideNumbers ? '••••••' : `${totalCenterCut.toLocaleString('ar-EG')} ج.م`;
  const displayAssistants = hideNumbers ? '••••••' : `${totalAssistantSalaries.toLocaleString('ar-EG')} ج.م`;
  const displayNet = hideNumbers ? '••••••' : `${finalNetProfit.toLocaleString('ar-EG')} ج.م`;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Sub-Navigation Tabs: Academic vs Financial -->
      <div class="card" style="margin: 0; padding: 0.75rem 1rem; background: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button 
              class="btn ${activeTab !== 'financial' ? 'btn-primary' : 'btn-secondary'}" 
              onclick="window.centrlyApp.switchReportsTab('academic')"
              style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.5rem 1.1rem;"
            >
              ${getIcon('reports', 16)}
              <span>لوحة الشرف ودرجات الطلاب (الأكاديمي)</span>
            </button>
            <button 
              class="btn ${activeTab === 'financial' ? 'btn-primary' : 'btn-secondary'}" 
              onclick="window.centrlyApp.switchReportsTab('financial')"
              style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.5rem 1.1rem;"
            >
              ${getIcon('billing', 16)}
              <span>التقرير المالي واستقطاعات المساعدين (المالي)</span>
            </button>
          </div>

          ${activeTab === 'financial' ? `
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              ${hasPin ? `
                <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleHideFinancialNumbers()" style="font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
                  <span>${hideNumbers ? getIcon('eye', 14) : getIcon('eyeOff', 14)}</span>
                  <span>${hideNumbers ? 'إظهار الأرقام' : 'إخفاء الأرقام'}</span>
                </button>
              ` : ''}
              <button class="btn btn-secondary btn-sm" onclick="window.print()" style="font-weight: 700; display: flex; align-items: center; gap: 0.35rem;">
                ${getIcon('materials', 14)}
                <span>طباعة التقرير</span>
              </button>
            </div>
          ` : `
            <button
              class="btn btn-secondary btn-sm"
              onclick="window.centrlyApp.loadRouteData('reports')"
              style="display: flex; align-items: center; gap: 0.45rem; font-weight: 700;"
              title="تحديث البيانات فوراً"
            >
              ${getIcon('refresh', 14)}
              <span>تحديث القائمة</span>
            </button>
          `}
        </div>
      </div>

      ${activeTab === 'financial' ? (
        hasPin && !isUnlocked ? `
          <!-- Locked Gate for Financial Report -->
          <div class="card" style="margin: 0; padding: 2.5rem 1.5rem; text-align: center; background: #fff;">
            <div style="max-width: 420px; margin: 0 auto; display: flex; flex-direction: column; align-items: center; gap: 0.75rem;">
              <div style="width: 56px; height: 56px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #1d4ed8;">
                ${getIcon('lock', 28, '#1d4ed8')}
              </div>
              <h3 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin: 0;">التقرير المالي مقفل برمز الأمان</h3>
              <p style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.6;">
                أدخل رمز الأمان (PIN) للاطلاع على تفاصيل الإيرادات وحصة السنتر ومرتبات المساعدين المستقطعة.
              </p>
              <button class="btn btn-primary" onclick="window.centrlyApp.promptUnlockFinancials()" style="padding: 0.65rem 1.75rem; font-size: 0.9rem; font-weight: 800; display: flex; align-items: center; gap: 0.4rem; margin-top: 0.35rem;">
                ${getIcon('lock', 16)}
                <span>إدخال رمز PIN لفتح التقرير</span>
              </button>
            </div>
          </div>
        ` : `
          <!-- FINANCIAL TAB CONTENT -->

          <!-- Period Selector Banner -->
          <div class="card" style="margin: 0;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <h2 class="card-title" style="margin: 0; font-size: 1.3rem; display: flex; align-items: center; gap: 0.5rem;">
                  <span>${getIcon('billing', 22, 'var(--centrly-blue-700)')}</span>
                  <span>التقرير المالي الشامل للمعلم لشهر ${monthNames[currentMonth - 1]} ${currentYear}</span>
                </h2>
                <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
                  حساب إجمالي اشتراكات الطلاب، استقطاعات ونسب السنتر، وخصم مرتبات فريق المساعدين للوصول إلى صافي الربح الفعلي.
                </p>
              </div>

              <div style="display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
                <div style="display: flex; gap: 0.4rem; align-items: center;">
                  <label style="font-size: 0.85rem; font-weight: 700;">الشهر:</label>
                  <select
                    id="reportsMonthSelect"
                    class="form-select"
                    style="width: 120px;"
                    onchange="window.centrlyApp.handleReportsPeriodChange(this.value, document.getElementById('reportsYearSelect').value)"
                  >
                    ${monthNames.map((name, i) => `
                      <option value="${i + 1}" ${i + 1 === currentMonth ? "selected" : ""}>${name}</option>
                    `).join("")}
                  </select>
                </div>

                <div style="display: flex; gap: 0.4rem; align-items: center;">
                  <label style="font-size: 0.85rem; font-weight: 700;">السنة:</label>
                  <select
                    id="reportsYearSelect"
                    class="form-select"
                    style="width: 95px;"
                    onchange="window.centrlyApp.handleReportsPeriodChange(document.getElementById('reportsMonthSelect').value, this.value)"
                  >
                    ${[currentYear - 1, currentYear, currentYear + 1].map((yr) => `
                      <option value="${yr}" ${yr === currentYear ? "selected" : ""}>${yr}</option>
                    `).join("")}
                  </select>
                </div>
              </div>
            </div>

            <!-- Net Calculation Formula Alert -->
            <div style="margin-top: 1rem; padding: 0.85rem 1.15rem; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; display: flex; align-items: center; gap: 0.65rem;">
              <span style="color: #1d4ed8; display: flex; align-items: center;">${getIcon('info', 20)}</span>
              <div style="font-size: 0.85rem; color: #1e40af; font-weight: 700; line-height: 1.5;">
                معادلة صافي المدرس: إجمالي الدخل (${displayRev}) - استقطاعات السنتر (${displayCenter}) - مرتبات المساعدين (${displayAssistants}) = صافي الربح النهائي (${displayNet})
              </div>
            </div>
          </div>

          <!-- Financial 4-KPI Rollup Cards -->
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 1rem;">
            
            <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
              <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الدخل الشهري المقدر</div>
              <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
                ${displayRev}
              </div>
              <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
                من اشتراكات الطلاب بكافة المجاميع
              </div>
            </div>

            <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #f59e0b;">
              <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">استقطاعات وحصة السنتر</div>
              <div style="font-size: 1.8rem; font-weight: 900; color: #b45309; margin-top: 0.35rem;">
                ${displayCenter}
              </div>
              <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
                أجر القاعات ونسب التشغيل المتفق عليها
              </div>
            </div>

            <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #e11d48;">
              <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي مرتبات المساعدين</div>
              <div style="font-size: 1.8rem; font-weight: 900; color: #be123c; margin-top: 0.35rem;">
                ${displayAssistants}
              </div>
              <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
                مخصومة بالكامل (${activeAssistants.length} مساعد نشط)
              </div>
            </div>

            <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
              <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">صافي أرباح المدرس النهائية</div>
              <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-blue-800); margin-top: 0.35rem;">
                ${displayNet}
              </div>
              <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
                صافي الربح الفعلي بعد كافة الاستقطاعات
              </div>
            </div>

          </div>

          <!-- Section 1: Active Groups Income & Center Cut Breakdown -->
          <div class="card" style="margin: 0;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('groups', 18, 'var(--centrly-blue-700)')}
                <span>1. تفاصيل إيرادات المجاميع واستقطاعات السنتر</span>
              </h3>
              <span style="font-size: 0.78rem; color: var(--centrly-text);">
                محسوب على أساس 4 حصص شهرياً لكل مجموعة
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
                    <th>إجمالي الدخل</th>
                    <th>استقطاع السنتر</th>
                    <th>حصة المدرس الصافية</th>
                  </tr>
                </thead>
                <tbody>
                  ${processedGroups.length > 0 ? processedGroups.map(g => {
                    const pGross = hideNumbers ? '••••••' : `${g.monthlyGross.toLocaleString('ar-EG')} ج.م`;
                    const pCenter = hideNumbers ? '••••••' : `${g.centerCut.toLocaleString('ar-EG')} ج.م`;
                    const pTeacher = hideNumbers ? '••••••' : `${g.netProfit.toLocaleString('ar-EG')} ج.م`;
                    const pPrice = hideNumbers ? '••••••' : `${escapeHtml(g.price)} ج.م`;

                    return `
                      <tr>
                        <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(g.name)}</td>
                        <td><span class="badge badge-blue">${escapeHtml(g.center_name || 'سنتر تعليمي')}</span></td>
                        <td style="font-weight: 700; font-family: monospace;">${pPrice}</td>
                        <td style="font-size: 0.825rem; color: var(--centrly-text);">${escapeHtml(g.billingModelName)}</td>
                        <td style="font-weight: 700;">${escapeHtml(g.studentCount)} طلاب</td>
                        <td style="font-weight: 800; color: var(--centrly-success); font-family: monospace;">${pGross}</td>
                        <td style="font-weight: 800; color: #b45309; font-family: monospace;">-${pCenter}</td>
                        <td style="font-weight: 800; color: var(--centrly-blue-800); font-family: monospace;">${pTeacher}</td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr>
                      <td colspan="8" style="text-align: center; padding: 2rem; color: var(--centrly-text);">
                        لا توجد مجاميع نشطة مسجلة لهذا الشهر.
                      </td>
                    </tr>
                  `}
                </tbody>
                ${processedGroups.length > 0 ? `
                  <tfoot>
                    <tr style="background: #f8fafc; font-weight: 800;">
                      <td colspan="5" style="text-align: left; font-size: 0.95rem;">الإجمالي قبل خصم مرتبات المساعدين:</td>
                      <td style="color: var(--centrly-success); font-family: monospace;">${displayRev}</td>
                      <td style="color: #b45309; font-family: monospace;">-${displayCenter}</td>
                      <td style="color: var(--centrly-blue-800); font-family: monospace;">${hideNumbers ? '••••••' : `${totalGrossTeacherProfit.toLocaleString('ar-EG')} ج.م`}</td>
                    </tr>
                  </tfoot>
                ` : ''}
              </table>
            </div>
          </div>

          <!-- Section 2: Assistant Deductions Breakdown -->
          <div class="card" style="margin: 0;">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
              <div>
                <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
                  ${getIcon('assistants', 18, '#e11d48')}
                  <span>2. كشف حساب واستقطاعات مرتبات المساعدين</span>
                </h3>
                <p style="font-size: 0.78rem; color: var(--centrly-text); margin-top: 0.2rem;">
                  يتم استقطاع هذه المبالغ دورياً من حصة المدرس لدفع رواتب ومكافآت المساعدين.
                </p>
              </div>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('assistants')" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
                ${getIcon('edit', 14)}
                <span>إدارة المساعدين</span>
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
                    <th>طريقة الاحتساب</th>
                    <th>المرتب المخصوم</th>
                  </tr>
                </thead>
                <tbody>
                  ${processedAssistants.length > 0 ? processedAssistants.map(a => {
                    const pDeduction = hideNumbers ? '••••••' : `${a.monthlyDeduction.toLocaleString('ar-EG')} ج.م`;

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
                        <td style="font-size: 0.825rem; color: var(--centrly-text);">${escapeHtml(a.calculationBasis)}</td>
                        <td style="font-weight: 800; color: #be123c; font-family: monospace; font-size: 1rem;">-${pDeduction}</td>
                      </tr>
                    `;
                  }).join('') : `
                    <tr>
                      <td colspan="7" style="text-align: center; padding: 2rem; color: var(--centrly-text);">
                        لا توجد مرتبات مساعدين مسجلة لهذا الشهر.
                      </td>
                    </tr>
                  `}
                </tbody>
                ${processedAssistants.length > 0 ? `
                  <tfoot>
                    <tr style="background: #fff1f2; font-weight: 800;">
                      <td colspan="6" style="text-align: left; color: #9f1239; font-size: 0.95rem;">
                        إجمالي خصومات مرتبات المساعدين:
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
        `
      ) : `
        <!-- ACADEMIC TAB CONTENT (Leaderboard & Student Performance) -->
        
        <!-- Top Action & Filter Bar -->
        <div class="card" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 class="card-title" style="margin: 0; font-size: 1.35rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>${getIcon('reports', 24, 'var(--centrly-blue-700)')}</span>
                <span>تقارير الأداء ولوحة الشرف والتميز</span>
              </h2>
              <p style="font-size: 0.85rem; color: var(--centrly-text); margin-top: 0.25rem;">
                متابعة درجات الكويزات، نسب الحضور والغياب، وإرسال تقارير واتساب الدورية لأولياء الأمور
              </p>
            </div>

            <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
              <button
                class="btn btn-secondary"
                onclick="window.centrlyApp.loadRouteData('reports')"
                style="display: flex; align-items: center; gap: 0.45rem; font-weight: 700;"
                title="تحديث درجات الكويزات والحضور فوراً من الخادم"
              >
                ${getIcon('refresh', 16)}
                <span>تحديث القائمة</span>
              </button>
              <div style="display: inline-flex; align-items: center; gap: 0.45rem; background: #f0fdf4; color: #166534; padding: 0.5rem 0.9rem; border-radius: 8px; border: 1px solid #bbf7d0; font-size: 0.825rem; font-weight: 700;">
                ${getIcon('check', 14, '#166534')}
                <span>التقارير ودرجات الكويزات متاحة ومحدثة لحظياً على بوابات أولياء الأمور</span>
              </div>
            </div>
          </div>

          <!-- Period and Group Selectors -->
          <div style="display: flex; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap; align-items: center; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <label style="font-size: 0.85rem; font-weight: 600;">الشهر:</label>
              <select
                id="reportsMonthSelect"
                class="form-select"
                style="width: 130px;"
                onchange="window.centrlyApp.handleReportsPeriodChange(this.value, document.getElementById('reportsYearSelect').value)"
              >
                ${monthNames.map((name, i) => `
                  <option value="${i + 1}" ${i + 1 === currentMonth ? "selected" : ""}>${name}</option>
                `).join("")}
              </select>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <label style="font-size: 0.85rem; font-weight: 600;">السنة:</label>
              <select
                id="reportsYearSelect"
                class="form-select"
                style="width: 100px;"
                onchange="window.centrlyApp.handleReportsPeriodChange(document.getElementById('reportsMonthSelect').value, this.value)"
              >
                ${[currentYear - 1, currentYear, currentYear + 1].map((yr) => `
                  <option value="${yr}" ${yr === currentYear ? "selected" : ""}>${yr}</option>
                `).join("")}
              </select>
            </div>

            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <label style="font-size: 0.85rem; font-weight: 600;">المجموعة:</label>
              <select
                id="reportsGroupSelect"
                class="form-select"
                style="min-width: 160px;"
                onchange="window.centrlyApp.handleReportsGroupChange(this.value)"
              >
                <option value="">جميع المجاميع</option>
                ${(groups || []).map((g) => `
                  <option value="${escapeHtml(g.id)}" ${g.id === selectedGroupId ? "selected" : ""}>${escapeHtml(g.name)}</option>
                `).join("")}
              </select>
            </div>
          </div>

          <!-- Universal Search Bar -->
          <div style="margin-top: 1rem;">
            ${renderStudentSearchBar({
              id: "reportsStudentSearch",
              value: searchQuery,
              placeholder: "ابحث بكود الطالب، اسمه، أو رقم ولي الأمر في لوحة الترتيب...",
              onInputHandler: "window.centrlyApp.handleReportsSearch(this.value)",
            })}
          </div>
        </div>

        <!-- Overview KPI Cards -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
          <div class="card" style="margin: 0; padding: 1.25rem;">
            <div style="font-size: 0.85rem; color: var(--centrly-text);">إجمالي الطلاب في التقرير</div>
            <div style="font-size: 1.75rem; font-weight: bold; margin-top: 0.25rem; color: var(--centrly-blue-700);">
              ${escapeHtml(total_students || students.length || 0)}
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 1.25rem;">
            <div style="font-size: 0.85rem; color: var(--centrly-text);">متوسط الالتزام بالحضور</div>
            <div style="font-size: 1.75rem; font-weight: bold; margin-top: 0.25rem; color: var(--centrly-success);">
              ${escapeHtml(average_attendance_rate || 0)}%
            </div>
          </div>

          <div class="card" style="margin: 0; padding: 1.25rem;">
            <div style="font-size: 0.85rem; color: var(--centrly-text);">متوسط درجات الاختبارات</div>
            <div style="font-size: 1.75rem; font-weight: bold; margin-top: 0.25rem; color: #7c3aed;">
              ${escapeHtml(average_score || 0)}%
            </div>
          </div>
        </div>

        <!-- Ranked Leaderboard Table -->
        <div class="card" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
            <h3 style="margin: 0; font-size: 1.15rem; font-weight: 700;">ترتيب الطلاب لشهر ${monthNames[currentMonth - 1]} ${currentYear}</h3>
            <span style="font-size: 0.8rem; color: var(--centrly-text);">
              الترتيب مبني على التقييم الأكاديمي والالتزام بالحضور
            </span>
          </div>

          <div style="overflow-x: auto;">
            <table class="data-table" id="leaderboardTable">
              <thead>
                <tr>
                  <th style="width: 80px; text-align: center;">الترتيب</th>
                  <th>كود الطالب</th>
                  <th>اسم الطالب</th>
                  <th>المجموعة</th>
                  <th>رقم ولي الأمر</th>
                  <th>نسبة الحضور</th>
                  <th>متوسط الدرجات</th>
                  <th>التقييم الشامل</th>
                  <th style="text-align: center;">إرسال تقرير منفصل</th>
                </tr>
              </thead>
              <tbody>
                ${students.length === 0 ? `
                  <tr>
                    <td colspan="9" style="text-align: center; padding: 3rem 1rem; color: var(--centrly-text);">
                      <div style="display: flex; justify-content: center; margin-bottom: 0.5rem; color: var(--centrly-blue-700);">
                        ${getIcon('reports', 36)}
                      </div>
                      <div style="font-weight: 600; font-size: 1rem; color: var(--centrly-ink);">لا توجد بيانات تقارير متاحة لهذه الفترة أو المجموعة</div>
                      <div style="font-size: 0.85rem; margin-top: 0.25rem;">تأكد من تسجيل الحضور وإدخال درجات الكويزات لحصص هذا الشهر</div>
                    </td>
                  </tr>
                ` : students.map((std) => {
                  const isTop1 = std.rank === 1;
                  const isTop2 = std.rank === 2;
                  const isTop3 = std.rank === 3;

                  const badgeBg =
                    isTop1 ? "background: #fef9c3; color: #854d0e; font-weight: bold; border: 1px solid #fde047;" :
                    isTop2 ? "background: #f1f5f9; color: #334155; font-weight: bold; border: 1px solid #cbd5e1;" :
                    isTop3 ? "background: #ffedd5; color: #9a3412; font-weight: bold; border: 1px solid #fdba74;" :
                    "color: var(--centrly-text);";

                  return `
                    <tr>
                      <td style="text-align: center;">
                        <span class="badge" style="${badgeBg} padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.85rem;">
                          ${isTop1 ? "#1" : isTop2 ? "#2" : isTop3 ? "#3" : `#${std.rank}`}
                        </span>
                      </td>
                      <td><code style="font-family: monospace; font-weight: 700; color: var(--centrly-blue-800);">${escapeHtml(std.student_code || "—")}</code></td>
                      <td style="font-weight: 700;">${escapeHtml(std.student_name)}</td>
                      <td><span class="badge badge-blue">${escapeHtml(std.group_name || "—")}</span></td>
                      <td dir="ltr" style="text-align: right; font-family: monospace;">${escapeHtml(std.parent_phone || "—")}</td>
                      <td>
                        <span class="badge ${std.attendance_rate >= 80 ? "badge-success" : std.attendance_rate >= 50 ? "badge-warning" : "badge-danger"}">
                          ${escapeHtml(std.attendance_rate)}% (${escapeHtml(std.attended_sessions)}/${escapeHtml(std.total_sessions)})
                        </span>
                      </td>
                      <td>
                        <span style="font-weight: 700; color: ${std.average_score >= 70 ? "var(--centrly-success)" : "var(--centrly-danger)"};">
                          ${escapeHtml(std.average_score)}%
                        </span>
                        <small style="color: var(--centrly-text);"> (${escapeHtml(std.total_quizzes)} كويز)</small>
                      </td>
                      <td>
                        <div style="font-weight: 800; color: var(--centrly-blue-700);">
                          ${escapeHtml(std.overall_score)}%
                        </div>
                      </td>
                      <td style="text-align: center;">
                        <button
                          class="btn btn-secondary btn-sm"
                          onclick="window.centrlyApp.handleSendIndividualReport('${escapeHtml(std.student_id)}', '${escapeHtml(std.student_name).replace(/'/g, "\\'")}')"
                          title="إرسال تقرير الواتساب لولي الأمر"
                          style="display: inline-flex; align-items: center; gap: 0.35rem;"
                        >
                          ${getIcon('whatsapp', 14)}
                          <span>إرسال التقرير</span>
                        </button>
                      </td>
                    </tr>
                  `;
                }).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `}

    </div>
  `;
}
