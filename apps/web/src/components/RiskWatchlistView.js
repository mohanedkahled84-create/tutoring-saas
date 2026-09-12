import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Risk & Watchlist Component (DEV-62)
 * Dedicated view for early academic, attendance, and homework risk detection.
 */

export function renderRiskWatchlistView(data = {}) {
  const students = Array.isArray(data) ? data : (data.watchlist || data.students || data.atRiskStudents || []);

  const highCount = students.filter(s => s.severity === 'high' || s.severity === 'critical').length;
  const mediumCount = students.filter(s => s.severity === 'medium' || !s.severity).length;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Banner & Header -->
      <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-danger);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('risk', 22, 'var(--centrly-danger)')}</span>
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">مؤشرات الخطر والإنذارات المبكرة (At-Risk Watchlist)</h2>
            </div>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              نظام الإنذار الذكي يرصد تكرار الغياب، التراجع المفاجئ في الدرجات، وإهمال الواجب قبل أن يتأثر مستوى الطالب.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <button class="btn btn-secondary" onclick="window.centrlyApp.loadRouteData('risk-watchlist')" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;" title="تحديث مؤشرات الخطر لحظياً">
              ${getIcon('refresh', 16)}
              <span>تحديث القائمة</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.navigate('whatsapp')" style="display: inline-flex; align-items: center; gap: 0.35rem;">
              ${getIcon('whatsapp', 16)}
              <span>إعدادات قوالب الإنذار</span>
            </button>
          </div>
        </div>

        <!-- Severity Counters Strip -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
          <div style="background: #fef2f2; padding: 0.75rem 1rem; border-radius: 8px; border-right: 4px solid #ef4444;">
            <div style="font-size: 0.8rem; color: #991b1b; font-weight: 700;">إنذارات حرجة (عاجل)</div>
            <div style="font-size: 1.5rem; font-weight: 900; color: #b91c1c; margin-top: 0.25rem;">${escapeHtml(highCount)} طلاب</div>
          </div>
          <div style="background: #fffbeb; padding: 0.75rem 1rem; border-radius: 8px; border-right: 4px solid #f59e0b;">
            <div style="font-size: 0.8rem; color: #92400e; font-weight: 700;">إنذارات متوسطة (متابعة)</div>
            <div style="font-size: 1.5rem; font-weight: 900; color: #d97706; margin-top: 0.25rem;">${escapeHtml(mediumCount)} طلاب</div>
          </div>
          <div style="background: #f0fdf4; padding: 0.75rem 1rem; border-radius: 8px; border-right: 4px solid #10b981;">
            <div style="font-size: 0.8rem; color: #166534; font-weight: 700;">إجمالي الطلاب في قائمة المتابعة</div>
            <div style="font-size: 1.5rem; font-weight: 900; color: #15803d; margin-top: 0.25rem;">${escapeHtml(students.length)} طلاب</div>
          </div>
        </div>
      </div>

      <!-- Main Watchlist Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header">
          <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('reports', 18, 'var(--centrly-blue-700)')}
            <span>كشف الطلاب المحتاجين للمتابعة (${escapeHtml(students.length)})</span>
          </h3>
          <span style="font-size: 0.8rem; color: var(--centrly-text);">
            يتم تحديث القائمة آلياً بعد انتهاء كل حصة
          </span>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>كود الطالب</th>
                <th>اسم الطالب</th>
                <th>المجموعة</th>
                <th>نوع الإنذار</th>
                <th>مستوى الخطورة</th>
                <th>السبب والتفاصيل</th>
                <th>الإجراء الفوري</th>
              </tr>
            </thead>
            <tbody>
              ${students.length > 0 ? students.map(s => `
                <tr>
                  <td style="font-family: monospace; font-weight: 700;">${escapeHtml(s.code || s.student_code || '—')}</td>
                  <td style="font-weight: 700;">${escapeHtml(s.name || s.student_name)}</td>
                  <td><span class="badge badge-blue">${escapeHtml(s.group || s.group_name || 'مجموعة عامة')}</span></td>
                  <td>
                    <span style="font-weight: 700; color: var(--centrly-ink);">
                      ${s.alert_type === 'absence_warning' ? 'غياب متكرر' : (s.alert_type === 'grade_drop' ? 'تراجع درجات' : (s.alert_type === 'homework_neglect' ? 'إهمال واجب' : escapeHtml(s.reason || 'إنذار متابعة')))}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${s.severity === 'high' || s.severity === 'critical' ? 'badge-danger' : 'badge-warning'}">
                      ${s.severity === 'high' || s.severity === 'critical' ? 'حرج' : 'متوسط'}
                    </span>
                  </td>
                  <td style="font-size: 0.85rem; color: var(--centrly-text);">
                    ${escapeHtml(s.reason || s.detail || 'تكرار الغياب عن الحصص الأخيرة')}
                  </td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.dispatchSingleRiskAlert('${escapeHtml(s.id || s.student_id)}', '${escapeHtml(s.name || s.student_name).replace(/'/g, "\\'")}')" style="font-size: 0.78rem; padding: 0.3rem 0.6rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                      ${getIcon('whatsapp', 14)}
                      <span>إرسال إنذار واتساب</span>
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 3rem; color: var(--centrly-text);">
                    <div style="margin-bottom: 0.5rem;">${getIcon('check', 36, 'var(--centrly-success)')}</div>
                    <div style="font-weight: 700; font-size: 1rem; color: var(--centrly-ink);">لا توجد مؤشرات خطر حالياً</div>
                    <p style="font-size: 0.85rem; margin-top: 0.25rem;">جميع الطلاب ملتزمون بالحضور والواجبات وأداؤهم مستقر وممتاز.</p>
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
