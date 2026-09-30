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

test("DEV-67: Code Uniqueness - rejects duplicate student codes on manual create and update", async () => {
  const repo = new FakeStudentsRepository();
  const service = new StudentsService(repo);

  // Student 1 with code "1055"
  await service.createStudent("tenant-1", {
    name: "حسام حسن",
    parent_phone: "01011112222",
    code: "1055",
  });

  // Attempting Student 2 with duplicate code "1055" in same tenant must fail
  await assert.rejects(
    async () => {
      await service.createStudent("tenant-1", {
        name: "إبراهيم حسن",
        parent_phone: "01033334444",
        code: "1055",
      });
    },
    (err) => err.message.includes("DUPLICATE_STUDENT_CODE") && err.message.includes("1055")
  );

  // Student 3 with different code "1056" succeeds
  const s3 = await service.createStudent("tenant-1", {
    name: "إبراهيم حسن",
    parent_phone: "01033334444",
    code: "1056",
  });
  assert.equal(s3.code, "1056");

  // Updating s3 code to "1055" (held by حسام) must fail
  await assert.rejects(
    async () => {
      await service.updateStudent(s3.id, {
        code: "1055",
      });
    },
    (err) => err.message.includes("DUPLICATE_STUDENT_CODE") && err.message.includes("1055")
  );
});

test("DEV-67: Code Uniqueness - bulkImport rejects duplicate codes within batch and against DB", async () => {
  const repo = new FakeStudentsRepository();
  repo.groups.push({ id: "group-g1", name: "كيمياء 2ث", tenant_id: "tenant-1" });
  const service = new StudentsService(repo);

  // Existing student in DB with code 2001
  await service.createStudent("tenant-1", {
    name: "طالب قديم",
    parent_phone: "01011112222",
    code: "2001",
  });

  const rows = [
    { name: "طالب جديد 1", parent_phone: "01022223333", code: "2001" }, // Duplicate with DB
    { name: "طالب جديد 2", parent_phone: "01044445555", code: "2002" }, // Valid
    { name: "طالب جديد 3", parent_phone: "01066667777", code: "2002" }, // Duplicate with row 2 in same batch
    { name: "طالب جديد 4", parent_phone: "01088889999" }, // Auto-assigned serial, must not collide
  ];

  const result = await service.bulkImport("tenant-1", "group-g1", { rows });

  assert.equal(result.total_rows, 4);
  assert.equal(result.imported_count, 2); // row 2 and row 4
  assert.equal(result.skipped_count, 2);  // row 1 and row 3
  assert.ok(result.errors.some(e => e.row === 1 && e.error.includes("مسجل بالفعل في المنصة")));
  assert.ok(result.errors.some(e => e.row === 3 && e.error.includes("مكرر في الملف نفسه")));
});
