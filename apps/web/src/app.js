import { authService } from './services/auth.js';
import { request, API_BASE_URL } from './services/api.js';
import { renderSidebar } from './components/Sidebar.js?v=4.7.2';
import { renderNavbar } from './components/Navbar.js';
import { renderAuthScreens, renderEmailVerificationScreen } from './components/AuthScreens.js?v=4.7.8';
import { renderOnboardingWizard } from './components/OnboardingWizard.js';
import { renderTeacherDashboard } from './components/TeacherDashboard.js?v=2.2.0';
import { renderTeacherCalendar } from './components/TeacherCalendar.js';
import { renderSessionsView } from './components/SessionsView.js';
import { renderStudentsView } from './components/StudentsView.js?v=2.8.0';
import { renderGroupsView } from './components/GroupsView.js?v=2.8.0';
import { renderMessageLogsView } from './components/MessageLogsView.js';
import { renderParentPortalView } from './components/ParentPortalView.js?v=4.0.0';
import { renderStudentPortalView } from './components/StudentPortalView.js?v=4.0.0';
import { renderUnifiedPortalLoginView } from './components/UnifiedPortalLoginView.js?v=4.0.0';
import { renderHomeworkReviewView } from './components/HomeworkReviewView.js?v=4.0.0';
import { renderCenterOwnerDashboard } from './components/CenterOwnerDashboard.js';
import { renderStudentReportsView } from './components/StudentReportsView.js?v=2.1.0';
import { renderRiskWatchlistView } from './components/RiskWatchlistView.js';
import { renderBillingView } from './components/BillingView.js?v=3.8.0';
import { renderWhatsAppSettingsView } from './components/WhatsAppSettingsView.js';
import { renderStudentCardsView } from './components/StudentCardsView.js';
import { renderTeacherQuizzesView } from './components/TeacherQuizzesView.js?v=2.6.0';
import { renderCenterSessionsView } from './components/CenterSessionsView.js';
import { renderCenterTeachersView } from './components/CenterTeachersView.js';
import { renderCenterAssistantsView } from './components/CenterAssistantsView.js';
import { renderCenterRoomsView } from './components/CenterRoomsView.js';
import { renderCenterSettlementsView } from './components/CenterSettlementsView.js';
import { renderLandingView } from './components/LandingView.js?v=2.8.0';
import { renderMaterialsView } from './components/MaterialsView.js?v=2.9.0';
import { renderTeacherAssistantsView } from './components/TeacherAssistantsView.js?v=2.1.0';
import { renderBusinessOwnerDashboard } from './components/BusinessOwnerDashboard.js';
import { renderAdminPaymentProofsView } from './components/AdminPaymentProofsView.js';
import { renderAdminTenantsView } from './components/AdminTenantsView.js';
import { renderTeacherSettingsView } from './components/TeacherSettingsView.js?v=4.7.2';
import { renderCouponsView } from './components/CouponsView.js?v=4.7.6';
import { getIcon } from './utils/icons.js';
import { escapeHtml } from './utils/escapeHtml.js';
import { generateBarcode128Svg, openFullscreenBarcodeModal, downloadStudentCardAsPng, renderStudentBarcodeCardHtml } from './utils/studentBarcodeCard.js?v=3.0.0';
import { playBeep, unlockAudio } from './utils/beepAudio.js';

class CentrlyApp {
  constructor() {
    this.user = authService.getUser();
    const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
    const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    this.currentRoute = isAdmin ? 'admin-dashboard' : (isCenter ? 'center-dashboard' : 'dashboard');
    this.giftCodes = [];
    this.adminOverviewData = null;
    this.adminProofsData = { payment_proofs: [] };
    this.adminProofsFilter = 'pending';
    this.adminTenantsData = { tenants: [] };
    this.adminTenantsFilter = 'all';
    this.adminTenantsSearchQuery = '';
    this.centerDashboardState = {
      activeTab: 'teachers',
      period: new Date().toISOString().slice(0, 7),
      rollup: null,
      rooms: [],
      conflictCheckResult: null,
      frontDeskScanResult: null,
      generatedInvite: null,
    };
    this.centerTeachers = [];
    this.centerRooms = [];
    this.centerAssistants = [];
    this.centerSessionsState = {
      activeSessions: [],
      upcomingSessions: [],
      scanResult: null,
    };
    this.quizzesState = {
      selectedGroupId: '',
      currentQuizNumber: 1,
      quizzes: [
        { id: 1, number: 1, title: 'كويز 1', maxScore: 10, date: '2026-09-01', skipped: false },
        { id: 2, number: 2, title: 'كويز 2', maxScore: 10, date: '2026-09-05', skipped: false },
        { id: 3, number: 3, title: 'كويز 3', maxScore: 10, date: '2026-09-08', skipped: false },
      ],
      scoresMap: {},
      notesMap: {},
    };
    this.studentsLoading = false;
    this.onboardingStep = 1;
    this.onboardingState = {
      groupName: '',
      sessionPrice: 100,
      students: [],
      homeworkSubmission: 'in_session',
      autoNotification: true,
    };
    this.sessionState = {
      id: null,
      status: 'scheduled',
      group: null,
      attendanceList: [],
      financials: {
        totalRevenue: 0,
        attendeeCount: 0,
        absentCount: 0,
        exemptCount: 0,
        makeupCount: 0,
      },
    };
    this.messageLogs = [];
    this.students = [];
    this.groups = [];
    this.dashboardData = null;
    this.calendarSessions = [];
    this.calendarState = {
      view: 'week',
      selectedGroup: 'all',
      dateLabel: 'جدول الحصص والتقويم الأسبوعي',
      weekOffset: 0,
      sessions: [],
      groups: [],
    };
    this.reportsState = {
      activeTab: 'academic',
      period: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
      leaderboard: [],
      groups: [],
      assistants: [],
      students: [],
      selectedGroupId: '',
      searchQuery: '',
      total_students: 0,
      average_attendance_rate: 0,
      average_score: 0,
      isSubmittingBulk: false,
    };
    this.watchlistData = [];
    this.billingState = null;
    this.billingCycle = 'monthly';
    this.whatsappState = null;
    this.routeErrors = {};
    this.materials = [];
    this.materialsGroupId = 'all';
    this.teacherAssistants = [];
    const cachedHasPin = localStorage.getItem('centrly_has_security_pin');
    const cachedUser = authService.getUser();
    this.hasSecurityPin = (cachedUser && typeof cachedUser.has_security_pin === 'boolean')
      ? cachedUser.has_security_pin
      : (cachedHasPin !== null ? cachedHasPin === 'true' : Boolean(localStorage.getItem('centrly_financial_pin')));
    // Cross-Device Security: If account has a PIN, protected views are ALWAYS locked by default
    this.isFinancialUnlocked = !this.hasSecurityPin;
    this.hideFinancialNumbers = false;
    this.routeLoadingState = {};
    this.settingsState = { activeTab: 'profile', barcodeAudio: true };
    this.currentTheme = 'light';
    this.restoreCachedData();
    this.initTheme();
  }

  initTheme() {
    this.currentTheme = 'light';
    try {
      localStorage.removeItem('centrly_theme');
    } catch (_) {}
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', 'light');
    }
  }

  setTheme(theme = 'light') {
    this.currentTheme = 'light';
    if (typeof document !== 'undefined') {
      document.documentElement.removeAttribute('data-theme');
      document.documentElement.setAttribute('data-theme', 'light');
    }
    try {
      localStorage.removeItem('centrly_theme');
    } catch (_) {}
  }

  toggleTheme() {
    this.setTheme('light');
  }

  saveCache(key, data) {
    try {
      localStorage.setItem(`centrly_cache_${key}`, JSON.stringify(data));
    } catch (_) {}
  }

  loadCache(key, defaultValue = null) {
    try {
      const raw = localStorage.getItem(`centrly_cache_${key}`);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (_) {
      return defaultValue;
    }
  }

  restoreCachedData() {
    try {
      const cachedGroups = this.loadCache('groups', null);
      if (cachedGroups && Array.isArray(cachedGroups) && cachedGroups.length > 0) {
        this.groups = cachedGroups;
      }
      const cachedStudents = this.loadCache('students', null);
      if (cachedStudents && Array.isArray(cachedStudents) && cachedStudents.length > 0) {
        this.students = cachedStudents;
      }
      const cachedDashboard = this.loadCache('dashboardData', null);
      if (cachedDashboard) {
        this.dashboardData = cachedDashboard;
      }
      const cachedBilling = this.loadCache('billingState', null);
      if (cachedBilling) {
        this.billingState = cachedBilling;
      }
      const cachedMaterials = this.loadCache('materials', null);
      if (cachedMaterials && Array.isArray(cachedMaterials)) {
        this.materials = cachedMaterials;
      }
      const cachedAssistants = this.loadCache('teacherAssistants', null);
      if (cachedAssistants && Array.isArray(cachedAssistants)) {
        this.teacherAssistants = cachedAssistants;
      }
    } catch (_) {}
  }

  hasRouteData(route) {
    switch (route) {
      case 'dashboard':
      case 'teacher-dashboard':
        return Boolean(this.dashboardData);
      case 'students':
        return Boolean(this.students && this.students.length > 0);
      case 'groups':
        return Boolean(this.groups && this.groups.length > 0);
      case 'billing':
      case 'settings':
        return Boolean(this.billingState);
      case 'materials':
        return Boolean(this.materials && this.materials.length > 0);
      case 'assistants':
        return Boolean(this.teacherAssistants && this.teacherAssistants.length > 0);
      case 'student-cards':
        return Boolean(this.students && this.students.length > 0);
      case 'calendar':
        return Boolean(this.calendarSessions && this.calendarSessions.length > 0);
      case 'center-dashboard':
        return Boolean(this.centerDashboardState?.rollup);
      default:
        return false;
    }
  }

  startProgressBar() {
    let bar = document.getElementById('centrlyProgressBar');
    if (!bar) {
      bar = document.createElement('div');
      bar.id = 'centrlyProgressBar';
      bar.className = 'top-progress-bar';
      document.body.appendChild(bar);
    }
    bar.classList.add('active');
    bar.style.width = '30%';
    if (this._progressTimer) clearTimeout(this._progressTimer);
    this._progressTimer = setTimeout(() => {
      if (bar.classList.contains('active')) {
        bar.style.width = '70%';
      }
    }, 200);
  }

  finishProgressBar() {
    const bar = document.getElementById('centrlyProgressBar');
    if (!bar) return;
    if (this._progressTimer) clearTimeout(this._progressTimer);
    bar.style.width = '100%';
    setTimeout(() => {
      bar.classList.remove('active');
      bar.style.width = '0%';
    }, 250);
  }

  async prefetchCoreData() {
    if (!authService.isAuthenticated()) return;
    const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
    if (isAdmin) {
      try {
        const [ovRes, proofsRes, tenantsRes] = await Promise.all([
          request('/admin/overview').catch(() => null),
          request('/admin/payment-proofs').catch(() => null),
          request('/admin/tenants').catch(() => null),
        ]);
        if (ovRes) {
          const overview = ovRes.metrics || ovRes || {};
          const proofs = proofsRes?.payment_proofs || [];
          const tenants = tenantsRes?.tenants || [];
          const pendingCount = proofs.filter(p => p.status === 'pending').length;
          const activeCount = tenants.filter(t => t.subscription_status === 'active').length;
          const trialCount = tenants.filter(t => t.subscription_status === 'trial').length;
          const expiredCount = tenants.filter(t => ['expired', 'past_due', 'deactivated'].includes(t.subscription_status)).length;
          this.adminOverviewData = {
            overview: {
              total_tenants: tenants.length || overview.total_tenants || 0,
              active_tenants: activeCount || overview.active_tenants || 0,
              trial_tenants: trialCount || overview.trial_tenants || 0,
              mrr_egp: (activeCount * 799) || overview.mrr_egp || 0,
              total_students: overview.total_students || 0,
              total_sessions: overview.total_sessions || 0,
              whatsapp: overview.whatsapp || { total_sent: 0, total_failed: 0, estimated_cost_egp: 0 },
            },
            subscription_breakdown: {
              active: activeCount,
              trial: trialCount,
              pending_verification: pendingCount,
              expired: expiredCount,
            },
            recent_signups: tenants.slice(0, 5),
            at_risk_tenants: tenants.filter(t => t.subscription_status === 'trial').slice(0, 5).map(t => ({
              tenant_name: t.name,
              details: `تنتهي التجربة في: ${t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('ar-EG') : 'قريباً'}`,
            })),
          };
          if (proofsRes) this.adminProofsData = proofsRes;
          if (tenantsRes) this.adminTenantsData = tenantsRes;
          if (['admin-dashboard', 'admin-proofs', 'admin-tenants'].includes(this.currentRoute)) {
            this.renderMainContent();
          }
        }
      } catch (_) {}
      return;
    }

    try {
      const [studRes, grpRes, billingRes] = await Promise.all([
        request('/students').catch(() => null),
        request('/groups').catch(() => null),
        request('/billing/status').catch(() => null),
      ]);
      if (studRes) {
        this.students = Array.isArray(studRes) ? studRes : (studRes.students || []);
        this.saveCache('students', this.students);
      }
      if (grpRes) {
        this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
        this.saveCache('groups', this.groups);
      }
      if (billingRes) {
        this.billingState = billingRes;
        this.saveCache('billingState', this.billingState);
      }
    } catch (_) {}
  }

  async init() {
    this.setupModalKeyboardShortcuts();

    // Prevent accidental mouse wheel number changes across all number inputs
    document.addEventListener('wheel', () => {
      if (document.activeElement && document.activeElement.type === 'number') {
        document.activeElement.blur();
      }
    }, { passive: true });

    // Auto-lock sensitive financial pages when browser tab loses focus or is hidden
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.hasSecurityPin && this.isFinancialUnlocked) {
        this.isFinancialUnlocked = false;
        if (this.currentRoute === 'teacher-dashboard' || this.currentRoute === 'assistants') {
          this.renderMainContent();
        }
      }
    });

    // Check if Short Portal URL is present (/p/:code or /s/:code or /p:code or /s:code or ?s=:code or ?p=:code)
    const urlParams = new URLSearchParams(window.location.search);
    const pathname = (window.location.pathname || '').trim();
    const shortMatch = pathname.match(/^\/([ps])\/?([a-zA-Z0-9_-]+)$/i);
    const queryShortCode = urlParams.get('s') || urlParams.get('p');
    const queryShortType = urlParams.get('s') ? 's' : (urlParams.get('p') ? 'p' : null);

    const resolvedShortCode = shortMatch ? shortMatch[2] : queryShortCode;
    const resolvedShortType = shortMatch ? shortMatch[1].toLowerCase() : queryShortType;

    if (resolvedShortCode) {
      try {
        const queryCode = (resolvedShortCode.startsWith('p') || resolvedShortCode.startsWith('s'))
          ? resolvedShortCode
          : `${resolvedShortType || 'p'}${resolvedShortCode}`;
        const shortData = await request(`/public/short-links/${encodeURIComponent(queryCode)}`);
        if (shortData && shortData.token) {
          if (shortData.portal_type === 'student' || resolvedShortType === 's') {
            await this.loadStudentPortal(shortData.token);
          } else {
            await this.loadParentPortal(shortData.token);
          }
          return;
        }
      } catch (err) {
        console.warn('Could not resolve short portal link:', err);
      }
    }

    // Check if Portal token is present in URL (Student vs Parent Portal)
    const portalToken = urlParams.get('token');
    const portalType = urlParams.get('portal');
    if (portalToken) {
      if (portalType === 'student') {
        await this.loadStudentPortal(portalToken);
      } else {
        await this.loadParentPortal(portalToken);
      }
      return;
    }

    // DEV-PORTAL: Unified Portal Route (/portal or ?view=portal)
    const cleanPath = (window.location.pathname || '').trim().replace(/\/+$/, '');
    if (cleanPath === '/portal' || urlParams.get('view') === 'portal' || (urlParams.get('portal') === 'login' && !portalToken)) {
      const cachedPortalToken = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_portal_token')) ||
                                (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_portal_token'));
      const cachedPortalRole = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_portal_role')) ||
                               (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_portal_role'));
      if (cachedPortalToken) {
        if (cachedPortalRole === 'student') {
          await this.loadStudentPortal(cachedPortalToken);
        } else {
          await this.loadParentPortal(cachedPortalToken);
        }
        return;
      }
      this.renderPortalLogin();
      return;
    }

    // Check for password recovery hash / query (from Supabase password reset email)
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const isRecovery = hashParams.get('type') === 'recovery' || urlParams.get('type') === 'recovery';
    const recoveryToken = hashParams.get('access_token') || urlParams.get('token');

    if (isRecovery && recoveryToken) {
      this.renderAuth('login');
      this.openResetPasswordModal(recoveryToken);
      if (window.history?.replaceState) {
        window.history.replaceState(null, '', window.location.pathname);
      }
      return;
    }

    const hasToken = authService.isAuthenticated();
    const hasCachedSession = authService.hasSession();

    if (!hasToken && !hasCachedSession) {
      const viewParam = urlParams.get('view');
      if (viewParam === 'login' || viewParam === 'signup') {
        this.renderAuth(viewParam);
      } else {
        this.renderLanding();
      }
    } else {
      this.user = authService.getUser();

      // If token expired but we have a cached session, try silent refresh first
      if (!hasToken && hasCachedSession) {
        const refreshed = await authService.tryRefreshSession();
        if (!refreshed) {
          // Refresh failed completely - clear session and show login
          authService.clearSession();
          this.renderAuth('login');
          return;
        }
      }

      // Try to fetch fresh profile from server
      try {
        const me = await authService.getProfile().catch(() => null);
        if (me?.user) {
          this.user = { ...this.user, ...me.user };
          authService.setUser(this.user);
        }
      } catch (_) {
        // getProfile failed (e.g. network error or token just expired)
      }

      // If getProfile's 401 handler wiped the token, try one explicit refresh
      if (!authService.getToken()) {
        const refreshed = await authService.tryRefreshSession();
        if (!refreshed) {
          // No valid token and refresh failed - must re-login
          authService.clearSession();
          this.renderAuth('login');
          return;
        }
        // Refresh succeeded - retry profile fetch with fresh token
        try {
          const me = await authService.getProfile().catch(() => null);
          if (me?.user) {
            this.user = { ...this.user, ...me.user };
            authService.setUser(this.user);
          }
        } catch (_) {}
      }

      // If we still have no user data at all, redirect to login
      if (!this.user) {
        authService.clearSession();
        this.renderAuth('login');
        return;
      }

      const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
      const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
      const savedRoute = localStorage.getItem('centrly_current_route');
      const adminRoutes = ['admin-dashboard', 'admin-proofs', 'admin-tenants', 'coupons', 'activity-logs'];

      if (isAdmin) {
        this.currentRoute = (savedRoute && adminRoutes.includes(savedRoute)) ? savedRoute : 'admin-dashboard';
      } else if (isCenter) {
        this.currentRoute = (savedRoute && savedRoute !== 'dashboard' && !adminRoutes.includes(savedRoute)) ? savedRoute : 'center-dashboard';
      } else {
        this.currentRoute = (savedRoute && savedRoute !== 'center-dashboard' && !adminRoutes.includes(savedRoute)) ? savedRoute : 'dashboard';
      }

      // Cross-Device Account-Level Security: Sync PIN status from user profile and cloud
      if (typeof this.user?.has_security_pin === 'boolean') {
        this.hasSecurityPin = this.user.has_security_pin;
        if (this.hasSecurityPin) {
          this.isFinancialUnlocked = false;
          try {
            localStorage.setItem('centrly_has_security_pin', 'true');
          } catch (_) {}
        }
      }

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

      this.restoreSessionState();

      // Cross-Device Sync: Check server for active session if local state is empty
      if (!this.sessionState?.id) {
        try {
          const activeSessions = await request('/sessions?status=in_progress').catch(() => null);
          const activeList = Array.isArray(activeSessions) ? activeSessions : (activeSessions?.sessions || []);
          if (activeList.length > 0) {
            await this.syncAndResumeServerSession(activeList[0].id);
          }
        } catch (_) {}
      } else if (this.sessionState?.status === 'in_progress') {
        this.startLiveSessionSync();
      }

      this.renderApp();
      this.prefetchCoreData();
      await this.loadRouteData(this.currentRoute);
      this.renderMainContent();
    }
  }

  // Official Landing / Welcome Page
  renderLanding() {
    window.scrollTo(0, 0);
    document.title = 'سنترلي | Centrly - المنظومة السحابية الأذكى لإدارة المعلمين والمراكز التعليمية';
    document.getElementById('app').innerHTML = renderLandingView();
    this.initCookieConsent();
  }

  // Kashier Compliance & Legal Policies Modal Flow
  openPolicyModal(type) {
    const overlay = document.getElementById('policyModalOverlay');
    const titleEl = document.getElementById('policyModalTitle');
    const bodyEl = document.getElementById('policyModalBody');
    if (!overlay || !titleEl || !bodyEl) return;

    if (type === 'terms') {
      titleEl.innerText = 'شروط وأحكام الاستخدام (Terms of Service)';
      bodyEl.innerHTML = `
        <h4 style="color: #1e3a8a; margin-top: 0; font-weight: 800;">1. مقدمة وقبول الشروط</h4>
        <p>مرحباً بك في منصة <b>سنترلي (Centrly)</b>. باستخدامك لخدماتنا عبر هذا الموقع أو الاشتراك في باقاتنا، فإنك توافق على الالتزام الكامل بهذه الشروط والأحكام. إذا كنت لا توافق على أي بند، يرجى التوقف عن استخدام المنصة.</p>
        
        <h4 style="color: #1e3a8a; font-weight: 800;">2. وصف الخدمة</h4>
        <p>سنترلي هي منصة برمجية سحابية (SaaS) مصممة لإدارة وتطوير شؤون المعلمين المستقلين والمراكز التعليمية، وتشمل تسجيل حضور الطلاب عبر الباركود، وإصدار كروت الطلاب، وأتمتة إشعارات أولياء الأمور عبر الواتساب، ورصد الكويزات وبوابة المتابعة التفاعلية لولي الأمر.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">3. حسابات المستخدمين والمسؤولية</h4>
        <p>أنت مسؤول مسؤولية كاملة عن الحفاظ على سرية بيانات تسجيل الدخول الخاصة بحسابك، وعن أي نشاط يصدر من خلاله. يتعهد المعلم أو إدارة السنتر بعدم استخدام الخدمة في أي غرض مخالف للقوانين المعمول بها في جمهورية مصر العربية.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">4. الاشتراكات والدفع</h4>
        <p>يتم تحصيل رسوم الاشتراك بالجنيه المصري (EGP) شهرياً وفقاً للباقة المختارة. تحتفظ المنصة بالحق في تعديل الأسعار مستقبلاً مع إخطار المشتركين مسبقاً قبل موعد التجديد بوقت كافٍ.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">5. الملكية الفكرية والبيانات</h4>
        <p>جميع حقوق الملكية الفكرية، التصاميم، العلامات التجارية، والبرمجيات الخاصة بـ سنترلي هي ملكية حصرية للمنصة، في حين تظل جميع بيانات الطلاب وأولياء الأمور ملكية حصرية للمدرس أو السنتر المشترك.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">6. خدمة رسائل الواتساب</h4>
        <p style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 0.85rem 1rem; color: #166534; font-size: 0.875rem; line-height: 1.8;">
          تتيح المنصة للمعلم والسنتر إرسال تقارير الحضور ودرجات الاختبارات وروابط المتابعة لأولياء الأمور بكفاءة وسلاسة، وتخضع الخدمة لسياسات الاستخدام العادل والتنظيم الذاتي للمراسلات التعليمية.
        </p>
      `;
    } else if (type === 'privacy') {
      titleEl.innerText = 'سياسة الخصوصية وحماية البيانات (Privacy Policy)';
      bodyEl.innerHTML = `
        <h4 style="color: #1e3a8a; margin-top: 0; font-weight: 800;">1. جمع واستخدام البيانات</h4>
        <p>نحن نحترم خصوصيتك وخصوصية بيانات طلابك بأعلى المعايير. نجمع فقط البيانات الضرورية لتشغيل الخدمة بكفاءة (مثل: اسم المعلم، أرقام هواتف الطلاب وأولياء الأمور، وسجلات الحضور والدرجات).</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">2. سرية وأمان البيانات المشفرة</h4>
        <p>تُخزّن جميع البيانات في قواعد بيانات سحابية مشفرة ومؤمنة بأحدث بروتوكولات الحماية (RLS Encryption). نحن نلتزم التزاماً قاطعاً بعدم بيع أو تأجير أو مشاركة أي بيانات تخص طلابك أو أرقام هواتفهم مع أي طرف ثالث أو استخدامها لأي أغراض إعلانية.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">3. إشعارات الواتساب</h4>
        <p>يتم إرسال الرسائل بناءً على طلب وتوجيه المعلم أو السنتر لإخطار أولياء الأمور فقط بمواعيد الحصص وحالة الحضور والدرجات، مع الالتزام التام بسياسات الاستخدام العادل.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">4. حقوق المستخدم</h4>
        <p>يحق للمشترك في أي وقت طلب تصدير كامل بياناته أو حذف حسابه وبيانات طلابه بالكامل من خوادمنا بمجرد تقديم طلب للدعم الفني.</p>
      `;
    } else if (type === 'refund') {
      titleEl.innerText = 'سياسة الاسترجاع واسترداد الأموال (Refund & Cancellation Policy)';
      bodyEl.innerHTML = `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; color: #065f46; font-weight: 700;">
          ضمان استرداد الأموال بنسبة 100% وفقاً لأحكام الاسترجاع (Money-Back Guarantee)
        </div>
        <p>في سنترلي، رضاك التام ونجاح منظومتك هو أساس عملنا. لذلك نوفر سياسة استرجاع مرنة وعادلة تماماً:</p>
        
        <h4 style="color: #1e3a8a; font-weight: 800;">1. شروط ومهلة تقديم طلب استرداد قيمة الاشتراك</h4>
        <ul style="padding-right: 1.25rem; line-height: 1.9;">
          <li>يحق لأي مشترك جديد في باقات المنصة تقديم طلب استرداد كامل قيمة الاشتراك خلال <b>14 يوماً</b> من تاريخ الدفع الأول، في حال عدم رضاه عن الخدمة أو وجود أي عائق تقني لم نتمكن من حله.</li>
          <li><b>مدة معالجة وتحويل المبلغ المسترد:</b> نظراً للدورات المصرفية المعتمدة لدى البنوك وشبكات الدفع الإلكتروني والمحافظ في جمهورية مصر العربية، فإن تنفيذ وتحويل المبلغ المسترد إلى حساب العميل البنكي أو محفظته الإلكترونية <b>يستغرق من 14 إلى 30 يوم عمل</b> لتأكيد التسوية المصرفية.</li>
        </ul>

        <h4 style="color: #1e3a8a; font-weight: 800;">2. إلغاء الاشتراك الشهري</h4>
        <p>يمكنك إلغاء تجديد اشتراكك في أي وقت من لوحة التحكم أو بالتواصل مع الدعم الفني، وسيظل حسابك نشطاً حتى نهاية الفترة المدفوعة بالفعل دون أي رسوم أو غرامات إلغاء إضافية.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">3. طلبات كروت الطلاب المطبوعة</h4>
        <p>المبالغ المدفوعة لطباعة كروت الطلاب البلاستيكية (PVC) التي تم تنفيذها وطباعتها وشحنها بالفعل للمدرس لا تخضع لسياسة الاسترجاع نظراً لتخصيصها وطباعة بيانات المدرس عليها.</p>
      `;
    } else if (type === 'contact') {
      titleEl.innerText = 'بيانات التواصل الرسمية والدعم الفني المباشر';
      bodyEl.innerHTML = `
        <h4 style="color: #1e3a8a; margin-top: 0; font-weight: 800;">بيانات التواصل المعتمدة لدى سنترلي:</h4>
        <p>يسعدنا تقديم الدعم الفني والإجابة على أي استفسارات للمعلمين وأصحاب السناتر في مصر:</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; line-height: 2.3; margin-top: 1rem;">
          <b>• الاسم التجاري الرسمي:</b> سنترلي للحلول التعليمية والبرمجيات (Centrly SaaS)<br>
          <b>• المقر والعنوان:</b> جمهورية مصر العربية — القاهرة<br>
          <b>• البريد الإلكتروني الرسمي:</b> <a href="mailto:mohanedabdulhalim@gmail.com" style="color: #2563eb; font-weight: 700; text-decoration: none;">mohanedabdulhalim@gmail.com</a><br>
          <b>• الهاتف والواتساب المباشر:</b> <a href="https://wa.me/201123671177?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%85%D9%86%D8%B5%D8%A9%20%D8%B3%D9%86%D8%AA%D8%B1%D9%84%D9%8A%20%D9%84%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AD%D8%B5%D8%B5%20%D9%88%D8%A7%D9%84%D8%B7%D9%84%D8%A7%D8%A8" target="_blank" rel="noopener noreferrer" dir="ltr" style="font-weight: 800; color: #16a34a; text-decoration: none;">01123671177 (+20 112 367 1177)</a><br>
          <b>• أوقات خدمة العملاء:</b> يومياً من 9:00 صباحاً حتى 10:00 مساءً بتوقيت القاهرة<br>
          <b>• العملة الرسمية لجميع المعاملات:</b> الجنيه المصري (EGP - ج.م)
        </div>

        <div style="margin-top: 1.5rem; text-align: center;">
          <a href="https://wa.me/201123671177?text=%D9%85%D8%B1%D8%AD%D8%A8%D8%A7%D9%8B%D8%8C%20%D8%A3%D9%88%D8%AF%20%D8%A7%D9%84%D8%A7%D8%B3%D8%AA%D9%81%D8%B3%D8%A7%D8%B1%20%D8%B9%D9%86%20%D9%85%D9%86%D8%B5%D8%A9%20%D8%B3%D9%86%D8%AA%D8%B1%D9%84%D9%8A%20%D9%84%D8%A5%D8%AF%D8%A7%D8%B1%D8%A9%20%D8%A7%D9%84%D8%AD%D8%B5%D8%B5%20%D9%88%D8%A7%D9%84%D8%B7%D9%84%D8%A7%D8%A8" 
             target="_blank" 
             rel="noopener noreferrer" 
             style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; width: 100%; background: #16a34a; color: #ffffff; text-decoration: none; font-family: 'Cairo', sans-serif; font-size: 1rem; font-weight: 800; padding: 0.85rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 14px rgba(22, 163, 74, 0.3); transition: all 0.2s;"
             onmouseover="this.style.backgroundColor='#15803d'; this.style.transform='translateY(-1px)';"
             onmouseout="this.style.backgroundColor='#16a34a'; this.style.transform='none';">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"/></svg>
            <span>محادثة مباشرة عبر واتساب الآن</span>
          </a>
        </div>
      `;
    }

    overlay.style.display = 'flex';
  }

  closePolicyModal() {
    const overlay = document.getElementById('policyModalOverlay');
    if (overlay) overlay.style.display = 'none';
  }

  toggleFaq(index) {
    const item = document.getElementById(`faqItem${index}`);
    const answer = document.getElementById(`faqAnswer${index}`);
    const icon = document.getElementById(`faqIcon${index}`);
    if (!item || !answer || !icon) return;

    const isOpen = answer.style.display === 'block';

    // Reset all FAQs
    for (let i = 1; i <= 6; i++) {
      const a = document.getElementById(`faqAnswer${i}`);
      const ic = document.getElementById(`faqIcon${i}`);
      const it = document.getElementById(`faqItem${i}`);
      if (a) a.style.display = 'none';
      if (ic) ic.style.transform = 'rotate(0deg)';
      if (it) it.style.borderColor = 'var(--brand-line, #E5E9F2)';
    }

    if (!isOpen) {
      answer.style.display = 'block';
      icon.style.transform = 'rotate(180deg)';
      item.style.borderColor = 'var(--brand-blue, #2949BA)';
    }
  }

  acceptCookies() {
    try {
      localStorage.setItem('centrly_cookie_consent', 'accepted');
    } catch (e) {}
    const banner = document.getElementById('centrlyCookieConsent');
    if (banner) banner.style.display = 'none';
  }

  initCookieConsent() {
    try {
      const consent = localStorage.getItem('centrly_cookie_consent');
      if (!consent) {
        const banner = document.getElementById('centrlyCookieConsent');
        if (banner) banner.style.display = 'flex';
      }
    } catch (e) {}
  }

  // DEV-34: No-App Parent Portal
  async loadParentPortal(token) {
    this._parentPortalToken = token;
    try {
      const data = await request(`/public/parent-portal?token=${token}`);
      document.getElementById('app').innerHTML = renderParentPortalView(data);
    } catch (err) {
      document.getElementById('app').innerHTML = renderParentPortalView({
        error: err.message || 'تعذر تحميل بيانات بوابة ولي الأمر. يرجى التحقق من صحة الرابط.',
      });
    }
  }

  async reloadParentPortal() {
    if (this._parentPortalToken) {
      await this.loadParentPortal(this._parentPortalToken);
      this.showToast('تم تحديث بيانات المتابعة بنجاح!', 'success');
    } else {
      window.location.reload();
    }
  }

  async loadStudentPortal(token) {
    this._studentPortalToken = token;
    try {
      if (token && typeof sessionStorage !== 'undefined') {
        sessionStorage.setItem('centrly_student_portal_token', token);
      }
    } catch (_) {}
    try {
      const data = await request(`/public/parent-portal?token=${token}`);
      document.getElementById('app').innerHTML = renderStudentPortalView(data);
    } catch (err) {
      document.getElementById('app').innerHTML = renderStudentPortalView({
        error: err.message || 'تعذر تحميل بيانات بوابة الطالب. يرجى التحقق من صحة الرابط.',
      });
    }
  }

  async reloadStudentPortal() {
    if (this._studentPortalToken) {
      await this.loadStudentPortal(this._studentPortalToken);
      this.showToast('تم تحديث بيانات الطالب بنجاح!', 'success');
    } else {
      window.location.reload();
    }
  }

  // DEV-PORTAL: Unified Student & Parent Portal Login & Session Handlers
  renderPortalLogin(errorMessage = '') {
    this.currentRoute = 'portal';
    const appEl = document.getElementById('app');
    if (appEl) {
      appEl.innerHTML = renderUnifiedPortalLoginView(errorMessage);
    }
    if (window.history?.replaceState && window.location.pathname !== '/portal') {
      window.history.replaceState(null, '', '/portal');
    }
  }

  togglePortalPasswordVisibility(btn, event) {
    this.togglePasswordVisibility('portalPassword', btn, event);
  }

  async handlePortalLogin(event) {
    if (event && event.preventDefault) event.preventDefault();
    const identInput = document.getElementById('portalIdentifier');
    const passInput = document.getElementById('portalPassword');
    const rememberCheckbox = document.getElementById('portalRememberMe');
    const submitBtn = document.getElementById('portalSubmitBtn');
    const spinner = document.getElementById('portalSubmitSpinner');
    const alertEl = document.getElementById('portalLoginAlert');

    const identifier = identInput ? identInput.value.trim() : '';
    const password = passInput ? passInput.value.trim() : '';
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

    try {
      const res = await request('/public/portal/login', {
        method: 'POST',
        body: { identifier, password },
      });

      if (res && res.success && res.token) {
        if (rememberMe) {
          try {
            localStorage.setItem('centrly_portal_token', res.token);
            localStorage.setItem('centrly_portal_role', res.role || 'parent');
          } catch (_) {}
        } else {
          try {
            sessionStorage.setItem('centrly_portal_token', res.token);
            sessionStorage.setItem('centrly_portal_role', res.role || 'parent');
          } catch (_) {}
        }

        this.showToast('مرحباً بك! تم تسجيل الدخول بنجاح', 'success');

        if (res.role === 'student') {
          await this.loadStudentPortal(res.token);
        } else {
          await this.loadParentPortal(res.token);
        }
      } else {
        throw new Error(res?.error?.message || 'تعذر تسجيل الدخول. يرجى التأكد من البيانات.');
      }
    } catch (err) {
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

  handlePortalLogout() {
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

  downloadStudentCardPng(student) {
    downloadStudentCardAsPng(student);
  }

  openFullscreenBarcode(student) {
    openFullscreenBarcodeModal(student);
  }

  async compressImageFile(file, maxWidth = 1600, quality = 0.78) {
    return new Promise((resolve) => {
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
            const compressed = canvas.toDataURL('image/jpeg', quality);
            const estimatedBytes = Math.round((compressed.length * 3) / 4);
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

  async handleStudentHomeworkUpload(materialId, file) {
    if (!file) return;

    const isPdf = (file.type && file.type.includes('pdf')) || (file.name && file.name.toLowerCase().endsWith('.pdf'));
    const isImage = (file.type && file.type.startsWith('image/')) || (file.name && /\.(jpg|jpeg|png|webp|heic|bmp)$/i.test(file.name));

    if (!isPdf && !isImage) {
      this.showToast('يرجى رفع ملف الواجب بصيغة PDF أو صورة واضحة (JPG / PNG / WEBP).', 'warning');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      this.showToast('حجم الملف يتجاوز الحد الأقصى المسموح به (25 ميجابايت). يرجى ضغط الملف أو تقليل دقة الصور.', 'warning');
      return;
    }

    const token = this._studentPortalToken
      || new URLSearchParams(window.location.search).get('token')
      || (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('centrly_student_portal_token') : null)
      || '';

    if (!token) {
      this.showToast('تعذر التحقق من رمز الطالب. يرجى إعادة فتح رابط الطالب من جديد والمحاولة مرة أخرى.', 'danger');
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
        if (btn) btn.innerHTML = '<span>جارٍ ضغط وتحسين الصورة للرفع الفوري...</span>';
        const compressed = await this.compressImageFile(file, 1600, 0.78);
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

      if (btn) btn.innerHTML = '<span>جارٍ حفظ الواجب في السحابة...</span>';

      await request('/public/homework/submit', {
        method: 'POST',
        body: {
          token,
          material_id: materialId,
          file_data: uploadBase64,
          file_name: uploadFileName,
          file_size: uploadFileSize,
        },
      });

      this.showToast('تم رفع حل الواجب بنجاح وإرساله لمعلمك للمراجعة.', 'success');
      await this.loadStudentPortal(token);
    } catch (subErr) {
      console.error('Homework upload error:', subErr);
      this.showToast(`فشل رفع الواجب: ${subErr.message || 'حدث خطأ في الاتصال'}`, 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalText;
      }
    }
  }

  renderAuth(tab = 'login') {
    window.scrollTo(0, 0);
    document.title = tab === 'signup' ? 'إنشاء حساب جديد | سنترلي' : 'تسجيل الدخول | سنترلي';
    document.getElementById('app').innerHTML = renderAuthScreens();
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

  switchAuthTab(tab) {
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

  showAuthAlert(msg, type = 'danger') {
    const alertBox = document.getElementById('authAlert');
    if (!alertBox) return;
    alertBox.textContent = msg;
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

  togglePasswordVisibility(inputId, btn) {
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    input.type = isPassword ? 'text' : 'password';
    if (btn) {
      btn.innerHTML = getIcon(isPassword ? 'eyeOff' : 'eye', 18);
    }
  }

  validatePasswordLive(pwd) {
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

  onAccountTypeChange(type) {
    const teacherGroup = document.getElementById('roleFieldsTeacher');
    const centerGroup = document.getElementById('roleFieldsCenter');
    if (type === 'center') {
      if (teacherGroup) teacherGroup.style.display = 'none';
      if (centerGroup) centerGroup.style.display = 'block';
    } else {
      if (teacherGroup) teacherGroup.style.display = 'block';
      if (centerGroup) centerGroup.style.display = 'none';
    }
  }

  openForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'flex';
    const alertBox = document.getElementById('forgotPasswordAlert');
    if (alertBox) alertBox.style.display = 'none';
  }

  closeForgotPasswordModal() {
    const modal = document.getElementById('forgotPasswordModal');
    if (modal) modal.style.display = 'none';
  }

  async handleForgotPassword(e) {
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

  openResetPasswordModal(token) {
    const modal = document.getElementById('resetPasswordModal');
    if (modal) {
      modal.style.display = 'flex';
      const tokenInput = document.getElementById('resetPasswordToken');
      if (tokenInput) tokenInput.value = token;
      const alertBox = document.getElementById('resetPasswordAlert');
      if (alertBox) alertBox.style.display = 'none';
    }
  }

  closeResetPasswordModal() {
    const modal = document.getElementById('resetPasswordModal');
    if (modal) modal.style.display = 'none';
  }

  async handleResetPasswordSubmit(e) {
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

  async handleLogin(e) {
    e.preventDefault();
    const btn = e.target?.querySelector?.('button[type="submit"]');
    const origHtml = btn ? btn.innerHTML : '';
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<span style="display:inline-block;width:1rem;height:1rem;border:2px solid #fff;border-top-color:transparent;border-radius:50%;animation:spin 0.6s linear infinite;margin-left:0.5rem;vertical-align:middle;"></span> جارٍ تسجيل الدخول...';
    }

    const rawIdentifier = document.getElementById('loginEmail')?.value?.trim() || '';
    const password = document.getElementById('loginPassword')?.value?.trim() || '';

    try {
      const res = await authService.login(rawIdentifier, password);
      this.user = res.user;
      try {
        const meRes = await request('/auth/me');
        if (meRes?.user) {
          this.user = { ...res.user, ...meRes.user };
          authService.setUser(this.user);
        }
      } catch (_) {}

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

      const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
      const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
      this.currentRoute = isAdmin ? 'admin-dashboard' : (isCenter ? 'center-dashboard' : 'dashboard');
      try {
        localStorage.setItem('centrly_current_route', this.currentRoute);
      } catch (_) {}
      this.renderApp();
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (err.code === 'EMAIL_NOT_VERIFIED' || err.message?.includes('EMAIL_NOT_VERIFIED') || err.message?.includes('تأكيد بريدك')) {
        const unverifiedEmail = err.email || rawIdentifier;
        this.renderEmailVerificationView(unverifiedEmail, password, 'يرجى تأكيد بريدك الإلكتروني أولاً للمتابعة. تم إرسال رمز التحقق إلى بريدك.');
        return;
      }
      this.showAuthAlert(err.message || 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  async handleSignup(e) {
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
    const phone = document.getElementById('signupPhone')?.value?.trim() || '';
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

    try {
      const res = await authService.signup({
        email,
        password,
        full_name: name,
        tenant_name: tenantName,
        phone,
        account_type: accountType,
      });

      if (res.requires_verification) {
        this.renderEmailVerificationView(email, password, 'تم إنشاء الحساب بنجاح! تم إرسال رمز التحقق إلى بريدك الإلكتروني.');
        return;
      }

      this.user = {
        ...(res.user || {}),
        full_name: name || res.user?.full_name,
        name: name || res.user?.name,
      };
      authService.setUser(this.user);
      this.startOnboarding();
    } catch (err) {
      this.showAuthAlert(err.message || 'فشل إنشاء الحساب. يرجى التأكد من البيانات والمحاولة مجدداً.');
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = origHtml;
      }
    }
  }

  renderEmailVerificationView(email, password = '', note = '') {
    window.scrollTo(0, 0);
    document.title = 'تأكيد البريد الإلكتروني | سنترلي';
    this.pendingVerification = { email, password };
    document.getElementById('app').innerHTML = renderEmailVerificationScreen({ email, note });
  }

  showVerificationAlert(message, type = 'error') {
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

  async handleVerifyEmailSubmit(e) {
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
        this.user = res.user;
        try {
          const meRes = await request('/auth/me');
          if (meRes?.user) {
            this.user = { ...res.user, ...meRes.user };
            authService.setUser(this.user);
          }
        } catch (_) {}
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

  async handleResendOtp() {
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
      this.showVerificationAlert(res.message || 'تم إرسال رمز جديد إلى بريدك بنجاح.', 'success');

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

  // ==========================================================================
  // Onboarding Wizard Flow (DEV-15 & DEV-38)
  // ==========================================================================
  startOnboarding() {
    this.onboardingStep = 1;
    document.getElementById('app').innerHTML = renderOnboardingWizard(this.onboardingStep, this.onboardingState);
  }

  nextOnboardingStep(step) {
    // Save state from step 1
    if (this.onboardingStep === 1) {
      const gName = document.getElementById('obGroupName')?.value?.trim();
      const gPrice = document.getElementById('obSessionPrice')?.value;
      if (gName) this.onboardingState.groupName = gName;
      if (gPrice !== undefined && gPrice !== '') this.onboardingState.sessionPrice = Number(gPrice);
    }

    // Save state from step 2
    if (this.onboardingStep === 2) {
      this.captureOnboardingStep2Students();
    }

    this.onboardingStep = step;
    document.getElementById('app').innerHTML = renderOnboardingWizard(this.onboardingStep, this.onboardingState);

    if (step === 4) {
      this.initOnboardingStep4();
    } else {
      this.stopWhatsAppStatusPolling();
    }
  }

  submitOnboardingStep1() {
    const gName = document.getElementById('obGroupName')?.value?.trim();
    const gPrice = document.getElementById('obSessionPrice')?.value;
    if (gName) this.onboardingState.groupName = gName;
    if (gPrice !== undefined && gPrice !== '') this.onboardingState.sessionPrice = Number(gPrice);
    this.nextOnboardingStep(2);
  }

  skipOnboardingStep(step) {
    if (step === 1) {
      this.nextOnboardingStep(2);
    } else if (step === 2) {
      this.nextOnboardingStep(3);
    } else if (step === 3) {
      this.nextOnboardingStep(4);
    } else if (step === 4) {
      this.finishOnboarding();
    }
  }

  skipAllOnboarding() {
    this.finishOnboarding();
  }

  captureOnboardingStep2Students() {
    const rows = Array.from(document.querySelectorAll('#quickStudentsList .student-row'));
    const students = [];
    rows.forEach(row => {
      const name = row.querySelector('.ob-student-name')?.value?.trim() || '';
      const studentPhone = row.querySelector('.ob-student-phone')?.value?.trim() || '';
      const parentPhone = row.querySelector('.ob-parent-phone')?.value?.trim() || '';
      if (name || studentPhone || parentPhone) {
        students.push({
          name,
          studentPhone,
          parentPhone,
          phone: studentPhone || parentPhone,
        });
      }
    });
    if (students.length > 0) {
      this.onboardingState.students = students;
    }
  }

  submitOnboardingStep2() {
    this.captureOnboardingStep2Students();
    this.nextOnboardingStep(3);
  }

  addQuickStudentRow() {
    const list = document.getElementById('quickStudentsList');
    if (!list) return;
    const count = list.querySelectorAll('.student-row').length + 1;
    const div = document.createElement('div');
    div.className = 'student-row onboarding-student-grid';
    div.innerHTML = `
      <span style="font-size: 0.8rem; font-weight: 700; color: var(--centrly-text); text-align: center;">${count}.</span>
      <input type="text" class="form-input ob-student-name" placeholder="اسم الطالب">
      <input type="tel" class="form-input ob-student-phone" placeholder="هاتف الطالب (010...)" dir="ltr">
      <input type="tel" class="form-input ob-parent-phone" placeholder="هاتف ولي الأمر (010...)" dir="ltr">
      <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.removeQuickStudentRow(this)" style="padding: 0.4rem; color: var(--centrly-danger); border: none; background: transparent; cursor: pointer;" title="حذف الصف">
        ${getIcon('delete', 14, 'var(--centrly-danger)')}
      </button>
    `;
    list.appendChild(div);
  }

  removeQuickStudentRow(buttonEl) {
    const row = buttonEl.closest('.student-row');
    if (!row) return;
    const list = document.getElementById('quickStudentsList');
    row.remove();
    if (list) {
      Array.from(list.querySelectorAll('.student-row')).forEach((r, idx) => {
        const numSpan = r.querySelector('span');
        if (numSpan) numSpan.textContent = `${idx + 1}.`;
      });
    }
  }

  async persistOnboardingGroupAndStudents() {
    if (this.onboardingState.persisted) return;

    const groupName = this.onboardingState.groupName?.trim();
    const sessionPrice = Number(this.onboardingState.sessionPrice) || 0;

    let createdGroupId = null;
    if (groupName) {
      try {
        const groupRes = await request('/groups', {
          method: 'POST',
          body: {
            name: groupName,
            price: sessionPrice,
            session_price: sessionPrice,
            billing_model: 'percentage',
          },
        });
        createdGroupId = groupRes?.group?.id || null;
      } catch (e) {
        console.warn('Onboarding group creation error:', e);
      }
    }

    const studentsToSave = (this.onboardingState.students || []).filter(s => s && s.name && s.name.trim());
    for (const st of studentsToSave) {
      const studentName = st.name.trim();
      const studentPhone = (st.studentPhone || '').trim() || null;
      const parentPhone = (st.parentPhone || '').trim() || studentPhone || '';
      try {
        const stRes = await request('/students', {
          method: 'POST',
          body: {
            name: studentName,
            student_phone: studentPhone,
            parent_phone: parentPhone,
          },
        });
        const stId = stRes?.student?.id;
        if (stId && createdGroupId) {
          await request(`/groups/${createdGroupId}/students`, {
            method: 'POST',
            body: { student_id: stId },
          }).catch(() => {});
        }
      } catch (err) {
        console.warn('Onboarding student creation error:', err);
      }
    }

    this.onboardingState.persisted = true;
  }

  async saveOnboardingDataAndGoToStep4() {
    const selectedHw = document.querySelector('input[name="obHomework"]:checked')?.value || 'in_session';
    const autoNotif = document.getElementById('obAutoNotification')?.checked ?? true;

    this.onboardingState.homeworkSubmission = selectedHw;
    this.onboardingState.autoNotification = autoNotif;

    try {
      await request('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          homework_submission: selectedHw,
          auto_notification: autoNotif,
          enable_top_performers: true,
        }),
      }).catch(() => {});

      this.persistOnboardingGroupAndStudents().catch(() => {});
      this.nextOnboardingStep(4);
    } catch (err) {
      this.nextOnboardingStep(4);
    }
  }

  async sendTestWhatsAppMessage() {
    const phone = document.getElementById('obTestPhone')?.value;
    const resultBox = document.getElementById('obTestMsgResult');
    if (!phone) {
      this.showToast('يرجى كتابة رقم الهاتف أولاً', 'info');
      return;
    }

    if (resultBox) {
      resultBox.style.display = 'block';
      resultBox.style.color = 'var(--centrly-blue-800)';
      resultBox.textContent = 'جاري إرسال الرسالة الاختبارية عبر الواتساب...';
    }

    try {
      await request('/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ phone, message: 'رسالة اختبارية من منصة سنترلي - الاتصال يعمل بنجاح!' }),
      });
      if (resultBox) {
        resultBox.style.color = 'var(--centrly-success)';
        resultBox.textContent = 'تم إرسال الرسالة بنجاح لهاتفك!';
      }
    } catch (err) {
      if (resultBox) {
        resultBox.style.color = 'var(--centrly-danger)';
        resultBox.textContent = `فشل إرسال الرسالة الاختبارية: ${err.message || 'خطأ في الاتصال بخدمة واتساب'}`;
      } else {
        this.showToast(`فشل إرسال الرسالة الاختبارية: ${err.message || 'خطأ في الاتصال بخدمة واتساب'}`, 'danger');
      }
    }
  }

  async finishOnboarding() {
    this.stopWhatsAppStatusPolling();
    if (!this.onboardingState.persisted) {
      this.persistOnboardingGroupAndStudents().catch(() => {});
    }
    this.renderApp();
    this.loadRouteData(this.currentRoute);
  }

  async logout() {
    this.stopWhatsAppStatusPolling();
    await authService.logout();
  }

  toggleSidebar(forceClose = false) {
    const sidebar = document.getElementById('appSidebar');
    let backdrop = document.getElementById('appSidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'appSidebarBackdrop';
      backdrop.style.cssText = 'display: none; position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(2px); z-index: 999;';
      backdrop.onclick = () => this.toggleSidebar(true);
      document.body.appendChild(backdrop);
    }
    if (forceClose || (sidebar && sidebar.classList.contains('open'))) {
      if (sidebar) sidebar.classList.remove('open');
      backdrop.style.display = 'none';
    } else if (sidebar) {
      sidebar.classList.add('open');
      backdrop.style.display = 'block';
    }
  }

  async navigate(route) {
    unlockAudio();
    this.stopWhatsAppStatusPolling();
    // Auto-lock sensitive pages automatically upon changing or switching pages
    if (this.hasSecurityPin && this.isFinancialUnlocked) {
      this.isFinancialUnlocked = false;
    }

    // Unify WhatsApp & Billing directly inside the master Settings Hub
    if (route === 'whatsapp') {
      this.settingsState = this.settingsState || {};
      this.settingsState.activeTab = 'whatsapp';
      route = 'settings';
    } else if (route === 'billing') {
      this.settingsState = this.settingsState || {};
      this.settingsState.activeTab = 'subscription';
      route = 'settings';
    }

    const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
    const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const adminRoutes = ['admin-dashboard', 'admin-proofs', 'admin-tenants', 'coupons', 'activity-logs'];
    if (isAdmin && !adminRoutes.includes(route)) {
      route = 'admin-dashboard';
    } else if (!isAdmin && adminRoutes.includes(route)) {
      route = isCenter ? 'center-dashboard' : 'dashboard';
    }

    this.currentRoute = route;
    try {
      localStorage.setItem('centrly_current_route', route);
    } catch (_) {}
    this.toggleSidebar(true);

    // Instant tactile touch feedback with top progress bar
    this.startProgressBar();

    // Check if we already have data for this route (instant render) or need skeleton loader
    const hasData = this.hasRouteData(route);
    this.routeLoadingState[route] = !hasData;

    // Fast render: if cached, renders in 0ms! If not, renders skeleton shimmer!
    this.renderApp();

    try {
      await this.loadRouteData(route);
    } finally {
      this.routeLoadingState[route] = false;
      this.finishProgressBar();
      this.renderMainContent();
    }
  }

  navigateTo(route) {
    return this.navigate(route);
  }

  async retryRoute(route) {
    if (this.routeErrors) this.routeErrors[route] = null;
    this.renderMainContent();
    await this.loadRouteData(route);
  }

  async loadRouteData(route) {
    if (this.routeErrors) this.routeErrors[route] = null;
    try {
      switch (route) {
        case 'admin-dashboard': {
          try {
            const [ovRes, proofsRes, tenantsRes] = await Promise.all([
              request('/admin/overview').catch(() => ({})),
              request('/admin/payment-proofs').catch(() => ({ payment_proofs: [] })),
              request('/admin/tenants').catch(() => ({ tenants: [] })),
            ]);
            const overview = ovRes.metrics || ovRes || {};
            const proofs = proofsRes.payment_proofs || [];
            const tenants = tenantsRes.tenants || [];
            const pendingCount = proofs.filter(p => p.status === 'pending').length;
            const activeCount = tenants.filter(t => t.subscription_status === 'active').length;
            const trialCount = tenants.filter(t => t.subscription_status === 'trial').length;
            const expiredCount = tenants.filter(t => ['expired', 'past_due', 'deactivated'].includes(t.subscription_status)).length;
            const mrrValue = activeCount > 0 ? (activeCount * 899) : (overview.mrr_egp || 0);
            this.adminOverviewData = {
              overview: {
                total_tenants: tenants.length || overview.total_tenants || 0,
                active_tenants: activeCount || overview.active_tenants || 0,
                trial_tenants: trialCount || overview.trial_tenants || 0,
                mrr_egp: mrrValue,
                total_students: overview.total_students || 0,
                total_sessions: overview.total_sessions || 0,
                whatsapp: overview.whatsapp || { total_sent: 0, total_failed: 0, estimated_cost_egp: 0 },
              },
              subscription_breakdown: {
                active: activeCount,
                trial: trialCount,
                pending_verification: pendingCount,
                expired: expiredCount,
              },
              recent_signups: tenants.slice(0, 5),
              at_risk_tenants: tenants.filter(t => t.subscription_status === 'trial').slice(0, 5).map(t => ({
                tenant_name: t.name,
                details: `تنتهي التجربة في: ${t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('ar-EG') : 'قريباً'}`,
              })),
            };
            this.adminProofsData = proofsRes;
            this.adminTenantsData = tenantsRes;
            await this.loadCoupons();
          } catch (err) {
            console.warn('admin-dashboard load error', err);
            this.adminOverviewData = {};
          }
          this.renderMainContent();
          break;
        }
        case 'admin-proofs': {
          try {
            const res = await request('/admin/payment-proofs');
            this.adminProofsData = res || { payment_proofs: [] };
          } catch (err) {
            console.warn('admin-proofs load error', err);
            this.adminProofsData = { payment_proofs: [] };
          }
          this.renderMainContent();
          break;
        }
        case 'admin-tenants': {
          try {
            const res = await request('/admin/tenants');
            this.adminTenantsData = res || { tenants: [] };
          } catch (err) {
            console.warn('admin-tenants load error', err);
            this.adminTenantsData = { tenants: [] };
          }
          this.renderMainContent();
          break;
        }
        case 'coupons': {
          const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
          if (!isAdmin) {
            this.navigate((this.user?.role === 'center_owner' || this.user?.account_type === 'center') ? 'center-dashboard' : 'dashboard');
            return;
          }
          await this.loadCoupons();
          this.renderMainContent();
          break;
        }
        case 'calendar': {
          const [calRes, grpRes] = await Promise.all([
            request('/sessions/calendar?from=2026-09-01&to=2026-09-30').catch(() => ({ sessions: [] })),
            request('/groups').catch(() => ({ groups: [] })),
          ]);
          const rawSessions = Array.isArray(calRes) ? calRes : (calRes.sessions || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          
          const arabicDayNames = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
          const jsDayToDayName = {
            0: 'الأحد',
            1: 'الإثنين',
            2: 'الثلاثاء',
            3: 'الأربعاء',
            4: 'الخميس',
            5: 'الجمعة',
            6: 'السبت',
          };

          // 1. Recurring weekly classes for all teacher groups (pure schedule of class times)
          const recurringGroupSessions = (this.groups || []).map(g => {
            const day = g.day_of_week || (arabicDayNames.find(d => g.schedule && g.schedule.includes(d))) || 'السبت';
            let time = g.session_time || '04:00 م - 06:00 م';
            if (g.schedule && g.schedule.includes('•')) {
              time = g.schedule.split('•')[1].trim();
            }
            return {
              id: `rec-${g.id}`,
              group_id: g.id,
              group_name: g.name,
              center_name: g.center_name || g.centerName || 'سنتر تعليمي',
              day_name: day,
              time: time,
              date: 'موعد أسبوعي ثابت',
              is_recurring: true,
              status: 'recurring',
              price: g.price || 0,
            };
          });

          // 2. Extra sessions (حصص إضافية)
          const extraSessions = rawSessions
            .filter(s => s.is_extra)
            .map(s => {
              const rawGrp = s.groups;
              const groupObj = Array.isArray(rawGrp) ? rawGrp[0] : (rawGrp || {});
              const grp = this.groups.find(g => g.id === s.group_id) || groupObj;
              const d = s.session_date ? new Date(s.session_date + 'T00:00:00') : new Date();
              const dayName = jsDayToDayName[d.getDay()] || 'السبت';
              return {
                id: s.id,
                group_id: s.group_id,
                group_name: grp.name || s.group_name || 'حصة عامة',
                center_name: grp.center_name || s.center_name || 'سنتر تعليمي',
                day_name: dayName,
                time: s.session_time || s.time || '04:00 م - 06:00 م',
                date: s.session_date || s.date,
                is_extra: true,
                extra_topic: s.extra_topic || s.topic || '',
                status: 'extra',
              };
            });

          // 3. Rescheduled sessions (مواعيد بديلة / مؤجلة)
          const rescheduledSessions = rawSessions
            .filter(s => s.status === 'rescheduled' || s.rescheduled_to_date)
            .map(s => {
              const rawGrp = s.groups;
              const groupObj = Array.isArray(rawGrp) ? rawGrp[0] : (rawGrp || {});
              const grp = this.groups.find(g => g.id === s.group_id) || groupObj;
              const targetDate = s.rescheduled_to_date || s.session_date;
              const d = targetDate ? new Date(targetDate + 'T00:00:00') : new Date();
              const dayName = jsDayToDayName[d.getDay()] || 'السبت';
              return {
                id: s.id,
                group_id: s.group_id,
                group_name: grp.name || s.group_name || 'حصة عامة',
                center_name: grp.center_name || s.center_name || 'سنتر تعليمي',
                day_name: dayName,
                time: s.rescheduled_to_time || s.session_time || s.time || '04:00 م - 06:00 م',
                date: targetDate,
                rescheduled_to_date: s.rescheduled_to_date,
                rescheduled_to_time: s.rescheduled_to_time,
                cancellation_reason: s.cancellation_reason,
                status: 'rescheduled',
              };
            });

          this.calendarSessions = [...recurringGroupSessions, ...extraSessions, ...rescheduledSessions];
          this.calendarState.sessions = this.calendarSessions;
          this.calendarState.groups = this.groups;
          this.renderMainContent();
          break;
        }
        case 'center-dashboard': {
          const period = this.centerDashboardState.period || new Date().toISOString().slice(0, 7);
          const [rollupRes, roomsRes, teachersRes] = await Promise.all([
            request(`/centers/financials/rollup?period=${period}`).catch(() => null),
            request('/centers/rooms').catch(() => []),
            request('/centers/teachers').catch(() => []),
          ]);
          if (rollupRes) this.centerDashboardState.rollup = rollupRes;
          if (roomsRes) this.centerDashboardState.rooms = Array.isArray(roomsRes) ? roomsRes : (roomsRes.rooms || []);
          if (teachersRes) this.centerTeachers = Array.isArray(teachersRes) ? teachersRes : (teachersRes.teachers || []);
          this.renderMainContent();
          break;
        }
        case 'center-sessions': {
          const [activeRes, grpRes, roomsRes, teachersRes] = await Promise.all([
            request('/sessions?status=in_progress').catch(() => []),
            request('/groups').catch(() => []),
            request('/centers/rooms').catch(() => []),
            request('/centers/teachers').catch(() => []),
          ]);
          const activeList = Array.isArray(activeRes) ? activeRes : (activeRes?.sessions || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes?.groups || []);
          this.centerRooms = Array.isArray(roomsRes) ? roomsRes : (roomsRes?.rooms || []);
          this.centerTeachers = Array.isArray(teachersRes) ? teachersRes : (teachersRes?.teachers || []);

          this.centerSessionsState.activeSessions = activeList.map(s => {
            const grp = this.groups.find(g => g.id === s.group_id);
            const teacher = this.centerTeachers.find(t => t.id === (s.teacher_id || grp?.teacher_id));
            const room = this.centerRooms.find(r => r.id === (s.room_id || grp?.room_id));
            return {
              ...s,
              group_name: grp?.name || s.group_name || 'حصة عامة',
              subject: grp?.subject || s.subject || 'عامة',
              teacher_name: teacher?.name || s.teacher_name || 'مدرس المادة',
              room_name: room?.name || s.room_name || 'القاعة الرئيسية',
            };
          });

          this.centerSessionsState.upcomingSessions = this.groups.map(g => {
            const teacher = this.centerTeachers.find(t => t.id === g.teacher_id);
            const room = this.centerRooms.find(r => r.id === g.room_id);
            return {
              ...g,
              teacher_name: teacher?.name || 'مدرس المادة',
              room_name: room?.name || 'القاعة الرئيسية',
            };
          });

          this.renderMainContent();
          break;
        }
        case 'center-teachers': {
          const [teachersRes, grpRes] = await Promise.all([
            request('/centers/teachers').catch(() => []),
            request('/groups').catch(() => []),
          ]);
          this.centerTeachers = Array.isArray(teachersRes) ? teachersRes : (teachersRes?.teachers || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes?.groups || []);
          this.renderMainContent();
          break;
        }
        case 'center-assistants': {
          const [assistantsRes, teachersRes] = await Promise.all([
            request('/centers/assistants').catch(() => []),
            request('/centers/teachers').catch(() => []),
          ]);
          this.centerAssistants = Array.isArray(assistantsRes) ? assistantsRes : (assistantsRes?.assistants || []);
          this.centerTeachers = Array.isArray(teachersRes) ? teachersRes : (teachersRes?.teachers || []);
          this.renderMainContent();
          break;
        }
        case 'center-rooms': {
          const roomsRes = await request('/centers/rooms').catch(() => []);
          this.centerRooms = Array.isArray(roomsRes) ? roomsRes : (roomsRes?.rooms || []);
          this.renderMainContent();
          break;
        }
        case 'quizzes': {
          const [grpRes, studRes] = await Promise.all([
            request('/groups').catch(() => []),
            request('/students').catch(() => []),
          ]);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes?.groups || []);
          this.students = Array.isArray(studRes) ? studRes : (studRes?.students || []);
          if (!this.quizzesState.selectedGroupId && this.groups.length > 0) {
            this.quizzesState.selectedGroupId = this.groups[0].id;
          }
          if (this.quizzesState.selectedGroupId) {
            try {
              const groupRes = await request(`/groups/${this.quizzesState.selectedGroupId}`).catch(() => null);
              if (groupRes?.students && Array.isArray(groupRes.students)) {
                groupRes.students.forEach(st => {
                  st.group_id = this.quizzesState.selectedGroupId;
                  const exists = this.students.find(s => s.id === st.id);
                  if (exists) {
                    exists.group_id = this.quizzesState.selectedGroupId;
                    if (!exists.group_ids) exists.group_ids = [];
                    if (!exists.group_ids.includes(this.quizzesState.selectedGroupId)) {
                      exists.group_ids.push(this.quizzesState.selectedGroupId);
                    }
                  } else {
                    this.students.push(st);
                  }
                });
              }
            } catch (_) {}
          }
          if (this.quizzesState.selectedGroupId) {
            await this.loadQuizzesForGroup(this.quizzesState.selectedGroupId);
          }
          this.renderMainContent();
          break;
        }
        case 'students': {
          this.studentsLoading = true;
          if (!this.students || this.students.length === 0) {
            this.renderMainContent();
          }
          try {
            const [studRes, grpRes, billingRes] = await Promise.all([
              request('/students'),
              request('/groups'),
              (!this.billingState || !this.billingState.students_limit) ? request('/billing/status').catch(() => null) : Promise.resolve(this.billingState),
            ]);
            this.students = Array.isArray(studRes) ? studRes : (studRes.students || []);
            this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
            if (billingRes) this.billingState = billingRes;
            this.saveCache('students', this.students);
            this.saveCache('groups', this.groups);
            if (billingRes) this.saveCache('billingState', this.billingState);
          } finally {
            this.studentsLoading = false;
            this.renderMainContent();
          }
          break;
        }
        case 'reports': {
          const month = this.reportsState.period.month;
          const year = this.reportsState.period.year;
          const groupId = this.reportsState.selectedGroupId;
          let url = `/reports/monthly?month=${month}&year=${year}`;
          if (groupId) url += `&group_id=${groupId}`;
          if (this.reportsState.searchQuery) url += `&q=${encodeURIComponent(this.reportsState.searchQuery)}`;

          const [reportsRes, grpRes, astRes, studRes] = await Promise.all([
            request(url).catch(() => null),
            request('/groups').catch(() => ({ groups: [] })),
            request('/assistants').catch(() => ({ assistants: [] })),
            request('/students').catch(() => ({ students: [] })),
          ]);

          if (reportsRes) {
            this.reportsState.leaderboard = reportsRes.leaderboard || [];
            this.reportsState.total_students = reportsRes.total_students || 0;
            this.reportsState.average_attendance_rate = reportsRes.average_attendance_rate || 0;
            this.reportsState.average_score = reportsRes.average_score || 0;
          }
          this.reportsState.groups = Array.isArray(grpRes) ? grpRes : (grpRes?.groups || []);
          this.reportsState.assistants = Array.isArray(astRes) ? astRes : (astRes?.assistants || []);
          this.reportsState.students = Array.isArray(studRes) ? studRes : (studRes?.students || []);
          this.teacherAssistants = this.reportsState.assistants;
          this.saveCache('teacherAssistants', this.teacherAssistants);
          this.renderMainContent();
          break;
        }
        case 'groups': {
          const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
          const promises = [
            request('/groups').catch(() => []),
            (!this.students || this.students.length === 0) ? request('/students').catch(() => []) : Promise.resolve(this.students),
          ];
          if (isCenterOwner) {
            promises.push(request('/centers/teachers').catch(() => ({ teachers: [] })));
            promises.push(request('/centers/rooms').catch(() => ({ rooms: [] })));
          }

          const [grpRes, studRes, teachersRes, roomsRes] = await Promise.all(promises);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          if (studRes) {
            const fetchedStudents = Array.isArray(studRes) ? studRes : (studRes.students || []);
            if (fetchedStudents.length > 0) {
              this.students = fetchedStudents;
              this.saveCache('students', this.students);
            }
          }

          if (isCenterOwner) {
            this.centerTeachers = teachersRes?.teachers || (Array.isArray(teachersRes) ? teachersRes : []);
            this.centerRooms = roomsRes?.rooms || (Array.isArray(roomsRes) ? roomsRes : []);
          }

          this.groups = this.groups.map(g => {
            const matchedTeacher = isCenterOwner ? this.centerTeachers.find(t => t.id === g.teacher_id) : null;
            const matchedRoom = isCenterOwner ? this.centerRooms.find(r => r.id === g.room_id) : null;
            const enrolled = (this.students || []).filter(s => s.group_id === g.id || (Array.isArray(s.group_ids) && s.group_ids.includes(g.id)));
            const count = enrolled.length || g.students_count || g.studentCount || 0;
            return {
              ...g,
              teacher_name: matchedTeacher ? matchedTeacher.name : g.teacher_name,
              room_name: matchedRoom ? matchedRoom.name : g.room_name,
              students_count: count,
              studentCount: count,
            };
          });
          this.saveCache('groups', this.groups);
          this.renderMainContent();
          break;
        }
        case 'dashboard': {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();
          const [studRes, grpRes, riskRes, repRes, astRes] = await Promise.all([
            request('/students').catch(() => ({ students: [] })),
            request('/groups').catch(() => ({ groups: [] })),
            request('/at-risk').catch(() => ({ watchlist: [] })),
            request(`/reports/monthly?month=${currentMonth}&year=${currentYear}`).catch(() => null),
            request('/assistants').catch(() => ({ assistants: [] })),
          ]);
          const students = Array.isArray(studRes) ? studRes : (studRes.students || []);
          const groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          const atRisk = Array.isArray(riskRes) ? riskRes : (riskRes?.watchlist || riskRes?.students || []);
          const assistants = Array.isArray(astRes) ? astRes : (astRes?.assistants || []);
          this.teacherAssistants = assistants;
          this.saveCache('teacherAssistants', assistants);

          let totalMonthlyRev = 0;
          let totalGrossTeacherProfit = 0;
          const mappedGroups = groups.map(g => {
            const enrolledCount = students.filter(s => s.group_id === g.id || (Array.isArray(s.group_ids) && s.group_ids.includes(g.id))).length;
            const count = enrolledCount || Number(g.students_count || g.student_count || 0);
            const price = Number(g.price ?? g.session_price ?? 0);
            const monthlyGross = price * count * 4;
            let netProfit = Math.round(monthlyGross * 0.8);

            if (g.billing_model === 'fixed_per_student') {
              const cut = Number(g.fixed_per_student_amount || 0);
              netProfit = Math.max(0, (price - cut) * count * 4);
            } else if (g.billing_model === 'fixed_rent') {
              const rent = Number(g.fixed_rent_amount || 0);
              netProfit = Math.max(0, monthlyGross - (rent * 4));
            } else if (g.center_cut_percentage !== undefined && g.center_cut_percentage !== null) {
              const pct = Number(g.center_cut_percentage);
              netProfit = Math.round(monthlyGross * ((100 - pct) / 100));
            }

            totalMonthlyRev += monthlyGross;
            totalGrossTeacherProfit += netProfit;

            return {
              ...g,
              student_count: count,
              students_count: count,
              monthly_rev: monthlyGross,
              net_profit: netProfit,
            };
          });

          // Assistant deductions calculation
          const activeAssistants = assistants.filter(a => a.status !== 'inactive');
          let totalAssistantSalaries = 0;
          activeAssistants.forEach(a => {
            const isPerSession = a.salary_model === 'per_session';
            const rate = Number(a.salary ?? a.salary_amount ?? 0);
            if (isPerSession) {
              const sessCount = a.group_id ? 4 : (groups.length > 0 ? groups.length * 4 : 4);
              totalAssistantSalaries += rate * sessCount;
            } else {
              totalAssistantSalaries += rate;
            }
          });

          const totalCenterCut = Math.max(0, totalMonthlyRev - totalGrossTeacherProfit);
          const finalTeacherNetProfit = Math.max(0, totalGrossTeacherProfit - totalAssistantSalaries);

          // Pure real data - zero arbitrary mock numbers or fake constants
          const attendanceRate = repRes && repRes.average_attendance_rate !== undefined
            ? `${repRes.average_attendance_rate}%`
            : '0%';
          const leaderboard = repRes?.leaderboard && Array.isArray(repRes.leaderboard)
            ? repRes.leaderboard.slice(0, 5)
            : [];

          this.dashboardData = {
            stats: {
              totalStudents: students.length,
              activeGroups: groups.length,
              todayAttendanceRate: attendanceRate,
              monthlyRevenue: totalMonthlyRev,
              centerCut: totalCenterCut,
              assistantSalaries: totalAssistantSalaries,
              teacherProfit: finalTeacherNetProfit,
              pendingMessages: 0,
            },
            groups: mappedGroups,
            assistants: assistants,
            atRiskStudents: atRisk,
            topPerformers: leaderboard,
          };
          this.saveCache('dashboardData', this.dashboardData);
          this.saveCache('students', students);
          this.saveCache('groups', groups);
          this.renderMainContent();
          break;
        }
        case 'risk-watchlist': {
          const [riskRes, studRes, grpRes] = await Promise.all([
            request('/at-risk/watchlist').catch(() => request('/at-risk')).catch(() => ({ watchlist: [] })),
            (!this.students || this.students.length === 0) ? request('/students').catch(() => []) : Promise.resolve(this.students),
            (!this.groups || this.groups.length === 0) ? request('/groups').catch(() => []) : Promise.resolve(this.groups),
          ]);
          this.students = Array.isArray(studRes) ? studRes : (studRes.students || this.students || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || this.groups || []);

          let rawWatchlist = riskRes?.watchlist || (Array.isArray(riskRes) ? riskRes : (riskRes?.students || []));
          this.watchlistData = rawWatchlist.map(s => {
            const sid = s.id || s.student_id;
            const matchedStudent = (this.students || []).find(st => st.id === sid);
            const matchedGroup = (this.groups || []).find(g => g.id === (s.group_id || matchedStudent?.group_id));
            const resolvedGroupName = s.group || s.group_name || matchedStudent?.group_name || matchedGroup?.name || 'مجموعة عامة';
            return {
              ...s,
              id: sid,
              name: s.name || s.student_name || matchedStudent?.name,
              code: s.code || s.student_code || matchedStudent?.code || matchedStudent?.student_code,
              group: resolvedGroupName,
              group_name: resolvedGroupName,
              alert_type: s.alert_type || s.primary_risk || 'absence_warning',
              severity: s.severity || 'medium',
              reason: s.reason || s.recommended_action || 'متابعة الأداء الأكاديمي والغياب',
            };
          });
          this.renderMainContent();
          break;
        }
        case 'billing': {
          const billingRes = await request('/billing/status');
          this.billingState = billingRes;
          this.saveCache('billingState', this.billingState);
          this.renderMainContent();
          break;
        }
        case 'settings': {
          try {
            const teacherParam = this.user?.teacher_id ? `?teacher_id=${encodeURIComponent(this.user.teacher_id)}` : '';
            const [billingRes, quotaRes, statusRes, tplRes] = await Promise.all([
              request('/billing/status').catch(() => null),
              request('/whatsapp/quota').catch(() => ({})),
              request(`/whatsapp/status${teacherParam}`).catch(() => ({ status: 'disconnected' })),
              request('/templates').catch(() => ({ templates: [] })),
            ]);
            if (billingRes) {
              this.billingState = billingRes;
              this.saveCache('billingState', this.billingState);
            }
            let qrRes = null;
            if (statusRes?.status !== 'connected') {
              try {
                qrRes = await request(`/whatsapp/qr${teacherParam}`).catch(() => null);
              } catch (err) {
                console.warn('Initial QR load failed:', err);
              }
            }
            this.whatsappState = {
              role: this.user?.role,
              quota: quotaRes || {},
              status: statusRes?.status || 'disconnected',
              phone_number: statusRes?.phone_number || '',
              qr_base64: qrRes?.qr_base64 || null,
              pairing_code: qrRes?.pairing_code || null,
              templates: tplRes?.templates || [],
            };
          } catch (_) {}
          this.renderMainContent();
          if (this.whatsappState?.status !== 'connected' && this.settingsState?.activeTab === 'whatsapp') {
            this.startWhatsAppStatusPolling('settings');
          }
          break;
        }
        case 'whatsapp': {
          const teacherParam = this.user?.teacher_id ? `?teacher_id=${encodeURIComponent(this.user.teacher_id)}` : '';
          const [quotaRes, statusRes, tplRes] = await Promise.all([
            request('/whatsapp/quota'),
            request(`/whatsapp/status${teacherParam}`),
            request('/templates'),
          ]);
          let qrRes = null;
          if (statusRes?.status !== 'connected') {
            try {
              qrRes = await request(`/whatsapp/qr${teacherParam}`);
            } catch (err) {
              console.warn('Initial QR load failed:', err);
            }
          }
          this.whatsappState = {
            role: this.user?.role,
            quota: quotaRes || {},
            status: statusRes?.status || 'disconnected',
            phone_number: statusRes?.phone_number || '',
            qr_base64: qrRes?.qr_base64 || null,
            pairing_code: qrRes?.pairing_code || null,
            templates: tplRes?.templates || [],
          };
          this.renderMainContent();
          if (this.whatsappState.status !== 'connected') {
            this.startWhatsAppStatusPolling('settings');
          }
          break;
        }
        case 'activity-logs': {
          const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
          if (isCenter) {
            const period = this.centerDashboardState.period || new Date().toISOString().slice(0, 7);
            const rollupRes = await request(`/centers/financials/rollup?period=${period}`).catch(() => null);
            if (rollupRes) this.centerDashboardState.rollup = rollupRes;
          } else {
            const logsRes = await request('/whatsapp/logs').catch(() => request('/activity-logs')).catch(() => []);
            this.messageLogs = Array.isArray(logsRes) ? logsRes : (logsRes?.logs || []);
          }
          this.renderMainContent();
          break;
        }
        case 'sessions': {
          const [grpRes, studRes] = await Promise.all([
            (!this.groups || this.groups.length === 0) ? request('/groups').catch(() => []) : Promise.resolve(this.groups),
            request('/students').catch(() => []),
          ]);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || this.groups || []);
          this.students = Array.isArray(studRes) ? studRes : (studRes.students || []);

          const todayStr = new Date().toISOString().split('T')[0];
          // If the active session has ended, or is stale (not in_progress) from an old date, clean it up
          if (this.sessionState?.id && this.sessionState.status !== 'in_progress' && (this.sessionState.session_date && this.sessionState.session_date !== todayStr)) {
            this.sessionState = {
              id: null,
              status: 'scheduled',
              group: null,
              attendanceList: [],
              financials: { totalRevenue: 0, attendeeCount: 0, absentCount: 0, exemptCount: 0, makeupCount: 0 },
            };
            localStorage.removeItem('centrly_active_session_state');
            localStorage.removeItem('centrly_active_session_id');
            this.stopLiveSessionSync();
          }

          // Cross-Device Real-Time Sync:
          // 1. If NO active session in local state, check server for in_progress session and auto-resume it!
          if (!this.sessionState?.id) {
            const todaySessions = await request('/sessions?status=in_progress').catch(() => []);
            const activeList = Array.isArray(todaySessions) ? todaySessions : (todaySessions?.sessions || []);
            this.ongoingServerSessions = activeList;
            if (activeList.length > 0) {
              await this.syncAndResumeServerSession(activeList[0].id);
            } else if (this.sessionState) {
              this.sessionState.ongoingServerSessions = [];
            }
          } else if (!String(this.sessionState.id).startsWith('sess-')) {
            // 2. If active session is loaded, pull latest server attendance and status
            await this.syncAndResumeServerSession(this.sessionState.id);
          }

          if (this.sessionState?.status === 'in_progress') {
            this.startLiveSessionSync();
          }

          this.renderMainContent();
          this.updateNavbarBadge();
          if (this.sessionState?.status === 'in_progress') {
            this.focusScanInput();
          }
          break;
        }
        case 'student-cards': {
          if (!this.students || this.students.length === 0) {
            const studentsRes = await request('/students').catch(() => []);
            this.students = Array.isArray(studentsRes) ? studentsRes : (studentsRes.students || []);
          }
          if (!this.groups || this.groups.length === 0) {
            const groupsRes = await request('/groups').catch(() => []);
            this.groups = Array.isArray(groupsRes) ? groupsRes : (groupsRes.groups || []);
          }
          this.renderMainContent();
          break;
        }
        case 'materials': {
          const [matRes, grpRes] = await Promise.all([
            request('/materials').catch(() => ({ materials: [] })),
            request('/groups').catch(() => ({ groups: [] })),
          ]);
          this.materials = Array.isArray(matRes) ? matRes : (matRes.materials || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          this.materialsGroupId = this.materialsGroupId || 'all';
          this.saveCache('materials', this.materials);
          this.saveCache('groups', this.groups);
          this.renderMainContent();
          break;
        }
        case 'homework': {
          const [matRes, grpRes] = await Promise.all([
            request('/materials').catch(() => ({ materials: [] })),
            request('/groups').catch(() => ({ groups: [] })),
          ]);
          const materialsList = Array.isArray(matRes) ? matRes : (matRes.materials || []);
          const hwAssignments = materialsList.filter(m => m.is_homework);
          const groupsList = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          
          let selectedMaterialId = this.homeworkState?.selectedMaterialId || (hwAssignments[0]?.id || '');
          let selectedGroupId = this.homeworkState?.selectedGroupId || 'all';
          let activeTab = this.homeworkState?.activeTab || 'submitted';
          let subTab = this.homeworkState?.subTab || 'pending';

          let submissionsData = { assignments: hwAssignments, submitted: [], missing: [] };
          if (selectedMaterialId) {
            try {
              let url = `/homework/submissions?material_id=${encodeURIComponent(selectedMaterialId)}`;
              if (selectedGroupId && selectedGroupId !== 'all') {
                url += `&group_id=${encodeURIComponent(selectedGroupId)}`;
              }
              submissionsData = await request(url).catch(() => ({ submitted: [], missing: [] }));
            } catch (err) {
              console.warn('Failed to load homework submissions:', err);
            }
          }

          const currentHw = hwAssignments.find(a => a.id === selectedMaterialId) || hwAssignments[0] || null;

          this.homeworkState = {
            assignments: hwAssignments,
            currentHomework: currentHw,
            groups: groupsList,
            selectedMaterialId,
            selectedGroupId,
            activeTab,
            subTab,
            submitted: submissionsData.submitted || [],
            missing: submissionsData.missing || [],
          };
          this.renderMainContent();
          break;
        }
        case 'assistants': {
          const [astRes, grpRes] = await Promise.all([
            request('/assistants').catch(() => ({ assistants: [] })),
            request('/groups').catch(() => ({ groups: [] })),
          ]);
          this.teacherAssistants = Array.isArray(astRes) ? astRes : (astRes.assistants || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          this.saveCache('teacherAssistants', this.teacherAssistants);
          this.saveCache('groups', this.groups);
          this.renderMainContent();
          break;
        }
      }
    } catch (err) {
      console.warn('loadRouteData error:', err);
      const isAuthErr = err.message && (
        err.message.includes('token') ||
        err.message.includes('UNAUTHORIZED') ||
        err.message.includes('401')
      );

      if (isAuthErr) {
        // Try refreshing token once and re-attempting route load
        const refreshed = await authService.tryRefreshSession();
        if (refreshed) {
          try {
            await this.loadRouteData(route);
            return;
          } catch (_) {}
        }
      }

      if (this.routeErrors) {
        this.routeErrors[route] = isAuthErr
          ? 'انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول لمتابعة العمل بأمان.'
          : (err.message || 'حدث خطأ أثناء تحميل البيانات من الخادم. يرجى التحقق من الاتصال والمحاولة مجدداً.');
      }
      this.renderMainContent();
    }
  }

  renderApp() {
    const html = `
      <div class="app-container">
        ${renderSidebar(this.currentRoute, this.user, { hasPin: this.hasSecurityPin, isUnlocked: this.isFinancialUnlocked })}
        <div class="app-main">
          ${renderNavbar(this.user, this.getActiveSessionSummary())}
          <main class="content-body" id="mainContent">
            ${this.getContentHtml(this.currentRoute)}
          </main>
        </div>
      </div>
    `;
    document.getElementById('app').innerHTML = html;
  }

  renderMainContent() {
    const el = document.getElementById('mainContent');
    if (el) el.innerHTML = this.getContentHtml(this.currentRoute);
  }

  getContentHtml(route) {
    if (this.routeErrors && this.routeErrors[route]) {
      const isAuthErr = this.routeErrors[route].includes('الجلسة') || this.routeErrors[route].includes('token');
      return `
        <div class="card" style="text-align: center; padding: 2.5rem; border-top: 4px solid var(--centrly-danger); margin: 1rem 0;" dir="rtl">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--centrly-danger); display: flex; justify-content: center;">
            ${getIcon('risk', 40)}
          </div>
          <h3 style="color: var(--centrly-danger); font-size: 1.2rem; font-weight: 800; margin: 0 0 0.5rem 0;">${isAuthErr ? 'انتهت صلاحية الجلسة' : 'تعذر تحميل بيانات هذه الصفحة'}</h3>
          <p style="color: var(--centrly-text); font-size: 0.9rem; margin: 0 0 1.25rem 0; line-height: 1.6;">
            ${this.routeErrors[route]}
          </p>
          ${isAuthErr ? `
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.renderAuth('login')" style="font-weight: 700; padding: 0.5rem 1.5rem;">
              <span>تسجيل الدخول مجدداً</span>
            </button>
          ` : `
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.retryRoute('${route}')" style="font-weight: 700;">
              ${getIcon('refresh', 14)} <span>إعادة المحاولة</span>
            </button>
          `}
        </div>
      `;
    }

    switch (route) {
      case 'admin-dashboard':
        return renderBusinessOwnerDashboard(this.adminOverviewData || {});
      case 'admin-proofs':
        return renderAdminPaymentProofsView(this.adminProofsData || {}, this.adminProofsFilter || 'pending');
      case 'admin-tenants':
        return renderAdminTenantsView(this.adminTenantsData || {}, this.adminTenantsFilter || 'all', this.adminTenantsSearchQuery || '');
      case 'coupons': {
        const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
        if (!isAdmin) {
          return (this.user?.role === 'center_owner' || this.user?.account_type === 'center')
            ? renderCenterOwnerDashboard(this.centerDashboardState)
            : renderTeacherDashboard(this.dashboardData || {}, this.user || {}, {
                hasPin: this.hasSecurityPin,
                isUnlocked: this.isFinancialUnlocked,
                hideNumbers: this.hideFinancialNumbers,
              });
        }
        return renderCouponsView(this.giftCodes || [], this.user || {});
      }
      case 'dashboard':
        return renderTeacherDashboard(this.dashboardData || {}, this.user || {}, {
          hasPin: this.hasSecurityPin,
          isUnlocked: this.isFinancialUnlocked,
          hideNumbers: this.hideFinancialNumbers,
        });
      case 'materials':
        return renderMaterialsView(this.materials, this.groups, this.materialsGroupId);
      case 'homework':
        return renderHomeworkReviewView(this.homeworkState || {});
      case 'assistants':
        return renderTeacherAssistantsView(this.teacherAssistants, this.groups, {
          hasPin: this.hasSecurityPin,
          isUnlocked: this.isFinancialUnlocked,
          hideNumbers: this.hideFinancialNumbers,
        });
      case 'center-dashboard':
        return renderCenterOwnerDashboard(this.centerDashboardState);
      case 'center-sessions':
        return renderCenterSessionsView(this.centerSessionsState, this.groups, this.centerRooms, this.centerTeachers);
      case 'center-teachers':
        return renderCenterTeachersView(this.centerTeachers, this.groups);
      case 'center-assistants':
        return renderCenterAssistantsView(this.centerAssistants, this.centerTeachers);
      case 'center-rooms':
        return renderCenterRoomsView(this.centerRooms);
      case 'quizzes':
        return renderTeacherQuizzesView(this.quizzesState, this.groups, this.students);
      case 'calendar':
        return renderTeacherCalendar(this.calendarState);
      case 'sessions':
        return renderSessionsView(this.sessionState, this.user, this.groups);
      case 'students':
        return renderStudentsView(this.students, this.groups, this.studentsLoading || Boolean(this.routeLoadingState['students']), this.billingState);
      case 'student-cards':
        return renderStudentCardsView(this.students, this.groups, this.user);
      case 'reports':
        return renderStudentReportsView(this.reportsState, {
          hasPin: this.hasSecurityPin,
          isUnlocked: this.isFinancialUnlocked,
          hideNumbers: this.hideFinancialNumbers,
        });
      case 'groups':
        return renderGroupsView(this.groups, this.user, Boolean(this.routeLoadingState['groups']));
      case 'risk-watchlist':
        return renderRiskWatchlistView(this.watchlistData || this.dashboardData?.atRiskStudents || []);
      case 'billing':
        return renderBillingView(this.billingState || {}, this.user || {});
      case 'settings':
        return renderTeacherSettingsView(this.settingsState, this.user, this.billingState || {}, this.whatsappState || {}, {
          hasPin: this.hasSecurityPin,
          isUnlocked: this.isFinancialUnlocked
        });
      case 'whatsapp':
        return renderWhatsAppSettingsView(this.whatsappState || {});
      case 'activity-logs': {
        const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
        if (isAdmin) {
          return renderMessageLogsView(this.messageLogs);
        }
        const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
        if (isCenter) {
          return renderCenterSettlementsView(this.centerDashboardState);
        }
        return renderMessageLogsView(this.messageLogs);
      }
      default: {
        const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
        if (isAdmin) {
          return renderBusinessOwnerDashboard(this.adminOverviewData || {});
        }
        const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
        if (isCenter) {
          return renderCenterOwnerDashboard(this.centerDashboardState);
        }
        return renderTeacherDashboard(this.dashboardData || {}, this.user || {}, {
          hasPin: this.hasSecurityPin,
          isUnlocked: this.isFinancialUnlocked,
          hideNumbers: this.hideFinancialNumbers,
        });
      }
    }
  }

  // ==========================================================================
  // Active Session & Smart Attendance Actions (DEV-16, DEV-13, DEV-36, Feedback)
  // ==========================================================================

  onStudentScanInput(val) {
    const suggestionsBox = document.getElementById('studentScanSuggestions');
    if (!suggestionsBox) return;

    const trimmed = (val || '').trim().toLowerCase();
    if (!trimmed || trimmed.length < 1) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
      return;
    }

    const matches = (this.students || []).filter(s => {
      const name = (s.name || '').toLowerCase();
      const code = (s.code || s.student_code || '').toLowerCase();
      const phone = (s.student_phone || s.parent_phone || '').toLowerCase();
      return name.includes(trimmed) || code.includes(trimmed) || phone.includes(trimmed);
    }).slice(0, 6);

    if (matches.length === 0) {
      suggestionsBox.style.display = 'block';
      suggestionsBox.innerHTML = `
        <div style="padding: 0.75rem 1rem; color: var(--centrly-text); font-size: 0.85rem; text-align: center;">
          لا يوجد طالب مطابق لهذا الاسم أو الكود
        </div>
      `;
      return;
    }

    suggestionsBox.style.display = 'block';
    suggestionsBox.innerHTML = matches.map(s => {
      const code = s.code || s.student_code || 'بدون كود';
      const safeName = escapeHtml(s.name || '');
      return `
        <div 
          style="padding: 0.6rem 1rem; border-bottom: 1px solid var(--centrly-line); cursor: pointer; display: flex; justify-content: space-between; align-items: center; transition: background 0.15s;"
          onmouseover="this.style.background='#f8fafc'"
          onmouseout="this.style.background='#fff'"
          onclick="window.centrlyApp.selectStudentFromSuggestion('${escapeHtml(s.id)}')"
        >
          <div>
            <div style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${safeName}</div>
            <div style="font-size: 0.75rem; color: var(--centrly-text);">${escapeHtml(s.student_phone || s.parent_phone || '')}</div>
          </div>
          <span class="badge badge-blue" style="font-family: monospace; font-weight: 700;">${escapeHtml(code)}</span>
        </div>
      `;
    }).join('');
  }

  selectStudentFromSuggestion(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    if (!student) return;

    const input = document.getElementById('scanStudentCode');
    if (input) input.value = student.code || student.student_code || student.name;

    const suggestionsBox = document.getElementById('studentScanSuggestions');
    if (suggestionsBox) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
    }

    this.registerStudentAttendance(student);
    this.focusScanInput();
  }

  focusScanInput() {
    // On touch devices / mobile viewports, avoid forcibly popping up the virtual keyboard
    const isMobile = window.innerWidth <= 768 && ('ontouchstart' in window || navigator.maxTouchPoints > 0);
    if (isMobile) return;

    const applyFocus = () => {
      const inp = document.getElementById('scanStudentCode');
      if (!inp) return;
      if (document.activeElement !== inp) {
        try {
          inp.focus({ preventScroll: true });
        } catch (_) {}
      }
      try {
        inp.select();
      } catch (_) {}
    };

    applyFocus();
    requestAnimationFrame(() => {
      applyFocus();
      requestAnimationFrame(applyFocus);
    });
    setTimeout(applyFocus, 25);
    setTimeout(applyFocus, 75);
    setTimeout(applyFocus, 150);
    setTimeout(applyFocus, 300);
  }

  handleStudentScan(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (e && e.stopPropagation) e.stopPropagation();
    const codeInput = document.getElementById('scanStudentCode');
    const query = codeInput?.value.trim();
    if (!query) {
      this.focusScanInput();
      return;
    }

    const suggestionsBox = document.getElementById('studentScanSuggestions');
    if (suggestionsBox) {
      suggestionsBox.style.display = 'none';
      suggestionsBox.innerHTML = '';
    }

    // Find student in directory
    const student = (this.students || []).find(s => {
      const code = (s.code || s.student_code || '').trim().toLowerCase();
      const name = (s.name || '').trim().toLowerCase();
      const q = query.toLowerCase();
      return code === q || name === q || (s.student_phone && s.student_phone.includes(q)) || (s.parent_phone && s.parent_phone.includes(q));
    });

    if (student) {
      this.closeInlineStudentAdd();
      this.registerStudentAttendance(student);
      this.focusScanInput();
    } else {
      this.playScanBeep('error');
      // Student NOT found! Do NOT add dummy name! Show inline registration form!
      const feedback = document.getElementById('scanFeedback');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = '#fef2f2';
        feedback.style.color = '#b91c1c';
        feedback.style.border = '1px solid #fecaca';
        feedback.innerHTML = `
          <strong>الطالب غير مسجل في المنظومة:</strong> لم يتم العثور على طالب يطابق "${escapeHtml(query)}". يمكنك تسجيله وإضافته فوراً إلى الحصة بالأسفل.
        `;
      }

      const inlineBox = document.getElementById('inlineQuickAddStudentBox');
      if (inlineBox) {
        inlineBox.style.display = 'block';
        const nameInput = document.getElementById('inlineNewStudentName');
        if (nameInput) {
          if (isNaN(Number(query))) {
            nameInput.value = query;
          }
          nameInput.focus();
        }
      }
    }
  }

  closeInlineStudentAdd() {
    const inlineBox = document.getElementById('inlineQuickAddStudentBox');
    if (inlineBox) inlineBox.style.display = 'none';
    const feedback = document.getElementById('scanFeedback');
    if (feedback) feedback.style.display = 'none';
    this.focusScanInput();
  }

  async saveInlineNewStudentAndAttend() {
    const studentLimit = this.billingState?.students_limit || 300;
    const currentCount = (this.students || []).length;
    if (currentCount >= studentLimit) {
      const storageKey = 'centrly_quota_exceeded_timestamp';
      let reachedTimestamp = localStorage.getItem(storageKey);
      if (!reachedTimestamp) {
        reachedTimestamp = Date.now().toString();
        localStorage.setItem(storageKey, reachedTimestamp);
      }
      const elapsedDays = (Date.now() - Number(reachedTimestamp)) / (1000 * 60 * 60 * 24);
      if (elapsedDays > 3) {
        this.showToast('تم استنفاد سعة الطلاب بالكامل وتجاوزت مهلة السماح. يرجى ترقية الباقة لإضافة طلاب جدد.', 'danger');
        this.showQuotaBlockedModal(currentCount, studentLimit);
        return;
      }
    }

    const name = document.getElementById('inlineNewStudentName')?.value.trim();
    const parentPhone = document.getElementById('inlineNewStudentParentPhone')?.value.trim();
    const studentPhone = document.getElementById('inlineNewStudentPhone')?.value.trim();

    if (!name) {
      this.showToast('يرجى إدخال اسم الطالب بالكامل', 'error');
      return;
    }
    if (!parentPhone || parentPhone.length < 11) {
      this.showToast('يرجى إدخال رقم هاتف ولي أمر صحيح (11 رقماً)', 'error');
      return;
    }

    const currentGroupId = this.sessionState.group?.id;

    try {
      const res = await request('/students', {
        method: 'POST',
        body: {
          name,
          parent_phone: parentPhone,
          student_phone: studentPhone || null,
        },
      });

      const newStudent = res.student;
      if (newStudent) {
        if (currentGroupId) {
          await request(`/groups/${currentGroupId}/students`, {
            method: 'POST',
            body: { student_id: newStudent.id },
          }).catch(() => {});
        }
        this.students.unshift(newStudent);
        this.closeInlineStudentAdd();
        this.registerStudentAttendance(newStudent);
        this.showToast(`تمت إضافة الطالب (${name}) ورصد حضوره فوراً في الحصة!`, 'success');
      }
    } catch (err) {
      this.showToast(`فشل إضافة الطالب: ${err.message || 'خطأ في البيانات'}`, 'error');
    }
  }

  registerStudentAttendance(student) {
    const currentGroupId = this.sessionState.group?.id;
    if (student.group_id && currentGroupId && student.group_id !== currentGroupId) {
      const studentGroup = (this.groups || []).find(g => g.id === student.group_id);
      const studentGroupName = studentGroup?.name || 'مجموعة أخرى';
      this.showConfirmModal({
        title: 'تنبيه: طالب من مجموعة أخرى',
        message: `الطالب "${escapeHtml(student.name)}" مقيد في "${escapeHtml(studentGroupName)}". هل ترغب في تسجيل الحصة كـ (حصة تعويضية) في هذه المجموعة أم إلغاء التسجيل؟`,
        confirmText: 'تسجيل كحصة تعويضية',
        cancelText: 'إلغاء',
        isDanger: false,
        onConfirm: () => {
          this.executeAttendanceRecord(student, true);
        },
      });
      return;
    }

    this.executeAttendanceRecord(student, false);
  }

  executeAttendanceRecord(student, isMakeup = false) {
    const existing = this.sessionState.attendanceList.find(
      a => a.student_id === student.id || a.code === (student.code || student.student_code)
    );

    if (existing && existing.attended) {
      this.playScanBeep('warning');
      this.showToast(`الطالب (${student.name}) مسجل حضوره بالفعل في هذه الحصة مسبقاً!`, 'info');
      const codeInput = document.getElementById('scanStudentCode');
      if (codeInput) {
        codeInput.value = '';
      }
      this.focusScanInput();
      return;
    }

    const hwRadio = document.querySelector('input[name="scanHomework"]:checked');
    const homework = hwRadio ? hwRadio.value : 'none';

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    if (existing && !existing.attended) {
      existing.attended = true;
      existing.homework = homework;
      existing.time = timeStr;
      existing.is_makeup = isMakeup;
      this.sessionState.financials.attendeeCount += 1;
      this.sessionState.financials.absentCount = Math.max(0, this.sessionState.financials.absentCount - 1);
      if (isMakeup) this.sessionState.financials.makeupCount += 1;
      const fee = student.exempt ? 0 : (student.fee_override ?? (this.sessionState.group?.price || 0));
      this.sessionState.financials.totalRevenue += fee;
    } else {
      this.sessionState.attendanceList.unshift({
        id: `att-${Date.now()}`,
        student_id: student.id,
        code: student.code || student.student_code || `STU-${student.id.slice(0, 4)}`,
        name: student.name,
        parent_phone: student.parent_phone,
        student_phone: student.student_phone,
        attended: true,
        homework,
        quiz_score: null,
        comment: null,
        time: timeStr,
        sent: false,
        is_makeup: isMakeup,
      });
      const fee = student.exempt ? 0 : (student.fee_override ?? (this.sessionState.group?.price || 0));
      this.sessionState.financials.attendeeCount += 1;
      this.sessionState.financials.totalRevenue += fee;
      if (isMakeup) this.sessionState.financials.makeupCount += 1;
    }

    const hwNoneRadio = document.getElementById('hwNone');
    if (hwNoneRadio) hwNoneRadio.checked = true;

    this.playScanBeep('success');
    this.persistSessionState();
    this.updateNavbarBadge();
    this.showToast(isMakeup ? `تم تسجيل حضور تعويضي للطالب: ${student.name}` : `تم رصد حضور الطالب: ${student.name}`, 'success');
    this.renderMainContent();
    this.focusScanInput();

    // Cross-Device Real-Time Sync: Push attendance record to backend immediately
    const sid = this.sessionState?.id;
    if (sid && !String(sid).startsWith('sess-')) {
      const hwStatus = (homework && homework !== 'none') ? homework : null;
      request(`/sessions/${sid}/attendance`, {
        method: 'POST',
        body: {
          records: [{
            student_id: student.id,
            attended: true,
            comment: null,
            homework_status: hwStatus,
            is_makeup: Boolean(isMakeup),
            quiz_score: null,
          }],
        },
      }).catch(err => console.warn('Real-time attendance record background sync error:', err));
    }
  }

  updateAttendanceQuizScore(attendanceId, score) {
    const item = (this.sessionState.attendanceList || []).find(a => a.id === attendanceId || a.student_id === attendanceId);
    if (item) {
      item.quiz_score = score !== '' && score !== null ? Number(score) : null;
      this.persistSessionState();
      const sid = this.sessionState?.id;
      if (sid && !String(sid).startsWith('sess-') && item.student_id) {
        if (item.quiz_score !== null) {
          request(`/sessions/${sid}/quiz-scores/${item.student_id}`, {
            method: 'PUT',
            body: { score: item.quiz_score, max_score: 20 },
          }).catch(err => console.warn('Quiz score sync failed:', err));
        }
      }
    }
  }

  updateAttendanceHomework(attendanceId, newStatus) {
    const item = (this.sessionState.attendanceList || []).find(a => a.id === attendanceId || a.student_id === attendanceId);
    if (item) {
      item.homework = newStatus;
      this.persistSessionState();
      this.showToast('تم تحديث حالة الواجب', 'info');
      const sid = this.sessionState?.id;
      if (sid && !String(sid).startsWith('sess-') && item.student_id) {
        request(`/sessions/${sid}/attendance`, {
          method: 'POST',
          body: {
            records: [{
              student_id: item.student_id,
              attended: Boolean(item.attended),
              homework_status: (newStatus && newStatus !== 'none') ? newStatus : null,
              is_makeup: Boolean(item.is_makeup),
              quiz_score: item.quiz_score,
            }],
          },
        }).catch(err => console.warn('Homework status sync failed:', err));
      }
    }
  }

  // ==========================================================================
  // Audio Feedback & Hardware / Camera Scanner Suite (DEV-SCAN)
  // ==========================================================================

  playScanBeep(type = 'success') {
    playBeep(type);
  }

  openCameraScannerModal(mode = 'session') {
    unlockAudio();
    const existing = document.getElementById('cameraScannerModal');
    if (existing) existing.remove();

    this._cameraScanCount = 0;
    this._cameraFacingMode = this._cameraFacingMode || 'environment';
    this._cameraTorchOn = false;
    this._cameraZoomLevel = 1.0;

    const modeTitle = mode === 'center' 
      ? 'بوابة استقبال السنتر (توجيه وحضور عام)' 
      : 'تسجيل حضور الحصة الجارية';

    const modalHtml = `
      <div id="cameraScannerModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(15,23,42,0.75); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 9999; padding: 0.75rem;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: 0; padding: 1.1rem; border-radius: 16px; background: #ffffff; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.3); font-family: 'Cairo', sans-serif; max-height: calc(100dvh - 1.5rem); overflow-y: auto;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.85rem; border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.65rem;">
            <div>
              <h3 style="margin: 0; font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.4rem;">
                ${getIcon('camera', 20, 'var(--centrly-blue-700)')}
                <span>المسح الفوري بكاميرا الموبايل / اللابتوب</span>
              </h3>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.15rem; font-weight: 600;">
                ${modeTitle}
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeCameraScannerModal()" style="border: none; cursor: pointer; padding: 0.35rem 0.6rem; display: flex; align-items: center;">${getIcon('close', 16, '#64748b')}</button>
          </div>

          <!-- Camera Viewport Container -->
          <div style="position: relative; width: 100%; border-radius: 12px; overflow: hidden; background: #0f172a; border: 2px solid #334155; min-height: 250px;">
            <div id="centrlyCameraViewport" style="width: 100%; min-height: 250px;"></div>

            <!-- Target Reticle Box overlay with animated laser line -->
            <div style="pointer-events: none; position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;">
              <div style="width: 86%; max-width: 310px; height: 125px; border: 2.5px solid #10b981; border-radius: 12px; box-shadow: 0 0 0 9999px rgba(15,23,42,0.52); position: relative; overflow: hidden;">
                <div class="scanner-laser-line"></div>
                <div style="position: absolute; top: -26px; left: 0; right: 0; text-align: center; color: #6ee7b7; font-size: 0.75rem; font-weight: 800; text-shadow: 0 1px 3px rgba(0,0,0,0.8);">
                  وجّه الخط الأخضر أفقياً على كود الباركود
                </div>
              </div>
            </div>

            <!-- Live Status & Feedback Banner inside camera -->
            <div id="cameraScanFeedback" style="display: none; position: absolute; bottom: 12px; left: 12px; right: 12px; z-index: 20; padding: 0.65rem; border-radius: 8px; font-weight: 800; font-size: 0.85rem; text-align: center; box-shadow: 0 4px 12px rgba(0,0,0,0.3); transition: all 0.2s ease;"></div>
          </div>

          <!-- Controls and Counter -->
          <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 0.85rem; flex-wrap: wrap; gap: 0.5rem;">
            <div style="font-size: 0.85rem; font-weight: 700; color: var(--centrly-text);">
              تم تسجيل: <strong id="cameraScanCount" style="color: #16a34a; font-size: 1.05rem;">0</strong> طلاب
            </div>

            <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
              <button type="button" id="cameraZoomBtn" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleCameraZoom()" style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 700;" title="تكبير الكاميرا للقراءة عن بعد بدون تقريب الهاتف">
                ${getIcon('search', 13)}
                <span id="cameraZoomBtnText">1x</span>
              </button>
              <button type="button" id="cameraTorchBtn" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleCameraTorch()" style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 700;" title="تشغيل الكشاف للإضاءة الضعيفة">
                ${getIcon('lightbulb', 13)}
                <span id="cameraTorchBtnText">الفلاش</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.toggleCameraFacingMode('${mode}')" style="display: flex; align-items: center; gap: 0.25rem; font-size: 0.78rem; font-weight: 700;">
                ${getIcon('refresh', 13)}
                <span>تبديل</span>
              </button>
              <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeCameraScannerModal()" style="font-size: 0.78rem; font-weight: 700;">
                إغلاق
              </button>
            </div>
          </div>

          <!-- Quick Tip for Lightning Fast Barcode Scanning -->
          <div style="margin-top: 0.75rem; font-size: 0.75rem; color: #475569; background: #f8fafc; padding: 0.6rem 0.8rem; border-radius: 8px; border: 1px solid #e2e8f0; line-height: 1.5;">
            <div style="font-weight: 800; color: #1e293b; margin-bottom: 0.25rem; display: flex; align-items: center; gap: 0.35rem;">
              ${getIcon('lightbulb', 14, '#f59e0b')}
              <span>نصائح للمسح الفوري خلال ثانية واحدة:</span>
            </div>
            <ul style="margin: 0; padding-right: 1.2rem; display: flex; flex-direction: column; gap: 0.2rem;">
              <li>اجعل خطوط الباركود موازية أفقياً لخط الليزر الأخضر.</li>
              <li>أمسك الموبايل على مسافة 15-20 سم ولا تقترب جداً لتفادي ضبابية العدسة.</li>
              <li>في القاعات خافتة الإضاءة، اضغط على زر <b>الفلاش</b> لتوضيح الخطوط فورياً.</li>
            </ul>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
      this.startCameraScanner(mode);
    }, 100);
  }

  async startCameraScanner(mode = 'session') {
    unlockAudio();
    if (typeof Html5Qrcode === 'undefined') {
      const viewport = document.getElementById('centrlyCameraViewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="color: #cbd5e1; padding: 3rem 1rem; text-align: center; font-size: 0.9rem;">
            جارٍ تجهيز الكاميرا...
          </div>
        `;
      }
      return;
    }

    try {
      if (this._activeHtml5QrCode) {
        await this._activeHtml5QrCode.stop().catch(() => {});
        this._activeHtml5QrCode = null;
      }
      this._cameraTorchOn = false;
      this._cameraZoomLevel = 1.0;

      // Restrict formats strictly to what Centrly uses:
      // Code 128 (primary barcode for student IDs), QR Code, Code 39, EAN-13
      // Eliminates 13 unused algorithms on every frame, cutting CPU decoding overhead by ~75%!
      const formatsToSupport = (typeof Html5QrcodeSupportedFormats !== 'undefined') ? [
        Html5QrcodeSupportedFormats.CODE_128,
        Html5QrcodeSupportedFormats.QR_CODE,
        Html5QrcodeSupportedFormats.CODE_39,
        Html5QrcodeSupportedFormats.EAN_13,
      ] : [5, 0, 3, 9];

      // Passing formatsToSupport and useBarCodeDetectorIfSupported to constructor activates
      // native Android Vision / BarcodeDetector for lightning-fast hardware acceleration!
      const html5QrCode = new Html5Qrcode('centrlyCameraViewport', {
        formatsToSupport,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      this._activeHtml5QrCode = html5QrCode;

      const facingMode = this._cameraFacingMode || 'environment';
      const isMobile = window.innerWidth <= 768;

      // High-performance scanning configuration
      const config = {
        fps: 25, // 25 frames per second for instant detection
        qrbox: (viewfinderWidth, viewfinderHeight) => {
          const boxWidth = Math.min(Math.floor(viewfinderWidth * 0.88), 320);
          // Optimal 2.6:1 aspect ratio for linear barcodes (Code 128) and QR codes
          const boxHeight = Math.min(Math.floor(boxWidth * 0.42), 125);
          return { width: Math.max(boxWidth, 200), height: Math.max(boxHeight, 85) };
        },
        videoConstraints: {
          facingMode: { ideal: facingMode },
          width: { min: 720, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          focusMode: { ideal: 'continuous' },
        },
        disableFlip: false,
      };

      // Only set fixed landscape aspect ratio on desktop viewports
      if (!isMobile) {
        config.aspectRatio = 1.333334;
      }

      await html5QrCode.start(
        { facingMode },
        config,
        (decodedText) => {
          this.handleCameraScanDetected(decodedText, mode);
        },
        () => {} // frame noise ignored
      );

      // Mobile Safari / Chrome video attributes & hardware continuous autofocus
      setTimeout(() => {
        const video = document.querySelector('#centrlyCameraViewport video');
        if (video) {
          video.setAttribute('playsinline', 'true');
          video.setAttribute('webkit-playsinline', 'true');
          video.setAttribute('muted', 'true');
          video.muted = true;
          video.style.objectFit = 'cover';
          video.style.borderRadius = '12px';

          // Lock continuous hardware autofocus on media stream track
          try {
            const track = video.srcObject?.getVideoTracks()?.[0];
            if (track && track.getCapabilities) {
              const caps = track.getCapabilities();
              const adv = [];
              if (caps.focusMode && caps.focusMode.includes('continuous')) {
                adv.push({ focusMode: 'continuous' });
              }
              if (adv.length > 0 && track.applyConstraints) {
                track.applyConstraints({ advanced: adv }).catch(() => {});
              }
            }
          } catch (_) {}
        }
      }, 150);
    } catch (err) {
      const viewport = document.getElementById('centrlyCameraViewport');
      if (viewport) {
        viewport.innerHTML = `
          <div style="color: #f87171; padding: 2.5rem 1rem; text-align: center; font-size: 0.88rem; line-height: 1.6;">
            <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('alertTriangle', 32, '#ef4444')}</div>
            <strong>تعذر فتح الكاميرا:</strong><br>
            ${err.message || 'يرجى السماح للمتصفح بالوصول للكاميرا (Camera Permissions).'}
          </div>
        `;
      }
    }
  }

  async toggleCameraFacingMode(mode = 'session') {
    this._cameraFacingMode = this._cameraFacingMode === 'environment' ? 'user' : 'environment';
    await this.startCameraScanner(mode);
  }

  async toggleCameraZoom() {
    if (!this._activeHtml5QrCode) return;
    try {
      const video = document.querySelector('#centrlyCameraViewport video');
      const track = video?.srcObject?.getVideoTracks()?.[0];
      const caps = track?.getCapabilities ? track.getCapabilities() : {};

      if (caps.zoom) {
        const min = caps.zoom.min || 1;
        const max = caps.zoom.max || 2;
        // Step to 1.7x (ideal barcode reading distance) or back to 1x
        const targetZoom = (this._cameraZoomLevel <= 1.05) ? Math.min(1.7, max) : min;
        this._cameraZoomLevel = targetZoom;

        await this._activeHtml5QrCode.applyVideoConstraints({
          advanced: [{ zoom: targetZoom }],
        });

        const text = document.getElementById('cameraZoomBtnText');
        const btn = document.getElementById('cameraZoomBtn');
        if (text) text.innerText = targetZoom > 1.05 ? `${targetZoom.toFixed(1)}x` : '1x';
        if (btn) {
          btn.style.background = targetZoom > 1.05 ? '#eff6ff' : '';
          btn.style.borderColor = targetZoom > 1.05 ? '#3b82f6' : '';
          btn.style.color = targetZoom > 1.05 ? '#1d4ed8' : '';
        }
      } else {
        this.showToast('الكاميرا لا تدعم الزووم الرقمي من المتصفح', 'info');
      }
    } catch (err) {
      console.warn('Zoom failed:', err);
    }
  }

  async toggleCameraTorch() {
    if (!this._activeHtml5QrCode) return;
    try {
      this._cameraTorchOn = !this._cameraTorchOn;
      await this._activeHtml5QrCode.applyVideoConstraints({
        advanced: [{ torch: this._cameraTorchOn }],
      });
      const btn = document.getElementById('cameraTorchBtn');
      const text = document.getElementById('cameraTorchBtnText');
      if (btn) {
        btn.style.background = this._cameraTorchOn ? '#fef3c7' : '';
        btn.style.borderColor = this._cameraTorchOn ? '#f59e0b' : '';
        btn.style.color = this._cameraTorchOn ? '#b45309' : '';
      }
      if (text) {
        text.innerText = this._cameraTorchOn ? 'إطفاء الفلاش' : 'الفلاش';
      }
    } catch (err) {
      this._cameraTorchOn = false;
      this.showToast('الفلاش غير مدعوم على هذه الكاميرا أو وضع الكاميرا الحالي', 'info');
    }
  }

  async closeCameraScannerModal() {
    this._cameraTorchOn = false;
    this._cameraZoomLevel = 1.0;
    if (this._activeHtml5QrCode) {
      try {
        await this._activeHtml5QrCode.stop();
      } catch (_) {}
      this._activeHtml5QrCode = null;
    }
    const modal = document.getElementById('cameraScannerModal');
    if (modal) modal.remove();
    this.focusScanInput();
  }

  async handleCameraScanDetected(decodedText, mode = 'session') {
    if (!decodedText) return;
    const cleanCode = decodedText.trim();
    const now = Date.now();

    // Debounce to prevent multi-scanning the same student in rapid succession
    if (this._lastCameraCode === cleanCode && now - (this._lastCameraTime || 0) < 2500) {
      return;
    }
    this._lastCameraCode = cleanCode;
    this._lastCameraTime = now;

    const feedback = document.getElementById('cameraScanFeedback');

    if (mode === 'center') {
      try {
        const res = await request('/centers/front-desk/scan', {
          method: 'POST',
          body: { barcode: cleanCode },
        });
        if (res.success) {
          this.playScanBeep('success');
          this._cameraScanCount = (this._cameraScanCount || 0) + 1;
          const countEl = document.getElementById('cameraScanCount');
          if (countEl) countEl.innerText = this._cameraScanCount;
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = '#10b981';
            feedback.style.color = '#fff';
            feedback.innerHTML = `<span>${getIcon('check', 16, '#fff')}</span> <span>${res.message || 'تم رصد الحضور والتوجيه!'}</span>`;
            setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
          }
          await this.loadRouteData('center-sessions');
        } else {
          this.playScanBeep('error');
          if (feedback) {
            feedback.style.display = 'block';
            feedback.style.background = '#ef4444';
            feedback.style.color = '#fff';
            feedback.innerHTML = `<span>${getIcon('close', 16, '#fff')}</span> <span>${res.message || 'تعذر التعرف على الطالب'}</span>`;
            setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
          }
        }
      } catch (err) {
        this.playScanBeep('error');
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.background = '#ef4444';
          feedback.style.color = '#fff';
          feedback.innerText = `خطأ في الاتصال: ${err.message || 'تعذر الإرسال'}`;
          setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
        }
      }
      return;
    }

    // Default: Session attendance
    const student = (this.students || []).find(s => {
      const code = (s.code || s.student_code || '').trim().toLowerCase();
      const name = (s.name || '').trim().toLowerCase();
      const q = cleanCode.toLowerCase();
      return code === q || name === q || (s.student_phone && s.student_phone.includes(q)) || (s.parent_phone && s.parent_phone.includes(q));
    });

    if (student) {
      // Check if already attended
      const existing = this.sessionState.attendanceList.find(
        a => a.student_id === student.id || a.code === (student.code || student.student_code)
      );

      if (existing && existing.attended) {
        this.playScanBeep('warning');
        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.background = '#f59e0b';
          feedback.style.color = '#1e293b';
          feedback.innerHTML = `<strong>تنبيه:</strong> الطالب (${escapeHtml(student.name)}) مسجل حضوره بالفعل مسبقاً!`;
          setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
        }
        return;
      }

      this.registerStudentAttendance(student);
      this._cameraScanCount = (this._cameraScanCount || 0) + 1;
      const countEl = document.getElementById('cameraScanCount');
      if (countEl) countEl.innerText = this._cameraScanCount;

      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#10b981';
        feedback.style.color = '#fff';
        feedback.innerHTML = `<span>${getIcon('check', 16, '#fff')}</span> <span>تم تسجيل: <strong>${escapeHtml(student.name)}</strong> (${escapeHtml(student.code || student.student_code || cleanCode)})</span>`;
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2200);
      }
    } else {
      this.playScanBeep('error');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#ef4444';
        feedback.style.color = '#fff';
        feedback.innerHTML = `<span>${getIcon('close', 16, '#fff')}</span> <span>كود غير مسجل بالمنظومة: <strong>${escapeHtml(cleanCode)}</strong></span>`;
        setTimeout(() => { if (feedback) feedback.style.display = 'none'; }, 2500);
      }
    }
  }

  openScannerSetupGuide() {
    const existing = document.getElementById('scannerSetupModal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="scannerSetupModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(15,23,42,0.65); backdrop-filter: blur(4px); align-items: center; justify-content: center; z-index: 9999; padding: 1rem;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 560px; margin: 0; padding: 1.5rem; border-radius: 16px; background: #ffffff; box-shadow: 0 25px 50px -12px rgba(0,0,0,0.25); font-family: 'Cairo', sans-serif; max-height: 90vh; overflow-y: auto;">
          
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--centrly-blue-700);">${getIcon('gear', 22, 'var(--centrly-blue-700)')}</span>
              <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">
                دليل وضبط أجهزة الباركود سكانر (Hardware Setup)
              </h3>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="document.getElementById('scannerSetupModal')?.remove()" style="border: none; cursor: pointer; padding: 0.35rem 0.6rem; display: flex; align-items: center;">${getIcon('close', 16, '#64748b')}</button>
          </div>

          <!-- Step 1: Plug & Play -->
          <div style="margin-bottom: 1.25rem;">
            <div style="font-weight: 800; color: var(--centrly-blue-800); font-size: 0.95rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span style="background: #eff6ff; color: #2563eb; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900;">1</span>
              <span>التوصيل الفوري (Plug & Play - بدون أي تعريفات)</span>
            </div>
            <p style="font-size: 0.85rem; color: #475569; margin: 0 0 0.5rem 0; line-height: 1.6;">
              أي جهاز سكانر تشتريه من السوق (سلكي USB أو لاسلكي Wireless 2.4GHz مع دانجل أو Bluetooth) يعمل فورياً. فقط ضعه في مدخل الـ USB بالكمبيوتر أو اللابتوب وسيتعرف عليه كـ لوحة مفاتيح سريعة مباشرة دون برامج تعريف.
            </p>
          </div>

          <!-- Step 2: Automatic Enter Key (Suffix CR/LF) -->
          <div style="margin-bottom: 1.25rem;">
            <div style="font-weight: 800; color: var(--centrly-blue-800); font-size: 0.95rem; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.4rem;">
              <span style="background: #eff6ff; color: #2563eb; width: 24px; height: 24px; border-radius: 50%; display: inline-flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 900;">2</span>
              <span>إرسال زر Enter تلقائياً بعد المسح</span>
            </div>
            <p style="font-size: 0.85rem; color: #475569; margin: 0 0 0.5rem 0; line-height: 1.6;">
              99% من أجهزة السكانر تأتي مبرمجة تلقائياً لتضغط Enter فور قراءة الكود. إذا كان سكانرك يكتب الكود ولا يضغط Enter، قم بمسح باركود <strong>(Add Enter / Carriage Return)</strong> الموجود في ورقة الكتالوج المصاحبة للسكانر مرة واحدة فقط وسيعمل دائماً.
            </p>
          </div>

          <!-- Step 3: Interactive Live Scanner Tester -->
          <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 12px; padding: 1.25rem; margin-bottom: 1.25rem;">
            <div style="font-weight: 800; color: #166534; font-size: 0.95rem; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.4rem;">
              ${getIcon('barcode', 18, '#166534')}
              <span>منطقة اختبار السكانر التفاعلية الحية</span>
            </div>
            <p style="font-size: 0.825rem; color: #166534; margin: 0 0 0.75rem 0;">
              وجه سكانرك الآن وامسح أي كارت أو باركود في المربع أدناه لتتأكد من سرعة القراءة وسماع صوت الـ Beep:
            </p>
            
            <input 
              type="text" 
              id="scannerTestLiveInput" 
              class="form-input" 
              placeholder="ضع المؤشر هنا وامسح بالسكانر..." 
              style="background: #fff; border: 1.5px solid #16a34a; font-size: 1rem; font-weight: 800; text-align: center; direction: ltr;"
              onkeydown="if (event.key === 'Enter') { event.preventDefault(); window.centrlyApp.handleLiveScannerTest(this.value); this.value = ''; }"
            >

            <div id="scannerTestLiveResult" style="margin-top: 0.65rem; font-size: 0.85rem; font-weight: 700; text-align: center; color: #047857; min-height: 24px;"></div>
          </div>

          <div style="display: flex; justify-content: flex-end;">
            <button type="button" class="btn btn-primary" onclick="document.getElementById('scannerSetupModal')?.remove()" style="font-weight: 700; padding: 0.5rem 1.5rem;">
              فهمت، والكل جاهز
            </button>
          </div>

        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
    setTimeout(() => {
      document.getElementById('scannerTestLiveInput')?.focus();
    }, 100);
  }

  handleLiveScannerTest(code) {
    if (!code) return;
    this.playScanBeep('success');
    const resEl = document.getElementById('scannerTestLiveResult');
    if (resEl) {
      resEl.innerHTML = `
        <span style="color: #15803d;">${getIcon('check', 16, '#15803d')} تم استلام الكود بنجاح: <strong>${escapeHtml(code)}</strong> وبسرعة استجابة فائقة!</span>
      `;
    }
  }

  // Modal Helper Functions
  showModal(title, bodyHtml, footerHtml) {
    this.closeModal();
    const modalEl = document.createElement('div');
    modalEl.id = 'centrlyCustomModal';
    modalEl.className = 'modal-overlay';
    modalEl.innerHTML = `
      <div class="modal-dialog" dir="rtl">
        <div class="modal-header">
          <h3 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">${title}</h3>
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeModal()" style="padding: 0.35rem 0.55rem; border: none; cursor: pointer; display: flex; align-items: center;">${getIcon('close', 16, '#64748b')}</button>
        </div>
        <div class="modal-body" style="font-size: 0.9rem; line-height: 1.6;">
          ${bodyHtml}
        </div>
        ${footerHtml ? `<div class="modal-footer">${footerHtml}</div>` : ''}
      </div>
    `;
    modalEl.addEventListener('click', (e) => {
      if (e.target === modalEl) this.closeModal();
    });
    document.body.appendChild(modalEl);

    // Auto-focus first input for immediate typing
    setTimeout(() => {
      const firstInput = modalEl.querySelector('input:not([type="hidden"]):not([disabled]), textarea:not([disabled]), select:not([disabled])');
      if (firstInput) firstInput.focus();
    }, 60);
  }

  closeModal() {
    const existing = document.getElementById('centrlyCustomModal');
    if (existing) existing.remove();
  }

  setupModalKeyboardShortcuts() {
    if (this._modalKeydownBound) return;
    this._modalKeydownBound = true;

    document.addEventListener('keydown', (e) => {
      // Find active modal overlay
      const customModal = document.getElementById('centrlyCustomModal');
      const confirmModal = document.getElementById('centrlyConfirmModal');
      const cameraModal = document.getElementById('cameraScannerModal');
      const scannerModal = document.getElementById('scannerSetupModal');
      const quotaModal = document.getElementById('quotaBlockedModal');
      const paymentModal = document.getElementById('paymentProofModal');
      const genericModal = document.querySelector('.modal-overlay:not([style*="display: none"])');

      const activeModal = customModal || confirmModal || cameraModal || scannerModal || quotaModal || paymentModal || genericModal;
      if (!activeModal || !document.body.contains(activeModal)) return;

      const style = window.getComputedStyle(activeModal);
      if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

      // 1. Handle Escape -> Close modal
      if (e.key === 'Escape') {
        e.preventDefault();
        if (customModal) {
          this.closeModal();
        } else if (confirmModal) {
          confirmModal.remove();
        } else if (cameraModal) {
          if (typeof this.closeCameraScannerModal === 'function') this.closeCameraScannerModal();
          else cameraModal.remove();
        } else if (scannerModal) {
          scannerModal.remove();
        } else if (quotaModal) {
          quotaModal.remove();
        } else if (paymentModal) {
          paymentModal.remove();
        } else {
          const closeBtn = activeModal.querySelector('.modal-header button, button.btn-secondary, button[onclick*="close"]');
          if (closeBtn) closeBtn.click();
          else activeModal.remove();
        }
        return;
      }

      // 2. Handle Enter -> Save / Submit modal
      if (e.key === 'Enter') {
        const target = e.target;

        // In a textarea: allow regular Enter for line-breaks.
        // Pressing Ctrl+Enter or Cmd+Enter triggers submit.
        if (target && target.tagName === 'TEXTAREA') {
          if (!e.ctrlKey && !e.metaKey) {
            return;
          }
        }

        // If target is already a button, let the browser fire the native click unless Ctrl/Cmd was pressed
        if (target && target.tagName === 'BUTTON' && !e.ctrlKey && !e.metaKey) {
          return;
        }

        e.preventDefault();

        // If confirm modal is active, trigger confirm action button
        if (confirmModal && activeModal === confirmModal) {
          const confirmBtn = confirmModal.querySelector('#confirmModalActionBtn');
          if (confirmBtn && !confirmBtn.disabled) {
            confirmBtn.click();
            return;
          }
        }

        // Identify associated form
        const form = (target && target.closest('form')) || activeModal.querySelector('form');

        // Locate primary submit or save button
        let primaryBtn = null;
        if (form && form.id) {
          primaryBtn = document.querySelector(`button[form="${form.id}"][type="submit"], button[form="${form.id}"].btn-primary`);
        }
        if (!primaryBtn && form) {
          primaryBtn = form.querySelector('button[type="submit"], input[type="submit"], button.btn-primary');
        }
        if (!primaryBtn) {
          primaryBtn = activeModal.querySelector(
            '#confirmModalActionBtn, button[type="submit"], .modal-footer .btn-primary, .modal-footer button:not(.btn-secondary), .modal-body button.btn-primary, button.btn-primary'
          );
        }

        if (primaryBtn && !primaryBtn.disabled) {
          primaryBtn.click();
          return;
        }

        // Fallback: Submit form directly if found
        if (form) {
          if (typeof form.requestSubmit === 'function') {
            form.requestSubmit();
          } else {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          }
        }
      }
    });
  }

  showToast(message, type = 'success') {
    let container = document.getElementById('centrlyToastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'centrlyToastContainer';
      container.style.cssText = `
        position: fixed;
        bottom: 24px;
        left: 24px;
        z-index: 999999;
        display: flex;
        flex-direction: column;
        gap: 10px;
        max-width: 440px;
        width: calc(100% - 48px);
        pointer-events: none;
      `;
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.style.cssText = `
      pointer-events: auto;
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      padding: 12px 18px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 700;
      box-shadow: 0 10px 30px rgba(0,0,0,0.18);
      transform: translateY(20px);
      opacity: 0;
      transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
      direction: rtl;
    `;

    if (type === 'success') {
      toast.style.background = '#059669';
      toast.style.color = '#ffffff';
      toast.style.border = '1px solid #10b981';
      toast.style.boxShadow = '0 10px 25px rgba(5, 150, 105, 0.4)';
    } else if (type === 'warning') {
      toast.style.background = '#d97706';
      toast.style.color = '#ffffff';
      toast.style.border = '1px solid #f59e0b';
      toast.style.boxShadow = '0 10px 25px rgba(217, 119, 6, 0.4)';
    } else if (type === 'error' || type === 'danger') {
      toast.style.background = '#dc2626';
      toast.style.color = '#ffffff';
      toast.style.border = '1px solid #ef4444';
      toast.style.boxShadow = '0 10px 25px rgba(220, 38, 38, 0.4)';
    } else {
      toast.style.background = '#1d4ed8';
      toast.style.color = '#ffffff';
      toast.style.border = '1px solid #3b82f6';
      toast.style.boxShadow = '0 10px 25px rgba(29, 78, 216, 0.4)';
    }

    const toastIcon = type === 'success' 
      ? getIcon('check', 16, '#ffffff') 
      : ((type === 'error' || type === 'danger') 
        ? getIcon('close', 16, '#ffffff') 
        : (type === 'warning' ? getIcon('alertTriangle', 16, '#ffffff') : getIcon('lightbulb', 16, '#ffffff')));

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
        <span style="display: flex; align-items: center;">${toastIcon}</span>
        <span>${escapeHtml(message)}</span>
      </div>
      <button style="background: transparent; border: none; color: #fff; cursor: pointer; padding: 0 4px; opacity: 0.85; display: flex; align-items: center;" onclick="this.parentElement.remove()">${getIcon('close', 14, '#ffffff')}</button>
    `;

    container.appendChild(toast);
    requestAnimationFrame(() => {
      toast.style.transform = 'translateY(0)';
      toast.style.opacity = '1';
    });

    setTimeout(() => {
      toast.style.transform = 'translateY(20px)';
      toast.style.opacity = '0';
      setTimeout(() => toast.remove(), 350);
    }, 3500);
  }

  showConfirmModal({ title, message, confirmText = 'حذف', cancelText = 'إلغاء', onConfirm, isDanger = true }) {
    const existing = document.getElementById('centrlyConfirmModal');
    if (existing) existing.remove();

    const modalEl = document.createElement('div');
    modalEl.id = 'centrlyConfirmModal';
    modalEl.className = 'modal-overlay';
    modalEl.style.cssText = `
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      overflow-y: auto;
    `;
    modalEl.innerHTML = `
      <div class="modal-dialog" dir="rtl" style="background: #ffffff; border-radius: 14px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid var(--centrly-line); margin: auto; max-height: calc(100vh - 2rem); display: flex; flex-direction: column;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--centrly-line); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: ${isDanger ? 'var(--centrly-danger)' : 'var(--centrly-ink)'};">
            ${escapeHtml(title)}
          </h3>
          <button onclick="document.getElementById('centrlyConfirmModal')?.remove()" style="background: transparent; border: none; cursor: pointer; color: var(--centrly-text); display: flex; align-items: center;">${getIcon('close', 16, 'currentColor')}</button>
        </div>
        <div style="padding: 1.5rem; font-size: 0.925rem; color: var(--centrly-ink); line-height: 1.6;">
          ${escapeHtml(message)}
        </div>
        <div style="padding: 1rem 1.5rem; background: var(--centrly-surface); border-top: 1px solid var(--centrly-line); display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button id="confirmModalCancelBtn" class="btn" style="background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: 8px; cursor: pointer;">
            ${escapeHtml(cancelText)}
          </button>
          <button id="confirmModalActionBtn" class="btn" style="background: ${isDanger ? '#ef4444' : 'var(--centrly-blue-700)'}; color: #ffffff; border: none; font-weight: 800; padding: 0.5rem 1.4rem; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px ${isDanger ? 'rgba(239,68,68,0.35)' : 'rgba(37,99,235,0.35)'};">
            ${escapeHtml(confirmText)}
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    document.getElementById('confirmModalCancelBtn').onclick = () => {
      modalEl.remove();
    };
    document.getElementById('confirmModalActionBtn').onclick = async () => {
      const btn = document.getElementById('confirmModalActionBtn');
      if (btn) {
        btn.disabled = true;
        btn.style.opacity = '0.5';
        btn.style.pointerEvents = 'none';
      }
      modalEl.remove();
      if (onConfirm) await onConfirm();
    };
  }

  promptLogout() {
    this.showConfirmModal({
      title: 'تسجيل الخروج من المنظومة',
      message: 'هل أنت متأكد من رغبتك في تسجيل الخروج؟ ستحتاج إلى تسجيل الدخول مرة أخرى لمتابعة الحصص أو إدارة السنتر.',
      confirmText: 'تسجيل الخروج',
      cancelText: 'إلغاء ومتابعة العمل',
      isDanger: true,
      onConfirm: () => this.logout(),
    });
  }

  restoreSessionState() {
    try {
      const saved = localStorage.getItem('centrly_active_session_state');
      if (saved) {
        const parsed = JSON.parse(saved);
        const todayStr = new Date().toISOString().split('T')[0];
        // If it is from a previous date, or dummy session named 'حصة اليوم', or has no group id, purge it immediately
        if (!parsed || (parsed.session_date && parsed.session_date !== todayStr) || parsed?.group?.name === 'حصة اليوم' || !parsed?.group?.id || (Array.isArray(parsed?.attendanceList) && parsed.attendanceList.length === 0 && !parsed.group?.id)) {
          localStorage.removeItem('centrly_active_session_state');
          localStorage.removeItem('centrly_active_session_id');
          this.sessionState = {
            id: null,
            status: 'scheduled',
            group: null,
            attendanceList: [],
            financials: { totalRevenue: 0, attendeeCount: 0, absentCount: 0, exemptCount: 0, makeupCount: 0 },
          };
          return;
        }
        if (parsed && parsed.id && parsed.status === 'in_progress') {
          this.sessionState = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to restore session state:', e);
    }
  }

  discardActiveSession() {
    this.showConfirmModal({
      title: 'إلغاء وإغلاق الحصة',
      message: 'هل أنت متأكد من رغبتك في إغلاق هذه الحصة والعودة لقائمة المجموعات والحصص؟',
      confirmText: 'نعم، إغلاق الحصة',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: async () => {
        const id = this.sessionState?.id;
        if (id && !String(id).startsWith('sess-')) {
          await request(`/sessions/${id}/cancel`, {
            method: 'POST',
            body: { notify_parents: false, reason: 'إلغاء الحصة بدون تسجيل' },
          }).catch(() => {});
        }
        this.resetActiveSession();
      },
    });
  }

  persistSessionState() {
    try {
      if (this.sessionState && this.sessionState.id && this.sessionState.status === 'in_progress') {
        localStorage.setItem('centrly_active_session_state', JSON.stringify(this.sessionState));
        localStorage.setItem('centrly_active_session_id', this.sessionState.id);
      } else {
        localStorage.removeItem('centrly_active_session_state');
        localStorage.removeItem('centrly_active_session_id');
      }
    } catch (e) {
      console.warn('Failed to persist session state:', e);
    }
  }

  getActiveSessionSummary() {
    if (this.sessionState?.id && this.sessionState.status === 'in_progress') {
      return {
        id: this.sessionState.id,
        groupName: this.sessionState.group?.name || 'حصة جارية',
        attendeeCount: this.sessionState.financials?.attendeeCount || 0,
      };
    }
    return null;
  }

  updateNavbarBadge() {
    const container = document.getElementById('navLiveSessionBadgeContainer');
    if (!container) return;
    const summary = this.getActiveSessionSummary();
    if (summary) {
      container.innerHTML = `
        <button 
          type="button" 
          onclick="window.centrlyApp.navigate('sessions')" 
          class="btn btn-sm"
          style="display: inline-flex; align-items: center; gap: 0.45rem; background: #fef2f2; color: #b91c1c; border: 1.5px solid #f87171; border-radius: 9999px; padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; animation: centrlyPulse 2s infinite;"
          title="حصة نشطة حالياً - اضغط للمتابعة ورصد الحضور"
        >
          <span style="width: 9px; height: 9px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
          <span>حصة جارية: <b>${escapeHtml(summary.groupName)}</b> (${summary.attendeeCount || 0} حضور)</span>
        </button>
      `;
    } else {
      container.innerHTML = '';
    }
  }

  async syncAndResumeServerSession(sessionId) {
    if (!sessionId) return null;
    try {
      const res = await request(`/sessions/${sessionId}`).catch(() => null);
      if (!res || !res.session) return null;
      const s = res.session;
      if (s.status === 'ended' || s.status === 'cancelled') {
        if (this.sessionState?.id === sessionId) {
          this.sessionState = {
            id: null,
            status: 'scheduled',
            group: null,
            attendanceList: [],
            financials: { totalRevenue: 0, attendeeCount: 0, absentCount: 0, exemptCount: 0, makeupCount: 0 },
          };
          localStorage.removeItem('centrly_active_session_state');
          localStorage.removeItem('centrly_active_session_id');
        }
        this.stopLiveSessionSync();
        this.updateNavbarBadge();
        return null;
      }

      // Ensure groups are loaded
      if (!this.groups || this.groups.length === 0) {
        const gRes = await request('/groups').catch(() => []);
        this.groups = Array.isArray(gRes) ? gRes : (gRes.groups || []);
      }
      const grp = (this.groups || []).find(g => g.id === s.group_id) || s.groups || { id: s.group_id, name: 'حصة دراسية', price: 100 };

      // Ensure students are loaded
      if (!this.students || this.students.length === 0) {
        const studRes = await request('/students').catch(() => []);
        this.students = Array.isArray(studRes) ? studRes : (studRes.students || []);
      }

      let groupStudents = (this.students || []).filter(st => st.group_id === s.group_id || (Array.isArray(st.group_ids) && st.group_ids.includes(s.group_id)));
      if (groupStudents.length === 0) {
        try {
          const grpStudRes = await request(`/students?group_id=${s.group_id}`).catch(() => null);
          const list = Array.isArray(grpStudRes) ? grpStudRes : (grpStudRes?.students || []);
          if (list.length > 0) {
            groupStudents = list;
            list.forEach(st => {
              if (!this.students.find(existing => existing.id === st.id)) {
                this.students.push(st);
              }
            });
          }
        } catch (_) {}
      }

      const serverAttendance = Array.isArray(res.attendance) ? res.attendance : [];
      const serverQuizScores = Array.isArray(res.quiz_scores) ? res.quiz_scores : [];

      // Build roster starting with group students
      const rosterMap = new Map();
      groupStudents.forEach(st => {
        rosterMap.set(st.id, {
          id: st.id,
          student_id: st.id,
          code: st.code || st.student_code || (st.id ? st.id.slice(0, 4) : '—'),
          name: st.name,
          phone: st.phone || st.student_phone,
          parent_phone: st.parent_phone,
          attended: false,
          homework: 'none',
          quiz_score: null,
          comment: '',
          time: '',
          deliveryStatus: 'pending',
          sent: false,
          is_makeup: false,
          fee: st.exempt ? 0 : (st.fee_override ?? (grp?.price || 0)),
        });
      });

      // Merge server attendance records
      serverAttendance.forEach(att => {
        const studentInfo = (this.students || []).find(st => st.id === att.student_id);
        const existing = rosterMap.get(att.student_id);
        const fee = studentInfo?.exempt ? 0 : (studentInfo?.fee_override ?? (grp?.price || 0));

        let delivery = 'pending';
        if (att.wa_status === 'sent' || att.sent) delivery = 'delivered';
        else if (att.wa_status === 'failed') delivery = 'failed';

        const record = {
          id: att.id || att.student_id,
          student_id: att.student_id,
          code: studentInfo?.code || studentInfo?.student_code || (att.student_id ? att.student_id.slice(0, 4) : '—'),
          name: studentInfo?.name || att.student_name || 'طالب مسجل',
          phone: studentInfo?.phone || studentInfo?.student_phone || '',
          parent_phone: studentInfo?.parent_phone || att.parent_phone || '',
          attended: Boolean(att.attended),
          homework: (att.homework_status && att.homework_status !== 'none') ? att.homework_status : (existing?.homework || 'none'),
          quiz_score: (att.quiz_score !== undefined && att.quiz_score !== null) ? Number(att.quiz_score) : (existing?.quiz_score ?? null),
          comment: att.comment || existing?.comment || '',
          time: att.time || (att.created_at ? new Date(att.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : (existing?.time || '')),
          deliveryStatus: delivery,
          wa_status: att.wa_status || null,
          sent: Boolean(att.sent || att.wa_status === 'sent'),
          is_makeup: Boolean(att.is_makeup),
          fee,
        };
        rosterMap.set(att.student_id, record);
      });

      // Merge quiz scores if any
      serverQuizScores.forEach(qs => {
        const existing = rosterMap.get(qs.student_id);
        if (existing && qs.score !== undefined && qs.score !== null) {
          existing.quiz_score = Number(qs.score);
        }
      });

      const fullRoster = Array.from(rosterMap.values());
      // Sort: attendees first, then absent
      fullRoster.sort((a, b) => {
        if (a.attended === b.attended) return 0;
        return a.attended ? -1 : 1;
      });

      const attendees = fullRoster.filter(r => r.attended);
      const absent = fullRoster.filter(r => !r.attended);
      const makeup = fullRoster.filter(r => r.attended && r.is_makeup);
      const totalRev = attendees.reduce((acc, cur) => acc + (cur.fee || 0), 0);

      this.sessionState = {
        id: s.id,
        status: s.status,
        session_number: s.session_number || 1,
        session_date: s.session_date || new Date().toISOString().split('T')[0],
        room: s.room || grp.room || grp.room_name || '',
        group: grp,
        attendanceList: fullRoster,
        financials: {
          totalRevenue: totalRev,
          attendeeCount: attendees.length,
          absentCount: absent.length,
          exemptCount: fullRoster.filter(r => r.fee === 0).length,
          makeupCount: makeup.length,
        },
      };

      this.persistSessionState();
      this.startLiveSessionSync();
      this.updateNavbarBadge();
      return this.sessionState;
    } catch (err) {
      console.warn('Failed to sync and resume server session:', err);
      return null;
    }
  }

  startLiveSessionSync() {
    this.stopLiveSessionSync();
    if (!this.sessionState?.id || this.sessionState.status !== 'in_progress') return;

    this._sessionSyncInterval = setInterval(() => {
      this.pollLiveSessionUpdates();
    }, 4000);

    if (!this._visibilityListenerAttached) {
      this._visibilityListenerAttached = true;
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible' && this.sessionState?.id && this.sessionState.status === 'in_progress') {
          this.pollLiveSessionUpdates();
        }
      });
      window.addEventListener('focus', () => {
        if (this.sessionState?.id && this.sessionState.status === 'in_progress') {
          this.pollLiveSessionUpdates();
        }
      });
    }
  }

  stopLiveSessionSync() {
    if (this._sessionSyncInterval) {
      clearInterval(this._sessionSyncInterval);
      this._sessionSyncInterval = null;
    }
  }

  async pollLiveSessionUpdates() {
    const sid = this.sessionState?.id;
    if (!sid || String(sid).startsWith('sess-') || this.sessionState.status !== 'in_progress') {
      return;
    }
    try {
      const res = await request(`/sessions/${sid}`).catch(() => null);
      if (!res) return;

      const serverStatus = res.session?.status || res.status;
      if (serverStatus === 'ended' || serverStatus === 'cancelled') {
        this.stopLiveSessionSync();
        this.sessionState.status = serverStatus;
        this.persistSessionState();
        this.showToast(`تم إنهاء الحصة من جهاز آخر (${serverStatus === 'ended' ? 'اكتملت الحصة' : 'أُلغيت'})`, 'info');
        if (this.currentRoute === 'sessions') {
          this.renderMainContent();
        }
        this.updateNavbarBadge();
        return;
      }

      // Merge server attendance changes
      const serverAttendance = Array.isArray(res.attendance) ? res.attendance : [];
      let hasChanges = false;
      const currentList = this.sessionState.attendanceList || [];

      serverAttendance.forEach(sAtt => {
        const local = currentList.find(a => a.student_id === sAtt.student_id);
        if (local) {
          if (!local.attended && sAtt.attended) {
            local.attended = true;
            local.time = sAtt.time || (sAtt.created_at ? new Date(sAtt.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : local.time);
            local.is_makeup = Boolean(sAtt.is_makeup);
            if (sAtt.homework_status) local.homework = sAtt.homework_status;
            if (sAtt.quiz_score !== null && sAtt.quiz_score !== undefined) local.quiz_score = sAtt.quiz_score;
            hasChanges = true;
          }
          if (sAtt.wa_status === 'sent' && local.deliveryStatus !== 'delivered') {
            local.deliveryStatus = 'delivered';
            local.wa_status = 'sent';
            local.sent = true;
            hasChanges = true;
          } else if (sAtt.wa_status === 'failed' && local.deliveryStatus !== 'failed') {
            local.deliveryStatus = 'failed';
            local.wa_status = 'failed';
            hasChanges = true;
          }
        } else if (sAtt.attended) {
          const studentInfo = (this.students || []).find(st => st.id === sAtt.student_id);
          const fee = studentInfo?.exempt ? 0 : (studentInfo?.fee_override ?? (this.sessionState.group?.price || 0));
          currentList.unshift({
            id: sAtt.id || sAtt.student_id,
            student_id: sAtt.student_id,
            code: studentInfo?.code || studentInfo?.student_code || (sAtt.student_id ? sAtt.student_id.slice(0, 4) : '—'),
            name: studentInfo?.name || sAtt.student_name || 'طالب مسجل',
            phone: studentInfo?.phone || studentInfo?.student_phone || '',
            parent_phone: studentInfo?.parent_phone || sAtt.parent_phone || '',
            attended: true,
            homework: sAtt.homework_status || 'none',
            quiz_score: sAtt.quiz_score ?? null,
            comment: sAtt.comment || '',
            time: sAtt.time || (sAtt.created_at ? new Date(sAtt.created_at).toLocaleTimeString('ar-EG', { hour: '2-digit', minute: '2-digit' }) : ''),
            deliveryStatus: (sAtt.wa_status === 'sent' || sAtt.sent) ? 'delivered' : 'pending',
            wa_status: sAtt.wa_status || null,
            sent: Boolean(sAtt.sent || sAtt.wa_status === 'sent'),
            is_makeup: Boolean(sAtt.is_makeup),
            fee,
          });
          hasChanges = true;
        }
      });

      if (hasChanges) {
        const attendees = currentList.filter(r => r.attended);
        const absent = currentList.filter(r => !r.attended);
        const makeup = currentList.filter(r => r.attended && r.is_makeup);
        const price = this.sessionState.group?.price || 0;
        const totalRev = attendees.reduce((acc, cur) => acc + (cur.fee ?? (cur.exempt ? 0 : price)), 0);

        this.sessionState.financials = {
          totalRevenue: totalRev,
          attendeeCount: attendees.length,
          absentCount: absent.length,
          exemptCount: currentList.filter(r => r.fee === 0 || r.exempt).length,
          makeupCount: makeup.length,
        };
        this.persistSessionState();
        this.updateNavbarBadge();
        if (this.currentRoute === 'sessions') {
          const activeInput = document.activeElement;
          const isTyping = activeInput && (activeInput.id === 'scanStudentCode' || activeInput.tagName === 'INPUT' || activeInput.tagName === 'TEXTAREA');
          if (!isTyping) {
            this.renderMainContent();
          }
        }
      }
    } catch (_) {}
  }

  // Session Finalization & Note Choice (DEV-Feedback)
  endActiveSession() {
    this.openEndSessionConfirmModal();
  }

  openEndSessionConfirmModal() {
    if (!this.sessionState.id) {
      this.showToast('لا توجد حصة نشطة لإنهائها.', 'info');
      return;
    }
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem; display: flex; justify-content: center; color: #dc2626;">
          ${getIcon('close', 42, '#dc2626')}
        </div>
        <div style="font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink); margin-bottom: 0.5rem;">
          هل تود إنهاء الحصة الآن وتثبيت كشف الحضور؟
        </div>
        <p style="font-size: 0.875rem; color: var(--centrly-text); margin: 0 0 1rem 0;">
          قبل إغلاق الحصة، يمكنك مراجعة وتدوين ملاحظات الطلاب لتُرسل تلقائياً في تقارير ورسائل أولياء الأمور عبر واتساب.
        </p>
      </div>
    `;
    const footerHtml = `
      <button class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">
        إلغاء
      </button>
      <button class="btn btn-secondary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openBatchNotesModal();" style="color: var(--centrly-blue-700); font-weight: 700; border-color: var(--centrly-blue-700); display: inline-flex; align-items: center; gap: 0.35rem;">
        ${getIcon('note', 14)}
        <span>إضافة ومراجعة الملاحظات أولاً</span>
      </button>
      <button class="btn btn-primary" onclick="window.centrlyApp.finalizeEndSession()" style="font-weight: 800; background: #dc2626; border-color: #dc2626; color: #fff;">
        نعم، إنهاء الحصة وتثبيت الكشف
      </button>
    `;
    this.showModal('تأكيد إنهاء الحصة الدراسية', bodyHtml, footerHtml);
  }

  async finalizeEndSession() {
    this.closeModal();
    try {
      const currentId = this.sessionState?.id;
      let realSessionId = currentId;

      // If the session ID was a temporary client ID (sess-xxx), try to create a real record on the server first
      if (currentId && String(currentId).startsWith('sess-')) {
        const cleanGroupId = String(currentId).replace(/^sess-/, '');
        try {
          const todayStr = new Date().toISOString().split('T')[0];
          const createRes = await request('/sessions', {
            method: 'POST',
            body: {
              group_id: cleanGroupId,
              session_number: 1,
              session_date: todayStr,
            },
          });
          if (createRes?.session?.id) {
            realSessionId = createRes.session.id;
            this.sessionState.id = realSessionId;
          }
        } catch (cErr) {
          console.warn('Could not backfill session on server:', cErr);
        }
      }

      // If there are attendance records, sync them to backend before closing
      if (this.sessionState?.attendanceList && this.sessionState.attendanceList.length > 0 && realSessionId && !String(realSessionId).startsWith('sess-')) {
        const records = this.sessionState.attendanceList
          .filter(a => a.student_id)
          .map(a => ({
            student_id: a.student_id,
            attended: Boolean(a.attended),
            comment: a.comment || null,
            homework_status: (a.homework && a.homework !== 'none') ? a.homework : null,
            is_makeup: Boolean(a.is_makeup),
            quiz_score: (a.quiz_score !== undefined && a.quiz_score !== null && a.quiz_score !== '') ? Number(a.quiz_score) : null,
            sent: Boolean(a.sent),
          }));
        if (records.length > 0) {
          await request(`/sessions/${realSessionId}/attendance`, {
            method: 'POST',
            body: { records },
          }).catch(err => console.warn('Sync attendance on end failed:', err));
        }
      }

      // Call end endpoint on server if we have a valid server ID
      if (realSessionId && !String(realSessionId).startsWith('sess-')) {
        await request(`/sessions/${realSessionId}/end`, { method: 'POST' });
      }

      this.sessionState.status = 'ended';
      this.persistSessionState();
      this.stopLiveSessionSync();
      this.updateNavbarBadge();
      this.showToast('تم إنهاء الحصة وتثبيت كشف الحضور بنجاح.', 'success');
      this.renderMainContent();
    } catch (err) {
      // If server returns NOT_FOUND / Session not found, finish locally to never trap the user
      if (err.message && (err.message.includes('Session not found') || err.message.includes('NOT_FOUND'))) {
        this.sessionState.status = 'ended';
        this.persistSessionState();
        this.stopLiveSessionSync();
        this.updateNavbarBadge();
        this.showToast('تم إنهاء الحصة وتثبيت كشف الحضور بنجاح.', 'success');
        this.renderMainContent();
        return;
      }
      this.showToast(`فشل إنهاء الحصة: ${err.message || 'حدث خطأ في الخادم'}`, 'danger');
    }
  }

  resetActiveSession() {
    this.sessionState = {
      id: null,
      status: 'scheduled',
      group: null,
      attendanceList: [],
      financials: {
        totalRevenue: 0,
        attendeeCount: 0,
        absentCount: 0,
        exemptCount: 0,
        makeupCount: 0,
      },
    };
    localStorage.removeItem('centrly_active_session_state');
    localStorage.removeItem('centrly_active_session_id');
    this.stopLiveSessionSync();
    this.updateNavbarBadge();
    this.showToast('تم إغلاق الحصة بنجاح، يمكنك الآن بدء حصة جديدة.', 'info');
    this.renderMainContent();
  }

  resumeSessionNow() {
    if (!this.sessionState || !this.sessionState.id) {
      this.showToast('لا توجد حصة قيد التشغيل للتفعيل', 'warning');
      return;
    }
    this.sessionState.status = 'in_progress';
    this.persistSessionState();
    this.startLiveSessionSync();
    this.updateNavbarBadge();
    this.showToast('تم تفعيل الحصة بنجاح! رصد الحضور متاح الآن.', 'success');
    this.renderMainContent();
    this.focusScanInput();
  }

  // Single Student Note Modal
  openStudentNoteModal(studentCodeOrId, studentName, currentNote = '') {
    const cleanNote = (currentNote === 'حصة تعويضية' || (typeof currentNote === 'string' && currentNote.startsWith('حصة تعويضية'))) ? '' : currentNote;
    const bodyHtml = `
      <form id="studentNoteForm" onsubmit="window.centrlyApp.handleSaveStudentNote(event, '${escapeHtml(studentCodeOrId)}')">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب:</label>
          <div style="font-weight: 800; color: var(--centrly-ink); font-size: 1rem; margin-top: 0.25rem;">${escapeHtml(studentName)}</div>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">الملاحظة الأكاديمية أو السلوكية (تُرسل لولي الأمر بالواتساب):</label>
          <textarea id="modalNoteText" class="form-input" rows="3" placeholder="اكتب الملاحظة هنا حول مستوى الطالب أو أداءه في الحصة..." style="resize: vertical; font-family: inherit;">${escapeHtml(cleanNote)}</textarea>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="studentNoteForm" class="btn btn-primary" style="font-weight: 700;">حفظ الملاحظة</button>
    `;
    this.showModal(`ملاحظة الطالب: ${escapeHtml(studentName)}`, bodyHtml, footerHtml);
  }

  async handleSaveStudentNote(e, studentCodeOrId) {
    e.preventDefault();
    const note = document.getElementById('modalNoteText')?.value.trim() || '';
    const item = this.sessionState.attendanceList.find(a => a.student_id === studentCodeOrId || a.code === studentCodeOrId);
    if (item) {
      item.comment = note;
    }
    this.closeModal();
    this.renderMainContent();

    if (this.sessionState.id && item) {
      try {
        await request(`/sessions/${this.sessionState.id}/attendance`, {
          method: 'POST',
          body: {
            records: [{
              student_id: item.student_id || studentCodeOrId,
              attended: Boolean(item.attended),
              comment: note,
              homework_status: (item.homework && item.homework !== 'none') ? item.homework : null,
            }],
          },
        });
      } catch (err) {
        console.warn('Failed to sync note to backend:', err);
      }
    }
  }

  // Batch Notes Modal
  openBatchNotesModal() {
    const list = this.sessionState.attendanceList || [];
    if (list.length === 0) {
      this.showToast('لم يتم تسجيل أي حضور حتى الآن لإضافة ملاحظات.', 'info');
      return;
    }
    const bodyHtml = `
      <form id="batchNotesForm" onsubmit="window.centrlyApp.handleSaveBatchNotes(event)">
        <p style="font-size: 0.85rem; color: var(--centrly-text); margin-bottom: 1rem;">
          أضف أو عدّل ملاحظات الطلاب الحاضرين دفعة واحدة. هذه الملاحظات ستُرفق مع تقارير الواتساب:
        </p>
        <div style="max-height: 320px; overflow-y: auto; display: flex; flex-direction: column; gap: 0.75rem; padding-left: 0.25rem;">
          ${list.map((a, idx) => `
            <div style="border: 1px solid var(--centrly-line); border-radius: 8px; padding: 0.6rem 0.75rem; background: #fafbfc;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
                <span style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${idx + 1}. ${escapeHtml(a.name)} (${escapeHtml(a.code)})</span>
                <span class="badge ${a.attended ? 'badge-success' : 'badge-danger'}" style="font-size: 0.7rem;">${a.attended ? 'حاضر' : 'غائب'}</span>
              </div>
              <input type="text" class="form-input batch-note-input" data-code="${escapeHtml(a.code)}" value="${escapeHtml(a.comment || '')}" placeholder="ملاحظة خاصة بالطالب..." style="font-size: 0.85rem;">
            </div>
          `).join('')}
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="batchNotesForm" class="btn btn-primary" style="font-weight: 700;">حفظ جميع الملاحظات</button>
    `;
    this.showModal('إضافة ومراجعة ملاحظات الطلاب', bodyHtml, footerHtml);
  }

  async handleSaveBatchNotes(e) {
    e.preventDefault();
    const inputs = document.querySelectorAll('.batch-note-input');
    const recordsToSync = [];
    inputs.forEach(inp => {
      const code = inp.dataset.code;
      const note = inp.value.trim();
      const item = this.sessionState.attendanceList.find(a => a.code === code);
      if (item) {
        item.comment = note;
        if (this.sessionState.id && item.student_id) {
          recordsToSync.push({
            student_id: item.student_id,
            attended: Boolean(item.attended),
            comment: note,
            homework_status: (item.homework && item.homework !== 'none') ? item.homework : null,
          });
        }
      }
    });

    this.closeModal();
    this.renderMainContent();

    if (this.sessionState.id && recordsToSync.length > 0) {
      try {
        await request(`/sessions/${this.sessionState.id}/attendance`, {
          method: 'POST',
          body: { records: recordsToSync },
        });
      } catch (err) {
        console.warn('Failed to sync batch notes to backend:', err);
      }
    }
  }

  // Functional Add Student Modal (DEV-89: Student Phone Mandatory)
  openAddStudentModal() {
    const studentLimit = this.billingState?.students_limit || 300;
    const currentCount = (this.students || []).length;
    if (currentCount >= studentLimit) {
      const storageKey = 'centrly_quota_exceeded_timestamp';
      let reachedTimestamp = localStorage.getItem(storageKey);
      if (!reachedTimestamp) {
        reachedTimestamp = Date.now().toString();
        localStorage.setItem(storageKey, reachedTimestamp);
      }
      const elapsedDays = (Date.now() - Number(reachedTimestamp)) / (1000 * 60 * 60 * 24);
      if (elapsedDays > 3) {
        this.showQuotaBlockedModal(currentCount, studentLimit);
        return;
      }
    }

    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${g.name} (${g.center_name || 'السنتر'})</option>`).join('');
    const bodyHtml = `
      <form id="addStudentModalForm" onsubmit="window.centrlyApp.handleCreateStudent(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب رباعي *</label>
          <input type="text" id="newStudentName" class="form-input" placeholder="اسم الطالب بالكامل" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف الطالب الشخصي *</label>
          <input type="tel" id="newStudentOwnPhone" class="form-input" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم هاتف الطالب للتواصل المباشر والباركود (إلزامي)</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر (واتساب) *</label>
          <input type="tel" id="newStudentPhone" class="form-input" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم مصري مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">المجموعة الأساسية *</label>
          <select id="newStudentGroup" class="form-input" required>
            <option value="">-- اختر المجموعة --</option>
            ${groupOptions}
          </select>
        </div>
        <div id="addStudentFeedback" style="display: none; padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem; line-height: 1.4;"></div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="addStudentModalForm" id="btnSaveStudent" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('add', 16)} <span>إضافة الطالب</span>
      </button>
    `;
    this.showModal('إضافة طالب جديد', bodyHtml, footerHtml);
  }

  async handleCreateStudent(e) {
    e.preventDefault();
    const name = document.getElementById('newStudentName').value.trim();
    const parent_phone = document.getElementById('newStudentPhone').value.trim();
    const student_phone = document.getElementById('newStudentOwnPhone')?.value.trim() || '';
    const groupId = document.getElementById('newStudentGroup').value;
    const feedback = document.getElementById('addStudentFeedback');
    const saveBtn = document.getElementById('btnSaveStudent');

    const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;
    const cleanParentPhone = parent_phone.replace(/[\s\-().]/g, '');
    if (!egyptianPhoneRegex.test(cleanParentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `رقم ولي الأمر غير صحيح (${cleanParentPhone.length} أرقام). يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    const cleanStudentPhone = student_phone.replace(/[\s\-().]/g, '');
    if (!cleanStudentPhone || !egyptianPhoneRegex.test(cleanStudentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `رقم هاتف الطالب إلزامي وغير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الإضافة...';

    try {
      const res = await request('/students', {
        method: 'POST',
        body: {
          name,
          parent_phone: cleanParentPhone,
          student_phone: cleanStudentPhone,
        },
      });

      const studentId = res.student?.id;
      if (studentId && groupId) {
        await request(`/groups/${groupId}/students`, {
          method: 'POST',
          body: { student_id: studentId },
        }).catch(err => console.warn('Enrollment note:', err));
      }

      this.closeModal();
      this.showToast(`تمت إضافة الطالب (${name}) بنجاح! والكود التلقائي: ${res.student?.code || res.student?.student_code || 'تم التعيين'}`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل إضافة الطالب. تأكد من صحة رقم الهاتف والبيانات.'}`;
      } else {
        this.showToast(`فشل إضافة الطالب: ${err.message || 'تأكد من صحة البيانات'}`, 'danger');
      }
      saveBtn.disabled = false;
      saveBtn.textContent = 'إضافة الطالب';
    }
  }

  editStudent(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    if (!student) {
      this.showToast('لم يتم العثور على بيانات الطالب المحدد', 'danger');
      return;
    }

    const currentGroupId = student.group_id || (Array.isArray(student.group_ids) && student.group_ids[0]) || student.groupId || '';
    const groupOptions = (this.groups || []).map(g => `
      <option value="${g.id}" ${g.id === currentGroupId ? 'selected' : ''}>${g.name} (${g.center_name || g.centerName || 'السنتر'})</option>
    `).join('');

    const currentName = student.name || student.full_name || '';
    const currentStudentPhone = student.student_phone || student.studentPhone || '';
    const currentParentPhone = student.parent_phone || student.parentPhone || '';

    const bodyHtml = `
      <form id="editStudentModalForm" onsubmit="window.centrlyApp.saveStudentEdit(event, '${escapeHtml(studentId)}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب الرباعي *</label>
          <input type="text" id="editStudentName" class="form-input" value="${escapeHtml(currentName)}" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف الطالب الشخصي *</label>
          <input type="tel" id="editStudentOwnPhone" class="form-input" value="${escapeHtml(currentStudentPhone)}" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم هاتف الطالب للتواصل المباشر والباركود (إلزامي 11 رقماً)</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر (واتساب) *</label>
          <input type="tel" id="editStudentPhone" class="form-input" value="${escapeHtml(currentParentPhone)}" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم مصري مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">المجموعة الأساسية</label>
          <select id="editStudentGroup" class="form-input">
            <option value="" ${!currentGroupId ? 'selected' : ''}>-- عام (بدون مجموعة محددة) --</option>
            ${groupOptions}
          </select>
        </div>
        <div id="editStudentFeedback" style="display: none; padding: 0.6rem 0.8rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem; line-height: 1.4;"></div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="editStudentModalForm" id="btnUpdateStudent" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('check', 16)} <span>حفظ التعديلات</span>
      </button>
    `;

    this.showModal(`تعديل بيانات الطالب: ${escapeHtml(currentName || student.name)}`, bodyHtml, footerHtml);
  }

  async saveStudentEdit(e, studentId) {
    e.preventDefault();
    const name = document.getElementById('editStudentName')?.value.trim();
    const parent_phone = document.getElementById('editStudentPhone')?.value.trim();
    const student_phone = document.getElementById('editStudentOwnPhone')?.value.trim() || '';
    const rawGroupId = document.getElementById('editStudentGroup')?.value;
    const targetGroupId = rawGroupId && rawGroupId.trim().length > 0 ? rawGroupId.trim() : null;
    const feedback = document.getElementById('editStudentFeedback');
    const saveBtn = document.getElementById('btnUpdateStudent');

    const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;
    const cleanParentPhone = parent_phone.replace(/[\s\-().]/g, '');
    if (!egyptianPhoneRegex.test(cleanParentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `رقم ولي الأمر غير صحيح (${cleanParentPhone.length} أرقام). يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    const cleanStudentPhone = student_phone.replace(/[\s\-().]/g, '');
    if (!cleanStudentPhone || !egyptianPhoneRegex.test(cleanStudentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `رقم هاتف الطالب إلزامي وغير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';
    }

    try {
      const updateRes = await request(`/students/${studentId}`, {
        method: 'PUT',
        body: {
          name,
          parent_phone: cleanParentPhone,
          student_phone: cleanStudentPhone,
          group_id: targetGroupId,
        },
      });

      const updatedStudent = updateRes?.student || updateRes;
      const matchedGroup = (this.groups || []).find(g => g.id === targetGroupId);
      const groupTitle = matchedGroup ? matchedGroup.name : (targetGroupId ? 'مجموعة محددة' : 'مجموعة عامة');

      // Update in-memory state and cache immediately
      if (Array.isArray(this.students)) {
        const studentIndex = this.students.findIndex(s => s.id === studentId);
        if (studentIndex !== -1) {
          this.students[studentIndex] = {
            ...this.students[studentIndex],
            ...(updatedStudent && typeof updatedStudent === 'object' ? updatedStudent : {}),
            name,
            parent_phone: cleanParentPhone,
            parentPhone: cleanParentPhone,
            student_phone: cleanStudentPhone,
            studentPhone: cleanStudentPhone,
            group_id: targetGroupId,
            groupId: targetGroupId,
            group_ids: targetGroupId ? [targetGroupId] : [],
            group_name: groupTitle,
            groupName: groupTitle,
          };
          this.saveCache('students', this.students);
        }
      }

      this.closeModal();
      this.showToast(`تم تحديث بيانات الطالب (${name}) بنجاح!`, 'success');

      // Re-fetch route data with cache-busting to guarantee server synchronization
      try {
        if (this.currentRoute === 'students') {
          const freshRes = await request(`/students?_t=${Date.now()}`);
          if (freshRes) {
            const fetched = Array.isArray(freshRes) ? freshRes : (freshRes.students || []);
            if (fetched.length > 0) {
              this.students = fetched;
              this.saveCache('students', this.students);
            }
          }
        } else {
          await this.loadRouteData(this.currentRoute);
        }
      } catch (rErr) {
        console.warn('Background sync note:', rErr);
      }

      this.renderMainContent();
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل تحديث بيانات الطالب.'}`;
      } else {
        this.showToast(`فشل تحديث بيانات الطالب: ${err.message || 'خطأ في البيانات'}`, 'danger');
      }
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ التعديلات';
      }
    }
  }

  confirmDeleteStudent(studentId, studentName) {
    this.showConfirmModal({
      title: 'حذف الطالب نهائياً',
      message: `هل أنت متأكد من رغبتك في حذف الطالب "${studentName}"؟ سيتم حذف جميع بياناته وسجلات حضوره بالكامل.`,
      confirmText: 'حذف الطالب',
      cancelText: 'إلغاء',
      isDanger: true,
      onConfirm: async () => {
        try {
          await request(`/students/${studentId}`, { method: 'DELETE' });
          this.showToast(`تم حذف الطالب (${studentName}) بنجاح`, 'success');
          await this.loadRouteData(this.currentRoute);
        } catch (err) {
          this.showToast(`فشل حذف الطالب: ${err.message || 'خطأ في الخادم'}`, 'danger');
        }
      },
    });
  }

  // Functional Create Group Modal with 3 Billing Options & Schedule Separation (DEV-89)
  openCreateGroupModal() {
    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const teacherOptions = (this.centerTeachers || []).map(t => `<option value="${escapeHtml(t.id)}">${escapeHtml(t.name)} (${(t.subjects || []).join('، ') || 'عام'})</option>`).join('');
    const roomOptions = (this.centerRooms || []).map(r => `<option value="${escapeHtml(r.id)}">${escapeHtml(r.name)} (سعة ${r.capacity || 0} طالب)</option>`).join('');

    const bodyHtml = `
      <form id="createGroupModalForm" onsubmit="window.centrlyApp.handleCreateGroup(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المجموعة *</label>
          <input type="text" id="newGroupName" class="form-input" placeholder="اسم المجموعة الدراسية" required>
        </div>

        ${isCenterOwner ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">المدرس المسؤول *</label>
              <select id="newGroupTeacherId" class="form-input" required>
                <option value="">-- اختر المدرس --</option>
                ${teacherOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">القاعة المخصصة *</label>
              <select id="newGroupRoomId" class="form-input" required>
                <option value="">-- اختر القاعة --</option>
                ${roomOptions}
              </select>
            </div>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">مكان الحصة / السنتر</label>
              <input type="text" id="newGroupCenter" class="form-input" placeholder="اسم السنتر أو المقر">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">القاعة المخصصة</label>
              <input type="text" id="newGroupRoomName" class="form-input" placeholder="اسم أو رقم القاعة">
            </div>
          </div>
        `}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">يوم الحصة الأسبوعي *</label>
            <select id="newGroupDayOfWeek" class="form-input" required>
              <option value="السبت">السبت</option>
              <option value="الأحد">الأحد</option>
              <option value="الإثنين">الإثنين</option>
              <option value="الثلاثاء">الثلاثاء</option>
              <option value="الأربعاء">الأربعاء</option>
              <option value="الخميس">الخميس</option>
              <option value="الجمعة">الجمعة</option>
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">توقيت الحصة *</label>
            <input type="text" id="newGroupSessionTime" class="form-input" placeholder="04:00 م - 06:00 م" required value="04:00 م - 06:00 م">
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م) *</label>
            <input type="number" id="newGroupPrice" class="form-input" min="0" step="5" placeholder="سعر الحصة" required>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">تكرار الحصص أسبوعياً *</label>
            <select id="newGroupSessionsPerWeek" class="form-input">
              <option value="1" selected>حصة واحدة بالأسبوع (4 حصص شهرياً)</option>
              <option value="2">حصتان بالأسبوع (8 حصص شهرياً)</option>
              <option value="3">3 حصص بالأسبوع (12 حصة شهرياً)</option>
              <option value="4">4 حصص بالأسبوع (16 حصة شهرياً)</option>
              <option value="5">5 حصص بالأسبوع (20 حصة شهرياً)</option>
            </select>
          </div>
        </div>
        
        <!-- 3 Billing Models -->
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">نظام محاسبة السنتر *</label>
          <select id="newGroupBillingModel" class="form-input" onchange="window.centrlyApp.onBillingModelChange(this.value)">
            <option value="percentage">نسبة مئوية للسنتر على كل طالب (%)</option>
            <option value="fixed_per_student">أجر ثابت للسنتر على كل طالب (ج.م)</option>
            <option value="fixed_rent">إيجار قاعة ثابت للحصة بالكامل (ج.م)</option>
          </select>
        </div>

        <!-- Conditional Input 1: Percentage -->
        <div id="billingPercentageGroup" class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">نسبة السنتر على الطالب (%) *</label>
          <input type="number" id="newGroupCenterCut" class="form-input" min="0" max="100" value="20" placeholder="20">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">يحصل السنتر على هذه النسبة من كل تذكرة حضور والباقي للمدرس</small>
        </div>

        <!-- Conditional Input 2: Fixed per student -->
        <div id="billingFixedPerStudentGroup" class="form-group" style="margin-bottom: 0.85rem; display: none;">
          <label class="form-label" style="font-weight: 700;">قيمة أجر السنتر لكل طالب (ج.م) *</label>
          <input type="number" id="newGroupFixedPerStudent" class="form-input" min="0" step="5" value="25" placeholder="25">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">قيمة ثابتة يدفعها الطالب للسنتر عن كل حصة يحضرها</small>
        </div>

        <!-- Conditional Input 3: Fixed room rent -->
        <div id="billingFixedRentGroup" class="form-group" style="margin-bottom: 0.85rem; display: none;">
          <label class="form-label" style="font-weight: 700;">إيجار القاعة الثابت للحصة (ج.م) *</label>
          <input type="number" id="newGroupFixedRent" class="form-input" min="0" step="50" value="300" placeholder="300">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">مبلغ إيجار القاعة للحصة الواحدة بغض النظر عن عدد الطلاب</small>
        </div>

        <div id="createGroupFeedback" style="display: none; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem;"></div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="createGroupModalForm" id="btnSaveGroup" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('add', 16)} <span>إنشاء المجموعة</span>
      </button>
    `;
    this.showModal('إنشاء مجموعة جديدة', bodyHtml, footerHtml);
  }

  onBillingModelChange(model) {
    const pGroup = document.getElementById('billingPercentageGroup');
    const fStudentGroup = document.getElementById('billingFixedPerStudentGroup');
    const fRentGroup = document.getElementById('billingFixedRentGroup');

    if (pGroup) pGroup.style.display = model === 'percentage' ? 'block' : 'none';
    if (fStudentGroup) fStudentGroup.style.display = model === 'fixed_per_student' ? 'block' : 'none';
    if (fRentGroup) fRentGroup.style.display = model === 'fixed_rent' ? 'block' : 'none';
  }

  openEditGroupModal(groupId) {
    const group = (this.groups || []).find(g => g.id === groupId);
    if (!group) {
      this.showToast('لم يتم العثور على بيانات المجموعة المحددة', 'danger');
      return;
    }

    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const teacherOptions = (this.centerTeachers || []).map(t => `
      <option value="${escapeHtml(t.id)}" ${t.id === group.teacher_id ? 'selected' : ''}>
        ${escapeHtml(t.name)} (${(t.subjects || []).join('، ') || 'عام'})
      </option>
    `).join('');
    const roomOptions = (this.centerRooms || []).map(r => `
      <option value="${escapeHtml(r.id)}" ${r.id === group.room_id ? 'selected' : ''}>
        ${escapeHtml(r.name)} (سعة ${r.capacity || 0} طالب)
      </option>
    `).join('');

    const days = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
    const currentDay = group.day_of_week || 'السبت';
    const dayOptions = days.map(d => `<option value="${d}" ${d === currentDay ? 'selected' : ''}>${d}</option>`).join('');

    const currentModel = group.billing_model || 'percentage';

    const bodyHtml = `
      <form id="editGroupModalForm" onsubmit="window.centrlyApp.saveGroupEdit(event, '${escapeHtml(groupId)}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المجموعة *</label>
          <input type="text" id="editGroupName" class="form-input" value="${escapeHtml(group.name || '')}" required>
        </div>

        ${isCenterOwner ? `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">المدرس المسؤول *</label>
              <select id="editGroupTeacherId" class="form-input" required>
                <option value="">-- اختر المدرس --</option>
                ${teacherOptions}
              </select>
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">القاعة المخصصة *</label>
              <select id="editGroupRoomId" class="form-input" required>
                <option value="">-- اختر القاعة --</option>
                ${roomOptions}
              </select>
            </div>
          </div>
        ` : `
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">مكان الحصة / السنتر</label>
              <input type="text" id="editGroupCenter" class="form-input" value="${escapeHtml(group.center_name || group.centerName || '')}" placeholder="اسم السنتر أو المقر">
            </div>
            <div class="form-group">
              <label class="form-label" style="font-weight: 700;">القاعة المخصصة</label>
              <input type="text" id="editGroupRoomName" class="form-input" value="${escapeHtml(group.room || group.room_name || '')}" placeholder="اسم أو رقم القاعة">
            </div>
          </div>
        `}

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">يوم الحصة الأسبوعي *</label>
            <select id="editGroupDayOfWeek" class="form-input" required>
              ${dayOptions}
            </select>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">توقيت الحصة *</label>
            <input type="text" id="editGroupSessionTime" class="form-input" value="${escapeHtml(group.session_time || '04:00 م - 06:00 م')}" required>
          </div>
        </div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م) *</label>
            <input type="number" id="editGroupPrice" class="form-input" min="0" step="5" value="${group.price ?? group.session_price ?? 80}" required>
          </div>
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">تكرار الحصص أسبوعياً *</label>
            <select id="editGroupSessionsPerWeek" class="form-input">
              <option value="1" ${(group.sessions_per_week || 1) == 1 ? 'selected' : ''}>حصة واحدة بالأسبوع (4 حصص شهرياً)</option>
              <option value="2" ${(group.sessions_per_week) == 2 ? 'selected' : ''}>حصتان بالأسبوع (8 حصص شهرياً)</option>
              <option value="3" ${(group.sessions_per_week) == 3 ? 'selected' : ''}>3 حصص بالأسبوع (12 حصة شهرياً)</option>
              <option value="4" ${(group.sessions_per_week) == 4 ? 'selected' : ''}>4 حصص بالأسبوع (16 حصة شهرياً)</option>
              <option value="5" ${(group.sessions_per_week) == 5 ? 'selected' : ''}>5 حصص بالأسبوع (20 حصة شهرياً)</option>
            </select>
          </div>
        </div>
        
        <!-- 3 Billing Models -->
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">نظام محاسبة السنتر *</label>
          <select id="editGroupBillingModel" class="form-input" onchange="window.centrlyApp.onEditBillingModelChange(this.value)">
            <option value="percentage" ${currentModel === 'percentage' ? 'selected' : ''}>نسبة مئوية للسنتر على كل طالب (%)</option>
            <option value="fixed_per_student" ${currentModel === 'fixed_per_student' ? 'selected' : ''}>أجر ثابت للسنتر على كل طالب (ج.م)</option>
            <option value="fixed_rent" ${currentModel === 'fixed_rent' ? 'selected' : ''}>إيجار قاعة ثابت للحصة بالكامل (ج.م)</option>
          </select>
        </div>

        <!-- Conditional Input 1: Percentage -->
        <div id="editBillingPercentageGroup" class="form-group" style="margin-bottom: 0.85rem; display: ${currentModel === 'percentage' ? 'block' : 'none'};">
          <label class="form-label" style="font-weight: 700;">نسبة السنتر على الطالب (%) *</label>
          <input type="number" id="editGroupCenterCut" class="form-input" min="0" max="100" value="${group.center_cut_percentage ?? 20}">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">يحصل السنتر على هذه النسبة من كل تذكرة حضور والباقي للمدرس</small>
        </div>

        <!-- Conditional Input 2: Fixed per student -->
        <div id="editBillingFixedPerStudentGroup" class="form-group" style="margin-bottom: 0.85rem; display: ${currentModel === 'fixed_per_student' ? 'block' : 'none'};">
          <label class="form-label" style="font-weight: 700;">قيمة أجر السنتر لكل طالب (ج.م) *</label>
          <input type="number" id="editGroupFixedPerStudent" class="form-input" min="0" step="5" value="${group.fixed_per_student_amount ?? 25}">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">قيمة ثابتة يدفعها الطالب للسنتر عن كل حصة يحضرها</small>
        </div>

        <!-- Conditional Input 3: Fixed room rent -->
        <div id="editBillingFixedRentGroup" class="form-group" style="margin-bottom: 0.85rem; display: ${currentModel === 'fixed_rent' ? 'block' : 'none'};">
          <label class="form-label" style="font-weight: 700;">إيجار القاعة الثابت للحصة (ج.م) *</label>
          <input type="number" id="editGroupFixedRent" class="form-input" min="0" step="50" value="${group.fixed_rent_amount ?? 300}">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">مبلغ إيجار القاعة للحصة الواحدة بغض النظر عن عدد الطلاب</small>
        </div>

        <div id="editGroupFeedback" style="display: none; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem;"></div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="editGroupModalForm" id="btnUpdateGroup" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('check', 16)} <span>حفظ التعديلات</span>
      </button>
    `;

    this.showModal(`تعديل بيانات المجموعة: ${escapeHtml(group.name)}`, bodyHtml, footerHtml);
  }

  onEditBillingModelChange(model) {
    const pGroup = document.getElementById('editBillingPercentageGroup');
    const fStudentGroup = document.getElementById('editBillingFixedPerStudentGroup');
    const fRentGroup = document.getElementById('editBillingFixedRentGroup');

    if (pGroup) pGroup.style.display = model === 'percentage' ? 'block' : 'none';
    if (fStudentGroup) fStudentGroup.style.display = model === 'fixed_per_student' ? 'block' : 'none';
    if (fRentGroup) fRentGroup.style.display = model === 'fixed_rent' ? 'block' : 'none';
  }

  async handleCreateGroup(e) {
    e.preventDefault();
    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const name = document.getElementById('newGroupName').value.trim();
    const teacher_id = isCenterOwner ? (document.getElementById('newGroupTeacherId')?.value || null) : null;
    const room_id = isCenterOwner ? (document.getElementById('newGroupRoomId')?.value || null) : null;
    let center_name = undefined;
    let room_name = undefined;

    if (isCenterOwner && room_id) {
      const matchedRoom = (this.centerRooms || []).find(r => r.id === room_id);
      center_name = matchedRoom ? matchedRoom.name : 'قاعة السنتر';
      room_name = matchedRoom ? matchedRoom.name : undefined;
    } else {
      center_name = document.getElementById('newGroupCenter')?.value.trim() || undefined;
      room_name = document.getElementById('newGroupRoomName')?.value.trim() || undefined;
    }

    const day_of_week = document.getElementById('newGroupDayOfWeek')?.value || 'السبت';
    const session_time = document.getElementById('newGroupSessionTime')?.value.trim() || '04:00 م - 06:00 م';
    const price = Number(document.getElementById('newGroupPrice').value) || 0;
    const sessions_per_week = Number(document.getElementById('newGroupSessionsPerWeek')?.value) || 1;
    const billing_model = document.getElementById('newGroupBillingModel').value;

    let center_cut_percentage = 0;
    let fixed_per_student_amount = null;
    let fixed_rent_amount = null;

    if (billing_model === 'percentage') {
      center_cut_percentage = Number(document.getElementById('newGroupCenterCut')?.value) || 20;
    } else if (billing_model === 'fixed_per_student') {
      fixed_per_student_amount = Number(document.getElementById('newGroupFixedPerStudent')?.value) || 20;
    } else if (billing_model === 'fixed_rent') {
      fixed_rent_amount = Number(document.getElementById('newGroupFixedRent')?.value) || 250;
    }

    const feedback = document.getElementById('createGroupFeedback');
    const saveBtn = document.getElementById('btnSaveGroup');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الإنشاء...';
    }

    try {
      await request('/groups', {
        method: 'POST',
        body: {
          name,
          center_name,
          teacher_id,
          room_id,
          room: room_name,
          room_name: room_name,
          price,
          session_price: price,
          sessions_per_week,
          billing_model,
          center_cut_percentage,
          fixed_per_student_amount,
          fixed_rent_amount,
          day_of_week,
          session_time,
          schedule: `${day_of_week} • ${session_time}`,
        },
      });

      this.closeModal();
      this.showToast(`تم إنشاء المجموعة (${name}) بنجاح!`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل إنشاء المجموعة.'}`;
      } else {
        this.showToast(`فشل إنشاء المجموعة: ${err.message || 'خطأ في البيانات'}`, 'danger');
      }
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'إنشاء المجموعة';
      }
    }
  }

  async saveGroupEdit(e, groupId) {
    e.preventDefault();
    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const name = document.getElementById('editGroupName')?.value.trim();
    const teacher_id = isCenterOwner ? (document.getElementById('editGroupTeacherId')?.value || null) : null;
    const room_id = isCenterOwner ? (document.getElementById('editGroupRoomId')?.value || null) : null;
    let center_name = undefined;
    let room_name = undefined;

    if (isCenterOwner && room_id) {
      const matchedRoom = (this.centerRooms || []).find(r => r.id === room_id);
      center_name = matchedRoom ? matchedRoom.name : 'قاعة السنتر';
      room_name = matchedRoom ? matchedRoom.name : undefined;
    } else {
      center_name = document.getElementById('editGroupCenter')?.value.trim() || undefined;
      room_name = document.getElementById('editGroupRoomName')?.value.trim() || undefined;
    }

    const day_of_week = document.getElementById('editGroupDayOfWeek')?.value || 'السبت';
    const session_time = document.getElementById('editGroupSessionTime')?.value.trim() || '04:00 م - 06:00 م';
    const price = Number(document.getElementById('editGroupPrice')?.value) || 0;
    const sessions_per_week = Number(document.getElementById('editGroupSessionsPerWeek')?.value) || 1;
    const billing_model = document.getElementById('editGroupBillingModel')?.value || 'percentage';

    let center_cut_percentage = 0;
    let fixed_per_student_amount = null;
    let fixed_rent_amount = null;

    if (billing_model === 'percentage') {
      center_cut_percentage = Number(document.getElementById('editGroupCenterCut')?.value) || 20;
    } else if (billing_model === 'fixed_per_student') {
      fixed_per_student_amount = Number(document.getElementById('editGroupFixedPerStudent')?.value) || 20;
    } else if (billing_model === 'fixed_rent') {
      fixed_rent_amount = Number(document.getElementById('editGroupFixedRent')?.value) || 250;
    }

    const feedback = document.getElementById('editGroupFeedback');
    const saveBtn = document.getElementById('btnUpdateGroup');

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';
    }

    try {
      await request(`/groups/${groupId}`, {
        method: 'PUT',
        body: {
          name,
          center_name,
          teacher_id,
          room_id,
          room: room_name,
          room_name: room_name,
          price,
          session_price: price,
          sessions_per_week,
          billing_model,
          center_cut_percentage,
          fixed_per_student_amount,
          fixed_rent_amount,
          day_of_week,
          session_time,
          schedule: `${day_of_week} • ${session_time}`,
        },
      });

      // Update local cache
      const cached = (this.groups || []).find(g => g.id === groupId);
      if (cached) {
        cached.name = name;
        cached.center_name = center_name;
        cached.room = room_name;
        cached.room_name = room_name;
        cached.price = price;
        cached.sessions_per_week = sessions_per_week;
        cached.day_of_week = day_of_week;
        cached.session_time = session_time;
      }

      this.closeModal();
      this.showToast(`تم تحديث بيانات المجموعة (${name}) بنجاح!`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل تحديث بيانات المجموعة.'}`;
      } else {
        this.showToast(`فشل تحديث المجموعة: ${err.message || 'خطأ في البيانات'}`, 'danger');
      }
      if (saveBtn) {
        saveBtn.disabled = false;
        saveBtn.textContent = 'حفظ التعديلات';
      }
    }
  }

  confirmDeleteGroup(groupId, groupName) {
    this.showConfirmModal({
      title: 'حذف المجموعة الدراسية',
      message: `هل أنت متأكد من رغبتك في حذف المجموعة "${groupName}" نهائياً؟ سيتم إلغاء قيد الطلاب من المجموعة.`,
      confirmText: 'حذف المجموعة',
      cancelText: 'إلغاء',
      isDanger: true,
      onConfirm: async () => {
        try {
          await request(`/groups/${groupId}`, { method: 'DELETE' });
          this.showToast(`تم حذف المجموعة (${groupName}) بنجاح`, 'success');
          await this.loadRouteData(this.currentRoute);
        } catch (err) {
          this.showToast(`فشل حذف المجموعة: ${err.message || 'خطأ في الخادم'}`, 'danger');
        }
      },
    });
  }

  previewSpecificCard(name, code, group, phone) {
    const teacherName = this.user?.name || (this.user?.account_type === 'center' ? 'سنتر تعليمي' : 'المدرس');
    const initial = name ? name.charAt(0) : 'ط';
    const bodyHtml = `
      <div style="display: flex; justify-content: center; padding: 0.5rem 0;">
        <div style="width: 100%; max-width: 380px; border: 2px solid #0f172a; border-radius: 14px; padding: 16px 18px; background: #fff; box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 8px; margin-bottom: 12px;">
            <div>
              <div style="font-size: 14px; font-weight: 800; color: #1e3a8a;">سنترلي | Centrly</div>
              <div style="font-size: 10px; color: #475569;">كارت حضور ذكي</div>
            </div>
            <div style="text-align: left;">
              <div style="font-size: 11px; font-weight: 700; color: #0f172a;">${escapeHtml(teacherName)}</div>
              <div style="font-size: 10px; color: #475569;">${escapeHtml(group || 'المجموعة')}</div>
            </div>
          </div>
          <div style="display: flex; align-items: center; gap: 12px; margin-bottom: 14px;">
            <div style="width: 46px; height: 46px; border-radius: 8px; background: #f1f5f9; border: 1.5px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: 800; color: #1e3a8a;">
              ${escapeHtml(initial)}
            </div>
            <div>
              <div style="font-size: 14px; font-weight: 800; color: #0f172a;">${escapeHtml(name)}</div>
              <div style="font-size: 10px; color: #475569; margin-top: 2px;">هاتف: ${escapeHtml(phone || '—')}</div>
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 8px; padding: 8px 12px; border: 1px solid #e2e8f0;">
            <div style="display: flex; gap: 2px; height: 24px; align-items: center;">
              <span style="background: #000; width:2px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:1px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:3px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:1px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:2px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:4px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:1px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:3px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:2px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:1px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:2px; height:100%; display:inline-block;"></span>
              <span style="background: #000; width:3px; height:100%; display:inline-block;"></span>
            </div>
            <div style="text-align: left;">
              <div style="font-family: monospace; font-size: 13px; font-weight: 900; letter-spacing: 1px; color: #0f172a;">${escapeHtml(code)}</div>
              <div style="font-size: 8px; color: #64748b;">Scan to Attend</div>
            </div>
          </div>
        </div>
      </div>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>
      <button type="button" class="btn btn-primary" onclick="window.centrlyApp.printSingleCard('${escapeHtml(name)}', '${escapeHtml(code)}', '${escapeHtml(group)}', '${escapeHtml(phone)}')">
        ${getIcon('printer', 16)} <span>طباعة الكارت الآن</span>
      </button>
    `;
    this.showModal(`معاينة كارت الطالب: ${name}`, bodyHtml, footerHtml);
  }

  printSingleCard(name, code, group, phone) {
    const teacherName = this.user?.name || (this.user?.account_type === 'center' ? 'سنتر تعليمي' : 'المدرس');
    const printHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>طباعة كارت - ${escapeHtml(name)}</title>
        <style>
          @page { size: auto; margin: 10mm; }
          body { font-family: 'Cairo', 'Changa', sans-serif; margin: 0; padding: 20px; background: #fff; color: #000; display: flex; justify-content: center; }
          .card {
            border: 2px solid #0f172a; border-radius: 12px; padding: 14px 16px;
            width: 320px; height: 190px; box-sizing: border-box; display: flex; flex-direction: column;
            justify-content: space-between; page-break-inside: avoid; background: #fff;
          }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; }
          .logo { font-size: 14px; font-weight: 800; color: #1e3a8a; }
          .sub { font-size: 10px; color: #475569; }
          .body { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
          .avatar { width: 44px; height: 44px; border-radius: 8px; background: #f1f5f9; border: 1.5px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; }
          .name { font-size: 14px; font-weight: 800; color: #0f172a; }
          .meta { font-size: 10px; color: #475569; margin-top: 3px; }
          .footer { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 6px; padding: 6px 10px; border: 1px solid #e2e8f0; }
          .barcode-bars { display: flex; gap: 2px; height: 22px; align-items: center; }
          .barcode-bars span { background: #000; height: 100%; display: inline-block; }
          .code { font-family: monospace; font-size: 13px; font-weight: 900; letter-spacing: 1px; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="header">
            <div>
              <div class="logo">سنترلي | Centrly</div>
              <div class="sub">كارت حضور ذكي</div>
            </div>
            <div style="text-align: left;">
              <div style="font-size: 11px; font-weight: 700;">${escapeHtml(teacherName)}</div>
              <div class="sub">${escapeHtml(group || 'المجموعة')}</div>
            </div>
          </div>
          <div class="body">
            <div class="avatar">${name?.charAt(0) || 'ط'}</div>
            <div>
              <div class="name">${escapeHtml(name)}</div>
              <div class="meta">هاتف: ${escapeHtml(phone || '—')}</div>
            </div>
          </div>
          <div class="footer">
            <div class="barcode-bars">
              <span style="width:2px;"></span><span style="width:1px;"></span><span style="width:3px;"></span>
              <span style="width:1px;"></span><span style="width:2px;"></span><span style="width:4px;"></span>
              <span style="width:1px;"></span><span style="width:3px;"></span><span style="width:2px;"></span>
              <span style="width:1px;"></span><span style="width:2px;"></span><span style="width:3px;"></span>
            </div>
            <div style="text-align: left;">
              <div class="code">${escapeHtml(code)}</div>
              <div style="font-size: 8px; color: #64748b;">Scan to Attend</div>
            </div>
          </div>
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;
    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printHtml);
      printWin.document.close();
    } else {
      this.showToast('يرجى السماح بالنوافذ المنبثقة (Popups) لإتمام الطباعة', 'danger');
    }
  }

  filterCardsTable() {
    const q = document.getElementById('cardSearchInput')?.value?.toLowerCase().trim() || '';
    const rows = document.querySelectorAll('#cardsTable tbody tr');
    rows.forEach(r => {
      const text = r.textContent?.toLowerCase() || '';
      r.style.display = text.includes(q) ? '' : 'none';
    });
    this.updateSelectedCardsCount();
  }

  filterCardsByGroup(groupId) {
    const rows = document.querySelectorAll('#cardsTable tbody tr');
    rows.forEach(r => {
      const rowGroupId = r.getAttribute('data-group-id');
      r.style.display = (!groupId || rowGroupId === groupId) ? '' : 'none';
    });
    this.updateSelectedCardsCount();
  }

  toggleMasterCardCheckbox(checked) {
    const visibleChecks = document.querySelectorAll('#cardsTable tbody tr:not([style*="display: none"]) .student-card-check');
    visibleChecks.forEach(c => c.checked = checked);
    this.updateSelectedCardsCount();
  }

  selectAllCards(select) {
    const checks = document.querySelectorAll('.student-card-check');
    checks.forEach(c => c.checked = select);
    const master = document.getElementById('cardMasterCheckbox');
    if (master) master.checked = select;
    this.updateSelectedCardsCount();
  }

  updateSelectedCardsCount() {
    const checked = document.querySelectorAll('.student-card-check:checked');
    const badge = document.getElementById('selectedCardsCountBadge');
    if (badge) badge.textContent = `تم تحديد: ${checked.length} طالب`;
  }

  printSelectedCards() {
    const checked = Array.from(document.querySelectorAll('.student-card-check:checked'));
    if (checked.length === 0) {
      this.showToast('يرجى تحديد طالب واحد على الأقل لطباعة الكارت', 'info');
      return;
    }

    const studentsToPrint = checked.map(c => ({
      id: c.value,
      name: c.getAttribute('data-name'),
      code: c.getAttribute('data-code'),
      group: c.getAttribute('data-group'),
      phone: c.getAttribute('data-phone'),
    }));

    const teacherName = this.user?.name || (this.user?.account_type === 'center' ? 'سنتر تعليمي' : 'أ. محمد خالد');

    const printHtml = `
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>طباعة كروت الطلاب - Centrly</title>
        <style>
          @page { size: A4 portrait; margin: 10mm; }
          body { font-family: 'Cairo', 'Changa', sans-serif; margin: 0; padding: 0; background: #fff; color: #000; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; page-break-inside: avoid; }
          .card {
            border: 2px solid #0f172a; border-radius: 12px; padding: 12px 14px;
            height: 190px; box-sizing: border-box; display: flex; flex-direction: column;
            justify-content: space-between; page-break-inside: avoid; position: relative;
            background: #fff;
          }
          .header { display: flex; justify-content: space-between; align-items: center; border-bottom: 1.5px solid #e2e8f0; padding-bottom: 6px; }
          .logo { font-size: 14px; font-weight: 800; color: #1e3a8a; }
          .sub { font-size: 10px; color: #475569; }
          .body { display: flex; align-items: center; gap: 10px; margin: 8px 0; }
          .avatar { width: 44px; height: 44px; border-radius: 8px; background: #f1f5f9; border: 1.5px solid #cbd5e1; display: flex; align-items: center; justify-content: center; font-size: 18px; font-weight: bold; }
          .name { font-size: 14px; font-weight: 800; color: #0f172a; }
          .meta { font-size: 10px; color: #475569; margin-top: 3px; }
          .footer { display: flex; justify-content: space-between; align-items: center; background: #f8fafc; border-radius: 6px; padding: 6px 10px; border: 1px solid #e2e8f0; }
          .barcode-bars { display: flex; gap: 2px; height: 22px; align-items: center; }
          .barcode-bars span { background: #000; height: 100%; }
          .code { font-family: monospace; font-size: 13px; font-weight: 900; letter-spacing: 1px; color: #0f172a; }
        </style>
      </head>
      <body>
        <div class="grid">
          ${studentsToPrint.map(s => `
            <div class="card">
              <div class="header">
                <div>
                  <div class="logo">سنترلي | Centrly</div>
                  <div class="sub">كارت حضور ذكي</div>
                </div>
                <div style="text-align: left;">
                  <div style="font-size: 11px; font-weight: 700;">${escapeHtml(teacherName)}</div>
                  <div class="sub">${escapeHtml(s.group)}</div>
                </div>
              </div>
              <div class="body">
                <div class="avatar">${s.name?.charAt(0) || 'ط'}</div>
                <div>
                  <div class="name">${escapeHtml(s.name)}</div>
                  <div class="meta">هاتف: ${escapeHtml(s.phone || '—')}</div>
                </div>
              </div>
              <div class="footer">
                <div class="barcode-bars">
                  <span style="width:2px;"></span><span style="width:1px;"></span><span style="width:3px;"></span>
                  <span style="width:1px;"></span><span style="width:2px;"></span><span style="width:4px;"></span>
                  <span style="width:1px;"></span><span style="width:3px;"></span><span style="width:2px;"></span>
                  <span style="width:1px;"></span><span style="width:2px;"></span><span style="width:3px;"></span>
                </div>
                <div style="text-align: left;">
                  <div class="code">${escapeHtml(s.code)}</div>
                  <div style="font-size: 8px; color: #64748b;">Scan to Attend</div>
                </div>
              </div>
            </div>
          `).join('')}
        </div>
        <script>
          window.onload = function() { window.print(); };
        </script>
      </body>
      </html>
    `;

    const printWin = window.open('', '_blank');
    if (printWin) {
      printWin.document.write(printHtml);
      printWin.document.close();
    } else {
      this.showToast('يرجى السماح بالنوافذ المنبثقة (Popups) لإتمام الطباعة', 'danger');
    }
  }

  orderSelectedCardsViaWhatsApp() {
    this.openCardsWhatsAppDispatchModal();
  }

  openCardsWhatsAppDispatchModal() {
    const checked = Array.from(document.querySelectorAll('.student-card-check:checked'));
    const targetStudents = checked.length > 0
      ? checked.map(c => ({
          name: c.getAttribute('data-name'),
          code: c.getAttribute('data-code'),
          group: c.getAttribute('data-group'),
          phone: c.getAttribute('data-phone'),
          parent_phone: c.getAttribute('data-parent-phone') || '',
        }))
      : (this.students || []).map(s => ({
          name: s.name,
          code: s.code || s.student_code || '—',
          group: s.group_name || 'عامة',
          phone: s.student_phone || '',
          parent_phone: s.parent_phone || '',
        }));

    if (targetStudents.length === 0) {
      this.showToast('يرجى تحديد طالب واحد على الأقل أو إضافة طلاب لطلب كروت بلاستيكية', 'info');
      return;
    }

    const userTitle = this.user?.name || (this.user?.account_type === 'center' ? 'سنتر تعليمي' : 'مدرس المادة');
    this._pendingCardsStudents = targetStudents;

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1.25rem;" dir="rtl">
        <div style="background: #f0fdf4; border: 1px solid #bbf7d0; border-radius: 8px; padding: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem; color: #166534; font-weight: 800; font-size: 1rem;">
            ${getIcon('whatsapp', 20, '#166534')}
            <span>تجهيز وإرسال كشف كروت الطلاب</span>
          </div>
          <p style="font-size: 0.85rem; color: #15803d; margin: 0.4rem 0 0 0; line-height: 1.6;">
            تم توليد كشف رقمي منظم يحتوي على بيانات وأكواد وباركود الطلاب المحددين (${targetStudents.length} طالب) كملف جدول إلكتروني بدلاً من إرسال نصوص متفرقة.
          </p>
        </div>

        <div style="background: #f8fafc; border: 1px solid var(--centrly-line); border-radius: 8px; padding: 1rem; font-size: 0.85rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
            <span style="color: var(--centrly-text);">جهة الإصدار:</span>
            <strong>${escapeHtml(userTitle)}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.4rem;">
            <span style="color: var(--centrly-text);">عدد الطلاب في الكشف:</span>
            <strong style="color: var(--centrly-blue-800);">${targetStudents.length} طالب</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--centrly-text);">صيغة الملف:</span>
            <strong style="font-family: monospace;">Excel / CSV جدول منظم</strong>
          </div>
        </div>

        <div style="display: flex; flex-direction: column; gap: 0.75rem;">
          <button 
            type="button"
            class="btn btn-primary" 
            style="background: #25d366; border-color: #25d366; font-weight: 800; padding: 0.75rem; display: flex; align-items: center; justify-content: center; gap: 0.5rem; box-shadow: 0 4px 12px rgba(37,211,102,0.25);"
            onclick="window.centrlyApp.dispatchCardsFileDirect()"
          >
            ${getIcon('whatsapp', 18, '#ffffff')}
            <span>إرسال الملف مباشرة عبر واتساب المنظومة</span>
          </button>

          <button 
            type="button"
            class="btn btn-secondary" 
            style="padding: 0.7rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.5rem;"
            onclick="window.centrlyApp.downloadCardsCsvFile()"
          >
            ${getIcon('download', 18, 'var(--centrly-blue-700)')}
            <span>تحميل ملف كروت الطلاب (Excel / CSV)</span>
          </button>

          <button 
            type="button"
            class="btn btn-secondary" 
            style="padding: 0.7rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem; color: #15803d;"
            onclick="window.centrlyApp.openCardsWhatsAppChat()"
          >
            ${getIcon('chat', 18, '#15803d')}
            <span>فتح محادثة واتساب الإدارة (01123671177)</span>
          </button>
        </div>
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>
    `;

    this.showModal('إرسال كشف كروت الطلاب عبر واتساب', bodyHtml, footerHtml);
  }

  downloadCardsCsvFile() {
    const students = this._pendingCardsStudents || this.students || [];
    if (students.length === 0) {
      this.showToast('لا توجد بيانات طلاب لتحميلها', 'warning');
      return;
    }
    const header = ['كود الطالب', 'اسم الطالب', 'المجموعة الدراسية', 'رقم الهاتف', 'رقم ولي الأمر'];
    const rows = students.map(s => [
      `"${(s.code || '').replace(/"/g, '""')}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.group || s.group_name || '').replace(/"/g, '""')}"`,
      `"${(s.phone || s.student_phone || '').replace(/"/g, '""')}"`,
      `"${(s.parent_phone || '').replace(/"/g, '""')}"`,
    ]);
    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `centrly_student_cards_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    this.showToast('تم تحميل ملف كشف الكروت بنجاح (Excel / CSV)!', 'success');
  }

  async dispatchCardsFileDirect() {
    const students = this._pendingCardsStudents || this.students || [];
    const userTitle = this.user?.name || (this.user?.account_type === 'center' ? 'سنتر تعليمي' : 'مدرس المادة');
    try {
      const summaryMsg = `السلام عليكم، تم إصدار كشف طلب كروت الطلاب لمنظومة (${userTitle}) بإجمالي (${students.length}) طالب وجاهز للمراجعة والتنفيذ.`;
      await request('/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ phone: '01123671177', message: summaryMsg }),
      }).catch(() => null);

      this.downloadCardsCsvFile();
      this.closeModal();
      this.showToast(`تم إرسال إشعار الكشف وتنزيل ملف الكروت بنجاح!`, 'success');
    } catch (err) {
      this.showToast(`تم تجهيز وتنزيل الملف، وتعذر الاتصال الآلي المباشر: ${err.message}`, 'info');
      this.downloadCardsCsvFile();
    }
  }

  openCardsWhatsAppChat() {
    const students = this._pendingCardsStudents || this.students || [];
    const userTitle = this.user?.name || (this.user?.account_type === 'center' ? 'سنتر تعليمي' : 'مدرس المادة');
    const msg = `السلام عليكم، نزلت كشف كروت الطلاب لمنظومة (${userTitle}) بإجمالي (${students.length}) طالب، وعايز اعرف تفاصيل وأسعار طباعة الكروت علشان اطلبها.`;
    window.open(`https://wa.me/201123671177?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Session Management & Action Flow Handlers (DEV-89)
  async openStartNewSessionModal() {
    if (!this.groups || this.groups.length === 0) {
      const res = await request('/groups').catch(() => []);
      this.groups = Array.isArray(res) ? res : (res.groups || []);
    }
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)} (${escapeHtml(g.center_name || 'السنتر')})</option>`).join('');
    const defaultGroup = (this.groups && this.groups.length > 0) ? this.groups[0] : null;
    const defaultRoom = defaultGroup ? (defaultGroup.room || defaultGroup.room_name || '') : '';
    const bodyHtml = `
      <form id="startNewSessionForm" onsubmit="window.centrlyApp.handleStartSessionSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اختر المجموعة لبدء الحصة *</label>
          <select id="startSessionGroupId" class="form-input" onchange="window.centrlyApp.onStartSessionGroupChange(this.value)" required>
            ${groupOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">القاعة المخصصة للحصة</label>
          <input type="text" id="startSessionRoom" class="form-input" value="${escapeHtml(defaultRoom)}" placeholder="اسم أو رقم القاعة (يمكن تعديلها الآن)">
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="startNewSessionForm" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('sessions', 16)} <span>بدء الحصة الآن</span>
      </button>
    `;
    this.showModal('بدء حصة جديدة', bodyHtml, footerHtml);
  }

  onStartSessionGroupChange(groupId) {
    const cleanId = String(groupId).replace(/^rec-/, '');
    const grp = (this.groups || []).find(g => g.id === cleanId);
    const roomInput = document.getElementById('startSessionRoom');
    if (roomInput && grp) {
      roomInput.value = grp.room || grp.room_name || '';
    }
  }

  async handleStartSessionSubmit(e) {
    e.preventDefault();
    const gId = document.getElementById('startSessionGroupId')?.value;
    const customRoom = document.getElementById('startSessionRoom')?.value?.trim() || '';
    if (gId) {
      this.closeModal();
      await this.startSessionForGroup(gId, customRoom);
    }
  }

  async openOtherSessionsModal() {
    if (!this.groups || this.groups.length === 0) {
      const res = await request('/groups').catch(() => []);
      this.groups = Array.isArray(res) ? res : (res.groups || []);
    }
    const arabicDayNames = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
    const now = new Date();
    const todayArabic = arabicDayNames[now.getDay()];
    const allGroups = this.groups || [];
    const otherGroups = allGroups.filter(g => {
      const gDay = g.day_of_week || (arabicDayNames.find(d => g.schedule && g.schedule.includes(d))) || '';
      return gDay !== todayArabic;
    });

    const displayGroups = otherGroups.length > 0 ? otherGroups : allGroups;

    const listHtml = displayGroups.length > 0 ? `
      <div style="margin-bottom: 1rem;">
        <input type="text" id="otherSessionsSearchInput" class="form-input" placeholder="ابحث باسم المجموعة أو السنتر..." oninput="window.centrlyApp.filterOtherSessionsList(this.value)" style="width: 100%;">
      </div>
      <div id="otherSessionsCardsContainer" style="display: flex; flex-direction: column; gap: 0.75rem; max-height: 55vh; overflow-y: auto; padding: 0.25rem;">
        ${displayGroups.map(g => {
          const scheduleDisplay = g.day_of_week && g.session_time 
            ? `${g.day_of_week} • ${g.session_time}` 
            : (g.schedule || 'موعد غير محدد');
          return `
            <div class="other-session-item" data-search="${escapeHtml((g.name + ' ' + (g.center_name || g.centerName || '') + ' ' + scheduleDisplay).toLowerCase())}" style="border: 1px solid var(--centrly-line); border-radius: 10px; padding: 0.85rem 1rem; background: #f8fafc; display: flex; justify-content: space-between; align-items: center; gap: 1rem; flex-wrap: wrap;">
              <div>
                <div style="font-weight: 800; font-size: 0.95rem; color: var(--centrly-ink);">${escapeHtml(g.name)}</div>
                <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.25rem; display: flex; gap: 0.75rem; flex-wrap: wrap;">
                  <span>${getIcon('calendar', 14)} <b>${escapeHtml(scheduleDisplay)}</b></span>
                  <span>${getIcon('center', 14)} <b>${escapeHtml(g.center_name || g.centerName || 'السنتر')}</b></span>
                  ${g.room_name || g.room ? `<span>القاعة: <b>${escapeHtml(g.room_name || g.room)}</b></span>` : ''}
                  <span>${escapeHtml(g.studentCount || g.students_count || 0)} طالب</span>
                </div>
              </div>
              <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.closeModal(); window.centrlyApp.startSessionForGroup('${escapeHtml(g.id)}')" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700; white-space: nowrap;">
                ${getIcon('sessions', 14)}
                <span>بدء الحضور الآن</span>
              </button>
            </div>
          `;
        }).join('')}
      </div>
    ` : `
      <div style="text-align: center; padding: 2rem 1rem; color: var(--centrly-text);">
        لا توجد أي مجموعات مسجلة حتى الآن.
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="button" class="btn btn-primary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openCreateGroupModal();" style="display: inline-flex; align-items: center; gap: 0.4rem; font-weight: 700;">
        ${getIcon('add', 16)} <span>إنشاء مجموعة جديدة</span>
      </button>
    `;

    this.showModal('اختيار حصة من الحصص والمجموعات الأخرى', listHtml, footerHtml);
  }

  filterOtherSessionsList(query) {
    const q = (query || '').trim().toLowerCase();
    const items = document.querySelectorAll('#otherSessionsCardsContainer .other-session-item');
    items.forEach(item => {
      const text = item.getAttribute('data-search') || '';
      item.style.display = text.includes(q) ? 'flex' : 'none';
    });
  }

  promptEndSessionFlow() {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem; color: var(--centrly-blue-700); display: flex; justify-content: center;">
          ${getIcon('sessions', 42)}
        </div>
        <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.5rem 0;">إنهاء الحصة ورصد التصفية</h3>
        <p style="font-size: 0.875rem; color: var(--centrly-text); line-height: 1.5; margin-bottom: 1.25rem;">
          هل ترغب في مراجعة أو إضافة ملاحظات خاصة للطلاب قبل إرسال التقارير، أم تريد إنهاء الحصة مباشرة؟
        </p>
        <div style="display: flex; flex-direction: column; gap: 0.6rem;">
          <button class="btn btn-primary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openBatchNotesModal();" style="padding: 0.75rem; font-weight: 700; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            ${getIcon('note', 16)}
            <span>إضافة ومراجعة ملاحظات الطلاب أولاً</span>
          </button>
          <button class="btn btn-secondary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.confirmEndSessionDirect();" style="padding: 0.75rem; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 0.5rem;">
            ${getIcon('check', 16)}
            <span>إنهاء الحصة مباشرة بدون ملاحظات</span>
          </button>
        </div>
      </div>
    `;
    this.showModal('تأكيد إنهاء الحصة', bodyHtml, '');
  }

  async confirmEndSessionDirect() {
    await this.finalizeEndSession();
  }

  openCancelSessionModal(idOrGroupId) {
    const bodyHtml = `
      <form id="cancelSessionForm" onsubmit="window.centrlyApp.handleCancelSessionSubmit(event, '${escapeHtml(idOrGroupId)}')">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">سبب الإلغاء (يُرسل في إشعار الواتساب لأولياء الأمور)</label>
          <textarea id="cancelReasonInput" class="form-textarea" rows="3" placeholder="سبب إلغاء الحصة بالتفصيل" required></textarea>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">تراجع</button>
      <button type="submit" form="cancelSessionForm" class="btn btn-primary" style="background: var(--centrly-danger); border-color: var(--centrly-danger); font-weight: 700;">تأكيد إلغاء الحصة</button>
    `;
    this.showModal('إلغاء الحصة', bodyHtml, footerHtml);
  }

  async handleCancelSessionSubmit(e, id) {
    e.preventDefault();
    const reason = document.getElementById('cancelReasonInput')?.value;
    this.closeModal();
    if (this.sessionState.id) {
      this.sessionState.status = 'cancelled';
      this.sessionState.cancellation_reason = reason;
      this.renderMainContent();
    }
    this.showToast('تم إلغاء الحصة وسيتم إخطار أولياء الأمور تلقائياً', 'info');
  }

  openRescheduleModal(idOrGroupId) {
    const bodyHtml = `
      <form id="rescheduleSessionForm" onsubmit="window.centrlyApp.handleRescheduleSessionSubmit(event, '${escapeHtml(idOrGroupId)}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">الموعد البديل الجديد *</label>
          <input type="date" id="rescheduleNewDate" class="form-input" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">الوقت الجديد *</label>
          <input type="text" id="rescheduleNewTime" class="form-input" placeholder="05:00 م - 07:00 م" required>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">ملاحظة لولي الأمر</label>
          <input type="text" id="rescheduleReason" class="form-input" placeholder="سبب تأجيل الحصة بالتفصيل">
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">تراجع</button>
      <button type="submit" form="rescheduleSessionForm" class="btn btn-primary" style="font-weight: 700;">تأكيد التأجيل</button>
    `;
    this.showModal('تأجيل موعد الحصة', bodyHtml, footerHtml);
  }

  async handleRescheduleSessionSubmit(e, id) {
    e.preventDefault();
    const newDate = document.getElementById('rescheduleNewDate')?.value;
    const newTime = document.getElementById('rescheduleNewTime')?.value;
    this.closeModal();
    if (this.sessionState.id) {
      this.sessionState.status = 'rescheduled';
      this.sessionState.rescheduled_to_date = `${newDate} (${newTime})`;
      this.renderMainContent();
    }
    this.showToast(`تم تأجيل الحصة إلى ${newDate} بنجاح وإرسال التنبيه`, 'info');
  }

  openParentNoteModal(studentId, studentName = 'الطالب') {
    const bodyHtml = `
      <form id="parentNoteForm" onsubmit="window.centrlyApp.handleSendParentNote(event, '${escapeHtml(studentId)}')">
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">الملاحظة الموجهة لولي أمر (${escapeHtml(studentName)}) *</label>
          <textarea id="parentNoteText" class="form-textarea" rows="4" placeholder="اكتب الملاحظة هنا... سيتم إرسالها فوراً عبر الواتساب لولي الأمر" required></textarea>
        </div>
        <div id="parentNoteFeedback" style="display: none; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem;"></div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="parentNoteForm" id="btnSendParentNote" class="btn btn-primary" style="font-weight: 700; display: inline-flex; align-items: center; gap: 0.4rem;">
        ${getIcon('whatsapp', 16)} <span>إرسال لولي الأمر</span>
      </button>
    `;
    this.showModal(`إرسال ملاحظة: ${studentName}`, bodyHtml, footerHtml);
  }

  async handleSendParentNote(e, studentId) {
    e.preventDefault();
    const text = document.getElementById('parentNoteText')?.value.trim();
    const btn = document.getElementById('btnSendParentNote');
    const feedback = document.getElementById('parentNoteFeedback');
    if (!text) return;

    if (btn) {
      btn.disabled = true;
      btn.textContent = 'جاري الإرسال...';
    }

    try {
      await request(`/students/${studentId}/note`, {
        method: 'POST',
        body: { note: text },
      }).catch(err => {
        console.warn('Note dispatch fallback:', err);
      });

      this.closeModal();
      this.showToast('تم إرسال الملاحظة لولي الأمر بنجاح عبر الواتساب', 'success');
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `${err.message || 'فشل إرسال الملاحظة'}`;
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'إرسال لولي الأمر';
      }
    }
  }

  async retryFailedWhatsAppMessages() {
    const failedList = this.sessionState.attendanceList.filter(a => !a.is_makeup && (a.deliveryStatus === 'failed' || a.wa_status === 'failed' || a.deliveryStatus === 'not_delivered'));
    if (failedList.length === 0) {
      this.showToast('لا توجد رسائل لم يتم تسليمها لإعادة إرسالها.', 'info');
      return;
    }
    failedList.forEach(a => a.deliveryStatus = 'sending');
    this.renderMainContent();

    try {
      const syncRecords = (this.sessionState.attendanceList || [])
        .filter(a => a.student_id)
        .map(a => ({
          student_id: a.student_id,
          attended: Boolean(a.attended),
          comment: a.comment || null,
          homework_status: (a.homework && a.homework !== 'none') ? a.homework : null,
          is_makeup: Boolean(a.is_makeup),
          quiz_score: (a.quiz_score !== undefined && a.quiz_score !== null && a.quiz_score !== '') ? Number(a.quiz_score) : null,
          sent: Boolean(a.sent && a.deliveryStatus === 'delivered'),
        }));

      const res = await request(`/sessions/${this.sessionState.id}/send-messages`, {
        method: 'POST',
        body: {
          include_all_present: true,
          records: syncRecords,
        },
      });

      let retriedDelivered = 0;
      let retriedFailed = 0;

      if (res && Array.isArray(res.results)) {
        const resultsMap = new Map();
        res.results.forEach(r => {
          if (r.student_id) resultsMap.set(String(r.student_id), r);
        });

        failedList.forEach(a => {
          const r = resultsMap.get(String(a.student_id || a.id));
          if (r && (r.status === 'dispatched' || r.status === 'sent')) {
            a.sent = true;
            a.deliveryStatus = 'delivered';
            a.deliveryError = null;
            retriedDelivered++;
          } else {
            a.sent = false;
            a.deliveryStatus = 'failed';
            a.deliveryError = r?.reason || 'لم يتم التسليم';
            retriedFailed++;
          }
        });
      } else {
        failedList.forEach(a => {
          a.sent = false;
          a.deliveryStatus = 'failed';
          a.deliveryError = 'تعذر تأكيد التسليم';
          retriedFailed++;
        });
      }

      this.persistSessionState();
      this.renderMainContent();

      if (retriedDelivered > 0) {
        this.showToast(`تم تسليم (${retriedDelivered}) رسائل بنجاح`, 'success');
      } else {
        this.showToast(`لم يتم تسليم الرسائل. يمكنك استخدام زر الإرسال المباشر لكل طالب.`, 'danger');
      }
    } catch (err) {
      failedList.forEach(a => {
        a.deliveryStatus = 'failed';
        a.deliveryError = err.message || 'فشل الاتصال بالخادم';
      });
      this.persistSessionState();
      this.renderMainContent();
      this.showToast(`فشل إعادة الإرسال: ${err.message || 'خطأ في الشبكة'}`, 'danger');
    }
  }

  openEditSessionModal() {
    if (!this.sessionState.id) return;
    const currentPrice = this.sessionState.group?.price ?? 100;
    const currentRoom = this.sessionState.room || this.sessionState.group?.room || this.sessionState.group?.room_name || '';
    const bodyHtml = `
      <form id="editSessionModalForm" onsubmit="window.centrlyApp.handleSaveSessionEdit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">موضوع / عنوان الحصة</label>
          <input type="text" id="editSessionTopic" class="form-input" value="${escapeHtml(this.sessionState.topic || this.sessionState.extra_topic || '')}" placeholder="عنوان أو موضوع الحصة">
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">القاعة المخصصة للحصة</label>
          <input type="text" id="editSessionRoom" class="form-input" value="${escapeHtml(currentRoom)}" placeholder="اسم أو رقم القاعة">
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">توقيت الحصة</label>
          <input type="text" id="editSessionTime" class="form-input" value="${escapeHtml(this.sessionState.session_time || this.sessionState.time || '04:00 م - 06:00 م')}">
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م)</label>
          <input type="number" id="editSessionPrice" class="form-input" value="${currentPrice}" min="0">
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="editSessionModalForm" class="btn btn-primary" style="font-weight: 700;">حفظ التعديلات</button>
    `;
    this.showModal('تعديل بيانات الحصة الحالية', bodyHtml, footerHtml);
  }

  handleSaveSessionEdit(e) {
    e.preventDefault();
    const topic = document.getElementById('editSessionTopic')?.value.trim();
    const room = document.getElementById('editSessionRoom')?.value.trim();
    const time = document.getElementById('editSessionTime')?.value.trim();
    const price = Number(document.getElementById('editSessionPrice')?.value) || 0;

    if (this.sessionState) {
      this.sessionState.topic = topic;
      this.sessionState.room = room;
      this.sessionState.session_time = time;
      if (this.sessionState.group) {
        this.sessionState.group.price = price;
        this.sessionState.group.room = room;
      }
      this.persistSessionState();
      this.closeModal();
      this.showToast('تم تحديث بيانات الحصة بنجاح', 'success');
      this.renderMainContent();
    }
  }

  // Functional Extra Session Modal
  openScheduleSessionModal(defaultGroupId = null) {
    const cleanDefaultId = defaultGroupId ? String(defaultGroupId).replace(/^rec-/, '') : null;
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}" ${cleanDefaultId === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
    const todayIso = new Date().toISOString().slice(0, 10);
    const bodyHtml = `
      <form id="scheduleSessionForm" onsubmit="window.centrlyApp.handleCreateExtraSession(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">المجموعة *</label>
          <select id="extraSessionGroup" class="form-input" required>
            ${groupOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">تاريخ الحصة *</label>
          <input type="date" id="extraSessionDate" class="form-input" value="${todayIso}" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">الوقت *</label>
          <input type="text" id="extraSessionTime" class="form-input" value="04:00 م - 06:00 م" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">موضوع الحصة / الملاحظات *</label>
          <input type="text" id="extraSessionTopic" class="form-input" placeholder="عنوان أو موضوع الحصة الإضافية" required>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="scheduleSessionForm" class="btn btn-primary" style="font-weight: 700;">جدولة الحصة الإضافية</button>
    `;
    this.showModal('إضافة حصة إضافية في الجدول', bodyHtml, footerHtml);
  }

  async handleCreateExtraSession(e) {
    e.preventDefault();
    const submitBtn = e.target.querySelector('button[type="submit"]') || document.querySelector('button[form="scheduleSessionForm"]');
    if (submitBtn) {
      if (submitBtn.disabled) return;
      submitBtn.disabled = true;
      submitBtn.textContent = 'جاري الحفظ...';
    }

    const group_id = document.getElementById('extraSessionGroup').value;
    const session_date = document.getElementById('extraSessionDate').value;
    const session_time = document.getElementById('extraSessionTime').value;
    const topic = document.getElementById('extraSessionTopic').value;

    try {
      await request('/sessions/extra', {
        method: 'POST',
        body: {
          group_id,
          session_date,
          session_time,
          topic,
          notify_parents: true,
        },
      });
      this.closeModal();
      this.showToast('تم جدولة الحصة الإضافية بنجاح وإرسال إشعارات لأولياء الأمور!', 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'جدولة الحصة الإضافية';
      }
      this.showToast(`فشل جدولة الحصة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  dispatchSessionWhatsAppMessages() {
    if (!this.sessionState.id) {
      this.showToast('لا توجد حصة محددة لإرسال الرسائل.', 'info');
      return;
    }
    if (this.sessionState.isDispatchingWhatsApp) {
      this.showToast('الإرسال جارٍ بالفعل حالياً بفواصل الأمان. يرجى الانتظار لحين اكتمال إرسال الدفعة.', 'warning');
      return;
    }
    const eligibleStudents = (this.sessionState.attendanceList || []).filter(
      a => !a.is_makeup && a.comment !== 'حصة تعويضية'
    );
    const countEligible = eligibleStudents.length;
    if (countEligible === 0) {
      this.showToast('لا يوجد طلاب لإرسال إشعارات الحصة لهم.', 'info');
      return;
    }

    this.showConfirmModal({
      title: 'إرسال إشعارات الحصة لأولياء الأمور عبر واتساب',
      message: `سيتم إرسال (${countEligible}) رسالة لأولياء الأمور لإشعارهم بتقرير الحصة بفواصل زمنية منظمة لضمان وصول الرسائل بسلاسة. هل ترغب في المتابعة؟`,
      confirmText: `إرسال الإشعارات الآن (${countEligible} رسالة)`,
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        if (this.sessionState.isDispatchingWhatsApp) return;
        this.sessionState.isDispatchingWhatsApp = true;
        try {
          this.showToast('جارٍ إرسال إشعارات الحصة عبر واتساب...', 'info');

          // 1. First: Guarantee all attendance records (attended + absent) are synced to the backend
          const syncRecords = (this.sessionState.attendanceList || [])
            .filter(a => a.student_id)
            .map(a => ({
              student_id: a.student_id,
              attended: Boolean(a.attended),
              comment: a.comment || null,
              homework_status: (a.homework && a.homework !== 'none') ? a.homework : null,
              is_makeup: Boolean(a.is_makeup),
              quiz_score: (a.quiz_score !== undefined && a.quiz_score !== null && a.quiz_score !== '') ? Number(a.quiz_score) : null,
              sent: Boolean(a.sent && a.deliveryStatus === 'delivered'),
            }));

          // Mark status as 'sending' in UI immediately
          this.sessionState.attendanceList.forEach(a => {
            if (!a.is_makeup && a.comment !== 'حصة تعويضية') {
              a.deliveryStatus = 'sending';
            }
          });
          this.renderMainContent();

          const res = await request(`/sessions/${this.sessionState.id}/send-messages`, {
            method: 'POST',
            body: { 
              include_all_present: true,
              records: syncRecords,
            },
          });

          // 2. Process exact per-student results from the server
          let deliveredCount = 0;
          let failedCount = 0;

          if (res && Array.isArray(res.results)) {
            const resultsMap = new Map();
            res.results.forEach(r => {
              if (r.student_id) resultsMap.set(String(r.student_id), r);
            });

            this.sessionState.attendanceList.forEach(a => {
              if (a.is_makeup || a.comment === 'حصة تعويضية') return;

              const r = resultsMap.get(String(a.student_id || a.id));
              if (r) {
                if (r.status === 'dispatched' || r.status === 'sent') {
                  a.sent = true;
                  a.deliveryStatus = 'delivered';
                  a.deliveryError = null;
                  deliveredCount++;
                } else if (r.status === 'already_sent') {
                  a.sent = true;
                  a.deliveryStatus = 'delivered';
                  deliveredCount++;
                } else if (r.status === 'failed') {
                  a.sent = false;
                  a.deliveryStatus = 'failed';
                  a.deliveryError = r.reason || 'لم يتم التسليم';
                  failedCount++;
                } else if (r.status === 'skipped') {
                  a.sent = false;
                  a.deliveryStatus = 'failed';
                  a.deliveryError = r.reason || 'تم التخطي';
                  failedCount++;
                }
              } else {
                a.sent = false;
                a.deliveryStatus = 'failed';
                a.deliveryError = 'لم يتم العثور على تقرير إرسال للطالب';
                failedCount++;
              }
            });
          } else {
            this.sessionState.attendanceList.forEach(a => {
              if (!a.is_makeup && a.comment !== 'حصة تعويضية') {
                a.sent = false;
                a.deliveryStatus = 'failed';
                a.deliveryError = 'تعذر تأكيد التسليم من الخادم';
                failedCount++;
              }
            });
          }

          this.persistSessionState();
          this.renderMainContent();

          if (failedCount > 0 && deliveredCount === 0) {
            this.showToast(`تعذر تسليم الإشعارات (${failedCount} طالب لم يتم التسليم لهم). يرجى التحقق من اتصال الواتساب أو استخدام زر الإرسال المباشر.`, 'danger');
          } else if (failedCount > 0) {
            this.showToast(`تم تسليم (${deliveredCount}) رسالة بنجاح، و (${failedCount}) طالب لم يتم التسليم لهم.`, 'warning');
          } else {
            this.showToast(`تم إرسال كافة إشعارات الحصة (${deliveredCount} رسالة) بنجاح عبر واتساب!`, 'success');
          }
        } catch (err) {
          this.sessionState.attendanceList.forEach(a => {
            if (!a.is_makeup && a.comment !== 'حصة تعويضية') {
              a.sent = false;
              a.deliveryStatus = 'failed';
              a.deliveryError = err.message || 'فشل الاتصال بالخادم';
            }
          });
          this.persistSessionState();
          this.renderMainContent();
          this.showToast(`فشل إرسال رسائل الواتساب: ${err.message || 'لم يتم التسليم'}`, 'danger');
        } finally {
          this.sessionState.isDispatchingWhatsApp = false;
        }
      }
    });
  }

  resendSingleMessage(studentId, studentName) {
    const row = (this.sessionState.attendanceList || []).find(a => a.student_id === studentId || a.id === studentId);
    const student = (this.students || []).find(s => s.id === studentId) || {};
    const parentPhone = row?.parent_phone || student.parent_phone || row?.phone || '';

    // Block sending if no valid parent phone is registered
    const cleanCheck = (parentPhone || '').replace(/[\s\-().+]/g, '');
    if (!cleanCheck || cleanCheck.length < 9) {
      this.showToast(`رقم هاتف ولي الامر غير مسجل للطالب "${studentName}". يرجى تعديل بيانات الطالب واضافة رقم ولي الامر اولا.`, 'danger');
      return;
    }

    const isAttended = row?.attended !== false;
    const comment = row?.comment || '';
    const homework = row?.homework || 'none';

    let previewText = `السلام عليكم ورحمة الله وبركاته، ولي أمر الطالب/ة (${studentName}).\n`;
    if (isAttended) {
      previewText += `نفيدكم بحضور الطالب اليوم لحصة المادة بنجاح.\n`;
      if (homework === 'done') previewText += `حالة الواجب: مكتمل وممتاز.\n`;
      else if (homework === 'partial') previewText += `حالة الواجب: ناقص يحتاج استكمال.\n`;
      else if (homework === 'missing') previewText += `حالة الواجب: لم يتم تسليم الواجب.\n`;
      if (comment) previewText += `ملاحظة المعلم: ${comment}\n`;
    } else {
      previewText += `نود إحاطة سيادتكم بغياب الطالب/ة عن حضور حصة اليوم. يرجى المتابعة والاطمئنان حرصاً على مستواه الدراسي.\n`;
      if (comment) previewText += `ملاحظة: ${comment}\n`;
    }

    this.showConfirmModal({
      title: 'إرسال إشعار ولي الأمر عبر واتساب',
      message: `هل ترغب في إرسال تقرير الحصة للطالب "${studentName}" إلى ولي الأمر (${parentPhone})؟`,
      confirmText: 'إرسال الإشعار',
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        let sentViaApi = false;
        try {
          const statusRes = await request('/whatsapp/status').catch(() => null);
          if (statusRes && statusRes.status === 'connected') {
            const sendRes = await request(`/sessions/${this.sessionState.id || 'active'}/resend/${studentId}`, { method: 'POST' }).catch(() => null);
            if (sendRes && (sendRes.gateway_delivered || sendRes.dispatched || sendRes.success)) {
              sentViaApi = true;
            }
          }
        } catch (err) {
          console.warn('API send failed, falling back to direct send:', err);
        }

        if (sentViaApi) {
          if (row) {
            row.sent = true;
            row.deliveryStatus = 'delivered';
            this.persistSessionState();
          }
          this.showToast(`تم إرسال الإشعار بنجاح إلى ولي أمر: ${studentName}`, 'success');
          this.renderMainContent();
        } else {
          // Fallback to instant 1-click Direct WhatsApp
          this.openDirectWhatsAppFallbackModal(studentName, parentPhone, previewText, () => {
            if (row) {
              row.sent = true;
              row.deliveryStatus = 'delivered';
              this.persistSessionState();
              this.renderMainContent();
            }
          });
        }
      }
    });
  }

  openDirectWhatsAppFallbackModal(studentName, phone, messageText, onDelivered, recipientType = 'parent') {
    let cleanPhone = (phone || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }

    // Block modal if no valid phone - prevents sending to teacher's own number
    if (!cleanPhone || cleanPhone.length < 9) {
      const recipientLabel = recipientType === 'student' ? 'الطالب' : 'ولي الامر';
      this.showToast(`رقم هاتف ${recipientLabel} غير مسجل للطالب "${studentName}". يرجى تعديل بيانات الطالب واضافة الرقم اولا.`, 'danger');
      return;
    }

    const waUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`;

    const isStudent = recipientType === 'student';
    const recipientTitle = isStudent ? 'الطالب' : 'ولي الأمر';

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;" dir="rtl">
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.85rem; font-size: 0.85rem; color: #92400e; line-height: 1.6;">
          <strong>الإرسال المباشر لـ ${recipientTitle}:</strong> واتساب السيرفر الآلي غير متصل حالياً. تم تجهيز نص الرسالة بالكامل لـ <b>${escapeHtml(studentName)}</b> لتتمكن من إرسالها فوراً بنقرة واحدة عبر واتساب لضمان وصولها!
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ${recipientTitle}:</label>
          <input type="tel" id="fallbackParentPhone" class="form-input" dir="ltr" value="${escapeHtml(phone || '')}" placeholder="رقم الهاتف" oninput="window.centrlyApp.updateDirectFallbackLink()">
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">نص الرسالة المُعدة للإرسال:</label>
          <textarea id="fallbackMessageText" class="form-input" rows="5" style="font-size: 0.85rem; line-height: 1.5;" oninput="window.centrlyApp.updateDirectFallbackLink()">${escapeHtml(messageText)}</textarea>
        </div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 0.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <a 
            id="directWhatsAppSendLink"
            href="${waUrl}" 
            target="_blank" 
            rel="noopener noreferrer" 
            class="btn btn-primary" 
            style="background: #25d366; border-color: #25d366; color: #ffffff; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.5rem 1rem;"
            onclick="window.centrlyApp.onDirectWhatsAppModalClicked()"
          >
            ${getIcon('whatsapp', 18, '#ffffff')}
            <span>فتح واتساب وإرسال الرابط الآن</span>
          </a>
        </div>
      </div>
    `;

    this._pendingDirectOnDelivered = onDelivered;
    this.showModal(`إرسال رابط بوابة (${studentName}) عبر واتساب`, bodyHtml, '');
  }

  updateDirectFallbackLink() {
    const phoneInput = document.getElementById('fallbackParentPhone');
    const msgInput = document.getElementById('fallbackMessageText');
    const linkEl = document.getElementById('directWhatsAppSendLink');
    if (!linkEl) return;

    let cleanPhone = (phoneInput?.value || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }
    const msg = msgInput?.value || '';
    linkEl.href = cleanPhone ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(msg)}` : `https://wa.me/?text=${encodeURIComponent(msg)}`;
  }

  onDirectWhatsAppModalClicked() {
    if (this._pendingDirectOnDelivered) {
      this._pendingDirectOnDelivered();
      this._pendingDirectOnDelivered = null;
    }
    setTimeout(() => {
      this.closeModal();
      this.showToast('تم فتح واتساب وتحديث حالة التقرير إلى تم التسليم!', 'success');
    }, 800);
  }

  async copyToClipboard(text, successMessage = 'تم النسخ بنجاح!', fallbackTitle = 'نسخ الرابط') {
    if (!text) return false;

    let copied = false;

    // 1. Try modern navigator.clipboard
    if (navigator && navigator.clipboard && window.isSecureContext) {
      try {
        await navigator.clipboard.writeText(text);
        copied = true;
      } catch (e) {
        copied = false;
      }
    }

    // 2. Fallback: Hidden textarea with document.execCommand('copy')
    if (!copied) {
      try {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.top = '-9999px';
        textArea.style.left = '-9999px';
        textArea.style.opacity = '0';
        textArea.setAttribute('readonly', '');
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        textArea.setSelectionRange(0, 99999);
        copied = document.execCommand('copy');
        document.body.removeChild(textArea);
      } catch (e) {
        copied = false;
      }
    }

    // 3. Fallback: Web Share API if available (especially on mobile phones)
    if (!copied && navigator.share) {
      try {
        await navigator.share({
          title: fallbackTitle || 'Centrly',
          text: text,
          url: text.startsWith('http') ? text : undefined
        });
        this.showToast('تم فتح قائمة المشاركة بنجاح!', 'info');
        return true;
      } catch (e) {
        // Ignored if user dismissed share sheet
      }
    }

    // 4. Fallback: Clean modal dialog with pre-selected input so user can copy easily
    if (!copied) {
      this.openCopyFallbackModal(fallbackTitle || 'نسخ الرابط', text);
      return true;
    }

    if (successMessage) {
      this.showToast(successMessage, 'success');
    }
    return true;
  }

  openCopyFallbackModal(title, text) {
    const waUrl = text.startsWith('http') ? `https://wa.me/?text=${encodeURIComponent(text)}` : '';
    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;" dir="rtl">
        <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 8px; padding: 0.85rem; font-size: 0.85rem; color: #1e40af; line-height: 1.5;">
          <strong>تنبيه المتصفح:</strong> يرجى الضغط على الزر أدناه لنسخ الرابط أو مشاركته مباشرة.
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">الرابط المطلوب:</label>
          <input type="text" id="centrlyFallbackCopyInput" class="form-input" dir="ltr" value="${escapeHtml(text)}" readonly onclick="this.select();" style="font-family: monospace; font-size: 0.82rem; background: #f8fafc;">
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>
          <button type="button" class="btn btn-primary" onclick="const input = document.getElementById('centrlyFallbackCopyInput'); if (input) { input.focus(); input.select(); document.execCommand('copy'); window.centrlyApp.showToast('تم النسخ بنجاح!', 'success'); window.centrlyApp.closeModal(); }">
            ${getIcon('copy', 14)}
            <span>تحديد ونسخ</span>
          </button>
          ${waUrl ? `
            <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-primary" style="background: #25d366; border-color: #25d366; color: #ffffff;">
              ${getIcon('whatsapp', 14, '#ffffff')}
              <span>مشاركة عبر واتساب</span>
            </a>
          ` : ''}
        </div>
      </div>
    `;
    this.showModal(title, bodyHtml, '');
    setTimeout(() => {
      const input = document.getElementById('centrlyFallbackCopyInput');
      if (input) {
        input.focus();
        input.select();
      }
    }, 150);
  }

  async copyParentLink(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const phone = student?.parent_phone || student?.parentPhone || 'رقم ولي الأمر';
    const pass = student?.portal_password || student?.portalPassword || '';
    const passLine = pass ? `\n🔑 كلمة المرور: ${pass}` : '';
    const textToCopy = `🌐 رابط بوابة المتابعة: https://centerly-platform.vercel.app/portal\n📱 اسم الدخول (رقم الهاتف): ${phone}${passLine}`;
    await this.copyToClipboard(textToCopy, 'تم نسخ بيانات دخول ورابط ولي الأمر بنجاح!', 'بيانات الدخول');
  }

  async previewParentPortal(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const token = student?.parent_portal_token || student?.parentPortalToken;
    const url = token ? `/?token=${encodeURIComponent(token)}` : `/portal`;
    window.open(url, '_blank');
  }

  async copyStudentLink(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const phone = student?.student_phone || student?.studentPhone || 'رقم الطالب';
    const pass = student?.portal_password || student?.portalPassword || '';
    const passLine = pass ? `\n🔑 كلمة المرور: ${pass}` : '';
    const textToCopy = `🌐 رابط بوابتك التعليمية: https://centerly-platform.vercel.app/portal\n📱 اسم الدخول (رقم الهاتف): ${phone}${passLine}`;
    await this.copyToClipboard(textToCopy, 'تم نسخ بيانات دخول ورابط الطالب بنجاح!', 'بيانات الدخول');
  }

  async previewStudentPortal(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const token = student?.parent_portal_token || student?.parentPortalToken;
    const url = token ? `/?token=${encodeURIComponent(token)}&portal=student` : `/portal`;
    window.open(url, '_blank');
  }

  async sendSingleParentLink(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const parentPhone = student?.parentPhone || student?.parent_phone;
    if (!parentPhone) {
      this.showToast('رقم هاتف ولي الأمر غير مسجل لهذا الطالب.', 'warning');
      return;
    }

    const studentName = student?.name || 'الطالب';
    this.showToast(`جاري إرسال رابط المتابعة لولي أمر (${studentName})...`, 'info');

    const openDirectFallback = async () => {
      try {
        const canonicalOrigin = 'https://centerly-platform.vercel.app';
        const portalUrl = `${canonicalOrigin}/portal`;
        const pass = student?.portal_password || '123456';
        const teacherName = this.user?.name ? (this.user.name.startsWith('مستر') || this.user.name.startsWith('أ.') ? this.user.name : `مستر ${this.user.name}`) : 'إدارة المتابعة';
        const msg = `أهلاً بحضرتك ولي أمر الطالب (${studentName})، نتمنى له عاماً دراسياً حافلاً بالتفوق والنجاح! 🌟\n\nيسعدنا تزويدكم ببيانات بوابة المتابعة مع ${teacherName}:\n\n🌐 *رابط بوابة المتابعة:*\n${portalUrl}\n\n📱 *اسم الدخول (رقم هاتفك):* ${parentPhone}\n🔑 *كلمة المرور:* ${pass}\n\n*من خلال هذه البوابة يمكنكم في أي وقت:*\n- متابعة تسجيل الحضور والغياب فور دخول الطالب الحصة.\n- درجات الكويزات والامتحانات الدورية وتقييمات المعلم.\n- متابعة الواجبات المنزلية والالتزام بتسليمها وملاحظات المعلم.\n\n📌 *تنبيه هام:* يرجى *حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً* حتى يصبح الرابط أزرق وقابلاً للضغط، ولتصلك تقارير الحصص والدرجات باستمرار دون انقطاع.\n\nمع خالص تمنياتنا للطالب (${studentName}) بدوام التفوق والنجاح.\nمع تحيات: ${teacherName}`;
        this.openDirectWhatsAppFallbackModal(studentName, parentPhone, msg, () => {
          if (student) {
            student.parent_portal_sent_at = new Date().toISOString();
          }
          if (this.currentRoute === 'students') {
            this.renderMainContent();
          }
        }, 'parent');
      } catch (fErr) {
        this.showToast('تعذر تجهيز رابط المتابعة المباشر', 'danger');
      }
    };

    try {
      const res = await request(`/students/${studentId}/send-parent-link`, {
        method: 'POST',
        body: {
          teacher_name: this.user?.name || 'المعلم',
        },
      });

      if (res.success) {
        if (student) {
          student.parent_portal_sent_at = res.sent_at || new Date().toISOString();
        }
        this.showToast(`تم إرسال رابط المتابعة بنجاح لولي أمر (${studentName})!`, 'success');
        if (this.currentRoute === 'students') {
          this.renderMainContent();
        }
      } else {
        // Automatically open instant 1-click Direct WhatsApp modal
        await openDirectFallback();
      }
    } catch (err) {
      await openDirectFallback();
    }
  }

  async sendSingleStudentLink(studentId) {
    const student = (this.students || []).find(s => s.id === studentId);
    const studentPhone = student?.studentPhone || student?.student_phone;
    if (!studentPhone) {
      this.showToast('رقم هاتف الطالب غير مسجل لهذا الطالب.', 'warning');
      return;
    }

    const studentName = student?.name || 'الطالب';
    this.showToast(`جاري إرسال رابط البوابة للطالب (${studentName})...`, 'info');

    const openDirectFallback = async () => {
      try {
        const canonicalOrigin = 'https://centerly-platform.vercel.app';
        const studentUrl = `${canonicalOrigin}/portal`;
        const pass = student?.portal_password || '123456';
        const teacherName = this.user?.name ? (this.user.name.startsWith('مستر') || this.user.name.startsWith('أ.') ? this.user.name : `مستر ${this.user.name}`) : 'إدارة المتابعة';
        const msg = `أهلاً بك يا (${studentName})، نتمنى لك كل التوفيق والتميز دائماً! 🚀\n\nتم تفعيل بوابتك التعليمية الرسمية لمتابعة دروسك مع ${teacherName}:\n\n🌐 *رابط بوابتك التعليمية:*\n${studentUrl}\n\n📱 *اسم الدخول (رقم هاتفك):* ${studentPhone}\n🔑 *كلمة المرور:* ${pass}\n\n*من خلال هذه البوابة يمكنك في أي وقت:*\n- تحميل المذكرات وملازم الشرح وملفات الـ PDF.\n- معرفة الواجبات المنزلية المطلوبة ومواعيد تسليمها.\n- رفع حلول الواجبات وملفات الـ PDF مباشرة ومتابعة اعتمادها.\n- الاطلاع على درجات الكويزات وسجل حضورك.\n\n📌 *تنبيه:* يرجى *حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً* حتى يصبح الرابط أزرق وقابلاً للضغط، ولتصلك تنبيهات الحصص والواجبات أولاً بأول.\n\nمع أطيب التمنيات لك بدوام التفوق والتميز دائماً.\nمع تحيات: ${teacherName}`;
        this.openDirectWhatsAppFallbackModal(studentName, studentPhone, msg, () => {
          if (student) {
            student.student_portal_sent_at = new Date().toISOString();
          }
          if (this.currentRoute === 'students') {
            this.renderMainContent();
          }
        }, 'student');
      } catch (fErr) {
        this.showToast('تعذر تجهيز رابط بوابة الطالب المباشر', 'danger');
      }
    };

    try {
      const res = await request(`/students/${studentId}/send-student-link`, {
        method: 'POST',
        body: {
          teacher_name: this.user?.name || 'المعلم',
        },
      });

      if (res.success) {
        if (student) {
          student.student_portal_sent_at = res.sent_at || new Date().toISOString();
        }
        this.showToast(`تم إرسال رابط البوابة بنجاح للطالب (${studentName})!`, 'success');
        if (this.currentRoute === 'students') {
          this.renderMainContent();
        }
      } else {
        const errorMsg = res.error || 'خدمة واتساب غير متصلة برقمك. يرجى التوجه إلى صفحة الإعدادات ومسح رمز QR أولاً.';
        this.showToast(errorMsg, 'danger');
      }
    } catch (err) {
      const errorMsg = err.message || 'خدمة واتساب غير متصلة برقمك. يرجى التوجه إلى صفحة الإعدادات ومسح رمز QR أولاً.';
      this.showToast(errorMsg, 'danger');
    }
  }

  openBatchParentLinksModal() {
    this.openBatchPortalLinksModal();
  }

  openBatchPortalLinksModal() {
    const studentList = this.students || [];
    const unsentStudents = studentList.filter(s => 
      (!s.parent_portal_sent_at || !s.student_portal_sent_at) && 
      ((s.parentPhone || s.parent_phone) || (s.studentPhone || s.student_phone))
    );

    if (unsentStudents.length === 0) {
      this.showToast('جميع الطلاب المسجلين تم إرسال روابط المنصة والمتابعة لهم مسبقاً.', 'info');
      return;
    }

    const teacherName = this.user?.name || 'مستر أحمد';
    const displayCount = Math.min(unsentStudents.length, 24);

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 0.75rem; padding: 0.85rem; color: #166534; font-size: 0.85rem; line-height: 1.6;">
          <div style="font-weight: 800; display: flex; align-items: center; gap: 0.4rem; margin-bottom: 0.25rem;">
            <span>⚡ نظام الإرسال المزدوج الذكي للرسائل والتقارير</span>
          </div>
          يتم إرسال رسالتين بنموذجين مخصصين لكل طالب (رسالة للطالب على رقمه + رسالة لولي أمره) لضمان وصول التقارير بسلاسة وتنظيم فائق.
        </div>

        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <span>الطلاب المستهدفون (${unsentStudents.length} طالب - محدد ${displayCount} تلقائياً):</span>
            <label style="font-size: 0.8rem; color: #64748b; font-weight: 600; cursor: pointer;">
              <input type="checkbox" id="selectAllBatchParentLinks" checked onchange="
                const checked = this.checked;
                const boxes = document.querySelectorAll('.batch-parent-checkbox');
                boxes.forEach((cb, idx) => {
                  cb.checked = checked && (idx < 24);
                });
              "> تحديد أول 24 طالباً
            </label>
          </div>

          <div style="max-height: 200px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; background: #fafafa;">
            ${unsentStudents.map((s, idx) => {
              const pPhone = s.parentPhone || s.parent_phone || '—';
              const sPhone = s.studentPhone || s.student_phone || '—';
              const isChecked = idx < 24;
              return `
                <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.6rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.4rem; cursor: pointer;">
                  <span style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" class="batch-parent-checkbox" value="${escapeHtml(s.id)}" ${isChecked ? 'checked' : ''}>
                    <span style="font-weight: 700; color: #1e293b;">${escapeHtml(s.name)}</span>
                    <span style="font-size: 0.75rem; color: #64748b; font-family: monospace;">كود: ${escapeHtml(s.code || s.student_code || '—')}</span>
                  </span>
                  <span dir="ltr" style="font-size: 0.75rem; font-family: monospace; color: #475569; display: flex; flex-direction: column; align-items: flex-end;">
                    <span>ولي الأمر: ${escapeHtml(pPhone)}</span>
                    <span>الطالب: ${escapeHtml(sPhone)}</span>
                  </span>
                </label>
              `;
            }).join('')}
          </div>
          ${unsentStudents.length > 24 ? `
            <div style="font-size: 0.75rem; color: #b45309; margin-top: 0.3rem;">
              ⚠️ تم تحديد أول 24 طالباً لحماية رقمك اليوم. يمكنك إرسال باقي الطلاب في اليوم التالي.
            </div>
          ` : ''}
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
          <div style="display: flex; gap: 0.5rem; margin-bottom: 0.5rem;">
            <button type="button" class="btn btn-sm" id="btnTabPreviewStudent" onclick="
              document.getElementById('previewStudentMsg').style.display='block';
              document.getElementById('previewParentMsg').style.display='none';
              this.style.background='#0284c7'; this.style.color='#fff';
              document.getElementById('btnTabPreviewParent').style.background='#f1f5f9'; document.getElementById('btnTabPreviewParent').style.color='#334155';
            " style="background: #0284c7; color: #fff; font-weight: 700;">نموذج الطالب</button>

            <button type="button" class="btn btn-sm" id="btnTabPreviewParent" onclick="
              document.getElementById('previewStudentMsg').style.display='none';
              document.getElementById('previewParentMsg').style.display='block';
              this.style.background='#0284c7'; this.style.color='#fff';
              document.getElementById('btnTabPreviewStudent').style.background='#f1f5f9'; document.getElementById('btnTabPreviewStudent').style.color='#334155';
            " style="background: #f1f5f9; color: #334155; font-weight: 700;">نموذج ولي الأمر</button>
          </div>

          <div id="previewStudentMsg" style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.8rem; color: #334155; line-height: 1.6; white-space: pre-line;">
السلام عليكم ورحمة الله وبركاته، الطالب (اسم الطالب).

حرصاً على تنظيم مذاكرتك وتفوقك، هذا هو رابط بوابتك التعليمية الرسمية:

⚠️ *خطوة هامة وأساسية لتفعيل الرابط:*
يرجى *حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً* حتى يصبح الرابط أزرق وقابلاً للضغط والفتح مباشرة، ولتصلك تنبيهات الحصص والمذكرات الجديدة.

*رابط بوابتك التعليمية المباشر:*
https://centerly-platform.vercel.app/s/s16766044

- تحميل المذكرات وملازم الشرح وملفات الـ PDF.
- معرفة الواجبات المنزلية المطلوبة ومواعيد تسليمها ورفع الحلول.
- الاطلاع على درجات الكويزات وسجل حضورك.

مع تحيات: ${escapeHtml(teacherName)}
          </div>

          <div id="previewParentMsg" style="display: none; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.8rem; color: #334155; line-height: 1.6; white-space: pre-line;">
السلام عليكم ورحمة الله وبركاته، ولي أمر الطالب (اسم الطالب).

حرصاً على متابعة المستوى الدراسي أولاً بأول، يسعدنا تزويدكم برابط بوابة المتابعة المباشرة الخاصة به:

⚠️ *خطوة هامة وأساسية لتفعيل الرابط:*
يرجى *حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً* حتى يصبح الرابط أزرق وقابلاً للضغط والفتح مباشرة، ولضمان استلام إشعارات وتقارير الطالب باستمرار دون انقطاع.

*رابط المتابعة المباشر لولي الأمر:*
https://centerly-platform.vercel.app/p/p16766044

- متابعة تسجيل الحضور والغياب لحظياً مع كل حصة.
- الاطلاع على درجات الكويزات والامتحانات الدورية فور رصدها.
- متابعة الالتزام بتسليم وحل الواجبات وملاحظات المعلم.

مع تحيات: ${escapeHtml(teacherName)}
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 0.75rem;">
        <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
        <button type="button" id="btnConfirmBatchParentLinks" class="btn btn-primary" onclick="window.centrlyApp.dispatchBatchParentLinks()" style="background-color: #0284c7; border-color: #0284c7; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
          ${getIcon('whatsapp', 18)}
          <span>بدء الإرسال المزدوج الآمن (${displayCount} طالب)</span>
        </button>
      </div>
    `;

    this.showModal(`إرسال روابط المتابعة والمنصة للطلاب الجدد`, bodyHtml, footerHtml);
  }

  async dispatchBatchParentLinks() {
    const selectedBoxes = Array.from(document.querySelectorAll('.batch-parent-checkbox:checked'));
    let selectedIds = selectedBoxes.map(cb => cb.value);

    if (selectedIds.length === 0) {
      this.showToast('يرجى اختيار طالب واحد على الأقل للإرسال.', 'warning');
      return;
    }

    if (selectedIds.length > 24) {
      selectedIds = selectedIds.slice(0, 24);
      this.showToast('لأمان رقمك من خوارزميات واتساب، تم تحديد الحد الأقصى 24 طالباً لدفعة اليوم.', 'info');
    }

    const btn = document.getElementById('btnConfirmBatchParentLinks');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>جاري بدء الجدولة الآمنة...</span>`;
    }

    try {
      const res = await request('/students/batch-send-dual-portal-links', {
        method: 'POST',
        body: {
          student_ids: selectedIds,
          teacher_name: this.user?.name || 'المعلم',
        },
      });

      this.closeModal();

      // Update local student records
      const now = new Date().toISOString();
      (this.students || []).forEach(s => {
        if (selectedIds.includes(s.id)) {
          s.parent_portal_sent_at = now;
          s.student_portal_sent_at = now;
        }
      });

      this.showToast(
        res.message || `تم بنجاح بدء جدولة إرسال الروابط لـ (${selectedIds.length}) طالباً بأعلى معايير الأمان!`,
        'success'
      );

      if (this.currentRoute === 'students') {
        this.renderMainContent();
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `${getIcon('whatsapp', 16)}<span>إعادة المحاولة</span>`;
      }
      this.showToast(`حدث خطأ أثناء الإرسال الجماعي: ${err.message || 'تأكد من الاتصال بالخادم'}`, 'danger');
    }
  }

  async downloadBarcodeSheet(groupId) {
    const targetGroupId = groupId || (this.groups && this.groups[0]?.id);
    if (!targetGroupId) {
      this.showToast('يرجى إنشاء مجموعة دراسية أولاً لطباعة كروت الباركود لطلابها.', 'info');
      return;
    }
    try {
      const baseUrl = API_BASE_URL;
      const token = authService.getToken();
      const res = await fetch(`${baseUrl}/groups/${targetGroupId}/barcode-sheet`, {
        headers: token ? { 'Authorization': `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error(`تعذر تحميل ملف الباركود (${res.status})`);
      }
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `group-${targetGroupId}-barcodes.pdf`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
    } catch (err) {
      this.showToast(`${err.message || 'فشل تحميل ملف الباركود'}`, 'danger');
    }
  }

  openReceiptModal() {
    const rev = this.sessionState.financials.totalRevenue;
    const att = this.sessionState.financials.attendeeCount;
    const abs = this.sessionState.financials.absentCount;
    this.showToast(`إيصال الحصة: إجمالي النقدية ${rev} ج.م | الحاضرون: ${att} | الغياب: ${abs}`, 'info');
  }

  filterStudentsTable() {
    const q = document.getElementById('studentSearchInput')?.value.toLowerCase() || '';
    const groupFilter = document.getElementById('studentGroupFilter')?.value || '';
    const rows = document.querySelectorAll('#studentsTable tbody tr');

    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      const matchQ = text.includes(q);
      const matchG = !groupFilter || text.includes(groupFilter.toLowerCase());
      r.style.display = matchQ && matchG ? '' : 'none';
    });
  }

  filterLogs() {}

  openImportModal() {
    const studentLimit = this.billingState?.students_limit || 300;
    const currentCount = (this.students || []).length;
    if (currentCount >= studentLimit) {
      const storageKey = 'centrly_quota_exceeded_timestamp';
      let reachedTimestamp = localStorage.getItem(storageKey);
      if (!reachedTimestamp) {
        reachedTimestamp = Date.now().toString();
        localStorage.setItem(storageKey, reachedTimestamp);
      }
      const elapsedDays = (Date.now() - Number(reachedTimestamp)) / (1000 * 60 * 60 * 24);
      if (elapsedDays > 3) {
        this.showQuotaBlockedModal(currentCount, studentLimit);
        return;
      }
    }

    const defaultGroup = this.groups && this.groups[0];
    const bodyHtml = `
      <form id="importStudentsForm" onsubmit="window.centrlyApp.handleImportStudents(event)">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">المجموعة المستهدفة:</label>
          <select id="importGroupId" class="form-select" required>
            ${(this.groups || []).map(g => `<option value="${escapeHtml(g.id)}">${escapeHtml(g.name)}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">بيانات الطلاب بصيغة CSV أو لصق نصي:</label>
          <div style="font-size: 0.78rem; color: var(--centrly-text); margin-bottom: 0.4rem;">
            اكتب كل طالب في سطر بالترتيب: <code>اسم الطالب, رقم ولي الأمر, رقم هاتف الطالب (اختياري)</code>
          </div>
          <textarea id="importCsvText" class="form-input" rows="6" placeholder="اسم الطالب, رقم ولي الأمر, رقم هاتف الطالب" style="font-family: inherit; font-size: 0.85rem;" dir="rtl"></textarea>
        </div>
        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">أو رفع ملف CSV من جهازك:</label>
          <input type="file" id="importCsvFile" accept=".csv,text/csv" class="form-input" onchange="window.centrlyApp.handleCsvFileSelected(this)">
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="importStudentsForm" class="btn btn-primary" style="font-weight: 700;">بدء استيراد الطلاب</button>
    `;
    this.showModal('استيراد قائمة الطلاب من Excel / CSV', bodyHtml, footerHtml);
  }

  handleCsvFileSelected(input) {
    const file = input.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target.result;
      const textarea = document.getElementById('importCsvText');
      if (textarea) textarea.value = text;
    };
    reader.readAsText(file);
  }

  async handleImportStudents(e) {
    e.preventDefault();
    const groupId = document.getElementById('importGroupId')?.value;
    const csvContent = document.getElementById('importCsvText')?.value.trim();

    if (!csvContent) {
      this.showToast('يرجى كتابة أو رفع بيانات الطلاب المراد استيرادهم', 'warning');
      return;
    }

    const lines = csvContent.split(/\r?\n/).filter(line => line.trim().length > 0);
    const studentsToCreate = [];

    for (const line of lines) {
      const parts = line.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        const name = parts[0];
        const parentPhone = parts[1];
        const studentPhone = parts[2] || null;
        if (name && parentPhone && parentPhone.length >= 10) {
          studentsToCreate.push({ name, parent_phone: parentPhone, student_phone: studentPhone });
        }
      }
    }

    if (studentsToCreate.length === 0) {
      this.showToast('لم يتم العثور على أسطر صالحة. تأكد أن كل سطر يحتوي على: اسم الطالب, رقم ولي الأمر', 'danger');
      return;
    }

    this.closeModal();
    this.showToast(`جارٍ استيراد (${studentsToCreate.length}) طالب إلى المجموعة...`, 'info');

    let importedCount = 0;
    for (const st of studentsToCreate) {
      try {
        const res = await request('/students', {
          method: 'POST',
          body: {
            name: st.name,
            parent_phone: st.parent_phone,
            student_phone: st.student_phone,
          },
        });
        if (res?.student) {
          if (groupId) {
            await request(`/groups/${groupId}/students`, {
              method: 'POST',
              body: { student_id: res.student.id },
            }).catch(() => {});
          }
          this.students.unshift(res.student);
          importedCount++;
        }
      } catch (err) {
        console.warn('Import student row failed:', err);
      }
    }

    this.showToast(`تم استيراد وإضافة (${importedCount}) طالب بنجاح!`, 'success');
    await this.loadRouteData('students');
  }
  async startSessionForGroup(gId, customRoom = null) {
    const cleanId = String(gId).replace(/^rec-/, '');
    const grp = (this.groups || []).find(g => g.id === cleanId);
    const assignedRoom = (customRoom !== null && customRoom !== undefined && customRoom !== '')
      ? customRoom
      : (grp?.room || grp?.room_name || '');
    this.showToast('جاري بدء وتجهيز الحصة...', 'info');

    let serverSession = null;

    // 1. Check if there is already an in_progress session on the server for this group FOR TODAY
    const todayStr = new Date().toISOString().split('T')[0];
    try {
      const activeRes = await request('/sessions?status=in_progress').catch(() => null);
      const activeList = Array.isArray(activeRes) ? activeRes : (activeRes?.sessions || []);
      const existing = activeList.find(s => s.group_id === cleanId && s.session_date === todayStr);
      if (existing) {
        serverSession = existing;
      }
    } catch (err) {
      console.warn('Check active sessions error:', err);
    }

    // 2. If no existing session, create a real session on server
    if (!serverSession) {
      try {
        let nextNum = 1;
        const pastRes = await request(`/sessions?group_id=${cleanId}`).catch(() => null);
        const pastList = Array.isArray(pastRes) ? pastRes : (pastRes?.sessions || []);
        if (pastList.length > 0) {
          const maxNum = Math.max(...pastList.map(s => Number(s.session_number) || 0));
          nextNum = maxNum + 1;
        }
        const createRes = await request('/sessions', {
          method: 'POST',
          body: {
            group_id: cleanId,
            session_number: nextNum,
            session_date: todayStr,
            ...(assignedRoom ? { room: assignedRoom } : {}),
          },
        });
        if (createRes && createRes.session) {
          serverSession = createRes.session;
        }
      } catch (err) {
        console.warn('Server session creation failed, continuing with local fallback:', err);
      }
    }

    // Fetch group students to pre-populate roster as "غائب" (absent)
    let groupStudents = (this.students || []).filter(s => s.group_id === cleanId || (Array.isArray(s.group_ids) && s.group_ids.includes(cleanId)));
    if (groupStudents.length === 0) {
      try {
        const studRes = await request(`/students?group_id=${cleanId}`).catch(() => null);
        if (studRes) {
          const list = Array.isArray(studRes) ? studRes : (studRes.students || []);
          if (list.length > 0) {
            groupStudents = list;
            list.forEach(st => {
              if (!this.students.find(existing => existing.id === st.id)) {
                this.students.push(st);
              }
            });
          }
        }
      } catch (err) {
        console.warn('Could not fetch group students for roster prefill:', err);
      }
    }

    const preRoster = groupStudents.map(s => ({
      id: s.id,
      student_id: s.id,
      code: s.code || s.student_code || (s.id ? s.id.slice(0, 4) : '—'),
      name: s.name,
      phone: s.phone || s.student_phone,
      parent_phone: s.parent_phone,
      attended: false,
      homework: 'none',
      quiz_score: null,
      comment: '',
      time: '',
      deliveryStatus: 'pending',
      sent: false,
    }));

    const sessionId = serverSession ? serverSession.id : `sess-${cleanId}`;
    this.sessionState = {
      id: sessionId,
      status: 'in_progress',
      session_number: serverSession?.session_number || 1,
      session_date: todayStr,
      room: assignedRoom || serverSession?.room || '',
      group: grp || (serverSession?.groups ? serverSession.groups : { id: cleanId, name: 'حصة دراسية', price: 100 }),
      attendanceList: preRoster,
      financials: {
        totalRevenue: 0,
        attendeeCount: 0,
        absentCount: preRoster.length,
        exemptCount: 0,
        makeupCount: 0,
      },
    };

    this.persistSessionState();
    this.startLiveSessionSync();
    this.updateNavbarBadge();
    this.navigate('sessions');
  }
  viewGroupDetails(groupId) {
    this.currentRoute = 'students';
    this.renderMainContent();
    this.loadRouteData('students').then(() => {
      const filter = document.getElementById('studentGroupFilter');
      if (filter) {
        filter.value = groupId;
        this.filterStudentsTable();
      }
    });
  }

  // DEV-56: Teacher Calendar Controls
  switchCalendarView(view) {
    this.calendarState.view = view;
    this.renderMainContent();
  }

  selectCalendarDay(dayKey) {
    this.calendarState.selectedDayName = dayKey;
    this.renderMainContent();
  }

  updateCalendarDateLabel() {
    const offset = Number(this.calendarState.weekOffset) || 0;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const daysSinceSat = (dayOfWeek + 1) % 7;
    const sat = new Date(now);
    sat.setDate(now.getDate() - daysSinceSat + (offset * 7));
    const fri = new Date(sat);
    fri.setDate(sat.getDate() + 6);

    const arabicMonthNames = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];

    const startStr = `${sat.getDate()} ${arabicMonthNames[sat.getMonth()]}`;
    const endStr = `${fri.getDate()} ${arabicMonthNames[fri.getMonth()]} ${fri.getFullYear()}`;
    this.calendarState.dateLabel = `أسبوع ${startStr} - ${endStr}`;
  }

  calendarPrev() {
    this.calendarState.weekOffset = (this.calendarState.weekOffset || 0) - 1;
    this.updateCalendarDateLabel();
    this.renderMainContent();
  }

  calendarNext() {
    this.calendarState.weekOffset = (this.calendarState.weekOffset || 0) + 1;
    this.updateCalendarDateLabel();
    this.renderMainContent();
  }

  calendarToday() {
    this.calendarState.weekOffset = 0;
    const jsDayToDayName = {
      0: 'الأحد',
      1: 'الإثنين',
      2: 'الثلاثاء',
      3: 'الأربعاء',
      4: 'الخميس',
      5: 'الجمعة',
      6: 'السبت',
    };
    this.calendarState.selectedDayName = jsDayToDayName[new Date().getDay()] || 'السبت';
    this.updateCalendarDateLabel();
    this.renderMainContent();
    this.showToast('عرض جدول اليوم الحالي', 'info');
  }

  filterCalendarByGroup(groupId) {
    this.calendarState.selectedGroup = groupId;
    this.renderMainContent();
  }

  // ==========================================================================
  // DEV-79: Center Owner Dashboard Actions
  // ==========================================================================

  switchCenterTab(tab) {
    this.centerDashboardState.activeTab = tab;
    this.renderMainContent();
  }

  async changeCenterPeriod(period) {
    this.centerDashboardState.period = period;
    this.renderMainContent();
    await this.loadRouteData('center-dashboard');
  }

  async toggleTeacherPayout(teacherId, arg2, arg3, arg4) {
    let period = this.centerDashboardState.period || new Date().toISOString().slice(0, 7);
    let markPaid = true;
    let teacherName = 'المعلم';
    let amount = 0;

    if (typeof arg4 === 'boolean') {
      teacherName = arg2;
      amount = arg3;
      markPaid = arg4;
    } else {
      period = arg2;
      markPaid = arg3 !== 'paid';
    }

    const nextStatus = markPaid ? 'paid' : 'unpaid';
    const actionText = markPaid ? 'تسجيل صرف مستحقات' : 'إلغاء تأكيد صرف مستحقات';

    this.showConfirmModal({
      title: `${actionText} (${teacherName})`,
      message: `هل أنت متأكد من ${actionText} لشهر (${period})؟`,
      confirmText: markPaid ? 'تأكيد الصرف' : 'إلغاء الصرف',
      cancelText: 'إلغاء',
      isDanger: !markPaid,
      onConfirm: async () => {
        try {
          await request('/centers/financials/payouts', {
            method: 'POST',
            body: {
              teacher_id: teacherId,
              period,
              status: nextStatus,
              is_paid: markPaid,
              amount: Number(amount) || undefined,
              notes: markPaid ? 'تم الصرف من لوحة الإدارة' : null,
            },
          });

          if (this.centerDashboardState.rollup) {
            const rep = this.centerDashboardState.rollup.reports.find(r => r.teacher.id === teacherId);
            if (rep && rep.payout) {
              rep.payout.status = nextStatus;
              rep.payout.is_paid = markPaid;
              if (markPaid) {
                rep.payout.paid_at = new Date().toISOString();
              } else {
                rep.payout.paid_at = null;
              }
            }
          }
          this.showToast(`تم ${actionText} بنجاح!`, 'success');
          this.renderMainContent();
        } catch (err) {
          this.showToast(`فشل تحديث حالة الصرف: ${err.message || 'حدث خطأ'}`, 'danger');
        }
      },
    });
  }

  // ==========================================================================
  // Center Multi-Sessions & Dedicated Pages (Teachers, Assistants, Rooms)
  // ==========================================================================

  async handleCenterFrontDeskScan(e) {
    e.preventDefault();
    const input = document.getElementById('centerBarcodeScanInput');
    const barcode = input?.value.trim();
    if (!barcode) return;

    try {
      const res = await request('/centers/front-desk/scan', {
        method: 'POST',
        body: { barcode },
      });

      this.centerSessionsState.scanResult = res;
      if (res.success) {
        this.playScanBeep('success');
        this.showToast(res.message || 'تم رصد الحضور والتوجيه بنجاح!', 'success');
        await this.loadRouteData('center-sessions');
      } else {
        this.playScanBeep('error');
        this.showToast(res.message || 'تعذر التعرف على الطالب', 'warning');
      }
      if (input) input.value = '';
      this.renderMainContent();
    } catch (err) {
      this.playScanBeep('error');
      this.centerSessionsState.scanResult = {
        success: false,
        message: err.message || 'خطأ في عملية المسح',
      };
      this.showToast(`خطأ في المسح: ${err.message || 'تعذر الاتصال'}`, 'danger');
      this.renderMainContent();
    }
  }

  openCenterStartSessionModal() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)} (مستر ${escapeHtml(g.teacher_name || 'المعلم')})</option>`).join('');
    const roomOptions = (this.centerRooms || []).map(r => `<option value="${r.id}">${escapeHtml(r.name)} (سعة ${r.capacity} طالب)</option>`).join('');

    const bodyHtml = `
      <form id="centerStartSessionForm" onsubmit="window.centrlyApp.handleCenterStartSessionSubmit(event)">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">المجموعة الدراسية والمعلم *</label>
          <select id="centerModalGroupSelect" class="form-select" required>
            ${groupOptions || '<option value="">لا توجد مجاميع</option>'}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label">القاعة المخصصة *</label>
          <select id="centerModalRoomSelect" class="form-select" required>
            ${roomOptions || '<option value="">لا توجد قاعات</option>'}
          </select>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.5rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 700;">تشغيل الحصة الآن</button>
        </div>
      </form>
    `;

    this.showModal('تشغيل حصة جديدة في قاعة بالسنتر', bodyHtml);
  }

  async handleCenterStartSessionSubmit(e) {
    e.preventDefault();
    const groupId = document.getElementById('centerModalGroupSelect')?.value;
    const roomId = document.getElementById('centerModalRoomSelect')?.value;
    if (!groupId) return;

    this.closeModal();
    await this.startCenterSession(groupId, roomId);
  }

  async startCenterSession(groupId, roomId) {
    const grp = (this.groups || []).find(g => g.id === groupId);
    const room = (this.centerRooms || []).find(r => r.id === roomId);
    const teacher = (this.centerTeachers || []).find(t => t.id === grp?.teacher_id);

    try {
      const todayStr = new Date().toISOString().split('T')[0];
      const res = await request('/sessions', {
        method: 'POST',
        body: {
          group_id: groupId,
          session_number: 1,
          session_date: todayStr,
          room_id: roomId || null,
        },
      }).catch(() => null);

      const newSess = {
        id: res?.session?.id || `sess-${Date.now()}`,
        group_id: groupId,
        group_name: grp?.name || 'حصة جديدة',
        subject: grp?.subject || 'عامة',
        teacher_name: teacher?.name || grp?.teacher_name || 'المعلم',
        room_name: room?.name || 'القاعة الرئيسية',
        present_count: 0,
        session_number: res?.session?.session_number || 1,
      };

      if (!this.centerSessionsState.activeSessions) this.centerSessionsState.activeSessions = [];
      this.centerSessionsState.activeSessions.unshift(newSess);
      this.showToast(`تم بدء تشغيل الحصة بنجاح في (${newSess.room_name})!`, 'success');
      this.renderMainContent();
    } catch (err) {
      this.showToast(`تعذر تشغيل الحصة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  promptCenterEndSession(sessionId) {
    this.showConfirmModal({
      title: 'تأكيد إنهاء الحصة',
      message: 'هل أنت متأكد من إنهاء هذه الحصة وإخلاء القاعة بالسنتر؟',
      confirmText: 'إنهاء الحصة',
      cancelText: 'إلغاء',
      isDanger: true,
      onConfirm: async () => {
        try {
          await request(`/sessions/${sessionId}/end`, { method: 'POST' }).catch(() => {});
          this.centerSessionsState.activeSessions = (this.centerSessionsState.activeSessions || []).filter(s => s.id !== sessionId);
          this.showToast('تم إنهاء الحصة بنجاح وإخلاء القاعة.', 'success');
          this.renderMainContent();
        } catch (err) {
          this.showToast(`فشل إنهاء الحصة: ${err.message || 'حدث خطأ'}`, 'danger');
        }
      },
    });
  }

  viewCenterSessionDetails(sessionId) {
    this.showToast(`كود الحصة: ${sessionId.slice(0, 8)}`, 'info');
  }

  viewTeacherGroups(teacherId) {
    this.navigate('groups');
  }

  openAddTeacherModal() {
    this.openAddTeacherModalDirect();
  }

  openAddAssistantModal() {
    this.openAddAssistantModalDirect();
  }

  openAddRoomModal() {
    this.openAddRoomModalDirect();
  }

  openAddTeacherModalDirect() {
    const bodyHtml = `
      <form id="modalAddTeacherForm" onsubmit="window.centrlyApp.handleModalAddTeacherSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">اسم المعلم بالكامل *</label>
          <input type="text" id="modalTeacherName" class="form-input" placeholder="اسم المعلم بالكامل" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">رقم الهاتف *</label>
          <input type="tel" id="modalTeacherPhone" class="form-input" placeholder="010..." dir="ltr" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">المادة الدراسية</label>
          <input type="text" id="modalTeacherSubject" class="form-input" placeholder="المادة الدراسية">
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">نظام المحاسبة الافتراضي</label>
          <select id="modalTeacherRevenueModel" class="form-select">
            <option value="percentage">نسبة سنتر (مئوية %)</option>
            <option value="fixed_per_student">أجر ثابت لكل طالب (ج.م)</option>
            <option value="fixed_rent">إيجار قاعة ثابت لكل حصة (ج.م)</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">القيمة (النسبة % أو المبلغ ج.م)</label>
          <input type="number" id="modalTeacherRevenueValue" class="form-input" value="20" min="0">
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 700;">إضافة المعلم الآن</button>
        </div>
      </form>
    `;
    this.showModal('إضافة معلم جديد في السنتر', bodyHtml);
  }

  async handleModalAddTeacherSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('modalTeacherName')?.value.trim();
    const phone = document.getElementById('modalTeacherPhone')?.value.trim();
    const subject = document.getElementById('modalTeacherSubject')?.value.trim();
    const revenue_model = document.getElementById('modalTeacherRevenueModel')?.value;
    const revenue_value = parseFloat(document.getElementById('modalTeacherRevenueValue')?.value) || 0;

    if (!name || !phone) {
      this.showToast('يرجى إدخال اسم المعلم ورقم هاتفه', 'error');
      return;
    }

    try {
      await request('/centers/teachers', {
        method: 'POST',
        body: {
          name,
          phone,
          subjects: subject ? [subject] : ['عام'],
          revenue_model,
          revenue_value,
          onboarding_method: 'invite_link',
        },
      });
      this.closeModal();
      this.showToast(`تمت إضافة المعلم (${name}) بنجاح!`, 'success');
      await this.loadRouteData('center-teachers');
    } catch (err) {
      this.showToast(`فشل إضافة المعلم: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  openAddAssistantModalDirect() {
    const teacherOptions = (this.centerTeachers || []).map(t => `<option value="${t.id}">${escapeHtml(t.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddAssistantForm" onsubmit="window.centrlyApp.handleModalAddAssistantSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">اسم المساعد بالكامل *</label>
          <input type="text" id="modalAssistantName" class="form-input" placeholder="اسم المساعد" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">رقم الهاتف *</label>
          <input type="tel" id="modalAssistantPhone" class="form-input" placeholder="011..." dir="ltr" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">التبعية (سنتر أم معلم معين) *</label>
          <select id="modalAssistantType" class="form-select" onchange="document.getElementById('modalAssistantTeacherGroup').style.display = (this.value === 'assistant_to_teacher' ? 'block' : 'none')">
            <option value="assistant_to_center">مساعد تابع لإدارة السنتر</option>
            <option value="assistant_to_teacher">مساعد خاص بمعلم محدد</option>
          </select>
        </div>
        <div id="modalAssistantTeacherGroup" class="form-group" style="margin-bottom: 0.75rem; display: none;">
          <label class="form-label">المعلم التابع له</label>
          <select id="modalAssistantTeacherId" class="form-select">
            <option value="">اختر المعلم...</option>
            ${teacherOptions}
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">المرتب الشهري / الأجر (ج.م)</label>
          <input type="number" id="modalAssistantSalary" class="form-input" placeholder="المرتب الشهري (ج.م)" min="0" value="0">
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label style="display: flex; align-items: center; gap: 0.5rem; font-size: 0.85rem; cursor: pointer;">
            <input type="checkbox" id="modalAssistantFinancials">
            <span>منح صلاحية الاطلاع على تقارير الخزينة والمالية</span>
          </label>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 700;">إضافة المساعد الآن</button>
        </div>
      </form>
    `;
    this.showModal('إضافة مساعد جديد في السنتر', bodyHtml);
  }

  async handleModalAddAssistantSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('modalAssistantName')?.value.trim();
    const phone = document.getElementById('modalAssistantPhone')?.value.trim();
    const assistant_type = document.getElementById('modalAssistantType')?.value;
    const teacher_id = document.getElementById('modalAssistantTeacherId')?.value || undefined;
    const salary = parseFloat(document.getElementById('modalAssistantSalary')?.value) || 0;
    const can_view_financials = document.getElementById('modalAssistantFinancials')?.checked ?? false;

    if (!name || !phone) {
      this.showToast('يرجى إدخال اسم المساعد ورقم الهاتف', 'error');
      return;
    }

    try {
      await request('/centers/assistants', {
        method: 'POST',
        body: {
          name,
          phone,
          assistant_type,
          teacher_id: assistant_type === 'assistant_to_teacher' ? teacher_id : undefined,
          salary,
          can_view_financials,
        },
      });
      this.closeModal();
      this.showToast(`تمت إضافة المساعد (${name}) بنجاح!`, 'success');
      await this.loadRouteData('center-assistants');
    } catch (err) {
      this.showToast(`فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  openAddRoomModalDirect() {
    const bodyHtml = `
      <form id="modalAddRoomForm" onsubmit="window.centrlyApp.handleModalAddRoomSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">اسم القاعة *</label>
          <input type="text" id="modalRoomName" class="form-input" placeholder="اسم القاعة" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">السعة الاستيعابية القصوى (عدد الطلاب) *</label>
          <input type="number" id="modalRoomCapacity" class="form-input" placeholder="السعة الاستيعابية" min="1" required>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end; margin-top: 1.25rem;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 700;">إضافة القاعة الآن</button>
        </div>
      </form>
    `;
    this.showModal('إضافة قاعة جديدة في السنتر', bodyHtml);
  }

  async handleModalAddRoomSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('modalRoomName')?.value.trim();
    const capacity = parseInt(document.getElementById('modalRoomCapacity')?.value, 10);

    if (!name || !capacity) {
      this.showToast('يرجى ملء اسم القاعة وسعتها', 'error');
      return;
    }

    try {
      await request('/centers/rooms', {
        method: 'POST',
        body: { name, capacity, hourly_rate: 0 },
      });
      this.closeModal();
      this.showToast(`تمت إضافة القاعة (${name}) بنجاح!`, 'success');
      await this.loadRouteData('center-rooms');
    } catch (err) {
      this.showToast(`فشل إضافة القاعة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  // ==========================================================================
  // Quizzes Management Actions (DEV-90)
  // ==========================================================================

  async switchQuizGroup(groupId) {
    this.quizzesState.selectedGroupId = groupId;
    this.renderMainContent();
    if (groupId) {
      try {
        const groupRes = await request(`/groups/${groupId}`).catch(() => null);
        if (groupRes?.students && Array.isArray(groupRes.students)) {
          groupRes.students.forEach(st => {
            st.group_id = groupId;
            const exists = this.students.find(s => s.id === st.id);
            if (exists) {
              exists.group_id = groupId;
              if (!exists.group_ids) exists.group_ids = [];
              if (!exists.group_ids.includes(groupId)) {
                exists.group_ids.push(groupId);
              }
            } else {
              this.students.push(st);
            }
          });
          this.renderMainContent();
        }
      } catch (e) {
        console.warn('Failed to load group students:', e);
      }
    }
  }

  selectQuizNumber(num) {
    this.quizzesState.currentQuizNumber = num;
    this.renderMainContent();
  }

  addNewQuiz() {
    const nextNum = (this.quizzesState.quizzes.length || 0) + 1;
    this.quizzesState.quizzes.push({
      id: nextNum,
      number: nextNum,
      title: `كويز ${nextNum}`,
      maxScore: 10,
      date: new Date().toISOString().slice(0, 10),
      skipped: false,
    });
    this.quizzesState.currentQuizNumber = nextNum;
    this.showToast(`تم إنشاء كويز ${nextNum} بنجاح!`, 'success');
    this.renderMainContent();
  }

  skipCurrentQuiz(num) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === num);
    if (quiz) {
      quiz.skipped = true;
      const nextNum = num + 1;
      let nextQuiz = this.quizzesState.quizzes.find(q => q.number === nextNum);
      if (!nextQuiz) {
        this.quizzesState.quizzes.push({
          id: nextNum,
          number: nextNum,
          title: `كويز ${nextNum}`,
          maxScore: 10,
          date: new Date().toISOString().slice(0, 10),
          skipped: false,
        });
      }
      this.quizzesState.currentQuizNumber = nextNum;
      this.showToast(`تم تخطي كويز ${num} والانتقال إلى كويز ${nextNum}.`, 'info');
      this.renderMainContent();
    }
  }

  async handleAddRoomSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('newRoomName')?.value.trim();
    const capacity = parseInt(document.getElementById('newRoomCapacity')?.value, 10);
    if (!name || !capacity) return;

    try {
      const res = await request('/centers/rooms', {
        method: 'POST',
        body: JSON.stringify({ name, capacity }),
      });
      if (!this.centerDashboardState.rooms) this.centerDashboardState.rooms = [];
      this.centerDashboardState.rooms.push(res.room || { id: res.id || `room-${Date.now()}`, name, capacity });
      this.renderMainContent();
      this.showToast('تمت إضافة القاعة بنجاح!', 'success');
    } catch (err) {
      this.showToast(`فشل إضافة القاعة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  async handleRoomConflictCheck(e) {
    e.preventDefault();
    const roomId = document.getElementById('conflictRoomSelect')?.value;
    const date = document.getElementById('conflictDate')?.value;
    const startTime = document.getElementById('conflictStartTime')?.value;
    const endTime = document.getElementById('conflictEndTime')?.value;
    const studentCount = parseInt(document.getElementById('conflictStudentCount')?.value, 10) || undefined;

    if (!roomId) {
      this.showToast('يرجى اختيار القاعة أولاً', 'info');
      return;
    }

    try {
      const res = await request('/centers/rooms/check-conflict', {
        method: 'POST',
        body: JSON.stringify({
          room_id: roomId,
          date,
          start_time: startTime,
          end_time: endTime,
          student_count: studentCount,
        }),
      });
      this.centerDashboardState.conflictCheckResult = res;
    } catch (err) {
      this.centerDashboardState.conflictCheckResult = null;
      this.showToast(`فشل فحص التعارض: ${err.message || 'حدث خطأ في الاتصال بالخدمة'}`, 'danger');
    }
    this.renderMainContent();
  }

  async handleFrontDeskScanSubmit(e) {
    e.preventDefault();
    const inputEl = document.getElementById('frontDeskBarcodeInput');
    const barcode = inputEl?.value.trim();
    if (!barcode) return;

    try {
      const res = await request('/centers/front-desk-scan', {
        method: 'POST',
        body: JSON.stringify({ barcode }),
      });
      this.centerDashboardState.frontDeskScanResult = res;
    } catch (err) {
      this.centerDashboardState.frontDeskScanResult = {
        success: false,
        code: 'SCAN_FAILED',
        message: err.message || 'تعذر الاتصال بخدمة التحقق',
        audio_alert: 'error',
      };
    }
    this.renderMainContent();
  }

  async handleAddTeacherSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('obTeacherName')?.value.trim();
    const phone = document.getElementById('obTeacherPhone')?.value.trim();
    const subjectsStr = document.getElementById('obTeacherSubjects')?.value.trim();
    const revenue_model = document.getElementById('obTeacherRevenueModel')?.value;
    const revenue_value = parseFloat(document.getElementById('obTeacherRevenueValue')?.value) || 0;
    const onboarding_method = document.getElementById('obTeacherMethod')?.value;
    const email = document.getElementById('obTeacherEmail')?.value.trim() || undefined;
    const password = document.getElementById('obTeacherPassword')?.value || undefined;

    const subjects = subjectsStr ? subjectsStr.split('،').map(s => s.trim()) : [];

    try {
      const res = await request('/centers/teachers', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          subjects,
          revenue_model,
          revenue_value,
          onboarding_method,
          email,
          password,
        }),
      });

      if (res.onboarding_method === 'invite_link' && res.invite_url) {
        this.centerDashboardState.generatedInvite = {
          name,
          invite_url: res.invite_url,
        };
      } else {
        this.showToast('تمت إضافة المدرس وتفعيل حسابه بنجاح!', 'success');
      }
    } catch (err) {
      this.showToast(`فشل إضافة المدرس: ${err.message || 'حدث خطأ أثناء حفظ بيانات المدرس'}`, 'danger');
    }
    this.renderMainContent();
  }

  async handleAddAssistantSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('obAssistantName')?.value.trim();
    const phone = document.getElementById('obAssistantPhone')?.value.trim();
    const assistant_type = document.getElementById('obAssistantType')?.value;
    const can_view_financials = document.getElementById('obAssistantFinancials')?.checked ?? false;

    try {
      await request('/centers/assistants', {
        method: 'POST',
        body: JSON.stringify({
          name,
          phone,
          assistant_type,
          can_view_financials,
        }),
      });
      this.showToast('تمت إضافة المساعد بنجاح!', 'success');
    } catch (err) {
      this.showToast(`فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
    this.renderMainContent();
  }

  copyInviteUrl(url) {
    this.copyToClipboard(url, 'تم نسخ رابط الدعوة بنجاح!', 'رابط الدعوة');
  }

  // ==========================================================================
  // Student Reports & Leaderboard Actions (DEV-80)
  // ==========================================================================

  switchReportsTab(tab) {
    this.reportsState.activeTab = tab;
    this.renderMainContent();
  }

  async handleReportsPeriodChange(month, year) {
    this.reportsState.period = { month: parseInt(month, 10), year: parseInt(year, 10) };
    await this.loadRouteData('reports');
  }

  async handleReportsGroupChange(groupId) {
    this.reportsState.selectedGroupId = groupId;
    await this.loadRouteData('reports');
  }

  async handleReportsSearch(query) {
    this.reportsState.searchQuery = query;
    await this.loadRouteData('reports');
  }

  handleBulkSendReports() {
    if (this.reportsState.isSubmittingBulk) return;
    this.showConfirmModal({
      title: 'إرسال التقارير الشهرية',
      message: 'هل تريد إرسال تقارير الأداء الشهرية لجميع أولياء الأمور عبر طابور رسائل الواتساب؟',
      confirmText: 'إرسال التقارير',
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        this.reportsState.isSubmittingBulk = true;
        this.renderMainContent();

        try {
          const res = await request('/reports/bulk-send', {
            method: 'POST',
            body: JSON.stringify({
              month: this.reportsState.period.month,
              year: this.reportsState.period.year,
              group_id: this.reportsState.selectedGroupId || undefined,
            }),
          });

          const currentMonth = this.reportsState.period.month;
          const currentYear = this.reportsState.period.year;
          const monthKey = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
          if (!this.reportsState.dispatchedMonths) this.reportsState.dispatchedMonths = {};
          this.reportsState.dispatchedMonths[monthKey] = {
            sentDate: new Date().toLocaleDateString('ar-EG'),
          };

          this.showToast(`${res.message || 'تم جدولة إرسال التقارير بنجاح'} (إجمالي الطلاب: ${res.total_students} | تمت الجدولة: ${res.queued_count})`, 'success');
        } catch (err) {
          this.showToast(`فشل جدولة إرسال التقارير الجماعية: ${err.message || 'خطأ في الخادم'}`, 'danger');
        } finally {
          this.reportsState.isSubmittingBulk = false;
          this.renderMainContent();
        }
      }
    });
  }

  async handleSendIndividualReport(studentId, studentName) {
    try {
      await request(`/reports/${studentId}/send`, {
        method: 'POST',
        body: JSON.stringify({
          month: this.reportsState.period.month,
          year: this.reportsState.period.year,
        }),
      });
      this.showToast(`تم إرسال التقرير الأكاديمي بنجاح لولي أمر الطالب ${studentName}`, 'success');
    } catch (err) {
      this.showToast(`فشل إرسال تقرير الطالب ${studentName}: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  async initOnboardingStep4() {
    try {
      const teacherParam = this.user?.teacher_id ? `?teacher_id=${encodeURIComponent(this.user.teacher_id)}` : '';
      const [qrRes, statusRes] = await Promise.all([
        request(`/whatsapp/qr${teacherParam}`).catch(() => null),
        request(`/whatsapp/status${teacherParam}`).catch(() => null),
      ]);

      const img = document.getElementById('obQrImage');
      const loading = document.getElementById('obQrLoading');
      const code = document.getElementById('obPairingCode');
      const badge = document.getElementById('obWaStatusBadge');

      if (statusRes?.status === 'connected' || qrRes?.status === 'connected') {
        if (badge) {
          badge.className = 'badge badge-success';
          badge.textContent = 'بوابة الإرسال متصلة وجاهزة';
        }
        if (loading) {
          loading.style.display = 'block';
          loading.textContent = 'الحساب متصل بالفعل وجاهز للاستخدام!';
        }
        return;
      }

      if (qrRes && qrRes.qr_base64 && img) {
        img.src = qrRes.qr_base64;
        img.style.display = 'block';
        if (loading) loading.style.display = 'none';
      }
      const pContainer = document.getElementById('obPairingContainer');
      const pCode = qrRes?.pairing_code ? String(qrRes.pairing_code).trim() : '';
      if (code && pCode && pCode.length <= 15 && !pCode.includes('@') && !pCode.includes(',')) {
        code.textContent = pCode;
        if (pContainer) pContainer.style.display = 'block';
      } else {
        if (code) code.textContent = '';
        if (pContainer) pContainer.style.display = 'none';
      }

      this.startWhatsAppStatusPolling('onboarding');
    } catch (err) {
      console.warn('initOnboardingStep4 error:', err);
    }
  }

  startWhatsAppStatusPolling(context = 'onboarding') {
    this.stopWhatsAppStatusPolling();
    this.waPollingInterval = setInterval(async () => {
      try {
        const teacherParam = this.user?.teacher_id ? `?teacher_id=${encodeURIComponent(this.user.teacher_id)}` : '';
        const status = await request(`/whatsapp/status${teacherParam}`);

        if (status && status.status === 'connected') {
          this.stopWhatsAppStatusPolling();

          if (context === 'onboarding') {
            const badge = document.getElementById('obWaStatusBadge');
            const loading = document.getElementById('obQrLoading');
            const img = document.getElementById('obQrImage');
            if (badge) {
              badge.className = 'badge badge-success';
              badge.textContent = 'تم الاتصال بنجاح وجاهز للإرسال!';
            }
            if (img) img.style.display = 'none';
            if (loading) {
              loading.style.display = 'block';
              loading.textContent = 'تم ربط واتساب بنجاح! جاري التوجيه للوحة التحكم...';
            }
            setTimeout(() => {
              this.finishOnboarding();
            }, 1500);
          } else if (context === 'settings') {
            const badge = document.getElementById('settingsWaBadge');
            if (badge) {
              badge.className = 'badge badge-success';
              badge.textContent = `الخادم متصل وجاهز ${status.phone_number ? `(${status.phone_number})` : ''}`;
            }
            await this.loadRouteData('whatsapp');
          }
        }
      } catch (err) {
        // silent polling catch
      }
    }, 3000);
  }

  stopWhatsAppStatusPolling() {
    if (this.waPollingInterval) {
      clearInterval(this.waPollingInterval);
      this.waPollingInterval = null;
    }
  }

  async refreshWhatsAppQR() {
    try {
      const teacherParam = this.user?.teacher_id ? `?teacher_id=${encodeURIComponent(this.user.teacher_id)}` : '';
      const qrRes = await request(`/whatsapp/qr${teacherParam}`);
      const img = document.getElementById('settingsQrImage');
      const loading = document.getElementById('settingsQrLoading');
      const code = document.getElementById('settingsPairingCode');

      if (img && qrRes.qr_base64) {
        img.src = qrRes.qr_base64;
        img.style.display = 'block';
        if (loading) loading.style.display = 'none';
      }
      if (code) {
        const pCode = qrRes?.pairing_code ? String(qrRes.pairing_code).trim() : '';
        const parentDiv = code.closest('div');
        if (pCode && pCode.length <= 15 && !pCode.includes('@') && !pCode.includes(',')) {
          code.textContent = pCode;
          if (parentDiv) parentDiv.style.display = 'block';
        } else {
          code.textContent = '';
          if (parentDiv) parentDiv.style.display = 'none';
        }
      }
      this.startWhatsAppStatusPolling('settings');
    } catch (err) {
      this.showToast('فشل تحديث رمز QR: ' + (err.message || 'خطأ في الاتصال'), 'danger');
    }
  }

  disconnectWhatsApp() {
    this.showConfirmModal({
      title: 'إلغاء ربط واتساب',
      message: 'هل أنت متأكد من رغبتك في إلغاء ربط حساب واتساب؟ ستحتاج إلى مسح رمز QR مجدداً لإعادة تفعيل الإشعارات.',
      confirmText: 'إلغاء الربط',
      cancelText: 'تراجع',
      isDanger: true,
      onConfirm: async () => {
        try {
          const teacherParam = this.user?.teacher_id ? `?teacher_id=${encodeURIComponent(this.user.teacher_id)}` : '';
          await request(`/whatsapp/disconnect${teacherParam}`, { method: 'POST' });
          this.showToast('تم فصل الحساب بنجاح. يرجى مسح رمز QR لإعادة الربط.', 'info');
          await this.loadRouteData('whatsapp');
        } catch (err) {
          this.showToast('فشل فصل الحساب: ' + (err.message || 'خطأ غير متوقع'), 'danger');
        }
      }
    });
  }

  reconnectWhatsApp() {
    this.refreshWhatsAppQR();
  }

  async sendTestWhatsAppMessage(e) {
    e.preventDefault();
    const phoneInput = document.getElementById('testPhoneInput');
    const msgInput = document.getElementById('testMsgInput');
    const btn = document.getElementById('btnSendTestMsg');
    const feedback = document.getElementById('testMsgFeedback');

    const phone = phoneInput?.value?.trim();
    const message = msgInput?.value?.trim();

    if (!phone) {
      this.showToast('يرجى إدخال رقم هاتف صحيح', 'danger');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جارٍ الإرسال...';
    }
    if (feedback) feedback.style.display = 'none';

    try {
      await request('/whatsapp/test', {
        method: 'POST',
        body: JSON.stringify({ phone, message }),
      });
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#f0fdf4';
        feedback.style.color = '#15803d';
        feedback.style.border = '1px solid #bbf7d0';
        feedback.innerHTML = `تم إرسال الرسالة الاختبارية بنجاح إلى الرقم <strong>${escapeHtml(phone)}</strong>!`;
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#b91c1c';
        feedback.style.border = '1px solid #fecaca';
        feedback.innerHTML = `فشل إرسال الرسالة: ${escapeHtml(err.message || 'خطأ في الاتصال')}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'إرسال الآن';
      }
    }
  }

  // ==========================================================================
  // Risk Watchlist Actions (DEV-62)
  // ==========================================================================

  dispatchSingleRiskAlert(studentId, studentName) {
    this.showConfirmModal({
      title: 'إرسال تنبيه واتساب فوري',
      message: `هل تريد إرسال تنبيه واتساب فوري لولي أمر الطالب (${studentName}) بشأن الغياب أو الملاحظات؟`,
      confirmText: 'إرسال التنبيه',
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        try {
          await request(`/at-risk/alerts/${studentId}`, {
            method: 'POST',
            body: JSON.stringify({
              alert_type: 'absence_warning',
              custom_message: `تحية طيبة، نود إحاطة سيادتكم علماً بتسجيل غياب أو ملاحظات متابعة للطالب ${studentName}، يرجى التواصل معنا للاطمئنان عليه.`
            }),
          });
          this.showToast(`تم إرسال إنذار المتابعة بنجاح لولي أمر الطالب: ${studentName}`, 'success');
        } catch (err) {
          this.showToast(`تعذر إرسال التنبيه: ${err.message || 'خطأ في الخادم'}`, 'danger');
        }
      }
    });
  }

  // ==========================================================================
  // Billing & Subscription Actions (DEV-SL.3 & DEV-39)
  // ==========================================================================

  setBillingCycle(cycle = 'monthly') {
    this.billingCycle = cycle;
    this.renderMainContent();
  }

  showQuotaBlockedModal(currentCount, limit) {
    const existing = document.getElementById('quotaBlockedModal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="quotaBlockedModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; z-index: 9999; padding: 1rem;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: 0; text-align: center; padding: 2rem; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25); font-family: 'Cairo', sans-serif;">
          <div style="width: 56px; height: 56px; margin: 0 auto 1rem; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900;">
            !
          </div>
          <h3 style="font-size: 1.3rem; font-weight: 900; color: #991b1b; margin: 0 0 0.5rem 0;">
            تم الوصول للحد الأقصى لباقتك
          </h3>
          <p style="font-size: 0.9rem; color: #475569; line-height: 1.6; margin: 0 0 1.25rem 0;">
            لقد استهلكت كامل سعة الطلاب المتاحة في باقتك (<strong>${currentCount} من أصل ${limit} طالب</strong>) وتجاوزت فترة السماح المحددة بـ 3 أيام.
            <br>
            لمواصلة إضافة الطلاب الجدد، يرجى ترقية باقتك إلى باقة أعلى (750 أو 1500 طالب).
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center;">
            <button class="btn btn-secondary" onclick="document.getElementById('quotaBlockedModal')?.remove()">إغلاق</button>
            <button class="btn btn-primary" onclick="document.getElementById('quotaBlockedModal')?.remove(); window.centrlyApp.navigate('billing');" style="background: #2563eb; font-weight: 800;">
              ترقية الباقة الآن
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  contactEnterpriseWhatsApp() {
    const phone = '201010979708';
    const message = encodeURIComponent('السلام عليكم، عايز أعمل باقة فوق 1500 طالب ومحتاج أعرف التفاصيل والأسعار.');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  }

  openPlanChoiceModal() {
    const isYearly = (this.billingCycle === 'yearly');
    const userPlanName = this.billingState?.plan_name || 'باقة 300 طالب';
    const plans = [
      { name: 'باقة 300 طالب', monthly: 399, yearly: 3830 },
      { name: 'باقة 750 طالب', monthly: 799, yearly: 7670 },
      { name: 'باقة 1500 طالب', monthly: 1299, yearly: 12470 },
    ];
    const currentMatched = plans.find(p => userPlanName.includes(p.name)) || plans[0];
    const currentPrice = isYearly ? currentMatched.yearly : currentMatched.monthly;

    const bodyHtml = `
      <div style="font-family: 'Cairo', sans-serif; text-align: center; padding: 0.5rem 0;">
        <h4 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">
          ما الذي ترغب في القيام به اليوم؟
        </h4>
        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem; line-height: 1.6;">
          يمكنك تجديد باقتك الحالية مباشرة بنفس المميزات أو الاطلاع على الباقات الأخرى للترقية لعدد طلاب أكبر.
        </p>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Option 1: Renew Current Plan -->
          <div style="border: 2px solid var(--centrly-blue-700); background: #eff6ff; border-radius: 12px; padding: 1.25rem; text-align: right; cursor: pointer; transition: all 0.2s;" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openPaymentProofModal('${currentMatched.name}', ${currentPrice}, '${isYearly ? 'yearly' : 'monthly'}');">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <strong style="font-size: 1.05rem; color: var(--centrly-blue-800);">تجديد باقتي الحالية (${currentMatched.name})</strong>
              <span class="badge badge-primary" style="font-weight: 800;">${Number(currentPrice).toLocaleString('ar-EG')} ج.م ${isYearly ? '/ سنوياً' : '/ شهرياً'}</span>
            </div>
            <p style="font-size: 0.8rem; color: #475569; margin: 0;">
              المتابعة بنفس عدد الطلاب الحالي وتمديد فترة الاشتراك فوراً.
            </p>
          </div>

          <!-- Option 2: Change / Upgrade Plan -->
          <div style="border: 1.5px solid #cbd5e1; background: #ffffff; border-radius: 12px; padding: 1.25rem; text-align: right; cursor: pointer; transition: all 0.2s;" onclick="window.centrlyApp.closeModal(); const el = document.getElementById('pricingPlansSection'); if (el) el.scrollIntoView({ behavior: 'smooth' });">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <strong style="font-size: 1.05rem; color: #0f172a;">ترقية أو تغيير الباقة</strong>
              <span class="badge badge-secondary" style="font-weight: 700;">اختيار سعة جديدة</span>
            </div>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
              استعراض باقات الـ 750 والـ 1500 طالب والاشتراك السنوي بخصم 20%.
            </p>
          </div>
        </div>
      </div>
    `;

    this.showModal('تجديد أو ترقية الاشتراك', bodyHtml);
  }

  openPaymentProofModal(planName = 'باقة 300 طالب', amount = 399, billingCycle = 'monthly') {
    const existing = document.getElementById('paymentProofModal');
    if (existing) existing.remove();

    this.currentProofImageData = null;
    this.appliedCouponCode = null;
    this.originalAmount = Number(amount);
    this.currentEffectiveAmount = Number(amount);

    const isYearly = (billingCycle === 'yearly');
    const periodLabel = isYearly ? 'اشتراك سنوي (خصم 20%)' : 'اشتراك شهري';

    const modalHtml = `
      <div id="paymentProofModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 9999; padding: 1rem; overflow-y: auto;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: auto; animation: modalFadeIn 0.2s ease-out; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); font-family: 'Cairo', sans-serif; border-radius: 16px;">
          <div class="card-header" style="border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div>
              <h3 class="card-title" style="margin: 0; font-size: 1.15rem; font-weight: 800;">الاشتراك في ${escapeHtml(planName)}</h3>
              <p id="proofAmountSummary" style="font-size: 0.85rem; color: var(--centrly-text); margin: 0.25rem 0 0 0;">
                المبلغ المطلوب: <strong id="proofDisplayAmount" style="color: var(--centrly-blue-700);">${Number(amount).toLocaleString('ar-EG')} ج.م</strong> (${periodLabel})
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closePaymentProofModal()" style="border: none; cursor: pointer; padding: 0.35rem 0.6rem; display: flex; align-items: center;">${getIcon('close', 16, '#64748b')}</button>
          </div>

          <form onsubmit="window.centrlyApp.handleSubmitPaymentProof(event, ${amount}, '${planName}', '${billingCycle}')">
            
            <!-- Transfer Number Card -->
            <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 0.9rem 1.1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.825rem; color: #166534; font-weight: 700; margin-bottom: 0.35rem;">
                رقم التحويل (إنستاباي أو محفظة إلكترونية):
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div style="font-family: monospace; font-size: 1.35rem; font-weight: 900; color: #15803d; direction: ltr; letter-spacing: 1px;">
                  01010979708
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.copyToClipboard('01010979708', 'تم نسخ الرقم 01010979708 بنجاح!', 'رقم التحويل')" style="font-weight: 800; font-size: 0.8rem; background: #ffffff; border-color: #86efac; color: #166534;">
                  نسخ الرقم
                </button>
              </div>
              <div id="proofTransferInstruction" style="font-size: 0.775rem; color: #4b5563; margin-top: 0.4rem; line-height: 1.5;">
                قم بتحويل المبلغ <strong>(${Number(amount).toLocaleString('ar-EG')} ج.م)</strong> إلى هذا الرقم عبر إنستاباي أو من محفظتك، ثم أرفق الاسكرين شوت أدناه.
              </div>
            </div>

            <!-- Discount Coupon Section -->
            <div style="margin-bottom: 1rem; background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 10px; padding: 0.75rem 0.9rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.825rem; color: #334155; margin-bottom: 0.35rem; display: flex; align-items: center; gap: 0.35rem;">
                <span>${getIcon('gift', 14, 'var(--centrly-blue-700)')}</span>
                <span>لديك كود هدية أو كوبون خصم؟</span>
              </label>
              <div style="display: flex; gap: 0.4rem;">
                <input type="text" id="couponCodeInput" class="form-input" placeholder="اكتب كود الخصم" style="flex: 1; text-transform: uppercase; font-weight: 700; font-family: monospace; font-size: 0.85rem;" autocomplete="off">
                <button type="button" id="btnApplyCoupon" class="btn btn-secondary" onclick="window.centrlyApp.applyCouponCode()" style="font-weight: 800; font-size: 0.825rem; padding: 0.4rem 1rem; border-color: var(--centrly-blue-700); color: var(--centrly-blue-700); cursor: pointer;">
                  تطبيق
                </button>
              </div>
              <div id="couponFeedback" style="display: none; font-size: 0.78rem; font-weight: 700; margin-top: 0.4rem; padding: 0.3rem 0.5rem; border-radius: 6px;"></div>
            </div>

            <!-- Transfer Method Selection -->
            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">طريقة التحويل المستخدمة</label>
              <select id="proofPaymentMethod" class="form-input" style="width: 100%;" required>
                <option value="instapay">إنستاباي (InstaPay)</option>
                <option value="vodafone_cash">محفظة إلكترونية (فودافون كاش / محافظ المحمول)</option>
              </select>
            </div>

            <!-- Screenshot Upload (Primary) -->
            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                <span>إرفاق الاسكرين شوت (صورة إيصال التحويل)</span>
                <span style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">مطلوب</span>
              </label>

              <input type="file" id="proofImageFile" accept="image/*" style="display: none;" onchange="window.centrlyApp.handleProofImageSelected(this)">

              <div id="proofDropzone" onclick="document.getElementById('proofImageFile').click()" style="border: 2px dashed #cbd5e1; border-radius: 12px; padding: 1.25rem 1rem; text-align: center; cursor: pointer; background: #f8fafc; transition: all 0.2s ease;">
                <div style="font-size: 0.95rem; font-weight: 800; color: var(--centrly-blue-700); margin-bottom: 0.25rem;">
                  انقر هنا لاختيار الاسكرين شوت
                </div>
                <div style="font-size: 0.775rem; color: #64748b;">
                  أو اسحب وأفلت صورة التحويل هنا
                </div>
              </div>

              <div id="proofImagePreviewContainer" style="display: none; margin-top: 0.6rem; position: relative; border-radius: 12px; overflow: hidden; border: 1.5px solid #cbd5e1; background: #0f172a;">
                <img id="proofImagePreview" src="" alt="معاينة إيصال التحويل" style="width: 100%; max-height: 180px; object-fit: contain; display: block;">
                <button type="button" onclick="window.centrlyApp.removeProofImage()" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.95); color: white; border: none; border-radius: 6px; padding: 0.35rem 0.65rem; font-size: 0.75rem; font-weight: 800; cursor: pointer; font-family: 'Cairo', sans-serif;">
                  حذف الصورة
                </button>
              </div>
            </div>

            <!-- Optional reference or notes -->
            <div class="form-group" style="margin-bottom: 1rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">رقم المحفظة المحول منها أو رقم العملية (اختياري)</label>
              <input type="text" id="proofRefNumber" class="form-input" placeholder="رقم هاتفك المحول منه أو رقم العملية..." dir="ltr">
            </div>

            <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closePaymentProofModal()">إلغاء</button>
              <button type="submit" id="btnSubmitProof" class="btn btn-primary" style="font-weight: 700;">
                تأكيد وإرسال الإيصال
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup drag and drop for dropzone
    setTimeout(() => {
      const dropzone = document.getElementById('proofDropzone');
      if (dropzone) {
        dropzone.addEventListener('dragover', (ev) => {
          ev.preventDefault();
          dropzone.style.borderColor = 'var(--centrly-blue-700)';
          dropzone.style.background = '#eff6ff';
        });
        dropzone.addEventListener('dragleave', () => {
          dropzone.style.borderColor = '#cbd5e1';
          dropzone.style.background = '#f8fafc';
        });
        dropzone.addEventListener('drop', (ev) => {
          ev.preventDefault();
          dropzone.style.borderColor = '#cbd5e1';
          dropzone.style.background = '#f8fafc';
          if (ev.dataTransfer?.files?.length) {
            const fileInput = document.getElementById('proofImageFile');
            if (fileInput) {
              fileInput.files = ev.dataTransfer.files;
              this.handleProofImageSelected(fileInput);
            }
          }
        });
      }
    }, 50);
  }

  async applyCouponCode() {
    const codeInput = document.getElementById('couponCodeInput');
    const feedback = document.getElementById('couponFeedback');
    const applyBtn = document.getElementById('btnApplyCoupon');
    const displayAmount = document.getElementById('proofDisplayAmount');
    const transferInstruction = document.getElementById('proofTransferInstruction');
    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

    if (!code) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#dc2626';
        feedback.innerText = 'يرجى إدخال كود الخصم أولاً';
      }
      return;
    }

    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.innerText = 'تحقق...';
    }

    try {
      const res = await request('/billing/validate-coupon', {
        method: 'POST',
        body: { code, amount: this.originalAmount },
      });

      if (res && res.valid) {
        this.appliedCouponCode = res.gift_code?.code || code;
        this.currentEffectiveAmount = res.final_amount;

        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.background = '#ecfdf5';
          feedback.style.color = '#059669';
          feedback.innerText = `تم تطبيق الكود (${this.appliedCouponCode}) بنجاح! وفرت ${Number(res.discount_amount).toLocaleString('ar-EG')} ج.م`;
        }

        if (displayAmount) {
          displayAmount.innerHTML = `<span style="text-decoration: line-through; color: #94a3b8; font-size: 0.85rem; margin-left: 0.35rem;">${Number(this.originalAmount).toLocaleString('ar-EG')}</span> ${Number(res.final_amount).toLocaleString('ar-EG')} ج.م`;
        }

        if (transferInstruction) {
          transferInstruction.innerHTML = `قم بتحويل المبلغ المخفض <strong>(${Number(res.final_amount).toLocaleString('ar-EG')} ج.م)</strong> بعد تطبيق الخصم إلى هذا الرقم، ثم أرفق الاسكرين شوت أدناه.`;
        }

        if (codeInput) codeInput.disabled = true;
        if (applyBtn) {
          applyBtn.disabled = true;
          applyBtn.innerText = 'مفعّل ✓';
          applyBtn.style.background = '#10b981';
          applyBtn.style.color = '#ffffff';
          applyBtn.style.borderColor = '#10b981';
        }
      } else {
        throw new Error(res?.error?.message || 'كود الخصم غير صالح أو منتهي الصلاحية');
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#dc2626';
        feedback.innerText = err.message || 'كود الخصم غير صالح أو منتهي الصلاحية';
      }
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.innerText = 'تطبيق';
      }
    }
  }

  handleProofImageSelected(input) {
    const file = input?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('يرجى اختيار ملف صورة صالح (PNG أو JPG)', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        this.currentProofImageData = compressedDataUrl;

        const preview = document.getElementById('proofImagePreview');
        const container = document.getElementById('proofImagePreviewContainer');
        const dropzone = document.getElementById('proofDropzone');
        if (preview) {
          preview.src = compressedDataUrl;
        }
        if (container) {
          container.style.display = 'block';
        }
        if (dropzone) {
          dropzone.style.display = 'none';
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  removeProofImage() {
    this.currentProofImageData = null;
    const fileInput = document.getElementById('proofImageFile');
    if (fileInput) fileInput.value = '';
    const container = document.getElementById('proofImagePreviewContainer');
    if (container) container.style.display = 'none';
    const preview = document.getElementById('proofImagePreview');
    if (preview) preview.src = '';
    const dropzone = document.getElementById('proofDropzone');
    if (dropzone) dropzone.style.display = 'block';
  }

  closePaymentProofModal() {
    this.currentProofImageData = null;
    this.appliedCouponCode = null;
    const modal = document.getElementById('paymentProofModal');
    if (modal) modal.remove();
  }

  async handleSubmitPaymentProof(e, amount, planName = 'باقة 100 طالب', billingCycle = 'monthly') {
    e.preventDefault();
    const method = document.getElementById('proofPaymentMethod')?.value || 'instapay';
    const refNum = document.getElementById('proofRefNumber')?.value?.trim();
    const notes = document.getElementById('proofNotes')?.value?.trim() || null;
    const btn = document.getElementById('btnSubmitProof');

    if (!this.currentProofImageData && !refNum) {
      this.showToast('يرجى إرفاق صورة إيصال التحويل (الاسكرين شوت)', 'danger');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جارٍ التأكيد...';
    }

    const effectiveAmount = this.currentEffectiveAmount || Number(amount);
    const couponTag = this.appliedCouponCode ? `[كود خصم: ${this.appliedCouponCode}]` : '';
    const planTag = `[${planName} - ${billingCycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'}]`;
    const fullNotes = [planTag, couponTag, notes].filter(Boolean).join(' ');

    try {
      await request('/billing/payment-proof', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(effectiveAmount),
          payment_method: method,
          reference_number: refNum || null,
          proof_image_url: this.currentProofImageData || null,
          notes: fullNotes,
          coupon_code: this.appliedCouponCode || null,
        }),
      });

      if (!this.billingState) this.billingState = {};
      this.billingState.subscription_status = 'pending_verification';
      this.billingState.status = 'pending';

      this.closePaymentProofModal();
      this.showToast('تم استلام إيصال التحويل بنجاح! الحالة الآن قيد المراجعة (Pending).', 'success');
      this.renderMainContent();
      try {
        await this.loadRouteData('billing');
      } catch (_) {}
    } catch (err) {
      this.showToast(`فشل تسجيل إيصال الدفع: ${err.message || 'خطأ في الخادم'}`, 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'تأكيد وإرسال الإيصال';
      }
    }
  }

  // ==========================================================================
  // Promotional Codes & Coupons Management (Gift Codes)
  // ==========================================================================

  async loadCoupons() {
    const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
    if (!isAdmin) {
      this.giftCodes = [];
      return;
    }
    try {
      const res = await request('/admin/gift-codes').catch(async () => {
        return await request('/billing/gift-codes').catch(() => ({ gift_codes: [] }));
      });
      this.giftCodes = Array.isArray(res?.gift_codes) ? res.gift_codes : [];
    } catch (err) {
      console.warn('Failed to load gift codes:', err);
      this.giftCodes = [];
    }
  }

  openCreateCouponModal() {
    const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
    if (!isAdmin) {
      this.showToast('عذراً، إدارة أكواد الخصم متاحة فقط لمدير المنصة.', 'warning');
      return;
    }

    const existing = document.getElementById('createCouponModal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="createCouponModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 9999; padding: 1rem; overflow-y: auto;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: auto; animation: modalFadeIn 0.2s ease-out; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); font-family: 'Cairo', sans-serif; border-radius: 16px;">
          <div class="card-header" style="border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem; margin-bottom: 1rem; display: flex; justify-content: space-between; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="color: var(--centrly-blue-700);">${getIcon('billing', 20, 'var(--centrly-blue-700)')}</span>
              <div>
                <h3 class="card-title" style="margin: 0; font-size: 1.15rem; font-weight: 800;">إنشاء كود خصم جديد (Promo Code)</h3>
                <p style="font-size: 0.8rem; color: var(--centrly-text); margin: 0.15rem 0 0 0;">
                  يتفعل الكود فوراً في قاعدة البيانات السحابية المركزية.
                </p>
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeCreateCouponModal()" style="border: none; cursor: pointer; padding: 0.35rem 0.6rem; display: flex; align-items: center;">${getIcon('close', 16, '#64748b')}</button>
          </div>

          <form onsubmit="window.centrlyApp.handleCreateCoupon(event)">
            <div style="display: flex; flex-direction: column; gap: 1rem;">
              
              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">كود الخصم (رمز الكوبون بالإنجليزية)</label>
                <input type="text" id="couponInputCode" class="form-input" placeholder="مثال: SUMMER25 أو EID2026" required
                  style="text-transform: uppercase; font-family: monospace; font-weight: 800; letter-spacing: 0.05em; font-size: 1rem;"
                  autocomplete="off" oninput="this.value = this.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '')">
                <span style="font-size: 0.72rem; color: #64748b; margin-top: 0.25rem; display: block;">أحرف إنجليزية وأرقام فقط (يتحول تلقائياً لأحرف كبيرة).</span>
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">نوع الخصم</label>
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                  <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.8rem; border: 1.5px solid #cbd5e1; border-radius: 8px; cursor: pointer; background: #f8fafc;" id="couponTypeLabelPercent">
                    <input type="radio" name="couponDiscountType" value="percent" checked onchange="window.centrlyApp.handleCouponTypeChange('percent')">
                    <span style="font-weight: 700; font-size: 0.85rem;">نسبة مئوية (%)</span>
                  </label>
                  <label style="display: flex; align-items: center; gap: 0.5rem; padding: 0.6rem 0.8rem; border: 1.5px solid #cbd5e1; border-radius: 8px; cursor: pointer; background: #f8fafc;" id="couponTypeLabelFixed">
                    <input type="radio" name="couponDiscountType" value="fixed" onchange="window.centrlyApp.handleCouponTypeChange('fixed')">
                    <span style="font-weight: 700; font-size: 0.85rem;">مبلغ نقدي ثابت (ج.م)</span>
                  </label>
                </div>
              </div>

              <div class="form-group" style="margin: 0;">
                <label class="form-label" style="font-weight: 700; font-size: 0.85rem;" id="couponValueLabel">قيمة الخصم (النسبة المئوية %)</label>
                <div style="position: relative;">
                  <input type="number" id="couponInputValue" class="form-input" min="1" max="100" placeholder="مثال: 30" required style="font-weight: 800; font-size: 1rem; padding-left: 3rem;">
                  <span id="couponValueSuffix" style="position: absolute; left: 0.75rem; top: 50%; transform: translateY(-50%); font-weight: 800; color: #64748b;">%</span>
                </div>
              </div>

              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem;">
                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-weight: 700; font-size: 0.825rem;">أقصى عدد استخدامات</label>
                  <input type="number" id="couponInputMaxUses" class="form-input" min="1" placeholder="1000 (افتراضي)" value="1000">
                </div>

                <div class="form-group" style="margin: 0;">
                  <label class="form-label" style="font-weight: 700; font-size: 0.825rem;">تاريخ الانتهاء (اختياري)</label>
                  <input type="date" id="couponInputExpiresAt" class="form-input">
                </div>
              </div>

            </div>

            <div style="margin-top: 1.5rem; display: flex; justify-content: flex-end; gap: 0.65rem;">
              <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeCreateCouponModal()" style="font-weight: 700;">
                إلغاء
              </button>
              <button type="submit" id="btnSubmitCreateCoupon" class="btn btn-primary" style="font-weight: 800; padding: 0.65rem 1.5rem; display: inline-flex; align-items: center; gap: 0.4rem;">
                ${getIcon('plus', 16)}
                <span>حفظ وتفعيل الكود فوراً</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  handleCouponTypeChange(type) {
    const valInput = document.getElementById('couponInputValue');
    const label = document.getElementById('couponValueLabel');
    const suffix = document.getElementById('couponValueSuffix');
    if (!valInput || !label || !suffix) return;

    if (type === 'percent') {
      label.innerText = 'قيمة الخصم (النسبة المئوية %)';
      suffix.innerText = '%';
      valInput.max = '100';
      valInput.placeholder = 'مثال: 30';
    } else {
      label.innerText = 'قيمة الخصم (بالمبلغ النقدي بالجنيه)';
      suffix.innerText = 'ج.م';
      valInput.removeAttribute('max');
      valInput.placeholder = 'مثال: 150';
    }
  }

  closeCreateCouponModal() {
    const modal = document.getElementById('createCouponModal');
    if (modal) modal.remove();
  }

  async handleCreateCoupon(event) {
    event.preventDefault();
    const codeInput = document.getElementById('couponInputCode');
    const typeInput = document.querySelector('input[name="couponDiscountType"]:checked');
    const valueInput = document.getElementById('couponInputValue');
    const maxUsesInput = document.getElementById('couponInputMaxUses');
    const expiresInput = document.getElementById('couponInputExpiresAt');
    const submitBtn = document.getElementById('btnSubmitCreateCoupon');

    const code = (codeInput?.value || '').trim().toUpperCase();
    const type = typeInput?.value || 'percent';
    const numVal = Number(valueInput?.value || 0);
    const maxUses = maxUsesInput?.value ? Number(maxUsesInput.value) : 1000;
    const expiresAt = expiresInput?.value ? new Date(expiresInput.value).toISOString() : null;

    if (!code) {
      this.showToast('يرجى إدخال رمز كود الخصم', 'warning');
      return;
    }
    if (numVal <= 0) {
      this.showToast('يرجى إدخال قيمة صحيحة للخصم أكبر من صفر', 'warning');
      return;
    }

    const payload = {
      code,
      discount_percent: type === 'percent' ? numVal : null,
      discount_amount: type === 'fixed' ? numVal : null,
      max_uses: maxUses,
      expires_at: expiresAt,
      is_active: true,
    };

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = 'جاري الحفظ والتفعيل...';
    }

    try {
      await request('/billing/gift-codes', {
        method: 'POST',
        body: JSON.stringify(payload),
      }).catch(async () => {
        return await request('/admin/gift-codes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      });

      this.closeCreateCouponModal();
      this.showToast(`تم إنشاء وتفعيل كود الخصم (${code}) بنجاح!`, 'success');
      await this.loadCoupons();
      this.renderMainContent();
    } catch (err) {
      this.showToast(`تعذر إنشاء كود الخصم: ${err.message || 'حدث خطأ'}`, 'danger');
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = 'حفظ وتفعيل الكود فوراً';
      }
    }
  }

  async toggleCouponStatus(id, newStatus) {
    const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
    if (!isAdmin) return;
    try {
      await request(`/billing/gift-codes/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({ is_active: newStatus }),
      }).catch(async () => {
        return await request(`/admin/gift-codes/${id}`, {
          method: 'PATCH',
          body: JSON.stringify({ is_active: newStatus }),
        });
      });

      this.showToast(`تم ${newStatus ? 'تفعيل' : 'إيقاف'} كود الخصم بنجاح!`, 'success');
      await this.loadCoupons();
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل تغيير حالة الكود: ${err.message}`, 'danger');
    }
  }

  async deleteCoupon(id, code) {
    const isAdmin = this.user?.role === 'admin' || this.user?.is_superadmin;
    if (!isAdmin) return;
    if (!confirm(`هل أنت متأكد من حذف كود الخصم (${code}) نهائياً؟`)) {
      return;
    }

    try {
      await request(`/billing/gift-codes/${id}`, {
        method: 'DELETE',
      }).catch(async () => {
        return await request(`/admin/gift-codes/${id}`, {
          method: 'DELETE',
        });
      });

      this.showToast(`تم حذف كود الخصم (${code}) بنجاح!`, 'success');
      await this.loadCoupons();
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل حذف الكود: ${err.message}`, 'danger');
    }
  }

  copyCouponCode(code) {
    this.copyToClipboard(code, `تم نسخ كود الخصم (${code}) إلى الحافظة!`, 'كود الخصم');
  }

  // ==========================================================================
  // Calendar View Helpers
  // ==========================================================================

  toggleCalendarHideEnded() {
    this.calendarState.hideEnded = this.calendarState.hideEnded !== false ? false : true;
    this.renderMainContent();
  }

  // ==========================================================================
  // Teacher Quizzes Management & WhatsApp Integration (DEV-QUIZ)
  // ==========================================================================

  saveQuizzesToLocalStorage(groupId) {
    const gid = groupId || this.quizzesState.selectedGroupId;
    if (!gid) return;
    try {
      localStorage.setItem(`centrly_quizzes_${gid}`, JSON.stringify({
        quizzes: this.quizzesState.quizzes,
        scoresMap: this.quizzesState.scoresMap,
        notesMap: this.quizzesState.notesMap,
        deliveryStatusMap: this.quizzesState.deliveryStatusMap,
        currentQuizNumber: this.quizzesState.currentQuizNumber,
      }));
    } catch (_) {}
  }

  async loadQuizzesForGroup(groupId) {
    if (!groupId) return;
    // 1. Fast local cache recovery to prevent data loss on refresh
    const cacheKey = `centrly_quizzes_${groupId}`;
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed.quizzes) && parsed.quizzes.length > 0) {
          parsed.quizzes.forEach(q => {
            if (q.title && (q.title.includes('أساسيات المادة') || q.title.includes('الفصل الأول') || q.title.includes('مراجعة شاملة'))) {
              q.title = `كويز ${q.number}`;
            }
          });
          this.quizzesState.quizzes = parsed.quizzes;
        }
        if (parsed.scoresMap) {
          this.quizzesState.scoresMap = { ...this.quizzesState.scoresMap, ...parsed.scoresMap };
        }
        if (parsed.notesMap) {
          this.quizzesState.notesMap = { ...this.quizzesState.notesMap, ...parsed.notesMap };
        }
        if (parsed.deliveryStatusMap) {
          this.quizzesState.deliveryStatusMap = { ...this.quizzesState.deliveryStatusMap, ...parsed.deliveryStatusMap };
        }
        if (parsed.currentQuizNumber) {
          this.quizzesState.currentQuizNumber = parsed.currentQuizNumber;
        }
      }
    } catch (_) {}

    // 2. Fetch authoritative data from backend Supabase API
    try {
      const res = await request(`/quizzes?group_id=${groupId}`);
      if (res?.success && Array.isArray(res.quizzes) && res.quizzes.length > 0) {
        this.quizzesState.quizzes = res.quizzes.map(q => {
          let cleanTitle = q.title || `كويز ${q.quiz_number}`;
          if (cleanTitle.includes('أساسيات المادة') || cleanTitle.includes('الفصل الأول') || cleanTitle.includes('مراجعة شاملة')) {
            cleanTitle = `كويز ${q.quiz_number}`;
          }
          return {
            id: q.id,
            number: q.quiz_number,
            title: cleanTitle,
            maxScore: Number(q.max_score || 10),
            date: q.quiz_date || new Date().toISOString().slice(0, 10),
            skipped: Boolean(q.is_skipped),
          };
        });

        if (res.scores_map) {
          this.quizzesState.scoresMap = {
            ...this.quizzesState.scoresMap,
            ...res.scores_map,
          };
        }
        if (res.notes_map) {
          this.quizzesState.notesMap = {
            ...this.quizzesState.notesMap,
            ...res.notes_map,
          };
        }
        if (res.delivery_status_map) {
          this.quizzesState.deliveryStatusMap = {
            ...this.quizzesState.deliveryStatusMap,
            ...res.delivery_status_map,
          };
        }

        this.saveQuizzesToLocalStorage(groupId);
      }
    } catch (err) {
      console.warn('[Centrly] Could not fetch quizzes from backend, using cached state:', err);
    }
  }

  async switchQuizGroup(groupId) {
    this.quizzesState.selectedGroupId = groupId;
    this.renderMainContent();
    await this.loadQuizzesForGroup(groupId);
    this.renderMainContent();
  }

  selectQuizNumber(quizNum) {
    this.quizzesState.currentQuizNumber = quizNum;
    this.saveQuizzesToLocalStorage();
    this.renderMainContent();
  }

  addNewQuiz() {
    const nextNum = (this.quizzesState.quizzes.length > 0)
      ? Math.max(...this.quizzesState.quizzes.map(q => q.number)) + 1
      : 1;
    const today = new Date().toISOString().slice(0, 10);
    const newQuizObj = {
      id: `quiz-tmp-${Date.now()}`,
      number: nextNum,
      title: `كويز ${nextNum}`,
      maxScore: 10,
      date: today,
      skipped: false,
    };
    this.quizzesState.quizzes.push(newQuizObj);
    this.quizzesState.currentQuizNumber = nextNum;
    this.saveQuizzesToLocalStorage();

    // Persist new quiz definition in background
    if (this.quizzesState.selectedGroupId) {
      request('/quizzes', {
        method: 'POST',
        body: {
          group_id: this.quizzesState.selectedGroupId,
          quiz_number: nextNum,
          title: `كويز ${nextNum}`,
          max_score: 10,
          quiz_date: today,
          is_skipped: false,
        },
      }).then(res => {
        if (res?.quiz?.id) {
          newQuizObj.id = res.quiz.id;
          this.saveQuizzesToLocalStorage();
        }
      }).catch(() => {});
    }

    this.showToast(`تمت إضافة كويز ${nextNum} بنجاح`, 'success');
    this.renderMainContent();
  }

  skipCurrentQuiz(quizNum) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.skipped = true;
      const nextQuiz = this.quizzesState.quizzes.find(q => q.number > quizNum && !q.skipped);
      if (nextQuiz) {
        this.quizzesState.currentQuizNumber = nextQuiz.number;
      }
      this.saveQuizzesToLocalStorage();

      // Persist skipped status in background
      if (this.quizzesState.selectedGroupId) {
        request('/quizzes', {
          method: 'POST',
          body: {
            group_id: this.quizzesState.selectedGroupId,
            quiz_number: quizNum,
            title: quiz.title || `كويز ${quizNum}`,
            max_score: quiz.maxScore || 10,
            is_skipped: true,
          },
        }).catch(() => {});
      }

      this.showToast(`تم تخطي كويز ${quizNum}`, 'info');
      this.renderMainContent();
    }
  }

  promptEditQuizTitle(quizNum) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    const currentTitle = quiz?.title || `كويز ${quizNum}`;
    const bodyHtml = `
      <form id="formEditQuizTitle" onsubmit="event.preventDefault(); window.centrlyApp.confirmEditQuizTitle(${quizNum});">
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700;">اسم الكويز / الاختبار</label>
          <input type="text" id="inputEditQuizTitle" class="form-input" value="${escapeHtml(currentTitle)}" placeholder="اسم الكويز / الاختبار" autofocus required>
          <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.35rem;">
            أدخل عنواناً مميزاً للكويز لتسهيل تمييزه في تقارير الطلاب.
          </div>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="font-weight: 800;">حفظ الاسم</button>
        </div>
      </form>
    `;
    this.showModal(`تعديل اسم الكويز رقم (${quizNum})`, bodyHtml);
    setTimeout(() => {
      document.getElementById('inputEditQuizTitle')?.focus();
    }, 150);
  }

  confirmEditQuizTitle(quizNum) {
    const newTitle = document.getElementById('inputEditQuizTitle')?.value?.trim();
    this.closeModal();
    this.updateQuizTitle(quizNum, newTitle);
  }

  updateQuizTitle(quizNum, newTitle) {
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.title = newTitle ? newTitle.trim() : `كويز ${quizNum}`;
      this.saveQuizzesToLocalStorage();

      if (this.quizzesState.selectedGroupId) {
        request('/quizzes', {
          method: 'POST',
          body: {
            id: quiz.id && quiz.id.length > 20 ? quiz.id : undefined,
            group_id: this.quizzesState.selectedGroupId,
            quiz_number: quizNum,
            title: quiz.title,
            max_score: quiz.maxScore || 10,
            is_skipped: Boolean(quiz.skipped),
          },
        }).then(res => {
          if (res?.quiz?.id) {
            quiz.id = res.quiz.id;
            this.saveQuizzesToLocalStorage();
          }
        }).catch(() => {});
      }
      this.showToast('تم تحديث عنوان الكويز بنجاح', 'info');
      this.renderMainContent();
    }
  }

  updateQuizMaxScore(quizNum, newMaxScore) {
    const num = Number(newMaxScore);
    if (isNaN(num) || num <= 0) return;
    const quiz = this.quizzesState.quizzes.find(q => q.number === quizNum);
    if (quiz) {
      quiz.maxScore = num;
      this.saveQuizzesToLocalStorage();

      if (this.quizzesState.selectedGroupId) {
        request('/quizzes', {
          method: 'POST',
          body: {
            id: quiz.id && quiz.id.length > 20 ? quiz.id : undefined,
            group_id: this.quizzesState.selectedGroupId,
            quiz_number: quizNum,
            title: quiz.title || `كويز ${quizNum}`,
            max_score: num,
            is_skipped: Boolean(quiz.skipped),
          },
        }).then(res => {
          if (res?.quiz?.id) {
            quiz.id = res.quiz.id;
            this.saveQuizzesToLocalStorage();
          }
        }).catch(() => {});
      }
      this.showToast(`تم تحديث الدرجة العظمى إلى (${num} درجات)`, 'info');
      this.renderMainContent();
    }
  }

  updateStudentQuizScore(studentId, score) {
    const currQuiz = this.quizzesState.currentQuizNumber || 1;
    if (!this.quizzesState.scoresMap[currQuiz]) {
      this.quizzesState.scoresMap[currQuiz] = {};
    }
    this.quizzesState.scoresMap[currQuiz][studentId] = score;
    this.saveQuizzesToLocalStorage();
  }

  updateStudentQuizNote(studentId, note) {
    const currQuiz = this.quizzesState.currentQuizNumber || 1;
    if (!this.quizzesState.notesMap[currQuiz]) {
      this.quizzesState.notesMap[currQuiz] = {};
    }
    this.quizzesState.notesMap[currQuiz][studentId] = note;
    this.saveQuizzesToLocalStorage();
  }

  async saveCurrentQuizScores() {
    if (this.quizzesState.isSaving) return;
    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = this.quizzesState.quizzes.find(q => q.number === currQuizNum) || { maxScore: 10 };
    const scores = this.quizzesState.scoresMap[currQuizNum] || {};
    const notes = this.quizzesState.notesMap[currQuizNum] || {};

    const count = Object.keys(scores).filter(k => scores[k] !== '' && scores[k] !== null).length;
    if (count === 0) {
      this.showToast('يرجى إدخال درجة طالب واحد على الأقل قبل الحفظ', 'warning');
      return;
    }

    this.quizzesState.isSaving = true;
    try {
      this.saveQuizzesToLocalStorage();
      await request('/quizzes/scores', {
        method: 'POST',
        body: {
          group_id: this.quizzesState.selectedGroupId,
          quiz_number: currQuizNum,
          quiz_title: currentQuiz.title || `كويز ${currQuizNum}`,
          max_score: currentQuiz.maxScore || 10,
          scores,
          notes,
        },
      });

      // Synchronize in-memory with reportsState
      if (this.reportsState) {
        const month = this.reportsState.period?.month || (new Date().getMonth() + 1);
        const year = this.reportsState.period?.year || new Date().getFullYear();
        request(`/reports/monthly?month=${month}&year=${year}`).then(rep => {
          if (rep?.leaderboard) {
            this.reportsState.leaderboard = rep.leaderboard;
            this.reportsState.average_score = rep.average_score || 0;
          }
        }).catch(() => {});
      }

      this.showToast(`تم حفظ وتثبيت درجات كويز ${currQuizNum} لـ (${count}) طالب بنجاح! وستظهر فوراً في بوابات المتابعة`, 'success');
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل حفظ درجات الكويز: ${err.message || 'خطأ في الخادم'}`, 'danger');
    } finally {
      this.quizzesState.isSaving = false;
    }
  }

  async sendQuizScoreWhatsApp(studentId, studentName, quizTitle, target = 'both') {
    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = this.quizzesState.quizzes.find(q => q.number === currQuizNum) || { maxScore: 10 };
    const score = this.quizzesState.scoresMap[currQuizNum]?.[studentId];
    const note = this.quizzesState.notesMap[currQuizNum]?.[studentId] || '';

    if (score === undefined || score === null || score === '') {
      this.showToast(`يرجى رصد درجة الطالب (${studentName}) أولاً قبل إرسال الإشعار`, 'warning');
      return;
    }

    try {
      const targetLabel = target === 'student' ? 'للطالب' : (target === 'parent' ? 'لولي الأمر' : 'لولي الأمر والطالب');
      this.showToast(`جارٍ إرسال درجة (${studentName}) ${targetLabel} بنظام الأمان ومحاكاة الكتابة الحية...`, 'info');
      const res = await request(`/students/${studentId}/notify-score`, {
        method: 'POST',
        body: {
          quiz_title: quizTitle || `كويز ${currQuizNum}`,
          score: Number(score),
          max_score: currentQuiz.maxScore || 10,
          note: note || undefined,
          target,
        },
      });

      if (!this.quizzesState.deliveryStatusMap) this.quizzesState.deliveryStatusMap = {};
      if (!this.quizzesState.deliveryStatusMap[currQuizNum]) this.quizzesState.deliveryStatusMap[currQuizNum] = {};
      const isDelivered = (res?.status === 'sent' || res?.delivered !== false);
      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = isDelivered ? 'sent' : 'failed';

      if (isDelivered) {
        const sentToStr = Array.isArray(res?.sent_to) && res.sent_to.length > 1 ? 'لولي الأمر والطالب معاً' : (res?.sent_to?.[0] === 'student' ? 'للطالب مباشرة' : 'لولي الأمر');
        this.showToast(`تم إرسال إشعار درجة (${studentName}) ${sentToStr} بنجاح عبر واتساب`, 'success');
      } else {
        this.showToast(`تعذر تسليم إشعار (${studentName}): ${res?.error || 'فشل التوصيل'}`, 'danger');
      }
      this.saveQuizzesToLocalStorage();
      this.renderMainContent();
    } catch (err) {
      if (!this.quizzesState.deliveryStatusMap) this.quizzesState.deliveryStatusMap = {};
      if (!this.quizzesState.deliveryStatusMap[currQuizNum]) this.quizzesState.deliveryStatusMap[currQuizNum] = {};
      this.quizzesState.deliveryStatusMap[currQuizNum][studentId] = 'failed';
      this.saveQuizzesToLocalStorage();
      this.showToast(`فشل إرسال إشعار الكويز: ${err.message || 'خطأ في خادم الواتساب'}`, 'danger');
      this.renderMainContent();
    }
  }

  dispatchBatchQuizScores() {
    if (this.sessionState.isDispatchingQuizWhatsApp) {
      this.showToast('عملية الإرسال قيد التنفيذ بالفعل مع فواصل الأمان الفائق...', 'warning');
      return;
    }

    const currQuizNum = this.quizzesState.currentQuizNumber || 1;
    const currentQuiz = this.quizzesState.quizzes.find(q => q.number === currQuizNum) || { maxScore: 10 };
    const scores = this.quizzesState.scoresMap[currQuizNum] || {};
    const notes = this.quizzesState.notesMap[currQuizNum] || {};

    const selectedGroupId = this.quizzesState.selectedGroupId;
    const groupStudents = (this.students || []).filter(s => {
      if (!selectedGroupId) return true;
      if (String(s.group_id) === String(selectedGroupId) || String(s.groupId) === String(selectedGroupId)) return true;
      if (Array.isArray(s.group_ids) && s.group_ids.some(gid => String(gid) === String(selectedGroupId))) return true;
      return false;
    });

    const studentsToDispatch = groupStudents
      .filter(s => scores[s.id] !== undefined && scores[s.id] !== null && scores[s.id] !== '')
      .map(s => ({
        student_id: s.id,
        student_name: s.name,
        parent_phone: s.parent_phone || '',
        student_phone: s.student_phone || s.phone || '',
        score: Number(scores[s.id]),
        note: notes[s.id] || undefined,
      }));

    if (studentsToDispatch.length === 0) {
      this.showToast('لا يوجد طلاب مرصودة درجاتهم في هذا الكويز للإرسال الجماعي. يرجى رصد الدرجات أولاً.', 'warning');
      return;
    }

    const existing = document.getElementById('centrlyConfirmModal');
    if (existing) existing.remove();

    const modalEl = document.createElement('div');
    modalEl.id = 'centrlyConfirmModal';
    modalEl.className = 'modal-overlay';
    modalEl.style.cssText = `
      position: fixed; inset: 0; z-index: 100000;
      background: rgba(15, 23, 42, 0.65);
      backdrop-filter: blur(4px);
      display: flex; align-items: center; justify-content: center; padding: 1rem;
      overflow-y: auto;
    `;
    modalEl.innerHTML = `
      <div class="modal-dialog" dir="rtl" style="background: #ffffff; border-radius: 14px; max-width: 480px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid var(--centrly-line); margin: auto; max-height: calc(100vh - 2rem); display: flex; flex-direction: column;">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--centrly-line); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink);">
            إرسال درجات الكويز عبر واتساب
          </h3>
          <button onclick="document.getElementById('centrlyConfirmModal')?.remove()" style="background: transparent; border: none; cursor: pointer; color: var(--centrly-text); display: flex; align-items: center;">${getIcon('close', 16, 'currentColor')}</button>
        </div>
        <div style="padding: 1.5rem; font-size: 0.925rem; color: var(--centrly-ink); line-height: 1.6;">
          <p style="margin: 0 0 1rem 0;">
            هل أنت متأكد من رغبتك في إرسال درجات (<strong>${studentsToDispatch.length}</strong>) طالب عبر الواتساب؟
            <br>
            <span style="font-size: 0.825rem; color: var(--centrly-text);">سيتم إرسال الرسائل بفواصل زمنية تلقائية لضمان وصولها بسلاسة.</span>
          </p>

          <div style="background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 10px; padding: 1rem;">
            <div style="font-weight: 800; font-size: 0.875rem; color: var(--centrly-ink); margin-bottom: 0.65rem;">
              اختر جهة استلام النتيجة:
            </div>
            <label style="display: flex; align-items: flex-start; gap: 0.6rem; margin-bottom: 0.6rem; cursor: pointer; font-size: 0.88rem;">
              <input type="radio" name="quizBatchTarget" value="both" checked style="margin-top: 3px;" />
              <div>
                <strong>ولي الأمر والطالب معاً</strong> <span style="font-size: 0.75rem; color: #15803d; background: #dcfce7; padding: 1px 6px; border-radius: 4px; font-weight: 700;">موصى به</span>
                <div style="font-size: 0.78rem; color: var(--centrly-text);">إرسال رسالة تقرير لولي الأمر، ورسالة تشجيعية منفصلة للطالب</div>
              </div>
            </label>
            <label style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; cursor: pointer; font-size: 0.88rem;">
              <input type="radio" name="quizBatchTarget" value="parents" />
              <span>أولياء الأمور فقط</span>
            </label>
            <label style="display: flex; align-items: center; gap: 0.6rem; cursor: pointer; font-size: 0.88rem;">
              <input type="radio" name="quizBatchTarget" value="students" />
              <span>الطلاب فقط</span>
            </label>
          </div>
        </div>
        <div style="padding: 1rem 1.5rem; background: var(--centrly-surface); border-top: 1px solid var(--centrly-line); display: flex; justify-content: flex-end; gap: 0.75rem;">
          <button id="confirmModalCancelBtn" class="btn" style="background: #ffffff; color: #1e293b; border: 1px solid #cbd5e1; font-weight: 700; padding: 0.5rem 1.25rem; border-radius: 8px; cursor: pointer;">
            إلغاء
          </button>
          <button id="confirmModalActionBtn" class="btn" style="background: #25D366; color: #ffffff; border: none; font-weight: 800; padding: 0.5rem 1.4rem; border-radius: 8px; cursor: pointer; box-shadow: 0 4px 12px rgba(37,211,102,0.35);">
            بدء الإرسال الآمن (${studentsToDispatch.length} طالب)
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(modalEl);

    document.getElementById('confirmModalCancelBtn').onclick = () => {
      modalEl.remove();
    };

    document.getElementById('confirmModalActionBtn').onclick = async () => {
      const selectedTarget = document.querySelector('input[name="quizBatchTarget"]:checked')?.value || 'both';
      modalEl.remove();

      if (this.sessionState.isDispatchingQuizWhatsApp) return;
      this.sessionState.isDispatchingQuizWhatsApp = true;
      try {
        const targetLabel = selectedTarget === 'both' ? 'لأولياء الأمور والطلاب' : (selectedTarget === 'students' ? 'للطلاب' : 'لأولياء الأمور');
        this.showToast(`بدأت عملية الإرسال الآمن لدرجات الكويز ${targetLabel} بأعلى معايير الأمان...`, 'info');
        const res = await request('/quizzes/dispatch-scores', {
          method: 'POST',
          body: {
            group_id: selectedGroupId,
            quiz_number: currQuizNum,
            quiz_title: currentQuiz.title || `كويز ${currQuizNum}`,
            max_score: currentQuiz.maxScore || 10,
            students: studentsToDispatch,
            target: selectedTarget,
          },
        });

        if (!this.quizzesState.deliveryStatusMap) this.quizzesState.deliveryStatusMap = {};
        if (!this.quizzesState.deliveryStatusMap[currQuizNum]) this.quizzesState.deliveryStatusMap[currQuizNum] = {};

        if (Array.isArray(res?.results)) {
          res.results.forEach(r => {
            const sid = r.student_id || r.id;
            if (sid) {
              this.quizzesState.deliveryStatusMap[currQuizNum][sid] = (r.status === 'sent' || r.delivered) ? 'sent' : 'failed';
            }
          });
        } else {
          studentsToDispatch.forEach(s => {
            this.quizzesState.deliveryStatusMap[currQuizNum][s.student_id] = 'sent';
          });
        }

        this.saveQuizzesToLocalStorage();
        this.showToast(`تم إتمام إرسال درجات الكويز! (المرسل: ${res.sent_count || res.sent || studentsToDispatch.length} ، الفاشل: ${res.failed_count || res.failed || 0})`, 'success');
        this.renderMainContent();
      } catch (err) {
        this.showToast(`حدث خطأ أثناء الإرسال الجماعي: ${err.message || 'خطأ في الخادم'}`, 'danger');
      } finally {
        this.sessionState.isDispatchingQuizWhatsApp = false;
      }
    };
  }

  // ==========================================================================
  // Student Cards Printing & Download Flow
  // ==========================================================================

  downloadSelectedCardsDataExcel() {
    const checkedBoxes = Array.from(document.querySelectorAll('.student-card-check:checked'));
    let targetStudents = [];

    if (checkedBoxes.length > 0) {
      targetStudents = checkedBoxes.map(cb => ({
        id: cb.value,
        name: cb.getAttribute('data-name') || '',
        code: cb.getAttribute('data-code') || '',
        group: cb.getAttribute('data-group') || '',
        phone: cb.getAttribute('data-phone') || '',
        parent_phone: cb.getAttribute('data-parent-phone') || '',
      }));
    } else {
      const rows = Array.from(document.querySelectorAll('#cardsTable tbody tr[data-student-id]'));
      if (rows.length === 0) {
        this.showToast('لا يوجد طلاب لتنزيل بياناتهم. يرجى إضافة طلاب أولاً.', 'warning');
        return;
      }
      targetStudents = rows.map(r => {
        const cb = r.querySelector('.student-card-check');
        return {
          id: r.getAttribute('data-student-id'),
          name: cb?.getAttribute('data-name') || r.cells[2]?.textContent.trim() || '',
          code: cb?.getAttribute('data-code') || r.cells[1]?.textContent.trim() || '',
          group: cb?.getAttribute('data-group') || r.cells[3]?.textContent.trim() || '',
          phone: cb?.getAttribute('data-phone') || r.cells[4]?.textContent.trim() || '',
          parent_phone: cb?.getAttribute('data-parent-phone') || r.cells[5]?.textContent.trim() || '',
        };
      });
    }

    // CSV header & rows with UTF-8 BOM for Arabic Excel & Canva/Photoshop Data Merge compatibility
    const header = ['كود الطالب', 'اسم الطالب', 'المجموعة الدراسية', 'رقم هاتف الطالب', 'رقم ولي الأمر', 'كود الباركود'];
    const rows = targetStudents.map(s => [
      `"${(s.code || '').replace(/"/g, '""')}"`,
      `"${(s.name || '').replace(/"/g, '""')}"`,
      `"${(s.group || '').replace(/"/g, '""')}"`,
      `"${(s.phone || '').replace(/"/g, '""')}"`,
      `"${(s.parent_phone || '').replace(/"/g, '""')}"`,
      `"${(s.code || '').replace(/"/g, '""')}"`,
    ]);

    const csvContent = '\uFEFF' + [header.join(','), ...rows.map(r => r.join(','))].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `بيانات_كروت_الطلاب_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    this.showToast(`تم تنزيل ملف بيانات (${targetStudents.length}) طالب بنجاح (Excel / CSV) جاهز لبرامج التصميم!`, 'success');
  }

  downloadSelectedCardsPdf() {
    const checkedBoxes = Array.from(document.querySelectorAll('.student-card-check:checked'));
    let targetStudents = [];

    if (checkedBoxes.length > 0) {
      targetStudents = checkedBoxes.map(cb => ({
        id: cb.value,
        name: cb.getAttribute('data-name') || '',
        code: cb.getAttribute('data-code') || '',
        group: cb.getAttribute('data-group') || '',
        phone: cb.getAttribute('data-phone') || cb.getAttribute('data-parent-phone') || '',
      }));
    } else {
      const rows = Array.from(document.querySelectorAll('#cardsTable tbody tr[data-student-id]'));
      if (rows.length === 0) {
        this.showToast('لا يوجد طلاب لتنزيل كروت لهم. يرجى إضافة طلاب أولاً.', 'warning');
        return;
      }
      targetStudents = rows.map(r => {
        const cb = r.querySelector('.student-card-check');
        return {
          id: r.getAttribute('data-student-id'),
          name: cb?.getAttribute('data-name') || r.cells[2]?.textContent.trim(),
          code: cb?.getAttribute('data-code') || r.cells[1]?.textContent.trim(),
          group: cb?.getAttribute('data-group') || r.cells[3]?.textContent.trim(),
          phone: cb?.getAttribute('data-phone') || r.cells[4]?.textContent.trim(),
        };
      });
    }

    const orgName = this.user?.name || (this.user?.account_type === 'center' ? 'السنتر التعليمي' : 'منظومة المعلم');

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      this.showToast('يرجى السماح بالنوافذ المنبثقة (Pop-ups) لتنزيل ملف الكروت للطباعة', 'warning');
      return;
    }

    const cardsHtml = targetStudents.map(st => {
      const barcodeSvg = generateBarcode128Svg(st.code, { height: 46, unitWidth: 2.0 });

      return `
        <div class="card-box">
          <div class="card-header">
            <div class="org-name">${escapeHtml(orgName)}</div>
            <div class="card-badge">كارت حضور ذكي</div>
          </div>
          <div class="card-body">
            <div class="student-name">${escapeHtml(st.name)}</div>
            <div class="student-meta">
              <span>المجموعة: <b>${escapeHtml(st.group)}</b></span>
              ${st.phone ? `<span>الهاتف: <b dir="ltr">${escapeHtml(st.phone)}</b></span>` : ''}
            </div>
            <div class="barcode-container">
              ${barcodeSvg}
              <div class="barcode-code">${escapeHtml(st.code)}</div>
            </div>
          </div>
          <div class="card-footer">منصة سنترلي الذكية • Centrly</div>
        </div>
      `;
    }).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="utf-8">
        <title>كروت الطلاب للطباعة - سنترلي (${targetStudents.length} طالب)</title>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;800;900&display=swap" rel="stylesheet">
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: 'Cairo', Tahoma, Arial, sans-serif;
            background: #f1f5f9;
            padding: 20px;
            color: #0f172a;
          }
          .no-print-bar {
            background: #1e3a8a;
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .print-btn {
            background: #22c55e;
            color: white;
            border: none;
            padding: 8px 18px;
            border-radius: 6px;
            font-size: 15px;
            font-weight: 700;
            cursor: pointer;
            font-family: inherit;
          }
          .cards-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 15px;
          }
          .card-box {
            background: white;
            border: 2px solid #0f172a;
            border-radius: 12px;
            padding: 14px;
            page-break-inside: avoid;
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            min-height: 190px;
          }
          .card-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 1px solid #e2e8f0;
            padding-bottom: 6px;
          }
          .org-name {
            font-size: 13px;
            font-weight: 800;
            color: #1e3a8a;
          }
          .card-badge {
            background: #e0f2fe;
            color: #0369a1;
            font-size: 10px;
            font-weight: 700;
            padding: 2px 8px;
            border-radius: 4px;
          }
          .student-name {
            font-size: 16px;
            font-weight: 800;
            color: #0f172a;
            margin-top: 6px;
          }
          .student-meta {
            font-size: 11px;
            color: #64748b;
            margin-top: 4px;
            display: flex;
            gap: 15px;
          }
          .barcode-container {
            margin-top: 8px;
            text-align: center;
            background: #f8fafc;
            padding: 6px;
            border-radius: 6px;
            border: 1px dashed #cbd5e1;
          }
          .barcode-code {
            font-family: monospace;
            font-size: 13px;
            font-weight: 800;
            letter-spacing: 2px;
            color: #0f172a;
            margin-top: 2px;
          }
          .card-footer {
            font-size: 9px;
            color: #94a3b8;
            text-align: center;
            margin-top: 6px;
            border-top: 1px solid #f1f5f9;
            padding-top: 4px;
          }
          @media print {
            body { background: white; padding: 0; }
            .no-print-bar { display: none; }
            .cards-grid {
              grid-template-columns: repeat(2, 1fr);
              gap: 10mm;
            }
            .card-box {
              border: 1.5pt solid #000;
              box-shadow: none;
            }
            @page {
              size: A4;
              margin: 10mm;
            }
          }
        </style>
      </head>
      <body>
        <div class="no-print-bar">
          <div>
            <strong>جاهز للطباعة أو التنزيل كـ PDF:</strong> تم تجهيز كروت (${targetStudents.length}) طالب مع الأكواد والباركود.
          </div>
          <button class="print-btn" onclick="window.print()">طباعة / حفظ كـ PDF</button>
        </div>
        <div class="cards-grid">
          ${cardsHtml}
        </div>
      </body>
      </html>
    `);
    printWindow.document.close();
    this.showToast(`تم فتح وتجهيز كروت (${targetStudents.length}) طالب للطباعة / التنزيل بنجاح!`, 'success');
  }

  selectAllCards(selectAll) {
    const checkboxes = document.querySelectorAll('.student-card-check');
    checkboxes.forEach(cb => cb.checked = Boolean(selectAll));
    const master = document.getElementById('cardMasterCheckbox');
    if (master) master.checked = Boolean(selectAll);
    this.updateSelectedCardsCount();
  }

  toggleMasterCardCheckbox(checked) {
    this.selectAllCards(checked);
  }

  updateSelectedCardsCount() {
    const count = document.querySelectorAll('.student-card-check:checked').length;
    const badge = document.getElementById('selectedCardsCountBadge');
    if (badge) {
      badge.textContent = `تم تحديد: ${count} طالب`;
    }
  }

  filterCardsTable() {
    const q = document.getElementById('cardSearchInput')?.value.toLowerCase() || '';
    const rows = document.querySelectorAll('#cardsTable tbody tr[data-student-id]');
    rows.forEach(r => {
      const text = r.textContent.toLowerCase();
      r.style.display = text.includes(q) ? '' : 'none';
    });
  }

  filterCardsByGroup(groupId) {
    const rows = document.querySelectorAll('#cardsTable tbody tr[data-student-id]');
    rows.forEach(r => {
      if (!groupId) {
        r.style.display = '';
      } else {
        const rowGrp = r.getAttribute('data-group-id');
        r.style.display = (rowGrp === groupId) ? '' : 'none';
      }
    });
  }

  previewSpecificCard(name, code, group, phone) {
    const studentObj = {
      name,
      student_code: code,
      code,
      group_name: group,
      teacher_name: this.user?.name || (this.user?.account_type === 'center' ? 'السنتر التعليمي' : 'معلم المادة'),
      center_name: this.user?.account_type === 'center' ? this.user?.name : '',
    };
    const bodyHtml = renderStudentBarcodeCardHtml(studentObj);
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>
      <button type="button" class="btn btn-primary" onclick="window.centrlyBarcodeCard.downloadCardPng(${JSON.stringify(studentObj).replace(/"/g, '&quot;')})">تحميل كصورة (PNG)</button>
    `;
    this.showModal(`معاينة كارت الطالب: ${escapeHtml(name)}`, bodyHtml, footerHtml);
  }

  openCardsWhatsAppDispatchModal() {
    this.downloadSelectedCardsPdf();
  }

  // ==========================================================================
  // At-Risk Watchlist Single Alert
  // ==========================================================================

  async dispatchSingleRiskAlert(studentId, studentName) {
    try {
      this.showToast(`جارٍ إرسال تنبيه المتابعة لولي أمر (${studentName})...`, 'info');
      await request(`/at-risk/alerts/${studentId}`, {
        method: 'POST',
        body: { alert_type: 'absence_warning' },
      });
      this.showToast(`تم إرسال تنبيه المتابعة لولي أمر (${studentName}) بنجاح عبر واتساب`, 'success');
      await this.loadRouteData('risk-watchlist');
    } catch (err) {
      this.showToast(`فشل إرسال تنبيه المتابعة: ${err.message || 'خطأ في الإرسال'}`, 'danger');
    }
  }

  // ==========================================================================
  // Security PIN Protection (Sensitive Financials & Salaries)
  // ==========================================================================

  openSetPinModal() {
    const savedPin = localStorage.getItem('centrly_financial_pin');
    const hasExisting = Boolean(this.hasSecurityPin || savedPin);
    const bodyHtml = `
      <form id="modalSetPinForm" onsubmit="window.centrlyApp.handleSavePinSubmit(event)">
        <div style="text-align: center; margin-bottom: 1.25rem;">
          <div style="display: flex; justify-content: center; margin-bottom: 0.5rem;">${getIcon('lock', 36, '#2563eb')}</div>
          <h4 style="margin: 0 0 0.4rem; color: #0f172a; font-weight: 800;">
            ${hasExisting ? 'تعديل رمز الأمان (PIN)' : 'تعيين رمز الأمان (PIN)'}
          </h4>
          <p style="font-size: 0.85rem; color: #64748b; margin: 0; line-height: 1.5;">
            ${hasExisting ? 'يرجى كتابة رمز الأمان الحالي أولاً لتأكيد هويتك، ثم إدخال الرمز الجديد.' : 'رمز رقمي سريع من 4 إلى 6 أرقام لحماية أرباحك ومرتبات المساعدين ومزامنته سحابياً عبر جميع أجهزتك.'}
          </p>
        </div>

        ${hasExisting ? `
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">رمز الأمان الحالي (القديم) *</label>
          <div style="position: relative;">
            <input type="password" id="inputCurrentPin" class="form-input" placeholder="أدخل الرمز الحالي" maxlength="6" pattern="[0-9]{4,6}" inputmode="numeric" required
              style="text-align: center; letter-spacing: 0.4rem; font-size: 1.3rem; font-weight: 900;"
              autocomplete="off" autofocus>
            <button type="button" onclick="window.centrlyApp.togglePinVisibility('inputCurrentPin', this)"
              style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b;">
              <span style="font-size: 0.75rem; font-weight: 700;">إظهار</span>
            </button>
          </div>
        </div>
        ` : ''}

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">${hasExisting ? 'رمز الأمان الجديد (4-6 أرقام) *' : 'رمز الأمان (4-6 أرقام) *'}</label>
          <div style="position: relative;">
            <input type="password" id="inputNewPin" class="form-input" placeholder="••••" maxlength="6" pattern="[0-9]{4,6}" inputmode="numeric" required
              style="text-align: center; letter-spacing: 0.4rem; font-size: 1.3rem; font-weight: 900;"
              autocomplete="off" ${hasExisting ? '' : 'autofocus'}>
            <button type="button" onclick="window.centrlyApp.togglePinVisibility('inputNewPin', this)"
              style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b;">
              <span style="font-size: 0.75rem; font-weight: 700;">إظهار</span>
            </button>
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700;">${hasExisting ? 'تأكيد رمز الأمان الجديد *' : 'تأكيد رمز الأمان *'}</label>
          <div style="position: relative;">
            <input type="password" id="inputConfirmPin" class="form-input" placeholder="أعد إدخال الرمز" maxlength="6" pattern="[0-9]{4,6}" inputmode="numeric" required
              style="text-align: center; letter-spacing: 0.4rem; font-size: 1.3rem; font-weight: 900;"
              autocomplete="off">
            <button type="button" onclick="window.centrlyApp.togglePinVisibility('inputConfirmPin', this)"
              style="position: absolute; left: 10px; top: 50%; transform: translateY(-50%); background: none; border: none; cursor: pointer; color: #64748b;">
              <span style="font-size: 0.75rem; font-weight: 700;">إظهار</span>
            </button>
          </div>
        </div>

        <div id="pinErrorMsg" style="display: none; color: #ef4444; font-size: 0.85rem; font-weight: 700; margin-bottom: 1rem; text-align: center;"></div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" id="btnSubmitSetPin" class="btn btn-primary" style="font-weight: 800;">${hasExisting ? 'حفظ الرمز الجديد' : 'حفظ وتفعيل الرمز'}</button>
        </div>
      </form>
    `;
    this.showModal(hasExisting ? 'تعديل رمز الأمان (PIN)' : 'تعيين رمز الأمان لأول مرة', bodyHtml);
    setTimeout(() => {
      if (hasExisting) {
        document.getElementById('inputCurrentPin')?.focus();
      } else {
        document.getElementById('inputNewPin')?.focus();
      }
    }, 150);
  }

  togglePinVisibility(inputId, btn) {
    const el = document.getElementById(inputId);
    if (!el) return;
    const isPass = el.type === 'password';
    el.type = isPass ? 'text' : 'password';
    btn.innerHTML = isPass ? '<span style="font-size: 0.75rem; font-weight: 700; color: #2563eb;">إخفاء</span>' : '<span style="font-size: 0.75rem; font-weight: 700; color: #64748b;">إظهار</span>';
  }

  async handleSavePinSubmit(e) {
    e.preventDefault();
    const savedPin = localStorage.getItem('centrly_financial_pin');
    const hasExisting = Boolean(this.hasSecurityPin || savedPin);
    const currentPin = document.getElementById('inputCurrentPin')?.value.trim();
    const pin = document.getElementById('inputNewPin')?.value.trim();
    const confirm = document.getElementById('inputConfirmPin')?.value.trim();
    const errEl = document.getElementById('pinErrorMsg');
    const btn = document.getElementById('btnSubmitSetPin');

    const showError = (msg, inputToFocus) => {
      if (errEl) {
        errEl.innerText = msg;
        errEl.style.display = 'block';
      }
      if (inputToFocus) {
        inputToFocus.focus();
      }
    };

    if (hasExisting) {
      if (!currentPin) {
        showError('يرجى إدخال رمز الأمان الحالي أولاً.', document.getElementById('inputCurrentPin'));
        return;
      }
      if (savedPin && currentPin !== savedPin) {
        showError('رمز الأمان الحالي غير صحيح. يرجى التأكد وإعادة المحاولة.', document.getElementById('inputCurrentPin'));
        const currInput = document.getElementById('inputCurrentPin');
        if (currInput) currInput.value = '';
        return;
      }
      if (pin === currentPin) {
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

    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جارٍ الحفظ...';
    }

    try {
      await request('/settings/security-pin', {
        method: 'POST',
        body: { pin, old_pin: currentPin || undefined }
      });
      localStorage.setItem('centrly_financial_pin', pin);
      localStorage.setItem('centrly_has_security_pin', 'true');
      this.hasSecurityPin = true;
      this.isFinancialUnlocked = true;
      if (this.user) {
        this.user.has_security_pin = true;
        authService.setUser(this.user);
      }
      this.closeModal();
      this.showToast(hasExisting ? 'تم تحديث رمز الأمان ومزامنته سحابياً بنجاح.' : 'تم تعيين وتفعيل رمز الأمان بنجاح.', 'success');
      this.renderApp();
    } catch (err) {
      showError(err.message || 'فشل حفظ رمز الأمان. يرجى التأكد من الرمز الحالي وإعادة المحاولة.', document.getElementById('inputCurrentPin'));
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = hasExisting ? 'حفظ الرمز الجديد' : 'حفظ وتفعيل الرمز';
      }
    }
  }

  promptUnlockFinancials() {
    const savedPin = localStorage.getItem('centrly_financial_pin');
    if (!this.hasSecurityPin && !savedPin) {
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
          <input type="password" id="inputUnlockPin" class="form-input" placeholder="••••" maxlength="6" inputmode="numeric" autofocus required
            style="text-align: center; letter-spacing: 0.5rem; font-size: 1.5rem; font-weight: 900;"
            autocomplete="off">
        </div>

        <div id="unlockPinError" style="display: none; color: #ef4444; font-size: 0.85rem; font-weight: 700; margin-bottom: 1rem; text-align: center;"></div>

        <div style="display: flex; justify-content: space-between; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
          <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.resetFinancialPinPrompt()" style="font-size: 0.75rem; color: #64748b;">
            إعادة ضبط الرمز
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

  async handleUnlockPinSubmit(e) {
    e.preventDefault();
    const entered = document.getElementById('inputUnlockPin')?.value.trim();
    const savedPin = localStorage.getItem('centrly_financial_pin');
    const errEl = document.getElementById('unlockPinError');
    const btn = document.getElementById('btnSubmitUnlockPin');

    // Fast path: local verification if matched
    if (savedPin && entered === savedPin) {
      this.isFinancialUnlocked = true;
      this.closeModal();
      this.showToast('تم إلغاء القفل وعرض البيانات بنجاح.', 'success');
      this.renderApp();
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
        localStorage.setItem('centrly_financial_pin', entered);
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
      throw new Error('رمز الأمان غير صحيح');
    } catch (_) {
      if (errEl) {
        errEl.innerText = 'رمز الـ PIN غير صحيح. يرجى المحاولة مرة أخرى.';
        errEl.style.display = 'block';
      }
      const inp = document.getElementById('inputUnlockPin');
      if (inp) {
        inp.value = '';
        inp.focus();
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'فتح البيانات الآن';
      }
    }
  }

  lockFinancials() {
    this.isFinancialUnlocked = false;
    this.showToast('تم قفل البيانات الحساسة بنجاح.', 'info');
    this.renderApp();
  }

  toggleHideFinancialNumbers() {
    this.hideFinancialNumbers = !this.hideFinancialNumbers;
    this.showToast(this.hideFinancialNumbers ? 'تم إخفاء الأرقام المالية.' : 'تم إظهار الأرقام المالية.', 'info');
    this.renderMainContent();
  }

  resetFinancialPinPrompt() {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('help-circle', 40, '#f59e0b')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">إعادة ضبط رمز الأمان (PIN)</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          سيتم حذف الرمز السري من حسابك السحابي ومن جميع الأجهزة، لتتمكن من تعيين رمز جديد فوراً.
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;" onclick="window.centrlyApp.confirmResetFinancialPin()">
            نعم، إعادة الضبط
          </button>
        </div>
      </div>
    `;
    this.showModal('إعادة ضبط رمز الأمان', bodyHtml);
  }

  async confirmResetFinancialPin() {
    try {
      await request('/settings/security-pin', { method: 'DELETE' }).catch(() => null);
    } catch (_) {}
    localStorage.removeItem('centrly_financial_pin');
    localStorage.setItem('centrly_has_security_pin', 'false');
    this.hasSecurityPin = false;
    this.isFinancialUnlocked = true;
    if (this.user) {
      this.user.has_security_pin = false;
      authService.setUser(this.user);
    }
    this.closeModal();
    this.showToast('تم حذف رمز PIN السابق. يمكنك الآن تعيين رمز جديد.', 'info');
    this.renderApp();
    setTimeout(() => {
      this.openSetPinModal();
    }, 200);
  }

  // ==========================================================================
  // Study Materials & Homework Actions
  // ==========================================================================

  filterMaterialsByGroup(groupId) {
    this.materialsGroupId = groupId;
    this.renderMainContent();
  }

  openAddMaterialModal() {
    this._selectedMatPdfFile = null;
    this._currentMatPdfSource = 'upload';

    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddMaterialForm" onsubmit="window.centrlyApp.handleAddMaterialSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">عنوان المذكرة أو المحتوى التعليمي *</label>
          <input type="text" id="modalMatTitle" class="form-input" placeholder="عنوان المذكرة أو المحتوى التعليمي" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">المجموعة المستهدفة</label>
            <select id="modalMatGroupId" class="form-select">
              <option value="">جميع المجموعات (متاح للكل)</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">نوع المحتوى *</label>
            <select id="modalMatType" class="form-select" onchange="window.centrlyApp.onMaterialTypeChange(this.value)">
              <option value="pdf">ملف PDF أو مذكرة</option>
              <option value="video">فيديو شرح (YouTube / Drive)</option>
              <option value="link">رابط خارجي أو موقع</option>
            </select>
          </div>
        </div>

        <!-- PDF Source Segmented Switch & Upload Area (Visible when type == 'pdf') -->
        <div id="matPdfSourceWrapper" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700; margin-bottom: 0.4rem; display: block;">مصدر ملف الـ PDF *</label>
          <div style="display: flex; gap: 0.4rem; background: #f1f5f9; padding: 4px; border-radius: 0.5rem; margin-bottom: 0.75rem;">
            <button type="button" id="matPdfSourceBtn-upload" onclick="window.centrlyApp.switchMatPdfSource('upload')"
              style="flex: 1; border: none; background: #ffffff; color: var(--centrly-blue-800); padding: 0.5rem 0.6rem; border-radius: 0.4rem; font-weight: 800; font-size: 0.85rem; cursor: pointer; box-shadow: 0 1px 3px rgba(0,0,0,0.08); transition: all 0.2s; text-align: center;">
              رفع ملف PDF من جهازك
            </button>
            <button type="button" id="matPdfSourceBtn-link" onclick="window.centrlyApp.switchMatPdfSource('link')"
              style="flex: 1; border: none; background: transparent; color: #64748b; padding: 0.5rem 0.6rem; border-radius: 0.4rem; font-weight: 700; font-size: 0.85rem; cursor: pointer; transition: all 0.2s; text-align: center;">
              رابط سحابي (Google Drive)
            </button>
          </div>

          <!-- Dropzone file picker -->
          <div id="matPdfUploadContainer">
            <input type="file" id="modalMatPdfFileInput" accept="application/pdf" style="display: none;" onchange="window.centrlyApp.handleMatPdfSelected(event)">
            
            <div id="matPdfDropzone" onclick="document.getElementById('modalMatPdfFileInput').click()" 
              ondragover="event.preventDefault(); this.style.borderColor='#2563eb'; this.style.background='#dbeafe';" 
              ondragleave="this.style.borderColor='#3b82f6'; this.style.background='#eff6ff';" 
              ondrop="event.preventDefault(); window.centrlyApp.handleMatPdfDrop(event)"
              style="border: 2px dashed #3b82f6; border-radius: 0.75rem; padding: 1.35rem 1rem; text-align: center; cursor: pointer; background: #eff6ff; transition: all 0.2s;">
              <div style="display: flex; justify-content: center; margin-bottom: 0.4rem;">
                ${getIcon('upload', 32, '#2563eb')}
              </div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #1e40af; margin-bottom: 0.2rem;">
                اضغط هنا لاختيار ملف PDF من اللابتوب أو الموبايل
              </div>
              <div style="font-size: 0.78rem; color: #64748b;">
                ملفات PDF فقط (الحد الأقصى 25 ميجابايت) — أو اسحب الملف وأفلته هنا
              </div>
            </div>

            <div id="matPdfSelectedPreview" style="display: none; margin-top: 0.6rem; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 0.65rem; padding: 0.75rem 0.9rem; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                <span style="display: flex; align-items: center; color: #15803d;">${getIcon('file', 22, '#15803d')}</span>
                <div style="overflow: hidden;">
                  <div id="matPdfSelectedName" style="font-weight: 800; font-size: 0.875rem; color: #166534; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
                  <div id="matPdfSelectedSize" style="font-size: 0.75rem; color: #15803d; font-weight: 600;"></div>
                </div>
              </div>
              <button type="button" onclick="window.centrlyApp.clearMatPdfFile()" class="btn btn-sm" style="background: #ffffff; border: 1px solid #fca5a5; color: #dc2626; font-weight: 700; font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: 0.4rem; cursor: pointer;">
                تغيير الملف
              </button>
            </div>
          </div>
        </div>

        <!-- URL Input Container (Used when PDF Link or Video or External Link) -->
        <div id="matUrlContainer" style="display: none; margin-bottom: 0.85rem;">
          <label id="matUrlLabel" class="form-label" style="font-weight: 700;">الرابط المباشر للملف أو الفيديو *</label>
          <input type="url" id="modalMatUrl" class="form-input" placeholder="https://drive.google.com/..." dir="ltr">
          <div id="matUrlHint" style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
            تأكد أن الرابط متاح للعرض والمشاركة مع الطلاب
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0.5rem;">
          <label class="form-label" style="font-weight: 700;">وصف أو توجيهات للطلاب (اختياري)</label>
          <textarea id="modalMatDescription" class="form-input" rows="2" placeholder="اكتب تعليمات المذاكرة أو أي ملحوظات للطلاب..."></textarea>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddMaterialForm" id="btnPublishMaterial" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">
        إضافة المذكرة الآن
      </button>
    `;
    this.showModal('إضافة مذكرة تعليمية أو شرح جديد', bodyHtml, footerHtml);
  }

  handleMatPdfSelected(e) {
    const file = e.target.files?.[0];
    if (file) this._processSelectedMatPdf(file);
  }

  handleMatPdfDrop(e) {
    const file = e.dataTransfer?.files?.[0];
    if (file) this._processSelectedMatPdf(file);
  }

  _processSelectedMatPdf(file) {
    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.showToast('يرجى اختيار ملف PDF صالح فقط', 'error');
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      this.showToast('حجم الملف كبير جداً (أقصى حد مسموح 25 ميجابايت)', 'error');
      return;
    }

    this._selectedMatPdfFile = file;

    const preview = document.getElementById('matPdfSelectedPreview');
    const dropzone = document.getElementById('matPdfDropzone');
    const nameEl = document.getElementById('matPdfSelectedName');
    const sizeEl = document.getElementById('matPdfSelectedSize');

    if (preview && nameEl && sizeEl) {
      nameEl.textContent = file.name;
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      sizeEl.textContent = `${sizeMB} ميجابايت`;
      preview.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
    }
  }

  clearMatPdfFile() {
    this._selectedMatPdfFile = null;
    const input = document.getElementById('modalMatPdfFileInput');
    if (input) input.value = '';
    const preview = document.getElementById('matPdfSelectedPreview');
    const dropzone = document.getElementById('matPdfDropzone');
    if (preview) preview.style.display = 'none';
    if (dropzone) {
      dropzone.style.display = 'block';
      dropzone.style.borderColor = '#3b82f6';
      dropzone.style.background = '#eff6ff';
    }
  }

  switchMatPdfSource(source) {
    this._currentMatPdfSource = source;
    const btnUpload = document.getElementById('matPdfSourceBtn-upload');
    const btnLink = document.getElementById('matPdfSourceBtn-link');
    const uploadContainer = document.getElementById('matPdfUploadContainer');
    const urlContainer = document.getElementById('matUrlContainer');
    const urlLabel = document.getElementById('matUrlLabel');
    const urlHint = document.getElementById('matUrlHint');
    const urlInput = document.getElementById('modalMatUrl');

    if (source === 'upload') {
      if (btnUpload) {
        btnUpload.style.background = '#ffffff';
        btnUpload.style.color = 'var(--centrly-blue-800)';
        btnUpload.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
        btnUpload.style.fontWeight = '800';
      }
      if (btnLink) {
        btnLink.style.background = 'transparent';
        btnLink.style.color = '#64748b';
        btnLink.style.boxShadow = 'none';
        btnLink.style.fontWeight = '700';
      }
      if (uploadContainer) uploadContainer.style.display = 'block';
      if (urlContainer) urlContainer.style.display = 'none';
    } else {
      if (btnLink) {
        btnLink.style.background = '#ffffff';
        btnLink.style.color = 'var(--centrly-blue-800)';
        btnLink.style.boxShadow = '0 1px 3px rgba(0,0,0,0.08)';
        btnLink.style.fontWeight = '800';
      }
      if (btnUpload) {
        btnUpload.style.background = 'transparent';
        btnUpload.style.color = '#64748b';
        btnUpload.style.boxShadow = 'none';
        btnUpload.style.fontWeight = '700';
      }
      if (uploadContainer) uploadContainer.style.display = 'none';
      if (urlContainer) {
        urlContainer.style.display = 'block';
        if (urlLabel) urlLabel.textContent = 'رابط ملف الـ PDF (Google Drive أو سحابي) *';
        if (urlHint) urlHint.textContent = 'تأكد من تفعيل صلاحية المشاركة (Anyone with the link can view)';
        if (urlInput) {
          urlInput.placeholder = 'https://drive.google.com/...';
          setTimeout(() => urlInput.focus(), 50);
        }
      }
    }
  }

  onMaterialTypeChange(type) {
    const pdfWrapper = document.getElementById('matPdfSourceWrapper');
    const urlContainer = document.getElementById('matUrlContainer');
    const urlLabel = document.getElementById('matUrlLabel');
    const urlHint = document.getElementById('matUrlHint');
    const urlInput = document.getElementById('modalMatUrl');

    if (type === 'pdf') {
      if (pdfWrapper) pdfWrapper.style.display = 'block';
      this.switchMatPdfSource(this._currentMatPdfSource || 'upload');
    } else if (type === 'video') {
      if (pdfWrapper) pdfWrapper.style.display = 'none';
      if (urlContainer) urlContainer.style.display = 'block';
      if (urlLabel) urlLabel.textContent = 'رابط فيديو الشرح (YouTube / Google Drive) *';
      if (urlHint) urlHint.textContent = 'يمكنك وضع رابط يوتيوب أو فيديو على جوجل درايف ليظهر مباشرة للطلاب';
      if (urlInput) {
        urlInput.placeholder = 'https://www.youtube.com/watch?v=... أو https://drive.google.com/...';
        setTimeout(() => urlInput.focus(), 50);
      }
    } else {
      // link
      if (pdfWrapper) pdfWrapper.style.display = 'none';
      if (urlContainer) urlContainer.style.display = 'block';
      if (urlLabel) urlLabel.textContent = 'الرابط المباشر للموقع أو المنصة *';
      if (urlHint) urlHint.textContent = 'رابط صفحة أو موقع تعليمي يريد الطالب الرجوع إليه';
      if (urlInput) {
        urlInput.placeholder = 'https://...';
        setTimeout(() => urlInput.focus(), 50);
      }
    }
  }

  async handleAddMaterialSubmit(e) {
    e.preventDefault();
    const title = document.getElementById('modalMatTitle')?.value.trim();
    const group_id = document.getElementById('modalMatGroupId')?.value || null;
    const type = document.getElementById('modalMatType')?.value || 'pdf';
    const description = document.getElementById('modalMatDescription')?.value.trim();
    const submitBtn = document.getElementById('btnPublishMaterial');

    if (!title) {
      this.showToast('يرجى كتابة عنوان المذكرة أو المحتوى التعليمي', 'error');
      return;
    }

    let url = '';
    let file_data = null;
    let file_name = null;

    if (type === 'pdf') {
      const source = this._currentMatPdfSource || 'upload';
      if (source === 'upload') {
        if (!this._selectedMatPdfFile) {
          this.showToast('يرجى اختيار ملف PDF لرفعه من جهازك', 'error');
          return;
        }
        file_name = this._selectedMatPdfFile.name;

        if (submitBtn) {
          submitBtn.disabled = true;
          submitBtn.innerHTML = `<span>جاري قراءة ورفع الملف للسحابة...</span>`;
        }

        try {
          file_data = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = () => reject(new Error('فشل قراءة الملف من الجهاز'));
            reader.readAsDataURL(this._selectedMatPdfFile);
          });
        } catch (readErr) {
          if (submitBtn) {
            submitBtn.disabled = false;
            submitBtn.innerHTML = `<span>إضافة المذكرة الآن</span>`;
          }
          this.showToast('فشل قراءة ملف الـ PDF، يرجى المحاولة مرة أخرى', 'error');
          return;
        }
      } else {
        // link
        url = document.getElementById('modalMatUrl')?.value.trim();
        if (!url) {
          this.showToast('يرجى إدخال رابط ملف الـ PDF (Google Drive أو رابط مباشر)', 'error');
          return;
        }
      }
    } else {
      // video or link
      url = document.getElementById('modalMatUrl')?.value.trim();
      if (!url) {
        this.showToast('يرجى إدخال الرابط المطلوب', 'error');
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>جاري إضافة وحفظ المذكرة...</span>`;
    }

    try {
      await request('/materials', {
        method: 'POST',
        body: {
          title,
          group_id,
          type,
          url,
          file_data,
          file_name,
          description,
          is_homework: false,
          due_date: null,
        },
      });
      this.closeModal();
      this.showToast('تمت إضافة المذكرة بنجاح وستظهر فوراً في بوابات الطلاب وأولياء الأمور!', 'success');
      await this.loadRouteData('materials');
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>إضافة المذكرة الآن</span>`;
      }
      this.showToast(`فشل إضافة المذكرة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  deleteMaterial(id, title) {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('trash', 40, '#ef4444')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">تأكيد حذف المذكرة</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          هل أنت متأكد من حذف المذكرة <strong>"${escapeHtml(title)}"</strong>؟ لن يتمكن الطلاب من تحميلها بعد الآن.
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;" onclick="window.centrlyApp.confirmDeleteMaterial('${id}')">
            حذف نهائي
          </button>
        </div>
      </div>
    `;
    this.showModal('حذف مذكرة', bodyHtml);
  }

  async confirmDeleteMaterial(id) {
    this.closeModal();
    try {
      await request(`/materials/${id}`, { method: 'DELETE' });
      this.showToast('تم حذف المذكرة بنجاح', 'success');
      await this.loadRouteData('materials');
    } catch (err) {
      this.showToast(`فشل حذف المذكرة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  // ==========================================================================
  // Teacher Assistants Actions
  // ==========================================================================

  openAddTeacherAssistantModal() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalAddTeacherAssistantForm" onsubmit="window.centrlyApp.handleAddTeacherAssistantSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المساعد (الأسستنت) *</label>
          <input type="text" id="modalTA_Name" class="form-input" placeholder="اسم المساعد" required>
        </div>

        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم الهاتف (للتواصل والواتساب) *</label>
          <input type="tel" id="modalTA_Phone" class="form-input" placeholder="010..." dir="ltr" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">المجموعة المسندة</label>
            <select id="modalTA_GroupId" class="form-select">
              <option value="">جميع المجموعات (مسؤول عام)</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">طبيعة الدور والعمل *</label>
            <select id="modalTA_RoleType" class="form-select">
              <option value="both">إداري وتعليمي شامل</option>
              <option value="admin">إداري وتنظيمي فقط (حضور وكروت)</option>
              <option value="educational">تعليمي وتدريسي فقط (شرح ومتابعة)</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">نظام المحاسبة *</label>
            <select id="modalTA_SalaryModel" class="form-select" onchange="document.getElementById('modalTA_SalaryLabel').innerText = (this.value === 'per_session' ? 'أجر الحصة الواحدة (ج.م)' : 'المرتب الشهري الثابت (ج.م)')">
              <option value="monthly">مرتب شهري ثابت</option>
              <option value="per_session">أجر بالحصة الواحدة</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" id="modalTA_SalaryLabel" style="font-weight: 700;">المرتب الشهري الثابت (ج.م)</label>
            <input type="number" id="modalTA_SalaryAmount" class="form-input" placeholder="0" min="0" value="0">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddTeacherAssistantForm" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">إضافة المساعد الآن</button>
    `;
    this.showModal('إضافة مساعد (أسستنت) جديد للمعلم', bodyHtml, footerHtml);
  }

  async handleAddTeacherAssistantSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('modalTA_Name')?.value.trim();
    const phone = document.getElementById('modalTA_Phone')?.value.trim();
    const group_id = document.getElementById('modalTA_GroupId')?.value || null;
    const role_type = document.getElementById('modalTA_RoleType')?.value || 'both';
    const salary_model = document.getElementById('modalTA_SalaryModel')?.value || 'monthly';
    const salary_amount = parseFloat(document.getElementById('modalTA_SalaryAmount')?.value) || 0;

    if (!name || !phone) {
      this.showToast('يرجى كتابة اسم المساعد ورقم هاتفه', 'error');
      return;
    }

    try {
      await request('/assistants', {
        method: 'POST',
        body: {
          name,
          phone,
          group_id: group_id || null,
          role_type,
          salary_model,
          salary: salary_amount,
          salary_amount,
        },
      });
      this.closeModal();
      this.showToast(`تمت إضافة المساعد (${name}) بنجاح!`, 'success');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  openEditTeacherAssistantModal(assistantId) {
    const assistant = (this.teacherAssistants || []).find(a => a.id === assistantId);
    if (!assistant) return;

    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}" ${assistant.group_id === g.id ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
    const bodyHtml = `
      <form id="modalEditTeacherAssistantForm" onsubmit="window.centrlyApp.handleEditTeacherAssistantSubmit(event, '${assistantId}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المساعد (الأسستنت) *</label>
          <input type="text" id="modalEditTA_Name" class="form-input" value="${escapeHtml(assistant.name)}" required>
        </div>

        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم الهاتف *</label>
          <input type="tel" id="modalEditTA_Phone" class="form-input" value="${escapeHtml(assistant.phone || '')}" dir="ltr" required>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.85rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">المجموعة المسندة</label>
            <select id="modalEditTA_GroupId" class="form-select">
              <option value="" ${!assistant.group_id ? 'selected' : ''}>جميع المجموعات (مسؤول عام)</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">طبيعة الدور والعمل *</label>
            <select id="modalEditTA_RoleType" class="form-select">
              <option value="both" ${assistant.role_type === 'both' ? 'selected' : ''}>إداري وتعليمي شامل</option>
              <option value="admin" ${assistant.role_type === 'admin' ? 'selected' : ''}>إداري وتنظيمي فقط</option>
              <option value="educational" ${assistant.role_type === 'educational' ? 'selected' : ''}>تعليمي وتدريسي فقط</option>
            </select>
          </div>
        </div>

        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1.25rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">نظام المحاسبة *</label>
            <select id="modalEditTA_SalaryModel" class="form-select" onchange="document.getElementById('modalEditTA_SalaryLabel').innerText = (this.value === 'per_session' ? 'أجر الحصة الواحدة (ج.م)' : 'المرتب الشهري الثابت (ج.م)')">
              <option value="monthly" ${assistant.salary_model === 'monthly' ? 'selected' : ''}>مرتب شهري ثابت</option>
              <option value="per_session" ${assistant.salary_model === 'per_session' ? 'selected' : ''}>أجر بالحصة الواحدة</option>
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" id="modalEditTA_SalaryLabel" style="font-weight: 700;">
              ${assistant.salary_model === 'per_session' ? 'أجر الحصة الواحدة (ج.م)' : 'المرتب الشهري الثابت (ج.م)'}
            </label>
            <input type="number" id="modalEditTA_SalaryAmount" class="form-input" value="${Number(assistant.salary ?? assistant.salary_amount) || 0}" min="0">
          </div>
        </div>
      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalEditTeacherAssistantForm" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">حفظ التعديلات</button>
    `;
    this.showModal(`تعديل بيانات المساعد: ${escapeHtml(assistant.name)}`, bodyHtml, footerHtml);
  }

  async handleEditTeacherAssistantSubmit(e, assistantId) {
    e.preventDefault();
    const name = document.getElementById('modalEditTA_Name')?.value.trim();
    const phone = document.getElementById('modalEditTA_Phone')?.value.trim();
    const group_id = document.getElementById('modalEditTA_GroupId')?.value || null;
    const role_type = document.getElementById('modalEditTA_RoleType')?.value || 'both';
    const salary_model = document.getElementById('modalEditTA_SalaryModel')?.value || 'monthly';
    const salary_amount = parseFloat(document.getElementById('modalEditTA_SalaryAmount')?.value) || 0;

    try {
      await request(`/assistants/${assistantId}`, {
        method: 'PUT',
        body: {
          name,
          phone,
          group_id: group_id || null,
          role_type,
          salary_model,
          salary: salary_amount,
          salary_amount,
        },
      });
      this.closeModal();
      this.showToast('تم حفظ تعديلات المساعد بنجاح!', 'success');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`فشل تعديل بيانات المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  deleteTeacherAssistant(id, name) {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('trash', 40, '#ef4444')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">تأكيد حذف المساعد</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          هل أنت متأكد من حذف المساعد <strong>"${escapeHtml(name)}"</strong> من قائمة فريقك؟
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;" onclick="window.centrlyApp.confirmDeleteTeacherAssistant('${id}', '${escapeHtml(name)}')">
            حذف نهائي
          </button>
        </div>
      </div>
    `;
    this.showModal('حذف مساعد', bodyHtml);
  }

  async confirmDeleteTeacherAssistant(id, name) {
    this.closeModal();
    try {
      await request(`/assistants/${id}`, { method: 'DELETE' });
      this.showToast(`تم حذف المساعد (${name}) بنجاح`, 'success');
      await this.loadRouteData('assistants');
    } catch (err) {
      this.showToast(`فشل حذف المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  // Teacher Homework Review & Grading Actions (DEV-HOMEWORK)
  async refreshHomeworkReview() {
    await this.loadRouteData('homework');
    this.renderMainContent();
    this.showToast('تم تحديث قائمة تسليمات الواجب بنجاح', 'info');
  }

  async onSelectHomeworkAssignment(materialId) {
    if (!this.homeworkState) this.homeworkState = {};
    this.homeworkState.selectedMaterialId = materialId;
    await this.loadRouteData('homework');
  }

  async filterHomeworkSubmissionsByGroup(groupId) {
    if (!this.homeworkState) this.homeworkState = {};
    this.homeworkState.selectedGroupId = groupId;
    await this.loadRouteData('homework');
  }

  switchHomeworkTab(tabName) {
    if (!this.homeworkState) this.homeworkState = {};
    this.homeworkState.activeTab = tabName;
    this.renderMainContent();
  }

  switchHomeworkSubTab(subTabName) {
    if (!this.homeworkState) this.homeworkState = {};
    this.homeworkState.subTab = subTabName;
    this.renderMainContent();
  }

  async approveHomeworkSubmission(submissionId) {
    try {
      await request(`/homework/submissions/${submissionId}/review`, {
        method: 'PUT',
        body: { status: 'approved' },
      });
      this.showToast('تم اعتماد الواجب بنجاح', 'success');
      await this.loadRouteData('homework');
    } catch (err) {
      this.showToast(`فشل اعتماد الواجب: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  promptRejectHomework(submissionId, studentName) {
    const bodyHtml = `
      <div style="font-family: 'Cairo', sans-serif;">
        <p style="font-size: 0.95rem; color: #1e293b; margin-bottom: 1rem; line-height: 1.6;">
          أنت على وشك طلب إعادة حل الواجب من الطالب <strong style="color: var(--centrly-blue-800);">${escapeHtml(studentName)}</strong>.
          يمكنك كتابة ملاحظات وتوجيهات للمعلم تظهر للطالب في بوابته:
        </p>
        <div class="form-group" style="margin-bottom: 0.5rem;">
          <label class="form-label" style="font-weight: 700; color: #334155;">ملاحظات المعلم وأسباب الإعادة (اختياري):</label>
          <textarea id="rejectHomeworkNotes" class="form-input" rows="3" placeholder="اكتب ملاحظات وتوجيهات الإعادة للطالب..."></textarea>
        </div>
      </div>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="button" id="btnConfirmRejectHw" class="btn" style="background: #ea580c; color: #fff; font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; border: none; padding: 0.5rem 1.25rem; border-radius: 8px; cursor: pointer;" onclick="window.centrlyApp.confirmRejectHomework('${escapeHtml(submissionId)}', '${escapeHtml(studentName)}')">
        <span>تأكيد طلب الإعادة</span>
      </button>
    `;

    this.showModal(`طلب إعادة الواجب: ${escapeHtml(studentName)}`, bodyHtml, footerHtml);
  }

  async confirmRejectHomework(submissionId, studentName) {
    const notesInput = document.getElementById('rejectHomeworkNotes');
    const note = notesInput ? notesInput.value.trim() : '';
    const confirmBtn = document.getElementById('btnConfirmRejectHw');

    if (confirmBtn) {
      confirmBtn.disabled = true;
      confirmBtn.textContent = 'جاري الإرسال...';
    }

    try {
      await request(`/homework/submissions/${submissionId}/review`, {
        method: 'PUT',
        body: {
          status: 'rejected',
          teacher_notes: note || 'يرجى مراجعة الحل وإعادة إرسال الواجب مرة أخرى.',
        },
      });
      this.closeModal();
      this.showToast(`تم طلب إعادة الواجب من الطالب (${studentName}) بنجاح`, 'warning');
      await this.loadRouteData('homework');
    } catch (err) {
      this.showToast(`فشل تحديث حالة الواجب: ${err.message || 'حدث خطأ'}`, 'danger');
      if (confirmBtn) {
        confirmBtn.disabled = false;
        confirmBtn.textContent = 'تأكيد طلب الإعادة';
      }
    }
  }

  async sendHomeworkReminderWhatsApp(studentId, studentName, phone, targetType = 'student') {
    if (!phone) {
      this.showToast(`رقم هاتف ${targetType === 'parent' ? 'ولي الأمر' : 'الطالب'} غير متوفر للتذكير عبر واتساب`, 'warning');
      return;
    }
    const cleanPhone = phone.replace(/[^0-9]/g, '');
    const targetPhone = cleanPhone.startsWith('2') ? cleanPhone : `2${cleanPhone}`;
    const hwTitle = this.homeworkState?.currentHomework?.title || 'الواجب المنزلي';
    
    // Generate short student portal link
    const canonicalOrigin = 'https://centerly-platform.vercel.app';
    const cleanSid = String(studentId || '').replace(/-/g, '').slice(0, 8);
    const studentPortalUrl = cleanSid ? `${canonicalOrigin}/s/s${cleanSid}` : `${canonicalOrigin}/parent-portal?portal=student`;

    const message = targetType === 'parent'
      ? `السلام عليكم ورحمة الله، ولي أمر الطالب (${studentName}) المحترم.\nنود إحاطتكم علماً بأن الطالب لم يقم بتسليم الواجب المطلوب (${hwTitle}) حتى الآن.\nيرجى حث الطالب على رفع حل الواجب عبر بوابته الخاصة:\n${studentPortalUrl}\n\nشاكرين تعاونكم المستمر حرصاً على تفوقه!`
      : `أهلاً بك يا ${studentName}، نود تذكيرك بأن لديك واجب مطلوب تسليمه لمادة المعلم (${hwTitle}). يرجى رفع حل الواجب بصيغة PDF عبر بوابتك الخاصة:\n${studentPortalUrl}\n\nبالتوفيق والنجاح دائماً!`;

    const waUrl = `https://wa.me/${targetPhone}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank');
  }

  copyAllMissingStudentsPhones() {
    const missing = this.homeworkState?.missing || [];
    const phones = missing.map(m => m.phone).filter(Boolean);
    if (phones.length === 0) {
      this.showToast('لا توجد أرقام هواتف مسجلة للطلاب المتأخرين', 'info');
      return;
    }
    this.copyToClipboard(phones.join(', '), `تم نسخ ${phones.length} رقم هاتف للطلاب المتأخرين!`, 'أرقام هواتف الطلاب المتأخرين');
  }

  // Dedicated Homework Creation Modal with 3 Clear Modes (Text, PDF Upload, External Link)
  openAddHomeworkModal() {
    this._currentHwMode = 'text';
    this._selectedHwPdfFile = null;

    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${escapeHtml(g.name)}</option>`).join('');
    const nextWeek = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const bodyHtml = `
      <form id="modalAddHomeworkForm" onsubmit="window.centrlyApp.handleAddHomeworkSubmit(event)">
        
        <!-- Title -->
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">عنوان الواجب *</label>
          <input type="text" id="modalHwTitle" class="form-input" placeholder="عنوان الواجب المنزلي" required>
        </div>

        <!-- Target Group & Due Date -->
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 0.95rem;">
          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">المجموعة المستهدفة</label>
            <select id="modalHwGroupId" class="form-select">
              <option value="">جميع المجموعات (متاح للكل)</option>
              ${groupOptions}
            </select>
          </div>

          <div class="form-group">
            <label class="form-label" style="font-weight: 700;">آخر موعد لتسليم الواجب</label>
            <input type="date" id="modalHwDueDate" class="form-input" value="${nextWeek}">
          </div>
        </div>

        <!-- Mode Selector Pills (3 Modes Requested by User) -->
        <div style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 800; color: #0f172a; margin-bottom: 0.45rem;">اختر طريقة تقديم الواجب للطلاب *</label>
          <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.4rem; background: #f1f5f9; padding: 0.35rem; border-radius: 0.65rem; border: 1px solid #e2e8f0;">
            <button type="button" id="hwTabBtn-text" onclick="window.centrlyApp.switchHwTab('text')" 
              style="display: flex; align-items: center; justify-content: center; padding: 0.55rem 0.4rem; font-size: 0.85rem; font-weight: 800; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; background: #ffffff; color: var(--centrly-blue-800); box-shadow: 0 2px 4px rgba(0,0,0,0.08); text-align: center;">
              نص حر
            </button>
            <button type="button" id="hwTabBtn-pdf" onclick="window.centrlyApp.switchHwTab('pdf')" 
              style="display: flex; align-items: center; justify-content: center; padding: 0.55rem 0.4rem; font-size: 0.85rem; font-weight: 700; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b; text-align: center;">
              رفع ملف PDF
            </button>
            <button type="button" id="hwTabBtn-link" onclick="window.centrlyApp.switchHwTab('link')" 
              style="display: flex; align-items: center; justify-content: center; padding: 0.55rem 0.4rem; font-size: 0.85rem; font-weight: 700; border-radius: 0.5rem; border: none; cursor: pointer; transition: all 0.2s; background: transparent; color: #64748b; text-align: center;">
              رابط / لينك
            </button>
          </div>
        </div>

        <!-- Mode 1: Free Text Section -->
        <div id="hwSection-text">
          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="font-weight: 800; color: #0f172a; display: flex; align-items: center; justify-content: space-between;">
              <span style="display: flex; align-items: center; gap: 0.35rem;">
                ${getIcon('homework', 16, 'var(--centrly-blue-700)')}
                <span>نص وتفاصيل الواجب المطلوب حله *</span>
              </span>
              <span style="font-size: 0.75rem; color: #64748b; font-weight: 600;">(Ctrl + Enter للحفظ السريع)</span>
            </label>
            <textarea id="modalHwDescriptionText" class="form-input" rows="5" 
              placeholder="اكتب هنا تفاصيل الواجب والصفحات والأسئلة المطلوبة..." 
              style="line-height: 1.6; resize: vertical;"></textarea>
          </div>
        </div>

        <!-- Mode 2: Direct PDF Upload Section -->
        <div id="hwSection-pdf" style="display: none;">
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" style="font-weight: 800; color: #0f172a;">رفع ملف الواجب بصيغة PDF من جهازك *</label>
            
            <input type="file" id="modalHwPdfFileInput" accept="application/pdf" style="display: none;" onchange="window.centrlyApp.handleHwPdfSelected(event)">
            
            <div id="hwPdfDropzone" onclick="document.getElementById('modalHwPdfFileInput').click()" 
              style="border: 2px dashed #3b82f6; border-radius: 0.75rem; padding: 1.35rem 1rem; text-align: center; cursor: pointer; background: #eff6ff; transition: all 0.2s;">
              <div style="display: flex; justify-content: center; margin-bottom: 0.4rem;">
                ${getIcon('upload', 32, '#2563eb')}
              </div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #1e40af; margin-bottom: 0.2rem;">
                اضغط هنا لاختيار ملف PDF من اللابتوب أو الموبايل
              </div>
              <div style="font-size: 0.78rem; color: #64748b;">
                ملفات PDF فقط (الحد الأقصى 25 ميجابايت)
              </div>
            </div>

            <div id="hwPdfSelectedPreview" style="display: none; margin-top: 0.6rem; background: #f0fdf4; border: 1.5px solid #86efac; border-radius: 0.65rem; padding: 0.75rem 0.9rem; align-items: center; justify-content: space-between;">
              <div style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden;">
                <span style="display: flex; align-items: center; color: #15803d;">${getIcon('file', 22, '#15803d')}</span>
                <div style="overflow: hidden;">
                  <div id="hwPdfSelectedName" style="font-weight: 800; font-size: 0.875rem; color: #166534; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;"></div>
                  <div id="hwPdfSelectedSize" style="font-size: 0.75rem; color: #15803d; font-weight: 600;"></div>
                </div>
              </div>
              <button type="button" onclick="window.centrlyApp.clearHwPdfFile()" class="btn btn-sm" style="background: #ffffff; border: 1px solid #fca5a5; color: #dc2626; font-weight: 700; font-size: 0.75rem; padding: 0.3rem 0.65rem; border-radius: 0.4rem; cursor: pointer;">
                تغيير الملف
              </button>
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="font-weight: 700; color: #334155;">تعليمات أو ملاحظات إضافية على الملف (اختياري)</label>
            <textarea id="modalHwDescriptionPdf" class="form-input" rows="2" placeholder="اكتب أي ملاحظات أو تعليمات إضافية للطلاب حول الملف..." style="line-height: 1.5; resize: vertical;"></textarea>
          </div>
        </div>

        <!-- Mode 3: External Link Section -->
        <div id="hwSection-link" style="display: none;">
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" style="font-weight: 800; color: #0f172a;">رابط ملف الواجب (Google Drive / لينك مباشر) *</label>
            <input type="url" id="modalHwUrl" class="form-input" placeholder="https://drive.google.com/... أو أي رابط خارجي" dir="ltr">
            <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
              تأكد أن الرابط متاح للعرض والمشاركة مع الطلاب
            </div>
          </div>

          <div class="form-group" style="margin-bottom: 0.5rem;">
            <label class="form-label" style="font-weight: 700; color: #334155;">تعليمات أو ملاحظات على الرابط (اختياري)</label>
            <textarea id="modalHwDescriptionLink" class="form-input" rows="2" placeholder="اكتب أي ملاحظات أو تعليمات إضافية للطلاب حول الرابط..." style="line-height: 1.5; resize: vertical;"></textarea>
          </div>
        </div>

      </form>
    `;

    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="modalAddHomeworkForm" id="btnPublishHomework" class="btn btn-primary" style="font-weight: 800; padding: 0.55rem 1.4rem;">
        نشر الواجب للطلاب الآن
      </button>
    `;

    this.showModal('نشر وتكليف واجب منزلي جديد (Homework)', bodyHtml, footerHtml);
  }

  switchHwTab(mode) {
    this._currentHwMode = mode;
    const tabs = ['text', 'pdf', 'link'];
    tabs.forEach(t => {
      const btn = document.getElementById(`hwTabBtn-${t}`);
      const sec = document.getElementById(`hwSection-${t}`);
      if (btn && sec) {
        if (t === mode) {
          btn.style.background = '#ffffff';
          btn.style.color = 'var(--centrly-blue-800)';
          btn.style.boxShadow = '0 2px 4px rgba(0,0,0,0.08)';
          btn.style.fontWeight = '800';
          sec.style.display = 'block';
        } else {
          btn.style.background = 'transparent';
          btn.style.color = '#64748b';
          btn.style.boxShadow = 'none';
          btn.style.fontWeight = '700';
          sec.style.display = 'none';
        }
      }
    });

    setTimeout(() => {
      if (mode === 'text') document.getElementById('modalHwDescriptionText')?.focus();
      else if (mode === 'link') document.getElementById('modalHwUrl')?.focus();
    }, 50);
  }

  handleHwPdfSelected(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== 'application/pdf' && !file.name.toLowerCase().endsWith('.pdf')) {
      this.showToast('يرجى اختيار ملف PDF صالح فقط', 'error');
      e.target.value = '';
      return;
    }

    if (file.size > 25 * 1024 * 1024) {
      this.showToast('حجم الملف كبير جداً (أقصى حد مسموح 25 ميجابايت)', 'error');
      e.target.value = '';
      return;
    }

    this._selectedHwPdfFile = file;

    const preview = document.getElementById('hwPdfSelectedPreview');
    const dropzone = document.getElementById('hwPdfDropzone');
    const nameEl = document.getElementById('hwPdfSelectedName');
    const sizeEl = document.getElementById('hwPdfSelectedSize');

    if (preview && nameEl && sizeEl) {
      nameEl.textContent = file.name;
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      sizeEl.textContent = `${sizeMB} ميجابايت`;
      preview.style.display = 'flex';
      if (dropzone) dropzone.style.display = 'none';
    }
  }

  clearHwPdfFile() {
    this._selectedHwPdfFile = null;
    const input = document.getElementById('modalHwPdfFileInput');
    if (input) input.value = '';
    const preview = document.getElementById('hwPdfSelectedPreview');
    const dropzone = document.getElementById('hwPdfDropzone');
    if (preview) preview.style.display = 'none';
    if (dropzone) dropzone.style.display = 'block';
  }

  onHomeworkTypeChange(mode) {
    // Kept for backward compatibility
  }

  async handleAddHomeworkSubmit(e) {
    e.preventDefault();
    const mode = this._currentHwMode || 'text';
    const title = document.getElementById('modalHwTitle')?.value.trim();
    const group_id = document.getElementById('modalHwGroupId')?.value || null;
    const due_date = document.getElementById('modalHwDueDate')?.value || null;
    const submitBtn = document.getElementById('btnPublishHomework');

    if (!title) {
      this.showToast('يرجى كتابة عنوان الواجب', 'error');
      return;
    }

    let description = '';
    let url = '';
    let file_data = null;
    let file_name = null;

    if (mode === 'text') {
      description = document.getElementById('modalHwDescriptionText')?.value.trim() || '';
      if (!description) {
        this.showToast('يرجى كتابة نص الواجب وتفاصيل المطلوب حله', 'error');
        return;
      }
    } else if (mode === 'pdf') {
      description = document.getElementById('modalHwDescriptionPdf')?.value.trim() || '';
      if (!this._selectedHwPdfFile) {
        this.showToast('يرجى اختيار ملف PDF لرفعه للطلاب', 'error');
        return;
      }
      file_name = this._selectedHwPdfFile.name;

      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.innerHTML = `<span>جاري قراءة ورفع الملف...</span>`;
      }

      try {
        file_data = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result);
          reader.onerror = () => reject(new Error('فشل قراءة الملف من الجهاز'));
          reader.readAsDataURL(this._selectedHwPdfFile);
        });
      } catch (readErr) {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.innerHTML = `<span>نشر الواجب للطلاب الآن</span>`;
        }
        this.showToast('فشل قراءة ملف الـ PDF، يرجى المحاولة مرة أخرى', 'error');
        return;
      }
    } else if (mode === 'link') {
      url = document.getElementById('modalHwUrl')?.value.trim() || '';
      description = document.getElementById('modalHwDescriptionLink')?.value.trim() || '';
      if (!url) {
        this.showToast('يرجى إدخال رابط ملف الواجب (Google Drive أو لينك خارجي)', 'error');
        return;
      }
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `<span>جاري نشر وتكليف الواجب...</span>`;
    }

    try {
      await request('/materials', {
        method: 'POST',
        body: {
          title,
          group_id,
          type: 'pdf',
          url,
          file_data,
          file_name,
          description: description || null,
          is_homework: true,
          due_date,
          book_name: null,
          pages: null,
          questions: null,
        },
      });

      this.closeModal();
      this.showToast('تم نشر الواجب بنجاح! سيظهر الآن في بوابات الطلاب وأولياء الأمور', 'success');
      
      if (this.currentRoute === 'homework') {
        await this.loadRouteData('homework');
      } else if (this.currentRoute === 'materials') {
        await this.loadRouteData('materials');
      }
    } catch (err) {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = `<span>نشر الواجب للطلاب الآن</span>`;
      }
      this.showToast(`فشل نشر الواجب: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  copyHomeworkAssignmentText(homeworkId) {
    const hw = (this.homeworkState?.assignments || this.materials || []).find(h => h.id === homeworkId);
    if (!hw) {
      this.showToast('تعذر العثور على بيانات الواجب للنسخ', 'error');
      return;
    }

    let text = `*واجب منزلي جديد مطلوب تسليمه*\n`;
    text += `• *العنوان:* ${hw.title}\n`;
    if (hw.book_name) text += `• *الكتاب / الملزمة:* ${hw.book_name}\n`;
    if (hw.pages) text += `• *الصفحات المطلوبة:* ${hw.pages}\n`;
    if (hw.questions) text += `• *أرقام الأسئلة:* ${hw.questions}\n`;
    if (hw.description) text += `• *وصف الواجب والمطلوب حله:*\n${hw.description}\n`;
    if (hw.due_date) text += `• *آخر موعد للتسليم:* ${hw.due_date}\n`;
    if (hw.url && hw.url !== '#' && hw.url.trim().length > 0) text += `• *رابط الملف المرفق:* ${hw.url}\n`;
    text += `\n• *طريقة التسليم:* حل المطلوب في كشكولك بخط واضح، وصوّر الصفحات وحوّلها لـ PDF وارفعها مباشرة عبر رابط بوابتك الخاصة في Centrly.\nبالتوفيق والنجاح دائماً.`;

    this.copyToClipboard(text, 'تم نسخ تفاصيل الواجب بنجاح! جاهز للصق في جروب الواتساب', 'تفاصيل الواجب');
  }

  // ==========================================================================
  // Superadmin & Business Owner Actions (Centrly HQ)
  // ==========================================================================

  async refreshBusinessDashboard() {
    await this.loadRouteData('admin-dashboard');
    this.renderMainContent();
    this.showToast('تم تحديث بيانات لوحة الإدارة', 'info');
  }

  async refreshAdminPaymentProofs() {
    await this.loadRouteData('admin-proofs');
    this.renderMainContent();
    this.showToast('تم تحديث قائمة الإيصالات', 'info');
  }

  setAdminProofsFilter(filter) {
    this.adminProofsFilter = filter;
    this.renderMainContent();
  }

  openProofFullscreenModal(proofId) {
    const proofs = this.adminProofsData?.payment_proofs || [];
    const proof = proofs.find(p => p.id === proofId);
    if (!proof || !proof.proof_image_url) {
      this.showToast('تعذر العثور على صورة الإيصال', 'warning');
      return;
    }

    const modalHtml = `
      <div id="proofFullscreenModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); align-items: center; justify-content: center; z-index: 10000; padding: 1rem;" dir="rtl">
        <div style="max-width: 900px; width: 100%; max-height: 95vh; display: flex; flex-direction: column; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1.5px solid #334155; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem; border-bottom: 1px solid #1e293b; background: #0b1120;">
            <div style="color: #fff; font-weight: 800; font-size: 0.95rem;">
              إيصال تحويل: ${escapeHtml(proof.tenants?.name || proof.tenant_name || 'مؤسسة')} (${Number(proof.amount || 0).toLocaleString('ar-EG')} ج.م)
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <a href="${proof.proof_image_url}" download="إيصال_تحويل_${proof.id}.png" class="btn btn-secondary btn-sm" style="font-size: 0.775rem; background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;">
                ${getIcon('download', 14)}
                <span>تحميل الصورة</span>
              </a>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeProofFullscreenModal()" style="border: none; background: rgba(255,255,255,0.15); color: #fff; padding: 0.35rem 0.6rem; cursor: pointer; display: flex; align-items: center;">
                ${getIcon('close', 16, '#fff')}
              </button>
            </div>
          </div>

          <div style="padding: 1rem; overflow: auto; display: flex; justify-content: center; align-items: center; background: #020617; flex: 1;">
            <img src="${proof.proof_image_url}" alt="إيصال تحويل مكبر" style="max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 8px;">
          </div>

          <div style="padding: 0.75rem 1.25rem; background: #0b1120; border-top: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem; color: #94a3b8;">
            <span>المرجع: ${escapeHtml(proof.reference_number || 'غير مسجل')}</span>
            <span>طريقة الدفع: ${proof.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 'إنستاباي'}</span>
          </div>

        </div>
      </div>
    `;

    const existing = document.getElementById('proofFullscreenModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  closeProofFullscreenModal() {
    const modal = document.getElementById('proofFullscreenModal');
    if (modal) modal.remove();
  }

  handleApproveProof(proofId, extendDays = 30) {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('checkCircle', 40, '#10b981')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">تأكيد اعتماد الإيصال</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          هل أنت متأكد من اعتماد هذا الإيصال وتفعيل الاشتراك لهذا المشترك لمدة <strong>${extendDays} يوماً</strong>؟
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #10b981; border-color: #10b981; font-weight: 800;" onclick="window.centrlyApp.confirmApproveProof('${proofId}', ${extendDays})">
            اعتماد وتفعيل الاشتراك
          </button>
        </div>
      </div>
    `;
    this.showModal('اعتماد إيصال سداد', bodyHtml);
  }

  async confirmApproveProof(proofId, extendDays = 30) {
    this.closeModal();
    try {
      await request(`/admin/payment-proofs/${proofId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ extend_days: extendDays }),
      });

      this.closeProofFullscreenModal();
      this.showToast(`تم اعتماد الإيصال بنجاح وتفعيل الاشتراك لمدة ${extendDays} يوماً!`, 'success');
      
      await Promise.all([
        this.loadRouteData('admin-proofs'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل اعتماد الإيصال: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  handleRejectProofPrompt(proofId) {
    const defaultReason = 'التحويل لم يصل إلى الحساب البنكي أو المحفظة';
    const bodyHtml = `
      <form id="formRejectProof" onsubmit="event.preventDefault(); window.centrlyApp.confirmRejectProof('${proofId}');">
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700;">سبب الرفض (سيتم إشعار الحساب به) *</label>
          <textarea id="adminRejectReasonInput" class="form-input" rows="3" required style="resize: vertical;">${defaultReason}</textarea>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;">تأكيد الرفض</button>
        </div>
      </form>
    `;
    this.showModal('رفض إيصال السداد', bodyHtml);
    setTimeout(() => {
      document.getElementById('adminRejectReasonInput')?.focus();
    }, 150);
  }

  async confirmRejectProof(proofId) {
    const reason = document.getElementById('adminRejectReasonInput')?.value?.trim();
    if (!reason) {
      this.showToast('يرجى توضيح سبب الرفض', 'warning');
      return;
    }
    this.closeModal();

    try {
      await request(`/admin/payment-proofs/${proofId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      this.closeProofFullscreenModal();
      this.showToast('تم رفض الإيصال بنجاح', 'info');
      await Promise.all([
        this.loadRouteData('admin-proofs'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل رفض الإيصال: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  async refreshAdminTenants() {
    await this.loadRouteData('admin-tenants');
    this.renderMainContent();
    this.showToast('تم تحديث دليل المشتركين', 'info');
  }

  setAdminTenantsFilter(filter) {
    this.adminTenantsFilter = filter;
    this.renderMainContent();
  }

  handleAdminTenantsSearch(val) {
    this.adminTenantsSearchQuery = val;
    this.renderMainContent();
    setTimeout(() => {
      const inp = document.getElementById('adminTenantsSearchInput');
      if (inp) {
        inp.focus();
        inp.selectionStart = inp.selectionEnd = inp.value.length;
      }
    }, 50);
  }

  openTenantOverrideModal(tenantId, tenantName, currentStatus, currentTier = 'growth') {
    const tier = (currentTier || 'growth').toLowerCase();
    const bodyHtml = `
      <form id="tenantOverrideForm" onsubmit="window.centrlyApp.handleSaveTenantOverride(event, '${tenantId}')">
        <div style="margin-bottom: 1.25rem;">
          <h4 style="margin: 0 0 0.35rem; font-weight: 800; color: var(--centrly-ink);">
            تعديل اشتراك: ${escapeHtml(tenantName)}
          </h4>
          <p style="font-size: 0.825rem; color: #64748b; margin: 0;">
            الحالة الحالية: <strong style="color: var(--centrly-blue-700);">${currentStatus}</strong>
          </p>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">خطة / باقة المشترك</label>
          <select id="overrideTier" class="form-select" style="width: 100%;">
            <option value="starter" ${tier === 'starter' || tier.includes('300') || tier.includes('100') ? 'selected' : ''}>باقة 300 طالب (Starter - سعة 300)</option>
            <option value="growth" ${tier === 'growth' || tier.includes('750') || tier.includes('250') ? 'selected' : ''}>باقة 750 طالب (Growth - سعة 750)</option>
            <option value="pro" ${tier === 'pro' || tier.includes('1500') || tier.includes('500') ? 'selected' : ''}>باقة 1500 طالب (Pro - سعة 1500)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">الحالة الجديدة للاشتراك</label>
          <select id="overrideStatus" class="form-select" style="width: 100%;">
            <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>نشط ومفعل (Active)</option>
            <option value="trial" ${currentStatus === 'trial' ? 'selected' : ''}>فترة تجريبية (Trial)</option>
            <option value="past_due" ${currentStatus === 'past_due' ? 'selected' : ''}>متأخر / بانتظار السداد (Past Due)</option>
            <option value="deactivated" ${currentStatus === 'deactivated' ? 'selected' : ''}>معطل وموقوف (Deactivated)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">تمديد الصلاحية لعدد أيام إضافي</label>
          <input type="number" id="overrideExtendDays" class="form-input" placeholder="عدد الأيام الإضافية" min="0" max="730" value="30">
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem;">
            سيتم إضافة هذه الأيام فوق الصلاحية الحالية أو من تاريخ اليوم (0 لعدم زيادة الأيام).
          </div>
        </div>

        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" id="btnSubmitOverride" class="btn btn-primary" style="font-weight: 800;">
            حفظ وتطبيق التعديل
          </button>
        </div>
      </form>
    `;
    this.showModal('تعديل صلاحية وخطة المشترك', bodyHtml);
  }

  async handleSaveTenantOverride(e, tenantId) {
    e.preventDefault();
    const status = document.getElementById('overrideStatus')?.value || 'active';
    const tier = document.getElementById('overrideTier')?.value || 'growth';
    const extendDays = Number(document.getElementById('overrideExtendDays')?.value || 0);
    const btn = document.getElementById('btnSubmitOverride');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جارٍ الحفظ...';
    }

    try {
      await request(`/admin/tenants/${tenantId}/subscription`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          tier,
          extend_days: extendDays > 0 ? extendDays : undefined,
        }),
      });

      this.closeModal();
      this.showToast('تم تعديل صلاحية المشترك وتحديث الاشتراك بنجاح!', 'success');
      await Promise.all([
        this.loadRouteData('admin-tenants'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل تعديل الاشتراك: ${err.message || 'خطأ في الخادم'}`, 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'حفظ وتطبيق التعديل';
      }
    }
  }

  // ==========================================================================
  // Teacher Settings & Management Actions
  // ==========================================================================

  switchSettingsTab(tab) {
    if (!this.settingsState) this.settingsState = {};
    this.settingsState.activeTab = tab;

    if (tab === 'whatsapp') {
      if (this.whatsappState?.status !== 'connected') {
        this.startWhatsAppStatusPolling('settings');
      }
    } else {
      this.stopWhatsAppStatusPolling();
    }

    this.renderMainContent();
  }

  async handleSaveTeacherProfile(e) {
    if (e) e.preventDefault();
    const name = document.getElementById('settingsTeacherName')?.value?.trim();
    const subject = document.getElementById('settingsSubject')?.value?.trim();
    const phone = document.getElementById('settingsPhone')?.value?.trim();
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
        }),
      }).catch(() => null);

      if (this.user) {
        if (name) this.user.name = name;
        if (subject) this.user.subject = subject;
        if (phone) this.user.phone = phone;
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
  }

  async handleSettingsChangePassword(e) {
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
  }

  toggleSettingsForgotPanel() {
    const panel = document.getElementById('settingsForgotPanel');
    if (panel) {
      panel.style.display = (panel.style.display === 'none' || !panel.style.display) ? 'block' : 'none';
    }
  }

  async handleSettingsForgotPassword() {
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
  }

  validateSettingsPasswordLive(val) {
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
  }

  async handleSaveFinancialPin(e) {
    if (e) e.preventDefault();
    const pin = document.getElementById('settingsFinancialPin')?.value?.trim();

    if (!pin) {
      this.showToast('يرجى كتابة رمز الأمان المكون من 4 إلى 6 أرقام لحفظه وتأمينه.', 'warning');
      return;
    }

    if (!/^\d{4,6}$/.test(pin)) {
      this.showToast('يجب أن يتكون الرمز السري من 4 إلى 6 أرقام فقط.', 'danger');
      return;
    }

    try {
      await request('/settings/security-pin', {
        method: 'POST',
        body: { pin }
      });
      localStorage.setItem('centrly_financial_pin', pin);
      localStorage.setItem('centrly_has_security_pin', 'true');
      this.hasSecurityPin = true;
      this.isFinancialUnlocked = false;
      if (this.user) {
        this.user.has_security_pin = true;
        authService.setUser(this.user);
      }
      this.showToast('تم حفظ وتأمين الرمز السري للأرباح بنجاح ومزامنته سحابياً مع حسابك.', 'success');
      this.renderApp();
    } catch (err) {
      this.showToast(err.message || 'فشل حفظ الرمز السري', 'danger');
    }
  }

  togglePasswordVisibility(inputId, btnEl, event) {
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }
    const input = document.getElementById(inputId);
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
    const btn = btnEl || input.parentElement?.querySelector('button');
    if (btn) {
      btn.innerHTML = getIcon(isPassword ? 'eyeOff' : 'eye', 18);
      btn.title = isPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور';
      btn.setAttribute('aria-label', isPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
      btn.style.opacity = '1';
    }

    // Keep cursor at end of input
    try {
      input.focus();
      if (input.setSelectionRange && input.value) {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    } catch (_) {}
  }

  togglePinVisibility(inputId, btnEl, event) {
    if (event) {
      if (typeof event.preventDefault === 'function') event.preventDefault();
      if (typeof event.stopPropagation === 'function') event.stopPropagation();
    }
    const input = document.getElementById(inputId);
    if (!input) return;
    const isPassword = input.type === 'password';
    const newType = isPassword ? 'text' : 'password';
    input.type = newType;
    try {
      input.setAttribute('type', newType);
    } catch (_) {}

    if (btnEl) {
      const span = btnEl.querySelector('span') || btnEl;
      span.innerText = isPassword ? 'إخفاء' : 'إظهار';
    }
    try {
      input.focus();
      if (input.setSelectionRange && input.value) {
        const len = input.value.length;
        input.setSelectionRange(len, len);
      }
    } catch (_) {}
  }
}

window.centrlyApp = new CentrlyApp();
window.addEventListener('DOMContentLoaded', () => {
  window.centrlyApp.init();
});
