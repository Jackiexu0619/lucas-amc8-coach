// Canonical archive images and answer keys bind every AI diagnosis.
export const MODEL='deepseek-flash';
export const IMAGE_ORIGIN='https://jackiexu0619.github.io/lucas-amc8-coach/';
const answer=v=>/^[A-E]$/.test(v);
const paper=v=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,100}$/.test(v);
const id=v=>typeof v==='string'&&/^archive_\d{4}_\d{2}$/.test(v);
const text=(v,max)=>typeof v==='string'&&!!v.trim()&&v.length<=max;
const optional=(v,max)=>v===null||v===undefined||text(v,max);
const kinds=new Set(['correct','wrong','unable','skipped']);
const errors=new Set(['knowledge_gap','method_gap','execution_error','time_issue','unsure']);
const broad=new Set(['几何','代数','概率','数论','算术','组合','应用题','逻辑','数学']);
const method=v=>text(v,100)&&!broad.has(v.trim())&&!/^archive_(method|unclassified)_/i.test(v)&&v!=='human_confirmed';
const codeValue=v=>String(v??'').toUpperCase().replace(/[^A-Z2-9]/g,'');
const canonical=(qid,catalog)=>id(qid)&&catalog[qid]&&answer(catalog[qid].answer)&&
  /^assets\/\d{4}_\d{2}\.webp$/.test(catalog[qid].image)?catalog[qid]:null;
const numeric=v=>String(v??'').trim().replace(/[,，\s]/g,'').match(/^[-−]?\d+(?:\.\d+)?(?:%|岁|平方单位)?$/)?.[0]?.replace(/^−/,'-').replace(/(?:岁|平方单位)$/,'');
function answerState(row,q){
  if(!kinds.has(row.result_status)||typeof row.guessed!=='boolean'||
    ![null,0,1,2].includes(row.hint_level)||!(row.selected_answer===null||answer(row.selected_answer)))return false;
  if(row.result_status==='correct')return row.selected_answer===q.answer;
  if(row.result_status==='wrong')return answer(row.selected_answer)&&row.selected_answer!==q.answer;
  return row.selected_answer===null&&!row.guessed;
}
export function validateRequest(body,catalog){
  if(!body||typeof body!=='object'||Array.isArray(body))return {error:'invalid_request'};
  const code=codeValue(body.sync_code),paperId=body.paper_id;
  if(code.length<20||code.length>64)return {error:'sync_code_required'};
  if(!paper(paperId))return {error:'invalid_paper_id'};
  if(body.phase==='analyze'){
    if(!Array.isArray(body.questions)||body.questions.length<1||body.questions.length>5)return {error:'invalid_questions'};
    const seen=new Set(),questions=[];
    for(const row of body.questions){
      const q=canonical(row?.question_id,catalog);
      if(!q||seen.has(row.question_id)||!Number.isInteger(row.index)||row.index<1||row.index>25||
        !answerState(row,q)||
        !(row.duration_sec===null||(Number.isFinite(row.duration_sec)&&row.duration_sec>=0&&row.duration_sec<=3600))||
        !(row.error_type===null||errors.has(row.error_type))||
        (row.tag_hint!==null&&row.tag_hint!==undefined&&(!text(row.tag_hint?.method,150)||
          !['parent_reviewed','pdf_method_reviewed_not_math_verified','source_metadata'].includes(row.tag_hint?.confidence))))return {error:'invalid_questions'};
      seen.add(row.question_id);
      questions.push({question_id:row.question_id,index:row.index,selected_answer:row.selected_answer,
        result_status:row.result_status,guessed:row.guessed,hint_level:row.hint_level,
        duration_sec:row.duration_sec,error_type:row.error_type,tag_hint:row.tag_hint||null,question:q});
    }
    return {phase:'analyze',code,paperId,questions};
  }
  if(body.phase==='synthesize'){
    if(!Array.isArray(body.analyses)||body.analyses.length<1||body.analyses.length>25||
      !Array.isArray(body.training_candidates)||body.training_candidates.length>6)return {error:'invalid_synthesis'};
    const seen=new Set(),analyses=[];
    for(const row of body.analyses){
      const q=canonical(row?.question_id,catalog);
      if(!q||seen.has(row.question_id)||!Number.isInteger(row.index)||row.index<1||row.index>25||
        !answerState(row,q)||row.derived_answer!==q.answer||!method(row.method)||
        !text(row.method_evidence,300)||!text(row.solution_outline,500)||
        !optional(row.possible_cause,250)||!Array.isArray(row.unconfirmed_factors)||
        row.unconfirmed_factors.length>4||row.unconfirmed_factors.some(x=>!text(x,150)))return {error:'invalid_synthesis'};
      seen.add(row.question_id);analyses.push({...row,question:q});
    }
    const candidates=[],candidateIds=new Set();
    for(const qid of body.training_candidates){
      const q=canonical(qid,catalog);
      if(!q||candidateIds.has(qid)||seen.has(qid))return {error:'invalid_synthesis'};
      candidateIds.add(qid);candidates.push({question_id:qid,question:q});
    }
    return {phase:'synthesize',code,paperId,analyses,trainingCandidates:candidates};
  }
  return {error:'invalid_phase'};
}
const imageUrl=q=>new URL(q.image,IMAGE_ORIGIN).href;
export function buildDeepSeekRequest(input){
  if(input.phase==='analyze'){
    const content=[{type:'text',text:'逐题阅读原题图片。只使用图片中的题干、选项与图形独立推导；标签仅供参考，冲突时以原题为准。Lucas 的作答是事实，不得编造其思考步骤。输出 JSON {paper_id,items}，每项含 question_id,image_sufficient,recognized_question,derived_answer,option_content,computed_result,method,method_evidence,solution_steps(字符串数组),possible_cause(可为null),unconfirmed_factors(字符串数组)。图片不足时 image_sufficient=false，其余字段可为空。'}];
    for(const row of input.questions){
      content.push({type:'text',text:JSON.stringify({paper_id:input.paperId,question_id:row.question_id,
        question_number:row.index,student_answer:row.selected_answer,result_status:row.result_status,
        guessed:row.guessed,hint_level:row.hint_level,duration_sec:row.duration_sec,error_type:row.error_type,
        tag_hint:row.tag_hint})});
      content.push({type:'image_url',image_url:{url:imageUrl(row.question),detail:'original'}});
    }
    return {model:MODEL,stream:false,reasoning_effort:'none',response_format:{type:'json_object'},max_tokens:3500,
      messages:[{role:'system',content:'你是 AMC8 数学原题分析员。先独立解题再核对选项。不得把标签当作解法、把答错直接当作概念缺陷，或声称知道学生未记录的思考过程。简洁输出 JSON。'},
        {role:'user',content}]};
  }
  const content=[{type:'text',text:'下面是已通过官方答案核对的逐题 AI 原题分析。结合错误、猜对、不会、未做与正确证据，归纳最多3个具体可训练的方法；不同标签若实际方法相同可合并。提示级别为null的正确题仅能说明答对，不能证明独立掌握；positive_question_ids只能引用明确hint_level=0且未猜的正确题。不要把推测错因写成事实。输出 JSON {paper_id,targets}。每个目标含 target_id(一条弱项原题ID),method,observed_gap,possible_cause(可为null),confidence(low或medium),confidence_basis,unconfirmed_factors(字符串数组),training_goal,evidence_question_ids,method_links([{question_id,reason}]),positive_question_ids,training_match(可为null；非空时含 question_id,answer_letter,reason)。训练候选必须看图独立解题，只有同方法且答案与图中选项一致才匹配。证据不足则 targets 可为空。\n'+JSON.stringify({paper_id:input.paperId,analyses:input.analyses.map(({question,...x})=>x),
    training_candidate_ids:input.trainingCandidates.map(x=>x.question_id)})}];
  for(const c of input.trainingCandidates){
    content.push({type:'text',text:'训练候选题 '+c.question_id+'：请核对是否与诊断目标使用同一具体方法。'});
    content.push({type:'image_url',image_url:{url:imageUrl(c.question),detail:'original'}});
  }
  return {model:MODEL,stream:false,reasoning_effort:'none',response_format:{type:'json_object'},max_tokens:2500,
    messages:[{role:'system',content:'你是 AMC8 数学诊断员。只依据提供的原题分析和真实作答，不猜测孩子的内心过程。训练候选必须凭原题图片验证方法与官方答案。输出 JSON。'},
      {role:'user',content}]};
}
export function parseDeepSeekResponse(payload,input){
  const choice=payload?.choices?.[0];
  if(choice?.finish_reason!=='stop')return {error:'incomplete_model_output'};
  let data;try{data=JSON.parse(choice.message?.content||'');}catch{return {error:'invalid_model_json'};}
  if(!data||typeof data!=='object'||Array.isArray(data)||data.paper_id!==input.paperId)return {error:'invalid_model_diagnosis'};
  if(input.phase==='analyze'){
    if(!Array.isArray(data.items)||data.items.length!==input.questions.length)return {error:'invalid_model_diagnosis'};
    const byId=new Map(input.questions.map(x=>[x.question_id,x])),seen=new Set(),items=[];
    for(const item of data.items){
      const source=byId.get(item?.question_id);
      if(!source||seen.has(item.question_id)||typeof item.image_sufficient!=='boolean')return {error:'invalid_model_diagnosis'};
      seen.add(item.question_id);
      const common={question_id:item.question_id,index:source.index,selected_answer:source.selected_answer,
        result_status:source.result_status,guessed:source.guessed,hint_level:source.hint_level,
        duration_sec:source.duration_sec,error_type:source.error_type};
      if(!item.image_sufficient){items.push({...common,status:'image_insufficient'});continue;}
      if(!answer(item.derived_answer)||!text(item.recognized_question,350)||!text(item.option_content,120)||
        !text(item.computed_result,120)||!Array.isArray(item.solution_steps)||item.solution_steps.length<1||
        item.solution_steps.length>6||item.solution_steps.some(x=>!text(x,350))||
        !optional(item.possible_cause,250)||!Array.isArray(item.unconfirmed_factors)||
        item.unconfirmed_factors.length>4||item.unconfirmed_factors.some(x=>!text(x,150)))return {error:'invalid_model_diagnosis'};
      if(item.derived_answer!==source.question.answer||
        (numeric(item.computed_result)&&numeric(item.option_content)&&numeric(item.computed_result)!==numeric(item.option_content))){
        items.push({...common,status:'answer_conflict',derived_answer:item.derived_answer});continue;
      }
      if(!method(item.method)||!text(item.method_evidence,300)){
        items.push({...common,status:'method_unresolved'});continue;
      }
      items.push({...common,status:'answer_key_matched',derived_answer:item.derived_answer,
        recognized_question:item.recognized_question,method:item.method.trim(),method_evidence:item.method_evidence,
        solution_outline:item.solution_steps.join('；').slice(0,500),possible_cause:item.possible_cause||null,
        cause_status:'hypothesis_unconfirmed',unconfirmed_factors:item.unconfirmed_factors});
    }
    return {ok:true,paper_id:input.paperId,items};
  }
  if(!Array.isArray(data.targets)||data.targets.length>3)return {error:'invalid_model_diagnosis'};
  const byId=new Map(input.analyses.map(x=>[x.question_id,x]));
  const candidates=new Map(input.trainingCandidates.map(x=>[x.question_id,x]));
  const seen=new Set(),targets=[];
  for(const row of data.targets){
    const evidence=row?.evidence_question_ids,weak=byId.get(row?.target_id);
    if(!weak||seen.has(row.target_id)||!Array.isArray(evidence)||!evidence.includes(row.target_id)||
      evidence.length<1||evidence.length>8||new Set(evidence).size!==evidence.length||
      evidence.some(x=>!byId.has(x))||!evidence.some(x=>byId.get(x).result_status!=='correct'||byId.get(x).guessed||byId.get(x).hint_level>0)||
      !method(row.method)||!text(row.observed_gap,300)||!optional(row.possible_cause,250)||
      !['low','medium'].includes(row.confidence)||!text(row.confidence_basis,300)||
      !Array.isArray(row.unconfirmed_factors)||row.unconfirmed_factors.length>5||row.unconfirmed_factors.some(x=>!text(x,150))||
      !text(row.training_goal,300)||!Array.isArray(row.method_links)||row.method_links.length!==evidence.length||
      new Set(row.method_links.map(x=>x.question_id)).size!==evidence.length||
      row.method_links.some(x=>!evidence.includes(x.question_id)||!text(x.reason,250))||
      !Array.isArray(row.positive_question_ids)||row.positive_question_ids.some(x=>!byId.has(x)||
        byId.get(x).result_status!=='correct'||byId.get(x).guessed||byId.get(x).hint_level!==0))return {error:'invalid_model_diagnosis'};
    if(weak.result_status==='correct'&&!weak.guessed&&!(weak.hint_level>0))return {error:'invalid_model_diagnosis'};
    let trainingMatch=null;
    if(row.training_match!==null&&row.training_match!==undefined){
      const c=candidates.get(row.training_match.question_id);
      if(!c||row.training_match.answer_letter!==c.question.answer||!text(row.training_match.reason,250))return {error:'invalid_model_diagnosis'};
      trainingMatch={question_id:row.training_match.question_id,reason:row.training_match.reason,
        answer_letter:row.training_match.answer_letter};
    }
    seen.add(row.target_id);
    targets.push({target_id:row.target_id,method:row.method.trim(),observed_gap:row.observed_gap,
      possible_cause:row.possible_cause||null,cause_status:'hypothesis_unconfirmed',confidence:row.confidence,
      confidence_basis:row.confidence_basis,unconfirmed_factors:row.unconfirmed_factors,
      training_goal:row.training_goal,evidence_question_ids:evidence,method_links:row.method_links,
      positive_question_ids:row.positive_question_ids,training_match:trainingMatch});
  }
  return {ok:true,paper_id:input.paperId,targets};
}
