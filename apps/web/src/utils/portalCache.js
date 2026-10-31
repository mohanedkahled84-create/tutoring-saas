export const PORTAL_CACHE_PREFIX = 'centrly_portal_snapshot_v1:';
export const PORTAL_FRESH_MS = 2 * 60 * 1000;
export const PORTAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

async function sessionHash(token, role) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(role + ':' + token));
  return Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('');
}
function sessionExpired(token, now) {
  try {
    const parts = atob(token.replace(/-/g, '+').replace(/_/g, '/')).split(':');
    return parts.length === 4 && /^\d+$/.test(parts[2]) && Number(parts[2]) * 1000 <= now;
  } catch { return false; } // Legacy opaque tokens are still verified by the server.
}
const copy = value => JSON.parse(JSON.stringify(value));
function matchesSession(token, data) {
  try {
    const parts = atob(token.replace(/-/g, '+').replace(/_/g, '/')).split(':');
    if (parts.length === 4 && /^\d+$/.test(parts[2]) && /^[a-f0-9]{64}$/i.test(parts[3])) {
      return data?.student?.id === parts[1] && data.student.tenant_id === parts[0];
    }
  } catch {}
  return true;
}

// This is a cache of a successful token-scoped API response, never a source of authorization.
export function createPortalCache({storage, clock = Date.now, hash = sessionHash} = {}) {
  const flights = new Map();
  const revisions = new Map();
  const revision = role => revisions.get(role) || 0;
  const invalidated = () => Object.assign(new Error('تغيرت البيانات أثناء التحديث'), {code:'PORTAL_CACHE_INVALIDATED'});
  const store = () => storage || globalThis.localStorage;
  function active(token, role) {
    try {
      const current = store().getItem('centrly_portal_token');
      const currentRole = store().getItem('centrly_portal_role');
      return store().getItem('centrly_explicit_logout') !== '1' && current === token && (!currentRole || currentRole === role);
    } catch { return true; } // Storage restrictions disable persistence, not the live API.
  }
  function clear(role = 'student') { revisions.set(role, revision(role) + 1); try { store().removeItem(PORTAL_CACHE_PREFIX + role); } catch {} }
  async function read(token, role = 'student') {
    const generation = revision(role);
    if (!token || !active(token, role) || sessionExpired(token, clock())) return null;
    try {
      const record = JSON.parse(store().getItem(PORTAL_CACHE_PREFIX + role) || 'null');
      if (!record || record.version !== 1 || record.role !== role || !Number.isFinite(record.savedAt) || record.session !== await hash(token, role)) return null;
      const age = clock() - record.savedAt;
      if (generation !== revision(role) || !active(token, role) || age < 0 || age > PORTAL_MAX_AGE_MS || !record.data?.student?.id || !record.data.student.tenant_id || !matchesSession(token, record.data)) return null;
      const data = copy(record.data);
      // Signed download URLs may expire before the rest of the saved dashboard.
      if (age > 30 * 60 * 1000) for (const material of data.materials || []) {
        if (String(material.submission_url || '').includes('/object/sign/')) material.submission_url = null;
      }
      return {data, savedAt:record.savedAt, fresh:age < PORTAL_FRESH_MS};
    } catch { return null; }
  }
  async function write(token, data, role = 'student', {savedAt = clock(), generation = revision(role)} = {}) {
    if (!data?.student?.id || !data.student.tenant_id || !matchesSession(token, data) || !active(token, role) || sessionExpired(token, clock())) return;
    if (!Number.isFinite(savedAt) || savedAt > clock() || clock() - savedAt > PORTAL_MAX_AGE_MS) return;
    try {
      const record = {version:1, role, session:await hash(token, role), savedAt, data};
      if (generation !== revision(role) || !active(token, role)) return;
      const encoded = JSON.stringify(record);
      if (encoded.length <= 1500000) store().setItem(PORTAL_CACHE_PREFIX + role, encoded);
    } catch {} // A full/disabled device cache must never fail an otherwise valid page.
  }
  async function load(token, {role = 'student', request, onData = () => {}, force = false} = {}) {
    const generation = revision(role);
    if (!active(token, role)) throw Object.assign(new Error('تغير الحساب، افتح الصفحة مجددًا'), {code:'PORTAL_SESSION_CHANGED'});
    if (sessionExpired(token, clock())) { clear(role); throw Object.assign(new Error('انتهت صلاحية الجلسة، سجّل الدخول مجددًا'), {status:401}); }
    const cached = await read(token, role);
    if (generation !== revision(role)) throw invalidated();
    if (cached) onData(copy(cached.data), {cached:true, savedAt:cached.savedAt});
    if (cached?.fresh && !force) return {data:cached.data, cached:true, savedAt:cached.savedAt};
    let key;
    try { key = await hash(token, role); }
    catch { key = 'memory-only:' + role + ':' + token; } // Live reads still work when secure device caching is unavailable.
    key += ':' + generation;
    let flight = flights.get(key);
    if (!flight) {
      flight = (async () => {
        const data = await request('/public/parent-portal?token=' + encodeURIComponent(token));
        if (generation !== revision(role)) throw invalidated();
        if (!active(token, role)) throw Object.assign(new Error('تغير الحساب، افتح الصفحة مجددًا'), {code:'PORTAL_SESSION_CHANGED'});
        if (!data?.student?.id || !matchesSession(token, data)) throw new Error('تعذر التحقق من بيانات الحساب');
        await write(token, data, role, {generation});
        return data;
      })();
      flights.set(key, flight);
      flight.finally(() => { if (flights.get(key) === flight) flights.delete(key); }).catch(() => {});
    }
    try {
      const data = await flight;
      if (generation !== revision(role)) throw invalidated();
      if (!active(token, role)) throw Object.assign(new Error('تغير الحساب، افتح الصفحة مجددًا'), {code:'PORTAL_SESSION_CHANGED'});
      onData(copy(data), {cached:false, savedAt:clock()});
      return {data, cached:false, savedAt:clock()};
    } catch (error) {
      if (!active(token, role)) throw Object.assign(new Error('تغير الحساب، افتح الصفحة مجددًا'), {code:'PORTAL_SESSION_CHANGED'});
      if (error.status === 401 || error.status === 403) { if (active(token, role)) clear(role); throw error; }
      if (error.code === 'PORTAL_SESSION_CHANGED' || error.code === 'PORTAL_CACHE_INVALIDATED') throw error;
      if (cached && active(token, role)) return {data:cached.data, cached:true, stale:true, savedAt:cached.savedAt, error};
      throw error;
    }
  }
  return {read, write, load, clear};
}
export const portalCache = createPortalCache();
