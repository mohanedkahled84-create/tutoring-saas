import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { renderBillingView } from './BillingView.js?v=3.8.0';
import { renderWhatsAppSettingsView } from './WhatsAppSettingsView.js';

/**
 * Centrly Teacher Settings & Account Management View
 * Features:
 * 1. Profile & Teaching Info (Name, subject, phone, governorate)
 * 2. WhatsApp Gateway & Templates (Unified inside Settings)
 * 3. Subscription & Plan Quota (Unified full pricing & proofs inside Settings)
 * 4. Security & Password (Current password required + Forgot password link to email + Financial PIN)
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
  const subject = user?.subject || '';
  const tenantName = user?.tenant_name || '';

  // Billing Data
  const status = billing.subscription_status || billing.status || 'trial';
  const rawDate = billing.subscription_ends_at || billing.trial_ends_at || '';
  const formattedDate = formatArabicDate(rawDate);
  const currentStudents = billing.students_count || (window.centrlyApp?.students?.length || 0);
  const studentLimit = billing.students_limit || 100;
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

  const hasPin = Boolean(securityState?.hasPin !== undefined ? securityState.hasPin : (window.centrlyApp?.hasSecurityPin || user?.has_security_pin || localStorage.getItem('centrly_has_security_pin') === 'true' || localStorage.getItem('centrly_financial_pin')));
  const isUnlocked = Boolean(securityState?.isUnlocked !== undefined ? securityState.isUnlocked : window.centrlyApp?.isFinancialUnlocked);

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
            ${hasPin ? `
              <span class="badge" style="background: ${isUnlocked ? 'rgba(16,185,129,0.2)' : 'rgba(239,68,68,0.25)'}; color: #fff; border: 1px solid ${isUnlocked ? '#34d399' : '#f87171'}; font-size: 0.75rem; font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.35rem 0.75rem;">
                ${isUnlocked ? '✓ تم فك القفل' : getIcon('lock', 13, '#ffffff') + ' مقفل برمز PIN'}
              </span>
            ` : ''}
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

        <button type="button" onclick="window.centrlyApp.switchSettingsTab('whatsapp')"
          class="btn ${activeTab === 'whatsapp' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.6rem 1.15rem; border-radius: 10px; white-space: nowrap;">
          ${getIcon('whatsapp', 16, activeTab === 'whatsapp' ? '#ffffff' : '#22c55e')}
          <span>خدمة وربط الواتساب</span>
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
                <input type="text" id="settingsSubject" class="form-input" value="${escapeHtml(subject)}" placeholder="المادة التعليمية">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">رقم الواتساب للتواصل</label>
                <input type="tel" id="settingsPhone" class="form-input" value="${escapeHtml(phone)}" placeholder="010..." dir="ltr">
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

      <!-- ================= TAB 2: WHATSAPP ================= -->
      <div id="settingsTabWhatsApp" style="display: ${activeTab === 'whatsapp' ? 'block' : 'none'};">
        ${renderWhatsAppSettingsView(whatsapp)}
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
                          <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('settingsCurrentPassword', this)" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px;">
                            ${getIcon('eye', 18)}
                          </button>
                        </div>
                      </div>

                      <div class="form-group" style="margin: 0;">
                        <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">كلمة المرور الجديدة *</label>
                        <div style="position: relative;">
                          <input type="password" id="settingsNewPassword" class="form-input" required placeholder="••••••••" dir="ltr" style="padding-left: 2.5rem;" oninput="window.centrlyApp.validateSettingsPasswordLive(this.value)">
                          <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('settingsNewPassword', this)" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px;">
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
                          <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('settingsConfirmPassword', this)" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px;">
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

          <!-- Financial PIN Lock Card -->
          <div class="card" style="margin: 0; padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 0.75rem;">
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <span>${getIcon('lock', 22, hasPin ? '#10b981' : '#f59e0b')}</span>
                <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">
                  رمز الأمان السحابي (Security PIN)
                </h3>
              </div>
              ${hasPin ? `
                <span class="badge" style="background: rgba(16,185,129,0.15); color: #047857; border: 1px solid #10b981; font-weight: 800; padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.8rem; display: inline-flex; align-items: center; gap: 0.35rem;">
                  ✓ مفعل ومربوط بحسابك عبر كافة الأجهزة
                </span>
              ` : `
                <span class="badge" style="background: rgba(245,158,11,0.15); color: #b45309; border: 1px solid #f59e0b; font-weight: 800; padding: 0.35rem 0.75rem; border-radius: 8px; font-size: 0.8rem;">
                  غير مفعل حالياً
                </span>
              `}
            </div>

            <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1.25rem 0; line-height: 1.6;">
              يقوم هذا الرمز السحابي بقفل الإعدادات، والبيانات المالية، والأرباح، ومرتبات المساعدين تلقائياً ومزامنته بحسابك السحابي، بحيث يفتح الحساب من أي جهاز (موبايل، لابتوب) مقفلاً بنفس الرمز لحماية خصوصيتك التامة.
            </p>

            ${hasPin ? `
              <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
                <div>
                  <div style="font-weight: 800; color: #0f172a; font-size: 0.95rem; margin-bottom: 0.25rem;">
                    حالة الحماية: مقفلة ومؤمنة سحابياً
                  </div>
                  <div style="font-size: 0.8rem; color: #64748b;">
                    يمكنك تعديل رمز الأمان (PIN) أو إعادة ضبطه في أي وقت.
                  </div>
                </div>
                <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
                  <button type="button" class="btn btn-primary" onclick="window.centrlyApp.openSetPinModal()" style="font-weight: 800; font-size: 0.85rem; padding: 0.55rem 1.15rem; display: inline-flex; align-items: center; gap: 0.4rem;">
                    ${getIcon('edit', 14)}
                    <span>تعديل رمز الأمان</span>
                  </button>
                  <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.resetFinancialPinPrompt()" style="font-weight: 700; font-size: 0.85rem; padding: 0.55rem 1rem; color: #ef4444; border-color: #fecaca; background: #fff;">
                    <span>إلغاء تفعيل الرمز</span>
                  </button>
                </div>
              </div>
            ` : `
              <form onsubmit="window.centrlyApp.handleSaveFinancialPin(event)">
                <div style="max-width: 440px; display: flex; flex-direction: column; gap: 1rem;">
                  <div class="form-group" style="margin: 0;">
                    <label class="form-label" style="font-weight: 700;">تعيين رمز أمان سحابي جديد (4 إلى 6 أرقام) *</label>
                    <input type="password" id="settingsFinancialPin" class="form-input" placeholder="••••" maxlength="6" pattern="[0-9]{4,6}" inputmode="numeric" required dir="ltr" style="letter-spacing: 0.3rem; font-weight: 800; font-size: 1.1rem; text-align: center;">
                    <span style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem; display: block;">
                      أدخل من 4 إلى 6 أرقام سرية لتأمين كافة شاشاتك المالية عبر جميع الأجهزة.
                    </span>
                  </div>

                  <div>
                    <button type="submit" class="btn btn-primary" style="font-weight: 800; padding: 0.65rem 1.75rem; border-radius: 10px;">
                      <span>حفظ وتفعيل رمز الأمان</span>
                    </button>
                  </div>
                </div>
              </form>
            `}
          </div>

        </div>
      </div>

    </div>
  `;
}
