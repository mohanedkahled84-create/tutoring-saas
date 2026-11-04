// Local browser journeys with a simulated payment API. No production requests or sends.
const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require('C:/Users/Dell/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const root=path.resolve(__dirname,'../apps/web');
const catalog=[{id:'basic_v1',name:'Basic',rank:1,price_piasters:24900,reference_piasters:50000,students:100,storage_bytes:2e9,assistants:2,student_piasters:200,teaching_platform:false},{id:'pro_v1',name:'Pro',rank:2,price_piasters:79900,reference_piasters:160000,students:300,storage_bytes:15e9,assistants:4,student_piasters:150,initial_gift_piasters:10000,teaching_platform:true},{id:'max_v1',name:'Max',rank:3,price_piasters:99900,reference_piasters:200000,students:500,storage_bytes:30e9,assistants:8,student_piasters:100,initial_gift_piasters:15000,renewal_gift_piasters:10000,teaching_platform:true}];
const state={commercial:{catalog,limits:{...catalog[1],plan_id:'pro_v1',active:true,is_trial:true,period_end:new Date(Date.now()+7*86400000).toISOString(),recurring_piasters:79900},students_used:11,assistants_used:1,storage_bytes_used:1048576,addons:[],orders:[],ledger:[],wallet:{paid_piasters:5000,gift_piasters:10000,held_piasters:200,message_piasters:100}}};
let calls=[],orders=new Map(),delayQuote=false;
const server=http.createServer(async(req,res)=>{
 const url=new URL(req.url,'http://127.0.0.1');
 if(url.pathname.startsWith('/api/')){
  let body='';for await(const chunk of req)body+=chunk;const data=body?JSON.parse(body):{};calls.push({path:url.pathname,data});let result={};
  if(url.pathname==='/api/billing/commercial/orders'){
   const plan=catalog.find(p=>p.id===data.plan_id)||catalog[1];
   result={id:data.id,kind:data.kind,amount_piasters:data.kind==='wallet'?data.quantity:data.kind==='storage'?5000*data.quantity:plan.price_piasters,quoted_until:new Date(Date.now()+900000).toISOString(),snapshot:{plan,addons:{}},state:'quoted'};orders.set(data.id,result);
   if(delayQuote)await new Promise(r=>setTimeout(r,150));
  }else if(url.pathname.endsWith('/submit'))result={...orders.get(url.pathname.split('/').at(-2)),state:'submitted'};
  res.writeHead(200,{'Content-Type':'application/json'});res.end(JSON.stringify(result));return;
 }
 if(url.pathname==='/__commercial-test'){
  res.writeHead(200,{'Content-Type':'text/html; charset=utf-8'});
  res.end(`<!doctype html><html lang="ar" dir="rtl"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles/tokens.css"><link rel="stylesheet" href="/src/styles/main.css"><style>body{padding:16px}.test-modal{position:fixed;inset:0;background:#0008;display:grid;place-items:center;padding:12px;z-index:99999}.test-modal>div{background:white;padding:20px;max-width:520px;width:100%;max-height:95dvh;overflow:auto}</style><body><main id="root"></main><div id="modal"></div><script>window.__CENTRLY_API_URL__=location.origin+'/api';window.fixture=${JSON.stringify(state)};</script><script type="module">import{renderBillingView,registerBillingActions}from'/src/components/BillingView.js';import{renderAnnouncementsView}from'/src/components/AnnouncementsView.js';window.centrlyApp={user:{id:'fixture-owner'},billingState:fixture,announcementsData:{wallet:fixture.commercial.wallet},showModal(title,body){document.querySelector('#modal').innerHTML='<section class="test-modal"><div role="dialog" aria-label="'+title+'">'+body+'</div></section>';},closeModal(){document.querySelector('#modal').innerHTML='';},showToast(message){this.lastToast=message;},async loadRouteData(){this.loaded=true;},navigate(route){this.route=route;}};registerBillingActions(centrlyApp);window.repaint=()=>document.querySelector('#root').innerHTML=new URLSearchParams(location.search).has('messages')?renderAnnouncementsView(centrlyApp.announcementsData,centrlyApp):renderBillingView(centrlyApp.billingState);repaint();window.ready=true;</script></body></html>`);return;
 }
 const file=path.resolve(root,'.'+decodeURIComponent(url.pathname));if(!file.startsWith(root+path.sep)||!fs.existsSync(file)){res.writeHead(404);res.end();return;}
 res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/plain'});fs.createReadStream(file).pipe(res);
});
(async()=>{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const browser=await chromium.launch({headless:true,executablePath:'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe'});const results=[];
 try{
  for(const width of [320,390,768,1440]){
   calls=[];const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.route('**/*',route=>new URL(route.request().url()).hostname==='127.0.0.1'?route.continue():route.abort());
   await page.goto(`http://127.0.0.1:${server.address().port}/__commercial-test`);await page.waitForFunction(()=>window.ready);
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,`horizontal overflow ${width}`);
   assert.equal(await page.getByText('باقتك الحالية',{exact:true}).count(),0);
   await page.locator('.commercial-plan').first().getByRole('button').click();await page.getByRole('dialog').waitFor();
   assert.equal(calls.at(-1).data.kind,'subscribe');assert.equal(calls.at(-1).data.plan_id,'basic_v1');
   await page.locator('#commercialReference').fill('fixture-transfer');await page.getByRole('button',{name:'تسجيل الدفع للمراجعة'}).click();await page.waitForFunction(()=>centrlyApp.loaded);
   assert.equal(calls.at(-1).data.reference,'fixture-transfer');assert.ok(!('amount' in calls.at(-1).data));
   await page.goto(`http://127.0.0.1:${server.address().port}/__commercial-test?messages=1`);await page.waitForFunction(()=>window.ready);
   await page.getByRole('button',{name:/المحفظة/}).click();
   await page.getByRole('button',{name:'شحن المحفظة',exact:true}).click();await page.locator('#commercialQuantity').fill('50');await page.getByRole('button',{name:'حساب التكلفة'}).click();await page.locator('#commercialProofForm').waitFor();
   assert.equal(calls.at(-1).data.quantity,5000);assert.equal(calls.at(-1).data.kind,'wallet');
   // A resumed quote clears a previous receipt; asynchronous reads cannot leak between orders.
   await page.evaluate(()=>{centrlyApp._commercialReceipt='previous-image';centrlyApp.commercialOpenOrder(centrlyApp._commercialOrder.id);});
   assert.equal(await page.evaluate(()=>centrlyApp._commercialReceipt),null);
   // A profile switch while waiting cannot open another user's checkout.
   await page.evaluate(()=>centrlyApp.closeModal());delayQuote=true;
   await page.evaluate(()=>{centrlyApp.commercialQuote({kind:'wallet',quantity:5000});centrlyApp.user={id:'another-owner'};});await page.waitForTimeout(220);delayQuote=false;
   assert.equal(await page.getByRole('dialog').count(),0);assert.deepEqual(errors,[]);
   results.push({width,overflow:false,trialPurchase:true,transferSubmission:true,walletTopup:true,receiptReset:true,actorSwitchProtected:true});await page.close();
  }
  console.log(JSON.stringify({passed:true,environment:'local simulated payment API',results},null,2));
 }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(error=>{console.error(error);process.exitCode=1;server.closeAllConnections();server.close();});
