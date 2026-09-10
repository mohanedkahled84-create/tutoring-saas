import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Groups Management Component (DEV-89)
 * Clean vector icons, 3 billing models, schedule day/time, and quick action buttons.
 */

export function renderGroupsView(groups = [], user = {}) {
  const isAssistant = user?.role === 'assistant';
  const groupList = groups || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Top Action Bar -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('groups', 22, 'var(--centrly-blue-700)')}</span>
              <span>المجاميع الدراسية ومواعيد الحصص</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              إدارة القاعات، السناتر، مواعيد الحصص الأسبوعية وأنظمة محاسبة السنتر
            </p>
          </div>

          <button class="btn btn-primary" onclick="window.centrlyApp.openCreateGroupModal()" style="display: flex; align-items: center; gap: 0.5rem; font-weight: 700;">
            ${getIcon('add', 18)}
            <span>مجموعة جديدة</span>
          </button>
        </div>
      </div>

      ${groupList.length > 0 ? `
        <!-- Groups Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
          ${groupList.map(g => {
            // Determine billing display label
            let billingLabel = 'نسبة مئوية';
            if (g.billing_model === 'fixed_per_student') {
              billingLabel = `أجر ثابت: ${g.fixed_per_student_amount || 0} ج.م / طالب للسنتر`;
            } else if (g.billing_model === 'fixed_rent') {
              billingLabel = `إيجار قاعة: ${g.fixed_rent_amount || 0} ج.م / حصة`;
            } else {
              billingLabel = `نسبة السنتر: ${g.center_cut_percentage ?? 20}%`;
            }

            const scheduleDisplay = g.day_of_week && g.session_time 
              ? `${g.day_of_week} • ${g.session_time}` 
              : (g.schedule || 'حسب جدول المواعيد');

            return `
            <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between; border-right: ${g.is_section ? '4px solid #7c3aed' : '4px solid var(--centrly-blue-700)'}; transition: transform 0.2s, box-shadow 0.2s;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                  <div>
                    <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink); margin: 0;">${escapeHtml(g.name)}</h3>
                    ${g.is_section ? '<span class="badge" style="background:#ede9fe;color:#7c3aed;margin-top:0.35rem;display:inline-flex;align-items:center;gap:0.3rem;">قسم فرعي</span>' : ''}
                  </div>
                  <span class="badge badge-blue" style="display: inline-flex; align-items: center; gap: 0.35rem;">
                    ${getIcon('center', 14)}
                    <span>${escapeHtml(g.centerName || g.center_name || 'السنتر')}</span>
                  </span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.75rem; font-size: 0.825rem; color: var(--centrly-text);">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('calendar', 16)}</span>
                    <span>الموعد: <b style="color: var(--centrly-ink);">${escapeHtml(scheduleDisplay)}</b></span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('students', 16)}</span>
                    <span>الطلاب المقيدون: <b style="color: var(--centrly-ink);">${escapeHtml(g.studentCount ?? g.students_count ?? 0)} طالب</b></span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('billing', 16)}</span>
                    <span>سعر الحصة: ${isAssistant ? '<span class="badge badge-secondary">محجوب للمساعد</span>' : `<b style="color: var(--centrly-ink);">${escapeHtml(g.price ?? g.session_price ?? 0)} ج.م</b>`}</span>
                  </div>

                  ${g.teacher_name ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('students', 16)}</span>
                      <span>المدرس: <b style="color: var(--centrly-ink);">${escapeHtml(g.teacher_name)}</b></span>
                    </div>
                  ` : ''}

                  ${(g.room_name || g.room) ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                      <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('rooms', 16)}</span>
                      <span>القاعة: <b style="color: var(--centrly-ink);">${escapeHtml(g.room_name || g.room)}</b></span>
                    </div>
                  ` : ''}

                  ${!isAssistant ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.775rem; background: #f8fafc; padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px dashed var(--centrly-line);">
                      <span style="color: #f59e0b; display: flex;">${getIcon('dotNeutral', 8)}</span>
                      <span style="color: var(--centrly-ink); font-weight: 600;">نظام السنتر: ${escapeHtml(billingLabel)}</span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid var(--centrly-line); padding-top: 0.75rem;">
                <div style="display: flex; gap: 0.4rem;">
                  <button class="btn btn-primary btn-sm" style="flex: 2; display: flex; align-items: center; justify-content: center; gap: 0.35rem; font-weight: 700;" onclick="window.centrlyApp.startSessionForGroup('${escapeHtml(g.id)}')">
                    ${getIcon('sessions', 16)}
                    <span>بدء الحصة</span>
                  </button>
                  <button class="btn btn-secondary btn-sm" style="flex: 1; display: flex; align-items: center; justify-content: center; gap: 0.35rem;" onclick="window.centrlyApp.viewGroupDetails('${escapeHtml(g.id)}')">
                    ${getIcon('students', 14)}
                    <span>الطلاب</span>
                  </button>
                </div>

                <!-- Quick Session Management Actions -->
                <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
                  <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.25rem 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;" onclick="window.centrlyApp.openScheduleSessionModal('${escapeHtml(g.id)}')" title="إضافة حصة استثنائية أو تعويضية">
                    ${getIcon('add', 12)}
                    <span>حصة إضافية</span>
                  </button>
                  <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.25rem 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;" onclick="window.centrlyApp.openRescheduleModal('${escapeHtml(g.id)}')" title="تأجيل موعد حصة قادمة">
                    ${getIcon('clock', 12)}
                    <span>تأجيل</span>
                  </button>
                  <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.25rem 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem; color: var(--centrly-danger);" onclick="window.centrlyApp.openCancelSessionModal('${escapeHtml(g.id)}')" title="إلغاء حصة وإخطار أولياء الأمور">
                    ${getIcon('close', 12)}
                    <span>إلغاء</span>
                  </button>
                </div>

                <!-- Group Edit & Delete Actions -->
                <div style="display: flex; gap: 0.35rem; margin-top: 0.25rem;">
                  <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.25rem 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem;" onclick="window.centrlyApp.openEditGroupModal('${escapeHtml(g.id)}')" title="تعديل بيانات المجموعة والمواعيد">
                    ${getIcon('edit', 12)}
                    <span>تعديل المجموعة</span>
                  </button>
                  <button class="btn btn-secondary btn-sm" style="flex: 1; font-size: 0.75rem; padding: 0.25rem 0.5rem; display: flex; align-items: center; justify-content: center; gap: 0.25rem; color: var(--centrly-danger); border-color: rgba(239, 68, 68, 0.3);" onclick="window.centrlyApp.confirmDeleteGroup('${escapeHtml(g.id)}', '${escapeHtml(g.name)}')" title="حذف المجموعة نهائياً">
                    ${getIcon('close', 12)}
                    <span>حذف</span>
                  </button>
                </div>
              </div>
            </div>
          `;
          }).join('')}
        </div>
      ` : `
        <div class="card" style="margin: 0; text-align: center; padding: 3rem 1rem; color: var(--centrly-text);">
          <div style="display: flex; justify-content: center; margin-bottom: 0.75rem; color: var(--centrly-blue-700);">
            ${getIcon('groups', 48)}
          </div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0 0 0.5rem 0;">لا توجد مجاميع دراسية مسجلة حتى الآن</h3>
          <p style="font-size: 0.85rem; margin: 0;">اضغط على "مجموعة جديدة" بالأعلى لتحديد اسم المجموعة، السنتر، المواعيد ونموذج المحاسبة.</p>
        </div>
      `}

    </div>
  `;
}
