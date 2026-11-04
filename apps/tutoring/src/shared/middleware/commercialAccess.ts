import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types/index.js';
import { getServiceSupabaseClient } from '../../supabase.js';

export const commercialAccessResolver = {
  async limits(tenantId: string) {
    const result = await getServiceSupabaseClient().rpc('commercial_limits', { p_tenant: tenantId });
    if (result.error) throw result.error;
    if (!result.data || typeof result.data.legacy !== 'boolean') throw new Error('INVALID_ENTITLEMENTS');
    return result.data;
  },
};
export function commercialRequestDecision(limits: any, method: string, path: string, body: any, now = Date.now()) {
  if(limits.suspended)return {code:'SUBSCRIPTION_SUSPENDED',message:'الحساب موقوف؛ تواصل مع الدعم'};
  if (limits.legacy && !limits.period_end) return null;
  const isRead = ['GET', 'HEAD', 'OPTIONS'].includes(method);
  if (!limits.active) {
    const end = Date.parse(limits.period_end || '');
    if (!isRead || !Number.isFinite(end) || now > end + 7 * 86400000) return { code: 'SUBSCRIPTION_EXPIRED', message: 'انتهى الاشتراك؛ افتح صفحة الاشتراكات للتجديد' };
  }
  const teaching = /^\/(?:api\/)?platform(?:\/|$)/.test(path)
    || /^\/(?:api\/)?quizzes\/publish-online(?:\/|$)/.test(path)
    || !isRead && /^\/(?:api\/)?quizzes\/(?:rich|submissions|approve)(?:\/|$)/.test(path) && body?.exam_mode !== 'paper' && !['delete_draft','delete_quiz','archive_quiz'].includes(body?.action)
    || /^\/(?:api\/)?materials(?:\/|$)/.test(path) && ['video', 'online_quiz'].includes(body?.type);
  if (teaching && !limits.legacy && !limits.teaching_platform) return { code: 'PLAN_FEATURE_REQUIRED', message: 'هذه الميزة متاحة في Pro وMax؛ يمكنك مراجعة الباقات من صفحة الاشتراكات' };
  return null;
}
export async function requireCommercialAccess(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  if (req.user?.role === 'admin' || !req.user?.tenant_id) { next(); return; }
  try {
    const limits = await commercialAccessResolver.limits(req.user.tenant_id);
    const decision = commercialRequestDecision(limits, req.method, (req as any).commercialPath || req.originalUrl.split('?')[0], {...req.body,...(['GET','HEAD'].includes(req.method)?{type:req.query.type}: {})});
    if (decision) { res.status(402).json({ error: decision }); return; }
    (req as any).commercialLimits = limits;
    next();
  } catch {
    res.status(503).json({ error: { code: 'ENTITLEMENTS_UNAVAILABLE', message: 'تعذر التحقق من الاشتراك؛ حاول مجددًا' } });
  }
}
