import { request, API_BASE_URL } from './api.js';

export const authService = {
  getUser() {
    const raw = localStorage.getItem('centrly_user');
    return raw ? JSON.parse(raw) : null;
  },

  setUser(user) {
    try {
      if (user) {
        localStorage.setItem('centrly_user', JSON.stringify(user));
      }
    } catch (_) {}
  },

  getToken() {
    try {
      return localStorage.getItem('centrly_token');
    } catch (_) {
      return null;
    }
  },

  getRefreshToken() {
    try {
      return localStorage.getItem('centrly_refresh_token');
    } catch (_) {
      return null;
    }
  },

  setSession(user, token, refreshToken) {
    try {
      if (user) localStorage.setItem('centrly_user', JSON.stringify(user));
      if (token) localStorage.setItem('centrly_token', token);
      if (refreshToken) localStorage.setItem('centrly_refresh_token', refreshToken);
      localStorage.setItem('centrly_logged_in', '1');
    } catch (_) {}
  },

  clearSession() {
    try {
      localStorage.removeItem('centrly_token');
      localStorage.removeItem('centrly_refresh_token');
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

  hasSession() {
    // Returns true if we have cached user data even without a valid token
    try {
      return localStorage.getItem('centrly_logged_in') === '1' && !!localStorage.getItem('centrly_user');
    } catch (_) {
      return false;
    }
  },

  async tryRefreshSession() {
    try {
      const refreshToken = localStorage.getItem('centrly_refresh_token');
      if (!refreshToken) return false;

      const res = await fetch(`${API_BASE_URL}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      const data = await res.json().catch(() => ({}));

      if (res.ok && data.token) {
        localStorage.setItem('centrly_token', data.token);
        if (data.refresh_token) {
          localStorage.setItem('centrly_refresh_token', data.refresh_token);
        }
        return true;
      }
      return false;
    } catch (_) {
      return false;
    }
  },

  async login(identifier, password) {
    const response = await request('/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email: identifier, identifier, password }),
    });

    if (response.user) {
      if (response.token) {
        this.setSession(response.user, response.token, response.refresh_token);
        try {
          const profile = await request('/auth/me');
          if (profile?.user) {
            response.user = { ...response.user, ...profile.user };
          }
        } catch (_) {}
      }
      this.setSession(response.user, response.token, response.refresh_token);
    }
    return response;
  },

  async signup(data) {
    const response = await request('/auth/signup', {
      method: 'POST',
      body: JSON.stringify(data),
    });

    // If backend requires email confirmation (mandatory Resend OTP), return immediately
    if (response.requires_verification) {
      return response;
    }

    if (response.user && response.token) {
      this.setSession(response.user, response.token, response.refresh_token);
      return response;
    }

    return response;
  },

  async verifyEmail(email, code, password) {
    const response = await request('/auth/verify-email', {
      method: 'POST',
      body: JSON.stringify({ email, code, password }),
    });

    if (response.user && response.token) {
      this.setSession(response.user, response.token, response.refresh_token);
      try {
        const profile = await request('/auth/me');
        if (profile?.user) {
          response.user = { ...response.user, ...profile.user };
        }
      } catch (_) {}
      this.setSession(response.user, response.token, response.refresh_token);
    }
    return response;
  },

  async resendVerification(email) {
    return await request('/auth/resend-verification', {
      method: 'POST',
      body: JSON.stringify({ email }),
    });
  },

  async getProfile() {
    const res = await request('/auth/me');
    if (res?.user) {
      const currentUser = this.getUser() || {};
      const merged = { ...currentUser, ...res.user };
      this.setSession(merged, this.getToken(), this.getRefreshToken());
    }
    return res;
  },

  async forgotPassword(email) {
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://centrly-platform.vercel.app';
    return await request('/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email, redirectTo: `${origin}/` }),
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
