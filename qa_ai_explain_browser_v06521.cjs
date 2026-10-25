'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');
const root=__dirname;
const catalog=JSON.parse(fs.readFileSync(path.join(root,'supabase/functions/amc8-explain/question_index.json'),'utf8'));
const mime={'.html':'text/html','.js':'text/javascript','.json':'application/json','.webp':'image/webp','.css':'text/css'};
const server=http.createServer((req,res)=>{
  const name=decodeURIComponent((req.url||'/').split('?')[0]);
  const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return;}
  fs.readFile(file,(error,data)=>{if(error){res.writeHead(404).end();return;}
    res.writeHead(200,{'Content-Type':mime[path.extname(file)]||'application/octet-stream'});res.end(data);});
});
async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  const pageErrors=[];page.on('pageerror',error=>pageErrors.push(error.message));
  let calls=0,failSecond=true;
  await page.route('**/functions/v1/amc8-explain',async route=>{
    calls++;
    const request=route.request().postDataJSON();
    if(failSecond&&request.question_id==='archive_2000_02'){
      await route.fulfill({status:504,contentType:'application/json',body:JSON.stringify({error:'model_timeout_or_network'})});return;
    }
    const answer=catalog[request.question_id].answer;
    const lesson={question_id:request.question_id,answer_letter:answer,recognized_question:'测试题意',option_content:'测试选项',
      knowledge_point:'测试知识点',method:'测试方法',entry_point:'先看条件',steps:['第一步','第二步'],
      common_mistake:'遗漏条件',mastery_tip:'独立复述'};
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({ok:true,lesson})});
  });
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575,null,{timeout:60000});
    await page.evaluate(()=>{
      const qs=ARCHIVE_BANK.filter(q=>q.year===2000).slice(0,25);
      const per=qs.map((q,i)=>({qid:q.id,index:i+1,selected_answer:i===0?'A':q.answer,
        answer:q.answer,result_status:i===1?'unable':i===2?'skipped':i===0?'wrong':'correct',
        correct:i>=3,guessed:i===3,attempted:i!==1&&i!==2}));
      S.mock_detail_history=[{paper_id:'QA_PAPER_1',date:'2026-10-25',question_ids:qs.map(q=>q.id),per_question:per,score:22}];
      localStorage.setItem('lucas_amc8_sync_code_v1','A'.repeat(32));
      renderReport();show('report');
    });
    await page.locator('#mockAiExplain .mock-ai-explain-row').first().waitFor();
    assert.equal(await page.locator('#mockAiExplain .mock-ai-explain-row').count(),4);
    assert.equal(calls,0,'page load and report render must not call DeepSeek');
    await page.getByRole('button',{name:'生成本套待复盘题的 AI 讲解'}).click();
    await page.waitForFunction(()=>document.querySelector('#mockAiExplain [role="status"]')?.textContent?.includes('已处理 4/4'));
    assert.equal(calls,4);
    assert.match(await page.locator('#mockAiExplain [role="status"]').innerText(),/成功 3，失败 1/);
    assert.match(await page.locator('#mockAiExplain .mock-ai-explain-row').nth(1).innerText(),/超时/);
    failSecond=false;
    await page.locator('#mockAiExplain .mock-ai-explain-row').nth(1).getByRole('button',{name:'单题重新生成'}).click();
    await page.waitForFunction(()=>document.querySelector('#mockAiExplain [role="status"]')?.textContent?.includes('已处理 1/1'));
    assert.equal(calls,5,'only the failed question is retried');
    await page.evaluate(()=>renderReport());
    await page.locator('#mockAiExplain .mock-ai-explain-row').first().waitFor();
    assert.equal(await page.locator('#mockAiExplain').getByText('已缓存').count(),4);
    assert.equal(calls,5,'report reopen must use local cache');
    assert.deepEqual(pageErrors,[]);
    console.log('PASS: isolated browser report, no automatic API call, partial success, progress, single retry, and cache reopen.');
  }finally{await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1;});
