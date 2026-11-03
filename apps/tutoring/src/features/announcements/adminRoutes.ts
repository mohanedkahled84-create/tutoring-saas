import {Router,type Response} from 'express';
import {z} from 'zod';
import {requireAdmin} from '../../shared/middleware/auth.js';
import {config} from '../../shared/config/index.js';
import type {AuthenticatedRequest} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
import {matchesUtilityTemplate} from '../../shared/utils/metaTemplatePolicy.js';
import {announcementDefinitionSchema} from './catalog.js';
export const announcementAdminRouter=Router();announcementAdminRouter.use(requireAdmin);
const base='https://graph.facebook.com/v21.0';
const fault=(message:string)=>Object.assign(new Error(message),{code:'23514'});
async function operation(req:AuthenticatedRequest,action:string,data:Record<string,unknown>={}){
 const result=await getServiceSupabaseClient().rpc('announcement_admin',{p_user:req.user!.id,p_action:action,p_data:data});if(result.error)throw result.error;return result.data;
}
async function handle(res:Response,work:()=>Promise<unknown>){res.set('Cache-Control','private,no-store');try{res.json(await work());}catch(error:any){const code=error.code==='42501'?'FORBIDDEN':error instanceof z.ZodError?'INVALID_INPUT':error.code==='23514'?error.message:'PROVIDER_UNAVAILABLE';const text:Record<string,string>={FORBIDDEN:'هذه الصفحة للإدارة فقط',INVALID_INPUT:'راجع القالب والحقول والعينات المطلوبة',TEMPLATE_NOT_ENABLED:'القالب لم يطابق نسخة Utility مقبولة؛ لن يتم تفعيله',TYPE_IMMUTABLE:'استخدم اسمًا وإصدارًا جديدين لتعديل قالب سابق',META_NOT_CONFIGURED:'ربط Meta غير مكتمل',SUBMISSION_UNCERTAIN:'لم نتأكد من تقديم القالب؛ راجعه في Meta قبل إعادة التقديم',PROVIDER_UNAVAILABLE:'تعذر الاتصال أو حفظ النتيجة؛ راجع الحالة قبل إعادة التقديم'};res.status(code==='FORBIDDEN'?403:code==='INVALID_INPUT'?400:error.code==='23514'?409:503).json({error:{code,message:text[code] || text.PROVIDER_UNAVAILABLE}});}}
function credentials(){if(!config.meta.accessToken || !config.meta.wabaId)throw fault('META_NOT_CONFIGURED');return {Authorization:`Bearer ${config.meta.accessToken}`,'Content-Type':'application/json'};}
async function providerTemplate(kind:any){
 const response=await fetch(`${base}/${config.meta.wabaId}/message_templates?name=${encodeURIComponent(kind.meta_name)}&fields=id,name,status,language,category,components`,{headers:credentials(),signal:AbortSignal.timeout(5000)}),body:any=await response.json();
 if(!response.ok || !Array.isArray(body.data))throw Error('metadata unavailable');
 return body.data.find((row:any)=>row.name===kind.meta_name && row.language==='ar');
}
async function refresh(req:AuthenticatedRequest,key:string){
 const data=await operation(req,'list'),kind=data.catalog.find((row:any)=>row.key===key);if(!kind)throw fault('TEMPLATE_NOT_ENABLED');
 const live=await providerTemplate(kind);if(!live)throw fault('SUBMISSION_UNCERTAIN');
 const matched=matchesUtilityTemplate(live,{name:kind.meta_name,language:'ar',expected:{id:kind.meta_id || String(live.id),body:kind.body,parameterCount:kind.fields.length}});
 await operation(req,'provider',{key,meta_id:String(live.id),status:String(live.status || 'UNKNOWN'),category:String(live.category || 'UNKNOWN'),matched});return {kind,matched};
}
announcementAdminRouter.get('/',async(req:AuthenticatedRequest,res)=>handle(res,()=>operation(req,'list')));
announcementAdminRouter.post('/requests/:id',async(req:AuthenticatedRequest,res)=>handle(res,async()=>{
 const data=z.object({status:z.enum(['reviewing','meta_pending','available','rejected']),admin_notes:z.string().max(2000),type_key:z.string().regex(/^[a-z][a-z0-9_]{2,49}$/).nullable()}).strict().parse(req.body);const id=z.string().uuid().parse(req.params.id);return operation(req,'request',{id,...data});
}));
announcementAdminRouter.post('/types',async(req:AuthenticatedRequest,res)=>handle(res,async()=>{
 const data=z.object({definition:announcementDefinitionSchema,examples:z.array(z.string().trim().min(1).max(160)).min(3).max(10),confirm_utility:z.literal(true)}).strict().parse(req.body);
 if(data.examples.length!==data.definition.fields.length)throw new z.ZodError([]);
 const headers=credentials();
 const existing=await providerTemplate({meta_name:data.definition.name});
 const prepared=await operation(req,'prepare',data.definition),kind=prepared.type;
 // Existing or uncertain submissions are read back, never posted again blindly.
 const live=existing;
 if(live){await refresh(req,kind.key);return {key:kind.key,submitted:false};}
 if(!prepared.submit)throw fault('SUBMISSION_UNCERTAIN');
 const response=await fetch(`${base}/${config.meta.wabaId}/message_templates`,{method:'POST',headers,body:JSON.stringify({name:data.definition.name,language:'ar',category:'UTILITY',components:[{type:'BODY',text:data.definition.body,example:{body_text:[data.examples]}},{type:'FOOTER',text:'سنترلي | تنبيهات الدراسة'}]}),signal:AbortSignal.timeout(15000)}),result:any=await response.json();
 if(!response.ok || !/^\d{5,30}$/.test(String(result.id || '')))throw fault('SUBMISSION_UNCERTAIN');
 await operation(req,'provider',{key:kind.key,meta_id:String(result.id),status:String(result.status || 'PENDING'),category:String(result.category || 'UTILITY'),matched:false});
 return {key:kind.key,submitted:true,status:result.status || 'PENDING',enabled:false};
}));
for(const action of ['refresh','enable','disable'] as const)announcementAdminRouter.post('/types/:key/'+action,async(req:AuthenticatedRequest,res)=>handle(res,async()=>{
 const key=z.string().regex(/^[a-z][a-z0-9_]{2,49}$/).parse(req.params.key);
 if(action==='disable')return operation(req,'disable',{key});
 const result=await refresh(req,key);if(action==='refresh')return {matched:result.matched};
 if(!result.matched)throw fault('TEMPLATE_NOT_ENABLED');return operation(req,'enable',{key,matched:true});
}));
