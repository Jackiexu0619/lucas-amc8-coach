'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require('playwright');

const root=process.env.AMC8_UI_SOURCE_DIR||__dirname;
const output=process.env.AMC8_UI_CAPTURE_DIR;
if(!output)throw Error('Set AMC8_UI_CAPTURE_DIR to a local screenshot directory.');
fs.mkdirSync(output,{recursive:true});
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

async function capture(page,width){
  const noOverlap=async(selector,label)=>{
    const boxes=await page.locator(selector).evaluateAll(nodes=>nodes.filter(node=>node.getClientRects().length).map(node=>{
      const r=node.getBoundingClientRect();return {x:r.x,y:r.y,right:r.right,bottom:r.bottom};
    }));
    for(let i=0;i<boxes.length;i++)for(let j=i+1;j<boxes.length;j++){
      const horizontal=Math.min(boxes[i].right,boxes[j].right)-Math.max(boxes[i].x,boxes[j].x);
      const vertical=Math.min(boxes[i].bottom,boxes[j].bottom)-Math.max(boxes[i].y,boxes[j].y);
      assert.ok(horizontal<=1||vertical<=1,`${width}px ${label} controls overlap: ${i}, ${j}`);
    }
  };
  const shot=async(name,locator)=>{
    const file=path.join(output,width+'-'+name+'.png');
    await page.waitForTimeout(200);
    if(locator){await locator.scrollIntoViewIfNeeded();await locator.screenshot({path:file});}
    else await page.screenshot({path:file});
    const state=await page.evaluate(()=>({viewport:innerWidth,scroll:document.documentElement.scrollWidth}));
    assert.ok(state.scroll<=state.viewport,`${width}-${name} horizontal overflow: ${JSON.stringify(state)}`);
    console.log('CAPTURE '+file);
  };
  const checkNav=async key=>{
    if(await page.locator('header nav [data-view]').count())
      assert.equal(await page.locator('header nav [aria-current="page"]').getAttribute('data-view'),key);
  };
  await page.getByRole('button',{name:'主页',exact:true}).click();
  await checkNav('home');
  await noOverlap('header nav button','main navigation');
  await shot('home');
  await page.getByRole('button',{name:'每日训练'}).click();
  await checkNav('practice');
  await page.locator('#daily_ans_0').waitFor();
  await shot('daily-entry');
  await shot('daily-form',page.locator('.daily-q-card .entry-grid').first());
  await page.getByRole('button',{name:'学习报告'}).click();
  await checkNav('report');
  await page.locator('#reportCategoryNav').waitFor();
  await noOverlap('#reportCategoryNav button','report category navigation');
  await shot('report-categories');
  const day=page.locator('.daily-history-day[data-date="2026-10-24"]');
  await day.locator('summary').first().click();
  const paper=day.locator('.daily-history-paper[data-paper-id="D-20261024-archive_2002_20-archive_2000_16-archive_2000_17"]');
  await paper.locator('summary').first().click();
  await shot('report-archive',day);
  const question=paper.locator('.daily-history-question').first();
  await question.locator('summary').click();
  await question.locator('img').evaluate(img=>img.decode());
  const image=await question.locator('img').evaluate(img=>{
    const r=img.getBoundingClientRect();return {width:r.width,height:r.height,naturalWidth:img.naturalWidth,naturalHeight:img.naturalHeight};
  });
  assert.ok(image.naturalWidth>0&&image.naturalHeight>0,'original question image decoded');
  assert.ok(Math.abs(image.width/image.height-image.naturalWidth/image.naturalHeight)<.03,
    `${width}px question image ratio is distorted: ${JSON.stringify(image)}`);
  await shot('report-question',question);
  const solutionDay=page.locator('.daily-history-day[data-date="2026-10-23"]');
  await solutionDay.locator('summary').first().click();
  const solutionPaper=solutionDay.locator('.daily-history-paper[data-paper-id="QA_EXISTING_SOLUTION"]');
  await solutionPaper.locator('summary').first().click();
  const solvedQuestion=solutionPaper.locator('.daily-history-question').first();
  await solvedQuestion.locator('summary').click();
  assert.ok(await solvedQuestion.locator('.mock-solution-html').count(),'the source bank contains a real solution for 2015 AMC8 Q1');
  assert.ok(await solvedQuestion.locator('.mock-solution-html').evaluate(node=>node.scrollWidth<=node.clientWidth+1),
    `${width}px existing solution overflows its container`);
  await shot('report-solution',solvedQuestion);
  await page.getByRole('tab',{name:'周末模拟'}).click();
  await page.locator('#reportCategoryNav').scrollIntoViewIfNeeded();
  await shot('mock-report');
  await page.getByRole('button',{name:/家长设置/}).click();
  await checkNav('data');
  await shot('parent-settings');
}

async function main(){
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const browser=await chromium.launch({headless:true});
  try{
    for(const width of [1440,768,390]){
      const context=await browser.newContext({viewport:{width,height:900}});
      const page=await context.newPage();
      const errors=[];page.on('pageerror',error=>errors.push(error.message));
      await page.route('**/functions/v1/amc8-sync',route=>route.abort());
      await page.route('**/functions/v1/amc8-explain',route=>route.abort());
      await page.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
      await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575);
      if(await page.locator('.skip-link').count()){
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement?.className),'skip-link','keyboard users can skip to main content');
      }
      await page.evaluate(()=>{
        const pid='D-20261024-archive_2002_20-archive_2000_16-archive_2000_17';
        const ids=['archive_2002_20','archive_2000_16','archive_2000_17'];
        S.daily_sessions=[{date:'2026-10-24',paper_id:pid,question_ids:ids,question_count:3,correct:1,total_sec:135,timed_question_count:2,source:'paper_daily'}];
        S.attempts=ids.map((id,i)=>({date:'2026-10-24',paper_id:pid,paper_question_index:i+1,question_id:id,
          source:'paper_daily',selected_answer:['N',qById(ids[1]).answer,'C'][i],result_status:['unable','correct','wrong'][i],
          correct:i===1,guessed:false,hint_level:0,duration_sec:[null,35,100][i],
          error_type:i===0?'method_gap':i===2?'execution_error':null}));
        const solved=qById('archive_2015_01');
        S.daily_sessions.push({date:'2026-10-23',paper_id:'QA_EXISTING_SOLUTION',question_ids:[solved.id],question_count:1,
          correct:0,total_sec:90,timed_question_count:1,source:'paper_daily'});
        S.attempts.push({date:'2026-10-23',paper_id:'QA_EXISTING_SOLUTION',paper_question_index:1,
          question_id:solved.id,source:'paper_daily',selected_answer:solved.answer==='A'?'B':'A',result_status:'wrong',correct:false,
          guessed:false,hint_level:0,duration_sec:90,error_type:'method_gap'});
        const mock=ARCHIVE_BANK.filter(q=>q.year===2000).slice(0,25);
        S.mock_detail_history=[{date:'2026-10-22',paper_id:'QA_MOCK_25',question_ids:mock.map(q=>q.id),score:24,
          per_question:mock.map((q,i)=>({qid:q.id,index:i+1,result_status:i?'correct':'wrong',
            selected_answer:i?q.answer:'B',answer:q.answer,correct:i!==0,guessed:false,attempted:true}))}];
        S.mock_history=[{date:'2026-10-22',paper_id:'QA_MOCK_25',score:24,independent_score:24,count_in_estimate:true}];
        S.daily_plan={date:today(),paper_id:'QA_DAILY',question_ids:ids,submitted:false};
        renderAll();
      });
      await capture(page,width);
      assert.deepEqual(errors,[],`uncaught errors at ${width}px`);
      await context.close();
    }
  }finally{await browser.close();await new Promise(resolve=>server.close(resolve));}
}
main().catch(error=>{console.error(error);process.exitCode=1;});
