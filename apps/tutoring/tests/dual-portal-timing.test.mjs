import test from "node:test";
import assert from "node:assert/strict";
import {
  generateParentPortalInviteMessage,
  generateStudentPortalInviteMessage,
  WhatsAppNotificationsService,
} from "../dist/features/whatsapp-notifications/service.js";
import { FakeEvolutionGateway } from "../dist/features/whatsapp-notifications/gateway.js";

// Custom Mock Gateway to record exact call events with timestamps
class TrackingEvolutionGateway extends FakeEvolutionGateway {
  constructor() {
    super();
    this.events = [];
  }

  async sendPresence(instanceName, recipientNumber, presence = "composing") {
    this.events.push({
      type: "presence",
      instanceName,
      recipientNumber,
      presence,
      time: Date.now(),
    });
    return true;
  }

  async sendTextMessage(instanceName, recipientNumber, text) {
    this.events.push({
      type: "text",
      instanceName,
      recipientNumber,
      text,
      time: Date.now(),
    });
    return { success: true };
  }
}

test("DUAL-PORTAL: Spintax rotation produces non-identical consecutive messages", () => {
  const studentMsgs = [];
  const parentMsgs = [];

  for (let i = 0; i < 6; i++) {
    const sMsg = generateStudentPortalInviteMessage({
      student_name: `طالب ${i + 1}`,
      teacher_name: "مستر أحمد",
      portal_url: `https://centerly-eg.com/s/s${i + 1}`,
    });
    const pMsg = generateParentPortalInviteMessage({
      student_name: `طالب ${i + 1}`,
      teacher_name: "مستر أحمد",
      portal_url: `https://centerly-eg.com/p/p${i + 1}`,
    });

    studentMsgs.push(sMsg);
    parentMsgs.push(pMsg);

    assert.ok(sMsg.includes("بوابتك التعليمية"), "Must contain portal keyword");
    assert.ok(sMsg.includes("حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً"), "Must instruct contact saving");
    assert.ok(pMsg.includes("رابط المتابعة"), "Must contain parent portal keyword");
    assert.ok(pMsg.includes("حفظ وتسجيل هذا الرقم في جهات اتصالك أولاً"), "Must instruct parent contact saving");
  }

  // Verify consecutive messages are different
  for (let i = 1; i < studentMsgs.length; i++) {
    assert.notEqual(
      studentMsgs[i],
      studentMsgs[i - 1],
      `Student message ${i} should be rotated and distinct from ${i - 1}`
    );
    assert.notEqual(
      parentMsgs[i],
      parentMsgs[i - 1],
      `Parent message ${i} should be rotated and distinct from ${i - 1}`
    );
  }
});

test("DUAL-PORTAL: Fast-path mode (delay = 0) completes instantly and calls callbacks", async () => {
  const fakeGateway = new TrackingEvolutionGateway();
  const service = new WhatsAppNotificationsService(null, fakeGateway);

  const studentSentIds = [];
  const parentSentIds = [];

  const res = await service.batchSendDualPortalLinks({
    tenant_id: "test-tenant",
    teacher_name: "مستر أحمد",
    students: [
      {
        student_id: "student-fast-1",
        student_name: "أحمد علي",
        student_phone: "01011111111",
        parent_phone: "01022222222",
        student_portal_url: "https://centerly-eg.com/s/s1",
        parent_portal_url: "https://centerly-eg.com/p/p1",
      },
    ],
    pacingDelayMs: 0,
    parentDelayMs: 0,
    onStudentSent: (id) => {
      studentSentIds.push(id);
    },
    onParentSent: (id) => {
      parentSentIds.push(id);
    },
  });

  assert.equal(res.student_messages_sent, 1);
  assert.equal(res.parent_messages_sent, 1);
  assert.deepEqual(studentSentIds, ["student-fast-1"]);
  assert.deepEqual(parentSentIds, ["student-fast-1"]);
  assert.ok(res.results[0].student_sent);
  assert.ok(res.results[0].parent_sent);
});

test("DUAL-PORTAL: Delayed parent mode simulates typing presence and enforces parent delay", async () => {
  const gateway = new TrackingEvolutionGateway();
  const service = new WhatsAppNotificationsService(null, gateway);

  const studentSentIds = [];
  const parentSentIds = [];

  const startTime = Date.now();

  const res = await service.batchSendDualPortalLinks({
    tenant_id: "test-tenant",
    teacher_name: "مستر أحمد",
    students: [
      {
        student_id: "student-timed-1",
        student_name: "محمود حسن",
        student_phone: "01033333333",
        parent_phone: "01044444444",
        student_portal_url: "https://centerly-eg.com/s/s2",
        parent_portal_url: "https://centerly-eg.com/p/p2",
      },
    ],
    pacingDelayMs: 0,
    parentDelayMs: 60,       // 60ms delay for parent
    typingDurationMs: 30,    // 30ms typing simulation before parent
    onStudentSent: (id) => {
      studentSentIds.push(id);
    },
    onParentSent: (id) => {
      parentSentIds.push(id);
    },
  });

  const duration = Date.now() - startTime;
  assert.ok(duration >= 50, `Must have waited parentDelayMs (actual: ${duration}ms)`);

  assert.equal(res.student_messages_sent, 1);
  assert.equal(res.parent_messages_sent, 1);
  assert.deepEqual(studentSentIds, ["student-timed-1"]);
  assert.deepEqual(parentSentIds, ["student-timed-1"]);

  // Verify event sequence:
  // 1. Text message to student
  // 2. Presence 'composing' simulation to parent
  // 3. Text message to parent
  const studentTextEvent = gateway.events.find(
    (e) => e.type === "text" && e.recipientNumber.includes("01033333333")
  );
  const parentPresenceEvent = gateway.events.find(
    (e) => e.type === "presence" && e.recipientNumber.includes("01044444444") && e.presence === "composing"
  );
  const parentTextEvent = gateway.events.find(
    (e) => e.type === "text" && e.recipientNumber.includes("01044444444")
  );

  assert.ok(studentTextEvent, "Must send text to student");
  assert.ok(parentPresenceEvent, "Must pulse composing presence to parent");
  assert.ok(parentTextEvent, "Must send text to parent");

  assert.ok(
    studentTextEvent.time <= parentPresenceEvent.time,
    "Student message must precede parent typing simulation"
  );
  assert.ok(
    parentPresenceEvent.time <= parentTextEvent.time,
    "Parent typing simulation must precede parent message"
  );
});
