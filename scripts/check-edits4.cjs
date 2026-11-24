const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const context=await browser.newContext({viewport:{width:390,height:844},reducedMotion:'reduce'}),page=await context.newPage();
  let verified=false;
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/')){
    let data={settings:{subdomain:'fixture',display_title:'Fixture teacher'}};
    if(url.pathname.endsWith('/status'))data={verified,email:verified?'student@isolated.invalid':null,enabled:verified};
    if(url.pathname.endsWith('/request'))data={challenge_id:'00000000-0000-4000-8000-000000000001',message:'أرسلنا كود التأكيد'};
    if(url.pathname.endsWith('/verify')){verified=true;data={verified:true};}
    return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'POST,GET,OPTIONS'},body:JSON.stringify(data)});
   }
   if(url.hostname!=='fixture.centerly-eg.com')return route.abort();
   if(url.pathname==='/blank')return route.fulfill({contentType:'text/html',body:'<html dir="rtl"><body></body></html>'});
   const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':file.endsWith('.css')?'text/css':'text/html',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
  });
  await page.goto('https://fixture.centerly-eg.com/apps/web/teacher-platform-sample/login.html');
  assert.equal(await page.locator('#formRegister').count(),0);
  assert.equal(await page.locator('.popout-stage').isVisible(),false);
  await page.evaluate(()=>applySettingsToDOM({cutout_avatar_url:'/missing-image.png'}));
  assert.equal(await page.locator('.popout-stage').isVisible(),false);
  await page.goto('https://fixture.centerly-eg.com/blank');
  await page.evaluate(async()=>{
   const {mountPhoneVerification}=await import('/apps/web/src/components/PhoneVerification.js');
   window.host=document.createElement('div');document.body.append(host);
   mountPhoneVerification(host,{info:{phone:'201099999999'},requestCode:async()=>({challenge_id:'fixture',expires_in:300,retry_after:60,message:'Code sent'}),verifyCode:async()=>({}),onVerified:()=>{}});
  });
  assert.equal(await page.locator('#phone-code').isVisible(),false);await page.locator('#request-phone-code').click();
  await page.waitForFunction(()=>document.activeElement.id==='phone-code');assert.equal(await page.locator('#phone-code').isVisible(),true);
  const alpha=await page.evaluate(async()=>{
   const {prepareTeacherCutout}=await import('/apps/web/src/utils/teacherCutout.js');
   const canvas=document.createElement('canvas');canvas.width=100;canvas.height=100;const ctx=canvas.getContext('2d');ctx.fillRect(0,0,100,100);
   let rejected=false;try{await prepareTeacherCutout(canvas.toDataURL('image/png'));}catch{rejected=true;}
   ctx.clearRect(0,0,20,100);const converted=await prepareTeacherCutout(canvas.toDataURL('image/webp'));
   return {rejected,png:converted.startsWith('data:image/png;')};
  });assert.deepEqual(alpha,{rejected:true,png:true});
  await page.evaluate(async()=>{
   const {renderCommercialBillingView,registerCommercialBillingActions}=await import('/apps/web/src/components/CommercialBillingView.js');
   const plan={id:'pro_v1',name:'Pro',rank:2,price_piasters:79900,students:300,assistants:4,storage_bytes:15000000000,student_piasters:150};
   const app={user:{id:'fixture'},billingState:{commercial:{catalog:[plan],limits:{plan_id:'pro_v1',is_trial:false,active:true,students:300,assistants:4,storage_bytes:15000000000},orders:[{id:'unfinished',kind:'renew',state:'quoted'}],students_used:0,assistants_used:0,storage_bytes_used:0}}};
   window.centrlyApp=app;registerCommercialBillingActions(app);document.body.innerHTML=renderCommercialBillingView(app.billingState);
  });
  assert.equal(await page.locator('#pricingPlansSection').isVisible(),false);
  assert.equal(await page.getByText('استكمال بيانات الدفع').count(),0);
  await page.evaluate(()=>window.centrlyApp.commercialShowPlans());
  await page.locator('[data-cycle="6"]').click();assert.match(await page.locator('[data-monthly-price]').textContent(),/٤٬٠٧٤٫٩/);
  await page.locator('[data-cycle="12"]').click();assert.match(await page.locator('[data-monthly-price]').textContent(),/٧٬١٩١/);
  assert.equal(await page.locator('.commercial-popular').textContent(),'الأكثر طلبًا');
  await page.goto('https://fixture.centerly-eg.com/blank');
  await page.evaluate(async()=>{localStorage.setItem('centrly_portal_token','fixture');await import('/apps/web/src/components/StudentEmailSettings.js');document.body.innerHTML='<student-email-settings></student-email-settings>';});
  await page.locator('[name=email]').fill('student@isolated.invalid');await page.locator('[data-email-form] button').click();
  await page.locator('[name=code]').fill('123456');await page.locator('[data-code-form] button').click();
  await page.getByText('✓ بريد مؤكد:').waitFor();
  for(const width of [390,1280]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);}
  console.log('PASS: student login, missing/broken photo, visible OTP, real alpha validation, period prices, hidden drafts, optional verified email, mobile/desktop overflow');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
