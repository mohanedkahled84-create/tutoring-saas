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

        <!-- Suggested Sessions / Groups Today for Quick Start -->
        <div class="card" style="margin: 0; border: 1px solid var(--centrly-line); background: #ffffff;">
          <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem;">
            <div>
              <h3 class="card-title" style="font-size: 1.1rem; display: flex; align-items: center; gap: 0.5rem; margin: 0; color: var(--centrly-ink);">
                <span>${getIcon('calendar', 20, 'var(--centrly-blue-700)')}</span>
                <span>حصص اليوم والمجموعات المقترحة للبدء الفوري</span>
              </h3>
              <p style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem;">
                لم يتم تسجيل أي حضور حتى الآن. يمكنك بدء تسجيل حضور الطلاب مسبقاً قبل موعد الحصة لتسهيل وتسريع دخول الطلاب
              </p>
            </div>
            <span class="badge badge-blue" style="font-size: 0.8rem; padding: 0.35rem 0.75rem;">
              ${availableGroups.length} مجموعات متاحة
            </span>
          </div>

          ${availableGroups.length > 0 ? `
            <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; margin-top: 1rem;">
              ${availableGroups.map(g => `
                <div style="border: 1px solid var(--centrly-line); border-radius: 10px; padding: 1rem; background: #f8fafc; display: flex; flex-direction: column; justify-content: space-between; gap: 0.75rem;">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem;">
                      <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--centrly-ink);">${escapeHtml(g.name)}</h4>
                      <span class="badge" style="background: #e0f2fe; color: #0284c7; font-size: 0.75rem;">${escapeHtml(g.session_time || g.schedule || 'اليوم')}</span>
                    </div>
                    <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.4rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                      <span>سعر الحصة: <b style="color: var(--centrly-ink);">${escapeHtml(g.price || 0)} ج.م</b></span>
                      ${g.room_name || g.room ? `<span>القاعة: <b style="color: var(--centrly-blue-800);">${escapeHtml(g.room_name || g.room)}</b></span>` : ''}
                    </div>
                  </div>

                  <button class="btn btn-primary" onclick="window.centrlyApp.startSessionForGroup('${escapeHtml(g.id)}')" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem; font-weight: 700; padding: 0.55rem;">
                    ${getIcon('sessions', 16)}
                    <span>بدء تسجيل الحضور الآن</span>
                  </button>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="text-align: center; padding: 2.5rem 1rem;">
              <p style="font-size: 0.9rem; color: var(--centrly-text); margin-bottom: 1rem;">لا توجد مجموعات دراسية مسجلة حتى الآن.</p>
              <button class="btn btn-primary" onclick="window.centrlyApp.openCreateGroupModal()" style="display: inline-flex; align-items: center; gap: 0.5rem; font-weight: 700;">
                ${getIcon('add', 18)}
                <span>إنشاء أول مجموعة لبدء الحصص</span>
              </button>
            </div>
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
  const failedMessagesCount = attendanceList.filter(a => !a.is_makeup && (a.deliveryStatus === 'failed' || a.wa_status === 'failed' || a.deliveryStatus === 'not_delivered')).length;

  const financials = sessionState.financials || {
    totalRevenue: 0,
    attendeeCount: 0,
    absentCount: 0,
    exemptCount: 0,
    makeupCount: 0,
  };

  return `
    <div class="sessions-container" style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
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
              <button class="btn btn-primary" onclick="window.centrlyApp.dispatchSessionWhatsAppMessages()" style="font-weight: 700; background: #25D366; border-color: #25D366; color: #fff; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('whatsapp', 18, '#ffffff')}
                <span>إرسال تقارير الواتساب للغياب والملاحظات</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openReceiptModal()" style="display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('print', 16)}
                <span>إيصال التصفية</span>
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.resetActiveSession()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
                ${getIcon('groups', 16)}
                <span>العودة للمجموعات وبدء حصة جديدة</span>
              </button>
            ` : ''}
            ${failedMessagesCount > 0 ? `
              <button class="btn btn-secondary" onclick="window.centrlyApp.retryFailedWhatsAppMessages()" style="display: flex; align-items: center; gap: 0.4rem; color: #b91c1c; font-weight: 700; border-color: #fca5a5; background: #fff5f5;">
                ${getIcon('refresh', 16, '#b91c1c')}
                <span>إعادة إرسال (${failedMessagesCount}) رسائل لم يتم تسليمها</span>
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
