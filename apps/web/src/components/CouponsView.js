import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Centrly Promo & Discount Codes Management View
 * Features:
 * - Overview KPI metrics (Total codes, Active codes, Total uses)
 * - Quick "Create New Promo Code" button
 * - Responsive table with 1-click copy, toggle active/inactive, delete
 * - Instant feedback and live database sync
 */

export function renderCouponsView(codes = [], user = {}) {
  const totalCodes = codes.length;
  const activeCodes = codes.filter(c => c.is_active !== false).length;
  const totalUses = codes.reduce((acc, c) => acc + Number(c.times_used || 0), 0);

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      
      <!-- Top Action Bar & Header -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #fff; border: none; border-radius: 16px; padding: 1.75rem; box-shadow: 0 10px 25px rgba(37,99,235,0.2);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span>${getIcon('billing', 24, '#fcd34d')}</span>
              <h2 style="margin: 0; font-size: 1.4rem; font-weight: 900; color: #fff;">
                إدارة أكواد الخصم والبروموكود (Promotional Codes)
              </h2>
            </div>
            <p style="font-size: 0.875rem; color: #cbd5e1; margin: 0;">
              أنشئ أكواد خصم بنسب مئوية (%) أو مبالغ نقدية ثابتة (ج.م) وتفعيلها فوراً للمشتركين عند سداد وتجديد الاشتراكات.
            </p>
          </div>

          <div style="display: flex; gap: 0.65rem; flex-wrap: wrap;">
            <button class="btn btn-warning" onclick="window.centrlyApp.openCreateCouponModal()" style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.6rem 1.25rem; border-radius: 10px; box-shadow: 0 4px 12px rgba(245,158,11,0.3);">
              ${getIcon('plus', 16)}
              <span>إنشاء كود خصم جديد</span>
            </button>
            <button class="btn" onclick="window.centrlyApp.loadRouteData('coupons')" style="background: rgba(255,255,255,0.15); color: #fff; border: 1px solid rgba(255,255,255,0.3); font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; border-radius: 10px;">
              ${getIcon('refresh', 14)}
              <span>تحديث</span>
            </button>
          </div>
        </div>
      </div>

      <!-- KPI Metrics Overview -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
        
        <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-blue-700); background: #fff;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الأكواد المنشأة</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin: 0.25rem 0;">
            ${totalCodes} <span style="font-size: 0.85rem; font-weight: 600; color: var(--centrly-text);">كود</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text);">
            مسجلة في قاعدة البيانات المركزية
          </div>
        </div>

        <div class="card" style="margin: 0; border-top: 4px solid #10b981; background: #fff;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">الأكواد النشطة والصالحة</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #047857; margin: 0.25rem 0;">
            ${activeCodes} <span style="font-size: 0.85rem; font-weight: 600; color: #10b981;">مفعل حالياً</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text);">
            جاهزة للاستخدام عند إتمام الدفع
          </div>
        </div>

        <div class="card" style="margin: 0; border-top: 4px solid #f59e0b; background: #fff;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي مرات الاستخدام</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #b45309; margin: 0.25rem 0;">
            ${totalUses} <span style="font-size: 0.85rem; font-weight: 600; color: var(--centrly-text);">مرة</span>
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text);">
            تم تطبيق التخفيض في تجديدات المشتركين
          </div>
        </div>

      </div>

      <!-- Coupons Table Card -->
      <div class="card" style="margin: 0; background: #fff; border-radius: 12px; box-shadow: var(--shadow-sm);">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; padding-bottom: 1rem; border-bottom: 1px solid #f1f5f9;">
          <div>
            <h3 class="card-title" style="font-size: 1.1rem; display: flex; align-items: center; gap: 0.45rem; margin: 0;">
              ${getIcon('billing', 18, 'var(--centrly-blue-700)')}
              <span>قائمة أكواد الخصم والبروموكود المتاحة</span>
            </h3>
            <p style="font-size: 0.8rem; color: var(--centrly-text); margin: 0.25rem 0 0 0;">
              يمكنك نسخ أي كود بضغطة زر، أو تعطيله مؤقتاً، أو حذفه نهائياً.
            </p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.openCreateCouponModal()" style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;">
            ${getIcon('plus', 14)}
            <span>كود خصم جديد</span>
          </button>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>كود الخصم (Code)</th>
                <th>نوع وقيمة الخصم</th>
                <th>مرات الاستخدام</th>
                <th>تاريخ الانتهاء</th>
                <th>الحالة</th>
                <th>الإجراءات السريعة</th>
              </tr>
            </thead>
            <tbody>
              ${codes.length > 0 ? codes.map(c => {
                const isPercent = typeof c.discount_percent === 'number' && c.discount_percent > 0;
                const valueText = isPercent ? `خصم ${c.discount_percent}%` : `خصم ${Number(c.discount_amount || 0).toLocaleString('ar-EG')} ج.م`;
                const maxText = c.max_uses ? `${c.times_used || 0} / ${c.max_uses}` : `${c.times_used || 0} (غير محدود)`;
                const isActive = c.is_active !== false;
                const isExpired = c.expires_at && new Date(c.expires_at) < new Date();
                const expiryText = c.expires_at ? new Date(c.expires_at).toLocaleDateString('ar-EG') : 'دائم بلا انتهاء';

                return `
                  <tr>
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.5rem;">
                        <span style="font-family: monospace; font-weight: 900; font-size: 1.05rem; letter-spacing: 0.05em; background: #eff6ff; color: var(--centrly-blue-800); border: 1.5px dashed #93c5fd; padding: 0.25rem 0.65rem; border-radius: 6px;">
                          ${escapeHtml(c.code)}
                        </span>
                        <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.copyCouponCode('${escapeHtml(c.code)}')" title="نسخ الكود" style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: inline-flex; align-items: center; gap: 0.25rem;">
                          ${getIcon('copy', 13)}
                          <span>نسخ</span>
                        </button>
                      </div>
                    </td>
                    <td>
                      <span class="badge ${isPercent ? 'badge-primary' : 'badge-success'}" style="font-size: 0.85rem; font-weight: 800; padding: 0.25rem 0.65rem;">
                        ${valueText}
                      </span>
                    </td>
                    <td style="font-weight: 700; font-family: monospace; font-size: 0.9rem;">
                      ${maxText}
                    </td>
                    <td style="font-size: 0.825rem; color: ${isExpired ? '#dc2626' : 'var(--centrly-text)'}; font-weight: ${isExpired ? '800' : '600'};">
                      ${isExpired ? `منتهي (${expiryText})` : expiryText}
                    </td>
                    <td>
                      <span class="badge ${isActive ? (isExpired ? 'badge-danger' : 'badge-success') : 'badge-secondary'}" style="font-size: 0.78rem; padding: 0.2rem 0.6rem;">
                        ${!isActive ? 'معطل مؤقتاً' : (isExpired ? 'منتهي الصلاحية' : 'مفعل وجاهز')}
                      </span>
                    </td>
                    <td>
                      <div style="display: flex; align-items: center; gap: 0.4rem;">
                        <button class="btn ${isActive ? 'btn-secondary' : 'btn-warning'} btn-sm" 
                          onclick="window.centrlyApp.toggleCouponStatus('${c.id}', ${!isActive})" 
                          style="font-size: 0.75rem; padding: 0.25rem 0.6rem; font-weight: 700;"
                          title="${isActive ? 'إيقاف الكود مؤقتاً' : 'إعادة تفعيل الكود'}">
                          ${isActive ? 'إيقاف' : 'تفعيل'}
                        </button>
                        <button class="btn btn-danger btn-sm" 
                          onclick="window.centrlyApp.deleteCoupon('${c.id}', '${escapeHtml(c.code)}')" 
                          style="padding: 0.25rem 0.5rem; font-size: 0.75rem; display: inline-flex; align-items: center; justify-content: center;"
                          title="حذف الكود نهائياً">
                          ${getIcon('trash', 13, '#ffffff')}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="6" style="text-align: center; padding: 3rem 1.5rem;">
                    <div style="width: 56px; height: 56px; background: #eff6ff; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 1rem auto; color: var(--centrly-blue-700);">
                      ${getIcon('billing', 28)}
                    </div>
                    <div style="font-weight: 800; font-size: 1rem; color: #0f172a; margin-bottom: 0.35rem;">
                      لا توجد أكواد خصم مسجلة حتى الآن
                    </div>
                    <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.25rem; max-width: 400px; margin-left: auto; margin-right: auto;">
                      أنشئ كود الخصم الأول الخاص بك مثل (WELCOME50 أو EID2026) ليتم تطبيقه فوراً عند الاشتراك.
                    </p>
                    <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.openCreateCouponModal()" style="font-weight: 800; padding: 0.55rem 1.25rem;">
                      إنشاء كود خصم جديد الآن
                    </button>
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  `;
}
