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

  try {
    let parsedBody = req.body;
    if (typeof parsedBody === 'string') {
      try {
        parsedBody = JSON.parse(parsedBody);
      } catch (e) {
        console.error('Failed to parse body string:', e);
      }
    }
    const { fullname, phone, email, account_type, subject, location, rooms_count, capacity } = parsedBody || {};
    const finalLocation = location ? (rooms_count ? `${location} (${rooms_count} قاعات)` : location) : (rooms_count ? `${rooms_count} قاعات` : '');

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
