import { getIcon } from '../utils/icons.js';

export function renderAuthScreens() {
  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: var(--centrly-surface); padding: 1.5rem;">
      <div class="card" style="max-width: 440px; width: 100%; padding: 2rem; box-shadow: var(--shadow-lg); position: relative;">
        
        <div style="margin-bottom: 1rem; text-align: right;">
          <button type="button" onclick="window.centrlyApp.renderLanding()" style="background: none; border: none; color: var(--centrly-blue-700); cursor: pointer; font-size: 0.825rem; font-weight: 700; font-family: 'Cairo', sans-serif; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.2rem 0.4rem; border-radius: 6px;" onmouseover="this.style.backgroundColor='#eff6ff'" onmouseout="this.style.backgroundColor='transparent'">
            <span>← العودة للصفحة الرئيسية</span>
          </button>
        </div>

        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div class="brand-logo-badge" style="margin: 0 auto 0.75rem; width: 56px; height: 56px; background: linear-gradient(135deg, #1e3a8a, #2563eb); border-radius: 14px; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(37,99,235,0.25);">
            <svg width="30" height="30" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" fill="#F59E0B"/>
              <path d="M12 15L3 10.09L12 5.18L21 10.09L12 15Z" fill="#FFFFFF" fill-opacity="0.95"/>
            </svg>
          </div>
          <h2 style="font-family: 'Changa', sans-serif; font-size: 1.5rem; font-weight: 800; margin: 0; color: var(--centrly-ink);">
            <span style="color: var(--centrly-blue-700);">سنتر</span><span style="color: #f59e0b;">لي</span>
            <span style="font-size: 1rem; font-weight: 600; color: var(--centrly-text);">| Centrly</span>
          </h2>
          <p style="font-size: 0.85rem; color: var(--centrly-text); margin-top: 0.25rem;">المنظومة الذكية لإدارة الحصص والمجاميع وحضور الطلاب</p>
        </div>

        <div style="display: flex; border-bottom: 1px solid var(--centrly-line); margin-bottom: 1.5rem;">
          <button id="tabLogin" class="btn" style="flex: 1; border-radius: 0; border-bottom: 2px solid var(--centrly-blue-700); font-weight: 700; color: var(--centrly-blue-800);" onclick="window.centrlyApp.switchAuthTab('login')">تسجيل الدخول</button>
          <button id="tabSignup" class="btn" style="flex: 1; border-radius: 0; border-bottom: 2px solid transparent; font-weight: 600; color: var(--centrly-text);" onclick="window.centrlyApp.switchAuthTab('signup')">حساب جديد</button>
        </div>

        <div id="authAlert" style="display: none; padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.825rem;"></div>

        <!-- Login Form -->
        <form id="formLogin" onsubmit="window.centrlyApp.handleLogin(event)">
          <div class="form-group">
            <label class="form-label">البريد الإلكتروني أو رقم الهاتف</label>
            <input type="text" id="loginEmail" class="form-input" placeholder="example@email.com أو 010xxxxxxxx" required dir="ltr" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label">كلمة المرور</label>
            <div style="position: relative; display: flex; align-items: center;">
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="current-password">
              <button type="button" class="password-toggle-btn" onclick="(window.centrlyApp?.togglePasswordVisibility || window.togglePasswordVisibility)?.('loginPassword', this, event)" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>
          <div style="display: flex; justify-content: flex-start; margin-top: 0.25rem; margin-bottom: 0.85rem;">
            <button type="button" onclick="window.centrlyApp.openForgotPasswordModal()" style="background: none; border: none; padding: 0; color: var(--centrly-blue-700); font-size: 0.8rem; font-weight: 700; cursor: pointer; text-decoration: underline; font-family: inherit;">
              نسيت كلمة المرور؟
            </button>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 0.5rem; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <span>دخول إلى المنظومة</span>
          </button>
        </form>

        <!-- Signup Form -->
        <form id="formSignup" style="display: none;" onsubmit="window.centrlyApp.handleSignup(event)">
          <input type="hidden" id="signupAccountType" value="teacher">

          <!-- Teacher Fields -->
          <div id="roleFieldsTeacher">
            <div class="form-group">
              <label class="form-label">اسم المدرس *</label>
              <input type="text" id="signupName" class="form-input" placeholder="اسم المدرس بالكامل" required>
            </div>
            <div class="form-group" style="margin-top: 0.85rem;">
              <label class="form-label">المادة التعليمية</label>
              <input type="text" id="signupSubject" class="form-input" placeholder="اكتب المادة التعليمية (مثال: لغة عربية، فيزياء، رياضيات...)" autocomplete="off">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">البريد الإلكتروني *</label>
            <input type="email" id="signupEmail" class="form-input" placeholder="teacher@example.com" required dir="ltr" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label">رقم الواتساب (مصري) *</label>
            <input type="tel" id="signupPhone" class="form-input" placeholder="رقم الهاتف" required dir="ltr" autocomplete="tel">
          </div>
          <div class="form-group">
            <label class="form-label">كلمة المرور *</label>
            <div style="position: relative; display: flex; align-items: center;">
              <input type="password" id="signupPassword" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;" oninput="window.centrlyApp.validatePasswordLive(this.value)" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="new-password">
              <button type="button" class="password-toggle-btn" onclick="(window.centrlyApp?.togglePasswordVisibility || window.togglePasswordVisibility)?.('signupPassword', this, event)" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                ${getIcon('eye', 18)}
              </button>
            </div>
            
            <!-- Real-time Criteria Checklist -->
            <div id="passwordChecklist" style="margin-top: 0.5rem; background: #f8fafc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.6rem 0.75rem; font-size: 0.775rem;">
              <div style="font-weight: 600; color: var(--centrly-ink); margin-bottom: 0.35rem;">شروط كلمة المرور:</div>
              <div id="ruleLength" style="display: flex; align-items: center; gap: 0.4rem; color: #94a3b8; transition: color 0.2s;">
                <span id="iconLength">${getIcon('dotNeutral', 8)}</span>
                <span>8 أحرف أو أكثر</span>
              </div>
              <div id="ruleNumber" style="display: flex; align-items: center; gap: 0.4rem; color: #94a3b8; transition: color 0.2s; margin-top: 0.25rem;">
                <span id="iconNumber">${getIcon('dotNeutral', 8)}</span>
                <span>رقم واحد على الأقل (0-9)</span>
              </div>
              <div id="ruleUpper" style="display: flex; align-items: center; gap: 0.4rem; color: #94a3b8; transition: color 0.2s; margin-top: 0.25rem;">
                <span id="iconUpper">${getIcon('dotNeutral', 8)}</span>
                <span>حرف كبير واحد على الأقل (A-Z)</span>
              </div>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">تأكيد كلمة المرور *</label>
            <div style="position: relative; display: flex; align-items: center;">
              <input type="password" id="signupPasswordConfirm" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="new-password">
              <button type="button" class="password-toggle-btn" onclick="(window.centrlyApp?.togglePasswordVisibility || window.togglePasswordVisibility)?.('signupPasswordConfirm', this, event)" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>
          <div style="margin-top: 1rem; display: flex; align-items: flex-start; gap: 0.5rem; font-size: 0.8rem; color: var(--centrly-text);">
            <input type="checkbox" id="signupTermsConsent" required style="margin-top: 0.2rem; cursor: pointer;">
            <label for="signupTermsConsent" style="cursor: pointer; line-height: 1.5;">
              أوافق على <button type="button" onclick="window.centrlyApp.openPolicyModal('terms')" style="background: none; border: none; padding: 0; color: var(--centrly-blue, #2949BA); text-decoration: underline; font-weight: 700; cursor: pointer; font-family: inherit; font-size: inherit;">شروط وأحكام الاستخدام</button> و <button type="button" onclick="window.centrlyApp.openPolicyModal('privacy')" style="background: none; border: none; padding: 0; color: var(--centrly-blue, #2949BA); text-decoration: underline; font-weight: 700; cursor: pointer; font-family: inherit; font-size: inherit;">سياسة الخصوصية</button>.
            </label>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <span>إنشاء حساب وبدء التجربة المجانية</span>
          </button>
        </form>
      </div>

      <!-- Forgot Password Modal -->
      <div id="forgotPasswordModal" class="modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;">
        <div class="card modal-dialog" style="max-width: 420px; width: 100%; padding: 1.75rem; border-radius: var(--radius-lg); position: relative; box-shadow: var(--shadow-lg);" onclick="event.stopPropagation()">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink);">استعادة كلمة المرور</h3>
            <button type="button" onclick="window.centrlyApp.closeForgotPasswordModal()" style="background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px;">
              ${getIcon('close', 20)}
            </button>
          </div>
          <p style="font-size: 0.85rem; color: var(--centrly-text); line-height: 1.6; margin-top: 0; margin-bottom: 1.25rem;">
            أدخل بريدك الإلكتروني المسجل وسنرسل لك رابطاً آمناً لتعيين كلمة مرور جديدة لحسابك.
          </p>
          <div id="forgotPasswordAlert" style="display: none; padding: 0.65rem 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.825rem;"></div>
          <form id="formForgotPassword" onsubmit="window.centrlyApp.handleForgotPassword(event)">
            <div class="form-group">
              <label class="form-label">البريد الإلكتروني المسجل</label>
              <input type="email" id="forgotEmail" class="form-input" placeholder="teacher@example.com" required dir="ltr" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="email">
            </div>
            <button type="submit" id="forgotSubmitBtn" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.75rem; font-weight: 700;">
              <span>إرسال رابط الاستعادة</span>
            </button>
          </form>
        </div>
      </div>

      <!-- Reset Password Modal (When opened with recovery token) -->
      <div id="resetPasswordModal" class="modal-overlay" style="display: none; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.65); backdrop-filter: blur(4px); z-index: 9999; align-items: center; justify-content: center; padding: 1rem;">
        <div class="card modal-dialog" style="max-width: 420px; width: 100%; padding: 1.75rem; border-radius: var(--radius-lg); position: relative; box-shadow: var(--shadow-lg);" onclick="event.stopPropagation()">
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink);">تعيين كلمة المرور الجديدة</h3>
          <p style="font-size: 0.85rem; color: var(--centrly-text); line-height: 1.6; margin-top: 0; margin-bottom: 1rem;">
            أدخل كلمة المرور الجديدة للحساب. يجب أن تحتوي على 8 أحرف على الأقل، ورقم، وحرف كبير.
          </p>
          <div id="resetPasswordAlert" style="display: none; padding: 0.65rem 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.825rem;"></div>
          <form id="formResetPassword" onsubmit="window.centrlyApp.handleResetPasswordSubmit(event)">
            <input type="hidden" id="resetPasswordToken" value="">
            <div class="form-group">
              <label class="form-label">كلمة المرور الجديدة</label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="password" id="resetNewPassword" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="new-password">
                <button type="button" class="password-toggle-btn" onclick="(window.centrlyApp?.togglePasswordVisibility || window.togglePasswordVisibility)?.('resetNewPassword', this, event)" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                  ${getIcon('eye', 18)}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">تأكيد كلمة المرور الجديدة</label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="password" id="resetConfirmPassword" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="new-password">
                <button type="button" class="password-toggle-btn" onclick="(window.centrlyApp?.togglePasswordVisibility || window.togglePasswordVisibility)?.('resetConfirmPassword', this, event)" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                  ${getIcon('eye', 18)}
                </button>
              </div>
            </div>
            <button type="submit" id="btnSubmitResetPassword" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.75rem; font-weight: 700;">
              <span>حفظ وتحديث كلمة المرور</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  `;
}

export function renderEmailVerificationScreen({ email = '', note = '' } = {}) {
  const safeEmail = email ? email.replace(/[<>"'&]/g, '') : '';
  const safeNote = note ? note.replace(/[<>"'&]/g, '') : '';

  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: var(--centrly-surface); padding: 1.5rem;">
      <div class="card" style="max-width: 460px; width: 100%; padding: 2.25rem; box-shadow: var(--shadow-lg); text-align: center; position: relative;">
        
        <!-- Header Brand / Logo -->
        <div style="margin: 0 auto 1.25rem; width: 68px; height: 68px; background: linear-gradient(135deg, #0f766e, #0d9488); border-radius: 20px; display: flex; align-items: center; justify-content: center; box-shadow: 0 10px 24px rgba(13, 148, 136, 0.25);">
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="20" height="16" x="2" y="4" rx="2"/>
            <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7"/>
          </svg>
        </div>

        <h2 style="font-family: 'Changa', sans-serif; font-size: 1.6rem; font-weight: 800; margin: 0 0 0.5rem 0; color: var(--centrly-ink);">
          تأكيد وتفعيل حسابك 📲
        </h2>

        <p style="font-size: 0.9rem; color: var(--centrly-text); line-height: 1.6; margin-top: 0; margin-bottom: 0.5rem;">
          أرسلنا رمز التحقق المكون من 6 أرقام إلى <strong>واتساب رقم هاتفك</strong> وإلى بريدك الإلكتروني:
        </p>
        
        <div style="display: inline-block; background: #f8fafc; border: 1px solid var(--centrly-line); padding: 0.4rem 1rem; border-radius: 8px; font-weight: 700; color: #0f766e; font-family: monospace; font-size: 0.95rem; margin-bottom: 0.6rem;" dir="ltr">
          ${safeEmail}
        </div>

        <div style="margin-bottom: 1.25rem;">
          <button type="button" onclick="window.centrlyApp.handleReturnToEditEmail()" style="background: #f0f9ff; border: 1px solid #bae6fd; color: #0369a1; padding: 0.45rem 0.9rem; border-radius: 8px; font-size: 0.825rem; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 0.4rem; font-family: inherit; transition: all 0.2s;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
            <span>البريد الإلكتروني غير صحيح؟ تعديل البريد والبيانات</span>
          </button>
        </div>

        <div id="verificationAlert" style="${safeNote ? 'display: block; background: #f0fdf4; color: #166534; border: 1px solid #bbf7d0;' : 'display: none;'} padding: 0.75rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-size: 0.85rem; font-weight: 600; line-height: 1.5;">
          ${safeNote}
        </div>

        <!-- Verification Form -->
        <form id="formVerifyEmail" onsubmit="window.centrlyApp.handleVerifyEmailSubmit(event)">
          <input type="hidden" id="verificationEmailInput" value="${safeEmail}">
          <div class="form-group" style="margin-bottom: 1.5rem; text-align: center;">
            <label class="form-label" style="text-align: center; display: block; font-weight: 700; margin-bottom: 0.6rem; font-size: 0.9rem; color: var(--centrly-ink);">
              أدخل رمز التحقق المكون من 6 أرقام
            </label>
            <input type="text" id="verifyOtpCode" class="form-input" maxlength="6" pattern="[0-9]{6}" inputmode="numeric" placeholder="••••••" required dir="ltr" style="font-size: 2rem; letter-spacing: 0.65rem; text-align: center; font-weight: 800; font-family: monospace; height: 60px; border-radius: 12px; border: 2px solid #0d9488; background: #fafafa;" autocomplete="one-time-code" autofocus>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.4rem;">
              صلاحية الرمز 15 دقيقة فقط
            </div>
            <div style="font-size: 0.8rem; color: #065f46; margin-top: 0.55rem; background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 0.55rem 0.85rem; line-height: 1.5; text-align: center;">
              📲 <strong>تحقق من واتساب هاتفك الآن:</strong> تم إرسال كود التفعيل في رسالة واتساب، بالإضافة إلى نسخة على بريدك الإلكتروني (راجع مجلد Spam إذا لم يظهر بالوارد).
            </div>
          </div>

          <button type="submit" id="btnVerifySubmit" class="btn btn-primary" style="width: 100%; padding: 0.85rem; font-size: 1rem; font-weight: 800; border-radius: 10px; display: flex; align-items: center; justify-content: center; gap: 0.5rem; background: linear-gradient(135deg, #0f766e, #0d9488); border: none;">
            <span>تأكيد الحساب والبدء</span>
          </button>
        </form>

        <div style="margin-top: 1.5rem; padding-top: 1.25rem; border-top: 1px solid var(--centrly-line); display: flex; flex-direction: column; gap: 0.85rem;">
          <button type="button" id="btnResendOtp" onclick="window.centrlyApp.handleResendOtp()" style="background: none; border: none; color: #0d9488; font-size: 0.875rem; font-weight: 700; cursor: pointer; text-decoration: underline; font-family: inherit;">
            لم يصلك الرمز؟ إعادة الإرسال
          </button>

          <button type="button" onclick="window.centrlyApp.handleReturnToEditEmail()" style="background: none; border: none; color: #0284c7; font-size: 0.85rem; font-weight: 700; cursor: pointer; text-decoration: underline; font-family: inherit;">
            البريد الإلكتروني غير صحيح؟ تعديل البيانات والبريد
          </button>

          <button type="button" onclick="window.centrlyApp.renderAuth('login')" style="background: none; border: none; color: var(--centrly-text); font-size: 0.825rem; cursor: pointer; font-family: inherit;">
            العودة لصفحة تسجيل الدخول
          </button>
        </div>

      </div>
    </div>
  `;
}

