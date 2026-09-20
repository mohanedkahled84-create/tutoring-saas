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
 * Mutex-protected silent token refresh.
 * Serializes concurrent refresh calls so multiple parallel requests await the same refresh operation.
 */
export async function performSilentRefresh() {
  if (activeRefreshPromise) {
    return activeRefreshPromise;
  }

  activeRefreshPromise = (async () => {
    try {
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
          }
          if (typeof sessionStorage !== 'undefined') {
            sessionStorage.setItem('centrly_token', data.token);
            if (data.refresh_token) sessionStorage.setItem('centrly_refresh_token', data.refresh_token);
            sessionStorage.setItem('centrly_logged_in', '1');
          }
        } catch (_) {}
        return data;
      }

      // Only invalidate session if server explicitly rejects refresh token as invalid/revoked
      if (res.status === 401 || res.status === 400) {
        const errMsg = String(data?.error?.message || data?.message || '').toLowerCase();
        if (errMsg.includes('invalid_refresh_token') || errMsg.includes('not valid') || errMsg.includes('revoked')) {
          try {
            if (typeof localStorage !== 'undefined') {
              localStorage.removeItem('centrly_token');
              localStorage.removeItem('centrly_refresh_token');
              localStorage.removeItem('centrly_logged_in');
            }
            if (typeof sessionStorage !== 'undefined') {
              sessionStorage.removeItem('centrly_token');
              sessionStorage.removeItem('centrly_refresh_token');
              sessionStorage.removeItem('centrly_logged_in');
            }
          } catch (_) {}
        }
      }

      return null;
    } catch (err) {
      console.warn('Silent refresh network exception:', err);
      return null;
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

        // Remove only the expired access token; keep refresh_token, user data, and logged_in flag
        // so the session remains persistent across page reloads
        try {
          if (typeof localStorage !== 'undefined') localStorage.removeItem('centrly_token');
          if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem('centrly_token');
        } catch (_) {}
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
