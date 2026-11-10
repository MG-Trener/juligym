const assert=require('node:assert/strict'),path=require('node:path'),{randomUUID}=require('node:crypto');
const {chromium,devices}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const site=process.env.SITE_URL||'http://127.0.0.1:4173/',api=process.env.API_URL,password=process.env.JULIGYM_PASSWORD;
assert(api?.includes('br-silent-lake-b99eu6ub')&&password,'Writes only to the preview diary');
let token;
async function call(route,body,status=200){const response=await fetch(new URL(route,api),{method:body?'POST':'GET',headers:{'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:body?JSON.stringify(body):undefined});const result=await response.json();assert.equal(response.status,status,JSON.stringify(result));return result;}
async function login(page){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
function instrument(){
 localStorage.setItem('juligym2:interface-sound','off'); // Test timer signals independently.
 window.qaVisibility='visible';Object.defineProperty(document,'visibilityState',{configurable:true,get:()=>qaVisibility});
 window.setVisibility=value=>{window.qaVisibility=value;document.dispatchEvent(new Event('visibilitychange'));};
 window.wakeTest={requests:0,active:0,max:0,defer:false,deny:false,resolve:null};
 Object.defineProperty(navigator,'wakeLock',{configurable:true,value:{request:async()=>{
  wakeTest.requests++;if(wakeTest.deny)throw Error('OS declined');
  if(wakeTest.defer)await new Promise(resolve=>wakeTest.resolve=resolve);
  const sentinel=new EventTarget();sentinel.released=false;wakeTest.active++;wakeTest.max=Math.max(wakeTest.max,wakeTest.active);
  sentinel.release=async()=>{if(sentinel.released)return;sentinel.released=true;wakeTest.active--;sentinel.dispatchEvent(new Event('release'));};return sentinel;
 }}});
 window.audioTest={resumes:[],frequencies:[],peak:0};
 const Native=window.AudioContext||window.webkitAudioContext;
 window.AudioContext=class extends Native{
  resume(){audioTest.resumes.push(navigator.userActivation.isActive);return super.resume();}
  createOscillator(){const oscillator=super.createOscillator(),start=oscillator.start;oscillator.start=function(...args){audioTest.frequencies.push(oscillator.frequency.value);return start.apply(this,args);};return oscillator;}
  createGain(){const gain=super.createGain(),analyser=this.createAnalyser(),samples=new Float32Array(256);analyser.fftSize=256;gain.connect(analyser);const poll=setInterval(()=>{analyser.getFloatTimeDomainData(samples);audioTest.peak=Math.max(audioTest.peak,...samples.map(Math.abs));},10);setTimeout(()=>clearInterval(poll),5000);return gain;}
 };
}
async function timerChecks(){
 const browser=await chromium.launch({channel:'msedge',headless:true,args:['--disable-features=PreloadMediaEngagementData,MediaEngagementBypassAutoplayPolicies']});
 try{
  for(const device of [null,devices['Pixel 7']]){
   const context=await browser.newContext({...device,viewport:device?.viewport||{width:1366,height:768},serviceWorkers:'block'});await context.addInitScript(instrument);
   const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));
   await page.route('**/timer-check.html',route=>route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/src/styles.css"><link rel="stylesheet" href="/src/workout-flow.css"><button id="probe" data-rest>Проверка</button><p data-awake-note hidden></p><aside id="timer" hidden></aside><script type="module">window.timerModule=await import("/src/timer.js");document.querySelector("#probe").onclick=()=>timerModule.startTimer(3);</script>'}));
   await page.goto(new URL('timer-check.html',site).href);await page.waitForFunction(()=>window.timerModule);
   await page.locator('#probe').click();await page.waitForFunction(()=>document.querySelector('[data-time]').textContent==='00:00');
   const audio=await page.evaluate(()=>audioTest);assert(audio.resumes.some(Boolean),'Audio is unlocked in a user click');assert(audio.peak>0,'Native WebAudio produced a waveform');assert(audio.frequencies.includes(1046),'Distinct finish signal');
   assert.equal(await page.evaluate(()=>wakeTest.active),0,'Standalone finish releases screen');
   await page.evaluate(()=>timerModule.startTimer(30));await page.locator('[data-timer-toggle]').click();
   const before=await page.locator('[data-time]').innerText();await page.locator('[data-timer-more]').click();assert.equal(await page.locator('[data-time]').innerText(),'00:45');assert.equal(await page.locator('[data-timer-toggle]').innerText(),'Продолжить');assert.equal(before,'00:30');
   await page.locator('[data-timer-toggle]').click();await page.evaluate(()=>setVisibility('hidden'));const paused=await page.locator('[data-time]').innerText();await page.waitForTimeout(1100);assert.equal(await page.locator('[data-time]').innerText(),paused);await page.evaluate(()=>setVisibility('visible'));assert.equal(await page.locator('[data-timer-toggle]').innerText(),'Продолжить');
   await page.locator('[data-timer-sound]').click();const count=await page.evaluate(()=>audioTest.frequencies.length);await page.locator('[data-timer-toggle]').click();await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>audioTest.frequencies.length),count);assert.equal(await page.evaluate(()=>localStorage.getItem('juligym2:sound')),'off');
   await page.evaluate(async()=>{timerModule.stopTimer();await timerModule.keepAwake(true);});assert.equal(await page.evaluate(()=>wakeTest.active),1);
   await page.evaluate(()=>setVisibility('hidden'));assert.equal(await page.evaluate(()=>wakeTest.active),0);await page.evaluate(()=>setVisibility('visible'));await page.waitForFunction(()=>wakeTest.active===1);
   await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));assert.equal(await page.evaluate(()=>wakeTest.active),0);await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.waitForFunction(()=>wakeTest.active===1);
   await page.evaluate(async()=>{await timerModule.keepAwake(false);wakeTest.defer=true;void timerModule.keepAwake(true);void timerModule.keepAwake(true);void timerModule.keepAwake(true);});const requests=await page.evaluate(()=>wakeTest.requests);
   await page.evaluate(()=>timerModule.keepAwake(false));await page.evaluate(()=>{wakeTest.defer=false;wakeTest.resolve();});await page.waitForFunction(()=>wakeTest.active===0);assert.equal(await page.evaluate(()=>wakeTest.requests),requests);assert.equal(await page.evaluate(()=>wakeTest.max),1,'No duplicate or orphan lock');
   await page.evaluate(async()=>{wakeTest.deny=true;await timerModule.keepAwake(true);});assert(await page.locator('[data-awake-note]').isVisible());
   await page.evaluate(async()=>{await timerModule.keepAwake(false);Object.defineProperty(navigator,'wakeLock',{configurable:true,value:undefined});await timerModule.keepAwake(true);});assert(await page.locator('[data-awake-note]').isVisible());
   assert.deepEqual(errors,[]);await context.close();
  }
 }finally{await browser.close();}
 console.log('PASS: desktop and Android touch emulation; native audio waveform/start/countdown/finish/mute; pause on hide; paused +15; wake lifecycle, races and unavailable API.');
}
async function restartChecks(){
 token=(await call('auth',{password})).token;
 const date=new Date().toLocaleDateString('sv-SE',{timeZone:'Asia/Qyzylorda'});
 const initial=await call(`state?from=${date}&to=${date}`);
 const source=initial.plans.find(plan=>plan.title.startsWith('QA')&&!initial.sessions.some(session=>session.plan_id===plan.id));
 assert(source,'Use an unused QA preview plan for this date; do not create more permanent test plans');
 const plan=(await call('plans',{id:source.id,revision:source.revision,title:source.title,items:[{id:'back01',sets:2},{id:'core03',sets:1}]})).plan;
 await call('start',{date,planId:plan.id});
 const profile=path.resolve('artifacts/mobile-runtime-profile-'+Date.now()),errors=[];
 let context,page;
 async function open(){
  context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,...devices['Pixel 7'],serviceWorkers:'block'});
  await context.addInitScript(instrument);await context.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG='+JSON.stringify({apiUrl:api})}));
  page=await context.newPage();page.on('pageerror',error=>errors.push(error.message));await page.goto(site);await login(page);
 }
 try{
  await open();await page.locator(`#today-content [data-today-start][data-workout-plan="${plan.id}"]`).click();
  await page.waitForSelector('#guided-mark[data-guided-set="back01:0:1"]');await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="back01:0:2"]');await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="back01:1:1"]');
  await page.locator('[data-timer-toggle]').click();const remaining=await page.locator('[data-time]').innerText();
  await page.locator('.mobile-nav [data-view=today]').click();await page.locator(`#today-content [data-today-start][data-workout-plan="${plan.id}"]`).click();assert.equal(await page.locator('[data-time]').innerText(),remaining);assert.match(await page.locator('.timer-description').innerText(),/паузе/);
  await context.close();await open();await page.locator(`#today-content [data-today-start][data-workout-plan="${plan.id}"]`).click();await page.waitForSelector('#guided-mark[data-guided-set="back01:1:1"]');assert.equal(await page.locator('[data-time]').innerText(),remaining);assert.match(await page.locator('.timer-description').innerText(),/паузе/);
  await page.locator('#guided-mark').click();await page.waitForSelector('#guided-mark[data-guided-set="back01:1:2"]');assert.equal(await page.locator('#timer').isVisible(),false,'Old side timer does not leak to the next side');
  await page.locator('#guided-content .finish-choice summary').click();await page.locator('#guided-content [data-finish-partial]').click();await page.waitForSelector('.flow-finished');
  const saved=(await call(`state?from=${date}&to=${date}`)).sessions.find(item=>item.plan_id===plan.id);assert.equal(saved.result_summary.strength.done,1);assert.equal(saved.result_status,'partial');assert.equal(await page.evaluate(()=>wakeTest.active),0);
  await page.locator('.mobile-nav [data-view=library]').click();await page.locator('[data-mode=stretch]').click();await page.locator('#library-routines').click();await page.locator('[data-stretch-preset=lower]').click();await page.waitForSelector('[data-stretch-next]');await page.locator('[data-stretch-next]').click();await page.waitForFunction(()=>document.querySelector('#stretch-guided h2')?.textContent.includes('правая'));await page.locator('[data-stretch-hold]').click();
  assert(await page.locator('#stretch-timer-slot #timer').isVisible());await page.locator('[data-timer-toggle]').click();const stretchRemaining=await page.locator('[data-time]').innerText();
  for(const size of [{width:320,height:640},{width:390,height:844},{width:844,height:390},{width:1366,height:768}]){
   await page.setViewportSize(size);await page.waitForFunction(width=>innerWidth===width,size.width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);
   const buttons=await page.locator('#timer button').evaluateAll(nodes=>nodes.map(node=>({height:node.getBoundingClientRect().height,width:node.getBoundingClientRect().width,overflow:node.scrollWidth>node.clientWidth})));assert(buttons.every(box=>box.height>=44&&box.width>=44&&!box.overflow),'Timer controls support touch: '+JSON.stringify({size,buttons}));
   await page.locator('[data-stretch-next]').scrollIntoViewIfNeeded();assert(await page.locator('[data-stretch-next]').evaluate(node=>{const r=node.getBoundingClientRect();return node.contains(document.elementFromPoint(r.x+r.width/2,r.y+r.height/2));}),'Timer does not cover next action');
  }
  await page.setViewportSize({width:390,height:844});await page.waitForFunction(()=>innerWidth===390);await page.locator('#timer').scrollIntoViewIfNeeded();await page.screenshot({path:'artifacts/package4-stretch-mobile.png',animations:'disabled',scale:'css'});
  await context.close();await open();await page.locator('.mobile-nav [data-view=library]').click();await page.locator('[data-mode=stretch]').click();await page.locator('#library-routines').click();await page.locator('[data-stretch-resume]').click();assert.match(await page.locator('#stretch-guided h2').innerText(),/правая/);assert.equal(await page.locator('[data-time]').innerText(),stretchRemaining);assert.match(await page.locator('.timer-description').innerText(),/паузе/);assert.equal(await page.evaluate(()=>wakeTest.active),1);
  await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pagehide',{persisted:true})));await page.evaluate(()=>dispatchEvent(new PageTransitionEvent('pageshow',{persisted:true})));await page.locator('[data-timer-more]').click();assert((await page.evaluate(()=>JSON.parse(localStorage.getItem('juligym2:stretch-session-v1')).timer.remaining))>Number(stretchRemaining.split(':')[1]));
  const current=await page.evaluate(()=>JSON.parse(localStorage.getItem('juligym2:stretch-session-v1')).day);
  await call('stretch-progress',{date:current.workout_date,planId:current.plan_id,revision:current.stretch_revision,action:'next',opId:randomUUID()});await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForFunction(()=>document.querySelector('#stretch-guided h2')?.textContent.includes('Движение 2'));assert.equal(await page.locator('#timer').isVisible(),false,'A timer for a remotely advanced side is discarded');
  await page.locator('#stretch-guided .finish-choice summary').click();await page.locator('[data-stretch-finish]').click();await page.waitForSelector('#today-view:not([hidden])');assert.equal(await page.evaluate(()=>wakeTest.active),0);
  assert.deepEqual(errors,[]);
 }finally{
  await context?.close();
  const latest=(await call(`state?from=${date}&to=${date}`)).plans.find(item=>item.id===source.id);
  await call('plans',{id:source.id,revision:latest.revision,title:source.title,subtitle:source.subtitle,items:source.items});
 }
 console.log('PASS: actual browser-process restart of strength and stretch; same side, remaining time paused; partial result; cross-tab step invalidates old timer; 320px/landscape/desktop actions and 44px timer controls.');
}
(async()=>{await timerChecks();await restartChecks();})().catch(error=>{console.error(error);process.exitCode=1;});
