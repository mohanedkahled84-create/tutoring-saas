import { createHash, randomBytes } from "node:crypto";
import { verifyParentPortalToken, generateParentPortalToken } from "./tokens.js";
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
  let query = db.from("students").select("id,tenant_id");
  query = identity ? query.eq("id", identity.student_id).eq("tenant_id", identity.tenant_id)
    : query.eq("parent_portal_token", token);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data?.id && data?.tenant_id ? data : null;
}
export async function currentPortalDestination(db: SupabaseClient, tenantId: string) {
  const { data, error } = await db.from("tenant_platform_settings")
    .select("subdomain,is_active,display_title,theme_preset,custom_primary_color")
    .eq("tenant_id", tenantId).maybeSingle();
  if (error) throw error;
  const sub = typeof data?.subdomain === "string" ? data.subdomain : "";
  const published = data?.is_active === true && /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/.test(sub) && !reserved.has(sub);
  return {
    origin: published ? `https://${sub}.${new URL(portalOrigin()).hostname}` : portalOrigin(),
    presentation: published ? { subdomain: sub, display_title: data.display_title,
      theme_preset: data.theme_preset, custom_primary_color: data.custom_primary_color } : null,
  };
}
export async function createPortalHandoff(db: SupabaseClient, student: {id: string; tenant_id: string}, role: "student" | "parent", targetOrigin: string) {
  const ticket = randomBytes(32).toString("base64url");
  const now = new Date();
  const cleanup = await db.from("portal_handoffs").delete().lt("expires_at", now.toISOString());
  if (cleanup.error) throw cleanup.error;
  const { error } = await db.from("portal_handoffs").insert({ ticket_hash: hashPortalTicket(ticket),
    tenant_id: student.tenant_id, student_id: student.id, portal_role: role, target_origin: targetOrigin,
    expires_at: new Date(now.getTime() + 90_000).toISOString() });
  if (error) throw error;
  return ticket;
}
export async function consumePortalHandoff(db: SupabaseClient, ticket: unknown, origin: unknown) {
  if (typeof ticket !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(ticket) || !trustedPortalOrigin(origin)) return null;
  // DELETE ... RETURNING is one atomic statement: concurrent workers cannot redeem twice.
  const { data, error } = await db.from("portal_handoffs").delete().eq("ticket_hash", hashPortalTicket(ticket))
    .eq("target_origin", origin).gt("expires_at", new Date().toISOString())
    .select("student_id,tenant_id,portal_role").maybeSingle();
  if (error) throw error;
  if (!data) return null;
  const { data: student, error: studentError } = await db.from("students").select("id")
    .eq("id", data.student_id).eq("tenant_id", data.tenant_id).maybeSingle();
  if (studentError) throw studentError;
  if (!student) return null;
  const destination = await currentPortalDestination(db, data.tenant_id);
  // Reject a ticket for a platform that was deactivated or renamed during transfer.
  if (destination.origin !== origin) return null;
  return { token: generateParentPortalToken(data.student_id, data.tenant_id), role: data.portal_role,
    ...destination };
}
