const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const site=process.env.SITE_URL||'http://127.0.0.1:4173/';assert(/^http:\/\/(127\.0\.0\.1|localhost):/.test(site),'Isolated local UI journey only');
(async()=>{
 const {today,dayIndex}=await import(pathToFileURL(path.resolve('src/state.js')));
 const {advanceStretch,sessionResult}=await import(pathToFileURL(path.resolve('src/session-progress.js'))),date=today();
 const plan={id:'journey',title:'Спина и подвижность',revision:1,items:[{id:'back01',sets:2,reps:'8',rest:45}],stretch_ids:['stretch-calves','stretch-cat-cow']};
 let session={...plan,id:'journey-session',plan_id:plan.id,workout_date:date,marks:{'back01:0:1':true},stretch_state:{position:0,marks:{}},stretch_revision:0,finished_at:null};
 const data={plans:[plan],sessions:[session],history:[],schedule:{weekdays:{[dayIndex(date)]:plan.id},revision:1}};
 const profile=path.resolve('artifacts/journey-profile-'+Date.now()),errors=[],unexpected=[],writes={sets:0,stretch:0,finish:0};
 let context,page,failStep=false,failFinish=false;
 async function open(){
  context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:{width:1366,height:768},serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('juligym2:interface-sound','off');localStorage.setItem('juligym2:sound','off');});
  await context.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG={apiUrl:location.origin+"/journey-api/"}'}));
  await context.route('**/journey-api/**',async route=>{
   const r=route.request(),name=new URL(r.url()).pathname.split('/').pop(),body=r.method()==='POST'?r.postDataJSON():null;
   if(name==='auth')return route.fulfill(body.password==='fixture'?{json:{token:'journey-token'}}:{status:401,json:{error:'Неверный пароль.'}});
   if(name==='state')return route.fulfill({json:data});
   if(name==='start')return route.fulfill({json:{session}});
   if(name==='stretch-start'){
    session={id:'cooldown',plan_id:body.planId,workout_date:body.date,title:body.title,items:[],marks:{},stretch_ids:body.ids,stretch_settings:body.settings,stretch_state:{position:0,marks:{}},stretch_revision:0};
    data.sessions.push(session);return route.fulfill({json:{session}});
   }
   if(name==='sets'){writes.sets++;session.marks[`${body.exerciseId}:${body.setIndex}:${body.side}`]=body.done;return route.fulfill({json:{session}});}
   if(name==='stretch-progress'){
    if(failStep){failStep=false;return route.fulfill({status:503,json:{error:'Временно нет связи.'}});}
    assert.equal(body.revision,session.stretch_revision);writes.stretch++;
    session.stretch_state=advanceStretch(session.stretch_ids,session.stretch_state,body.action);session.stretch_revision++;
    return route.fulfill({json:{session}});
   }
   if(name==='finish'){
    if(failFinish){failFinish=false;return route.fulfill({status:503,json:{error:'Временно нет связи.'}});}
    writes.finish++;session.finished_at=new Date().toISOString();session.result_summary=sessionResult(session);session.result_status=session.result_summary.status;data.history=[session];
    return route.fulfill({json:{session}});
   }
   unexpected.push(name);return route.fulfill({status:400,json:{error:'Unexpected fixture request'}});
  });
  page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(site);
 }
 async function login(){if(await page.locator('#access-dialog').isVisible()){await page.locator('#access-password').fill('fixture');await page.locator('#access-password').press('Enter');await page.locator('#access-dialog').waitFor({state:'hidden'});}await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
 async function onScreen(selector){
  await page.waitForFunction(s=>{const n=document.querySelector(s),r=n?.getBoundingClientRect();return r&&r.width>0&&r.top>=0&&r.bottom<=innerHeight&&r.x>=0&&r.right<=innerWidth&&n.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));},selector);
 }
 async function openToday(){await page.locator('.sidebar [data-view=today]').click();}
 async function continueToday(){await page.locator('#today-content [data-today-start]').first().click();}
 try{
  await open();assert.equal(await page.locator('#main').isVisible(),false);assert(await page.locator('#access-password').evaluate(n=>n===document.activeElement));
  await page.locator('#access-password').fill('wrong');await page.locator('#access-password').press('Enter');await page.waitForFunction(()=>document.querySelector('#access-error').textContent.includes('Неверный'));assert.equal(await page.locator('#main').isVisible(),false);
  await login();assert.match(await page.locator('#today-content').innerText(),/правая сторона/);await continueToday();await onScreen('#guided-mark');
  await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="back01:1:1"]');await page.locator('[data-timer-toggle]').click();const rest=await page.locator('[data-time]').innerText();
  await context.close();await open();await login();await continueToday();await onScreen('#guided-mark');assert.equal(await page.locator('[data-time]').innerText(),rest);assert.match(await page.locator('.timer-description').innerText(),/паузе/);
  await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="back01:1:2"]');assert.equal(await page.locator('#timer').isVisible(),false);
  await page.locator('#guided-mark').click();await onScreen('#guided-content [data-workout-stretch]');assert.equal(session.finished_at,null);assert.equal(writes.sets,3);assert.equal(await page.locator('#guided-dock').isVisible(),false);
  await openToday();assert.match(await page.locator('#today-content').innerText(),/Осталась растяжка/);assert.equal(await page.locator('#today-content progress').getAttribute('value'),'0');
  await continueToday();await onScreen('[data-stretch-next]');assert.equal(await page.locator('.mode-switch [data-mode=stretch]').getAttribute('aria-pressed'),'true');assert.equal(await page.locator('#timer').isVisible(),false);
  await page.locator('[data-stretch-hold]').click();await page.locator('[data-timer-toggle]').click();const hold=await page.locator('[data-time]').innerText();
  for(const viewport of [{width:1366,height:768},{width:1280,height:720},{width:1093,height:614},{width:1001,height:600}]){
   await page.setViewportSize(viewport);await page.waitForFunction(w=>innerWidth===w,viewport.width);await page.evaluate(()=>scrollTo(0,0));await onScreen('[data-stretch-next]');await onScreen('#stretch-dock [data-time]');
   await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await onScreen('[data-stretch-next]');await onScreen('#stretch-dock [data-timer-toggle]');
   const end=await page.locator('#stretch-guided .finish-choice').boundingBox(),dock=await page.locator('#stretch-dock').boundingBox();assert(end.y+end.height<dock.y,'Footer actions clear the dock');
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
  }
  await page.setViewportSize({width:1366,height:768});await page.screenshot({path:'artifacts/journey-stretch-dock.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#stretch-dock').hidden);assert.equal(await page.locator('#stretch-guided [data-stretch-next]').count(),1);assert.equal(await page.locator('[data-time]').innerText(),hold);
  await page.setViewportSize({width:1366,height:768});await onScreen('[data-stretch-next]');
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await onScreen('#stretch-dock [data-stretch-next]');assert.equal(await page.locator('[data-time]').innerText(),hold);
  await page.locator('#settings-open').click();await page.locator('#lock-access').click();assert.equal(await page.locator('#stretch-dock').isVisible(),false);await login();await page.locator('#settings-dialog [data-close]').click();await onScreen('#stretch-dock [data-stretch-next]');assert.equal(await page.locator('[data-time]').innerText(),hold);
  failStep=true;await page.locator('[data-stretch-next]').click();await page.locator('.toast.error').waitFor();assert.equal(session.stretch_state.position,0);await onScreen('[data-stretch-next]');
  await page.locator('[data-stretch-next]').click();await page.waitForFunction(()=>document.querySelector('#stretch-guided h2').textContent.includes('правая'));await page.locator('[data-stretch-hold]').click();await page.locator('[data-timer-toggle]').click();const sideTimer=await page.locator('[data-time]').innerText();
  await context.close();await open();await login();assert.match(await page.locator('#today-content').innerText(),/Продолжить растяжку/);assert.match(await page.locator('#today-content').innerText(),/правая сторона/);await continueToday();await onScreen('#stretch-dock [data-stretch-next]');assert.equal(await page.locator('[data-time]').innerText(),sideTimer);
  await page.locator('[data-stretch-next]').click();await page.waitForFunction(()=>document.querySelector('#stretch-guided h2').textContent.includes('Движение 2'));assert.equal(await page.locator('[data-stretch-hold]').count(),0);assert.equal(await page.locator('#timer').isVisible(),false);
  await page.locator('[data-stretch-next]').click();await onScreen('[data-stretch-finish]');assert.equal(await page.locator('#stretch-dock').isVisible(),false);assert.equal(session.finished_at,null);
  await openToday();assert.match(await page.locator('#today-content').innerText(),/К результату/);await continueToday();
  failFinish=true;await page.locator('[data-stretch-finish]').click();await page.locator('.toast.error').waitFor();assert.equal(session.finished_at,null);await page.locator('[data-stretch-finish]').click();await page.locator('#today-view:not([hidden])').waitFor();
  assert.equal(session.result_status,'completed');assert.equal(session.result_summary.strength.done,2);assert.equal(session.result_summary.stretch.done,3);assert.equal(data.history.length,1);assert.equal(writes.finish,1);assert.equal(writes.stretch,3);
  assert.match(await page.locator('#today-content').innerText(),/Растяжка · выполнено шагов: 3 из 3/);await page.screenshot({path:'artifacts/journey-saved-today.png',animations:'disabled'});
  await page.locator('.sidebar [data-view=day]').click();assert.equal(await page.locator('.week-day.today.completed').count(),1);assert.match(await page.locator('.week-day.today').getAttribute('aria-label'),/тренировка выполнена/);
  await page.locator('[data-view=history]:visible').first().click();assert.equal(await page.locator('[data-history-plan=journey]').count(),1);
  session={...plan,id:'strength-only',plan_id:plan.id,workout_date:date,items:[{id:'back01',sets:1,reps:'8',rest:45}],stretch_ids:[],marks:{'back01:0:1':true},finished_at:null};data.sessions=[session];data.history=[];
  await page.reload();await login();await continueToday();await page.locator('#guided-mark').click();await page.locator('#guided-finish').click();await page.locator('#guided-content [data-workout-stretch]').click();
  await onScreen('[data-stretch-after-start]');assert.match(await page.locator('#stretch-cooldown').innerText(),/После тренировки/);await page.locator('[data-stretch-after-start]').click();await onScreen('[data-stretch-next]');assert.equal(session.title,'После тренировки');assert.equal(session.items.length,0);
  await page.locator('[data-stretch-next]').click();await page.waitForFunction(()=>JSON.parse(localStorage.getItem('juligym2:stretch-session-v1')).day.stretch_state.position===1);
  await page.locator('#settings-open').click();await page.locator('#lock-access').click();session.finished_at=new Date().toISOString();session.result_summary=sessionResult(session);session.result_status='partial';
  await login();await page.locator('#settings-dialog [data-close]').click();await page.locator('#stretch-home').waitFor();assert.equal(await page.locator('#stretch-dock').isVisible(),false);assert.equal(await page.evaluate(()=>localStorage.getItem('juligym2:stretch-session-v1')),null);
  assert.equal(await page.locator('#timer').count(),1);assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  console.log('PASS: laptop login/error, saved side and rest after browser restart, strength handoff, matching Today, stretch dock/resize, relock/resume, retry without lost steps, both stretch sides, final review and one completed mixed diary entry; optional recommended stretch after strength-only training. Isolated UI fixtures only.');
 }finally{await context?.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
