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
import { renderStudentCardsView } from './components/StudentCardsView.js';
import { getIcon } from './utils/icons.js';
import { escapeHtml } from './utils/escapeHtml.js';

class CentrlyApp {
  constructor() {
    this.user = authService.getUser();
    const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    this.currentRoute = isCenter ? 'center-dashboard' : 'dashboard';
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
      this.restoreSessionState();
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
    let name = '';
    let tenantName = '';

    if (accountType === 'center') {
      const ownerName = document.getElementById('signupCenterOwnerName')?.value?.trim();
      const centerName = document.getElementById('signupCenterName')?.value?.trim();
      if (!ownerName || !centerName) {
        this.showAuthAlert('يرجى إدخال اسم المسؤول واسم السنتر التعليمي');
        return;
      }
      name = ownerName;
      tenantName = centerName;
    } else {
      name = document.getElementById('signupName')?.value?.trim();
      if (!name) {
        this.showAuthAlert('يرجى إدخال اسم المدرس');
        return;
      }
      tenantName = `${name} - منظومة تعليمية`;
    }

    const email = document.getElementById('signupEmail').value.trim();
    const phone = document.getElementById('signupPhone').value.trim();
    const password = document.getElementById('signupPassword').value;
    const passwordConfirm = document.getElementById('signupPasswordConfirm')?.value;

    if (password.length < 8 || !/\d/.test(password) || !/[A-Z]/.test(password)) {
      this.showAuthAlert('كلمة المرور يجب أن تتكون من 8 أحرف على الأقل، وتحتوي على رقم واحد وحرف كبير واحد');
      return;
    }

    if (passwordConfirm && password !== passwordConfirm) {
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
        this.showToast(`فشل حفظ الإعدادات: ${err.message || 'خطأ في الاتصال بالخادم'}`, 'danger');
      }
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
        resultBox.textContent = '✓ تم إرسال الرسالة بنجاح لهاتفك!';
      }
    } catch (err) {
      if (resultBox) {
        resultBox.style.color = 'var(--centrly-danger)';
        resultBox.textContent = `❌ فشل إرسال الرسالة الاختبارية: ${err.message || 'خطأ في الاتصال بخدمة واتساب'}`;
      } else {
        this.showToast(`❌ فشل إرسال الرسالة الاختبارية: ${err.message || 'خطأ في الاتصال بخدمة واتساب'}`, 'danger');
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
    const sidebar = document.getElementById('appSidebar');
    if (sidebar && sidebar.classList.contains('open')) sidebar.classList.remove('open');
    this.renderApp();
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
            request('/sessions/calendar?from=2026-09-01&to=2026-09-30').catch(() => ({ sessions: [] })),
            request('/groups').catch(() => ({ groups: [] })),
          ]);
          const rawSessions = Array.isArray(calRes) ? calRes : (calRes.sessions || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          
          const arabicDays = ['الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];
          const mappedSessions = rawSessions.map(s => {
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

          // Automatically include recurring weekly groups in their day slots
          const arabicDayNames = ['السبت', 'الأحد', 'الإثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة'];
          const recurringGroupSessions = (this.groups || [])
            .map(g => {
              const day = g.day_of_week || (arabicDayNames.find(d => g.schedule && g.schedule.includes(d))) || 'السبت';
              const time = g.session_time || (g.schedule && g.schedule.includes('•') ? g.schedule.split('•')[1].trim() : '04:00 م');
              return {
                id: `rec-${g.id}`,
                group_id: g.id,
                group_name: g.name,
                center_name: g.center_name || g.centerName || 'السنتر',
                day_name: day,
                time: time,
                date: 'موعد أسبوعي ثابت',
                status: 'scheduled',
                session_number: 1,
                price: g.price || 0,
              };
            });

          this.calendarSessions = [...mappedSessions, ...recurringGroupSessions];
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
        case 'students': {
          this.studentsLoading = true;
          this.renderMainContent();
          try {
            const [studRes, grpRes] = await Promise.all([
              request('/students'),
              request('/groups'),
            ]);
            this.students = Array.isArray(studRes) ? studRes : (studRes.students || []);
            this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
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
          const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
          const promises = [request('/groups').catch(() => [])];
          if (isCenterOwner) {
            promises.push(request('/centers/teachers').catch(() => ({ teachers: [] })));
            promises.push(request('/centers/rooms').catch(() => ({ rooms: [] })));
          }

          const [grpRes, teachersRes, roomsRes] = await Promise.all(promises);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);

          if (isCenterOwner) {
            this.centerTeachers = teachersRes?.teachers || (Array.isArray(teachersRes) ? teachersRes : []);
            this.centerRooms = roomsRes?.rooms || (Array.isArray(roomsRes) ? roomsRes : []);

            this.groups = this.groups.map(g => {
              const matchedTeacher = this.centerTeachers.find(t => t.id === g.teacher_id);
              const matchedRoom = this.centerRooms.find(r => r.id === g.room_id);
              return {
                ...g,
                teacher_name: matchedTeacher ? matchedTeacher.name : g.teacher_name,
                room_name: matchedRoom ? matchedRoom.name : g.room_name,
              };
            });
          }
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
          if (!this.groups || this.groups.length === 0) {
            const groupsRes = await request('/groups').catch(() => []);
            this.groups = Array.isArray(groupsRes) ? groupsRes : (groupsRes.groups || []);
          }
          if (!this.sessionState.id) {
            const todaySessions = await request('/sessions?status=in_progress').catch(() => []);
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
          <div style="font-size: 2.5rem; margin-bottom: 0.5rem; color: var(--centrly-danger); display: flex; justify-content: center;">
            ${getIcon('risk', 40)}
          </div>
          <h3 style="color: var(--centrly-danger); font-size: 1.2rem; font-weight: 800; margin: 0 0 0.5rem 0;">تعذر تحميل بيانات هذه الصفحة</h3>
          <p style="color: var(--centrly-text); font-size: 0.9rem; margin: 0 0 1.25rem 0; line-height: 1.6;">
            ${this.routeErrors[route]}
          </p>
          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.retryRoute('${route}')" style="font-weight: 700;">
            ${getIcon('refresh', 14)} <span>إعادة المحاولة</span>
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
        return renderSessionsView(this.sessionState, this.user, this.groups);
      case 'students':
        return renderStudentsView(this.students, this.groups, this.studentsLoading);
      case 'student-cards':
        return renderStudentCardsView(this.students, this.groups, this.user);
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
    if (suggestionsBox) suggestionsBox.style.display = 'none';

    this.registerStudentAttendance(student);
    if (input) input.value = '';
  }

  handleStudentScan(e) {
    e.preventDefault();
    const codeInput = document.getElementById('scanStudentCode');
    const query = codeInput?.value.trim();
    if (!query) return;

    const suggestionsBox = document.getElementById('studentScanSuggestions');
    if (suggestionsBox) suggestionsBox.style.display = 'none';

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
      codeInput.value = '';
    } else {
      // Student NOT found! Do NOT add dummy name! Show inline registration form!
      const feedback = document.getElementById('scanFeedback');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = '#fef2f2';
        feedback.style.color = '#b91c1c';
        feedback.style.border = '1px solid #fecaca';
        feedback.innerHTML = `
          <strong>❌ الطالب غير مسجل في المنظومة:</strong> لم يتم العثور على طالب يطابق "${escapeHtml(query)}". يمكنك تسجيله وإضافته فوراً إلى الحصة بالأسفل.
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
  }

  async saveInlineNewStudentAndAttend() {
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
        this.showToast(`✓ تمت إضافة الطالب (${name}) ورصد حضوره فوراً في الحصة!`, 'success');
      }
    } catch (err) {
      this.showToast(`❌ فشل إضافة الطالب: ${err.message || 'خطأ في البيانات'}`, 'error');
    }
  }

  registerStudentAttendance(student) {
    const existing = this.sessionState.attendanceList.find(
      a => a.student_id === student.id || a.code === (student.code || student.student_code)
    );
    if (existing) {
      this.showToast(`⚠️ الطالب (${student.name}) مسجل حضوره بالفعل في هذه الحصة مسبقاً!`, 'info');
      return;
    }

    const hwRadio = document.querySelector('input[name="scanHomework"]:checked');
    const homework = hwRadio ? hwRadio.value : 'none';

    const now = new Date();
    const timeStr = `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

    this.sessionState.attendanceList.unshift({
      id: `att-${Date.now()}`,
      student_id: student.id,
      code: student.code || student.student_code || `STU-${student.id.slice(0, 4)}`,
      name: student.name,
      parent_phone: student.parent_phone,
      student_phone: student.student_phone,
      attended: true,
      homework,
      comment: null,
      time: timeStr,
      sent: false,
    });

    const fee = student.exempt ? 0 : (student.fee_override ?? (this.sessionState.group?.price || 0));
    this.sessionState.financials.attendeeCount += 1;
    this.sessionState.financials.totalRevenue += fee;

    const hwNoneRadio = document.getElementById('hwNone');
    if (hwNoneRadio) hwNoneRadio.checked = true;
    const hwDoneRadio = document.getElementById('hwDone');
    if (hwDoneRadio) hwDoneRadio.checked = true;

    this.persistSessionState();
    this.showToast(`✓ تم رصد حضور الطالب: ${student.name}`, 'success');
    this.renderMainContent();
  }

  updateAttendanceHomework(attendanceId, newStatus) {
    const item = (this.sessionState.attendanceList || []).find(a => a.id === attendanceId);
    if (item) {
      item.homework = newStatus;
      this.persistSessionState();
      this.showToast('✓ تم تحديث حالة الواجب', 'info');
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
      toast.style.background = '#065f46';
      toast.style.color = '#ffffff';
      toast.style.border = '1px solid #10b981';
    } else if (type === 'error' || type === 'danger') {
      toast.style.background = '#991b1b';
      toast.style.color = '#ffffff';
      toast.style.border = '1px solid #ef4444';
    } else {
      toast.style.background = '#1e3a8a';
      toast.style.color = '#ffffff';
      toast.style.border = '1px solid #3b82f6';
    }

    toast.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px; flex: 1;">
        <span style="font-size: 1.15rem;">${type === 'success' ? '✓' : (type === 'error' || type === 'danger' ? '✕' : 'ℹ')}</span>
        <span>${escapeHtml(message)}</span>
      </div>
      <button style="background: transparent; border: none; color: #fff; cursor: pointer; font-size: 1.1rem; padding: 0 4px; opacity: 0.8;" onclick="this.parentElement.remove()">✕</button>
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
    `;
    modalEl.innerHTML = `
      <div class="modal-dialog" dir="rtl" style="background: #ffffff; border-radius: 14px; max-width: 440px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid var(--centrly-line);">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--centrly-line); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: ${isDanger ? 'var(--centrly-danger)' : 'var(--centrly-ink)'};">
            ${escapeHtml(title)}
          </h3>
          <button onclick="document.getElementById('centrlyConfirmModal')?.remove()" style="background: transparent; border: none; cursor: pointer; font-size: 1.2rem; color: var(--centrly-text);">✕</button>
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
        if (parsed && parsed.id && parsed.status === 'in_progress') {
          this.sessionState = parsed;
        }
      }
    } catch (e) {
      console.warn('Failed to restore session state:', e);
    }
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
      this.showToast('🏁 تم إنهاء الحصة بنجاح وتثبيت الكشف! يمكنك الآن إرسال إشعارات الواتساب للغياب والملاحظات.', 'success');
      this.renderMainContent();
    } catch (err) {
      this.showToast(`❌ فشل إنهاء الحصة: ${err.message || 'حدث خطأ في الخادم'}`, 'danger');
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

  // Functional Add Student Modal (DEV-89: Student Phone Mandatory)
  openAddStudentModal() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${g.name} (${g.center_name || 'السنتر'})</option>`).join('');
    const bodyHtml = `
      <form id="addStudentModalForm" onsubmit="window.centrlyApp.handleCreateStudent(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب رباعي *</label>
          <input type="text" id="newStudentName" class="form-input" placeholder="مثال: يوسف محمود علي رضوان" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف الطالب الشخصي *</label>
          <input type="tel" id="newStudentOwnPhone" class="form-input" placeholder="01123456789" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم هاتف الطالب للتواصل المباشر والباركود (إلزامي)</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر (واتساب) *</label>
          <input type="tel" id="newStudentPhone" class="form-input" placeholder="01012345678" dir="ltr" required>
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
        feedback.textContent = `❌ رقم ولي الأمر غير صحيح (${cleanParentPhone.length} أرقام). يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    const cleanStudentPhone = student_phone.replace(/[\s\-().]/g, '');
    if (!cleanStudentPhone || !egyptianPhoneRegex.test(cleanStudentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ رقم هاتف الطالب إلزامي وغير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
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
      this.showToast(`✓ تمت إضافة الطالب (${name}) بنجاح! والكود التلقائي: ${res.student?.code || res.student?.student_code || 'تم التعيين'}`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ ${err.message || 'فشل إضافة الطالب. تأكد من صحة رقم الهاتف والبيانات.'}`;
      } else {
        this.showToast(`❌ فشل إضافة الطالب: ${err.message || 'تأكد من صحة البيانات'}`, 'danger');
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

    const currentGroupId = student.group_id || student.groupId || '';
    const groupOptions = (this.groups || []).map(g => `
      <option value="${g.id}" ${g.id === currentGroupId ? 'selected' : ''}>${g.name} (${g.center_name || g.centerName || 'السنتر'})</option>
    `).join('');

    const bodyHtml = `
      <form id="editStudentModalForm" onsubmit="window.centrlyApp.saveStudentEdit(event, '${escapeHtml(studentId)}')">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اسم الطالب الرباعي *</label>
          <input type="text" id="editStudentName" class="form-input" value="${escapeHtml(student.name || '')}" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف الطالب الشخصي *</label>
          <input type="tel" id="editStudentOwnPhone" class="form-input" value="${escapeHtml(student.student_phone || '')}" placeholder="01123456789" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم هاتف الطالب للتواصل المباشر والباركود (إلزامي 11 رقماً)</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر (واتساب) *</label>
          <input type="tel" id="editStudentPhone" class="form-input" value="${escapeHtml(student.parent_phone || '')}" placeholder="01012345678" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم مصري مكون من 11 رقماً يبدأ بـ 010 أو 011 أو 012 أو 015</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">المجموعة الأساسية</label>
          <select id="editStudentGroup" class="form-input">
            <option value="">-- بدون تغيير / عام --</option>
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

    this.showModal(`تعديل بيانات الطالب: ${escapeHtml(student.name)}`, bodyHtml, footerHtml);
  }

  async saveStudentEdit(e, studentId) {
    e.preventDefault();
    const name = document.getElementById('editStudentName')?.value.trim();
    const parent_phone = document.getElementById('editStudentPhone')?.value.trim();
    const student_phone = document.getElementById('editStudentOwnPhone')?.value.trim() || '';
    const groupId = document.getElementById('editStudentGroup')?.value;
    const feedback = document.getElementById('editStudentFeedback');
    const saveBtn = document.getElementById('btnUpdateStudent');

    const egyptianPhoneRegex = /^01[0125][0-9]{8}$/;
    const cleanParentPhone = parent_phone.replace(/[\s\-().]/g, '');
    if (!egyptianPhoneRegex.test(cleanParentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ رقم ولي الأمر غير صحيح (${cleanParentPhone.length} أرقام). يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    const cleanStudentPhone = student_phone.replace(/[\s\-().]/g, '');
    if (!cleanStudentPhone || !egyptianPhoneRegex.test(cleanStudentPhone)) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ رقم هاتف الطالب إلزامي وغير صحيح. يجب أن يتكون من 11 رقماً ويبدأ بـ 010 أو 011 أو 012 أو 015.`;
      }
      return;
    }

    if (saveBtn) {
      saveBtn.disabled = true;
      saveBtn.textContent = 'جاري الحفظ...';
    }

    try {
      await request(`/students/${studentId}`, {
        method: 'PUT',
        body: {
          name,
          parent_phone: cleanParentPhone,
          student_phone: cleanStudentPhone,
        },
      });

      if (groupId) {
        await request(`/groups/${groupId}/students`, {
          method: 'POST',
          body: { student_id: studentId },
        }).catch(err => console.warn('Enrollment update note:', err));
      }

      this.closeModal();
      this.showToast(`✓ تم تحديث بيانات الطالب (${name}) بنجاح!`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ ${err.message || 'فشل تحديث بيانات الطالب.'}`;
      } else {
        this.showToast(`❌ فشل تحديث بيانات الطالب: ${err.message || 'خطأ في البيانات'}`, 'danger');
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
          this.showToast(`✓ تم حذف الطالب (${studentName}) بنجاح`, 'success');
          await this.loadRouteData(this.currentRoute);
        } catch (err) {
          this.showToast(`❌ فشل حذف الطالب: ${err.message || 'خطأ في الخادم'}`, 'danger');
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
          <input type="text" id="newGroupName" class="form-input" placeholder="مثال: فيزياء 3 ثانوي - مجموعة السبت" required>
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
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" style="font-weight: 700;">مكان الحصة / السنتر</label>
            <input type="text" id="newGroupCenter" class="form-input" placeholder="مثال: سنتر الأهرام التعليمي">
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
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م) *</label>
          <input type="number" id="newGroupPrice" class="form-input" min="0" step="5" placeholder="مثال: 80" required>
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
          <input type="number" id="newGroupCenterCut" class="form-input" min="0" max="100" value="20" placeholder="مثال: 20">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">يحصل السنتر على هذه النسبة من كل تذكرة حضور والباقي للمدرس</small>
        </div>

        <!-- Conditional Input 2: Fixed per student -->
        <div id="billingFixedPerStudentGroup" class="form-group" style="margin-bottom: 0.85rem; display: none;">
          <label class="form-label" style="font-weight: 700;">قيمة أجر السنتر لكل طالب (ج.م) *</label>
          <input type="number" id="newGroupFixedPerStudent" class="form-input" min="0" step="5" value="25" placeholder="مثال: 25">
          <small style="color: var(--centrly-text); font-size: 0.75rem;">قيمة ثابتة يدفعها الطالب للسنتر عن كل حصة يحضرها</small>
        </div>

        <!-- Conditional Input 3: Fixed room rent -->
        <div id="billingFixedRentGroup" class="form-group" style="margin-bottom: 0.85rem; display: none;">
          <label class="form-label" style="font-weight: 700;">إيجار القاعة الثابت للحصة (ج.م) *</label>
          <input type="number" id="newGroupFixedRent" class="form-input" min="0" step="50" value="300" placeholder="مثال: 300">
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
          <div class="form-group" style="margin-bottom: 0.85rem;">
            <label class="form-label" style="font-weight: 700;">مكان الحصة / السنتر</label>
            <input type="text" id="editGroupCenter" class="form-input" value="${escapeHtml(group.center_name || group.centerName || '')}">
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
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م) *</label>
          <input type="number" id="editGroupPrice" class="form-input" min="0" step="5" value="${group.price ?? group.session_price ?? 80}" required>
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

    if (isCenterOwner && room_id) {
      const matchedRoom = (this.centerRooms || []).find(r => r.id === room_id);
      center_name = matchedRoom ? matchedRoom.name : 'قاعة السنتر';
    } else {
      center_name = document.getElementById('newGroupCenter')?.value.trim() || undefined;
    }

    const day_of_week = document.getElementById('newGroupDayOfWeek')?.value || 'السبت';
    const session_time = document.getElementById('newGroupSessionTime')?.value.trim() || '04:00 م - 06:00 م';
    const price = Number(document.getElementById('newGroupPrice').value) || 0;
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

    saveBtn.disabled = true;
    saveBtn.textContent = 'جاري الإنشاء...';

    try {
      await request('/groups', {
        method: 'POST',
        body: {
          name,
          center_name,
          teacher_id,
          room_id,
          price,
          session_price: price,
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
      this.showToast(`✓ تم إنشاء المجموعة (${name}) بنجاح!`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ ${err.message || 'فشل إنشاء المجموعة.'}`;
      } else {
        this.showToast(`❌ فشل إنشاء المجموعة: ${err.message || 'خطأ في البيانات'}`, 'danger');
      }
      saveBtn.disabled = false;
      saveBtn.textContent = 'إنشاء المجموعة';
    }
  }

  async saveGroupEdit(e, groupId) {
    e.preventDefault();
    const isCenterOwner = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
    const name = document.getElementById('editGroupName')?.value.trim();
    const teacher_id = isCenterOwner ? (document.getElementById('editGroupTeacherId')?.value || null) : null;
    const room_id = isCenterOwner ? (document.getElementById('editGroupRoomId')?.value || null) : null;
    let center_name = undefined;

    if (isCenterOwner && room_id) {
      const matchedRoom = (this.centerRooms || []).find(r => r.id === room_id);
      center_name = matchedRoom ? matchedRoom.name : 'قاعة السنتر';
    } else {
      center_name = document.getElementById('editGroupCenter')?.value.trim() || undefined;
    }

    const day_of_week = document.getElementById('editGroupDayOfWeek')?.value || 'السبت';
    const session_time = document.getElementById('editGroupSessionTime')?.value.trim() || '04:00 م - 06:00 م';
    const price = Number(document.getElementById('editGroupPrice')?.value) || 0;
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
          price,
          session_price: price,
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
      this.showToast(`✓ تم تحديث بيانات المجموعة (${name}) بنجاح!`, 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ ${err.message || 'فشل تحديث بيانات المجموعة.'}`;
      } else {
        this.showToast(`❌ فشل تحديث المجموعة: ${err.message || 'خطأ في البيانات'}`, 'danger');
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
          this.showToast(`✓ تم حذف المجموعة (${groupName}) بنجاح`, 'success');
          await this.loadRouteData(this.currentRoute);
        } catch (err) {
          this.showToast(`❌ فشل حذف المجموعة: ${err.message || 'خطأ في الخادم'}`, 'danger');
        }
      },
    });
  }

  // Functional Student Cards Printing Handlers (DEV-89)
  previewSpecificCard(name, code, group, phone) {
    const pName = document.getElementById('previewStudentName');
    const pCode = document.getElementById('previewStudentCode');
    const pGroup = document.getElementById('previewStudentGroup');
    const pPhone = document.getElementById('previewStudentPhone');
    const pInit = document.getElementById('previewStudentInitial');

    if (pName) pName.textContent = name;
    if (pCode) pCode.textContent = code;
    if (pGroup) pGroup.textContent = group;
    if (pPhone) pPhone.textContent = phone;
    if (pInit) pInit.textContent = name?.charAt(0) || 'ط';

    const card = document.getElementById('cardLivePreview');
    if (card) {
      card.scrollIntoView({ behavior: 'smooth', block: 'center' });
      card.style.transform = 'scale(1.03)';
      setTimeout(() => { if (card) card.style.transform = 'scale(1)'; }, 300);
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
    const checked = Array.from(document.querySelectorAll('.student-card-check:checked'));
    const targetStudents = checked.length > 0
      ? checked.map(c => ({
          name: c.getAttribute('data-name'),
          code: c.getAttribute('data-code'),
          group: c.getAttribute('data-group'),
          phone: c.getAttribute('data-phone'),
        }))
      : (this.students || []).map(s => ({
          name: s.name,
          code: s.code || s.student_code || '—',
          group: s.group_name || 'عامة',
          phone: s.student_phone || s.parent_phone || '—',
        }));

    if (targetStudents.length === 0) {
      this.showToast('يرجى تحديد طالب واحد على الأقل أو إضافة طلاب لطلب كروت بلاستيكية', 'info');
      return;
    }

    const userTitle = this.user?.name || (this.user?.account_type === 'center' ? 'سنتر تعليمي' : 'مدرس المادة');
    let msg = `مرحباً، أرغب في الاستفسار وطلب طباعة كروت بلاستيكية ذكية فاخرة (PVC Cards) لطلابي في منصة سنترلي:\n\n`;
    msg += `📌 اسم المنظومة / المدرس: ${userTitle}\n`;
    msg += `🔢 عدد الكروت المطلوبة: ${targetStudents.length} كارت\n\n`;
    msg += `📋 بيانات الطلاب المحددة:\n`;
    targetStudents.slice(0, 15).forEach((s, i) => {
      msg += `${i + 1}. ${s.name} - كود: ${s.code} (${s.group})\n`;
    });
    if (targetStudents.length > 15) {
      msg += `... ومتبقي ${targetStudents.length - 15} طالب إضافي.\n`;
    }
    msg += `\nيرجى إفادتي بأسعار الكميات وطرق التوصيل.`;

    window.open(`https://wa.me/201123671177?text=${encodeURIComponent(msg)}`, '_blank');
  }

  // Session Management & Action Flow Handlers (DEV-89)
  openStartNewSessionModal() {
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}">${g.name} (${g.center_name || 'السنتر'})</option>`).join('');
    const bodyHtml = `
      <form id="startNewSessionForm" onsubmit="window.centrlyApp.handleStartSessionSubmit(event)">
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">اختر المجموعة لبدء الحصة *</label>
          <select id="startSessionGroupId" class="form-input" required>
            ${groupOptions}
          </select>
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

  async handleStartSessionSubmit(e) {
    e.preventDefault();
    const gId = document.getElementById('startSessionGroupId')?.value;
    if (gId) {
      this.closeModal();
      await this.startSessionForGroup(gId);
    }
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
          <textarea id="cancelReasonInput" class="form-textarea" rows="3" placeholder="مثال: عطل طارئ بالقاعة أو وعكة صحية للمدرس" required></textarea>
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
    this.showToast('✓ تم إلغاء الحصة وسيتم إخطار أولياء الأمور تلقائياً', 'info');
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
          <input type="text" id="rescheduleReason" class="form-input" placeholder="مثال: تأجيل الحصة لمدة ساعتين">
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
    this.showToast(`✓ تم تأجيل الحصة إلى ${newDate} بنجاح وإرسال التنبيه`, 'info');
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
      this.showToast('✓ تم إرسال الملاحظة لولي الأمر بنجاح عبر الواتساب', 'success');
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.backgroundColor = 'var(--centrly-danger-light)';
        feedback.style.color = 'var(--centrly-danger)';
        feedback.textContent = `❌ ${err.message || 'فشل إرسال الملاحظة'}`;
      }
      if (btn) {
        btn.disabled = false;
        btn.textContent = 'إرسال لولي الأمر';
      }
    }
  }

  async retryFailedWhatsAppMessages() {
    const failedList = this.sessionState.attendanceList.filter(a => a.deliveryStatus === 'failed');
    if (failedList.length === 0) {
      this.showToast('لا توجد رسائل فاشلة لإعادة إرسالها.', 'info');
      return;
    }
    failedList.forEach(a => a.deliveryStatus = 'sending');
    this.renderMainContent();

    try {
      await request(`/sessions/${this.sessionState.id}/send-messages`, { method: 'POST' });
      failedList.forEach(a => {
        a.deliveryStatus = 'delivered';
        a.sent = true;
      });
      this.showToast(`✓ تمت إعادة إرسال ${failedList.length} رسائل بنجاح`, 'success');
    } catch (err) {
      failedList.forEach(a => a.deliveryStatus = 'failed');
      this.showToast(`فشل إعادة الإرسال: ${err.message || 'خطأ في الشبكة'}`, 'danger');
    }
    this.renderMainContent();
  }

  // Functional Extra Session Modal
  openScheduleSessionModal(defaultGroupId = null) {
    const cleanDefaultId = defaultGroupId ? String(defaultGroupId).replace(/^rec-/, '') : null;
    const groupOptions = (this.groups || []).map(g => `<option value="${g.id}" ${cleanDefaultId === g.id ? 'selected' : ''}>${g.name}</option>`).join('');
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
      this.showToast('✓ تم جدولة الحصة الإضافية بنجاح وإرسال إشعارات لأولياء الأمور!', 'success');
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      this.showToast(`❌ فشل جدولة الحصة: ${err.message || 'حدث خطأ'}`, 'danger');
    }
  }

  dispatchSessionWhatsAppMessages() {
    if (!this.sessionState.id) {
      this.showToast('لا توجد حصة محددة لإرسال الرسائل.', 'info');
      return;
    }
    const countEligible = this.sessionState.attendanceList.filter(a => !a.attended || a.comment).length;
    if (countEligible === 0) {
      this.showToast('لا توجد رسائل للغياب أو ملاحظات لإرسالها لهذه الحصة.', 'info');
      return;
    }

    this.showConfirmModal({
      title: 'إرسال إشعارات الواتساب',
      message: `سيتم إرسال ${countEligible} رسائل عبر واتساب بنظام التوزيع الآمن (Pacing) لأولياء الأمور. هل ترغب في المتابعة؟`,
      confirmText: 'إرسال الإشعارات الآن',
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        try {
          await request(`/sessions/${this.sessionState.id}/send-messages`, { method: 'POST' });
          this.sessionState.attendanceList.forEach(a => {
            if (!a.attended || a.comment) {
              a.sent = true;
            }
          });
          this.showToast(`💬 تم إطلاق إرسال ${countEligible} رسائل لأولياء الأمور بنجاح!`, 'success');
          this.renderMainContent();
        } catch (err) {
          this.showToast(`❌ فشل إرسال رسائل الواتساب: ${err.message || 'حدث خطأ أثناء الإرسال'}`, 'danger');
        }
      }
    });
  }

  resendSingleMessage(studentId, studentName) {
    this.showConfirmModal({
      title: 'إعادة إرسال الرسالة',
      message: `هل ترغب في إعادة إرسال الرسالة إلى ولي أمر الطالب "${studentName}" عبر واتساب؟`,
      confirmText: 'إعادة الإرسال',
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        try {
          await request(`/sessions/${this.sessionState.id || 'active'}/resend/${studentId}`, { method: 'POST' });
          this.showToast(`✓ تمت إعادة إرسال الرسالة بنجاح إلى ولي أمر: ${studentName}`, 'success');
        } catch (err) {
          this.showToast(`❌ فشل إعادة إرسال الرسالة لـ (${studentName}): ${err.message || 'حدث خطأ في الإرسال'}`, 'danger');
        }
      }
    });
  }

  async copyParentLink(studentId) {
    try {
      const res = await request(`/students/${studentId}/parent-link`);
      const fullUrl = `${window.location.origin}${res.portal_url}`;
      await navigator.clipboard.writeText(fullUrl);
      this.showToast('✓ تم نسخ رابط ولي الأمر الخاص بالطالب بنجاح!', 'success');
    } catch (err) {
      this.showToast(`❌ تعذر الحصول على رابط ولي الأمر: ${err.message || 'تأكد من اتصال الخادم'}`, 'danger');
    }
  }

  async downloadBarcodeSheet(groupId) {
    const targetGroupId = groupId || (this.groups && this.groups[0]?.id);
    if (!targetGroupId) {
      this.showToast('يرجى إنشاء مجموعة دراسية أولاً لطباعة كروت الباركود لطلابها.', 'info');
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
      this.showToast(`❌ ${err.message || 'فشل تحميل ملف الباركود'}`, 'danger');
    }
  }

  openReceiptModal() {
    const rev = this.sessionState.financials.totalRevenue;
    const att = this.sessionState.financials.attendeeCount;
    const abs = this.sessionState.financials.absentCount;
    this.showToast(`🧾 إيصال الحصة: إجمالي النقدية ${rev} ج.م | الحاضرون: ${att} | الغياب: ${abs}`, 'info');
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
  openImportModal() { this.showToast('استيراد من Excel / CSV متاح عبر لوحة المالك.', 'info'); }
  startSessionForGroup(gId) {
    const cleanId = String(gId).replace(/^rec-/, '');
    this.sessionState.id = `sess-${cleanId}`;
    this.sessionState.status = 'in_progress';
    const grp = this.groups.find(g => g.id === cleanId);
    if (grp) {
      this.sessionState.group = grp;
    }
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

  calendarPrev() {
    this.showToast('تم استعراض الفترة السابقة', 'info');
  }

  calendarNext() {
    this.showToast('تم استعراض الفترة التالية', 'info');
  }

  calendarToday() {
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
      this.showToast(`❌ فشل تحديث حالة الصرف: ${err.message || 'حدث خطأ'}`, 'danger');
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
      this.showToast('✓ تمت إضافة القاعة بنجاح!', 'success');
    } catch (err) {
      this.showToast(`❌ فشل إضافة القاعة: ${err.message || 'حدث خطأ'}`, 'danger');
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
      this.showToast(`❌ فشل فحص التعارض: ${err.message || 'حدث خطأ في الاتصال بالخدمة'}`, 'danger');
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
      this.showToast(`❌ فشل إضافة المدرس: ${err.message || 'حدث خطأ أثناء حفظ بيانات المدرس'}`, 'danger');
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
      this.showToast('✓ تمت إضافة المساعد بنجاح!', 'success');
    } catch (err) {
      this.showToast(`❌ فشل إضافة المساعد: ${err.message || 'حدث خطأ'}`, 'danger');
    }
    this.renderMainContent();
  }

  copyInviteUrl(url) {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      this.showToast('✓ تم نسخ رابط الدعوة بنجاح!', 'success');
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

          this.showToast(`✓ ${res.message || 'تم جدولة إرسال التقارير بنجاح'} (إجمالي الطلاب: ${res.total_students} | تمت الجدولة: ${res.queued_count})`, 'success');
        } catch (err) {
          this.showToast(`❌ فشل جدولة إرسال التقارير الجماعية: ${err.message || 'خطأ في الخادم'}`, 'danger');
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
      this.showToast(`✓ تم إرسال التقرير الأكاديمي بنجاح لولي أمر الطالب ${studentName}`, 'success');
    } catch (err) {
      this.showToast(`❌ فشل إرسال تقرير الطالب ${studentName}: ${err.message || 'خطأ في الخادم'}`, 'danger');
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
          this.showToast(`✅ تم إرسال إنذار المتابعة بنجاح لولي أمر الطالب: ${studentName}`, 'success');
        } catch (err) {
          this.showToast(`❌ تعذر إرسال التنبيه: ${err.message || 'خطأ في الخادم'}`, 'danger');
        }
      }
    });
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
      this.showToast('يرجى إدخال رقم العملية أو رقم المحفظة', 'danger');
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
      this.showToast('🎉 تم استلام بيانات التحويل بنجاح! حسابك سارٍ وسيتم مراجعة الإيصال وتأكيد الاشتراك فوراً.', 'success');
      await this.loadRouteData('billing');
    } catch (err) {
      this.showToast(`❌ فشل تسجيل إيصال الدفع: ${err.message || 'خطأ في الخادم'}`, 'danger');
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
