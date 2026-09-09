import { getIcon } from '../utils/icons.js';

export function renderAuthScreens() {
  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: var(--centrly-surface); padding: 1.5rem;">
      <div class="card" style="max-width: 440px; width: 100%; padding: 2rem; box-shadow: var(--shadow-lg);">
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
            <label class="form-label">البريد الإلكتروني</label>
            <input type="email" id="loginEmail" class="form-input" placeholder="teacher@example.com" required dir="ltr">
          </div>
          <div class="form-group">
            <label class="form-label">كلمة المرور</label>
            <div style="position: relative;">
              <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;">
              <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('loginPassword', this)" title="إظهار/إخفاء كلمة المرور" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px; display: flex; align-items: center; justify-content: center;">
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <span>دخول إلى المنظومة</span>
          </button>
        </form>

        <!-- Signup Form -->
        <form id="formSignup" style="display: none;" onsubmit="window.centrlyApp.handleSignup(event)">
          <div class="form-group">
            <label class="form-label">نوع الحساب</label>
            <select id="signupAccountType" class="form-select" onchange="window.centrlyApp.onAccountTypeChange(this.value)">
              <option value="teacher">مدرس فردي (Solo Teacher)</option>
              <option value="center">سنتر تعليمي (Educational Center)</option>
            </select>
          </div>

          <!-- Dynamic Role Fields -->
          <div id="roleFieldsTeacher" class="form-group">
            <label class="form-label">اسم المدرس *</label>
            <input type="text" id="signupName" class="form-input" placeholder="أ. محمد خالد" required>
          </div>

          <div id="roleFieldsCenter" style="display: none;">
            <div class="form-group">
              <label class="form-label">اسم مسؤول السنتر *</label>
              <input type="text" id="signupCenterOwnerName" class="form-input" placeholder="أ. أحمد محمود">
            </div>
            <div class="form-group">
              <label class="form-label">اسم السنتر التعليمي *</label>
              <input type="text" id="signupCenterName" class="form-input" placeholder="سنتر التفوق التعليمي">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">البريد الإلكتروني *</label>
            <input type="email" id="signupEmail" class="form-input" placeholder="teacher@example.com" required dir="ltr">
          </div>
          <div class="form-group">
            <label class="form-label">رقم الواتساب (مصري) *</label>
            <input type="tel" id="signupPhone" class="form-input" placeholder="01012345678" required dir="ltr">
          </div>
          <div class="form-group">
            <label class="form-label">كلمة المرور *</label>
            <div style="position: relative;">
              <input type="password" id="signupPassword" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;" oninput="window.centrlyApp.validatePasswordLive(this.value)">
              <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('signupPassword', this)" title="إظهار/إخفاء كلمة المرور" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px; display: flex; align-items: center; justify-content: center;">
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
            <div style="position: relative;">
              <input type="password" id="signupPasswordConfirm" class="form-input" placeholder="••••••••" required dir="ltr" style="padding-left: 2.5rem;">
              <button type="button" onclick="window.centrlyApp.togglePasswordVisibility('signupPasswordConfirm', this)" title="إظهار/إخفاء كلمة المرور" style="position: absolute; left: 8px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: var(--centrly-text); padding: 4px; display: flex; align-items: center; justify-content: center;">
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            <span>إنشاء حساب وبدء التجربة المجانية</span>
          </button>
        </form>
      </div>
    </div>
  `;
}
