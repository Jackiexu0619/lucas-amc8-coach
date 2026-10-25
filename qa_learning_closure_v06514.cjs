'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {resolveTags,selectArchivePaper,classifyMatch,dailyQuestionCooldownIds}=require('./coach_learning_closure_v06514.js');
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

const cooldownState={
  attempts:[{question_id:'attempt_30d',date:'2026-09-25'},{question_id:'attempt_31d',date:'2026-09-24'}],
  mock_detail_history:[
    {date:'2026-10-20',question_ids:['recent_mock_q1'],per_question:[{qid:'recent_mock_q2'}]},
    {date:'2026-09-01',question_ids:['old_mock_q']}
  ],
  printable_mock_ids:['locked_weekend_q'],
  daily_plan:{date:'2026-10-01',question_ids:['pending_daily_q'],submitted:false}
};
const cooldown30=dailyQuestionCooldownIds(cooldownState,'2026-10-25',30);
assert.ok(cooldown30.has('attempt_30d'),'30-day boundary attempt should be excluded');
assert.ok(!cooldown30.has('attempt_31d'),'attempts older than 30 days should not be excluded by cooldown');
assert.ok(cooldown30.has('recent_mock_q1')&&cooldown30.has('recent_mock_q2'),'recent weekend mock history should be excluded');
assert.ok(!cooldown30.has('old_mock_q'),'old mock history should not be excluded by the date window');
assert.ok(cooldown30.has('locked_weekend_q'),'currently locked weekend paper must always be protected');
assert.ok(cooldown30.has('pending_daily_q'),'pending daily paper must always be protected');
const cooldown7=dailyQuestionCooldownIds(cooldownState,'2026-10-25',7);
assert.ok(!cooldown7.has('attempt_30d'),'14/7-day fallback should relax old attempted questions');
assert.ok(cooldown7.has('locked_weekend_q')&&cooldown7.has('pending_daily_q'),'fallback must never reuse locked papers');
const submittedDaily=dailyQuestionCooldownIds({daily_plan:{date:'2026-10-01',question_ids:['old_submitted_daily_q'],submitted:true}},'2026-10-25',30);
assert.ok(!submittedDaily.has('old_submitted_daily_q'),'old submitted daily paper should age out normally');
const recentSubmittedDaily=dailyQuestionCooldownIds({daily_plan:{date:'2026-10-20',question_ids:['recent_submitted_daily_q'],submitted:true}},'2026-10-25',30);
assert.ok(recentSubmittedDaily.has('recent_submitted_daily_q'),'recent submitted daily paper should be covered by the cooldown');
const indexHtml=fs.readFileSync('index.html','utf8');
assert.match(indexHtml,/function eligibleDailyBank\(\)[\s\S]{0,2200}__amcDailyQuestionCooldownIds/,'daily bank must use the shared cooldown helper');
assert.match(indexHtml,/const ENGINE_VERSION='0\\.6\\.5\\.16'|const ENGINE_VERSION='0\.6\.5\.16'/,'engine version must match cooldown fix release');

console.log('PASS: 575 tags, 25-position curve, weakness matching, unmapped safeguards, and complete 30-day question cooldown.');
