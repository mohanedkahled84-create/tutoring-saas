import test from "node:test";
import assert from "node:assert/strict";
import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertServiceRoleReady, createIsolatedSupabaseClients, requireIsolatedSupabaseProject } from "./helpers/live-supabase.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, "../.env") });

test("C-01: RLS Tenant Isolation & Anon Rejection", async (t) => {
  if (!requireIsolatedSupabaseProject(t)) return;

  const { anonClient, serviceClient } = createIsolatedSupabaseClients();
  await assertServiceRoleReady(serviceClient);
  for (const table of ["study_materials", "message_templates", "quizzes", "homework_submissions", "teachers", "assistants", "rooms"]) {
    const { error } = await serviceClient.from(table).select("id").limit(0);
    assert.equal(error, null, `Required security-test table ${table} must exist: ${error?.message ?? "unknown error"}`);
  }

  // 1. Anon MUST NOT be able to read private study_materials (non-homework)
  const { data: anonMaterials, error: anonMatErr } = await anonClient
    .from("study_materials")
    .select("*")
    .eq("is_homework", false);
  assert.ok(anonMatErr || (anonMaterials?.length || 0) === 0, "Anon must not read any non-homework study materials");

  // 2. Anon MUST NOT be able to insert into study_materials
  const fakeTenantId = "00000000-0000-0000-0000-000000000001";
  const { error: anonMatInsertErr } = await anonClient
    .from("study_materials")
    .insert({
      tenant_id: fakeTenantId,
      title: "Exploit Study Material",
      type: "pdf",
      url: "https://example.com/exploit.pdf"
    });
  assert.ok(anonMatInsertErr, "Anon insert on study_materials must be rejected by RLS");

  // 3. Anon MUST NOT be able to read message_templates
  const { data: anonTemplates, error: anonTemplateErr } = await anonClient
    .from("message_templates")
    .select("*");
  assert.ok(anonTemplateErr || (anonTemplates?.length || 0) === 0, "Anon must not read any message templates");

  // 4. Anon MUST NOT be able to insert into message_templates
  const { error: anonTplInsertErr } = await anonClient
    .from("message_templates")
    .insert({
      tenant_id: fakeTenantId,
      template_type: "exploit",
      variants: ["hello"]
    });
  assert.ok(anonTplInsertErr, "Anon insert on message_templates must be rejected by RLS");

  // 5. Anon MUST NOT be able to read quizzes
  const { data: anonQuizzes, error: anonQuizErr } = await anonClient
    .from("quizzes")
    .select("*");
  assert.ok(anonQuizErr || (anonQuizzes?.length || 0) === 0, "Anon must not read quizzes");

  // 6. Anon MUST NOT be able to read or modify homework_submissions
  const { data: anonSubmissions, error: anonSubmissionErr } = await anonClient
    .from("homework_submissions")
    .select("*");
  assert.ok(anonSubmissionErr || (anonSubmissions?.length || 0) === 0, "Anon must not read homework submissions");

  const { error: anonSubInsertErr } = await anonClient
    .from("homework_submissions")
    .insert({
      tenant_id: fakeTenantId,
      material_id: "00000000-0000-0000-0000-000000000002",
      student_id: "00000000-0000-0000-0000-000000000003",
      file_url: "https://example.com/malicious.pdf"
    });
  assert.ok(anonSubInsertErr, "Anon direct insert on homework_submissions must be rejected by RLS");

  // 7. Anon MUST NOT be able to insert or update teachers, assistants, rooms
  const { error: anonTeacherErr } = await anonClient
    .from("teachers")
    .insert({
      tenant_id: fakeTenantId,
      name: "Anon Exploit Teacher",
      phone: "01000000000",
      revenue_model: "percentage",
      revenue_value: 20
    });
  assert.ok(anonTeacherErr, "Anon insert on teachers must be rejected by RLS");

  const { error: anonRoomErr } = await anonClient
    .from("rooms")
    .insert({
      tenant_id: fakeTenantId,
      name: "Anon Exploit Room",
      capacity: 10
    });
  assert.ok(anonRoomErr, "Anon insert on rooms must be rejected by RLS");
});
