import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateDaysRemaining,
  BillingService,
} from "../dist/features/billing/index.js";

/**
 * In-Memory Fake Billing Repository
 */
class FakeBillingRepository {
  constructor(initialData = {}) {
    this.tenants = initialData.tenants || [];
    this.proofs = initialData.proofs || [];
    this.dispatchedKeys = new Set();
    this.reminderLogs = [];
  }

  async createPaymentProof(tenantId, userId, input) {
    const record = {
      id: `proof-${this.proofs.length + 1}`,
      tenant_id: tenantId,
      submitted_by: userId,
      amount: input.amount,
      payment_method: input.payment_method,
      reference_number: input.reference_number || null,
      proof_image_url: input.proof_image_url || null,
      admin_notes: input.notes || null,
      status: "pending",
      created_at: new Date().toISOString(),
    };
    this.proofs.push(record);
    return record;
  }

  async updateTenantSubscriptionStatus(tenantId, status) {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (tenant) {
      tenant.subscription_status = status;
    }
  }

  async getTenantBilling(tenantId) {
    return this.tenants.find((t) => t.id === tenantId) || null;
  }

  async getPaymentProofs(tenantId) {
    return this.proofs.filter((p) => p.tenant_id === tenantId);
  }

  async getActiveOrTrialTenants() {
    return this.tenants.filter((t) =>
      ["active", "trial", "past_due"].includes(t.subscription_status)
    );
  }

  async isReminderDispatched(idempotencyKey) {
    return this.dispatchedKeys.has(idempotencyKey);
  }

  async getTenantOwnerPhone() {
    return "01011112222";
  }

  async insertReminderLog(entry) {
    this.dispatchedKeys.add(entry.idempotency_key);
    this.reminderLogs.push(entry);
  }
}

// ========================================================
// DEV-66: Billing Service & Fake Repository Tests
// ========================================================

test("DEV-66: calculateDaysRemaining calculates accurate countdown", () => {
  const now = new Date("2026-09-01T12:00:00Z");

  // 3 days later
  const futureDate = "2026-09-04T12:00:00Z";
  assert.equal(calculateDaysRemaining("trial", futureDate, null, now), 3);

  // Past date
  const pastDate = "2026-08-30T12:00:00Z";
  assert.equal(calculateDaysRemaining("active", null, pastDate, now), 0);

  // Null date
  assert.equal(calculateDaysRemaining("active", null, null, now), 0);
});

test("DEV-66: BillingService.submitPaymentProof updates tenant status to pending_verification", async () => {
  const fakeRepo = new FakeBillingRepository({
    tenants: [{ id: "t1", name: "Omar Academy", subscription_status: "trial" }],
  });

  const service = new BillingService(fakeRepo);
  const proof = await service.submitPaymentProof("t1", "user-1", {
    amount: 500,
    payment_method: "instapay",
    reference_number: "INSTA-1234",
  });

  assert.equal(proof.amount, 500);
  assert.equal(proof.status, "pending");

  // Check tenant updated
  const tenant = await fakeRepo.getTenantBilling("t1");
  assert.equal(tenant.subscription_status, "pending_verification");
});

test("DEV-66: BillingService.getBillingStatus returns status and payment history", async () => {
  const fakeRepo = new FakeBillingRepository({
    tenants: [
      {
        id: "t1",
        name: "Omar Academy",
        subscription_status: "active",
        subscription_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
      },
    ],
    proofs: [
      { id: "p1", tenant_id: "t1", amount: 500, payment_method: "vodafone_cash", status: "approved" },
    ],
  });

  const service = new BillingService(fakeRepo);
  const status = await service.getBillingStatus("t1");

  assert.equal(status.subscription_status, "active");
  assert.equal(status.payment_proofs.length, 1);
  assert.ok(status.days_remaining > 0);
});

test("DEV-66: BillingService.evaluateAndDispatchReminders dispatches renewal reminders idempotently", async () => {
  const inFiveDays = new Date(Date.now() + 4.5 * 24 * 60 * 60 * 1000).toISOString();
  const fakeRepo = new FakeBillingRepository({
    tenants: [
      {
        id: "t1",
        name: "Expiring Teacher",
        subscription_status: "active",
        subscription_ends_at: inFiveDays,
      },
    ],
  });

  const service = new BillingService(fakeRepo);

  // First dispatch
  const result1 = await service.evaluateAndDispatchReminders();
  assert.equal(result1.reminders_dispatched, 1);
  assert.equal(fakeRepo.reminderLogs.length, 1);
  assert.equal(result1.results[0].status, "dispatched");

  // Second dispatch: idempotent skip!
  const result2 = await service.evaluateAndDispatchReminders();
  assert.equal(result2.reminders_dispatched, 0);
  assert.equal(result2.reminders_skipped_already_sent, 1);
});
