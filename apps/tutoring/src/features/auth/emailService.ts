import { config } from "../../shared/config/index.js";
import { logger } from "../../shared/utils/logger.js";

export interface SendVerificationEmailOptions {
  email: string;
  code: string;
  fullName?: string;
}

export interface SendEmailResult {
  success: boolean;
  id?: string;
  error?: string;
}

export function formatVerificationEmailHtml(code: string, fullName?: string): string {
  const greeting = fullName ? `أهلاً بك يا أستاذ ${fullName} 👋` : "أهلاً بك في منصة سنترلي 👋";

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>تأكيد بريدك الإلكتروني - Centrly</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; direction: rtl; text-align: right;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #0f766e 0%, #0d9488 100%); padding: 32px 24px; text-align: center;">
              <img src="https://centerly-eg.com/favicon.png" alt="Centrly Logo" width="54" height="54" style="width: 54px; height: 54px; border-radius: 12px; margin-bottom: 12px; display: inline-block; vertical-align: middle; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Centrly | سنترلي</h1>
              <p style="color: #ccfbf1; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">المنصة الذكية لإدارة المدرسين والمراكز التعليمية</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">${greeting}</h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                شكراً لانضمامك إلى منصة سنترلي! لتأكيد بريدك الإلكتروني وتفعيل حسابك والبدء في إدارة حصصك وطلابك، يرجى إدخال رمز التحقق التالي:
              </p>

              <!-- OTP Code Display -->
              <div style="background-color: #f0fdf4; border: 2px dashed #16a34a; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0;">
                <div style="font-size: 13px; color: #15803d; font-weight: 600; margin-bottom: 8px;">رمز التحقق الخاص بك (OTP)</div>
                <div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #14532d; font-family: monospace;">${code}</div>
                <div style="font-size: 12px; color: #16a34a; margin-top: 8px;">صالح لمدة 15 دقيقة فقط</div>
              </div>

              <p style="margin: 0 0 12px 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                إذا لم تكن قد طلبت إنشاء حساب في منصة سنترلي، يمكنك تجاهل هذا البريد الإلكتروني بأمان دون أي إجراء.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © 2026 Centrly Platform. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export class EmailVerificationService {
  private resendApiKey: string;
  private fromEmail: string;

  constructor(apiKey?: string, fromEmail?: string) {
    this.resendApiKey = apiKey || config.resendApiKey || process.env.RESEND_API_KEY || "";
    const envFrom = process.env.RESEND_FROM_EMAIL;
    if (fromEmail) {
      this.fromEmail = fromEmail;
    } else if (envFrom && !envFrom.includes("resend.dev")) {
      this.fromEmail = envFrom;
    } else {
      this.fromEmail = "Centrly <no-reply@centerly-eg.com>";
    }
  }

  async sendVerificationEmail(options: SendVerificationEmailOptions): Promise<SendEmailResult> {
    const { email, code, fullName } = options;
    const normalizedEmail = email.trim().toLowerCase();

    // Fallback if API key is not configured or in test mode
    if (!this.resendApiKey || this.resendApiKey.length < 5 || process.env.NODE_ENV === "test") {
      logger.info(
        `[AuthEmail] RESEND_API_KEY not set or test mode. Mock OTP code for ${normalizedEmail} is: [${code}]`
      );
      return {
        success: true,
        id: `mock-resend-id-${Date.now()}`,
      };
    }

    try {
      const html = formatVerificationEmailHtml(code, fullName);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: normalizedEmail,
          subject: `رمز تأكيد بريدك الإلكتروني في منصة Centrly: ${code}`,
          html,
          text: `رمز تأكيد حسابك في منصة سنترلي هو: ${code} - صالح لمدة 15 دقيقة.`,
        }),
      });

      const responseBody = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

      if (!res.ok) {
        logger.error(`[AuthEmail] Resend API error (${res.status}):`, responseBody);
        return {
          success: false,
          error: responseBody?.message || `Resend API failed with status ${res.status}`,
        };
      }

      logger.info(`[AuthEmail] Verification email delivered via Resend to ${normalizedEmail} (ID: ${responseBody?.id})`);
      return {
        success: true,
        id: responseBody?.id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AuthEmail] Failed to send verification email to ${normalizedEmail}:`, err);
      return {
        success: false,
        error: msg,
      };
    }
  }

  async sendPinResetEmail(options: SendVerificationEmailOptions): Promise<SendEmailResult> {
    const { email, code, fullName } = options;
    const normalizedEmail = email.trim().toLowerCase();

    // Fallback if API key is not configured or in test mode
    if (!this.resendApiKey || this.resendApiKey.length < 5 || process.env.NODE_ENV === "test") {
      logger.info(
        `[AuthEmail] RESEND_API_KEY not set or test mode. Mock PIN reset OTP code for ${normalizedEmail} is: [${code}]`
      );
      return {
        success: true,
        id: `mock-resend-pin-${Date.now()}`,
      };
    }

    try {
      const html = formatPinResetEmailHtml(code, fullName);
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${this.resendApiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: this.fromEmail,
          to: normalizedEmail,
          subject: `رمز إعادة تعيين رمز الأمان (PIN) في منصة Centrly: ${code}`,
          html,
          text: `رمز إعادة تعيين رمز الأمان للبيانات المالية في سنترلي هو: ${code} - صالح لمدة 15 دقيقة.`,
        }),
      });

      const responseBody = (await res.json().catch(() => null)) as { id?: string; message?: string } | null;

      if (!res.ok) {
        logger.error(`[AuthEmail] Resend PIN reset error (${res.status}):`, responseBody);
        return {
          success: false,
          error: responseBody?.message || `Resend API failed with status ${res.status}`,
        };
      }

      logger.info(`[AuthEmail] PIN reset email delivered via Resend to ${normalizedEmail}`);
      return {
        success: true,
        id: responseBody?.id,
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      logger.error(`[AuthEmail] Failed to send PIN reset email to ${normalizedEmail}:`, err);
      return {
        success: false,
        error: msg,
      };
    }
  }
}

export function formatPinResetEmailHtml(code: string, fullName?: string): string {
  const greeting = fullName ? `أهلاً بك يا أستاذ ${fullName}` : "أهلاً بك";

  return `
<!DOCTYPE html>
<html dir="rtl" lang="ar">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>رمز إعادة تعيين رمز الأمان - Centrly</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f8fafc; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b; direction: rtl; text-align: right;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; padding: 40px 16px;">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" style="max-width: 520px; background-color: #ffffff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05); overflow: hidden;">
          
          <!-- Header Banner -->
          <tr>
            <td style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); padding: 32px 24px; text-align: center;">
              <img src="https://centerly-eg.com/favicon.png" alt="Centrly Logo" width="54" height="54" style="width: 54px; height: 54px; border-radius: 12px; margin-bottom: 12px; display: inline-block; vertical-align: middle; box-shadow: 0 4px 12px rgba(0,0,0,0.15);" />
              <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">Centrly | سنترلي</h1>
              <p style="color: #dbeafe; margin: 6px 0 0 0; font-size: 14px; font-weight: 500;">حماية وأمان الحسابات والبيانات المالية</p>
            </td>
          </tr>

          <!-- Main Content -->
          <tr>
            <td style="padding: 32px 28px;">
              <h2 style="margin: 0 0 16px 0; color: #0f172a; font-size: 20px; font-weight: 700;">${greeting}</h2>
              <p style="margin: 0 0 20px 0; color: #475569; font-size: 15px; line-height: 1.6;">
                تم طلب إعادة تعيين رمز الأمان (PIN) الخاص بالصفحات والبيانات المالية في حسابك. يرجى استخدام رمز التحقق التالي لإتمام العملية وتعيين رمزك الجديد:
              </p>

              <!-- OTP Code Display -->
              <div style="background-color: #eff6ff; border: 2px dashed #2563eb; border-radius: 12px; padding: 20px; text-align: center; margin: 28px 0;">
                <div style="font-size: 13px; color: #1d4ed8; font-weight: 600; margin-bottom: 8px;">رمز التحقق لإعادة تعيين الـ PIN</div>
                <div style="font-size: 34px; font-weight: 800; letter-spacing: 10px; color: #1e3a8a; font-family: monospace;">${code}</div>
                <div style="font-size: 12px; color: #2563eb; margin-top: 8px;">صالح لمدة 15 دقيقة فقط</div>
              </div>

              <p style="margin: 0 0 12px 0; color: #ef4444; font-size: 13px; font-weight: 600; line-height: 1.5;">
                تنبيه أمني: لا تشارك هذا الرمز مع أي شخص، بما في ذلك المساعدين أو الدعم الفني.
              </p>
              <p style="margin: 0; color: #64748b; font-size: 13px; line-height: 1.5;">
                إذا لم تكن قد طلبت إعادة تعيين رمز الأمان، يرجى تجاهل هذا البريد، ولن يتم تغيير أي شيء في حسابك.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f1f5f9; padding: 20px 24px; text-align: center; border-top: 1px solid #e2e8f0;">
              <p style="margin: 0; color: #94a3b8; font-size: 12px;">
                © 2026 Centrly Platform. جميع الحقوق محفوظة.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

export const defaultEmailVerificationService = new EmailVerificationService();

