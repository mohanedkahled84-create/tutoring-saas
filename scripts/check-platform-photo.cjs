const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  const page=await browser.newPage();let release,apiWait=new Promise(r=>release=r);
  await page.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.pathname.includes('/api/platform/public/')){await apiWait;return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'*'},body:JSON.stringify({settings:{subdomain:'fixture',display_title:'مدرس الاختبار',theme_preset:'navy'}})});}
   if(u.hostname!=='fixture.centerly-eg.com')return route.abort();
   if(u.pathname==='/blank')return route.fulfill({contentType:'text/html',body:'<!doctype html><body></body>'});
   const file=path.resolve(root,'.'+u.pathname);assert.ok(file.startsWith(root+path.sep));
   return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':'text/html',body:fs.readFileSync(file)});
  });
  await page.goto('https://fixture.centerly-eg.com/apps/web/teacher-platform-sample/login.html',{waitUntil:'domcontentloaded'});
  assert.equal(await page.locator('#platformLoading').isVisible(),true);
  assert.equal(await page.locator('.hero-container').isVisible(),false,'default page never flashes before settings');
  release();await page.waitForFunction(()=>!document.documentElement.classList.contains('platform-loading'));
  assert.equal(await page.locator('.brand-meta h2').textContent(),'مدرس الاختبار');assert.equal(await page.locator('#formLogin').isVisible(),true);
  const photo=await page.evaluate(async()=>{
   const c=document.createElement('canvas');c.width=c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='white';ctx.fillRect(0,0,100,100);const opaque=c.toDataURL();
   await applySettingsToDOM({cutout_avatar_url:opaque});const rejected=getComputedStyle(document.querySelector('.popout-stage')).display==='none';
   ctx.clearRect(0,0,20,100);const valid=c.toDataURL();await applySettingsToDOM({cutout_avatar_url:valid});
   return {rejected,accepted:!document.querySelector('.popout-stage').hidden,opaque};
  });assert.equal(photo.rejected,true);assert.equal(photo.accepted,true);
  await page.goto('https://fixture.centerly-eg.com/blank');
  const save=await page.evaluate(async opaque=>{
   const {registerTeacherPlatformActions}=await import('/apps/web/src/components/TeacherPlatformBuilderView.js');
   document.body.innerHTML='<input id="builderSubdomainInput" value="fixture"><input id="builderCutoutInput">';document.getElementById('builderCutoutInput').value=opaque;
   let message='';registerTeacherPlatformActions({platformBuilderState:{settings:{cutout_avatar_url:opaque}},showToast:text=>{message=text;}});
   await window.teacherPlatformActions.savePlatformSettings();return message;
  },photo.opaque);assert.match(save,/خلفية/,'saving the same existing opaque image must still reject it');
  const semi=await page.evaluate(async()=>{
   const {prepareTeacherCutout}=await import('/apps/web/src/utils/teacherCutout.js');const c=document.createElement('canvas');c.width=c.height=100;const ctx=c.getContext('2d');ctx.fillStyle='rgba(255,255,255,.95)';ctx.fillRect(0,0,100,100);try{await prepareTeacherCutout(c.toDataURL());return false;}catch{return true;}
  });assert.equal(semi,true,'a nearly opaque background is not a cutout');
  console.log('PASS: no default-content flash, opaque saved photos hidden, transparent photo displayed, unchanged opaque save rejected, nearly opaque background rejected.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
