const assert=require('node:assert/strict');
const {chromium}=require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const password=process.env.JULIGYM_PASSWORD;if(!password)throw Error('Set JULIGYM_PASSWORD for browser checks.');
async function enter(page){await page.locator('#access-password').fill(password);await page.locator('#access-form [type=submit]').click();await page.locator('#access-dialog').waitFor({state:'hidden'});}
const base=process.env.SITE_URL||'http://127.0.0.1:4173/';
(async()=>{const browser=await chromium.launch({channel:'msedge',headless:true});let errors=[];
try{
 const a=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'}),b=await browser.newContext({viewport:{width:390,height:844},isMobile:true,hasTouch:true,serviceWorkers:'block'});
 if(process.env.API_URL)for(const ctx of [a,b])await ctx.route('**/config.js',route=>route.fulfill({contentType:'application/javascript',body:'window.JULIGYM_CONFIG='+JSON.stringify({apiUrl:process.env.API_URL})}));
 const p=await a.newPage(),q=await b.newPage();for(const page of [p,q])page.on('pageerror',e=>errors.push(e.message));
 await p.goto(base);await enter(p);await p.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));
 const api=await p.evaluate(()=>window.JULIGYM_CONFIG.apiUrl);assert(api.includes('br-silent-lake-b99eu6ub'),'Browser write checks must use preview API');
 await p.locator('#sidebar-create').click();const qaTitle='QA браузер '+Date.now();await p.locator('#plan-name').fill(qaTitle);
 await p.locator('[data-editor-add="legs01"]').click();await p.locator('[data-editor-add="glutes01"]').click();
 for(const id of ['legs01','glutes01'])await p.locator(`[data-editor-sets="${id}"]`).selectOption('1');
 await p.locator('#plan-form button[type=submit]').click();await p.waitForSelector('#editor-dialog',{state:'hidden'});
 await p.waitForFunction(t=>document.querySelector('.plan-card.active h3')?.textContent===t,qaTitle);const planId=await p.locator('.plan-card.active').getAttribute('data-plan');assert(planId);
 await q.goto(base);await enter(q);await q.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));
 await q.locator('#show-all-plans').click();await q.locator(`[data-plan="${planId}"]`).click();
 await p.locator('[data-set="legs01:0"]').click();await p.waitForSelector('[data-set="legs01:0"].done');
 await q.reload();await enter(q);await q.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));
 await q.locator('#show-all-plans').click();await q.locator(`[data-plan="${planId}"]`).click();await q.waitForSelector('[data-set="legs01:0"].done');
 await q.locator('[data-set="glutes01:0"]').click();await q.waitForSelector('[data-set="glutes01:0"].done');
 await p.reload();await enter(p);await p.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));
 await p.locator('#show-all-plans').click();await p.locator(`[data-plan="${planId}"]`).click();await p.waitForSelector('#finish-workout:enabled');await p.locator('#finish-workout').click();await p.waitForSelector('.session-saved');
 await q.reload();await enter(q);await q.waitForFunction(()=>document.querySelector('#connection').textContent.includes('сохранено в Neon'));await q.locator('#show-all-plans').click();await q.locator(`[data-plan="${planId}"]`).click();await q.waitForSelector('.session-saved');assert.equal(await q.locator('[data-set]:enabled').count(),0);assert(await q.locator('.week-day.completed').count()>0);
 await p.locator('[data-group=all]').click();assert.equal(await p.locator('#library-grid article').count(),87);await p.locator('#search').fill('мёртвый');assert.equal(await p.locator('#library-grid article').count(),1);await p.locator('#search').fill('');
 const decoded=await p.evaluate(async()=>{const {exercises}=await import('./src/catalog.js');return Promise.all(exercises.map(e=>new Promise(resolve=>{const i=new Image();i.onload=()=>resolve(i.naturalWidth>1000);i.onerror=()=>resolve(false);i.src='./media/'+e.id+'.webp';})));});assert.equal(decoded.filter(Boolean).length,87);
 for(const [width,height]of [[320,740],[390,844],[768,1024],[844,390],[1440,1000],[1800,1000]]){await p.setViewportSize({width,height});await p.evaluate(()=>scrollTo(0,0));assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'overflow '+width);}
 await p.setViewportSize({width:1440,height:1000});await p.locator('[data-view=workout]').last().evaluate(n=>n.click());await p.locator('[data-plan=legs]').click();await p.screenshot({path:'artifacts/desktop-verified.png',fullPage:true});
 await q.locator('[data-view=library]').last().click();await q.locator('#menu-open').click();await q.screenshot({path:'artifacts/mobile-menu.png'});await q.locator('[data-group=legs]').click();await q.locator('#library-grid [data-image=legs01]').click();assert(await q.locator('#image-dialog').isVisible());await q.locator('#image-dialog [data-close]').click();await q.screenshot({path:'artifacts/mobile-verified.png',fullPage:false});
 assert.deepEqual(errors,[]);console.log('PASS: two separate visitors share set marks and completed diary after reload; editor; 87 loaded illustrations; library/search; mobile navigation; six viewports without overflow; no browser errors.');
}finally{await browser.close();}})().catch(e=>{console.error(e);process.exitCode=1;});
