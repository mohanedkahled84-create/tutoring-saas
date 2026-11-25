import { renderLanguageButton } from '../utils/language.js?v=9.99.1';
import { getIcon } from '../utils/icons.js?v=9.99.1';
import { escapeHtml } from '../utils/escapeHtml.js?v=9.99.1';
import { getLocale } from '../utils/locale.js?v=9.99.1';

export function renderNavbar(user, activeSessionSummary = null) {
  const isAdmin = user?.role === 'admin';
  const en = getLocale() === 'en';

  // Resolve raw name prioritizing full_name, name, teacher_name
  let rawName = (user?.full_name || user?.name || user?.teacher_name || '').trim();
  const emailPrefix = user?.email ? user.email.split('@')[0] : '';

  // If no name is set, or if it matches the email prefix (e.g. mohanedkahled84)
  if (!rawName || rawName === emailPrefix) {
    if (isAdmin) {
      rawName = en ? 'Platform administration' : 'إدارة المنظومة';
    } else if (user?.tenant_name) {
      const cleanTenant = user.tenant_name.replace(/\s*-\s*منظومة تعليمية.*/, '').trim();
      rawName = cleanTenant || (en ? 'Teacher' : 'أستاذ المادة');
    } else {
      rawName = en ? 'Teacher' : 'أستاذ المادة';
    }
  }

  const isTeacher = !isAdmin && user?.role !== 'assistant' && user?.role !== 'center_owner' && user?.account_type !== 'center';
  let displayName = rawName;
  if (!en && isTeacher && !displayName.startsWith('أ.') && !displayName.startsWith('أستاذ') && !displayName.startsWith('مستر') && !displayName.startsWith('د.') && displayName !== 'أستاذ المادة') {
    displayName = `أ. ${displayName}`;
  }

  const roleName = user?.delegated_actor ? `${en?'Assistant':'مساعد'}: ${user.delegated_actor.name}` : isAdmin ? (en?'Founder (Centrly HQ)':'المدير والمؤسس (Centrly HQ)') : (user?.role === 'assistant' ? (en?'Assistant':'مساعد') : (user?.role === 'center_owner' || user?.account_type === 'center' ? (en?'Center manager':'مسؤول السنتر') : (en?'Teacher':'مدرس')));

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
          aria-label="${en?'Main menu':'القائمة الرئيسية'}"
          title="${en?'Main menu':'القائمة الرئيسية'}"
        >
          ${getIcon('menu', 20)}
        </button>
        ${isAdmin ? `<span class="badge topbar-admin-badge" style="background: #1e293b; color: #f8fafc; font-weight: 700; border: 1px solid #334155; flex-shrink: 0;">${en?'Founder dashboard (Centrly HQ)':'لوحة المؤسس (Centrly HQ)'}</span>` : ''}

        <div id="navLiveSessionBadgeContainer" style="display: inline-flex; align-items: center; min-width: 0;">
          ${(activeSessionSummary && !isAdmin) ? renderNavLiveBadgeHtml(activeSessionSummary) : ''}
        </div>
      </div>

      <div class="topbar-actions" style="display: flex; align-items: center; gap: 0.65rem; flex-shrink: 0;">
        ${renderLanguageButton()}
        <div class="topbar-user-info" style="text-align: end;">
          <div class="topbar-user-name" style="font-weight: 700; font-size: 0.875rem; white-space: nowrap;"><bdi>${escapeHtml(displayName)}</bdi></div>
          <div class="topbar-user-role" style="font-size: 0.72rem; color: var(--centrly-text); white-space: nowrap;">${escapeHtml(roleName)}</div>
        </div>
        <div class="topbar-avatar" style="width: 38px; height: 38px; border-radius: 6px; background-color: #0f172a; color: #ffffff; font-size: 0.82rem; display: flex; align-items: center; justify-content: center; font-weight: 700; flex-shrink: 0;">
          ${escapeHtml(avatarLetter)}
        </div>
      </div>
    </header>
  `;
}

export function renderNavLiveBadgeHtml(activeSessionSummary) {
  if (!activeSessionSummary) return '';
  const en=getLocale()==='en';
  const groupName = escapeHtml(activeSessionSummary.groupName || (en?'Active class':'حصة جارية'));
  const count = activeSessionSummary.attendeeCount || 0;

  return `
    <button 
      type="button" 
      onclick="window.centrlyApp.navigate('sessions')" 
      class="btn btn-sm nav-live-session-btn"
      title="${en?'Active class':'حصة نشطة حالياً'}: ${groupName} (${count} ${en?'present':'حضور'})"
    >
      <span class="nav-live-dot"></span>
      <span class="nav-live-text-desktop">${en?'Active class':'حصة جارية'}: <bdi><b>${groupName}</b></bdi> (${count} ${en?'present':'حضور'})</span>
      <span class="nav-live-text-mobile">${en?'Active class':'حصة جارية'} (${count})</span>
    </button>
  `;
}

