import type {SupabaseClient} from '@supabase/supabase-js';

async function approvedRows(db:SupabaseClient,table:string,columns:string,ids:string[]){
 const chunks=[];for(let offset=0;offset<ids.length;offset+=100)chunks.push(ids.slice(offset,offset+100));
 const results=await Promise.all(chunks.map(chunk=>db.from(table).select(columns).in('id',chunk)));
 if(results.some(result=>result.error))return {data:null,error:true};
 return {data:results.flatMap(result=>result.data || []) as any[],error:false};
}

// Call only with the rows returned by assistant_workspace after its tenant,
// group and permission checks. Browser IDs must never be supplied here.
export async function enrichAssistantPage(db:SupabaseClient,resource:string,result:any){
 if(!result.rows?.length)return result;
 if(resource==='homework'){
  const {data:details,error}=await approvedRows(db,'homework_submissions','id,material_id,file_url,file_purged',result.rows.map((row:any)=>row.id));
  if(error)throw Object.assign(new Error('تعذر تحميل تسليمات الواجب'),{status:503});
  const records=new Map((details || []).map(row=>[row.id,row]));
  result.rows=result.rows.map((row:any)=>({...row,material_id:records.get(row.id)?.material_id,has_file:!!records.get(row.id)?.file_url && !records.get(row.id)?.file_purged}));
 }
 if(resource==='attendance'){
  const [sessionResult,studentsResult]=await Promise.all([
   db.from('sessions').select('id,group_id,session_date,session_number,status').eq('id',result.rows[0].session_id).single(),
   approvedRows(db,'students','id,student_code',result.rows.map((row:any)=>row.student_id)),
  ]);
  if(sessionResult.error || studentsResult.error)throw Object.assign(new Error('تعذر تحميل بيانات الحصة'),{status:503});result.session=sessionResult.data;
  const codes=new Map((studentsResult.data || []).map(row=>[row.id,row.student_code]));
  result.rows=result.rows.map((row:any)=>({...row,student_code:codes.get(row.student_id)}));
 }
 return result;
}
