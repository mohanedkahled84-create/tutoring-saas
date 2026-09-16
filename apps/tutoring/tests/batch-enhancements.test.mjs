import { test } from "node:test";
import assert from "node:assert/strict";
import { BillingService } from "../dist/features/billing/service.js";
import { calculateStudentSummary, rankStudents } from "../dist/features/reports/calculation.js";
import { createGroupSchema, updateGroupSchema } from "../dist/shared/middleware/validation.js";

test("COUPON: validateCoupon calculates correct discount for percentage and fixed amount", async () => {
  const fakeRepo = {
    async createPaymentProof() { return {}; },
    async updateTenantSubscriptionStatus() {},
    async getTenantBilling() { return null; },
    async getPaymentProofs() { return []; },
    async getActiveOrTrialTenants() { return []; },
    async isReminderDispatched() { return false; },
    async getTenantOwnerPhone() { return null; },
  };

  const service = new BillingService(fakeRepo);

  // 1. 50% discount coupon
  const res50 = await service.validateCoupon("CENTR50", 1000);
  assert.equal(res50.valid, true);
  assert.equal(res50.discount_amount, 500);
  assert.equal(res50.final_amount, 500);

  // 2. Fixed amount discount coupon
  const resFixed = await service.validateCoupon("WELCOME100", 600);
  assert.equal(resFixed.valid, true);
  assert.equal(resFixed.discount_amount, 100);
  assert.equal(resFixed.final_amount, 500);

  // 3. Invalid coupon
  await assert.rejects(async () => {
    await service.validateCoupon("NONEXISTENT", 500);
  }, /كود الخصم غير صحيح/);
});

test("RANKING: Students who took quizzes strictly rank above students who took 0 quizzes", () => {
  const studentWithQuizzes = calculateStudentSummary({
    student: { id: "s1", name: "Ahmed Exam", code: "STU-1", parent_phone: "01011111111" },
    attendances: [{ attended: true }],
    grades: [{ score: 5, max_score: 10 }], // 50%
  });

  const studentNoQuizzes = calculateStudentSummary({
    student: { id: "s2", name: "Omar Untested", code: "STU-2", parent_phone: "01022222222" },
    attendances: [{ attended: true }],
    grades: [], // 0 quizzes
  });

  assert.equal(studentWithQuizzes.total_quizzes, 1);
  assert.equal(studentNoQuizzes.total_quizzes, 0);

  const ranked = rankStudents([studentNoQuizzes, studentWithQuizzes]);
  // Ahmed Exam (who took exam) MUST rank #1, above Omar Untested (who took 0 quizzes)
  assert.equal(ranked[0].student_id, "s1");
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].student_id, "s2");
  assert.equal(ranked[1].rank, 2);
});

test("GROUPS: updateGroupSchema does not inject default 0 when price is omitted", () => {
  const updatePayload = { name: "مجموعة الثانوي" };
  const parsed = updateGroupSchema.parse(updatePayload);
  assert.equal(parsed.name, "مجموعة الثانوي");
  assert.equal(parsed.price, undefined);
  assert.equal(parsed.session_price, undefined);

  // Creation schema defaults sessions_per_week to 1
  const createPayload = { name: "مجموعة جديدة" };
  const parsedCreate = createGroupSchema.parse(createPayload);
  assert.equal(parsedCreate.sessions_per_week, 1);
});
