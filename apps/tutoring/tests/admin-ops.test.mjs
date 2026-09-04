import test from "node:test";
import assert from "node:assert/strict";
import {
  AdminOpsService,
  FakeAdminOpsRepository,
  formatNewSignupMessage,
} from "../dist/features/admin-ops/index.js";

test("DEV-68: AdminOpsService - Approve payment proof extends subscription by 30 days", async () => {
  const repo = new FakeAdminOpsRepository();
  const service = new AdminOpsService(repo);

  const tenant = {
    id: "tenant-sub-1",
    name: "معهد النور",
    status: "active",
    subscription_status: "pending_verification",
    subscription_ends_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000).toISOString(),
  };
  repo.tenants.push(tenant);

  repo.paymentProofs.push({
    id: "proof-1",
    tenant_id: "tenant-sub-1",
    amount: 500,
    payment_method: "vodafone_cash",
    status: "pending",
    created_at: new Date().toISOString(),
  });

  const result = await service.approvePaymentProof("proof-1", "admin-user-1");

  assert.equal(result.tenant.subscription_status, "active");
  const proof = await repo.getPaymentProof("proof-1");
  assert.equal(proof?.status, "approved");

  // New end date is approximately 35 days from now
  const newEnds = new Date(result.subscription_ends_at).getTime();
  const diffDays = Math.round((newEnds - Date.now()) / (24 * 60 * 60 * 1000));
  assert.ok(diffDays >= 34 && diffDays <= 36);
});

test("DEV-68: AdminOpsService - Reject payment proof marks tenant past_due", async () => {
  const repo = new FakeAdminOpsRepository();
  const service = new AdminOpsService(repo);

  repo.tenants.push({
    id: "tenant-sub-2",
    name: "سنتر الفلاح",
    status: "active",
    subscription_status: "pending_verification",
  });

  repo.paymentProofs.push({
    id: "proof-2",
    tenant_id: "tenant-sub-2",
    amount: 300,
    payment_method: "instapay",
    status: "pending",
    created_at: new Date().toISOString(),
  });

  await service.rejectPaymentProof("proof-2", "admin-1", "إيصال غير واضح");

  const proof = await repo.getPaymentProof("proof-2");
  assert.equal(proof?.status, "rejected");
  const tenant = await repo.getTenant("tenant-sub-2");
  assert.equal(tenant?.subscription_status, "past_due");
});

test("DEV-68: AdminOpsService - formatNewSignupMessage includes Arabic formatted details", () => {
  const message = formatNewSignupMessage({
    teacher_name: "محمد الشافعي",
    teacher_email: "teacher@test.com",
    teacher_phone: "01012345678",
    tenant_name: "أكاديمية الفرسان",
    subject: "اللغة العربية",
    governorate: "الإسكندرية",
  });

  assert.ok(message.includes("محمد الشافعي"));
  assert.ok(message.includes("أكاديمية الفرسان"));
  assert.ok(message.includes("01012345678"));
  assert.ok(message.includes("تجربة مجانية (Trial)"));
});
