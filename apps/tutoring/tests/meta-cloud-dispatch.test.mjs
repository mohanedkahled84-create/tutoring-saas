import { test } from "node:test";
import assert from "node:assert/strict";
import {
  MetaCloudService,
  FakeMetaPortalQueueRepository,
  FakeMetaCloudGateway,
} from "../dist/features/whatsapp-notifications/index.js";

test("DEV-META.1: normalizeForMeta correctly standardizes Egyptian and international phone numbers", () => {
  const repo = new FakeMetaPortalQueueRepository();
  const gateway = new FakeMetaCloudGateway();
  const service = new MetaCloudService(repo, gateway, 250);

  // Standard Egyptian mobile numbers
  assert.equal(service.normalizeForMeta("01012345678"), "201012345678");
  assert.equal(service.normalizeForMeta("01198765432"), "201198765432");
  assert.equal(service.normalizeForMeta("01234567890"), "201234567890");
  assert.equal(service.normalizeForMeta("01555555555"), "201555555555");

  // With spaces, hyphens, and +
  assert.equal(service.normalizeForMeta("+20 10 1234 5678"), "201012345678");
  assert.equal(service.normalizeForMeta("010-1234-5678"), "201012345678");

  // Arabic-Indic digits
  assert.equal(service.normalizeForMeta("٠١٠١٢٣٤٥٦٧٨"), "201012345678");

  // Empty or null
  assert.equal(service.normalizeForMeta(""), "");
  assert.equal(service.normalizeForMeta(null), "");
});

test("DEV-META.2: dispatchBatchPortalLinks sends immediately when within 250 quota", async () => {
  const repo = new FakeMetaPortalQueueRepository();
  const gateway = new FakeMetaCloudGateway();
  const service = new MetaCloudService(repo, gateway, 250);

  const students = [
    {
      student_id: "s-1",
      student_name: "أحمد علي",
      student_phone: "01011111111",
      parent_phone: "01022222222",
    },
    {
      student_id: "s-2",
      student_name: "سارة محمد",
      student_phone: "01133333333",
      parent_phone: "01144444444",
    },
  ];

  const result = await service.dispatchBatchPortalLinks({
    tenant_id: "tenant-a",
    teacher_name: "مستر أحمد",
    subject_name: "الفيزياء",
    students,
    pacingDelayMs: 0,
  });

  assert.equal(result.total_students, 2);
  assert.equal(result.total_messages, 4); // 2 students + 2 parents
  assert.equal(result.sent_today, 4);
  assert.equal(result.queued_tomorrow, 0);
  assert.equal(result.daily_limit, 250);
  assert.equal(result.remaining_today, 246);
  assert.equal(result.is_template_pending, false);

  // Give async worker tick to run
  await new Promise((r) => setTimeout(r, 20));
  assert.equal(gateway.sentMessages.length, 4);
});

test("DEV-META.3: Multi-tenant FIFO quota splits overflow to tomorrow when >250 messages", async () => {
  const repo = new FakeMetaPortalQueueRepository();
  const gateway = new FakeMetaCloudGateway();
  // Set small limit of 5 messages for clear test verification
  const service = new MetaCloudService(repo, gateway, 5);

  const students = [
    { student_id: "s-1", student_name: "طالب 1", student_phone: "01000000001", parent_phone: "01000000002" },
    { student_id: "s-2", student_name: "طالب 2", student_phone: "01000000003", parent_phone: "01000000004" },
    { student_id: "s-3", student_name: "طالب 3", student_phone: "01000000005", parent_phone: "01000000006" },
  ]; // Total 6 messages (3 students * 2)

  const result = await service.dispatchBatchPortalLinks({
    tenant_id: "tenant-b",
    teacher_name: "مستر محمد",
    subject_name: "الكيمياء",
    students,
    pacingDelayMs: 0,
  });

  assert.equal(result.total_messages, 6);
  assert.equal(result.sent_today, 5); // Consumes remaining 5
  assert.equal(result.queued_tomorrow, 1); // 1 spilled to tomorrow
  assert.equal(result.remaining_today, 0);
  assert.ok(result.message.includes("جدولة"));
});

test("DEV-META.4: Gracefully queues items when Meta templates are pending review", async () => {
  const repo = new FakeMetaPortalQueueRepository();
  const gateway = new FakeMetaCloudGateway();
  gateway.simulatePending = true; // Meta template is PENDING
  const service = new MetaCloudService(repo, gateway, 250);

  const students = [
    { student_id: "s-10", student_name: "كريم خالد", student_phone: "01099999999", parent_phone: "01088888888" },
  ];

  const result = await service.dispatchBatchPortalLinks({
    tenant_id: "tenant-c",
    teacher_name: "مستر طارق",
    subject_name: "الأحياء",
    students,
    pacingDelayMs: 0,
  });

  assert.equal(result.is_template_pending, true);
  assert.equal(result.sent_today, 0);
  assert.equal(result.queued_tomorrow, 2);
  assert.ok(result.message.includes("Pending") || result.message.includes("المراجعة"));
});
