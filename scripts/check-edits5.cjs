const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..'),output=process.env.EDITS5_SCREENSHOTS || path.join(process.env.TEMP || root,'centerly-edits5');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:1280,height:1000},reducedMotion:'reduce'}),page=await context.newPage();let verified=false,settingsReads=0;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/')){
    let data={};
    if(url.pathname.includes('/platform/public/')){settingsReads++;data={settings:{subdomain:'fixture',display_title:'منصة الاختبار',cutout_avatar_url:null,is_active:true}};}
    if(url.pathname.endsWith('/status'))data={verified,email:verified?'student@isolated.invalid':null,enabled:verified};
    if(url.pathname.endsWith('/request'))data={challenge_id:'00000000-0000-4000-8000-000000000001',message:'أرسلنا كود التأكيد'};
    if(url.pathname.endsWith('/verify')){verified=true;data={verified:true};}
    return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET,POST,OPTIONS'},body:JSON.stringify(data)});
   }
   if(url.hostname!=='fixture.centerly-eg.com')return route.abort();
   if(url.pathname==='/blank')return route.fulfill({contentType:'text/html',body:'<!doctype html><html dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/apps/web/src/styles/tokens.css"><link rel="stylesheet" href="/apps/web/src/styles/main.css"></head><body><div id="app"></div></body></html>'});
   const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
  });
  await context.addInitScript(()=>{localStorage.setItem('centrly_platform_settings',JSON.stringify({subdomain:'fixture',cutout_avatar_url:'/old-photo.png'}));localStorage.setItem('centrly_platform_settings_saved_at',String(Date.now()));});
  await page.goto('https://fixture.centerly-eg.com/apps/web/teacher-platform-sample/login.html');
  await page.waitForFunction(()=>document.querySelector('.brand-meta h2')?.textContent==='منصة الاختبار');
  assert.ok(settingsReads>0,'fresh settings must be fetched even with a recent cache');assert.equal(await page.locator('.popout-stage').isVisible(),false);
  await page.goto('https://fixture.centerly-eg.com/blank');
  await page.evaluate(async()=>{
   const {renderCommercialBillingView,registerCommercialBillingActions}=await import('/apps/web/src/components/CommercialBillingView.js');
   const catalog=[{id:'basic_v1',name:'Basic',rank:1,price_piasters:24900},{id:'pro_v1',name:'Pro',rank:2,price_piasters:79900},{id:'max_v1',name:'Max',rank:3,price_piasters:99900}].map(p=>({...p,students:300,assistants:4,storage_bytes:15000000000,student_piasters:150}));
   const app={user:{id:'fixture'},billingState:{commercial:{catalog,limits:{plan_id:'pro_v1',is_trial:false,active:true,period_end:'2027-01-01',recurring_piasters:79900,students:300,assistants:4,storage_bytes:15000000000},orders:[],students_used:10,assistants_used:1,storage_bytes_used:0}}};window.centrlyApp=app;registerCommercialBillingActions(app);document.getElementById('app').innerHTML='<div style="max-width:1200px;margin:auto;padding:24px">'+renderCommercialBillingView(app.billingState)+'</div>';app.commercialShowPlans();scrollTo(0,0);
  });
  const toolbar=await page.locator('.commercial-hero-actions button').evaluateAll(buttons=>buttons.map(b=>{const r=b.getBoundingClientRect();return {x:r.x,right:r.right,y:r.y};}));
  assert.equal(toolbar.length,2);assert.ok(Math.abs(toolbar[0].y-toolbar[1].y)<2);assert.ok(Math.min(Math.abs(toolbar[0].right-toolbar[1].x),Math.abs(toolbar[1].right-toolbar[0].x))<20,'header actions stay grouped');
  const frame=await page.locator('.commercial-plan-popular').evaluate(el=>({card:el.getBoundingClientRect().top,badge:el.querySelector('.commercial-popular').getBoundingClientRect().bottom}));assert.ok(Math.abs(frame.card-frame.badge)<4,'popular strip sits above its card');
  assert.equal(await page.locator('.commercial-plan-popular').evaluate(el=>getComputedStyle(el).overflow),'visible','popular strip must not be clipped');
  assert.deepEqual(await page.locator('[data-monthly-price] s').allTextContents(),['٣٥٠ ج.م','١٬٠٠٠ ج.م','١٬٢٥٠ ج.م']);
  await page.locator('.commercial-popular').scrollIntoViewIfNeeded();
  assert.equal(await page.locator('.commercial-popular').evaluate(el=>{const r=el.getBoundingClientRect();return el.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),true,'popular strip is actually painted and reachable');
  const r=await page.locator('.commercial-plan-popular').boundingBox();await page.screenshot({path:path.join(output,'popular-card.png'),clip:{x:r.x,y:r.y-36,width:r.width,height:r.height+36}});
  await page.screenshot({path:path.join(output,'billing-desktop.png'),fullPage:true});
  await page.setViewportSize({width:390,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);await page.screenshot({path:path.join(output,'billing-mobile.png'),fullPage:true});
  await page.goto('https://fixture.centerly-eg.com/blank');
  await page.evaluate(async()=>{localStorage.setItem('centrly_portal_token','fixture');const {renderBasicStudentPortal}=await import('/apps/web/src/components/BasicStudentPortalView.js');document.getElementById('app').innerHTML=renderBasicStudentPortal({student:{name:'طالب الاختبار'},summary:{}});});
  assert.equal(await page.locator('#basic-tab-email').count(),0);await page.locator('[data-open]').click();await page.locator('dialog').waitFor({state:'visible'});await page.locator('[name=email]').fill('student@isolated.invalid');await page.locator('[data-email-form] button').click();await page.locator('[name=code]').fill('123456');await page.locator('[data-code-form] button').click();await page.locator('.se-verified').waitFor();assert.equal(await page.locator('.se-banner').count(),0);assert.equal(await page.locator('dialog').count(),0);
  await page.goto('https://fixture.centerly-eg.com/blank');
  await page.evaluate(async()=>{
   window.turnstile={render:(element,options)=>{window.proofWasVisible=element.isConnected && element.getBoundingClientRect().height>=70;setTimeout(()=>options.callback('fixture-token'),30);return 'fixture-widget';},remove(){}};
   const {mountPhoneVerification}=await import('/apps/web/src/components/PhoneVerification.js');
   const host=document.getElementById('app');mountPhoneVerification(host,{info:{phone:'201099999999',otp_channel:'sms'},requestChallenge:async()=>({context:'bound-context',challengeRequired:false,turnstile:{required:true,siteKey:'fixture'}}),requestCode:async body=>{window.sentProof=body.proof;return {challenge_id:'fixture',expires_in:180,retry_after:60,message:'تم قبول طلب الإرسال'};},verifyCode:async()=>({}),onVerified:()=>{}});
  });
  assert.equal(await page.locator('#phone-code').isVisible(),false);assert.equal(await page.locator('#request-phone-code').textContent(),'تأكيد');await page.locator('#request-phone-code').click();await page.locator('[data-otp-stage]').waitFor({state:'visible'});assert.equal(await page.locator('[data-phone-stage]').isVisible(),false);assert.equal(await page.evaluate(()=>window.proofWasVisible),true);assert.equal(await page.evaluate(()=>window.sentProof.turnstileToken),'fixture-token');
  await page.screenshot({path:path.join(output,'otp-mobile.png'),fullPage:true});
  await page.evaluate(async()=>{const {mountPhoneVerification}=await import('/apps/web/src/components/PhoneVerification.js');mountPhoneVerification(document.getElementById('app'),{info:{phone:'201099999999',otp_channel:'sms'},requestChallenge:async()=>{throw Error('فشل الفحص');},requestCode:async()=>{throw Error('must not send');},verifyCode:async()=>({}),onVerified:()=>{}});});
  await page.locator('#request-phone-code').click();await page.getByText('لم يكتمل طلب إرسال الكود.').waitFor();assert.equal(await page.locator('#phone-code').isVisible(),false);assert.doesNotMatch(await page.locator('#request-phone-code').textContent(),/إعادة الإرسال/);
  console.log('PASS: fresh deleted photo, grouped actions, popular frame, exact crossed prices, responsive billing, email modal without nav, separate OTP step, visible security widget, honest failed-request state');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
