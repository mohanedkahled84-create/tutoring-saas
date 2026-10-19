import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { renderStudentBarcodeCardHtml, generateBarcode128Svg, cleanTeacherNameString } from "../utils/studentBarcodeCard.js";

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
      
      <!-- Top Section: Direct Plastic Card Order Banner -->
      <div>
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
                </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 2.5rem; color: var(--centrly-text);">
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

export function registerStudentCardsActions(app) {
  // Student Cards Printing & Download Flow
  // ==========================================================================

  app.downloadSelectedCardsDataExcel = function() {
    const checkedBoxes = Array.from(document.querySelectorAll('.student-card-check:checked'));
    let targetStudents = [];

    if (checkedBoxes.length > 0) {
      targetStudents = checkedBoxes.map(cb => ({
        id: cb.value,
        name: cb.getAttribute('data-name') || '',
        code: cb.getAttribute('data-code') || '',
        group: cb.getAttribute('data-group') || '',
        phone: cb.getAttribute('data-phone') || '',
        parent_phone: cb.getAttribute('data-parent-phone') || '',
      }));
    } else {
      const rows = Array.from(document.querySelectorAll('#cardsTable tbody tr[data-student-id]'));
      if (rows.length === 0) {
        this.showToast('لا يوجد طلاب لتنزيل بياناتهم. يرجى إضافة طلاب أولاً.', 'warning');
        return;
      }
      targetStudents = rows.map(r => {
        const cb = r.querySelector('.student-card-check');
        return {
          id: r.getAttribute('data-student-id'),
          name: cb?.getAttribute('data-name') || r.cells[2]?.textContent.trim() || '',
          code: cb?.getAttribute('data-code') || r.cells[1]?.textContent.trim() || '',
          group: cb?.getAttribute('data-group') || r.cells[3]?.textContent.trim() || '',
          phone: cb?.getAttribute('data-phone') || r.cells[4]?.textContent.trim() || '',
          parent_phone: cb?.getAttribute('data-parent-phone') || r.cells[5]?.textContent.trim() || '',
        };
      });
    }

    // CSV header & rows with UTF-8 BOM for Arabic Excel & Canva/Photoshop Data Merge compatibility
    const header = ['كود الطالب', 'اسم الطالب', 'المجموعة الدراسية', 'رقم هاتف الطالب', 'رقم ولي الأمر', 'كود الباركود'];
    const rows = targetStudents.map(s => [
      `"${(s.code || '').replace(/"/g, '""')}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.group || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.parent_phone || '').replace(/"/g, '""')}"`,
      `"${(s.code || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `بيانات_كروت_الطلاب_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`تم تنزيل ملف بيانات (${targetStudents.length}) طالب بنجاح (Excel / CSV) جاهز لبرامج التصميم!`, 'success');
  }

  app.downloadSelectedCardsPdf = function() {
    const checkedBoxes = Array.from(document.querySelectorAll('.student-card-check:checked'));
    let targetStudents = [];

    if (checkedBoxes.length > 0) {
      targetStudents = checkedBoxes.map(cb => ({
        id: cb.value,
        name: cb.getAttribute('data-name') || '',
        code: cb.getAttribute('data-code') || '',
        group: cb.getAttribute('data-group') || '',
        phone: cb.getAttribute('data-phone') || cb.getAttribute('data-parent-phone') || '',
      }));
    } else {
      const rows = Array.from(document.querySelectorAll('#cardsTable tbody tr[data-student-id]'));
      if (rows.length === 0) {
        this.showToast('لا يوجد طلاب لتنزيل كروت لهم. يرجى إضافة طلاب أولاً.', 'warning');
        return;
      }
      targetStudents = rows.map(r => {
        const cb = r.querySelector('.student-card-check');
        return {
          id: r.getAttribute('data-student-id'),
          name: cb?.getAttribute('data-name') || r.cells[2]?.textContent.trim(),
          code: cb?.getAttribute('data-code') || r.cells[1]?.textContent.trim(),
          group: cb?.getAttribute('data-group') || r.cells[3]?.textContent.trim(),
          phone: cb?.getAttribute('data-phone') || r.cells[4]?.textContent.trim(),
        };
      });
    }

    const rawOrgName = this.user?.name || (this.user?.account_type === 'center' ? 'السنتر التعليمي' : 'معلم المادة');
    const orgName = cleanTeacherNameString(rawOrgName);

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.showToast('يرجى السماح بالنوافذ المنبثقة (Pop-ups) لتنزيل ملف الكروت للطباعة', 'warning');
      return;
    }

    const cardsHtml = targetStudents.map(st => {
      const barcodeSvg = generateBarcode128Svg(st.code, { height: 36, unitWidth: 1.8 });

      return `
        <div class="card-box">
          <div>
            <div class="card-header">
              <div class="wordmark"><span>سنتر</span><span style="color: #E7A330;">لـ</span><span>ي</span></div>
              <div class="header-left">
                <div class="card-title">بطاقة حضور الطالب</div>
                <div class="card-sub">STUDENT ID</div>
              </div>
            </div>
            <div class="amber-stripe"></div>
          </div>
          <div class="card-body">
            <div>
              <div class="student-lbl">اسم الطالب</div>
              <div class="student-name">${escapeHtml(st.name)}</div>
            </div>
            <div class="info-pill">
              <div><span style="color: #E7A330;">المدرّس:</span> ${escapeHtml(orgName)}</div>
              <div><span style="color: #E7A330;">المجموعة:</span> ${escapeHtml(st.group || 'عامة')}</div>
            </div>
            <div class="barcode-box">
              <div class="barcode-inner">
                <div class="barcode-prompt">امسح الباركود لتسجيل الحضور</div>
                <div class="barcode-svg-wrap">${barcodeSvg}</div>
              </div>
              <div class="code-badge">
                <div class="code-badge-lbl">رقم الطالب</div>
                <div class="code-badge-val">${escapeHtml(st.code)}</div>
              </div>
            </div>
          </div>
          <div class="card-footer">مخصصة للحضور — استخدمها في بداية كل حصة</div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كروت الطلاب للطباعة - سنترلي (${targetStudents.length} طالب)</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@600;700;800;900&family=Changa:wght@700;800;900&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body {
            font-family: 'Cairo', Tahoma, Arial, sans-serif;
            background: #f1f5f9;
            padding: 20px;
            color: #0f172a;
          }
          .no-print-bar {
            background: #172D70;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .print-btn {
            background: #E7A330;
            color: #0f172a;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 15px;
            font-weight: 800;
            cursor: pointer;
            font-family: inherit;
          }
          .cards-grid {
            display: grid;
            grid-template-columns: repeat(2, 85.6mm);
            gap: 8mm;
            justify-content: center;
          }
          .card-box {
            width: 85.6mm;
            height: 54mm;
            background-color: #172D70;
            border: 1.5px solid #2949BA;
            border-radius: 12px;
            overflow: hidden;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            page-break-inside: avoid;
            box-shadow: 0 4px 12px rgba(23,45,112,0.15);
            color: #ffffff;
          }
          .card-header {
            background-color: #2949BA;
            padding: 4px 10px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .wordmark {
            font-family: 'Changa', 'Cairo', sans-serif;
            font-size: 15px;
            font-weight: 900;
            color: #ffffff;
          }
          .header-left {
            text-align: left;
          }
          .card-title {
            font-size: 9px;
            font-weight: 800;
            color: #ffffff;
            line-height: 1.2;
          }
          .card-sub {
            font-size: 6.5px;
            font-weight: 900;
            color: #E8EDFF;
            letter-spacing: 0.5px;
          }
          .amber-stripe {
            width: 100%;
            height: 2.5px;
            background-color: #E7A330;
          }
          .card-body {
            padding: 4px 10px;
            display: flex;
            flex-direction: column;
            justify-content: space-around;
            flex-grow: 1;
            gap: 3px;
          }
          .student-lbl {
            font-size: 7.5px;
            font-weight: 700;
            color: #E8EDFF;
          }
          .student-name {
            font-family: 'Changa', 'Cairo', sans-serif;
            font-size: 13.5px;
            font-weight: 900;
            color: #ffffff;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
            line-height: 1.2;
          }
          .info-pill {
            background-color: #1f3688;
            border: 1px solid #2e4ebd;
            border-radius: 5px;
            padding: 2.5px 6px;
            display: flex;
            flex-direction: column;
            gap: 2px;
            font-size: 7.5px;
            font-weight: 700;
            color: #ffffff;
          }
          .barcode-box {
            background-color: #ffffff;
            border-radius: 6px;
            padding: 3px 5px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 5px;
          }
          .barcode-inner {
            flex-grow: 1;
            display: flex;
            flex-direction: column;
            align-items: center;
            overflow: hidden;
          }
          .barcode-prompt {
            font-size: 6.5px;
            color: #475569;
            font-weight: 700;
            margin-bottom: 1px;
          }
          .barcode-svg-wrap {
            width: 100%;
            display: flex;
            justify-content: center;
          }
          .code-badge {
            background-color: #E7A330;
            border-radius: 5px;
            padding: 2px 5px;
            text-align: center;
            min-width: 55px;
            flex-shrink: 0;
          }
          .code-badge-lbl {
            font-size: 6.5px;
            font-weight: 900;
            color: #0f172a;
            line-height: 1;
          }
          .code-badge-val {
            font-family: monospace;
            font-size: 11.5px;
            font-weight: 900;
            color: #020617;
            line-height: 1.2;
          }
          .card-footer {
            background-color: #122359;
            color: #cbd5e1;
            font-size: 7px;
            font-weight: 700;
            text-align: center;
            padding: 2px;
          }
          @media print {
            body { background: white; padding: 0; }
            .no-print-bar { display: none; }
            .cards-grid {
              gap: 4mm;
            }
            .card-box {
              box-shadow: none;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <strong>جاهز للطباعة أو التنزيل كـ PDF:</strong> تم تجهيز كروت (${targetStudents.length}) طالب مع الأكواد والباركود.
          </div>
          <button class="print-btn" onclick="window.print()">طباعة / حفظ كـ PDF</button>
        </div>
        <div class="cards-grid">
          ${cardsHtml}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    this.showToast(`تم فتح وتجهيز كروت (${targetStudents.length}) طالب للطباعة / التنزيل بنجاح!`, 'success');
  }

  app.selectAllCards = function(selectAll) {
    const checkboxes = document.querySelectorAll('.student-card-check');
    checkboxes.forEach(cb => cb.checked = Boolean(selectAll));
    const master = document.getElementById('cardMasterCheckbox');
    if (master) master.checked = Boolean(selectAll);
    this.updateSelectedCardsCount();
  }

  app.toggleMasterCardCheckbox = function(checked) {
    this.selectAllCards(checked);
  }

  app.updateSelectedCardsCount = function() {
    const count = document.querySelectorAll('.student-card-check:checked').length;
    const badge = document.getElementById('selectedCardsCountBadge');
    if (badge) {
      badge.textContent = `تم تحديد: ${count} طالب`;
    }
  }

  app.filterCardsTable = function() {
    const q = document.getElementById('cardSearchInput')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#cardsTable tbody tr[data-student-id]');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    });
  }

  app.filterCardsByGroup = function(groupId) {
    const rows = document.querySelectorAll('#cardsTable tbody tr[data-student-id]');
    rows.forEach(r => {
      if (!groupId) {
        r.style.display = '';
      } else {
        const rowGrp = r.getAttribute('data-group-id');
        r.style.display = (rowGrp === groupId) ? '' : 'none';
      }
    });
  }


  app.openCardsWhatsAppDispatchModal = function() {
    this.downloadSelectedCardsPdf();
  }
}
