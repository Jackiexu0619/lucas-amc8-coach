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
  '2013 AMC 8 #9': { test: [2013, 8], number: 9, solutions: ['', '<p>Verified solution</p>', '<p>Alternative</p>'] },
  '2014 AMC 8 #1': { test: [2014, 8], number: 1, solutions: [] },
  '2018 AMC 8 #2': { test: [2018, 8], number: 2, solutions: ['<p>Second test solution</p>'] },
  'broken': { test: ['not-a-year', 8], number: 2, solutions: ['<p>Bad</p>'] }
});
assert.deepEqual(JSON.parse(JSON.stringify(rows)), [
  { year: 2013, problem_number: 9, solution_html: '<p>Verified solution</p>' },
  { year: 2018, problem_number: 2, solution_html: '<p>Second test solution</p>' }
]);
const solutionKey = vm.runInNewContext(html.slice(start, end) + '\nsolutionKey', {});
assert.equal(solutionKey(2013, 9), '2013_9');

console.log('PASS: per-question answer report, solution-bank indexing, source fallback links, honest missing-solution state, safe HTML, and solution normalization.');
