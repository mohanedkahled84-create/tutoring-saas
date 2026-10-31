// Uses the same PLAYWRIGHT_MODULE / CHROME_PATH environment as check-student-first-paint.cjs.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {for(const status of [401,503,200]){
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),documents=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.isNavigationRequest())documents.push(new URL(r.url()).pathname);});
  await context.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.pathname.startsWith('/api/')){
    let responseStatus=200,data={settings:{is_active:true,subdomain:'teacher-test'}};
    if(url.pathname==='/api/public/portal/login'){
     responseStatus=status;
     data=status===200?{success:true,token:'verified-login-token',student:{name:'طالب اختبار الدخول',student_code:'3210'}}:{error:{message:'تعذر تسجيل الدخول للاختبار'}};
    }else if(url.pathname==='/api/public/parent-portal')data={student:{id:'fixture-id',name:'طالب اختبار الدخول',student_code:'3210'},summary:{total_sessions:0,attendance_rate:'لا توجد بيانات'},materials:[],quizzes:[],sessions:[]};
    return route.fulfill({status:responseStatus,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://teacher-test.centerly-eg.com','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type'},body:JSON.stringify(data)});
   }
   if(url.hostname!=='teacher-test.centerly-eg.com')return route.abort();
   const file=path.resolve(root,url.pathname==='/login'?'teacher-platform-sample/login.html':url.pathname==='/dashboard'?'teacher-platform-sample/index.html':'.'+url.pathname);
   if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:file.endsWith('.js')?'application/javascript':'text/html',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
  });
  await page.goto('https://teacher-test.centerly-eg.com/login',{waitUntil:'domcontentloaded'});
  await page.locator('#formLogin input').nth(0).fill('3210');
  await page.locator('#formLogin input').nth(1).fill('123456');
  await page.locator('#formLogin button[type="submit"]').click();
  if(status===200){
   await page.waitForURL('https://teacher-test.centerly-eg.com/dashboard');
   await page.waitForFunction(()=>document.getElementById('sidebarStudentName')?.textContent==='طالب اختبار الدخول');
   assert.deepEqual(documents,['/login','/dashboard']);
   const session=await page.evaluate(()=>[localStorage.getItem('centrly_portal_token'),sessionStorage.getItem('centrly_portal_token'),localStorage.getItem('centrly_portal_role')]);
   assert.deepEqual(session,['verified-login-token','verified-login-token','student']);
  }else{
   await page.waitForFunction(()=>document.body.innerText.includes('تعذر تسجيل الدخول للاختبار'));
   assert.equal(page.url(),'https://teacher-test.centerly-eg.com/login');
   assert.deepEqual(documents,['/login']);
   assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_portal_token')),null);
   assert.equal(await page.locator('#formLogin button[type="submit"]').isEnabled(),true);
  }
  assert.deepEqual(errors,[]);console.log(JSON.stringify({status,passed:true,documentLoads:documents.length}));
  await context.close();
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
