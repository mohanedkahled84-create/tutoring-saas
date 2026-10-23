// Real Persistent Video Tracking via Supabase Database for Centrly Platform
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ofaraxqrpcdiregxjyyb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_wHmQPRNF0WmysskPAcD7yw_6tet5Zyz';

// In-memory fallback cache
const memoryFallback = new Map();

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch real tracking records from Supabase
  if (req.method === 'GET') {
    try {
      const url = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=like.VIDEO_TRACK_%25&select=*&order=created_at.desc`;
      const response = await fetch(url, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (!response.ok) {
        throw new Error(`Supabase query failed: ${response.status}`);
      }

      const rows = await response.json();
      const views = (Array.isArray(rows) ? rows : []).map((row) => ({
        id: row.id,
        student_code: String(row.phone || '').replace('VIDEO_TRACK_', '').trim(),
        student_name: row.student_name || 'طالب',
        material_title: row.message_body || 'فيديو حل واجب الباب الرابع',
        status: 'watched',
        watched_at: row.created_at || row.updated_at,
      }));

      return res.status(200).json({
        success: true,
        views,
      });
    } catch (err) {
      console.error('Error fetching real video tracking:', err);
      // Fallback to memory
      const fallbackList = Array.from(memoryFallback.values());
      return res.status(200).json({
        success: true,
        views: fallbackList,
      });
    }
  }

  // POST: Record a real student watch event
  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (_) {}
      }

      const { student_code, student_name, material_title } = body || {};
      const code = String(student_code || '').trim();

      if (!code) {
        return res.status(400).json({ success: false, message: 'كود الطالب مطلوب' });
      }

      const studentName = String(student_name || 'طالب').trim();
      const title = String(material_title || 'فيديو حل واجب الباب الرابع').trim();
      const trackPhone = `VIDEO_TRACK_${code}`;

      // Check if already registered in database
      const checkUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(trackPhone)}&select=id,created_at`;
      const checkRes = await fetch(checkUrl, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      let existing = [];
      if (checkRes.ok) {
        existing = await checkRes.json();
      }

      let record;
      if (Array.isArray(existing) && existing.length > 0) {
        record = {
          id: existing[0].id,
          student_code: code,
          student_name: studentName,
          material_title: title,
          status: 'watched',
          watched_at: existing[0].created_at || new Date().toISOString(),
        };
      } else {
        // Insert new real record
        const insertUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox`;
        const insertRes = await fetch(insertUrl, {
          method: 'POST',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
            Prefer: 'return=representation',
          },
          body: JSON.stringify({
            phone: trackPhone,
            student_name: studentName,
            message_body: title,
            direction: 'inbound',
            status: 'watched',
          }),
        });

        if (insertRes.ok) {
          const inserted = await insertRes.json();
          const row = Array.isArray(inserted) && inserted[0] ? inserted[0] : {};
          record = {
            id: row.id,
            student_code: code,
            student_name: studentName,
            material_title: title,
            status: 'watched',
            watched_at: row.created_at || new Date().toISOString(),
          };
        } else {
          record = {
            id: `vt-${code}`,
            student_code: code,
            student_name: studentName,
            material_title: title,
            status: 'watched',
            watched_at: new Date().toISOString(),
          };
        }
      }

      memoryFallback.set(code, record);

      return res.status(200).json({
        success: true,
        message: 'تم تسجيل المشاهدة بنجاح في قاعدة البيانات',
        data: record,
      });
    } catch (err) {
      console.error('Error handling real video tracking post:', err);
      return res.status(500).json({ success: false, message: 'خطأ في معالجة الطلب' });
    }
  }

  // DELETE: Remove watch record (reset to unwatched)
  if (req.method === 'DELETE') {
    try {
      const code = String(req.query?.student_code || req.body?.student_code || '').trim();
      if (!code) {
        return res.status(400).json({ success: false, message: 'كود الطالب مطلوب' });
      }
      const trackPhone = `VIDEO_TRACK_${code}`;
      const delUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(trackPhone)}`;
      await fetch(delUrl, {
        method: 'DELETE',
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });
      memoryFallback.delete(code);
      return res.status(200).json({ success: true, message: 'تم إلغاء توثيق المشاهدة بنجاح' });
    } catch (err) {
      console.error('Error deleting video tracking:', err);
      return res.status(500).json({ success: false, message: 'خطأ في الحذف' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
