import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { StudentsService } from "../dist/features/students/service.js";
import { FakeStudentsRepository } from "../dist/features/students/repository.js";
import { verifyParentPortalToken } from "../dist/shared/utils/tokens.js";
import { app } from "../dist/app.js";

// ============================================================================
// DEV-PORTAL: Unified Portal Authentication & Auto-Password Test Suite
// ============================================================================

test("DEV-PORTAL: createStudent generates 6-digit numeric portal_password", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  const student = await service.createStudent("tenant-1", {
    name: "عمر خالد",
    phone: "01099887766",
    student_phone: "01099887766",
    parent_phone: "01122334455",
  });

  assert.ok(student.id);
  assert.ok(student.portal_password, "Must have auto-generated portal_password");
  assert.equal(typeof student.portal_password, "string");
  assert.match(student.portal_password, /^\d{6}$/, "Password must be exactly 6 numeric digits");
});

test("DEV-PORTAL: bulkImport auto-generates 6-digit portal_password for all imported rows", async () => {
  const repo = new FakeStudentsRepository();
  repo.groups.push({ id: "group-g1", name: "فيزياء 1ث", tenant_id: "tenant-1" });
  const service = new StudentsService(repo);

  const csvData = `اسم الطالب,ولي الأمر,موبايل الطالب
أحمد طارق,01033334444,01011112222
سارة سامح,01177778888,01155556666`;

  const result = await service.bulkImport("tenant-1", "group-g1", { csv_content: csvData });
  assert.equal(result.imported_count, 2);

  const allStudents = await repo.list("tenant-1");
  assert.equal(allStudents.length, 2);
  for (const s of allStudents) {
    assert.ok(s.portal_password, `Student ${s.name} must have portal_password`);
    assert.match(s.portal_password, /^\d{6}$/, "Must be 6 numeric digits");
  }
});

test("DEV-PORTAL: findByIdentifier resolves student by phone, parent phone, or student code", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  const student = await service.createStudent("tenant-1", {
    name: "كريم ممدوح",
    phone: "01012345678",
    student_phone: "01012345678",
    parent_phone: "01234567890",
  });

  // By student phone
  const byStudentPhone = await repo.findByIdentifier("01012345678");
  assert.ok(byStudentPhone);
  assert.equal(byStudentPhone.id, student.id);

  // By formatted student phone
  const byFormatted = await repo.findByIdentifier("010-1234-5678");
  assert.ok(byFormatted);
  assert.equal(byFormatted.id, student.id);

  // By parent phone
  const byParentPhone = await repo.findByIdentifier("01234567890");
  assert.ok(byParentPhone);
  assert.equal(byParentPhone.id, student.id);

  // By student code
  const byCode = await repo.findByIdentifier(student.student_code);
  assert.ok(byCode);
  assert.equal(byCode.id, student.id);

  // Non-existent identifier
  const notFound = await repo.findByIdentifier("01599999999");
  assert.equal(notFound, null);
});

test("DEV-PORTAL: authenticatePortalUser correctly authenticates and determines student vs parent role", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  const student = await service.createStudent("tenant-1", {
    name: "محمود حسن",
    phone: "01055551111",
    student_phone: "01055551111",
    parent_phone: "01055552222",
  });

  const password = student.portal_password;

  // 1. Authenticate with student phone -> role must be 'student'
  const studentAuth = await service.authenticatePortalUser({
    identifier: "01055551111",
    password,
  });
  assert.equal(studentAuth.success, true);
  assert.equal(studentAuth.role, "student");
  assert.ok(studentAuth.token);
  assert.equal(studentAuth.student.id, student.id);

  // Verify HMAC token validity
  const verifiedStudentToken = verifyParentPortalToken(studentAuth.token);
  assert.ok(verifiedStudentToken);
  assert.equal(verifiedStudentToken.student_id, student.id);
  assert.equal(verifiedStudentToken.tenant_id, "tenant-1");

  // 2. Authenticate with parent phone -> role must be 'parent'
  const parentAuth = await service.authenticatePortalUser({
    identifier: "01055552222",
    password,
  });
  assert.equal(parentAuth.success, true);
  assert.equal(parentAuth.role, "parent");
  assert.ok(parentAuth.token);
  assert.equal(parentAuth.student.id, student.id);

  // 3. Authenticate with student code -> defaults to 'parent'
  const codeAuth = await service.authenticatePortalUser({
    identifier: student.student_code,
    password,
  });
  assert.equal(codeAuth.success, true);
  assert.equal(codeAuth.role, "parent");

  // 4. Invalid password rejects with INVALID_CREDENTIALS
  await assert.rejects(
    () => service.authenticatePortalUser({ identifier: "01055551111", password: "wrong-password" }),
    { message: "INVALID_CREDENTIALS" }
  );

  // 5. Non-existent phone rejects with INVALID_CREDENTIALS
  await assert.rejects(
    () => service.authenticatePortalUser({ identifier: "01099990000", password }),
    { message: "INVALID_CREDENTIALS" }
  );

  // 6. Missing credentials rejects with MISSING_CREDENTIALS
  await assert.rejects(
    () => service.authenticatePortalUser({ identifier: "", password: "" }),
    { message: "MISSING_CREDENTIALS" }
  );
});

test("DEV-PORTAL: changePortalPassword updates password and verifies old vs new", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  const student = await service.createStudent("tenant-1", {
    name: "يوسف إبراهيم",
    phone: "01077778888",
    student_phone: "01077778888",
  });

  const originalPass = student.portal_password;

  // Rejects invalid old password
  await assert.rejects(
    () => service.changePortalPassword(student.id, "wrong-pass", "998877"),
    { message: "INVALID_OLD_PASSWORD" }
  );

  // Rejects too short new password (< 4)
  await assert.rejects(
    () => service.changePortalPassword(student.id, originalPass, "12"),
    { message: "PASSWORD_TOO_SHORT" }
  );

  // Successfully changes password
  await service.changePortalPassword(student.id, originalPass, "654321");

  // Old password now fails
  await assert.rejects(
    () => service.authenticatePortalUser({ identifier: "01077778888", password: originalPass }),
    { message: "INVALID_CREDENTIALS" }
  );

  // New password succeeds
  const newAuth = await service.authenticatePortalUser({ identifier: "01077778888", password: "654321" });
  assert.equal(newAuth.success, true);
});

// ============================================================================
// DEV-PORTAL: HTTP API Endpoints (/api/public/portal/login & change-password)
// ============================================================================

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

test("DEV-PORTAL HTTP: POST /api/public/portal/login rejects missing credentials", async () => {
  const res = await fetch(`${baseUrl}/api/public/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "", password: "" }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, "BAD_REQUEST");
});

test("DEV-PORTAL HTTP: POST /api/public/portal/login rejects invalid credentials with 401", async () => {
  const res = await fetch(`${baseUrl}/api/public/portal/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ identifier: "01000000000", password: "wrong" }),
  });

  assert.equal(res.status, 401);
  const data = await res.json();
  assert.equal(data.error.code, "INVALID_CREDENTIALS");
  assert.ok(data.error.message.includes("غير صحيحة"));
});

test("DEV-PORTAL HTTP: POST /api/public/portal/change-password validates input", async () => {
  const res = await fetch(`${baseUrl}/api/public/portal/change-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ student_id: "", new_password: "" }),
  });

  assert.equal(res.status, 400);
  const data = await res.json();
  assert.equal(data.error.code, "BAD_REQUEST");
});
