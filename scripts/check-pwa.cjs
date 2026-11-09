const assert=require('node:assert/strict'),path=require('node:path');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const password=process.env.JULIGYM_PASSWORD;if(!password)throw Error('Set JULIGYM_PASSWORD for browser checks.');
async function enter(page){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});}
const base=process.env.SITE_URL||'http://127.0.0.1:4173/',profile=path.resolve('artifacts/pwa-profile-'+Date.now());
(async()=>{let context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:{width:390,height:844}});
try{
 if(process.env.API_URL)await context.route('**/config.js',r=>r.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG='+JSON.stringify({apiUrl:process.env.API_URL})}));
 let page=await context.newPage();await page.goto(base);await enter(page);await page.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));
 await page.evaluate(()=>navigator.serviceWorker.ready);
 const cache=await page.evaluate(async()=>{const names=(await caches.keys()).filter(n=>n.startsWith('juligym-access-'));return (await(await caches.open(names[0])).keys()).length;});
 assert.equal(cache,123);
 const cdp=await context.newCDPSession(page);await cdp.send('Page.enable');const install=await cdp.send('Page.getInstallabilityErrors');assert.deepEqual(install.installabilityErrors,[]);
 await page.evaluate(()=>{window.audioTest={created:0,stopped:0};const original=AudioContext.prototype.createOscillator;AudioContext.prototype.createOscillator=function(){const oscillator=original.call(this),stop=oscillator.stop;window.audioTest.created++;oscillator.stop=function(...args){window.audioTest.stopped++;return stop.apply(this,args);};return oscillator;};});
 await page.locator('[data-rest]').first().click();await page.waitForTimeout(100);assert((await page.evaluate(()=>audioTest.created))>0);
 await page.locator('[data-timer-toggle]').click();const stopped=await page.evaluate(()=>audioTest.stopped);assert(stopped>0);
 await page.locator('[data-timer-sound]').click();const count=await page.evaluate(()=>audioTest.created);await page.evaluate(async()=>{(await import('./src/timer.js')).startTimer(2);});await page.waitForTimeout(100);assert.equal(await page.evaluate(()=>audioTest.created),count);
 await page.locator('[data-timer-sound]').click();await page.waitForTimeout(2500);assert((await page.evaluate(()=>audioTest.created))>=count+3);assert((await page.locator('.timer-description').innerText()).includes('завершён'));await page.locator('[data-timer-close]').first().click();
 await context.close();context=await chromium.launchPersistentContext(profile,{channel:'msedge',headless:true,viewport:{width:390,height:844}});await context.setOffline(true);page=await context.newPage();await page.goto(base);await enter(page);await page.waitForSelector('[data-set]');assert.equal(await page.locator('[data-set]:enabled').count(),0);assert.equal(await page.locator('#training-start').isDisabled(),true);
 await page.locator('[data-view=library]').last().click();assert.equal(await page.locator('#library-grid article').count(),87);
 const pictures=await page.evaluate(async()=>{const {exercises}=await import('./src/catalog.js');return Promise.all(exercises.map(e=>new Promise(resolve=>{const img=new Image();img.onload=()=>resolve(true);img.onerror=()=>resolve(false);img.src='./media/'+e.id+'.webp';})));});assert(pictures.every(Boolean));await page.screenshot({path:'artifacts/offline-mobile.png'});
 await page.locator('.mobile-nav [data-view=stretch]').click();
 assert.equal(await page.locator('#stretch-grid article').count(),15);
 const stretchImages=await page.evaluate(async()=>{
  const {stretches}=await import('./src/stretch-catalog.js');
  return Promise.all(stretches.map(async exercise=>{
   const image=new Image();image.src='./media/'+exercise.id+'.webp';await image.decode();return image.naturalWidth;
  }));
 });
 assert(stretchImages.every(width=>width>1000));
 await page.locator('[data-stretch-preset=lower]').click();
 await page.locator('[data-stretch-hold]').click();
 assert.equal(await page.locator('#timer').isVisible(),true);
 await page.locator('[data-stretch-next]').click();
 assert.match(await page.locator('#stretch-guided h2').innerText(),/сторона 2 из 2/);
 console.log('PASS: installable PWA, complete cache, 102 offline illustrations, read-only diary and stretching exercises with timer offline, WebAudio controls.');
}finally{await context.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
