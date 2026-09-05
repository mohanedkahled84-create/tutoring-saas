export function renderSidebar(currentRoute = 'sessions') {
  const routes = [
    { id: 'sessions', title: 'الحصص ولوحة المساعد', icon: '⚡' },
    { id: 'calendar', title: 'جدول الحصص والتقويم', icon: '📅' },
    { id: 'dashboard', title: 'لوحة المدرس والأرباح', icon: '📊' },
    { id: 'groups', title: 'المجاميع والسناتر', icon: '🏢' },
    { id: 'students', title: 'دليل الطلاب والتسجيل', icon: '👥' },
    { id: 'risk-watchlist', title: 'مؤشرات الخطر والإنذارات', icon: '⚠️' },
    { id: 'whatsapp', title: 'إعدادات الواتساب والقوالب', icon: '💬' },
    { id: 'billing', title: 'الاشتراك والباقات', icon: '💳' },
    { id: 'activity-logs', title: 'سجل النشاطات والأمان', icon: '🛡️' }
  ];

  return `
    <aside class="app-sidebar" id="appSidebar">
      <div class="sidebar-header">
        <div class="brand-logo-badge">سـ</div>
        <div>
          <div class="brand-name">سنترلي | Centrly</div>
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
