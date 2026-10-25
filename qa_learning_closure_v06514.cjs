'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const {resolveTags,selectArchivePaper,classifyMatch,dailyQuestionCooldownIds,latestCompleteMockDetail,selectionEvidenceFor}=require('./coach_learning_closure_v06514.js');
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
const reservedYears=new Set([2017,2018]);
const reservedResult=selectArchivePaper({bank,state,tagMap,weakRecords,today:'2026-10-24',tagBankStatus:'ready',reservedYears:[2017,2018],randomFn:()=>0.5});
assert.ok(reservedResult&&reservedResult.questions.length===25,'reserved-year filtering must still assemble a full paper');
assert.ok(reservedResult.questions.every(q=>!reservedYears.has(q.year)),'reserved diagnostic years must not leak into personalized assembly');
assert.deepEqual(reservedResult.meta.reserved_years_excluded,[2017,2018]);
assert.equal(reservedResult.meta.reserved_year_filter_applied,true);
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
const submittedDaily=dailyQuestionCooldownIds({daily_plan:{date:'2026-09-20',question_ids:['old_submitted_daily_q'],submitted:true}},'2026-10-25',30);
assert.ok(!submittedDaily.has('old_submitted_daily_q'),'old submitted daily paper should age out normally');
const recentSubmittedDaily=dailyQuestionCooldownIds({daily_plan:{date:'2026-10-20',question_ids:['recent_submitted_daily_q'],submitted:true}},'2026-10-25',30);
assert.ok(recentSubmittedDaily.has('recent_submitted_daily_q'),'recent submitted daily paper should be covered by the cooldown');
const indexHtml=fs.readFileSync('index.html','utf8');
assert.match(indexHtml,/function eligibleDailyBank\(\)[\s\S]{0,2200}__amcDailyQuestionCooldownIds/,'daily bank must use the shared cooldown helper');
assert.match(indexHtml,/const ENGINE_VERSION='0\\.6\\.5\\.18'|const ENGINE_VERSION='0\.6\.5\.18'/,'engine version must match cooldown fix release');


const partialMock={date:'2026-10-24',score:7,per_question:Array.from({length:8},(_,i)=>({index:i+1,correct:false}))};
const completeMock={date:'2026-10-20',score:16,per_question:Array.from({length:25},(_,i)=>({index:i+1,correct:i<16})),selection_meta:{weekly_weakness_coverage:[{position:5,question_id:'archive_2016_05',matches:[]}]}};
assert.equal(latestCompleteMockDetail({mock_detail_history:[completeMock,partialMock]}),completeMock,'a newer partial mock must not replace the latest complete mock');
assert.equal(latestCompleteMockDetail({mock_detail_history:[partialMock]}),null,'partial records alone must not be reported as a completed full mock');
const currentSelection={weekly_weakness_coverage:[{position:5,question_id:'current_locked_mock'}]};
assert.equal(selectionEvidenceFor({printable_mock_meta:currentSelection,mock_detail_history:[completeMock,partialMock]},completeMock),completeMock.selection_meta,'completed mock report must use that mock’s saved selection evidence');
const legacyComplete={date:'2026-10-21',per_question:Array.from({length:25},(_,i)=>({index:i+1}))};
assert.equal(selectionEvidenceFor({printable_mock_meta:currentSelection,mock_detail_history:[legacyComplete]},legacyComplete),null,'do not attach current paper evidence to an older completed mock without its own evidence');
assert.equal(selectionEvidenceFor({printable_mock_meta:currentSelection,mock_detail_history:[]},null),currentSelection,'before any completed mock, current locked paper evidence may be shown');
const reportHtml=fs.readFileSync('index.html','utf8');
assert.match(reportHtml,/Array\.isArray\(x\.per_question\)&&x\.per_question\.length===25/,'learning report must ignore partial mock detail records');
const closureSource=fs.readFileSync('coach_learning_closure_v06514.js','utf8');
assert.match(closureSource,/const latest=latestCompleteMockDetail\(state\)/,'closure panel must use the latest complete mock');
assert.match(closureSource,/const selection=selectionEvidenceFor\(state,latest\)/,'selection evidence must belong to the mock being reported');
assert.match(closureSource,/archivePaperPicker=function\(options=\{\}\)/,'the active picker override must accept the production options');
assert.match(closureSource,/const sourceBank=Array\.isArray\(options\.archive\)\?options\.archive/,'the active picker must honor the filtered archive passed by the production engine');
assert.match(closureSource,/buildArchiveMockCore=function\(options=\{\}\)/,'the final active builder must preserve the options contract');
assert.match(closureSource,/archivePaperPicker\(\{archive:bank,reservedYears:\[\.\.\.reservedYears\]\}\)/,'the final active builder must pass the protected years into the final active picker');

const reviewCycleSource=fs.readFileSync('coach_review_cycle_v065.js','utf8');
const slowDailyQ={id:'slow_daily_q',year:2018,problem_number:17,answer:'A'};
const slowWeekendQ={id:'slow_weekend_q',year:2018,problem_number:18,answer:'B'};
const reviewQuestions=new Map([[slowDailyQ.id,slowDailyQ],[slowWeekendQ.id,slowWeekendQ]]);
const reviewState={
  attempts:[{question_id:slowDailyQ.id,date:'2026-10-23',correct:true,guessed:false,result_status:'correct',error_type:'time_issue',error_detail:'correct_but_slow',source:'paper_daily'}],
  v064_question_tags:{slow_daily_q:{skill:'概率与补集',status:'reviewed'},slow_weekend_q:{skill:'概率与补集',status:'reviewed'}},
  v064_specific_skills:{},mock_detail_history:[],mock_history:[],printable_mock_ids:[],daily_sessions:[],daily_plan:null,
  mock_drafts:{paper1:{error_types:{'0':'time_issue'}}},printable_mock_id:'paper1'
};
const reviewWindow={};
const reviewCtx={
  window:reviewWindow,S:reviewState,today:()=> '2026-10-25',saveStateLocal:()=>{},
  qById:id=>reviewQuestions.get(id)||null,eligibleDailyBank:()=>[slowDailyQ,slowWeekendQ],
  generateDailyPlan:()=>[],dailyPlan:()=>[],renderReport:()=>{},renderMock:()=>{},
  submitPrintableMockAnswers:()=>{
    reviewState.attempts.push({question_id:slowWeekendQ.id,date:'2026-10-25',correct:true,guessed:false,result_status:'correct',source:'weekend_mock',paper_id:'paper1',paper_question_index:1});
    reviewState.mock_detail_history.push({date:'2026-10-25',per_question:[]});
    return true;
  },
  submitDailyPaperResults:()=>true,ensurePaperId:()=> 'paper1',currentDraft:()=>reviewState.mock_drafts.paper1,
  renderAll:()=>{},document:{getElementById:()=>null},alert:()=>{},console
};
vm.createContext(reviewCtx);
vm.runInContext(reviewCycleSource,reviewCtx,{filename:'coach_review_cycle_v065.js'});
let slowQueue=reviewWindow.amc8V065Queue();
assert.ok(slowQueue.tasks.some(t=>t.first_question_id===slowDailyQ.id&&t.status==='pending'),'a correct-but-slow weekday answer must create a pending retest task');
assert.equal(slowQueue.tasks.find(t=>t.first_question_id===slowDailyQ.id).history[0].reason,'time_issue');
reviewState.attempts=[];reviewState.mock_detail_history=[];reviewState.v065_review_cycle=undefined;
reviewCtx.submitPrintableMockAnswers();
const weekendSlow=reviewState.attempts.find(a=>a.question_id===slowWeekendQ.id);
assert.equal(weekendSlow.error_type,'time_issue','a parent-marked slow correct answer must persist on the weekend attempt');
assert.equal(weekendSlow.error_detail,'correct_but_slow');
assert.ok(reviewWindow.amc8V065Queue().tasks.some(t=>t.first_question_id===slowWeekendQ.id&&t.status==='pending'),'a parent-marked slow weekend answer must create a pending retest task');

async function testLiveBuilderOverride(){
  const liveBank=[];
  for(const year of [2015,2016,2017,2018])for(let pos=1;pos<=25;pos++){
    liveBank.push({id:'archive_'+year+'_'+String(pos).padStart(2,'0'),year,problem_number:pos,answer:'A',choices:['A','B','C','D','E']});
  }
  const liveState={attempts:[],mock_detail_history:[],printable_mock_ids:[],printable_mock_meta:null,
    v064_question_tags:{},v064_specific_skills:{},daily_plan:null,mock_drafts:{}};
  const liveWindow={document:{getElementById:()=>null}};
  const liveCtx={
    window:liveWindow,S:liveState,ARCHIVE_BANK:liveBank,ENGINE_VERSION:'0.6.5.18',
    EXAM_DIFFICULTY_BY_POSITION:Array.from({length:25},(_,i)=>i+1<=8?1:i+1<=16?2:i+1<=21?3:4),
    archivePaperPicker:()=>null,buildArchiveMockCore:()=>false,submitPrintableMockAnswers:()=>true,
    learningTags:()=>({skill:'',method:'',domain:''}),weeklyWeakRecords:()=>[],weeklyWeaknessSummary:()=>[],
    weeklyWeakMatch:()=>[],weeklyWeakAffinity:()=>0,resetWeeklyWeaknessCache:()=>{},
    renderReport:()=>{},saveStateLocal:()=>{},renderAll:()=>{},today:()=> '2026-10-25',
    alert:()=>{},fetch:async()=>({ok:false,status:503}),console
  };
  vm.createContext(liveCtx);
  vm.runInContext(closureSource,liveCtx,{filename:'coach_learning_closure_v06514.js:browser-override'});
  await liveWindow.amcLearningClosureV06514.ready;
  const built=liveCtx.buildArchiveMockCore({archive:liveBank,reservedYears:[2017,2018]});
  assert.equal(built,true,'the active browser override should assemble the paper');
  assert.equal(liveState.printable_mock_ids.length,25,'the active browser override must create 25 questions');
  assert.equal(new Set(liveState.printable_mock_ids).size,25,'the active browser override must keep question IDs unique');
  assert.ok(liveState.printable_mock_meta.source_mix.every(q=>![2017,2018].includes(q.year)),
    'the final active browser override must not consume reserved diagnostic years');
  assert.deepEqual(liveState.printable_mock_meta.reserved_years_excluded,[2017,2018]);
  assert.equal(liveState.printable_mock_meta.reserved_year_filter_applied,true);
  assert.equal(liveState.printable_mock_meta.constraints.reserved_year_filter_applied,true);
  assert.ok(liveState.printable_mock_meta.source_mix.every((q,i)=>q.original_position===i+1),
    'the active browser override must preserve all 25 original AMC8 positions');
}
testLiveBuilderOverride().then(()=>{
  console.log('PASS: 575 tags, weakness matching, reserved-year protection through the final active browser override, 30-day cooldown, report integrity, and correct-but-slow retest integration.');
}).catch(error=>{
  console.error(error&&error.stack?error.stack:String(error));
  process.exitCode=1;
});
