import { request } from './api.js';

export const authService = {
  getToken() {
    return localStorage.getItem('centrly_access_token');
  },

  getUser() {
    const raw = localStorage.getItem('centrly_user');
    return raw ? JSON.parse(raw) : null;
  },

  setSession(token, user) {
    if (token) localStorage.setItem('centrly_access_token', token);
    if (user) localStorage.setItem('centrly_user', JSON.stringify(user));
  },

  clearSession() {
    localStorage.removeItem('centrly_access_token');
    localStorage.removeItem('centrly_user');
  },

  isAuthenticated() {
    return !!this.getToken();
  },

  async login(email, password) {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });

    if (response.token && response.user) {
      this.setSession(response.token, response.user);
    }
    return response;
  },

  async signup(data) {
    const response = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    if (response.token && response.user) {
      this.setSession(response.token, response.user);
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
    return await request('/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ token, new_password: newPassword }),
    });
  },

  logout() {
    this.clearSession();
    window.location.reload();
  }
};
