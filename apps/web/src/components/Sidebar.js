import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

export function renderSidebar(currentRoute = 'sessions', user = {}, securityState = { hasPin: false, isUnlocked: true }) {
  const isAdmin = user?.role === 'admin';
  const isCenterOwner = user?.role === 'center_owner' || user?.account_type === 'center';
  // Dedicated Executive Superadmin HQ Navigation (100% separate for the platform owner)
  const adminSections = [
    {
      category: 'إدارة المنظومة (Centrly HQ)',
      routes: [
        { id: 'admin-dashboard', title: 'لوحة الإحصائيات والأرباح', icon: 'dashboard' },
        { id: 'admin-proofs', title: 'مراجعة إيصالات الدفع', icon: 'billing' },
        { id: 'admin-tenants', title: 'المشتركين والمعلمين والسناتر', icon: 'teachers' },
        { id: 'whatsapp-inbox', title: 'محادثات الواتساب وحاسبة الأرباح', icon: 'whatsapp' },
        { id: 'admin-outreach', title: 'حملات التواصل (Outreach)', icon: 'whatsapp' },
        { id: 'coupons', title: 'أكواد الخصم والكوبونات', icon: 'billing' },
      ],
    },
    {
      category: 'منصتي والتعليم الذكي (تجربة المعلم PRO)',
      routes: [
        { id: 'platform-builder', title: 'إنشاء وتخصيص منصتك', icon: 'globe', isPro: true },
        { id: 'video-lessons', title: 'فيديوهات الشرح والحل', icon: 'video', isPro: true },
        { id: 'quizzes', title: 'الكويزات والامتحانات الشاملة', icon: 'reports', isPro: true },
        { id: 'sessions', title: 'بدء حصة ورصد الحضور', icon: 'sessions' },
        { id: 'homework', title: 'مراجعة وتصحيح الواجبات', icon: 'homework' },
        { id: 'materials', title: 'المذكرات والماتريال', icon: 'materials' },
      ],
    },
    {
      category: 'الرقابة والأمان العام',
      routes: [
        { id: 'activity-logs', title: 'سجل نشاطات المنصة', icon: 'activity' },
      ],
    },
  ];

  // Dedicated Center Navigation grouped logically by daily operations, academics, and administration
  const centerSections = [
    {
      category: 'تشغيل السنتر والقاعات',
      routes: [
        { id: 'center-sessions', title: 'الحصص والقاعات الجارية', icon: 'sessions' },
        { id: 'center-dashboard', title: 'لوحة السنتر والإيرادات', icon: 'center' },
        { id: 'center-rooms', title: 'القاعات والمختبرات', icon: 'rooms' },
      ],
    },
    {
      category: 'المدرسين وفريق العمل والطلاب',
      routes: [
        { id: 'center-teachers', title: 'المدرسين المعتمدين', icon: 'teachers' },
        { id: 'center-assistants', title: 'المساعدين وفريق الاستقبال', icon: 'assistants' },
        { id: 'groups', title: 'مجاميع السنتر الدراسية', icon: 'groups' },
        { id: 'students', title: 'دليل الطلاب والتسجيل', icon: 'students' },
        { id: 'calendar', title: 'جدول السنتر الشامل', icon: 'calendar' },
        { id: 'student-cards', title: 'طلب كروت طلاب السنتر', icon: 'cards' },
      ],
    },
    {
      category: 'الإدارة والماليات',
      routes: [
        { id: 'settings', title: 'الإعدادات والاشتراك', icon: 'gear' },
        { id: 'activity-logs', title: 'تسويات المدرسين والماليات', icon: 'billing' },
      ],
    },
  ];

  // Dedicated Teacher Navigation grouped strictly by operational priority:
  // 1. Daily in-class actions (Sessions, Manual Quiz Grades, Homework, Materials) - Basic tier
  // 2. Pro Platform & Smart LMS (Platform Builder, Video Lessons, Electronic Exams) - PRO tier
  // 3. Students & Classes management (Students, Groups, Calendar, Cards)
  // 4. Analytics & Financials (Earnings Dashboard, Reports, Risk Watchlist)
  // 5. Administration & Settings (Assistants, WhatsApp, Billing, Activity)
  const teacherDailyRoutes = [
    { id: 'sessions', title: 'بدء حصة ورصد الحضور', icon: 'sessions' },
    { id: 'homework', title: 'مراجعة وتصحيح الواجبات', icon: 'homework' },
    { id: 'materials', title: 'المذكرات والماتريال', icon: 'materials' },
  ];

  const teacherSections = [
    {
      category: 'العمليات اليومية للحصة',
      routes: teacherDailyRoutes,
    },
    {
      category: 'منظومة الكويزات والامتحانات',
      routes: [
        { id: 'online-quizzes', title: 'الكويزات الإلكترونية (أونلاين)', icon: 'edit' },
        { id: 'paper-exams', title: 'الامتحانات الورقية وبابل شيت', icon: 'print', badge: 'قريباً' },
        { id: 'quizzes', title: 'رصد درجات الكويزات يدوياً', icon: 'reports' },
      ],
    },
    ...([
      {
        category: 'منصتي والتعليم الذكي (PRO)',
        routes: [
          { id: 'platform-builder', title: 'إنشاء منصتك المستقلة', icon: 'globe', isPro: true },
          { id: 'video-lessons', title: 'فيديوهات الشرح والحل', icon: 'video', isPro: true },
        ],
      }
    ]),
    {
      category: 'إدارة الطلاب والمجاميع وفريق العمل',
      routes: [
        { id: 'students', title: 'دليل طلابي', icon: 'students' },
        { id: 'groups', title: 'مجاميعي الدراسية', icon: 'groups' },
        { id: 'assistants', title: 'إدارة المساعدين (الأسستنت)', icon: 'assistants' },
        { id: 'calendar', title: 'جدول الحصص والتقويم', icon: 'calendar' },
        { id: 'student-cards', title: 'طلب كروت الطلاب', icon: 'cards' },
      ],
    },
    {
      category: 'الأرباح والتقارير الأكاديمية',
      routes: [
        { id: 'dashboard', title: 'لوحة المعلم والأرباح', icon: 'dashboard' },
        { id: 'reports', title: 'الدرجات ولوحة الشرف', icon: 'reports' },
        { id: 'risk-watchlist', title: 'مؤشرات الخطر والإنذارات', icon: 'risk' },
      ],
    },
    {
      category: 'الإعدادات والاشتراك',
      routes: [
        { id: 'settings', title: 'الإعدادات والاشتراك', icon: 'gear' },
      ],
    },
  ];

  const baseSections = isCenterOwner ? centerSections : teacherSections;
  // When user is Admin, show ONLY the dedicated admin sections — zero teacher clutter!
  const sections = isAdmin ? adminSections : baseSections;

  return `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-header" style="position: relative; flex-shrink: 0; padding: 0.85rem 1rem; border-bottom: 1px solid var(--centrly-line); display: flex; align-items: center; gap: 0.65rem;">
        <div class="brand-logo-badge" style="background: #0f172a; border-radius: 6px; width: 34px; height: 34px; display: flex; align-items: center; justify-content: center; box-shadow: 0 1px 2px rgba(0,0,0,0.05); flex-shrink: 0;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" fill="#F59E0B"/>
            <path d="M12 15L3 10.09L12 5.18L21 10.09L12 15Z" fill="#FFFFFF" fill-opacity="0.95"/>
          </svg>
        </div>
        <div style="flex: 1; min-width: 0;">
          <div class="brand-name" style="font-size: 1.02rem; font-weight: 800; color: #0f172a; display: flex; align-items: center; gap: 4px;">
            <span>سنترلي</span>
            <span style="font-size: 0.72rem; font-weight: 600; color: #64748b;">| Centrly</span>
          </div>
          <div class="brand-tagline" style="font-size: 0.68rem; color: #64748b; font-weight: 500; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">
            ${isAdmin ? 'لوحة الإدارة المركزية' : (isCenterOwner ? 'منظومة إدارة السنتر' : 'المنظومة الذكية لإدارة الحصص')}
          </div>
        </div>
        <button class="mobile-close-btn" onclick="window.centrlyApp.toggleSidebar()" style="display: none; background: transparent; border: none; cursor: pointer; color: var(--centrly-text); padding: 0.25rem;">
          ${getIcon('close', 20)}
        </button>
      </div>

      <nav class="sidebar-nav" style="padding: 0.5rem 0.6rem; overflow-y: auto; overflow-x: hidden; -webkit-overflow-scrolling: touch; overscroll-behavior: contain; touch-action: pan-y; flex: 1 1 0%; min-height: 0;">
        ${sections.map((sec, secIdx) => `
          <div class="sidebar-section" style="${secIdx > 0 ? 'margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;' : ''}">
            <div style="font-size: 0.68rem; font-weight: 800; color: #94a3b8; padding: 0.3rem 0.6rem; display: flex; align-items: center; justify-content: space-between; letter-spacing: 0.02em;">
              <span>${escapeHtml(sec.category)}</span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 2px;">
              ${sec.routes.map(r => {
                const isActive = currentRoute === r.id;
                const isLocked = Boolean(securityState?.hasPin && !securityState?.isUnlocked && ['assistants', 'dashboard'].includes(r.id));
                return `
                  <button class="nav-link ${isActive ? 'active' : ''}" onclick="window.centrlyApp.navigate('${r.id}')" 
                    style="position: relative; display: flex; align-items: center; gap: 0.65rem; border-radius: 6px; padding: 0.48rem 0.7rem; border: none; width: 100%; cursor: pointer; text-align: right; transition: all 0.12s ease;">
                    <span class="nav-icon" style="display: inline-flex; align-items: center; justify-content: center;">
                      ${getIcon(r.icon, 16, 'currentColor')}
                    </span>
                    <span class="nav-title" style="font-size: 0.82rem; flex: 1; display: flex; align-items: center; justify-content: space-between;">
                      <span>${escapeHtml(r.title)}</span>
                      ${r.isPro ? `<span style="background: ${isActive ? '#1e293b' : '#fef3c7'}; color: ${isActive ? '#fde68a' : '#b45309'}; border: 1px solid ${isActive ? '#334155' : '#fde68a'}; font-size: 0.62rem; font-weight: 800; padding: 1px 5px; border-radius: 4px; letter-spacing: 0.5px;">PRO</span>` : ''}
                      ${r.badge ? `<span style="background: ${isActive ? '#1e293b' : '#f1f5f9'}; color: ${isActive ? '#f8fafc' : '#64748b'}; border: 1px solid ${isActive ? '#334155' : '#e2e8f0'}; font-size: 0.62rem; font-weight: 700; padding: 1px 6px; border-radius: 4px;">${escapeHtml(r.badge)}</span>` : ''}
                    </span>
                    ${isLocked ? `<span title="محمي برمز الأمان (PIN)" style="display: inline-flex; align-items: center; margin-right: 0.35rem; opacity: 0.85;">${getIcon('lock', 12, isActive ? '#fde68a' : '#f59e0b')}</span>` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </nav>

      <div class="sidebar-footer" style="padding: 0.85rem 1rem; border-top: 1px solid var(--centrly-line); flex-shrink: 0; background: var(--centrly-white);">
        <button class="btn btn-secondary btn-sm" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" onclick="window.centrlyApp.promptLogout()">
          ${getIcon('close', 16)}
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  `;
}
