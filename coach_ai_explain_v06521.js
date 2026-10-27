/* On-demand explanations for the latest complete weekend mock. AI output never changes learning state. */
(function(root){'use strict';
const CACHE_KEY='lucas_amc8_ai_explain_v2';
// This app-version bump does not change explanation prompts or payloads; keep v0.6.5.21 explanations reusable.
const EXPLANATION_CACHE_VERSION='0.6.5.21';
const MESSAGES={sync_code_required:'本机尚未绑定已有云同步码。请先在家长设置中绑定；不会自动上传学习数据。',
  sync_code_unregistered:'同步码尚未在云端登记，无法使用 AI 讲解。',rate_limited:'本同步码的 AI 讲解额度暂时用完，请稍后再试。',
  service_not_configured:'AI 服务密钥尚未配置。',model_timeout_or_network:'AI 请求超时或网络不可用，请单题重试。',
  model_unavailable:'AI 服务暂时不可用，请单题重试。',invalid_model_json:'AI 返回格式无效，请单题重试。',
  question_mismatch:'AI 返回了其他题目的讲解，已拦截。',answer_mismatch:'答案待核验：AI 结论与题库标准答案不一致，讲解未展示。',
  image_insufficient:'原题图片信息不足，暂时无法自动讲解；请使用原始解析入口。',
  invalid_model_fields:'AI 讲解内容不完整，请单题重试。',incomplete_model_output:'AI 输出被截断，请单题重试。',
  invalid_hint_level:'提示使用级别缺少可靠记录，暂不能生成讲解。'};
function reviewItems(latest,lookup){
  if(!latest||!Array.isArray(latest.per_question)||latest.per_question.length!==25)return [];
  const paperId=String(latest.paper_id||latest.mock_key||('legacy_'+String(latest.date||'unknown').replace(/[^0-9]/g,'')+'_'+String(latest.question_ids?.[0]||'paper'))).slice(0,100);
  return latest.per_question.map((r,i)=>{
    if(!r||!(r.result_status==='unable'||r.result_status==='skipped'||!r.correct||r.guessed))return null;
    const q=lookup(r.qid||latest.question_ids?.[i]);
    if(!q||!q.id)return null;
    const status=r.result_status==='unable'?'unable':r.result_status==='skipped'?'skipped':r.guessed&&r.correct?'guessed':'wrong';
    return {paperId,question:q,index:Number(r.index)||i+1,answer:r.selected_answer||'',status};
  }).filter(Boolean);
}
function dailyReviewItems(session,sessions,lookup,findAttempt){
  const paperId=String(session?.paper_id||'');
  if(!/^[A-Za-z0-9_-]{1,100}$/.test(paperId)||!Array.isArray(session.question_ids))return [];
  return session.question_ids.map((id,i)=>{
    const attempt=findAttempt(session,id,i,sessions),q=lookup(id);
    if(!attempt||!q?.archive_image||!/^archive_\d{4}_\d{2}$/.test(q.id))return null;
    let status='';
    if(attempt.result_status==='unable')status='unable';
    else if(attempt.result_status==='skipped')status='skipped';
    else if(attempt.result_status==='wrong'||attempt.correct===false)status='wrong';
    else if(attempt.correct===true&&attempt.guessed===true)status='guessed';
    else if(attempt.correct===true&&(attempt.hint_level===1||attempt.hint_level===2))status='hinted';
    if(!status)return null;
    return {paperId,question:q,index:i+1,answer:attempt.selected_answer||'',status,
      ...(status==='hinted'?{hintLevel:attempt.hint_level}:{})};
  }).filter(Boolean);
}
async function cacheKey(item,version,cryptoApi=globalThis.crypto){
  const q=item.question;
  const content=JSON.stringify([version,item.paperId,q.id,q.archive_image||'',q.prompt_en||q.prompt_zh||q.prompt||'',q.choice_texts||q.choices||[],q.answer||'']);
  const hash=await cryptoApi.subtle.digest('SHA-256',new TextEncoder().encode(content));
  return [...new Uint8Array(hash)].map(x=>x.toString(16).padStart(2,'0')).join('');
}
async function runBatch(items,{read,write,request,onUpdate=()=>{},force=false}){
  const state={total:items.length,done:0,success:0,failed:0,results:[]};
  for(const item of items){
    const key=item.cacheKey;
    let lesson=!force?read(key):null;
    let error=null,cached=!!lesson;
    if(!lesson){
      try{
        const response=await request(item);
        lesson=response?.lesson;
        if(!response?.ok||lesson?.question_id!==item.question.id||lesson?.answer_letter!==item.question.answer)throw new Error('answer_mismatch');
        write(key,lesson);
      }catch(e){lesson=null;error=e?.code||e?.message||'model_unavailable';}
    }
    state.done++;
    if(lesson)state.success++;else state.failed++;
    const row={item,lesson,error,cached};state.results.push(row);
    onUpdate({...state},row);
  }
  return state;
}
if(typeof module!=='undefined'&&module.exports){module.exports={reviewItems,dailyReviewItems,cacheKey,runBatch,MESSAGES};return;}
if(!root||!root.document||root.__amcAiExplainV06521)return;
root.__amcAiExplainV06521=true;

function loadCache(){try{const value=JSON.parse(localStorage.getItem(CACHE_KEY)||'{}');return value&&typeof value==='object'?value:{}}catch{return {};}}
function saveCache(cache){
  const entries=Object.entries(cache).slice(-100);
  try{localStorage.setItem(CACHE_KEY,JSON.stringify(Object.fromEntries(entries)));}catch{}
}
function el(tag,text,className){const node=document.createElement(tag);if(text!==undefined)node.textContent=String(text);if(className)node.className=className;return node;}
function showLesson(host,lesson){
  host.replaceChildren();
  host.append(el('p','AI 生成讲解，需对照原题和官方解法核查。','small'));
  for(const [label,value] of [['识别题意',lesson.recognized_question],['考查知识点',lesson.knowledge_point],
    ['解题方法',lesson.method],['解题切入点',lesson.entry_point]]){
    const p=el('p');p.append(el('b',label+'：'),document.createTextNode(value));host.append(p);
  }
  const steps=el('ol');for(const step of lesson.steps)steps.append(el('li',step));
  host.append(el('b','逐步推导：'),steps);
  const answer=el('p');answer.append(el('b','题库标准答案：'),document.createTextNode(lesson.answer_letter+'；AI 计算结果：'+lesson.computed_result+'；AI 识别的选项内容：'+lesson.option_content+'（请对照原题核查）'));host.append(answer);
  for(const [label,value] of [['易错提醒',lesson.common_mistake],['掌握建议',lesson.mastery_tip]]){
    const p=el('p');p.append(el('b',label+'：'),document.createTextNode(value));host.append(p);
  }
}
function errorText(code){return MESSAGES[code]||'AI 讲解暂时失败，请单题重试。';}
async function requestOne(item){
  if(typeof cloudConfigured!=='function'||!cloudConfigured())throw Object.assign(new Error('service_not_configured'),{code:'service_not_configured'});
  const code=typeof getSyncCode==='function'?getSyncCode():'';
  if(code.length<20)throw Object.assign(new Error('sync_code_required'),{code:'sync_code_required'});
  let response;
  try{response=await fetch(CLOUD_CFG.url+'/functions/v1/amc8-explain',{
    method:'POST',headers:cloudHeaders(),signal:AbortSignal.timeout(60000),
    body:JSON.stringify({sync_code:code,paper_id:item.paperId,question_id:item.question.id,
      student_answer:item.answer,result_status:item.status,
      ...(item.status==='hinted'?{hint_level:item.hintLevel}:{})})
  });}catch{throw Object.assign(new Error('model_timeout_or_network'),{code:'model_timeout_or_network'});}
  let data;
  try{data=await response.json();}catch{throw Object.assign(new Error('invalid_model_json'),{code:'invalid_model_json'});}
  if(!response.ok)throw Object.assign(new Error(data?.error||'model_unavailable'),{code:data?.error||'model_unavailable'});
  return data;
}
async function mount(){
  const host=document.getElementById('latestMockLearningReport');if(!host)return;
  const history=(S.mock_detail_history||[]).filter(x=>x&&Array.isArray(x.per_question)&&x.per_question.length===25);
  const latest=history.at(-1);if(!latest)return;
  const items=reviewItems(latest,id=>qById(id));
  const section=el('section',undefined,'card');section.id='mockAiExplain';
  const heading=el('h3','AI 错题讲解');section.append(heading);
  const description=el('p',items.length?'本套有 '+items.length+' 道题待复盘。仅点击后逐题调用 AI；已有讲解优先从本地缓存读取。':'本套没有需要 AI 讲解的待复盘题，未发起请求。','small');
  section.append(description);
  const progress=el('p','', 'small');progress.setAttribute('role','status');section.append(progress);
  const controls=el('div');controls.className='row';section.append(controls);
  const list=el('div');section.append(list);
  host.querySelector('.mock-question-review-section')?.before(section);
  if(!items.length)return;
  const cache=loadCache();
  const prepared=[];
  for(const item of items){
    item.cacheKey=await cacheKey(item,EXPLANATION_CACHE_VERSION);
    const row=el('div',undefined,'mock-ai-explain-row');
    const title=el('b','第'+item.index+'题 · '+item.question.year+' AMC8 Q'+item.question.problem_number);
    const question=el('img');question.className='mock-review-paper-image';question.src=item.question.archive_image;
    question.alt='第'+item.index+'题原题图片';question.loading='lazy';
    const answer=el('p','Lucas 的答案：'+(item.status==='unable'?'不会':item.status==='skipped'?'未做':item.answer||'未记录')+
      '　题库标准答案：'+item.question.answer+'　结果：'+({wrong:'答错',unable:'不会',skipped:'未做',guessed:'猜对'}[item.status]),'small');
    const status=el('span','', 'small');
    const detail=el('div');detail.className='mock-review-solution';
    const retry=el('button','单题重新生成');retry.type='button';
    row.append(title,document.createTextNode(' '),status,question,answer,detail,retry);list.append(row);
    const entry={...item,statusNode:status,detailNode:detail,retryButton:retry};prepared.push(entry);
    const cached=cache[item.cacheKey]?.lesson;
    if(cached?.question_id===item.question.id&&cached?.answer_letter===item.question.answer){status.textContent='已缓存';showLesson(detail,cached);}
    else{status.textContent='未生成';detail.textContent='原有解析仍可在下方逐题展开查看。';}
    retry.onclick=()=>execute([entry],true);
  }
  const batch=el('button','生成本套待复盘题的 AI 讲解');batch.type='button';batch.className='primary';controls.append(batch);
  batch.onclick=()=>execute(prepared,false);
  let busy=false;
  async function execute(targets,force){
    if(busy)return;busy=true;batch.disabled=true;for(const item of prepared)item.retryButton.disabled=true;
    progress.textContent='正在处理 0/'+targets.length+'；成功 0，失败 0。';
    try{await runBatch(targets,{
      force,read:key=>cache[key]?.lesson||null,
      write:(key,lesson)=>{cache[key]={lesson,at:new Date().toISOString()};saveCache(cache);},
      request:requestOne,onUpdate:(state,row)=>{
        progress.textContent='已处理 '+state.done+'/'+state.total+'；成功 '+state.success+'，失败 '+state.failed+'。';
        if(row.lesson){row.item.statusNode.textContent=row.cached?'已缓存':'已生成';showLesson(row.item.detailNode,row.lesson);}
        else{row.item.statusNode.textContent='失败';row.item.detailNode.textContent=errorText(row.error);}
      }
    });}finally{busy=false;batch.disabled=false;for(const item of prepared)item.retryButton.disabled=false;}
  }
}
async function mountDaily(){
  const host=document.getElementById('dailyReviewHistory');if(!host)return;
  const sessions=dailyHistorySessions();
  const cache=loadCache();
  for(const paper of host.querySelectorAll('.daily-history-paper')){
    paper.querySelector('.daily-ai-controls')?.remove();
    paper.querySelectorAll('.daily-ai-result').forEach(node=>node.remove());
    const matched=sessions.filter(s=>s.date===paper.dataset.date&&s.paper_id&&s.paper_id===paper.dataset.paperId);
    const session=matched.length===1?matched[0]:null;
    const items=session?dailyReviewItems(session,sessions,qById,dailyHistoryAttempt):[];
    const controls=el('div',undefined,'daily-ai-controls');
    controls.append(el('h4','本卷 AI 错题讲解'));
    const description=el('p',!session?'旧记录缺少可靠卷号，暂不能生成 AI 讲解。':items.length?
      '本卷有 '+items.length+' 道待复盘题；点击后才调用 AI，已生成的讲解优先使用本地缓存。':
      '本卷没有可自动讲解的待复盘真题，未发起请求。','small');
    controls.append(description);
    const progress=el('p','', 'small');progress.setAttribute('role','status');controls.append(progress);
    paper.querySelector('summary')?.after(controls);
    if(!items.length)continue;
    const prepared=[];
    for(const item of items){
      item.cacheKey=await cacheKey(item,EXPLANATION_CACHE_VERSION);
      const question=paper.querySelector('.daily-history-question[data-question-index="'+item.index+'"]');
      if(!question)continue;
      const result=el('div',undefined,'daily-ai-result mock-review-solution');
      result.append(el('h4','AI 生成讲解'));
      const status=el('span','', 'small'),detail=el('div'),retry=el('button','单题重新生成');
      retry.type='button';detail.className='daily-ai-detail';result.append(status,detail,retry);question.append(result);
      const entry={...item,statusNode:status,detailNode:detail,retryButton:retry};prepared.push(entry);
      const cached=cache[item.cacheKey]?.lesson;
      if(cached?.question_id===item.question.id&&cached?.answer_letter===item.question.answer){
        status.textContent='已缓存';showLesson(detail,cached);
      }else{status.textContent='未生成';detail.textContent='已有解答资料或暂无可靠解析的说明保留在上方。';}
      retry.onclick=()=>execute([entry],true);
    }
    if(!prepared.length)continue;
    const batch=el('button','生成本卷待复盘题讲解');batch.type='button';batch.className='primary';controls.append(batch);
    batch.onclick=()=>execute(prepared,false);
    let busy=false;
    async function execute(targets,force){
      if(busy)return;busy=true;batch.disabled=true;for(const item of prepared)item.retryButton.disabled=true;
      progress.textContent='正在处理 0/'+targets.length+'；成功 0，失败 0。';
      try{await runBatch(targets,{
        force,read:key=>cache[key]?.lesson||null,
        write:(key,lesson)=>{cache[key]={lesson,at:new Date().toISOString()};saveCache(cache);},
        request:requestOne,onUpdate:(state,row)=>{
          progress.textContent='已处理 '+state.done+'/'+state.total+'；成功 '+state.success+'，失败 '+state.failed+'。';
          if(row.lesson){row.item.statusNode.textContent=row.cached?'已缓存':'已生成';showLesson(row.item.detailNode,row.lesson);}
          else{row.item.statusNode.textContent='失败';row.item.detailNode.textContent=errorText(row.error);}
        }
      });}finally{busy=false;batch.disabled=false;for(const item of prepared)item.retryButton.disabled=false;}
    }
  }
}
if(typeof renderReport==='function'){
  const previous=renderReport;
  renderReport=function(){const result=previous.apply(this,arguments);void mount().catch(()=>{});void mountDaily().catch(()=>{});return result;};
}
root.LucasAMC8Explain={reviewItems,dailyReviewItems,cacheKey,runBatch,mount,mountDaily};
})(typeof window!=='undefined'?window:globalThis);
