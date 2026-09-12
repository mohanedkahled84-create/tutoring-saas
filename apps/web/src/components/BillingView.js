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
  const daysRemaining = typeof data.days_remaining === 'number' ? data.days_remaining : 14;

  const currentStudents = data.students_count || (window.centrlyApp?.students?.length || 0);
  const studentLimit = data.students_limit || 100;
  const quotaPercent = Math.min(100, Math.round((currentStudents / studentLimit) * 100));

  const isYearly = (window.centrlyApp?.billingCycle === 'yearly');

  // Plan pricing configurations (All features included in all plans)
  const plans = [
    {
      id: 'plan_100',
      name: 'باقة 100 طالب',
      subtitle: 'للبدايات والمجموعات التأسيسية',
      capacity: 100,
      monthlyPrice: 599,
      yearlyPrice: 6469, // 599 * 12 * 0.9 = 6469.2
      yearlyMonthlyEquivalent: 539,
      yearlySavings: 719,
      isPopular: false,
      badgeText: 'للبدايات والمجموعات',
    },
    {
      id: 'plan_250',
      name: 'باقة 250 طالب',
      subtitle: 'مثالية للمعلم النشط والمجموعات الكبيرة',
      capacity: 250,
      monthlyPrice: 899,
      yearlyPrice: 9709, // 899 * 12 * 0.9 = 9709.2
      yearlyMonthlyEquivalent: 809,
      yearlySavings: 1079,
      isPopular: true,
      badgeText: '⭐ الأكثر طلباً للمعلمين',
    },
    {
      id: 'plan_500',
      name: 'باقة 500 طالب',
      subtitle: 'للسناتر وكبار المدرسين والمجاميع الضخمة',
      capacity: 500,
      monthlyPrice: 1499,
      yearlyPrice: 16189, // 1499 * 12 * 0.9 = 16189.2
      yearlyMonthlyEquivalent: 1349,
      yearlySavings: 1799,
      isPopular: false,
      badgeText: 'للسناتر وكبار المدرسين',
    }
  ];

  const commonFeatures = [
    'تسجيل الحضور بالباركود السريع المستمر بالكاميرا والماسح',
    'رسائل واتساب فورية لأولياء الأمور بنظام Pacing الآمن (ضد الحظر)',
    'كروت الطلاب الذكية (طباعة PDF + تصدير لكانفا وفوتوشوب)',
    'رصد درجات الكويزات وتوزيع النتائج للطلاب وأولياء الأمور بنقرة زر',
    'بوابة متابعة ولي الأمر التفاعلية لحظة بلحظة (بدون أي تطبيق)',
    'إدارة القاعات والمساعدين ومنع تضارب الحصص للسنتر',
    'كشوف الحضور والغياب الشهرية وتقارير المتفوقين وقائمة المتابعة',
    'دعم فني مصري مباشر وسريع عبر الواتساب على مدار الساعة'
  ];

  let statusBadgeHtml = '';
  if (status === 'active') {
    statusBadgeHtml = `<span class="badge" style="background: #10b981; color: #fff; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 9999px;">
      ${getIcon('dotSuccess', 8)} <span>اشتراك مفعّل وسارٍ</span>
    </span>`;
  } else if (status === 'trial') {
    statusBadgeHtml = `<span class="badge" style="background: #0284c7; color: #fff; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 9999px;">
      ${getIcon('dotSuccess', 8)} <span>فترة تجريبية مجانية</span>
    </span>`;
  } else if (status === 'pending_verification') {
    statusBadgeHtml = `<span class="badge" style="background: #f59e0b; color: #182349; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 9999px;">
      ${getIcon('refresh', 12)} <span>قيد مراجعة التحويل</span>
    </span>`;
  } else {
    statusBadgeHtml = `<span class="badge" style="background: #ef4444; color: #fff; font-weight: 700; display: inline-flex; align-items: center; gap: 0.35rem; padding: 0.3rem 0.75rem; border-radius: 9999px;">
      ${getIcon('risk', 12)} <span>اشتراك منتهي</span>
    </span>`;
  }

  const teacherName = user?.name || window.centrlyApp?.user?.name || 'الأستاذ محمد خالد';

  return `
    <div style="display: flex; flex-direction: column; gap: 1.75rem; font-family: 'Cairo', sans-serif;" dir="rtl">
      
      <!-- Current Subscription Status Card -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, #0f172a 0%, #1e3a8a 100%); color: #fff; border: none; border-radius: 16px; padding: 1.75rem; box-shadow: 0 10px 25px -5px rgba(15, 23, 42, 0.25);">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1.25rem;">
          
          <div style="flex: 1; min-width: 280px;">
            <div style="display: flex; align-items: center; gap: 0.6rem; margin-bottom: 0.5rem; flex-wrap: wrap;">
              ${statusBadgeHtml}
              <span style="font-size: 0.85rem; color: #93c5fd; font-weight: 700;">
                ${data.plan_name || 'باقة 100 طالب (شاملة كافة الميزات)'}
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
            <button class="btn" style="background: linear-gradient(135deg, #f59e0b, #d97706); color: #0f172a; font-weight: 800; font-size: 0.95rem; border: none; padding: 0.75rem 1.5rem; border-radius: 10px; box-shadow: 0 4px 15px rgba(245, 158, 11, 0.4); cursor: pointer;" onclick="window.centrlyApp.openPaymentProofModal('باقة 100 طالب', ${isYearly ? 6469 : 599}, '${isYearly ? 'yearly' : 'monthly'}')">
              تجديد / ترقية الاشتراك الآن 💳
            </button>
          </div>

        </div>
      </div>

      <!-- Billing Cycle Switch Toggle (Monthly vs Annual with 10% Discount) -->
      <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.75rem; margin-top: 0.5rem;">
        
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
            📅 اشتراك شهري
          </button>
          
          <button type="button" 
            onclick="window.centrlyApp.setBillingCycle('yearly')" 
            style="font-family: 'Cairo', sans-serif; font-size: 0.925rem; font-weight: 800; padding: 0.55rem 1.4rem; border-radius: 8px; border: none; cursor: pointer; transition: all 0.2s ease; display: inline-flex; align-items: center; gap: 0.4rem; ${isYearly ? 'background: var(--centrly-blue-700); color: #ffffff; box-shadow: 0 2px 8px rgba(37,99,235,0.25);' : 'background: transparent; color: #64748b;'}">
            <span>⭐ اشتراك سنوي</span>
            <span style="background: #10b981; color: #fff; font-size: 0.725rem; padding: 0.15rem 0.45rem; border-radius: 9999px; font-weight: 900;">خصم 10% 🎉</span>
          </button>
        </div>

      </div>

      <!-- Pricing Plans Comparison Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem; align-items: stretch;">
        ${plans.map(plan => {
          const price = isYearly ? plan.yearlyPrice : plan.monthlyPrice;
          const displayPeriod = isYearly ? 'ج.م / سنوياً' : 'ج.م / شهرياً';
          const buttonAmount = price;
          const fullPlanName = `${plan.name} (${isYearly ? 'سنوي' : 'شهري'})`;

          return `
            <div class="card" style="margin: 0; display: flex; flex-direction: column; justify-content: space-between; border-radius: 16px; position: relative; transition: transform 0.2s, box-shadow 0.2s; ${plan.isPopular ? 'border: 2.5px solid var(--centrly-blue-700); box-shadow: 0 12px 30px rgba(37,99,235,0.12);' : 'border: 1.5px solid var(--centrly-line);'}">
              
              ${plan.isPopular ? `
                <div style="position: absolute; top: -14px; left: 50%; transform: translateX(-50%); background: linear-gradient(135deg, var(--centrly-blue-700), var(--centrly-blue-900)); color: #fff; padding: 0.25rem 1rem; border-radius: 9999px; font-size: 0.775rem; font-weight: 800; box-shadow: 0 2px 8px rgba(37,99,235,0.3);">
                  ${plan.badgeText}
                </div>
              ` : ''}

              <div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-top: ${plan.isPopular ? '0.5rem' : '0'};">
                  <h3 style="font-size: 1.25rem; font-weight: 900; color: var(--centrly-ink); margin: 0;">
                    ${plan.name}
                  </h3>
                  ${!plan.isPopular ? `<span style="background: #f1f5f9; color: #475569; font-size: 0.75rem; font-weight: 800; padding: 0.2rem 0.5rem; border-radius: 6px;">${plan.badgeText}</span>` : ''}
                </div>
                
                <p style="font-size: 0.825rem; color: var(--centrly-text); margin: 0.4rem 0 1rem; line-height: 1.5;">
                  ${plan.subtitle}
                </p>

                <!-- Pricing Display -->
                <div style="margin: 1.25rem 0 0.75rem;">
                  <div style="display: flex; align-items: baseline; gap: 0.4rem;">
                    <span style="font-size: 2.5rem; font-weight: 900; color: ${plan.isPopular ? 'var(--centrly-blue-800)' : 'var(--centrly-ink)'};">
                      ${Number(price).toLocaleString('ar-EG')}
                    </span>
                    <span style="font-size: 0.95rem; font-weight: 700; color: var(--centrly-text);">
                      ${displayPeriod}
                    </span>
                  </div>

                  ${isYearly ? `
                    <div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.25rem;">
                      <span style="font-size: 0.8rem; color: #16a34a; font-weight: 800; background: #ecfdf5; padding: 0.15rem 0.5rem; border-radius: 6px; border: 1px solid #bbf7d0;">
                        وفر ${Number(plan.yearlySavings).toLocaleString('ar-EG')} ج.م سنوياً
                      </span>
                      <span style="font-size: 0.75rem; color: #64748b;">
                        (~${Number(plan.yearlyMonthlyEquivalent).toLocaleString('ar-EG')} ج.م/شهر)
                      </span>
                    </div>
                  ` : ''}
                </div>

                <!-- Capacity Badge -->
                <div style="background: ${plan.isPopular ? '#eff6ff' : '#f8fafc'}; border: 1px solid ${plan.isPopular ? '#bfdbfe' : '#e2e8f0'}; color: ${plan.isPopular ? '#1e3a8a' : '#334155'}; font-size: 0.875rem; font-weight: 800; padding: 0.55rem 0.75rem; border-radius: 8px; text-align: center; margin: 1rem 0 1.25rem;">
                  👥 سعة الطلاب: حتى ${plan.capacity} طالباً
                </div>

                <div style="font-size: 0.8rem; font-weight: 800; color: #10b981; margin-bottom: 0.75rem;">
                  🎁 تشمل جميع ميزات المنظومة بالكامل:
                </div>

                <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; display: flex; flex-direction: column; gap: 0.55rem; font-size: 0.85rem; color: #334155;">
                  ${commonFeatures.map(feat => `
                    <li style="display: flex; align-items: flex-start; gap: 0.5rem; line-height: 1.5;">
                      <span style="color: #10b981; flex-shrink: 0; margin-top: 2px;">${getIcon('check', 14)}</span>
                      <span>${feat}</span>
                    </li>
                  `).join('')}
                </ul>
              </div>

              <div>
                <button class="btn ${plan.isPopular ? 'btn-primary' : 'btn-secondary'}" 
                  style="width: 100%; font-weight: 800; padding: 0.75rem; border-radius: 10px; font-size: 0.95rem; ${plan.isPopular ? 'background: linear-gradient(135deg, #2563eb, #1d4ed8); border: none; box-shadow: 0 4px 12px rgba(37,99,235,0.25);' : ''}" 
                  onclick="window.centrlyApp.openPaymentProofModal('${fullPlanName}', ${buttonAmount}, '${isYearly ? 'yearly' : 'monthly'}')">
                  اشترك في ${plan.name} (${isYearly ? 'سنوياً' : 'شهرياً'})
                </button>
              </div>

            </div>
          `;
        }).join('')}
      </div>

      <!-- Custom Enterprise Tier for >500 Students -->
      <div style="background: #f8fafc; border: 1.5px dashed #cbd5e1; border-radius: 14px; padding: 1.5rem; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 1.25rem;">
        <div style="flex: 1; min-width: 260px;">
          <h4 style="font-size: 1.05rem; font-weight: 800; color: var(--centrly-ink); margin: 0 0 0.35rem;">
            لديك أكثر من 500 طالب أو عدة فروع لسنترك؟
          </h4>
          <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0; line-height: 1.6;">
            نوفر باقات مخصصة للأعداد الكبرى والسناتر التعليمية مع تخصيص السيرفرات وإمكانية ربط فروع متعددة ونسب أرباح السنتر وخصومات سنوية مميزة.
          </p>
        </div>
        <div>
          <button class="btn btn-secondary" onclick="window.centrlyApp.openPaymentProofModal('باقة مخصصة للسناتر (+500 طالب)', 2499, '${isYearly ? 'yearly' : 'monthly'}')" style="font-weight: 800; padding: 0.65rem 1.25rem; font-size: 0.9rem;">
            طلب تسعير سنتر مخصص 💬
          </button>
        </div>
      </div>

      <!-- Payment Methods & Transfer Details -->
      <div class="card" style="margin: 0; background: #ffffff; border: 1px solid var(--centrly-line); border-radius: 14px;">
        <h3 style="font-size: 1.05rem; font-weight: 800; margin: 0 0 0.85rem; color: var(--centrly-ink); display: flex; align-items: center; gap: 0.5rem;">
          ${getIcon('billing', 20, 'var(--centrly-blue-700)')}
          <span>طرق الدفع والتحويل المعتمدة في مصر</span>
        </h3>
        
        <p style="font-size: 0.85rem; color: var(--centrly-text); margin: 0 0 1rem;">
          قم بالتحويل عبر إحدى الوسائل التالية، ثم اضغط على زر <strong>(اشترك الآن)</strong> في باقتك وأدخل رقم العملية أو المحفظة لتفعيل حسابك فوراً:
        </p>

        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 1rem;">
          
          <!-- Vodafone Cash -->
          <div style="background: #fff1f2; border: 1.5px solid #fecdd3; padding: 1rem 1.25rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 800; color: #be123c; font-size: 0.95rem; margin-bottom: 0.25rem;">
                فودافون كاش ومحافظ المحمول
              </div>
              <div style="font-family: monospace; font-size: 1.2rem; font-weight: 900; color: #0f172a; direction: ltr; display: inline-block;">
                01099887766
              </div>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
                تحويل مباشر من محفظتك الإلكترونية
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('01099887766'); window.centrlyApp.showToast('تم نسخ رقم فودافون كاش', 'success');" style="font-weight: 800; font-size: 0.8rem;">
              نسخ الرقم
            </button>
          </div>

          <!-- InstaPay -->
          <div style="background: #f0f9ff; border: 1.5px solid #bae6fd; padding: 1rem 1.25rem; border-radius: 12px; display: flex; justify-content: space-between; align-items: center;">
            <div>
              <div style="font-weight: 800; color: #0369a1; font-size: 0.95rem; margin-bottom: 0.25rem;">
                إنستاباي (InstaPay)
              </div>
              <div style="font-family: monospace; font-size: 1.15rem; font-weight: 900; color: #0f172a; direction: ltr; display: inline-block;">
                centrly@instapay
              </div>
              <div style="font-size: 0.75rem; color: #64748b; margin-top: 0.25rem;">
                تحويل لحظي فوري بدون أي مصاريف
              </div>
            </div>
            <button class="btn btn-secondary btn-sm" onclick="navigator.clipboard.writeText('centrly@instapay'); window.centrlyApp.showToast('تم نسخ عنوان إنستاباي', 'success');" style="font-weight: 800; font-size: 0.8rem;">
              نسخ المعرّف
            </button>
          </div>

        </div>
      </div>

    </div>
  `;
}
