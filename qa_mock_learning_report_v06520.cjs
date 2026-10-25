'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');

assert.match(html, /Lucas AMC8 Coach v0\.6\.5\.20/, 'page version must be v0.6.5.20');
assert.match(html, /const AUTHENTIC_CACHE_KEY='lucas_amc8_authentic_bank_v064_solution_report'/,
  'solution cache must be versioned so older cache entries without solutions are refreshed');
assert.match(html, /function normalizeSolutionRows\(data\)/,
  'source solution records should be normalized separately from the 2015-2018 training bank');
assert.match(html, /SOLUTION_BANK=new Map\(\(solutionRows\|\|\[\]\)\.map/,
  'the loaded solution records should be indexed by year and question number');
assert.match(html, /SOLUTION_CHOICE_BANK=new Map/,
  'answer option text should be indexed when the source dataset provides it');
assert.match(html, /solution_html:SOLUTION_BANK\.get\(solutionKey\(r\.year,r\.number\)\)\|\|''/,
  'archive questions should receive matching worked solutions when available');
assert.match(html, /function renderLatestMockInsightsIntoReport\(\)/);
assert.match(html, /逐题答案与解法/, 'the learning report must have a dedicated per-question review section');
assert.match(html, /你的答案：/);
assert.match(html, /正确答案：/);
assert.match(html, /标准答案/);
assert.match(html, /考点：/);
assert.match(html, /解题方法：/);
assert.match(html, /详细解法（解答资料原文）/);
assert.match(html, /本地题库暂未保存这道题的完整推导/,
  'the report must be honest when a full local solution is unavailable');
assert.match(html, /live\.poshenloh\.com\/past-contests\/amc8\//,
  'uncovered questions must retain a year-level full-solution link');
assert.match(html, /sanitizeSolutionHtml\(raw\)/);
assert.match(html, /attr\.value\.trim\(\)\.toLowerCase\(\)\.startsWith\('javascript:'\)/,
  'solution HTML sanitization must reject javascript URLs');
assert.match(html, /答错、不会、未做和猜对的题默认展开/);
assert.match(html, /function mockReviewStatus\(r\)/);
assert.match(html, /function mockReviewChoicePlain\(value\)/);
assert.match(html, /猜对 · 待确认掌握/);
assert.match(html, /本题结果/);
assert.match(html, /复盘动作/);

// Run the actual normalizer used by the page against representative source data.
const start = html.indexOf('function solutionKey(year,number){');
const end = html.indexOf('function archiveQuestion(r){', start);
assert.ok(start >= 0 && end > start, 'solution key and normalizer helpers should be extractable');
const helperSource = html.slice(start, end) + '\nnormalizeSolutionRows';
const normalizeSolutionRows = vm.runInNewContext(helperSource, {});
const rows = normalizeSolutionRows({
  '2013 AMC 8 #9': { test: [2013, 8], number: 9, solutions: ['', '<p>Verified solution</p>', '<p>Alternative</p>'], choices: ['9th','10th','11th','12th','13th'] },
  '2014 AMC 8 #1': { test: [2014, 8], number: 1, solutions: [] },
  '2018 AMC 8 #2': { test: [2018, 8], number: 2, solutions: ['<p>Second test solution</p>'], choices: ['1','2','3','4','5'] },
  'broken': { test: ['not-a-year', 8], number: 2, solutions: ['<p>Bad</p>'] }
});
assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
  { year: 2013, problem_number: 9, solution_html: '<p>Verified solution</p>', choices: ['9th','10th','11th','12th','13th'] },
  { year: 2018, problem_number: 2, solution_html: '<p>Second test solution</p>', choices: ['1','2','3','4','5'] }
]);
const solutionKey = vm.runInNewContext(html.slice(start, end) + '\nsolutionKey', {});
assert.equal(solutionKey(2013, 9), '2013_9');

// Render a representative full-paper report to verify actual output, not only source markers.
const reportStart = html.indexOf('function renderLatestMockInsightsIntoReport(){');
const reportEnd = html.indexOf('function renderDailyReviewIntoReport(){', reportStart);
assert.ok(reportStart >= 0 && reportEnd > reportStart, 'the latest-mock report renderer should be extractable');
const reportSource = html.slice(reportStart, reportEnd);
const answerHelperStart = html.indexOf('function mockReviewChoicePlain(value){');
const answerHelperEnd = html.indexOf('function mockReviewStatus(r){', answerHelperStart);
assert.ok(answerHelperStart >= 0 && answerHelperEnd > answerHelperStart, 'answer display helpers should be extractable');
const answerHelpers = vm.runInNewContext(html.slice(answerHelperStart, answerHelperEnd) + '\n({ mockReviewChoicePlain, mockReviewAnswerText })', {});
assert.equal(answerHelpers.mockReviewChoicePlain('\\\\frac{1}{2}'), '1/2');
assert.equal(answerHelpers.mockReviewAnswerText({archive_image:'x.webp',choice_texts:['9th','10th','11th','12th','13th']}, 'C'), 'C. 11th');
const questionMap = new Map();
for (let i = 0; i < 25; i++) {
  questionMap.set('q' + i, {
    id: 'q' + i,
    year: i === 0 ? 2013 : 2018,
    problem_number: i + 1,
    answer: i === 0 ? 'C' : 'A',
    archive_image: 'assets/test_' + i + '.webp',
    choice_texts: i === 0 ? ['9th','10th','11th','12th','13th'] : null,
    domain: 'misc',
    skill: 'archive_unclassified_' + (i + 1),
    core_method: 'archive_method_' + (i + 1),
assert.match(rendered, /Compare powers of two: 2\^9=512 and 2\^10=1024/);
    solution_source_url: 'https://live.poshenloh.com/past-contests/amc8/' + (i === 0 ? 2013 : 2018) + '/solutions'
  });
}
const mockPerQuestion = Array.from({ length: 25 }, (_, i) => ({
  qid: 'q' + i,
  index: i + 1,
  selected_answer: i === 0 ? 'B' : 'A',
  result_status: i === 0 ? 'wrong' : 'correct',
  correct: i !== 0,
  guessed: false,
  attempted: true,
  answer: i === 0 ? 'C' : 'A'
}));
const reportHost = { appended: null, appendChild(node) { this.appended = node; } };
const reportContext = {
  S: { mock_detail_history: [{
    date: '2026-10-25', paper_id: 'QA-MOCK', question_ids: Array.from({ length: 25 }, (_, i) => 'q' + i),
    per_question: mockPerQuestion, score: 24, independent_score: 24, attempted: 25, total_minutes: 40
  }] },
  SOLUTION_BANK: new Map(),
  document: {
    getElementById(id) { return id === 'report' ? reportHost : null; },
    createElement() { return { className: '', style: {}, id: '', innerHTML: '' }; }
  },
  qById(id) { return questionMap.get(id); },
  learningTags(q) { return { topic: q.id === 'q0' ? '指数规律' : '组合', skill: q.id === 'q0' ? '幂的比较' : '', method: q.id === 'q0' ? '比较相邻的2的幂' : '', groupKey: '' }; },
  zhDomain(x) { return x || '未标注'; },
  zhSkill(x) { return x || '未标注'; },
  esc(x) { return String(x ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); },
  solutionKey(year, number) { return String(Number(year)) + '_' + String(Number(number)); },
  sanitizeSolutionHtml(raw) { return String(raw || ''); },
  mockReviewPromptHtml(q) { return '<img src="' + q.archive_image + '">'; },
  mockReviewPromptChoicesHtml() { return ''; },
  mockReviewAnswerText: answerHelpers.mockReviewAnswerText,
  mockReviewStatus(r) { return r.result_status === 'wrong' ? '答错' : r.guessed ? '猜对 · 待确认掌握' : '独立答对'; },
  console
};
vm.createContext(reportContext);
vm.runInContext(reportSource + '\nrenderLatestMockInsightsIntoReport()', reportContext);
const rendered = reportHost.appended?.innerHTML || '';
assert.match(rendered, /逐题答案与解法/);
assert.match(rendered, /你的答案：B/);
assert.match(rendered, /正确答案：C/);
assert.match(rendered, /B\. 10th/);
assert.match(rendered, /C\. 11th/);
assert.match(rendered, /Compare powers of two: 2\^9=512 and 2\^10=1024/);
assert.match(rendered, /本地题库暂未保存这道题的完整推导/);
assert.match(rendered, /打开2018年 AMC8 完整解析/);
assert.equal((rendered.match(/class="mock-review-item"/g) || []).length, 25, 'all 25 questions should appear in the report');
assert.match(rendered, /<details class="mock-review-item" open>/, 'the incorrect question should be expanded by default');

console.log('PASS: per-question answer report, solution-bank indexing, source fallback links, honest missing-solution state, safe HTML, and solution normalization.');
