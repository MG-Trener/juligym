const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const password=process.env.JULIGYM_PASSWORD,api=process.env.API_URL,site=process.env.SITE_URL||'http://127.0.0.1:4173/';
assert(password&&api?.includes('br-silent-lake-b99eu6ub'),'Writes must use the preview API and an explicit password');
let token;
async function call(path,body,status=200){
 const response=await fetch(new URL(path,api),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});
 const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;
}
const read=date=>call(`state?from=${date}&to=${date}`);
const dose=(exerciseId,field,value,status=200)=>call('day-settings',{weekday:5,exerciseId,field,value},status);
const edit=(exerciseId,added)=>call('day-exercise',{weekday:5,exerciseId,added});
const day=date=>new Date(date+'T12:00:00Z');
const add=(date,n)=>new Date(day(date).valueOf()+n*86400000).toISOString().slice(0,10);
(async()=>{
 token=(await call('auth',{password})).token;
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Qyzylorda'});
 let date=add(today,-((day(today).getUTCDay()+1)%7)-7);
 for(let n=0;n<30;n++){
  if(!(await read(date)).sessions.some(s=>s.plan_id==='weekday-5'))break;
  date=add(date,-7);
 }
 const original=await read(date),template=original.plans.find(p=>p.id==='legs');
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  await call('schedule',{weekdays:{...original.schedule.weekdays,5:'legs',6:'legs'},revision:original.schedule.revision});
  await Promise.all([dose('legs01','sets',4),dose('legs01','reps','14')]);
  let state=await read(date),plan=state.plans.find(p=>p.id==='weekday-5');
  assert.equal(plan.items[0].sets,4);assert.equal(plan.items[0].reps,'14');
  assert.deepEqual(state.plans.find(p=>p.id==='legs'),template);
  assert.equal(state.schedule.weekdays[6],'legs');
  await dose('legs01','sets',0,400);await dose('legs01','reps','15-8',400);
  await dose('stretch-sphinx','seconds',35,409);
  await edit('stretch-sphinx',true);await edit('stretch-cat-cow',true);
  await dose('stretch-sphinx','seconds',35);await dose('stretch-cat-cow','repetitions',8);
  await dose('stretch-cat-cow','seconds',35,400);

  const context=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
  await context.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG='+JSON.stringify({apiUrl:api})}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function enter(){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
  async function selectDate(){
   await page.locator('.mobile-nav [data-view=day]').click();
   for(let i=0;i<32&&!await page.locator(`[data-date="${date}"]`).count();i++){
    const first=await page.locator('#week-days button').first().getAttribute('data-date');
    await page.locator('[data-week="-1"]').click();
    await page.waitForFunction(old=>document.querySelector('#week-days button').dataset.date!==old,first);
   }
   await page.locator(`[data-date="${date}"]`).click();
  }
  const field=(id,name)=>page.locator(`#day-lists [data-exercise="${id}"][data-dose="${name}"]`);
  const card=id=>page.locator(`#day-lists [data-day-card="${id}"]`);
  const saved=id=>page.waitForFunction(id=>document.querySelector(`#day-lists [data-day-card="${id}"] .day-dose-status`)?.textContent==='Сохранено',id);
  await page.goto(site);await enter();await selectDate();
  assert.equal(await field('legs01','sets').inputValue(),'4');
  assert.equal(await field('stretch-sphinx','seconds').inputValue(),'35');
  assert.equal(await field('stretch-cat-cow','repetitions').inputValue(),'8');
  let requests=0;
  await page.route('**/day-settings',async route=>{if(++requests===1)await new Promise(resolve=>setTimeout(resolve,900));await route.continue();});
  await field('legs01','sets').selectOption('3');
  await field('legs01','reps').fill('16');
  await page.waitForTimeout(500);
  await field('legs01','reps').fill('18');
  await saved('legs01');
  assert.equal(await field('legs01','reps').inputValue(),'18');
  assert.equal(await page.evaluate(()=>document.activeElement?.dataset.dose),'reps','Autosave keeps focus');
  await page.unroute('**/day-settings');
  await field('stretch-sphinx','seconds').fill('45');
  await page.locator('#week-days button').nth(6).click();
  await page.waitForTimeout(1200);
  assert.equal(await field('legs01','sets').inputValue(),String(template.items[0].sets),'Sunday keeps template values');
  assert.equal(await page.locator('dialog[open]').count(),0);
  await page.reload();await enter();await selectDate();
  assert.equal(await field('legs01','sets').inputValue(),'3');assert.equal(await field('legs01','reps').inputValue(),'18');
  assert.equal(await field('stretch-sphinx','seconds').inputValue(),'45');

  await page.route('**/day-settings',route=>route.fulfill({status:503,json:{error:'Тест: нет связи'},headers:{'Access-Control-Allow-Origin':'*'}}));
  await field('stretch-sphinx','seconds').fill('55');
  await page.waitForFunction(()=>document.querySelector('[data-day-card="stretch-sphinx"] .day-dose-status')?.textContent.includes('Не сохранено'));
  assert.equal(await field('stretch-sphinx','seconds').inputValue(),'55');
  await page.unroute('**/day-settings');await page.locator('[data-dose-retry="stretch-sphinx"]').click();await saved('stretch-sphinx');
  await field('stretch-sphinx','seconds').fill('0');
  assert.equal(await field('stretch-sphinx','seconds').getAttribute('aria-invalid'),'true');
  await page.locator('[data-dose-reset="stretch-sphinx"]').click();
  assert.equal(await field('stretch-sphinx','seconds').inputValue(),'55');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:844});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);}
  await page.setViewportSize({width:390,height:844});await card('legs01').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/day-settings-mobile.png'});

  await page.locator('[data-day-stretch-preview]').click();
  assert.match(await page.locator('[data-stretch-hold]').innerText(),/55 с/);
  await page.locator('[data-stretch-hold]').click();assert.match(await page.locator('[data-time]').innerText(),/00:5[45]/);
  await page.locator('.mobile-nav [data-view=day]').click();
  await page.locator('#day-view [data-day-start]').click();await page.waitForSelector('#guided-mark');
  assert.equal(await page.locator('#guided-step').innerText(),'Подход 1 из 3');
  assert.match(await page.locator('#guided-content').innerText(),/18/);
  const snapshot=(await read(date)).sessions.find(s=>s.plan_id==='weekday-5');
  await dose('legs01','sets',2);await dose('legs01','reps','12');await dose('stretch-sphinx','seconds',25);
  assert.deepEqual((await call('start',{date,planId:'weekday-5'})).session,snapshot,'Active session retains dose snapshot');
  await page.reload();await enter();await selectDate();await page.locator('#day-view [data-day-start]').click();
  assert.equal(await page.locator('#guided-step').innerText(),'Подход 1 из 3');
  await page.locator('[data-view=workout]').last().evaluate(button=>button.click());await page.locator('#stretch-after').click();
  assert.match(await page.locator('[data-stretch-hold]').innerText(),/55 с/,'Cooldown keeps saved session settings');
  assert.deepEqual(errors,[]);
  console.log('PASS: inline mobile edits, concurrency, per-day isolation, range validation, focus, retry/reset, reload persistence, stretch timer and immutable guided session.');
 }finally{
  await browser.close();
  const latest=await read(date);await call('schedule',{weekdays:original.schedule.weekdays,revision:latest.schedule.revision});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
