import test from "node:test";
import assert from "node:assert/strict";
import {
  StudentsService,
  FakeStudentsRepository,
  parseCSV,
  mapRowToStudent,
  normalizePhoneNumber,
  isValidEgyptianPhone,
  generateBarcodeSheetPdf,
} from "../dist/features/students/index.js";

test("DEV-67: StudentsService - listStudents filters by tenant and search query", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  await repo.create("tenant-1", { name: "عمر خالد", parent_phone: "01011112222", code: "1001" });
  await repo.create("tenant-1", { name: "سارة محمود", parent_phone: "01122223333", code: "1002" });
  await repo.create("tenant-2", { name: "أحمد علي", parent_phone: "01233334444", code: "2001" });

  // Tenant 1 listing
  const t1List = await service.listStudents("tenant-1");
  assert.equal(t1List.length, 2);

  // Search by name query
  const searchResult = await service.listStudents("tenant-1", "سارة");
  assert.equal(searchResult.length, 1);
  assert.equal(searchResult[0].name, "سارة محمود");

  // Search by code query
  const codeResult = await service.listStudents("tenant-1", "1001");
  assert.equal(codeResult.length, 1);
  assert.equal(codeResult[0].name, "عمر خالد");
});

test("DEV-67: StudentsService - createStudent enforces tenant context and stores details", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  // Rejects when no tenant context and not admin
  await assert.rejects(
    async () => {
      await service.createStudent(undefined, {
        name: "طالب جديد",
        parent_phone: "01099998888",
      });
    },
    { message: "NO_TENANT_CONTEXT" }
  );

  // Succeeds with tenantId
  const created = await service.createStudent("tenant-1", {
    name: "طارق سليم",
    parent_phone: "01099998888",
    fee_override: 150,
    exempt: false,
  });

  assert.ok(created.id);
  assert.equal(created.name, "طارق سليم");
  assert.equal(created.fee_override, 150);
});

test("DEV-67: StudentsService - updateStudent and deleteStudent manage lifecycle", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  const initial = await repo.create("tenant-1", {
    name: "كريم يوسف",
    parent_phone: "01111112222",
  });

  const updated = await service.updateStudent(initial.id, {
    name: "كريم يوسف المعدل",
    notes: "طالب متفوق",
    exempt: true,
  });

  assert.ok(updated);
  assert.equal(updated?.name, "كريم يوسف المعدل");
  assert.equal(updated?.exempt, true);
  assert.equal(updated?.notes, "طالب متفوق");

  // Delete
  await service.deleteStudent(initial.id);
  const foundAfterDelete = await service.getStudent(initial.id);
  assert.equal(foundAfterDelete, null);
});

test("DEV-67: StudentsService - publicRegister registers and enrolls student into target group", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  const res = await service.publicRegister({
    tenant_id: "tenant-1",
    name: "منة الله هاني",
    parent_phone: "01511112222",
    student_phone: "01522223333",
    group_id: "group-101",
  });

  assert.equal(res.verification_message_queued, true);
  assert.equal(res.student.name, "منة الله هاني");
  assert.equal(repo.groupEnrollments.length, 1);
  assert.equal(repo.groupEnrollments[0].group_id, "group-101");
  assert.equal(repo.groupEnrollments[0].student_id, res.student.id);
});

test("DEV-67: StudentsService - bulkImport parses CSV with Arabic headers and auto-increments serial", async () => {
  const repo = new FakeStudentsRepository();
  repo.groups.push({ id: "group-g1", name: "فيزياء 1ث", tenant_id: "tenant-1" });
  const service = new StudentsService(repo);

  const csv = `اسم الطالب,ولي الأمر,موبايل الطالب,مصاريف,معفي
أحمد سعيد,01012345678,01123456789,120,لا
محمود شاكر,01234567890,,0,نعم`;

  const result = await service.bulkImport("tenant-1", "group-g1", { csv_content: csv });

  assert.equal(result.total_rows, 2);
  assert.equal(result.imported_count, 2);
  assert.equal(result.skipped_count, 0);
  assert.equal(result.imported_students[0].code, "1001");
  assert.equal(result.imported_students[0].fee_override, 120);
  assert.equal(result.imported_students[0].exempt, false);
  assert.equal(result.imported_students[1].code, "1002");
  assert.equal(result.imported_students[1].exempt, true);

  // Group enrollments
  assert.equal(repo.groupEnrollments.length, 2);
});

test("DEV-67: StudentsService - bulkImport isolates row errors without halting batch", async () => {
  const repo = new FakeStudentsRepository();
  repo.groups.push({ id: "group-g1", name: "مجموعة لغات", tenant_id: "tenant-1" });
  const service = new StudentsService(repo);

  const rows = [
    { name: "طالب صالح", parent_phone: "+20 10 12345678" },
    { name: "", parent_phone: "01011112222" }, // Missing name
    { name: "هاتف خطأ", parent_phone: "01999999999" }, // Invalid Egyptian phone prefix 019
    { name: "طالب صالح 2", parent_phone: "00201122334455" },
  ];

  const result = await service.bulkImport("tenant-1", "group-g1", { rows });

  assert.equal(result.total_rows, 4);
  assert.equal(result.imported_count, 2);
  assert.equal(result.skipped_count, 2);
  assert.equal(result.errors.length, 2);
  assert.equal(result.errors[0].row, 2);
  assert.equal(result.errors[1].row, 3);
});

test("DEV-67: generateBarcodeSheetPdf generates valid A4 PDF buffer", async () => {
  const buffer = await generateBarcodeSheetPdf({
    group_name: "مجموعة الرياضيات",
    students: [
      { id: "s-1", name: "طالب 1", student_code: "1001" },
      { id: "s-2", name: "طالب 2", student_code: "1002" },
    ],
  });

  assert.ok(Buffer.isBuffer(buffer));
  assert.ok(buffer.length > 500);
  assert.equal(buffer.subarray(0, 4).toString(), "%PDF");
});
