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

const catalog = [
 {id:'basic_v1',name:'Basic',rank:1,price_piasters:24900,reference_piasters:50000,students:100,storage_bytes:2e9,assistants:2,student_piasters:200,teaching_platform:false},
 {id:'pro_v1',name:'Pro',rank:2,price_piasters:79900,reference_piasters:160000,students:300,storage_bytes:15e9,assistants:4,student_piasters:150,initial_gift_piasters:10000,teaching_platform:true},
 {id:'max_v1',name:'Max',rank:3,price_piasters:99900,reference_piasters:200000,students:500,storage_bytes:30e9,assistants:8,student_piasters:100,initial_gift_piasters:15000,renewal_gift_piasters:10000,teaching_platform:true},
];
function billingFixture(isTrial=false,plan='pro_v1') {
 const selected=catalog.find(p=>p.id===plan);
 return {commercial:{catalog,limits:{...selected,plan_id:plan,is_trial:isTrial,active:true,period_end:new Date(Date.now()+7*86400000).toISOString(),recurring_piasters:selected.price_piasters},students_used:50,assistants_used:1,storage_bytes_used:1e9,addons:[],orders:[],ledger:[]}};
}
test('BILLING-TRIAL: seven-day trial never claims a paid plan is current or active',()=>{
 const html=renderBillingView(billingFixture(true));
 assert.ok(html.includes('تجربة مجانية ٧ أيام'));
 assert.ok(!html.includes('باقتك الحالية'));
 assert.ok(!html.includes('مفعّلة الآن'));
 assert.ok(!html.includes('تجديد الاشتراك'));
 assert.ok(html.includes("commercialPlan('basic_v1')"));
 assert.ok(html.includes('اختيار الباقة'));
});
test('BILLING-ACTIVE: paid plan alone is current and can be renewed',()=>{
 for(const plan of catalog){
  const html=renderBillingView(billingFixture(false,plan.id));
  assert.equal((html.match(/باقتك الحالية/g)||[]).length,1);
  assert.ok(html.includes('مفعّلة الآن'));
  assert.equal((html.match(/تجديد الاشتراك/g)||[]).length,1);
 }
});
test('BILLING: loading never renders obsolete plan prices or invented usage',()=>{
 const html=renderBillingView({});
 assert.ok(html.includes('جار قراءة الباقات'));
 assert.ok(!html.includes('750'));
 assert.ok(!html.includes('999'));
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

