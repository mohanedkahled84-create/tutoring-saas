/**
 * Stealth Models (A, B, C) Deterministic Permutations Engine
 * Shared single-source-of-truth mathematical logic for OMR bubble sheet grading.
 */

export interface QuizQuestion {
  id?: string;
  type?: string;
  text?: string;
  choices?: string[];
  options?: string[];
  correct_index?: number;
  correct_answer?: number;
  points?: number;
  original_index?: number;
  model_number?: number;
}

export function getStealthModelQuestions(quiz: any, modelLetter: string = 'A'): QuizQuestion[] {
  const questions: QuizQuestion[] = Array.isArray(quiz?.questions) ? quiz.questions : [];
  if (questions.length === 0) return [];

  const mcqs = questions.filter((q) => q.type !== 'essay');
  const essays = questions.filter((q) => q.type === 'essay');

  let processedMcqs: QuizQuestion[] = [];
  const normalizedModel = String(modelLetter || 'A').trim().toUpperCase();

  if (normalizedModel === 'B' || normalizedModel === 'ب') {
    // Model B: Reverse MCQ question order, rotate choices by +1
    const reversedMcqs = [...mcqs].reverse();
    processedMcqs = reversedMcqs.map((q, idx) => {
      const origChoices = Array.isArray(q.choices) && q.choices.length === 4
        ? q.choices
        : (Array.isArray(q.options) && q.options.length === 4 ? q.options : ['', '', '', '']);
      const shiftedChoices = [origChoices[1], origChoices[2], origChoices[3], origChoices[0]];
      const origCorrect = Number(q.correct_index !== undefined && q.correct_index !== null ? q.correct_index : (q.correct_answer ?? 0));
      const shiftedCorrect = (origCorrect - 1 + 4) % 4;
      return {
        ...q,
        choices: shiftedChoices,
        options: shiftedChoices,
        correct_index: shiftedCorrect,
        correct_answer: shiftedCorrect,
        original_index: questions.indexOf(q),
        model_number: 2,
      };
    });
  } else if (normalizedModel === 'C' || normalizedModel === 'ج') {
    // Model C: Alternate interleaved MCQ order (odds then evens), rotate choices by +2
    const evens = mcqs.filter((_, i) => i % 2 === 0);
    const odds = mcqs.filter((_, i) => i % 2 !== 0);
    const permutedMcqs = [...odds, ...evens];
    processedMcqs = permutedMcqs.map((q, idx) => {
      const origChoices = Array.isArray(q.choices) && q.choices.length === 4
        ? q.choices
        : (Array.isArray(q.options) && q.options.length === 4 ? q.options : ['', '', '', '']);
      const shiftedChoices = [origChoices[2], origChoices[3], origChoices[0], origChoices[1]];
      const origCorrect = Number(q.correct_index !== undefined && q.correct_index !== null ? q.correct_index : (q.correct_answer ?? 0));
      const shiftedCorrect = (origCorrect - 2 + 4) % 4;
      return {
        ...q,
        choices: shiftedChoices,
        options: shiftedChoices,
        correct_index: shiftedCorrect,
        correct_answer: shiftedCorrect,
        original_index: questions.indexOf(q),
        model_number: 3,
      };
    });
  } else {
    // Model A: Original MCQ order and choices
    processedMcqs = mcqs.map((q, idx) => ({
      ...q,
      original_index: questions.indexOf(q),
      model_number: 1,
    }));
  }

  return [...processedMcqs, ...essays];
}
