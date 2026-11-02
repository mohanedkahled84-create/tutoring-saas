import {hasAssistantCapability,assistantCatalog} from './catalog.js';

const denied=()=>Object.assign(new Error('هذه العملية خارج صلاحياتك'),{status:403});
const pageResource=(route:string)=>assistantCatalog.find(page=>page.route===route)?.key;
export type DelegatedPolicyInput={method:string;path:string;page:string;body?:any;permissions:Record<string,boolean>;savedType?:string};
// The browser page is only a hint for read dependencies. Every requested page
// and write capability is checked independently; a page header never grants rights.
export function delegatedCapability({method,path,page,body={},permissions:p,savedType}:DelegatedPolicyInput):string{
 const resource=pageResource(page);if(!resource || !hasAssistantCapability(p,resource))throw denied();
 const read=['GET','HEAD'].includes(method),parts=path.split('?')[0].split('/').filter(Boolean),root=parts[0],tail=parts.slice(1).join('/');
 const require=(key:string,action='view')=>{if(!hasAssistantCapability(p,key,action))throw denied();return `${key}.${action}`;};
 if(read){
  if(['groups','students'].includes(root)){
   const dependencies=root==='groups'?['attendance','homework','materials','online-quizzes','paper-exams','quizzes','platform-builder','video-lessons','students','groups','assistants','sessions','student-cards','dashboard','reports','risk-watchlist']:['attendance','homework','online-quizzes','paper-exams','quizzes','platform-builder','video-lessons','students','groups','student-cards','dashboard','reports','risk-watchlist'];
   if(!dependencies.includes(resource))throw denied();
   if(root==='students' && /\/parent-link$/.test(path))return require('students','send');
   return `${resource}.view`;
  }
  if(root==='sessions'){
   if(!['attendance','sessions','dashboard','reports','risk-watchlist'].includes(resource))throw denied();
   if(tail==='actual-earnings' || /financial-summary$/.test(tail))return require('dashboard');
   return `${resource}.view`;
  }
  if(root==='settings' && !tail || root==='billing' && tail==='status')return `${resource}.view`;
  if(root==='assistants' && !tail)return require(page==='dashboard'?'dashboard':'assistants');
  if(root==='assistants' && ['access-catalog','activity'].includes(tail))return require('assistants');
  if(root==='assistants' && tail==='followup')return require('reports');
  if(root==='assistants' && /^collections/.test(tail))return require('collections');
  if(root==='reports' && tail==='monthly')return require(page==='dashboard'?'dashboard':'reports');
  if(root==='at-risk' && (!tail || tail==='watchlist'))return require(page==='dashboard'?'dashboard':'risk-watchlist');
  if(root==='homework' && tail==='submissions')return require('homework');
  if(root==='materials' && !tail)return require(page==='platform-builder'?'platform-builder':page==='video-lessons'?'video-lessons':'materials');
  if(root==='quizzes')return require(tail.startsWith('submissions')?'online-quizzes':tail==='rich'?(page==='paper-exams'?'paper-exams':'online-quizzes'):'quizzes');
  if(root==='platform' && (tail==='settings' || /^check\//.test(tail)))return require(page==='settings'?'settings':'platform-builder');
  if(root==='platform' && tail==='video-views')return require(page==='platform-builder'?'platform-builder':'video-lessons');
  if(root==='whatsapp' && ['status','quota'].includes(tail))return require('settings');
  if(root==='templates' && !tail)return require('settings');
  if(root==='students' && tail==='meta-portal-quota')return require('students','send');
  throw denied();
 }
 const action=method==='DELETE'?'delete':method==='POST'?'create':'edit';
 if(root==='groups'){
  if(/students/.test(tail))return require('groups','edit');
  return require('groups',action);
 }
 if(root==='students'){
  if(tail==='batch-send-dual-portal-links')return require('students','send');
  if(/send|notify|public-register/.test(tail))throw denied();
  if(!tail || /^[a-f0-9-]{36}$/.test(tail))return require('students',action);
  throw denied();
 }
 if(root==='sessions'){
  if(/send-messages|resend|notify-students/.test(tail))throw denied();
  if(/quiz-scores/.test(tail))return require('quizzes','grade');
  if(/receipt$/.test(tail))return require('dashboard');
  if(/attendance|scan|\/end$/.test(tail))return require('attendance','edit');
  if(!tail)return hasAssistantCapability(p,'attendance','create')?require('attendance','create'):require('sessions','create');
  return require('sessions',tail==='extra'?'create':'edit');
 }
 if(root==='homework' && /submissions\/[a-f0-9-]+\/review$/.test(tail))return require('homework','edit');
 if(root==='materials'){
  // Existing rows are classified from the database, never from the request body.
  const type=savedType || (!tail?body.type:undefined);if(!type)throw denied();
  return require(type==='video'?'video-lessons':'materials',action);
 }
 if(root==='quizzes'){
  if(tail==='dispatch-scores')throw denied();
  if(tail==='scores')return require('quizzes','grade');
  if(tail==='submissions/grade-essay')return require('online-quizzes','grade');
  if(tail==='omr-scan')return require('paper-exams','grade');
  if(tail==='rich'){
   const type=savedType || (!body.id && !body.quiz_id?body.exam_mode:undefined);
   if(!type)throw denied();
   const key=['paper','paper_quiz','paper_exam'].includes(type)?'paper-exams':'online-quizzes';
   return require(key,body.action?.startsWith('delete')?'delete':body.id || body.quiz_id?'edit':'create');
  }
  if(tail==='upload-image')return require(page==='paper-exams'?'paper-exams':'online-quizzes',body.id?'edit':'create');
  if(!tail)return require('quizzes',body.id?'edit':'create');
 }
 if(root==='platform' && tail==='settings')return require('platform-builder','edit');
 if(root==='platform' && tail.startsWith('video-views/'))return require('video-lessons','edit');
 if(root==='settings' && !tail)return require('settings','edit');
 if(root==='assistants'){
  if(tail==='followup/prepare')return require('reports','send');
  if(tail==='collections')return require('collections','create');
  if(/^collections\//.test(tail))throw denied();
  if(tail==='invitations')return require('assistants','create');
  if(/\/(invite|access|registration-link)$/.test(tail))return require('assistants','edit');
  if(!tail || /^[a-f0-9-]{36}$/.test(tail))return require('assistants',action);
 }
 // Account credentials, arbitrary sends, internal and administrator APIs are
 // intentionally absent, even when every teacher page is delegated.
 throw denied();
}
