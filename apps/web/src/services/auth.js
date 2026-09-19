import { request, API_BASE_URL, performSilentRefresh } from './api.js';

export const authService = {
  getUser() {
    try {
      const raw = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_user')) ||
                  (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_user'));
      return raw ? JSON.parse(raw) : null;
    } catch (_) {
      return null;
    }
  },

  setUser(user) {
    try {
      if (user) {
        const str = JSON.stringify(user);
        if (typeof localStorage !== 'undefined') localStorage.setItem('centrly_user', str);
        if (typeof sessionStorage !== 'undefined') sessionStorage.setItem('centrly_user', str);
      }
    } catch (_) {}
  },

  getToken() {
    try {
      return (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_token')) ||
             (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_token')) || null;
    } catch (_) {
      return null;
    }
  },

  getRefreshToken() {
    try {
      return (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_refresh_token')) ||
             (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_refresh_token')) || null;
    } catch (_) {
      return null;
    }
  },

  setSession(user, token, refreshToken) {
    try {
      const existingRefresh = this.getRefreshToken();
      const effectiveRefresh = refreshToken || existingRefresh;

      if (typeof localStorage !== 'undefined') {
        if (user) localStorage.setItem('centrly_user', JSON.stringify(user));
        if (token) localStorage.setItem('centrly_token', token);
        if (effectiveRefresh) localStorage.setItem('centrly_refresh_token', effectiveRefresh);
        localStorage.setItem('centrly_logged_in', '1');
      }
      if (typeof sessionStorage !== 'undefined') {
        if (user) sessionStorage.setItem('centrly_user', JSON.stringify(user));
        if (token) sessionStorage.setItem('centrly_token', token);
        if (effectiveRefresh) sessionStorage.setItem('centrly_refresh_token', effectiveRefresh);
        sessionStorage.setItem('centrly_logged_in', '1');
      }
    } catch (_) {}
  },

  clearSession() {
    try {
      const keys = ['centrly_token', 'centrly_refresh_token', 'centrly_access_token', 'centrly_logged_in', 'centrly_user', 'centrly_current_route'];
      keys.forEach(k => {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(k);
      });
    } catch (_) {}
  },

  isAuthenticated() {
    // Requires both logged_in flag and an active token
    try {
      const loggedIn = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_logged_in') === '1') ||
                       (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_logged_in') === '1');
      const token = this.getToken();
      return Boolean(loggedIn && token);
    } catch (_) {
      return false;
    }
  },

  hasSession() {
    // Returns true if we have cached user data even without a valid token
    try {
      const loggedIn = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_logged_in') === '1') ||
                       (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_logged_in') === '1');
      const user = this.getUser();
      return Boolean(loggedIn && user);
    } catch (_) {
      return false;
    }
  },

  async tryRefreshSession() {
    try {
      const refreshData = await performSilentRefresh();
      return Boolean(refreshData && refreshData.token);
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
