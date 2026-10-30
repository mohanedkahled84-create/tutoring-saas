import type { SupabaseClient } from "@supabase/supabase-js";
import { config } from "../../shared/config/index.js";

export const HOMEWORK_BUCKET = "homework-private";
export const LEGACY_HOMEWORK_BUCKET = "homework-submissions";
export const HOMEWORK_MAX_BYTES = 25 * 1024 * 1024;
export const HOMEWORK_URL_TTL_SECONDS = 15 * 60;

/** Accept only this project's storage objects, never arbitrary signed URL targets. */
export function homeworkObject(value: string | null | undefined): { bucket: string; path: string } | null {
  if (!value) return null;
  try {
    let bucket = HOMEWORK_BUCKET;
    let path = value;
    if (/^https?:/i.test(value)) {
      const url = new URL(value);
      if (url.origin !== new URL(config.supabaseUrl).origin) return null;
      const match = url.pathname.match(/^\/storage\/v1\/object\/(?:public|sign|authenticated)\/(homework-private|homework-submissions)\/(.+)$/);
      if (!match) return null;
      bucket = match[1];
      path = match[2];
    } else if (value.startsWith(`${HOMEWORK_BUCKET}/`)) {
      path = value.slice(HOMEWORK_BUCKET.length + 1);
    }
    path = decodeURIComponent(path);
    if (!path || path.includes("\\") || path.includes("\0") || path.split("/").some(p => !p || p === "." || p === "..")) return null;
    return { bucket, path };
  } catch {
    return null;
  }
}

export function ownsHomeworkObject(path: string, tenantId: string, materialId?: string, studentId?: string): boolean {
  const parts = path.split("/");
  return parts.length === 3 && parts[0] === tenantId &&
    (!materialId || parts[1] === materialId) &&
    (!studentId || parts[2].startsWith(`${studentId}_`));
}

/** Call only AFTER the caller has been authorized to access the submission. */
export async function signHomeworkFile(
  client: SupabaseClient, value: string | null | undefined,
  tenantId: string, materialId?: string, studentId?: string
): Promise<string | null> {
  const object = homeworkObject(value);
  if (!object || !ownsHomeworkObject(object.path, tenantId, materialId, studentId)) return null;
  const { data, error } = await client.storage.from(object.bucket).createSignedUrl(object.path, HOMEWORK_URL_TTL_SECONDS);
  if (error || !data?.signedUrl) throw new Error("تعذر فتح ملف الواجب الآن، يرجى إعادة المحاولة");
  return data.signedUrl;
}
