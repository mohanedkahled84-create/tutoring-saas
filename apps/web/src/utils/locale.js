import { getLocale, applyLocale, setLocale } from './language.js?v=9.95.0';
export { getLocale, applyLocale, setLocale };

export const localeMessages = {
  ar: {
    'language.ar': 'العربية', 'language.en': 'English',
    'brand.admin': 'لوحة الإدارة المركزية', 'brand.center': 'منظومة إدارة السنتر', 'brand.teacher': 'المنظومة الذكية لإدارة الحصص',
    'nav.logout': 'تسجيل الخروج', 'nav.locked': 'غير متاح ضمن صلاحياتك', 'nav.lockedBadge': 'مقفول',
    'section.admin': 'إدارة المنظومة (Centrly HQ)', 'section.smart': 'منصتي والتعليم الذكي (تجربة المعلم PRO)', 'section.security': 'الرقابة والأمان العام',
    'section.centerOps': 'تشغيل السنتر والقاعات', 'section.centerTeam': 'المدرسين وفريق العمل والطلاب', 'section.centerAdmin': 'الإدارة والماليات',
    'section.daily': 'العمليات اليومية للحصة', 'section.quizzes': 'منظومة الكويزات والامتحانات', 'section.platform': 'منصتي والتعليم الذكي (PRO)',
    'section.roster': 'إدارة الطلاب والمجاميع وفريق العمل', 'section.reports': 'الأرباح والتقارير الأكاديمية', 'section.settings': 'الإعدادات والاشتراك', 'section.followup': 'متابعة الطلاب والتحصيل',
  },
  en: {
    'language.ar': 'Arabic', 'language.en': 'English',
    'brand.admin': 'Platform administration', 'brand.center': 'Learning center management', 'brand.teacher': 'Smart class management',
    'nav.logout': 'Sign out', 'nav.locked': 'Unavailable with your permissions', 'nav.lockedBadge': 'Locked',
    'section.admin': 'Administration', 'section.smart': 'Learning platform (PRO)', 'section.security': 'Security',
    'section.centerOps': 'Center operations', 'section.centerTeam': 'People', 'section.centerAdmin': 'Finance & admin',
    'section.daily': 'Daily classes', 'section.quizzes': 'Quizzes & exams', 'section.platform': 'My platform (PRO)',
    'section.roster': 'Students & staff', 'section.reports': 'Earnings & reports', 'section.settings': 'Settings', 'section.followup': 'Student follow-up',
  },
};

export const sidebarRouteMessages = {
  'admin-dashboard': 'Statistics and revenue', 'admin-proofs': 'Review payment receipts', 'admin-tenants': 'Teachers and learning centers',
  'announcement-admin': 'Study messages and templates', 'admin-support': 'Subscriber support requests', 'whatsapp-inbox': 'WhatsApp inbox and revenue',
  'admin-outreach': 'Outreach campaigns', coupons: 'Discount codes and coupons',
  'platform-builder': 'Build and customize your platform', 'video-lessons': 'Lesson videos', quizzes: 'Quizzes and exams',
  announcements: 'Messages and announcements', sessions: 'Start a class and take attendance', homework: 'Review homework', materials: 'Study materials', 'activity-logs': 'Activity log',
  'center-sessions': 'Classes and active rooms', 'center-dashboard': 'Center dashboard and revenue', 'center-rooms': 'Rooms and labs',
  'center-teachers': 'Approved teachers', 'center-assistants': 'Assistants and front desk', groups: 'Learning groups', students: 'Student directory',
  calendar: 'Class schedule', 'student-cards': 'Student cards', settings: 'Settings', billing: 'Subscription', support: 'Help and support',
  'online-quizzes': 'Online quizzes', 'paper-exams': 'Paper exams and bubble sheets', assistants: 'Manage assistants',
  dashboard: 'Teacher dashboard and earnings', reports: 'Reports', 'risk-watchlist': 'Student risk alerts',
};

export const startupMessages = {
  ar: { intro:'قائمة اختيارية تساعدك تبدأ بالترتيب اللي يناسبك. تقدر تستخدم المنصة وتسيب أي خطوة لوقت لاحق.', progress:'أنجزت {done} من {total}', progressLabel:'تقدم خطوات البداية', done:'تم · ', open:'فتح الصفحة', start:'ابدأ الخطوة', help:'محتاج مساعدة في الإعداد؟ فريق الدعم يقدر يساعدك.', contact:'تواصل مع الدعم', title:'خطواتك الأولى في سنترلي', loading:'جار قراءة تقدمك', error:'تعذر تحميل قائمة البداية', retry:'حاول مجددًا' },
  en: { intro:'This optional checklist helps you get started at your own pace. You can use the platform and return to any step later.', progress:'Completed {done} of {total}', progressLabel:'Getting started progress', done:'Done · ', open:'Open page', start:'Start step', help:'Need help getting set up? Our support team can help.', contact:'Contact support', title:'Your first steps in Centerly', loading:'Loading your progress', error:'Could not load the getting started checklist', retry:'Try again' },
};
export const startupStepEnglish = { profile:'Complete your profile, subject, and contact number', group:'Add your first group', student:'Add students or import them from a file', links:'Set up student sign-in and follow-up links', content:'Add your first assignment or learning material', platform:'Set up your platform identity and teacher link', session:'Record and end your first class', attendance:'Record a student as present or absent' };

export const messageLogMessages = {
  ar: {title:'سجل رسائل الواتساب وحالة التسليم',description:'متابعة الرسائل المرسلة لأولياء الأمور، كشف أخطاء التسليم، وإعادة الإرسال يدوياً',delivered:'تم التسليم',failed:'فشل الإرسال',all:'الكل',errors:'الأخطاء فقط',sent:'المرسلة بنجاح',student:'اسم الطالب',phone:'رقم ولي الأمر',type:'نوع الرسالة',status:'حالة التسليم',time:'وقت الإرسال',details:'تفاصيل الخطأ',action:'إجراء يدوي',notification:'إشعار',deliveryFailed:'فشل التسليم',review:'يحتاج مراجعة',resend:'إعادة إرسال',complete:'مكتمل',empty:'لا توجد سجلات رسائل بعد. الرسائل المرسلة لأولياء الأمور ستظهر هنا فور إرسالها.'},
  en: {title:'WhatsApp message history and delivery status',description:'Track messages to parents, identify delivery problems, and resend messages manually.',delivered:'Delivered',failed:'Failed',all:'All',errors:'Errors only',sent:'Delivered',student:'Student name',phone:'Parent phone',type:'Message type',status:'Delivery status',time:'Sent at',details:'Error details',action:'Manual action',notification:'Notification',deliveryFailed:'Delivery failed',review:'Needs review',resend:'Resend',complete:'Complete',empty:'No message history yet. Messages sent to parents will appear here.'},
};

export function translate(key, locale = getLocale()) {
  return localeMessages[locale]?.[key] || localeMessages.ar[key] || key;
}

export function translateSidebarRoute(routeId, fallback, locale = getLocale()) {
  if (locale !== 'en') return fallback;
  return sidebarRouteMessages[routeId] || fallback;
}
