import {mountPhoneVerification} from './PhoneVerification.js';
import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { renderBillingView } from './BillingView.js?v=3.8.0';
import { request } from '../services/api.js';
import { authService } from '../services/auth.js';
import { normalizeDigits } from '../utils/normalizeDigits.js';

/**
 * Centrly Teacher Settings & Account Management View
 * Features:
 * 1. Profile & Teaching Info (Name, subject, phone, governorate)
 * 2. WhatsApp Gateway & Templates (Unified inside Settings)
 * 3. Subscription & Plan Quota (Unified full pricing & proofs inside Settings)
 * 4. Security & Password (Current password required + Forgot password link to email)
 */

function formatArabicDate(dateStr) {
  if (!dateStr) return 'غير محدد';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function renderTeacherSettingsView(state = {}, user = {}, billing = {}, whatsapp = {}, securityState = { hasPin: false, isUnlocked: true }) {
  let activeTab = state?.activeTab || 'profile';
  if (activeTab === 'appearance') activeTab = 'profile';
  const displayName = (user?.full_name || user?.name || '').replace(/^(أ\.\s*|مستر\s*|د\.\s*|أستاذ\s*)/, '').trim() || 'محمد خالد';
  const email = user?.email || '';
  const phone = user?.phone || '';
  const contactPhone = user?.contact_phone || user?.whatsapp_phone || billing?.settings?.contact_phone || phone;
  const subject = user?.subject || '';
  const tenantName = user?.tenant_name || '';

  // Billing Data
  const status = billing.subscription_status || billing.status || 'trial';
  const rawDate = billing.subscription_ends_at || billing.trial_ends_at || '';
  const formattedDate = formatArabicDate(rawDate);
  const currentStudents = billing.students_count || (window.centrlyApp?.students?.length || 0);
  const studentLimit = billing.students_limit || 300;
  const quotaPercent = Math.min(100, Math.round((currentStudents / studentLimit) * 100));

  let daysRemaining = typeof billing.days_remaining === 'number' ? billing.days_remaining : null;
  if (daysRemaining === null || (daysRemaining <= 0 && rawDate && new Date(rawDate).getTime() > Date.now())) {
    if (rawDate) {
      const ms = new Date(rawDate).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    } else {
      daysRemaining = 0;
    }
  }



  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      
      <!-- Top Header Card -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #172D70 0%, #2563eb 100%); color: #fff; border: none; border-radius: 16px; padding: 1.75rem; box-shadow: 0 10px 25px rgba(37,99,235,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span>${getIcon('gear', 24, '#fcd34d')}</span>
                <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: #fff;">
                  الإعدادات والاشتراك
                </h2>
            </div>
            <p style="font-size: 0.875rem; color: #cbd5e1; margin: 0;">
              تعديل بيانات المعلم، إدارة باقة الاشتراك، والأمان وكلمة المرور.
            </p>
          </div>

          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <div style="background: rgba(255,255,255,0.15); border: 1px solid rgba(255,255,255,0.25); padding: 0.4rem 0.85rem; border-radius: 10px; font-size: 0.8rem; font-weight: 700;">
              <span>${escapeHtml(user?.tenant_name || 'حساب تعليمي')}</span>
            </div>

          </div>
        </div>
      </div>

      <!-- Settings Navigation Tabs -->
      <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--centrly-line); padding-bottom: 0.65rem; overflow-x: auto; -webkit-overflow-scrolling: touch;">
        
        <button type="button" onclick="window.centrlyApp.switchSettingsTab('profile')"
          class="btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 1.15rem; border-radius: 10px; white-space: nowrap;">
          ${getIcon('teachers', 16)}
          <span>الملف الشخصي والمادة</span>
        </button>

        <button type="button" onclick="window.centrlyApp.switchSettingsTab('subscription')"
          class="btn ${activeTab === 'subscription' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 1.15rem; border-radius: 10px; white-space: nowrap;">
          ${getIcon('billing', 16)}
          <span>الباقة والاشتراكات</span>
        </button>

        <button type="button" onclick="window.centrlyApp.switchSettingsTab('security')"
          class="btn ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 1.15rem; border-radius: 10px; white-space: nowrap;">
          ${getIcon('lock', 16)}
          <span>الأمان وكلمة المرور</span>
        </button>

      </div>

      <!-- ================= TAB 1: PROFILE ================= -->
      <div id="settingsTabProfile" style="display: ${activeTab === 'profile' ? 'block' : 'none'};">
        <div class="card" style="margin: 0; padding: 1.75rem; border-radius: var(--radius-lg);">
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink);">
            بيانات المعلم والمنظومة
          </h3>
          <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1.5rem 0;">
            تظهر هذه البيانات في كروت الطلاب، الرسائل الرسمية، وجدول الحصص.
          </p>

          <form onsubmit="window.centrlyApp.handleSaveTeacherProfile(event)">
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.25rem;">
              
              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">اسم المعلم الشائع (كما يظهر للطلاب)</label>
                <input type="text" id="settingsTeacherName" class="form-input" value="${escapeHtml(displayName)}" required placeholder="اسم المعلم بالكامل">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">المادة التعليمية</label>
                <input type="text" id="settingsSubject" class="form-input" value="${escapeHtml(subject)}" placeholder="اكتب المادة التعليمية (مثال: لغة عربية، فيزياء...)" autocomplete="off">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">رقم الهاتف الأساسي (تسجيل الدخول)</label>
                <input type="tel" id="settingsPhone" class="form-input" value="${escapeHtml(phone)}" placeholder="010..." dir="ltr">
                <button type="button" class="btn btn-secondary" style="min-height:44px;margin-top:.75rem" onclick="window.centrlyApp.openTeacherPhoneVerification()">تأكيد رقم واتساب</button>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">رقم واتساب للتواصل مع الطلاب وأولياء الأمور 💬</label>
                <input type="tel" id="settingsContactPhone" class="form-input" value="${escapeHtml(contactPhone || phone)}" placeholder="010..." dir="ltr">
                <span style="font-size: 0.725rem; color: #64748b; margin-top: 0.25rem; display: block;">
                  يظهر هذا الرقم كزر مباشر في بوابات الطلاب وأولياء الأمور للتواصل معك عبر واتساب.
                </span>
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">البريد الإلكتروني (حساب الدخول)</label>
                <input type="email" class="form-input" value="${escapeHtml(email)}" disabled dir="ltr" style="opacity: 0.7; cursor: not-allowed; background: #f1f5f9;">
                <span style="font-size: 0.725rem; color: #94a3b8; margin-top: 0.25rem; display: block;">البريد الإلكتروني مرتبط بحسابك الأساسي ولا يمكن تغييره يدوياً.</span>
              </div>

            </div>

            <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end;">
              <button type="submit" id="saveProfileBtn" class="btn btn-primary" style="font-weight: 800; padding: 0.65rem 1.75rem; border-radius: 10px;">
                <span>حفظ التعديلات</span>
              </button>
            </div>
          </form>
        </div>
      </div>

      <!-- ================= TAB 3: SUBSCRIPTION ================= -->
      <div id="settingsTabSubscription" style="display: ${activeTab === 'subscription' ? 'block' : 'none'};">
        ${renderBillingView(billing, user)}
      </div>

      <!-- ================= TAB 4: SECURITY ================= -->
      <div id="settingsTabSecurity" style="display: ${activeTab === 'security' ? 'block' : 'none'};">
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Change Password Card -->
          <div class="card" style="margin: 0; padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1.25rem; border-bottom: 1.5px solid var(--centrly-line); padding-bottom: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.6rem;">
                <div style="width: 40px; height: 40px; border-radius: 10px; background: rgba(37,99,235,0.1); display: flex; align-items: center; justify-content: center;">
                  ${getIcon('lock', 22, 'var(--centrly-blue-700)')}
                </div>
                <div>
                  <h3 style="margin: 0; font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink);">
                    إدارة وأمان كلمة المرور
                  </h3>
                  <p style="font-size: 0.825rem; color: var(--centrly-text); margin: 0.2rem 0 0 0;">
                    تغيير كلمة المرور باشتراط كلمة المرور القديمة، أو طلب رابط استعادة فوري عبر بريدك الإلكتروني في حال نسيتها.
                  </p>
                </div>
              </div>
            </div>

            <div id="settingsPasswordAlert" style="display: none; padding: 0.75rem 1rem; border-radius: var(--radius-md); margin-bottom: 1.25rem; font-size: 0.85rem;"></div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(310px, 1fr)); gap: 1.25rem; align-items: stretch;">
              
              <!-- Option 1: Change using Old Password -->
              <div style="background: var(--centrly-surface); border: 1.5px solid var(--centrly-line); border-radius: 14px; padding: 1.35rem; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: var(--centrly-blue-700); color: #fff; font-size: 0.8rem; font-weight: 800;">1</span>
                    <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--centrly-ink);">
                      تغيير كلمة المرور (بمعرفة القديمة)
                    </h4>
                  </div>

                  <form id="formSettingsChangePassword" onsubmit="window.centrlyApp.handleSettingsChangePassword(event)">
                    <div style="display: flex; flex-direction: column; gap: 0.85rem;">
                      
                      <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">كلمة المرور الحالية (القديمة) *</label>
                        <div style="position: relative;">
                          <input type="password" id="settingsCurrentPassword" class="form-input" required placeholder="••••••••" dir="ltr" style="padding-left: 2.5rem;">
                          <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('settingsCurrentPassword', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                            ${getIcon('eye', 18)}
                          </button>
                        </div>
                      </div>

                      <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">كلمة المرور الجديدة *</label>
                        <div style="position: relative;">
                          <input type="password" id="settingsNewPassword" class="form-input" required placeholder="••••••••" dir="ltr" style="padding-left: 2.5rem;" oninput="window.centrlyApp.validateSettingsPasswordLive(this.value)">
                          <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('settingsNewPassword', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                            ${getIcon('eye', 18)}
                          </button>
                        </div>

                        <!-- Live Criteria -->
                        <div id="settingsPwdChecklist" style="margin-top: 0.4rem; background: #fff; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.45rem 0.65rem; font-size: 0.725rem;">
                          <div id="ruleSettingsLen" style="color: #94a3b8;">• 8 أحرف أو أكثر</div>
                          <div id="ruleSettingsNum" style="color: #94a3b8; margin-top: 2px;">• رقم واحد على الأقل (0-9)</div>
                          <div id="ruleSettingsUp" style="color: #94a3b8; margin-top: 2px;">• حرف كبير واحد على الأقل (A-Z)</div>
                        </div>
                      </div>

                      <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">تأكيد كلمة المرور الجديدة *</label>
                        <div style="position: relative;">
                          <input type="password" id="settingsConfirmPassword" class="form-input" required placeholder="••••••••" dir="ltr" style="padding-left: 2.5rem;">
                          <button type="button" class="password-toggle-btn" onclick="window.centrlyApp.togglePasswordVisibility('settingsConfirmPassword', this, event)" onmousedown="event.preventDefault()" title="إظهار/إخفاء كلمة المرور" aria-label="إظهار/إخفاء كلمة المرور">
                            ${getIcon('eye', 18)}
                          </button>
                        </div>
                      </div>

                      <div style="margin-top: 0.35rem;">
                        <button type="submit" id="btnSettingsUpdatePassword" class="btn btn-primary" style="width: 100%; font-weight: 800; padding: 0.65rem 1.25rem; border-radius: 10px;">
                          <span>تحديث كلمة المرور</span>
                        </button>
                      </div>

                    </div>
                  </form>
                </div>
              </div>

              <!-- Option 2: Forgot Password Recovery via Email -->
              <div style="background: rgba(37,99,235,0.03); border: 1.5px dashed var(--centrly-blue-700); border-radius: 14px; padding: 1.35rem; display: flex; flex-direction: column; justify-content: space-between;">
                <div>
                  <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.75rem;">
                    <span style="display: inline-flex; align-items: center; justify-content: center; width: 26px; height: 26px; border-radius: 50%; background: #f59e0b; color: #fff; font-size: 0.8rem; font-weight: 800;">2</span>
                    <h4 style="margin: 0; font-size: 1rem; font-weight: 800; color: var(--centrly-ink);">
                      نسيت كلمة المرور القديمة؟
                    </h4>
                  </div>

                  <p style="font-size: 0.825rem; color: var(--centrly-text); margin: 0 0 1rem 0; line-height: 1.6;">
                    إذا كنت لا تتذكر كلمة المرور الحالية، يمكنك إرسال رابط تأكيد وتعيين فوري إلى بريدك الإلكتروني المسجل:
                  </p>

                  <div style="background: #fff; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.6rem 0.85rem; margin-bottom: 0.85rem; display: flex; align-items: center; gap: 0.5rem;">
                    <span>${getIcon('mail', 18, 'var(--centrly-blue-700)')}</span>
                    <strong dir="ltr" style="font-size: 0.85rem; color: var(--centrly-ink); word-break: break-all;">${escapeHtml(email || 'لا يوجد بريد مسجل')}</strong>
                  </div>

                  <p style="font-size: 0.775rem; color: #64748b; margin: 0 0 1rem 0; line-height: 1.5;">
                    💡 عند الضغط على الزر، يُرسل لك رابط مباشر وآمن إلى بريدك. بالضغط عليه تفتح لك نافذة إدخال كلمة المرور الجديدة وتُحفظ في المنظومة تلقائياً دون الحاجة لكلمة المرور القديمة.
                  </p>

                  <div id="settingsForgotAlert" style="display: none; padding: 0.65rem 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.825rem;"></div>
                </div>

                <div>
                  <button type="button" id="btnSettingsForgotSubmit" onclick="window.centrlyApp.handleSettingsForgotPassword()" class="btn btn-secondary" style="width: 100%; font-weight: 800; padding: 0.65rem 1.25rem; border-radius: 10px; font-size: 0.875rem; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; background: #fff; border-color: var(--centrly-blue-700); color: var(--centrly-blue-700);">
                    ${getIcon('send', 16, 'var(--centrly-blue-700)')}
                    <span>إرسال رابط التعيين إلى بريدي الإلكتروني</span>
                  </button>
                </div>
              </div>

            </div>
          </div>


        </div>
      </div>

    </div>
  `;
}

export function registerTeacherSettingsActions(app) {
  app.openTeacherPhoneVerification = async function() {
    try {
      const info=await request('/auth/phone/info',{method:'POST',body:{}});
      this.showModal('تأكيد رقم واتساب',`<p>الرقم المحفوظ في حسابك. لو غيرته، احفظ بياناتك أولًا.</p>${info.verified?'<p role="status">رقمك مؤكد على واتساب.</p>':'<div id="teacher-phone-verification"></div>'}`,'');
      if(!info.verified)mountPhoneVerification(document.getElementById('teacher-phone-verification'),{info,requestCode:()=>request('/auth/phone/request',{method:'POST',body:{}}),verifyCode:body=>request('/auth/phone/verify',{method:'POST',body}),onVerified:()=>{this.closeModal();this.showToast('تم تأكيد رقم واتساب','success');}});
    } catch(error){this.showToast(error.message || 'تعذر فتح تأكيد الرقم','danger');}
  };
  app.switchSettingsTab = function(tab) {
    if (!this.settingsState) this.settingsState = {};
    this.settingsState.activeTab = tab;
    this.renderMainContent();
  };

  app.handleSaveTeacherProfile = async function(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('settingsTeacherName')?.value?.trim();
    const subject = document.getElementById('settingsSubject')?.value?.trim() || '';
    const phone = normalizeDigits(document.getElementById('settingsPhone')?.value?.trim() || '');
    const contactPhone = normalizeDigits(document.getElementById('settingsContactPhone')?.value?.trim() || '');
    const btn = document.getElementById('saveProfileBtn');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جارٍ الحفظ...</span>';
    }

    try {
      await request('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          teacher_name: name,
          subject,
          phone,
          contact_phone: contactPhone || phone,
        }),
      });

      if (this.user) {
        if (name) {
          this.user.name = name;
          this.user.full_name = name;
        }
        this.user.subject = subject;
        this.user.phone = phone;
        this.user.contact_phone = contactPhone || phone;
        authService.setUser(this.user);
      }
      this.showToast('تم حفظ بيانات الملف الشخصي بنجاح', 'success');
      this.renderApp();
    } catch (err) {
      this.showToast(err.message || 'تعذر حفظ البيانات', 'danger');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>حفظ التعديلات</span>';
      }
    }
  };

  app.handleSettingsChangePassword = async function(e) {
    if (e) e.preventDefault();
    const currentPassword = document.getElementById('settingsCurrentPassword')?.value?.trim();
    const newPassword = document.getElementById('settingsNewPassword')?.value?.trim();
    const confirmPassword = document.getElementById('settingsConfirmPassword')?.value?.trim();
    const alertBox = document.getElementById('settingsPasswordAlert');
    const btn = document.getElementById('btnSettingsUpdatePassword');

    const showAlert = (msg, isError = true) => {
      if (!alertBox) return;
      alertBox.style.display = 'block';
      alertBox.style.background = isError ? '#fee2e2' : '#dcfce7';
      alertBox.style.border = isError ? '1px solid #fca5a5' : '1px solid #86efac';
      alertBox.style.color = isError ? '#991b1b' : '#166534';
      alertBox.innerHTML = msg;
    };

    if (!currentPassword) {
      showAlert('يرجى كتابة كلمة المرور الحالية للتأكد من هويتك.');
      return;
    }
    if (!newPassword || newPassword.length < 8) {
      showAlert('يجب أن تكون كلمة المرور الجديدة 8 أحرف على الأقل.');
      return;
    }
    if (!/[0-9]/.test(newPassword)) {
      showAlert('يجب أن تحتوي كلمة المرور على رقم واحد على الأقل (0-9).');
      return;
    }
    if (!/[A-Z]/.test(newPassword)) {
      showAlert('يجب أن تحتوي كلمة المرور على حرف كبير واحد على الأقل (A-Z).');
      return;
    }
    if (newPassword !== confirmPassword) {
      showAlert('كلمة المرور الجديدة غير متطابقة مع التأكيد.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جارٍ التحديث...</span>';
    }

    try {
      await request('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });
      showAlert('تم تحديث كلمة المرور بنجاح!', false);
      const form = document.getElementById('formSettingsChangePassword');
      if (form) form.reset();
      this.showToast('تم تغيير كلمة المرور بنجاح', 'success');
    } catch (err) {
      const msg = err.message || 'تعذر تغيير كلمة المرور';
      if (msg.includes('CURRENT_PASSWORD_INCORRECT') || msg.includes('الحالية غير صحيحة')) {
        showAlert('كلمة المرور الحالية غير صحيحة. إذا كنت لا تذكرها، اضغط على "نسيت كلمة المرور الحالية؟" بالأسفل لإرسال رابط تعيين إلى بريدك.');
      } else {
        showAlert(msg);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>تحديث كلمة المرور</span>';
      }
    }
  };

  app.toggleSettingsForgotPanel = function() {
    const panel = document.getElementById('settingsForgotPanel');
    if (panel) {
      panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
    }
  };

  app.handleSettingsForgotPassword = async function() {
    const alertBox = document.getElementById('settingsForgotAlert');
    const btn = document.getElementById('btnSettingsForgotSubmit');
    const email = this.user?.email;

    const showAlert = (msg, isError = true) => {
      if (!alertBox) return;
      alertBox.style.display = 'block';
      alertBox.style.background = isError ? '#fee2e2' : '#dcfce7';
      alertBox.style.border = isError ? '1px solid #fca5a5' : '1px solid #86efac';
      alertBox.style.color = isError ? '#991b1b' : '#166534';
      alertBox.innerHTML = msg;
    };

    if (!email) {
      showAlert('لم يتم العثور على بريد إلكتروني مسجل لهذا الحساب.');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جارٍ إرسال الرابط...</span>';
    }

    try {
      await authService.forgotPassword(email);
      showAlert(`تم إرسال رابط تأكيد وتعيين كلمة المرور الجديدة إلى بريدك الإلكتروني: <strong>${escapeHtml(email)}</strong>.<br>يرجى فحص صندوق الوارد (أو مجلد Spam)، والضغط على الرابط لتسجيل كلمة المرور الجديدة وتحديثها في النظام تلقائياً.`, false);
      this.showToast('تم إرسال رابط استعادة كلمة المرور إلى بريدك', 'success');
    } catch (err) {
      showAlert(err.message || 'تعذر إرسال رابط استعادة كلمة المرور.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<span>إعادة إرسال الرابط</span>';
      }
    }
  };

  app.validateSettingsPasswordLive = function(val) {
    const ruleLen = document.getElementById('ruleSettingsLen');
    const ruleNum = document.getElementById('ruleSettingsNum');
    const ruleUp = document.getElementById('ruleSettingsUp');
    if (!ruleLen || !ruleNum || !ruleUp) return;

    const hasLen = val && val.length >= 8;
    const hasNum = /[0-9]/.test(val);
    const hasUp = /[A-Z]/.test(val);

    ruleLen.style.color = hasLen ? '#10b981' : '#94a3b8';
    ruleLen.innerHTML = (hasLen ? '✓ ' : '• ') + '8 أحرف أو أكثر';

    ruleNum.style.color = hasNum ? '#10b981' : '#94a3b8';
    ruleNum.innerHTML = (hasNum ? '✓ ' : '• ') + 'رقم واحد على الأقل (0-9)';

    ruleUp.style.color = hasUp ? '#10b981' : '#94a3b8';
    ruleUp.innerHTML = (hasUp ? '✓ ' : '• ') + 'حرف كبير واحد على الأقل (A-Z)';
  };

}
