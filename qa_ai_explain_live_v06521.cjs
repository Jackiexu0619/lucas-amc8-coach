'use strict';
// Optional manual acceptance. Set AMC8_QA_SYNC_CODE to a disposable registered QA code.
// This test uses a fresh browser context and never submits or saves learner answers.
const assert=require('node:assert/strict');
const {chromium}=require('playwright');

async function main(){
  const code=process.env.AMC8_QA_SYNC_CODE||'';
  assert.match(code,/^[A-Z2-9]{20,64}$/,'Use a disposable QA sync code');
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  const pageErrors=[],requests=[];
  page.on('pageerror',e=>pageErrors.push(e.message));
  page.on('request',request=>{
    if(request.url().endsWith('/functions/v1/amc8-explain'))requests.push(Object.keys(request.headers()));
  });
  try{
    await page.goto('https://jackiexu0619.github.io/lucas-amc8-coach/?qa=live-v06521',
      {waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575,null,{timeout:60000});
    assert.match(await page.locator('h1').innerText(),/v0\.6\.5\.21/);
    const original=await page.evaluate(()=>({paper:S.printable_mock_id,
      questions:JSON.stringify(S.printable_mock_questions||[]),attempts:(S.attempts||[]).length}));
    await page.evaluate(qaCode=>{
      const qs=ARCHIVE_BANK.filter(q=>q.year===2000).slice(0,25);
      const per=qs.map((q,i)=>({qid:q.id,index:i+1,selected_answer:i===0?'A':q.answer,
        answer:q.answer,result_status:i===0?'wrong':'correct',correct:i!==0,guessed:false,attempted:true}));
      S.mock_detail_history=[{paper_id:'QA_LIVE_PAPER_1',date:'2026-10-25',
        question_ids:qs.map(q=>q.id),per_question:per,score:24}];
      localStorage.setItem('lucas_amc8_sync_code_v1',qaCode);
      renderReport();show('report');
    },code);
    await page.locator('#mockAiExplain .mock-ai-explain-row').waitFor();
    assert.equal(await page.locator('#mockAiExplain .mock-ai-explain-row').count(),1);
    assert.equal(requests.length,0,'rendering must not call the model');
    let reply=page.waitForResponse(r=>r.url().endsWith('/functions/v1/amc8-explain'),{timeout:70000});
    await page.getByRole('button',{name:'生成本套待复盘题的 AI 讲解'}).click();
    await reply;
    await page.waitForFunction(()=>document.querySelector('#mockAiExplain [role=status]')?.textContent?.includes('已处理 1/1'),null,{timeout:70000});
    let result=await page.locator('#mockAiExplain').innerText();
    for(let retry=0;retry<2&&!result.includes('成功 1，失败 0');retry++){
      reply=page.waitForResponse(r=>r.url().endsWith('/functions/v1/amc8-explain'),{timeout:70000});
      await page.locator('#mockAiExplain .mock-ai-explain-row').getByRole('button',{name:'单题重新生成'}).click();
      await reply;
      await page.waitForFunction(()=>document.querySelector('#mockAiExplain [role=status]')?.textContent?.includes('已处理 1/1'),null,{timeout:70000});
      result=await page.locator('#mockAiExplain').innerText();
    }
    assert.match(result,/成功 1，失败 0/,'live model never produced an accepted explanation');
    assert.match(result,/21/);assert.match(result,/16/);
    await page.evaluate(()=>renderReport());
    await page.locator('#mockAiExplain').getByText('已缓存').waitFor();
    const count=requests.length;
    await page.getByRole('button',{name:'生成本套待复盘题的 AI 讲解'}).click();
    await page.waitForFunction(()=>document.querySelector('#mockAiExplain [role=status]')?.textContent?.includes('已处理 1/1'));
    assert.equal(requests.length,count,'cached report must not call the model again');
    const after=await page.evaluate(()=>({paper:S.printable_mock_id,
      questions:JSON.stringify(S.printable_mock_questions||[]),attempts:(S.attempts||[]).length}));
    assert.deepEqual(after,original,'locked paper and attempts must remain untouched');
    await page.setViewportSize({width:390,height:844});
    assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
    assert.deepEqual(pageErrors,[]);
    assert.equal(requests.every(headers=>!headers.includes('authorization')),true,
      'browser requests must never carry the DeepSeek secret');
    console.log('PASS: deployed v0.6.5.21, real browser-to-Edge model request, reviewed Q1 math, retry, cache, mobile layout, and unchanged learning state; calls='+count);
  }finally{await context.close();await browser.close();}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
