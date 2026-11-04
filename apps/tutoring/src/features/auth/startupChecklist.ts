import type {Router} from 'express';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
import {getServices} from '../../composition.js';
import {currentPortalDestination} from '../../shared/utils/portalDestination.js';
export function registerStartupChecklist(router:Router){
 router.get('/startup-progress',async(req:AuthenticatedRequest,res)=>{
  const user=req.user;res.set('Cache-Control','private,no-store');
  if(!user?.tenant_id || user.assistant_id || !['owner','teacher','center_owner'].includes(user.role)){res.status(403).json({error:{message:'قائمة البداية متاحة لصاحب حساب المدرس'}});return;}
  try{
   const db=getServiceSupabaseClient(),tenant=user.tenant_id;
   const [results,platform,destination]=await Promise.all([Promise.all([
    db.from('groups').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).is('archived_at',null),
    db.from('students').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).is('archived_at',null),
    db.from('study_materials').select('id',{count:'exact',head:true}).eq('tenant_id',tenant),
    db.from('sessions').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).eq('status','ended'),
    db.from('students').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).is('archived_at',null).not('portal_password','is',null).neq('portal_password','').or('student_code.not.is.null,code.not.is.null'),
   ]),getServices(req).platformBuilder.getTeacherSettings(tenant),currentPortalDestination(db,tenant)]);
   if(results.some(row=>row.error))throw new Error('unavailable');
   res.json({steps:[
    {id:'profile',title:'استكمل بياناتك والمادة ورقم التواصل',route:'settings',done:Boolean((user.full_name || user.name)?.trim() && user.subject?.trim() && user.phone?.trim())},
    {id:'group',title:'أضف مجموعتك الأولى وجدولها',route:'groups',done:Number(results[0].count)>0},
    {id:'student',title:'أضف الطلاب أو استوردهم من ملف',route:'students',done:Number(results[1].count)>0},
    {id:'links',title:'جهّز بيانات دخول الطلاب وروابط المتابعة',route:'students',done:Number(results[4].count)>0},
    {id:'content',title:'أضف أول واجب أو محتوى دراسي',route:'materials',done:Number(results[2].count)>0},
    ...((platform.plan.is_pro && platform.plan.is_active) || destination.presentation?[{id:'platform',title:'جهّز هوية منصتك ورابط المدرس',route:'platform-builder',done:Boolean(destination.presentation)}]:[]),
    {id:'session',title:'سجّل أول حصة وأنهِ رصدها',route:'sessions',done:Number(results[3].count)>0},
   ]});
  }catch{res.status(503).json({error:{message:'تعذر تحميل تقدم البداية؛ حاول مجددًا'}});}
 });
}
