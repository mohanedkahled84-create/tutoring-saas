import test from "node:test";
import assert from "node:assert/strict";
import { dispatchAdminAlertWebhook } from "../dist/features/admin-ops/adminAlertWebhook.js";

test("dispatchAdminAlertWebhook: successfully dispatches new_signup payload", async () => {
  let calledUrl = null;
  let calledOptions = null;

  const mockFetch = async (url, options) => {
    calledUrl = url;
    calledOptions = options;
    return { ok: true, status: 200 };
  };

  const payload = {
    event_type: "new_signup",
    teacher_name: "أحمد علي",
    teacher_email: "ahmed@example.com",
    teacher_phone: "01012345678",
    tenant_name: "سنتر النخبة",
    account_type: "center",
    subject: "كيمياء",
    governorate: "الجيزة",
    trial_ends_at: "2026-10-01T00:00:00.000Z",
  };

  const result = await dispatchAdminAlertWebhook(payload, mockFetch);
  assert.equal(result, true);
  assert.ok(calledUrl.includes("/webhook/centrly-admin-alerts"));
  assert.equal(calledOptions.method, "POST");

  const parsedBody = JSON.parse(calledOptions.body);
  assert.equal(parsedBody.event_type, "new_signup");
  assert.equal(parsedBody.teacher_name, "أحمد علي");
  assert.equal(parsedBody.tenant_name, "سنتر النخبة");
});

test("dispatchAdminAlertWebhook: successfully dispatches payment_proof_submitted payload", async () => {
  let calledPayload = null;

  const mockFetch = async (_url, options) => {
    calledPayload = JSON.parse(options.body);
    return { ok: true, status: 200 };
  };

  const payload = {
    event_type: "payment_proof_submitted",
    teacher_name: "سارة محمد",
    tenant_name: "أكاديمية التفوق",
    amount: 599,
    payment_method: "vodafone_cash",
    reference_number: "VF-998877",
    proof_image_url: "https://example.com/receipt.png",
  };

  const result = await dispatchAdminAlertWebhook(payload, mockFetch);
  assert.equal(result, true);
  assert.equal(calledPayload.event_type, "payment_proof_submitted");
  assert.equal(calledPayload.amount, 599);
  assert.equal(calledPayload.payment_method, "vodafone_cash");
});

test("dispatchAdminAlertWebhook: non-blocking on fetch failure (returns false without throwing)", async () => {
  const failingFetch = async () => {
    throw new Error("Network timeout / Connection refused");
  };

  const payload = {
    event_type: "new_signup",
    teacher_name: "تجربة",
    teacher_email: "fail@example.com",
    tenant_name: "مؤسسة",
  };

  const result = await dispatchAdminAlertWebhook(payload, failingFetch);
  assert.equal(result, false);
});
