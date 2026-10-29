/* Weekend method diagnosis. Pure helpers are also used by isolated QA. */
(function(root){'use strict';
const VERSION='1.0';
const validPaper=id=>/^[A-Za-z0-9_-]{1,100}$/.test(String(id||''));
const realAnswer=value=>/^[A-E]$/.test(String(value||''));
const norm=value=>String(value||'').trim().replace(/\s+/g,' ').toLowerCase();
const specificMethod=value=>!!String(value||'').trim()&&!['human_confirmed','unknown','unclassified'].includes(norm(value))&&!/^archive_(unclassified|method)_/i.test(String(value));
const trustedTagConfidence=new Set(['parent_reviewed','pdf_method_reviewed_not_math_verified','source_metadata']);
function diagnosisTags(q,state={},bankTag=null){
  if(!q?.id)return {skill:'',method:'',groupKey:'',confidence:'unknown',mathIndependentlyVerified:false};
  const parent=state.v064_question_tags?.[q.id];
  const local=state.v064_specific_skills?.[q.id];
  const pdf=source=>source?.status==='pdf_explanation_reviewed'&&specificMethod(source.method);
  let source=null,confidence='unknown';
  if(parent?.status==='reviewed'&&specificMethod(parent.method)){
    source=parent;confidence='parent_reviewed';
  }else if(pdf(local)){
    source=local;confidence='pdf_method_reviewed_not_math_verified';
  }else if(pdf(bankTag)){
    source=bankTag;confidence='pdf_method_reviewed_not_math_verified';
  }else if(q.method_tag_status==='reviewed'&&specificMethod(q.core_method)){
    source=q;confidence='source_metadata';
  }
  if(!source)return {skill:'',method:'',groupKey:'',confidence:'unknown',mathIndependentlyVerified:false};
  return {skill:String(source.skill||''),method:String(source.method||source.core_method).trim(),
    groupKey:String(source.groupKey||source.group_key||(confidence==='pdf_method_reviewed_not_math_verified'?source.skill:'')||''),
    confidence,mathIndependentlyVerified:source.independent_math_verified===true||source.mathIndependentlyVerified===true};
}
const safe=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const isSlow=a=>a?.error_type==='time_issue'||a?.error_detail==='correct_but_slow'||String(a?.speed_label||'').includes('偏慢');
const weakKind=a=>{
  if(a?.result_status==='unable')return 'unable';
  if(a?.result_status==='skipped')return 'skipped';
  if(a?.correct===false)return 'wrong';
  if(a?.correct===true&&a.guessed===true)return 'guessed';
  if(a?.correct===true&&(a.hint_level===1||a.hint_level===2))return 'hinted';
  if(a?.correct===true&&isSlow(a))return 'slow';
  return null;
};
const labels={wrong:'答错',unable:'不会做',skipped:'未作答',guessed:'猜对',hinted:'提示后答对',slow:'正确但偏慢'};
function reliableHistory(a,q,lookup){
  if(!a||!validPaper(a.paper_id)||!realAnswer(a.selected_answer)||!a.question_id||
    !['weekend_mock','paper_daily'].includes(a.source)||a.correct!==true||a.guessed!==false||
    a.hint_level!==0||a.result_status!=='correct'||isSlow(a))return false;
  const original=lookup(a.question_id);
  return !!original&&original.answer===a.selected_answer&&q.id!==a.question_id;
}
function diagnose(detail,state,lookup,tags,submittedAt=new Date().toISOString()){
  if(!detail||!validPaper(detail.paper_id)||!Array.isArray(detail.per_question)||
    detail.per_question.length!==25||!Array.isArray(detail.question_ids)||detail.question_ids.length!==25||
    new Set(detail.question_ids).size!==25)return null;
  const groups=new Map(),unresolved=[];
  for(let i=0;i<25;i++){
    const row=detail.per_question[i],id=detail.question_ids[i];
    if(!row||row.qid!==id||Number(row.index)!==i+1||!/^archive_\d{4}_\d{2}$/.test(id)||lookup(id)?.official!==true)return null;
    const original=lookup(id);
    const matches=(state.attempts||[]).filter(a=>a?.source==='weekend_mock'&&a.paper_id===detail.paper_id&&
      a.question_id===id&&a.paper_question_index===i+1);
    const a=matches.length===1?matches[0]:row,kind=weakKind(a);
    if(!kind)continue;
    const evidence={question_id:id,question_number:i+1,result:kind,selected_answer:a.selected_answer??null,
      guessed:a.guessed===true,hint_level:matches.length===1&&(a.hint_level===1||a.hint_level===2)?a.hint_level:null,
      duration_sec:Number.isFinite(a.duration_sec)?a.duration_sec:null,
      error_type:matches.length===1?a.error_type||null:null};
    if(!realAnswer(original.answer)||row.answer!==original.answer){
      unresolved.push({...evidence,reason:'题库标准答案缺失或与试卷记录不一致，需核对'});continue;
    }
    if(matches.length>1){unresolved.push({...evidence,reason:'同一卷题存在多条作答，无法确认唯一原始记录'});continue;}
    // A wrong answer without a recorded choice cannot establish even the response evidence.
    if(kind==='wrong'&&!realAnswer(a.selected_answer)){
      unresolved.push({...evidence,reason:'答错记录缺少实际选项，需核对原始作答'});continue;
    }
    if((kind==='wrong'&&a.selected_answer===lookup(id).answer)||
      (['guessed','hinted','slow'].includes(kind)&&a.selected_answer!==lookup(id).answer)){
      unresolved.push({...evidence,reason:'作答状态与题库标准答案不一致，需核对'});continue;
    }
    const tag=tags(lookup(id))||{},method=String(tag.method||'').trim();
    if(!specificMethod(method)||!trustedTagConfidence.has(tag.confidence)){
      unresolved.push({...evidence,reason:'没有可识别的具体方法标签'});continue;
    }
    const key=norm(method),group=groups.get(key)||{target_id:id,method,skill:String(tag.skill||''),
      group_key:String(tag.groupKey||tag.group_key||''),tag_confidence:String(tag.confidence||'unknown'),
      math_verified:tag.mathIndependentlyVerified===true,evidence:[],score:0};
    group.evidence.push(evidence);
    groups.set(key,group);
  }
  const candidates=[...groups.values()].map(g=>{
    const prior=(state.attempts||[]).filter(a=>a?.paper_id!==detail.paper_id&&
      reliableHistory(a,lookup(g.target_id),lookup)&&norm(tags(lookup(a.question_id))?.method)===norm(g.method));
    const historicalIds=[...new Set(prior.map(a=>a.question_id))];
    const queue=(state.v065_review_cycle?.tasks||[]).filter(t=>t?.status==='pending'&&
      (t.key==='pdf-method:'+g.group_key||t.key==='parent-skill:'+g.skill));
    g.historical_independent_question_ids=historicalIds;
    g.related_pending_review=queue.length>0;
    g.evidence_question_ids=g.evidence.map(x=>x.question_id);
    g.confidence=g.math_verified&&g.tag_confidence==='parent_reviewed'?'high':
      g.math_verified||g.tag_confidence==='parent_reviewed'?'medium':'low';
    g.confidence_basis=g.math_verified?'标签记录明确标记了独立数学验算，仍需新题验证掌握':
      g.tag_confidence==='parent_reviewed'?'家长核对过方法标签，但未独立验算题目方法':
      '具体方法来自未独立验算的题库资料，需复核同方法关系';
    g.reason=g.evidence.map(x=>`第${x.question_number}题${labels[x.result]}`).join('、')+
      (g.related_pending_review?'；同标签组存在待复测任务':'')+
      (historicalIds.length?`；另有${historicalIds.length}道不同原题的可靠独立正确记录，仍需再次验证`:'；尚无不同原题的可靠独立正确记录');
    g.training_goal=`在陌生真题中独立辨认并应用「${g.method}」，再用不同原题复测。`;
    g.needs_weekend_verification=true;
    return g;
  });
  // Use evidence severity to order, without promoting broad labels to high confidence.
  candidates.sort((a,b)=>{
    const weight=x=>x.evidence.reduce((sum,e)=>sum+({unable:4,wrong:3,skipped:2,guessed:2,hinted:2,slow:1})[e.result],0)+
      (x.related_pending_review?1:0)-Math.min(2,x.historical_independent_question_ids.length);
    return weight(b)-weight(a)||a.evidence[0].question_number-b.evidence[0].question_number;
  });
  return {diagnosis_version:VERSION,paper_id:detail.paper_id,mock_date:detail.date||null,submitted_at:submittedAt,
    source:'rules',ai_status:'not_requested',history_scope:'current_archive_only',
    time_evidence:'whole_paper_only',whole_paper_minutes:detail.total_minutes??null,
    time_note:Number.isFinite(+detail.total_minutes)&&+detail.total_minutes>40?
      '整套用时超过40分钟，但没有逐题用时，不能据此归因到具体方法。':'没有可靠的逐题用时，不据此判断单题快慢。',
    focus:candidates.slice(0,3),candidates:candidates.slice(0,5),unresolved,
    history_note:'仅使用当前档案内能关联卷号、原题与实际答案的历史记录；整套用时不能推断单题用时。'};
}
function collectMockEvidence(detail,state,lookup,tags=()=>({})){
  if(!detail||!validPaper(detail.paper_id)||!Array.isArray(detail.question_ids)||
    detail.question_ids.length!==25||!Array.isArray(detail.per_question)||detail.per_question.length!==25)return null;
  const questions=[],unresolved=[];
  for(let i=0;i<25;i++){
    const id=detail.question_ids[i],row=detail.per_question[i],q=lookup(id);
    if(!row||row.qid!==id||row.index!==i+1||!q?.official)return null;
    const matches=(state.attempts||[]).filter(a=>a?.source==='weekend_mock'&&a.paper_id===detail.paper_id&&
      a.question_id===id&&a.paper_question_index===i+1);
    if(matches.length>1){unresolved.push({question_id:id,reason:'重复作答记录'});continue;}
    if(!/^assets\/\d{4}_\d{2}\.webp$/.test(q.archive_image||'')||!realAnswer(q.answer)||row.answer!==q.answer){
      unresolved.push({question_id:id,reason:'原题图片或标准答案证据不完整'});continue;
    }
    const a=matches[0]||row,status=a.result_status,selected=a.selected_answer??null;
    if(!['correct','wrong','unable','skipped'].includes(status)||
      (status==='correct'&&selected!==q.answer)||
      (status==='wrong'&&(!realAnswer(selected)||selected===q.answer))||
      (['unable','skipped'].includes(status)&&selected!==null)){
      unresolved.push({question_id:id,reason:'原始作答状态与题库答案无法核对'});continue;
    }
    const tag=tags(q)||{};
    questions.push({question_id:id,index:i+1,selected_answer:selected,result_status:status,
      guessed:a.guessed===true,
      // Weekend entry records no actual hint interaction; its legacy zero is not evidence of independence.
      hint_level:a.hint_recorded===true&&[0,1,2].includes(a.hint_level)?a.hint_level:null,
      duration_sec:Number.isFinite(a.duration_sec)&&a.duration_sec>=0?a.duration_sec:null,
      error_type:['knowledge_gap','method_gap','execution_error','time_issue','unsure'].includes(a.error_type)?a.error_type:null,
      tag_hint:specificMethod(tag.method)&&trustedTagConfidence.has(tag.confidence)?
        {method:tag.method,confidence:tag.confidence}:null});
  }
  return {questions,unresolved};
}
function applyAiDiagnosis(record,items,result,trainingIds=[]){
  if(!record||result?.paper_id!==record.paper_id||!Array.isArray(items)||!Array.isArray(result.targets)||
    result.targets.length<1||result.targets.length>3)return null;
  const verified=new Map(items.filter(x=>x?.status==='answer_key_matched').map(x=>[x.question_id,x]));
  const candidates=new Set(trainingIds),seen=new Set(),focus=[];
  for(const t of result.targets){
    if(!verified.has(t?.target_id)||seen.has(t.target_id)||!specificMethod(t.method)||
      !['low','medium'].includes(t.confidence)||!Array.isArray(t.evidence_question_ids)||
      !t.evidence_question_ids.includes(t.target_id)||t.evidence_question_ids.some(id=>!verified.has(id))||
      (t.training_match&&!candidates.has(t.training_match.question_id)))return null;
    seen.add(t.target_id);
    const evidence=t.evidence_question_ids.map(id=>{
      const a=verified.get(id);
      return {question_id:id,question_number:a.index,result:weakKind({correct:a.result_status==='correct',
        result_status:a.result_status,guessed:a.guessed,hint_level:a.hint_level})||'correct',
        selected_answer:a.selected_answer,guessed:a.guessed,hint_level:a.hint_level,
        duration_sec:a.duration_sec,error_type:a.error_type};
    });
    if(!evidence.some(x=>x.result!=='correct'))return null;
    focus.push({target_id:t.target_id,method:t.method,skill:'',group_key:'',tag_confidence:'ai_original_analysis',
      confidence:t.confidence,confidence_basis:t.confidence_basis,
      observed_gap:t.observed_gap,possible_cause:t.possible_cause||null,
      cause_status:'hypothesis_unconfirmed',unconfirmed_factors:t.unconfirmed_factors||[],
      evidence,evidence_question_ids:t.evidence_question_ids,method_links:t.method_links||[],
      positive_question_ids:t.positive_question_ids||[],reason:t.observed_gap,
      training_goal:t.training_goal,training_match:t.training_match||null,
      needs_weekend_verification:true});
  }
  return {...record,source:'ai_original_analysis',ai_status:'validated',rule_focus:record.rule_focus||record.focus,
    focus,ai_question_analyses:items,unresolved:[...record.unresolved,
      ...items.filter(x=>x.status!=='answer_key_matched').map(x=>({question_id:x.question_id,reason:x.status}))]};
}
function selectDaily(base,pool,record,protectedIds=new Set(),excludedIds=new Set(),tags=()=>({})){
  if(!Array.isArray(base)||base.length!==3||!record?.focus?.length)return {questions:base,context:[]};
  const result=[...base],blocked=new Set([...result.map(q=>q.id),...excludedIds]);
  const context=[];
  if(record.source==='ai_original_analysis'){
    const slot=result.findLastIndex(q=>!protectedIds.has(q.id));
    if(slot<0)return {questions:result,context};
    for(const target of record.focus){
      const match=target.training_match,q=pool.find(x=>x.id===match?.question_id);
      if(!q||blocked.has(q.id)||protectedIds.has(q.id)||q.source==='ai_generated_review')continue;
      result[slot]=q;
      context.push({question_id:q.id,question_source:q.source,paper_id:record.paper_id,
        target_id:target.target_id,method:target.method,evidence_question_ids:target.evidence_question_ids,
        relation:'ai_image_answer_matched',reason:'AI 对照原题图片提出同方法候选，选项答案与题库相符；方法关系仍需复核：'+match.reason});
      return {questions:result,context};
    }
    return {questions:result,context};
  }
  const relation=(q,target)=>{
    const t=tags(q)||{};
    if(t.confidence==='unknown'||(!t.method&&!t.groupKey&&!t.group_key))return null;
    if(norm(t.method)&&norm(t.method)===norm(target.method))return 'same_method_label';
    if(target.group_key&&norm(t.groupKey||t.group_key)===norm(target.group_key))return 'same_tag_group_unverified';
    return null;
  };
  for(const [i,q] of result.entries())for(const target of record.focus){
    const match=relation(q,target);
    if(match&&!context.some(x=>x.question_id===q.id))context.push({question_id:q.id,paper_id:record.paper_id,
      target_id:target.target_id,method:target.method,evidence_question_ids:target.evidence_question_ids,
      relation:match,reason:match==='same_method_label'?'与本周目标的方法标签一致':'同标签组候选，实际同方法关系待核对'});
  }
  const slot=result.findLastIndex(q=>!protectedIds.has(q.id));
  if(slot<0||context.some(x=>x.question_id===result[slot].id))return {questions:result,context};
  for(const target of record.focus){
    const candidates=pool.filter(q=>q?.id&&!blocked.has(q.id)&&!protectedIds.has(q.id)&&
      !excludedIds.has(q.id)&&q.source!=='ai_generated_review').map(q=>({q,match:relation(q,target)}))
      .filter(x=>x.match).sort((a,b)=>Number(b.match==='same_method_label')-Number(a.match==='same_method_label')||
        Math.abs(a.q.problem_number-17)-Math.abs(b.q.problem_number-17)||a.q.id.localeCompare(b.q.id));
    if(!candidates.length)continue;
    const chosen=candidates[0];result[slot]=chosen.q;
    context.push({question_id:chosen.q.id,paper_id:record.paper_id,target_id:target.target_id,
      method:target.method,evidence_question_ids:target.evidence_question_ids,relation:chosen.match,
      reason:chosen.match==='same_method_label'?'与本周目标的方法标签一致':'同标签组候选，实际同方法关系待核对'});
    break;
  }
  return {questions:result,context};
}
function selectTrainingCandidates(pool,weakTags,tags=()=>({})){
  const available=pool.filter(q=>q?.id&&Number.isInteger(q.year)&&Number.isInteger(q.problem_number));
  const chosen=[],used=new Set();
  const add=q=>{if(q&&!used.has(q.id)){chosen.push(q);used.add(q.id);}};
  const tagScore=q=>{const t=tags(q)||{};return weakTags.reduce((n,x)=>n+
    (x.groupKey&&x.groupKey===t.groupKey?4:0)+(x.method&&x.method===t.method?3:0)+
    (x.skill&&x.skill===t.skill?2:0),0);};
  const scored=available.map(q=>({q,score:tagScore(q)}));
  scored.filter(x=>x.score>0)
    .sort((a,b)=>b.score-a.score||a.q.id.localeCompare(b.q.id)).slice(0,2).forEach(x=>add(x.q));
  // Every remaining slot is reserved for questions with no matching label.
  const unlabeled=scored.filter(x=>x.score===0).map(x=>x.q);
  const bands=[[13,16],[17,20],[21,25]],years=unlabeled.map(q=>q.year);
  const middleYear=years.length?(Math.min(...years)+Math.max(...years))/2:0;
  const pick=options=>options.filter(q=>!used.has(q.id)).sort((a,b)=>{
    const score=q=>chosen.length?
      (chosen.every(x=>x.year!==q.year)?50:0)+Math.min(...chosen.map(x=>Math.abs(x.year-q.year)))*10+
        Math.min(...chosen.map(x=>Math.abs(x.problem_number-q.problem_number))):
      -Math.abs(q.year-middleYear)*10;
    return score(b)-score(a)||a.id.localeCompare(b.id);
  })[0];
  for(const [low,high] of bands)add(pick(unlabeled.filter(q=>q.problem_number>=low&&q.problem_number<=high)));
  while(chosen.length<6){const next=pick(unlabeled);if(!next)break;add(next);}
  return chosen.map(q=>q.id);
}
if(typeof module!=='undefined'&&module.exports){module.exports={diagnose,diagnosisTags,collectMockEvidence,applyAiDiagnosis,selectDaily,selectTrainingCandidates,weakKind,VERSION};return;}
if(!root?.document)return;
const active=()=>Array.isArray(S.weekly_method_diagnoses)?S.weekly_method_diagnoses.at(-1):null;
const tags=q=>diagnosisTags(q,S,root.amcLearningClosureV06514?.getTag?.(q?.id));
const previousGenerate=generateDailyPlan;
generateDailyPlan=function(excludeIds){
  const base=previousGenerate.apply(this,arguments),record=active();
  if(!record||!Array.isArray(base)||base.length!==3){root.__amcWeeklyPlanContext=[];return base;}
  const protectedIds=new Set([...(root.amcV065Planned||[]).map(x=>x.qid),
    ...base.filter(q=>q?.source==='ai_generated_review').map(q=>q.id)]);
  const exclusion=excludeIds instanceof Set?excludeIds:new Set(Array.isArray(excludeIds)?excludeIds:[]);
  const selected=selectDaily(base,eligibleDailyBank(),record,protectedIds,exclusion,tags);
  root.__amcWeeklyPlanContext=selected.context;
  return selected.questions;
};
const previousDaily=dailyPlan;
dailyPlan=function(){
  const before=S.daily_plan?.paper_id,questions=previousDaily.apply(this,arguments),plan=S.daily_plan;
  if(plan&&plan.paper_id!==before&&Array.isArray(root.__amcWeeklyPlanContext)){
    plan.weekly_diagnosis_context=root.__amcWeeklyPlanContext.filter(x=>plan.question_ids.includes(x.question_id));
    if(plan.weekly_diagnosis_context.length)saveStateLocal();
  }
  return questions;
};
const previousDailyReason=dailyReason;
dailyReason=function(q,i){
  const base=previousDailyReason.apply(this,arguments),ctx=(S.daily_plan?.weekly_diagnosis_context||[]).find(x=>x.question_id===q?.id);
  return ctx?`${base}；本周模拟 ${ctx.paper_id}：${ctx.method}（${ctx.reason}）`:base;
};
const previousDailySubmit=submitDailyPaperResults;
submitDailyPaperResults=function(){
  const before=(S.daily_sessions||[]).length,context=S.daily_plan?.weekly_diagnosis_context;
  const result=previousDailySubmit.apply(this,arguments);
  if((S.daily_sessions||[]).length===before+1&&Array.isArray(context)&&context.length){
    S.daily_sessions.at(-1).weekly_diagnosis_context=context.map(x=>({...x}));saveStateLocal();renderReport();
  }
  return result;
};
function trainingCandidates(detail,items){
  const weak=items.filter(x=>x.status==='answer_key_matched'&&
    (x.result_status!=='correct'||x.guessed||x.hint_level===1||x.hint_level===2));
  const related=weak.map(x=>tags(qById(x.question_id)));
  const pool=eligibleDailyBank().filter(q=>q?.official&&q.archive_image&&
    !detail.question_ids.includes(q.id)&&q.source!=='ai_generated_review');
  return selectTrainingCandidates(pool,related,tags);
}
async function requestAi(record,evidence,detail){
  const setStatus=status=>{
    const current=(S.weekly_method_diagnoses||[]).find(x=>x.paper_id===record.paper_id);
    if(current&&current.diagnosis_version===VERSION){current.ai_status=status;saveStateLocal();renderReport();}
  };
  const code=typeof getSyncCode==='function'?getSyncCode():'';
  if(!code||!root.AMC8_CLOUD_CONFIG?.url){setStatus('rules_fallback:sync_code_unavailable');return;}
  try{
    const post=async payload=>{
      const response=await fetch(root.AMC8_CLOUD_CONFIG.url+'/functions/v1/amc8-diagnose',{
        method:'POST',headers:{'Content-Type':'application/json',apikey:root.AMC8_CLOUD_CONFIG.publishableKey},
        body:JSON.stringify({sync_code:code,paper_id:record.paper_id,...payload}),signal:AbortSignal.timeout(65000)});
      const body=await response.json();if(!response.ok||!body.ok||body.paper_id!==record.paper_id)
        throw Error(body.error||'invalid_model_diagnosis');
      return body;
    };
    const items=[];
    for(let i=0;i<evidence.questions.length;i+=5){
      setStatus(`analyzing:${Math.min(i+5,evidence.questions.length)}/${evidence.questions.length}`);
      const body=await post({phase:'analyze',questions:evidence.questions.slice(i,i+5)});
      if(!Array.isArray(body.items))throw Error('invalid_model_diagnosis');
      items.push(...body.items);
      const current=(S.weekly_method_diagnoses||[]).find(x=>x.paper_id===record.paper_id);
      if(current){current.ai_question_analyses=[...items];saveStateLocal();}
    }
    const verified=items.filter(x=>x.status==='answer_key_matched');
    if(!verified.some(x=>x.result_status!=='correct'||x.guessed||x.hint_level===1||x.hint_level===2)){
      setStatus('rules_fallback:no_verified_weak_question');return;
    }
    const candidateIds=trainingCandidates(detail,items);
    setStatus('synthesizing');
    const body=await post({phase:'synthesize',analyses:verified,training_candidates:candidateIds});
    if(!Array.isArray(body.targets)||!body.targets.length){setStatus('rules_fallback:ai_evidence_insufficient');return;}
    const accepted=applyAiDiagnosis(record,items,body,candidateIds);
    if(!accepted)throw Error('invalid_model_diagnosis');
    const list=S.weekly_method_diagnoses||[],index=list.findIndex(x=>x.paper_id===record.paper_id);
    if(index>=0&&list[index].diagnosis_version===VERSION){list[index]=accepted;saveStateLocal();renderReport();}
  }catch(e){setStatus('rules_fallback:'+String(e?.message||'model_unavailable').slice(0,50));}
}
const previousMockSubmit=submitPrintableMockAnswers;
submitPrintableMockAnswers=function(){
  const before=(S.mock_detail_history||[]).length,result=previousMockSubmit.apply(this,arguments);
  if((S.mock_detail_history||[]).length!==before+1)return result;
  const detail=S.mock_detail_history.at(-1);
  if((S.weekly_method_diagnoses||[]).some(x=>x.paper_id===detail.paper_id))return result;
  const evidence=collectMockEvidence(detail,S,qById,tags);
  const record=diagnose(detail,S,qById,tags);
  if(!record){console.warn('Weekly diagnosis skipped: incomplete mock evidence');return result;}
  if(evidence?.unresolved?.length)record.unresolved.push(...evidence.unresolved);
  S.weekly_method_diagnoses=S.weekly_method_diagnoses||[];
  S.weekly_method_diagnoses.push(record);saveStateLocal();renderReport();
  if(evidence?.questions?.length)void requestAi(record,evidence,detail);
  return result;
};
const previousReport=renderReport;
renderReport=function(){
  const result=previousReport.apply(this,arguments),host=document.querySelector('#reportCategory-overview')||document.getElementById('report');
  if(!host)return result;
  host.querySelector('#weeklyMethodDiagnosis')?.remove();
  const record=active(),panel=document.createElement('section');panel.className='card';panel.id='weeklyMethodDiagnosis';
  const focus=record?.focus||[];
  panel.innerHTML='<h3>本周优先攻克的方法</h3>'+(record?'<p class="small">模拟卷 '+safe(record.paper_id)+' · '+safe(record.source==='ai_original_analysis'?'AI原题分析（答案已与题库核对，推导仍需复核）':'规则诊断')+' · '+safe(record.ai_status)+'</p>':'<p>完整模拟提交后，系统会按真实作答生成本周目标。</p>')+
    (focus.length?'<ol>'+focus.map(c=>'<li><b>'+safe(c.method)+'</b>（置信度：'+safe(c.confidence)+'）<br>观察到：'+safe(c.observed_gap||c.reason)+'<br>'+safe(c.confidence_basis)+
      (c.possible_cause?'<br>可能原因（待确认）：'+safe(c.possible_cause):'')+
      (c.unconfirmed_factors?.length?'<br>尚未确认：'+safe(c.unconfirmed_factors.join('；')):'')+
      '<br>训练目标：'+safe(c.training_goal)+'<br>本周训练候选：'+safe(c.training_match?.question_id||'目标暂未覆盖：尚无经过原题核对的同方法候选')+'；周末陌生真题验证：尚未完成</li>').join('')+'</ol>':'<p>目前没有足够证据确认具体薄弱方法。</p>')+
    (record?.unresolved?.length?'<p class="small">另有 '+record.unresolved.length+' 题的作答或方法标签待确认，未强行归类。</p>':'');
  host.prepend(panel);return result;
};
root.amcWeeklyDiagnosisV1={diagnose,diagnosisTags,tags,collectMockEvidence,applyAiDiagnosis,selectDaily};
})(typeof window!=='undefined'?window:globalThis);
