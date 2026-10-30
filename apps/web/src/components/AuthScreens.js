import { authService } from '../services/auth.js';
import { request } from '../services/api.js';
import { escapeHtml } from '../utils/escapeHtml.js';
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
            <label class="form-label" for="loginEmail">البريد الإلكتروني أو رقم الهاتف</label>
            <input type="text" id="loginEmail" class="form-input" placeholder="example@email.com أو 010xxxxxxxx" required dir="ltr" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="username">
          </div>
          <div class="form-group">
            <label class="form-label" for="loginPassword">كلمة المرور</label>
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
              <label class="form-label" for="signupName">اسم المدرس *</label>
              <input type="text" id="signupName" class="form-input" placeholder="اسم المدرس بالكامل" required>
            </div>
            <div class="form-group" style="margin-top: 0.85rem;">
              <label class="form-label" for="signupSubject">المادة التعليمية</label>
              <input type="text" id="signupSubject" class="form-input" placeholder="اكتب المادة التعليمية (مثال: لغة عربية، فيزياء، رياضيات...)" autocomplete="off">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label" for="signupEmail">البريد الإلكتروني *</label>
            <input type="email" id="signupEmail" class="form-input" placeholder="teacher@example.com" required dir="ltr" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="email">
          </div>
          <div class="form-group">
            <label class="form-label" for="signupPhone">رقم الهاتف الأساسي *</label>
            <input type="tel" id="signupPhone" class="form-input" placeholder="010..." required dir="ltr" autocomplete="tel">
          </div>
          <div class="form-group" style="margin-top: 0.85rem;">
            <label class="form-label" for="signupContactPhone">رقم واتساب للتواصل مع الطلاب وأولياء الأمور 💬</label>
            <input type="tel" id="signupContactPhone" class="form-input" placeholder="رقم واتساب المدرس أو المساعد (اختياري - إن ترك فارغاً سيتم استخدام نفس الرقم)" dir="ltr" autocomplete="tel">
            <div style="font-size: 0.73rem; color: #64748b; margin-top: 0.25rem;">
              يظهر هذا الرقم في بوابات الطلاب وأولياء الأمور كزر مباشر للتواصل معك عبر واتساب.
            </div>
          </div>
          <div class="form-group">
            <label class="form-label" for="signupPassword">كلمة المرور *</label>
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
            <label class="form-label" for="signupPasswordConfirm">تأكيد كلمة المرور *</label>
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
              <label class="form-label" for="forgotEmail">البريد الإلكتروني المسجل</label>
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
              <label class="form-label" for="resetNewPassword">كلمة المرور الجديدة</label>
              <div style="position: relative; display: flex; align-items: center;">
                <input type="password" id="resetNewPassword" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;" autocapitalize="none" autocorrect="off" spellcheck="false" autocomplete="new-password">
                <button type="button" class="password-toggle-btn" onclick="(window.centrlyApp?.togglePasswordVisibility || window.togglePasswordVisibility)?.('resetNewPassword', this, event)" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                  ${getIcon('eye', 18)}
                </button>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label" for="resetConfirmPassword">تأكيد كلمة المرور الجديدة</label>
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
          تأكيد وتفعيل حسابك
        </h2>

        <p style="font-size: 0.9rem; color: var(--centrly-text); line-height: 1.6; margin-top: 0; margin-bottom: 0.5rem;">
          أرسلنا رمز التحقق المكون من 6 أرقام إلى بريدك الإلكتروني:
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
              <strong>تحقق من صندوق الوارد:</strong> تم إرسال رمز التحقق إلى بريدك الإلكتروني (يرجى مراجعة مجلد الرسائل غير المرغوب فيها Spam إذا لم يظهر في الوارد).
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



/**
 * Register Authentication & Account Lifecycle Actions (DEV-89)
 */
export function registerAuthActions(app) {
  app.renderAuth = function renderAuth(tab = 'login') {
    window.__centrlyLoaded = true;
    this.resetTenantState();
    window.scrollTo(0, 0);
    const appEl = this.getAppEl();
    if (appEl) appEl.innerHTML = renderAuthScreens();
    if (tab === 'signup') {
      this.switchAuthTab('signup');
    } else {
      this.switchAuthTab('login');
    }

    // Auto-dismiss auth error banner when user begins typing
    const alertBox = document.getElementById('authAlert');
    const inputs = document.querySelectorAll('#formLogin input, #formSignup input');
    inputs.forEach(inp => {
      inp.addEventListener('input', () => {
        if (alertBox && alertBox.style.display !== 'none') {
          alertBox.style.display = 'none';
        }
      });
    });
  }

  app.switchAuthTab = function switchAuthTab(tab) {
    document.title = tab === 'signup' ? 'إنشاء حساب جديد | سنترلي' : 'تسجيل الدخول | سنترلي';
    const formLogin = document.getElementById('formLogin');
    const formSignup = document.getElementById('formSignup');
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const alertBox = document.getElementById('authAlert');
    if (alertBox) alertBox.style.display = 'none';

    if (tab === 'login') {
      formLogin.style.display = 'block';
      formSignup.style.display = 'none';
      tabLogin.style.borderBottom = '2px solid var(--centrly-blue-700)';
      tabLogin.style.color = 'var(--centrly-blue-800)';
      tabSignup.style.borderBottom = '2px solid transparent';
      tabSignup.style.color = 'var(--centrly-text)';
    } else {
      formLogin.style.display = 'none';
      formSignup.style.display = 'block';
      tabSignup.style.borderBottom = '2px solid var(--centrly-blue-700)';
      tabSignup.style.color = 'var(--centrly-blue-800)';
      tabLogin.style.borderBottom = '2px solid transparent';
      tabLogin.style.color = 'var(--centrly-text)';
    }
  }

  app.showAuthAlert = function showAuthAlert(msg, type = 'danger', isHtml = false) {
    const alertBox = document.getElementById('authAlert');
    if (!alertBox) return;
    if (isHtml) {
      alertBox.innerHTML = msg;
    } else {
      alertBox.textContent = msg;
    }
    alertBox.style.display = 'block';
    if (type === 'danger') {
      alertBox.className = 'badge-danger';
      alertBox.style.backgroundColor = 'var(--centrly-danger-light)';
      alertBox.style.color = 'var(--centrly-danger)';
    } else {
      alertBox.className = 'badge-success';
      alertBox.style.backgroundColor = 'var(--centrly-success-light)';
      alertBox.style.color = 'var(--centrly-success)';
    }
  }

  app.switchToLoginWithEmail = function switchToLoginWithEmail(email) {
    this.switchAuthTab('login');
    setTimeout(() => {
      const emailInput = document.getElementById('loginIdentifier') || document.getElementById('loginEmail');
      if (emailInput && email) {
        emailInput.value = email;
        const pwdInput = document.getElementById('loginPassword');
        if (pwdInput) pwdInput.focus();
      }
    }, 60);
  }

  app.switchToLoginWithPhone = function switchToLoginWithPhone(phone) {
    this.switchToLoginWithEmail(phone);
  }

  app.togglePasswordVisibility = function togglePasswordVisibility(inputId, btnEl, event) {
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }
    const input = typeof inputId === 'string' ? document.getElementById(inputId) : inputId;
    if (!input) {
      console.warn('[Centrly] togglePasswordVisibility: input not found for id:', inputId);
      return;
    }
    const isPassword = input.type === 'password';
    const newType = isPassword ? 'text' : 'password';
    input.type = newType;
    try {
      input.setAttribute('type', newType);
    } catch (_) {}

    // Find and update button element
    const btn = btnEl?.closest?.('button') || btnEl || input.parentElement?.querySelector('button');
    if (btn) {
      btn.innerHTML = getIcon(isPassword ? 'eyeOff' : 'eye', 18);
      btn.title = isPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور';
      btn.setAttribute('aria-label', isPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      btn.style.opacity = '1';
    }

    // Preserve focus and cursor position if currently focused
    if (document.activeElement === input) {
      try {
        if (input.setSelectionRange && input.value) {
          const len = input.value.length;
          input.setSelectionRange(len, len);
        }
      } catch (_) {}
    }
  }

  app.validatePasswordLive = function validatePasswordLive(pwd) {
    const ruleLen = document.getElementById('ruleLength');
    const ruleNum = document.getElementById('ruleNumber');
    const ruleUp = document.getElementById('ruleUpper');
    const iconLen = document.getElementById('iconLength');
    const iconNum = document.getElementById('iconNumber');
    const iconUp = document.getElementById('iconUpper');

    const hasLen = pwd.length >= 8;
    const hasNum = /\d/.test(pwd);
    const hasUp = /[A-Z]/.test(pwd);

    if (ruleLen) {
      ruleLen.style.color = hasLen ? 'var(--centrly-success)' : '#94a3b8';
      ruleLen.style.fontWeight = hasLen ? '700' : '400';
      if (iconLen) iconLen.innerHTML = getIcon(hasLen ? 'dotSuccess' : 'dotNeutral', 8);
    }
    if (ruleNum) {
      ruleNum.style.color = hasNum ? 'var(--centrly-success)' : '#94a3b8';
      ruleNum.style.fontWeight = hasNum ? '700' : '400';
      if (iconNum) iconNum.innerHTML = getIcon(hasNum ? 'dotSuccess' : 'dotNeutral', 8);
    }
    if (ruleUp) {
      ruleUp.style.color = hasUp ? 'var(--centrly-success)' : '#94a3b8';
      ruleUp.style.fontWeight = hasUp ? '700' : '400';
      if (iconUp) iconUp.innerHTML = getIcon(hasUp ? 'dotSuccess' : 'dotNeutral', 8);
    }
  }

  app.onAccountTypeChange = function onAccountTypeChange(type) {
    const teacherGroup = document.getElementById('roleFieldsTeacher');
    const centerGroup = document.getElementById('roleFieldsCenter');
    const signupName = document.getElementById('signupName');
    const ownerName = document.getElementById('signupCenterOwnerName');
    const centerName = document.getElementById('signupCenterName');
    if (type === 'center') {
      if (teacherGroup) teacherGroup.style.display = 'none';
      if (centerGroup) centerGroup.style.display = 'block';
      if (signupName) signupName.required = false;
      if (ownerName) ownerName.required = true;
      if (centerName) centerName.required = true;
    } else {
      if (teacherGroup) teacherGroup.style.display = 'block';
      if (centerGroup) centerGroup.style.display = 'none';
      if (signupName) signupName.required = true;
      if (ownerName) ownerName.required = false;
      if (centerName) centerName.required = false;
    }
  }

  app.openForgotPasswordModal = function openForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'flex';
    const alertBox = document.getElementById('forgotPasswordAlert');
    if (alertBox) alertBox.style.display = 'none';
  }

  app.closeForgotPasswordModal = function closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'none';
  }

  app.handleForgotPassword = async function handleForgotPassword(e) {
    e.preventDefault();
    const emailInput = document.getElementById('forgotEmail');
    const alertBox = document.getElementById('forgotPasswordAlert');
    const btn = document.getElementById('btnSubmitForgotPassword');
    const email = emailInput?.value?.trim().toLowerCase();
    if (!email) return;

    try {
      if (btn) { btn.disabled = true; btn.innerText = 'جاري الإرسال...'; }
      await authService.forgotPassword(email);
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#f0fdf4';
        alertBox.style.color = '#15803d';
        alertBox.style.border = '1px solid #bbf7d0';
        alertBox.innerText = 'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني بنجاح. يرجى فحص صندوق الوارد ورسائل البريد المزعج (Spam).';
      }
      if (emailInput) emailInput.value = '';
    } catch (err) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#b91c1c';
        alertBox.style.border = '1px solid #fecaca';
        alertBox.innerText = err.message || 'تعذر إرسال رابط الاستعادة، يرجى التأكد من البريد والمحاولة ثانية.';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = 'إرسال رابط الاستعادة'; }
    }
  }

  app.openResetPasswordModal = function openResetPasswordModal(token) {
    const modal = document.getElementById('resetPasswordModal');
    if (modal) {
      modal.style.display = 'flex';
      const tokenInput = document.getElementById('resetPasswordToken');
      if (tokenInput) tokenInput.value = token;
      const alertBox = document.getElementById('resetPasswordAlert');
      if (alertBox) alertBox.style.display = 'none';
    }
  }

  app.closeResetPasswordModal = function closeResetPasswordModal() {
    const modal = document.getElementById('resetPasswordModal');
    if (modal) modal.style.display = 'none';
  }

  app.handleResetPasswordSubmit = async function handleResetPasswordSubmit(e) {
    e.preventDefault();
    const token = document.getElementById('resetPasswordToken')?.value?.trim();
    const newPassword = document.getElementById('resetNewPassword')?.value?.trim();
    const confirmPassword = document.getElementById('resetConfirmPassword')?.value?.trim();
    const alertBox = document.getElementById('resetPasswordAlert');
    const btn = document.getElementById('btnSubmitResetPassword');

    if (!newPassword || !confirmPassword) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#b91c1c';
        alertBox.innerText = 'يرجى إدخال وتأكيد كلمة المرور الجديدة';
      }
      return;
    }

    if (newPassword !== confirmPassword) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#b91c1c';
        alertBox.innerText = 'كلمتا المرور غير متطابقتين';
      }
      return;
    }

    if (newPassword.length < 8) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#b91c1c';
        alertBox.innerText = 'يجب ألا تقل كلمة المرور عن 8 أحرف';
      }
      return;
    }

    try {
      if (btn) { btn.disabled = true; btn.innerText = 'جاري الحفظ...'; }
      await authService.resetPassword(token, newPassword);
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#f0fdf4';
        alertBox.style.color = '#15803d';
        alertBox.innerText = 'تم تحديث كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول.';
      }
      setTimeout(() => {
        this.closeResetPasswordModal();
        this.renderAuth('login');
      }, 1500);
    } catch (err) {
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.style.background = '#fef2f2';
        alertBox.style.color = '#b91c1c';
        alertBox.innerText = err.message || 'فشل تحديث كلمة المرور، قد يكون الرابط منتهي الصلاحية.';
      }
    } finally {
      if (btn) { btn.disabled = false; btn.innerText = 'تعيين كلمة المرور والدخول'; }
    }
  }

  app.handleLogin = async function handleLogin(e) {
    e.preventDefault();
    const btn = e.target?.querySelector?.('button[type="submit"]');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:1rem;height:1rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-left:0.5rem;vertical-align:middle;"></span> جارٍ تسجيل الدخول...';
    }

    let rawIdentifier = document.getElementById('loginEmail')?.value?.trim() || '';
    if (!rawIdentifier.includes('@')) {
      rawIdentifier = rawIdentifier
        .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 1632))
        .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 1776))
        .trim();
    }
    const password = document.getElementById('loginPassword')?.value?.trim() || '';

    try {
      const res = await authService.login(rawIdentifier, password);
      this.resetTenantState();
      this.user = res.user;
      try {
        const meRes = await request('/auth/me');
        if (meRes?.user) {
          this.user = { ...res.user, ...meRes.user };
          authService.setUser(this.user);
        }
      } catch (_) {}
      this.restoreCachedData();

      // Cross-Device Security: Bind PIN status directly from account profile
      if (typeof this.user?.has_security_pin === 'boolean') {
        this.hasSecurityPin = this.user.has_security_pin;
        if (this.hasSecurityPin) {
          this.isFinancialUnlocked = false;
          try {
            localStorage.setItem('centrly_has_security_pin', 'true');
          } catch (_) {}
        }
      }

      // Check cloud security PIN status for cross-device synchronization
      try {
        const pinStatus = await request('/settings/security-pin').catch(() => null);
        if (pinStatus && typeof pinStatus.has_pin === 'boolean') {
          this.hasSecurityPin = pinStatus.has_pin;
          if (this.hasSecurityPin) {
            this.isFinancialUnlocked = false;
          }
          if (this.user) {
            this.user.has_security_pin = pinStatus.has_pin;
            authService.setUser(this.user);
          }
          try {
            localStorage.setItem('centrly_has_security_pin', pinStatus.has_pin ? 'true' : 'false');
          } catch (_) {}
        }
      } catch (_) {}

      const isAdmin = this.user?.role === 'admin';
      const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
      const adminRoutes = ['admin-dashboard', 'admin-proofs', 'admin-tenants', 'admin-outreach', 'coupons', 'activity-logs'];
      const redirectRoute = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_redirect_route')) ||
                            (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_redirect_route'));

      if (isAdmin) {
        if (redirectRoute && adminRoutes.includes(redirectRoute)) {
          this.currentRoute = redirectRoute;
          try {
            sessionStorage.removeItem('centrly_redirect_route');
            localStorage.removeItem('centrly_redirect_route');
          } catch (_) {}
        } else {
          this.currentRoute = 'admin-dashboard';
        }
      } else if (isCenter) {
        this.currentRoute = (redirectRoute && !adminRoutes.includes(redirectRoute)) ? redirectRoute : 'center-dashboard';
      } else {
        this.currentRoute = (redirectRoute && !adminRoutes.includes(redirectRoute)) ? redirectRoute : 'dashboard';
      }

      try {
        if (typeof localStorage !== 'undefined') localStorage.setItem('centrly_current_route', this.currentRoute);
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('centrly_current_route', this.currentRoute);
      } catch (_) {}

      // Scrub view=login from browser address bar
      try {
        if (window.history && window.history.replaceState) {
          const url = new URL(window.location.href);
          url.searchParams.delete('view');
          const cleanUrl = url.pathname + (url.search ? url.search : '');
          window.history.replaceState(null, '', cleanUrl);
        }
      } catch (_) {}

      this.startProactiveSessionRefresher();
      this.renderApp();
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED' || err.message?.includes('EMAIL_NOT_VERIFIED') || err.message?.includes('تأكيد بريدك')) {
        const unverifiedEmail = err.email || (rawIdentifier.includes('@') ? rawIdentifier : '');
        const loginPhone = rawIdentifier.includes('@') ? '' : rawIdentifier;
        const fallbackSignupData = {
          email: unverifiedEmail,
          phone: loginPhone,
          password: password,
        };
        this.renderEmailVerificationView(unverifiedEmail, password, 'يرجى تأكيد بريدك الإلكتروني أولاً للمتابعة. تم إرسال رمز التحقق إلى بريدك.', fallbackSignupData);
        return;
      }
      let loginMsg = err.message || '';
      if (loginMsg === 'INVALID_CREDENTIALS' || loginMsg.includes('INVALID_CREDENTIALS') || err.status === 401) {
        loginMsg = 'البريد الإلكتروني أو رقم الهاتف أو كلمة المرور غير صحيحة.';
      } else if (loginMsg.includes('Failed to fetch') || loginMsg.includes('NetworkError') || loginMsg.includes('Bearer token')) {
        loginMsg = 'تعذر الاتصال بالخادم حالياً. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.';
      }
      this.showAuthAlert(loginMsg || 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  app.handleSignup = async function handleSignup(e) {
    e.preventDefault();
    const btn = e.target?.querySelector?.('button[type="submit"]');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:1rem;height:1rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-left:0.5rem;vertical-align:middle;"></span> جارٍ إنشاء الحساب...';
    }

    const accountType = document.getElementById('signupAccountType')?.value || 'teacher';
    let name = '';
    let tenantName = '';

    if (accountType === 'center') {
      const ownerName = document.getElementById('signupCenterOwnerName')?.value?.trim();
      const centerName = document.getElementById('signupCenterName')?.value?.trim();
      if (!ownerName || !centerName) {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
        this.showAuthAlert('يرجى إدخال اسم المسؤول واسم السنتر التعليمي');
        return;
      }
      name = ownerName;
      tenantName = centerName;
    } else {
      name = document.getElementById('signupName')?.value?.trim();
      if (!name) {
        if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
        this.showAuthAlert('يرجى إدخال اسم المدرس');
        return;
      }
      tenantName = `${name} - منظومة تعليمية`;
    }

    const email = document.getElementById('signupEmail')?.value?.trim().toLowerCase() || '';
    const phone = normalizeDigits(document.getElementById('signupPhone')?.value?.trim() || '');
    const contactPhone = normalizeDigits(document.getElementById('signupContactPhone')?.value?.trim() || '') || phone;
    const password = document.getElementById('signupPassword')?.value?.trim() || '';
    const passwordConfirm = document.getElementById('signupPasswordConfirm')?.value?.trim() || '';

    if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
      this.showAuthAlert('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل، وتحتوي على رقم واحد وحرف كبير واحد');
      return;
    }

    if (passwordConfirm && password !== passwordConfirm) {
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
      this.showAuthAlert('كلمتا المرور غير متطابقتين. يرجى التأكد وإعادة المحاولة.');
      return;
    }

    const ownerName = document.getElementById('signupCenterOwnerName')?.value?.trim() || '';
    const centerName = document.getElementById('signupCenterName')?.value?.trim() || '';
    const subject = document.getElementById('signupSubject')?.value?.trim() || '';

    this.signupFormData = {
      accountType,
      name,
      ownerName,
      centerName,
      tenantName,
      email,
      phone,
      contact_phone: contactPhone,
      subject,
      password,
      passwordConfirm,
    };
    try {
      if (typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('centrly_signup_form_data', JSON.stringify(this.signupFormData));
      }
    } catch (_) {}

    try {
      const res = await authService.signup({
        email,
        password,
        full_name: name,
        tenant_name: tenantName,
        phone,
        contact_phone: contactPhone,
        subject,
        account_type: accountType,
      });

      if (res.requires_verification) {
        this.renderEmailVerificationView(email, password, 'تم إنشاء الحساب بنجاح! تم إرسال رمز التحقق إلى بريدك الإلكتروني.', this.signupFormData);
        return;
      }

      this.user = {
        ...(res.user || {}),
        full_name: name || res.user?.full_name,
        name: name || res.user?.name,
        phone: phone || res.user?.phone,
        contact_phone: contactPhone || res.user?.contact_phone || phone,
        subject: subject || res.user?.subject,
      };
      authService.setUser(this.user);
      this.startOnboarding();
    } catch (err) {
      const errMsg = err.message || '';
      const isPhoneExists = err.code === 'PHONE_ALREADY_EXISTS' ||
                            errMsg.includes('PHONE_ALREADY_EXISTS') ||
                            errMsg.includes('رقم الهاتف') ||
                            errMsg.includes('بحساب آخر') ||
                            errMsg.toLowerCase().includes('phone_already_exists');
      const isAlreadyExists = !isPhoneExists && (
                              err.code === 'USER_ALREADY_EXISTS' ||
                              errMsg.includes('USER_ALREADY_EXISTS') ||
                              errMsg.includes('البريد الإلكتروني مسجل بالفعل') ||
                              errMsg.includes('هذا البريد الإلكتروني مسجل بالفعل') ||
                              errMsg.includes('already registered') ||
                              errMsg.toLowerCase().includes('already exists') ||
                              errMsg.toLowerCase().includes('user already exists') ||
                              errMsg.toLowerCase().includes('user_already_exists')
                            );

      if (isPhoneExists) {
        const safePhone = (phone || '').replace(/'/g, "\\'");
        const friendlyHtml = `
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.6rem; text-align:right;">
            <span style="line-height:1.5;">رقم الهاتف (${safePhone || 'هذا'}) مسجل بالفعل بحساب آخر. يمكنك تسجيل الدخول به مباشرة أو استخدام رقم هاتف آخر.</span>
            <button type="button" onclick="window.centrlyApp.switchToLoginWithPhone('${safePhone}')" style="background:#2563eb; color:#ffffff; border:none; border-radius:6px; padding:0.35rem 0.85rem; font-size:0.8rem; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
              تسجيل الدخول بالرقم ←
            </button>
          </div>
        `;
        this.showAuthAlert(friendlyHtml, 'danger', true);
      } else if (isAlreadyExists) {
        const safeEmail = (email || '').replace(/'/g, "\\'");
        const friendlyHtml = `
          <div style="display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:0.6rem; text-align:right;">
            <span style="line-height:1.5;">يوجد حساب مسجل بالفعل بهذا البريد الإلكتروني. جرب تسجيل الدخول بدلاً من ذلك.</span>
            <button type="button" onclick="window.centrlyApp.switchToLoginWithEmail('${safeEmail}')" style="background:#2563eb; color:#ffffff; border:none; border-radius:6px; padding:0.35rem 0.85rem; font-size:0.8rem; font-weight:700; cursor:pointer; font-family:inherit; white-space:nowrap; transition:opacity 0.2s;" onmouseover="this.style.opacity='0.9'" onmouseout="this.style.opacity='1'">
              تسجيل الدخول الآن ←
            </button>
          </div>
        `;
        this.showAuthAlert(friendlyHtml, 'danger', true);
      } else if (errMsg.includes('Bearer token') || errMsg.includes('Failed to fetch') || errMsg.includes('NetworkError')) {
        this.showAuthAlert('تعذر الاتصال بالخادم حالياً. يرجى التحقق من اتصال الإنترنت والمحاولة مرة أخرى.');
      } else {
        this.showAuthAlert(errMsg || 'فشل إنشاء الحساب. يرجى التأكد من البيانات والمحاولة مجدداً.');
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  app.renderEmailVerificationView = function renderEmailVerificationView(email, password = '', note = '', signupData = null) {
    window.scrollTo(0, 0);
    this.pendingVerification = { email, password, note, signupData: signupData || this.signupFormData };
    document.title = 'تأكيد البريد الإلكتروني | سنترلي';
    const appEl = this.getAppEl();
    if (appEl) appEl.innerHTML = renderEmailVerificationScreen({ email, note });
  }

  app.handleReturnToEditEmail = function handleReturnToEditEmail() {
    let data = this.pendingVerification?.signupData || this.signupFormData;
    if (!data) {
      try {
        const raw = typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_signup_form_data');
        if (raw) data = JSON.parse(raw);
      } catch (_) {}
    }
    data = data || {};

    this.renderAuth('signup');

    setTimeout(() => {
      if (data.accountType) {
        const typeSelect = document.getElementById('signupAccountType');
        if (typeSelect) {
          typeSelect.value = data.accountType;
          this.onAccountTypeChange(data.accountType);
        }
      }
      if (data.accountType === 'center') {
        const ownerInput = document.getElementById('signupCenterOwnerName');
        if (ownerInput && (data.ownerName || data.name)) ownerInput.value = data.ownerName || data.name;
        const centerInput = document.getElementById('signupCenterName');
        if (centerInput && (data.centerName || data.tenantName)) centerInput.value = data.centerName || data.tenantName;
      } else {
        const nameInput = document.getElementById('signupName');
        if (nameInput && data.name) nameInput.value = data.name;
        const subjectInput = document.getElementById('signupSubject');
        if (subjectInput && data.subject) subjectInput.value = data.subject;
      }

      const emailInput = document.getElementById('signupEmail');
      if (emailInput) {
        emailInput.value = data.email || this.pendingVerification?.email || '';
        emailInput.focus();
        emailInput.select();
      }

      const phoneInput = document.getElementById('signupPhone');
      if (phoneInput && data.phone) phoneInput.value = data.phone;

      const pwd = data.password || this.pendingVerification?.password;
      const pwdInput = document.getElementById('signupPassword');
      if (pwdInput && pwd) {
        pwdInput.value = pwd;
        this.validatePasswordLive(pwd);
      }

      const pwdConfirm = data.passwordConfirm || pwd;
      const pwdConfirmInput = document.getElementById('signupPasswordConfirm');
      if (pwdConfirmInput && pwdConfirm) {
        pwdConfirmInput.value = pwdConfirm;
      }

      const termsCheck = document.getElementById('signupTermsConsent');
      if (termsCheck) termsCheck.checked = true;
    }, 50);
  }

  app.showVerificationAlert = function showVerificationAlert(message, type = 'error') {
    const alertBox = document.getElementById('verificationAlert');
    if (!alertBox) return;
    alertBox.innerText = message;
    alertBox.style.display = 'block';
    if (type === 'success') {
      alertBox.style.backgroundColor = '#f0fdf4';
      alertBox.style.color = '#166534';
      alertBox.style.borderColor = '#bbf7d0';
    } else {
      alertBox.style.backgroundColor = '#fef2f2';
      alertBox.style.color = '#991b1b';
      alertBox.style.borderColor = '#fecaca';
    }
  }

  app.handleVerifyEmailSubmit = async function handleVerifyEmailSubmit(e) {
    e.preventDefault();
    const btn = document.getElementById('btnVerifySubmit');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:1rem;height:1rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-left:0.5rem;vertical-align:middle;"></span> جارٍ التأكيد...';
    }

    const email = document.getElementById('verificationEmailInput')?.value?.trim() || this.pendingVerification?.email || '';
    const code = document.getElementById('verifyOtpCode')?.value?.trim() || '';
    const password = this.pendingVerification?.password || '';

    if (!code || code.length !== 6) {
      if (btn) { btn.disabled = false; btn.innerHTML = origHtml; }
      this.showVerificationAlert('يرجى إدخال رمز التحقق المكون من 6 أرقام');
      return;
    }

    try {
      const res = await authService.verifyEmail(email, code, password);
      this.showVerificationAlert(res.message || 'تم تأكيد البريد الإلكتروني بنجاح!', 'success');

      if (res.user && res.token) {
        this.resetTenantState();
        this.user = res.user;
        try {
          const meRes = await request('/auth/me');
          if (meRes?.user) {
            this.user = { ...res.user, ...meRes.user };
            authService.setUser(this.user);
          }
        } catch (_) {}
        this.restoreCachedData();
        setTimeout(() => {
          this.startOnboarding();
        }, 800);
      } else {
        setTimeout(() => {
          this.renderAuth('login');
          const emailInput = document.getElementById('loginEmail');
          if (emailInput) emailInput.value = email;
          this.showAuthAlert('تم تأكيد حسابك بنجاح! يمكنك الآن تسجيل الدخول.');
        }, 1200);
      }
    } catch (err) {
      this.showVerificationAlert(err.message || 'رمز التحقق غير صحيح أو انتهت صلاحيته.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  app.handleResendOtp = async function handleResendOtp() {
    const btn = document.getElementById('btnResendOtp');
    const email = document.getElementById('verificationEmailInput')?.value?.trim() || this.pendingVerification?.email || '';

    if (!email) {
      this.showVerificationAlert('لم يتم العثور على البريد الإلكتروني.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جارٍ إرسال رمز جديد...';
    }

    try {
      const res = await authService.resendVerification(email);
      this.showVerificationAlert(res.message || 'تم إرسال رمز جديد إلى بريدك الإلكتروني بنجاح.', 'success');

      let timeLeft = 60;
      if (btn) {
        btn.disabled = true;
        const interval = setInterval(() => {
          timeLeft -= 1;
          if (timeLeft <= 0) {
            clearInterval(interval);
            btn.disabled = false;
            btn.innerText = 'لم يصلك الرمز؟ إعادة الإرسال';
          } else {
            btn.innerText = `إعادة الإرسال بعد (${timeLeft} ثانية)`;
          }
        }, 1000);
      }
    } catch (err) {
      this.showVerificationAlert(err.message || 'تعذر إعادة إرسال الرمز. يرجى الانتظار قليلاً.');
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'لم يصلك الرمز؟ إعادة الإرسال';
      }
    }
  }


}
