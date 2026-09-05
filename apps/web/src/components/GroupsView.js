/**
 * Centrly Groups Management Component (DEV-16)
 * Group listings, student counts, session price with assistant role masking.
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
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem;">المجاميع الدراسية ومواعيد الحصص</h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              إدارة القاعات، السناتر، أسعار الحصص وجداول المواعيد الأسبوعية
            </p>
          </div>

          <button class="btn btn-primary" onclick="window.centrlyApp.openCreateGroupModal()">
            ➕ مجموعة جديدة
          </button>
        </div>
      </div>

      ${groupList.length > 0 ? `
        <!-- Groups Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
          ${groupList.map(g => `
            <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between; border-right: ${g.is_section ? '4px solid #7c3aed' : '4px solid var(--centrly-primary)'};">
              <div>
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                  <div>
                    <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink); margin: 0;">${g.name}</h3>
                    ${g.is_section ? '<span class="badge" style="background:#ede9fe;color:#7c3aed;margin-top:0.25rem;display:inline-block;">📌 سكشن (قسم فرعي)</span>' : ''}
                  </div>
                  <span class="badge badge-blue">${g.centerName || g.center_name || 'السنتر'}</span>
                </div>
                <div style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 0.5rem;">
                  📅 الموعد: <b>${g.schedule || 'حسب الجدول'}</b>
                </div>
                <div style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 0.5rem;">
                  👥 عدد الطلاب: <b>${g.studentCount || g.students_count || 0} طالب</b>
                </div>
                <div style="font-size: 0.825rem; color: var(--centrly-text);">
                  💵 سعر الحصة: ${isAssistant ? '<span class="badge badge-secondary">🔒 محجوب للمساعد</span>' : `<b>${g.price || 0} ج.م</b>`}
                </div>
              </div>

              <div style="display: flex; gap: 0.35rem; margin-top: 1.25rem; border-top: 1px solid var(--centrly-line); padding-top: 0.75rem; flex-wrap: wrap;">
                <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="window.centrlyApp.startSessionForGroup('${g.id}')">
                  ⚡ بدء الحصة
                </button>
                <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.viewGroupDetails('${g.id}')">
                  عرض الطلاب
                </button>
                ${!g.is_section && !isAssistant ? `
                  <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openCreateSectionModal('${g.id}')" title="إضافة سكشن فرعي">
                    ➕ سكشن
                  </button>
                  <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.viewGroupRollUp('${g.id}')" title="تقرير الإجمالي للدفعة">
                    📊 الإجمالي
                  </button>
                ` : ''}
              </div>
            </div>
          `).join('')}
        </div>
      ` : `
        <div class="card" style="margin: 0; text-align: center; padding: 3rem 1rem; color: var(--centrly-text);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">🏢</div>
          <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0 0 0.5rem 0;">لا توجد مجاميع دراسية مسجلة حتى الآن</h3>
          <p style="font-size: 0.85rem; margin: 0;">اضغط على "➕ مجموعة جديدة" لإضافة أول مجموعة وتحديد السنتر والمواعيد والأسعار.</p>
        </div>
      `}

    </div>
  `;
}
