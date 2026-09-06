/**
 * Centrly Billing & Subscription Plans Component (DEV-SL.3 & DEV-39)
 */

export function renderBillingView(data = {}) {
  const status = data.status || 'trial';
  const trialEnds = data.trial_ends_at || '19 سبتمبر 2026';

  return `
    <div style="display: flex; flex-direction: column; gap: 1.5rem;" dir="rtl">
      
      <!-- Current Subscription Status -->
      <div class="card" style="margin: 0; background: linear-gradient(135deg, var(--centrly-blue-900), var(--centrly-blue-700)); color: #fff; border: none;">
        <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem;">
          <div>
            <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 0.25rem;">
              <span class="badge" style="background: #10b981; color: #fff; font-weight: 700;">🟢 اشتراك ساري (فترة تجريبية)</span>
              <span style="font-size: 0.8rem; color: #93c5fd;">باقة المعلم الكاملة</span>
            </div>
            <h2 style="font-size: 1.35rem; font-weight: 900; margin: 0; color: #fff;">
              حساب الأستاذ محمد خالد التعليمي
            </h2>
            <p style="font-size: 0.85rem; color: #e2e8f0; margin-top: 0.35rem;">
              فترتك التجريبية المجانية تنتهي بتاريخ: <strong>${trialEnds}</strong> (متبقي 14 يوماً للاستفادة الكاملة من كافة المميزات).
            </p>
          </div>

          <button class="btn" style="background: #f59e0b; color: #182349; font-weight: 800; border: none; box-shadow: 0 4px 12px rgba(245,158,11,0.4);" onclick="window.centrlyApp.openPaymentProofModal()">
            ⚡ تجديد / ترقية الاشتراك الآن
          </button>
        </div>
      </div>

      <!-- Plans Comparison Grid -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 1.5rem;">
        
        <!-- Plan 1: Teacher Solo -->
        <div class="card" style="margin: 0; border: 2px solid var(--centrly-blue-700); position: relative;">
          <div style="position: absolute; top: -12px; left: 20px; background: var(--centrly-blue-700); color: #fff; padding: 0.15rem 0.6rem; border-radius: 20px; font-size: 0.75rem; font-weight: 800;">
            الباقة الأكثر طلباً
          </div>
          <h3 style="margin-top: 0.5rem; font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink);">باقة المعلم المحترف</h3>
          <div style="font-size: 2rem; font-weight: 900; color: var(--centrly-blue-800); margin: 0.5rem 0;">
            199 <span style="font-size: 0.9rem; font-weight: 600; color: var(--centrly-text);">ج.م / شهرياً</span>
          </div>
          <p style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 1rem;">
            مثالية للمدرس الذي يدير مجاميعه الخاصة في سناتر متعددة أو قاعته الخاصة.
          </p>

          <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>عدد طلاب ومجاميع غير محدود</strong></li>
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>مسح الباركود السريع وطباعة كروت A4</strong></li>
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>1,200 رسالة واتساب شهرياً لأولياء الأمور</strong></li>
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>حساب خاص للمساعد لرصد الغياب والواجب</strong></li>
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>تقارير المتفوقين وكشوف الحضور الشهرية</strong></li>
          </ul>

          <button class="btn btn-primary" style="width: 100%; font-weight: 800;" onclick="window.centrlyApp.openPaymentProofModal('باقة المعلم المحترف', 199)">
            اشتراك في باقة المعلم
          </button>
        </div>

        <!-- Plan 2: Center Pro -->
        <div class="card" style="margin: 0; border: 1px solid var(--centrly-line);">
          <h3 style="margin-top: 0.5rem; font-size: 1.2rem; font-weight: 800; color: var(--centrly-ink);">باقة السنتر والمنظومة الكبرى</h3>
          <div style="font-size: 2rem; font-weight: 900; color: var(--centrly-ink); margin: 0.5rem 0;">
            499 <span style="font-size: 0.9rem; font-weight: 600; color: var(--centrly-text);">ج.م / شهرياً</span>
          </div>
          <p style="font-size: 0.825rem; color: var(--centrly-text); margin-bottom: 1rem;">
            لإدارات السناتر والقاعات التعليمية والمجاميع الكبرى (أكثر من مدرس).
          </p>

          <ul style="list-style: none; padding: 0; margin: 0 0 1.5rem 0; display: flex; flex-direction: column; gap: 0.5rem; font-size: 0.85rem;">
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>كل مميزات باقة المعلم</strong></li>
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>إدارة القاعات ومنع تضارب الحصص</strong></li>
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>حسابات متعددة للمدرسين والمساعدين</strong></li>
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>نظام حسابات ونسب السنتر وتصفية الأرباح</strong></li>
            <li style="display: flex; align-items: center; gap: 0.5rem;">✓ <strong>رسائل واتساب غير محدودة بنظام Pacing الآمن</strong></li>
          </ul>

          <button class="btn btn-secondary" style="width: 100%; font-weight: 700;" onclick="window.centrlyApp.openPaymentProofModal('باقة السنتر', 499)">
            اشتراك في باقة السنتر
          </button>
        </div>

      </div>

      <!-- Payment Methods & Instructions -->
      <div class="card" style="margin: 0; background: #fafbfc;">
        <h3 style="font-size: 1rem; font-weight: 800; margin-top: 0; color: var(--centrly-ink);">
          💳 طرق الدفع المتاحة داخل مصر
        </h3>
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 1rem; margin-top: 0.75rem;">
          <div style="background: #fff; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--centrly-line);">
            <div style="font-weight: 800; color: #e11d48; font-size: 0.95rem;">فودافون كاش / محافظ إلكترونية</div>
            <div style="font-family: monospace; font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin-top: 0.25rem;">01099887766</div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">تحويل فوري ثم إرسال سكرين شوت</div>
          </div>
          <div style="background: #fff; padding: 0.75rem 1rem; border-radius: 8px; border: 1px solid var(--centrly-line);">
            <div style="font-weight: 800; color: #0284c7; font-size: 0.95rem;">إنستاباي (InstaPay)</div>
            <div style="font-family: monospace; font-size: 1.1rem; font-weight: 700; color: var(--centrly-ink); margin-top: 0.25rem;">centrly@instapay</div>
            <div style="font-size: 0.75rem; color: var(--centrly-text); margin-top: 0.25rem;">بدون أي مصاريف تحويل</div>
          </div>
        </div>
      </div>

    </div>
  `;
}
