// Assistant calls use their own opaque session, never the teacher's staff JWT.
// Writes are not retried automatically: a timed-out save may already have committed.
export async function assistantRequest(base, path, { body, token, timeoutMs = 15000, fetcher = fetch } = {}) {
 const controller = new AbortController();
 const timer = setTimeout(() => controller.abort(), timeoutMs);
 try {
  const response = await fetcher(`${base}/assistant-access${path}`, {
   method: body === undefined ? 'GET' : 'POST',
   headers: { ...(body === undefined ? {} : { 'Content-Type': 'application/json' }), ...(token ? { Authorization: `Bearer ${token}` } : {}) },
   body: body === undefined ? undefined : JSON.stringify(body),
   cache: 'no-store', signal: controller.signal,
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw Object.assign(new Error(result.error?.message || 'تعذر الاتصال، حاول مجددًا'), { status: response.status });
  return result;
 } catch (error) {
  if (controller.signal.aborted) throw new Error(body === undefined ? 'الاتصال أخد وقت أطول من المتوقع. حاول مجددًا.' : 'لم يصل تأكيد العملية. راجع البيانات قبل المحاولة مرة أخرى.');
  if (error instanceof TypeError) throw new Error('تعذر الاتصال بالمنصة. تأكد من الإنترنت وحاول مجددًا.');
  throw error;
 } finally { clearTimeout(timer); }
}
