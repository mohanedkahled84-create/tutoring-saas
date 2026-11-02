// Actual entry HTML/modules with isolated API fixtures. No real accounts or messages.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),results=[];try{
 for(const width of [320,390,768,1440]){
  const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),modules=[],calls=[],errors=[];let reads=0;
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.js'))modules.push(new URL(r.url()).pathname);});
  await context.addInitScript(()=>{localStorage.setItem('centrly_portal_entry_role','parent');localStorage.setItem('centrly_token','owner-token-must-remain');});
  await context.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.pathname.startsWith('/api/')){
    calls.push(u.pathname);assert.equal(req.headers().authorization,undefined,'Student entry must not attach owner authorization');
    let data;
    if(u.pathname==='/api/public/portal/login')data={success:true,token:'fixture-student-token'};
    else if(u.pathname==='/api/public/portal/destination')data={origin:'https://centerly-eg.com',presentation:null};
    else if(u.pathname==='/api/public/parent-portal'){reads++;data={student:{id:'student-entry-test',tenant_id:'teacher-test',name:'طالب فحص الدخول',student_code:'1001'},summary:{total_sessions:0},sessions:[],materials:[],quizzes:[]};}
    else throw Error('Unexpected API '+u.pathname);
    return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://centerly-eg.com','Access-Control-Allow-Headers':'content-type','Access-Control-Allow-Methods':'GET, POST, OPTIONS'},body:JSON.stringify(data)});
   }
   if(u.hostname!=='centerly-eg.com')return route.abort();
   const file=path.resolve(root,'.'+(!path.extname(u.pathname)?'/index.html':u.pathname));if(!file.startsWith(root+path.sep))return route.abort();
   try{return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
  });
  await page.goto('https://centerly-eg.com/portal?role=student');await page.locator('#portalIdentifier').waitFor();
  assert.equal(await page.locator('#portalRole').inputValue(),'student','Explicit student entry wins over prior parent use');
  await page.locator('#portalPassword').fill('fixture-password');await page.locator('.password-toggle-btn').click();assert.equal(await page.locator('#portalPassword').getAttribute('type'),'text');await page.locator('.password-toggle-btn').click();
  await page.locator('#portalIdentifier').fill('1001');await page.locator('#portalSubmitBtn').click();await page.locator('#portalCacheStatus').waitFor();assert.ok((await page.locator('body').innerText()).includes('طالب فحص الدخول'));
  const firstReads=reads;await page.reload();await page.locator('#portalCacheStatus').waitFor();assert.equal(reads,firstReads,'Fresh snapshot avoids another account read');
  assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_token')),'owner-token-must-remain');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await page.evaluate(()=>window.centrlyApp.handlePortalLogout());await page.locator('#portalIdentifier').waitFor();assert.equal(await page.locator('#portalRole').inputValue(),'student');
  assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_portal_token')),null);assert.ok(!(await page.locator('body').innerText()).includes('طالب فحص الدخول'));
  assert.ok(!modules.some(p=>/\/(app|workspace|auth|AuthScreens|LandingView)\.js$/.test(p)));assert.ok(calls.every(p=>p.startsWith('/api/public/')));assert.deepEqual(errors,[]);
  results.push({width,lightEntry:true,login:true,cachedReload:true,logout:true,ownerSessionUnchanged:true,noOverflow:true,errors});await context.close();
 }
 if(process.env.RESULT_PATH)fs.writeFileSync(process.env.RESULT_PATH,JSON.stringify(results,null,2));console.log(JSON.stringify(results));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
