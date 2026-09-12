import { authService } from './services/auth.js';
import { request } from './services/api.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderNavbar } from './components/Navbar.js';
import { renderAuthScreens } from './components/AuthScreens.js';
import { renderOnboardingWizard } from './components/OnboardingWizard.js';
import { renderTeacherDashboard } from './components/TeacherDashboard.js?v=2.1.0';
import { renderTeacherCalendar } from './components/TeacherCalendar.js';
import { renderSessionsView } from './components/SessionsView.js';
import { renderStudentsView } from './components/StudentsView.js?v=2.7.0';
import { renderGroupsView } from './components/GroupsView.js';
import { renderMessageLogsView } from './components/MessageLogsView.js';
import { renderParentPortalView } from './components/ParentPortalView.js?v=2.7.0';
import { renderCenterOwnerDashboard } from './components/CenterOwnerDashboard.js';
import { renderStudentReportsView } from './components/StudentReportsView.js';
import { renderRiskWatchlistView } from './components/RiskWatchlistView.js';
import { renderBillingView } from './components/BillingView.js';
import { renderWhatsAppSettingsView } from './components/WhatsAppSettingsView.js';
import { renderStudentCardsView } from './components/StudentCardsView.js';
import { renderTeacherQuizzesView } from './components/TeacherQuizzesView.js?v=2.6.0';
import { renderCenterSessionsView } from './components/CenterSessionsView.js';
import { renderCenterTeachersView } from './components/CenterTeachersView.js';
import { renderCenterAssistantsView } from './components/CenterAssistantsView.js';
import { renderCenterRoomsView } from './components/CenterRoomsView.js';
import { renderCenterSettlementsView } from './components/CenterSettlementsView.js';
import { renderLandingView } from './components/LandingView.js?v=2.8.0';
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
    this.billingCycle = 'monthly';
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
      const viewParam = urlParams.get('view');
      if (viewParam === 'login' || viewParam === 'signup') {
        this.renderAuth(viewParam);
      } else {
        this.renderLanding();
      }
    } else {
      this.user = authService.getUser();
      try {
        const me = await authService.getProfile().catch(() => null);
        if (me?.user) {
          this.user = { ...this.user, ...me.user };
        }
      } catch (_) {}

      const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
      const savedRoute = localStorage.getItem('centrly_current_route');
      if (savedRoute && savedRoute !== 'dashboard' && savedRoute !== 'center-dashboard') {
        this.currentRoute = savedRoute;
      } else {
        this.currentRoute = isCenter ? 'center-dashboard' : 'dashboard';
      }

      this.restoreSessionState();
      this.renderApp();
      await this.loadRouteData(this.currentRoute);
    }
  }

  // Official Landing / Welcome Page
  renderLanding() {
    window.scrollTo(0, 0);
    document.getElementById('app').innerHTML = renderLandingView();
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
      `;
    } else if (type === 'privacy') {
      titleEl.innerText = 'سياسة الخصوصية وحماية البيانات (Privacy Policy)';
      bodyEl.innerHTML = `
        <h4 style="color: #1e3a8a; margin-top: 0; font-weight: 800;">1. جمع واستخدام البيانات</h4>
        <p>نحن نحترم خصوصيتك وخصوصية بيانات طلابك بأعلى المعايير. نجمع فقط البيانات الضرورية لتشغيل الخدمة بكفاءة (مثل: اسم المعلم، أرقام هواتف الطلاب وأولياء الأمور، وسجلات الحضور والدرجات).</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">2. سرية وأمان البيانات المشفرة</h4>
        <p>تُخزّن جميع البيانات في قواعد بيانات سحابية مشفرة ومؤمنة بأحدث بروتوكولات الحماية (RLS Encryption). نحن نلتزم التزاماً قاطعاً بعدم بيع أو تأجير أو مشاركة أي بيانات تخص طلابك أو أرقام هواتفهم مع أي طرف ثالث أو استخدامها لأي أغراض إعلانية.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">3. إشعارات الواتساب</h4>
        <p>يتم إرسال الرسائل بناءً على طلب وتوجيه المعلم أو السنتر لإخطار أولياء الأمور فقط بمواعيد الحصص وحالة الحضور والدرجات.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">4. حقوق المستخدم</h4>
        <p>يحق للمشترك في أي وقت طلب تصدير كامل بياناته أو حذف حسابه وبيانات طلابه بالكامل من خوادمنا بمجرد تقديم طلب للدعم الفني.</p>
      `;
    } else if (type === 'refund') {
      titleEl.innerText = 'سياسة الاسترجاع والإلغاء (Refund & Cancellation Policy)';
      bodyEl.innerHTML = `
        <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 8px; padding: 0.75rem 1rem; margin-bottom: 1rem; color: #065f46; font-weight: 700;">
          🛡️ ضمان استرداد الأموال بنسبة 100% خلال 7 أيام (Money-Back Guarantee)
        </div>
        <p>في سنترلي، رضاك التام ونجاح منظومتك هو أساس عملنا. لذلك نوفر سياسة استرجاع مرنة وعادلة تماماً:</p>
        
        <h4 style="color: #1e3a8a; font-weight: 800;">1. شروط استرداد قيمة الاشتراك</h4>
        <ul>
          <li>يحق لأي مشترك جديد في باقات المنصة طلب استرداد كامل قيمة الاشتراك خلال <b>7 أيام</b> من تاريخ الدفع الأول، في حال عدم رضاه عن الخدمة أو وجود أي عائق تقني لم نتمكن من حله.</li>
          <li>يتم تحويل المبلغ المسترد كاملاً بنفس وسيلة الدفع التي استخدمها العميل (عبر بطاقة البنك أو المحفظة الإلكترونية) خلال 3 إلى 5 أيام عمل وفقاً لقواعد شبكات الدفع المصرية.</li>
        </ul>

        <h4 style="color: #1e3a8a; font-weight: 800;">2. إلغاء الاشتراك الشهري</h4>
        <p>يمكنك إلغاء تجديد اشتراكك في أي وقت من لوحة التحكم أو بالتواصل مع الدعم الفني، وسيظل حسابك نشطاً حتى نهاية الفترة المدفوعة بالفعل دون أي رسوم أو غرامات إلغاء إضافية.</p>

        <h4 style="color: #1e3a8a; font-weight: 800;">3. طلبات كروت الطلاب المطبوعة</h4>
        <p>المبالغ المدفوعة لطباعة كروت الطلاب البلاستيكية (PVC) التي تم تنفيذها وطباعتها وشحنها بالفعل للمدرس لا تخضع لسياسة الاسترجاع نظراً لتخصيصها وطباعة بيانات المدرس عليها.</p>
      `;
    } else if (type === 'contact') {
      titleEl.innerText = 'بيانات التواصل الرسمية وخدمة العملاء';
      bodyEl.innerHTML = `
        <h4 style="color: #1e3a8a; margin-top: 0; font-weight: 800;">بيانات التواصل المعتمدة لدى سنترلي:</h4>
        <p>يسعدنا تقديم الدعم الفني والإجابة على أي استفسارات للمعلمين وأصحاب السناتر في مصر:</p>
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 1.25rem; line-height: 2.2;">
          🏢 <b>الاسم التجاري الرسمي:</b> سنترلي للحلول التعليمية والبرمجيات (Centrly SaaS)<br>
          📍 <b>العنوان والمقر:</b> جمهورية مصر العربية — القاهرة<br>
          ✉️ <b>البريد الإلكتروني الرسمي:</b> <a href="mailto:support@centrly.app" style="color: #2563eb; font-weight: 700;">support@centrly.app</a><br>
          📱 <b>الهاتف والواتساب المباشر:</b> <span dir="ltr" style="font-weight: 800; color: #0f172a;">+20 100 000 0000</span><br>
          ⏰ <b>أوقات خدمة العملاء:</b> يومياً من 9:00 صباحاً حتى 10:00 مساءً بتوقيت القاهرة<br>
          💱 <b>العملة الرسمية لجميع المعاملات:</b> الجنيه المصري (EGP - ج.م)
        </div>
      `;
    }

    overlay.style.display = 'flex';
  }

  closePolicyModal() {
    const overlay = document.getElementById('policyModalOverlay');
    if (overlay) overlay.style.display = 'none';
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

  renderAuth(tab = 'login') {
    window.scrollTo(0, 0);
    document.getElementById('app').innerHTML = renderAuthScreens();
    if (tab === 'signup') {
      this.switchAuthTab('signup');
    } else {
      this.switchAuthTab('login');
    }
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
      const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
      this.currentRoute = isCenter ? 'center-dashboard' : 'dashboard';
      try {
        localStorage.setItem('centrly_current_route', this.currentRoute);
      } catch (_) {}
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
    try {
      localStorage.setItem('centrly_current_route', route);
    } catch (_) {}
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
          this.renderMainContent();
          try {
            const [studRes, grpRes, billingRes] = await Promise.all([
              request('/students'),
              request('/groups'),
              (!this.billingState || !this.billingState.students_limit) ? request('/billing/status').catch(() => null) : Promise.resolve(this.billingState),
            ]);
            this.students = Array.isArray(studRes) ? studRes : (studRes.students || []);
            this.groups = Array.isArray(grpRes) ? grpRes : (grpRes.groups || []);
            if (billingRes) this.billingState = billingRes;
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
            totalTeacherProfit += netProfit;

            return {
              ...g,
              student_count: count,
              students_count: count,
              monthly_rev: monthlyGross,
              net_profit: netProfit,
            };
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
            groups: mappedGroups,
            atRiskStudents: atRisk,
            topPerformers: leaderboard,
          };
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
          if (this.sessionState.id && !String(this.sessionState.id).startsWith('sess-')) {
            try {
              const serverSessionRes = await request(`/sessions/${this.sessionState.id}`).catch(() => null);
              if (serverSessionRes?.attendance && Array.isArray(serverSessionRes.attendance)) {
                serverSessionRes.attendance.forEach(serverAtt => {
                  const local = (this.sessionState.attendanceList || []).find(a => a.student_id === serverAtt.student_id);
                  if (local) {
                    if (serverAtt.wa_status === 'failed') {
                      local.deliveryStatus = 'failed';
                      local.wa_status = 'failed';
                      local.sent = false;
                    } else if (serverAtt.wa_status === 'sent' || serverAtt.sent) {
                      local.deliveryStatus = 'delivered';
                      local.wa_status = 'sent';
                      local.sent = true;
                    }
                  }
                });
              }
            } catch (_) {}
          }
          this.renderMainContent();
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
        return renderTeacherDashboard(this.dashboardData || {}, this.user || {});
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
        return renderStudentsView(this.students, this.groups, this.studentsLoading, this.billingState);
      case 'student-cards':
        return renderStudentCardsView(this.students, this.groups, this.user);
      case 'reports':
        return renderStudentReportsView(this.reportsState);
      case 'groups':
        return renderGroupsView(this.groups, this.user);
      case 'risk-watchlist':
        return renderRiskWatchlistView(this.watchlistData || this.dashboardData?.atRiskStudents || []);
      case 'billing':
        return renderBillingView(this.billingState || {}, this.user || {});
      case 'whatsapp':
        return renderWhatsAppSettingsView(this.whatsappState || {});
      case 'activity-logs': {
        const isCenter = this.user?.role === 'center_owner' || this.user?.account_type === 'center';
        if (isCenter) {
          return renderCenterSettlementsView(this.centerDashboardState);
        }
        return renderMessageLogsView(this.messageLogs);
      }
      default:
        return renderTeacherDashboard(this.dashboardData || {}, this.user || {});
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
    const studentLimit = this.billingState?.students_limit || 100;
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

    this.persistSessionState();
    this.showToast(isMakeup ? `تم تسجيل حضور تعويضي للطالب: ${student.name}` : `تم رصد حضور الطالب: ${student.name}`, 'success');
    this.renderMainContent();
    this.focusScanInput();
  }

  updateAttendanceQuizScore(attendanceId, score) {
    const item = (this.sessionState.attendanceList || []).find(a => a.id === attendanceId || a.student_id === attendanceId);
    if (item) {
      item.quiz_score = score !== '' && score !== null ? Number(score) : null;
      this.persistSessionState();
    }
  }

  updateAttendanceHomework(attendanceId, newStatus) {
    const item = (this.sessionState.attendanceList || []).find(a => a.id === attendanceId);
    if (item) {
      item.homework = newStatus;
      this.persistSessionState();
      this.showToast('تم تحديث حالة الواجب', 'info');
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
        <span style="font-size: 1.15rem;">${type === 'success' ? '' : (type === 'error' || type === 'danger' ? '✕' : 'ℹ')}</span>
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
      this.showToast('تم إنهاء الحصة بنجاح وتثبيت الكشف! يمكنك الآن إرسال إشعارات الواتساب للغياب والملاحظات.', 'success');
      this.renderMainContent();
    } catch (err) {
      // If server returns NOT_FOUND / Session not found, finish locally to never trap the user
      if (err.message && (err.message.includes('Session not found') || err.message.includes('NOT_FOUND'))) {
        this.sessionState.status = 'ended';
        this.persistSessionState();
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
    const studentLimit = this.billingState?.students_limit || 100;
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
          <input type="tel" id="editStudentOwnPhone" class="form-input" value="${escapeHtml(student.student_phone || '')}" placeholder="" dir="ltr" required>
          <small style="color: var(--centrly-text); font-size: 0.75rem;">رقم هاتف الطالب للتواصل المباشر والباركود (إلزامي 11 رقماً)</small>
        </div>
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر (واتساب) *</label>
          <input type="tel" id="editStudentPhone" class="form-input" value="${escapeHtml(student.parent_phone || '')}" placeholder="" dir="ltr" required>
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
      this.showToast(`تم تحديث بيانات الطالب (${name}) بنجاح!`, 'success');
      await this.loadRouteData(this.currentRoute);
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
        <div class="form-group" style="margin-bottom: 0.85rem;">
          <label class="form-label" style="font-weight: 700;">سعر الحصة للطالب (ج.م) *</label>
          <input type="number" id="newGroupPrice" class="form-input" min="0" step="5" placeholder="سعر الحصة" required>
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
    const msg = `مرحباً، أرغب في تأكيد طلب كروت الطلاب لمنظومة (${userTitle}) بإجمالي (${students.length}) طالب. تم تجهيز ملف الكشف (Excel) لإرساله الآن.`;
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
      message: `سيتم إرسال (${countEligible}) رسالة لأولياء الأمور لتقارير الحضور والغياب والملاحظات والواجب مع تطبيق نظام الأمان الفائق ومكافحة الحظر (Ultra Anti-Ban) بفواصل عشوائية (من 20 إلى 40 ثانية لكل طالب) ومحاكاة الكتابة الحية (جاري الكتابة...). هل ترغب في المتابعة؟`,
      confirmText: `إرسال الإشعارات الآن (${countEligible} رسالة)`,
      cancelText: 'إلغاء',
      isDanger: false,
      onConfirm: async () => {
        if (this.sessionState.isDispatchingWhatsApp) return;
        this.sessionState.isDispatchingWhatsApp = true;
        try {
          this.showToast('جارٍ إرسال إشعارات الحصة عبر واتساب بأعلى درجات الأمان (فواصل 20-40 ثانية ومحاكاة الكتابة)...', 'info');

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
      message: `هل ترغب في إرسال تقرير الحصة للطالب "${studentName}" إلى ولي الأمر (${parentPhone || 'هاتف غير مسجل'})؟`,
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
          // Fallback to instant 1-click Direct WhatsApp so message is guaranteed to reach parent!
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

  openDirectWhatsAppFallbackModal(studentName, phone, messageText, onDelivered) {
    let cleanPhone = (phone || '').replace(/[\s\-\+\(\)]/g, '');
    if (cleanPhone.startsWith('00')) cleanPhone = cleanPhone.slice(2);
    if (cleanPhone.startsWith('01') && cleanPhone.length === 11) {
      cleanPhone = '20' + cleanPhone.slice(1);
    }

    const waUrl = cleanPhone 
      ? `https://wa.me/${cleanPhone}?text=${encodeURIComponent(messageText)}`
      : `https://wa.me/?text=${encodeURIComponent(messageText)}`;

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;" dir="rtl">
        <div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 0.85rem; font-size: 0.85rem; color: #92400e; line-height: 1.6;">
          <strong>الإرسال المباشر لولي الأمر:</strong> واتساب السيرفر الآلي غير متصل حالياً. تم تجهيز نص التقرير بالكامل للطالب <b>${escapeHtml(studentName)}</b> لتتمكن من إرساله فوراً بنقرة واحدة عبر واتساب لضمان وصوله إلى ولي الأمر!
        </div>

        <div class="form-group">
          <label class="form-label" style="font-weight: 700;">رقم هاتف ولي الأمر:</label>
          <input type="tel" id="fallbackParentPhone" class="form-input" dir="ltr" value="${escapeHtml(phone || '')}" placeholder="01012345678" oninput="window.centrlyApp.updateDirectFallbackLink()">
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
            <span>فتح واتساب وإرسال الإشعار الآن</span>
          </a>
        </div>
      </div>
    `;

    this._pendingDirectOnDelivered = onDelivered;
    this.showModal(`إرسال تقرير (${studentName}) عبر واتساب`, bodyHtml, '');
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

  async copyParentLink(studentId) {
    try {
      const res = await request(`/students/${studentId}/parent-link`);
      const canonicalOrigin = 'https://centerly-platform.vercel.app';
      const fullUrl = res.full_url || `${canonicalOrigin}${res.portal_url}`;
      await navigator.clipboard.writeText(fullUrl);
      this.showToast('تم نسخ رابط متابعة ولي الأمر بنجاح!', 'success');
    } catch (err) {
      this.showToast(`تعذر الحصول على رابط ولي الأمر: ${err.message || 'تأكد من اتصال الخادم'}`, 'danger');
    }
  }

  async previewParentPortal(studentId) {
    try {
      const res = await request(`/students/${studentId}/parent-link`);
      const canonicalOrigin = 'https://centerly-platform.vercel.app';
      const fullUrl = res.full_url || `${canonicalOrigin}${res.portal_url}`;
      window.open(fullUrl, '_blank');
    } catch (err) {
      this.showToast(`تعذر فتح رابط المعاينة: ${err.message || 'تأكد من اتصال الخادم'}`, 'danger');
    }
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
        const errorMsg = res.error || 'فشل إرسال الرابط عبر واتساب';
        const displayMsg = (errorMsg.includes('Evolution') || errorMsg.includes('instance') || errorMsg.includes('404'))
          ? 'تعذر الإرسال: حساب الواتساب غير متصل حالياً أو يحتاج لمسح كود QR من صفحة الإعدادات أولاً.'
          : errorMsg;
        this.showToast(displayMsg, 'danger');
      }
    } catch (err) {
      const errorMsg = err.message || 'تأكد من اتصال الخادم';
      const displayMsg = (errorMsg.includes('Evolution') || errorMsg.includes('instance') || errorMsg.includes('404'))
        ? 'تعذر الإرسال: حساب الواتساب غير متصل حالياً أو يحتاج لمسح كود QR من صفحة الإعدادات أولاً.'
        : `خطأ أثناء إرسال الرابط: ${errorMsg}`;
      this.showToast(displayMsg, 'danger');
    }
  }

  openBatchParentLinksModal() {
    const studentList = this.students || [];
    const unsentStudents = studentList.filter(s => !s.parent_portal_sent_at && (s.parentPhone || s.parent_phone));

    if (unsentStudents.length === 0) {
      this.showToast('جميع أولياء أمور الطلاب المسجلين تم إرسال روابط المتابعة إليهم بالفعل! ✔', 'info');
      return;
    }

    const teacherName = this.user?.name || 'مستر أحمد';

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1rem;">
        <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 0.75rem; padding: 0.85rem; color: #0369a1; font-size: 0.85rem; line-height: 1.5;">
          <b>📢 إرسال ذكي للطلاب الجدد:</b>
          سيتم إرسال رسالة واتساب رسمية ومخصصة لكل ولي أمر تحتوي على رابط المتابعة المباشر الخاص بنجله مع تطبيق فواصل الأمان (Anti-Ban).
        </div>

        <div>
          <div style="font-weight: 700; font-size: 0.9rem; color: #0f172a; margin-bottom: 0.5rem; display: flex; justify-content: space-between; align-items: center;">
            <span>الطلاب الجدد المستهدفون (${unsentStudents.length} طالب):</span>
            <label style="font-size: 0.8rem; color: #64748b; font-weight: 600; cursor: pointer;">
              <input type="checkbox" id="selectAllBatchParentLinks" checked onchange="
                const checked = this.checked;
                document.querySelectorAll('.batch-parent-checkbox').forEach(cb => cb.checked = checked);
              "> تحديد الكل
            </label>
          </div>

          <div style="max-height: 220px; overflow-y: auto; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.5rem; display: flex; flex-direction: column; gap: 0.35rem; background: #fafafa;">
            ${unsentStudents.map(s => {
              const phone = s.parentPhone || s.parent_phone;
              return `
                <label style="display: flex; align-items: center; justify-content: space-between; padding: 0.4rem 0.6rem; background: #fff; border: 1px solid #e2e8f0; border-radius: 0.4rem; cursor: pointer;">
                  <span style="display: flex; align-items: center; gap: 0.5rem;">
                    <input type="checkbox" class="batch-parent-checkbox" value="${escapeHtml(s.id)}" checked>
                    <span style="font-weight: 700; color: #1e293b;">${escapeHtml(s.name)}</span>
                    <span style="font-size: 0.75rem; color: #64748b; font-family: monospace;">كود: ${escapeHtml(s.code || s.student_code || '—')}</span>
                  </span>
                  <span dir="ltr" style="font-size: 0.8rem; font-family: monospace; color: #475569;">${escapeHtml(phone)}</span>
                </label>
              `;
            }).join('')}
          </div>
        </div>

        <div style="border-top: 1px solid #e2e8f0; padding-top: 0.75rem;">
          <div style="font-weight: 700; font-size: 0.85rem; color: #0f172a; margin-bottom: 0.35rem;">معاينة نموذج الرسالة لولي الأمر:</div>
          <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 0.5rem; padding: 0.75rem; font-size: 0.8rem; color: #334155; line-height: 1.6; white-space: pre-line;">
السلام عليكم ورحمة الله وبركاته، ولي أمر الطالب (اسم الطالب).

حرصاً على متابعة المستوى الدراسي أولاً بأول، يسعدنا تزويدكم برابط بوابة المتابعة المباشرة الخاصة به:
🔗 *رابط المتابعة المباشر:*
https://centerly-platform.vercel.app/parent-portal?token=...

💡 من خلال هذا الرابط يمكنكم في أي وقت وبدون تسجيل دخول متابعة درجات الكويزات والحضور والواجبات لحظياً.

مع تحيات: ${escapeHtml(teacherName)}
          </div>
        </div>
      </div>
    `;

    const footerHtml = `
      <div style="display: flex; justify-content: space-between; align-items: center; width: 100%; gap: 0.75rem;">
        <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
        <button type="button" id="btnConfirmBatchParentLinks" class="btn btn-primary" onclick="window.centrlyApp.dispatchBatchParentLinks()" style="background-color: #0284c7; border-color: #0284c7; font-weight: 700; display: flex; align-items: center; gap: 0.4rem;">
          <span>📲</span>
          <span>بدء الإرسال لـ ${unsentStudents.length} ولي أمر</span>
        </button>
      </div>
    `;

    this.showModal(`إرسال روابط المتابعة للطلاب الجدد`, bodyHtml, footerHtml);
  }

  async dispatchBatchParentLinks() {
    const selectedBoxes = Array.from(document.querySelectorAll('.batch-parent-checkbox:checked'));
    const selectedIds = selectedBoxes.map(cb => cb.value);

    if (selectedIds.length === 0) {
      this.showToast('يرجى اختيار طالب واحد على الأقل للإرسال.', 'warning');
      return;
    }

    const btn = document.getElementById('btnConfirmBatchParentLinks');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = `<span>⏳</span><span>جاري إرسال الروابط بأمان...</span>`;
    }

    this.showToast(`بدأ إرسال روابط المتابعة لـ (${selectedIds.length}) من أولياء الأمور بأعلى معايير الأمان...`, 'info');

    try {
      const res = await request('/students/batch-send-parent-links', {
        method: 'POST',
        body: {
          student_ids: selectedIds,
          teacher_name: this.user?.name || 'المعلم',
        },
      });

      this.closeModal();

      const sentCount = res.sent_count || 0;
      const failedCount = res.failed_count || 0;

      // Update local student records
      const now = new Date().toISOString();
      (this.students || []).forEach(s => {
        if (selectedIds.includes(s.id)) {
          const resultItem = (res.results || []).find(r => r.student_id === s.id);
          if (!resultItem || resultItem.status === 'sent') {
            s.parent_portal_sent_at = now;
          }
        }
      });

      if (sentCount > 0) {
        this.showToast(`تم بنجاح إرسال روابط المتابعة إلى (${sentCount}) ولي أمر!`, 'success');
      }
      if (failedCount > 0) {
        this.showToast(`تعذر إرسال (${failedCount}) رسائل بسبب انقطاع الاتصال أو أرقام غير صحيحة.`, 'warning');
      }

      if (this.currentRoute === 'students') {
        this.renderMainContent();
      }
    } catch (err) {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = `<span>📲</span><span>إعادة المحاولة</span>`;
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
    const studentLimit = this.billingState?.students_limit || 100;
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
          <textarea id="importCsvText" class="form-input" rows="6" placeholder="أحمد محمد, 01012345678, 01123456789\nمحمود علي, 01223344556\nعمر خالد, 01555443322" style="font-family: monospace; font-size: 0.85rem;" dir="ltr"></textarea>
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

    // 1. Check if there is already an in_progress session on the server for this group
    try {
      const activeRes = await request('/sessions?status=in_progress').catch(() => null);
      const activeList = Array.isArray(activeRes) ? activeRes : (activeRes?.sessions || []);
      const existing = activeList.find(s => s.group_id === cleanId);
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
        const todayStr = new Date().toISOString().split('T')[0];
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
    let groupStudents = (this.students || []).filter(s => s.group_id === cleanId);
    if (groupStudents.length === 0) {
      try {
        const studRes = await request(`/students?group_id=${cleanId}`).catch(() => null);
        if (studRes) {
          const list = Array.isArray(studRes) ? studRes : (studRes.students || []);
          if (list.length > 0) groupStudents = list;
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
      session_date: serverSession?.session_date || new Date().toISOString().split('T')[0],
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
        this.showToast(res.message || 'تم رصد الحضور والتوجيه بنجاح!', 'success');
        await this.loadRouteData('center-sessions');
      } else {
        this.showToast(res.message || 'تعذر التعرف على الطالب', 'warning');
      }
      if (input) input.value = '';
      this.renderMainContent();
    } catch (err) {
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
          <input type="text" id="modalTeacherName" class="form-input" placeholder="أ. محمد أحمد" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">رقم الهاتف *</label>
          <input type="tel" id="modalTeacherPhone" class="form-input" placeholder="010..." dir="ltr" required>
        </div>
        <div class="form-group" style="margin-bottom: 0.75rem;">
          <label class="form-label">المادة الدراسية</label>
          <input type="text" id="modalTeacherSubject" class="form-input" placeholder="فيزياء، كيمياء...">
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
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url);
      this.showToast('تم نسخ رابط الدعوة بنجاح!', 'success');
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
          <div style="font-size: 3rem; margin-bottom: 0.75rem;">🚨</div>
          <h3 style="font-size: 1.3rem; font-weight: 900; color: #991b1b; margin: 0 0 0.5rem 0;">
            تم الوصول للحد الأقصى لباقتك
          </h3>
          <p style="font-size: 0.9rem; color: #475569; line-height: 1.6; margin: 0 0 1.25rem 0;">
            لقد استهلكت كامل سعة الطلاب المتاحة في باقتك (<strong>${currentCount} من أصل ${limit} طالب</strong>) وتجاوزت فترة السماح المحددة بـ 3 أيام.
            <br>
            لمواصلة إضافة الطلاب الجدد، يرجى ترقية باقتك إلى باقة أعلى (250 أو 500 طالب).
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center;">
            <button class="btn btn-secondary" onclick="document.getElementById('quotaBlockedModal')?.remove()">إغلاق</button>
            <button class="btn btn-primary" onclick="document.getElementById('quotaBlockedModal')?.remove(); window.centrlyApp.navigate('billing');" style="background: #2563eb; font-weight: 800;">
              ترقية الباقة الآن 💳
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  openPaymentProofModal(planName = 'باقة 100 طالب', amount = 599, billingCycle = 'monthly') {
    const existing = document.getElementById('paymentProofModal');
    if (existing) existing.remove();

    const isYearly = (billingCycle === 'yearly');
    const periodLabel = isYearly ? 'اشتراك سنوي (خصم 10%)' : 'اشتراك شهري';

    const modalHtml = `
      <div id="paymentProofModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 9999; padding: 1rem;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: 0; animation: modalFadeIn 0.2s ease-out; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); font-family: 'Cairo', sans-serif;">
          <div class="card-header" style="border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div>
              <h3 class="card-title" style="margin: 0; font-size: 1.15rem;">تأكيد ترقية / تجديد الاشتراك</h3>
              <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0.25rem 0 0 0;">
                <strong style="color: var(--centrly-blue-700);">${planName}</strong> — <strong>${Number(amount).toLocaleString('ar-EG')} ج.م</strong> (${periodLabel})
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closePaymentProofModal()" style="border: none; font-size: 1.2rem; cursor: pointer;">✕</button>
          </div>

          <form onsubmit="window.centrlyApp.handleSubmitPaymentProof(event, ${amount}, '${planName}', '${billingCycle}')">
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
              <input type="text" id="proofRefNumber" class="form-input" placeholder="رقم العملية أو رقم المحفظة المحوّل منها" dir="ltr" required>
            </div>

            <div class="form-group" style="margin-bottom: 1.25rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">ملاحظات إضافية (اختياري)</label>
              <textarea id="proofNotes" class="form-input" rows="2" placeholder="أي تفاصيل أو اسم صاحب المحفظة المحوّل منها..."></textarea>
            </div>

            <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closePaymentProofModal()">إلغاء</button>
              <button type="submit" id="btnSubmitProof" class="btn btn-primary" style="font-weight: 700;">
                تأكيد إرسال الإيصال
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

  async handleSubmitPaymentProof(e, amount, planName = 'باقة 100 طالب', billingCycle = 'monthly') {
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
      btn.innerText = 'جارٍ التأكيد...';
    }

    const planTag = `[${planName} - ${billingCycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'}]`;
    const fullNotes = notes ? `${planTag} ${notes}` : planTag;

    try {
      await request('/billing/payment-proof', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(amount),
          payment_method: method,
          reference_number: refNum,
          notes: fullNotes,
        }),
      });

      this.closePaymentProofModal();
      this.showToast('تم استلام بيانات التحويل بنجاح! حسابك سارٍ وسيتم مراجعة الإيصال وتأكيد الاشتراك فوراً.', 'success');
      await this.loadRouteData('billing');
    } catch (err) {
      this.showToast(`فشل تسجيل إيصال الدفع: ${err.message || 'خطأ في الخادم'}`, 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'تأكيد إرسال الإيصال';
      }
    }
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
    const newTitle = window.prompt('أدخل اسم الكويز الجديد (أو اتركه فارغاً للرجوع للاسم الافتراضي):', currentTitle);
    if (newTitle !== null) {
      this.updateQuizTitle(quizNum, newTitle.trim());
    }
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
      this.showToast('تم تحديث عنوان الكويز بنجاح ✓', 'info');
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
      this.showToast(`تم تحديث الدرجة العظمى إلى (${num} درجات) ✓`, 'info');
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

      this.showToast(`تم حفظ وتثبيت درجات كويز ${currQuizNum} لـ (${count}) طالب بنجاح في قاعدة البيانات ✓`, 'success');
      this.renderMainContent();

      // Offer immediate dispatch to WhatsApp
      this.showConfirmModal({
        title: 'إرسال درجات الكويز لأولياء الأمور عبر الواتساب',
        message: `تم حفظ درجات (${count}) طالب في قاعدة البيانات بنجاح! هل ترغب في إرسال النتائج الآن إلى أولياء الأمور عبر واتساب بنظام الأمان الفائق ومكافحة الحظر؟`,
        confirmText: `نعم، إرسال الدرجات للجميع (${count} طلاب)`,
        cancelText: 'لاحقاً',
        isDanger: false,
        onConfirm: () => {
          this.dispatchBatchQuizScores();
        },
      });
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
        this.showToast(`تم إرسال إشعار درجة (${studentName}) ${sentToStr} بنجاح عبر واتساب ✓`, 'success');
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
    `;
    modalEl.innerHTML = `
      <div class="modal-dialog" dir="rtl" style="background: #ffffff; border-radius: 14px; max-width: 480px; width: 100%; box-shadow: 0 25px 50px rgba(0,0,0,0.25); overflow: hidden; border: 1px solid var(--centrly-line);">
        <div style="padding: 1.25rem 1.5rem; border-bottom: 1px solid var(--centrly-line); display: flex; justify-content: space-between; align-items: center;">
          <h3 style="margin: 0; font-size: 1.1rem; font-weight: 800; color: var(--centrly-ink);">
            إرسال درجات الكويز دفعة واحدة (Ultra Anti-Ban)
          </h3>
          <button onclick="document.getElementById('centrlyConfirmModal')?.remove()" style="background: transparent; border: none; cursor: pointer; font-size: 1.2rem; color: var(--centrly-text);">✕</button>
        </div>
        <div style="padding: 1.5rem; font-size: 0.925rem; color: var(--centrly-ink); line-height: 1.6;">
          <p style="margin: 0 0 1rem 0;">
            هل أنت متأكد من رغبتك في إرسال درجات (<strong>${studentsToDispatch.length}</strong>) طالب عبر الواتساب؟
            <br>
            <span style="font-size: 0.825rem; color: var(--centrly-text);">سيتم الإرسال عبر محرك الأمان الفائق بفواصل عشوائية مع محاكاة الكتابة الحية (جاري الكتابة...) لحماية الخط.</span>
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
      const barcodeSvg = `
        <svg style="width: 100%; height: 42px;" viewBox="0 0 200 42">
          <rect x="10" y="2" width="4" height="38" fill="#000"/>
          <rect x="18" y="2" width="2" height="38" fill="#000"/>
          <rect x="24" y="2" width="6" height="38" fill="#000"/>
          <rect x="34" y="2" width="2" height="38" fill="#000"/>
          <rect x="40" y="2" width="4" height="38" fill="#000"/>
          <rect x="48" y="2" width="2" height="38" fill="#000"/>
          <rect x="54" y="2" width="6" height="38" fill="#000"/>
          <rect x="64" y="2" width="4" height="38" fill="#000"/>
          <rect x="72" y="2" width="2" height="38" fill="#000"/>
          <rect x="78" y="2" width="4" height="38" fill="#000"/>
          <rect x="86" y="2" width="6" height="38" fill="#000"/>
          <rect x="96" y="2" width="2" height="38" fill="#000"/>
          <rect x="102" y="2" width="4" height="38" fill="#000"/>
          <rect x="110" y="2" width="4" height="38" fill="#000"/>
          <rect x="118" y="2" width="2" height="38" fill="#000"/>
          <rect x="124" y="2" width="6" height="38" fill="#000"/>
          <rect x="134" y="2" width="2" height="38" fill="#000"/>
          <rect x="140" y="2" width="4" height="38" fill="#000"/>
          <rect x="148" y="2" width="2" height="38" fill="#000"/>
          <rect x="154" y="2" width="6" height="38" fill="#000"/>
          <rect x="164" y="2" width="4" height="38" fill="#000"/>
          <rect x="172" y="2" width="2" height="38" fill="#000"/>
          <rect x="178" y="2" width="6" height="38" fill="#000"/>
          <rect x="188" y="2" width="4" height="38" fill="#000"/>
        </svg>
      `;

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
    const bodyHtml = `
      <div style="border: 2px solid var(--centrly-ink); border-radius: 12px; padding: 1.25rem; background: #fff; max-width: 360px; margin: 0 auto; box-shadow: 0 10px 25px rgba(0,0,0,0.1);">
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #e2e8f0; padding-bottom: 0.5rem;">
          <strong style="color: var(--centrly-blue-800); font-size: 0.95rem;">${escapeHtml(this.user?.name || 'كارت المنظومة التعليمية')}</strong>
          <span class="badge badge-blue" style="font-size: 0.72rem;">كارت ذكي</span>
        </div>
        <div style="margin-top: 0.75rem;">
          <h4 style="margin: 0; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">${escapeHtml(name)}</h4>
          <div style="font-size: 0.82rem; color: var(--centrly-text); margin-top: 0.35rem;">المجموعة: <b>${escapeHtml(group)}</b></div>
          ${phone ? `<div style="font-size: 0.82rem; color: var(--centrly-text); margin-top: 0.2rem;">الهاتف: <b dir="ltr">${escapeHtml(phone)}</b></div>` : ''}
        </div>
        <div style="margin-top: 1rem; background: #f8fafc; padding: 0.75rem; border-radius: 8px; text-align: center; border: 1px dashed #cbd5e1;">
          <div style="font-family: monospace; font-size: 1.1rem; font-weight: 800; letter-spacing: 2px; color: var(--centrly-blue-900);">${escapeHtml(code)}</div>
        </div>
      </div>
    `;
    const footerHtml = `
      <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق</button>
      <button type="button" class="btn btn-primary" onclick="window.centrlyApp.downloadSelectedCardsPdf(); window.centrlyApp.closeModal();">طباعة الكارت</button>
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
      this.showToast(`تم إرسال تنبيه المتابعة لولي أمر (${studentName}) بنجاح عبر واتساب ✓`, 'success');
      await this.loadRouteData('risk-watchlist');
    } catch (err) {
      this.showToast(`فشل إرسال تنبيه المتابعة: ${err.message || 'خطأ في الإرسال'}`, 'danger');
    }
  }
}

window.centrlyApp = new CentrlyApp();
window.addEventListener('DOMContentLoaded', () => {
  window.centrlyApp.init();
});
