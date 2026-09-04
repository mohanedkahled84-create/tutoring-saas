import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../dist/app.js";
import { config } from "../dist/shared/config/index.js";

let server;
let baseUrl;

test.before((t, done) => {
  server = http.createServer(app);
  server.listen(0, () => {
    const port = server.address().port;
    baseUrl = `http://localhost:${port}`;
    done();
  });
});

test.after((t, done) => {
  server.close(done);
});

test("DEV-WPA.1: Internal endpoints reject requests without authorization", async () => {
  const getRes = await fetch(`${baseUrl}/internal/tenants/00000000-0000-0000-0000-000000000000/whatsapp-connection`);
  assert.equal(getRes.status, 401);
  const getJson = await getRes.json();
  assert.match(getJson.error, /Missing or invalid Authorization/i);

  const postRes = await fetch(`${baseUrl}/internal/message-logs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(postRes.status, 401);
});

test("DEV-WPA.1: Internal endpoints reject invalid shared secret", async () => {
  const res = await fetch(`${baseUrl}/internal/tenants/00000000-0000-0000-0000-000000000000/whatsapp-connection`, {
    headers: {
      Authorization: "Bearer wrong-secret",
    },
  });
  assert.equal(res.status, 401);
  const json = await res.json();
  assert.match(json.error, /Invalid internal secret/i);
});

test("DEV-WPA.1: Valid shared secret accesses whatsapp-connection endpoint", async () => {
  const dummyTenantId = "00000000-0000-0000-0000-000000000000";
  const res = await fetch(`${baseUrl}/internal/tenants/${dummyTenantId}/whatsapp-connection`, {
    headers: {
      Authorization: `Bearer ${config.internalApiSecret}`,
    },
  });
  // Since this dummy tenant doesn't exist, it should authenticate and return 404 (not 401)
  assert.equal(res.status, 404);
  const json = await res.json();
  assert.match(json.error.message, /WhatsApp connection not found/i);
  assert.equal(json.error.code, "NOT_FOUND");
});

test("DEV-WPA.1: POST /internal/message-logs validates payload fields via Zod", async () => {
  const res = await fetch(`${baseUrl}/internal/message-logs`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${config.internalApiSecret}`,
    },
    body: JSON.stringify({
      tenant_id: "00000000-0000-0000-0000-000000000000",
      // missing required fields
    }),
  });
  assert.equal(res.status, 400);
  const json = await res.json();
  assert.equal(json.error.code, "VALIDATION_ERROR");
  assert.ok(json.error.details.length > 0);
});
