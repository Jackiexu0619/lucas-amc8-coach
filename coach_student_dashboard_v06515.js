/* Lucas AMC8 Coach v0.6.5.15 — guided student dashboard.
 * Presentation-only layer: preserves the existing practice, mock, report and data flows.
 */
(function(root){
'use strict';
const VERSION='0.6.5.15';
const STATUS_TEXT={done:'已完成',active:'进行中',pending:'待开始',waiting:'等待记录'};

function dateKey(value){return String(value??'').slice(0,10);}
function weekdayOf(date){
  const d=dateKey(date);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(d))return null;
  const value=new Date(d+'T12:00:00Z').getUTCDay();
  return Number.isFinite(value)?value:null;
}
function mondayOfWeek(date){
  const d=dateKey(date),weekday=weekdayOf(d);
  if(weekday===null)return '';
  const value=new Date(d+'T12:00:00Z');
  value.setUTCDate(value.getUTCDate()-((weekday+6)%7));
  return value.toISOString().slice(0,10);
}
function latestFullMock(state){
  const rows=Array.isArray(state.mock_detail_history)?state.mock_detail_history:[];
  for(let i=rows.length-1;i>=0;i--){
    if(rows[i]&&Array.isArray(rows[i].per_question)&&rows[i].per_question.length===25)return rows[i];
  }
  return null;
}
function dailySubmitted(state,today){
  if(state.daily_plan&&state.daily_plan.submitted&&dateKey(state.daily_plan.date)===dateKey(today))return true;
  return (state.daily_sessions||[]).some(x=>x&&x.source==='paper_daily'&&dateKey(x.date)===dateKey(today)&&Number(x.question_count||3)===3);
}
function buildDashboardModel(state={},today,options={}){
  state=state||{};
  const latest=latestFullMock(state);
  const plan=state.daily_plan||{};
  const planIds=Array.isArray(plan.question_ids)?plan.question_ids:[];
  const hasDailyPlan=planIds.length===3&&!plan.submitted;
  const dailyDone=dailySubmitted(state,today);
  const paperIds=Array.isArray(state.printable_mock_ids)?state.printable_mock_ids:[];
  const hasPaper=paperIds.length===25;
  const paperId=String(state.printable_mock_id||'');
  const latestPaperId=String(latest&&(latest.paper_id||latest.mock_key)||'');
  const paperDate=dateKey(state.printable_mock_date||'');
  const latestDate=dateKey(latest&&latest.date||'');
  const latestIds=latest&&Array.isArray(latest.question_ids)?latest.question_ids:
    latest&&Array.isArray(latest.per_question)?latest.per_question.map(x=>x&&(x.qid||x.question_id)).filter(Boolean):[];
  const hasQuestionSignature=paperIds.length===25&&latestIds.length===25;
  const sameQuestionSignature=hasQuestionSignature&&paperIds.every((id,i)=>String(id)===String(latestIds[i]));
  const idMatch=Boolean(paperId&&latestPaperId&&paperId===latestPaperId);
  const samePaper=Boolean(latest&&(
    (idMatch&&(!hasQuestionSignature||sameQuestionSignature))||
    ((!paperId||!latestPaperId)&&hasQuestionSignature&&sameQuestionSignature&&(!paperDate||!latestDate||paperDate===latestDate))
  ));
  const paperSubmitted=hasPaper&&samePaper;
  const paperPending=hasPaper&&!paperSubmitted;
  const weekStart=mondayOfWeek(today);
  const paperWeekDate=paperDate||latestDate;
  const paperInCurrentWeek=Boolean(paperWeekDate&&weekStart&&paperWeekDate>=weekStart&&paperWeekDate<=dateKey(today));
  const currentPaperComplete=paperSubmitted&&paperInCurrentWeek;
  const currentWeekPaper=paperPending||currentPaperComplete;
  const planDate=dateKey(plan.date||'');
  const oldDailyPlanPending=hasDailyPlan&&!dailyDone&&!!planDate&&planDate!==dateKey(today);
  const pendingTasks=((state.v065_review_cycle&&state.v065_review_cycle.tasks)||[]).filter(t=>t&&t.status==='pending');
  const completedTasks=((state.v065_review_cycle&&state.v065_review_cycle.tasks)||[]).filter(t=>t&&t.status==='completed');
  const weakFocus=Array.isArray(options.weakFocus)?options.weakFocus:[];
  const weakAttemptCount=Number(options.weakAttemptCount)||0;
  const dailyQuestionCount=Number(options.dailyQuestionCount)||planIds.length;
  const weekday=weekdayOf(today);
  const weekend=weekday===0||weekday===6;

  const steps=[
    {key:'mock',number:1,title:'周末25题模拟',
      description:paperPending?'当前纸质卷已锁定，等待完成与提交':currentPaperComplete?'本周已提交 '+(latest.date||'完整模拟'):(latest?'上次模拟已留档；本周新卷尚未完成':'用完整真题建立阶段基线'),
      status:paperPending?'active':currentPaperComplete?'done':'pending'},
    {key:'diagnosis',number:2,title:'薄弱点归因',
      description:paperPending?'当前试卷提交后再更新诊断':currentPaperComplete?'已根据本周逐题结果生成诊断':(latest?'上次诊断已留档；本周新卷提交后更新':weakAttemptCount?'正在积累可用的薄弱项证据':'提交结果后再归因，不提前猜测'),
      status:paperPending?'pending':currentPaperComplete?'done':weakAttemptCount?'active':'pending'},
    {key:'daily',number:3,title:'周中每日3题',
      description:dailyDone?'今日训练已提交':oldDailyPlanPending?'尚有 '+planDate+' 的锁定训练卷待完成':(hasDailyPlan?'今日纸上训练已锁定':(dailyQuestionCount?'已安排训练题':'提交模拟后自动安排')),
      status:dailyDone?'done':hasDailyPlan?'active':'pending'},
    {key:'transfer',number:4,title:'同方法迁移复测',description:pendingTasks.length?pendingTasks.length+'项待复测':(completedTasks.length?'已有迁移复测记录':'发现可靠弱项后再安排，不拿异类题凑数'),
      status:pendingTasks.length?'active':completedTasks.length?'done':latest?'waiting':'pending'}
  ];

  let next={title:'继续当前专项训练',detail:'按当前锁定的3题完成纸上训练；每天保持轻量，不额外堆题。',target:'practice'};
  if(paperPending){
    next={title:'本周模拟卷已锁定，先完成这张纸质卷',detail:'按已打印的25题完成测试，再录入逐题结果。系统不会自动替换这张卷，也不需要重新打印。',target:'mock'};
  }else if(weekend&&currentPaperComplete){
    next={title:'本周模拟已提交，查看学习报告',detail:'先核对本次错题、猜对题和用时，再让下周训练沿着真实薄弱点推进。',target:'report'};
  }else if(oldDailyPlanPending){
    next={title:'先完成之前锁定的3题专项',detail:'日期为 '+planDate+' 的纸质训练卷尚未提交。先完成并录入这张原卷；系统会保留原题，不自动换卷。',target:'practice'};
  }else if(weekend&&!currentWeekPaper){
    next={title:'本周模拟尚未完成',detail:'上一套模拟记录会保留；请在现有周末模拟页核对本周试卷状态，再按需准备新卷。',target:'mock'};
  }else if(!dailyDone){
    next={title:'先完成当前锁定的3题专项',detail:'按已锁定的题目完成纸上训练，并记录答案、用时和是否猜题；每天总量仍控制在3题。',target:'practice'};
  }else if(pendingTasks.length){
    next={title:'查看待复测任务',detail:'今天的3题已经提交。下一步查看 '+pendingTasks.length+' 项待复测任务，按计划验证迁移，不重复刷原题。',target:'report'};
  }else if(latest){
    next={title:'复盘最近一套模拟卷',detail:'用逐题记录确认错因；猜对也先列为待确认掌握，再用新题检验。',target:'report'};
  }else{
    next={title:'先完成一套周末真题模拟',detail:'完整模拟能建立基线，之后系统才能更可靠地安排周中专项。',target:'mock'};
  }

  return {
    version:VERSION,today:dateKey(today),weekend,dailyDone,hasDailyPlan,hasPaper,paperPending,paperSubmitted,currentPaperComplete,currentWeekPaper,
    paperId,paperDate,latestMockDate:latestDate,latestMockScore:latest?Number(latest.score):null,
    dailyPlanDate:planDate,oldDailyPlanPending,dailyQuestionCount,weakAttemptCount,weakFocus:weakFocus.slice(0,4),
    pendingReviewCount:pendingTasks.length,completedReviewCount:completedTasks.length,
    steps,next,progress:steps.filter(x=>x.status==='done').length
  };
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={VERSION,weekdayOf,latestFullMock,dailySubmitted,buildDashboardModel};
  return;
}
if(!root||!root.document)return;
if(root.__amcStudentDashboardV06515)return;
root.__amcStudentDashboardV06515=true;

function esc(value){
  if(typeof root.esc==='function')return root.esc(value);
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function ensureStyles(){
  if(root.document.getElementById('studentDashboardStyles'))return;
  const style=root.document.createElement('style');style.id='studentDashboardStyles';
  style.textContent=`
    .student-path-grid{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:10px;margin-top:15px}
    .student-path-step{border:1px solid var(--line);border-radius:12px;padding:12px;background:#fbfcff;min-width:0}
    .student-path-step[data-status="done"]{border-color:#b9e5cc;background:#f3fbf6}
    .student-path-step[data-status="active"]{border-color:#c8d5fa;background:#f4f7ff}
    .student-step-head{display:flex;align-items:center;gap:8px;justify-content:space-between;margin-bottom:7px}
    .student-step-number{width:27px;height:27px;border-radius:50%;display:inline-flex;align-items:center;justify-content:center;background:#e8eef7;font-weight:750;flex-shrink:0}
    .student-path-step[data-status="done"] .student-step-number{background:#d6f1e1;color:#17683e}
    .student-path-step[data-status="active"] .student-step-number{background:#dfe7ff;color:#244db5}
    .student-step-status{font-size:11px;white-space:nowrap;color:var(--muted)}
    .student-path-step h4{margin:0 0 5px;font-size:14px}
    .student-path-step p{margin:0;font-size:12px;line-height:1.5;color:var(--muted)}
    .student-home-grid{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:13px;margin-top:13px}
    .student-next-card{background:linear-gradient(135deg,#f5f7ff,#fff);border-color:#d8e0fb}
    .student-next-label{font-size:12px;color:#5264b7;font-weight:700;letter-spacing:.02em}
    .student-focus-list{padding-left:18px;margin:8px 0 0}
    .student-focus-list li{margin:7px 0;line-height:1.45}
    .student-home-note{font-size:12px;color:var(--muted);margin-top:10px}
    @media(max-width:850px){.student-path-grid{grid-template-columns:repeat(2,minmax(0,1fr))}.student-home-grid{grid-template-columns:1fr}}
    @media(max-width:520px){.student-path-grid{grid-template-columns:1fr}.student-path-step{padding:10px}}
  `;
  root.document.head.appendChild(style);
}
function statusLabel(status){return STATUS_TEXT[status]||'待开始';}
function renderGuidedPanel(){
  const host=root.document.getElementById('home');if(!host)return;
  const previous=root.document.getElementById('guidedStudentDashboard');if(previous)previous.remove();
  const state=typeof S!=='undefined'?S:{};
  let focus=[],weakAttemptCount=0,dailyCount=0;
  try{if(typeof weeklyWeaknessSummary==='function')focus=weeklyWeaknessSummary()||[]}catch(e){}
  try{if(typeof weeklyWeakRecords==='function')weakAttemptCount=(weeklyWeakRecords()||[]).length}catch(e){}
  try{if(typeof dailyPlan==='function')dailyCount=(dailyPlan()||[]).length}catch(e){}
  const date=typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const model=buildDashboardModel(state,date,{weakFocus:focus,weakAttemptCount,dailyQuestionCount:dailyCount});
  const steps=model.steps.map(step=>'<div class="student-path-step" data-status="'+step.status+'">'+
    '<div class="student-step-head"><span class="student-step-number">'+step.number+'</span><span class="student-step-status">'+statusLabel(step.status)+'</span></div>'+
    '<h4>'+esc(step.title)+'</h4><p>'+esc(step.description)+'</p></div>').join('');
  const focusHtml=model.weakFocus.length
    ?'<ul class="student-focus-list">'+model.weakFocus.map(x=>'<li><b>'+esc(x.skill||x.method||x.group_key||'待核对方法')+'</b> <span class="small">×'+Number(x.count||0)+'</span></li>').join('')+'</ul>'
    :'<p class="small">'+(model.weakAttemptCount?'已有薄弱记录，但目前缺少可靠的方法标签；系统不会编造考点。':'提交训练结果后，系统会根据错题、猜对、未做和明确偏慢记录更新重点。')+'</p>';
  const paperLine=model.paperPending
    ?'<p class="student-home-note">当前卷号：<b>'+esc(model.paperId||'已锁定真题卷')+'</b> · 已锁定，保留现有纸质卷。</p>'
    :(model.latestMockDate?'<p class="student-home-note">最近一次完整模拟：'+esc(model.latestMockDate)+(Number.isFinite(model.latestMockScore)?' · '+model.latestMockScore+'/25':'')+'</p>':'<p class="student-home-note">尚无完整模拟成绩；暂不估计能力分数。</p>');
  const panel=root.document.createElement('section');panel.id='guidedStudentDashboard';panel.className='card';
  const targetLabels={practice:'每日训练',mock:'周末模拟',report:'学习报告'};
  panel.innerHTML='<div class="row" style="align-items:flex-start;justify-content:space-between"><div><div class="muted">YOUR AMC8 LEARNING PATH</div><h2 style="margin:4px 0 6px;font-size:21px">让每次练习都有下一步</h2><p class="small" style="margin:0">周末用完整真题看水平，周中每天最多3题，错题再用新题验证。</p></div><span class="tag">'+model.progress+'/4步已完成</span></div>'+
    '<div class="student-path-grid">'+steps+'</div>'+
    '<div class="student-home-grid"><div class="card student-next-card"><div class="student-next-label">自动学习建议 · 下一步</div><h3 style="margin:7px 0">'+esc(model.next.title)+'</h3><p style="line-height:1.6">'+esc(model.next.detail)+'</p><div class="row" style="margin-top:12px"><span class="tag">建议查看：'+esc(targetLabels[model.next.target]||'学习主页')+'</span><span class="small">使用顶部已有导航即可。</span></div>'+paperLine+'</div>'+
    '<div class="card"><div class="row"><h3 style="margin:0">近7天薄弱项</h3><span class="tag">'+model.weakAttemptCount+'条记录</span></div>'+focusHtml+
    '<hr><div class="row"><span class="small">待复测</span><b>'+model.pendingReviewCount+'项</b><span class="small">已完成迁移复测</span><b>'+model.completedReviewCount+'项</b></div>'+
    '<p class="student-home-note">薄弱项依据已记录的训练结果与可用标签生成；资料不足时会明确提示，不把猜对当成稳定掌握。</p></div></div>';
  host.insertBefore(panel,host.firstChild);
  root.__amcStudentDashboardModel=model;
}
if(typeof renderHome==='function'){
  const baseRenderHome=renderHome;
  renderHome=function(){baseRenderHome.apply(this,arguments);try{renderGuidedPanel()}catch(e){console.warn('Guided student dashboard failed',e);}};
}
root.LucasAMC8StudentDashboard={version:VERSION,buildDashboardModel,render:renderGuidedPanel};
ensureStyles();
try{if(typeof renderHome==='function')renderHome();}catch(e){console.warn('Guided student dashboard initial render failed',e);}
})(typeof window!=='undefined'?window:globalThis);
