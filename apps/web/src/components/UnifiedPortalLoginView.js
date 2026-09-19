import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Centrly Unified Student & Parent Portal Login View
 * Route: /portal
 * Clean, lightweight, mobile-first login interface with dedicated tabs for Students and Parents.
 * Authenticates against /api/public/portal/login
 */

export function renderUnifiedPortalLoginView(errorMessage = '', initialIdentifier = '') {
  let presetIdentifier = initialIdentifier;
  let currentRole = 'parent';

  if (typeof window !== 'undefined') {
    const params = new URLSearchParams(window.location.search);
    if (!presetIdentifier) {
      presetIdentifier = params.get('phone') || params.get('user') || params.get('identifier') || '';
    }
    const roleParam = params.get('role');
    if (roleParam === 'student') {
      currentRole = 'student';
    }
  }

  const isStudent = currentRole === 'student';

  const alertHtml = errorMessage
    ? `<div id="portalLoginAlert" style="padding: 0.75rem 1rem; border-radius: 0.65rem; margin-bottom: 1.25rem; font-size: 0.85rem; font-weight: 600; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca; display: flex; align-items: center; gap: 0.5rem;">
        ${getIcon('alert', 18, '#b91c1c')}
        <span>${escapeHtml(errorMessage)}</span>
       </div>`
    : `<div id="portalLoginAlert" style="display: none; padding: 0.75rem 1rem; border-radius: 0.65rem; margin-bottom: 1.25rem; font-size: 0.85rem; font-weight: 600; background-color: #fef2f2; color: #b91c1c; border: 1px solid #fecaca;"></div>`;

  return `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background-color: #f8fafc; padding: 1.5rem; font-family: 'Cairo', system-ui, -apple-system, sans-serif; direction: rtl;">
      <div style="max-width: 440px; width: 100%; background: #ffffff; border-radius: 1.25rem; padding: 2.25rem 2rem; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.03); border: 1px solid #e2e8f0; position: relative;">
        
        <!-- Back Link -->
        <div style="margin-bottom: 1.25rem; text-align: right;">
          <button type="button" onclick="window.centrlyApp && window.centrlyApp.renderLanding ? window.centrlyApp.renderLanding() : (window.location.href='/')" 
            style="background: none; border: none; color: #1d4ed8; cursor: pointer; font-size: 0.825rem; font-weight: 700; font-family: inherit; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.5rem; border-radius: 6px;" 
            onmouseover="this.style.backgroundColor='#eff6ff'" 
            onmouseout="this.style.backgroundColor='transparent'">
            <span>← العودة للصفحة الرئيسية</span>
          </button>
        </div>

        <!-- Header -->
        <div style="text-align: center; margin-bottom: 1.5rem;">
          <div style="margin: 0 auto 0.75rem; width: 56px; height: 56px; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); border-radius: 1rem; display: flex; align-items: center; justify-content: center; box-shadow: 0 8px 20px rgba(37, 99, 235, 0.25); color: #fff; font-size: 1.5rem; font-weight: 900;">
            سـ
          </div>
          <h1 id="portalHeadingText" style="font-size: 1.35rem; font-weight: 800; margin: 0 0 0.35rem 0; color: #0f172a;">
            ${isStudent ? 'بوابة الطالب' : 'بوابة ولي الأمر'}
          </h1>
          <p id="portalSubheadingText" style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.5;">
            ${isStudent ? 'سجّل دخولك لتحميل المذكرات، تسليم الواجبات، ومتابعة درجاتك' : 'سجّل دخولك لمتابعة الحضور والغياب، الدرجات، والواجبات'}
          </p>
        </div>

        <!-- Account Type Switcher Tabs -->
        <div style="display: flex; background: #f1f5f9; padding: 4px; border-radius: 0.75rem; margin-bottom: 1.5rem; gap: 4px; border: 1px solid #e2e8f0;">
          <button 
            type="button" 
            id="portalTabParent" 
            onclick="window.centrlyApp && window.centrlyApp.switchPortalLoginRole ? window.centrlyApp.switchPortalLoginRole('parent') : null"
            style="flex: 1; padding: 0.65rem 0.5rem; border: none; border-radius: 0.55rem; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.4rem; background: ${!isStudent ? '#ffffff' : 'transparent'}; color: ${!isStudent ? '#1e3a8a' : '#64748b'}; box-shadow: ${!isStudent ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};"
          >
            <span>👨‍👩‍👧</span>
            <span>ولي أمر</span>
          </button>
          <button 
            type="button" 
            id="portalTabStudent" 
            onclick="window.centrlyApp && window.centrlyApp.switchPortalLoginRole ? window.centrlyApp.switchPortalLoginRole('student') : null"
            style="flex: 1; padding: 0.65rem 0.5rem; border: none; border-radius: 0.55rem; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; gap: 0.4rem; background: ${isStudent ? '#ffffff' : 'transparent'}; color: ${isStudent ? '#1d4ed8' : '#64748b'}; box-shadow: ${isStudent ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};"
          >
            <span>👨‍🎓</span>
            <span>طالب</span>
          </button>
        </div>

        ${alertHtml}

        <!-- Login Form -->
        <form id="portalLoginForm" onsubmit="window.centrlyApp && window.centrlyApp.handlePortalLogin ? window.centrlyApp.handlePortalLogin(event) : event.preventDefault()">
          
          <input type="hidden" id="portalRole" name="role" value="${isStudent ? 'student' : 'parent'}">

          <div style="margin-bottom: 1.15rem;">
            <label id="portalIdentifierLabel" for="portalIdentifier" style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem;">
              ${isStudent ? 'رقم هاتف الطالب أو كود الطالب' : 'رقم هاتف ولي الأمر أو كود الطالب'}
            </label>
            <div style="position: relative;">
              <input 
                type="text" 
                id="portalIdentifier" 
                name="identifier"
                class="form-input" 
                value="${escapeHtml(presetIdentifier)}"
                placeholder="010xxxxxxxx أو كود الطالب" 
                required 
                dir="ltr" 
                autocapitalize="none" 
                autocorrect="off" 
                spellcheck="false" 
                autocomplete="username"
                style="width: 100%; box-sizing: border-box; padding: 0.75rem 0.9rem; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; font-size: 0.95rem; font-family: inherit; outline: none; transition: border-color 0.2s;"
                onfocus="this.style.borderColor='#2563eb'"
                onblur="this.style.borderColor='#cbd5e1'"
              >
            </div>
            <span id="portalIdentifierHelp" style="display: block; font-size: 0.75rem; color: #94a3b8; margin-top: 0.3rem;">
              ${isStudent ? 'اكتب رقم هاتفك المسجل لدى المعلم أو كودك الشخصي' : 'اكتب رقم هاتف ولي الأمر أو كود الطالب'}
            </span>
          </div>

          <div style="margin-bottom: 1.15rem;">
            <label for="portalPassword" style="display: block; font-size: 0.85rem; font-weight: 700; color: #334155; margin-bottom: 0.4rem;">
              كلمة المرور
            </label>
            <div style="position: relative;">
              <input 
                type="password" 
                id="portalPassword" 
                name="password"
                class="form-input" 
                placeholder="••••••" 
                required 
                dir="ltr" 
                style="width: 100%; box-sizing: border-box; padding-top: 0.75rem; padding-bottom: 0.75rem; padding-right: 0.9rem; padding-left: 2.85rem !important; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; font-size: 0.95rem; font-family: inherit; letter-spacing: 2px; outline: none; transition: border-color 0.2s;"
                onfocus="this.style.borderColor='#2563eb'"
                onblur="this.style.borderColor='#cbd5e1'"
                autocapitalize="none" 
                autocorrect="off" 
                spellcheck="false" 
                autocomplete="current-password"
              >
              <button 
                type="button" 
                class="password-toggle-btn"
                onclick="window.centrlyApp ? (window.centrlyApp.togglePasswordVisibility ? window.centrlyApp.togglePasswordVisibility('portalPassword', this, event) : window.centrlyApp.togglePortalPasswordVisibility(this, event)) : null" 
                onmousedown="event.preventDefault()"
                title="إظهار/إخفاء كلمة المرور" 
                aria-label="إظهار/إخفاء كلمة المرور"
                style="left: 8px; top: 50%; transform: translateY(-50%); width: 32px; height: 32px; display: inline-flex; align-items: center; justify-content: center; z-index: 10;"
              >
                ${getIcon('eye', 18)}
              </button>
            </div>
          </div>

          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 1.5rem;">
            <label style="display: inline-flex; align-items: center; gap: 0.45rem; cursor: pointer; font-size: 0.825rem; color: #475569; font-weight: 600; user-select: none;">
              <input type="checkbox" id="portalRememberMe" checked style="width: 16px; height: 16px; accent-color: #2563eb; cursor: pointer;">
              <span>تذكر بيانات الدخول على هذا الجهاز</span>
            </label>
          </div>

          <button 
            type="submit" 
            id="portalSubmitBtn" 
            style="width: 100%; padding: 0.85rem; border: none; border-radius: 0.75rem; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; font-size: 0.95rem; font-weight: 800; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); transition: opacity 0.2s;"
            onmouseover="this.style.opacity='0.95'"
            onmouseout="this.style.opacity='1'"
          >
            <span id="portalSubmitBtnText">${isStudent ? 'دخول بوابة الطالب' : 'دخول بوابة ولي الأمر'}</span>
            <span id="portalSubmitSpinner" style="display: none;">⏳</span>
          </button>
        </form>

        <!-- Informational Callout -->
        <div style="margin-top: 1.5rem; background: #f1f5f9; border-radius: 0.75rem; padding: 0.9rem; border: 1px dashed #cbd5e1; font-size: 0.775rem; color: #475569; line-height: 1.6;">
          <div style="display: flex; align-items: flex-start; gap: 0.4rem; margin-bottom: 0.35rem;">
            <span style="color: #2563eb; font-weight: 800;">💡</span>
            <span style="font-weight: 700; color: #1e293b;">أين تجد كلمة المرور؟</span>
          </div>
          <div>
            تم إرسال كلمة المرور المكونة من 6 أرقام مع رابط البوابة في رسالة الواتساب الترحيبية. في حال فقدانها، يمكنك مراجعة المعلم أو إدارة السنتر لتزويدك بها.
          </div>
        </div>

        <div style="font-size: 0.75rem; color: #94a3b8; text-align: center; margin-top: 1.5rem; border-top: 1px solid #f1f5f9; padding-top: 1rem;">
          منظومة سنترلي التعليمية | Centrly Platform
        </div>
      </div>
    </div>
  `;
}
