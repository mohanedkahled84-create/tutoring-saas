import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Center Rooms Management Component
 * Lists rooms, capacities, hourly rates, and allows adding new rooms.
 */

export function renderCenterRoomsView(rooms = []) {
  const roomList = rooms || [];
  const totalCapacity = roomList.reduce((acc, r) => acc + Number(r.capacity || 0), 0);

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Top Title & Action -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <h2 class="card-title" style="margin: 0; font-size: 1.25rem; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('center', 22, 'var(--centrly-blue-700)')}</span>
              <span>سجل قاعات السنتر والسعة الاستيعابية</span>
            </h2>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-top: 0.25rem;">
              إدارة قاعات التدريس، تحديد السعة القصوى لكل قاعة وسعر إيجار القاعة بالساعة لتجنب التضارب.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary" onclick="window.centrlyApp.openAddRoomModal()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('add', 16)}
              <span>إضافة قاعة جديدة</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Rooms Summary KPIs -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-blue-700);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي القاعات</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.35rem;">
            ${roomList.length} <span style="font-size: 0.85rem; font-weight: 500;">قاعات مجهزة</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            جاهزة لاستقبال الحصص
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-success);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الطاقة الاستيعابية</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-success); margin-top: 0.35rem;">
            ${totalCapacity} <span style="font-size: 0.85rem; font-weight: 500;">طالب</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            السعة الإجمالية لجميع القاعات
          </div>
        </div>

        <div class="card" style="margin: 0; background: #fff; border-top: 4px solid var(--centrly-amber-600);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">متوسط سعة القاعة</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-amber-700); margin-top: 0.35rem;">
            ${roomList.length > 0 ? Math.round(totalCapacity / roomList.length) : 0} <span style="font-size: 0.85rem; font-weight: 500;">طالب/قاعة</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">
            وفق اشتراطات المساحة
          </div>
        </div>
      </div>

      <!-- Rooms Grid / Table -->
      <div class="card" style="margin: 0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <h3 class="card-title" style="font-size: 1.05rem; display: flex; align-items: center; gap: 0.4rem;">
            ${getIcon('center', 18, 'var(--centrly-blue-700)')}
            <span>قائمة القاعات المتاحة (${roomList.length})</span>
          </h3>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>اسم القاعة</th>
                <th>السعة القصوى (الطلاب)</th>
                <th>سعر الإيجار بالساعة / الحصة</th>
                <th>كود القاعة</th>
                <th>حالة القاعة</th>
              </tr>
            </thead>
            <tbody>
              ${roomList.length > 0 ? roomList.map(r => {
                const hourlyRate = Number(r.hourly_rate || 0);
                return `
                  <tr>
                    <td style="font-weight: 700; color: var(--centrly-ink); font-size: 0.95rem;">${escapeHtml(r.name)}</td>
                    <td style="font-weight: 700; color: var(--centrly-blue-800); font-family: monospace;">${escapeHtml(r.capacity)} طالب</td>
                    <td style="font-family: monospace; font-weight: 700; color: var(--centrly-success);">
                      ${hourlyRate > 0 ? `${hourlyRate.toLocaleString('ar-EG')} ج.م / ساعة` : 'ضمن نسبة السنتر'}
                    </td>
                    <td style="font-family: monospace; color: var(--centrly-text); font-size: 0.85rem;">${escapeHtml(r.id.slice(0, 8))}</td>
                    <td>
                      <span class="badge badge-success">جاهزة للاستخدام</span>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا توجد قاعات مسجلة بعد. اضغط على "إضافة قاعة جديدة" لتهيئة قاعات السنتر.
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
