import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Student Cards Printing Component (DEV-89)
 * Name: طباعة كروت الطلاب
 * Features:
 *  - Interactive live card preview with Centrly branding
 *  - Upsell banner for plastic PVC ID cards linking to WhatsApp 01123671177
 *  - Selective batch printing (all, by group, or selected checkboxes)
 */

export function renderStudentCardsView(students = [], groups = [], user = {}) {
  const studentList = students || [];
  const groupList = groups || [];
  const defaultStudent = studentList[0] || {
    id: 'sample',
    name: 'يوسف محمود علي رضوان',
    code: 'STU-1042',
    student_code: 'STU-1042',
    parent_phone: '01012345678',
    student_phone: '01123456789',
  };

  const teacherOrCenterName = user?.name || (user?.account_type === 'center' ? 'سنتر التفوق التعليمي' : 'أ. محمد خالد');
  const userRoleTitle = user?.account_type === 'center' ? 'السنتر التعليمي' : 'مدرس المادة';

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" id="studentCardsContainer">
      
      <!-- Top Header & Direct Plastic Card Order Banner -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #1e3a8a, #1e40af); color: #ffffff; border: none; box-shadow: 0 10px 25px rgba(30,58,138,0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          <div style="max-width: 680px;">
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.15); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.6rem;">
              <span>${getIcon('cards', 16, '#ffffff')}</span>
              <span>طباعة كروت الطلاب والباركود الذكي</span>
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: #ffffff;">كروت الطلاب الذكية والباركود للطباعة</h2>
            <div style="font-size: 0.85rem; color: rgba(255,255,255,0.95); margin-top: 0.6rem; line-height: 1.6; background: rgba(0,0,0,0.15); padding: 0.75rem 1rem; border-radius: 8px;">
              <strong style="color: #93c5fd;">💡 خطوات طلب كروت بلاستيكية فاخرة (PVC ID Cards) لمنظومتك:</strong>
              <ol style="margin: 0.35rem 0 0 0; padding-right: 1.2rem; font-size: 0.82rem; color: #f1f5f9;">
                <li>حدد الطلاب المطلوبين من الجدول بالأسفل (أو اختر "تحديد الكل").</li>
                <li>اضغط على زر <b>"تنزيل كروت الطلاب للطباعة (PDF / باركود)"</b> لتحميل الملف المُنظم على جهازك.</li>
                <li>اضغط على زر <b>"طلب كروت بلاستيكية (واتساب)"</b> هنا للتواصل معنا وإرسال الملف لتجهيزها وشحنها لك فوراً.</li>
              </ol>
            </div>
          </div>

          <!-- Order Plastic Cards WhatsApp Button -->
          <div style="text-align: center;">
            <a href="https://wa.me/201123671177?text=${encodeURIComponent('مرحباً، قمت بتنزيل ملف كروت الطلاب والباركود من منصة سنترلي، وأرغب في إرساله لكم لطباعة كروت بلاستيكية فاخرة PVC للطلاب.')}" target="_blank" rel="noopener noreferrer" class="btn" style="background: #25d366; color: #ffffff; font-weight: 800; padding: 0.85rem 1.4rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.6rem; text-decoration: none; box-shadow: 0 4px 15px rgba(37,211,102,0.35); transition: transform 0.2s;">
              ${getIcon('whatsapp', 20, '#ffffff')}
              <span style="font-size: 0.95rem;">طلب كروت بلاستيكية (واتساب)</span>
            </a>
            <div style="font-size: 0.72rem; color: rgba(255,255,255,0.8); margin-top: 0.4rem;">
              تواصل مباشر مع الإدارة لطلب الكروت البلاستيكية بعد تنزيل الملف
            </div>
          </div>
        </div>
      </div>

      <!-- Selective Printing Controls & Student Table -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0;">تحديد الطلاب لإصدار وتنزيل الكروت</h3>
            <p style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.2rem;">
              حدد الطلاب أو اختر مجموعة كاملة، ثم اضغط "تنزيل كروت الطلاب" لحفظ وطباعة الكروت بالباركود
            </p>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <div id="selectedCardsCountBadge" class="badge badge-blue" style="font-size: 0.825rem; padding: 0.4rem 0.75rem;">
              تم تحديد: 0 طالب
            </div>
            <button class="btn btn-primary" style="display: flex; align-items: center; gap: 0.45rem; font-weight: 800; padding: 0.5rem 1.1rem; border-radius: 8px;" onclick="window.centrlyApp.downloadSelectedCardsPdf()">
              ${getIcon('print', 18)}
              <span>تنزيل كروت الطلاب للطباعة (PDF / باركود)</span>
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.selectAllCards(true)">
              تحديد الكل
            </button>
            <button class="btn btn-secondary" onclick="window.centrlyApp.selectAllCards(false)">
              إلغاء التحديد
            </button>
          </div>
        </div>

        <!-- Filter Bar -->
        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; flex-wrap: wrap;">
          <div style="flex: 2; min-width: 220px; position: relative;">
            <input type="text" id="cardSearchInput" class="form-input" placeholder="ابحث بالاسم أو كود الطالب..." oninput="window.centrlyApp.filterCardsTable()">
          </div>
          <div style="flex: 1; min-width: 180px;">
            <select id="cardGroupFilter" class="form-select" onchange="window.centrlyApp.filterCardsByGroup(this.value)">
              <option value="">جميع المجاميع</option>
              ${groupList.map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`).join('')}
            </select>
          </div>
        </div>

        <!-- Table of Students with Checkboxes -->
        <div style="overflow-x: auto;">
          <table class="data-table" id="cardsTable">
            <thead>
              <tr>
                <th style="width: 40px; text-align: center;">
                  <input type="checkbox" id="cardMasterCheckbox" onchange="window.centrlyApp.toggleMasterCardCheckbox(this.checked)">
                </th>
                <th>كود الطالب</th>
                <th>اسم الطالب</th>
                <th>المجموعة</th>
                <th>رقم هاتف الطالب</th>
                <th>رقم ولي الأمر</th>
                <th>معاينة</th>
              </tr>
            </thead>
            <tbody>
              ${studentList.length > 0 ? studentList.map((s, idx) => {
                const matchedGroup = groupList.find(g => g.id === s.group_id || g.id === s.groupId);
                const groupName = s.group_name || s.groupName || matchedGroup?.name || 'مجموعة عامة';
                const sCode = s.code || s.student_code || `STU-${idx + 1001}`;
                return `
                <tr data-student-id="${escapeHtml(s.id)}" data-group-id="${escapeHtml(s.group_id || matchedGroup?.id || '')}">
                  <td style="text-align: center;">
                    <input type="checkbox" class="student-card-check" value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-code="${escapeHtml(sCode)}" data-group="${escapeHtml(groupName)}" data-phone="${escapeHtml(s.student_phone || '')}" data-parent-phone="${escapeHtml(s.parent_phone || '')}" onchange="window.centrlyApp.updateSelectedCardsCount()">
                  </td>
                  <td style="font-family: monospace; font-weight: 700; color: var(--centrly-blue-800);">${escapeHtml(sCode)}</td>
                  <td style="font-weight: 700;">${escapeHtml(s.name)}</td>
                  <td><span class="badge badge-blue">${escapeHtml(groupName)}</span></td>
                  <td dir="ltr" style="text-align: right; font-family: monospace;">${escapeHtml(s.student_phone || '—')}</td>
                  <td dir="ltr" style="text-align: right; font-family: monospace;">${escapeHtml(s.parent_phone || '—')}</td>
                  <td>
                    <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.previewSpecificCard('${escapeHtml(s.name)}', '${escapeHtml(sCode)}', '${escapeHtml(groupName)}', '${escapeHtml(s.student_phone || s.parent_phone || '')}')" style="display: flex; align-items: center; gap: 0.35rem;">
                      ${getIcon('eye', 14)}
                      <span>معاينة</span>
                    </button>
                  </td>
                </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
                    لا يوجد طلاب مسجلون حالياً. توجه إلى "دليل الطلاب والتسجيل" لإضافة الطلاب أولاً.
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
