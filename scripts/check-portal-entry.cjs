const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Dell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'..');
const types={'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.json':'application/json'};
(async()=>{const browser=await chromium.launch({executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',headless:true});const results=[];
try{for(const fast of [false,true])for(const width of [390,1440])for(const role of ['parent','student'])for(const published of [false,true]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),errors=[],calls=[];let consumed=false;
 const modules=[];page.on('request',r=>{const p=new URL(r.url()).pathname;if(p.endsWith('.js'))modules.push(p);});page.on('pageerror',e=>errors.push(e.message));const fixture={student:{id:'student-id',tenant_id:'tenant-id',name:'طالب فحص الروابط',student_code:'3210'},summary:{},materials:[],sessions:[],quizzes:[]};const token='browser-private-token',ticket='a'.repeat(43),target='https://teacher-test.centerly-eg.com';
 const presentation=published?{subdomain:'teacher-test',display_title:'منصة فحص الروابط',theme_preset:'slate'}:null;
 await context.route('**/*',async route=>{const request=route.request(),u=new URL(request.url());
  if(u.pathname.startsWith('/api/')){calls.push(u.pathname);let data={};
   if(u.pathname.includes('/short-links/'))data={token,portal_type:role,...(fast&&role==='parent'&&!published?{initial_data:fixture}:{}),...(fast?{destination:{origin:published?target:'https://centerly-eg.com',presentation,ticket:published?ticket:null}}:{})};
   else if(u.pathname==='/api/public/portal/destination')data={origin:published?target:'https://centerly-eg.com',presentation,ticket:published&&new URL(request.headers().origin).origin!==target?ticket:null};
   else if(u.pathname==='/api/public/portal/handoff'){assert.equal(new URL(request.headers().origin).origin,target);assert.equal(consumed,false);consumed=true;data={token,role,origin:target,presentation,...(fast&&role==='parent'?{initial_data:fixture}:{})};}
   else if(u.pathname==='/api/public/parent-portal')data={student:{id:'student-id',tenant_id:'tenant-id',name:'طالب فحص الروابط',code:'3210',student_code:'3210',teacher_name:'مدرس الاختبار'},summary:{total_sessions:0,attendance_rate:'لا توجد بيانات'},materials:[],quizzes:[],sessions:[]};
   else if(u.pathname.startsWith('/api/platform/public/'))data={settings:{...presentation,subject_title:'الفيزياء',is_active:published}};
   return route.fulfill({status:200,headers:{'Access-Control-Allow-Origin':request.headers().origin||'*','Access-Control-Allow-Credentials':'true','Cache-Control':'no-store','Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'content-type'},contentType:'application/json',body:JSON.stringify(data)});
  }
  if(!['centerly-eg.com','teacher-test.centerly-eg.com'].includes(u.hostname))return route.abort();
  let p=u.pathname==='/dashboard'?'/teacher-platform-sample/index.html':u.pathname;
  if(!path.extname(p))p='/index.html';
  const file=path.resolve(root,'.'+p);if(!file.startsWith(root+path.sep))return route.abort();
  try{return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)});}catch{return route.fulfill({status:404,body:''});}
 });
 await page.goto(`https://centerly-eg.com/${role==='parent'?'p/p':'s/s'}12345678`,{waitUntil:'networkidle'});
 try{await page.waitForFunction(()=>document.body.innerText.includes('طالب فحص الروابط'),null,{timeout:25000});}catch(e){console.log(JSON.stringify({width,role,published,url:page.url(),errors,calls,body:(await page.locator('body').innerText()).slice(0,2000)}));throw e;}
 assert.equal(new URL(page.url()).origin,published?target:'https://centerly-eg.com');assert.ok(!page.url().includes(token));assert.ok(!page.url().includes(ticket));
 if(published){assert.equal(consumed,true);assert.equal(new URL(page.url()).pathname,role==='student'?'/dashboard':'/portal-entry');if(role==='parent')assert.ok((await page.locator('body').innerText()).includes('منصة فحص الروابط'));}
 if(role==='parent'&&fast)assert.equal(calls.filter(p=>p==='/api/public/parent-portal').length,0,'Bundled verified parent data needs no second account request');
 if(role==='parent')assert.ok(!modules.some(p=>/\/(?:app|workspace|auth)\.js$|UnifiedPortalLoginView/.test(p)),'Parent shared links must avoid the staff/student SPA');
 if(role==='student'&&published)assert.ok(!calls.some(p=>p.includes('/quizzes/rich')),'No global quiz reads');
 assert.equal(calls.filter(p=>p === '/api/public/portal/destination').length,fast?0:1);assert.deepEqual(errors,[]);results.push({fast,width,role,published,url:page.url(),passed:true});await context.close();
}if(process.env.RESULT_PATH)fs.writeFileSync(process.env.RESULT_PATH,JSON.stringify({scope:'Actual SPA and advanced HTML; simulated APIs; two distinct HTTPS origins; external network blocked',results},null,2));console.log(JSON.stringify({passed:results.length}));
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});




