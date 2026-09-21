import { escapeHtml } from "./escapeHtml.js";
import { getIcon } from "./icons.js";

// Standard ISO/IEC 15417 Code 128 (Subset B) Patterns
const CODE128_PATTERNS = [
  "212222", "222122", "222221", "121223", "121322", "131222", "122213", "122312", "132212", "221213",
  "221312", "231212", "112232", "122132", "122231", "113222", "123122", "123221", "223211", "221132",
  "221231", "213212", "223112", "312131", "311222", "321122", "321221", "312212", "322112", "322211",
  "212123", "212321", "232121", "111323", "131123", "131321", "112313", "132113", "132311", "211313",
  "231113", "231311", "112133", "112331", "132131", "113123", "113321", "133121", "313121", "211331",
  "231131", "213113", "213311", "213131", "311123", "311321", "331121", "312113", "312311", "332111",
  "314111", "221411", "431111", "111224", "111422", "121124", "121421", "141122", "141221", "112214",
  "112412", "122114", "122411", "142112", "142211", "241211", "221114", "413111", "241112", "134111",
  "111242", "121142", "121241", "114212", "124112", "124211", "411212", "421112", "421211", "212141",
  "214121", "412121", "111143", "111341", "131141", "114113", "114311", "411113", "411311", "113141",
  "114131", "311141", "411131", "211412", "211214", "211232", "2331112"
];

/**
 * Generate standard Code 128B pattern string
 */
export function encodeCode128B(text) {
  let cleanText = String(text || "").trim();
  if (!cleanText) cleanText = "0000";

  let codes = [104]; // Start Code B
  let sum = 104;

  for (let i = 0; i < cleanText.length; i++) {
    const codeVal = cleanText.charCodeAt(i) - 32;
    const safeVal = (codeVal >= 0 && codeVal <= 94) ? codeVal : 0;
    codes.push(safeVal);
    sum += safeVal * (i + 1);
  }

  codes.push(sum % 103); // Checksum
  codes.push(106); // Stop Code

  let patternStr = "";
  for (const code of codes) {
    patternStr += CODE128_PATTERNS[code];
  }

  return { codes, patternStr, cleanText };
}

/**
 * Generates an SVG string of a crisp, scannable Code 128 barcode
 */
export function generateBarcode128Svg(text, options = {}) {
  const height = options.height || 80;
  const quietZone = options.quietZone !== undefined ? options.quietZone : 10;
  const unitWidth = options.unitWidth || 2.5;

  const { patternStr } = encodeCode128B(text);

  let rects = [];
  let currentUnit = quietZone;

  for (let p = 0; p < patternStr.length; p++) {
    const w = parseInt(patternStr[p], 10);
    const isBar = (p % 2 === 0);
    if (isBar) {
      rects.push("<rect x=\"" + (currentUnit * unitWidth).toFixed(1) + "\" y=\"0\" width=\"" + (w * unitWidth).toFixed(1) + "\" height=\"" + height + "\" fill=\"#000000\"/>");
    }
    currentUnit += w;
  }

  currentUnit += quietZone;
  const totalWidth = (currentUnit * unitWidth).toFixed(1);

  return (
    "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 " + totalWidth + " " + height + "\" style=\"width: 100%; max-width: 100%; height: " + height + "px; display: block; shape-rendering: crispEdges;\">" +
      "<rect width=\"" + totalWidth + "\" height=\"" + height + "\" fill=\"#ffffff\"/>" +
      rects.join("") +
    "</svg>"
  );
}

/**
 * Cleans the teacher's name by stripping system suffixes like "- منظومة تعليمية", "- منظومة...", "- سنترلي...", etc.
 */
export function cleanTeacherNameString(rawName) {
  let name = String(rawName || "").trim();
  if (!name || name === "معلم المادة" || name === "أستاذ المادة") {
    return "معلم المادة";
  }
  // Strip any corporate or system suffix
  name = name.replace(/\s*[-–—|]\s*(منظومة|منظر|سنترلي|أكاديمية|سنتر|منصه|منصة).*/i, "")
             .replace(/\s*[-–—|]\s*.*منظومة.*/i, "")
             .trim();
  return name || rawName || "معلم المادة";
}

/**
 * Renders the complete, responsive Student Barcode ID Card HTML (V2 CR80 Landscape)
 * Flat colors only (Navy #172D70, Royal Blue #2949BA, Amber #E7A330, White).
 * Strictly renders FRONT ONLY for site and preview modals as requested.
 */
export function renderStudentBarcodeCardHtml(student = {}, options = {}) {
  const studentCode = student.student_code || student.code || "—";
  const studentName = student.name || "طالب";
  const groupName = (student.group_name || student.group || "").trim();
  let subjectName = (student.subject_name || student.subject || "").trim();
  if (subjectName.includes("مجموع") || subjectName === groupName) {
    subjectName = "";
  }
  const rawTeacherName = student.teacher_name || options.teacherName || student.center_name || "معلم المادة";
  const cleanTeacherName = cleanTeacherNameString(rawTeacherName);

  let groupLabel = "المجموعة";
  let groupDisplayText = groupName || "المجموعة الدراسية";

  if (subjectName && groupName && subjectName !== groupName) {
    groupDisplayText = `${groupName} • المادة: ${subjectName}`;
  } else if (subjectName && !groupName) {
    groupLabel = "المادة";
    groupDisplayText = subjectName;
  }

  // High-contrast Code 128 barcode for instant scanner readability
  const barcodeSvg = generateBarcode128Svg(studentCode, { height: 40, unitWidth: 2.0 });
  const cardId = "student-card-" + Math.random().toString(36).substring(2, 9);
  const studentJsonAttr = JSON.stringify(student).replace(/"/g, "&quot;");

  return `
    <div class="student-id-card-wrapper" style="direction: rtl; font-family: 'Cairo', system-ui, -apple-system, sans-serif; width: 100%; max-width: 440px; margin: 0 auto;">
      <!-- V2 Bold Student Attendance ID Card (Front Only - CR80 Landscape) -->
      <div id="${cardId}" class="centrly-student-card" style="
        background-color: #172D70;
        border: 2px solid #2949BA;
        border-radius: 16px;
        color: #ffffff;
        position: relative;
        overflow: hidden;
        display: flex;
        flex-direction: column;
        justify-content: space-between;
        min-height: 236px;
        aspect-ratio: 85.6 / 55;
        box-sizing: border-box;
        box-shadow: 0 10px 25px rgba(23, 45, 112, 0.25);
      ">
        <!-- 1. Top Header: Solid Royal Blue #2949BA + Flat Amber Stripe #E7A330 -->
        <div>
          <div style="background-color: #2949BA; padding: 0.55rem 1rem 0.45rem; display: flex; justify-content: space-between; align-items: center;">
            <!-- Right: Arabic Wordmark "سنترلي" with amber "ل" -->
            <div style="display: flex; flex-direction: column; align-items: flex-start; line-height: 1;">
              <div style="font-family: 'Changa', 'Cairo', sans-serif; font-size: 1.35rem; font-weight: 900; color: #ffffff; letter-spacing: -0.5px;">
                <span>سنتر</span><span style="color: #E7A330;">لـ</span><span>ي</span>
              </div>
              <div style="width: 24px; height: 3px; background-color: #E7A330; border-radius: 9999px; margin-top: 3px;"></div>
            </div>

            <!-- Left: Card Labels -->
            <div style="text-align: left; display: flex; flex-direction: column; align-items: flex-end;">
              <span style="font-size: 0.82rem; font-weight: 800; color: #ffffff; line-height: 1.2;">بطاقة حضور الطالب</span>
              <span style="font-size: 0.55rem; font-weight: 900; letter-spacing: 1px; color: #E8EDFF; text-transform: uppercase; margin-top: 2px;">STUDENT ID</span>
            </div>
          </div>

          <!-- Flat Amber Divider Line -->
          <div style="width: 100%; height: 3.5px; background-color: #E7A330;"></div>
        </div>

        <!-- 2. Body Details (Solid Navy #172D70) -->
        <div style="padding: 0.45rem 0.85rem 0.55rem; display: flex; flex-direction: column; justify-content: space-between; flex-grow: 1; gap: 0.35rem;">
          
          <!-- Student Name Block -->
          <div>
            <div style="font-size: 0.62rem; font-weight: 700; color: #E8EDFF; opacity: 0.9; margin-bottom: 1px;">اسم الطالب</div>
            <div style="font-family: 'Changa', 'Cairo', sans-serif; font-size: 1.25rem; font-weight: 900; color: #ffffff; line-height: 1.2; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
              ${escapeHtml(studentName)}
            </div>
          </div>

          <!-- Teacher & Group Info (Vertical Stacked Panel - Underneath each other) -->
          <div style="background-color: #1f3688; border: 1px solid #2e4ebd; border-radius: 8px; padding: 0.35rem 0.65rem; display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.72rem; font-weight: 700;">
            <div style="display: flex; align-items: center; gap: 0.35rem; color: #ffffff; min-width: 0;">
              <span style="color: #E7A330; flex-shrink: 0;">المدرّس:</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(cleanTeacherName)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.35rem; color: #ffffff; min-width: 0;">
              <span style="color: #E7A330; flex-shrink: 0;">${groupLabel}:</span>
              <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(groupDisplayText)}</span>
            </div>
          </div>

          <!-- 3. High-Contrast Barcode & Student Code Strip -->
          <div style="background-color: #ffffff; border-radius: 10px; padding: 0.35rem 0.55rem; display: flex; align-items: center; justify-content: space-between; gap: 0.6rem;">
            <!-- Barcode Area -->
            <div style="flex-grow: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden;">
              <span style="font-size: 0.58rem; font-weight: 700; color: #475569; margin-bottom: 2px;">امسح الباركود لتسجيل الحضور</span>
              <div style="width: 100%; display: flex; justify-content: center;">
                ${barcodeSvg}
              </div>
            </div>

            <!-- Amber Student Code Box -->
            <div style="background-color: #E7A330; border-radius: 7px; padding: 0.25rem 0.6rem; display: flex; flex-direction: column; align-items: center; justify-content: center; flex-shrink: 0; min-width: 72px;">
              <span style="font-size: 0.58rem; font-weight: 900; color: #0f172a; line-height: 1;">رقم الطالب</span>
              <span style="font-family: 'Changa', monospace; font-size: 1.15rem; font-weight: 900; color: #020617; line-height: 1.2; margin-top: 2px;">${escapeHtml(studentCode)}</span>
            </div>
          </div>

        </div>
      </div>

      <!-- Action Buttons (Fullscreen / Download) -->
      <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: 0.75rem;">
        <button type="button" 
          onclick="window.centrlyBarcodeCard && window.centrlyBarcodeCard.openFullscreen ? window.centrlyBarcodeCard.openFullscreen(${studentJsonAttr}) : null" 
          class="btn btn-secondary btn-sm"
          style="flex: 1; font-weight: 700; font-size: 0.78rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.5rem 0.75rem; border-radius: 8px;">
          ${getIcon('expand', 14)}
          <span>تكبير للشاشة</span>
        </button>

        <button type="button" 
          onclick="window.centrlyBarcodeCard && window.centrlyBarcodeCard.downloadCardPng ? window.centrlyBarcodeCard.downloadCardPng(${studentJsonAttr}) : null" 
          class="btn btn-sm"
          style="flex: 1; background-color: #E7A330; color: #0f172a; font-weight: 800; font-size: 0.78rem; border: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.5rem 0.75rem; border-radius: 8px; cursor: pointer;">
          ${getIcon('download', 14, '#0f172a')}
          <span>حفظ الكارت (PNG)</span>
        </button>
      </div>
    </div>
  `;
}

/**
 * Renders a clean, lightweight Attendance Pass screen (Zero plastic card styling)
 * Contains:
 * - Prominent screenshot instruction banner (احفظ هذه الشاشة سكرين شوت للدخول للدرس)
 * - Student Name
 * - Student Code in high-visibility badge
 * - Clean high-contrast Barcode
 * - Teacher and Group info
 * - Fullscreen & Download buttons
 */
export function renderStudentAttendancePassHtml(student = {}, options = {}) {
  const studentCode = student.student_code || student.code || "—";
  const studentName = student.name || "طالب";
  const groupName = (student.group_name || student.group || "").trim();
  let subjectName = (student.subject_name || student.subject || "").trim();
  if (subjectName.includes("مجموع") || subjectName === groupName) {
    subjectName = "";
  }
  const rawTeacherName = student.teacher_name || options.teacherName || student.center_name || "معلم المادة";
  const cleanTeacherName = cleanTeacherNameString(rawTeacherName);

  // High-contrast Code 128 barcode for instant scanner readability
  const barcodeSvg = generateBarcode128Svg(studentCode, { height: 50, unitWidth: 2.2 });
  const studentJsonAttr = JSON.stringify(student).replace(/"/g, "&quot;");

  return `
    <div class="student-attendance-pass" style="direction: rtl; font-family: 'Cairo', system-ui, -apple-system, sans-serif; width: 100%; max-width: 420px; margin: 0 auto; background: #ffffff; border: 1.5px solid #e2e8f0; border-radius: 16px; padding: 1.25rem 1.25rem 1rem; box-shadow: 0 4px 20px rgba(0, 0, 0, 0.05); box-sizing: border-box;">
      
      <!-- Top Screenshot Banner Note -->
      <div style="background: #fef3c7; border: 1.5px dashed #f59e0b; border-radius: 12px; padding: 0.65rem 0.85rem; margin-bottom: 1.15rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; text-align: center;">
        <span style="font-size: 1.25rem; flex-shrink: 0;">📸</span>
        <div style="font-size: 0.84rem; font-weight: 800; color: #92400e; line-height: 1.45;">
          احفظ هذه الشاشة (سكرين شوت) للدخول بها إلى الدرس
        </div>
      </div>

      <!-- Student Name -->
      <div style="text-align: center; margin-bottom: 0.75rem;">
        <div style="font-size: 0.75rem; font-weight: 700; color: #64748b; margin-bottom: 0.2rem;">اسم الطالب</div>
        <div style="font-family: 'Cairo', 'Changa', sans-serif; font-size: 1.45rem; font-weight: 900; color: #0f172a; line-height: 1.25; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
          ${escapeHtml(studentName)}
        </div>
      </div>

      <!-- Student Code Badge -->
      <div style="display: flex; justify-content: center; margin-bottom: 1rem;">
        <div style="background: #f1f5f9; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 0.35rem 1.25rem; display: inline-flex; align-items: center; gap: 0.6rem;">
          <span style="font-size: 0.82rem; font-weight: 700; color: #475569;">كود الطالب:</span>
          <span style="font-family: monospace; font-size: 1.4rem; font-weight: 900; color: #1e3a8a; letter-spacing: 1px;">${escapeHtml(studentCode)}</span>
        </div>
      </div>

      <!-- High-Contrast Clean Barcode Box -->
      <div style="background: #ffffff; border: 2px solid #0f172a; border-radius: 12px; padding: 0.85rem 0.6rem 0.65rem; margin-bottom: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center; overflow: hidden;">
        <div style="font-size: 0.72rem; font-weight: 700; color: #64748b; margin-bottom: 0.45rem;">امسح الباركود لتسجيل الحضور</div>
        <div style="width: 100%; display: flex; justify-content: center; overflow: hidden;">
          ${barcodeSvg}
        </div>
      </div>

      <!-- Teacher & Group Info Strip -->
      <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.6rem 0.85rem; margin-bottom: 1rem; display: flex; justify-content: space-around; align-items: center; font-size: 0.8rem; color: #334155; flex-wrap: wrap; gap: 0.5rem; text-align: center;">
        <div>
          <span style="color: #64748b;">المدرّس:</span>
          <strong style="color: #0f172a; margin-right: 0.25rem;">${escapeHtml(cleanTeacherName)}</strong>
        </div>
        ${subjectName ? `
          <div>
            <span style="color: #64748b;">المادة:</span>
            <strong style="color: #0f172a; margin-right: 0.25rem;">${escapeHtml(subjectName)}</strong>
          </div>
        ` : ''}
        <div>
          <span style="color: #64748b;">المجموعة:</span>
          <strong style="color: #0f172a; margin-right: 0.25rem;">${escapeHtml(groupName || 'عامة')}</strong>
        </div>
      </div>

      <!-- Action Buttons (Fullscreen / Download) -->
      <div style="display: flex; gap: 0.5rem; justify-content: center;">
        <button type="button" 
          onclick="window.centrlyBarcodeCard && window.centrlyBarcodeCard.openFullscreen ? window.centrlyBarcodeCard.openFullscreen(${studentJsonAttr}) : null" 
          class="btn btn-secondary btn-sm"
          style="flex: 1; font-weight: 700; font-size: 0.78rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.55rem 0.75rem; border-radius: 8px;">
          ${getIcon('expand', 14)}
          <span>تكبير للشاشة</span>
        </button>

        <button type="button" 
          onclick="window.centrlyBarcodeCard && window.centrlyBarcodeCard.downloadCardPng ? window.centrlyBarcodeCard.downloadCardPng(${studentJsonAttr}) : null" 
          class="btn btn-sm"
          style="flex: 1; background-color: #2563eb; color: #ffffff; font-weight: 800; font-size: 0.78rem; border: none; display: inline-flex; align-items: center; justify-content: center; gap: 0.35rem; padding: 0.55rem 0.75rem; border-radius: 8px; cursor: pointer;">
          ${getIcon('download', 14, '#ffffff')}
          <span>حفظ الباركود (صورة)</span>
        </button>
      </div>

    </div>
  `;
}


/**
 * Downloads high-resolution (CR80 Landscape 1200x757) PNG of the Student Barcode ID Card (V2)
 * Rendered purely on HTML5 Canvas with Flat Colors 100% (Zero Gradients).
 */
export function downloadStudentCardAsPng(student = {}, options = {}) {
  const studentCode = student.student_code || student.code || "0000";
  const studentName = student.name || "طالب";
  const groupName = (student.group_name || student.group || "").trim();
  const subjectName = (student.subject_name || student.subject || "").trim();
  const rawTeacherName = student.teacher_name || options.teacherName || student.center_name || "معلم المادة";
  const cleanTeacherName = cleanTeacherNameString(rawTeacherName);

  let groupLabel = "المجموعة";
  let groupDisplayText = groupName || "المجموعة الدراسية";

  if (subjectName && groupName && subjectName !== groupName) {
    groupDisplayText = `${groupName} • المادة: ${subjectName}`;
  } else if (subjectName && !groupName) {
    groupLabel = "المادة";
    groupDisplayText = subjectName;
  }

  const canvas = document.createElement("canvas");
  // Exact CR80 landscape ratio 85.6mm x 53.98mm (1.5857 : 1)
  const width = 1200;
  const height = 757;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1. Solid Deep Navy Background (Flat Color #172D70 - Zero Gradients)
  ctx.fillStyle = "#172D70";
  ctx.fillRect(0, 0, width, height);

  // Outer Border: Solid Royal Blue #2949BA
  ctx.strokeStyle = "#2949BA";
  ctx.lineWidth = 8;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(4, 4, width - 8, height - 8, 30);
    ctx.stroke();
  } else {
    ctx.strokeRect(4, 4, width - 8, height - 8);
  }

  // 2. Top Header Bar: Solid Royal Blue #2949BA
  ctx.fillStyle = "#2949BA";
  ctx.fillRect(0, 0, width, 140);

  // Flat Amber Stripe #E7A330
  ctx.fillStyle = "#E7A330";
  ctx.fillRect(0, 140, width, 8);

  // Header Right: Arabic Wordmark "سنترلي" with amber "ل"
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.font = "bold 50px Cairo, Tahoma, sans-serif";
  ctx.fillStyle = "#ffffff";
  ctx.fillText("سنتر", width - 60, 90);
  const sentrW = ctx.measureText("سنتر").width;
  ctx.fillStyle = "#E7A330";
  ctx.fillText("لـ", width - 60 - sentrW + 4, 90);
  const lW = ctx.measureText("لـ").width;
  ctx.fillStyle = "#ffffff";
  ctx.fillText("ي", width - 60 - sentrW - lW + 8, 90);

  // Amber underline for logo
  ctx.fillStyle = "#E7A330";
  ctx.fillRect(width - 60 - 80, 106, 80, 5);

  // Header Left: "بطاقة حضور الطالب" & "STUDENT ID"
  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 26px Cairo, Tahoma, sans-serif";
  ctx.fillText("بطاقة حضور الطالب", 60, 75);
  ctx.fillStyle = "#E8EDFF";
  ctx.font = "bold 15px monospace";
  ctx.fillText("STUDENT ID", 60, 105);

  // 3. Student Name Block
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.fillStyle = "#E8EDFF";
  ctx.font = "bold 20px Cairo, Tahoma, sans-serif";
  ctx.fillText("اسم الطالب", width - 60, 195);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 42px Cairo, Tahoma, sans-serif";
  ctx.fillText(studentName, width - 60, 248);

  // 4. Teacher & Group Panel (Solid #1f3688 with #2e4ebd border - Stacked Vertically)
  const panelX = 60;
  const panelY = 275;
  const panelW = width - 120;
  const panelH = 92;

  ctx.fillStyle = "#1f3688";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(panelX, panelY, panelW, panelH, 12);
    ctx.fill();
    ctx.strokeStyle = "#2e4ebd";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillRect(panelX, panelY, panelW, panelH);
  }

  // Row 1: Teacher Name
  ctx.direction = "rtl";
  ctx.textAlign = "right";
  ctx.font = "bold 21px Cairo, Tahoma, sans-serif";
  ctx.fillStyle = "#E7A330";
  ctx.fillText("المدرّس: ", width - 90, panelY + 35);
  const tLabelW = ctx.measureText("المدرّس: ").width;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(cleanTeacherName, width - 90 - tLabelW, panelY + 35);

  // Row 2: Group / Subject Name
  ctx.fillStyle = "#E7A330";
  ctx.fillText(`${groupLabel}: `, width - 90, panelY + 72);
  const gLabelW = ctx.measureText(`${groupLabel}: `).width;
  ctx.fillStyle = "#ffffff";
  ctx.fillText(groupDisplayText, width - 90 - gLabelW, panelY + 72);

  // 5. White Barcode Container Box
  const boxX = 60;
  const boxY = 385;
  const boxW = width - 120;
  const boxH = 265;

  ctx.fillStyle = "#ffffff";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    ctx.fill();
  } else {
    ctx.fillRect(boxX, boxY, boxW, boxH);
  }

  // Label above Barcode
  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#475569";
  ctx.font = "bold 18px Cairo, Tahoma, sans-serif";
  const barcodeCenterX = boxX + (boxW - 250) / 2;
  ctx.fillText("امسح الباركود لتسجيل الحضور", barcodeCenterX, boxY + 38);

  // Barcode Bars inside box
  const { patternStr } = encodeCode128B(studentCode);
  const barcodeHeight = 150;
  const barcodeY = boxY + 55;

  let totalUnits = 20;
  for (let i = 0; i < patternStr.length; i++) {
    totalUnits += parseInt(patternStr[i], 10);
  }
  const maxAvailableWidth = boxW - 320;
  const unitW = Math.min(8, Math.max(3.5, maxAvailableWidth / totalUnits));
  const calculatedBarcodeWidth = totalUnits * unitW;
  const startX = boxX + 40 + (maxAvailableWidth - calculatedBarcodeWidth) / 2 + (10 * unitW);

  ctx.fillStyle = "#000000";
  let curX = startX;
  for (let p = 0; p < patternStr.length; p++) {
    const w = parseInt(patternStr[p], 10) * unitW;
    const isBar = (p % 2 === 0);
    if (isBar) {
      ctx.fillRect(Math.round(curX), barcodeY, Math.round(w), barcodeHeight);
    }
    curX += w;
  }

  // Amber Student Code Box on Right side of the white panel
  const amberBoxW = 200;
  const amberBoxH = boxH - 30;
  const amberBoxX = boxX + boxW - amberBoxW - 15;
  const amberBoxY = boxY + 15;

  ctx.fillStyle = "#E7A330";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(amberBoxX, amberBoxY, amberBoxW, amberBoxH, 12);
    ctx.fill();
  } else {
    ctx.fillRect(amberBoxX, amberBoxY, amberBoxW, amberBoxH);
  }

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#0f172a";
  ctx.font = "bold 20px Cairo, Tahoma, sans-serif";
  ctx.fillText("رقم الطالب", amberBoxX + amberBoxW / 2, amberBoxY + 55);

  ctx.direction = "ltr";
  ctx.fillStyle = "#020617";
  ctx.font = "bold 44px Changa, monospace";
  ctx.fillText(studentCode, amberBoxX + amberBoxW / 2, amberBoxY + 130);

  // 6. Bottom Instruction Footer Strip
  ctx.fillStyle = "#122359";
  ctx.fillRect(0, height - 52, width, 52);

  ctx.direction = "rtl";
  ctx.textAlign = "center";
  ctx.fillStyle = "#cbd5e1";
  ctx.font = "bold 18px Cairo, Tahoma, sans-serif";
  ctx.fillText("مخصصة للحضور — استخدمها في بداية كل حصة", width / 2, height - 20);

  // 7. Trigger Direct Download
  try {
    const dataUrl = canvas.toDataURL("image/png");
    const a = document.createElement("a");
    a.href = dataUrl;
    const safeName = studentName.replace(/[\s\/\\?%*:|"<>]/g, "_");
    a.download = "كارت_حضور_" + safeName + "_" + studentCode + ".png";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  } catch (err) {
    console.error("Failed to export student card canvas:", err);
  }
}

/**
 * Opens a full-screen modal optimized for instant camera/scanner reading with V2 flat design
 */
export function openFullscreenBarcodeModal(student = {}) {
  const studentCode = student.student_code || student.code || "0000";
  const studentName = student.name || "طالب";
  const groupName = (student.group_name || student.group || "").trim();
  const subjectName = (student.subject_name || student.subject || "").trim();
  const rawTeacherName = student.teacher_name || student.center_name || "معلم المادة";
  const cleanTeacherName = cleanTeacherNameString(rawTeacherName);

  let groupLabel = "المجموعة";
  let groupDisplayText = groupName || "المجموعة الدراسية";

  if (subjectName && groupName && subjectName !== groupName) {
    groupDisplayText = `${groupName} • المادة: ${subjectName}`;
  } else if (subjectName && !groupName) {
    groupLabel = "المادة";
    groupDisplayText = subjectName;
  }

  const modalId = "centrly-barcode-fullscreen-modal";
  const existing = document.getElementById(modalId);
  if (existing) existing.remove();

  const barcodeSvg = generateBarcode128Svg(studentCode, { height: 110, unitWidth: 3.2 });
  const studentJsonAttr = JSON.stringify(student).replace(/"/g, "&quot;");

  const modal = document.createElement("div");
  modal.id = modalId;
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100vw;
    height: 100vh;
    background: rgba(15, 23, 42, 0.96);
    backdrop-filter: blur(8px);
    z-index: 99999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 1.5rem;
    direction: rtl;
    font-family: 'Cairo', system-ui, sans-serif;
  `;

  modal.innerHTML = `
    <div style="
      background: #172D70;
      border: 2px solid #2949BA;
      border-radius: 1.25rem;
      max-width: 520px;
      width: 100%;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      position: relative;
    ">
      <!-- Header Bar -->
      <div style="background-color: #2949BA; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; border-bottom: 3.5px solid #E7A330;">
        <div style="font-family: 'Changa', 'Cairo', sans-serif; font-size: 1.5rem; font-weight: 900; color: #ffffff;">
          <span>سنتر</span><span style="color: #E7A330;">لـ</span><span>ي</span>
        </div>
        <button onclick="document.getElementById('${modalId}').remove()" style="
          background: rgba(255, 255, 255, 0.15);
          border: none;
          border-radius: 50%;
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          color: #ffffff;
        ">
          ${getIcon('close', 18, '#ffffff')}
        </button>
      </div>

      <div style="padding: 1.25rem 1.5rem; text-align: center;">
        <h3 style="font-size: 1.4rem; font-weight: 900; color: #ffffff; margin: 0 0 0.35rem 0;">
          ${escapeHtml(studentName)}
        </h3>

        <div style="display: flex; flex-direction: column; gap: 0.25rem; font-size: 0.85rem; color: #E8EDFF; margin-bottom: 1.25rem;">
          <div>المعلم: <b style="color: #E7A330;">${escapeHtml(cleanTeacherName)}</b></div>
          <div>${escapeHtml(groupLabel)}: <b style="color: #E7A330;">${escapeHtml(groupDisplayText)}</b></div>
        </div>

        <!-- High-Contrast Barcode White Panel -->
        <div style="
          background: #ffffff;
          border-radius: 1rem;
          padding: 1.5rem 1rem;
          margin-bottom: 1rem;
        ">
          <div style="width: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
            ${barcodeSvg}
          </div>
          <div style="font-family: 'Changa', monospace; font-size: 1.6rem; font-weight: 900; letter-spacing: 4px; color: #172D70; margin-top: 0.75rem; direction: ltr;">
            ${escapeHtml(studentCode)}
          </div>
        </div>

        <div style="font-size: 0.82rem; font-weight: 700; color: #4ade80; margin-bottom: 1.25rem;">
          ارفع سطوع شاشة الهاتف لتسهيل المسح الضوئي عند مدخل القاعة
        </div>

        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button onclick="window.centrlyBarcodeCard.downloadCardPng(${studentJsonAttr})" style="
            background-color: #E7A330;
            color: #0f172a;
            border: none;
            padding: 0.65rem 1.25rem;
            border-radius: 0.65rem;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
            display: inline-flex;
            align-items: center;
            gap: 0.4rem;
          ">
            ${getIcon('download', 16, '#0f172a')}
            <span>حفظ الصورة في الهاتف</span>
          </button>

          <button onclick="document.getElementById('${modalId}').remove()" style="
            background: rgba(255, 255, 255, 0.15);
            color: #ffffff;
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 0.65rem 1.25rem;
            border-radius: 0.65rem;
            font-weight: 800;
            font-family: inherit;
            cursor: pointer;
          ">
            إغلاق
          </button>
        </div>
      </div>

      <!-- Footer strip -->
      <div style="background-color: #122359; color: #cbd5e1; font-size: 0.65rem; font-weight: 700; text-align: center; padding: 0.35rem;">
        مخصصة للحضور — استخدمها في بداية كل حصة
      </div>
    </div>
  `;

  document.body.appendChild(modal);
}

// Global attachment for click handlers
if (typeof window !== "undefined") {
  window.centrlyBarcodeCard = {
    downloadCardPng: downloadStudentCardAsPng,
    openFullscreen: openFullscreenBarcodeModal,
    renderAttendancePass: renderStudentAttendancePassHtml,
  };
}
