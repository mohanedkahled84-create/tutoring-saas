import { authService } from './services/auth.js';
import { request } from './services/api.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderNavbar } from './components/Navbar.js';
import { renderAuthScreens } from './components/AuthScreens.js';
import { renderOnboardingWizard } from './components/OnboardingWizard.js';
import { renderTeacherDashboard } from './components/TeacherDashboard.js';
import { renderTeacherCalendar } from './components/TeacherCalendar.js';
import { renderSessionsView } from './components/SessionsView.js';
import { renderStudentsView } from './components/StudentsView.js';
import { renderGroupsView } from './components/GroupsView.js';
import { renderMessageLogsView } from './components/MessageLogsView.js';
import { renderParentPortalView } from './components/ParentPortalView.js';
import { renderCenterOwnerDashboard } from './components/CenterOwnerDashboard.js';
import { renderStudentReportsView } from './components/StudentReportsView.js';
import { renderRiskWatchlistView } from './components/RiskWatchlistView.js';
import { renderBillingView } from './components/BillingView.js';
import { renderWhatsAppSettingsView } from './components/WhatsAppSettingsView.js';
import { escapeHtml } from './utils/escapeHtml.js';

class CentrlyApp {
  constructor() {
    this.currentRoute = 'sessions';
    this.user = authService.getUser();
    this.centerDashboardState = {
      activeTab: 'teachers',
      period: new Date().toISOString().slice(0, 7),
      rollup: null,
      rooms: [],
      conflictCheckResult: null,
      frontDeskScanResult: null,
      generatedInvite: null,
    };
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
      dateLabel: 'جدول الحصص الأسبوعي',
      sessions: [],
      groups: [],
    };
    this.reportsState = {
      period: { month: new Date().getMonth() + 1, year: new Date().getFullYear() },
      leaderboard: [],
      groups: [],
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
  }

  async init() {
    // Check if Parent Portal token is present in URL (DEV-34)
    const urlParams = new URLSearchParams(window.location.search);
    const portalToken = urlParams.get('token');
    if (portalToken) {
      await this.loadParentPortal(portalToken);
      return;
    }

    if (!authService.isAuthenticated()) {
      this.renderAuth();
    } else {
      this.renderApp();
      await this.loadRouteData(this.currentRoute);
    }
  }

  // DEV-34: No-App Parent Portal
  async loadParentPortal(token) {
    try {
      const data = await request(`/public/parent-portal?token=${token}`);
      document.getElementById('app').innerHTML = renderParentPortalView(data);
    } catch (err) {
      document.getElementById('app').innerHTML = renderParentPortalView({
        error: err.message || 'تعذر تحميل بيانات بوابة ولي الأمر. يرجى التحقق من صحة الرابط.',
      });
    }
  }

  renderAuth() {
    document.getElementById('app').innerHTML = renderAuthScreens();
  }

  switchAuthTab(tab) {
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

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await authService.login(email, password);
      this.user = res.user;
      this.renderApp();
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      this.showAuthAlert(err.message || 'فشل تسجيل الدخول. يرجى التحقق من صحة البيانات.');
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    const accountType = document.getElementById('signupAccountType')?.value || 'teacher';
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm')?.value;

    if (passwordConfirm && password !== passwordConfirm) {
      this.showAuthAlert('كلمتا المرور غير متطابقتين. يرجى التأكد وإعادة المحاولة.');
      return;
    }

    try {
      const res = await authService.signup({
        email,
        password,
        full_name: name,
        tenant_name: `${name} - ${accountType === 'center' ? 'سنتر تعليمي' : 'منظومة تعليمية'}`,
        phone,
        account_type: accountType,
      });
      this.user = res.user;
      this.startOnboarding();
    } catch (err) {
      this.showAuthAlert(err.message || 'فشل إنشاء الحساب. يرجى التأكد من البيانات والمحاولة مجدداً.');
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
      const gName = document.getElementById('obGroupName')?.value;
      const gPrice = document.getElementById('obSessionPrice')?.value;
      if (gName) this.onboardingState.groupName = gName;
      if (gPrice) this.onboardingState.sessionPrice = Number(gPrice);
    }

    // Save state from step 2
    if (this.onboardingStep === 2) {
      const names = Array.from(document.querySelectorAll('.ob-student-name')).map(el => el.value.trim()).filter(Boolean);
      const phones = Array.from(document.querySelectorAll('.ob-student-phone')).map(el => el.value.trim());
      this.onboardingState.students = names.map((name, i) => ({
        name,
        phone: phones[i] || '',
      }));
    }

    this.onboardingStep = step;
    document.getElementById('app').innerHTML = renderOnboardingWizard(this.onboardingStep, this.onboardingState);

    if (step === 4) {
      this.initOnboardingStep4();
    } else {
      this.stopWhatsAppStatusPolling();
    }
  }

  addQuickStudentRow() {
    const list = document.getElementById('quickStudentsList');
    if (!list) return;
    const count = list.children.length + 1;
    const div = document.createElement('div');
    div.className = 'student-row';
    div.style = 'display: flex; gap: 0.5rem; align-items: center;';
    div.innerHTML = `
      <span style="font-size: 0.8rem; font-weight: 700; color: var(--centrly-text); width: 24px;">${count}.</span>
      <input type="text" class="form-input ob-student-name" placeholder="اسم الطالب" style="flex: 1;">
      <input type="tel" class="form-input ob-student-phone" placeholder="رقم ولي الأمر (010...)" dir="ltr" style="flex: 1;">
    `;
    list.appendChild(div);
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
      });
      this.nextOnboardingStep(4);
    } catch (err) {
      const alertBox = document.getElementById('onboardingAlert');
      if (alertBox) {
        alertBox.style.display = 'block';
        alertBox.className = 'badge-danger';
        alertBox.textContent = `فشل حفظ الإعدادات: ${err.message || 'خطأ في الاتصال بالخادم'}`;
      } else {
        alert(`فشل حفظ الإعدادات: ${err.message || 'خطأ في الاتصال بالخادم'}`);
      }
    }
  }

  async sendTestWhatsAppMessage() {
    const phone = document.getElementById('obTestPhone')?.value;
    const resultBox = document.getElementById('obTestMsgResult');
    if (!phone) {
      alert('يرجى كتابة رقم الهاتف أولاً');
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
        resultBox.textContent = '✓ تم إرسال الرسالة بنجاح لهاتفك!';
      }
    } catch (err) {
      if (resultBox) {
        resultBox.style.color = 'var(--centrly-danger)';
        resultBox.textContent = `❌ فشل إرسال الرسالة الاختبارية: ${err.message || 'خطأ في الاتصال بخدمة واتساب'}`;
      } else {
        alert(`❌ فشل إرسال الرسالة الاختبارية: ${err.message || 'خطأ في الاتصال بخدمة واتساب'}`);
      }
    }
  }

  finishOnboarding() {
    this.stopWhatsAppStatusPolling();
    this.renderApp();
    this.loadRouteData(this.currentRoute);
  }

  async logout() {
    this.stopWhatsAppStatusPolling();
    await authService.logout();
  }

  toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  async navigate(route) {
    this.stopWhatsAppStatusPolling();
    this.currentRoute = route;
    this.renderMainContent();
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(btn => {
      btn.classList.remove('active');
    });
    await this.loadRouteData(route);
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
        case 'calendar': {
          const [calRes, grpRes] = await Promise.all([
            request('/sessions/calendar?from=2026-09-01&to=2026-09-30'),
            request('/groups'),
          ]);
          const rawSessions = Array.isArray(calRes) ? calRes : (calRes.sessions || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          
          const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
          this.calendarSessions = rawSessions.map(s => {
            const rawGrp = s.groups;
            const groupObj = Array.isArray(rawGrp) ? rawGrp[0] : (rawGrp || {});
            const d = s.session_date ? new Date(s.session_date + 'T00:00:00') : new Date();
            const dayName = arabicDays[d.getDay()];
            return {
              ...s,
              date: s.session_date || s.date,
              day_name: dayName,
              group_name: groupObj.name || s.group_name || 'حصة عامة',
              center_name: groupObj.center_name || s.center_name || 'سنتر تعليمي',
              time: s.time || (s.session_time ? `${s.session_time}` : '04:00 م - 06:00 م'),
            };
          });

          this.calendarState.sessions = this.calendarSessions;
          this.calendarState.groups = this.groups;
          this.renderMainContent();
          break;
        }
        case 'center-dashboard': {
          const period = this.centerDashboardState.period || new Date().toISOString().slice(0, 7);
          const [rollupRes, roomsRes] = await Promise.all([
            request(`/centers/financials/rollup?period=${period}`),
            request('/centers/rooms'),
          ]);
          if (rollupRes) this.centerDashboardState.rollup = rollupRes;
          if (roomsRes) this.centerDashboardState.rooms = Array.isArray(roomsRes) ? roomsRes : (roomsRes.rooms || []);
          this.renderMainContent();
          break;
        }
        case 'students': {
          const [studRes, grpRes] = await Promise.all([
            request('/students'),
            request('/groups'),
          ]);
          this.students = Array.isArray(studRes) ? studRes : (studRes.students || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          this.renderMainContent();
          break;
        }
        case 'reports': {
          const month = this.reportsState.period.month;
          const year = this.reportsState.period.year;
          const groupId = this.reportsState.selectedGroupId;
          let url = `/reports/monthly?month=${month}&year=${year}`;
          if (groupId) url += `&group_id=${groupId}`;
          if (this.reportsState.searchQuery) url += `&q=${encodeURIComponent(this.reportsState.searchQuery)}`;

          const [reportsRes, grpRes] = await Promise.all([
            request(url),
            request('/groups'),
          ]);

          if (reportsRes) {
            this.reportsState.leaderboard = reportsRes.leaderboard || [];
            this.reportsState.total_students = reportsRes.total_students || 0;
            this.reportsState.average_attendance_rate = reportsRes.average_attendance_rate || 0;
            this.reportsState.average_score = reportsRes.average_score || 0;
          }
          this.reportsState.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          this.renderMainContent();
          break;
        }
        case 'groups': {
          const grpRes = await request('/groups');
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          this.renderMainContent();
          break;
        }
        case 'dashboard': {
          const currentMonth = new Date().getMonth() + 1;
          const currentYear = new Date().getFullYear();
          const [studRes, grpRes, riskRes, repRes] = await Promise.all([
            request('/students'),
            request('/groups'),
            request('/at-risk'),
            request(`/reports/monthly?month=${currentMonth}&year=${currentYear}`),
          ]);
          const students = Array.isArray(studRes) ? studRes : (studRes.students || []);
          const groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          const atRisk = Array.isArray(riskRes) ? riskRes : (riskRes?.watchlist || riskRes?.students || []);

          let totalMonthlyRev = 0;
          let totalTeacherProfit = 0;
          groups.forEach(g => {
            const grpStudents = students.filter(s => s.group_id === g.id);
            const count = grpStudents.length || Number(g.student_count) || 0;
            const price = Number(g.price) || 0;
            const monthlyGross = count * price * (g.billing_model === 'per_session' ? 4 : 1);
            totalMonthlyRev += monthlyGross;
            if (g.billing_model === 'fixed_rent') {
              totalTeacherProfit += Math.max(0, monthlyGross - (Number(g.fixed_rent_amount) || 0));
            } else {
              totalTeacherProfit += Math.round(monthlyGross * 0.8);
            }
          });

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
              teacherProfit: totalTeacherProfit,
              pendingMessages: 0,
            },
            groups: groups.map(g => ({
              ...g,
              student_count: students.filter(s => s.group_id === g.id).length
            })),
            atRiskStudents: atRisk,
            topPerformers: leaderboard,
          };
          this.renderMainContent();
          break;
        }
        case 'risk-watchlist': {
          const riskRes = await request('/at-risk');
          const watchlist = riskRes?.watchlist || (Array.isArray(riskRes) ? riskRes : (riskRes?.students || []));
          this.watchlistData = watchlist;
          this.renderMainContent();
          break;
        }
        case 'billing': {
          const billingRes = await request('/billing/status');
          this.billingState = billingRes;
          this.renderMainContent();
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
          const logsRes = await request('/activity-logs');
          this.messageLogs = Array.isArray(logsRes) ? logsRes : (logsRes.logs || []);
          this.renderMainContent();
          break;
        }
        case 'sessions': {
          if (!this.sessionState.id) {
            const todaySessions = await request('/sessions?status=in_progress');
            const sessionsArr = Array.isArray(todaySessions) ? todaySessions : (todaySessions.sessions || []);
            if (sessionsArr.length > 0) {
              const s = sessionsArr[0];
              this.sessionState.id = s.id;
              this.sessionState.status = s.status;
              this.sessionState.group = s.group || { id: s.group_id, name: s.group_name || 'حصة اليوم', price: s.price || 0 };
            }
          }
          this.renderMainContent();
          break;
        }
      }
    } catch (err) {
      console.warn('loadRouteData error:', err);
      if (this.routeErrors) {
        this.routeErrors[route] = err.message || 'حدث خطأ أثناء تحميل البيانات من الخادم. يرجى التحقق من الاتصال والمحاولة مجدداً.';
      }
      this.renderMainContent();
    }
  }

  renderApp() {
    const html = `
      <div class="app-container">
        ${renderSidebar(this.currentRoute, this.user)}
        <div class="app-main">
          ${renderNavbar(this.user)}
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
      return `
        <div class="card" style="text-align: center; padding: 2.5rem; border-top: 4px solid var(--centrly-danger); margin: 1rem 0;" dir="rtl">
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⚠️</div>
          <h3 style="color: var(--centrly-danger); font-size: 1.2rem; font-weight: 800; margin: 0 0 0.5rem 0;">تعذر تحميل بيانات هذه الصفحة</h3>
          <p style="color: var(--centrly-text); font-size: 0.9rem; margin: 0 0 1.25rem 0; line-height: 1.6;">
            ${this.routeErrors[route]}
          </p>
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.retryRoute('${route}')" style="font-weight: 700;">
            🔄 إعادة المحاولة
          </button>
        </div>
      `;
    }

    switch (route) {
      case 'dashboard':
        return renderTeacherDashboard(this.dashboardData || {});
      case 'center-dashboard':
        return renderCenterOwnerDashboard(this.centerDashboardState);
      case 'calendar':
        return renderTeacherCalendar(this.calendarState);
      case 'sessions':
        return renderSessionsView(this.sessionState, this.user);
      case 'students':
        return renderStudentsView(this.students, this.groups);
      case 'reports':
        return renderStudentReportsView(this.reportsState);
      case 'groups':
        return renderGroupsView(this.groups, this.user);
      case 'risk-watchlist':
        return renderRiskWatchlistView(this.watchlistData || this.dashboardData?.atRiskStudents || []);
      case 'billing':
        return renderBillingView(this.billingState || {});
      case 'whatsapp':
        return renderWhatsAppSettingsView(this.whatsappState || {});
      case 'activity-logs':
        return renderMessageLogsView(this.messageLogs);
      default:
        return renderTeacherDashboard(this.dashboardData || {});
    }
  }

  // ==========================================================================
  // Active Session & Attendance Actions (DEV-16, DEV-13, DEV-36)
  // ==========================================================================

  handleStudentScan(e) {
    e.preventDefault();
    const codeInput = document.getElementById('scanStudentCode');
    const commentInput = document.getElementById('scanComment');
    const code = codeInput?.value.trim();
    const comment = commentInput?.value.trim() || null;

    // Get selected homework value
    const hwRadio = document.querySelector('input[name="scanHomework"]:checked');
    const homework = hwRadio ? hwRadio.value : 'done';

    if (!code) return;

    // Record attendance locally
    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    this.sessionState.attendanceList.unshift({
      id: `att-${Date.now()}`,
      student_id: `s-${code}`,
      code,
      name: `طالب (${code})`,
      attended: true,
      homework,
      comment,
      time: timeStr,
      sent: false,
    });

    this.sessionState.financials.attendeeCount += 1;
    this.sessionState.financials.totalRevenue += (this.sessionState.group?.price || 0);

    // Reset inputs
    codeInput.value = '';
    if (commentInput) commentInput.value = '';

    // CRITICAL REQUIREMENT: Reset homework status selector to 'done' after every scan!
    const hwDoneRadio = document.getElementById('hwDone');
    if (hwDoneRadio) {
      hwDoneRadio.checked = true;
    }

    const feedback = document.getElementById('scanFeedback');
    if (feedback) {
      feedback.style.display = 'block';
      feedback.className = 'badge-success';
      feedback.style.backgroundColor = 'var(--centrly-success-light)';
      feedback.style.color = 'var(--centrly-success)';
      feedback.textContent = `✓ تم رصد حضور الطالب (كود ${code}) بنجاح والواجب: ${homework === 'done' ? 'كامل' : (homework === 'partial' ? 'جزئي' : 'ناقص')}`;
      setTimeout(() => { feedback.style.display = 'none'; }, 3000);
    }

    this.renderMainContent();
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
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeModal()" style="padding: 0.2rem 0.5rem; font-size: 1rem; border: none; cursor: pointer;">✕</button>
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
  }

  closeModal() {
    const existing = document.getElementById('centrlyCustomModal');
    if (existing) existing.remove();
  }

  // Session Finalization & Note Choice (DEV-Feedback)
  endActiveSession() {
    this.openEndSessionConfirmModal();
  }

  openEndSessionConfirmModal() {
    if (!this.sessionState.id) {
      alert('لا توجد حصة نشطة لإنهائها.');
      return;
    }
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="font-size: 3rem; margin-bottom: 0.75rem;">⏹</div>
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
      <button class="btn btn-secondary" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openBatchNotesModal();" style="color: var(--centrly-blue-700); font-weight: 700; border-color: var(--centrly-blue-700);">
        📝 إضافة ومراجعة الملاحظات أولاً
      </button>
      <button class="btn btn-primary" onclick="window.centrlyApp.finalizeEndSession()" style="font-weight: 800; background: #dc2626; border-color: #dc2626; color: #fff;">
        ⏹ نعم، إنهاء الحصة وتثبيت الكشف
      </button>
    `;
    this.showModal('تأكيد إنهاء الحصة الدراسية', bodyHtml, footerHtml);
  }

  async finalizeEndSession() {
    this.closeModal();
    try {
      await request(`/sessions/${this.sessionState.id}/end`, { method: 'POST' });
      this.sessionState.status = 'ended';
      alert('🏁 تم إنهاء الحصة بنجاح وتثبيت الكشف! يمكنك الآن إرسال إشعارات الواتساب للغياب والملاحظات.');
      this.renderMainContent();
    } catch (err) {
      alert(`❌ فشل إنهاء الحصة: ${err.message || 'حدث خطأ في الخادم'}`);
    }
  }

  // Single Student Note Modal
  openStudentNoteModal(studentCodeOrId, studentName, currentNote = '') {
    const bodyHtml = `
      <form id="studentNoteForm" onsubmit="window.centrlyApp.handleSaveStudentNote(event, '${escapeHtml(studentCodeOrId)}')">
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب:</label>
          <div style="font-weight: 800; color: var(--centrly-ink); font-size: 1rem; margin-top: 0.25rem;">${escapeHtml(studentName)}</div>
        </div>
        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700;">الملاحظة الأكاديمية أو السلوكية (تُرسل لولي الأمر بالواتساب):</label>
          <textarea id="modalNoteText" class="form-input" rows="3" placeholder="اكتب الملاحظة هنا (مثال: متفوق جداً، يحتاج تدريب على المسائل، الواجب غير مكتمل...)" style="resize: vertical; font-family: inherit;">${escapeHtml(currentNote)}</textarea>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="studentNoteForm" class="btn btn-primary" style="font-weight: 700;">💾 حفظ الملاحظة</button>
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
              homework_status: item.homework || 'done',
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
      alert('لم يتم تسجيل أي حضور حتى الآن لإضافة ملاحظات.');
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
      <button type="submit" form="batchNotesForm" class="btn btn-primary" style="font-weight: 700;">💾 حفظ جميع الملاحظات</button>
    `;
    this.showModal('📝 إضافة ومراجعة ملاحظات الطلاب', bodyHtml, footerHtml);
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
            homework_status: item.homework || 'done',
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

  // Functional Add Student Modal
  openAddStudentModal() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${g.name} (${g.center_name || 'سنتر'})</option>`).join('');
    const bodyHtml = `
      <form id="addStudentModalForm" onsubmit="window.centrlyApp.handleCreateStudent(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب رباعي *</label>
          <input type="text" id="newStudentName" class="form-input" placeholder="مثال: يوسف محمود علي رضوان" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر (واتساب) *</label>
          <input type="tel" id="newStudentPhone" class="form-input" placeholder="01012345678" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم مصري مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف الطالب الشخصي (اختياري)</label>
          <input type="tel" id="newStudentOwnPhone" class="form-input" placeholder="01123456789 (اختياري)" dir="ltr">
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
      <button type="submit" form="addStudentModalForm" id="btnSaveStudent" class="btn btn-primary" style="font-weight: 700;">➕ إضافة الطالب</button>
    `;
    this.showModal('➕ إضافة طالب جديد', bodyHtml, footerHtml);
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
        feedback.textContent = `❌ رقم ولي الأمر غير صحيح (${cleanParentPhone.length} أرقام). يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015 (مثال: 01123671777).`;
      }
      return;
    }

    const cleanStudentPhone = student_phone ? student_phone.replace(/[\s\-().]/g, '') : null;
    if (cleanStudentPhone && !egyptianPhoneRegex.test(cleanStudentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ رقم الطالب غير صحيح (${cleanStudentPhone.length} أرقام). يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
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
          student_phone: cleanStudentPhone || undefined,
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
      alert(`✓ تمت إضافة الطالب (${name}) بنجاح! والكود التلقائي: ${res.student?.code || res.student?.student_code || 'تم التعيين'}`);
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ ${err.message || 'فشل إضافة الطالب. تأكد من صحة رقم الهاتف والبيانات.'}`;
      } else {
        alert(`❌ فشل إضافة الطالب: ${err.message || 'تأكد من صحة البيانات'}`);
      }
      saveBtn.disabled = false;
      saveBtn.textContent = '➕ إضافة الطالب';
    }
  }

  // Functional Create Group Modal
  openCreateGroupModal() {
    const bodyHtml = `
      <form id="createGroupModalForm" onsubmit="window.centrlyApp.handleCreateGroup(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم المجموعة *</label>
          <input type="text" id="newGroupName" class="form-input" placeholder="مثال: فيزياء 3 ثانوي - مجموعة السبت" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">مكان الحصة / السنتر</label>
          <input type="text" id="newGroupCenter" class="form-input" placeholder="مثال: سنتر الأهرام التعليمي">
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م) *</label>
          <input type="number" id="newGroupPrice" class="form-input" min="0" step="5" placeholder="مثال: 80" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">نظام محاسبة السنتر</label>
          <select id="newGroupBillingModel" class="form-input">
            <option value="percentage">نسبة مئوية (20% للسنتر / 80% للمدرس)</option>
            <option value="fixed_rent">إيجار قاعة ثابت لكل حصة</option>
          </select>
        </div>
        <div id="createGroupFeedback" style="display: none; padding: 0.5rem; border-radius: 6px; font-size: 0.85rem; margin-top: 0.5rem;"></div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="createGroupModalForm" id="btnSaveGroup" class="btn btn-primary" style="font-weight: 700;">➕ إنشاء المجموعة</button>
    `;
    this.showModal('➕ إنشاء مجموعة جديدة', bodyHtml, footerHtml);
  }

  async handleCreateGroup(e) {
    e.preventDefault();
    const name = document.getElementById('newGroupName').value.trim();
    const center_name = document.getElementById('newGroupCenter').value.trim() || undefined;
    const price = Number(document.getElementById('newGroupPrice').value) || 0;
    const billing_model = document.getElementById('newGroupBillingModel').value;
    const feedback = document.getElementById('createGroupFeedback');
    const saveBtn = document.getElementById('btnSaveGroup');

    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الإنشاء...';

    try {
      await request('/groups', {
        method: 'POST',
        body: {
          name,
          center_name,
          price,
          session_price: price,
          billing_model,
        },
      });

      this.closeModal();
      alert(`✓ تم إنشاء المجموعة (${name}) بنجاح!`);
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ ${err.message || 'فشل إنشاء المجموعة.'}`;
      } else {
        alert(`❌ فشل إنشاء المجموعة: ${err.message || 'خطأ في البيانات'}`);
      }
      saveBtn.disabled = false;
      saveBtn.textContent = '➕ إنشاء المجموعة';
    }
  }

  // Functional Extra Session Modal
  openScheduleSessionModal() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${g.name}</option>`).join('');
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
          <input type="date" id="extraSessionDate" class="form-input" value="2026-09-10" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">الوقت *</label>
          <input type="text" id="extraSessionTime" class="form-input" value="04:00 م - 06:00 م" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">موضوع الحصة / الملاحظات *</label>
          <input type="text" id="extraSessionTopic" class="form-input" placeholder="مثال: مراجعة نهائية على الفصل الأول وتدريبات شاملة" required>
        </div>
      </form>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
      <button type="submit" form="scheduleSessionForm" class="btn btn-primary" style="font-weight: 700;">➕ جدولة الحصة الإضافية</button>
    `;
    this.showModal('➕ إضافة حصة إضافية في الجدول', bodyHtml, footerHtml);
  }

  async handleCreateExtraSession(e) {
    e.preventDefault();
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
      alert('✓ تم جدولة الحصة الإضافية بنجاح وإرسال إشعارات لأولياء الأمور!');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      alert(`❌ فشل جدولة الحصة: ${err.message || 'حدث خطأ'}`);
    }
  }

  async dispatchSessionWhatsAppMessages() {
    if (!this.sessionState.id) {
      alert('لا توجد حصة محددة لإرسال الرسائل.');
      return;
    }
    const countEligible = this.sessionState.attendanceList.filter(a => !a.attended || a.comment).length;
    if (countEligible === 0) {
      alert('لا توجد رسائل للغياب أو ملاحظات لإرسالها لهذه الحصة.');
      return;
    }

    if (!confirm(`سيتم إرسال ${countEligible} رسائل عبر واتساب بنظام التوزيع الآمن (Pacing). المتابعة؟`)) return;

    try {
      await request(`/sessions/${this.sessionState.id}/send-messages`, { method: 'POST' });
      this.sessionState.attendanceList.forEach(a => {
        if (!a.attended || a.comment) {
          a.sent = true;
        }
      });
      alert(`💬 تم إطلاق إرسال ${countEligible} رسائل لأولياء الأمور بنجاح!`);
      this.renderMainContent();
    } catch (err) {
      alert(`❌ فشل إرسال رسائل الواتساب: ${err.message || 'حدث خطأ أثناء الإرسال'}`);
    }
  }

  async resendSingleMessage(studentId, studentName) {
    if (!confirm(`إعادة إرسال الرسالة إلى ولي أمر الطالب: ${studentName}؟`)) return;

    try {
      await request(`/sessions/${this.sessionState.id || 'active'}/resend/${studentId}`, { method: 'POST' });
      alert(`✓ تمت إعادة إرسال الرسالة بنجاح إلى ولي أمر: ${studentName}`);
    } catch (err) {
      alert(`❌ فشل إعادة إرسال الرسالة لـ (${studentName}): ${err.message || 'حدث خطأ في الإرسال'}`);
    }
  }

  async copyParentLink(studentId) {
    try {
      const res = await request(`/students/${studentId}/parent-link`);
      const fullUrl = `${window.location.origin}${res.portal_url}`;
      await navigator.clipboard.writeText(fullUrl);
      alert(`✓ تم نسخ رابط ولي الأمر الخاص بالطالب بنجاح!\n${fullUrl}`);
    } catch (err) {
      alert(`❌ تعذر الحصول على رابط ولي الأمر: ${err.message || 'تأكد من اتصال الخادم'}`);
    }
  }

  async downloadBarcodeSheet(groupId) {
    const targetGroupId = groupId || (this.groups && this.groups[0]?.id);
    if (!targetGroupId) {
      alert('يرجى إنشاء مجموعة دراسية أولاً لطباعة كروت الباركود لطلابها.');
      return;
    }
    try {
      const baseUrl = window.__CENTRLY_API_URL__ || (
        (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
          ? 'http://localhost:3000/api'
          : 'https://tutoring-backend-production-c8dd.up.railway.app/api'
      );
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
      alert(`❌ ${err.message || 'فشل تحميل ملف الباركود'}`);
    }
  }

  openReceiptModal() {
    const rev = this.sessionState.financials.totalRevenue;
    const att = this.sessionState.financials.attendeeCount;
    const abs = this.sessionState.financials.absentCount;
    alert(`🧾 إيصال الحصة:\nإجمالي النقدية: ${rev} ج.م\nالطلاب الحاضرين: ${att}\nالغياب: ${abs}\nتم التصفية.`);
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
  openImportModal() { alert('استيراد من Excel / CSV متاح عبر لوحة المالك.'); }
  startSessionForGroup(gId) {
    this.sessionState.id = `sess-${gId}`;
    this.sessionState.status = 'in_progress';
    const grp = this.groups.find(g => g.id === gId);
    if (grp) {
      this.sessionState.group = grp;
    }
    this.navigate('sessions');
  }
  viewGroupDetails() {}
  editStudent() {}

  // DEV-56: Teacher Calendar Controls
  switchCalendarView(view) {
    this.calendarState.view = view;
    this.renderMainContent();
  }

  calendarPrev() {
    this.renderMainContent();
  }

  calendarNext() {
    this.renderMainContent();
  }

  calendarToday() {
    this.renderMainContent();
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

  async toggleTeacherPayout(teacherId, period, currentStatus) {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
    try {
      await request('/centers/financials/payouts', {
        method: 'POST',
        body: JSON.stringify({
          teacher_id: teacherId,
          period,
          status: nextStatus,
          notes: nextStatus === 'paid' ? 'تم الصرف يدوياً من لوحة الإدارة' : null,
        }),
      });

      if (this.centerDashboardState.rollup) {
        const rep = this.centerDashboardState.rollup.reports.find(r => r.teacher.id === teacherId);
        if (rep) {
          rep.payout.status = nextStatus;
          if (nextStatus === 'paid') {
            rep.payout.paid_at = new Date().toISOString();
            rep.payout.notes = 'تم الصرف يدوياً من لوحة الإدارة';
          } else {
            rep.payout.paid_at = null;
            rep.payout.notes = null;
          }
        }
      }
      this.renderMainContent();
    } catch (err) {
      alert(`❌ فشل تحديث حالة الصرف: ${err.message || 'حدث خطأ'}`);
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
      alert('✓ تمت إضافة القاعة بنجاح!');
    } catch (err) {
      alert(`❌ فشل إضافة القاعة: ${err.message || 'حدث خطأ'}`);
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
      alert('يرجى اختيار القاعة أولاً');
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
      alert(`❌ فشل فحص التعارض: ${err.message || 'حدث خطأ في الاتصال بالخدمة'}`);
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
        alert('تمت إضافة المدرس وتفعيل حسابه بنجاح!');
      }
    } catch (err) {
      alert(`❌ فشل إضافة المدرس: ${err.message || 'حدث خطأ أثناء حفظ بيانات المدرس'}`);
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
      alert('✓ تمت إضافة المساعد بنجاح!');
    } catch (err) {
      alert(`❌ فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`);
    }
    this.renderMainContent();
  }

  copyInviteUrl(url) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      alert('✓ تم نسخ رابط الدعوة بنجاح!');
    } else {
      prompt('انسخ الرابط التالي:', url);
    }
  }

  // ==========================================================================
  // Student Reports & Leaderboard Actions (DEV-80)
  // ==========================================================================

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

  async handleBulkSendReports() {
    if (this.reportsState.isSubmittingBulk) return;
    if (!confirm('هل تريد إرسال تقارير الأداء الشهرية لجميع أولياء الأمور عبر طابور رسائل الواتساب؟')) return;

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
      alert(`✓ ${res.message || 'تم جدولة إرسال التقارير بنجاح'}\nإجمالي الطلاب: ${res.total_students}\nتمت الجدولة: ${res.queued_count}`);
    } catch (err) {
      alert(`❌ فشل جدولة إرسال التقارير الجماعية: ${err.message || 'خطأ في الخادم'}`);
    } finally {
      this.reportsState.isSubmittingBulk = false;
      this.renderMainContent();
    }
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
      alert(`✓ تم إرسال التقرير الأكاديمي بنجاح لولي أمر الطالب ${studentName}`);
    } catch (err) {
      alert(`❌ فشل إرسال تقرير الطالب ${studentName}: ${err.message || 'خطأ في الخادم'}`);
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
          badge.textContent = '🟢 بوابة الإرسال متصلة وجاهزة';
        }
        if (loading) {
          loading.style.display = 'block';
          loading.textContent = '✅ الحساب متصل بالفعل وجاهز للاستخدام!';
        }
        return;
      }

      if (qrRes && qrRes.qr_base64 && img) {
        img.src = qrRes.qr_base64;
        img.style.display = 'block';
        if (loading) loading.style.display = 'none';
      }
      if (qrRes && qrRes.pairing_code && code) {
        code.textContent = qrRes.pairing_code;
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
              badge.textContent = '🟢 تم الاتصال بنجاح وجاهز للإرسال!';
            }
            if (img) img.style.display = 'none';
            if (loading) {
              loading.style.display = 'block';
              loading.textContent = '🎉 تم ربط واتساب بنجاح! جاري التوجيه للوحة التحكم...';
            }
            setTimeout(() => {
              this.finishOnboarding();
            }, 1500);
          } else if (context === 'settings') {
            const badge = document.getElementById('settingsWaBadge');
            if (badge) {
              badge.className = 'badge badge-success';
              badge.textContent = `🟢 الخادم متصل وجاهز ${status.phone_number ? `(${status.phone_number})` : ''}`;
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
      if (code && qrRes.pairing_code) {
        code.textContent = qrRes.pairing_code;
      }
      this.startWhatsAppStatusPolling('settings');
    } catch (err) {
      alert('فشل تحديث رمز QR: ' + (err.message || 'خطأ في الاتصال'));
    }
  }

  async disconnectWhatsApp() {
    if (!confirm('هل أنت متأكد من رغبتك في إلغاء ربط حساب واتساب؟')) return;
    try {
      const teacherParam = this.user?.teacher_id ? `?teacher_id=${encodeURIComponent(this.user.teacher_id)}` : '';
      await request(`/whatsapp/disconnect${teacherParam}`, { method: 'POST' });
      alert('تم فصل الحساب بنجاح. يرجى مسح رمز QR لإعادة الربط.');
      await this.loadRouteData('whatsapp');
    } catch (err) {
      alert('فشل فصل الحساب: ' + (err.message || 'خطأ غير متوقع'));
    }
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
      alert('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = '⏳ جارٍ الإرسال...';
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
        feedback.innerHTML = `✅ تم إرسال الرسالة الاختبارية بنجاح إلى الرقم <strong>${escapeHtml(phone)}</strong>!`;
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#b91c1c';
        feedback.style.border = '1px solid #fecaca';
        feedback.innerHTML = `❌ فشل إرسال الرسالة: ${escapeHtml(err.message || 'خطأ في الاتصال')}`;
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerText = '🚀 إرسال الآن';
      }
    }
  }

  // ==========================================================================
  // Risk Watchlist Actions (DEV-62)
  // ==========================================================================

  async dispatchSingleRiskAlert(studentId, studentName) {
    if (!confirm(`هل تريد إرسال تنبيه واتساب فوري لولي أمر الطالب (${studentName})؟`)) return;

    try {
      await request(`/at-risk/alerts/${studentId}`, {
        method: 'POST',
        body: JSON.stringify({
          alert_type: 'absence_warning',
          custom_message: `تحية طيبة، نود إحاطة سيادتكم علماً بتسجيل غياب أو ملاحظات متابعة للطالب ${studentName}، يرجى التواصل معنا للاطمئنان عليه.`
        }),
      });
      alert(`✅ تم إرسال إنذار المتابعة بنجاح لولي أمر الطالب: ${studentName}`);
    } catch (err) {
      alert(`❌ تعذر إرسال التنبيه: ${err.message || 'خطأ في الخادم'}`);
    }
  }

  // ==========================================================================
  // Billing & Subscription Actions (DEV-SL.3 & DEV-39)
  // ==========================================================================

  openPaymentProofModal(planName = 'باقة المعلم المحترف', amount = 199) {
    const existing = document.getElementById('paymentProofModal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="paymentProofModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 9999; padding: 1rem;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: 0; animation: modalFadeIn 0.2s ease-out; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2);">
          <div class="card-header" style="border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div>
              <h3 class="card-title" style="margin: 0; font-size: 1.15rem;">تأكيد ترقية / تجديد الاشتراك</h3>
              <p style="font-size: 0.8rem; color: var(--centrly-text); margin: 0.25rem 0 0 0;">${planName} — ${amount} ج.م شهرياً</p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closePaymentProofModal()" style="border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
          </div>

          <form onsubmit="window.centrlyApp.handleSubmitPaymentProof(event, ${amount})">
            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">طريقة التحويل التي استخدمتها</label>
              <select id="proofPaymentMethod" class="form-input" style="width: 100%;" required>
                <option value="instapay">إنستاباي (InstaPay) - centrly@instapay</option>
                <option value="vodafone_cash">فودافون كاش / محفظة إلكترونية - 01099887766</option>
                <option value="bank_transfer">تحويل بنكي</option>
                <option value="cash">نقداً لإدارة المنظومة</option>
              </select>
            </div>

            <div class="form-group" style="margin-bottom: 0.85rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">رقم العملية / رقم التحويل (Reference Number)</label>
              <input type="text" id="proofRefNumber" class="form-input" placeholder="مثال: 987654321 أو رقم محفظة المحوّل" dir="ltr" required>
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">ملاحظات إضافية (اختياري)</label>
              <textarea id="proofNotes" class="form-input" rows="2" placeholder="أي تفاصيل أو اسم صاحب المحفظة المحوّل منها..."></textarea>
            </div>

            <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closePaymentProofModal()">إلغاء</button>
              <button type="submit" id="btnSubmitProof" class="btn btn-primary" style="font-weight: 700;">
                ✓ تأكيد إرسال الإيصال
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  closePaymentProofModal() {
    const modal = document.getElementById('paymentProofModal');
    if (modal) modal.remove();
  }

  async handleSubmitPaymentProof(e, amount) {
    e.preventDefault();
    const method = document.getElementById('proofPaymentMethod')?.value || 'instapay';
    const refNum = document.getElementById('proofRefNumber')?.value?.trim();
    const notes = document.getElementById('proofNotes')?.value?.trim() || null;
    const btn = document.getElementById('btnSubmitProof');

    if (!refNum) {
      alert('يرجى إدخال رقم العملية أو رقم المحفظة');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = '⏳ جارٍ التأكيد...';
    }

    try {
      await request('/billing/payment-proof', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          payment_method: method,
          reference_number: refNum,
          notes: notes,
        }),
      });

      this.closePaymentProofModal();
      alert('🎉 تم استلام بيانات التحويل بنجاح! حسابك سارٍ وسيتم مراجعة الإيصال وتأكيد الاشتراك فوراً.');
      await this.loadRouteData('billing');
    } catch (err) {
      alert(`❌ فشل تسجيل إيصال الدفع: ${err.message || 'خطأ في الخادم'}`);
      if (btn) {
        btn.disabled = false;
        btn.innerText = '✓ تأكيد إرسال الإيصال';
      }
    }
  }
}

window.centrlyApp = new CentrlyApp();
window.addEventListener('DOMContentLoaded', () => {
  window.centrlyApp.init();
});
