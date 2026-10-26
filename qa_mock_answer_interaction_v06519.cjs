const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

const html = fs.readFileSync('index.html', 'utf8');

function between(start, end) {
  const a = html.indexOf(start);
  const b = html.indexOf(end, a);
  assert.ok(a >= 0 && b > a, `function boundary missing: ${start} -> ${end}`);
  return html.slice(a, b);
}

const chooseSource = between('function chooseDraftAndAdvance(i,v){', 'function setDraftGuess(i,v){');
const choiceSource = between('function mockChoiceButtonsHtml(i,q){', 'function renderMockQuestion(){');
const renderSource = between('function renderMockQuestion(){', 'function renderFullMockPreview(){');
const previewSource = between('function renderFullMockPreview(){', 'function regeneratePrintableMock(){');

assert.match(html, /Lucas AMC8 Coach v0\.6\.5\.23/);
assert.doesNotMatch(html, /录入 Lucas 纸上的答案/);
assert.doesNotMatch(html, /function answerButtonsHtml\(i\)/);
assert.match(html, /function chooseDraftAndAdvance\(i,v\)/);
assert.match(renderSource, /mockChoiceButtonsHtml\(mockEntryIndex,q\)/);
assert.match(previewSource, /mockChoiceButtonsHtml\(i,q\)/);
assert.doesNotMatch(renderSource, /answerButtonsHtml/);
assert.doesNotMatch(previewSource, /answerButtonsHtml/);

const questions = Array.from({ length: 25 }, (_, i) => ({
  id: 'qa_' + i,
  domain: '综合',
  skill: '测试知识点',
  year: 2013,
  problem_number: i + 1,
  archive_image: i === 8 ? 'question-9.webp' : null,
  choices: i === 8 ? ['A', 'B', 'C', 'D', 'E'] : ['9th', '10th', '11th', '12th', '13th'],
  answer: 'C'
}));
const draft = { answers: {}, guesses: { '8': true }, total_minutes: null };
const box = { innerHTML: '' };
const fullBox = { innerHTML: '' };
let saveCalls = 0;
const context = {
  questions,
  draft,
  box,
  fullBox,
  document: {
    getElementById(id) {
      if (id === 'mockQuestionBox') return box;
      if (id === 'fullMockPreview') return fullBox;
      return null;
    }
  },
  printableMock: () => questions,
  currentDraft: () => draft,
  saveDraft: () => { saveCalls++; },
  draftAnswer: i => draft.answers[String(i)] || '',
  draftGuess: i => !!draft.guesses[String(i)],
  draftCount: () => Array.from({ length: 25 }, (_, i) => draft.answers[String(i)] ? 1 : 0).reduce((a, b) => a + b, 0),
  setDraftGuess: (i, value) => { draft.guesses[String(i)] = !!value; },
  zhDomain: value => value || '未标注',
  zhSkill: value => value || '未标注',
  questionPromptHtml: q => q.archive_image ? '<img class="archive-paper-img" alt="question image">' : '<div class="en-main">Question text</div>',
  figureHtml: () => '',
  choiceDisplay: value => String(value),
  console
};
vm.createContext(context);
vm.runInContext(`
let mockEntryIndex = 8;
${chooseSource}
${choiceSource}
${renderSource}
${previewSource}
`, context);

vm.runInContext('renderMockQuestion()', context);
assert.match(box.innerHTML, /data-answer="A"/);
assert.match(box.innerHTML, /onclick="chooseDraftAndAdvance\(8,'A'\)"/);
assert.doesNotMatch(box.innerHTML, /A\. A/);
assert.doesNotMatch(box.innerHTML, /录入 Lucas 纸上的答案/);
assert.match(box.innerHTML, /这题是猜的/);
assert.match(box.innerHTML, /点击选项直接作答/);
assert.match(box.innerHTML, /不会/);
assert.match(box.innerHTML, /未做，跳过本题/);

// Image-based historical questions use one compact A-E control row rather than “A. A”.
const letterRow = box.innerHTML.match(/<div class="choice-letter-grid"[\s\S]*?<\/div>/)?.[0] || '';
assert.match(letterRow, />A<\/button>/);
assert.match(letterRow, />E<\/button>/);
assert.doesNotMatch(letterRow, /A\. A/);

// Structured questions expose their actual choice text as the clickable option.
vm.runInContext('mockEntryIndex = 0; renderMockQuestion()', context);
assert.match(box.innerHTML, /A\.<\/span> 9th/);
assert.match(box.innerHTML, /data-answer="C"/);

// Selecting an answer saves it, preserves the guess marker, and immediately advances.
vm.runInContext("chooseDraftAndAdvance(8,'C')", context);
assert.equal(draft.answers['8'], 'C');
assert.equal(draft.guesses['8'], true);
assert.equal(vm.runInContext('mockEntryIndex', context), 9);
assert.match(box.innerHTML, /第 10 \/ 25 题/);
assert.equal(saveCalls, 1);
assert.match(fullBox.innerHTML, /chooseDraftAndAdvance\(8,'A'\)/);
assert.doesNotMatch(fullBox.innerHTML, /A\. A/);

// “不会” and “未做” are distinct and also advance; neither remains marked as a guess.
vm.runInContext("mockEntryIndex = 10; draft.guesses['10'] = true; chooseDraftAndAdvance(10,'N')", context);
assert.equal(draft.answers['10'], 'N');
assert.equal(draft.guesses['10'], false);
assert.equal(vm.runInContext('mockEntryIndex', context), 11);
vm.runInContext("chooseDraftAndAdvance(11,'X')", context);
assert.equal(draft.answers['11'], 'X');
assert.equal(vm.runInContext('mockEntryIndex', context), 12);

// Q25 stays in view after the final action and gives a clear completion instruction.
vm.runInContext(`
for (let i = 0; i < 24; i++) draft.answers[String(i)] = 'A';
mockEntryIndex = 24;
chooseDraftAndAdvance(24, 'X');
`, context);
assert.equal(vm.runInContext('mockEntryIndex', context), 24);
assert.match(box.innerHTML, /25题已录完/);
assert.match(box.innerHTML, /填写整卷实际用时，再提交整套记录/);

console.log('PASS: single clickable answer UI, no duplicate A. A controls, auto-advance, guess preservation, distinct unable/skip actions, preview consistency, and Q25 completion state.');
