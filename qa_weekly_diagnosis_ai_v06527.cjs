const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const diagnosis=require('./coach_weekly_diagnosis_v1.js');
const catalog=JSON.parse(fs.readFileSync(path.join(__dirname,'supabase/functions/amc8-explain/question_index.json'),'utf8'));
const qid=['archive_2003_19','archive_2004_19','archive_2005_20','archive_2000_01'];
const q=(question_id,index,result_status,selected_answer,guessed=false,tag_hint=null)=>({
  question_id,index,result_status,selected_answer,guessed,hint_level:null,duration_sec:null,error_type:null,tag_hint});
const code='ABCDEFGHJKLMNPQRSTUVWXYZ2345',paper_id='QA-ORIGINAL-25';
const model=value=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
const item=(question_id,derived_answer,computed_result,option_content,method,steps)=>({
  question_id,image_sufficient:true,recognized_question:'原题图片中的完整条件与选项',derived_answer,
  computed_result,option_content,method,method_evidence:'由原题条件建立整除与周期关系',
  solution_steps:steps,possible_cause:null,unconfirmed_factors:['孩子具体错误步骤未记录']});
async function run(){
  const core=await import('./supabase/functions/amc8-diagnose/core.mjs');
  const rows=[q(qid[0],1,'wrong','A',false,{method:'区间倍数枚举',confidence:'pdf_method_reviewed_not_math_verified'}),
    q(qid[1],2,'correct','B',true,{method:'同余转化',confidence:'parent_reviewed'}),
    {...q(qid[2],3,'correct','A'),hint_level:0},q(qid[3],4,'correct','B')];
  const analyze=core.validateRequest({phase:'analyze',sync_code:code,paper_id,questions:rows},catalog);
  assert(!analyze.error);
  const request=core.buildDeepSeekRequest(analyze);
  assert.equal(request.model,'deepseek-flash');
  assert.equal(request.messages[1].content.filter(x=>x.type==='image_url').length,4);
  assert(request.messages[1].content.some(x=>x.image_url?.url.endsWith('assets/2003_19.webp')));
  assert.equal(core.validateRequest({phase:'analyze',sync_code:code,paper_id,questions:[{...rows[0],question_id:'archive_1999_01'}]},catalog).error,'invalid_questions');
  assert.equal(core.validateRequest({phase:'analyze',sync_code:code,paper_id,questions:[{...rows[0],selected_answer:'C'}]},catalog).error,'invalid_questions');
  const original=[
    item(qid[0],'C','3','3','使用最小公倍数定位区间内的公倍数',['15、20、25的最小公倍数是300','1000到2000之间有1200、1500、1800，共3个']),
    item(qid[1],'B','62','62','使用最小公倍数处理共同余数',['x−2是3、4、5、6的公倍数','最小为60，所以x=62']),
    item(qid[2],'A','6','6','用周期同余求首次重合',['两人每轮相对移动14格','14n被12整除，最小n=6']),
    item(qid[3],'B','16','16','利用年龄倍数关系与年龄差倒推',['42的一半是21','21−5=16'])];
  const parsed=core.parseDeepSeekResponse(model({paper_id,items:original}),analyze);
  assert(parsed.ok);assert.equal(parsed.items.length,4);
  assert(parsed.items.every(x=>x.status==='answer_key_matched'));
  assert.equal(parsed.items[0].cause_status,'hypothesis_unconfirmed');
  const conflict=core.parseDeepSeekResponse(model({paper_id,items:[{...original[0],derived_answer:'A'},...original.slice(1)]}),analyze);
  assert.equal(conflict.items[0].status,'answer_conflict');
  const missing=core.parseDeepSeekResponse(model({paper_id,items:[{question_id:qid[0],image_sufficient:false},...original.slice(1)]}),analyze);
  assert.equal(missing.items[0].status,'image_insufficient');
  assert.equal(core.parseDeepSeekResponse(model({paper_id,items:[{...original[0],question_id:'archive_1999_01'},...original.slice(1)]}),analyze).error,'invalid_model_diagnosis');
  assert.equal(core.parseDeepSeekResponse({choices:[{finish_reason:'stop',message:{content:'bad'}}]},analyze).error,'invalid_model_json');
  const training='archive_2006_23';
  const synthesis=core.validateRequest({phase:'synthesize',sync_code:code,paper_id,
    analyses:parsed.items,training_candidates:[training]},catalog);
  assert(!synthesis.error);
  assert(core.buildDeepSeekRequest(synthesis).messages[1].content.some(x=>x.image_url?.url.endsWith('assets/2006_23.webp')));
  const target={target_id:qid[0],method:'利用最小公倍数处理整除与共同余数',
    observed_gap:'第1题答错，第2题猜对；两题均未提供稳定独立完成证据',
    possible_cause:'可能未及时把多个整除条件转为公倍数',confidence:'medium',
    confidence_basis:'两道原题独立推导均涉及最小公倍数，答案与官方答案一致；具体错因未确认',
    unconfirmed_factors:['第1题具体计算步骤未知'],training_goal:'在新情境中独立建立最小公倍数或共同余数关系',
    evidence_question_ids:[qid[0],qid[1]],method_links:[
      {question_id:qid[0],reason:'三个数的公倍数用于区间计数'},
      {question_id:qid[1],reason:'共同余数转为最小公倍数'}],positive_question_ids:[qid[2]],
    training_match:{question_id:training,answer_letter:'A',reason:'金币分配余数可转为30的倍数，答案A对应28除以7余0'}};
  const grouped=core.parseDeepSeekResponse(model({paper_id,targets:[target]}),synthesis);
  assert(grouped.ok);assert.equal(grouped.targets[0].evidence_question_ids.length,2);
  assert.equal(core.parseDeepSeekResponse(model({paper_id,targets:[{...target,evidence_question_ids:[qid[0],'archive_1999_01']}]}),synthesis).error,'invalid_model_diagnosis');
  assert.equal(core.parseDeepSeekResponse(model({paper_id,targets:[{...target,training_match:{...target.training_match,answer_letter:'B'}}]}),synthesis).error,'invalid_model_diagnosis');
  assert.equal(core.parseDeepSeekResponse(model({paper_id,targets:[{...target,positive_question_ids:[qid[3]]}]}),synthesis).error,
    'invalid_model_diagnosis','unknown hint use cannot establish independent mastery');
  const fallback={paper_id,focus:[{method:'规则候选',evidence_question_ids:[qid[0]]}],unresolved:[],source:'rules'};
  const applied=diagnosis.applyAiDiagnosis(fallback,parsed.items,grouped,[training]);
  assert.equal(applied.source,'ai_original_analysis');assert.equal(applied.focus[0].training_match.question_id,training);
  assert.equal(applied.focus[0].possible_cause,target.possible_cause);
  assert.equal(applied.focus[0].cause_status,'hypothesis_unconfirmed');
  assert.equal(diagnosis.applyAiDiagnosis(fallback,conflict.items,grouped,[training]),null,'conflicted answer cannot support certain target');
  const pool=[{id:'archive_2011_20',source:'2011 AMC8',official:true},{id:training,source:'2006 AMC8',official:true},
    {id:'archive_2010_20',source:'2010 AMC8',official:true}];
  const plan=diagnosis.selectDaily([pool[0],pool[2],{id:'archive_2016_20',source:'2016 AMC8'}],pool,applied,
    new Set([pool[0].id]),new Set());
  assert.equal(plan.questions.length,3);assert(plan.questions.some(x=>x.id===training));
  assert.equal(plan.context[0].relation,'ai_image_answer_matched');
  assert(!diagnosis.selectDaily([pool[0],pool[2],{id:'archive_2016_20'}],pool,applied,
    new Set([pool[0].id]),new Set([training])).context.length,'excluded training question remains uncovered');
  console.log('SAMPLE',JSON.stringify({method:applied.focus[0].method,
    evidence:applied.focus[0].evidence_question_ids,confidence:applied.focus[0].confidence,
    training_question:applied.focus[0].training_match.question_id,possible_cause_status:applied.focus[0].cause_status}));
  console.log('PASS: real AMC8 images and human-checked arithmetic, answer conflicts, cross-label method grouping, canonical candidate matching, and three-slot plan');
}
run().catch(e=>{console.error(e);process.exitCode=1});
