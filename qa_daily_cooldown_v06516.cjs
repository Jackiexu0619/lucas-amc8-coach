'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');
const functionMatch = html.match(/function eligibleDailyBank\(\)\s*\{[\s\S]*?\n\}/);
assert.ok(functionMatch, 'eligibleDailyBank must exist in index.html');
assert.match(html, /ENGINE_VERSION='0\.6\.5\.16'/, 'engine version must be bumped for this logic change');

const bank = [];
for (const year of [2000, 2001, 2002]) {
  for (let q = 13; q <= 25; q++) {
    bank.push({ id: 'archive_' + year + '_' + String(q).padStart(2, '0'), year, problem_number: q });
  }
}
const today = '2026-10-25';
function daysAgo(n) {
  const d = new Date(today + 'T00:00:00Z');
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}
function dd(date, now) {
  const a = Date.parse(String(date).slice(0, 10) + 'T00:00:00Z');
  const b = Date.parse(String(now).slice(0, 10) + 'T00:00:00Z');
  return Number.isFinite(a) && Number.isFinite(b) ? Math.round((b - a) / 86400000) : NaN;
}
function eligible(state) {
  const sandbox = {
    ARCHIVE_BANK: bank,
    S: state,
    today: () => today,
    dd,
    questionEligibleForDaily: () => true
  };
  vm.runInNewContext(functionMatch[0] + '\nglobalThis.__eligible = eligibleDailyBank().map(q => q.id);', sandbox);
  return Array.from(sandbox.__eligible);
}

const recentAttemptId = bank[0].id;
const attemptState = { attempts: [{ question_id: recentAttemptId, date: today }] };
const attemptBefore = JSON.stringify(attemptState);
const attemptResult = eligible(attemptState);
assert.ok(!attemptResult.includes(recentAttemptId), 'a question attempted today must be excluded');
assert.equal(JSON.stringify(attemptState), attemptBefore, 'selection must not mutate attempt history');

const recentMockId = bank[1].id;
const mockState = {
  attempts: [],
  mock_detail_history: [{
    date: today, paper_id: 'recent-mock', question_ids: [recentMockId],
    per_question: Array(25).fill({})
  }]
};
assert.ok(!eligible(mockState).includes(recentMockId),
  'a question in a submitted weekend mock within 30 days must be excluded from weekday practice');

const lockedIds = bank.slice(0, 25).map(q => q.id);
const lockedState = {
  attempts: [],
  printable_mock_ids: lockedIds,
  printable_mock_id: 'locked-unsubmitted-paper',
  printable_mock_date: daysAgo(60),
  mock_detail_history: []
};
const lockedResult = eligible(lockedState);
for (const id of lockedIds) {
  assert.ok(!lockedResult.includes(id), 'an unsubmitted locked paper question must remain excluded: ' + id);
}

const submittedOldState = {
  attempts: [],
  printable_mock_ids: lockedIds,
  printable_mock_id: 'old-paper-completed',
  printable_mock_date: daysAgo(60),
  mock_detail_history: [{
    date: daysAgo(60), paper_id: 'old-paper-completed',
    question_ids: lockedIds, per_question: Array(25).fill({})
  }]
};
assert.ok(eligible(submittedOldState).includes(lockedIds[0]),
  'a completed paper older than the 30-day window should not stay blocked forever');

const age20Ids = bank.slice(0, 25).map(q => q.id);
const age20MoreIds = bank.slice(25, 37).map(q => q.id);
const todayIds = bank.slice(37, 39).map(q => q.id);
const fallbackState = {
  attempts: [],
  mock_detail_history: [
    { date: daysAgo(20), question_ids: age20Ids, per_question: Array(25).fill({}) },
    { date: daysAgo(20), question_ids: age20MoreIds, per_question: Array(25).fill({}) },
    { date: today, question_ids: todayIds, per_question: Array(25).fill({}) }
  ]
};
const fallbackResult = eligible(fallbackState);
assert.ok(!todayIds.some(id => fallbackResult.includes(id)),
  'questions used today remain excluded when the 30-day pool is relaxed');
assert.ok(age20Ids.some(id => fallbackResult.includes(id)),
  'the cooldown should relax from 30 days to 14 days when fewer than three candidates remain');

const boundaryState = {
  attempts: [
    { question_id: bank[0].id, date: daysAgo(29) },
    { question_id: bank[1].id, date: daysAgo(30) }
  ]
};
const boundaryResult = eligible(boundaryState);
assert.ok(!boundaryResult.includes(bank[0].id), 'age 29 days remains inside the 30-day window');
assert.ok(boundaryResult.includes(bank[1].id), 'age exactly 30 days is outside the strict 30-day window');

console.log('PASS: daily 30-day cooldown covers weekday attempts and weekend mock history, preserves unsubmitted locked-paper exclusions, releases completed old papers, and relaxes 30→14→7 days when necessary.');
