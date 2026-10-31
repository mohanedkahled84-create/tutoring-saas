const API = 'https://tutoring-backend-production-c8dd.up.railway.app/api';

// Public portal requests must not refresh the staff account on a shared device.
export async function portalRequest(path, options = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 30000);
  try {
    const response = await fetch(API + path, {
      method: options.method || 'GET', signal: controller.signal, cache: 'no-store',
      ...(options.body ? { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(options.body) } : {}),
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
  if (localStorage.getItem('centrly_portal_token') !== token) {
    for (const key of Object.keys(localStorage)) {
      if (key.startsWith('centrly_cached_') || ['portal_student', 'portal_student_code', 'centrly_platform_content', 'centrly_materials'].includes(key)) localStorage.removeItem(key);
    }
  }
  localStorage.removeItem('centrly_explicit_logout');
  for (const storage of [localStorage, sessionStorage]) {
    storage.setItem('centrly_portal_token', token);
    storage.setItem('centrly_portal_role', role);
  }
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
    savePortalSession(arrival.token, 'student');
    return arrival.token;
  }
  return new URLSearchParams(location.search).get('token') || localStorage.getItem('centrly_portal_token');
}
