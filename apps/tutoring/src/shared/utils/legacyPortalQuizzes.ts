const answerFields = new Set([
  "correct_index",
  "correct",
  "answer",
  "answer_index",
  "correctanswer",
  "correctanswerindex",
  "correctoption",
  "correctoptionindex",
]);

export function stripQuizAnswers(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stripQuizAnswers);
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value as Record<string, unknown>)
      .filter(([key]) => !answerFields.has(key.toLowerCase().replace(/[^a-z0-9_]/g, "")))
      .map(([key, nested]) => [key, stripQuizAnswers(nested)])
  );
}

export function mergeLegacyPortalQuizzes(
  portalData: Record<string, any>,
  rows: Array<Record<string, any>>,
  allowedGroupIds: Set<string>,
  submissions: Array<Record<string, any>> = [],
  monitorOnly = false
): void {
  const materials = Array.isArray(portalData.materials) ? portalData.materials : [];
  const existingIds = new Set(materials.map((material: any) => String(material.id)));
  const submissionByMaterial = new Map(
    submissions.map((submission) => [
      String(submission.material_id || submission.quiz_id),
      submission,
    ])
  );
  const scores = Array.isArray(portalData.quizzes) ? portalData.quizzes : [];

  for (const row of rows || []) {
    if (
      String(row.phone || "")
        .toUpperCase()
        .includes("DRAFT") ||
      row.status === "draft"
    )
      continue;
    let quiz: Record<string, any>;
    try {
      const parsed =
        typeof row.message_body === "string" ? JSON.parse(row.message_body) : row.message_body;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) continue;
      quiz = parsed as Record<string, any>;
    } catch {
      continue;
    }

    const id = String(quiz.id || "").trim();
    const groupId = String(quiz.group_id || "");
    const mode = String(quiz.exam_mode || "online").toLowerCase();
    if (
      !id ||
      existingIds.has(id) ||
      !allowedGroupIds.has(groupId) ||
      mode === "paper" ||
      quiz.is_draft ||
      quiz.is_archived
    )
      continue;
    if (!Array.isArray(quiz.questions)) continue;

    const safeQuestions = monitorOnly ? quiz.questions : stripQuizAnswers(quiz.questions);
    const submission = submissionByMaterial.get(id);
    let submissionNotes: Record<string, any> = {};
    try {
      const parsedNotes =
        typeof submission?.teacher_notes === "string"
          ? JSON.parse(submission.teacher_notes)
          : submission?.teacher_notes;
      if (parsedNotes && typeof parsedNotes === "object" && !Array.isArray(parsedNotes)) {
        submissionNotes = parsedNotes as Record<string, any>;
      }
    } catch {}

    if (!monitorOnly) materials.push({
      id,
      title: String(quiz.title || `كويز ${quiz.quiz_number || ""}`).trim(),
      description: String(quiz.subject || ""),
      type: "online_quiz",
      is_homework: false,
      group_id: groupId,
      questions: { ...quiz, questions: safeQuestions },
      created_date: String(quiz.available_date || row.created_at || "").slice(0, 10),
      due_date: quiz.available_date || null,
      submission_status: submission?.status || "unsubmitted",
      submission_url: submission?.file_url || null,
      submitted_at: submission?.submitted_at || null,
      teacher_feedback: submission?.teacher_notes || null,
      time_limit_minutes: Number(quiz.time_limit_minutes) || 20,
    });

    const scoreValue =
      submissionNotes.final_score ?? submissionNotes.total_score ?? submissionNotes.score;
    const score = Number(scoreValue);
    if (
      submission &&
      (submissionNotes.is_graded === true || submission.status === "approved") &&
      Number.isFinite(score) &&
      score >= 0
    ) {
      const maxScore =
        Number(submissionNotes.max_score) ||
        (safeQuestions as any[]).reduce(
          (sum, question) => sum + Number(question?.points || 1),
          0
        ) ||
        10;
      if (!scores.some((item: any) => String(item.quiz_id || item.id) === id)) {
        scores.push({
          id,
          quiz_id: id,
          title: String(quiz.title || `كويز ${quiz.quiz_number || ""}`).trim(),
          quiz_number: Number(quiz.quiz_number) || null,
          quiz_date: submission.submitted_at || quiz.available_date || row.created_at || "",
          score,
          max_score: maxScore,
          percentage: maxScore > 0 ? Math.round((score / maxScore) * 1000) / 10 : null,
          status: submission.status || "approved",
          student_code: portalData.student?.student_code || portalData.student?.code || "",
        });
      }
    }
    existingIds.add(id);
  }

  portalData.materials = materials;
  portalData.quizzes = scores;
}
