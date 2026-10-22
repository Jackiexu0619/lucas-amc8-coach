/* Lucas AMC8 Coach v0.6.4.1 — audited skill tags + explainable daily selection.
 * No fabricated auto-tags. This module extends existing v0.6.4; legacy data preserved.
 */
(function(){
'use strict';
const SKILLS=['因数与倍数','余数与整除','质因数分解与因数个数','排列与空位法','分类计数与容斥','递推与路径','概率与补集','面积与面积比','相似三角形','坐标变换','比例与行程','代数方程','数列与周期','数据与平均数','逻辑推理','其他'];
const safe=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const tags=()=>S.v064_question_tags||{};
const skill=q=>tags()[q.id]?.status==='reviewed'?tags()[q.id].skill:null;
const all=()=>Array.isArray(ARCHIVE_BANK)?ARCHIVE_BANK:[];
const attempts=()=>Array.isArray(S.attempts)?S.attempts:[];
const unique=a=>[...new Set(a)];
const todayDate=()=>today();
function evidence(){
 const by=new Map();for(const k of SKILLS)by.set(k,{skill:k,n:0,independent:0,fail:0,guess:0,slow:0,questions:new Set(),days:new Set(),last:null});
 for(const a of attempts()){
  const q=qById(a.question_id);if(!q)continue;const k=skill(q);if(!k||!by.has(k))continue;
  const e=by.get(k);e.n++;e.questions.add(a.question_id);e.last=a.date>=(e.last||'')?a.date:e.last;
  const independent=a.correct&&!a.guessed&&!['skipped','unable'].includes(a.result_status);
  if(independent){e.independent++;e.days.add(a.date);if(a.error_detail==='correct_but_slow'||a.error_type==='time_issue')e.slow++}
  if(!a.correct)e.fail++;if(a.guessed)e.guess++;
 }
 return [...by.values()].map(e=>({skill:e.skill,n:e.n,independent:e.independent,fail:e.fail,guess:e.guess,slow:e.slow,questions:e.questions.size,days:e.days.size,last:e.last,
   status:e.n<3||e.questions.size<2?'证据不足':(e.independent>=3&&e.days.size>=2&&e.fail<=1&&e.guess===0?'初步稳定':(e.fail+e.guess>=2?'需要加强':'继续复测')),
   weak:e.n?(e.fail+e.guess*.8+e.slow*.35)/e.n:0}));
}
window.amc8V0641Evidence=evidence;
function tagStatus(){const p=all();let reviewed=0;for(const q of p)if(skill(q))reviewed++;return {total:p.length,reviewed,pending:p.length-reviewed}}
function setLabel(qid,label){
 const q=qById(qid);if(!q||!q.archive_image||!SKILLS.includes(label))throw Error('题目或标签无效');
 S.v064_question_tags=S.v064_question_tags||{};
 S.v064_question_tags[qid]={skill:label,status:'reviewed',reviewed_at:new Date().toISOString(),method:'parent_verified_on_image'};
 saveStateLocal();return q;
}
window.amc8V0641SetTag=setLabel;
// Read-only capability for tests and analysis.
function pickDaily(){
 const pool=eligibleDailyBank();if(pool.length<3)return [];
 const ev=new Map(evidence().map(x=>[x.skill,x]));const selected=[];
 const existingToday=new Set((S.daily_plan?.date===today()?S.daily_plan.question_ids:[])||[]);
 const chosenSkill=new Set();
 const at=(target,min,max,objective)=>{
  const c=pool.filter(q=>q.problem_number>=min&&q.problem_number<=max&&!selected.some(x=>x.id===q.id));
  c.sort((a,b)=>score(b,target,objective)-score(a,target,objective));
  const q=c[0];if(q){selected.push(q);if(skill(q))chosenSkill.add(skill(q))}return q;
 };
 function score(q,target,objective){
  const k=skill(q),e=ev.get(k);let s=-Math.abs(q.problem_number-target)*1.3;
  if(e&&e.n>=2){if(objective==='weak')s+=Math.min(6,e.weak*7);if(objective==='review')s+=e.status==='需要加强'?3:e.status==='继续复测'?2:0;}
  if(k&&chosenSkill.has(k))s-=5;
  if(k&&e?.status==='初步稳定')s-=2;
  if(!k)s-=objective==='breakthrough'?0:0.75; // uncertain labels have no fabricated weakness
  if(existingToday.has(q.id))s+=0.01;
  // Favor novel questions, but eligibility already enforces question-specific cooldown.
  if(attempts().some(a=>a.question_id===q.id))s-=3;
  s+=stableNoise('skill_daily_v0641:'+q.id)*.15;
  return s;
 }
 at(16,13,19,'weak');at(17,14,21,'review');at(new Date().getDay()===5?23:20,17,25,'breakthrough');
 if(selected.length<3){for(const q of pool){if(selected.length===3)break;if(!selected.some(x=>x.id===q.id))selected.push(q)}}
 return selected.slice(0,3);
}
window.amc8V0641PickDaily=pickDaily;
// Override just the NEW daily selection, not dailyPlan/lockedDailyPlan — locks remain authoritative.
generateDailyPlan=pickDaily;
function dataForReview(){
 const options=all().filter(q=>q.problem_number>=13&&!skill(q));
 // Prioritize recent attempted questions so tagging immediately improves evidence.
 const seen=new Set(attempts().map(a=>a.question_id));
 options.sort((a,b)=>Number(seen.has(b.id))-Number(seen.has(a.id))||b.problem_number-a.problem_number||b.year-a.year);
 return options;
}
let reviewId=null;
function showReview(){
 const root=document.getElementById('v0641-review');if(!root)return;
 const options=dataForReview(),stat=tagStatus();
 if(!reviewId||!options.some(x=>x.id===reviewId))reviewId=options[0]?.id;
 const q=options.find(x=>x.id===reviewId);
 root.innerHTML='<h3>能力训练 · 真题知识点核对</h3><p class="small">已审核 '+stat.reviewed+' / '+stat.total+' 道；未审核 '+stat.pending+' 道。只允许看过原题后确认，不根据题号猜标签。</p>'+
  (!q?'<p>所有题目均已审核。</p>':'<div class="row" style="gap:8px;flex-wrap:wrap"><label>待审核真题 <select id="v0641-qpick" style="max-width:240px">'+options.slice(0,180).map(x=>'<option value="'+safe(x.id)+'" '+(x.id===reviewId?'selected':'')+'>'+x.year+' Q'+x.problem_number+(new Set(attempts().map(a=>a.question_id)).has(x.id)?' · 做过':'')+'</option>').join('')+'</select></label><label>主要技能 <select id="v0641-skill">'+SKILLS.map(x=>'<option>'+x+'</option>').join('')+'</select></label><button id="v0641-save">看过题目，确认标签</button><button id="v0641-next">下一题</button></div><div style="max-width:680px;margin:10px auto"><img src="'+safe(q.archive_image)+'" alt="'+q.year+' AMC8 Q'+q.problem_number+'" style="width:100%;height:auto"></div>')+
  '<p class="small">有图形或多知识点的题，先标主方法；如果无法明确识别，保持未审核并跳过。此处修改会通过现有训练状态同步。</p>';
 if(!q)return;
 root.querySelector('#v0641-qpick').onchange=e=>{reviewId=e.target.value;showReview()};
 root.querySelector('#v0641-next').onclick=()=>{reviewId=options[(options.findIndex(x=>x.id===q.id)+1)%options.length]?.id;showReview()};
 root.querySelector('#v0641-save').onclick=()=>{const k=root.querySelector('#v0641-skill').value;if(!confirm('确认已核对 '+q.year+' 年 Q'+q.problem_number+' 的题干与方法，主技能是「'+k+'」？'))return;setLabel(q.id,k);showReview();renderPractice();renderReport()};
}
window.amc8V0641ShowReview=showReview;
function reviewPanel(){
 const node=document.getElementById('bank');if(!node)return;
 let el=document.getElementById('v0641-review');if(!el){el=document.createElement('div');el.id='v0641-review';el.className='card';node.prepend(el)}
 showReview();
}
const beforeBank=renderBank;
renderBank=function(){beforeBank();reviewPanel()};
const beforeReport=renderReport;
renderReport=function(){beforeReport();const node=document.getElementById('report');if(!node)return;
 const data=evidence().filter(x=>x.n),stat=tagStatus();const el=document.createElement('div');el.className='card';el.style.marginBottom='12px';
 el.innerHTML='<h3>v0.6.4.1 · 已审核技能证据</h3><p class="small">已核对 '+stat.reviewed+' / '+stat.total+' 道题；未审核题不参与以下技能判断。猜对不算独立正确，样本不足明确标示。</p>'+
 (data.length?'<table><tr><th>技能</th><th>记录</th><th>独立正确</th><th>错/猜</th><th>跨天</th><th>状态</th></tr>'+data.sort((a,b)=>b.weak-a.weak).map(x=>'<tr><td>'+safe(x.skill)+'</td><td>'+x.n+'</td><td>'+x.independent+'</td><td>'+x.fail+'/'+x.guess+'</td><td>'+x.days+'</td><td>'+x.status+'</td></tr>').join('')+'</table>':'<p class="small">还没有足够的已核对技能记录；进入「训练题库」看题图并核对标签后，这里会自动出现证据。</p>');node.prepend(el);
};
// Add visible reason text without regenerating current locked paper.
const beforePractice=renderPractice;
renderPractice=function(){beforePractice();const node=document.getElementById('practice');if(!node)return;
 const q=S.daily_plan?.date===today()?S.daily_plan.question_ids.map(qById).filter(Boolean):[];
 if(q.length!==3)return;
 const el=document.createElement('div');el.className='card';el.style.marginBottom='10px';
 el.innerHTML='<h3>今日选题依据</h3>'+q.map((x,i)=>'<p><b>第'+(i+1)+'题：</b>'+['弱项训练','复测验证','能力突破'][i]+' · '+safe(x.year+' AMC8 Q'+x.problem_number)+' · '+(skill(x)?'已核对技能：'+safe(skill(x)):'知识点未核对，按题号难度保守选取')+'</p>').join('');node.prepend(el);
};
})();
