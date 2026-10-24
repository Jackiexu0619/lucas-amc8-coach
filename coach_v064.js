/* Lucas AMC8 Coach v0.6.5.15: dual-mode paper engine + reviewed skill evidence.
   Does not create AI questions. No backend or authentication changes. */
(function(){
'use strict';
const RESERVED_YEARS=[2023,2022,2020,2019,2018,2017];
const MODES=['personalized','diagnostic'];
const SKILLS=['因数与倍数','余数与整除','质因数分解与因数个数','排列与空位法','分类计数与容斥','递推与路径','概率与补集','面积与面积比','相似三角形','坐标变换','比例与行程','代数方程','数列与周期','数据与平均数','逻辑推理','其他'];
const tagFor=q=>S.v064_question_tags?.[q.id]?.status==='reviewed'?S.v064_question_tags[q.id].skill:null;
const pool=()=>Array.isArray(ARCHIVE_BANK)?ARCHIVE_BANK:[];
const attempts=()=>Array.isArray(S.attempts)?S.attempts:[];
const recent=(a,days)=>a.date && (new Date(today())-new Date(a.date))/86400000<=days;
const isIndependent=a=>a.correct&&!a.guessed&&a.result_status!=='skipped'&&a.result_status!=='unable';
const allQuestionIDs=()=>new Set(attempts().map(x=>x.question_id));
function capabilities(){return pool().length===575}
function getMode(){return S.v064_weekend_mode==='diagnostic'?'diagnostic':'personalized'}
function setMode(m){
 if(!MODES.includes(m))return;
 if((S.printable_mock_ids||[]).length===25){
  if(!confirm('切换模式将放弃当前尚未提交的周末卷，并重新生成卷号；历史提交记录不会删除。确定继续吗？'))return;
  S.printable_mock_ids=[];S.printable_mock_id=null;
 }
 S.v064_weekend_mode=m;saveStateLocal();renderAll();
}
window.amc8V064SetMode=setMode;
function skillEvidence(skill){
 const rows=attempts().filter(a=>{const q=qById(a.question_id);return q&&tagFor(q)===skill});
 const indep=rows.filter(isIndependent), wrong=rows.filter(a=>!a.correct||a.guessed), slow=indep.filter(a=>a.error_detail==='correct_but_slow'||a.error_type==='time_issue');
 const days=new Set(indep.map(a=>a.date));
 return {skill,attempts:rows.length,distinct:new Set(rows.map(a=>a.question_id)).size,independent:indep.length,wrong:wrong.length,slow:slow.length,independent_days:days.size,
  status:rows.length<3?'证据不足':(indep.length>=3&&days.size>=2&&wrong.length<=1?'初步稳定':wrong.length>=2?'需要加强':'继续复测')};
}
window.amc8V064Ability=()=>SKILLS.map(skillEvidence).filter(x=>x.attempts);
function candidateValue(q,position,used,recordsBySkill){
 const skill=tagFor(q),e=skill?recordsBySkill.get(skill):null;
 const same=used.filter(x=>x.year===q.year).length;
 const practiced=attempts().some(a=>a.question_id===q.id);
 const weekSeen=attempts().some(a=>a.question_id===q.id&&recent(a,30));
 const weakness=e&&e.attempts>=2?(e.wrong+e.slow*.35)/e.attempts:0;
 const diversity=used.some(x=>tagFor(x)&&tagFor(x)===skill)?-1.2:0;
 return weakness*(position>=9?6:2)+diversity-same*.33-(practiced?50:0)-(weekSeen?150:0)+stableNoise('v064:'+q.id)*.2;
}
// Retired legacy picker retained for audit; production personalized papers use the reviewed adaptive selector.
function pickPersonalizedLegacy(){
 const allowed=pool().filter(q=>!RESERVED_YEARS.includes(q.year));
 const e=new Map(SKILLS.map(s=>[s,skillEvidence(s)]));
 const picked=[];
 for(let pos=1;pos<=25;pos++){
  const options=allowed.filter(q=>q.problem_number===pos&&!picked.some(x=>x.id===q.id));
  if(!options.length)throw Error('Q'+pos+' 缺少有效真题');
  options.sort((a,b)=>candidateValue(b,pos,picked,e)-candidateValue(a,pos,picked,e));
  picked.push(options[0]);
 }
 return picked;
}
function pickDiagnostic(){
 const seen=allQuestionIDs(),locked=new Set((S.printable_mock_ids||[]));
 const available=RESERVED_YEARS.map(y=>pool().filter(q=>q.year===y).sort((a,b)=>a.problem_number-b.problem_number))
  .filter(arr=>arr.length===25 && arr.every((q,i)=>q.problem_number===i+1&&!seen.has(q.id)&&!locked.has(q.id)));
 if(!available.length)throw Error('预留的完整年份均已被接触或不完整，不能保证盲测；请审核预留年份，不能自动降级为旧题。');
 return available[0];
}
// Existing buildPrintableMock() owns paper_id allocation. Personalized mode must use the reviewed adaptive selector.
buildPrintableMockCore=function(){
 if(!capabilities()){alert('双语真题库未完整加载，不能生成新试卷。');return false}
 if(getMode()==='personalized'){
  const allowedArchive=pool().filter(q=>!RESERVED_YEARS.includes(q.year));
  const built=buildArchiveMockCore({archive:allowedArchive,reservedYears:RESERVED_YEARS});
  if(!built)return false;
  S.printable_mock_meta={...(S.printable_mock_meta||{}),paper_type:'personalized_practice',is_ai_generated:false,
   note:'个性化真题训练卷（非AI原创），分数不用于真实AMC8成绩预测；完整年份诊断预留年份不进入此模式。'};
  saveStateLocal();
  return true;
 }
 let chosen;
 try{chosen=pickDiagnostic()}catch(e){alert(e.message);return false}
 S.printable_mock_ids=chosen.map(q=>q.id);S.printable_mock_date=today();
 S.printable_mock_meta={engine:'v064_skill_based_v1',engine_version:'0.6.5.15',paper_type:'diagnostic',
  is_ai_generated:false,source_years:[...new Set(chosen.map(q=>q.year))],
  note:'未见过的完整年份真题诊断卷；只使用预留年份并保留完整原卷顺序。'};
 saveStateLocal();return chosen;
};
const priorDaily=eligibleDailyBank;
eligibleDailyBank=function(){return priorDaily().filter(q=>!RESERVED_YEARS.includes(q.year))};
const priorSubmit=submitPrintableMockAnswers;
submitPrintableMockAnswers=function(){
 const before=(S.mock_history||[]).length;
 const kind=S.printable_mock_meta?.paper_type;
 priorSubmit();
 if((S.mock_history||[]).length===before+1 && kind){
  const h=S.mock_history.at(-1),d=S.mock_detail_history?.at(-1);
  h.kind=kind==='diagnostic'?'真题诊断':'个性化训练';
  h.count_in_estimate=kind==='diagnostic';
  h.v064_paper_type=kind;
  if(d)d.v064_paper_type=kind;
  saveStateLocal();renderAll();
 }
};
function addReviewedTag(){
 const id=document.getElementById('v064-tag-qid')?.value?.trim();
 const skill=document.getElementById('v064-tag-skill')?.value;
 if(!id||!skill)return;
 const q=qById(id);
 if(!q||!q.archive_image){alert('题目ID不存在，请核对格式，例如 archive_2015_17');return}
 if(!confirm('确认已经看过 '+q.year+' Q'+q.problem_number+' 的题目及解法，主要技能标注为「'+skill+'」？'))return;
 S.v064_question_tags=S.v064_question_tags||{};
 S.v064_question_tags[id]={skill,status:'reviewed',reviewed_at:new Date().toISOString(),method:'human_confirmed'};
 saveStateLocal();renderMock();
}
window.amc8V064Tag=addReviewedTag;
const oldMockRender=renderMock;
renderMock=function(){
 oldMockRender();const node=document.getElementById('mock');if(!node)return;
 const locked=(S.printable_mock_ids||[]).length===25;
 const mode=getMode(),counts=window.amc8V064Ability();
 const bar=document.createElement('div');bar.className='card';bar.style.marginBottom='12px';
 bar.innerHTML='<h3>v0.6.5.15 · 周末训练模式</h3><p class="small">当前使用历年真题，尚非 AI 原创。个性化训练卷不计入真实模拟成绩预测；诊断卷严格保留完整未见过的年份。</p>'+
 '<div class="row"><button id="v064-p">个性化真题卷 '+(mode==='personalized'?'✓':'')+'</button><button id="v064-d">完整年份诊断卷 '+(mode==='diagnostic'?'✓':'')+'</button></div>'+
 '<p class="small">已确认技能标签：'+Object.keys(S.v064_question_tags||{}).filter(k=>S.v064_question_tags[k].status==='reviewed').length+' 题；有练习证据的技能：'+counts.length+' 类。缺少标签时按真实题号难度与历史避重复规则保守出卷。</p>'+
 '<details><summary>家长核对知识点标签（需先看题和解析）</summary><div class="row" style="margin-top:8px"><input id="v064-tag-qid" placeholder="archive_2015_17" style="max-width:190px"><select id="v064-tag-skill">'+SKILLS.map(s=>'<option>'+s+'</option>').join('')+'</select><button id="v064-tag-add">保存已审核标签</button></div><p class="small">未人工确认的标签不进入技能评分；标签随原本的训练状态云同步。</p></details>';
 node.prepend(bar);
 bar.querySelector('#v064-p').onclick=()=>setMode('personalized');
 bar.querySelector('#v064-d').onclick=()=>setMode('diagnostic');
 bar.querySelector('#v064-tag-add').onclick=addReviewedTag;
};
})();
