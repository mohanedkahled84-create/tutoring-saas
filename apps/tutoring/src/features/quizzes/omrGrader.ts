/**
 * OMR Grader & Diagnostic Engine
 * Pure, deterministic grading and diagnosis for Bubble Sheet exams.
 * Shared between backend, automated tests, and offline verification.
 */

import { getStealthModelQuestions, QuizQuestion } from "./stealthModels.js";

export interface BubbleDarknessMap {
  أ?: number;
  ب?: number;
  ج?: number;
  د?: number;
  [key: string]: number | undefined;
}

export interface QuestionDiagnostic {
  question_number: number;
  student_choice: string;          // 'أ' | 'ب' | 'ج' | 'د' | 'لم يُظلل' | 'تظليل ملتبس'
  student_choice_index: number | null; // 0, 1, 2, 3 or null
  correct_choice: string;          // 'أ' | 'ب' | 'ج' | 'د'
  correct_index: number;           // 0, 1, 2, 3
  is_correct: boolean;
  points: number;
  max_points: number;
  confidence: number;              // 0 - 100%
  bubble_darkness?: BubbleDarknessMap;
  status: "clear" | "blank" | "ambiguous" | "low_confidence";
}

export interface OmrGradingResult {
  success: boolean;
  exam: {
    id: string;
    title: string;
    quiz_number: number;
    model: string;                 // 'أ' | 'ب' | 'ج'
    model_letter: string;          // 'A' | 'B' | 'C'
  };
  score: number;
  max_score: number;
  percentage: number;
  answered_count: number;
  blank_count: number;
  ambiguous_count: number;
  is_all_blank: boolean;
  overall_confidence: number;
  diagnostic_summary: {
    category: "ALL_CORRECT" | "PARTIAL_SCORE" | "ALL_WRONG" | "ALL_BLANK" | "UNREADABLE_LOW_CONFIDENCE";
    explanation: string;
  };
  breakdown: QuestionDiagnostic[];
}

export const ARABIC_CHOICES = ["أ", "ب", "ج", "د"];

/**
 * Normalizes any model identifier into standard Arabic ('أ'|'ب'|'ج') and Latin ('A'|'B'|'C')
 */
export function normalizeModelLetter(model: unknown): { modelLetter: "A" | "B" | "C"; modelArabic: "أ" | "ب" | "ج" } | null {
  if (!model) return null;
  const str = String(model).trim().toUpperCase();
  if (str === "B" || str === "ب" || str === "02" || str === "2" || str.includes("MOD-B") || str.endsWith("-02")) {
    return { modelLetter: "B", modelArabic: "ب" };
  }
  if (str === "C" || str === "ج" || str === "03" || str === "3" || str.includes("MOD-C") || str.endsWith("-03")) {
    return { modelLetter: "C", modelArabic: "ج" };
  }
  if (str === "A" || str === "أ" || str === "01" || str === "1" || str.includes("MOD-A") || str.endsWith("-01")) {
    return { modelLetter: "A", modelArabic: "أ" };
  }
  return null;
}

/**
 * Pure, deterministic grading function that compares student answers against the resolved model answer key
 */
export function gradeOmrSubmission(
  quiz: any,
  rawModel: unknown,
  answers: Record<string, unknown> = {},
  diagnosticsMap: Record<number, { darkness?: BubbleDarknessMap; confidence?: number; status?: string }> = {}
): OmrGradingResult {
  const norm = normalizeModelLetter(rawModel);
  if (!norm) {
    throw new Error("MODEL_UNCONFIRMED: النموذج غير محدد بدقة (مطلوب أ أو ب أو ج)");
  }

  const { modelLetter, modelArabic } = norm;
  const questions: QuizQuestion[] = getStealthModelQuestions(quiz, modelLetter);
  const mcqs = questions.filter((q) => q.type !== "essay");

  if (mcqs.length === 0) {
    const rawScore = Number((answers as any)?.score ?? (answers as any)?.total_score ?? 0);
    const rawMax = Number(quiz?.max_score || 10);
    return {
      success: true,
      exam: {
        id: quiz?.id || "exam-target",
        title: quiz?.title || `امتحان ${quiz?.quiz_number || 1}`,
        quiz_number: Number(quiz?.quiz_number || 1),
        model: modelArabic,
        model_letter: modelLetter,
      },
      score: rawScore,
      max_score: rawMax,
      percentage: rawMax > 0 ? Math.round((rawScore / rawMax) * 100) : 0,
      answered_count: rawScore > 0 ? 1 : 0,
      blank_count: rawScore > 0 ? 0 : 1,
      ambiguous_count: 0,
      is_all_blank: rawScore === 0,
      overall_confidence: 90,
      diagnostic_summary: {
        category: rawScore > 0 ? "PARTIAL_SCORE" : "ALL_BLANK",
        explanation: `تم رصد الدرجة المباشرة ${rawScore}/${rawMax}`,
      },
      breakdown: [],
    };
  }

  let totalScore = 0;
  let totalMaxScore = 0;
  let answeredCount = 0;
  let blankCount = 0;
  let ambiguousCount = 0;
  let totalConfidence = 0;

  const breakdown: QuestionDiagnostic[] = [];

  mcqs.forEach((q, idx) => {
    const qNum = idx + 1;
    const maxPts = Number(q.points || 1);
    totalMaxScore += maxPts;

    const correctIdx = Number(q.correct_index ?? 0);
    const correctChoice = ARABIC_CHOICES[correctIdx] || "أ";

    // Extract student choice
    const rawVal = answers[qNum] ?? answers[String(qNum)] ?? (q.id ? answers[q.id] : undefined);
    let studentChoiceIdx: number | null = null;
    let studentChoiceLabel = "لم يُظلل";
    let status: "clear" | "blank" | "ambiguous" | "low_confidence" = "blank";
    let confidence = 95; // Default high confidence for definite blanks

    const diag = diagnosticsMap[qNum] || {};

    if (rawVal !== undefined && rawVal !== null && rawVal !== "" && rawVal !== "لم يُظلل") {
      if (rawVal === "تظليل ملتبس" || rawVal === "ambiguous") {
        studentChoiceLabel = "تظليل ملتبس";
        status = "ambiguous";
        ambiguousCount++;
        confidence = diag.confidence ?? 20;
      } else {
        const numVal = Number(rawVal);
        if (!isNaN(numVal) && numVal >= 0 && numVal <= 3) {
          studentChoiceIdx = numVal;
          studentChoiceLabel = ARABIC_CHOICES[studentChoiceIdx] || "أ";
          status = "clear";
          answeredCount++;
          confidence = diag.confidence ?? 90;
        } else if (typeof rawVal === "string" && ARABIC_CHOICES.includes(rawVal.trim())) {
          studentChoiceIdx = ARABIC_CHOICES.indexOf(rawVal.trim());
          studentChoiceLabel = rawVal.trim();
          status = "clear";
          answeredCount++;
          confidence = diag.confidence ?? 90;
        } else {
          studentChoiceLabel = "تظليل ملتبس";
          status = "ambiguous";
          ambiguousCount++;
          confidence = 30;
        }
      }
    } else {
      blankCount++;
      status = "blank";
      confidence = diag.confidence ?? 95;
    }

    const isCorrect = (studentChoiceIdx !== null && studentChoiceIdx === correctIdx);
    const earnedPts = isCorrect ? maxPts : 0;
    totalScore += earnedPts;
    totalConfidence += confidence;

    breakdown.push({
      question_number: qNum,
      student_choice: studentChoiceLabel,
      student_choice_index: studentChoiceIdx,
      correct_choice: correctChoice,
      correct_index: correctIdx,
      is_correct: isCorrect,
      points: earnedPts,
      max_points: maxPts,
      confidence,
      bubble_darkness: diag.darkness,
      status,
    });
  });

  const avgConfidence = mcqs.length > 0 ? Math.round(totalConfidence / mcqs.length) : 0;
  const isAllBlank = (answeredCount === 0);
  const percentage = totalMaxScore > 0 ? Math.round((totalScore / totalMaxScore) * 100) : 0;

  // Diagnosis categorization
  let category: "ALL_CORRECT" | "PARTIAL_SCORE" | "ALL_WRONG" | "ALL_BLANK" | "UNREADABLE_LOW_CONFIDENCE" = "PARTIAL_SCORE";
  let explanation = "";

  if (avgConfidence < 40) {
    category = "UNREADABLE_LOW_CONFIDENCE";
    explanation = "درجة الثقة بالقراءة منخفضة؛ الورقة غير واضحة أو لم يتم رصد الدوائر بدقة.";
  } else if (isAllBlank) {
    category = "ALL_BLANK";
    explanation = "لم يتم تظليل أي سؤال في الورقة (الدرجة صفر لأن جميع الإجابات فارغة).";
  } else if (totalScore === 0) {
    category = "ALL_WRONG";
    explanation = `تم تظليل ${answeredCount} سؤال، وجميع الإجابات غير متطابقة مع مفتاح النموذج (${modelArabic}).`;
  } else if (totalScore === totalMaxScore) {
    category = "ALL_CORRECT";
    explanation = `إجابات نموذجية كاملة (${totalScore}/${totalMaxScore}) مطابقة للنموذج (${modelArabic}).`;
  } else {
    category = "PARTIAL_SCORE";
    explanation = `تمت الإجابة على ${answeredCount} سؤال؛ الدرجة ${totalScore} من ${totalMaxScore} (${percentage}%) وفق النموذج (${modelArabic}).`;
  }

  return {
    success: true,
    exam: {
      id: quiz?.id || "exam-target",
      title: quiz?.title || `امتحان ${quiz?.quiz_number || 1}`,
      quiz_number: Number(quiz?.quiz_number || 1),
      model: modelArabic,
      model_letter: modelLetter,
    },
    score: totalScore,
    max_score: totalMaxScore,
    percentage,
    answered_count: answeredCount,
    blank_count: blankCount,
    ambiguous_count: ambiguousCount,
    is_all_blank: isAllBlank,
    overall_confidence: avgConfidence,
    diagnostic_summary: {
      category,
      explanation,
    },
    breakdown,
  };
}
