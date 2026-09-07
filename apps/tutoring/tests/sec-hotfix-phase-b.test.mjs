import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// C-01: WhatsApp Secret Decryption RPC Lockdown & Safe Status Wrapper
// ============================================================================

test("C-01: Migration 20260906000001_sec_hotfix_c01_whatsapp_rpc.sql exists and locks down RPC", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../supabase/migrations/20260906000001_sec_hotfix_c01_whatsapp_rpc.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "Migration file must exist");

  const sql = fs.readFileSync(migrationPath, "utf8");

  // Verify revocation from public, anon, authenticated
  assert.ok(
    sql.includes("revoke execute on function public.get_tenant_whatsapp_connection(uuid) from public, anon, authenticated;"),
    "Must revoke execute from public, anon, authenticated"
  );

  // Verify grant to service_role and postgres only
  assert.ok(
    sql.includes("grant execute on function public.get_tenant_whatsapp_connection(uuid) to service_role, postgres;"),
    "Must grant execute strictly to service_role and postgres"
  );

  // Verify client-safe status function exists
  assert.ok(
    sql.includes("create or replace function public.get_tenant_whatsapp_status(p_tenant_id uuid)"),
    "Must create get_tenant_whatsapp_status wrapper"
  );
  assert.ok(sql.includes("security invoker"), "Wrapper must use security invoker to respect caller RLS");
  assert.ok(!sql.includes("'api_key', ds.decrypted_secret"), "Wrapper must NEVER expose decrypted secret");
});

// ============================================================================
// C-04: Tenant Settings Modification Role Check & Repository Architecture
// ============================================================================

test("C-04: settingsRoutes.ts adheres to Clean Architecture and uses Repository pattern", () => {
  const routePath = path.resolve(__dirname, "../src/features/auth/settingsRoutes.ts");
  const code = fs.readFileSync(routePath, "utf8");

  // Must not import getServiceSupabaseClient
  assert.ok(
    !code.includes("getServiceSupabaseClient"),
    "settingsRoutes.ts must NOT directly import or call getServiceSupabaseClient"
  );

  // Must not import @supabase/supabase-js
  assert.ok(
    !code.includes("@supabase/supabase-js"),
    "settingsRoutes.ts must NOT import @supabase/supabase-js directly"
  );

  // Must not have fake admin-tenant fallback
  assert.ok(
    !code.includes("admin-tenant"),
    "settingsRoutes.ts must NOT contain fake admin-tenant fallback"
  );

  // Must enforce owner/center_owner role gate on PUT /
  assert.ok(
    code.includes("requireCenterOwnerOrAdmin"),
    "settingsRoutes.ts must enforce requireCenterOwnerOrAdmin on PUT"
  );
  assert.ok(
    code.includes("getServices(req).tenants"),
    "settingsRoutes.ts must access tenants repository via getServices(req).tenants"
  );
});

test("C-04: ITenantsRepository, SupabaseTenantsRepository, and FakeTenantsRepository work as expected", async () => {
  const { FakeTenantsRepository } = await import("../dist/features/auth/repository.js");
  const repo = new FakeTenantsRepository();

  const empty = await repo.getTenantSettings("tenant-1");
  assert.equal(empty, null);

  const updated = await repo.updateTenantSettings("tenant-1", {
    homework_submission: "online_before_session",
    auto_notification: false,
    enable_top_performers: true,
  });
  assert.equal(updated.homework_submission, "online_before_session");
  assert.equal(updated.auto_notification, false);

  const fetched = await repo.getTenantSettings("tenant-1");
  assert.deepEqual(fetched, updated);
});

test("C-04: requireCenterOwnerOrAdmin middleware strictly blocks non-owners and passes owners", async () => {
  const { requireCenterOwnerOrAdmin } = await import("../dist/shared/middleware/auth.js");

  // 1. Assistant role must be blocked with 403
  let assistantStatus = null;
  let assistantBody = null;
  let assistantNextCalled = false;
  requireCenterOwnerOrAdmin(
    { user: { id: "u-1", role: "assistant", tenant_id: "t-1" } },
    {
      status: (code) => {
        assistantStatus = code;
        return {
          json: (body) => {
            assistantBody = body;
          },
        };
      },
    },
    () => {
      assistantNextCalled = true;
    }
  );
  assert.equal(assistantStatus, 403);
  assert.equal(assistantBody?.error?.code, "FORBIDDEN");
  assert.equal(assistantNextCalled, false);

  // 2. Assistant to teacher must be blocked with 403
  let assistantTeacherNext = false;
  requireCenterOwnerOrAdmin(
    { user: { id: "u-2", role: "assistant_to_teacher", tenant_id: "t-1" } },
    { status: (code) => ({ json: () => {} }) },
    () => {
      assistantTeacherNext = true;
    }
  );
  assert.equal(assistantTeacherNext, false);

  // 3. Teacher under center must be blocked with 403
  let teacherNext = false;
  requireCenterOwnerOrAdmin(
    { user: { id: "u-3", role: "teacher", tenant_id: "t-1" } },
    { status: (code) => ({ json: () => {} }) },
    () => {
      teacherNext = true;
    }
  );
  assert.equal(teacherNext, false);

  // 4. Solo teacher owner must pass
  let ownerNextCalled = false;
  requireCenterOwnerOrAdmin(
    { user: { id: "u-4", role: "owner", tenant_id: "t-1" } },
    { status: () => {} },
    () => {
      ownerNextCalled = true;
    }
  );
  assert.equal(ownerNextCalled, true);

  // 5. Center owner must pass
  let centerOwnerNextCalled = false;
  requireCenterOwnerOrAdmin(
    { user: { id: "u-5", role: "center_owner", tenant_id: "t-1" } },
    { status: () => {} },
    () => {
      centerOwnerNextCalled = true;
    }
  );
  assert.equal(centerOwnerNextCalled, true);

  // 6. Admin must pass
  let adminNextCalled = false;
  requireCenterOwnerOrAdmin(
    { user: { id: "u-6", role: "admin" } },
    { status: () => {} },
    () => {
      adminNextCalled = true;
    }
  );
  assert.equal(adminNextCalled, true);

  // 7. Unauthenticated must return 401
  let unauthStatus = null;
  requireCenterOwnerOrAdmin(
    {},
    {
      status: (code) => {
        unauthStatus = code;
        return { json: () => {} };
      },
    },
    () => {}
  );
  assert.equal(unauthStatus, 401);
});

test("C-04: End-to-end PUT /api/settings blocks assistant and permits owner", async () => {
  const { settingsRouter } = await import("../dist/features/auth/settingsRoutes.js");
  const { FakeTenantsRepository } = await import("../dist/features/auth/repository.js");

  const app = express();
  app.use(express.json());

  const fakeRepo = new FakeTenantsRepository();

  // Test harness attaching mock services and authenticated user
  let currentUser = null;
  app.use((req, _res, next) => {
    req.user = currentUser;
    req.services = {
      tenants: fakeRepo,
    };
    next();
  });

  app.use("/api/settings", settingsRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Assistant user attempt -> 403 FORBIDDEN
    currentUser = { id: "u-asst", role: "assistant", tenant_id: "tenant-abc" };
    const resAssistant = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homework_submission: "online_before_session" }),
    });
    assert.equal(resAssistant.status, 403);
    const bodyAssistant = await resAssistant.json();
    assert.equal(bodyAssistant.error.code, "FORBIDDEN");

    // 2. Owner user attempt -> 200 OK
    currentUser = { id: "u-owner", role: "owner", tenant_id: "tenant-abc" };
    const resOwner = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        homework_submission: "online_before_session",
        auto_notification: false,
      }),
    });
    assert.equal(resOwner.status, 200);
    const bodyOwner = await resOwner.json();
    assert.equal(bodyOwner.message, "Settings updated successfully");
    assert.equal(bodyOwner.settings.homework_submission, "online_before_session");
    assert.equal(bodyOwner.settings.auto_notification, false);

    // 3. Verify GET /api/settings returns the updated settings
    const resGet = await fetch(`${baseUrl}/api/settings`);
    assert.equal(resGet.status, 200);
    const bodyGet = await resGet.json();
    assert.equal(bodyGet.settings.homework_submission, "online_before_session");
    assert.equal(bodyGet.settings.auto_notification, false);

    // 4. Center owner user attempt -> 200 OK
    currentUser = { id: "u-center-owner", role: "center_owner", tenant_id: "tenant-abc" };
    const resCenterOwner = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enable_top_performers: false }),
    });
    assert.equal(resCenterOwner.status, 200);

    // 5. Admin user WITH tenant_id attempt -> 200 OK
    currentUser = { id: "u-admin", role: "admin", tenant_id: "tenant-abc" };
    const resAdmin = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ enable_top_performers: true }),
    });
    assert.equal(resAdmin.status, 200);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

test("C-04: PUT and GET /api/settings reject admin without tenant_id with 400 TENANT_CONTEXT_REQUIRED and no repo update", async () => {
  const { settingsRouter } = await import("../dist/features/auth/settingsRoutes.js");
  const { FakeTenantsRepository } = await import("../dist/features/auth/repository.js");

  const app = express();
  app.use(express.json());

  let updateCalled = false;
  let getCalled = false;
  const fakeRepo = new FakeTenantsRepository();
  const originalUpdate = fakeRepo.updateTenantSettings.bind(fakeRepo);
  const originalGet = fakeRepo.getTenantSettings.bind(fakeRepo);

  fakeRepo.updateTenantSettings = async (tenantId, settings) => {
    updateCalled = true;
    return originalUpdate(tenantId, settings);
  };
  fakeRepo.getTenantSettings = async (tenantId) => {
    getCalled = true;
    return originalGet(tenantId);
  };

  let currentUser = { id: "u-admin", role: "admin" }; // Admin with NO tenant_id
  app.use((req, _res, next) => {
    req.user = currentUser;
    req.services = {
      tenants: fakeRepo,
    };
    next();
  });

  app.use("/api/settings", settingsRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. PUT /api/settings without tenant_id -> 400 Bad Request
    const resPut = await fetch(`${baseUrl}/api/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ homework_submission: "online_before_session" }),
    });
    assert.equal(resPut.status, 400);
    const bodyPut = await resPut.json();
    assert.deepEqual(bodyPut, {
      error: {
        code: "TENANT_CONTEXT_REQUIRED",
        message: "No tenant context available for this request.",
      },
    });
    // Ensure repository update was NEVER called
    assert.equal(updateCalled, false, "updateTenantSettings must NOT be called when tenant context is missing");

    // 2. GET /api/settings without tenant_id -> 400 Bad Request
    const resGet = await fetch(`${baseUrl}/api/settings`);
    assert.equal(resGet.status, 400);
    const bodyGet = await resGet.json();
    assert.deepEqual(bodyGet, {
      error: {
        code: "TENANT_CONTEXT_REQUIRED",
        message: "No tenant context available for this request.",
      },
    });
    assert.equal(getCalled, false, "getTenantSettings must NOT be called when tenant context is missing");
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});

// ============================================================================
// M-02: Telemetry Rate Limiting & Authenticated Tenant Binding
// ============================================================================

test("M-02: Migration 20260906000002_sec_hotfix_m02_telemetry_rls.sql drops open insert policy and restricts to service_role", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../supabase/migrations/20260906000002_sec_hotfix_m02_telemetry_rls.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "M-02 Migration file must exist");

  const sql = fs.readFileSync(migrationPath, "utf8");

  assert.ok(
    sql.includes("drop policy if exists telemetry_events_insert_all on public.telemetry_events;"),
    "Must drop open insert policy"
  );
  assert.ok(
    sql.includes("create policy telemetry_events_service_role_insert on public.telemetry_events"),
    "Must create service_role insert policy"
  );
  assert.ok(
    sql.includes("for insert to service_role with check (true);"),
    "Must restrict insert strictly to service_role"
  );
});

test("M-02: Telemetry endpoint rate limits excessive requests", async () => {
  const { telemetryRateLimiter } = await import("../dist/shared/middleware/rateLimit.js");

  const app = express();
  app.use(express.json());
  app.use(telemetryRateLimiter);
  app.post("/test-telemetry-rate", (_req, res) => {
    res.status(200).json({ ok: true });
  });

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    let rateLimited = false;
    for (let i = 0; i < 65; i++) {
      const res = await fetch(`${baseUrl}/test-telemetry-rate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });
      if (res.status === 429) {
        rateLimited = true;
        const body = await res.json();
        assert.equal(body.error.code, "RATE_LIMITED");
        break;
      }
    }
    assert.equal(rateLimited, true, "Rate limiter must trip after 60 requests per minute");
  } finally {
    await telemetryRateLimiter.resetKey("::/56");
    await telemetryRateLimiter.resetKey("::1");
    await telemetryRateLimiter.resetKey("127.0.0.1");
    await new Promise((resolve) => server.close(resolve));
  }
});

test("M-02: Telemetry endpoint binds verified tenant_id from user session, ignoring body spoofing", async () => {
  const { config } = await import("../dist/shared/config/index.js");
  const { telemetryRouter } = await import("../dist/features/telemetry/routes.js");
  const { FakeTelemetryRepository } = await import("../dist/features/telemetry/repository.js");
  const { TelemetryService } = await import("../dist/features/telemetry/service.js");
  const { telemetryRateLimiter } = await import("../dist/shared/middleware/rateLimit.js");

  await telemetryRateLimiter.resetKey("::/56");
  await telemetryRateLimiter.resetKey("::1");
  await telemetryRateLimiter.resetKey("127.0.0.1");

  const prevBehaviorTracking = config.features.behaviorTracking;
  config.features.behaviorTracking = true;

  const fakeRepo = new FakeTelemetryRepository();
  const service = new TelemetryService(fakeRepo);

  const app = express();
  app.use(express.json());

  let testUser = null;
  app.use((req, _res, next) => {
    req.user = testUser;
    req.services = {
      telemetry: service,
    };
    next();
  });

  app.use("/api/telemetry", telemetryRouter);

  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;

  try {
    // 1. Authenticated user: body attempts to spoof tenant_id: "evil-tenant-999"
    testUser = { id: "u-legit", tenant_id: "legit-tenant-123", role: "owner" };
    const resAuth = await fetch(`${baseUrl}/api/telemetry/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: "evil-tenant-999", // Spoof attempt
        events: [
          {
            event_name: "test_action",
            properties: { spoofed_tenant: "evil-tenant-999" },
          },
        ],
      }),
    });
    assert.equal(resAuth.status, 200);
    // Recorded event must have the legit tenant_id, never the spoofed one
    const authEvent = fakeRepo.recorded[fakeRepo.recorded.length - 1];
    assert.equal(authEvent.tenant_id, "legit-tenant-123");

    // 2. Anonymous user: tenant_id must be null
    testUser = null;
    const resAnon = await fetch(`${baseUrl}/api/telemetry/events`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tenant_id: "evil-tenant-999", // Spoof attempt
        events: [
          {
            event_name: "anonymous_page_view",
            properties: { path: "/login" },
          },
        ],
      }),
    });
    assert.equal(resAnon.status, 200);
    const anonEvent = fakeRepo.recorded[fakeRepo.recorded.length - 1];
    assert.equal(anonEvent.tenant_id, null);
  } finally {
    config.features.behaviorTracking = prevBehaviorTracking;
    await telemetryRateLimiter.resetKey("::/56");
    await telemetryRateLimiter.resetKey("::1");
    await telemetryRateLimiter.resetKey("127.0.0.1");
    await new Promise((resolve) => server.close(resolve));
  }
});

// ============================================================================
// M-05: Repository Boundary Encapsulation in ReportsService
// ============================================================================

test("M-05: reports/service.ts has ZERO direct Supabase imports and complies with Clean Architecture", () => {
  const servicePath = path.resolve(__dirname, "../src/features/reports/service.ts");
  const code = fs.readFileSync(servicePath, "utf8");

  // Must not import getServiceSupabaseClient
  assert.ok(
    !code.includes("getServiceSupabaseClient"),
    "reports/service.ts must NOT import getServiceSupabaseClient"
  );

  // Must not import @supabase/supabase-js
  assert.ok(
    !code.includes("@supabase/supabase-js"),
    "reports/service.ts must NOT import @supabase/supabase-js"
  );
});

test("M-05: ReportsService routes message_logs writes through IMessageLogsRepository", async () => {
  const { ReportsService } = await import("../dist/features/reports/service.js");
  const { FakeMessageLogsRepository } = await import("../dist/features/reports/repository.js");

  const fakeMessageLogsRepo = new FakeMessageLogsRepository();
  const mockReportsRepo = {
    async getStudentsWithPerformanceData() {
      return [
        {
          student: {
            id: "stu-1",
            name: "سالم محمود",
            code: "1001",
            parent_phone: "01012345678",
          },
          attendances: [{ attended: true }],
          grades: [{ score: 20, max_score: 20 }],
        },
      ];
    },
    async getStudentPerformanceData(_tenantId, studentId) {
      return {
        student: {
          id: studentId,
          name: "سالم محمود",
          code: "1001",
          parent_phone: "01012345678",
        },
        attendances: [{ attended: true }],
        grades: [{ score: 20, max_score: 20 }],
      };
    },
  };

  // Instantiate ReportsService with no custom WhatsApp dispatcher, but with FakeMessageLogsRepository
  const service = new ReportsService(mockReportsRepo, undefined, fakeMessageLogsRepo);

  // Trigger individual report send (triggers fallback message log write)
  const result = await service.sendIndividualReport("tenant-test-1", "stu-1", 9, 2026);
  assert.equal(result.status, "sent");

  // Verify write was captured by FakeMessageLogsRepository
  assert.equal(fakeMessageLogsRepo.logs.length, 1);
  const log = fakeMessageLogsRepo.logs[0];
  assert.equal(log.tenant_id, "tenant-test-1");
  assert.equal(log.student_id, "stu-1");
  assert.equal(log.recipient_phone, "01012345678");
  assert.equal(log.status, "sent");
});


