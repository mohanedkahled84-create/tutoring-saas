/**
 * Centrly Business Owner Analytics Dashboard (DEV-54)
 * Cross-Tenant, Founder-Only strategic view of business health, MRR, message costs, and churn signals.
 */

export function renderBusinessOwnerDashboard(data = {}, user = {}) {
  const overview = data.overview || {
    total_tenants: 0,
    active_tenants: 0,
    trial_tenants: 0,
    expired_tenants: 0,
    total_students: 0,
    total_sessions: 0,
    mrr_egp: 0,
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
    grace_period: 0,
  };

  const atRisk = data.at_risk_tenants || [];
  const recentSignups = data.recent_signups || [];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;">
      
      <!-- Top Action Bar & Founder Banner -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #1e293b, #0f172a); color: #fff;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="font-size: 1.5rem;">👑</span>
              <h2 style="margin: 0; font-size: 1.3rem; font-weight: 800; color: #fff;">لوحة تحكم المؤسس وإحصائيات الأعمال (Centrly HQ)</h2>
              <span class="badge" style="background: #3b82f6; color: #fff;">Cross-Tenant • خاص بالإدارة</span>
            </div>
            <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.35rem;">
              نظرة شاملة ومباشرة على نمو المنصة، الإيراد الشهري، تكاليف الواتساب وإشارات خطر الإلغاء عبر جميع المعلمين والسناتر
            </p>
          </div>

          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.refreshBusinessDashboard()" style="background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff;">
            🔄 تحديث البيانات
          </button>
        </div>
      </div>

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
          <div style="font-size: 0.75rem; color: var(--centrly-text);">
            🟢 ${overview.active_tenants} نشط • ⏳ ${overview.trial_tenants} تجربة
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
        <h3 class="card-title" style="font-size: 1.05rem; margin-bottom: 0.75rem;">
          📊 توزيع الاشتراكات وحالة الحسابات عبر المنصة
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

      <!-- At-Risk Churn Alerts & Recent Signups Split Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
        
        <!-- At-Risk Accounts -->
        <div class="card" style="margin: 0; border: 1px solid #fed7aa;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 class="card-title" style="font-size: 1rem; color: #c2410c; margin: 0;">
              ⚠️ إشارات خطر الإلغاء (Churn Signals)
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
          <h3 class="card-title" style="font-size: 1rem; margin-bottom: 0.75rem;">
            🚀 أحدث المشتركين الجدد في المنصة
          </h3>
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${recentSignups.length > 0 ? recentSignups.map(s => `
              <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.65rem; border-radius: 6px; background: #f8fafc; border: 1px solid var(--centrly-line);">
                <div>
                  <div style="font-weight: 700; font-size: 0.9rem; color: var(--centrly-ink);">${s.name}</div>
                  <div style="font-size: 0.75rem; color: var(--centrly-text);">${new Date(s.created_at).toLocaleDateString('ar-EG')}</div>
                </div>
                <span class="badge ${s.status === 'active' ? 'badge-success' : 'badge-primary'}">${s.status}</span>
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
