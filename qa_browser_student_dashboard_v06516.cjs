'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname);
const artifacts = path.join(root, 'artifacts');
fs.mkdirSync(artifacts, { recursive: true });

const mime = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg'
};

const server = http.createServer((req, res) => {
  const pathname = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
  let file = path.resolve(root, '.' + pathname);
  if (file !== root && !file.startsWith(root + path.sep)) {
    res.writeHead(403); res.end('Forbidden'); return;
  }
  try {
    if (fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    const data = fs.readFileSync(file);
    res.writeHead(200, { 'Content-Type': mime[path.extname(file).toLowerCase()] || 'application/octet-stream', 'Cache-Control': 'no-store' });
    res.end(data);
  } catch {
    res.writeHead(404); res.end('Not found');
  }
});

(async () => {
  let browser;
  const pageErrors = [];
  const cloudRequests = [];
  try {
    await new Promise((resolve, reject) => {
      server.once('error', reject);
      server.listen(4173, '127.0.0.1', resolve);
    });
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1365, height: 900 },
      deviceScaleFactor: 1,
      reducedMotion: 'reduce'
    });
    const page = await context.newPage();
    page.on('pageerror', error => pageErrors.push(error.message));
    page.on('request', request => {
      if (request.url().includes('/functions/v1/amc8-sync')) cloudRequests.push(request.url());
    });

    // Fresh context: no saved sync code, no existing user state and no production cloud writes.
    assert.deepEqual(await page.evaluate(() => Object.keys(localStorage)), []);
    await page.goto('http://127.0.0.1:4173/index.html', { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() =>
      document.title.includes('v0.6.5.16') &&
      window.LucasAMC8StudentDashboard?.version === '0.6.5.16' &&
      document.querySelectorAll('#guidedStudentDashboard .student-path-step').length === 4,
      { timeout: 30000 }
    );

    const desktop = await page.evaluate(() => {
      const panel = document.querySelector('#guidedStudentDashboard');
      const grid = panel.querySelector('.student-path-grid');
      const next = panel.querySelector('.student-next-card');
      return {
        title: document.title,
        heading: panel.querySelector('h2')?.textContent?.trim(),
        steps: [...panel.querySelectorAll('.student-path-step h4')].map(x => x.textContent.trim()),
        desktopColumns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        panelWidth: Math.round(panel.getBoundingClientRect().width),
        nextAction: next.querySelector('h3')?.textContent?.trim(),
        hasReportButton: [...next.querySelectorAll('button')].some(x => x.textContent.includes('查看学习报告'))
      };
    });
    assert.match(desktop.title, /v0\.6\.5\.16/);
    assert.equal(desktop.steps.length, 4);
    assert.equal(desktop.desktopColumns, 4, 'desktop learning path should display four columns');
    assert.ok(desktop.heading, 'guided home heading should be present');
    assert.ok(desktop.nextAction, 'next-action recommendation should be present');
    assert.equal(desktop.hasReportButton, true);
    await page.screenshot({ path: path.join(artifacts, 'student-dashboard-desktop.png'), fullPage: true });

    await page.setViewportSize({ width: 390, height: 844 });
    await page.waitForTimeout(250);
    const mobile = await page.evaluate(() => {
      const panel = document.querySelector('#guidedStudentDashboard');
      const grid = panel.querySelector('.student-path-grid');
      const rect = panel.getBoundingClientRect();
      return {
        columns: getComputedStyle(grid).gridTemplateColumns.split(' ').length,
        panelLeft: Math.round(rect.left),
        panelRight: Math.round(rect.right),
        viewportWidth: document.documentElement.clientWidth,
        overflow: panel.scrollWidth > panel.clientWidth
      };
    });
    assert.equal(mobile.columns, 1, 'mobile learning path should stack into one column');
    assert.ok(mobile.panelLeft >= 0 && mobile.panelRight <= mobile.viewportWidth + 1, 'dashboard should fit mobile viewport');
    assert.equal(mobile.overflow, false, 'dashboard should not create internal horizontal overflow');
    await page.screenshot({ path: path.join(artifacts, 'student-dashboard-mobile.png'), fullPage: true });

    // Dashboard is presentation-only. Opening a fresh page must not write a sync row.
    await page.waitForTimeout(1000);
    assert.deepEqual(cloudRequests, [], 'fresh browser must not call the Supabase sync endpoint');
    assert.deepEqual(pageErrors, [], 'page must not throw uncaught JavaScript errors');

    console.log('PASS: v0.6.5.16 fresh-browser smoke test; desktop/mobile layout, four-step path, next action, no uncaught errors, and zero cloud writes.');
    console.log(JSON.stringify({ desktop, mobile, pageErrors, cloudRequests: cloudRequests.length }, null, 2));
  } catch (error) {
    console.error(error);
    process.exitCode = 1;
  } finally {
    if (browser) await browser.close();
    await new Promise(resolve => server.close(resolve));
  }
})();
