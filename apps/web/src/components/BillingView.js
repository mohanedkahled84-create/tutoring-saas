import { request } from "../services/api.js";
import { normalizeDigits } from "../utils/normalizeDigits.js";
import { getIcon } from '../utils/icons.js';
import { escapeHtml } from '../utils/escapeHtml.js';

/**
 * Centrly Billing & Subscription Plans Component
 * Features:
 * - Monthly vs Annual Switch Toggle (with 10% discount badge)
 * - Exact plans matching LandingView: 100, 250, and 500 students (All features included in all tiers)
 * - Beautiful Arabic date formatting (no raw ISO timestamps)
 * - Student capacity quota progress bar
 * - Payment methods (Vodafone Cash & InstaPay) with copy helper
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

export function renderBillingView(data = {}, user = {}) {
  const status = data.subscription_status || data.status || 'trial';
  const rawDate = data.subscription_ends_at || data.trial_ends_at || '';
  const formattedDate = formatArabicDate(rawDate);

  // Calculate or fallback accurately if server returned 0 or null while date is still in the future
  let daysRemaining = typeof data.days_remaining === 'number' ? data.days_remaining : null;
  if (daysRemaining === null || (daysRemaining <= 0 && rawDate && new Date(rawDate).getTime() > Date.now())) {
    if (rawDate) {
      const ms = new Date(rawDate).getTime() - Date.now();
      daysRemaining = Math.max(0, Math.ceil(ms / (24 * 60 * 60 * 1000)));
    } else {
      daysRemaining = 0;
    }
  }

  const currentStudents = data.students_count || (window.centrlyApp?.students?.length || 0);
  const tier = (data.subscription_tier || '').toLowerCase();
  const fallbackLimit = (tier === 'growth' || tier.includes('750') || tier.includes('250')) ? 750 : (tier === 'pro' || tier.includes('1500') || tier.includes('500')) ? 1500 : 300;
  const studentLimit = data.students_limit || fallbackLimit;
  const quotaPercent = Math.min(100, Math.round((currentStudents / studentLimit) * 100));
  const planName = data.plan_name || (studentLimit === 750 ? 'باقة 750 طالب' : studentLimit === 1500 ? 'باقة 1500 طالب' : (studentLimit === 250 ? 'باقة 250 طالب' : studentLimit === 500 ? 'باقة 500 طالب' : 'باقة 300 طالب'));

  const isYearly = (window.centrlyApp?.billingCycle === 'yearly');

  // Plan pricing configurations (All features included in all plans - 20% annual discount)
  const plans = [
    {
      id: 'plan_300',
      name: 'باقة 300 طالب',
      subtitle: 'للبدايات والمجموعات التأسيسية',
      capacity: 300,
      monthlyPrice: 499,
      yearlyPrice: 4790, // 499 * 12 * 0.8 = 4790.4 -> 4790 EGP
      yearlyMonthlyEquivalent: 399,
      yearlySavings: 1198,
      isPopular: false,
      badgeText: 'للبدايات والمجموعات',
    },
    {
      id: 'plan_750',
      name: 'باقة 750 طالب',
      subtitle: 'مثالية للمعلم النشط والمجموعات الكبيرة',
      capacity: 750,
      monthlyPrice: 899,
      yearlyPrice: 8630, // 899 * 12 * 0.8 = 8630.4 -> 8630 EGP
      yearlyMonthlyEquivalent: 719,
      yearlySavings: 2158,
      isPopular: true,
      badgeText: 'الأكثر طلباً للمعلمين',
    },
    {
      id: 'plan_1500',
      name: 'باقة 1500 طالب',
      subtitle: 'للسناتر وكبار المدرسين والمجاميع الضخمة',
      capacity: 1500,
      monthlyPrice: 1399,
      yearlyPrice: 13430, // 1399 * 12 * 0.8 = 13430.4 -> 13430 EGP
      yearlyMonthlyEquivalent: 1119,
      yearlySavings: 3358,
      isPopular: false,
      badgeText: 'للسناتر وكبار المدرسين',
    }
  ];

  const isPending = status === 'pending_verification' || status === 'pending';
  let statusBadgeHtml = '';
  if (status === 'active') {
    statusBadgeHtml = `<span class="badge" style="background: #10b981; color: #fff; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 9999px;">
      ${getIcon('dotSuccess', 8)} <span>اشتراك مفعّل وسارٍ</span>
    </span>`;
  } else if (isPending) {
    statusBadgeHtml = `<span class="badge" style="background: #f59e0b; color: #182349; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 9999px;">
      ${getIcon('refresh', 12)} <span>قيد المراجعة (Pending)</span>
    </span>`;
  } else if (status === 'trial') {
    statusBadgeHtml = `<span class="badge" style="background: #0284c7; color: #fff; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 9999px;">
      ${getIcon('dotSuccess', 8)} <span>فترة تجريبية مجانية</span>
    </span>`;
  } else {
    statusBadgeHtml = `<span class="badge" style="background: #ef4444; color: #fff; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 9999px;">
      ${getIcon('risk', 12)} <span>اشتراك منتهي</span>
    </span>`;
  }

  const teacherName = user?.name || window.centrlyApp?.user?.name || 'الأستاذ محمد خالد';

  const isPaidActive = (status === 'active') && (daysRemaining > 0);

  return `
    <div style="display: flex; flex-direction: column; gap: 1.75rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      

      <!-- Current Subscription Status Card -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #fff; border: none; border-radius: 16px; padding: 1.75rem; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          
          <div style="flex: 1; min-width: 280px;">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
              ${statusBadgeHtml}
              <span style="font-size: 0.85rem; color: #93c5fd; font-weight: 700;">
                ${isPaidActive ? `${planName} (شاملة كافة الميزات)` : 'فترة تجريبية مجانية (كافة ميزات المنصة متاحة)'}
              </span>
            </div>
            
            <h2 style="font-size: 1.4rem; font-weight: 900; margin: 0 0 0.35rem 0; color: #ffffff;">
              حساب ${escapeHtml(teacherName)}
            </h2>
            
            <p style="font-size: 0.9rem; color: #cbd5e1; margin: 0; line-height: 1.6;">
              الصلاحية الحالية سارية حتى: <strong style="color: #38bdf8;">${formattedDate}</strong>
              ${daysRemaining > 0 
                ? `(متبقي <strong style="color: #fde047;">${daysRemaining} يوماً</strong> للاستفادة الكاملة من كافة الميزات)` 
                : '<span style="color: #f87171;">(انتهت الفترة - يرجى التجديد)</span>'}
              ${isPending ? '<span style="color: #fde047; font-weight: 700; margin-right: 0.4rem;">• طلب الترقية قيد المراجعة</span>' : ''}
            </p>

            <!-- Student Capacity Utilization Bar -->
            <div style="margin-top: 1rem; max-width: 440px;">
              <div style="display: flex; justify-content: space-between; font-size: 0.8rem; color: #94a3b8; font-weight: 700; margin-bottom: 0.35rem;">
                <span>المقاعد المستخدمة: <strong style="color: #fff;">${currentStudents}</strong> / ${studentLimit} طالب</span>
                <span>${quotaPercent}%</span>
              </div>
              <div style="width: 100%; height: 8px; background: rgba(255,255,255,0.15); border-radius: 9999px; overflow: hidden;">
                <div style="width: ${quotaPercent}%; height: 100%; background: ${quotaPercent >= 100 ? '#ef4444' : (quotaPercent >= 85 ? '#f59e0b' : '#10b981')}; border-radius: 9999px; transition: width 0.3s ease;"></div>
              </div>
            </div>
          </div>

          <div style="display: flex; gap: 0.75rem; flex-wrap: wrap;">
            <button class="btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #0f172a; font-weight: 800; font-size: 0.95rem; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4); cursor: pointer;" onclick="const el = document.getElementById('pricingPlansSection'); if (el) { el.scrollIntoView({ behavior: 'smooth' }); } else { window.centrlyApp.openPlanChoiceModal(); }">
              ${isPaidActive ? 'تجديد / ترقية الاشتراك الآن' : 'اختيار باقة والاشتراك الآن'}
            </button>
          </div>

        </div>
      </div>

      <!-- Billing Cycle Switch Toggle (Monthly vs Annual with 10% Discount) -->
      <div id="pricingPlansSection" style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; margin-top: 0.5rem;">
        
        <div style="text-align: center;">
          <h3 style="font-size: 1.35rem; font-weight: 900; color: var(--centrly-ink); margin: 0 0 0.35rem;">
            اختر الباقة المناسبة لحجم طلابك
          </h3>
          <p style="font-size: 0.9rem; color: var(--centrly-text); margin: 0; font-weight: 600;">
            جميع ميزات المنصة متاحة في كل الباقات بلا استثناء — الاختلاف الوحيد هو <strong style="color: var(--centrly-blue-700);">عدد الطلاب</strong> فقط!
          </p>
        </div>

        <div style="display: inline-flex; align-items: center; background: #f1f5f9; padding: 0.35rem; border-radius: 12px; border: 1.5px solid #cbd5e1; gap: 0.35rem; margin-top: 0.25rem;">
          <button type="button" 
            onclick="window.centrlyApp.setBillingCycle('monthly')" 
            style="font-family: 'Cairo', sans-serif; font-size: 0.925rem; font-weight: 800; padding: 0.55rem 1.4rem; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s ease; ${!isYearly ? 'background: #ffffff; color: var(--centrly-blue-800); box-shadow: 0 2px 8px rgba(0,0,0,0.08);' : 'background: transparent; color: #64748b;'}">
            اشتراك شهري
          </button>
          
          <button type="button" 
            onclick="window.centrlyApp.setBillingCycle('yearly')" 
            style="font-family: 'Cairo', sans-serif; font-size: 0.925rem; font-weight: 800; padding: 0.55rem 1.4rem; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.4rem; ${isYearly ? 'background: var(--centrly-blue-700); color: #ffffff; box-shadow: 0 2px 8px rgba(37,99,235,0.25);' : 'background: transparent; color: #64748b;'}">
            <span>اشتراك سنوي</span>
            <span style="background: #10b981; color: #fff; font-size: 0.725rem; padding: 0.15rem 0.5rem; border-radius: 9999px; font-weight: 800;">خصم 20%</span>
          </button>
        </div>

      </div>

      <!-- Pricing Plans Comparison Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; align-items: stretch;">
        ${plans.map(plan => {
          const heroAmount = isYearly ? plan.yearlyMonthlyEquivalent : plan.monthlyPrice;
          const displayPeriod = isYearly ? 'ج.م / شهرياً (فاتورة سنوية)' : 'ج.م / شهرياً';
          const buttonAmount = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
          const fullPlanName = `${plan.name} (${isYearly ? 'سنوي' : 'شهري'})`;
          const isCurrentPlan = isPaidActive && (plan.capacity === studentLimit);

          let cardBorder = 'border: 1.5px solid var(--centrly-line);';
          if (isCurrentPlan) {
            cardBorder = 'border: 2.5px solid #10b981; box-shadow: 0 12px 30px rgba(16,185,129,0.18);';
          } else if (plan.isPopular) {
            cardBorder = 'border: 2.5px solid var(--centrly-blue-700); box-shadow: 0 12px 30px rgba(37,99,235,0.12);';
          }

          let topPill = '';
          if (isCurrentPlan) {
            topPill = `
              <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, #10b981, #059669); color: #fff; padding: 0.25rem 1rem; border-radius: 9999px; font-size: 0.775rem; font-weight: 800; box-shadow: 0 2px 8px rgba(16,185,129,0.3);">
                باقتك الحالية
              </div>
            `;
          } else if (plan.isPopular) {
            topPill = `
              <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, var(--centrly-blue-700), var(--centrly-blue-900)); color: #fff; padding: 0.25rem 1rem; border-radius: 9999px; font-size: 0.775rem; font-weight: 800; box-shadow: 0 2px 8px rgba(37,99,235,0.3);">
                الأكثر طلباً للمعلمين
              </div>
            `;
          }

          let buttonText = `اشترك في ${plan.name}`;
          if (isCurrentPlan) {
            buttonText = `تجديد باقتي الحالية (${plan.name})`;
          } else if (isPaidActive && plan.capacity > studentLimit) {
            buttonText = `ترقية إلى ${plan.name} (${isYearly ? 'سنوياً' : 'شهرياً'})`;
          } else if (isPaidActive) {
            buttonText = `تغيير إلى ${plan.name} (${isYearly ? 'سنوياً' : 'شهرياً'})`;
          } else {
            buttonText = `اشترك في ${plan.name} (${isYearly ? 'سنوياً' : 'شهرياً'})`;
          }

          return `
            <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between; border-radius: 16px; position: relative; transition: transform 0.2s, box-shadow 0.2s; ${cardBorder}">
              
              ${topPill}

              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: ${(isCurrentPlan || plan.isPopular) ? '0.5rem' : '0'};">
                  <h3 style="font-size: 1.25rem; font-weight: 900; color: var(--centrly-ink); margin: 0;">
                    ${plan.name}
                  </h3>
                  ${isCurrentPlan ? `<span style="background: #dcfce7; color: #166534; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 6px;">مفعّلة الآن</span>` : (!plan.isPopular ? `<span style="background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 6px;">${plan.badgeText}</span>` : '')}
                </div>
                
                <p style="font-size: 0.825rem; color: var(--centrly-text); margin: 0.4rem 0 1rem; line-height: 1.5;">
                  ${plan.subtitle}
                </p>

                <!-- Pricing Display -->
                <div style="margin: 1.25rem 0 0.75rem;">
                  <div style="display: flex; align-items: baseline; gap: 0.4rem;">
                    <span style="font-size: 2.5rem; font-weight: 900; color: ${isCurrentPlan ? '#10b981' : (plan.isPopular ? 'var(--centrly-blue-800)' : 'var(--centrly-ink)')};">
                      ${Number(heroAmount).toLocaleString('ar-EG')}
                    </span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: var(--centrly-text);">
                      ${displayPeriod}
                    </span>
                  </div>

                  ${isYearly ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.4rem; flex-wrap: wrap;">
                      <span style="font-size: 0.825rem; color: #1e3a8a; font-weight: 800; background: #eff6ff; padding: 0.2rem 0.55rem; border-radius: 6px; border: 1px solid #bfdbfe;">
                        إجمالي: ${Number(plan.yearlyPrice).toLocaleString('ar-EG')} ج.م / سنوياً
                      </span>
                      <span style="font-size: 0.8rem; color: #16a34a; font-weight: 800; background: #ecfdf5; padding: 0.2rem 0.55rem; border-radius: 6px; border: 1px solid #bbf7d0;">
                        وفرت ${Number(plan.yearlySavings).toLocaleString('ar-EG')} ج.م
                      </span>
                    </div>
                  ` : ''}
                </div>

                <!-- Capacity Badge -->
                <div style="background: ${isCurrentPlan ? '#f0fdf4' : (plan.isPopular ? '#eff6ff' : '#f8fafc')}; border: 1px solid ${isCurrentPlan ? '#bbf7d0' : (plan.isPopular ? '#bfdbfe' : '#e2e8f0')}; color: ${isCurrentPlan ? '#166534' : (plan.isPopular ? '#1e3a8a' : '#334155')}; font-size: 0.9rem; font-weight: 800; padding: 0.65rem 0.85rem; border-radius: 8px; text-align: center; margin: 1.25rem 0 1rem;">
                  سعة الطلاب: حتى ${plan.capacity} طالباً
                </div>

                <!-- All Features Included Notice (Clean and concise without long bullet points) -->
                <div style="background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 10px; padding: 0.85rem 1rem; margin-bottom: 1.75rem; text-align: center;">
                  <div style="font-size: 0.95rem; font-weight: 800; color: #166534;">
                    تشمل جميع ميزات المنصة بالكامل
                  </div>
                </div>

              </div>

              <div>
                <button class="btn ${isCurrentPlan ? 'btn-secondary' : (plan.isPopular ? 'btn-primary' : 'btn-secondary')}" 
                  style="width: 100%; font-weight: 800; padding: 0.75rem; border-radius: 10px; font-size: 0.95rem; ${isCurrentPlan ? 'background: #10b981; color: #fff; border: none;' : (plan.isPopular ? 'background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; box-shadow: 0 4px 12px rgba(37,99,235,0.25);' : '')}" 
                  onclick="window.centrlyApp.openPaymentProofModal('${fullPlanName}', ${buttonAmount}, '${isYearly ? 'yearly' : 'monthly'}')">
                  ${buttonText}
                </button>
              </div>

            </div>
          `;
        }).join('')}
      </div>

      <!-- Custom Enterprise Tier for >1500 Students -->
      <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.25rem;">
        <div style="flex: 1; min-width: 260px;">
          <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.35rem;">
            لديك أكثر من 1500 طالب أو عدة فروع لسنترك؟
          </h4>
          <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0; line-height: 1.6;">
            نوفر باقات مخصصة للأعداد الكبرى والسناتر التعليمية مع تخصيص السيرفرات وإمكانية ربط فروع متعددة ونسب أرباح السنتر وخصومات سنوية مميزة.
          </p>
        </div>
        <div>
          <button class="btn" onclick="window.centrlyApp.contactEnterpriseWhatsApp()" style="font-weight: 800; padding: 0.65rem 1.25rem; font-size: 0.9rem; display: inline-flex; align-items: center; gap: 0.45rem; background: #25d366; color: #ffffff; border: none; border-radius: 8px; box-shadow: 0 4px 12px rgba(37,211,102,0.25); cursor: pointer;">
            ${getIcon('whatsapp', 18, '#ffffff')}
            <span>طلب التفاصيل</span>
          </button>
        </div>
      </div>

      <!-- Subscription Status Bottom Bar -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1.5px solid ${isPending ? '#fde68a' : 'var(--centrly-line)'}; border-radius: 14px; padding: 1.25rem 1.5rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="display: flex; align-items: center; justify-content: center; width: 38px; height: 38px; border-radius: 50%; background: ${isPending ? '#fef3c7' : '#f1f5f9'}; color: ${isPending ? '#d97706' : 'var(--centrly-blue-700)'};">
              ${getIcon(isPending ? 'refresh' : 'billing', 20, isPending ? '#d97706' : 'var(--centrly-blue-700)')}
            </span>
            <div>
              <div style="font-weight: 800; font-size: 0.95rem; color: var(--centrly-ink);">
                حالة الاشتراك: <span style="color: ${isPending ? '#d97706' : (status === 'active' ? '#10b981' : '#0284c7')};">${isPending ? 'قيد المراجعة (Pending)' : (status === 'active' ? 'مفعّل (Active)' : 'فترة تجريبية (Trial)')}</span>
              </div>
              <div style="font-size: 0.8rem; color: var(--centrly-text); margin-top: 0.2rem;">
                ${isPending 
                  ? 'تم استلام بيانات التحويل والإيصال وهو الآن قيد المراجعة (Pending) - سيتم تفعيل حسابك فور التحقق.' 
                  : 'يمكنك ترقية أو تجديد باقتك بالضغط على زر (اشترك في الباقة) لإتمام التحويل وإرفاق الإيصال.'}
              </div>
            </div>
          </div>
          <span class="badge" style="font-size: 0.85rem; font-weight: 800; padding: 0.4rem 0.85rem; border-radius: 8px; ${isPending ? 'background: #fef3c7; color: #92400e; border: 1px solid #fde68a;' : (status === 'active' ? 'background: #dcfce7; color: #166534;' : 'background: #e0f2fe; color: #0369a1;')}">
            ${isPending ? 'Pending' : (status === 'active' ? 'Active' : 'Trial')}
          </span>
        </div>
      </div>

    </div>
  `;
}

export function registerBillingActions(app) {
  // Billing & Subscription Actions (DEV-SL.3 & DEV-39)
  // ==========================================================================

  app.setBillingCycle = function(cycle = 'monthly') {
    this.billingCycle = cycle;
    this.renderMainContent();
  }

  app.showQuotaBlockedModal = function(currentCount, limit) {
    const existing = document.getElementById('quotaBlockedModal');
    if (existing) existing.remove();

    const modalHtml = `
      <div id="quotaBlockedModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.6); align-items: center; justify-content: center; z-index: 9999; padding: 1rem;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: 0; text-align: center; padding: 2rem; border-radius: 16px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.25); font-family: 'Cairo', sans-serif;">
          <div style="width: 56px; height: 56px; margin: 0 auto 1rem; border-radius: 50%; background: #fee2e2; color: #ef4444; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 900;">
            !
          </div>
          <h3 style="font-size: 1.3rem; font-weight: 900; color: #991b1b; margin: 0 0 0.5rem 0;">
            تم الوصول للحد الأقصى لباقتك
          </h3>
          <p style="font-size: 0.9rem; color: #475569; line-height: 1.6; margin: 0 0 1.25rem 0;">
            لقد استهلكت كامل سعة الطلاب المتاحة في باقتك (<strong>${currentCount} من أصل ${limit} طالب</strong>) وتجاوزت فترة السماح المحددة بـ 3 أيام.
            <br>
            لمواصلة إضافة الطلاب الجدد، يرجى ترقية باقتك إلى باقة أعلى (750 أو 1500 طالب).
          </p>
          <div style="display: flex; gap: 0.75rem; justify-content: center;">
            <button class="btn btn-secondary" onclick="document.getElementById('quotaBlockedModal')?.remove()">إغلاق</button>
            <button class="btn btn-primary" onclick="document.getElementById('quotaBlockedModal')?.remove(); window.centrlyApp.navigate('billing');" style="background: #2563eb; font-weight: 800;">
              ترقية الباقة الآن
            </button>
          </div>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  app.contactEnterpriseWhatsApp = function() {
    const phone = '201010979708';
    const message = encodeURIComponent('السلام عليكم، عايز أعمل باقة فوق 1500 طالب ومحتاج أعرف التفاصيل والأسعار.');
    window.open(`https://wa.me/${phone}?text=${message}`, '_blank');
  }

  app.openPlanChoiceModal = function() {
    const isPaidActive = this.isUserSubscribed();
    if (!isPaidActive) {
      const el = document.getElementById('pricingPlansSection');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
        return;
      }
    }

    const isYearly = (this.billingCycle === 'yearly');
    const userPlanName = this.billingState?.plan_name || 'باقة 300 طالب';
    const plans = [
      { name: 'باقة 300 طالب', monthly: 499, yearly: 4790 },
      { name: 'باقة 750 طالب', monthly: 899, yearly: 8630 },
      { name: 'باقة 1500 طالب', monthly: 1399, yearly: 13430 },
    ];
    const currentMatched = plans.find(p => userPlanName.includes(p.name)) || plans[0];
    const currentPrice = isYearly ? currentMatched.yearly : currentMatched.monthly;

    const bodyHtml = `
      <div style="font-family: 'Cairo', sans-serif; text-align: center; padding: 0.5rem 0;">
        <h4 style="font-size: 1.15rem; font-weight: 800; color: #0f172a; margin-bottom: 0.5rem;">
          ما الذي ترغب في القيام به اليوم؟
        </h4>
        <p style="font-size: 0.85rem; color: #64748b; margin-bottom: 1.5rem; line-height: 1.6;">
          يمكنك تجديد باقتك الحالية مباشرة بنفس المميزات أو الاطلاع على الباقات الأخرى للترقية لعدد طلاب أكبر.
        </p>

        <div style="display: flex; flex-direction: column; gap: 1rem;">
          <!-- Option 1: Renew Current Plan -->
          <div style="border: 2px solid var(--centrly-blue-700); background: #eff6ff; border-radius: 12px; padding: 1.25rem; text-align: right; cursor: pointer; transition: all 0.2s;" onclick="window.centrlyApp.closeModal(); window.centrlyApp.openPaymentProofModal('${currentMatched.name}', ${currentPrice}, '${isYearly ? 'yearly' : 'monthly'}');">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <strong style="font-size: 1.05rem; color: var(--centrly-blue-800);">تجديد باقتي الحالية (${currentMatched.name})</strong>
              <span class="badge badge-primary" style="font-weight: 800;">${Number(currentPrice).toLocaleString('ar-EG')} ج.م ${isYearly ? '/ سنوياً' : '/ شهرياً'}</span>
            </div>
            <p style="font-size: 0.8rem; color: #475569; margin: 0;">
              المتابعة بنفس عدد الطلاب الحالي وتمديد فترة الاشتراك فوراً.
            </p>
          </div>

          <!-- Option 2: Change / Upgrade Plan -->
          <div style="border: 1.5px solid #cbd5e1; background: #ffffff; border-radius: 12px; padding: 1.25rem; text-align: right; cursor: pointer; transition: all 0.2s;" onclick="window.centrlyApp.closeModal(); const el = document.getElementById('pricingPlansSection'); if (el) el.scrollIntoView({ behavior: 'smooth' });">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.35rem;">
              <strong style="font-size: 1.05rem; color: #0f172a;">ترقية أو تغيير الباقة</strong>
              <span class="badge badge-secondary" style="font-weight: 700;">اختيار سعة جديدة</span>
            </div>
            <p style="font-size: 0.8rem; color: #64748b; margin: 0;">
              استعراض باقات الـ 750 والـ 1500 طالب والاشتراك السنوي بخصم 20%.
            </p>
          </div>
        </div>
      </div>
    `;

    this.showModal('تجديد أو ترقية الاشتراك', bodyHtml);
  }

  app.openPaymentProofModal = function(planName = 'باقة 300 طالب', amount = 499, billingCycle = 'monthly') {
    const existing = document.getElementById('paymentProofModal');
    if (existing) existing.remove();

    this.currentProofImageData = null;
    this.originalAmount = Number(amount);
    let effective = Number(amount);
    if (this.appliedCouponData) {
      if (this.appliedCouponData.discount_percent) {
        effective = Math.max(0, Math.round(Number(amount) * (1 - (this.appliedCouponData.discount_percent / 100))));
      } else if (this.appliedCouponData.discount_amount) {
        effective = Math.max(0, Number(amount) - Number(this.appliedCouponData.discount_amount));
      }
    }
    this.currentEffectiveAmount = effective;
    const isFree = (effective <= 0);

    const isYearly = (billingCycle === 'yearly');
    const periodLabel = isYearly ? 'اشتراك سنوي (خصم 20%)' : 'اشتراك شهري';

    const modalHtml = `
      <div id="paymentProofModal" class="modal-overlay" style="display: flex; position: fixed; inset: 0; background: rgba(0,0,0,0.55); align-items: center; justify-content: center; z-index: 9999; padding: 1rem; overflow-y: auto;" dir="rtl">
        <div class="card" style="width: 100%; max-width: 480px; margin: auto; animation: modalFadeIn 0.2s ease-out; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.2); font-family: 'Cairo', sans-serif; border-radius: 16px;">
          <div class="card-header" style="border-bottom: 1px solid var(--centrly-line); padding-bottom: 0.75rem; margin-bottom: 1rem;">
            <div>
              <h3 class="card-title" style="margin: 0; font-size: 1.15rem; font-weight: 800;">الاشتراك في ${escapeHtml(planName)}</h3>
              <p id="proofAmountSummary" style="font-size: 0.85rem; color: var(--centrly-text); margin: 0.25rem 0 0 0;">
                المبلغ المطلوب: <strong id="proofDisplayAmount" style="color: var(--centrly-blue-700);">${this.appliedCouponData ? `<span style="text-decoration: line-through; color: #94a3b8; font-size: 0.85rem; margin-left: 0.35rem;">${Number(amount).toLocaleString('ar-EG')}</span> ${Number(effective).toLocaleString('ar-EG')} ج.م` : `${Number(amount).toLocaleString('ar-EG')} ج.م`}</strong> (${periodLabel})
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="window.centrlyApp.closePaymentProofModal()" style="border: none; cursor: pointer; padding: 0.35rem 0.6rem; display: flex; align-items: center;">${getIcon('close', 16, '#64748b')}</button>
          </div>

          <form onsubmit="window.centrlyApp.handleSubmitPaymentProof(event, ${amount}, '${planName}', '${billingCycle}')">
            
            <!-- Transfer Number Card (hidden if 100% free) -->
            <div id="proofTransferCard" style="${isFree ? 'display: none;' : 'display: block;'} background: #f0fdf4; border: 1.5px solid #bbf7d0; border-radius: 12px; padding: 0.9rem 1.1rem; margin-bottom: 1rem;">
              <div style="font-size: 0.825rem; color: #166534; font-weight: 700; margin-bottom: 0.35rem;">
                رقم التحويل (إنستاباي أو محفظة إلكترونية):
              </div>
              <div style="display: flex; align-items: center; justify-content: space-between; gap: 0.75rem;">
                <div style="font-family: monospace; font-size: 1.35rem; font-weight: 900; color: #15803d; direction: ltr; letter-spacing: 1px;">
                  01010979708
                </div>
                <button type="button" class="btn btn-secondary btn-sm" onclick="window.centrlyApp.copyToClipboard('01010979708', 'تم نسخ الرقم 01010979708 بنجاح!', 'رقم التحويل')" style="font-weight: 800; font-size: 0.8rem; background: #ffffff; border-color: #86efac; color: #166534;">
                  نسخ الرقم
                </button>
              </div>
              <div id="proofTransferInstruction" style="font-size: 0.775rem; color: #4b5563; margin-top: 0.4rem; line-height: 1.5;">
                قم بتحويل المبلغ ${this.appliedCouponData ? 'المخفض ' : ''}<strong>(${Number(effective).toLocaleString('ar-EG')} ج.م)</strong> إلى هذا الرقم عبر إنستاباي أو من محفظتك، ثم أرفق الاسكرين شوت أدناه.
              </div>
            </div>

            <!-- Free 100% Celebration Banner (shown if 100% free) -->
            <div id="proofFreeBanner" style="${isFree ? 'display: block;' : 'display: none;'} background: #ecfdf5; border: 1.5px solid #a7f3d0; border-radius: 12px; padding: 1rem 1.15rem; margin-bottom: 1rem;">
              <div style="display: flex; align-items: center; gap: 0.75rem;">
                <span style="font-size: 1.75rem;">🎉</span>
                <div>
                  <div style="font-weight: 800; color: #065f46; font-size: 0.95rem;">الاشتراك مجاني بالكامل (خصم 100%)</div>
                  <div style="font-size: 0.8rem; color: #047857; margin-top: 0.2rem; line-height: 1.5;">
                    تم تطبيق كود الخصم بنجاح! لا يتطلب الاشتراك أي تحويل مالي أو إرفاق اسكرين شوت.
                  </div>
                </div>
              </div>
            </div>

            <!-- Discount Coupon Section in Payment Modal -->
            <div style="margin-bottom: 1rem; background: #f8fafc; border: 1.5px dashed var(--centrly-blue-700); border-radius: 12px; padding: 0.85rem 1rem;">
              <label class="form-label" style="font-weight: 800; font-size: 0.85rem; color: #1e3a8a; margin-bottom: 0.4rem; display: flex; align-items: center; justify-content: space-between;">
                <span style="display: flex; align-items: center; gap: 0.4rem;">
                  ${getIcon('gift', 16, 'var(--centrly-blue-700)')}
                  <span>لديك كود خصم أو بروموكود اشتراك؟</span>
                </span>
                <span class="badge badge-blue" style="font-size: 0.7rem; padding: 0.1rem 0.4rem;">تخفيض فوري</span>
              </label>
              <div style="display: flex; gap: 0.4rem;">
                <input type="text" id="couponCodeInput" class="form-input" placeholder="اكتب كود الخصم إن وجد" style="flex: 1; text-transform: uppercase; font-weight: 800; font-family: monospace; font-size: 0.875rem;" autocomplete="off" value="${escapeHtml(this.appliedCouponCode || '')}" ${this.appliedCouponData ? 'disabled' : ''} onkeydown="if(event.key==='Enter'){event.preventDefault(); window.centrlyApp.applyCouponCode();}">
                <button type="button" id="btnApplyCoupon" class="btn btn-secondary" onclick="window.centrlyApp.applyCouponCode()" style="font-weight: 800; font-size: 0.825rem; padding: 0.4rem 1.1rem; border-color: var(--centrly-blue-700); color: ${this.appliedCouponData ? '#ffffff' : 'var(--centrly-blue-700)'}; background: ${this.appliedCouponData ? '#10b981' : 'transparent'}; cursor: pointer;" ${this.appliedCouponData ? 'disabled' : ''}>
                  ${this.appliedCouponData ? 'مفعّل ✓' : 'تطبيق'}
                </button>
              </div>
              <div id="couponFeedback" style="${this.appliedCouponData ? 'display: block; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;' : 'display: none;'} font-size: 0.78rem; font-weight: 700; margin-top: 0.4rem; padding: 0.35rem 0.6rem; border-radius: 6px;">
                ${this.appliedCouponData ? `تم تطبيق الكود (${escapeHtml(this.appliedCouponCode)}) بنجاح!` : ''}
              </div>
            </div>

            <!-- Transfer Method Selection (hidden if free) -->
            <div id="proofMethodGroup" class="form-group" style="${isFree ? 'display: none;' : 'display: block;'} margin-bottom: 0.85rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">طريقة التحويل المستخدمة</label>
              <select id="proofPaymentMethod" class="form-input" style="width: 100%;">
                <option value="instapay">إنستاباي (InstaPay)</option>
                <option value="vodafone_cash">محفظة إلكترونية (فودافون كاش / محافظ المحمول)</option>
              </select>
            </div>

            <!-- Screenshot Upload (Primary) (hidden if free) -->
            <div id="proofScreenshotGroup" class="form-group" style="${isFree ? 'display: none;' : 'display: block;'} margin-bottom: 0.85rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem; display: flex; justify-content: space-between; align-items: center;">
                <span>إرفاق الاسكرين شوت (صورة إيصال التحويل)</span>
                <span style="font-size: 0.75rem; color: #16a34a; font-weight: 700;">مطلوب</span>
              </label>

              <input type="file" id="proofImageFile" accept="image/*" style="display: none;" onchange="window.centrlyApp.handleProofImageSelected(this)">

              <div id="proofDropzone" onclick="document.getElementById('proofImageFile').click()" style="border: 2px dashed #cbd5e1; border-radius: 12px; padding: 1.25rem 1rem; text-align: center; cursor: pointer; background: #f8fafc; transition: all 0.2s ease;">
                <div style="font-size: 0.95rem; font-weight: 800; color: var(--centrly-blue-700); margin-bottom: 0.25rem;">
                  انقر هنا لاختيار الاسكرين شوت
                </div>
                <div style="font-size: 0.775rem; color: #64748b;">
                  أو اسحب وأفلت صورة التحويل هنا
                </div>
              </div>

              <div id="proofImagePreviewContainer" style="display: none; margin-top: 0.6rem; position: relative; border-radius: 12px; overflow: hidden; border: 1.5px solid #cbd5e1; background: #0f172a;">
                <img id="proofImagePreview" src="" alt="معاينة إيصال التحويل" style="width: 100%; max-height: 180px; object-fit: contain; display: block;">
                <button type="button" onclick="window.centrlyApp.removeProofImage()" style="position: absolute; top: 8px; right: 8px; background: rgba(239, 68, 68, 0.95); color: white; border: none; border-radius: 6px; padding: 0.35rem 0.65rem; font-size: 0.75rem; font-weight: 800; cursor: pointer; font-family: 'Cairo', sans-serif;">
                  حذف الصورة
                </button>
              </div>
            </div>

            <!-- Optional reference or notes (hidden if free) -->
            <div id="proofRefGroup" class="form-group" style="${isFree ? 'display: none;' : 'display: block;'} margin-bottom: 1rem;">
              <label class="form-label" style="font-weight: 700; font-size: 0.85rem;">رقم المحفظة المحول منها أو رقم العملية (اختياري)</label>
              <input type="text" id="proofRefNumber" class="form-input" placeholder="رقم هاتفك المحول منه أو رقم العملية..." dir="ltr">
            </div>

            <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
              <button type="button" class="btn btn-secondary" onclick="window.centrlyApp.closePaymentProofModal()">إلغاء</button>
              <button type="submit" id="btnSubmitProof" class="btn btn-primary" style="font-weight: 800; ${isFree ? 'background: #10b981; border-color: #10b981;' : ''}">
                ${isFree ? 'تأكيد الاشتراك مجاناً 🎉' : 'تأكيد وإرسال الإيصال'}
              </button>
            </div>
          </form>
        </div>
      </div>
    `;

    document.body.insertAdjacentHTML('beforeend', modalHtml);

    // Setup drag and drop for dropzone
    setTimeout(() => {
      const dropzone = document.getElementById('proofDropzone');
      if (dropzone) {
        dropzone.addEventListener('dragover', (ev) => {
          ev.preventDefault();
          dropzone.style.borderColor = 'var(--centrly-blue-700)';
          dropzone.style.background = '#eff6ff';
        });
        dropzone.addEventListener('dragleave', () => {
          dropzone.style.borderColor = '#cbd5e1';
          dropzone.style.background = '#f8fafc';
        });
        dropzone.addEventListener('drop', (ev) => {
          ev.preventDefault();
          dropzone.style.borderColor = '#cbd5e1';
          dropzone.style.background = '#f8fafc';
          if (ev.dataTransfer?.files?.length) {
            const fileInput = document.getElementById('proofImageFile');
            if (fileInput) {
              fileInput.files = ev.dataTransfer.files;
              this.handleProofImageSelected(fileInput);
            }
          }
        });
      }
    }, 50);
  }

  app.applyCouponCode = async function() {
    const codeInput = document.getElementById('couponCodeInput');
    const feedback = document.getElementById('couponFeedback');
    const applyBtn = document.getElementById('btnApplyCoupon');
    const displayAmount = document.getElementById('proofDisplayAmount');
    const transferInstruction = document.getElementById('proofTransferInstruction');
    const code = codeInput ? codeInput.value.trim().toUpperCase() : '';

    if (!code) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#dc2626';
        feedback.innerText = 'يرجى إدخال كود الخصم أولاً';
      }
      return;
    }

    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.innerText = 'تحقق...';
    }

    try {
      const res = await request('/billing/validate-coupon', {
        method: 'POST',
        body: { code, amount: this.originalAmount },
      });

      if (res && res.valid) {
        this.appliedCouponCode = res.gift_code?.code || code;
        this.appliedCouponData = res.gift_code || { code, discount_percent: res.discount_percent, discount_amount: res.discount_amount };
        this.currentEffectiveAmount = res.final_amount;
        const isFree = (Number(res.final_amount) <= 0);

        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.background = '#ecfdf5';
          feedback.style.color = '#059669';
          feedback.innerText = `تم تطبيق الكود (${this.appliedCouponCode}) بنجاح! وفرت ${Number(res.discount_amount).toLocaleString('ar-EG')} ج.م`;
        }

        if (displayAmount) {
          displayAmount.innerHTML = `<span style="text-decoration: line-through; color: #94a3b8; font-size: 0.85rem; margin-left: 0.35rem;">${Number(this.originalAmount).toLocaleString('ar-EG')}</span> ${Number(res.final_amount).toLocaleString('ar-EG')} ج.م`;
        }

        const transferCard = document.getElementById('proofTransferCard');
        const freeBanner = document.getElementById('proofFreeBanner');
        const methodGroup = document.getElementById('proofMethodGroup');
        const screenshotGroup = document.getElementById('proofScreenshotGroup');
        const refGroup = document.getElementById('proofRefGroup');
        const submitBtn = document.getElementById('btnSubmitProof');

        if (isFree) {
          if (transferCard) transferCard.style.display = 'none';
          if (freeBanner) freeBanner.style.display = 'block';
          if (methodGroup) methodGroup.style.display = 'none';
          if (screenshotGroup) screenshotGroup.style.display = 'none';
          if (refGroup) refGroup.style.display = 'none';
          if (submitBtn) {
            submitBtn.innerText = 'تأكيد الاشتراك مجاناً 🎉';
            submitBtn.style.background = '#10b981';
            submitBtn.style.borderColor = '#10b981';
          }
          this.removeProofImage();
        } else {
          if (transferCard) transferCard.style.display = 'block';
          if (freeBanner) freeBanner.style.display = 'none';
          if (methodGroup) methodGroup.style.display = 'block';
          if (screenshotGroup) screenshotGroup.style.display = 'block';
          if (refGroup) refGroup.style.display = 'block';
          if (submitBtn) {
            submitBtn.innerText = 'تأكيد وإرسال الإيصال';
            submitBtn.style.background = '';
            submitBtn.style.borderColor = '';
          }
          if (transferInstruction) {
            transferInstruction.innerHTML = `قم بتحويل المبلغ المخفض <strong>(${Number(res.final_amount).toLocaleString('ar-EG')} ج.م)</strong> بعد تطبيق الخصم إلى هذا الرقم، ثم أرفق الاسكرين شوت أدناه.`;
          }
        }

        if (codeInput) codeInput.disabled = true;
        if (applyBtn) {
          applyBtn.disabled = true;
          applyBtn.innerText = 'مفعّل ✓';
          applyBtn.style.background = '#10b981';
          applyBtn.style.color = '#ffffff';
          applyBtn.style.borderColor = '#10b981';
        }
      } else {
        throw new Error(res?.error?.message || 'كود الخصم غير صالح أو منتهي الصلاحية');
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#dc2626';
        feedback.innerText = err.message || 'كود الخصم غير صالح أو منتهي الصلاحية';
      }
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.innerText = 'تطبيق';
      }
    }
  }

  app.applyBillingCouponFromView = async function() {
    const input = document.getElementById('billingDiscountCodeInput');
    const feedback = document.getElementById('billingDiscountFeedback');
    const applyBtn = document.getElementById('btnApplyBillingDiscount');
    const rawCode = (input ? input.value : '').trim().toUpperCase();

    if (!rawCode) {
      this.showToast('يرجى كتابة كود الخصم أولاً', 'warning');
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#dc2626';
        feedback.style.borderColor = '#fecaca';
        feedback.innerText = 'يرجى إدخال كود الخصم أولاً';
      }
      return;
    }

    if (applyBtn) {
      applyBtn.disabled = true;
      applyBtn.innerText = 'جاري التحقق...';
    }

    try {
      const res = await request('/billing/validate-coupon', {
        method: 'POST',
        body: { code: rawCode, amount: 499 },
      });

      if (res && res.valid) {
        this.appliedCouponCode = res.gift_code?.code || rawCode;
        this.appliedCouponData = res.gift_code || { code: rawCode, discount_percent: res.discount_percent || 20, discount_amount: res.discount_amount };
        const discountLabel = this.appliedCouponData.discount_percent 
          ? `${this.appliedCouponData.discount_percent}%` 
          : `${this.appliedCouponData.discount_amount || res.discount_amount} ج.م`;

        if (feedback) {
          feedback.style.display = 'block';
          feedback.style.background = '#ecfdf5';
          feedback.style.color = '#065f46';
          feedback.style.borderColor = '#a7f3d0';
          feedback.innerText = `تم تفعيل كود الخصم (${this.appliedCouponCode}) بنجاح! خصم بقيمة ${discountLabel} على كافة الباقات.`;
        }
        this.showToast(`تم تفعيل كود الخصم (${this.appliedCouponCode}) بنجاح!`, 'success');
        this.renderMainContent();
      } else {
        throw new Error(res?.error?.message || 'كود الخصم غير صالح أو منتهي الصلاحية');
      }
    } catch (err) {
      if (feedback) {
        feedback.style.display = 'block';
        feedback.style.background = '#fef2f2';
        feedback.style.color = '#dc2626';
        feedback.style.borderColor = '#fecaca';
        feedback.innerText = err.message || 'كود الخصم غير صالح أو منتهي الصلاحية';
      }
      this.showToast(err.message || 'كود الخصم غير صالح', 'error');
    } finally {
      if (applyBtn) {
        applyBtn.disabled = false;
        applyBtn.innerText = 'تطبيق الخصم';
      }
    }
  }

  app.handleProofImageSelected = function(input) {
    const file = input?.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      this.showToast('يرجى اختيار ملف صورة صالح (PNG أو JPG)', 'danger');
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let { width, height } = img;
        const maxDim = 1200;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round((height * maxDim) / width);
            width = maxDim;
          } else {
            width = Math.round((width * maxDim) / height);
            height = maxDim;
          }
        }
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.8);
        this.currentProofImageData = compressedDataUrl;

        const preview = document.getElementById('proofImagePreview');
        const container = document.getElementById('proofImagePreviewContainer');
        const dropzone = document.getElementById('proofDropzone');
        if (preview) {
          preview.src = compressedDataUrl;
        }
        if (container) {
          container.style.display = 'block';
        }
        if (dropzone) {
          dropzone.style.display = 'none';
        }
      };
      img.src = e.target.result;
    };
    reader.readAsDataURL(file);
  }

  app.removeProofImage = function() {
    this.currentProofImageData = null;
    const fileInput = document.getElementById('proofImageFile');
    if (fileInput) fileInput.value = '';
    const container = document.getElementById('proofImagePreviewContainer');
    if (container) container.style.display = 'none';
    const preview = document.getElementById('proofImagePreview');
    if (preview) preview.src = '';
    const dropzone = document.getElementById('proofDropzone');
    if (dropzone) dropzone.style.display = 'block';
  }

  app.closePaymentProofModal = function() {
    this.currentProofImageData = null;
    this.appliedCouponCode = null;
    const modal = document.getElementById('paymentProofModal');
    if (modal) modal.remove();
  }

  app.handleSubmitPaymentProof = async function(e, amount, planName = 'باقة 100 طالب', billingCycle = 'monthly') {
    e.preventDefault();

    // Auto-apply coupon if user typed it in the modal input but didn't click "تطبيق"
    const pendingCouponInput = document.getElementById('couponCodeInput')?.value?.trim().toUpperCase();
    if (pendingCouponInput && !this.appliedCouponCode) {
      try {
        await this.applyCouponCode();
      } catch (_) {}
    }

    const effectiveAmount = this.currentEffectiveAmount !== undefined ? this.currentEffectiveAmount : Number(amount);
    const isFree = (Number(effectiveAmount) <= 0);

    const method = isFree ? 'coupon' : (document.getElementById('proofPaymentMethod')?.value || 'instapay');
    const refNum = isFree ? (this.appliedCouponCode || 'FREE_COUPON') : document.getElementById('proofRefNumber')?.value?.trim();
    const notes = document.getElementById('proofNotes')?.value?.trim() || null;
    const btn = document.getElementById('btnSubmitProof');

    if (!isFree && !this.currentProofImageData && !refNum) {
      this.showToast('يرجى إرفاق صورة إيصال التحويل (الاسكرين شوت)', 'danger');
      return;
    }

    if (btn) {
      btn.disabled = true;
      btn.innerText = isFree ? 'جارٍ تفعيل الاشتراك...' : 'جارٍ التأكيد...';
    }

    const couponTag = this.appliedCouponCode 
      ? `[كود خصم: ${this.appliedCouponCode}${isFree ? ' (خصم 100%)' : ''}] [المبلغ الأصلي: ${Number(amount)} ج.م]`
      : '';
    const planTag = `[${planName} - ${billingCycle === 'yearly' ? 'اشتراك سنوي' : 'اشتراك شهري'}]`;
    const fullNotes = [planTag, couponTag, notes].filter(Boolean).join(' ');

    try {
      await request('/billing/payment-proof', {
        method: 'POST',
        body: JSON.stringify({
          amount: Number(effectiveAmount),
          payment_method: method,
          reference_number: refNum || null,
          proof_image_url: this.currentProofImageData || null,
          notes: fullNotes,
          coupon_code: this.appliedCouponCode || null,
        }),
      });

      if (!this.billingState) this.billingState = {};
      this.billingState.subscription_status = 'pending_verification';
      this.billingState.status = 'pending';

      this.closePaymentProofModal();
      if (isFree) {
        this.showToast('تم تسجيل وتفعيل الاشتراك المجاني بنجاح! 🎉', 'success');
      } else {
        this.showToast('تم استلام إيصال التحويل بنجاح! الحالة الآن قيد المراجعة (Pending).', 'success');
      }
      this.renderMainContent();
      try {
        await this.loadRouteData('billing');
      } catch (_) {}
    } catch (err) {
      this.showToast(`فشل تسجيل إيصال الدفع: ${err.message || 'خطأ في الخادم'}`, 'danger');
      if (btn) {
        btn.disabled = false;
        btn.innerText = isFree ? 'تأكيد الاشتراك مجاناً 🎉' : 'تأكيد وإرسال الإيصال';
      }
    }
  };
}
