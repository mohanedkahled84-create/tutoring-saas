import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import express from "express";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

import {
  buildInstanceName,
  WhatsAppNotificationsService,
  FakeEvolutionGateway,
  whatsappRouter,
} from "../dist/features/whatsapp-notifications/index.js";

/**
 * In-Memory Fake WhatsApp Repository
 */
class FakeWhatsAppRepository {
  constructor() {
    this.connections = new Map();
    this.templates = [];
    this.dispatchedKeys = new Set();
  }

  async isMessageDispatched(key) {
    return this.dispatchedKeys.has(key);
  }

  async getTemplates() {
    return this.templates;
  }

  async upsertTemplate(t) {
    return t;
  }

  async getConnectionStatus(tenantId, teacherId) {
    const key = `${tenantId}:${teacherId || "default"}`;
    const conn = this.connections.get(key);
    return {
      instance_name: buildInstanceName(tenantId || "default", teacherId || "default"),
      status: conn?.instance_status || "connected",
      phone_number: "+201099887766",
      gateway: "Evolution API v2.1",
      latency_ms: 110,
      daily_quota: {
        used: conn?.sent_today || 0,
        limit: conn?.daily_limit || 500,
        safety_score: "excellent",
      },
    };
  }

  async getConnection(tenantId, teacherId) {
    const key = `${tenantId}:${teacherId || "default"}`;
    return this.connections.get(key) || null;
  }

  async upsertConnection(conn) {
    const key = `${conn.tenant_id}:${conn.teacher_id || "default"}`;
    const record = {
      id: `conn-${this.connections.size + 1}`,
      ...conn,
      created_at: new Date().toISOString(),
    };
    this.connections.set(key, record);
    return record;
  }
}

// ============================================================================
// 1. Instance Naming & Clean Architecture Rules
// ============================================================================

test("DEV-88: buildInstanceName adheres strictly to centrly_tenant_{tenantId}_teacher_{teacherId}", () => {
  const name1 = buildInstanceName("tenant-alpha", "teacher-101");
  assert.equal(name1, "centrly_tenant_tenant-alpha_teacher_teacher-101");

  const name2 = buildInstanceName("center-xyz", "teacher-456");
  assert.equal(name2, "centrly_tenant_center-xyz_teacher_teacher-456");
});

test("DEV-88: Clean Architecture Rule 1 & Rule 3 - ZERO Supabase imports in gateway and service", () => {
  const gatewayPath = path.resolve(__dirname, "../src/features/whatsapp-notifications/gateway.ts");
  const servicePath = path.resolve(__dirname, "../src/features/whatsapp-notifications/service.ts");

  const gatewayCode = fs.readFileSync(gatewayPath, "utf8");
  const serviceCode = fs.readFileSync(servicePath, "utf8");

  assert.ok(
    !gatewayCode.includes("@supabase/supabase-js"),
    "gateway.ts must NOT import @supabase/supabase-js directly"
  );
  assert.ok(
    !serviceCode.includes("@supabase/supabase-js"),
    "service.ts must NOT import @supabase/supabase-js directly"
  );
});

// ============================================================================
// 2. Database Migration & RLS Scoping Verification
// ============================================================================

test("DEV-88: Migration 20260909000003_dev88_teacher_whatsapp_connections.sql exists and enforces composite unique constraint & RLS", () => {
  const migrationPath = path.resolve(
    __dirname,
    "../../../supabase/migrations/20260909000003_dev88_teacher_whatsapp_connections.sql"
  );
  assert.ok(fs.existsSync(migrationPath), "Migration file must exist");

  const sql = fs.readFileSync(migrationPath, "utf8");

  // Schema alterations
  assert.ok(sql.includes("add column if not exists teacher_id uuid"), "Must add teacher_id column");
  assert.ok(sql.includes("drop constraint if exists whatsapp_connections_tenant_id_key"), "Must drop single tenant_id unique constraint");
  assert.ok(sql.includes("unique (tenant_id, teacher_id)"), "Must enforce composite unique constraint on (tenant_id, teacher_id)");
  assert.ok(sql.includes("create unique index if not exists idx_whatsapp_connections_tenant_teacher"), "Must create partial unique index");

  // RLS Policies
  assert.ok(sql.includes("whatsapp_connections_select"), "Must define select RLS policy");
  assert.ok(sql.includes("whatsapp_connections_insert"), "Must define insert RLS policy");
  assert.ok(sql.includes("whatsapp_connections_update"), "Must define update RLS policy");
  assert.ok(sql.includes("whatsapp_connections_delete"), "Must define delete RLS policy");

  // Ensure assistants are NOT granted insert/update/delete
  assert.ok(
    !sql.includes("create policy \"whatsapp_connections_insert\" on public.whatsapp_connections for insert with check (public.get_current_user_role() = 'assistant')"),
    "Assistants must NOT have insert permission"
  );
});

// ============================================================================
// 3. FakeEvolutionGateway & Service Integration
// ============================================================================

test("DEV-88: FakeEvolutionGateway generates QR, tracks state, and disconnects", async () => {
  const fakeGateway = new FakeEvolutionGateway();
  const instanceName = "centrly_tenant_t1_teacher_tch1";

  // 1. Initially request QR
  const qrRes = await fakeGateway.getQrCode(instanceName);
  assert.equal(qrRes.instance_name, instanceName);
  assert.equal(qrRes.status, "pending");
  assert.ok(qrRes.qr_base64.startsWith("data:image/png;base64,"));
  assert.ok(qrRes.pairing_code);
  assert.equal(qrRes.expires_in_seconds, 30);

  // 2. Set connected
  fakeGateway.setInstanceState(instanceName, "connected", "+201011223344");
  const stateRes = await fakeGateway.getConnectionState(instanceName);
  assert.equal(stateRes.status, "connected");
  assert.equal(stateRes.phone_number, "+201011223344");

  // QR should now indicate connected without code
  const connectedQr = await fakeGateway.getQrCode(instanceName);
  assert.equal(connectedQr.status, "connected");
  assert.equal(connectedQr.qr_base64, null);

  // 3. Disconnect
  const disconnected = await fakeGateway.disconnectInstance(instanceName);
  assert.equal(disconnected, true);

  const finalState = await fakeGateway.getConnectionState(instanceName);
  assert.equal(finalState.status, "disconnected");
});

test("DEV-88: WhatsAppNotificationsService coordinates with repository and gateway", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeEvolutionGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);

  // 1. Get QR code
  const qr = await service.getQrCode("tenant-abc", "teacher-xyz");
  assert.equal(qr.instance_name, "centrly_tenant_tenant-abc_teacher_teacher-xyz");
  assert.equal(qr.status, "pending");
  assert.ok(qr.qr_base64);

  // 2. Disconnect
  const dcRes = await service.disconnect("tenant-abc", "teacher-xyz");
  assert.equal(dcRes.success, true);
  assert.equal(dcRes.status, "disconnected");
  assert.equal(dcRes.instance_name, "centrly_tenant_tenant-abc_teacher_teacher-xyz");

  // Repository updated
  const storedConn = await repo.getConnection("tenant-abc", "teacher-xyz");
  assert.equal(storedConn.instance_status, "disconnected");
});

// ============================================================================
// 4. HTTP Routes & Authorization Role Guards
// ============================================================================

test("DEV-88: POST /api/whatsapp/disconnect strictly rejects assistants with 403 FORBIDDEN", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeEvolutionGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);

  const assistantRoles = ["assistant", "assistant_to_teacher", "assistant_to_center"];

  for (const role of assistantRoles) {
    const app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { id: "user-ast", role, tenant_id: "tenant-1", teacher_id: "tch-1" };
      req.services = { whatsapp: service };
      next();
    });
    app.use("/api/whatsapp", whatsappRouter);

    const server = app.listen(0);
    const port = server.address().port;

    try {
      const res = await fetch(`http://127.0.0.1:${port}/api/whatsapp/disconnect`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ teacher_id: "tch-1" }),
      });

      assert.equal(res.status, 403, `Role ${role} must be rejected with 403`);
      const body = await res.json();
      assert.equal(body.error.code, "FORBIDDEN");
      assert.ok(body.error.message.includes("Assistants are not permitted to disconnect"));
    } finally {
      server.close();
    }
  }
});

test("DEV-88: POST /api/whatsapp/disconnect allows teacher for own instance and blocks other teachers", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeEvolutionGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "user-tch1", role: "teacher", tenant_id: "tenant-1", teacher_id: "tch-1" };
    req.services = { whatsapp: service };
    next();
  });
  app.use("/api/whatsapp", whatsappRouter);

  const server = app.listen(0);
  const port = server.address().port;

  try {
    // 1. Teacher disconnects own instance -> 200 OK
    const ownRes = await fetch(`http://127.0.0.1:${port}/api/whatsapp/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id: "tch-1" }),
    });
    assert.equal(ownRes.status, 200);
    const ownBody = await ownRes.json();
    assert.equal(ownBody.success, true);
    assert.equal(ownBody.instance_name, "centrly_tenant_tenant-1_teacher_tch-1");

    // 2. Teacher attempts to disconnect another teacher -> 403 FORBIDDEN
    const otherRes = await fetch(`http://127.0.0.1:${port}/api/whatsapp/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id: "tch-2" }),
    });
    assert.equal(otherRes.status, 403);
    const otherBody = await otherRes.json();
    assert.equal(otherBody.error.code, "FORBIDDEN");
  } finally {
    server.close();
  }
});

test("DEV-88: POST /api/whatsapp/disconnect allows center_owner and admin to disconnect any teacher", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeEvolutionGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "user-owner", role: "center_owner", tenant_id: "tenant-1" };
    req.services = { whatsapp: service };
    next();
  });
  app.use("/api/whatsapp", whatsappRouter);

  const server = app.listen(0);
  const port = server.address().port;

  try {
    const res = await fetch(`http://127.0.0.1:${port}/api/whatsapp/disconnect`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ teacher_id: "tch-5" }),
    });
    assert.equal(res.status, 200);
    const body = await res.json();
    assert.equal(body.success, true);
    assert.equal(body.instance_name, "centrly_tenant_tenant-1_teacher_tch-5");
    assert.equal(body.status, "disconnected");
  } finally {
    server.close();
  }
});

test("DEV-88: GET /api/whatsapp/qr and /status adhere strictly to snake_case format", async () => {
  const repo = new FakeWhatsAppRepository();
  const gateway = new FakeEvolutionGateway();
  const service = new WhatsAppNotificationsService(repo, gateway);

  const app = express();
  app.use(express.json());
  app.use((req, _res, next) => {
    req.user = { id: "user-tch1", role: "teacher", tenant_id: "tenant-1", teacher_id: "tch-1" };
    req.services = { whatsapp: service };
    next();
  });
  app.use("/api/whatsapp", whatsappRouter);

  const server = app.listen(0);
  const port = server.address().port;

  try {
    // 1. GET /api/whatsapp/qr
    const qrRes = await fetch(`http://127.0.0.1:${port}/api/whatsapp/qr`);
    assert.equal(qrRes.status, 200);
    const qrBody = await qrRes.json();

    assert.ok("instance_name" in qrBody);
    assert.ok("status" in qrBody);
    assert.ok("qr_base64" in qrBody);
    assert.ok("pairing_code" in qrBody);
    assert.ok("expires_in_seconds" in qrBody);
    assert.equal(qrBody.instance_name, "centrly_tenant_tenant-1_teacher_tch-1");

    // 2. GET /api/whatsapp/status
    const statusRes = await fetch(`http://127.0.0.1:${port}/api/whatsapp/status`);
    assert.equal(statusRes.status, 200);
    const statusBody = await statusRes.json();

    assert.ok("status" in statusBody);
    assert.ok("instance_name" in statusBody);
    assert.ok("phone_number" in statusBody);
    assert.ok("daily_quota" in statusBody);
  } finally {
    server.close();
  }
});
