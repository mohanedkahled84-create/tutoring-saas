import { authService } from './services/auth.js';
import { renderSidebar } from './components/Sidebar.js';
import { renderNavbar } from './components/Navbar.js';
import { renderAuthScreens } from './components/AuthScreens.js';

class CentrlyApp {
  constructor() {
    this.currentRoute = 'sessions';
    this.user = authService.getUser();
  }

  init() {
    if (!authService.isAuthenticated()) {
      this.renderAuth();
    } else {
      this.renderApp();
    }
  }

  renderAuth() {
    document.getElementById('app').innerHTML = renderAuthScreens();
  }

  switchAuthTab(tab) {
    const formLogin = document.getElementById('formLogin');
    const formSignup = document.getElementById('formSignup');
    const tabLogin = document.getElementById('tabLogin');
    const tabSignup = document.getElementById('tabSignup');
    const alertBox = document.getElementById('authAlert');
    if (alertBox) alertBox.style.display = 'none';

    if (tab === 'login') {
      formLogin.style.display = 'block';
      formSignup.style.display = 'none';
      tabLogin.style.borderBottom = '2px solid var(--centrly-blue-700)';
      tabLogin.style.color = 'var(--centrly-blue-800)';
      tabSignup.style.borderBottom = '2px solid transparent';
      tabSignup.style.color = 'var(--centrly-text)';
    } else {
      formLogin.style.display = 'none';
      formSignup.style.display = 'block';
      tabSignup.style.borderBottom = '2px solid var(--centrly-blue-700)';
      tabSignup.style.color = 'var(--centrly-blue-800)';
      tabLogin.style.borderBottom = '2px solid transparent';
      tabLogin.style.color = 'var(--centrly-text)';
    }
  }

  showAuthAlert(msg, type = 'danger') {
    const alertBox = document.getElementById('authAlert');
    if (!alertBox) return;
    alertBox.textContent = msg;
    alertBox.style.display = 'block';
    if (type === 'danger') {
      alertBox.className = 'badge-danger';
      alertBox.style.backgroundColor = 'var(--centrly-danger-light)';
      alertBox.style.color = 'var(--centrly-danger)';
    } else {
      alertBox.className = 'badge-success';
      alertBox.style.backgroundColor = 'var(--centrly-success-light)';
      alertBox.style.color = 'var(--centrly-success)';
    }
  }

  async handleLogin(e) {
    e.preventDefault();
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;

    try {
      const res = await authService.login(email, password);
      this.user = res.user;
      this.renderApp();
    } catch (err) {
      this.showAuthAlert(err.message || 'فشل تسجيل الدخول. يرجى التحقق من البيانات.');
    }
  }

  async handleSignup(e) {
    e.preventDefault();
    const account_type = document.getElementById('signupAccountType').value;
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const phone = document.getElementById('signupPhone').value;
    const password = document.getElementById('signupPassword').value;

    try {
      const res = await authService.signup({
        email,
        password,
        name,
        phone,
        account_type,
        role: account_type === 'center' ? 'center_owner' : 'teacher'
      });
      this.user = res.user;
      this.renderApp();
    } catch (err) {
      this.showAuthAlert(err.message || 'فشل إنشاء الحساب. يرجى التحقق من المدخلات.');
    }
  }

  logout() {
    authService.logout();
  }

  toggleSidebar() {
    const sidebar = document.getElementById('appSidebar');
    if (sidebar) sidebar.classList.toggle('open');
  }

  navigate(route) {
    this.currentRoute = route;
    this.renderMainContent();
    // Update sidebar active link
    document.querySelectorAll('.sidebar-nav .nav-link').forEach(btn => {
      btn.classList.remove('active');
    });
  }

  renderApp() {
    const html = `
      <div class="app-container">
        ${renderSidebar(this.currentRoute)}
        <div class="app-main">
          ${renderNavbar(this.user)}
          <main class="content-body" id="mainContent">
            ${this.getContentHtml(this.currentRoute)}
          </main>
        </div>
      </div>
    `;
    document.getElementById('app').innerHTML = html;
  }

  renderMainContent() {
    const el = document.getElementById('mainContent');
    if (el) el.innerHTML = this.getContentHtml(this.currentRoute);
  }

  getContentHtml(route) {
    switch (route) {
      case 'sessions':
        return `
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">الحصص ولوحة تسجيل الحضور</h2>
              <button class="btn btn-primary btn-sm" onclick="alert('بدء حصة جديدة')">🟢 بدء حصة جديدة</button>
            </div>
            <p style="color: var(--centrly-text); font-size: 0.9rem;">
              يمكنك من هنا مسح كروت الطلاب بالباركود أو الكاميرا، رصد التسميع والواجب، وتسجيل الحضور بأمان.
            </p>
          </div>
        `;
      case 'dashboard':
        return `
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">لوحة تحكم المدرس والأرباح</h2>
              <span class="badge badge-success">حساب مفعّل</span>
            </div>
            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem; margin-top: 1rem;">
              <div class="card" style="margin: 0; background-color: var(--centrly-blue-100);">
                <div style="font-size: 0.8rem; color: var(--centrly-blue-800); font-weight: 700;">إجمالي الطلاب</div>
                <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-blue-900);">--</div>
              </div>
              <div class="card" style="margin: 0; background-color: var(--centrly-amber-100);">
                <div style="font-size: 0.8rem; color: var(--centrly-amber-700); font-weight: 700;">حصص اليوم</div>
                <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-amber-700);">--</div>
              </div>
            </div>
          </div>
        `;
      default:
        return `
          <div class="card">
            <div class="card-header">
              <h2 class="card-title">${route}</h2>
            </div>
            <p style="color: var(--centrly-text);">جاري تحميل بيانات القسم...</p>
          </div>
        `;
    }
  }
}

window.centrlyApp = new CentrlyApp();
window.addEventListener('DOMContentLoaded', () => {
  window.centrlyApp.init();
});
