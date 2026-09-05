import { renderStudentSearchBar } from "./StudentSearchBar.js";

/**
 * Centrly Student Reports & Monthly Leaderboard View (DEV-80)
 * Arabic-first RTL view for monthly performance ranking, bulk parent report dispatch, and individual send.
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
  } = state;

  const currentMonth = period.month || (new Date().getMonth() + 1);
  const currentYear = period.year || new Date().getFullYear();

  // Arabic month names
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
              <span>🏆</span> تقارير الأداء ولوحة الشرف والتميز
            </h2>
            <p style="font-size: 0.85rem; color: var(--centrly-muted, #64748b); margin-top: 0.25rem;">
              متابعة درجات الكويزات، نسب الحضور والغياب، وترتيب الطلاب وإرسال تقارير واتساب دورية لأولياء الأمور
            </p>
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap; align-items: center;">
            <button
              class="btn btn-primary"
              id="bulkSendReportsBtn"
              onclick="window.centrlyApp.handleBulkSendReports()"
              ${isSubmittingBulk ? "disabled" : ""}
              style="display: flex; align-items: center; gap: 0.5rem;"
            >
              <span>🚀</span>
              <span>${isSubmittingBulk ? "جاري الإرسال عبر الطابور..." : "إرسال التقارير لجميع أولياء الأمور (Bulk)"}</span>
            </button>
          </div>
        </div>

        <!-- Period and Group Selectors -->
        <div style="display: flex; gap: 1rem; margin-top: 1.25rem; flex-wrap: wrap; align-items: center; padding-top: 1rem; border-top: 1px solid var(--centrly-border, #e2e8f0);">
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
                <option value="${g.id}" ${g.id === selectedGroupId ? "selected" : ""}>${g.name}</option>
              `).join("")}
            </select>
          </div>
        </div>

        <!-- Universal Search Bar -->
        <div style="margin-top: 1rem;">
          ${renderStudentSearchBar({
            id: "reportsStudentSearch",
            value: searchQuery,
            placeholder: "🔍 ابحث برقم الكود، اسم الطالب، أو رقم هاتف ولي الأمر في لوحة الترتيب...",
            onInputHandler: "window.centrlyApp.handleReportsSearch(this.value)",
          })}
        </div>
      </div>

      <!-- Overview KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
        <div class="card" style="margin: 0; padding: 1.25rem;">
          <div style="font-size: 0.85rem; color: var(--centrly-muted, #64748b);">إجمالي الطلاب في التقرير</div>
          <div style="font-size: 1.75rem; font-weight: bold; margin-top: 0.25rem; color: var(--centrly-primary, #2563eb);">
            ${total_students || students.length || 0}
          </div>
        </div>

        <div class="card" style="margin: 0; padding: 1.25rem;">
          <div style="font-size: 0.85rem; color: var(--centrly-muted, #64748b);">متوسط الالتزام بالحضور</div>
          <div style="font-size: 1.75rem; font-weight: bold; margin-top: 0.25rem; color: #16a34a;">
            ${average_attendance_rate || 0}%
          </div>
        </div>

        <div class="card" style="margin: 0; padding: 1.25rem;">
          <div style="font-size: 0.85rem; color: var(--centrly-muted, #64748b);">متوسط درجات الاختبارات</div>
          <div style="font-size: 1.75rem; font-weight: bold; margin-top: 0.25rem; color: #8b5cf6;">
            ${average_score || 0}%
          </div>
        </div>
      </div>

      <!-- Ranked Leaderboard Table -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
          <h3 style="margin: 0; font-size: 1.15rem;">ترتيب الطلاب لشهر ${monthNames[currentMonth - 1]} ${currentYear}</h3>
          <span style="font-size: 0.8rem; color: var(--centrly-muted, #64748b);">
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
                <th style="text-align: center;">إرسال التقرير</th>
              </tr>
            </thead>
            <tbody>
              ${students.length === 0 ? `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 3rem 1rem; color: var(--centrly-muted, #64748b);">
                    <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">📊</div>
                    <div style="font-weight: 600; font-size: 1rem;">لا توجد بيانات تقارير متاحة لهذه الفترة أو المجموعة</div>
                    <div style="font-size: 0.85rem; margin-top: 0.25rem;">تأكد من تسجيل الحضور وإدخال درجات الكويزات لحصص هذا الشهر</div>
                  </td>
                </tr>
              ` : students.map((std) => {
                const rankBadge =
                  std.rank === 1 ? "🥇 1" :
                  std.rank === 2 ? "🥈 2" :
                  std.rank === 3 ? "🥉 3" :
                  `#${std.rank}`;

                const badgeBg =
                  std.rank === 1 ? "background: #fef9c3; color: #854d0e; font-weight: bold;" :
                  std.rank === 2 ? "background: #f1f5f9; color: #334155; font-weight: bold;" :
                  std.rank === 3 ? "background: #ffedd5; color: #9a3412; font-weight: bold;" :
                  "color: var(--centrly-muted, #64748b);";

                return `
                  <tr>
                    <td style="text-align: center;">
                      <span class="badge" style="${badgeBg} padding: 0.25rem 0.6rem; border-radius: 9999px; font-size: 0.9rem;">
                        ${rankBadge}
                      </span>
                    </td>
                    <td><code>${std.student_code || "—"}</code></td>
                    <td style="font-weight: 600;">${std.student_name}</td>
                    <td>${std.group_name || "—"}</td>
                    <td dir="ltr" style="text-align: right;">${std.parent_phone || "—"}</td>
                    <td>
                      <span class="badge ${std.attendance_rate >= 80 ? "badge-success" : std.attendance_rate >= 50 ? "badge-warning" : "badge-danger"}">
                        ${std.attendance_rate}% (${std.attended_sessions}/${std.total_sessions})
                      </span>
                    </td>
                    <td>
                      <span style="font-weight: 600; color: ${std.average_score >= 70 ? "#16a34a" : "#dc2626"};">
                        ${std.average_score}%
                      </span>
                      <small style="color: var(--centrly-muted, #64748b);"> (${std.total_quizzes} كويز)</small>
                    </td>
                    <td>
                      <div style="font-weight: bold; color: var(--centrly-primary, #2563eb);">
                        ${std.overall_score}%
                      </div>
                    </td>
                    <td style="text-align: center;">
                      <button
                        class="btn btn-secondary btn-sm"
                        onclick="window.centrlyApp.handleSendIndividualReport('${std.student_id}', '${std.student_name}')"
                        title="إرسال تقرير الواتساب لولي الأمر"
                        style="display: inline-flex; align-items: center; gap: 0.35rem;"
                      >
                        <span>📤</span> إرسال التقرير
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
