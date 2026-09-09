import { request } from './api.js';

export const authService = {
  getUser() {
    const raw = localStorage.getItem('centrly_user');
    return raw ? JSON.parse(raw) : null;
  },

  getToken() {
    try {
      return localStorage.getItem('centrly_token');
    } catch (_) {
      return null;
    }
  },

  setSession(user, token) {
    try {
      if (user) localStorage.setItem('centrly_user', JSON.stringify(user));
      if (token) localStorage.setItem('centrly_token', token);
      localStorage.setItem('centrly_logged_in', '1');
    } catch (_) {}
  },

  clearSession() {
    try {
      localStorage.removeItem('centrly_token');
      localStorage.removeItem('centrly_access_token'); // Cleanup legacy token if present
      localStorage.removeItem('centrly_logged_in');
      localStorage.removeItem('centrly_user');
    } catch (_) {}
  },

  isAuthenticated() {
    // Requires both logged_in flag and an active token
    try {
      return localStorage.getItem('centrly_logged_in') === '1' && !!localStorage.getItem('centrly_token');
    } catch (_) {
      return false;
    }
  },

  async login(email, password) {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.user) {
      this.setSession(response.user, response.token);
    }
    return response;
  },

  async signup(data) {
    const response = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.user) {
      this.setSession(response.user, response.token);
      return response;
    }

    // Auto-login to establish authenticated session before onboarding starts
    if (data.email && data.password) {
      const loginRes = await this.login(data.email, data.password);
      return {
        ...response,
        user: loginRes.user || response.user,
        token: loginRes.token || response.token,
      };
    }

    return response;
  },

  async getProfile() {
    return await request('/auth/me');
  },

  async forgotPassword(email) {
    return await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async resetPassword(token, newPassword) {
    // SEC-HOTFIX: Unified contract on 'password'
    return await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, password: newPassword, new_password: newPassword }),
    });
  },

  async logout() {
    try {
      await request('/auth/logout', { method: 'POST' });
    } catch (err) {
      console.warn('Backend logout request failed:', err);
    } finally {
      this.clearSession();
      window.location.reload();
    }
  }
};
