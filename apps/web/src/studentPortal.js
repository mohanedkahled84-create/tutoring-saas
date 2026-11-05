import {registerUnifiedPortalActions} from './components/UnifiedPortalLoginView.js?v=9.45.0';

// Use the existing student renderers/actions without initializing a teacher account.
export async function mountStudentPortal() {
  const app = {
    getAppEl:()=>document.getElementById('app'),
    renderLanding:()=>location.assign('/'),
    showToast(message) {
      document.getElementById('student-portal-toast')?.remove();
      const toast=document.createElement('div');
      toast.id='student-portal-toast';toast.setAttribute('role','status');toast.textContent=message;
      toast.style.cssText='position:fixed;bottom:20px;inset-inline:20px;margin:auto;max-width:440px;padding:12px 16px;background:#172d70;color:#fff;border-radius:12px;z-index:10000;text-align:center';
      document.body.append(toast);setTimeout(()=>toast.remove(),4000);
    },
    togglePasswordVisibility(id,button,event) {
      event?.preventDefault();
      const field=document.getElementById(id);if(!field)return;
      const visible=field.type==='password';field.type=visible?'text':'password';
      button?.setAttribute('aria-pressed',String(visible));
      button?.setAttribute('aria-label',visible?'إخفاء كلمة المرور':'إظهار كلمة المرور');
    }
  };
  registerUnifiedPortalActions(app);
  window.centrlyApp=app;
  window.switchPortalLoginRole=role=>app.switchPortalLoginRole(role);
  window.togglePasswordVisibility=(...args)=>app.togglePasswordVisibility(...args);
  const params=new URLSearchParams(location.search),arrival=window.__centrlyPortalArrival;
  const role=localStorage.getItem('centrly_portal_role') || sessionStorage.getItem('centrly_portal_role');
  if(params.get('role')==='student' || params.get('portal')==='student' || arrival?.role==='student' || role==='student')localStorage.setItem('centrly_portal_entry_role','student');
  if(arrival?.role==='student' && arrival.origin===location.origin){await app.loadStudentPortal(arrival.token);return app;}
  const token=params.get('token') || (role==='student' && (localStorage.getItem('centrly_portal_token') || sessionStorage.getItem('centrly_portal_token')));
  if(params.has('token') && params.get('portal')!=='student' && params.get('role')!=='student') await app.loadParentPortal(token);
  else if(token) await app.loadStudentPortal(token);
  else app.renderPortalLogin();
  return app;
}
