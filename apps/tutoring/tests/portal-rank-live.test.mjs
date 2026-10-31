import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: portal rank is monthly, group-scoped, tied fairly, private and token-bound',{timeout:120000},async t=>{
  if(!requireIsolatedSupabaseProject(t))return;
  const {serviceClient:db,anonClient}=createIsolatedSupabaseClients();
  const tenant=randomUUID(),other=randomUUID(),group=randomUUID(),outside=randomUUID();
  const ids=Array.from({length:5},()=>randomUUID());let server;
  const marker=randomUUID(),inboxTags=['QUIZ_DEF_','QUIZ_DEF_','QUIZ_DEF_','QUIZ_SUB_','QUIZ_SUB_'].map((prefix,i)=>prefix+marker+'-'+i);
  const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
  t.after(async()=>{try{
    ok(await db.from('whatsapp_inbox').delete().in('phone',inboxTags));
    for(const id of [tenant,other]){
      for(const table of ['quiz_scores','attendance','sessions','group_students','students','groups'])ok(await db.from(table).delete().eq('tenant_id',id));
      ok(await db.from('tenants').delete().eq('id',id));
    }
  }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}});
  ok(await db.from('tenants').insert([{id:tenant,name:'isolated-portal-rank'},{id:other,name:'isolated-portal-rank-other'}]));
  ok(await db.from('groups').insert([{id:group,tenant_id:tenant,name:'rank-group'},{id:outside,tenant_id:tenant,name:'outside-group'}]));
  ok(await db.from('students').insert(ids.map((id,i)=>({id,tenant_id:i===4?other:tenant,name:'rank-'+i,parent_phone:'01000000000',code:String(201+i),student_code:String(201+i),group_id:i<2?group:i===3?outside:null}))));
  ok(await db.from('group_students').insert({tenant_id:tenant,group_id:group,student_id:ids[2]}));
  const cairoDate=new Intl.DateTimeFormat('en-CA',{timeZone:'Africa/Cairo',year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date());
  const session=ok(await db.from('sessions').insert({tenant_id:tenant,group_id:group,session_number:1,session_date:cairoDate}).select('id').single());
  ok(await db.from('attendance').insert([0,1].map(i=>({tenant_id:tenant,student_id:ids[i],session_id:session.id,attended:true,quiz_score:i===0?8:9,quiz_max_score:10,idempotency_key:randomUUID()}))));
  // Duplicate session score must not be counted twice, and previous-month grades do not affect this month.
  ok(await db.from('quiz_scores').insert([
    {tenant_id:tenant,student_id:ids[0],group_id:group,session_id:session.id,score:0,max_score:10,created_at:new Date().toISOString(),idempotency_key:randomUUID()},
    {tenant_id:tenant,student_id:ids[0],group_id:group,score:0,max_score:10,created_at:'2020-01-01T00:00:00Z',idempotency_key:randomUUID()},
    {tenant_id:tenant,student_id:ids[3],group_id:outside,score:10,max_score:10,created_at:new Date().toISOString(),idempotency_key:randomUUID()},
  ]));
  const rank=async(student=ids[0],owner=tenant)=>ok(await db.rpc('get_portal_monthly_group_rank',{p_student_id:student,p_tenant_id:owner}));
  const first=await rank();assert.equal(first.student_rank,2);assert.equal(first.group_size,3);assert.equal(first.rank_period,cairoDate.slice(0,7));
  assert.deepEqual(Object.keys(first).sort(),['group_size','rank_period','student_rank']);
  assert.equal((await rank(ids[2])).student_rank,null,'Unrecorded pupil must not receive a fictional rank');
  assert.equal(await rank(ids[0],other),null,'Another tenant cannot obtain a rank');
  ok(await db.from('attendance').update({quiz_score:8}).eq('tenant_id',tenant).eq('student_id',ids[1]));
  assert.equal((await rank()).student_rank,1);assert.equal((await rank(ids[1])).student_rank,1,'Equal scores share their position');
  assert.equal((await anonClient.rpc('get_portal_monthly_group_rank',{p_student_id:ids[0],p_tenant_id:tenant})).error?.code,'42501');
  const quizId=randomUUID(),foreignQuizId=randomUUID(),questionText='سؤال محفوظ '.repeat(1000);
  ok(await db.from('whatsapp_inbox').insert([
    {phone:inboxTags[0],tenant_id:null,status:'pending',message_body:JSON.stringify({id:quizId,group_id:group,title:'كويز الحساب فقط',questions:[{text:questionText,options:['أ','ب'],correct_index:0}]})},
    {phone:inboxTags[1],tenant_id:null,status:'pending',message_body:JSON.stringify({id:foreignQuizId,group_id:outside,title:'private-other-group',questions:[{text:'خارج المجموعة',options:['أ','ب'],correct_index:1}]})},
    {phone:inboxTags[2],tenant_id:null,status:'pending',message_body:'{malformed historical JSON'},
    {phone:inboxTags[3],tenant_id:null,status:'pending',message_body:JSON.stringify({material_id:quizId,group_id:group,student_code:'201',score:8,total:10})},
    {phone:inboxTags[4],tenant_id:null,status:'pending',message_body:JSON.stringify({material_id:quizId,group_id:group,student_code:'202',score:9,total:10,private_marker:'other-pupil'})},
  ].map(row=>({...row,direction:'outbound'}))));
  const legacy=ok(await db.rpc('portal_legacy_quiz_payload',{p_student_id:ids[0],p_tenant_id:tenant,p_student_code:'201'}));
  assert.equal(legacy.definitions.length,1);assert.equal(legacy.submissions.length,1);
  assert.ok(!JSON.stringify(legacy).includes('private-other-group'));assert.ok(!JSON.stringify(legacy).includes('other-pupil'));
  const {createApp}=await import('../dist/app.js');const {generateParentPortalToken}=await import('../dist/shared/utils/tokens.js');
  server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
  const response=await fetch(`http://127.0.0.1:${server.address().port}/api/public/parent-portal?token=${generateParentPortalToken(ids[0],tenant)}&student_id=${ids[1]}&tenant_id=${other}`,{headers:{'Accept-Encoding':'gzip'}});
  assert.equal(response.status,200);const payload=await response.json();
  assert.equal(payload.student.id,ids[0]);assert.equal(payload.summary.student_rank,1);assert.equal(payload.summary.group_size,3);
  assert.equal(response.headers.get('content-encoding'),'gzip');assert.match(response.headers.get('cache-control'),/no-store/);
  const material=payload.materials.find(m=>m.id===quizId);assert.ok(material);
  assert.equal(material.questions.questions[0].text,questionText);assert.equal(material.questions.questions[0].correct_index,undefined);
});
