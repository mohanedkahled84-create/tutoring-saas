import { escapeHtml } from "../utils/escapeHtml.js";

/**
 * Centrly Teacher Dashboard (DEV-16)
 * KPI Rollup + At-Risk Watchlist (Warnings) + Top Performers (المتفوقين)
 */

export function renderTeacherDashboard(data = {}) {
  const stats = data.stats || {
    totalStudents: 0,
    activeGroups: 0,
    todayAttendanceRate: '0%',
    monthlyRevenue: 0,
    teacherProfit: 0,
    collectedToday: 0,
  };

  const groups = data.groups || [];
  const atRiskStudents = data.atRiskStudents || [];
  const topPerformers = data.topPerformers || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Welcome & Quick Start Banner -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, var(--centrly-blue-900), var(--centrly-blue-700)); color: #fff; border: none; box-shadow: var(--shadow-md);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          <div>
            <div style="font-size: 0.85rem; color: #93c5fd; font-weight: 700; margin-bottom: 0.25rem;">لوحة المتابعة والأرباح العامة</div>
            <h2 style="font-size: 1.5rem; font-weight: 900; margin: 0; color: #fff;">مرحباً بك، أ. محمد خالد 👋</h2>
            <p style="font-size: 0.875rem; color: #e2e8f0; margin-top: 0.35rem; max-width: 600px;">
              إليك ملخص أرباح الشهر الحالي، تفاصيل تحصيل المجاميع، ولوحة شرف المتفوقين ومؤشرات المتابعة.
            </p>
          </div>
          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn" style="background: #2563eb; color: #fff; font-weight: 700; border: 1px solid rgba(255,255,255,0.2);" onclick="window.centrlyApp.navigate('calendar')">
              📅 جدول الحصص
            </button>
            <button class="btn" style="background: #10b981; color: #fff; font-weight: 800; box-shadow: 0 4px 12px rgba(16,185,129,0.3);" onclick="window.centrlyApp.navigate('sessions')">
              ⚡ الدخول للحصة الجارية
            </button>
          </div>
        </div>
      </div>

      <!-- Financial & Operations KPI Grid (لوحة الأرباح والعمليات) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
        
        <!-- 1. Total Estimated Revenue -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #10b981;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الدخل المقدر (شهري)</span>
            <span style="font-size: 1.2rem;">💰</span>
          </div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #059669; margin-top: 0.4rem;">
            ${(stats.monthlyRevenue || 0).toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-weight: 600;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            محسوب بناءً على اشتراكات الطلاب
          </div>
        </div>

        <!-- 2. Teacher Net Profit -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">صافي أرباح المدرس المقدرة</span>
            <span style="font-size: 1.2rem;">📈</span>
          </div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-blue-800); margin-top: 0.4rem;">
            ${(stats.teacherProfit || 0).toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-weight: 600;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            بعد خصم نسبة السنتر (حوالي 80%)
          </div>
        </div>

        <!-- 3. Active Enrolled Students -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #6366f1;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الطلاب المقيدين</span>
            <span style="font-size: 1.2rem;">👥</span>
          </div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.4rem;">
            ${stats.totalStudents} <span style="font-size: 0.85rem; font-weight: 500;">طالب</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            موزعين على ${stats.activeGroups} مجاميع نشطة
          </div>
        </div>

        <!-- 4. Today Attendance Rate -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid #f59e0b;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نسبة الحضور اليومي</span>
            <span style="font-size: 1.2rem;">📊</span>
          </div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #d97706; margin-top: 0.4rem;">
            ${stats.todayAttendanceRate}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.35rem;">
            من واقع حصص اليوم الجارية
          </div>
        </div>

      </div>

      <!-- Active Groups & Performance Breakdown Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header">
          <h3 class="card-title" style="font-size: 1.05rem;">
            📊 بيان المجاميع النشطة والعائد المالي المقدر
          </h3>
          <span style="font-size: 0.8rem; color: var(--centrly-text);">
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
              ${groups.length > 0 ? groups.map(g => {
                const studentCount = g.students_count || (stats.totalStudents > 0 ? Math.ceil(stats.totalStudents / Math.max(1, groups.length)) : 3);
                const price = Number(g.price) || 120;
                const monthlyRev = price * studentCount * 4;
                const netProfit = Math.round(monthlyRev * 0.8);
                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(g.name)}</td>
                    <td><span class="badge badge-blue">${escapeHtml(g.center_name || 'سنتر تعليمي')}</span></td>
                    <td style="font-weight: 700; font-family: monospace;">${escapeHtml(price)} ج.م</td>
                    <td style="font-size: 0.85rem; color: var(--centrly-text);">
                      ${g.billing_model === 'fixed_rent' ? 'إيجار قاعة ثابت' : 'نسبة سنتر (20%)'}
                    </td>
                    <td style="font-weight: 700;">${escapeHtml(studentCount)} طلاب</td>
                    <td style="font-weight: 800; color: #059669; font-family: monospace;">
                      ${monthlyRev.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td style="font-weight: 800; color: var(--centrly-blue-800); font-family: monospace;">
                      ${netProfit.toLocaleString('ar-EG')} ج.م
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

      <!-- Two Column: Top Performers & Follow-up Alerts -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        
        <!-- Top Performers (لوحة الشرف والمتفوقين) -->
        <div class="card" style="margin: 0; border-top: 4px solid #10b981;">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">🏆</span>
              <h3 class="card-title" style="font-size: 1rem; color: var(--centrly-ink);">
                لوحة الشرف والمتفوقين (Top Performers)
              </h3>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('reports')">
              عرض الكل
            </button>
          </div>
          <p style="font-size: 0.8rem; color: var(--centrly-text); margin-bottom: 0.75rem;">
            الطلاب أصحاب أعلى درجات في الاختبارات والالتزام بالحضور:
          </p>

          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${topPerformers.length > 0 ? topPerformers.map((s, idx) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--centrly-surface); border-radius: var(--radius-md); border-right: 3px solid #10b981;">
                <div style="display: flex; align-items: center; gap: 0.75rem;">
                  <span style="font-weight: 900; font-size: 1rem; color: ${idx === 0 ? '#d97706' : '#2563eb'};">#${idx + 1}</span>
                  <div>
                    <div style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${escapeHtml(s.student_name || s.name)}</div>
                    <div style="font-size: 0.75rem; color: var(--centrly-text);">${escapeHtml(s.group_name || s.group || 'مجموعة الفيزياء')} • كود: ${escapeHtml(s.student_code || s.code || '—')}</div>
                  </div>
                </div>
                <div>
                  <span class="badge badge-success" style="font-weight: 800; font-size: 0.8rem;">
                    ${escapeHtml(s.overall_score || s.score || 100)}%
                  </span>
                </div>
              </div>
            `).join('') : `
              <div style="font-size: 0.825rem; color: var(--centrly-text); padding: 1.5rem; text-align: center;">
                لا توجد بيانات متفوقين بعد
              </div>
            `}
          </div>
        </div>

        <!-- Follow-up & At-Risk Watchlist (مؤشرات الخطر والمتابعة) -->
        <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-danger);">
          <div class="card-header">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.25rem;">⚠️</span>
              <h3 class="card-title" style="font-size: 1rem; color: var(--centrly-danger);">
                مؤشرات الخطر والمتابعة (At-Risk)
              </h3>
            </div>
            <span class="badge badge-danger">${escapeHtml(atRiskStudents.length)} طلاب</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--centrly-text); margin-bottom: 0.75rem;">
            الطلاب الذين يحتاجون متابعة بسبب الغياب أو عدم تسليم الواجب:
          </p>

          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${atRiskStudents.length > 0 ? atRiskStudents.map(s => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.75rem 1rem; background: var(--centrly-surface); border-radius: var(--radius-md); border-right: 3px solid var(--centrly-danger);">
                <div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${escapeHtml(s.name || s.student_name)}</div>
                  <div style="font-size: 0.75rem; color: var(--centrly-text);">${escapeHtml(s.group || s.group_name || 'مجموعة عامة')}</div>
                </div>
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                  <span class="badge badge-danger" style="font-size: 0.75rem;">${escapeHtml(s.reason || 'تكرار غياب')}</span>
                  <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('whatsapp')" title="إرسال تنبيه عبر واتساب">
                    💬
                  </button>
                </div>
              </div>
            `).join('') : `
              <div style="font-size: 0.825rem; color: var(--centrly-text); padding: 1.5rem; text-align: center;">
                لا توجد مؤشرات خطر حالياً
              </div>
            `}
          </div>
        </div>

      </div>

    </div>
  `;
}
