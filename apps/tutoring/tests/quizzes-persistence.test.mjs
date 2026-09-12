import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { QuizzesService, FakeQuizzesRepository } from "../dist/features/quizzes/index.js";
import { WhatsAppNotificationsService } from "../dist/features/whatsapp-notifications/index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Clean Architecture Check
test("DEV-QUIZ.5: Clean Architecture Rule 1 compliance - service.ts has ZERO direct Supabase imports", () => {
  const servicePath = path.resolve(__dirname, "../src/features/quizzes/service.ts");
  const serviceContent = fs.readFileSync(servicePath, "utf-8");
  assert.ok(
    !serviceContent.includes("@supabase/supabase-js"),
    "quizzes/service.ts must NOT import @supabase/supabase-js directly"
  );
  assert.ok(
    !serviceContent.includes("createClient"),
    "quizzes/service.ts must NOT use createClient"
  );
});

test("DEV-QUIZ.6: QuizzesService lists, seeds default 3 quizzes, and aggregates scores/notes", async () => {
  const repo = new FakeQuizzesRepository();
  const service = new QuizzesService(repo);
  const tenantId = "tenant-quiz-test";
  const groupId = "group-physics-sat";

  // Initially empty -> should auto-seed default 3 quizzes
  const initialData = await service.listGroupQuizzesData(tenantId, groupId);
  assert.equal(initialData.quizzes.length, 3);
  assert.equal(initialData.quizzes[0].title, "كويز 1: أساسيات المادة");
  assert.equal(initialData.quizzes[1].title, "كويز 2: الفصل الأول");
  assert.equal(initialData.quizzes[2].title, "كويز 3: مراجعة شاملة");
  assert.deepEqual(initialData.scores_map, {});
  assert.deepEqual(initialData.notes_map, {});

  // Save scores and notes for quiz 1
  const saveRes = await service.saveScores(tenantId, {
    group_id: groupId,
    quiz_number: 1,
    quiz_title: "كويز 1: أساسيات المادة",
    max_score: 10,
    scores: {
      "student-1": 10,
      "student-2": 8.5,
    },
    notes: {
      "student-1": "ممتاز جداً",
      "student-2": "مستوى طيب",
    },
  });

  assert.equal(saveRes.savedCount, 2);

  // Fetch again and verify persistence
  const updatedData = await service.listGroupQuizzesData(tenantId, groupId);
  assert.equal(updatedData.scores_map[1]["student-1"], 10);
  assert.equal(updatedData.scores_map[1]["student-2"], 8.5);
  assert.equal(updatedData.notes_map[1]["student-1"], "ممتاز جداً");
  assert.equal(updatedData.notes_map[1]["student-2"], "مستوى طيب");
});

test("DEV-QUIZ.7: QuizzesService adds new quiz and toggles skipped state", async () => {
  const repo = new FakeQuizzesRepository();
  const service = new QuizzesService(repo);
  const tenantId = "tenant-quiz-test";
  const groupId = "group-chem";

  const newQuiz = await service.upsertQuiz(tenantId, {
    group_id: groupId,
    quiz_number: 4,
    title: "كويز 4: الديناميكا الحرارية",
    max_score: 20,
    is_skipped: false,
  });

  assert.equal(newQuiz.quiz_number, 4);
  assert.equal(newQuiz.max_score, 20);

  // Skip quiz 4
  const skippedQuiz = await service.upsertQuiz(tenantId, {
    group_id: groupId,
    quiz_number: 4,
    title: "كويز 4: الديناميكا الحرارية",
    max_score: 20,
    is_skipped: true,
  });

  assert.equal(skippedQuiz.is_skipped, true);
});

test("DEV-QUIZ.8: sendQuizScore calls sendPresence with composing before message dispatch", async () => {
  const presenceCalls = [];
  const fakeGateway = {
    async sendPresence(instance, phone, presence) {
      presenceCalls.push({ instance, phone, presence });
      return true;
    },
    async sendTextMessage() {
      return { success: true };
    },
  };

  const fakeRepo = {
    async isMessageDispatched() { return false; },
    async getTemplates() { return []; },
  };

  const service = new WhatsAppNotificationsService(fakeRepo, fakeGateway);

  const res = await service.sendQuizScore({
    tenant_id: "tenant-presence-test",
    student_id: "std-99",
    student_name: "أحمد كمال",
    parent_phone: "01099999999",
    quiz_title: "كويز 1",
    score: 10,
    max_score: 10,
  });

  assert.equal(res.success, true);
  assert.equal(presenceCalls.length, 1);
  assert.equal(presenceCalls[0].presence, "composing");
  assert.equal(presenceCalls[0].phone, "01099999999");
});
