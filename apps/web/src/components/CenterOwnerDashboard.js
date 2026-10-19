import { request } from "../services/api.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Center Owner Dashboard (DEV-79)
 * Operational Screen for Center Owners:
 * - Per-Teacher Financial Rollup & Payout Status Toggle
 * - Room Occupancy & Conflict Engine View
 * - Front-Desk Smart Gate Scanner
 * - Teacher & Assistant Onboarding
 */

export function renderCenterOwnerDashboard(state = {}) {
  const activeTab = state.activeTab || 'teachers';
  const period = state.period || '2026-09';

  const rollup = state.rollup || {
    period,
    totals: {
      total_revenue: 0,
      total_teacher_cut: 0,
      total_center_cut: 0,
      paid_teachers_count: 0,
      unpaid_teachers_count: 0,
    },
    reports: [],
  };

  const rooms = state.rooms || [];

  const conflictCheckResult = state.conflictCheckResult || null;
  const frontDeskScanResult = state.frontDeskScanResult || null;
  const generatedInvite = state.generatedInvite || null;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title & Period Switcher -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: var(--centrly-white); padding: 1.25rem 1.5rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--centrly-line);">
        <div>
          <h1 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.5rem;">
            <span>${getIcon('center', 24, 'var(--centrly-blue-700)')}</span>
            <span>لوحة إدارة السنتر والقاعات</span>
          </h1>
          <p style="margin: 0.25rem 0 0 0; font-size: 0.85rem; color: var(--centrly-text);">
            متابعة إيرادات المدرسين، إدارة القاعات، ومنع التعارضات، وبوابة الاستقبال الذكية
          </p>
        </div>

        <div style="display: flex; align-items: center; gap: 0.75rem;">
          <label style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink);">الشهر المالي:</label>
          <input 
            type="month" 
            value="${period}" 
            class="form-input" 
            style="padding: 0.35rem 0.75rem; font-size: 0.9rem;"
            onchange="window.centrlyApp.changeCenterPeriod(this.value)"
          >
        </div>
      </div>

      <!-- Financial Rollup KPI Cards -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
        
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي دخل السنتر</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${rollup.totals.total_revenue.toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-weight: 500;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            شامل حصص كافة المدرسين
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">مستحقات المدرسين</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-amber-700); margin-top: 0.35rem;">
            ${rollup.totals.total_teacher_cut.toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-weight: 500;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            ${rollup.totals.paid_teachers_count} تم صرفهم / ${rollup.totals.unpaid_teachers_count} معلقين
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">صافي ربح السنتر</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
            ${rollup.totals.total_center_cut.toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-weight: 500;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            عائد إدارة القاعات والسنتر
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-info);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">القاعات المجهزة</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${rooms.length} <span style="font-size: 0.85rem; font-weight: 500;">قاعات</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            إجمالي سعة استيعابية: ${rooms.reduce((acc, r) => acc + r.capacity, 0)} طالب
          </div>
        </div>

      </div>

      <!-- Navigation Tabs -->
      <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--centrly-line); padding-bottom: 0.5rem; overflow-x: auto;">
        <button 
          class="btn ${activeTab === 'teachers' ? 'btn-primary' : 'btn-secondary'}" 
          onclick="window.centrlyApp.switchCenterTab('teachers')"
          style="display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
        >
          <span>${getIcon('students', 16)}</span>
          <span>المدرسين والمستحقات المالية</span>
        </button>

        <button 
          class="btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}" 
          onclick="window.centrlyApp.switchCenterTab('rooms')"
          style="display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
        >
          <span>${getIcon('center', 16)}</span>
          <span>إشغال القاعات وتضارب الحصص</span>
        </button>

        <button 
          class="btn ${activeTab === 'front_desk' ? 'btn-primary' : 'btn-secondary'}" 
          onclick="window.centrlyApp.switchCenterTab('front_desk')"
          style="display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
        >
          <span>${getIcon('sessions', 16)}</span>
          <span>بوابة الاستقبال الذكية (Smart Gate)</span>
        </button>

        <button 
          class="btn ${activeTab === 'onboarding' ? 'btn-primary' : 'btn-secondary'}" 
          onclick="window.centrlyApp.switchCenterTab('onboarding')"
          style="display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
        >
          <span>${getIcon('add', 16)}</span>
          <span>إضافة مدرس / مساعد</span>
        </button>
      </div>

      <!-- TAB 1: Teachers & Financial Rollup -->
      ${activeTab === 'teachers' ? `
        <div class="card" style="margin: 0; background: #fff;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
            <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0;">
              قائمة المدرسين ومستحقات الصرف لـ (${period})
            </h2>
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.switchCenterTab('onboarding')">
              + إضافة مدرس جديد
            </button>
          </div>

          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; text-align: right; border-collapse: collapse;">
              <thead>
                <tr style="border-bottom: 2px solid var(--centrly-line); background: var(--centrly-surface);">
                  <th style="padding: 0.75rem;">اسم المدرس</th>
                  <th style="padding: 0.75rem;">المادة</th>
                  <th style="padding: 0.75rem;">نظام المحاسبة</th>
                  <th style="padding: 0.75rem;">إجمالي الدخل</th>
                  <th style="padding: 0.75rem;">نصيب المدرس</th>
                  <th style="padding: 0.75rem;">نصيب السنتر</th>
                  <th style="padding: 0.75rem;">حالة الصرف</th>
                  <th style="padding: 0.75rem;">الإجراءات</th>
                </tr>
              </thead>
              <tbody>
                ${rollup.reports.length > 0 ? rollup.reports.map((r) => {
                  const modelLabel =
                    r.teacher.revenue_model === 'percentage'
                      ? `نسبة (${r.teacher.revenue_value}%)`
                      : r.teacher.revenue_model === 'fixed_per_student'
                      ? `${r.teacher.revenue_value} ج.م / طالب`
                      : `مبلغ مقطوع (${r.teacher.revenue_value} ج.م)`;

                  const isPaid = r.payout.status === 'paid';

                  return `
                    <tr style="border-bottom: 1px solid var(--centrly-line);">
                      <td style="padding: 0.75rem; font-weight: 700; color: var(--centrly-ink);">
                        ${escapeHtml(r.teacher.name)}
                        <div style="font-size: 0.75rem; font-weight: normal; color: var(--centrly-text);">${escapeHtml(r.teacher.phone)}</div>
                      </td>
                      <td style="padding: 0.75rem; color: var(--centrly-text);">${(r.teacher.subjects || []).map(s => escapeHtml(s)).join(', ')}</td>
                      <td style="padding: 0.75rem;">
                        <span class="badge" style="background: var(--centrly-blue-100); color: var(--centrly-blue-900); font-weight: 600;">
                          ${modelLabel}
                        </span>
                      </td>
                      <td style="padding: 0.75rem; font-weight: 700;">${r.summary.total_revenue.toLocaleString('ar-EG')} ج.م</td>
                      <td style="padding: 0.75rem; font-weight: 700; color: var(--centrly-blue-800);">${r.summary.teacher_cut.toLocaleString('ar-EG')} ج.م</td>
                      <td style="padding: 0.75rem; font-weight: 700; color: var(--centrly-success);">${r.summary.center_cut.toLocaleString('ar-EG')} ج.م</td>
                      <td style="padding: 0.75rem;">
                        ${isPaid
                          ? `<span class="badge badge-success" style="background: var(--centrly-success-light); color: var(--centrly-success); font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('dotSuccess', 8)} <span>مدفوع</span></span>`
                          : `<span class="badge badge-danger" style="background: var(--centrly-amber-100); color: var(--centrly-amber-700); font-weight: 700; display: inline-flex; align-items: center; gap: 0.3rem;">${getIcon('dotWarning', 8)} <span>معلق</span></span>`
                        }
                      </td>
                      <td style="padding: 0.75rem;">
                        <button 
                          class="btn btn-sm ${isPaid ? 'btn-secondary' : 'btn-primary'}" 
                          onclick="window.centrlyApp.toggleTeacherPayout('${escapeHtml(r.teacher.id)}', '${period}', '${r.payout.status}')"
                          style="font-size: 0.8rem; padding: 0.3rem 0.6rem;"
                        >
                          ${isPaid ? 'تحويل لغير مدفوع' : 'تسجيل الصرف'}
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('') : `
                  <tr>
                    <td colspan="8" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                      لا توجد بيانات تسويات مالية لهذا الشهر بعد.
                    </td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>
        </div>
      ` : ''}

      <!-- TAB 2: Room Occupancy & Conflict Engine -->
      ${activeTab === 'rooms' ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
          
          <!-- Rooms List -->
          <div class="card" style="margin: 0; background: #fff;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('center', 18, 'var(--centrly-blue-700)')}
                <span>قاعات السنتر والسعة الاستيعابية</span>
              </h2>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${rooms.length > 0 ? rooms.map((room) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--centrly-line); background: var(--centrly-surface);">
                  <div>
                    <div style="font-weight: 700; color: var(--centrly-ink);">${escapeHtml(room.name)}</div>
                    <div style="font-size: 0.8rem; color: var(--centrly-text);">${escapeHtml(room.location || 'داخل السنتر')}</div>
                  </div>
                  <div style="text-align: left;">
                    <span class="badge" style="background: var(--centrly-blue-100); color: var(--centrly-blue-900); font-weight: 700;">
                      سعة ${escapeHtml(room.capacity)} طالب
                    </span>
                  </div>
                </div>
              `).join('') : `
                <div style="text-align: center; padding: 2rem; color: var(--centrly-text); border: 1px dashed var(--centrly-line); border-radius: var(--radius-sm);">
                  لا توجد قاعات مضافة حتى الآن. أضف قاعة جديدة من النموذج أدناه.
                </div>
              `}
            </div>

            <!-- Add Room Form -->
            <form onsubmit="window.centrlyApp.handleAddRoomSubmit(event)" style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
              <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--centrly-ink);">+ إضافة قاعة جديدة للسنتر</div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <input type="text" id="newRoomName" placeholder="اسم القاعة" class="form-input" style="flex: 2;" required>
                <input type="number" id="newRoomCapacity" placeholder="السعة الاستيعابية" class="form-input" style="flex: 1;" min="1" required>
                <button type="submit" class="btn btn-primary" style="flex: 1;">إضافة</button>
              </div>
            </form>
          </div>

          <!-- Conflict Engine Test / Booking Inspector -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-500);">
            <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0 0 0.5rem 0; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('clock', 18, 'var(--centrly-amber-500)')}
              <span>محرك فحص تضارب الحصص (Booking Conflict Engine)</span>
            </h2>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1rem 0;">
              اختر القاعة والتوقيت المطلوب للتأكد من خلو القاعة وعدم تعارضها مع أي مدرس آخر قبل اعتماد الحصة.
            </p>

            <form onsubmit="window.centrlyApp.handleRoomConflictCheck(event)" style="display: flex; flex-direction: column; gap: 0.85rem;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">القاعة المراد حجزها:</label>
                <select id="conflictRoomSelect" class="form-input" style="width: 100%;" required>
                  ${rooms.length > 0 ? rooms.map((r) => `<option value="${r.id}">${r.name} (سعة ${r.capacity} طالب)</option>`).join('') : '<option value="">-- لا توجد قاعات مضافة --</option>'}
                </select>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem;">
                <div>
                  <label style="font-size: 0.8rem; font-weight: 700;">تاريخ الحصة:</label>
                  <input type="date" id="conflictDate" class="form-input" value="2026-09-10" required>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 700;">من الساعة:</label>
                  <input type="time" id="conflictStartTime" class="form-input" value="14:00" required>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 700;">إلى الساعة:</label>
                  <input type="time" id="conflictEndTime" class="form-input" value="16:00" required>
                </div>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">عدد طلاب المجموعة المتوقع (لفحص السعة):</label>
                <input type="number" id="conflictStudentCount" class="form-input" placeholder="عدد الطلاب المتوقع" min="1">
              </div>

              <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem;">
                ${getIcon('search', 16)}
                <span>فحص توفر القاعة ومنع التضارب</span>
              </button>
            </form>

            <!-- Conflict Result Box -->
            ${conflictCheckResult ? `
              <div style="margin-top: 1rem; padding: 1rem; border-radius: var(--radius-sm); border: 1px solid ${
                conflictCheckResult.has_conflict ? 'var(--centrly-danger)' : 'var(--centrly-success)'
              }; background: ${
                conflictCheckResult.has_conflict ? 'var(--centrly-danger-light)' : 'var(--centrly-success-light)'
              };">
                <div style="font-weight: 800; font-size: 0.95rem; color: ${
                  conflictCheckResult.has_conflict ? 'var(--centrly-danger)' : 'var(--centrly-success)'
                }; display: flex; align-items: center; gap: 0.35rem;">
                  ${conflictCheckResult.has_conflict
                    ? `${getIcon('close', 16, 'var(--centrly-danger)')} تنبيه تعارض: القاعة محجوزة بالفعل في هذا التوقيت!`
                    : `${getIcon('check', 16, 'var(--centrly-success)')} القاعة شاغرة ومتاحة للحجز في هذا التوقيت`}
                </div>
                ${conflictCheckResult.conflicting_booking ? `
                  <div style="font-size: 0.85rem; color: var(--centrly-ink); margin-top: 0.4rem;">
                    الحصة المتعارضة: <strong>${conflictCheckResult.conflicting_booking.group_name || 'حصة'}</strong> 
                    للمدرس <strong>${conflictCheckResult.conflicting_booking.teacher_name || 'مدرس'}</strong> 
                    (من ${conflictCheckResult.conflicting_booking.start_time} إلى ${conflictCheckResult.conflicting_booking.end_time})
                  </div>
                ` : ''}
                ${conflictCheckResult.warning ? `
                  <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--centrly-warning); font-weight: 700; display: flex; align-items: center; gap: 0.3rem;">
                    ${getIcon('risk', 14, 'var(--centrly-warning)')}
                    <span>${conflictCheckResult.warning.message}</span>
                  </div>
                ` : ''}
              </div>
            ` : ''}

          </div>

        </div>
      ` : ''}

      <!-- TAB 3: Front-Desk Smart Gate -->
      ${activeTab === 'front_desk' ? `
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <div>
              <h2 style="font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink); margin: 0; display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('sessions', 18, 'var(--centrly-blue-700)')}
                <span>بوابة الاستقبال الذكية (Smart Gate Mode)</span>
              </h2>
              <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0.25rem 0 0 0;">
                مسح باركود الطالب في مدخل السنتر يقوم بتوجيهه فوراً إلى حصته النشطة وتسجيل حضوره آلياً مع التنبيه الصوتي
              </p>
            </div>
            <span class="badge badge-success" style="background: var(--centrly-success-light); color: var(--centrly-success); font-weight: 700;">
              ● متصل وجاهز للمسح
            </span>
          </div>

          <form onsubmit="window.centrlyApp.handleFrontDeskScanSubmit(event)" style="display: flex; gap: 0.75rem; margin: 1.5rem 0;">
            <input 
              type="text" 
              id="frontDeskBarcodeInput" 
              placeholder="مرر الباركود أو اكتب الكود هنا..." 
              class="form-input" 
              style="flex: 1; font-size: 1.1rem; padding: 0.75rem 1rem; font-weight: 700;"
              autofocus
              required
            >
            <button type="submit" class="btn btn-primary" style="padding: 0.75rem 1.5rem; font-size: 1rem; font-weight: 700;">
              تسجيل الحضور
            </button>
          </form>

          <!-- Result Panel -->
          ${frontDeskScanResult ? `
            <div style="padding: 1.25rem; border-radius: var(--radius-md); border: 2px solid ${
              frontDeskScanResult.success
                ? 'var(--centrly-success)'
                : frontDeskScanResult.audio_alert === 'error'
                ? 'var(--centrly-danger)'
                : 'var(--centrly-warning)'
            }; background: ${
              frontDeskScanResult.success
                ? 'var(--centrly-success-light)'
                : frontDeskScanResult.audio_alert === 'error'
                ? 'var(--centrly-danger-light)'
                : 'var(--centrly-warning-light)'
            };">
              <div style="font-size: 1.2rem; font-weight: 900; color: ${
                frontDeskScanResult.success
                  ? 'var(--centrly-success)'
                  : frontDeskScanResult.audio_alert === 'error'
                  ? 'var(--centrly-danger)'
                  : 'var(--centrly-warning)'
              };">
                ${escapeHtml(frontDeskScanResult.message)}
              </div>

              ${frontDeskScanResult.session ? `
                <div style="display: flex; gap: 1rem; margin-top: 0.75rem; flex-wrap: wrap; font-size: 0.9rem;">
                  <div>المدرس: <strong>${escapeHtml(frontDeskScanResult.session.teacher_name || 'غير محدد')}</strong></div>
                  <div>المادة: <strong>${escapeHtml(frontDeskScanResult.session.subject || 'غير محدد')}</strong></div>
                  <div>القاعة: <strong>${escapeHtml(frontDeskScanResult.session.room_name || 'قاعة السنتر')}</strong></div>
                  <div>المجموعة: <strong>${escapeHtml(frontDeskScanResult.session.group_name || 'المجموعة')}</strong></div>
                  ${frontDeskScanResult.session.is_makeup ? `
                    <span class="badge" style="background: var(--centrly-amber-500); color: #fff; font-weight: 800;">
                      حصّة تعويض
                    </span>
                  ` : ''}
                </div>
              ` : ''}
            </div>
          ` : `
            <div style="padding: 2rem; text-align: center; border: 2px dashed var(--centrly-line); border-radius: var(--radius-md); color: var(--centrly-text);">
              في انتظار مسح باركود الطالب...
            </div>
          `}
        </div>
      ` : ''}

      <!-- TAB 4: Onboarding (Add Teacher / Assistant) -->
      ${activeTab === 'onboarding' ? `
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
          
          <!-- Add Teacher Form -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
            <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('students', 18, 'var(--centrly-blue-700)')}
              <span>إضافة مدرس جديد للسنتر</span>
            </h2>

            <form onsubmit="window.centrlyApp.handleAddTeacherSubmit(event)" style="display: flex; flex-direction: column; gap: 0.85rem;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">اسم المدرس:</label>
                <input type="text" id="obTeacherName" placeholder="اسم المدرس بالكامل" class="form-input" required>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">رقم الهاتف (الواتساب):</label>
                <input type="tel" id="obTeacherPhone" placeholder="رقم الهاتف" class="form-input" required>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">المواد الدراسية (مفصولة بفواصل):</label>
                <input type="text" id="obTeacherSubjects" placeholder="المواد الدراسية" class="form-input" value="فيزياء">
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.5rem;">
                <div>
                  <label style="font-size: 0.8rem; font-weight: 700;">نظام المحاسبة:</label>
                  <select id="obTeacherRevenueModel" class="form-input">
                    <option value="percentage">نسبة مئوية (%)</option>
                    <option value="fixed_per_student">مبلغ ثابت لكل طالب</option>
                    <option value="fixed_total">مبلغ مقطوع شهرياً</option>
                  </select>
                </div>
                <div>
                  <label style="font-size: 0.8rem; font-weight: 700;">القيمة:</label>
                  <input type="number" id="obTeacherRevenueValue" class="form-input" value="80" required>
                </div>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">طريقة الانضمام:</label>
                <select id="obTeacherMethod" class="form-input" onchange="document.getElementById('teacherDirectPassBox').style.display = this.value === 'direct_creation' ? 'block' : 'none'">
                  <option value="invite_link">رابط دعوة عبر الواتساب (موصى به)</option>
                  <option value="direct_creation">إنشاء مباشر مع كلمة مرور</option>
                </select>
              </div>

              <div id="teacherDirectPassBox" style="display: none;">
                <label style="font-size: 0.8rem; font-weight: 700;">البريد وكلمة المرور المؤقتة:</label>
                <input type="email" id="obTeacherEmail" placeholder="teacher@example.com" class="form-input" style="margin-bottom: 0.4rem;">
                <div style="position: relative;">
                  <input type="password" id="obTeacherPassword" placeholder="كلمة المرور (8 أحرف فأكثر)" class="form-input" style="padding-left: 2.5rem;">
                  <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('obTeacherPassword', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                    ${getIcon('eye', 18)}
                  </button>
                </div>
              </div>

              <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem;">
                تأكيد إضافة المدرس
              </button>
            </form>
          </div>

          <!-- Add Assistant Form -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
            <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0 0 1rem 0; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('students', 18, 'var(--centrly-amber-600)')}
              <span>إضافة مساعد جديد</span>
            </h2>

            <form onsubmit="window.centrlyApp.handleAddAssistantSubmit(event)" style="display: flex; flex-direction: column; gap: 0.85rem;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">اسم المساعد:</label>
                <input type="text" id="obAssistantName" placeholder="الاسم الكامل" class="form-input" required>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">رقم الهاتف:</label>
                <input type="tel" id="obAssistantPhone" placeholder="رقم الهاتف" class="form-input" required>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">نوع المساعد:</label>
                <select id="obAssistantType" class="form-input">
                  <option value="assistant_to_center">مساعد إدارة السنتر (شامل)</option>
                  <option value="assistant_to_teacher">مساعد خاص بمدرس</option>
                </select>
              </div>

              <div style="display: flex; align-items: center; gap: 0.5rem; margin: 0.25rem 0;">
                <input type="checkbox" id="obAssistantFinancials">
                <label for="obAssistantFinancials" style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink);">
                  السماح بالاطلاع على الحسابات والأرباح
                </label>
              </div>

              <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem;">
                تأكيد إضافة المساعد
              </button>
            </form>
          </div>

        </div>

        <!-- Generated Invite Link Box -->
        ${generatedInvite ? `
          <div class="card" style="margin-top: 1.5rem; background: var(--centrly-success-light); border: 2px solid var(--centrly-success);">
            <div style="font-weight: 800; font-size: 1.1rem; color: var(--centrly-success); display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('check', 16, 'var(--centrly-success)')}
              <span>تم إنشاء رابط الدعوة بنجاح لـ (${generatedInvite.name})!</span>
            </div>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0.35rem 0;">
              صالح لمدة 7 أيام للاستخدام مرة واحدة، يُتيح للمدرس تسجيل الدخول وتعيين كلمة مروره مباشرة.
            </p>
            <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem;">
              <input type="text" readonly value="${(typeof window !== 'undefined' ? window.location.origin : '')}${generatedInvite.invite_url}" class="form-input" style="flex: 1; direction: ltr; font-weight: 700;">
              <button class="btn btn-primary" onclick="window.centrlyApp.copyInviteUrl('${(typeof window !== 'undefined' ? window.location.origin : '')}${generatedInvite.invite_url}')">
                نسخ الرابط
              </button>
            </div>
          </div>
        ` : ''}

      ` : ''}

    </div>
  `;
}

export function registerCenterOwnerActions(app) {
  // DEV-79: Center Owner Dashboard Actions
  // ==========================================================================

  app.switchCenterTab = function(tab) {
    this.centerDashboardState.activeTab = tab;
    this.renderMainContent();
  }

  app.changeCenterPeriod = async function(period) {
    this.centerDashboardState.period = period;
    this.renderMainContent();
    await this.loadRouteData('center-dashboard');
  }

  app.toggleTeacherPayout = async function(teacherId, arg2, arg3, arg4) {
    let period = this.centerDashboardState.period || new Date().toISOString().slice(0, 7);
    let markPaid = true;
    let teacherName = 'المعلم';
    let amount = 0;

    if (typeof arg4 === 'boolean') {
      teacherName = arg2;
      amount = arg3;
      markPaid = arg4;
    } else {
      period = arg2;
      markPaid = arg3 !== 'paid';
    }

    const nextStatus = markPaid ? 'paid' : 'unpaid';
    const actionText = markPaid ? 'تسجيل صرف مستحقات' : 'إلغاء تأكيد صرف مستحقات';

    this.showConfirmModal({
      title: `${actionText} (${teacherName})`,
      message: `هل أنت متأكد من ${actionText} لشهر (${period})؟`,
      confirmText: markPaid ? 'تأكيد الصرف' : 'إلغاء الصرف',
      cancelText: 'إلغاء',
      isDanger: !markPaid,
      onConfirm: async () => {
        try {
          await request('/centers/financials/payouts', {
            method: 'POST',
            body: {
              teacher_id: teacherId,
              period,
              status: nextStatus,
              is_paid: markPaid,
              amount: Number(amount) || undefined,
              notes: markPaid ? 'تم الصرف من لوحة الإدارة' : null,
            },
          });

          if (this.centerDashboardState.rollup) {
            const rep = this.centerDashboardState.rollup.reports.find(r => r.teacher.id === teacherId);
            if (rep && rep.payout) {
              rep.payout.status = nextStatus;
              rep.payout.is_paid = markPaid;
              if (markPaid) {
                rep.payout.paid_at = new Date().toISOString();
              } else {
                rep.payout.paid_at = null;
              }
            }
          }
          this.showToast(`تم ${actionText} بنجاح!`, 'success');
          this.renderMainContent();
        } catch (err) {
          this.showToast(`فشل تحديث حالة الصرف: ${err.message || 'حدث خطأ'}`, 'danger');
        }
      },
    });
  }

  // ==========================================================================
  // Center Multi-Sessions & Dedicated Pages (Teachers, Assistants, Rooms)
  // ==========================================================================

  app.handleCenterFrontDeskScan = async function(e) {
    e.preventDefault();
    const input = document.getElementById('centerBarcodeScanInput');
    const barcode = input?.value.trim();
    if (!barcode) return;

    try {
      const res = await request('/centers/front-desk/scan', {
        method: 'POST',
        body: { barcode },
      });

      this.centerSessionsState.scanResult = res;
      if (res.success) {
        this.playScanBeep('success');
        this.showToast(res.message || 'تم رصد الحضور والتوجيه بنجاح!', 'success');
        await this.loadRouteData('center-sessions');
      } else {
        this.playScanBeep('error');
        this.showToast(res.message || 'تعذر التعرف على الطالب', 'warning');
      }
      if (input) input.value = '';
      this.renderMainContent();
    } catch (err) {
      this.playScanBeep('error');
      this.centerSessionsState.scanResult = {
        success: false,
        message: err.message || 'خطأ في عملية المسح',
      };
      this.showToast(`خطأ في المسح: ${err.message || 'تعذر الاتصال'}`, 'danger');
      this.renderMainContent();
    }
  }

  app.openCenterStartSessionModal = function() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)} (مستر ${escapeHtml(g.teacher_name || 'المعلم')})</option>`).join('');
    const roomOptions = (this.centerRooms || []).map(r => `<option value="${r.id}">${escapeHtml(r.name)} (سعة ${r.capacity} طالب)</option>`).join('');

    const bodyHtml = `
      <form id="centerStartSessionForm" onsubmit="window.centrlyApp.handleCenterStartSessionSubmit(event)">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">المجموعة الدراسية والمعلم *</label>
          <select id="centerModalGroupSelect" class="form-select" required>
            ${groupOptions || '<option value="">لا توجد مجاميع</option>'}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">القاعة المخصصة (اختياري)</label>
          <select id="centerModalRoomSelect" class="form-select">
            <option value="">بدون قاعة محددة (اختياري)</option>
            ${roomOptions || ''}
          </select>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 700;">تشغيل الحصة الآن</button>
        </div>
      </form>
    `;

    this.showModal('تشغيل حصة جديدة في قاعة بالسنتر', bodyHtml);
  }

  app.handleCenterStartSessionSubmit = async function(e) {
    e.preventDefault();
    const groupId = document.getElementById('centerModalGroupSelect')?.value;
    const roomId = document.getElementById('centerModalRoomSelect')?.value;
    if (!groupId) return;

    this.closeModal();
    await this.startCenterSession(groupId, roomId);
  }

  app.startCenterSession = async function(groupId, roomId) {
    const grp = (this.groups || []).find(g => g.id === groupId);
    const room = (this.centerRooms || []).find(r => r.id === roomId);
    const teacher = (this.centerTeachers || []).find(t => t.id === grp?.teacher_id);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await request('/sessions', {
        method: 'POST',
        body: {
          group_id: groupId,
          session_number: 1,
          session_date: todayStr,
          room_id: roomId || null,
        },
      }).catch(() => null);

      const newSess = {
        id: res?.session?.id || `sess-${Date.now()}`,
        group_id: groupId,
        group_name: grp?.name || 'حصة جديدة',
        subject: grp?.subject || 'عامة',
        teacher_name: teacher?.name || grp?.teacher_name || 'المعلم',
        room_name: room?.name || 'القاعة الرئيسية',
        present_count: 0,
        session_number: res?.session?.session_number || 1,
      };

      if (!this.centerSessionsState.activeSessions) this.centerSessionsState.activeSessions = [];
      this.centerSessionsState.activeSessions.unshift(newSess);
      this.showToast(`تم بدء تشغيل الحصة بنجاح في (${newSess.room_name})!`, 'success');
      this.renderMainContent();
    } catch (err) {
      this.showToast(`تعذر تشغيل الحصة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  app.promptCenterEndSession = function(sessionId) {
    this.showConfirmModal({
      title: 'تأكيد إنهاء الحصة',
      message: 'هل أنت متأكد من إنهاء هذه الحصة وإخلاء القاعة بالسنتر؟',
      confirmText: 'إنهاء الحصة',
      cancelText: 'إلغاء',
      isDanger: true,
      onConfirm: async () => {
        try {
          await request(`/sessions/${sessionId}/end`, { method: 'POST' }).catch(() => {});
          this.centerSessionsState.activeSessions = (this.centerSessionsState.activeSessions || []).filter(s => s.id !== sessionId);
          this.showToast('تم إنهاء الحصة بنجاح وإخلاء القاعة.', 'success');
          this.renderMainContent();
        } catch (err) {
          this.showToast(`فشل إنهاء الحصة: ${err.message || 'حدث خطأ'}`, 'danger');
        }
      },
    });
  }

  app.viewCenterSessionDetails = function(sessionId) {
    this.showToast(`كود الحصة: ${sessionId.slice(0, 8)}`, 'info');
  }

  app.viewTeacherGroups = function(teacherId) {
    this.navigate('groups');
  }

  app.openAddTeacherModal = function() {
    this.openAddTeacherModalDirect();
  }

  app.openAddAssistantModal = function() {
    this.openAddAssistantModalDirect();
  }

  app.openAddRoomModal = function() {
    this.openAddRoomModalDirect();
  }

  app.openAddTeacherModalDirect = function() {
    const bodyHtml = `
      <form id="modalAddTeacherForm" onsubmit="window.centrlyApp.handleModalAddTeacherSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">اسم المعلم بالكامل *</label>
          <input type="text" id="modalTeacherName" class="form-input" placeholder="اسم المعلم بالكامل" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">رقم الهاتف *</label>
          <input type="tel" id="modalTeacherPhone" class="form-input" placeholder="010..." dir="ltr" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">المادة الدراسية</label>
          <input type="text" id="modalTeacherSubject" class="form-input" placeholder="المادة الدراسية">
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">نظام المحاسبة الافتراضي</label>
          <select id="modalTeacherRevenueModel" class="form-select">
            <option value="percentage">نسبة سنتر (مئوية %)</option>
            <option value="fixed_per_student">أجر ثابت لكل طالب (ج.م)</option>
            <option value="fixed_rent">إيجار قاعة ثابت لكل حصة (ج.م)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">القيمة (النسبة % أو المبلغ ج.م)</label>
          <input type="number" id="modalTeacherRevenueValue" class="form-input" value="20" min="0">
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 700;">إضافة المعلم الآن</button>
        </div>
      </form>
    `;
    this.showModal('إضافة معلم جديد في السنتر', bodyHtml);
  }

  app.handleModalAddTeacherSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('modalTeacherName')?.value.trim();
    const phone = document.getElementById('modalTeacherPhone')?.value.trim();
    const subject = document.getElementById('modalTeacherSubject')?.value.trim();
    const revenue_model = document.getElementById('modalTeacherRevenueModel')?.value;
    const revenue_value = parseFloat(document.getElementById('modalTeacherRevenueValue')?.value) || 0;

    if (!name || !phone) {
      this.showToast('يرجى إدخال اسم المعلم ورقم هاتفه', 'error');
      return;
    }

    try {
      await request('/centers/teachers', {
        method: 'POST',
        body: {
          name,
          phone,
          subjects: subject ? [subject] : ['عام'],
          revenue_model,
          revenue_value,
          onboarding_method: 'invite_link',
        },
      });
      this.closeModal();
      this.showToast(`تمت إضافة المعلم (${name}) بنجاح!`, 'success');
      await this.loadRouteData('center-teachers');
    } catch (err) {
      this.showToast(`فشل إضافة المعلم: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  app.openAddAssistantModalDirect = function() {
    const teacherOptions = (this.centerTeachers || []).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddAssistantForm" onsubmit="window.centrlyApp.handleModalAddAssistantSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">اسم المساعد بالكامل *</label>
          <input type="text" id="modalAssistantName" class="form-input" placeholder="اسم المساعد" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">رقم الهاتف *</label>
          <input type="tel" id="modalAssistantPhone" class="form-input" placeholder="011..." dir="ltr" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">التبعية (سنتر أم معلم معين) *</label>
          <select id="modalAssistantType" class="form-select" onchange="document.getElementById('modalAssistantTeacherGroup').style.display = (this.value === 'assistant_to_teacher' ? 'block' : 'none')">
            <option value="assistant_to_center">مساعد تابع لإدارة السنتر</option>
            <option value="assistant_to_teacher">مساعد خاص بمعلم محدد</option>
          </select>
        </div>
        <div id="modalAssistantTeacherGroup" class="form-group" style="margin-bottom: 0.75rem; display: none;">
          <label class="form-label">المعلم التابع له</label>
          <select id="modalAssistantTeacherId" class="form-select">
            <option value="">اختر المعلم...</option>
            ${teacherOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">المرتب الشهري / الأجر (ج.م)</label>
          <input type="number" id="modalAssistantSalary" class="form-input" placeholder="المرتب الشهري (ج.م)" min="0" value="0">
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
            <input type="checkbox" id="modalAssistantFinancials">
            <span>منح صلاحية الاطلاع على تقارير الخزينة والمالية</span>
          </label>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 700;">إضافة المساعد الآن</button>
        </div>
      </form>
    `;
    this.showModal('إضافة مساعد جديد في السنتر', bodyHtml);
  }

  app.handleModalAddAssistantSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('modalAssistantName')?.value.trim();
    const phone = document.getElementById('modalAssistantPhone')?.value.trim();
    const assistant_type = document.getElementById('modalAssistantType')?.value;
    const teacher_id = document.getElementById('modalAssistantTeacherId')?.value || undefined;
    const salary = parseFloat(document.getElementById('modalAssistantSalary')?.value) || 0;
    const can_view_financials = document.getElementById('modalAssistantFinancials')?.checked ?? false;

    if (!name || !phone) {
      this.showToast('يرجى إدخال اسم المساعد ورقم الهاتف', 'error');
      return;
    }

    try {
      await request('/centers/assistants', {
        method: 'POST',
        body: {
          name,
          phone,
          assistant_type,
          teacher_id: assistant_type === 'assistant_to_teacher' ? teacher_id : undefined,
          salary,
          can_view_financials,
        },
      });
      this.closeModal();
      this.showToast(`تمت إضافة المساعد (${name}) بنجاح!`, 'success');
      await this.loadRouteData('center-assistants');
    } catch (err) {
      this.showToast(`فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  app.openAddRoomModalDirect = function() {
    const bodyHtml = `
      <form id="modalAddRoomForm" onsubmit="window.centrlyApp.handleModalAddRoomSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">اسم القاعة *</label>
          <input type="text" id="modalRoomName" class="form-input" placeholder="اسم القاعة" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">السعة الاستيعابية القصوى (عدد الطلاب) *</label>
          <input type="number" id="modalRoomCapacity" class="form-input" placeholder="السعة الاستيعابية" min="1" required>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 700;">إضافة القاعة الآن</button>
        </div>
      </form>
    `;
    this.showModal('إضافة قاعة جديدة في السنتر', bodyHtml);
  }

  app.handleModalAddRoomSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('modalRoomName')?.value.trim();
    const capacity = parseInt(document.getElementById('modalRoomCapacity')?.value, 10);

    if (!name || !capacity) {
      this.showToast('يرجى ملء اسم القاعة وسعتها', 'error');
      return;
    }

    try {
      await request('/centers/rooms', {
        method: 'POST',
        body: { name, capacity, hourly_rate: 0 },
      });
      this.closeModal();
      this.showToast(`تمت إضافة القاعة (${name}) بنجاح!`, 'success');
      await this.loadRouteData('center-rooms');
    } catch (err) {
      this.showToast(`فشل إضافة القاعة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  // ==========================================================================
  app.handleAddRoomSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('newRoomName')?.value.trim();
    const capacity = parseInt(document.getElementById('newRoomCapacity')?.value, 10);
    if (!name || !capacity) return;

    try {
      const res = await request('/centers/rooms', {
        method: 'POST',
        body: JSON.stringify({ name, capacity }),
      });
      if (!this.centerDashboardState.rooms) this.centerDashboardState.rooms = [];
      this.centerDashboardState.rooms.push(res.room || { id: res.id || `room-${Date.now()}`, name, capacity });
      this.renderMainContent();
      this.showToast('تمت إضافة القاعة بنجاح!', 'success');
    } catch (err) {
      this.showToast(`فشل إضافة القاعة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  app.handleRoomConflictCheck = async function(e) {
    e.preventDefault();
    const roomId = document.getElementById('conflictRoomSelect')?.value;
    const date = document.getElementById('conflictDate')?.value;
    const startTime = document.getElementById('conflictStartTime')?.value;
    const endTime = document.getElementById('conflictEndTime')?.value;
    const studentCount = parseInt(document.getElementById('conflictStudentCount')?.value, 10) || undefined;

    if (!roomId) {
      this.showToast('يرجى اختيار القاعة أولاً', 'info');
      return;
    }

    try {
      const res = await request('/centers/rooms/check-conflict', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          date,
          start_time: startTime,
          end_time: endTime,
          student_count: studentCount,
        }),
      });
      this.centerDashboardState.conflictCheckResult = res;
    } catch (err) {
      this.centerDashboardState.conflictCheckResult = null;
      this.showToast(`فشل فحص التعارض: ${err.message || 'حدث خطأ في الاتصال بالخدمة'}`, 'danger');
    }
    this.renderMainContent();
  }

  app.handleFrontDeskScanSubmit = async function(e) {
    e.preventDefault();
    const inputEl = document.getElementById('frontDeskBarcodeInput');
    const barcode = inputEl?.value.trim();
    if (!barcode) return;

    try {
      const res = await request('/centers/front-desk-scan', {
        method: 'POST',
        body: JSON.stringify({ barcode }),
      });
      this.centerDashboardState.frontDeskScanResult = res;
    } catch (err) {
      this.centerDashboardState.frontDeskScanResult = {
        success: false,
        code: 'SCAN_FAILED',
        message: err.message || 'تعذر الاتصال بخدمة التحقق',
        audio_alert: 'error',
      };
    }
    this.renderMainContent();
  }

  app.handleAddTeacherSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('obTeacherName')?.value.trim();
    const phone = document.getElementById('obTeacherPhone')?.value.trim();
    const subjectsStr = document.getElementById('obTeacherSubjects')?.value.trim();
    const revenue_model = document.getElementById('obTeacherRevenueModel')?.value;
    const revenue_value = parseFloat(document.getElementById('obTeacherRevenueValue')?.value) || 0;
    const onboarding_method = document.getElementById('obTeacherMethod')?.value;
    const email = document.getElementById('obTeacherEmail')?.value.trim() || undefined;
    const password = document.getElementById('obTeacherPassword')?.value || undefined;

    const subjects = subjectsStr ? subjectsStr.split('،').map(s => s.trim()) : [];

    try {
      const res = await request('/centers/teachers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          subjects,
          revenue_model,
          revenue_value,
          onboarding_method,
          email,
          password,
        }),
      });

      if (res.onboarding_method === 'invite_link' && res.invite_url) {
        this.centerDashboardState.generatedInvite = {
          name,
          invite_url: res.invite_url,
        };
      } else {
        this.showToast('تمت إضافة المدرس وتفعيل حسابه بنجاح!', 'success');
      }
    } catch (err) {
      this.showToast(`فشل إضافة المدرس: ${err.message || 'حدث خطأ أثناء حفظ بيانات المدرس'}`, 'danger');
    }
    this.renderMainContent();
  }

  app.handleAddAssistantSubmit = async function(e) {
    e.preventDefault();
    const name = document.getElementById('obAssistantName')?.value.trim();
    const phone = document.getElementById('obAssistantPhone')?.value.trim();
    const assistant_type = document.getElementById('obAssistantType')?.value;
    const can_view_financials = document.getElementById('obAssistantFinancials')?.checked ?? false;

    try {
      await request('/centers/assistants', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          assistant_type,
          can_view_financials,
        }),
      });
      this.showToast('تمت إضافة المساعد بنجاح!', 'success');
    } catch (err) {
      this.showToast(`فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
    this.renderMainContent();
  }

  app.copyInviteUrl = function(url) {
    this.copyToClipboard(url, 'تم نسخ رابط الدعوة بنجاح!', 'رابط الدعوة');
  }
}
