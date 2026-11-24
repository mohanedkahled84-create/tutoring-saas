const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),{createHash}=require('node:crypto');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..'),web=path.join(root,'apps/web');
const policy=JSON.parse(fs.readFileSync(path.join(web,'vercel.json'))).routes.find(r=>r.headers?.['Content-Security-Policy']).headers['Content-Security-Policy'];
const workspace='00000000-0000-4000-8000-000000000001',invitation='x'.repeat(43);
const fixture={context:'isolated-fixture-context',challengeRequired:true,challenge:'a'.repeat(64),difficulty:3,turnstile:{required:false}};
const challenge=process.env.OTP_CHALLENGE_FILE?JSON.parse(fs.readFileSync(process.env.OTP_CHALLENGE_FILE)):fixture;
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage();let sent=false,verified=false,accepted=false;const errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.startsWith('/api/assistant-access/')){
    const p=u.pathname.split('/').slice(-2).join('/'),body=route.request().postDataJSON();let data={};
    if(p==='registration/info')data={tenant_id:workspace,teacher_name:'مدرس الاختبار',phone:'201000000000',otp_channel:'sms',otp_available:true};
    if(p==='registration/challenge')data=challenge;
    if(p==='registration/claim')data={tenant_id:workspace,teacher_name:'مدرس الاختبار',phone:'201000000000'};
    if(p==='registration/request'){
     assert.equal(body.proof.context,challenge.context);const hash=createHash('sha256').update(challenge.challenge+':'+body.proof.nonce).digest('hex');assert.ok(hash.startsWith('0'.repeat(challenge.difficulty)),'actual browser worker solved the challenge');sent=true;
     data={challenge_id:workspace,expires_in:300,retry_after:60,delivery:'accepted'};
    }
    if(p==='registration/verify'){assert.ok(sent);assert.equal(body.code,'123456');verified=true;data={ticket:'t'.repeat(43),phone:'201000000000'};}
    if(u.pathname.endsWith('/accept')){assert.ok(verified);assert.equal(body.ticket,'t'.repeat(43));assert.ok(!body.phone);accepted=true;data={token:'s'.repeat(43),workspace};}
    return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://centerly-eg.com','Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Allow-Methods':'POST,GET,OPTIONS'},body:JSON.stringify(data)});
   }
   if(u.hostname!=='centerly-eg.com')return route.abort();
   if(u.pathname==='/src/assistantRuntime.js')return route.fulfill({contentType:'application/javascript',body:"export async function mountAssistantWorkspace({root,onReady}){root.innerHTML='<p data-test-workspace>مساحة العمل</p>';onReady({user:{tenant_name:'مدرس الاختبار'}});return ()=>{};}"});
   const file=u.pathname==='/assistant'?path.join(web,'assistant.html'):path.resolve(web,'.'+u.pathname);assert.ok(file.startsWith(web+path.sep));
   const type=file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':file.endsWith('.html')?'text/html':'image/png';
   return route.fulfill({contentType:type,headers:type==='text/html'?{'Content-Security-Policy':policy}:{},body:fs.readFileSync(file)});
  });
  await page.goto(`https://centerly-eg.com/assistant?workspace=${workspace}#registration=${invitation}`);
  await page.locator('#request-phone-code').waitFor();await page.reload();await page.locator('#request-phone-code').click();
  await page.locator('[data-otp-stage]').waitFor({state:'visible',timeout:55000});assert.ok(sent);assert.equal(await page.locator('[data-phone-stage]').isVisible(),false);
  assert.equal(await page.locator('.auth-card h1').textContent(),'اكتب كود التأكيد');
  await page.reload();await page.locator('[data-otp-stage]').waitFor({state:'visible'});
  await page.locator('#phone-code').fill('123456');await page.locator('#phone-code-form button').click();
  await page.locator('#full-name').waitFor();await page.reload();
  await page.locator('#full-name').fill('مساعد الاختبار');await page.locator('#password').fill('isolated-password-123');await page.locator('#access-form [type=submit]').click();
  await page.locator('[data-test-workspace]').waitFor();assert.ok(accepted);assert.deepEqual(errors,[]);
  console.log('PASS: actual assistant entry + production CSP + real proof worker -> separate OTP screen -> verified account form -> assistant session. Send/verify/workspace APIs isolated; no message sent.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
