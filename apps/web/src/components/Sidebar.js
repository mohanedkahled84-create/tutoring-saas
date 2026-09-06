export function renderSidebar(currentRoute = 'sessions', user = {}) {
  const isCenterOwner = user?.role === 'center_owner' || user?.account_type === 'center';
  const routes = [
    { id: 'sessions', title: 'الحصص ولوحة المساعد', icon: '⚡' },
    { id: 'calendar', title: 'جدول الحصص والتقويم', icon: '📅' },
    ...(isCenterOwner ? [{ id: 'center-dashboard', title: 'إدارة السنتر والقاعات', icon: '🏛️' }] : []),
    { id: 'dashboard', title: 'لوحة المدرس والأرباح', icon: '📊' },
    { id: 'groups', title: 'المجاميع والسناتر', icon: '🏢' },
    { id: 'students', title: 'دليل الطلاب والتسجيل', icon: '👥' },
    { id: 'reports', title: 'تقارير الأداء ولوحة التميز', icon: '🏆' },
    { id: 'risk-watchlist', title: 'مؤشرات الخطر والإنذارات', icon: '⚠️' },
    { id: 'whatsapp', title: 'إعدادات الواتساب والقوالب', icon: '💬' },
    { id: 'billing', title: 'الاشتراك والباقات', icon: '💳' },
    { id: 'activity-logs', title: 'سجل النشاطات والأمان', icon: '🛡️' }
  ];

  return `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-header">
        <div class="brand-logo-badge" style="background: linear-gradient(135deg, #1e3a8a, #2563eb); border-radius: 10px; width: 42px; height: 42px; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(37,99,235,0.3);">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M12 3L1 9L12 15L21 10.09V17H23V9M5 13.18V17.18L12 21L19 17.18V13.18L12 17L5 13.18Z" fill="#F59E0B"/>
            <path d="M12 15L3 10.09L12 5.18L21 10.09L12 15Z" fill="#FFFFFF" fill-opacity="0.95"/>
          </svg>
        </div>
        <div>
          <div class="brand-name" style="font-family: 'Changa', sans-serif; font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink);">
            <span style="color: var(--centrly-blue-700);">سنتر</span><span style="color: #f59e0b;">لي</span>
            <span style="font-size: 0.82rem; font-weight: 600; color: var(--centrly-text);">| Centrly</span>
          </div>
          <div class="brand-tagline">المنظومة الذكية لإدارة الحصص</div>
        </div>
      </div>
      <nav class="sidebar-nav">
        ${routes.map(r => `
          <button class="nav-link ${currentRoute === r.id ? 'active' : ''}" onclick="window.centrlyApp.navigate('${r.id}')">
            <span>${r.icon}</span>
            <span>${r.title}</span>
          </button>
        `).join('')}
      </nav>
      <div style="padding: 1rem; border-top: 1px solid var(--centrly-line);">
        <button class="btn btn-secondary btn-sm" style="width: 100%;" onclick="window.centrlyApp.logout()">
          <span>🚪</span>
          <span>تسجيل الخروج</span>
        </button>
      </div>
    </aside>
  `;
}
