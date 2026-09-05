/**
 * Centrly Parent Web Portal Component (DEV-34)
 * Lightweight, no-app, no-login portal for Egyptian parents to track
 * student attendance, homework, and teacher comments.
 */

export function renderParentPortalView(portalData = {}) {
  if (portalData.error || !portalData.student) {
    return `
      <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; padding: 1.5rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
        <div style="max-width: 480px; width: 100%; background: #fff; border-radius: var(--radius-lg); padding: 2.5rem; box-shadow: var(--shadow-sm); border: 1px solid var(--centrly-line); text-align: center;">
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">⚠️</div>
          <h2 style="font-size: 1.3rem; font-weight: 800; color: var(--centrly-danger); margin: 0 0 0.5rem 0;">رابط غير صالح أو منتهي الصلاحية</h2>
          <p style="font-size: 0.9rem; color: var(--centrly-text); margin: 0 0 1.5rem 0; line-height: 1.6;">
            ${portalData.error || 'تعذر تحميل بيانات متابعة الطالب. يرجى التأكد من فتح الرابط الصحيح المرسل عبر الواتساب أو مراجعة إدارة السنتر.'}
          </p>
          <div style="font-size: 0.75rem; color: var(--centrly-text); border-top: 1px solid var(--centrly-line); padding-top: 1rem;">
            منظومة سنترلي التعليمية | Centrly
          </div>
        </div>
      </div>
    `;
  }

  const student = portalData.student;
  const summary = portalData.summary || {
    total_sessions: 0,
    attended_count: 0,
    absent_count: 0,
    attendance_rate: '0%',
    homework_done_count: 0,
  };
  const sessions = portalData.sessions || [];

  return `
    <div style="min-height: 100vh; background-color: #f8fafc; padding: 1rem; font-family: system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="max-width: 600px; margin: 0 auto; display: flex; flex-direction: column; gap: 1.25rem;">
        
        <!-- Portal Header -->
        <div style="background: #fff; border-radius: var(--radius-lg); padding: 1.5rem; box-shadow: var(--shadow-sm); border: 1px solid var(--centrly-line); text-align: center;">
          <div class="brand-logo-badge" style="margin: 0 auto 0.5rem; width: 44px; height: 44px; font-size: 1.25rem;">سـ</div>
          <h1 style="font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink); margin: 0;">بوابة ولي الأمر | سنترلي</h1>
          <div style="display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
            <span style="font-size: 1.1rem; font-weight: 900; color: var(--centrly-blue-800);">${student.name}</span>
            <span class="badge badge-secondary" style="font-family: monospace;">كود: ${student.student_code}</span>
          </div>
          <p style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.35rem;">
            تقرير الحضور والواجبات المدرسية المحدث لحظياً
          </p>
        </div>

        <!-- KPI Summary Cards -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
          <div style="background: #fff; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--centrly-line); text-align: center;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--centrly-text);">نسبة الحضور الإجمالية</div>
            <div style="font-size: 1.75rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.25rem;">
              ${summary.attendance_rate}
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.2rem;">
              حضر ${summary.attended_count} من أصل ${summary.total_sessions} حصص
            </div>
          </div>

          <div style="background: #fff; padding: 1.25rem; border-radius: var(--radius-md); border: 1px solid var(--centrly-line); text-align: center;">
            <div style="font-size: 0.75rem; font-weight: 700; color: var(--centrly-text);">الالتزام بالواجبات</div>
            <div style="font-size: 1.75rem; font-weight: 900; color: var(--centrly-blue-800); margin-top: 0.25rem;">
              ${summary.homework_done_count}/${summary.total_sessions}
            </div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.2rem;">
              ${summary.absent_count > 0 ? `<span style="color: var(--centrly-danger); font-weight: 700;">${summary.absent_count} غياب</span>` : 'لا يوجد غياب'}
            </div>
          </div>
        </div>

        <!-- Attendance History Timeline -->
        <div style="background: #fff; border-radius: var(--radius-lg); padding: 1.25rem; box-shadow: var(--shadow-sm); border: 1px solid var(--centrly-line);">
          <h2 style="font-size: 1rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 1rem;">
            📅 سجل الحصص الأخيرة
          </h2>

          <div style="display: flex; flex-direction: column; gap: 0.75rem;">
            ${sessions.length > 0 ? sessions.map(s => `
              <div style="padding: 0.85rem; border-radius: var(--radius-md); background: #f8fafc; border: 1px solid var(--centrly-line); display: flex; flex-direction: column; gap: 0.4rem;">
                <div style="display: flex; justify-content: space-between; align-items: center;">
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">
                    حصة رقم ${s.session_number} • ${s.session_date}
                  </div>
                  <span class="badge ${s.attended ? 'badge-success' : 'badge-danger'}">
                    ${s.attended ? 'حاضر ✓' : 'غائب ✗'}
                  </span>
                </div>

                <div style="display: flex; gap: 0.75rem; font-size: 0.8rem; color: var(--centrly-text); align-items: center;">
                  <span>الواجب: 
                    <b style="color: ${s.homework_status === 'done' ? 'var(--centrly-success)' : (s.homework_status === 'partial' ? 'var(--centrly-amber-700)' : 'var(--centrly-danger)')};">
                      ${s.homework_status === 'done' ? 'تم التسليم بالكامل' : (s.homework_status === 'partial' ? 'تسليم جزئي / ناقص' : 'لم يُسلم')}
                    </b>
                  </span>
                </div>

                ${s.comment ? `
                  <div style="font-size: 0.825rem; background: #fff; padding: 0.5rem 0.75rem; border-radius: var(--radius-sm); border-right: 3px solid var(--centrly-blue-700); color: var(--centrly-ink); margin-top: 0.25rem;">
                    💬 <b>ملاحظة المعلم:</b> ${s.comment}
                  </div>
                ` : ''}
              </div>
            `).join('') : `
              <div style="text-align: center; padding: 2rem; color: var(--centrly-text); font-size: 0.85rem;">
                لا توجد حصص مسجلة حتى الآن لهذا الطالب.
              </div>
            `}
          </div>
        </div>

        <!-- Portal Security Note -->
        <div style="text-align: center; padding: 1rem 0; font-size: 0.75rem; color: var(--centrly-text);">
          🔒 رابط مشفر وخاص بولي الأمر فقط • مدعوم بواسطة <b>منظومة سنترلي (Centrly)</b>
        </div>

      </div>
    </div>
  `;
}
