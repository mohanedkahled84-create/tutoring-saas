import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

/**
 * Centrly Business Owner & Founder Dashboard (DEV-78)
 * Executive Metrics Screen for Platform Owners:
 * - MRR & ARR in EGP
 * - Tenant Growth & Subscription Breakdown
 * - Consolidated WhatsApp Usage & Estimated Cost
 * - Churn Signals & At-Risk Accounts
 */

export function renderBusinessOwnerDashboard(data = {}) {
  const overview = data.overview || {
    total_tenants: 0,
    active_tenants: 0,
    trial_tenants: 0,
    mrr_egp: 0,
    total_students: 0,
    total_sessions: 0,
    whatsapp: {
      total_sent: 0,
      total_failed: 0,
      estimated_cost_egp: 0,
    },
  };

  const subs = data.subscription_breakdown || {
    active: 0,
    trial: 0,
    pending_verification: 0,
    expired: 0,
  };

  const atRisk = data.at_risk_tenants || [];
  const recentSignups = data.recent_signups || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Top Action Bar & Founder Banner -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
              <span>${getIcon('dashboard', 24, '#3b82f6')}</span>
              <h2 style="margin: 0; font-size: 1.3rem; font-weight: 800; color: #fff;">لوحة تحكم المؤسس وإحصائيات الأعمال (Centrly HQ)</h2>
              <span class="badge" style="background: #2563eb; color: #fff; font-weight: 700;">المدير والمؤسس: مهند خالد</span>
            </div>
            <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.35rem;">
              منظومة الإدارة المركزية المستقلة لمتابعة نمو المنصة، إجمالي الأرباح، مراجعة إيصالات الدفع وإدارة المعلمين والسناتر
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('admin-proofs')" style="display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; background: #2563eb;">
              ${getIcon('billing', 14)}
              <span>مراجعة الإيصالات</span>
              ${subs.pending_verification > 0 ? `<span style="background: #f59e0b; color: #0f172a; font-size: 0.725rem; font-weight: 900; padding: 0.1rem 0.4rem; border-radius: 9999px;">${subs.pending_verification}</span>` : ''}
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('admin-tenants')" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); color: #fff; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
              ${getIcon('teachers', 14)}
              <span>إدارة المشتركين</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('coupons')" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.25); color: #fff; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
              ${getIcon('billing', 14)}
              <span>أكواد الخصم</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.refreshBusinessDashboard()" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; display: inline-flex; align-items: center; gap: 0.35rem;">
              ${getIcon('refresh', 14)}
              <span>تحديث</span>
            </button>
          </div>
        </div>
      </div>

      ${subs.pending_verification > 0 ? `
        <div class="card" style="margin: 0; background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 1rem 1.25rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="display: flex; align-items: center; justify-content: center; width: 36px; height: 36px; border-radius: 50%; background: #fef3c7; color: #d97706;">
              ${getIcon('billing', 18, '#d97706')}
            </span>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #92400e;">
                يوجد ${subs.pending_verification} إيصال تحويل بانتظار مراجعتك وتفعيل الاشتراك
              </div>
              <div style="font-size: 0.8rem; color: #b45309; margin-top: 0.15rem;">
                قام المشتركون بتحويل الرسوم ورفع الاسكرين شوت، يمكنك اعتماد وتفعيل اشتراكهم الآن بضغطة زر.
              </div>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('admin-proofs')" style="font-weight: 800; padding: 0.55rem 1.1rem; font-size: 0.85rem; background: #d97706; border-color: #d97706;">
            مراجعة وتفعيل الإيصالات الآن
          </button>
        </div>
      ` : ''}

      <!-- Core Financial & Growth KPIs -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 1rem;">
        
        <div class="card" style="margin: 0; border-top: 4px solid #10b981;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">الإيراد الشهري التقديري (MRR)</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #10b981; margin: 0.25rem 0;">
            ${overview.mrr_egp.toLocaleString('ar-EG')} ج.م
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text);">
            من ${overview.active_tenants} اشتراك مدفوع نشط
          </div>
        </div>

        <div class="card" style="margin: 0; border-top: 4px solid var(--centrly-primary);">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي المعلمين والمؤسسات</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: var(--centrly-ink); margin: 0.25rem 0;">
            ${overview.total_tenants}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text); display: flex; align-items: center; gap: 0.35rem;">
            ${getIcon('dotSuccess', 8)} <span>${overview.active_tenants} نشط • ${overview.trial_tenants} تجربة</span>
          </div>
        </div>

        <div class="card" style="margin: 0; border-top: 4px solid #25D366;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">رسائل الواتساب المرسلة</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #15803d; margin: 0.25rem 0;">
            ${overview.whatsapp.total_sent.toLocaleString('ar-EG')}
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text);">
            التكلفة التقديرية: ~${overview.whatsapp.estimated_cost_egp} ج.م (فشل: ${overview.whatsapp.total_failed})
          </div>
        </div>

        <div class="card" style="margin: 0; border-top: 4px solid #8b5cf6;">
          <div style="font-size: 0.8rem; color: var(--centrly-text); font-weight: 700;">إجمالي الطلاب والحصص</div>
          <div style="font-size: 1.8rem; font-weight: 900; color: #6d28d9; margin: 0.25rem 0;">
            ${overview.total_students} طالب
          </div>
          <div style="font-size: 0.75rem; color: var(--centrly-text);">
            تم إنجاز ${overview.total_sessions} حصة دراسية
          </div>
        </div>

      </div>

      <!-- Subscription Health Breakdown -->
      <div class="card" style="margin: 0;">
        <h3 class="card-title" style="font-size: 1.05rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
          ${getIcon('reports', 18, 'var(--centrly-blue-700)')}
          <span>توزيع الاشتراكات وحالة الحسابات عبر المنصة</span>
        </h3>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <div style="padding: 0.5rem 1rem; border-radius: 6px; background: #ecfdf5; border: 1px solid #a7f3d0;">
            <span style="font-size: 0.8rem; color: #065f46;">نشط (Active):</span>
            <b style="color: #047857; margin-right: 0.35rem;">${subs.active}</b>
          </div>
          <div style="padding: 0.5rem 1rem; border-radius: 6px; background: #eff6ff; border: 1px solid #bfdbfe;">
            <span style="font-size: 0.8rem; color: #1e40af;">فترة تجريبية (Trial):</span>
            <b style="color: #1d4ed8; margin-right: 0.35rem;">${subs.trial}</b>
          </div>
          <div style="padding: 0.5rem 1rem; border-radius: 6px; background: #fefce8; border: 1px solid #fef08a;">
            <span style="font-size: 0.8rem; color: #854d0e;">بانتظار تأكيد التحويل:</span>
            <b style="color: #a16207; margin-right: 0.35rem;">${subs.pending_verification}</b>
          </div>
          <div style="padding: 0.5rem 1rem; border-radius: 6px; background: #fef2f2; border: 1px solid #fecaca;">
            <span style="font-size: 0.8rem; color: #991b1b;">منتهي (Expired):</span>
            <b style="color: #b91c1c; margin-right: 0.35rem;">${subs.expired}</b>
          </div>
        </div>
      </div>

      <!-- Promo & Gift Codes Management Banner -->
      <div class="card" style="margin: 0; background: #fff; border: 1.5px solid #dbeafe; border-radius: 12px; padding: 1.15rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="width: 40px; height: 40px; border-radius: 10px; background: #eff6ff; display: flex; align-items: center; justify-content: center; color: var(--centrly-blue-700);">
              ${getIcon('billing', 20, 'var(--centrly-blue-700)')}
            </span>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                أكواد الخصم والبروموكود (Centrly Promo Codes)
              </div>
              <div style="font-size: 0.78rem; color: #64748b; margin-top: 0.15rem;">
                إدارة أكواد الخصم المئوية والنقدية، ومتابعة معدلات الاستخدام، وإنشاء حملات الخصم للمشتركين.
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap;">
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.openCreateCouponModal()" style="font-weight: 800; display: inline-flex; align-items: center; gap: 0.35rem;">
              ${getIcon('plus', 14)}
              <span>إنشاء كود خصم جديد</span>
            </button>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('coupons')" style="font-weight: 700;">
              عرض كافة الأكواد (${(typeof window !== 'undefined' && window.centrlyApp?.giftCodes ? window.centrlyApp.giftCodes : []).length} كود)
            </button>
          </div>
        </div>
      </div>

      <!-- At-Risk Churn Alerts & Recent Signups Split Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
        
        <!-- At-Risk Accounts -->
        <div class="card" style="margin: 0; border: 1px solid #fed7aa;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 class="card-title" style="font-size: 1rem; color: #c2410c; margin: 0; display: flex; align-items: center; gap: 0.35rem;">
              ${getIcon('risk', 16, '#c2410c')}
              <span>إشارات خطر الإلغاء (Churn Signals)</span>
            </h3>
            <span class="badge" style="background: #ea580c; color: #fff;">${atRisk.length} في الخطر</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${atRisk.length > 0 ? atRisk.map(item => `
              <div style="padding: 0.65rem; border-radius: 6px; background: #fff7ed; border-right: 3px solid #ea580c;">
                <div style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${item.tenant_name}</div>
                <div style="font-size: 0.8rem; color: #9a3412; margin-top: 0.2rem;">${item.details}</div>
              </div>
            `).join('') : `
              <div style="padding: 1rem; text-align: center; color: var(--centrly-text); font-size: 0.825rem;">
                لا توجد حسابات تحت إشارات خطر الإلغاء حالياً.
              </div>
            `}
          </div>
        </div>

        <!-- Recent Signups -->
        <div class="card" style="margin: 0;">
          <h3 class="card-title" style="font-size: 1rem; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.35rem;">
            ${getIcon('students', 16, 'var(--centrly-blue-700)')}
            <span>أحدث المشتركين الجدد في المنصة</span>
          </h3>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${recentSignups.length > 0 ? recentSignups.map(s => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem; border-radius: 6px; background: #f8fafc; border: 1px solid var(--centrly-line);">
                <div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${s.name}</div>
                  <div style="font-size: 0.75rem; color: var(--centrly-text);">${new Date(s.created_at).toLocaleDateString('ar-EG')}</div>
                </div>
                <span class="badge ${s.subscription_status === 'active' ? 'badge-success' : (s.subscription_status === 'pending_verification' ? 'badge-warning' : 'badge-primary')}" style="font-size: 0.72rem; padding: 0.2rem 0.5rem;">
                  ${s.subscription_status === 'active' ? 'اشتراك نشط' : (s.subscription_status === 'pending_verification' ? 'بانتظار التحويل' : 'فترة تجريبية')}
                </span>
              </div>
            `).join('') : `
              <div style="padding: 1rem; text-align: center; color: var(--centrly-text); font-size: 0.825rem;">
                لا توجد اشتراكات جديدة مسجلة مؤخراً.
              </div>
            `}
          </div>
        </div>

      </div>

    </div>
  `;
}
