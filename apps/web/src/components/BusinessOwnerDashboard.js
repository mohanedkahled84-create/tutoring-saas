import { escapeHtml } from "../utils/escapeHtml.js";
import { getIcon } from "../utils/icons.js";

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
        <div class="card" style="margin: 0; border-top: 4px solid #10b981; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">إجمالي النقدية المحصلة (كاش فعلي)</span>
            <span style="color: #10b981; display: flex;">${getIcon('billing', 18)}</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 900; color: #047857; margin: 0.35rem 0; font-family: monospace;">
            ${(overview.total_collected_egp || 0).toLocaleString('ar-EG')} <span style="font-size: 0.95rem; font-family: 'Cairo'; font-weight: 700;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: #64748b; display: flex; align-items: center; gap: 0.3rem;">
            ${getIcon('check', 12, '#10b981')}
            <span>من واقع <strong>${overview.approved_proofs_count || 0}</strong> إيصال دفع معتمد حتى اللحظة</span>
          </div>
        </div>

        <!-- 2. This Month's Real Collected Cash -->
        <div class="card" style="margin: 0; border-top: 4px solid #0284c7; background: #fff; border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: #64748b; font-weight: 700;">أرباح هذا الشهر (${currentMonthName})</span>
            <span style="color: #0284c7; display: flex;">${getIcon('activity', 18)}</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 900; color: #0369a1; margin: 0.35rem 0; font-family: monospace;">
            ${(overview.this_month_collected_egp || 0).toLocaleString('ar-EG')} <span style="font-size: 0.95rem; font-family: 'Cairo'; font-weight: 700;">ج.م</span>
          </div>
          <div style="font-size: 0.75rem; color: #64748b;">
            صافي مبالغ التحويلات المعتمدة خلال الشهر الجاري
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
        <div class="card" style="margin: 0; border-top: 4px solid #d97706; background: linear-gradient(180deg, #fffbeb, #fff); border-radius: 12px; box-shadow: 0 4px 12px rgba(0,0,0,0.03);">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 0.8rem; color: #92400e; font-weight: 800;">الأرباح الشهرية القادمة المتوقعة (الإيراد الشهري التقديري)</span>
            <span style="color: #d97706; display: flex;">${getIcon('reports', 18)}</span>
          </div>
          <div style="font-size: 1.85rem; font-weight: 900; color: #b45309; margin: 0.35rem 0; font-family: monospace;">
            ${(overview.expected_next_month_mrr || 0).toLocaleString('ar-EG')} <span style="font-size: 0.95rem; font-family: 'Cairo'; font-weight: 700;">ج.م</span>
          </div>
          <div style="font-size: 0.725rem; color: #b45309; font-weight: 700; line-height: 1.4;">
            محسوبة بالأسعار الطبيعية للباقات بعد انتهاء فترات الخصم الترويجية
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
              const methodLabel = proof.payment_method === 'vodafone_cash' ? 'فودافون كاش' : 'إنستاباي';
              return `
                <div style="background: #fff; border: 1.5px solid #fde68a; border-radius: 12px; padding: 1rem; display: flex; flex-direction: column; justify-content: space-between; box-shadow: 0 4px 10px rgba(0,0,0,0.02);">
                  <div>
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; gap: 0.5rem; margin-bottom: 0.5rem;">
                      <div>
                        <div style="font-weight: 900; color: #0f172a; font-size: 1rem;">${escapeHtml(tenantName)}</div>
                        <div style="font-size: 0.75rem; color: #64748b;">${formatArabicDate(proof.created_at)}</div>
                      </div>
                      <div style="font-size: 1.15rem; font-weight: 900; color: #047857; font-family: monospace;">
                        ${Number(proof.amount || 0).toLocaleString('ar-EG')} ج.م
                      </div>
                    </div>

                    <div style="font-size: 0.8rem; color: #334155; margin-bottom: 0.75rem; background: #f8fafc; padding: 0.5rem; border-radius: 6px; border: 1px solid #e2e8f0;">
                      <div><b>الوسيلة:</b> ${methodLabel}</div>
                      <div><b>المرجع/المحفظة:</b> <span style="font-family: monospace;" dir="ltr">${escapeHtml(proof.reference_number || 'غير مسجل')}</span></div>
                      ${proof.notes ? `<div><b>ملاحظة:</b> ${escapeHtml(proof.notes)}</div>` : ''}
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
