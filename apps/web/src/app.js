import { registerCameraScannerActions } from './components/CameraScannerModal.js?v=1.0.0';
import { registerPortalDispatchActions } from './components/PortalDispatchModal.js?v=1.0.0';
import { registerStudentImportActions } from './components/StudentImportModal.js?v=1.0.0';
import { registerSecurityPinActions } from './components/SecurityPinManager.js?v=1.0.0';
import { authService } from './services/auth.js?v=4.9.26';
import { request, API_BASE_URL, isJwtExpired } from './services/api.js?v=4.9.27';
import { renderSidebar } from './components/Sidebar.js?v=5.1.0';
import { renderNavbar, renderNavLiveBadgeHtml } from './components/Navbar.js?v=5.1.1';
import { renderAuthScreens, renderEmailVerificationScreen, registerAuthActions } from './components/AuthScreens.js?v=4.9.21';
import { renderOnboardingWizard, registerOnboardingActions } from './components/OnboardingWizard.js';
import { renderTeacherDashboard } from './components/TeacherDashboard.js?v=2.3.0';
import { renderTeacherCalendar, registerTeacherCalendarActions } from './components/TeacherCalendar.js';
import { renderSessionsView, registerSessionsActions } from './components/SessionsView.js';
import { renderStudentsView, registerStudentsActions } from './components/StudentsView.js?v=4.8.16';
import { renderGroupsView, registerGroupsActions } from './components/GroupsView.js?v=4.8.12';
import { renderMessageLogsView, registerMessageLogsActions } from './components/MessageLogsView.js';
import { renderParentPortalView } from './components/ParentPortalView.js?v=6.0.0';
import { renderStudentPortalView } from './components/StudentPortalView.js?v=8.0.0';
import { renderUnifiedPortalLoginView, registerUnifiedPortalActions } from './components/UnifiedPortalLoginView.js?v=8.0.0';
import { renderHomeworkReviewView, registerHomeworkActions } from './components/HomeworkReviewView.js?v=4.0.2';
import { renderCenterOwnerDashboard, registerCenterOwnerActions } from './components/CenterOwnerDashboard.js?v=4.8.1';
import { renderStudentReportsView, registerStudentReportsActions } from './components/StudentReportsView.js?v=2.1.0';
import { renderRiskWatchlistView, registerRiskWatchlistActions } from './components/RiskWatchlistView.js';
import { renderBillingView, registerBillingActions } from './components/BillingView.js?v=4.0.0';
import { renderWhatsAppSettingsView, registerWhatsAppSettingsActions } from './components/WhatsAppSettingsView.js?v=4.9.6';
import { renderStudentCardsView, registerStudentCardsActions } from './components/StudentCardsView.js?v=4.0.0';
import { renderTeacherQuizzesView, registerTeacherQuizzesActions } from './components/TeacherQuizzesView.js?v=7.1.0';
import { renderCenterSessionsView } from './components/CenterSessionsView.js';
import { renderCenterTeachersView } from './components/CenterTeachersView.js';
import { renderCenterAssistantsView } from './components/CenterAssistantsView.js';
import { renderCenterRoomsView } from './components/CenterRoomsView.js';
import { renderCenterSettlementsView } from './components/CenterSettlementsView.js';
import { renderLandingView, registerLandingActions } from './components/LandingView.js?v=4.8.7';
import { renderMaterialsView, registerMaterialsActions } from './components/MaterialsView.js?v=3.0.0';
import { renderTeacherAssistantsView, registerTeacherAssistantsActions } from './components/TeacherAssistantsView.js?v=2.1.0';
import { renderBusinessOwnerDashboard, registerBusinessOwnerActions } from './components/BusinessOwnerDashboard.js?v=5.2.0';
import { renderAdminPaymentProofsView } from './components/AdminPaymentProofsView.js';
import { renderAdminTenantsView } from './components/AdminTenantsView.js?v=2.0.0';
import { renderAdminOutreachView } from './components/AdminOutreachView.js?v=1.0.1';
import { renderTeacherSettingsView, registerTeacherSettingsActions } from './components/TeacherSettingsView.js?v=4.9.9';
import { renderCouponsView, registerCouponsActions } from './components/CouponsView.js?v=4.7.6';
import { renderWhatsAppCenterView, registerWhatsAppCenterActions } from './components/WhatsAppCenterView.js?v=1.0.0';
import { renderVideoLessonsView, registerVideoLessonsActions } from './components/VideoLessonsView.js?v=1.1.0';
import { renderTeacherPlatformBuilderView, registerTeacherPlatformActions } from './components/TeacherPlatformBuilderView.js?v=1.3.0';
import { getIcon } from './utils/icons.js';
import { escapeHtml } from './utils/escapeHtml.js';
import { generateBarcode128Svg, openFullscreenBarcodeModal, downloadStudentCardAsPng, renderStudentBarcodeCardHtml, renderStudentAttendancePassHtml, cleanTeacherNameString } from './utils/studentBarcodeCard.js?v=4.9.21';
import { playBeep, unlockAudio } from './utils/beepAudio.js';
import { normalizeDigits } from './utils/normalizeDigits.js?v=4.8.5';

class CentrlyApp {
  isPlatformAdmin(user = this.user) {
    if (!user) return false;
    if (user.role === 'admin' || user.is_superadmin) return true;
    const email = (user.email || '').toLowerCase();
    const adminEmails = ['mohanedkahled84@gmail.com', 'mohanedkhaled84@gmail.com', 'mohanedkhaled2367@gmail.com', 'teacher@centrly.app'];
    return adminEmails.includes(email);
  }

  constructor() {
    this.user = authService.getUser();
    const isAdmin = this.isPlatformAdmin(this.user);
    const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    this.currentRoute = isAdmin ? 'admin-dashboard' : (isCenter ? 'center-dashboard' : 'dashboard');
    this.giftCodes = [];
    this.whatsappInboxData = null;
    this.whatsappActiveTab = 'inbox';
    this.whatsappFilter = 'ALL';
    this.adminOverviewData = null;
    this.adminProofsData = { payment_proofs: [] };
    this.adminProofsFilter = 'pending';
    this.adminTenantsData = { tenants: [] };
    this.adminTenantsFilter = 'all';
    this.adminTenantsSearchQuery = '';
    this.adminOutreachData = { leads: [], metrics: {} };
    this.adminOutreachFilter = 'all';
    this.adminOutreachSearchQuery = '';
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
    this.platformBuilderState = null;
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
    let cachedHasPin = null;
    try {
      cachedHasPin = (typeof localStorage !== 'undefined') ? localStorage.getItem('centrly_has_security_pin') : null;
    } catch (_) {}
    const cachedUser = authService.getUser();
    this.hasSecurityPin = (cachedUser && typeof cachedUser.has_security_pin === 'boolean')
      ? cachedUser.has_security_pin
      : (cachedHasPin !== null ? cachedHasPin === 'true' : false);
    try { localStorage.removeItem('centrly_financial_pin'); } catch (_) {}
    // Cross-Device Security: If account has a PIN, protected views are ALWAYS locked by default
    this.isFinancialUnlocked = !this.hasSecurityPin;
    this.hideFinancialNumbers = false;
    this.routeLoadingState = {};
    this.dataLoadedState = {};
    this.settingsState = { activeTab: 'profile', barcodeAudio: true };
    this.currentTheme = 'light';
    this.restoreCachedData();
    this.initTheme();
    registerMaterialsActions(this);
    registerVideoLessonsActions(this);
    registerTeacherPlatformActions(this);
    registerCouponsActions(this);
    registerTeacherAssistantsActions(this);
    registerHomeworkActions(this);
    registerTeacherSettingsActions(this);
    registerBusinessOwnerActions(this);
    registerStudentReportsActions(this);
    registerRiskWatchlistActions(this);
    registerTeacherQuizzesActions(this);
    registerStudentCardsActions(this);
    registerBillingActions(this);
    registerWhatsAppSettingsActions(this);
    registerCenterOwnerActions(this);
    registerSecurityPinActions(this);
    registerStudentsActions(this);
    registerGroupsActions(this);
    registerOnboardingActions(this);
    registerWhatsAppCenterActions(this);
    registerStudentImportActions(this);
    registerTeacherCalendarActions(this);
    registerPortalDispatchActions(this);
    registerCameraScannerActions(this);
    registerMessageLogsActions(this);
    registerSessionsActions(this);
    registerAuthActions(this);
    registerLandingActions(this);
    registerUnifiedPortalActions(this);
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

  getCachePrefix() {
    const user = this.user || authService.getUser();
    if (!user || !user.id) return null;
    const tenantId = user.tenant_id || user.id;
    return `centrly_cache_${tenantId}_`;
  }

  purgeLegacyCaches() {
    try {
      if (typeof localStorage === 'undefined') return;
      const legacyKeys = [
        'centrly_cache_students',
        'centrly_cache_groups',
        'centrly_cache_dashboardData',
        'centrly_cache_billingState',
        'centrly_cache_materials',
        'centrly_cache_teacherAssistants',
        'centrly_cache_centerTeachers',
        'centrly_cache_centerAssistants',
        'centrly_cache_centerRooms',
      ];
      legacyKeys.forEach(k => localStorage.removeItem(k));
    } catch (_) {}
  }

  resetTenantState() {
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
    this.whatsappState = null;
    this.routeErrors = {};
    this.materials = [];
    this.teacherAssistants = [];
    this.routeLoadingState = {};
    this.dataLoadedState = {};
    this.centerTeachers = [];
    this.centerAssistants = [];
    this.centerRooms = [];
  }

  saveCache(key, data) {
    try {
      const prefix = this.getCachePrefix();
      if (!prefix) return;
      localStorage.setItem(`${prefix}${key}`, JSON.stringify(data));
    } catch (_) {}
  }

  loadCache(key, defaultValue = null) {
    try {
      const prefix = this.getCachePrefix();
      if (!prefix) return defaultValue;
      const raw = localStorage.getItem(`${prefix}${key}`);
      return raw ? JSON.parse(raw) : defaultValue;
    } catch (_) {
      return defaultValue;
    }
  }

  restoreCachedData() {
    try {
      this.purgeLegacyCaches();
      const prefix = this.getCachePrefix();
      if (!prefix) {
        this.resetTenantState();
        return;
      }
      const cachedPlatform = this.loadCache('platformBuilderState', null);
      if (cachedPlatform) {
        this.platformBuilderState = cachedPlatform;
      }
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
      const cachedAdminOverview = this.loadCache('adminOverviewData', null);
      if (cachedAdminOverview && Array.isArray(cachedAdminOverview.activation_radar) && cachedAdminOverview.activation_radar.length > 0) {
        this.adminOverviewData = cachedAdminOverview;
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
      case 'admin-dashboard':
        return Boolean(this.adminOverviewData && Array.isArray(this.adminOverviewData.activation_radar));
      case 'admin-proofs':
        return Boolean(this.adminProofsData && Array.isArray(this.adminProofsData.payment_proofs));
      case 'admin-tenants':
        return Boolean(this.adminTenantsData && Array.isArray(this.adminTenantsData.tenants));
      case 'admin-outreach':
        return Boolean(this.adminOutreachData);
      case 'whatsapp-inbox':
        return Boolean(this.whatsappInboxData);
      case 'dashboard':
      case 'teacher-dashboard':
        return Boolean(this.dashboardData);
      case 'students':
        return Boolean(Array.isArray(this.students) && this.students.length > 0);
      case 'groups':
        return Boolean(Array.isArray(this.groups) && this.groups.length > 0);
      case 'sessions':
        return Boolean(this.sessionState?.id || (Array.isArray(this.groups) && this.groups.length > 0));
      case 'quizzes':
        return Boolean(Array.isArray(this.groups) && this.groups.length > 0);
      case 'homework':
        return Boolean(this.homeworkState?.assignments);
      case 'risk-watchlist':
        return Boolean(Array.isArray(this.watchlistData));
      case 'reports':
        return Boolean(this.reportsState?.leaderboard);
      case 'billing':
      case 'settings':
        return Boolean(this.billingState);
      case 'materials':
      case 'video-lessons':
        return Boolean(this.materials && this.materials.length > 0);
      case 'platform-builder':
        return Boolean(this.platformBuilderState);
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

  buildAdminOverviewData(overviewRaw, proofsRaw, tenantsRaw) {
    const overview = overviewRaw?.metrics || overviewRaw || {};
    const proofs = proofsRaw?.payment_proofs || [];
    const allTenants = tenantsRaw?.tenants || [];
    
    // Completely exclude archived / soft-deleted test teachers from calculations, radar, and KPIs
    const tenants = allTenants.filter(t => !t.deleted_at && t.subscription_status !== 'archived');
    
    const pendingProofs = proofs.filter(p => p.status === 'pending');
    const approvedProofs = proofs.filter(p => p.status === 'approved');
    const activeCount = tenants.filter(t => t.subscription_status === 'active').length;
    const trialCount = tenants.filter(t => t.subscription_status === 'trial').length;
    const expiredCount = tenants.filter(t => ['expired', 'past_due', 'deactivated'].includes(t.subscription_status)).length;

    // 1. Real Cash Collected (All-time from approved payment proofs)
    const totalCollectedEgp = approvedProofs.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    // 2. This Month Collected Cash & New Clients
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const thisMonthApprovedProofs = approvedProofs.filter(p => {
      const d = new Date(p.reviewed_at || p.created_at);
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    const thisMonthCollectedEgp = thisMonthApprovedProofs.reduce((sum, p) => sum + Number(p.amount || 0), 0);

    const thisMonthNewTenants = tenants.filter(t => {
      if (!t.created_at) return false;
      const d = new Date(t.created_at);
      return d.getFullYear() === curYear && d.getMonth() === curMonth;
    });
    const newClientsThisMonth = thisMonthNewTenants.length;

    // 3. Expected Next Month Normalized MRR (Restores regular plan prices after discounts)
    let expectedNextMonthMrr = 0;
    tenants.filter(t => t.subscription_status === 'active').forEach(t => {
      const tier = (t.subscription_tier || '').toLowerCase();
      const limit = Number(t.students_limit || t.settings?.students_limit || 0);
      const planName = (t.plan_name || t.settings?.plan_name || '').toLowerCase();
      if (limit >= 1500 || tier === 'pro' || planName.includes('1500')) {
        expectedNextMonthMrr += 1399;
      } else if (limit >= 750 || tier === 'growth' || planName.includes('750')) {
        expectedNextMonthMrr += 899;
      } else {
        expectedNextMonthMrr += 499;
      }
    });

    // 4. Onboarding & Activation Radar for New Clients
    const activationRadar = tenants.map(t => {
      const studentCount = Number(t.students_count || 0);
      let stage = 'no_students';
      let stageLabel = 'سجل ولم يضف طلاب بعد';
      let stageColor = '#f59e0b';
      if (studentCount > 0) {
        stage = 'has_students';
        stageLabel = `أضاف ${studentCount} طالب ⏳`;
        stageColor = '#2563eb';
      }
      return {
        ...t,
        studentCount,
        stage,
        stageLabel,
        stageColor,
      };
    });

    return {
      overview: {
        total_tenants: tenants.length || overview.total_tenants || 0,
        active_tenants: activeCount || overview.active_tenants || 0,
        trial_tenants: trialCount || overview.trial_tenants || 0,
        expired_tenants: expiredCount,
        total_collected_egp: totalCollectedEgp,
        approved_proofs_count: approvedProofs.length,
        this_month_collected_egp: thisMonthCollectedEgp,
        new_clients_this_month: newClientsThisMonth,
        expected_next_month_mrr: expectedNextMonthMrr,
        total_students: overview.total_students || 0,
        total_sessions: overview.total_sessions || 0,
        whatsapp: overview.whatsapp || { total_sent: 0, total_failed: 0, estimated_cost_egp: 0, status: 'active' },
      },
      subscription_breakdown: {
        active: activeCount,
        trial: trialCount,
        pending_verification: pendingProofs.length,
        expired: expiredCount,
      },
      pending_proofs: pendingProofs,
      activation_radar: activationRadar,
      recent_signups: tenants.slice(0, 5),
      at_risk_tenants: tenants.filter(t => t.subscription_status === 'trial').slice(0, 5).map(t => ({
        tenant_id: t.id,
        tenant_name: t.name,
        details: `تنتهي التجربة في: ${t.trial_ends_at ? new Date(t.trial_ends_at).toLocaleDateString('ar-EG') : 'قريباً'}`,
      })),
    };
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
        if (ovRes || proofsRes || tenantsRes) {
          this.adminOverviewData = this.buildAdminOverviewData(ovRes, proofsRes, tenantsRes);
          if (proofsRes) this.adminProofsData = proofsRes;
          if (tenantsRes) this.adminTenantsData = tenantsRes;
          this.saveCache('adminOverviewData', this.adminOverviewData);
          if (['admin-dashboard', 'admin-proofs', 'admin-tenants', 'admin-outreach'].includes(this.currentRoute)) {
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
        this.dataLoadedState['students'] = true;
      }
      if (grpRes) {
        this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
        this.saveCache('groups', this.groups);
        this.dataLoadedState['groups'] = true;
      }
      if (billingRes) {
        this.billingState = billingRes;
        this.saveCache('billingState', this.billingState);
        this.dataLoadedState['billing'] = true;
      }
    } catch (_) {}
  }

  async init() {
    const lingeringSplash = document.getElementById('centrlyInitialSplash');
    if (lingeringSplash) lingeringSplash.remove();

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

    // Offline / Online network listeners for resilient attendance recording
    window.addEventListener('online', () => {
      this.showToast('عادت شبكة الإنترنت! جاري مزامنة الحضور المسجل مع السيرفر...', 'info');
      this.flushOfflineAttendanceQueue();
      if (this.sessionState?.id && this.sessionState.status === 'in_progress') {
        this.pollLiveSessionUpdates();
      }
      if (this.currentRoute === 'sessions') {
        this.renderMainContent();
      }
    });

    window.addEventListener('offline', () => {
      this.showToast('انقطع اتصال الإنترنت. تم تفعيل وضع عدم الاتصال (Offline Mode) تلقائياً، يمكنك الاستمرار في رصد الحضور وسيتم حفظه بأمان.', 'warning');
      if (this.currentRoute === 'sessions') {
        this.renderMainContent();
      }
    });

    // Browser Back/Forward history navigation
    window.addEventListener('popstate', () => {
      const p = new URLSearchParams(window.location.search);
      const r = p.get('route');
      const target = r || (this.isPlatformAdmin(this.user) ? 'admin-dashboard' : (this.user?.role === 'center_owner' || this.user?.account_type === 'center' ? 'center-dashboard' : 'dashboard'));
      if (target && target !== this.currentRoute) {
        this.navigate(target);
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
    const explicitRoleParam = urlParams.get('role');
    if (portalToken) {
      if (portalType === 'student' || explicitRoleParam === 'student') {
        await this.loadStudentPortal(portalToken);
      } else {
        await this.loadParentPortal(portalToken);
      }
      return;
    }

    // DEV-PORTAL: Unified Portal Route (/portal, ?view=portal, teacher subdomain, or teacher path)
    const cleanPath = (window.location.pathname || '').trim().replace(/\/+$/, '');
    const currentHost = (window.location.hostname || '').toLowerCase();

    // Check if accessed via teacher subdomain (e.g. mr-omar.centerly-eg.com)
    let detectedTeacherSubdomain = null;
    const hostSegments = currentHost.split('.');
    if (hostSegments.length >= 3) {
      const firstSub = hostSegments[0];
      if (!['www', 'app', 'admin', 'api', 'dev', 'mail', 'centrly-platform'].includes(firstSub)) {
        detectedTeacherSubdomain = firstSub;
      }
    }

    // Or check if accessed via path (e.g. /mr-omar, /mr-omar/dashboard)
    const pathSegments = cleanPath.split('/').filter(Boolean);
    if (!detectedTeacherSubdomain && pathSegments.length > 0) {
      const seg0 = pathSegments[0].toLowerCase();
      if (seg0 === 'mr-omar' || seg0.startsWith('mr-')) {
        detectedTeacherSubdomain = seg0;
      }
    }

    if (detectedTeacherSubdomain) {
      window.__teacherSubdomain = detectedTeacherSubdomain;
    }

    const isPortalRoute = cleanPath === '/portal' || 
                          urlParams.get('view') === 'portal' || 
                          (urlParams.get('portal') === 'login' && !portalToken) ||
                          Boolean(detectedTeacherSubdomain);

    if (isPortalRoute) {
      const cachedPortalToken = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_portal_token')) ||
                                (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_portal_token'));
      const cachedPortalRole = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_portal_role')) ||
                               (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_portal_role'));

      if (cachedPortalToken) {
        const effectiveRole = (explicitRoleParam === 'parent' || explicitRoleParam === 'student')
          ? explicitRoleParam
          : (cachedPortalRole || 'parent');

        try {
          if (window.history && window.history.replaceState && window.location.pathname !== '/portal') {
            window.history.replaceState(null, '', '/portal');
          }
          if (effectiveRole) {
            localStorage.setItem('centrly_portal_role', effectiveRole);
            sessionStorage.setItem('centrly_portal_role', effectiveRole);
          }
        } catch (_) {}

        if (effectiveRole === 'student') {
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

    let hasToken = authService.isAuthenticated();
    const hasCachedSession = authService.hasSession();

    const adminRoutes = ['admin-dashboard', 'admin-proofs', 'admin-tenants', 'admin-outreach', 'coupons', 'activity-logs', 'video-lessons', 'materials', 'homework'];
    const rawRouteParam = urlParams.get('route');
    const requestedAdminRoute =
      (rawRouteParam && adminRoutes.includes(rawRouteParam)) ? rawRouteParam :
      (cleanPath === '/admin' || cleanPath === '/admin/overview' ? 'admin-dashboard' :
       cleanPath === '/admin/payment-proofs' || cleanPath === '/admin/proofs' ? 'admin-proofs' :
       cleanPath === '/admin/tenants' ? 'admin-tenants' :
       cleanPath === '/admin/outreach' ? 'admin-outreach' :
       cleanPath === '/admin/coupons' ? 'coupons' : null);

    if (!hasToken && !hasCachedSession) {
      if (requestedAdminRoute) {
        try {
          sessionStorage.setItem('centrly_redirect_route', requestedAdminRoute);
          localStorage.setItem('centrly_redirect_route', requestedAdminRoute);
        } catch (_) {}
        this.renderAuth('login');
        return;
      }

      const viewParam = urlParams.get('view');
      if (viewParam === 'login' || viewParam === 'signup') {
        this.renderAuth(viewParam);
      } else {
        this.renderLanding();
      }
      return;
    }

    // If access token is expired or missing, but session / refresh token exists, refresh it synchronously BEFORE making route requests
    if (!hasToken && hasCachedSession) {
      try {
        const refreshed = await authService.tryRefreshSession();
        if (refreshed) {
          hasToken = true;
        }
      } catch (err) {
        console.warn('Silent refresh on init encountered error:', err);
      }
    }

    // Retrieve active cached or refreshed user profile
    this.user = authService.getUser();

    // If user profile is missing but token is valid, fetch fresh profile from /auth/me
    if (!this.user && hasToken) {
      try {
        const me = await authService.getProfile();
        if (me?.user) {
          this.user = me.user;
          authService.setUser(this.user);
        }
      } catch (_) {}
    }

    // Safety fallback: only if completely unable to resolve any user or session credentials
    if (!this.user && !hasToken && !authService.hasSession()) {
      this.renderLanding();
      return;
    }

    // Clean up any lingering view=login or view=signup query params from address bar
    if (urlParams.has('view')) {
      const v = urlParams.get('view');
      if (v === 'login' || v === 'signup') {
        urlParams.delete('view');
        const remainingQuery = urlParams.toString();
        const cleanUrl = window.location.pathname + (remainingQuery ? `?${remainingQuery}` : '');
        if (window.history && window.history.replaceState) {
          window.history.replaceState(null, '', cleanUrl);
        }
      }
    }

    // Revalidate fresh profile in the background without blocking render or kicking user
    authService.getProfile().then(me => {
      if (me?.user) {
        this.user = { ...this.user, ...me.user };
        authService.setUser(this.user);
      }
    }).catch(() => {});

    const isAdmin = this.isPlatformAdmin(this.user);
    const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const userEmail = (this.user?.email || '').toLowerCase();
    const isOmarMohamadi = 
      this.user?.tenant_id === '0c67b644-ae42-49e8-975f-85b9d0af0e1b' || 
      userEmail === 'mohanedabdulhalim@gmail.com' ||
      userEmail.includes('omar') ||
      userEmail.includes('mohamadi') ||
      (this.user?.name || '').includes('عمر') ||
      (this.user?.teacher_name || '').includes('عمر') ||
      (this.user?.tenant_name || '').includes('عمر') ||
      isAdmin;
    const validTeacherRoutes = [
      'sessions', ...(isOmarMohamadi ? ['video-lessons'] : []), 'quizzes', 'homework', 'materials',
      'students', 'groups', 'assistants', 'calendar', 'student-cards',
      'dashboard', 'reports', 'risk-watchlist', 'settings', 'billing', 'whatsapp'
    ];
    const validCenterRoutes = [
      'center-sessions', 'center-dashboard', 'center-rooms',
      'center-teachers', 'center-assistants', 'groups', 'students', 'calendar', 'student-cards',
      'settings', 'activity-logs'
    ];
    const urlRoute = urlParams.get('route');
    const effectiveSavedRoute = (urlRoute && urlRoute !== 'null' && urlRoute !== 'undefined') ? urlRoute :
      ((typeof localStorage !== 'undefined' && localStorage.getItem('centrly_current_route')) ||
       (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_current_route')));
    const redirectRoute = (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_redirect_route')) ||
                          (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_redirect_route'));

    if (isAdmin) {
      if (requestedAdminRoute && adminRoutes.includes(requestedAdminRoute)) {
        this.currentRoute = requestedAdminRoute;
        try {
          sessionStorage.setItem('centrly_current_route', requestedAdminRoute);
          localStorage.setItem('centrly_current_route', requestedAdminRoute);
          sessionStorage.removeItem('centrly_redirect_route');
          localStorage.removeItem('centrly_redirect_route');
        } catch (_) {}
      } else if (redirectRoute && adminRoutes.includes(redirectRoute)) {
        this.currentRoute = redirectRoute;
        try {
          sessionStorage.setItem('centrly_current_route', redirectRoute);
          localStorage.setItem('centrly_current_route', redirectRoute);
          sessionStorage.removeItem('centrly_redirect_route');
          localStorage.removeItem('centrly_redirect_route');
        } catch (_) {}
      } else {
        this.currentRoute = (effectiveSavedRoute && adminRoutes.includes(effectiveSavedRoute)) ? effectiveSavedRoute : 'admin-dashboard';
      }
    } else if (isCenter) {
      this.currentRoute = (effectiveSavedRoute && validCenterRoutes.includes(effectiveSavedRoute)) ? effectiveSavedRoute : 'center-dashboard';
    } else {
      this.currentRoute = (effectiveSavedRoute && validTeacherRoutes.includes(effectiveSavedRoute)) ? effectiveSavedRoute : 'dashboard';
    }

    try {
      localStorage.setItem('centrly_current_route', this.currentRoute);
      sessionStorage.setItem('centrly_current_route', this.currentRoute);
      if (window.history && window.history.replaceState) {
        const cleanUrl = this.currentRoute && !['dashboard', 'admin-dashboard'].includes(this.currentRoute)
          ? `/?route=${encodeURIComponent(this.currentRoute)}`
          : '/';
        window.history.replaceState(null, '', cleanUrl);
      }
    } catch (_) {}

    // Cross-Device Account-Level Security: Sync PIN status from user profile and storage
    if (typeof this.user?.has_security_pin === 'boolean') {
      this.hasSecurityPin = this.user.has_security_pin;
      if (this.hasSecurityPin) {
        this.isFinancialUnlocked = false;
        try {
          localStorage.setItem('centrly_has_security_pin', 'true');
        } catch (_) {}
      }
    }

    this.restoreSessionState();
    this.flushOfflineAttendanceQueue();

    this.routeLoadingState[this.currentRoute] = !this.hasRouteData(this.currentRoute);
    this.studentsLoading = this.currentRoute === 'students' && (!Array.isArray(this.students) || this.students.length === 0);
    this.renderApp();
    this.startProactiveSessionRefresher();

    // Mark app as successfully loaded so watchdog/splash dismisses
    window.__centrlyLoaded = true;

    // Async background security PIN check without blocking initial render
    request('/settings/security-pin').then(pinStatus => {
      if (pinStatus && typeof pinStatus.has_pin === 'boolean') {
        const changed = this.hasSecurityPin !== pinStatus.has_pin;
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
        if (changed && this.currentRoute === 'finance') {
          this.renderMainContent();
        }
      }
    }).catch(() => {});

    // Async background active session sync without blocking initial render
    if (!this.sessionState?.id) {
      request('/sessions?status=in_progress').then(async (activeSessions) => {
        const activeList = Array.isArray(activeSessions) ? activeSessions : (activeSessions?.sessions || []);
        if (activeList.length > 0) {
          await this.syncAndResumeServerSession(activeList[0].id);
          this.renderMainContent();
        }
      }).catch(() => {});
    } else if (this.sessionState?.status === 'in_progress') {
      this.startLiveSessionSync();
    }

    // Load active route data once
    try {
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      console.warn('Initial route load error on refresh:', err);
    } finally {
      this.routeLoadingState[this.currentRoute] = false;
      this.dataLoadedState[this.currentRoute] = true;
      this.studentsLoading = false;
      this.renderMainContent();
    }

    // Defer prefetching core data until main thread is idle (saves bandwidth and CPU on weak phones)
    const deferPrefetch = () => {
      this.prefetchCoreData().then(() => {
        if (['students', 'groups', 'dashboard', 'billing'].includes(this.currentRoute)) {
          this.renderMainContent();
        }
      }).catch(() => {});
    };
    if (typeof window !== 'undefined' && window.requestIdleCallback) {
      window.requestIdleCallback(deferPrefetch, { timeout: 3000 });
    } else {
      setTimeout(deferPrefetch, 1000);
    }
  }

  startProactiveSessionRefresher() {
    if (this._sessionRefresherInitialized) return;
    this._sessionRefresherInitialized = true;

    const checkAndRefresh = async () => {
      if (!authService.hasSession()) return;
      const token = authService.getToken();
      if (!token) {
        try { await authService.tryRefreshSession(); } catch (_) {}
        return;
      }

      // Proactively refresh if token will expire within 15 minutes (900 seconds)
      if (isJwtExpired(token, 900)) {
        try {
          await authService.tryRefreshSession();
        } catch (err) {
          console.warn('[ProactiveSessionRefresher] Background refresh deferred:', err);
        }
      }
    };

    // Run periodic check every 3 minutes
    if (this._sessionRefreshTimer) clearInterval(this._sessionRefreshTimer);
    this._sessionRefreshTimer = setInterval(checkAndRefresh, 3 * 60 * 1000);

    // Immediate check when window regains focus or browser tab becomes visible
    window.addEventListener('focus', checkAndRefresh);
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        checkAndRefresh();
      }
    });

    // Cross-tab synchronization via storage events
    window.addEventListener('storage', (e) => {
      if (e.key === 'centrly_user' && e.newValue) {
        try {
          const parsed = JSON.parse(e.newValue);
          if (parsed && parsed.id) {
            this.user = parsed;
          }
        } catch (_) {}
      } else if (e.key === 'centrly_token' && e.newValue) {
        checkAndRefresh();
      }
    });

    // Initial check right after bootstrap
    setTimeout(checkAndRefresh, 1000);
  }

  getAppEl() {
    const splash = document.getElementById('centrlyInitialSplash');
    if (splash) splash.remove();
    let appEl = document.getElementById('app');
    if (!appEl && typeof document !== 'undefined' && document.body) {
      appEl = document.createElement('div');
      appEl.id = 'app';
      document.body.appendChild(appEl);
    }
    return appEl;
  }

  // ==========================================================================
  async logout() {
    this.stopWhatsAppStatusPolling();
    this.resetTenantState();
    await authService.logout();
  }

  toggleSidebar(forceClose = false) {
    const sidebar = document.getElementById('appSidebar');
    let backdrop = document.getElementById('appSidebarBackdrop');
    if (!backdrop) {
      backdrop = document.createElement('div');
      backdrop.id = 'appSidebarBackdrop';
      backdrop.onclick = () => this.toggleSidebar(true);
      backdrop.addEventListener('touchmove', (e) => {
        if (e.cancelable) e.preventDefault();
      }, { passive: false });
      document.body.appendChild(backdrop);
    }
    const isOpening = !forceClose && sidebar && !sidebar.classList.contains('open');
    if (isOpening) {
      sidebar.classList.add('open');
      backdrop.classList.add('active');
      document.body.classList.add('sidebar-open');
      document.documentElement.classList.add('sidebar-open');
    } else {
      if (sidebar) sidebar.classList.remove('open');
      backdrop.classList.remove('active');
      document.body.classList.remove('sidebar-open');
      document.documentElement.classList.remove('sidebar-open');
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

    const isAdmin = this.isPlatformAdmin(this.user);
    const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const dedicatedAdminOnlyRoutes = ['admin-dashboard', 'admin-proofs', 'admin-tenants', 'admin-outreach', 'coupons'];
    if (!isAdmin && dedicatedAdminOnlyRoutes.includes(route)) {
      route = isCenter ? 'center-dashboard' : 'dashboard';
    }

    this.currentRoute = route;
    try {
      localStorage.setItem('centrly_current_route', route);
      sessionStorage.setItem('centrly_current_route', route);
      if (window.history && window.history.replaceState) {
        const cleanUrl = route && !['dashboard', 'admin-dashboard'].includes(route)
          ? `/?route=${encodeURIComponent(route)}`
          : '/';
        window.history.replaceState(null, '', cleanUrl);
      }
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
      this.dataLoadedState[route] = true;
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
              request('/admin/overview').catch(err => { if (err?.status === 401) throw err; return {}; }),
              request('/admin/payment-proofs').catch(err => { if (err?.status === 401) throw err; return { payment_proofs: [] }; }),
              request('/admin/tenants').catch(err => { if (err?.status === 401) throw err; return { tenants: [] }; }),
            ]);
            this.adminOverviewData = this.buildAdminOverviewData(ovRes, proofsRes, tenantsRes);
            this.adminProofsData = proofsRes;
            this.adminTenantsData = tenantsRes;
            this.saveCache('adminOverviewData', this.adminOverviewData);
            await this.loadCoupons().catch(() => {});
          } catch (err) {
            console.warn('admin-dashboard load error', err);
            if (err?.status === 401) {
              this.showToast('انتهت صلاحية الجلسة. يرجى تسجيل الدخول مجدداً.', 'warning');
              authService.clearSession();
              this.renderAuth('login');
              return;
            }
            this.adminOverviewData = this.adminOverviewData || {};
          }
          this.routeLoadingState['admin-dashboard'] = false;
          this.dataLoadedState['admin-dashboard'] = true;
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
          this.routeLoadingState['admin-proofs'] = false;
          this.dataLoadedState['admin-proofs'] = true;
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
          this.routeLoadingState['admin-tenants'] = false;
          this.dataLoadedState['admin-tenants'] = true;
          this.renderMainContent();
          break;
        }
        case 'admin-outreach': {
          try {
            const res = await request('/admin/outreach');
            if (res && res.leads) {
              this.adminOutreachData = res;
            } else {
              this.adminOutreachData = { leads: [], metrics: { total: 606, ready: 606, sent: 0, replied: 0, interested: 0, converted: 0, not_interested: 0 } };
            }
          } catch (err) {
            console.warn('admin-outreach load error', err);
            this.adminOutreachData = { leads: [], metrics: { total: 606, ready: 606, sent: 0, replied: 0, interested: 0, converted: 0, not_interested: 0 } };
          }
          this.routeLoadingState['admin-outreach'] = false;
          this.dataLoadedState['admin-outreach'] = true;
          this.renderMainContent();
          break;
        }
        case 'coupons': {
          if (this.user?.role !== 'admin' && !this.user?.is_superadmin) {
            this.navigate('dashboard');
            break;
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
          const recurringGroupSessions = [];
          (this.groups || []).forEach(g => {
            const rawDay = g.day_of_week || (arabicDayNames.find(d => g.schedule && g.schedule.includes(d))) || 'السبت';
            const matchedDays = arabicDayNames.filter(d => rawDay.includes(d));
            const daysToUse = matchedDays.length > 0 ? matchedDays : [rawDay];

            let time1 = g.session_time || '04:00 م - 06:00 م';
            let time2 = time1;
            if (g.session_time && g.session_time.includes('/')) {
              const parts = g.session_time.split('/').map(s => s.trim());
              time1 = parts[0] || time1;
              time2 = parts[1] || time1;
            } else if (g.schedule && g.schedule.includes('•') && !g.session_time) {
              time1 = g.schedule.split('•')[1].trim();
              time2 = time1;
            }

            daysToUse.forEach((dName, idx) => {
              recurringGroupSessions.push({
                id: `rec-${g.id}-${idx}`,
                group_id: g.id,
                group_name: g.name,
                center_name: g.center_name || g.centerName || 'سنتر تعليمي',
                day_name: dName,
                time: idx === 1 ? time2 : time1,
                date: 'موعد أسبوعي ثابت',
                is_recurring: true,
                status: 'recurring',
                price: g.price || 0,
              });
            });
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
            (!this.groups || this.groups.length === 0) ? request('/groups').catch(() => []) : Promise.resolve(this.groups),
            (!this.students || this.students.length === 0) ? request('/students').catch(() => []) : Promise.resolve(this.students),
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
              request('/billing/status').catch(() => null),
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
          const [studRes, grpRes, riskRes, repRes, astRes, actEarnRes] = await Promise.all([
            request('/students').catch(() => ({ students: [] })),
            request('/groups').catch(() => ({ groups: [] })),
            request('/at-risk').catch(() => ({ watchlist: [] })),
            request(`/reports/monthly?month=${currentMonth}&year=${currentYear}`).catch(() => null),
            request('/assistants').catch(() => ({ assistants: [] })),
            request(`/sessions/actual-earnings?month=${currentMonth}&year=${currentYear}`).catch(() => null),
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

            if (g.billing_model === 'no_center' || (g.billing_model === 'percentage' && Number(g.center_cut_percentage) === 0)) {
              netProfit = monthlyGross;
            } else if (g.billing_model === 'fixed_per_student') {
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

          await this.loadCoupons().catch(() => {});

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
            actualEarnings: actEarnRes || null,
            groups: mappedGroups,
            assistants: assistants,
            atRiskStudents: atRisk,
            topPerformers: leaderboard,
            giftCodes: this.giftCodes || [],
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
            const [billingRes, quotaRes, statusRes, tplRes, meRes] = await Promise.all([
              request('/billing/status').catch(() => null),
              request('/whatsapp/quota').catch(() => ({})),
              request(`/whatsapp/status${teacherParam}`).catch(() => ({ status: 'disconnected' })),
              request('/templates').catch(() => ({ templates: [] })),
              request('/auth/me').catch(() => null),
            ]);
            if (meRes?.user) {
              this.user = { ...this.user, ...meRes.user };
              authService.setUser(this.user);
            }
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
        case 'whatsapp-inbox': {
          const isAdmin = this.isPlatformAdmin(this.user);
          if (!isAdmin) {
            this.navigate('dashboard');
            return;
          }
          await this.loadWhatsAppInboxData(false);
          this.renderMainContent();
          setTimeout(() => {
            this.recalculateWhatsAppEconomics();
          }, 60);
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
            (!this.students || this.students.length === 0) ? request('/students').catch(() => []) : Promise.resolve(this.students),
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
          try {
            localStorage.setItem('centrly_materials', JSON.stringify(this.materials));
            localStorage.setItem('centrly_platform_content', JSON.stringify(this.materials));
          } catch (_) {}
          this.saveCache('groups', this.groups);
          this.renderMainContent();
          break;
        }
        case 'video-lessons': {
          const [matRes, grpRes, stdRes] = await Promise.all([
            request('/materials').catch(() => ({ materials: [] })),
            request('/groups').catch(() => ({ groups: [] })),
            request('/students').catch(() => ({ students: [] })),
          ]);
          this.materials = Array.isArray(matRes) ? matRes : (matRes.materials || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          this.students = Array.isArray(stdRes) ? stdRes : (stdRes.students || []);
          this.videoLessonsGroupId = this.videoLessonsGroupId || 'all';
          this.saveCache('materials', this.materials);
          try {
            localStorage.setItem('centrly_materials', JSON.stringify(this.materials));
            localStorage.setItem('centrly_platform_content', JSON.stringify(this.materials));
          } catch (_) {}
          this.saveCache('groups', this.groups);
          this.saveCache('students', this.students);
          this.renderMainContent();
          break;
        }
        case 'platform-builder': {
          let res = await request('/platform/settings').catch(() => null);
          const tenantKey = this.user?.tenant_id || 'active';
          let localSettings = null;
          try {
            const cachedStr = localStorage.getItem(`centrly_platform_settings_${tenantKey}`);
            if (cachedStr) localSettings = JSON.parse(cachedStr);
          } catch (_) {}

          const finalSettings = res?.settings || localSettings || null;
          this.platformBuilderState = {
            settings: finalSettings,
            plan: res?.plan || { is_pro: true },
          };
          this.saveCache('platformBuilderState', this.platformBuilderState);
          this.renderMainContent();
          break;
        }
        case 'homework': {
          const [matRes, grpRes] = await Promise.all([
            request('/materials').catch(() => ({ materials: [] })),
            request('/groups').catch(() => ({ groups: [] })),
          ]);
          const materialsList = Array.isArray(matRes) ? matRes : (matRes.materials || []);
          const hwAssignments = materialsList.filter(m => m.is_homework && m.type !== 'online_quiz');
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
          try {
            localStorage.setItem('centrly_materials', JSON.stringify(materialsList));
            localStorage.setItem('centrly_platform_content', JSON.stringify(materialsList));
          } catch (_) {}
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
        const hasRefresh = Boolean(authService.getRefreshToken());
        this.routeErrors[route] = (isAuthErr && !hasRefresh)
          ? 'انتهت صلاحية الجلسة. يرجى إعادة تسجيل الدخول لمتابعة العمل بأمان.'
          : (err.message || 'حدث خطأ أثناء تحميل البيانات من الخادم. يرجى التحقق من الاتصال والمحاولة مجدداً.');
      }
      this.renderMainContent();
    }
  }

  renderApp(force = false) {
    window.__centrlyLoaded = true;
    const appEl = this.getAppEl();
    const mainContentEl = document.getElementById('mainContent');
    const appContainer = document.querySelector('.app-container');

    if (!force && appEl && mainContentEl && appContainer) {
      document.querySelectorAll('.app-sidebar .nav-link').forEach(btn => {
        const onclickAttr = btn.getAttribute('onclick') || '';
        const match = onclickAttr.match(/navigate\('([^']+)'\)/);
        const btnRoute = match ? match[1] : '';
        const isActive = btnRoute === this.currentRoute;
        btn.classList.toggle('active', isActive);
        btn.style.background = isActive ? '#eff6ff' : 'transparent';
      });

      this.renderMainContent();
      this.updateNavbarBadge();
      return;
    }

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
    if (appEl) appEl.innerHTML = html;
    if (this.currentRoute === 'students') {
      this.initStudentsTableScrollSync();
    }
  }

  renderMainContent() {
    const el = document.getElementById('mainContent');
    if (el) el.innerHTML = this.getContentHtml(this.currentRoute);
    if (this.currentRoute === 'students') {
      this.initStudentsTableScrollSync();
    }
  }

  renderRouteLoading() {
    return `
      <div class="centrly-sleek-loader-wrap">
        <svg class="centrly-sleek-spinner" viewBox="0 0 50 50">
          <defs>
            <linearGradient id="centrlySleekGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stop-color="#1e3a8a" />
              <stop offset="50%" stop-color="#2563eb" />
              <stop offset="100%" stop-color="#60a5fa" />
            </linearGradient>
          </defs>
          <circle class="spinner-track" cx="25" cy="25" r="20" fill="none" stroke-width="3.5" />
          <circle class="spinner-head" cx="25" cy="25" r="20" fill="none" stroke="url(#centrlySleekGradient)" stroke-width="3.5" />
        </svg>
      </div>
    `;
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

    const isRouteFetching = Boolean(this.routeLoadingState[route]);
    const hasData = this.hasRouteData(route);

    if (isRouteFetching && !hasData) {
      return this.renderRouteLoading(route);
    }

    switch (route) {
      case 'admin-dashboard':
        return renderBusinessOwnerDashboard(this.adminOverviewData || {});
      case 'admin-proofs':
        return renderAdminPaymentProofsView(this.adminProofsData || {}, this.adminProofsFilter || 'pending');
      case 'admin-tenants':
        return renderAdminTenantsView(this.adminTenantsData || {}, this.adminTenantsFilter || 'all', this.adminTenantsSearchQuery || '');
      case 'admin-outreach':
        return renderAdminOutreachView(this.adminOutreachData || {}, this.adminOutreachFilter || 'all', this.adminOutreachSearchQuery || '');
      case 'coupons':
        if (!this.isPlatformAdmin(this.user)) {
          return renderTeacherDashboard(this.dashboardData || {}, this.user || {}, {
            hasPin: this.hasSecurityPin,
            isUnlocked: this.isFinancialUnlocked,
            hideNumbers: this.hideFinancialNumbers,
          });
        }
        return renderCouponsView(this.giftCodes || [], this.user || {});
      case 'dashboard':
        return renderTeacherDashboard(this.dashboardData || {}, this.user || {}, {
          hasPin: this.hasSecurityPin,
          isUnlocked: this.isFinancialUnlocked,
          hideNumbers: this.hideFinancialNumbers,
        });
      case 'materials':
        return renderMaterialsView(this.materials, this.groups, this.materialsGroupId);
      case 'video-lessons':
        return renderVideoLessonsView(this.materials, this.groups, this.students, this.videoLessonsGroupId, this.user);
      case 'platform-builder':
        return renderTeacherPlatformBuilderView(this.platformBuilderState || {}, this.user, this.students || []);
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
        return renderTeacherQuizzesView(
          this.quizzesState, 
          this.groups, 
          this.students, 
          isRouteFetching, 
          Boolean(this.dataLoadedState['quizzes']),
          this.user
        );
      case 'calendar':
        return renderTeacherCalendar(this.calendarState);
      case 'sessions':
        return renderSessionsView(this.sessionState, this.user, this.groups);
      case 'students':
        return renderStudentsView(
          this.students, 
          this.groups, 
          this.studentsLoading || isRouteFetching, 
          this.billingState, 
          Boolean(this.dataLoadedState['students'])
        );
      case 'student-cards':
        return renderStudentCardsView(this.students, this.groups, this.user);
      case 'reports':
        return renderStudentReportsView(this.reportsState, {
          hasPin: this.hasSecurityPin,
          isUnlocked: this.isFinancialUnlocked,
          hideNumbers: this.hideFinancialNumbers,
        });
      case 'groups':
        return renderGroupsView(
          this.groups, 
          this.user, 
          isRouteFetching, 
          Boolean(this.dataLoadedState['groups'])
        );
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
      case 'whatsapp-inbox': {
        const isAdmin = this.isPlatformAdmin(this.user);
        if (!isAdmin) {
          return this.renderRouteView('dashboard');
        }
        return renderWhatsAppCenterView(
          this.whatsappInboxData || {
            stats: { total_sent: 0, total_replied: 0, pending_reply: 0, reply_rate: 0 },
            conversations: [],
            total_students: (this.students?.length || 68),
          },
          this.whatsappActiveTab || 'inbox'
        );
      }
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

  // Modal Helper Functions
  showModal(title, bodyHtml, footerHtml) {
    const customMaxWidth = arguments[3] || null;
    this.closeModal();
    const modalEl = document.createElement('div');
    modalEl.id = 'centrlyCustomModal';
    modalEl.className = 'modal-overlay';
    modalEl.innerHTML = `
      <div class="modal-dialog" dir="rtl"${customMaxWidth ? ` style="max-width: ${customMaxWidth};"` : ''}>
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
}

window.centrlyApp = new CentrlyApp();
window.togglePasswordVisibility = (inputId, btnEl, event) => {
  if (window.centrlyApp) {
    return window.centrlyApp.togglePasswordVisibility(inputId, btnEl, event);
  }
};
window.switchPortalLoginRole = (role) => {
  if (window.centrlyApp) {
    return window.centrlyApp.switchPortalLoginRole(role);
  }
};
if (document.readyState === 'loading') {
  window.addEventListener('DOMContentLoaded', () => {
    window.centrlyApp.init();
  });
} else {
  window.centrlyApp.init();
}
