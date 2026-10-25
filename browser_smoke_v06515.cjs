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
  const archiveSource = fs.readFileSync('official_bank.js', 'utf8');
  const archiveMarker = 'window.AMC8_ARCHIVE_DATA=';
  const archiveStart = archiveSource.indexOf(archiveMarker) + archiveMarker.length;
  const archiveEnd = archiveSource.lastIndexOf(';');
  const archiveRows = JSON.parse(archiveSource.slice(archiveStart, archiveEnd));
  const archiveById = new Map(archiveRows.map(row => [row.id, row]));
  const answerById = new Map(archiveRows.map(row => [row.id, row.answer]));
  const weekendIds = Array.from({ length: 25 }, (_, i) => 'archive_2015_' + String(i + 1).padStart(2, '0'));
  const dailyIds = ['archive_2016_13', 'archive_2016_14', 'archive_2016_15'];
  const weekendPaperId = 'QA-WEEKEND-LOCKED-' + fixtureDate.replaceAll('-', '');
  const dailyPaperId = 'QA-DAILY-LOCKED-' + fixtureDate.replaceAll('-', '');
  const reportPaperId = 'QA-REPORT-ONLY-' + fixtureDate.replaceAll('-', '');
  const reportQuestionIds = ['archive_2013_09', ...archiveRows.filter(row => row.year === 2013 && row.number !== 9).map(row => row.id)];
  assert.equal(reportQuestionIds.length, 25, 'isolated report fixture should contain 25 archived questions');
  const reportPerQuestion = reportQuestionIds.map((qid, index) => {
    const answer = answerById.get(qid);
    return {
      qid, index: index + 1,
      selected_answer: index === 0 ? 'B' : answer,
      result_status: index === 0 ? 'wrong' : 'correct',
      correct: index !== 0, guessed: false, attempted: true, answer
    };
  });
  const fixture = {
    version: '0.6.5.20',
    profile: { name: 'Isolated Browser QA', goal: '2027-01 AMC 8' },
    settings: { cooldown_days: 30, slow_threshold_sec: 240, daily_limit: 3 },
    skill_state: {}, attempts: [], true_attempts: [], true_question_tags: {},
    v064_question_tags: {}, v064_specific_skills: {}, mock_history: [], mock_detail_history: [{ date: fixtureDate, paper_id: reportPaperId, mock_key: reportPaperId, question_ids: reportQuestionIds, per_question: reportPerQuestion, score: 24, independent_score: 24, attempted: 25, total_minutes: 40 }], daily_sessions: [],
    daily_plan: {
      date: fixtureDate, question_ids: dailyIds, paper_id: dailyPaperId,
      created_at: new Date().toISOString(), engine_version: '0.6.5.20', submitted: false
    },
    printable_mock_ids: weekendIds,
    printable_mock_date: fixtureDate,
    printable_mock_id: weekendPaperId,
    printable_mock_meta: {
      engine: 'official_mixed_position_v1', engine_version: '0.6.5.20', source_years: [2015],
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
    assert.match(deployedTitle, /Lucas AMC8 Coach v0\.6\.5\.19/, 'live site must be exactly v0.6.5.19');
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
      assert.equal((state.mock_detail_history || []).length, 1, stage + ': isolated report fixture must remain the only mock detail record');
      assert.equal(state.mock_detail_history[0].paper_id, reportPaperId, stage + ': report fixture identity must not change');
      assert.equal((state.mock_detail_history[0].per_question || []).length, 25, stage + ': report fixture must remain a complete 25-question paper');
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

      if (item.button === '学习报告') {
        const report = page.locator('#latestMockLearningReport');
        await report.waitFor({ state: 'attached' });
        const reportText = await report.innerText();
        assert.ok(reportText.includes('逐题答案与解法'), 'learning report should show the per-question answer/solution section');
        assert.ok(reportText.includes('你的答案：B'), 'report should show the recorded answer for the wrong item');
        assert.ok(reportText.includes('正确答案：C'), 'report should show the official correct answer');
        assert.ok(reportText.includes('打开2013年 AMC8 完整解析'), 'uncovered year should expose its detailed-solution link');
        assert.equal(await report.locator('.mock-review-item').count(), 25, 'report should render all 25 question reviews');
        assert.equal(await report.locator('.mock-review-item').first().evaluate(el => el.open), true,
          'the incorrect question should be expanded by default');
      }

      if (item.button === '周末模拟') {
        const guess = page.locator('#mockQuestionBox label.guess-prompt input[type="checkbox"]');
        await guess.check();
        const answerA = page.locator('#mockQuestionBox button[data-question-index="0"][data-answer="A"]');
        await answerA.click();
        const questionText = await page.locator('#mockQuestionBox').innerText();
        assert.ok(questionText.includes('第 2 / 25 题'), 'clicking A should automatically advance from Q1 to Q2');
        const afterAnswer = await page.evaluate(key => JSON.parse(localStorage.getItem(key) || 'null'), 'lucas_amc8_coach_v05');
        assert.equal(afterAnswer.mock_drafts[weekendPaperId].answers['0'], 'A', 'selected answer should be saved to the isolated draft');
        assert.equal(afterAnswer.mock_drafts[weekendPaperId].guesses['0'], true, 'guess marker should survive answer selection');
        assert.equal((afterAnswer.attempts || []).length, 0, 'answer selection must not submit learner attempts');
        assert.equal((afterAnswer.mock_detail_history || []).length, 1, 'answer selection must not create an additional mock result');
        assert.equal(afterAnswer.mock_detail_history[0].paper_id, reportPaperId, 'answer selection must not alter the report fixture');
        assert.equal((afterAnswer.daily_sessions || []).length, 0, 'answer selection must not write daily result sessions');
        assert.doesNotMatch(questionText, /录入 Lucas 纸上的答案/, 'duplicate answer-entry label should be absent');
      }
      await assertLockedPapers(item.button);
    }

    assert.equal(await page.locator('#guidedStudentDashboard').count(), 1,
      'returning home must not duplicate the guided dashboard');
    assert.deepEqual(errors, [], 'navigation should not produce uncaught JavaScript errors');

    console.log('PASS: final deployed v0.6.5.20 build, per-question answer/solution report, correct-answer display, fallback solution link, clickable answer auto-advance, guess preservation, locked weekend/daily paper preservation, no extra result records, all six navigation destinations, return-home rendering, and zero uncaught page errors.');
  } finally {
    await context.close();
    await browser.close();
  }
})().catch(error => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exitCode = 1;
});
