export function renderAuthScreens() {
  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: var(--centrly-surface); padding: 1.5rem;">
      <div class="card" style="max-width: 440px; width: 100%; padding: 2rem; box-shadow: var(--shadow-lg);">
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div class="brand-logo-badge" style="margin: 0 auto 0.75rem; width: 48px; height: 48px; font-size: 1.5rem;">سـ</div>
          <h2 style="font-size: 1.4rem; font-weight: 800; color: var(--centrly-ink); margin: 0;">منظومة سنترلي | Centrly</h2>
          <p style="font-size: 0.85rem; color: var(--centrly-text); margin-top: 0.25rem;">إدارة الحصص والمجاميع وحضور الطلاب</p>
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
            <input type="password" id="loginPassword" class="form-input" placeholder="••••••••" required dir="ltr">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.75rem;">
            دخول إلى المنظومة
          </button>
        </form>

        <!-- Signup Form -->
        <form id="formSignup" style="display: none;" onsubmit="window.centrlyApp.handleSignup(event)">
          <div class="form-group">
            <label class="form-label">نوع الحساب</label>
            <select id="signupAccountType" class="form-select">
              <option value="teacher">مدرس فردي (Solo Teacher)</option>
              <option value="center">سنتر تعليمي (Educational Center)</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label">الاسم الكامل / اسم السنتر</label>
            <input type="text" id="signupName" class="form-input" placeholder="أ. محمد خالد" required>
          </div>
          <div class="form-group">
            <label class="form-label">البريد الإلكتروني</label>
            <input type="email" id="signupEmail" class="form-input" placeholder="teacher@example.com" required dir="ltr">
          </div>
          <div class="form-group">
            <label class="form-label">رقم الواتساب (مصري)</label>
            <input type="tel" id="signupPhone" class="form-input" placeholder="01012345678" required dir="ltr">
          </div>
          <div class="form-group">
            <label class="form-label">كلمة المرور (8 أحرف + رقم + رمز)</label>
            <input type="password" id="signupPassword" class="form-input" placeholder="••••••••" required dir="ltr">
          </div>
          <button type="submit" class="btn btn-primary" style="width: 100%; margin-top: 1rem; padding: 0.75rem;">
            إنشاء حساب وبدء التجربة المجانية
          </button>
        </form>
      </div>
    </div>
  `;
}
