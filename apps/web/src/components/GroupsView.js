/**
 * Centrly Groups Management Component (DEV-16)
 * Group listings, student counts, session price with assistant role masking.
 */

export function renderGroupsView(groups = [], user = {}) {
  const isAssistant = user?.role === 'assistant';

  const defaultGroups = groups.length > 0 ? groups : [
    { id: 'grp-1', name: 'تانية ثانوي - سنتر الأوائل', centerName: 'سنتر الأوائل', studentCount: 38, price: 100, schedule: 'السبت والثلاثاء 4:00 م' },
    { id: 'grp-2', name: 'أولى ثانوي - سنتر النخبة', centerName: 'سنتر النخبة', studentCount: 45, price: 90, schedule: 'الأحد والأربعاء 5:30 م' },
    { id: 'grp-3', name: 'تالتة ثانوي - قاعة التفوق', centerName: 'سنتر الأوائل', studentCount: 59, price: 140, schedule: 'الاثنين والخميس 6:00 م' },
  ];

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

      <!-- Groups Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1.25rem;">
        ${defaultGroups.map(g => `
          <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between;">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 0.75rem;">
                <h3 style="font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink); margin: 0;">${g.name}</h3>
                <span class="badge badge-blue">${g.centerName}</span>
              </div>
              <div style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 0.5rem;">
                📅 الموعد: <b>${g.schedule}</b>
              </div>
              <div style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 0.5rem;">
                👥 عدد الطلاب: <b>${g.studentCount} طالب</b>
              </div>
              <div style="font-size: 0.825rem; color: var(--centrly-text);">
                💵 سعر الحصة: ${isAssistant ? '<span class="badge badge-secondary">🔒 محجوب للمساعد</span>' : `<b>${g.price} ج.م</b>`}
              </div>
            </div>

            <div style="display: flex; gap: 0.5rem; margin-top: 1.25rem; border-top: 1px solid var(--centrly-line); padding-top: 0.75rem;">
              <button class="btn btn-primary btn-sm" style="flex: 1;" onclick="window.centrlyApp.startSessionForGroup('${g.id}')">
                ⚡ بدء الحصة
              </button>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.viewGroupDetails('${g.id}')">
                عرض الطلاب
              </button>
            </div>
          </div>
        `).join('')}
      </div>

    </div>
  `;
}
