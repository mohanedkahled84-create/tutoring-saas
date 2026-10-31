import {renderParentPortalView, parentPortalSnapshot} from './components/ParentPortalView.js';
import {renderParentPortalLogin, getParentBranding, saveParentBranding} from './components/ParentPortalLoginView.js';
import {portalCache, portalRequest, adoptVerifiedPortalSession} from './utils/portalSession.js';
import {preparePortalDestination} from './utils/portalDestination.js';
import {normalizeDigits} from './utils/normalizeDigits.js';
import {registerFamilyActions,savedFamilyToken,redeemFamilyEntry} from './parentFamily.js';
function showPortalPending(app) { const root=app.getAppEl(); if(root) window.renderPortalOpening(root); }
export function registerParentPortalActions(app) {
  app.setParentFamilyMode=function(value) {this._familyMode=Boolean(value);this.renderPortalLogin();document.getElementById('portalIdentifier')?.focus();};
  app.loadParentPortal = async function loadParentPortal(token, options = {}) {
    window.__centrlyLoaded = true;
    this._parentPortalToken = token;
    try {
      if (typeof localStorage !== 'undefined' && token) {
        localStorage.setItem('centrly_portal_token', token);
        localStorage.setItem('centrly_portal_role', 'parent');
      }
      if (typeof sessionStorage !== 'undefined' && token) {
        sessionStorage.setItem('centrly_portal_token', token);
        sessionStorage.setItem('centrly_portal_role', 'parent');
      }
      if (window.history && window.history.replaceState && (window.location.pathname !== '/portal' || window.location.search || window.location.hash)) {
        window.history.replaceState(null, '', window.location.pathname === '/portal-entry' ? '/portal-entry' : '/portal');
      }
    } catch (_) {}

    const paint = data => {
      const appEl = this.getAppEl();
      if (!appEl) return;
      let tab = 'attendance';
      try { tab = localStorage.getItem('centrly_portal_parent_tab') || 'attendance'; } catch (_) {}
      // Branding is refreshed with the verified destination, not inferred from phone numbers.
      const focused = appEl.contains(document.activeElement) ? document.activeElement.id : '';
      appEl.innerHTML = renderParentPortalView({...data, portal_presentation:this._portalPresentation || data.portal_presentation}, tab);
      if (focused) document.getElementById(focused)?.focus({preventScroll:true});
      this._parentPortalRenderedToken = token;
      saveParentBranding(this._portalPresentation || data.portal_presentation);
      const refresh = appEl.querySelector('#parent-refresh-data-btn');
      if (refresh && this._parentPortalRefreshing) { refresh.disabled = true; refresh.setAttribute('aria-busy','true'); }
    };
    const status = failed => {
      const node = this.getAppEl()?.querySelector('#parent-sync-status');
      if (node) node.textContent = failed ? 'تعذر الاتصال؛ نعرض آخر بيانات محفوظة. جرّب التحديث.' : '';
    };
    try {
      const arrival=window.__centrlyPortalArrival;
      if(!options.force && arrival?.token===token && arrival.role==='parent' && arrival.origin===location.origin && arrival.initial_data?.student?.id) {
        await portalCache.write(token,{...parentPortalSnapshot(arrival.initial_data),portal_presentation:arrival.presentation},'parent');
      }
      const cached = await portalCache.read(token, 'parent');
      if (cached && (this._parentPortalRenderedToken !== token || !this.getAppEl()?.querySelector('#pp-student'))) paint(cached.data);
      else if (this._parentPortalRenderedToken !== token) showPortalPending(this);
      if (!cached?.fresh || options.force || window.__centrlyPortalArrival) {
        if (await preparePortalDestination(this, token, 'parent', portalRequest)) return false;
      }
      const result = await portalCache.load(token, {
        role:'parent', request:async path => {
          const data = await portalRequest(path+'&view=parent');
          return {...parentPortalSnapshot(data), portal_presentation:this._portalPresentation};
        }, force:options.force === true,
        onData:(data, meta) => { if (!meta.cached || !cached) paint(data); }
      });
      status(!!result.error);
      return !result.error;
    } catch (err) {
      if (err?.code === 'PORTAL_CACHE_INVALIDATED') return false;
      if (err?.code === 'PORTAL_SESSION_CHANGED') return false;
      if (err?.status === 401 || err?.status === 403) {
        portalCache.clear('parent');
        try {
          localStorage.removeItem('centrly_portal_token'); localStorage.removeItem('centrly_portal_role');
          sessionStorage.removeItem('centrly_portal_token'); sessionStorage.removeItem('centrly_portal_role');
        } catch (_) {}
        this._parentPortalRenderedToken = null;
        this.renderPortalLogin('انتهت صلاحية الجلسة، يرجى تسجيل الدخول مجدداً');
        return false;
      }
      const fallback = await portalCache.read(token, 'parent');
      if (fallback) { paint(fallback.data); status(true); return false; }
      const root = this.getAppEl();
      if (root) root.innerHTML = renderParentPortalView({error:err?.message || 'تعذر تحميل المتابعة. تحقق من الاتصال وأعد المحاولة.'});
      return false;
    }
  }

  app.reloadParentPortal = async function reloadParentPortal() {
    if (this._parentPortalRefreshing) return false;
    const button = this.getAppEl()?.querySelector('#parent-refresh-data-btn');
    if (button) { button.disabled = true; button.setAttribute('aria-busy','true'); }
    this._parentPortalRefreshing = true;
    try {
      if(savedFamilyToken())return await this.loadFamilyPortal({force:true});
      if (!this._parentPortalToken) { window.location.reload(); return false; }
      return await this.loadParentPortal(this._parentPortalToken, {force:true});
    } finally {
      this._parentPortalRefreshing = false;
      const current = this.getAppEl()?.querySelector('#parent-refresh-data-btn');
      if (current) { current.disabled = false; current.removeAttribute('aria-busy'); }
    }
  }

}

export async function mountParentPortal(errorMessage = '') {
  // Public parent pages do not initialize staff authentication, dashboards or student UI.
  const app = {
    getAppEl:()=>document.getElementById('app'),
    _portalPresentation:getParentBranding(),
    renderPortalLogin(message='') {
      window.__centrlyLoaded=true;
      saveParentBranding(this._portalPresentation || getParentBranding());
      this.getAppEl().innerHTML=renderParentPortalLogin(message,this._portalPresentation || getParentBranding(),this._familyMode);
      history.replaceState(null,'',location.pathname==='/portal-entry'?'/portal-entry':'/portal?role=parent'+(this._familyMode?'&family=1':''));
    },
    handlePortalLogout() {
      this.logoutFamily();
      saveParentBranding(this._portalPresentation);
      portalCache.clear('parent'); portalCache.clear('student');
      for(const storage of [localStorage,sessionStorage]) {
        for(const key of ['centrly_portal_token','centrly_portal_role','centrly_student_portal_token','centrly_portal_last_id']) storage.removeItem(key);
      }
      this._parentPortalToken=null;this._parentPortalRenderedToken=null;
      window.__centrlyPortalArrival=null;
      this.renderPortalLogin();
    },
    async handlePortalLogin(event) {
      event.preventDefault();
      if(this._loginPending) return;
      const form=document.getElementById('portalLoginForm'),button=document.getElementById('portalSubmitBtn'),alert=document.getElementById('portalLoginAlert');
      if(!form.reportValidity())return;
      this._loginPending=true;button.disabled=true;button.setAttribute('aria-busy','true');
      alert.hidden=true;
      try {
        if(this._familyMode){await this.loginFamily(form.elements.identifier.value,form.elements.password.value);return;}
        const response=await portalRequest('/public/portal/login',{method:'POST',body:{identifier:normalizeDigits(form.elements.identifier.value).trim(),password:normalizeDigits(form.elements.password.value).trim(),role:'parent'}});
        if(!response?.success || !response.token) throw Error('تعذر تسجيل الدخول. راجع بياناتك وحاول مجددًا.');
        await adoptVerifiedPortalSession(response.token,'parent');
        await this.loadParentPortal(response.token);
      } catch(error) {
        alert.textContent=error.message || 'تعذر الاتصال، حاول مجددًا.';alert.hidden=false;alert.style.display='block';alert.focus();
      } finally {
        this._loginPending=false;
        if(button.isConnected){button.disabled=false;button.removeAttribute('aria-busy');}
      }
    },
    toggleParentPassword(button) {
      const field=document.getElementById('portalPassword'),visible=field.type==='password';
      field.type=visible?'text':'password';button.textContent=visible?'إخفاء':'إظهار';button.setAttribute('aria-pressed',String(visible));
    }
  };
  registerParentPortalActions(app);registerFamilyActions(app);window.centrlyApp=app;window.__centrlyLoaded=true;
  app._familyMode=new URLSearchParams(location.search).get('family')==='1' || !!savedFamilyToken();
  const familyTicket=new URLSearchParams(location.hash.slice(1)).get('family');
  if(familyTicket){
    history.replaceState(null,'','/portal-entry');app._familyMode=true;
    try{await app.loadFamilyPortal({arrival:await redeemFamilyEntry(familyTicket)});}catch(error){app.renderPortalLogin(error.message);}return app;
  }
  // An explicit legacy capability stays scoped to that student, even on a family device.
  if(window.__centrlyPortalArrival?.role==='parent' && savedFamilyToken()){app.logoutFamily();app._familyMode=false;}
  if(savedFamilyToken() && !errorMessage){await app.loadFamilyPortal();return app;}
  if(app._familyMode){app.renderPortalLogin(errorMessage);return app;}
  const token=localStorage.getItem('centrly_portal_token') || sessionStorage.getItem('centrly_portal_token');
  const role=localStorage.getItem('centrly_portal_role') || sessionStorage.getItem('centrly_portal_role');
  if(token && role==='parent' && !errorMessage) await app.loadParentPortal(token);
  else {
    app.renderPortalLogin(errorMessage);
    const slug=location.hostname.match(/^([a-z0-9-]+)\.(?:centerly-eg\.com|centrly\.app)$/)?.[1];
    // Only public platform metadata may survive logout. This does not grant access.
    if(!app._portalPresentation && slug && slug!=='www') {
      portalRequest('/platform/public/'+encodeURIComponent(slug)).then(response=>{
        const settings=response?.settings;
        if(!settings || settings.subdomain!==slug || settings.is_active===false || settings.is_published===false) return;
        if(window.centrlyApp!==app || !document.getElementById('parent-login-brand'))return;
        app._portalPresentation=settings;saveParentBranding(settings);
        document.getElementById('parent-login-brand').textContent=settings.display_title || 'متابعة ولي الأمر';
      }).catch(()=>{}); // Login stays usable when public metadata is temporarily unavailable.
    }
  }
}
