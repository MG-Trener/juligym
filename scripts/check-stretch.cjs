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
    await nav.click();
    const cards = page.locator('#stretch-grid article');
    const guided = page.locator('#stretch-guided');
    assert.equal(await cards.count(), 15);
    assert.equal(await page.locator('[data-stretch-preset]').count(), 3);
    assert.equal(await page.locator('.week-section').isVisible(), false);
    for (const [group, count] of Object.entries({legs: 3, glutes: 2, back: 2, chest: 2, shoulders: 2, arms: 2, core: 2})) {
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
    await page.locator('[data-stretch-add=stretch-cat-cow]').click();
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
    await page.locator('[data-stretch-home]').click();
    await page.locator('[data-stretch-resume]').click();
    assert.match(await guided.locator('h2').innerText(), /сторона 2 из 2/);
    await page.locator('[data-stretch-next]').click();
    assert.equal(await guided.locator('article h3').innerText(), 'Кошка — корова');
    assert.equal(await page.locator('[data-stretch-hold]').count(), 0);
    await guided.locator('[data-image=stretch-cat-cow]').click();
    assert.equal(await page.locator('#image-title').innerText(), 'Кошка — корова');
    await page.locator('#image-dialog [data-close]').click();
    await page.locator('[data-stretch-next]').click();
    assert.equal(await guided.locator('h2').innerText(), 'Комплекс завершён');
    await page.locator('.mobile-nav [data-view=workout]').click();
    assert.equal(await page.locator('.week-section').isVisible(), true);
    await page.locator('#stretch-after').click();
    assert.equal(await page.locator('#stretch-cooldown').isVisible(), true);
    await page.locator('[data-stretch-after-start]').click();
    assert.equal(await guided.locator('.eyebrow').innerText(), 'После тренировки');
    await page.setViewportSize({width: 320, height: 740});
    await page.evaluate(() => document.querySelector('#stretch-view').scrollIntoView());
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const nextButton = await page.locator('[data-stretch-next]').boundingBox();
    const mobileNav = await page.locator('.mobile-nav').boundingBox();
    assert(nextButton.y + nextButton.height <= mobileNav.y, 'The next step is reachable above the navigation bar');
    await page.screenshot({path: 'artifacts/stretch-mobile.png'});
    await page.locator('[data-stretch-home]').click();
    await page.setViewportSize({width: 1440, height: 960});
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.screenshot({path: 'artifacts/stretch-desktop.png'});
    assert.deepEqual(errors, []);
    console.log('PASS: stretching groups, exclusive hints, persistent selection, hold timer, both sides, resume, mobility, image zoom, completion, strength cooldown, mobile layout.');
  } finally {
    await browser.close();
  }
})().catch(error => {console.error(error);process.exitCode = 1;});
