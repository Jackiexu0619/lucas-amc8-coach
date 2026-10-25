'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { selectArchiveMock, DEFAULT_PERSONALIZED_POSITIONS } = require('./coach_mock_assembly_v06514.js');

function makeArchive(years) {
  return years.flatMap(function(year) {
    return Array.from({ length: 25 }, function(_, i) {
      const n = i + 1;
      return {
        id: 'archive_' + year + '_' + String(n).padStart(2, '0'),
        year: year,
        problem_number: n
      };
    });
  });
}

const years = Array.from({ length: 27 }, function(_, i) { return 2000 + i; }).filter(function(y) { return y !== 2021; });
const archive = makeArchive(years);
const baseline = selectArchiveMock({ archive: archive, random: function() { return 0.5; } });

assert.equal(baseline.ok, true, 'baseline paper should build');
assert.equal(baseline.chosen.length, 25, 'paper must contain 25 questions');
assert.equal(new Set(baseline.chosen.map(function(q) { return q.id; })).size, 25, 'questions must be unique');
baseline.chosen.forEach(function(q, i) {
  assert.equal(q.problem_number, i + 1, 'paper position must preserve original AMC8 question number');
});
assert.deepEqual(baseline.summary.personalized_positions, DEFAULT_PERSONALIZED_POSITIONS, 'seven configured personalized positions should remain stable');

const reservedYears = new Set([2017, 2018, 2019, 2020, 2022, 2023]);
const personalizedArchive = archive.filter(function(q) { return !reservedYears.has(q.year); });
const reservedProtected = selectArchiveMock({ archive: personalizedArchive, random: function() { return 0.5; } });
assert.equal(reservedProtected.ok, true, 'personalized selector should still build with diagnostic years reserved');
assert.equal(reservedProtected.chosen.some(function(q) { return reservedYears.has(q.year); }), false, 'personalized papers must not consume years reserved for full-year diagnostics');


const attemptedAndRecent = selectArchiveMock({
  archive: archive,
  attemptedIds: ['archive_2000_01', 'archive_2002_01'],
  recentIds: ['archive_2001_01'],
  random: function() { return 0.5; }
});
assert.equal(attemptedAndRecent.ok, true);
assert.notEqual(attemptedAndRecent.chosen[0].id, 'archive_2000_01', 'attempted question should be avoided when fresh candidates exist');
assert.notEqual(attemptedAndRecent.chosen[0].id, 'archive_2001_01', 'recent question should be avoided when fresh candidates exist');
assert.equal(attemptedAndRecent.selection[0].fallback, 'fresh');

const weakId = 'archive_2000_05';
const weaknessWeighted = selectArchiveMock({
  archive: archive,
  weaknessScoreById: { [weakId]: 100 },
  random: function() { return 0.5; }
});
assert.equal(weaknessWeighted.chosen[4].id, weakId, 'a strong same-method candidate should win at a personalized position even when its source year was already used');
assert.equal(weaknessWeighted.selection[4].personalized, true);
assert.equal(weaknessWeighted.selection[4].matched_weekly_weakness, true);

const nonPersonalized = selectArchiveMock({
  archive: archive,
  weaknessScoreById: { 'archive_2005_01': 100 },
  random: function() { return 0.5; }
});
assert.equal(nonPersonalized.chosen[0].id, 'archive_2000_01', 'weakness weighting must not alter non-personalized positions');
assert.equal(nonPersonalized.selection[0].personalized, false);
assert.equal(nonPersonalized.selection[0].weakness_score, 0);

const positionOne = archive.filter(function(q) { return q.problem_number === 1; }).map(function(q) { return q.id; });
const fallback = selectArchiveMock({
  archive: archive,
  attemptedIds: positionOne,
  recentIds: positionOne,
  random: function() { return 0.5; }
});
assert.equal(fallback.ok, true, 'last-resort fallback should still produce a complete paper');
assert.equal(fallback.selection[0].fallback, 'last_resort_recent', 'recent reuse should only occur after alternatives are exhausted');
assert.equal(new Set(fallback.chosen.map(function(q) { return q.id; })).size, 25);

const missingPosition = selectArchiveMock({
  archive: archive.filter(function(q) { return q.problem_number !== 13; }),
  random: function() { return 0.5; }
});
assert.equal(missingPosition.ok, false);
assert.equal(missingPosition.reason, 'missing-position-13');

const html = fs.readFileSync(path.join(__dirname, 'index.html'), 'utf8');
const coach = fs.readFileSync(path.join(__dirname, 'coach_v064.js'), 'utf8');
const closure = fs.readFileSync(path.join(__dirname, 'coach_learning_closure_v06514.js'), 'utf8');
const changelog = fs.readFileSync(path.join(__dirname, 'CHANGELOG.md'), 'utf8');
assert.equal((html.match(/function buildPrintableMockCore\s*\(/g) || []).length, 1, 'only one active buildPrintableMockCore definition may exist');
assert.match(html, /coach_mock_assembly_v06514\.js\?v=0\.6\.5\.(14|16|17|18|19|20|21)/, 'new selector module must be cache-busted and loaded');
assert.match(html, /function archiveWeaknessScore\s*\(/, 'application must calculate a same-method weakness score');
assert.match(closure, /const result=selectArchivePaper\(\{bank,state,tagMap,weakRecords:records,today:/, 'the final active picker must invoke the tested learning-closure selector');
assert.match(html, /weekly_weakness_coverage/, 'mock metadata must retain traceable weakness coverage');
assert.match(html, /coach_v064\.js\?v=0\.6\.5\.(14|16|17|18|19|20|21)/, 'the production override must be cache-busted');
assert.match(coach, /buildArchiveMockCore\(\{\s*archive:allowedArchive,reservedYears:RESERVED_YEARS\}\)/, 'production personalized mode must pass the filtered archive and reserved years');
assert.match(closure, /archivePaperPicker=function\(options=\{\}\)/, 'the final active picker override must accept options');
assert.match(closure, /const sourceBank=Array\.isArray\(options\.archive\)\?options\.archive/, 'the final active picker must honor the filtered candidate archive');
assert.match(closure, /buildArchiveMockCore=function\(options=\{\}\)/, 'the final active builder must preserve the options contract');
assert.match(closure, /archivePaperPicker\(\{archive:bank,reservedYears:\[\.\.\.reservedYears\]\}\)/, 'the final active builder must pass reserved years into the final active picker');
assert.match(closure, /reserved_years_excluded:\[\.\.\.reservedYears\]/, 'selection metadata must record the reserved-year protection');
assert.match(coach, /wrong\.length<=1&&slow\.length<=1/, 'slow evidence must prevent a skill from being prematurely marked stable');
assert.match(coach, /wrong\.length>=2\|\|slow\.length>=2/, 'repeated slow evidence must trigger additional practice');
assert.match(coach, /chosen=pickDiagnostic\(\)/, 'full-year diagnostic mode must remain independent');
assert.match(coach, /paper_type:'personalized_practice'/, 'personalized mock type must be preserved for submission history');
assert.match(coach, /paper_type:'diagnostic'/, 'diagnostic paper type must remain explicit');
assert.match(html, /const ENGINE_VERSION='0\.6\.5\.(14|15|16|17|18|19|20|21)'/, 'engine version must remain synchronized with the active page release');
assert.match(changelog, /v0\.6\.5\.14/, 'changelog must record this release');
assert.doesNotMatch(html, /0\.6\.5\.13/, 'old version/cache keys should not remain in the active page');

console.log('PASS: AMC8 weakness-aware weekend mock assembly QA');
