// Actual SPA; isolated fixture API and offline scenarios. No production data.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'..'), types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
(async()=>{const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})}),results=[];
try{for(const published of [false,true]){
 const origin=published?'https://teacher-test.centerly-eg.com':'https://centerly-eg.com', context=await browser.newContext({viewport:{width:390,height:844}}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(15000); page.setDefaultNavigationTimeout(15000);
 let reads=0,destinations=0,mode='ok',release;const modules=[];page.on('request',r=>{const p=new URL(r.url()).pathname;if(p.endsWith('.js'))modules.push(p);});
 
 const student={id:'parent-child-a',tenant_id:'tenant-a',name:'ابن الاختبار',student_code:'3210',teacher_name:'مدرس الاختبار',group_name:'مجموعة اختبار طويلة للتأكد من التفاف النص على الهاتف'};
 const presentation=published?{display_title:'منصة مدرس الاختبار',theme_preset:'emerald'}:null;
 const payload={student,summary:{total_sessions:4,attended_count:3,absent_count:1,attendance_rate:'75%',quiz_average_percentage:'80%'},sessions:[{session_number:1,session_date:'2026-10-31',attended:true,comment:'متابعة ممتازة'}],quizzes:[{title:'الاختبار الأول',score:8,max_score:10}],materials:[{type:'homework',title:'واجب للمراجعة',description:'PRIVATE DETAILS',submission_status:'pending',submitted_at:'2026-10-31T10:00:00Z',due_date:'2026-10-31'}]};
 page.on('pageerror',e=>errors.push(e.message));
 await context.route('**/*',async route=>{const request=route.request(),u=new URL(request.url());if(u.pathname==='/seed')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
  if(u.pathname.startsWith('/api/')){let data={},status=200;
   if(u.pathname==='/api/public/portal/login'){status=mode==='invalid-login'?401:200;data=status===401?{error:{message:'بيانات الدخول غير صحيحة'}}:{success:true,token:'parent-new-session',role:'parent'};}
   else if(u.pathname==='/api/public/portal/destination'){destinations++;data={origin,presentation,ticket:null};}
   else if(u.pathname==='/api/public/parent-portal'){reads++;if(mode==='held')await new Promise(r=>release=r);if(mode==='unauthorized'){status=401;data={error:{message:'غير صالح'}};}else if(mode==='offline'){status=503;data={error:{message:'تعذر الاتصال'}};}else data=payload;}
   return route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'},body:JSON.stringify(data)});
  }
  if(!['centerly-eg.com','teacher-test.centerly-eg.com'].includes(u.hostname))return route.abort();
  let p=u.pathname;if(!path.extname(p))p='/index.html';const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))return route.abort();
  try{return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto(origin+'/seed',{waitUntil:'domcontentloaded'});
 await page.evaluate(()=>{localStorage.clear();sessionStorage.clear();localStorage.setItem('centrly_portal_token','parent-private-token');localStorage.setItem('centrly_portal_role','parent');});
 modules.length=0;
 const url=origin+(published?'/portal-entry':'/portal');
 await page.goto(url,{waitUntil:'networkidle'});await page.locator('#pp-student').waitFor();assert.equal(reads,1);assert.ok(!await page.getByText('PRIVATE DETAILS',{exact:true}).count());
 for(const width of [320,360,390,430,768,1440]){await page.setViewportSize({width,height:844});for(const tab of ['attendance','quizzes','homework']){await page.locator('#tab-btn-'+tab).click();assert.equal(await page.locator('#tab-content-'+tab).isVisible(),true);assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'horizontal overflow '+width);}
  for(const locator of ['#parent-refresh-data-btn','.pp-nav button','button.pp-button']){for(const item of await page.locator(locator).all()){const b=await item.boundingBox();assert.ok(b.width>=44&&b.height>=44);}}
 }
 if(process.env.PARENT_QA_IMAGE && !published){await page.setViewportSize({width:390,height:844});await page.locator('#tab-btn-attendance').click();await page.screenshot({path:process.env.PARENT_QA_IMAGE,fullPage:true});}
 await page.locator('#tab-btn-homework').focus();await page.keyboard.press('ArrowRight');assert.equal(await page.locator('#tab-btn-quizzes').getAttribute('aria-selected'),'true');
 reads=0;destinations=0;await page.reload({waitUntil:'networkidle'});await page.locator('#pp-student').waitFor();assert.equal(reads,0);assert.equal(destinations,0);if(published)assert.ok((await page.locator('body').innerText()).includes('منصة مدرس الاختبار'));
 await page.evaluate(()=>{const key='centrly_portal_snapshot_v1:parent',r=JSON.parse(localStorage.getItem(key));r.savedAt-=180000;localStorage.setItem(key,JSON.stringify(r));});
 mode='held';release=null;await page.reload({waitUntil:'domcontentloaded'});await page.locator('#pp-student').waitFor();await page.waitForFunction(()=>!!document.querySelector('#pp-student'));
 const deadline=Date.now()+10000;while(!release&&Date.now()<deadline)await page.waitForTimeout(10);assert.ok(release);payload.materials=[];mode='ok';release();await page.waitForFunction(()=>!document.body.innerText.includes('واجب للمراجعة'));await page.waitForTimeout(50);
 mode='held';release=null;await page.locator('#parent-refresh-data-btn').click();await page.waitForFunction(()=>document.getElementById('parent-refresh-data-btn')?.disabled);const refreshDeadline=Date.now()+10000;while(!release&&Date.now()<refreshDeadline)await page.waitForTimeout(10);assert.ok(release);assert.equal(reads,2);mode='offline';release();await page.getByText('تعذر الاتصال؛ نعرض آخر بيانات محفوظة. جرّب التحديث.').waitFor();assert.equal(await page.locator('#pp-student').innerText(),student.name);
 mode='ok';await page.getByRole('button',{name:'خروج',exact:true}).click();
 await page.locator('#portalLoginForm').waitFor();assert.equal(await page.locator('#portalRole').inputValue(),'parent');assert.equal(await page.locator('#portalTabStudent').count(),0);assert.equal(await page.locator('#portalTabParent').count(),0);
 assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_portal_snapshot_v1:parent')),null);
 if(published)assert.equal(await page.locator('#parent-login-brand').innerText(),presentation.display_title);
 reads=0;destinations=0;await page.reload({waitUntil:'networkidle'});await page.locator('#portalLoginForm').waitFor();assert.equal(reads,0);assert.equal(destinations,0);
 if(published)assert.equal(await page.locator('#parent-login-brand').innerText(),presentation.display_title);
 await page.locator('#portalIdentifier').fill('3210');await page.locator('#portalPassword').fill('123456');
 await page.getByRole('button',{name:'إظهار أو إخفاء كلمة المرور'}).click();assert.equal(await page.locator('#portalPassword').getAttribute('type'),'text');
 mode='invalid-login';await page.locator('#portalSubmitBtn').click();await page.getByRole('alert').filter({hasText:'بيانات الدخول غير صحيحة'}).waitFor();assert.equal(await page.locator('#portalRole').inputValue(),'parent');
 mode='ok';await page.locator('#portalSubmitBtn').click();await page.locator('#pp-student').waitFor();
 assert.ok(!modules.some(p=>/\/(?:app|workspace|auth)\.js$|UnifiedPortalLoginView/.test(p)),'Parent journey must not import staff/student SPA');
 mode='unauthorized';await page.locator('#parent-refresh-data-btn').click();await page.waitForFunction(()=>!localStorage.getItem('centrly_portal_token'));assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_portal_snapshot_v1:parent')),null);
 assert.deepEqual(errors,[]);results.push({published,mobileWidths:6,warmApiReads:0,offline:true,expiredSessionCleared:true,passed:true});await context.close();
}console.log(JSON.stringify({results}));}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
