const assert=require('node:assert/strict');
const diagnosis=require('./coach_weekly_diagnosis_v1.js');

async function run(){
  const questions=Array.from({length:25},(_,i)=>({id:`archive_2018_${String(i+1).padStart(2,'0')}`,
    year:2018,problem_number:i+1,answer:'A',source:'archive_official',official:true}));
  const prior={id:'archive_2017_18',answer:'A',problem_number:18,source:'archive_official',official:true};
  const candidate={id:'archive_2017_19',answer:'B',problem_number:19,source:'archive_official',official:true};
  const filler=[20,21,22].map(n=>({id:`archive_2016_${n}`,answer:'A',problem_number:n,source:'archive_official',official:true}));
  const bank=[...questions,prior,candidate,...filler],byId=new Map(bank.map(q=>[q.id,q]));
  const lookup=id=>byId.get(id)||null;
  const tagMap=new Map([
    [questions[0].id,{method:'列出互斥情况并计数',skill:'计数',groupKey:'counting_cases',confidence:'parent_reviewed'}],
    [questions[1].id,{method:'利用补集计算概率',skill:'概率',groupKey:'probability_complement',confidence:'pdf_method_reviewed_not_math_verified'}],
    [questions[2].id,{method:'质因数指数加一求因数个数',skill:'数论',groupKey:'prime_divisors',confidence:'pdf_method_reviewed_not_math_verified'}],
    [prior.id,{method:'列出互斥情况并计数',skill:'计数',groupKey:'counting_cases',confidence:'parent_reviewed'}],
    [candidate.id,{method:'利用补集计算概率',skill:'概率',groupKey:'probability_complement',confidence:'pdf_method_reviewed_not_math_verified'}]
  ]);
  const tags=q=>tagMap.get(q.id)||{};
  const parentTag={status:'reviewed',skill:'计数',method:'列出互斥情况并计数',group_key:'counting_cases',independent_math_verified:false};
  assert.deepEqual(diagnosis.diagnosisTags(questions[0],{v064_question_tags:{[questions[0].id]:parentTag}},null),{
    skill:'计数',method:'列出互斥情况并计数',groupKey:'counting_cases',confidence:'parent_reviewed',mathIndependentlyVerified:false});
  const pdfTag={status:'pdf_explanation_reviewed',skill:'概率',method:'利用补集计算概率',group_key:'probability_complement',independent_math_verified:false};
  assert.equal(diagnosis.diagnosisTags(questions[1],{v064_specific_skills:{[questions[1].id]:pdfTag}},null).confidence,
    'pdf_method_reviewed_not_math_verified');
  assert.equal(diagnosis.diagnosisTags(questions[1],{},pdfTag).groupKey,'probability_complement');
  assert.equal(diagnosis.diagnosisTags({...questions[3],core_method:'archive_method_2018_04'}, {}, null).confidence,'unknown');
  assert.equal(diagnosis.diagnosisTags({...questions[3],core_method:'利用补集计算概率',method_tag_status:'reviewed'}, {}, null).confidence,'source_metadata');
  assert.equal(diagnosis.diagnosisTags(questions[0],{v064_question_tags:{[questions[0].id]:{...parentTag,method:'human_confirmed'}}},null).confidence,'unknown');
  assert.equal(diagnosis.diagnosisTags(questions[0],{v064_question_tags:{[questions[0].id]:{...parentTag,independent_math_verified:true}}},null).mathIndependentlyVerified,true);
  const results=questions.map((q,i)=>({qid:q.id,index:i+1,answer:q.answer,selected_answer:'A',correct:true,
    result_status:'correct',guessed:false}));
  results[0]={...results[0],selected_answer:'B',correct:false,result_status:'wrong'};
  results[1]={...results[1],guessed:true};
  results[2]={...results[2],selected_answer:null,correct:false,result_status:'unable'};
  results[3]={...results[3],selected_answer:null,correct:false,result_status:'skipped'};
  const detail={paper_id:'W-20261028-01',date:'2026-10-28',question_ids:questions.map(q=>q.id),
    per_question:results,total_minutes:42,score:22};
  const attempts=results.map((r,i)=>({question_id:r.qid,paper_id:detail.paper_id,paper_question_index:i+1,
    date:detail.date,source:'weekend_mock',selected_answer:r.selected_answer,correct:r.correct,
    result_status:r.result_status,guessed:r.guessed,hint_level:0,duration_sec:null,error_type:i===0?'unsure':null}));
  const state={attempts:[{question_id:prior.id,paper_id:'D-older',paper_question_index:1,date:'2026-10-21',
    source:'paper_daily',selected_answer:'A',correct:true,result_status:'correct',guessed:false,hint_level:0},...attempts],
    v065_review_cycle:{tasks:[{status:'pending',key:'pdf-method:probability_complement'}]}};
  const before=JSON.stringify(state.attempts);
  const record=diagnosis.diagnose(detail,state,lookup,tags,'2026-10-28T12:00:00Z');
  assert(record&&record.focus.length===3);
  assert.deepEqual(new Set(record.focus.map(x=>x.method)),new Set([
    '列出互斥情况并计数','利用补集计算概率','质因数指数加一求因数个数']));
  assert.equal(record.unresolved.length,1,'unmapped skipped answer stays unresolved');
  assert.equal(record.focus.find(x=>x.target_id===questions[1].id).confidence,'low');
  assert.deepEqual(record.focus.find(x=>x.target_id===questions[0].id).historical_independent_question_ids,[prior.id]);
  assert.equal(record.time_evidence,'whole_paper_only');
  assert.match(record.time_note,/没有逐题用时/);
  assert(record.focus.every(x=>x.needs_weekend_verification));
  assert.equal(JSON.stringify(state.attempts),before,'diagnosis must not mutate original answers');
  assert(!record.focus.some(x=>x.evidence_question_ids.includes(questions[4].id)),'independent correct is not a weakness');
  assert.equal(diagnosis.diagnose({...detail,per_question:results.slice(0,24)},state,lookup,tags),null);
  const missingAnswerState={...state,attempts:state.attempts.map(a=>a.question_id===questions[0].id?{...a,selected_answer:null}:a)};
  const missingAnswer=diagnosis.diagnose(detail,missingAnswerState,lookup,tags);
  assert(missingAnswer.unresolved.some(x=>x.question_id===questions[0].id));
  const missingOfficial=diagnosis.diagnose(detail,state,id=>id===questions[0].id?{...lookup(id),answer:null}:lookup(id),tags);
  assert(missingOfficial.unresolved.some(x=>x.question_id===questions[0].id&&/标准答案缺失/.test(x.reason)));
  const placeholderTags=q=>q.id===questions[0].id?{method:'human_confirmed',confidence:'parent_reviewed'}:tags(q);
  const placeholder=diagnosis.diagnose(detail,state,lookup,placeholderTags);
  assert(placeholder.unresolved.some(x=>x.question_id===questions[0].id&&/具体方法标签/.test(x.reason)));
  const inconsistent=diagnosis.diagnose(detail,{...state,attempts:state.attempts.map(a=>
    a.question_id===questions[0].id?{...a,selected_answer:'A'}:a)},lookup,tags);
  assert(inconsistent.unresolved.some(x=>x.question_id===questions[0].id&&/标准答案不一致/.test(x.reason)));
  const duplicate=diagnosis.diagnose(detail,{...state,attempts:[...state.attempts,{...attempts[0]}]},lookup,tags);
  assert(duplicate.unresolved.some(x=>x.question_id===questions[0].id&&/多条作答/.test(x.reason)));
  const onlyOne=diagnosis.diagnose({...detail,per_question:results.map((r,i)=>i===0?r:{...r,correct:true,guessed:false,result_status:'correct',selected_answer:'A'})},
    {...state,attempts:state.attempts.filter(a=>a.paper_id!=='W-20261028-01')},lookup,tags);
  assert.equal(onlyOne.focus.length,1,'do not invent two more focus methods');
  const protectedIds=new Set([filler[0].id]);
  const plan=diagnosis.selectDaily([filler[0],filler[1],filler[2]],[...filler,candidate],record,protectedIds,new Set(),tags);
  assert.equal(plan.questions.length,3);
  assert(plan.questions.some(q=>q.id===candidate.id),'weekly focus influences a non-protected daily slot');
  assert.equal(plan.questions[0].id,filler[0].id,'due official review remains protected');
  assert(plan.context.some(x=>x.paper_id===detail.paper_id&&x.evidence_question_ids.includes(questions[1].id)));
  assert.equal(diagnosis.selectDaily([filler[0],filler[1],filler[2]],[...filler,candidate],record,
    new Set(filler.map(q=>q.id)),new Set(),tags).questions[2].id,filler[2].id,'all protected slots remain unchanged');
  const excluded=diagnosis.selectDaily([filler[0],filler[1],filler[2]],[...filler,candidate],record,
    protectedIds,new Set([candidate.id]),tags);
  assert(!excluded.questions.some(q=>q.id===candidate.id),'old-paper exclusion remains active');

  console.log('PASS: conservative rule fallback, label evidence, review slots, and daily limit');
}
run().catch(e=>{console.error(e);process.exitCode=1});
