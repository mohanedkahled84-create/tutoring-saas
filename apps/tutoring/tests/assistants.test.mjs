import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../dist/app.js";

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

test("DEV-ASSISTANTS.1: /api/assistants is mounted and rejects unauthenticated GET with 401", async () => {
  const res = await fetch(`${baseUrl}/api/assistants`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error?.code, "UNAUTHORIZED");
});

test("DEV-ASSISTANTS.2: /api/assistants is mounted and rejects unauthenticated POST with 401", async () => {
  const res = await fetch(`${baseUrl}/api/assistants`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "أحمد", phone: "01000000000" }),
  });
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error?.code, "UNAUTHORIZED");
});

test("DEV-ASSISTANTS.3: /api/assistants/:id is mounted and rejects unauthenticated PUT with 401", async () => {
  const res = await fetch(`${baseUrl}/api/assistants/00000000-0000-0000-0000-000000000000`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "أحمد معدل" }),
  });
  assert.equal(res.status, 401);
});

test("DEV-ASSISTANTS.4: /api/assistants/:id is mounted and rejects unauthenticated DELETE with 401", async () => {
  const res = await fetch(`${baseUrl}/api/assistants/00000000-0000-0000-0000-000000000000`, {
    method: "DELETE",
  });
  assert.equal(res.status, 401);
});

test("DEV-ASSISTANTS.5: assistants routes use robust select without unindexed joins", async () => {
  const fs = await import("node:fs");
  const path = await import("node:path");
  const { fileURLToPath } = await import("node:url");
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const src = fs.readFileSync(path.resolve(__dirname, "../src/features/assistants/routes.ts"), "utf8");

  assert.ok(src.includes('.select("*")'), "GET /api/assistants must use select('*') for stability");
  assert.ok(!src.includes("groups:group_id(id, name)"), "Must not use risky PostgREST join syntax that fails without relation cache");
});

