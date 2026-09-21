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
      const specificKeys = [
        'centrly_token',
        'centrly_refresh_token',
        'centrly_access_token',
        'centrly_logged_in',
        'centrly_user',
        'centrly_current_route',
        'centrly_has_security_pin',
        'centrly_financial_pin',
        'centrly_active_session_state',
        'centrly_active_session_id',
      ];
      specificKeys.forEach(k => {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(k);
      });

      // Clear all tenant and data caches from browser storage
      if (typeof localStorage !== 'undefined') {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('centrly_cache_') || k.startsWith('centrly_tenant_'))) {
            toRemove.push(k);
          }
        }
        toRemove.forEach(k => localStorage.removeItem(k));
      }

      if (typeof sessionStorage !== 'undefined') {
        const toRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith('centrly_cache_') || k.startsWith('centrly_tenant_'))) {
            toRemove.push(k);
          }
        }
        toRemove.forEach(k => sessionStorage.removeItem(k));
      }
    } catch (_) {}
  },

  isTokenExpired(token) {
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
      // Buffer of 30 seconds before expiration
      return Date.now() >= (parsed.exp * 1000 - 30000);
    } catch (_) {
      return false;
    }
  },

  isAuthenticated() {
    try {
      const token = this.getToken();
      if (!token) return false;
      return !this.isTokenExpired(token);
    } catch (_) {
      return false;
    }
  },

  hasSession() {
    // Returns true if cached user data or valid credentials exist across page reloads
    try {
      const user = this.getUser();
      const token = this.getToken();
      const refreshToken = this.getRefreshToken();
      const loggedIn = (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_logged_in') === '1') ||
                       (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_logged_in') === '1');
      const hasAny = Boolean(user || token || refreshToken || loggedIn);
      if (hasAny) {
        // Self-heal the logged_in flag if it was cleared or missing
        if (typeof localStorage !== 'undefined' && localStorage.getItem('centrly_logged_in') !== '1') {
          localStorage.setItem('centrly_logged_in', '1');
        }
        if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem('centrly_logged_in') !== '1') {
          sessionStorage.setItem('centrly_logged_in', '1');
        }
      }
      return hasAny;
    } catch (_) {
      return false;
    }
  },

  async tryRefreshSession() {
    try {
      const refreshData = await performSilentRefresh();
      if (refreshData && refreshData.token) {
        const currentUser = this.getUser() || {};
        const mergedUser = refreshData.user ? { ...currentUser, ...refreshData.user } : currentUser;
        this.setSession(mergedUser, refreshData.token, refreshData.refresh_token);
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
    const origin = typeof window !== 'undefined' && window.location ? window.location.origin : 'https://centerly-eg.com';
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
