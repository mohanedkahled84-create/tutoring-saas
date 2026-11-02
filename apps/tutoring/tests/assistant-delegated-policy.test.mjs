import test from 'node:test';
import assert from 'node:assert/strict';
import {delegatedCapability} from '../dist/features/assistants/delegatedPolicy.js';
import {createDelegatedFetch,delegatedSelect,redactDelegatedData} from '../dist/features/assistants/delegatedDatabase.js';
import {assistantCatalog} from '../dist/features/assistants/catalog.js';
import {delegatedClientScope} from '../dist/shared/delegatedClient.js';
import {getServiceSupabaseClient} from '../dist/supabase.js';
import {config} from '../dist/shared/config/index.js';

const full=Object.fromEntries(assistantCatalog.flatMap(page=>page.actions.map(action=>[`${page.key}.${action}`,true])));
const policy=(method,path,page,permissions=full,body={},savedType)=>delegatedCapability({method,path,page,permissions,body,savedType});
test('all teacher pages have independent permission keys, with closed access by default',()=>{
 assert.equal(assistantCatalog.length,17);
 for(const page of assistantCatalog){const endpoint=page.key==='settings'?'/settings':'/groups';assert.throws(()=>policy('GET',endpoint,page.route,{}),e=>e.status===403);assert.equal(policy('GET',endpoint,page.route,{[page.key+'.view']:true}),page.key+'.view');}
 assert.throws(()=>policy('GET','/students','settings',{'settings.view':true}),e=>e.status===403);
 assert.throws(()=>policy('GET','/students','assistants',{'assistants.view':true}),e=>e.status===403);
 for(const path of ['/admin/overview','/auth/me','/auth/refresh','/centers/rooms','/internal/cron','/unknown'])assert.throws(()=>policy('GET',path,'sessions'),e=>e.status===403);
});
test('read permission cannot become a write through a page hint, collection operation or provider endpoint',()=>{
 const read=Object.fromEntries(assistantCatalog.map(page=>[page.key+'.view',true]));
 for(const [path,page,body] of [['/groups','groups',{}],['/students','students',{}],['/sessions','sessions',{}],['/materials','materials',{type:'pdf'}],['/platform/settings','platform-builder',{}],['/assistants/invitations','assistants',{}],['/quizzes/scores','quizzes',{}]])assert.throws(()=>policy('POST',path,page,read,body),e=>e.status===403,path);
 for(const path of ['/whatsapp/test','/students/id/send-family-access','/students/id/send-parent-link','/sessions/id/send-messages','/auth/change-password','/assistants/collections/id/void'])assert.throws(()=>policy('POST',path,'students'),e=>e.status===403,path);
 assert.equal(policy('POST','/sessions/id/attendance','sessions'),'attendance.edit');
 assert.equal(policy('POST','/sessions','sessions'),'attendance.create');
 assert.equal(policy('POST','/students/batch-send-dual-portal-links','students'),'students.send');
});
test('saved material type decides permission, so body spoofing cannot edit videos with PDF rights',()=>{
 const p={'materials.view':true,'materials.edit':true};
 assert.throws(()=>policy('PATCH','/materials/id','materials',p,{type:'pdf'},'video'),e=>e.status===403);
 assert.equal(policy('PATCH','/materials/id','materials',p,{type:'pdf'},'pdf'),'materials.edit');
 assert.throws(()=>policy('PATCH','/materials/id','materials',p,{type:'pdf'}),e=>e.status===403);
});
test('delegated transport rewrites tables and embedded relations, rejects arbitrary RPC/schema/auth and strips secrets',async()=>{
 const context={tokenHash:'fixture-hash',origin:'https://centerly-eg.com',capability:'students.view',ownerId:'owner',tenantId:'tenant',permissions:{'students.view':true}};
 const calls=[],guard=createDelegatedFetch(context,async(input,init)=>{calls.push({url:new URL(input).toString(),headers:new Headers(init.headers)});return Response.json([{id:'visible',password_hash:'secret',portal_password:'private'}]);});
 const base=config.supabaseUrl;
 const response=await guard(base+'/rest/v1/students?select=id,groups(id,name)');assert.deepEqual(await response.json(),[{id:'visible'}]);
 assert.match(calls[0].url,/assistant_delegated_students/);assert.match(decodeURIComponent(calls[0].url),/groups:assistant_delegated_groups\(id,name\)/);assert.equal(calls[0].headers.get('x-assistant-capability'),'students.view');
 for(const path of ['/auth/v1/admin/users','/rest/v1/arbitrary','/rest/v1/assistant_accounts_private','/rest/v1/rpc/assistant_delegated_rpc'])await assert.rejects(guard(base+path,{method:'POST',body:'{}'}),e=>e.status===403);
 await assert.rejects(guard(base+'/rest/v1/students',{headers:{'accept-profile':'auth'}}),e=>e.status===403);
 await assert.rejects(guard(base+'/storage/v1/object/public/homework-submissions/foreign/file'),e=>e.status===403);
 assert.deepEqual(redactDelegatedData({access_token:'x',nested:{password_cipher:'x',name:'safe'}},context),{nested:{name:'safe'}});
 assert.equal(delegatedSelect('id,group:groups!group_id(name),students(id)'), 'id,group:assistant_delegated_groups!group_id(name),students:assistant_delegated_students(id)');
});
test('concurrent assistant requests cannot share a database client or contaminate owner requests',async()=>{
 const a={},b={};
 await Promise.all([delegatedClientScope.run(a,async()=>{await new Promise(r=>setTimeout(r,10));assert.equal(getServiceSupabaseClient(),a);}),delegatedClientScope.run(b,async()=>{await new Promise(r=>setTimeout(r,5));assert.equal(getServiceSupabaseClient(),b);})]);
 assert.notEqual(getServiceSupabaseClient(),a);assert.notEqual(getServiceSupabaseClient(),b);
});
