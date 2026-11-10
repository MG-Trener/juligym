const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const api=process.env.API_URL,password=process.env.JULIGYM_PASSWORD,site=process.env.SITE_URL||'http://127.0.0.1:4173/';
assert(api?.includes('br-silent-lake-b99eu6ub')&&password,'Only preview writes');
let token;
async function call(path,body,status=200){const response=await fetch(new URL(path,api),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const value=await response.json();assert.equal(response.status,status,JSON.stringify(value));return value;}
const add=(date,n)=>new Date(Date.parse(date+'T12:00:00Z')+n*86400000).toISOString().slice(0,10);
const read=date=>call(`state?from=${date}&to=${date}`);
const change=(weekday,exerciseId,added)=>call('day-exercise',{weekday,exerciseId,added});
const dose=(weekday,exerciseId,field,value)=>call('day-settings',{weekday,exerciseId,field,value});
function ref(data,weekday,fallback){const id=data.schedule.weekdays[weekday]||null;return {expectedPlanId:id,expectedRevision:data.plans.find(p=>p.id===(id||fallback))?.revision};}
async function restore(undo,date){return call('day-restore',{undo,...ref(await read(date),undo.weekday,undo.planId)});}
(async()=>{
 token=(await call('auth',{password})).token;
 const today=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Qyzylorda'});
 let date=add(today,-((new Date(today+'T12:00:00Z').getUTCDay()+6)%7)-7);
 for(let i=0;i<40;i++){if(!(await read(date)).sessions.some(s=>s.plan_id==='weekday-0'))break;date=add(date,-7);}
 const original=await read(date),base=original.plans.find(p=>p.id==='legs');
 let browser;
 try{
  const weekdays={...original.schedule.weekdays,0:'legs',1:'legs'};delete weekdays[6];
  await call('schedule',{weekdays,revision:original.schedule.revision});
  const oldRef={expectedPlanId:'legs',expectedRevision:base.revision};
  let result=await call('day-move',{weekday:0,exerciseId:'legs01',direction:1,...oldRef});
  assert.equal(result.plan.id,'weekday-0');assert.equal(result.plan.items[1].id,'legs01');
  assert.equal(result.schedule.weekdays[1],'legs');
  assert.deepEqual((await read(date)).plans.find(p=>p.id==='legs'),base);
  await call('day-move',{weekday:0,exerciseId:'legs01',direction:1,...oldRef},409);
  const concurrentBody={weekday:0,exerciseId:'legs01',direction:1,...ref(await read(date),0)};
  const concurrent=await Promise.all([1,2].map(()=>fetch(new URL('day-move',api),{method:'POST',headers:{'Content-Type':'application/json',Authorization:'Bearer '+token},body:JSON.stringify(concurrentBody)})));
  assert.deepEqual(concurrent.map(response=>response.status).sort(),[200,409],'only one simultaneous reorder can apply');
  await Promise.all(concurrent.map(response=>response.json()));
  result=await call('day-move',{weekday:0,exerciseId:'legs01',direction:-1,...ref(await read(date),0)});assert.equal(result.plan.items[1].id,'legs01');
  await call('day-move',{weekday:0,exerciseId:'legs01',direction:0,...ref(await read(date),0)},400);
  for(const id of ['stretch-calves','stretch-sphinx','stretch-cat-cow'])await change(0,id,true);
  await dose(0,'legs01','sets',4);await dose(0,'legs01','reps','14');await dose(0,'stretch-sphinx','seconds',45);await dose(0,'stretch-cat-cow','repetitions',9);
  const snapshot=(await call('start',{date,planId:'weekday-0'})).session;
  result=await call('day-move',{weekday:0,exerciseId:'stretch-sphinx',direction:-1,...ref(await read(date),0)});
  assert.deepEqual(result.plan.stretch_ids,['stretch-sphinx','stretch-calves','stretch-cat-cow']);
  let removed=await change(0,'legs01',false);assert.equal(removed.undo.item.sets,4);assert.equal(removed.undo.item.reps,'14');
  await dose(0,'glutes01','sets',3);
  result=await restore(removed.undo,date);assert.equal(result.plan.items[1].id,'legs01');assert.equal(result.plan.items[0].sets,3);assert.equal(result.plan.items[1].sets,4);
  const revision=result.plan.revision;result=await restore(removed.undo,date);assert.equal(result.plan.revision,revision,'repeat undo is a no-op');
  for(const [id,field,value] of [['stretch-sphinx','seconds',45],['stretch-cat-cow','repetitions',9]]){
   removed=await change(0,id,false);result=await restore(removed.undo,date);assert.equal(result.plan.stretch_settings[id][field],value);
  }
  assert.deepEqual((await call('start',{date,planId:'weekday-0'})).session,snapshot,'started session retains its order and dose');
  removed=await change(0,'legs01',false);
  let current=await read(date);await call('schedule',{weekdays:{...current.schedule.weekdays,0:'core'},revision:current.schedule.revision});
  await call('day-restore',{undo:removed.undo,...ref(await read(date),0)},409);
  current=await read(date);await call('schedule',{weekdays:{...current.schedule.weekdays,0:'weekday-0'},revision:current.schedule.revision});await restore(removed.undo,date);
  await change(6,'stretch-sphinx',true);await dose(6,'stretch-sphinx','seconds',55);removed=await change(6,'stretch-sphinx',false);
  assert.equal(removed.schedule.weekdays[6],undefined);result=await restore(removed.undo,date);assert.equal(result.schedule.weekdays[6],'weekday-6');assert.equal(result.plan.stretch_settings['stretch-sphinx'].seconds,55);
  browser=await chromium.launch({channel:'msedge',headless:true});
  const context=await browser.newContext({viewport:{width:320,height:740},serviceWorkers:'block'});
  await context.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG='+JSON.stringify({apiUrl:api})}));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function enter(){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
  async function selectDate(target=date){
   await page.locator('.mobile-nav [data-view=day]').click();
   for(let i=0;i<40&&!await page.locator(`[data-date="${target}"]`).count();i++){const previous=await page.locator('#week-days button').first().getAttribute('data-date');await page.locator('[data-week="-1"]').click();await page.waitForFunction(old=>document.querySelector('#week-days button')?.dataset.date!==old,previous);}
   await page.locator(`[data-date="${target}"]`).click();
  }
  const card=id=>page.locator(`#day-lists [data-day-card="${id}"]`);
  const strengthOrder=()=>page.locator('#day-lists .day-list').first().locator('[data-day-card]').evaluateAll(nodes=>nodes.map(n=>n.dataset.dayCard));
  await page.goto(site);await enter();await selectDate();
  assert.equal(await page.locator('#day-template-title').innerText(),'План всех понедельников');assert.match(await page.locator('.day-note').innerText(),/уже начато/);
  assert.equal(await page.locator('#day-lists .day-list').first().locator('[data-day-move][data-direction="-1"]').first().isDisabled(),true);
  assert.equal(await page.locator('#day-lists .day-list').first().locator('[data-day-move][data-direction="1"]').last().isDisabled(),true);
  const before=await strengthOrder();
  await card('legs01').locator('[data-day-move][data-direction="1"]').click();
  await page.waitForFunction(previous=>[...document.querySelector('#day-lists .day-list').querySelectorAll('[data-day-card]')].map(n=>n.dataset.dayCard).join(',')!==previous,before.join(','));
  const moved=await strengthOrder();assert.equal(moved.indexOf('legs01'),before.indexOf('legs01')+1);
  assert.equal(await page.evaluate(()=>document.activeElement.dataset.dayMove),'legs01');
  assert.equal(await card('legs01').locator('[data-dose=sets]').inputValue(),'4');assert.equal(await card('legs01').locator('[data-dose=reps]').inputValue(),'14');
  await page.reload();await enter();await selectDate();assert.deepEqual(await strengthOrder(),moved);
  await card('legs01').locator('[data-day-edit]').click();await card('legs01').waitFor({state:'detached'});assert.match(await page.locator('#undo-remove').innerText(),/План всех понедельников/);
  await page.locator(`[data-date="${add(date,1)}"]`).click();const tuesdayBefore=await strengthOrder();
  await page.locator('#undo-remove [data-day-undo]').click();await page.locator('#undo-remove').waitFor({state:'hidden'});assert.deepEqual(await strengthOrder(),tuesdayBefore,'undo never edits the currently selected different weekday');
  await page.locator(`[data-date="${date}"]`).click();assert.deepEqual(await strengthOrder(),moved);
  await card('stretch-sphinx').locator('[data-day-edit]').click();await card('stretch-sphinx').waitFor({state:'detached'});
  await page.reload();await enter();await selectDate();assert(await page.locator('#undo-remove').isVisible());
  await page.route('**/day-restore',r=>r.fulfill({status:503,json:{error:'QA disconnected'},headers:{'Access-Control-Allow-Origin':'*'}}));
  await page.locator('#undo-remove [data-day-undo]').click();await page.waitForSelector('.toast.error:not([hidden])');assert(await page.locator('#undo-remove').isVisible());assert.equal(await card('stretch-sphinx').count(),0);
  await page.unroute('**/day-restore');await page.locator('#undo-remove [data-day-undo]').click();await card('stretch-sphinx').waitFor();assert.equal(await card('stretch-sphinx').locator('[data-dose=seconds]').inputValue(),'45');
  await card('stretch-cat-cow').locator('[data-image]').click();assert.match(await page.locator('#image-day-action').innerText(),/План всех понедельников/);
  await page.locator('#image-day-action [data-day-edit]').click();await page.locator('#image-undo').waitFor();await page.locator('#image-undo [data-day-undo]').click();await page.locator('#image-undo').waitFor({state:'hidden'});await page.locator('#image-dialog [data-close]').click();assert.equal(await card('stretch-cat-cow').locator('[data-dose=repetitions]').inputValue(),'9');
  const unchanged=await strengthOrder();
  await page.route('**/day-move',r=>r.fulfill({status:503,json:{error:'QA move failure'},headers:{'Access-Control-Allow-Origin':'*'}}));
  await card('legs01').locator('[data-day-move][data-direction="-1"]').click();await page.waitForSelector('.toast.error:not([hidden])');assert.deepEqual(await strengthOrder(),unchanged);await page.unroute('**/day-move');
  for(const width of [320,390,768,1440]){await page.setViewportSize({width,height:900});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);}
  await page.locator('#toast').waitFor({state:'hidden'});
  await page.setViewportSize({width:390,height:844});await page.locator('#day-template-title').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/package2-week-mobile.png',animations:'disabled'});
  await card('legs01').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/package2-order-mobile.png',animations:'disabled'});
  await context.setOffline(true);await page.waitForFunction(()=>document.querySelector('#day-offline').hidden===false);
  for(const button of await page.locator('#day-lists [data-day-move]').all())assert(await button.isDisabled());
  await context.setOffline(false);await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));
  await page.locator('#day-intro [data-day-start]').click();await page.locator('#guided-mark').waitFor();assert.match(await page.locator('#guided-mark').getAttribute('data-guided-set'),new RegExp('^'+snapshot.items[0].id+':0'));
  assert.deepEqual((await call('start',{date,planId:'weekday-0'})).session,snapshot);
  assert.deepEqual(errors,[]);
  console.log('PASS: weekly labels; adjacent reorder with dose preservation; copy-on-write isolation; revision conflicts; restore including last movement; hold/repetition recovery; mobile/desktop layout; undo across dates/reload/modal; network retry; immutable guided session.');
 }finally{
  if(browser)await browser.close();const latest=await read(date);await call('schedule',{weekdays:original.schedule.weekdays,revision:latest.schedule.revision});
 }
})().catch(error=>{console.error(error);process.exitCode=1;});
