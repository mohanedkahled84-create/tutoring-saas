import { request } from '../services/api.js';
import { normalizeDigits } from '../utils/normalizeDigits.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { getIcon } from '../utils/icons.js';

/**
 * Centrly Portal Link Dispatch & Batch Sharing Module
 * Sends WhatsApp links, copies student/parent portal URLs, and manages batch portal link dispatches.
 */
export function registerPortalDispatchActions(app) {
  app.resendSingleMessage = function(studentId, studentName) {
    const row = (this.sessionState.attendanceList || []).find(a => a.student_id === studentId || a.id === studentId);
    const student = (this.students || []).find(s => s.id === studentId) || {};
    const parentPhone = row?.parent_phone || student.parent_phone || row?.phone || '';

    // Block sending if no valid parent phone is registered
    const cleanCheck = (parentPhone || '').replace(/[\s\-().+]/g, '');
    if (!cleanCheck || cleanCheck.length < 9) {
      this.showToast(`رقم هاتف ولي الامر غير مسجل للطالب "${studentName}". يرجى تعديل بيانات الطالب واضافة رقم ولي الامر اولا.`, 'danger');
      return;
    }

    const isAttended = row?.attended !== false;
    const comment = row?.comment || '';
    const homework = row?.homework || 'none';

    let previewText = `السلام عليكم ورحمة الله وبركاته، ولي أمر الطالب/ة (${studentName}).\n`;
    if (isAttended) {
      previewText += `نفيدكم بحضور الطالب اليوم لحصة المادة بنجاح.\n`;
      if (homework === 'done') previewText += `حالة الواجب: مكتمل وممتاز.\n`;
      else if (homework === 'partial') previewText += `حالة الواجب: ناقص يحتاج استكمال.\n`;
      else if (homework === 'missing') previewText += `حالة الواجب: لم يتم تسليم الواجب.\n`;
      if (comment) previewText += `ملاحظة المعلم: ${comment}\n`;
    } else {
      previewText += `نود إحاطة سيادتكم بغياب الطالب/ة عن حضور حصة اليوم. يرجى المتابعة والاطمئنان حرصاً على مستواه الدراسي.\n`;
      if (comment) previewText += `ملاحظة: ${comment}\n`;
    }

    let cleanPhone = (parentPhone || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(previewText)}`;
    window.open(waUrl, '_blank');
    if (row) {
      row.sent = true;
      row.deliveryStatus = 'delivered';
      this.persistSessionState();
    }
    this.showToast(`تم فتح محادثة واتساب لولي أمر (${studentName}) بنجاح! 💬`, 'success');
    this.renderMainContent();
  }

  app.openDirectWhatsAppFallbackModal = function(studentName, phone, messageText, onDelivered, recipientType = 'parent') {
    let cleanPhone = (phone || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }

    // Block modal if no valid phone - prevents sending to teacher's own number
    if (!cleanPhone || cleanPhone.length < 9) {
      const recipientLabel = recipientType === 'student' ? 'الطالب' : 'ولي الامر';
      this.showToast(`رقم هاتف ${recipientLabel} غير مسجل للطالب "${studentName}". يرجى تعديل بيانات الطالب واضافة الرقم اولا.`, 'danger');
      return;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

    const isStudent = recipientType === 'student';
    const recipientTitle = isStudent ? 'الطالب' : 'ولي الأمر';

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;" dir="rtl">
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.85rem; font-size: 0.85rem; color: #92400e; line-height: 1.6;">
          <strong>الإرسال المباشر لـ ${recipientTitle}:</strong> واتساب السيرفر الآلي غير متصل حالياً. تم تجهيز نص الرسالة بالكامل لـ <b>${escapeHtml(studentName)}</b> لتتمكن من إرسالها فوراً بنقرة واحدة عبر واتساب لضمان وصولها!
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ${recipientTitle}:</label>
          <input type="tel" id="fallbackParentPhone" class="form-input" dir="ltr" value="${escapeHtml(phone || '')}" placeholder="رقم الهاتف" oninput="window.centrlyApp.updateDirectFallbackLink()">
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">نص الرسالة المُعدة للإرسال:</label>
          <textarea id="fallbackMessageText" class="form-input" rows="5" style="font-size: 0.85rem; line-height: 1.5;" oninput="window.centrlyApp.updateDirectFallbackLink()">${escapeHtml(messageText)}</textarea>
        </div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <a 
            id="directWhatsAppSendLink"
            href="${waUrl}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-primary" 
            style="background: #25d366; border-color: #25d366; color: #ffffff; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
            onclick="window.centrlyApp.onDirectWhatsAppModalClicked()"
          >
            ${getIcon('whatsapp', 18, '#ffffff')}
            <span>فتح واتساب وإرسال الرابط الآن</span>
          </a>
        </div>
      </div>
    `;

    this._pendingDirectOnDelivered = onDelivered;
    this.showModal(`إرسال رابط بوابة (${studentName}) عبر واتساب`, bodyHtml, '');
  }

  app.updateDirectFallbackLink = function() {
    const phoneInput = document.getElementById('fallbackParentPhone');
    const msgInput = document.getElementById('fallbackMessageText');
    const linkEl = document.getElementById('directWhatsAppSendLink');
    if (!linkEl) return;

    let cleanPhone = (phoneInput?.value || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }
    const msg = msgInput?.value || '';
    linkEl.href = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }

  app.onDirectWhatsAppModalClicked = function() {
    if (this._pendingDirectOnDelivered) {
      this._pendingDirectOnDelivered();
      this._pendingDirectOnDelivered = null;
    }
    setTimeout(() => {
      this.closeModal();
      this.showToast('تم فتح واتساب وتحديث حالة التقرير إلى تم التسليم!', 'success');
    }, 800);
  }

  app.copyToClipboard = async function(text, successMessage = 'تم النسخ بنجاح!', fallbackTitle = 'نسخ الرابط') {
    if (!text) return false;

    let copied = false;

    // 1. Try modern navigator.clipboard
    if (navigator && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (e) {
        copied = false;
      }
    }

    // 2. Fallback: Hidden textarea with document.execCommand('copy')
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        copied = false;
      }
    }

    // 3. Fallback: Web Share API if available (especially on mobile phones)
    if (!copied && navigator.share) {
      try {
        await navigator.share({
          title: fallbackTitle || 'Centrly',
          text: text,
          url: text.startsWith('http') ? text : undefined
        });
        this.showToast('تم فتح قائمة المشاركة بنجاح!', 'info');
        return true;
      } catch (e) {
        // Ignored if user dismissed share sheet
      }
    }

    // 4. Fallback: Clean modal dialog with pre-selected input so user can copy easily
    if (!copied) {
      this.openCopyFallbackModal(fallbackTitle || 'نسخ الرابط', text);
      return true;
    }

    if (successMessage) {
      this.showToast(successMessage, 'success');
    }
    return true;
  }

  app.openCopyFallbackModal = function(title, text) {
    const waUrl = text.startsWith('http') ? `https://wa.me/?text=${encodeURIComponent(text)}` : '';
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;" dir="rtl">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.85rem; font-size: 0.85rem; color: #1e40af; line-height: 1.5;">
          <strong>تنبيه المتصفح:</strong> يرجى الضغط على الزر أدناه لنسخ الرابط أو مشاركته مباشرة.
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">الرابط المطلوب:</label>
          <input type="text" id="centrlyFallbackCopyInput" class="form-input" dir="ltr" value="${escapeHtml(text)}" readonly onclick="this.select();" style="font-family: monospace; font-size: 0.82rem; background: #f8fafc;">
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>
          <button type="button" class="btn btn-primary" onclick="const input = document.getElementById('centrlyFallbackCopyInput'); if (input) { input.focus(); input.select(); document.execCommand('copy'); window.centrlyApp.showToast('تم النسخ بنجاح!', 'success'); window.centrlyApp.closeModal(); }">
            ${getIcon('copy', 14)}
            <span>تحديد ونسخ</span>
          </button>
          ${waUrl ? `
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="background: #25d366; border-color: #25d366; color: #ffffff;">
              ${getIcon('whatsapp', 14, '#ffffff')}
              <span>مشاركة عبر واتساب</span>
            </a>
          ` : ''}
        </div>
      </div>
    `;
    this.showModal(title, bodyHtml, '');
    setTimeout(() => {
      const input = document.getElementById('centrlyFallbackCopyInput');
      if (input) {
        input.focus();
        input.select();
      }
    }, 150);
  }

  app.copyParentLink = async function(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const parentPhone = student?.parent_phone || student?.parentPhone || 'رقم ولي الأمر';
    const studentName = student?.name || student?.full_name || 'الطالب';
    const pass = student?.portal_password || student?.portalPassword || (student?.code ? String(student.code).padStart(6, '0') : '123456');
    const canonicalOrigin = typeof window !== 'undefined' ? (window.location.origin || 'https://centerly-eg.com') : 'https://centerly-eg.com';
    const portalUrl = `${canonicalOrigin}/portal?role=parent`;
    const rawTeacher = this.user?.name || 'المعلم';
    const teacherName = rawTeacher.startsWith('مستر') || rawTeacher.startsWith('أ.') || rawTeacher.startsWith('أستاذ')
      ? rawTeacher
      : `مستر ${rawTeacher}`;

    const textToCopy = `أهلاً بحضرتك ولي أمر الطالب (${studentName})، نتمنى له عاماً دراسياً حافلاً بالتفوق والنجاح!\n\nيسعدنا تزويدكم ببيانات بوابة المتابعة مع ${teacherName}:\n\n*رابط بوابة المتابعة:*\n${portalUrl}\n\n*اسم الدخول (رقم هاتفك):* ${parentPhone}\n*كلمة المرور:* ${pass}\n\n*من خلال هذه البوابة يمكنكم في أي وقت:*\n- متابعة تسجيل الحضور والغياب فور دخول الطالب الحصة.\n- درجات الكويزات والامتحانات الدورية وتقييمات المعلم.\n- متابعة الواجبات المنزلية والالتزام بتسليمها وملاحظات المعلم.\n\n*تنبيه هام:* يرجى *حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً* حتى يصبح الرابط أزرق وقابلاً للضغط، ولتصلك تقارير الحصص والدرجات باستمرار دون انقطاع.\n\nمع خالص تمنياتنا للطالب (${studentName}) بدوام التفوق والنجاح.\nمع تحيات: ${teacherName}`;

    await this.copyToClipboard(textToCopy, `تم نسخ رسالة واتساب الكاملة لولي أمر (${studentName}) بنجاح!`, 'رسالة واتساب ولي الأمر');
  }

  app.previewParentPortal = async function(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const phone = student?.parent_phone || student?.parentPhone || '';
    const canonicalOrigin = typeof window !== 'undefined' ? (window.location.origin || 'https://centerly-eg.com') : 'https://centerly-eg.com';
    const url = `${canonicalOrigin}/portal?role=parent&preview=true${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`;
    window.open(url, '_blank');
  }

  app.copyStudentLink = async function(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const studentPhone = student?.student_phone || student?.studentPhone || 'رقم الطالب';
    const studentName = student?.name || student?.full_name || 'الطالب';
    const pass = student?.portal_password || student?.portalPassword || (student?.code ? String(student.code).padStart(6, '0') : '123456');
    const canonicalOrigin = typeof window !== 'undefined' ? (window.location.origin || 'https://centerly-eg.com') : 'https://centerly-eg.com';
    const portalUrl = `${canonicalOrigin}/portal?role=student`;
    const rawTeacher = this.user?.name || 'المعلم';
    const teacherName = rawTeacher.startsWith('مستر') || rawTeacher.startsWith('أ.') || rawTeacher.startsWith('أستاذ')
      ? rawTeacher
      : `مستر ${rawTeacher}`;

    const textToCopy = `أهلاً بك يا (${studentName})، نتمنى لك كل التوفيق والتميز دائماً!\n\nتم تفعيل بوابتك التعليمية الرسمية لمتابعة دروسك مع ${teacherName}:\n\n*رابط بوابتك التعليمية:*\n${portalUrl}\n\n*اسم الدخول (رقم هاتفك):* ${studentPhone}\n*كلمة المرور:* ${pass}\n\n*من خلال هذه البوابة يمكنك في أي وقت:*\n- تحميل المذكرات وملازم الشرح وملفات الـ PDF.\n- معرفة الواجبات المنزلية المطلوبة ومواعيد تسليمها.\n- رفع حلول الواجبات وملفات الـ PDF مباشرة ومتابعة اعتمادها.\n- الاطلاع على درجات الكويزات وسجل حضورك.\n\n*تنبيه:* يرجى *حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً* حتى يصبح الرابط أزرق وقابلاً للضغط، ولتصلك تنبيهات الحصص والواجبات أولاً بأول.\n\nمع أطيب التمنيات لك بدوام التفوق والتميز دائماً.\nمع تحيات: ${teacherName}`;

    await this.copyToClipboard(textToCopy, `تم نسخ رسالة واتساب الكاملة للطالب (${studentName}) بنجاح!`, 'رسالة واتساب الطالب');
  }

  app.previewStudentPortal = async function(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const phone = student?.student_phone || student?.studentPhone || '';
    const canonicalOrigin = typeof window !== 'undefined' ? (window.location.origin || 'https://centerly-eg.com') : 'https://centerly-eg.com';
    const url = `${canonicalOrigin}/portal?role=student&preview=true${phone ? `&phone=${encodeURIComponent(phone)}` : ''}`;
    window.open(url, '_blank');
  }

  app.sendSingleParentLink = async function(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const parentPhone = student?.parentPhone || student?.parent_phone;
    if (!parentPhone) {
      this.showToast('رقم هاتف ولي الأمر غير مسجل لهذا الطالب.', 'warning');
      return;
    }

    const studentName = student?.name || student?.full_name || 'الطالب';
    let cleanPhone = (parentPhone || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }

    if (!cleanPhone || cleanPhone.length < 9) {
      this.showToast(`رقم هاتف ولي الأمر غير صالح للطالب "${studentName}". يرجى تعديل بيانات الطالب والتأكد من صحة الرقم أولاً.`, 'danger');
      return;
    }

    const pass = student?.portal_password || student?.portalPassword || (student?.code ? String(student.code).padStart(6, '0') : '123456');
    const canonicalOrigin = typeof window !== 'undefined' ? (window.location.origin || 'https://centerly-eg.com') : 'https://centerly-eg.com';
    const portalUrl = `${canonicalOrigin}/portal`;
    const rawTeacher = this.user?.name || 'المعلم';
    const teacherName = rawTeacher.startsWith('مستر') || rawTeacher.startsWith('أ.') || rawTeacher.startsWith('أستاذ')
      ? rawTeacher
      : `مستر ${rawTeacher}`;

    const msg = `أهلاً بحضرتك ولي أمر الطالب (${studentName})، نتمنى له عاماً دراسياً حافلاً بالتفوق والنجاح!\n\nيسعدنا تزويدكم ببيانات بوابة المتابعة مع ${teacherName}:\n\n*رابط بوابة المتابعة:*\n${portalUrl}\n\n*اسم الدخول (رقم هاتفك):* ${parentPhone}\n*كلمة المرور:* ${pass}\n\n*من خلال هذه البوابة يمكنكم في أي وقت:*\n- متابعة تسجيل الحضور والغياب فور دخول الطالب الحصة.\n- درجات الكويزات والامتحانات الدورية وتقييمات المعلم.\n- متابعة الواجبات المنزلية والالتزام بتسليمها وملاحظات المعلم.\n\n*تنبيه هام:* يرجى *حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً* حتى يصبح الرابط أزرق وقابلاً للضغط، ولتصلك تقارير الحصص والدرجات باستمرار دون انقطاع.\n\nمع خالص تمنياتنا للطالب (${studentName}) بدوام التفوق والنجاح.\nمع تحيات: ${teacherName}`;

    // Open WhatsApp Web/App directly
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');

    const now = new Date().toISOString();
    if (student) {
      student.parent_portal_sent_at = now;
    }

    // Persist sent timestamp to database
    request(`/students/${studentId}`, {
      method: 'PATCH',
      body: { parent_portal_sent_at: now },
    }).catch(() => {});

    this.showToast(`تم فتح محادثة واتساب لولي أمر (${studentName}) بنجاح! 💬`, 'success');
    if (this.currentRoute === 'students') {
      this.renderMainContent();
    }
  }

  app.sendSingleStudentLink = async function(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const studentPhone = student?.studentPhone || student?.student_phone;
    if (!studentPhone) {
      this.showToast('رقم هاتف الطالب غير مسجل لهذا الطالب.', 'warning');
      return;
    }

    const studentName = student?.name || student?.full_name || 'الطالب';
    let cleanPhone = (studentPhone || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }

    if (!cleanPhone || cleanPhone.length < 9) {
      this.showToast(`رقم هاتف الطالب غير صالح للطالب "${studentName}". يرجى تعديل بيانات الطالب والتأكد من صحة الرقم أولاً.`, 'danger');
      return;
    }

    const pass = student?.portal_password || student?.portalPassword || (student?.code ? String(student.code).padStart(6, '0') : '123456');
    const canonicalOrigin = typeof window !== 'undefined' ? (window.location.origin || 'https://centerly-eg.com') : 'https://centerly-eg.com';
    const studentUrl = `${canonicalOrigin}/portal`;
    const rawTeacher = this.user?.name || 'المعلم';
    const teacherName = rawTeacher.startsWith('مستر') || rawTeacher.startsWith('أ.') || rawTeacher.startsWith('أستاذ')
      ? rawTeacher
      : `مستر ${rawTeacher}`;

    const msg = `أهلاً بك يا (${studentName})، نتمنى لك كل التوفيق والتميز دائماً!\n\nتم تفعيل بوابتك التعليمية الرسمية لمتابعة دروسك مع ${teacherName}:\n\n*رابط بوابتك التعليمية:*\n${studentUrl}\n\n*اسم الدخول (رقم هاتفك):* ${studentPhone}\n*كلمة المرور:* ${pass}\n\n*من خلال هذه البوابة يمكنك في أي وقت:*\n- تحميل المذكرات وملازم الشرح وملفات الـ PDF.\n- معرفة الواجبات المنزلية المطلوبة ومواعيد تسليمها.\n- رفع حلول الواجبات وملفات الـ PDF مباشرة ومتابعة اعتمادها.\n- الاطلاع على درجات الكويزات وسجل حضورك.\n\n*تنبيه:* يرجى *حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً* حتى يصبح الرابط أزرق وقابلاً للضغط، ولتصلك تنبيهات الحصص والواجبات أولاً بأول.\n\nمع أطيب التمنيات لك بدوام التفوق والتميز دائماً.\nمع تحيات: ${teacherName}`;

    // Open WhatsApp Web/App directly
    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}`;
    window.open(waUrl, '_blank');

    const now = new Date().toISOString();
    if (student) {
      student.student_portal_sent_at = now;
    }

    // Persist sent timestamp to database
    request(`/students/${studentId}`, {
      method: 'PATCH',
      body: { student_portal_sent_at: now },
    }).catch(() => {});

    this.showToast(`تم فتح محادثة واتساب للطالب (${studentName}) بنجاح! 💬`, 'success');
    if (this.currentRoute === 'students') {
      this.renderMainContent();
    }
  }

  app.openBatchParentLinksModal = function() {
    this.openBatchPortalLinksModal();
  }

  app.isStudentInBatchPortalGroup = function(s, targetGroupId) {
    if (!targetGroupId || targetGroupId === 'ALL') return true;
    if (targetGroupId === 'UNASSIGNED') {
      return !s.group_id && !s.groupId && (!Array.isArray(s.group_ids) || s.group_ids.length === 0);
    }
    if (s.group_id === targetGroupId || s.groupId === targetGroupId) return true;
    if (Array.isArray(s.group_ids) && s.group_ids.includes(targetGroupId)) return true;
    const grp = (this.groups || []).find(g => g.id === targetGroupId || g.name === targetGroupId);
    if (grp) {
      if (s.group_id === grp.id || s.groupId === grp.id) return true;
      if (Array.isArray(s.group_ids) && s.group_ids.includes(grp.id)) return true;
      if (s.groupName === grp.name || s.group_name === grp.name) return true;
    }
    return false;
  }

  app.getUnsentPortalStudents = function(groupId = 'ALL') {
    const studentList = this.students || [];
    return studentList.filter(s => {
      const isUnsent = (!s.parent_portal_sent_at || !s.student_portal_sent_at);
      const hasPhone = !!((s.parentPhone || s.parent_phone) || (s.studentPhone || s.student_phone));
      if (!isUnsent || !hasPhone) return false;
      return this.isStudentInBatchPortalGroup(s, groupId);
    });
  }

  app.renderBatchPortalStudentsListHtml = function(studentsToShow) {
    if (!studentsToShow || studentsToShow.length === 0) {
      return `
        <div style="padding: 1.75rem 1rem; text-align: center; color: #64748b; background: #fff; border: 1.5px dashed #cbd5e1; border-radius: 0.5rem;">
          <div style="font-size: 1.8rem; margin-bottom: 0.35rem;">🎉</div>
          <div style="font-weight: 700; color: #1e293b; font-size: 0.92rem; margin-bottom: 0.2rem;">لا يوجد طلاب جدد غير مرسل لهم في هذه المجموعة</div>
          <div style="font-size: 0.8rem; color: #64748b;">تم إرسال روابط المنصة والمتابعة لجميع طلاب هذه المجموعة مسبقاً، أو لا توجد أرقام هواتف مسجلة.</div>
        </div>
      `;
    }

    return studentsToShow.map((s) => {
      const pPhone = s.parentPhone || s.parent_phone || '—';
      const sPhone = s.studentPhone || s.student_phone || '—';
      const matchedGroup = (this.groups || []).find(g => g.id === s.group_id || g.id === s.groupId);
      const groupLabel = s.groupName || s.group_name || matchedGroup?.name || '';
      return `
        <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.45rem 0.65rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.45rem; cursor: pointer; transition: all 0.15s ease;" onmouseover="this.style.borderColor='#94a3b8'; this.style.background='#f8fafc';" onmouseout="this.style.borderColor='#e2e8f0'; this.style.background='#fff';">
          <span style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
            <input type="checkbox" class="batch-parent-checkbox" value="${escapeHtml(s.id)}" checked onchange="window.centrlyApp.updateBatchPortalSelectedCount()">
            <span style="font-weight: 700; color: #1e293b;">${escapeHtml(s.name || s.full_name || '—')}</span>
            <span style="font-size: 0.75rem; color: #64748b; font-family: monospace;">كود: ${escapeHtml(s.code || s.student_code || '—')}</span>
            ${groupLabel ? `<span style="font-size: 0.7rem; background: #eff6ff; color: #1d4ed8; padding: 0.1rem 0.45rem; border-radius: 4px; font-weight: 700; border: 1px solid #bfdbfe;">${escapeHtml(groupLabel)}</span>` : ''}
          </span>
          <span dir="ltr" style="font-size: 0.75rem; font-family: monospace; color: #475569; display: flex; flex-direction: column; align-items: flex-end;">
            <span>ولي الأمر: ${escapeHtml(pPhone)}</span>
            <span>الطالب: ${escapeHtml(sPhone)}</span>
          </span>
        </label>
      `;
    }).join('');
  }

  app.onBatchPortalGroupChange = function(groupId) {
    this._currentBatchPortalGroupId = groupId;
    const targetStudents = this.getUnsentPortalStudents(groupId);
    const container = document.getElementById('batchPortalStudentsListContainer');
    if (container) {
      container.innerHTML = this.renderBatchPortalStudentsListHtml(targetStudents);
    }

    const countLabel = document.getElementById('batchPortalCountLabel');
    if (countLabel) {
      countLabel.innerHTML = `الطلاب المستهدفون (${targetStudents.length} طالب):`;
    }

    const masterCb = document.getElementById('selectAllBatchParentLinks');
    if (masterCb) {
      masterCb.checked = targetStudents.length > 0;
      masterCb.disabled = targetStudents.length === 0;
    }

    this.updateBatchPortalSelectedCount();
  }

  app.toggleAllBatchPortalCheckboxes = function(checked) {
    const boxes = document.querySelectorAll('.batch-parent-checkbox');
    boxes.forEach((cb) => {
      cb.checked = checked;
    });
    this.updateBatchPortalSelectedCount();
  }

  app.updateBatchPortalSelectedCount = function() {
    const selectedBoxes = Array.from(document.querySelectorAll('.batch-parent-checkbox:checked'));
    const totalBoxes = document.querySelectorAll('.batch-parent-checkbox').length;
    const count = selectedBoxes.length;

    const masterCb = document.getElementById('selectAllBatchParentLinks');
    if (masterCb && totalBoxes > 0) {
      masterCb.checked = (count === totalBoxes);
    }

    const btn = document.getElementById('btnConfirmBatchParentLinks');
    if (btn) {
      if (count === 0) {
        btn.disabled = true;
        btn.style.opacity = '0.6';
        btn.style.cursor = 'not-allowed';
        btn.innerHTML = `${getIcon('whatsapp', 18)} <span>حدد طلاباً للإرسال (0)</span>`;
      } else {
        btn.disabled = false;
        btn.style.opacity = '1';
        btn.style.cursor = 'pointer';
        btn.innerHTML = `${getIcon('whatsapp', 18)} <span>إرسال الروابط (${count} طالب)</span>`;
      }
    }
  }

  app.isUserSubscribed = function() {
    if (this.user?.role === 'admin') return true;
    const b = this.billingState || {};
    if (b.is_paid_active === true) return true;
    if (b.subscription_status === 'active' || b.status === 'active') return true;
    if (b.subscription_ends_at && new Date(b.subscription_ends_at).getTime() > Date.now()) return true;
    if (Array.isArray(b.payment_proofs) && b.payment_proofs.some(p => p.status === 'approved')) return true;
    return false;
  }

  app.openSubscriptionRequiredForBatchPortalModal = function() {
    const bodyHtml = `
      <div style="text-align: center; padding: 1.25rem 0.5rem;">
        <div style="width: 76px; height: 76px; margin: 0 auto 1.25rem; background: linear-gradient(135deg, #fef3c7, #fef08a); border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 16px rgba(234, 179, 8, 0.25); border: 2.5px solid #fde047; color: #b45309;">
          ${getIcon('crown', 38, '#b45309')}
        </div>
        
        <h3 style="font-size: 1.25rem; font-weight: 800; color: #1e293b; margin-bottom: 0.6rem;">
          ميزة حصرية للباقات المدفوعة
        </h3>
        
        <p style="font-size: 0.92rem; color: #475569; line-height: 1.6; max-width: 440px; margin: 0 auto 1.25rem;">
          خاصية إرسال روابط المنصة وحسابات الدخول للطلاب وأولياء الأمور دفعة واحدة متاحة حصرياً عند الاشتراك في إحدى باقات سنترلي.
        </p>

        <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.25rem; text-align: right; max-width: 440px; margin: 0 auto 1.5rem;">
          <div style="font-weight: 800; font-size: 0.85rem; color: #0f172a; margin-bottom: 0.6rem; display: flex; align-items: center; gap: 0.4rem;">
            <span>ماذا تحصل عند الترقية للباقة المدفوعة؟</span>
          </div>
          <ul style="margin: 0; padding-right: 1.2rem; font-size: 0.825rem; color: #334155; display: flex; flex-direction: column; gap: 0.45rem; list-style-type: disc;">
            <li>إرسال فوري لبيانات الدخول (اسم المستخدم وكلمة السر) لجميع الطلاب وأولياء الأمور بنقرة واحدة.</li>
            <li>وصول دائم غير محدود لجميع مميزات المنصة والمتابعة وبوابات الطلاب.</li>
            <li>ردود آلية ذكية وبوابات متابعة حية لدرجات الكويزات، تقارير الحضور والغياب، وملاحظاتك المباشرة.</li>
            <li>تحميل ملازم وملفات الشرح ورفع حلول الواجبات فورياً.</li>
          </ul>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.6rem; max-width: 380px; margin: 0 auto;">
          <button type="button" class="btn btn-primary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.navigate('billing');" style="background: linear-gradient(135deg, #0284c7, #0369a1); border: none; font-weight: 800; font-size: 0.95rem; padding: 0.75rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 14px rgba(2, 132, 199, 0.3); display: flex; align-items: center; justify-content: center; gap: 0.5rem; cursor: pointer;">
            <span>الترقية والاشتراك في باقة الآن</span>
          </button>
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()" style="font-weight: 600; font-size: 0.85rem; padding: 0.45rem;">
            إغلاق
          </button>
        </div>
      </div>
    `;

    this.showModal('تفعيل إرسال الروابط', bodyHtml, '');
  }

  app.openBatchPortalLinksModal = async function(preselectedGroupId = null) {
    if (!this.billingState || !this.billingState.subscription_status) {
      try {
        const billingRes = await request('/billing/status');
        if (billingRes) {
          this.billingState = billingRes;
          this.saveCache('billingState', this.billingState);
        }
      } catch (_) {}
    }

    const isPaidActive = this.isUserSubscribed();
    if (!isPaidActive) {
      this.openSubscriptionRequiredForBatchPortalModal();
      return;
    }

    const allUnsentStudents = this.getUnsentPortalStudents('ALL');

    if (allUnsentStudents.length === 0) {
      this.showToast('جميع الطلاب المسجلين تم إرسال روابط المنصة والمتابعة لهم مسبقاً.', 'info');
      return;
    }

    // Determine initial selected group
    let initialGroupId = 'ALL';
    if (preselectedGroupId) {
      initialGroupId = preselectedGroupId;
    } else {
      const pageFilter = document.getElementById('studentGroupFilter')?.value;
      if (pageFilter) {
        const matched = (this.groups || []).find(g => g.id === pageFilter || g.name === pageFilter);
        if (matched) {
          initialGroupId = matched.id;
        }
      }
    }

    this._currentBatchPortalGroupId = initialGroupId;
    const studentsToShow = this.getUnsentPortalStudents(initialGroupId);
    const teacherName = this.user?.name || 'مستر أحمد';
    const displayCount = studentsToShow.length;

    // Build Group Options
    const groupOptions = (this.groups || []).map(g => {
      const gCount = this.getUnsentPortalStudents(g.id).length;
      const isSelected = g.id === initialGroupId;
      return `<option value="${escapeHtml(g.id)}" ${isSelected ? 'selected' : ''}>${escapeHtml(g.name)} (${gCount} طالب غير مرسل)</option>`;
    }).join('');

    const unassignedCount = this.getUnsentPortalStudents('UNASSIGNED').length;
    const unassignedOption = unassignedCount > 0
      ? `<option value="UNASSIGNED" ${initialGroupId === 'UNASSIGNED' ? 'selected' : ''}>طلاب بدون مجموعة (${unassignedCount} طالب جديد)</option>`
      : '';

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <!-- Group Selector Filter -->
        <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 0.75rem; padding: 0.75rem;">
          <label for="batchPortalGroupSelect" style="display: flex; align-items: center; justify-content: space-between; font-weight: 700; font-size: 0.85rem; color: #1e293b; margin-bottom: 0.4rem;">
            <span style="display: flex; align-items: center; gap: 0.35rem;">
              <span style="color: #2563eb; font-size: 1rem;">👥</span>
              <span>تحديد المجموعة المستهدفة:</span>
            </span>
            <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">(اختر مجموعة معينة أو جميع المجاميع)</span>
          </label>
          <select id="batchPortalGroupSelect" class="form-select" style="width: 100%; font-weight: 700; font-size: 0.9rem; padding: 0.5rem 0.75rem; border-radius: 0.5rem; border-color: #94a3b8; background-color: #ffffff; cursor: pointer;" onchange="window.centrlyApp.onBatchPortalGroupChange(this.value)">
            <option value="ALL" ${initialGroupId === 'ALL' ? 'selected' : ''}>🌟 جميع المجاميع (${allUnsentStudents.length} طالب)</option>
            ${groupOptions}
            ${unassignedOption}
          </select>
        </div>

        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
            <span id="batchPortalCountLabel">الطلاب المستهدفون (${studentsToShow.length} طالب):</span>
            <label style="font-size: 0.8rem; color: #64748b; font-weight: 600; cursor: pointer; display: flex; align-items: center; gap: 0.35rem;">
              <input type="checkbox" id="selectAllBatchParentLinks" ${displayCount > 0 ? 'checked' : ''} ${studentsToShow.length === 0 ? 'disabled' : ''} onchange="window.centrlyApp.toggleAllBatchPortalCheckboxes(this.checked)">
              <span>تحديد الكل</span>
            </label>
          </div>

          <div id="batchPortalStudentsListContainer" style="max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; background: #fafafa;">
            ${this.renderBatchPortalStudentsListHtml(studentsToShow)}
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <button type="button" class="btn btn-sm" id="btnTabPreviewStudent" onclick="
              document.getElementById('previewStudentMsg').style.display='block';
              document.getElementById('previewParentMsg').style.display='none';
              this.style.background='#0284c7'; this.style.color='#fff';
              document.getElementById('btnTabPreviewParent').style.background='#f1f5f9'; document.getElementById('btnTabPreviewParent').style.color='#334155';
            " style="background: #0284c7; color: #fff; font-weight: 700;">نموذج الطالب</button>

            <button type="button" class="btn btn-sm" id="btnTabPreviewParent" onclick="
              document.getElementById('previewStudentMsg').style.display='none';
              document.getElementById('previewParentMsg').style.display='block';
              this.style.background='#0284c7'; this.style.color='#fff';
              document.getElementById('btnTabPreviewStudent').style.background='#f1f5f9'; document.getElementById('btnTabPreviewStudent').style.color='#334155';
            " style="background: #f1f5f9; color: #334155; font-weight: 700;">نموذج ولي الأمر</button>
          </div>

          <div id="previewStudentMsg" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.8rem; color: #334155; line-height: 1.6; white-space: pre-line;">
*بوابة الطالب الرسمية | منظومة سنترلي*

أهلاً بك يا (اسم الطالب) 
تم تفعيل بوابتك التعليمية الخاصة بمادتنا مع ${escapeHtml(teacherName)}.

من خلال بوابتك الشخصية يمكنك:
📚 تحميل مذكرات الحصص وملخصات الـ PDF ومذاكرتها في أي وقت.
📝 حل الواجب في كشكولك ورفع صور الحل مباشرة للمعلم وتلقي التصحيح.
📊 متابعة درجاتك في جميع الكويزات والامتحانات الدورية.
📅 كشف حضور الحصص مع كارت باركود الحضور المعتمد عند باب السنتر.

💡 بمجرد دخولك للمنصة، ستجد جولة إرشادية ذكية وسهم يوضح لك طريقة استخدام كل خانة بسهولة.

🔘 *أزرار الرسالة:*
[الدخول للمنصة]  |  [الحصول على اسم المستخدم وكلمه السر]
          </div>

          <div id="previewParentMsg" style="display: none; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.8rem; color: #334155; line-height: 1.6; white-space: pre-line;">
*تقرير متابعة الطالب | منظومة سنترلي*

السيد ولي أمر الطالب (اسم الطالب) 
تم تفعيل بوابة المتابعة المباشرة لنجلكم لمادتنا مع ${escapeHtml(teacherName)}.

من خلال بوابتك يمكنك متابعة:
📅 الحضور والغياب اللحظي فور مسح باركود الطالب عند باب السنتر.
📊 كشف درجات الكويزات والامتحانات وملاحظات المعلم أولاً بأول.
📝 متابعة تسليم الواجبات المنزلية ومستوى الحل.
🔄 زر تحديث فوري لعرض أحدث التقارير دون تسجيل خروج.

💡 بمجرد فتح الرابط، ستظهر جولة توضيحية تشرح لسيادتكم كافة أقسام التقرير وكيفية استخدامه بسهولة.

🔘 *أزرار الرسالة:*
[الدخول للمنصة]  |  [الحصول على اسم المستخدم وكلمه السر]
          </div>
        </div>
      </div>
    `;

    const isBtnDisabled = displayCount === 0;
    const footerHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 0.75rem;">
        <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
        <button type="button" id="btnConfirmBatchParentLinks" class="btn btn-primary" onclick="window.centrlyApp.dispatchBatchParentLinks()" ${isBtnDisabled ? 'disabled style="opacity: 0.6; cursor: not-allowed; background-color: #0284c7; border-color: #0284c7; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;"' : 'style="background-color: #0284c7; border-color: #0284c7; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;"'}>
          ${getIcon('whatsapp', 18)}
          <span>${isBtnDisabled ? 'حدد طلاباً للإرسال (0)' : `إرسال الروابط (${displayCount} طالب)`}</span>
        </button>
      </div>
    `;

    this.showModal(`إرسال روابط المتابعة والمنصة للطلاب الجدد`, bodyHtml, footerHtml);
  }

  app.dispatchBatchParentLinks = async function() {
    const selectedBoxes = Array.from(document.querySelectorAll('.batch-parent-checkbox:checked'));
    const selectedIds = selectedBoxes.map(cb => cb.value);

    if (selectedIds.length === 0) {
      this.showToast('يرجى اختيار طالب واحد على الأقل للإرسال.', 'warning');
      return;
    }

    const btn = document.getElementById('btnConfirmBatchParentLinks');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>جاري الإرسال...</span>`;
    }

    try {
      const res = await request('/students/batch-send-dual-portal-links', {
        method: 'POST',
        body: {
          student_ids: selectedIds,
          teacher_name: this.user?.name || 'المعلم',
          provider: 'meta',
        },
      });

      this.closeModal();

      // Update local student records
      const now = new Date().toISOString();
      (this.students || []).forEach(s => {
        if (selectedIds.includes(s.id)) {
          s.parent_portal_sent_at = now;
          s.student_portal_sent_at = now;
        }
      });

      this.showToast(
        res.message || `تم بنجاح إرسال الروابط لـ (${selectedIds.length}) طالباً!`,
        res.is_template_pending ? 'info' : 'success'
      );

      if (this.currentRoute === 'students') {
        this.renderMainContent();
      } else if (this.currentRoute === 'whatsapp-inbox') {
        await this.loadWhatsAppInboxData(true);
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${getIcon('whatsapp', 16)}<span>إعادة المحاولة</span>`;
      }
      if (err?.code === 'SUBSCRIPTION_REQUIRED' || (err?.message && err.message.includes('SUBSCRIPTION_REQUIRED')) || (err?.message && err.message.includes('الباقات المدفوعة'))) {
        this.closeModal();
        this.openSubscriptionRequiredForBatchPortalModal();
        return;
      }
      this.showToast(`حدث خطأ أثناء الإرسال: ${err.message || 'تأكد من الاتصال بالخادم'}`, 'danger');
    }
  };
}
