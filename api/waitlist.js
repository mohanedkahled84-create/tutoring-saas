// In-memory IP rate limiter: 5 requests per minute per IP (SEC-HOTFIX M-01)
const waitlistRateLimitStore = new Map();
const WAITLIST_WINDOW_MS = 60 * 1000;
const WAITLIST_MAX_REQUESTS = 5;

export function checkWaitlistRateLimit(ip) {
  const now = Date.now();
  const record = waitlistRateLimitStore.get(ip);

  // Periodic pruning of expired records
  if (waitlistRateLimitStore.size > 1000) {
    for (const [key, item] of waitlistRateLimitStore.entries()) {
      if (item.resetAt <= now) waitlistRateLimitStore.delete(key);
    }
  }

  if (!record || record.resetAt <= now) {
    waitlistRateLimitStore.set(ip, { count: 1, resetAt: now + WAITLIST_WINDOW_MS });
    return { limited: false, remaining: WAITLIST_MAX_REQUESTS - 1 };
  }

  if (record.count >= WAITLIST_MAX_REQUESTS) {
    return {
      limited: true,
      remaining: 0,
      resetInSeconds: Math.max(1, Math.ceil((record.resetAt - now) / 1000)),
    };
  }

  record.count += 1;
  return { limited: false, remaining: WAITLIST_MAX_REQUESTS - record.count };
}

export function resetRateLimiterForTesting() {
  waitlistRateLimitStore.clear();
}

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }

  // IP-based Rate Limiting (5 requests/minute per IP)
  const clientIp = (req.headers && req.headers['x-forwarded-for'])
    ? String(req.headers['x-forwarded-for']).split(',')[0].trim()
    : req.socket?.remoteAddress || req.connection?.remoteAddress || '127.0.0.1';

  const rateCheck = checkWaitlistRateLimit(clientIp);
  if (rateCheck.limited) {
    console.warn(`[WaitlistRateLimit] IP ${clientIp} exceeded rate limit (${WAITLIST_MAX_REQUESTS} req/min)`);
    res.setHeader('Retry-After', String(rateCheck.resetInSeconds || 60));
    return res.status(429).json({
      success: false,
      error: {
        code: 'RATE_LIMITED',
        message: 'تم تجاوز الحد المسموح به من المحاولات. برجاء الانتظار دقيقة والمحاولة مرة أخرى.',
      },
      message: 'تم تجاوز الحد المسموح به من المحاولات. برجاء الانتظار دقيقة والمحاولة مرة أخرى.',
    });
  }

  try {
    let parsedBody = req.body;
    if (typeof parsedBody === 'string') {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch (e) {
        console.error('Failed to parse body string:', e);
      }
    }
    const { fullname, phone, email, account_type, subject, location, rooms_count, capacity, website_url } = parsedBody || {};
    const finalLocation = location ? (rooms_count ? `${location} (${rooms_count} قاعات)` : location) : (rooms_count ? `${rooms_count} قاعات` : '');

    // Honeypot spam trap: if hidden field is filled, silently return 200 without calling Airtable
    if (website_url) {
      console.warn(`[Honeypot] Spam submission silently dropped for IP: ${clientIp}`);
      return res.status(200).json({
        success: true,
        message: 'تم تسجيل حجزك بنجاح وحفظ كود خصم الـ 20%! سنتواصل معك عبر الواتساب لتأكيد موعد تجربتك المجانية.',
      });
    }

    if (!fullname || !phone) {
      return res.status(400).json({ success: false, message: 'الاسم ورقم الواتساب مطلوبان' });
    }

    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY || process.env.AIRTABLE_PAT;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID || 'appZNeYmlt2X9HgG8';
    const AIRTABLE_TABLE_NAME = process.env.AIRTABLE_TABLE_NAME || 'Centerly Waitlist';

    if (AIRTABLE_API_KEY && AIRTABLE_BASE_ID) {
      const airtableUrl = `https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${encodeURIComponent(AIRTABLE_TABLE_NAME)}`;
      
      const response = await fetch(airtableUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          records: [
            {
              fields: {
                "الاسم": fullname,
                "رقم الواتساب": phone,
                "البريد الإلكتروني": email || '',
                "نوع الحساب": account_type === 'center' ? 'سنتر تعليمي' : 'مدرس مستقل',
                "المادة أو المحافظة": subject || finalLocation || '',
                "عدد الطلاب": capacity || '',
                "الحالة": "جديد"
              }
            }
          ]
        })
      });

      if (!response.ok) {
        const errorDetails = await response.text();
        console.error('Airtable Error:', errorDetails);
        return res.status(500).json({ success: false, message: 'خطأ في الربط مع Airtable: ' + errorDetails });
      }
    } else {
      console.warn('AIRTABLE_API_KEY missing: storing waitlist submission in server logs as fallback', {
        fullname,
        phone,
        email,
        account_type,
        subject,
        location: finalLocation,
        capacity,
        receivedAt: new Date().toISOString()
      });
    }

    return res.status(200).json({
      success: true,
      message: 'تم تسجيل حجزك بنجاح وحفظ كود خصم الـ 20%! سنتواصل معك عبر الواتساب لتأكيد موعد تجربتك المجانية.'
    });
  } catch (error) {
    console.error('Waitlist internal handler error:', error);
    return res.status(500).json({
      success: false,
      message: 'حصل خطأ، برجاء المحاولة تاني أو التواصل معنا على الواتساب.'
    });
  }
}
