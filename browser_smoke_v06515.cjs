'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.env.AMC8_URL || 'https://jackiexu0619.github.io/lucas-amc8-coach/';
const errors = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  // A fresh isolated context avoids touching the family's browser storage.
  const context = await browser.newContext();
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.ok(response && response.ok(), 'deployed site should return a successful HTTP response');
    await page.locator('#guidedStudentDashboard').waitFor({ state: 'attached', timeout: 30000 });
    assert.match(await page.title(), /Lucas AMC8 Coach v0\.6\.5\.(15|16|17)/, 'deployed title should match intended build');
    assert.ok((await page.locator('#guidedStudentDashboard').innerText()).includes('YOUR AMC8 LEARNING PATH'),
      'guided learning path should render');

    const navigation = [
      { button: '每日训练', section: '#practice' },
      { button: '周末模拟', section: '#mock' },
      { button: '学习报告', section: '#report' },
      { button: '知识点', section: '#knowledge' },
      { button: '⚙ 家长设置', section: '#data' },
      { button: '主页', section: '#home' }
    ];

    for (const item of navigation) {
      await page.locator('nav button').filter({ hasText: item.button }).click();
      const section = page.locator(item.section);
      await section.waitFor({ state: 'visible' });
      await page.waitForFunction(sel => {
        const el = document.querySelector(sel);
        return !!el && el.classList.contains('active');
      }, item.section);
      const contentLength = (await section.innerText()).trim().length;
      assert.ok(contentLength > 30, item.button + ' view should render meaningful content (got ' + contentLength + ' chars)');
    }

    assert.equal(await page.locator('#guidedStudentDashboard').count(), 1,
      'returning home must not duplicate the guided dashboard');
    assert.deepEqual(errors, [], 'navigation should not produce uncaught JavaScript errors');

    console.log('PASS: deployed build title, guided learning path, all six navigation destinations, return-home rendering, and zero uncaught page errors.');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
