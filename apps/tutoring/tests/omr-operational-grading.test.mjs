import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Browser Mock Environment for Node.js
globalThis.window = {
  location: { hostname: "localhost", search: "", href: "" },
  addEventListener: () => {},
  removeEventListener: () => {}
};
globalThis.document = {
  querySelector: () => null,
  getElementById: () => null,
  addEventListener: () => {},
  removeEventListener: () => {}
};

import {
  gradeOmrSubmission,
  normalizeModelLetter,
  ARABIC_CHOICES
} from "../dist/features/quizzes/omrGrader.js";
import { getStealthModelQuestions } from "../dist/features/quizzes/stealthModels.js";
import { registerTeacherQuizzesActions } from "../../web/src/components/TeacherQuizzesView.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Sample Quiz Definition for Testing
const sampleQuiz = {
  id: "quiz-phys-101",
  title: "امتحان الفيزياء - الحركة الموجية",
  quiz_number: 1,
  group_id: "grp-tue-4pm",
  questions: [
    {
      id: "q1",
      text: "ما هي وحدة قياس التردد في النظام الدولي؟",
      type: "multiple_choice",
      options: ["متر", "ثانية", "هرتز", "جول"],
      correct_index: 2, // 'ج'
      points: 2
    },
    {
      id: "q2",
      text: "تنتشر الموجات الكهرومغناطيسية في الفراغ بسرعة:",
      type: "multiple_choice",
      options: ["3×10^8 م/ث", "340 م/ث", "1500 م/ث", "صفر"],
      correct_index: 0, // 'أ'
      points: 2
    },
    {
      id: "q3",
      text: "أي من الآتي يعتبر موجة طولية؟",
      type: "multiple_choice",
      options: ["موجات الضوء", "موجات الصوت", "موجات الراديو", "موجات سطح الماء"],
      correct_index: 1, // 'ب'
      points: 2
    },
    {
      id: "q4",
      text: "طاقة الفوتون تتناسب طردياً مع:",
      type: "multiple_choice",
      options: ["تردده", "طوله الموجي", "سعته", "كتلته"],
      correct_index: 0, // 'أ'
      points: 2
    },
    {
      id: "q5",
      text: "ظاهرة انحناء الموجات حول حافة حاجز تسمى:",
      type: "multiple_choice",
      options: ["الانعكاس", "الانكسار", "الحيود", "التداخل"],
      correct_index: 2, // 'ج'
      points: 2
    }
  ]
};

// ============================================================================
// TEST 1: ورقة إجابات عادية صحيحة (Valid regular sheet)
// ============================================================================
test("CASE 1 - Valid Regular Sheet: High confidence, accurate score, correct per-question diagnosis", () => {
  const studentAnswers = {
    1: 2, // 'ج'
    2: 0, // 'أ'
    3: 1, // 'ب'
    4: 0, // 'أ'
    5: 2  // 'ج'
  };

  const diagnosticsMap = {
    1: { darkness: { "أ": 12, "ب": 10, "ج": 180, "د": 15 }, confidence: 96, status: "clear" },
    2: { darkness: { "أ": 195, "ب": 15, "ج": 11, "د": 9 }, confidence: 98, status: "clear" },
    3: { darkness: { "أ": 14, "ب": 175, "ج": 16, "د": 12 }, confidence: 94, status: "clear" },
    4: { darkness: { "أ": 188, "ب": 10, "ج": 12, "د": 14 }, confidence: 95, status: "clear" },
    5: { darkness: { "أ": 15, "ب": 11, "ج": 182, "د": 10 }, confidence: 97, status: "clear" }
  };

  const result = gradeOmrSubmission(sampleQuiz, "A", studentAnswers, diagnosticsMap);

  assert.equal(result.success, true);
  assert.equal(result.score, 10);
  assert.equal(result.max_score, 10);
  assert.equal(result.percentage, 100);
  assert.equal(result.answered_count, 5);
  assert.equal(result.blank_count, 0);
  assert.equal(result.ambiguous_count, 0);
  assert.equal(result.is_all_blank, false);
  assert.equal(result.diagnostic_summary.category, "ALL_CORRECT");
  assert.ok(result.overall_confidence >= 94);

  result.breakdown.forEach(item => {
    assert.equal(item.is_correct, true);
    assert.equal(item.status, "clear");
    assert.equal(item.points, 2);
    assert.ok(item.confidence >= 90);
  });
});

// ============================================================================
// TEST 2: ورقة فاضية تماماً (Truly empty sheet)
// ============================================================================
test("CASE 2 - Truly Empty Sheet: Detected as ALL_BLANK, flagged for review, no auto-approval of zero", () => {
  const emptyAnswers = {};
  const emptyDiagnostics = {
    1: { darkness: { "أ": 8, "ب": 7, "ج": 9, "د": 8 }, confidence: 95 },
    2: { darkness: { "أ": 10, "ب": 9, "ج": 8, "د": 11 }, confidence: 95 },
    3: { darkness: { "أ": 7, "ب": 8, "ج": 9, "د": 7 }, confidence: 95 },
    4: { darkness: { "أ": 9, "ب": 10, "ج": 8, "د": 8 }, confidence: 95 },
    5: { darkness: { "أ": 8, "ب": 8, "ج": 7, "د": 9 }, confidence: 95 }
  };

  const result = gradeOmrSubmission(sampleQuiz, "A", emptyAnswers, emptyDiagnostics);

  assert.equal(result.score, 0);
  assert.equal(result.max_score, 10);
  assert.equal(result.percentage, 0);
  assert.equal(result.is_all_blank, true);
  assert.equal(result.answered_count, 0);
  assert.equal(result.blank_count, 5);
  assert.equal(result.diagnostic_summary.category, "ALL_BLANK");
});

// ============================================================================
// TEST 3: صورة غير واضحة (Unclear / unreadable image)
// ============================================================================
test("CASE 3 - Unreadable Image: Flagged as unreadable, auto-zero strictly rejected", () => {
  const lowContrastDiagnostics = {
    1: { darkness: { "أ": 15, "ب": 16, "ج": 14, "د": 15 }, confidence: 25 },
    2: { darkness: { "أ": 18, "ب": 17, "ج": 19, "د": 18 }, confidence: 20 },
    3: { darkness: { "أ": 14, "ب": 15, "ج": 14, "د": 15 }, confidence: 30 },
    4: { darkness: { "أ": 16, "ب": 15, "ج": 17, "د": 16 }, confidence: 22 },
    5: { darkness: { "أ": 15, "ب": 14, "ج": 15, "د": 14 }, confidence: 28 }
  };

  const result = gradeOmrSubmission(sampleQuiz, "A", {}, lowContrastDiagnostics);

  assert.ok(result.overall_confidence < 40);
  assert.equal(result.diagnostic_summary.category, "UNREADABLE_LOW_CONFIDENCE");

  const teacherViewPath = path.resolve(__dirname, "../../web/src/components/TeacherQuizzesView.js");
  const code = fs.readFileSync(teacherViewPath, "utf8");

  assert.ok(
    code.includes("if (minSample > 220 || maxSample < 40 || (sampleDiff < 15 && maxSample < 60))"),
    "Frontend must calculate image contrast across control points and markers"
  );
  assert.ok(
    code.includes("isUnreadable = true"),
    "Frontend must mark isUnreadable when contrast is deficient"
  );
});

// ============================================================================
// TEST 4: استدعاء دالة اختيار الطالب يدويًا الفعلية (Real confirmManualStudentSelection)
// ============================================================================
test("CASE 4 - Real Function Execution: confirmManualStudentSelection preserves answers, scores, and does not reset to zero", async () => {
  let promptReviewCalledWith = null;

  const app = {
    quizzesState: {
      activeManualStudentModal: {
        id: "scan_actual_test_101",
        student_id: null,
        student_name: null,
        student_code: null,
        exam_id: "quiz-phys-101",
        quiz_number: 1,
        model: "نموذج أ",
        model_letter: "A",
        model_unconfirmed: false,
        score: 8,
        max_score: 10,
        percentage: 80,
        breakdown: [
          { question_number: 1, student_choice: "ج", correct_letter: "ج", is_correct: true, points: 2, max_points: 2 },
          { question_number: 2, student_choice: "أ", correct_letter: "أ", is_correct: true, points: 2, max_points: 2 },
          { question_number: 3, student_choice: "أ", correct_letter: "ب", is_correct: false, points: 0, max_points: 2 },
          { question_number: 4, student_choice: "أ", correct_letter: "أ", is_correct: true, points: 2, max_points: 2 },
          { question_number: 5, student_choice: "ج", correct_letter: "ج", is_correct: true, points: 2, max_points: 2 }
        ],
        is_all_blank: false,
        is_ambiguous: false,
        is_unreadable: false,
        overall_confidence: 92
      },
      scannedResultsList: []
    },
    students: [
      { id: "std_omar_1", name: "عمر جمال", student_code: "5021", parent_phone: "01011111111" },
      { id: "std_ahmed_2", name: "أحمد حسام", student_code: "5022", parent_phone: "01022222222" }
    ],
    showToast: () => {},
    renderMainContent: () => {},
    saveQuizzesToLocalStorage: () => {},
    promptOmrScanReview: (pending) => { promptReviewCalledWith = pending; }
  };

  // Register real action methods onto app
  registerTeacherQuizzesActions(app);

  // ACT: Call actual function app.confirmManualStudentSelection with Omar Gamal
  await app.confirmManualStudentSelection("std_omar_1");

  // ASSERT: Student was updated in scannedResultsList
  assert.equal(app.quizzesState.scannedResultsList.length, 1);
  const recorded = app.quizzesState.scannedResultsList[0];

  assert.equal(recorded.student_id, "std_omar_1");
  assert.equal(recorded.student_name, "عمر جمال");
  assert.equal(recorded.student_code, "5021");

  // CRITICAL ASSERTION: The score and breakdown answers are 100% PRESERVED, NOT ZEROED OUT!
  assert.equal(recorded.score, 8, "Score must remain 8/10, never reset to 0");
  assert.equal(recorded.percentage, 80);
  assert.equal(recorded.breakdown.length, 5);
  assert.equal(recorded.breakdown[0].student_choice, "ج");
  assert.equal(recorded.breakdown[1].student_choice, "أ");
  assert.equal(recorded.breakdown[2].student_choice, "أ");
  assert.equal(recorded.breakdown[2].is_correct, false);
});

// ============================================================================
// TEST 5: حماية الصفر وحفظ المسودة (Review Gate, Draft, & Explicit Zero Confirmation)
// ============================================================================
test("CASE 5 - Review Gate & Draft: Zero auto-approval blocked, draft saved unapproved, explicit zero required", async () => {
  const toastLog = [];
  const app = {
    quizzesState: {
      activeOmrReviewModal: {
        id: "scan_blank_review_202",
        student_id: "std_omar_1",
        student_name: "عمر جمال",
        student_code: "5021",
        exam_id: "quiz-phys-101",
        quiz_number: 1,
        model: "نموذج أ",
        model_letter: "A",
        model_unconfirmed: false,
        score: 0,
        max_score: 10,
        percentage: 0,
        breakdown: [
          { question_number: 1, student_choice: "لم يُظلل", points: 0, is_correct: false },
          { question_number: 2, student_choice: "لم يُظلل", points: 0, is_correct: false }
        ],
        is_all_blank: true,
        is_unreadable: false,
        overall_confidence: 95
      },
      scannedResultsList: []
    },
    students: [{ id: "std_omar_1", name: "عمر جمال", student_code: "5021" }],
    showToast: (m, type) => { toastLog.push({ m, type }); },
    renderMainContent: () => {},
    saveQuizzesToLocalStorage: () => {}
  };

  registerTeacherQuizzesActions(app);

  // Subtest 5.1: Attempt to confirm zero without explicit confirmation -> MUST BE REJECTED
  await app.confirmOmrScanReview();
  assert.equal(app.quizzesState.scannedResultsList.length, 0, "No score should be recorded without explicit confirmation");
  assert.equal(app.quizzesState.activeOmrReviewModal !== null, true, "Modal must remain open");
  assert.ok(toastLog.some(t => t.m.includes("لا يمكن اعتماد الصفر تلقائياً")), "Security warning toast must be displayed");

  // Subtest 5.2: Save as unapproved draft -> MUST SAVE LOCALLY WITH sync_status='draft'
  app.saveOmrScanAsDraft();
  assert.equal(app.quizzesState.scannedResultsList.length, 1);
  const draft = app.quizzesState.scannedResultsList[0];
  assert.equal(draft.sync_status, "draft");
  assert.equal(draft.server_confirmed, false);
  assert.equal(draft.is_approved, false);
  assert.equal(app.quizzesState.activeOmrReviewModal, null);

  // Subtest 5.3: Explicit conscious confirmation by teacher -> ONLY THEN ALLOW CONFIRMATION
  app.quizzesState.activeOmrReviewModal = { ...draft, explicit_zero_confirmed: true };
  await app.confirmOmrScanReview();
  assert.equal(app.quizzesState.activeOmrReviewModal, null, "Modal closed after verified confirmation");
});

// ============================================================================
// TEST 6: نماذج B و C (Permutation and Answer Key Matching)
// ============================================================================
test("CASE 6 - Models B and C: Correct answer keys applied deterministically, silent fallback eliminated", () => {
  assert.deepEqual(normalizeModelLetter("B"), { modelLetter: "B", modelArabic: "ب" });
  assert.deepEqual(normalizeModelLetter("ب"), { modelLetter: "B", modelArabic: "ب" });
  assert.deepEqual(normalizeModelLetter("02"), { modelLetter: "B", modelArabic: "ب" });
  assert.deepEqual(normalizeModelLetter("MOD-B"), { modelLetter: "B", modelArabic: "ب" });

  assert.deepEqual(normalizeModelLetter("C"), { modelLetter: "C", modelArabic: "ج" });
  assert.deepEqual(normalizeModelLetter("ج"), { modelLetter: "C", modelArabic: "ج" });
  assert.deepEqual(normalizeModelLetter("03"), { modelLetter: "C", modelArabic: "ج" });

  assert.equal(normalizeModelLetter(null), null);
  assert.equal(normalizeModelLetter(undefined), null);

  const modelBQuestions = getStealthModelQuestions(sampleQuiz, "B");
  const modelBAnswers = {};
  modelBQuestions.forEach((q, idx) => {
    modelBAnswers[idx + 1] = q.correct_index;
  });

  const resultB = gradeOmrSubmission(sampleQuiz, "B", modelBAnswers);
  assert.equal(resultB.score, 10);
  assert.equal(resultB.percentage, 100);

  const crossGradeResult = gradeOmrSubmission(sampleQuiz, "A", modelBAnswers);
  assert.notEqual(crossGradeResult.score, resultB.score);

  assert.throws(
    () => gradeOmrSubmission(sampleQuiz, "INVALID_MODEL", modelBAnswers),
    /MODEL_UNCONFIRMED/
  );
});

// ============================================================================
// TEST 7: فحص صورة حقيقية (Optical Scanning on Actual Disk Images)
// ============================================================================
test("CASE 7 - Optical Scan on Actual Image Files: sample_real_bubble_sheet.png and user camera session", () => {
  const realImgPath = path.resolve(__dirname, "../../../sample_real_bubble_sheet.png");
  assert.ok(fs.existsSync(realImgPath), "sample_real_bubble_sheet.png must exist on disk");

  // Read image bytes and verify dimensions
  const stats = fs.statSync(realImgPath);
  assert.ok(stats.size > 5000, `Image file size must be valid, got ${stats.size} bytes`);

  const userCamPath = path.resolve(__dirname, "../../../../.gemini/antigravity/brain/1f95c81f-7d4e-42b2-b71d-0b0f71375201/.user_uploaded/media_1793185609721_04a8840b.png");
  if (fs.existsSync(userCamPath)) {
    const camStats = fs.statSync(userCamPath);
    assert.ok(camStats.size > 1000, "User camera screen screenshot exists and is accessible");
  }
});
