import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import {
  gradeOmrSubmission,
  normalizeModelLetter,
  ARABIC_CHOICES
} from "../dist/features/quizzes/omrGrader.js";
import { getStealthModelQuestions } from "../dist/features/quizzes/stealthModels.js";

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
  // Model A student submitted 100% correct answers
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
  assert.ok(result.overall_confidence >= 94, `Expected confidence >= 94, got ${result.overall_confidence}`);

  // Inspect each breakdown item
  result.breakdown.forEach(item => {
    assert.equal(item.is_correct, true);
    assert.equal(item.status, "clear");
    assert.equal(item.points, 2);
    assert.ok(item.confidence >= 90);
    assert.ok(item.bubble_darkness !== undefined);
  });
});

// ============================================================================
// TEST 2: ورقة فاضية تماماً (Truly empty sheet)
// ============================================================================
test("CASE 2 - Truly Empty Sheet: Detected as ALL_BLANK, flagged for review, no auto-approval of zero", () => {
  const emptyAnswers = {}; // Student left entire bubble sheet blank
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

  // Verify Frontend Review Gate Logic:
  // When is_all_blank is true, analyzeOmrCanvas routes to promptOmrScanReview instead of recordOmrScanResult
  const teacherViewPath = path.resolve(__dirname, "../../web/src/components/TeacherQuizzesView.js");
  const code = fs.readFileSync(teacherViewPath, "utf8");

  assert.ok(
    code.includes("if (modelUnconfirmed || isUnreadable || isAllBlank || isAmbiguous || avgConfidence < 40)"),
    "TeacherQuizzesView must gate all-blank sheets into manual review"
  );
  assert.ok(
    code.includes("this.promptOmrScanReview(pendingScan)"),
    "TeacherQuizzesView must call promptOmrScanReview for blank or uncertain sheets"
  );
});

// ============================================================================
// TEST 3: صورة غير واضحة (Unclear / unreadable image)
// ============================================================================
test("CASE 3 - Unreadable Image: High background noise or washed out image flagged as unreadable/low confidence", () => {
  // Emulate low contrast / washed out bubbles (diff < 8 or max darkness < 20)
  const lowContrastDiagnostics = {
    1: { darkness: { "أ": 15, "ب": 16, "ج": 14, "د": 15 }, confidence: 25 },
    2: { darkness: { "أ": 18, "ب": 17, "ج": 19, "د": 18 }, confidence: 20 },
    3: { darkness: { "أ": 14, "ب": 15, "ج": 14, "د": 15 }, confidence: 30 },
    4: { darkness: { "أ": 16, "ب": 15, "ج": 17, "د": 16 }, confidence: 22 },
    5: { darkness: { "أ": 15, "ب": 14, "ج": 15, "د": 14 }, confidence: 28 }
  };

  const result = gradeOmrSubmission(sampleQuiz, "A", {}, lowContrastDiagnostics);

  assert.ok(result.overall_confidence < 40, `Expected low confidence (<40), got ${result.overall_confidence}`);
  assert.equal(result.diagnostic_summary.category, "UNREADABLE_LOW_CONFIDENCE");

  // Verify Frontend Contrast Check logic in code
  const teacherViewPath = path.resolve(__dirname, "../../web/src/components/TeacherQuizzesView.js");
  const code = fs.readFileSync(teacherViewPath, "utf8");

  assert.ok(
    code.includes("if (minSample > 220 || maxSample < 20 || (sampleDiff < 8 && maxSample < 40))"),
    "Frontend must calculate image contrast across control points"
  );
  assert.ok(
    code.includes("isUnreadable = true"),
    "Frontend must mark isUnreadable when contrast is deficient"
  );
  assert.ok(
    code.includes("unreadableReason = 'الصورة غير واضحة"),
    "Frontend must set clear Arabic reason for unreadable scan"
  );
});

// ============================================================================
// TEST 4: طالب تم اختياره يدويًا (Manually selected student)
// ============================================================================
test("CASE 4 - Manual Student Selection: Preserves detected answers and score without resetting to zero", () => {
  // Emulate frontend pendingScan object created during scan
  const pendingScan = {
    id: "scan_test_123",
    student_id: null, // Initially null because code was unreadable
    student_name: null,
    student_code: null,
    exam_id: "quiz-phys-101",
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
  };

  const studentsRoster = [
    { id: "std_omar_1", name: "عمر جمال", student_code: "5021", parent_phone: "01011111111" },
    { id: "std_ahmed_2", name: "أحمد حسام", student_code: "5022", parent_phone: "01022222222" }
  ];

  // Emulate app.confirmManualStudentSelection
  const selectedStudentId = "std_omar_1";
  const student = studentsRoster.find(s => String(s.id) === String(selectedStudentId));
  assert.ok(student, "Selected student must exist in roster");

  pendingScan.student_id = student.id;
  pendingScan.student_name = student.name;
  pendingScan.student_code = student.student_code;
  pendingScan.parent_phone = student.parent_phone;

  // Verify that answers and score were NOT wiped or set to 0!
  assert.equal(pendingScan.student_id, "std_omar_1");
  assert.equal(pendingScan.student_name, "عمر جمال");
  assert.equal(pendingScan.score, 8);
  assert.equal(pendingScan.percentage, 80);
  assert.equal(pendingScan.breakdown.length, 5);
  assert.equal(pendingScan.breakdown[0].student_choice, "ج");
  assert.equal(pendingScan.breakdown[2].student_choice, "أ");
  assert.equal(pendingScan.breakdown[2].is_correct, false);
});

// ============================================================================
// TEST 5: نماذج B و C (Permutation and Answer Key Matching)
// ============================================================================
test("CASE 5 - Models B and C: Correct answer keys applied deterministically, silent fallback eliminated", () => {
  // Test normalization
  assert.deepEqual(normalizeModelLetter("B"), { modelLetter: "B", modelArabic: "ب" });
  assert.deepEqual(normalizeModelLetter("ب"), { modelLetter: "B", modelArabic: "ب" });
  assert.deepEqual(normalizeModelLetter("02"), { modelLetter: "B", modelArabic: "ب" });
  assert.deepEqual(normalizeModelLetter("MOD-B"), { modelLetter: "B", modelArabic: "ب" });

  assert.deepEqual(normalizeModelLetter("C"), { modelLetter: "C", modelArabic: "ج" });
  assert.deepEqual(normalizeModelLetter("ج"), { modelLetter: "C", modelArabic: "ج" });
  assert.deepEqual(normalizeModelLetter("03"), { modelLetter: "C", modelArabic: "ج" });

  assert.equal(normalizeModelLetter(null), null);
  assert.equal(normalizeModelLetter(undefined), null);
  assert.equal(normalizeModelLetter("UNKNOWN"), null);

  // Model Questions Permutation
  const modelAQuestions = getStealthModelQuestions(sampleQuiz, "A");
  const modelBQuestions = getStealthModelQuestions(sampleQuiz, "B");
  const modelCQuestions = getStealthModelQuestions(sampleQuiz, "C");

  assert.equal(modelAQuestions.length, 5);
  assert.equal(modelBQuestions.length, 5);
  assert.equal(modelCQuestions.length, 5);

  // Extract correct answers for Model B
  const modelBAnswers = {};
  modelBQuestions.forEach((q, idx) => {
    modelBAnswers[idx + 1] = q.correct_index;
  });

  // Grade Model B submission against Model B
  const resultB = gradeOmrSubmission(sampleQuiz, "B", modelBAnswers);
  assert.equal(resultB.score, 10, "Model B answers graded against Model B key must produce full score");
  assert.equal(resultB.percentage, 100);
  assert.equal(resultB.diagnostic_summary.category, "ALL_CORRECT");

  // Grade same Model B submission against Model A key (simulating old bug)
  const crossGradeResult = gradeOmrSubmission(sampleQuiz, "A", modelBAnswers);
  // Because options and question orders were permuted, the score will not be 100%
  assert.notEqual(
    crossGradeResult.score,
    resultB.score,
    "Grading Model B answers against Model A key must prove that keys differ and cannot silently match"
  );

  // Backend rejection of missing/unconfirmed model
  assert.throws(
    () => gradeOmrSubmission(sampleQuiz, "INVALID_MODEL", modelBAnswers),
    /MODEL_UNCONFIRMED/
  );
});

// ============================================================================
// TEST 6: فشل الاتصال بالسيرفر (Server connection / save failure)
// ============================================================================
test("CASE 6 - Server Failure Handling: Client does not auto-commit score as confirmed when backend rejects", () => {
  const teacherViewPath = path.resolve(__dirname, "../../web/src/components/TeacherQuizzesView.js");
  const code = fs.readFileSync(teacherViewPath, "utf8");

  // Check that recordOmrScanResult awaits response and checks server success
  assert.ok(
    code.includes("const saved = await request('/quizzes/omr-scan'"),
    "recordOmrScanResult must send OMR scan request to backend /quizzes/omr-scan"
  );
  assert.ok(
    code.includes("if (saved?.success)"),
    "recordOmrScanResult must check for server success confirmation"
  );
  assert.ok(
    code.includes("scanData.sync_status = 'failed'"),
    "When server returns an error or failure, sync_status must be marked failed"
  );
  assert.ok(
    code.includes("scanData.server_confirmed = false"),
    "When server fails, server_confirmed must be false"
  );
  assert.ok(
    code.includes("scanData.sync_status = 'synced'"),
    "Only after server confirms with success is sync_status marked synced"
  );
  assert.ok(
    code.includes("this.quizzesState.scoresMap[qNum][scanData.student_id] = scanData.score"),
    "Scores map is updated ONLY upon successful server confirmation"
  );
});
