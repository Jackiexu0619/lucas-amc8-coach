// Grounded ranking only: the model cannot invent methods or student work.
export const MODEL='deepseek-flash';
const codeValue=value=>String(value??'').toUpperCase().replace(/[^A-Z2-9]/g,'');
const kinds=new Set(['wrong','unable','skipped','guessed','hinted','slow']);
const confidences=new Set(['parent_reviewed','pdf_method_reviewed_not_math_verified','source_metadata']);
const reasons=new Set(['incorrect','unable','unanswered','guessed','hinted','slow','prior_review_pending','limited_history']);
export function validateRequest(body,catalog){
  if(!body||typeof body!=='object'||Array.isArray(body))return {error:'invalid_request'};
  const code=codeValue(body.sync_code),paperId=body.paper_id;
  if(code.length<20||code.length>64)return {error:'sync_code_required'};
  if(typeof paperId!=='string'||!/^[A-Za-z0-9_-]{1,100}$/.test(paperId))return {error:'invalid_paper_id'};
  if(body.whole_paper_minutes!==null&&body.whole_paper_minutes!==undefined&&
    (!Number.isFinite(body.whole_paper_minutes)||body.whole_paper_minutes<=0||body.whole_paper_minutes>240))return {error:'invalid_time'};
  if(!Array.isArray(body.candidates)||body.candidates.length<1||body.candidates.length>5)return {error:'invalid_candidates'};
  const seen=new Set(),candidates=[];
  for(const row of body.candidates){
    if(!row||typeof row!=='object'||Array.isArray(row)||
      typeof row.target_id!=='string'||!catalog[row.target_id]||seen.has(row.target_id)||
      typeof row.method!=='string'||!row.method.trim()||row.method.length>180||
      !Array.isArray(row.evidence_question_ids)||row.evidence_question_ids.length<1||row.evidence_question_ids.length>25||
      !row.evidence_question_ids.includes(row.target_id)||
      row.evidence_question_ids.some(id=>typeof id!=='string'||!catalog[id])||
      new Set(row.evidence_question_ids).size!==row.evidence_question_ids.length||
      !Array.isArray(row.results)||row.results.length!==row.evidence_question_ids.length||
      row.results.some(x=>!kinds.has(x))||
      !Number.isSafeInteger(row.historical_independent_count)||row.historical_independent_count<0||row.historical_independent_count>50||
      typeof row.related_pending_review!=='boolean'||
      !confidences.has(row.tag_confidence))return {error:'invalid_candidates'};
    seen.add(row.target_id);
    candidates.push({target_id:row.target_id,method:row.method.trim(),evidence_question_ids:row.evidence_question_ids,
      results:row.results,historical_independent_count:row.historical_independent_count,
      related_pending_review:row.related_pending_review,tag_confidence:row.tag_confidence});
  }
  return {code,paperId,candidates,wholePaperMinutes:body.whole_paper_minutes??null};
}
export function buildDeepSeekRequest(input){
  return {model:MODEL,stream:false,reasoning_effort:'none',response_format:{type:'json_object'},max_tokens:500,
    messages:[
      {role:'system',content:'你是AMC8学习诊断排序助手。只根据给出的真实记录摘要，在候选方法中选出最多3项本周优先目标。不得编造题目、方法、错误步骤、历史记录或孩子的想法。返回JSON对象，字段 paper_id 和 targets。targets的每项只含 target_id、evidence_question_ids 和 reason_codes；ID必须来自对应候选。reason_codes只能是 incorrect, unable, unanswered, guessed, hinted, slow, prior_review_pending, limited_history 中与输入证据相符的值。没有足够依据时少选，不增加掌握度。'},
      {role:'user',content:'请输出JSON。整套用时不能作为单题用时，也不能据此推断具体错因。候选方法与作答证据：'+JSON.stringify({paper_id:input.paperId,
        whole_paper_minutes:input.wholePaperMinutes,candidates:input.candidates})}
    ]};
}
export function parseDeepSeekResponse(payload,input){
  const choice=payload?.choices?.[0];
  if(choice?.finish_reason!=='stop')return {error:'incomplete_model_output'};
  let value;try{value=JSON.parse(choice.message?.content||'');}catch{return {error:'invalid_model_json'};}
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!['paper_id','targets'].includes(k))||value.paper_id!==input.paperId||
    !Array.isArray(value.targets)||value.targets.length<1||value.targets.length>Math.min(3,input.candidates.length))return {error:'invalid_model_diagnosis'};
  const byId=new Map(input.candidates.map(x=>[x.target_id,x])),seen=new Set(),targets=[];
  for(const item of value.targets){
    const candidate=byId.get(item?.target_id);
    if(!candidate||seen.has(item.target_id)||Object.keys(item).some(k=>!['target_id','evidence_question_ids','reason_codes'].includes(k))||
      !Array.isArray(item.evidence_question_ids)||
      !item.evidence_question_ids.length||item.evidence_question_ids.some(id=>!candidate.evidence_question_ids.includes(id))||
      new Set(item.evidence_question_ids).size!==item.evidence_question_ids.length||
      !Array.isArray(item.reason_codes)||!item.reason_codes.length||item.reason_codes.some(x=>!reasons.has(x)))return {error:'invalid_model_diagnosis'};
    const supported=new Set(candidate.results.map(x=>({wrong:'incorrect',unable:'unable',skipped:'unanswered',guessed:'guessed',hinted:'hinted',slow:'slow'})[x]));
    if(candidate.historical_independent_count===0)supported.add('limited_history');
    if(candidate.related_pending_review)supported.add('prior_review_pending');
    if(item.reason_codes.some(x=>!supported.has(x)))return {error:'invalid_model_diagnosis'};
    seen.add(item.target_id);targets.push({target_id:item.target_id,
      evidence_question_ids:item.evidence_question_ids,reason_codes:item.reason_codes});
  }
  return {ok:true,targets,paper_id:input.paperId};
}
