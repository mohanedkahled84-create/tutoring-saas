import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';
test('LIVE: online batch publication is all-or-nothing, repeat-safe and checks fresh assistant rights without changing manual quizzes',{timeout:120000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID();let owner,server;const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}ok(await db.from('study_materials').delete().eq('tenant_id',tenant));ok(await db.from('tenants').delete().eq('id',tenant));if(owner)await db.auth.admin.deleteUser(owner.id);});
 ok(await db.from('tenants').insert({id:tenant,name:'isolated exam publication'}));owner=ok(await db.auth.admin.createUser({email:`publish-${randomUUID()}@isolated.invalid`,password:'isolated-fixture-password-2026',email_confirm:true})).user;
 ok(await db.from('users').upsert({id:owner.id,tenant_id:tenant,email:owner.email,role:'owner',full_name:'fixture'}));
 const groups=ok(await db.from('groups').insert([{tenant_id:tenant,name:'one'},{tenant_id:tenant,name:'two'}]).select());ok(await db.from('quizzes').insert({tenant_id:tenant,group_id:groups[0].id,quiz_number:1,title:'manual unchanged',max_score:10}));
 const staff=ok(await db.from('assistants').insert({tenant_id:tenant,name:'fixture',phone:'201000000002',status:'active'}).select().single()),permissions={'online-quizzes.view':true,'online-quizzes.create':true};
 ok(await db.from('assistant_accounts').insert({assistant_id:staff.id,tenant_id:tenant,phone:staff.phone,password_hash:'fixture-no-login',permissions,group_ids:[groups[0].id]}));
 const {familyHash,familyToken}=await import('../dist/shared/utils/parentFamily.js'),token=familyToken(),origin='https://centerly-eg.com';ok(await db.from('assistant_sessions').insert({token_hash:familyHash(token),assistant_id:staff.id,origin,credential_version:1}));
 const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 const post=body=>fetch(`http://127.0.0.1:${server.address().port}/api/assistant-access/workspace-api/quizzes/publish-online`,{method:'POST',headers:{Origin:origin,Authorization:'Bearer '+token,'X-Assistant-Page':'online-quizzes','Content-Type':'application/json'},body:JSON.stringify(body)});
 const body={definition:{title:'online saved',subject:'math',quiz_number:1,time_limit_minutes:20,questions:[{id:'q',choices:['A','B'],correct_index:0,points:3}]},targets:groups.map(g=>({id:randomUUID(),group_id:g.id}))};
 assert.equal((await post(body)).status,403);assert.equal(ok(await db.from('study_materials').select('id').eq('tenant_id',tenant)).length,0);
 ok(await db.from('assistant_accounts').update({group_ids:groups.map(g=>g.id)}).eq('assistant_id',staff.id));for(let i=0;i<2;i++){const response=await post(body);assert.equal(response.status,200,await response.clone().text());assert.equal((await response.json()).quizzes.length,2);}
 assert.equal(ok(await db.from('study_materials').select('id').eq('tenant_id',tenant)).length,2);const manual=ok(await db.from('quizzes').select('title,max_score').eq('tenant_id',tenant));assert.deepEqual(manual,[{title:'manual unchanged',max_score:10}]);
 assert.equal((await post({...body,definition:{...body.definition,title:'edited'}})).status,403,'create alone cannot edit');
 ok(await db.from('assistant_accounts').update({permissions:{...permissions,'online-quizzes.edit':true}}).eq('assistant_id',staff.id));assert.equal((await post({...body,definition:{...body.definition,title:'edited'}})).status,200);
 ok(await db.from('assistant_accounts').update({permissions:{'online-quizzes.view':true}}).eq('assistant_id',staff.id));assert.equal((await post({...body,targets:groups.map(g=>({id:randomUUID(),group_id:g.id}))})).status,403);
 assert.equal(ok(await db.from('announcement_recipients').select('id').eq('tenant_id',tenant)).length,0);
 assert.ok((await anonClient.rpc('publish_online_quiz',{p_tenant:tenant,p_user:owner.id,p_assistant:null,p_data:body})).error);
});
