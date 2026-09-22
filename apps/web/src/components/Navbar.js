import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

export function renderNavbar(user, activeSessionSummary = null) {
  const isAdmin = user?.role === 'admin' || user?.is_superadmin;

  // Resolve raw name prioritizing full_name, name, teacher_name
  let rawName = (user?.full_name || user?.name || user?.teacher_name || '').trim();
  const emailPrefix = user?.email ? user.email.split('@')[0] : '';

  // If no name is set, or if it matches the email prefix (e.g. mohanedkahled84)
  if (!rawName || rawName === emailPrefix) {
    if (user?.email === 'mohanedkahled84@gmail.com') {
      rawName = 'أ. مهند خالد';
    } else if (isAdmin) {
      rawName = 'مهند خالد';
    } else if (user?.tenant_name) {
      const cleanTenant = user.tenant_name.replace(/\s*-\s*منظومة تعليمية.*/, '').trim();
      rawName = cleanTenant || 'أستاذ المادة';
    } else {
      rawName = 'أستاذ المادة';
    }
  }

  const isTeacher = !isAdmin && user?.role !== 'assistant' && user?.role !== 'center_owner' && user?.account_type !== 'center';
  let displayName = rawName;
  if (isTeacher && !displayName.startsWith('أ.') && !displayName.startsWith('أستاذ') && !displayName.startsWith('مستر') && !displayName.startsWith('د.') && displayName !== 'أستاذ المادة') {
    displayName = `أ. ${displayName}`;
  }

  const roleName = isAdmin ? 'المدير والمؤسس (Centrly HQ)' : (user?.role === 'assistant' ? 'مساعد' : (user?.role === 'center_owner' || user?.account_type === 'center' ? 'مسؤول السنتر' : 'مدرس'));

  // Clean avatar letter - omit title prefix so "أ. مهند" gives avatar "م"
  const cleanNameForAvatar = displayName.replace(/^(أ\.\s*|مستر\s*|د\.\s*|أستاذ\s*)/, '').trim();
  const avatarLetter = (cleanNameForAvatar.charAt(0) || displayName.charAt(0) || 'م').toUpperCase();

  return `
    <header class="app-topbar">
      <div class="topbar-start" style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: nowrap; min-width: 0;">
        <button 
          class="btn btn-secondary btn-sm" 
          id="sidebarToggle" 
          onclick="window.centrlyApp.toggleSidebar()" 
          style="align-items: center; justify-content: center; padding: 0.45rem 0.65rem; flex-shrink: 0; min-width: 38px; height: 38px;"
          aria-label="القائمة الرئيسية"
          title="القائمة الرئيسية"
        >
          ${getIcon('menu', 20)}
        </button>
        ${isAdmin ? '<span class="badge topbar-admin-badge" style="background: #1e293b; color: #f8fafc; font-weight: 700; border: 1px solid #334155; flex-shrink: 0;">لوحة المؤسس (Centrly HQ)</span>' : ''}

        <div id="navLiveSessionBadgeContainer" style="display: inline-flex; align-items: center; min-width: 0;">
          ${(activeSessionSummary && !isAdmin) ? renderNavLiveBadgeHtml(activeSessionSummary) : ''}
        </div>
      </div>

      <div class="topbar-actions" style="display: flex; align-items: center; gap: 0.65rem; flex-shrink: 0;">
        <div class="topbar-user-info" style="text-align: left;">
          <div class="topbar-user-name" style="font-weight: 700; font-size: 0.875rem; white-space: nowrap;">${displayName}</div>
          <div class="topbar-user-role" style="font-size: 0.72rem; color: var(--centrly-text); white-space: nowrap;">${roleName}</div>
        </div>
        <div class="topbar-avatar" style="width: 38px; height: 38px; border-radius: var(--radius-full); background-color: var(--centrly-blue-100); color: var(--centrly-blue-800); display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">
          ${avatarLetter}
        </div>
      </div>
    </header>
  `;
}

export function renderNavLiveBadgeHtml(activeSessionSummary) {
  if (!activeSessionSummary) return '';
  const groupName = escapeHtml(activeSessionSummary.groupName || 'حصة جارية');
  const count = activeSessionSummary.attendeeCount || 0;

  return `
    <button 
      type="button" 
      onclick="window.centrlyApp.navigate('sessions')" 
      class="btn btn-sm nav-live-session-btn"
      title="حصة نشطة حالياً: ${groupName} (${count} حضور) - اضغط للمتابعة ورصد الحضور"
    >
      <span class="nav-live-dot"></span>
      <span class="nav-live-text-desktop">حصة جارية: <b>${groupName}</b> (${count} حضور)</span>
      <span class="nav-live-text-mobile">حصة جارية (${count})</span>
    </button>
  `;
}

