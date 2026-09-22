import test from "node:test";
import assert from "node:assert/strict";
import {
  AdminOpsService,
  FakeAdminOpsRepository,
  SupabaseAdminOpsRepository,
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

test("DEV-68: AdminOpsService - Approve payment proof with custom extendDays (yearly)", async () => {
  const repo = new FakeAdminOpsRepository();
  const service = new AdminOpsService(repo);

  const tenant = {
    id: "tenant-sub-3",
    name: "سنتر الأوائل",
    status: "active",
    subscription_status: "pending_verification",
  };
  repo.tenants.push(tenant);

  repo.paymentProofs.push({
    id: "proof-3",
    tenant_id: "tenant-sub-3",
    amount: 6469,
    payment_method: "instapay",
    status: "pending",
    created_at: new Date().toISOString(),
  });

  const result = await service.approvePaymentProof("proof-3", "admin-user-1", 365);
  assert.equal(result.tenant.subscription_status, "active");
  const newEnds = new Date(result.subscription_ends_at).getTime();
  const diffDays = Math.round((newEnds - Date.now()) / (24 * 60 * 60 * 1000));
  assert.ok(diffDays >= 364 && diffDays <= 366);
});

test("DEV-SL.3: AdminOpsService - listPaymentProofs filters by status or returns all proofs with tenant metadata", async () => {
  const repo = new FakeAdminOpsRepository();
  const service = new AdminOpsService(repo);

  repo.paymentProofs.push(
    {
      id: "proof-pending-1",
      tenant_id: "tenant-1",
      amount: 899,
      payment_method: "instapay",
      status: "pending",
      created_at: new Date().toISOString(),
      tenants: { name: "مهند خالد - منظومة تعليمية" },
    },
    {
      id: "proof-approved-1",
      tenant_id: "tenant-2",
      amount: 599,
      payment_method: "vodafone_cash",
      status: "approved",
      created_at: new Date().toISOString(),
      tenants: { name: "أكاديمية المستقبل" },
    }
  );

  const pendingProofs = await service.listPaymentProofs("pending");
  assert.equal(pendingProofs.length, 1);
  assert.equal(pendingProofs[0].id, "proof-pending-1");
  assert.equal(pendingProofs[0].amount, 899);
  assert.equal(pendingProofs[0].tenants?.name, "مهند خالد - منظومة تعليمية");

  const allProofs = await service.listPaymentProofs();
  assert.equal(allProofs.length, 2);
});

test("DEV-SL.3: SupabaseAdminOpsRepository - listAllTenants maps owner user details (email, phone, account_type) and student counts", async () => {
  const mockClient = {
    from: (table) => {
      if (table === "tenants") {
        return {
          select: (fields) => {
            assert.ok(fields.includes("users(email, phone, full_name, role)"));
            assert.ok(fields.includes("students(count)"));
            return {
              order: () => Promise.resolve({
                data: [
                  {
                    id: "tenant-7b8b30e0",
                    name: "مهند خالد - منظومة تعليمية",
                    status: "active",
                    subscription_status: "pending_verification",
                    account_type: "teacher",
                    trial_ends_at: "2026-09-28T13:10:21.391Z",
                    subscription_ends_at: null,
                    deleted_at: null,
                    created_at: "2026-09-14T13:10:21.808Z",
                    users: [
                      {
                        email: "mohanedkahled84@gmail.com",
                        phone: "01123671177",
                        full_name: "مهند خالد",
                        role: "owner",
                      },
                    ],
                    students: [{ count: 24 }],
                  },
                ],
                error: null,
              }),
            };
          },
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const repo = new SupabaseAdminOpsRepository(mockClient);
  const tenants = await repo.listAllTenants();

  assert.equal(tenants.length, 1);
  const t = tenants[0];
  assert.equal(t.id, "tenant-7b8b30e0");
  assert.equal(t.name, "مهند خالد - منظومة تعليمية");
  assert.equal(t.subscription_status, "pending_verification");
  assert.equal(t.account_type, "teacher");
  assert.equal(t.email, "mohanedkahled84@gmail.com");
  assert.equal(t.phone, "01123671177");
  assert.equal(t.full_name, "مهند خالد");
  assert.equal(t.students_count, 24);
});

test("DEV-SL.3: SupabaseAdminOpsRepository - getTenant maps single tenant owner contact info correctly", async () => {
  const mockClient = {
    from: (table) => {
      if (table === "tenants") {
        return {
          select: () => ({
            eq: (_col, val) => ({
              maybeSingle: () => Promise.resolve({
                data: {
                  id: val,
                  name: "سنتر النخبة",
                  status: "active",
                  subscription_status: "active",
                  account_type: "center",
                  trial_ends_at: null,
                  subscription_ends_at: "2026-10-15T00:00:00Z",
                  deleted_at: null,
                  created_at: "2026-09-01T10:00:00Z",
                  users: [
                    {
                      email: "center_admin@nokhba.com",
                      phone: "01099887766",
                      full_name: "مدير سنتر النخبة",
                      role: "center_owner",
                    },
                  ],
                  students: [{ count: 120 }],
                },
                error: null,
              }),
            }),
          }),
        };
      }
      throw new Error(`Unexpected table: ${table}`);
    },
  };

  const repo = new SupabaseAdminOpsRepository(mockClient);
  const tenant = await repo.getTenant("center-123");

  assert.ok(tenant);
  assert.equal(tenant.id, "center-123");
  assert.equal(tenant.account_type, "center");
  assert.equal(tenant.email, "center_admin@nokhba.com");
  assert.equal(tenant.phone, "01099887766");
  assert.equal(tenant.students_count, 120);
});

test("DEV-HQ: AdminOpsService - purgeTestData safely cleans test accounts and test proofs", async () => {
  const repo = new FakeAdminOpsRepository();
  const service = new AdminOpsService(repo);

  repo.tenants = [
    { id: "t-real-1", name: "أستاذ أحمد طارق - لغة عربية", status: "active", subscription_status: "active" },
    { id: "t-test-1", name: "سنتر التجربة والاختبار", status: "active", subscription_status: "trial" },
    { id: "t-test-2", name: "Test Chemistry Academy", status: "trial", subscription_status: "trial" },
  ];

  repo.paymentProofs = [
    { id: "p-1", tenant_id: "t-real-1", amount: 899, payment_method: "instapay", status: "approved", created_at: "2026-09-01" },
    { id: "p-2", tenant_id: "t-test-1", amount: 100, payment_method: "vodafone_cash", status: "rejected", created_at: "2026-09-02" },
    { id: "p-3", tenant_id: "t-test-2", amount: 1, payment_method: "instapay", status: "pending", admin_notes: "test payment", created_at: "2026-09-02" },
  ];

  const result = await service.purgeTestData("admin-123");

  assert.equal(result.deleted_tenants_count, 2);
  assert.equal(result.deleted_proofs_count, 2);
  assert.equal(repo.tenants.length, 1);
  assert.equal(repo.tenants[0].name, "أستاذ أحمد طارق - لغة عربية");
  assert.equal(repo.paymentProofs.length, 1);
  assert.equal(repo.paymentProofs[0].id, "p-1");
});

test("DEV-HQ: AdminOpsService - testWebhookAlert dispatches test notification successfully", async () => {
  const repo = new FakeAdminOpsRepository();
  const service = new AdminOpsService(repo);

  const res = await service.testWebhookAlert("admin-123");
  assert.equal(res.success, true);
  assert.ok(res.message.includes("إشعار تجريبي"));
  assert.equal(repo.messageLogs.length, 1);
});


