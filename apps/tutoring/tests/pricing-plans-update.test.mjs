import test from 'node:test';
import assert from 'node:assert/strict';
import { BillingService } from '../dist/features/billing/index.js';
import { AdminOpsService, FakeAdminOpsRepository } from '../dist/features/admin-ops/index.js';

class FakeBillingRepo {
  constructor() {
    this.tenants = [
      {
        id: 'tenant-1',
        name: '?????? ????????',
        subscription_status: 'active',
        subscription_tier: 'starter',
        trial_ends_at: null,
        subscription_ends_at: new Date(Date.now() + 30 * 86400000).toISOString(),
        settings: {},
      }
    ];
    this.proofs = [];
  }
  async getTenantBilling(id) {
    return this.tenants.find(t => t.id === id) || null;
  }
  async getPaymentProofs(id) {
    return this.proofs.filter(p => p.tenant_id === id);
  }
  async getStudentCount() {
    return 10;
  }
}

test('PRICING-PLANS: BillingService resolves new standard tiers (300, 750, 1500)', async () => {
  const repo = new FakeBillingRepo();
  const service = new BillingService(repo);

  // 1. Default fallback without settings -> 300 students @ باقة 300 طالب
  const t1 = repo.tenants[0];
  t1.subscription_tier = 'starter';
  t1.settings = {};
  const status1 = await service.getBillingStatus('tenant-1');
  assert.equal(status1.students_limit, 300);
  assert.equal(status1.plan_name, 'باقة 300 طالب');

  // 2. Growth tier -> 750 students @ باقة 750 طالب
  t1.subscription_tier = 'growth';
  const status2 = await service.getBillingStatus('tenant-1');
  assert.equal(status2.students_limit, 750);
  assert.equal(status2.plan_name, 'باقة 750 طالب');

  // 3. Pro tier -> 1500 students @ باقة 1500 طالب
  t1.subscription_tier = 'pro';
  const status3 = await service.getBillingStatus('tenant-1');
  assert.equal(status3.students_limit, 1500);
  assert.equal(status3.plan_name, 'باقة 1500 طالب');

  // 4. Proof amount detection: 8630 yearly (899 * 12 * 0.8) -> 750 students
  t1.subscription_tier = '';
  repo.proofs = [
    {
      id: 'p-new-1',
      tenant_id: 'tenant-1',
      amount: 8630,
      status: 'approved',
      admin_notes: 'annual payment',
      created_at: new Date().toISOString(),
    }
  ];
  const status4 = await service.getBillingStatus('tenant-1');
  assert.equal(status4.students_limit, 750);
  assert.equal(status4.plan_name, 'باقة 750 طالب');
});

test('PRICING-PLANS: AdminOpsService proof approval and override for new standard tiers', async () => {
  const repo = new FakeAdminOpsRepository();
  const service = new AdminOpsService(repo);

  repo.tenants = [
    {
      id: 'tenant-adm-1',
      name: 'أكاديمية النجاح',
      subscription_status: 'trial',
      subscription_tier: 'starter',
      trial_ends_at: new Date(Date.now() + 86400000).toISOString(),
      subscription_ends_at: null,
      settings: {},
    }
  ];

  repo.paymentProofs = [
    {
      id: 'proof-499',
      tenant_id: 'tenant-adm-1',
      amount: 499,
      status: 'pending',
      admin_notes: 'باقة 300 طالب شهري',
      created_at: new Date().toISOString(),
    },
    {
      id: 'proof-899',
      tenant_id: 'tenant-adm-1',
      amount: 899,
      status: 'pending',
      admin_notes: 'باقة 750 طالب شهري',
      created_at: new Date().toISOString(),
    },
    {
      id: 'proof-13430',
      tenant_id: 'tenant-adm-1',
      amount: 13430, // 1399 * 12 * 0.8 yearly
      status: 'pending',
      admin_notes: 'annual pro plan',
      created_at: new Date().toISOString(),
    }
  ];

  // Approve 499 monthly proof -> activates 300 students plan
  const res1 = await service.approvePaymentProof('proof-499', 'admin-1', 30);
  assert.ok(res1.tenant);
  assert.equal(res1.tenant.subscription_tier, 'starter');
  assert.equal(res1.tenant.students_limit, 300);
  assert.equal(res1.tenant.plan_name, 'باقة 300 طالب');

  // Approve 899 monthly proof -> activates 750 students plan
  const resGrowth = await service.approvePaymentProof('proof-899', 'admin-1', 30);
  assert.ok(resGrowth.tenant);
  assert.equal(resGrowth.tenant.subscription_tier, 'growth');
  assert.equal(resGrowth.tenant.students_limit, 750);
  assert.equal(resGrowth.tenant.plan_name, 'باقة 750 طالب');

  // Approve 13430 yearly proof -> activates 1500 students plan
  const res2 = await service.approvePaymentProof('proof-13430', 'admin-1', 365);
  assert.ok(res2.tenant);
  assert.equal(res2.tenant.subscription_tier, 'pro');
  assert.equal(res2.tenant.students_limit, 1500);
  assert.equal(res2.tenant.plan_name, 'باقة 1500 طالب');

  // Admin override to Growth -> sets 750 students plan
  const overrideRes = await service.updateSubscription('tenant-adm-1', { tier: 'growth' });
  assert.equal(overrideRes.settings?.students_limit, 750);
  assert.equal(overrideRes.settings?.plan_name, 'باقة 750 طالب');
});
