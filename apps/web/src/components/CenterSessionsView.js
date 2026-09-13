import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Center Multi-Sessions & Smart Gate Component
 * Features:
 * - Smart Front-Desk Barcode Scanner: Auto-detects student, finds active teacher & room, marks attendance
 * - Concurrent Sessions Grid: Allows running multiple sessions at the same time in different rooms
 * - Upcoming Sessions List: Sorted by time/date with quick-launch triggers
 */

export function renderCenterSessionsView(state = {}, groups = [], rooms = [], teachers = []) {
  const activeSessions = state.activeSessions || [];
  const upcomingSessions = state.upcomingSessions || [];
  const scanResult = state.scanResult || null;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title Header -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('sessions', 22, 'var(--centrly-blue-700)')}</span>
              <span>إدارة حصص وقاعات السنتر وبوابة الاستقبال الذكية</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              تشغيل عدة حصص في نفس الوقت في قاعات مختلفة مع التوجيه التلقائي للطالب عند مسح الباركود في الاستقبال.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openCenterStartSessionModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('add', 16)}
              <span>تشغيل حصة جديدة في قاعة</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.navigate('calendar')" style="display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('calendar', 16)}
              <span>جدول القاعات الشامل</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Smart Front-Desk Barcode Scanner Card -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; border: none; box-shadow: 0 10px 25px rgba(15,23,42,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <span style="color: #60a5fa;">${getIcon('cards', 22, '#60a5fa')}</span>
            <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: #fff;">
              ماسح بوابة الاستقبال الذكية (Smart Front-Desk Gate)
            </h3>
          </div>
          <span class="badge" style="background: rgba(59,130,246,0.2); color: #93c5fd; border: 1px solid rgba(59,130,246,0.4);">
            توجيه ذكي تلقائي لكل المدرسين
          </span>
        </div>

        <p style="font-size: 0.85rem; color: #94a3b8; margin: 0 0 1rem 0; line-height: 1.5;">
          امسح باركود الطالب هنا عند وصوله للسنتر؛ سيتعرف النظام تلقائياً على مجموعة الطالب، ومدرس المادة، والقاعة الجارية، ويسجل حضوره فوراً.
        </p>

        <form id="centerFrontDeskForm" onsubmit="window.centrlyApp.handleCenterFrontDeskScan(event)">
          <div style="display: flex; gap: 0.75rem; max-width: 650px;">
            <input 
              type="text" 
              id="centerBarcodeScanInput" 
              class="form-input" 
              placeholder="امسح باركود الطالب أو اكتب الكود / الاسم..." 
              style="font-size: 1.05rem; padding: 0.75rem 1rem; background: #fff; color: #000; font-weight: 700; border-radius: 8px;"
              autofocus 
              autocomplete="off"
            >
            <button type="submit" class="btn" style="background: #2563eb; color: #fff; font-weight: 800; padding: 0 1.5rem; border-radius: 8px; white-space: nowrap; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('check', 18, '#ffffff')}
              <span>تسجيل فوري</span>
            </button>
            <button type="button" onclick="window.centrlyApp.openCameraScannerModal('center')" class="btn btn-secondary" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 800; background: #1e293b; color: #38bdf8; border: 1px solid #334155; white-space: nowrap; padding: 0 1.25rem; border-radius: 8px;">
              ${getIcon('camera', 18, '#38bdf8')}
              <span>كاميرا الاستقبال</span>
            </button>
          </div>
        </form>

        <!-- Dynamic Scan Feedback Banner -->
        ${scanResult ? `
          <div style="margin-top: 1.25rem; padding: 1rem 1.25rem; border-radius: 8px; background: ${scanResult.success ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)'}; border: 1px solid ${scanResult.success ? '#10b981' : '#ef4444'}; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.75rem;">
              <span style="color: ${scanResult.success ? '#10b981' : '#ef4444'};">${getIcon(scanResult.success ? 'check' : 'close', 28)}</span>
              <div>
                <div style="font-weight: 800; font-size: 1.05rem; color: ${scanResult.success ? '#6ee7b7' : '#fca5a5'};">
                  ${escapeHtml(scanResult.message || (scanResult.success ? 'تم رصد الحضور بنجاح' : 'تعذر التعرف على الطالب'))}
                </div>
                ${scanResult.student ? `
                  <div style="font-size: 0.825rem; color: #e2e8f0; margin-top: 0.2rem;">
                    الطالب: <b>${escapeHtml(scanResult.student.name)}</b> • كود: ${escapeHtml(scanResult.student.student_code || scanResult.student.code || '—')}
                  </div>
                ` : ''}
              </div>
            </div>
            ${scanResult.session ? `
              <div style="background: rgba(255,255,255,0.1); padding: 0.4rem 0.85rem; border-radius: 6px; text-align: left;">
                <div style="font-size: 0.75rem; color: #93c5fd;">القاعة: <b>${escapeHtml(scanResult.session.room_name || 'قاعة السنتر')}</b></div>
                <div style="font-size: 0.75rem; color: #fde047;">المدرس: <b>${escapeHtml(scanResult.session.teacher_name || 'المعلم')}</b></div>
              </div>
            ` : ''}
          </div>
        ` : ''}

      </div>

      <!-- Active Running Sessions Grid (Multiple Sessions at Once) -->
      <div>
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
            <span>${getIcon('activity', 20, 'var(--centrly-success)')}</span>
            <span>الحصص الجارية الآن في السنتر (${activeSessions.length} حصص نشطة)</span>
          </h3>
          <span style="font-size: 0.8rem; color: var(--centrly-text);">
            تعمل بالتوازي في قاعات مختلفة
          </span>
        </div>

        ${activeSessions.length > 0 ? `
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem;">
            ${activeSessions.map(s => {
              const presentCount = s.present_count || (s.attendees ? s.attendees.length : 0);
              const totalStudents = s.total_students || 15;
              const teacherName = s.teacher_name || s.teachers?.name || 'مدرس المادة';
              const roomName = s.room_name || s.rooms?.name || 'القاعة الرئيسية';

              return `
                <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-success); background: #fff;">
                  <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                    <div>
                      <div style="font-weight: 800; font-size: 1.05rem; color: var(--centrly-ink);">${escapeHtml(s.group_name || s.name || 'حصة دراسية')}</div>
                      <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.2rem;">
                        المادة: <b>${escapeHtml(s.subject || 'عامة')}</b> • حصة رقم ${escapeHtml(s.session_number || 1)}
                      </div>
                    </div>
                    <span class="badge badge-success" style="display: inline-flex; align-items: center; gap: 0.25rem;">
                      ${getIcon('dotSuccess', 8)}
                      <span>جارية الآن</span>
                    </span>
                  </div>

                  <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem; background: #f8fafc; padding: 0.75rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.825rem;">
                    <div>
                      <span style="color: var(--centrly-text);">المعلم:</span>
                      <div style="font-weight: 700; color: var(--centrly-blue-800);">${escapeHtml(teacherName)}</div>
                    </div>
                    <div>
                      <span style="color: var(--centrly-text);">القاعة:</span>
                      <div style="font-weight: 700; color: var(--centrly-ink);">${escapeHtml(roomName)}</div>
                    </div>
                    <div style="grid-column: span 2; margin-top: 0.25rem; display: flex; justify-content: space-between; align-items: center; border-top: 1px solid var(--centrly-line); padding-top: 0.4rem;">
                      <span style="color: var(--centrly-text);">حضور الطلاب:</span>
                      <span style="font-weight: 800; color: var(--centrly-success); font-size: 0.95rem;">${presentCount} طالب حاضر</span>
                    </div>
                  </div>

                  <div style="display: flex; gap: 0.5rem;">
                    <button class="btn btn-secondary btn-sm" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.3rem;" onclick="window.centrlyApp.viewCenterSessionDetails('${escapeHtml(s.id)}')">
                      ${getIcon('eye', 14)}
                      <span>الكشف والغياب</span>
                    </button>
                    <button class="btn btn-secondary btn-sm" style="color: var(--centrly-danger); border-color: var(--centrly-danger); display: flex; align-items: center; justify-content: center; gap: 0.3rem;" onclick="window.centrlyApp.promptCenterEndSession('${escapeHtml(s.id)}')">
                      ${getIcon('close', 14)}
                      <span>إنهاء الحصة</span>
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        ` : `
          <div class="card" style="margin: 0; text-align: center; padding: 2.5rem 1rem;">
            <div style="color: var(--centrly-text); margin-bottom: 0.5rem;">${getIcon('sessions', 40)}</div>
            <div style="font-weight: 700; color: var(--centrly-ink); font-size: 1rem;">لا توجد حصص قيد التشغيل حالياً</div>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              يمكنك تشغيل إحدى الحصص القادمة أدناه أو بدء حصة جديدة لأي مدرس في قاعة محددة.
            </p>
          </div>
        `}
      </div>

      <!-- Upcoming Scheduled Sessions Table (Ordered by Date & Time) -->
      <div class="card" style="margin: 0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('calendar', 18, 'var(--centrly-blue-700)')}
            <span>الحصص القادمة في السنتر (مرتبة زمنياً)</span>
          </h3>
          <span style="font-size: 0.78rem; color: var(--centrly-text);">
            مرتبة حسب موعد البدء المحدد
          </span>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>المجموعة</th>
                <th>المدرس</th>
                <th>القاعة</th>
                <th>التاريخ</th>
                <th>الوقت</th>
                <th>سعر الحصة</th>
                <th>الإجراء</th>
              </tr>
            </thead>
            <tbody>
              ${upcomingSessions.length > 0 ? upcomingSessions.map(s => {
                const teacher = teachers.find(t => t.id === s.teacher_id) || { name: s.teacher_name || 'مدرس المادة' };
                const room = rooms.find(r => r.id === s.room_id) || { name: s.room_name || 'القاعة الرئيسية' };

                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--centrly-ink);">${escapeHtml(s.name || s.group_name)}</td>
                    <td style="font-weight: 600; color: var(--centrly-blue-800);">${escapeHtml(teacher.name)}</td>
                    <td><span class="badge badge-blue">${escapeHtml(room.name)}</span></td>
                    <td style="font-family: monospace; font-size: 0.85rem;">${escapeHtml(s.session_date || 'اليوم')}</td>
                    <td style="font-family: monospace; font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink);">${escapeHtml(s.session_time || s.schedule_time || '—')}</td>
                    <td style="font-family: monospace; font-weight: 700;">${escapeHtml(s.price || 100)} ج.م</td>
                    <td>
                      <button 
                        class="btn btn-primary btn-sm" 
                        onclick="window.centrlyApp.startCenterSession('${escapeHtml(s.id || s.group_id)}', '${escapeHtml(s.room_id || '')}')"
                        style="display: inline-flex; align-items: center; gap: 0.3rem; font-weight: 700;"
                      >
                        ${getIcon('sessions', 14)}
                        <span>بدء الحصة الآن</span>
                      </button>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا توجد حصص مجدولة لاحقاً. يمكنك إضافة مجاميع جديدة من صفحة المجاميع والقاعات.
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
