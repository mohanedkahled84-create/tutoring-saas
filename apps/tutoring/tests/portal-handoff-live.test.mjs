import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,randomBytes} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: stable links follow publication and rename; handoffs are origin-bound, expiring and single use',{timeout:180000},async t=>{
  if(!requireIsolatedSupabaseProject(t))return;
  const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID(),other=randomUUID();let server,authUser;
  const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
  t.after(async()=>{try{
    for(const id of [tenant,other]){ok(await db.from('portal_handoffs').delete().eq('tenant_id',id));ok(await db.from('tenant_platform_settings').delete().eq('tenant_id',id));ok(await db.from('students').delete().eq('tenant_id',id));ok(await db.from('tenants').delete().eq('id',id));}
    if(authUser){ok(await db.from('users').delete().eq('id',authUser));ok(await db.auth.admin.deleteUser(authUser));}
  }finally{if(server){server.closeAllConnections();await new Promise(resolve=>server.close(resolve));}}});
  ok(await db.from('tenants').insert([{id:tenant,name:'isolated-stable-portal'},{id:other,name:'isolated-stable-portal-other'}]));
  const student=ok(await db.from('students').insert({tenant_id:tenant,name:'stable-portal-student',code:'1001',student_code:'1001',parent_phone:'01000000000'}).select('id').single());
  const otherStudent=ok(await db.from('students').insert({tenant_id:other,name:'stable-portal-other-student',code:'1001',student_code:'1001',parent_phone:'01000000000'}).select('id').single());
  const {generateParentPortalToken,verifyParentPortalToken,deriveShortCode}=await import('../dist/shared/utils/tokens.js');
  const {hashPortalTicket}=await import('../dist/shared/utils/portalDestination.js');
  const token=generateParentPortalToken(student.id,tenant),otherToken=generateParentPortalToken(otherStudent.id,other);
  const sub='t-'+randomUUID().slice(0,8),target=`https://${sub}.centerly-eg.com`,root='https://centerly-eg.com';
  ok(await db.from('tenant_platform_settings').insert({tenant_id:tenant,subdomain:sub,display_title:'منصة الاختبار',subject_title:'الفيزياء',is_active:false}));
  const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');const base=`http://127.0.0.1:${server.address().port}/api/public/portal`;
  const post=async(path,body,origin=root)=>fetch(base+path,{method:'POST',headers:{'Content-Type':'application/json',Origin:origin},body:JSON.stringify(body)});
  const destination=async(role='parent',credential=token)=>{const res=await post('/destination',{token:credential,role,tenant_id:other,subdomain:'evil'});assert.equal(res.status,200);assert.match(res.headers.get('cache-control'),/no-store/);return res.json();};
  const basic=await destination();assert.equal(basic.origin,root);assert.equal(basic.ticket,null);assert.equal(basic.presentation,null);
  const resolveOld=async role=>{
    const response=await fetch(`http://127.0.0.1:${server.address().port}/api/public/short-links/${deriveShortCode(student.id,role)}`);
    assert.equal(response.status,200);const data=await response.json();assert.equal(data.student_id,student.id);assert.equal(data.portal_type,role);return data;
  };
  await resolveOld('parent');await resolveOld('student');
  assert.equal((await post('/destination',{token:'forged',role:'parent'})).status,401);
  assert.equal((await post('/destination',{token,role:'admin'})).status,400);
  // Existing CORS middleware rejects external origins before the portal router.
  const external=await post('/destination',{token,role:'parent'},'https://evil.test');assert.equal(external.status,403);assert.equal((await external.json()).error.code,'CORS_FORBIDDEN');
  ok(await db.from('tenant_platform_settings').update({is_active:true}).eq('tenant_id',tenant));
  const advanced=await destination();assert.equal(advanced.origin,target);assert.match(advanced.ticket,/^[A-Za-z0-9_-]{43}$/);assert.equal((await destination('parent',otherToken)).origin,root);
  const stored=ok(await db.from('portal_handoffs').select('*').eq('ticket_hash',hashPortalTicket(advanced.ticket)).single());assert.equal(stored.student_id,student.id);assert.equal(stored.tenant_id,tenant);assert.ok(!JSON.stringify(stored).includes(token));
  assert.equal((await post('/handoff',{ticket:advanced.ticket},root)).status,401);
  const race=await Promise.all([post('/handoff',{ticket:advanced.ticket},target),post('/handoff',{ticket:advanced.ticket},target)]);assert.deepEqual(race.map(r=>r.status).sort(),[200,401]);
  const arrival=await race.find(r=>r.status===200).json();assert.equal(arrival.role,'parent');assert.equal(arrival.origin,target);
  assert.equal(verifyParentPortalToken(arrival.token).expires_at,verifyParentPortalToken(token).expires_at,'Transfer must not extend the signed session');
  const portal=await fetch(`http://127.0.0.1:${server.address().port}/api/public/parent-portal?token=${encodeURIComponent(arrival.token)}`);assert.equal(portal.status,200);assert.equal((await portal.json()).student.id,student.id);
  const studentTicket=await destination('student');const studentArrival=await post('/handoff',{ticket:studentTicket.ticket},target);assert.equal(studentArrival.status,200);assert.equal((await studentArrival.json()).role,'student');
  const expired=randomBytes(32).toString('base64url');ok(await db.from('portal_handoffs').insert({ticket_hash:hashPortalTicket(expired),student_id:student.id,tenant_id:tenant,portal_role:'parent',target_origin:target,expires_at:new Date(Date.now()-1000).toISOString()}));assert.equal((await post('/handoff',{ticket:expired},target)).status,401);
  assert.equal((await anonClient.from('portal_handoffs').select('*')).error?.code,'42501');
  assert.equal((await anonClient.from('portal_handoffs').insert({ticket_hash:hashPortalTicket('forged')})).error?.code,'42501');
  const email=`portal-handoff-${randomUUID()}@example.invalid`,password=`Portal!${randomUUID()}a9`;
  authUser=ok(await db.auth.admin.createUser({email,password,email_confirm:true})).user.id;
  ok(await anonClient.auth.signInWithPassword({email,password}));
  assert.equal((await anonClient.from('portal_handoffs').select('*')).error?.code,'42501');
  assert.equal((await anonClient.from('portal_handoffs').delete().eq('tenant_id',tenant)).error?.code,'42501');
  const stale=await destination();ok(await db.from('tenant_platform_settings').update({subdomain:sub+'-new'}).eq('tenant_id',tenant));assert.equal((await post('/handoff',{ticket:stale.ticket},target)).status,401);assert.equal((await destination()).origin,`https://${sub}-new.centerly-eg.com`);
  assert.equal(verifyParentPortalToken((await resolveOld('parent')).token).student_id,student.id);
  const published=await destination();ok(await db.from('tenant_platform_settings').update({is_active:false}).eq('tenant_id',tenant));assert.equal((await post('/handoff',{ticket:published.ticket},published.origin)).status,401);assert.equal((await destination()).origin,root);
});
