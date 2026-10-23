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

    const { material_id, student_code, student_name, answers, elapsed_seconds } = body || {};
    const sCode = String(student_code || '1006').trim();
    const sName = String(student_name || 'طالب').trim();

    if (!material_id) {
      return res.status(400).json({ error: { message: 'material_id is required' } });
    }

    // 1. Fetch quiz definition
    let quizDef = null;

    // Check study_materials
    try {
      const qRes = await fetch(`${SUPABASE_URL}/rest/v1/study_materials?id=eq.${encodeURIComponent(material_id)}&select=*`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });
      if (qRes.ok) {
        const rows = await qRes.json();
        if (rows && rows[0]) {
          const m = rows[0];
          let meta = {};
          try { meta = JSON.parse(m.questions || '{}'); } catch (_) {}
          quizDef = {
            id: m.id,
            title: m.title,
            quiz_number: meta.quiz_number || 1,
            group_id: m.group_id,
            questions: Array.isArray(meta.questions) ? meta.questions : []
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
              if (parsed && (parsed.id === material_id || String(parsed.quiz_number) === String(material_id))) {
                quizDef = parsed;
                break;
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }

    const questionsList = Array.isArray(quizDef?.questions) ? quizDef.questions : [];
    const studentAnswers = answers || {};

    let mcqScore = 0;
    let totalMcqPoints = 0;
    let totalMaxScore = 0;
    let hasEssay = false;

    questionsList.forEach((q, idx) => {
      const qPts = Number(q.points || 1);
      totalMaxScore += qPts;
      const qAns = studentAnswers[q.id] ?? studentAnswers[idx] ?? studentAnswers[idx + 1];

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
      id: `sub_${material_id}_${sCode}_${Date.now()}`,
      material_id,
      quiz_id: material_id,
      quiz_title: quizDef?.title || 'كويز إلكتروني',
      quiz_number: Number(quizDef?.quiz_number || 1),
      group_id: quizDef?.group_id || null,
      student_code: sCode,
      student_name: sName,
      status,
      is_graded: isGraded,
      mcq_score: mcqScore,
      total_mcq_points: totalMcqPoints,
      total_score: finalScore,
      max_score: totalMaxScore,
      questions: questionsList,
      answers: studentAnswers,
      elapsed_seconds: Number(elapsed_seconds || 0),
      submitted_at: new Date().toISOString()
    };

    // Store in whatsapp_inbox
    const subPhone = `QUIZ_SUB_${material_id}_${sCode}`;
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
