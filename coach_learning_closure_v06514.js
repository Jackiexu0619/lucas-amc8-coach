/* Lucas AMC8 Coach v0.6.5.14 — active archive selection and learning closure. */
(function(root) {
'use strict';
if (root.__amcLearningClosureV06514) return;
root.__amcLearningClosureV06514 = true;

const POSITIONS = [4,8,11,14,17,20,23];
const norm = v => String(v ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g,' ').trim();
const placeholder = v => !v || /^archive_(unclassified|method)_/i.test(String(v)) || /^official_.+_band\d+$/i.test(String(v));
const getState = () => typeof S !== 'undefined' ? S : (root.S || {});
const tagMapOf = value => value instanceof Map ? value : new Map(Object.entries(value || {}));
const ageDays = (date,today) => {
  if (!date || !today) return 99999;
  const a=Date.parse(String(date).slice(0,10)+'T00:00:00Z'), b=Date.parse(String(today).slice(0,10)+'T00:00:00Z');
  return Number.isFinite(a)&&Number.isFinite(b)?Math.round((b-a)/86400000):99999;
};

function dailyQuestionCooldownIds(state={},today=new Date().toISOString().slice(0,10),days=30) {
  const ids=new Set();
  const addList=value=>{for(const id of Array.isArray(value)?value:[])if(id)ids.add(id);};
  const addRecent=(id,date)=>{
    if(!id)return;
    const age=ageDays(date,today);
    if(age>=0&&age<=days)ids.add(id);
  };
  for(const a of Array.isArray(state.attempts)?state.attempts:[]) {
    addRecent(a&&a.question_id,a&&(a.date||a.submitted_at||a.created_at));
  }
  for(const m of Array.isArray(state.mock_detail_history)?state.mock_detail_history:[]) {
    const date=m&&(m.date||m.mock_date||m.submitted_at||m.created_at);
    const age=ageDays(date,today);
    if(age<0||age>days)continue;
    addList(m.question_ids);
    for(const row of Array.isArray(m.per_question)?m.per_question:[]) {
      if(row)addRecent(row.qid||row.question_id,date);
    }
  }
  // A currently locked weekend paper is protected even before its answers are submitted.
  addList(state.printable_mock_ids);
  // A pending daily paper must not be silently reused by a newly generated plan.
  const daily=state.daily_plan;
  if(daily&&Array.isArray(daily.question_ids)) {
    const age=ageDays(daily.date,today);
    if(daily.submitted!==true||(age>=0&&age<=days))addList(daily.question_ids);
  }
  return ids;
}

function resolveTags(q,state={},tagMap=new Map()) {
  if(!q)return {skill:'',method:'',groupKey:'',group_key:'',topic:'',domain:'',source:'unmapped',confidence:'unknown'};
  const external=tagMapOf(tagMap).get(q.id)||{};
  const parent=(state.v064_question_tags||{})[q.id]||{};
  const local=(state.v064_specific_skills||{})[q.id]||{};
  const parentOk=parent.status==='reviewed'&&!!parent.skill;
  const localOk=local.status==='pdf_explanation_reviewed'&&!!local.skill;
  const bankOk=external.quality_gate==='pdf_explanation_reviewed'&&!!external.reviewed_skill&&!!external.reviewed_method;
  const archived=String(q.id||'').startsWith('archive_');
  const skill=parentOk?String(parent.skill):localOk?String(local.skill):bankOk?String(external.reviewed_skill):(!archived&&!placeholder(q.skill)?String(q.skill||''):'');
  const method=(parentOk&&parent.method)?String(parent.method):(localOk&&local.method)?String(local.method):bankOk?String(external.reviewed_method):(!archived&&!placeholder(q.core_method)?String(q.core_method||''):'');
  const groupKey=String((parentOk&&parent.group_key)||(localOk&&local.group_key)||(bankOk&&external.group_key)||q.group_key||'');
  const topic=String((localOk&&local.source_topic)||(bankOk&&external.source_topic)||q.source_topic||'');
  const domain=q.domain&&q.domain!=='misc'?String(q.domain):'';
  const source=parentOk?'家长确认标签':localOk?'本地PDF方法资料':bankOk?'只读PDF方法资料':(skill||method)?'题库原有标签':'未可靠映射';
  return {skill,method,groupKey,group_key:groupKey,topic,source_topic:topic,domain,source,
    confidence:parentOk?'parent_reviewed':(localOk||bankOk)?'pdf_method_reviewed_not_math_verified':(skill||method)?'source_metadata':'unknown',
    mathIndependentlyVerified:local.independent_math_verified===true||external.math_independently_verified===true};
}
function cleanTag(value) {
  const t=value||{};
  return {skill:String(t.skill||t.reviewed_skill||''),method:String(t.method||t.reviewed_method||''),
    groupKey:String(t.groupKey||t.group_key||''),group_key:String(t.groupKey||t.group_key||''),
    topic:String(t.topic||t.source_topic||''),source_topic:String(t.topic||t.source_topic||''),
    domain:String(t.domain||''),source:String(t.source||''),confidence:String(t.confidence||'')};
}
function mapped(value) {
  const t=cleanTag(value);
  return !!(t.groupKey||(!placeholder(t.skill)&&t.skill)||(!placeholder(t.method)&&t.method));
}
function classifyMatch(candidate,weak) {
  const a=cleanTag(candidate),b=cleanTag(weak);
  if(a.method&&b.method&&norm(a.method)===norm(b.method))return {type:'同解法描述',strength:8};
  if(a.groupKey&&b.groupKey&&norm(a.groupKey)===norm(b.groupKey))return {type:'同标签组（题库标注）',strength:4.5};
  if(a.skill&&b.skill&&norm(a.skill)===norm(b.skill))return {type:'同知识点',strength:1.6};
  if(a.topic&&b.topic&&norm(a.topic)===norm(b.topic))return {type:'同题库主题',strength:.5};
  return null;
}
function matchesFor(candidate,records) {
  return (records||[]).map(r=>{
    const m=classifyMatch(candidate,r.tags||{});if(!m)return null;
    const severity=Number.isFinite(+r.severity)?+r.severity:1,age=Math.max(0,Number.isFinite(+r.age)?+r.age:0);
    return {question_id:r.question_id||'',skill:(r.tags||{}).skill||'',method:(r.tags||{}).method||'',
      group_key:(r.tags||{}).groupKey||(r.tags||{}).group_key||'',match_type:m.type,match_strength:m.strength,
      reason:r.reason||'本周薄弱记录',weight:severity/(1+age/4)};
  }).filter(Boolean).sort((a,b)=>(b.match_strength*b.weight)-(a.match_strength*a.weight));
}
function affinityFor(candidate,records) {
  return matchesFor(candidate,records).reduce((sum,m)=>sum+m.match_strength*m.weight,0);
}
function summarizeWeakness(records) {
  const groups=new Map();
  for(const r of records||[]){
    const t=cleanTag(r.tags||{});if(!mapped(t))continue;
    const key=t.groupKey?'group:'+norm(t.groupKey):t.skill?'skill:'+norm(t.skill):'method:'+norm(t.method);
    if(!groups.has(key))groups.set(key,{skill:t.skill||'未标注',method:t.method||'',group_key:t.groupKey||'',topic:t.topic||'',count:0,weight:0,question_ids:[],dates:[]});
    const g=groups.get(key),sev=Number.isFinite(+r.severity)?+r.severity:1,age=Math.max(0,Number.isFinite(+r.age)?+r.age:0);
    g.count++;g.weight+=sev/(1+age/4);
    if(r.question_id&&!g.question_ids.includes(r.question_id))g.question_ids.push(r.question_id);
    if(r.date&&!g.dates.includes(r.date))g.dates.push(r.date);
    if(!g.method&&t.method)g.method=t.method;
  }
  return [...groups.values()].sort((a,b)=>b.weight-a.weight).slice(0,8);
}
function latestCompleteMockDetail(state={}) {
  const history=Array.isArray(state.mock_detail_history)?state.mock_detail_history:[];
  for(let i=history.length-1;i>=0;i--){
    const row=history[i];
    if(row&&Array.isArray(row.per_question)&&row.per_question.length===25)return row;
  }
  return null;
}
function selectionEvidenceFor(state={},latest=latestCompleteMockDetail(state)) {
  if(latest){
    const evidence=latest.selection_meta;
    return evidence&&Array.isArray(evidence.weekly_weakness_coverage)?evidence:null;
  }
  const current=state.printable_mock_meta;
  return current&&Array.isArray(current.weekly_weakness_coverage)?current:null;
}
function selectArchivePaper(options={}) {
  const sourceBank=Array.isArray(options.bank)?options.bank:[];
  const reservedYears=new Set((Array.isArray(options.reservedYears)?options.reservedYears:[]).map(Number).filter(Number.isFinite));
  const bank=sourceBank.filter(q=>!reservedYears.has(Number(q&&q.year)));
  const state=options.state||{},tagMap=tagMapOf(options.tagMap);
  const today=options.today||new Date().toISOString().slice(0,10),random=typeof options.randomFn==='function'?options.randomFn:Math.random;
  const allWeak=(options.weakRecords||[]).map(r=>({...r,tags:cleanTag(r.tags||{})}));
  const mappedWeak=allWeak.filter(r=>mapped(r.tags)),unmappedCount=allWeak.length-mappedWeak.length;
  const recentMocks=new Set();
  for(const m of (state.mock_detail_history||[]).slice(-4)){
    for(const id of m.question_ids||[])recentMocks.add(id);
    for(const row of m.per_question||[])if(row&&row.qid)recentMocks.add(row.qid);
  }
  const recentWeekdays=new Set(),attempts=Array.isArray(state.attempts)?state.attempts:[];
  for(const a of attempts){const age=ageDays(a.date,today);if(a.question_id&&a.source!=='weekend_mock'&&age>=0&&age<=7)recentWeekdays.add(a.question_id);}
  const recent=new Set([...(state.printable_mock_ids||[]),...recentMocks,...recentWeekdays]);
  const attempted=new Set(attempts.map(a=>a&&a.question_id).filter(Boolean));
  const chosen=[],used=new Set(),yearUse={},groupUse={},coverage=[];
  for(let pos=1;pos<=25;pos++){
    const eligible=bank.filter(q=>Number(q.problem_number??q.number)===pos&&!used.has(q.id));
    let pool=eligible.filter(q=>!attempted.has(q.id)&&!recent.has(q.id)),reuse='unseen_nonrecent';
    if(!pool.length){pool=eligible.filter(q=>!recent.has(q.id));reuse='reuse_nonrecent';}
    if(!pool.length){pool=eligible;reuse='recent_fallback_only_no_alternative';}
    if(!pool.length)return null;
    const personalized=POSITIONS.includes(pos-1);
    const ranked=pool.map(q=>{
      const t=resolveTags(q,state,tagMap),matches=personalized?matchesFor(t,mappedWeak):[];
      const group=t.groupKey||t.skill||'',repeat=group?(groupUse[group]||0):0;
      const score=(personalized?affinityFor(t,mappedWeak)-repeat*1.25:0)-(yearUse[q.year]||0)*.45+random()*.15;
      return {q,t,matches,score,reuse};
    }).sort((a,b)=>b.score-a.score);
    const pick=ranked[0],q=pick.q;
    chosen.push(q);used.add(q.id);yearUse[q.year]=(yearUse[q.year]||0)+1;
    const group=pick.t.groupKey||pick.t.skill||'';if(group)groupUse[group]=(groupUse[group]||0)+1;
    if(personalized){
      const matches=pick.matches.slice(0,3).map(m=>({question_id:m.question_id,skill:m.skill,method:m.method,group_key:m.group_key,match_type:m.match_type,reason:m.reason}));
      const reason=matches.length?'按本周薄弱记录的标签匹配提高优先级；匹配类型逐项标明':
        allWeak.length&&!mappedWeak.length?'存在周中薄弱记录，但标签不足，未强行匹配':
        allWeak.length?'未找到可靠的同解法/同标签组候选，按原题号难度与去重规则选题':
        '本周暂无符合条件的周中薄弱记录，按原题号难度与去重规则选题';
      coverage.push({position:pos,question_id:q.id,skill:pick.t.skill||null,method:pick.t.method||null,group_key:pick.t.groupKey||null,
        matched:matches.length>0,matches,selection_reason:reason,reuse_policy:pick.reuse});
    }
  }
  return {questions:chosen,meta:{
    tag_bank_status:options.tagBankStatus||'unknown',tag_bank_count:tagMap.size,
    reserved_years_excluded:[...reservedYears].sort((a,b)=>a-b),reserved_year_filter_applied:reservedYears.size>0,
    weekly_weakness_attempt_count:allWeak.length,weekly_weakness_mapped_count:mappedWeak.length,weekly_weakness_unmapped_count:unmappedCount,
    weekly_weakness_focus:summarizeWeakness(mappedWeak),personalized_positions:POSITIONS.map(p=>p+1),weekly_weakness_coverage:coverage
  }};
}
root.__amcDailyQuestionCooldownIds=dailyQuestionCooldownIds;
if(typeof module!=='undefined'&&module.exports){
  module.exports={POSITIONS,resolveTags,classifyMatch,matchesFor,affinityFor,summarizeWeakness,selectArchivePaper,dailyQuestionCooldownIds,latestCompleteMockDetail,selectionEvidenceFor};
  return;
}

let tagMap=new Map(),tagBankStatus='loading',tagBankError='';
function readCurrentTag(id){
  const state=getState(),local=(state.v064_specific_skills||{})[id]||{},external=tagMap.get(id);
  if(local.status==='pdf_explanation_reviewed'&&local.skill)return local;
  if(!external)return null;
  return {id:external.id,skill:external.reviewed_skill,method:external.reviewed_method,group_key:external.group_key||external.reviewed_skill,
    source_topic:external.source_topic||'',status:'pdf_explanation_reviewed',independent_math_verified:external.math_independently_verified===true,quality_gate:external.quality_gate};
}
function getTag(id){return readCurrentTag(id);}
function liveLearningTags(q){return resolveTags(q,getState(),tagMap);}
if(typeof learningTags==='function')learningTags=liveLearningTags;
if(typeof weeklyWeaknessSummary==='function')weeklyWeaknessSummary=function(){return summarizeWeakness(typeof weeklyWeakRecords==='function'?weeklyWeakRecords():[]);};
if(typeof weeklyWeakMatch==='function')weeklyWeakMatch=function(q){
  return matchesFor(liveLearningTags(q),typeof weeklyWeakRecords==='function'?weeklyWeakRecords():[]).map(m=>({...m,tags:{skill:m.skill,method:m.method,groupKey:m.group_key,group_key:m.group_key},severity:m.weight,reason:m.reason}));
};
if(typeof weeklyWeakAffinity==='function')weeklyWeakAffinity=function(q){return affinityFor(liveLearningTags(q),typeof weeklyWeakRecords==='function'?weeklyWeakRecords():[]);};
if(typeof resetWeeklyWeaknessCache==='function')resetWeeklyWeaknessCache();

async function loadTagBank(){
  try{
    const res=await fetch('coach_skill_bank.json?v=0.6.5.14',{cache:'no-store'});
    if(!res.ok)throw new Error('HTTP '+res.status);
    const data=await res.json(),rows=data&&data.questions;
    if(!Array.isArray(rows)||rows.length!==575)throw new Error('标签记录数量不是575');
    const next=new Map();
    for(const row of rows){
      if(!row||!/^archive_\d{4}_\d{2}$/.test(row.id)||row.quality_gate!=='pdf_explanation_reviewed'||
         !String(row.reviewed_skill||'').trim()||!String(row.reviewed_method||'').trim()||!String(row.group_key||'').trim())continue;
      if(next.has(row.id))throw new Error('重复标签ID：'+row.id);
      next.set(row.id,row);
    }
    if(next.size!==575)throw new Error('有效标签记录只有'+next.size+'/575');
    tagMap=next;tagBankStatus='ready';tagBankError='';
  }catch(e){tagBankStatus='failed';tagBankError=String(e&&e.message||e);}
  if(typeof resetWeeklyWeaknessCache==='function')resetWeeklyWeaknessCache();
  try{if(typeof renderReport==='function')renderReport();}catch(e){console.warn('AMC learning closure refresh failed',e);}
}
const ready=loadTagBank();
root.amcLearningClosureV06514={getTag,ready,status:()=>({status:tagBankStatus,count:tagMap.size,error:tagBankError,math_independently_verified:false}),selectArchivePaper};

if(typeof archivePaperPicker==='function')archivePaperPicker=function(options={}){
  const state=getState(),sourceBank=Array.isArray(options.archive)?options.archive:(typeof ARCHIVE_BANK!=='undefined'&&Array.isArray(ARCHIVE_BANK)?ARCHIVE_BANK:[]);
  const reservedYears=new Set((Array.isArray(options.reservedYears)?options.reservedYears:[]).map(Number).filter(Number.isFinite));
  const bank=sourceBank.filter(q=>!reservedYears.has(Number(q&&q.year)));
  const records=typeof weeklyWeakRecords==='function'?weeklyWeakRecords():[];
  const result=selectArchivePaper({bank,state,tagMap,weakRecords:records,today:typeof today==='function'?today():new Date().toISOString().slice(0,10),randomFn:Math.random,tagBankStatus,reservedYears:[...reservedYears]});
  root.__amcWeaknessPickMeta=result?result.meta:null;return result?result.questions:null;
};
if(typeof buildArchiveMockCore==='function')buildArchiveMockCore=function(options={}){
  const sourceBank=Array.isArray(options.archive)?options.archive:(typeof ARCHIVE_BANK!=='undefined'&&Array.isArray(ARCHIVE_BANK)?ARCHIVE_BANK:[]);
  const reservedYears=new Set((Array.isArray(options.reservedYears)?options.reservedYears:[]).map(Number).filter(Number.isFinite));
  const bank=sourceBank.filter(q=>!reservedYears.has(Number(q&&q.year)));
  if(!bank.length)return false;
  if(tagBankStatus==='loading'){alert('正在读取真题知识点资料，请稍候几秒再生成周末模拟卷。');return true;}
  const chosen=typeof archivePaperPicker==='function'?archivePaperPicker({archive:bank,reservedYears:[...reservedYears]}):null;
  if(!chosen||chosen.length!==25){alert('真题混编失败：当前题库无法为25个原始题号位置各选出一道不重复的题');return true;}
  const state=getState(),years=[...new Set(chosen.map(q=>q.year))].sort((a,b)=>a-b);
  state.printable_mock_ids=chosen.map(q=>q.id);state.printable_mock_date=typeof today==='function'?today():new Date().toISOString().slice(0,10);
  state.printable_mock_meta={
    engine:'official_mixed_position_v1',engine_version:typeof ENGINE_VERSION==='string'?ENGINE_VERSION:'0.6.5.14',
    source_years:years,source_mix:chosen.map(q=>({id:q.id,year:q.year,original_position:q.problem_number})),
    difficulty_by_position:typeof EXAM_DIFFICULTY_BY_POSITION!=='undefined'?[...EXAM_DIFFICULTY_BY_POSITION]:Array.from({length:25},(_,i)=>i+1<=8?1:i+1<=16?2:i+1<=21?3:4),
    constraints:{mixed_years:true,original_position_preserved:true,unique_questions:true,answer_key_linked:true,reserved_years_excluded:[...reservedYears].sort((a,b)=>a-b),reserved_year_filter_applied:reservedYears.size>0},
    ...(root.__amcWeaknessPickMeta||{})
  };
  if(typeof saveStateLocal==='function')saveStateLocal();
  if(typeof renderAll==='function')renderAll();
  return true;
};
if(typeof submitPrintableMockAnswers==='function'){
  const baseSubmit=submitPrintableMockAnswers;
  submitPrintableMockAnswers=function(){
    const state=getState(),before=(state.mock_detail_history||[]).length,result=baseSubmit.apply(this,arguments),history=state.mock_detail_history||[];
    if(history.length===before+1){
      const m=state.printable_mock_meta||{};
      history[history.length-1].selection_meta={
        tag_bank_status:m.tag_bank_status||tagBankStatus,tag_bank_count:m.tag_bank_count??tagMap.size,
        weekly_weakness_attempt_count:m.weekly_weakness_attempt_count??0,weekly_weakness_mapped_count:m.weekly_weakness_mapped_count??0,
        weekly_weakness_unmapped_count:m.weekly_weakness_unmapped_count??0,weekly_weakness_focus:m.weekly_weakness_focus||[],
        personalized_positions:m.personalized_positions||POSITIONS.map(p=>p+1),weekly_weakness_coverage:m.weekly_weakness_coverage||[]
      };
      if(typeof saveStateLocal==='function')saveStateLocal();
      if(typeof renderAll==='function')renderAll();
    }
    return result;
  };
}
function escHtml(v){return String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function renderClosurePanel(){
  const host=root.document&&root.document.getElementById('report');if(!host)return;
  const old=host.querySelector('#learningClosurePanel');if(old)old.remove();
  const state=getState();let records=[];
  try{records=typeof weeklyWeakRecords==='function'?weeklyWeakRecords():[];}catch(e){}
  const mappedRecords=records.filter(r=>mapped(r.tags||{}));
  const focus=typeof weeklyWeaknessSummary==='function'?weeklyWeaknessSummary():[];
  const latest=latestCompleteMockDetail(state);
  const selection=selectionEvidenceFor(state,latest);
  const tasks=((state.v065_review_cycle&&state.v065_review_cycle.tasks)||[]).filter(t=>t&&t.status==='pending').sort((a,b)=>(b.priority||0)-(a.priority||0)||String(a.due||'').localeCompare(String(b.due||''))).slice(0,5);
  const focusHtml=focus.length?'<ul>'+focus.slice(0,4).map(x=>'<li><b>'+escHtml(x.group_key||x.skill||'未标注')+'</b>：'+x.count+'条'+(x.method?'；方法线索：'+escHtml(x.method):'')+'</li>').join('')+'</ul>':'<p>近7天暂无可可靠归类的周中薄弱记录。</p>';
  const coverage=selection&&Array.isArray(selection.weekly_weakness_coverage)?selection.weekly_weakness_coverage:[];
  const coverageHtml=coverage.length?'<ul>'+coverage.map(x=>{
    const matches=(x.matches||[]).slice(0,2).map(m=>escHtml(m.match_type||'标签匹配')+'：'+escHtml(m.group_key||m.skill||m.method||'题库标签')+'（来源'+escHtml(m.question_id||'未知题目')+'）').join('；');
    return '<li><b>Q'+x.position+'</b> → '+escHtml(x.question_id)+'：'+(matches||escHtml(x.selection_reason||'无可靠匹配，按原题号难度与去重规则选题'))+'</li>';
  }).join('')+'</ul>':latest?'<p>这套已完成模拟未保存可验证的选题证据；不会拿当前锁定卷的证据冒充历史卷的选题依据。</p>':selection?'<p>当前锁定的新卷尚无可验证的个性化选题证据。</p>':'<p>尚无可验证的个性化选题记录；本周已打印试卷不会回写或重组。下一套新卷会记录实际匹配证据。</p>';
  const taskHtml=tasks.length?'<ol>'+tasks.map(t=>'<li><b>'+escHtml(t.skill||'待核对考点')+'</b>：'+escHtml(t.source||'专项复测')+'；'+escHtml(['次日迁移','7天保持','14天保持','30天回测'][Math.min(3,t.stage||0)])+'；计划日期 '+escHtml(t.due||'待安排')+'</li>').join('')+'</ol>':'<p>当前没有可列出的待复测任务。标签不足时会保留未映射记录，不伪造考点；可映射的错题会进入现有复测队列。</p>';
  let mockSummary='<p>尚无已提交的完整模拟明细。</p>';
  if(latest){
    const per=latest.per_question||[],attempted=per.filter(x=>x.attempted).length,correct=per.filter(x=>x.correct).length;
    const score=Number.isFinite(+latest.score)?latest.score:correct;
    const accuracy=attempted?Math.round(correct/attempted*100):0;
    const minutes=Number.isFinite(+latest.total_minutes)&&+latest.total_minutes>0?latest.total_minutes+'分钟':'未记录';
    mockSummary='<p>最近一次完整模拟：<b>'+score+'/25</b>；作答正确率 <b>'+accuracy+'%</b>（实际作答 '+attempted+'/'+per.length+' 题，含猜对）；整套用时 <b>'+minutes+'</b>。</p>';
  }
  const panel=root.document.createElement('section');panel.className='card';panel.id='learningClosurePanel';panel.style.marginTop='14px';
  panel.innerHTML='<h3>学习闭环核查 · 薄弱点 → 组卷 → 下周训练</h3>'+mockSummary+
    '<p class="small">方法标签状态：'+escHtml(tagBankStatus==='ready'?'已读取':tagBankStatus==='loading'?'正在读取':'读取失败')+'；有效PDF方法标签 '+tagMap.size+'/575。PDF解题说明不等于题目答案已独立验算。</p>'+
    (tagBankError?'<p class="small">读取说明：'+escHtml(tagBankError)+'</p>':'')+
    '<p>近7天周中薄弱记录：<b>'+records.length+'</b>条；可可靠归类：<b>'+mappedRecords.length+'</b>条；暂未映射：<b>'+Math.max(records.length-mappedRecords.length,Number(selection&&selection.weekly_weakness_unmapped_count)||0)+'</b>条。</p>'+
    '<h4>本周主要薄弱点</h4>'+focusHtml+'<h4>本套模拟卷个性化选题证据</h4>'+coverageHtml+
    '<h4>下一步训练安排（实际复测队列）</h4>'+taskHtml+
    '<p class="small">仅7个指定题位考虑本周弱项；所有题目仍保持原AMC8题号难度位置、题目不重复和近期原题优先避让。没有可靠匹配时不虚报覆盖率。</p>';
  host.appendChild(panel);
}
if(typeof renderReport==='function'){
  const baseReport=renderReport;
  renderReport=function(){const result=baseReport.apply(this,arguments);try{renderClosurePanel();}catch(e){console.warn('AMC learning closure panel failed',e);}return result;};
}
loadTagBank();
})(typeof window!=='undefined'?window:globalThis);
