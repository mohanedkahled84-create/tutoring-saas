import { NewSignupAlertPayload } from "./types.js";

export function formatNewSignupMessage(payload: NewSignupAlertPayload): string {
  const signupTime = new Date().toLocaleString("ar-EG", { timeZone: "Africa/Cairo" });
  const isCenter = payload.account_type === "center";

  return [
    isCenter ? "🏢 *تسجيل سنتر تعليمي جديد في المنصة!*" : "🚀 *تسجيل معلم جديد في المنصة!*",
    isCenter ? `🏢 *اسم السنتر:* ${payload.tenant_name}` : `👤 *المعلم:* ${payload.teacher_name}`,
    `🏢 *نوع الحساب:* ${isCenter ? "سنتر تعليمي (Center)" : "معلم فردي (Solo Teacher)"}`,
    `📧 *البريد:* ${payload.teacher_email}`,
    `📱 *الهاتف:* ${payload.teacher_phone || "غير مسجل"}`,
    !isCenter && payload.tenant_name ? `🏫 *المؤسسة:* ${payload.tenant_name}` : null,
    payload.subject ? `📚 *المادة:* ${payload.subject}` : null,
    payload.governorate ? `📍 *المحافظة:* ${payload.governorate}` : null,
    `⏰ *تاريخ التسجيل:* ${signupTime}`,
    `⏳ *انتهاء التجربة:* ${payload.trial_ends_at || "14 يوماً"}`,
    "⭐ *حالة الحساب:* تجربة مجانية (Trial)",
  ]
    .filter(Boolean)
    .join("\n");
}
