const assert=require('node:assert/strict');
const {randomUUID}=require('node:crypto');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const api=process.env.API_URL,password=process.env.JULIGYM_PASSWORD,site=process.env.SITE_URL||'http://127.0.0.1:4173/';
assert(api?.includes('br-silent-lake-b99eu6ub')&&password,'Only preview writes');
let token;
async function call(path,body,status=200){const r=await fetch(new URL(path,api),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const value=await r.json();assert.equal(r.status,status,JSON.stringify(value));return value;}
async function login(page){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
(async()=>{
 token=(await call('auth',{password})).token;
 const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Qyzylorda'});
 const core={date:'2001-05-01',planId:'stretch-'+randomUUID()};
 const initial=(await call('stretch-start',{...core,title:'QA stretch API',ids:['stretch-calves','stretch-sphinx']})).session;
 await call('finish',{...core,allowPartial:true},400);
 const op={...core,revision:0,action:'next',opId:randomUUID()};
 let saved=(await call('stretch-progress',op)).session;
 assert.equal(saved.stretch_state.position,1);
 assert.equal((await call('stretch-progress',op)).session.stretch_revision,1);
 await call('stretch-progress',{...core,revision:0,action:'next',opId:randomUUID()},409);
 saved=(await call('stretch-progress',{...core,revision:1,action:'skip',opId:randomUUID()})).session;
 assert.equal(saved.stretch_state.marks['stretch-calves:2'],'skipped');
 await call('finish',core,400);
 saved=(await call('finish',{...core,allowPartial:true})).session;
 assert.equal(saved.result_status,'partial');assert.equal(saved.result_summary.stretch.done,1);
 await call('stretch-progress',{...core,revision:2,action:'next',opId:randomUUID()},409);
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await ctx.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG='+JSON.stringify({apiUrl:api})}));
  const p=await ctx.newPage(),errors=[];p.on('pageerror',e=>errors.push(e.message));
  await p.goto(site);await login(p);
  assert(await p.locator('#today-view').isVisible());
  await p.setViewportSize({width:320,height:740});
  assert(await p.locator('#settings-open').isVisible());await p.locator('#settings-open').click();assert(await p.locator('#check-update').isVisible());await p.locator('#settings-dialog [data-close]').click();
  for(const from of ['today','day','history']){
   await p.locator(`.mobile-nav [data-view=${from}]`).click();await p.locator('.mobile-nav [data-view=stretch]').click();assert(await p.locator('#stretch-home').isVisible());assert.equal(await p.locator('.mobile-nav [data-view=stretch]').getAttribute('aria-current'),'page');
   await p.locator('.mobile-nav [data-view=library]').click();assert(await p.locator('#library-view').isVisible());
  }
  await p.locator('.mobile-nav [data-view=stretch]').click();
  await p.locator('[data-stretch-add=stretch-calves]').click();await p.locator('[data-stretch-add=stretch-sphinx]').click();await p.locator('[data-stretch-custom]').click();
  await p.waitForSelector('[data-stretch-next]');assert.match(await p.locator('#stretch-guided h2').innerText(),/левая/);
  await p.locator('[data-stretch-next]').click();await p.waitForFunction(()=>document.querySelector('#stretch-guided h2')?.textContent.includes('правая'));
  await p.locator('[data-stretch-hold]').click();await p.waitForTimeout(1200);
  await p.reload();await login(p);
  await p.locator('.mobile-nav [data-view=stretch]').click();await p.locator('[data-stretch-resume]').click();
  assert.match(await p.locator('#stretch-guided h2').innerText(),/правая/);assert.match(await p.locator('.timer-description').innerText(),/паузе/);
  const remaining=await p.locator('[data-time]').innerText();await p.waitForTimeout(1100);assert.equal(await p.locator('[data-time]').innerText(),remaining);
  await p.route('**/stretch-progress',r=>r.fulfill({status:503,json:{error:'QA failure'},headers:{'Access-Control-Allow-Origin':'*'}}));
  await p.locator('[data-stretch-next]').click();await p.waitForSelector('.toast.error');assert.match(await p.locator('#stretch-guided h2').innerText(),/правая/);await p.unroute('**/stretch-progress');
  await p.locator('[data-stretch-next]').click();await p.waitForFunction(()=>document.querySelector('#stretch-guided h2')?.textContent.includes('Движение 2'));
  await p.locator('[data-stretch-skip]').click();await p.waitForSelector('.stretch-complete');assert.match(await p.locator('.stretch-complete').innerText(),/Выполнено шагов: 2 из 3/);
  await p.locator('[data-stretch-finish]').click();await p.waitForSelector('#today-view:not([hidden])');
  const state=await call(`state?from=${date}&to=${date}`);const stretch=state.sessions.find(s=>s.title==='Моя подборка'&&s.result_status==='partial');assert(stretch);assert.equal(stretch.result_summary.stretch.done,2);
  const plan=(await call('plans',{title:'QA first package '+Date.now(),items:[{id:'back01',sets:2},{id:'core06',sets:1}]},201)).plan;
  await call('start',{date,planId:plan.id});
  await p.reload();await login(p);await p.locator(`#today-content [data-today-start][data-workout-plan="${plan.id}"]`).click();
  await p.waitForSelector('#guided-mark[data-guided-set="back01:0:1"]');await p.locator('#guided-mark').click();await p.waitForSelector('#guided-mark[data-guided-set="back01:0:2"]');assert.equal(await p.locator('#timer').isVisible(),false);
  await p.reload();await login(p);await p.locator(`#today-content [data-today-start][data-workout-plan="${plan.id}"]`).click();await p.waitForSelector('#guided-mark[data-guided-set="back01:0:2"]');
  await p.locator('#guided-mark').click();await p.waitForSelector('#guided-mark[data-guided-set="back01:1:1"]');
  await p.locator('#guided-content .finish-choice summary').click();await p.locator('#guided-content [data-finish-partial]').click();await p.waitForSelector('.flow-finished');assert.match(await p.locator('.flow-finished').innerText(),/Частично/);
  const final=(await call(`state?from=${date}&to=${date}`)).sessions.find(s=>s.plan_id===plan.id);assert.equal(final.result_status,'partial');assert.equal(final.result_summary.strength.done,1);
  await p.locator('.mobile-nav [data-view=history]').click();assert.match(await p.locator(`[data-history-plan="${plan.id}"]`).innerText(),/Частично/);
  assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  await p.screenshot({path:'artifacts/package1-history-320.png',fullPage:false});assert.deepEqual(errors,[]);
  console.log('PASS: preview API idempotency, revision conflicts, skipped sides, partial results; 320px settings, stable navigation, stretch reload/timer pause/failure retry, strength side resume and partial history.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
