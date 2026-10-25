/* Lucas AMC8 Coach v0.6.5.1 - skill-transfer review queue and weekend feedback.
 * Loaded LAST, after coach_v064.js, coach_v0641.js and submit guard.
 * No backend changes; never alters historical scores/answers or locked questions.
 */
(function(){'use strict';
if(window.__amcReviewCycleV065)return;
window.__amcReviewCycleV065=true;
const KEY='v065_review_cycle';
const validTypes=['knowledge_gap','method_gap','execution_error','time_issue','unsure'];
const typeNames={knowledge_gap:'知识/公式不会',method_gap:'方法没想到',execution_error:'计算/漏条件',time_issue:'时间不够',unsure:'原因待核对'};
const safe=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const dateStr=d=>{const a=new Date(d+'T12:00:00');return Number.isNaN(a.getTime())?null:a};
const addDay=(d,n)=>{const a=dateStr(d);if(!a)return d;a.setDate(a.getDate()+n);return a.getFullYear()+'-'+String(a.getMonth()+1).padStart(2,'0')+'-'+String(a.getDate()).padStart(2,'0')};
const isTrainDay=d=>{const dt=dateStr(d);return dt&&[2,3,4,5].includes(dt.getDay())};
const nextTrainDay=d=>{let n=addDay(d,1),i=0;while(!isTrainDay(n)&&i++<8)n=addDay(n,1);return n};
const latestScheduled=d=>{let t=d,i=0;while(!isTrainDay(t)&&i++<8)t=addDay(t,1);return t};
function fine(q){let f=S.v064_specific_skills?.[q?.id];if(f?.status==='pdf_explanation_reviewed'&&f.skill)return f;const external=window.amcLearningClosureV06514?.getTag?.(q?.id);return external?.status==='pdf_explanation_reviewed'&&external.skill?external:null}
function parent(q){const t=S.v064_question_tags?.[q?.id];return t?.status==='reviewed'&&t.skill?t:null}
function descriptor(q){const p=parent(q);if(p)return {key:'parent-skill:'+p.skill,skill:p.skill,source:'家长确认·同技能迁移'};const f=fine(q);return f?{key:'pdf-method:'+(f.group_key||f.skill),skill:f.skill,method:f.method||'',source:'PDF方法分组·待核对'}:null}
function recordKey(a,i){return [a.paper_id||'',a.question_id||'',a.date||'',a.source||'',a.paper_question_index||'',i].join('|')}
const isSlow=a=>{
 const error=String(a?.error_type||'').toLowerCase(),detail=String(a?.error_detail||'').toLowerCase(),speed=String(a?.speed_label||'');
 return ['time_issue','correct_but_slow'].includes(error)||detail==='correct_but_slow'||speed.includes('偏慢')||speed.includes('需复盘');
};
const resultOK=a=>a.correct&&!a.guessed&&a.result_status!=='skipped'&&a.result_status!=='unable'&&!isSlow(a);
function rebuildQueue(){
 const old=S[KEY]||{};
 const rows=(S.attempts||[]).map((a,i)=>({a,i})).filter(({a})=>a&&a.question_id&&a.date&&(a.source==='paper_daily'||a.source==='weekend_mock'));
 // Reconstruct from immutable attempts, not previous queue; correct on a different original problem closes an outstanding task.
 rows.sort((x,y)=>String(x.a.date).localeCompare(String(y.a.date))||x.i-y.i);
 const taskMap=new Map();const unidentified=[];
 for(const {a,i} of rows){
  const q=qById(a.question_id);if(!q)continue;
  const tag=descriptor(q);if(!tag){if(!resultOK(a))unidentified.push({qid:q.id,date:a.date});continue}
  let t=taskMap.get(tag.key);
  if(!resultOK(a)){
    if(!t||t.status==='completed')t={skill:tag.skill,key:tag.key,source:tag.source,first_question_id:q.id,origin:a.source,origin_date:a.date,stage:0,status:'pending',due:nextTrainDay(a.date),history:[],priority:0};
    t.status='pending';t.due=nextTrainDay(a.date);t.last_question_id=q.id;t.last_failure_date=a.date;t.stage=0;
    t.priority+=a.source==='weekend_mock'?2:3;
    if(a.result_status==='unable'||a.result_status==='skipped')t.priority+=2;
    if(a.guessed)t.priority+=1;
    t.history.push({date:a.date,qid:q.id,pass:false,reason:a.error_type||'unsure',source:a.source});
  }else if(t&&t.status!=='completed'){
    if(a.question_id===t.last_question_id){ /* no identical original question can validate transfer */ continue }
    // Do not treat an incidental earlier correct answer as the future proof; dates must be strictly later.
    if(a.date<=t.last_failure_date||a.date<t.due)continue;
    t.stage=(t.stage||0)+1;
    t.history.push({date:a.date,qid:q.id,pass:true,source:a.source});
    if(t.stage>=4){t.status='completed';t.due=null;}
    else{t.status='pending';t.due=latestScheduled(addDay(a.date,[0,7,14,30][t.stage]));}
    t.last_question_id=q.id;
  }
  if(t)taskMap.set(tag.key,t);
 }
 const tasks=[...taskMap.values()].filter(Boolean);
 // Preserve only explicit presentation info from prior state; never trust stale queue to modify training results.
 const snapshot={version:1,tasks,unidentified,updated_at:new Date().toISOString()};
 const changed=JSON.stringify({tasks:old.tasks,unidentified:old.unidentified})!==JSON.stringify({tasks,unidentified});
 if(changed){S[KEY]=snapshot;saveStateLocal(false);}else if(!S[KEY])S[KEY]=snapshot;
 return S[KEY];
}
function candidates(t,used){
 const seen=new Set((S.attempts||[]).map(a=>a.question_id));
 // A transfer check uses a genuinely unseen ORIGINAL question, never a prior attempt.
 const pool=eligibleDailyBank().filter(q=>!used.has(q.id)&&!seen.has(q.id)&&q.id!==t.last_question_id&&q.id!==t.first_question_id&&descriptor(q)?.key===t.key);
 const target=Number((qById(t.last_question_id)||{}).problem_number||17);
 pool.sort((a,b)=>Number(seen.has(a.id))-Number(seen.has(b.id))||Math.abs(a.problem_number-target)-Math.abs(b.problem_number-target)||a.year-b.year||a.problem_number-b.problem_number);
 return pool;
}
function pickAndMark(){
 const base=window.amc8V0641PickDaily?window.amc8V0641PickDaily():[];
 const queue=rebuildQueue().tasks.filter(t=>t.status==='pending'&&t.due&&t.due<=today()).sort((a,b)=>b.priority-a.priority||a.due.localeCompare(b.due));
 const selected=[],ids=new Set();const matched=[];
 for(const t of queue){if(selected.length>=2)break;const q=candidates(t,ids)[0];if(!q)continue;selected.push(q);ids.add(q.id);matched.push({qid:q.id,key:t.key,source:t.source,skill:t.skill});}
 for(const q of base){if(selected.length>=3)break;if(!ids.has(q.id)){selected.push(q);ids.add(q.id)}}
 if(selected.length<3){for(const q of eligibleDailyBank()){if(selected.length===3)break;if(!ids.has(q.id)){selected.push(q);ids.add(q.id)}}}
 // Store evidence only in session display; the paper lock is authored by dailyPlan(), never rewritten.
 window.amcV065Planned=matched;
 return selected.slice(0,3);
}
// The earlier v0.6.4.2.8 proactive rebuild may use generateDailyPlan(exclusions).
// Keep that contract: exclude old question IDs for explicit regeneration, otherwise use the due queue.
const priorGenerate=generateDailyPlan;
generateDailyPlan=function(excludeIds){
 const exclusion=excludeIds instanceof Set?excludeIds:new Set();
 if(exclusion.size){const p=priorGenerate(exclusion);return p.filter(q=>!exclusion.has(q.id));}
 return pickAndMark();
};
function reviewText(){const tasks=rebuildQueue().tasks;const pending=tasks.filter(t=>t.status==='pending');const due=pending.filter(t=>t.due<=today());const missing=due.filter(t=>!candidates(t,new Set()).length);
 let text='<div class="card" style="margin:12px 0"><h3>专项复测队列</h3>';
 text+='<p class="small">待复测 '+pending.length+' 项；当前到期 '+due.length+' 项。每天最多占用2道题，第3题保留能力拓展。家长确认标签按同技能迁移；PDF方法资料按方法分组匹配未做过的新题。PDF分类仅是待核对候选，不视为已掌握；找不到同组新题时保留待匹配状态。</p>';
 if(pending.length){text+='<table><tr><th>考点</th><th>来源</th><th>验收阶段</th><th>下次日期</th></tr>';
 for(const t of pending.slice(0,12))text+='<tr><td>'+safe(t.skill)+'</td><td>'+safe(t.source)+'</td><td>'+['次日迁移','7天保持','14天进阶','30天回测'][Math.min(3,t.stage)]+'</td><td>'+safe(t.due)+(missing.includes(t)?'（暂无未做过的同方法真题，待匹配）':'')+'</td></tr>';
 text+='</table>';}else text+='<p class="small">暂无待复测任务。提交错题后自动建立。</p>';
 if(rebuildQueue().unidentified.length)text+='<p class="small">另有 '+rebuildQueue().unidentified.length+' 条历史作答缺少可靠方法标签；已保留但不自动猜分类。</p>';
 text+='</div>';return text;
}
const oldReport=renderReport;
renderReport=function(){oldReport();const node=document.getElementById('report');if(node)node.insertAdjacentHTML('beforeend',reviewText());};
// Weekend answer capture - parent can assign reasons before submitting.
const oldMock=renderMock;
renderMock=function(){oldMock();const node=document.getElementById('mock');if(!node||(S.printable_mock_ids||[]).length!==25)return;
 const id=ensurePaperId(),d=currentDraft();d.error_types=d.error_types||{};
 const wrap=document.createElement('section');wrap.className='card';wrap.style.margin='13px 0';wrap.innerHTML='<h3>周末25题：错因标记与提交</h3><p class="small">先在上方「逐题看题录答案」录入25个答案；这里可对答错、不会和未做的题标记原因。未判断可保留「待核对」。最后点击「提交整套记录」。</p><div id="v065mockReasons"></div>';
 const anchor=node.querySelector('#mockQuestionBox');const block=anchor?.closest('.card');if(block)block.after(wrap);else node.append(wrap);
 const out=wrap.querySelector('#v065mockReasons');
 out.innerHTML='<div style="display:flex;gap:8px;flex-wrap:wrap">'+[...Array(25)].map((_,i)=>'<label style="font-size:12px">Q'+(i+1)+' <select data-mock-error="'+i+'"><option value="unsure">待核对</option>'+validTypes.filter(x=>x!=='unsure').map(x=>'<option value="'+x+'" '+(d.error_types[String(i)]===x?'selected':'')+'>'+typeNames[x]+'</option>').join('')+'</select></label>').join('')+'</div>';
 out.querySelectorAll('select').forEach(el=>{if(d.error_types[el.dataset.mockError])el.value=d.error_types[el.dataset.mockError];el.addEventListener('change',()=>{d.error_types[el.dataset.mockError]=el.value;saveStateLocal();})});
 const btn=document.createElement('button');btn.className='primary';btn.textContent='提交25题答案并安排同方法迁移复测';btn.onclick=()=>submitPrintableMockAnswers();wrap.append(btn);
};
const oldSubmitMock=submitPrintableMockAnswers;
submitPrintableMockAnswers=function(){const prev=(S.mock_detail_history||[]).length;const id=S.printable_mock_id;const draft=S.mock_drafts?.[id];
 const res=oldSubmitMock.apply(this,arguments);
 if((S.mock_detail_history||[]).length!==prev+1)return res;
 const reasons=draft?.error_types||{};
 for(const a of S.attempts||[]){
  if(a.source!=='weekend_mock'||a.paper_id!==id)continue;
  const idx=a.paper_question_index-1,reason=reasons[String(idx)]||'unsure';
  // An independently correct answer is normally a pass, but a parent-marked time issue must remain reviewable.
  if(a.correct&&!a.guessed&&reason!=='time_issue')continue;
  a.error_type=reason==='unsure'?null:reason;
  a.error_detail=reason==='unsure'?'parent_review_pending':(reason==='time_issue'&&a.correct?'correct_but_slow':reason);
 }
 const detail=S.mock_detail_history.at(-1);if(detail)detail.error_types={...reasons};
 rebuildQueue();saveStateLocal();renderAll();return res;
};
const oldSubmitDaily=submitDailyPaperResults;
submitDailyPaperResults=function(){const prev=(S.daily_sessions||[]).length;const res=oldSubmitDaily.apply(this,arguments);if((S.daily_sessions||[]).length===prev+1){rebuildQueue();saveStateLocal();}return res;};
window.amc8V065Queue=()=>rebuildQueue();
// Reconcile existing history without touching the original attempts or their saved scores.
try{rebuildQueue()}catch(e){console.warn('AMC review queue deferred',e)}
})();
