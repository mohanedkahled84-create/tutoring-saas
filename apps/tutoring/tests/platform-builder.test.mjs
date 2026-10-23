import test from "node:test";
import assert from "node:assert/strict";
import { PlatformBuilderService } from "../dist/features/platform-builder/service.js";
import { FakePlatformBuilderRepository } from "../dist/features/platform-builder/repository.js";

test("PlatformBuilderService - Subdomain format validation", () => {
  const repo = new FakePlatformBuilderRepository();
  const service = new PlatformBuilderService(repo);

  // Too short (< 3 chars)
  assert.equal(service.validateSubdomainFormat("om").valid, false);

  // Reserved keywords
  assert.equal(service.validateSubdomainFormat("admin").valid, false);
  assert.equal(service.validateSubdomainFormat("api").valid, false);
  assert.equal(service.validateSubdomainFormat("portal").valid, false);
  assert.equal(service.validateSubdomainFormat("centrly").valid, false);

  // Invalid characters (spaces, arabic, special symbols)
  assert.equal(service.validateSubdomainFormat("omar jamal").valid, false);
  assert.equal(service.validateSubdomainFormat("عمر-جمال").valid, false);
  assert.equal(service.validateSubdomainFormat("omar_jamal").valid, false);
  assert.equal(service.validateSubdomainFormat("-omar").valid, false);

  // Valid subdomains
  assert.equal(service.validateSubdomainFormat("omarjamal").valid, true);
  assert.equal(service.validateSubdomainFormat("mr-omar").valid, true);
  assert.equal(service.validateSubdomainFormat("physics2026").valid, true);
});

test("PlatformBuilderService - Subdomain availability checking", async () => {
  const repo = new FakePlatformBuilderRepository();
  const service = new PlatformBuilderService(repo);

  // Seed an existing subdomain for tenant-1
  await repo.upsert("tenant-1", {
    subdomain: "mr-ahmed",
    display_title: "منصة مستر أحمد",
    subject_title: "فيزياء",
  });

  // Check mr-ahmed from tenant-2 -> taken
  const checkTaken = await service.checkSubdomainAvailability("mr-ahmed", "tenant-2");
  assert.equal(checkTaken.available, false);
  assert.match(checkTaken.reason, /مستخدم بالفعل/);

  // Check mr-ahmed from tenant-1 (its owner) -> available (own subdomain)
  const checkOwn = await service.checkSubdomainAvailability("mr-ahmed", "tenant-1");
  assert.equal(checkOwn.available, true);

  // Check new unused subdomain -> available
  const checkNew = await service.checkSubdomainAvailability("mr-tarek", "tenant-2");
  assert.equal(checkNew.available, true);
});

test("PlatformBuilderService - PRO Tier Gating: Blocks non-PRO tenants", async () => {
  const repo = new FakePlatformBuilderRepository();
  const service = new PlatformBuilderService(repo);

  const tenantId = "tenant-starter-123";
  repo.setTenantPlan(tenantId, {
    subscription_tier: "starter",
    subscription_status: "active",
    is_pro: false,
    is_active: true,
  });

  // Attempting to save as non-PRO must throw PRO_REQUIRED error
  await assert.rejects(
    async () => {
      await service.savePlatformSettings(tenantId, {
        subdomain: "mr-starter",
        display_title: "منصة المعلم",
        subject_title: "لغة عربية",
      });
    },
    (err) => {
      assert.equal(err.code, "PRO_REQUIRED");
      assert.equal(err.statusCode, 403);
      assert.match(err.message, /باقة برو/);
      return true;
    }
  );
});

test("PlatformBuilderService - PRO Tier Gating: Allows PRO tenants to publish platform", async () => {
  const repo = new FakePlatformBuilderRepository();
  const service = new PlatformBuilderService(repo);

  const tenantId = "tenant-pro-999";
  repo.setTenantPlan(tenantId, {
    subscription_tier: "pro",
    subscription_status: "active",
    is_pro: true,
    is_active: true,
  });

  const saved = await service.savePlatformSettings(tenantId, {
    subdomain: "omarjamal",
    display_title: "منصة مستر عمر جمال",
    subject_title: "خبير اللغة الإنجليزية",
    theme_preset: "navy",
    headline_text: "طريقك للدرجة النهائية",
  });

  assert.equal(saved.subdomain, "omarjamal");
  assert.equal(saved.display_title, "منصة مستر عمر جمال");
  assert.equal(saved.theme_preset, "navy");
  assert.equal(saved.is_active, true);

  // Retrieve public settings by subdomain
  const publicView = await service.getPublicSettings("omarjamal");
  assert.ok(publicView);
  assert.equal(publicView.display_title, "منصة مستر عمر جمال");
});

test("PlatformBuilderService - Admin / Omar bypass allows publishing without PRO tier", async () => {
  const repo = new FakePlatformBuilderRepository();
  const service = new PlatformBuilderService(repo);

  const tenantId = "tenant-admin-test";
  repo.setTenantPlan(tenantId, {
    subscription_tier: "free",
    subscription_status: "trial",
    is_pro: false,
    is_active: true,
  });

  // Verify getTeacherSettings elevates is_pro for adminOrOmar
  const settingsData = await service.getTeacherSettings(tenantId, true);
  assert.equal(settingsData.plan.is_pro, true);

  // Verify savePlatformSettings succeeds when isAdminOrOmar is true
  const saved = await service.savePlatformSettings(
    tenantId,
    {
      subdomain: "admin-platform",
      display_title: "منصة الأدمن التجريبية",
      subject_title: "شامل",
    },
    true
  );

  assert.equal(saved.subdomain, "admin-platform");
  assert.equal(saved.is_active, true);
});

test("PlatformBuilderService - getPublicMaterials returns teacher study materials", async () => {
  const repo = new FakePlatformBuilderRepository();
  const service = new PlatformBuilderService(repo);

  const tenantId = "tenant-content-test";
  await repo.upsert(tenantId, {
    subdomain: "mr-content",
    display_title: "منصة المحتوى",
    subject_title: "فيزياء",
  });

  repo.setFakeMaterials(tenantId, [
    {
      id: "mat-1",
      title: "محاضرة 1",
      type: "video",
      url: "https://www.youtube.com/watch?v=123",
      is_homework: false,
    },
    {
      id: "mat-2",
      title: "واجب 1",
      type: "pdf",
      url: "https://example.com/hw.pdf",
      is_homework: true,
    },
  ]);

  const materials = await service.getPublicMaterials("mr-content");
  assert.equal(materials.length, 2);
  assert.equal(materials[0].title, "محاضرة 1");
  assert.equal(materials[1].is_homework, true);
});

test("PlatformBuilderService - Real video view logging and retrieval", async () => {
  const repo = new FakePlatformBuilderRepository();
  const service = new PlatformBuilderService(repo);

  const tenantId = "tenant-video-tracker";
  await repo.upsert(tenantId, {
    subdomain: "mr-tracker",
    display_title: "منصة المتابعة",
    subject_title: "فيزياء",
  });

  // Student 1005 (Ahmed Mahmoud) watches 12%
  await service.recordVideoView("mr-tracker", {
    student_code: "1005",
    student_name: "أحمد محمود",
    material_title: "فيديو حل واجب الباب الرابع",
    progress_percent: 12,
    current_time: "04:15",
    duration_time: "35:23",
    status: "watching",
  });

  // Student 1006 (Mohaned Khaled) watches 100%
  await service.recordVideoView("mr-tracker", {
    student_code: "1006",
    student_name: "مهند خالد",
    material_title: "فيديو حل واجب الباب الرابع",
    progress_percent: 100,
    current_time: "35:23",
    duration_time: "35:23",
    status: "completed",
  });

  // Retrieve views for tenant
  const views = await service.getVideoViews(tenantId);
  assert.equal(views.length, 2);

  const mohaned = views.find((v) => v.student_code === "1006");
  assert.ok(mohaned);
  assert.equal(mohaned.student_name, "مهند خالد");
  assert.equal(mohaned.progress_percent, 100);
  assert.equal(mohaned.status, "completed");

  const ahmed = views.find((v) => v.student_code === "1005");
  assert.ok(ahmed);
  assert.equal(ahmed.student_name, "أحمد محمود");
  assert.equal(ahmed.progress_percent, 12);
  assert.equal(ahmed.status, "watching");

  // Re-watching updates progress accurately
  await service.recordVideoView("mr-tracker", {
    student_code: "1005",
    student_name: "أحمد محمود",
    material_title: "فيديو حل واجب الباب الرابع",
    progress_percent: 65,
    current_time: "22:50",
    duration_time: "35:23",
    status: "watching",
  });

  const updatedViews = await service.getVideoViews(tenantId);
  assert.equal(updatedViews.length, 2);
  const ahmedUpdated = updatedViews.find((v) => v.student_code === "1005");
  assert.equal(ahmedUpdated.progress_percent, 65);
});
