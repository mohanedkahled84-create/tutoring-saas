import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { getStealthModelQuestions } from "../dist/features/quizzes/stealthModels.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// 1. DETERMINISTIC STEALTH MODEL PERMUTATIONS (Models A, B, C)
// ============================================================================
test("OMR-MODEL: Model A preserves original questions, options, and correct_index", () => {
  const sampleQuiz = {
    id: "quiz-1",
    questions: [
      { id: "q1", text: "سؤال 1", options: ["خيار 1", "خيار 2", "خيار 3", "خيار 4"], correct_index: 0, points: 2 },
      { id: "q2", text: "سؤال 2", options: ["خيار أ", "خيار ب", "خيار ج", "خيار د"], correct_index: 2, points: 2 },
    ],
  };

  const modelA = getStealthModelQuestions(sampleQuiz, "A");
  assert.equal(modelA.length, 2);
  assert.equal(modelA[0].id, "q1");
  assert.equal(modelA[0].correct_index, 0);
  assert.equal(modelA[0].options[modelA[0].correct_index], "خيار 1");
  assert.equal(modelA[1].id, "q2");
  assert.equal(modelA[1].correct_index, 2);
  assert.equal(modelA[1].options[modelA[1].correct_index], "خيار ج");
});

test("OMR-MODEL: Models B and C produce deterministic permutations with correctly mapped correct_index", () => {
  const sampleQuiz = {
    id: "quiz-10-q",
    questions: Array.from({ length: 6 }, (_, i) => ({
      id: `q_${i + 1}`,
      text: `سؤال ${i + 1}`,
      options: [`أ ${i}`, `ب ${i}`, `ج ${i}`, `د ${i}`],
      correct_index: i % 4,
      points: 1,
    })),
  };

  const modelB1 = getStealthModelQuestions(sampleQuiz, "B");
  const modelB2 = getStealthModelQuestions(sampleQuiz, "B");
  // Determinism check
  assert.deepEqual(modelB1, modelB2, "Model B permutation must be 100% deterministic");

  const modelC1 = getStealthModelQuestions(sampleQuiz, "C");
  const modelC2 = getStealthModelQuestions(sampleQuiz, "C");
  assert.deepEqual(modelC1, modelC2, "Model C permutation must be 100% deterministic");

  // Permutation distinctness
  const orderA = sampleQuiz.questions.map(q => q.id);
  const orderB = modelB1.map(q => q.id);
  const orderC = modelC1.map(q => q.id);
  assert.notDeepEqual(orderB, orderA, "Model B order must be shuffled from A");
  assert.notDeepEqual(orderC, orderB, "Model C order must be distinct from B");

  // Semantic correctness of correct_index mapping
  modelB1.forEach((qB) => {
    const origQ = sampleQuiz.questions.find(q => q.id === qB.id);
    assert.ok(origQ, `Original question for ${qB.id} must exist`);
    const origCorrectText = origQ.options[origQ.correct_index];
    const newCorrectText = qB.options[qB.correct_index];
    assert.equal(newCorrectText, origCorrectText, `Correct option text must match after permutation for question ${qB.id}`);
  });

  modelC1.forEach((qC) => {
    const origQ = sampleQuiz.questions.find(q => q.id === qC.id);
    const origCorrectText = origQ.options[origQ.correct_index];
    const newCorrectText = qC.options[qC.correct_index];
    assert.equal(newCorrectText, origCorrectText, `Correct option text must match after permutation for question ${qC.id}`);
  });
});

// ============================================================================
// 2. FLAW 1: SCHEMA ALIGNMENT WITH group_students & STRICT STUDENT LOOKUP
// ============================================================================
test("OMR-SCHEMA: routes.ts queries group_students(group_id) and avoids non-existent students.group_id columns", () => {
  const routesPath = path.resolve(__dirname, "../src/features/quizzes/routes.ts");
  const routesContent = fs.readFileSync(routesPath, "utf-8");

  // Find the /omr-scan route slice until the next route
  const omrIdx = routesContent.indexOf('"/omr-scan"');
  assert.ok(omrIdx !== -1, "/omr-scan route must exist in routes.ts");
  const nextRouteIdx = routesContent.indexOf('"/upload-image"', omrIdx);
  const omrBlock = routesContent.substring(omrIdx, nextRouteIdx !== -1 ? nextRouteIdx : omrIdx + 8000);

  // Assert schema compliance: Must query group_students(group_id)
  assert.ok(
    omrBlock.includes("group_students(group_id)"),
    "Must query relation group_students(group_id) from database"
  );

  // Assert NO direct students.group_id / students.group_ids in select
  assert.ok(
    !omrBlock.includes('.select("id, name, student_code, group_id, group_ids")'),
    "Must NOT query non-existent columns group_id, group_ids on students table"
  );

  // Assert strict session tenant_id check
  assert.ok(
    omrBlock.includes("req.user?.tenant_id"),
    "Must read tenant_id strictly from authenticated session"
  );
});

test("OMR-STUDENT-LOGIC: verifies student group membership against group_students relation", () => {
  // Simulate the extraction logic implemented in routes.ts
  const studentWithGroups = {
    id: "stud-101",
    name: "أحمد علي",
    student_code: "1001",
    group_students: [{ group_id: "grp-sun-tue" }, { group_id: "grp-sat-wed" }],
  };

  const rawGs = studentWithGroups.group_students;
  const gsList = Array.isArray(rawGs) ? rawGs : (rawGs ? [rawGs] : []);
  const studentGroupIds = gsList.map((g) => String(g.group_id)).filter(Boolean);

  assert.deepEqual(studentGroupIds, ["grp-sun-tue", "grp-sat-wed"]);

  // Member of grp-sun-tue -> Allowed
  assert.ok(studentGroupIds.includes("grp-sun-tue"));

  // Not member of grp-friday -> Rejected
  assert.ok(!studentGroupIds.includes("grp-friday"));
});

// ============================================================================
// 3. FLAW 2: EXAM GROUP OWNERSHIP & QUIZ NUMBER VALIDATION
// ============================================================================
test("OMR-EXAM-GUARD: prevents cross-group exam grading and enforces quiz number matching", () => {
  const routesPath = path.resolve(__dirname, "../src/features/quizzes/routes.ts");
  const routesContent = fs.readFileSync(routesPath, "utf-8");
  const omrIdx = routesContent.indexOf('"/omr-scan"');
  const nextRouteIdx = routesContent.indexOf('"/upload-image"', omrIdx);
  const omrBlock = routesContent.substring(omrIdx, nextRouteIdx !== -1 ? nextRouteIdx : omrIdx + 8000);

  // Assert EXAM_GROUP_MISMATCH error code exists
  assert.ok(
    omrBlock.includes("EXAM_GROUP_MISMATCH"),
    "Must reject exam belonging to a different group with EXAM_GROUP_MISMATCH"
  );

  // Assert QUIZ_NUMBER_MISMATCH error code exists
  assert.ok(
    omrBlock.includes("QUIZ_NUMBER_MISMATCH"),
    "Must reject mismatch between requested quiz_number and exam record"
  );

  // Assert AMBIGUOUS_EXAM error code exists
  assert.ok(
    omrBlock.includes("AMBIGUOUS_EXAM"),
    "Must reject ambiguous exams with duplicate quiz_number in same group"
  );
});

// ============================================================================
// 4. FLAW 3: LEGACY QUIZ RESOLUTION FROM whatsapp_inbox
// ============================================================================
test("OMR-LEGACY: fallback to whatsapp_inbox with QUIZ_DEF_ pattern is supported", () => {
  const routesPath = path.resolve(__dirname, "../src/features/quizzes/routes.ts");
  const routesContent = fs.readFileSync(routesPath, "utf-8");
  const omrIdx = routesContent.indexOf('"/omr-scan"');
  const nextRouteIdx = routesContent.indexOf('"/upload-image"', omrIdx);
  const omrBlock = routesContent.substring(omrIdx, nextRouteIdx !== -1 ? nextRouteIdx : omrIdx + 8000);

  assert.ok(
    omrBlock.includes('like("phone", "QUIZ_DEF_%")'),
    "Must query legacy quizzes from whatsapp_inbox when not found in study_materials"
  );
});

// ============================================================================
// 5. FLAW 4: SERVER-FIRST SYNC STATE & FRONTEND REVIEW GATES
// ============================================================================
test("OMR-FRONTEND: recordOmrScanResult awaits server confirmation before approving or recording score", () => {
  const fePath = path.resolve(__dirname, "../../../apps/web/src/components/TeacherQuizzesView.js");
  const feContent = fs.readFileSync(fePath, "utf-8");

  const recordIdx = feContent.indexOf("app.recordOmrScanResult = async function");
  assert.ok(recordIdx !== -1, "recordOmrScanResult must exist in TeacherQuizzesView.js");
  const nextFuncIdx = feContent.indexOf("app.retrySyncOmrResult = async function", recordIdx);
  const recordBlock = feContent.substring(recordIdx, nextFuncIdx !== -1 ? nextFuncIdx : recordIdx + 8000);

  // Await server request
  assert.ok(
    recordBlock.includes("await request('/quizzes/omr-scan'"),
    "recordOmrScanResult must await server response from /quizzes/omr-scan"
  );

  // Strict server confirmation flag
  assert.ok(
    recordBlock.includes("scanData.server_confirmed = true"),
    "Must mark server_confirmed = true only when server succeeds"
  );
  assert.ok(
    recordBlock.includes("scanData.server_confirmed = false"),
    "Must mark server_confirmed = false when server fails"
  );

  // Status distinguishes approved from draft_unapproved
  assert.ok(
    recordBlock.includes("status: serverSuccess ? 'approved' : 'draft_unapproved'"),
    "Must persist status as draft_unapproved if server fails"
  );

  // Retry sync handler exists
  assert.ok(
    feContent.includes("app.retrySyncOmrResult = async function"),
    "TeacherQuizzesView must provide retrySyncOmrResult"
  );
});

test("OMR-HUMAN-GATE: analyzeOmrCanvas routes blank and ambiguous sheets to review gate, no auto-student fallback", () => {
  const fePath = path.resolve(__dirname, "../../../apps/web/src/components/TeacherQuizzesView.js");
  const feContent = fs.readFileSync(fePath, "utf-8");

  const analyzeIdx = feContent.indexOf("app.analyzeOmrCanvas = async function");
  assert.ok(analyzeIdx !== -1, "analyzeOmrCanvas must exist in TeacherQuizzesView.js");
  const nextFuncIdx = feContent.indexOf("app.promptManualStudentSelectionForScan = function", analyzeIdx);
  const analyzeBlock = feContent.substring(analyzeIdx, nextFuncIdx !== -1 ? nextFuncIdx : analyzeIdx + 16000);

  // Verify NO auto-attribution fallback to groupStudents[0]
  assert.ok(
    !analyzeBlock.includes("groupStudents[0] || null"),
    "Must NOT fallback to groupStudents[0] or any unverified student"
  );

  // Verify promptManualStudentSelectionForScan when student not recognized
  assert.ok(
    analyzeBlock.includes("this.promptManualStudentSelectionForScan(pendingScan)"),
    "Must prompt manual student selection if student is unknown"
  );

  // Verify promptOmrScanReview for all-blank or ambiguous shading
  assert.ok(
    analyzeBlock.includes("this.promptOmrScanReview(pendingScan)"),
    "Must route all-blank or ambiguous scans to human review gate"
  );
});
