import { getIcon } from "../utils/icons.js";

/**
 * Centrly Onboarding Wizard (DEV-15 & DEV-38)
 * Self-Serve Signup + Quick Add Group & Students + WhatsApp Connect
 */

export function renderOnboardingWizard(step = 1, state = {}) {
  const defaultState = {
    groupName: state.groupName || '',
    sessionPrice: state.sessionPrice !== undefined ? state.sessionPrice : '',
    students: state.students || [
      { name: '', phone: '' },
      { name: '', phone: '' },
      { name: '', phone: '' },
    ],
    homeworkSubmission: state.homeworkSubmission || 'in_session',
    autoNotification: state.autoNotification !== false,
    ...state,
  };

  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: var(--centrly-surface); padding: 1.5rem;">
      <div class="card" style="max-width: 680px; width: 100%; padding: 2.5rem; box-shadow: var(--shadow-lg);">
        
        <!-- Wizard Header & Steps -->
        <div style="text-align: center; margin-bottom: 2rem;">
          <h1 style="font-size: 1.5rem; font-weight: 800; color: var(--centrly-ink); margin-bottom: 0.5rem;">
            أهلاً بك في منصة سنترلي (Centrly)
          </h1>
          <p style="color: var(--centrly-text); font-size: 0.875rem;">
            لنبدأ بإعداد حسابك خلال دقيقتين فقط لتتمكن من رصد الحضور وإرسال رسائل الواتساب
          </p>
          
          <!-- Stepper Indicator -->
          <div style="display: flex; justify-content: center; gap: 1.5rem; margin-top: 1.5rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem; color: ${step >= 1 ? 'var(--centrly-blue-700)' : 'var(--centrly-text)'}; font-weight: 700; font-size: 0.85rem;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step >= 1 ? 'var(--centrly-blue-700)' : 'var(--centrly-line)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">1</span>
              <span>المجموعة</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; color: ${step >= 2 ? 'var(--centrly-blue-700)' : 'var(--centrly-text)'}; font-weight: 700; font-size: 0.85rem;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step >= 2 ? 'var(--centrly-blue-700)' : 'var(--centrly-line)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">2</span>
              <span>الطلاب</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; color: ${step >= 3 ? 'var(--centrly-blue-700)' : 'var(--centrly-text)'}; font-weight: 700; font-size: 0.85rem;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step >= 3 ? 'var(--centrly-blue-700)' : 'var(--centrly-line)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">3</span>
              <span>سير العمل</span>
            </div>
            <div style="display: flex; align-items: center; gap: 0.5rem; color: ${step >= 4 ? 'var(--centrly-blue-700)' : 'var(--centrly-text)'}; font-weight: 700; font-size: 0.85rem;">
              <span style="width: 24px; height: 24px; border-radius: 50%; background: ${step >= 4 ? 'var(--centrly-blue-700)' : 'var(--centrly-line)'}; color: #fff; display: flex; align-items: center; justify-content: center; font-size: 0.75rem;">4</span>
              <span>واتساب</span>
            </div>
          </div>
        </div>

        <div id="onboardingAlert" style="display: none; padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-size: 0.85rem;"></div>

        <!-- Step 1: Create First Group -->
        ${step === 1 ? `
          <div id="step1">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('groups', 18, 'var(--centrly-blue-700)')}
              <span>الخطوة 1: إنشاء مجموعتك الأولى</span>
            </h3>
            <div class="form-group">
              <label class="form-label">اسم المجموعة / الصف الدراسي</label>
              <input type="text" id="obGroupName" class="form-input" value="${defaultState.groupName}" placeholder="مثال: أولى ثانوي - سنتر الأوائل" required>
            </div>
            <div class="form-group">
              <label class="form-label">سعر الحصة للطالب (جنيه مصري)</label>
              <input type="number" id="obSessionPrice" class="form-input" value="${defaultState.sessionPrice}" placeholder="100" min="0" required>
            </div>
            <div style="display: flex; justify-content: flex-end; margin-top: 1.5rem;">
              <button class="btn btn-primary" onclick="window.centrlyApp.nextOnboardingStep(2)">
                التالي: إضافة الطلاب
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Step 2: Quick Add Students -->
        ${step === 2 ? `
          <div id="step2">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
              <h3 style="font-size: 1.1rem; font-weight: 700; margin: 0; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('students', 18, 'var(--centrly-blue-700)')}
                <span>الخطوة 2: إضافة طلاب المجموعة سريعاً</span>
              </h3>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.addQuickStudentRow()" style="display: inline-flex; align-items: center; gap: 0.35rem;">
                ${getIcon('add', 14)}
                <span>إضافة طالب آخر</span>
              </button>
            </div>
            <p style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 1rem;">
              أدخل أسماء الطلاب وأرقام أولياء الأمور لتجهيز كروت الباركود وإرسال الإشعارات:
            </p>
            
            <div id="quickStudentsList" style="max-height: 240px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.65rem; margin-bottom: 1.5rem;">
              ${defaultState.students.map((s, idx) => `
                <div class="student-row" style="display: flex; gap: 0.5rem; align-items: center;">
                  <span style="font-size: 0.8rem; font-weight: 700; color: var(--centrly-text); width: 24px;">${idx + 1}.</span>
                  <input type="text" class="form-input ob-student-name" value="${s.name}" placeholder="اسم الطالب" style="flex: 1;">
                  <input type="tel" class="form-input ob-student-phone" value="${s.phone}" placeholder="رقم ولي الأمر (010...)" dir="ltr" style="flex: 1;">
                </div>
              `).join('')}
            </div>

            <div style="display: flex; justify-content: space-between;">
              <button class="btn btn-secondary" onclick="window.centrlyApp.nextOnboardingStep(1)">
                السابق
              </button>
              <button class="btn btn-primary" onclick="window.centrlyApp.nextOnboardingStep(3)">
                التالي: إعدادات سير العمل
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Step 3: Workflow Settings (DEV-38) -->
        ${step === 3 ? `
          <div id="step3">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 1rem; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('dashboard', 18, 'var(--centrly-blue-700)')}
              <span>الخطوة 3: تفضيلات سير العمل للمدرس</span>
            </h3>
            
            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label">طريقة فحص وتصحيح الواجب الدراسي:</label>
              <div style="display: flex; flex-direction: column; gap: 0.5rem; margin-top: 0.5rem;">
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
                  <input type="radio" name="obHomework" value="in_session" ${defaultState.homeworkSubmission === 'in_session' ? 'checked' : ''}>
                  <span>فحص واستلام الواجب ورقياً أثناء الحصة (المعتاد)</span>
                </label>
                <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; cursor: pointer;">
                  <input type="radio" name="obHomework" value="online_before_session" ${defaultState.homeworkSubmission === 'online_before_session' ? 'checked' : ''}>
                  <span>تسليم الواجب أونلاين قبل موعد الحصة</span>
                </label>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 1.5rem;">
              <label class="form-label">إشعارات الواتساب بعد إنهاء الحصة:</label>
              <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; margin-top: 0.5rem; cursor: pointer;">
                <input type="checkbox" id="obAutoNotification" ${defaultState.autoNotification ? 'checked' : ''}>
                <span>إتاحة زر إرسال الإشعارات الجماعي للغياب وملاحظات الحصة فور إنهاء الحصة</span>
              </label>
            </div>

            <div style="display: flex; justify-content: space-between;">
              <button class="btn btn-secondary" onclick="window.centrlyApp.nextOnboardingStep(2)">
                السابق
              </button>
              <button class="btn btn-primary" onclick="window.centrlyApp.saveOnboardingDataAndGoToStep4()">
                حفظ والمتابعة إلى ربط واتساب
              </button>
            </div>
          </div>
        ` : ''}

        <!-- Step 4: WhatsApp Connect (DEV-SSO.3) -->
        ${step === 4 ? `
          <div id="step4" style="text-align: center;">
            <h3 style="font-size: 1.1rem; font-weight: 700; margin-bottom: 0.5rem; color: var(--centrly-ink); display: flex; align-items: center; justify-content: center; gap: 0.4rem;">
              ${getIcon('whatsapp', 18, 'var(--centrly-blue-700)')}
              <span>الخطوة 4: ربط رقم الواتساب بالمنظومة</span>
            </h3>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin-bottom: 1.5rem;">
              امسح رمز الاستجابة السريعة (QR Code) أو استخدم كود الاقتران لربط رقم واتساب لإرسال الإشعارات لأولياء الأمور
            </p>

            <div style="display: inline-block; padding: 1.25rem; background: #fff; border: 2px dashed var(--centrly-blue-700); border-radius: var(--radius-md); margin-bottom: 1.25rem;">
              <div id="obQrWrapper" style="width: 180px; height: 180px; background: #f1f5f9; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); margin: 0 auto; overflow: hidden;">
                <img id="obQrImage" src="${defaultState.qrBase64 || ''}" alt="WhatsApp QR Code" style="width: 100%; height: 100%; object-fit: contain; ${defaultState.qrBase64 ? '' : 'display: none;'}">
                <div id="obQrLoading" style="font-size: 0.8rem; color: var(--centrly-text); padding: 1rem; ${defaultState.qrBase64 ? 'display: none;' : ''}">
                  جارٍ إنشاء رمز QR...
                </div>
              </div>
              <div id="obPairingContainer" style="margin-top: 0.75rem; font-size: 0.85rem; font-weight: 700; color: var(--centrly-ink);">
                كود الاقتران: <span id="obPairingCode" style="font-family: monospace; color: var(--centrly-blue-800);">${defaultState.pairingCode || '---'}</span>
              </div>
            </div>

            <div style="display: flex; justify-content: center; gap: 0.5rem; margin-bottom: 1.5rem;">
              <span class="badge ${defaultState.waConnected ? 'badge-success' : 'badge-warning'}" id="obWaStatusBadge">
                ${defaultState.waConnected ? `${getIcon('dotSuccess', 8)} بوابة الإرسال متصلة وجاهزة` : `${getIcon('dotWarning', 8)} بانتظار مسح رمز QR`}
              </span>
            </div>

            <!-- Test WhatsApp message sender -->
            <div style="max-width: 420px; margin: 0 auto 1.5rem; text-align: right; background: var(--centrly-surface); padding: 1rem; border-radius: var(--radius-md); border: 1px solid var(--centrly-line);">
              <label class="form-label" style="font-size: 0.8rem;">إرسال رسالة تجريبية لهاتفك للتحقق:</label>
              <div style="display: flex; gap: 0.5rem;">
                <input type="tel" id="obTestPhone" class="form-input" placeholder="01012345678" dir="ltr" style="font-size: 0.85rem;">
                <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.sendTestWhatsAppMessage()">
                  إرسال تجربة
                </button>
              </div>
              <div id="obTestMsgResult" style="font-size: 0.75rem; margin-top: 0.5rem; display: none;"></div>
            </div>

            <div style="display: flex; justify-content: space-between;">
              <button class="btn btn-secondary" onclick="window.centrlyApp.nextOnboardingStep(3)">
                السابق
              </button>
              <button class="btn btn-primary" onclick="window.centrlyApp.finishOnboarding()">
                إنهاء والذهاب إلى لوحة التحكم
              </button>
            </div>
          </div>
        ` : ''}

      </div>
    </div>
  `;
}
