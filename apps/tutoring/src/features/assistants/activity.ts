import type {SupabaseClient} from '@supabase/supabase-js';
import {z} from 'zod';

const fields:Record<string,string[]>={
 groups:['name','subject'],students:['name','parent_phone','student_phone','notes','group_id'],
 attendance:['attended','homework_status','comment'],materials:['title','description','type','url','is_homework','due_date'],
 homework:['status','teacher_notes'],quizzes:['title','quiz_number','max_score','quiz_date'],
};
export function safeAssistantChanges(action:string,changes:any) {
 const keys=fields[action.split('.')[0]] || [];
 const project=(source:any)=>Object.fromEntries(keys.filter(key=>source && Object.hasOwn(source,key) && (source[key]===null || ['string','number','boolean'].includes(typeof source[key]))).map(key=>[key,source[key]]));
 return {before:project(changes?.before),after:project(changes?.after)};
}
export async function loadAssistantActivity(db:SupabaseClient,tenant:string,input:Record<string,unknown>) {
 const page=z.coerce.number().int().min(1).max(10000).default(1).parse(input.page);
 const assistant=input.assistant_id ? z.uuid().parse(input.assistant_id) : null;
 const size=30,offset=(page-1)*size;
 let query=db.from('assistant_access_audit').select('id,assistant_id,action,target_id,created_at,actor_name,target_name,changes')
  .eq('tenant_id',tenant).order('created_at',{ascending:false}).order('id',{ascending:false});
 if(assistant) query=query.eq('assistant_id',assistant);
 const {data,error}=await query.range(offset,offset+size);
 if(error) throw error;
 const entries=(data || []).slice(0,size).map(row=>({
  ...row,actor_type:['invitation_created','access_configured'].includes(row.action)?'owner':'assistant',
  changes:safeAssistantChanges(row.action,row.changes),
 }));
 return {entries,page,has_more:(data || []).length>size};
}
