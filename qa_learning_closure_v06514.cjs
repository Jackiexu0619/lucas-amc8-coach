'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {resolveTags,selectArchivePaper,classifyMatch}=require('./coach_learning_closure_v06514.js');
const data=JSON.parse(fs.readFileSync('coach_skill_bank.json','utf8'));
assert.equal(data.questions.length,575);
const ids=new Set();
for(const row of data.questions){
  assert.ok(/^archive_\d{4}_\d{2}$/.test(row.id));
  assert.ok(!ids.has(row.id));ids.add(row.id);
  assert.equal(row.quality_gate,'pdf_explanation_reviewed');
  assert.ok(row.reviewed_skill&&row.reviewed_method&&row.group_key);
}
assert.equal(ids.size,575);
const years=[2015,2016,2017,2018],bank=[],tagMap=new Map();
for(const year of years)for(let pos=1;pos<=25;pos++){
  const id='archive_'+year+'_'+String(pos).padStart(2,'0');
  bank.push({id,year,problem_number:pos,domain:'misc',skill:'archive_unclassified_'+year+'_'+pos,core_method:'archive_method_'+year+'_'+pos});
  tagMap.set(id,{id,quality_gate:'pdf_explanation_reviewed',reviewed_skill:'Skill '+year+' Q'+pos,
    reviewed_method:'Method '+year+' Q'+pos,group_key:'group_'+year+'_'+pos,source_topic:'topic '+pos,math_independently_verified:false});
}
const sourceId='archive_2015_05',targetId='archive_2016_05';
tagMap.set(sourceId,{id:sourceId,quality_gate:'pdf_explanation_reviewed',reviewed_skill:'概率与补集',
  reviewed_method:'先算反面事件',group_key:'probability_complement',source_topic:'概率',math_independently_verified:false});
tagMap.set(targetId,{id:targetId,quality_gate:'pdf_explanation_reviewed',reviewed_skill:'概率与补集',
  reviewed_method:'用补集求至少一个事件',group_key:'probability_complement',source_topic:'概率',math_independently_verified:false});
const state={printable_mock_ids:[],attempts:[{question_id:sourceId,date:'2026-10-23',source:'paper_daily',correct:false,guessed:false,result_status:'wrong'}],
  mock_detail_history:[{date:'2026-10-20',question_ids:['archive_2017_10']}],v064_question_tags:{},v064_specific_skills:{}};
const source=bank.find(q=>q.id===sourceId),weakTags=resolveTags(source,state,tagMap);
const weakRecords=[
  {question_id:sourceId,date:'2026-10-23',age:1,severity:1,reason:'答错/方法没想到',tags:weakTags},
  {question_id:'unknown_question',date:'2026-10-23',age:1,severity:1,reason:'未映射',tags:{}}
];
const result=selectArchivePaper({bank,state,tagMap,weakRecords,today:'2026-10-24',tagBankStatus:'ready',randomFn:()=>0.5});
assert.ok(result);
assert.equal(result.questions.length,25);
assert.equal(new Set(result.questions.map(q=>q.id)).size,25);
assert.ok(result.questions.every((q,i)=>q.problem_number===i+1));
assert.equal(result.questions[4].id,targetId,'personalized Q5 must favor same reviewed method group');
assert.notEqual(result.questions[9].id,'archive_2017_10','avoid recent mock question when alternatives exist');
assert.deepEqual(result.meta.personalized_positions,[5,9,12,15,18,21,24]);
assert.equal(result.meta.weekly_weakness_attempt_count,2);
assert.equal(result.meta.weekly_weakness_mapped_count,1);
assert.equal(result.meta.weekly_weakness_unmapped_count,1);
const q5=result.meta.weekly_weakness_coverage.find(x=>x.position===5);
assert.ok(q5&&q5.matched);
assert.equal(q5.matches[0].match_type,'同标签组（题库标注）');
const none=selectArchivePaper({bank,state:{printable_mock_ids:[],attempts:[],mock_detail_history:[]},tagMap:new Map(),
  weakRecords:[{question_id:'unknown_question',age:0,severity:1,tags:{}}],today:'2026-10-24',tagBankStatus:'failed',randomFn:()=>0.5});
assert.equal(none.meta.weekly_weakness_mapped_count,0);
assert.equal(none.meta.weekly_weakness_unmapped_count,1);
assert.ok(none.meta.weekly_weakness_coverage.every(x=>x.matches.length===0));
assert.equal(classifyMatch({method:'方法甲',groupKey:'a'},{method:'方法甲',groupKey:'b'}).type,'同解法描述');

const reservedYears = [2017, 2018];
const personalizedBank = bank.filter(q => !reservedYears.includes(q.year));
const reservedState = { printable_mock_ids: [], attempts: [], mock_detail_history: [], v064_question_tags: {}, v064_specific_skills: {} };
const reservedResult = selectArchivePaper({
  bank: personalizedBank, state: reservedState, tagMap, weakRecords,
  today: '2026-10-24', tagBankStatus: 'ready', reservedYears, randomFn: () => 0.5
});
assert.ok(reservedResult && reservedResult.questions.length === 25);
assert.equal(reservedResult.questions.some(q => reservedYears.includes(q.year)), false, 'personalized selection must not consume reserved full-year diagnostic papers');
assert.deepEqual(reservedResult.meta.reserved_years_excluded, reservedYears);

const q1Ids = bank.filter(q => q.problem_number === 1).map(q => q.id);
const fallbackResult = selectArchivePaper({
  bank, state: { printable_mock_ids: q1Ids, attempts: [], mock_detail_history: [] },
  tagMap, weakRecords: [], today: '2026-10-24', tagBankStatus: 'ready', randomFn: () => 0.5
});
assert.ok(fallbackResult);
assert.ok(fallbackResult.meta.recent_exclusion_fallback_positions.includes(1), 'recent exclusion relaxation must be recorded when every Q1 candidate is recent');

const index = fs.readFileSync('index.html', 'utf8');
const coach = fs.readFileSync('coach_v064.js', 'utf8');
const closure = fs.readFileSync('coach_learning_closure_v06514.js', 'utf8');
assert.match(coach, /buildArchiveMockCore\(\{\s*archive:allowedArchive,reservedYears:RESERVED_YEARS\}\)/, 'the real personalized-mode override must call the adaptive selector');
assert.match(coach, /chosen=pickDiagnostic\(\)/, 'full-year diagnostic mode must remain independent');
assert.match(index, /const built=buildPrintableMockCore\(\);\s*if\(!built\)return;/, 'a failed build must not allocate a new paper ID over the existing paper');
assert.match(index, /coach_v064\.js\?v=0\.6\.5\.15/, 'production override must be cache-busted');
assert.match(index, /coach_learning_closure_v06514\.js\?v=0\.6\.5\.15/, 'adaptive selector must be cache-busted');
assert.match(closure, /function buildArchiveMockCore\(options=\{\}\)/, 'adaptive selector must accept the filtered personalized bank');
assert.match(closure, /recent_exclusion_fallback_positions:fallbackPositions/, 'fallback decisions must be recorded');
assert.match(closure, /const VERSION='0\.6\.5\.15'/, 'adaptive metadata must report the current release');
assert.doesNotMatch(index, /0\.6\.5\.14/, 'the active page should not retain stale release/cache versions');

console.log('PASS: learning closure QA — 575 tags, production wiring, reserved diagnostics, 25 positions, weakness matching, fallback and failure safety.');
