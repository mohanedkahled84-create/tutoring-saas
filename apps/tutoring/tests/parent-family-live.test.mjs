import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID,createHmac} from 'node:crypto';
import {once} from 'node:events';
import {requireIsolatedSupabaseProject,createIsolatedSupabaseClients} from './helpers/live-supabase.mjs';

test('LIVE: delivered family password opens only the registered family across teachers; transfer, phone changes and logout remain scoped',{timeout:180000},async t=>{
 if(!requireIsolatedSupabaseProject(t))return;
 const {serviceClient:db,anonClient}=createIsolatedSupabaseClients(),tenant=randomUUID(),other=randomUUID(),root='https://centerly-eg.com';
 const phone='2010'+String(Math.floor(Math.random()*1e8)).padStart(8,'0'),foreign='2011'+String(Math.floor(Math.random()*1e8)).padStart(8,'0');
 const testIp='2001:db8:'+randomUUID().replaceAll('-','').match(/.{4}/g).slice(0,6).join(':');
 let server;
 const ok=r=>{assert.equal(r.error,null,r.error?.message);return r.data;};
 t.after(async()=>{
  if(server){server.closeAllConnections();await new Promise(r=>server.close(r));}
  ok(await db.from('parent_family_accounts').delete().in('phone',[phone,foreign]));
  for(const id of [tenant,other]){ok(await db.from('portal_domain_bindings').delete().eq('tenant_id',id));ok(await db.from('tenant_platform_settings').delete().eq('tenant_id',id));ok(await db.from('students').delete().eq('tenant_id',id));ok(await db.from('tenants').delete().eq('id',id));}
 });
 ok(await db.from('tenants').insert([{id:tenant,name:'isolated-family-A'},{id:other,name:'isolated-family-B'}]));
 const children=ok(await db.from('students').insert([
 {tenant_id:tenant,name:'أحمد',code:'F1',student_code:'F1',parent_phone:phone,portal_password:'111111'},
 {tenant_id:tenant,name:'منى',code:'F2',student_code:'F2',parent_phone:'0'+phone.slice(2),portal_password:'222222'},
 {tenant_id:other,name:'أحمد',code:'F1',student_code:'F1',parent_phone:'+'+phone,portal_password:'333333'},
 {tenant_id:other,name:'خارج الأسرة',code:'F3',student_code:'F3',parent_phone:foreign,portal_password:'444444'},
 ]).select('id,tenant_id,name'));
 const own=children.find(s=>s.name==='أحمد' && s.tenant_id===tenant),sibling=children.find(s=>s.name==='منى'),second=children.find(s=>s.name==='أحمد' && s.tenant_id===other),outsider=children.find(s=>s.name==='خارج الأسرة');
 const {deliverFamilyAccess,familyHash}=await import('../dist/shared/utils/parentFamily.js');
 const {notifyMetaFamily}=await import('../dist/shared/utils/metaFamily.js');
 const {config}=await import('../dist/shared/config/index.js');
 const {metaWebhookRuntime}=await import('../dist/shared/routes/metaPortalWebhook.js');
 const oldSecret=config.meta.appSecret,oldGateway=metaWebhookRuntime.gateway;
 config.meta.appSecret='isolated-family-meta-secret-not-real';
 const metaReplies=[],metaNotices=[],metaGateway={notify:async(...args)=>{metaNotices.push(args);return true;},reply:async(...args)=>{metaReplies.push(args);return true;}};
 metaWebhookRuntime.gateway=()=>metaGateway;
 t.after(()=>{config.meta.appSecret=oldSecret;metaWebhookRuntime.gateway=oldGateway;});
 t.after(async()=>{ok(await db.from('parent_family_limits').delete().in('key_hash',[familyHash('phone:'+phone),familyHash('phone:'+foreign),familyHash('ip:'+testIp)]));});
 const {generateParentPortalToken}=await import('../dist/shared/utils/tokens.js');
 const matched=ok(await db.rpc('meta_portal_phone_records',{p_phone:phone}));assert.equal(matched.length,3);assert.ok(matched.every(s=>s.parent_match));
 assert.equal((await anonClient.rpc('meta_portal_phone_records',{p_phone:phone})).error?.code,'42501');
 await notifyMetaFamily(db,tenant,own.id,'المعلم',metaGateway,true);assert.equal(metaNotices.length,1);
 assert.equal(ok(await db.from('parent_family_accounts').select('id').eq('phone',phone)).length,0,'Notification alone cannot provision or disclose a password');
 assert.equal(ok(await db.rpc('parent_family_delivery',{p_tenant_id:tenant,p_student_id:own.id,p_hash:'unused',p_cipher:'unused',p_phone:foreign})),null,'A phone edit during provisioning must not create a mismatched credential');
 let secret,recipient;
 const delivery={ready:async()=>true,send:async(p,password,url)=>{recipient=p;secret=password;assert.match(url,/family=1/);return true;}};
 await assert.rejects(()=>deliverFamilyAccess(db,tenant,outsider.id,delivery),e=>e.status===400);
 assert.deepEqual(Object.keys(await deliverFamilyAccess(db,tenant,own.id,delivery)).sort(),['message','success']);
 assert.equal(recipient,phone);assert.match(secret,/^\d{12}$/);assert.notEqual(secret,'111111');
 const account=ok(await db.from('parent_family_accounts').select('*').eq('phone',phone).single());assert.ok(!JSON.stringify(account).includes(secret));
 await assert.rejects(()=>deliverFamilyAccess(db,other,second.id,delivery),e=>e.status===429);
 ok(await db.from('parent_family_accounts').update({last_requested_at:new Date(Date.now()-61000).toISOString()}).eq('id',account.id));
 const firstSecret=secret;await deliverFamilyAccess(db,other,second.id,delivery);assert.equal(secret,firstSecret,'Second teacher resends the same password without resetting family access');
 const {createApp}=await import('../dist/app.js');server=createApp().listen(0,'127.0.0.1');await once(server,'listening');
 const base=`http://127.0.0.1:${server.address().port}/api/public/family`;
 const post=async(path,body,origin=root)=>fetch(base+path,{method:'POST',headers:{Origin:origin,'X-Forwarded-For':testIp},body:new URLSearchParams(body)});
 const webhook=async(msg,valid=true,waba=config.meta.wabaId)=>{
  const raw=JSON.stringify({object:'whatsapp_business_account',entry:[{id:waba,changes:[{field:'messages',value:{messaging_product:'whatsapp',metadata:{phone_number_id:config.meta.phoneNumberId},messages:[{from:phone,timestamp:String(Math.floor(Date.now()/1000)),type:'button',button:{text:'الحصول على اسم المستخدم وكلمه السر',payload:`CENTRLY_FAMILY:${own.id}:${tenant}`},...msg}]}}]}]});
  const sig='sha256='+createHmac('sha256',config.meta.appSecret).update(raw).digest('hex');
  return fetch(base.replace('/api/public/family','')+'/meta/webhook',{method:'POST',headers:{'Content-Type':'application/json','X-Hub-Signature-256':valid?sig:'sha256='+'0'.repeat(64)},body:raw});
 };
 ok(await db.from('parent_family_accounts').update({last_requested_at:new Date(Date.now()-61000).toISOString()}).eq('id',account.id));
 assert.equal((await webhook({id:'wamid.'+own.id},false)).status,401);assert.equal(metaReplies.length,0);
 assert.equal((await webhook({id:'wamid.'+own.id})).status,200);assert.equal(metaReplies.length,1);assert.equal(metaReplies[0][0],phone);assert.ok(metaReplies[0][1].includes(firstSecret));
 assert.equal((await webhook({id:'wamid.'+own.id})).status,200);assert.equal(metaReplies.length,1,'A replay cannot resend credentials');
 assert.equal((await webhook({id:'wamid.wrong-phone.'+own.id,from:foreign})).status,200);assert.equal(metaReplies.length,1);
 assert.equal((await webhook({id:'wamid.wrong-waba.'+own.id},true,'different-waba')).status,200);assert.equal(metaReplies.length,1);
 assert.equal((await post('/login',{phone,password:'111111'})).status,401,'Student PIN cannot open family');
 assert.equal((await post('/account',{family_token:generateParentPortalToken(own.id,tenant)})).status,401);
 assert.equal((await post('/login',{phone,password:secret},'https://evil.example')).status,403);
 const login=await post('/login',{phone:'0'+phone.slice(2),password:secret});assert.equal(login.status,200);const session=await login.json();
 assert.match(session.family_token,/^[A-Za-z0-9_-]{43}$/);assert.match(login.headers.get('cache-control'),/no-store/);
 const storedSession=ok(await db.from('parent_family_sessions').select('*').eq('token_hash',familyHash(session.family_token)).single());assert.ok(!JSON.stringify(storedSession).includes(session.family_token));
 const read=await post('/account',{family_token:session.family_token,student_id:own.id});assert.equal(read.status,200);const data=await read.json();
 assert.equal(data.students.length,3);assert.equal(data.initial_data.student.id,own.id);assert.ok(!JSON.stringify(data).includes('portal_password'));assert.ok(!JSON.stringify(data).includes('password_cipher'));assert.equal(data.initial_data.summary.student_rank,undefined);
 assert.equal((await post('/account',{family_token:session.family_token,student_id:outsider.id})).status,403);
 const next=await (await post('/account',{family_token:session.family_token,student_id:sibling.id})).json();assert.equal(next.initial_data.student.id,sibling.id);
 const sub='family-'+randomUUID().slice(0,8),target=`https://${sub}.centerly-eg.com`;
 ok(await db.from('tenant_platform_settings').insert({tenant_id:other,subdomain:sub,display_title:'معلم الأسرة الثاني',subject_title:'الرياضيات',is_active:true}));
 ok(await db.from('portal_domain_bindings').insert({tenant_id:other,subdomain:sub}));
 const transfer=await (await post('/account',{family_token:session.family_token,student_id:second.id})).json();assert.equal(transfer.destination.origin,target);assert.ok(!transfer.initial_data);
 assert.equal((await post('/account',{family_token:session.family_token},target)).status,401,'A root bearer is bound to its original origin');
 assert.equal((await post('/handoff',{ticket:transfer.destination.ticket})).status,401,'Wrong origin does not redeem');
 const raced=await Promise.all([post('/handoff',{ticket:transfer.destination.ticket},target),post('/handoff',{ticket:transfer.destination.ticket},target)]);assert.deepEqual(raced.map(r=>r.status).sort(),[200,401]);
 const arrived=await raced.find(r=>r.status===200).json();assert.equal(arrived.initial_data.student.id,second.id);assert.equal(arrived.presentation.display_title,'معلم الأسرة الثاني');assert.notEqual(arrived.family_token,session.family_token);assert.equal(new Date(arrived.expires_at).getTime(),new Date(session.expires_at).getTime());
 const ticket=await (await post('/account',{family_token:session.family_token,student_id:second.id})).json();
 ok(await db.from('parent_family_handoffs').update({expires_at:new Date(Date.now()-1000).toISOString()}).eq('ticket_hash',familyHash(ticket.destination.ticket)));
 assert.equal((await post('/handoff',{ticket:ticket.destination.ticket},target)).status,401);
 ok(await db.from('students').update({parent_phone:foreign}).eq('id',sibling.id));
 assert.equal((await post('/account',{family_token:session.family_token,student_id:sibling.id})).status,403);
 const refreshed=await (await post('/account',{family_token:session.family_token,student_id:own.id})).json();assert.equal(refreshed.students.length,2);
 const pending=await (await post('/account',{family_token:session.family_token,student_id:second.id})).json();
 assert.equal((await post('/logout',{family_token:arrived.family_token},target)).status,200);
 assert.equal((await post('/account',{family_token:session.family_token})).status,401);
 assert.equal((await post('/handoff',{ticket:pending.destination.ticket},target)).status,401);
 // Concurrent logout/transfer cannot deadlock or leave a derived session alive.
 for(let i=0;i<3;i++){
  const fresh=await (await post('/login',{phone,password:secret})).json();assert.ok(fresh.family_token);
  const moving=await (await post('/account',{family_token:fresh.family_token,student_id:second.id})).json();
  const [exiting,redeeming]=await Promise.all([post('/logout',{family_token:fresh.family_token}),post('/handoff',{ticket:moving.destination.ticket},target)]);
  assert.equal(exiting.status,200);assert.ok([200,401].includes(redeeming.status),`A transfer race must not deadlock (HTTP ${redeeming.status})`);
  if(redeeming.status===200){const transferred=await redeeming.json();assert.equal((await post('/account',{family_token:transferred.family_token,student_id:second.id},target)).status,401);}
  assert.equal((await post('/account',{family_token:fresh.family_token})).status,401);
 }
 for(const table of ['parent_family_accounts','parent_family_sessions','parent_family_handoffs','parent_family_limits'])assert.equal((await anonClient.from(table).select('*')).error?.code,'42501');
 const privateRpcs=[['parent_family_phone',{p_phone:phone}],['parent_family_limit',{p_key:'forged',p_max:100}],['parent_family_identity',{p_token_hash:'forged',p_origin:root}],['parent_family_directory',{p_token_hash:'forged',p_origin:root}],['parent_family_context',{p_token_hash:'forged',p_origin:root,p_student_id:own.id}],['parent_family_delivery',{p_tenant_id:tenant,p_student_id:own.id,p_hash:'forged',p_cipher:'forged'}],['parent_family_redeem',{p_ticket_hash:'forged',p_origin:root,p_token_hash:'forged'}],['parent_family_logout',{p_token_hash:'forged',p_origin:root}]];
 for(const [name,args] of privateRpcs)assert.equal((await anonClient.rpc(name,{...args,...(name==='parent_family_delivery'?{p_phone:phone}:{})})).error?.code,'42501',name);
 // Persistent limits reject repeated password guesses regardless of process/replica.
 for(let i=0;i<8;i++)await post('/login',{phone:foreign,password:'wrong'});
 const guesses=await Promise.all(Array.from({length:4},()=>post('/login',{phone:foreign,password:'wrong'})));assert.ok(guesses.some(r=>r.status===429));
 assert.equal((await fetch(base.replace('/public/family','')+`/students/${own.id}/send-family-access`,{method:'POST',headers:{Origin:root}})).status,401);
});
