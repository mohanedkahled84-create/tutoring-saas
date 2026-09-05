/**
 * Centrly Teacher Calendar (DEV-56)
 * Daily, Weekly, and Monthly schedule views for teachers.
 * Displays scheduled, in-progress, ended, cancelled, rescheduled, and extra sessions
 * with Arabic RTL layout, visual badges, and quick session actions.
 */

export function renderTeacherCalendar(data = {}) {
  const currentView = data.view || 'week'; // 'day' | 'week' | 'month'
  const currentDateLabel = data.dateLabel || 'أسبوع 6 سبتمبر - 12 سبتمبر 2026';
  const filterGroup = data.selectedGroup || 'all';

  const defaultSessions = [
    {
      id: 'sess-cal-1',
      group_name: 'مجموعة الثانوية العامة - سنتر الأوائل',
      section_name: 'شعبة أ (بنين)',
      date: '2026-09-06',
      day_name: 'الأحد',
      time: '04:00 م - 06:00 م',
      center_name: 'سنتر الأوائل - قاعة 1',
      session_number: 5,
      status: 'ended',
      is_extra: false,
    },
    {
      id: 'sess-cal-2',
      group_name: 'مجموعة الثانوية العامة - سنتر الأوائل',
      section_name: 'شعبة ب (بنات)',
      date: '2026-09-08',
      day_name: 'الثلاثاء',
      time: '04:00 م - 06:00 م',
      center_name: 'سنتر الأوائل - قاعة 2',
      session_number: 5,
      status: 'in_progress',
      is_extra: false,
    },
    {
      id: 'sess-cal-3',
      group_name: 'أولى ثانوي لغات - سنتر النخبة',
      section_name: 'القسم العام',
      date: '2026-09-09',
      day_name: 'الأربعاء',
      time: '06:00 م - 08:00 م',
      center_name: 'سنتر النخبة - قاعة A',
      session_number: 3,
      status: 'scheduled',
      is_extra: false,
    },
    {
      id: 'sess-cal-4',
      group_name: 'تانية ثانوي - سنتر الأوائل',
      section_name: 'المجموعة المتقدمة',
      date: '2026-09-10',
      day_name: 'الخميس',
      time: '02:00 م - 04:00 م',
      center_name: 'سنتر الأوائل - قاعة 3',
      session_number: 4,
      status: 'rescheduled',
      rescheduled_to_date: '2026-09-11',
      rescheduled_to_time: '05:00 م',
      cancellation_reason: 'صيانة مفاجئة بالقاعة',
      is_extra: false,
    },
    {
      id: 'sess-cal-5',
      group_name: 'مجموعة الثانوية العامة - سنتر الأوائل',
      section_name: 'مراجعة نهائية مكثفة',
      date: '2026-09-11',
      day_name: 'الجمعة',
      time: '03:00 م - 05:30 م',
      center_name: 'سنتر الأوائل - القاعة الكبرى',
      session_number: 6,
      status: 'scheduled',
      is_extra: true,
      extra_topic: 'حل نماذج امتحانات الوزارة والأسئلة غير النمطية',
    },
    {
      id: 'sess-cal-6',
      group_name: 'أولى ثانوي - سنتر النخبة',
      section_name: 'شعبة 1',
      date: '2026-09-12',
      day_name: 'السبت',
      time: '12:00 م - 02:00 م',
      center_name: 'سنتر النخبة - قاعة B',
      session_number: 2,
      status: 'cancelled',
      cancellation_reason: 'ظرف طارئ للمدرس',
      is_extra: false,
    },
  ];

  const sessions = data.sessions || defaultSessions;

  const totalCount = sessions.length;
  const inProgressCount = sessions.filter((s) => s.status === 'in_progress').length;
  const scheduledCount = sessions.filter((s) => s.status === 'scheduled').length;
  const completedCount = sessions.filter((s) => s.status === 'ended').length;
  const cancelledCount = sessions.filter((s) => s.status === 'cancelled').length;
  const rescheduledCount = sessions.filter((s) => s.status === 'rescheduled').length;
  const extraCount = sessions.filter((s) => s.is_extra).length;

  function renderStatusBadge(session) {
    if (session.status === 'in_progress') {
      return '<span class="badge badge-success" style="font-size:0.75rem;">🟢 جارية</span>';
    }
    if (session.status === 'ended') {
      return '<span class="badge badge-secondary" style="font-size:0.75rem;">🏁 منتهية</span>';
    }
    if (session.status === 'cancelled') {
      return '<span class="badge" style="background:#ef4444;color:#fff;font-size:0.75rem;">❌ ملغاة</span>';
    }
    if (session.status === 'rescheduled') {
      return '<span class="badge" style="background:#f59e0b;color:#fff;font-size:0.75rem;">📅 مؤجلة</span>';
    }
    return '<span class="badge badge-primary" style="font-size:0.75rem;">🕒 مجدولة</span>';
  }

  function renderSessionCard(session) {
    return `
      <div class="card" style="margin: 0; padding: 1rem; border-right: 4px solid ${
        session.is_extra
          ? '#7c3aed'
          : session.status === 'in_progress'
          ? '#10b981'
          : session.status === 'cancelled'
          ? '#ef4444'
          : session.status === 'rescheduled'
          ? '#f59e0b'
          : 'var(--centrly-blue-700)'
      }; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05); display: flex; flex-direction: column; gap: 0.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; flex-wrap: wrap;">
          <div style="font-weight: 800; font-size: 0.95rem; color: var(--centrly-ink);">
            ${session.group_name}
            ${session.section_name ? `<span style="font-size: 0.75rem; color: var(--centrly-text); font-weight: 500;"> • ${session.section_name}</span>` : ''}
          </div>
          <div style="display: flex; gap: 0.35rem; align-items: center;">
            ${renderStatusBadge(session)}
            ${session.is_extra ? '<span class="badge" style="background:#7c3aed;color:#fff;font-size:0.75rem;">⭐ إضافية</span>' : ''}
          </div>
        </div>

        <div style="font-size: 0.82rem; color: var(--centrly-text); display: flex; flex-direction: column; gap: 0.25rem;">
          <div>⏰ <strong>الموعد:</strong> ${session.day_name ? `${session.day_name} • ` : ''}${session.time} (${session.date})</div>
          <div>📍 <strong>المكان:</strong> ${session.center_name || 'سنتر تعليمي'}</div>
          <div>🔢 <strong>رقم الحصة:</strong> حصة ${session.session_number}</div>
          ${session.extra_topic ? `<div style="color: #7c3aed;">📝 <strong>موضوع الحصة:</strong> ${session.extra_topic}</div>` : ''}
          ${session.cancellation_reason ? `<div style="color: #ef4444;">⚠️ <strong>سبب الإلغاء:</strong> ${session.cancellation_reason}</div>` : ''}
          ${session.rescheduled_to_date ? `<div style="color: #d97706;">📅 <strong>الموعد البديل:</strong> ${session.rescheduled_to_date} ${session.rescheduled_to_time || ''}</div>` : ''}
        </div>

        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem; border-top: 1px solid var(--centrly-line); padding-top: 0.5rem;">
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('sessions')" style="font-size: 0.75rem;">
            عرض الحصة
          </button>
          ${session.status === 'scheduled' ? `
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.startSessionForGroup('${session.id}')" style="font-size: 0.75rem;">
              بدء التحضير
            </button>
          ` : ''}
        </div>
      </div>
    `;
  }

  const weekDays = [
    { key: 'السبت', label: 'السبت', date: '12 سبتمبر' },
    { key: 'الأحد', label: 'الأحد', date: '6 سبتمبر' },
    { key: 'الإثنين', label: 'الإثنين', date: '7 سبتمبر' },
    { key: 'الثلاثاء', label: 'الثلاثاء', date: '8 سبتمبر' },
    { key: 'الأربعاء', label: 'الأربعاء', date: '9 سبتمبر' },
    { key: 'الخميس', label: 'الخميس', date: '10 سبتمبر' },
    { key: 'الجمعة', label: 'الجمعة', date: '11 سبتمبر' },
  ];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Calendar Header & Navigation Controls -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <h2 class="card-title" style="margin: 0; font-size: 1.35rem;">📅 جدول الحصص والتقويم الأكاديمي</h2>
              <span class="badge badge-primary">${currentDateLabel}</span>
            </div>
            <div style="font-size: 0.85rem; color: var(--centrly-text); margin-top: 0.25rem;">
              استعراض المواعيد الأسبوعية واليومية والشهرية لجميع المجاميع والشُعب بدقة ومتابعة الحالات الطارئة.
            </div>
          </div>

          <!-- View Mode Switcher -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <div style="background: var(--centrly-bg); padding: 0.25rem; border-radius: 8px; display: flex; gap: 0.25rem; border: 1px solid var(--centrly-line);">
              <button class="btn btn-sm ${currentView === 'day' ? 'btn-primary' : 'btn-secondary'}" onclick="window.centrlyApp.switchCalendarView('day')">
                يومي
              </button>
              <button class="btn btn-sm ${currentView === 'week' ? 'btn-primary' : 'btn-secondary'}" onclick="window.centrlyApp.switchCalendarView('week')">
                أسبوعي
              </button>
              <button class="btn btn-sm ${currentView === 'month' ? 'btn-primary' : 'btn-secondary'}" onclick="window.centrlyApp.switchCalendarView('month')">
                شهري
              </button>
            </div>

            <div style="display: flex; gap: 0.25rem;">
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.calendarPrev()" title="الفترة السابقة">
                ▶ السابق
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.calendarToday()" title="اليوم الحالي">
                اليوم
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.calendarNext()" title="الفترة التالية">
                التالي ◀
              </button>
            </div>

            <button class="btn btn-primary btn-sm" onclick="document.getElementById('modalExtraSession') ? document.getElementById('modalExtraSession').style.display='flex' : alert('إضافة حصة إضافية')">
              + إضافة حصة إضافية
            </button>
          </div>
        </div>

        <!-- Filter & KPI Strip -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-top: 1.25rem; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
          <div style="display: flex; gap: 1rem; flex-wrap: wrap; font-size: 0.85rem;">
            <span>📊 إجمالي الحصص: <strong>${totalCount}</strong></span>
            <span style="color: #10b981;">🟢 جارية: <strong>${inProgressCount}</strong></span>
            <span style="color: var(--centrly-blue-700);">🕒 مجدولة: <strong>${scheduledCount}</strong></span>
            <span style="color: var(--centrly-text);">🏁 منتهية: <strong>${completedCount}</strong></span>
            <span style="color: #f59e0b;">📅 مؤجلة: <strong>${rescheduledCount}</strong></span>
            <span style="color: #ef4444;">❌ ملغاة: <strong>${cancelledCount}</strong></span>
            <span style="color: #7c3aed;">⭐ إضافية: <strong>${extraCount}</strong></span>
          </div>

          <div style="display: flex; gap: 0.5rem; align-items: center;">
            <label style="font-size: 0.8rem; font-weight: 700;">المجموعة:</label>
            <select class="form-input" style="width: auto; padding: 0.3rem 0.6rem; font-size: 0.8rem;" onchange="window.centrlyApp.filterCalendarByGroup(this.value)">
              <option value="all">جميع المجاميع</option>
              <option value="grp-1">مجموعة الثانوية العامة - سنتر الأوائل</option>
              <option value="grp-2">أولى ثانوي لغات - سنتر النخبة</option>
              <option value="grp-3">تانية ثانوي - سنتر الأوائل</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Calendar View Display Body -->
      ${
        currentView === 'day'
          ? `
        <!-- DAILY VIEW -->
        <div class="card" style="margin: 0;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; color: var(--centrly-ink);">
            حصص اليوم (${sessions[0]?.date || 'اليوم'})
          </h3>
          <div style="display: flex; flex-direction: column; gap: 1rem;">
            ${sessions.map((s) => renderSessionCard(s)).join('')}
          </div>
        </div>
      `
          : currentView === 'month'
          ? `
        <!-- MONTHLY VIEW -->
        <div class="card" style="margin: 0;">
          <h3 style="margin-top: 0; margin-bottom: 1rem; font-size: 1.1rem; color: var(--centrly-ink);">
            تقويم الشهر (سبتمبر 2026)
          </h3>
          <div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 0.5rem; text-align: center;">
            ${['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة']
              .map((d) => `<div style="font-weight: 800; font-size: 0.85rem; padding: 0.5rem; background: var(--centrly-bg); border-radius: 6px;">${d}</div>`)
              .join('')}
            ${Array.from({ length: 30 }, (_, i) => {
              const dayNum = i + 1;
              const dateStr = `2026-09-${String(dayNum).padStart(2, '0')}`;
              const daySessions = sessions.filter((s) => s.date === dateStr);
              return `
                <div style="min-height: 80px; border: 1px solid var(--centrly-line); border-radius: 6px; padding: 0.4rem; text-align: right; background: ${daySessions.length > 0 ? '#f8fafc' : '#fff'};">
                  <div style="font-weight: 700; font-size: 0.8rem; color: var(--centrly-text);">${dayNum}</div>
                  <div style="display: flex; flex-direction: column; gap: 0.2rem; margin-top: 0.25rem;">
                    ${daySessions
                      .map(
                        (s) => `
                      <div style="font-size: 0.7rem; padding: 0.15rem 0.3rem; border-radius: 4px; background: ${
                        s.is_extra ? '#f3e8ff; color: #7c3aed;' : s.status === 'cancelled' ? '#fee2e2; color: #b91c1c;' : '#e0f2fe; color: #0369a1;'
                      }; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${s.group_name}">
                        ${s.time.split(' ')[0]} ${s.group_name.substring(0, 10)}..
                      </div>
                    `
                      )
                      .join('')}
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      `
          : `
        <!-- WEEKLY VIEW (Default) -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1rem;">
          ${weekDays
            .map((wd) => {
              const daySessions = sessions.filter((s) => s.day_name === wd.key || (s.date && s.date.includes(wd.key)));
              return `
              <div class="card" style="margin: 0; background: #fafbfc; border-top: 3px solid var(--centrly-blue-700);">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.5rem;">
                  <div style="font-weight: 800; font-size: 1rem; color: var(--centrly-ink);">${wd.label}</div>
                  <div style="font-size: 0.75rem; color: var(--centrly-text);">${wd.date}</div>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.75rem;">
                  ${
                    daySessions.length > 0
                      ? daySessions.map((s) => renderSessionCard(s)).join('')
                      : '<div style="font-size: 0.8rem; color: var(--centrly-text); text-align: center; padding: 2rem 0;">لا توجد حصص مجدولة لهذا اليوم</div>'
                  }
                </div>
              </div>
            `;
            })
            .join('')}
        </div>
      `
      }
    </div>
  `;
}
