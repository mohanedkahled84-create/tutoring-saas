// Actual signup and verification UI/actions with isolated HTTP responses. No real accounts or email.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..'),origin='https://registration-fixture.centerly-eg.com';
const types={'.js':'application/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});const results=[];
 try{
  for(const width of [320,390,768])for(const verification of [false,true]){
   const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],requests=[];
   const user={id:'fixture-user',tenant_id:'fixture-tenant',role:'teacher',full_name:'مدرس التجربة',phone:'01012345678'};
   page.on('pageerror',error=>errors.push(error.message));
   await context.route('**/*',async route=>{
    const req=route.request(),url=new URL(req.url());if(url.origin!==origin)return route.abort();
    if(url.pathname.startsWith('/api/')){
     const data=req.postData()?JSON.parse(req.postData()):null;requests.push({path:url.pathname,method:req.method(),data});
     if(url.pathname==='/api/auth/signup')return route.fulfill({json:verification?{requires_verification:true}:{user,token:'fixture-token',refresh_token:'fixture-refresh'}});
     if(url.pathname==='/api/auth/verify-email')return data.code==='123456'?route.fulfill({json:{user,token:'fixture-token',refresh_token:'fixture-refresh'}}):route.fulfill({status:400,json:{error:{message:'رمز التحقق غير صحيح'}}});
     if(url.pathname==='/api/auth/me')return route.fulfill({json:{user}});
     throw Error('Unexpected request '+url.pathname);
    }
    if(url.pathname==='/harness')return route.fulfill({contentType:'text/html',body:`<!doctype html><html lang="ar" dir="rtl"><head><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/apps/web/src/styles/tokens.css"><link rel="stylesheet" href="/apps/web/src/styles/main.css"></head><body><div id="app"></div><script>window.__CENTRLY_API_URL__=location.origin+'/api';</script><script type="module">
     import {registerAuthActions} from '/apps/web/src/components/AuthScreens.js';
     const app={getAppEl:()=>document.getElementById('app'),resetTenantState(){this.students=[];this.groups=[];},restoreCachedData(){},startProactiveSessionRefresher(){this.refresherStarted=true;},startOnboarding(){throw Error('Setup must not run during registration');},renderApp(){this.getAppEl().innerHTML='<main id="completed-dashboard">لوحة التحكم</main>';},async loadRouteData(route){window.loadedRoute=route;},renderLanding(){},openPolicyModal(){}};
     registerAuthActions(app);window.centrlyApp=app;app.renderAuth('signup');
    </script></body></html>`});
    const file=path.resolve(root,'.'+url.pathname);if(!file.startsWith(root+path.sep))return route.abort();
    try{return route.fulfill({contentType:types[path.extname(file)] || 'application/octet-stream',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
   });
   await page.goto(origin+'/harness?view=signup');await page.locator('#signupName').waitFor();
   assert.equal(await page.locator('#signupSubject,#signupContactPhone,#obGroupName').count(),0);
   assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   await page.locator('#signupName').fill(user.full_name);await page.locator('#signupEmail').fill('teacher@example.test');
   await page.locator('#signupPhone').fill('٠١٠١٢٣٤٥٦٧٨');await page.locator('#signupPassword').fill('FixturePassword123');
   await page.locator('#signupPasswordConfirm').fill('FixturePassword123');await page.locator('#signupTermsConsent').check();
   await page.locator('#formSignup button[type=submit]').click();
   if(verification){
    await page.locator('#verifyOtpCode').waitFor();await page.locator('#verifyOtpCode').fill('000000');await page.locator('#btnVerifySubmit').click();
    await page.getByText('رمز التحقق غير صحيح',{exact:true}).waitFor();assert.equal(await page.locator('#completed-dashboard').count(),0);
    await page.locator('#verifyOtpCode').fill('123456');await page.locator('#btnVerifySubmit').click();
   }
   await page.locator('#completed-dashboard').waitFor();await page.waitForFunction(()=>window.loadedRoute==='dashboard');
   assert.equal(await page.locator('#obGroupName').count(),0);
   assert.equal(requests.filter(req=>req.path==='/api/auth/signup').length,1);
   const signup=requests.find(req=>req.path==='/api/auth/signup').data;
   assert.equal(signup.phone,'01012345678');assert.equal(signup.contact_phone,signup.phone);assert.equal(signup.subject,'');
   assert.ok(requests.every(req=>['/api/auth/signup','/api/auth/verify-email','/api/auth/me'].includes(req.path)));
   assert.equal(await page.evaluate(()=>sessionStorage.getItem('centrly_signup_form_data')),null);
   assert.equal(new URL(page.url()).searchParams.has('view'),false);assert.deepEqual(errors,[]);
   results.push({width,verification,dashboardDirect:true,noGroupOrStudentCreation:true,passed:true});await context.close();
  }
  console.log(JSON.stringify({results}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
