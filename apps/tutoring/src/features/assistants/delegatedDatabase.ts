import {createClient,type SupabaseClient} from '@supabase/supabase-js';
import {config} from '../../shared/config/index.js';

export const delegatedTables=new Set(['groups','students','group_students','enrollments','sessions','attendance','quizzes','quiz_scores','study_materials','homework_submissions','message_logs','whatsapp_inbox','tenant_platform_settings','tenants','users','teachers','assistants','assistant_accounts','assistant_invitations','activity_logs','assistant_access_audit','payment_proofs','message_templates','whatsapp_connections','meta_portal_dispatch_queue','student_collections','rooms','teacher_payouts']);
export interface DelegatedDatabaseContext{tokenHash:string;origin:string;capability:string;ownerId:string;tenantId:string;permissions:Record<string,boolean>}
const fail=()=>Object.assign(new Error('هذه العملية خارج صلاحياتك أو مجموعاتك'),{status:403});
export function delegatedSelect(select:string){
 return select.replace(/(^|[,\s(])(?:(\w+):)?(\w+)(![\w]+)?(?=\()/g,(whole,prefix,alias,table,hint)=>delegatedTables.has(table)?`${prefix}${alias || table}:assistant_delegated_${table}${hint || ''}`:whole);
}
export function redactDelegatedData(value:any,context:DelegatedDatabaseContext):any{
 if(Array.isArray(value))return value.map(item=>redactDelegatedData(item,context));
 if(!value || typeof value!=='object')return value;
 const hidden=new Set(['password_hash','password_cipher','financial_pin_hash','nonce_hash','claim_hash','token_hash','api_key','api_key_secret_id','refresh_token','access_token']);
 if(!context.permissions['students.send']){hidden.add('portal_password');hidden.add('parent_portal_token');hidden.add('student_portal_token');}
 if(!context.permissions['dashboard.view'])for(const key of ['financials','actualEarnings','teacher_profit','net_profit','monthly_rev','center_cut_percentage','fixed_per_student_amount','fixed_rent_amount'])hidden.add(key);
 if(!context.permissions['dashboard.view'] && !context.permissions['assistants.view'])for(const key of ['salary','salary_amount','payroll','expected_pay','monthly_salary'])hidden.add(key);
 return Object.fromEntries(Object.entries(value).filter(([key])=>!hidden.has(key)).map(([key,item])=>[key,redactDelegatedData(item,context)]));
}
export function createDelegatedFetch(context:DelegatedDatabaseContext,fetcher:typeof fetch=fetch):typeof fetch{
 const origin=new URL(config.supabaseUrl).origin;
 return async(input,init={})=>{
  const request=new Request(input,init),url=new URL(request.url),headers=new Headers(request.headers);
  if(url.origin!==origin || !['public',''].includes(headers.get('accept-profile') || '') || !['public',''].includes(headers.get('content-profile') || ''))throw fail();
  headers.set('x-assistant-token-hash',context.tokenHash);headers.set('x-assistant-origin',context.origin);headers.set('x-assistant-capability',context.capability);headers.set('x-assistant-owner-id',context.ownerId);
  const method=request.method,rest=url.pathname.match(/^\/rest\/v1\/([^/]+)$/),rpc=url.pathname.match(/^\/rest\/v1\/rpc\/([^/]+)$/);
  let body:any=method==='GET' || method==='HEAD'?undefined:url.pathname.startsWith('/storage/')?await request.arrayBuffer():await request.text();
  if(rest){
   const table=decodeURIComponent(rest[1]);if(!delegatedTables.has(table))throw fail();
   if(table==='users' && body){const rows=JSON.parse(body);for(const row of Array.isArray(rows)?rows:[rows])if(Object.keys(row).some(key=>!['full_name','phone','subject'].includes(key)))throw fail();}
   if(table==='tenants' && body){const rows=JSON.parse(body);for(const row of Array.isArray(rows)?rows:[rows])if(Object.keys(row).some(key=>!['name','settings','settings_json','workflow_settings','subject','phone','contact_phone'].includes(key)))throw fail();}
   url.pathname='/rest/v1/assistant_delegated_'+table;
   if(url.searchParams.has('select'))url.searchParams.set('select',delegatedSelect(url.searchParams.get('select')!));
   const prefer=headers.get('prefer') || '';
   if(method==='POST' && /resolution=(merge|ignore)-duplicates/.test(prefer)){
    const rows=JSON.parse(body || '{}');
    const target=new URL('/rest/v1/rpc/assistant_delegated_upsert',origin);
    const rpcHeaders=new Headers(headers);rpcHeaders.set('accept','application/json');rpcHeaders.delete('prefer');
    const saved=await fetcher(target,{method:'POST',headers:rpcHeaders,body:JSON.stringify({p_table:table,p_rows:Array.isArray(rows)?rows:[rows],p_conflict:url.searchParams.get('on_conflict') || (table==='assistant_accounts'?'assistant_id':'id'),p_ignore:prefer.includes('ignore-duplicates')})});
    if(!saved.ok)return saved;
    const data:any=await saved.json();
    if(url.searchParams.has('select') && Array.isArray(data) && data.length){const primary=table==='assistant_accounts'?'assistant_id':'id',ids=data.map(row=>row[primary]);url.searchParams.delete('on_conflict');url.searchParams.set(primary,`in.(${ids.join(',')})`);const selectHeaders=new Headers(headers);selectHeaders.delete('prefer');return await filterResponse(await fetcher(url,{method:'GET',headers:selectHeaders}),context);}
    const single=headers.get('accept')?.includes('vnd.pgrst.object');return new Response(JSON.stringify(redactDelegatedData(single?data[0]:data,context)),{status:201,headers:{'Content-Type':'application/json'}});
   }
  }else if(rpc){
   if(method!=='POST')throw fail();
   const name=decodeURIComponent(rpc[1]);if(name.startsWith('assistant_delegated_'))throw fail();
   url.pathname='/rest/v1/rpc/assistant_delegated_rpc';url.search='';body=JSON.stringify({p_name:name,p_args:JSON.parse(body || '{}')});
  }else if(url.pathname.startsWith('/storage/v1/object/')){
   const decoded=decodeURIComponent(url.pathname);if(!decoded.split('/').includes(context.tenantId) || decoded.includes('..'))throw fail();
  }else throw fail();
  const response=await fetcher(url,{method,headers,body,signal:request.signal});
  return method==='HEAD'?response:await filterResponse(response,context);
 };
}
async function filterResponse(response:Response,context:DelegatedDatabaseContext){
 if(!response.headers.get('content-type')?.includes('json'))return response;
 let value;try{value=await response.clone().json();}catch{return response;}
 const headers=new Headers(response.headers);headers.delete('content-length');return new Response(JSON.stringify(redactDelegatedData(value,context)),{status:response.status,statusText:response.statusText,headers});
}
export function createDelegatedDatabase(context:DelegatedDatabaseContext):SupabaseClient{
 return createClient(config.supabaseUrl,config.supabaseServiceRoleKey || config.supabaseAnonKey,{auth:{persistSession:false,autoRefreshToken:false},global:{fetch:createDelegatedFetch(context)}});
}
