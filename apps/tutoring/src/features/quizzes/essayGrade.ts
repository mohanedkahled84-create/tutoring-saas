import {z} from 'zod';
import type {Response} from 'express';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';

const input=z.object({submission_id:z.string().uuid(),essay_scores:z.record(z.string(),z.number().finite().min(0).max(10000)),notes:z.string().max(2000).optional(),final_score:z.number().finite().min(0).max(10000).optional(),max_score:z.number().finite().positive().max(10000).optional(),student_id:z.string().optional(),quiz_number:z.union([z.number(),z.string()]).optional(),group_id:z.string().optional()}).strict();
export async function gradeQuizEssay(req:AuthenticatedRequest,res:Response){
 res.set('Cache-Control','private,no-store');
 const user=req.user,body=input.safeParse(req.body);
 if(!user?.id || !user.tenant_id || !['owner','teacher','center_owner'].includes(user.role)){res.status(403).json({error:{code:'FORBIDDEN',message:'هذه العملية خارج صلاحياتك'}});return;}
 if(!body.success){res.status(400).json({error:{code:'INVALID_GRADE',message:'راجع درجات الأسئلة والملاحظة'}});return;}
 try{
  const result=await getServiceSupabaseClient().rpc('grade_portal_quiz_essay',{p_tenant:user.tenant_id,p_user:user.id,p_assistant:user.assistant_id || null,p_submission:body.data.submission_id,p_scores:body.data.essay_scores,p_note:body.data.notes || '',p_final:body.data.final_score ?? null,p_max:body.data.max_score ?? null});
  if(result.error)throw result.error;
  res.json(result.data);
 }catch(error:any){
  const status=error.code==='42501'?403:error.code==='P0002'?404:['22023','23514'].includes(error.code)?409:503;
  res.status(status).json({error:{code:status===403?'FORBIDDEN':status===409?'INVALID_GRADE':'GRADE_UNAVAILABLE',message:status===403?'هذا التسليم خارج صلاحياتك أو مجموعاتك':status===409?'راجع درجات الأسئلة والدرجة النهائية وفق نموذج الامتحان':'تعذر تأكيد اعتماد الدرجة؛ احتفظ ببياناتك وحاول مجددًا'}});
 }
}
