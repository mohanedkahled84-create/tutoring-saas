const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root=path.resolve(__dirname,'..');
const config=JSON.parse(fs.readFileSync(path.join(root,'apps/web/vercel.json')));
const policy=config.routes.find(r=>r.headers?.['Content-Security-Policy']).headers['Content-Security-Policy'];
const rootPolicy=JSON.parse(fs.readFileSync(path.join(root,'vercel.json'))).headers.flatMap(r=>r.headers).find(h=>h.key==='Content-Security-Policy').value;
assert.equal(policy,rootPolicy,'both deployment entry points must apply the same security policy');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROME_PATH?{executablePath:process.env.CHROME_PATH}:{})});
 try{
  for(const blocked of [true,false]){
   const context=await browser.newContext(),page=await context.newPage();
   const csp=blocked?policy.replace(/worker-src [^;]+;/,'').replaceAll(' https://challenges.cloudflare.com',''):policy;
   let scriptLoaded=false,frameLoaded=false;
   await context.route('**/*',async route=>{
    const u=new URL(route.request().url());
    if(u.hostname==='challenges.cloudflare.com'){
     if(u.pathname.endsWith('/api.js')){scriptLoaded=true;return route.fulfill({contentType:'application/javascript',body:`window.turnstile={render(host,options){const frame=document.createElement('iframe');frame.src='https://challenges.cloudflare.com/test-frame';host.append(frame);frame.onload=()=>options.callback('fixture-proof');return 'fixture';},remove(host){host.replaceChildren();}};`});}
     frameLoaded=true;return route.fulfill({contentType:'text/html',body:'<p>Security widget fixture</p>'});
    }
    if(u.hostname!=='fixture.centerly-eg.com')throw Error('Unexpected external request');
    if(u.pathname==='/')return route.fulfill({contentType:'text/html',headers:{'Content-Security-Policy':csp},body:'<!doctype html><div id="proof"></div>'});
    const file=path.resolve(root,'apps/web','.'+u.pathname);assert.ok(file.startsWith(path.join(root,'apps/web')+path.sep));
    return route.fulfill({contentType:'application/javascript',body:fs.readFileSync(file)});
   });
   await page.goto('https://fixture.centerly-eg.com/');
   const result=await page.evaluate(async()=>{
    const {preparePhoneProof}=await import('/src/utils/phoneProof.js');
    try{
     const challenge='a'.repeat(64),proof=await preparePhoneProof(async()=>({context:'bound-fixture',challengeRequired:true,challenge,difficulty:2,turnstile:{required:true,siteKey:'fixture'}}),()=>true,{turnstileHost:document.getElementById('proof')});
     const hash=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(challenge+':'+proof.nonce));
     return {ok:true,valid:[...new Uint8Array(hash)].map(v=>v.toString(16).padStart(2,'0')).join('').startsWith('00'),token:proof.turnstileToken};
    }catch(e){return {ok:false};}
   });
   if(blocked){assert.equal(result.ok,false,'old deployment policy reproduces the failure before send');assert.equal(scriptLoaded,false);}
   else{assert.deepEqual(result,{ok:true,valid:true,token:'fixture-proof'});assert.ok(scriptLoaded && frameLoaded,'security script and iframe both load under production CSP');}
   await context.close();
  }
  console.log('PASS: reproduced blocked proof with old CSP; real worker solution, security script and iframe succeed with deployment CSP. No messages sent.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
