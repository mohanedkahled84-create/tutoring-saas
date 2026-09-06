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
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
});
