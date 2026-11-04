import {z} from 'zod';
import {randomUUID} from 'node:crypto';
import type {Response} from 'express';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
const uuid=z.string().uuid();
const definition=z.object({title:z.string().trim().min(1).max(200),subject:z.string().max(100).optional(),quiz_number:z.number().int().min(1).max(10000),time_limit_minutes:z.number().int().min(1).max(240).optional(),available_date:z.string().nullable().optional(),start_time:z.string().nullable().optional(),end_time:z.string().nullable().optional(),questions:z.array(z.record(z.string(),z.unknown())).min(1).max(500)}).strict();
const batch=z.object({definition,targets:z.array(z.object({id:uuid,group_id:uuid}).strict()).min(1).max(200)}).strict();
export async function publishOnlineQuiz(req:AuthenticatedRequest,res:Response,legacy=false){
 res.set('Cache-Control','private,no-store');const user=req.user;
 if(!user?.id || !user.tenant_id || !['owner','teacher','center_owner'].includes(user.role)){res.status(403).json({error:{code:'FORBIDDEN',message:'هذه العملية خارج صلاحياتك'}});return;}
 const source=legacy?{definition:Object.fromEntries(['title','subject','quiz_number','time_limit_minutes','available_date','start_time','end_time','questions'].filter(k=>req.body[k]!==undefined).map(k=>[k,req.body[k]])),targets:[{id:req.body.id || randomUUID(),group_id:req.body.group_id}]}:req.body;
 const input=batch.safeParse(source);if(!input.success){res.status(400).json({error:{code:'INVALID_QUIZ',message:'راجع بيانات الامتحان والمجموعات، وحدّث القائمة إذا كان الامتحان قديمًا'}});return;}
 try{
  const result=await getServiceSupabaseClient().rpc('publish_online_quiz',{p_tenant:user.tenant_id,p_user:user.id,p_assistant:user.assistant_id || null,p_data:input.data});
  if(result.error)throw result.error;res.json(result.data);
 }catch(error:any){
  const status=error.code==='42501'?403:['23514','23505'].includes(error.code)?409:String(error.code || '').startsWith('22')?400:503;
  const started=String(error.message).includes('QUIZ_HAS_ATTEMPTS');
  res.status(status).json({error:{code:status===403?'FORBIDDEN':started?'QUIZ_HAS_ATTEMPTS':'QUIZ_PUBLICATION_UNAVAILABLE',message:status===403?'إحدى المجموعات أو صلاحيات الحفظ غير متاحة لك':started?'بدأ الطلاب حل هذا الامتحان؛ احتفظ بسجله وأنشئ امتحانًا جديدًا لتغيير الأسئلة':status===400 || status===409?'راجع نموذج الإجابة ومواعيد الامتحان؛ لم تُنشر تغييرات لأي مجموعة':'تعذر تأكيد نشر الامتحان؛ احتفظ بالبيانات وحاول مجددًا'}});
 }
}
