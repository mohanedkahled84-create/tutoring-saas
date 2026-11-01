import type {SupabaseClient} from '@supabase/supabase-js';

// Call only with the rows returned by assistant_workspace after its tenant,
// group and permission checks. Browser IDs must never be supplied here.
export async function enrichAssistantPage(db:SupabaseClient,resource:string,result:any){
 if(!result.rows?.length)return result;
 if(resource==='homework'){
  const {data:details,error}=await db.from('homework_submissions').select('id,material_id,file_url,file_purged').in('id',result.rows.map((row:any)=>row.id));
  if(error)throw Object.assign(new Error('تعذر تحميل تسليمات الواجب'),{status:503});
  const records=new Map((details || []).map(row=>[row.id,row]));
  result.rows=result.rows.map((row:any)=>({...row,material_id:records.get(row.id)?.material_id,has_file:!!records.get(row.id)?.file_url && !records.get(row.id)?.file_purged}));
 }
 if(resource==='attendance'){
  const [sessionResult,studentsResult]=await Promise.all([
   db.from('sessions').select('id,group_id,session_date,session_number,status').eq('id',result.rows[0].session_id).single(),
   db.from('students').select('id,student_code').in('id',result.rows.map((row:any)=>row.student_id)),
  ]);
  if(sessionResult.error || studentsResult.error)throw Object.assign(new Error('تعذر تحميل بيانات الحصة'),{status:503});result.session=sessionResult.data;
  const codes=new Map((studentsResult.data || []).map(row=>[row.id,row.student_code]));
  result.rows=result.rows.map((row:any)=>({...row,student_code:codes.get(row.student_id)}));
 }
 return result;
}
