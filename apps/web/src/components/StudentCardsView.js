import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { renderStudentBarcodeCardHtml } from "../utils/studentBarcodeCard.js";

/**
 * Centrly Student Cards Printing Component (DEV-89)
 * Name: طباعة كروت الطلاب
 * Features:
 *  - Interactive live card preview with Centrly V2 flat branding (Front Only)
 *  - Upsell banner for plastic PVC ID cards linking to WhatsApp 01123671177
 *  - Selective batch printing (all, by group, or selected checkboxes)
 */

export function renderStudentCardsView(students = [], groups = [], user = {}) {
  const studentList = students || [];
  const groupList = groups || [];
  const defaultStudent = studentList[0] || {
    id: 'sample',
    name: 'أحمد محمود',
    code: '1005',
    student_code: '1005',
    parent_phone: '01012345678',
    student_phone: '01123456789',
  };

  const teacherOrCenterName = user?.name || (user?.account_type === 'center' ? 'سنتر التفوق التعليمي' : 'أ. محمد خالد');
  const userRoleTitle = user?.account_type === 'center' ? 'السنتر التعليمي' : 'مدرس المادة';
  const sampleGroupName = groupList.find(g => g.id === defaultStudent.group_id)?.name || defaultStudent.group_name || 'فيزياء — تالتة ثانوي';

  const sampleStudentObj = {
    name: defaultStudent.name,
    student_code: defaultStudent.code || defaultStudent.student_code || '1005',
    code: defaultStudent.code || defaultStudent.student_code || '1005',
    group_name: sampleGroupName,
    teacher_name: teacherOrCenterName,
  };

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" id="studentCardsContainer">
      
      <!-- Top Section: Direct Plastic Card Order Banner & Live Card Preview -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 1.5rem; align-items: stretch;">
        
        <!-- Plastic Card Order Info Banner -->
        <div class="card" style="margin: 0; background: linear-gradient(135deg, #172D70, #1e3a8a); color: #ffffff; border: none; box-shadow: 0 10px 25px rgba(23,45,112,0.25); display: flex; flex-direction: column; justify-content: space-between;">
          <div>
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.15); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.78rem; font-weight: 700; margin-bottom: 0.6rem;">
              <span>${getIcon('cards', 16, '#ffffff')}</span>
              <span>بطاقات الحضور الذكية (CR80 القياسية)</span>
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: #ffffff;">كروت الطلاب الذكية والباركود المعتمد</h2>
            <div style="font-size: 0.85rem; color: rgba(255,255,255,0.95); margin-top: 0.6rem; line-height: 1.6; background: rgba(0,0,0,0.2); padding: 0.75rem 1rem; border-radius: 8px;">
              <strong style="color: #FDE68A;">خطوات طلب الكروت البلاستيكية الذكية (PVC):</strong>
              <ol style="margin: 0.35rem 0 0 0; padding-right: 1.2rem; font-size: 0.82rem; color: #f1f5f9;">
                <li>حدد الطلاب المطلوب إصدار كروت لهم من الجدول أدناه (أو اضغط "تحديد الكل").</li>
                <li>اضغط على زر <b>"تصدير بيانات الكروت (Excel / CSV)"</b> لتحميل ملف الطلاب وأكوادهم بصيغة منظمة.</li>
                <li>أرسل الملف المُحمّل إلى فريق سنترلي عبر <b>واتساب الإدارة</b> بالزر أدناه لاختيار خامة وجودة الكارت وتأكيد الكمية والطلب.</li>
                <li>يتم تجهيز وطباعة الكروت البلاستيكية الفاخرة وشحنها مباشرة إلى مقر السنتر أو المعلم في أسرع وقت.</li>
              </ol>
            </div>
          </div>

          <!-- Order Plastic Cards WhatsApp Button -->
          <div style="margin-top: 1rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem;">
            <a href="https://wa.me/201123671177?text=${encodeURIComponent('السلام عليكم، جهزت ملف بيانات كروت الطلاب من سنترلي وعايز أرسله علشان نطلب كروت بلاستيكية PVC.')}" target="_blank" rel="noopener noreferrer" class="btn" style="background: #25d366; color: #ffffff; font-weight: 800; padding: 0.75rem 1.35rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.6rem; text-decoration: none; box-shadow: 0 4px 15px rgba(37,211,102,0.35); transition: transform 0.2s;">
              ${getIcon('whatsapp', 20, '#ffffff')}
              <span style="font-size: 0.92rem;">طلب كروت بلاستيكية (واتساب)</span>
            </a>
            <span style="font-size: 0.75rem; color: rgba(255,255,255,0.85);">
              طباعة بلاستيكية PVC عالية الجودة ومقاومة للماء
            </span>
          </div>
        </div>

        <!-- Live V2 Card Preview (Front Only) -->
        <div class="card" style="margin: 0; background: #ffffff; display: flex; flex-direction: column; justify-content: center; align-items: center; border: 1.5px solid #e2e8f0;">
          <div style="font-size: 0.82rem; font-weight: 800; color: #172D70; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background-color: #E7A330;"></span>
            <span>معاينة مباشرة لتصميم الكارت الجديد (V2 - ألوان مسطحة)</span>
          </div>
          ${renderStudentBarcodeCardHtml(sampleStudentObj)}
        </div>

      </div>

      <!-- Selective Printing Controls & Student Table -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0;">تحديد الطلاب وتصدير بيانات الكروت</h3>
            <p style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.2rem;">
              حدد الطلاب المطلوب إصدار كروت لهم ثم صدّر الملف لإرساله للإدارة عبر واتساب
            </p>
          </div>

          <!-- Action Buttons -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <div id="selectedCardsCountBadge" class="badge badge-blue" style="font-size: 0.825rem; padding: 0.4rem 0.75rem;">
              تم تحديد: 0 طالب
            </div>
            <button class="btn" style="background: #10b981; color: #ffffff; display: flex; align-items: center; gap: 0.45rem; font-weight: 800; padding: 0.5rem 1.1rem; border-radius: 8px; border: none; box-shadow: 0 2px 6px rgba(16,185,129,0.3); cursor: pointer;" onclick="window.centrlyApp.downloadSelectedCardsDataExcel()">
              ${getIcon('download', 18, '#ffffff')}
              <span>تصدير بيانات الكروت (Excel / CSV)</span>
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
