// Serverless Handler for Student Quiz Submissions
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ofaraxqrpcdiregxjyyb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_wHmQPRNF0WmysskPAcD7yw_6tet5Zyz';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: { message: 'Method Not Allowed' } });
  }

  try {
    let body = req.body;
    if (typeof body === 'string') {
      try {
        body = JSON.parse(body);
      } catch (_) {}
    }

    const {
      material_id,
      quiz_id,
      student_code,
      student_name,
      answers,
      essay_answers,
      questions,
      quiz_title,
      quiz_number,
      group_id,
      has_essay,
      elapsed_seconds
    } = body || {};

    const targetId = String(material_id || quiz_id || '').trim();
    const sCode = String(student_code || '1006').trim();
    const sName = String(student_name || 'طالب').trim();

    if (!targetId) {
      return res.status(400).json({ error: { message: 'material_id is required' } });
    }

    // 1. Fetch quiz definition
    let quizDef = null;

    // Check study_materials
    try {
      const qRes = await fetch(`${SUPABASE_URL}/rest/v1/study_materials?id=eq.${encodeURIComponent(targetId)}&select=*`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (qRes.ok) {
        const rows = await qRes.json();
        if (rows && rows[0]) {
          const m = rows[0];
          let meta = {};
          if (typeof m.questions === 'string') {
            try { meta = JSON.parse(m.questions); } catch (_) {}
          } else if (typeof m.questions === 'object' && m.questions !== null) {
            meta = m.questions;
          }
          quizDef = {
            id: m.id,
            title: m.title,
            quiz_number: meta.quiz_number || 1,
            group_id: m.group_id,
            questions: Array.isArray(meta.questions) ? meta.questions : (Array.isArray(m.questions) ? m.questions : [])
          };
        }
      }
    } catch (_) {}

    // Check fallback in whatsapp_inbox
    if (!quizDef) {
      try {
        const fbRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=like.QUIZ_DEF_%25&select=*`, {
          headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
        });
        if (fbRes.ok) {
          const rows = await fbRes.json();
          for (const row of (rows || [])) {
            try {
              const parsed = JSON.parse(row.message_body || '{}');
              if (parsed && (parsed.id === targetId || String(parsed.quiz_number) === String(targetId))) {
                quizDef = parsed;
                break;
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    // Fallback to client-provided questions if quizDef was not found or had no questions
    let questionsList = Array.isArray(quizDef?.questions) && quizDef.questions.length > 0
      ? quizDef.questions
      : (Array.isArray(questions) ? questions : []);

    const studentAnswers = answers || {};
    const essayAnswers = essay_answers || {};
    const combinedAnswers = { ...studentAnswers, ...essayAnswers };

    let hasEssay = Boolean(has_essay);
    if (!hasEssay && Array.isArray(questionsList) && questionsList.length > 0) {
      hasEssay = questionsList.some(q => q.type === 'essay');
    }
    if (!hasEssay && Object.keys(essayAnswers).length > 0) {
      hasEssay = true;
    }

    let mcqScore = 0;
    let totalMcqPoints = 0;
    let totalMaxScore = 0;

    questionsList.forEach((q, idx) => {
      const qPts = Number(q.points || 1);
      totalMaxScore += qPts;
      const qAns = combinedAnswers[q.id] ?? combinedAnswers[idx] ?? combinedAnswers[idx + 1];

      if (q.type === 'essay') {
        hasEssay = true;
      } else {
        totalMcqPoints += qPts;
        const correctIdx = Number(q.correct_index !== undefined ? q.correct_index : (q.correct !== undefined ? q.correct : 0));
        if (qAns !== undefined && Number(qAns) === correctIdx) {
          mcqScore += qPts;
        }
      }
    });

    const isGraded = !hasEssay;
    const finalScore = isGraded ? mcqScore : null;
    const status = isGraded ? 'approved' : 'pending';

    const subObject = {
      id: `sub_${targetId}_${sCode}_${Date.now()}`,
      material_id: targetId,
      quiz_id: targetId,
      quiz_title: quizDef?.title || quiz_title || 'كويز إلكتروني',
      quiz_number: Number(quizDef?.quiz_number || quiz_number || 1),
      group_id: quizDef?.group_id || group_id || null,
      student_code: sCode,
      student_name: sName,
      status,
      is_graded: isGraded,
      is_withdrawn: Boolean(body?.is_withdrawn),
      withdrawal_reason: body?.withdrawal_reason || null,
      mcq_score: mcqScore,
      total_mcq_points: totalMcqPoints,
      total_score: finalScore,
      max_score: totalMaxScore > 0 ? totalMaxScore : (Number(body?.max_score) || 10),
      questions: questionsList,
      answers: combinedAnswers,
      essay_answers: essayAnswers,
      elapsed_seconds: Number(elapsed_seconds || 0),
      submitted_at: new Date().toISOString()
    };

    // Store in whatsapp_inbox
    const subPhone = `QUIZ_SUB_${targetId}_${sCode}`;
    const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(subPhone)}&select=id`, {
      headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
    });
    const existing = checkRes.ok ? await checkRes.json() : [];

    if (Array.isArray(existing) && existing.length > 0) {
      await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?id=eq.${existing[0].id}`, {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          message_body: JSON.stringify(subObject),
          student_name: sName,
          status,
          updated_at: new Date().toISOString()
        })
      });
    } else {
      await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox`, {
        method: 'POST',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          phone: subPhone,
          direction: 'inbound',
          message_body: JSON.stringify(subObject),
          student_name: sName,
          status,
          created_at: new Date().toISOString()
        })
      });
    }

    return res.status(200).json({
      success: true,
      submission: subObject
    });
  } catch (err) {
    console.error('[api/quizzes/submit] error:', err);
    return res.status(500).json({ error: { message: err.message || 'Submission failed' } });
  }
}
