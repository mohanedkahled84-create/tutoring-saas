import { authService } from './services/auth.js';
import { request } from './services/api.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderNavbar } from './components/Navbar.js';
import { renderAuthScreens } from './components/AuthScreens.js';
import { renderOnboardingWizard } from './components/OnboardingWizard.js';
import { renderTeacherDashboard } from './components/TeacherDashboard.js';
import { renderSessionsView } from './components/SessionsView.js';
import { renderStudentsView } from './components/StudentsView.js';
import { renderGroupsView } from './components/GroupsView.js';
import { renderMessageLogsView } from './components/MessageLogsView.js';
import { renderParentPortalView } from './components/ParentPortalView.js';
import { renderTeacherCalendar } from './components/TeacherCalendar.js';
import { renderCenterOwnerDashboard } from './components/CenterOwnerDashboard.js';
import { renderStudentReportsView } from './components/StudentReportsView.js';

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

  async quickDemoLogin() {
    try {
      const res = await authService.login('teacher@example.com', 'Password123!');
      this.user = res.user;
      this.renderApp();
      await this.loadRouteData(this.currentRoute);
    } catch (err) {
      this.showAuthAlert(err.message || 'فشل تسجيل الدخول التجريبي.');
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    const accountType = document.getElementById('signupAccountType')?.value || 'teacher';
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;

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
    this.renderApp();
    this.loadRouteData(this.currentRoute);
  }

  logout() {
    authService.logout();
  }

  toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  async navigate(route) {
    this.currentRoute = route;
    this.renderMainContent();
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(btn => {
      btn.classList.remove('active');
    });
    await this.loadRouteData(route);
  }

  async loadRouteData(route) {
    try {
      switch (route) {
        case 'calendar': {
          const [calRes, grpRes] = await Promise.all([
            request('/sessions/calendar?from=2026-09-01&to=2026-09-30').catch(() => []),
            request('/groups').catch(() => []),
          ]);
          this.calendarSessions = Array.isArray(calRes) ? calRes : (calRes.sessions || []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          this.calendarState.sessions = this.calendarSessions;
          this.calendarState.groups = this.groups;
          this.renderMainContent();
          break;
        }
        case 'center-dashboard': {
          const period = this.centerDashboardState.period || new Date().toISOString().slice(0, 7);
          const [rollupRes, roomsRes] = await Promise.all([
            request(`/centers/financials/rollup?period=${period}`).catch(() => null),
            request('/centers/rooms').catch(() => []),
          ]);
          if (rollupRes) this.centerDashboardState.rollup = rollupRes;
          if (roomsRes) this.centerDashboardState.rooms = Array.isArray(roomsRes) ? roomsRes : (roomsRes.rooms || []);
          this.renderMainContent();
          break;
        }
        case 'students': {
          const [studRes, grpRes] = await Promise.all([
            request('/students').catch(() => []),
            request('/groups').catch(() => []),
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
            request(url).catch(() => null),
            request('/groups').catch(() => []),
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
          const grpRes = await request('/groups').catch(() => []);
          this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          this.renderMainContent();
          break;
        }
        case 'dashboard': {
          const [studRes, grpRes, riskRes] = await Promise.all([
            request('/students').catch(() => []),
            request('/groups').catch(() => []),
            request('/at-risk').catch(() => []),
          ]);
          const students = Array.isArray(studRes) ? studRes : (studRes.students || []);
          const groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
          const atRisk = Array.isArray(riskRes) ? riskRes : (riskRes.students || []);
          this.dashboardData = {
            stats: {
              totalStudents: students.length,
              activeGroups: groups.length,
              todayAttendanceRate: '0%',
              pendingMessages: 0,
            },
            atRiskStudents: atRisk,
            topPerformers: [],
          };
          this.renderMainContent();
          break;
        }
        case 'activity-logs':
        case 'whatsapp': {
          const logsRes = await request('/activity-logs').catch(() => []);
          this.messageLogs = Array.isArray(logsRes) ? logsRes : (logsRes.logs || []);
          this.renderMainContent();
          break;
        }
        case 'sessions': {
          if (!this.sessionState.id) {
            const todaySessions = await request('/sessions?status=in_progress').catch(() => []);
            const sessionsArr = Array.isArray(todaySessions) ? todaySessions : (todaySessions.sessions || []);
            if (sessionsArr.length > 0) {
              const s = sessionsArr[0];
              this.sessionState.id = s.id;
              this.sessionState.status = s.status;
              this.sessionState.group = s.group || { id: s.group_id, name: s.group_name || 'حصة اليوم', price: s.price || 0 };
              this.renderMainContent();
            }
          }
          break;
        }
      }
    } catch (err) {
      console.warn('loadRouteData error:', err);
    }
  }

  renderApp() {
    const html = `
      <div class="app-container">
        ${renderSidebar(this.currentRoute)}
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
      case 'activity-logs':
      case 'whatsapp':
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

  async endActiveSession() {
    if (!this.sessionState.id) {
      alert('لا توجد حصة نشطة لإنهائها.');
      return;
    }
    if (!confirm('هل أنت متأكد من رغبتك في إنهاء الحصة وتثبيت الحضور؟')) return;

    try {
      await request(`/sessions/${this.sessionState.id}/end`, { method: 'POST' });
      this.sessionState.status = 'ended';
      alert('🏁 تم إنهاء الحصة بنجاح وتثبيت الكشف! يمكنك الآن إرسال إشعارات الواتساب للغياب والملاحظات.');
      this.renderMainContent();
    } catch (err) {
      alert(`❌ فشل إنهاء الحصة: ${err.message || 'حدث خطأ في الخادم'}`);
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

  downloadBarcodeSheet() {
    const baseUrl = window.__CENTRLY_API_URL__ || 'http://localhost:3000/api';
    window.open(`${baseUrl}/students/barcode-sheet.pdf`, '_blank');
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
  openAddStudentModal() { alert('إضافة طالب جديد'); }
  openImportModal() { alert('استيراد من Excel / CSV'); }
  openCreateGroupModal() { alert('إنشاء مجموعة جديدة'); }
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
}

window.centrlyApp = new CentrlyApp();
window.addEventListener('DOMContentLoaded', () => {
  window.centrlyApp.init();
});
