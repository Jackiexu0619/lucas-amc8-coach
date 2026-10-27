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
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.json':'application/json','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  });
});
const catalog=JSON.parse(fs.readFileSync(path.join(root,'supabase/functions/amc8-explain/question_index.json'),'utf8'));

async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext({viewport:{width:1200,height:850}});
  const page=await context.newPage();
  const errors=[],requests=[],cloudRequests=[];
  let conflict=true;
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(r.url().includes('/functions/v1/amc8-sync'))cloudRequests.push(r.url());});
  await page.route('**/functions/v1/amc8-explain',async route=>{
    const body=route.request().postDataJSON();requests.push(body);
    if(body.question_id==='archive_2000_17'&&conflict){
      conflict=false;
      await route.fulfill({status:422,contentType:'application/json',body:JSON.stringify({error:'answer_mismatch'})});return;
    }
    const q=catalog[body.question_id];
    const lesson={question_id:body.question_id,answer_letter:q.answer,recognized_question:'隔离测试题意',
      option_content:'16',computed_result:'16',knowledge_point:'测试知识点',method:'测试初等方法',
      entry_point:'先观察题目条件',steps:['第一步列式','第二步推导并核对'],
      common_mistake:'勿漏条件',mastery_tip:'独立复述关键步骤',source:'DeepSeek AI 生成'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,lesson})});
  });
  const oldPaper='D-20261024-archive_2002_20-archive_2000_16-archive_2000_17';
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575);
    const before=await page.evaluate(pid=>{
      const ids=['archive_2002_20','archive_2000_16','archive_2000_17'];
      const rec=(qid,index,answer,status,time)=>({date:'2026-10-24',paper_id:pid,paper_question_index:index,
        question_id:qid,source:'paper_daily',selected_answer:answer,result_status:status,
        correct:status==='correct',guessed:false,hint_level:0,duration_sec:time,
        error_type:status==='wrong'?'execution_error':status==='unable'?'method_gap':null});
      S.attempts=[rec(ids[0],1,'N','unable',null),rec(ids[1],2,qById(ids[1]).answer,'correct',35),
        rec(ids[2],3,'C','wrong',100)];
      S.daily_sessions=[{date:'2026-10-24',paper_id:pid,question_ids:ids,question_count:3,
        correct:1,total_sec:135,timed_question_count:2,source:'paper_daily'}];
      const solved=qById('archive_2015_01');
      solved.solution_html='<p>第一步：观察条件并列式。</p><p>第二步：计算，核对选项与标准答案。</p>';
      const sameDay='D-20261024-other';
      S.daily_sessions.push({date:'2026-10-24',paper_id:sameDay,question_ids:[solved.id],question_count:1,
        correct:1,total_sec:20,source:'paper_daily'});
      S.attempts.push({date:'2026-10-24',paper_id:sameDay,paper_question_index:1,question_id:solved.id,
        source:'paper_daily',selected_answer:solved.answer,result_status:'correct',correct:true,
        guessed:false,hint_level:0,duration_sec:20});
      S.daily_sessions.push({date:'2026-10-23',paper_id:'D-20261023-hinted',question_ids:['archive_2015_02'],
        question_count:1,correct:1,total_sec:30,source:'paper_daily'});
      const hinted=qById('archive_2015_02');
      S.attempts.push({date:'2026-10-23',paper_id:'D-20261023-hinted',paper_question_index:1,
        question_id:hinted.id,source:'paper_daily',selected_answer:hinted.answer,result_status:'correct',
        correct:true,guessed:false,hint_level:1,duration_sec:30});
      const mockQuestions=ARCHIVE_BANK.filter(q=>q.year===2000).slice(0,25);
      S.mock_detail_history=[{paper_id:'QA_MOCK_25',date:'2026-10-22',question_ids:mockQuestions.map(q=>q.id),
        per_question:mockQuestions.map((q,i)=>({qid:q.id,index:i+1,result_status:i===0?'wrong':'correct',
          selected_answer:i===0?'B':q.answer,answer:q.answer,correct:i!==0,guessed:false,attempted:true})),score:24}];
      S.mock_history=[{date:'2026-10-22',paper_id:'QA_MOCK_25',score:24,independent_score:24,
        count_in_estimate:true}];
      S.printable_mock_ids=mockQuestions.map(q=>q.id);S.printable_mock_paper_id='QA_LOCKED';
      S.cloud_meta={cloud_revision:48,last_sync_at:'2026-10-26T00:00:00Z'};
      S.daily_plan={date:'2026-10-27',paper_id:'QA_DAILY_LOCKED',question_ids:ids,submitted:false};
      localStorage.setItem('lucas_amc8_sync_code_v1','A'.repeat(32));
      saveStateLocal(false);
      return JSON.stringify({attempts:S.attempts,sessions:S.daily_sessions,mocks:S.mock_detail_history,
        locked:S.printable_mock_ids,plan:S.daily_plan,revision:S.cloud_meta.cloud_revision});
    },oldPaper);

    await page.getByRole('button',{name:'学习报告'}).click();
    const tabs=page.getByRole('tab');
    assert.deepEqual(await tabs.allTextContents(),['学习总览','每日专项','周末模拟','复测计划']);
    assert.equal(await page.locator('#reportCategory-daily').isVisible(),true);
    for(const key of ['overview','mock','review'])assert.equal(await page.locator('#reportCategory-'+key).isVisible(),false);
    assert.equal(await page.locator('#latestMockLearningReport').isVisible(),false,
      'daily report starts without a long mock report above it');
    assert.equal(await page.locator('#mockAiExplain').isVisible(),false,
      'mock AI explanation is not mixed into the daily category');
    assert.equal(requests.length,0,'opening report does not call DeepSeek');
    console.log('PASS categories: daily is default and other report groups are hidden.');

    const day=page.locator('.daily-history-day[data-date="2026-10-24"]');
    const paper=day.locator('.daily-history-paper[data-paper-id="'+oldPaper+'"]');
    await day.locator('summary').first().click();await paper.locator('summary').first().click();
    assert.equal(await day.locator('.daily-history-paper').count(),2,'same-day papers remain distinct');
    const labels=['2002 AMC8 Q20','2000 AMC8 Q16','2000 AMC8 Q17'];
    const expected=['不会','独立正确','答错'];
    for(let i=0;i<3;i++){
      const item=paper.locator('.daily-history-question').nth(i);
      assert.match(await item.locator('summary').innerText(),new RegExp(labels[i]+'.*'+expected[i]));
      await item.locator('summary').click();
      const image=item.locator('img.mock-review-paper-image');
      await image.evaluate(img=>img.decode());
      const dimensions=await image.evaluate(img=>({width:img.naturalWidth,height:img.naturalHeight,complete:img.complete}));
      assert.ok(dimensions.complete&&dimensions.width>0&&dimensions.height>0,
        'actual original image decoded for '+labels[i]);
      assert.match(await item.innerText(),/Lucas答案：.*官方答案：/);
    }
    assert.match(await paper.locator('.daily-history-question').first().innerText(),/暂无可靠解析/);
    const solvedPaper=day.locator('.daily-history-paper[data-paper-id="D-20261024-other"]');
    await solvedPaper.locator('summary').first().click();
    await solvedPaper.locator('.daily-history-question summary').click();
    assert.match(await solvedPaper.innerText(),/已有逐题解答资料.*第一步：观察条件并列式.*第二步：计算/s);
    assert.equal(requests.length,0,'existing explanations and images do not cause AI calls');
    console.log('PASS daily review: three real archived images decode; saved outcomes, missing solution and full solution fixture render.');

    const button=paper.getByRole('button',{name:'生成本卷待复盘题讲解'});
    await button.waitFor();
    assert.match(await paper.locator('.daily-ai-controls').innerText(),/本卷有 2 道待复盘题/);
    await button.click();
    await page.waitForFunction(()=>document.querySelector('.daily-history-paper[data-paper-id="'+
      'D-20261024-archive_2002_20-archive_2000_16-archive_2000_17'+
      '"] .daily-ai-controls [role="status"]')?.textContent?.includes('已处理 2/2'));
    assert.equal(requests.length,2);
    assert.deepEqual(requests.map(x=>x.question_id),['archive_2002_20','archive_2000_17']);
    assert.match(await paper.locator('.daily-ai-controls [role="status"]').innerText(),/成功 1，失败 1/);
    const wrong=paper.locator('.daily-history-question[data-question-index="3"]');
    assert.match(await wrong.innerText(),/答案待核验/);
    assert.doesNotMatch(await wrong.locator('.daily-ai-detail').innerText(),/第一步列式/);
    await wrong.getByRole('button',{name:'单题重新生成'}).click();
    await page.waitForFunction(()=>document.querySelector('.daily-history-paper[data-paper-id="'+
      'D-20261024-archive_2002_20-archive_2000_16-archive_2000_17'+
      '"] .daily-ai-controls [role="status"]')?.textContent?.includes('已处理 1/1'));
    assert.equal(requests.length,3,'single retry only requests the failed question');
    assert.match(await wrong.innerText(),/AI 生成讲解.*第一步列式/s);
    await page.getByRole('button',{name:'学习报告'}).click();
    await page.locator('#dailyHistoryRange').selectOption('all');
    await page.locator('.daily-history-day[data-date="2026-10-24"] summary').first().click();
    const reopened=page.locator('.daily-history-paper[data-paper-id="'+oldPaper+'"]');
    await reopened.locator('summary').first().click();
    await reopened.getByRole('button',{name:'生成本卷待复盘题讲解'}).waitFor();
    assert.equal(await reopened.getByText('已缓存').count(),2);
    assert.equal(requests.length,3,'reopening uses the existing v0.6.5.21 cache without a paid call');
    const hintDay=page.locator('.daily-history-day[data-date="2026-10-23"]');
    await hintDay.locator('summary').first().click();
    const hinted=hintDay.locator('.daily-history-paper[data-paper-id="D-20261023-hinted"]');
    await hinted.locator('summary').first().click();
    await hinted.getByRole('button',{name:'生成本卷待复盘题讲解'}).click();
    await page.waitForFunction(()=>document.querySelector('.daily-history-paper[data-paper-id="D-20261023-hinted"] .daily-ai-controls [role="status"]')?.textContent?.includes('已处理 1/1'));
    assert.equal(requests.at(-1).result_status,'hinted');
    assert.equal(requests.at(-1).hint_level,1,'hint evidence is sent truthfully to the existing backend');
    console.log('PASS daily AI: on-demand batch, partial failure, answer conflict, single retry and cache reuse.');

    await page.getByRole('tab',{name:'周末模拟'}).click();
    assert.equal(await page.locator('#reportCategory-mock').isVisible(),true);
    assert.equal(await page.locator('#dailyReviewHistory').isVisible(),false);
    assert.equal(await page.locator('#latestMockLearningReport .mock-review-item').count(),25);
    await page.locator('#mockAiExplain').waitFor();
    assert.equal(await page.locator('#mockAiExplain').isVisible(),true,
      'existing mock AI explanation belongs to the mock category');
    await page.getByRole('tab',{name:'复测计划'}).click();
    assert.equal(await page.locator('#officialReviewQueueReport').isVisible(),true);
    assert.equal(await page.locator('#aiTransferQueueReport').isVisible(),true);
    assert.equal(await page.locator('#latestMockLearningReport').isVisible(),false);
    await page.getByRole('tab',{name:'学习总览'}).click();
    assert.equal(await page.locator('#learningClosurePanel').isVisible(),true);
    await page.getByRole('tab',{name:'每日专项'}).click();
    await page.getByRole('tab',{name:'每日专项'}).press('ArrowRight');
    assert.equal(await page.locator('#reportCategory-mock').isVisible(),true,
      'keyboard navigation reaches the next category');
    await page.getByRole('tab',{name:'每日专项'}).click();
    await page.locator('#dailyHistoryRange').selectOption('30');
    await page.locator('#dailyHistoryRange').selectOption('all');
    await page.locator('#dailyHistoryDate').fill('2026-10-24');
    await page.locator('#dailyHistoryDate').dispatchEvent('change');
    assert.deepEqual(await page.locator('.daily-history-day').evaluateAll(nodes=>nodes.map(n=>n.dataset.date)),['2026-10-24']);
    await page.locator('#dailyHistoryClearDate').click();
    const after=await page.evaluate(()=>JSON.stringify({attempts:S.attempts,sessions:S.daily_sessions,
      mocks:S.mock_detail_history,locked:S.printable_mock_ids,plan:S.daily_plan,revision:S.cloud_meta.cloud_revision}));
    assert.equal(after,before,'reading and switching reports cannot change learner or cloud state');
    await page.setViewportSize({width:390,height:844});
    const mobileDay=page.locator('.daily-history-day[data-date="2026-10-24"]');
    await mobileDay.locator('summary').first().click();
    const mobilePaper=mobileDay.locator('.daily-history-paper[data-paper-id="'+oldPaper+'"]');
    await mobilePaper.locator('summary').first().click();
    await mobilePaper.locator('.daily-history-question summary').first().click();
    const mobile=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(mobile.scroll<=mobile.viewport,'no horizontal overflow at 390px: '+JSON.stringify(mobile));
    assert.deepEqual(cloudRequests,[],'report navigation and AI explanation do not call the learning-data sync endpoint');
    assert.deepEqual(errors,[],'no uncaught JavaScript errors');
    console.log('PASS navigation/state/mobile: four distinct tabs, filters, 25-question mock, queue panels, unchanged data and 390px layout.');
  }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(e=>{console.error(e);server.close();process.exitCode=1;});
