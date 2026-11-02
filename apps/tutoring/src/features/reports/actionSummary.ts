import type {SupabaseClient} from '@supabase/supabase-js';

export function cairoToday(now=new Date()){
 const parts=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(now);
 return ['year','month','day'].map(type=>parts.find(part=>part.type===type)!.value).join('-');
}
export async function teacherActionSummary(db:SupabaseClient,tenant:string,now=new Date()){
 const today=cairoToday(now);
 const [homework,sessions]=await Promise.all([
  db.from('homework_submissions').select('id',{count:'exact',head:true}).eq('tenant_id',tenant).eq('status','pending'),
  db.from('sessions').select('id,group_id,status,session_date').eq('tenant_id',tenant).eq('session_date',today).in('status',['in_progress','scheduled']).limit(500),
 ]);
 if(homework.error || sessions.error)throw new Error('تعذر تحميل الإجراءات المطلوبة');
 const rows=sessions.data || [],attendance:Record<string,Set<string>>={};
 if(rows.length){
  const ids=rows.map(row=>row.id);
  for(let offset=0;;offset+=500){
   const result=await db.from('attendance').select('session_id,student_id').eq('tenant_id',tenant).in('session_id',ids).order('id').range(offset,offset+499);
   if(result.error)throw new Error('تعذر تحميل حالة رصد الحضور');
   for(const item of result.data || [])(attendance[item.session_id] ||= new Set()).add(item.student_id);
   if(!result.data || result.data.length<500)break;
  }
 }
 return {date:today,pending_homework:homework.count || 0,sessions:rows.map(row=>({...row,recorded_student_ids:[...(attendance[row.id] || [])]}))};
}
