'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.env.AMC8_URL || 'https://jackiexu0619.github.io/lucas-amc8-coach/';
const errors = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  // A fresh isolated context is intentional: this smoke test must never read or alter
  // the family's existing browser localStorage or any bound cloud sync code.
  const context = await browser.newContext();
  const page = await context.newPage();
  page.on('pageerror', error => errors.push(error.message));

  const response = await page.goto(url, { waitUntil: 'networkidle', timeout: 60000 });
  assert.ok(response && response.ok(), 'deployed site should return a successful HTTP response');
  await page.waitForSelector('#guidedStudentDashboard', { timeout: 30000 });
  assert.match(await page.title(), /Lucas AMC8 Coach v0\.6\.5\.15/, 'deployed title must match the intended build');
  await page.getByText('YOUR AMC8 LEARNING PATH', { exact: true }).waitFor();
  await page.getByRole('heading', { name: '让每次练习都有下一步' }).waitFor();

  const nav = [
    { label: '每日训练', section: '#practice', text: '今日训练安排' },
    { label: '周末模拟', section: '#mock', text: '本周25题' },
    { label: '学习报告', section: '#report', text: '整套成绩趋势' },
    { label: '知识点', section: '#knowledge', text: '知识点与四周诊断' },
    { label: '⚙ 家长设置', section: '#data', text: '数据与备份' },
    { label: '主页', section: '#home', text: 'YOUR AMC8 LEARNING PATH' }
  ];

  for (const item of nav) {
    await page.getByRole('button', { name: item.label, exact: true }).click();
    await page.locator(item.section + '.active').waitFor({ timeout: 10000 });
    await page.locator(item.section).getByText(item.text, { exact: false }).first().waitFor({ timeout: 15000 });
  }

  assert.equal(await page.locator('#guidedStudentDashboard').count(), 1,
    'returning home must not duplicate the guided dashboard');
  assert.deepEqual(errors, [], 'page must not throw uncaught JavaScript errors during navigation');

  console.log('PASS: deployed v0.6.5.15 page load, guided dashboard, all six navigation destinations, return-home rendering, and zero uncaught page errors.');
  await context.close();
  await browser.close();
})().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
