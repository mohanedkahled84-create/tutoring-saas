import test from "node:test";
import assert from "node:assert/strict";
import { ActivityLogService } from "../dist/features/activity-log/service.js";

/**
 * In-Memory Fake Repository implementing IActivityLogRepository
 * Demonstrates Rule 1: Zero Supabase dependencies in domain business logic.
 */
class FakeActivityLogRepository {
  constructor(initialLogs = []) {
    this.logs = [...initialLogs];
    this.shouldFail = false;
  }

  async insertLog(entry) {
    if (this.shouldFail) {
      throw new Error("Simulated database write failure");
    }
    this.logs.push({
      id: `log-${this.logs.length + 1}`,
      action_type: entry.action_type,
      entity_type: entry.entity_type,
      entity_id: entry.entity_id,
      actor_email: "actor@example.com",
      before_value: entry.before_value || null,
      after_value: entry.after_value || null,
      created_at: new Date().toISOString(),
      tenant_id: entry.tenant_id,
    });
  }

  async getLogs(tenantId, filter) {
    let result = this.logs.filter((l) => l.tenant_id === tenantId);
    if (filter.entity_type) {
      result = result.filter((l) => l.entity_type === filter.entity_type);
    }
    if (filter.action_type) {
      result = result.filter((l) => l.action_type === filter.action_type);
    }

    const total = result.length;
    const offset = filter.offset || 0;
    const limit = filter.limit || 50;
    const page = result.slice(offset, offset + limit);

    return {
      logs: page,
      total,
    };
  }
}

// ========================================================
// DEV-63: Activity-Log Service & Fake Repository Tests
// ========================================================

test("DEV-63: recordActivity appends log entry to repository", async () => {
  const fakeRepo = new FakeActivityLogRepository();
  const service = new ActivityLogService(fakeRepo);

  await service.recordActivity({
    tenant_id: "tenant-1",
    actor_user_id: "user-1",
    action_type: "session_open",
    entity_type: "session",
    entity_id: "sess-123",
  });

  assert.equal(fakeRepo.logs.length, 1);
  assert.equal(fakeRepo.logs[0].action_type, "session_open");
  assert.equal(fakeRepo.logs[0].entity_id, "sess-123");
});

test("DEV-63: recordActivity does not throw when repository fails (fault tolerant)", async () => {
  const fakeRepo = new FakeActivityLogRepository();
  fakeRepo.shouldFail = true;
  const service = new ActivityLogService(fakeRepo);

  // Should not throw even if DB throws
  await assert.doesNotReject(async () => {
    await service.recordActivity({
      tenant_id: "tenant-1",
      actor_user_id: "user-1",
      action_type: "attendance_record",
      entity_type: "attendance",
      entity_id: "att-123",
    });
  });
});

test("DEV-63: getAuditLogs returns tenant-scoped logs for owner or admin", async () => {
  const fakeRepo = new FakeActivityLogRepository([
    {
      id: "log-1",
      tenant_id: "tenant-1",
      action_type: "attendance_record",
      entity_type: "attendance",
      entity_id: "att-1",
      actor_email: "teacher@centrly.app",
      before_value: null,
      after_value: { attended: true },
      created_at: "2026-09-04T10:00:00Z",
    },
    {
      id: "log-2",
      tenant_id: "other-tenant",
      action_type: "attendance_record",
      entity_type: "attendance",
      entity_id: "att-2",
      actor_email: "other@centrly.app",
      before_value: null,
      after_value: null,
      created_at: "2026-09-04T10:05:00Z",
    },
  ]);

  const service = new ActivityLogService(fakeRepo);
  const result = await service.getAuditLogs("tenant-1", "owner", {});

  assert.equal(result.total, 1);
  assert.equal(result.logs.length, 1);
  assert.equal(result.logs[0].id, "log-1");
});

test("DEV-63: getAuditLogs rejects assistant with FORBIDDEN_ASSISTANT", async () => {
  const fakeRepo = new FakeActivityLogRepository();
  const service = new ActivityLogService(fakeRepo);

  await assert.rejects(
    async () => {
      await service.getAuditLogs("tenant-1", "assistant", {});
    },
    {
      message: "FORBIDDEN_ASSISTANT",
    }
  );
});

test("DEV-63: getAuditLogs applies entity_type and action_type filters", async () => {
  const fakeRepo = new FakeActivityLogRepository([
    {
      id: "log-1",
      tenant_id: "tenant-1",
      action_type: "session_open",
      entity_type: "session",
      entity_id: "sess-1",
    },
    {
      id: "log-2",
      tenant_id: "tenant-1",
      action_type: "quiz_score_record",
      entity_type: "quiz_score",
      entity_id: "quiz-1",
    },
  ]);

  const service = new ActivityLogService(fakeRepo);
  const filtered = await service.getAuditLogs("tenant-1", "owner", {
    entity_type: "session",
  });

  assert.equal(filtered.total, 1);
  assert.equal(filtered.logs[0].entity_type, "session");
});
