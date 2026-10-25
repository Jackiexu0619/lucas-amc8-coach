'use strict';
const assert = require('node:assert/strict');
const { chromium } = require('playwright');

const url = process.env.AMC8_URL || 'https://jackiexu0619.github.io/lucas-amc8-coach/';
const errors = [];

(async () => {
  const browser = await chromium.launch({ headless: true });
  // A fresh isolated context avoids touching the family's browser storage.
  const context = await browser.newContext();
  // Seed only this disposable browser context; never read or mutate the family's browser storage.
  const fixtureDate = new Date().toISOString().slice(0, 10);
  const weekendIds = Array.from({ length: 25 }, (_, i) => 'archive_2015_' + String(i + 1).padStart(2, '0'));
  const dailyIds = ['archive_2016_13', 'archive_2016_14', 'archive_2016_15'];
  const weekendPaperId = 'QA-WEEKEND-LOCKED-' + fixtureDate.replaceAll('-', '');
  const dailyPaperId = 'QA-DAILY-LOCKED-' + fixtureDate.replaceAll('-', '');
  const fixture = {
    version: '0.6.5.18',
    profile: { name: 'Isolated Browser QA', goal: '2027-01 AMC 8' },
    settings: { cooldown_days: 30, slow_threshold_sec: 240, daily_limit: 3 },
    skill_state: {}, attempts: [], true_attempts: [], true_question_tags: {},
    v064_question_tags: {}, v064_specific_skills: {}, mock_history: [], mock_detail_history: [], daily_sessions: [],
    daily_plan: {
      date: fixtureDate, question_ids: dailyIds, paper_id: dailyPaperId,
      created_at: new Date().toISOString(), engine_version: '0.6.5.18', submitted: false
    },
    printable_mock_ids: weekendIds,
    printable_mock_date: fixtureDate,
    printable_mock_id: weekendPaperId,
    printable_mock_meta: {
      engine: 'official_mixed_position_v1', engine_version: '0.6.5.18', source_years: [2015],
      source_mix: weekendIds.map((id, i) => ({ id, year: 2015, original_position: i + 1 })),
      difficulty_by_position: Array.from({ length: 25 }, (_, i) => i + 1 <= 8 ? 1 : i + 1 <= 16 ? 2 : i + 1 <= 21 ? 3 : 4),
      constraints: { mixed_years: true, original_position_preserved: true, unique_questions: true, answer_key_linked: true }
    },
    mock_drafts: { [weekendPaperId]: { answers: {}, guesses: {}, total_minutes: null, error_types: {} } },
    cloud_meta: {}
  };
  await context.addInitScript(({ key, state }) => {
    if (location.origin === 'https://jackiexu0619.github.io') {
      localStorage.setItem(key, JSON.stringify(state));
    }
  }, { key: 'lucas_amc8_coach_v05', state: fixture });
  const page = await context.newPage();
  page.setDefaultTimeout(10000);
  page.on('pageerror', error => errors.push(error.message));

  try {
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
    assert.ok(response && response.ok(), 'deployed site should return a successful HTTP response');
    await page.locator('#guidedStudentDashboard').waitFor({ state: 'attached', timeout: 30000 });
    const deployedTitle = await page.title();
    console.log('Observed deployed title: ' + deployedTitle);
    assert.match(deployedTitle, /Lucas AMC8 Coach v0\.6\.5\.18/, 'live site must be exactly v0.6.5.18');
    assert.ok((await page.locator('#guidedStudentDashboard').innerText()).includes('YOUR AMC8 LEARNING PATH'),
      'guided learning path should render');

    async function assertLockedPapers(stage) {
      const state = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), 'lucas_amc8_coach_v05');
      assert.ok(state, stage + ': isolated fixture state should remain available');
      assert.deepEqual(state.printable_mock_ids, weekendIds, stage + ': locked weekend question IDs must not change');
      assert.equal(state.printable_mock_id, weekendPaperId, stage + ': locked weekend paper identity must not change');
      assert.equal(state.printable_mock_date, fixtureDate, stage + ': locked weekend paper date must not change');
      assert.deepEqual(state.daily_plan.question_ids, dailyIds, stage + ': pending daily question IDs must not change');
      assert.equal(state.daily_plan.paper_id, dailyPaperId, stage + ': pending daily paper identity must not change');
      assert.equal(state.daily_plan.submitted, false, stage + ': pending daily paper must remain unsubmitted');
      assert.equal((state.attempts || []).length, 0, stage + ': navigation must not write answer attempts');
      assert.equal((state.mock_detail_history || []).length, 0, stage + ': navigation must not write mock results');
      assert.equal((state.daily_sessions || []).length, 0, stage + ': navigation must not write daily result sessions');
    }
    await assertLockedPapers('initial render');

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
      await assertLockedPapers(item.button);
    }

    assert.equal(await page.locator('#guidedStudentDashboard').count(), 1,
      'returning home must not duplicate the guided dashboard');
    assert.deepEqual(errors, [], 'navigation should not produce uncaught JavaScript errors');

    console.log('PASS: exact v0.6.5.18 live build, all six navigation destinations, locked weekend/daily paper preservation, no test answers written, return-home rendering, and zero uncaught page errors.');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
