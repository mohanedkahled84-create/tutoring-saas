// Actual parent browser entry. All API responses are isolated fixtures; no real messages.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..'),types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml'};
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 const results=[];
 try{
  for(const width of [320,390,768]){
   const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage(),errors=[],modules=[];
   const origin='https://centerly-eg.com',target='https://family-teacher.centerly-eg.com',token='a'.repeat(43),derived='b'.repeat(43),ticket='c'.repeat(43);
   const students=[{id:'child-a',tenant_id:'tenant-a',name:'أحمد',teacher_name:'المعلم الأول',student_code:'1001'},{id:'child-b',tenant_id:'tenant-a',name:'منى',teacher_name:'المعلم الأول',student_code:'1002'},{id:'child-c',tenant_id:'tenant-b',name:'أحمد',teacher_name:'المعلم الثاني',student_code:'2001'}];
   let mode='ok',reads=0,revoked=false,release,held=false,lastSelection='child-a',directory=students;
   const expires_at=new Date(Date.now()+86400000).toISOString();
   const payload=(id)=>({students:directory,selected_id:id,expires_at,presentation:id==='child-c'?{display_title:'منصة المعلم الثاني',theme_preset:'emerald'}:null,initial_data:{student:students.find(s=>s.id===id),summary:{total_sessions:2,attended_count:1,absent_count:1,attendance_rate:'50%'},sessions:[],quizzes:[],materials:[{type:'homework',title:'واجب متابعة',submission_status:'pending',submitted_at:'2026-10-31T10:00:00Z',due_date:'2026-10-31'}]}});
   page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(new URL(r.url()).pathname.endsWith('.js'))modules.push(new URL(r.url()).pathname);});
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url()),requestOrigin=req.headers().origin || origin;
    if(u.pathname==='/seed')return route.fulfill({contentType:'text/html',body:'<!doctype html><html><body></body></html>'});
    if(u.pathname.startsWith('/api/')){
     let status=200,data={};const body=new URLSearchParams(req.postData() || '');
     if(u.pathname==='/api/public/family/login'){
      if(body.get('password')!=='999888777666'){status=401;data={error:{message:'راجع رقم ولي الأمر وكلمة مرور الأسرة'}};}
      else{revoked=false;data={family_token:token,expires_at};}
     }else if(u.pathname==='/api/public/family/account'){
      reads++;if(mode==='held'){held=true;await new Promise(r=>release=r);}
      if(mode==='unauthorized' || revoked){status=401;data={error:{message:'انتهت جلسة حساب الأسرة'}};}
      else if(mode==='offline'){status=503;data={error:{message:'تعذر الاتصال'}};}
      else{
       const id=body.get('student_id') || directory[0]?.id;
       if(id && !directory.some(s=>s.id===id)){status=403;data={error:{message:'المتابعة غير مرتبطة'}};}
       else if(id==='child-c' && requestOrigin===origin)data={students:directory,selected_id:id,expires_at,destination:{origin:target,ticket}};
       else if(id!=='child-c' && requestOrigin===target)data={students:directory,selected_id:id,expires_at,destination:{origin,ticket}};
       else{data=payload(id);lastSelection=id;}
      }
     }else if(u.pathname==='/api/public/family/handoff'){
      assert.equal(body.get('ticket'),ticket);data={family_token:derived,...payload(requestOrigin===target?'child-c':'child-a')};
     }else if(u.pathname==='/api/public/family/logout'){revoked=true;data={success:true};}
     else if(u.pathname.startsWith('/api/platform/public/'))data={platform:{display_title:'منصة المعلم الثاني'}};
     else throw Error('Unexpected API request '+u.pathname);
     return route.fulfill({status,contentType:'application/json',headers:{'Access-Control-Allow-Origin':requestOrigin,'Access-Control-Allow-Credentials':'true','Access-Control-Allow-Methods':'GET,POST,OPTIONS','Access-Control-Allow-Headers':'content-type'},body:JSON.stringify(data)});
    }
    if(![new URL(origin).hostname,new URL(target).hostname].includes(u.hostname))return route.abort();
    let filename=u.pathname;if(!path.extname(filename))filename='/index.html';const file=path.resolve(root,'.'+filename);if(!file.startsWith(root+path.sep))return route.abort();
    try{return route.fulfill({contentType:types[path.extname(file)] || 'application/octet-stream',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
   });
   await page.goto(origin+'/seed');await page.evaluate(()=>{localStorage.setItem('centrly_portal_token','old-student-session');localStorage.setItem('centrly_portal_role','student');});
   await page.goto(origin+'/portal?role=parent&family=1');await page.locator('#portalLoginForm').waitFor();
   assert.equal(await page.locator('#portalSubmitBtn').innerText(),'دخول حساب الأسرة');
   await page.locator('#portalIdentifier').fill('01012345678');await page.locator('#portalPassword').fill('111111');await page.locator('#portalSubmitBtn').click();
   await page.getByRole('alert').filter({hasText:'راجع رقم ولي الأمر'}).waitFor();
   await page.locator('#portalPassword').fill('999888777666');await page.locator('#portalSubmitBtn').click();await page.locator('#family-child').waitFor();
   assert.equal(await page.locator('#pp-student').innerText(),'أحمد');assert.equal(await page.locator('#family-teacher option').count(),2);assert.equal(await page.locator('#family-child option').count(),2);assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_portal_token')),null);
   assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth),true);
   assert.ok((await page.locator('#family-child').boundingBox()).height>=48);
   const before=reads;assert.equal(await page.evaluate(()=>window.centrlyApp.selectFamilyStudent('foreign-child')),false);assert.equal(reads,before);
   await page.locator('#family-child').selectOption('child-b');await page.waitForFunction(()=>document.getElementById('pp-student')?.textContent==='منى');assert.equal(await page.locator('#family-teacher').count(),0);
   // Saved own data paints while a validation is held; late responses cannot restore logout data.
   mode='held';await page.reload({waitUntil:'domcontentloaded'});await page.locator('#pp-student').waitFor();assert.equal(await page.locator('#pp-student').innerText(),'منى');
   await page.waitForFunction(()=>window.centrlyApp?._familyData?.selected_id==='child-b');while(!held)await page.waitForTimeout(20);
   mode='offline';release();await page.getByText('تعذر الاتصال؛ نعرض آخر بيانات محفوظة. جرّب التحديث.').waitFor();
   mode='ok';await page.locator('#family-child').selectOption('child-a');await page.locator('#family-teacher').waitFor();
   await page.locator('#family-teacher').selectOption('child-c');await page.waitForURL(target+'/portal-entry');await page.locator('#pp-student').waitFor();
   assert.equal(await page.locator('.pp-brand').innerText().then(t=>t.includes('منصة المعلم الثاني')),true);assert.equal(await page.evaluate(()=>location.hash),'');
   assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_family_token_v1')),derived);
   await page.getByRole('button',{name:'خروج',exact:true}).click();await page.locator('#portalLoginForm').waitFor();
   assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_family_snapshot_v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_family_token_v1')),null);
   await page.goto(origin+'/portal?role=parent&family=1');await page.locator('#portalLoginForm').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_family_snapshot_v1')),null);
   // A fresh login also works for one child/teacher without decorative selectors.
   directory=[students[0]];mode='ok';await page.locator('#portalIdentifier').fill('01012345678');await page.locator('#portalPassword').fill('999888777666');await page.locator('#portalSubmitBtn').click();await page.locator('#pp-student').waitFor();assert.equal(await page.locator('.pp-family select').count(),0);
   mode='held';held=false;await page.locator('#parent-refresh-data-btn').click();while(!held)await page.waitForTimeout(20);
   await page.getByRole('button',{name:'خروج',exact:true}).click();await page.locator('#portalLoginForm').waitFor();mode='ok';release();await page.waitForTimeout(50);
   assert.equal(await page.locator('#pp-student').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_family_snapshot_v1')),null);
   await page.locator('#portalIdentifier').fill('01012345678');await page.locator('#portalPassword').fill('999888777666');await page.locator('#portalSubmitBtn').click();await page.locator('#pp-student').waitFor();
   mode='unauthorized';await page.locator('#parent-refresh-data-btn').click();await page.locator('#portalLoginForm').waitFor();assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_family_snapshot_v1')),null);
   mode='ok';await page.locator('#portalIdentifier').fill('01012345678');await page.locator('#portalPassword').fill('999888777666');await page.locator('#portalSubmitBtn').click();await page.locator('#pp-student').waitFor();
   await page.evaluate(async()=>{const {savePortalSession}=await import('/apps/web/src/utils/portalSession.js');savePortalSession('other-student-session','student');});
   assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_family_token_v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('centrly_family_snapshot_v1')),null);
   await page.goto(origin+'/portal?role=parent&family=1');await page.locator('#portalLoginForm').waitFor();assert.equal(await page.locator('#pp-student').count(),0);
   assert.ok(!modules.some(p=>/\/(?:app|workspace|auth)\.js$|UnifiedPortalLoginView/.test(p)));assert.deepEqual(errors,[]);
   results.push({width,conditionalSelectors:true,cacheBeforeNetwork:true,crossOriginBranding:true,logoutAnd401Clear:true,passed:true});await context.close();
  }
  console.log(JSON.stringify({results}));
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
