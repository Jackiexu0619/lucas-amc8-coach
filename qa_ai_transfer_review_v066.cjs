'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'coach_ai_transfer_review_v066.js'),'utf8');
const appSource=fs.readFileSync(require('node:path').join(__dirname,'index.html'),'utf8');
assert.equal((appSource.match(/function eligibleDailyBank\(\)/g)||[]).length,1,'weekday selector must have one effective definition');
assert.match(appSource,/for\s*\(const days of \[30,14,7\]\)/,'weekday selector must try 30, 14, then 7 days');
assert.match(appSource,/ARCHIVE_BANK\.filter\(q=>q\.problem_number>=13&&q\.problem_number<=25\)/,'weekday training must remain in official AMC8 Q13-Q25');
const original={id:'archive_2018_18',year:2018,problem_number:18,domain:'number_theory',skill:'质因数分解与因数个数',core_method:'质因数指数加一乘积求约数数目',answer:'C',choices:['A','B','C','D','E'],official:true};
const other={id:'archive_2007_13',year:2007,problem_number:13,domain:'counting_probability',skill:'容斥',core_method:'两集合并集与交集公式',answer:'A',choices:['A','B','C','D','E'],official:true};
const prob={id:'archive_2015_07',year:2015,problem_number:7,domain:'counting_probability',skill:'概率',core_method:'计算全奇数概率的补集',answer:'B',choices:['A','B','C','D','E'],official:true};
const bank=new Map([[original.id,original],[other.id,other],[prob.id,prob]]);
const S={attempts:[{question_id:original.id,date:'2026-10-24',correct:false,guessed:false,result_status:'wrong',source:'paper_daily'}],daily_sessions:[],skill_state:{}};
const window={};
const ctx={
 window,S,
 today:()=> '2026-10-27',
 saveStateLocal:()=>{},
 qById:id=>bank.get(id)||null,
 questionPromptHtml:q=>q.prompt||'official',
 questionSourceBadge:q=>q.official?'official':'',
 generateDailyPlan:()=>[original,other,prob],
 dailyPlan:function(){
  if(S.daily_plan?.question_ids)return S.daily_plan.question_ids.map(id=>ctx.qById(id)).filter(Boolean);
  const plan=ctx.generateDailyPlan();
  S.daily_plan={date:'2026-10-27',question_ids:plan.map(q=>q.id),submitted:false};
  return plan;
 },
 renderReport:()=>{},
 renderAll:()=>{},
 printDailyAnswer:()=>{},
 submitDailyPaperResults:function(){
  const plan=ctx.dailyPlan();
  for(const q of plan)S.attempts.push({question_id:q.id,date:ctx.today(),correct:true,selected_answer:q.answer,result_status:'correct',guessed:false,hint_level:0,source:'paper_daily'});
  S.daily_sessions.push({date:ctx.today(),source:'paper_daily'});
  return true;
 },
 esc:x=>String(x),
 console
};
vm.createContext(ctx);
vm.runInContext(source,ctx,{filename:'coach_ai_transfer_review_v066.js'});
assert.equal(window.amcAiTransferV066.approvedCount,12,'only the curated pilot items are approved');
assert.equal(ctx.qById('ai_transfer_rework_20261024_023').counts_for_exam_diagnostic,false,'AI question excluded from diagnostics');
assert.equal(ctx.qById('ai_transfer_rework_20261024_023').answer,'C','factor-count answer key is stable');
const plan=ctx.dailyPlan();
assert.equal(plan.length,3,'daily paper remains three questions');
assert.equal(plan[0].source,'ai_generated_review','due same-method review occupies one daily slot');
assert.equal(plan[0].review_origin_question_id,original.id,'origin question is attached');
assert.equal(S.daily_plan.ai_transfer_context.origin_question_id,original.id,'origin survives in locked paper state');
window.__amcAiTransferSelected=null;
const restored=ctx.dailyPlan();
assert.equal(restored[0].review_origin_question_id,original.id,'origin survives reload/locked-paper restoration');
assert.equal(restored.filter(q=>q.source==='ai_generated_review').length,1,'at most one AI transfer item per daily paper');
assert.equal(restored.filter(q=>q.official).length,2,'two slots remain authentic AMC8 items');
ctx.submitDailyPaperResults();
const submittedAi=S.attempts.find(a=>a.question_id===restored[0].id&&a.date==='2026-10-27');
assert.equal(submittedAi.source,'ai_transfer_review','AI attempt is isolated from official paper attempts');
assert.equal(submittedAi.counts_for_exam_diagnostic,false,'submitted AI attempt is excluded from diagnostic scoring');
assert.equal(submittedAi.review_origin_question_id,original.id,'submission after reload retains the original-question link');
S.attempts=[{question_id:original.id,date:'2026-10-24',correct:false,guessed:false,result_status:'wrong',source:'paper_daily'}];
S.daily_sessions=[];S.daily_plan=null;window.__amcAiTransferSelected=null;
S.attempts.push({question_id:restored[0].id,date:'2026-10-27',correct:true,guessed:false,hint_level:0,source:'ai_transfer_review',method_group:'prime_factor_divisors',review_origin_question_id:original.id});
let q=window.amcAiTransferV066.queue();
let task=q.tasks.find(t=>t.origin_question_id===original.id);
assert.equal(task.stage,1,'independent correct transfer advances stage');
assert.equal(task.due,'2026-11-03','first independent pass schedules seven-day review');
S.attempts.push({question_id:'ai_transfer_rework_20261024_024',date:'2026-11-03',correct:true,guessed:false,hint_level:0,source:'ai_transfer_review',method_group:'prime_factor_divisors',review_origin_question_id:original.id});
task=window.amcAiTransferV066.queue().tasks.find(t=>t.origin_question_id===original.id);
assert.equal(task.stage,2,'second independent transfer advances stage');
assert.equal(task.due,'2026-11-17','second independent pass schedules fourteen-day review');
S.attempts.push({question_id:'ai_transfer_rework_20261024_025',date:'2026-11-17',correct:true,guessed:false,hint_level:0,source:'ai_transfer_review',method_group:'prime_factor_divisors',review_origin_question_id:original.id});
task=window.amcAiTransferV066.queue().tasks.find(t=>t.origin_question_id===original.id);
assert.equal(task.due,'2026-12-17','third independent pass schedules thirty-day review');
S.attempts.push({question_id:'ai_transfer_rework_20261024_026',date:'2026-12-17',correct:true,guessed:false,hint_level:0,source:'ai_transfer_review',method_group:'prime_factor_divisors',review_origin_question_id:original.id});
task=window.amcAiTransferV066.queue().tasks.find(t=>t.origin_question_id===original.id);
assert.equal(task.status,'completed','four independent passes complete the review loop');
assert.equal(task.due,null,'completed task has no due date');
assert.equal(ctx.qById('ai_transfer_rework_20261024_026').official,false,'AI question is not marked official');
console.log('PASS 24 assertions: gated pilot count, diagnostic isolation, daily-slot integration, locked-paper persistence, source mapping, 7/14/30 spacing, completion, and AI/official separation.');
