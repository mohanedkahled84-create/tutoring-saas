/**
 * Centrly Frontend API Service
 * Handles authenticated API calls to backend endpoints.
 */

const API_BASE_URL = window.__CENTRLY_API_URL__ || 'http://localhost:3000/api';

export async function request(endpoint, options = {}) {
  const token = localStorage.getItem('centrly_access_token');
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    ...options.headers,
  };

  try {
    const res = await fetch(`${API_BASE_URL}${endpoint}`, {
      ...options,
      headers,
    });

    const data = await res.json().catch(() => ({}));

    if (!res.ok) {
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
