// Owner diagnostic. Credentials and family records remain in memory, never in output.
import {createRequire} from 'node:module';
import {familyPhone,openFamilyPassword} from '../apps/tutoring/dist/shared/utils/parentFamily.js';
const require=createRequire(new URL('../apps/tutoring/package.json',import.meta.url));
const {createClient}=require('@supabase/supabase-js');
const db=createClient(process.env.SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false,autoRefreshToken:false}});
const api='https://tutoring-backend-production-c8dd.up.railway.app/api/public/family';
for(const subdomain of ['mr-omar','mohaed']){
 let token;
 const origin=`https://${subdomain}.centerly-eg.com`;
 const post=(path,body)=>fetch(api+path,{method:'POST',headers:{Origin:origin,'Content-Type':'application/json'},body:JSON.stringify(body),redirect:'error',signal:AbortSignal.timeout(20000)});
 try{
  const platform=await db.from('tenant_platform_settings').select('tenant_id').eq('subdomain',subdomain).eq('is_active',true).single();
  if(platform.error)throw Error('Platform unavailable');
  const students=await db.from('students').select('parent_phone').eq('tenant_id',platform.data.tenant_id).is('archived_at',null).not('parent_phone','is',null).limit(20);
  if(students.error)throw Error('Students unavailable');
  let account;
  for(const row of students.data || []){
   const phone=familyPhone(row.parent_phone);if(!phone)continue;
   const result=await db.from('parent_family_accounts').select('phone,password_cipher').eq('phone',phone).maybeSingle();
   if(result.error)throw Error('Account unavailable');if(result.data){account=result.data;break;}
  }
  if(!account){console.log(JSON.stringify({subdomain,availableFamilyAccount:false}));continue;}
  const login=await post('/login',{phone:account.phone,password:openFamilyPassword(account.password_cipher,account.phone)}),session=await login.json();
  token=session.family_token;if(!login.ok || !token)throw Error('Login failed');
  const response=await post('/account',{family_token:token}),data=await response.json();
  const isolated=response.ok && Array.isArray(data.students) && data.students.length>0 && data.students.every(s=>s.tenant_id===platform.data.tenant_id);
  console.log(JSON.stringify({subdomain,familyLogin:true,teacherDirectoryIsolated:isolated,status:response.status}));
  if(!isolated)process.exitCode=1;
 }catch{console.log(JSON.stringify({subdomain,checkCompleted:false}));process.exitCode=1;}
 finally{if(token){const logout=await post('/logout',{family_token:token});console.log(JSON.stringify({subdomain,testSessionClosed:logout.ok}));if(!logout.ok)process.exitCode=1;}}
}
