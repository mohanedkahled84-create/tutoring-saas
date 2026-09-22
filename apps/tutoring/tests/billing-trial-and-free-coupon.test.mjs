import test from "node:test";
import assert from "node:assert/strict";

// Mock global window object for Node environment
globalThis.window = { centrlyApp: { billingCycle: "monthly" } };

import { renderBillingView } from "../../web/src/components/BillingView.js";
import { z } from "zod";

const paymentProofSchema = z.object({
  amount: z.number().min(0, "Amount must be a non-negative number"),
  payment_method: z.enum(["instapay", "vodafone_cash", "bank_transfer", "cash", "coupon", "other"]),
  reference_number: z.string().max(100).optional().nullable(),
  proof_image_url: z.string().optional().nullable(),
  notes: z.string().max(1000).optional().nullable(),
  coupon_code: z.string().max(50).optional().nullable(),
});

test("BILLING-TRIAL: Trial status does NOT mark any paid plan as 'باقتك الحالية' or 'مفعّلة الآن'", () => {
  const trialData = {
    subscription_status: "trial",
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    students_count: 50,
    students_limit: 750, // default limit on trial
    days_remaining: 14,
  };

  const html = renderBillingView(trialData, { name: "مستر أحمد" });

  // 1. Must NOT contain "باقتك الحالية"
  assert.ok(
    !html.includes("باقتك الحالية"),
    "Trial user must NOT see 'باقتك الحالية' on any plan card"
  );

  // 2. Must NOT contain "مفعّلة الآن"
  assert.ok(
    !html.includes("مفعّلة الآن"),
    "Trial user must NOT see 'مفعّلة الآن' on any plan card"
  );

  // 3. Must show "فترة تجريبية مجانية (كافة ميزات المنصة متاحة)"
  assert.ok(
    html.includes("فترة تجريبية مجانية (كافة ميزات المنصة متاحة)"),
    "Top card must indicate trial without binding to a specific plan"
  );

  // 4. Middle plan (750) must display popular badge: "الأكثر طلباً للمعلمين"
  assert.ok(
    html.includes("الأكثر طلباً للمعلمين"),
    "750 plan must show 'الأكثر طلباً للمعلمين' instead of 'باقتك الحالية'"
  );

  // 5. Button text should be "اشترك في باقة 750 طالب" not "تجديد باقتي الحالية"
  assert.ok(
    html.includes("اشترك في باقة 750 طالب"),
    "Button text for 750 plan must invite subscription, not renewal"
  );
  assert.ok(
    !html.includes("تجديد باقتي الحالية (باقة 750 طالب)"),
    "Must not say 'تجديد باقتي الحالية' for trial user"
  );
});

test("BILLING-ACTIVE: Active paid plan displays 'باقتك الحالية' and 'مفعّلة الآن' accurately", () => {
  const activeData = {
    subscription_status: "active",
    subscription_ends_at: new Date(Date.now() + 25 * 24 * 60 * 60 * 1000).toISOString(),
    students_count: 120,
    students_limit: 750,
    days_remaining: 25,
    plan_name: "باقة 750 طالب",
  };

  const html = renderBillingView(activeData, { name: "مستر محمد" });

  // 1. Must contain "باقتك الحالية"
  assert.ok(
    html.includes("باقتك الحالية"),
    "Active user on 750 plan must see 'باقتك الحالية'"
  );

  // 2. Must contain "مفعّلة الآن"
  assert.ok(
    html.includes("مفعّلة الآن"),
    "Active user on 750 plan must see 'مفعّلة الآن'"
  );

  // 3. Must contain renewal button
  assert.ok(
    html.includes("تجديد باقتي الحالية (باقة 750 طالب)"),
    "Must offer renewal for current plan"
  );
});

test("PAYMENT-PROOF-SCHEMA: Validates 0 amount for 100% coupon without requiring image proof", () => {
  const freeProof = {
    amount: 0,
    payment_method: "coupon",
    reference_number: "CEN100",
    proof_image_url: null,
    notes: "[باقة 300 طالب - اشتراك شهري] [كود خصم: CEN100]",
    coupon_code: "CEN100",
  };

  const parsed = paymentProofSchema.safeParse(freeProof);
  assert.ok(parsed.success, "Schema must accept amount 0 with coupon payment method");
  assert.equal(parsed.data.amount, 0);
  assert.equal(parsed.data.payment_method, "coupon");
  assert.equal(parsed.data.proof_image_url, null);
});

test("BILLING-VIEW: Promo code input is removed from above the pricing plans in BillingView", () => {
  const trialData = {
    subscription_status: "trial",
    trial_ends_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString(),
    students_count: 50,
    students_limit: 750,
    days_remaining: 14,
  };
  const html = renderBillingView(trialData, { name: "مستر أحمد" });
  assert.ok(!html.includes("billingDiscountCodeInput"), "Voucher box must not be rendered above plans in BillingView");
  assert.ok(!html.includes("btnApplyBillingDiscount"), "Apply discount button must not be rendered above plans");
});

test("ADMIN-PROOFS-VIEW: Renders coupon badge, discount details, and 0 amount for 100% coupon", async () => {
  const { renderAdminPaymentProofsView } = await import("../../web/src/components/AdminPaymentProofsView.js");
  const data = {
    payment_proofs: [
      {
        id: "proof-100",
        tenant_id: "tenant-1",
        tenant_name: "مستر عمر المحمدي - منظومة تعليمية",
        amount: 0,
        payment_method: "coupon",
        reference_number: "CEN100",
        admin_notes: "[باقة 300 طالب (شهري) - اشتراك شهري] [كود خصم: CEN100 (خصم 100%)] [المبلغ الأصلي: 499 ج.م]",
        status: "approved",
        created_at: new Date().toISOString(),
      }
    ]
  };

  const html = renderAdminPaymentProofsView(data, "all");
  assert.ok(html.includes("كود الخصم"), "Card must display coupon badge");
  assert.ok(html.includes("CEN100"), "Card must display the coupon code CEN100");
  assert.ok(html.includes("خصم 100% (مجاني)"), "Card must display 100% discount badge");
  assert.ok(html.includes("٠ ج.م") || html.includes("0 ج.م"), "Card must display 0 EGP for net amount");
  assert.ok(html.includes("مجاني بالكامل"), "Card must display celebration free badge");
});

