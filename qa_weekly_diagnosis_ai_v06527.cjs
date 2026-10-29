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
  const noTags=core.validateRequest({phase:'analyze',sync_code:code,paper_id,
    questions:rows.map(x=>({...x,tag_hint:null}))},catalog);
  assert(!noTags.error);
  assert(core.parseDeepSeekResponse(model({paper_id,items:original}),noTags).items.every(x=>x.status==='answer_key_matched'),
    'original image analysis must not require a method tag');
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
  const diverseIds=['archive_2000_13','archive_2001_14','archive_2002_15','archive_2003_17',
    'archive_2004_18','archive_2005_19','archive_2006_23','archive_2007_20'];
  const diversePool=diverseIds.map(id=>({id,year:Number(id.slice(8,12)),problem_number:Number(id.slice(13))}));
  const untagged=diagnosis.selectTrainingCandidates(diversePool,[],()=>({}));
  assert.deepEqual(untagged,diagnosis.selectTrainingCandidates([...diversePool].reverse(),[],()=>({})),
    'diversity selection is stable even if bank enumeration order changes');
  assert(untagged.includes(training),'an untagged relevant original remains eligible for image checking');
  assert.deepEqual(new Set(untagged.map(id=>Number(id.slice(13,15))<=16?'low':Number(id.slice(13,15))<=20?'middle':'high')),
    new Set(['low','middle','high']),'candidate images span the weekday problem-number bands');
  assert(new Set(untagged.map(id=>id.slice(8,12))).size>=4,'candidate images span years');
  const wrongLabels=Object.fromEntries(diverseIds.slice(0,2).map(id=>[id,{method:'错误标注的方法',groupKey:'wrong'}]));
  const mixed=diagnosis.selectTrainingCandidates(diversePool,[{method:'错误标注的方法',groupKey:'wrong'}],
    q=>wrongLabels[q.id]||{});
  assert(mixed.includes(training),'bad tags cannot consume all image-candidate slots');
  assert(mixed.filter(id=>wrongLabels[id]).length<=2,'at most two candidates follow labels');
  const matchedIds=['archive_2000_13','archive_2003_17','archive_2006_23','archive_2007_20','archive_2008_22'];
  const independentIds=['archive_2001_14','archive_2005_15','archive_2002_18','archive_2009_19','archive_2004_24'];
  const limitPool=[...matchedIds,...independentIds].map(id=>({id,year:Number(id.slice(8,12)),
    problem_number:Number(id.slice(13))}));
  assert(limitPool.every(x=>catalog[x.id]),'quota fixture uses actual archived question IDs');
  const limitTags=q=>matchedIds.includes(q.id)?{method:'错误标注的方法',groupKey:'wrong'}:{};
  const weakTag=[{method:'错误标注的方法',groupKey:'wrong'}];
  const score=id=>{const t=limitTags({id});return weakTag.reduce((n,x)=>n+
    (x.groupKey&&x.groupKey===t.groupKey?4:0)+(x.method&&x.method===t.method?3:0)+
    (x.skill&&x.skill===t.skill?2:0),0);};
  const limited=diagnosis.selectTrainingCandidates(limitPool,weakTag,limitTags);
  assert.equal(limited.length,6);
  assert.equal(matchedIds.length,5,'fixture has more than two matching labels');
  assert.equal(limited.filter(id=>score(id)>0).length,2,'the final six contain at most two label matches');
  assert(limited.slice(2).every(id=>score(id)===0),'band selection and fill never reclaim a positive-score label');
  assert.equal(limited.filter(id=>score(id)===0).length,4);
  assert.deepEqual(limited,diagnosis.selectTrainingCandidates([...limitPool].reverse(),weakTag,limitTags),
    'label and diversity selection ignore input enumeration order');
  assert.deepEqual(new Set(limited.filter(id=>score(id)===0).map(id=>Number(id.slice(13))<=16?'low':
    Number(id.slice(13))<=20?'middle':'high')),new Set(['low','middle','high']));
  assert(new Set(limited.filter(id=>score(id)===0).map(id=>id.slice(8,12))).size>=3);
  const scarce=diagnosis.selectTrainingCandidates(limitPool.filter(x=>matchedIds.includes(x.id)||
    independentIds.slice(0,2).includes(x.id)),weakTag,limitTags);
  assert.equal(scarce.length,4,'short nonmatching pool returns fewer than six candidates');
  assert.equal(scarce.filter(id=>score(id)>0).length,2,'scarcity never expands the label allowance');
  console.log('LABEL_LIMIT',JSON.stringify({candidate_count:limited.length,label_matched:limited.filter(id=>score(id)>0).length,
    independent:limited.filter(id=>score(id)===0).length,scarce_count:scarce.length}));
  const untaggedSynthesis=core.validateRequest({phase:'synthesize',sync_code:code,paper_id,
    analyses:parsed.items,training_candidates:[training]},catalog);
  assert(!untaggedSynthesis.error);
  assert.equal(core.parseDeepSeekResponse(model({paper_id,targets:[target]}),untaggedSynthesis).targets[0]
    .training_match.question_id,training,'the server checks the untagged candidate image and answer');
  const noMatch=core.parseDeepSeekResponse(model({paper_id,targets:[{...target,training_match:null}]}),untaggedSynthesis);
  const uncovered=diagnosis.applyAiDiagnosis(fallback,parsed.items,noMatch,[training]);
  assert.equal(uncovered.focus[0].training_match,null);
  const pool=[{id:'archive_2011_20',source:'2011 AMC8',official:true},{id:training,source:'2006 AMC8',official:true},
    {id:'archive_2010_20',source:'2010 AMC8',official:true}];
  const plan=diagnosis.selectDaily([pool[0],pool[2],{id:'archive_2016_20',source:'2016 AMC8'}],pool,applied,
    new Set([pool[0].id]),new Set());
  assert.equal(plan.questions.length,3);assert(plan.questions.some(x=>x.id===training));
  assert.equal(plan.context[0].relation,'ai_image_answer_matched');
  assert(!diagnosis.selectDaily([pool[0],pool[2],{id:'archive_2016_20'}],pool,applied,
    new Set([pool[0].id]),new Set([training])).context.length,'excluded training question remains uncovered');
  assert.equal(diagnosis.selectDaily([pool[0],pool[2],{id:'archive_2016_20'}],pool,uncovered,
    new Set(),new Set()).context.length,0,'a mismatched candidate never enters the training plan');
  console.log('SAMPLE',JSON.stringify({method:applied.focus[0].method,
    evidence:applied.focus[0].evidence_question_ids,confidence:applied.focus[0].confidence,
    training_question:applied.focus[0].training_match.question_id,possible_cause_status:applied.focus[0].cause_status}));
  console.log('PASS: real AMC8 images and human-checked arithmetic, answer conflicts, cross-label method grouping, canonical candidate matching, and three-slot plan');
}
run().catch(e=>{console.error(e);process.exitCode=1});
