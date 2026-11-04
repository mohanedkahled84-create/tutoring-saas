import {randomUUID} from 'node:crypto';
import {config} from '../config/index.js';
import {createClient} from '@supabase/supabase-js';
// Global transport bookkeeping is infrastructure, not delegated teacher content.
// Authorization of the recipient/action occurs before calling this module.
const budgetDatabase=()=>createClient(config.supabaseUrl,config.supabaseServiceRoleKey,{auth:{persistSession:false,autoRefreshToken:false}});

export type MetaBudgetContext={tenantId?:string;dispatchId?:string;reserved?:boolean};
export async function reserveMetaBudget(phone:string,context:MetaBudgetContext={}){
  const id=context.dispatchId || randomUUID();
  // Fake gateways/local unit tests have no privileged database. Production
  // credentials always require the durable, shared budget to be available.
  if(!config.supabaseServiceRoleKey)return {id,allowed:false,nextAt:null};
  if(context.reserved)return {id,allowed:true,nextAt:null};
  try{
    const result=await budgetDatabase().rpc('meta_budget_try',{p_id:id,p_tenant:context.tenantId || null,p_phone:phone,p_fair:false});
    if(result.error)return {id,allowed:false,nextAt:null};
    return {id,allowed:result.data?.allowed===true,nextAt:result.data?.next_at || null};
  }catch{return {id,allowed:false,nextAt:null};}
}
export async function settleMetaBudget(id:string,outcome:'accepted'|'unknown'|'not_sent'){
  try{await budgetDatabase().rpc('meta_budget_settle',{p_id:id,p_state:outcome});}catch{/* Keep reservation: never free an uncertain send. */}
}
