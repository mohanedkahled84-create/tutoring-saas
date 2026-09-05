/**
 * Centrly Teacher Dashboard (DEV-16)
 * KPI Rollup + At-Risk Watchlist (Warnings) + Top Performers (المتفوقين)
 */

export function renderTeacherDashboard(data = {}) {
  const stats = data.stats || {
    totalStudents: 0,
    activeGroups: 0,
    todayAttendanceRate: '0%',
    pendingMessages: 0,
  };

  const atRiskStudents = data.atRiskStudents || [];
  const topPerformers = data.topPerformers || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- KPI Stats Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الطلاب المقيدين</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${stats.totalStudents} <span style="font-size: 0.85rem; font-weight: 500;">طالب</span>
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-accent);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">المجاميع النشطة</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${stats.activeGroups} <span style="font-size: 0.85rem; font-weight: 500;">مجاميع</span>
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">نسبة حضور اليوم</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
            ${stats.todayAttendanceRate}
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-500);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">الحد اليومي لرسائل الواتساب</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-amber-700); margin-top: 0.35rem;">
            آمن <span style="font-size: 0.85rem; font-weight: 500;">(سعة 500/يوم)</span>
          </div>
        </div>
      </div>

      <!-- Founder Requirement: At-Risk Warnings & Top Performers -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        
        <!-- At-Risk Watchlist (مؤشرات الخطر والإنذارات) -->
        <div class="card" style="margin: 0; border: 1px solid var(--centrly-danger-light);">
          <div class="card-header" style="border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.2rem;">⚠️</span>
              <h3 class="card-title" style="color: var(--centrly-danger); font-size: 1rem;">
                مؤشرات الخطر والإنذارات (At-Risk Watchlist)
              </h3>
            </div>
            <span class="badge badge-danger">${atRiskStudents.length} طلاب</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--centrly-text); margin-bottom: 0.75rem;">
            الطلاب المعرضين لانخفاض المستوى أو الغياب المتكرر وفق خوارزمية الرصد:
          </p>

          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${atRiskStudents.length > 0 ? atRiskStudents.map(s => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--centrly-surface); border-radius: var(--radius-md); border-right: 3px solid var(--centrly-danger);">
                <div>
                  <div style="font-weight: 700; font-size: 0.875rem; color: var(--centrly-ink);">${s.name}</div>
                  <div style="font-size: 0.75rem; color: var(--centrly-text);">${s.group}</div>
                </div>
                <div style="text-align: left;">
                  <span class="badge badge-danger" style="font-size: 0.725rem;">${s.reason}</span>
                </div>
              </div>
            `).join('') : `
              <div style="font-size: 0.825rem; color: var(--centrly-text); padding: 1.5rem; text-align: center;">
                لا توجد مؤشرات خطر حالياً. أداء الطلاب مستقر.
              </div>
            `}
          </div>
        </div>

        <!-- Top Performers (المتفوقين) -->
        <div class="card" style="margin: 0; border: 1px solid var(--centrly-success-light);">
          <div class="card-header" style="border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem; margin-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.2rem;">🌟</span>
              <h3 class="card-title" style="color: var(--centrly-success); font-size: 1rem;">
                لوحة الشرف والمتفوقين (Top Performers)
              </h3>
            </div>
            <span class="badge badge-success">${topPerformers.length} طلاب</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--centrly-text); margin-bottom: 0.75rem;">
            أعلى الطلاب التزاماً بالحضور ودرجات التسميع والواجب:
          </p>

          <div style="display: flex; flex-direction: column; gap: 0.6rem;">
            ${topPerformers.length > 0 ? topPerformers.map((s, idx) => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem 0.85rem; background: var(--centrly-surface); border-radius: var(--radius-md); border-right: 3px solid var(--centrly-success);">
                <div style="display: flex; align-items: center; gap: 0.6rem;">
                  <span style="font-weight: 800; font-size: 0.9rem; color: var(--centrly-accent);">#${idx + 1}</span>
                  <div>
                    <div style="font-weight: 700; font-size: 0.875rem; color: var(--centrly-ink);">${s.name}</div>
                    <div style="font-size: 0.75rem; color: var(--centrly-text);">${s.group} • ${s.note}</div>
                  </div>
                </div>
                <div>
                  <span class="badge badge-success" style="font-size: 0.75rem; font-weight: 800;">${s.score}</span>
                </div>
              </div>
            `).join('') : `
              <div style="font-size: 0.825rem; color: var(--centrly-text); padding: 1.5rem; text-align: center;">
                لا توجد بيانات متفوقين بعد. ستظهر النتائج فور رصد درجات الحصص.
              </div>
            `}
          </div>
        </div>

      </div>

      <!-- Quick Session Launch Action -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, var(--centrly-blue-800), var(--centrly-blue-900)); color: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h3 style="font-size: 1.15rem; font-weight: 800; margin: 0; color: #fff;">جاهز لبدء حصة اليوم؟</h3>
            <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 0.25rem;">
              امسح كروت الطلاب، سجّل الواجب والتسميع، وأرسل تقرير الواتساب بضغطة زر واحدة.
            </p>
          </div>
          <button class="btn" style="background: var(--centrly-accent); color: #fff; font-weight: 700; padding: 0.75rem 1.5rem;" onclick="window.centrlyApp.navigate('sessions')">
            ⚡ الدخول لغرفة الحصة الآن
          </button>
        </div>
      </div>

    </div>
  `;
}
