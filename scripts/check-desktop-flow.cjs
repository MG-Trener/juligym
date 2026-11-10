const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const site=process.env.SITE_URL||'http://127.0.0.1:4173/';assert(/^http:\/\/(127\.0\.0\.1|localhost):/.test(site),'Local UI fixtures only');
(async()=>{
 const {today,dayIndex}=await import(pathToFileURL(path.resolve('src/state.js'))),date=today();
 const plan={id:'fixture',title:'Проверка подходов',revision:1,items:[{id:'legs01',sets:2,reps:'10–12',rest:45},{id:'back01',sets:1,reps:'8–10',rest:45},{id:'core03',sets:1,reps:'15 с',rest:45}],stretch_ids:[]};
 const session={...plan,id:'fixture-session',plan_id:plan.id,workout_date:date,marks:{},started_at:new Date().toISOString(),finished_at:null};
 let data={plans:[plan],schedule:{weekdays:{[dayIndex(date)]:plan.id},revision:1},sessions:[session],history:[]},sets=0;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('juligym2:interface-sound','off');localStorage.setItem('juligym2:sound','off');});
  await context.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG={apiUrl:location.origin+"/qa-api/"}'}));
  await context.route('**/qa-api/**',route=>{
   const request=route.request(),endpoint=new URL(request.url()).pathname.split('/').pop();
   if(endpoint==='auth')return route.fulfill({json:{token:'local-ui-fixture'}});
   if(endpoint==='state')return route.fulfill({json:data});
   if(endpoint==='start')return route.fulfill({json:{session:data.sessions[0]}});
   if(endpoint==='sets'){
    const body=request.postDataJSON(),current=data.sessions[0];sets++;
    current.marks[`${body.exerciseId}:${body.setIndex}${body.side?':'+body.side:''}`]=body.done;
    return route.fulfill({json:{session:current}});
   }
   return route.fulfill({status:400,json:{error:'Unexpected fixture request'}});
  });
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
  async function enter(){if(await page.locator('#access-dialog').isVisible()){await page.locator('#access-password').fill('local-ui-fixture');await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});}await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
  async function switchToday(){await page.setViewportSize({width:1366,height:768});await page.locator('.sidebar [data-view=today]').click();await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForResponse(response=>response.url().includes('/qa-api/state'));}
  async function controlsVisible(timer=false){
   await page.waitForFunction(()=>{const button=document.querySelector('#guided-mark'),r=button?.getBoundingClientRect();return r&&r.top>=0&&r.bottom<=innerHeight;});
   assert.equal(await page.locator('#guided-mark').count(),1);assert.equal(await page.locator('#timer').count(),1);
   for(const selector of ['#guided-mark',...(timer?['#guided-dock [data-time]','#guided-dock [data-timer-toggle]']:[])]){
    assert(await page.locator(selector).evaluate(node=>{const r=node.getBoundingClientRect();return r.top>=0&&r.bottom<=innerHeight&&node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),selector+' remains visible and clickable');
   }
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
  }
  await page.goto(site);await enter();await page.locator('#today-content [data-today-start]').first().click();await controlsVisible();
  await page.screenshot({path:'artifacts/desktop-controls-start.png',animations:'disabled'});
  await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="legs01:1"]');assert.equal(sets,1);await page.locator('[data-timer-toggle]').click();const clock=await page.locator('[data-time]').innerText();
  for(const size of [{width:1920,height:1080},{width:1366,height:768},{width:1280,height:720},{width:1093,height:614},{width:1001,height:600}]){
   await page.setViewportSize(size);await page.waitForFunction(w=>innerWidth===w,size.width);await page.evaluate(()=>scrollTo(0,0));await controlsVisible(true);await page.evaluate(()=>scrollTo(0,document.body.scrollHeight));await controlsVisible(true);
   const bottom=await page.locator('#guided-content .finish-choice p').last().boundingBox(),dock=await page.locator('#guided-dock').boundingBox();assert(bottom.y+bottom.height<dock.y,'End-of-session controls can scroll clear of the dock');
  }
  await page.setViewportSize({width:1366,height:768});await page.screenshot({path:'artifacts/desktop-controls-timer.png',animations:'disabled'});
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>document.querySelector('#guided-dock').hidden);assert.equal(await page.locator('#guided-content #guided-mark').count(),1);assert.equal(await page.locator('#guided-view > #guided-timer-slot #timer').count(),1);assert.equal(await page.locator('[data-time]').innerText(),clock);
  await page.setViewportSize({width:1366,height:768});await controlsVisible(true);assert.equal(await page.locator('[data-time]').innerText(),clock);
  await page.reload();await enter();await page.locator('#today-content [data-today-start]').first().click();await controlsVisible(true);assert.equal(await page.locator('[data-time]').innerText(),clock);assert.match(await page.locator('.timer-description').innerText(),/паузе/);
  await context.setOffline(true);assert(await page.locator('#guided-mark').isDisabled());await context.setOffline(false);await page.waitForFunction(()=>!document.querySelector('#guided-mark').disabled);
  await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="back01:0:1"]');await controlsVisible(true);
  await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="back01:0:2"]');assert.equal(await page.locator('#timer').isVisible(),false);await controlsVisible();
  await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="core03:0:1"]');await page.locator('[data-guided-hold]').click();await controlsVisible(true);assert.equal(await page.locator('[data-time]').innerText(),'00:15');assert.equal(sets,4);
  await page.locator('#guided-content [data-image]').click();assert(await page.locator('#image-dialog').isVisible());await page.locator('#image-dialog [data-close]').click();await controlsVisible(true);
  await page.locator('.sidebar [data-view=today]').click();assert.equal(await page.locator('#guided-dock').isVisible(),false);assert.equal(await page.locator('#timer').isVisible(),false);

  const stretchPlan={id:'stretch-fixture',title:'Растяжка по плану',items:[],stretch_ids:['stretch-calves'],revision:1};
  data={plans:[stretchPlan],schedule:{weekdays:{[dayIndex(date)]:stretchPlan.id},revision:1},sessions:[],history:[]};await switchToday();
  assert.equal(await page.locator('.mode-switch [aria-pressed=true]').innerText(),'Растяжка');assert.equal(await page.locator('#sidebar-caption').innerText(),'БИБЛИОТЕКА РАСТЯЖКИ');
  await page.locator('[data-mode=strength]').click();assert(await page.locator('#library-view').isVisible());assert.equal(await page.locator('.mode-switch [aria-pressed=true]').innerText(),'Силовые');
  await switchToday();await page.locator('#search').fill('сфинкс');assert(await page.locator('#library-view').isVisible());assert.deepEqual(await page.locator('#library-grid h3').allTextContents(),['Низкий «Сфинкс»']);
  await switchToday();await page.locator('#muscle-groups [data-group=legs]').click();assert(await page.locator('#library-view').isVisible());assert.equal(await page.locator('.mode-switch [aria-pressed=true]').innerText(),'Растяжка');
  const mixed={...session,items:[{id:'back01',sets:1,reps:'8',rest:45}],stretch_ids:['stretch-calves'],marks:{'back01:0:1':true}};
  data.sessions=[mixed];await switchToday();assert.equal(await page.locator('.mode-switch [aria-pressed=true]').innerText(),'Силовые');
  mixed.marks['back01:0:2']=true;await switchToday();assert.equal(await page.locator('.mode-switch [aria-pressed=true]').innerText(),'Растяжка');
  mixed.finished_at=new Date().toISOString();data.schedule.weekdays={};await switchToday();assert.equal(await page.locator('.mode-switch [aria-pressed=true]').innerText(),'Силовые');
  data.sessions=[{...mixed,items:[],marks:{}}];await switchToday();assert.equal(await page.locator('.mode-switch [aria-pressed=true]').innerText(),'Растяжка');
  for(const width of [320,390,1366]){await page.setViewportSize({width,height:844});await page.waitForFunction(w=>innerWidth===w,width);assert.equal(await page.locator('.mode-switch [data-mode=stretch]').getAttribute('aria-pressed'),'true');assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);}
  assert.deepEqual(errors,[]);console.log('PASS: desktop dock visible at 1001–1920px, scrolling, zoom-sized viewport, single controls, both sides/hold/rest, mobile reparenting, reload, offline and dialogs; Today modes follow plans/snapshots/mixed progress; navigation and stretch search agree. UI fixtures only, no shared diary writes.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
