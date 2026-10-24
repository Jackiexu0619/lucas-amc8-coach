const assert = require('node:assert/strict');
const {
  VERSION, PERSONALIZED_POSITIONS, collectWeakRecords, buildAdaptivePaper
} = require('./coach_weekend_adaptive_v06514.js');

const years=[2000,2001,2002,2003,2004,2005,2006,2007];
const archiveBank=[];
const tagsById={};
for(const year of years){
  for(let pos=1;pos<=25;pos++){
    const id='archive_'+year+'_'+String(pos).padStart(2,'0');
    archiveBank.push({id,year,problem_number:pos,answer:'A'});
    tagsById[id]={
      skill:'skill_'+pos,
      method:'method_'+pos+'_'+year,
      group_key:'group_'+pos+'_'+year,
      domain:'domain_'+(pos%4)
    };
  }
}
// Several year variants share the methods that were weak this week.
for(const year of years){
  const q5='archive_'+year+'_05';
  const q9='archive_'+year+'_09';
  tagsById[q5]={skill:'概率与补集',method:'weak_probability_complement',group_key:'probability_complement',domain:'概率'};
  tagsById[q9]={skill:'质因数分解与因数个数',method:'weak_factor_count',group_key:'factor_count',domain:'数论'};
}
const attempts=[
  {question_id:'archive_2000_05',date:'2026-10-24',source:'paper_daily',correct:false,error_type:'method_gap'},
  {question_id:'archive_2001_09',date:'2026-10-24',source:'paper_daily',correct:true,guessed:true},
  {question_id:'archive_2002_12',date:'2026-10-24',source:'weekend_mock',correct:false},
  {question_id:'archive_2003_15',date:'2026-10-10',source:'paper_daily',correct:false},
  {question_id:'archive_2004_15',date:'2026-10-24',source:'paper_daily',correct:true,guessed:false},
  {question_id:'ai_transfer_demo',review_origin_question_id:'archive_2000_05',date:'2026-10-25',source:'ai_transfer_review',correct:false}
];
const getTags=id=>tagsById[id]||{};
const result=buildAdaptivePaper({
  archiveBank,attempts,currentDate:'2026-10-25',
  recentIds:['archive_2000_05','archive_2001_05'],
  tagsById,getTags
});

assert.equal(VERSION,'0.6.5.14');
assert.deepEqual(PERSONALIZED_POSITIONS,[5,9,12,15,18,21,24]);
assert.ok(result.questions,'selector should return a paper');
assert.equal(result.questions.length,25,'paper must contain 25 questions');
assert.equal(new Set(result.questions.map(q=>q.id)).size,25,'question IDs must be unique');
assert.ok(result.questions.every((q,i)=>q.problem_number===i+1),'original position must be preserved');
assert.ok(Object.values(result.audit.source_year_counts).every(n=>n<=2),'source year use must stay balanced');
assert.ok(!result.questions.some(q=>['archive_2000_05','archive_2001_05'].includes(q.id)),'recent questions must be excluded when alternatives exist');
assert.equal(result.audit.weak_attempt_count,3,'count recent wrong, guessed and AI-transfer-linked attempts; exclude weekend mock, old and independent correct attempts');
assert.ok(result.audit.weekly_weakness_focus.some(g=>g.method==='weak_probability_complement'&&g.count===2),'AI transfer weakness must map back to the original question method');
assert.ok(result.audit.weekly_weakness_coverage.some(x=>x.position===5&&x.reason==='weekly_weakness_match'),'a personalized slot should record its matching reason');
assert.equal(result.audit.personalized_positions.length,7,'exactly seven positions are personalized');

const noWeakness=buildAdaptivePaper({
  archiveBank,attempts:[],currentDate:'2026-10-25',recentIds:[],getTags
});
assert.ok(noWeakness.questions&&noWeakness.questions.length===25,'paper should still generate without weak records');
assert.ok(noWeakness.audit.weekly_weakness_coverage.every(x=>x.reason==='no_weekly_weak_records'),'no-data fallback must be explicit');

const allQ1Recent=archiveBank.filter(q=>q.problem_number===1).map(q=>q.id);
const fallback=buildAdaptivePaper({
  archiveBank,attempts:[],currentDate:'2026-10-25',recentIds:allQ1Recent,getTags
});
assert.ok(fallback.questions,'selector should fall back rather than fail when every Q1 candidate is recent');
assert.ok(fallback.audit.recent_exclusion_fallback_positions.includes(1),'relaxed recent exclusion must be recorded');
console.log('PASS: '+VERSION+' weekend adaptive selector; 25 positions, uniqueness, year balance, recent exclusion, weakness mapping, transparent fallback.');
