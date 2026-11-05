import { portalRequest, adoptVerifiedPortalSession } from './utils/portalSession.js?v=9.44.0';
import { preparePortalDestination } from './utils/portalDestination.js?v=9.44.0';

// Resolve shared links before importing the dashboard, landing page and staff authentication modules.
async function start() {
  const params = new URLSearchParams(location.search);
  const match = location.pathname.match(/^\/([ps])\/([a-zA-Z0-9_-]+)$/i) || location.pathname.match(/^\/([ps])([ps]?[a-f0-9]{8})$/i);
  const code = match?.[2] || params.get('s') || params.get('p');
  const type = match?.[1]?.toLowerCase() || (params.has('s') ? 's' : 'p');
  const explicitStudent=params.get('role')==='student' || (code && type==='s') || params.get('portal')==='student';
  const isParentEntry=location.pathname==='/family' || (code && type==='p') || (!explicitStudent && (location.pathname==='/portal-entry' || params.get('role')==='parent' || localStorage.getItem('centrly_portal_role')==='parent' || localStorage.getItem('centrly_portal_entry_role')==='parent'));
  const parentModule=isParentEntry ? import('./parentPortal.js?v=9.44.0') : null;
  parentModule?.catch(()=>{}); // Show the normal retry UI if a module download fails.
  const mountParent = async error => (await (parentModule || import('./parentPortal.js?v=9.44.0'))).mountParentPortal(error);
  const mountStudent = async () => (await import('./studentPortalEntry.js?v=9.44.0')).mountStudentPortal();
  if(location.pathname==='/family'){await mountParent();return;}
  if(location.pathname==='/portal-entry' && new URLSearchParams(location.hash.slice(1)).has('family')){await mountParent();return;}
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
    if (portalPath && !params.has('token') && params.get('role') !== 'student' && (params.get('role') === 'parent' || savedRole === 'parent' || (!savedRole && (entryRole === 'parent' || (location.pathname === '/portal-entry' && /^[a-z0-9-]+\.centerly-eg\.com$/.test(location.hostname) && !location.hostname.startsWith('www.')))))) {
      await mountParent(); return;
    }
    // The existing student loader paints its cache before checking the live destination.
    // No teacher authentication or landing modules are needed for this entry.
    if(portalPath || params.get('view')==='portal' || params.get('portal')==='login' || params.has('token')){await mountStudent();return;}
    await import('./app.js?v=9.44.0'); return;
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
    else await mountStudent();
  } catch (error) {
    root.innerHTML = '<div role="alert" style="padding:3rem;text-align:center"><p></p><button type="button" style="min-height:44px">إعادة المحاولة</button></div>';
    root.querySelector('p').textContent = error.message || 'تعذر الاتصال. حاول مجددًا.';
    root.querySelector('button').addEventListener('click', start, { once: true });
  }
}
start().catch(error => {
  console.error('Portal startup failed', error);
  window.showPortalOpeningFailure?.();
});
