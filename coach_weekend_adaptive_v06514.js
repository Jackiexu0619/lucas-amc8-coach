/* Lucas AMC8 Coach v0.6.5.14 — weekly-weakness-aware weekend selector.
 * Selection-only metadata: never changes answers, scores, mastery, or the locked paper.
 */
(function(root){
'use strict';

const VERSION='0.6.5.14';
const PERSONALIZED_POSITIONS=[5,9,12,15,18,21,24];

function norm(value){return String(value??'').trim().toLocaleLowerCase();}
function dayOrdinal(value){
  const s=String(value??'').slice(0,10);
  if(!/^\d{4}-\d{2}-\d{2}$/.test(s))return NaN;
  const t=Date.parse(s+'T00:00:00Z');
  return Number.isFinite(t)?Math.floor(t/86400000):NaN;
}
function daysAgo(date,currentDate){
  const a=dayOrdinal(date),b=dayOrdinal(currentDate);
  return Number.isFinite(a)&&Number.isFinite(b)?b-a:Infinity;
}
function normalizeTags(raw){
  raw=raw||{};
  return {
    skill:String(raw.skill??raw.reviewed_skill??'').trim(),
    method:String(raw.method??raw.reviewed_method??'').trim(),
    group_key:String(raw.group_key??'').trim(),
    domain:String(raw.domain??raw.source_topic??'').trim()
  };
}
function isWeakAttempt(a){
  if(!a)return false;
  const result=String(a.result_status||'').toLowerCase();
  const error=String(a.error_type||'').toLowerCase();
  const detail=String(a.error_detail||'').toLowerCase();
  const speed=String(a.speed_label||'');
  return !a.correct||!!a.guessed||
    ['unable','skipped','not_attempted','wrong'].includes(result)||
    ['time_issue','correct_but_slow'].includes(error)||
    ['correct_but_slow','unable','not_attempted'].includes(detail)||
    speed.includes('偏慢')||speed.includes('需复盘');
}
function collectWeakRecords(attempts,currentDate,getTags){
  const rows=[];let unmapped=0;
  for(const a of (attempts||[])){
    if(!a||a.source==='weekend_mock')continue;
    const age=daysAgo(a.date,currentDate);
    if(age<0||age>7||!isWeakAttempt(a))continue;
    const originId=a.source==='ai_transfer_review'?(a.review_origin_question_id||a.question_id):a.question_id;
    if(!originId){unmapped++;continue;}
    const tags=normalizeTags(getTags(originId));
    if(!tags.skill&&!tags.method&&!tags.group_key&&!tags.domain){unmapped++;continue;}
    let severity=!a.correct?1.0:(a.guessed?0.82:0.65);
    const weight=severity/(1+age/4);
    rows.push({
      question_id:String(originId),date:String(a.date||'').slice(0,10),age,
      tags,severity,weight,
      reason:!a.correct?(a.result_status==='unable'?'不会做':a.result_status==='skipped'?'未做':'答错'):
        a.guessed?'猜对/不确定':'正确但偏慢'
    });
  }
  return {rows,unmapped};
}
function summarizeWeakness(records){
  const groups=new Map();
  for(const r of records){
    const t=r.tags;
    const key=t.method?'method:'+norm(t.method):
      t.group_key?'group:'+norm(t.group_key):
      t.skill?'skill:'+norm(t.skill):'domain:'+norm(t.domain);
    if(!groups.has(key))groups.set(key,{
      key,skill:t.skill,method:t.method,group_key:t.group_key,domain:t.domain,
      count:0,weight:0,question_ids:[],dates:[],reasons:[]
    });
    const g=groups.get(key);
    g.count++;g.weight+=r.weight;
    if(!g.question_ids.includes(r.question_id))g.question_ids.push(r.question_id);
    if(!g.dates.includes(r.date))g.dates.push(r.date);
    if(!g.reasons.includes(r.reason))g.reasons.push(r.reason);
  }
  return [...groups.values()]
    .sort((a,b)=>b.weight-a.weight||b.count-a.count||a.key.localeCompare(b.key))
    .slice(0,8)
    .map(g=>({...g,weight:+g.weight.toFixed(3)}));
}
function matchTags(candidate,weak){
  const a=normalizeTags(candidate),b=normalizeTags(weak);
  if(a.method&&b.method&&norm(a.method)===norm(b.method))return {score:8,kind:'同方法'};
  if(a.group_key&&b.group_key&&norm(a.group_key)===norm(b.group_key))return {score:5.8,kind:'同方法分组'};
  if(a.skill&&b.skill&&norm(a.skill)===norm(b.skill))return {score:4.2,kind:'同技能'};
  if(a.domain&&b.domain&&norm(a.domain)===norm(b.domain))return {score:0.65,kind:'同领域'};
  return null;
}
function stableNoise(value){
  let h=2166136261;
  const s=String(value);
  for(let i=0;i<s.length;i++){h^=s.charCodeAt(i);h=Math.imul(h,16777619);}
  return ((h>>>0)%1000)/10000;
}
function buildAdaptivePaper(options){
  const bank=Array.isArray(options.archiveBank)?options.archiveBank:[];
  const attempts=Array.isArray(options.attempts)?options.attempts:[];
  const currentDate=options.currentDate;
  const recent=new Set(options.recentIds||[]);
  const attempted=new Set(attempts.map(a=>a&&a.question_id).filter(Boolean));
  const getTags=typeof options.getTags==='function'?options.getTags:(id=>options.tagsById?.[id]||{});
  const personal=new Set(options.personalizedPositions||PERSONALIZED_POSITIONS);
  const weak=collectWeakRecords(attempts,currentDate,getTags);
  const focus=summarizeWeakness(weak.rows);
  const chosen=[],usedIds=new Set(),yearUse={},methodUse={},groupUse={},fallbackPositions=[];
  const slotAudit=[];

  for(let position=1;position<=25;position++){
    const eligible=bank.filter(q=>Number(q.problem_number)===position&&!usedIds.has(q.id));
    if(!eligible.length)return {questions:null,audit:{selector_version:VERSION,error:'missing_position_'+position}};
    const fresh=eligible.filter(q=>!recent.has(q.id));
    let pool=fresh.length?fresh:eligible;
    if(!fresh.length)fallbackPositions.push(position);
    const underYearCap=pool.filter(q=>(yearUse[String(q.year)]||0)<2);
    if(underYearCap.length)pool=underYearCap;
    const isPersonal=personal.has(position);

    const scored=pool.map(q=>{
      const tags=normalizeTags(getTags(q.id,q));
      const methodKey=norm(tags.method),groupKey=norm(tags.group_key||tags.method||tags.skill);
      let score=attempted.has(q.id)?0:1.8;
      score-=(yearUse[String(q.year)]||0)*1.7;
      if(methodKey)score-=Math.min(7,(methodUse[methodKey]||0)*3.1);
      if(groupKey)score-=Math.min(8,(groupUse[groupKey]||0)*4.4);
      let affinity=0;
      for(const g of focus){
        const match=matchTags(tags,g);
        if(match&&match.score>=4){
          affinity+=match.score*Math.min(2.5,g.weight);
        }
      }
      score+=affinity*(isPersonal?1:0.025);
      score+=stableNoise(VERSION+'|'+currentDate+'|'+position+'|'+q.id);
      return {q,tags,score};
    }).sort((a,b)=>b.score-a.score||String(a.q.id).localeCompare(String(b.q.id)));

    const best=scored[0];
    if(!best)return {questions:null,audit:{selector_version:VERSION,error:'empty_pool_'+position}};
    const q=best.q,tags=best.tags;
    chosen.push(q);usedIds.add(q.id);
    const year=String(q.year);yearUse[year]=(yearUse[year]||0)+1;
    const mk=norm(tags.method),gk=norm(tags.group_key||tags.method||tags.skill);
    if(mk)methodUse[mk]=(methodUse[mk]||0)+1;
    if(gk)groupUse[gk]=(groupUse[gk]||0)+1;

    const matches=focus.map(g=>{
      const m=matchTags(tags,g);
      return m&&m.score>=4?{key:g.key,skill:g.skill,method:g.method,weight:g.weight,match_kind:m.kind,match_score:m.score}:null;
    }).filter(Boolean);
    slotAudit.push({
      position,question_id:q.id,year:q.year,original_position:q.problem_number,
      personalized:isPersonal,
      reason:isPersonal?(matches.length?'weekly_weakness_match':(weak.rows.length?'no_compatible_method_at_position':'no_weekly_weak_records')):'normal_coverage',
      matched_weaknesses:matches
    });
  }

  const valid=chosen.length===25&&new Set(chosen.map(q=>q.id)).size===25&&
    chosen.every((q,i)=>Number(q.problem_number)===i+1)&&
    Object.values(yearUse).every(n=>n<=2);
  if(!valid)return {questions:null,audit:{selector_version:VERSION,error:'paper_validation_failed'}};

  const personalizedSlots=slotAudit.filter(x=>x.personalized);
  const covered=new Set(personalizedSlots.flatMap(x=>x.matched_weaknesses.map(m=>m.key)));
  const unmatched=focus.filter(g=>!covered.has(g.key)).map(g=>({
    skill:g.skill,method:g.method,group_key:g.group_key,count:g.count,weight:g.weight
  }));
  const coverage=personalizedSlots.map(x=>({
    position:x.position,question_id:x.question_id,year:x.year,reason:x.reason,
    matched_weaknesses:x.matched_weaknesses.map(m=>({
      skill:m.skill,method:m.method,match_kind:m.match_kind
    }))
  }));
  return {
    questions:chosen,
    audit:{
      selector_version:VERSION,
      selection_date:currentDate,
      weakness_window_days:7,
      weak_attempt_count:weak.rows.length,
      unmapped_weak_attempt_count:weak.unmapped,
      personalized_positions:[...personal].sort((a,b)=>a-b),
      normal_coverage_positions:slotAudit.filter(x=>!x.personalized).map(x=>x.position),
      weekly_weakness_focus:focus.map(g=>({
        skill:g.skill,method:g.method,group_key:g.group_key,count:g.count,
        weight:g.weight,question_ids:g.question_ids,reasons:g.reasons
      })),
      weekly_weakness_coverage:coverage,
      unmatched_weakness_groups:unmatched,
      recent_exclusion_fallback_positions:fallbackPositions,
      source_year_counts:yearUse,
      slot_audit:slotAudit,
      notes:[
        '只使用最近7天的错题、猜对、未做/不会和明确偏慢记录；周末模拟记录不反向污染周中薄弱项。',
        'AI同方法复测只回溯到其原始真题映射，不把AI题当作正式真题。',
        '方法标签仅用于选题匹配，不代表数学能力已验证，不修改成绩或掌握度。',
        '仅在固定的7个题位提高薄弱项权重；无合适题时保留正常题型覆盖并明确记录。'
      ]
    }
  };
}

if(typeof module!=='undefined'&&module.exports){
  module.exports={VERSION,PERSONALIZED_POSITIONS,normalizeTags,collectWeakRecords,summarizeWeakness,matchTags,buildAdaptivePaper};
}
if(!root||!root.document)return;

let REVIEWED_BY_ID=new Map();
let metadataState={status:'loading',count:0,message:'正在读取575道真题的方法标签…'};
let lastSelectionAudit=null;
const oldArchivePaperPicker=typeof root.archivePaperPicker==='function'?root.archivePaperPicker:null;
const oldBuildArchiveMockCore=typeof root.buildArchiveMockCore==='function'?root.buildArchiveMockCore:null;
const oldRenderMock=typeof root.renderMock==='function'?root.renderMock:null;

function tagsForId(id,q){
  const reviewed=REVIEWED_BY_ID.get(String(id))||{};
  const local=(typeof S!=='undefined'&&S.v064_specific_skills&&S.v064_specific_skills[id])||{};
  const parent=(typeof S!=='undefined'&&S.v064_question_tags&&S.v064_question_tags[id])||{};
  let fallback=q||null;
  if(!fallback&&typeof qById==='function'){try{fallback=qById(id)}catch(e){}}
  return normalizeTags({
    skill:reviewed.reviewed_skill||local.skill||local.source_skill||parent.skill||fallback?.skill,
    method:reviewed.reviewed_method||local.method||parent.method||fallback?.core_method,
    group_key:reviewed.group_key||local.group_key||parent.group_key,
    domain:reviewed.source_topic||local.domain||parent.domain||fallback?.domain
  });
}
function readCurrentWeakness(){
  return collectWeakRecords((typeof S!=='undefined'&&S.attempts)||[],typeof today==='function'?today():new Date().toISOString().slice(0,10),id=>tagsForId(id));
}
function adaptiveArchivePaperPicker(){
  if(typeof ARCHIVE_BANK==='undefined'||!Array.isArray(ARCHIVE_BANK)||!ARCHIVE_BANK.length){
    return oldArchivePaperPicker?oldArchivePaperPicker():null;
  }
  const recent=new Set([
    ...((typeof S!=='undefined'&&S.printable_mock_ids)||[]),
    ...(typeof recentWeekendQuestionIds==='function'?recentWeekendQuestionIds(4):[]),
    ...(typeof recentWeekdayQuestionIds==='function'?recentWeekdayQuestionIds(7):[])
  ]);
  const currentDate=typeof today==='function'?today():new Date().toISOString().slice(0,10);
  const result=buildAdaptivePaper({
    archiveBank:ARCHIVE_BANK,
    attempts:(typeof S!=='undefined'&&S.attempts)||[],
    currentDate,
    recentIds:[...recent],
    personalizedPositions:PERSONALIZED_POSITIONS,
    getTags:(id,q)=>tagsForId(id,q)
  });
  lastSelectionAudit=result.audit||null;
  if(!result.questions&&oldArchivePaperPicker){
    console.warn('[AMC8 adaptive mock] validation failed; using legacy position-preserving picker',result.audit);
    return oldArchivePaperPicker();
  }
  return result.questions;
}
if(oldArchivePaperPicker)root.archivePaperPicker=adaptiveArchivePaperPicker;

if(oldBuildArchiveMockCore){
  root.buildArchiveMockCore=function(){
    lastSelectionAudit=null;
    const ok=oldBuildArchiveMockCore.apply(this,arguments);
    if(ok&&lastSelectionAudit&&typeof S!=='undefined'&&S.printable_mock_meta){
      S.printable_mock_meta.engine='official_mixed_position_weekly_weakness_v1';
      S.printable_mock_meta.engine_version=VERSION;
      S.printable_mock_meta.adaptive_selection=lastSelectionAudit;
      S.printable_mock_meta.constraints={
        ...(S.printable_mock_meta.constraints||{}),
        last_4_mocks_excluded:true,last_7_weekdays_excluded:true,
        weekly_weakness_weighted:true,weekly_weakness_slots:PERSONALIZED_POSITIONS.length,
        original_position_preserved:true,unique_questions:true,answer_key_linked:true
      };
      if(typeof saveStateLocal==='function')saveStateLocal(false);
    }
    return ok;
  };
}

function escHtml(value){
  return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
function renderAdaptiveAudit(){
  const host=root.document.getElementById('mock');
  if(!host)return;
  const old=root.document.getElementById('adaptiveMockAudit');
  if(old)old.remove();
  const audit=typeof S!=='undefined'?S.printable_mock_meta?.adaptive_selection:null;
  if(!audit)return;
  const focus=audit.weekly_weakness_focus||[];
  const slots=audit.weekly_weakness_coverage||[];
  const unmatched=audit.unmatched_weakness_groups||[];
  const matched=slots.filter(x=>x.reason==='weekly_weakness_match').length;
  const noData=audit.weak_attempt_count===0;
  const slotRows=slots.map(x=>{
    const detail=x.matched_weaknesses?.length
      ?x.matched_weaknesses.map(m=>escHtml(m.method||m.skill||'同组方法')+'（'+escHtml(m.match_kind)+'）').join('；')
      :x.reason==='no_weekly_weak_records'?'本周没有可用的薄弱记录':'该题号位置未找到匹配方法，保留正常覆盖题';
    return '<tr><td>Q'+x.position+'</td><td>'+x.year+' AMC8 Q'+x.position+'</td><td>'+escHtml(detail)+'</td></tr>';
  }).join('');
  const focusText=focus.length?focus.map(g=>{
    const name=g.method||g.skill||g.group_key||'未命名方法';
    return '<li>'+escHtml(name)+' <span class="small">×'+g.count+'</span></li>';
  }).join(''):'<li>最近7天没有识别到可用于组卷的薄弱记录。</li>';
  const unmatchedText=unmatched.length
    ?unmatched.map(g=>escHtml(g.method||g.skill||g.group_key||'未命名方法')).join('、')
    :'本次7个个性化题位已覆盖本周识别到的重点方法。';
  const panel=root.document.createElement('div');
  panel.id='adaptiveMockAudit';panel.className='card';panel.style.marginTop='13px';
  panel.innerHTML='<div class="row"><h3 style="margin:0">本周薄弱项命中核查</h3><span class="tag">'+VERSION+'</span></div>'+
    '<p class="small">本周有效薄弱记录：'+audit.weak_attempt_count+' 条；7个个性化题位命中：'+matched+'/7。'+
    (audit.unmapped_weak_attempt_count?'另有 '+audit.unmapped_weak_attempt_count+' 条记录缺少可用方法标签。':'')+'</p>'+
    '<details><summary><b>查看薄弱方法与逐题选题理由</b></summary><div class="two" style="margin-top:10px">'+
    '<div><b>本周优先关注的方法</b><ul>'+focusText+'</ul></div>'+
    '<div><b>暂未命中的薄弱方法</b><p>'+unmatchedText+'</p></div></div>'+
    '<table><tr><th>个性化题位</th><th>来源真题</th><th>选题说明</th></tr>'+slotRows+'</table>'+
    '<p class="small">题号位置保持不变；未命中的薄弱项不会硬塞进不合适的题位，继续由周中专项/同方法复测处理。标签只用于选题，不修改成绩或掌握度。</p></details>';
  host.insertBefore(panel,host.firstChild);
}
if(oldRenderMock){
  root.renderMock=function(){oldRenderMock.apply(this,arguments);renderAdaptiveAudit();};
}

const ready=(async()=>{
  try{
    const response=await root.fetch('coach_skill_bank.json?v='+VERSION,{cache:'no-store'});
    if(!response.ok)throw new Error('HTTP '+response.status);
    const payload=await response.json();
    if(!Array.isArray(payload.questions)||payload.questions.length!==575)throw new Error('方法标签应为575条');
    const next=new Map();
    for(const row of payload.questions){
      if(row&&row.quality_gate==='pdf_explanation_reviewed'&&row.id&&row.reviewed_skill&&row.reviewed_method){
        next.set(String(row.id),row);
      }
    }
    REVIEWED_BY_ID=next;
    metadataState={status:'ready',count:next.size,message:'已加载'+next.size+'条经PDF解析复核的方法标签'};
  }catch(error){
    metadataState={status:'fallback',count:0,message:'方法标签文件未能加载，将优先使用浏览器已保存的标签；'+String(error?.message||error)};
    console.warn('[AMC8 adaptive mock] reviewed method metadata unavailable',error);
  }
  return metadataState;
})();
root.AMC8_WEEKEND_ADAPTIVE_READY=ready;
root.LucasAMC8WeekendAdaptive={
  version:VERSION,
  ready,
  status:()=>({...metadataState}),
  getWeakness:()=>readCurrentWeakness(),
  buildAdaptivePaper
};
})(typeof window==='undefined'?null:window);
