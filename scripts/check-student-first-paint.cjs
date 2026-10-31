// Usage: PLAYWRIGHT_MODULE=<module path> CHROME_PATH=<binary> node scripts/check-student-first-paint.cjs [baseline commit]
// No screenshots or production API requests. Real HTML is rendered with delayed font/API responses.
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const {execFileSync} = require('node:child_process');
const {chromium} = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const root = path.resolve(__dirname, '..');
const baseline = process.argv[2];
if (baseline && !/^[0-9a-f]{7,40}$/.test(baseline)) throw Error('Expected a baseline commit SHA');
const types = {'.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png'};

(async () => {
  const browser = await chromium.launch({headless:true, ...(process.env.CHROME_PATH ? {executablePath:process.env.CHROME_PATH} : {})});
  const results = [];
  try {
    for (const width of [390,1440]) for (const routeName of ['login','dashboard','link']) for (const version of baseline ? ['before','after'] : ['after']) {
      const context = await browser.newContext({viewport:{width,height:900}});
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      await context.addInitScript(() => localStorage.setItem('centrly_portal_token', 'first-paint-fixture-token'));
      let release, fontRequested = false, fontApplied = false;
      const pending = new Promise(resolve => { release = resolve; });
      await context.route('**/*', async route => {
        const url = new URL(route.request().url());
        if (url.hostname === 'fonts.googleapis.com') {
          fontRequested = true;
          await pending;
          fontApplied = true;
          return route.fulfill({contentType:'text/css',body:':root { --font-response-applied: yes; }'});
        }
        if (url.pathname.startsWith('/api/')) {
          await pending;
          if (url.pathname.includes('/short-links/')) return route.fulfill({status:404,contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://teacher-test.centerly-eg.com'},body:JSON.stringify({error:{message:'رابط اختبار غير صالح'}})});
          const data = url.pathname.includes('parent-portal')
            ? {student:{id:'fixture-id',name:'طالب اختبار الظهور',student_code:'3210'},summary:{total_sessions:0,attendance_rate:'لا توجد بيانات'},materials:[],quizzes:[],sessions:[]}
            : {settings:{subdomain:'teacher-test',is_active:true,theme_preset:'emerald'}};
          return route.fulfill({contentType:'application/json',headers:{'Access-Control-Allow-Origin':'https://teacher-test.centerly-eg.com'},body:JSON.stringify(data)});
        }
        if (url.hostname !== 'teacher-test.centerly-eg.com') return route.abort();
        const entry = url.pathname === '/login' ? 'teacher-platform-sample/login.html' : url.pathname === '/dashboard' ? 'teacher-platform-sample/index.html' : url.pathname.startsWith('/s/') ? 'index.html' : null;
        if (entry) {
          const html = version === 'before'
            ? execFileSync('git',['show',baseline+':'+entry],{cwd:root,encoding:'utf8'})
            : fs.readFileSync(path.join(root,entry),'utf8');
          return route.fulfill({contentType:'text/html',body:html});
        }
        const file = path.resolve(root, '.' + url.pathname);
        if (!file.startsWith(root + path.sep)) return route.abort();
        try { return route.fulfill({contentType:types[path.extname(file)]||'application/octet-stream',body:fs.readFileSync(file)}); }
        catch { return route.fulfill({status:404,body:''}); }
      });
      await page.goto('https://teacher-test.centerly-eg.com/' + (routeName === 'link' ? 's/s12345678' : routeName), {waitUntil:'commit'});
      await page.waitForTimeout(1500);
      const early = await page.evaluate(() => ({
        fcp:performance.getEntriesByName('first-contentful-paint')[0]?.startTime || null,
        hasContent:!!document.body?.innerText.trim(),
        fontActive:document.querySelector('link[rel="stylesheet"][href*="fonts.googleapis.com"]')?.media,
      }));
      assert.equal(fontRequested,true);
      assert.equal(fontApplied,false);
      if (version === 'before') {
        assert.equal(early.fcp,null,'Baseline must reproduce the blank page while font CSS is pending');
        assert.equal(early.hasContent,false);
      } else {
        assert.ok(early.fcp > 0 && early.fcp < 1500,'The actual interface must paint without waiting for font CSS');
        assert.equal(early.hasContent,true);
        assert.equal(early.fontActive,'print');
        if (routeName === 'login') await page.locator('#formLogin input').first().fill('01234567890');
      }
      release();
      await page.waitForLoadState('domcontentloaded');
      await page.waitForFunction(() => getComputedStyle(document.documentElement).getPropertyValue('--font-response-applied').trim() === 'yes');
      if (routeName === 'dashboard') await page.waitForFunction(() => document.getElementById('sidebarStudentName')?.textContent === 'طالب اختبار الظهور');
      assert.deepEqual(errors,[]);
      results.push({width,page:routeName,version,firstPaintBeforeFontMs:early.fcp===null?null:Math.round(early.fcp),interfaceVisibleWhileFontAndApiPending:early.hasContent,fontAppliedAfterResponse:true,passed:true});
      console.log(JSON.stringify(results.at(-1)));
      await context.close();
    }
  } finally {
    await browser.close();
    if (process.env.FIRST_PAINT_RESULTS_PATH) fs.writeFileSync(process.env.FIRST_PAINT_RESULTS_PATH,JSON.stringify({scope:'Actual pages in mobile/desktop Chromium; font CSS and API deliberately held pending; baseline/current source; no production data or screenshots',baseline,results},null,2));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
