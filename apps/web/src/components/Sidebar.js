import { getIcon } from '../utils/icons.js';

export function renderSidebar(currentRoute = 'sessions', user = {}) {
  const isCenterOwner = user?.role === 'center_owner' || user?.account_type === 'center';

  // Dedicated Center Navigation
  const centerRoutes = [
    { id: 'center-dashboard', title: 'لوحة السنتر والإيرادات', icon: 'center' },
    { id: 'groups', title: 'مجاميع السنتر والقاعات', icon: 'groups' },
    { id: 'calendar', title: 'جدول السنتر الشامل', icon: 'calendar' },
    { id: 'students', title: 'دليل الطلاب والتسجيل', icon: 'students' },
    { id: 'student-cards', title: 'طلب كروت طلاب السنتر', icon: 'cards' },
    { id: 'whatsapp', title: 'واتساب السنتر العام', icon: 'whatsapp' },
    { id: 'billing', title: 'الاشتراك والباقات', icon: 'billing' },
    { id: 'activity-logs', title: 'سجل الخزينة والعمليات', icon: 'activity' },
  ];

  // Dedicated Teacher Navigation
  const teacherRoutes = [
    { id: 'dashboard', title: 'لوحة المعلم والأرباح', icon: 'dashboard' },
    { id: 'sessions', title: 'بدء حصة ورصد الحضور', icon: 'sessions' },
    { id: 'groups', title: 'مجاميعي الدراسية', icon: 'groups' },
    { id: 'students', title: 'دليل طلابي', icon: 'students' },
    { id: 'calendar', title: 'جدول الحصص والتقويم', icon: 'calendar' },
    { id: 'student-cards', title: 'طلب كروت الطلاب', icon: 'cards' },
    { id: 'reports', title: 'الدرجات ولوحة الشرف', icon: 'reports' },
    { id: 'risk-watchlist', title: 'مؤشرات الخطر والإنذارات', icon: 'risk' },
    { id: 'whatsapp', title: 'واتساب المعلم المخصص', icon: 'whatsapp' },
    { id: 'billing', title: 'الاشتراك والباقات', icon: 'billing' },
    { id: 'activity-logs', title: 'سجل النشاطات والأمان', icon: 'activity' },
  ];

  const routes = isCenterOwner ? centerRoutes : teacherRoutes;

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
      <nav class="sidebar-nav">
        ${routes.map(r => {
          const isActive = currentRoute === r.id;
          return `
            <button class="nav-link ${isActive ? 'active' : ''}" onclick="window.centrlyApp.navigate('${r.id}')" style="position: relative; display: flex; align-items: center; gap: 0.75rem; background: ${isActive ? '#eff6ff' : 'transparent'}; border-radius: 8px; margin: 2px 0;">
              <span class="nav-icon" style="display: inline-flex; align-items: center; justify-content: center; color: ${isActive ? 'var(--centrly-blue-700)' : 'var(--centrly-text)'};">
                ${getIcon(r.icon, 20)}
              </span>
              <span style="font-weight: ${isActive ? '700' : '500'}; color: ${isActive ? 'var(--centrly-blue-800)' : 'inherit'}; flex: 1; text-align: right;">${r.title}</span>
              ${isActive ? `<span class="active-indicator" style="width: 4px; height: 20px; border-radius: 4px; background: var(--centrly-blue-700); position: absolute; right: 0;"></span>` : ''}
            </button>
          `;
        }).join('')}
      </nav>
      <div style="padding: 1rem; border-top: 1px solid var(--centrly-line);">
        <button class="btn btn-secondary btn-sm" style="width: 100%; display: flex; align-items: center; justify-content: center; gap: 0.5rem;" onclick="window.centrlyApp.promptLogout()">
          ${getIcon('close', 16)}
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  `;
}
