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
  if(!file.startsWith(root+path.sep)){res.writeHead(403).end();return}
  fs.readFile(file,(error,data)=>{
    if(error){res.writeHead(404).end();return}
    res.writeHead(200,{'Content-Type':{'.html':'text/html','.js':'text/javascript','.json':'application/json','.webp':'image/webp'}[path.extname(file)]||'application/octet-stream'});
    res.end(data);
  });
});

async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  const context=await browser.newContext();
  const page=await context.newPage();
  const errors=[],cloudRequests=[];
  page.on('pageerror',error=>errors.push(error.message));
  page.on('request',request=>{if(request.url().includes('/functions/v1/amc8-sync'))cloudRequests.push(request.url())});
  await page.route(/functions\/v1\/(amc8-sync|amc8-explain)/,route=>route.abort());
  if(process.env.SLOW_PRINT_IMAGE_MS){
    await page.route(/slowprint=1/,async route=>{
      await new Promise(resolve=>setTimeout(resolve,Number(process.env.SLOW_PRINT_IMAGE_MS)));
      await route.continue();
    });
  }
  if(process.env.FAIL_PRINT_IMAGE)await page.route(/slowprint=1/,route=>route.abort());
  try{
    await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575);
    const baseline=await page.evaluate(slowPrint=>{
      const ids=ARCHIVE_BANK.filter(q=>q.archive_image).slice(0,25).map(q=>q.id);
      assertIds(ids);
      S.printable_mock_ids=ids;
      S.printable_mock_id='QA-LOCKED-PRINT-PAPER';
      S.printable_mock_date='2026-10-28';
      S.mock_drafts={'QA-LOCKED-PRINT-PAPER':{answers:{},guesses:{},total_minutes:null}};
      window.__printCalls=[];
      window.print=()=>window.__printCalls.push({at:performance.now(),activation:navigator.userActivation?.isActive,title:document.title,questions:document.querySelectorAll('#printRoot .print-q').length,images:[...document.querySelectorAll('#printRoot img')].filter(img=>img.naturalWidth>0).length});
      show('mock');
      if(slowPrint)qById(ids[0]).archive_image+='?slowprint=1';
      return JSON.stringify({ids:S.printable_mock_ids,id:S.printable_mock_id,drafts:S.mock_drafts,mockHistory:S.mock_history,mockDetailHistory:S.mock_detail_history});
      function assertIds(v){if(v.length!==25)throw Error('archive fixture missing')}
    },!!(process.env.SLOW_PRINT_IMAGE_MS||process.env.FAIL_PRINT_IMAGE));
    await page.getByRole('button',{name:'打印学生卷'}).click();
    if(process.env.SLOW_PRINT_IMAGE_MS){
      await page.waitForFunction(()=>document.getElementById('mockPrintStatus')?.textContent.includes('再次点击'),null,{timeout:20000});
      assert.equal(await page.evaluate(()=>window.__printCalls.length),0,'slow loading cannot silently call print after user activation expires');
      await page.getByRole('button',{name:'打印学生卷'}).click();
    }else if(process.env.FAIL_PRINT_IMAGE){
      await page.getByText('原题图片未能全部加载，尚未打印，以免学生卷缺题。请检查网络后重试。').waitFor();
      assert.equal(await page.evaluate(()=>window.__printCalls.length),0,'failed source image must not print an incomplete paper');
    }else await page.waitForFunction(()=>window.__printCalls.length>0);
    const result=await page.evaluate(()=>({calls:window.__printCalls,after:JSON.stringify({ids:S.printable_mock_ids,id:S.printable_mock_id,drafts:S.mock_drafts,mockHistory:S.mock_history,mockDetailHistory:S.mock_detail_history})}));
    assert.equal(result.calls.length,process.env.FAIL_PRINT_IMAGE?0:1);
    if(result.calls.length){
      assert.equal(result.calls[0].questions,25);
      assert.equal(result.calls[0].images,25);
      assert.equal(result.calls[0].activation,true,'print is called directly from a live click');
      const pdf=await page.pdf({format:'A4',printBackground:true});
      assert.ok(pdf.length>10000,'the browser can render a nonempty 25-question print PDF');
    }
    assert.equal(result.after,baseline,'printing leaves the locked paper and answers unchanged');
    assert.deepEqual(errors,[]);
    assert.deepEqual(cloudRequests,[]);
    if(!process.env.SLOW_PRINT_IMAGE_MS&&!process.env.FAIL_PRINT_IMAGE){
      await page.getByRole('button',{name:'打印家长答案'}).click();
      await page.waitForFunction(()=>window.__printCalls.length===2);
      assert.match((await page.evaluate(()=>window.__printCalls[1].title)),/周末答案/);
      await page.getByRole('button',{name:'打印学生卷'}).click();
      await page.waitForFunction(()=>window.__printCalls.length===3);
      assert.equal(await page.evaluate(()=>window.__printCalls[2].questions),25,'student paper is rebuilt after the answer print changes printRoot');
    }
    console.log('PASS mock student print:',process.env.FAIL_PRINT_IMAGE?'missing image blocked':process.env.SLOW_PRINT_IMAGE_MS?'slow image ready and second-click printed':'25 questions printed on first click');
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve))}
}
main().catch(error=>{console.error(error);process.exitCode=1});
