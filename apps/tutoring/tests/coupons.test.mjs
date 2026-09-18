import test from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "../dist/features/billing/service.js";

class FakeBillingRepository {
  constructor() {
    this.codes = [
      {
        id: "code-1",
        code: "CENTR50",
        discount_percent: 50,
        discount_amount: null,
        max_uses: 1000,
        times_used: 10,
        is_active: true,
        expires_at: null,
        created_at: new Date().toISOString(),
      },
    ];
  }

  async getGiftCode(code) {
    const clean = (code || "").trim().toUpperCase();
    return this.codes.find((c) => c.code === clean && c.is_active) || null;
  }

  async listGiftCodes() {
    return [...this.codes];
  }

  async createGiftCode(input) {
    const newCode = {
      id: `code-${Date.now()}`,
      code: input.code.trim().toUpperCase(),
      discount_percent: input.discount_percent ?? null,
      discount_amount: input.discount_amount ?? null,
      max_uses: input.max_uses ?? 1000,
      times_used: 0,
      is_active: input.is_active !== undefined ? input.is_active : true,
      expires_at: input.expires_at ?? null,
      created_at: new Date().toISOString(),
    };
    this.codes.unshift(newCode);
    return newCode;
  }

  async updateGiftCode(id, updates) {
    const item = this.codes.find((c) => c.id === id);
    if (!item) throw new Error("Code not found");
    if (updates.is_active !== undefined) item.is_active = updates.is_active;
    if (updates.max_uses !== undefined) item.max_uses = updates.max_uses;
    if (updates.expires_at !== undefined) item.expires_at = updates.expires_at;
    return { ...item };
  }

  async deleteGiftCode(id) {
    this.codes = this.codes.filter((c) => c.id !== id);
  }
}

test("DEV-COUPONS: createGiftCode creates percentage and fixed amount promo codes", async () => {
  const repo = new FakeBillingRepository();
  const service = new BillingService(repo);

  // 1. Percentage coupon
  const percentCode = await service.createGiftCode({
    code: "SUMMER30",
    discount_percent: 30,
    max_uses: 50,
  });
  assert.equal(percentCode.code, "SUMMER30");
  assert.equal(percentCode.discount_percent, 30);
  assert.equal(percentCode.discount_amount, null);
  assert.equal(percentCode.max_uses, 50);
  assert.equal(percentCode.is_active, true);

  // 2. Fixed amount coupon
  const fixedCode = await service.createGiftCode({
    code: "SAVE100",
    discount_amount: 100,
    max_uses: 100,
  });
  assert.equal(fixedCode.code, "SAVE100");
  assert.equal(fixedCode.discount_percent, null);
  assert.equal(fixedCode.discount_amount, 100);

  // 3. Rejects invalid code without percent or amount
  await assert.rejects(
    () => service.createGiftCode({ code: "INVALID" }),
    /يرجى تحديد نسبة الخصم/
  );

  // 4. Rejects percentage out of range
  await assert.rejects(
    () => service.createGiftCode({ code: "TOO_HIGH", discount_percent: 150 }),
    /بين 1% و 100%/
  );
});

test("DEV-COUPONS: validateCoupon accurately computes discounts for created codes", async () => {
  const repo = new FakeBillingRepository();
  const service = new BillingService(repo);

  await service.createGiftCode({
    code: "PHYSICS25",
    discount_percent: 25,
  });

  await service.createGiftCode({
    code: "CASH50",
    discount_amount: 50,
  });

  // Validate percentage discount on 400 EGP: 25% of 400 = 100 EGP discount, final 300 EGP
  const resPercent = await service.validateCoupon("PHYSICS25", 400);
  assert.equal(resPercent.valid, true);
  assert.equal(resPercent.discount_amount, 100);
  assert.equal(resPercent.final_amount, 300);

  // Validate fixed discount on 400 EGP: 50 EGP discount, final 350 EGP
  const resFixed = await service.validateCoupon("cash50", 400);
  assert.equal(resFixed.valid, true);
  assert.equal(resFixed.discount_amount, 50);
  assert.equal(resFixed.final_amount, 350);
});

test("DEV-COUPONS: list, toggle, and delete lifecycle of promo codes", async () => {
  const repo = new FakeBillingRepository();
  const service = new BillingService(repo);

  const created = await service.createGiftCode({
    code: "DELETEME",
    discount_percent: 10,
  });

  const listBefore = await service.listGiftCodes();
  assert.ok(listBefore.some((c) => c.code === "DELETEME"));

  // Deactivate
  const deactivated = await service.updateGiftCode(created.id, { is_active: false });
  assert.equal(deactivated.is_active, false);

  // Trying to validate deactivated coupon should throw
  await assert.rejects(
    () => service.validateCoupon("DELETEME", 100),
    /غير صحيح أو غير مفعل/
  );

  // Delete
  await service.deleteGiftCode(created.id);
  const listAfter = await service.listGiftCodes();
  assert.ok(!listAfter.some((c) => c.code === "DELETEME"));
});
