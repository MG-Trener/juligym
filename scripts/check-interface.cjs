const assert=require('node:assert/strict');
const {chromium,devices}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const site=process.env.SITE_URL||'http://127.0.0.1:4173/',api=process.env.API_URL,password=process.env.JULIGYM_PASSWORD;
assert(api?.includes('br-silent-lake-b99eu6ub')&&password,'Use the preview API');
function instrument(){
 window.soundTest={notes:[],peak:0,gains:[],outputs:[]};
 const oscillator=AudioContext.prototype.createOscillator,gain=AudioContext.prototype.createGain;
 AudioContext.prototype.createOscillator=function(){const node=oscillator.call(this),start=node.start,set=node.frequency.setValueAtTime;let frequency;
  node.frequency.setValueAtTime=function(value,...rest){frequency=value;return set.call(this,value,...rest);};
  node.start=function(...args){soundTest.notes.push({frequency:frequency||node.frequency.value,at:performance.now()});return start.apply(this,args);};return node;
 };
 AudioContext.prototype.createGain=function(){const node=gain.call(this),ramp=node.gain.linearRampToValueAtTime,analyser=this.createAnalyser(),samples=new Float32Array(256);analyser.fftSize=256;node.connect(analyser);
  const connect=node.connect,destination=this.destination;node.connect=function(target,...args){if(target===destination)soundTest.outputs.push(analyser);return connect.call(this,target,...args);};
  node.gain.linearRampToValueAtTime=function(value,...rest){soundTest.gains.push(value);return ramp.call(this,value,...rest);};
  const poll=setInterval(()=>{analyser.getFloatTimeDomainData(samples);soundTest.peak=Math.max(soundTest.peak,...samples.map(Math.abs));},5);setTimeout(()=>clearInterval(poll),1000);return node;
 };
}
async function login(page){if(await page.locator('#access-dialog').isVisible()){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});}await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));}
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],writes=[];
 try{
  const context=await browser.newContext({viewport:{width:1366,height:768},serviceWorkers:'block'});await context.addInitScript(instrument);
  await context.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG='+JSON.stringify({apiUrl:api})}));
  await context.route(api+'**',route=>{const request=route.request();if(request.method()==='POST'&&!request.url().endsWith('/auth')){writes.push(request.url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto(site);await login(page);
  assert.equal(await page.locator('a[href^="https://"],a[href^="http://"],a[target="_blank"]').count(),0,'No external links in any panel/dialog');
  const notes=()=>page.evaluate(()=>soundTest.notes.length);
  assert.equal(await notes(),0,'No sound during password entry');
  await page.locator('#settings-open').hover();await page.waitForTimeout(180);assert.equal(await notes(),1);
  const rect=await page.locator('#settings-open').boundingBox();await page.mouse.move(rect.x+20,rect.y+15);await page.waitForTimeout(180);assert.equal(await notes(),1,'No repeated sound inside one button');
  const beforeRefresh=await notes();await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await page.waitForResponse(r=>r.url().includes('/state?'));await page.waitForTimeout(180);assert.equal(await notes(),beforeRefresh,'Polling does not sound out a stationary pointer');
  await page.locator('#settings-open').click();await page.waitForTimeout(180);assert((await notes())>beforeRefresh);assert(await page.locator('#interface-sounds').isChecked());
  const sound=await page.evaluate(()=>soundTest);assert(sound.peak>0,'Native WebAudio produced a waveform');assert(sound.gains.every(value=>value<=.07),'Interface feedback is quieter than the timer');
  await page.screenshot({path:'artifacts/final-settings-desktop.png',animations:'disabled'});
  async function sample(value){
   await page.locator('#sound-volume').evaluate((n,value)=>{n.value=value;n.dispatchEvent(new Event('input',{bubbles:true}));},String(value));
   const measured=page.evaluate(()=>new Promise(resolve=>{let peak=0;const values=new Float32Array(256),timer=setInterval(()=>{for(const output of soundTest.outputs){output.getFloatTimeDomainData(values);peak=Math.max(peak,...values.map(Math.abs));}},5);setTimeout(()=>{clearInterval(timer);resolve(peak);},650);}));
   await page.locator('#sound-preview').click();return measured;
  }
  const audible=await sample(75);assert(audible>.03,'Audible sample at default volume');assert.equal(await sample(0),0,'Zero volume silences both audio outputs');assert((await sample(100))>audible,'Full volume is louder than 75%');
  assert.equal(await page.locator('#timer').isVisible(),false,'Sample does not start a timer');assert.equal(await page.locator('#sound-volume-value').innerText(),'100%');
  const beforeKeyboard=await notes();await page.keyboard.press('Tab');await page.waitForTimeout(180);assert((await notes())>beforeKeyboard,'Keyboard focus has feedback');
  await page.locator('#interface-sounds').uncheck();const muted=await notes();await page.locator('#settings-dialog [data-close]').click();await page.locator('.sidebar [data-view=day]').hover();await page.waitForTimeout(200);assert.equal(await notes(),muted);assert.equal(await page.evaluate(()=>localStorage.getItem('juligym2:interface-sound')),'off');
  await page.reload();await login(page);await page.locator('#settings-open').click();assert.equal(await page.locator('#interface-sounds').isChecked(),false);assert.equal(await page.locator('#sound-volume').inputValue(),'100');assert.equal(await notes(),0,'Mute survives reopening');await page.locator('#settings-dialog [data-close]').click();
  await page.locator('.sidebar [data-view=day]').click();await page.locator('#day-templates').click();await page.locator('[data-rest]').first().click();await page.evaluate(async()=>(await import('./src/timer.js')).startTimer(2));await page.waitForFunction(()=>document.querySelector('[data-time]').textContent==='00:00');assert(await page.evaluate(()=>soundTest.notes.some(note=>note.frequency===1046)),'Timer finish still sounds when interface is muted');
  await page.locator('[data-timer-close]').first().click();await page.locator('#settings-open').click();await page.locator('#interface-sounds').check();await page.locator('#settings-dialog [data-close]').click();await page.waitForTimeout(200);
  const beforeTouch=await notes();await page.locator('#settings-open').dispatchEvent('pointermove',{pointerType:'touch'});await page.waitForTimeout(180);assert.equal(await notes(),beforeTouch,'Touch does not trigger hover sounds');
  await page.locator('#settings-open').click();for(const width of [320,390,1093,1366]){await page.setViewportSize({width,height:768});await page.waitForFunction(w=>innerWidth===w,width);assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>document.documentElement.clientWidth),false);assert(await page.locator('#interface-sounds').isVisible());}
  await page.setViewportSize({width:390,height:844});await page.screenshot({path:'artifacts/final-settings-mobile.png',animations:'disabled'});
  assert.deepEqual(errors,[]);assert.deepEqual(writes,[]);await context.close();
  console.log('PASS: no external links; real hover/click/keyboard waveform; no pointer chatter or touch hover; saved independent mute; timer signals unaffected; settings fit 320–1366px; no diary writes or page errors.');
 }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
