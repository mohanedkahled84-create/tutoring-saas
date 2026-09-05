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
      total_revenue: 38000,
      total_teacher_cut: 27500,
      total_center_cut: 10500,
      paid_teachers_count: 2,
      unpaid_teachers_count: 1,
    },
    reports: [
      {
        teacher: {
          id: 'teach-1',
          name: 'أ. طارق حسام',
          phone: '01011112222',
          subjects: ['فيزياء'],
          revenue_model: 'percentage',
          revenue_value: 75,
          status: 'active',
        },
        period,
        summary: {
          total_revenue: 20000,
          teacher_cut: 15000,
          center_cut: 5000,
          student_count: 200,
          sessions_count: 8,
        },
        payout: {
          id: 'p-1',
          status: 'paid',
          paid_at: '2026-09-04T10:00:00Z',
          notes: 'تحويل فودافون كاش',
        },
      },
      {
        teacher: {
          id: 'teach-2',
          name: 'د. شريف كمال',
          phone: '01122223333',
          subjects: ['كيمياء'],
          revenue_model: 'fixed_per_student',
          revenue_value: 60,
          status: 'active',
        },
        period,
        summary: {
          total_revenue: 12000,
          teacher_cut: 9000,
          center_cut: 3000,
          student_count: 150,
          sessions_count: 6,
        },
        payout: {
          id: 'p-2',
          status: 'unpaid',
          paid_at: null,
          notes: null,
        },
      },
      {
        teacher: {
          id: 'teach-3',
          name: 'أ. رانيا عادل',
          phone: '01233334444',
          subjects: ['لغة إنجليزية'],
          revenue_model: 'fixed_total',
          revenue_value: 3500,
          status: 'active',
        },
        period,
        summary: {
          total_revenue: 6000,
          teacher_cut: 3500,
          center_cut: 2500,
          student_count: 60,
          sessions_count: 4,
        },
        payout: {
          id: 'p-3',
          status: 'paid',
          paid_at: '2026-09-03T15:30:00Z',
          notes: 'استلام نقدي بالخزينة',
        },
      },
    ],
  };

  const rooms = state.rooms || [
    { id: 'room-1', name: 'قاعة أينشتاين (1)', capacity: 45, location: 'الدور الثاني' },
    { id: 'room-2', name: 'قاعة الفارابي (2)', capacity: 30, location: 'الدور الأول' },
    { id: 'room-3', name: 'قاعة الخوارزمي (3)', capacity: 60, location: 'الدور الأرضي' },
  ];

  const conflictCheckResult = state.conflictCheckResult || null;
  const frontDeskScanResult = state.frontDeskScanResult || null;
  const generatedInvite = state.generatedInvite || null;

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title & Period Switcher -->
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; background: var(--centrly-white); padding: 1.25rem 1.5rem; border-radius: var(--radius-md); box-shadow: var(--shadow-sm); border: 1px solid var(--centrly-line);">
        <div>
          <h1 style="margin: 0; font-size: 1.4rem; font-weight: 800; color: var(--centrly-ink);">
            🏛️ لوحة إدارة السنتر والقاعات
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
          <span>👨‍🏫</span>
          <span>المدرسين والمستحقات المالية</span>
        </button>

        <button 
          class="btn ${activeTab === 'rooms' ? 'btn-primary' : 'btn-secondary'}" 
          onclick="window.centrlyApp.switchCenterTab('rooms')"
          style="display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
        >
          <span>🚪</span>
          <span>إشغال القاعات وتضارب الحصص</span>
        </button>

        <button 
          class="btn ${activeTab === 'front_desk' ? 'btn-primary' : 'btn-secondary'}" 
          onclick="window.centrlyApp.switchCenterTab('front_desk')"
          style="display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
        >
          <span>⚡</span>
          <span>بوابة الاستقبال الذكية (Smart Gate)</span>
        </button>

        <button 
          class="btn ${activeTab === 'onboarding' ? 'btn-primary' : 'btn-secondary'}" 
          onclick="window.centrlyApp.switchCenterTab('onboarding')"
          style="display: flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
        >
          <span>➕</span>
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
                ${rollup.reports.map((r) => {
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
                        ${r.teacher.name}
                        <div style="font-size: 0.75rem; font-weight: normal; color: var(--centrly-text);">${r.teacher.phone}</div>
                      </td>
                      <td style="padding: 0.75rem; color: var(--centrly-text);">${r.teacher.subjects.join(', ')}</td>
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
                          ? `<span class="badge badge-success" style="background: var(--centrly-success-light); color: var(--centrly-success); font-weight: 700;">✓ مدفوع</span>`
                          : `<span class="badge badge-danger" style="background: var(--centrly-amber-100); color: var(--centrly-amber-700); font-weight: 700;">⏳ معلق</span>`
                        }
                      </td>
                      <td style="padding: 0.75rem;">
                        <button 
                          class="btn btn-sm ${isPaid ? 'btn-secondary' : 'btn-primary'}" 
                          onclick="window.centrlyApp.toggleTeacherPayout('${r.teacher.id}', '${period}', '${r.payout.status}')"
                          style="font-size: 0.8rem; padding: 0.3rem 0.6rem;"
                        >
                          ${isPaid ? 'تحويل لغير مدفوع' : 'تسجيل الصرف ✅'}
                        </button>
                      </td>
                    </tr>
                  `;
                }).join('')}
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
              <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0;">
                🚪 قاعات السنتر والسعة الاستيعابية
              </h2>
            </div>

            <div style="display: flex; flex-direction: column; gap: 0.75rem;">
              ${rooms.map((room) => `
                <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem; border-radius: var(--radius-sm); border: 1px solid var(--centrly-line); background: var(--centrly-surface);">
                  <div>
                    <div style="font-weight: 700; color: var(--centrly-ink);">${room.name}</div>
                    <div style="font-size: 0.8rem; color: var(--centrly-text);">${room.location || 'داخل السنتر'}</div>
                  </div>
                  <div style="text-align: left;">
                    <span class="badge" style="background: var(--centrly-blue-100); color: var(--centrly-blue-900); font-weight: 700;">
                      سعة ${room.capacity} طالب
                    </span>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Add Room Form -->
            <form onsubmit="window.centrlyApp.handleAddRoomSubmit(event)" style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--centrly-line);">
              <div style="font-weight: 700; font-size: 0.95rem; margin-bottom: 0.75rem; color: var(--centrly-ink);">+ إضافة قاعة جديدة للسنتر</div>
              <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                <input type="text" id="newRoomName" placeholder="اسم القاعة (مثال: قاعة 4)" class="form-input" style="flex: 2;" required>
                <input type="number" id="newRoomCapacity" placeholder="السعة" class="form-input" style="flex: 1;" min="1" required>
                <button type="submit" class="btn btn-primary" style="flex: 1;">إضافة</button>
              </div>
            </form>
          </div>

          <!-- Conflict Engine Test / Booking Inspector -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-500);">
            <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0 0 0.5rem 0;">
              ⚡ محرك فحص تضارب الحصص (Booking Conflict Engine)
            </h2>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1rem 0;">
              اختر القاعة والتوقيت المطلوب للتأكد من خلو القاعة وعدم تعارضها مع أي مدرس آخر قبل اعتماد الحصة.
            </p>

            <form onsubmit="window.centrlyApp.handleRoomConflictCheck(event)" style="display: flex; flex-direction: column; gap: 0.85rem;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">القاعة المراد حجزها:</label>
                <select id="conflictRoomSelect" class="form-input" style="width: 100%;" required>
                  ${rooms.map((r) => `<option value="${r.id}">${r.name} (سعة ${r.capacity} طالب)</option>`).join('')}
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
                <input type="number" id="conflictStudentCount" class="form-input" placeholder="مثال: 35" min="1">
              </div>

              <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem;">
                🔍 فحص توفر القاعة ومنع التضارب
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
                };">
                  ${conflictCheckResult.has_conflict
                    ? '⚠️ تنبيه تعارض: القاعة محجوزة بالفعل في هذا التوقيت!'
                    : '✓ القاعة شاغرة ومتاحة للحجز في هذا التوقيت'}
                </div>
                ${conflictCheckResult.conflicting_booking ? `
                  <div style="font-size: 0.85rem; color: var(--centrly-ink); margin-top: 0.4rem;">
                    الحصة المتعارضة: <strong>${conflictCheckResult.conflicting_booking.group_name || 'حصة'}</strong> 
                    للمدرس <strong>${conflictCheckResult.conflicting_booking.teacher_name || 'مدرس'}</strong> 
                    (من ${conflictCheckResult.conflicting_booking.start_time} إلى ${conflictCheckResult.conflicting_booking.end_time})
                  </div>
                ` : ''}
                ${conflictCheckResult.warning ? `
                  <div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--centrly-warning); font-weight: 700;">
                    ⚠️ ${conflictCheckResult.warning.message}
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
              <h2 style="font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink); margin: 0;">
                ⚡ بوابة الاستقبال الذكية (Smart Gate Mode)
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
                ${frontDeskScanResult.message}
              </div>

              ${frontDeskScanResult.session ? `
                <div style="display: flex; gap: 1rem; margin-top: 0.75rem; flex-wrap: wrap; font-size: 0.9rem;">
                  <div>المدرس: <strong>${frontDeskScanResult.session.teacher_name || 'غير محدد'}</strong></div>
                  <div>المادة: <strong>${frontDeskScanResult.session.subject || 'غير محدد'}</strong></div>
                  <div>القاعة: <strong>${frontDeskScanResult.session.room_name || 'قاعة السنتر'}</strong></div>
                  <div>المجموعة: <strong>${frontDeskScanResult.session.group_name || 'المجموعة'}</strong></div>
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
            <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0 0 1rem 0;">
              👨‍🏫 إضافة مدرس جديد للسنتر
            </h2>

            <form onsubmit="window.centrlyApp.handleAddTeacherSubmit(event)" style="display: flex; flex-direction: column; gap: 0.85rem;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">اسم المدرس:</label>
                <input type="text" id="obTeacherName" placeholder="أ. محمد أحمد" class="form-input" required>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">رقم الهاتف (الواتساب):</label>
                <input type="tel" id="obTeacherPhone" placeholder="01012345678" class="form-input" required>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">المواد الدراسية (مفصولة بفواصل):</label>
                <input type="text" id="obTeacherSubjects" placeholder="فيزياء، كيمياء" class="form-input" value="فيزياء">
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
                <input type="password" id="obTeacherPassword" placeholder="كلمة المرور (8 أحرف فأكثر)" class="form-input">
              </div>

              <button type="submit" class="btn btn-primary" style="margin-top: 0.5rem;">
                تأكيد إضافة المدرس
              </button>
            </form>
          </div>

          <!-- Add Assistant Form -->
          <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
            <h2 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0 0 1rem 0;">
              🧑‍💼 إضافة مساعد جديد
            </h2>

            <form onsubmit="window.centrlyApp.handleAddAssistantSubmit(event)" style="display: flex; flex-direction: column; gap: 0.85rem;">
              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">اسم المساعد:</label>
                <input type="text" id="obAssistantName" placeholder="الاسم الكامل" class="form-input" required>
              </div>

              <div>
                <label style="font-size: 0.8rem; font-weight: 700;">رقم الهاتف:</label>
                <input type="tel" id="obAssistantPhone" placeholder="01234567890" class="form-input" required>
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
            <div style="font-weight: 800; font-size: 1.1rem; color: var(--centrly-success);">
              ✓ تم إنشاء رابط الدعوة بنجاح لـ (${generatedInvite.name})!
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
