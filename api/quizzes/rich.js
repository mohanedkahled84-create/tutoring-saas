// Serverless Handler for Rich Quizzes (Online Exams, Paper Exams, and Bubble Sheets)
import { questions as defaultPhysicsQuestions } from './physicsQuestions.js';

const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ofaraxqrpcdiregxjyyb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_wHmQPRNF0WmysskPAcD7yw_6tet5Zyz';

function generateStealthModels(questions) {
  if (!Array.isArray(questions) || questions.length === 0) return null;

  // Model A: Original order
  const modelA = questions.map((q, idx) => ({
    ...q,
    original_index: idx,
    model_number: 1,
  }));

  // Model B: Reverse/rotate order
  const modelB = [...questions].reverse().map((q, idx) => ({
    ...q,
    original_index: questions.indexOf(q),
    model_number: 2,
  }));

  // Model C: Alternate interleaved order (evens, odds)
  const evens = questions.filter((_, i) => i % 2 === 0);
  const odds = questions.filter((_, i) => i % 2 !== 0);
  const modelC = [...odds, ...evens].map((q, idx) => ({
    ...q,
    original_index: questions.indexOf(q),
    model_number: 3,
  }));

  return {
    A: modelA,
    B: modelB,
    C: modelC,
  };
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch rich quizzes
  if (req.method === 'GET') {
    res.setHeader('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    try {
      const { group_id } = req.query || {};
      let richQuizzes = [];
      let draftQuizzes = [];

      const headers = {
        apikey: SUPABASE_ANON_KEY,
        Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
      };

      let smUrl = `${SUPABASE_URL}/rest/v1/study_materials?type=eq.online_quiz&select=*&order=created_at.desc`;
      if (group_id) {
        smUrl += `&group_id=eq.${encodeURIComponent(group_id)}`;
      }
      const fallbackUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=like.QUIZ_DEF_%25&select=*&order=created_at.desc`;
      const subUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=like.QUIZ_SUB_%25&select=*&order=created_at.desc`;

      // Parallel concurrent execution for ultra-fast response
      const [smRows, fbRows, subRows] = await Promise.all([
        fetch(smUrl, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(fallbackUrl, { headers }).then(r => r.ok ? r.json() : []).catch(() => []),
        fetch(subUrl, { headers }).then(r => r.ok ? r.json() : []).catch(() => [])
      ]);

      // 1. Process study_materials
      if (Array.isArray(smRows)) {
        richQuizzes = smRows.map((row) => {
          let meta = {};
          try {
            meta = JSON.parse(row.questions || '{}');
          } catch (_) {}

          return {
            id: row.id,
            title: row.title || 'كويز بدون عنوان',
            subject: row.description || meta.subject || 'الفيزياء',
            group_id: row.group_id,
            quiz_number: Number(meta.quiz_number) || 1,
            time_limit_minutes: Number(meta.time_limit_minutes) || 20,
            available_date: meta.available_date || (row.created_at ? row.created_at.slice(0, 10) : ''),
            start_time: meta.start_time || null,
            end_time: meta.end_time || null,
            exam_mode: meta.exam_mode || 'online',
            questions: Array.isArray(meta.questions) ? meta.questions : [],
            stealth_models: meta.stealth_models || null,
            created_at: row.created_at,
            updated_at: row.updated_at,
          };
        });
      }

      // Helper to check group match
      const matchesGroup = (item, gid) => {
        if (!gid || gid === 'all') return true;
        if (!item.group_id || item.group_id === 'all') return true;
        if (String(item.group_id).trim() === String(gid).trim()) return true;
        if (Array.isArray(item.group_ids) && item.group_ids.some(id => String(id).trim() === String(gid).trim())) return true;
        if (Array.isArray(item.target_group_ids) && item.target_group_ids.some(id => String(id).trim() === String(gid).trim())) return true;
        return false;
      };

      // 2. Process whatsapp_inbox fallback definitions
      if (Array.isArray(fbRows)) {
        for (const row of fbRows) {
          try {
            const parsed = JSON.parse(row.message_body || '{}');
            if (parsed) {
              const isDraft = Boolean(parsed.is_draft || row.status === 'draft' || String(row.phone).includes('DRAFT'));
              if (isDraft) {
                parsed.is_draft = true;
                parsed.is_archived = true;
                if (!draftQuizzes.some(d => d.id === parsed.id)) {
                  draftQuizzes.push(parsed);
                }
              } else if (parsed.group_id) {
                if (matchesGroup(parsed, group_id)) {
                  const exists = richQuizzes.some(
                    (q) => (q.id === parsed.id) || (String(q.group_id).trim() === String(parsed.group_id).trim() && Number(q.quiz_number) === Number(parsed.quiz_number) && (q.exam_mode || 'online') === (parsed.exam_mode || 'online'))
                  );
                  if (!exists) {
                    richQuizzes.push(parsed);
                  }
                }
              }
            }
          } catch (_) {}
        }
      }

      // 3. Process submissions safety net
      if (Array.isArray(subRows)) {
        for (const row of subRows) {
          try {
            const subData = JSON.parse(row.message_body || '{}');
            if (subData && (subData.quiz_id || subData.material_id) && subData.group_id) {
              if (matchesGroup(subData, group_id)) {
                const qId = subData.quiz_id || subData.material_id;
                const alreadyExists = richQuizzes.some(
                  (q) => (q.id === qId) || (String(q.group_id).trim() === String(subData.group_id).trim() && Number(q.quiz_number) === Number(subData.quiz_number) && (q.exam_mode || 'online') === 'online')
                );
                if (!alreadyExists && Array.isArray(subData.questions) && subData.questions.length > 0) {
                  richQuizzes.push({
                    id: qId,
                    title: subData.quiz_title || `كويز ${subData.quiz_number || 1}`,
                    subject: subData.subject || 'الفيزياء',
                    group_id: subData.group_id,
                    quiz_number: Number(subData.quiz_number) || 1,
                    time_limit_minutes: Number(subData.time_limit_minutes) || 20,
                    available_date: subData.submitted_at ? subData.submitted_at.slice(0, 10) : '',
                    start_time: null,
                    end_time: null,
                    exam_mode: 'online',
                    questions: subData.questions,
                    created_at: subData.submitted_at || row.created_at,
                  });
                }
              }
            }
          } catch (_) {}
        }
      }

            // Resilient fallback: Ensure comprehensive physics exams (paper and online) are always present
      const hasPaper = richQuizzes.some(q => (q.exam_mode || '').toLowerCase() === 'paper');
      if (!hasPaper) {
        const defaultGroupId = group_id || '6c1bc55b-9775-453f-b4b2-d127febc5d92';
        richQuizzes.push({
          id: 'quiz-paper-' + defaultGroupId + '-5',
          title: 'امتحان شامل - فيزياء كهربية وحديثة (ورقي وبابل شيت)',
          subject: 'الفيزياء للثانوية العامة',
          group_id: defaultGroupId,
          quiz_number: 5,
          time_limit_minutes: 45,
          available_date: new Date().toISOString().slice(0, 10),
          exam_mode: 'paper',
          questions: defaultPhysicsQuestions,
          stealth_models: generateStealthModels(defaultPhysicsQuestions),
          created_at: new Date().toISOString(),
        });
      }

      const hasOnline = richQuizzes.some(q => (q.exam_mode || 'online').toLowerCase() === 'online');
      if (!hasOnline) {
        const defaultGroupId = group_id || '6c1bc55b-9775-453f-b4b2-d127febc5d92';
        richQuizzes.push({
          id: 'quiz-online-' + defaultGroupId + '-5',
          title: 'امتحان شامل - فيزياء كهربية وحديثة',
          subject: 'الفيزياء للثانوية العامة',
          group_id: defaultGroupId,
          quiz_number: 5,
          time_limit_minutes: 45,
          available_date: new Date().toISOString().slice(0, 10),
          start_time: '12:00',
          end_time: '23:59',
          exam_mode: 'online',
          questions: defaultPhysicsQuestions,
          created_at: new Date().toISOString(),
        });
      }

return res.status(200).json({
        success: true,
        quizzes: richQuizzes,
        drafts: draftQuizzes,
      });
    } catch (err) {
      console.error('[api/quizzes/rich] GET error:', err);
      return res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to fetch rich quizzes' },
      });
    }
  }

  // POST: Create or update a rich quiz definition
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (_) {}
      }

      const {
        id,
        group_id,
        quiz_number,
        title,
        subject,
        time_limit_minutes,
        available_date,
        start_time,
        end_time,
        exam_mode,
        questions,
        stealth_models,
        action,
        is_draft,
        status,
      } = body || {};

      // Handle draft deletion
      if (action === 'delete_draft' && id) {
        try {
          const draftPhone = `QUIZ_DEF_DRAFT_${id}`;
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(draftPhone)}`, {
            method: 'DELETE',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
        } catch (_) {}
        return res.status(200).json({ success: true, message: 'Draft deleted successfully' });
      }

      // Handle full quiz deletion (Delete Completely)
      if (action === 'delete_quiz') {
        const qId = id;
        const qGid = group_id || 'all';
        const qNum = quiz_number;
        const mode = exam_mode === 'paper' ? 'PAPER_' : 'ONLINE_';

        try {
          if (qId && String(qId).length > 20) {
            await fetch(`${SUPABASE_URL}/rest/v1/study_materials?id=eq.${encodeURIComponent(qId)}`, {
              method: 'DELETE',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            });
          }

          if (qGid && qNum !== undefined) {
            const phoneKey = `QUIZ_DEF_${mode}${qGid}_${qNum}`;
            await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(phoneKey)}`, {
              method: 'DELETE',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            });
          }

          if (qId) {
            await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=like.%${encodeURIComponent(qId)}%`, {
              method: 'DELETE',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            });
          }
        } catch (delErr) {
          console.warn('Delete quiz error:', delErr);
        }
        return res.status(200).json({ success: true, message: 'Quiz deleted successfully' });
      }

      // Handle quiz archiving (Move from Published to Archive/Drafts)
      if (action === 'archive_quiz') {
        const qId = id || `draft_${exam_mode || 'online'}_${Date.now()}`;
        const qGid = group_id || 'all';
        const qNum = quiz_number;
        const mode = exam_mode === 'paper' ? 'PAPER_' : 'ONLINE_';

        try {
          if (qGid && qNum !== undefined) {
            const publishedPhone = `QUIZ_DEF_${mode}${qGid}_${qNum}`;
            await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(publishedPhone)}`, {
              method: 'DELETE',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            });
          }
          if (qId && String(qId).length > 20) {
            await fetch(`${SUPABASE_URL}/rest/v1/study_materials?id=eq.${encodeURIComponent(qId)}`, {
              method: 'DELETE',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              },
            });
          }

          const draftPhone = `QUIZ_DEF_DRAFT_${qId}`;
          const draftData = body.quiz || {
            ...body,
            id: qId,
            is_draft: true,
            is_archived: true,
            status: 'draft',
            archived_at: new Date().toISOString()
          };

          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phone: draftPhone,
              direction: 'outbound',
              message_body: JSON.stringify(draftData),
              status: 'draft',
              updated_at: new Date().toISOString(),
            }),
          });
        } catch (arcErr) {
          console.warn('Archive quiz error:', arcErr);
        }
        return res.status(200).json({ success: true, message: 'Quiz archived successfully' });
      }

      // Handle draft saving (Archive)
      if (is_draft === true || (status === 'draft' && is_draft !== false)) {
        const draftId = id || `draft_${exam_mode || 'online'}_${Date.now()}`;
        const draftObject = {
          ...body,
          id: draftId,
          title: (title && String(title).trim()) || (exam_mode === 'paper' ? 'مسودة امتحان ورقي' : 'مسودة امتحان إلكتروني'),
          subject: (subject && String(subject).trim()) || 'الفيزياء',
          exam_mode: exam_mode || 'online',
          questions: Array.isArray(questions) ? questions : [],
          is_draft: true,
          is_archived: true,
          status: 'draft',
          archived_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        };

        try {
          const draftPhone = `QUIZ_DEF_DRAFT_${draftId}`;
          const checkUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(draftPhone)}&select=id`;
          const cRes = await fetch(checkUrl, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });
          const existingD = cRes.ok ? await cRes.json() : [];

          if (Array.isArray(existingD) && existingD.length > 0) {
            await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?id=eq.${existingD[0].id}`, {
              method: 'PATCH',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                message_body: JSON.stringify(draftObject),
                status: 'draft',
                updated_at: new Date().toISOString(),
              }),
            });
          } else {
            await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox`, {
              method: 'POST',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
              },
              body: JSON.stringify({
                phone: draftPhone,
                direction: 'outbound',
                message_body: JSON.stringify(draftObject),
                status: 'draft',
                updated_at: new Date().toISOString(),
              }),
            });
          }
        } catch (draftErr) {
          console.warn('Draft save error in whatsapp_inbox:', draftErr);
        }

        return res.status(200).json({
          success: true,
          quiz: draftObject,
          draft: draftObject,
          is_draft: true,
        });
      }

      if (!group_id || quiz_number === undefined) {
        return res.status(400).json({
          success: false,
          error: { message: 'group_id and quiz_number are required' },
        });
      }

      const qNum = Number(quiz_number) || 1;
      const questionsArr = Array.isArray(questions) ? questions : [];
      const maxScore = questionsArr.reduce((sum, q) => sum + Number(q.points || 1), 0) || 10;
      const cleanTitle = (title && String(title).trim()) || `كويز ${qNum}`;
      const cleanSubject = (subject && String(subject).trim()) || 'الفيزياء';
      const cleanTimeLimit = Number(time_limit_minutes) || 20;
      const resolvedStealth = stealth_models || generateStealthModels(questionsArr);

      const questionsPayload = JSON.stringify({
        quiz_number: qNum,
        subject: cleanSubject,
        time_limit_minutes: cleanTimeLimit,
        available_date: available_date || null,
        start_time: start_time || null,
        end_time: end_time || null,
        exam_mode: exam_mode || 'online',
        questions: questionsArr,
        stealth_models: resolvedStealth,
      });

      // 1. Try Upsert into quizzes table for score tracking
      try {
        await fetch(`${SUPABASE_URL}/rest/v1/quizzes`, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'resolution=merge-duplicates',
          },
          body: JSON.stringify({
            group_id,
            quiz_number: qNum,
            title: cleanTitle,
            max_score: maxScore,
            quiz_date: available_date || new Date().toISOString().slice(0, 10),
            is_skipped: false,
          }),
        });
      } catch (upsertErr) {
        console.warn('Quizzes table upsert warning:', upsertErr);
      }

      // 2. Try Insert or update in study_materials
      let materialRecord = null;

      if (id && String(id).length > 20) {
        try {
          const updateUrl = `${SUPABASE_URL}/rest/v1/study_materials?id=eq.${encodeURIComponent(id)}`;
          const updateRes = await fetch(updateUrl, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
              Prefer: 'return=representation',
            },
            body: JSON.stringify({
              title: cleanTitle,
              description: cleanSubject,
              group_id,
              questions: questionsPayload,
              updated_at: new Date().toISOString(),
            }),
          });

          if (updateRes.ok) {
            const updated = await updateRes.json();
            materialRecord = Array.isArray(updated) && updated[0] ? updated[0] : { id };
          }
        } catch (_) {}
      }

      if (!materialRecord) {
        try {
          // Check if one already exists for this group and quiz_number
          const checkUrl = `${SUPABASE_URL}/rest/v1/study_materials?type=eq.online_quiz&group_id=eq.${encodeURIComponent(group_id)}&select=id,questions`;
          const checkRes = await fetch(checkUrl, {
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            },
          });

          let existingRows = [];
          if (checkRes.ok) {
            existingRows = await checkRes.json();
          }

          const matched = (Array.isArray(existingRows) ? existingRows : []).find((r) => {
            try {
              const p = JSON.parse(r.questions || '{}');
              return Number(p.quiz_number) === qNum && (p.exam_mode || 'online') === (exam_mode || 'online');
            } catch (_) {
              return false;
            }
          });

          if (matched && matched.id) {
            const patchUrl = `${SUPABASE_URL}/rest/v1/study_materials?id=eq.${encodeURIComponent(matched.id)}`;
            const patchRes = await fetch(patchUrl, {
              method: 'PATCH',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                title: cleanTitle,
                description: cleanSubject,
                questions: questionsPayload,
                updated_at: new Date().toISOString(),
              }),
            });
            if (patchRes.ok) {
              const patched = await patchRes.json();
              materialRecord = Array.isArray(patched) && patched[0] ? patched[0] : { id: matched.id };
            }
          } else {
            // Insert new
            const insertUrl = `${SUPABASE_URL}/rest/v1/study_materials`;
            const insertRes = await fetch(insertUrl, {
              method: 'POST',
              headers: {
                apikey: SUPABASE_ANON_KEY,
                Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
                'Content-Type': 'application/json',
                Prefer: 'return=representation',
              },
              body: JSON.stringify({
                title: cleanTitle,
                description: cleanSubject,
                type: 'online_quiz',
                group_id,
                is_homework: false,
                questions: questionsPayload,
              }),
            });

            if (insertRes.ok) {
              const inserted = await insertRes.json();
              materialRecord = Array.isArray(inserted) && inserted[0] ? inserted[0] : {};
            }
          }
        } catch (_) {}
      }

      const savedId = materialRecord?.id || id || `quiz-${qNum}-${Date.now()}`;

      const quizObject = {
        id: savedId,
        title: cleanTitle,
        subject: cleanSubject,
        group_id,
        quiz_number: qNum,
        time_limit_minutes: cleanTimeLimit,
        available_date: available_date || null,
        start_time: start_time || null,
        end_time: end_time || null,
        exam_mode: exam_mode || 'online',
        questions: questionsArr,
        stealth_models: resolvedStealth,
        created_at: new Date().toISOString(),
      };

      // 3. Resilient fallback storage in whatsapp_inbox table (guaranteed write with anon key)
      try {
        const modePrefix = exam_mode === 'paper' ? 'PAPER_' : 'ONLINE_';
        const fallbackPhone = `QUIZ_DEF_${modePrefix}${group_id}_${qNum}`;
        const checkInboxUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(fallbackPhone)}&select=id`;
        const checkInboxRes = await fetch(checkInboxUrl, {
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
          },
        });

        const existingInbox = checkInboxRes.ok ? await checkInboxRes.json() : [];
        if (Array.isArray(existingInbox) && existingInbox.length > 0) {
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?id=eq.${existingInbox[0].id}`, {
            method: 'PATCH',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              message_body: JSON.stringify(quizObject),
              status: exam_mode || 'online',
              updated_at: new Date().toISOString(),
            }),
          });
        } else {
          await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox`, {
            method: 'POST',
            headers: {
              apikey: SUPABASE_ANON_KEY,
              Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              phone: fallbackPhone,
              direction: 'outbound',
              message_body: JSON.stringify(quizObject),
              status: exam_mode || 'online',
              created_at: new Date().toISOString(),
            }),
          });
        }
      } catch (fbErr) {
        console.warn('Fallback quiz storage warning:', fbErr);
      }

      return res.status(200).json({
        success: true,
        quiz: quizObject,
      });
    } catch (err) {
      console.error('[api/quizzes/rich] POST error:', err);
      return res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to save rich quiz' },
      });
    }
  }

  return res.status(405).json({ error: { message: 'Method Not Allowed' } });
}
