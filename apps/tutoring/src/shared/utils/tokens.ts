import crypto from "crypto";
import { config } from "../config/index.js";

/**
 * DEV-34: Generates a tamper-proof HMAC-signed parent portal token
 */
export function generateParentPortalToken(
  studentId: string,
  tenantId: string,
  expiresInDays = 30
): string {
  const secret = config.internalApiSecret || "centrly-fallback-parent-secret";
  const expiresAt = Math.floor(Date.now() / 1000) + expiresInDays * 24 * 60 * 60;
  const payload = `${tenantId}:${studentId}:${expiresAt}`;
  const hmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${hmac}`).toString("base64url");
}

/**
 * DEV-34: Verifies the HMAC-signature and expiration of a parent portal token.
 * Prevents tampering with student_id or tenant_id.
 */
export function verifyParentPortalToken(
  token: string
): { student_id: string; tenant_id: string; expires_at: number } | null {
  try {
    const secret = config.internalApiSecret || "centrly-fallback-parent-secret";
    const decoded = Buffer.from(token, "base64url").toString("utf8");
    const parts = decoded.split(":");
    if (parts.length !== 4) return null;

    const [tenantId, studentId, expiresAtStr, receivedHmac] = parts;
    const expiresAt = parseInt(expiresAtStr, 10);
    if (isNaN(expiresAt) || expiresAt < Math.floor(Date.now() / 1000)) {
      return null; // Expired
    }

    const payload = `${tenantId}:${studentId}:${expiresAt}`;
    const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");

    if (
      receivedHmac.length !== expectedHmac.length ||
      !crypto.timingSafeEqual(Buffer.from(receivedHmac), Buffer.from(expectedHmac))
    ) {
      return null; // Invalid signature / tampered
    }

    return { tenant_id: tenantId, student_id: studentId, expires_at: expiresAt };
  } catch {
    return null;
  }
}
