import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

export function renderSidebar(currentRoute = 'sessions', user = {}) {
  const isCenterOwner = user?.role === 'center_owner' || user?.account_type === 'center';

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
      category: 'المدرسين والطلاب',
      routes: [
        { id: 'center-teachers', title: 'المدرسين المعتمدين', icon: 'teachers' },
        { id: 'groups', title: 'مجاميع السنتر الدراسية', icon: 'groups' },
        { id: 'students', title: 'دليل الطلاب والتسجيل', icon: 'students' },
        { id: 'calendar', title: 'جدول السنتر الشامل', icon: 'calendar' },
        { id: 'student-cards', title: 'طلب كروت طلاب السنتر', icon: 'cards' },
      ],
    },
    {
      category: 'الإدارة والماليات',
      routes: [
        { id: 'center-assistants', title: 'المساعدين وفريق الاستقبال', icon: 'assistants' },
        { id: 'activity-logs', title: 'تسويات المدرسين والماليات', icon: 'billing' },
        { id: 'whatsapp', title: 'الواتساب والربط', icon: 'whatsapp' },
        { id: 'billing', title: 'الاشتراك والباقات', icon: 'billing' },
      ],
    },
  ];

  // Dedicated Teacher Navigation grouped strictly by operational priority:
  // 1. Daily in-class actions (Sessions, Quizzes, Homework, Materials) - Most frequent
  // 2. Students & Classes management (Students, Groups, Calendar, Cards)
  // 3. Analytics & Financials (Earnings Dashboard, Reports, Risk Watchlist)
  // 4. Administration & Settings (Assistants, WhatsApp, Billing, Activity)
  const teacherSections = [
    {
      category: 'العمليات اليومية للحصة',
      routes: [
        { id: 'sessions', title: 'بدء حصة ورصد الحضور', icon: 'sessions' },
        { id: 'quizzes', title: 'الكويزات والامتحانات', icon: 'reports' },
        { id: 'homework', title: 'مراجعة وتصحيح الواجبات', icon: 'homework' },
        { id: 'materials', title: 'المذكرات والماتريال', icon: 'materials' },
      ],
    },
    {
      category: 'إدارة الطلاب والمجاميع',
      routes: [
        { id: 'students', title: 'دليل طلابي', icon: 'students' },
        { id: 'groups', title: 'مجاميعي الدراسية', icon: 'groups' },
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
      category: 'الإعدادات وفريق العمل',
      routes: [
        { id: 'assistants', title: 'إدارة المساعدين (الأسستنت)', icon: 'assistants' },
        { id: 'whatsapp', title: 'الواتساب والربط', icon: 'whatsapp' },
        { id: 'billing', title: 'الاشتراك والباقات', icon: 'billing' },
        { id: 'activity-logs', title: 'سجل النشاطات والأمان', icon: 'activity' },
      ],
    },
  ];

  const sections = isCenterOwner ? centerSections : teacherSections;

  return `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-header" style="position: relative;">
        <div class="brand-logo-badge" style="background: linear-gradient(135deg, #1e3a8a, #2563eb); border-radius: 10px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" fill="#F59E0B"/>
            <path d="M12 15L3 10.09L12 5.18L21 10.09L12 15Z" fill="#FFFFFF" fill-opacity="0.95"/>
          </svg>
        </div>
        <div style="flex: 1;">
          <div class="brand-name" style="font-family: 'Changa', sans-serif; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">
            <span style="color: var(--centrly-blue-700);">سنتر</span><span style="color: #f59e0b;">لي</span>
            <span style="font-size: 0.82rem; font-weight: 600; color: var(--centrly-text);">| Centrly</span>
          </div>
          <div class="brand-tagline" style="font-size: 0.72rem; color: var(--centrly-text); font-weight: 500;">
            ${isCenterOwner ? 'منظومة إدارة السنتر والقاعات' : 'المنظومة الذكية لإدارة الحصص'}
          </div>
          <div>
            <span class="badge ${isCenterOwner ? 'badge-blue' : 'badge-warning'}" style="font-size: 0.65rem; padding: 0.15rem 0.5rem; margin-top: 0.2rem; display: inline-block;">
              ${isCenterOwner ? 'حساب سنتر تعليمي' : 'حساب مدرس'}
            </span>
          </div>
        </div>
        <button class="mobile-close-btn" onclick="window.centrlyApp.toggleSidebar()" style="display: none; background: transparent; border: none; cursor: pointer; color: var(--centrly-text); padding: 0.25rem;">
          ${getIcon('close', 20)}
        </button>
      </div>

      <nav class="sidebar-nav" style="padding: 0.5rem 0.6rem; overflow-y: auto;">
        ${sections.map((sec, secIdx) => `
          <div class="sidebar-section" style="${secIdx > 0 ? 'margin-top: 0.85rem; padding-top: 0.65rem; border-top: 1px solid #f1f5f9;' : ''}">
            <div style="font-size: 0.68rem; font-weight: 800; color: #94a3b8; padding: 0.3rem 0.6rem; display: flex; align-items: center; justify-content: space-between; letter-spacing: 0.02em;">
              <span>${escapeHtml(sec.category)}</span>
            </div>
            
            <div style="display: flex; flex-direction: column; gap: 2px; margin-top: 2px;">
              ${sec.routes.map(r => {
                const isActive = currentRoute === r.id;
                return `
                  <button class="nav-link ${isActive ? 'active' : ''}" onclick="window.centrlyApp.navigate('${r.id}')" 
                    style="position: relative; display: flex; align-items: center; gap: 0.7rem; background: ${isActive ? '#eff6ff' : 'transparent'}; border-radius: 8px; padding: 0.55rem 0.75rem; border: none; width: 100%; cursor: pointer; text-align: right; transition: background 0.15s ease;">
                    <span class="nav-icon" style="display: inline-flex; align-items: center; justify-content: center; color: ${isActive ? 'var(--centrly-blue-700)' : '#64748b'};">
                      ${getIcon(r.icon, 18)}
                    </span>
                    <span style="font-weight: ${isActive ? '800' : '600'}; color: ${isActive ? 'var(--centrly-blue-800)' : '#334155'}; font-size: 0.875rem; flex: 1;">
                      ${escapeHtml(r.title)}
                    </span>
                    ${isActive ? `<span class="active-indicator" style="width: 3.5px; height: 18px; border-radius: 4px; background: var(--centrly-blue-700); position: absolute; right: 0;"></span>` : ''}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        `).join('')}
      </nav>

      <div style="padding: 0.85rem 1rem; border-top: 1px solid var(--centrly-line);">
        <button class="btn btn-secondary btn-sm" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" onclick="window.centrlyApp.promptLogout()">
          ${getIcon('close', 16)}
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  `;
}
