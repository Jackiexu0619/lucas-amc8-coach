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
  const errors=[],alerts=[],cloudRequests=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('dialog',async d=>{if(d.type()==='alert')alerts.push(d.message());await d.accept()});
  page.on('request',r=>{if(r.url().includes('/functions/v1/amc8-sync'))cloudRequests.push(r.url())});
  const url='http://127.0.0.1:'+server.address().port+'/';
  try{
    await page.goto(url,{waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575);
    const oldPaper='D-20261024-archive_2002_20-archive_2000_16-archive_2000_17';
    await page.evaluate(pid=>{
      S.attempts=[];S.daily_sessions=[];S.mock_history=[];S.mock_detail_history=[];
      S.cloud_meta={cloud_revision:48,last_sync_at:'2026-10-26T00:00:00.000Z',local_modified_at:'2026-10-26T00:00:00.000Z'};
      S.daily_plan={date:'2026-10-24',paper_id:pid,question_ids:['archive_2002_20','archive_2000_16','archive_2000_17'],submitted:false};
      saveStateLocal(false);show('practice');
    },oldPaper);
    for(const [i,answer,seconds] of [[0,'N',null],[1,'C','35'],[2,'C','100']]){
      await page.locator('#daily_ans_'+i).selectOption(answer);
      await page.locator('#daily_hint_'+i).selectOption('0');
      if(seconds!==null)await page.locator('#daily_sec_'+i).fill(seconds);
    }
    await page.getByRole('button',{name:'提交这3题的成绩'}).click();
    await page.waitForFunction(()=>S.daily_sessions?.length===1);
    const message=alerts.at(-1);
    for(const expected of ['训练日期：2026-10-24（旧卷）','正确：1/3题','独立正确：1题',
      '答错：1题（第3题）','不会：1题（第1题）','未做：0题','2分15秒（已记录2题，1题未记时）']){
      assert.ok(message.includes(expected),'submission alert must include '+expected);
    }
    const saved=await page.evaluate(()=>({
      session:S.daily_sessions[0],
      attempts:S.attempts.filter(a=>a.paper_id==='D-20261024-archive_2002_20-archive_2000_16-archive_2000_17')
        .map(a=>({question_id:a.question_id,paper_id:a.paper_id,index:a.paper_question_index,
          selected_answer:a.selected_answer,correct:a.correct,duration_sec:a.duration_sec,
          result_status:a.result_status,hint_level:a.hint_level})),
      mockHistory:S.mock_history.length,mockDetails:S.mock_detail_history.length,
      revision:S.cloud_meta.cloud_revision,active:document.querySelector('.view.active')?.id
    }));
    assert.equal(saved.session.paper_id,oldPaper);
    assert.equal(saved.session.date,'2026-10-24');
    assert.equal(saved.session.total_sec,135);
    assert.equal(saved.session.timed_question_count,2);
    assert.deepEqual(saved.attempts.map(a=>a.index),[1,2,3]);
    assert.deepEqual(saved.attempts.map(a=>a.result_status),['unable','correct','wrong']);
    assert.deepEqual(saved.attempts.map(a=>a.duration_sec),[null,35,100]);
    assert.equal(saved.mockHistory,0);assert.equal(saved.mockDetails,0);
    assert.equal(saved.revision,48);assert.equal(saved.active,'report');
    assert.equal(await page.locator('#dailyReviewHistory').count(),1);
    assert.equal(await page.locator('.daily-history-day[data-date="2026-10-24"]').getAttribute('open'),'');
    assert.equal(await page.locator('.daily-history-paper[data-paper-id="'+oldPaper+'"]').getAttribute('open'),'');
    assert.match(await page.locator('.daily-history-day[data-date="2026-10-24"]').innerText(),/正确1题.*答错1题.*不会1题/);
    console.log('PASS old-paper submission: saved 1/3, exclusive counts, 135 recorded seconds and immediate dated history.');

    await page.reload({waitUntil:'domcontentloaded'});
    await page.waitForFunction(()=>typeof ARCHIVE_BANK!=='undefined'&&ARCHIVE_BANK.length===575);
    await page.getByRole('button',{name:'学习报告'}).click();
    await page.locator('#dailyHistoryRange').selectOption('all');
    assert.equal(await page.locator('.daily-history-paper[data-paper-id="'+oldPaper+'"]').count(),1,
      'saved old paper remains available after refresh');
    console.log('PASS refresh: old paper remains available by date without regeneration or answer changes.');

    const dynamic=await page.evaluate(()=>{
      const addDay=(day,n)=>{const d=new Date(day+'T12:00:00');d.setDate(d.getDate()+n);return d.toISOString().slice(0,10)};
      const d15=addDay(today(),-15),d40=addDay(today(),-40);
      const ids=['archive_2000_16','archive_2000_17','archive_2000_18'];
      const make=(date,pid,questions=ids)=>({date,paper_id:pid,question_ids:questions,question_count:3,
        total_sec:90,timed_question_count:3,correct:2,source:'paper_daily'});
      const attempt=(date,pid,id,index,answer)=>({date,paper_id:pid,paper_question_index:index,
        question_id:id,source:'paper_daily',selected_answer:answer,correct:answer===qById(id).answer,
        result_status:answer===qById(id).answer?'correct':'wrong',guessed:false,hint_level:0,duration_sec:30});
      const a='D-20261023-first',b='D-20261023-second';
      const bIds=['archive_2000_16','archive_2000_19','archive_2000_20'];
      S.daily_sessions.push(make('2026-10-23',a),make('2026-10-23',b,bIds),
        {date:'2026-10-22',question_ids:['archive_2001_01','archive_2001_02','archive_2001_03'],question_count:3,source:'paper_daily',correct:1,total_sec:70},
        {date:'2026-10-21',question_ids:['archive_2001_04'],question_count:1,source:'paper_daily'},
        {date:'2026-10-21',question_ids:['archive_2001_04'],question_count:1,source:'paper_daily'},
        make(d15,'D-relative-15'),make(d40,'D-relative-40'));
      for(let i=0;i<3;i++)S.attempts.push(attempt('2026-10-23',a,ids[i],i+1,qById(ids[i]).answer));
      for(let i=0;i<3;i++)S.attempts.push(attempt('2026-10-23',b,bIds[i],i+1,
        i===0?'D':i===1?(qById(bIds[i]).answer==='A'?'B':'A'):qById(bIds[i]).answer));
      S.v064_specific_skills=S.v064_specific_skills||{};
      S.v064_specific_skills['archive_2000_19']={status:'pdf_explanation_reviewed',
        skill:'测试归档知识点',group_key:'archive_history_test',method:'测试归档方法'};
      for(let i=1;i<=3;i++)S.attempts.push({date:'2026-10-22',question_id:'archive_2001_0'+i,
        source:'paper_daily',selected_answer:i===1?qById('archive_2001_01').answer:'A',
        correct:i===1,result_status:i===1?'correct':'wrong',guessed:false,hint_level:0,duration_sec:i===1?70:null});
      S.attempts.push({date:'2026-10-21',question_id:'archive_2001_04',source:'paper_daily',
        selected_answer:'B',correct:false,result_status:'wrong'});
      for(const [date,pid] of [[d15,'D-relative-15'],[d40,'D-relative-40']]){
        for(let i=0;i<3;i++)S.attempts.push(attempt(date,pid,ids[i],i+1,qById(ids[i]).answer));
      }
      S.daily_plan={date:today(),paper_id:'D-current-locked',question_ids:ids,submitted:false};
      S.cloud_meta.cloud_revision=48;
      saveStateLocal(false);
      window.amc8V065Queue();
      const hintDate=today(),zeroDate=addDay(today(),-1);
      S.daily_sessions.push({...make(hintDate,'D-hints-only'),total_sec:null,timed_question_count:0},
        {...make(zeroDate,'D-zero-time'),total_sec:0,timed_question_count:3});
      for(let i=0;i<3;i++){
        S.attempts.push({...attempt(hintDate,'D-hints-only',ids[i],i+1,qById(ids[i]).answer),
          hint_level:i===1?2:1,duration_sec:null});
        S.attempts.push({...attempt(zeroDate,'D-zero-time',ids[i],i+1,qById(ids[i]).answer),
          duration_sec:0});
      }
      return {d15,d40,hintDate,zeroDate};
    });
    await page.getByRole('button',{name:'学习报告'}).click();
    await page.locator('#dailyHistoryRange').selectOption('all');
    const hintDay=page.locator('.daily-history-day[data-date="'+dynamic.hintDate+'"]');
    assert.match(await hintDay.locator('summary').first().innerText(),/有待复盘\/复测题/,
      'three hint-assisted correct answers are still review evidence in the rendered report');
    assert.doesNotMatch(await hintDay.locator('summary').first().innerText(),/未见本日薄弱证据/);
    assert.equal(await hintDay.locator('.daily-history-question').filter({hasText:'提示后答对'}).count(),3);
    await page.getByRole('tab',{name:'学习总览'}).click();
    const timeTable=page.getByRole('heading',{name:'最近每日3题纸上总用时'}).locator('..');
    assert.match(await timeTable.locator('tr').filter({hasText:dynamic.hintDate}).innerText(),/未记录/,
      'a null session duration must not be displayed as zero');
    assert.match(await timeTable.locator('tr').filter({hasText:dynamic.zeroDate}).innerText(),/00:00/,
      'a recorded zero-second duration remains distinct from missing time');
    await page.getByRole('tab',{name:'每日专项'}).click();
    console.log('PASS report hints/time: three hint-assisted correct answers need review; null is unrecorded and zero is 00:00.');
    const dates=await page.locator('.daily-history-day').evaluateAll(nodes=>nodes.map(n=>n.dataset.date));
    assert.deepEqual(dates,[...dates].sort().reverse(),'dates are grouped newest first');
    for(const date of ['2026-10-22','2026-10-23','2026-10-24'])assert.ok(dates.includes(date),date+' archive exists');
    const day23=page.locator('.daily-history-day[data-date="2026-10-23"]');
    assert.equal(await day23.locator('.daily-history-paper').count(),2,'two legitimate papers stay separate');
    const first=day23.locator('.daily-history-paper[data-paper-id="D-20261023-first"]');
    const second=day23.locator('.daily-history-paper[data-paper-id="D-20261023-second"]');
    assert.match(await first.locator('.daily-history-question').first().textContent(),/Lucas答案：C/);
    assert.match(await second.locator('.daily-history-question').first().textContent(),/Lucas答案：D/);
    const linked=await second.locator('.daily-history-question').nth(1).textContent();
    assert.match(linked,/知识点：测试归档知识点.*方法线索：测试归档方法/);
    assert.match(linked,/复测：真题专项：待复测；下次 2026-10-27/);
    const legacy=page.locator('.daily-history-day[data-date="2026-10-22"]');
    assert.match(await legacy.locator('.daily-history-question').first().textContent(),/Lucas答案：/);
    const ambiguous=page.locator('.daily-history-day[data-date="2026-10-21"]');
    assert.match(await ambiguous.locator('.daily-history-question').first().textContent(),/暂无可靠记录/);
    console.log('PASS dated archive: Oct 22/23/24, two same-day paper IDs, unique legacy fallback and ambiguous legacy restraint.');

    await page.locator('#dailyHistoryRange').selectOption('7');
    assert.equal(await page.locator('.daily-history-day[data-date="'+dynamic.d15+'"]').count(),0);
    await page.locator('#dailyHistoryRange').selectOption('30');
    assert.equal(await page.locator('.daily-history-day[data-date="'+dynamic.d15+'"]').count(),1);
    assert.equal(await page.locator('.daily-history-day[data-date="'+dynamic.d40+'"]').count(),0);
    await page.locator('#dailyHistoryRange').selectOption('all');
    assert.equal(await page.locator('.daily-history-day[data-date="'+dynamic.d40+'"]').count(),1);
    await page.locator('#dailyHistoryDate').fill('2026-10-23');
    await page.locator('#dailyHistoryDate').dispatchEvent('change');
    assert.deepEqual(await page.locator('.daily-history-day').evaluateAll(nodes=>nodes.map(n=>n.dataset.date)),['2026-10-23']);
    await page.locator('#dailyHistoryClearDate').click();
    assert.equal(await page.locator('.daily-history-day').count(),dates.length);
    const before=await page.evaluate(()=>JSON.stringify({attempts:S.attempts,sessions:S.daily_sessions,
      mock:S.mock_history,details:S.mock_detail_history,revision:S.cloud_meta.cloud_revision,
      modified:S.cloud_meta.local_modified_at}));
    await page.getByRole('button',{name:'学习报告'}).click();
    await page.getByRole('button',{name:'学习报告'}).click();
    assert.equal(await page.locator('#dailyReviewHistory').count(),1,'repeat navigation never duplicates panel');
    const after=await page.evaluate(()=>JSON.stringify({attempts:S.attempts,sessions:S.daily_sessions,
      mock:S.mock_history,details:S.mock_detail_history,revision:S.cloud_meta.cloud_revision,
      modified:S.cloud_meta.local_modified_at}));
    assert.equal(after,before,'read-only report filters and navigation do not mutate learning or cloud state');
    await page.evaluate(()=>{S.daily_plan=null});
    await page.getByRole('button',{name:'学习报告'}).click();
    assert.equal(await page.evaluate(()=>S.daily_plan),null,
      'opening report alone must not generate a new daily paper');
    assert.deepEqual(cloudRequests,[],'history never calls cloud sync');
    await page.setViewportSize({width:390,height:844});
    await day23.locator('summary').first().click();
    await first.locator('summary').first().click();
    const mobile=await page.evaluate(()=>({width:innerWidth,scroll:document.documentElement.scrollWidth,
      history:document.getElementById('dailyReviewHistory').scrollWidth,
      historyClient:document.getElementById('dailyReviewHistory').clientWidth,
      overflow:[...document.querySelectorAll('#dailyReviewHistory *')].filter(el=>el.getBoundingClientRect().right>innerWidth+1)
        .slice(0,5).map(el=>({tag:el.tagName,cls:el.className,width:Math.round(el.getBoundingClientRect().width),right:Math.round(el.getBoundingClientRect().right)}))}));
    assert.equal(mobile.history<=mobile.historyClient,true,
      'date groups and question details fit a 390px viewport: '+JSON.stringify(mobile));
    console.log('PASS filters/read-only/mobile: 7/30/all/date, no duplicate panel or mutation, 390px layout.');

    const questions=await page.evaluate(()=>['archive_2000_16','archive_2000_17','archive_2000_18']
      .map(id=>({id,answer:qById(id).answer})));
    const wrong=q=>q.answer==='A'?'B':'A';
    const scenarios=[
      {name:'all correct',answers:questions.map(q=>q.answer),hints:[0,0,0],guesses:[],expect:['正确：3/3题','独立正确：3题','答错：0题','不会：0题','未做：0题']},
      {name:'all wrong',answers:questions.map(wrong),hints:[0,0,0],guesses:[],expect:['正确：0/3题','答错：3题（第1、2、3题）','不会：0题','未做：0题']},
      {name:'all unable',answers:['N','N','N'],hints:[0,0,0],guesses:[],expect:['正确：0/3题','答错：0题','不会：3题（第1、2、3题）','未做：0题']},
      {name:'partial skip',answers:['X',questions[1].answer,wrong(questions[2])],hints:[0,0,0],guesses:[],expect:['正确：1/3题','答错：1题（第3题）','不会：0题','未做：1题（第1题）']},
      {name:'guess and hints',answers:questions.map(q=>q.answer),hints:[0,1,2],guesses:[0],expect:['正确：3/3题','独立正确：0题','答错：0题']}
    ];
    for(const scenario of scenarios){
      await page.evaluate(ids=>{
        S.attempts=[];S.daily_sessions=[];
        S.daily_plan={date:today(),paper_id:dailyPaperIdFromIds(ids,today()),question_ids:ids,submitted:false};
        renderPractice();show('practice');
      },questions.map(q=>q.id));
      for(let i=0;i<3;i++){
        await page.locator('#daily_ans_'+i).selectOption(scenario.answers[i]);
        await page.locator('#daily_hint_'+i).selectOption(String(scenario.hints[i]));
        if(scenario.guesses.includes(i))await page.locator('#daily_guess_'+i).check();
      }
      await page.getByRole('button',{name:'提交这3题的成绩'}).click();
      const text=alerts.at(-1);
      for(const expected of scenario.expect)assert.ok(text.includes(expected),scenario.name+' alert: '+expected);
      assert.equal(await page.evaluate(()=>S.daily_sessions.length),1,scenario.name+' saves one session');
    }
    assert.deepEqual(errors,[],'no uncaught browser errors');
    console.log('PASS submission boundaries: all right, all wrong, all unable, skipped, guessed and hint-assisted.');
  }finally{
    await context.close();await browser.close();await new Promise(resolve=>server.close(resolve));
  }
}
main().catch(error=>{console.error(error);server.close();process.exitCode=1});
