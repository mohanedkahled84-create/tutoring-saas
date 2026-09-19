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
 * Renders the complete, responsive Student Barcode ID Card HTML
 * Matches Centrly brand identity and displays teacher name clearly.
 */
export function renderStudentBarcodeCardHtml(student = {}, options = {}) {
  const studentCode = student.student_code || student.code || "—";
  const studentName = student.name || "طالب";
  const groupName = student.group_name || student.group || "المجموعة الدراسية";
  const teacherName = student.teacher_name || options.teacherName || student.center_name || "معلم المادة";
  const centerName = student.center_name && student.center_name !== teacherName ? student.center_name : "";

  // Full-size, high-contrast Code 128 barcode for instant scanner readability
  const barcodeSvg = generateBarcode128Svg(studentCode, { height: 72, unitWidth: 2.2 });
  const cardId = "student-card-" + Math.random().toString(36).substring(2, 9);
  const studentJsonAttr = JSON.stringify(student).replace(/"/g, "&quot;");

  return `
    <div class="student-id-card-wrapper" style="direction: rtl; font-family: 'Cairo', system-ui, -apple-system, sans-serif; width: 100%; max-width: 385px; margin: 0 auto;">
      <!-- Elegant Modern Student ID Card with Centrly Identity -->
      <div id="${cardId}" class="centrly-student-card" style="
        background: linear-gradient(145deg, #101c44 0%, #172D70 55%, #1e3a8a 100%);
        border: 1.5px solid rgba(245, 158, 11, 0.45);
        border-radius: 1.15rem;
        padding: 1rem 1.15rem 0.95rem;
        color: #ffffff;
        box-shadow: 0 10px 28px rgba(16, 28, 68, 0.4), 0 0 16px rgba(245, 158, 11, 0.1);
        position: relative;
        overflow: hidden;
      ">
        <!-- Ambient Decorative Gold & Blue Auras -->
        <div style="position: absolute; top: -25px; left: -25px; width: 110px; height: 110px; background: radial-gradient(circle, rgba(245, 158, 11, 0.2) 0%, transparent 70%); border-radius: 50%; pointer-events: none;"></div>
        <div style="position: absolute; bottom: -30px; right: -30px; width: 120px; height: 120px; background: radial-gradient(circle, rgba(37, 99, 235, 0.25) 0%, transparent 70%); border-radius: 50%; pointer-events: none;"></div>

        <!-- 1. Top Header: Centrly Brand Badge, Teacher/Center Name, Verified Badge -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem; border-bottom: 1px solid rgba(255,255,255,0.12); padding-bottom: 0.65rem; position: relative; z-index: 2;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div style="width: 36px; height: 36px; background: linear-gradient(135deg, #1e3a8a, #2563eb); border: 1.5px solid rgba(245, 158, 11, 0.6); border-radius: 9px; display: flex; align-items: center; justify-content: center; box-shadow: 0 2px 8px rgba(23, 45, 112, 0.4); flex-shrink: 0;">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" fill="#F59E0B"/>
                <path d="M12 15L3 10.09L12 5.18L21 10.09L12 15Z" fill="#FFFFFF" fill-opacity="0.95"/>
              </svg>
            </div>
            <div>
              <div style="font-family: 'Changa', 'Cairo', sans-serif; font-size: 1rem; font-weight: 800; color: #ffffff; line-height: 1.2;">
                ${escapeHtml(teacherName)}
              </div>
              <div style="font-size: 0.7rem; color: #cbd5e1; font-weight: 600; margin-top: 1px;">
                <span style="color: #F59E0B; font-weight: 700;">سنترلي | Centrly</span> • ${centerName ? `${escapeHtml(centerName)} • ` : ''}بطاقة الطالب الذكية
              </div>
            </div>
          </div>

          <div style="background: rgba(16, 185, 129, 0.18); border: 1px solid rgba(16, 185, 129, 0.5); color: #34d399; font-size: 0.68rem; font-weight: 800; padding: 0.2rem 0.55rem; border-radius: 9999px; display: inline-flex; align-items: center; gap: 0.3rem; white-space: nowrap;">
            <span style="display:inline-block; width: 5px; height: 5px; background: #34d399; border-radius: 50%; box-shadow: 0 0 6px #34d399;"></span>
            <span>كارت معتمد</span>
          </div>
        </div>

        <!-- 2. Student Info Details -->
        <div style="margin-bottom: 0.75rem; position: relative; z-index: 2;">
          <div style="font-size: 0.7rem; color: #FCD34D; font-weight: 700; letter-spacing: 0.3px;">اسم الطالب</div>
          <div style="font-family: 'Changa', 'Cairo', sans-serif; font-size: 1.28rem; font-weight: 900; color: #ffffff; line-height: 1.2; margin: 0.1rem 0 0.4rem; text-shadow: 0 2px 4px rgba(0,0,0,0.3);">
            ${escapeHtml(studentName)}
          </div>
          <div style="display: flex; align-items: center; gap: 0.45rem; flex-wrap: wrap;">
            <span style="background: rgba(245, 158, 11, 0.18); border: 1px solid rgba(245, 158, 11, 0.45); padding: 0.2rem 0.6rem; border-radius: 0.45rem; font-size: 0.75rem; font-weight: 800; color: #FDE68A;">
              ${escapeHtml(groupName)}
            </span>
            <span style="background: rgba(255, 255, 255, 0.12); border: 1px solid rgba(255, 255, 255, 0.25); padding: 0.2rem 0.6rem; border-radius: 0.45rem; font-size: 0.75rem; font-family: monospace; font-weight: 900; color: #ffffff;">
              كود: ${escapeHtml(studentCode)}
            </span>
          </div>
        </div>

        <!-- 3. Full-Size Scannable Barcode Box -->
        <div style="background: #ffffff; border-radius: 0.75rem; padding: 0.65rem 0.75rem 0.45rem; text-align: center; box-shadow: 0 4px 14px rgba(0,0,0,0.22); border: 1px solid #e2e8f0; position: relative; z-index: 2;">
          <div style="width: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
            ${barcodeSvg}
          </div>
          <div style="font-family: 'Changa', monospace; font-size: 1.15rem; font-weight: 900; letter-spacing: 4px; color: #172D70; margin-top: 0.3rem; direction: ltr;">
            ${escapeHtml(studentCode)}
          </div>
          <div style="font-size: 0.68rem; font-weight: 700; color: #64748b; margin-top: 0.2rem; display: flex; align-items: center; justify-content: center; gap: 0.3rem;">
            <span style="color: #F59E0B;">★</span>
            <span>منظومة سنترلي التعليمية • كود دخول ذكي معتمد</span>
            <span style="color: #F59E0B;">★</span>
          </div>
        </div>

        <!-- 4. Card Action Buttons -->
        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; margin-top: 0.75rem; padding-top: 0.65rem; border-top: 1px solid rgba(255,255,255,0.1); position: relative; z-index: 2;">
          <button type="button" 
            onclick="window.centrlyBarcodeCard && window.centrlyBarcodeCard.openFullscreen ? window.centrlyBarcodeCard.openFullscreen(${studentJsonAttr}) : null" 
            style="
              flex: 1;
              background: rgba(255,255,255,0.12);
              color: #ffffff;
              border: 1px solid rgba(255,255,255,0.25);
              border-radius: 0.55rem;
              padding: 0.5rem 0.65rem;
              font-size: 0.78rem;
              font-weight: 700;
              font-family: inherit;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 0.35rem;
              transition: all 0.15s ease;
            ">
            ${getIcon('expand', 14, '#ffffff')}
            <span>تكبير للشاشة</span>
          </button>

          <button type="button" 
            onclick="window.centrlyBarcodeCard && window.centrlyBarcodeCard.downloadCardPng ? window.centrlyBarcodeCard.downloadCardPng(${studentJsonAttr}) : null" 
            style="
              flex: 1;
              background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
              color: #ffffff;
              border: none;
              border-radius: 0.55rem;
              padding: 0.5rem 0.75rem;
              font-size: 0.78rem;
              font-weight: 800;
              font-family: inherit;
              cursor: pointer;
              display: inline-flex;
              align-items: center;
              justify-content: center;
              gap: 0.35rem;
              box-shadow: 0 3px 10px rgba(245, 158, 11, 0.35);
              transition: all 0.15s ease;
            ">
            ${getIcon('download', 14, '#ffffff')}
            <span>حفظ الكارت (PNG)</span>
          </button>
        </div>
      </div>
    </div>
  `;
}

/**
 * Downloads high-resolution (Retina 1200x720) PNG of the Student Barcode ID Card
 * Rendered purely on HTML5 Canvas - works offline and instant across all mobile/desktop browsers
 */
export function downloadStudentCardAsPng(student = {}, options = {}) {
  const studentCode = student.student_code || student.code || "0000";
  const studentName = student.name || "طالب";
  const groupName = student.group_name || student.group || "المجموعة الدراسية";
  const teacherName = student.teacher_name || options.teacherName || student.center_name || "معلم المادة";
  const centerName = student.center_name && student.center_name !== teacherName ? student.center_name : "";

  const canvas = document.createElement("canvas");
  const width = 1200;
  const height = 720;
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;

  // 1. Background Luxury Deep Royal Navy Gradient
  const grad = ctx.createLinearGradient(0, 0, width, height);
  grad.addColorStop(0, "#101c44");
  grad.addColorStop(0.5, "#172D70");
  grad.addColorStop(1, "#1e3a8a");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, width, height);

  // Decorative ambient circles (Warm gold & royal blue)
  ctx.beginPath();
  ctx.arc(100, 100, 260, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(245, 158, 11, 0.08)";
  ctx.fill();

  ctx.beginPath();
  ctx.arc(width - 100, height - 100, 300, 0, Math.PI * 2);
  ctx.fillStyle = "rgba(37, 99, 235, 0.12)";
  ctx.fill();

  // Centrly Gold Accent Border
  ctx.strokeStyle = "rgba(245, 158, 11, 0.55)";
  ctx.lineWidth = 4;
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(20, 20, width - 40, height - 40, 24);
    ctx.stroke();
  } else {
    ctx.strokeRect(20, 20, width - 40, height - 40);
  }

  // 2. Header
  ctx.direction = "rtl";
  ctx.fillStyle = "#F59E0B";
  ctx.font = "bold 24px Cairo, Tahoma, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("سنترلي | Centrly • بطاقة الطالب الذكية", width - 60, 68);

  ctx.direction = "ltr";
  ctx.fillStyle = "rgba(255, 255, 255, 0.75)";
  ctx.font = "bold 16px monospace";
  ctx.textAlign = "left";
  ctx.fillText("Official Digital Access Card", 60, 68);

  // Header Divider
  ctx.strokeStyle = "rgba(245, 158, 11, 0.25)";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(60, 88);
  ctx.lineTo(width - 60, 88);
  ctx.stroke();

  // 3. Teacher Name Banner
  ctx.fillStyle = "rgba(255, 255, 255, 0.08)";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(60, 105, width - 120, 64, 12);
    ctx.fill();
    ctx.strokeStyle = "rgba(245, 158, 11, 0.35)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  } else {
    ctx.fillRect(60, 105, width - 120, 64);
  }

  ctx.direction = "rtl";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 24px Cairo, Tahoma, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText(teacherName, width - 85, 146);

  if (centerName) {
    ctx.fillStyle = "#FDE68A";
    ctx.font = "bold 20px Cairo, Tahoma, sans-serif";
    ctx.textAlign = "left";
    ctx.fillText(centerName, 85, 146);
  }

  // 4. Student Name & Meta Info
  ctx.direction = "rtl";
  ctx.fillStyle = "#FCD34D";
  ctx.font = "bold 18px Cairo, Tahoma, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("اسم الطالب", width - 60, 210);

  ctx.fillStyle = "#ffffff";
  ctx.font = "bold 38px Cairo, Tahoma, sans-serif";
  ctx.fillText(studentName, width - 60, 255);

  // Group and Code badges
  ctx.fillStyle = "#FDE68A";
  ctx.font = "bold 20px Cairo, Tahoma, sans-serif";
  ctx.textAlign = "right";
  ctx.fillText("المجموعة: " + groupName, width - 60, 300);

  ctx.direction = "ltr";
  ctx.fillStyle = "#FFFFFF";
  ctx.font = "bold 20px monospace";
  ctx.textAlign = "left";
  ctx.fillText("كود الطالب: " + studentCode, 60, 300);

  // 5. White Barcode Container Box
  const boxX = 60;
  const boxY = 325;
  const boxW = width - 120;
  const boxH = 305;

  ctx.fillStyle = "#ffffff";
  if (ctx.roundRect) {
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 16);
    ctx.fill();
    ctx.strokeStyle = "#e2e8f0";
    ctx.lineWidth = 2;
    ctx.stroke();
  } else {
    ctx.fillRect(boxX, boxY, boxW, boxH);
  }

  // Draw Code 128 Barcode onto Canvas
  const { patternStr } = encodeCode128B(studentCode);
  const barcodeHeight = 150;
  const barcodeY = boxY + 28;

  let totalUnits = 20;
  for (let i = 0; i < patternStr.length; i++) {
    totalUnits += parseInt(patternStr[i], 10);
  }
  const maxAvailableWidth = boxW - 120;
  const unitW = Math.min(8, Math.max(3.5, maxAvailableWidth / totalUnits));
  const calculatedBarcodeWidth = totalUnits * unitW;
  const startX = boxX + (boxW - calculatedBarcodeWidth) / 2 + (10 * unitW);

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

  // Student Code Text below Barcode
  ctx.direction = "ltr";
  ctx.fillStyle = "#172D70";
  ctx.font = "bold 36px monospace";
  ctx.textAlign = "center";
  ctx.fillText(studentCode, boxX + boxW / 2, barcodeY + barcodeHeight + 45);

  ctx.direction = "rtl";
  ctx.fillStyle = "#64748b";
  ctx.font = "bold 18px Cairo, Tahoma, sans-serif";
  ctx.fillText("★ منظومة سنترلي التعليمية • كود دخول ذكي معتمد ★", boxX + boxW / 2, barcodeY + barcodeHeight + 82);

  // 6. Footer
  ctx.fillStyle = "rgba(255,255,255,0.7)";
  ctx.font = "16px Cairo, Tahoma, sans-serif";
  ctx.textAlign = "right";
  const footerBrand = "منظومة سنترلي للحلول التعليمية (Centrly) • " + teacherName + (centerName ? " • " + centerName : "");
  ctx.fillText(footerBrand, width - 60, height - 35);

  ctx.direction = "ltr";
  ctx.textAlign = "left";
  ctx.fillText("Official Authorized Access Card", 60, height - 35);

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
 * Opens a full-screen, high-brightness modal optimized for instant camera/scanner reading
 */
export function openFullscreenBarcodeModal(student = {}) {
  const studentCode = student.student_code || student.code || "0000";
  const studentName = student.name || "طالب";
  const teacherName = student.teacher_name || "معلم المادة";

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
    background: rgba(16, 28, 68, 0.96);
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
      background: #ffffff;
      border-radius: 1.25rem;
      max-width: 500px;
      width: 100%;
      padding: 1.75rem 1.5rem;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
      position: relative;
    ">
      <!-- Close Button -->
      <button onclick="document.getElementById('${modalId}').remove()" style="
        position: absolute;
        top: 1rem;
        left: 1rem;
        background: #f1f5f9;
        border: none;
        border-radius: 50%;
        width: 36px;
        height: 36px;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        color: #475569;
      ">
        ${getIcon('close', 18, '#475569')}
      </button>

      <div style="font-size: 0.8rem; font-weight: 800; color: #F59E0B; margin-bottom: 0.35rem;">
        سنترلي | Centrly • كارت الباركود المباشر
      </div>
      
      <h3 style="font-size: 1.35rem; font-weight: 900; color: #172D70; margin: 0 0 0.25rem 0;">
        ${escapeHtml(studentName)}
      </h3>

      <div style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem;">
        المعلم: <b style="color: #172D70;">${escapeHtml(teacherName)}</b>
      </div>

      <!-- Extra Large Crisp Barcode -->
      <div style="
        background: #ffffff;
        border: 2px dashed #cbd5e1;
        border-radius: 1rem;
        padding: 1.5rem 1rem;
        margin-bottom: 1rem;
      ">
        <div style="width: 100%; overflow: hidden; display: flex; justify-content: center; align-items: center;">
          ${barcodeSvg}
        </div>
        <div style="font-family: 'Changa', monospace; font-size: 1.5rem; font-weight: 900; letter-spacing: 4px; color: #172D70; margin-top: 0.75rem; direction: ltr;">
          ${escapeHtml(studentCode)}
        </div>
      </div>

      <div style="font-size: 0.82rem; font-weight: 700; color: #16a34a; margin-bottom: 1.25rem;">
        ارفع سطوع شاشة الهاتف لتسهيل المسح الضوئي عند مدخل القاعة
      </div>

      <div style="display: flex; gap: 0.75rem; justify-content: center;">
        <button onclick="window.centrlyBarcodeCard.downloadCardPng(${studentJsonAttr})" style="
          background: linear-gradient(135deg, #F59E0B 0%, #D97706 100%);
          color: white;
          border: none;
          padding: 0.65rem 1.25rem;
          border-radius: 0.65rem;
          font-weight: 800;
          font-family: inherit;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 0.4rem;
          box-shadow: 0 3px 10px rgba(245, 158, 11, 0.35);
        ">
          ${getIcon('download', 16, '#ffffff')}
          <span>حفظ الصورة في الهاتف</span>
        </button>

        <button onclick="document.getElementById('${modalId}').remove()" style="
          background: #f1f5f9;
          color: #334155;
          border: 1px solid #cbd5e1;
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
  `;

  document.body.appendChild(modal);
}

// Global attachment for click handlers
if (typeof window !== "undefined") {
  window.centrlyBarcodeCard = {
    downloadCardPng: downloadStudentCardAsPng,
    openFullscreen: openFullscreenBarcodeModal,
  };
}
