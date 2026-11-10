const assert=require('node:assert/strict'),path=require('node:path'),{pathToFileURL}=require('node:url'),{randomUUID}=require('node:crypto');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const site=process.env.SITE_URL||'http://127.0.0.1:4173/';
assert(/^http:\/\/(127\.0\.0\.1|localhost):/.test(site),'Isolated UI fixtures only');
(async()=>{
 const {today,dayIndex,addDays}=await import(pathToFileURL(path.resolve('src/state.js')));
 const {sessionResult,advanceStretch}=await import(pathToFileURL(path.resolve('src/session-progress.js')));
 const date=today(),plan={id:'fixture',title:'Мой план',revision:1,items:[{id:'legs01',sets:2,reps:'10',rest:45}],stretch_ids:['stretch-calves']};
 let session={...structuredClone(plan),id:randomUUID(),plan_id:plan.id,workout_date:date,marks:{'legs01:0':true},stretch_state:{position:0,marks:{}},stretch_revision:0,finished_at:null};
 const data={plans:[plan],schedule:{weekdays:{[dayIndex(date)]:plan.id},revision:1},sessions:[session],history:[]};
 const writes=[],errors=[],unexpected=[];let failRestart=false;
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});
  await context.addInitScript(()=>{localStorage.setItem('juligym2:interface-sound','off');localStorage.setItem('juligym2:sound','off');});
  await context.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG={apiUrl:location.origin+"/navigation-api/"}'}));
  await context.route('**/navigation-api/**',async route=>{
   const request=route.request(),name=new URL(request.url()).pathname.split('/').pop(),body=request.method()==='POST'?request.postDataJSON():null;
   if(name==='auth')return route.fulfill({json:{token:'fixture-token',expiresAt:Date.now()+8*3600000+60000}});
   if(name==='state')return route.fulfill({json:{...data,activeSessionIds:data.sessions.filter(s=>!s.finished_at).map(s=>s.id)}});
   writes.push(name);
   if(name==='day-exercise'){
    assert.equal(body.weekday,dayIndex(date));
    if(body.added)plan.stretch_ids.push(body.exerciseId);else plan.stretch_ids=plan.stretch_ids.filter(id=>id!==body.exerciseId);
    plan.revision++;return route.fulfill({json:{plan,schedule:data.schedule}});
   }
   if(name==='start'){
    session=data.sessions.find(s=>s.plan_id===body.planId&&s.workout_date===body.date);
    if(!session){session={...structuredClone(plan),id:randomUUID(),plan_id:plan.id,workout_date:body.date,marks:{},stretch_state:{position:0,marks:{}},stretch_revision:0,finished_at:null};data.sessions.push(session);}
    return route.fulfill({json:{session}});
   }
   if(name==='restart'){
    if(failRestart){failRestart=false;return route.fulfill({status:503,json:{error:'Не удалось сохранить.'}});}
    assert.equal(body.sessionId,session.id);const oldId=session.id;
    session={...session,id:randomUUID(),marks:{},stretch_state:{position:0,marks:{}},stretch_revision:0};data.sessions=data.sessions.map(s=>s.id===oldId?session:s);
    return route.fulfill({json:{session,replacedSessionId:oldId}});
   }
   if(name==='discard'){assert.equal(body.sessionId,session.id);data.sessions=data.sessions.filter(s=>s.id!==session.id);return route.fulfill({json:{discardedSessionId:session.id}});}
   if(name==='sets'){assert.equal(body.sessionId,session.id);session.marks[`${body.exerciseId}:${body.setIndex}`]=body.done;return route.fulfill({json:{session}});}
   if(name==='stretch-progress'){assert.equal(body.sessionId,session.id);session.stretch_state=advanceStretch(session.stretch_ids,session.stretch_state,body.action);session.stretch_revision++;return route.fulfill({json:{session}});}
   if(name==='finish'){assert.equal(body.sessionId,session.id);assert.equal(body.allowPartial,true);session.finished_at=new Date().toISOString();session.result_summary=sessionResult(session);session.result_status=session.result_summary.status;data.history.push(session);return route.fulfill({json:{session}});}
   unexpected.push(name);return route.fulfill({status:400,json:{error:'Unexpected fixture request'}});
  });
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.goto(site);await page.locator('#access-password').fill('fixture');await page.locator('#access-password').press('Enter');
  const loaded=()=>page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));
  await loaded();
  assert.deepEqual((await page.locator('.workout-nav button').allTextContents()).map(s=>s.trim()),['Сегодня','Неделя','Мой план','Библиотека','История']);
  await page.locator('.sidebar [data-open-plan]').click();assert(await page.locator('#plan-tools').isVisible());assert(await page.locator('#day-lists [data-dose=sets]').isVisible());assert.equal(await page.locator('.week-section').isVisible(),false);
  await page.locator('#plan-weekday').selectOption(String((dayIndex(date)+1)%7));assert.equal(await page.locator('#day-lists article').count(),0);
  await page.locator('#plan-weekday').selectOption(String(dayIndex(date)));assert.equal(await page.locator('#day-lists article').count(),2);
  await page.locator('.sidebar [data-view=library]').click();await page.locator('[data-mode=strength]').click();assert.equal(await page.locator('#library-grid article').count(),87);
  await page.locator('[data-mode=stretch]').click();assert(await page.locator('#library-view').isVisible());assert.equal(await page.locator('#library-grid article').count(),30);assert.match(await page.locator('#sidebar-caption').innerText(),/РАСТЯЖКИ/);
  await page.locator('#catalog-search').fill('сфинкс');assert.deepEqual(await page.locator('#library-grid h3').allTextContents(),['Низкий «Сфинкс»']);
  const added=await page.locator('#library-grid [data-day-edit]').getAttribute('data-day-edit');await page.locator('#library-grid [data-image]').click();assert(await page.locator('#image-dialog').isVisible());await page.locator('#image-dialog [data-close]').click();
  await page.locator('#library-grid [data-day-edit]').click();await page.locator('#library-grid [data-day-added=false]').waitFor();assert(plan.stretch_ids.includes(added));
  await page.locator('#library-view [data-open-plan]').click();assert.equal(await page.locator('#day-lists article').count(),3);
  const timeOrigin=await page.evaluate(()=>performance.timeOrigin);await page.locator('#brand').click();assert(await page.locator('#today-view').isVisible());assert.equal(await page.evaluate(()=>performance.timeOrigin),timeOrigin);
  // An inline restart confirmation does not mutate until confirmed and survives refresh.
  await page.locator('.restart-choice summary').click();assert.equal(writes.filter(n=>n==='restart').length,0);
  await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForResponse(r=>r.url().includes('/navigation-api/state'));assert(await page.locator('.restart-choice').evaluate(n=>n.open));
  failRestart=true;await page.locator('[data-session-restart]').click();await page.locator('.toast.error').waitFor();assert.equal(session.marks['legs01:0'],true);
  const oldId=session.id;await page.locator('[data-session-restart]').click();await page.waitForSelector('#guided-mark[data-guided-set="legs01:0"]');assert.notEqual(session.id,oldId);assert.deepEqual(session.marks,{});assert.equal(await page.locator('#timer').isVisible(),false);
  await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="legs01:1"]');await page.locator('[data-timer-toggle]').click();const remaining=await page.locator('[data-time]').innerText();
  await page.locator('#brand').click();assert(await page.locator('#today-view').isVisible());assert.equal(await page.evaluate(()=>performance.timeOrigin),timeOrigin);
  await page.reload();await loaded();assert.equal(await page.locator('#access-dialog').isVisible(),false);await page.locator('[data-today-start]').click();assert.equal(await page.locator('[data-time]').innerText(),remaining);
  await page.locator('#brand').click();await page.locator('[data-session-stop]').click();await page.waitForFunction(()=>document.querySelector('#today-content').textContent.includes('Частично выполнено'));assert.equal(session.result_summary.strength.done,1);assert.equal(data.history.length,1);assert.equal(await page.locator('[data-session-stop]').count(),0);
  // An empty session is cancellable, including a previous date.
  session={...structuredClone(plan),id:randomUUID(),plan_id:plan.id,workout_date:addDays(date,-1),marks:{},stretch_state:{position:0,marks:{}},stretch_revision:0,finished_at:null};data.sessions.push(session);
  await page.reload();await loaded();assert.equal(await page.locator('[data-session-stop]').innerText(),'Отменить занятие');await page.locator('[data-session-stop]').click();await page.waitForFunction(()=>!document.querySelector('[data-session-stop]'));assert.equal(data.sessions.filter(s=>!s.finished_at).length,0);
  // The identical choices work for stretching, including partial sides and cached timers.
  session={...structuredClone(plan),id:randomUUID(),plan_id:'stretch-fixture',workout_date:date,items:[],stretch_ids:['stretch-calves','stretch-cat-cow'],marks:{},stretch_state:{position:0,marks:{}},stretch_revision:0,finished_at:null};data.sessions=[session];data.history=[];
  await page.reload();await loaded();await page.locator('#today-content [data-day-start]').click();await page.locator('[data-stretch-next]').click();await page.waitForFunction(()=>document.querySelector('#stretch-guided h2').textContent.includes('правая'));
  await page.locator('[data-stretch-hold]').click();await page.locator('#brand').click();await page.locator('.restart-choice summary').click();await page.locator('[data-session-restart]').click();await page.waitForFunction(()=>document.querySelector('#stretch-guided h2').textContent.includes('левая'));assert.equal(await page.locator('#timer').isVisible(),false);
  await page.locator('[data-stretch-next]').click();await page.waitForFunction(()=>document.querySelector('#stretch-guided h2').textContent.includes('правая'));await page.locator('#brand').click();await page.locator('[data-session-stop]').click();await page.waitForFunction(()=>!document.querySelector('[data-session-stop]'));assert.equal(session.result_summary.stretch.done,1);assert.equal(data.history.length,1);
  // Server deletion invalidates a local resume record instead of reviving a removed session.
  const orphan={...session,id:'removed',finished_at:null};await page.evaluate(day=>{localStorage.setItem('juligym2:stretch-session-v1',JSON.stringify({day,title:day.title,ids:day.stretch_ids,position:1,completed:false,timer:{remaining:10,running:false}}));localStorage.setItem('juligym2:strength-timer-v1',JSON.stringify({owner:'removed|step',remaining:15}));},orphan);
  data.sessions=[];data.history=[];await page.reload();await loaded();assert.equal(await page.evaluate(()=>localStorage.getItem('juligym2:stretch-session-v1')),null);assert.equal(await page.evaluate(()=>localStorage.getItem('juligym2:strength-timer-v1')),null);
  await page.locator('.sidebar [data-open-plan]').click();await page.screenshot({path:'artifacts/navigation-my-plan.png',animations:'disabled'});
  data.sessions=[{...session,finished_at:null}];await page.reload();await loaded();
  for(const width of [320,390,1093,1366]){
   await page.setViewportSize({width,height:768});await page.locator((width<1001?'.mobile-nav':'.sidebar')+' [data-view=today]').click();
   await page.locator('.restart-choice summary').click();assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert(await page.locator('[data-session-restart]').isVisible());
   if(width===1366||width===390)await page.screenshot({path:`artifacts/navigation-session-${width}.png`,animations:'disabled'});
   await page.locator('.restart-choice summary').click();
   if(width<1001){assert.equal(await page.locator('.mobile-nav button:visible').count(),5);await page.locator('.mobile-nav [data-view=library]').click();await page.locator('[data-mode=stretch]').click();assert(await page.locator('#library-view').isVisible());}
  }
  assert.deepEqual(unexpected,[]);assert.deepEqual(errors,[]);
  console.log('PASS: five stable navigation entries; direct compact weekday editor; identical searchable strength/stretch library with add/details; logo/refresh preserve access and timer; inline restart with failure recovery; partial save and empty cancellation for strength/stretch/previous date; deleted-cache invalidation; 320–1366px. Isolated fixtures only.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
