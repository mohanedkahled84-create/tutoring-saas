import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Centrly Superadmin - Tenants Management View
 * Allows platform administrators to view, search, and manage all registered
 * solo teachers and educational centers with live status and manual subscription overrides.
 */

function formatArabicDate(dateStr) {
  if (!dateStr) return 'غير محدد';
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const months = [
      'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
      'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
    ];
    return `${d.getDate()} ${months[d.getMonth()]} ${d.getFullYear()}`;
  } catch {
    return dateStr;
  }
}

export function renderAdminTenantsView(data = {}, currentFilter = 'all', searchQuery = '') {
  const tenants = data.tenants || [];
  const filter = currentFilter || 'all';
  const query = (searchQuery || '').toLowerCase().trim();

  const totalCount = tenants.length;
  const activeCount = tenants.filter(t => t.subscription_status === 'active').length;
  const trialCount = tenants.filter(t => t.subscription_status === 'trial').length;
  const pendingCount = tenants.filter(t => t.subscription_status === 'pending_verification' || t.subscription_status === 'pending').length;
  const expiredCount = tenants.filter(t => t.subscription_status === 'expired' || t.subscription_status === 'past_due' || t.subscription_status === 'deactivated').length;

  const filteredTenants = tenants.filter(t => {
    // Status filter
    if (filter === 'active' && t.subscription_status !== 'active') return false;
    if (filter === 'trial' && t.subscription_status !== 'trial') return false;
    if (filter === 'pending' && t.subscription_status !== 'pending_verification' && t.subscription_status !== 'pending') return false;
    if (filter === 'expired' && !['expired', 'past_due', 'deactivated'].includes(t.subscription_status)) return false;

    // Search query
    if (query) {
      const matchName = (t.name || '').toLowerCase().includes(query);
      const matchEmail = (t.email || '').toLowerCase().includes(query);
      const matchPhone = (t.phone || '').toLowerCase().includes(query);
      return matchName || matchEmail || matchPhone;
    }
    return true;
  });

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      
      <!-- Top Action Bar -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #0f172a, #1e3a8a); color: #fff; border: none; border-radius: 16px; padding: 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span>${getIcon('teachers', 24, '#38bdf8')}</span>
              <h2 style="margin: 0; font-size: 1.3rem; font-weight: 900; color: #fff;">
                إدارة المعلمين والمؤسسات (Tenants Management)
              </h2>
              <span class="badge" style="background: #0284c7; color: #fff; font-weight: 700;">
                خاص بالإدارة العليا
              </span>
            </div>
            <p style="font-size: 0.85rem; color: #cbd5e1; margin-top: 0.35rem;">
              دليل شامل لجميع المدرسين والسناتر المسجلين في سنترلي، مع التحكم الكامل في فترات التجربة وتجديد الاشتراكات يدوياً.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.refreshAdminTenants()" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); color: #fff; display: inline-flex; align-items: center; gap: 0.35rem;">
              ${getIcon('refresh', 14)}
              <span>تحديث البيانات</span>
            </button>
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('admin-dashboard')" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
              ${getIcon('dashboard', 14)}
              <span>لوحة الإدارة</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Quick Stats KPI Bar -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(170px, 1fr)); gap: 0.75rem;">
        <div class="card" style="margin: 0; padding: 1rem; border-right: 4px solid var(--centrly-blue-700);">
          <span style="font-size: 0.775rem; color: #64748b; font-weight: 700;">إجمالي المشتركين</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: var(--centrly-ink); margin-top: 0.2rem;">${totalCount}</div>
        </div>
        <div class="card" style="margin: 0; padding: 1rem; border-right: 4px solid #10b981;">
          <span style="font-size: 0.775rem; color: #64748b; font-weight: 700;">اشتراكات نشطة</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #10b981; margin-top: 0.2rem;">${activeCount}</div>
        </div>
        <div class="card" style="margin: 0; padding: 1rem; border-right: 4px solid #0284c7;">
          <span style="font-size: 0.775rem; color: #64748b; font-weight: 700;">فترة تجريبية</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #0284c7; margin-top: 0.2rem;">${trialCount}</div>
        </div>
        <div class="card" style="margin: 0; padding: 1rem; border-right: 4px solid #f59e0b;">
          <span style="font-size: 0.775rem; color: #64748b; font-weight: 700;">بانتظار التأكيد</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #d97706; margin-top: 0.2rem;">${pendingCount}</div>
        </div>
        <div class="card" style="margin: 0; padding: 1rem; border-right: 4px solid #ef4444;">
          <span style="font-size: 0.775rem; color: #64748b; font-weight: 700;">اشتراكات منتهية</span>
          <div style="font-size: 1.4rem; font-weight: 900; color: #ef4444; margin-top: 0.2rem;">${expiredCount}</div>
        </div>
      </div>

      <!-- Search & Filters Toolbar -->
      <div class="card" style="margin: 0; padding: 1rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          
          <div style="position: relative; flex: 1; min-width: 260px;">
            <input type="text" id="adminTenantsSearchInput" class="form-input" placeholder="ابحث باسم المعلم، السنتر، الإيميل، أو الهاتف..." value="${escapeHtml(query)}" oninput="window.centrlyApp.handleAdminTenantsSearch(this.value)" style="padding-right: 2.25rem; font-size: 0.85rem;">
            <span style="position: absolute; right: 10px; top: 50%; transform: translateY(-50%); color: #94a3b8; display: flex; align-items: center; pointer-events: none;">
              ${getIcon('search', 16)}
            </span>
          </div>

          <!-- Status Filter Pills -->
          <div style="display: flex; gap: 0.35rem; flex-wrap: wrap;">
            <button type="button" class="btn ${filter === 'all' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.centrlyApp.setAdminTenantsFilter('all')" style="font-weight: 700; font-size: 0.8rem; border-radius: 8px;">الكل</button>
            <button type="button" class="btn ${filter === 'active' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.centrlyApp.setAdminTenantsFilter('active')" style="font-weight: 700; font-size: 0.8rem; border-radius: 8px;">نشط</button>
            <button type="button" class="btn ${filter === 'trial' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.centrlyApp.setAdminTenantsFilter('trial')" style="font-weight: 700; font-size: 0.8rem; border-radius: 8px;">تجربة</button>
            <button type="button" class="btn ${filter === 'pending' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.centrlyApp.setAdminTenantsFilter('pending')" style="font-weight: 700; font-size: 0.8rem; border-radius: 8px;">بانتظار التأكيد</button>
            <button type="button" class="btn ${filter === 'expired' ? 'btn-primary' : 'btn-secondary'} btn-sm" onclick="window.centrlyApp.setAdminTenantsFilter('expired')" style="font-weight: 700; font-size: 0.8rem; border-radius: 8px;">منتهي</button>
          </div>

        </div>
      </div>

      <!-- Tenants Table / Cards List -->
      ${filteredTenants.length === 0 ? `
        <div class="card" style="text-align: center; padding: 3rem 1.5rem; color: var(--centrly-text);">
          <div style="margin-bottom: 0.75rem; display: flex; justify-content: center;">
            ${getIcon('info', 36, '#94a3b8')}
          </div>
          <h3 style="font-size: 1.15rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.4rem;">
            لا توجد نتائج مطابقة للبحث أو الفلتر
          </h3>
          <p style="font-size: 0.85rem; margin: 0;">
            جرب كتابة اسم مختلف أو تغيير الفلتر المحدد أعلاه.
          </p>
        </div>
      ` : `
        <div class="card" style="margin: 0; padding: 0; overflow: hidden; border-radius: 14px;">
          <div style="overflow-x: auto;">
            <table class="table" style="width: 100%; border-collapse: collapse; text-align: right; font-size: 0.85rem;">
              <thead style="background: #f8fafc; border-bottom: 1.5px solid var(--centrly-line);">
                <tr>
                  <th style="padding: 0.85rem 1rem; font-weight: 800; color: var(--centrly-ink);">المعلم / المؤسسة</th>
                  <th style="padding: 0.85rem 1rem; font-weight: 800; color: var(--centrly-ink);">النوع</th>
                  <th style="padding: 0.85rem 1rem; font-weight: 800; color: var(--centrly-ink);">حالة الاشتراك</th>
                  <th style="padding: 0.85rem 1rem; font-weight: 800; color: var(--centrly-ink);">تاريخ الانتهاء</th>
                  <th style="padding: 0.85rem 1rem; font-weight: 800; color: var(--centrly-ink);">الطلاب</th>
                  <th style="padding: 0.85rem 1rem; font-weight: 800; color: var(--centrly-ink); text-align: left;">إجراءات الإدارة</th>
                </tr>
              </thead>
              <tbody>
                ${filteredTenants.map((t, idx) => {
                  const status = t.subscription_status || 'trial';
                  const isCenter = t.account_type === 'center';
                  const expiryDate = t.subscription_ends_at || t.trial_ends_at;

                  let statusBadge = '';
                  if (status === 'active') {
                    statusBadge = `<span class="badge" style="background: #dcfce7; color: #166534; font-weight: 800; border: 1px solid #bbf7d0;">نشط (Active)</span>`;
                  } else if (status === 'trial') {
                    statusBadge = `<span class="badge" style="background: #e0f2fe; color: #0369a1; font-weight: 800; border: 1px solid #bae6fd;">فترة تجريبية</span>`;
                  } else if (status === 'pending_verification' || status === 'pending') {
                    statusBadge = `<span class="badge" style="background: #fef3c7; color: #92400e; font-weight: 800; border: 1px solid #fde68a;">بانتظار التأكيد</span>`;
                  } else {
                    statusBadge = `<span class="badge" style="background: #fee2e2; color: #991b1b; font-weight: 800; border: 1px solid #fecaca;">منتهي / متوقف</span>`;
                  }

                  return `
                    <tr style="border-bottom: 1px solid #f1f5f9; ${idx % 2 === 1 ? 'background: #fdfdfd;' : ''}">
                      
                      <!-- Name and Contact -->
                      <td style="padding: 0.85rem 1rem;">
                        <div style="font-weight: 800; color: var(--centrly-ink); font-size: 0.95rem;">
                          ${escapeHtml(t.name || 'مؤسسة')}
                        </div>
                        <div style="font-size: 0.775rem; color: #64748b; margin-top: 0.2rem; display: flex; gap: 0.6rem; flex-wrap: wrap;">
                          ${t.email ? `<span>${escapeHtml(t.email)}</span>` : ''}
                          ${t.phone ? `<span dir="ltr" style="font-family: monospace;">${escapeHtml(t.phone)}</span>` : ''}
                        </div>
                      </td>

                      <!-- Type -->
                      <td style="padding: 0.85rem 1rem;">
                        <span class="badge ${isCenter ? 'badge-blue' : 'badge-warning'}" style="font-size: 0.75rem; font-weight: 700;">
                          ${isCenter ? 'سنتر تعليمي' : 'مدرس فردي'}
                        </span>
                      </td>

                      <!-- Status -->
                      <td style="padding: 0.85rem 1rem;">
                        ${statusBadge}
                      </td>

                      <!-- Expiry Date -->
                      <td style="padding: 0.85rem 1rem; color: #334155; font-weight: 700;">
                        ${formatArabicDate(expiryDate)}
                      </td>

                      <!-- Students & Plan -->
                      <td style="padding: 0.85rem 1rem;">
                        <div style="font-weight: 800; color: var(--centrly-blue-800);">
                          ${t.students_count !== undefined ? t.students_count : '0'} / ${t.students_limit || (t.subscription_tier === 'growth' ? 750 : t.subscription_tier === 'pro' ? 1500 : 300)} طالب
                        </div>
                        <div style="font-size: 0.75rem; color: #475569; font-weight: 700; margin-top: 0.2rem;">
                          ${t.plan_name || (t.subscription_tier === 'growth' ? 'باقة 750 طالب' : t.subscription_tier === 'pro' ? 'باقة 1500 طالب' : 'باقة 300 طالب')}
                        </div>
                      </td>

                      <!-- Actions -->
                      <td style="padding: 0.85rem 1rem; text-align: left;">
                        <div style="display: flex; gap: 0.35rem; justify-content: flex-end;">
                          <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openTenantOverrideModal('${t.id}', '${escapeHtml(t.name)}', '${status}', '${t.subscription_tier || 'growth'}')" style="font-weight: 800; font-size: 0.775rem; display: inline-flex; align-items: center; gap: 0.3rem;">
                            ${getIcon('gear', 12)}
                            <span>تعديل الصلاحية والخطة</span>
                          </button>
                        </div>
                      </td>

                    </tr>
                  `;
                }).join('')}
              </tbody>
            </table>
          </div>
        </div>
      `}

    </div>
  `;
}