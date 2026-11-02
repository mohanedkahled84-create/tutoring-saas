import {Router} from 'express';
import type {AuthenticatedRequest,UserContext} from '../../shared/types/index.js';
import {getServiceSupabaseClient} from '../../supabase.js';
import {delegatedClientScope} from '../../shared/delegatedClient.js';
import {config} from '../../shared/config/index.js';
import {familyHash,validFamilyToken} from '../../shared/utils/parentFamily.js';
import {trustedPortalOrigin} from '../../shared/utils/portalDestination.js';
import {assistantRpc} from './access.js';
import {createDelegatedDatabase,redactDelegatedData} from './delegatedDatabase.js';
import {delegatedCapability} from './delegatedPolicy.js';
import {assistantCatalog,normalizeAssistantPermissions} from './catalog.js';
import {groupsRouter} from '../groups/index.js';
import {studentsRouter,importRouter} from '../students/index.js';
import {sessionsRouter} from '../sessions/index.js';
import {riskRouter} from '../risk-watchlist/index.js';
import {reportsRouter} from '../reports/index.js';
import {materialsRouter} from '../materials/routes.js';
import {quizzesRouter} from '../quizzes/routes.js';
import {homeworkRouter} from '../homework/routes.js';
import {platformRouter} from '../platform-builder/index.js';
import {assistantsRouter} from './routes.js';
import {settingsRouter} from '../auth/settingsRoutes.js';
import {billingRouter} from '../billing/index.js';
import {templatesRouter,whatsappRouter} from '../whatsapp-notifications/index.js';

const fault=(status:number,message:string)=>Object.assign(new Error(message),{status});
const controllers=Router();
controllers.use('/groups',groupsRouter,importRouter);
controllers.use('/students',studentsRouter);
controllers.use('/sessions',sessionsRouter);
controllers.use('/at-risk',riskRouter);
controllers.use('/reports',reportsRouter);
controllers.use('/materials',materialsRouter);
controllers.use('/quizzes',quizzesRouter);
controllers.use('/homework',homeworkRouter);
controllers.use('/platform',platformRouter);
controllers.use('/assistants',assistantsRouter);
controllers.use('/settings',settingsRouter);
controllers.use('/billing',billingRouter);
controllers.use('/templates',templatesRouter);
controllers.use('/whatsapp',whatsappRouter);
controllers.use((_req,res)=>{res.status(403).json({error:{code:'FORBIDDEN',message:'هذه العملية غير متاحة لحساب المساعد'}});});

export const delegatedWorkspaceRouter=Router();
delegatedWorkspaceRouter.use(async(req:AuthenticatedRequest,res,next)=>{
 res.set('Cache-Control','no-store');
 try{
  const token=req.get('Authorization')?.replace(/^Bearer /,'');
  if(!validFamilyToken(token))throw fault(401,'سجّل دخول حساب المساعد');
  const origin=req.get('Origin') || '';
  if(!trustedPortalOrigin(origin) && !(config.nodeEnv!=='production' && /^http:\/\/(localhost|127\.0\.0\.1):\d+$/.test(origin)))throw fault(403,'افتح مساحة العمل من موقع المنصة');
  // This client is captured before entering the request-local guard. It is
  // used only to resolve the verified session and its real teacher binding.
  const raw=getServiceSupabaseClient(),hash=familyHash(token!);
  const identity=await assistantRpc(raw,'assistant_workspace',{p_token_hash:hash,p_origin:origin,p_resource:'identity',p_action:'view'});
  if(!identity?.id || !identity.tenant_id)throw fault(401,'انتهت جلسة المساعد');
  identity.assistant_id=identity.id;
  const {data:account,error:accountError}=await raw.from('assistant_accounts').select('all_groups,group_ids').eq('assistant_id',identity.id).eq('tenant_id',identity.tenant_id).single();
  if(accountError || !account)throw fault(401,'حساب المساعد غير متاح');
  Object.assign(identity,account);
  const {data:staff,error:staffError}=await raw.from('assistants').select('teacher_id').eq('id',identity.assistant_id).eq('tenant_id',identity.tenant_id).single();
  if(staffError || !staff)throw fault(401,'حساب المساعد غير متاح');
  let ownerId:string|undefined;
  if(staff.teacher_id){
   const {data:teacher,error}=await raw.from('teachers').select('user_id').eq('id',staff.teacher_id).eq('tenant_id',identity.tenant_id).single();
   if(error || !teacher?.user_id)throw fault(403,'رابط المدرس غير متاح');ownerId=teacher.user_id;
  }
  let ownerQuery=raw.from('users').select('id,tenant_id,role,full_name,phone,subject').eq('tenant_id',identity.tenant_id).in('role',['owner','teacher','center_owner']);
  if(ownerId)ownerQuery=ownerQuery.eq('id',ownerId);
  const {data:owners,error:ownerError}=await ownerQuery.limit(2);
  if(ownerError || owners?.length!==1)throw fault(403,'تعذر تحديد حساب المدرس لهذه الدعوة');
  const owner=owners[0],permissions=normalizeAssistantPermissions(identity.permissions || {});
  if(req.method==='GET' && req.path==='/context'){
   res.json({user:{...owner,name:owner.full_name,role:owner.role,tenant_name:identity.teacher_name,teacher_id:staff.teacher_id},actor:{id:identity.assistant_id,name:identity.name},permissions,all_groups:identity.all_groups,group_ids:identity.group_ids,pages:assistantCatalog});return;
  }
  const page=req.get('X-Assistant-Page') || '',route=req.path;
  let savedType:string|undefined;
  if(!['GET','HEAD'].includes(req.method) && (route.startsWith('/materials/') || route==='/quizzes/rich' && (req.body?.id || req.body?.quiz_id))){
   const id=route.startsWith('/materials/')?route.split('/')[2]:req.body.id || req.body.quiz_id;
   if(!/^[a-f0-9-]{36}$/i.test(id))throw fault(400,'السجل غير صالح');
   const {data:row,error}=await raw.from('study_materials').select('type').eq('id',id).eq('tenant_id',identity.tenant_id).maybeSingle();
   if(error || !row)throw fault(403,'هذا المحتوى غير متاح');savedType=row.type;
  }
  const capability=delegatedCapability({method:req.method,path:route,page,body:req.body,permissions,savedType});
  const context={tokenHash:hash,origin,capability,ownerId:owner.id,tenantId:identity.tenant_id,permissions};
  const guarded=createDelegatedDatabase(context);
  req.user={...owner,name:owner.full_name,teacher_id:staff.teacher_id,assistant_id:identity.assistant_id} as UserContext;
  req.supabase=guarded;req.services=undefined;req.token=undefined;
  // Teacher routes return their normal shape, with credentials removed at
  // both the database transport and response boundary.
  const json=res.json.bind(res);res.json=(body:any)=>json(redactDelegatedData(body,context));
  if(!['GET','HEAD'].includes(req.method))res.once('finish',()=>{
   if(res.statusCode<200 || res.statusCode>=300)return;
   void raw.from('assistant_access_audit').insert({tenant_id:identity.tenant_id,assistant_id:identity.assistant_id,action:`workspace.${capability}`,actor_name:identity.name,changes:{method:req.method,path:route}}).then(()=>{},()=>{});
  });
  delegatedClientScope.run(guarded,()=>controllers(req,res,next));
 }catch(error){
  const e=error as Error & {status?:number};
  res.status(e.status || 503).json({error:{code:e.status===401?'UNAUTHORIZED':e.status===403?'FORBIDDEN':'WORKSPACE_UNAVAILABLE',message:e.status?e.message:'تعذر فتح مساحة العمل؛ حاول مجددًا'}});
 }
});
