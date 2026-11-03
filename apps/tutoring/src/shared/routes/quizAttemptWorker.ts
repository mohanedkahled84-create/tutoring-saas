import type {SupabaseClient} from '@supabase/supabase-js';
export function createQuizAttemptWorker(db:SupabaseClient,onError:()=>void=()=>{}){
 let busy=false,stopped=false;
 return {stop(){stopped=true;},async tick(){
  if(busy || stopped)return;
  busy=true;
  try{const {error}=await db.rpc('portal_quiz_finalize_expired',{p_limit:50});if(error)throw error;}
  catch{onError();}finally{busy=false;}
 }};
}
