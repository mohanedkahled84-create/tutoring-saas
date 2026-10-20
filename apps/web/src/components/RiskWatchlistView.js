import { request } from "../services/api.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Risk & Watchlist Component (DEV-62)
 * Dedicated view for early academic, attendance, and homework risk detection.
 */

export function renderRiskWatchlistView(data = {}) {
  let allStudents = Array.isArray(data) ? data : (data.watchlist || data.students || data.atRiskStudents || []);
  const totalEnrolled = window.centrlyApp?.students?.length || 0;
  const groups = window.centrlyApp?.groups || [];
  const selectedGroupId = window.centrlyApp?._riskSelectedGroup || 'all';

  const students = selectedGroupId === 'all'
    ? allStudents
    : allStudents.filter(s => String(s.group_id) === String(selectedGroupId));

  const highCount = students.filter(s => s.severity === 'high' || s.severity === 'critical').length;
  const mediumCount = students.filter(s => s.severity === 'medium' || !s.severity).length;
  const safeCount = Math.max(0, totalEnrolled - allStudents.length);
  const healthRate = totalEnrolled > 0 ? Math.round((safeCount / totalEnrolled) * 100) : 100;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Banner & Header -->
      <div class="card" style="margin: 0; border-top: 4px solid ${students.length > 0 ? 'var(--centrly-danger)' : '#10b981'};">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon(students.length > 0 ? 'risk' : 'check', 22, students.length > 0 ? 'var(--centrly-danger)' : '#10b981')}</span>
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">مؤشرات الخطر والإنذارات المبكرة (At-Risk Watchlist)</h2>
            </div>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              نظام الرصد التلقائي يتابع باستمرار غياب الحصص، انخفاض درجات الكويزات عن 50%، وتأخر تسليم الواجبات للتدخل السريع مع ولي الأمر.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            ${groups.length > 0 ? `
              <select class="form-input" style="width: auto; min-width: 170px; padding: 0.4rem 0.75rem; font-size: 0.825rem; font-weight: 600;" onchange="window.centrlyApp.filterRiskWatchlistGroup(this.value)">
                <option value="all" ${selectedGroupId === 'all' ? 'selected' : ''}>جميع المجموعات (${escapeHtml(totalEnrolled)} طالب)</option>
                ${groups.map(g => `
                  <option value="${escapeHtml(g.id)}" ${selectedGroupId === String(g.id) ? 'selected' : ''}>
                    ${escapeHtml(g.name)}
                  </option>
                `).join('')}
              </select>
            ` : ''}

            <button class="btn btn-secondary" onclick="window.centrlyApp.loadRouteData('risk-watchlist')" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;" title="تحديث مؤشرات الخطر لحظياً">
              ${getIcon('refresh', 16)}
              <span>فحص فوري</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.navigate('settings')" style="display: inline-flex; align-items: center; gap: 0.35rem;">
              ${getIcon('settings', 16)}
              <span>إعدادات التنبيهات</span>
            </button>
          </div>
        </div>

        <!-- Severity & System Health Counters Strip -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
          <div style="background: #f0fdf4; padding: 0.85rem 1rem; border-radius: 8px; border-right: 4px solid #10b981;">
            <div style="font-size: 0.8rem; color: #166534; font-weight: 700;">حالة استقرار المنظومة</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #15803d; margin-top: 0.25rem;">
              ${escapeHtml(healthRate)}% مستقرة ✓
            </div>
            <div style="font-size: 0.72rem; color: #15803d; margin-top: 0.15rem;">${escapeHtml(safeCount)} طالب في وضع دراسي ممتاز</div>
          </div>
          <div style="background: #eff6ff; padding: 0.85rem 1rem; border-radius: 8px; border-right: 4px solid #3b82f6;">
            <div style="font-size: 0.8rem; color: #1e40af; font-weight: 700;">إجمالي الطلاب المشمولين بالرصد</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: #1d4ed8; margin-top: 0.25rem;">${escapeHtml(totalEnrolled)} طالب</div>
            <div style="font-size: 0.72rem; color: #2563eb; margin-top: 0.15rem;">مربوطين بالرصد عبر الحصص والكويزات</div>
          </div>
          <div style="background: ${highCount > 0 ? '#fef2f2' : '#f8fafc'}; padding: 0.85rem 1rem; border-radius: 8px; border-right: 4px solid ${highCount > 0 ? '#ef4444' : '#cbd5e1'};">
            <div style="font-size: 0.8rem; color: ${highCount > 0 ? '#991b1b' : '#64748b'}; font-weight: 700;">إنذارات حرجة (عاجل)</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: ${highCount > 0 ? '#b91c1c' : '#475569'}; margin-top: 0.25rem;">${escapeHtml(highCount)} طلاب</div>
            <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.15rem;">غياب متكرر أو كويز أقل من 30%</div>
          </div>
          <div style="background: ${mediumCount > 0 ? '#fffbeb' : '#f8fafc'}; padding: 0.85rem 1rem; border-radius: 8px; border-right: 4px solid ${mediumCount > 0 ? '#f59e0b' : '#cbd5e1'};">
            <div style="font-size: 0.8rem; color: ${mediumCount > 0 ? '#92400e' : '#64748b'}; font-weight: 700;">إنذارات متوسطة (متابعة)</div>
            <div style="font-size: 1.4rem; font-weight: 900; color: ${mediumCount > 0 ? '#d97706' : '#475569'}; margin-top: 0.25rem;">${escapeHtml(mediumCount)} طلاب</div>
            <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 0.15rem;">تأخر واجب أو تراجع طفيف</div>
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
            يتم فحص البيانات تلقائياً بعد كل حصة وكويز
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
                      ${getIcon('whatsapp', 14, '#15803d')}
                      <span>إرسال إنذار واتساب</span>
                    </button>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 3rem 1.5rem; color: var(--centrly-text);">
                    <div style="width: 56px; height: 56px; background: #ecfdf5; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 0.75rem;">
                      ${getIcon('check', 30, '#10b981')}
                    </div>
                    <div style="font-weight: 800; font-size: 1.15rem; color: #0f172a;">ممتاز! لا توجد مؤشرات خطر حالياً</div>
                    <p style="font-size: 0.88rem; color: #64748b; margin: 0.35rem auto 1.5rem auto; max-width: 520px; line-height: 1.6;">
                      جميع طلابك (${escapeHtml(totalEnrolled)} طالب) ملتزمون بالحضور والواجبات، ومستوى الدرجات مستقر ومطمئن.
                    </p>
                    
                    <!-- Criteria Verification Strip -->
                    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(210px, 1fr)); gap: 0.75rem; max-width: 720px; margin: 0 auto; text-align: right;">
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
                        <div style="font-weight: 700; font-size: 0.82rem; color: #1e293b; display: flex; align-items: center; gap: 0.35rem;">
                          <span style="color: #10b981;">✓</span>
                          <span>سجل الحضور والغياب</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">لا يوجد طالب متغيب لأكثر من حصة متتالية.</div>
                      </div>
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
                        <div style="font-weight: 700; font-size: 0.82rem; color: #1e293b; display: flex; align-items: center; gap: 0.35rem;">
                          <span style="color: #10b981;">✓</span>
                          <span>نتائج وتقييمات الكويزات</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">متوسط الدرجات أعلى من 50% ولا تراجع مفاجئ.</div>
                      </div>
                      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 0.75rem 1rem;">
                        <div style="font-weight: 700; font-size: 0.82rem; color: #1e293b; display: flex; align-items: center; gap: 0.35rem;">
                          <span style="color: #10b981;">✓</span>
                          <span>تسليم الواجبات المنزلية</span>
                        </div>
                        <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">لا يوجد إهمال متكرر لتسليم حل الواجبات.</div>
                      </div>
                    </div>
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

export function registerRiskWatchlistActions(app) {
  app.filterRiskWatchlistGroup = function(groupId) {
    this._riskSelectedGroup = groupId;
    this.renderMainContent();
  };

  app.dispatchSingleRiskAlert = async function(studentId, studentName) {
    try {
      this.showToast(`جارٍ إرسال تنبيه المتابعة لولي أمر (${studentName})...`, 'info');
      await request(`/at-risk/alerts/${studentId}`, {
        method: 'POST',
        body: { alert_type: 'absence_warning' },
      });
      this.showToast(`تم إرسال تنبيه المتابعة لولي أمر (${studentName}) بنجاح عبر واتساب`, 'success');
      await this.loadRouteData('risk-watchlist');
    } catch (err) {
      this.showToast(`فشل إرسال تنبيه المتابعة: ${err.message || 'خطأ في الإرسال'}`, 'danger');
    }
  };
}
