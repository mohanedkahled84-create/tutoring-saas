import type {Router} from 'express';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
export function registerStartupChecklist(router:Router){
 router.get('/startup-progress',async(req:AuthenticatedRequest,res)=>{
  const user=req.user;res.set('Cache-Control','private,no-store');
  if(!user?.tenant_id || user.assistant_id || !['owner','teacher','center_owner'].includes(user.role)){res.status(403).json({error:{message:'قائمة البداية متاحة لصاحب حساب المدرس'}});return;}
  try{
   const db=getServiceSupabaseClient(),tenant=user.tenant_id;
   const results=await Promise.all([
    db.from('groups').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).is('archived_at',null),
    db.from('students').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).is('archived_at',null),
    db.from('study_materials').select('id',{count:'exact',head:true}).eq('tenant_id',tenant),
    db.from('sessions').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).eq('status','ended'),
   ]);
   if(results.some(row=>row.error))throw new Error('unavailable');
   res.json({steps:[
    {id:'profile',title:'استكمل بياناتك والمادة ورقم التواصل',route:'settings',done:Boolean((user.full_name || user.name)?.trim() && user.subject?.trim() && user.phone?.trim())},
    {id:'group',title:'أضف مجموعتك الأولى وجدولها',route:'groups',done:Number(results[0].count)>0},
    {id:'student',title:'أضف الطلاب أو استوردهم من ملف',route:'students',done:Number(results[1].count)>0},
    {id:'content',title:'انشر أول واجب أو محتوى دراسي',route:'materials',done:Number(results[2].count)>0},
    {id:'session',title:'سجّل أول حصة وأنهِ رصدها',route:'sessions',done:Number(results[3].count)>0},
   ]});
  }catch{res.status(503).json({error:{message:'تعذر تحميل تقدم البداية؛ حاول مجددًا'}});}
 });
}
