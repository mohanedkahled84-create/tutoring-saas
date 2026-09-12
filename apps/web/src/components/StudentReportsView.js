import { renderStudentSearchBar } from "./StudentSearchBar.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Student Reports & Monthly Leaderboard View (DEV-89)
 * Arabic-first RTL view for monthly performance ranking, bulk report locking per month,
 * individual report dispatch, and clean vector icons.
 */
export function renderStudentReportsView(state = {}) {
  const {
    period = { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
    leaderboard = [],
    groups = [],
    selectedGroupId = "",
    searchQuery = "",
    total_students = 0,
    average_attendance_rate = 0,
    average_score = 0,
    isSubmittingBulk = false,
    dispatchedMonths = {},
  } = state;

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

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
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
            ${isMonthDispatched ? `
              <div class="badge badge-success" style="padding: 0.5rem 0.9rem; font-size: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                ${getIcon('check', 16)}
                <span>تم إرسال تقييمات شهر ${monthNames[currentMonth - 1]} ${currentYear} (${dispatchedInfo.sentDate || 'مؤخراً'})</span>
              </div>
            ` : `
              <button
                class="btn btn-primary"
                id="bulkSendReportsBtn"
                onclick="window.centrlyApp.handleBulkSendReports()"
                ${isSubmittingBulk ? "disabled" : ""}
                style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700;"
              >
                ${getIcon('send', 18)}
                <span>${isSubmittingBulk ? "جاري الإرسال عبر الطابور..." : "إرسال التقارير لجميع أولياء الأمور (Bulk)"}</span>
              </button>
            `}
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

    </div>
  `;
}
