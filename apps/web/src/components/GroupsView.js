import { request } from "../services/api.js";
import { normalizeDigits } from "../utils/normalizeDigits.js";
import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Groups Management Component (DEV-89)
 * Clean vector icons, 3 billing models, schedule day/time, and quick action buttons.
 */

export function renderGroupsView(groups = [], user = {}, isLoading = false, hasLoaded = true) {
  const isAssistant = user?.role === 'assistant';
  const groupList = groups || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Top Action Bar (Swiss Minimalist) -->
      <div class="card" style="margin: 0; padding: 0.85rem 1.15rem; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; box-shadow: 0 1px 2px rgba(0,0,0,0.02);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.65rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: #10b981; display: inline-block;"></span>
              <h2 style="margin: 0; font-size: 0.95rem; font-weight: 700; color: #0f172a;">
                المجاميع الدراسية ومواعيد الحصص
              </h2>
              <span style="font-size: 0.72rem; color: #64748b; background: #f8fafc; border: 1px solid #e2e8f0; padding: 1px 6px; border-radius: 4px; font-weight: 600;">
                ${groupList.length} مجموعة
              </span>
            </div>
            <p style="margin: 2px 0 0 0; font-size: 0.76rem; color: #64748b;">
              إدارة القاعات، السناتر، مواعيد الحصص الأسبوعية وأنظمة محاسبة السنتر
            </p>
          </div>

          <button class="btn btn-primary" onclick="window.centrlyApp.openCreateGroupModal()" style="height: 30px; font-size: 0.76rem; font-weight: 700;">
            ${getIcon('add', 14, '#ffffff')}
            <span>مجموعة جديدة</span>
          </button>
        </div>
      </div>

      ${((isLoading || !hasLoaded) && groupList.length === 0) ? `
        <!-- Groups Loading Sleek Spinner & Skeleton Grid -->
        <div style="display: flex; align-items: center; justify-content: center; padding: 2rem 1rem;">
          <svg class="centrly-sleek-spinner" viewBox="0 0 50 50">
            <defs>
              <linearGradient id="centrlySleekGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stop-color="#1e3a8a" />
                <stop offset="50%" stop-color="#2563eb" />
                <stop offset="100%" stop-color="#60a5fa" />
              </linearGradient>
            </defs>
            <circle class="spinner-track" cx="25" cy="25" r="20" fill="none" stroke-width="3.5" />
            <circle class="spinner-head" cx="25" cy="25" r="20" fill="none" stroke="url(#centrlySleekGradient)" stroke-width="3.5" />
          </svg>
        </div>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 1.25rem;">
          ${[1, 2, 3].map(() => `
            <div class="skeleton-card" style="min-height: 240px; justify-content: space-between;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1rem;">
                  <span class="skeleton-box" style="width: 140px; height: 22px;"></span>
                  <span class="skeleton-box" style="width: 75px; height: 22px; border-radius: 8px;"></span>
                </div>
                <div style="display: flex; flex-direction: column; gap: 0.65rem; margin-top: 1rem;">
                  <span class="skeleton-box" style="width: 180px; height: 16px;"></span>
                  <span class="skeleton-box" style="width: 130px; height: 16px;"></span>
                  <span class="skeleton-box" style="width: 160px; height: 16px;"></span>
                </div>
              </div>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.5rem; border-top: 1px solid var(--centrly-line); padding-top: 0.75rem;">
                <div style="display: flex; gap: 0.35rem;">
                  <span class="skeleton-box" style="flex: 1; height: 28px; border-radius: 6px;"></span>
                  <span class="skeleton-box" style="flex: 1; height: 28px; border-radius: 6px;"></span>
                  <span class="skeleton-box" style="flex: 1; height: 28px; border-radius: 6px;"></span>
                </div>
                <div style="display: flex; gap: 0.35rem;">
                  <span class="skeleton-box" style="flex: 1; height: 28px; border-radius: 6px;"></span>
                  <span class="skeleton-box" style="flex: 1; height: 28px; border-radius: 6px;"></span>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
      ` : groupList.length > 0 ? `
        <!-- Groups Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 320px), 1fr)); gap: 1.25rem;">
          ${groupList.map(g => {
            // Determine billing display label
            let billingLabel = 'نسبة مئوية';
            const isNoCenter = g.billing_model === 'no_center' || (g.billing_model === 'percentage' && Number(g.center_cut_percentage) === 0);
            if (isNoCenter) {
              billingLabel = 'بدون سنتر (المعلم 100%)';
            } else if (g.billing_model === 'fixed_per_student') {
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
            <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between; border-right: ${g.is_section ? '4px solid #7c3aed' : (isNoCenter ? '4px solid #16a34a' : '4px solid var(--centrly-blue-700)')}; transition: transform 0.2s, box-shadow 0.2s;">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                  <div>
                    <h3 style="font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink); margin: 0;">${escapeHtml(g.name)}</h3>
                    ${g.is_section ? '<span class="badge" style="background:#ede9fe;color:#7c3aed;margin-top:0.35rem;display:inline-flex;align-items:center;gap:0.3rem;">قسم فرعي</span>' : ''}
                  </div>
                  <span class="badge" style="display: inline-flex; align-items: center; gap: 0.35rem; ${isNoCenter ? 'background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;' : 'background: var(--centrly-blue-50); color: var(--centrly-blue-700); border: 1px solid var(--centrly-blue-200);'}">
                    ${getIcon('center', 14)}
                    <span>${escapeHtml(g.centerName || g.center_name || (isNoCenter ? 'درس خاص / منزلي' : 'السنتر'))}</span>
                  </span>
                </div>

                <div style="display: flex; flex-direction: column; gap: 0.4rem; margin-top: 0.75rem; font-size: 0.825rem; color: var(--centrly-text);">
                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('calendar', 16)}</span>
                    <span>الموعد: <b style="color: var(--centrly-ink);">${escapeHtml(scheduleDisplay)}</b></span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('students', 16)}</span>
                    <span>الطلاب المقيدون: <b style="color: var(--centrly-ink);">${escapeHtml(g.studentCount || g.students_count || ((window.centrlyApp?.students || []).filter(s => s.group_id === g.id).length) || 0)} طالب</b></span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('billing', 16)}</span>
                    <span>سعر الحصة: ${isAssistant ? '<span class="badge badge-secondary">محجوب للمساعد</span>' : `<b style="color: var(--centrly-ink);">${escapeHtml(g.price ?? g.session_price ?? 0)} ج.م</b>`}</span>
                  </div>

                  <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <span style="color: var(--centrly-blue-700); display: flex;">${getIcon('clock', 16)}</span>
                    <span>تكرار الحصص: <b style="color: var(--centrly-ink);">${g.sessions_per_week || 1} ${g.sessions_per_week === 2 ? 'حصتان' : ((g.sessions_per_week || 1) > 2 ? `${g.sessions_per_week} حصص` : 'حصة')}/أسبوع (${(g.sessions_per_week || 1) * 4} حصص شهرياً)</b></span>
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
                    <div style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.775rem; background: ${isNoCenter ? '#f0fdf4' : '#f8fafc'}; padding: 0.35rem 0.6rem; border-radius: 6px; border: 1px dashed ${isNoCenter ? '#bbf7d0' : 'var(--centrly-line)'};">
                      <span style="color: ${isNoCenter ? '#16a34a' : '#f59e0b'}; display: flex;">${getIcon('dotNeutral', 8)}</span>
                      <span style="color: ${isNoCenter ? '#166534' : 'var(--centrly-ink)'}; font-weight: 600;">${isNoCenter ? 'نظام المحاسبة: بدون سنتر (صافي المعلم 100%)' : `نظام السنتر: ${escapeHtml(billingLabel)}`}</span>
                    </div>
                  ` : ''}
                </div>
              </div>

              <!-- Action Buttons -->
              <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid var(--centrly-line); padding-top: 0.75rem;">
                <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
                  <button class="btn btn-primary btn-sm" style="flex: 2; min-width: 110px; display: flex; align-items: center; justify-content: center; gap: 0.35rem; font-weight: 700;" onclick="window.centrlyApp.startSessionForGroup('${escapeHtml(g.id)}')">
                    ${getIcon('sessions', 16)}
                    <span>بدء الحصة</span>
                  </button>
                  <button class="btn btn-secondary btn-sm" style="flex: 1; min-width: 75px; display: flex; align-items: center; justify-content: center; gap: 0.35rem;" onclick="window.centrlyApp.viewGroupDetails('${escapeHtml(g.id)}')">
                    ${getIcon('students', 14)}
                    <span>الطلاب</span>
                  </button>
                  <button class="btn btn-secondary btn-sm" style="display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 600; padding: 0.25rem 0.55rem; color: #2563eb; border-color: #cbd5e1;" onclick="window.centrlyApp.openImportModal('${escapeHtml(g.id)}')" title="استيراد طلاب من شيت Excel لهذه المجموعة">
                    ${getIcon('download', 13, '#2563eb')}
                    <span>استيراد شيت</span>
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

export function registerGroupsActions(app) {
  app.openCreateGroupModal = function() {
    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const teacherOptions = (this.centerTeachers || []).map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (${(t.subjects || []).join('، ') || 'عام'})</option>`).join('');
    const roomOptions = (this.centerRooms || []).map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} (سعة ${r.capacity || 0} طالب)</option>`).join('');

    const bodyHtml = `
      <form id="createGroupModalForm" onsubmit="window.centrlyApp.handleCreateGroup(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المجموعة *</label>
          <input type="text" id="newGroupName" class="form-input" placeholder="اسم المجموعة الدراسية" required>
        </div>

        ${isCenterOwner ? `
          <div class="modal-form-grid">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">المدرس المسؤول *</label>
              <select id="newGroupTeacherId" class="form-input" required>
                <option value="">-- اختر المدرس --</option>
                ${teacherOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">القاعة المخصصة (اختياري)</label>
              <select id="newGroupRoomId" class="form-input">
                <option value="">-- بدون قاعة محددة (اختياري) --</option>
                ${roomOptions}
              </select>
            </div>
          </div>
        ` : `
          <div class="modal-form-grid">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">مكان الحصة / المقر (اختياري)</label>
              <input type="text" id="newGroupCenter" class="form-input" placeholder="اسم السنتر أو منزل الطالب أو المقر (اختياري)">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">القاعة المخصصة (اختياري)</label>
              <input type="text" id="newGroupRoomName" class="form-input" placeholder="اسم أو رقم القاعة (اختياري)">
            </div>
          </div>
        `}

        <div class="modal-form-grid">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م) *</label>
            <input type="number" id="newGroupPrice" class="form-input" min="0" step="5" placeholder="سعر الحصة" required>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">تكرار الحصص أسبوعياً *</label>
            <select id="newGroupSessionsPerWeek" class="form-input" onchange="window.centrlyApp.onSessionsPerWeekChange(this.value, 'new')">
              <option value="1" selected>حصة واحدة بالأسبوع (4 حصص شهرياً)</option>
              <option value="2">حصتان بالأسبوع (8 حصص شهرياً)</option>
            </select>
          </div>
        </div>

        <datalist id="commonSessionTimes">
          <option value="08:00 ص"></option>
          <option value="09:00 ص"></option>
          <option value="10:00 ص"></option>
          <option value="11:00 ص"></option>
          <option value="12:00 م"></option>
          <option value="01:00 م"></option>
          <option value="02:00 م"></option>
          <option value="03:00 م"></option>
          <option value="04:00 م"></option>
          <option value="05:00 م"></option>
          <option value="06:00 م"></option>
          <option value="07:00 م"></option>
          <option value="08:00 م"></option>
          <option value="09:00 م"></option>
          <option value="10:00 م"></option>
        </datalist>

        <!-- Schedule Container for 1 Session / Week -->
        <div id="newGroupScheduleSingle" class="modal-form-grid">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">يوم الحصة الأسبوعي *</label>
            <select id="newGroupDayOfWeek" class="form-input">
              <option value="السبت">السبت</option>
              <option value="الأحد">الأحد</option>
              <option value="الإثنين">الإثنين</option>
              <option value="الثلاثاء">الثلاثاء</option>
              <option value="الأربعاء">الأربعاء</option>
              <option value="الخميس">الخميس</option>
              <option value="الجمعة">الجمعة</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">موعد بداية الحصة *</label>
            <input type="text" id="newGroupSessionTime" list="commonSessionTimes" class="form-input" placeholder="مثال: 04:00 م" value="04:00 م">
          </div>
        </div>

        <!-- Schedule Container for 2 Sessions / Week -->
        <div id="newGroupScheduleDouble" style="display: none; flex-direction: column; gap: 0.75rem; margin-bottom: 0.85rem; background: #f8fafc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.85rem;">
          <div style="font-size: 0.825rem; font-weight: 700; color: var(--centrly-blue-700); margin-bottom: 0.25rem;">
            مواعيد الحصتين في الأسبوع:
          </div>
          <div class="modal-form-grid" style="margin-bottom: 0;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem;">اليوم الأول *</label>
              <select id="newGroupDay1" class="form-input">
                <option value="السبت" selected>السبت</option>
                <option value="الأحد">الأحد</option>
                <option value="الإثنين">الإثنين</option>
                <option value="الثلاثاء">الثلاثاء</option>
                <option value="الأربعاء">الأربعاء</option>
                <option value="الخميس">الخميس</option>
                <option value="الجمعة">الجمعة</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem;">موعد بداية الحصة الأولى *</label>
              <input type="text" id="newGroupTime1" list="commonSessionTimes" class="form-input" placeholder="مثال: 04:00 م" value="04:00 م">
            </div>
          </div>
          <div class="modal-form-grid" style="margin-bottom: 0;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem;">اليوم الثاني *</label>
              <select id="newGroupDay2" class="form-input">
                <option value="السبت">السبت</option>
                <option value="الأحد">الأحد</option>
                <option value="الإثنين">الإثنين</option>
                <option value="الثلاثاء" selected>الثلاثاء</option>
                <option value="الأربعاء">الأربعاء</option>
                <option value="الخميس">الخميس</option>
                <option value="الجمعة">الجمعة</option>
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem;">موعد بداية الحصة الثانية *</label>
              <input type="text" id="newGroupTime2" list="commonSessionTimes" class="form-input" placeholder="مثال: 04:00 م" value="04:00 م">
            </div>
          </div>
        </div>
        
        <!-- Billing Models -->
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">مقر الحصة ونظام المحاسبة *</label>
          <select id="newGroupBillingModel" class="form-input" onchange="window.centrlyApp.onBillingModelChange(this.value)">
            <option value="no_center" selected>🏠 لا يوجد نسبة للسنتر (درس خاص / في منزل / أونلاين - المعلم 100%)</option>
            <option value="percentage">🏢 سنتر تعليمي: نسبة مئوية للسنتر على كل طالب (%)</option>
            <option value="fixed_per_student">🏢 سنتر تعليمي: أجر ثابت للسنتر على كل طالب (ج.م)</option>
            <option value="fixed_rent">🏢 سنتر تعليمي: إيجار قاعة ثابت للحصة بالكامل (ج.م)</option>
          </select>
        </div>

        <!-- Conditional Info 0: No Center -->
        <div id="billingNoCenterInfo" class="form-group" style="margin-bottom: 0.85rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.75rem;">
          <div style="font-size: 0.825rem; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 0.4rem;">
            <span>🏠</span>
            <span>مجموعة خاصة أو منزلية (بدون نسبة سنتر):</span>
          </div>
          <div style="font-size: 0.775rem; color: #15803d; margin-top: 0.25rem; line-height: 1.5;">
            لا توجد أي استقطاعات أو عمولات للسنتر. إيراد الحصة بالكامل يُحسب لك كمعلم بنسبة 100%.
          </div>
        </div>

        <!-- Conditional Input 1: Percentage -->
        <div id="billingPercentageGroup" class="form-group" style="margin-bottom: 0.85rem; display: none;">
          <label class="form-label" style="font-weight: 700;">نسبة السنتر على الطالب (%) *</label>
          <input type="number" id="newGroupCenterCut" class="form-input" min="0" max="100" value="20" placeholder="20">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">يحصل السنتر على هذه النسبة من كل تذكرة حضور والباقي للمدرس</small>
        </div>

        <!-- Conditional Input 2: Fixed per student -->
        <div id="billingFixedPerStudentGroup" class="form-group" style="margin-bottom: 0.85rem; display: none;">
          <label class="form-label" style="font-weight: 700;">قيمة أجر السنتر لكل طالب (ج.م) *</label>
          <input type="number" id="newGroupFixedPerStudent" class="form-input" min="0" step="5" value="25" placeholder="25">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">قيمة ثابتة يدفعها الطالب للسنتر عن كل حصة يحضرها</small>
        </div>

        <!-- Conditional Input 3: Fixed room rent -->
        <div id="billingFixedRentGroup" class="form-group" style="margin-bottom: 0.85rem; display: none;">
          <label class="form-label" style="font-weight: 700;">إيجار القاعة الثابت للحصة (ج.م) *</label>
          <input type="number" id="newGroupFixedRent" class="form-input" min="0" step="50" value="300" placeholder="300">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">مبلغ إيجار القاعة للحصة الواحدة بغض النظر عن عدد الطلاب</small>
        </div>

        <div id="createGroupFeedback" style="display: none; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem;"></div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="createGroupModalForm" id="btnSaveGroup" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('add', 16)} <span>إنشاء المجموعة</span>
      </button>
    `;
    this.showModal('إنشاء مجموعة جديدة', bodyHtml, footerHtml);
  }

  app.onBillingModelChange = function(model) {
    const noCenterInfo = document.getElementById('billingNoCenterInfo');
    const pGroup = document.getElementById('billingPercentageGroup');
    const fStudentGroup = document.getElementById('billingFixedPerStudentGroup');
    const fRentGroup = document.getElementById('billingFixedRentGroup');

    if (noCenterInfo) noCenterInfo.style.display = model === 'no_center' ? 'block' : 'none';
    if (pGroup) pGroup.style.display = model === 'percentage' ? 'block' : 'none';
    if (fStudentGroup) fStudentGroup.style.display = model === 'fixed_per_student' ? 'block' : 'none';
    if (fRentGroup) fRentGroup.style.display = model === 'fixed_rent' ? 'block' : 'none';
  }

  app.onSessionsPerWeekChange = function(value, mode = 'new') {
    const singleContainer = document.getElementById(`${mode}GroupScheduleSingle`);
    const doubleContainer = document.getElementById(`${mode}GroupScheduleDouble`);
    if (!singleContainer || !doubleContainer) return;

    if (String(value) === '2') {
      singleContainer.style.display = 'none';
      doubleContainer.style.display = 'flex';
    } else {
      singleContainer.style.display = 'grid';
      doubleContainer.style.display = 'none';
    }
  }

  app.openEditGroupModal = function(groupId) {
    const group = (this.groups || []).find(g => g.id === groupId);
    if (!group) {
      this.showToast('لم يتم العثور على بيانات المجموعة المحددة', 'danger');
      return;
    }

    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const teacherOptions = (this.centerTeachers || []).map(t => `
      <option value="${escapeHtml(t.id)}" ${t.id === group.teacher_id ? 'selected' : ''}>
        ${escapeHtml(t.name)} (${(t.subjects || []).join('، ') || 'عام'})
      </option>
    `).join('');
    const roomOptions = (this.centerRooms || []).map(r => `
      <option value="${escapeHtml(r.id)}" ${r.id === group.room_id ? 'selected' : ''}>
        ${escapeHtml(r.name)} (سعة ${r.capacity || 0} طالب)
      </option>
    `).join('');

    const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const sessionsPerWeek = Number(group.sessions_per_week) === 2 ? 2 : 1;

    // Parse existing days and times
    const matchedDays = days.filter(d => (group.day_of_week && group.day_of_week.includes(d)) || (group.schedule && group.schedule.includes(d)));
    const day1 = matchedDays[0] || (group.day_of_week && group.day_of_week.split('،')[0].trim()) || 'السبت';
    const day2 = matchedDays[1] || (day1 === 'السبت' ? 'الثلاثاء' : (day1 === 'الأحد' ? 'الأربعاء' : 'الخميس'));

    let time1 = '04:00 م';
    let time2 = '04:00 م';
    if (group.session_time) {
      if (group.session_time.includes('/')) {
        const parts = group.session_time.split('/').map(s => s.trim());
        time1 = parts[0] || time1;
        time2 = parts[1] || time1;
      } else {
        time1 = group.session_time;
        time2 = group.session_time;
      }
    }
    // Cleanly extract start time if existing group was saved with a range
    if (time1 && time1.includes('-')) {
      time1 = time1.split('-')[0].trim();
    }
    if (time2 && time2.includes('-')) {
      time2 = time2.split('-')[0].trim();
    }

    const singleDayOptions = days.map(d => `<option value="${d}" ${d === day1 ? 'selected' : ''}>${d}</option>`).join('');
    const day1Options = days.map(d => `<option value="${d}" ${d === day1 ? 'selected' : ''}>${d}</option>`).join('');
    const day2Options = days.map(d => `<option value="${d}" ${d === day2 ? 'selected' : ''}>${d}</option>`).join('');

    const currentModel = group.billing_model || 'percentage';

    const bodyHtml = `
      <form id="editGroupModalForm" onsubmit="window.centrlyApp.saveGroupEdit(event, '${escapeHtml(groupId)}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المجموعة *</label>
          <input type="text" id="editGroupName" class="form-input" value="${escapeHtml(group.name || '')}" required>
        </div>

        ${isCenterOwner ? `
          <div class="modal-form-grid">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">المدرس المسؤول *</label>
              <select id="editGroupTeacherId" class="form-input" required>
                <option value="">-- اختر المدرس --</option>
                ${teacherOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">القاعة المخصصة (اختياري)</label>
              <select id="editGroupRoomId" class="form-input">
                <option value="">-- بدون قاعة محددة (اختياري) --</option>
                ${roomOptions}
              </select>
            </div>
          </div>
        ` : `
          <div class="modal-form-grid">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">مكان الحصة / المقر (اختياري)</label>
              <input type="text" id="editGroupCenter" class="form-input" value="${escapeHtml(group.center_name || group.centerName || '')}" placeholder="اسم السنتر أو منزل الطالب أو المقر (اختياري)">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">القاعة المخصصة (اختياري)</label>
              <input type="text" id="editGroupRoomName" class="form-input" value="${escapeHtml(group.room || group.room_name || '')}" placeholder="اسم أو رقم القاعة (اختياري)">
            </div>
          </div>
        `}

        <div class="modal-form-grid">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م) *</label>
            <input type="number" id="editGroupPrice" class="form-input" min="0" step="5" value="${group.price ?? group.session_price ?? 80}" required>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">تكرار الحصص أسبوعياً *</label>
            <select id="editGroupSessionsPerWeek" class="form-input" onchange="window.centrlyApp.onSessionsPerWeekChange(this.value, 'edit')">
              <option value="1" ${sessionsPerWeek === 1 ? 'selected' : ''}>حصة واحدة بالأسبوع (4 حصص شهرياً)</option>
              <option value="2" ${sessionsPerWeek === 2 ? 'selected' : ''}>حصتان بالأسبوع (8 حصص شهرياً)</option>
            </select>
          </div>
        </div>

        <!-- Schedule Container for 1 Session / Week -->
        <div id="editGroupScheduleSingle" class="modal-form-grid" style="display: ${sessionsPerWeek === 1 ? 'grid' : 'none'};">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">يوم الحصة الأسبوعي *</label>
            <select id="editGroupDayOfWeek" class="form-input">
              ${singleDayOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">موعد بداية الحصة *</label>
            <input type="text" id="editGroupSessionTime" list="commonSessionTimes" class="form-input" value="${escapeHtml(time1)}" placeholder="مثال: 04:00 م">
          </div>
        </div>

        <!-- Schedule Container for 2 Sessions / Week -->
        <div id="editGroupScheduleDouble" style="display: ${sessionsPerWeek === 2 ? 'flex' : 'none'}; flex-direction: column; gap: 0.75rem; margin-bottom: 0.85rem; background: #f8fafc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.85rem;">
          <div style="font-size: 0.825rem; font-weight: 700; color: var(--centrly-blue-700); margin-bottom: 0.25rem;">
            مواعيد الحصتين في الأسبوع:
          </div>
          <div class="modal-form-grid" style="margin-bottom: 0;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem;">اليوم الأول *</label>
              <select id="editGroupDay1" class="form-input">
                ${day1Options}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem;">موعد بداية الحصة الأولى *</label>
              <input type="text" id="editGroupTime1" list="commonSessionTimes" class="form-input" value="${escapeHtml(time1)}" placeholder="مثال: 04:00 م">
            </div>
          </div>
          <div class="modal-form-grid" style="margin-bottom: 0;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem;">اليوم الثاني *</label>
              <select id="editGroupDay2" class="form-input">
                ${day2Options}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 600; font-size: 0.85rem;">موعد بداية الحصة الثانية *</label>
              <input type="text" id="editGroupTime2" list="commonSessionTimes" class="form-input" value="${escapeHtml(time2)}" placeholder="مثال: 04:00 م">
            </div>
          </div>
        </div>
        
        <!-- Billing Models -->
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">مقر الحصة ونظام المحاسبة *</label>
          <select id="editGroupBillingModel" class="form-input" onchange="window.centrlyApp.onEditBillingModelChange(this.value)">
            <option value="no_center" ${currentModel === 'no_center' ? 'selected' : ''}>🏠 لا يوجد نسبة للسنتر (درس خاص / في منزل / أونلاين - المعلم 100%)</option>
            <option value="percentage" ${currentModel === 'percentage' ? 'selected' : ''}>🏢 سنتر تعليمي: نسبة مئوية للسنتر على كل طالب (%)</option>
            <option value="fixed_per_student" ${currentModel === 'fixed_per_student' ? 'selected' : ''}>🏢 سنتر تعليمي: أجر ثابت للسنتر على كل طالب (ج.م)</option>
            <option value="fixed_rent" ${currentModel === 'fixed_rent' ? 'selected' : ''}>🏢 سنتر تعليمي: إيجار قاعة ثابت للحصة بالكامل (ج.م)</option>
          </select>
        </div>

        <!-- Conditional Info 0: No Center -->
        <div id="editBillingNoCenterInfo" class="form-group" style="margin-bottom: 0.85rem; background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.75rem; display: ${currentModel === 'no_center' ? 'block' : 'none'};">
          <div style="font-size: 0.825rem; font-weight: 700; color: #166534; display: flex; align-items: center; gap: 0.4rem;">
            <span>🏠</span>
            <span>مجموعة خاصة أو منزلية (بدون نسبة سنتر):</span>
          </div>
          <div style="font-size: 0.775rem; color: #15803d; margin-top: 0.25rem; line-height: 1.5;">
            لا توجد أي استقطاعات أو عمولات للسنتر. إيراد الحصة بالكامل يُحسب لك كمعلم بنسبة 100%.
          </div>
        </div>

        <!-- Conditional Input 1: Percentage -->
        <div id="editBillingPercentageGroup" class="form-group" style="margin-bottom: 0.85rem; display: ${currentModel === 'percentage' ? 'block' : 'none'};">
          <label class="form-label" style="font-weight: 700;">نسبة السنتر على الطالب (%) *</label>
          <input type="number" id="editGroupCenterCut" class="form-input" min="0" max="100" value="${group.center_cut_percentage ?? 20}">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">يحصل السنتر على هذه النسبة من كل تذكرة حضور والباقي للمدرس</small>
        </div>

        <!-- Conditional Input 2: Fixed per student -->
        <div id="editBillingFixedPerStudentGroup" class="form-group" style="margin-bottom: 0.85rem; display: ${currentModel === 'fixed_per_student' ? 'block' : 'none'};">
          <label class="form-label" style="font-weight: 700;">قيمة أجر السنتر لكل طالب (ج.م) *</label>
          <input type="number" id="editGroupFixedPerStudent" class="form-input" min="0" step="5" value="${group.fixed_per_student_amount ?? 25}">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">قيمة ثابتة يدفعها الطالب للسنتر عن كل حصة يحضرها</small>
        </div>

        <!-- Conditional Input 3: Fixed room rent -->
        <div id="editBillingFixedRentGroup" class="form-group" style="margin-bottom: 0.85rem; display: ${currentModel === 'fixed_rent' ? 'block' : 'none'};">
          <label class="form-label" style="font-weight: 700;">إيجار القاعة الثابت للحصة (ج.م) *</label>
          <input type="number" id="editGroupFixedRent" class="form-input" min="0" step="50" value="${group.fixed_rent_amount ?? 300}">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">مبلغ إيجار القاعة للحصة الواحدة بغض النظر عن عدد الطلاب</small>
        </div>

        <div id="editGroupFeedback" style="display: none; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem;"></div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="editGroupModalForm" id="btnUpdateGroup" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('check', 16)} <span>حفظ التعديلات</span>
      </button>
    `;

    this.showModal(`تعديل بيانات المجموعة: ${escapeHtml(group.name)}`, bodyHtml, footerHtml);
  }

  app.onEditBillingModelChange = function(model) {
    const noCenterInfo = document.getElementById('editBillingNoCenterInfo');
    const pGroup = document.getElementById('editBillingPercentageGroup');
    const fStudentGroup = document.getElementById('editBillingFixedPerStudentGroup');
    const fRentGroup = document.getElementById('editBillingFixedRentGroup');

    if (noCenterInfo) noCenterInfo.style.display = model === 'no_center' ? 'block' : 'none';
    if (pGroup) pGroup.style.display = model === 'percentage' ? 'block' : 'none';
    if (fStudentGroup) fStudentGroup.style.display = model === 'fixed_per_student' ? 'block' : 'none';
    if (fRentGroup) fRentGroup.style.display = model === 'fixed_rent' ? 'block' : 'none';
  }

  app.handleCreateGroup = async function(e) {
    e.preventDefault();
    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const name = document.getElementById('newGroupName').value.trim();
    const teacher_id = isCenterOwner ? (document.getElementById('newGroupTeacherId')?.value || null) : null;
    const room_id = isCenterOwner ? (document.getElementById('newGroupRoomId')?.value || null) : null;
    let center_name = undefined;
    let room_name = undefined;

    if (isCenterOwner && room_id) {
      const matchedRoom = (this.centerRooms || []).find(r => r.id === room_id);
      center_name = matchedRoom ? matchedRoom.name : 'قاعة السنتر';
      room_name = matchedRoom ? matchedRoom.name : undefined;
    } else {
      center_name = document.getElementById('newGroupCenter')?.value.trim() || undefined;
      room_name = document.getElementById('newGroupRoomName')?.value.trim() || undefined;
    }

    const price = Number(document.getElementById('newGroupPrice').value) || 0;
    const sessions_per_week = Number(document.getElementById('newGroupSessionsPerWeek')?.value) || 1;
    const billing_model = document.getElementById('newGroupBillingModel').value;

    let day_of_week = 'السبت';
    let session_time = '04:00 م';
    let schedule = '';

    if (sessions_per_week === 2) {
      const day1 = document.getElementById('newGroupDay1')?.value || 'السبت';
      const time1 = document.getElementById('newGroupTime1')?.value?.trim() || '04:00 م';
      const day2 = document.getElementById('newGroupDay2')?.value || 'الثلاثاء';
      const time2 = document.getElementById('newGroupTime2')?.value?.trim() || '04:00 م';

      day_of_week = `${day1}، ${day2}`;
      if (time1 === time2) {
        session_time = time1;
        schedule = `${day1} و${day2} • ${time1}`;
      } else {
        session_time = `${time1} / ${time2}`;
        schedule = `${day1} (${time1}) • ${day2} (${time2})`;
      }
    } else {
      day_of_week = document.getElementById('newGroupDayOfWeek')?.value || 'السبت';
      session_time = document.getElementById('newGroupSessionTime')?.value?.trim() || '04:00 م';
      schedule = `${day_of_week} • ${session_time}`;
    }

    let center_cut_percentage = 0;
    let fixed_per_student_amount = null;
    let fixed_rent_amount = null;

    if (billing_model === 'no_center') {
      center_cut_percentage = 0;
      fixed_per_student_amount = null;
      fixed_rent_amount = null;
    } else if (billing_model === 'percentage') {
      center_cut_percentage = Number(document.getElementById('newGroupCenterCut')?.value) || 20;
    } else if (billing_model === 'fixed_per_student') {
      fixed_per_student_amount = Number(document.getElementById('newGroupFixedPerStudent')?.value) || 20;
    } else if (billing_model === 'fixed_rent') {
      fixed_rent_amount = Number(document.getElementById('newGroupFixedRent')?.value) || 250;
    }

    const feedback = document.getElementById('createGroupFeedback');
    const saveBtn = document.getElementById('btnSaveGroup');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الإنشاء...';
    }

    try {
      await request('/groups', {
        method: 'POST',
        body: {
          name,
          center_name,
          teacher_id,
          room_id,
          room: room_name,
          room_name: room_name,
          price,
          session_price: price,
          sessions_per_week,
          billing_model,
          center_cut_percentage,
          fixed_per_student_amount,
          fixed_rent_amount,
          day_of_week,
          session_time,
          schedule,
        },
      });

      this.closeModal();
      this.showToast(`تم إنشاء المجموعة (${name}) بنجاح!`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل إنشاء المجموعة.'}`;
      } else {
        this.showToast(`فشل إنشاء المجموعة: ${err.message || 'خطأ في البيانات'}`, 'danger');
      }
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'إنشاء المجموعة';
      }
    }
  }

  app.saveGroupEdit = async function(e, groupId) {
    e.preventDefault();
    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const name = document.getElementById('editGroupName')?.value.trim();
    const teacher_id = isCenterOwner ? (document.getElementById('editGroupTeacherId')?.value || null) : null;
    const room_id = isCenterOwner ? (document.getElementById('editGroupRoomId')?.value || null) : null;
    let center_name = undefined;
    let room_name = undefined;

    if (isCenterOwner && room_id) {
      const matchedRoom = (this.centerRooms || []).find(r => r.id === room_id);
      center_name = matchedRoom ? matchedRoom.name : 'قاعة السنتر';
      room_name = matchedRoom ? matchedRoom.name : undefined;
    } else {
      center_name = document.getElementById('editGroupCenter')?.value.trim() || undefined;
      room_name = document.getElementById('editGroupRoomName')?.value.trim() || undefined;
    }

    const price = Number(document.getElementById('editGroupPrice')?.value) || 0;
    const sessions_per_week = Number(document.getElementById('editGroupSessionsPerWeek')?.value) || 1;
    const billing_model = document.getElementById('editGroupBillingModel')?.value || 'percentage';

    let day_of_week = 'السبت';
    let session_time = '04:00 م';
    let schedule = '';

    if (sessions_per_week === 2) {
      const day1 = document.getElementById('editGroupDay1')?.value || 'السبت';
      const time1 = document.getElementById('editGroupTime1')?.value?.trim() || '04:00 م';
      const day2 = document.getElementById('editGroupDay2')?.value || 'الثلاثاء';
      const time2 = document.getElementById('editGroupTime2')?.value?.trim() || '04:00 م';

      day_of_week = `${day1}، ${day2}`;
      if (time1 === time2) {
        session_time = time1;
        schedule = `${day1} و${day2} • ${time1}`;
      } else {
        session_time = `${time1} / ${time2}`;
        schedule = `${day1} (${time1}) • ${day2} (${time2})`;
      }
    } else {
      day_of_week = document.getElementById('editGroupDayOfWeek')?.value || 'السبت';
      session_time = document.getElementById('editGroupSessionTime')?.value?.trim() || '04:00 م';
      schedule = `${day_of_week} • ${session_time}`;
    }

    let center_cut_percentage = 0;
    let fixed_per_student_amount = null;
    let fixed_rent_amount = null;

    if (billing_model === 'no_center') {
      center_cut_percentage = 0;
      fixed_per_student_amount = null;
      fixed_rent_amount = null;
    } else if (billing_model === 'percentage') {
      center_cut_percentage = Number(document.getElementById('editGroupCenterCut')?.value) || 20;
    } else if (billing_model === 'fixed_per_student') {
      fixed_per_student_amount = Number(document.getElementById('editGroupFixedPerStudent')?.value) || 20;
    } else if (billing_model === 'fixed_rent') {
      fixed_rent_amount = Number(document.getElementById('editGroupFixedRent')?.value) || 250;
    }

    const feedback = document.getElementById('editGroupFeedback');
    const saveBtn = document.getElementById('btnUpdateGroup');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';
    }

    try {
      await request(`/groups/${groupId}`, {
        method: 'PUT',
        body: {
          name,
          center_name,
          teacher_id,
          room_id,
          room: room_name,
          room_name: room_name,
          price,
          session_price: price,
          sessions_per_week,
          billing_model,
          center_cut_percentage,
          fixed_per_student_amount,
          fixed_rent_amount,
          day_of_week,
          session_time,
          schedule,
        },
      });

      // Update local cache
      const cached = (this.groups || []).find(g => g.id === groupId);
      if (cached) {
        cached.name = name;
        cached.center_name = center_name;
        cached.room = room_name;
        cached.room_name = room_name;
        cached.price = price;
        cached.sessions_per_week = sessions_per_week;
        cached.day_of_week = day_of_week;
        cached.session_time = session_time;
        cached.schedule = schedule;
      }

      this.closeModal();
      this.showToast(`تم تحديث بيانات المجموعة (${name}) بنجاح!`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل تحديث بيانات المجموعة.'}`;
      } else {
        this.showToast(`فشل تحديث المجموعة: ${err.message || 'خطأ في البيانات'}`, 'danger');
      }
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ التعديلات';
      }
    }
  }

  app.confirmDeleteGroup = function(groupId, groupName) {
    this.showConfirmModal({
      title: 'حذف المجموعة الدراسية',
      message: `هل أنت متأكد من رغبتك في حذف المجموعة "${groupName}" نهائياً؟ سيتم إلغاء قيد الطلاب من المجموعة.`,
      confirmText: 'حذف المجموعة',
      cancelText: 'إلغاء',
      isDanger: true,
      onConfirm: async () => {
        try {
          await request(`/groups/${groupId}`, { method: 'DELETE' });
          this.showToast(`تم حذف المجموعة (${groupName}) بنجاح`, 'success');
          await this.loadRouteData(this.currentRoute);
        } catch (err) {
          this.showToast(`فشل حذف المجموعة: ${err.message || 'خطأ في الخادم'}`, 'danger');
        }
      },
    });
  }

  app.viewGroupDetails = function(groupId) {
    this.currentRoute = 'students';
    this.renderMainContent();
    this.loadRouteData('students').then(() => {
      const filter = document.getElementById('studentGroupFilter');
      if (filter) {
        filter.value = groupId;
        this.filterStudentsTable();
      }
    });
  }
}
