/**
 * Centrly Frontend API Service
 * Handles authenticated API calls to backend endpoints.
 */

const hostname = typeof window !== 'undefined' ? (window.location.hostname || '') : '';
const isLocalHost = hostname === 'localhost' || 
  hostname === '127.0.0.1' || 
  hostname.startsWith('192.168.') || 
  hostname.startsWith('10.') || 
  /^172\.(1[6-9]|2\d|3[01])\./.test(hostname) ||
  hostname.endsWith('.local');

export const API_BASE_URL = (typeof window !== 'undefined' && window.__CENTRLY_API_URL__) || (
  isLocalHost
    ? (hostname && hostname !== 'localhost' && hostname !== '127.0.0.1' ? `http://${hostname}:3000/api` : 'http://localhost:3000/api')
    : 'https://tutoring-backend-production-c8dd.up.railway.app/api'
);

let activeRefreshPromise = null;

/**
 * Validates if a JWT token is expired with a customizable safety buffer.
 */
export function isJwtExpired(token, bufferSeconds = 30) {
  if (!token) return true;
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const base64Url = parts[1];
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/');
    const jsonPayload = decodeURIComponent(
      atob(base64)
        .split('')
        .map(c => '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2))
        .join('')
    );
    const parsed = JSON.parse(jsonPayload);
    if (!parsed.exp) return false;
    return Date.now() >= (parsed.exp * 1000 - bufferSeconds * 1000);
  } catch (_) {
    return false;
  }
}

async function _executeSilentRefreshCore() {
  try {
    // 1. Cross-Tab Deduplication: Check if another tab already refreshed the token in localStorage
    const currentToken = typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_token') : null;
    if (currentToken && !isJwtExpired(currentToken, 60)) {
      const currentRefresh = typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_refresh_token') : null;
      const userStr = typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_user') : null;
      let parsedUser = null;
      try { parsedUser = userStr ? JSON.parse(userStr) : null; } catch (_) {}
      return {
        token: currentToken,
        refresh_token: currentRefresh,
        user: parsedUser,
      };
    }

    const refreshToken = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_refresh_token')) ||
                          (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_refresh_token'));
    if (!refreshToken) {
      return null;
    }

    const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });

    const data = await res.json().catch(() => ({}));

    if (res.ok && data.token) {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem('centrly_token', data.token);
          if (data.refresh_token) localStorage.setItem('centrly_refresh_token', data.refresh_token);
          localStorage.setItem('centrly_logged_in', '1');
          if (data.user) {
            const prevStr = localStorage.getItem('centrly_user');
            const prev = prevStr ? JSON.parse(prevStr) : {};
            localStorage.setItem('centrly_user', JSON.stringify({ ...prev, ...data.user }));
          }
        }
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem('centrly_token', data.token);
          if (data.refresh_token) sessionStorage.setItem('centrly_refresh_token', data.refresh_token);
          sessionStorage.setItem('centrly_logged_in', '1');
          if (data.user) {
            const prevStr = sessionStorage.getItem('centrly_user');
            const prev = prevStr ? JSON.parse(prevStr) : {};
            sessionStorage.setItem('centrly_user', JSON.stringify({ ...prev, ...data.user }));
          }
        }
      } catch (_) {}
      return data;
    }

    // Only invalidate tokens if server explicitly rejects refresh token as permanently revoked/invalid (401)
    if (res.status === 401) {
      const errMsg = String(data?.error?.message || data?.message || data?.error || '').toLowerCase();
      const isExplicitRevocation = errMsg.includes('invalid_refresh_token') ||
                                   errMsg.includes('already used') ||
                                   errMsg.includes('token not found') ||
                                   errMsg.includes('refresh token revoked');
      if (isExplicitRevocation) {
        try {
          if (typeof localStorage !== 'undefined') {
            localStorage.removeItem('centrly_token');
            localStorage.removeItem('centrly_refresh_token');
          }
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.removeItem('centrly_token');
            sessionStorage.removeItem('centrly_refresh_token');
          }
        } catch (_) {}
      }
    }

    // On 500, 502, 503, network drop: PRESERVE refresh token so session is NOT destroyed prematurely
    return null;
  } catch (err) {
    console.warn('Silent refresh network exception:', err);
    return null;
  }
}

/**
 * Mutex and Web-Lock protected silent token refresh.
 * Coordinates across tabs and concurrent promises to prevent token family revocation.
 */
export async function performSilentRefresh() {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
      if (typeof navigator !== 'undefined' && navigator.locks && navigator.locks.request) {
        return await navigator.locks.request('centrly_auth_refresh_lock', { timeout: 10000 }, async () => {
          return await _executeSilentRefreshCore();
        }).catch(err => {
          console.warn('[performSilentRefresh] Web Lock fallback:', err);
          return _executeSilentRefreshCore();
        });
      }
      return await _executeSilentRefreshCore();
    } finally {
      activeRefreshPromise = null;
    }
  })();

  return activeRefreshPromise;
}

export async function request(endpoint, options = {}) {
  let body = options.body;
  if (body && typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
    body = JSON.stringify(body);
  }

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const isAuthGuestEndpoint = endpoint.includes('/auth/login') ||
                                endpoint.includes('/auth/signup') ||
                                endpoint.includes('/auth/verify-email') ||
                                endpoint.includes('/auth/forgot-password') ||
                                endpoint.includes('/auth/reset-password') ||
                                endpoint.startsWith('/public/');
    if (!isAuthGuestEndpoint) {
      const token = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_token')) ||
                    (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_token'));
      if (token && !headers['Authorization'] && !headers['authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }
  } catch (_) {
    // localStorage might be unavailable or restricted
  }

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      ...options,
      headers,
      body,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        // Attempt silent session refresh if refresh token is available (skip for auth and public endpoints)
        const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh') || endpoint.includes('/auth/signup') || endpoint.startsWith('/public/');
        if (!isAuthEndpoint && !options._retry) {
          const refreshData = await performSilentRefresh();
          if (refreshData && refreshData.token) {
            const retryHeaders = {
              ...headers,
              'Authorization': `Bearer ${refreshData.token}`,
            };
            return await request(endpoint, {
              ...options,
              headers: retryHeaders,
              _retry: true,
            });
          }
        }
      }

      let errMsg = `Request failed with status ${res.status}`;
      if (typeof data.error === 'string') {
        errMsg = data.error;
      } else if (data.error && typeof data.error === 'object') {
        if (Array.isArray(data.error.details) && data.error.details.length > 0) {
          errMsg = data.error.details.map(d => d.message || d.field || JSON.stringify(d)).join(' • ');
        } else if (data.error.message) {
          errMsg = data.error.message;
        }
      } else if (data.message) {
        errMsg = data.message;
      }
      const err = new Error(errMsg);
      if (data.error && typeof data.error === 'object') {
        if (data.error.code) err.code = data.error.code;
        if (data.error.email) err.email = data.error.email;
      }
      err.status = res.status;
      err.data = data;
      throw err;
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}
