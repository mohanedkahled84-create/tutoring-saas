/**
 * Centrly Frontend API Service
 * Handles authenticated API calls to backend endpoints.
 */

const isLocalhost = typeof window !== 'undefined' && 
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

export const API_BASE_URL = window.__CENTRLY_API_URL__ || (
  isLocalhost
    ? 'http://localhost:3000/api'
    : 'https://tutoring-backend-production-c8dd.up.railway.app/api'
);

export async function request(endpoint, options = {}) {
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      credentials: 'include',
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
      if (res.status === 401) {
        localStorage.removeItem('centrly_logged_in');
        localStorage.removeItem('centrly_user');
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
