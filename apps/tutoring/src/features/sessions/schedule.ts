import type {Router,Response} from 'express';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
const date=z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const change=z.object({action:z.enum(['cancel','reschedule']),id:z.string().uuid(),is_group:z.boolean().default(false),session_date:date.optional(),new_date:date.optional(),new_time:z.string().max(50).optional(),reason:z.string().max(300).optional()}).strict();
const start=z.object({group_id:z.string().uuid(),session_id:z.string().uuid().optional()}).strict();
export async function changeSavedSchedule(req:AuthenticatedRequest,res:Response,action:string,data:Record<string,unknown>,status=200){
 res.set('Cache-Control','private,no-store');const user=req.user;
 if(!user?.id || !user.tenant_id || !['owner','teacher','center_owner'].includes(user.role)){res.status(403).json({error:{code:'FORBIDDEN',message:'هذه العملية متاحة لصاحب الحساب أو المساعد المصرح له'}});return;}
 try{
  const result=await getServiceSupabaseClient().rpc('session_schedule_change',{p_tenant:user.tenant_id,p_user:user.id,p_assistant:user.assistant_id || null,p_action:action,p_data:data});
  if(result.error)throw result.error;res.status(status).json(result.data);
 }catch(error:any){
  const messages:Record<string,string>={SESSION_IN_PROGRESS:'هناك حصة مفتوحة لهذه المجموعة؛ أكملها قبل بدء حصة أخرى',SESSION_HAS_RECORDS:'الحصة لها سجل حضور أو انتهت؛ احتفظ بالسجل وحدد حصة أخرى',SESSION_SELECTION_REQUIRED:'توجد أكثر من حصة في هذا اليوم؛ اختر الحصة المحددة',SESSION_CANCELLED:'هذه الحصة ملغاة أو منتهية؛ حدّد حصة أخرى',SESSION_NOT_TODAY:'موعد هذه الحصة في يوم آخر؛ راجع جدولها',INVALID_SESSION_TIME:'اكتب وقتًا صحيحًا للحصة'};
  const status=error.code==='42501'?403:error.code==='P0002'?404:String(error.code || '').startsWith('22')?400:error.code==='23514' || error.code==='23505'?409:503;
  res.status(status).json({error:{code:status===403?'FORBIDDEN':status===404?'SESSION_NOT_FOUND':messages[error.message]?error.message:'SESSION_CHANGE_UNAVAILABLE',message:messages[error.message] || (status===403?'هذه الحصة خارج صلاحياتك أو مجموعاتك':status===404?'الحصة غير موجودة؛ حدّث القائمة':'تعذر تأكيد حفظ الحصة؛ احتفظ ببياناتك وحاول مجددًا')}});
 }
}
export function registerSavedScheduleRoutes(router:Router){
 router.post('/schedule-change',async(req:AuthenticatedRequest,res)=>{const input=change.safeParse(req.body);if(!input.success || input.data.action==='reschedule' && !input.data.new_date){res.status(400).json({error:{message:'راجع تاريخ الحصة وموعدها'}});return;}const {action,...data}=input.data;await changeSavedSchedule(req,res,action,data);});
 router.post('/start',async(req:AuthenticatedRequest,res)=>{const input=start.safeParse(req.body);if(!input.success){res.status(400).json({error:{message:'اختر المجموعة والحصة المطلوب بدءها'}});return;}await changeSavedSchedule(req,res,'start',input.data);});
}
