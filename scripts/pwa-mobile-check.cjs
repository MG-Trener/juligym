const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict'),fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true});
 const base=process.env.SITE_URL || 'http://127.0.0.1:4173/';
 await fs.mkdir('artifacts',{recursive:true});
 const profile=await fs.mkdtemp(require('node:path').resolve('artifacts/pwa-profile-'));
 const context=await chromium.launchPersistentContext(profile,{channel:process.env.BROWSER_CHANNEL || 'msedge',headless:true,viewport:{width:390,height:844},isMobile:true,hasTouch:true});
 try{
  const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.addInitScript(()=>{window.audioLog=[];const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){const o=original.call(this),start=o.start.bind(o),stop=o.stop.bind(o),record={stops:0};window.audioLog.push(record);o.start=t=>{record.hz=o.frequency.value;record.time=t;return start(t);};o.stop=t=>{record.stops++;return stop(t);};return o;};});
  await page.goto(base,{waitUntil:'networkidle'});await page.evaluate(()=>navigator.serviceWorker.ready);
  const cdp=await page.context().newCDPSession(page);const installability=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(installability.installabilityErrors,[]);
  const manifest=await (await page.request.get(new URL('manifest.webmanifest',base).href)).json();assert.equal(manifest.display,'standalone');assert.equal(manifest.scope,'./');
  assert.equal(await page.locator('link[rel=apple-touch-icon]').count(),1);
  // Browser-provided prompt path, then the manual fallback after dismissal.
  await page.evaluate(()=>{window.prompted=0;const event=new Event('beforeinstallprompt',{cancelable:true});event.prompt=async()=>{window.prompted++;};event.userChoice=Promise.resolve({outcome:'dismissed'});dispatchEvent(event);});
  await page.locator('.install-top').click();assert.equal(await page.evaluate(()=>window.prompted),1);
  await page.locator('.install-top').click();assert.equal(await page.locator('#install-dialog').evaluate(d=>d.open),true);await page.keyboard.press('Escape');
  await fs.mkdir('artifacts',{recursive:true});
  for(const [width,height] of [[320,740],[390,844],[430,932],[768,1024],[844,390]]){
   await page.setViewportSize({width,height});await page.evaluate(()=>scrollTo(0,0));
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Page overflow ${width}`);
   await page.locator('.rest-button[data-rest]').first().click();
   const box=await page.locator('#timer').boundingBox();assert.ok(box.x>=0 && box.x+box.width<=width+1 && box.y>=0 && box.y+box.height<=height+1,`Timer bounds ${width}`);
   const sound=await page.locator('#timer-sound').boundingBox();assert.ok(sound.height>=44);
   await page.screenshot({path:`artifacts/pwa-timer-${width}.png`});
   await page.locator('#timer-close').click();
   await page.locator('#library-open').click();await page.locator('#library-search').fill('бицепс');
   await page.locator('.library-item[data-select-exercise=curl]').click();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);
   await page.screenshot({path:`artifacts/pwa-library-${width}.png`});await page.keyboard.press('Escape');
  }
  await page.setViewportSize({width:390,height:844});await page.clock.install();
  await page.evaluate(()=>window.audioLog=[]);await page.locator('[data-rest]').first().click();
  await page.waitForFunction(()=>window.audioLog.length>=45);let voices=await page.evaluate(()=>window.audioLog);assert.equal(voices.filter(n=>n.hz===880).length,5);
  await page.locator('#timer-toggle').click();const paused=await page.locator('#timer-value').innerText();await page.clock.runFor(5000);assert.equal(await page.locator('#timer-value').innerText(),paused);
  assert.ok((await page.evaluate(()=>window.audioLog)).every(n=>n.stops>=2));
  await page.locator('#timer-toggle').click();await page.clock.runFor(91000);await page.waitForFunction(()=>window.audioLog.slice(-3).map(n=>n.hz).join(',')==='660,830,1046');
  assert.equal(await page.locator('#timer-value').innerText(),'00:00');
  const finishedCount=await page.evaluate(()=>window.audioLog.length);await page.clock.runFor(3000);assert.equal(await page.evaluate(()=>window.audioLog.length),finishedCount);
  await page.locator('#timer-sound').click();await page.reload();await page.locator('[data-rest]').first().click();assert.equal(await page.locator('#timer-sound').getAttribute('aria-pressed'),'false');assert.equal(await page.evaluate(()=>window.audioLog.length),0);
  await page.locator('#timer-close').click();
  // iOS help is available even without beforeinstallprompt.
  const ios=await browser.newPage({viewport:{width:390,height:844},userAgent:'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 Version/18.0 Mobile/15E148 Safari/604.1',isMobile:true,hasTouch:true});
  await ios.goto(base);await ios.locator('.install-top').click();assert.match(await ios.locator('#install-instructions').innerText(),/экран Домой/);await ios.screenshot({path:'artifacts/pwa-ios-install.png'});
  const standalone=await browser.newPage();await standalone.addInitScript(()=>Object.defineProperty(navigator,'standalone',{value:true}));await standalone.goto(base);assert.equal(await standalone.locator('.install-top').isVisible(),false);
  assert.deepEqual(errors,[]);console.log('PASS: Chromium installability, native prompt/fallback, iOS instructions, standalone detection, 320–844px portrait/landscape, real Web Audio scheduling, pause/resume/end, sound preference.');
 }finally{await context.close();await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
