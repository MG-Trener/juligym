const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs/promises');
(async()=>{
 const browser=await chromium.launch({headless:true,channel:process.env.BROWSER_CHANNEL || 'msedge'});
 try {
  const page=await browser.newPage({viewport:{width:1800,height:1000}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  const url=process.env.SITE_URL || 'http://127.0.0.1:4173';
  await page.addInitScript(()=>{if(!localStorage.getItem('juligym:v1'))localStorage.setItem('juligym:v1',JSON.stringify({day:1,mode:'easy',sessions:{'1:easy':{done:['squat:0'],finished:false}},history:[]}));});
  await page.goto(url,{waitUntil:'networkidle'});
  const saved=()=>page.evaluate(()=>JSON.parse(localStorage.getItem('juligym:v1')));
  assert.equal(await page.locator('[data-set="squat:0"]').getAttribute('aria-pressed'),'true');
  assert.equal(await page.locator('.library-group').count(),7);
  assert.equal(await page.locator('.library-item').count(),46);
  await page.locator('#library-search').fill('Жим гантелей сидя');
  await page.locator('.library-item[data-select-exercise=press]').click();
  assert.equal(await page.locator('.recommendation').count(),3);
  const recommendations=await page.locator('.recommendation-add').evaluateAll(nodes=>nodes.map(n=>n.dataset.add));
  assert.ok(!recommendations.some(id=>['squat','bridge','wall','row','heel','press'].includes(id)));
  await page.locator('#library-selected [data-add=press]').click();
  assert.equal(await page.locator('.exercise-card').count(),6);
  assert.equal(await page.locator('[data-set="squat:0"]').getAttribute('aria-pressed'),'true');
  await page.locator('#add-recommendations').click();
  assert.equal(await page.locator('.exercise-card').count(),9);
  await page.locator('[data-remove=press]').click();
  assert.equal(await page.locator('.exercise-card').count(),8);
  assert.equal(await page.locator('[data-set="squat:0"]').getAttribute('aria-pressed'),'true');
  await page.locator('[data-move=row][data-direction="-1"]').click();
  let data=await saved();assert.equal(data.plans[0].items[2],'row');
  await page.reload();assert.equal(await page.locator('.exercise-card').count(),8);
  await page.locator('#plan-name').fill('Мой комплекс <1>');await page.locator('#plan-name').press('Tab');
  await page.reload();assert.equal(await page.locator('#plan-name').inputValue(),'Мой комплекс <1>');
  assert.match(await page.locator('#tab-1').innerText(),/Мой комплекс <1>/);
  await page.locator('#library-search').fill('несуществующее');
  assert.equal(await page.locator('.library-item').count(),0);
  await page.locator('#library-search').fill('спина');assert.ok(await page.locator('.library-item').count()>0);
  await page.locator('#library-search').fill('');
  await page.selectOption('#week-count','1');assert.equal(await page.locator('[role=tab]').count(),1);
  await page.selectOption('#week-count','7');assert.equal(await page.locator('[role=tab]').count(),7);
  assert.match(await page.locator('#week-note').innerText(),/подряд/);
  await page.locator('#tab-4').click();assert.equal(await page.locator('.exercise-card').count(),0);
  assert.equal(await page.locator('#finish-session').isDisabled(),true);
  assert.equal(await page.locator('.progress-fill').getAttribute('style'),'width:0%');
  await page.locator('#library-detail > summary').click();await page.locator('#library-selected .library-add').click();assert.equal(await page.locator('.exercise-card').count(),1);
  await page.locator('.schedule-settings > summary').click();
  page.once('dialog',d=>d.dismiss());await page.selectOption('[data-template="4"]','2');
  assert.equal(await page.locator('.exercise-card').count(),1);
  page.once('dialog',d=>d.accept());await page.selectOption('[data-template="4"]','2');
  assert.equal(await page.locator('.exercise-card').count(),5);
  assert.equal((await saved()).plans[0].items.length,8);
  // Remove and restore a weekday without discarding its saved complex.
  await page.locator('[data-weekday="0"]').click();assert.equal(await page.locator('[role=tab]').count(),6);
  assert.equal((await saved()).plans[0].items.length,8);
  await page.locator('[data-weekday="0"]').click();assert.equal(await page.locator('[role=tab]').count(),7);
  await page.reload();assert.equal(await page.locator('[role=tab]').count(),7);
  await page.evaluate(()=>window.dispatchEvent(new Event('beforeprint')));
  assert.equal(await page.locator('#print-area section').count(),7);
  assert.equal(await page.locator('.print-exercise').count(),(await saved()).plans.reduce((n,p)=>n+p.items.length,0));
  // Use a clean profile for final visual checks.
  const visual=await browser.newPage({viewport:{width:1800,height:1000}});
  await visual.goto(url,{waitUntil:'networkidle'});
  await fs.mkdir('artifacts',{recursive:true});
  const loadImages=()=>visual.locator('.exercise-card img').evaluateAll(async imgs=>{imgs.forEach(i=>i.loading='eager');await Promise.all(imgs.map(i=>i.decode()));});
  await loadImages();await visual.screenshot({path:'artifacts/planner-desktop.png'});
  for(const width of [1440,1024,768,390,320]){
    await visual.setViewportSize({width,height:900});
    await visual.selectOption('#week-count','7');
    assert.equal(await visual.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,`Overflow ${width}`);
    await visual.selectOption('#week-count','3');
    await visual.evaluate(()=>scrollTo(0,0));
    await visual.screenshot({path:`artifacts/planner-${width}.png`});
    if(width<=1000){
      await visual.locator('#library-open').click();
      assert.equal(await visual.locator('#library').getAttribute('aria-modal'),'true');
      await visual.locator('#library-search').fill('бицепс');
      await visual.locator('.library-item[data-select-exercise=curl]').click();
      await visual.locator('.library-preview-image').click();assert.equal(await visual.locator('#image-dialog').evaluate(d=>d.open),true);
      await visual.keyboard.press('Escape');
      await visual.locator('#library-search').fill('');
      await visual.screenshot({path:`artifacts/library-${width}.png`});
      await visual.keyboard.press('Escape');assert.equal(await visual.locator('main').evaluate(e=>e.inert),false);
    }
  }
  assert.deepEqual(errors,[]);
  console.log('PASS: v1 migration, grouped library, contextual recommendations, add/remove/reorder, persistence, 1–7 days, independent templates, empty plans, print, desktop and mobile drawer.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
