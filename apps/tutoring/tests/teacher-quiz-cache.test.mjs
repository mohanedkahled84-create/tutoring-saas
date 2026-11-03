import test from 'node:test';
import assert from 'node:assert/strict';
import {teacherQuizCache,quizActor} from '../../web/src/utils/teacherQuizCache.js';
test('teacher exam cache isolates account/workspace, retires unowned legacy records and denies delegated disk access',()=>{
 const originalLocal=Object.getOwnPropertyDescriptor(globalThis,'localStorage'),originalSession=Object.getOwnPropertyDescriptor(globalThis,'sessionStorage');
 const storage=()=>{const values=new Map();return {getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,String(v)),removeItem:k=>values.delete(k),values};};
 const local=storage(),session=storage();Object.defineProperty(globalThis,'localStorage',{value:local,configurable:true});Object.defineProperty(globalThis,'sessionStorage',{value:session,configurable:true});
 try{
  const key='centrly_cached_rich_quizzes',owner={user:{id:'A',tenant_id:'workspace'}},other={user:{id:'B',tenant_id:'workspace'}},otherWorkspace={user:{id:'A',tenant_id:'another-workspace'}};
  local.setItem(key,'unowned legacy exam');session.setItem(key,'unowned legacy scan');
  teacherQuizCache(owner).setItem(key,'private exam A');assert.equal(local.getItem(key),null);assert.equal(session.getItem(key),null);assert.equal(local.values.size,0);
  assert.equal(teacherQuizCache(owner).getItem(key),'private exam A');assert.equal(teacherQuizCache(other).getItem(key),null);assert.equal(teacherQuizCache(otherWorkspace).getItem(key),null);
  const delegated={...owner,delegation:{actor:{id:'assistant'},permissions:{'online-quizzes.view':true}}};teacherQuizCache(delegated).setItem(key,'assistant data');assert.equal(teacherQuizCache(delegated).getItem(key),null);assert.equal(teacherQuizCache({}).getItem(key),null);
  const actor=quizActor(delegated);delegated.delegation.permissions={};assert.notEqual(quizActor(delegated),actor);assert.equal(teacherQuizCache(owner).getItem(key),'private exam A');
  teacherQuizCache(owner).removeItem(key);assert.equal(teacherQuizCache(owner).getItem(key),null);
  Object.defineProperty(globalThis,'sessionStorage',{get(){throw Error('storage unavailable');},configurable:true});assert.equal(teacherQuizCache(owner).getItem(key),null);assert.doesNotThrow(()=>teacherQuizCache(owner).setItem(key,'data'));
 }finally{for(const [key,descriptor] of [['localStorage',originalLocal],['sessionStorage',originalSession]]){if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];}}
});
