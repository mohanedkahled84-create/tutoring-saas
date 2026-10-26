import test from "node:test";
import assert from "node:assert/strict";
import { mergeLegacyPortalQuizzes } from "../dist/shared/utils/legacyPortalQuizzes.js";

test("legacy portal quiz recovery is group-scoped, hides answers, and restores this student's submission", () => {
  const portalData = {
    student: { student_code: "STU-7" },
    materials: [{ id: "already-there", type: "online_quiz" }],
    quizzes: [],
  };
  const rows = [
    {
      phone: "QUIZ_DEF_legacy-1",
      status: "published",
      created_at: "2026-10-25T00:00:00.000Z",
      message_body: JSON.stringify({
        id: "legacy-1",
        group_id: "group-a",
        title: "Quiz A",
        questions: [{ text: "2 + 2?", options: ["3", "4"], correct_index: 1 }],
      }),
    },
    {
      phone: "QUIZ_DEF_other-tenant",
      status: "published",
      message_body: JSON.stringify({ id: "other-tenant", group_id: "group-b", questions: [] }),
    },
    {
      phone: "QUIZ_DEF_DRAFT_draft-1",
      status: "draft",
      message_body: JSON.stringify({ id: "draft-1", group_id: "group-a", questions: [] }),
    },
  ];

  mergeLegacyPortalQuizzes(
    portalData,
    rows,
    new Set(["group-a"]),
    [{
      material_id: "legacy-1",
      status: "approved",
      teacher_notes: JSON.stringify({ is_graded: true, final_score: 8, max_score: 10 }),
      submitted_at: "2026-10-26T00:00:00.000Z",
    }]
  );

  assert.deepEqual(portalData.materials.map((material) => material.id), ["already-there", "legacy-1"]);
  assert.equal(portalData.materials[1].submission_status, "approved");
  assert.equal(portalData.materials[1].teacher_feedback.includes("final_score"), true);
  assert.equal("correct_index" in portalData.materials[1].questions.questions[0], false);
  assert.equal(portalData.quizzes[0].score, 8);
  assert.equal(portalData.quizzes[0].max_score, 10);
});
