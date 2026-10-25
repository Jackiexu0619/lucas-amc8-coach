export const MODEL='deepseek-flash';
export const IMAGE_ORIGIN='https://jackiexu0619.github.io/lucas-amc8-coach/';

export function normalizeCode(raw){
  return String(raw??'').toUpperCase().replace(/[^A-Z2-9]/g,'');
}

export function validateRequest(body,catalog){
  if(!body||typeof body!=='object'||Array.isArray(body))return {error:'invalid_request'};
  const code=normalizeCode(body.sync_code);
  const paperId=String(body.paper_id??'');
  const questionId=String(body.question_id??'');
  const answer=String(body.student_answer??'').toUpperCase();
  const status=String(body.result_status??'');
  if(code.length<20||code.length>64)return {error:'sync_code_required'};
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(paperId))return {error:'invalid_paper_id'};
  if(!/^archive_\d{4}_\d{2}$/.test(questionId)||!catalog[questionId])return {error:'unknown_question'};
  if(!['wrong','unable','skipped','guessed'].includes(status))return {error:'not_review_question'};
  if(!['A','B','C','D','E','N','X',''].includes(answer))return {error:'invalid_answer'};
  if((status==='wrong'||status==='guessed')&&!/^[A-E]$/.test(answer))return {error:'invalid_answer'};
  const q=catalog[questionId];
  if(!/^[A-E]$/.test(q.answer)||!/^assets\/\d{4}_\d{2}\.webp$/.test(q.image))return {error:'question_not_ready'};
  return {code,paperId,questionId,answer,status,question:q};
}

export function buildDeepSeekRequest(input){
  const q=input.question;
  const imageUrl=new URL(q.image,IMAGE_ORIGIN).href;
  const task={question_id:input.questionId,year:q.year,problem_number:q.number,
    student_answer:input.answer||'未录入',result_status:input.status};
  return {model:MODEL,stream:false,reasoning_effort:'none',response_format:{type:'json_object'},max_tokens:2500,
    messages:[
      {role:'system',content:'你是面向小学高年级 AMC8 学生的中文数学讲解老师。只根据用户提供的原题图片独立解题，不得补造看不清的题干或图形。先算出结果，再从图片选项中找到一致的字母和内容；逐步推导的最终数值必须与选项内容一致。使用初等数学，简洁且可复核。Lucas 的答案只能用于指出可能的错误环节；没有过程证据不能推测他的实际思路。必须输出 JSON 对象，字段为 question_id, answer_letter, option_content, computed_result, knowledge_point, method, entry_point, steps(字符串数组), common_mistake, mastery_tip, recognized_question, image_sufficient(布尔值)。若图片信息不足，设 image_sufficient=false，其他讲解字段可为空。'},
      {role:'user',content:[
        {type:'text',text:'请阅读这张原题图片中的完整题干、选项和图形，独立推导，然后用 JSON 返回。题目元数据：'+JSON.stringify(task)},
        {type:'image_url',image_url:{url:imageUrl,detail:'original'}}
      ]}
    ]};
}

export function parseDeepSeekResponse(payload,input){
  const choice=payload?.choices?.[0];
  if(choice?.finish_reason!=='stop')return {error:'incomplete_model_output'};
  let value;
  try{value=JSON.parse(choice.message?.content||'');}catch{return {error:'invalid_model_json'};}
  if(!value||typeof value!=='object'||Array.isArray(value))return {error:'invalid_model_json'};
  if(value.question_id!==input.questionId)return {error:'question_mismatch'};
  if(value.image_sufficient!==true)return {error:'image_insufficient'};
  if(!/^[A-E]$/.test(value.answer_letter||''))return {error:'invalid_model_answer'};
  if(value.answer_letter!==input.question.answer)return {error:'answer_mismatch',model_answer:value.answer_letter};
  const fields=['recognized_question','option_content','computed_result','knowledge_point','method','entry_point','common_mistake','mastery_tip'];
  if(fields.some(k=>typeof value[k]!=='string'||!value[k].trim()||value[k].length>1200))return {error:'invalid_model_fields'};
  if(!Array.isArray(value.steps)||value.steps.length<1||value.steps.length>8||value.steps.some(s=>typeof s!=='string'||!s.trim()||s.length>1000))return {error:'invalid_model_fields'};
  const simpleNumber=s=>String(s).trim().replace(/[,，\s]/g,'').match(/^[-−]?\d+(?:\.\d+)?(?:%|岁|平方单位)?$/)?.[0]?.replace(/^−/,'-').replace(/(?:岁|平方单位)$/,'');
  const computed=simpleNumber(value.computed_result),option=simpleNumber(value.option_content);
  if(computed&&option&&computed!==option)return {error:'answer_mismatch'};
  return {ok:true,lesson:{question_id:input.questionId,answer_letter:value.answer_letter,
    recognized_question:value.recognized_question,option_content:value.option_content,computed_result:value.computed_result,
    knowledge_point:value.knowledge_point,method:value.method,entry_point:value.entry_point,
    steps:value.steps,common_mistake:value.common_mistake,mastery_tip:value.mastery_tip,
    source:'DeepSeek AI 生成，需对照原题与官方解法核查'}};
}
