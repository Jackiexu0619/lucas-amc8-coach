'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=__dirname;
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent((req.url||'/').split('?')[0]);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.json':'application/json','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream'});res.end(data);
  });
});
async function run(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:850}});
  const page=await context.newPage(),errors=[],remote=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('supabase.co'))remote.push(r.url());});
  page.on('dialog',d=>d.accept());
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575&&window.amcLearningClosureV06514?.status().status==='ready');
    const before=await page.evaluate(()=>{
      const qs=ARCHIVE_BANK.filter(q=>q.year===2000).slice(0,25);
      const id='QA-WEEKLY-25';
      S.printable_mock_ids=qs.map(q=>q.id);S.printable_mock_id=id;S.printable_mock_date='2026-10-28';
      const answers=Object.fromEntries(qs.map((q,i)=>[String(i),q.answer]));
      answers['15']='N';answers['16']=qs[16].answer==='A'?'B':'A';
      answers['21']=qs[21].answer==='A'?'B':'A';
      S.mock_drafts={[id]:{answers,guesses:{'19':true},total_minutes:43}};
      S.v064_question_tags=S.v064_question_tags||{};
      S.v064_question_tags[qs[15].id]={status:'reviewed',skill:'测试家长技能',method:'测试具体方法15',group_key:'parent_group',independent_math_verified:false};
      S.v064_specific_skills=S.v064_specific_skills||{};
      S.v064_specific_skills[qs[16].id]={status:'pdf_explanation_reviewed',skill:'测试PDF技能',method:'测试具体方法16',group_key:'pdf_group_16',independent_math_verified:false};
      const pool=ARCHIVE_BANK.find(q=>q.year===2001&&q.problem_number===18);
      S.v064_specific_skills[pool.id]={status:'pdf_explanation_reviewed',skill:'测试PDF技能',method:'测试具体方法16',group_key:'pdf_group_16',independent_math_verified:false};
      const originalGetTag=window.amcLearningClosureV06514.getTag;
      window.amcLearningClosureV06514.getTag=qid=>qid===qs[21].id?null:originalGetTag(qid);
      const mapped=[15,16,19,21].map(i=>window.amcWeeklyDiagnosisV1.tags(qs[i]));
      S.attempts=[];S.mock_detail_history=[];S.mock_history=[];S.weekly_method_diagnoses=[];
      S.daily_plan=null;S.daily_sessions=[];
      saveStateLocal(false);
      return {id,question_ids:qs.map(q=>q.id),pool_id:pool.id,mapped};
    });
    assert.deepEqual(before.mapped.map(x=>x.confidence),['parent_reviewed','pdf_method_reviewed_not_math_verified','pdf_method_reviewed_not_math_verified','unknown']);
    assert.equal(before.mapped[1].groupKey,'pdf_group_16');
    assert.equal(before.mapped[2].groupKey,'逻辑推理');
    assert(before.mapped.every(x=>x.mathIndependentlyVerified===false));
    await page.getByRole('button',{name:'周末模拟'}).click();
    await page.getByRole('button',{name:'提交整套记录'}).click();
    const submitted=await page.evaluate(()=>({attempts:S.attempts.length,mocks:S.mock_detail_history.length,
      diagnosis:S.weekly_method_diagnoses?.at(-1),paper_id:S.mock_detail_history.at(-1)?.paper_id}));
    assert.equal(submitted.attempts,25);assert.equal(submitted.mocks,1);assert.equal(submitted.paper_id,before.id);
    assert.equal(submitted.diagnosis.paper_id,before.id);assert.equal(submitted.diagnosis.focus.length,3);
    assert(submitted.diagnosis.focus.every(x=>x.evidence_question_ids.every(id=>before.question_ids.includes(id))));
    assert(submitted.diagnosis.unresolved.some(x=>x.question_id===before.question_ids[21]));
    assert(submitted.diagnosis.focus.some(x=>x.group_key==='pdf_group_16'&&x.related_pending_review));
    assert.equal(submitted.diagnosis.ai_status,'rules_fallback:sync_code_unavailable');
    const core=await import('./supabase/functions/amc8-diagnose/core.mjs');
    const catalog=JSON.parse(fs.readFileSync(path.join(root,'supabase/functions/amc8-explain/question_index.json'),'utf8'));
    const request={sync_code:'ABCDEFGHJKLMNPQRSTUVWXYZ2345',paper_id:submitted.diagnosis.paper_id,
      whole_paper_minutes:submitted.diagnosis.whole_paper_minutes,candidates:submitted.diagnosis.candidates.map(c=>({
        target_id:c.target_id,method:c.method,evidence_question_ids:c.evidence_question_ids,
        results:c.evidence.map(e=>e.result),historical_independent_count:c.historical_independent_question_ids.length,
        related_pending_review:c.related_pending_review,tag_confidence:c.tag_confidence}))};
    const validated=core.validateRequest(request,catalog);
    assert(!validated.error,'actual browser candidate request must pass server validation');
    const first=request.candidates[0];
    const reason={wrong:'incorrect',unable:'unable',skipped:'unanswered',guessed:'guessed',hinted:'hinted',slow:'slow'}[first.results[0]];
    const modelReply=value=>({choices:[{finish_reason:'stop',message:{content:JSON.stringify(value)}}]});
    const accepted=core.parseDeepSeekResponse(modelReply({paper_id:request.paper_id,targets:[{
      target_id:first.target_id,evidence_question_ids:first.evidence_question_ids,reason_codes:[reason]}]}),validated);
    assert(accepted.ok);
    assert(require('./coach_weekly_diagnosis_v1.js').applyAiRanking(submitted.diagnosis,accepted)?.focus.length===1);
    assert.equal(core.parseDeepSeekResponse(modelReply({paper_id:request.paper_id,targets:[{
      target_id:'archive_1999_01',evidence_question_ids:first.evidence_question_ids,reason_codes:[reason]}]}),validated).error,
      'invalid_model_diagnosis');
    await page.getByRole('button',{name:'学习报告'}).click();
    await page.getByRole('tab',{name:'学习总览'}).click();
    assert.match(await page.locator('#weeklyMethodDiagnosis').innerText(),/本周优先攻克的方法.*测试具体方法/s);
    await page.getByRole('button',{name:'学习报告'}).click();
    assert.equal(await page.locator('#weeklyMethodDiagnosis').count(),1);
    const after=await page.evaluate(()=>({attempts:S.attempts.length,mocks:S.mock_detail_history.length,
      diagnoses:S.weekly_method_diagnoses.length,history:JSON.stringify(S.attempts)}));
    assert.equal(after.attempts,25);assert.equal(after.mocks,1);assert.equal(after.diagnoses,1);
    // A locked daily paper is preserved. Simulate the next unplanned training day in this disposable context.
    await page.evaluate(()=>{S.daily_plan=null;});
    await page.getByRole('button',{name:'每日训练'}).click();
    const daily=await page.evaluate(()=>({ids:S.daily_plan?.question_ids,context:S.daily_plan?.weekly_diagnosis_context||[]}));
    assert.equal(daily.ids?.length,3);assert(daily.context.every(x=>x.paper_id===before.id));
    assert(daily.context.length>0,'weekly diagnosis must explain at least one selected daily question');
    assert.equal(await page.evaluate(()=>JSON.stringify(S.attempts)),after.history,'daily view must not alter mock answers');
    assert.equal(remote.length,0,'isolated no-sync-code browser must not contact production Supabase');
    assert.deepEqual(errors,[]);
    console.log('PASS browser: normal 25-question submission -> three grounded targets -> report idempotence -> three daily questions with source context; no production network');
  }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
