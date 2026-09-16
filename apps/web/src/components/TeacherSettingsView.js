import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Centrly Teacher Settings & Account Management View
 * Features:
 * 1. Profile & Teaching Info (Name, subject, phone, governorate)
 * 2. Subscription & Plan Quota (Days left, capacity progress bar, Vodafone Cash / InstaPay proof upload)
 * 3. Security & Password (Change password with current password verification + Financial PIN)
 * 4. Appearance & Preferences (Dark mode toggle, barcode audio toggle)
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

export function renderTeacherSettingsView(state = {}, user = {}, billing = {}) {
  const activeTab = state.activeTab || 'profile';
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

  const isDark = typeof document !== 'undefined' && document.documentElement.getAttribute('data-theme') === 'dark';
  const hasPin = Boolean(localStorage.getItem('centrly_financial_pin'));

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      
      <!-- Top Header Card -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #172D70 0%, #2563eb 100%); color: #fff; border: none; border-radius: 16px; padding: 1.75rem; box-shadow: 0 10px 25px rgba(37,99,235,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span>${getIcon('gear', 24, '#fcd34d')}</span>
              <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: #fff;">
                إعدادات الحساب والمنظومة
              </h2>
            </div>
            <p style="font-size: 0.875rem; color: #cbd5e1; margin: 0;">
              تعديل بيانات المعلم، إدارة باقة الاشتراك، الأمان وكلمة المرور، وتخصيص تفضيلات المنصة.
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
      <div style="display: flex; gap: 0.5rem; border-bottom: 2px solid var(--centrly-line); padding-bottom: 0.5rem; overflow-x: auto;">
        
        <button type="button" onclick="window.centrlyApp.switchSettingsTab('profile')"
          class="btn ${activeTab === 'profile' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1.1rem; border-radius: 10px; white-space: nowrap;">
          ${getIcon('teachers', 16)}
          <span>الملف الشخصي والمادة</span>
        </button>

        <button type="button" onclick="window.centrlyApp.switchSettingsTab('subscription')"
          class="btn ${activeTab === 'subscription' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1.1rem; border-radius: 10px; white-space: nowrap;">
          ${getIcon('billing', 16)}
          <span>الباقة والاشتراكات</span>
        </button>

        <button type="button" onclick="window.centrlyApp.switchSettingsTab('security')"
          class="btn ${activeTab === 'security' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1.1rem; border-radius: 10px; white-space: nowrap;">
          ${getIcon('lock', 16)}
          <span>الأمان وكلمة المرور</span>
        </button>

        <button type="button" onclick="window.centrlyApp.switchSettingsTab('appearance')"
          class="btn ${activeTab === 'appearance' ? 'btn-primary' : 'btn-secondary'}"
          style="font-weight: 800; font-size: 0.875rem; display: inline-flex; align-items: center; gap: 0.45rem; padding: 0.55rem 1.1rem; border-radius: 10px; white-space: nowrap;">
          ${getIcon('gear', 16)}
          <span>المظهر وتفضيلات النظام</span>
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
                <input type="text" id="settingsTeacherName" class="form-input" value="${escapeHtml(displayName)}" required placeholder="أ. محمد خالد">
              </div>

              <div class="form-group">
                <label class="form-label" style="font-weight: 700;">المادة التعليمية</label>
                <input type="text" id="settingsSubject" class="form-input" value="${escapeHtml(subject)}" placeholder="مثال: الفيزياء، الرياضيات، الكيمياء">
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

      <!-- ================= TAB 2: SUBSCRIPTION ================= -->
      <div id="settingsTabSubscription" style="display: ${activeTab === 'subscription' ? 'block' : 'none'};">
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Status Banner -->
          <div class="card" style="margin: 0; background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #fff; border: none; border-radius: 16px; padding: 1.75rem;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
              <div>
                <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.35rem;">
                  <span class="badge" style="background: ${status === 'active' ? '#10b981' : (status === 'trial' ? '#0284c7' : '#ef4444')}; color: #fff; font-weight: 800; padding: 0.3rem 0.75rem; border-radius: 9999px;">
                    ${status === 'active' ? 'اشتراك نشط وسارٍ' : (status === 'trial' ? 'فترة تجريبية مجانية' : 'اشتراك منتهي')}
                  </span>
                  <span style="font-size: 0.85rem; color: #93c5fd; font-weight: 700;">
                    ${billing.plan_name || `باقة ${studentLimit} طالب`}
                  </span>
                </div>
                
                <p style="font-size: 0.9rem; color: #cbd5e1; margin: 0.5rem 0 0 0;">
                  تاريخ الصلاحية: <strong style="color: #38bdf8;">${formattedDate}</strong>
                  ${daysRemaining > 0 ? `(متبقي <strong style="color: #fde047;">${daysRemaining} يوماً</strong>)` : ''}
                </p>

                <!-- Quota Progress -->
                <div style="margin-top: 1rem; max-width: 440px;">
                  <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 0.35rem;">
                    <span>سعة المقاعد المستخدمة: <strong style="color: #fff;">${currentStudents}</strong> / ${studentLimit} طالب</span>
                    <span>${quotaPercent}%</span>
                  </div>
                  <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.15); border-radius: 9999px; overflow: hidden;">
                    <div style="width: ${quotaPercent}%; height: 100%; background: ${quotaPercent >= 100 ? '#ef4444' : (quotaPercent >= 85 ? '#f59e0b' : '#10b981')}; border-radius: 9999px;"></div>
                  </div>
                </div>
              </div>

              <div>
                <button class="btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #0f172a; font-weight: 800; font-size: 0.95rem; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4); cursor: pointer;" onclick="window.centrlyApp.openPaymentProofModal('باقة 100 طالب', 599, 'monthly')">
                  تجديد / ترقية الباقة الآن
                </button>
              </div>
            </div>
          </div>

          <!-- Quick Navigation to Full Billing View -->
          <div class="card" style="margin: 0; padding: 1.5rem; border-radius: var(--radius-lg); text-align: center;">
            <h4 style="margin: 0 0 0.5rem 0; font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink);">
              هل ترغب في مراجعة كافة خطط الأسعار والاشتراك السنوي بخصم 10%؟
            </h4>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1rem 0;">
              يمكنك الاطلاع على تفاصيل كافة الباقات (100، 250، 500 طالب) وحساب التوفير السنوي من شاشة الاشتراكات المتخصصة.
            </p>
            <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.navigate('billing')" style="font-weight: 800; padding: 0.6rem 1.5rem; border-radius: 10px;">
              ${getIcon('billing', 16)}
              <span>الانتقال لصفحة الباقات والاشتراكات الكاملة</span>
            </button>
          </div>

        </div>
      </div>

      <!-- ================= TAB 3: SECURITY ================= -->
      <div id="settingsTabSecurity" style="display: ${activeTab === 'security' ? 'block' : 'none'};">
        <div style="display: flex; flex-direction: column; gap: 1.5rem;">
          
          <!-- Change Password Card -->
          <div class="card" style="margin: 0; padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span>${getIcon('lock', 20, 'var(--centrly-blue-700)')}</span>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">
                تغيير كلمة المرور
              </h3>
            </div>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1.25rem 0;">
              لتغيير كلمة المرور، يرجى كتابة كلمة المرور الحالية أولاً لضمان الأمان، ثم كلمة المرور الجديدة.
            </p>

            <div id="settingsPasswordAlert" style="display: none; padding: 0.65rem 0.75rem; border-radius: var(--radius-md); margin-bottom: 1rem; font-size: 0.825rem;"></div>

            <form id="formSettingsChangePassword" onsubmit="window.centrlyApp.handleSettingsChangePassword(event)">
              <div style="max-width: 440px; display: flex; flex-direction: column; gap: 1rem;">
                
                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-weight: 700;">كلمة المرور الحالية *</label>
                  <div style="position: relative;">
                    <input type="password" id="settingsCurrentPassword" class="form-input" required placeholder="••••••••" dir="ltr" style="padding-left: 2.5rem;">
                    <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('settingsCurrentPassword', this)" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px;">
                      ${getIcon('eye', 18)}
                    </button>
                  </div>
                </div>

                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-weight: 700;">كلمة المرور الجديدة *</label>
                  <div style="position: relative;">
                    <input type="password" id="settingsNewPassword" class="form-input" required placeholder="••••••••" dir="ltr" style="padding-left: 2.5rem;" oninput="window.centrlyApp.validateSettingsPasswordLive(this.value)">
                    <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('settingsNewPassword', this)" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px;">
                      ${getIcon('eye', 18)}
                    </button>
                  </div>

                  <!-- Live Criteria -->
                  <div id="settingsPwdChecklist" style="margin-top: 0.5rem; background: var(--centrly-surface); border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.5rem 0.75rem; font-size: 0.75rem;">
                    <div id="ruleSettingsLen" style="color: #94a3b8;">• 8 أحرف أو أكثر</div>
                    <div id="ruleSettingsNum" style="color: #94a3b8; margin-top: 2px;">• رقم واحد على الأقل (0-9)</div>
                    <div id="ruleSettingsUp" style="color: #94a3b8; margin-top: 2px;">• حرف كبير واحد على الأقل (A-Z)</div>
                  </div>
                </div>

                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-weight: 700;">تأكيد كلمة المرور الجديدة *</label>
                  <div style="position: relative;">
                    <input type="password" id="settingsConfirmPassword" class="form-input" required placeholder="••••••••" dir="ltr" style="padding-left: 2.5rem;">
                    <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('settingsConfirmPassword', this)" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px;">
                      ${getIcon('eye', 18)}
                    </button>
                  </div>
                </div>

                <div>
                  <button type="submit" id="btnSettingsUpdatePassword" class="btn btn-primary" style="font-weight: 800; padding: 0.65rem 1.75rem; border-radius: 10px;">
                    <span>تحديث كلمة المرور</span>
                  </button>
                </div>

              </div>
            </form>
          </div>

          <!-- Financial PIN Lock Card -->
          <div class="card" style="margin: 0; padding: 1.75rem; border-radius: var(--radius-lg);">
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.5rem;">
              <span>${getIcon('lock', 20, '#f59e0b')}</span>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">
                الرمز السري لحماية الأرباح (Financial PIN)
              </h3>
            </div>
            <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1.25rem 0; line-height: 1.6;">
              يقوم هذا الرمز السري بقفل شاشات الأرباح، نصيب السنتر، ومرتبات المساعدين تلقائياً برقم سري (4 إلى 6 أرقام)، حتى لا يراها أحد عند الجلوس بجوارك.
            </p>

            <form onsubmit="window.centrlyApp.handleSaveFinancialPin(event)">
              <div style="max-width: 440px; display: flex; flex-direction: column; gap: 1rem;">
                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-weight: 700;">
                    ${hasPin ? 'تغيير الرمز السري الحالي (أو اترك فارغاً للتعطيل)' : 'تعيين رمز سري جديد للأرباح'}
                  </label>
                  <input type="password" id="settingsFinancialPin" class="form-input" placeholder="مثال: 1234" maxlength="6" dir="ltr">
                  <span style="font-size: 0.725rem; color: #94a3b8; margin-top: 0.25rem; display: block;">
                    ${hasPin ? 'الرمز مفعل حالياً. إذا قمت بمسحه وضغط حفظ سيتم تعطيل القفل.' : 'الرمز غير مفعل حالياً.'}
                  </span>
                </div>

                <div>
                  <button type="submit" class="btn btn-secondary" style="font-weight: 800; padding: 0.65rem 1.75rem; border-radius: 10px;">
                    <span>حفظ رمز الأمان</span>
                  </button>
                </div>
              </div>
            </form>
          </div>

        </div>
      </div>

      <!-- ================= TAB 4: APPEARANCE & PREFERENCES ================= -->
      <div id="settingsTabAppearance" style="display: ${activeTab === 'appearance' ? 'block' : 'none'};">
        <div class="card" style="margin: 0; padding: 1.75rem; border-radius: var(--radius-lg);">
          <h3 style="margin: 0 0 0.5rem 0; font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink);">
            المظهر وتفضيلات الاستخدام
          </h3>
          <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1.5rem 0;">
            تخصيص نمط العرض الليلي وأصوات التحضير في الحصة.
          </p>

          <div style="display: flex; flex-direction: column; gap: 1.5rem; max-width: 600px;">
            
            <!-- Dark Mode Control -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1.5px solid var(--centrly-line); border-radius: 12px; background: var(--centrly-surface);">
              <div>
                <div style="font-weight: 800; color: var(--centrly-ink); font-size: 0.95rem; display: flex; align-items: center; gap: 0.4rem;">
                  <span>${getIcon(isDark ? 'sun' : 'moon', 18)}</span>
                  <span>الوضع الليلي (Dark Mode)</span>
                </div>
                <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem;">
                  مريح للعين أثناء رصد درجات الكويزات والتحضير ليلاً.
                </div>
              </div>

              <div>
                <button type="button" class="btn ${isDark ? 'btn-primary' : 'btn-secondary'}" onclick="window.centrlyApp.toggleTheme()" style="font-weight: 800; font-size: 0.85rem; border-radius: 8px;">
                  <span>${isDark ? 'الوضع النهاري' : 'الوضع الليلي'}</span>
                </button>
              </div>
            </div>

            <!-- Barcode Sound Toggle -->
            <div style="display: flex; justify-content: space-between; align-items: center; padding: 1rem; border: 1.5px solid var(--centrly-line); border-radius: 12px; background: var(--centrly-surface);">
              <div>
                <div style="font-weight: 800; color: var(--centrly-ink); font-size: 0.95rem;">
                  صوت التنبيه عند مسح الباركود (Beep Audio)
                </div>
                <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem;">
                  إصدار صوت خفيف عند تسجيل حضور الطالب بنجاح عبر الباركود.
                </div>
              </div>

              <div>
                <input type="checkbox" id="settingsBarcodeAudio" checked style="width: 20px; height: 20px; cursor: pointer;">
              </div>
            </div>

            <!-- WhatsApp Manual Notice -->
            <div style="background: #eff6ff; border: 1.5px solid #bfdbfe; border-radius: 12px; padding: 1rem 1.25rem; font-size: 0.85rem; color: #1e3a8a; line-height: 1.6;">
              <strong>ملاحظة هامة بشأن الواتساب:</strong>
              إرسال رسائل حضور وغياب الحصة يخضع للقرار اليدوي للمعلم ولا يتم إرسال أي رسائل تلقائياً بدون موافقتك الصريحة حمايةً لخصوصية الطلاب وشريحتك من الحظر.
            </div>

          </div>
        </div>
      </div>

    </div>
  `;
}
