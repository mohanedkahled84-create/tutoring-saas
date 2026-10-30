// Only the application hosts participate. Local/test/preview pages never redirect to production.
export function isPortalHost(hostname) {
  return /^(?:[a-z0-9-]+\.)?centerly-eg\.com$/.test(hostname) || /^(?:[a-z0-9-]+\.)?centrly\.app$/.test(hostname);
}
export function validPortalTarget(origin) {
  try { const u = new URL(origin); return u.origin === origin && u.protocol === 'https:' && !u.port && isPortalHost(u.hostname); }
  catch { return false; }
}
export async function preparePortalDestination(app, token, role, request, location = window.location) {
  if (!isPortalHost(location.hostname)) return false;
  const result = await request('/public/portal/destination', { method: 'POST', body: { token, role } });
  if (!validPortalTarget(result?.origin)) throw new Error('تعذر تحديد وجهة المتابعة');
  app._portalPresentation = result.presentation || null;
  if (result.origin !== location.origin) {
    if (!/^[A-Za-z0-9_-]{43}$/.test(result.ticket || '')) throw new Error('تعذر تجهيز الانتقال الآمن');
    location.replace(`${result.origin}/portal-entry#handoff=${encodeURIComponent(result.ticket)}`);
    return true;
  }
  if (role === 'student' && result.presentation) {
    location.replace('/dashboard');
    return true;
  }
  return false;
}
