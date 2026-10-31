// Actual portal HTML and JavaScript, isolated fixture API. No production data or screenshots.
// Set PLAYWRIGHT_MODULE and CHROME_PATH as for the other browser checks.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),results=[];
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'};
const data=(name,updated=false)=>({student:{id:name.includes('ب')?'student-b':'student-a',tenant_id:'tenant-a',name,student_code:'3210',teacher_name:'مدرس الاختبار'},summary:{total_sessions:1,attendance_rate:'82%'},materials:updated?[]:[{id:'homework-a',type:'homework',title:'واجب الحركة المحفوظ',submission_status:'unsubmitted'}],quizzes:[],sessions:[]});
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try {
  // A slow/failed module download must not leave /portal as an empty document.
  const bootContext=await browser.newContext({viewport:{width:390,height:844}}),bootPage=await bootContext.newPage();
  await bootContext.route('**/*',async route=>{
   const u=new URL(route.request().url());
   if(u.hostname!=='centerly-eg.com'||u.pathname.endsWith('.js'))return route.abort();
   const file=path.resolve(root,u.pathname==='/portal'?'index.html':'.'+u.pathname);
   if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}catch{return route.abort();}
  });
  await bootPage.goto('https://centerly-eg.com/portal',{waitUntil:'domcontentloaded'});
  await bootPage.locator('#centrlyInitialSplash').waitFor();
  assert.ok((await bootPage.locator('body').innerText()).includes('جارِ فتح المتابعة'));
  await bootPage.locator('#centrlyInitialSplash button').waitFor({state:'visible',timeout:12000});
  results.push({stage:'portal remains visible and offers retry when modules fail',passed:true});console.log(JSON.stringify(results.at(-1)));
  await bootContext.close();
  for(const advanced of [true,false]){
  const origin=advanced?'https://teacher-test.centerly-eg.com':'https://centerly-eg.com';
  const context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
  let calls=[],mode='ok',current=data('طالب الاختبار أ'),held=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.route('**/*',async route=>{
   const request=route.request(),u=new URL(request.url());
   if(u.pathname.startsWith('/api/')){
    calls.push(u.pathname);let body={},status=200;
    if(mode==='offline')return route.fulfill({status:503,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true'},body:JSON.stringify({error:{message:'تعذر الاتصال'}})});
    if(u.pathname==='/api/public/portal/destination')body={origin,presentation:null,ticket:null};
    else if(u.pathname==='/api/public/parent-portal'){
     if(mode==='held')await new Promise(resolve=>held.push(resolve));
     if(mode==='offline'){status=503;body={error:{message:'تعذر الاتصال'}};}
     else if(mode==='unauthorized'){status=401;body={error:{message:'رابط غير صالح'}};}
     else body=current;
    }else if(u.pathname.startsWith('/api/platform/public/'))body={settings:{subdomain:'teacher-test',is_active:true,display_title:'منصة الاختبار',theme_preset:'slate'}};
    return route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type'},body:JSON.stringify(body)});
   }
   if(!['teacher-test.centerly-eg.com','centerly-eg.com'].includes(u.hostname))return route.abort();
   let p=u.pathname==='/dashboard'?'/teacher-platform-sample/index.html':u.pathname==='/login'?'/teacher-platform-sample/login.html':u.pathname;
   if(!path.extname(p))p='/index.html';
   const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
  });
  await page.goto(origin+'/seed',{waitUntil:'domcontentloaded'});
  await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('centrly_portal_token','session-a');localStorage.setItem('centrly_portal_role','student');});
  const url=origin+(advanced?'/dashboard':'/portal'),marker=advanced?'#portalSyncStatus':'#portalCacheStatus';
  const record=stage=>{results.push({advanced,stage,passed:true,portalReads:calls.filter(p=>p==='/api/public/parent-portal').length});console.log(JSON.stringify(results.at(-1)));};
  async function waitHeld(){const end=Date.now()+10000;while(!held.length&&Date.now()<end)await page.waitForTimeout(10);assert.ok(held.length,'Expected a background API request');}
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await page.locator(marker).waitFor();
  assert.ok((await page.locator('body').innerText()).includes('طالب الاختبار أ'));
  assert.ok(await page.evaluate(()=>!!localStorage.getItem('centrly_portal_snapshot_v1:student')));record('cold verified response saved');
  if(advanced)await page.waitForFunction(()=>!!localStorage.getItem('centrly_platform_settings_saved_at'));
  const snapshotA=await page.evaluate(()=>localStorage.getItem('centrly_portal_snapshot_v1:student'));
  calls=[];mode='offline';const started=Date.now();
  await page.reload({waitUntil:'domcontentloaded'});await page.locator(marker).waitFor();
  assert.ok((await page.locator('body').innerText()).includes('طالب الاختبار أ'));
  await page.waitForTimeout(250);assert.deepEqual(calls,[],'Fresh reopen must not make any API request');
  if(advanced){assert.equal(await page.locator('#studentRankCard').isVisible(),false);assert.ok(!(await page.locator('body').innerText()).includes('غير محسوب'));}
  record('warm reopen from cache with zero API calls');results.at(-1).renderMs=Date.now()-started;
  async function age(){await page.evaluate(()=>{const k='centrly_portal_snapshot_v1:student',r=JSON.parse(localStorage.getItem(k));r.savedAt=Date.now()-180001;localStorage.setItem(k,JSON.stringify(r));});}
  calls=[];await age();mode='held';current=data('طالب الاختبار أ المحدث',true);
  await page.reload({waitUntil:'domcontentloaded'});await page.locator(marker).waitFor();
  assert.ok((await page.locator('body').textContent()).includes('واجب الحركة المحفوظ'));
  await waitHeld();
  held.splice(0).forEach(resolve=>resolve());mode='ok';
  await page.waitForFunction(()=>document.body.innerText.includes('طالب الاختبار أ المحدث'));
  assert.ok(!(await page.locator('body').textContent()).includes('واجب الحركة المحفوظ'));
  assert.equal(calls.filter(p=>p==='/api/public/parent-portal').length,1);record('stale content visible while refreshing; deletion applied');
  calls=[];await age();mode='offline';
  await page.reload({waitUntil:'domcontentloaded'});await page.locator(marker).waitFor();
  await page.waitForFunction(()=>document.body.innerText.includes('تعذر التحديث'));
  assert.ok((await page.locator('body').innerText()).includes('طالب الاختبار أ المحدث'));record('offline keeps saved account visible');
  calls=[];mode='ok';current=data('طالب الاختبار أ بعد التحديث اليدوي',true);
  await page.locator(marker+' button').click();await page.waitForFunction(()=>document.body.innerText.includes('بعد التحديث اليدوي'));
  assert.equal(calls.filter(p=>p==='/api/public/parent-portal').length,1);record('manual refresh bypasses freshness');
  calls=[];await age();mode='unauthorized';
  await page.reload({waitUntil:'domcontentloaded'});
  await page.waitForFunction(()=>!localStorage.getItem('centrly_portal_snapshot_v1:student'));
  if(advanced)await page.waitForURL(origin+'/login');
  else await page.waitForFunction(()=>document.getElementById('portalRole'));
  assert.ok(!(await page.locator('body').innerText()).includes('طالب الاختبار أ'));record('unauthorized clears snapshot and private view');
  await page.evaluate(snapshot=>{localStorage.setItem('centrly_portal_snapshot_v1:student',snapshot);localStorage.setItem('centrly_portal_token','session-b');localStorage.setItem('centrly_portal_role','student');},snapshotA);
  mode='held';current=data('طالب الاختبار ب',true);calls=[];
  await page.goto(url,{waitUntil:'domcontentloaded'});
  await waitHeld();
  assert.ok(!(await page.locator('body').innerText()).includes('طالب الاختبار أ'));
  held.splice(0).forEach(resolve=>resolve());mode='ok';
  await page.waitForFunction(()=>document.body.innerText.includes('طالب الاختبار ب'));record('account switch does not show previous account');
  if(advanced){await page.evaluate(()=>logoutStudent());await page.waitForURL(url=>url.origin===origin&&url.pathname==='/login');}
  else await page.evaluate(()=>window.centrlyApp.handlePortalLogout());
  assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_portal_snapshot_v1:student')),null);record('logout removes snapshot');
  assert.deepEqual(errors,[]);await context.close();
 }}finally{await browser.close();if(process.env.PORTAL_CACHE_RESULTS_PATH)fs.writeFileSync(process.env.PORTAL_CACHE_RESULTS_PATH,JSON.stringify({scope:'Actual HTML and modules, fixture API including offline/held/401 responses, mobile viewport; no production data or screenshots',results},null,2));}
})().catch(e=>{console.error(e);process.exitCode=1;});
