import { portalRequest, adoptVerifiedPortalSession, portalCache } from './utils/portalSession.js';
import { preparePortalDestination } from './utils/portalDestination.js';

// Resolve shared links before importing the dashboard, landing page and staff authentication modules.
async function start() {
  const params = new URLSearchParams(location.search);
  const match = location.pathname.match(/^\/([ps])\/([a-zA-Z0-9_-]+)$/i) || location.pathname.match(/^\/([ps])([ps]?[a-f0-9]{8})$/i);
  const code = match?.[2] || params.get('s') || params.get('p');
  const type = match?.[1]?.toLowerCase() || (params.has('s') ? 's' : 'p');
  const isParentEntry=(code && type==='p') || location.pathname==='/portal-entry' || params.get('role')==='parent' || localStorage.getItem('centrly_portal_role')==='parent' || localStorage.getItem('centrly_portal_entry_role')==='parent';
  const parentModule=isParentEntry ? import('./parentPortal.js') : null;
  parentModule?.catch(()=>{}); // Show the normal retry UI if a module download fails.
  const mountParent = async error => (await (parentModule || import('./parentPortal.js'))).mountParentPortal(error);
  // Consume cross-origin entry before downloading staff authentication and dashboards.
  const ticket = new URLSearchParams(location.hash.slice(1)).get('handoff');
  if (location.pathname === '/portal-entry' && ticket) {
    history.replaceState(null,'','/portal-entry');
    try {
      const arrival = await portalRequest('/public/portal/handoff',{method:'POST',body:{ticket,view:'parent'}});
      if (!arrival?.token || !['parent','student'].includes(arrival.role) || arrival.origin !== location.origin) throw Error('افتح رابط المتابعة الأصلي مجددًا.');
      await adoptVerifiedPortalSession(arrival.token,arrival.role);
      window.__centrlyPortalArrival=arrival;
      if (arrival.role === 'parent') { await mountParent(); return; }
      if (arrival.presentation) { location.replace('/dashboard'); return; }
    } catch(error) { await mountParent(error.message || 'تعذر إكمال الدخول. افتح الرابط الأصلي مجددًا.'); return; }
  }
  if (!code) {
    const savedRole = localStorage.getItem('centrly_portal_role') || sessionStorage.getItem('centrly_portal_role');
    const entryRole = localStorage.getItem('centrly_portal_entry_role');
    const portalPath = /^\/portal(?:-entry)?\/?$/.test(location.pathname);
    if (portalPath && !params.has('token') && params.get('role') !== 'student' && (savedRole === 'parent' || (!savedRole && (entryRole === 'parent' || params.get('role') === 'parent' || (location.pathname === '/portal-entry' && /^[a-z0-9-]+\.centerly-eg\.com$/.test(location.hostname) && !location.hostname.startsWith('www.')))))) {
      await mountParent(); return;
    }
    // Returning portal users do not need to download the staff/landing SPA just to change origin.
    const token = localStorage.getItem('centrly_portal_token'), role = localStorage.getItem('centrly_portal_role');
    if (/^\/portal\/?$/.test(location.pathname) && !location.search && !location.hash && token &&
        ['student','parent'].includes(role) && !localStorage.getItem('centrly_explicit_logout')) {
      const cached = await portalCache.read(token, role);
      // Any saved basic dashboard, including stale data, must paint before a network wait.
      if (!cached) {
        try {
          const app = {};
          const activeRequest = async (...args) => {
            const result = await portalRequest(...args);
            if (localStorage.getItem('centrly_portal_token') !== token || localStorage.getItem('centrly_portal_role') !== role)
              throw new Error('تغير الحساب أثناء الدخول');
            return result;
          };
          if (await preparePortalDestination(app, token, role, activeRequest)) return;
          window.__centrlyPortalArrival = { token, role, origin: location.origin, presentation: app._portalPresentation };
        } catch { /* The full portal handles expired sessions and retry feedback. */ }
      }
    }
    await import('./app.js?v=9.21.0'); return;
  }
  const root = document.getElementById('app');
  if (!root.querySelector('.portal-opening')) window.renderPortalOpening(root);
  try {
    const queryCode = /^[ps]/i.test(code) ? code : type + code;
    const link = await portalRequest('/public/short-links/' + encodeURIComponent(queryCode) + '?entry=' + type + (type==='p' ? '&view=parent' : ''));
    if (!link.token) throw new Error('رابط المتابعة غير صالح');
    const role = link.portal_type === 'student' || type === 's' ? 'student' : 'parent';
    const app = {};
    await adoptVerifiedPortalSession(link.token, role);
    if (await preparePortalDestination(app, link.token, role, portalRequest, window.location, link.destination)) return;
    // The verified destination is already known for this entry. Avoid a second lookup in the SPA.
    window.__centrlyPortalArrival = { token: link.token, role, origin: location.origin, presentation: app._portalPresentation, initial_data:link.initial_data };
    history.replaceState(null, '', '/portal-entry');
    if (role === 'parent') await mountParent();
    else await import('./app.js?v=9.21.0');
  } catch (error) {
    root.innerHTML = '<div role="alert" style="padding:3rem;text-align:center"><p></p><button type="button" style="min-height:44px">إعادة المحاولة</button></div>';
    root.querySelector('p').textContent = error.message || 'تعذر الاتصال. حاول مجددًا.';
    root.querySelector('button').addEventListener('click', start, { once: true });
  }
}
start();
