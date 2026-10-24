/* Lucas AMC8 Coach v0.6.5.11 — approved AI same-method review loop.
 * AI items are isolated from official weekend papers and diagnostic scoring.
 */
(function(){
'use strict';
if(window.__amcAiTransferV066)return;
window.__amcAiTransferV066=true;
const KEY='amc_ai_transfer_review_v066';
const DAY=86400000;
const raw=[
{id:'ai_transfer_20261024_007',method_group:'probability_complement',source_question_ids:['archive_2015_07','archive_2002_12','archive_2009_10'],skill:'概率与补集',question:'从7张不同卡片中（有2张红色特殊卡、其余普通卡），等可能抽3张，至少抽到1张特殊卡的概率是多少？',options:['5/7','24/35','26/35','2/7','23/35'],answer:'A',solution:'用补集：1−C(5,3)/C(7,3)=5/7。先计算一张特殊卡也没有抽到的概率，再用1减去它。'},
{id:'ai_transfer_20261024_008',method_group:'probability_complement',source_question_ids:['archive_2015_07','archive_2002_12','archive_2009_10'],skill:'概率与补集',question:'从8张不同卡片中（有2张红色特殊卡、其余普通卡），等可能抽3张，至少抽到1张特殊卡的概率是多少？',options:['9/14','5/8','37/56','5/14','17/28'],answer:'A',solution:'用补集：1−C(6,3)/C(8,3)=9/14。先计算三张全是普通卡的概率，再用1减去它。'},
{id:'ai_transfer_20261024_009',method_group:'probability_complement',source_question_ids:['archive_2015_07','archive_2002_12','archive_2009_10'],skill:'概率与补集',question:'盒中有3个蓝球和3个黄球，随机同时取2个，至少有1个蓝球的概率是多少？',options:['4/5','11/15','13/15','1/5','2/3'],answer:'A',solution:'用补集：1−C(3,2)/C(6,2)=4/5。反面事件是两个球都是黄色。'},
{id:'ai_transfer_20261024_010',method_group:'probability_complement',source_question_ids:['archive_2015_07','archive_2002_12','archive_2009_10'],skill:'概率与补集',question:'盒中有3个蓝球和4个黄球，随机同时取2个，至少有1个蓝球的概率是多少？',options:['5/7','2/3','16/21','2/7','13/21'],answer:'A',solution:'用补集：1−C(4,2)/C(7,2)=5/7。反面事件是两个球都是黄色。'},
{id:'ai_transfer_rework_20261024_023',method_group:'prime_factor_divisors',source_question_ids:['archive_2018_18'],skill:'质因数分解与因数个数',question:'正整数360有多少个正因数？',options:['20','22','24','26','28'],answer:'C',solution:'360=2³×3²×5。正因数个数为(3+1)(2+1)(1+1)=24。'},
{id:'ai_transfer_rework_20261024_024',method_group:'prime_factor_divisors',source_question_ids:['archive_2018_18'],skill:'质因数分解与因数个数',question:'正整数450有多少个正因数？',options:['16','18','20','22','14'],answer:'B',solution:'450=2×3²×5²。正因数个数为(1+1)(2+1)(2+1)=18。'},
{id:'ai_transfer_rework_20261024_025',method_group:'prime_factor_divisors',source_question_ids:['archive_2018_18'],skill:'质因数分解与因数个数',question:'正整数540有多少个正因数？',options:['24','26','28','20','22'],answer:'A',solution:'540=2²×3³×5。正因数个数为(2+1)(3+1)(1+1)=24。'},
{id:'ai_transfer_rework_20261024_026',method_group:'prime_factor_divisors',source_question_ids:['archive_2018_18'],skill:'质因数分解与因数个数',question:'正整数840有多少个正因数？',options:['34','36','28','30','32'],answer:'E',solution:'840=2³×3×5×7。正因数个数为(3+1)(1+1)³=32。'},
{id:'ai_transfer_rework_20261024_035',method_group:'union_multiples_range',source_question_ids:['archive_2007_13','archive_2008_11','archive_2015_15'],skill:'容斥原理',question:'从1到60（含端点）的整数中，能被4或6整除的数共有多少个？',options:['20','22','24','16','18'],answer:'A',solution:'4的倍数有15个，6的倍数有10个，12的倍数有5个；容斥得到15+10−5=20。'},
{id:'ai_transfer_rework_20261024_036',method_group:'union_multiples_range',source_question_ids:['archive_2007_13','archive_2008_11','archive_2015_15'],skill:'容斥原理',question:'从1到100（含端点）的整数中，能被8或12整除的数共有多少个？',options:['18','20','12','14','16'],answer:'E',solution:'8的倍数有12个，12的倍数有8个，24的倍数有4个；容斥得到12+8−4=16。'},
{id:'ai_transfer_rework_batch2_037',method_group:'union_multiples_range',source_question_ids:['archive_2007_13','archive_2008_11','archive_2015_15'],skill:'容斥原理',question:'从21到120（含端点）的整数中，能被5或7整除的数共有多少个？',options:['36','28','30','32','34'],answer:'D',solution:'区间内5的倍数有20个，7的倍数有15个，35的倍数有3个；容斥得到20+15−3=32。',numeric_answer:30},
{id:'ai_transfer_rework_batch2_038',method_group:'union_multiples_range',source_question_ids:['archive_2007_13','archive_2008_11','archive_2015_15'],skill:'容斥原理',question:'从1到90（含端点）的整数中，能被6或10整除的数共有多少个？',options:['17','19','21','23','25'],answer:'C',solution:'6的倍数有15个，10的倍数有9个，30的倍数有3个；容斥得到15+9−3=21。'}
];
/* QA guard: this is a small approved pilot, not the whole staged bank. */
const approved=raw.filter(q=>q.options.length===5&&new Set(q.options).size===5&&'ABCDE'.includes(q.answer)&&q.source_question_ids.length&&q.question&&q.solution)
 .map(q=>({...q,source:'ai_generated_review',language:'zh-CN',purpose:'same_method_transfer_only',quality_status:'approved_for_review',counts_for_exam_diagnostic:false,domain:'ai_transfer_review',core_method:q.method_group,difficulty:3,official:false,active:true,choices:q.options,prompt:q.question,prompt_zh:q.question,prompt_en:q.question,hints:[q.solution],trap_tags:[]}));
const byId=new Map(approved.map(q=>[q.id,q]));
const groups={};for(const q of approved)(groups[q.method_group]??=[]).push(q);
const sourceToMethod={};
for(const q of approved)for(const id of q.source_question_ids)sourceToMethod[id]=q.method_group;
const dateOf=v=>{const d=new Date(String(v||'')+'T12:00:00');return Number.isNaN(d.getTime())?null:d};
const add=(date,n)=>{const d=dateOf(date);if(!d)return date;d.setDate(d.getDate()+n);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')};
const isTrain=d=>{const x=dateOf(d);return x&&[2,3,4,5].includes(x.getDay())};
const nextTrain=d=>{let x=add(d,1),i=0;while(!isTrain(x)&&i++<8)x=add(x,1);return x};
const scheduled=d=>{let x=d,i=0;while(!isTrain(x)&&i++<8)x=add(x,1);return x};
const todayLocal=()=>typeof today==='function'?today():new Date().toISOString().slice(0,10);
function queue(){
 const attempts=(S.attempts||[]).map((a,i)=>({a,i})).filter(x=>x.a&&x.a.date);
 attempts.sort((x,y)=>String(x.a.date).localeCompare(String(y.a.date))||x.i-y.i);
 const tasks=new Map(),used=new Set();
 for(const {a} of attempts){
  if(a.source==='ai_transfer_review'){
   used.add(a.question_id);
   const g=a.method_group, key=a.review_origin_question_id||('method:'+g), t=tasks.get(key);
   if(!t||t.method_group!==g)continue;
   if(!a.correct||a.guessed||(a.hint_level||0)>0){
    t.stage=0;t.status='pending';t.due=nextTrain(a.date);t.last_result='not_independent_pass';t.last_review_date=a.date;
   }else{
    t.stage=(t.stage||0)+1;t.last_result='independent_correct';t.last_review_date=a.date;
    if(t.stage>=4){t.status='completed';t.due=null;}
    else{t.status='pending';t.due=scheduled(add(a.date,[0,7,14,30][t.stage]));}
   }
   tasks.set(key,t);continue;
  }
  const method=sourceToMethod[a.question_id];
  if(!method||!['paper_daily','weekend_mock'].includes(a.source))continue;
  const fail=!a.correct||a.guessed||a.result_status==='unable'||a.result_status==='skipped';
  if(!fail)continue;
  const key=a.question_id;
  const prev=tasks.get(key);
  tasks.set(key,{key,method_group:method,skill:groups[method][0].skill,origin_question_id:a.question_id,origin_date:a.date,
    status:'pending',stage:0,due:nextTrain(a.date),priority:(a.source==='weekend_mock'?2:1)+(a.guessed?1:0),last_result:'source_question_failed',
    history:(prev?.history||[]).concat([{date:a.date,question_id:a.question_id,result:'fail'}])});
 }
 const out=[...tasks.values()].map(t=>({...t,available:(groups[t.method_group]||[]).filter(q=>!used.has(q.id)&&q.id!==t.origin_question_id).length}));
 const state={version:1,tasks:out,used_candidate_ids:[...used],updated_at:new Date().toISOString(),approved_candidate_count:approved.length};
 S[KEY]=state;saveStateLocal(false);return state;
}
function pickDue(){
 const d=todayLocal(),used=new Set(queue().used_candidate_ids);
 const tasks=queue().tasks.filter(t=>t.status==='pending'&&t.due&&t.due<=d&&t.available>0)
  .sort((a,b)=>(b.priority||0)-(a.priority||0)||a.due.localeCompare(b.due));
 for(const t of tasks){
  const pool=(groups[t.method_group]||[]).filter(q=>!used.has(q.id)&&q.id!==t.origin_question_id);
  if(pool.length)return {...pool[0],review_origin_question_id:t.origin_question_id,review_method_group:t.method_group};
 }
 return null;
}
const originalQById=qById;
qById=function(id){return originalQById(id)||byId.get(id)||null};
const originalDailyPlan=dailyPlan;
dailyPlan=function(){
 const plan=originalDailyPlan();
 const p=S.daily_plan;
 const q=Array.isArray(plan)?plan.find(x=>byId.has(x.id)):null;
 if(q&&p){
  const origin=q.review_origin_question_id||p.ai_transfer_context?.origin_question_id||window.__amcAiTransferSelected?.review_origin_question_id||null;
  if(origin){
   q.review_origin_question_id=origin;
   const ctx=p.ai_transfer_context||{};
   if(ctx.question_id!==q.id||ctx.origin_question_id!==origin){
    p.ai_transfer_context={question_id:q.id,origin_question_id:origin,method_group:q.method_group||q.review_method_group||byId.get(q.id).method_group};
    saveStateLocal();
   }
  }
 }
 return plan;
};
const originalPrompt=questionPromptHtml;
questionPromptHtml=function(q){if(q?.source==='ai_generated_review')return '<div class="notice"><b>AI同方法迁移复测 · 不计入正式真题诊断</b></div><div class="qbox">'+esc(q.question)+'</div>';return originalPrompt(q)};
const originalBadge=questionSourceBadge;
questionSourceBadge=function(q){if(q?.source==='ai_generated_review')return '<span class="tag warn">AI同方法复测（非真题）</span>';return originalBadge(q)};
const originalGenerate=generateDailyPlan;
generateDailyPlan=function(excludeIds){
 const hasExclusions=excludeIds&&(excludeIds instanceof Set?excludeIds.size:Array.isArray(excludeIds)?excludeIds.length:0);
 if(hasExclusions)return originalGenerate(excludeIds);
 const base=originalGenerate();
 if(!Array.isArray(base)||base.length!==3)return base;
 const ai=pickDue();if(!ai)return base;
 const result=[ai,...base.filter(q=>q.id!==ai.id).slice(0,2)];
 window.__amcAiTransferSelected=ai;
 return result.length===3?result:base;
};
function renderQueue(){
 const state=queue(),tasks=state.tasks,pending=tasks.filter(t=>t.status==='pending'),due=pending.filter(t=>t.due<=todayLocal());
 let html='<div class="card" style="margin:12px 0"><h3>AI同方法复测闭环</h3><p class="small">已审核启用 '+approved.length+' 道 AI 迁移题；正式周末模拟卷与四周诊断不使用这些题。到期任务 '+due.length+' 项，待复测 '+pending.length+' 项。独立正确按 7/14/30 天推进；猜对、提示后答对不算掌握。</p>';
 if(pending.length){html+='<table><tr><th>方法组</th><th>原题</th><th>阶段</th><th>下次复测</th><th>可用变式</th></tr>';
 for(const t of pending.slice(0,10))html+='<tr><td>'+esc(t.skill)+'</td><td>'+esc(t.origin_question_id)+'</td><td>'+['次日迁移','7天保持','14天保持','30天回测'][Math.min(3,t.stage||0)]+'</td><td>'+esc(t.due||'—')+'</td><td>'+t.available+'</td></tr>';
 html+='</table>';}else html+='<p class="small">当前没有由已映射真题错题触发的 AI 复测任务。</p>';
 html+='<p class="small">注意：只有映射到已审核方法组的错题会自动触发；没有可靠映射的题继续走原有复测队列，不会猜方法。</p></div>';return html;
}
const oldRenderReport=renderReport;
renderReport=function(){oldRenderReport();const node=document.getElementById('report');if(node)node.insertAdjacentHTML('beforeend',renderQueue())};
const oldSubmit=submitDailyPaperResults;
submitDailyPaperResults=function(){
 const before=(S.daily_sessions||[]).length;
 const result=oldSubmit.apply(this,arguments);
 if((S.daily_sessions||[]).length===before+1){
  const p=S.daily_plan, ids=new Set(p?.question_ids||[]);
  for(let i=(S.attempts||[]).length-1;i>=0;i--){
   const a=S.attempts[i];if(a.date!==(p?.date||todayLocal()))break;
   if(ids.has(a.question_id)&&byId.has(a.question_id)){
    a.source='ai_transfer_review';a.counts_for_exam_diagnostic=false;
    a.method_group=byId.get(a.question_id).method_group;
    a.review_origin_question_id=window.__amcAiTransferSelected?.id===a.question_id?window.__amcAiTransferSelected.review_origin_question_id:null;
    if(!a.review_origin_question_id){
     const active=window.__amcAiTransferSelected;
     if(active?.id===a.question_id)a.review_origin_question_id=active.review_origin_question_id;
    }
    a.review_independent=!!a.correct&&!a.guessed&&!(a.hint_level||0);
   }
  }
  // The legacy queue is rebuilt after the source tag correction so AI attempts do not pollute it.
  if(window.amc8V065Queue)window.amc8V065Queue();
  queue();saveStateLocal();window.__amcAiTransferSelected=null;
 }
 return result;
};
window.amcAiTransferV066={queue,approvedCount:approved.length,approvedIds:approved.map(q=>q.id)};
try{queue()}catch(e){console.warn('AI transfer review queue deferred',e)}
})();
