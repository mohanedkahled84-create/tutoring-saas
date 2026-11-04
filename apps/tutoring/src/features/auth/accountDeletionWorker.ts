import type {SupabaseClient} from '@supabase/supabase-js';
// Storage is removed through its API. Direct SQL deletion of storage metadata
// would leave billed objects behind and is intentionally never used here.
export function createAccountDeletionWorker(db:SupabaseClient,onError:()=>void=()=>{}){
 let busy=false,stopped=false;
 const operation=async(action:string,data:Record<string,unknown>={})=>{const result=await db.rpc('account_deletion_worker',{p_action:action,p_data:data});if(result.error)throw result.error;return result.data;};
 return {stop(){stopped=true;},async tick(){
  if(busy || stopped)return;busy=true;let job:any;
  try{
   job=await operation('claim');if(!job)return;
   const scope={id:job.id,lease_id:job.lease_id};
   if(job.phase==='storage'){
    for(let batch=0;batch<10 && !stopped;batch++){
     const files=await operation('files',scope);
     if(!files.length){await operation('storage_done',scope);job.phase='data';break;}
     const buckets=new Map<string,string[]>();
     for(const file of files){if(typeof file.bucket!=='string' || typeof file.path!=='string' || !file.path || file.path.startsWith('/') || file.path.split('/').includes('..'))throw Error('INVALID_OBJECT_SCOPE');const paths=buckets.get(file.bucket) || [];paths.push(file.path);buckets.set(file.bucket,paths);}
     for(const [bucket,paths] of buckets){const result=await db.storage.from(bucket).remove(paths);if(result.error)throw result.error;}
    }
    if(job.phase==='storage'){await operation('release',scope);return;}
   }
   if(job.phase==='data'){const result=await operation('data',scope);if(result.phase==='storage'){await operation('release',scope);return;}job.phase='auth';}
   if(job.phase==='auth'){
    for(const id of job.user_ids){
     const result=await db.auth.admin.deleteUser(id);
     // Idempotent after a worker crash between Auth deletion and its checkpoint.
     if(result.error && result.error.status!==404 && result.error.code!=='user_not_found')throw result.error;
     await operation('auth_deleted',{...scope,user_id:id});
    }
    await operation('done',scope);
   }
  }catch{
   if(job)await operation('failed',{id:job.id,lease_id:job.lease_id,error_code:'CLEANUP_RETRY_REQUIRED'}).catch(()=>{});
   onError();
  }finally{busy=false;}
 }};
}
