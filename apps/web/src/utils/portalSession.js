import { portalCache } from './portalCache.js';
export { portalCache };
const API = 'https://tutoring-backend-production-c8dd.up.railway.app/api';

// Public portal requests must not refresh the staff account on a shared device.
export async function portalRequest(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  // Origin-checked exchanges accept flat form bodies, avoiding an extra OPTIONS round trip.
  const formBody = options.body && (path.startsWith('/public/family/') || ['/public/portal/destination', '/public/portal/handoff'].includes(path));
  try {
    const response = await fetch(API + path, {
      method: options.method || 'GET', signal: controller.signal, cache: 'no-store',
      ...(options.body ? {
        headers: { 'Content-Type': formBody ? 'application/x-www-form-urlencoded;charset=UTF-8' : 'application/json' },
        body: formBody ? new URLSearchParams(options.body).toString() : JSON.stringify(options.body),
      } : {}),
    });
    const data = await response.json();
    if (!response.ok) {
      const error = new Error(data.error?.message || 'تعذر تحميل البيانات، حاول مجددًا');
      error.status = response.status;
      throw error;
    }
    return data;
  } catch (error) {
    if (error.name === 'AbortError') throw new Error('الاتصال استغرق وقتًا طويلًا. تحقق من الإنترنت وحاول مجددًا.');
    if (error instanceof TypeError) throw new Error('تعذر الاتصال. تحقق من الإنترنت وحاول مجددًا.');
    throw error;
  } finally { clearTimeout(timer); }
}

export function savePortalSession(token, role) {
  if (localStorage.getItem('centrly_portal_token') !== token || localStorage.getItem('centrly_portal_role') !== role) {
    portalCache.clear('student');
    portalCache.clear('parent');
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('centrly_cached_') || key.startsWith('centrly_portal_snapshot_v1:') || ['portal_student', 'portal_student_code', 'centrly_platform_content', 'centrly_materials'].includes(key)) localStorage.removeItem(key);
    }
  }
  localStorage.removeItem('centrly_explicit_logout');
  for (const storage of [localStorage, sessionStorage]) {
    storage.setItem('centrly_portal_token', token);
    storage.setItem('centrly_portal_role', role);
  }
}

// Call only with a session returned by a successful server login/short-link/handoff.
// Token renewal for the SAME verified identity must not discard its dashboard or renew its freshness.
export async function adoptVerifiedPortalSession(token, role) {
  const previous = localStorage.getItem('centrly_portal_token');
  let snapshot = null;
  if (previous && previous !== token && localStorage.getItem('centrly_portal_role') === role) {
    const cached = await portalCache.read(previous, role);
    try {
      const parts = atob(token.replace(/-/g, '+').replace(/_/g, '/')).split(':');
      if (cached && parts.length === 4 && /^\d+$/.test(parts[2]) && Number(parts[2]) * 1000 > Date.now() && /^[a-f0-9]{64}$/i.test(parts[3]) &&
          cached.data.student.id === parts[1] && cached.data.student.tenant_id === parts[0]) snapshot = cached;
    } catch {}
  }
  if (localStorage.getItem('centrly_portal_token') !== previous && localStorage.getItem('centrly_portal_token') !== token) {
    throw Object.assign(new Error('تغير الحساب، افتح الرابط مجددًا'), {code:'PORTAL_SESSION_CHANGED'});
  }
  savePortalSession(token, role);
  if (snapshot) await portalCache.write(token, snapshot.data, role, {savedAt:snapshot.savedAt});
}

export async function resolveStudentSession() {
  const ticket = new URLSearchParams(location.hash.slice(1)).get('handoff');
  if (ticket) {
    history.replaceState(null, '', location.pathname + location.search);
    let arrival;
    try { arrival = await portalRequest('/public/portal/handoff', { method: 'POST', body: { ticket } }); }
    catch {
      const error = new Error('تعذر إكمال الدخول. افتح رابط الطالب الأصلي مرة أخرى أو سجل الدخول.');
      error.handoff = true;
      throw error;
    }
    if (!arrival.token || arrival.role !== 'student' || arrival.origin !== location.origin || !arrival.presentation) {
      throw new Error('افتح رابط الطالب الأصلي مجددًا لإكمال الدخول');
    }
    await adoptVerifiedPortalSession(arrival.token, 'student');
    return arrival.token;
  }
  const incoming = new URLSearchParams(location.search).get('token');
  if (incoming) { savePortalSession(incoming, 'student'); return incoming; }
  if (localStorage.getItem('centrly_portal_role') && localStorage.getItem('centrly_portal_role') !== 'student') return null;
  return localStorage.getItem('centrly_portal_token');
}
