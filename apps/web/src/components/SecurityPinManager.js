import { request } from '../services/api.js';
import { authService } from '../services/auth.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { getIcon } from '../utils/icons.js';
import { normalizeDigits } from '../utils/normalizeDigits.js';

/**
 * Centrly Security PIN Protection Module
 * Handles PIN modal, OTP via email, verification, locking/unlocking financials
 */
export function registerSecurityPinActions(app) {
  // Security PIN Protection (Sensitive Financials & Salaries)
  // ==========================================================================

  app.openSetPinModal = function(forceExisting = false, initialTab = 'old_pin') {
    const hasExisting = Boolean(forceExisting || this.hasSecurityPin || this.user?.has_security_pin);
    this._currentPinTab = hasExisting ? initialTab : 'old_pin';
    const userEmail = this.user?.email || '';

    const bodyHtml = `
      <div style="text-align: center; margin-bottom: 1.25rem;">
        <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('lock', 36, '#2563eb')}</div>
        <h4 style="margin: 0 0 0.4rem; color: #0f172a; font-weight: 800;">
          ${hasExisting ? 'تعديل أو إعادة ضبط رمز الأمان (PIN)' : 'تعيين رمز الأمان (PIN)'}
        </h4>
        <p style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.5;">
          ${hasExisting 
            ? 'لحماية خصوصيتك التامة، لا يمكن تغيير الرمز إلا باستخدام الرمز القديم أو عبر كود تحقق يُرسل لبريدك الإلكتروني.' 
            : 'رمز رقمي سريع من 4 إلى 6 أرقام لحماية أرباحك ومرتبات المساعدين ومزامنته سحابياً عبر جميع أجهزتك.'}
        </p>
      </div>

      ${hasExisting ? `
      <!-- Method Selector Tabs -->
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1.25rem; background: #f1f5f9; padding: 0.35rem; border-radius: 12px;">
        <button type="button" id="btnTabPinOld" class="btn ${this._currentPinTab === 'old_pin' ? 'btn-primary' : 'btn-secondary'}"
          onclick="window.centrlyApp.switchPinModalTab('old_pin')"
          style="flex: 1; font-weight: 800; font-size: 0.825rem; padding: 0.5rem; border-radius: 8px; border: none; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
          ${getIcon('lock', 15)}
          <span>باستخدام الرمز القديم</span>
        </button>
        <button type="button" id="btnTabPinEmail" class="btn ${this._currentPinTab === 'email' ? 'btn-primary' : 'btn-secondary'}"
          onclick="window.centrlyApp.switchPinModalTab('email')"
          style="flex: 1; font-weight: 800; font-size: 0.825rem; padding: 0.5rem; border-radius: 8px; border: none; display: flex; align-items: center; justify-content: center; gap: 0.35rem;">
          ${getIcon('mail', 15)}
          <span>عبر البريد الإلكتروني</span>
        </button>
      </div>
      ` : ''}

      <form id="modalSetPinForm" novalidate onsubmit="window.centrlyApp.handleSavePinSubmit(event)">
        
        <!-- SECTION 1: Old PIN Mode -->
        <div id="sectionPinOld" style="display: ${!hasExisting || this._currentPinTab === 'old_pin' ? 'block' : 'none'};">
          ${hasExisting ? `
          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="font-weight: 700;">رمز الأمان الحالي (القديم) *</label>
            <div style="position: relative;">
              <input type="password" id="inputCurrentPin" class="form-input" placeholder="••••" maxlength="6" inputmode="numeric"
                style="text-align: center; font-size: 1.25rem; font-weight: 900; padding-left: 2.5rem; letter-spacing: 0.35rem;"
                autocomplete="current-password" autofocus
                oninput="this.value = this.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0)-1776)).replace(/\\D/g, '')">
              <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('inputCurrentPin', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء رمز الأمان" aria-label="إظهار/إخفاء رمز الأمان">
                ${getIcon('eye', 18)}
              </button>
            </div>
            <div style="text-align: left; margin-top: 0.35rem;">
              <a href="javascript:void(0)" onclick="window.centrlyApp.switchPinModalTab('email')" style="font-size: 0.775rem; color: #2563eb; font-weight: 700; text-decoration: underline;">
                نسيت الرمز القديم؟ إعادة التعيين عبر الإيميل
              </a>
            </div>
          </div>
          ` : ''}

          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="font-weight: 700;">${hasExisting ? 'رمز الأمان الجديد (4-6 أرقام) *' : 'رمز الأمان (4-6 أرقام) *'}</label>
            <div style="position: relative;">
              <input type="password" id="inputNewPin" class="form-input" placeholder="••••" maxlength="6" inputmode="numeric"
                style="text-align: center; letter-spacing: 0.35rem; font-size: 1.3rem; font-weight: 900; padding-left: 2.5rem;"
                autocomplete="new-password" ${hasExisting ? '' : 'autofocus'}
                oninput="this.value = this.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0)-1776)).replace(/\\D/g, '')">
              <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('inputNewPin', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء رمز الأمان" aria-label="إظهار/إخفاء رمز الأمان">
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label" style="font-weight: 700;">${hasExisting ? 'تأكيد رمز الأمان الجديد *' : 'تأكيد رمز الأمان *'}</label>
            <div style="position: relative;">
              <input type="password" id="inputConfirmPin" class="form-input" placeholder="••••" maxlength="6" inputmode="numeric"
                style="text-align: center; letter-spacing: 0.35rem; font-size: 1.3rem; font-weight: 900; padding-left: 2.5rem;"
                autocomplete="new-password"
                oninput="this.value = this.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0)-1776)).replace(/\\D/g, '')">
              <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('inputConfirmPin', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء رمز الأمان" aria-label="إظهار/إخفاء رمز الأمان">
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>
        </div>

        <!-- SECTION 2: Email OTP Mode -->
        ${hasExisting ? `
        <div id="sectionPinEmail" style="display: ${this._currentPinTab === 'email' ? 'block' : 'none'};">
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 0.85rem; margin-bottom: 1rem; text-align: center;">
            <div style="font-size: 0.8rem; color: #64748b; margin-bottom: 0.25rem;">البريد الإلكتروني المسجل للحساب:</div>
            <div dir="ltr" style="font-size: 0.95rem; font-weight: 800; color: #0f172a;">${escapeHtml(userEmail || 'البريد المسجل')}</div>
          </div>

          <div style="margin-bottom: 1rem;">
            <button type="button" id="btnRequestPinOtp" onclick="window.centrlyApp.handleRequestPinResetOtp()" class="btn btn-secondary"
              style="width: 100%; font-weight: 800; padding: 0.65rem; border-color: #2563eb; color: #2563eb; background: #eff6ff; display: inline-flex; align-items: center; justify-content: center; gap: 0.4rem; border-radius: 8px;">
              ${getIcon('send', 16, '#2563eb')}
              <span id="txtRequestPinOtp">إرسال كود التحقق إلى البريد الإلكتروني</span>
            </button>
            <div id="pinOtpStatusMsg" style="display: none; font-size: 0.775rem; color: #16a34a; font-weight: 700; margin-top: 0.4rem; text-align: center;"></div>
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="font-weight: 700;">كود التحقق المرسل للإيميل (6 أرقام) *</label>
            <input type="text" id="inputEmailOtpCode" class="form-input" placeholder="••••••" maxlength="6" inputmode="numeric"
              style="text-align: center; letter-spacing: 0.4rem; font-size: 1.3rem; font-weight: 900;"
              autocomplete="one-time-code"
              oninput="this.value = this.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0)-1776)).replace(/\\D/g, '')">
          </div>

          <div class="form-group" style="margin-bottom: 1rem;">
            <label class="form-label" style="font-weight: 700;">رمز الأمان الجديد (4-6 أرقام) *</label>
            <div style="position: relative;">
              <input type="password" id="inputEmailNewPin" class="form-input" placeholder="••••" maxlength="6" inputmode="numeric"
                style="text-align: center; letter-spacing: 0.35rem; font-size: 1.3rem; font-weight: 900; padding-left: 2.5rem;"
                autocomplete="new-password"
                oninput="this.value = this.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0)-1776)).replace(/\\D/g, '')">
              <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('inputEmailNewPin', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء رمز الأمان" aria-label="إظهار/إخفاء رمز الأمان">
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 1.25rem;">
            <label class="form-label" style="font-weight: 700;">تأكيد رمز الأمان الجديد *</label>
            <div style="position: relative;">
              <input type="password" id="inputEmailConfirmPin" class="form-input" placeholder="••••" maxlength="6" inputmode="numeric"
                style="text-align: center; letter-spacing: 0.35rem; font-size: 1.3rem; font-weight: 900; padding-left: 2.5rem;"
                autocomplete="new-password"
                oninput="this.value = this.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0)-1776)).replace(/\\D/g, '')">
              <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('inputEmailConfirmPin', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء رمز الأمان" aria-label="إظهار/إخفاء رمز الأمان">
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>
        </div>
        ` : ''}

        <div id="pinErrorMsg" style="display: none; color: #ef4444; font-size: 0.85rem; font-weight: 700; margin-bottom: 1rem; text-align: center;"></div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" id="btnSubmitSetPin" onclick="window.centrlyApp.handleSavePinSubmit(event)" class="btn btn-primary" style="font-weight: 800;">
            ${hasExisting ? 'حفظ وتأكيد الرمز' : 'حفظ وتفعيل الرمز'}
          </button>
        </div>
      </form>
    `;

    this.showModal(hasExisting ? 'تعديل أو إعادة ضبط رمز الأمان (PIN)' : 'تعيين رمز الأمان لأول مرة', bodyHtml);
    setTimeout(() => {
      if (this._currentPinTab === 'email') {
        document.getElementById('inputEmailOtpCode')?.focus();
      } else if (hasExisting) {
        document.getElementById('inputCurrentPin')?.focus();
      } else {
        document.getElementById('inputNewPin')?.focus();
      }
    }, 150);
  }

  app.switchPinModalTab = function(tab) {
    this._currentPinTab = tab;
    const btnOld = document.getElementById('btnTabPinOld');
    const btnEmail = document.getElementById('btnTabPinEmail');
    const secOld = document.getElementById('sectionPinOld');
    const secEmail = document.getElementById('sectionPinEmail');
    const errEl = document.getElementById('pinErrorMsg');
    if (errEl) errEl.style.display = 'none';

    if (tab === 'email') {
      if (btnEmail) { btnEmail.className = 'btn btn-primary'; }
      if (btnOld) { btnOld.className = 'btn btn-secondary'; }
      if (secEmail) secEmail.style.display = 'block';
      if (secOld) secOld.style.display = 'none';
      document.getElementById('inputEmailOtpCode')?.focus();
    } else {
      if (btnOld) { btnOld.className = 'btn btn-primary'; }
      if (btnEmail) { btnEmail.className = 'btn btn-secondary'; }
      if (secOld) secOld.style.display = 'block';
      if (secEmail) secEmail.style.display = 'none';
      document.getElementById('inputCurrentPin')?.focus();
    }
  }

  app.handleRequestPinResetOtp = async function() {
    const btn = document.getElementById('btnRequestPinOtp');
    const txt = document.getElementById('txtRequestPinOtp');
    const statusMsg = document.getElementById('pinOtpStatusMsg');
    const errEl = document.getElementById('pinErrorMsg');

    if (errEl) errEl.style.display = 'none';
    if (btn) btn.disabled = true;
    if (txt) txt.innerText = 'جارٍ إرسال كود التحقق...';

    try {
      const res = await request('/settings/security-pin/request-reset', { method: 'POST' });
      if (statusMsg) {
        statusMsg.innerText = res?.message || 'تم إرسال كود التحقق (6 أرقام) إلى بريدك الإلكتروني.';
        statusMsg.style.display = 'block';
      }
      this.showToast('تم إرسال كود التحقق إلى بريدك الإلكتروني بنجاح.', 'success');
      document.getElementById('inputEmailOtpCode')?.focus();

      let cooldown = 60;
      if (btn) btn.disabled = true;
      const interval = setInterval(() => {
        cooldown -= 1;
        if (cooldown <= 0) {
          clearInterval(interval);
          if (btn) btn.disabled = false;
          if (txt) txt.innerText = 'إعادة إرسال كود التحقق';
        } else {
          if (txt) txt.innerText = `إعادة الإرسال بعد ${cooldown} ثانية`;
        }
      }, 1000);
    } catch (err) {
      if (btn) btn.disabled = false;
      if (txt) txt.innerText = 'إرسال كود التحقق إلى البريد الإلكتروني';
      if (errEl) {
        const isAuthExpired = err.status === 401 || String(err.message || '').includes('token') || String(err.message || '').includes('UNAUTHORIZED') || String(err.message || '').includes('صلاحية');
        if (isAuthExpired) {
          errEl.innerHTML = `
            <div style="margin-bottom: 0.5rem; line-height: 1.5;">انتهت صلاحية جلسة تسجيل الدخول. يرجى تسجيل الدخول مجدداً لإرسال كود التحقق.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.centrlyApp.renderAuth('login')" style="padding: 0.35rem 1.25rem; font-weight: 800; font-size: 0.85rem;">
              تسجيل الدخول مجدداً
            </button>
          `;
        } else {
          errEl.innerText = err.message || 'فشل إرسال كود التحقق إلى البريد الإلكتروني.';
        }
        errEl.style.display = 'block';
      }
    }
  }

  app.togglePinVisibility = function(inputId, btn) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass ? '<span style="font-size: 0.75rem; font-weight: 700; color: #2563eb;">إخفاء</span>' : '<span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">إظهار</span>';
  }

  app.handleSavePinSubmit = async function(e) {
    if (e && e.preventDefault) e.preventDefault();
    const secEmail = document.getElementById('sectionPinEmail');
    const isEmailMode = this._currentPinTab === 'email' || (secEmail && secEmail.style.display !== 'none');
    const hasExisting = Boolean(document.getElementById('btnTabPinOld') || document.getElementById('inputCurrentPin'));
    const errEl = document.getElementById('pinErrorMsg');
    const btn = document.getElementById('btnSubmitSetPin');
    if (errEl) errEl.style.display = 'none';

    const cleanDigits = (val) => normalizeDigits(val || '').replace(/\s+/g, '').replace(/\D/g, '');

    const showError = (msg, inputToFocus) => {
      if (errEl) {
        errEl.innerText = msg;
        errEl.style.display = 'block';
      }
      if (inputToFocus) inputToFocus.focus();
    };

    let payload = {};

    if (isEmailMode) {
      const rawCode = document.getElementById('inputEmailOtpCode')?.value || '';
      const email_code = cleanDigits(rawCode);
      const rawNew = document.getElementById('inputEmailNewPin')?.value || '';
      const pin = cleanDigits(rawNew);
      const rawConfirm = document.getElementById('inputEmailConfirmPin')?.value || '';
      const confirm = cleanDigits(rawConfirm);

      if (!email_code || email_code.length !== 6) {
        showError('يرجى إدخال كود التحقق المكون من 6 أرقام المرسل لبريدك الإلكتروني.', document.getElementById('inputEmailOtpCode'));
        return;
      }
      if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        showError('يجب أن يتكون رمز الأمان الجديد من 4 إلى 6 أرقام فقط.', document.getElementById('inputEmailNewPin'));
        return;
      }
      if (pin !== confirm) {
        showError('رمزا الأمان الجديدان غير متطابقين، يرجى إعادة الإدخال.', document.getElementById('inputEmailConfirmPin'));
        return;
      }

      payload = { pin, email_code };
    } else {
      const rawCurrent = document.getElementById('inputCurrentPin')?.value || '';
      const old_pin = cleanDigits(rawCurrent);
      const rawNew = document.getElementById('inputNewPin')?.value || '';
      const pin = cleanDigits(rawNew);
      const rawConfirm = document.getElementById('inputConfirmPin')?.value || '';
      const confirm = cleanDigits(rawConfirm);

      if (hasExisting) {
        if (!old_pin || old_pin.length < 4 || old_pin.length > 6) {
          showError('يرجى إدخال رمز الأمان القديم المكون من 4 إلى 6 أرقام، أو اختر "عبر البريد الإلكتروني" إذا نسيته.', document.getElementById('inputCurrentPin'));
          return;
        }
        if (pin === old_pin) {
          showError('رمز الأمان الجديد يجب أن يكون مختلفاً عن الرمز القديم.', document.getElementById('inputNewPin'));
          return;
        }
      }

      if (!pin || pin.length < 4 || pin.length > 6 || !/^\d+$/.test(pin)) {
        showError('يجب أن يتكون رمز الأمان الجديد من 4 إلى 6 أرقام فقط.', document.getElementById('inputNewPin'));
        return;
      }
      if (pin !== confirm) {
        showError('رمزا الأمان الجديدان غير متطابقين، يرجى إعادة الإدخال.', document.getElementById('inputConfirmPin'));
        return;
      }

      payload = hasExisting ? { pin, old_pin } : { pin };
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جارٍ التحقق والحفظ...';
    }

    try {
      await request('/settings/security-pin', {
        method: 'POST',
        body: payload
      });
      localStorage.setItem('centrly_has_security_pin', 'true');
      this.hasSecurityPin = true;
      this.isFinancialUnlocked = true;
      if (this.user) {
        this.user.has_security_pin = true;
        authService.setUser(this.user);
      }
      this.closeModal();
      this.showToast(hasExisting ? 'تم تأكيد هويتك وتحديث رمز الأمان بنجاح ومزامنته سحابياً.' : 'تم تعيين وتفعيل رمز الأمان بنجاح.', 'success');
      this.renderApp();
    } catch (err) {
      showError(err.message || 'الرمز القديم أو كود التحقق من الإيميل غير صحيح. يرجى التأكد وإعادة المحاولة.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = hasExisting ? 'حفظ وتأكيد الرمز' : 'حفظ وتفعيل الرمز';
      }
    }
  }

  app.promptUnlockFinancials = function() {
    if (!this.hasSecurityPin) {
      this.openSetPinModal();
      return;
    }

    const bodyHtml = `
      <form id="modalUnlockPinForm" onsubmit="window.centrlyApp.handleUnlockPinSubmit(event)">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('lock', 36, '#ef4444')}</div>
          <h4 style="margin: 0 0 0.4rem; color: #0f172a; font-weight: 800;">
            إلغاء قفل البيانات المالية
          </h4>
          <p style="font-size: 0.85rem; color: #64748b; margin: 0;">
            أدخل رمز الأمان (PIN) المكون من 4 إلى 6 أرقام لعرض تفاصيل الأرباح والمرتبات.
          </p>
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
          <div style="position: relative;">
            <input type="password" id="inputUnlockPin" class="form-input" placeholder="••••" maxlength="6" inputmode="numeric" autofocus required
              style="text-align: center; font-size: 1.35rem; font-weight: 900; padding-left: 2.5rem; letter-spacing: 0.35rem;"
              autocomplete="current-password"
              oninput="this.value = this.value.replace(/[٠-٩]/g, d => String(d.charCodeAt(0)-1632)).replace(/[۰-۹]/g, d => String(d.charCodeAt(0)-1776)).replace(/\\D/g, '')">
            <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('inputUnlockPin', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء رمز الأمان" aria-label="إظهار/إخفاء رمز الأمان">
              ${getIcon('eye', 18)}
            </button>
          </div>
        </div>

        <div id="unlockPinError" style="display: none; color: #ef4444; font-size: 0.85rem; font-weight: 700; margin-bottom: 1rem; text-align: center;"></div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.resetFinancialPinPrompt()" style="font-size: 0.775rem; color: #2563eb; font-weight: 700;">
            نسيت الرمز؟ إعادة ضبط
          </button>
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
            <button type="submit" id="btnSubmitUnlockPin" class="btn btn-primary" style="font-weight: 800;">فتح البيانات الآن</button>
          </div>
        </div>
      </form>
    `;
    this.showModal('تأكيد رمز الأمان (PIN)', bodyHtml);
    setTimeout(() => {
      document.getElementById('inputUnlockPin')?.focus();
    }, 150);
  }

  app.handleUnlockPinSubmit = async function(e) {
    e.preventDefault();
    const rawVal = document.getElementById('inputUnlockPin')?.value || '';
    const entered = normalizeDigits(rawVal);
    const errEl = document.getElementById('unlockPinError');
    const btn = document.getElementById('btnSubmitUnlockPin');

    if (!entered || entered.length < 4 || entered.length > 6 || !/^\d+$/.test(entered)) {
      if (errEl) {
        errEl.innerText = 'يرجى إدخال رمز الأمان المكون من 4 إلى 6 أرقام فقط.';
        errEl.style.display = 'block';
      }
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جارٍ التحقق...';
    }

    try {
      const res = await request('/settings/verify-pin', {
        method: 'POST',
        body: { pin: entered }
      });
      if (res && res.valid) {
        localStorage.setItem('centrly_has_security_pin', 'true');
        this.hasSecurityPin = true;
        this.isFinancialUnlocked = true;
        if (this.user) {
          this.user.has_security_pin = true;
          authService.setUser(this.user);
        }
        this.closeModal();
        this.showToast('تم إلغاء القفل وعرض البيانات بنجاح.', 'success');
        this.renderApp();
        return;
      }
      
      // Explicit invalid PIN response
      if (errEl) {
        const remaining = res?.error?.remaining_attempts;
        const remainingNote = (typeof remaining === 'number' && remaining > 0) ? ` (متبقي ${remaining} محاولات قبل القفل)` : '';
        errEl.innerText = (res?.error?.message || 'رمز الأمان غير صحيح.') + remainingNote + ' يمكنك إعادة المحاولة أو النقر على "نسيت الرمز؟ إعادة ضبط" للتعيين عبر البريد الإلكتروني.';
        errEl.style.display = 'block';
      }
      const inp = document.getElementById('inputUnlockPin');
      if (inp) {
        inp.value = '';
        inp.focus();
      }
    } catch (err) {
      if (errEl) {
        const isLocked = err.status === 423 || String(err.message || '').includes('PIN_LOCKED');
        const isAuthExpired = err.status === 401 || String(err.message || '').includes('token') || String(err.message || '').includes('UNAUTHORIZED') || String(err.message || '').includes('صلاحية');
        if (isLocked) {
          errEl.innerText = err.message || 'تم تجاوز الحد الأقصى للمحاولات الخاطئة (5 محاولات). تم قفل إدخال الرمز مؤقتاً لمدة 15 دقيقة.';
        } else if (isAuthExpired) {
          errEl.innerHTML = `
            <div style="margin-bottom: 0.5rem; line-height: 1.5;">انتهت صلاحية جلسة تسجيل الدخول لأسباب أمنية.</div>
            <button type="button" class="btn btn-primary btn-sm" onclick="window.centrlyApp.renderAuth('login')" style="padding: 0.35rem 1.25rem; font-weight: 800; font-size: 0.85rem;">
              تسجيل الدخول مجدداً
            </button>
          `;
        } else {
          errEl.innerText = err.message || 'تعذر التحقق من الرمز السري، يرجى التأكد من اتصال الإنترنت.';
        }
        errEl.style.display = 'block';
      }
      const inp = document.getElementById('inputUnlockPin');
      if (inp) {
        inp.focus();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'فتح البيانات الآن';
      }
    }
  }

  app.lockFinancials = function() {
    this.isFinancialUnlocked = false;
    if (typeof document !== 'undefined' && document.querySelector?.('[data-assistant-pay]')) this.closeModal();
    this.showToast('تم قفل البيانات الحساسة بنجاح.', 'info');
    this.renderApp();
  }

  app.toggleHideFinancialNumbers = function() {
    this.hideFinancialNumbers = !this.hideFinancialNumbers;
    if (this.hideFinancialNumbers && typeof document !== 'undefined' && document.querySelector?.('[data-assistant-pay]')) this.closeModal();
    this.showToast(this.hideFinancialNumbers ? 'تم إخفاء الأرقام المالية.' : 'تم إظهار الأرقام المالية.', 'info');
    this.renderMainContent();
  }

  app.resetFinancialPinPrompt = function() {
    // Open the secure PIN update modal defaulting to email recovery
    this.openSetPinModal(true, 'email');
  }
}
