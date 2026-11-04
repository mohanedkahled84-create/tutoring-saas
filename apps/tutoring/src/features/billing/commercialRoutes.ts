import { Router } from 'express';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../../shared/types/index.js';
import { getServiceSupabaseClient } from '../../supabase.js';
import {validateFileUpload} from '../../shared/utils/fileUploadValidator.js';

export const commercialBillingRouter = Router();
const uuid = z.string().uuid();
const plan = z.enum(['basic_v1', 'pro_v1', 'max_v1']);
const quote = z.object({
  id: uuid,
  kind: z.enum(['subscribe', 'renew', 'upgrade', 'students', 'assistants', 'storage', 'wallet']),
  plan_id: plan.optional(),
  quantity: z.number().int().min(1).max(10000000).optional(),
}).strict();
const proof = z.object({
  payment_method: z.enum(['instapay', 'vodafone_cash']),
  reference: z.string().trim().min(3).max(100),
  proof_image_url: z.string().max(3000000).optional(),
}).strict();
const errors: Record<string, string> = {
  WALLET_INSUFFICIENT: 'رصيد الرسائل غير كافٍ؛ اشحن المحفظة أولًا',
  MINIMUM_TOPUP_50: 'الحد الأدنى لشحن المحفظة ٥٠ جنيهًا',
  QUOTE_EXPIRED: 'انتهت صلاحية حساب السعر؛ احسب التكلفة مجددًا',
  SUBSCRIPTION_CHANGED: 'تغيّر اشتراكك بعد حساب السعر؛ راجع الطلب مع الدعم قبل اعتماده',
  PRICE_CHANGED: 'تغيّرت بيانات الباقة؛ احسب السعر مجددًا',
  USAGE_EXCEEDS_PLAN: 'استخدامك الحالي أكبر من سعة الباقة المطلوبة',
  USE_RENEW_OR_UPGRADE: 'اشتراكك سارٍ؛ استخدم التجديد أو الترقية',
  USE_SCHEDULED_DOWNGRADE: 'تخفيض الباقة يبدأ من التجديد التالي',
  SUBSCRIPTION_REQUIRED: 'تحتاج اشتراكًا ساريًا لشراء هذه الإضافة',
  PAYMENT_REFERENCE_REQUIRED: 'اختر طريقة الدفع واكتب رقم العملية',
  ORDER_NOT_SUBMITTED: 'ارفع بيانات الدفع أولًا',
  ORDER_CONFLICT: 'تعذر استخدام هذا الطلب',
  RATE_LIMIT: 'انتظر قليلًا قبل إنشاء طلب جديد',
};
async function operation(req: AuthenticatedRequest, res: any, action: string, data: Record<string, unknown> = {}) {
  res.set('Cache-Control', 'private,no-store');
  if (!req.user?.id || req.user.assistant_id) {
    res.status(403).json({ error: { code: 'FORBIDDEN', message: 'إدارة الاشتراك والمحفظة متاحة لصاحب الحساب فقط' } });
    return;
  }
  try {
    const result = await getServiceSupabaseClient().rpc('subscription_operation', { p_user: req.user.id, p_action: action, p_data: data });
    if (result.error) throw result.error;
    res.json(result.data);
  } catch (error: any) {
    const code = error?.code === '42501' ? 'FORBIDDEN' : error?.code === 'P0002' ? 'NOT_FOUND' : errors[error?.message] ? error.message : error?.code === '22023' ? 'INVALID_INPUT' : 'BILLING_UNAVAILABLE';
    res.status(code === 'FORBIDDEN' ? 403 : code === 'NOT_FOUND' ? 404 : code === 'INVALID_INPUT' ? 400 : code === 'RATE_LIMIT' ? 429 : errors[code] ? 409 : 503)
      .json({ error: { code, message: errors[code] || ({ FORBIDDEN: 'هذه العملية غير متاحة لحسابك', NOT_FOUND: 'الطلب غير موجود', INVALID_INPUT: 'راجع بيانات الطلب', BILLING_UNAVAILABLE: 'تعذر إتمام عملية الاشتراك؛ حاول مجددًا' } as Record<string, string>)[code] } });
  }
}
commercialBillingRouter.get('/', (req: AuthenticatedRequest, res) => operation(req, res, 'overview'));
commercialBillingRouter.get('/catalog', (req: AuthenticatedRequest, res) => operation(req, res, 'catalog'));
commercialBillingRouter.get('/admin/orders', (req: AuthenticatedRequest, res) => operation(req, res, 'admin_orders'));
commercialBillingRouter.post('/orders', (req: AuthenticatedRequest, res) => {
  const parsed = quote.safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'راجع الباقة ونوع الطلب والكمية' } }); return; }
  return operation(req, res, 'quote', parsed.data);
});
commercialBillingRouter.post('/orders/:id/submit', (req: AuthenticatedRequest, res) => {
  const parsed = proof.safeParse(req.body);
  if (!uuid.safeParse(req.params.id).success || !parsed.success) { res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'راجع رقم العملية وطريقة الدفع' } }); return; }
  if(parsed.data.proof_image_url){
    const match=parsed.data.proof_image_url.match(/^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/]+={0,2})$/);
    const checked=match && validateFileUpload({buffer:Buffer.from(match[2],'base64'),originalFilename:'receipt.'+({'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}[match[1]] || 'png'),declaredMimeType:match[1],maxSizeBytes:2*1024*1024});
    if(!checked || !checked.isValid){res.status(400).json({error:{code:'INVALID_RECEIPT',message:'صورة الإيصال غير صالحة؛ استخدم PNG أو JPEG أو WebP حتى ٢ ميجابايت'}});return;}
  }
  return operation(req, res, 'submit', { id: req.params.id, ...parsed.data });
});
for (const action of ['approve', 'reject'] as const) commercialBillingRouter.post('/admin/orders/:id/' + action, (req: AuthenticatedRequest, res) => {
  if (!uuid.safeParse(req.params.id).success || !z.object({}).strict().safeParse(req.body).success) { res.status(400).json({ error: { code: 'INVALID_INPUT', message: 'الطلب غير صالح' } }); return; }
  return operation(req, res, action, { id: req.params.id });
});
commercialBillingRouter.post('/schedule-plan', (req: AuthenticatedRequest, res) => {
  const parsed = z.object({ plan_id: plan }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { message: 'اختر الباقة المطلوبة' } }); return; }
  return operation(req, res, 'schedule_plan', parsed.data);
});
commercialBillingRouter.post('/cancel-addon', (req: AuthenticatedRequest, res) => {
  const parsed = z.object({ kind: z.enum(['students', 'assistants', 'storage']) }).strict().safeParse(req.body);
  if (!parsed.success) { res.status(400).json({ error: { message: 'الإضافة غير صالحة' } }); return; }
  return operation(req, res, 'cancel_addon', parsed.data);
});

commercialBillingRouter.post('/resume-addon', (req: AuthenticatedRequest, res) => {
 const parsed=z.object({kind:z.enum(['students','assistants','storage'])}).strict().safeParse(req.body);
 if(!parsed.success){res.status(400).json({error:{message:'الإضافة غير صالحة'}});return;}
 return operation(req,res,'resume_addon',parsed.data);
});
