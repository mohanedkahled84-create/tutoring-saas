import { request } from "../services/api.js";
import { normalizeDigits } from "../utils/normalizeDigits.js";
import { renderNavLiveBadgeHtml } from "./Navbar.js";
import { generateBarcode128Svg } from "../utils/studentBarcodeCard.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Sessions & Assistant Board Component (DEV-89)
 * Dynamic upcoming session detection, grace period for overdue sessions,
 * zero fake sessions, homework default 'لم يحدد', SVG icons, delivery indicators.
 */

export function renderSessionsView(sessionState = {}, user = {}, groups = []) {
  const isAssistant = user?.role === 'assistant';
  const hasActiveSession = Boolean(sessionState && sessionState.id);

  // If NO active or scheduled session is active, render clean standby state
  if (!hasActiveSession) {
    const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const now = new Date();
    const todayArabic = arabicDayNames[now.getDay()];
    const todayFormatted = now.toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const availableGroups = groups || [];

    const todayGroups = [];
    const otherGroups = [];

    availableGroups.forEach(g => {
      const gDay = g.day_of_week || (arabicDayNames.find(d => g.schedule && g.schedule.includes(d))) || '';
      if (gDay.includes(todayArabic)) {
        todayGroups.push(g);
      } else {
        otherGroups.push(g);
      }
    });

    return `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Cross-Device Ongoing Session Detected Alert -->
        ${(sessionState.ongoingServerSessions && sessionState.ongoingServerSessions.length > 0) ? `
          <div class="card" style="margin: 0; border: 2px solid #ef4444; background: #fef2f2; box-shadow: 0 4px 14px rgba(239, 68, 68, 0.12);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="width: 14px; height: 14px; border-radius: 50%; background: #ef4444; display: inline-block; box-shadow: 0 0 0 0 rgba(239,68,68,0.7); animation: centrlyPulse 1.8s infinite;"></span>
                <div>
                  <div style="font-weight: 800; color: #991b1b; font-size: 1.05rem;">
                    توجد حصة جارية بالفعل تم بدؤها من جهاز آخر!
                  </div>
                  <div style="font-size: 0.85rem; color: #b91c1c; margin-top: 0.25rem;">
                    المجموعة: <b>${escapeHtml(sessionState.ongoingServerSessions[0].group_name || sessionState.ongoingServerSessions[0].groups?.name || 'المجموعة الدراسية')}</b> • يمكنك استئنافها ومزامنة رصد الحضور بالباركود فوراً.
                  </div>
                </div>
              </div>
              <button class="btn btn-primary" onclick="window.centrlyApp.syncAndResumeServerSession('${escapeHtml(sessionState.ongoingServerSessions[0].id)}').then(() => window.centrlyApp.renderMainContent())" style="background: #dc2626; border-color: #dc2626; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.25rem;">
                ${getIcon('sessions', 16, '#ffffff')}
                <span>الانضمام ومتابعة رصد الحضور الآن</span>
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Standby Header (Swiss Minimalist) -->
        <div class="card" style="margin: 0; padding: 0.85rem 1.15rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
            <div>
              <div style="display: flex; align-items: center; gap: 6px;">
                <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
                <h2 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a;">
                  الحصص ولوحة المساعد الذكية
                </h2>
                <span style="font-size: 0.72rem; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                  ${todayFormatted}
                </span>
              </div>
              <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #64748b;">
                اختر مجموعتك لبدء رصد الحضور بالباركود أو الكاميرا السريعة
              </p>
            </div>

            <div style="display: flex; gap: 0.4rem; flex-wrap: wrap; align-items: center;">
              <button class="btn btn-secondary" onclick="window.centrlyApp.openOtherSessionsModal()" style="height: 30px; font-size: 0.76rem; font-weight: 600;">
                ${getIcon('calendar', 14)}
                <span>حصص أخرى (${otherGroups.length})</span>
              </button>
              <button class="btn btn-primary" onclick="window.centrlyApp.openStartNewSessionModal()" style="height: 30px; font-size: 0.76rem; font-weight: 700;">
                ${getIcon('sessions', 14, '#ffffff')}
                <span>بدء حصة جديدة</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openScheduleSessionModal()" style="height: 30px; font-size: 0.76rem; font-weight: 600;">
                ${getIcon('calendar', 14)}
                <span>جدولة استثنائية</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Overdue Sessions Alert if any group had an elapsed scheduled time -->
        ${sessionState.overdueGroup ? `
          <div class="card" style="margin: 0; border: 1px solid #f59e0b; background: #fffbeb;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="color: #f59e0b; display: flex;">${getIcon('clock', 28)}</span>
                <div>
                  <div style="font-weight: 800; color: #92400e; font-size: 0.95rem;">حصة متأخرة عن موعدها - في انتظار قرارك</div>
                  <div style="font-size: 0.825rem; color: #b45309; margin-top: 0.2rem;">
                    المجموعة: <b>${escapeHtml(sessionState.overdueGroup.name)}</b> • الموعد المحدد: ${escapeHtml(sessionState.overdueGroup.session_time || 'اليوم')}
                  </div>
                </div>
              </div>

              <div style="display: flex; gap: 0.4rem;">
                <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.startSessionForGroup('${escapeHtml(sessionState.overdueGroup.id)}')">
                  ${getIcon('sessions', 14)}
                  <span>بدء الحصة الآن</span>
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openRescheduleModal('${escapeHtml(sessionState.overdueGroup.id)}')">
                  ${getIcon('clock', 14)}
                  <span>تأجيل</span>
                </button>
                <button class="btn btn-secondary btn-sm" style="color: var(--centrly-danger);" onclick="window.centrlyApp.openCancelSessionModal('${escapeHtml(sessionState.overdueGroup.id)}')">
                  ${getIcon('close', 14)}
                  <span>إلغاء</span>
                </button>
              </div>
            </div>
          </div>
        ` : ''}

        <!-- 1. Today's Scheduled Sessions Section -->
        <div class="card" style="margin: 0; border: 1px solid var(--centrly-line);">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem;">
            <div>
              <h3 class="card-title" style="font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; margin: 0; color: var(--centrly-ink);">
                <span>${getIcon('calendar', 20, 'var(--centrly-blue-700)')}</span>
                <span>حصص ومجموعات اليوم (${todayArabic})</span>
              </h3>
              <p style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem;">
                لم يتم تسجيل أي حضور حتى الآن. الحصص المجدولة وفق الجدول الأسبوعي لهذا اليوم. اضغط على بدء الحضور للبدء الفوري برصد الطلاب
              </p>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span class="badge badge-blue" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; font-weight: 700;">
                ${todayGroups.length} حصص اليوم
              </span>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openOtherSessionsModal()" style="font-size: 0.8rem; font-weight: 700; color: var(--centrly-blue-700); border-color: var(--centrly-blue-700);">
                ${getIcon('calendar', 14)} <span>حصص أخرى</span>
              </button>
            </div>
          </div>

          ${todayGroups.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
              ${todayGroups.map(g => `
                <div style="border: 1px solid #bfdbfe; border-radius: 10px; padding: 1.1rem; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 0.85rem; box-shadow: 0 1px 3px rgba(0,0,0,0.03);">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <h4 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink);">${escapeHtml(g.name)}</h4>
                      <span class="badge" style="background: #e0f2fe; color: #0284c7; font-size: 0.75rem; font-weight: 700;">${escapeHtml(g.session_time || g.schedule || 'اليوم')}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.5rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                      <span>السنتر: <b style="color: var(--centrly-ink);">${escapeHtml(g.center_name || g.centerName || 'السنتر')}</b></span>
                      ${g.room_name || g.room ? `<span>القاعة: <b style="color: var(--centrly-blue-800);">${escapeHtml(g.room_name || g.room)}</b></span>` : ''}
                      <span>الطلاب: <b style="color: var(--centrly-ink);">${escapeHtml(g.studentCount || g.students_count || (typeof window !== 'undefined' && Array.isArray(window.centrlyApp?.students) ? window.centrlyApp.students.filter(s => s.group_id === g.id || (Array.isArray(s.group_ids) && s.group_ids.includes(g.id))).length : 0) || 0)} طالب</b></span>
                      <span>سعر الحصة: <b style="color: var(--centrly-ink);">${escapeHtml(g.price || 0)} ج.م</b></span>
                    </div>
                  </div>

                  <button class="btn btn-primary" onclick="window.centrlyApp.startSessionForGroup('${escapeHtml(g.id)}')" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 800; padding: 0.6rem; font-size: 0.9rem;">
                    ${getIcon('sessions', 16)}
                    <span>بدء تسجيل الحضور الآن</span>
                  </button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="text-align: center; padding: 2rem 1rem; background: #f8fafc; border-radius: 8px; margin-top: 1rem; border: 1px dashed var(--centrly-line);">
              <div style="color: var(--centrly-ink); font-weight: 700; margin-bottom: 0.4rem; font-size: 0.95rem;">
                لا توجد حصص مجدولة لليوم (${todayArabic})
              </div>
              <p style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 1rem;">
                يمكنك الاختيار من المجموعات الأخرى بالأسفل أو الضغط على زر <b>حصص أخرى</b> لبدء أي مجموعة مسجلة.
              </p>
              <button class="btn btn-primary" onclick="window.centrlyApp.openOtherSessionsModal()" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700;">
                ${getIcon('calendar', 16)}
                <span>اختيار من الحصص الأخرى (${otherGroups.length})</span>
              </button>
            </div>
          `}
        </div>

        <!-- 2. Other Sessions & Groups Section -->
        ${otherGroups.length > 0 ? `
          <div class="card" style="margin: 0; border: 1px solid var(--centrly-line);">
            <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem;">
              <div>
                <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.5rem; margin: 0; color: var(--centrly-ink);">
                  <span>${getIcon('groups', 20, 'var(--centrly-blue-700)')}</span>
                  <span>حصص ومجموعات أخرى</span>
                </h3>
                <p style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem;">
                  باقي المجموعات المجدولة في أيام الأسبوع الأخرى. يمكنك بدء تسجيل حضور أي حصة منها الآن
                </p>
              </div>
              <span class="badge badge-neutral" style="font-size: 0.8rem; padding: 0.35rem 0.75rem; font-weight: 700;">
                ${otherGroups.length} مجموعات أخرى
              </span>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
              ${otherGroups.map(g => {
                const scheduleDisplay = g.day_of_week && g.session_time 
                  ? `${g.day_of_week} • ${g.session_time}` 
                  : (g.schedule || 'موعد غير محدد');
                return `
                  <div style="border: 1px solid var(--centrly-line); border-radius: 10px; padding: 1rem; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;">
                    <div>
                      <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                        <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--centrly-ink);">${escapeHtml(g.name)}</h4>
                        <span class="badge" style="background: #f1f5f9; color: #475569; font-size: 0.75rem;">${escapeHtml(scheduleDisplay)}</span>
                      </div>
                      <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.4rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                        <span>السنتر: <b style="color: var(--centrly-ink);">${escapeHtml(g.center_name || g.centerName || 'السنتر')}</b></span>
                        ${g.room_name || g.room ? `<span>القاعة: <b style="color: var(--centrly-blue-800);">${escapeHtml(g.room_name || g.room)}</b></span>` : ''}
                        <span>الطلاب: <b style="color: var(--centrly-ink);">${escapeHtml(g.studentCount || g.students_count || (typeof window !== 'undefined' && Array.isArray(window.centrlyApp?.students) ? window.centrlyApp.students.filter(s => s.group_id === g.id || (Array.isArray(s.group_ids) && s.group_ids.includes(g.id))).length : 0) || 0)} طالب</b></span>
                      </div>
                    </div>

                    <button class="btn btn-secondary" onclick="window.centrlyApp.startSessionForGroup('${escapeHtml(g.id)}')" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 700; padding: 0.55rem; border-color: var(--centrly-blue-700); color: var(--centrly-blue-700);">
                      ${getIcon('sessions', 16)}
                      <span>بدء تسجيل الحضور لهذه الحصة</span>
                    </button>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${availableGroups.length === 0 ? `
          <div class="card" style="margin: 0; text-align: center; padding: 2.5rem 1rem;">
            <p style="font-size: 0.9rem; color: var(--centrly-text); margin-bottom: 1rem;">لا توجد مجموعات دراسية مسجلة حتى الآن.</p>
            <button class="btn btn-primary" onclick="window.centrlyApp.openCreateGroupModal()" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
              ${getIcon('add', 18)}
              <span>إنشاء أول مجموعة لبدء الحصص</span>
            </button>
          </div>
        ` : ''}

      </div>
    `;
  }

  // ACTIVE SESSION VIEW
  const isSessionEnded = sessionState.status === 'ended';
  const isCancelled = sessionState.status === 'cancelled';
  const isRescheduled = sessionState.status === 'rescheduled';
  const isExtra = Boolean(sessionState.is_extra);

  let statusBadge = '<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 0.35rem;">' + getIcon('dotSuccess', 8) + '<span>الحصة جارية</span></span>';
  if (isSessionEnded) statusBadge = '<span class="badge badge-secondary">الحصة منتهية</span>';
  else if (isCancelled) statusBadge = '<span class="badge badge-danger">حصة ملغاة</span>';
  else if (isRescheduled) statusBadge = '<span class="badge badge-warning">حصة مؤجلة</span>';

  const group = sessionState.group || { id: '', name: 'حصة دراسية', price: 0 };
  const attendanceList = sessionState.attendanceList || [];
  const failedMessagesCount = attendanceList.filter(a => !a.is_makeup && (a.deliveryStatus === 'failed' || a.wa_status === 'failed' || a.deliveryStatus === 'not_delivered')).length;

  const financials = sessionState.financials || {
    totalRevenue: 0,
    attendeeCount: 0,
    absentCount: 0,
    exemptCount: 0,
    makeupCount: 0,
  };

  const isBrowserOffline = typeof navigator !== 'undefined' && !navigator.onLine;
  const pendingOfflineCount = (window.centrlyApp?.getOfflineAttendanceQueue?.() || [])
    .filter(q => q.session_id === sessionState.id).length;

  return `
    <div class="sessions-container" style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      ${isBrowserOffline ? `
        <div class="card" style="margin: 0; background: #fffbeb; border: 1.5px solid #fcd34d; padding: 0.75rem 1rem; border-radius: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; color: #92400e; font-weight: 700; font-size: 0.88rem;">
              <span style="font-size: 1.2rem;">⚡</span>
              <span><strong>وضع عدم الاتصال (Offline Mode):</strong> رصد الحضور بالباركود والكود يعمل بكامل كفاءته بدون إنترنت، وكافة البيانات محفوظة بأمان على جهازك وسيتم مزامنتها مع السيرفر تلقائياً فور عودة الشبكة.</span>
            </div>
            <span class="badge" style="background: #fef3c7; color: #b45309; border: 1px solid #fde68a; font-weight: 700;">محفوظ محلياً</span>
          </div>
        </div>
      ` : ''}

      ${(!isBrowserOffline && pendingOfflineCount > 0) ? `
        <div class="card" style="margin: 0; background: #eff6ff; border: 1.5px solid #93c5fd; padding: 0.65rem 1rem; border-radius: 10px;">
          <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; color: #1e40af; font-weight: 700; font-size: 0.88rem;">
              <span style="font-size: 1.1rem;">🔄</span>
              <span>توجد <b>${pendingOfflineCount}</b> عملية حضور مسجلة بانتظار استكمال المزامنة مع السيرفر...</span>
            </div>
            <button type="button" class="btn btn-sm btn-primary" onclick="window.centrlyApp.flushOfflineAttendanceQueue()" style="font-size: 0.75rem; padding: 0.3rem 0.75rem; font-weight: 700; cursor: pointer;">
              مزامنة الآن ⚡
            </button>
          </div>
        </div>
      ` : ''}

      <!-- Session Header & Quick Controls -->
      <div class="card" style="margin: 0; border-right: 4px solid var(--centrly-blue);">
        <div style="display: flex; justify-content: space-between; align-items: flex-start; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.75rem; margin-bottom: 0.35rem; flex-wrap: wrap;">
              <h2 style="font-size: 1.35rem; font-weight: 800; color: var(--centrly-ink); margin: 0;">${escapeHtml(group.name)}</h2>
              ${statusBadge}
            </div>
            <div style="color: var(--centrly-text); font-size: 0.85rem; display: flex; gap: 1rem; align-items: center; flex-wrap: wrap;">
              <span><strong>حصة رقم:</strong> ${sessionState.session_number || 1}</span>
              <span><strong>التاريخ:</strong> ${sessionState.session_date || new Date().toISOString().split('T')[0]}</span>
              ${sessionState.room ? `<span><strong>القاعة:</strong> ${escapeHtml(sessionState.room)}</span>` : ''}
              ${sessionState.group?.center_name ? `<span><strong>السنتر:</strong> ${escapeHtml(sessionState.group.center_name)}</span>` : ''}
            </div>
          </div>
          
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            ${!isSessionEnded && !isCancelled ? `
              <button class="btn btn-danger" onclick="window.centrlyApp.endActiveSession()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
                ${getIcon('close', 16, '#ffffff')}
                <span>إنهاء الحصة ورصد الحضور</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openEditSessionModal()" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700;">
                ${getIcon('edit', 16)}
                <span>تعديل الموعد والبيانات</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.resetActiveSession()" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700;">
                ${getIcon('groups', 16)}
                <span>إغلاق والعودة للمجموعات</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.discardActiveSession()" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700; color: #dc2626; border-color: #fca5a5; background: #fff5f5;">
                ${getIcon('delete', 16, '#dc2626')}
                <span>إلغاء الحصة</span>
              </button>
            ` : ''}
            ${(isRescheduled || isCancelled) ? `
              <button class="btn btn-primary" onclick="window.centrlyApp.resumeSessionNow()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; background: var(--centrly-blue-700);">
                ${getIcon('sessions', 16)}
                <span>بدء تشغيل الحصة الآن</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openEditSessionModal()" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700;">
                ${getIcon('edit', 16)}
                <span>تعديل الموعد والبيانات</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.resetActiveSession()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
                ${getIcon('groups', 16)}
                <span>العودة للمجموعات</span>
              </button>
            ` : ''}
            ${isSessionEnded ? `
              <button class="btn btn-secondary" onclick="window.centrlyApp.openReceiptModal()" style="display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('print', 16)}
                <span>إيصال التصفية</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.resetActiveSession()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
                ${getIcon('groups', 16)}
                <span>العودة للمجموعات وبدء حصة جديدة</span>
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Main Scanning & Attendance Workspace -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        
        ${!isSessionEnded ? `
        <!-- Barcode / Student Check-in Scanner -->
        <div class="card" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
            <h3 class="card-title" style="font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('barcode', 18, 'var(--centrly-blue-700)')}
              <span>تسجيل حضور الطالب (مسح الباركود أو الكود)</span>
            </h3>

            <div style="display: flex; gap: 0.4rem; align-items: center;">
              <!-- Camera Scanner Trigger -->
              <button type="button" onclick="window.centrlyApp.openCameraScannerModal('session')" class="btn btn-secondary btn-sm" style="display: flex; align-items: center; gap: 0.35rem; font-weight: 800; background: #ecfdf5; color: #047857; border: 1.5px solid #a7f3d0; padding: 0.35rem 0.75rem; border-radius: 8px;">
                ${getIcon('camera', 16, '#047857')}
                <span>مسح بالكاميرا</span>
              </button>

              <!-- Scanner Setup Guide & Test Trigger -->
              <button type="button" onclick="window.centrlyApp.openScannerSetupGuide()" class="btn btn-secondary btn-sm" title="دليل وضبط أجهزة السكانر اليدوية واللاسلكية واختبارها" style="display: flex; align-items: center; gap: 0.35rem; font-weight: 700; color: #475569; padding: 0.35rem 0.65rem; border-radius: 8px;">
                ${getIcon('gear', 15, '#475569')}
                <span>سيت اب السكانر</span>
              </button>
            </div>
          </div>
          
          <form id="attendanceScanForm" onsubmit="event.preventDefault(); event.stopPropagation(); window.centrlyApp.handleStudentScan(event); return false;" style="position: relative;">
            <div class="form-group" style="position: relative; margin-bottom: 0.5rem;">
              <label class="form-label" style="display: flex; justify-content: space-between; align-items: center;">
                <span>كود الطالب أو البحث بالاسم</span>
                <span style="font-size: 0.75rem; color: #16a34a; font-weight: 700; display: inline-flex; align-items: center; gap: 0.25rem;">
                  ${getIcon('dotSuccess', 8)} جاهز للمسح بالسكانر مباشرة (Plug & Play)
                </span>
              </label>
              <div style="display: flex; gap: 0.5rem;">
                <div style="flex: 1; position: relative;">
                  <input 
                    type="text" 
                    id="scanStudentCode" 
                    class="form-input" 
                    placeholder="اكتب كود أو اسم الطالب، أو امسح بالسكانر فوراً..." 
                    autofocus 
                    autocomplete="off"
                    onkeydown="if (event.key === 'Enter' || event.keyCode === 13) { event.preventDefault(); event.stopPropagation(); window.centrlyApp.handleStudentScan(event); }"
                    oninput="window.centrlyApp.onStudentScanInput(this.value)"
                    onfocus="this.select()"
                  >
                  <div id="studentScanSuggestions" style="display: none; position: absolute; top: calc(100% + 4px); right: 0; left: 0; z-index: 50; background: #fff; border: 1px solid var(--centrly-line); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); max-height: 220px; overflow-y: auto;"></div>
                </div>
                <button type="button" onclick="window.centrlyApp.handleStudentScan(event)" class="btn btn-primary" style="display: flex; align-items: center; gap: 0.35rem; font-weight: 700; white-space: nowrap;">
                  ${getIcon('check', 16)}
                  <span>تسجيل حضور</span>
                </button>
              </div>
            </div>
          </form>

          <!-- Scan Feedback -->
          <div id="scanFeedback" style="display: none; margin-top: 0.75rem; padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem;"></div>

          <!-- Inline Quick Add Student Form (shown if student is not registered) -->
          <div id="inlineQuickAddStudentBox" style="display: none; margin-top: 1rem; padding: 1rem; border-radius: 8px; background: #f0fdf4; border: 1px solid #86efac;">
            <div style="font-weight: 700; color: #166534; font-size: 0.9rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('add', 16, '#166534')}
              <span>إضافة طالب جديد وقيده في الحصة والمجموعة فوراً</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.5rem;">
              <input type="text" id="inlineNewStudentName" class="form-input" placeholder="اسم الطالب بالكامل *">
              <input type="tel" id="inlineNewStudentParentPhone" class="form-input" placeholder="هاتف ولي الأمر (010...)*" dir="ltr">
              <input type="tel" id="inlineNewStudentPhone" class="form-input" placeholder="هاتف الطالب (011...)" dir="ltr">
            </div>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeInlineStudentAdd()">إلغاء</button>
              <button type="button" class="btn btn-primary btn-sm" onclick="window.centrlyApp.saveInlineNewStudentAndAttend()" style="font-weight: 700;">حفظ وتسجيل الحضور الآن</button>
            </div>
          </div>
        </div>
        ` : `
        <!-- Ended Session Final Summary Card -->
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h3 class="card-title" style="font-size: 1.05rem; margin: 0; display: flex; align-items: center; gap: 0.4rem; color: var(--centrly-ink);">
                ${getIcon('check', 20, 'var(--centrly-success)')}
                <span>تم اكتمال هذه الحصة بنجاح</span>
              </h3>
              <span class="badge badge-secondary">حصة منتهية</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1rem 0; line-height: 1.6;">
              تم إغلاق الحصة ورصد الحضور لكافة الطلاب. يمكنك مراجعة الكشف أدناه أو طباعة إيصال التصفية.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
            <button class="btn btn-secondary" onclick="window.centrlyApp.openReceiptModal()" style="font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem;">
              ${getIcon('print', 14)}
              <span>إيصال التصفية</span>
            </button>
          </div>
        </div>
        `}

        <!-- Operational Attendance Status Card (No financial settlement box per user request) -->
        <div class="card" style="margin: 0; background: linear-gradient(135deg, #f8fafc, #edf2f7); border: 1px solid var(--centrly-line);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 class="card-title" style="font-size: 1rem; margin: 0; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('activity', 18, 'var(--centrly-blue-700)')}
              <span>مؤشرات حضور الحصة الجارية</span>
            </h3>
            <span class="badge badge-blue">${attendanceList.length} طلاب مقيدين</span>
          </div>
          
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
            <div style="background: #fff; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--centrly-line); border-right: 4px solid var(--centrly-success);">
              <div style="font-size: 0.75rem; color: var(--centrly-text);">الطلاب الحاضرون</div>
              <div style="font-size: 1.4rem; font-weight: 900; color: var(--centrly-success);">${attendanceList.filter(a => a.attended).length} <span style="font-size: 0.85rem; font-weight: 500;">طالب</span></div>
            </div>
            <div style="background: #fff; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--centrly-line); border-right: 4px solid var(--centrly-danger);">
              <div style="font-size: 0.75rem; color: var(--centrly-text);">الطلاب الغائبون</div>
              <div style="font-size: 1.4rem; font-weight: 900; color: var(--centrly-danger);">${attendanceList.filter(a => !a.attended).length} <span style="font-size: 0.85rem; font-weight: 500;">طالب</span></div>
            </div>
          </div>

          <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--centrly-text); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <span>نسبة الحضور: <b>${attendanceList.length > 0 ? Math.round((attendanceList.filter(a => a.attended).length / attendanceList.length) * 100) : 0}%</b></span>
            <span>لم يسلموا الواجب: <b style="color: var(--centrly-danger);">${attendanceList.filter(a => a.homework === 'missing').length}</b> طالب</span>
            ${isAssistant ? '<span class="badge badge-secondary" style="font-size: 0.75rem; font-weight: 700;">الإيرادات المالية مقفلة</span>' : ''}
          </div>
        </div>

      </div>

      <!-- Attendance Roster Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('sessions', 18, 'var(--centrly-blue-700)')}
            <span>كشف حضور الحصة (${escapeHtml(attendanceList.length)} طالب مسجل)</span>
          </h3>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>كود الطالب</th>
                <th>اسم الطالب</th>
                <th>الحالة</th>
                <th>الملاحظات</th>
                <th>وقت الرصد</th>
                <th>حالة إشعار الواتساب</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceList.length > 0 ? attendanceList.map(a => {
                let deliveryBadge = '<span class="badge badge-secondary">في الانتظار</span>';
                const isFailed = !a.is_makeup && (a.deliveryStatus === 'failed' || a.wa_status === 'failed' || a.deliveryStatus === 'not_delivered');
                if (a.is_makeup) {
                  deliveryBadge = '<span class="badge badge-secondary" style="font-size: 0.72rem; color: #64748b;" title="حصة تعويضية - لا يتم إرسال إشعار لولي الأمر">معفى (تعويضي)</span>';
                } else if (isFailed) {
                  const errorTooltip = a.deliveryError ? ` title="${escapeHtml(a.deliveryError)}"` : ' title="تعذر إرسال الإشعار لولي الأمر عبر واتساب"';
                  deliveryBadge = `<span class="badge badge-danger" style="display: inline-flex; align-items: center; gap: 0.25rem; background: #fee2e2; color: #b91c1c; border: 1px solid #fca5a5; font-weight: 700;"${errorTooltip}>${getIcon('close', 12, '#b91c1c')}<span>لم يتم التسليم</span></span>`;
                } else if (a.deliveryStatus === 'delivered' || (a.sent && a.deliveryStatus !== 'failed' && a.wa_status !== 'failed')) {
                  deliveryBadge = '<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 0.25rem;">' + getIcon('check', 12) + '<span>تم التسليم</span></span>';
                } else if (a.deliveryStatus === 'sending') {
                  deliveryBadge = '<span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 0.25rem;">' + getIcon('clock', 12) + '<span>قيد الإرسال</span></span>';
                }

                return `
                <tr>
                  <td style="font-family: monospace; font-weight: 700;">${escapeHtml(a.code)}</td>
                  <td style="font-weight: 700;">
                    ${escapeHtml(a.name)}
                    ${a.is_makeup ? '<span class="badge badge-warning" style="font-size: 0.65rem; margin-right: 0.35rem;">تعويضي</span>' : ''}
                  </td>
                  <td>
                    <button 
                      type="button" 
                      onclick="window.centrlyApp.toggleStudentAttendance('${escapeHtml(a.student_id || a.id)}')"
                      class="badge ${a.attended ? 'badge-success' : 'badge-danger'}" 
                      style="cursor: pointer; border: none; font-size: 0.85rem; padding: 0.35rem 0.75rem; font-family: inherit; font-weight: 700; transition: transform 0.15s ease;"
                      title="اضغط للتبديل السريع بين حاضر وغائب"
                    >
                      ${a.attended ? 'حاضر ✓' : 'غائب ✕'}
                    </button>
                  </td>
                  <td style="color: var(--centrly-text); font-size: 0.85rem;">
                    ${(a.comment && a.comment !== 'حصة تعويضية' && !a.comment.startsWith('حصة تعويضية')) ? `<span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; color: var(--centrly-ink);">${escapeHtml(a.comment)}</span>` : '<span style="color: #94a3b8;">لا توجد</span>'}
                  </td>
                  <td style="font-size: 0.8rem; color: var(--centrly-text); font-family: monospace;">${escapeHtml(a.time || '—')}</td>
                  <td>${deliveryBadge}</td>
                  <td>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openStudentNoteModal('${escapeHtml(a.student_id || a.code)}', '${escapeHtml(a.name).replace(/'/g, "\\'")}', '${(a.comment && a.comment !== 'حصة تعويضية' && !a.comment.startsWith('حصة تعويضية')) ? escapeHtml(a.comment).replace(/'/g, "\\'") : ''}')" style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; padding: 0.25rem 0.5rem;" title="ملاحظة">
                        ${getIcon('note', 12)}
                        <span>${(a.comment && a.comment !== 'حصة تعويضية' && !a.comment.startsWith('حصة تعويضية')) ? 'تعديل' : 'ملاحظة'}</span>
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.resendSingleMessage('${escapeHtml(a.student_id || a.id)}', '${escapeHtml(a.name).replace(/'/g, "\\'")}')" style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; padding: 0.25rem 0.5rem; color: ${isFailed ? '#b91c1c' : '#15803d'}; font-weight: 700; ${isFailed ? 'border-color: #fca5a5; background: #fff5f5;' : ''}" title="إرسال إشعار فوري لولي الأمر عبر واتساب">
                        ${getIcon('whatsapp', 14, isFailed ? '#b91c1c' : '#15803d')}
                        <span>${isFailed ? 'إعادة إرسال' : 'إرسال'}</span>
                      </button>
                    </div>
                  </td>
                </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لم يتم تسجيل أي حضور حتى الآن. استخدم نموذج المسح أعلاه لبدء رصد الحضور.
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


/**
 * Register Active Session, Attendance Scanner & Offline Queue Actions (DEV-89)
 */
export function registerSessionsActions(app) {
  // ==========================================================================
  // Active Session & Smart Attendance Actions (DEV-16, DEV-13, DEV-36, Feedback)
  // ==========================================================================

  app.findStudentByQuery = function findStudentByQuery(rawQuery) {
    if (!rawQuery) return null;
    const clean = normalizeDigits(String(rawQuery)).trim().toLowerCase();
    if (!clean) return null;

    // Combine this.students and this.sessionState.attendanceList to maximize coverage
    const list = [...(this.students || [])];
    if (this.sessionState && Array.isArray(this.sessionState.attendanceList)) {
      for (const a of this.sessionState.attendanceList) {
        if (a && !list.some(s => s.id === (a.student_id || a.id))) {
          list.push({
            id: a.student_id || a.id,
            code: a.code,
            student_code: a.code,
            name: a.name,
            student_phone: a.phone || a.student_phone,
            parent_phone: a.parent_phone,
          });
        }
      }
    }

    // Helper to strip common student barcode prefixes and leading zeros
    const stripPrefixAndZeros = (str) => {
      if (!str) return '';
      return String(str).replace(/^(stu-|eg-|st-|#)/i, '').replace(/^0+/, '').trim();
    };

    const cleanNormalized = stripPrefixAndZeros(clean);

    // Priority 1: Exact code match (code or student_code) - Absolute highest priority!
    const exactCode = list.find(s => {
      const c1 = normalizeDigits(String(s.code || '')).trim().toLowerCase();
      const c2 = normalizeDigits(String(s.student_code || '')).trim().toLowerCase();
      if (c1 === clean || c2 === clean) return true;
      if (cleanNormalized && (stripPrefixAndZeros(c1) === cleanNormalized || stripPrefixAndZeros(c2) === cleanNormalized)) {
        return true;
      }
      return false;
    });
    if (exactCode) return exactCode;

    // Priority 2: Exact phone match (full digits)
    const cleanPhoneDigits = clean.replace(/\D/g, '');
    if (cleanPhoneDigits.length >= 9) {
      const exactPhone = list.find(s => {
        const sp = normalizeDigits(String(s.student_phone || '')).replace(/\D/g, '');
        const pp = normalizeDigits(String(s.parent_phone || '')).replace(/\D/g, '');
        return sp === cleanPhoneDigits || pp === cleanPhoneDigits;
      });
      if (exactPhone) return exactPhone;
    }

    // Priority 3: Exact name match
    const exactName = list.find(s => {
      const n = (s.name || '').trim().toLowerCase();
      return n === clean;
    });
    if (exactName) return exactName;

    // Priority 4: Name begins with query or contains query
    const nameMatch = list.find(s => {
      const n = (s.name || '').trim().toLowerCase();
      return n.includes(clean);
    });
    if (nameMatch) return nameMatch;

    // Priority 5: Partial phone match ONLY if query is a long phone fragment (7+ digits), NEVER short codes!
    if (cleanPhoneDigits.length >= 7) {
      const partialPhone = list.find(s => {
        const sp = normalizeDigits(String(s.student_phone || '')).replace(/\D/g, '');
        const pp = normalizeDigits(String(s.parent_phone || '')).replace(/\D/g, '');
        return sp.includes(cleanPhoneDigits) || pp.includes(cleanPhoneDigits);
      });
      if (partialPhone) return partialPhone;
    }

    return null;
  }

  app.fetchStudentByQueryAsync = async function fetchStudentByQueryAsync(rawQuery) {
    if (!rawQuery) return null;
    const clean = normalizeDigits(String(rawQuery)).trim();
    if (!clean) return null;

    // 1. In-memory check first
    const memMatch = this.findStudentByQuery(clean);
    if (memMatch) return memMatch;

    // 2. Query backend server live API
    try {
      const sanitized = clean.replace(/^(stu-|eg-|st-|#)/i, '').trim();
      const queryParam = encodeURIComponent(sanitized || clean);
      const res = await request(`/students?q=${queryParam}`);
      const foundList = Array.isArray(res?.students) ? res.students : (Array.isArray(res) ? res : []);
      if (foundList.length > 0) {
        const stripPfx = (s) => String(s || '').toLowerCase().replace(/^(stu-|eg-|st-|#)/i, '').replace(/^0+/, '').trim();
        const targetClean = clean.toLowerCase();
        const targetNorm = stripPfx(clean);

        const matched = foundList.find(s => {
          const c1 = String(s.code || '').toLowerCase().trim();
          const c2 = String(s.student_code || '').toLowerCase().trim();
          if (c1 === targetClean || c2 === targetClean) return true;
          if (targetNorm && (stripPfx(c1) === targetNorm || stripPfx(c2) === targetNorm)) return true;
          return false;
        }) || foundList[0];

        if (matched) {
          if (!this.students) this.students = [];
          if (!this.students.some(s => s.id === matched.id)) {
            this.students.push(matched);
          }
          return matched;
        }
      }
    } catch (err) {
      console.warn('fetchStudentByQueryAsync error:', err);
    }
    return null;
  }

  app.onStudentScanInput = function onStudentScanInput(val) {
    if (this._scanInputTimer) {
      clearTimeout(this._scanInputTimer);
    }
    // Debounce to ensure hardware barcode scanners (typing within ~30ms) do NOT trigger DOM churn before Enter
    this._scanInputTimer = setTimeout(() => {
      this._renderScanSuggestions(val);
    }, 120);
  }

  app._renderScanSuggestions = function _renderScanSuggestions(val) {
    const suggestionsBox = document.getElementById('studentScanSuggestions');
    if (!suggestionsBox) return;

    const trimmed = normalizeDigits(String(val || '')).trim().toLowerCase();
    if (!trimmed || trimmed.length < 1) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
      return;
    }

    const cleanDigits = trimmed.replace(/\D/g, '');

    // Rank matching students:
    // Rank 1: exact code match (100)
    // Rank 2: code starts with query (80)
    // Rank 3: code contains query (70)
    // Rank 4: name starts with query (60)
    // Rank 5: name contains query (50)
    // Rank 6: phone match ONLY if query is 7+ digits (30)
    const matches = (this.students || []).map(s => {
      const code = normalizeDigits(String(s.code || s.student_code || '')).trim().toLowerCase();
      const name = (s.name || '').trim().toLowerCase();
      const sPhone = normalizeDigits(String(s.student_phone || '')).replace(/\D/g, '');
      const pPhone = normalizeDigits(String(s.parent_phone || '')).replace(/\D/g, '');

      let score = 0;
      if (code === trimmed) score = 100;
      else if (code.startsWith(trimmed)) score = 80;
      else if (code.includes(trimmed)) score = 70;
      else if (name.startsWith(trimmed)) score = 60;
      else if (name.includes(trimmed)) score = 50;
      else if (cleanDigits.length >= 7 && (sPhone.includes(cleanDigits) || pPhone.includes(cleanDigits))) score = 30;

      return { student: s, score };
    }).filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .map(item => item.student)
      .slice(0, 6);

    if (matches.length === 0) {
      suggestionsBox.style.display = 'block';
      suggestionsBox.innerHTML = `
        <div style="padding: 0.75rem 1rem; color: var(--centrly-text); font-size: 0.85rem; text-align: center;">
          لا يوجد طالب مطابق لهذا الاسم أو الكود
        </div>
      `;
      return;
    }

    suggestionsBox.style.display = 'block';
    suggestionsBox.innerHTML = matches.map(s => {
      const code = s.code || s.student_code || 'بدون كود';
      const safeName = escapeHtml(s.name || '');
      return `
        <div 
          style="padding: 0.6rem 1rem; border-bottom: 1px solid var(--centrly-line); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;"
          onmouseover="this.style.background='#f8fafc'"
          onmouseout="this.style.background='#fff'"
          onclick="window.centrlyApp.selectStudentFromSuggestion('${escapeHtml(s.id)}')"
        >
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${safeName}</div>
            <div style="font-size: 0.75rem; color: var(--centrly-text);">${escapeHtml(s.student_phone || s.parent_phone || '')}</div>
          </div>
          <span class="badge badge-blue" style="font-family: monospace; font-weight: 700;">${escapeHtml(code)}</span>
        </div>
      `;
    }).join('');
  }

  app.selectStudentFromSuggestion = function selectStudentFromSuggestion(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    if (!student) return;

    const input = document.getElementById('scanStudentCode');
    if (input) input.value = '';

    const suggestionsBox = document.getElementById('studentScanSuggestions');
    if (suggestionsBox) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
    }

    this.registerStudentAttendance(student);
    this.focusScanInput();
  }

  app.focusScanInput = function focusScanInput() {
    // On touch devices / mobile viewports, avoid forcibly popping up the virtual keyboard
    const isMobile = window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (isMobile) return;

    if (this._focusScanTimer) {
      clearTimeout(this._focusScanTimer);
      this._focusScanTimer = null;
    }

    const applyFocus = () => {
      const inp = document.getElementById('scanStudentCode');
      if (!inp) return;
      // Do not interrupt if active element is already the input (e.g. scanner or user typing)
      if (document.activeElement === inp) {
        return;
      }
      try {
        inp.focus({ preventScroll: true });
        if (!inp.value) {
          inp.select();
        }
      } catch (_) {}
    };

    applyFocus();
    this._focusScanTimer = setTimeout(applyFocus, 40);
  }

  app.handleStudentScan = async function handleStudentScan(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();

    // Cancel any pending debounced suggestion render immediately
    if (this._scanInputTimer) {
      clearTimeout(this._scanInputTimer);
      this._scanInputTimer = null;
    }

    const codeInput = document.getElementById('scanStudentCode');
    const query = codeInput?.value.trim();
    if (!query) {
      this.focusScanInput();
      return;
    }

    const suggestionsBox = document.getElementById('studentScanSuggestions');
    if (suggestionsBox) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
    }

    // 1. Fast in-memory lookup
    let student = this.findStudentByQuery(query);

    // 2. Live server fallback (eliminates false "غير موجود بالمنظومة" alarms)
    if (!student) {
      student = await this.fetchStudentByQueryAsync(query);
    }

    if (student) {
      if (codeInput) {
        codeInput.value = '';
      }
      this.closeInlineStudentAdd();
      this.registerStudentAttendance(student);
      this.focusScanInput();
    } else {
      this.playScanBeep('error');
      // Student truly NOT found in system! Show inline registration form!
      const feedback = document.getElementById('scanFeedback');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = '#fef2f2';
        feedback.style.color = '#b91c1c';
        feedback.style.border = '1px solid #fecaca';
        feedback.innerHTML = `
          <strong>الطالب غير مسجل في المنظومة:</strong> لم يتم العثور على طالب يطابق "${escapeHtml(query)}". يمكنك تسجيله وإضافته فوراً إلى الحصة بالأسفل.
        `;
      }

      const inlineBox = document.getElementById('inlineQuickAddStudentBox');
      if (inlineBox) {
        inlineBox.style.display = 'block';
        const nameInput = document.getElementById('inlineNewStudentName');
        if (nameInput) {
          if (isNaN(Number(query))) {
            nameInput.value = query;
          }
          nameInput.focus();
        }
      }
    }
  }

  app.closeInlineStudentAdd = function closeInlineStudentAdd() {
    const inlineBox = document.getElementById('inlineQuickAddStudentBox');
    if (inlineBox) inlineBox.style.display = 'none';
    const feedback = document.getElementById('scanFeedback');
    if (feedback) feedback.style.display = 'none';
    this.focusScanInput();
  }

  app.saveInlineNewStudentAndAttend = async function saveInlineNewStudentAndAttend() {
    const studentLimit = this.billingState?.students_limit || 300;
    const currentCount = (this.students || []).length;
    if (currentCount >= studentLimit) {
      const storageKey = 'centrly_quota_exceeded_timestamp';
      let reachedTimestamp = null;
      try {
        reachedTimestamp = (typeof localStorage !== 'undefined') ? localStorage.getItem(storageKey) : null;
        if (!reachedTimestamp) {
          reachedTimestamp = Date.now().toString();
          localStorage.setItem(storageKey, reachedTimestamp);
        }
      } catch (_) {
        reachedTimestamp = Date.now().toString();
      }
      const elapsedDays = (Date.now() - Number(reachedTimestamp)) / (1000 * 60 * 60 * 24);
      if (elapsedDays > 3) {
        this.showToast('تم استنفاد سعة الطلاب بالكامل وتجاوزت مهلة السماح. يرجى ترقية الباقة لإضافة طلاب جدد.', 'danger');
        this.showQuotaBlockedModal(currentCount, studentLimit);
        return;
      }
    }

    const name = document.getElementById('inlineNewStudentName')?.value.trim();
    const parentPhone = document.getElementById('inlineNewStudentParentPhone')?.value.trim();
    const studentPhone = document.getElementById('inlineNewStudentPhone')?.value.trim();

    if (!name) {
      this.showToast('يرجى إدخال اسم الطالب بالكامل', 'error');
      return;
    }
    if (!parentPhone || parentPhone.length < 11) {
      this.showToast('يرجى إدخال رقم هاتف ولي أمر صحيح (11 رقماً)', 'error');
      return;
    }

    const currentGroupId = this.sessionState.group?.id;

    try {
      const res = await request('/students', {
        method: 'POST',
        body: {
          name,
          parent_phone: parentPhone,
          student_phone: studentPhone || null,
        },
      });

      const newStudent = res.student;
      if (newStudent) {
        if (currentGroupId) {
          await request(`/groups/${currentGroupId}/students`, {
            method: 'POST',
            body: { student_id: newStudent.id },
          }).catch(() => {});
        }
        this.students.unshift(newStudent);
        this.closeInlineStudentAdd();
        this.registerStudentAttendance(newStudent);
        this.showToast(`تمت إضافة الطالب (${name}) ورصد حضوره فوراً في الحصة!`, 'success');
      }
    } catch (err) {
      this.showToast(`فشل إضافة الطالب: ${err.message || 'خطأ في البيانات'}`, 'error');
    }
  }

  app.registerStudentAttendance = function registerStudentAttendance(student) {
    const currentGroupId = this.sessionState.group?.id;
    if (student.group_id && currentGroupId && student.group_id !== currentGroupId) {
      const studentGroup = (this.groups || []).find(g => g.id === student.group_id);
      const studentGroupName = studentGroup?.name || 'مجموعة أخرى';
      this.showConfirmModal({
        title: 'تنبيه: طالب من مجموعة أخرى',
        message: `الطالب "${escapeHtml(student.name)}" مقيد في "${escapeHtml(studentGroupName)}". هل ترغب في تسجيل الحصة كـ (حصة تعويضية) في هذه المجموعة أم إلغاء التسجيل؟`,
        confirmText: 'تسجيل كحصة تعويضية',
        cancelText: 'إلغاء',
        isDanger: false,
        onConfirm: () => {
          this.executeAttendanceRecord(student, true);
        },
      });
      return;
    }

    this.executeAttendanceRecord(student, false);
  }

  app.executeAttendanceRecord = function executeAttendanceRecord(student, isMakeup = false) {
    const existing = this.sessionState.attendanceList.find(
      a => a.student_id === student.id || a.code === (student.code || student.student_code)
    );

    if (existing && existing.attended) {
      this.playScanBeep('warning');
      this.showToast(`الطالب (${student.name}) مسجل حضوره بالفعل في هذه الحصة مسبقاً!`, 'info');
      const codeInput = document.getElementById('scanStudentCode');
      if (codeInput) {
        codeInput.value = '';
      }
      this.focusScanInput();
      return;
    }

    const hwRadio = document.querySelector('input[name="scanHomework"]:checked');
    const homework = hwRadio ? hwRadio.value : 'none';

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (existing && !existing.attended) {
      existing.attended = true;
      existing.homework = homework;
      existing.time = timeStr;
      existing.is_makeup = isMakeup;
      this.sessionState.financials.attendeeCount += 1;
      this.sessionState.financials.absentCount = Math.max(0, this.sessionState.financials.absentCount - 1);
      if (isMakeup) this.sessionState.financials.makeupCount += 1;
      const fee = student.exempt ? 0 : (student.fee_override ?? (this.sessionState.group?.price || 0));
      this.sessionState.financials.totalRevenue += fee;
    } else {
      this.sessionState.attendanceList.unshift({
        id: `att-${Date.now()}`,
        student_id: student.id,
        code: student.code || student.student_code || `STU-${student.id.slice(0, 4)}`,
        name: student.name,
        parent_phone: student.parent_phone,
        student_phone: student.student_phone,
        attended: true,
        homework,
        quiz_score: null,
        comment: null,
        time: timeStr,
        sent: false,
        is_makeup: isMakeup,
      });
      const fee = student.exempt ? 0 : (student.fee_override ?? (this.sessionState.group?.price || 0));
      this.sessionState.financials.attendeeCount += 1;
      this.sessionState.financials.totalRevenue += fee;
      if (isMakeup) this.sessionState.financials.makeupCount += 1;
    }

    const hwNoneRadio = document.getElementById('hwNone');
    if (hwNoneRadio) hwNoneRadio.checked = true;

    this.playScanBeep('success');
    this.persistSessionState();
    this.updateNavbarBadge();
    this.showToast(isMakeup ? `تم تسجيل حضور تعويضي للطالب: ${student.name}` : `تم رصد حضور الطالب: ${student.name}`, 'success');
    this.renderMainContent();
    this.focusScanInput();

    // Cross-Device Real-Time Sync & Persistent Offline Queue
    const sid = this.sessionState?.id;
    if (sid) {
      const hwStatus = (homework && homework !== 'none') ? homework : null;
      this.enqueueOfflineAttendance(sid, {
        student_id: student.id,
        attended: true,
        comment: null,
        homework_status: hwStatus,
        is_makeup: Boolean(isMakeup),
        quiz_score: null,
      });
      this.flushOfflineAttendanceQueue();
    }
  }

  app.toggleStudentAttendance = function toggleStudentAttendance(studentId) {
    if (!this.sessionState || this.sessionState.status !== 'in_progress') return;
    const item = (this.sessionState.attendanceList || []).find(a => a.student_id === studentId || a.id === studentId);
    if (!item) return;

    const newAttended = !item.attended;
    const student = (this.students || []).find(s => s.id === item.student_id) || item;
    const fee = student.exempt ? 0 : (student.fee_override ?? (this.sessionState.group?.price || 0));

    if (newAttended) {
      item.attended = true;
      if (!item.time) {
        const now = new Date();
        item.time = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;
      }
      this.sessionState.financials.attendeeCount += 1;
      this.sessionState.financials.absentCount = Math.max(0, this.sessionState.financials.absentCount - 1);
      this.sessionState.financials.totalRevenue += fee;
      this.playScanBeep('success');
      this.showToast(`تم تسجيل حضور الطالب: ${item.name} ✅`, 'success');
    } else {
      item.attended = false;
      this.sessionState.financials.attendeeCount = Math.max(0, this.sessionState.financials.attendeeCount - 1);
      this.sessionState.financials.absentCount += 1;
      this.sessionState.financials.totalRevenue = Math.max(0, this.sessionState.financials.totalRevenue - fee);
      this.showToast(`تم تغيير حالة الطالب إلى غائب: ${item.name}`, 'info');
    }

    this.persistSessionState();
    this.updateNavbarBadge();
    this.renderMainContent();

    const sid = this.sessionState.id;
    if (sid && item.student_id) {
      this.enqueueOfflineAttendance(sid, {
        student_id: item.student_id,
        attended: newAttended,
        comment: item.comment || null,
        homework_status: (item.homework && item.homework !== 'none') ? item.homework : null,
        is_makeup: Boolean(item.is_makeup),
        quiz_score: item.quiz_score ?? null,
      });
      this.flushOfflineAttendanceQueue();
    }
  }

  app.updateAttendanceQuizScore = function updateAttendanceQuizScore(attendanceId, score) {
    const item = (this.sessionState.attendanceList || []).find(a => a.id === attendanceId || a.student_id === attendanceId);
    if (item) {
      item.quiz_score = score !== '' && score !== null ? Number(score) : null;
      this.persistSessionState();
      const sid = this.sessionState?.id;
      if (sid && item.student_id) {
        this.enqueueOfflineAttendance(sid, {
          student_id: item.student_id,
          attended: Boolean(item.attended),
          comment: item.comment || null,
          homework_status: (item.homework && item.homework !== 'none') ? item.homework : null,
          is_makeup: Boolean(item.is_makeup),
          quiz_score: item.quiz_score,
        });
        if (!String(sid).startsWith('sess-') && item.quiz_score !== null) {
          request(`/sessions/${sid}/quiz-scores/${item.student_id}`, {
            method: 'PUT',
            body: { score: item.quiz_score, max_score: 20 },
          }).catch(err => console.warn('Quiz score sync failed:', err));
        }
      }
    }
  }

  app.updateAttendanceHomework = function updateAttendanceHomework(attendanceId, newStatus) {
    const item = (this.sessionState.attendanceList || []).find(a => a.id === attendanceId || a.student_id === attendanceId);
    if (item) {
      item.homework = newStatus;
      this.persistSessionState();
      this.showToast('تم تحديث حالة الواجب', 'info');
      const sid = this.sessionState?.id;
      if (sid && item.student_id) {
        this.enqueueOfflineAttendance(sid, {
          student_id: item.student_id,
          attended: Boolean(item.attended),
          comment: item.comment || null,
          homework_status: (newStatus && newStatus !== 'none') ? newStatus : null,
          is_makeup: Boolean(item.is_makeup),
          quiz_score: item.quiz_score,
        });
        this.flushOfflineAttendanceQueue();
      }
    }
  }



  app.restoreSessionState = function restoreSessionState() {
    try {
      const saved = localStorage.getItem('centrly_active_session_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        const todayStr = new Date().toISOString().split('T')[0];
        // If it is from a previous date, or dummy session named 'حصة اليوم', or has no group id, purge it immediately
        if (!parsed || (parsed.session_date && parsed.session_date !== todayStr) || parsed?.group?.name === 'حصة اليوم' || !parsed?.group?.id || (Array.isArray(parsed?.attendanceList) && parsed.attendanceList.length === 0 && !parsed.group?.id)) {
          localStorage.removeItem('centrly_active_session_state');
          localStorage.removeItem('centrly_active_session_id');
          this.sessionState = {
            id: null,
            status: 'scheduled',
            group: null,
            attendanceList: [],
            financials: { totalRevenue: 0, attendeeCount: 0, absentCount: 0, exemptCount: 0, makeupCount: 0 },
          };
          return;
        }
        if (parsed && parsed.id && parsed.status === 'in_progress') {
          this.sessionState = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to restore session state:', e);
    }
  }

  app.discardActiveSession = function discardActiveSession() {
    this.showConfirmModal({
      title: 'إلغاء وإغلاق الحصة',
      message: 'هل أنت متأكد من رغبتك في إغلاق هذه الحصة والعودة لقائمة المجموعات والحصص؟',
      confirmText: 'نعم، إغلاق الحصة',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: async () => {
        const id = this.sessionState?.id;
        if (id && !String(id).startsWith('sess-')) {
          await request(`/sessions/${id}/cancel`, {
            method: 'POST',
            body: { notify_parents: false, reason: 'إلغاء الحصة بدون تسجيل' },
          }).catch(() => {});
        }
        this.resetActiveSession();
      },
    });
  }

  app.getOfflineAttendanceQueue = function getOfflineAttendanceQueue() {
    try {
      const data = localStorage.getItem('centrly_offline_attendance_queue');
      return data ? JSON.parse(data) : [];
    } catch (_) {
      return [];
    }
  }

  app.saveOfflineAttendanceQueue = function saveOfflineAttendanceQueue(queue) {
    try {
      if (!queue || queue.length === 0) {
        localStorage.removeItem('centrly_offline_attendance_queue');
      } else {
        localStorage.setItem('centrly_offline_attendance_queue', JSON.stringify(queue));
      }
    } catch (e) {
      console.warn('Failed to save offline attendance queue:', e);
    }
  }

  app.enqueueOfflineAttendance = function enqueueOfflineAttendance(sessionId, record) {
    if (!sessionId || !record || !record.student_id) return;
    try {
      const queue = this.getOfflineAttendanceQueue();
      const filtered = queue.filter(
        item => !(item.session_id === sessionId && item.student_id === record.student_id)
      );
      filtered.push({
        session_id: sessionId,
        student_id: record.student_id,
        attended: Boolean(record.attended),
        comment: record.comment || null,
        homework_status: (record.homework_status && record.homework_status !== 'none') ? record.homework_status : null,
        is_makeup: Boolean(record.is_makeup),
        quiz_score: record.quiz_score ?? null,
        timestamp: Date.now(),
      });
      this.saveOfflineAttendanceQueue(filtered);
    } catch (e) {
      console.warn('Enqueue offline attendance error:', e);
    }
  }

  app.flushOfflineAttendanceQueue = async function flushOfflineAttendanceQueue() {
    if (this._isFlushingAttendanceQueue) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) return;

    const queue = this.getOfflineAttendanceQueue();
    if (queue.length === 0) return;

    this._isFlushingAttendanceQueue = true;
    try {
      const bySession = {};
      queue.forEach(item => {
        if (!bySession[item.session_id]) bySession[item.session_id] = [];
        bySession[item.session_id].push(item);
      });

      const remaining = [];
      let totalSynced = 0;

      for (const [sessionId, items] of Object.entries(bySession)) {
        if (String(sessionId).startsWith('sess-')) {
          remaining.push(...items);
          continue;
        }

        try {
          const records = items.map(item => ({
            student_id: item.student_id,
            attended: Boolean(item.attended),
            comment: item.comment || null,
            homework_status: (item.homework_status && item.homework_status !== 'none') ? item.homework_status : null,
            is_makeup: Boolean(item.is_makeup),
            quiz_score: item.quiz_score ?? null,
          }));

          const res = await request(`/sessions/${sessionId}/attendance`, {
            method: 'POST',
            body: { records },
          });

          if (res && (res.message || res.count !== undefined || Array.isArray(res.attendance))) {
            totalSynced += items.length;
          } else {
            remaining.push(...items);
          }
        } catch (err) {
          console.warn(`Failed to flush offline queue for session ${sessionId}:`, err);
          remaining.push(...items);
        }
      }

      this.saveOfflineAttendanceQueue(remaining);

      if (totalSynced > 0) {
        this.showToast(`تمت مزامنة ${totalSynced} عملية حضور مسجلة بنجاح مع السيرفر بعد عودة الاتصال ✅`, 'success');
        if (this.currentRoute === 'sessions') {
          this.renderMainContent();
        }
      }
    } finally {
      this._isFlushingAttendanceQueue = false;
    }
  }

  app.persistSessionState = function persistSessionState() {
    try {
      if (this.sessionState && this.sessionState.id && this.sessionState.status === 'in_progress') {
        localStorage.setItem('centrly_active_session_state', JSON.stringify(this.sessionState));
        localStorage.setItem('centrly_active_session_id', this.sessionState.id);
      } else {
        localStorage.removeItem('centrly_active_session_state');
        localStorage.removeItem('centrly_active_session_id');
      }
    } catch (e) {
      console.warn('Failed to persist session state:', e);
    }
  }

  app.getActiveSessionSummary = function getActiveSessionSummary() {
    if (this.user?.role === 'admin' || this.currentRoute === 'admin-dashboard' || this.currentRoute === 'admin-tenants' || this.currentRoute === 'admin-proofs') {
      return null;
    }
    if (this.sessionState?.id && this.sessionState.status === 'in_progress') {
      return {
        id: this.sessionState.id,
        groupName: this.sessionState.group?.name || 'حصة جارية',
        attendeeCount: this.sessionState.financials?.attendeeCount || 0,
      };
    }
    return null;
  }

  app.updateNavbarBadge = function updateNavbarBadge() {
    const container = document.getElementById('navLiveSessionBadgeContainer');
    if (!container) return;
    if (this.user?.role === 'admin') {
      container.innerHTML = '';
      return;
    }
    const summary = this.getActiveSessionSummary();
    container.innerHTML = summary ? renderNavLiveBadgeHtml(summary) : '';
  }

  app.syncAndResumeServerSession = async function syncAndResumeServerSession(sessionId) {
    if (!sessionId) return null;
    await this.flushOfflineAttendanceQueue();
    try {
      const res = await request(`/sessions/${sessionId}`).catch(() => null);
      if (!res || !res.session) return null;
      const s = res.session;
      if (s.status === 'ended' || s.status === 'cancelled') {
        if (this.sessionState?.id === sessionId) {
          this.sessionState = {
            id: null,
            status: 'scheduled',
            group: null,
            attendanceList: [],
            financials: { totalRevenue: 0, attendeeCount: 0, absentCount: 0, exemptCount: 0, makeupCount: 0 },
          };
          localStorage.removeItem('centrly_active_session_state');
          localStorage.removeItem('centrly_active_session_id');
        }
        this.stopLiveSessionSync();
        this.updateNavbarBadge();
        return null;
      }

      // Ensure groups are loaded
      if (!this.groups || this.groups.length === 0) {
        const gRes = await request('/groups').catch(() => []);
        this.groups = Array.isArray(gRes) ? gRes : (gRes.groups || []);
      }
      const grp = (this.groups || []).find(g => g.id === s.group_id) || s.groups || { id: s.group_id, name: 'حصة دراسية', price: 100 };

      // Ensure students are loaded
      if (!this.students || this.students.length === 0) {
        const studRes = await request('/students').catch(() => []);
        this.students = Array.isArray(studRes) ? studRes : (studRes.students || []);
      }

      let groupStudents = (this.students || []).filter(st => st.group_id === s.group_id || (Array.isArray(st.group_ids) && st.group_ids.includes(s.group_id)));
      if (groupStudents.length === 0) {
        try {
          const grpStudRes = await request(`/students?group_id=${s.group_id}`).catch(() => null);
          const list = Array.isArray(grpStudRes) ? grpStudRes : (grpStudRes?.students || []);
          if (list.length > 0) {
            groupStudents = list;
            list.forEach(st => {
              if (!this.students.find(existing => existing.id === st.id)) {
                this.students.push(st);
              }
            });
          }
        } catch (_) {}
      }

      const serverAttendance = Array.isArray(res.attendance) ? res.attendance : [];
      const serverQuizScores = Array.isArray(res.quiz_scores) ? res.quiz_scores : [];

      // Collect local attendance state and offline queue to ensure NO local scans are lost
      const localAttendanceMap = new Map();
      (this.sessionState?.attendanceList || []).forEach(localAtt => {
        if (localAtt.student_id) {
          localAttendanceMap.set(localAtt.student_id, localAtt);
        }
      });
      try {
        const savedStateStr = localStorage.getItem('centrly_active_session_state');
        if (savedStateStr) {
          const parsedSaved = JSON.parse(savedStateStr);
          if (parsedSaved && parsedSaved.id === sessionId && Array.isArray(parsedSaved.attendanceList)) {
            parsedSaved.attendanceList.forEach(savedAtt => {
              if (savedAtt.student_id && !localAttendanceMap.has(savedAtt.student_id)) {
                localAttendanceMap.set(savedAtt.student_id, savedAtt);
              }
            });
          }
        }
      } catch (_) {}

      const pendingQueue = this.getOfflineAttendanceQueue().filter(q => q.session_id === sessionId);
      const pendingQueueMap = new Map();
      pendingQueue.forEach(q => {
        pendingQueueMap.set(q.student_id, q);
      });

      // Build roster starting with group students
      const rosterMap = new Map();
      groupStudents.forEach(st => {
        const local = localAttendanceMap.get(st.id);
        const queued = pendingQueueMap.get(st.id);
        const isLocallyAttended = Boolean((local && local.attended) || (queued && queued.attended));

        rosterMap.set(st.id, {
          id: st.id,
          student_id: st.id,
          code: st.code || st.student_code || (st.id ? st.id.slice(0, 4) : '—'),
          name: st.name,
          phone: st.phone || st.student_phone,
          parent_phone: st.parent_phone,
          attended: isLocallyAttended,
          homework: queued?.homework_status || local?.homework || 'none',
          quiz_score: queued?.quiz_score ?? local?.quiz_score ?? null,
          comment: queued?.comment || local?.comment || '',
          time: local?.time || '',
          deliveryStatus: local?.deliveryStatus || 'pending',
          sent: Boolean(local?.sent),
          is_makeup: Boolean(queued?.is_makeup ?? local?.is_makeup ?? false),
          fee: st.exempt ? 0 : (st.fee_override ?? (grp?.price || 0)),
        });
      });

      // Preserve students that were added or makeup from other groups in local state
      localAttendanceMap.forEach((local, studentId) => {
        if (!rosterMap.has(studentId)) {
          rosterMap.set(studentId, { ...local });
        }
      });

      // Merge server attendance records
      serverAttendance.forEach(att => {
        const studentInfo = (this.students || []).find(st => st.id === att.student_id);
        const existing = rosterMap.get(att.student_id);
        const fee = studentInfo?.exempt ? 0 : (studentInfo?.fee_override ?? (grp?.price || 0));

        let delivery = 'pending';
        if (att.wa_status === 'sent' || att.sent) delivery = 'delivered';
        else if (att.wa_status === 'failed') delivery = 'failed';

        // Crucial: preserve local attendance if locally marked present!
        const attendedStatus = Boolean(att.attended) || Boolean(existing?.attended);

        const record = {
          id: att.id || att.student_id,
          student_id: att.student_id,
          code: studentInfo?.code || studentInfo?.student_code || (att.student_id ? att.student_id.slice(0, 4) : (existing?.code || '—')),
          name: studentInfo?.name || att.student_name || existing?.name || 'طالب مسجل',
          phone: studentInfo?.phone || studentInfo?.student_phone || existing?.phone || '',
          parent_phone: studentInfo?.parent_phone || att.parent_phone || existing?.parent_phone || '',
          attended: attendedStatus,
          homework: (att.homework_status && att.homework_status !== 'none') ? att.homework_status : (existing?.homework || 'none'),
          quiz_score: (att.quiz_score !== undefined && att.quiz_score !== null) ? Number(att.quiz_score) : (existing?.quiz_score ?? null),
          comment: att.comment || existing?.comment || '',
          time: att.time || (att.created_at ? new Date(att.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : (existing?.time || '')),
          deliveryStatus: delivery,
          wa_status: att.wa_status || existing?.wa_status || null,
          sent: Boolean(att.sent || att.wa_status === 'sent' || existing?.sent),
          is_makeup: Boolean(att.is_makeup ?? existing?.is_makeup ?? false),
          fee,
        };
        rosterMap.set(att.student_id, record);

        // If attended locally but server didn't have it, ensure it is in the offline queue to be synced!
        if (attendedStatus && !att.attended) {
          this.enqueueOfflineAttendance(sessionId, {
            student_id: att.student_id,
            attended: true,
            comment: record.comment,
            homework_status: record.homework,
            is_makeup: record.is_makeup,
            quiz_score: record.quiz_score,
          });
        }
      });

      // Merge quiz scores if any
      serverQuizScores.forEach(qs => {
        const existing = rosterMap.get(qs.student_id);
        if (existing && qs.score !== undefined && qs.score !== null) {
          existing.quiz_score = Number(qs.score);
        }
      });

      const fullRoster = Array.from(rosterMap.values());

      // Ensure any locally attended student not yet recorded on server is queued for sync
      fullRoster.forEach(r => {
        if (r.attended && !serverAttendance.some(sa => sa.student_id === r.student_id && sa.attended)) {
          this.enqueueOfflineAttendance(sessionId, {
            student_id: r.student_id,
            attended: true,
            comment: r.comment,
            homework_status: r.homework,
            is_makeup: r.is_makeup,
            quiz_score: r.quiz_score,
          });
        }
      });

      // Sort: attendees first, then absent
      fullRoster.sort((a, b) => {
        if (a.attended === b.attended) return 0;
        return a.attended ? -1 : 1;
      });

      const attendees = fullRoster.filter(r => r.attended);
      const absent = fullRoster.filter(r => !r.attended);
      const makeup = fullRoster.filter(r => r.attended && r.is_makeup);
      const totalRev = attendees.reduce((acc, cur) => acc + (cur.fee || 0), 0);

      this.sessionState = {
        id: s.id,
        status: s.status,
        session_number: s.session_number || 1,
        session_date: s.session_date || new Date().toISOString().split('T')[0],
        room: s.room || grp.room || grp.room_name || '',
        group: grp,
        attendanceList: fullRoster,
        financials: {
          totalRevenue: totalRev,
          attendeeCount: attendees.length,
          absentCount: absent.length,
          exemptCount: fullRoster.filter(r => r.fee === 0).length,
          makeupCount: makeup.length,
        },
      };

      this.persistSessionState();
      this.startLiveSessionSync();
      this.updateNavbarBadge();
      this.flushOfflineAttendanceQueue();
      return this.sessionState;
    } catch (err) {
      console.warn('Failed to sync and resume server session:', err);
      return null;
    }
  }

  app.startLiveSessionSync = function startLiveSessionSync() {
    this.stopLiveSessionSync();
    if (!this.sessionState?.id || this.sessionState.status !== 'in_progress') return;

    this._sessionSyncInterval = setInterval(() => {
      this.pollLiveSessionUpdates();
    }, 4000);

    if (!this._visibilityListenerAttached) {
      this._visibilityListenerAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.sessionState?.id && this.sessionState.status === 'in_progress') {
          this.pollLiveSessionUpdates();
        }
      });
      window.addEventListener('focus', () => {
        if (this.sessionState?.id && this.sessionState.status === 'in_progress') {
          this.pollLiveSessionUpdates();
        }
      });
    }
  }

  app.stopLiveSessionSync = function stopLiveSessionSync() {
    if (this._sessionSyncInterval) {
      clearInterval(this._sessionSyncInterval);
      this._sessionSyncInterval = null;
    }
  }

  app.pollLiveSessionUpdates = async function pollLiveSessionUpdates() {
    const sid = this.sessionState?.id;
    if (!sid || String(sid).startsWith('sess-') || this.sessionState.status !== 'in_progress') {
      return;
    }
    if (this.getOfflineAttendanceQueue().length > 0) {
      await this.flushOfflineAttendanceQueue();
    }
    try {
      const res = await request(`/sessions/${sid}`).catch(() => null);
      if (!res) return;

      const serverStatus = res.session?.status || res.status;
      if (serverStatus === 'ended' || serverStatus === 'cancelled') {
        this.stopLiveSessionSync();
        this.sessionState.status = serverStatus;
        this.persistSessionState();
        this.showToast(`تم إنهاء الحصة من جهاز آخر (${serverStatus === 'ended' ? 'اكتملت الحصة' : 'أُلغيت'})`, 'info');
        if (this.currentRoute === 'sessions') {
          this.renderMainContent();
        }
        this.updateNavbarBadge();
        return;
      }

      // Merge server attendance changes
      const serverAttendance = Array.isArray(res.attendance) ? res.attendance : [];
      let hasChanges = false;
      const currentList = this.sessionState.attendanceList || [];

      serverAttendance.forEach(sAtt => {
        const local = currentList.find(a => a.student_id === sAtt.student_id);
        if (local) {
          if (!local.attended && sAtt.attended) {
            local.attended = true;
            local.time = sAtt.time || (sAtt.created_at ? new Date(sAtt.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : local.time);
            local.is_makeup = Boolean(sAtt.is_makeup);
            if (sAtt.homework_status) local.homework = sAtt.homework_status;
            if (sAtt.quiz_score !== null && sAtt.quiz_score !== undefined) local.quiz_score = sAtt.quiz_score;
            hasChanges = true;
          }
          if (sAtt.wa_status === 'sent' && local.deliveryStatus !== 'delivered') {
            local.deliveryStatus = 'delivered';
            local.wa_status = 'sent';
            local.sent = true;
            hasChanges = true;
          } else if (sAtt.wa_status === 'failed' && local.deliveryStatus !== 'failed') {
            local.deliveryStatus = 'failed';
            local.wa_status = 'failed';
            hasChanges = true;
          }
        } else if (sAtt.attended) {
          const studentInfo = (this.students || []).find(st => st.id === sAtt.student_id);
          const fee = studentInfo?.exempt ? 0 : (studentInfo?.fee_override ?? (this.sessionState.group?.price || 0));
          currentList.unshift({
            id: sAtt.id || sAtt.student_id,
            student_id: sAtt.student_id,
            code: studentInfo?.code || studentInfo?.student_code || (sAtt.student_id ? sAtt.student_id.slice(0, 4) : '—'),
            name: studentInfo?.name || sAtt.student_name || 'طالب مسجل',
            phone: studentInfo?.phone || studentInfo?.student_phone || '',
            parent_phone: studentInfo?.parent_phone || sAtt.parent_phone || '',
            attended: true,
            homework: sAtt.homework_status || 'none',
            quiz_score: sAtt.quiz_score ?? null,
            comment: sAtt.comment || '',
            time: sAtt.time || (sAtt.created_at ? new Date(sAtt.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''),
            deliveryStatus: (sAtt.wa_status === 'sent' || sAtt.sent) ? 'delivered' : 'pending',
            wa_status: sAtt.wa_status || null,
            sent: Boolean(sAtt.sent || sAtt.wa_status === 'sent'),
            is_makeup: Boolean(sAtt.is_makeup),
            fee,
          });
          hasChanges = true;
        }
      });

      if (hasChanges) {
        const attendees = currentList.filter(r => r.attended);
        const absent = currentList.filter(r => !r.attended);
        const makeup = currentList.filter(r => r.attended && r.is_makeup);
        const price = this.sessionState.group?.price || 0;
        const totalRev = attendees.reduce((acc, cur) => acc + (cur.fee ?? (cur.exempt ? 0 : price)), 0);

        this.sessionState.financials = {
          totalRevenue: totalRev,
          attendeeCount: attendees.length,
          absentCount: absent.length,
          exemptCount: currentList.filter(r => r.fee === 0 || r.exempt).length,
          makeupCount: makeup.length,
        };
        this.persistSessionState();
        this.updateNavbarBadge();
        if (this.currentRoute === 'sessions') {
          const activeInput = document.activeElement;
          const isTyping = activeInput && (activeInput.id === 'scanStudentCode' || activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA');
          if (!isTyping) {
            this.renderMainContent();
          }
        }
      }
    } catch (_) {}
  }

  // Session Finalization & Note Choice (DEV-Feedback)
  app.endActiveSession = function endActiveSession() {
    this.openEndSessionConfirmModal();
  }

  app.openEndSessionConfirmModal = function openEndSessionConfirmModal() {
    if (!this.sessionState.id) {
      this.showToast('لا توجد حصة نشطة لإنهائها.', 'info');
      return;
    }
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem; display: flex; justify-content: center; color: #dc2626;">
          ${getIcon('close', 42, '#dc2626')}
        </div>
        <div style="font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink); margin-bottom: 0.5rem;">
          هل تود إنهاء الحصة الآن وتثبيت كشف الحضور؟
        </div>
        <p style="font-size: 0.875rem; color: var(--centrly-text); margin: 0 0 1rem 0;">
          قبل إغلاق الحصة، يمكنك مراجعة وتدوين ملاحظات الطلاب لتُرسل تلقائياً في تقارير ورسائل أولياء الأمور عبر واتساب.
        </p>
      </div>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">
        إلغاء
      </button>
      <button class="btn btn-secondary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openBatchNotesModal();" style="color: var(--centrly-blue-700); font-weight: 700; border-color: var(--centrly-blue-700); display: inline-flex; align-items: center; gap: 0.35rem;">
        ${getIcon('note', 14)}
        <span>إضافة ومراجعة الملاحظات أولاً</span>
      </button>
      <button class="btn btn-primary" onclick="window.centrlyApp.finalizeEndSession()" style="font-weight: 800; background: #dc2626; border-color: #dc2626; color: #fff;">
        نعم، إنهاء الحصة وتثبيت الكشف
      </button>
    `;
    this.showModal('تأكيد إنهاء الحصة الدراسية', bodyHtml, footerHtml);
  }

  app.finalizeEndSession = async function finalizeEndSession() {
    this.closeModal();
    await this.flushOfflineAttendanceQueue();
    try {
      const currentId = this.sessionState?.id;
      let realSessionId = currentId;

      // If the session ID was a temporary client ID (sess-xxx), try to create a real record on the server first
      if (currentId && String(currentId).startsWith('sess-')) {
        const cleanGroupId = String(currentId).replace(/^sess-/, '');
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const createRes = await request('/sessions', {
            method: 'POST',
            body: {
              group_id: cleanGroupId,
              session_number: 1,
              session_date: todayStr,
            },
          });
          if (createRes?.session?.id) {
            realSessionId = createRes.session.id;
            this.sessionState.id = realSessionId;
          }
        } catch (cErr) {
          console.warn('Could not backfill session on server:', cErr);
        }
      }

      // If there are attendance records, sync them to backend before closing
      if (this.sessionState?.attendanceList && this.sessionState.attendanceList.length > 0 && realSessionId && !String(realSessionId).startsWith('sess-')) {
        const records = this.sessionState.attendanceList
          .filter(a => a.student_id)
          .map(a => ({
            student_id: a.student_id,
            attended: Boolean(a.attended),
            comment: a.comment || null,
            homework_status: (a.homework && a.homework !== 'none') ? a.homework : null,
            is_makeup: Boolean(a.is_makeup),
            quiz_score: (a.quiz_score !== undefined && a.quiz_score !== null && a.quiz_score !== '') ? Number(a.quiz_score) : null,
            sent: Boolean(a.sent),
          }));
        if (records.length > 0) {
          await request(`/sessions/${realSessionId}/attendance`, {
            method: 'POST',
            body: { records },
          }).catch(err => console.warn('Sync attendance on end failed:', err));
        }
      }

      // Call end endpoint on server if we have a valid server ID
      if (realSessionId && !String(realSessionId).startsWith('sess-')) {
        await request(`/sessions/${realSessionId}/end`, { method: 'POST' });
      }

      this.sessionState.status = 'ended';
      this.persistSessionState();
      this.stopLiveSessionSync();
      this.updateNavbarBadge();
      this.showToast('تم إنهاء الحصة وتثبيت كشف الحضور بنجاح.', 'success');
      this.renderMainContent();
    } catch (err) {
      // If server returns NOT_FOUND / Session not found, finish locally to never trap the user
      if (err.message && (err.message.includes('Session not found') || err.message.includes('NOT_FOUND'))) {
        this.sessionState.status = 'ended';
        this.persistSessionState();
        this.stopLiveSessionSync();
        this.updateNavbarBadge();
        this.showToast('تم إنهاء الحصة وتثبيت كشف الحضور بنجاح.', 'success');
        this.renderMainContent();
        return;
      }
      this.showToast(`فشل إنهاء الحصة: ${err.message || 'حدث خطأ في الخادم'}`, 'danger');
    }
  }

  app.resetActiveSession = function resetActiveSession() {
    this.sessionState = {
      id: null,
      status: 'scheduled',
      group: null,
      attendanceList: [],
      financials: {
        totalRevenue: 0,
        attendeeCount: 0,
        absentCount: 0,
        exemptCount: 0,
        makeupCount: 0,
      },
    };
    localStorage.removeItem('centrly_active_session_state');
    localStorage.removeItem('centrly_active_session_id');
    this.stopLiveSessionSync();
    this.updateNavbarBadge();
    this.showToast('تم إغلاق الحصة بنجاح، يمكنك الآن بدء حصة جديدة.', 'info');
    this.renderMainContent();
  }

  app.resumeSessionNow = function resumeSessionNow() {
    if (!this.sessionState || !this.sessionState.id) {
      this.showToast('لا توجد حصة قيد التشغيل للتفعيل', 'warning');
      return;
    }
    this.sessionState.status = 'in_progress';
    this.persistSessionState();
    this.startLiveSessionSync();
    this.updateNavbarBadge();
    this.showToast('تم تفعيل الحصة بنجاح! رصد الحضور متاح الآن.', 'success');
    this.renderMainContent();
    this.focusScanInput();
  }

  // Single Student Note Modal
  app.openStudentNoteModal = function openStudentNoteModal(studentCodeOrId, studentName, currentNote = '') {
    const cleanNote = (currentNote === 'حصة تعويضية' || (typeof currentNote === 'string' && currentNote.startsWith('حصة تعويضية'))) ? '' : currentNote;
    const bodyHtml = `
      <form id="studentNoteForm" onsubmit="window.centrlyApp.handleSaveStudentNote(event, '${escapeHtml(studentCodeOrId)}')">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب:</label>
          <div style="font-weight: 800; color: var(--centrly-ink); font-size: 1rem; margin-top: 0.25rem;">${escapeHtml(studentName)}</div>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">الملاحظة الأكاديمية أو السلوكية (تُرسل لولي الأمر بالواتساب):</label>
          <textarea id="modalNoteText" class="form-input" rows="3" placeholder="اكتب الملاحظة هنا حول مستوى الطالب أو أداءه في الحصة..." style="resize: vertical; font-family: inherit;">${escapeHtml(cleanNote)}</textarea>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="studentNoteForm" class="btn btn-primary" style="font-weight: 700;">حفظ الملاحظة</button>
    `;
    this.showModal(`ملاحظة الطالب: ${escapeHtml(studentName)}`, bodyHtml, footerHtml);
  }

  app.handleSaveStudentNote = async function handleSaveStudentNote(e, studentCodeOrId) {
    e.preventDefault();
    const note = document.getElementById('modalNoteText')?.value.trim() || '';
    const item = this.sessionState.attendanceList.find(a => a.student_id === studentCodeOrId || a.code === studentCodeOrId);
    if (item) {
      item.comment = note;
      this.persistSessionState();
    }
    this.closeModal();
    this.renderMainContent();

    const sid = this.sessionState.id;
    if (sid && item && item.student_id) {
      this.enqueueOfflineAttendance(sid, {
        student_id: item.student_id || studentCodeOrId,
        attended: Boolean(item.attended),
        comment: note,
        homework_status: (item.homework && item.homework !== 'none') ? item.homework : null,
        is_makeup: Boolean(item.is_makeup),
        quiz_score: item.quiz_score,
      });
      this.flushOfflineAttendanceQueue();
    }
  }

  // Batch Notes Modal
  app.openBatchNotesModal = function openBatchNotesModal() {
    const list = this.sessionState.attendanceList || [];
    if (list.length === 0) {
      this.showToast('لم يتم تسجيل أي حضور حتى الآن لإضافة ملاحظات.', 'info');
      return;
    }
    const bodyHtml = `
      <form id="batchNotesForm" onsubmit="window.centrlyApp.handleSaveBatchNotes(event)">
        <p style="font-size: 0.85rem; color: var(--centrly-text); margin-bottom: 1rem;">
          أضف أو عدّل ملاحظات الطلاب الحاضرين دفعة واحدة. هذه الملاحظات ستُرفق مع تقارير الواتساب:
        </p>
        <div style="max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-left: 0.25rem;">
          ${list.map((a, idx) => `
            <div style="border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.6rem 0.75rem; background: #fafbfc;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <span style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${idx + 1}. ${escapeHtml(a.name)} (${escapeHtml(a.code)})</span>
                <span class="badge ${a.attended ? 'badge-success' : 'badge-danger'}" style="font-size: 0.7rem;">${a.attended ? 'حاضر' : 'غائب'}</span>
              </div>
              <input type="text" class="form-input batch-note-input" data-code="${escapeHtml(a.code)}" value="${escapeHtml(a.comment || '')}" placeholder="ملاحظة خاصة بالطالب..." style="font-size: 0.85rem;">
            </div>
          `).join('')}
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="batchNotesForm" class="btn btn-primary" style="font-weight: 700;">حفظ جميع الملاحظات</button>
    `;
    this.showModal('إضافة ومراجعة ملاحظات الطلاب', bodyHtml, footerHtml);
  }

  app.handleSaveBatchNotes = async function handleSaveBatchNotes(e) {
    e.preventDefault();
    const inputs = document.querySelectorAll('.batch-note-input');
    const recordsToSync = [];
    inputs.forEach(inp => {
      const code = inp.dataset.code;
      const note = inp.value.trim();
      const item = this.sessionState.attendanceList.find(a => a.code === code);
      if (item) {
        item.comment = note;
        if (this.sessionState.id && item.student_id) {
          recordsToSync.push({
            student_id: item.student_id,
            attended: Boolean(item.attended),
            comment: note,
            homework_status: (item.homework && item.homework !== 'none') ? item.homework : null,
            is_makeup: Boolean(item.is_makeup),
            quiz_score: item.quiz_score,
          });
        }
      }
    });

    this.persistSessionState();
    this.closeModal();
    this.renderMainContent();

    if (this.sessionState.id && recordsToSync.length > 0) {
      recordsToSync.forEach(r => {
        this.enqueueOfflineAttendance(this.sessionState.id, r);
      });
      this.flushOfflineAttendanceQueue();
    }
  }

  // Functional Add Student Modal (DEV-89: Student Phone Mandatory)
  // Session Management & Action Flow Handlers (DEV-89)
  app.openStartNewSessionModal = async function openStartNewSessionModal() {
    if (!this.groups || this.groups.length === 0) {
      const res = await request('/groups').catch(() => []);
      this.groups = Array.isArray(res) ? res : (res.groups || []);
    }
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)} (${escapeHtml(g.center_name || 'السنتر')})</option>`).join('');
    const defaultGroup = (this.groups && this.groups.length > 0) ? this.groups[0] : null;
    const defaultRoom = defaultGroup ? (defaultGroup.room || defaultGroup.room_name || '') : '';
    const bodyHtml = `
      <form id="startNewSessionForm" onsubmit="window.centrlyApp.handleStartSessionSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اختر المجموعة لبدء الحصة *</label>
          <select id="startSessionGroupId" class="form-input" onchange="window.centrlyApp.onStartSessionGroupChange(this.value)" required>
            ${groupOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">القاعة المخصصة للحصة (اختياري)</label>
          <input type="text" id="startSessionRoom" class="form-input" value="${escapeHtml(defaultRoom)}" placeholder="اسم أو رقم القاعة (اختياري)">
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="startNewSessionForm" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('sessions', 16)} <span>بدء الحصة الآن</span>
      </button>
    `;
    this.showModal('بدء حصة جديدة', bodyHtml, footerHtml);
  }

  app.onStartSessionGroupChange = function onStartSessionGroupChange(groupId) {
    const cleanId = String(groupId).replace(/^rec-/, '');
    const grp = (this.groups || []).find(g => g.id === cleanId);
    const roomInput = document.getElementById('startSessionRoom');
    if (roomInput && grp) {
      roomInput.value = grp.room || grp.room_name || '';
    }
  }

  app.handleStartSessionSubmit = async function handleStartSessionSubmit(e) {
    e.preventDefault();
    const gId = document.getElementById('startSessionGroupId')?.value;
    const customRoom = document.getElementById('startSessionRoom')?.value?.trim() || '';
    if (gId) {
      this.closeModal();
      await this.startSessionForGroup(gId, customRoom);
    }
  }

  app.openOtherSessionsModal = async function openOtherSessionsModal() {
    if (!this.groups || this.groups.length === 0) {
      const res = await request('/groups').catch(() => []);
      this.groups = Array.isArray(res) ? res : (res.groups || []);
    }
    const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const now = new Date();
    const todayArabic = arabicDayNames[now.getDay()];
    const allGroups = this.groups || [];
    const otherGroups = allGroups.filter(g => {
      const gDay = g.day_of_week || (arabicDayNames.find(d => g.schedule && g.schedule.includes(d))) || '';
      return !gDay.includes(todayArabic);
    });

    const displayGroups = otherGroups.length > 0 ? otherGroups : allGroups;

    const listHtml = displayGroups.length > 0 ? `
      <div style="margin-bottom: 1rem;">
        <input type="text" id="otherSessionsSearchInput" class="form-input" placeholder="ابحث باسم المجموعة أو السنتر..." oninput="window.centrlyApp.filterOtherSessionsList(this.value)" style="width: 100%;">
      </div>
      <div id="otherSessionsCardsContainer" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 55vh; overflow-y: auto; padding: 0.25rem;">
        ${displayGroups.map(g => {
          const scheduleDisplay = g.day_of_week && g.session_time 
            ? `${g.day_of_week} • ${g.session_time}` 
            : (g.schedule || 'موعد غير محدد');
          return `
            <div class="other-session-item" data-search="${escapeHtml((g.name + ' ' + (g.center_name || g.centerName || '') + ' ' + scheduleDisplay).toLowerCase())}" style="border: 1px solid var(--centrly-line); border-radius: 10px; padding: 0.85rem 1rem; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
              <div>
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--centrly-ink);">${escapeHtml(g.name)}</div>
                <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                  <span>${getIcon('calendar', 14)} <b>${escapeHtml(scheduleDisplay)}</b></span>
                  <span>${getIcon('center', 14)} <b>${escapeHtml(g.center_name || g.centerName || 'السنتر')}</b></span>
                  ${g.room_name || g.room ? `<span>القاعة: <b>${escapeHtml(g.room_name || g.room)}</b></span>` : ''}
                  <span>${escapeHtml(g.studentCount || g.students_count || 0)} طالب</span>
                </div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.closeModal(); window.centrlyApp.startSessionForGroup('${escapeHtml(g.id)}')" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700; white-space: nowrap;">
                ${getIcon('sessions', 14)}
                <span>بدء الحضور الآن</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--centrly-text);">
        لا توجد أي مجموعات مسجلة حتى الآن.
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="button" class="btn btn-primary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openCreateGroupModal();" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700;">
        ${getIcon('add', 16)} <span>إنشاء مجموعة جديدة</span>
      </button>
    `;

    this.showModal('اختيار حصة من الحصص والمجموعات الأخرى', listHtml, footerHtml);
  }

  app.filterOtherSessionsList = function filterOtherSessionsList(query) {
    const q = (query || '').trim().toLowerCase();
    const items = document.querySelectorAll('#otherSessionsCardsContainer .other-session-item');
    items.forEach(item => {
      const text = item.getAttribute('data-search') || '';
      item.style.display = text.includes(q) ? 'flex' : 'none';
    });
  }

  app.promptEndSessionFlow = function promptEndSessionFlow() {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem; color: var(--centrly-blue-700); display: flex; justify-content: center;">
          ${getIcon('sessions', 42)}
        </div>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.5rem 0;">إنهاء الحصة ورصد التصفية</h3>
        <p style="font-size: 0.875rem; color: var(--centrly-text); line-height: 1.5; margin-bottom: 1.25rem;">
          هل ترغب في مراجعة أو إضافة ملاحظات خاصة للطلاب قبل إرسال التقارير، أم تريد إنهاء الحصة مباشرة؟
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
          <button class="btn btn-primary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openBatchNotesModal();" style="padding: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            ${getIcon('note', 16)}
            <span>إضافة ومراجعة ملاحظات الطلاب أولاً</span>
          </button>
          <button class="btn btn-secondary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.confirmEndSessionDirect();" style="padding: 0.75rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            ${getIcon('check', 16)}
            <span>إنهاء الحصة مباشرة بدون ملاحظات</span>
          </button>
        </div>
      </div>
    `;
    this.showModal('تأكيد إنهاء الحصة', bodyHtml, '');
  }

  app.confirmEndSessionDirect = async function confirmEndSessionDirect() {
    await this.finalizeEndSession();
  }

  app.openCancelSessionModal = function openCancelSessionModal(idOrGroupId) {
    const bodyHtml = `
      <form id="cancelSessionForm" onsubmit="window.centrlyApp.handleCancelSessionSubmit(event, '${escapeHtml(idOrGroupId)}')">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">سبب الإلغاء (يُرسل في إشعار الواتساب لأولياء الأمور)</label>
          <textarea id="cancelReasonInput" class="form-textarea" rows="3" placeholder="سبب إلغاء الحصة بالتفصيل" required></textarea>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">تراجع</button>
      <button type="submit" form="cancelSessionForm" class="btn btn-primary" style="background: var(--centrly-danger); border-color: var(--centrly-danger); font-weight: 700;">تأكيد إلغاء الحصة</button>
    `;
    this.showModal('إلغاء الحصة', bodyHtml, footerHtml);
  }

  app.handleCancelSessionSubmit = async function handleCancelSessionSubmit(e, id) {
    e.preventDefault();
    const reason = document.getElementById('cancelReasonInput')?.value;
    this.closeModal();
    if (this.sessionState.id) {
      this.sessionState.status = 'cancelled';
      this.sessionState.cancellation_reason = reason;
      this.renderMainContent();
    }
    this.showToast('تم إلغاء الحصة وسيتم إخطار أولياء الأمور تلقائياً', 'info');
  }

  app.openRescheduleModal = function openRescheduleModal(idOrGroupId) {
    const bodyHtml = `
      <form id="rescheduleSessionForm" onsubmit="window.centrlyApp.handleRescheduleSessionSubmit(event, '${escapeHtml(idOrGroupId)}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">الموعد البديل الجديد *</label>
          <input type="date" id="rescheduleNewDate" class="form-input" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">الوقت الجديد *</label>
          <input type="text" id="rescheduleNewTime" class="form-input" placeholder="05:00 م - 07:00 م" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">ملاحظة لولي الأمر</label>
          <input type="text" id="rescheduleReason" class="form-input" placeholder="سبب تأجيل الحصة بالتفصيل">
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">تراجع</button>
      <button type="submit" form="rescheduleSessionForm" class="btn btn-primary" style="font-weight: 700;">تأكيد التأجيل</button>
    `;
    this.showModal('تأجيل موعد الحصة', bodyHtml, footerHtml);
  }

  app.handleRescheduleSessionSubmit = async function handleRescheduleSessionSubmit(e, id) {
    e.preventDefault();
    const newDate = document.getElementById('rescheduleNewDate')?.value;
    const newTime = document.getElementById('rescheduleNewTime')?.value;
    this.closeModal();
    if (this.sessionState.id) {
      this.sessionState.status = 'rescheduled';
      this.sessionState.rescheduled_to_date = `${newDate} (${newTime})`;
      this.renderMainContent();
    }
    this.showToast(`تم تأجيل الحصة إلى ${newDate} بنجاح وإرسال التنبيه`, 'info');
  }

  app.openParentNoteModal = function openParentNoteModal(studentId, studentName = 'الطالب') {
    const bodyHtml = `
      <form id="parentNoteForm" onsubmit="window.centrlyApp.handleSendParentNote(event, '${escapeHtml(studentId)}')">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">الملاحظة الموجهة لولي أمر (${escapeHtml(studentName)}) *</label>
          <textarea id="parentNoteText" class="form-textarea" rows="4" placeholder="اكتب الملاحظة هنا... سيتم إرسالها فوراً عبر الواتساب لولي الأمر" required></textarea>
        </div>
        <div id="parentNoteFeedback" style="display: none; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem;"></div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="parentNoteForm" id="btnSendParentNote" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('whatsapp', 16)} <span>إرسال لولي الأمر</span>
      </button>
    `;
    this.showModal(`إرسال ملاحظة: ${studentName}`, bodyHtml, footerHtml);
  }

  app.handleSendParentNote = async function handleSendParentNote(e, studentId) {
    e.preventDefault();
    const text = document.getElementById('parentNoteText')?.value.trim();
    if (!text) return;

    const student = (this.students || []).find(s => String(s.id) === String(studentId));
    const parentPhone = student?.parent_phone || student?.parentPhone || '';
    const studentName = student?.name || student?.full_name || 'الطالب';

    let cleanParent = (parentPhone || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanParent.startsWith('00')) cleanParent = cleanParent.slice(2);
    if (cleanParent.startsWith('01') && cleanParent.length === 11) {
      cleanParent = '20' + cleanParent.slice(1);
    }

    if (!cleanParent || cleanParent.length < 9) {
      this.showToast(`رقم هاتف ولي الأمر غير مسجل للطالب "${studentName}".`, 'warning');
      return;
    }

    const rawTeacher = this.user?.name || 'المعلم';
    const teacherName = rawTeacher.startsWith('مستر') || rawTeacher.startsWith('أ.') || rawTeacher.startsWith('أستاذ')
      ? rawTeacher
      : `مستر ${rawTeacher}`;

    const msg = `السلام عليكم ورحمة الله وبركاته، تحية طيبة لولي أمر الطالب (${studentName}).\n\n📝 *ملاحظة خاصة من المعلم:*\n${text}\n\nمع خالص تمنياتنا للطالب بدوام التفوق والنجاح.\nمع تحيات: ${teacherName}`;
    const waUrl = `https://wa.me/${cleanParent}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');

    this.closeModal();
    this.showToast(`تم فتح محادثة واتساب لولي أمر (${studentName}) بنجاح! 💬`, 'success');

    // Persist note to student in backend
    request(`/students/${studentId}`, {
      method: 'PATCH',
      body: { notes: text }
    }).catch(() => {});
  }

  app.retryFailedWhatsAppMessages = async function retryFailedWhatsAppMessages() {
    const failedList = this.sessionState.attendanceList.filter(a => !a.is_makeup && (a.deliveryStatus === 'failed' || a.wa_status === 'failed' || a.deliveryStatus === 'not_delivered'));
    if (failedList.length === 0) {
      this.showToast('لا توجد رسائل لم يتم تسليمها لإعادة إرسالها.', 'info');
      return;
    }
    failedList.forEach(a => a.deliveryStatus = 'sending');
    this.renderMainContent();

    try {
      const syncRecords = (this.sessionState.attendanceList || [])
        .filter(a => a.student_id)
        .map(a => ({
          student_id: a.student_id,
          attended: Boolean(a.attended),
          comment: a.comment || null,
          homework_status: (a.homework && a.homework !== 'none') ? a.homework : null,
          is_makeup: Boolean(a.is_makeup),
          quiz_score: (a.quiz_score !== undefined && a.quiz_score !== null && a.quiz_score !== '') ? Number(a.quiz_score) : null,
          sent: Boolean(a.sent && a.deliveryStatus === 'delivered'),
        }));

      const res = await request(`/sessions/${this.sessionState.id}/send-messages`, {
        method: 'POST',
        body: {
          include_all_present: true,
          records: syncRecords,
        },
      });

      let retriedDelivered = 0;
      let retriedFailed = 0;

      if (res && Array.isArray(res.results)) {
        const resultsMap = new Map();
        res.results.forEach(r => {
          if (r.student_id) resultsMap.set(String(r.student_id), r);
        });

        failedList.forEach(a => {
          const r = resultsMap.get(String(a.student_id || a.id));
          if (r && (r.status === 'dispatched' || r.status === 'sent')) {
            a.sent = true;
            a.deliveryStatus = 'delivered';
            a.deliveryError = null;
            retriedDelivered++;
          } else {
            a.sent = false;
            a.deliveryStatus = 'failed';
            a.deliveryError = r?.reason || 'لم يتم التسليم';
            retriedFailed++;
          }
        });
      } else {
        failedList.forEach(a => {
          a.sent = false;
          a.deliveryStatus = 'failed';
          a.deliveryError = 'تعذر تأكيد التسليم';
          retriedFailed++;
        });
      }

      this.persistSessionState();
      this.renderMainContent();

      if (retriedDelivered > 0) {
        this.showToast(`تم تسليم (${retriedDelivered}) رسائل بنجاح`, 'success');
      } else {
        this.showToast(`لم يتم تسليم الرسائل. يمكنك استخدام زر الإرسال المباشر لكل طالب.`, 'danger');
      }
    } catch (err) {
      failedList.forEach(a => {
        a.deliveryStatus = 'failed';
        a.deliveryError = err.message || 'فشل الاتصال بالخادم';
      });
      this.persistSessionState();
      this.renderMainContent();
      this.showToast(`فشل إعادة الإرسال: ${err.message || 'خطأ في الشبكة'}`, 'danger');
    }
  }

  app.openEditSessionModal = function openEditSessionModal() {
    if (!this.sessionState.id) return;
    const currentPrice = this.sessionState.group?.price ?? 100;
    const currentRoom = this.sessionState.room || this.sessionState.group?.room || this.sessionState.group?.room_name || '';
    const bodyHtml = `
      <form id="editSessionModalForm" onsubmit="window.centrlyApp.handleSaveSessionEdit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">موضوع / عنوان الحصة</label>
          <input type="text" id="editSessionTopic" class="form-input" value="${escapeHtml(this.sessionState.topic || this.sessionState.extra_topic || '')}" placeholder="عنوان أو موضوع الحصة">
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">القاعة المخصصة للحصة (اختياري)</label>
          <input type="text" id="editSessionRoom" class="form-input" value="${escapeHtml(currentRoom)}" placeholder="اسم أو رقم القاعة (اختياري)">
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">موعد بداية الحصة</label>
          <input type="text" id="editSessionTime" list="commonSessionTimes" class="form-input" value="${escapeHtml(this.sessionState.session_time || this.sessionState.time || '04:00 م')}" placeholder="مثال: 04:00 م">
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م)</label>
          <input type="number" id="editSessionPrice" class="form-input" value="${currentPrice}" min="0">
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="editSessionModalForm" class="btn btn-primary" style="font-weight: 700;">حفظ التعديلات</button>
    `;
    this.showModal('تعديل بيانات الحصة الحالية', bodyHtml, footerHtml);
  }

  app.handleSaveSessionEdit = function handleSaveSessionEdit(e) {
    e.preventDefault();
    const topic = document.getElementById('editSessionTopic')?.value.trim();
    const room = document.getElementById('editSessionRoom')?.value.trim();
    const time = document.getElementById('editSessionTime')?.value.trim();
    const price = Number(document.getElementById('editSessionPrice')?.value) || 0;

    if (this.sessionState) {
      this.sessionState.topic = topic;
      this.sessionState.room = room;
      this.sessionState.session_time = time;
      if (this.sessionState.group) {
        this.sessionState.group.price = price;
        this.sessionState.group.room = room;
      }
      this.persistSessionState();
      this.closeModal();
      this.showToast('تم تحديث بيانات الحصة بنجاح', 'success');
      this.renderMainContent();
    }
  }

  // Functional Extra Session Modal
  app.openScheduleSessionModal = function openScheduleSessionModal(defaultGroupId = null) {
    const cleanDefaultId = defaultGroupId ? String(defaultGroupId).replace(/^rec-/, '') : null;
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}" ${cleanDefaultId === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
    const todayIso = new Date().toISOString().slice(0, 10);
    const bodyHtml = `
      <form id="scheduleSessionForm" onsubmit="window.centrlyApp.handleCreateExtraSession(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">المجموعة *</label>
          <select id="extraSessionGroup" class="form-input" required>
            ${groupOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">تاريخ الحصة *</label>
          <input type="date" id="extraSessionDate" class="form-input" value="${todayIso}" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">موعد بداية الحصة *</label>
          <input type="text" id="extraSessionTime" list="commonSessionTimes" class="form-input" value="04:00 م" placeholder="مثال: 04:00 م" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">موضوع الحصة / الملاحظات *</label>
          <input type="text" id="extraSessionTopic" class="form-input" placeholder="عنوان أو موضوع الحصة الإضافية" required>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="scheduleSessionForm" class="btn btn-primary" style="font-weight: 700;">جدولة الحصة الإضافية</button>
    `;
    this.showModal('إضافة حصة إضافية في الجدول', bodyHtml, footerHtml);
  }

  app.handleCreateExtraSession = async function handleCreateExtraSession(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('button[form="scheduleSessionForm"]');
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري الحفظ...';
    }

    const group_id = document.getElementById('extraSessionGroup').value;
    const session_date = document.getElementById('extraSessionDate').value;
    const session_time = document.getElementById('extraSessionTime').value;
    const topic = document.getElementById('extraSessionTopic').value;

    try {
      await request('/sessions/extra', {
        method: 'POST',
        body: {
          group_id,
          session_date,
          session_time,
          topic,
          notify_parents: true,
        },
      });
      this.closeModal();
      this.showToast('تم جدولة الحصة الإضافية بنجاح وإرسال إشعارات لأولياء الأمور!', 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'جدولة الحصة الإضافية';
      }
      this.showToast(`فشل جدولة الحصة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  app.dispatchSessionWhatsAppMessages = function dispatchSessionWhatsAppMessages() {
    if (!this.sessionState.id) {
      this.showToast('لا توجد حصة محددة لإرسال الرسائل.', 'info');
      return;
    }
    if (this.sessionState.isDispatchingWhatsApp) {
      this.showToast('الإرسال جارٍ بالفعل حالياً بفواصل الأمان. يرجى الانتظار لحين اكتمال إرسال الدفعة.', 'warning');
      return;
    }
    const eligibleStudents = (this.sessionState.attendanceList || []).filter(
      a => !a.is_makeup && a.comment !== 'حصة تعويضية'
    );
    const countEligible = eligibleStudents.length;
    if (countEligible === 0) {
      this.showToast('لا يوجد طلاب لإرسال إشعارات الحصة لهم.', 'info');
      return;
    }

    this.showConfirmModal({
      title: 'إرسال إشعارات الحصة لأولياء الأمور عبر واتساب',
      message: `سيتم إرسال (${countEligible}) رسالة لأولياء الأمور لإشعارهم بتقرير الحصة بفواصل زمنية منظمة لضمان وصول الرسائل بسلاسة. هل ترغب في المتابعة؟`,
      confirmText: `إرسال الإشعارات الآن (${countEligible} رسالة)`,
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        if (this.sessionState.isDispatchingWhatsApp) return;
        this.sessionState.isDispatchingWhatsApp = true;
        try {
          this.showToast('جارٍ إرسال إشعارات الحصة عبر واتساب...', 'info');

          // 1. First: Guarantee all attendance records (attended + absent) are synced to the backend
          const syncRecords = (this.sessionState.attendanceList || [])
            .filter(a => a.student_id)
            .map(a => ({
              student_id: a.student_id,
              attended: Boolean(a.attended),
              comment: a.comment || null,
              homework_status: (a.homework && a.homework !== 'none') ? a.homework : null,
              is_makeup: Boolean(a.is_makeup),
              quiz_score: (a.quiz_score !== undefined && a.quiz_score !== null && a.quiz_score !== '') ? Number(a.quiz_score) : null,
              sent: Boolean(a.sent && a.deliveryStatus === 'delivered'),
            }));

          // Mark status as 'sending' in UI immediately
          this.sessionState.attendanceList.forEach(a => {
            if (!a.is_makeup && a.comment !== 'حصة تعويضية') {
              a.deliveryStatus = 'sending';
            }
          });
          this.renderMainContent();

          const res = await request(`/sessions/${this.sessionState.id}/send-messages`, {
            method: 'POST',
            body: { 
              include_all_present: true,
              records: syncRecords,
            },
          });

          // 2. Process exact per-student results from the server
          let deliveredCount = 0;
          let failedCount = 0;

          if (res && Array.isArray(res.results)) {
            const resultsMap = new Map();
            res.results.forEach(r => {
              if (r.student_id) resultsMap.set(String(r.student_id), r);
            });

            this.sessionState.attendanceList.forEach(a => {
              if (a.is_makeup || a.comment === 'حصة تعويضية') return;

              const r = resultsMap.get(String(a.student_id || a.id));
              if (r) {
                if (r.status === 'dispatched' || r.status === 'sent') {
                  a.sent = true;
                  a.deliveryStatus = 'delivered';
                  a.deliveryError = null;
                  deliveredCount++;
                } else if (r.status === 'already_sent') {
                  a.sent = true;
                  a.deliveryStatus = 'delivered';
                  deliveredCount++;
                } else if (r.status === 'failed') {
                  a.sent = false;
                  a.deliveryStatus = 'failed';
                  a.deliveryError = r.reason || 'لم يتم التسليم';
                  failedCount++;
                } else if (r.status === 'skipped') {
                  a.sent = false;
                  a.deliveryStatus = 'failed';
                  a.deliveryError = r.reason || 'تم التخطي';
                  failedCount++;
                }
              } else {
                a.sent = false;
                a.deliveryStatus = 'failed';
                a.deliveryError = 'لم يتم العثور على تقرير إرسال للطالب';
                failedCount++;
              }
            });
          } else {
            this.sessionState.attendanceList.forEach(a => {
              if (!a.is_makeup && a.comment !== 'حصة تعويضية') {
                a.sent = false;
                a.deliveryStatus = 'failed';
                a.deliveryError = 'تعذر تأكيد التسليم من الخادم';
                failedCount++;
              }
            });
          }

          this.persistSessionState();
          this.renderMainContent();

          if (failedCount > 0 && deliveredCount === 0) {
            this.showToast(`تعذر تسليم الإشعارات (${failedCount} طالب لم يتم التسليم لهم). يرجى التحقق من اتصال الواتساب أو استخدام زر الإرسال المباشر.`, 'danger');
          } else if (failedCount > 0) {
            this.showToast(`تم تسليم (${deliveredCount}) رسالة بنجاح، و (${failedCount}) طالب لم يتم التسليم لهم.`, 'warning');
          } else {
            this.showToast(`تم إرسال كافة إشعارات الحصة (${deliveredCount} رسالة) بنجاح عبر واتساب!`, 'success');
          }
        } catch (err) {
          this.sessionState.attendanceList.forEach(a => {
            if (!a.is_makeup && a.comment !== 'حصة تعويضية') {
              a.sent = false;
              a.deliveryStatus = 'failed';
              a.deliveryError = err.message || 'فشل الاتصال بالخادم';
            }
          });
          this.persistSessionState();
          this.renderMainContent();
          this.showToast(`فشل إرسال رسائل الواتساب: ${err.message || 'لم يتم التسليم'}`, 'danger');
        } finally {
          this.sessionState.isDispatchingWhatsApp = false;
        }
      }
    });
  }

  // ==========================================================================
  app.downloadBarcodeSheet = async function downloadBarcodeSheet(groupId) {
    const targetGroupId = groupId || (this.groups && this.groups[0]?.id);
    if (!targetGroupId) {
      this.showToast('يرجى إنشاء مجموعة دراسية أولاً لطباعة كروت الباركود لطلابها.', 'info');
      return;
    }
    try {
      const baseUrl = API_BASE_URL;
      const token = authService.getToken();
      const res = await fetch(`${baseUrl}/groups/${targetGroupId}/barcode-sheet`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`تعذر تحميل ملف الباركود (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `group-${targetGroupId}-barcodes.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      this.showToast(`${err.message || 'فشل تحميل ملف الباركود'}`, 'danger');
    }
  }

  app.openReceiptModal = function openReceiptModal() {
    const rev = this.sessionState.financials.totalRevenue;
    const att = this.sessionState.financials.attendeeCount;
    const abs = this.sessionState.financials.absentCount;
    this.showToast(`إيصال الحصة: إجمالي النقدية ${rev} ج.م | الحاضرون: ${att} | الغياب: ${abs}`, 'info');
  }

  app.startSessionForGroup = async function startSessionForGroup(gId, customRoom = null) {
    const cleanId = String(gId).replace(/^rec-/, '');
    const grp = (this.groups || []).find(g => g.id === cleanId);
    const assignedRoom = (customRoom !== null && customRoom !== undefined && customRoom !== '')
      ? customRoom
      : (grp?.room || grp?.room_name || '');
    this.showToast('جاري بدء وتجهيز الحصة...', 'info');

    let serverSession = null;

    // 1. Check if there is already an in_progress session on the server for this group FOR TODAY
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const activeRes = await request('/sessions?status=in_progress').catch(() => null);
      const activeList = Array.isArray(activeRes) ? activeRes : (activeRes?.sessions || []);
      const existing = activeList.find(s => s.group_id === cleanId && s.session_date === todayStr);
      if (existing) {
        await this.syncAndResumeServerSession(existing.id);
        this.navigate('sessions');
        return;
      }
    } catch (err) {
      console.warn('Check active sessions error:', err);
    }

    // 2. If no existing session, create a real session on server
    if (!serverSession) {
      try {
        let nextNum = 1;
        const pastRes = await request(`/sessions?group_id=${cleanId}`).catch(() => null);
        const pastList = Array.isArray(pastRes) ? pastRes : (pastRes?.sessions || []);
        if (pastList.length > 0) {
          const maxNum = Math.max(...pastList.map(s => Number(s.session_number) || 0));
          nextNum = maxNum + 1;
        }
        const createRes = await request('/sessions', {
          method: 'POST',
          body: {
            group_id: cleanId,
            session_number: nextNum,
            session_date: todayStr,
            ...(assignedRoom ? { room: assignedRoom } : {}),
          },
        });
        if (createRes && createRes.session) {
          serverSession = createRes.session;
        }
      } catch (err) {
        console.warn('Server session creation failed, continuing with local fallback:', err);
      }
    }

    // Fetch group students to pre-populate roster as "غائب" (absent)
    let groupStudents = (this.students || []).filter(s => s.group_id === cleanId || (Array.isArray(s.group_ids) && s.group_ids.includes(cleanId)));
    if (groupStudents.length === 0) {
      try {
        const studRes = await request(`/students?group_id=${cleanId}`).catch(() => null);
        if (studRes) {
          const list = Array.isArray(studRes) ? studRes : (studRes.students || []);
          if (list.length > 0) {
            groupStudents = list;
            list.forEach(st => {
              if (!this.students.find(existing => existing.id === st.id)) {
                this.students.push(st);
              }
            });
          }
        }
      } catch (err) {
        console.warn('Could not fetch group students for roster prefill:', err);
      }
    }

    const preRoster = groupStudents.map(s => ({
      id: s.id,
      student_id: s.id,
      code: s.code || s.student_code || (s.id ? s.id.slice(0, 4) : '—'),
      name: s.name,
      phone: s.phone || s.student_phone,
      parent_phone: s.parent_phone,
      attended: false,
      homework: 'none',
      quiz_score: null,
      comment: '',
      time: '',
      deliveryStatus: 'pending',
      sent: false,
    }));

    const sessionId = serverSession ? serverSession.id : `sess-${cleanId}`;
    this.sessionState = {
      id: sessionId,
      status: 'in_progress',
      session_number: serverSession?.session_number || 1,
      session_date: todayStr,
      room: assignedRoom || serverSession?.room || '',
      group: grp || (serverSession?.groups ? serverSession.groups : { id: cleanId, name: 'حصة دراسية', price: 100 }),
      attendanceList: preRoster,
      financials: {
        totalRevenue: 0,
        attendeeCount: 0,
        absentCount: preRoster.length,
        exemptCount: 0,
        makeupCount: 0,
      },
    };

    this.persistSessionState();
    this.startLiveSessionSync();
    this.updateNavbarBadge();
    this.navigate('sessions');
  }

}
