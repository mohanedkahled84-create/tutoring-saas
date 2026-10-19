import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";
import { request } from "../services/api.js";
import { normalizeDigits } from "../utils/normalizeDigits.js";

/**
 * Centrly Business Owner & Founder Executive Command Center (HQ)
 * Designed for Founder & Super Admin (مهند خالد):
 * - Real Cash-In & Historical Revenue Tracking (Actual Approved Payment Proofs)
 * - This Month's Inflow vs New Clients Joined This Month
 * - Expected Normalized Next Month MRR (Restores Regular Plan Price After Discounts)
 * - Inline Payment Proofs Approvals (Approve Monthly / Annual or Reject directly)
 * - Onboarding & Activation Radar (Tracks new client progress with direct WhatsApp link)
 * - Instant Tenant Actions (+7 Days Free Trial Extension, Plan Overrides)
 * - Live Automations Pulse (n8n Webhooks, Evolution API WhatsApp, Resend OTP)
 * - Safe Test Data Purge Tool
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

export function renderBusinessOwnerDashboard(data = {}) {
  const overview = data.overview || {
    total_tenants: 0,
    active_tenants: 0,
    trial_tenants: 0,
    expired_tenants: 0,
    total_collected_egp: 0,
    approved_proofs_count: 0,
    this_month_collected_egp: 0,
    new_clients_this_month: 0,
    expected_next_month_mrr: 0,
    total_students: 0,
    total_sessions: 0,
    whatsapp: {
      total_sent: 0,
      total_failed: 0,
      estimated_cost_egp: 0,
      status: 'active',
    },
    automations: {
      n8n_status: 'active',
      whatsapp_status: 'active',
      email_status: 'active',
    }
  };

  const subs = data.subscription_breakdown || {
    active: 0,
    trial: 0,
    pending_verification: 0,
    expired: 0,
  };

  const pendingProofs = Array.isArray(data.pending_proofs) ? data.pending_proofs : [];
  const activationRadar = Array.isArray(data.activation_radar) ? data.activation_radar : [];
  const atRisk = Array.isArray(data.at_risk_tenants) ? data.at_risk_tenants : [];

  const monthNames = [
    'يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو',
    'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'
  ];
  const currentMonthName = monthNames[new Date().getMonth()];

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      
      <!-- Top Action Bar & Founder Banner -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #0f172a, #1e293b); color: #fff; border: 1px solid #334155; border-radius: 16px; padding: 1.5rem; box-shadow: 0 10px 25px rgba(15, 23, 42, 0.4);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.65rem; flex-wrap: wrap;">
              <span style="display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 10px; background: rgba(59, 130, 246, 0.15); border: 1px solid rgba(59, 130, 246, 0.3);">
                ${getIcon('dashboard', 22, '#38bdf8')}
              </span>
              <h2 style="margin: 0; font-size: 1.35rem; font-weight: 900; color: #fff; letter-spacing: -0.02em;">
                لوحة تحكم المؤسس ومركز القيادة التنفيذي (Centrly HQ)
              </h2>
              <span class="badge" style="background: #2563eb; color: #fff; font-weight: 800; padding: 0.3rem 0.75rem; border-radius: 9999px; font-size: 0.75rem;">
                المدير العام: مهند خالد
              </span>
            </div>
            <p style="font-size: 0.85rem; color: #94a3b8; margin-top: 0.45rem; line-height: 1.6; max-width: 820px;">
              متابعة الأرباح الحقيقية، مراقبة تدفقات الكاش الشهرية، رادار تفعيل المشتركين الجدد، واعتماد إيصالات الدفع وإدارة الأوتوميشنز.
            </p>
          </div>

          <div style="display: flex; gap: 0.5rem; flex-wrap: wrap; align-items: center;">
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.refreshBusinessDashboard()" style="background: rgba(255,255,255,0.08); border-color: rgba(255,255,255,0.2); color: #fff; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
              ${getIcon('refresh', 14)}
              <span>تحديث البيانات</span>
            </button>

            <button class="btn btn-sm" onclick="window.centrlyApp.navigate('whatsapp-inbox')" style="background: rgba(16, 185, 129, 0.2); border: 1.5px solid #10b981; color: #34d399; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 800; border-radius: 8px;">
              ${getIcon('whatsapp', 14, '#34d399')}
              <span>مركز محادثات الواتساب وحاسبة الاشتراكات</span>
            </button>
            
            <button class="btn btn-sm" onclick="window.centrlyApp.testAdminWebhook()" style="background: rgba(16, 185, 129, 0.15); border: 1px solid #10b981; color: #34d399; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; border-radius: 8px;">
              ${getIcon('whatsapp', 14, '#34d399')}
              <span>اختبار الأوتوميشن</span>
            </button>

            <button class="btn btn-sm" onclick="window.centrlyApp.openPurgeTestDataModal()" style="background: rgba(239, 68, 68, 0.15); border: 1px solid #ef4444; color: #f87171; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700; border-radius: 8px;" title="تنظيف الحسابات والإيصالات التجريبية قبل إطلاق العملاء">
              ${getIcon('delete', 14, '#f87171')}
              <span>تصفير بيانات التجربة</span>
            </button>

            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.navigate('admin-tenants')" style="background: #2563eb; display: inline-flex; align-items: center; gap: 0.35rem; font-weight: 700;">
              ${getIcon('teachers', 14)}
              <span>دليل المشتركين (${overview.total_tenants})</span>
            </button>
          </div>
        </div>
      </div>

      <!-- Real Financial Metrics & SaaS Growth KPI Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem;">
        
        <!-- 1. All-Time Collected Real Cash -->
        <div class="card" 
          onclick="window.centrlyApp.openRevenueDetailsModal('all_time')"
          style="margin: 0; border-top: 4px solid #10b981; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(16, 185, 129, 0.15)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.03)'"
          title="اضغط لعرض تفاصيل التحويلات والإيصالات المعتمدة"
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">إجمالي النقدية المحصلة (كاش فعلي)</span>
            <span style="color: #10b981; display: flex;">${getIcon('billing', 18)}</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 900; color: #047857; margin: 0.35rem 0; font-family: monospace;">
            ${(overview.total_collected_egp || 0).toLocaleString('ar-EG')} <span style="font-size: 0.95rem; font-family: 'Cairo'; font-weight: 700;">ج.م</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #64748b;">
            <span style="display: flex; align-items: center; gap: 0.3rem;">
              ${getIcon('check', 12, '#10b981')}
              <span>من واقع <strong>${overview.approved_proofs_count || 0}</strong> إيصال دفع</span>
            </span>
            <span class="badge" style="background: #ecfdf5; color: #047857; font-size: 0.7rem; font-weight: 800; padding: 2px 7px; border-radius: 6px;">عرض التفاصيل 🔍</span>
          </div>
        </div>

        <!-- 2. This Month's Real Collected Cash -->
        <div class="card" 
          onclick="window.centrlyApp.openRevenueDetailsModal('this_month')"
          style="margin: 0; border-top: 4px solid #0284c7; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(2, 132, 199, 0.15)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.03)'"
          title="اضغط لعرض تفاصيل تحويلات هذا الشهر"
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">أرباح هذا الشهر (${currentMonthName})</span>
            <span style="color: #0284c7; display: flex;">${getIcon('activity', 18)}</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 900; color: #0369a1; margin: 0.35rem 0; font-family: monospace;">
            ${(overview.this_month_collected_egp || 0).toLocaleString('ar-EG')} <span style="font-size: 0.95rem; font-family: 'Cairo'; font-weight: 700;">ج.م</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.75rem; color: #64748b;">
            <span>صافي التحويلات المعتمدة هذا الشهر</span>
            <span class="badge" style="background: #f0f9ff; color: #0369a1; font-size: 0.7rem; font-weight: 800; padding: 2px 7px; border-radius: 6px;">عرض التفاصيل 🔍</span>
          </div>
        </div>

        <!-- 3. New Clients This Month -->
        <div class="card" style="margin: 0; border-top: 4px solid #8b5cf6; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">المشتركون الجدد هذا الشهر</span>
            <span style="color: #8b5cf6; display: flex;">${getIcon('teachers', 18)}</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 900; color: #6d28d9; margin: 0.35rem 0; font-family: monospace;">
            ${overview.new_clients_this_month || 0} <span style="font-size: 0.95rem; font-family: 'Cairo'; font-weight: 700;">مشترك</span>
          </div>
          <div style="font-size: 0.75rem; color: #64748b;">
            إجمالي المنصة: ${overview.total_tenants} (${overview.active_tenants} باقة نشطة • ${overview.trial_tenants} تجربة)
          </div>
        </div>

        <!-- 4. Expected Next Month Normalized MRR -->
        <div class="card" 
          onclick="window.centrlyApp.openExpectedMrrModal()"
          style="margin: 0; border-top: 4px solid #d97706; background: linear-gradient(180deg, #fffbeb, #fff); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03); cursor: pointer; transition: transform 0.15s ease, box-shadow 0.15s ease;"
          onmouseover="this.style.transform='translateY(-2px)'; this.style.boxShadow='0 8px 20px rgba(217, 119, 6, 0.15)'"
          onmouseout="this.style.transform='translateY(0)'; this.style.boxShadow='0 4px 12px rgba(0,0,0,0.03)'"
          title="اضغط لعرض تفاصيل وحسبة الإيراد الشهري المتوقع"
        >
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: #92400e; font-weight: 800;">الأرباح الشهرية القادمة المتوقعة (الإيراد الشهري التقديري)</span>
            <span style="color: #d97706; display: flex;">${getIcon('reports', 18)}</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 900; color: #b45309; margin: 0.35rem 0; font-family: monospace;">
            ${(overview.expected_next_month_mrr || 0).toLocaleString('ar-EG')} <span style="font-size: 0.95rem; font-family: 'Cairo'; font-weight: 700;">ج.م</span>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center; font-size: 0.725rem; color: #b45309; font-weight: 700;">
            <span>بالأسعار الطبيعية للباقات بدون خصم</span>
            <span class="badge" style="background: #fef3c7; color: #92400e; font-size: 0.7rem; font-weight: 800; padding: 2px 7px; border-radius: 6px;">تفاصيل الحسبة 🔍</span>
          </div>
        </div>

      </div>

      <!-- Live Automations & Infrastructure Pulse Banner -->
      <div class="card" style="margin: 0; background: #f8fafc; border: 1.5px solid #e2e8f0; border-radius: 14px; padding: 1.15rem 1.25rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem;">
              <span style="display: flex; align-items: center; justify-content: center; width: 28px; height: 28px; border-radius: 8px; background: #ecfdf5; color: #10b981;">
                ${getIcon('activity', 16, '#10b981')}
              </span>
              <h3 style="font-size: 0.95rem; font-weight: 900; color: #0f172a; margin: 0;">
                شريان الأوتوميشن والتكاملات الحية (Centrly Automations & Ops Health)
              </h3>
            </div>
            <p style="font-size: 0.78rem; color: #64748b; margin-top: 0.25rem; margin-bottom: 0;">
              مؤشر الاتصال اللحظي بخدمات الإشعارات، وسيرفر الواتساب، ورسائل البريد الإلكتروني.
            </p>
          </div>

          <div style="display: flex; gap: 0.65rem; flex-wrap: wrap; align-items: center;">
            <div style="display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.78rem;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
              <span style="font-weight: 700; color: #334155;">n8n Webhook:</span>
              <span style="color: #059669; font-weight: 800;">جاهز ومفعل</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.78rem;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #25D366;"></span>
              <span style="font-weight: 700; color: #334155;">رسائل الواتساب:</span>
              <span style="color: #15803d; font-weight: 800;">${overview.whatsapp.total_sent} مرسلة</span>
            </div>

            <div style="display: flex; align-items: center; gap: 0.4rem; padding: 0.35rem 0.75rem; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 0.78rem;">
              <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #0284c7;"></span>
              <span style="font-weight: 700; color: #334155;">Resend OTP:</span>
              <span style="color: #0369a1; font-weight: 800;">متصل</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Founder WhatsApp Inbox & Unit Economics Quick Banner -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #064e3b 0%, #065f46 50%, #047857 100%); color: #ffffff; border-radius: 14px; padding: 1.25rem 1.5rem; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; cursor: pointer; border: 1.5px solid #059669; box-shadow: 0 4px 15px rgba(6, 78, 59, 0.15);" onclick="window.centrlyApp.navigate('whatsapp-inbox')">
        <div style="display: flex; align-items: center; gap: 1rem;">
          <div style="width: 48px; height: 48px; border-radius: 12px; background: rgba(255, 255, 255, 0.18); display: flex; align-items: center; justify-content: center; color: #34d399; flex-shrink: 0;">
            ${getIcon('whatsapp', 26, '#34d399')}
          </div>
          <div>
            <div style="font-weight: 800; font-size: 1.05rem; color: #ffffff; display: flex; align-items: center; gap: 0.5rem;">
              <span>مركز محادثات الواتساب وحاسبة اشتراكات المدرسين وتكلفة الرسائل</span>
              <span class="badge" style="background: #34d399; color: #064e3b; font-weight: 900; font-size: 0.72rem; padding: 0.2rem 0.5rem; border-radius: 6px;">جديد</span>
            </div>
            <div style="font-size: 0.85rem; color: #d1fae5; margin-top: 0.25rem; line-height: 1.5;">
              متابعة مباشرة لمن رد ومن لم يرد من الطلاب وأولياء الأمور على رسائل المدرسين، مع حاسبة تفاعلية لاشتراكات المدرسين (200 ج.م) وحساب أرباح الشهرية القادمة (100% صافي).
            </div>
          </div>
        </div>
        <div style="display: flex; align-items: center; gap: 0.5rem;">
          <button class="btn" style="background: #ffffff; color: #065f46; font-weight: 800; border: none; padding: 0.55rem 1.2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); display: inline-flex; align-items: center; gap: 0.4rem;">
            <span>فتح الشاشة والحاسبة</span>
            <span>&larr;</span>
          </button>
        </div>
      </div>

      <!-- Inline Pending Payment Proofs Review (if any exist) -->
      ${pendingProofs.length > 0 ? `
        <div class="card" style="margin: 0; background: #fffbeb; border: 2px solid #fde68a; border-radius: 16px; padding: 1.25rem; box-shadow: 0 6px 18px rgba(245, 158, 11, 0.1);">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; margin-bottom: 1rem; border-bottom: 1px solid #fef3c7; padding-bottom: 0.75rem;">
            <div style="display: flex; align-items: center; gap: 0.65rem;">
              <span style="display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 50%; background: #fef3c7; color: #d97706;">
                ${getIcon('billing', 18, '#d97706')}
              </span>
              <div>
                <h3 style="margin: 0; font-size: 1.05rem; font-weight: 900; color: #92400e;">
                  إيصالات تحويل معلقة بانتظار الاعتماد المباشر (${pendingProofs.length})
                </h3>
                <p style="font-size: 0.78rem; color: #b45309; margin: 0.15rem 0 0;">
                  قام المشتركون بتحويل الرسوم، يمكنك مراجعة الاسكرين شوت واعتماد الاشتراك فوراً من نفس الشاشة.
                </p>
              </div>
            </div>

            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('admin-proofs')" style="font-weight: 700; font-size: 0.8rem;">
              عرض كامل الأرشيف
            </button>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1rem;">
            ${pendingProofs.slice(0, 4).map(proof => {
              const tenantName = proof.tenants?.name || proof.tenant_name || 'مؤسسة تعليمية';
              const notesText = proof.admin_notes || proof.notes || '';
              const couponMatch = notesText.match(/\[كود خصم:\s*([^\]]+)\]/);
              const couponInfo = couponMatch ? couponMatch[1].trim() : (proof.payment_method === 'coupon' ? (proof.reference_number || 'كود خصم') : null);
              const isZeroOrFree = Number(proof.amount || 0) === 0 || proof.payment_method === 'coupon';
              const methodLabel = proof.payment_method === 'vodafone_cash' ? 'فودافون كاش' : (isZeroOrFree ? 'كود خصم (مجاني)' : 'إنستاباي');
              return `
                <div style="background: #fff; border: 1.5px solid #fde68a; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
                      <div>
                        <div style="font-weight: 900; color: #0f172a; font-size: 1rem;">${escapeHtml(tenantName)}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${formatArabicDate(proof.created_at)}</div>
                      </div>
                      <div style="font-size: 1.15rem; font-weight: 900; color: ${isZeroOrFree ? '#059669' : '#047857'}; font-family: monospace;">
                        ${Number(proof.amount || 0).toLocaleString('ar-EG')} ج.م ${isZeroOrFree ? '<span style="font-size: 0.75rem; font-weight: 800; color: #10b981;">(مجاني)</span>' : ''}
                      </div>
                    </div>

                    ${couponInfo ? `
                      <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 6px; padding: 0.35rem 0.5rem; margin-bottom: 0.5rem; font-size: 0.775rem; font-weight: 800; color: #065f46; display: flex; align-items: center; justify-content: space-between;">
                        <span>🎁 كود الخصم: <strong style="color: #047857;">${escapeHtml(couponInfo)}</strong></span>
                        <span class="badge" style="background: #10b981; color: #fff; font-size: 0.7rem; padding: 0.1rem 0.4rem;">${isZeroOrFree ? 'خصم 100%' : 'تخفيض'}</span>
                      </div>
                    ` : ''}

                    <div style="font-size: 0.8rem; color: #334155; margin-bottom: 0.75rem; background: #f8fafc; padding: 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <div><b>الوسيلة:</b> ${methodLabel}</div>
                      <div><b>المرجع/المحفظة:</b> <span style="font-family: monospace;" dir="ltr">${escapeHtml(proof.reference_number || (isZeroOrFree ? 'كود خصم' : 'غير مسجل'))}</span></div>
                      ${notesText ? `<div><b>ملاحظة:</b> ${escapeHtml(notesText)}</div>` : ''}
                    </div>

                    ${proof.proof_image_url ? `
                      <div style="position: relative; border-radius: 8px; overflow: hidden; border: 1px solid #cbd5e1; height: 110px; cursor: pointer; margin-bottom: 0.75rem; background: #0f172a;" onclick="window.centrlyApp.openProofFullscreenModal('${proof.id}')">
                        <img src="${proof.proof_image_url}" alt="إيصال التحويل" style="width: 100%; height: 100%; object-fit: cover;">
                        <div style="position: absolute; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; color: #fff; font-size: 0.75rem; font-weight: 700; gap: 0.3rem;">
                          ${getIcon('search', 14, '#fff')}
                          <span>عرض الاسكرين شوت</span>
                        </div>
                      </div>
                    ` : ''}
                  </div>

                  <div style="display: flex; gap: 0.4rem; border-top: 1px solid #f1f5f9; padding-top: 0.65rem;">
                    <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.handleApproveProof('${proof.id}', 30)" style="flex: 1; font-weight: 800; font-size: 0.78rem; background: #2563eb; display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem;">
                      ${getIcon('check', 12)}
                      <span>اعتماد 30 يوم</span>
                    </button>

                    <button class="btn btn-sm" onclick="window.centrlyApp.handleApproveProof('${proof.id}', 365)" style="flex: 1; font-weight: 800; font-size: 0.78rem; background: #059669; color: #fff; border: none; border-radius: 8px; display: inline-flex; align-items: center; justify-content: center; gap: 0.25rem;">
                      ${getIcon('check', 12)}
                      <span>سنة (خصم 20%)</span>
                    </button>

                    <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.handleRejectProofPrompt('${proof.id}')" style="font-weight: 700; font-size: 0.75rem; color: #dc2626; border-color: #fca5a5;">
                      رفض
                    </button>
                  </div>
                </div>
              `;
            }).join('')}
          </div>
        </div>
      ` : ''}

      <!-- Onboarding & Activation Radar (رادار تفعيل المشتركين الجدد) -->
      <div class="card" style="margin: 0; background: #fff; border-radius: 14px; border: 1px solid #e2e8f0;">
        <div class="card-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem;">
          <div>
            <h3 class="card-title" style="font-size: 1.05rem; font-weight: 900; display: flex; align-items: center; gap: 0.45rem; margin: 0;">
              ${getIcon('teachers', 20, '#2563eb')}
              <span>رادار تفعيل المشتركين الجدد (Onboarding & Activation Radar)</span>
            </h3>
            <p style="font-size: 0.78rem; color: #64748b; margin-top: 0.2rem; margin-bottom: 0;">
              متابعة المشتركين خطوة بخطوة (من أضاف طلاب ومن يحتاج لمكالمة ترحيبية أو رسالة مساعدة فورية عبر الواتساب).
            </p>
          </div>

          <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('admin-tenants')" style="font-weight: 700; font-size: 0.8rem;">
            عرض كافة المعلمين (${overview.total_tenants})
          </button>
        </div>

        <div style="overflow-x: auto; margin-top: 1rem;">
          <table class="data-table">
            <thead>
              <tr>
                <th>المعلم / السنتر</th>
                <th>رقم الهاتف</th>
                <th>تاريخ التسجيل</th>
                <th>الطلاب المسجلين</th>
                <th>حالة التفعيل والنشاط</th>
                <th>صلاحية الاشتراك</th>
                <th style="text-align: center;">إجراءات التواصل السريع</th>
              </tr>
            </thead>
            <tbody>
              ${activationRadar.length > 0 ? activationRadar.slice(0, 8).map(t => {
                const phoneClean = (t.phone || '').replace(/[^0-9]/g, '');
                const teacherName = t.full_name || t.name || 'المعلم';
                const waMessage = encodeURIComponent(`السلام عليكم أستاذ ${teacherName}، معك مهند خالد مؤسس منصة سنترلي التعليمية. أهلاً بك معنا! حابب أطمئن على حسابك وهل تحتاج أي مساعدة في تجهيز كروت طلابك أو استيرادهم من شيت إكسيل؟`);
                const waUrl = phoneClean ? `https://wa.me/2${phoneClean.startsWith('2') ? phoneClean : phoneClean}?text=${waMessage}` : null;
                
                return `
                  <tr>
                    <td>
                      <div style="font-weight: 800; color: #0f172a; font-size: 0.95rem;">${escapeHtml(t.name)}</div>
                      <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(t.email || '—')}</div>
                    </td>
                    <td dir="ltr" style="text-align: right; font-family: monospace; font-weight: 700; color: #334155;">
                      ${escapeHtml(t.phone || '—')}
                    </td>
                    <td style="font-size: 0.8rem; color: #64748b;">
                      ${formatArabicDate(t.created_at)}
                    </td>
                    <td style="font-weight: 800; font-size: 0.95rem; color: #0f172a;">
                      ${t.studentCount} طالب
                    </td>
                    <td>
                      <span class="badge" style="background: ${t.stageColor}18; color: ${t.stageColor}; border: 1px solid ${t.stageColor}40; font-weight: 800; font-size: 0.78rem;">
                        ${t.stageLabel}
                      </span>
                    </td>
                    <td>
                      <div style="font-size: 0.8rem; font-weight: 700; color: #1e293b;">
                        ${t.subscription_status === 'active' ? '<span style="color: #059669;">باقة نشطة</span>' : '<span style="color: #0284c7;">تجربة مجانية</span>'}
                      </div>
                      <div style="font-size: 0.72rem; color: #64748b;">
                        تنتهي: ${formatArabicDate(t.subscription_ends_at || t.trial_ends_at)}
                      </div>
                    </td>
                    <td style="text-align: center;">
                      <div style="display: inline-flex; align-items: center; gap: 0.35rem; justify-content: center;">
                        ${waUrl ? `
                          <a href="${waUrl}" target="_blank" rel="noopener noreferrer" class="btn btn-sm" style="background: #25D366; color: #fff; font-weight: 800; font-size: 0.75rem; padding: 0.35rem 0.65rem; border-radius: 8px; display: inline-flex; align-items: center; gap: 0.25rem; text-decoration: none;" title="محادثة ترحيبية ومساعدة عبر الواتساب">
                            ${getIcon('whatsapp', 14, '#fff')}
                            <span>واتساب</span>
                          </a>
                        ` : ''}

                        <button class="btn btn-sm" onclick="window.centrlyApp.extendTenantTrialDirect('${t.id}', 7)" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1d4ed8; font-weight: 700; font-size: 0.75rem; padding: 0.35rem 0.6rem; border-radius: 8px;" title="منح أسبوع تجربة إضافي مجاناً">
                          +7 أيام
                        </button>

                        <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openTenantOverrideModal('${t.id}')" style="font-weight: 700; font-size: 0.75rem; padding: 0.35rem 0.5rem; border-radius: 8px;" title="تعديل الباقة والاشتراك">
                          ${getIcon('edit', 12)}
                        </button>

                        <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.handleArchiveTenant('${t.id}', '${escapeHtml(t.name)}')" style="font-weight: 700; font-size: 0.75rem; padding: 0.35rem 0.5rem; border-radius: 8px; color: #d97706; border-color: #fde68a; background: #fffbeb;" title="أرشفة الحساب واستبعاده من الرادار والحسابات">
                          ${getIcon('archive', 12, '#d97706')}
                        </button>
                      </div>
                    </td>
                  </tr>
                `;
              }).join('') : `
                <tr>
                  <td colspan="7" style="text-align: center; padding: 2.5rem; color: #64748b;">
                    لا يوجد مشتركون مسجلون حالياً. بمجرد تسجيل المعلمين الجدد، سيظهرون في رادار التفعيل هنا فوراً.
                  </td>
                </tr>
              `}
            </tbody>
          </table>
        </div>
      </div>

      <!-- At-Risk Churn Alerts & Promo Codes Row -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.25rem;">
        
        <!-- At-Risk Accounts (Trial Expiring Soon) -->
        <div class="card" style="margin: 0; border: 1px solid #fed7aa; background: #fff; border-radius: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 class="card-title" style="font-size: 0.95rem; color: #c2410c; margin: 0; display: flex; align-items: center; gap: 0.35rem; font-weight: 900;">
              ${getIcon('risk', 16, '#c2410c')}
              <span>إشارات خطر الإلغاء وحسابات تنتهي تجربتها قريباً (${atRisk.length})</span>
            </h3>
            <span class="badge" style="background: #ea580c; color: #fff; font-size: 0.72rem;">تنبيه التجديد</span>
          </div>
          
          <div style="display: flex; flex-direction: column; gap: 0.5rem;">
            ${atRisk.length > 0 ? atRisk.map(item => `
              <div style="padding: 0.65rem 0.85rem; border-radius: 8px; background: #fff7ed; border-right: 3px solid #ea580c; display: flex; justify-content: space-between; align-items: center; gap: 0.5rem;">
                <div>
                  <div style="font-weight: 800; font-size: 0.9rem; color: #0f172a;">${escapeHtml(item.tenant_name)}</div>
                  <div style="font-size: 0.75rem; color: #9a3412; margin-top: 0.15rem;">${escapeHtml(item.details)}</div>
                </div>
                ${item.tenant_id ? `
                  <button class="btn btn-sm" onclick="window.centrlyApp.extendTenantTrialDirect('${item.tenant_id}', 7)" style="background: #fff; border: 1px solid #fdba74; color: #c2410c; font-size: 0.75rem; font-weight: 800; padding: 0.3rem 0.6rem; border-radius: 6px;">
                    +7 أيام
                  </button>
                ` : ''}
              </div>
            `).join('') : `
              <div style="padding: 1.5rem; text-align: center; color: #64748b; font-size: 0.825rem;">
                لا توجد حسابات تحت إشارات خطر الانتهاء حالياً.
              </div>
            `}
          </div>
        </div>

        <!-- Promo & Gift Codes Banner -->
        <div class="card" style="margin: 0; background: #fff; border: 1.5px solid #dbeafe; border-radius: 14px; padding: 1.15rem;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
            <h3 class="card-title" style="font-size: 0.95rem; font-weight: 900; color: #1e3a8a; margin: 0; display: flex; align-items: center; gap: 0.35rem;">
              ${getIcon('billing', 16, '#2563eb')}
              <span>أكواد الخصم والبروموكود (Promo Codes)</span>
            </h3>
            <button class="btn btn-primary btn-sm" onclick="window.centrlyApp.openCreateCouponModal()" style="font-weight: 800; font-size: 0.78rem; padding: 0.35rem 0.75rem;">
              + كود جديد
            </button>
          </div>
          <p style="font-size: 0.8rem; color: #64748b; line-height: 1.5; margin-bottom: 1rem;">
            إنشاء حملات الخصومات الترويجية وتحديد نسب أو قيم الخصومات النقدية للمشتركين الجدد في أول شهر.
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; background: #f8fafc; padding: 0.75rem; border-radius: 8px; border: 1px solid #e2e8f0;">
            <span style="font-size: 0.8rem; color: #334155; font-weight: 700;">الأكواد النشطة في السيستم:</span>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.navigate('coupons')" style="font-weight: 800; font-size: 0.78rem;">
              إدارة الأكواد (${(typeof window !== 'undefined' && window.centrlyApp?.giftCodes ? window.centrlyApp.giftCodes : []).length})
            </button>
          </div>
        </div>

      </div>

      <!-- Subscription Breakdown Bar -->
      <div class="card" style="margin: 0; background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 1rem 1.25rem;">
        <h3 class="card-title" style="font-size: 0.95rem; font-weight: 900; margin-bottom: 0.75rem; display: flex; align-items: center; gap: 0.4rem;">
          ${getIcon('reports', 16, '#2563eb')}
          <span>توزيع الاشتراكات وحالة الحسابات عبر المنصة</span>
        </h3>
        <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
          <div style="padding: 0.45rem 0.9rem; border-radius: 6px; background: #ecfdf5; border: 1px solid #a7f3d0; font-size: 0.8rem;">
            <span style="color: #065f46; font-weight: 700;">باقات نشطة (Active):</span>
            <b style="color: #047857; margin-right: 0.35rem;">${subs.active}</b>
          </div>
          <div style="padding: 0.45rem 0.9rem; border-radius: 6px; background: #eff6ff; border: 1px solid #bfdbfe; font-size: 0.8rem;">
            <span style="color: #1e40af; font-weight: 700;">فترة تجريبية (Trial):</span>
            <b style="color: #1d4ed8; margin-right: 0.35rem;">${subs.trial}</b>
          </div>
          <div style="padding: 0.45rem 0.9rem; border-radius: 6px; background: #fefce8; border: 1px solid #fef08a; font-size: 0.8rem;">
            <span style="color: #854d0e; font-weight: 700;">بانتظار تأكيد التحويل:</span>
            <b style="color: #a16207; margin-right: 0.35rem;">${subs.pending_verification}</b>
          </div>
          <div style="padding: 0.45rem 0.9rem; border-radius: 6px; background: #fef2f2; border: 1px solid #fecaca; font-size: 0.8rem;">
            <span style="color: #991b1b; font-weight: 700;">منتهي الصلاحية (Expired):</span>
            <b style="color: #b91c1c; margin-right: 0.35rem;">${subs.expired}</b>
          </div>
        </div>
      </div>

      </div>

    </div>
  `;
}


export function registerBusinessOwnerActions(app) {
  // Superadmin & Business Owner Actions (Centrly HQ)
  // ==========================================================================

  app.refreshBusinessDashboard = async function() {
    await this.loadRouteData('admin-dashboard');
    this.renderMainContent();
    this.showToast('تم تحديث بيانات لوحة الإدارة', 'info');
  }

  app.refreshAdminPaymentProofs = async function() {
    await this.loadRouteData('admin-proofs');
    this.renderMainContent();
    this.showToast('تم تحديث قائمة الإيصالات', 'info');
  }

  app.setAdminProofsFilter = function(filter) {
    this.adminProofsFilter = filter;
    this.renderMainContent();
  }

  app.openProofFullscreenModal = function(proofId) {
    const proofs = this.adminProofsData?.payment_proofs || [];
    const proof = proofs.find(p => p.id === proofId);
    if (!proof || !proof.proof_image_url) {
      this.showToast('تعذر العثور على صورة الإيصال', 'warning');
      return;
    }

    const modalHtml = `
      <div id="proofFullscreenModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(15, 23, 42, 0.9); align-items: center; justify-content: center; z-index: 10000; padding: 1rem;" dir="rtl">
        <div style="max-width: 900px; width: 100%; max-height: 95vh; display: flex; flex-direction: column; background: #0f172a; border-radius: 16px; overflow: hidden; border: 1.5px solid #334155; box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);">
          
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 0.85rem 1.25rem; border-bottom: 1px solid #1e293b; background: #0b1120;">
            <div style="color: #fff; font-weight: 800; font-size: 0.95rem;">
              إيصال تحويل: ${escapeHtml(proof.tenants?.name || proof.tenant_name || 'مؤسسة')} (${Number(proof.amount || 0).toLocaleString('ar-EG')} ج.م)
            </div>
            <div style="display: flex; gap: 0.5rem; align-items: center;">
              <a href="${proof.proof_image_url}" download="إيصال_تحويل_${proof.id}.png" class="btn btn-secondary btn-sm" style="font-size: 0.775rem; background: rgba(255,255,255,0.1); border-color: rgba(255,255,255,0.2); color: #fff; text-decoration: none; display: inline-flex; align-items: center; gap: 0.35rem;">
                ${getIcon('download', 14)}
                <span>تحميل الصورة</span>
              </a>
              <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closeProofFullscreenModal()" style="border: none; background: rgba(255,255,255,0.15); color: #fff; padding: 0.35rem 0.6rem; cursor: pointer; display: flex; align-items: center;">
                ${getIcon('close', 16, '#fff')}
              </button>
            </div>
          </div>

          <div style="padding: 1rem; overflow: auto; display: flex; justify-content: center; align-items: center; background: #020617; flex: 1;">
            <img src="${proof.proof_image_url}" alt="إيصال تحويل مكبر" style="max-width: 100%; max-height: 75vh; object-fit: contain; border-radius: 8px;">
          </div>

          <div style="padding: 0.75rem 1.25rem; background: #0b1120; border-top: 1px solid #1e293b; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem; font-size: 0.8rem; color: #94a3b8;">
            <span>المرجع: ${escapeHtml(proof.reference_number || 'غير مسجل')}</span>
            <span>طريقة الدفع: ${proof.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 'إنستاباي'}</span>
          </div>

        </div>
      </div>
    `;

    const existing = document.getElementById('proofFullscreenModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  app.closeProofFullscreenModal = function() {
    const modal = document.getElementById('proofFullscreenModal');
    if (modal) modal.remove();
  }

  app.handleApproveProof = function(proofId, extendDays = 30) {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('checkCircle', 40, '#10b981')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #0f172a; font-weight: 800;">تأكيد اعتماد الإيصال</h4>
        <p style="color: #64748b; font-size: 0.875rem; margin-bottom: 1.25rem; line-height: 1.5;">
          هل أنت متأكد من اعتماد هذا الإيصال وتفعيل الاشتراك لهذا المشترك لمدة <strong>${extendDays} يوماً</strong>؟
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #10b981; border-color: #10b981; font-weight: 800;" onclick="window.centrlyApp.confirmApproveProof('${proofId}', ${extendDays})">
            اعتماد وتفعيل الاشتراك
          </button>
        </div>
      </div>
    `;
    this.showModal('اعتماد إيصال سداد', bodyHtml);
  }

  app.confirmApproveProof = async function(proofId, extendDays = 30) {
    this.closeModal();
    try {
      await request(`/admin/payment-proofs/${proofId}/approve`, {
        method: 'POST',
        body: JSON.stringify({ extend_days: extendDays }),
      });

      this.closeProofFullscreenModal();
      this.showToast(`تم اعتماد الإيصال بنجاح وتفعيل الاشتراك لمدة ${extendDays} يوماً!`, 'success');
      
      await Promise.all([
        this.loadRouteData('admin-proofs'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل اعتماد الإيصال: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  app.handleRejectProofPrompt = function(proofId) {
    const defaultReason = 'التحويل لم يصل إلى الحساب البنكي أو المحفظة';
    const bodyHtml = `
      <form id="formRejectProof" onsubmit="event.preventDefault(); window.centrlyApp.confirmRejectProof('${proofId}');">
        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700;">سبب الرفض (سيتم إشعار الحساب به) *</label>
          <textarea id="adminRejectReasonInput" class="form-input" rows="3" required style="resize: vertical;">${defaultReason}</textarea>
        </div>
        <div style="display: flex; gap: 0.5rem; justify-content: flex-end;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="submit" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;">تأكيد الرفض</button>
        </div>
      </form>
    `;
    this.showModal('رفض إيصال السداد', bodyHtml);
    setTimeout(() => {
      document.getElementById('adminRejectReasonInput')?.focus();
    }, 150);
  }

  app.confirmRejectProof = async function(proofId) {
    const reason = document.getElementById('adminRejectReasonInput')?.value?.trim();
    if (!reason) {
      this.showToast('يرجى توضيح سبب الرفض', 'warning');
      return;
    }
    this.closeModal();

    try {
      await request(`/admin/payment-proofs/${proofId}/reject`, {
        method: 'POST',
        body: JSON.stringify({ reason }),
      });

      this.closeProofFullscreenModal();
      this.showToast('تم رفض الإيصال بنجاح', 'info');
      await Promise.all([
        this.loadRouteData('admin-proofs'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل رفض الإيصال: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  app.refreshAdminTenants = async function() {
    await this.loadRouteData('admin-tenants');
    this.renderMainContent();
    this.showToast('تم تحديث دليل المشتركين', 'info');
  }

  app.setAdminTenantsFilter = function(filter) {
    this.adminTenantsFilter = filter;
    this.renderMainContent();
  }

  app.handleAdminTenantsSearch = function(val) {
    this.adminTenantsSearchQuery = val;
    this.renderMainContent();
    setTimeout(() => {
      const inp = document.getElementById('adminTenantsSearchInput');
      if (inp) {
        inp.focus();
        inp.selectionStart = inp.selectionEnd = inp.value.length;
      }
    }, 50);
  }

  app.setOutreachFilter = function(filter) {
    this.adminOutreachFilter = filter;
    this.renderMainContent();
  }

  app.handleOutreachSearch = function(val) {
    this.adminOutreachSearchQuery = val;
    this.renderMainContent();
  }

  app.refreshOutreachData = async function() {
    this.showToast('جاري تحديث بيانات التواصل...', 'info');
    await this.loadRouteData('admin-outreach');
    this.showToast('تم تحديث بيانات الحملة بنجاح', 'success');
  }

  app.openTenantOverrideModal = function(tenantId, tenantName, currentStatus, currentTier = 'growth') {
    if (!tenantName && this.adminTenantsData?.tenants) {
      const match = this.adminTenantsData.tenants.find(t => t.id === tenantId);
      if (match) {
        tenantName = match.name;
        currentStatus = match.subscription_status || match.status || 'active';
        currentTier = match.subscription_tier || 'growth';
      }
    }
    const tier = (currentTier || 'growth').toLowerCase();
    const bodyHtml = `
      <form id="tenantOverrideForm" onsubmit="window.centrlyApp.handleSaveTenantOverride(event, '${tenantId}')">
        <div style="margin-bottom: 1.25rem;">
          <h4 style="margin: 0 0 0.35rem; font-weight: 800; color: var(--centrly-ink);">
            تعديل اشتراك: ${escapeHtml(tenantName || 'المشترك')}
          </h4>
          <p style="font-size: 0.825rem; color: #64748b; margin: 0;">
            الحالة الحالية: <strong style="color: var(--centrly-blue-700);">${currentStatus || 'active'}</strong>
          </p>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">خطة / باقة المشترك</label>
          <select id="overrideTier" class="form-select" style="width: 100%;">
            <option value="starter" ${tier === 'starter' || tier.includes('300') || tier.includes('100') ? 'selected' : ''}>باقة 300 طالب (Starter - سعة 300)</option>
            <option value="growth" ${tier === 'growth' || tier.includes('750') || tier.includes('250') ? 'selected' : ''}>باقة 750 طالب (Growth - سعة 750)</option>
            <option value="pro" ${tier === 'pro' || tier.includes('1500') || tier.includes('500') ? 'selected' : ''}>باقة 1500 طالب (Pro - سعة 1500)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">الحالة الجديدة للاشتراك</label>
          <select id="overrideStatus" class="form-select" style="width: 100%;">
            <option value="active" ${currentStatus === 'active' ? 'selected' : ''}>نشط ومفعل (Active)</option>
            <option value="trial" ${currentStatus === 'trial' ? 'selected' : ''}>فترة تجريبية (Trial)</option>
            <option value="past_due" ${currentStatus === 'past_due' ? 'selected' : ''}>متأخر / بانتظار السداد (Past Due)</option>
            <option value="deactivated" ${currentStatus === 'deactivated' ? 'selected' : ''}>معطل وموقوف (Deactivated)</option>
          </select>
        </div>

        <div class="form-group" style="margin-bottom: 1.25rem;">
          <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">تمديد الصلاحية لعدد أيام إضافي</label>
          <input type="number" id="overrideExtendDays" class="form-input" placeholder="عدد الأيام الإضافية" min="0" max="730" value="30">
          <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.35rem;">
            سيتم إضافة هذه الأيام فوق الصلاحية الحالية أو من تاريخ اليوم (0 لعدم زيادة الأيام).
          </div>
        </div>

        <div style="margin-top: 1.5rem; padding-top: 1rem; border-top: 1px dashed #cbd5e1; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.5rem;">
          <div style="display: flex; gap: 0.4rem; flex-wrap: wrap;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.handleArchiveTenant('${tenantId}', '${escapeHtml(tenantName || 'المعلم')}')" style="color: #b45309; border-color: #fde68a; background: #fffbeb; font-weight: 700; font-size: 0.775rem;">
              📦 أرشفة الحساب (استبعاد من الحسبة)
            </button>
            <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.handleDeleteTenantPrompt('${tenantId}', '${escapeHtml(tenantName || 'المعلم')}')" style="color: #dc2626; border-color: #fecaca; background: #fef2f2; font-weight: 700; font-size: 0.775rem;">
              🗑️ حذف نهائي
            </button>
          </div>

          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
            <button type="submit" id="btnSubmitOverride" class="btn btn-primary" style="font-weight: 800;">
              حفظ وتطبيق التعديل
            </button>
          </div>
        </div>
      </form>
    `;
    this.showModal('تعديل صلاحية وخطة المشترك', bodyHtml);
  }

  app.handleSaveTenantOverride = async function(e, tenantId) {
    e.preventDefault();
    const status = document.getElementById('overrideStatus')?.value || 'active';
    const tier = document.getElementById('overrideTier')?.value || 'growth';
    const extendDays = Number(document.getElementById('overrideExtendDays')?.value || 0);
    const btn = document.getElementById('btnSubmitOverride');
    if (btn) {
      btn.disabled = true;
      btn.innerText = 'جارٍ الحفظ...';
    }

    try {
      await request(`/admin/tenants/${tenantId}/subscription`, {
        method: 'POST',
        body: JSON.stringify({
          status,
          tier,
          extend_days: extendDays > 0 ? extendDays : undefined,
        }),
      });

      this.closeModal();
      this.showToast('تم تعديل صلاحية المشترك وتحديث الاشتراك بنجاح!', 'success');
      await Promise.all([
        this.loadRouteData('admin-tenants'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل تعديل الاشتراك: ${err.message || 'خطأ في الخادم'}`, 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerText = 'حفظ وتطبيق التعديل';
      }
    }
  }

  app.handleArchiveTenant = async function(tenantId, tenantName = 'المعلم') {
    if (!confirm(`هل أنت متأكد من أرشفة حساب "${tenantName}"؟\nسيتم استبعاد هذا الحساب تماماً من إحصائيات المنظومة ورادار التفعيل وحسابات الأرباح، ويمكنك استعادته في أي وقت من تبويب الأرشيف والتجارب.`)) {
      return;
    }

    try {
      this.closeModal();
      this.showToast('جاري أرشفة الحساب واستبعاده من الحسبة...', 'info');
      await request(`/admin/tenants/${tenantId}/archive`, { method: 'POST' });
      this.showToast(`تم أرشفة حساب "${tenantName}" واستبعاده من الحسبة بنجاح!`, 'success');
      await Promise.all([
        this.loadRouteData('admin-tenants'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل أرشفة الحساب: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  app.handleRestoreTenant = async function(tenantId, tenantName = 'المعلم') {
    try {
      this.closeModal();
      this.showToast('جاري استعادة الحساب من الأرشيف...', 'info');
      await request(`/admin/tenants/${tenantId}/restore`, { method: 'POST' });
      this.showToast(`تم استعادة حساب "${tenantName}" وإعادته للحسابات النشطة بنجاح!`, 'success');
      await Promise.all([
        this.loadRouteData('admin-tenants'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل استعادة الحساب: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  app.handleDeleteTenantPrompt = async function(tenantId, tenantName = 'المعلم') {
    if (!confirm(`⚠️ تحذير نهائي:\nهل أنت متأكد تماماً من حذف حساب المعلم "${tenantName}" نهائياً من قاعدة البيانات؟\nسيتم مسح كافة البيانات المرتبطة بهذا الحساب (الطلاب، الحصص، والإعدادات) فوراً ولا يمكن التراجع عن هذه الخطوة.`)) {
      return;
    }

    try {
      this.closeModal();
      this.showToast('جاري حذف حساب المعلم نهائياً...', 'info');
      await request(`/admin/tenants/${tenantId}`, { method: 'DELETE' });
      this.showToast(`تم حذف حساب "${tenantName}" نهائياً بنجاح!`, 'success');
      await Promise.all([
        this.loadRouteData('admin-tenants'),
        this.loadRouteData('admin-dashboard'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل حذف المعلم: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  app.extendTenantTrialDirect = async function(tenantId, days = 7) {
    try {
      this.showToast('جاري تمديد فترة التجربة للمشترك...', 'info');
      await request(`/admin/tenants/${tenantId}/subscription`, {
        method: 'POST',
        body: JSON.stringify({
          extend_days: days,
          status: 'trial',
        }),
      });
      this.showToast(`تم تمديد فترة التجربة بنجاح (+${days} أيام إضافية)!`, 'success');
      await Promise.all([
        this.loadRouteData('admin-dashboard'),
        this.loadRouteData('admin-tenants'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل تمديد التجربة: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  app.testAdminWebhook = async function() {
    try {
      this.showToast('جاري إرسال إشعار تجريبي لاختبار الـ Webhook...', 'info');
      const res = await request('/admin/test-webhook', { method: 'POST' });
      this.showToast(res.message || 'تم إرسال إشعار التجربة بنجاح!', 'success');
    } catch (err) {
      this.showToast(`فشل اختبار الـ Webhook: ${err.message || 'تأكد من ضبط المتغيرات'}`, 'danger');
    }
  }

  app.openPurgeTestDataModal = function() {
    const bodyHtml = `
      <div style="text-align: center; padding: 0.5rem 0;">
        <div style="margin-bottom: 0.75rem;">${getIcon('risk', 44, '#ef4444')}</div>
        <h4 style="margin: 0 0 0.5rem; color: #991b1b; font-weight: 900;">تصفير وتنظيف بيانات وحسابات التجربة</h4>
        <p style="color: #64748b; font-size: 0.85rem; margin-bottom: 1.25rem; line-height: 1.6;">
          سيقوم هذا الإجراء بحذف الحسابات والإيصالات التجريبية المسجلة سابقاً للبدء بصفحة بيضاء وسجلات نظيفة مع أول عميل حقيقي.
          <br>
          <strong style="color: #059669;">حسابك الأساسي كمدير ومؤسس للمنصة آمن تماماً ولن يتأثر.</strong>
        </p>
        <div style="display: flex; gap: 0.75rem; justify-content: center;">
          <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إلغاء</button>
          <button type="button" class="btn btn-primary" style="background: #ef4444; border-color: #ef4444; font-weight: 800;" onclick="window.centrlyApp.confirmPurgeTestData()">
            تأكيد تنظيف بيانات التجربة
          </button>
        </div>
      </div>
    `;
    this.showModal('تصفير بيانات التجربة', bodyHtml);
  }

  app.confirmPurgeTestData = async function() {
    this.closeModal();
    try {
      this.showToast('جاري تنظيف بيانات التجربة...', 'info');
      const res = await request('/admin/purge-test-data', { method: 'POST' });
      const delTenants = res.deleted_tenants_count ?? 0;
      const delProofs = res.deleted_proofs_count ?? 0;
      this.showToast(`تم تنظيف (${delTenants}) حساب تجريبي و (${delProofs}) إيصال تجريبي بنجاح!`, 'success');
      await Promise.all([
        this.loadRouteData('admin-dashboard'),
        this.loadRouteData('admin-tenants'),
        this.loadRouteData('admin-proofs'),
      ]);
      this.renderMainContent();
    } catch (err) {
      this.showToast(`فشل تنظيف البيانات: ${err.message || 'خطأ في الخادم'}`, 'danger');
    }
  }

  // ==========================================================================
  // Founder / Superadmin Revenue Breakdown Modals
  // ==========================================================================

  app.openRevenueDetailsModal = async function(mode = 'all_time') {
    if (!this.adminProofsData?.payment_proofs) {
      try {
        this.adminProofsData = await request('/admin/payment-proofs').catch(() => ({ payment_proofs: [] }));
      } catch (_) {}
    }

    const proofs = (this.adminProofsData?.payment_proofs || []).filter(p => p.status === 'approved');
    const now = new Date();
    const curYear = now.getFullYear();
    const curMonth = now.getMonth();

    const isThisMonth = mode === 'this_month';
    const activeProofs = isThisMonth
      ? proofs.filter(p => {
          const d = new Date(p.reviewed_at || p.created_at);
          return d.getFullYear() === curYear && d.getMonth() === curMonth;
        })
      : proofs;

    const totalSum = activeProofs.reduce((acc, p) => acc + Number(p.amount || 0), 0);
    const avgAmount = activeProofs.length ? Math.round(totalSum / activeProofs.length) : 0;
    const arabicMonths = ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر'];
    const currentMonthName = arabicMonths[curMonth];

    const formatProofDate = (dateStr) => {
      if (!dateStr) return '—';
      try {
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('ar-EG', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
        });
      } catch (_) {
        return dateStr;
      }
    };

    const title = isThisMonth 
      ? `تفاصيل أرباح شهر ${currentMonthName} (المحصل الفعلي) 💰`
      : 'تفاصيل إجمالي النقدية المحصلة (All-Time Cash In) 💼';

    const renderTableRows = (list) => {
      if (!list.length) {
        return `
          <tr>
            <td colspan="6" style="text-align: center; padding: 2.5rem; color: #94a3b8;">
              <div style="margin-bottom: 0.5rem; display: flex; justify-content: center;">${getIcon('check', 32, '#94a3b8')}</div>
              لا توجد عمليات تحويل معتمدة في هذا النطاق
            </td>
          </tr>
        `;
      }
      return list.map((p, idx) => {
        const clientName = escapeHtml(p.tenants?.name || p.tenant_name || 'مؤسسة تعليمية');
        const amount = Number(p.amount || 0);
        let methodLabel = 'إنستاباي (InstaPay)';
        let methodColor = '#6366f1';
        if (p.payment_method === 'vodafone_cash') {
          methodLabel = 'فودافون كاش';
          methodColor = '#ef4444';
        } else if (p.payment_method === 'coupon') {
          methodLabel = 'كوبون مجاني';
          methodColor = '#10b981';
        } else if (p.payment_method === 'bank_transfer') {
          methodLabel = 'تحويل بنكي';
          methodColor = '#0284c7';
        }

        const dateStr = formatProofDate(p.created_at);
        const notes = escapeHtml(p.admin_notes || p.notes || 'لا توجد ملاحظات إضافية');
        const ref = escapeHtml(p.reference_number || '—');
        const hasImg = Boolean(p.proof_image_url);

        return `
          <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#f8fafc'" onmouseout="this.style.background='transparent'">
            <td style="padding: 0.85rem 0.65rem; font-weight: 800; color: #0f172a; font-size: 0.875rem;">
              <div style="display: flex; align-items: center; gap: 0.4rem;">
                <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #e0f2fe; color: #0369a1; font-size: 0.72rem; font-weight: 900;">${idx + 1}</span>
                <span>${clientName}</span>
              </div>
            </td>
            <td style="padding: 0.85rem 0.65rem; font-weight: 900; font-size: 1rem; color: #047857; font-family: monospace;">
              ${amount.toLocaleString('ar-EG')} <span style="font-size: 0.75rem; font-family: 'Cairo'; font-weight: 700;">ج.م</span>
            </td>
            <td style="padding: 0.85rem 0.65rem;">
              <span class="badge" style="background: ${methodColor}15; color: ${methodColor}; border: 1px solid ${methodColor}30; font-weight: 800; font-size: 0.75rem; padding: 3px 8px; border-radius: 6px;">
                ${methodLabel}
              </span>
            </td>
            <td style="padding: 0.85rem 0.65rem; font-family: monospace; font-size: 0.8rem; color: #334155; direction: ltr; text-align: right;">
              ${ref}
            </td>
            <td style="padding: 0.85rem 0.65rem; font-size: 0.78rem; color: #64748b;">
              <div style="font-weight: 700; color: #1e293b;">${notes}</div>
              <div style="font-size: 0.72rem; color: #94a3b8; margin-top: 2px;">${dateStr}</div>
            </td>
            <td style="padding: 0.85rem 0.65rem; text-align: center;">
              ${hasImg ? `
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.openProofFullscreenModal('${p.id}')" style="padding: 0.3rem 0.6rem; font-size: 0.72rem; display: inline-flex; align-items: center; gap: 0.3rem; border-radius: 6px;" title="عرض إيصال التحويل بملء الشاشة">
                  ${getIcon('search', 12)}
                  <span>معاينة</span>
                </button>
              ` : '<span style="color: #cbd5e1; font-size: 0.75rem;">بدون إيصال</span>'}
            </td>
          </tr>
        `;
      }).join('');
    };

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1.15rem;">
        
        <!-- Filter Tabs & Mode Selector -->
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 0.75rem; background: #f8fafc; padding: 0.75rem; border-radius: 12px; border: 1px solid #e2e8f0;">
          <div style="display: flex; gap: 0.5rem;">
            <button type="button" class="btn btn-sm ${!isThisMonth ? 'btn-primary' : 'btn-secondary'}" onclick="window.centrlyApp.openRevenueDetailsModal('all_time')" style="font-weight: 800; border-radius: 8px;">
              إجمالي الكاش الكل (${proofs.length})
            </button>
            <button type="button" class="btn btn-sm ${isThisMonth ? 'btn-primary' : 'btn-secondary'}" onclick="window.centrlyApp.openRevenueDetailsModal('this_month')" style="font-weight: 800; border-radius: 8px;">
              شهر ${currentMonthName} فقط
            </button>
          </div>
          <div style="font-size: 0.78rem; color: #64748b; font-weight: 700;">
            سجلات نقدية فعلية معتمدة بالإيصالات الرسمية
          </div>
        </div>

        <!-- Summary KPIs inside Modal -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 0.75rem;">
          <div style="background: #ecfdf5; border: 1px solid #a7f3d0; border-radius: 10px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.75rem; color: #047857; font-weight: 800;">إجمالي المبلغ المحصل</div>
            <div style="font-size: 1.5rem; font-weight: 900; color: #065f46; font-family: monospace; margin-top: 0.15rem;">
              ${totalSum.toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-family: 'Cairo';">ج.م</span>
            </div>
          </div>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.75rem; color: #1e40af; font-weight: 800;">عدد العمليات المعتمدة</div>
            <div style="font-size: 1.5rem; font-weight: 900; color: #1e3a8a; font-family: monospace; margin-top: 0.15rem;">
              ${activeProofs.length} <span style="font-size: 0.85rem; font-family: 'Cairo';">عملية</span>
            </div>
          </div>
          <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 0.75rem 1rem;">
            <div style="font-size: 0.75rem; color: #6b21a8; font-weight: 800;">متوسط المعاملة</div>
            <div style="font-size: 1.5rem; font-weight: 900; color: #581c87; font-family: monospace; margin-top: 0.15rem;">
              ${avgAmount.toLocaleString('ar-EG')} <span style="font-size: 0.85rem; font-family: 'Cairo';">ج.م</span>
            </div>
          </div>
        </div>

        <!-- Transactions Table -->
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow-x: auto; background: #fff;">
          <table style="width: 100%; border-collapse: collapse; text-align: right; min-width: 650px;">
            <thead>
              <tr style="background: #f1f5f9; border-bottom: 2px solid #e2e8f0; font-size: 0.78rem; color: #475569;">
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">المنظومة / المعلم</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">المبلغ</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">طريقة الدفع</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">رقم العملية / المرجع</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">الباقة والتاريخ</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800; text-align: center;">الإيصال</th>
              </tr>
            </thead>
            <tbody>
              ${renderTableRows(activeProofs)}
            </tbody>
            <tfoot>
              <tr style="background: #f8fafc; font-weight: 900; border-top: 2px solid #cbd5e1;">
                <td style="padding: 0.85rem 0.65rem; color: #0f172a;">الإجمالي النهائي</td>
                <td style="padding: 0.85rem 0.65rem; color: #047857; font-size: 1.1rem; font-family: monospace;">
                  ${totalSum.toLocaleString('ar-EG')} ج.م
                </td>
                <td colspan="4" style="padding: 0.85rem 0.65rem; color: #64748b; font-size: 0.8rem;">
                  صافي النقدية المحصلة فعلياً بحساباتك
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    `;

    const footerHtml = `
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <span style="font-size: 0.8rem; color: #64748b;">
          Centrly HQ Financial Audit
        </span>
        <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق النافذة</button>
      </div>
    `;

    this.showModal(title, bodyHtml, footerHtml, '840px');
  }

  app.openExpectedMrrModal = async function() {
    if (!this.adminTenantsData?.tenants) {
      try {
        this.adminTenantsData = await request('/admin/tenants').catch(() => ({ tenants: [] }));
      } catch (_) {}
    }

    const tenants = this.adminTenantsData?.tenants || [];
    const activeTenants = tenants.filter(t => t.subscription_status === 'active');
    
    let totalExpectedMrr = 0;
    const clientRows = activeTenants.map((t, idx) => {
      const tier = (t.subscription_tier || '').toLowerCase();
      const limit = Number(t.students_limit || t.settings?.students_limit || 0);
      const planName = t.plan_name || t.settings?.plan_name || (limit >= 1500 ? 'باقة 1500 طالب' : (limit >= 750 ? 'باقة 750 طالب' : 'باقة 300 طالب'));
      
      let normalMonthlyPrice = 499;
      let tierBadge = 'Starter';
      let tierColor = '#0284c7';
      if (limit >= 1500 || tier === 'pro' || planName.includes('1500')) {
        normalMonthlyPrice = 1399;
        tierBadge = 'Scale';
        tierColor = '#7c3aed';
      } else if (limit >= 750 || tier === 'growth' || planName.includes('750')) {
        normalMonthlyPrice = 899;
        tierBadge = 'Growth';
        tierColor = '#2563eb';
      }
      totalExpectedMrr += normalMonthlyPrice;

      let renewalDate = 'غير محدد';
      if (t.subscription_ends_at) {
        try {
          const d = new Date(t.subscription_ends_at);
          renewalDate = d.toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
        } catch (_) {}
      }
      const clientName = escapeHtml(t.name || 'مؤسسة تعليمية');

      return `
        <tr style="border-bottom: 1px solid #f1f5f9; transition: background 0.15s;" onmouseover="this.style.background='#fffbeb'" onmouseout="this.style.background='transparent'">
          <td style="padding: 0.85rem 0.65rem; font-weight: 800; color: #0f172a; font-size: 0.875rem;">
            <div style="display: flex; align-items: center; gap: 0.4rem;">
              <span style="display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; background: #fef3c7; color: #b45309; font-size: 0.72rem; font-weight: 900;">${idx + 1}</span>
              <span>${clientName}</span>
            </div>
          </td>
          <td style="padding: 0.85rem 0.65rem;">
            <span class="badge" style="background: ${tierColor}15; color: ${tierColor}; border: 1px solid ${tierColor}30; font-weight: 800; font-size: 0.75rem; padding: 3px 8px; border-radius: 6px;">
              ${planName} (${tierBadge})
            </span>
          </td>
          <td style="padding: 0.85rem 0.65rem; font-weight: 900; font-size: 1rem; color: #b45309; font-family: monospace;">
            ${normalMonthlyPrice.toLocaleString('ar-EG')} <span style="font-size: 0.75rem; font-family: 'Cairo'; font-weight: 700;">ج.م / شهر</span>
          </td>
          <td style="padding: 0.85rem 0.65rem; font-size: 0.8rem; color: #475569;">
            ${renewalDate}
          </td>
          <td style="padding: 0.85rem 0.65rem;">
            <span class="badge" style="background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; font-weight: 800; font-size: 0.75rem; padding: 3px 8px; border-radius: 6px;">
              نشط (مفعل)
            </span>
          </td>
        </tr>
      `;
    }).join('');

    const bodyHtml = `
      <div style="display: flex; flex-direction: column; gap: 1.15rem;">
        
        <!-- Explanation Banner -->
        <div style="background: #fffbeb; border: 1.5px solid #fde68a; border-radius: 12px; padding: 1rem 1.25rem;">
          <div style="display: flex; align-items: flex-start; gap: 0.65rem;">
            <span style="color: #d97706; display: flex; margin-top: 2px;">${getIcon('reports', 22, '#d97706')}</span>
            <div>
              <h4 style="margin: 0 0 0.35rem; color: #92400e; font-weight: 900; font-size: 0.95rem;">
                كيف يتم احتساب الأرباح الشهرية القادمة (MRR Normalization)؟
              </h4>
              <p style="margin: 0; color: #b45309; font-size: 0.825rem; line-height: 1.6;">
                إذا كان العميل قد اشترك في الشهر الأول بخصم ترويجي أو كود تخفيض، فإن هذا المؤشر يقوم بإعادة احتساب كل عميل بسعر الباقة <strong>الطبيعي الرسمي</strong> الذي سيدفعه في الأشهر التالية بدون خصومات، ليعطيك الرؤية الواقعية للدخل الشهري الثابت المتكرر (MRR).
              </p>
            </div>
          </div>
        </div>

        <!-- Official Plan Pricing Reference Grid -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(190px, 1fr)); gap: 0.75rem;">
          <div style="background: #f0f9ff; border: 1px solid #bae6fd; border-radius: 10px; padding: 0.75rem; text-align: center;">
            <div style="font-size: 0.75rem; font-weight: 800; color: #0369a1;">باقة Starter (300 طالب)</div>
            <div style="font-size: 1.35rem; font-weight: 900; color: #0284c7; font-family: monospace; margin: 0.25rem 0;">499 ج.م</div>
            <div style="font-size: 0.7rem; color: #64748b;">السعر الطبيعي شهرياً</div>
          </div>
          <div style="background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 10px; padding: 0.75rem; text-align: center;">
            <div style="font-size: 0.75rem; font-weight: 800; color: #1d4ed8;">باقة Growth (750 طالب)</div>
            <div style="font-size: 1.35rem; font-weight: 900; color: #2563eb; font-family: monospace; margin: 0.25rem 0;">899 ج.م</div>
            <div style="font-size: 0.7rem; color: #64748b;">السعر الطبيعي شهرياً</div>
          </div>
          <div style="background: #faf5ff; border: 1px solid #e9d5ff; border-radius: 10px; padding: 0.75rem; text-align: center;">
            <div style="font-size: 0.75rem; font-weight: 800; color: #6b21a8;">باقة Scale (1500 طالب)</div>
            <div style="font-size: 1.35rem; font-weight: 900; color: #7c3aed; font-family: monospace; margin: 0.25rem 0;">1,399 ج.م</div>
            <div style="font-size: 0.7rem; color: #64748b;">السعر الطبيعي شهرياً</div>
          </div>
        </div>

        <!-- Subscribed Clients Table -->
        <div style="border: 1px solid #e2e8f0; border-radius: 10px; overflow-x: auto; background: #fff;">
          <table style="width: 100%; border-collapse: collapse; text-align: right; min-width: 580px;">
            <thead>
              <tr style="background: #f8fafc; border-bottom: 2px solid #e2e8f0; font-size: 0.78rem; color: #475569;">
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">العميل / المنظومة</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">الباقة</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">سعر التجديد الطبيعي</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">تاريخ التجديد القادم</th>
                <th style="padding: 0.75rem 0.65rem; font-weight: 800;">الحالة</th>
              </tr>
            </thead>
            <tbody>
              ${clientRows || `
                <tr>
                  <td colspan="5" style="text-align: center; padding: 2rem; color: #94a3b8;">
                    لا يوجد مشتركون نشطون حالياً
                  </td>
                </tr>
              `}
            </tbody>
            <tfoot>
              <tr style="background: #fffbeb; font-weight: 900; border-top: 2px solid #fde68a;">
                <td style="padding: 0.85rem 0.65rem; color: #92400e;">إجمالي الإيراد الشهري القادم (MRR)</td>
                <td colspan="4" style="padding: 0.85rem 0.65rem; color: #b45309; font-size: 1.2rem; font-family: monospace;">
                  ${totalExpectedMrr.toLocaleString('ar-EG')} ج.م / شهرياً
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

      </div>
    `;

    const footerHtml = `
      <div style="display: flex; justify-content: space-between; width: 100%; align-items: center;">
        <span style="font-size: 0.8rem; color: #64748b;">
          Centrly HQ SaaS Forecast
        </span>
        <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closeModal()">إغلاق النافذة</button>
      </div>
    `;

    this.showModal('تفاصيل الإيراد الشهري المتوقع القادم (MRR) 📈', bodyHtml, footerHtml, '780px');
  }
}
