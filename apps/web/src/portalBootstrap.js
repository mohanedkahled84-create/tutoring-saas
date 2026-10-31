import { portalRequest, adoptVerifiedPortalSession } from './utils/portalSession.js';
import { preparePortalDestination } from './utils/portalDestination.js';

// Resolve shared links before importing the dashboard, landing page and staff authentication modules.
async function start() {
  const params = new URLSearchParams(location.search);
  const match = location.pathname.match(/^\/([ps])\/([a-zA-Z0-9_-]+)$/i) || location.pathname.match(/^\/([ps])([ps]?[a-f0-9]{8})$/i);
  const code = match?.[2] || params.get('s') || params.get('p');
  const type = match?.[1]?.toLowerCase() || (params.has('s') ? 's' : 'p');
  if (!code) { await import('./app.js?v=9.21.0'); return; }
  const root = document.getElementById('app');
  root.innerHTML = '<p role="status" style="padding:3rem;text-align:center">جارِ فتح المتابعة…</p>';
  try {
    const queryCode = /^[ps]/i.test(code) ? code : type + code;
    const link = await portalRequest('/public/short-links/' + encodeURIComponent(queryCode));
    if (!link.token) throw new Error('رابط المتابعة غير صالح');
    const role = link.portal_type === 'student' || type === 's' ? 'student' : 'parent';
    const app = {};
    await adoptVerifiedPortalSession(link.token, role);
    if (await preparePortalDestination(app, link.token, role, portalRequest)) return;
    // The verified destination is already known for this entry. Avoid a second lookup in the SPA.
    window.__centrlyPortalArrival = { token: link.token, role, origin: location.origin, presentation: app._portalPresentation };
    history.replaceState(null, '', '/portal-entry');
    await import('./app.js?v=9.21.0');
  } catch (error) {
    root.innerHTML = '<div role="alert" style="padding:3rem;text-align:center"><p></p><button type="button" style="min-height:44px">إعادة المحاولة</button></div>';
    root.querySelector('p').textContent = error.message || 'تعذر الاتصال. حاول مجددًا.';
    root.querySelector('button').addEventListener('click', start, { once: true });
  }
}
start();
