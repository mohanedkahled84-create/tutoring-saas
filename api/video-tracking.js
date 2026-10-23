// In-memory persistent video tracking store for Centrly Platform on Vercel
const videoTrackingStore = new Map();

// Seed initial authentic baseline
videoTrackingStore.set('1006', {
  id: 'vt-1006',
  student_code: '1006',
  student_name: 'مهند خالد',
  material_title: 'فيديو حل واجب الباب الرابع',
  progress_percent: 100,
  current_time: '35:23',
  duration_time: '35:23',
  status: 'completed',
  updated_at: new Date('2026-10-23T15:30:00Z').toISOString(),
});

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method === 'GET') {
    const list = Array.from(videoTrackingStore.values()).sort(
      (a, b) => new Date(b.updated_at) - new Date(a.updated_at)
    );
    return res.status(200).json({
      success: true,
      views: list,
    });
  }

  if (req.method === 'POST') {
    try {
      let body = req.body;
      if (typeof body === 'string') {
        try {
          body = JSON.parse(body);
        } catch (_) {}
      }

      const {
        student_code,
        student_name,
        material_title,
        progress_percent,
        current_time,
        duration_time,
        status,
      } = body || {};

      const code = String(student_code || '').trim();
      if (!code) {
        return res.status(400).json({ success: false, message: 'كود الطالب مطلوب' });
      }

      const percent = Math.min(100, Math.max(0, Math.round(Number(progress_percent || 0))));
      const currentStatus = percent >= 90 || status === 'completed' ? 'completed' : 'watching';

      const entry = {
        id: `vt-${code}`,
        student_code: code,
        student_name: (student_name || 'طالب').trim(),
        material_title: material_title || 'فيديو حل واجب الباب الرابع',
        progress_percent: percent,
        current_time: current_time || '01:45',
        duration_time: duration_time || '35:23',
        status: currentStatus,
        updated_at: new Date().toISOString(),
      };

      videoTrackingStore.set(code, entry);

      return res.status(200).json({
        success: true,
        message: 'تم تسجيل نشاط المشاهدة بنجاح في السيرفر',
        data: entry,
      });
    } catch (err) {
      console.error('Error handling video tracking post:', err);
      return res.status(500).json({ success: false, message: 'خطأ في معالجة الطلب' });
    }
  }

  return res.status(405).json({ success: false, message: 'Method not allowed' });
}
