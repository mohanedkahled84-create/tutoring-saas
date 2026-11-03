import type {Router,Response} from 'express';
import {z} from 'zod';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';

const uuid=z.string().uuid();
const period={name:z.string().trim().min(1).max(100),starts_on:z.iso.date(),ends_on:z.iso.date()};
const start=z.object(period).strict().refine(x=>x.ends_on>=x.starts_on,{message:'راجع بداية ونهاية السنة'});
const rollover=z.object({...period,expected_year_id:uuid,group_ids:z.array(uuid).max(1000),student_ids:z.array(uuid).max(10000),confirmed:z.literal(true)}).strict().refine(x=>x.ends_on>=x.starts_on,{message:'راجع بداية ونهاية السنة'});
const errors:Record<string,string>={YEAR_ALREADY_ACTIVE:'لديك سنة نشطة بالفعل',YEAR_CHANGED:'تغيرت السنة الحالية، افتح المعاينة من جديد',ACTIVE_SESSION:'أنه الحصص الجارية قبل إنهاء السنة',INVALID_YEAR:'راجع اسم السنة وتواريخها',INVALID_GROUPS:'بعض المجموعات لم تعد متاحة للنقل',INVALID_STUDENTS:'راجع الطلاب المحددين والمجموعات التي اخترتها',FORBIDDEN:'إدارة السنة متاحة لصاحب حساب المدرس فقط',NOT_FOUND:'السنة غير موجودة'};

export function registerAcademicYears(router:Router){
 const run=async(req:AuthenticatedRequest,res:Response,action:string,data:Record<string,unknown>)=>{
  res.set('Cache-Control','private,no-store');
  if(!req.user?.tenant_id || !req.user.id || req.user.assistant_id){res.status(403).json({error:{code:'FORBIDDEN',message:errors.FORBIDDEN}});return;}
  try{const result=await getServiceSupabaseClient().rpc('academic_year_operation',{p_tenant:req.user.tenant_id,p_user:req.user.id,p_action:action,p_data:data});if(result.error)throw result.error;res.json({result:result.data});}
  catch(error:any){const code=Object.keys(errors).find(key=>error?.message?.includes(key));res.status(error?.code==='42501'?403:error?.code==='23514'?409:error?.code==='22023'?400:error?.code==='P0002'?404:503).json({error:{code:code || 'YEAR_UNAVAILABLE',message:code?errors[code]:'تعذر إتمام عملية السنة الدراسية؛ حاول مجددًا'}});}
 };
 router.get('/academic-years',async(req:AuthenticatedRequest,res)=>{await run(req,res,'view',{});});
 router.get('/academic-years/:id/archive',async(req:AuthenticatedRequest,res)=>{if(!uuid.safeParse(req.params.id).success){res.status(400).json({error:{message:'السنة غير صالحة'}});return;}await run(req,res,'archive',{year_id:req.params.id});});
 for(const action of ['start','rollover'] as const)router.post('/academic-years/'+action,async(req:AuthenticatedRequest,res)=>{const parsed=(action==='start'?start:rollover).safeParse(req.body);if(!parsed.success){res.status(400).json({error:{code:'BAD_REQUEST',message:'راجع بيانات السنة والمجموعات وموافقة الإنهاء',details:parsed.error.issues}});return;}await run(req,res,action,parsed.data);});
}
