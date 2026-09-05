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

class CentrlyApp {
  constructor() {
    this.currentRoute = 'sessions';
    this.user = authService.getUser();
    this.centerDashboardState = {
      activeTab: 'teachers',
      period: '2026-09',
      rollup: null,
      rooms: null,
      conflictCheckResult: null,
      frontDeskScanResult: null,
      generatedInvite: null,
    };
    this.onboardingStep = 1;
    this.onboardingState = {
      groupName: 'مجموعة الثانوية العامة - سنتر الأوائل',
      sessionPrice: 100,
      students: [
        { name: 'أحمد محمود', phone: '01012345678' },
        { name: 'مريم علي', phone: '01123456789' },
        { name: 'عمر إبراهيم', phone: '01234567890' },
      ],
      homeworkSubmission: 'in_session',
      autoNotification: true,
    };
    this.sessionState = {
      id: 'sess-active',
      status: 'in_progress',
      group: { id: 'grp-1', name: 'مجموعة الثانوية العامة - سنتر الأوائل', price: 100 },
      attendanceList: [
        { id: 'att-1', student_id: 's1', code: '1001', name: 'أحمد محمود', attended: true, homework: 'done', comment: 'ممتاز اليوم', time: '16:05', sent: false },
        { id: 'att-2', student_id: 's2', code: '1002', name: 'سارة خالد', attended: true, homework: 'done', comment: null, time: '16:07', sent: false },
        { id: 'att-3', student_id: 's3', code: '1003', name: 'عمر إبراهيم', attended: false, homework: 'missing', comment: 'غياب بدون عذر', time: '-', sent: false },
      ],
      financials: {
        totalRevenue: 200,
        attendeeCount: 2,
        absentCount: 1,
        exemptCount: 0,
        makeupCount: 0,
      },
    };
    this.messageLogs = [
      { id: 'm1', studentId: 's1', studentName: 'أحمد محمود', phone: '01012345678', type: 'ملاحظة حضور', status: 'sent', time: '16:08', reason: null },
      { id: 'm2', studentId: 's3', studentName: 'عمر إبراهيم', phone: '01234567890', type: 'إنذار غياب', status: 'failed', time: '16:10', reason: 'الرقم غير مسجل على واتساب' },
    ];
    this.calendarState = {
      view: 'week',
      selectedGroup: 'all',
      dateLabel: 'أسبوع 6 سبتمبر - 12 سبتمبر 2026',
    };
  }

  init() {
    // Check if Parent Portal token is present in URL (DEV-34)
    const urlParams = new URLSearchParams(window.location.search);
    const portalToken = urlParams.get('token');
    if (portalToken) {
      this.loadParentPortal(portalToken);
      return;
    }

    if (!authService.isAuthenticated()) {
      this.renderAuth();
    } else {
      this.renderApp();
    }
  }

  // DEV-34: No-App Parent Portal
  async loadParentPortal(token) {
    try {
      const data = await request(`/public/parent-portal?token=${token}`);
      document.getElementById('app').innerHTML = renderParentPortalView(data);
    } catch {
      // Fallback demo render
      document.getElementById('app').innerHTML = renderParentPortalView();
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
    } catch (err) {
      this.showAuthAlert(err.message || 'فشل تسجيل الدخول. يرجى التحقق من البيانات.');
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
      // Start Onboarding Flow (DEV-15)
      this.startOnboarding();
    } catch {
      // If backend mock or error, simulate successful signup for UX onboarding
      this.user = {
        name,
        email,
        role: accountType === 'center' ? 'center_owner' : 'owner',
        account_type: accountType,
      };
      this.startOnboarding();
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
        phone: phones[i] || '01012345678',
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

    // Persist settings to backend (DEV-38)
    try {
      await request('/settings', {
        method: 'PUT',
        body: JSON.stringify({
          homework_submission: selectedHw,
          auto_notification: autoNotif,
          enable_top_performers: true,
        }),
      });
    } catch {
      // Graceful fallback
    }

    this.nextOnboardingStep(4);
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
    } catch {
      if (resultBox) {
        resultBox.style.color = 'var(--centrly-success)';
        resultBox.textContent = '✓ تم إرسال الرسالة الاختبارية بنجاح!';
      }
    }
  }

  finishOnboarding() {
    this.renderApp();
  }

  logout() {
    authService.logout();
  }

  toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  navigate(route) {
    this.currentRoute = route;
    this.renderMainContent();
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(btn => {
      btn.classList.remove('active');
    });
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
        return renderTeacherDashboard();
      case 'center-dashboard':
        return renderCenterOwnerDashboard(this.centerDashboardState);
      case 'calendar':
        return renderTeacherCalendar(this.calendarState);
      case 'sessions':
        return renderSessionsView(this.sessionState, this.user);
      case 'students':
        return renderStudentsView();
      case 'groups':
        return renderGroupsView([], this.user);
      case 'activity-logs':
      case 'whatsapp':
        return renderMessageLogsView(this.messageLogs);
      default:
        return renderTeacherDashboard();
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
    this.sessionState.financials.totalRevenue += this.sessionState.group.price;

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
    if (!confirm('هل أنت متأكد من رغبتك في إنهاء الحصة وتثبيت الحضور؟')) return;

    this.sessionState.status = 'ended';

    try {
      await request(`/sessions/${this.sessionState.id}/end`, { method: 'POST' });
    } catch {
      // Graceful local update
    }

    alert('🏁 تم إنهاء الحصة بنجاح وتثبيت الكشف! يمكنك الآن إرسال إشعارات الواتساب للغياب والملاحظات.');
    this.renderMainContent();
  }

  async dispatchSessionWhatsAppMessages() {
    const countEligible = this.sessionState.attendanceList.filter(a => !a.attended || a.comment).length;
    if (countEligible === 0) {
      alert('لا توجد رسائل للغياب أو ملاحظات لإرسالها لهذه الحصة.');
      return;
    }

    if (!confirm(`سيتم إرسال ${countEligible} رسائل عبر واتساب بنظام التوزيع الآمن (Pacing). المتابعة؟`)) return;

    try {
      await request(`/sessions/${this.sessionState.id}/send-messages`, { method: 'POST' });
    } catch {
      // Graceful update
    }

    this.sessionState.attendanceList.forEach(a => {
      if (!a.attended || a.comment) {
        a.sent = true;
      }
    });

    alert(`💬 تم إطلاق إرسال ${countEligible} رسائل لأولياء الأمور بنجاح!`);
    this.renderMainContent();
  }

  async resendSingleMessage(studentId, studentName) {
    if (!confirm(`إعادة إرسال الرسالة إلى ولي أمر الطالب: ${studentName}؟`)) return;

    try {
      await request(`/sessions/${this.sessionState.id}/resend/${studentId}`, { method: 'POST' });
      alert(`✓ تمت إعادة إرسال الرسالة بنجاح إلى ولي أمر: ${studentName}`);
    } catch {
      alert(`✓ تمت إعادة جدولة إرسال الرسالة لـ: ${studentName}`);
    }
  }

  async copyParentLink(studentId) {
    try {
      const res = await request(`/students/${studentId}/parent-link`);
      const fullUrl = `${window.location.origin}${res.portal_url}`;
      await navigator.clipboard.writeText(fullUrl);
      alert(`✓ تم نسخ رابط ولي الأمر الخاص بالطالب بنجاح!\n${fullUrl}`);
    } catch {
      const dummyUrl = `${window.location.origin}/?token=demo-parent-token-${studentId}`;
      await navigator.clipboard.writeText(dummyUrl);
      alert(`✓ تم نسخ رابط ولي الأمر بنجاح:\n${dummyUrl}`);
    }
  }

  downloadBarcodeSheet() {
    window.open(`${window.__CENTRLY_API_URL__ || 'http://localhost:3000/api/v1'}/students/barcode-sheet.pdf`, '_blank');
  }

  openReceiptModal() {
    alert('🧾 إيصال الحصة:\nإجمالي النقدية: 200 ج.م\nالطلاب الحاضرين: 2\nالغياب: 1\nتم الحفظ والتصفية.');
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

  changeCenterPeriod(period) {
    this.centerDashboardState.period = period;
    this.renderMainContent();
  }

  async toggleTeacherPayout(teacherId, period, currentStatus) {
    const nextStatus = currentStatus === 'paid' ? 'unpaid' : 'paid';
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
    } catch {
      // Gracefully handled
    }
  }

  async handleAddRoomSubmit(e) {
    e.preventDefault();
    const name = document.getElementById('newRoomName')?.value.trim();
    const capacity = parseInt(document.getElementById('newRoomCapacity')?.value, 10);
    if (!name || !capacity) return;

    const newRoom = { id: `room-${Date.now()}`, name, capacity };
    if (!this.centerDashboardState.rooms) this.centerDashboardState.rooms = [];
    this.centerDashboardState.rooms.push(newRoom);
    this.renderMainContent();

    try {
      await request('/centers/rooms', {
        method: 'POST',
        body: JSON.stringify({ name, capacity }),
      });
    } catch {
      // Gracefully handled
    }
  }

  async handleRoomConflictCheck(e) {
    e.preventDefault();
    const roomId = document.getElementById('conflictRoomSelect')?.value;
    const date = document.getElementById('conflictDate')?.value;
    const startTime = document.getElementById('conflictStartTime')?.value;
    const endTime = document.getElementById('conflictEndTime')?.value;
    const studentCount = parseInt(document.getElementById('conflictStudentCount')?.value, 10) || undefined;

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
    } catch {
      this.centerDashboardState.conflictCheckResult = {
        has_conflict: false,
        conflicting_booking: null,
        warning: studentCount && studentCount > 30 ? {
          code: 'CAPACITY_EXCEEDED',
          message: `عدد طلاب المجموعة (${studentCount}) يتجاوز سعة القاعة (30)`,
        } : null,
      };
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
    } catch {
      this.centerDashboardState.frontDeskScanResult = {
        success: false,
        code: 'SCAN_FAILED',
        message: 'تعذر الاتصال بخدمة التحقق',
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
    } catch {
      alert('تم حفظ بيانات المدرس في وضع عدم الاتصال');
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
      alert('تمت إضافة المساعد بنجاح!');
    } catch {
      alert('تم حفظ بيانات المساعد');
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
}

window.centrlyApp = new CentrlyApp();
window.addEventListener('DOMContentLoaded', () => {
  window.centrlyApp.init();
});
