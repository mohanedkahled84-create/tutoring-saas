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
      throw new Error(data.error || data.message || `Request failed with status ${res.status}`);
    }

    return data;
  } catch (error) {
    console.error(`API Error [${endpoint}]:`, error);
    throw error;
  }
}
