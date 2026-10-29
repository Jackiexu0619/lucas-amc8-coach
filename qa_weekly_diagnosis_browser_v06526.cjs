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
    const evidence=await page.evaluate(()=>window.amcWeeklyDiagnosisV1.collectMockEvidence(
      S.mock_detail_history.at(-1),S,qById,window.amcWeeklyDiagnosisV1.tags));
    assert.equal(evidence.questions.length,25);
    assert(evidence.questions.some(x=>x.tag_hint===null&&x.result_status==='wrong'),
      'an untagged original question still enters AI analysis');
    assert(evidence.questions.every(x=>x.hint_level===null),'legacy weekend zero is not proof of no hint');
    const request={phase:'analyze',sync_code:'ABCDEFGHJKLMNPQRSTUVWXYZ2345',
      paper_id:submitted.diagnosis.paper_id,questions:evidence.questions.slice(0,5)};
    const validated=core.validateRequest(request,catalog);
    assert(!validated.error,'actual browser question evidence must pass server validation');
    assert.equal(core.buildDeepSeekRequest(validated).messages[1].content.filter(x=>x.type==='image_url').length,5);
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
    const aiContext=await browser.newContext({viewport:{width:1200,height:850}});
    try{
      const aiPage=await aiContext.newPage(),aiErrors=[],calls=[];
      let modelMode='match';
      let untaggedCandidates=[];
      aiPage.on('pageerror',e=>aiErrors.push(e.message));
      aiPage.on('dialog',d=>d.accept());
      const known={
        archive_2003_19:{answer:'C',result:'3',method:'使用最小公倍数定位区间内的公倍数',steps:['15、20、25的最小公倍数是300','区间内有1200、1500、1800']},
        archive_2004_19:{answer:'B',result:'62',method:'使用最小公倍数处理共同余数',steps:['x−2是3、4、5、6的公倍数','最小x是62']},
        archive_2005_20:{answer:'A',result:'6',method:'用周期同余求首次重合',steps:['每轮相对移动14格','14n被12整除，最小n=6']}
      };
      await aiPage.route('https://dfwojiefseopguoqugzs.supabase.co/**',async route=>{
        if(!route.request().url().endsWith('/functions/v1/amc8-diagnose')){await route.abort();return;}
        if(modelMode==='failure'){calls.push('failed');await route.fulfill({status:503,contentType:'application/json',
          body:JSON.stringify({error:'model_unavailable'})});return;}
        const body=route.request().postDataJSON(),input=core.validateRequest(body,catalog);
        assert(!input.error,`browser-built ${body.phase} request: ${input.error}`);
        calls.push(body.phase);
        let parsed;
        if(body.phase==='analyze'){
          if(modelMode==='unmatched')assert(input.questions.filter(x=>['archive_2003_19','archive_2004_19']
            .includes(x.question_id)).every(x=>x.tag_hint===null),'weak original questions have no method tags');
          const items=input.questions.map(x=>{
            const k=known[x.question_id];
            return k?{question_id:x.question_id,image_sufficient:true,recognized_question:'隔离样本原题已人工核对',
              derived_answer:k.answer,option_content:k.result,computed_result:k.result,method:k.method,
              method_evidence:'原题条件与选项核对',solution_steps:k.steps,possible_cause:null,
              unconfirmed_factors:['具体错误步骤未记录']}:{question_id:x.question_id,image_sufficient:false};
          });
          parsed=core.parseDeepSeekResponse({choices:[{finish_reason:'stop',message:{content:JSON.stringify({paper_id:body.paper_id,items})}}]},input);
        }else{
          if(modelMode==='unmatched')untaggedCandidates=input.trainingCandidates.map(x=>x.question_id);
          const training=input.trainingCandidates.find(x=>x.question_id==='archive_2006_23');
          if(modelMode==='match')assert(training,'a previously unseen original question must be offered as a candidate: '+
            input.trainingCandidates.map(x=>x.question_id).join(','));
          const target={target_id:'archive_2003_19',method:'利用最小公倍数处理整除与共同余数',
            observed_gap:'一题答错、一题猜对，独立掌握尚未证实',possible_cause:null,confidence:'medium',
            confidence_basis:'两道原题推导均使用最小公倍数且答案核对一致',unconfirmed_factors:['错因未记录'],
            training_goal:'独立建立公倍数与余数关系',evidence_question_ids:['archive_2003_19','archive_2004_19'],
            method_links:[{question_id:'archive_2003_19',reason:'区间公倍数计数'},
              {question_id:'archive_2004_19',reason:'共同余数转换'}],positive_question_ids:[],
            training_match:modelMode==='match'?{question_id:training.question_id,answer_letter:'A',
              reason:'新题余数条件可转为30的倍数，官方答案A'}:null};
          parsed=core.parseDeepSeekResponse({choices:[{finish_reason:'stop',message:{content:JSON.stringify({paper_id:body.paper_id,targets:[target]})}}]},input);
        }
        assert(parsed.ok,`mock model response rejected: ${parsed.error}`);
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(parsed)});
      });
      await aiPage.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
      await aiPage.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575);
      await aiPage.evaluate(()=>{
        const ids=['archive_2003_19','archive_2004_19','archive_2005_20',
          ...ARCHIVE_BANK.filter(q=>q.year===2002&&!['archive_2003_19','archive_2004_19','archive_2005_20'].includes(q.id))
            .slice(0,22).map(q=>q.id)];
        S.printable_mock_ids=ids;S.printable_mock_id='QA-AI-ORIGINAL-25';S.printable_mock_date='2026-10-28';
        const answers=Object.fromEntries(ids.map((id,i)=>[String(i),qById(id).answer]));answers['0']='A';
        S.mock_drafts={'QA-AI-ORIGINAL-25':{answers,guesses:{'1':true},total_minutes:40}};
        S.attempts=[];S.mock_detail_history=[];S.mock_history=[];S.weekly_method_diagnoses=[];
        S.daily_plan=null;S.daily_sessions=[];
        S.v064_question_tags={};S.v064_specific_skills={};
        S.v064_question_tags['archive_2006_23']={status:'reviewed',method:'使用最小公倍数处理共同余数',
          group_key:'qa_common_multiple',independent_math_verified:false};
        S.v064_question_tags['archive_2003_19']={status:'reviewed',method:'使用最小公倍数处理共同余数',
          group_key:'qa_common_multiple',independent_math_verified:false};
        localStorage.setItem('lucas_amc8_sync_code_v1','ABCDEFGHJKLMNPQRSTUVWXYZ2345');
        saveStateLocal(false);
      });
      await aiPage.getByRole('button',{name:'周末模拟'}).click();
      await aiPage.getByRole('button',{name:'提交整套记录'}).click();
      await aiPage.waitForFunction(()=>S.weekly_method_diagnoses?.at(-1)?.ai_status==='validated',{timeout:30000});
      const aiResult=await aiPage.evaluate(()=>({record:S.weekly_method_diagnoses.at(-1),
        attempts:JSON.stringify(S.attempts),mocks:S.mock_detail_history.length}));
      assert.equal(aiResult.record.source,'ai_original_analysis');
      assert.equal(aiResult.record.focus[0].training_match.question_id,'archive_2006_23');
      assert.equal(aiResult.mocks,1);assert.equal(JSON.parse(aiResult.attempts).length,25);
      assert.deepEqual(calls,['analyze','analyze','analyze','analyze','analyze','synthesize']);
      await aiPage.getByRole('button',{name:'学习报告'}).click();
      await aiPage.getByRole('tab',{name:'学习总览'}).click();
      assert.match(await aiPage.locator('#weeklyMethodDiagnosis').innerText(),/AI原题分析.*利用最小公倍数处理整除与共同余数/s);
      await aiPage.getByRole('button',{name:'学习报告'}).click();
      assert.equal(calls.length,6,'reopening the report must not repeat model calls');
      await aiPage.evaluate(()=>{S.daily_plan=null;});
      await aiPage.getByRole('button',{name:'每日训练'}).click();
      const next=await aiPage.evaluate(()=>({ids:S.daily_plan?.question_ids,ctx:S.daily_plan?.weekly_diagnosis_context||[],
        attempts:JSON.stringify(S.attempts)}));
      assert.equal(next.ids?.length,3);assert(next.ids.includes('archive_2006_23'));
      assert.equal(next.ctx[0].relation,'ai_image_answer_matched');assert.equal(next.attempts,aiResult.attempts);
      modelMode='unmatched';
      await aiPage.evaluate(()=>{
        const ids=['archive_2003_19','archive_2004_19','archive_2005_20',
          ...ARCHIVE_BANK.filter(q=>q.year===2002).slice(0,22).map(q=>q.id)];
        S.printable_mock_ids=ids;S.printable_mock_id='QA-AI-UNTAGGED-25';S.printable_mock_date='2026-10-29';
        const answers=Object.fromEntries(ids.map((id,i)=>[String(i),qById(id).answer]));answers['0']='A';
        S.mock_drafts={'QA-AI-UNTAGGED-25':{answers,guesses:{'1':true},total_minutes:40}};
        S.v064_question_tags={};S.v064_specific_skills={};S.daily_plan=null;
        window.amcLearningClosureV06514.getTag=()=>null;
        saveStateLocal(false);
      });
      assert.equal(await aiPage.evaluate(()=>window.amcWeeklyDiagnosisV1.tags(qById('archive_2003_19')).confidence),'unknown');
      await aiPage.getByRole('button',{name:'周末模拟'}).click();
      await aiPage.getByRole('button',{name:'提交整套记录'}).click();
      await aiPage.waitForFunction(()=>S.weekly_method_diagnoses?.at(-1)?.ai_status==='validated');
      const untaggedResult=await aiPage.evaluate(()=>S.weekly_method_diagnoses.at(-1));
      assert.equal(untaggedResult.paper_id,'QA-AI-UNTAGGED-25');
      assert.equal(untaggedResult.source,'ai_original_analysis');
      assert.equal(untaggedResult.focus[0].training_match,null);
      assert.equal(untaggedCandidates.length,6);
      assert(new Set(untaggedCandidates.map(id=>id.slice(8,12))).size>=4);
      assert.deepEqual(new Set(untaggedCandidates.map(id=>Number(id.slice(13))<=16?'low':
        Number(id.slice(13))<=20?'middle':'high')),new Set(['low','middle','high']));
      await aiPage.getByRole('button',{name:'学习报告'}).click();
      await aiPage.getByRole('tab',{name:'学习总览'}).click();
      assert.match(await aiPage.locator('#weeklyMethodDiagnosis').innerText(),/目标暂未覆盖：尚无经过原题核对的同方法候选/);
      const callsBeforeReopen=calls.length;
      await aiPage.getByRole('button',{name:'学习报告'}).click();
      assert.equal(calls.length,callsBeforeReopen,'an unmatched target does not repeat diagnosis on report navigation');
      // A pre-existing daily paper stays locked; inspect only the next disposable, unplanned paper.
      await aiPage.evaluate(()=>{S.daily_plan=null;});
      await aiPage.getByRole('button',{name:'每日训练'}).click();
      const untaggedDaily=await aiPage.evaluate(()=>({ids:S.daily_plan?.question_ids,context:S.daily_plan?.weekly_diagnosis_context||[]}));
      assert.equal(untaggedDaily.ids?.length,3);assert.equal(untaggedDaily.context.length,0,
        'an unverified candidate cannot be presented as targeted practice: '+JSON.stringify(untaggedDaily.context));
      modelMode='failure';
      await aiPage.evaluate(()=>{
        const ids=['archive_2003_19','archive_2004_19','archive_2005_20',
          ...ARCHIVE_BANK.filter(q=>q.year===2002).slice(0,22).map(q=>q.id)];
        S.printable_mock_ids=ids;S.printable_mock_id='QA-AI-FAIL-25';S.printable_mock_date='2026-10-30';
        const answers=Object.fromEntries(ids.map((id,i)=>[String(i),qById(id).answer]));answers['0']='A';
        S.mock_drafts={'QA-AI-FAIL-25':{answers,guesses:{'1':true},total_minutes:40}};
        saveStateLocal(false);
      });
      await aiPage.getByRole('button',{name:'周末模拟'}).click();
      await aiPage.getByRole('button',{name:'提交整套记录'}).click();
      await aiPage.waitForFunction(()=>S.weekly_method_diagnoses?.at(-1)?.ai_status==='rules_fallback:model_unavailable');
      const failed=await aiPage.evaluate(()=>({record:S.weekly_method_diagnoses.at(-1),count:S.weekly_method_diagnoses.length}));
      assert.equal(failed.record.source,'rules');assert.equal(failed.count,3);
      assert(calls.includes('failed'),'model service failure must be exercised');
      assert.deepEqual(aiErrors,[]);
      console.log('PASS browser AI: original-question method -> three-question plan; all-untagged mock stays uncovered without a verified candidate; report reopen is read-only; model failure retains rules');
    }finally{await aiContext.close();}
  }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
run().catch(e=>{console.error(e);process.exitCode=1});
