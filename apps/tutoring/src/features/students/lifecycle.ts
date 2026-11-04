import type {Router,Response} from 'express';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';

const uuid=z.string().uuid();
const transfer=z.object({from_group_id:uuid,group_id:uuid}).strict();
const archive=z.object({}).strict();
const restore=z.object({group_id:uuid.optional()}).strict();
const messages:Record<string,string>={ACTIVE_GROUP_REQUIRED:'اختر مجموعة نشطة لاستعادة الطالب إليها',YEAR_CLOSED:'هذه المجموعة في سنة منتهية؛ أنشئ نسخة في السنة الحالية',ACTIVE_SESSION:'أنه الحصة الجارية قبل أرشفة المجموعة',INVALID_TRANSFER:'اختر مجموعتين مختلفتين، وتأكد أن الطالب والمجموعة الجديدة نشطان',NOT_ENROLLED:'الطالب لم يعد مسجلًا في المجموعة التي اخترتها',FORBIDDEN:'هذه العملية خارج صلاحياتك أو مجموعاتك',NOT_FOUND:'السجل غير موجود'};

async function operate(req:AuthenticatedRequest,res:Response,action:string,data:Record<string,unknown>={}) {
 try{
  if(!req.user?.tenant_id || !req.user.id){res.status(403).json({error:{code:'FORBIDDEN',message:'سجّل دخول حساب المدرس'}});return;}
  res.set('Cache-Control','private,no-store');
  const {data:result,error}=await getServiceSupabaseClient().rpc('classroom_operation',{
   p_tenant:req.user.tenant_id,p_user:req.user.id,p_assistant:req.user.assistant_id || null,p_action:action,p_data:data,
  });
  if(error)throw error;
  res.json({success:true,result});
 }catch(error:any){
  const key=Object.keys(messages).find(name=>error?.message?.includes(name));
  const status=error?.code==='42501'?403:error?.code==='P0002'?404:error?.code==='23514'?409:error?.code==='22023'?400:503;
  res.status(status).json({error:{code:key || 'CLASSROOM_UNAVAILABLE',message:key?messages[key]:'تعذر إتمام العملية؛ حاول مجددًا'}});
 }
}

export function registerStudentLifecycle(router:Router) {
 router.get('/archived',async(req:AuthenticatedRequest,res)=>{await operate(req,res,'list_archived_students');});
 router.get('/:id/history',async(req:AuthenticatedRequest,res)=>{
  if(!uuid.safeParse(req.params.id).success){res.status(400).json({error:{code:'BAD_REQUEST',message:'الطالب غير صالح'}});return;}
  await operate(req,res,'student_history',{id:req.params.id});
 });
 for(const action of ['archive','restore','transfer'] as const)router.post('/:id/'+action,async(req:AuthenticatedRequest,res)=>{
  const parsed=(action==='transfer'?transfer:action==='restore'?restore:archive).safeParse(req.body || {});
  if(!uuid.safeParse(req.params.id).success || !parsed.success){res.status(400).json({error:{code:'BAD_REQUEST',message:'راجع بيانات الطالب والمجموعات'}});return;}
  await operate(req,res,action==='transfer'?'transfer_student':action+'_student',{id:req.params.id,...parsed.data});
 });
}
export function registerGroupLifecycle(router:Router) {
 router.get('/archived',async(req:AuthenticatedRequest,res)=>{await operate(req,res,'list_archived_groups');});
 for(const action of ['archive','restore'] as const)router.post('/:id/'+action,async(req:AuthenticatedRequest,res)=>{
  if(!uuid.safeParse(req.params.id).success || !archive.safeParse(req.body || {}).success){res.status(400).json({error:{code:'BAD_REQUEST',message:'المجموعة غير صالحة'}});return;}
  await operate(req,res,action+'_group',{id:req.params.id});
 });
}
