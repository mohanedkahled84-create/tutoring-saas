import { request, API_BASE_URL, performSilentRefresh, isJwtExpired } from './api.js';

export const authService = {
  getUser() {
    try {
      let parsed = null;
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_user') : null;
      if (local) {
        if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('centrly_user')) {
          try { sessionStorage.setItem('centrly_user', local); } catch (_) {}
        }
        parsed = JSON.parse(local);
      } else {
        const session = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('centrly_user') : null;
        if (session) {
          if (typeof localStorage !== 'undefined' && !localStorage.getItem('centrly_user')) {
            try { localStorage.setItem('centrly_user', session); } catch (_) {}
          }
          parsed = JSON.parse(session);
        }
      }
      if (parsed) {
        const email = (parsed.email || '').toLowerCase();
        const adminEmails = ['mohanedkahled84@gmail.com', 'mohanedkhaled84@gmail.com', 'mohanedkhaled2367@gmail.com', 'teacher@centrly.app'];
        if (adminEmails.includes(email)) {
          parsed.role = 'admin';
          parsed.is_superadmin = true;
          parsed.name = 'مهند خالد';
          parsed.full_name = 'مهند خالد';
          parsed.tenant_id = 'df534fa1-c1a6-4b29-a6ab-80cb4aceb9e9';
          parsed.tenant_name = 'إدارة المنظومة (Centrly HQ)';
        } else if (email === 'mohanedabdulhalim@gmail.com') {
          // Strictly protect Mr. Omar El-Mohamady's teacher identity & tenant
          parsed.role = 'owner';
          parsed.is_superadmin = false;
          parsed.name = 'مستر عمر المحمدي';
          parsed.full_name = 'مستر عمر المحمدي';
          parsed.teacher_name = 'مستر عمر المحمدي';
          parsed.tenant_id = '0c67b644-ae42-49e8-975f-85b9d0af0e1b';
          parsed.tenant_name = 'مستر عمر المحمدي - منظومة تعليمية';
        }
      }
      return parsed;
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
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_token') : null;
      if (local) {
        if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('centrly_token')) {
          try { sessionStorage.setItem('centrly_token', local); } catch (_) {}
        }
        return local;
      }
      const session = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('centrly_token') : null;
      if (session) {
        if (typeof localStorage !== 'undefined' && !localStorage.getItem('centrly_token')) {
          try { localStorage.setItem('centrly_token', session); } catch (_) {}
        }
        return session;
      }
      return null;
    } catch (_) {
      return null;
    }
  },

  getRefreshToken() {
    try {
      const local = typeof localStorage !== 'undefined' ? localStorage.getItem('centrly_refresh_token') : null;
      if (local) {
        if (typeof sessionStorage !== 'undefined' && !sessionStorage.getItem('centrly_refresh_token')) {
          try { sessionStorage.setItem('centrly_refresh_token', local); } catch (_) {}
        }
        return local;
      }
      const session = typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('centrly_refresh_token') : null;
      if (session) {
        if (typeof localStorage !== 'undefined' && !localStorage.getItem('centrly_refresh_token')) {
          try { localStorage.setItem('centrly_refresh_token', session); } catch (_) {}
        }
        return session;
      }
      return null;
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
        'centrly_redirect_route',
        'centrly_portal_token',
        'centrly_portal_mode',
        'centrly_portal_student',
        'centrly_portal_role',
        'centrly_portal_data',
      ];
      specificKeys.forEach(k => {
        if (typeof localStorage !== 'undefined') localStorage.removeItem(k);
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(k);
      });

      // Clear all centrly and supabase caches from browser storage
      if (typeof localStorage !== 'undefined') {
        const toRemove = [];
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          if (k && (k.startsWith('centrly_') || k.startsWith('sb-'))) {
            toRemove.push(k);
          }
        }
        toRemove.forEach(k => localStorage.removeItem(k));
      }

      if (typeof sessionStorage !== 'undefined') {
        const toRemove = [];
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          if (k && (k.startsWith('centrly_') || k.startsWith('sb-'))) {
            toRemove.push(k);
          }
        }
        toRemove.forEach(k => sessionStorage.removeItem(k));
      }
    } catch (_) {}
  },

  isTokenExpired(token) {
    return isJwtExpired(token, 30);
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
      try {
        if (typeof sessionStorage !== 'undefined') sessionStorage.clear();
      } catch (_) {}
      // Navigate cleanly to home page without lingering route queries or paths
      window.location.href = window.location.origin + '/';
    }
  }
};
