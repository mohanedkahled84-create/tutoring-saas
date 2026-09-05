import { test } from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import crypto from "node:crypto";
import { app } from "../dist/app.js";
import {
  validateUrlForSSRF,
  isPrivateOrInternalIp,
  safeFetch,
} from "../dist/shared/utils/ssrf.js";
import {
  detectMimeTypeFromMagicBytes,
  validateFileUpload,
} from "../dist/shared/utils/fileUploadValidator.js";
import {
  verifyWebhookSignature,
} from "../dist/shared/middleware/webhookIdempotency.js";

// Helper to start an ephemeral test server
async function withServer(fn) {
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, resolve));
  const port = server.address().port;
  const baseUrl = `http://localhost:${port}`;
  try {
    await fn(baseUrl);
  } finally {
    await new Promise((resolve) => server.close(resolve));
  }
}

// --------------------------------------------------------------------------
// GAP.1: CORS Origin Allowlist
// --------------------------------------------------------------------------
test("DEV-81 (GAP.1): Allowlisted origin passes CORS check", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health/ping`, {
      headers: { Origin: "https://centrly.app" },
    });

    assert.equal(res.status, 200);
    assert.equal(res.headers.get("access-control-allow-origin"), "https://centrly.app");
    assert.equal(res.headers.get("access-control-allow-credentials"), "true");
  });
});

test("DEV-81 (GAP.1): Non-allowlisted origin is rejected with 403 CORS_FORBIDDEN", async () => {
  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/health/ping`, {
      headers: { Origin: "https://evil-attacker.com" },
    });

    assert.equal(res.status, 403);
    const body = await res.json();
    assert.equal(body.error?.code, "CORS_FORBIDDEN");
    assert.match(body.error?.message, /CORS: Origin not allowed/i);
  });
});

// --------------------------------------------------------------------------
// GAP.2: SSRF Protection
// --------------------------------------------------------------------------
test("DEV-81 (GAP.2): isPrivateOrInternalIp identifies all loopback and private subnets", () => {
  assert.equal(isPrivateOrInternalIp("127.0.0.1"), true);
  assert.equal(isPrivateOrInternalIp("127.128.0.1"), true);
  assert.equal(isPrivateOrInternalIp("localhost"), true);
  assert.equal(isPrivateOrInternalIp("sub.localhost"), true);
  assert.equal(isPrivateOrInternalIp("10.0.0.1"), true);
  assert.equal(isPrivateOrInternalIp("172.16.0.1"), true);
  assert.equal(isPrivateOrInternalIp("172.31.255.255"), true);
  assert.equal(isPrivateOrInternalIp("192.168.1.1"), true);
  assert.equal(isPrivateOrInternalIp("169.254.169.254"), true); // AWS/GCP metadata
  assert.equal(isPrivateOrInternalIp("metadata.google.internal"), true);
  assert.equal(isPrivateOrInternalIp("::1"), true);
  assert.equal(isPrivateOrInternalIp("fe80::1"), true); // Link-local IPv6
  assert.equal(isPrivateOrInternalIp("2130706433"), true); // Decimal 127.0.0.1
  assert.equal(isPrivateOrInternalIp("0x7f000001"), true); // Hex 127.0.0.1

  // Public IPs should return false
  assert.equal(isPrivateOrInternalIp("8.8.8.8"), false);
  assert.equal(isPrivateOrInternalIp("1.1.1.1"), false);
  assert.equal(isPrivateOrInternalIp("example.com"), false);
});

test("DEV-81 (GAP.2): validateUrlForSSRF permits legitimate public endpoints and rejects dangerous ones", () => {
  // Valid URLs
  const valid = validateUrlForSSRF("https://api.resend.com/emails");
  assert.equal(valid.isValid, true);
  assert.ok(valid.parsedUrl);

  // Prohibited Protocols
  const fileProto = validateUrlForSSRF("file:///etc/passwd");
  assert.equal(fileProto.isValid, false);
  assert.match(fileProto.error, /Protocol 'file:' is not allowed/i);

  const ftpProto = validateUrlForSSRF("ftp://ftp.example.com/test");
  assert.equal(ftpProto.isValid, false);

  // Loopback / SSRF targets
  const loopback = validateUrlForSSRF("http://127.0.0.1:8080/admin");
  assert.equal(loopback.isValid, false);
  assert.match(loopback.error, /internal\/private network destination/i);

  const metadata = validateUrlForSSRF("http://169.254.169.254/latest/meta-data/");
  assert.equal(metadata.isValid, false);

  // Hostname allowlist enforcement
  const restricted = validateUrlForSSRF("https://untrusted-api.com/notify", {
    allowedHosts: ["api.resend.com", "*.centrly.app"],
  });
  assert.equal(restricted.isValid, false);
  assert.match(restricted.error, /not in the allowed hosts list/i);

  const allowedRestricted = validateUrlForSSRF("https://webhooks.centrly.app/dispatch", {
    allowedHosts: ["*.centrly.app"],
  });
  assert.equal(allowedRestricted.isValid, true);
});

test("DEV-81 (GAP.2): safeFetch rejects internal target before attempting network connection", async () => {
  await assert.rejects(
    async () => {
      await safeFetch("http://127.0.0.1:9999/private-api");
    },
    /SSRF_PROHIBITED/
  );
});

// --------------------------------------------------------------------------
// GAP.3: Webhook Idempotency & Signature Verification
// --------------------------------------------------------------------------
test("DEV-81 (GAP.3): verifyWebhookSignature validates HMAC timing-safely", () => {
  const secret = "test_webhook_secret_12345";
  const payload = JSON.stringify({ event: "charge.success", amount: 500 });
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

  // Valid signature
  assert.equal(verifyWebhookSignature(payload, secret, hmac), true);
  assert.equal(verifyWebhookSignature(payload, secret, `sha256=${hmac}`), true);

  // Tampered payload or wrong secret
  assert.equal(verifyWebhookSignature(payload + "tampered", secret, hmac), false);
  assert.equal(verifyWebhookSignature(payload, "wrong_secret", hmac), false);
  assert.equal(verifyWebhookSignature(payload, secret, "invalid_hex"), false);
});

test("DEV-81 (GAP.3): POST /api/webhooks/payment rejects requests without valid HMAC signature", async () => {
  await withServer(async (baseUrl) => {
    const payload = {
      event_id: "evt_test_123",
      tenant_id: crypto.randomUUID(),
      status: "paid",
      amount: 600,
      plan: "growth",
    };

    // Missing signature
    const resMissing = await fetch(`${baseUrl}/api/webhooks/payment`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    assert.equal(resMissing.status, 401);

    // Invalid signature
    const resInvalid = await fetch(`${baseUrl}/api/webhooks/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": "invalid_signature_hex",
      },
      body: JSON.stringify(payload),
    });
    assert.equal(resInvalid.status, 403);
  });
});

test("DEV-81 (GAP.3): POST /api/webhooks/payment processes valid webhook and replays idempotently", async () => {
  await withServer(async (baseUrl) => {
    const secret = process.env.PAYMENT_WEBHOOK_SECRET || process.env.INTERNAL_API_SECRET || "centrly_test_internal_secret";
    process.env.PAYMENT_WEBHOOK_SECRET = secret;

    const eventId = `evt_idemp_${Date.now()}`;
    const payload = {
      event_id: eventId,
      tenant_id: crypto.randomUUID(),
      status: "paid",
      amount: 850,
      plan: "growth",
    };

    const payloadString = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");

    // 1st request: processes fresh webhook
    const res1 = await fetch(`${baseUrl}/api/webhooks/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signature,
      },
      body: payloadString,
    });

    assert.equal(res1.status, 200);
    const body1 = await res1.json();
    assert.equal(body1.success, true);
    assert.equal(body1.status, "processed");
    assert.equal(res1.headers.get("x-idempotent-replay"), null);

    // 2nd request (duplicate webhook replay with identical payload and key)
    const res2 = await fetch(`${baseUrl}/api/webhooks/payment`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-webhook-signature": signature,
      },
      body: payloadString,
    });

    assert.equal(res2.status, 200);
    const body2 = await res2.json();
    assert.equal(body2.success, true);
    assert.equal(body2.event_id, eventId);
    // Confirms it was an idempotent replay without executing handler logic again
    assert.equal(res2.headers.get("x-idempotent-replay"), "true");
  });
});

// --------------------------------------------------------------------------
// GAP.4: File Upload Security Policy
// --------------------------------------------------------------------------
test("DEV-81 (GAP.4): detectMimeTypeFromMagicBytes correctly detects genuine file formats", () => {
  const jpegBuffer = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10]);
  assert.equal(detectMimeTypeFromMagicBytes(jpegBuffer), "image/jpeg");

  const pngBuffer = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  assert.equal(detectMimeTypeFromMagicBytes(pngBuffer), "image/png");

  const pdfBuffer = Buffer.from("%PDF-1.4\n%...");
  assert.equal(detectMimeTypeFromMagicBytes(pdfBuffer), "application/pdf");

  // Fake / unknown text buffer
  const textBuffer = Buffer.from("RAW_TEXT_NOT_IMAGE_OR_PDF");
  assert.equal(detectMimeTypeFromMagicBytes(textBuffer), null);
});

test("DEV-81 (GAP.4): validateFileUpload rejects forged MIME types, dangerous extensions, and enforces random names", () => {
  const validPng = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00]);

  // 1. Legitimate PNG file
  const okResult = validateFileUpload({
    buffer: validPng,
    originalFilename: "receipt_2026.png",
    declaredMimeType: "image/png",
  });
  assert.equal(okResult.isValid, true);
  assert.equal(okResult.detectedMimeType, "image/png");
  assert.ok(okResult.sanitizedFilename?.endsWith(".png"));
  // Confirms original filename was completely replaced with a random UUID
  assert.notEqual(okResult.sanitizedFilename, "receipt_2026.png");

  // 2. MIME Spoofing: text script claiming to be image/jpeg
  const plainText = Buffer.from("echo 'some script'");
  const spoofResult = validateFileUpload({
    buffer: plainText,
    originalFilename: "payment_proof.jpg",
    declaredMimeType: "image/jpeg",
  });
  assert.equal(spoofResult.isValid, false);
  assert.match(spoofResult.error, /magic bytes mismatch or unknown format/i);

  // 3. Dangerous / executable file extensions
  const exeResult = validateFileUpload({
    buffer: validPng,
    originalFilename: "dangerous.exe",
    declaredMimeType: "image/png",
  });
  assert.equal(exeResult.isValid, false);
  assert.match(exeResult.error, /File extension '\.exe' is not permitted/i);

  // 4. Double extension bypass attempt (e.g. invoice.exe.png or invoice.sh.png)
  const doubleExtResult = validateFileUpload({
    buffer: validPng,
    originalFilename: "invoice.sh.png",
    declaredMimeType: "image/png",
  });
  assert.equal(doubleExtResult.isValid, false);
  assert.match(doubleExtResult.error, /Dangerous secondary extension '\.sh'/i);

  // 5. Exceeding max size limit
  const largeBuffer = Buffer.alloc(6 * 1024 * 1024); // 6MB
  const sizeResult = validateFileUpload({
    buffer: largeBuffer,
    originalFilename: "large.png",
    maxSizeBytes: 5 * 1024 * 1024,
  });
  assert.equal(sizeResult.isValid, false);
  assert.match(sizeResult.error, /exceeds allowed limit/i);
});
