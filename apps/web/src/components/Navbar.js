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
      <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
        <button class="btn btn-secondary btn-sm" id="sidebarToggle" onclick="window.centrlyApp.toggleSidebar()" style="align-items: center; justify-content: center; padding: 0.4rem 0.6rem;">
          ${getIcon('menu', 20)}
        </button>
        ${isAdmin ? '<span class="badge" style="background: #1e293b; color: #f8fafc; font-weight: 700; border: 1px solid #334155;">لوحة المؤسس المستقلة (Centrly HQ)</span>' : ''}

        <div id="navLiveSessionBadgeContainer">
          ${activeSessionSummary ? `
            <button 
              type="button" 
              onclick="window.centrlyApp.navigate('sessions')" 
              class="btn btn-sm"
              style="display: inline-flex; align-items: center; gap: 0.45rem; background: #fef2f2; color: #b91c1c; border: 1.5px solid #f87171; border-radius: 9999px; padding: 0.35rem 0.85rem; font-size: 0.8rem; font-weight: 800; cursor: pointer; animation: centrlyPulse 2s infinite;"
              title="حصة نشطة حالياً - اضغط للمتابعة ورصد الحضور"
            >
              <span style="width: 9px; height: 9px; border-radius: 50%; background: #ef4444; display: inline-block;"></span>
              <span>حصة جارية: <b>${escapeHtml(activeSessionSummary.groupName)}</b> (${activeSessionSummary.attendeeCount || 0} حضور)</span>
            </button>
          ` : ''}
        </div>
      </div>

      <div class="topbar-actions" style="display: flex; align-items: center; gap: 0.85rem;">
        <div style="text-align: left;">
          <div style="font-weight: 700; font-size: 0.875rem;">${displayName}</div>
          <div style="font-size: 0.75rem; color: var(--centrly-text);">${roleName}</div>
        </div>
        <div style="width: 38px; height: 38px; border-radius: var(--radius-full); background-color: var(--centrly-blue-100); color: var(--centrly-blue-800); display: flex; align-items: center; justify-content: center; font-weight: 700;">
          ${avatarLetter}
        </div>
      </div>
    </header>
  `;
}
