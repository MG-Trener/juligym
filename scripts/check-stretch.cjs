const assert = require('node:assert/strict');
const {chromium} = require('C:/Users/user/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');

const password = process.env.JULIGYM_PASSWORD;
if (!password) throw Error('Set JULIGYM_PASSWORD.');
const base = process.env.SITE_URL || 'http://127.0.0.1:4173/';

async function login(page) {
  await page.locator('#access-password').fill(password);
  await page.locator('#access-form [type=submit]').click();
  await page.locator('#access-dialog').waitFor({state: 'hidden'});
  await page.waitForFunction(() => document.querySelector('#connection').textContent.includes('сохранено в Neon'));
}

(async () => {
  const browser = await chromium.launch({channel: 'msedge', headless: true});
  try {
    const page = await browser.newPage({viewport: {width: 390, height: 844}, serviceWorkers: 'block'});
    const errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(base);
    await login(page);
    const nav = page.locator('.mobile-nav [data-view=stretch]');
    const strengthMode = page.locator('[data-mode=strength]');
    const stretchMode = page.locator('[data-mode=stretch]');
    assert.equal(await strengthMode.getAttribute('aria-pressed'), 'true');
    await stretchMode.click();
    assert.equal(await stretchMode.getAttribute('aria-pressed'), 'true');
    assert.equal(await nav.getAttribute('aria-current'), 'page');
    const cards = page.locator('#stretch-grid article');
    const guided = page.locator('#stretch-guided');
    assert.equal(await cards.count(), 30);
    assert.equal(await page.locator('#stretch-count').innerText(), '30 движений');
    assert.equal(await page.locator('[data-stretch-preset]').count(), 3);
    assert.equal(await page.locator('.week-section').isVisible(), false);
    for (const [group, count] of Object.entries({legs: 6, glutes: 4, back: 4, chest: 4, shoulders: 4, arms: 4, core: 4})) {
      await page.locator(`[data-stretch-group=${group}]`).click();
      assert.equal(await cards.count(), count);
    }
    await page.locator('[data-stretch-group=all]').click();
    const first = cards.nth(0).locator('.technique');
    const second = cards.nth(1).locator('.technique');
    await first.locator('summary').click();
    await second.locator('summary').click();
    assert.equal(await first.getAttribute('open'), null);
    await page.locator('[data-stretch-group=legs]').click();
    assert.equal(await second.getAttribute('open'), '');
    await page.locator('[data-stretch-group=all]').click();
    await page.locator('[data-stretch-add=stretch-calves]').click();
    await page.locator('[data-stretch-add=stretch-ankle-circles]').click();
    await page.reload();
    await login(page);
    await nav.click();
    assert.equal(await page.locator('#stretch-selection button').count(), 2);
    await page.locator('[data-stretch-custom]').click();
    assert.match(await guided.locator('h2').innerText(), /Движение 1 из 2 · сторона 1 из 2/);
    await page.locator('[data-stretch-hold]').click();
    await page.locator('[data-timer-toggle]').click();
    await page.locator('[data-timer-toggle]').click();
    assert.equal(await page.locator('.timer-description').innerText(), 'Удержание растяжки');
    await page.evaluate(() => {
      const now = Date.now.bind(Date);
      Date.now = () => now() + 21000;
    });
    await page.waitForFunction(() => document.querySelector('.timer-description').textContent.includes('Удержание завершено'));
    await page.locator('[data-stretch-next]').click();
    assert.match(await guided.locator('h2').innerText(), /сторона 2 из 2/);
    assert.equal(await page.locator('#timer').isVisible(), false);
    await strengthMode.click();
    assert.equal(await page.locator('#today-view').isVisible(), true);
    await stretchMode.click();
    assert.match(await guided.locator('h2').innerText(), /сторона 2 из 2/);
    await page.locator('[data-stretch-home]').click();
    await page.locator('[data-stretch-resume]').click();
    assert.match(await guided.locator('h2').innerText(), /сторона 2 из 2/);
    await page.locator('[data-stretch-next]').click();
    assert.equal(await guided.locator('article h3').innerText(), 'Круги стопой сидя');
    assert.match(await guided.locator('.stretch-meta').innerText(), /6 плавных повторов на сторону/);
    assert.equal(await page.locator('[data-stretch-hold]').count(), 0);
    await guided.locator('[data-image=stretch-ankle-circles]').click();
    assert.equal(await page.locator('#image-title').innerText(), 'Круги стопой сидя');
    await page.locator('#image-dialog [data-close]').click();
    await page.locator('[data-stretch-next]').click();
    assert.match(await guided.locator('h2').innerText(), /Движение 2 из 2 · сторона 2 из 2/);
    await page.locator('[data-stretch-next]').click();
    assert.equal(await guided.locator('h2').innerText(), 'Комплекс завершён');
    await page.locator('.mobile-nav [data-view=workout]').click();
    assert.equal(await page.locator('.week-section').isVisible(), true);
    await page.locator('#stretch-after').click();
    assert.equal(await page.locator('#stretch-cooldown').isVisible(), true);
    await page.locator('[data-stretch-after-start]').click();
    assert.equal(await guided.locator('.eyebrow').innerText(), 'После тренировки');
    await page.setViewportSize({width: 320, height: 740});
    await page.evaluate(() => window.scrollTo({top: 0, behavior: 'instant'}));
    const mobileSwitch = await page.locator('.mode-switch').boundingBox();
    assert(mobileSwitch.x >= 0 && mobileSwitch.x + mobileSwitch.width <= 320 && mobileSwitch.y >= 0 && mobileSwitch.y < 120);
    await page.evaluate(() => document.querySelector('#stretch-view').scrollIntoView());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const nextButton = await page.locator('[data-stretch-next]').boundingBox();
    const mobileNav = await page.locator('.mobile-nav').boundingBox();
    assert(nextButton.y + nextButton.height <= mobileNav.y, 'The next step is reachable above the navigation bar');
    await page.screenshot({path: 'artifacts/stretch-mobile.png'});
    await page.locator('[data-stretch-home]').click();
    await page.setViewportSize({width: 1440, height: 960});
    await page.evaluate(() => window.scrollTo(0, 0));
    const desktopSwitch = await page.locator('.mode-switch').boundingBox();
    assert(desktopSwitch.x > 720 && desktopSwitch.y < 70);
    await page.screenshot({path: 'artifacts/stretch-desktop.png'});
    await strengthMode.click();
    assert.equal(await page.locator('#workout-view').isVisible(), true);
    await page.locator('.sidebar [data-group=arms]').click();
    await stretchMode.click();
    await strengthMode.click();
    assert.equal(await page.locator('#library-view').isVisible(), true);
    assert.equal(await page.locator('#library-title').innerText(), 'Руки');
    assert.deepEqual(errors, []);
    console.log('PASS: mode switch on desktop and mobile, 30 stretches in seven groups, exclusive hints, persistent selection, timers, resume, mobility, image zoom, completion and strength cooldown.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode = 1;});
