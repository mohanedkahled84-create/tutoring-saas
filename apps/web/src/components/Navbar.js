import { getIcon } from '../utils/icons.js';

export function renderNavbar(user) {
  const isAdmin = user?.role === 'admin' || user?.is_superadmin;
  const userName = isAdmin ? (user?.full_name || user?.name || 'مهند خالد') : (user?.name || user?.email?.split('@')[0] || 'المستخدم');
  const roleName = isAdmin ? 'المدير والمؤسس (Centrly HQ)' : (user?.role === 'assistant' ? 'مساعد' : (user?.role === 'center_owner' || user?.account_type === 'center' ? 'مسؤول السنتر' : 'مدرس'));

  return `
    <header class="app-topbar">
      <div style="display: flex; align-items: center; gap: 1rem;">
        <button class="btn btn-secondary btn-sm" id="sidebarToggle" onclick="window.centrlyApp.toggleSidebar()" style="align-items: center; justify-content: center; padding: 0.4rem 0.6rem;">
          ${getIcon('menu', 20)}
        </button>
        ${isAdmin ? '<span class="badge" style="background: #1e293b; color: #f8fafc; font-weight: 700; border: 1px solid #334155;">لوحة المؤسس المستقلة (Centrly HQ)</span>' : '<span class="badge badge-blue">سحابي • RTL مفعّل</span>'}
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
