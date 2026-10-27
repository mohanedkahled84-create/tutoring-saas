// Serverless Handler for Teacher Platform Settings & Public Subdomain Configurations
const SUPABASE_URL = process.env.SUPABASE_URL || 'https://ofaraxqrpcdiregxjyyb.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || 'sb_publishable_wHmQPRNF0WmysskPAcD7yw_6tet5Zyz';

const DEFAULT_SETTINGS = {
  subdomain: 'mr-omar',
  display_title: 'منصة مستر عمر المحمدي',
  subject_title: 'فيزياء الثانوية العامة',
  headline_text: 'بوابتك التعليمية الشاملة للتفوق والدرجة النهائية',
  subtitle_text: 'هنا تجد كل ما تحتاجه من واجبات تفاعلية، امتحانات دورية، وشروحات ومذكرات معتمدة.',
  theme_preset: 'emerald',
  cutout_avatar_url: '/teacher-platform-sample/teacher_cutout.png',
  is_published: true,
  is_active: true,
};

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // GET: Fetch platform settings by subdomain
  if (req.method === 'GET') {
    try {
      const subdomain = (req.query?.subdomain || 'mr-omar').trim().toLowerCase();
      const phoneKey = `PLATFORM_SETTINGS_${subdomain}`;

      const supaUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(phoneKey)}&select=*`;
      const response = await fetch(supaUrl, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      if (response.ok) {
        const rows = await response.json();
        if (Array.isArray(rows) && rows.length > 0 && rows[0].message_body) {
          try {
            const parsed = JSON.parse(rows[0].message_body);
            return res.status(200).json({
              success: true,
              settings: {
                ...DEFAULT_SETTINGS,
                ...parsed,
                is_published: parsed.is_published !== false,
                is_active: parsed.is_active !== false,
              },
            });
          } catch (_) {}
        }
      }

      // Default fallback for mr-omar or general
      return res.status(200).json({
        success: true,
        settings: DEFAULT_SETTINGS,
      });
    } catch (err) {
      console.error('Fetch platform settings error:', err);
      return res.status(200).json({
        success: true,
        settings: DEFAULT_SETTINGS,
      });
    }
  }

  // POST: Save or update platform settings
  if (req.method === 'POST') {
    try {
      let body = {};
      try {
        if (req.body) {
          body = typeof req.body === 'string' ? JSON.parse(req.body) : req.body;
        }
      } catch (_) {
        body = {};
      }

      const subdomain = String(body.subdomain || req.query?.subdomain || 'mr-omar').trim().toLowerCase();
      const phoneKey = `PLATFORM_SETTINGS_${subdomain}`;

      // Fetch existing row first to merge fields safely
      const checkUrl = `${SUPABASE_URL}/rest/v1/whatsapp_inbox?phone=eq.${encodeURIComponent(phoneKey)}&select=*`;
      const checkRes = await fetch(checkUrl, {
        headers: {
          apikey: SUPABASE_ANON_KEY,
          Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
        },
      });

      const existing = checkRes.ok ? await checkRes.json() : [];
      let previousSettings = {};
      if (Array.isArray(existing) && existing.length > 0 && existing[0].message_body) {
        try {
          previousSettings = JSON.parse(existing[0].message_body);
        } catch (_) {}
      }

      const payload = {
        ...DEFAULT_SETTINGS,
        ...previousSettings,
        ...(body || {}),
        subdomain,
        is_published: true,
        is_active: true,
        updated_at: new Date().toISOString(),
      };

      if (Array.isArray(existing) && existing.length > 0) {
        await fetch(`${SUPABASE_URL}/rest/v1/whatsapp_inbox?id=eq.${existing[0].id}`, {
          method: 'PATCH',
          headers: {
            apikey: SUPABASE_ANON_KEY,
            Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message_body: JSON.stringify(payload),
            status: 'published',
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
            phone: phoneKey,
            direction: 'outbound',
            message_body: JSON.stringify(payload),
            status: 'published',
          }),
        });
      }

      return res.status(200).json({
        success: true,
        settings: payload,
      });
    } catch (err) {
      console.error('Save platform settings error:', err);
      return res.status(500).json({
        success: false,
        error: { message: err.message || 'Failed to save settings' },
      });
    }
  }
}
