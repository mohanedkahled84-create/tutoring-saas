export function renderNavbar(user) {
  const userName = user?.name || user?.email?.split('@')[0] || 'المدرس';
  const roleName = user?.role === 'admin' ? 'مدير النظام' : (user?.role === 'assistant' ? 'مساعد' : 'مدرس');

  return `
    <header class="app-topbar">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button class="btn btn-secondary btn-sm" id="sidebarToggle" onclick="window.centrlyApp.toggleSidebar()" style="display: none;">
          ☰
        </button>
        <span class="badge badge-blue">سحابي • RTL مفعّل</span>
      </div>

      <div class="topbar-actions">
        <div style="text-align: left;">
          <div style="font-weight: 700; font-size: 0.875rem;">${userName}</div>
          <div style="font-size: 0.75rem; color: var(--centrly-text);">${roleName}</div>
        </div>
        <div style="width: 38px; height: 38px; border-radius: var(--radius-full); background-color: var(--centrly-blue-100); color: var(--centrly-blue-800); display: flex; align-items: center; justify-content: center; font-weight: 700;">
          ${userName.charAt(0).toUpperCase()}
        </div>
      </div>
    </header>
  `;
}
