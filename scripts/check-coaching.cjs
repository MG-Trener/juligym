const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const api=process.env.API_URL,password=process.env.JULIGYM_PASSWORD,site=process.env.SITE_URL||'http://127.0.0.1:4173/';
assert(api?.includes('br-silent-lake-b99eu6ub')&&password,'Preview writes only');
let token;
async function call(route,body){const response=await fetch(new URL(route,api),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const value=await response.json();assert.equal(response.status,200,JSON.stringify(value));return value;}
(async()=>{
 const {estimateLabel}=await import(pathToFileURL(path.resolve(__dirname,'../src/workout-time.js')));
 const {today,addDays,weekStart}=await import(pathToFileURL(path.resolve(__dirname,'../src/state.js')));
 const date=addDays(weekStart(today()),2),read=()=>call(`state?from=${date}&to=${date}`);
 token=(await call('auth',{password})).token;const original=await read();
 let browser;
 try{
  await call('schedule',{weekdays:{...original.schedule.weekdays,2:'legs'},revision:original.schedule.revision});
  await call('day-exercise',{weekday:2,exerciseId:'stretch-calves',added:true});
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await context.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG='+JSON.stringify({apiUrl:api})}));
  const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
  async function enter(){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
  async function week(){await page.locator('.mobile-nav [data-view=day]').click();await page.locator(`[data-date="${date}"]`).click();}
  async function checkEstimate(){const state=await read(),plan=state.plans.find(p=>p.id===state.schedule.weekdays[2]);assert.equal(await page.locator('#day-intro .time-note').innerText(),'По плану '+estimateLabel(plan));}
  const field=(id,name)=>page.locator(`#day-lists [data-exercise="${id}"][data-dose="${name}"]`);
  await page.goto(site);await enter();await week();await checkEstimate();
  const before=await page.locator('#day-intro .time-note').innerText();
  await field('stretch-calves','seconds').fill('120');await field('stretch-calves','seconds').blur();
  await page.waitForFunction(()=>document.querySelector('[data-day-card="stretch-calves"] .day-dose-status')?.textContent==='Сохранено');
  await checkEstimate();assert.notEqual(await page.locator('#day-intro .time-note').innerText(),before);
  await field('legs01','reps').fill('20–24');await field('legs01','reps').blur();
  await page.waitForFunction(()=>document.querySelector('[data-day-card="legs01"] .day-dose-status')?.textContent==='Сохранено');await checkEstimate();
  await page.reload();await enter();await week();await checkEstimate();
  await page.locator('#day-lists [data-image=legs01]').click();assert.match(await page.locator('#image-easier-text').innerText(),/стул повыше/);
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'image dialog overflow '+width);}
  await page.locator('#image-dialog [data-close]').click();await page.setViewportSize({width:390,height:844});
  await page.locator('.mobile-nav [data-view=library]').click();
  await page.locator('[data-technique=library-core06] summary').click();assert.match(await page.locator('[data-technique=library-core06] .easier-tip').innerText(),/скользите пяткой/);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForResponse(response=>response.url().includes('/state?')&&response.status()===200);
  assert(await page.locator('[data-technique=library-core06]').evaluate(node=>node.open));
  await page.locator('[data-technique=library-chest01] summary').click();assert.equal(await page.locator('.technique[open]').count(),1);assert.match(await page.locator('[data-technique=library-chest01] .easier-tip').innerText(),/ближе к стене/);
  await page.locator('[data-technique=library-chest01]').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/package3-coaching-mobile.png',animations:'disabled'});
  await page.locator('[data-mode=stretch]').click();await page.locator('[data-technique=stretch-sphinx] summary').click();assert.match(await page.locator('[data-technique=stretch-sphinx] .easier-tip').innerText(),/локти дальше/);
  await page.locator('#stretch-grid [data-image=stretch-biceps-wall]').click();assert.match(await page.locator('#image-easier-text').innerText(),/ладонь ниже/);await page.locator('#image-dialog [data-close]').click();
  const dimensions=await page.evaluate(async()=>Promise.all(['chest01','core04','core06','stretch-sphinx','stretch-biceps-wall'].map(async id=>{const img=new Image();img.src='./media/'+id+'.webp';await img.decode();return [img.naturalWidth,img.naturalHeight];})));
  assert(dimensions.every(([width,height])=>width===1536&&height===1024));
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'stretch overflow '+width);}
  assert.deepEqual(errors,[]);console.log('PASS: estimate follows saved strength/stretch dose and reload; specific easier guidance in cards and enlarged images; one persistent disclosure; corrected images decode; 320–1440px fit; no page errors.');
 }finally{if(browser)await browser.close();const latest=await read();await call('schedule',{weekdays:original.schedule.weekdays,revision:latest.schedule.revision});}
})().catch(error=>{console.error(error);process.exitCode=1;});
