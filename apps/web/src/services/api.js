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
    const token = typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_token') : null;
    if (token && !headers['Authorization'] && !headers['authorization']) {
      headers['Authorization'] = `Bearer ${token}`;
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
        // Attempt silent session refresh if refresh token is available
        const isAuthEndpoint = endpoint.includes('/auth/login') || endpoint.includes('/auth/refresh') || endpoint.includes('/auth/signup');
        if (!isAuthEndpoint && !options._retry) {
          const refreshToken = typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_refresh_token') : null;
          if (refreshToken) {
            try {
              const refreshRes = await fetch(`${API_BASE_URL}/auth/refresh`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ refresh_token: refreshToken }),
              });
              const refreshData = await refreshRes.json();
              if (refreshRes.ok && refreshData.token) {
                localStorage.setItem('centrly_token', refreshData.token);
                if (refreshData.refresh_token) {
                  localStorage.setItem('centrly_refresh_token', refreshData.refresh_token);
                }
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
            } catch (refErr) {
              console.warn('Session refresh attempt failed:', refErr);
            }
          }
        }

        // Remove only the expired token; keep user data and logged_in flag
        // so the caller (e.g. init) can decide gracefully what to do
        try {
          localStorage.removeItem('centrly_token');
          localStorage.removeItem('centrly_refresh_token');
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
      throw new Error(errMsg);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}
