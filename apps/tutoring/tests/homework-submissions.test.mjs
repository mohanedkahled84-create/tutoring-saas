import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import http from "node:http";
import { app } from "../dist/app.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

test("DEV-HW.1: homework routes source code strictly uses student_phone and parent_phone without invalid phone column", async () => {
  const routesPath = path.resolve(__dirname, "../src/features/homework/routes.ts");
  const sourceCode = fs.readFileSync(routesPath, "utf8");

  assert.ok(
    !sourceCode.includes("students(id, name, code, student_code, phone,"),
    "Must not query non-existent phone column from students relation in homework_submissions"
  );
  assert.ok(
    !sourceCode.includes('.select("id, name, code, student_code, phone,'),
    "Must not query non-existent phone column from students table"
  );
  assert.ok(
    sourceCode.includes("student_phone"),
    "Must query valid student_phone column"
  );
});

test("DEV-HW.2: GET /api/homework/submissions rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/homework/submissions`);
  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "UNAUTHORIZED");
});

test("DEV-HW.3: POST /api/homework/submit validates required fields", async () => {
  const res = await fetch(`${baseUrl}/api/homework/submit`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({}),
  });
  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, "VALIDATION_ERROR");
});

test("DEV-HW.4: PUT /api/homework/submissions/:id/review rejects unauthenticated requests with 401", async () => {
  const res = await fetch(`${baseUrl}/api/homework/submissions/fake-id/review`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ status: "approved" }),
  });
  assert.equal(res.status, 401);
});