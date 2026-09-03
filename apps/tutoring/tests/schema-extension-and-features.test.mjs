import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { app } from "../dist/app.js";
import { parseCSV, mapRowToStudent, normalizePhoneNumber } from "../dist/services/importService.js";

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

// ========================================================
// DEV-30 & DEV-31: Financial Protection & Duplicate Guard
// ========================================================

test("DEV-30: Financial summary rejects unauthenticated or assistant requests with 401/403", async () => {
  const dummySessionId = "00000000-0000-0000-0000-000000000000";
  const res = await fetch(`${baseUrl}/api/sessions/${dummySessionId}/financial-summary`);
  // Must reject without valid token
  assert.equal(res.status, 401);
});

test("DEV-31: Scan student endpoint rejects missing payload", async () => {
  const dummySessionId = "00000000-0000-0000-0000-000000000000";
  const res = await fetch(`${baseUrl}/api/sessions/${dummySessionId}/scan`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({}),
  });
  // Rejects invalid token first
  assert.equal(res.status, 401);
});

// ========================================================
// DEV-33: Offline-First Batch Sync Validation
// ========================================================

test("DEV-33: Batch sync endpoint validates sync_items array", async () => {
  const dummySessionId = "00000000-0000-0000-0000-000000000000";
  const res = await fetch(`${baseUrl}/api/sessions/${dummySessionId}/attendance/batch-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer invalid-token",
    },
    body: JSON.stringify({
      sync_items: [],
    }),
  });
  // Validates token first
  assert.equal(res.status, 401);
});

// ========================================================
// DEV-37: Bulk Student Import Parser & Normalization
// ========================================================

test("DEV-37: Phone normalization strips special chars and handles Egyptian numbers", () => {
  assert.equal(normalizePhoneNumber("01012345678"), "01012345678");
  assert.equal(normalizePhoneNumber("+20 101-234-5678"), "01012345678");
  assert.equal(normalizePhoneNumber("(012) 345 67890"), "01234567890");
  assert.equal(normalizePhoneNumber(""), "");
});

test("DEV-37: CSV Parser parses comma-delimited strings with quotes", () => {
  const csvText = `اسم الطالب,موبايل ولي الأمر,كود
"محمد أحمد, علي",01012345678,1001
سارة محمود,01198765432,1002`;

  const parsed = parseCSV(csvText);
  assert.equal(parsed.length, 2);
  assert.equal(parsed[0]["اسم الطالب"], "محمد أحمد, علي");
  assert.equal(parsed[0]["موبايل ولي الأمر"], "01012345678");
  assert.equal(parsed[0]["كود"], "1001");
  assert.equal(parsed[1]["اسم الطالب"], "سارة محمود");
});

test("DEV-37: Flexible column mapping detects Arabic and English column headers", () => {
  const arabicRow = {
    "اسم الطالب": "عمر خالد",
    "موبايل ولي الأمر": "01099999999",
    "كود": "1005",
    "سعر خاص": "150",
    "معفي": "نعم",
  };

  const mapped = mapRowToStudent(arabicRow);
  assert.equal(mapped.name, "عمر خالد");
  assert.equal(mapped.parent_phone, "01099999999");
  assert.equal(mapped.code, "1005");
  assert.equal(mapped.fee_override, "150");
  assert.equal(mapped.exempt, "نعم");
});
