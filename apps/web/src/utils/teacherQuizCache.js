// Exam definitions and scan results belong to one workspace account. Delegated
// sessions always refresh their permitted data from the server.
const keys=new Set(['centrly_quiz_drafts','centrly_cached_rich_quizzes','centrly_paper_scanned_results']);
export const quizActor=app=>JSON.stringify([app?.user?.tenant_id || '',app?.user?.id || '',app?.delegation?.actor?.id || app?.delegation?.assistant_id || '',app?.delegation?.permissions || null]);
export function teacherQuizCache(app){
 const identity=app?.user?.tenant_id && app?.user?.id && !app.delegation && !app.user.assistant_id && app.user.role!=='assistant' && !globalThis.window?.__CENTRLY_ASSISTANT_RUNTIME__?quizActor(app):null;
 let persistent=false;try{persistent=Boolean(globalThis.localStorage?.getItem('centrly_token'));}catch{}
 const storage=()=>persistent?globalThis.localStorage:globalThis.sessionStorage;
 const scoped=key=>identity && keys.has(key)?'centrly_teacher_quiz_v1:'+encodeURIComponent(identity)+':'+key:null;
 // Unscoped legacy records cannot safely be attributed to an account.
 for(const key of keys)for(const name of ['localStorage','sessionStorage']){try{globalThis[name]?.removeItem(key);}catch{}}
 return {
  getItem(key){try{const name=scoped(key);return name?storage()?.getItem(name) || null:null;}catch{return null;}},
  setItem(key,value){try{const name=scoped(key);if(name)storage()?.setItem(name,value);}catch{}},
  removeItem(key){try{const name=scoped(key);if(name)storage()?.removeItem(name);}catch{}},
 };
}
