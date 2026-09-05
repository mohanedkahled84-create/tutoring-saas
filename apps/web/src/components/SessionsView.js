/**
 * Centrly Sessions & Attendance Workspace (DEV-16, DEV-13, DEV-36)
 * Real-time scanning, auto-resetting homework selector, role-based financial lock,
 * End Session finalization, and explicit Send Messages button.
 */

export function renderSessionsView(sessionState = {}, user = {}) {
  const isAssistant = user?.role === 'assistant';
  const isSessionEnded = sessionState.status === 'ended';
  const isCancelled = sessionState.status === 'cancelled';
  const isRescheduled = sessionState.status === 'rescheduled';
  const isExtra = Boolean(sessionState.is_extra);

  let statusBadge = '<span class="badge badge-success">🟢 الحصة جارية</span>';
  if (isSessionEnded) statusBadge = '<span class="badge badge-secondary">🏁 الحصة منتهية</span>';
  else if (isCancelled) statusBadge = '<span class="badge" style="background:#ef4444;color:#fff;">❌ ملغاة</span>';
  else if (isRescheduled) statusBadge = '<span class="badge" style="background:#f59e0b;color:#fff;">📅 مؤجلة</span>';
  else if (sessionState.status === 'scheduled') statusBadge = '<span class="badge badge-primary">🕒 مجدولة</span>';

  const group = sessionState.group || {
    id: '',
    name: 'حصة دراسية',
    price: 0,
  };

  const attendanceList = sessionState.attendanceList || [];

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
              <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">${group.name}</h2>
              ${statusBadge}
              ${isExtra ? '<span class="badge" style="background:#7c3aed;color:#fff;">⭐ حصة إضافية</span>' : ''}
            </div>
            <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem;">
              حصة رقم ${sessionState.session_number || 4} • تاريخ: ${sessionState.session_date || new Date().toLocaleDateString('ar-EG')}
              ${sessionState.rescheduled_to_date ? ` • الموعد الجديد: ${sessionState.rescheduled_to_date}` : ''}
              ${sessionState.cancellation_reason ? ` • سبب الإلغاء: ${sessionState.cancellation_reason}` : ''}
            </div>
          </div>

          <!-- Session Flow Buttons (DEV-13 & DEV-50) -->
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            ${!isAssistant && !isCancelled && !isRescheduled ? `
              <button class="btn btn-secondary" onclick="window.centrlyApp.openCancelSessionModal('${sessionState.id || ''}')" style="font-size: 0.85rem;">
                ❌ إلغاء الحصة
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openRescheduleSessionModal('${sessionState.id || ''}')" style="font-size: 0.85rem;">
                📅 تأجيل الحصة
              </button>
            ` : ''}
            ${!isAssistant ? `
              <button class="btn btn-secondary" onclick="window.centrlyApp.openExtraSessionModal('${group.id || ''}')" style="font-size: 0.85rem;">
                ➕ حصة إضافية
              </button>
            ` : ''}
            ${!isSessionEnded && !isCancelled && !isRescheduled ? `
              <button class="btn btn-secondary" onclick="window.centrlyApp.endActiveSession()" style="font-weight: 700;">
                ⏹ إنهاء الحصة (End Session)
              </button>
            ` : ''}
            ${isSessionEnded ? `
              <button class="btn btn-primary" onclick="window.centrlyApp.dispatchSessionWhatsAppMessages()" style="font-weight: 700; background: #25D366; border-color: #25D366; color: #fff;">
                💬 إرسال رسائل الواتساب للغياب والملاحظات
              </button>
              <button class="btn btn-secondary" onclick="window.centrlyApp.openReceiptModal()">
                🧾 طباعة الإيصال والتصفية
              </button>
            ` : ''}
          </div>
        </div>
      </div>

      <!-- Main Scanning & Attendance Workspace -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        
        <!-- Barcode / Student Check-in Scanner -->
        <div class="card" style="margin: 0;">
          <h3 class="card-title" style="font-size: 1rem; margin-bottom: 0.75rem;">
            📷 تسجيل حضور الطالب (Scan / Code Entry)
          </h3>
          
          <form id="attendanceScanForm" onsubmit="window.centrlyApp.handleStudentScan(event)">
            <div class="form-group">
              <label class="form-label">كود الطالب أو مسح الباركود</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="text" id="scanStudentCode" class="form-input" placeholder="امسح أو اكتب الكود (مثال: 1001)" autofocus ${isSessionEnded ? 'disabled' : ''} dir="ltr">
                <button type="submit" class="btn btn-primary" ${isSessionEnded ? 'disabled' : ''}>
                  تسجيل
                </button>
              </div>
            </div>

            <!-- Homework Radio Selector (MUST auto-reset to 'done' after scan) -->
            <div class="form-group" style="margin-top: 1rem;">
              <label class="form-label">حالة الواجب الدراسي:</label>
              <div style="display: flex; gap: 1rem; margin-top: 0.35rem;">
                <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; cursor: pointer;">
                  <input type="radio" name="scanHomework" value="done" id="hwDone" checked>
                  <span style="color: var(--centrly-success); font-weight: 700;">كامل (Done)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; cursor: pointer;">
                  <input type="radio" name="scanHomework" value="partial" id="hwPartial">
                  <span style="color: var(--centrly-amber-700); font-weight: 700;">ناقص (Partial)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.35rem; font-size: 0.85rem; cursor: pointer;">
                  <input type="radio" name="scanHomework" value="missing" id="hwMissing">
                  <span style="color: var(--centrly-danger); font-weight: 700;">لم يُسلم (Missing)</span>
                </label>
              </div>
            </div>

            <!-- Optional Comment for WhatsApp report -->
            <div class="form-group" style="margin-top: 1rem;">
              <label class="form-label">ملاحظة لولي الأمر (اختياري - تُرسل بالواتساب)</label>
              <input type="text" id="scanComment" class="form-input" placeholder="مثال: متفوق اليوم، يحتاج تركيز بالمسائل...">
            </div>
          </form>

          <div id="scanFeedback" style="display: none; margin-top: 1rem; padding: 0.75rem; border-radius: var(--radius-md); font-size: 0.85rem;"></div>
        </div>

        <!-- Role-based Financial Summary (Protected against Assistant Role!) -->
        ${!isAssistant ? `
          <div class="card" style="margin: 0; background: linear-gradient(135deg, #f8fafc, #edf2f7); border: 1px solid var(--centrly-line);">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
              <h3 class="card-title" style="font-size: 1rem; margin: 0;">
                💰 الإيرادات وتصفية الحصة (Financial Summary)
              </h3>
              <span class="badge badge-blue">خاص بالمعلم والمالك</span>
            </div>
            
            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-top: 1rem;">
              <div style="background: #fff; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--centrly-line);">
                <div style="font-size: 0.75rem; color: var(--centrly-text);">إجمالي النقدية المحصلة</div>
                <div style="font-size: 1.4rem; font-weight: 900; color: var(--centrly-success);">${financials.totalRevenue} ج.م</div>
              </div>
              <div style="background: #fff; padding: 0.75rem; border-radius: var(--radius-md); border: 1px solid var(--centrly-line);">
                <div style="font-size: 0.75rem; color: var(--centrly-text);">سعر الحصة الأساسي</div>
                <div style="font-size: 1.4rem; font-weight: 900; color: var(--centrly-ink);">${group.price} ج.م</div>
              </div>
            </div>

            <div style="margin-top: 1rem; font-size: 0.8rem; color: var(--centrly-text); display: flex; justify-content: space-between;">
              <span>الطلاب الحاضرين: <b>${financials.attendeeCount}</b></span>
              <span>الغياب: <b>${financials.absentCount}</b></span>
              <span>معفي / منحة: <b>${financials.exemptCount}</b></span>
            </div>
          </div>
        ` : `
          <!-- Assistant Role View: Profit Lock enforced! -->
          <div class="card" style="margin: 0; background: #fff; border: 1px dashed var(--centrly-line); display: flex; align-items: center; justify-content: center; text-align: center; padding: 2rem;">
            <div>
              <div style="font-size: 2rem; margin-bottom: 0.5rem;">🔒</div>
              <div style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">الإيرادات المالية مقفلة</div>
              <p style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem;">
                حساب المساعد مخصص لرصد الحضور والواجب فقط، البيانات المالية لا تظهر في حساب المساعد لحماية خصوصية المعلم.
              </p>
            </div>
          </div>
        `}

      </div>

      <!-- Attendance Roster Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header">
          <h3 class="card-title" style="font-size: 1.05rem;">
            📋 كشف حضور حصة اليوم (${attendanceList.length} طلاب مسجلين)
          </h3>
          <span style="font-size: 0.8rem; color: var(--centrly-text);">
            الرسائل تُرسل كدفعة واحدة عبر واتساب بعد إنهاء الحصة
          </span>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>كود الطالب</th>
                <th>اسم الطالب</th>
                <th>الحالة</th>
                <th>الواجب</th>
                <th>الملاحظات</th>
                <th>وقت الرصد</th>
                <th>إشعار الواتساب</th>
              </tr>
            </thead>
            <tbody>
              ${attendanceList.length > 0 ? attendanceList.map(a => `
                <tr>
                  <td style="font-family: monospace; font-weight: 700;">${a.code}</td>
                  <td style="font-weight: 700;">${a.name}</td>
                  <td>
                    <span class="badge ${a.attended ? 'badge-success' : 'badge-danger'}">
                      ${a.attended ? 'حاضر' : 'غائب'}
                    </span>
                  </td>
                  <td>
                    <span class="badge ${a.homework === 'done' ? 'badge-success' : (a.homework === 'partial' ? 'badge-warning' : 'badge-danger')}">
                      ${a.homework === 'done' ? 'كامل' : (a.homework === 'partial' ? 'ناقص' : 'لم يُسلم')}
                    </span>
                  </td>
                  <td style="color: var(--centrly-text); font-size: 0.85rem;">
                    ${a.comment || '—'}
                  </td>
                  <td style="font-size: 0.8rem; color: var(--centrly-text);">${a.time}</td>
                  <td>
                    <span class="badge ${a.sent ? 'badge-success' : 'badge-secondary'}">
                      ${a.sent ? 'تم الإرسال' : (isSessionEnded ? 'جاهز للإرسال' : 'في الانتظار')}
                    </span>
                  </td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لم يتم تسجيل أي حضور حتى الآن. استخدم نموذج المسح أو إدخال الكود أعلاه للبدء.
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
