// Serverless Handler for Quiz Submissions Roster & Grading
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ofaraxqrpcdiregxjyyb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_wHmQPRNF0WmysskPAcD7yw_6tet5Zyz';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: list submissions
  if (req.method === 'GET') {
    try {
      const url = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=like.QUIZ_SUB_%25&select=*&order=created_at.desc`;
      const response = await fetch(url, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });

      let submissions = [];
      if (response.ok) {
        const rows = await response.json();
        for (const row of (rows || [])) {
          try {
            const parsed = JSON.parse(row.message_body || '{}');
            if (parsed && parsed.quiz_id) {
              submissions.push(parsed);
            }
          } catch (_) {}
        }
      }

      const isPendingReq = (req.url || '').includes('pending') || (req.query?.type === 'pending');
      if (isPendingReq) {
        submissions = submissions.filter(s => s.status === 'pending' || !s.is_graded);
      }

      return res.status(200).json({
        success: true,
        submissions
      });
    } catch (err) {
      console.error('[api/quizzes/submissions] GET error:', err);
      return res.status(500).json({ error: { message: err.message || 'Failed to fetch submissions' } });
    }
  }

  // POST: manual grading of essay questions
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try { body = JSON.parse(body); } catch (_) {}
      }

      const { submission_id, student_code, material_id, essay_score } = body || {};

      // Find submission
      const subPhone = `QUIZ_SUB_${material_id}_${student_code}`;
      const checkRes = await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(subPhone)}&select=*`, {
        headers: { apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` }
      });

      if (checkRes.ok) {
        const rows = await checkRes.json();
        if (rows && rows[0]) {
          const row = rows[0];
          let sub = {};
          try { sub = JSON.parse(row.message_body || '{}'); } catch (_) {}

          const newScore = Number(sub.mcq_score || 0) + Number(essay_score || 0);
          sub.status = 'approved';
          sub.is_graded = true;
          sub.essay_score = Number(essay_score || 0);
          sub.total_score = newScore;
          sub.graded_at = new Date().toISOString();

          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?id=eq.${row.id}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              message_body: JSON.stringify(sub),
              status: 'approved',
              updated_at: new Date().toISOString()
            })
          });

          return res.status(200).json({ success: true, submission: sub });
        }
      }

      return res.status(404).json({ error: { message: 'Submission not found' } });
    } catch (err) {
      console.error('[api/quizzes/submissions] POST error:', err);
      return res.status(500).json({ error: { message: err.message || 'Grading failed' } });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed' } });
}
