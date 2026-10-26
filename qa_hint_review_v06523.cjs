'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');

const source=fs.readFileSync(path.join(__dirname,'coach_review_cycle_v065.js'),'utf8');
const baseQuestion={id:'archive_2009_15',year:2009,problem_number:15};
const transferQuestion={id:'archive_2017_15',year:2017,problem_number:15};
const bank=new Map([baseQuestion,transferQuestion].map(q=>[q.id,q]));
const tags=Object.fromEntries([...bank.keys()].map(id=>[id,{
  status:'pdf_explanation_reviewed',skill:'比例关系',group_key:'ratio',method:'同方法比例迁移'
}]));
const sourceAttempt={question_id:baseQuestion.id,date:'2026-10-24',source:'weekend_mock',
  correct:false,guessed:false,result_status:'wrong',hint_level:0};
function makeQueue(attempts){
  const S={attempts:structuredClone(attempts),v064_specific_skills:tags,v064_question_tags:{},
    mock_detail_history:[{paper_id:'locked-mock',score:21}],printable_mock_ids:['locked-q']};
  const original=structuredClone(S.attempts);
  const window={amc8V0641PickDaily:()=>[]};
  const ctx={window,S,today:()=> '2026-10-27',saveStateLocal:()=>{},
    qById:id=>bank.get(id)||null,eligibleDailyBank:()=>[transferQuestion],
    generateDailyPlan:()=>[],dailyPlan:()=>[],questionPromptHtml:()=>'',questionSourceBadge:()=> '',
    renderReport:()=>{},renderMock:()=>{},currentDraft:()=>({error_types:{}}),
    ensurePaperId:()=> 'locked-mock',submitPrintableMockAnswers:()=>{},
    submitDailyPaperResults:()=>{},renderAll:()=>{},safe:String,console};
  vm.createContext(ctx);
  vm.runInContext(source,ctx,{filename:'coach_review_cycle_v065.js'});
  assert.deepEqual(S.attempts,original,'queue rebuild must not edit source attempts');
  assert.equal(S.mock_detail_history[0].score,21,'weekend score must stay unchanged');
  assert.equal(S.printable_mock_ids[0],'locked-q','locked paper must stay unchanged');
  return {S,window};
}
const observed=[
  {name:'independent correct',correct:true,guessed:false,hint_level:0,stage:1,due:'2026-11-03'},
  {name:'hint level 1',correct:true,guessed:false,hint_level:1,stage:0,due:'2026-10-28'},
  {name:'hint level 2',correct:true,guessed:false,hint_level:2,stage:0,due:'2026-10-28'},
  {name:'guessed correct',correct:true,guessed:true,hint_level:0,stage:0,due:'2026-10-28'},
  {name:'wrong answer',correct:false,guessed:false,hint_level:0,stage:0,due:'2026-10-28'},
  {name:'missing hint',correct:true,guessed:false,stage:0,due:'2026-10-28'},
  {name:'invalid hint',correct:true,guessed:false,hint_level:'0',stage:0,due:'2026-10-28'}
];
for(const row of observed){
  const answer={question_id:transferQuestion.id,date:'2026-10-27',source:'paper_daily',
    result_status:row.correct?'correct':'wrong',correct:row.correct,guessed:row.guessed};
  if(Object.hasOwn(row,'hint_level'))answer.hint_level=row.hint_level;
  const {S}=makeQueue([sourceAttempt,answer]);
  assert.equal(S.v065_review_cycle.tasks.length,1,row.name+' task count');
  const task=S.v065_review_cycle.tasks[0];
  assert.equal(task.stage,row.stage,row.name+' stage');
  assert.equal(task.due,row.due,row.name+' due');
  assert.equal(task.status,'pending',row.name+' status');
  assert.deepEqual(S.attempts[1],answer,row.name+' raw attempt preserved');
  console.log('PASS '+row.name+': stage '+task.stage+', due '+task.due);
}
for(const hint of [undefined,'0',-1]){
  const answer={question_id:transferQuestion.id,date:'2026-10-27',source:'paper_daily',
    result_status:'correct',correct:true,guessed:false};
  if(hint!==undefined)answer.hint_level=hint;
  const {S}=makeQueue([answer]);
  assert.equal(S.v065_review_cycle.tasks.length,0,'unknown independence alone must not invent a weakness task');
  assert.deepEqual(S.attempts[0],answer,'historic attempt must not be rewritten');
}
console.log('PASS: historic missing/invalid hint values are preserved and never prove independent mastery.');
