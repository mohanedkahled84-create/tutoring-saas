// Owner diagnostic: no credentials, tokens, student IDs or names are printed.
import {createRequire} from 'node:module';
import {randomBytes} from 'node:crypto';
const require=createRequire(new URL('../apps/tutoring/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
if(!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)throw Error('Operator database configuration required');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const api='https://tutoring-backend-production-c8dd.up.railway.app/api/public';
for(const subdomain of ['mr-omar','mohaed']){
 try {
  const platform=await db.from('tenant_platform_settings').select('tenant_id').eq('subdomain',subdomain).eq('is_active',true).single();
  if(platform.error)throw Error('PLATFORM_LOOKUP_FAILED');
  const result=await db.from('students').select('id,tenant_id,code,student_code,portal_password').eq('tenant_id',platform.data.tenant_id).is('archived_at',null).not('portal_password','is',null).neq('portal_password','').limit(1).maybeSingle();
  if(result.error || !result.data)throw Error('NO_LOGIN_FIXTURE_AVAILABLE');
  const student=result.data,identifier=student.student_code || student.code,origin=`https://${subdomain}.centerly-eg.com`;
  if(!identifier)throw Error('NO_LOGIN_IDENTIFIER');
  const post=(path,body)=>fetch(api+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
  const response=await post('/portal/login',{identifier,password:student.portal_password,role:'student'});
  const login=await response.json();
  const accepted=response.ok && login.success===true && login.student?.id===student.id && login.student?.tenant_id===student.tenant_id && typeof login.token==='string';
  if(!accepted){console.log(JSON.stringify({subdomain,validLogin:false,status:response.status}));process.exitCode=1;continue;}
  const destination=await post('/portal/destination',{token:login.token,role:'student'}),target=await destination.json();
  const wrong=await post('/portal/login',{identifier,password:randomBytes(18).toString('hex'),role:'student'});
  const correctDestination=destination.ok && target.origin===origin && target.presentation?.subdomain===subdomain;
  console.log(JSON.stringify({subdomain,validLogin:accepted,correctDestination,wrongPasswordRejected:wrong.status===401}));
  if(!correctDestination || wrong.status!==401)process.exitCode=1;
 }catch {console.log(JSON.stringify({subdomain,checkCompleted:false}));process.exitCode=1;}
}
