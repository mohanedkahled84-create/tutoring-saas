import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Teacher Settlements & Financials Component (Notion DEV-72)
 * Name: تسويات المدرسين والماليات
 * Replaces old Treasury naming. Shows per-teacher gross revenue, center cut,
 * net teacher payout, and settlement status toggle (مسدد / معلق).
 */

export function renderCenterSettlementsView(state = {}) {
  const period = state.period || new Date().toISOString().slice(0, 7);
  const rollup = state.rollup || {
    period,
    totals: {
      total_revenue: 0,
      total_teacher_cut: 0,
      total_center_cut: 0,
      paid_teachers_count: 0,
      unpaid_teachers_count: 0,
    },
    reports: [],
  };

  const reports = rollup.reports || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title & Period Switcher -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('billing', 22, 'var(--centrly-blue-700)')}</span>
              <span>تسويات المدرسين والماليات (Settlements & Payouts)</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              حساب إيرادات كل معلم، استقطاع نسبة وحصة السنتر، وإثبات صرف المستحقات المالية دورياً وفق وثائق DEV-72.
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <label style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink);">الشهر المالي:</label>
            <input 
              type="month" 
              value="${period}" 
              class="form-input" 
              style="padding: 0.35rem 0.75rem; font-size: 0.9rem;"
              onchange="window.centrlyApp.changeCenterPeriod(this.value)"
            >
          </div>
        </div>
      </div>

      <!-- Financial Rollup KPI Summary Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
        
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الدخل المحصل</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${rollup.totals.total_revenue.toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-weight: 500;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            إجمالي اشتراكات الطلاب لكافة المعلمين
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">مستحقات المدرسين الصافية</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-amber-700); margin-top: 0.35rem;">
            ${rollup.totals.total_teacher_cut.toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-weight: 500;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            ${rollup.totals.paid_teachers_count} مدرس مسدد / ${rollup.totals.unpaid_teachers_count} معلق
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">صافي أرباح السنتر</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
            ${rollup.totals.total_center_cut.toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-weight: 500;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            عائد تشغيل القاعات والنسبة المحصلة
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-info);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نسبة تسوية المستحقات</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${reports.length > 0 ? Math.round((rollup.totals.paid_teachers_count / reports.length) * 100) : 100}%
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            معدل إغلاق مستحقات الشهر الحالي
          </div>
        </div>

      </div>

      <!-- Teacher Settlement Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('billing', 18, 'var(--centrly-blue-700)')}
            <span>بيان تسويات المعلمين لشهر (${period})</span>
          </h3>
          <span style="font-size: 0.78rem; color: var(--centrly-text);">
            البيانات مستخرجة ومطابقة لحصص السنتر المنفذة
          </span>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم المعلم</th>
                <th>المادة الدراسية</th>
                <th>إجمالي الحصص</th>
                <th>إجمالي الدخل المحصل</th>
                <th>نسبة / حصة السنتر</th>
                <th>صافي مستحق المعلم</th>
                <th>حالة السداد</th>
                <th>الإجراء المالي</th>
              </tr>
            </thead>
            <tbody>
              ${reports.length > 0 ? reports.map(r => {
                const isPaid = r.payout?.is_paid;
                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(r.teacher.name)}</td>
                    <td><span class="badge badge-blue">${escapeHtml(r.teacher.subject || 'عامة')}</span></td>
                    <td style="font-weight: 700; font-family: monospace;">${escapeHtml(r.session_count || 0)} حصص</td>
                    <td style="font-family: monospace; font-weight: 800; color: var(--centrly-ink);">
                      ${r.gross_revenue.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td style="font-family: monospace; font-weight: 800; color: var(--centrly-success);">
                      ${r.center_cut.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td style="font-family: monospace; font-weight: 800; color: var(--centrly-blue-800); font-size: 1.05rem;">
                      ${r.teacher_cut.toLocaleString('ar-EG')} ج.م
                    </td>
                    <td>
                      <span class="badge ${isPaid ? 'badge-success' : 'badge-warning'}">
                        ${isPaid ? 'تم الصرف (مسدد)' : 'معلق في انتظار الصرف'}
                      </span>
                    </td>
                    <td>
                      <button 
                        class="btn ${isPaid ? 'btn-secondary' : 'btn-primary'} btn-sm" 
                        onclick="window.centrlyApp.toggleTeacherPayout('${escapeHtml(r.teacher.id)}', '${escapeHtml(r.teacher.name).replace(/'/g, "\\'")}', ${r.teacher_cut}, ${!isPaid})"
                        style="display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 700;"
                      >
                        ${getIcon(isPaid ? 'close' : 'check', 14)}
                        <span>${isPaid ? 'إلغاء التأكيد' : 'تسجيل صرف المستحقات'}</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا توجد تسويات مالية مسجلة لهذا الشهر حتى الآن.
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
