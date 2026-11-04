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
  assert.deepEqual(portalData.materials[1].questions.questions, []);
  assert.equal(portalData.materials[1].questions.question_count,1);
  assert.ok(!JSON.stringify(portalData.materials[1]).includes("2 + 2?"));
  assert.equal(portalData.quizzes[0].score, 8);
  assert.equal(portalData.quizzes[0].max_score, 10);
});

test('canonicalized virtual quizzes remain a single exam in the student portal',()=>{
 const data={student:{student_code:'1'},materials:[{id:'canonical',type:'online_quiz',questions:JSON.stringify({legacy_quiz_ref:'virtual-quiz'})}],quizzes:[]};
 mergeLegacyPortalQuizzes(data,[{phone:'QUIZ_DEF_virtual-quiz',status:'published',message_body:JSON.stringify({id:'virtual-quiz',group_id:'own-group',questions:[{id:'q1',correct_index:0,options:['a','b']}]})}],new Set(['own-group']),[]);
 assert.equal(data.materials.length,1);assert.equal(data.materials[0].id,'canonical');
});
