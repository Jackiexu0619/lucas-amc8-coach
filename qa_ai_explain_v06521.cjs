'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {reviewItems,cacheKey,runBatch}=require('./coach_ai_explain_v06521.js');

async function main(){
  const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'supabase/functions/amc8-explain/question_index.json'),'utf8'));
  assert.equal(Object.keys(catalog).length,575);
  const {validateRequest,buildDeepSeekRequest,parseDeepSeekResponse,MODEL}=await import('./supabase/functions/amc8-explain/core.mjs');
  const qid='archive_2000_01',q=catalog[qid];
  const input=validateRequest({sync_code:'A'.repeat(32),paper_id:'paper_123',question_id:qid,student_answer:'A',result_status:'wrong'},catalog);
  assert.equal(input.questionId,qid);
  assert.equal(validateRequest({sync_code:'',paper_id:'p',question_id:qid,result_status:'wrong'},catalog).error,'sync_code_required');
  assert.equal(validateRequest({sync_code:'A'.repeat(32),paper_id:'p',question_id:'archive_9999_01',result_status:'wrong'},catalog).error,'unknown_question');
  const deepseek=buildDeepSeekRequest(input);
  assert.equal(MODEL,'deepseek-flash');
  assert.equal(deepseek.messages[1].content[1].image_url.url,'https://jackiexu0619.github.io/lucas-amc8-coach/'+q.image);
  assert.equal(deepseek.response_format.type,'json_object');
  const lesson={question_id:qid,answer_letter:q.answer,option_content:'选项内容',knowledge_point:'知识点',method:'初等方法',
    entry_point:'先观察条件',steps:['写出关系','计算并核对'],common_mistake:'不要漏条件',mastery_tip:'独立复述第一步',
    recognized_question:'题干摘要',image_sufficient:true};
  const payload=value=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
  assert.equal(parseDeepSeekResponse(payload(lesson),input).ok,true);
  assert.equal(parseDeepSeekResponse(payload({...lesson,question_id:'archive_2000_02'}),input).error,'question_mismatch');
  assert.equal(parseDeepSeekResponse(payload({...lesson,answer_letter:'A'}),input).error,q.answer==='A'?undefined:'answer_mismatch');
  assert.equal(parseDeepSeekResponse(payload({...lesson,image_sufficient:false}),input).error,'image_insufficient');
  assert.equal(parseDeepSeekResponse({choices:[{finish_reason:'stop',message:{content:'not json'}}]},input).error,'invalid_model_json');
  assert.equal(parseDeepSeekResponse({choices:[{finish_reason:'length',message:{content:JSON.stringify(lesson)}}]},input).error,'incomplete_model_output');

  const questions=Object.keys(catalog).slice(0,5).map(id=>({id,answer:catalog[id].answer,archive_image:catalog[id].image,year:catalog[id].year,problem_number:catalog[id].number}));
  const records=[{qid:questions[0].id,correct:false,result_status:'wrong',selected_answer:'A'},
    {qid:questions[1].id,correct:false,result_status:'unable'},
    {qid:questions[2].id,correct:false,result_status:'skipped'},
    {qid:questions[3].id,correct:true,guessed:true,result_status:'correct',selected_answer:questions[3].answer},
    {qid:questions[4].id,correct:true,guessed:false,result_status:'correct'}];
  while(records.length<25)records.push({qid:questions[4].id,correct:true,result_status:'correct'});
  const lookup=id=>questions.find(x=>x.id===id);
  const items=reviewItems({paper_id:'paper_123',per_question:records},lookup);
  assert.deepEqual(items.map(x=>x.status),['wrong','unable','skipped','guessed']);
  assert.equal(reviewItems({per_question:[]},lookup).length,0);
  for(const item of items)item.cacheKey=await cacheKey(item,'0.6.5.21');
  assert.notEqual(items[0].cacheKey,await cacheKey({...items[0],paperId:'other_paper'},'0.6.5.21'));
  assert.notEqual(items[0].cacheKey,await cacheKey({...items[0],question:{...items[0].question,archive_image:'assets/other.webp'}},'0.6.5.21'));
  assert.notEqual(items[0].cacheKey,await cacheKey({...items[0],question:{...items[0].question,answer:'C'}},'0.6.5.21'));

  const cache=new Map(),updates=[];let calls=0;
  const result=await runBatch(items,{read:key=>cache.get(key),write:(key,value)=>cache.set(key,value),
    request:async item=>{calls++;if(item===items[1])throw Object.assign(new Error('model_timeout_or_network'),{code:'model_timeout_or_network'});
      return {ok:true,lesson:{question_id:item.question.id,answer_letter:item.question.answer}};},
    onUpdate:state=>updates.push([state.done,state.success,state.failed])});
  assert.deepEqual([result.success,result.failed,calls],[3,1,4],'partial failure retains successful explanations');
  assert.equal(cache.size,3);
  assert.equal(updates.at(-1)[0],4,'progress reaches all questions');
  const retry=await runBatch([items[1]],{read:key=>cache.get(key),write:(key,value)=>cache.set(key,value),force:true,
    request:async item=>({ok:true,lesson:{question_id:item.question.id,answer_letter:item.question.answer}})});
  assert.equal(retry.success,1,'single failed question can be regenerated');
  assert.equal(cache.size,4);
  const cached=await runBatch(items,{read:key=>cache.get(key),write:()=>{},request:async()=>{throw Error('cache miss');}});
  assert.equal(cached.success,4,'reopened report uses local cache without a paid request');
  const mismatch=await runBatch([{...items[0],cacheKey:'mismatch'}],{read:()=>null,write:()=>{throw Error('must not cache');},
    request:async()=>({ok:true,lesson:{question_id:'other',answer_letter:q.answer}})});
  assert.equal(mismatch.failed,1,'mismatched question ID is not displayed or cached');
  const empty=await runBatch([],{read:()=>null,write:()=>{},request:async()=>{throw Error('must not call API');}});
  assert.equal(empty.total,0);
  console.log('PASS: on-demand question selection, canonical image request, model validation, partial failure, timeout, cache, invalidation, and single retry.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});
