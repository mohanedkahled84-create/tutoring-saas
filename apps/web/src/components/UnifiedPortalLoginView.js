import { request, API_BASE_URL } from '../services/api.js';
import { renderParentPortalView } from './ParentPortalView.js';
import { renderStudentPortalView } from './StudentPortalView.js';
import { downloadStudentCardAsPng, openFullscreenBarcodeModal } from '../utils/studentBarcodeCard.js';
import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';
import { normalizeDigits } from '../utils/normalizeDigits.js';
import { preparePortalDestination } from '../utils/portalDestination.js';

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
    if (roleParam === 'student' || window.__teacherSubdomain) {
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
            ${(typeof window !== 'undefined' && window.__teacherSubdomain === 'mr-omar') ? 'منصة مستر عمر المحمدي — بوابة الطالب' : (isStudent ? 'بوابة الطالب' : 'بوابة ولي الأمر')}
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
            onclick="window.switchPortalLoginRole ? window.switchPortalLoginRole('parent') : (window.centrlyApp && window.centrlyApp.switchPortalLoginRole ? window.centrlyApp.switchPortalLoginRole('parent') : null)"
            style="flex: 1; padding: 0.65rem 0.5rem; border: none; border-radius: 0.55rem; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; background: ${!isStudent ? '#ffffff' : 'transparent'}; color: ${!isStudent ? '#1e3a8a' : '#64748b'}; box-shadow: ${!isStudent ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};"
          >
            <span>ولي أمر</span>
          </button>
          <button 
            type="button" 
            id="portalTabStudent" 
            onclick="window.switchPortalLoginRole ? window.switchPortalLoginRole('student') : (window.centrlyApp && window.centrlyApp.switchPortalLoginRole ? window.centrlyApp.switchPortalLoginRole('student') : null)"
            style="flex: 1; padding: 0.65rem 0.5rem; border: none; border-radius: 0.55rem; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; transition: all 0.2s; display: flex; align-items: center; justify-content: center; background: ${isStudent ? '#ffffff' : 'transparent'}; color: ${isStudent ? '#1d4ed8' : '#64748b'}; box-shadow: ${isStudent ? '0 2px 6px rgba(0,0,0,0.08)' : 'none'};"
          >
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
            <div style="position: relative; display: flex; align-items: center;">
              <input 
                type="password" 
                id="portalPassword" 
                name="password"
                class="form-input" 
                placeholder="••••••" 
                required 
                dir="ltr" 
                style="width: 100%; display: block; box-sizing: border-box; padding-top: 0.75rem; padding-bottom: 0.75rem; padding-right: 0.9rem; padding-left: 2.85rem !important; border: 1.5px solid #cbd5e1; border-radius: 0.65rem; font-size: 0.95rem; font-family: inherit; letter-spacing: 2px; outline: none; transition: border-color 0.2s;"
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
                style="position: absolute !important; left: 8px !important; top: 0 !important; bottom: 0 !important; margin: auto 0 !important; width: 32px !important; height: 32px !important; display: inline-flex !important; align-items: center !important; justify-content: center !important; z-index: 10 !important; transform: none !important; padding: 0 !important;"
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
            onclick="window.centrlyApp && window.centrlyApp.handlePortalLogin ? window.centrlyApp.handlePortalLogin(event) : null"
            style="width: 100%; padding: 0.85rem; border: none; border-radius: 0.75rem; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; font-size: 0.95rem; font-weight: 800; font-family: inherit; cursor: pointer; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25); transition: opacity 0.2s;"
            onmouseover="this.style.opacity='0.95'"
            onmouseout="this.style.opacity='1'"
          >
            <span id="portalSubmitBtnText">${isStudent ? 'دخول بوابة الطالب' : 'دخول بوابة ولي الأمر'}</span>
            <span id="portalSubmitSpinner" class="centrly-spinner" style="display: none; width: 14px; height: 14px; border-width: 2px; border-color: rgba(255,255,255,0.4); border-top-color: #fff;"></span>
          </button>
        </form>

        <!-- Informational Callout -->
        <div style="margin-top: 1.5rem; background: #f1f5f9; border-radius: 0.75rem; padding: 0.9rem; border: 1px dashed #cbd5e1; font-size: 0.775rem; color: #475569; line-height: 1.6;">
          <div style="display: flex; align-items: flex-start; gap: 0.4rem; margin-bottom: 0.35rem;">
            ${getIcon('info', 16, '#2563eb')}
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


/**
 * Register Unified Student & Parent Portal Actions (DEV-89)
 */
export function registerUnifiedPortalActions(app) {
  // DEV-34: No-App Parent Portal
  app.loadParentPortal = async function loadParentPortal(token) {
    window.__centrlyLoaded = true;
    this._parentPortalToken = token;
    try {
      if (typeof localStorage !== 'undefined' && token) {
        localStorage.setItem('centrly_portal_token', token);
        localStorage.setItem('centrly_portal_role', 'parent');
      }
      if (typeof sessionStorage !== 'undefined' && token) {
        sessionStorage.setItem('centrly_portal_token', token);
        sessionStorage.setItem('centrly_portal_role', 'parent');
      }
      if (window.history && window.history.replaceState && (window.location.pathname !== '/portal' || window.location.search || window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname === '/portal-entry' ? '/portal-entry' : '/portal');
      }
    } catch (_) {}

    try {
      if (await preparePortalDestination(this, token, 'parent', request)) return;
      const data = await request(`/public/parent-portal?token=${encodeURIComponent(token)}`);
      data.portal_presentation = this._portalPresentation;
      if (data && (data.error || !data.student)) {
        throw new Error(data.error?.message || data.error || 'تعذر تحميل بيانات بوابة ولي الأمر');
      }
      const appEl = this.getAppEl();
      if (appEl) {
        const savedTab = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_portal_parent_tab')) ||
                         (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_portal_parent_tab')) || 'attendance';
        appEl.innerHTML = renderParentPortalView(data, savedTab);
        const parentKey = (data && data.student && (data.student.id || data.student.parent_phone || data.student.student_code || data.student.code)) ? String(data.student.id || data.student.parent_phone || data.student.student_code || data.student.code).trim() : '';
        if (typeof window !== 'undefined' && parentKey) {
          window._centrlyCurrentParentId = parentKey;
          window._centrlyCurrentStudentId = String(data.student.id || data.student.student_code || data.student.code || '').trim();
          try { localStorage.setItem('centrly_portal_last_id', parentKey); } catch (_) {}
        }
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.openParentPortalTour) {
            window.openParentPortalTour(false, parentKey);
          }
        }, 500);
      }
    } catch (err) {
      const msg = err?.message || '';
      const isExpired = (msg.includes('غير صالح') || msg.includes('منتهي') || msg.includes('UNAUTHORIZED')) &&
                        !msg.includes('Failed to fetch') && !msg.includes('NetworkError') && !msg.includes('Failed to execute');
      if (isExpired) {
        try {
          localStorage.removeItem('centrly_portal_token');
          localStorage.removeItem('centrly_portal_role');
          sessionStorage.removeItem('centrly_portal_token');
          sessionStorage.removeItem('centrly_portal_role');
        } catch (_) {}
        this.renderPortalLogin('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
        return;
      }
      const appEl = this.getAppEl();
      if (appEl) {
        appEl.innerHTML = renderParentPortalView({
          error: msg || 'تعذر تحميل بيانات بوابة ولي الأمر. يرجى التحقق من صحة الرابط.',
        });
      }
    }
  }

  app.reloadParentPortal = async function reloadParentPortal() {
    if (this._parentPortalToken) {
      await this.loadParentPortal(this._parentPortalToken);
      this.showToast('تم تحديث بيانات المتابعة بنجاح!', 'success');
    } else {
      window.location.reload();
    }
  }

  app.loadStudentPortal = async function loadStudentPortal(token) {
    window.__centrlyLoaded = true;
    this._studentPortalToken = token;
    try {
      if (typeof localStorage !== 'undefined' && token) {
        localStorage.setItem('centrly_portal_token', token);
        localStorage.setItem('centrly_portal_role', 'student');
      }
      if (typeof sessionStorage !== 'undefined' && token) {
        sessionStorage.setItem('centrly_portal_token', token);
        sessionStorage.setItem('centrly_portal_role', 'student');
      }
      if (window.history && window.history.replaceState && (window.location.pathname !== '/portal' || window.location.search || window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname === '/portal-entry' ? '/portal-entry' : '/portal');
      }
    } catch (_) {}

    try {
      if (await preparePortalDestination(this, token, 'student', request)) return;
      const data = await request(`/public/parent-portal?token=${encodeURIComponent(token)}`);
      if (data && (data.error || !data.student)) {
        throw new Error(data.error?.message || data.error || 'تعذر تحميل بيانات بوابة الطالب');
      }

      // Online quiz definitions and scores are already scoped to this student by
      // the parent-portal API. Never load them through the legacy public quiz API.
      if (!Array.isArray(data.materials)) data.materials = [];
      if (!Array.isArray(data.quizzes)) data.quizzes = [];
      data.materials
        .filter(material => material.type === 'online_quiz')
        .forEach(material => {
          let payload = {};
          try {
            payload = typeof material.questions === 'string'
              ? JSON.parse(material.questions)
              : (material.questions || {});
          } catch (_) {}
          const questions = Array.isArray(payload.questions) ? payload.questions : [];
          const quizNumber = Number(payload.quiz_number) || 1;
          const maxScore = questions.reduce((sum, question) => sum + Number(question.points || 1), 0) || 10;
          const exists = data.quizzes.some(quiz => quiz.id === material.id || Number(quiz.quiz_number) === quizNumber);
          if (!exists) {
            data.quizzes.push({
              id: material.id,
              title: material.title || `كويز ${quizNumber}`,
              quiz_number: quizNumber,
              max_score: maxScore,
              quiz_date: payload.available_date || material.created_date || '',
              questions,
            });
          }
        });

      const appEl = this.getAppEl();
      if (appEl) {
        const savedTab = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_portal_student_tab')) ||
                         (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_portal_student_tab')) || 'dashboard';
        appEl.innerHTML = renderStudentPortalView(data, savedTab);
        const studentKey = (data && data.student && (data.student.id || data.student.student_code || data.student.code || data.student.student_phone)) ? String(data.student.id || data.student.student_code || data.student.code || data.student.student_phone).trim() : '';
        if (typeof window !== 'undefined' && studentKey) {
          window._centrlyCurrentStudentId = studentKey;
          if (data && data.student) {
            window._centrlyCurrentStudent = data.student;
            try {
              localStorage.setItem('centrly_current_student', JSON.stringify({
                id: data.student.id,
                student_code: data.student.student_code || data.student.code || studentKey,
                name: data.student.name,
                student_phone: data.student.student_phone || data.student.phone
              }));
            } catch (_) {}
          }
          try { localStorage.setItem('centrly_portal_last_id', studentKey); } catch (_) {}
        }
        setTimeout(() => {
          if (typeof window !== 'undefined' && window.openStudentPortalTour) {
            window.openStudentPortalTour(false, studentKey);
          }
        }, 500);
      }
    } catch (err) {
      const msg = err?.message || '';
      const isExpired = (msg.includes('غير صالح') || msg.includes('منتهي') || msg.includes('UNAUTHORIZED')) &&
                        !msg.includes('Failed to fetch') && !msg.includes('NetworkError') && !msg.includes('Failed to execute');
      if (isExpired) {
        try {
          localStorage.removeItem('centrly_portal_token');
          localStorage.removeItem('centrly_portal_role');
          sessionStorage.removeItem('centrly_portal_token');
          sessionStorage.removeItem('centrly_portal_role');
        } catch (_) {}
        this.renderPortalLogin('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
        return;
      }
      const appEl = this.getAppEl();
      if (appEl) {
        appEl.innerHTML = renderStudentPortalView({
          error: msg || 'تعذر تحميل بيانات بوابة الطالب. يرجى التحقق من صحة الرابط.',
        });
      }
    }
  }

  app.reloadStudentPortal = async function reloadStudentPortal() {
    if (this._studentPortalToken) {
      await this.loadStudentPortal(this._studentPortalToken);
      this.showToast('تم تحديث بيانات الطالب بنجاح!', 'success');
    } else {
      window.location.reload();
    }
  }

  // DEV-PORTAL: Unified Student & Parent Portal Login & Session Handlers
  app.renderPortalLogin = function renderPortalLogin(errorMessage = '') {
    window.__centrlyLoaded = true;
    this.currentRoute = 'portal';
    const appEl = this.getAppEl();
    if (appEl) {
      appEl.innerHTML = renderUnifiedPortalLoginView(errorMessage);
    }
    if (window.history?.replaceState && (window.location.pathname !== '/portal' || window.location.search || window.location.hash)) {
      window.history.replaceState(null, '', window.location.search ? `/portal${window.location.search}` : '/portal');
    }
  }

  app.switchPortalLoginRole = function switchPortalLoginRole(role) {
    const isStudent = role === 'student';
    const tabParent = document.getElementById('portalTabParent');
    const tabStudent = document.getElementById('portalTabStudent');
    const heading = document.getElementById('portalHeadingText');
    const subheading = document.getElementById('portalSubheadingText');
    const roleInput = document.getElementById('portalRole');
    const identLabel = document.getElementById('portalIdentifierLabel');
    const identHelp = document.getElementById('portalIdentifierHelp');
    const submitText = document.getElementById('portalSubmitBtnText');

    if (roleInput) roleInput.value = isStudent ? 'student' : 'parent';

    if (tabParent && tabStudent) {
      if (isStudent) {
        tabStudent.style.background = '#ffffff';
        tabStudent.style.color = '#1d4ed8';
        tabStudent.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';

        tabParent.style.background = 'transparent';
        tabParent.style.color = '#64748b';
        tabParent.style.boxShadow = 'none';
      } else {
        tabParent.style.background = '#ffffff';
        tabParent.style.color = '#1e3a8a';
        tabParent.style.boxShadow = '0 2px 6px rgba(0,0,0,0.08)';

        tabStudent.style.background = 'transparent';
        tabStudent.style.color = '#64748b';
        tabStudent.style.boxShadow = 'none';
      }
    }

    if (heading) heading.textContent = isStudent ? 'بوابة الطالب' : 'بوابة ولي الأمر';
    if (subheading) subheading.textContent = isStudent
      ? 'سجّل دخولك لتحميل المذكرات، تسليم الواجبات، ومتابعة درجاتك'
      : 'سجّل دخولك لمتابعة الحضور والغياب، الدرجات، والواجبات';
    if (identLabel) identLabel.textContent = isStudent
      ? 'رقم هاتف الطالب أو كود الطالب'
      : 'رقم هاتف ولي الأمر أو كود الطالب';
    if (identHelp) identHelp.textContent = isStudent
      ? 'اكتب رقم هاتفك المسجل لدى المعلم أو كودك الشخصي'
      : 'اكتب رقم هاتف ولي الأمر أو كود الطالب';
    if (submitText) submitText.textContent = isStudent ? 'دخول بوابة الطالب' : 'دخول بوابة ولي الأمر';

    if (window.history?.replaceState) {
      const url = new URL(window.location.href);
      url.searchParams.set('role', isStudent ? 'student' : 'parent');
      window.history.replaceState(null, '', url.pathname + url.search);
    }
  }

  app.togglePortalPasswordVisibility = function togglePortalPasswordVisibility(btn, event) {
    this.togglePasswordVisibility('portalPassword', btn, event);
  }

  app.handlePortalLogin = async function handlePortalLogin(event) {
    if (event && event.preventDefault) event.preventDefault();
    const identInput = document.getElementById('portalIdentifier');
    const passInput = document.getElementById('portalPassword');
    const rememberCheckbox = document.getElementById('portalRememberMe');
    const submitBtn = document.getElementById('portalSubmitBtn');
    const spinner = document.getElementById('portalSubmitSpinner');
    const alertEl = document.getElementById('portalLoginAlert');
    const roleInput = document.getElementById('portalRole');

    try {
      const identifier = identInput ? normalizeDigits(identInput.value).trim() : '';
      const password = passInput ? normalizeDigits(passInput.value).trim() : '';
      const role = roleInput ? roleInput.value : 'parent';
      const rememberMe = rememberCheckbox ? rememberCheckbox.checked : true;

      if (!identifier || !password) {
        if (alertEl) {
          alertEl.style.display = 'block';
          alertEl.textContent = 'يرجى كتابة رقم الهاتف أو كود الطالب وكلمة المرور';
        }
        return;
      }

      if (submitBtn) submitBtn.disabled = true;
      if (spinner) spinner.style.display = 'inline';
      if (alertEl) alertEl.style.display = 'none';

      const res = await request('/public/portal/login', {
        method: 'POST',
        body: { identifier, password, role },
      });

      if (res && res.success && res.token) {
        const targetRole = (role === 'student' || role === 'parent') ? role : (res.role || 'parent');
        try {
          localStorage.setItem('centrly_portal_token', res.token);
          localStorage.setItem('centrly_portal_role', targetRole);
          sessionStorage.setItem('centrly_portal_token', res.token);
          sessionStorage.setItem('centrly_portal_role', targetRole);
        } catch (_) {}

        this.showToast('مرحباً بك! تم تسجيل الدخول بنجاح', 'success');

        try {
          if (window.history && window.history.replaceState) {
            window.history.replaceState(null, '', '/portal');
          }
        } catch (_) {}

        if (targetRole === 'student') {
          await this.loadStudentPortal(res.token);
        } else {
          await this.loadParentPortal(res.token);
        }
      } else {
        throw new Error(res?.error?.message || 'تعذر تسجيل الدخول. يرجى التأكد من البيانات.');
      }
    } catch (err) {
      console.error('Portal login error:', err);
      const errorMsg = err?.message || 'تعذر تسجيل الدخول. يرجى التأكد من البيانات.';
      if (alertEl) {
        alertEl.style.display = 'block';
        alertEl.textContent = errorMsg;
      } else {
        this.renderPortalLogin(errorMsg);
      }
    } finally {
      if (submitBtn) submitBtn.disabled = false;
      if (spinner) spinner.style.display = 'none';
    }
  }

  app.handlePortalLogout = function handlePortalLogout() {
    try {
      localStorage.removeItem('centrly_portal_token');
      localStorage.removeItem('centrly_portal_role');
      sessionStorage.removeItem('centrly_portal_token');
      sessionStorage.removeItem('centrly_portal_role');
      sessionStorage.removeItem('centrly_student_portal_token');
    } catch (_) {}
    this._parentPortalToken = null;
    this._studentPortalToken = null;
    this.showToast('تم تسجيل الخروج بنجاح', 'info');
    this.renderPortalLogin();
  }

  app.downloadStudentCardPng = function downloadStudentCardPng(student) {
    downloadStudentCardAsPng(student);
  }

  app.openFullscreenBarcode = function openFullscreenBarcode(student) {
    openFullscreenBarcodeModal(student);
  }

  app.compressImageFile = async function compressImageFile(file, maxWidth = 1600, quality = 0.72) {
    return new Promise((resolve) => {
      const isImg = (file && file.type && file.type.startsWith('image/')) ||
        (file && file.name && /\.(jpg|jpeg|png|webp|bmp|heic)$/i.test(file.name));
      if (!isImg) {
        resolve(null);
        return;
      }
      const reader = new FileReader();
      reader.onerror = () => resolve(null);
      reader.onload = (e) => {
        const img = new Image();
        img.onerror = () => resolve(null);
        img.onload = () => {
          try {
            let { width, height } = img;
            if (width > maxWidth || height > maxWidth) {
              if (width > height) {
                height = Math.round((height * maxWidth) / width);
                width = maxWidth;
              } else {
                width = Math.round((width * maxWidth) / height);
                height = maxWidth;
              }
            }
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            if (!ctx) {
              resolve(null);
              return;
            }
            ctx.drawImage(img, 0, 0, width, height);
            let compressed = canvas.toDataURL('image/jpeg', quality);
            let estimatedBytes = Math.round((compressed.length * 3) / 4);

            // If still over 800KB, perform secondary pass with lower quality for fast network transfer
            if (estimatedBytes > 800 * 1024) {
              compressed = canvas.toDataURL('image/jpeg', 0.55);
              estimatedBytes = Math.round((compressed.length * 3) / 4);
            }

            resolve({
              data: compressed,
              size: estimatedBytes,
              name: (file.name || 'homework').replace(/\.[^/.]+$/, '') + '.jpg',
            });
          } catch (_) {
            resolve(null);
          }
        };
        img.src = e.target.result;
      };
      reader.readAsDataURL(file);
    });
  }

  app.handleStudentHomeworkUpload = async function handleStudentHomeworkUpload(materialId, file) {
    if (!file) return;

    const fileInput = document.getElementById(`hw-file-input-${materialId}`);
    const resetFileInput = () => {
      if (fileInput) fileInput.value = '';
    };

    const isPdf = (file.type && file.type.includes('pdf')) || (file.name && file.name.toLowerCase().endsWith('.pdf'));
    const isImage = (file.type && file.type.startsWith('image/')) || (file.name && /\.(jpg|jpeg|png|webp|heic|bmp)$/i.test(file.name));

    if (!isPdf && !isImage) {
      resetFileInput();
      this.showToast('يرجى رفع ملف الواجب بصيغة PDF أو صورة واضحة (JPG / PNG / WEBP).', 'warning');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      resetFileInput();
      this.showToast('حجم الملف يتجاوز الحد الأقصى المسموح به (25 ميجابايت). يرجى ضغط الملف أو تقليل دقة الصور.', 'warning');
      return;
    }

    const token = this._studentPortalToken
      || this._parentPortalToken
      || (typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_portal_token') : null)
      || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('centrly_portal_token') : null)
      || new URLSearchParams(window.location.search).get('token')
      || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('centrly_student_portal_token') : null)
      || '';

    if (!token) {
      resetFileInput();
      this.showToast('تعذر التحقق من رمز الطالب أو ولي الأمر. يرجى إعادة فتح الرابط والمحاولة مرة أخرى.', 'danger');
      return;
    }

    const btn = document.getElementById(`hw-upload-btn-${materialId}`);
    const originalText = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span>جارٍ معالجة الملف...</span>';
    }

    try {
      let uploadBase64 = null;
      let uploadFileName = file.name;
      let uploadFileSize = file.size;

      if (isImage) {
        if (btn) btn.innerHTML = '<span>جارٍ تجهيز وضغط الصورة للرفع السريع...</span>';
        const compressed = await this.compressImageFile(file, 1280, 0.68);
        if (compressed && compressed.data) {
          uploadBase64 = compressed.data;
          uploadFileName = compressed.name;
          uploadFileSize = compressed.size;
        }
      }

      if (!uploadBase64) {
        if (btn) btn.innerHTML = '<span>جارٍ قراءة الملف...</span>';
        uploadBase64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = (e) => resolve(e.target.result);
          reader.onerror = () => reject(new Error('تعذر قراءة الملف من جهازك'));
          reader.readAsDataURL(file);
        });
      }

      if (btn) btn.innerHTML = '<span>جارٍ بدء الرفع (0%)...</span>';

      // Upload with real-time percentage progress tracking
      await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest();
        xhr.open('POST', `${API_BASE_URL}/public/homework/submit`);
        xhr.setRequestHeader('Content-Type', 'application/json');

        const totalMb = (uploadFileSize / (1024 * 1024)).toFixed(1);

        xhr.upload.onprogress = (evt) => {
          if (evt.lengthComputable && btn) {
            const percent = Math.min(99, Math.round((evt.loaded / evt.total) * 100));
            const loadedMb = (evt.loaded / (1024 * 1024)).toFixed(1);
            btn.innerHTML = `<span>جارٍ الرفع (${percent}% • ${loadedMb}/${totalMb} ميجا)...</span>`;
          }
        };

        xhr.upload.onload = () => {
          if (btn) btn.innerHTML = '<span>تم الرفع 100%! جارٍ حفظ وتأكيد الواجب في السحابة...</span>';
        };

        xhr.onload = () => {
          if (btn) btn.innerHTML = '<span>جارٍ معالجة وحفظ الواجب في السحابة...</span>';
          let respData = {};
          try {
            respData = JSON.parse(xhr.responseText);
          } catch (_) {}

          if (xhr.status >= 200 && xhr.status < 300) {
            resolve(respData);
          } else {
            const errMsg = respData?.error?.message || `فشل حفظ الواجب (${xhr.status})`;
            reject(new Error(errMsg));
          }
        };

        xhr.onerror = () => reject(new Error('انقطع الاتصال بالإنترنت أثناء الرفع. يرجى التأكد من استقرار الشبكة والمحاولة مجدداً'));
        xhr.ontimeout = () => reject(new Error(`استغرق رفع الملف (${totalMb} ميجا) وقتاً طويلاً بسبب بطء سرعة الرفع لديك. يرجى الاتصال بشبكة أسرع أو تقليل حجم الملف والمحاولة مرة أخرى`));
        // Dynamic timeout: 6 minutes minimum, up to 15 minutes (900,000ms) for large files up to 25MB on slow ADSL/3G
        const uploadTimeoutMs = Math.min(900000, Math.max(360000, Math.round((uploadFileSize / (25 * 1024)) * 1000) + 120000));
        xhr.timeout = uploadTimeoutMs;

        xhr.send(JSON.stringify({
          token,
          material_id: materialId,
          file_data: uploadBase64,
          file_name: uploadFileName,
          file_size: uploadFileSize,
        }));
      });

      this.showToast('تم رفع حل الواجب بنجاح وإرساله لمعلمك للمراجعة.', 'success');
      resetFileInput();

      const portalRole = (typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_portal_role') : null)
        || (this._parentPortalToken ? 'parent' : 'student');
      if (portalRole === 'parent' && this.loadParentPortal) {
        await this.loadParentPortal(token);
      } else {
        await this.loadStudentPortal(token);
      }
    } catch (subErr) {
      console.error('Homework upload error:', subErr);
      this.showToast(`فشل رفع الواجب: ${subErr.message || 'حدث خطأ في الاتصال'}`, 'danger');
      resetFileInput();
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }


}
