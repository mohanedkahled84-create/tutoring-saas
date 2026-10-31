import { createHash, randomBytes } from "node:crypto";
import { verifyParentPortalToken, generateParentPortalTokenUntil } from "./tokens.js";
import type { SupabaseClient } from "@supabase/supabase-js";

const reserved = new Set(["www", "app", "api", "admin", "dev", "mail", "portal", "login"]);
export const hashPortalTicket = (ticket: string): string => createHash("sha256").update(ticket).digest("hex");
export function portalOrigin(): string {
  const url = new URL(process.env.PUBLIC_APP_URL || "https://centerly-eg.com");
  if (url.protocol !== "https:" || url.port || url.username || url.password) throw new Error("Invalid portal origin");
  return url.origin;
}
export function trustedPortalOrigin(origin: unknown): origin is string {
  if (typeof origin !== "string") return false;
  try {
    const url = new URL(origin), base = new URL(portalOrigin());
    if (url.origin !== origin || url.protocol !== "https:" || url.port) return false;
    if (url.hostname === base.hostname) return true;
    const suffix = "." + base.hostname;
    const sub = url.hostname.endsWith(suffix) ? url.hostname.slice(0, -suffix.length) : "";
    return /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) && !reserved.has(sub);
  } catch { return false; }
}
export async function verifiedPortalStudent(db: SupabaseClient, token: unknown) {
  if (typeof token !== "string" || !token || token.length > 2048) return null;
  const identity = verifyParentPortalToken(token);
  const { data, error } = await db.rpc("portal_student_context", {
    p_student_id: identity?.student_id || null, p_tenant_id: identity?.tenant_id || null,
    p_token: identity ? null : token,
  });
  if (error) throw error;
  return data?.id && data?.tenant_id ? { ...data, expires_at: identity?.expires_at || Math.floor(Date.now()/1000) + 31536000 } : null;
}
export async function currentPortalDestination(db: SupabaseClient, tenantId: string) {
  const { data, error } = await db.rpc("portal_tenant_context", { p_tenant_id: tenantId });
  if (error) throw error;
  return portalDestinationFromContext(data);
}
export function portalDestinationFromContext(context: any) {
  const data = context?.platform;
  const sub = typeof data?.subdomain === "string" ? data.subdomain : "";
  const published = data?.is_active === true && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub)
    && !reserved.has(sub) && context?.bound_subdomain === sub;
  return {
    origin: published ? `https://${sub}.${new URL(portalOrigin()).hostname}` : portalOrigin(),
    presentation: published && data ? { subdomain: sub, display_title: data.display_title,
      theme_preset: data.theme_preset, custom_primary_color: data.custom_primary_color } : null,
  };
}
let lastHandoffCleanup = 0;
export async function createPortalHandoff(db: SupabaseClient, student: {id: string; tenant_id: string; expires_at: number}, role: "student" | "parent", targetOrigin: string) {
  const ticket = randomBytes(32).toString("base64url");
  const now = new Date();
  const { error } = await db.from("portal_handoffs").insert({ ticket_hash: hashPortalTicket(ticket),
    tenant_id: student.tenant_id, student_id: student.id, portal_role: role, target_origin: targetOrigin, session_expires_at: student.expires_at,
    expires_at: new Date(now.getTime() + 90_000).toISOString() });
  if (error) throw error;
  // Expiration is enforced on redemption. Maintenance never delays a student's entry.
  if (now.getTime() - lastHandoffCleanup > 60_000) {
    lastHandoffCleanup = now.getTime();
    void Promise.resolve(db.from("portal_handoffs").delete().lt("expires_at", now.toISOString()))
      .catch(() => { lastHandoffCleanup = 0; });
  }
  return ticket;
}
export async function consumePortalHandoff(db: SupabaseClient, ticket: unknown, origin: unknown) {
  if (typeof ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(ticket) || !trustedPortalOrigin(origin)) return null;
  // Atomic redemption, student existence and current publication in one database trip.
  const { data, error } = await db.rpc("consume_portal_entry_handoff", {
    p_ticket_hash: hashPortalTicket(ticket), p_origin: origin,
  });
  if (error) throw error;
  if (!data?.context?.id || Number(data.session_expires_at) <= Math.floor(Date.now()/1000)) return null;
  const destination = portalDestinationFromContext(data.context);
  // Reject a ticket for a platform that was deactivated or renamed during transfer.
  if (destination.origin !== origin) return null;
  return { token: generateParentPortalTokenUntil(data.student_id, data.tenant_id, Number(data.session_expires_at)), role: data.portal_role,
    ...destination };
}
