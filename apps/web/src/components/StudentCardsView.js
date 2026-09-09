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
          <div style="max-width: 650px;">
            <div style="display: inline-flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.15); padding: 0.25rem 0.75rem; border-radius: 20px; font-size: 0.78rem; font-weight: 600; margin-bottom: 0.6rem;">
              <span>${getIcon('cards', 16, '#ffffff')}</span>
              <span>خدمة طباعة الكروت الرسمية للطلاب</span>
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 800; margin: 0; color: #ffffff;">طباعة كروت الطلاب</h2>
            <p style="font-size: 0.875rem; color: rgba(255,255,255,0.9); margin-top: 0.4rem; line-height: 1.6;">
              اطبع كروت ورقية فورية بجودة عالية للباركود، أو اطلب كروت بلاستيكية فاخرة (PVC ID Cards) ضد التلف والماء مع شعار السنتر والمدرس لطلبتك بأسعار خاصة للمشتركين.
            </p>
          </div>

          <!-- Order Plastic Cards WhatsApp Button -->
          <div style="text-align: center;">
            <a href="https://wa.me/201123671177?text=${encodeURIComponent('مرحباً، أرغب في الاستفسار عن طباعة كروت الطلاب البلاستيكية الذكية لمنظومتي في سنترلي')}" target="_blank" rel="noopener noreferrer" class="btn" style="background: #25d366; color: #ffffff; font-weight: 800; padding: 0.85rem 1.4rem; border-radius: 10px; display: inline-flex; align-items: center; gap: 0.6rem; text-decoration: none; box-shadow: 0 4px 15px rgba(37,211,102,0.35); transition: transform 0.2s;">
              ${getIcon('whatsapp', 20, '#ffffff')}
              <span style="font-size: 0.95rem;">طلب كروت بلاستيكية (واتساب)</span>
            </a>
            <div style="font-size: 0.72rem; color: rgba(255,255,255,0.8); margin-top: 0.4rem;">
              تواصل مباشر مع الإدارة لمعرفة الأسعار والكميات
            </div>
          </div>
        </div>
      </div>

      <!-- Live Card Preview Showcase -->
      <div class="card" style="margin: 0; background: #f8fafc; border: 1px solid var(--centrly-line);">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; flex-wrap: wrap; gap: 0.5rem;">
          <div>
            <h3 style="font-size: 1.05rem; font-weight: 700; color: var(--centrly-ink); margin: 0; display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('cards', 18, 'var(--centrly-blue-700)')}</span>
              <span>معاينة حية لشكل الكارت (Card Live Preview)</span>
            </h3>
            <p style="font-size: 0.775rem; color: var(--centrly-text); margin: 0.2rem 0 0 0;">
              هذا هو الشكل النهائي للكارت عند الطباعة أو الاستلام، يتضمن شعار المنصة، بيانات الطالب، والباركود الشريطي
            </p>
          </div>
          <div style="font-size: 0.8rem; color: var(--centrly-text); background: #ffffff; padding: 0.3rem 0.75rem; border-radius: 6px; border: 1px solid var(--centrly-line);">
            المقاس المعتمد: <b>85 × 54 مم (CR80 Standard)</b>
          </div>
        </div>

        <!-- The Physical Card Mockup Container -->
        <div style="display: flex; justify-content: center; padding: 1rem 0;">
          <div id="cardLivePreview" style="width: 380px; height: 230px; background: linear-gradient(145deg, #0f172a, #1e293b); border-radius: 14px; padding: 1.25rem; color: #ffffff; box-shadow: 0 15px 35px rgba(15,23,42,0.25); display: flex; flex-direction: column; justify-content: space-between; position: relative; overflow: hidden; border: 1px solid rgba(255,255,255,0.1);">
            
            <!-- Decorative Hologram Corner -->
            <div style="position: absolute; top: -30px; left: -30px; width: 100px; height: 100px; background: radial-gradient(circle, rgba(245,158,11,0.25) 0%, rgba(245,158,11,0) 70%); border-radius: 50%;"></div>
            <div style="position: absolute; bottom: -30px; right: -30px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(37,99,235,0.25) 0%, rgba(37,99,235,0) 70%); border-radius: 50%;"></div>

            <!-- Card Top Row: Branding -->
            <div style="display: flex; justify-content: space-between; align-items: center; z-index: 2;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div style="width: 28px; height: 28px; background: linear-gradient(135deg, #1e3a8a, #2563eb); border-radius: 7px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(37,99,235,0.4);">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none">
                    <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" fill="#F59E0B"/>
                    <path d="M12 15L3 10.09L12 5.18L21 10.09L12 15Z" fill="#FFFFFF"/>
                  </svg>
                </div>
                <div>
                  <div style="font-family: 'Changa', sans-serif; font-size: 0.95rem; font-weight: 800; line-height: 1;">
                    <span style="color: #60a5fa;">سنتر</span><span style="color: #f59e0b;">لي</span>
                  </div>
                  <div style="font-size: 0.58rem; color: #94a3b8; letter-spacing: 0.5px;">SMART ID PASS</div>
                </div>
              </div>
              
              <div style="text-align: left; z-index: 2;">
                <div id="previewTeacherName" style="font-size: 0.8rem; font-weight: 700; color: #f8fafc;">${escapeHtml(teacherOrCenterName)}</div>
                <div style="font-size: 0.65rem; color: #94a3b8;">${escapeHtml(userRoleTitle)}</div>
              </div>
            </div>

            <!-- Card Middle Row: Student Info -->
            <div style="display: flex; align-items: center; gap: 0.85rem; margin: 0.5rem 0; z-index: 2;">
              <div style="width: 54px; height: 54px; border-radius: 10px; background: #334155; border: 2px solid rgba(255,255,255,0.2); display: flex; align-items: center; justify-content: center; font-size: 1.4rem; color: #f8fafc; font-weight: 700;">
                <span id="previewStudentInitial">${defaultStudent.name?.charAt(0) || 'ط'}</span>
              </div>
              <div style="flex: 1;">
                <div id="previewStudentName" style="font-size: 1.05rem; font-weight: 800; color: #ffffff; letter-spacing: -0.3px; line-height: 1.2;">
                  ${escapeHtml(defaultStudent.name)}
                </div>
                <div style="display: flex; gap: 0.4rem; align-items: center; margin-top: 0.25rem;">
                  <span style="background: rgba(37,99,235,0.3); color: #93c5fd; border: 1px solid rgba(59,130,246,0.3); font-size: 0.68rem; padding: 0.1rem 0.45rem; border-radius: 4px; font-weight: 600;">
                    <span id="previewStudentGroup">المجموعة الأساسية</span>
                  </span>
                  <span id="previewStudentPhone" style="font-size: 0.68rem; color: #cbd5e1; font-family: monospace;">
                    ${escapeHtml(defaultStudent.student_phone || defaultStudent.parent_phone || '')}
                  </span>
                </div>
              </div>
            </div>

            <!-- Card Bottom Row: Barcode Display -->
            <div style="background: #ffffff; border-radius: 8px; padding: 0.45rem 0.75rem; display: flex; justify-content: space-between; align-items: center; z-index: 2;">
              <!-- Visual Barcode Lines -->
              <div style="display: flex; align-items: center; gap: 2px; height: 26px;">
                <span style="width: 2px; height: 26px; background: #000000;"></span>
                <span style="width: 1px; height: 26px; background: #000000;"></span>
                <span style="width: 3px; height: 26px; background: #000000;"></span>
                <span style="width: 1px; height: 26px; background: #000000;"></span>
                <span style="width: 2px; height: 26px; background: #000000;"></span>
                <span style="width: 4px; height: 26px; background: #000000;"></span>
                <span style="width: 1px; height: 26px; background: #000000;"></span>
                <span style="width: 2px; height: 26px; background: #000000;"></span>
                <span style="width: 3px; height: 26px; background: #000000;"></span>
                <span style="width: 2px; height: 26px; background: #000000;"></span>
                <span style="width: 1px; height: 26px; background: #000000;"></span>
                <span style="width: 3px; height: 26px; background: #000000;"></span>
                <span style="width: 2px; height: 26px; background: #000000;"></span>
                <span style="width: 4px; height: 26px; background: #000000;"></span>
                <span style="width: 1px; height: 26px; background: #000000;"></span>
                <span style="width: 2px; height: 26px; background: #000000;"></span>
                <span style="width: 3px; height: 26px; background: #000000;"></span>
                <span style="width: 1px; height: 26px; background: #000000;"></span>
                <span style="width: 2px; height: 26px; background: #000000;"></span>
              </div>
              <div style="text-align: left;">
                <div id="previewStudentCode" style="font-family: monospace; font-size: 0.95rem; font-weight: 900; color: #0f172a; letter-spacing: 1px;">
                  ${escapeHtml(defaultStudent.code || defaultStudent.student_code || 'STU-1042')}
                </div>
                <div style="font-size: 0.55rem; color: #64748b; text-align: right;">مسح الحضور السريع</div>
              </div>
            </div>

          </div>
        </div>
      </div>

      <!-- Selective Printing Controls & Student Table -->
      <div class="card" style="margin: 0;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; margin-bottom: 1.25rem;">
          <div>
            <h3 style="font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin: 0;">تحديد الطلاب للطباعة</h3>
            <p style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.2rem;">
              يمكنك اختيار مجموعة كاملة، أو تحديد عدد معين من الطلاب للطباعة، أو طباعة كافة الطلاب
            </p>
          </div>

          <!-- Print & Order Action Buttons -->
          <div style="display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap;">
            <div id="selectedCardsCountBadge" class="badge badge-blue" style="font-size: 0.825rem; padding: 0.4rem 0.75rem;">
              تم تحديد: 0 طالب
            </div>
            <button class="btn" style="background: #25d366; color: #ffffff; border: none; display: flex; align-items: center; gap: 0.4rem; font-weight: 700; padding: 0.45rem 0.9rem; border-radius: 8px;" onclick="window.centrlyApp.orderSelectedCardsViaWhatsApp()">
              ${getIcon('whatsapp', 18, '#ffffff')}
              <span>طلب طباعة الكروت المحددة (واتساب)</span>
            </button>
            <button class="btn btn-primary" onclick="window.centrlyApp.printSelectedCards()" style="display: flex; align-items: center; gap: 0.4rem; font-weight: 700;">
              ${getIcon('print', 18)}
              <span>طباعة ورقية فورية (A4)</span>
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
                    <input type="checkbox" class="student-card-check" value="${escapeHtml(s.id)}" data-name="${escapeHtml(s.name)}" data-code="${escapeHtml(sCode)}" data-group="${escapeHtml(groupName)}" data-phone="${escapeHtml(s.student_phone || s.parent_phone || '')}" onchange="window.centrlyApp.updateSelectedCardsCount()">
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
