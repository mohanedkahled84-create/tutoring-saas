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
    const today = new Date().toLocaleDateString('ar-EG', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const availableGroups = groups || [];

    return `
      <div style="display: flex; flex-direction: column; gap: 1.5rem;">
        
        <!-- Standby Header -->
        <div class="card" style="margin: 0;">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
            <div>
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
                <span>${getIcon('sessions', 22, 'var(--centrly-blue-700)')}</span>
                <span>الحصص ولوحة المساعد الذكية</span>
              </h2>
              <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
                اليوم: <b style="color: var(--centrly-ink);">${today}</b> • نظام الرصد اللحظي بالحضور والباركود
              </p>
            </div>

            <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
              <button class="btn btn-primary" onclick="window.centrlyApp.openStartNewSessionModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
                ${getIcon('sessions', 18)}
                <span>بدء حصة جديدة الآن</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openScheduleSessionModal()" style="display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('calendar', 18)}
                <span>جدولة حصة استثنائية</span>
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

        <!-- Clean Empty State Card with Group Quick-Starters -->
        <div class="card" style="margin: 0; text-align: center; padding: 3rem 1.5rem;">
          <div style="display: flex; justify-content: center; margin-bottom: 1rem; color: var(--centrly-blue-700);">
            ${getIcon('sessions', 52)}
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.5rem 0;">لا توجد حصة قيد التشغيل حالياً</h3>
          <p style="font-size: 0.875rem; color: var(--centrly-text); max-width: 500px; margin: 0 auto 1.5rem auto; line-height: 1.6;">
            لم يتم تسجيل أي حضور حتى الآن. اختر إحدى مجموعاتك الدراسية لبدء رصد الحضور الفوري بالباركود ومتابعة درجات الواجب وإشعارات الواتساب.
          </p>

          ${availableGroups.length > 0 ? `
            <div style="display: flex; justify-content: center; gap: 0.75rem; flex-wrap: wrap; max-width: 700px; margin: 0 auto;">
              ${availableGroups.slice(0, 4).map(g => `
                <button class="btn btn-secondary" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 600; padding: 0.6rem 1rem;" onclick="window.centrlyApp.startSessionForGroup('${escapeHtml(g.id)}')">
                  ${getIcon('sessions', 16, 'var(--centrly-blue-700)')}
                  <span>بدء: ${escapeHtml(g.name)}</span>
                </button>
              `).join('')}
            </div>
          ` : `
            <button class="btn btn-primary" onclick="window.centrlyApp.openCreateGroupModal()" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
              ${getIcon('add', 18)}
              <span>إنشاء أول مجموعة لبدء الحصص</span>
            </button>
          `}
        </div>

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
  const failedMessagesCount = attendanceList.filter(a => a.deliveryStatus === 'failed').length;

  const financials = sessionState.financials || {
    totalRevenue: 0,
    attendeeCount: 0,
    absentCount: 0,
    exemptCount: 0,
    makeupCount: 0,
  };

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Top Action Bar & Session Meta -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">${escapeHtml(group.name)}</h2>
              ${statusBadge}
              ${isExtra ? '<span class="badge" style="background:#ede9fe;color:#7c3aed;">حصة إضافية</span>' : ''}
            </div>
            <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem;">
              حصة رقم ${escapeHtml(sessionState.session_number || 1)} • التاريخ: ${escapeHtml(sessionState.session_date || new Date().toLocaleDateString('ar-EG'))}${sessionState.room ? ` • القاعة: <b style="color: var(--centrly-blue-800);">${escapeHtml(sessionState.room)}</b>` : ''}
            </div>
          </div>

          <!-- Session Flow Buttons -->
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${!isSessionEnded && !isCancelled && !isRescheduled ? `
              <button class="btn btn-secondary" onclick="window.centrlyApp.openEditSessionModal()" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700;">
                ${getIcon('edit', 16)}
                <span>تعديل بيانات الحصة</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openBatchNotesModal()" style="display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; font-weight: 700;">
                ${getIcon('note', 16)}
                <span>ملاحظات الطلاب</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.promptEndSessionFlow()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700; color: var(--centrly-danger); border-color: var(--centrly-danger);">
                ${getIcon('close', 16)}
                <span>إنهاء الحصة</span>
              </button>
            ` : ''}
            ${isSessionEnded ? `
              <button class="btn btn-primary" onclick="window.centrlyApp.dispatchSessionWhatsAppMessages()" style="font-weight: 700; background: #25D366; border-color: #25D366; color: #fff; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('whatsapp', 18, '#ffffff')}
                <span>إرسال تقارير الواتساب للغياب والملاحظات</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openReceiptModal()" style="display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('print', 16)}
                <span>إيصال التصفية</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.resetActiveSession()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
                ${getIcon('add', 16)}
                <span>بدء حصة جديدة أخرى</span>
              </button>
            ` : ''}
            ${failedMessagesCount > 0 ? `
              <button class="btn btn-secondary" onclick="window.centrlyApp.retryFailedWhatsAppMessages()" style="display: flex; align-items: center; gap: 0.4rem; color: var(--centrly-danger); font-weight: 700;">
                ${getIcon('refresh', 16)}
                <span>إعادة إرسال (${failedMessagesCount}) رسالة فاشلة</span>
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
          <h3 class="card-title" style="font-size: 1rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('cards', 18, 'var(--centrly-blue-700)')}
            <span>تسجيل حضور الطالب (مسح الباركود أو الكود)</span>
          </h3>
          
          <form id="attendanceScanForm" onsubmit="window.centrlyApp.handleStudentScan(event)" style="position: relative;">
            <div class="form-group" style="position: relative;">
              <label class="form-label">كود الطالب أو البحث بالاسم</label>
              <div style="display: flex; gap: 0.5rem;">
                <div style="flex: 1; position: relative;">
                  <input 
                    type="text" 
                    id="scanStudentCode" 
                    class="form-input" 
                    placeholder="اكتب كود أو اسم الطالب، أو امسح الباركود..." 
                    autofocus 
                    autocomplete="off"
                    oninput="window.centrlyApp.onStudentScanInput(this.value)"
                  >
                  <div id="studentScanSuggestions" style="display: none; position: absolute; top: calc(100% + 4px); right: 0; left: 0; z-index: 50; background: #fff; border: 1px solid var(--centrly-line); border-radius: 8px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); max-height: 220px; overflow-y: auto;"></div>
                </div>
                <button type="submit" class="btn btn-primary" style="display: flex; align-items: center; gap: 0.35rem; font-weight: 700; white-space: nowrap;">
                  ${getIcon('check', 16)}
                  <span>تسجيل حضور</span>
                </button>
              </div>
            </div>

            <!-- Homework Radio Selector (Default: none / لم يُحدد) -->
            <div class="form-group" style="margin-top: 0.75rem;">
              <label class="form-label" style="font-size: 0.8rem;">حالة الواجب الدراسي للطالب:</label>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem; flex-wrap: wrap;">
                <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; cursor: pointer; background: #f8fafc; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid var(--centrly-line);">
                  <input type="radio" name="scanHomework" value="none" id="hwNone" checked>
                  <span style="color: var(--centrly-text); font-weight: 600;">لم يُحدد</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; cursor: pointer; background: #f8fafc; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid var(--centrly-line);">
                  <input type="radio" name="scanHomework" value="done" id="hwDone">
                  <span style="color: var(--centrly-success); font-weight: 700;">كامل</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; cursor: pointer; background: #f8fafc; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid var(--centrly-line);">
                  <input type="radio" name="scanHomework" value="partial" id="hwPartial">
                  <span style="color: var(--centrly-warning); font-weight: 700;">ناقص</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.3rem; font-size: 0.82rem; cursor: pointer; background: #f8fafc; padding: 0.25rem 0.6rem; border-radius: 6px; border: 1px solid var(--centrly-line);">
                  <input type="radio" name="scanHomework" value="missing" id="hwMissing">
                  <span style="color: var(--centrly-danger); font-weight: 700;">لم يُسلم</span>
                </label>
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
              تم إغلاق الحصة ورصد الحضور والواجب لكافة الطلاب. يمكنك مراجعة الكشف أدناه أو إرسال تقارير الواتساب لأولياء الأمور.
            </p>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; margin-top: 0.5rem;">
            <button class="btn btn-primary" onclick="window.centrlyApp.dispatchSessionWhatsAppMessages()" style="font-weight: 700; background: #25D366; border-color: #25D366; font-size: 0.85rem; display: inline-flex; align-items: center; gap: 0.4rem;">
              ${getIcon('whatsapp', 16, '#ffffff')}
              <span>إرسال تقارير الواتساب للغياب والملاحظات</span>
            </button>
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
                <th>تعديل الواجب لايف</th>
                <th>درجة الكويز</th>
                <th>الملاحظات</th>
                <th>وقت الرصد</th>
                <th>حالة إشعار الواتساب</th>
                <th>الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceList.length > 0 ? attendanceList.map(a => {
                let deliveryBadge = '<span class="badge badge-secondary">في الانتظار</span>';
                if (a.is_makeup) {
                  deliveryBadge = '<span class="badge badge-secondary" style="font-size: 0.72rem; color: #64748b;" title="حصة تعويضية - لا يتم إرسال إشعار لولي الأمر">معفى (تعويضي)</span>';
                } else if (a.deliveryStatus === 'delivered' || a.sent) {
                  deliveryBadge = '<span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 0.25rem;">' + getIcon('check', 12) + '<span>تم التسليم</span></span>';
                } else if (a.deliveryStatus === 'sending') {
                  deliveryBadge = '<span class="badge badge-warning" style="display: inline-flex; align-items: center; gap: 0.25rem;">' + getIcon('clock', 12) + '<span>قيد الإرسال</span></span>';
                } else if (a.deliveryStatus === 'failed') {
                  deliveryBadge = '<span class="badge badge-danger" style="display: inline-flex; align-items: center; gap: 0.25rem;">' + getIcon('close', 12) + '<span>فشل الإرسال</span></span>';
                }

                return `
                <tr>
                  <td style="font-family: monospace; font-weight: 700;">${escapeHtml(a.code)}</td>
                  <td style="font-weight: 700;">
                    ${escapeHtml(a.name)}
                    ${a.is_makeup ? '<span class="badge badge-warning" style="font-size: 0.65rem; margin-right: 0.35rem;">تعويضي</span>' : ''}
                  </td>
                  <td>
                    <span class="badge ${a.attended ? 'badge-success' : 'badge-danger'}">
                      ${a.attended ? 'حاضر' : 'غائب'}
                    </span>
                  </td>
                  <td>
                    <select class="form-select" style="padding: 0.2rem 0.4rem; font-size: 0.8rem; font-weight: 700; width: 105px; border-radius: 6px;" onchange="window.centrlyApp.updateAttendanceHomework('${escapeHtml(a.id)}', this.value)">
                      <option value="none" ${a.homework === 'none' || !a.homework ? 'selected' : ''}>لم يُحدد</option>
                      <option value="done" ${a.homework === 'done' ? 'selected' : ''}>كامل</option>
                      <option value="partial" ${a.homework === 'partial' ? 'selected' : ''}>ناقص</option>
                      <option value="missing" ${a.homework === 'missing' ? 'selected' : ''}>لم يُسلم</option>
                    </select>
                  </td>
                  <td>
                    <div style="display: inline-flex; align-items: center; gap: 0.3rem;">
                      <input 
                        type="number" 
                        min="0" 
                        max="100" 
                        step="0.5" 
                        class="form-input" 
                        placeholder="—"
                        value="${a.quiz_score !== undefined && a.quiz_score !== null && a.quiz_score !== '' ? escapeHtml(a.quiz_score) : ''}"
                        style="width: 70px; padding: 0.2rem 0.4rem; text-align: center; font-family: monospace; font-size: 0.85rem; font-weight: 700; border-radius: 6px;"
                        onchange="window.centrlyApp.updateAttendanceQuizScore('${escapeHtml(a.id || a.student_id)}', this.value)"
                      >
                      ${(a.quiz_score === undefined || a.quiz_score === null || a.quiz_score === '') ? '<span class="badge badge-secondary" style="font-size: 0.7rem;">لم يُصحح بعد</span>' : ''}
                    </div>
                  </td>
                  <td style="color: var(--centrly-text); font-size: 0.85rem;">
                    ${(a.comment && a.comment !== 'حصة تعويضية') ? `<span style="background: #f1f5f9; padding: 0.2rem 0.5rem; border-radius: 4px; font-weight: 600; color: var(--centrly-ink);">${escapeHtml(a.comment)}</span>` : '<span style="color: #94a3b8;">لا توجد</span>'}
                  </td>
                  <td style="font-size: 0.8rem; color: var(--centrly-text); font-family: monospace;">${escapeHtml(a.time || '—')}</td>
                  <td>${deliveryBadge}</td>
                  <td>
                    <div style="display: flex; gap: 0.35rem; align-items: center;">
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openStudentNoteModal('${escapeHtml(a.student_id || a.code)}', '${escapeHtml(a.name).replace(/'/g, "\\'")}', '${escapeHtml(a.comment || '').replace(/'/g, "\\'")}')" style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; padding: 0.25rem 0.5rem;" title="ملاحظة">
                        ${getIcon('note', 12)}
                        <span>${a.comment ? 'تعديل' : 'ملاحظة'}</span>
                      </button>
                      <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.resendSingleMessage('${escapeHtml(a.student_id || a.id)}', '${escapeHtml(a.name).replace(/'/g, "\\'")}')" style="display: inline-flex; align-items: center; gap: 0.25rem; font-size: 0.75rem; padding: 0.25rem 0.5rem; color: #15803d;" title="إرسال إشعار فوري لولي الأمر عبر واتساب">
                        ${getIcon('whatsapp', 14, '#15803d')}
                        <span>إرسال</span>
                      </button>
                    </div>
                  </td>
                </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="9" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
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
