// Actual auth/callback/workspace modules with a simulated OAuth provider and API.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),results=[];try{
 for(const width of [320,390,768,1440])for(const existing of [false,true]){
  const ctx=await browser.newContext({viewport:{width,height:900}}),page=await ctx.newPage(),errors=[],calls=[];let challenge,completed=0,enabled=true;
  const user={id:'google-teacher-fixture',tenant_id:'google-workspace-fixture',role:'owner',name:'مدرس جوجل التجريبي',full_name:'مدرس جوجل التجريبي',phone:'01012345678',subject:'الفيزياء',account_type:'teacher'};
  const profile={requires_profile:!existing,email:'google-fixture@isolated.invalid',full_name:user.full_name,phone:existing?user.phone:'',subject:existing?user.subject:'',education_stages:existing?['secondary']:[],user:existing?user:null};
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.addInitScript(()=>{if(!sessionStorage.getItem('google_fixture_seeded')){sessionStorage.setItem('google_fixture_seeded','1');localStorage.setItem('centrly_cache_previous_teacher_students','PRIVATE PREVIOUS TEACHER');}});
  await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());assert.ok(!(req.headers().referer || '').includes('auth-code-fixture'),'OAuth code leaked in referrer for '+u.pathname+' from '+req.headers().referer);
   // A client navigation is intercepted again; fulfilling an HTTP redirect can
   // bypass Playwright routing for its destination and reach the real site.
   if(u.hostname==='mock-google.example')return route.fulfill({contentType:'text/html',body:"<script>location.replace('https://centerly-eg.com/auth/google/callback?code=auth-code-fixture')</script>"});
   if(u.pathname.startsWith('/api/')){
    calls.push(u.pathname);let data={};const body=()=>JSON.parse(req.postData()||'{}');
    if(u.pathname==='/api/auth/google/options')data={enabled};
    else if(u.pathname==='/api/auth/google/start'){assert.equal(req.headers().authorization,undefined);challenge=body().challenge;assert.match(challenge,/^[\w-]{43}$/);data={url:'https://mock-google.example/authorize'};}
    else if(u.pathname==='/api/auth/google/exchange'){assert.equal(req.headers().authorization,undefined);assert.equal(body().code,'auth-code-fixture');assert.equal(crypto.createHash('sha256').update(body().verifier).digest('base64url'),challenge);data={session:{access_token:'google-access-fixture-token',refresh_token:'google-refresh-fixture-token',expires_in:3600},profile};}
    else if(u.pathname==='/api/auth/google/complete'){completed++;assert.equal(req.headers().authorization,'Bearer google-access-fixture-token');const value=body();assert.equal(value.subject,'الفيزياء');assert.equal(value.phone,'01012345678');assert.deepEqual(value.education_stages,['secondary','other']);assert.equal(value.other_stage,'جامعي');assert.equal(value.terms_accepted,true);data={profile:{...profile,requires_profile:false,user}};}
    else if(u.pathname==='/api/auth/me')data={user};
    else if(u.pathname==='/api/billing/status')data={status:'active',is_paid_active:true};
    else if(u.pathname==='/api/reports/action-summary')data={date:'2026-11-02',pending_homework:0,sessions:[]};
    else if(u.pathname==='/api/groups')data={groups:[]};else if(u.pathname==='/api/students')data={students:[]};else if(u.pathname==='/api/platform/settings')data={settings:null};
    return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://centerly-eg.com','Access-Control-Allow-Headers':'content-type,authorization','Access-Control-Allow-Methods':'GET, POST, OPTIONS'},body:JSON.stringify(data)});
   }
   if(u.hostname!=='centerly-eg.com')return route.abort();
   const relative=u.pathname==='/auth/google/callback'?'/apps/web/google-callback.html':!path.extname(u.pathname)?'/index.html':u.pathname;
   const file=path.resolve(root,'.'+relative);if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',headers:u.pathname==='/auth/google/callback'?{'Referrer-Policy':'no-referrer','Cache-Control':'private, no-store'}:{},body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
  });
  await page.goto('https://centerly-eg.com/?view=login');await page.locator('#googleAuthButton').waitFor();await page.locator('#googleAuthButton').click();
  if(!existing){
   await page.locator('#googleProfileForm').waitFor();assert.equal(new URL(page.url()).search,'');assert.equal(await page.locator('[name=password]').count(),0);assert.equal(await page.evaluate(()=>document.getElementById('googleProfileForm').reportValidity()),false);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   await page.locator('#googleSubject').fill('الفيزياء');await page.locator('#googlePhone').fill('01012345678');await page.locator('[name=education_stages][value=secondary]').check();await page.locator('[name=education_stages][value=other]').check();
   assert.equal(await page.locator('#googleOtherStage').isVisible(),true);assert.equal(await page.evaluate(()=>document.getElementById('googleProfileForm').reportValidity()),false);await page.locator('#googleOtherStage').fill('جامعي');
   const [policyPage]=await Promise.all([ctx.waitForEvent('page'),page.getByRole('link',{name:'شروط الاستخدام',exact:true}).click()]);await policyPage.locator('#policyModalOverlay').waitFor();assert.ok((await policyPage.locator('#policyModalTitle').innerText()).includes('شروط'));await policyPage.keyboard.press('Escape');assert.equal(await policyPage.locator('#policyModalOverlay').isVisible(),false);await policyPage.close();
   await page.locator('[name=terms_accepted]').check();await page.locator('button[type=submit]').click();
  }
  await page.waitForURL(url=>url.origin==='https://centerly-eg.com'&&url.pathname==='/'&&!url.search);await page.waitForFunction(()=>window.centrlyApp?.workspaceReady);
  assert.equal(await page.evaluate(()=>window.centrlyApp.user.tenant_id),user.tenant_id);assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_token')),'google-access-fixture-token');
  assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_cache_previous_teacher_students')),null);assert.equal(await page.evaluate(()=>sessionStorage.getItem('centrly_google_pending_v1')),null);assert.equal(completed,existing?0:1);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.deepEqual(errors,[]);results.push({width,existing,pkceVerified:true,requiredBasics:!existing,sameWorkspace:existing,oldCacheCleared:true,noCodeReferrer:true,errors});await ctx.close();
 }
 // A disabled provider must not expose a dead Google button or block email login.
 const ctx=await browser.newContext(),page=await ctx.newPage();await ctx.route('**/*',async route=>{const u=new URL(route.request().url());if(u.pathname.startsWith('/api/'))return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://centerly-eg.com'},body:'{"enabled":false}'});if(u.hostname!=='centerly-eg.com')return route.abort();const file=path.resolve(root,'.'+(!path.extname(u.pathname)?'/index.html':u.pathname));try{return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}catch{return route.abort();}});
 await page.goto('https://centerly-eg.com/?view=login');await page.locator('#formLogin').waitFor();assert.equal(await page.locator('#googleAuthButton').isVisible(),false);await page.locator('#tabSignup').click();await page.getByRole('button',{name:'شروط وأحكام الاستخدام',exact:true}).click();await page.locator('#policyModalOverlay').waitFor();await ctx.close();
 if(process.env.RESULT_PATH)fs.writeFileSync(process.env.RESULT_PATH,JSON.stringify({results,disabledProviderHidden:true,emailLegalDialog:true,noRealProviderOrMessages:true},null,2));console.log(JSON.stringify({results,disabledProviderHidden:true,emailLegalDialog:true}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
