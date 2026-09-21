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

      <!-- Promo / Discount Code Voucher Box in BillingView -->
      <div class="card" style="margin: 0.5rem 0 0; background: #ffffff; border: 1.5px dashed var(--centrly-blue-700); border-radius: 14px; padding: 1.15rem 1.35rem; box-shadow: 0 4px 12px rgba(37,99,235,0.06);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div style="display: flex; align-items: center; gap: 0.75rem;">
            <span style="display: flex; align-items: center; justify-content: center; width: 40px; height: 40px; border-radius: 50%; background: #eff6ff; color: var(--centrly-blue-700); border: 1px solid #bfdbfe; flex-shrink: 0;">
              ${getIcon('gift', 20, 'var(--centrly-blue-700)')}
            </span>
            <div>
              <div style="font-weight: 800; font-size: 0.98rem; color: #0f172a; display: flex; align-items: center; gap: 0.4rem;">
                <span>لديك كود خصم أو بروموكود اشتراك؟</span>
                <span class="badge badge-blue" style="font-size: 0.7rem; padding: 0.15rem 0.5rem;">تخفيض فوري</span>
              </div>
              <div style="font-size: 0.8rem; color: #64748b; margin-top: 0.15rem;">
                أدخل الكود لتخفيض قيمة الاشتراك فوراً عند الدفع وتطبيق التخفيض على جميع الباقات.
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 0.5rem; min-width: 280px; flex: 1; max-width: 400px;">
            <input type="text" id="billingDiscountCodeInput" class="form-input" placeholder="اكتب كود الخصم هنا (مثال: CENTERLY)" style="text-transform: uppercase; font-weight: 800; font-family: monospace; font-size: 0.9rem;" autocomplete="off" value="${escapeHtml(window.centrlyApp?.appliedCouponCode || '')}">
            <button type="button" id="btnApplyBillingDiscount" class="btn btn-primary" onclick="window.centrlyApp.applyBillingCouponFromView()" style="font-weight: 800; font-size: 0.875rem; padding: 0.55rem 1.4rem; white-space: nowrap; cursor: pointer;">
              تطبيق الخصم
            </button>
          </div>
        </div>
        <div id="billingDiscountFeedback" style="${window.centrlyApp?.appliedCouponData ? 'display: block;' : 'display: none;'} margin-top: 0.75rem; font-size: 0.85rem; font-weight: 700; padding: 0.5rem 0.85rem; border-radius: 8px; background: #ecfdf5; color: #065f46; border: 1px solid #a7f3d0;">
          ${window.centrlyApp?.appliedCouponData ? `تم تفعيل كود الخصم (${escapeHtml(window.centrlyApp.appliedCouponCode)}): خصم بقيمة ${window.centrlyApp.appliedCouponData.discount_percent ? `${window.centrlyApp.appliedCouponData.discount_percent}%` : `${window.centrlyApp.appliedCouponData.discount_amount} ج.م`} على قيمة الاشتراك!` : ''}
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
